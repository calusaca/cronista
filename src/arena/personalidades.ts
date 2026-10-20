// Identidad persistente por equipo + jugador, independiente de semilla de partido,
// lado, formación y duración. No consume el azar del generador histórico.
import { ARENA, PERSONALIDAD_ARENA as P } from "../sim/limites";
import { prngDerivado } from "../sim/prng";
import type { Posicion } from "../sim/tipos";
import type { JugadorArena, PerfilJugador, PersonalidadJugador } from "./tipos";

type Tendencias = Pick<PersonalidadJugador, "defensiva" | "ofensiva" | "pase" | "conduccion" | "remate">;
const perfiles: Record<PerfilJugador, Tendencias> = {
  defensivo: { defensiva: 88, ofensiva: 35, pase: 62, conduccion: 35, remate: 25 },
  ofensivo: { defensiva: 35, ofensiva: 88, pase: 60, conduccion: 68, remate: 74 },
  pasador: { defensiva: 55, ofensiva: 60, pase: 90, conduccion: 38, remate: 38 },
  conductor: { defensiva: 35, ofensiva: 70, pase: 48, conduccion: 90, remate: 52 },
  rematador: { defensiva: 30, ofensiva: 78, pase: 42, conduccion: 48, remate: 92 },
  equilibrado: { defensiva: 60, ofensiva: 60, pase: 65, conduccion: 55, remate: 55 },
};
const preferencias: Record<Posicion, readonly PerfilJugador[]> = {
  POR: ["defensivo", "pasador", "equilibrado"],
  DEF: ["defensivo", "defensivo", "pasador", "equilibrado", "ofensivo"],
  MED: ["pasador", "pasador", "defensivo", "ofensivo", "conductor", "equilibrado"],
  DEL: ["ofensivo", "rematador", "rematador", "conductor", "pasador"],
};

export function personalidadDe(equipo: string, jugador: string, posicion: Posicion): PersonalidadJugador {
  const rng = prngDerivado(P.semilla, `personalidad:arena-v2:${equipo}:${jugador}`);
  const perfil = rng.pick(preferencias[posicion]);
  const variar = (base: number) => Math.min(P.max, Math.max(P.min, base + rng.int(-P.variacion, P.variacion)));
  const base = perfiles[perfil];
  return {
    perfil, defensiva: variar(base.defensiva), ofensiva: variar(base.ofensiva),
    pase: variar(base.pase), conduccion: variar(base.conduccion), remate: variar(base.remate),
    agresividad: rng.int(P.min, P.max), disciplina: rng.int(P.min, P.max),
    compostura: rng.int(P.min, P.max), liderazgo: rng.int(P.min, P.max),
  };
}

/** Un capitán entre los once activos por lado. Liderazgo no concede bonos de habilidad. */
export function designarCapitanes(jugadores: JugadorArena[]): void {
  for (const lado of ["local", "visita"] as const) {
    const propios = jugadores.filter(j => j.lado === lado);
    const capitan = [...propios].sort((a, b) => (b.personalidad?.liderazgo ?? 0) - (a.personalidad?.liderazgo ?? 0) || a.id.localeCompare(b.id))[0];
    for (const j of propios) j.capitan = j.id === capitan?.id;
  }
}

/** Tendencias de decisión; nivel sigue siendo la capacidad de ejecutar. */
export function prefiereTirar(j: JugadorArena, distanciaArco: number, hayPase: boolean): boolean {
  const p = j.personalidad;
  const radio = !p || !hayPase ? ARENA.radioTiroM : ARENA.radioTiroM * (P.tiroMinFactor + P.tiroRangoFactor * p.remate / P.max);
  return distanciaArco <= radio;
}
export const prefiereConducir = (j: JugadorArena): boolean => !!j.personalidad && j.personalidad.conduccion > j.personalidad.pase + P.ventajaConduccion;

/** Más disciplina mantiene la referencia colectiva; oficio e inclinación ajustan el apoyo. */
export function ajusteApoyo(j: JugadorArena, conBalon: boolean): number {
  const p = j.personalidad;
  if (!p || j.puesto === "POR") return 0;
  const preferencia = conBalon ? (p.ofensiva - p.defensiva) / P.max : -p.defensiva / P.max;
  return preferencia * P.ajusteApoyoM * (1 - p.disciplina / P.max);
}

export const etiquetasPerfil: Record<PerfilJugador, { es: string; en: string }> = {
  defensivo: { es: "Defensivo", en: "Defensive" }, ofensivo: { es: "Ofensivo", en: "Attacking" },
  pasador: { es: "Pasador", en: "Passer" }, conductor: { es: "Conductor", en: "Ball carrier" },
  rematador: { es: "Rematador", en: "Finisher" }, equilibrado: { es: "Equilibrado", en: "Balanced" },
};
export function etiquetaTemperamento(p: PersonalidadJugador, idioma: "es" | "en"): string {
  if (p.agresividad >= P.temperamentoAlto) return idioma === "es" ? "Agresivo" : "Aggressive";
  if (p.agresividad <= P.temperamentoBajo) return idioma === "es" ? "Cauto" : "Cautious";
  return idioma === "es" ? "Competitivo" : "Competitive";
}
