// Brief 058 · Bloque B · Antesala hablada antes del saque (v1.1–v1.3). Puro y compartido por el cliente y la
// ruta /relato: deriva SOLO de config + inicial del registro y de la asignación pública de la sesión. Sin DOM,
// sin red y sin LLM. Las cifras viven en ANTESALA_ARENA (limites.ts); el máximo en vuelo se lee de VOZ_BUFFER.
//
// Contenido: guion (nueve clips de una sola voz), escaleras por clip y por guion, hechos por clip e idioma
// (v1.3), comprobación por reconstrucción exacta, regla del controlador verificado (v1.1 § 8 b) y la lógica
// pura del reproductor: activarAntesala (v1.1 § 3), pasoAntesala (§ 4.6 y v1.1 §§ 1, 2, 4) y elegirSolicitud
// (v1.1 § 5).
import type { Oracion } from "../cadena/tipos";
import type { HechoVerificable } from "../cadena/verificador";
import { ANTESALA_ARENA, MESA_ARENA, PREVIA_ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { VOZ_BUFFER } from "./buffer";
import { estructuraBase, puestos } from "./catalogo";
import { apellidoCorto, formacionHablada, mayusculaInicial } from "./previa";
import type { AsignacionModelos, EvidenciaMesa, IntervencionArena, TurnoMesa } from "./protocolo";
import type { FormacionArena, JugadorArena, RegistroArena } from "./tipos";
import { estimarDuracionS } from "./turnos";

export type Idioma = "es" | "en";
export type BloqueAntesala = "apertura" | "cabecera" | "atras" | "medio" | "arriba";
export type BloqueLinea = "atras" | "medio" | "arriba";
const IDIOMAS = ["es", "en"] as const;
const LADOS = ["local", "visita"] as const;
const A = ANTESALA_ARENA, PL = A.plantillas;
const INTERVALO: [number, number] = [0, 0];
/** v1.1 § 5 · Peticiones a /relato en vuelo por espectador mientras la antesala está activa. */
export const MAX_EN_VUELO_ANTESALA = VOZ_BUFFER.concurrencia;

/** Una intervención es de la antesala por su id. */
export const esAntesala = (i: Pick<IntervencionArena, "id">) => i.id.startsWith("antesala:");

/** Id del clip n (desde 1) del guion completo: `antesala:01-apertura:0`, `antesala:03-local-atras:0`… */
export function idAntesala(lado: Lado | null, bloque: BloqueAntesala): string {
  const n = bloque === "apertura" ? 1 : (lado === "local" ? 2 : 6) + A.bloques.indexOf(bloque as (typeof A.bloques)[number]);
  return `antesala:${String(n).padStart(2, "0")}-${lado ? `${lado}-` : ""}${bloque}:0`;
}
const PATRON_ID = /^antesala:(\d{2})-(?:(local|visita)-)?(apertura|cabecera|atras|medio|arriba):0$/;
/** Lado y bloque de un id de la antesala (null si no lo es o no es canónico). */
export function bloqueAntesala(id: string): { lado: Lado | null; bloque: BloqueAntesala } | null {
  const m = PATRON_ID.exec(id);
  if (!m) return null;
  const lado = (m[2] as Lado | undefined) ?? null, bloque = m[3] as BloqueAntesala;
  if ((bloque === "apertura") !== (lado === null) || idAntesala(lado, bloque) !== id) return null;
  return { lado, bloque };
}

/** § 4.4 · Líneas base de la formación en orden (de atrás adelante, de izquierda a derecha), sin el portero. */
function lineasBase(registro: RegistroArena, lado: Lado): string[][] {
  const f = registro.config.formaciones[lado], ps = puestos(f).slice(1), lineas: string[][] = [];
  let k = 0;
  for (const n of estructuraBase(f).split("-").map(Number)) { lineas.push(ps.slice(k, k + n)); k += n; }
  if (k !== ps.length || lineas.length < 3) throw new Error("Alineación inconsistente");
  return lineas;
}
/** Puestos de un bloque: atrás = POR + primera línea; medio = las intermedias en orden; arriba = la última. */
function puestosDelBloque(registro: RegistroArena, lado: Lado, bloque: BloqueLinea): string[] {
  const lineas = lineasBase(registro, lado);
  return bloque === "atras" ? ["POR", ...lineas[0]!] : bloque === "medio" ? lineas.slice(1, -1).flat() : lineas.at(-1)!;
}
/** Jugadores del bloque en el orden en que la voz los nombra. Lanza «Alineación inconsistente». */
export function jugadoresDelBloque(registro: RegistroArena, lado: Lado, bloque: BloqueLinea): JugadorArena[] {
  const propios = registro.inicial.jugadores.filter(j => j.lado === lado);
  if (propios.length !== puestos(registro.config.formaciones[lado]).length) throw new Error("Alineación inconsistente");
  return puestosDelBloque(registro, lado, bloque).map(puesto => {
    const c = propios.filter(j => j.puesto === puesto);
    if (c.length !== 1) throw new Error("Alineación inconsistente");
    return c[0]!;
  });
}

/** § 4.1 · Nombre hablado: el apellido corto; si dos jugadores del mismo equipo lo comparten, el nombre completo. */
function nombresHablados(registro: RegistroArena, lado: Lado): Map<string, string> {
  const propios = registro.inicial.jugadores.filter(j => j.lado === lado), cuenta = new Map<string, number>();
  for (const j of propios) cuenta.set(apellidoCorto(j.nombre), (cuenta.get(apellidoCorto(j.nombre)) ?? 0) + 1);
  return new Map(propios.map(j => [j.id, (cuenta.get(apellidoCorto(j.nombre)) ?? 0) > 1 ? j.nombre : apellidoCorto(j.nombre)]));
}

/** v1.1 § 8 (b) · Cláusula del controlador según cómo crea el servidor la asignación, nunca por una etiqueta. */
export function controladorVerificado(asignacion: AsignacionModelos | null, lado: Lado): { clausula: "modelo" | "programado" | "ninguna"; id?: string; nombre?: string } {
  if (!asignacion || asignacion.procedencia === "declarada") return { clausula: "ninguna" };
  const m = asignacion[lado];
  if ((asignacion.modo === "azar" || asignacion.modo === "manual") && (asignacion.procedencia === undefined || asignacion.procedencia === "verificada")) return { clausula: "modelo", id: m.id, nombre: m.nombre };
  if (asignacion.modo === "programado" && m.id === "programado") return { clausula: "programado", id: m.id, nombre: m.nombre };
  return { clausula: "ninguna" };
}

/** v1.1 § 6 · Longitud del texto con los escapes de SSML de voz.ts (`<>&"'` → entidades). */
export function longitudEscapada(texto: string): number {
  let n = 0;
  for (const c of texto) n += c === "<" || c === ">" ? 4 : c === "&" ? 5 : c === '"' || c === "'" ? 6 : c.length;
  return n;
}

const rellenar = (plantilla: string, valores: Record<string, string | number>) =>
  plantilla.replace(/\{(\w+)\}/g, (todo, k: string) => Object.hasOwn(valores, k) ? String(valores[k]) : todo);
const lista = (nombres: readonly string[], idioma: Idioma) =>
  nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")}${PL[idioma].lista}${nombres.at(-1)}`;
const dorsalHablado = (n: number, idioma: Idioma) => rellenar(PL[idioma].dorsal, { n });

type Bilingue = Record<Idioma, string>;
/** Una oración del clip: texto ES/EN, hecho principal y apoyos. */
interface OracionClip { texto: Bilingue; principal: string; apoyo: string[] }
interface HechoClip { id: string; fuente: string; texto: Bilingue; datos: Record<string, string | number> }
interface Clip { id: string; lado: Lado | null; bloque: BloqueAntesala; oraciones: OracionClip[]; hechos: HechoClip[]; escalones: string[] }

/** El clip cabe: en ES y en EN, el texto ≤ maxCaracteresIntervencion, cada oración ≤ maxCaracteresOracion y el
 * texto con escapes ≤ maxTextoEscapadoC. */
const cabe = (oraciones: readonly OracionClip[]) => IDIOMAS.every(i => {
  const texto = oraciones.map(o => o.texto[i]).join(" ");
  return texto.length <= MESA_ARENA.maxCaracteresIntervencion && longitudEscapada(texto) <= A.maxTextoEscapadoC
    && oraciones.every(o => o.texto[i].length <= MESA_ARENA.maxCaracteresOracion);
});
/** Escalera por clip: aplica en orden los escalones con efecto hasta que el clip quepa. */
function escalera<E>(estado: E, construir: (e: E) => OracionClip[], escalones: { nombre: string; aplica: (e: E) => boolean; aplicar: (e: E) => E }[]) {
  const aplicados: string[] = [];
  for (const paso of escalones) {
    if (cabe(construir(estado))) break;
    if (!paso.aplica(estado)) continue;
    estado = paso.aplicar(estado); aplicados.push(paso.nombre);
  }
  return { oraciones: construir(estado), aplicados, cabe: cabe(construir(estado)) };
}

interface Equipo {
  lado: Lado; nombre: string; formacion: FormacionArena; habladas: Bilingue; controlador: ReturnType<typeof controladorVerificado>; modo: string;
  entrenador: string | null; lineas: Record<BloqueLinea, { jugador: JugadorArena; hablado: string; orden: number }[]>;
}
function equipo(registro: RegistroArena, asignacion: AsignacionModelos | null, lado: Lado): Equipo {
  const f = registro.config.formaciones[lado], hablados = nombresHablados(registro, lado), orden = puestos(f);
  const linea = (b: BloqueLinea) => jugadoresDelBloque(registro, lado, b).map(jugador => ({ jugador, hablado: hablados.get(jugador.id)!, orden: orden.indexOf(jugador.puesto) + 1 }));
  return {
    lado, nombre: registro.config.partido[lado].nombre, formacion: f, habladas: { es: formacionHablada(f, "es"), en: formacionHablada(f, "en") },
    controlador: controladorVerificado(asignacion, lado), modo: asignacion?.modo ?? "ninguno", entrenador: registro.config.entrenadores?.[lado]?.nombre ?? null,
    lineas: { atras: linea("atras"), medio: linea("medio"), arriba: linea("arriba") },
  };
}

/** Banderas del guion (escalera de guion, § 4.3): apertura, cláusulas de controlador y sufijos de entrenador. */
interface Guion { apertura: boolean; controlador: boolean; entrenador: boolean }

function clipApertura(registro: RegistroArena): Clip | null {
  const local = registro.config.partido.local.nombre, visita = registro.config.partido.visita.nombre;
  const hecho: HechoClip = { id: "antesala:equipos", fuente: "config.partido", texto: { es: `Local: ${local}; visita: ${visita}.`, en: `Home: ${local}; away: ${visita}.` }, datos: { local, visita } };
  const oraciones: OracionClip[] = [{ texto: { es: rellenar(PL.es.apertura, { local, visita }), en: rellenar(PL.en.apertura, { local, visita }) }, principal: hecho.id, apoyo: [] }];
  // Si la apertura no cabe, se omite el clip (§ 4.3).
  return cabe(oraciones) ? { id: idAntesala(null, "apertura"), lado: null, bloque: "apertura", oraciones, hechos: [hecho], escalones: [] } : null;
}

function clipCabecera(e: Equipo, g: Guion, idioma: Idioma): Clip {
  const hFormacion: HechoClip = { id: `antesala:formacion:${e.lado}`, fuente: "config.formaciones",
    texto: { es: `Formación inicial de ${e.nombre}: ${e.formacion}.`, en: `${e.nombre} starting formation: ${e.formacion}.` },
    datos: { equipo: e.nombre, formacion: e.formacion, formacion_hablada: e.habladas[idioma] } };
  const c = e.controlador;
  const hControlador: HechoClip | null = c.clausula === "ninguna" ? null : { id: `antesala:controlador:${e.lado}`, fuente: "sesion.asignacion",
    texto: { es: `Controlador de ${e.nombre}: ${c.nombre}.`, en: `${e.nombre} controller: ${c.nombre}.` },
    datos: { equipo: e.nombre, modo: e.modo, clausula: c.clausula, controlador_id: c.id!, controlador_nombre: c.nombre! } };
  type Estado = { controlador: boolean; referencia: boolean };
  const construir = (s: Estado): OracionClip[] => {
    const conControl = s.controlador && hControlador !== null;
    const texto = (i: Idioma) => {
      const plantilla = !conControl ? PL[i].cabecera : c.clausula === "modelo" ? PL[i].cabeceraModelo : PL[i].cabeceraProgramada;
      const t = rellenar(plantilla, { equipo: s.referencia ? PREVIA_ARENA.plantillas[i].referencias[e.lado] : e.nombre, formacion: e.habladas[i], modelo: c.nombre ?? "" });
      return s.referencia ? mayusculaInicial(t) : t;
    };
    return [{ texto: { es: texto("es"), en: texto("en") }, principal: hFormacion.id, apoyo: conControl ? [hControlador!.id] : [] }];
  };
  const r = escalera<Estado>({ controlador: g.controlador && hControlador !== null, referencia: false }, construir, [
    { nombre: "sin-controlador", aplica: s => s.controlador, aplicar: s => ({ ...s, controlador: false }) },
    { nombre: "equipo-referencia", aplica: s => !s.referencia, aplicar: s => ({ ...s, referencia: true }) },
  ]);
  if (!r.cabe) throw new Error("Antesala fuera de presupuesto");
  const conControl = r.oraciones[0]!.apoyo.length > 0;
  return { id: idAntesala(e.lado, "cabecera"), lado: e.lado, bloque: "cabecera", oraciones: r.oraciones, hechos: [hFormacion, ...conControl ? [hControlador!] : []],
    escalones: [...r.aplicados, ...!g.controlador && hControlador !== null ? ["guion:sin-controlador"] : []] };
}

function clipLinea(e: Equipo, bloque: BloqueLinea, g: Guion, idioma: Idioma): Clip {
  const linea = e.lineas[bloque];
  type Estado = { entrenador: boolean; dorsales: boolean };
  const hablado = (s: Estado, i: Idioma, k: number) => s.dorsales ? dorsalHablado(linea[k]!.jugador.dorsal, i) : linea[k]!.hablado;
  const hEntrenador: HechoClip | null = bloque === "arriba" && e.entrenador !== null ? { id: `antesala:entrenador:${e.lado}`, fuente: "config.entrenadores",
    texto: { es: `Entrenador de ${e.nombre}: ${e.entrenador}.`, en: `${e.nombre} coach: ${e.entrenador}.` }, datos: { equipo: e.nombre, entrenador: e.entrenador } } : null;
  const idLinea = `antesala:linea:${e.lado}:${bloque}`;
  const construir = (s: Estado): OracionClip[] => {
    const nombres = (i: Idioma) => linea.map((_, k) => hablado(s, i, k));
    const texto = (i: Idioma) => bloque === "atras" ? rellenar(PL[i].atras, { portero: nombres(i)[0]!, defensas: lista(nombres(i).slice(1), i) })
      : bloque === "medio" ? rellenar(PL[i].medio, { medios: lista(nombres(i), i) }) : rellenar(PL[i].arriba, { delanteros: lista(nombres(i), i) });
    const oraciones: OracionClip[] = [{ texto: { es: texto("es"), en: texto("en") }, principal: idLinea, apoyo: [] }];
    if (s.entrenador && hEntrenador) oraciones.push({ texto: { es: rellenar(PL.es.entrenador, { entrenador: e.entrenador! }).trim(), en: rellenar(PL.en.entrenador, { entrenador: e.entrenador! }).trim() }, principal: hEntrenador.id, apoyo: [] });
    return oraciones;
  };
  const r = escalera<Estado>({ entrenador: g.entrenador && hEntrenador !== null, dorsales: false }, construir, [
    { nombre: "sin-entrenador", aplica: s => s.entrenador, aplicar: s => ({ ...s, entrenador: false }) },
    { nombre: "dorsales", aplica: s => !s.dorsales, aplicar: s => ({ ...s, dorsales: true }) },
  ]);
  if (!r.cabe) throw new Error("Antesala fuera de presupuesto");
  const dorsales = r.aplicados.includes("dorsales"), conEntrenador = r.oraciones.length > 1;
  const datos: Record<string, string | number> = { equipo: e.nombre, n: linea.length };
  linea.forEach((x, k) => {
    const n = k + 1;
    datos[`jugador_${n}`] = x.jugador.id; datos[`dorsal_${n}`] = x.jugador.dorsal; datos[`puesto_${n}`] = x.jugador.puesto;
    datos[`nombre_${n}`] = x.jugador.nombre; datos[`hablado_${n}`] = dorsales ? dorsalHablado(x.jugador.dorsal, idioma) : x.hablado; datos[`orden_${n}`] = x.orden;
  });
  const describir = (i: Idioma) => linea.map(x => `${x.jugador.nombre} (${x.jugador.dorsal}, ${x.jugador.puesto})`).join(i === "es" ? "; " : "; ");
  const hLinea: HechoClip = { id: idLinea, fuente: "inicial.jugadores", texto: { es: `${e.nombre}, ${A.bloquesRotulo.es[bloque].toLowerCase()}: ${describir("es")}.`, en: `${e.nombre}, ${A.bloquesRotulo.en[bloque].toLowerCase()}: ${describir("en")}.` }, datos };
  return { id: idAntesala(e.lado, bloque), lado: e.lado, bloque, oraciones: r.oraciones, hechos: [hLinea, ...conEntrenador ? [hEntrenador!] : []],
    escalones: [...r.aplicados, ...!g.entrenador && hEntrenador !== null ? ["guion:sin-entrenador"] : []] };
}

function clips(registro: RegistroArena, equipos: Record<Lado, Equipo>, g: Guion, idioma: Idioma): Clip[] {
  const apertura = g.apertura ? clipApertura(registro) : null;
  return [...apertura ? [apertura] : [], ...LADOS.flatMap(lado => [clipCabecera(equipos[lado], g, idioma), ...(["atras", "medio", "arriba"] as const).map(b => clipLinea(equipos[lado], b, g, idioma))])];
}
const turnoDe = (c: Clip): TurnoMesa => ({ rol: "narrador", funcion: "dato", texto_es: c.oraciones.map(o => o.texto.es).join(" "), texto_en: c.oraciones.map(o => o.texto.en).join(" "), oraciones: c.oraciones.map((_, k) => k) });
/** § 4.3 · Duración estimada del guion: Σ estimarDuracionS(turnos) + huecoS por cada hueco entre clips. */
export function duracionEstimadaAntesalaS(intervenciones: readonly Pick<IntervencionArena, "turnos">[]): number {
  return intervenciones.reduce((s, i) => s + estimarDuracionS(i.turnos ?? []), 0) + Math.max(0, intervenciones.length - 1) * A.huecoS;
}

function intervencion(c: Clip, escalonesGuion: readonly string[]): IntervencionArena {
  const porId = new Map(c.hechos.map(h => [h.id, h]));
  const oraciones: Oracion[] = c.oraciones.map(o => ({ texto_es: o.texto.es, texto_en: o.texto.en, hecho: o.principal, apoyo: [...o.apoyo] }));
  const evidencia: EvidenciaMesa[] = c.oraciones.map(o => {
    const citas = [o.principal, ...o.apoyo].map(hecho => ({ hecho, eventos: [] as string[], intervalo: [...INTERVALO] as [number, number], fuente: porId.get(hecho)!.fuente }));
    const fuentes = new Set(citas.map(x => x.fuente));
    return { eventos: [], intervalo: [...INTERVALO] as [number, number], ...fuentes.size === 1 ? { fuente: citas[0]!.fuente } : {}, citas };
  });
  const hechos: HechoVerificable[] = c.hechos.map(h => ({ id: h.id, tipo: "accion_arena", texto_es: h.texto.es, texto_en: h.texto.en, eventos: [], relevancia: 50, datos: { ...h.datos } }));
  return {
    id: c.id, rol: "estadista", tick: 0, tema: "antesala", forma: "previa", modo: "determinista", audit: [],
    oraciones, hechos, evidencia, turnos: [turnoDe(c)],
    auditDialogo: { motivos: [], escalones: [...c.escalones, ...escalonesGuion.filter(x => x === "guion:sin-apertura")] },
  };
}

/** Guion completo con su escalera de guion y la duración estimada (para pruebas y diagnóstico). */
export function guionAntesala(registro: RegistroArena, asignacion: AsignacionModelos | null, idioma: Idioma) {
  const equipos = { local: equipo(registro, asignacion, "local"), visita: equipo(registro, asignacion, "visita") };
  let g: Guion = { apertura: true, controlador: true, entrenador: true };
  const escalonesGuion: string[] = [];
  const armar = () => { const cs = clips(registro, equipos, g, idioma); return cs.map(c => intervencion(c, escalonesGuion)); };
  let intervenciones = armar();
  // § 4.3 · Escalera del guion: 1 → apertura, 2 → cláusulas de controlador, 3 → sufijos de entrenador.
  for (const [nombre, aplicar] of [["guion:sin-apertura", (x: Guion) => ({ ...x, apertura: false })], ["guion:sin-controlador", (x: Guion) => ({ ...x, controlador: false })], ["guion:sin-entrenador", (x: Guion) => ({ ...x, entrenador: false })]] as const) {
    if (duracionEstimadaAntesalaS(intervenciones) <= A.objetivoS) break;
    g = aplicar(g); escalonesGuion.push(nombre); intervenciones = armar();
  }
  return { intervenciones, escalonesGuion, duracionEstimadaS: duracionEstimadaAntesalaS(intervenciones) };
}

/** § 4.4 / v1.3 · Los clips de la antesala en el orden del guion, con los hechos del idioma del clip. Lanza
 * «Alineación inconsistente» si un puesto falta o se repite. */
export function antesalaPartido(registro: RegistroArena, asignacion: AsignacionModelos | null, idioma: Idioma): IntervencionArena[] {
  return guionAntesala(registro, asignacion, idioma).intervenciones;
}

/** Rutas de los campos que difieren (hoja más profunda; longitudes distintas = la propia lista). */
function diferencias(a: unknown, b: unknown, ruta: string, salida: string[]): void {
  if (Object.is(a, b)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { salida.push(ruta); return; }
    a.forEach((x, k) => diferencias(x, b[k], `${ruta}[${k}]`, salida)); return;
  }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) diferencias(x[k], y[k], ruta ? `${ruta}.${k}` : k, salida);
    return;
  }
  salida.push(ruta);
}
/** § 4.4 · Re-deriva el guion del registro y la asignación y compara el clip con el mismo id campo a campo; cada
 * diferencia es un motivo P1 con la ruta del campo (vacío = igual). */
