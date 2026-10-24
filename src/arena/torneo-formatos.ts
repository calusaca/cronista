// Brief 062 v1.3 · Formatos del torneo lanzable desde el sitio: plan por formato (§ 3.2), coherencia de la rama 062
// (§ 4), metadatos por encuentro (§ 17.3), estimación por formato (§ 5 con las cifras de § 17.5), duración mostrada
// (§ 5.4), frase de significación (§ 3.5) y el día UTC que fija id y semilla (D2, § 17.2).
//
// Puro y sin Node: lo importan el servidor, la validación de CI y el cliente. Importa de `torneo.ts`, que a su vez
// importa `coherencia062` de aquí: el ciclo es seguro porque este módulo SOLO usa lo de `torneo.ts` dentro de
// funciones (nunca al evaluarse).
//
// P1-a: la liga. P1-b: grupos + eliminatoria (§ 3 y § 17.4: sorteo, plan intercalado, orden de grupo, cuadro,
// desempates y semillas de las llaves). Los dos formatos están en FORMATOS_DISPONIBLES.
import { TORNEO_ARENA as T, TORNEO_SITIO as S } from "../sim/limites";
import { prngDerivado } from "../sim/prng";
import {
  calendarioTorneo, claveCruce, clasificar, esquemaEncuentro062, LADOS_TORNEO, microTipicoDecision, pSignosBilateral, reservaPartido, rondasPartido, semillasCruce,
  TABLAS_BERGER, textoSignificacion, type FilaClasificacion,
  type EncuentroPlan, type EncuentroTorneo, type EncuentroTorneo062, type FASES_ENCUENTRO, type FORMATOS_TORNEO, type ParticipanteTorneo, type Torneo062,
} from "./torneo";

export type FormatoTorneo = (typeof FORMATOS_TORNEO)[number];
export type FaseEncuentro = (typeof FASES_ENCUENTRO)[number];
export interface EncuentroPlan062 extends EncuentroPlan { fase: FaseEncuentro; desempate: boolean }
export type CriterioPase = "resultado" | "desempate" | "remates_directos" | "remates" | "coeficiente" | "sorteo";
type PartidoResultado = Pick<EncuentroTorneo062, "n" | "local" | "visita">;
export interface ResultadosPlan { encuentros: readonly PartidoResultado[]; pendientes: readonly number[] }
export type FaseLlave = "semifinal-1" | "semifinal-2" | "final";
export interface DetallePase { criterio: CriterioPase; a: number[]; b: number[] }
export interface Llave { fase: FaseLlave; local: string; visita: string; partidos: number[]; ganador: string | null; criterio: CriterioPase | null; detalle: DetallePase | null }
export type Grupo = "A" | "B";

/** Formatos que este servidor admite lanzar (P1-a la liga; P1-b añade grupos + eliminatoria). */
export const FORMATOS_DISPONIBLES: readonly FormatoTorneo[] = ["liga", "grupos"];

// ---------------------------------------------------------------------------------------------------
// § 3.2 · Plan: todos los partidos que los resultados ya determinan, en orden de ejecución, numerados 1…k.
// ---------------------------------------------------------------------------------------------------
export function planTorneo(formato: FormatoTorneo, ids: readonly string[], semilla: number, resultados: ResultadosPlan): EncuentroPlan062[] {
  if (formato === "liga") return calendarioTorneo(ids, semilla).map(p => ({ ...p, fase: "liga" as const, desempate: false }));
  return planGruposYLlaves(ids, semilla, resultados).plan;
}

/** El primer partido del plan que no está jugado ni pendiente, o null. */
export function siguientePartido(formato: FormatoTorneo, ids: readonly string[], semilla: number, resultados: ResultadosPlan): EncuentroPlan062 | null {
  const hechos = new Set([...resultados.encuentros.map(e => e.n), ...resultados.pendientes]);
  return planTorneo(formato, ids, semilla, resultados).find(p => !hechos.has(p.n)) ?? null;
}

