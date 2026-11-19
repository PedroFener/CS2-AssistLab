// Copia o painel (../gsi-dashboard/src e public) para desktop/dashboard,
// para o electron-builder empacotar junto com o aplicativo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..", "..", "gsi-dashboard");
const dst = path.resolve(here, "..", "dashboard");

for (const dir of ["src", "public"]) {
  const from = path.join(src, dir);
  if (!fs.existsSync(from)) {
    console.error(`Não encontrei ${from}. Rode a partir do repositório completo.`);
    process.exit(1);
  }
  fs.rmSync(path.join(dst, dir), { recursive: true, force: true });
  fs.cpSync(from, path.join(dst, dir), { recursive: true });
}
// Marca a pasta como ESM (o painel usa import/export).
fs.writeFileSync(path.join(dst, "package.json"), JSON.stringify({ type: "module", private: true }, null, 2));
console.log("Painel copiado para", dst);
