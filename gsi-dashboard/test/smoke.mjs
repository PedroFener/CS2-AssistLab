// Teste de fumaça de ponta a ponta: sobe o server.mjs real como processo,
// envia payloads simulados durante alguns segundos e confere /stats e os CSV.
//   node test/smoke.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3900 + Math.floor(Math.random() * 90);
const token = "smoke_token_123";
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistlab-smoke-"));
const env = { ...process.env, PORT: String(port), GSI_TOKEN: token, LOG_DIR: logDir };

function fail(msg) { console.error("FALHOU:", msg); srv.kill(); process.exit(1); }

const srv = spawn(process.execPath, ["server.mjs"], { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("servidor não subiu em 10 s")), 10000);
  srv.stdout.on("data", (d) => { process.stdout.write(d); if (String(d).includes("AssistLab GSI em")) { clearTimeout(t); resolve(); } });
  srv.on("exit", (c) => reject(new Error(`servidor saiu com código ${c}`)));
}).catch((e) => fail(e.message));

const sim = spawn(process.execPath, ["test/simulate-gsi.mjs", "4", String(port)], { cwd: root, env, stdio: "inherit" });
const simCode = await new Promise((r) => sim.on("exit", r));
if (simCode !== 0) fail(`simulador saiu com código ${simCode}`);

const stats = await (await fetch(`http://127.0.0.1:${port}/stats`)).json();
console.log("stats:", JSON.stringify(stats));
if (stats.received < 20) fail(`poucos payloads recebidos (${stats.received})`);
if (stats.rejected !== 0) fail(`payloads rejeitados: ${stats.rejected}`);
if (stats.players !== 10) fail(`esperava 10 jogadores, veio ${stats.players}`);
if (stats.bots !== 7) fail(`esperava 7 bots, veio ${stats.bots}`);
if (!fs.existsSync(stats.logs.events)) fail("events.csv não foi criado");

const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
if (!html.includes("Radar GSI")) fail("index.html não foi servido");
const esp = await (await fetch(`http://127.0.0.1:${port}/esp`)).text();
if (!esp.includes("Visão ESP")) fail("esp.html não foi servido");
const lib = await fetch(`http://127.0.0.1:${port}/lib/esp.js`);
if (lib.status !== 200 || !(await lib.text()).includes("buildEspFrame")) fail("/lib/esp.js não foi servido");

srv.kill("SIGTERM");
await new Promise((r) => srv.on("exit", r));
const summary = fs.readdirSync(logDir).find((f) => f.endsWith("-summary.csv"));
if (process.platform !== "win32" && !summary) fail("summary.csv não foi gravado ao encerrar");
console.log("OK: painel recebeu", stats.received, "payloads; logs em", logDir);
