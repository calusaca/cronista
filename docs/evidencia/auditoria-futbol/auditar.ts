// node --import tsx docs/evidencia/auditoria-futbol/auditar.ts antes.json
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { crearConfigArena, crearEstadoArena, MotorArena } from "../../../src/arena/motor";
import { crearControladorProgramado, planProgramado } from "../../../src/arena/controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../../../src/arena/coordinador";
import { formaciones, type RegistroArena } from "../../../src/arena/tipos";
import { resumir } from "../../../src/arena/entorno";

const sourceFiles = ["src/arena/tipos.ts", "src/arena/catalogo.ts", "src/arena/alineacion.ts", "src/arena/entrenadores.ts", "src/arena/controladores.ts", "src/arena/motor.ts", "src/arena/personalidades.ts"];
const sourceHashes = Object.fromEntries(sourceFiles.map(p => [p, createHash("sha256").update(readFileSync(p)).digest("hex")]));

function sumar(contador: Record<string, number>, clave: string) { contador[clave] = (contador[clave] ?? 0) + 1; }
function resumen(r: RegistroArena) {
  const tiros = r.eventos.filter(e => e.tipo === "tiro").map(e => {
    const instante = [...r.fotogramas].reverse().find(f => f.tick <= e.tick) ?? r.inicial;
    const portero = instante.jugadores.find(j => j.lado !== e.lado && j.puesto === "POR");
    const i = r.eventos.indexOf(e);
    const siguiente = r.eventos.slice(i + 1).find(x => ["gol", "atajada", "tiro_fuera", "intercepcion", "recepcion", "fuera_juego", "tiro"].includes(x.tipo));
    return { id: e.id, tick: e.tick, lado: e.lado, desde: e.desde, objetivo: e.hasta, distanciaM: e.distanciaM, desviacionCentroM: Math.abs(e.hasta.y - 34), desviacionPorteroM: portero ? Math.abs(e.hasta.y - portero.posicion.y) : null, desenlace: siguiente?.tipo ?? "pendiente_al_final" };
  });
  const eventos: Record<string, number> = {}; for (const e of r.eventos) sumar(eventos, e.tipo);
  return { seed: r.config.partido.seed, segundos: r.config.duracionS, equipos: [r.config.partido.local.nombre, r.config.partido.visita.nombre], formaciones: r.config.formaciones, perfiles: { local: r.config.entrenadores?.local.perfil, visita: r.config.entrenadores?.visita.perfil }, marcador: r.final.marcador, eventos, tiros, cambiosFormacion: r.eventos.filter(e => e.tipo === "plan_equipo").map(e => e.formacion) };
}

const elegidas: Record<string, number> = {}, perfiles: Record<string, number> = {};
let mismaFormacion = 0, mismoPerfil = 0;
for (let seed = 1; seed <= 1000; seed++) {
  const c = crearConfigArena({ seed });
  if (c.formaciones.local === c.formaciones.visita) mismaFormacion++;
  if (c.entrenadores!.local.perfil === c.entrenadores!.visita.perfil) mismoPerfil++;
  for (const lado of ["local", "visita"] as const) { sumar(elegidas, c.formaciones[lado]); sumar(perfiles, c.entrenadores![lado].perfil); }
}
const archivos = ["public/experimentos/arena-llm-v1.json", "src/arena/__fixtures__/arena-v2.json", "public/experimentos/arena-llm-v3.json", "public/experimentos/arena-duelo-v3.json"];
const archivados = archivos.map(archivo => {
  const r = JSON.parse(readFileSync(archivo, "utf8")) as RegistroArena;
  return { archivo, reproduccionExacta: isDeepStrictEqual(reproducirArena(r), r), ...resumen(r) };
});

const semillas = [...Array.from({ length: 24 }, (_, i) => i + 1), 42];
const partidos: ReturnType<typeof resumen>[] = [];
let ejemplo: unknown;
for (const segundos of [60, 180]) for (const seed of semillas) {
  const c = crearConfigArena({ seed, duracionS: segundos, intervaloS: 30 });
  const r = await ejecutarArena(c, { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  partidos.push(resumen(r));
  if (seed === 42 && segundos === 60) {
    const estado = r.fotogramas.find(f => f.tick === 305)!;
    ejemplo = { seed, equipos: partidos.at(-1)!.equipos, condiciones: c.partido.condiciones, atributos: c.entrenadores, inicial: r.inicial.entrenadores, segundo30_5: estado.entrenadores, resumen30_5: resumir(estado, r.eventos, 30) };
  }
  if (partidos.length % 10 === 0) console.log(`${partidos.length}/50 partidos programados analizados`);
}

function tiroExplicito(y: number) {
  const c = crearConfigArena({ seed: 777, duracionS: 2 });
  const inicial = crearEstadoArena(c), j = inicial.jugadores.find(j => j.lado === "local" && j.puesto.startsWith("DC"))!;
  j.posicion = { x: 85, y: 34 }; inicial.balon = { posicion: { ...j.posicion }, poseedor: j.id, vuelo: null };
  const motor = new MotorArena(c, inicial), local = planProgramado(observarArena(motor, "local")), visita = planProgramado(observarArena(motor, "visita"));
  Object.assign(local.ordenes.find(o => o.jugador === j.id)!, { accion: "tirar", receptor: null, destino: { x: 105, y } });
  motor.avanzar({ local, visita }, 1);
  return { orden: { x: 105, y }, objetivoEjecutado: motor.eventos.find(e => e.tipo === "tiro")!.hasta };
}
const todosTiros = partidos.flatMap(p => p.tiros), desenlaces: Record<string, number> = {};
for (const t of todosTiros) sumar(desenlaces, t.desenlace);
const informe = { checkedUtc: new Date().toISOString(), scope: "offline audit: archived real-LLM recordings plus controlled programmed matches; no new inference", catalogo: [...formaciones], configuraciones: { cantidad: 1000, elecciones: 2000, elegidas, perfiles, mismaFormacion, mismoPerfil }, corpus: { cantidad: partidos.length, semillas, duracionesS: [60, 180], intervaloS: 30, tiros: todosTiros.length, partidosSinTiros: partidos.filter(p => !p.tiros.length).length, goles: partidos.reduce((n, p) => n + (p.eventos.gol ?? 0), 0), desenlaces, tirosCentralesUnMetro: todosTiros.filter(t => t.desviacionCentroM <= 1).length, desviacionCentroMediaM: todosTiros.reduce((n, t) => n + t.desviacionCentroM, 0) / (todosTiros.length || 1) }, pruebaDireccionIgnorada: [tiroExplicito(31), tiroExplicito(37)], ejemplo, archivados, partidos, sourceHashes };
const destino = resolve("docs/evidencia/auditoria-futbol", process.argv[2] ?? "antes.json");
writeFileSync(destino, JSON.stringify(informe, null, 2) + "\n");
console.log(JSON.stringify({ destino, configuraciones: informe.configuraciones, corpus: informe.corpus, archivadosExactos: archivados.every(a => a.reproduccionExacta) }));