/** Partidos de un torneo del sitio, calculados desde TORNEO_SITIO y TORNEO_ARENA (nunca una cifra escrita a mano). */
export function partidosFormato(formato: FormatoTorneo): { min: number; max: number } {
  if (formato === "liga") { const n = T.participantes.max; return { min: n * (n - 1), max: n * (n - 1) }; }
  const g = S.formatos.grupos, deGrupo = g.grupos * g.porGrupo * (g.porGrupo - 1), llaves = g.grupos * g.pasanPorGrupo - 1;
  return { min: deGrupo + llaves, max: deGrupo + llaves * (1 + g.desempatesPorLlave) };
}

// ---------------------------------------------------------------------------------------------------
// § 2 D1 + § 17.4 · Sorteo y barajado canónicos (uint32 y Fisher–Yates descendente con un único prngDerivado).
// ---------------------------------------------------------------------------------------------------
export const u32 = (semilla: number, clave: string) => prngDerivado(semilla, clave).int(0, 0xffffffff);
/** Ordena por id con comparación de código (no por el orden de entrada) y baraja; el primero es el mejor. */
export function barajar(xs: readonly string[], semilla: number, clave: string): string[] {
  const orden = [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), rng = prngDerivado(semilla, clave);
  for (let i = orden.length - 1; i > 0; i--) { const j = rng.int(0, i); [orden[i], orden[j]] = [orden[j]!, orden[i]!]; }
  return orden;
}
/** D1 · Sin cabezas de serie: A = posiciones 0–2 y B = 3–5 del barajado (índices Berger 1–3). */
export function sorteoGrupos(ids: readonly string[], semilla: number): Record<Grupo, string[]> {
  const g = S.formatos.grupos;
  if (new Set(ids).size !== ids.length || ids.length !== g.grupos * g.porGrupo) throw new Error(`El formato grupos necesita ${g.grupos * g.porGrupo} participantes distintos`);
  const b = barajar(ids, semilla, "torneo-062:grupos");
  return { A: b.slice(0, g.porGrupo), B: b.slice(g.porGrupo) };
}
/** § 17.4 · Sorteo de un subconjunto: la clave lleva el subconjunto, así que no depende del orden de llamada. */
export const sorteoSubconjunto = (sub: readonly string[], semilla: number, ambito: string) => barajar(sub, semilla, `torneo-062:sorteo:${ambito}:${[...sub].sort().join("|")}`);

/** D4 · Fase de grupos intercalada (en la jornada j, primero el partido de A y después el de B); la vuelta invierte
 * los lados con la MISMA semilla, que sale de `semillasCruce` sobre los 6 (única en el torneo, D8). */
export function planGrupos(ids: readonly string[], semilla: number): EncuentroPlan062[] {
  const grupos = sorteoGrupos(ids, semilla), semillas = semillasCruce(ids, semilla), tabla = TABLAS_BERGER[S.formatos.grupos.porGrupo]!;
  const ida: EncuentroPlan062[] = [];
  tabla.forEach((jornada, j) => (["A", "B"] as const).forEach((G, gi) => jornada.forEach(([x, y]) => {
    const local = grupos[G][x - 1]!, visita = grupos[G][y - 1]!;
    ida.push({ n: ida.length + 1, jornada: j + 1, cruce: gi * tabla.length + j + 1, vuelta: false, seed: semillas.get(claveCruce(local, visita))!, local, visita, fase: `grupo-${G}`, desempate: false });
  })));
  return [...ida, ...ida.map(p => ({ ...p, n: p.n + ida.length, jornada: p.jornada + tabla.length, vuelta: true, local: p.visita, visita: p.local }))];
}

