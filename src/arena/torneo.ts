// Brief 059 v1.2 — Torneo entre modelos: funciones puras compartidas por el CLI (`npm run arena:torneo`),
// la validación en CI de los torneos archivados y, en P1-B, la página. Nada aquí hace E/S ni llama a red:
// calendario Berger (§ 15.2), clasificación y desempates (§ 4.2), prueba de signos ilustrativa (§ 4.4,
// § 15.7), micro-USD y reservas (§ 15.1), causa terminal de un respaldo (§ 16.2), esquema único y estricto
// (§ 15.6) y la validación compartida de cada partido contra su registro (§ 15.5, § 16.1).
//
// Sin dependencias de Node: lo importan también la página (cliente) y Arena.tsx. La validación contra los archivos
// (`node:zlib`, `node:crypto`, motor) vive en `torneo-validacion.ts` (servidor, CLI y CI).
import { z } from "zod";
import { ARENA, SMOKE_MODELOS_ARENA, TORNEO_ARENA as T, TORNEO_SITIO } from "../sim/limites";
import { prngDerivado } from "../sim/prng";
import type { Lado } from "../sim/tipos";
import type { DecisionArena } from "./tipos";
// Ciclo de importación deliberado y seguro: torneo-formatos.ts solo usa lo de aquí dentro de funciones.
import { coherencia062 } from "./torneo-formatos";

export const VERSION_TORNEO = T.version;
export const LADOS_TORNEO = ["local", "visita"] as const satisfies readonly Lado[];
/** § 3.1 · id de un torneo: la referencia `torneo-<id>-<nn>` cabe en 50 caracteres. */
export const ID_TORNEO = /^[a-z0-9-]{1,30}$/;

// ---------------------------------------------------------------------------------------------------
// Esquema único y estricto (§ 15.6 + § 16.2: `esperas`). Todos los objetos son `z.strictObject`: un campo
// agregado (`clasificacion`, `tabla`, `totales`…) se rechaza, así no puede existir una tabla guardada que
// contradiga los partidos (D8).
// ---------------------------------------------------------------------------------------------------
const noNegativo = z.number().int().min(0);
const microUsd = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const fechaUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/);
const texto = (max = 200) => z.string().min(1).max(max);
const motivoDecision = z.enum(["valida", "orden_invalida", "error_controlador", "plazo_agotado"]);

export const esquemaPrecio = z.strictObject({
  /** USD por millón de tokens (precios.json). */
  entrada: z.number().min(0), salida: z.number().min(0), cache: z.number().min(0).nullable(),
  fuente: texto(500), consultadoUtc: fechaUtc,
  /** "cronista-sol6" para `cronista-sol61` mientras precios.json no tenga el suyo (§ 9, § 15.6). */
  estimadoDe: texto(100).nullable(),
});
export const esquemaParticipante = z.strictObject({
  id: z.string().regex(/^[a-z0-9:-]{1,40}$/), nombre: texto(), corto: z.string().min(1).max(8),
  deployment: texto(), modelo: texto(), version: texto(),
  /** "ensayo" solo en `tipo: "ensayo"` (controladores programados `ensayo:<x>`, D10); ver validarCoherencia. */
  llm: z.enum(["azure-openai", "foundry-modelos", "ensayo"]),
  controlador: texto(), formatoJson: z.string().min(1).max(40).nullable(), esfuerzo: z.enum(["low", "minimal"]).nullable(),
  precio: esquemaPrecio,
});
export const NATURALEZAS = ["ok", "reintentable", "http_otro", "red", "abortado"] as const;
export const esquemaIntentoHttp = z.strictObject({
  naturaleza: z.enum(NATURALEZAS), status: z.number().int().min(100).max(599).nullable(), conUso: z.boolean(), ronda: z.number().int().min(1),
});
export const esquemaEspera = z.strictObject({ ronda: z.number().int().min(1), desdeMs: noNegativo, ms: noNegativo, interrumpida: z.boolean() });
export const esquemaDeclarado = z.strictObject({
  /** Constan en el archivo (`rondas[i].decisiones[lado]`): validarEncuentro los contrasta. */
  tiemposMs: z.array(z.number().min(0)), llamadas: z.array(z.number().int().min(0).max(ARENA.intentosOrdenes)), motivos: z.array(motivoDecision),
  /** Solo peticiones realmente enviadas; las esperas entre reintentos van aparte (§ 16.2). */
  intentos: z.array(esquemaIntentoHttp), esperas: z.array(esquemaEspera),
  /** Sumas de los `usage` conocidos. */
  entrada: noNegativo, salida: noNegativo, cache: noNegativo,
  /** Intentos sin `usage` (red, cancelación, 5xx, 429, 200 sin `usage`): cada uno cuenta su máximo. */
  sinUso: noNegativo, costoMicroUsd: microUsd,
  modelosDevueltos: z.array(texto()),
});
const cifra = z.number().min(0).nullable();
export const esquemaCifras = z.strictObject({ posesionPct: cifra, remates: cifra, rematesDirectos: cifra, pasesCompletados: cifra, pasesIntentados: cifra, recuperaciones: cifra });
export const esquemaLado = z.strictObject({ participante: texto(40), club: texto(), goles: noNegativo, cifras: esquemaCifras, declarado: esquemaDeclarado });
export const esquemaEncuentro = z.strictObject({
  n: z.number().int().min(1), jornada: z.number().int().min(1), cruce: z.number().int().min(1), vuelta: z.boolean(), seed: z.number().int().min(0).max(0xffffffff),
  archivo: z.string().regex(/^e\d{2}\.json\.gz$/), archivoSha256: z.string().regex(/^[0-9a-f]{64}$/), intento: z.number().int().min(1),
  local: esquemaLado, visita: esquemaLado,
});
export const esquemaGasto = z.strictObject({ conocidoMicroUsd: microUsd, tipicoMicroUsd: microUsd, topeMicroUsd: microUsd, reservaMaxPartidoMicroUsd: microUsd });
const camposTorneo = {
  id: z.string().regex(ID_TORNEO), tipo: z.enum(["real", "ensayo"]), titulo: z.strictObject({ es: texto(), en: texto() }),
  inicioUtc: fechaUtc, commit: z.string().regex(/^[0-9a-f]{7,40}$/),
  motor: z.strictObject({ version: texto(40), reglas: texto(40) }), duracionS: z.number().int().min(1), intervaloS: z.number().int().min(1), semilla: z.number().int().min(0).max(0xffffffff),
  participantes: z.array(esquemaParticipante).min(T.participantes.min).max(T.participantes.max), pendientes: z.array(z.number().int().min(1)),
  gasto: esquemaGasto,
};
/** El archivo 059 (`059-v1.1`), sin cambios: el del 24 oct sigue siendo válido byte a byte. Conserva el nombre
 * `esquemaTorneo` (lo usan la página y la carga de repeticiones, fuera de esta entrega); la unión 059 | 062 es
 * `esquemaTorneoCualquiera`. */