export function comprobarAntesala(i: IntervencionArena, registro: RegistroArena, asignacion: AsignacionModelos | null, idioma: Idioma): { regla: "P1"; detalle: string }[] {
  let piezas: IntervencionArena[];
  try { piezas = antesalaPartido(registro, asignacion, idioma); } catch (error) { return [{ regla: "P1", detalle: `registro: ${(error as Error).message}` }]; }
  const esperada = piezas.find(p => p.id === i.id);
  if (!esperada) return [{ regla: "P1", detalle: `id: ${i.id} no es un clip de la antesala` }];
  const rutas: string[] = [];
  diferencias(JSON.parse(JSON.stringify(i)), JSON.parse(JSON.stringify(esperada)), "", rutas);
  return rutas.map(ruta => ({ regla: "P1", detalle: `${ruta}: no coincide con la antesala derivada del registro` }));
}

// ——— Reproductor (lógica pura) ———

export type EstadoReloj = "preparando" | "reproduciendo" | "recuperando" | "pausada" | "final";
/** v1.1 § 3 · Transición atómica de activación y retención. El consumidor aplica `reloj.retener()` en el mismo
 * manejador síncrono en que la llama. */
export function activarAntesala(e: { permitida: boolean; inicioTick: number; relojSegundo: number; relojEstado: EstadoReloj; topeS: number; ahoraMs: number; venceMs: number; contextoCorre: boolean }): { retener: boolean; iniciar: boolean; motivo?: string } {
  if (!e.permitida) return { retener: false, iniciar: false, motivo: "no-permitida" };
  if (e.inicioTick !== 0 || e.relojSegundo !== 0 || (e.relojEstado !== "preparando" && e.relojEstado !== "pausada")) return { retener: false, iniciar: false, motivo: "reloj-en-marcha" };
  const retener = e.topeS > 0 && e.ahoraMs < e.venceMs;
  if (e.topeS > 0 && !retener) return { retener: false, iniciar: false, motivo: "tope" };
  const iniciar = e.contextoCorre && e.relojEstado !== "pausada";
  return { retener, iniciar, ...iniciar ? {} : { motivo: e.contextoCorre ? "pausada" : "audio" } };
}