type TorneoGrupos = { participantes: readonly { id: string; nombre: string }[]; semilla: number; encuentros: readonly (PartidoResultado & { fase?: FaseEncuentro })[] };
const deFase = (t: TorneoGrupos, fase: FaseEncuentro) => {
  const plan = planGrupos(t.participantes.map(p => p.id), t.semilla), fases = new Map(plan.map(p => [p.n, p.fase]));
  return t.encuentros.filter(e => (e.fase ?? fases.get(e.n)) === fase);
};
/** § 3.3 · `clasificar` (059) con SOLO los partidos de su grupo. */
export function clasificarGrupo(t: TorneoGrupos, G: Grupo): FilaClasificacion[] {
  const miembros = new Set(sorteoGrupos(t.participantes.map(p => p.id), t.semilla)[G]);
  return clasificar({ participantes: t.participantes.filter(p => miembros.has(p.id)) as never, encuentros: deFase(t, `grupo-${G}`) as never });
}
type ClaveCifra = "rematesDirectos" | "remates";
/** Suma de una cifra de `id` en esos partidos (del lado en que jugó); null si alguna es null (el criterio no aplica). */
function sumaCifra(partidos: readonly PartidoResultado[], id: string, clave: ClaveCifra): number | null {
  let suma = 0;
  for (const m of partidos) for (const lado of LADOS_TORNEO) if (m[lado].participante === id) { const v = m[lado].cifras[clave]; if (v === null) return null; suma += v; }
  return suma;
}
/** Suma de una cifra de `id` en los partidos de su grupo (null si alguna es null), para el texto del criterio. */
export const cifraEnGrupo = (t: TorneoGrupos, G: Grupo, id: string, clave: ClaveCifra) => sumaCifra(deFase(t, `grupo-${G}`), id, clave);
/** El grupo jugó todos sus partidos (ida y vuelta). */
export const grupoCompleto = (t: TorneoGrupos, G: Grupo) => deFase(t, `grupo-${G}`).length === S.formatos.grupos.porGrupo * (S.formatos.grupos.porGrupo - 1);
/** § 17.4 · Orden estricto de un grupo por refinamiento de particiones: clases de clasificarGrupo; después remates
 * directos, remates y sorteo del subconjunto. Criterio por posición: el ÚLTIMO que la separó. */
export function ordenGrupo(t: TorneoGrupos, G: Grupo): { id: string; criterio: CriterioPase }[] {
  const filas = clasificarGrupo(t, G), partidos = deFase(t, `grupo-${G}`), clases: string[][] = [];
  for (const f of filas) { const ultima = clases.at(-1); if (ultima && filas.find(x => x.id === ultima[0])!.pos === f.pos) ultima.push(f.id); else clases.push([f.id]); }
  const criterios: [CriterioPase, ClaveCifra][] = [["remates_directos", "rematesDirectos"], ["remates", "remates"]];
  const resolver = (clase: string[], k: number, previo: CriterioPase): { id: string; criterio: CriterioPase }[] => {
    if (clase.length === 1) return [{ id: clase[0]!, criterio: previo }];
    if (k === criterios.length) return sorteoSubconjunto(clase, t.semilla, `grupo-${G}`).map(id => ({ id, criterio: "sorteo" as const }));
    const [nombre, clave] = criterios[k]!, valores = new Map(clase.map(id => [id, sumaCifra(partidos, id, clave)]));
    if ([...valores.values()].some(v => v === null)) return resolver(clase, k + 1, previo);
    const distintos = [...new Set(valores.values() as Iterable<number>)].sort((a, b) => b - a);
    if (distintos.length === 1) return resolver(clase, k + 1, previo);
    return distintos.flatMap(v => resolver(clase.filter(id => valores.get(id) === v), k + 1, nombre));
  };
  return clases.flatMap(c => resolver(c, 0, "resultado"));
}
/** § 17.4 · Ganador de una llave: el partido, su desempate (lados invertidos) y, si ambos empatan, sobre los DOS
 * partidos: remates directos, remates, coeficiente de grupo (pts, DG, GF) y sorteo por semilla. */
