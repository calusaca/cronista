import { ARENA } from "../sim/limites";
import { finalDelPrefijo } from "./estadisticas";
import type { ComentarioArena } from "./narrador";
import { RELATO_INTERVALOS, type CitaMesa, type FormaDialogo, type FuncionTurno, type IntervencionArena, type RolMesa } from "./protocolo";
import { construirRelato, marcadorTrasGol } from "./relato";
import type { RegistroArena } from "./tipos";

/** Brief 053 (v1.1) · Transcripción verificable de la transmisión, derivada en el cliente SOLO de
 * lo publicado: el registro (relato por plantillas de `construirRelato(…, "completo")`) y el diario
 * (`comentarios` e `intervenciones`). Sin estado de módulo, sin red, sin LLM, sin `Date` implícito:
 * `generado` lo inyecta el llamador. Nada con `tick > hastaTick` entra en el archivo. */
export { finalDelPrefijo };

export const TRANSCRIPCION_VERSION = "transcripcion-arena-v1" as const;
type Idioma = "es" | "en";

export interface EntradaTranscripcion {
  registro: RegistroArena; comentarios: readonly ComentarioArena[]; intervenciones: readonly IntervencionArena[];
  sesion?: string | null; generado: string;
}
export type OrigenLinea = "relato" | "comentario" | "intervencion";
/** v1.1 § 6 · Procedencia de UNA oración (sin fusionar intervalos de oraciones distintas). */
export interface EvidenciaOracion { hechos: string[]; eventos: string[]; intervalo?: [number, number]; fuente?: string; citas?: CitaMesa[] }
export interface EvidenciaLinea {
  /** ids de EventoArena, por posición en `registro.eventos`, sin repetir. */
  eventos: string[];
  /** ids de HechoVerificable citados (principal, apoyos y `refiere`), sin repetir; [] en el relato. */
  hechos: string[];
  /** ticks de posiciones observadas (conducciones y marcas del relato). */
  fotogramas: number[];
  /** Solo cuando la línea tiene UNA oración y su evidencia los trae (dato del estadista). */
  intervalo?: [number, number]; fuente?: string;
  /** Procedencia por hecho citado (datos del estadista), copiada de `evidencia[k].citas`. */
  citas?: CitaMesa[];
  /** Turno con varias oraciones: una entrada por oración; los campos planos son la unión de eventos y hechos. */
  oraciones?: EvidenciaOracion[];
}
export type ClaseVerificacion = "plantilla-sin-verificar" | "respaldo-verificado" | "llm-aprobado" | "dato-determinista" | "marco-de-dialogo";
export interface VerificacionLinea {
  /** V1–V8 sobre el TEXTO PUBLICADO de esta línea. */
  v: { estado: "aprobada" | "no-aplica" };
  /** D1–D5 sobre el intercambio al que pertenece la línea. */
  d: { estado: "aprobada" | "no-aplica" };
  /** Historial de generación de la candidatura (informativo): intentos LLM rechazados antes del
   * texto publicado. Nunca describe la línea; nunca se copia a líneas de otro rol. `dialogo`: motivos
   * D1–D5 de una composición rechazada (la intervención se publicó sin `turnos`). */
  historial?: { intentos: number; rechazados: number; motivos: string[]; dialogo?: string[] };
  clase: ClaseVerificacion;
}
export interface LineaTranscripcion {
  n: number; tick: number; reloj: string;
  rol: RolMesa; origen: OrigenLinea; modo: "plantilla" | "llm" | "determinista"; modelo?: string;
  texto: string; texto_es: string; texto_en: string;
  evidencia: EvidenciaLinea; verificacion: VerificacionLinea;
  comentario?: { principal: string; oracion: number };
  intervencion?: { id: string; tema: string; forma?: FormaDialogo; turno?: number; funcion?: FuncionTurno; plantilla?: string; refiere?: string[]; oracion?: number; escalones?: string[] };
}
export interface TranscripcionArena {
  version: typeof TRANSCRIPCION_VERSION; generado: string; idioma: Idioma;
  /** v1.1 § 10 · Este archivo no es un registro: `/api/arena reproducir` lo rechaza. */
  importable: false;
  partido: { seed: number; version: RegistroArena["version"]; local: string; visita: string; duracionS: number; marcador: { local: number; visita: number } };
  /** v1.1 § 5 · Describe el CORTE exportado: cuentas ≤ hastaTick. */
  registro: { eventos: number; fotogramas: number; sesion: string | null };
  alcance: { hastaTick: number; parcial: boolean };
  /** Cuentas de LÍNEAS: `lineas = relato + comentarios + intervenciones`; `turnos` ⊆ intervenciones. */
  resumen: { lineas: number; relato: number; comentarios: number; intervenciones: number; turnos: number };
  omitido: string[];
  lineas: LineaTranscripcion[];
  diario: { comentarios: ComentarioArena[]; intervenciones: IntervencionArena[] };
}

