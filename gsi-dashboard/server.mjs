// Linha de comando do painel GSI.
//   node server.mjs
//   HOST=0.0.0.0 PORT=4000 GSI_TOKEN=meu_token LOG_DIR=./logs RAW_LOG=1 node server.mjs
//   DEMO=1 node server.mjs          (partida simulada, sem o CS2)
import { createDashboard, validateOptions } from "./src/server.js";

const opts = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3010),
  token: process.env.GSI_TOKEN || "assistlab-dev",
  logDir: process.env.LOG_DIR || null,
  rawLog: process.env.RAW_LOG === "1",
  demo: process.env.DEMO === "1",
};

const errors = validateOptions(opts);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const dash = createDashboard(opts);
try {
  const s = await dash.start();
  console.log(`AssistLab GSI em http://${opts.host === "0.0.0.0" ? "127.0.0.1" : opts.host}:${s.port}`);
  if (opts.token === "assistlab-dev") console.log("Aviso: usando o token padrão. Defina GSI_TOKEN para algo só seu.");
  if (s.logs) console.log("Logs CSV em", s.logs.dir);
  if (s.demo) console.log("Modo demonstração ligado: abra /esp ou / no navegador.");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    const { summary } = await dash.stop();
    if (summary) console.log("Resumo gravado em", summary);
    process.exit(0);
  });
}