export function resolverLlave(t: TorneoGrupos, fase: FaseLlave, local: string, visita: string, partidos: readonly PartidoResultado[]): Pick<Llave, "ganador" | "criterio" | "detalle"> {
  const golesDe = (m: PartidoResultado, id: string) => (m.local.participante === id ? m.local.goles : m.visita.goles);
  const decide = (m: PartidoResultado) => golesDe(m, local) === golesDe(m, visita) ? null : golesDe(m, local) > golesDe(m, visita) ? local : visita;
  const [m1, m2] = partidos;
  if (!m1) return { ganador: null, criterio: null, detalle: null };
  if (decide(m1)) return { ganador: decide(m1), criterio: "resultado", detalle: null };
  if (!m2) return { ganador: null, criterio: null, detalle: null };
  if (decide(m2)) return { ganador: decide(m2), criterio: "desempate", detalle: null };
  for (const [criterio, clave] of [["remates_directos", "rematesDirectos"], ["remates", "remates"]] as const) {
    const a = sumaCifra([m1, m2], local, clave), b = sumaCifra([m1, m2], visita, clave);
    if (a === null || b === null || a === b) continue;
    return { ganador: a > b ? local : visita, criterio, detalle: { criterio, a: [a], b: [b] } };
  }
  const fila = (id: string) => { for (const G of ["A", "B"] as const) { const f = clasificarGrupo(t, G).find(x => x.id === id); if (f) return [f.pts, f.dg, f.gf]; } throw new Error(`${id} fuera de los grupos`); };
  const ca = fila(local), cb = fila(visita), i = ca.findIndex((v, k) => v !== cb[k]);
  if (i >= 0) return { ganador: ca[i]! > cb[i]! ? local : visita, criterio: "coeficiente", detalle: { criterio: "coeficiente", a: ca, b: cb } };
  return { ganador: sorteoSubconjunto([local, visita], t.semilla, fase)[0]!, criterio: "sorteo", detalle: null };
}
/** § 3.2 + D7 + D8 · Plan completo determinado por los resultados, y el cuadro. */
export function planGruposYLlaves(ids: readonly string[], semilla: number, resultados: ResultadosPlan): { plan: EncuentroPlan062[]; llaves: Llave[] } {
  const plan = planGrupos(ids, semilla), porN = new Map(resultados.encuentros.map(e => [e.n, e])), pendientes = new Set(resultados.pendientes);
  const llaves: Llave[] = [];
  if (plan.some(p => !porN.has(p.n))) return { plan, llaves };
  const t: TorneoGrupos = { participantes: ids.map(id => ({ id, nombre: id })), semilla, encuentros: plan.map(p => ({ ...porN.get(p.n)!, fase: p.fase })) };
  const A = ordenGrupo(t, "A").map(x => x.id), B = ordenGrupo(t, "B").map(x => x.id), usadas = new Set(plan.map(p => p.seed));
  const semillaLlave = (fase: FaseLlave, a: string, b: string) => {
    for (let k = 0; ; k++) { const s = u32(semilla, `torneo-062:ko:${fase}:${claveCruce(a, b)}${k ? `:${k}` : ""}`); if (!usadas.has(s)) { usadas.add(s); return s; } }
  };
  const jugarLlave = (fase: FaseLlave, local: string, visita: string, jornada: number, cruce: number): boolean => {
    const seed = semillaLlave(fase, local, visita), base = { jornada, cruce, vuelta: false, seed, fase };
    const p1: EncuentroPlan062 = { ...base, n: plan.length + 1, local, visita, desempate: false };
    plan.push(p1);
    const llave: Llave = { fase, local, visita, partidos: [p1.n], ganador: null, criterio: null, detalle: null };
    llaves.push(llave);
    const m1 = porN.get(p1.n);
    if (!m1 || pendientes.has(p1.n)) return false;
    const jugados = [m1];
    if (m1.local.goles === m1.visita.goles) {
      const p2: EncuentroPlan062 = { ...base, n: plan.length + 1, local: visita, visita: local, desempate: true };
      plan.push(p2); llave.partidos.push(p2.n);
      const m2 = porN.get(p2.n);
      if (!m2 || pendientes.has(p2.n)) return false;
      jugados.push(m2);
    }
    Object.assign(llave, resolverLlave(t, fase, local, visita, jugados));
    return true;
  };
  const jornadaKo = (TABLAS_BERGER[S.formatos.grupos.porGrupo]!.length) * 2 + 1, cruceKo = plan.length / 2 + 1;
  if (!jugarLlave("semifinal-1", A[0]!, B[1]!, jornadaKo, cruceKo)) return { plan, llaves };
  if (!jugarLlave("semifinal-2", B[0]!, A[1]!, jornadaKo, cruceKo + 1)) return { plan, llaves };
  jugarLlave("final", llaves[0]!.ganador!, llaves[1]!.ganador!, jornadaKo + 1, cruceKo + 2);
  return { plan, llaves };
}
/** § 3.4 · Cuadro de un torneo de grupos (las llaves que los resultados ya determinan) y su campeón. */
export const cuadro = (t: { participantes: readonly { id: string }[]; semilla: number } & ResultadosPlan) => planGruposYLlaves(t.participantes.map(p => p.id), t.semilla, t).llaves;
export function campeon(t: { participantes: readonly { id: string }[]; semilla: number } & ResultadosPlan): string | null {
  return cuadro(t).find(l => l.fase === "final")?.ganador ?? null;
}

