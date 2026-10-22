// Brief 056 (v1.1–v1.2) · Previa del partido. Un solo origen de verdad, puro y compartido: deriva DEL
// REGISTRO (config + inicial) el contenido de la tarjeta de alineaciones y las tres piezas habladas. Sin DOM, sin red, sin LLM y
// sin valores por defecto inventados: lo que el archivo no trae (capitán, técnico, banco, árbitro o
// condiciones en arena-v1) se omite. Todas las cifras viven en PREVIA_ARENA (limites.ts).
import type { Oracion } from "../cadena/tipos";
import type { HechoVerificable } from "../cadena/verificador";
import { ARENA, CANTO_GOL, MESA_ARENA, PREVIA_ARENA } from "../sim/limites";
import type { Estilo, Lado } from "../sim/tipos";
import { anclas, puestos } from "./catalogo";
import { etiquetasEntrenador } from "./entrenadores";
import type { EvidenciaMesa, IntervencionArena, TurnoMesa } from "./protocolo";
import { perfilesJugador, type FormacionArena, type JugadorArena, type PerfilEntrenador, type PerfilJugador, type RegistroArena } from "./tipos";

const T = PREVIA_ARENA.tarjeta;
/** v1.2 · Geometría derivada de la tarjeta: escala de profundidad estirada (PREVIA_ARENA), línea de fondo
 * propia abajo y la rival en `margenSuperior`; el alto añade `margenInferior`. */
export const GEOMETRIA_PREVIA = (() => {
  const escala = T.escalaProfundidad, lineaFondo = T.margenSuperior + ARENA.largoM * escala;
  return { escala, lineaFondo, alto: lineaFondo + T.margenInferior, ancho: ARENA.anchoM };
})();

/** x, y en unidades de la tarjeta (§ 4.2, v1.2): x = ancho (metros reales), y = profundidad (portería propia abajo). */
export interface PuestoPrevia { puesto: string; jugador: JugadorArena; x: number; y: number }
export interface EquipoPrevia {
  lado: Lado; nombre: string; formacion: FormacionArena; puestos: PuestoPrevia[];
  capitan: JugadorArena | null; entrenador: { nombre: string; perfil: PerfilEntrenador; preferidas: FormacionArena[] } | null;
  banco: JugadorArena[]; nivelMedio: number;
  perfiles: { perfil: PerfilJugador; n: number }[];
  ataque: number; defensa: number; estilo: Estilo;
}
export type SuperficiePrevia = keyof typeof PREVIA_ARENA.textos.superficie.es;
export interface PreviaVisual {
  equipos: Record<Lado, EquipoPrevia>;
  condiciones: { clima: keyof typeof PREVIA_ARENA.textos.clima.es; temperaturaC?: number; superficie: "natural" | "sintetica"; cesped?: "corto" | "alto" } | null;
  arbitro: string | null;
}

/** Proyección de un ancla en metros (orientación local) a la tarjeta: cx = y, cy = lineaFondo − x · escala. */
export function proyectarPrevia(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.y, y: GEOMETRIA_PREVIA.lineaFondo - p.x * GEOMETRIA_PREVIA.escala };
}

/** § 4.3 · Última palabra del nombre, sin truncar; mayúsculas y acentos intactos (la voz la usa en la escalera). */
export function apellidoCorto(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  return palabras.at(-1) ?? nombre;
}