export type MotivoFinAntesala = "completa" | "saltada" | "tope" | "fallos" | "caducada" | "voz-apagada" | "idioma" | "sesion" | "desmontaje" | "limpiar";
export type EstadoClipAntesala = "pendiente" | "pidiendo" | "listo" | "fallido" | "sonando" | "sonado" | "cortado";
export interface ClipAntesala { id: string; estado: EstadoClipAntesala; reintentos: number; reintentos409: number; noAntesDeMs: number; duracionS: number | null }
export interface EstadoAntesala {
  token: number; fase: "activa" | "terminada"; motivo: MotivoFinAntesala | null;
  /** Con `topeS > 0` la antesala retiene el reloj; con 0 suena con el partido en marcha (C2 revertida). */
  retiene: boolean; t0Ms: number; venceMs: number;
  clips: ClipAntesala[]; indice: number; fallosSeguidos: number;
  /** Instante de audio en que terminó el último clip (null antes del primero) y desde el que se espera el actual. */
  finAnteriorS: number | null; esperaDesdeS: number | null;
  sonoAlguno: boolean; entrada: "esperando" | "sonando" | "sonada" | "omitida";
  sonando: { id: string; finS: number } | null;
}
/** v1.2 (N1) · Un único vencimiento en ms monotónicos (performance.now()); nunca Date.now(). */
export const vencimientoAntesalaMs = (t0Ms: number, topeS: number = A.topeS) => t0Ms + topeS * 1000;
export function iniciarAntesala(ids: readonly string[], token: number, t0Ms: number, topeS: number = A.topeS): EstadoAntesala {
  return { token, fase: "activa", motivo: null, retiene: topeS > 0, t0Ms, venceMs: vencimientoAntesalaMs(t0Ms, topeS),
    clips: ids.map(id => ({ id, estado: "pendiente", reintentos: 0, reintentos409: 0, noAntesDeMs: 0, duracionS: null })), indice: 0, fallosSeguidos: 0,
    finAnteriorS: null, esperaDesdeS: null, sonoAlguno: false, entrada: "esperando", sonando: null };
}
/** Resultado de una petición de clip. */
export type RespuestaClip = { tipo: "ok"; duracionS: number } | { tipo: "http"; estado: number } | { tipo: "red" } | { tipo: "invalida" };
export type EntradaAntesala =
  | { tipo: "fotograma"; token: number; ahoraMs: number; audioS: number; corre: boolean; cursorS: number; fuenteAjena: boolean; entradaDuracionS: number | null }
  | { tipo: "pedido"; token: number; id: string }
  | { tipo: "respuesta"; token: number; id: string; ahoraMs: number; resultado: RespuestaClip }
  | { tipo: "fin-fuente"; token: number; id: string; audioS: number; interrumpida: boolean }
  | { tipo: "saltar"; token: number } | { tipo: "voz-apagada"; token: number }
  | { tipo: "terminar"; token: number; motivo: MotivoFinAntesala };