// ---------------------------------------------------------------------------------------------------
// § 17.3 · Metadatos de un encuentro 062 frente a su plan (puro). Devuelve la base 059, que es la que valida
// `validarEncuentro` (el esquema estricto 059 sigue rechazando `fase` y `desempate`).
// ---------------------------------------------------------------------------------------------------
export function validarMetadatos062(e: unknown, plan: EncuentroPlan062): EncuentroTorneo {
  const v = esquemaEncuentro062.parse(e);
  if (v.n !== plan.n || v.fase !== plan.fase || v.desempate !== plan.desempate || v.jornada !== plan.jornada || v.cruce !== plan.cruce || v.vuelta !== plan.vuelta
    || v.seed !== plan.seed || v.local.participante !== plan.local || v.visita.participante !== plan.visita) throw new Error(`P${v.n}: fase, desempate, jornada, cruce, vuelta, semilla o lados distintos del plan`);
  const { fase: _f, desempate: _d, ...base } = v;
  return base;
}

// ---------------------------------------------------------------------------------------------------
// § 4 · Coherencia de la rama 062 (la llama `validarCoherencia`). Lo común con el 059 (participantes, ensayo,
// duración, declarado por lado, huellas y gasto) se comprueba allí.
// ---------------------------------------------------------------------------------------------------
const MOTIVOS_POR_ESTADO: Record<Torneo062["estado"], readonly (Torneo062["motivoFin"])[]> = {
  completo: [null], en_curso: [null], incompleto: ["tope", "infraestructura", "plazo"], cancelado: ["cancelado"], interrumpido: ["reinicio", "almacen"],
};
export const PREFIJO_PRUEBA = `${S.prefijoId}prueba-`;

export function coherencia062(t: Torneo062): string[] {
  const errores: string[] = [];
  const ids = t.participantes.map(p => p.id);
  let plan: EncuentroPlan062[] = [];
  try { plan = planTorneo(t.formato, ids, t.semilla, t); } catch (error) { errores.push(`plan: ${error instanceof Error ? error.message : "inválido"}`); }
  const ns = [...t.encuentros.map(e => e.n), ...t.pendientes].sort((a, b) => a - b);
  // Prefijo por n del plan reconstruido con esos mismos resultados.
  if (ns.some((n, i) => n !== i + 1)) errores.push("encuentros y pendientes no son un prefijo del plan");
  if (plan.length && ns.length > plan.length) errores.push("más partidos que el plan");
  for (const e of t.encuentros) {
    const p = plan[e.n - 1];
    if (plan.length && (!p || e.fase !== p.fase || e.desempate !== p.desempate || e.jornada !== p.jornada || e.cruce !== p.cruce || e.vuelta !== p.vuelta || e.seed !== p.seed
      || e.local.participante !== p.local || e.visita.participante !== p.visita)) errores.push(`P${e.n}: no coincide con planTorneo`);
  }
  let siguiente: EncuentroPlan062 | null = null;
  if (plan.length) siguiente = plan.find(p => !ns.includes(p.n)) ?? null;
  if (!MOTIVOS_POR_ESTADO[t.estado].includes(t.motivoFin)) errores.push(`motivoFin ${t.motivoFin ?? "null"} incoherente con el estado ${t.estado}`);
  if (t.estado === "completo" && (t.pendientes.length || siguiente)) errores.push("completo con pendientes o con partidos por jugar");
  if ((t.estado === "en_curso") !== (t.finUtc === null)) errores.push("finUtc incoherente con el estado");
  if (t.enCurso && t.estado !== "en_curso") errores.push("enCurso con un estado final");
  if (t.enCurso && plan.length && (!siguiente || siguiente.n !== t.enCurso.n || siguiente.local !== t.enCurso.local || siguiente.visita !== t.enCurso.visita)) errores.push("enCurso distinto del siguiente partido del plan");
  if (t.estado === "en_curso" && plan.length && !siguiente && t.enCurso) errores.push("en_curso sin partidos por jugar");
  if ((t.origen === "sitio") !== t.id.startsWith(S.prefijoId)) errores.push("origen y prefijo del id incoherentes");
  if ((t.lanzamiento === "prueba") !== t.id.startsWith(PREFIJO_PRUEBA)) errores.push("lanzamiento de prueba y id incoherentes");
  if (t.tipo === "real") {
    if (t.participantes.length !== T.participantes.max) errores.push(`un torneo real del 062 tiene ${T.participantes.max} participantes`);
    const rango = partidosFormato(t.formato);
    if (t.estado === "completo" && (t.encuentros.length < rango.min || t.encuentros.length > rango.max)) errores.push("número de encuentros fuera del formato");
  }
  return errores;
}

