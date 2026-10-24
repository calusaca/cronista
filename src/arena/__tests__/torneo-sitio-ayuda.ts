// Brief 062 · Utilidades de prueba del gestor del sitio (no es una prueba: vitest solo recoge *.test.ts).
// - AlmacenFalso: en memoria y atómico (`nuevo: true` choca), con registro de operaciones y un gancho `antes`
//   para diferir o hacer fallar operaciones concretas.
// - RelojFalso: reloj controlado con temporizadores de un disparo y `dormir` que escucha la señal; `auto()` salta al
//   siguiente temporizador cada vez que el sistema queda ocioso (para jugar torneos enteros sin esperar).
import { TORNEO_ARENA as T, TORNEO_SITIO as S } from "../../sim/limites";
import type { AlmacenTorneos } from "../almacen-torneos";
import { GestorTorneoSitio, type DepsGestor } from "../torneo-sitio";
import entradas from "../torneo-sitio-entradas.json";
import type { EntradasSitio } from "../torneo-formatos";

export type Op = "leer" | "crear" | "escribir" | "anexar" | "listar" | "borrar" | "leerBytes" | "bytes";
export const ESCRITURAS: readonly Op[] = ["crear", "escribir", "anexar", "borrar", "bytes"];
const enoent = (n: string) => Object.assign(new Error(`ENOENT ${n}`), { code: "ENOENT" });

export class AlmacenFalso implements AlmacenTorneos {
  tipo: "local" | "blob" = "local";
  archivos = new Map<string, string | Uint8Array>();
  ops: { op: Op; nombre: string; etiqueta: string }[] = [];
  /** Gancho por operación, ANTES de aplicarla: puede esperar (diferir) o lanzar (fallo sin efecto). */
  antes?: (op: Op, nombre: string, datos?: string) => Promise<void> | void;
  /** Gancho DESPUÉS de aplicarla: si lanza, la operación persistió pero el llamador ve un error. */
  despues?: (op: Op, nombre: string) => void;
  etiquetaActual = "";
  private async paso(op: Op, nombre: string, datos?: string) { this.ops.push({ op, nombre, etiqueta: this.etiquetaActual }); await this.antes?.(op, nombre, datos); }
  async iniciar() {}
  async leer(n: string) { await this.paso("leer", n); const v = this.archivos.get(n); if (v === undefined) throw enoent(n); return typeof v === "string" ? v : Buffer.from(v).toString("utf8"); }
  async escribir(n: string, texto: string, nuevo = false) {
    await this.paso(nuevo ? "crear" : "escribir", n, texto);
    if (nuevo && this.archivos.has(n)) throw Object.assign(new Error(`EEXIST ${n}`), { code: "EEXIST" });
    this.archivos.set(n, texto); this.despues?.(nuevo ? "crear" : "escribir", n);
  }
  async anexar(n: string, texto: string) { await this.paso("anexar", n, texto); this.archivos.set(n, String(this.archivos.get(n) ?? "") + texto); this.despues?.("anexar", n); }
  async listar() { await this.paso("listar", "*"); return [...this.archivos.keys()]; }
  async borrar(n: string) { await this.paso("borrar", n); this.archivos.delete(n); }
  async leerBytes(n: string) { await this.paso("leerBytes", n); const v = this.archivos.get(n); if (v === undefined) throw enoent(n); return typeof v === "string" ? new TextEncoder().encode(v) : v; }
  async escribirBytes(n: string, d: Uint8Array) { await this.paso("bytes", n); this.archivos.set(n, new Uint8Array(d)); }
  escrituras(desde = 0, filtro: (o: { op: Op; nombre: string; etiqueta: string }) => boolean = () => true) { return this.ops.slice(desde).filter(o => ESCRITURAS.includes(o.op) && filtro(o)); }
  texto(n: string) { const v = this.archivos.get(n); return v === undefined ? undefined : typeof v === "string" ? v : Buffer.from(v).toString("utf8"); }
  json<X = unknown>(n: string) { const t = this.texto(n); return t === undefined ? undefined : JSON.parse(t) as X; }
}

/** Vista etiquetada de un almacén compartido (cada gestor, su «proceso»). Con `muerto()` verdadero, toda operación
 * queda colgada para siempre: simula un proceso caído o congelado. */
export function vista(base: AlmacenFalso, etiqueta: string, muerto: () => boolean = () => false): AlmacenTorneos {
  const envolver = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A): Promise<R> => {
    if (muerto()) return new Promise<R>(() => {});
    base.etiquetaActual = etiqueta;
    const r = fn(...a); base.etiquetaActual = "";
    return r.then(v => (muerto() ? new Promise<R>(() => {}) : v));
  };
  return {
    get tipo() { return base.tipo; },
    iniciar: envolver(() => base.iniciar()), leer: envolver((n: string) => base.leer(n)), escribir: envolver((n: string, t: string, nuevo?: boolean) => base.escribir(n, t, nuevo)),
    anexar: envolver((n: string, t: string) => base.anexar(n, t)), listar: envolver(() => base.listar()), borrar: envolver((n: string) => base.borrar(n)),
    leerBytes: envolver((n: string) => base.leerBytes(n)), escribirBytes: envolver((n: string, d: Uint8Array) => base.escribirBytes(n, d)),
  };
}