export interface SalidaAntesala {
  estado: EstadoAntesala;
  /** Arrancar ya el clip `id` (o la entrada, con id "entrada"). */
  arrancar?: { id: string };
  /** Detener la fuente de la antesala que suena. */
  detener?: boolean;
  /** Abortar estas peticiones en vuelo. */
  abortar?: string[];
  /** Soltar la retención del reloj (solo si la antesala retenía). */
  soltarReloj: boolean;
  /** Primer clip que suena: las piezas del 056 quedan terminadas en esta activación. */
  terminarPrevia?: boolean;
}
const nula = (estado: EstadoAntesala): SalidaAntesala => ({ estado, soltarReloj: false });
function fin(estado: EstadoAntesala, motivo: MotivoFinAntesala, detener: boolean): SalidaAntesala {
  const abortar = estado.clips.filter(c => c.estado === "pidiendo").map(c => c.id);
  return { estado: { ...estado, fase: "terminada", motivo, sonando: null }, ...detener && estado.sonando ? { detener: true } : {}, ...abortar.length ? { abortar } : {}, soltarReloj: estado.retiene };
}
const conClip = (estado: EstadoAntesala, id: string, cambio: Partial<ClipAntesala>): EstadoAntesala => ({ ...estado, clips: estado.clips.map(c => c.id === id ? { ...c, ...cambio } : c) });

