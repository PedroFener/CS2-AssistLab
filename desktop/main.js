// CS2 AssistLab — aplicativo Windows (Electron).
// Roda o servidor do painel GSI dentro do próprio app e oferece um painel de
// controle: iniciar/encerrar, endereço, porta, token, estado e desempenho.
import { app, BrowserWindow, ipcMain, shell, clipboard, dialog } from "electron";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createDashboard } from "./dashboard/src/server.js";
import { buildGsiConfig } from "./dashboard/src/gsi.js";
import { loadSettings, saveSettings, validateSettings, viewHost, newToken } from "./src/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SMOKE = process.argv.includes("--smoke-test");

let win = null;
let radarWin = null;
let dash = null;
let settings = null;
let lastError = "";
let quitting = false;

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
const logDir = () => path.join(app.getPath("documents"), "CS2 AssistLab", "logs");
const publicDir = () => path.join(__dirname, "dashboard", "public");

// ------------------------------------------------------------------ serviço

async function startService() {
  if (dash) return;
  const { errors } = validateSettings(settings);
  if (errors.length) throw new Error(errors.join(" "));
  const d = createDashboard({
    host: settings.host, port: settings.port, token: settings.token,
    logDir: settings.csvLog ? logDir() : null, rawLog: settings.rawLog, publicDir: publicDir(),
  });
  try {
    await d.start();
    dash = d;
    lastError = "";
  } catch (e) {
    lastError = e.message;
    throw e;
  }
}

async function stopService() {
  if (!dash) return null;
  const d = dash;
  dash = null;
  if (radarWin && !radarWin.isDestroyed()) radarWin.close();
  const { summary } = await d.stop();
  return summary;
}

function radarUrl() {
  const st = dash?.getStats();
  return `http://${viewHost(settings.host)}:${st?.port ?? settings.port}/`;
}

function lanIps() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
}

function cfgHost() {
  if (settings.host !== "0.0.0.0") return viewHost(settings.host);
  return lanIps()[0] ?? "127.0.0.1";
}

let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();
function perf() {
  const now = Date.now();
  const cpu = process.cpuUsage(lastCpu);
  const pct = ((cpu.user + cpu.system) / 1000) / Math.max(1, now - lastCpuAt) * 100;
  lastCpu = process.cpuUsage();
  lastCpuAt = now;
  const mem = process.memoryUsage();
  const appMetrics = app.getAppMetrics();
  const totalMb = appMetrics.reduce((s, m) => s + (m.memory?.workingSetSize ?? 0), 0) / 1024;
  return {
    mainCpu: pct,
    mainRssMb: mem.rss / 1048576,
    appMemMb: totalMb,
    processes: appMetrics.length,
  };
}

function state() {
  return {
    version: app.getVersion(),
    settings,
    running: !!dash,
    stats: dash?.getStats() ?? null,
    perf: perf(),
    lastError,
    lanIps: lanIps(),
    radarUrl: radarUrl(),
    gsiCfg: buildGsiConfig({ uriHost: cfgHost(), port: settings.port, token: settings.token }),
    logDir: settings.csvLog ? logDir() : null,
  };
}

// ------------------------------------------------------------------ janelas

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 760, minWidth: 820, minHeight: 600,
    title: "CS2 AssistLab", backgroundColor: "#0e1116", autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("closed", () => { win = null; });
}

function openRadarWindow() {
  if (!dash) throw new Error("Inicie o serviço antes de abrir o radar.");
  if (radarWin && !radarWin.isDestroyed()) { radarWin.focus(); return; }
  radarWin = new BrowserWindow({
    width: 1280, height: 800, title: "CS2 AssistLab — Radar", backgroundColor: "#0e1116", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  radarWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  radarWin.loadURL(radarUrl());
  radarWin.on("closed", () => { radarWin = null; });
}

// ------------------------------------------------------------------ IPC

function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return { ok: true, value: await fn(...args), state: state() }; }
    catch (e) { lastError = e.message; return { ok: false, error: e.message, state: state() }; }
  });
}