export const vaciar = async (vueltas = 8) => { for (let i = 0; i < vueltas; i++) await new Promise<void>(r => setImmediate(r)); };
const abortError = () => new DOMException("Cancelado", "AbortError");

export class RelojFalso {
  t: number;
  private n = 0;
  timers: { en: number; id: number; fn: () => void }[] = [];
  private corriendo = false;
  constructor(inicioIso = "2026-10-26T12:00:00.000Z") { this.t = Date.parse(inicioIso); }
  ahora = () => this.t;
  programar = (fn: () => void, ms: number) => { const id = ++this.n; this.timers.push({ en: this.t + ms, id, fn }); return () => { this.timers = this.timers.filter(x => x.id !== id); }; };
  dormir = (ms: number, signal?: AbortSignal) => new Promise<void>((resolver, rechazar) => {
    if (signal?.aborted) { rechazar(abortError()); return; }
    const alAbortar = () => { cancelar(); rechazar(abortError()); };
    const cancelar = this.programar(() => { signal?.removeEventListener("abort", alAbortar); resolver(); }, ms);
    signal?.addEventListener("abort", alAbortar, { once: true });
  });
  /** Avanza el reloj ejecutando en orden los temporizadores vencidos (y dejando correr sus promesas). */
  async avanzar(ms: number) {
    const fin = this.t + ms;
    while (true) {
      await vaciar();
      const prox = this.timers.filter(x => x.en <= fin).sort((a, b) => a.en - b.en || a.id - b.id)[0];
      if (!prox) break;
      this.timers = this.timers.filter(x => x.id !== prox.id);
      this.t = Math.max(this.t, prox.en); prox.fn();
    }
    this.t = fin; await vaciar();
  }
  /** Salta al siguiente temporizador cada vez que el sistema queda ocioso, hasta `detener()`. */
  auto(): () => void {
    this.corriendo = true;
    void (async () => {
      while (this.corriendo) {
        await vaciar(3);
        const prox = [...this.timers].sort((a, b) => a.en - b.en || a.id - b.id)[0];
        if (!prox || !this.corriendo) continue;
        this.timers = this.timers.filter(x => x.id !== prox.id);
        this.t = Math.max(this.t, prox.en); prox.fn();
      }
    })();
    return () => { this.corriendo = false; };
  }
}

export const COMMIT = "0123456789abcdef0123456789abcdef01234567";
export const TOKEN = "t".repeat(S.admin.tokenMinCaracteres);
export const ORIGEN = "http://localhost:3000";
export const ENTRADAS = entradas as EntradasSitio;
/** Entorno de ensayo (participantes a–f programados, sin coste) con la duración mínima y sin ritmo. */
export const envEnsayo = (extra: Record<string, string | undefined> = {}) => ({
  ARENA_TORNEO_SITIO: "1", CRONISTA_COMMIT: COMMIT, ARENA_ORIGEN_PUBLICO: ORIGEN, ARENA_ADMIN_TOKEN: TOKEN,
  ARENA_TORNEO_SITIO_ENSAYO: "1", ARENA_TORNEO_SITIO_SEGUNDOS: String(T.ensayoSegundos.min), ARENA_TORNEO_SITIO_SIN_RITMO: "1", ...extra,
});
export const CLAVE_FALSA = "clave-centinela-torneo-062";
/** Entorno real (los 6 modelos de las entradas en ARENA_MODELOS, con su deployment) y `fetch` falso. */
export const envReal = (extra: Record<string, string | undefined> = {}) => {
  const env: Record<string, string | undefined> = {
    ARENA_TORNEO_SITIO: "1", CRONISTA_COMMIT: COMMIT, ARENA_ORIGEN_PUBLICO: ORIGEN, ARENA_ADMIN_TOKEN: TOKEN,
    AZURE_OPENAI_API_KEY: CLAVE_FALSA, AZURE_OPENAI_ENDPOINT: "https://falso-062.openai.azure.com",
    ARENA_MODELOS: JSON.stringify(ENTRADAS.participantes.map(p => ({ id: p.id, nombre: p.nombre, prefijo: `ARENA_${p.id.toUpperCase()}_` }))),
  };
  for (const p of ENTRADAS.participantes) env[`ARENA_${p.id.toUpperCase()}_AZURE_OPENAI_DEPLOYMENT`] = p.deployment;
  return { ...env, ...extra };
};

export function nuevoGestor(o: { almacen: AlmacenTorneos; env: Record<string, string | undefined>; reloj: RelojFalso; deps?: Partial<DepsGestor> }) {
  const sigterm: (() => void)[] = [];
  const logs: string[] = [];
  const g = new GestorTorneoSitio({ almacen: o.almacen, env: o.env, ahora: o.reloj.ahora, programar: o.reloj.programar, dormir: o.reloj.dormir, registrarSigterm: fn => sigterm.push(fn), log: s => logs.push(s), ...o.deps });
  return { g, logs, sigterm: () => sigterm.forEach(f => f()) };
}
/** Arranca y espera a que el gestor libere la barrera (sin latidos ajenos frescos). */
export async function arrancar(g: GestorTorneoSitio) { g.iniciar(); for (let i = 0; i < 50 && g.barrera; i++) await vaciar(); }