/** Siguiente clip que puede pedirse: en orden del guion, uno a la vez (nunca dos de la antesala en vuelo). */
export function siguientePedidoAntesala(estado: EstadoAntesala, ahoraMs: number): string | null {
  if (estado.fase !== "activa" || estado.clips.some(c => c.estado === "pidiendo")) return null;
  const c = estado.clips.find(x => x.estado === "pendiente");
  return c && c.noAntesDeMs <= ahoraMs ? c.id : null;
}
/** Todos los clips del guion están pedidos (en vuelo o resueltos): desde aquí pueden pedirse la entrada y los tramos. */
export const todosPedidosAntesala = (estado: EstadoAntesala) => estado.clips.every(c => c.estado !== "pendiente");

/** § 4.6 y v1.1 §§ 1, 2, 4 · Un paso de la antesala. Con un token distinto o la fase terminada, toda entrada es nula. */
export function pasoAntesala(estado: EstadoAntesala, entrada: EntradaAntesala): SalidaAntesala {
  if (entrada.token !== estado.token || estado.fase !== "activa") return nula(estado);
  switch (entrada.tipo) {
    case "saltar": return fin(estado, "saltada", true);
    case "voz-apagada": return fin(estado, "voz-apagada", true);
    case "terminar": return fin(estado, entrada.motivo, true);
    case "pedido": {
      const c = estado.clips.find(x => x.id === entrada.id);
      return c && c.estado === "pendiente" ? nula(conClip(estado, c.id, { estado: "pidiendo" })) : nula(estado);
    }
    case "respuesta": {
      const c = estado.clips.find(x => x.id === entrada.id);
      if (!c || c.estado !== "pidiendo") return nula(estado);
      const r = entrada.resultado;
      if (r.tipo === "ok") return nula({ ...conClip(estado, c.id, { estado: "listo", duracionS: r.duracionS }), fallosSeguidos: 0 });
      // v1.1 § 1: 429, red o plazo → un reintento; 409 → hasta maxReintentos409; 404, 400 o inválida → final.
      const reintentable = r.tipo === "red" || r.tipo === "http" && r.estado === 429;
      if (reintentable && c.reintentos < A.maxReintentos) return nula(conClip(estado, c.id, { estado: "pendiente", reintentos: c.reintentos + 1, noAntesDeMs: entrada.ahoraMs + A.reintentoMs }));
      if (r.tipo === "http" && r.estado === 409 && c.reintentos409 < A.maxReintentos409) return nula(conClip(estado, c.id, { estado: "pendiente", reintentos409: c.reintentos409 + 1, noAntesDeMs: entrada.ahoraMs + A.reintentoMs }));
      const fallido = { ...conClip(estado, c.id, { estado: "fallido" }), fallosSeguidos: estado.fallosSeguidos + 1 };
      return fallido.fallosSeguidos >= A.maxFallosSeguidos ? fin(fallido, "fallos", true) : nula(fallido);
    }
    case "fin-fuente": {
      if (!estado.sonando || estado.sonando.id !== entrada.id) return nula(estado);
      if (entrada.id === "entrada") return fin({ ...estado, entrada: "sonada", finAnteriorS: entrada.audioS }, "completa", false);
      const siguiente = { ...conClip(estado, entrada.id, { estado: entrada.interrumpida ? "cortado" : "sonado" }), sonando: null, finAnteriorS: entrada.audioS, esperaDesdeS: null, indice: estado.indice + 1 };
      return nula(siguiente);
    }
    case "fotograma": {
      const f = entrada;
      // v1.1 § 2: al vencer el límite (pared, desde el clic) se corta la fuente y se suelta en el mismo paso.
      if (estado.retiene && f.ahoraMs >= estado.venceMs) return fin(estado, "tope", true);
      if (!estado.retiene && f.cursorS > PREVIA_ARENA.caducidadS) return fin(estado, "caducada", false);
      if (!f.corre || estado.sonando || f.fuenteAjena) return nula(estado);
      let s = estado;
      while (s.indice < s.clips.length && s.clips[s.indice]!.estado === "fallido") s = { ...s, indice: s.indice + 1, esperaDesdeS: null };
      const listoDesde = s.finAnteriorS === null ? -Infinity : s.finAnteriorS + A.huecoS;
      if (f.audioS < listoDesde) return nula(s);
      const espera = s.esperaDesdeS ?? f.audioS;
      if (s.indice < s.clips.length) {
        const c = s.clips[s.indice]!;
        if (c.estado === "listo") {
          const primero = !s.sonoAlguno;
          return { estado: { ...conClip(s, c.id, { estado: "sonando" }), sonando: { id: c.id, finS: f.audioS + (c.duracionS ?? 0) }, sonoAlguno: true, esperaDesdeS: null }, arrancar: { id: c.id }, soltarReloj: false, ...primero ? { terminarPrevia: true } : {} };
        }
        if (f.audioS - espera < A.esperaClipS) return nula({ ...s, esperaDesdeS: espera });
        // Un clip que no llega a tiempo se salta y cuenta como fallo.
        const fallido = { ...conClip(s, c.id, { estado: "fallido" }), fallosSeguidos: s.fallosSeguidos + 1, indice: s.indice + 1, esperaDesdeS: f.audioS };
        const abortar = c.estado === "pidiendo" ? [c.id] : [];
        if (fallido.fallosSeguidos >= A.maxFallosSeguidos) { const r = fin(fallido, "fallos", true); return { ...r, abortar: [...new Set([...r.abortar ?? [], ...abortar])] }; }
        return { estado: fallido, soltarReloj: false, ...abortar.length ? { abortar } : {} };
      }
      // Fin del guion. Con retención, la entrada del narrador es el último clip si llega en esperaClipS.
      if (!s.retiene) return fin(s, "completa", false);
      if (f.entradaDuracionS !== null) return { estado: { ...s, entrada: "sonando", sonando: { id: "entrada", finS: f.audioS + f.entradaDuracionS }, esperaDesdeS: null }, arrancar: { id: "entrada" }, soltarReloj: false };
      if (f.audioS - espera < A.esperaClipS) return nula({ ...s, esperaDesdeS: espera });
      return fin({ ...s, entrada: "omitida" }, "completa", false);
    }
  }
}

