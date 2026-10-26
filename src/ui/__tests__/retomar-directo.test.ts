// Brief 066 · A · Lógica de retomar el directo: qué se guarda, cuándo se borra y la decisión al montar.
// Almacén falso inyectado (sin window); las cifras salen de las constantes (BUFFER_ARENA, RETOMAR_DIRECTO).
import { describe, expect, it } from "vitest";
import { BUFFER_ARENA } from "../../arena/buffer";
import { RETOMAR_DIRECTO } from "../../sim/limites";
import { CLAVES_DIRECTO, conservarAlTerminar, decidirAlMontar, guardarSegundo, guardarSesionDirecto, leerSegundo, olvidarDirecto, sesionCaducada, tickInicial, tocaGuardar, type Almacen } from "../retomar-directo";

class AlmacenFalso implements Almacen {
  datos = new Map<string, string>();
  getItem(k: string) { return this.datos.get(k) ?? null; }
  setItem(k: string, v: string) { this.datos.set(k, String(v)); }
  removeItem(k: string) { this.datos.delete(k); }
}
class AlmacenRoto implements Almacen {
  getItem(): string | null { throw new DOMException("bloqueado", "SecurityError"); }
  setItem() { throw new DOMException("lleno", "QuotaExceededError"); }
  removeItem() { throw new DOMException("bloqueado", "SecurityError"); }
}
const A = "00000000-0000-4000-8000-00000000a066", B = "00000000-0000-4000-8000-00000000b066";

describe("066 · A · qué se guarda", () => {
  it("un partido nuevo guarda sesión y presentación y descarta el segundo del anterior", () => {
    const a = new AlmacenFalso();
    guardarSesionDirecto(A, "buffer", a); guardarSegundo(A, 33.3, true, a);
    expect(leerSegundo(A, a)).toEqual({ sesion: A, segundo: 33.3, narracion: true });
    guardarSesionDirecto(B, "buffer", a);
    expect(a.getItem(CLAVES_DIRECTO.sesion)).toBe(B);
    expect(a.getItem(CLAVES_DIRECTO.presentacion)).toBe("buffer");
    expect(a.getItem(CLAVES_DIRECTO.segundo)).toBeNull();
    expect(leerSegundo(A, a)).toBeNull();
  });
  it("el segundo solo se guarda para la sesión guardada (una emisión vieja u olvidada no escribe)", () => {
    const a = new AlmacenFalso();
    guardarSegundo(A, 10, false, a);
    expect(a.getItem(CLAVES_DIRECTO.segundo)).toBeNull();
    guardarSesionDirecto(A, "buffer", a); guardarSegundo(B, 10, false, a);
    expect(a.getItem(CLAVES_DIRECTO.segundo)).toBeNull();
    guardarSegundo(A, 12.3456, false, a);
    expect(leerSegundo(A, a)).toEqual({ sesion: A, segundo: 12.346, narracion: false });
    for (const malo of [Number.NaN, -1, Number.POSITIVE_INFINITY]) { guardarSegundo(A, malo, true, a); expect(leerSegundo(A, a)?.segundo).toBe(12.346); }
  });
  it("leerSegundo ignora otra sesión y un valor corrupto", () => {
    const a = new AlmacenFalso();
    guardarSesionDirecto(A, "buffer", a); guardarSegundo(A, 5, true, a);
    expect(leerSegundo(B, a)).toBeNull();
    a.setItem(CLAVES_DIRECTO.segundo, "{no es json");
    expect(leerSegundo(A, a)).toBeNull();
    a.setItem(CLAVES_DIRECTO.segundo, JSON.stringify({ sesion: A, segundo: "7" }));
    expect(leerSegundo(A, a)).toBeNull();
  });
  it(`throttle del guardado: cada ${RETOMAR_DIRECTO.guardarCadaMs} ms`, () => {
    expect(tocaGuardar(-Infinity, 0)).toBe(true);
    expect(tocaGuardar(1000, 1000 + RETOMAR_DIRECTO.guardarCadaMs - 1)).toBe(false);
    expect(tocaGuardar(1000, 1000 + RETOMAR_DIRECTO.guardarCadaMs)).toBe(true);
  });
});

