// Simulação de partida no formato real do GSI (allplayers), para demonstração
// e testes sem o CS2. Determinística quando recebe uma semente.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}

const NAMES = ["Admin", "Convidado1", "Convidado2", "Rex", "Kask", "Moe", "Vitor", "Ulysses", "Zach", "Gabe"];

export function createSimulation({ players = 10, humans = 3, seed = Date.now() } = {}) {
  const rand = rng(seed);
  let round = 1;
  let phase = "live";
  let phaseTimer = 0;
  const actors = Array.from({ length: players }, (_, i) => ({
    // humanos com SteamID64; bots com IDs curtos, como o GSI mostra bots
    id: i < humans ? String(76561198000000000n + BigInt(i)) : String(i + 1),
    name: NAMES[i] ?? `Jogador${i + 1}`,
    team: i < Math.ceil(players / 2) ? "CT" : "T",
    x: (rand() - 0.5) * 3000, y: (rand() - 0.5) * 2500, z: 0,
    yaw: rand() * 360, pitch: 0, speed: 120 + rand() * 120, hp: 100, k: 0, d: 0,
  }));

  function step(dt) {
    phaseTimer += dt;
    if (phase === "live" && phaseTimer > 45) { phase = "over"; phaseTimer = 0; }
    else if (phase === "over" && phaseTimer > 4) {
      phase = "live"; phaseTimer = 0; round++;
      for (const a of actors) a.hp = 100;
    }
    for (const a of actors) {
      if (a.hp <= 0) continue;
      a.yaw += (rand() - 0.5) * 240 * dt;
      a.pitch = Math.max(-20, Math.min(20, a.pitch + (rand() - 0.5) * 30 * dt));
      a.x += Math.cos(a.yaw * Math.PI / 180) * a.speed * dt;
      a.y += Math.sin(a.yaw * Math.PI / 180) * a.speed * dt;
      if (Math.abs(a.x) > 1800) { a.yaw = 180 - a.yaw; a.x = Math.sign(a.x) * 1800; }
      if (Math.abs(a.y) > 1400) { a.yaw = -a.yaw; a.y = Math.sign(a.y) * 1400; }
      if (phase === "live" && rand() < 0.08 * dt) {
        a.hp = Math.max(0, a.hp - 40);
        if (a.hp === 0) {
          a.d++;
          const killers = actors.filter((o) => o.team !== a.team && o.hp > 0);
          if (killers.length) killers[Math.floor(rand() * killers.length)].k++;
        }
      }
    }
  }

  function payload(token) {
    const allplayers = {};
    for (const a of actors) {
      const y = a.yaw * Math.PI / 180, p = a.pitch * Math.PI / 180;
      allplayers[a.id] = {
        name: a.name, observer_slot: 0, team: a.team,
        state: { health: a.hp, armor: 100, helmet: true },
        match_stats: { kills: a.k, assists: 0, deaths: a.d, mvps: 0, score: a.k * 2 },
        position: `${a.x.toFixed(2)}, ${a.y.toFixed(2)}, ${a.z.toFixed(2)}`,
        forward: `${(Math.cos(p) * Math.cos(y)).toFixed(3)}, ${(Math.cos(p) * Math.sin(y)).toFixed(3)}, ${(-Math.sin(p)).toFixed(3)}`,
      };
    }
    const out = {
      provider: { name: "Counter-Strike: Global Offensive", appid: 730, version: 14000, timestamp: Math.floor(Date.now() / 1000) },
      map: { mode: "competitive", name: "de_demo", phase: "live", round },
      round: { phase },
      allplayers,
    };
    if (token) out.auth = { token };
    return out;
  }

  return { step, payload, actors };
}