/** v1.1 § 5 · Árbitro de peticiones a /relato del consumidor. Con la antesala activa: como máximo
 * MAX_EN_VUELO_ANTESALA en vuelo, prioridad antesala > entrada > tramo, nunca dos de la antesala y ningún
 * invitado. Sin antesala no interviene: devuelve la primera pendiente. */
export type ClaseSolicitud = "antesala" | "entrada" | "tramo" | "invitado";
const PRIORIDAD_SOLICITUD: Record<ClaseSolicitud, number> = { antesala: 0, entrada: 1, tramo: 2, invitado: 3 };
export function elegirSolicitud<P extends { clase: ClaseSolicitud }>(pendientes: readonly P[], enVuelo: readonly { clase: ClaseSolicitud }[], fase: "activa" | "inactiva"): P | null {
  if (fase === "inactiva") return pendientes[0] ?? null;
  if (enVuelo.length >= MAX_EN_VUELO_ANTESALA) return null;
  const antesalaEnVuelo = enVuelo.some(x => x.clase === "antesala");
  const validas = pendientes.filter(p => p.clase !== "invitado" && !(p.clase === "antesala" && antesalaEnVuelo));
  return [...validas].sort((a, b) => PRIORIDAD_SOLICITUD[a.clase] - PRIORIDAD_SOLICITUD[b.clase])[0] ?? null;
}