export const esquemaTorneo059 = z.strictObject({
  version: z.literal(T.version), ...camposTorneo, finUtc: fechaUtc, encuentros: z.array(esquemaEncuentro), estado: z.enum(["completo", "incompleto"]),
});

// ---------------------------------------------------------------------------------------------------
// Brief 062 § 4 + § 17.10 + § 18.4 · Esquema 062 (torneo del sitio o archivado con formato). Vive aquí, junto al
// 059, porque `esquemaTorneo` es la unión de los dos; las funciones de formato están en `torneo-formatos.ts`.
// ---------------------------------------------------------------------------------------------------
export const FORMATOS_TORNEO = ["liga", "grupos"] as const;
export const FASES_ENCUENTRO = ["liga", "grupo-A", "grupo-B", "semifinal-1", "semifinal-2", "final"] as const;
export const ESTADOS_062 = ["completo", "incompleto", "en_curso", "cancelado", "interrumpido"] as const;
export const MOTIVOS_FIN_062 = ["tope", "infraestructura", "plazo", "cancelado", "reinicio", "almacen"] as const;
/** Un encuentro 062: el 059 más `fase` y `desempate` (estricto: el esquema 059 sigue rechazando ambos). */
export const esquemaEncuentro062 = z.strictObject({ ...esquemaEncuentro.shape, fase: z.enum(FASES_ENCUENTRO), desempate: z.boolean() });
export const esquemaEnCurso = z.strictObject({ n: z.number().int().min(1), local: texto(40), visita: texto(40), inicioUtc: fechaUtc });
export const esquemaTorneo062 = z.strictObject({
  version: z.literal(TORNEO_SITIO.version), ...camposTorneo,
  formato: z.enum(FORMATOS_TORNEO), origen: z.enum(["repositorio", "sitio"]), lanzamiento: z.enum(["publico", "prueba"]),
  /** null mientras el torneo está `en_curso` (validarCoherencia lo exige). */
  finUtc: fechaUtc.nullable(),
  estado: z.enum(ESTADOS_062), motivoFin: z.enum(MOTIVOS_FIN_062).nullable(), enCurso: esquemaEnCurso.nullable(),
  encuentros: z.array(esquemaEncuentro062),
});
export const esquemaTorneo = esquemaTorneo059;
/** Brief 062 § 4 · Unión discriminada por `version` (servidor, validación de CI y, cuando se integre la UI, la carga). */
export const esquemaTorneoCualquiera = z.discriminatedUnion("version", [esquemaTorneo059, esquemaTorneo062]);
/** `eNN.ejecutor.json` (§ 15.4): lo declarado por el ejecutor para ese partido. */
export const esquemaEjecutor = z.strictObject({ n: z.number().int().min(1), intento: z.number().int().min(1), archivoSha256: z.string().regex(/^[0-9a-f]{64}$/), local: esquemaDeclarado, visita: esquemaDeclarado });
/** `config.json` del directorio de trabajo: `--reanudar` exige que sea idéntico. */
export const esquemaConfigTorneo = z.strictObject({
  id: z.string().regex(ID_TORNEO), participantes: z.array(esquemaParticipante).min(T.participantes.min).max(T.participantes.max), semilla: z.number().int().min(0).max(0xffffffff),
  duracionS: z.number().int().min(1), intervaloS: z.number().int().min(1), motor: z.strictObject({ version: texto(40), reglas: texto(40) }), commit: z.string().regex(/^[0-9a-f]{7,40}$/),
});
/** Una línea de `gasto.ndjson`, el libro de solo anexión (§ 15.4). */
export const esquemaMovimiento = z.discriminatedUnion("tipo", [
  z.strictObject({ n: z.number().int().min(1), intento: z.number().int().min(1), tipo: z.literal("reserva"), microUsd }),
  z.strictObject({ n: z.number().int().min(1), intento: z.number().int().min(1), tipo: z.literal("cierre"), microUsd, resultado: z.enum(["valido", "anulado", "interrumpido", "fallo"]) }),
]);
export const esquemaCerrojo = z.strictObject({ pid: z.number().int().min(1), inicioUtc: fechaUtc });
export const esquemaIndice = z.array(z.strictObject({ id: z.string().regex(ID_TORNEO), inicioUtc: fechaUtc, titulo: z.strictObject({ es: texto(), en: texto() }) }));