/** v1.1 § 8 · Clave de texto de la superficie: sin `cesped` en natural no se asume longitud. */
export function claveSuperficie(c: { superficie: "natural" | "sintetica"; cesped?: "corto" | "alto" }): SuperficiePrevia {
  if (c.superficie === "sintetica") return "sintetica";
  return c.cesped === "corto" ? "natural_corto" : c.cesped === "alto" ? "natural_alto" : "natural";
}
export const mayusculaInicial = (s: string) => s ? s[0]!.toLocaleUpperCase() + s.slice(1) : s;

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function equipoPrevia(registro: RegistroArena, lado: Lado): EquipoPrevia {
  const formacion = registro.config.formaciones[lado];
  const propios = registro.inicial.jugadores.filter(j => j.lado === lado);
  const slots = puestos(formacion);
  if (propios.length !== slots.length) throw new Error("Alineación inconsistente");
  const referencias = anclas(formacion, "local", "base");
  const lista = slots.map(puesto => {
    const candidatos = propios.filter(j => j.puesto === puesto);
    if (candidatos.length !== 1 || !referencias[puesto]) throw new Error("Alineación inconsistente");
    return { puesto, jugador: candidatos[0]!, ...proyectarPrevia(referencias[puesto]!) };
  });
  const conteo = new Map<PerfilJugador, number>();
  for (const j of propios) if (j.personalidad) conteo.set(j.personalidad.perfil, (conteo.get(j.personalidad.perfil) ?? 0) + 1);
  const perfiles = [...conteo].map(([perfil, n]) => ({ perfil, n }))
    .sort((a, b) => b.n - a.n || perfilesJugador.indexOf(a.perfil) - perfilesJugador.indexOf(b.perfil));
  const e = registro.config.entrenadores?.[lado];
  const equipo = registro.config.partido[lado];
  return {
    lado, nombre: equipo.nombre, formacion, puestos: lista,
    capitan: propios.find(j => j.capitan) ?? null,
    entrenador: e ? { nombre: e.nombre, perfil: e.perfil, preferidas: [...e.preferidas] } : null,
    banco: registro.inicial.banco?.filter(j => j.lado === lado) ?? [],
    nivelMedio: Math.round(media(propios.map(j => j.nivel))),
    perfiles, ataque: equipo.ataque, defensa: equipo.defensa, estilo: equipo.estilo,
  };
}

/** § 3.1 · Contenido de la tarjeta. Lanza «Alineación inconsistente» si un puesto falta o se repite. */
export function previaVisual(registro: RegistroArena): PreviaVisual {
  const c = registro.config.partido.condiciones;
  return {
    equipos: { local: equipoPrevia(registro, "local"), visita: equipoPrevia(registro, "visita") },
    condiciones: c ? {
      clima: c.clima, ...(c.temperaturaC !== undefined ? { temperaturaC: c.temperaturaC } : {}),
      superficie: c.superficie, ...(c.cesped !== undefined ? { cesped: c.cesped } : {}),
    } : null,
    arbitro: registro.inicial.arbitro?.nombre ?? null,
  };
}

// ——— Bloque B · Previa hablada (§ 3.2–3.6 y v1.1 §§ 4, 7, 8, 13) ———
// Tres intervenciones del estadista en el tick 0, derivadas SOLO de config + inicial: nunca se publican
// en el diario; el cliente y la ruta /relato las vuelven a derivar y coinciden byte a byte.
type Idioma = "es" | "en";
const IDIOMAS = ["es", "en"] as const;
const PL = PREVIA_ARENA.plantillas;
const INTERVALO_PREVIA: [number, number] = [0, 0];

/** Una intervención es de la previa por su forma o por su id. */
export const esPrevia = (i: Pick<IntervencionArena, "id" | "forma">) => i.forma === "previa" || i.id.startsWith("previa:");
/** Id de la pieza n (desde 1) según PREVIA_ARENA.piezas. */
export const idPiezaPrevia = (n: number) => `previa:${n}-${PREVIA_ARENA.piezas[n - 1]}:0`;

const rellenar = (plantilla: string, valores: Record<string, string | number>) =>
  plantilla.replace(/\{(\w+)\}/g, (todo, k: string) => Object.hasOwn(valores, k) ? String(valores[k]) : todo);
const minusculaInicial = (s: string) => s ? s[0]!.toLocaleLowerCase() + s.slice(1) : s;
/** v1.1 § 13 · «4-3-3» → «cuatro-tres-tres» / «four-three-three» con CANTO_GOL.plantillas.numeros. */
export function formacionHablada(formacion: FormacionArena, idioma: Idioma): string {
  return formacion.split("-").map(d => CANTO_GOL.plantillas.numeros[idioma][Number(d)]!).join("-");
}