/** Rótulos ES/EN del Markdown y de la lista `omitido` (completitud probada). */
export const ROTULOS_TRANSCRIPCION = {
  es: {
    titulo: "Transmisión", partido: "Partido simulado", semilla: "semilla", idioma: "idioma ES", sesion: "sesión", generado: "generado",
    completa: "Transcripción completa", parcial: "Transcripción parcial hasta {reloj} (lo publicado al descargar)",
    contiene: "Qué contiene", transmision: "Transmisión",
    resumen: "{n} líneas: {a} del relato por plantillas, {b} de comentarios del narrador (IA), {c} de la mesa ({d} turnos).",
    noContiene: "No contiene:",
    orden: "Orden canónico por tiempo; la pista de audio inserta a los invitados tras la ventana del narrador, salvo la previa, que va antes del primer tramo.",
    nota: "Las líneas del relato por plantillas no pasan por el verificador V1–V8. Los comentarios de IA y sus respaldos por plantilla se publican solo verificados con V1–V8; los datos del estadista son deterministas; los diálogos de la mesa superaron D1–D5. La previa (alineaciones, técnicos y condiciones) se deriva del registro por plantilla determinista. En el directo, si la narración está activa antes del saque, la antesala lee las alineaciones por líneas (plantilla determinista); esta transcripción conserva la previa del registro.",
    noImportable: "Este archivo no es un registro del partido y no se puede importar; el registro se descarga en «Partidos guardados».",
    roles: { narrador: "Narrador", comentarista: "Comentarista", estadista: "Estadista" },
    relato: "relato", comentario: "comentario", conversacion: "Conversación", intervencion: "intervención",
    modos: { plantilla: "plantilla", llm: "IA", determinista: "determinista" },
    funciones: { pregunta: "pregunta", cesion: "cesión", respuesta: "respuesta", dato: "dato", cierre: "cierre" },
    formas: { pregunta: "pregunta", dato: "dato", ronda: "ronda", estadista: "estadista", final: "final", previa: "previa" },
    evidencia: "Evidencia", eventos: "eventos", hechos: "hechos", posiciones: "posiciones", intervalo: "intervalo", refiere: "refiere", oracion: "oración", plantilla: "plantilla",
    verificacion: "Verificación del texto", vAprobada: "V1–V8 aprobado", dAprobada: "D1–D5 aprobado",
    clases: {
      "plantilla-sin-verificar": "plantilla determinista, sin verificar (no pasa por V1–V8)",
      "respaldo-verificado": "respaldo por plantilla verificado",
      "llm-aprobado": "texto de IA verificado",
      "dato-determinista": "dato determinista (sin V1–V8)",
      "marco-de-dialogo": "marco de diálogo por plantilla (sin V1–V8)",
    },
    historial: "Historial de generación (intentos descartados)", intentos: "intentos: {i}; descartados: {r}",
    dialogo: "Composición de diálogo rechazada (D1–D5)", escalones: "escalones",
    ninguna: "—",
    omitido: [
      "Las reservas de voz (archivos estáticos que no están en el diario).",
      "El comentario editorial en vivo (depende de la memoria de cada espectador).",
      "La variante breve de los intercambios; se transcribe la completa.",
      "Las cesiones del narrador a las intervenciones sin turnos (se deciden al sintetizar).",
      "Qué intervenciones caducaron o no sonaron. Orden canónico por tiempo; la pista de audio inserta a los invitados tras la ventana del narrador, salvo la previa, que va antes del primer tramo.",
      "La descripción evento a evento (está en el registro del partido).",
    ],
  },
  en: {
    titulo: "Broadcast transcript", partido: "Simulated match", semilla: "seed", idioma: "language EN", sesion: "session", generado: "generated",
    completa: "Full transcript", parcial: "Partial transcript up to {reloj} (what was published at download time)",
    contiene: "What it contains", transmision: "Broadcast",
    resumen: "{n} lines: {a} from the template play-by-play, {b} from narrator commentary (AI), {c} from the desk ({d} turns).",
    noContiene: "Not included:",
    orden: "Canonical order by time; the audio track inserts guests after the narrator's window, except the pre-match segment, which comes before the first passage.",
    nota: "Template play-by-play lines do not go through the V1–V8 verifier. AI commentary and its template fallbacks are only published after passing V1–V8; statistician data are deterministic; desk dialogues passed D1–D5. The pre-match segment (line-ups, coaches and conditions) is derived from the match run by deterministic template. In the live view, if narration is on before kick-off, the pre-match presentation reads the line-ups by lines (deterministic template); this transcript keeps the pre-match segment from the run.",
    noImportable: "This file is not a match run and cannot be imported; the run is downloaded under “Saved matches”.",
    roles: { narrador: "Narrator", comentarista: "Commentator", estadista: "Statistician" },
    relato: "play-by-play", comentario: "commentary", conversacion: "Conversation", intervencion: "intervention",
    modos: { plantilla: "template", llm: "AI", determinista: "deterministic" },
    funciones: { pregunta: "question", cesion: "hand-over", respuesta: "answer", dato: "data", cierre: "close" },
    formas: { pregunta: "question", dato: "data", ronda: "round", estadista: "statistician", final: "final", previa: "pre-match" },
    evidencia: "Evidence", eventos: "events", hechos: "facts", posiciones: "positions", intervalo: "interval", refiere: "refers to", oracion: "sentence", plantilla: "template",
    verificacion: "Text checks", vAprobada: "V1–V8 passed", dAprobada: "D1–D5 passed",
    clases: {
      "plantilla-sin-verificar": "deterministic template, not verified (does not go through V1–V8)",
      "respaldo-verificado": "verified template fallback",
      "llm-aprobado": "verified AI text",
      "dato-determinista": "deterministic data (no V1–V8)",
      "marco-de-dialogo": "template dialogue frame (no V1–V8)",
    },
    historial: "Generation history (discarded attempts)", intentos: "attempts: {i}; discarded: {r}",
    dialogo: "Rejected dialogue composition (D1–D5)", escalones: "steps",
    ninguna: "—",
    omitido: [
      "Backup voice clips (static files that are not in the session log).",
      "Live editorial commentary (it depends on each viewer's memory).",
      "The short variant of exchanges; the full variant is transcribed.",
      "Narrator hand-overs to interventions without turns (decided at synthesis time).",
      "Which interventions expired or were not heard. Canonical order by time; the audio track inserts guests after the narrator's window, except the pre-match segment, which comes before the first passage.",
      "The event-by-event description (it is in the match run).",
    ],
  },
} as const;

