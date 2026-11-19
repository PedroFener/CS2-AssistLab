import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defaults, validateSettings, loadSettings, saveSettings, viewHost, newToken } from "../src/settings.js";

test("padrões são válidos e o token é aleatório", () => {
  const d = defaults();
  assert.deepEqual(validateSettings(d).errors, []);
  assert.notEqual(newToken(), newToken());
  assert.match(d.token, /^[0-9a-f]{32}$/);
});

test("validação converte tipos e aponta erros", () => {
  const { settings, errors } = validateSettings({ host: " 0.0.0.0 ", port: "4000", token: "abcdefgh" });
  assert.equal(settings.host, "0.0.0.0");
  assert.equal(settings.port, 4000);
  assert.deepEqual(errors, []);
  assert.equal(validateSettings({ host: "abc", port: 4000, token: "abcdefgh" }).errors.length, 1);
  assert.equal(validateSettings({ host: "127.0.0.1", port: 70000, token: "abcdefgh" }).errors.length, 1);
  assert.equal(validateSettings({ host: "127.0.0.1", port: 4000, token: "a b" }).errors.length, 1);
});

test("arquivo ausente ou corrompido volta para os padrões", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assistlab-set-"));
  const file = path.join(dir, "settings.json");
  const a = loadSettings(file);
  assert.ok(fs.existsSync(file));
  fs.writeFileSync(file, "{ quebrado");
  const b = loadSettings(file);
  assert.equal(b.port, 3010);
  assert.notEqual(a.token, b.token);
});

test("salvar e ler preserva valores", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assistlab-set-"));
  const file = path.join(dir, "sub", "settings.json");
  const s = { host: "0.0.0.0", port: 4555, token: "meu_token_1", autoStart: false, csvLog: false, rawLog: true };
  saveSettings(file, s);
  assert.deepEqual(loadSettings(file), s);
});

test("viewHost", () => {
  assert.equal(viewHost("0.0.0.0"), "127.0.0.1");
  assert.equal(viewHost("192.168.0.5"), "192.168.0.5");
});
