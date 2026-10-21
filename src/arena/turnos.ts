import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../sim/limites";
import { VOZ_BUFFER } from "./buffer";
import type { RecuerdoVoz } from "./editorial";
import type { IntervencionArena, TurnoMesa, VarianteIntercambio } from "./protocolo";
import type { EstadoArena, RegistroArena } from "./tipos";

/** Brief 045 · Coordinador de turnos de la mesa. Función pura: no lee el DOM ni Web Audio.
 * Brief 048 v1.1 · Cada candidata tiene dos variantes (completa y breve) con estado explícito;
 * el coordinador elige solo entre variantes válidas según la ventana conocida. */
export type Rol = "narrador" | "comentarista" | "estadista";
export type EstadoVariante =
  | { estado: "inexistente" | "pendiente" | "invalida" | "fallida" }
  | { estado: "valida"; duracionS: number };
/** v1.2 (6) · `origen` distingue los diarios del 045 (sin turnos) de los intercambios del 048. */
export interface CandidataTurno { id: string; rol: Rol; tick: number; origen: "045" | "048"; completa: EstadoVariante; breve: EstadoVariante }
export interface EntradaTurno {
  partidoS: number;                 // cursor visible
  ahoraAudioS: number;              // reloj Web Audio
  fuenteActiva: { rol: Rol; prioridad: number; finS: number } | null; // reservas incluidas (prioridad −1)
  finUltimaNoticiaS: number | null; // fin (reloj de audio) del último clip del narrador con prioridad ≥ VOZ_BUFFER.prioridadInterrupcion; null si aún no hubo
  finUltimoInvitadoS: number | null; ultimoInvitado: { rol: Rol; tick: number } | null;
  pausaVigente: boolean;            // 048: calmaEnFotograma(cursor) — pausa vigente o balón en manos del portero
  terminada: boolean; cerrando: boolean;
  aperturaPendiente: boolean;       // v3.1: la entrada del narrador aún no sonó (pedida, en vuelo o decodificada sin consumir)
  /** 048 · ventanaConocidaS en el cursor: horizonte conservador hasta la próxima noticia. */
  ventanaS: number | null;
  candidatas: CandidataTurno[];
}

/** Estado de una variante a partir de la duración decodificada: válida solo si es finita, positiva
 * y ≤ VOZ_BUFFER.duracionMaxS (no se recorta audio). */
export function estadoPorDuracion(duracionS: number): EstadoVariante {
  return Number.isFinite(duracionS) && duracionS > 0 && duracionS <= VOZ_BUFFER.duracionMaxS ? { estado: "valida", duracionS } : { estado: "invalida" };
}
const valida = (v: EstadoVariante): v is { estado: "valida"; duracionS: number } => v.estado === "valida";
/** Puede llegar a sonar: válida o aún pendiente. */
const posible = (v: EstadoVariante) => v.estado === "valida" || v.estado === "pendiente";

const edadS = (c: CandidataTurno, e: EntradaTurno) => e.partidoS - c.tick * ARENA.pasoS;
/** Caducidad propia del invitado (no el atraso del narrador): ni vieja ni futura. */
const aTiempo = (c: CandidataTurno, e: EntradaTurno) => c.rol !== "narrador" && edadS(c, e) <= MESA_ARENA.caducidadInvitadoS && c.tick * ARENA.pasoS <= e.partidoS + 1e-6;
const conFuturo = (c: CandidataTurno) => posible(c.completa) || posible(c.breve);
const conValida = (c: CandidataTurno) => valida(c.completa) || valida(c.breve);

/** v1.1 (1) · Variante que puede arrancar ahora, solo entre válidas:
 * - v1.2 (6): un diario del 045 (`origen: "045"`) conserva su regla: la completa válida arranca
 *   sin consultar la ventana y puede ser cortada;
 * - un intercambio del 048 colapsado (sin breve: la completa ES la breve) arranca si la completa
 *   cabe o si la ventana es desconocida (allí se usaría la breve, que es la misma);
 * - con dos variantes: la completa si cabe en la ventana; si no, la breve si cabe; con la ventana
 *   desconocida (límite exacto del prefijo) se usa la breve; si ninguna cabe o ninguna es válida,
 *   no arranca. */
export function varianteElegible(c: CandidataTurno, ventanaS: number | null): VarianteIntercambio | null {
  if (c.origen === "045") return valida(c.completa) ? "completa" : null;
  if (c.breve.estado === "inexistente") return valida(c.completa) && (ventanaS === null || c.completa.duracionS <= ventanaS + 1e-9) ? "completa" : null;
  if (valida(c.completa) && ventanaS !== null && c.completa.duracionS <= ventanaS + 1e-9) return "completa";
  if (valida(c.breve) && (ventanaS === null || c.breve.duracionS <= ventanaS + 1e-9)) return "breve";
  return null;
}

