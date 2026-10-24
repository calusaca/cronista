// Brief 057 · Reproducir con narración: contrato entre `Arena` y `ArenaNarracion` (§ 3.2) y las funciones
// puras que deciden el dueño del reloj (v1.1 § 1) y la intención de inicio pendiente (v1.1 § 2). Sin estado.

export type FaseNarracion = "inactiva" | "registrando" | "preparando" | "sonando" | "pausada" | "pulsar" | "final" | "error";
/** v1.3 (1) · `ocupado`: cupo de subidas agotado (429 con retry-after mayor que reintentoMaxS); `minutos` dice cuándo vuelve. */
export type MotivoNarracion = "sin-voz" | "sin-sesion" | "red" | "presupuesto" | "caducada" | "ocupado";
/** Brief 060 § 3.4–3.5 · `previa`: la pista al ritmo suena o está en pausa antes de `plan.inicioJuegoS`; `espera`: la
 * cancha está detenida por un invitado de la Mesa o para cantar una jugada clave (rótulo arena-replay-hold). */
export interface EstadoNarracion { fase: FaseNarracion; listos: number; total: number; motivo?: MotivoNarracion; minutos?: number; vozDisponible: boolean; previa: boolean; espera: "invitado" | "clave" | null }
/** v1.3 (3) · `iniciar(desdeTick)`: la pista empieza en el instante del cursor (`instanteAudio`); sin tick, en 0. */
export interface ControlesNarracion { iniciar(desdeTick?: number): void; pausar(): void; reanudar(): void; buscar(tick: number): void; detener(): void; /** Brief 060 § 3.4 · Salta la previa de la pista al ritmo (audio en `plan.inicioJuegoS`). */ saltarPrevia(): void }

/** v1.1 § 1 · Fases en que la pista (o su preparación) es dueña del reloj: la cancha muda no corre. */
export const faseActiva = (fase: FaseNarracion): boolean => fase === "registrando" || fase === "preparando" || fase === "sonando" || fase === "pausada" || fase === "pulsar";
/** Fases con pista lista: el audio es el reloj (buscar, pausar, volver al inicio). */
export const fasePista = (fase: FaseNarracion): boolean => fase === "sonando" || fase === "pausada" || fase === "pulsar";
/** Fases de espera de la pista (registro o preparación de tramos). */
export const faseEspera = (fase: FaseNarracion): boolean => fase === "registrando" || fase === "preparando";

/** Quién mueve el cursor: la reproducción muda de la cancha, la pista narrada o nadie. */
export type DuenoReloj = "mudo" | "voz" | null;
/** Lo que ocurre: el botón principal (con el conmutador «Con narración» marcado o no), el conmutador que se
 * desmarca, la pista que pasa a una fase activa (también desde «Escuchar desde el inicio»), un fallo de la
 * narración y su final o detención. */
export type AccionReloj = { tipo: "pulsar"; conVoz: boolean } | { tipo: "conmutador-off" } | { tipo: "pista-activa" } | { tipo: "fallo" } | { tipo: "fin" };
export type OrdenNarracion = keyof ControlesNarracion | null;
export interface TransicionReloj { dueno: DuenoReloj; reproduciendo: boolean; orden: Exclude<OrdenNarracion, "buscar" | "saltarPrevia"> }

/** v1.1 § 1 · Exclusión del reloj, decidida ANTES de registrar, preparar o reproducir: `reproduciendo` es la
 * cancha muda y nunca coincide con una orden que activa la pista; la muda solo arranca con la pista en
 * inactiva, final o error (si no, primero `detener`). Tabla de § 3.1 más «conmutador off» y «pista activa». */
export function transicionReloj(dueno: DuenoReloj, accion: AccionReloj, fase: FaseNarracion): TransicionReloj {
  const igual: TransicionReloj = { dueno, reproduciendo: dueno === "mudo", orden: null };
  switch (accion.tipo) {
    case "pulsar":
      if (dueno === "mudo") return { dueno: null, reproduciendo: false, orden: null };
      if (faseEspera(fase)) return { dueno: "mudo", reproduciendo: true, orden: "detener" };
      if (fase === "sonando") return { dueno: "voz", reproduciendo: false, orden: "pausar" };
      if (fase === "pausada" || fase === "pulsar") return { dueno: "voz", reproduciendo: false, orden: "reanudar" };
      return accion.conVoz ? { dueno: "voz", reproduciendo: false, orden: "iniciar" } : { dueno: "mudo", reproduciendo: true, orden: null };
    case "conmutador-off":
      // Cambió un ajuste, no pulsó Reproducir: la pista se detiene y la cancha no arranca.
      return faseActiva(fase) ? { dueno: null, reproduciendo: false, orden: "detener" } : igual;
    case "pista-activa":
      return { dueno: "voz", reproduciendo: false, orden: null };
    case "fallo":
      // Degradación a reproducción muda solo si la voz era la dueña (nadie la canceló).
      return dueno === "voz" ? { dueno: "mudo", reproduciendo: true, orden: null } : igual;
    case "fin":
      return dueno === "voz" ? { dueno: null, reproduciendo: false, orden: null } : igual;
  }
}

/** v1.1 § 2 · Intención de inicio pendiente mientras se registra la grabación: solo se consume si la carga y el
 * idioma siguen siendo los del momento en que se pidió; si no, se descarta (nunca arranca sola). */
export interface IntencionInicio { carga: number; idioma: "es" | "en" }
export function consumirIntencion(pendiente: IntencionInicio | null, carga: number, idioma: "es" | "en"): IntencionInicio | null {
  return pendiente && pendiente.carga === carga && pendiente.idioma === idioma ? pendiente : null;
}

/** v1.3 (1) · Respuesta 429 de la subida: un reintento solo si retry-after ≤ máximo (s); si no, `ocupado` con los
 * minutos redondeados hacia arriba (al menos 1). Sin retry-after legible cuenta como 0 s (reintento corto). */
export function decisionReintento429(retryAfter: string | null, maximoS: number, yaReintentado: boolean): { reintentar: true; esperaS: number } | { reintentar: false; minutos: number } {
  const n = Number(retryAfter), segundos = retryAfter !== null && Number.isFinite(n) && n >= 0 ? n : 0;
  return !yaReintentado && segundos <= maximoS ? { reintentar: true, esperaS: segundos } : { reintentar: false, minutos: Math.max(1, Math.ceil(segundos / 60)) };
}

/** v1.1 § 8 · Motivo por la respuesta de `relato` (el 404 llega aquí tras el único re-registro). */
export function motivoRelato(status: number): MotivoNarracion {
  if (status === 404) return "caducada";
  if (status === 429) return "presupuesto";
  if (status === 503) return "sin-voz";
  return "red";
}