describe("066 · A · cuándo se borra", () => {
  it("«terminada» solo conserva una emisión del búfer completa", () => {
    expect(conservarAlTerminar("buffer", "completa")).toBe(true);
    for (const estado of ["cancelada", "interrumpida", "error"]) expect(conservarAlTerminar("buffer", estado)).toBe(false);
    expect(conservarAlTerminar("preparada", "completa")).toBe(false);
    expect(conservarAlTerminar("directo", "completa")).toBe(false);
  });
  it("olvidar sin sesión borra todo; con sesión, solo si es la guardada", () => {
    const a = new AlmacenFalso();
    guardarSesionDirecto(A, "buffer", a); guardarSegundo(A, 40, true, a);
    olvidarDirecto(B, a);
    expect(a.getItem(CLAVES_DIRECTO.sesion)).toBe(A);
    olvidarDirecto(A, a);
    expect([...a.datos.keys()]).toEqual([]);
    guardarSesionDirecto(B, "preparada", a);
    olvidarDirecto(undefined, a);
    expect([...a.datos.keys()]).toEqual([]);
  });
  it("404 y 410 son una sesión caducada; otros fallos no", () => {
    expect(sesionCaducada(404)).toBe(true);
    expect(sesionCaducada(410)).toBe(true);
    for (const s of [200, 409, 429, 500, 503]) expect(sesionCaducada(s)).toBe(false);
  });
});

describe("066 · A · decisión al montar", () => {
  it("sin nada guardado ni compartido no conecta", () => {
    expect(decidirAlMontar("", new AlmacenFalso())).toBeNull();
  });
  it("la sesión guardada en búfer se retoma; la preparada reconecta como siempre", () => {
    const a = new AlmacenFalso();
    guardarSesionDirecto(A, "buffer", a);
    expect(decidirAlMontar("", a)).toEqual({ id: A, presentacion: "buffer", retomar: true });
    guardarSesionDirecto(A, "preparada", a);
    expect(decidirAlMontar("?lang=es", a)).toEqual({ id: A, presentacion: "preparada", retomar: false });
    a.removeItem(CLAVES_DIRECTO.presentacion);
    expect(decidirAlMontar("", a)).toEqual({ id: A, presentacion: "directo", retomar: false });
    a.setItem(CLAVES_DIRECTO.sesion, "no-es-un-id");
    expect(decidirAlMontar("", a)).toBeNull();
  });
  it("lo compartido (?partido=) gana y se comporta como hoy, sin retomar", () => {
    const a = new AlmacenFalso();
    guardarSesionDirecto(A, "buffer", a); guardarSegundo(A, 50, true, a);
    expect(decidirAlMontar(`?partido=${B}&vista=buffer`, a)).toEqual({ id: B, presentacion: "buffer", retomar: false });
    expect(decidirAlMontar(`?partido=${A}`, a)).toEqual({ id: A, presentacion: "preparada", retomar: false });
    expect(decidirAlMontar("?partido=../x", a)).toBeNull();
  });
  it("tick inicial: el segundo guardado (acotado a lo generado) o, sin él, el vivo de siempre", () => {
    const g = (segundo: number) => ({ sesion: A, segundo, narracion: false });
    expect(tickInicial(1100, g(33.37))).toBe(333);
    expect(tickInicial(300, g(80))).toBe(300);
    expect(tickInicial(1100, g(0))).toBe(0);
    const vivo = (final: number) => Math.max(0, Math.floor((final - BUFFER_ARENA.segundos * 10) / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks);
    for (const final of [0, 150, 200, 249, 1100, 1199]) expect(tickInicial(final, null)).toBe(vivo(final));
    expect(tickInicial(1199, null)).toBeLessThanOrEqual(1199 - BUFFER_ARENA.segundos * 10);
  });
  it("sin almacenamiento (bloqueado o lleno) nada lanza y no se retoma", () => {
    const a = new AlmacenRoto();
    expect(() => { guardarSesionDirecto(A, "buffer", a); guardarSegundo(A, 3, true, a); olvidarDirecto(A, a); olvidarDirecto(undefined, a); }).not.toThrow();
    expect(leerSegundo(A, a)).toBeNull();
    expect(decidirAlMontar("", a)).toBeNull();
    expect(decidirAlMontar(`?partido=${B}&vista=buffer`, a)).toEqual({ id: B, presentacion: "buffer", retomar: false });
    expect(decidirAlMontar("", null)).toBeNull();
  });
});
