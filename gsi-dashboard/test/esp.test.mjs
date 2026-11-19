import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spreadLabels, makeCamera, project, toCamera, boundingBox, offscreenIndicator, bearingDeg,
  buildEspFrame, DEFAULT_FEATURES, PLAYER_HEIGHT, EYE_HEIGHT,
} from "../src/esp.js";
import { createSimulation } from "../src/simulator.js";
import { extractPlayers } from "../src/gsi.js";

const W = 1280, H = 720;
const cam0 = () => makeCamera({ position: [0, 0, 0], forward: [1, 0, 0], fovDeg: 74, width: W, height: H });
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

const P = (id, team, pos, extra = {}) => ({ steamId: id, name: id, team, bot: false, health: 100, pos, forward: [1, 0, 0], ...extra });

test("câmera: eixos no padrão Source (X frente, Y esquerda, Z cima)", () => {
  const c = cam0();
  assert.deepEqual(c.eye, [0, 0, EYE_HEIGHT]);
  const [x, y, z] = toCamera(c, [100, -50, EYE_HEIGHT + 20]); // à direita (−Y) e acima
  near(z, 100); near(x, 50); near(y, 20);
});

test("câmera: entradas inválidas retornam null", () => {
  assert.equal(makeCamera({ position: [0, 0, 0], forward: [0, 0, 0], width: W, height: H }), null);
  assert.equal(makeCamera({ position: null, forward: [1, 0, 0], width: W, height: H }), null);
  assert.equal(makeCamera({ position: [0, 0, 0], forward: [1, 0, 0], width: 0, height: H }), null);
});

test("câmera olhando para cima não degenera", () => {
  const c = makeCamera({ position: [0, 0, 0], forward: [0, 0, 1], width: W, height: H });
  assert.ok(c && c.r.every(Number.isFinite));
});

test("projeção: ponto à frente na altura dos olhos cai no centro; atrás é null", () => {
  const c = cam0();
  const p = project(c, [500, 0, EYE_HEIGHT]);
  near(p.x, W / 2); near(p.y, H / 2);
  assert.equal(project(c, [-500, 0, EYE_HEIGHT]), null);
  // à direita no mundo (−Y) → à direita na tela
  assert.ok(project(c, [500, -100, EYE_HEIGHT]).x > W / 2);
  // acima no mundo → acima na tela (y menor)
  assert.ok(project(c, [500, 0, EYE_HEIGHT + 100]).y < H / 2);
});

test("caixa: altura proporcional ao inverso da distância e base nos pés", () => {
  const c = cam0();
  const a = boundingBox(c, [300, 0, 0]), b = boundingBox(c, [600, 0, 0]);
  near(a.h / b.h, 2, 1e-9);
  near(a.w, a.h * 0.45, 1e-9);
  near(a.x + a.w / 2, W / 2, 1e-9);
  // os pés ficam abaixo do centro (câmera na altura dos olhos)
  assert.ok(a.y + a.h > H / 2);
  // o topo da caixa (72) fica acima do centro (olhos a 64)
  assert.ok(a.y < H / 2 && PLAYER_HEIGHT > EYE_HEIGHT);
  assert.equal(boundingBox(c, [-300, 0, 0]), null);
});

test("indicador fora da tela aponta para o lado certo", () => {
  const c = cam0();
  const right = offscreenIndicator(c, [0, -500, EYE_HEIGHT]); // 90° à direita
  assert.ok(right.x > W / 2 && Math.abs(right.y - H / 2) < 1);
  const left = offscreenIndicator(c, [0, 500, EYE_HEIGHT]);
  assert.ok(left.x < W / 2);
  const behind = offscreenIndicator(c, [-500, 0, EYE_HEIGHT]);
  assert.equal(behind.behind, true);
  assert.ok(behind.y > H / 2, "exatamente atrás aponta para baixo");
  for (const i of [right, left, behind]) assert.ok(i.x >= 0 && i.x <= W && i.y >= 0 && i.y <= H);
});

