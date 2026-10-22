// Brief 049 (v1.1 § 10) · Club y jugador favoritos de la arena, por navegador (localStorage).
// Nada aquí lanza: el almacén puede faltar (SSR, modo privado), su getter puede lanzar
// (SecurityError) y getItem/setItem también (cuota). Identidad entre partidos: el club por
// nombre; el jugador por club + dorsal + nombre (los dorsales se repiten entre clubes).
import { z } from "zod";
import { ESTADISTICAS_ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { lados, type RegistroArena } from "./tipos";

export interface FavoritosArena { club: string | null; jugador: { club: string; dorsal: number; nombre: string } | null; }
export const FAVORITOS_VACIOS: FavoritosArena = { club: null, jugador: null };

const esquema = z.strictObject({
  club: z.string().min(1).max(80).nullable(),
  jugador: z.strictObject({ club: z.string().min(1).max(80), dorsal: z.number().int().min(0).max(999), nombre: z.string().min(1).max(80) }).nullable(),
});

/** `window.localStorage`, o null si no existe o su getter lanza. */
export function almacenFavoritos(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage ?? null; } catch { return null; }
}

/** `error` si no hay almacén o `getItem` lanza; JSON inválido o de otra forma ⇒ vacío sin error. */
export function leerFavoritos(almacen: Pick<Storage, "getItem"> | null): { favoritos: FavoritosArena; error: boolean } {
  if (!almacen) return { favoritos: FAVORITOS_VACIOS, error: true };
  let texto: string | null;
  try { texto = almacen.getItem(ESTADISTICAS_ARENA.claveFavoritos); } catch { return { favoritos: FAVORITOS_VACIOS, error: true }; }
  if (texto === null) return { favoritos: FAVORITOS_VACIOS, error: false };
  try {
    const r = esquema.safeParse(JSON.parse(texto));
    return { favoritos: r.success ? r.data : FAVORITOS_VACIOS, error: false };
  } catch { return { favoritos: FAVORITOS_VACIOS, error: false }; }
}

/** false si no hay almacén o `setItem` lanza. */
export function guardarFavoritos(almacen: Pick<Storage, "setItem"> | null, f: FavoritosArena): boolean {
  if (!almacen) return false;
  try { almacen.setItem(ESTADISTICAS_ARENA.claveFavoritos, JSON.stringify(f)); return true; } catch { return false; }
}

/** Resuelve los favoritos en un registro: lado del club favorito y id del jugador favorito
 * (titular o suplente de la plantilla inicial). */
export function favoritosEn(registro: RegistroArena, f: FavoritosArena): { lado: Lado | null; jugador: string | null } {
  const ladoDe = (club: string) => lados.find(l => registro.config.partido[l].nombre === club) ?? null;
  const lado = f.club ? ladoDe(f.club) : null;
  let jugador: string | null = null;
  if (f.jugador) {
    const l = ladoDe(f.jugador.club), fav = f.jugador;
    if (l) jugador = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []].find(j => j.lado === l && j.dorsal === fav.dorsal && j.nombre === fav.nombre)?.id ?? null;
  }
  return { lado, jugador };
}

/** Preselección de una carga: el jugador favorito; si no, el capitán del club favorito. */
export function preseleccionFavorita(registro: RegistroArena, f: FavoritosArena): string | null {
  const { lado, jugador } = favoritosEn(registro, f);
  if (jugador) return jugador;
  if (!lado) return null;
  const propios = registro.inicial.jugadores.filter(j => j.lado === lado);
  return (propios.find(j => j.capitan) ?? propios[0])?.id ?? null;
}

/** Alterna el club favorito (uno solo a la vez). */
export const alternarClub = (f: FavoritosArena, club: string): FavoritosArena => ({ ...f, club: f.club === club ? null : club });
/** Alterna el jugador favorito (uno solo a la vez). */
export function alternarJugador(f: FavoritosArena, j: { club: string; dorsal: number; nombre: string }): FavoritosArena {
  const mismo = f.jugador && f.jugador.club === j.club && f.jugador.dorsal === j.dorsal && f.jugador.nombre === j.nombre;
  return { ...f, jugador: mismo ? null : { club: j.club, dorsal: j.dorsal, nombre: j.nombre } };
}
