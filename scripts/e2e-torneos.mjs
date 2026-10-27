// Brief 059 § 8 · Solo para el e2e. (1) El torneo de ensayo (fixture, nunca en public/torneos) se sirve como
// estático desde el build standalone local (.next/standalone/public/torneos/ensayo-059), igual que un torneo real.
// (2) La página lee ARENA_TORNEOS_DIR = .cache/e2e/torneos: una COPIA de public/torneos (los torneos reales
// archivados, que no se modifican) más el fixture, con un índice combinado. El despliegue construye desde el
// código fuente (ACR) y no usa este artefacto.
// (3) Brief 062 § 10 · El almacén local del torneo del sitio (ARENA_TORNEOS_SITIO_DIR = .cache/e2e/torneos-sitio) se
// VACÍA y se siembra con el fixture del sitio (una liga de ensayo de un día pasado, sin el dia- de hoy).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const raiz = process.cwd();
const fixture = resolve(raiz, "src/arena/__fixtures__/torneos");
if (!existsSync(join(raiz, ".next/standalone/server.js"))) throw new Error("Ejecuta npm run build y npm run package:standalone primero.");
const estatico = resolve(raiz, ".next/standalone/public/torneos/ensayo-059");
rmSync(estatico, { recursive: true, force: true });
cpSync(join(fixture, "ensayo-059"), estatico, { recursive: true });

const combinado = resolve(raiz, ".cache/e2e/torneos");
rmSync(combinado, { recursive: true, force: true });
mkdirSync(combinado, { recursive: true });
const leerIndice = dir => existsSync(join(dir, "indice.json")) ? JSON.parse(readFileSync(join(dir, "indice.json"), "utf8")) : [];
const publicos = resolve(raiz, "public/torneos");
const indice = [...leerIndice(publicos), ...leerIndice(fixture)].sort((a, b) => b.inicioUtc.localeCompare(a.inicioUtc) || a.id.localeCompare(b.id));
for (const e of indice) {
  const origen = existsSync(join(publicos, e.id, "torneo.json")) ? join(publicos, e.id) : join(fixture, e.id);
  mkdirSync(join(combinado, e.id));
  for (const f of readdirSync(origen).filter(f => f === "torneo.json")) cpSync(join(origen, f), join(combinado, e.id, f));
}
writeFileSync(join(combinado, "indice.json"), JSON.stringify(indice, null, 2) + "\n");
console.log(`Torneos para el e2e: ${indice.map(e => e.id).join(", ")} (ensayo-059 servido como estático solo en el build del e2e).`);

const sitio = resolve(raiz, ".cache/e2e/torneos-sitio"), fixtureSitio = resolve(raiz, "src/arena/__fixtures__/torneos-sitio");
rmSync(sitio, { recursive: true, force: true });
mkdirSync(sitio, { recursive: true });
const hoy = new Date().toISOString().slice(0, 10);
const sembrados = readdirSync(fixtureSitio).filter(f => f !== `dia-${hoy}.json`);
for (const f of sembrados) cpSync(join(fixtureSitio, f), join(sitio, f));
console.log(`Almacén del torneo del sitio para el e2e: ${sembrados.filter(f => f.endsWith(".torneo.json")).join(", ")}.`);

// (4) Brief 064 § 8.2 · El almacén de crónicas de arena del e2e (ARENA_CRONICAS_DIR = .cache/e2e/cronicas) se VACÍA.
const cronicas = resolve(raiz, ".cache/e2e/cronicas");
rmSync(cronicas, { recursive: true, force: true });
mkdirSync(cronicas, { recursive: true });
console.log("Almacén de crónicas de arena para el e2e: vacío.");
