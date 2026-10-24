// Brief 059 § 7 — `torneos-rechazo/ensayo-059-alterado/` (fuera de la raíz publicada: no es un torneo del índice): copia de `torneos/ensayo-059/` con un gol cambiado en torneo.json (P1,
// local +1) y una orden cambiada dentro de e03.json.gz (primer destino del local en la ronda 1, x + 1), sin tocar
// su `archivoSha256`. Solo para las pruebas de rechazo (torneos-archivados.test.ts); no figura en indice.json.
//
// El fixture válido lo genera el CLI (ver la cabecera de src/arena/torneo-cli.ts); después:
//   node --import tsx src/arena/__fixtures__/generar-torneo-alterado.ts
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import type { TorneoArchivado } from "../torneo";

const ORIGEN = "src/arena/__fixtures__/torneos/ensayo-059", DESTINO = "src/arena/__fixtures__/torneos-rechazo/ensayo-059-alterado";
rmSync(DESTINO, { recursive: true, force: true });
cpSync(ORIGEN, DESTINO, { recursive: true });
const t = JSON.parse(readFileSync(`${DESTINO}/torneo.json`, "utf8")) as TorneoArchivado;
t.encuentros.find(e => e.n === 1)!.local.goles += 1;
writeFileSync(`${DESTINO}/torneo.json`, JSON.stringify(t, null, 2) + "\n");
const registro = JSON.parse(gunzipSync(readFileSync(`${DESTINO}/e03.json.gz`)).toString("utf8")) as { rondas: { decisiones: { local: { ordenes: { ordenes: { destino: { x: number } }[] } } } }[] };
registro.rondas[0]!.decisiones.local.ordenes.ordenes[0]!.destino.x += 1;
writeFileSync(`${DESTINO}/e03.json.gz`, gzipSync(JSON.stringify(registro), { level: 9 }));
console.log(`Escrito ${DESTINO}`);
