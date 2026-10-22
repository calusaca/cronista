// Brief 055 (v1.1) · Identidad de club derivada del NOMBRE: equipación principal y alternativa,
// forma y patrón del escudo e iniciales. Sin estado, sin LLM, sin DOM y sin datos nuevos en el
// registro: el mismo nombre da siempre la misma identidad (también en SSR y en el cliente), así que
// un club favorito (049, guardado por nombre) conserva escudo y camiseta entre partidos.
// Ninguna identidad se persiste. Todas las cifras y colores viven en IDENTIDAD_ARENA (limites.ts).
import { IDENTIDAD_ARENA } from "../sim/limites";

export type ClaveKit = (typeof IDENTIDAD_ARENA.paleta)[number]["id"];
export type Familia = "oscura" | "clara";
export interface Equipacion { id: ClaveKit; familia: Familia; fondo: string; tinta: string; uiClaro: string; uiOscuro: string; nombre: { es: string; en: string } }
export type Forma = "escudo" | "redondo" | "estandarte";
export type Patron = "liso" | "rayas" | "mitades" | "banda" | "aros";
/** `nombre` es el recibido tal cual (para mostrar); `clave` es el normalizado (la identidad). */
export interface IdentidadClub { nombre: string; clave: string; hash: number; principal: Equipacion; alternativa: Equipacion; forma: Forma; patron: Patron; iniciales: string }
export interface EquipacionesPartido { local: Equipacion; visita: Equipacion; visitaAlternativa: boolean }
export interface IdentidadPartido { local: IdentidadClub; visita: IdentidadClub; kits: EquipacionesPartido; variables: Record<`--ar-${string}`, string> }

const PALETA: readonly Equipacion[] = IDENTIDAD_ARENA.paleta;
const FORMAS: readonly Forma[] = IDENTIDAD_ARENA.formas;
const PATRONES: readonly Patron[] = IDENTIDAD_ARENA.patrones;
/** Mitad de la paleta: índices [0, mitad) familia oscura, [mitad, 2·mitad) familia clara. */
const MITAD = PALETA.length / 2;

/** Clave normalizada: NFC, sin espacios en los extremos y en minúsculas. */
export function claveClub(nombre: string): string {
  return nombre.normalize("NFC").trim().toLowerCase();
}

/** FNV-1a de 32 bits sobre los bytes UTF-8 de la clave normalizada. */
export function hashClub(nombre: string): number {
  let h = IDENTIDAD_ARENA.fnvDesplazamiento >>> 0;
  for (const byte of new TextEncoder().encode(claveClub(nombre))) {
    h ^= byte;
    h = Math.imul(h, IDENTIDAD_ARENA.fnvPrimo) >>> 0;
  }
  return h >>> 0;
}

/** § 5.3 · Primera letra de cada palabra de ≥ minLetrasPalabra letras, hasta maxIniciales; con una
 * sola palabra, sus dos primeras letras. Sin transliterar (Ñ, Á se conservan). */
export function iniciales(nombre: string): string {
  const todas = nombre.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  const palabras = todas.filter(p => Array.from(p).length >= IDENTIDAD_ARENA.minLetrasPalabra);
  if (palabras.length === 1) return Array.from(palabras[0]!).slice(0, 2).join("").toUpperCase();
  if (palabras.length === 0) return Array.from(todas.join("")).slice(0, 2).join("").toUpperCase();
  return palabras.slice(0, IDENTIDAD_ARENA.maxIniciales).map(p => Array.from(p)[0]!).join("").toUpperCase();
}

/** § 5.2 · Bits distintos del hash para cada rasgo; la alternativa siempre es de la familia opuesta. */
export function identidadClub(nombre: string): IdentidadClub {
  const h = hashClub(nombre);
  const principal = PALETA[h % PALETA.length]!;
  const alternativa = PALETA[((h >>> 24) % MITAD) + (principal.familia === "oscura" ? MITAD : 0)]!;
  return {
    nombre, clave: claveClub(nombre), hash: h, principal, alternativa,
    patron: PATRONES[(h >>> 8) % PATRONES.length]!, forma: FORMAS[(h >>> 16) % FORMAS.length]!,
    iniciales: iniciales(nombre),
  };
}

const canal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminancia = (hex: string) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Color hex de 6 cifras esperado: ${hex}`);
  return 0.2126 * canal(parseInt(m[1]!, 16)) + 0.7152 * canal(parseInt(m[2]!, 16)) + 0.0722 * canal(parseInt(m[3]!, 16));
};
/** Razón de contraste WCAG 2.x entre dos colores hex de 6 cifras. */
export function contrasteWcag(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** § 5.4 · Choque de colores: el local nunca cambia; la visita se cambia a su alternativa si las
 * principales no contrastan lo suficiente (también con el mismo nombre en los dos lados). */
export function equipacionesDe(local: IdentidadClub, visita: IdentidadClub): EquipacionesPartido {
  const alternativa = contrasteWcag(local.principal.fondo, visita.principal.fondo) < IDENTIDAD_ARENA.minEntreEquipos;
  return { local: local.principal, visita: alternativa ? visita.alternativa : visita.principal, visitaAlternativa: alternativa };
}
export function equipaciones(local: string, visita: string): EquipacionesPartido {
  return equipacionesDe(identidadClub(local), identidadClub(visita));
}

/** § 5.5 · Exactamente las diez variables que `main.arena-shell` recibe en su `style`. */
export function variablesEquipacion(e: EquipacionesPartido): Record<`--ar-${string}`, string> {
  return {
    "--ar-home": e.local.fondo, "--ar-home-ink": e.local.tinta, "--ar-home-ring": e.local.tinta,
    "--ar-home-ui-claro": e.local.uiClaro, "--ar-home-ui-oscuro": e.local.uiOscuro,
    "--ar-away": e.visita.fondo, "--ar-away-ink": e.visita.tinta, "--ar-away-ring": e.visita.tinta,
    "--ar-away-ui-claro": e.visita.uiClaro, "--ar-away-ui-oscuro": e.visita.uiOscuro,
  };
}

/** v1.1 § 12 · Todo lo que la arena necesita de una vez por par de nombres (Arena.tsx lo memoiza). */
export function identidadPartido(local: string, visita: string): IdentidadPartido {
  const l = identidadClub(local), v = identidadClub(visita), kits = equipacionesDe(l, v);
  return { local: l, visita: v, kits, variables: variablesEquipacion(kits) };
}