const rellenar = (plantilla: string, valores: Record<string, string | number>) => plantilla.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k]));
/** "m:ss.d" desde el tick (los ticks son de `ARENA.pasoS` segundos). */
export function relojTranscripcion(tick: number): string {
  const decimas = Math.round(tick * ARENA.pasoS * 10);
  return `${Math.floor(decimas / 600)}:${String(Math.floor((decimas % 600) / 10)).padStart(2, "0")}.${decimas % 10}`;
}
const unicos = <T,>(xs: Iterable<T>) => [...new Set(xs)];

type Historial = NonNullable<VerificacionLinea["historial"]>;
/** `audit` vacío o ausente ⇒ sin historial; `exigirRechazo` (comentarios del narrador): solo si hay intentos con motivos. */
function historialDe(audit: ComentarioArena["audit"] | undefined, exigirRechazo: boolean): Historial | undefined {
  if (!audit?.length) return undefined;
  const rechazados = audit.filter(a => a.motivos?.length).length;
  if (exigirRechazo && !rechazados) return undefined;
  return { intentos: audit.length, rechazados, motivos: audit.flatMap(a => (a.motivos ?? []).map(m => `intento ${a.intento} · ${m.regla}: ${m.detalle}`)) };
}

type Borrador = { linea: Omit<LineaTranscripcion, "n" | "texto" | "reloj">; clave: [number, number, number, number] };
const ORIGEN: Record<OrigenLinea, number> = { relato: 0, comentario: 1, intervencion: 2 };

