// Brief 064 (bloque B) · Registros sintéticos para las pruebas de la crónica de arena. Parten de archivos reales del
// repositorio (el duelo archivado y los fixtures v1–v8) y sustituyen la lista de eventos por una escrita a mano, para
// ejercer clases que los partidos programados casi nunca producen (autogol, roja, final anticipado). Nunca se usan
// fuera de las pruebas.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { borradorActa } from "../../cadena/acta";
import { ARENA, CRONICA_ARENA } from "../../sim/limites";
import { caracteresEntrada, hechosCronicaArena, seleccionCronicaArena } from "../cronica-hechos";
import { verificarCronicaArena } from "../cronica-verificador";
import type { Lado } from "../../sim/tipos";
import type { EventoArena, RegistroArena } from "../tipos";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const leerJson = <T = RegistroArena>(ruta: string): T => JSON.parse(readFileSync(join(RAIZ, ruta), "utf8")) as T;
export const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Fixtures de la matriz I4 (registros archivados v1–v8, arena-v1/v2/v3). */
export const FIXTURES_064 = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `src/arena/__fixtures__/arena-reinicios-v${n}.json`),
  "src/arena/__fixtures__/arena-v2.json",
  "public/experimentos/arena-llm-v1.json",
  "public/experimentos/arena-llm-v3.json",
  "public/experimentos/arena-duelo-v3.json",
] as const;

/** Renombra un jugador (por id de arena) en la configuración y en el estado inicial. */
export function renombrar(r: RegistroArena, id: string, nombre: string, dorsal: number): void {
  const j = [...r.inicial.jugadores, ...(r.inicial.banco ?? [])].find((x) => x.id === id)!;
  const lado = j.lado;
  const enConfig = r.config.partido[lado].jugadores.find((x) => x.nombre === j.nombre)!;
  enConfig.nombre = nombre;
  enConfig.dorsal = dorsal;
  for (const est of [r.inicial, r.final]) for (const x of [...est.jugadores, ...(est.banco ?? []), ...(est.retirados ?? []), ...(est.expulsados ?? [])]) if (x.id === id) { x.nombre = nombre; x.dorsal = dorsal; }
}

let contador = 0;
/** Evento sintético. `tick` en ticks del motor; `desde`/`hasta` por defecto en el centro. */
export function ev(tick: number, tipo: EventoArena["tipo"], lado: Lado, jugador: string, extra: Partial<EventoArena> = {}): EventoArena {
  contador++;
  return { id: `a${contador}`, tick, tipo, lado, jugador, receptor: null, desde: { x: 52.5, y: 34 }, hasta: { x: 52.5, y: 34 }, distanciaM: 0, ...extra };
}

/** Sustituye los eventos (renumerados `a1…` en orden de tick) y fija el marcador final por los goles. */
export function conEventos(base: RegistroArena, eventos: EventoArena[]): RegistroArena {
  const r = copia(base);
  const orden = [...eventos].sort((a, b) => a.tick - b.tick);
  const ren = new Map(orden.map((e, i) => [e.id, `a${i + 1}`] as const));
  r.eventos = orden.map((e) => ({ ...e, id: ren.get(e.id)!, ...(e.fuentes ? { fuentes: e.fuentes.map((f) => ren.get(f) ?? f) } : {}) }));
  r.final.marcador = { ...r.inicial.marcador };
  for (const e of r.eventos) if (e.tipo === "gol") r.final.marcador[e.lado]++;
  return r;
}

/** Arco rival (absoluto) del lado: el local ataca hacia x = largoM. */
export const arcoRival = (lado: Lado) => ({ x: lado === "local" ? ARENA.largoM : 0, y: ARENA.anchoM / 2 });
/** Punto a `m` metros del arco rival, sobre el eje (dentro del área si m < areaLargoM). */
export const aMetros = (lado: Lado, m: number) => ({ x: lado === "local" ? ARENA.largoM - m : m, y: ARENA.anchoM / 2 });

