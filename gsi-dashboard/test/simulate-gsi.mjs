// Simula o CS2 enviando GSI (formato real do allplayers) para testar o painel sem o jogo.
//   node test/simulate-gsi.mjs [segundos] [porta]
const seconds = Number(process.argv[2] || 20);
const port = Number(process.argv[3] || process.env.PORT || 3010);
const token = process.env.GSI_TOKEN || "assistlab-dev";

const names = ["Admin", "Convidado1", "Convidado2", "Rex", "Kask", "Moe", "Vitor", "Ulysses", "Zach", "Gabe"];
const bots = names.map((name, i) => ({
  // 3 humanos (SteamID64) e 7 bots (IDs curtos, como o GSI mostra bots)
  id: i < 3 ? String(76561198000000000n + BigInt(i)) : String(i + 1),
  name, team: i < 5 ? "CT" : "T",
  x: (Math.random() - 0.5) * 3000, y: (Math.random() - 0.5) * 2500, z: 0,
  yaw: Math.random() * 360, speed: 120 + Math.random() * 120, hp: 100, k: 0, d: 0,
}));

function step(dt) {
  for (const b of bots) {
    if (b.hp <= 0) { if (Math.random() < 0.02) b.hp = 100; continue; }
    b.yaw += (Math.random() - 0.5) * 60 * dt * 4;
    b.x += Math.cos(b.yaw * Math.PI / 180) * b.speed * dt;
    b.y += Math.sin(b.yaw * Math.PI / 180) * b.speed * dt;
    if (Math.abs(b.x) > 1800) b.yaw = 180 - b.yaw;
    if (Math.abs(b.y) > 1400) b.yaw = -b.yaw;
    if (Math.random() < 0.01) { b.hp = Math.max(0, b.hp - 40); if (b.hp === 0) b.d++; }
  }
}

function payload() {
  const allplayers = {};
  for (const b of bots) {
    const r = b.yaw * Math.PI / 180;
    allplayers[b.id] = {
      name: b.name, observer_slot: 0, team: b.team,
      state: { health: b.hp, armor: 100, helmet: true },
      match_stats: { kills: b.k, assists: 0, deaths: b.d, mvps: 0, score: 0 },
      position: `${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}`,
      forward: `${Math.cos(r).toFixed(3)}, ${Math.sin(r).toFixed(3)}, 0.000`,
    };
  }
  return {
    provider: { name: "Counter-Strike: Global Offensive", appid: 730, version: 14000, timestamp: Math.floor(Date.now() / 1000) },
    map: { mode: "competitive", name: "de_dust2", phase: "live", round: 3 },
    round: { phase: "live" },
    allplayers,
    auth: { token },
  };
}

let sent = 0, failed = 0;
const t0 = Date.now();
const timer = setInterval(async () => {
  step(0.1);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/gsi`, { method: "POST", body: JSON.stringify(payload()) });
    if (r.ok) sent++; else { failed++; console.error("HTTP", r.status, await r.text()); }
  } catch (e) { failed++; if (failed === 1) console.error("Servidor não respondeu:", e.message); }
  if (Date.now() - t0 > seconds * 1000) { clearInterval(timer); console.log(`enviados ${sent}, falhas ${failed}`); process.exitCode = failed ? 1 : 0; }
}, 100);