export type PrecioTorneo = z.infer<typeof esquemaPrecio>;
export type ParticipanteTorneo = z.infer<typeof esquemaParticipante>;
export type IntentoHttp = z.infer<typeof esquemaIntentoHttp>;
export type NaturalezaIntento = IntentoHttp["naturaleza"];
export type EsperaHttp = z.infer<typeof esquemaEspera>;
export type DeclaradoLado = z.infer<typeof esquemaDeclarado>;
export type CifrasLado = z.infer<typeof esquemaCifras>;
export type LadoEncuentro = z.infer<typeof esquemaLado>;
export type EncuentroTorneo = z.infer<typeof esquemaEncuentro>;
export type EncuentroTorneo062 = z.infer<typeof esquemaEncuentro062>;
export type Torneo059 = z.infer<typeof esquemaTorneo059>;
export type Torneo062 = z.infer<typeof esquemaTorneo062>;
export type TorneoArchivado = Torneo059;
export type TorneoCualquiera = z.infer<typeof esquemaTorneoCualquiera>;
export type EjecutorEncuentro = z.infer<typeof esquemaEjecutor>;
export type ConfigTorneo = z.infer<typeof esquemaConfigTorneo>;
export type MovimientoGasto = z.infer<typeof esquemaMovimiento>;
export type IndiceTorneos = z.infer<typeof esquemaIndice>;
/** Lo que un partido necesita del torneo para validarse (§ 16.1). */
export type MarcoTorneo = Pick<TorneoCualquiera, "duracionS" | "intervaloS" | "motor">;

export const archivoEncuentro = (n: number) => `e${String(n).padStart(2, "0")}.json.gz`;

/** § 3.2 · Nombre corto: sin el prefijo «GPT-», 8 caracteres como máximo. */
export function cortoDe(nombre: string): string {
  return nombre.replace(/^GPT-/i, "").slice(0, 8).trimEnd();
}

// ---------------------------------------------------------------------------------------------------
// Calendario Berger (§ 15.2): tablas literales sobre los índices 1..n del orden barajado.
// ---------------------------------------------------------------------------------------------------
export interface EncuentroPlan { n: number; jornada: number; cruce: number; vuelta: boolean; seed: number; local: string; visita: string }

/** (local, visita) por jornada. Con 6: 15 parejas distintas, nadie repite jornada y locales en la ida
 * [3,3,3,2,2,2] (índices 1–3 con 3, 4–6 con 2). Con 3: un descanso por jornada (3, 2 y 1). */
export const TABLAS_BERGER: Readonly<Record<number, readonly (readonly (readonly [number, number])[])[]>> = {
  3: [[[1, 2]], [[3, 1]], [[2, 3]]],
  6: [
    [[1, 6], [2, 5], [3, 4]],
    [[6, 4], [5, 3], [1, 2]],
    [[2, 6], [3, 1], [4, 5]],
    [[6, 5], [1, 4], [2, 3]],
    [[3, 6], [4, 2], [5, 1]],
  ],
};

/** Orden barajado con `prngDerivado(semilla, "torneo-059:orden")`, independiente del orden de entrada. */
export function ordenTorneo(ids: readonly string[], semilla: number): string[] {
  const orden = [...ids].sort();
  const rng = prngDerivado(semilla, "torneo-059:orden");
  for (let i = orden.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [orden[i], orden[j]] = [orden[j]!, orden[i]!];
  }
  return orden;
}

export const claveCruce = (a: string, b: string) => [a, b].sort().join("|");

/** Semilla uint32 de cada cruce: no depende del orden del calendario; ante una colisión, sufijo ":1", ":2"… */
export function semillasCruce(ids: readonly string[], semilla: number): Map<string, number> {
  const claves: string[] = [];
  const orden = [...ids].sort();
  for (let i = 0; i < orden.length; i++) for (let j = i + 1; j < orden.length; j++) claves.push(claveCruce(orden[i]!, orden[j]!));
  claves.sort();
  const usadas = new Set<number>(), semillas = new Map<string, number>();
  for (const clave of claves) {
    let seed: number;
    for (let k = 0; ; k++) {
      seed = prngDerivado(semilla, `torneo-059:cruce:${clave}${k ? `:${k}` : ""}`).int(0, 0xffffffff);
      if (!usadas.has(seed)) break;
    }
    usadas.add(seed); semillas.set(clave, seed);
  }
  return semillas;
}

/** § 3.3 + § 15.2 · Ida (1…N/2) en el orden de la tabla; vuelta (N/2+1…N) con las mismas jornadas, el mismo
 * orden, los lados invertidos y la MISMA semilla por cruce. Las jornadas de la vuelta siguen numerándose. */
export function calendarioTorneo(ids: readonly string[], semilla: number): EncuentroPlan[] {
  if (new Set(ids).size !== ids.length) throw new Error("Participantes repetidos");
  if (ids.length < T.participantes.min || ids.length > T.participantes.max) throw new Error(`Entre ${T.participantes.min} y ${T.participantes.max} participantes`);
  if (!Number.isInteger(semilla) || semilla < 0 || semilla > 0xffffffff) throw new Error("Semilla de torneo inválida");
  const tabla = TABLAS_BERGER[ids.length];
  if (!tabla) throw new Error(`Calendario sin tabla para ${ids.length} participantes (P2)`);
  const orden = ordenTorneo(ids, semilla), semillas = semillasCruce(ids, semilla);
  const ida: EncuentroPlan[] = [];
  tabla.forEach((jornada, j) => jornada.forEach(([a, b]) => {
    const local = orden[a - 1]!, visita = orden[b - 1]!;
    ida.push({ n: ida.length + 1, jornada: j + 1, cruce: ida.length + 1, vuelta: false, seed: semillas.get(claveCruce(local, visita))!, local, visita });
  }));
  const vuelta = ida.map(p => ({ ...p, n: p.n + ida.length, jornada: p.jornada + tabla.length, vuelta: true, local: p.visita, visita: p.local }));
  return [...ida, ...vuelta];
}