type Bilingue = Record<Idioma, string>;
interface HechoPrevia { hecho: HechoVerificable; fuente: string }
const hechoPrevia = (id: string, fuente: string, texto: Bilingue, datos: Record<string, string | number>): HechoPrevia =>
  ({ hecho: { id, tipo: "accion_arena", texto_es: texto.es, texto_en: texto.en, eventos: [], relevancia: 50, datos }, fuente });
/** Un turno con su oración: texto bilingüe, hecho principal y apoyos (ids). */
interface TurnoPrevia { rol: "narrador" | "estadista"; texto: Bilingue; principal: string; apoyo: string[] }
const cabe = (turnos: readonly TurnoPrevia[]) => IDIOMAS.every(idioma =>
  turnos.map(t => t.texto[idioma]).join(" ").length <= MESA_ARENA.maxCaracteresIntervencion && turnos.every(t => t.texto[idioma].length <= MESA_ARENA.maxCaracteresOracion));

/** Hechos de un equipo (tabla de v1.1 § 7). */
function hechosEquipo(e: EquipoPrevia) {
  const lado = e.lado, local = lado === "local";
  const equipo = hechoPrevia(`previa:equipo:${lado}`, "config.partido", { es: `${local ? "Local" : "Visitante"}: ${e.nombre}.`, en: `${local ? "Home" : "Away"}: ${e.nombre}.` }, { equipo: e.nombre });
  const formacion = hechoPrevia(`previa:formacion:${lado}`, "config.formaciones", { es: `Formación inicial de ${e.nombre}: ${e.formacion}.`, en: `${e.nombre} starting formation: ${e.formacion}.` },
    { formacion: e.formacion, formacion_hablada_es: formacionHablada(e.formacion, "es"), formacion_hablada_en: formacionHablada(e.formacion, "en") });
  const capitan = e.capitan ? hechoPrevia(`previa:capitan:${lado}`, "inicial.jugadores", { es: `Capitán de ${e.nombre}: ${e.capitan.nombre} (${e.capitan.dorsal}).`, en: `${e.nombre} captain: ${e.capitan.nombre} (${e.capitan.dorsal}).` },
    { capitan: e.capitan.nombre, dorsal: e.capitan.dorsal }) : null;
  const nivel = hechoPrevia(`previa:nivel:${lado}`, "inicial.jugadores", { es: `Nivel medio del once de ${e.nombre}: ${e.nivelMedio}.`, en: `${e.nombre} starting eleven average ability: ${e.nivelMedio}.` },
    { nivel: e.nivelMedio, jugadores: e.puestos.length });
  const entrenador = e.entrenador ? hechoPrevia(`previa:entrenador:${lado}`, "config.entrenadores",
    { es: `Entrenador de ${e.nombre}: ${e.entrenador.nombre} (${etiquetasEntrenador[e.entrenador.perfil].es}).`, en: `${e.nombre} coach: ${e.entrenador.nombre} (${etiquetasEntrenador[e.entrenador.perfil].en}).` },
    { entrenador: e.entrenador.nombre, perfil: e.entrenador.perfil }) : null;
  const perfiles = hechoPrevia(`previa:perfiles:${lado}`, "config.partido", { es: `Perfil de ${e.nombre}: ataque ${e.ataque}, defensa ${e.defensa}, estilo ${PREVIA_ARENA.textos.estilo.es[e.estilo]}.`, en: `${e.nombre} profile: attack ${e.ataque}, defence ${e.defensa}, style ${PREVIA_ARENA.textos.estilo.en[e.estilo]}.` },
    { ataque: e.ataque, defensa: e.defensa, estilo: e.estilo });
  return { equipo, formacion, capitan, nivel, entrenador, perfiles };
}

