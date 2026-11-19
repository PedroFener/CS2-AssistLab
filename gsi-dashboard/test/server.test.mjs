import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDashboard, validateOptions } from "../src/server.js";
import { parseVec, isBot, extractPlayers, buildGsiConfig, distanceMeters } from "../src/gsi.js";

const TOKEN = "teste_token_123";

function payload(round, phase, players) {
  const allplayers = {};
  for (const p of players) {
    allplayers[p.id] = {
      name: p.name, team: p.team, state: { health: p.hp },
      match_stats: { kills: p.k ?? 0, assists: 0, deaths: p.d ?? 0 },
      position: p.pos ?? "0, 0, 0", forward: "1, 0, 0",
    };
  }
  return { map: { name: "de_test", round, phase: "live" }, round: { phase }, allplayers, auth: { token: TOKEN } };
}

test("parseVec e distância", () => {
  assert.deepEqual(parseVec("1.5, -2, 3"), [1.5, -2, 3]);
  assert.equal(parseVec("1,2"), null);
  assert.equal(parseVec(null), null);
  assert.ok(Math.abs(distanceMeters([0, 0, 0], [100, 0, 0]) - 2.54) < 1e-9);
});

test("heurística de bot", () => {
  assert.equal(isBot("76561198000000001", "Pedro"), false);
  assert.equal(isBot("12", "Rex"), true);
  assert.equal(isBot("76561198000000001", "BOT Rex"), true);
  assert.equal(isBot("12", "Rex", new Set(["12"])), false);
});

test("extractPlayers ignora entradas inválidas", () => {
  const p = payload(1, "live", [{ id: "76561198000000001", name: "A", team: "CT", hp: 100 }]);
  p.allplayers.lixo = null;
  const list = extractPlayers(p);
  assert.equal(list.length, 1);
  assert.equal(list[0].team, "CT");
});

test("cfg GSI contém URI e token", () => {
  const cfg = buildGsiConfig({ uriHost: "192.168.0.10", port: 3010, token: "abc12345" });
  assert.match(cfg, /"uri"\s+"http:\/\/192\.168\.0\.10:3010\/gsi"/);
  assert.match(cfg, /"token" "abc12345"/);
  assert.match(cfg, /"allplayers_position"\s+"1"/);
});

test("validação de opções", () => {
  assert.deepEqual(validateOptions({ host: "127.0.0.1", port: 3010, token: "abcdefgh" }), []);
  assert.equal(validateOptions({ host: "999.1.1.1", port: 3010, token: "abcdefgh" }).length, 1);
  assert.equal(validateOptions({ host: "127.0.0.1", port: 80, token: "abcdefgh" }).length, 1);
  assert.equal(validateOptions({ host: "127.0.0.1", port: 3010, token: "curto" }).length, 1);
});