// ---------------------------------------------------------------------------------------------------
// § 5 + § 17.5 · Estimación por formato desde `torneo-sitio-entradas.json` (nunca cifras escritas a mano).
// ---------------------------------------------------------------------------------------------------
export interface MedidaEntrada { id: string; entradaMedia: number; salidaMedia: number; medicionPropia: boolean; medianaMs: number | null; latenciaPropia: boolean }
export interface EntradasSitio {
  version: string;
  /** Torneo del que salen los participantes («los mismos modelos»). */
  torneoOrigen: string;
  participantes: ParticipanteTorneo[];
  promptMax: { tokens: number; archivo: string; partido: string };
  medidas: MedidaEntrada[];
}
export interface FichaFormato {
  /** P1-a: false para grupos (el panel lo muestra deshabilitado, «Disponible pronto»). */
  disponible: boolean;
  partidos: { min: number; max: number };
  /** Típico sin desempates (min–max según quién pase) y el máximo con todos los desempates. En la liga, los tres iguales. */
  tipicoMicroUsd: { min: number; max: number; maxConDesempates: number };
  topeMicroUsd: number;
  reservaMaxPartidoMicroUsd: number;
  duracionMin: { min: number; max: number };
}
/** µUSD típicos de una decisión de cada participante (la misma fórmula que `estimarTorneo`). */
export function tipicoPorDecision(entradas: Pick<EntradasSitio, "participantes" | "medidas">): Map<string, number> {
  return new Map(entradas.participantes.map(p => {
    const m = entradas.medidas.find(x => x.id === p.id);
    if (!m) throw new Error(`Sin medidas para ${p.id}`);
    return [p.id, microTipicoDecision(m.entradaMedia, m.salidaMedia, p.precio)];
  }));
}
export const topeFormatoMicroUsd = (formato: FormatoTorneo) => Math.floor(S.formatos[formato].topeUsd * 1_000_000);
export function duracionMinFormato(formato: FormatoTorneo, duracionS: number = T.duracionS): { min: number; max: number } {
  const porPartido = duracionS + T.pausaEntrePartidosMs / 1000 + S.margenValidacionS, p = partidosFormato(formato);
  return { min: Math.round(p.min * porPartido / 60), max: Math.round(p.max * porPartido / 60) };
}

