/** Plazo efectivo incluso si el transporte no atiende AbortSignal. */
export async function conCancelacion<T>(tarea: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted(); let cancelar!: () => void;
  const cancelada = new Promise<never>((_, reject) => { cancelar = () => reject(new DOMException("Cancelado o plazo agotado", "AbortError")); signal.addEventListener("abort", cancelar, { once: true }); });
  try { return await Promise.race([tarea(), cancelada]); }
  finally { signal.removeEventListener("abort", cancelar); }
}
