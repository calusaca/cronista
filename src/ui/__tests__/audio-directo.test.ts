// Brief 058 · Bloque A · § 8: preferencia por espectador, cebado del AudioContext y arranque propio.
// Entorno con `localStorage` y `AudioContext` simulados sobre globalThis; cada prueba importa el módulo de
// nuevo para empezar sin contexto cebado ni arranques marcados.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NARRACION_DIRECTO } from "../../sim/limites";

type Modulo = typeof import("../audio-directo");
const cargar = async (): Promise<Modulo> => { vi.resetModules(); return import("../audio-directo"); };

class AlmacenFalso {
  datos = new Map<string, string>();
  getItem(k: string) { return this.datos.get(k) ?? null; }
  setItem(k: string, v: string) { this.datos.set(k, String(v)); }
  removeItem(k: string) { this.datos.delete(k); }
}
const creados: ContextoFalso[] = [];
class ContextoFalso {
  state: "suspended" | "running" | "closed" = "suspended";
  readonly sampleRate: number; readonly destination = {};
  reanudaciones = 0; arranques = 0;
  constructor(o?: { sampleRate?: number }) { this.sampleRate = o?.sampleRate ?? 48000; creados.push(this); }
  resume() { this.reanudaciones++; this.state = "running"; return Promise.resolve(); }
  createBuffer(canales: number, largo: number, frecuencia: number) { return { canales, largo, frecuencia }; }
  createBufferSource() { const c = this; return { buffer: null as unknown, connect() {}, start() { c.arranques++; } }; }
  close() { this.state = "closed"; return Promise.resolve(); }
}