export function estimarFormato(formato: FormatoTorneo, entradas: EntradasSitio, duracionS: number = T.duracionS, intervaloS: number = S.intervaloS): FichaFormato {
  const rondas = rondasPartido(duracionS, intervaloS), por = tipicoPorDecision(entradas);
  const valores = [...por.values()].sort((a, b) => a - b), suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const n = entradas.participantes.length, ids = entradas.participantes.map(p => p.id);
  const precio = (id: string) => entradas.participantes.find(p => p.id === id)!.precio;
  let reservaMax = 0;
  for (const a of ids) for (const b of ids) if (a !== b) reservaMax = Math.max(reservaMax, reservaPartido({ local: precio(a), visita: precio(b) }, entradas.promptMax.tokens, rondas));
  let tipico: FichaFormato["tipicoMicroUsd"];
  if (formato === "liga") {
    const t = suma(valores) * 2 * (n - 1) * rondas;
    tipico = { min: t, max: t, maxConDesempates: t };
  } else {
    const g = S.formatos.grupos;
    // Fase de grupos: 2 × (porGrupo − 1) partidos por modelo, `rondas` decisiones en cada uno.
    const grupos = suma(valores) * 2 * (g.porGrupo - 1) * rondas;
    const enLlaves = g.grupos * g.pasanPorGrupo;
    // Llaves: semifinales con 4 participantes y final con 2; quién pasa no se sabe antes del sorteo.
    const llavesMin = rondas * (suma(valores.slice(0, enLlaves)) + suma(valores.slice(0, enLlaves / 2)));
    const llavesMax = rondas * (suma(valores.slice(-enLlaves)) + suma(valores.slice(-enLlaves / 2)));
    // Peor caso de desempates: se repiten las tres llaves con los mismos pares.
    tipico = { min: grupos + llavesMin, max: grupos + llavesMax, maxConDesempates: grupos + llavesMax * (1 + g.desempatesPorLlave) };
  }
  return { disponible: FORMATOS_DISPONIBLES.includes(formato), partidos: partidosFormato(formato), tipicoMicroUsd: tipico, topeMicroUsd: topeFormatoMicroUsd(formato),
    reservaMaxPartidoMicroUsd: reservaMax, duracionMin: duracionMinFormato(formato, duracionS) };
}
/** µUSD típicos del partido más caro (dos lados, `rondas` decisiones cada uno): el «último partido» de la G9. */
export function tipicoPartidoMaxMicroUsd(entradas: EntradasSitio, duracionS: number = T.duracionS, intervaloS: number = S.intervaloS): number {
  const valores = [...tipicoPorDecision(entradas).values()].sort((a, b) => b - a);
  return rondasPartido(duracionS, intervaloS) * (valores[0]! + valores[1]!);
}

// ---------------------------------------------------------------------------------------------------
// § 3.5 · Frase de significación por formato, con p calculada (nunca escrita a mano).
// ---------------------------------------------------------------------------------------------------
const numero = (x: number, idioma: "es" | "en") => new Intl.NumberFormat(idioma, { maximumFractionDigits: 6, useGrouping: false }).format(x);
export function textoSignificacionFormato(t: { formato: FormatoTorneo; participantes: readonly ParticipanteTorneo[] }, idioma: "es" | "en"): string {
  if (t.formato === "liga") return textoSignificacion({ participantes: [...t.participantes] }, idioma);
  const g = S.formatos.grupos, c = (g.porGrupo - 1) + Math.log2(g.grupos * g.pasanPorGrupo), p = pSignosBilateral(c, 0);
  if (p < T.alfa) throw new Error("La frase de significación no aplica: ganar todas las llaves alcanzaría el umbral");
  return idioma === "es"
    ? `En una prueba de signos ilustrativa —que supone cruces independientes y una probabilidad de ½ de ganar cada uno—, ni ganar sus ${c} cruces y llaves alcanzaría p < ${numero(T.alfa, "es")} (p = ${numero(p, "es")}). Este cuadro describe este torneo; no ordena los modelos por calidad.`
    : `In an illustrative sign test — assuming independent ties, each with a ½ chance of winning — even winning all ${c} pairings and ties would not reach p < ${numero(T.alfa, "en")} (p = ${numero(p, "en")}). This bracket describes this tournament; it does not rank the models by quality.`;
}

// ---------------------------------------------------------------------------------------------------
// D2 + § 17.2 · Día UTC: una sola captura del reloj fija el día, el id y la semilla.
// ---------------------------------------------------------------------------------------------------
export const diaUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const idDelDia = (dia: string) => `${S.prefijoId}${dia}`;
export const semillaDelDia = (dia: string) => Number(dia.replace(/-/g, ""));
export const ID_SITIO = new RegExp(`^${S.prefijoId}(\\d{4}-\\d{2}-\\d{2}|prueba-[0-9a-f]{12})$`);
/** Próxima medianoche UTC (cuando se abre el cupo siguiente). */
export function proximoCupoUtc(ms: number): string {
  const d = new Date(ms); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}