// ---------------------------------------------------------------------------------------------------
// Clasificación (§ 4.2): 3/1/0; puntos, DG, GF; liguilla entre empatados reaplicada a subgrupos; si persiste,
// posición compartida (1, 2, 2, 4). Solo cuentan los `encuentros`: anulados y pendientes no.
// ---------------------------------------------------------------------------------------------------
export interface FilaClasificacion { id: string; pos: number; empatada: boolean; pj: number; g: number; e: number; p: number; gf: number; gc: number; dg: number; pts: number }
type Base = Omit<FilaClasificacion, "pos" | "empatada">;
type Partido = Pick<EncuentroTorneo, "local" | "visita">;

function sumar(ids: readonly string[], partidos: readonly Partido[]): Map<string, Base> {
  const filas = new Map(ids.map(id => [id, { id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 }]));
  for (const m of partidos) {
    for (const [propio, rival] of [[m.local, m.visita], [m.visita, m.local]] as const) {
      const f = filas.get(propio.participante);
      if (!f) continue;
      f.pj++; f.gf += propio.goles; f.gc += rival.goles;
      if (propio.goles > rival.goles) { f.g++; f.pts += T.puntos.victoria; }
      else if (propio.goles === rival.goles) { f.e++; f.pts += T.puntos.empate; }
      else { f.p++; f.pts += T.puntos.derrota; }
    }
  }
  for (const f of filas.values()) f.dg = f.gf - f.gc;
  return filas;
}
/** Clases de equivalencia por (pts, DG, GF), de mejor a peor. */
function particionar(ids: readonly string[], st: Map<string, Base>): string[][] {
  const clave = (id: string) => { const f = st.get(id)!; return [f.pts, f.dg, f.gf]; };
  const ordenados = [...ids].sort((a, b) => { const x = clave(a), y = clave(b); return (y[0]! - x[0]!) || (y[1]! - x[1]!) || (y[2]! - x[2]!); });
  const clases: string[][] = [];
  for (const id of ordenados) {
    const ultima = clases.at(-1);
    if (ultima && clave(ultima[0]!).every((v, i) => v === clave(id)[i])) ultima.push(id); else clases.push([id]);
  }
  return clases;
}
/** Liguilla con SOLO los partidos entre los del grupo; se reaplica a cada subgrupo empatado y termina cuando
 * un grupo ya no se divide. */
function liguilla(grupo: string[], partidos: readonly Partido[]): string[][] {
  if (grupo.length < 2) return [grupo];
  const miembros = new Set(grupo);
  const clases = particionar(grupo, sumar(grupo, partidos.filter(m => miembros.has(m.local.participante) && miembros.has(m.visita.participante))));
  if (clases.length === 1) return [grupo];
  return clases.flatMap(c => liguilla(c, partidos));
}

export function clasificar(t: Pick<TorneoArchivado, "participantes" | "encuentros">): FilaClasificacion[] {
  const ids = t.participantes.map(p => p.id), nombre = new Map(t.participantes.map(p => [p.id, p.nombre]));
  const total = sumar(ids, t.encuentros);
  const clases = particionar(ids, total).flatMap(c => liguilla(c, t.encuentros));
  const filas: FilaClasificacion[] = [];
  let pos = 1;
  for (const clase of clases) {
    // Orden alfabético por nombre SOLO para mostrar dentro de una posición compartida.
    const vista = [...clase].sort((a, b) => nombre.get(a)!.localeCompare(nombre.get(b)!, "es") || a.localeCompare(b));
    for (const id of vista) filas.push({ ...total.get(id)!, pos, empatada: clase.length > 1 });
    pos += clase.length;
  }
  return filas;
}

/** Global de cada cruce (ida + vuelta, sin valor doble de los goles de visitante). */
export interface CruceTorneo { cruce: number; a: string; b: string; golesA: number; golesB: number; partidos: number[]; jugados: number; completo: boolean; ganador: string | null }
export function cruces(t: Pick<TorneoArchivado, "participantes" | "semilla" | "encuentros">): CruceTorneo[] {
  const plan = calendarioTorneo(t.participantes.map(p => p.id), t.semilla);
  const porN = new Map(t.encuentros.map(e => [e.n, e]));
  const lista = new Map<number, CruceTorneo>();
  for (const p of plan) {
    const c = lista.get(p.cruce) ?? { cruce: p.cruce, a: p.local, b: p.visita, golesA: 0, golesB: 0, partidos: [], jugados: 0, completo: false, ganador: null };
    c.partidos.push(p.n);
    const e = porN.get(p.n);
    if (e) {
      c.jugados++;
      for (const lado of LADOS_TORNEO) {
        if (e[lado].participante === c.a) c.golesA += e[lado].goles;
        else c.golesB += e[lado].goles;
      }
    }
    lista.set(p.cruce, c);
  }
  return [...lista.values()].map(c => {
    const completo = c.jugados === c.partidos.length;
    return { ...c, completo, ganador: completo && c.golesA !== c.golesB ? (c.golesA > c.golesB ? c.a : c.b) : null };
  });
}