function registerIpc() {
  handle("state", () => null);
  handle("start", () => startService());
  handle("stop", () => stopService());
  handle("save", async (input) => {
    const { settings: next, errors } = validateSettings(input);
    if (errors.length) throw new Error(errors.join(" "));
    const wasRunning = !!dash;
    if (wasRunning) await stopService();
    settings = next;
    saveSettings(settingsFile(), settings);
    if (wasRunning) await startService();
    return "Configurações salvas.";
  });
  handle("new-token", () => newToken());
  handle("open-radar", () => openRadarWindow());
  handle("open-browser", async () => {
    if (!dash) throw new Error("Inicie o serviço antes de abrir o radar.");
    await shell.openExternal(radarUrl());
  });
  handle("copy-cfg", () => { clipboard.writeText(state().gsiCfg); return "Configuração copiada."; });
  handle("save-cfg", async () => {
    const steamCfg = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg";
    const defaultDir = fs.existsSync(steamCfg) ? steamCfg : app.getPath("documents");
    const r = await dialog.showSaveDialog(win, {
      title: "Salvar configuração GSI do CS2",
      defaultPath: path.join(defaultDir, "gamestate_integration_assistlab.cfg"),
      filters: [{ name: "Configuração do CS2", extensions: ["cfg"] }],
    });
    if (r.canceled || !r.filePath) return "Cancelado.";
    fs.writeFileSync(r.filePath, state().gsiCfg);
    return `Salvo em ${r.filePath}`;
  });
  handle("open-logs", async () => {
    fs.mkdirSync(logDir(), { recursive: true });
    const err = await shell.openPath(logDir());
    if (err) throw new Error(err);
  });
}

// ------------------------------------------------------------------ teste automático
// "CS2 AssistLab.exe --smoke-test": sobe o serviço numa porta livre, envia um
// payload GSI, abre o radar numa janela oculta e sai com código 0 (ok) ou 1.

async function runSmokeTest() {
  const out = process.env.ASSISTLAB_SMOKE_OUT;
  const report = (ok, msg) => {
    const line = `${ok ? "OK" : "FALHOU"}: ${msg}`;
    console.log(line);
    if (out) try { fs.writeFileSync(out, line + "\n"); } catch { /* ignora */ }
    app.exit(ok ? 0 : 1);
  };
  const timer = setTimeout(() => report(false, "tempo esgotado (30 s)"), 30000);
  try {
    const token = newToken();
    const d = createDashboard({ host: "127.0.0.1", port: 0, token, publicDir: publicDir(),
      logDir: path.join(os.tmpdir(), `assistlab-smoke-${Date.now()}`) });
    const st = await d.start();
    const base = `http://127.0.0.1:${st.port}`;
    const body = JSON.stringify({
      map: { name: "de_smoke", phase: "live", round: 1 }, round: { phase: "live" },
      allplayers: {
        "76561198000000001": { name: "Admin", team: "CT", state: { health: 100 }, match_stats: { kills: 0, deaths: 0 }, position: "0, 0, 0", forward: "1, 0, 0" },
        "2": { name: "Bot", team: "T", state: { health: 100 }, match_stats: { kills: 0, deaths: 0 }, position: "500, 0, 0", forward: "-1, 0, 0" },
      },
      auth: { token },
    });
    const r = await fetch(base + "/gsi", { method: "POST", body });
    if (r.status !== 200) throw new Error(`POST /gsi retornou ${r.status}`);
    const s = d.getStats();
    if (s.players !== 2 || s.bots !== 1) throw new Error(`stats inesperadas: ${JSON.stringify(s)}`);

    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
    await w.loadURL(base + "/");
    const title = await w.webContents.executeJavaScript("document.title");
    if (!title.includes("Radar")) throw new Error(`título inesperado: ${title}`);

    const ui = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true } });
    await ui.loadFile(path.join(__dirname, "renderer", "index.html"));
    const hasApi = await ui.webContents.executeJavaScript("typeof window.assistlab === 'object'");
    if (!hasApi) throw new Error("preload não expôs a API do painel");

    await d.stop();
    clearTimeout(timer);
    report(true, `serviço, radar e painel de controle carregaram (Electron ${process.versions.electron})`);
  } catch (e) {
    clearTimeout(timer);
    report(false, e.message);
  }
}

// ------------------------------------------------------------------ ciclo de vida

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(async () => {
    if (SMOKE) {
      // registra os canais com um estado mínimo para o preload funcionar
      settings = validateSettings({ token: newToken() }).settings;
      registerIpc();
      return runSmokeTest();
    }
    settings = loadSettings(settingsFile());
    registerIpc();
    createWindow();
    if (settings.autoStart) {
      try { await startService(); } catch { /* erro aparece no painel */ }
    }
    setInterval(() => { if (win) win.webContents.send("state", state()); }, 1000);
  });

  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", (e) => {
    if (quitting || !dash) return;
    e.preventDefault();
    quitting = true;
    stopService().finally(() => app.quit());
  });
}