/**
 * Registro de los ejemplos normativos del § 4.2: duelo archivado (Juventud Islaverde Sur – Atlético Montefrío Bajo,
 * 60 s) con Ana Ruiz (9), Pablo Gil (4) y Luis Paz (1). Final 2–1: gol de Ana Ruiz a los 34 s (sin remate previo),
 * autogol de Pablo Gil a los 50 s y gol de Bruno Toroino a los 56 s; Juventud 5 remates (2 a puerta), Atlético 3 (1);
 * 3 atajadas de Luis Paz; cambio de Juventud a los 45 s; amarilla y roja de Atlético.
 */
export function registroEjemplos064(): RegistroArena {
  const base = copia(leerJson("public/experimentos/arena-duelo-v3.json"));
  renombrar(base, "local-8", "Ana Ruiz", 9);
  renombrar(base, "visita-3", "Pablo Gil", 4);
  renombrar(base, "visita-0", "Luis Paz", 1);
  const tiro = (tick: number, lado: Lado, j: string) => ev(tick, "tiro", lado, j, { desde: aMetros(lado, 14), hasta: arcoRival(lado), distanciaM: 14 });
  const t1 = tiro(100, "local", "local-10"), t2 = tiro(150, "local", "local-10"), t3 = tiro(200, "local", "local-7"), t4 = tiro(250, "local", "local-7"), t5 = tiro(280, "local", "local-10");
  const v1 = tiro(380, "visita", "visita-9"), v2 = tiro(420, "visita", "visita-9"), v3 = tiro(470, "visita", "visita-8");
  const falta = ev(310, "falta", "visita", "visita-5", { receptor: "local-6", gravedad: "fuerza_excesiva" });
  return conEventos(base, [
    t1, ev(102, "atajada", "visita", "visita-0", { receptor: "local-10" }),
    t2, ev(152, "tiro_fuera", "local", "local-10"),
    t3, ev(202, "atajada", "visita", "visita-0", { receptor: "local-7" }),
    t4, ev(252, "tiro_fuera", "local", "local-7"),
    t5, ev(282, "atajada", "visita", "visita-0", { receptor: null, motivo: "desvio" }),
    ev(300, "amarilla", "visita", "visita-4", { gravedad: "temeraria" }),
    falta, ev(310, "roja", "visita", "visita-5", { fuentes: [falta.id], gravedad: "fuerza_excesiva" }),
    ev(335, "recuperacion", "local", "local-8"), ev(340, "gol", "local", "local-8", { desde: { x: 90, y: 30 }, hasta: arcoRival("local"), distanciaM: 15 }),
    v1, ev(382, "atajada", "local", "local-0", { receptor: "visita-9" }),
    v2, ev(422, "tiro_fuera", "visita", "visita-9"),
    ev(450, "cambio", "local", "local-9", { sale: "local-6", entrenador: "Entrenador ficticio", motivo: "sustitucion" }),
    v3, ev(472, "tiro_fuera", "visita", "visita-8"),
    ev(500, "gol", "local", "visita-3", { autogol: true }),
    ev(555, "recuperacion", "visita", "visita-8"), ev(560, "gol", "visita", "visita-8", { desde: { x: 20, y: 34 }, hasta: arcoRival("visita"), distanciaM: 20 }),
  ]);
}

/** Final anticipado a los 120 s: Atlético Montefrío Bajo se queda con 6 jugadores (§ 4.2, ejemplo normativo). */
export function registroFinalAnticipado064(): RegistroArena {
  const base = copia(leerJson("public/experimentos/arena-duelo-v3.json"));
  base.config.duracionS = 180;
  const tick = Math.round(120 / ARENA.pasoS);
  const r = conEventos(base, [ev(tick, "falta", "visita", "visita-5"), ev(tick, "roja", "visita", "visita-5"), ev(tick, "final_anticipado", "visita", "visita-5")]);
  r.final.tick = tick;
  r.final.finalizado = { tick, motivo: "menos_de_siete" };
  const visita = r.final.jugadores.filter((j) => j.lado === "visita").slice(0, 6);
  r.final.jugadores = [...r.final.jugadores.filter((j) => j.lado === "local"), ...visita];
  return r;
}

