// Brief 064 § 4.9 y § 5.2 · Funciones puras de la página de crónica de arena (sin React, DOM, red ni servidor; las usa
// el cliente). La cadena oración → hechos → eventos con ids de arena (`a12`, que el `esMacro` de `vista/evidencia.ts`
// dejaría fuera), su inversa, la línea de tiempo, el segundo del salto y el enlace a la repetición. También el tipo de
// las fuentes y la precedencia del cliente (§ 4.7).
import type { CronicaVerificada } from "../cadena/tipos";
import type { HechoVerificable } from "../cadena/verificador";
import { ARENA, CRONICA_ARENA } from "../sim/limites";
import { hechosDeOracion } from "../vista/evidencia";
import type { ContextoModelos } from "./modelos-jugados";
import type { OrigenTorneo } from "./torneo";
import type { EventoArena, RegistroArena } from "./tipos";

/** § 4.7 · Una de las cinco fuentes del POST. */
export type FuenteCronica =
  | { sesion: string }
  | { torneo: string; encuentro: string }
  | { archivo: "duelo" | "ejemplo-v3" | "ejemplo" }
  | { registro: unknown }
  | { huella: string };

/** § 4.7 · Origen guardado con la primera fuente de una huella. */
export interface OrigenCronica {
  tipo: "sesion" | "torneo" | "ejemplo" | "subida";
  contexto: ContextoModelos;
  torneo?: OrigenTorneo;
}

/** § 4.7 · Precedencia en la arena (cliente): torneo → archivo → sesión verificada → registro. */
export function fuenteCronica(estado: {
  origenTorneo: OrigenTorneo | null;
  archivoActual: "duelo" | "ejemplo-v3" | "ejemplo" | null;
  contextoModelos: ContextoModelos;
  sesionActual: string | null;
  registro: unknown;
}): FuenteCronica {
  if (estado.origenTorneo) return { torneo: estado.origenTorneo.id, encuentro: String(estado.origenTorneo.n).padStart(2, "0") };
  if (estado.archivoActual) return { archivo: estado.archivoActual };
  if (estado.contextoModelos.forma === "sesion" && estado.sesionActual) return { sesion: estado.sesionActual };
  return { registro: estado.registro };
}

/** Clave estable de una fuente (una sola petición por fuente en el documento). */
export function claveFuente(f: FuenteCronica): string {
  if ("torneo" in f) return `t:${f.torneo}:${f.encuentro}`;
  if ("archivo" in f) return `a:${f.archivo}`;
  if ("sesion" in f) return `s:${f.sesion}`;
  if ("huella" in f) return `h:${f.huella}`;
  return "r";
}

const esArena = (id: string) => /^a\d+$/.test(id);
/** Índice en `registro.eventos`: el motor numera `a1, a2, …` en el orden en que los registra. */
const ordenArena = (id: string) => Number(id.slice(1));

/** Eventos (ids `a…`) de la oración i: los de su principal y su apoyo, sin duplicados y en el orden del registro. */
export function eventosDeOracionArena(cronica: Pick<CronicaVerificada, "oraciones">, hechos: Pick<HechoVerificable, "id" | "eventos">[], i: number): string[] {
  const o = cronica.oraciones[i];
  if (!o) return [];
  const porId = new Map(hechos.map((h) => [h.id, h] as const));
  const ids = new Set<string>();
  for (const hid of hechosDeOracion(o)) for (const e of porId.get(hid)?.eventos ?? []) if (esArena(e)) ids.add(e);
  return [...ids].sort((a, b) => ordenArena(a) - ordenArena(b));
}

/** Inversa: índices de las oraciones que citan (vía sus hechos) un evento. */
export function oracionesDeEventoArena(cronica: Pick<CronicaVerificada, "oraciones">, hechos: Pick<HechoVerificable, "id" | "eventos">[], eventoId: string): number[] {
  const out: number[] = [];
  cronica.oraciones.forEach((_, i) => { if (eventosDeOracionArena(cronica, hechos, i).includes(eventoId)) out.push(i); });
  return out;
}

const TIPOS_LINEA = new Set(["gol", "tiro", "atajada", "tiro_fuera", "falta", "amarilla", "roja", "cambio", "fuera_juego", "final_anticipado"]);
/** § 4.9.6 · Eventos de la línea de tiempo: los tipos de la lista, los pases largos y TODO evento citado por un hecho. */
export function lineaTiempoCronica(registro: Pick<RegistroArena, "eventos">, hechos: Pick<HechoVerificable, "eventos">[]): EventoArena[] {
  const citados = new Set(hechos.flatMap((h) => h.eventos));
  return registro.eventos.filter((e) => TIPOS_LINEA.has(e.tipo) || (e.tipo === "pase" && e.motivo === "largo") || citados.has(e.id));
}

/** D13 · Segundo del salto: `max(0, ⌊tick_mín · pasoS⌋ − antesDelEventoS)`; null sin eventos. */
export function segundoDeSalto(eventos: readonly Pick<EventoArena, "tick">[]): number | null {
  if (eventos.length === 0) return null;
  const tick = Math.min(...eventos.map((e) => e.tick));
  return Math.max(0, Math.floor(tick * ARENA.pasoS + 1e-9) - CRONICA_ARENA.antesDelEventoS);
}

/** Reloj m:ss de un segundo. */
export const relojArena = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** § 5.2 · Enlace a la repetición: torneo → `/arena?torneo=<id>&encuentro=<nn>&t=<s>`; si no → `/arena?cronica=<h>&t=<s>`. */
export function enlaceRepeticionCronica(huella: string, origen: Pick<OrigenCronica, "torneo"> | null, s: number, idioma: "es" | "en"): string {
  const q = new URLSearchParams();
  if (origen?.torneo) { q.set("torneo", origen.torneo.id); q.set("encuentro", String(origen.torneo.n).padStart(2, "0")); }
  else q.set("cronica", huella);
  q.set("t", String(s));
  if (idioma === "es") q.set("lang", "es");
  return `/arena?${q.toString()}`;
}