/** Escalera (v1.1 § 4): aplica en orden los escalones que tengan efecto hasta que la completa quepa. */
function escalera<E>(estado: E, construir: (e: E) => TurnoPrevia[], escalones: { nombre: string; aplica: (e: E) => boolean; aplicar: (e: E) => E }[]) {
  const aplicados: string[] = [];
  for (const paso of escalones) {
    if (cabe(construir(estado))) break;
    if (!paso.aplica(estado)) continue;
    estado = paso.aplicar(estado); aplicados.push(paso.nombre);
  }
  const turnos = construir(estado);
  if (!cabe(turnos)) throw new Error("Previa fuera de presupuesto");
  return { estado, turnos, aplicados };
}

interface Pieza { turnos: TurnoPrevia[]; breve: TurnoPrevia[] | null; escalones: string[]; hechos: HechoPrevia[] }

function piezaEquipo(e: EquipoPrevia): Pieza {
  const h = hechosEquipo(e), capitan = e.capitan?.nombre ?? null, corto = capitan ? apellidoCorto(capitan) : null;
  type Estado = { perfil: boolean; estadista: boolean; capitanCorto: boolean; generico: boolean; capitan: boolean };
  const construir = (s: Estado): TurnoPrevia[] => {
    const texto = (idioma: Idioma, plantilla: "alineacion" | "alineacionSinCapitan") => rellenar(PL[idioma][plantilla], {
      equipo: s.generico ? PL[idioma].referencias[e.lado] : e.nombre, formacion: formacionHablada(e.formacion, idioma), capitan: (s.capitanCorto ? corto : capitan) ?? "",
    });
    const conCapitan = s.capitan && capitan !== null;
    const narr: TurnoPrevia = { rol: "narrador", principal: h.formacion.hecho.id, apoyo: [h.equipo.hecho.id, ...conCapitan ? [h.capitan!.hecho.id] : []],
      texto: { es: texto("es", conCapitan ? "alineacion" : "alineacionSinCapitan"), en: texto("en", conCapitan ? "alineacion" : "alineacionSinCapitan") } };
    if (!s.estadista) return [narr];
    const plantel = (idioma: Idioma) => !e.entrenador ? rellenar(PL[idioma].plantelSinEntrenador, { nivel: e.nivelMedio })
      : rellenar(PL[idioma][s.perfil ? "plantel" : "plantelSinPerfil"], { nivel: e.nivelMedio, entrenador: e.entrenador.nombre, perfil: minusculaInicial(etiquetasEntrenador[e.entrenador.perfil][idioma]) });
    return [narr, { rol: "estadista", principal: h.nivel.hecho.id, apoyo: e.entrenador ? [h.entrenador!.hecho.id] : [], texto: { es: plantel("es"), en: plantel("en") } }];
  };
  const { turnos, aplicados } = escalera<Estado>({ perfil: e.entrenador !== null, estadista: true, capitanCorto: false, generico: false, capitan: capitan !== null }, construir, [
    { nombre: "sin-perfil", aplica: s => s.perfil && s.estadista, aplicar: s => ({ ...s, perfil: false }) },
    { nombre: "sin-estadista", aplica: s => s.estadista, aplicar: s => ({ ...s, estadista: false }) },
    { nombre: "capitan-apellido", aplica: s => s.capitan && !s.capitanCorto && corto !== capitan, aplicar: s => ({ ...s, capitanCorto: true }) },
    { nombre: "equipo-generico", aplica: s => !s.generico, aplicar: s => ({ ...s, generico: true }) },
    { nombre: "sin-capitan", aplica: s => s.capitan, aplicar: s => ({ ...s, capitan: false }) },
  ]);
  // La breve es el turno del narrador; si la completa colapsó (sin estadista), es la misma y no existe aparte.
  const breve = turnos.length > 1 ? turnos.filter(t => t.rol === "narrador") : null;
  return { turnos, breve, escalones: aplicados, hechos: [h.equipo, h.formacion, ...h.capitan ? [h.capitan] : [], h.nivel, ...h.entrenador ? [h.entrenador] : []] };
}

