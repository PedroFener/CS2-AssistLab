// Configurações do aplicativo (sem dependência do Electron, para poder testar).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateOptions } from "../dashboard/src/server.js";

export function newToken() {
  return crypto.randomBytes(16).toString("hex");
}

export function defaults() {
  return {
    host: "127.0.0.1",
    port: 3010,
    token: newToken(),
    autoStart: true,
    csvLog: true,
    rawLog: false,
  };
}

/** Normaliza tipos e devolve { settings, errors }. */
export function validateSettings(input) {
  const base = defaults();
  const s = {
    host: String(input?.host ?? base.host).trim(),
    port: Number.parseInt(input?.port ?? base.port, 10),
    token: String(input?.token ?? "").trim(),
    autoStart: input?.autoStart !== undefined ? !!input.autoStart : base.autoStart,
    csvLog: input?.csvLog !== undefined ? !!input.csvLog : base.csvLog,
    rawLog: !!input?.rawLog,
  };
  return { settings: s, errors: validateOptions(s) };
}

/** Lê do disco; arquivo ausente ou corrompido volta para os padrões (e é regravado). */
export function loadSettings(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const { settings, errors } = validateSettings(raw);
    if (!errors.length) return settings;
  } catch { /* primeiro uso ou arquivo inválido */ }
  const s = defaults();
  saveSettings(file, s);
  return s;
}

export function saveSettings(file, s) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, file); // escrita atômica
}

/** Host para abrir no navegador / escrever no cfg. */
export function viewHost(host) {
  return host === "0.0.0.0" || host === "localhost" ? "127.0.0.1" : host;
}