test("bearing: positivo à direita", () => {
  const c = cam0();
  near(bearingDeg(c, [100, -100, EYE_HEIGHT]), 45, 1e-9);
  near(bearingDeg(c, [100, 100, EYE_HEIGHT]), -45, 1e-9);
});

test("frame: aliados/adversários, filtros, mortos, fora da tela e ordem de desenho", () => {
  const players = [
    P("pov", "CT", [0, 0, 0]),
    P("ally", "CT", [400, 50, 0]),
    P("adv", "T", [800, -60, 0]),
    P("bot", "T", [600, 0, 0], { bot: true }),
    P("atras", "T", [-400, 0, 0]),
    P("morto", "T", [500, 0, 0], { health: 0 }),
    P("semPos", "T", null),
  ];
  const f = buildEspFrame({ players, povId: "pov", width: W, height: H });
  assert.equal(f.pov.steamId, "pov");
  assert.deepEqual(f.items.map((i) => i.player.steamId), ["adv", "bot", "ally"]); // longe → perto
  assert.equal(f.items.find((i) => i.player.steamId === "ally").relation, "ally");
  assert.equal(f.items.find((i) => i.player.steamId === "adv").relation, "adversary");
  assert.deepEqual(f.offscreen.map((o) => o.player.steamId), ["atras"]);
  near(f.items.find((i) => i.player.steamId === "ally").distM, Math.hypot(400, 50) * 0.0254, 1e-9);

  const noBots = buildEspFrame({ players, povId: "pov", width: W, height: H, features: { ...DEFAULT_FEATURES, bots: false } });
  assert.equal(noBots.items.some((i) => i.player.bot), false);
  assert.equal(noBots.hidden, 1);

  const noAllies = buildEspFrame({ players, povId: "pov", width: W, height: H, features: { ...DEFAULT_FEATURES, allies: false } });
  assert.equal(noAllies.items.some((i) => i.relation === "ally"), false);

  const close = buildEspFrame({ players, povId: "pov", width: W, height: H, maxDistanceM: 12 });
  assert.deepEqual(close.items.map((i) => i.player.steamId).sort(), ["ally"]);
});

test("frame: POV inexistente não quebra", () => {
  const f = buildEspFrame({ players: [P("a", "CT", [0, 0, 0])], povId: "x", width: W, height: H });
  assert.equal(f.cam, null);
  assert.deepEqual(f.items, []);
});

test("simulação: determinística, formato GSI válido e jogadores na tela", () => {
  const a = createSimulation({ seed: 42 }), b = createSimulation({ seed: 42 });
  for (let i = 0; i < 50; i++) { a.step(0.1); b.step(0.1); }
  assert.deepEqual(a.payload(), b.payload());
  const players = extractPlayers(a.payload());
  assert.equal(players.length, 10);
  assert.equal(players.filter((p) => p.bot).length, 7);
  for (const p of players) { assert.ok(p.pos && p.forward); near(Math.hypot(...p.forward), 1, 2e-3); }

  // Em 30 s de partida simulada, algum POV vê alguém na tela.
  let seen = 0;
  for (let i = 0; i < 300; i++) {
    a.step(0.1);
    const ps = extractPlayers(a.payload());
    for (const pov of ps.filter((p) => p.health > 0)) seen += buildEspFrame({ players: ps, povId: pov.steamId, width: W, height: H }).items.length;
  }
  assert.ok(seen > 0);
});

test("rótulos fora da tela não se sobrepõem", () => {
  const c = cam0();
  const ps = [P("pov", "CT", [0, 0, 0])];
  for (let i = 0; i < 6; i++) ps.push(P("r" + i, "T", [10 + i, -500 - i, 0])); // todos à direita, quase no mesmo ângulo
  const f = buildEspFrame({ players: ps, povId: "pov", width: W, height: H });
  assert.equal(f.offscreen.length, 6);
  const ys = f.offscreen.map((o) => o.labelY).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 16 - 1e-9);
  assert.ok(ys.at(-1) <= H - 8 + 1e-9);
  assert.deepEqual(spreadLabels([], c), []);
});