function piezaCondiciones(p: PreviaVisual): Pieza {
  const hl = hechosEquipo(p.equipos.local).perfiles, hv = hechosEquipo(p.equipos.visita).perfiles;
  const c = p.condiciones;
  const arbitro = p.arbitro !== null ? hechoPrevia("previa:arbitro", "inicial.arbitro", { es: `Árbitro: ${p.arbitro}.`, en: `Referee: ${p.arbitro}.` }, { arbitro: p.arbitro }) : null;
  const sup = c ? claveSuperficie(c) : null;
  const condiciones = c ? hechoPrevia("previa:condiciones", "config.partido.condiciones",
    { es: `Condiciones: ${PREVIA_ARENA.textos.clima.es[c.clima]}${c.temperaturaC !== undefined ? `, ${c.temperaturaC} °C` : ""}; ${PREVIA_ARENA.textos.superficie.es[sup!]}.`,
      en: `Conditions: ${PREVIA_ARENA.textos.clima.en[c.clima]}${c.temperaturaC !== undefined ? `, ${c.temperaturaC} °C` : ""}; ${PREVIA_ARENA.textos.superficie.en[sup!]}.` },
    { clima: c.clima, ...c.temperaturaC !== undefined ? { temperatura_c: c.temperaturaC } : {}, superficie: c.superficie, ...c.cesped !== undefined ? { cesped: c.cesped } : {} }) : null;
  type Estado = { temperatura: boolean; arbitro: boolean; narrador: boolean; generico: boolean };
  const construir = (s: Estado): TurnoPrevia[] => {
    const perfiles = (idioma: Idioma) => rellenar(PL[idioma].perfiles, {
      local: s.generico ? PL[idioma].referencias.local : p.equipos.local.nombre, visita: s.generico ? PL[idioma].referencias.visita : p.equipos.visita.nombre,
      a1: p.equipos.local.ataque, d1: p.equipos.local.defensa, a2: p.equipos.visita.ataque, d2: p.equipos.visita.defensa,
    });
    const estad: TurnoPrevia = { rol: "estadista", principal: hl.hecho.id, apoyo: [hv.hecho.id], texto: { es: perfiles("es"), en: perfiles("en") } };
    const conArbitro = s.arbitro && arbitro !== null;
    if (!s.narrador || (!conArbitro && !condiciones)) return [estad];
    const narr = (idioma: Idioma) => [
      ...conArbitro ? [rellenar(PL[idioma].arbitro, { arbitro: p.arbitro! })] : [],
      ...c ? [rellenar(PL[idioma].condiciones, { clima: PREVIA_ARENA.textos.clima[idioma][c.clima], superficie: PREVIA_ARENA.textos.superficie[idioma][sup!],
        temperatura: s.temperatura && c.temperaturaC !== undefined ? rellenar(PL[idioma].temperatura, { n: c.temperaturaC }) : "" })] : [],
    ].join(" ");
    const principal = condiciones ? condiciones.hecho.id : arbitro!.hecho.id;
    const apoyo = condiciones && conArbitro ? [arbitro!.hecho.id] : [];
    return [{ rol: "narrador", principal, apoyo, texto: { es: narr("es"), en: narr("en") } }, estad];
  };
  const { turnos, aplicados } = escalera<Estado>({ temperatura: c?.temperaturaC !== undefined, arbitro: arbitro !== null, narrador: arbitro !== null || c !== null, generico: false }, construir, [
    { nombre: "sin-temperatura", aplica: s => s.narrador && s.temperatura, aplicar: s => ({ ...s, temperatura: false }) },
    { nombre: "sin-arbitro", aplica: s => s.narrador && s.arbitro, aplicar: s => ({ ...s, arbitro: false, narrador: c !== null }) },
    { nombre: "sin-narrador", aplica: s => s.narrador, aplicar: s => ({ ...s, narrador: false }) },
    { nombre: "equipos-genericos", aplica: s => !s.generico, aplicar: s => ({ ...s, generico: true }) },
  ]);
  const breve = turnos.length > 1 ? turnos.filter(t => t.rol === "estadista") : null;
  return { turnos, breve, escalones: aplicados, hechos: [...arbitro ? [arbitro] : [], ...condiciones ? [condiciones] : [], hl, hv] };
}