/** Candidaturas que ya no pueden sonar: caducadas, sin ninguna variante válida ni pendiente, o
 * superadas por una más reciente del mismo rol con alguna variante válida que ya alcanzó el cursor. */
export function descartesTurno(e: EntradaTurno): string[] {
  const fuera = e.candidatas.filter(c => c.rol === "narrador" || edadS(c, e) > MESA_ARENA.caducidadInvitadoS || !conFuturo(c)).map(c => c.id);
  const superadas = e.candidatas.filter(c => aTiempo(c, e) && e.candidatas.some(o => o.rol === c.rol && o.tick > c.tick && aTiempo(o, e) && conValida(o))).map(c => c.id);
  return [...new Set([...fuera, ...superadas])];
}

/** Los invitados nunca interrumpen: solo con ninguna fuente audible, en calma (o en pausa o con el
 * balón en las manos del portero), separados del invitado anterior y nunca tras el final. Alterna
 * roles. v3.1: la entrada del narrador precede siempre a los invitados. 048: elige la variante. */
export function siguienteTurno(e: EntradaTurno): { id: string; variante: VarianteIntercambio; recuerdo: RecuerdoVoz } | null {
  if (e.fuenteActiva !== null || e.terminada || e.cerrando || e.aperturaPendiente) return null;
  const calma = e.finUltimaNoticiaS === null || e.ahoraAudioS - e.finUltimaNoticiaS >= MESA_ARENA.calmaMinS || e.pausaVigente;
  if (!calma) return null;
  if (e.finUltimoInvitadoS !== null && e.ahoraAudioS - e.finUltimoInvitadoS < MESA_ARENA.separacionInvitadosS) return null;
  const vigentes = e.candidatas.filter(c => aTiempo(c, e) && conFuturo(c));
  const orden: Rol[] = e.ultimoInvitado?.rol === "comentarista" ? ["estadista", "comentarista"] : ["comentarista", "estadista"];
  for (const rol of orden) {
    // Dentro del rol, la más reciente que puede arrancar ya (v1.2, B13: una candidata solo
    // pendiente no desplaza a una válida; las superadas ya salieron por descartesTurno).
    for (const c of vigentes.filter(c => c.rol === rol).sort((a, b) => b.tick - a.tick)) {
      const variante = varianteElegible(c, e.ventanaS);
      // v3.1: `texto = id`, nunca el texto hablado; el consumidor lo añade tal cual, solo al arrancar.
      if (variante) return { id: c.id, variante, recuerdo: { tick: Math.floor(e.partidoS / ARENA.pasoS + 1e-9), texto: c.id, clave: c.id, tema: rol, estado: "iniciada", rol } };
    }
  }
  return null;
}

/** Brief 048 · Calma en el fotograma del cursor: pausa vigente (045) o balón en las manos del
 * portero (046). */
export function calmaEnFotograma(estado: EstadoArena): boolean {
  return !!(estado.pausa && estado.pausa.hastaTick > estado.tick) || !!(estado.balon.manos && estado.balon.manos.hastaTick > estado.tick);
}

const esNoticia = (tipo: string) => (PRIORIDAD_EVENTO_ARENA[tipo as keyof typeof PRIORIDAD_EVENTO_ARENA] ?? 0) >= VOZ_BUFFER.prioridadInterrupcion;
/** Brief 048 v1.1 (5) · Noticias ya alcanzadas por el cursor que aún pueden sonar: eventos con
 * prioridad ≥ prioridadInterrupcion entre `desdeS` (activación de la voz) y el cursor, dentro del
 * atraso admitido del narrador y que todavía no sonaron (`sonadas`: ids de evento ya emitidos). */
export function noticiaPendiente(registro: RegistroArena, partidoS: number, sonadas: ReadonlySet<string>, desdeS = 0): boolean {
  const atraso = Math.max(VOZ_BUFFER.atrasoNormalS, VOZ_BUFFER.atrasoImportanteS);
  return registro.eventos.some(e => esNoticia(e.tipo) && e.tick * ARENA.pasoS <= partidoS + 1e-9 && e.tick * ARENA.pasoS >= desdeS - 1e-9 && partidoS - e.tick * ARENA.pasoS <= atraso && !sonadas.has(e.id));
}