/** Matriz local (filas) × visita (columnas), en el orden de la clasificación. */
export type CeldaMatriz = { tipo: "diagonal" } | { tipo: "pendiente"; n: number } | { tipo: "jugado"; n: number; gl: number; gv: number };
export function matrizResultados(t: Pick<TorneoArchivado, "participantes" | "semilla" | "encuentros">): { ids: string[]; celdas: CeldaMatriz[][] } {
  const ids = clasificar(t).map(f => f.id);
  const plan = calendarioTorneo(t.participantes.map(p => p.id), t.semilla);
  const porN = new Map(t.encuentros.map(e => [e.n, e]));
  const celdas = ids.map(local => ids.map((visita): CeldaMatriz => {
    if (local === visita) return { tipo: "diagonal" };
    const p = plan.find(x => x.local === local && x.visita === visita);
    if (!p) throw new Error("Pareja fuera del calendario");
    const e = porN.get(p.n);
    return e ? { tipo: "jugado", n: p.n, gl: e.local.goles, gv: e.visita.goles } : { tipo: "pendiente", n: p.n };
  }));
  return { ids, celdas };
}

// ---------------------------------------------------------------------------------------------------
// Prueba de signos ilustrativa (§ 4.4, § 15.7).
// ---------------------------------------------------------------------------------------------------
function combinaciones(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return r;
}
/** Binomial exacta con p = ½, bilateral, con tope 1; los empates se excluyen antes de llamarla. */
export function pSignosBilateral(ganados: number, perdidos: number): number {
  if (![ganados, perdidos].every(x => Number.isInteger(x) && x >= 0)) throw new Error("Conteos inválidos");
  const n = ganados + perdidos;
  if (n === 0) return 1;
  let cola = 0;
  for (let i = Math.max(ganados, perdidos); i <= n; i++) cola += combinaciones(n, i);
  return Math.min(1, 2 * cola / 2 ** n);
}
/** p mínima por modelo: ganar los n−1 cruces. */
export const pMinimaTorneo = (n: number) => pSignosBilateral(n - 1, 0);

const numero = (x: number, idioma: "es" | "en") => new Intl.NumberFormat(idioma, { maximumFractionDigits: 6, useGrouping: false }).format(x);
/** Frase de § 15.7 con la p calculada y TORNEO_ARENA.alfa (nunca una cifra escrita a mano). */
export function textoSignificacion(t: Pick<TorneoArchivado, "participantes">, idioma: "es" | "en"): string {
  const n = t.participantes.length, c = n - 1, p = pMinimaTorneo(n);
  if (p < T.alfa) throw new Error("La frase de significación no aplica: ganar todos los cruces alcanzaría el umbral");
  return idioma === "es"
    ? `En una prueba de signos ilustrativa —que supone cruces independientes y una probabilidad de ½ de ganar cada uno—, ni ganar los ${c} cruces alcanzaría p < ${numero(T.alfa, "es")} (p = ${numero(p, "es")}). La tabla describe este torneo; no ordena los modelos por calidad.`
    : `In an illustrative sign test — assuming independent pairings, each with a ½ chance of winning — even winning all ${c} pairings would not reach p < ${numero(T.alfa, "en")} (p = ${numero(p, "en")}). The table describes this tournament; it does not rank the models by quality.`;
}
export const TEXTO_PAREO = {
  es: "Cada modelo juega con los dos clubes y en los dos lados de cada cruce; eso reparte las condiciones entre los modelos, no elimina su efecto.",
  en: "Each model plays both clubs and both sides of every pairing; this spreads the conditions across models, it does not remove their effect.",
} as const;

// ---------------------------------------------------------------------------------------------------
// Micro-USD (§ 15.1). Precio en USD por millón de tokens ⇒ tokens × precio = micro-USD. Se trabaja con el
// precio en enteros (×10⁶) para que el redondeo al alza no dependa del error de coma flotante.
// ---------------------------------------------------------------------------------------------------
const precioEntero = (usdPorMillon: number) => Math.round(usdPorMillon * 1_000_000);
const techoMicro = (picoUsd: number) => Math.ceil(picoUsd / 1_000_000);
export interface UsoTokens { entrada: number; salida: number; cache: number }
type PrecioBase = Pick<PrecioTorneo, "entrada" | "salida" | "cache">;

/** `(entrada − caché) × entrada + caché × caché + salida × salida` (fórmula de `smoke-modelos.ts`), al alza. */
export function microCostoUso(uso: UsoTokens, precio: PrecioBase): number {
  const pe = precioEntero(precio.entrada), ps = precioEntero(precio.salida), pc = precio.cache === null ? pe : precioEntero(precio.cache);
  const cache = Math.min(uso.cache, uso.entrada);
  return techoMicro((uso.entrada - cache) * pe + cache * pc + uso.salida * ps);
}
/** Entrada máxima estimada de un intento HTTP: prompt máximo observado × factor de reintento, más la respuesta
 * anterior y el diagnóstico que reenvía el segundo intento del controlador. */