/** Materializa una pieza como IntervencionArena: una oración por turno, evidencia con una cita por hecho. */
function intervencionPrevia(id: string, pieza: Pieza): IntervencionArena {
  const porId = new Map(pieza.hechos.map(h => [h.hecho.id, h]));
  const oraciones: Oracion[] = pieza.turnos.map(t => ({ texto_es: t.texto.es, texto_en: t.texto.en, hecho: t.principal, apoyo: [...t.apoyo] }));
  const evidencia: EvidenciaMesa[] = pieza.turnos.map(t => {
    const citados = [t.principal, ...t.apoyo];
    const citas = citados.map(hecho => ({ hecho, eventos: [], intervalo: [...INTERVALO_PREVIA] as [number, number], fuente: porId.get(hecho)!.fuente }));
    const fuentes = new Set(citas.map(x => x.fuente));
    // Sin `fuente` plana cuando la oración mezcla procedencias (v1.1 § 7).
    return { eventos: [], intervalo: [...INTERVALO_PREVIA] as [number, number], ...fuentes.size === 1 ? { fuente: citas[0]!.fuente } : {}, citas };
  });
  const citadosTodos = [...new Set(pieza.turnos.flatMap(t => [t.principal, ...t.apoyo]))];
  const turno = (t: TurnoPrevia): TurnoMesa => ({ rol: t.rol, funcion: "dato", texto_es: t.texto.es, texto_en: t.texto.en, oraciones: [pieza.turnos.indexOf(t)] });
  return {
    id, rol: "estadista", tick: 0, tema: "previa", forma: "previa", modo: "determinista", audit: [],
    oraciones, hechos: citadosTodos.map(h => porId.get(h)!.hecho), evidencia,
    turnos: pieza.turnos.map(turno), ...pieza.breve ? { turnosBreve: pieza.breve.map(turno) } : {},
    auditDialogo: { motivos: [], escalones: pieza.escalones },
  };
}

/** Las tres intervenciones habladas, en orden: previa:1-local:0, previa:2-visita:0, previa:3-condiciones:0.
 * Lanza «Alineación inconsistente» como previaVisual. */
export function previaPartido(registro: RegistroArena): IntervencionArena[] {
  const p = previaVisual(registro);
  const piezas: Record<(typeof PREVIA_ARENA.piezas)[number], Pieza> = { local: piezaEquipo(p.equipos.local), visita: piezaEquipo(p.equipos.visita), condiciones: piezaCondiciones(p) };
  return PREVIA_ARENA.piezas.map((clave, k) => intervencionPrevia(idPiezaPrevia(k + 1), piezas[clave]));
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
/** § 3.6 · Re-deriva la previa del registro y compara la pieza con el mismo id campo a campo; cada
 * diferencia es un motivo P1 con la ruta del campo (vacío = igual). */
export function comprobarPrevia(i: IntervencionArena, registro: RegistroArena): { regla: "P1"; detalle: string }[] {
  let piezas: IntervencionArena[];
  try { piezas = previaPartido(registro); } catch (error) { return [{ regla: "P1", detalle: `registro: ${(error as Error).message}` }]; }
  const esperada = piezas.find(p => p.id === i.id);
  if (!esperada) return [{ regla: "P1", detalle: `id: ${i.id} no es una pieza de la previa` }];
  const rutas: string[] = [];
  diferencias(JSON.parse(JSON.stringify(i)), JSON.parse(JSON.stringify(esperada)), "", rutas);
  return rutas.map(ruta => ({ regla: "P1", detalle: `${ruta}: no coincide con la previa derivada del registro` }));
}
