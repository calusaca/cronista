// Carga de datos para la UI — SOLO servidor (brief 004: sim + analista + cadena corren en
// el server; la API key jamás llega al cliente). Lo que sale de aquí es serializable y no
// contiene secretos: eventos, hechos, la crónica verificada con su audit, y una etiqueta
// del LLM usado.

import { analizar } from "../analista/analista";
import type { Hecho } from "../analista/tipos";
import { crearCacheDisco } from "../cadena/cache";
import { generarCronica } from "../cadena/cadena";
import type { CronicaVerificada } from "../cadena/tipos";
import { DELTA_MI_EQUIPO } from "../cadena/umbrales";
import { crearLlmDesdeEnv } from "../lib/llm";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import type { Estilo, Evento, SimConfig } from "../sim/tipos";
import { CRITERIOS, PRESETS } from "./presets";
import { crearCacheUpdates } from "../vivo/cache";
import { construirOverlay, type Overlay } from "../vivo/overlay";
import { generarUpdates } from "../vivo/updates";

/** Partido destacado de la home (vive en presets.ts; se re-exporta aquí por compatibilidad). */
export { SEMILLA_DESTACADA } from "./presets";

export interface EquipoVista {
  nombre: string;
  ataque: number;
  defensa: number;
  estilo: Estilo;
}

/** Brief 007: para qué afición se cuenta el partido. */
export type Perspectiva = "neutral" | "local" | "visita";

export const leerPerspectiva = (v: unknown): Perspectiva => (v === "local" || v === "visita" ? v : "neutral");

export interface DatosPartido {
  seed: number;
  perspectiva: Perspectiva;
  /** Relevancia que suma el modo «mi equipo» (DELTA_MI_EQUIPO), para mostrarla en modo Analista. */
  deltaMiEquipo: number;
  local: EquipoVista;
  visita: EquipoVista;
  eventos: Evento[];
  /** Brief 009: config del partido (plantillas) para valorar en el cliente lo visto (replay incluido). */
  config: SimConfig;
  hechos: Hecho[];
  cronica: CronicaVerificada;
  llm: { id: string; etiqueta: string; fixture: boolean };
  desdeCache: boolean;
}

/** Etiqueta honesta del LLM para la UI. */
export function etiquetaLlm(id: string): { etiqueta: string; fixture: boolean } {
  if (id === "stub") return { etiqueta: "Offline stub — sentences reuse the analyst's templates", fixture: false };
  if (id === "ensayo") return { etiqueta: "Rehearsal fixture — a scripted writer with one deliberate error (test only)", fixture: true };
  if (id.startsWith("foundry:")) return { etiqueta: `Microsoft Foundry · ${id.slice("foundry:".length)}`, fixture: false };
  return { etiqueta: id, fixture: false };
}

const equipo = (e: { nombre: string; ataque: number; defensa: number; estilo: Estilo }): EquipoVista => ({
  nombre: e.nombre,
  ataque: e.ataque,
  defensa: e.defensa,
  estilo: e.estilo,
});

export async function cargarPartido(seed: number, perspectiva: Perspectiva = "neutral"): Promise<DatosPartido> {
  return cargarPartidoDeConfig(configDeSemilla(seed), perspectiva);
}

/** Brief 016: lo mismo desde una config ya hecha (los partidos de liga la fabrica la temporada). */
export async function cargarPartidoDeConfig(config: SimConfig, perspectiva: Perspectiva = "neutral"): Promise<DatosPartido> {
  const partido = simular(config);
  const llm = crearLlmDesdeEnv();
  const { cronica, hechos, desdeCache } = await generarCronica(partido, {
    llm,
    cache: crearCacheDisco(),
    modoPersonalizacion: perspectiva === "neutral" ? "neutral" : `equipo:${perspectiva}`,
  });
  return {
    seed: partido.config.seed,
    perspectiva,
    deltaMiEquipo: DELTA_MI_EQUIPO,
    local: equipo(partido.config.local),
    visita: equipo(partido.config.visita),
    eventos: partido.eventos,
    config: partido.config,
    hechos,
    cronica,
    llm: { id: llm.id, ...etiquetaLlm(llm.id) },
    desdeCache,
  };
}

// ---------------------------------------------------------------------------------
// Brief 008: overlay de las actualizaciones en vivo (replay). Lo pide el endpoint
// /api/overlay/[seed] y lo consume el ticker de la UI: misma fuente, mismo JSON.
// ---------------------------------------------------------------------------------

export async function cargarOverlay(seed: number, perspectiva: Perspectiva = "neutral"): Promise<Overlay> {
  return cargarOverlayDeConfig(configDeSemilla(seed), perspectiva);
}

/** Brief 016: el overlay de un partido de liga (config de la temporada). */
export async function cargarOverlayDeConfig(config: SimConfig, perspectiva: Perspectiva = "neutral"): Promise<Overlay> {
  const partido = simular(config);
  const llm = crearLlmDesdeEnv();
  const modo = perspectiva === "neutral" ? "neutral" : (`equipo:${perspectiva}` as const);
  const updates = await generarUpdates(partido, { llm, cache: crearCacheUpdates(), modoPersonalizacion: modo });
  return construirOverlay(
    { seed: partido.config.seed, llm: llm.id, modo, local: partido.config.local.nombre, visita: partido.config.visita.nombre },
    updates,
    partido.eventos.map((e) => e.id),
  );
}

// ---------------------------------------------------------------------------------
// Presets (brief 014 §2): cinco historias curadas que muestran el rango del simulador. Las
// semillas las cazó `cazarPresets` (src/vista/presets.ts, `npm run presets`) y están fijas en
// PRESETS; los textos dicen el tipo de historia, no el marcador.
// ---------------------------------------------------------------------------------

export interface Preset {
  seed: number;
  historia: string; // en inglés: es chrome de la UI
  local: string;
  visita: string;
}

let presetsCalculados: Preset[] | undefined;

export function presets(): Preset[] {
  if (presetsCalculados) return presetsCalculados;
  presetsCalculados = CRITERIOS.map((c) => {
    const cfg = configDeSemilla(PRESETS[c.id]);
    return { seed: PRESETS[c.id], historia: c.historia, local: cfg.local.nombre, visita: cfg.visita.nombre };
  });
  return presetsCalculados;
}
