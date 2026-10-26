// Brief 066 · A · Retomar el directo donde ibas (solo cliente).
// La sesión del directo, su presentación y el segundo de la emisión viven en sessionStorage. Se conservan hasta que
// (1) la emisión llega al final, (2) el espectador empieza otro partido o (3) pulsa «Stop match» / «Cancel live match».
// «terminada» ya no las borra mientras la emisión del búfer no haya acabado. Toda lectura y escritura va en try/catch:
// sin almacenamiento, el directo funciona como antes (sin retomar).
import { BUFFER_ARENA } from "../arena/buffer";
import type { PresentacionArena } from "../arena/protocolo";
import { RETOMAR_DIRECTO } from "../sim/limites";

export const CLAVES_DIRECTO = {
  sesion: "cronista:arena:sesion",
  presentacion: "cronista:arena:presentacion",
  /** JSON `{ sesion, segundo, narracion }`: segundo de la emisión y si la narración estaba activa. */
  segundo: "cronista:arena:segundo",
} as const;

export type SegundoGuardado = { sesion: string; segundo: number; narracion: boolean };
export type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const ID = /^[a-f0-9-]{36}$/;
function almacenSesion(): Almacen | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage ?? null; } catch { return null; }
}
const leer = (a: Almacen | null, k: string) => { try { return a?.getItem(k) ?? null; } catch { return null; } };
const escribir = (a: Almacen | null, k: string, v: string) => { try { a?.setItem(k, v); } catch { /* Almacenamiento bloqueado o lleno. */ } };
const quitar = (a: Almacen | null, k: string) => { try { a?.removeItem(k); } catch { /* Almacenamiento bloqueado. */ } };

/** Un partido nuevo (en vivo o guardado): sustituye la sesión anterior y descarta su segundo. */
export function guardarSesionDirecto(id: string, presentacion: PresentacionArena, a: Almacen | null = almacenSesion()): void {
  quitar(a, CLAVES_DIRECTO.segundo);
  escribir(a, CLAVES_DIRECTO.presentacion, presentacion); escribir(a, CLAVES_DIRECTO.sesion, id);
}

/** Olvida la sesión guardada (final de la emisión, «Stop match», «Cancel live match», otro partido o caducada).
 * Con `sesion`, solo si es la guardada: una emisión vieja nunca borra la de otro partido. */
export function olvidarDirecto(sesion?: string, a: Almacen | null = almacenSesion()): void {
  if (sesion !== undefined && leer(a, CLAVES_DIRECTO.sesion) !== sesion) return;
  for (const k of Object.values(CLAVES_DIRECTO)) quitar(a, k);
}

/** Guarda el segundo de la emisión, solo si `sesion` sigue siendo la guardada (nunca resucita una olvidada). */
export function guardarSegundo(sesion: string, segundo: number, narracion: boolean, a: Almacen | null = almacenSesion()): void {
  if (!Number.isFinite(segundo) || segundo < 0 || leer(a, CLAVES_DIRECTO.sesion) !== sesion) return;
  escribir(a, CLAVES_DIRECTO.segundo, JSON.stringify({ sesion, segundo: Math.round(segundo * 1000) / 1000, narracion } satisfies SegundoGuardado));
}

/** Segundo guardado de `sesion` (null si no hay, es de otra sesión o está corrupto). */
export function leerSegundo(sesion: string, a: Almacen | null = almacenSesion()): SegundoGuardado | null {
  try {
    const v = JSON.parse(leer(a, CLAVES_DIRECTO.segundo) ?? "null") as Partial<SegundoGuardado> | null;
    return v && v.sesion === sesion && typeof v.segundo === "number" && Number.isFinite(v.segundo) && v.segundo >= 0 ? { sesion, segundo: v.segundo, narracion: v.narracion === true } : null;
  } catch { return null; }
}

/** Throttle del guardado periódico (RETOMAR_DIRECTO.guardarCadaMs). */
export const tocaGuardar = (ultimoMs: number, ahoraMs: number) => ahoraMs - ultimoMs >= RETOMAR_DIRECTO.guardarCadaMs;

/** Decisión al montar: el enlace compartido (`?partido=`) se comporta como siempre (sin retomar); si no, la sesión
 * guardada se retoma (en búfer, en el segundo guardado y en pausa). */
export function decidirAlMontar(busqueda: string, a: Almacen | null = almacenSesion()): { id: string; presentacion: PresentacionArena; retomar: boolean } | null {
  const q = new URLSearchParams(busqueda), compartido = q.get("partido");
  if (compartido !== null) return ID.test(compartido) ? { id: compartido, presentacion: q.get("vista") === "buffer" ? "buffer" : "preparada", retomar: false } : null;
  const guardada = leer(a, CLAVES_DIRECTO.sesion);
  if (!guardada || !ID.test(guardada)) return null;
  const p = leer(a, CLAVES_DIRECTO.presentacion), presentacion: PresentacionArena = p === "buffer" ? "buffer" : p === "preparada" ? "preparada" : "directo";
  return { id: guardada, presentacion, retomar: presentacion === "buffer" };
}

/** Tick inicial de la emisión: al retomar, el segundo guardado (acotado a lo generado); si no, el vivo (final − 20 s,
 * redondeado a 5 s), como siempre. */
export function tickInicial(finalTick: number, guardado: SegundoGuardado | null): number {
  if (guardado) return Math.max(0, Math.min(finalTick, Math.floor(guardado.segundo * 10)));
  return Math.max(0, Math.floor((finalTick - BUFFER_ARENA.segundos * 10) / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks);
}

/** «terminada» solo conserva la sesión si es una emisión del búfer completa (aún puede estar emitiéndose). */
export const conservarAlTerminar = (presentacion: PresentacionArena, estado: string) => presentacion === "buffer" && estado === "completa";

/** 404 o 410 de /emision: la sesión guardada caducó o no existe. */
export const sesionCaducada = (status: number) => status === 404 || status === 410;