test("servidor: rejeições, aceitação, SSE, stats e CSV", async () => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistlab-"));
  const dash = createDashboard({ host: "127.0.0.1", port: 0, token: TOKEN, logDir });
  const st = await dash.start();
  const base = `http://127.0.0.1:${st.port}`;
  try {
    const html = await fetch(base + "/");
    assert.equal(html.status, 200);
    assert.match(await html.text(), /AssistLab/);

    assert.equal((await fetch(base + "/gsi", { method: "POST", body: "x{" })).status, 400);
    assert.equal((await fetch(base + "/gsi", { method: "POST", body: JSON.stringify({ auth: { token: "errado" } }) })).status, 401);

    // SSE: abre o stream e espera o primeiro evento "state"
    const ctrl = new AbortController();
    const sse = await fetch(base + "/events", { signal: ctrl.signal });
    const reader = sse.body.getReader();
    const gotState = (async () => {
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return null;
        buf += new TextDecoder().decode(value);
        const m = buf.match(/data: (\{.*"type":"state".*\})\n\n/);
        if (m) return JSON.parse(m[1]);
      }
    })();

    const humans = "76561198000000001";
    const send = (r, ph, hp, k) => fetch(base + "/gsi", { method: "POST", body: JSON.stringify(payload(r, ph, [
      { id: humans, name: "Pedro", team: "CT", hp: 100, k },
      { id: "3", name: "Rex", team: "T", hp, d: hp === 0 ? 1 : 0, pos: "100, 0, 0" },
    ])) });

    assert.equal((await send(1, "live", 100, 0)).status, 200);
    const ev = await gotState;
    assert.equal(ev.payload.map.name, "de_test");
    assert.equal(ev.payload.auth, undefined, "token não pode ir para o navegador");
    ctrl.abort();

    await send(1, "live", 0, 1);   // morte do bot
    await send(1, "over", 0, 1);   // fim de round → rounds.csv
    await send(2, "live", 100, 1);

    const s = dash.getStats();
    assert.equal(s.received, 4);
    assert.equal(s.rejected, 2);
    assert.equal(s.players, 2);
    assert.equal(s.bots, 1);
    assert.equal(s.map, "de_test");

    const events = fs.readFileSync(s.logs.events, "utf8");
    assert.match(events, /death,3,Rex,T,1/);
    assert.match(events, /phase,,,,0,over/);
    const rounds = fs.readFileSync(s.logs.rounds, "utf8").trim().split("\n");
    assert.equal(rounds.length, 3); // cabeçalho + 2 jogadores
  } finally {
    const { summary } = await dash.stop();
    assert.ok(summary && fs.readFileSync(summary, "utf8").includes("Pedro"));
  }
  assert.equal(dash.getStats().running, false);
});

test("porta em uso gera erro claro", async () => {
  const a = createDashboard({ port: 0, token: TOKEN });
  const s = await a.start();
  const b = createDashboard({ port: s.port, token: TOKEN });
  await assert.rejects(b.start(), /já está em uso/);
  await a.stop();
});

test("rotas da Visão ESP e dos módulos do navegador", async () => {
  const dash = createDashboard({ port: 0, token: TOKEN });
  const { port } = await dash.start();
  const base = `http://127.0.0.1:${port}`;
  try {
    const esp = await fetch(base + "/esp");
    assert.equal(esp.status, 200);
    assert.match(await esp.text(), /Visão ESP/);
    const lib = await fetch(base + "/lib/esp.js");
    assert.equal(lib.status, 200);
    assert.match(lib.headers.get("content-type"), /javascript/);
    assert.match(await lib.text(), /export function buildEspFrame/);
    assert.equal((await fetch(base + "/lib/gsi.js")).status, 200);
    // só arquivos da lista branca
    assert.equal((await fetch(base + "/lib/server.js")).status, 404);
    assert.equal((await fetch(base + "/lib/..%2Fpackage.json")).status, 404);
  } finally { await dash.stop(); }
});

test("modo demonstração: gera dados, não grava CSV e sai ao chegar dado real", async () => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "assistlab-demo-"));
  const dash = createDashboard({ port: 0, token: TOKEN, logDir, demo: true });
  const { port } = await dash.start();
  try {
    await new Promise((r) => setTimeout(r, 650));
    let s = dash.getStats();
    assert.equal(s.demo, true);
    assert.ok(s.demoFrames >= 4, `quadros: ${s.demoFrames}`);
    assert.equal(s.players, 10);
    assert.equal(s.received, 0, "demo não conta como recebido do CS2");
    const ev = fs.readFileSync(s.logs.events, "utf8").trim().split("\n");
    assert.equal(ev.length, 1, "demo não pode ir para o CSV");

    // dado real desliga a demonstração
    const r = await fetch(`http://127.0.0.1:${port}/gsi`, { method: "POST",
      body: JSON.stringify(payload(1, "live", [{ id: "76561198000000001", name: "Real", team: "CT", hp: 100 }])) });
    assert.equal(r.status, 200);
    s = dash.getStats();
    assert.equal(s.demo, false);
    assert.equal(s.players, 1);

    assert.equal(dash.setDemo(true), true);
    assert.equal(dash.setDemo(false), false);
    assert.equal(dash.getStats().players, 0, "ao desligar, limpa o quadro simulado");
  } finally { await dash.stop(); }
});
