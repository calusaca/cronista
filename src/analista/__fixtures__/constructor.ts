// Constructor de partidos a mano para los fixtures del Analista.
// Emite eventos con el mismo contrato que el simulador 001 v1.1 (ids secuenciales,
// gol/atajada colgados de su tiro, tarjeta colgada de su falta, cambio con `sale`).
// Los jugadores se nombran por índice de plantilla: 0 POR, 1–4 DEF, 5–7 MED,
// 8–10 DEL, 11 POR suplente, 12 DEF, 13–14 MED, 15 DEL suplente.

import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Lado, Partido, SimConfig, TipoEvento, Zona } from "../../sim/tipos";

export const EQUIPO_LOCAL = "Atlético Torreluna";
export const EQUIPO_VISITA = "Racing Marisal";

export class Constructor {
  readonly config: SimConfig;
  private readonly eventos: Evento[] = [];

  constructor() {
    this.config = configDeSemilla(
      1,
      { nombre: EQUIPO_LOCAL, ataque: 70, defensa: 70, estilo: "posesion" },
      { nombre: EQUIPO_VISITA, ataque: 70, defensa: 70, estilo: "contragolpe" },
    );
  }

  jugador(lado: Lado, idx: number): string {
    const j = this.config[lado].jugadores[idx];
    if (!j) throw new Error(`fixture: no hay jugador ${idx} en ${lado}`);
    return j.nombre;
  }

  private emitir(minuto: number, tipo: TipoEvento, equipo: Lado, extra: Partial<Evento> = {}): string {
    const id = `e${String(this.eventos.length + 1).padStart(3, "0")}`;
    this.eventos.push({ id, minuto, tipo, equipo, ...extra });
    return id;
  }

  /** inicio_periodo del 1T en el minuto 0. */
  abrir(): this {
    this.emitir(0, "inicio_periodo", "local");
    return this;
  }

  /** fin del 1T (sellado en 45) e inicio del 2T en 45. */
  descanso(): this {
    this.emitir(45, "fin_periodo", "local");
    this.emitir(45, "inicio_periodo", "visita");
    return this;
  }

  /** fin del partido (por defecto 90+3). */
  cerrar(minuto = 93): Partido {
    this.emitir(minuto, "fin_periodo", "visita");
    return { config: this.config, eventos: this.eventos.map((e) => ({ ...e })) };
  }

  tiro(minuto: number, lado: Lado, idx: number, xg: number, penal = false): string {
    return this.emitir(minuto, "tiro", lado, { jugador: this.jugador(lado, idx), zona: "ataque", xg, penal });
  }

  /** Tiro + gol. Devuelve el id del gol. */
  gol(minuto: number, lado: Lado, idx: number, xg = 0.2, penal = false): string {
    const t = this.tiro(minuto, lado, idx, xg, penal);
    return this.emitir(minuto, "gol", lado, { jugador: this.jugador(lado, idx), zona: "ataque", xg, relacionadoCon: t });
  }

  /** Tiro + atajada (la atajada lleva el equipo del tirador, contrato 001). Devuelve el id de la atajada. */
  atajada(minuto: number, lado: Lado, idx: number, xg = 0.1): string {
    const t = this.tiro(minuto, lado, idx, xg);
    return this.emitir(minuto, "atajada", lado, { zona: "ataque", relacionadoCon: t });
  }

  corner(minuto: number, lado: Lado, idx = 6): string {
    return this.emitir(minuto, "corner", lado, { jugador: this.jugador(lado, idx), zona: "ataque" });
  }

  paseClave(minuto: number, lado: Lado, idx = 6): string {
    return this.emitir(minuto, "pase_clave", lado, { jugador: this.jugador(lado, idx), zona: "ataque" });
  }

  falta(minuto: number, lado: Lado, idx: number, zona: Zona = "medio"): string {
    return this.emitir(minuto, "falta", lado, { jugador: this.jugador(lado, idx), zona });
  }

  /** Falta + amarilla. Devuelve el id de la tarjeta. */
  amarilla(minuto: number, lado: Lado, idx: number): string {
    const f = this.falta(minuto, lado, idx);
    return this.emitir(minuto, "tarjeta_amarilla", lado, { jugador: this.jugador(lado, idx), zona: "medio", relacionadoCon: f });
  }

  /** Falta + roja (directa, o doble amarilla si el jugador ya tenía una). Devuelve el id de la roja. */
  roja(minuto: number, lado: Lado, idx: number): string {
    const f = this.falta(minuto, lado, idx);
    return this.emitir(minuto, "tarjeta_roja", lado, { jugador: this.jugador(lado, idx), zona: "medio", relacionadoCon: f });
  }

  cambio(minuto: number, lado: Lado, entra: number, sale: number): string {
    return this.emitir(minuto, "cambio", lado, { jugador: this.jugador(lado, entra), sale: this.jugador(lado, sale) });
  }

  /** Id del último evento emitido (para fixtures que necesitan citar algo concreto). */
  ultimo(): string {
    return (this.eventos[this.eventos.length - 1] as Evento).id;
  }
}