/** `n` goles alternados (sin remate previo) para forzar recortes y excesos de tamaño. */
export function registroConGoles064(n: number, extra: (base: RegistroArena) => EventoArena[] = () => []): RegistroArena {
  const base = copia(leerJson("public/experimentos/arena-duelo-v3.json"));
  base.config.duracionS = 180;
  base.final.tick = Math.round(180 / ARENA.pasoS);
  const goleadores: Record<Lado, string[]> = { local: ["local-8", "local-10", "local-7", "local-6"], visita: ["visita-8", "visita-9", "visita-7", "visita-6"] };
  const eventos: EventoArena[] = [];
  for (let k = 0; k < n; k++) {
    const lado: Lado = k % 2 === 0 ? "local" : "visita";
    const j = goleadores[lado][Math.floor(k / 2) % 4]!;
    const tick = 10 + k * Math.floor((base.final.tick - 20) / Math.max(1, n));
    eventos.push(ev(tick, "recuperacion", lado, j), ev(tick + 1, "gol", lado, j));
  }
  return conEventos(base, [...eventos, ...extra(base)]);
}


/** § 4.2 · Claves que el Verificador lee como minutos o periodos: prohibidas en los hechos de arena. */
export const CLAVES_PROHIBIDAS_064 = ["minuto", "desde", "hasta", "minuto_desventaja", "minutos", "periodo", "tick"] as const;

/** I4 + I5 sobre un registro completo: lista de incumplimientos (vacía = cumple). */
export function incumplimientosI4I5(r: RegistroArena): string[] {
  const err: string[] = [];
  const { hechos, cabe } = seleccionCronicaArena(r);
  const hs = hechos.map((h) => h.hecho);
  // I4: el acta siempre verifica
  const motivos = verificarCronicaArena(borradorActa(hs), hs, r.config.partido);
  for (const m of motivos) err.push(`I4 ${m.regla} ${m.oracion}: ${m.detalle}`);
  // I5
  const relevancias = new Set<number>(Object.values(CRONICA_ARENA.relevancia));
  const indice = new Map(r.eventos.map((e, i) => [e.id, i] as const));
  hechos.forEach(({ hecho, evidencia }, i) => {
    if (hecho.id !== `c${String(i + 1).padStart(2, "0")}`) err.push(`I5 id ${hecho.id} en la posición ${i}`);
    if (!relevancias.has(hecho.relevancia)) err.push(`I5 relevancia ${hecho.relevancia} fuera del catálogo`);
    for (const k of CLAVES_PROHIBIDAS_064) if (k in hecho.datos) err.push(`I5 clave prohibida ${k} en ${hecho.id}`);
    if (evidencia.eventos !== hecho.eventos) err.push(`I5 evidencia ≠ eventos en ${hecho.id}`);
    const pos = hecho.eventos.map((id) => indice.get(id));
    if (pos.some((p) => p === undefined)) err.push(`I5 evento inexistente en ${hecho.id}`);
    if (pos.some((p, k) => k > 0 && (p as number) <= (pos[k - 1] as number))) err.push(`I5 eventos fuera de orden en ${hecho.id}`);
    const ceroCero = hecho.tipo === "resultado_final" && hecho.datos.goles_local === 0 && hecho.datos.goles_visita === 0 && !r.eventos.some((e) => e.tipo === "final_anticipado");
    if (hecho.eventos.length === 0 && !ceroCero) err.push(`I5 eventos vacíos en ${hecho.id} (${hecho.tipo})`);
  });
  if (cabe && caracteresEntrada(hechos) > CRONICA_ARENA.maxCaracteresEntrada) err.push("I5 la entrada no cabe");
  if (JSON.stringify(seleccionCronicaArena(r)) !== JSON.stringify({ hechos, cabe })) err.push("I5 no determinista");
  if (JSON.stringify(hechosCronicaArena(r)) !== JSON.stringify(hechosCronicaArena(r))) err.push("I5 catálogo no determinista");
  return err;
}