export const entradaMaxIntento = (promptMax: number) => Math.ceil(promptMax * SMOKE_MODELOS_ARENA.factorEntradaReintento) + ARENA.tokensOrdenes + T.reserva.margenCorreccionTokens;
export function microMaxIntento(precio: PrecioBase, promptMax: number): number {
  return techoMicro(entradaMaxIntento(promptMax) * precioEntero(precio.entrada) + ARENA.tokensOrdenes * precioEntero(precio.salida));
}
export const rondasPartido = (duracionS: number, intervaloS: number) => Math.ceil(duracionS / intervaloS);
/** Intentos HTTP potencialmente facturables de un lado en un partido (incluye los reintentos de transporte). */
export const intentosHttpMaxLado = (rondas: number) => rondas * ARENA.intentosOrdenes * (1 + T.http.reintentos);
export function reservaPartido(precios: Record<Lado, PrecioBase>, promptMax: number, rondas: number): number {
  return LADOS_TORNEO.reduce((s, lado) => s + intentosHttpMaxLado(rondas) * microMaxIntento(precios[lado], promptMax), 0);
}
/** Coste declarado de un lado: el `usage` conocido más el máximo de cada intento sin `usage`. */
export function costoLadoMicro(uso: UsoTokens & { sinUso: number }, precio: PrecioBase, promptMax: number): number {
  return microCostoUso(uso, precio) + uso.sinUso * microMaxIntento(precio, promptMax);
}
/** Típico por decisión: `E × entrada + S × salida`, al alza. */
export function microTipicoDecision(entradaMedia: number, salidaMedia: number, precio: PrecioBase): number {
  return Math.ceil(entradaMedia * precio.entrada + salidaMedia * precio.salida);
}
/** Gasto conocido del libro: por intento, el cierre si existe; una reserva sin cierre cuenta entera. */
export function gastoConocido(libro: readonly MovimientoGasto[]): number {
  const porIntento = new Map<string, { reserva: number | null; cierre: number | null }>();
  for (const m of libro) {
    const k = `${m.n}:${m.intento}`, x = porIntento.get(k) ?? { reserva: null, cierre: null };
    if (m.tipo === "reserva") x.reserva = m.microUsd; else x.cierre = m.microUsd;
    porIntento.set(k, x);
  }
  let total = 0;
  for (const x of porIntento.values()) total += x.cierre ?? x.reserva ?? 0;
  return total;
}
export const usdDeMicro = (micro: number) => micro / 1_000_000;

// ---------------------------------------------------------------------------------------------------
// Causa terminal de una decisión con respaldo (§ 16.2, exhaustiva). Solo cuenta el ÚLTIMO intento real.
// ---------------------------------------------------------------------------------------------------
export type CausaRespaldo = "modelo" | "infraestructura";
export function causaTerminal(motivo: DecisionArena["motivo"], intentos: readonly Pick<IntentoHttp, "naturaleza">[], esperas: readonly unknown[] = []): CausaRespaldo | null {
  if (motivo === "valida") return null;
  if (motivo === "orden_invalida") return "modelo";
  const ultimo: NaturalezaIntento | "ninguno" = intentos.at(-1)?.naturaleza ?? "ninguno";
  if (motivo === "error_controlador") return ultimo === "ok" ? "modelo" : "infraestructura";
  switch (ultimo) {
    case "ok": return "modelo";
    case "abortado": return intentos.some(i => i.naturaleza === "reintentable" || i.naturaleza === "red") || esperas.length > 0 ? "infraestructura" : "modelo";
    default: return "infraestructura"; // reintentable, red, http_otro o ninguno
  }
}

// ---------------------------------------------------------------------------------------------------
// Coherencia interna (página, CI y CLI) y validación completa del torneo (CLI y CI).
// ---------------------------------------------------------------------------------------------------
export function validarCoherencia(t: TorneoCualquiera): string[] {
  const errores: string[] = [];
  const ids = t.participantes.map(p => p.id);
  if (new Set(ids).size !== ids.length) errores.push("participantes repetidos");
  if (t.participantes.some(p => (p.llm === "ensayo") !== (t.tipo === "ensayo"))) errores.push("controladores de ensayo fuera de un torneo de ensayo (o al revés)");
  if (t.tipo === "real" && (t.duracionS !== T.duracionS || !(T.intervalosS as readonly number[]).includes(t.intervaloS))) errores.push("duración o intervalo fuera de lo admitido para un torneo real");
  if (t.tipo === "ensayo" && (t.duracionS < T.ensayoSegundos.min || t.duracionS > T.ensayoSegundos.max)) errores.push("duración de ensayo fuera de límites");
  const ns = [...t.encuentros.map(e => e.n), ...t.pendientes];
  if (new Set(ns).size !== ns.length) errores.push("partidos repetidos entre encuentros y pendientes");
  // Brief 062 § 4: la rama 062 compara con el plan del formato reconstruido (prefijo), no con el calendario completo.
  if (t.version === TORNEO_SITIO.version) errores.push(...coherencia062(t));
  else {
    let plan: EncuentroPlan[] = [];
    try { plan = calendarioTorneo(ids, t.semilla); } catch (error) { errores.push(`calendario: ${error instanceof Error ? error.message : "inválido"}`); }
    if (plan.length && (ns.length !== plan.length || !plan.every(p => ns.includes(p.n)))) errores.push("encuentros y pendientes no cubren el calendario");
    for (const e of t.encuentros) {
      const p = plan.find(x => x.n === e.n);
      if (plan.length && (!p || e.jornada !== p.jornada || e.cruce !== p.cruce || e.vuelta !== p.vuelta || e.seed !== p.seed || e.local.participante !== p.local || e.visita.participante !== p.visita)) errores.push(`P${e.n}: no coincide con calendarioTorneo`);
    }
    if ((t.estado === "completo") !== (t.pendientes.length === 0)) errores.push("estado incoherente con los pendientes");
  }
  for (const e of t.encuentros) {
    if (e.archivo !== archivoEncuentro(e.n)) errores.push(`P${e.n}: archivo ${e.archivo}`);
    for (const lado of LADOS_TORNEO) {
      const l = e[lado], d = l.declarado;
      if (!ids.includes(l.participante)) errores.push(`P${e.n}: participante ${l.participante} desconocido`);
      if (d.tiemposMs.length !== d.llamadas.length || d.tiemposMs.length !== d.motivos.length || d.tiemposMs.length < 1 || d.tiemposMs.length > rondasPartido(t.duracionS, t.intervaloS)) errores.push(`P${e.n}: decisiones ${lado} incoherentes`);
      if (d.sinUso !== d.intentos.filter(i => !i.conUso).length) errores.push(`P${e.n}: intentos sin uso ${lado} incoherentes`);
      if (d.intentos.some(i => i.ronda > d.tiemposMs.length) || d.esperas.some(x => x.ronda > d.tiemposMs.length)) errores.push(`P${e.n}: rondas de intentos ${lado} fuera del partido`);
    }
    if (e.local.participante === e.visita.participante) errores.push(`P${e.n}: un participante contra sí mismo`);
  }
  const huellas = t.encuentros.map(e => e.archivoSha256);
  if (new Set(huellas).size !== huellas.length) errores.push("huellas de archivo repetidas");
  const costos = t.encuentros.reduce((s, e) => s + e.local.declarado.costoMicroUsd + e.visita.declarado.costoMicroUsd, 0);
  // Los anulados y las reservas sin cierre suman al gasto conocido pero no están en `encuentros`.
  if (costos > t.gasto.conocidoMicroUsd) errores.push("el gasto conocido es menor que la suma de los partidos");
  return errores;
}

