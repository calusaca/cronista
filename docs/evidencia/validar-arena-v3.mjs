// Desde la raíz: node --import tsx docs/evidencia/validar-arena-v3.mjs
// Solo políticas programadas y archivos archivados: sin credenciales ni inferencia.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { ARENA } from "../../src/sim/limites.ts";
import { crearControladorProgramado } from "../../src/arena/controladores.ts";
import { ejecutarArena, reproducirArena } from "../../src/arena/coordinador.ts";
import { crearConfigArena } from "../../src/arena/motor.ts";

const programados = () => ({ local: crearControladorProgramado(), visita: crearControladorProgramado() });
const casos = [], eventos = {};
let respaldos = 0, maxBytes = 0;
for (let seed = 1; seed <= 24; seed++) {
  const r = await ejecutarArena(crearConfigArena({ seed, duracionS: 90, intervaloS: 10 }), programados());
  assert.deepEqual(reproducirArena(r).final, r.final);
  for (const f of r.fotogramas) {
    const personas = [...f.jugadores, ...f.banco, ...f.retirados, ...f.expulsados];
    assert.equal(personas.length, 32); assert.equal(new Set(personas.map(j => j.id)).size, 32);
    for (const lado of ["local", "visita"]) assert.equal(f.jugadores.filter(j => j.lado === lado && j.capitan).length, 1);
  }
  for (const e of r.eventos) eventos[e.tipo] = (eventos[e.tipo] ?? 0) + 1;
  respaldos += r.rondas.flatMap(x => Object.values(x.decisiones)).filter(d => d.origen === "respaldo").length;
  const bytes = Buffer.byteLength(JSON.stringify(r));
  assert.ok(bytes < ARENA.archivoMaxBytes); maxBytes = Math.max(maxBytes, bytes);
  casos.push({ seed, score: r.final.marcador, changes: r.eventos.filter(e => e.tipo === "cambio").length, replay: true, bytes });
}
const ruta = "public/experimentos/arena-llm-v3.json";
const real = reproducirArena(JSON.parse(readFileSync(ruta, "utf8")));
const programado = await ejecutarArena(real.config, programados());
assert.deepEqual(programado.inicial, real.inicial);
const sha256 = p => createHash("sha256").update(readFileSync(p)).digest("hex");
const fuentes = [...readdirSync("src/arena").filter(p => p.endsWith(".ts")).map(p => `src/arena/${p}`),
  "src/sim/limites.ts", "src/ui/Arena.tsx", "src/ui/ArenaPlantilla.tsx", "src/ui/ArenaContexto.tsx", "src/app/api/arena/route.ts", "src/app/globals.css", "docs/evidencia/validar-arena-v3.mjs"];
const resumen = r => ({ score: r.final.marcador, events: r.eventos.length, tacticalReviews: r.eventos.filter(e => e.tipo === "plan_equipo").length, substitutions: r.eventos.filter(e => e.tipo === "cambio").length });
const informe = {
  checkedUtc: new Date().toISOString(), phase: "local_verified_pending_publication", version: ARENA.version,
  corpus: { seeds: 24, seconds: 90, replayMatches: 24, fallback: respaldos, maxBytes, events: eventos, cases: casos },
  real: { path: ruta, sha256: sha256(ruta), seconds: real.config.duracionS, calls: real.rondas.length * 2,
    valid: real.rondas.flatMap(x => Object.values(x.decisiones)).filter(d => d.origen === "controlador").length,
    fallback: real.rondas.flatMap(x => Object.values(x.decisiones)).filter(d => d.origen === "respaldo").length,
    controllers: [...new Set(real.rondas.flatMap(x => Object.values(x.decisiones)).map(d => d.controlador))], distinctModels: false, replay: true,
    technicalEvents: real.eventos.filter(e => e.tipo === "plan_equipo").length },
  comparison: { sameConfig: true, sameInitialState: true, sameFinalState: JSON.stringify(real.final) === JSON.stringify(programado.final), llm: resumen(real), programmed: resumen(programado) },
  sourceHashes: Object.fromEntries(fuentes.map(p => [p, sha256(p)])),
  limits: ["One model deployment, two independent controllers.", "Descriptive comparison, not an evaluation of tactical superiority.",
    "Synthetic uncalibrated movement, personalities and environmental effects.", "Simplified restarts and contact fouls; no human realism assessment.",
    "No public deployment or new model deployment was performed."],
};
writeFileSync("docs/evidencia/arena-v3.json", JSON.stringify(informe, null, 2) + "\n");
console.log(JSON.stringify({ corpus: { seeds: 24, replay: 24, fallback: respaldos, events: eventos }, real: informe.real, comparison: informe.comparison }, null, 2));
