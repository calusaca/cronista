// Brief 062 · Mutaciones de los e2e del P1-a (`e2e/arena-torneo-sitio.spec.ts`). Cada una se aplica al archivo real, se
// ejecuta Playwright SOLO con el caso que la nombra (`-g`; el servidor del e2e se reconstruye con el código mutado), se
// anota el md5 del archivo mutado y se revierte en `finally`. Cuenta si el e2e queda en ROJO.
//
//   node docs/evidencia/torneo-sitio-062/mutaciones-e2e.mjs   →   docs/evidencia/torneo-sitio-062/mutaciones-e2e.md
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const md5 = t => createHash("md5").update(t).digest("hex");
const SPEC = "e2e/arena-torneo-sitio.spec.ts";
const M = [
  { id: "E1-rotulo", desc: "quitar el rótulo de origen", archivo: "src/ui/ArenaTorneo.tsx", patron: "1 · lista con los dos orígenes", cambios: [
    ['      <p className="arena-torneo-rotulo" data-testid="arena-torneo-rotulo">{rotuloOrigen(t, idioma)}</p>\n', ""]] },
  { id: "E3-base", desc: "repetición del sitio pedida a /torneos (sin la base del prefijo)", archivo: "src/ui/torneo-carga.ts", patron: "3 · «Watch replay»", cambios: [
    ["export const baseTorneo = (id: string) => id.startsWith(TORNEO_SITIO.prefijoId) ? `/api/arena/torneos/sitio/${id}` : `/torneos/${id}`;", "export const baseTorneo = (id: string) => `/torneos/${id}`; void TORNEO_SITIO;"]] },
  { id: "E4-cupo", desc: "el motivo «cupo» no se muestra", archivo: "src/ui/ArenaTorneoLanzar.tsx", patron: "4 · lanzar una liga", cambios: [
    ['    case "cupo": return es ?', '    case "cupo": return ""; return es ?']] },
  { id: "E5-origen", desc: "sin la comprobación del Origin", archivo: "src/app/api/arena/torneos/sitio/route.ts", patron: "5 · un POST con un Origin ajeno", cambios: [
    ['  if (!origenCoincide(req.headers.get("origin"), cfg.origen)) return', '  if (false && !origenCoincide(req.headers.get("origin"), cfg.origen)) return']] },
  { id: "E7-360", desc: "las cifras del panel sin envolver a 360 px", archivo: "src/app/globals.css", patron: "7 · 360 px \\(light, en\\)", cambios: [
    [".arena-torneo-cifras { display: block; color: var(--muted); font-size: 14px; }", ".arena-torneo-cifras { display: block; color: var(--muted); font-size: 14px; white-space: nowrap; }"]] },
];

const filas = [];
for (const m of M) {
  const original = readFileSync(m.archivo, "utf8"), md5Original = md5(original);
  let mutado = original;
  for (const [buscar, reemplazo] of m.cambios) {
    const veces = mutado.split(buscar).length - 1;
    if (veces !== 1) throw new Error(`${m.id}: «${buscar.slice(0, 70)}» aparece ${veces} veces en ${m.archivo}`);
    mutado = mutado.replace(buscar, () => reemplazo);
  }
  let estado = "verde (NO detectada)", salida = "";
  try {
    writeFileSync(m.archivo, mutado);
    try { salida = execFileSync("npx", ["playwright", "test", SPEC, "-g", m.patron], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 900_000 }); }
    catch (error) { estado = "ROJO (detectada)"; salida = `${error.stdout ?? ""}${error.stderr ?? ""}`; }
  } finally { writeFileSync(m.archivo, original); }
  if (md5(readFileSync(m.archivo, "utf8")) !== md5Original) throw new Error(`${m.id}: el archivo no volvió al original`);
  const resumen = [...salida.matchAll(/^\s+(\d+ (passed|failed|flaky|skipped))/gm)].map(x => x[1]).join(", ") || "(sin resumen)";
  filas.push({ ...m, md5: md5(mutado), estado, resumen });
  console.log(`${estado.padEnd(22)} ${m.id.padEnd(10)} ${resumen}`);
}
writeFileSync("docs/evidencia/torneo-sitio-062/mutaciones-e2e.md", [
  "# Brief 062 · mutaciones de los e2e del P1-a", "",
  `Generado por \`node docs/evidencia/torneo-sitio-062/mutaciones-e2e.mjs\` el ${new Date().toISOString()}. Cada mutación se aplicó al archivo real,`,
  "se ejecutó Playwright solo con el caso que la nombra (el servidor del e2e se reconstruye) y se revirtió (md5 comprobado).", "",
  "| # | Mutación | Archivo | md5 mutado | Caso (`-g`) | Resultado | Resumen |", "|---|---|---|---|---|---|---|",
  ...filas.map(f => `| ${f.id} | ${f.desc} | \`${f.archivo}\` | \`${f.md5}\` | \`${f.patron.replace(/\|/g, "\\|")}\` | ${f.estado} | ${f.resumen} |`), "",
  `Detectadas: ${filas.filter(f => f.estado.startsWith("ROJO")).length} de ${filas.length}.`, "",
].join("\n"));
if (filas.some(f => !f.estado.startsWith("ROJO"))) process.exitCode = 1;