// ---------------------------------------------------------------------------------------------------
// resumen.md mínimo (§ 15.10 P1): tabla, matriz, partidos, gasto y frases de § 15.7, solo desde torneo.json.
// CI lo regenera y exige igualdad byte a byte.
// ---------------------------------------------------------------------------------------------------
const usd = (micro: number) => `${usdDeMicro(micro).toFixed(4)} USD`;
export function resumenTorneo(t: TorneoCualquiera): string {
  const nombre = new Map(t.participantes.map(p => [p.id, p.nombre]));
  const filas = clasificar(t), m = matrizResultados(t), porN = new Map(t.encuentros.map(e => [e.n, e]));
  const plan = calendarioTorneo(t.participantes.map(p => p.id), t.semilla);
  const l: string[] = [
    `# Torneo entre modelos · ${t.id}${t.tipo === "ensayo" ? " (ensayo · sin IA)" : ""}`, "",
    "Generado por `npm run arena:torneo` a partir de `torneo.json` (no editar a mano; CI lo regenera y lo compara byte a byte).", "",
    `- Inicio: ${t.inicioUtc} · fin: ${t.finUtc} · commit \`${t.commit}\``,
    `- Motor \`${t.motor.version}\` · reglas \`${t.motor.reglas}\` · ${t.duracionS} s por partido, intervalo ${t.intervaloS} s · semilla ${t.semilla}`,
    `- Estado: ${t.estado}${t.pendientes.length ? ` (${t.pendientes.length} partidos sin disputar: ${t.pendientes.map(n => `P${n}`).join(", ")})` : ""}`, "",
    "## Participantes", "", "| Modelo | Deployment | Modelo y versión | Controlador | Precio entrada / salida / caché (USD por 1M) |", "|---|---|---|---|---|",
    ...t.participantes.map(p => `| ${p.nombre} | \`${p.deployment}\` | ${p.modelo} ${p.version} | \`${p.controlador}\` | ${p.precio.entrada} / ${p.precio.salida} / ${p.precio.cache ?? "—"}${p.precio.estimadoDe ? ` († precio estimado con el de \`${p.precio.estimadoDe}\`)` : ""} |`),
    "", "## Clasificación", "", "| Pos | Modelo | PJ | G-E-P | Goles (GF:GC) | DG | Pts |", "|---|---|---|---|---|---|---|",
    ...filas.map(f => `| ${f.pos}${f.empatada ? "=" : ""} | ${nombre.get(f.id)} | ${f.pj} | ${f.g}-${f.e}-${f.p} | ${f.gf}:${f.gc} | ${f.dg > 0 ? "+" : ""}${f.dg} | ${f.pts} |`),
    "", "«=» indica posición compartida tras puntos, DG, GF y la liguilla entre los empatados.", "",
    "## Resultados (local en filas, visita en columnas)", "",
    `| Local \\ Visita | ${m.ids.map(id => nombre.get(id)).join(" | ")} |`, `|---|${m.ids.map(() => "---").join("|")}|`,
    ...m.ids.map((id, i) => `| ${nombre.get(id)} | ${m.celdas[i]!.map(c => c.tipo === "diagonal" ? "—" : c.tipo === "pendiente" ? `s/d (P${c.n})` : `${c.gl}–${c.gv} (P${c.n})`).join(" | ")} |`),
    "", "## Partidos por jornada", "",
    ...plan.map(p => {
      const e = porN.get(p.n);
      return e ? `- J${p.jornada} · P${p.n} · ${e.local.club} (${nombre.get(p.local)}) ${e.local.goles}–${e.visita.goles} ${e.visita.club} (${nombre.get(p.visita)}) · \`${e.archivo}\` · sha256 \`${e.archivoSha256.slice(0, 12)}…\``
        : `- J${p.jornada} · P${p.n} · ${nombre.get(p.local)} – ${nombre.get(p.visita)} · sin disputar`;
    }),
    "", "## Gasto (tope por estimación)", "",
    `- Gasto conocido†: ${usd(t.gasto.conocidoMicroUsd)} (usage informado por la API a precio de lista, más el máximo estimado de cada intento sin usage y de cada reserva sin cierre).`,
    `- Típico estimado: ${usd(t.gasto.tipicoMicroUsd)} · tope por estimación: ${usd(t.gasto.topeMicroUsd)} · reserva del partido más caro: ${usd(t.gasto.reservaMaxPartidoMicroUsd)}.`,
    "- † Declarado por el ejecutor; no se puede comprobar con el registro. El precio de lista no es la factura: el control real del gasto es la facturación de Azure.",
    "", "## Lo que esta tabla no demuestra", "",
    `- ${textoSignificacion(t, "es")}`, `- ${TEXTO_PAREO.es}`,
    "- Recalculado por el motor: goles, clubes, configuración, semilla y cifras del 049. Declarado por el ejecutor (con la huella SHA-256 del archivo íntegro): latencias, solicitudes, motivos, identidad del modelo por lado, tokens, coste y modelos devueltos.",
    "- Motor 2D sintético con parámetros por calibrar y reglas simplificadas; no es un partido reglamentario.", "",
  ];
  return l.join("\n");
}

