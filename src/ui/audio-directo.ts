// Brief 058 · Bloque A · Narración activa por defecto en el directo (solo cliente).
// El AudioContext del directo se ceba DENTRO del gesto de «Iniciar partido en vivo» (desbloqueo clásico de
// WebKit: resume() y una muestra de silencio) y lo adopta después ArenaEmisionBuffer. El arranque propio es
// memoria del módulo, no de almacenamiento: una recarga lo borra. La preferencia por espectador vive en
// localStorage y toda lectura o escritura va en try/catch.
import { NARRACION_DIRECTO } from "../sim/limites";
import type { AsignacionModelos } from "../arena/protocolo";

let cebado: AudioContext | null = null;
const propios = new Map<string, number>();

/** Síncrono, dentro del onClick: crea (o reutiliza) un único contexto, lo reanuda sin esperar y arranca un
 * búfer de una muestra en silencio. Nunca lanza. */
export function cebarAudioDirecto(): void {
  try {
    if (typeof window === "undefined" || typeof window.AudioContext !== "function") return;
    if (!cebado || cebado.state === "closed") cebado = new AudioContext({ sampleRate: 24000 });
    const contexto = cebado;
    // v1.1 § 9: el rechazo de resume() no lo captura el try síncrono.
    void contexto.resume().catch(() => {});
    const fuente = contexto.createBufferSource();
    fuente.buffer = contexto.createBuffer(1, 1, contexto.sampleRate);
    fuente.connect(contexto.destination);
    fuente.start(0);
  } catch { /* Sin Web Audio no hay cebado; el búfer muestra el estado de siempre. */ }
}

/** Entrega el contexto cebado una sola vez (después, null). Un contexto cerrado no se entrega. */
export function tomarAudioCebado(): AudioContext | null {
  const contexto = cebado;
  cebado = null;
  return contexto && contexto.state !== "closed" ? contexto : null;
}

/** Smoke 058 (rev. 0000027) · /herramientas respondió sin voz tras un clic que cebó a ciegas: se cierra el contexto
 * cebado sin más efectos. */
export function descartarAudioCebado(): void {
  const contexto = cebado;
  cebado = null;
  if (contexto && contexto.state !== "closed") void contexto.close().catch(() => {});
}

/** Marca la sesión como iniciada por este espectador en esta página; `t0` (performance.now() del manejador)
 * es el instante del clic que pidió la narración. */
export function marcarArranquePropio(id: string, t0: number = typeof performance === "undefined" ? 0 : performance.now()): void {
  propios.set(id, t0);
}
export function arranquePropio(id: string): boolean {
  return propios.has(id);
}
/** Brief 058 v1.1 § 2 · Instante (performance.now()) del clic de «Iniciar partido en vivo» de una sesión propia. */
export function instanteArranquePropio(id: string): number | null {
  return propios.get(id) ?? null;
}

// Brief 058 · B · Asignación pública de la sesión que muestra el directo (la publica ArenaEnDirecto al recibir el
// POST, la instantánea o el mensaje `sesion`); la lee ArenaEmisionBuffer para derivar los ids de la antesala.
// Memoria del módulo, por id de sesión.
const asignaciones = new Map<string, AsignacionModelos>();
const oyentes = new Set<() => void>();
export function fijarAsignacionDirecto(id: string, asignacion: AsignacionModelos | null): void {
  if (!asignacion || asignaciones.get(id) === asignacion) return;
  asignaciones.set(id, asignacion);
  for (const oyente of oyentes) oyente();
}
export function asignacionDirecto(id: string): AsignacionModelos | null { return asignaciones.get(id) ?? null; }
export function suscribirAsignacionDirecto(oyente: () => void): () => void { oyentes.add(oyente); return () => { oyentes.delete(oyente); }; }

/** § 3.1 · La narración se activa sola si se cumplen las tres condiciones: preferencia no desactivada, sesión
 * iniciada por este espectador en esta página (con la casilla marcada) y voz disponible en /herramientas. */
export function narracionAutomatica(sesion: string, vozDisponible: boolean): boolean {
  return vozDisponible && arranquePropio(sesion) && leerPreferenciaNarracion();
}

function almacen(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage ?? null; } catch { return null; }
}

/** Preferencia del espectador: "1" ⇒ true, "0" ⇒ false; ausente o ilegible ⇒ NARRACION_DIRECTO.porDefecto. */
export function leerPreferenciaNarracion(): boolean {
  try {
    const valor = almacen()?.getItem(NARRACION_DIRECTO.clavePreferencia);
    return valor === "1" ? true : valor === "0" ? false : NARRACION_DIRECTO.porDefecto;
  } catch { return NARRACION_DIRECTO.porDefecto; }
}

/** Solo los gestos del usuario la escriben (casilla, «Activar narración», «Desactivar narración»). */
export function guardarPreferenciaNarracion(v: boolean): void {
  try { almacen()?.setItem(NARRACION_DIRECTO.clavePreferencia, v ? "1" : "0"); } catch { /* Almacenamiento bloqueado: la elección dura esta página. */ }
}
