"use strict";
const api = window.assistlab;
const $ = (id) => document.getElementById(id);
let formDirty = false;
let current = null;

function fmtAge(ms) {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `ativo há ${h ? h + " h " : ""}${m} min ${s % 60} s`;
}
function setMsg(el, text, cls = "mut") { el.textContent = text ?? ""; el.className = (el.id === "msg" ? "msg " : "") + cls; }

function fillForm(s) {
  const preset = s.host === "127.0.0.1" || s.host === "0.0.0.0" ? s.host : "custom";
  $("hostPreset").value = preset;
  $("hostCustom").hidden = preset !== "custom";
  $("hostCustom").value = preset === "custom" ? s.host : "";
  $("port").value = s.port;
  $("token").value = s.token;
  $("autoStart").checked = s.autoStart;
  $("csvLog").checked = s.csvLog;
  $("rawLog").checked = s.rawLog;
}

function render(st) {
  current = st;
  $("version").textContent = `v${st.version}`;
  const s = st.stats;
  $("pill").textContent = st.running ? "em execução" : "parado";
  $("pill").className = "pill " + (st.running ? "on" : "off");
  $("btnStart").disabled = st.running;
  for (const id of ["btnStop", "btnRadar", "btnBrowser", "btnEsp", "btnEspBrowser", "btnDemo"]) $(id).disabled = !st.running;
  $("btnDemo").textContent = s?.demo ? "Desligar demonstração" : "Ligar demonstração";
  $("uptime").textContent = s ? fmtUptime(s.uptimeMs) : "";
  $("url").textContent = st.running ? `Radar: ${st.radarUrl}   ·   ESP: ${st.espUrl}   ·   GSI: ${st.radarUrl}gsi` : "";

  // Estado da conexão: o cfg manda "heartbeat" a cada 10 s, então >15 s sem dados = desconectado.
  const conn = $("conn");
  if (!st.running) { conn.textContent = "serviço parado"; conn.className = "big mut"; }
  else if (s.demo) { conn.textContent = "modo demonstração (dados simulados)"; conn.className = "big warn"; }
  else if (!s.lastAt) { conn.textContent = "aguardando o CS2…"; conn.className = "big warn"; }
  else if (s.ageMs > 15000) { conn.textContent = `sem dados há ${fmtAge(s.ageMs)}`; conn.className = "big bad"; }
  else { conn.textContent = "recebendo dados"; conn.className = "big ok"; }

  $("map").textContent = s?.map ? `${s.map} / ${s.phase ?? "—"}` : "—";
  $("players").textContent = s ? (s.players ? `${s.players} (${s.bots} bots, ${s.players - s.bots} humanos)` : "nenhum (entre como espectador ou GOTV)") : "—";
  $("counts").textContent = s ? `${s.received} / ${s.rejected}` : "—";
  $("lastError").textContent = st.lastError || s?.lastError || "—";
  $("hz").textContent = s ? `${s.hz.toFixed(1)} por segundo` : "—";
  $("age").textContent = s ? fmtAge(s.ageMs) : "—";
  $("clients").textContent = s ? String(s.clients) : "—";
  $("cpu").textContent = `${st.perf.mainCpu.toFixed(1)} %`;
  $("mem").textContent = `${st.perf.appMemMb.toFixed(0)} MB (${st.perf.processes} processos)`;

  $("cfg").textContent = st.gsiCfg;
  $("lanHint").textContent = st.settings.host === "0.0.0.0"
    ? `IPs deste PC na rede: ${st.lanIps.join(", ") || "nenhum"}. Libere a porta ${st.settings.port} no Firewall do Windows.`
    : "Com 127.0.0.1, o CS2 precisa rodar neste mesmo computador.";
  if (!formDirty) fillForm(st.settings);
}

async function run(fn, okText) {
  const r = await fn();
  if (r.state) render(r.state);
  if (r.ok) setMsg($("msg"), typeof r.value === "string" ? r.value : okText, "msg ok");
  else setMsg($("msg"), r.error, "msg bad");
  return r;
}

$("btnStart").onclick = () => run(api.start, "Serviço iniciado.");
$("btnStop").onclick = () => run(api.stop, "Serviço encerrado.");
$("btnRadar").onclick = () => run(api.openRadar, "");
$("btnBrowser").onclick = () => run(api.openBrowser, "Radar aberto no navegador.");
$("btnLogs").onclick = () => run(api.openLogs, "");
$("btnEsp").onclick = () => run(api.openEsp, "");
$("btnEspBrowser").onclick = () => run(api.openEspBrowser, "Visão ESP aberta no navegador.");
$("btnDemo").onclick = () => run(() => api.setDemo(!current?.stats?.demo), "");
$("btnCopyCfg").onclick = () => run(api.copyCfg, "");
$("btnSaveCfg").onclick = () => run(api.saveCfg, "");

$("hostPreset").onchange = () => { $("hostCustom").hidden = $("hostPreset").value !== "custom"; formDirty = true; };
$("form").oninput = () => { formDirty = true; };
$("btnShowToken").onclick = () => {
  const t = $("token"); t.type = t.type === "password" ? "text" : "password";
  $("btnShowToken").textContent = t.type === "password" ? "Mostrar" : "Ocultar";
};
$("btnNewToken").onclick = async () => {
  const r = await api.newToken();
  if (r.ok) { $("token").value = r.value; formDirty = true; setMsg($("formMsg"), "Novo token gerado — salve e atualize o cfg do CS2.", "warn"); }
};
$("form").onsubmit = async (e) => {
  e.preventDefault();
  const preset = $("hostPreset").value;
  const r = await api.save({
    host: preset === "custom" ? $("hostCustom").value : preset,
    port: $("port").value,
    token: $("token").value,
    autoStart: $("autoStart").checked,
    csvLog: $("csvLog").checked,
    rawLog: $("rawLog").checked,
  });
  if (r.ok) { formDirty = false; setMsg($("formMsg"), "Salvo. Lembre de atualizar o arquivo .cfg no CS2.", "ok"); }
  else setMsg($("formMsg"), r.error, "bad");
  if (r.state) render(r.state);
};

api.onState(render);
api.getState().then((r) => r.state && render(r.state));
