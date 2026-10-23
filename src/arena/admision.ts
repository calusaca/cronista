// Brief 057 v1.1 § 3 · Admisión de trabajos caros (subidas de registros que el servidor vuelve a jugar con
// `reproducirArena`, síncrono): ventana deslizante en memoria por clave (IP) y global, más un tope de
// trabajos en curso. Pura salvo el reloj, que se inyecta; no persiste nada (una réplica, como `creando`).

export interface LimitesAdmision {
  /** Admisiones por clave dentro de `ventanaMs`. */
  porIpPorHora: number;
  /** Admisiones totales dentro de `ventanaMs`. */
  globalPorHora: number;
  /** Trabajos admitidos y aún no liberados. */
  enCurso: number;
  /** Ancho de la ventana deslizante (ms). */
  ventanaMs: number;
}
export type MotivoRechazo = "ip" | "global" | "en-curso";
export type ResultadoAdmision = { ok: true; liberar(): void } | { ok: false; motivo: MotivoRechazo; reintentarEnMs: number };

export class Admision {
  private porClave = new Map<string, number[]>();
  private global: number[] = [];
  private activos = 0;
  constructor(private readonly limites: LimitesAdmision, private readonly reloj: () => number = Date.now, private readonly esperaEnCursoMs = 1000) {}
  private podar(marcas: number[], ahora: number): number[] { return marcas.filter(t => ahora - t < this.limites.ventanaMs); }
  admitir(clave: string): ResultadoAdmision {
    const ahora = this.reloj();
    this.global = this.podar(this.global, ahora);
    for (const [k, marcas] of this.porClave) { const vivas = this.podar(marcas, ahora); if (vivas.length) this.porClave.set(k, vivas); else this.porClave.delete(k); }
    if (this.activos >= this.limites.enCurso) return { ok: false, motivo: "en-curso", reintentarEnMs: this.esperaEnCursoMs };
    const propias = this.porClave.get(clave) ?? [];
    if (propias.length >= this.limites.porIpPorHora) return { ok: false, motivo: "ip", reintentarEnMs: Math.max(1, propias[0]! + this.limites.ventanaMs - ahora) };
    if (this.global.length >= this.limites.globalPorHora) return { ok: false, motivo: "global", reintentarEnMs: Math.max(1, this.global[0]! + this.limites.ventanaMs - ahora) };
    this.porClave.set(clave, [...propias, ahora]); this.global.push(ahora); this.activos++;
    let liberado = false;
    return { ok: true, liberar: () => { if (liberado) return; liberado = true; this.activos--; } };
  }
}

const compartida = globalThis as typeof globalThis & { __cronistaAdmisionSubidas?: Admision };
/** Admisión compartida de las subidas a /api/arena/grabaciones (una por réplica; las pruebas la sustituyen). */
export function admisionSubidas(crear: () => Admision): Admision { return compartida.__cronistaAdmisionSubidas ??= crear(); }
