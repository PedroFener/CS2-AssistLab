// Servidor do painel GSI, reutilizável pela linha de comando (server.mjs)
// e pelo aplicativo Windows (desktop/). Sem dependências externas.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StatsLogger } from "./statsLogger.js";
import { extractPlayers } from "./gsi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 2 * 1024 * 1024;

export function validateOptions({ host, port, token }) {
  const errors = [];
  if (!/^(localhost|0\.0\.0\.0|(\d{1,3}\.){3}\d{1,3})$/.test(String(host)) ||
      (String(host).includes(".") && String(host).split(".").some((o) => Number(o) > 255)))
    errors.push("Endereço inválido (use 127.0.0.1, 0.0.0.0, localhost ou um IPv4).");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) errors.push("Porta deve ser um inteiro entre 1024 e 65535.");
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(token))
    errors.push("Token deve ter de 8 a 128 caracteres (letras, números, _ ou -).");
  return errors;
}

/**
 * @param {object} o
 * @param {string} o.host  endereço de escuta (127.0.0.1 = só este PC; 0.0.0.0 = rede local)
 * @param {number} o.port  porta (0 = aleatória, útil em testes)
 * @param {string} o.token token que o cfg do CS2 envia em auth.token
 * @param {string|null} o.logDir pasta para CSV/JSONL (null = sem logs)
 * @param {boolean} o.rawLog grava cada payload em JSONL
 */
export function createDashboard({ host = "127.0.0.1", port = 3010, token, logDir = null, rawLog = false, publicDir } = {}) {
  if (!token) throw new Error("token é obrigatório");
  const indexPath = path.join(publicDir ?? path.join(__dirname, "..", "public"), "index.html");

  const sse = new Set();
  const arrivals = [];
  let latest = null;
  let server = null;
  let logger = null;
  let rawStream = null;
  let pingTimer = null;
  let startedAt = 0;
  const stats = { received: 0, rejected: 0, lastAt: 0, lastError: "" };

  function broadcast(obj) {
    const data = `data: ${JSON.stringify(obj)}\n\n`;
    for (const res of sse) {
      try { res.write(data); } catch { sse.delete(res); }
    }
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(Object.assign(new Error("payload grande demais"), { status: 413 })); req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }

  async function handleGsi(req, res) {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      stats.rejected++;
      stats.lastError = e.status ? e.message : "JSON inválido";
      res.writeHead(e.status || 400).end(stats.lastError);
      return;
    }
    if (payload?.auth?.token !== token) {
      stats.rejected++;
      stats.lastError = "token inválido";
      res.writeHead(401).end("token inválido");
      return;
    }
    delete payload.auth; // não reenviar o token ao navegador
    const now = Date.now();
    stats.received++;
    stats.lastAt = now;
    arrivals.push(now);
    while (arrivals.length && now - arrivals[0] > 2000) arrivals.shift();
    latest = payload;
    broadcast({ type: "state", at: now, payload });
    try {
      logger?.ingest(payload);
      rawStream?.write(JSON.stringify({ at: now, payload }) + "\n");
    } catch (e) {
      stats.lastError = `log: ${e.message}`;
    }
    res.writeHead(200).end("ok");
  }

  function handler(req, res) {
    const url = new URL(req.url, "http://localhost");
    try {
      if (req.method === "POST" && (url.pathname === "/gsi" || url.pathname === "/")) return void handleGsi(req, res);
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(fs.readFileSync(indexPath));
        return;
      }
      if (req.method === "GET" && url.pathname === "/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        res.write(": conectado\n\n");
        if (latest) res.write(`data: ${JSON.stringify({ type: "state", at: stats.lastAt, payload: latest })}\n\n`);
        sse.add(res);
        req.on("close", () => sse.delete(res));
        return;
      }
      if (req.method === "GET" && url.pathname === "/stats") {
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(getStats()));
        return;
      }
      res.writeHead(404).end("não encontrado");
    } catch (e) {
      stats.lastError = e.message;
      if (!res.headersSent) res.writeHead(500).end("erro interno");
    }
  }

  function getStats() {
    const now = Date.now();
    while (arrivals.length && now - arrivals[0] > 2000) arrivals.shift();
    const players = latest ? extractPlayers(latest) : [];
    return {
      running: !!server?.listening,
      host, port: server?.address()?.port ?? port,
      uptimeMs: startedAt ? now - startedAt : 0,
      received: stats.received, rejected: stats.rejected,
      lastAt: stats.lastAt, ageMs: stats.lastAt ? now - stats.lastAt : null,
      hz: arrivals.length / 2,
      clients: sse.size,
      map: latest?.map?.name ?? null,
      phase: latest?.round?.phase ?? latest?.map?.phase ?? null,
      players: players.length,
      bots: players.filter((p) => p.bot).length,
      lastError: stats.lastError,
      logs: logger ? { events: logger.eventsPath, rounds: logger.roundsPath, dir: logger.dir } : null,
    };
  }

  function start() {
    return new Promise((resolve, reject) => {
      if (server) return resolve(getStats());
      if (logDir) {
        try {
          logger = new StatsLogger({ dir: logDir });
          if (rawLog) rawStream = fs.createWriteStream(path.join(logDir, `session-${logger.sessionId}-raw.jsonl`), { flags: "a" });
        } catch (e) {
          logger = null;
          stats.lastError = `não foi possível criar logs: ${e.message}`;
        }
      }
      const s = http.createServer(handler);
      s.once("error", (e) => {
        server = null;
        reject(new Error(e.code === "EADDRINUSE" ? `Porta ${port} já está em uso.` :
          e.code === "EADDRNOTAVAIL" ? `Endereço ${host} não existe neste computador.` : e.message));
      });
      s.listen(port, host, () => {
        server = s;
        startedAt = Date.now();
        pingTimer = setInterval(() => broadcast({ type: "ping", at: Date.now() }), 5000);
        pingTimer.unref?.();
        resolve(getStats());
      });
    });
  }

  function stop() {
    return new Promise((resolve) => {
      clearInterval(pingTimer);
      for (const res of sse) { try { res.end(); } catch { /* já fechado */ } }
      sse.clear();
      let summary = null;
      try { summary = logger?.writeSummary() ?? null; } catch (e) { stats.lastError = e.message; }
      rawStream?.end();
      rawStream = null;
      logger = null;
      if (!server) return resolve({ summary });
      const s = server;
      server = null;
      startedAt = 0;
      s.close(() => resolve({ summary }));
      s.closeAllConnections?.();
    });
  }

  return { start, stop, getStats };
}