export function construirTranscripcion(entrada: EntradaTranscripcion, hastaTick: number, idioma: Idioma): TranscripcionArena {
  const { registro } = entrada;
  if (!Number.isInteger(hastaTick) || hastaTick < 0 || hastaTick > registro.final.tick) throw new Error("Corte de transcripción inválido");
  if (idioma !== "es" && idioma !== "en") throw new Error("Idioma de transcripción inválido");
  const posicion = new Map(registro.eventos.map((e, i) => [e.id, i]));
  const ordenar = (ids: Iterable<string>) => unicos(ids).sort((a, b) => (posicion.get(a) ?? Number.MAX_SAFE_INTEGER) - (posicion.get(b) ?? Number.MAX_SAFE_INTEGER));
  const borradores: Borrador[] = [];
  // Brief 056 § 5.7 · La previa tiene clave de origen −1: precede al relato del tick 0.
  const agregar = (linea: Borrador["linea"], pos: number, k: number) => borradores.push({ linea, clave: [linea.tick, linea.intervencion?.forma === "previa" ? -1 : ORIGEN[linea.origen], pos, k] });

  // Relato por plantillas: ventanas de RELATO_INTERVALOS.completo, ES y EN alineadas uno a uno.
  // Ronda 2 · Con corte 0 entran también las líneas de tick 0 («Comienza…» y eventos del tick 0):
  // construirRelato exige hastaTick > desdeTick, así que la ventana inicial se construye sobre el
  // registro recortado a tick ≤ 0 (sin eventos ni fotogramas futuros) y se conservan solo sus
  // fragmentos de tick 0. `final` solo se usa ahí para validar la ventana [0, 1].
  const intervalo = RELATO_INTERVALOS.completo;
  const ventanas: [RegistroArena, number, number][] = [];
  if (hastaTick === 0) {
    const inicial: RegistroArena = { ...registro, eventos: registro.eventos.filter(e => e.tick <= 0), fotogramas: registro.fotogramas.filter(f => f.tick <= 0), final: registro.final.tick >= 1 ? registro.final : { ...registro.final, tick: 1 } };
    ventanas.push([inicial, 0, 1]);
  }
  for (let inicio = 0; inicio < hastaTick; inicio += intervalo) ventanas.push([registro, inicio, Math.min(inicio + intervalo, hastaTick)]);
  let p = 0;
  for (const [fuente, inicio, hasta] of ventanas) {
    const corte = (f: { tick: number }) => f.tick <= hastaTick;
    const es = construirRelato(fuente, inicio, hasta, "completo", "es").fragmentos.filter(corte), en = construirRelato(fuente, inicio, hasta, "completo", "en").fragmentos.filter(corte);
    if (es.length !== en.length) throw new Error("Relato ES/EN desalineado");
    es.forEach((f, k) => {
      const g = en[k]!;
      if (g.tick !== f.tick) throw new Error("Relato ES/EN desalineado");
      agregar({
        tick: f.tick, rol: "narrador", origen: "relato", modo: "plantilla", texto_es: f.texto, texto_en: g.texto,
        evidencia: { eventos: ordenar(f.fuentes), hechos: [], fotogramas: [...f.fotogramas] },
        verificacion: { v: { estado: "no-aplica" }, d: { estado: "no-aplica" }, clase: "plantilla-sin-verificar" },
      }, p++, 0);
    });
  }

  // Comentarios LLM del narrador: una línea por oración; V1–V8 sobre el texto publicado.
  const comentarios = entrada.comentarios.filter(c => c.tick <= hastaTick);
  entrada.comentarios.forEach((c, pos) => {
    if (c.tick > hastaTick) return;
    const historial = historialDe(c.audit, true);
    c.oraciones.forEach((o, k) => {
      const hechos = unicos([o.hecho, ...o.apoyo ?? []]);
      agregar({
        tick: c.tick, rol: "narrador", origen: "comentario", modo: c.modo, ...(c.modo === "llm" && c.modelo ? { modelo: c.modelo } : {}),
        texto_es: o.texto_es, texto_en: o.texto_en,
        evidencia: { eventos: ordenar(hechos.flatMap(id => c.hechos.find(h => h.id === id)?.eventos ?? [])), hechos, fotogramas: [] },
        verificacion: { v: { estado: "aprobada" }, d: { estado: "no-aplica" }, clase: c.modo === "llm" ? "llm-aprobado" : "respaldo-verificado", ...(historial ? { historial } : {}) },
        comentario: { principal: c.principal, oracion: k },
      }, pos, k);
    });
  });

  // Intervenciones de la mesa, en el orden del diario.
  const intervenciones = entrada.intervenciones.filter(i => i.tick <= hastaTick);
  const evidenciaDe = (i: IntervencionArena, indices: readonly number[], refiere: readonly string[]): EvidenciaLinea => {
    const oraciones: EvidenciaOracion[] = indices.map(o => {
      const oracion = i.oraciones[o], ev = i.evidencia[o];
      return {
        hechos: oracion ? unicos([oracion.hecho, ...oracion.apoyo ?? []]) : [], eventos: ordenar(ev?.eventos ?? []),
        ...(ev?.intervalo ? { intervalo: [ev.intervalo[0], ev.intervalo[1]] as [number, number] } : {}), ...(ev?.fuente ? { fuente: ev.fuente } : {}),
        ...(ev?.citas?.length ? { citas: structuredClone(ev.citas) } : {}),
      };
    });
    const evidencia: EvidenciaLinea = {
      eventos: ordenar([...oraciones.flatMap(o => o.eventos), ...refiere.flatMap(r => i.hechos.find(h => h.id === r)?.eventos ?? [])]),
      hechos: unicos([...oraciones.flatMap(o => o.hechos), ...refiere]), fotogramas: [],
    };
    if (oraciones.length === 1) {
      const o = oraciones[0]!;
      if (o.intervalo) evidencia.intervalo = o.intervalo;
      if (o.fuente) evidencia.fuente = o.fuente;
      if (o.citas) evidencia.citas = o.citas;
    } else if (oraciones.length > 1) evidencia.oraciones = oraciones;
    return evidencia;
  };
  entrada.intervenciones.forEach((i, pos) => {
    if (i.tick > hastaTick) return;
    const escalones = i.auditDialogo?.escalones?.length ? { escalones: [...i.auditDialogo.escalones] } : {};
    const base = { id: i.id, tema: i.tema, ...(i.forma ? { forma: i.forma } : {}), ...escalones };
    // El historial del comentarista nunca se copia a líneas del estadista ni del narrador.
    const historialC = i.rol === "comentarista" ? historialDe(i.audit, false) : undefined;
    const claseInvitado = (rol: Exclude<RolMesa, "narrador">): ClaseVerificacion => rol === "estadista" ? "dato-determinista" : i.modo === "llm" ? "llm-aprobado" : "respaldo-verificado";
    if (i.forma === "previa" && i.turnos?.length) {
      // Brief 056 § 5.7 · Previa: una línea por turno, dato determinista (también el narrador, que lee un
      // dato del registro), sin V1–V8 ni D1–D5 (su garantía es la reconstrucción exacta, comprobarPrevia).
      i.turnos.forEach((t, k) => agregar({
        tick: i.tick, rol: t.rol, origen: "intervencion", modo: "determinista", texto_es: t.texto_es, texto_en: t.texto_en, evidencia: evidenciaDe(i, t.oraciones, []),
        verificacion: { v: { estado: "no-aplica" }, d: { estado: "no-aplica" }, clase: "dato-determinista" },
        intervencion: { ...base, turno: k, funcion: "dato" },
      }, pos, k));
      return;
    }
    if (i.turnos?.length) {
      // 048 · Una línea por turno de la variante completa; D1–D5 aprobados (si no, no habría turnos).
      i.turnos.forEach((t, k) => {
        const refiere = t.refiere ?? [];
        const modo = t.rol === "estadista" ? "determinista" : t.rol === "narrador" && t.plantilla ? "plantilla" : i.modo;
        const clase: ClaseVerificacion = t.rol === "narrador" ? "marco-de-dialogo" : claseInvitado(t.rol);
        const historial = t.rol === "comentarista" ? historialC : undefined;
        agregar({
          tick: i.tick, rol: t.rol, origen: "intervencion", modo, ...(modo === "llm" && i.modelo ? { modelo: i.modelo } : {}),
          texto_es: t.texto_es, texto_en: t.texto_en, evidencia: evidenciaDe(i, t.oraciones, refiere),
          verificacion: { v: { estado: t.rol === "comentarista" ? "aprobada" : "no-aplica" }, d: { estado: "aprobada" }, clase, ...(historial ? { historial } : {}) },
          intervencion: { ...base, turno: k, funcion: t.funcion, ...(t.plantilla ? { plantilla: t.plantilla } : {}), ...(refiere.length ? { refiere: [...refiere] } : {}) },
        }, pos, k);
      });
      return;
    }
    // 045 (o composición rechazada por D1–D5): una línea por oración, sin D. Ronda 2 · El rechazo D
    // pertenece a ESA composición: `historial.dialogo` también en las líneas del estadista, sin
    // intentos V inventados (0) ni historial LLM del comentarista.
    const dialogo = i.auditDialogo?.motivos?.length ? i.auditDialogo.motivos.map(m => `${m.regla}: ${m.detalle}`) : undefined;
    const historial: Historial | undefined = dialogo ? { ...historialC ?? { intentos: 0, rechazados: 0, motivos: [] }, dialogo } : historialC;
    const modo = i.rol === "estadista" ? "determinista" : i.modo;
    i.oraciones.forEach((o, k) => {
      agregar({
        tick: i.tick, rol: i.rol, origen: "intervencion", modo, ...(modo === "llm" && i.modelo ? { modelo: i.modelo } : {}),
        texto_es: o.texto_es, texto_en: o.texto_en, evidencia: evidenciaDe(i, [k], []),
        verificacion: { v: { estado: i.rol === "comentarista" ? "aprobada" : "no-aplica" }, d: { estado: "no-aplica" }, clase: claseInvitado(i.rol), ...(historial ? { historial } : {}) },
        intervencion: { ...base, oracion: k },
      }, pos, k);
    });
  });

  borradores.sort((a, b) => a.clave[0] - b.clave[0] || a.clave[1] - b.clave[1] || a.clave[2] - b.clave[2] || a.clave[3] - b.clave[3]);
  const lineas: LineaTranscripcion[] = borradores.map(({ linea }, k) => ({
    n: k + 1, tick: linea.tick, reloj: relojTranscripcion(linea.tick), rol: linea.rol, origen: linea.origen, modo: linea.modo, ...(linea.modelo ? { modelo: linea.modelo } : {}),
    texto: idioma === "es" ? linea.texto_es : linea.texto_en, texto_es: linea.texto_es, texto_en: linea.texto_en,
    evidencia: linea.evidencia, verificacion: linea.verificacion,
    ...(linea.comentario ? { comentario: linea.comentario } : {}), ...(linea.intervencion ? { intervencion: linea.intervencion } : {}),
  }));
  const cuenta = (origen: OrigenLinea) => lineas.filter(l => l.origen === origen).length;
  return {
    version: TRANSCRIPCION_VERSION, generado: entrada.generado, idioma, importable: false,
    partido: {
      seed: registro.config.partido.seed, version: registro.version, local: registro.config.partido.local.nombre, visita: registro.config.partido.visita.nombre,
      duracionS: registro.config.duracionS, marcador: marcadorTrasGol(registro, hastaTick),
    },
    registro: { eventos: registro.eventos.filter(e => e.tick <= hastaTick).length, fotogramas: registro.fotogramas.filter(f => f.tick <= hastaTick).length, sesion: entrada.sesion ?? null },
    alcance: { hastaTick, parcial: !finalDelPrefijo(registro, hastaTick) },
    resumen: { lineas: lineas.length, relato: cuenta("relato"), comentarios: cuenta("comentario"), intervenciones: cuenta("intervencion"), turnos: lineas.filter(l => l.intervencion?.turno !== undefined).length },
    omitido: [...ROTULOS_TRANSCRIPCION[idioma].omitido],
    lineas,
    diario: { comentarios, intervenciones },
  };
}