let almacen: AlmacenFalso;
beforeEach(() => {
  creados.length = 0; almacen = new AlmacenFalso();
  vi.stubGlobal("window", { localStorage: almacen, AudioContext: ContextoFalso });
  vi.stubGlobal("AudioContext", ContextoFalso);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("058 · preferencia de narración", () => {
  it("ausente vale porDefecto; «0» es false; «1» es true", async () => {
    const m = await cargar();
    expect(m.leerPreferenciaNarracion()).toBe(NARRACION_DIRECTO.porDefecto);
    almacen.setItem(NARRACION_DIRECTO.clavePreferencia, "0");
    expect(m.leerPreferenciaNarracion()).toBe(false);
    almacen.setItem(NARRACION_DIRECTO.clavePreferencia, "1");
    expect(m.leerPreferenciaNarracion()).toBe(true);
    almacen.setItem(NARRACION_DIRECTO.clavePreferencia, "otra cosa");
    expect(m.leerPreferenciaNarracion()).toBe(NARRACION_DIRECTO.porDefecto);
  });

  it("guardar escribe «1» o «0» en la clave de la constante", async () => {
    const m = await cargar();
    m.guardarPreferenciaNarracion(false);
    expect(almacen.getItem(NARRACION_DIRECTO.clavePreferencia)).toBe("0");
    m.guardarPreferenciaNarracion(true);
    expect(almacen.getItem(NARRACION_DIRECTO.clavePreferencia)).toBe("1");
  });

  it("un getItem o setItem que lanza no rompe nada y se lee porDefecto", async () => {
    const m = await cargar();
    almacen.getItem = () => { throw new Error("bloqueado"); };
    almacen.setItem = () => { throw new Error("bloqueado"); };
    expect(() => m.guardarPreferenciaNarracion(false)).not.toThrow();
    expect(m.leerPreferenciaNarracion()).toBe(NARRACION_DIRECTO.porDefecto);
  });

  it("un getter de localStorage que lanza (modo privado) tampoco rompe", async () => {
    vi.stubGlobal("window", { get localStorage(): Storage { throw new Error("SecurityError"); }, AudioContext: ContextoFalso });
    const m = await cargar();
    expect(m.leerPreferenciaNarracion()).toBe(NARRACION_DIRECTO.porDefecto);
    expect(() => m.guardarPreferenciaNarracion(true)).not.toThrow();
  });
});

describe("058 · cebado del AudioContext", () => {
  it("crea un solo contexto aunque se llame dos veces; reanuda y arranca una muestra de silencio", async () => {
    const m = await cargar();
    m.cebarAudioDirecto(); m.cebarAudioDirecto();
    expect(creados).toHaveLength(1);
    expect(creados[0]!.sampleRate).toBe(24000);
    expect(creados[0]!.reanudaciones).toBe(2);
    expect(creados[0]!.arranques).toBe(2);
  });

  it("tomarAudioCebado lo entrega una vez y después devuelve null", async () => {
    const m = await cargar();
    m.cebarAudioDirecto();
    expect(m.tomarAudioCebado()).toBe(creados[0]);
    expect(m.tomarAudioCebado()).toBeNull();
  });

  it("un contexto cerrado no se entrega; el siguiente cebado crea otro", async () => {
    const m = await cargar();
    m.cebarAudioDirecto(); void creados[0]!.close();
    expect(m.tomarAudioCebado()).toBeNull();
    m.cebarAudioDirecto(); void creados[0]!.close();
    m.cebarAudioDirecto();
    expect(creados).toHaveLength(2);
    expect(m.tomarAudioCebado()).toBe(creados[1]);
  });

  it("un contexto cebado que nadie adoptó se reutiliza en el siguiente clic", async () => {
    const m = await cargar();
    m.cebarAudioDirecto(); m.cebarAudioDirecto();
    expect(creados).toHaveLength(1);
    expect(m.tomarAudioCebado()).toBe(creados[0]);
  });

  it("sin Web Audio no lanza ni entrega contexto; un resume() que rechaza no escapa", async () => {
    vi.stubGlobal("window", { localStorage: almacen });
    let m = await cargar();
    expect(() => m.cebarAudioDirecto()).not.toThrow();
    expect(m.tomarAudioCebado()).toBeNull();
    class Rechaza extends ContextoFalso { override resume() { return Promise.reject(new Error("NotAllowedError")); } }
    vi.stubGlobal("window", { localStorage: almacen, AudioContext: Rechaza }); vi.stubGlobal("AudioContext", Rechaza);
    const rechazos: unknown[] = []; const oir = (e: unknown) => rechazos.push(e);
    process.on("unhandledRejection", oir);
    try {
      m = await cargar(); m.cebarAudioDirecto();
      await new Promise(r => setTimeout(r, 0));
      expect(rechazos).toEqual([]);
    } finally { process.off("unhandledRejection", oir); }
  });
});

describe("058 · activación automática (§ 3.1)", () => {
  it("exige las tres condiciones: voz disponible, arranque propio y preferencia no desactivada", async () => {
    const m = await cargar();
    expect(m.narracionAutomatica("a", true)).toBe(false); // sin arranque propio (enlace compartido, recarga)
    m.marcarArranquePropio("a", 0);
    expect(m.narracionAutomatica("a", true)).toBe(NARRACION_DIRECTO.porDefecto);
    expect(m.narracionAutomatica("a", false)).toBe(false); // /herramientas sin voz
    expect(m.narracionAutomatica("b", true)).toBe(false); // otra sesión
    almacen.setItem(NARRACION_DIRECTO.clavePreferencia, "0");
    expect(m.narracionAutomatica("a", true)).toBe(false);
    almacen.setItem(NARRACION_DIRECTO.clavePreferencia, "1");
    expect(m.narracionAutomatica("a", true)).toBe(true);
  });

  it("invariante de las constantes: el desbloqueo no supera la espera de herramientas", () => {
    expect(NARRACION_DIRECTO.desbloqueoMs).toBeLessThanOrEqual(NARRACION_DIRECTO.esperaHerramientasMs);
    expect(NARRACION_DIRECTO.porDefecto).toBe(true);
  });
});

describe("058 · arranque propio", () => {
  it("solo es cierto para el id marcado, y es memoria del módulo (una recarga lo borra)", async () => {
    let m = await cargar();
    expect(m.arranquePropio("a")).toBe(false);
    m.marcarArranquePropio("a", 0);
    expect(m.arranquePropio("a")).toBe(true);
    expect(m.arranquePropio("b")).toBe(false);
    m = await cargar();
    expect(m.arranquePropio("a")).toBe(false);
  });
});
