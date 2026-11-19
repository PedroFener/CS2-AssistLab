// Simula o CS2 enviando GSI (formato real do allplayers) para testar o painel sem o jogo.
//   node test/simulate-gsi.mjs [segundos] [porta]
import { createSimulation } from "../src/simulator.js";

const seconds = Number(process.argv[2] || 20);
const port = Number(process.argv[3] || process.env.PORT || 3010);
const token = process.env.GSI_TOKEN || "assistlab-dev";
const sim = createSimulation({ players: 10, humans: 3 });

let sent = 0, failed = 0;
const t0 = Date.now();
const timer = setInterval(async () => {
  sim.step(0.1);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/gsi`, { method: "POST", body: JSON.stringify(sim.payload(token)) });
    if (r.ok) sent++; else { failed++; console.error("HTTP", r.status, await r.text()); }
  } catch (e) { failed++; if (failed === 1) console.error("Servidor não respondeu:", e.message); }
  if (Date.now() - t0 > seconds * 1000) {
    clearInterval(timer);
    console.log(`enviados ${sent}, falhas ${failed}`);
    process.exitCode = failed ? 1 : 0;
  }
}, 100);
