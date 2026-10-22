/** Nota del 22 oct (043) · Catálogo de reservas de voz servido como archivos estáticos (no incrustado
 * en el paquete del navegador). Lo genera scripts/sintetizar-reservas.mjs con la voz del narrador. */
export const RUTA_RESERVAS = "/voz-reserva";
export const ARCHIVO_INDICE_RESERVAS = "indice.json";

export interface ClipReserva { archivo: string; texto: string; bytes: number; sha256: string }
export interface IndiceReservas {
  version: 1; formato: "audio/mpeg";
  voces: Record<"es" | "en", string>;
  es: { reservas: ClipReserva[]; cierre: ClipReserva };
  en: { reservas: ClipReserva[]; cierre: ClipReserva };
}
/** Entrada lista para descargar: `orden` es su posición en el catálogo (el cierre va al final). */
export interface EntradaReserva { archivo: string; texto: string; cierre: boolean; orden: number }

const archivoValido = (idioma: "es" | "en", archivo: unknown): archivo is string =>
  typeof archivo === "string" && new RegExp(`^${idioma}/[a-z0-9-]{1,40}\\.mp3$`).test(archivo);
const clipValido = (idioma: "es" | "en", c: unknown): c is ClipReserva => {
  const x = c as Partial<ClipReserva> | null;
  return !!x && archivoValido(idioma, x.archivo) && typeof x.texto === "string" && x.texto.trim().length > 0 && x.texto.length <= 300;
};

/** Valida el índice recibido y devuelve las entradas de un idioma. Un índice malformado lanza error;
 * una ruta fuera de `idioma/NN.mp3` o un texto repetido invalidan el índice entero. */
export function leerIndiceReservas(json: unknown, idioma: "es" | "en"): { reservas: EntradaReserva[]; cierre: EntradaReserva } {
  const parte = (json as Partial<IndiceReservas> | null)?.[idioma];
  if ((json as Partial<IndiceReservas> | null)?.version !== 1 || !parte || !Array.isArray(parte.reservas) || !parte.reservas.length || !clipValido(idioma, parte.cierre) || !parte.reservas.every(c => clipValido(idioma, c)))
    throw new Error("Índice de reservas inválido");
  const reservas = parte.reservas.map((c, orden) => ({ archivo: c.archivo, texto: c.texto, cierre: false, orden }));
  const cierre = { archivo: parte.cierre.archivo, texto: parte.cierre.texto, cierre: true, orden: reservas.length };
  const textos = [...reservas, cierre].map(r => r.texto), archivos = [...reservas, cierre].map(r => r.archivo);
  if (new Set(textos).size !== textos.length || new Set(archivos).size !== archivos.length) throw new Error("Índice de reservas inválido");
  return { reservas, cierre };
}
