// Brief 049 (v1.1 § 10) · Favoritos: lectura y escritura que nunca lanzan, ida y vuelta, y
// resolución por club + dorsal + nombre.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { almacenFavoritos, alternarClub, alternarJugador, FAVORITOS_VACIOS, favoritosEn, guardarFavoritos, leerFavoritos, preseleccionFavorita, type FavoritosArena } from "../../arena/favoritos";
import type { RegistroArena } from "../../arena/tipos";
import { ESTADISTICAS_ARENA } from "../../sim/limites";

const registro = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v3.json", "utf8")) as RegistroArena;
const memoria = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
const lanza = () => { throw new DOMException("bloqueado", "SecurityError"); };

describe("049 · leerFavoritos y guardarFavoritos", () => {
  it("almacén null o getItem que lanza ⇒ vacío con error; JSON inválido u otra forma ⇒ vacío sin error; nunca lanza", () => {
    expect(leerFavoritos(null)).toEqual({ favoritos: FAVORITOS_VACIOS, error: true });
    expect(leerFavoritos({ getItem: lanza })).toEqual({ favoritos: FAVORITOS_VACIOS, error: true });
    expect(leerFavoritos({ getItem: () => "{no es json" })).toEqual({ favoritos: FAVORITOS_VACIOS, error: false });
    expect(leerFavoritos({ getItem: () => JSON.stringify({ club: 7, jugador: "x" }) })).toEqual({ favoritos: FAVORITOS_VACIOS, error: false });
    expect(leerFavoritos({ getItem: () => JSON.stringify({ club: "A", jugador: null, extra: 1 }) })).toEqual({ favoritos: FAVORITOS_VACIOS, error: false });
    expect(leerFavoritos({ getItem: () => null })).toEqual({ favoritos: FAVORITOS_VACIOS, error: false });
  });

  it("setItem que lanza o sin almacén ⇒ false; ida y vuelta con la clave versionada", () => {
    const f: FavoritosArena = { club: registro.config.partido.visita.nombre, jugador: { club: registro.config.partido.local.nombre, dorsal: 9, nombre: "X" } };
    expect(guardarFavoritos({ setItem: lanza }, f)).toBe(false);
    expect(guardarFavoritos(null, f)).toBe(false);
    const a = memoria();
    expect(guardarFavoritos(a, f)).toBe(true);
    expect([...a.m.keys()]).toEqual([ESTADISTICAS_ARENA.claveFavoritos]);
    expect(leerFavoritos(a)).toEqual({ favoritos: f, error: false });
  });

  afterEach(() => vi.unstubAllGlobals());
  it("almacenFavoritos: sin window ⇒ null; getter de localStorage que lanza ⇒ null, sin excepción", () => {
    expect(almacenFavoritos()).toBeNull();
    const ventana = {}; Object.defineProperty(ventana, "localStorage", { get: lanza });
    vi.stubGlobal("window", ventana);
    expect(() => almacenFavoritos()).not.toThrow();
    expect(almacenFavoritos()).toBeNull();
    expect(leerFavoritos(almacenFavoritos()).error).toBe(true);
  });
});

describe("049 · favoritosEn", () => {
  const L = registro.config.partido.local.nombre, V = registro.config.partido.visita.nombre;
  it("resuelve club y jugador por club + dorsal + nombre, sin confundir dorsales de clubes distintos", () => {
    const local = registro.inicial.jugadores.find(j => j.lado === "local" && registro.inicial.jugadores.some(v => v.lado === "visita" && v.dorsal === j.dorsal))!;
    const visita = registro.inicial.jugadores.find(j => j.lado === "visita" && j.dorsal === local.dorsal)!;
    expect(favoritosEn(registro, { club: V, jugador: { club: L, dorsal: local.dorsal, nombre: local.nombre } })).toEqual({ lado: "visita", jugador: local.id });
    expect(favoritosEn(registro, { club: null, jugador: { club: V, dorsal: visita.dorsal, nombre: visita.nombre } })).toEqual({ lado: null, jugador: visita.id });
    // Mismo dorsal y nombre del local, pero con el club visitante: no es nadie.
    expect(favoritosEn(registro, { club: null, jugador: { club: V, dorsal: local.dorsal, nombre: local.nombre } }).jugador).toBeNull();
    expect(favoritosEn(registro, { club: "Club que no juega", jugador: null })).toEqual({ lado: null, jugador: null });
  });

  it("un suplente favorito (en el banco) resuelve y se preselecciona; un club solo, su capitán", () => {
    const suplente = registro.inicial.banco!.find(j => j.lado === "visita")!;
    const f: FavoritosArena = { club: null, jugador: { club: V, dorsal: suplente.dorsal, nombre: suplente.nombre } };
    expect(favoritosEn(registro, f).jugador).toBe(suplente.id);
    expect(preseleccionFavorita(registro, f)).toBe(suplente.id);
    const capitan = registro.inicial.jugadores.find(j => j.lado === "visita" && j.capitan) ?? registro.inicial.jugadores.find(j => j.lado === "visita")!;
    expect(preseleccionFavorita(registro, { club: V, jugador: null })).toBe(capitan.id);
    expect(preseleccionFavorita(registro, FAVORITOS_VACIOS)).toBeNull();
  });

  it("alternar: un solo club y un solo jugador a la vez", () => {
    expect(alternarClub(alternarClub(FAVORITOS_VACIOS, L), V).club).toBe(V);
    expect(alternarClub({ club: V, jugador: null }, V).club).toBeNull();
    const j = { club: L, dorsal: 1, nombre: "A" };
    expect(alternarJugador(alternarJugador(FAVORITOS_VACIOS, j), j).jugador).toBeNull();
    expect(alternarJugador(alternarJugador(FAVORITOS_VACIOS, j), { ...j, dorsal: 2 }).jugador).toEqual({ ...j, dorsal: 2 });
  });
});
