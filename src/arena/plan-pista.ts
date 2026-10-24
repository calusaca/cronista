// Brief 060 · Pista narrada al ritmo del partido (Reproducir). Planificador puro: coloca cada clip después de su
// hecho y con un retraso acotado; la cancha corre a 1× y solo se detiene en esperas rotuladas (previa, invitado,
// jugada clave y final). Sin estado, sin DOM y sin audio: las entradas son ticks y duraciones decodificadas.
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA, REPETICION_NARRADA } from "../sim/limites";
import type { TramoTemporal } from "./pista-audio";
import type { EventoArena, RegistroArena } from "./tipos";

export type TipoPieza = "previa" | "narrador" | "invitado" | "cierre";
export interface PiezaPlan { id: string; tipo: TipoPieza; tick: number; duracionS: number; prioridad: number; orden: number }
export interface Colocada { id: string; tipo: TipoPieza; inicioS: number; finS: number; cursorTick: number; modo?: "corre" | "detiene" }
export type TipoEspera = "previa" | "invitado" | "clave" | "final";
export interface EsperaPlan { tipo: TipoEspera; inicioS: number; finS: number; tick: number }
export interface PlanPista {
  /** Contiguos desde 0; ancho > 0 ⇒ (finS − inicioS) = (hastaTick − desdeTick)·pasoS. */
  tramos: TramoTemporal[];
  /** Ordenadas por inicioS, sin solaparse. */
  colocadas: Colocada[];
  omitidas: { id: string; motivo: "retraso" | "cede" | "caducada" }[];
  esperas: EsperaPlan[];
  /** Inicio del primer tramo con ancho > 0 (fin de la previa). */
  inicioJuegoS: number;
  duracionS: number;
}

const EPS = 1e-9;
/** Una pieza importante nunca se omite: el narrador desde `prioridadEspera` y el cierre. */
const importante = (p: PiezaPlan) => p.tipo === "cierre" || p.tipo === "narrador" && p.prioridad >= REPETICION_NARRADA.prioridadEspera;

/**
 * § 3.2 + v1.1 (1)(2) + v1.2 · Reglas, en orden cronológico (tick y después `orden`), con un cursor de cancha `P`
 * (s de partido), un tiempo de audio `T` y el instante `voz` en que la voz queda libre (fin del clip + `huecoS`).
 * - La previa va primero, en espera `previa` con P = 0.
 * - La cancha corre a 1×, pero nunca pasa del tope (`min(A + retrasoMaxS, fin)`) de la siguiente pieza importante
 *   pendiente: si la voz sigue ocupada al llegar ahí, la cancha espera (`clave`, o `final` si el tope es el fin).
 *   Así la espera clave de la regla 3 se aplica sola y ningún clip importante se omite.
 * - Narrador: empieza en el primer T con la voz libre y P ≥ objetivo = min(A + reaccionS, fin); un clip menor con
 *   P(inicio) > min(A + retrasoMaxS, fin) se omite (`retraso`) y uno que terminaría después del instante en que la
 *   cancha alcanza el objetivo de la siguiente pieza importante, también (`cede`).
 * - Invitado: igual objetivo (nunca delante); si P − tick > caducidadInvitadoS se omite (`caducada`). Si su fin más
 *   `huecoS` pasa del objetivo de la siguiente importante, detiene la cancha (espera `invitado`) y nunca se omite.
 * - Cierre: con P = fin, cuando la voz queda libre; la espera `final` cubre su duración.
 */
