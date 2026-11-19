// Registro de estatísticas em CSV a partir dos payloads GSI.
//  - events.csv : mortes (vida chegou a 0), mudança de fase e de round
//  - rounds.csv : placar de cada jogador ao fim de cada round
//  - summary.csv: placar final ao encerrar o serviço
import fs from "node:fs";
import path from "node:path";
import { extractPlayers } from "./gsi.js";

function csv(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class StatsLogger {
  constructor({ dir, sessionId = new Date().toISOString().replace(/[:.]/g, "-"), knownHumans } = {}) {
    if (!dir) throw new Error("StatsLogger: diretório não informado");
    this.dir = dir;
    this.sessionId = sessionId;
    this.knownHumans = knownHumans;
    this.prevHealth = new Map();
    this.lastPhase = null;
    this.lastRound = null;
    this.lastPlayers = [];
    this.map = "";
    this.counts = { events: 0, rounds: 0 };
    fs.mkdirSync(dir, { recursive: true });
    this.eventsPath = path.join(dir, `session-${sessionId}-events.csv`);
    this.roundsPath = path.join(dir, `session-${sessionId}-rounds.csv`);
    this.summaryPath = path.join(dir, `session-${sessionId}-summary.csv`);
    fs.writeFileSync(this.eventsPath, "utc,map,round,event,steamid,name,team,is_bot,detail\n");
    fs.writeFileSync(this.roundsPath, "utc,map,round,steamid,name,team,is_bot,kills,assists,deaths,health\n");
  }

  _event(ev, p = {}, detail = "") {
    const row = [new Date().toISOString(), this.map, this.lastRound ?? "", ev,
      p.steamId ?? "", p.name ?? "", p.team ?? "", p.bot ? 1 : 0, detail].map(csv).join(",");
    fs.appendFileSync(this.eventsPath, row + "\n");
    this.counts.events++;
  }

  ingest(payload) {
    this.map = payload?.map?.name ?? this.map;
    const round = payload?.map?.round ?? null;
    const phase = payload?.round?.phase ?? payload?.map?.phase ?? null;
    const players = extractPlayers(payload, this.knownHumans);
    if (players.length) this.lastPlayers = players;

    for (const p of players) {
      const prev = this.prevHealth.get(p.steamId);
      if (prev > 0 && p.health === 0) this._event("death", p);
      this.prevHealth.set(p.steamId, p.health);
    }

    if (round !== null && round !== this.lastRound) {
      this.lastRound = round;
      this._event("round", {}, `round ${round}`);
    }
    if (phase && phase !== this.lastPhase) {
      if (phase === "over") this._writeRound(players.length ? players : this.lastPlayers);
      this.lastPhase = phase;
      this._event("phase", {}, phase);
    }
  }

  _writeRound(players) {
    const utc = new Date().toISOString();
    const rows = players.map((p) => [utc, this.map, this.lastRound ?? "", p.steamId, p.name, p.team,
      p.bot ? 1 : 0, p.kills, p.assists, p.deaths, p.health].map(csv).join(","));
    if (rows.length) fs.appendFileSync(this.roundsPath, rows.join("\n") + "\n");
    this.counts.rounds++;
  }

  writeSummary() {
    const lines = ["steamid,name,team,is_bot,kills,assists,deaths,kd"];
    for (const p of this.lastPlayers) {
      const kd = p.deaths ? (p.kills / p.deaths).toFixed(2) : String(p.kills);
      lines.push([p.steamId, p.name, p.team, p.bot ? 1 : 0, p.kills, p.assists, p.deaths, kd].map(csv).join(","));
    }
    fs.writeFileSync(this.summaryPath, lines.join("\n") + "\n");
    return this.summaryPath;
  }
}