/** v1.1 § 7 · Barra invertida ante \ ` * _ [ ] < > # | ~ y saltos de línea sustituidos por un espacio. */
export function escaparMarkdown(texto: string): string {
  return String(texto).replace(/\r\n|\r|\n/g, " ").replace(/[\\`*_[\]<>#|~]/g, c => `\\${c}`);
}

/** Markdown legible: listas, nunca tablas; todo campo dinámico escapado y en la misma línea que su rótulo. */
export function transcripcionMarkdown(t: TranscripcionArena): string {
  const R = ROTULOS_TRANSCRIPCION[t.idioma], x = escaparMarkdown;
  const decimal = (n: number) => t.idioma === "es" ? n.toFixed(1).replace(".", ",") : n.toFixed(1);
  const segundos = (tick: number) => `${decimal(tick * ARENA.pasoS)} s`;
  const salida: string[] = [];
  const m = t.partido.marcador;
  salida.push(`# ${x(t.partido.local)} ${m.local}–${m.visita} ${x(t.partido.visita)} · ${R.titulo}`);
  salida.push(`${R.partido} · ${R.semilla} ${t.partido.seed} · ${t.partido.duracionS} s · ${x(t.partido.version)} · ${R.idioma} · ${R.sesion} ${t.registro.sesion ? x(t.registro.sesion) : R.ninguna} · ${R.generado} ${x(t.generado)}`);
  salida.push("", `**${t.alcance.parcial ? rellenar(R.parcial, { reloj: relojTranscripcion(t.alcance.hastaTick) }) : R.completa}**`, "");
  salida.push(`## ${R.contiene}`);
  salida.push(`- ${rellenar(R.resumen, { n: t.resumen.lineas, a: t.resumen.relato, b: t.resumen.comentarios, c: t.resumen.intervenciones, d: t.resumen.turnos })}`);
  salida.push(`- ${R.noContiene}`, ...t.omitido.map(o => `  - ${x(o)}`));
  salida.push(`- ${R.orden}`, `- ${R.nota}`, `- ${R.noImportable}`, "");
  salida.push(`## ${R.transmision}`);

  const evidencia = (e: EvidenciaLinea) => {
    const partes: string[] = [];
    const procedencia = (p: { eventos: string[]; hechos?: string[]; intervalo?: [number, number]; fuente?: string; citas?: CitaMesa[] }) => {
      const q: string[] = [];
      if (p.eventos.length) q.push(`${R.eventos} ${p.eventos.map(x).join(" · ")}`);
      if (p.hechos?.length) q.push(`${R.hechos} ${p.hechos.map(x).join(" · ")}`);
      if (p.intervalo) q.push(`${R.intervalo} ${decimal(p.intervalo[0] * ARENA.pasoS)}–${segundos(p.intervalo[1])}${p.fuente ? ` · ${x(p.fuente)}` : ""}`);
      else if (p.fuente) q.push(x(p.fuente));
      for (const c of p.citas ?? []) q.push(`${x(c.hecho)} (${[c.eventos.map(x).join(" · "), c.intervalo ? `${R.intervalo} ${decimal(c.intervalo[0] * ARENA.pasoS)}–${segundos(c.intervalo[1])}` : "", c.fuente ? x(c.fuente) : ""].filter(Boolean).join("; ") || R.ninguna})`);
      return q;
    };
    if (e.oraciones) e.oraciones.forEach((o, k) => partes.push(`${R.oracion} ${k + 1}: ${procedencia(o).join(" · ") || R.ninguna}`));
    else partes.push(...procedencia(e));
    if (e.fotogramas.length) partes.push(`${R.posiciones} ${e.fotogramas.map(segundos).join(" · ")}`);
    return partes.join(" · ") || R.ninguna;
  };
  const verificacion = (v: VerificacionLinea) => [R.clases[v.clase], ...(v.v.estado === "aprobada" ? [R.vAprobada] : []), ...(v.d.estado === "aprobada" ? [R.dAprobada] : [])].join(" · ");
  const detalles = (l: LineaTranscripcion, sangria: string) => {
    const r = [`${sangria}- ${R.evidencia}: ${evidencia(l.evidencia)}`, `${sangria}- ${R.verificacion}: ${verificacion(l.verificacion)}`];
    const h = l.verificacion.historial;
    // El historial solo se rotula cuando hubo intentos descartados (el JSON lo conserva siempre).
    if (h && (h.rechazados || h.motivos.length)) r.push(`${sangria}- ${R.historial}: ${rellenar(R.intentos, { i: h.intentos, r: h.rechazados })}${h.motivos.length ? ` · ${h.motivos.map(x).join(" · ")}` : ""}`);
    if (h?.dialogo?.length) r.push(`${sangria}- ${R.dialogo}: ${h.dialogo.map(x).join(" · ")}`);
    return r;
  };
  const modo = (l: LineaTranscripcion) => `${R.modos[l.modo]}${l.modelo ? ` · ${x(l.modelo)}` : ""}`;

  for (let k = 0; k < t.lineas.length; k++) {
    const l = t.lineas[k]!;
    if (l.origen !== "intervencion") {
      const etiqueta = l.origen === "relato" ? R.relato : R.comentario;
      salida.push(`### [${l.reloj}] ${R.roles[l.rol]} · ${etiqueta} · ${modo(l)}: ${x(l.texto)}`, ...detalles(l, ""));
      continue;
    }
    // Un intercambio (misma intervención) se agrupa bajo un encabezado con sus turnos numerados.
    const id = l.intervencion!.id, grupo: LineaTranscripcion[] = [];
    while (k < t.lineas.length && t.lineas[k]!.origen === "intervencion" && t.lineas[k]!.intervencion!.id === id) grupo.push(t.lineas[k++]!);
    k--;
    const i = l.intervencion!;
    const titulo = i.turno !== undefined ? `${R.conversacion}${i.forma ? ` · ${R.formas[i.forma]}` : ""}` : `${R.roles[l.rol]} · ${R.intervencion}`;
    salida.push(`### [${l.reloj}] ${titulo} · ${x(id)}${i.escalones?.length ? ` · ${R.escalones} ${i.escalones.map(x).join(" · ")}` : ""}`);
    grupo.forEach((g, n) => {
      const gi = g.intervencion!;
      const rotulo = [gi.funcion ? R.funciones[gi.funcion] : undefined, gi.plantilla ? `${R.plantilla} ${x(gi.plantilla)}` : modo(g), gi.refiere?.length ? `${R.refiere} ${gi.refiere.map(x).join(" · ")}` : undefined].filter(Boolean).join(" · ");
      salida.push(`${n + 1}. **${R.roles[g.rol]}** (${rotulo}): ${x(g.texto)}`, ...detalles(g, "   "));
    });
  }
  return salida.join("\n") + "\n";
}

/** JSON con `JSON.stringify(t, null, 1)` y salto final. */
export const transcripcionJson = (t: TranscripcionArena) => JSON.stringify(t, null, 1) + "\n";

type ParaNombre = { partido: Pick<TranscripcionArena["partido"], "seed">; idioma: Idioma; alcance: TranscripcionArena["alcance"] };
/** `cronista-arena-<seed>-comentarios-<idioma>[-parcial-<hastaTick>].md|json` y
 * `cronista-arena-<seed>-narracion-<idioma>-<hastaTick>.wav`. */
export function nombreDescarga(t: ParaNombre, extension: "md" | "json" | "wav"): string {
  const base = `cronista-arena-${t.partido.seed}`;
  if (extension === "wav") return `${base}-narracion-${t.idioma}-${t.alcance.hastaTick}.wav`;
  return `${base}-comentarios-${t.idioma}${t.alcance.parcial ? `-parcial-${t.alcance.hastaTick}` : ""}.${extension}`;
}