export function planificarPista(piezas: readonly PiezaPlan[], finTick: number): PlanPista {
  const R = REPETICION_NARRADA, paso = ARENA.pasoS, fin = Math.max(0, finTick) * paso;
  if (!Number.isFinite(fin) || piezas.some(p => !Number.isFinite(p.tick) || !Number.isFinite(p.duracionS) || p.duracionS <= 0)) throw new Error("Pieza de pista inválida");
  const tramos: TramoTemporal[] = [], esperas: EsperaPlan[] = [], colocadas: Colocada[] = [], omitidas: PlanPista["omitidas"] = [];
  let T = 0, P = 0, voz = 0;
  /** Añade un tramo que corre de (T, P) a (T + d, P + d). */
  const correr = (d: number) => {
    if (d <= EPS) return;
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.hastaTick > ultimo.desdeTick && Math.abs(ultimo.finS - T) < EPS) { ultimo.finS = T + d; ultimo.hastaTick = (P + d) / paso; }
    else tramos.push({ inicioS: T, finS: T + d, desdeTick: P / paso, hastaTick: (P + d) / paso });
    T += d; P += d;
  };
  /** Espera de ancho cero en P desde T hasta T + d. */
  const esperar = (d: number, tipo: TipoEspera) => {
    if (d <= EPS) return;
    const ultimo = tramos.at(-1), e = esperas.at(-1);
    if (ultimo && ultimo.hastaTick === ultimo.desdeTick && e && e.tipo === tipo && Math.abs(e.finS - T) < EPS) { ultimo.finS = T + d; e.finS = T + d; }
    else { tramos.push({ inicioS: T, finS: T + d, desdeTick: P / paso, hastaTick: P / paso }); esperas.push({ tipo, inicioS: T, finS: T + d, tick: P / paso }); }
    T += d;
  };
  /** Avanza el audio hasta `destino`: la cancha corre hasta `tope` y después espera con el tipo dado. */
  const avanzar = (destino: number, tope: number, tipo: TipoEspera) => {
    if (destino <= T + EPS) return;
    correr(Math.max(0, Math.min(destino - T, tope - P)));
    esperar(destino - T, tipo);
  };
  /** Primer T' ≥ T con P(T') ≥ objetivo y T' ≥ voz, sin pasar del tope; y el cursor en ese instante. */
  const inicioCon = (objetivo: number, tope: number) => {
    const alcanza = T + Math.max(0, objetivo - P), inicio = Math.max(alcanza, voz, T);
    return { inicio, cursor: Math.min(tope, P + (inicio - T)) };
  };

  // 1 · Previa: una tras otra desde T = 0 con P = 0, en espera `previa` (también el hueco entre dos piezas).
  const orden = (x: PiezaPlan, y: PiezaPlan) => x.tick - y.tick || x.orden - y.orden;
  for (const p of piezas.filter(p => p.tipo === "previa").sort(orden)) {
    esperar(voz - T, "previa");
    colocadas.push({ id: p.id, tipo: p.tipo, inicioS: T, finS: T + p.duracionS, cursorTick: P / paso, modo: "detiene" });
    esperar(p.duracionS, "previa");
    voz = T + R.huecoS;
  }
  const inicioJuegoS = T;

  const resto = piezas.filter(p => p.tipo !== "previa").sort(orden);
  for (let i = 0; i < resto.length; i++) {
    const p = resto[i]!, A = Math.min(Math.max(0, p.tick * paso), fin);
    const objetivo = Math.min(A + R.reaccionS, fin), topePropio = Math.min(A + R.retrasoMaxS, fin);
    // Siguiente pieza importante pendiente (la propia si lo es): fija el tope de la cancha y el objetivo a respetar.
    const siguiente = resto.slice(importante(p) ? i : i + 1).find(importante);
    const Asig = siguiente ? Math.min(Math.max(0, siguiente.tick * paso), fin) : fin;
    const tope = siguiente ? siguiente.tipo === "cierre" ? fin : Math.min(Asig + R.retrasoMaxS, fin) : fin;
    const objetivoSig = siguiente ? siguiente.tipo === "cierre" ? fin : Math.min(Asig + R.reaccionS, fin) : Infinity;
    const tipoTope: TipoEspera = !siguiente || siguiente.tipo === "cierre" || tope >= fin - EPS ? "final" : "clave";
    if (p.tipo === "cierre") {
      const { inicio } = inicioCon(fin, fin);
      avanzar(inicio, fin, "final");
      colocadas.push({ id: p.id, tipo: p.tipo, inicioS: T, finS: T + p.duracionS, cursorTick: P / paso, modo: "detiene" });
      esperar(p.duracionS, "final");
      voz = T + R.huecoS;
      continue;
    }
    const { inicio, cursor } = inicioCon(objetivo, tope);
    /** Instante de audio en que la cancha (corriendo desde el inicio del clip) alcanza el objetivo de la siguiente importante. */
    const alcanzaSig = siguiente && siguiente !== p ? inicio + Math.max(0, objetivoSig - cursor) : Infinity;
    if (p.tipo === "narrador") {
      if (cursor > topePropio + EPS) { omitidas.push({ id: p.id, motivo: "retraso" }); continue; }
      if (!importante(p) && inicio + p.duracionS > alcanzaSig + EPS) { omitidas.push({ id: p.id, motivo: "cede" }); continue; }
      avanzar(inicio, tope, tipoTope);
      colocadas.push({ id: p.id, tipo: p.tipo, inicioS: T, finS: T + p.duracionS, cursorTick: P / paso, modo: "corre" });
      voz = T + p.duracionS + R.huecoS;
      continue;
    }
    // Invitado: va detrás (P ≥ tick + reaccionS) y caduca; si chocaría con la siguiente importante, detiene.
    if (cursor - A > MESA_ARENA.caducidadInvitadoS + EPS) { omitidas.push({ id: p.id, motivo: "caducada" }); continue; }
    avanzar(inicio, tope, tipoTope);
    const detiene = inicio + p.duracionS + R.huecoS > alcanzaSig + EPS;
    colocadas.push({ id: p.id, tipo: p.tipo, inicioS: T, finS: T + p.duracionS, cursorTick: P / paso, modo: detiene ? "detiene" : "corre" });
    if (detiene) { esperar(p.duracionS, "invitado"); voz = T + R.huecoS; }
    else voz = T + p.duracionS + R.huecoS;
  }
  // La cancha termina de correr hasta el fin; si la voz sigue ocupada, espera `final` hasta que termine el último clip.
  correr(fin - P);
  const ultimoFin = colocadas.reduce((m, c) => Math.max(m, c.finS), 0);
  esperar(ultimoFin - T, "final");
  if (!tramos.length) tramos.push({ inicioS: 0, finS: 0, desdeTick: P / paso, hastaTick: P / paso });
  // Colocadas en orden de audio (la previa ya va primero).
  colocadas.sort((x, y) => x.inicioS - y.inicioS);
  return { tramos, colocadas, omitidas, esperas, inicioJuegoS, duracionS: T };
}

/** § 3.3 · Segmento visible (transcripción): la última colocada con inicioS ≤ t, o la primera si no hay. */
export function segmentoEn(colocadas: readonly Colocada[], t: number): number {
  if (!colocadas.length) return -1;
  let k = 0;
  for (let i = 0; i < colocadas.length; i++) if (colocadas[i]!.inicioS <= t) k = i;
  return k;
}

/** v1.1 (3) · Eventos de la ventana (desdeTick, hastaTick] (o el tick 0 con desdeTick 0) con prioridad ≥
 * prioridadEspera, en orden de tick (y de registro): los que la pista al ritmo nunca deja sin clip. */
export function importantesVentana(registro: Pick<RegistroArena, "eventos">, desdeTick: number, hastaTick: number): EventoArena[] {
  return registro.eventos
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => (e.tick > desdeTick || desdeTick === 0 && e.tick === 0) && e.tick <= hastaTick && (PRIORIDAD_EVENTO_ARENA[e.tipo] ?? 0) >= REPETICION_NARRADA.prioridadEspera)
    .sort((x, y) => x.e.tick - y.e.tick || x.i - y.i).map(x => x.e);
}