/** Brief 048 · Horizonte conservador (segundos de partido) desde el cursor hasta la primera noticia
 * del prefijo recibido; una noticia ya alcanzada pero pendiente de sonar lo anula (0). Sin noticias,
 * hasta el final del prefijo (cota inferior si la sesión no terminó). `null` fuera del prefijo o en
 * su límite exacto con la sesión en curso: entonces el coordinador usa la breve. Solo decide la
 * variante; textos y fotogramas visibles siguen filtrados por el cursor. */
export function ventanaConocidaS(registro: RegistroArena, partidoS: number, terminada: boolean, opciones: { pendiente?: boolean } = {}): number | null {
  const finS = registro.final.tick * ARENA.pasoS;
  if (!Number.isFinite(partidoS) || partidoS < 0 || partidoS > finS + 1e-9) return null;
  if (opciones.pendiente) return 0;
  const proxima = registro.eventos.find(e => e.tick * ARENA.pasoS > partidoS + 1e-9 && esNoticia(e.tipo));
  if (proxima) return proxima.tick * ARENA.pasoS - partidoS;
  if (!terminada && partidoS >= finS - 1e-9) return null;
  return finS - partidoS;
}

/** v1.2 (7) · Horizonte único del consumidor: el mismo para pedir la completa y para elegir la
 * variante. Ventana conocida desde `partidoS` (el cursor, o el tick de la intervención si aún no
 * llegó) anulada por las noticias que el CURSOR ya alcanzó y aún no sonaron. */
export function horizonteS(registro: RegistroArena, partidoS: number, terminada: boolean, sonadas: ReadonlySet<string>, desdeS: number, cursorS = partidoS): number | null {
  return ventanaConocidaS(registro, partidoS, terminada, { pendiente: noticiaPendiente(registro, cursorS, sonadas, desdeS) });
}

/** Brief 048 v1.1 (8) · Estimación de la duración hablada de una variante: caracteres del texto más
 * largo (ES o EN) entre caracteresPorSegundoVoz, más pausaTurnoS por turno tras el primero. Solo
 * decide la composición y la petición de la completa; la garantía es el rechazo por duración real. */
export function estimarDuracionS(turnos: readonly Pick<TurnoMesa, "texto_es" | "texto_en">[]): number {
  if (!turnos.length) return 0;
  const caracteres = Math.max(turnos.map(t => t.texto_es).join(" ").length, turnos.map(t => t.texto_en).join(" ").length);
  return caracteres / MESA_ARENA.dialogo.caracteresPorSegundoVoz + (turnos.length - 1) * MESA_ARENA.dialogo.pausaTurnoS;
}

/** v1.1 (2) · Variante que el servidor sirve para una pedida: la breve solo existe con `turnosBreve`. */
export function varianteEfectiva(intervencion: Pick<IntervencionArena, "turnosBreve">, pedida: VarianteIntercambio): VarianteIntercambio {
  return pedida === "breve" && intervencion.turnosBreve?.length ? "breve" : "completa";
}

interface SegmentoRecibido {
  desdeTick: number; hastaTick: number; idioma: string; modo: string; entradaTick?: number; texto: string;
  fragmentos: { tick: number; rol?: string }[]; audio: unknown; tipoRelato?: string; intervencion?: string; variante?: string;
}
/** Validación del consumidor. Solo `tipoRelato: "invitado"` admite varios fragmentos: de 1 a
 * `dialogo.maxTurnos`, todos con el tick de la intervención, sin dos seguidos del mismo rol, con la
 * variante pedida (normalizada) y audio obligatorio. */
export function segmentoVozValido(s: SegmentoRecibido, esperado: { desde: number; hasta: number; idioma: string; entradaTick?: number; intervencion?: { id: string; tick: number; variante?: VarianteIntercambio } }): boolean {
  if (s.desdeTick !== esperado.desde || s.hastaTick !== esperado.hasta || s.idioma !== esperado.idioma || s.modo !== "buffer") return false;
  if (esperado.intervencion || s.tipoRelato === "invitado") {
    const i = esperado.intervencion;
    return !!i && s.tipoRelato === "invitado" && s.intervencion === i.id && s.entradaTick === undefined && !!s.texto && !!s.audio
      && s.variante === (i.variante ?? "completa")
      && s.fragmentos.length >= 1 && s.fragmentos.length <= MESA_ARENA.dialogo.maxTurnos && s.fragmentos.every(f => f.tick === i.tick)
      && s.fragmentos.every((f, k) => k === 0 || (f.rol ?? "narrador") !== (s.fragmentos[k - 1]!.rol ?? "narrador"));
  }
  return !(s.entradaTick !== esperado.entradaTick || s.fragmentos.length > 1 || s.fragmentos.some(f => f.tick < esperado.desde || f.tick > esperado.hasta) || s.texto && !s.audio || s.audio && s.fragmentos.length !== 1);
}
