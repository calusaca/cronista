// Brief 066 · B · Textos ES/EN del aviso al volver al directo (los leen la emisión y sus pruebas).
const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const TEXTOS_RETOMAR = {
  en: {
    continuar: "Continue match",
    /** Rótulo del botón grande sobre la cancha, con el minuto en el que se quedó. */
    boton: (segundo: number) => `Continue match · ${reloj(segundo)}`,
    nota: "The broadcast paused while you were away.",
    noDisponible: "This match is no longer available",
  },
  es: {
    continuar: "Continuar partido",
    boton: (segundo: number) => `Continuar partido · ${reloj(segundo)}`,
    nota: "La emisión se pausó mientras no estabas.",
    noDisponible: "Este partido ya no está disponible",
  },
} as const;