// ——— Bloque C · Foco del clip que suena (§ 5 y v1.1 § 10) ———
/** Lo que la pantalla resalta mientras suena un clip: el lado, el bloque, los jugadores nombrados (en el orden de la
 * voz) y si el clip nombró al entrenador. */
export interface FocoAntesala { lado: Lado | null; bloque: BloqueAntesala; jugadores: string[]; entrenador: boolean }
/** v1.1 § 10 · El foco sale de la pieza EFECTIVA: `jugadores` de los `jugador_k` de su hecho `antesala:linea` (no se
 * recalcula) y `entrenador` solo si alguna oración cita `antesala:entrenador:{lado}` (la escalera pudo quitarlo). */
export function focoDeAntesala(i: IntervencionArena): FocoAntesala | null {
  const b = bloqueAntesala(i.id);
  if (!b) return null;
  const linea = b.lado ? i.hechos.find(h => h.id === `antesala:linea:${b.lado}:${b.bloque}`) : undefined;
  const n = linea ? Number(linea.datos.n) : 0;
  const jugadores = Array.from({ length: Number.isInteger(n) && n > 0 ? n : 0 }, (_, k) => String(linea!.datos[`jugador_${k + 1}`]));
  const citaEntrenador = b.lado !== null && i.oraciones.some(o => o.hecho === `antesala:entrenador:${b.lado}` || (o.apoyo ?? []).includes(`antesala:entrenador:${b.lado}`));
  return { lado: b.lado, bloque: b.bloque, jugadores, entrenador: citaEntrenador };
}