// ---------------------------------------------------------------------------------------------------
// Métricas por participante (§ 4.3 con los rótulos de § 15.5): cada cifra lleva su fuente. «recalculada» = el
// motor la recalcula desde el registro (CI); «declarada» = la declara el ejecutor (con la huella del archivo).
// ---------------------------------------------------------------------------------------------------
export type FuenteMetrica = "recalculada" | "declarada";
export interface Metrica { valor: number | null; fuente: FuenteMetrica }
export interface MetricasParticipante {
  id: string; partidos: Metrica; decisiones: Metrica; validas: Metrica;
  respaldos: { orden_invalida: Metrica; error_controlador: Metrica; plazo_agotado: Metrica };
  solicitudes: Metrica; reintentosValidacion: Metrica;
  /** Segundos, sin las decisiones que esperaron por un reintento HTTP (429, 5xx o red); se cuentan aparte. */
  latenciaMedianaS: Metrica; latenciaMaxS: Metrica; decisionesConReintentoHttp: Metrica;
  tokensEntrada: Metrica; tokensSalida: Metrica; tokensCache: Metrica; costoMicroUsd: Metrica;
  posesionMediaPct: Metrica; rematesPorPartido: Metrica; rematesDirectosPorPartido: Metrica; precisionPasePct: Metrica; recuperacionesPorPartido: Metrica;
}
/** Rondas de un lado cuya decisión esperó por la infraestructura: algún intento reintentable o de red, o una espera. */
export function rondasConReintentoHttp(d: Pick<DeclaradoLado, "intentos" | "esperas">): number[] {
  const rondas = new Set([...d.intentos.filter(i => i.naturaleza === "reintentable" || i.naturaleza === "red").map(i => i.ronda), ...d.esperas.map(e => e.ronda)]);
  return [...rondas].sort((a, b) => a - b);
}
const medianaDe = (xs: readonly number[]) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b), m = Math.floor(v.length / 2); return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2; };
export function metricasParticipante(t: Pick<TorneoArchivado, "encuentros">, id: string): MetricasParticipante {
  const lados = t.encuentros.flatMap(e => LADOS_TORNEO.filter(l => e[l].participante === id).map(l => e[l]));
  const d = lados.map(l => l.declarado), n = lados.length;
  const suma = (f: (x: DeclaradoLado) => number) => d.reduce((s, x) => s + f(x), 0);
  const dec = (valor: number | null): Metrica => ({ valor, fuente: "declarada" }), rec = (valor: number | null): Metrica => ({ valor, fuente: "recalculada" });
  const decisiones = suma(x => x.motivos.length), solicitudes = suma(x => x.llamadas.reduce((a, b) => a + b, 0));
  const tiempos = d.flatMap(x => { const excluidas = new Set(rondasConReintentoHttp(x)); return x.tiemposMs.filter((_, i) => !excluidas.has(i + 1)); });
  const cifras = lados.map(l => l.cifras);
  const media = (f: (c: CifrasLado) => number | null) => { const v = cifras.map(f); return !n || v.some(x => x === null) ? null : (v as number[]).reduce((a, b) => a + b, 0) / n; };
  const completados = cifras.map(c => c.pasesCompletados), intentados = cifras.map(c => c.pasesIntentados);
  const sumaIntentados = intentados.every(x => x !== null) ? (intentados as number[]).reduce((a, b) => a + b, 0) : null;
  const precision = !n || completados.some(x => x === null) || sumaIntentados === null || sumaIntentados === 0 ? null : 100 * (completados as number[]).reduce((a, b) => a + b, 0) / sumaIntentados;
  const motivo = (m: string) => dec(suma(x => x.motivos.filter(y => y === m).length));
  return {
    id, partidos: rec(n), decisiones: dec(decisiones), validas: motivo("valida"),
    respaldos: { orden_invalida: motivo("orden_invalida"), error_controlador: motivo("error_controlador"), plazo_agotado: motivo("plazo_agotado") },
    solicitudes: dec(solicitudes), reintentosValidacion: dec(Math.max(0, solicitudes - decisiones)),
    latenciaMedianaS: dec(tiempos.length ? medianaDe(tiempos)! / 1000 : null), latenciaMaxS: dec(tiempos.length ? Math.max(...tiempos) / 1000 : null),
    decisionesConReintentoHttp: dec(suma(x => rondasConReintentoHttp(x).length)),
    tokensEntrada: dec(suma(x => x.entrada)), tokensSalida: dec(suma(x => x.salida)), tokensCache: dec(suma(x => x.cache)), costoMicroUsd: dec(suma(x => x.costoMicroUsd)),
    posesionMediaPct: rec(media(c => c.posesionPct)), rematesPorPartido: rec(media(c => c.remates)), rematesDirectosPorPartido: rec(media(c => c.rematesDirectos)),
    precisionPasePct: rec(precision), recuperacionesPorPartido: rec(media(c => c.recuperaciones)),
  };
}
