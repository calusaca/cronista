/** WAV PCM mono: une audio ya decodificado sin cabeceras MP3 intermedias. */
export function wavMono(fragmentos: readonly Float32Array[], sampleRate: number): Blob {
  const muestras = fragmentos.reduce((n, f) => n + f.length, 0);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000 || !muestras || muestras * 2 > 60_000_000) throw new Error("Pista fuera de presupuesto");
  const bytes = new ArrayBuffer(44 + muestras * 2), vista = new DataView(bytes);
  const texto = (pos: number, valor: string) => { for (let i = 0; i < valor.length; i++) vista.setUint8(pos + i, valor.charCodeAt(i)); };
  texto(0, "RIFF"); vista.setUint32(4, 36 + muestras * 2, true); texto(8, "WAVE"); texto(12, "fmt ");
  vista.setUint32(16, 16, true); vista.setUint16(20, 1, true); vista.setUint16(22, 1, true);
  vista.setUint32(24, sampleRate, true); vista.setUint32(28, sampleRate * 2, true); vista.setUint16(32, 2, true); vista.setUint16(34, 16, true);
  texto(36, "data"); vista.setUint32(40, muestras * 2, true);
  let pos = 44;
  for (const f of fragmentos) for (const muestra of f) {
    if (!Number.isFinite(muestra)) throw new Error("Audio inválido");
    const valor = Math.max(-1, Math.min(1, muestra));
    vista.setInt16(pos, Math.round(valor * (valor < 0 ? 32768 : 32767)), true); pos += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}
export interface TramoTemporal { inicioS: number; finS: number; desdeTick: number; hastaTick: number }
/** Sincronización aproximada por tramo, también al buscar hacia atrás en el audio. */
export function instanteNarrado(tramos: readonly TramoTemporal[], segundos: number): { indice: number; tick: number } {
  if (!tramos.length || !Number.isFinite(segundos)) throw new Error("Reloj de audio inválido");
  const indice = Math.max(0, tramos.findIndex(t => segundos < t.finS));
  const i = segundos >= tramos[tramos.length - 1]!.finS ? tramos.length - 1 : indice;
  const t = tramos[i]!;
  const progreso = Math.max(0, Math.min(1, (segundos - t.inicioS) / (t.finS - t.inicioS)));
  return { indice: i, tick: t.desdeTick + progreso * (t.hastaTick - t.desdeTick) };
}
