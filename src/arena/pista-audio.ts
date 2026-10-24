/** Tope de bytes PCM de una pista (más 44 de cabecera). Brief 053: compartido con ArenaNarracion. */
export const PISTA_MAX_PCM_BYTES = 60_000_000;
/** WAV PCM mono: une audio ya decodificado sin cabeceras MP3 intermedias. */
export function wavMono(fragmentos: readonly Float32Array[], sampleRate: number): Blob {
  const muestras = fragmentos.reduce((n, f) => n + f.length, 0);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000 || !muestras || muestras * 2 > PISTA_MAX_PCM_BYTES) throw new Error("Pista fuera de presupuesto");
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
/** Brief 057 v1.1 § 6 · Inversa de `instanteNarrado` para buscar en la pista desde el cursor: `tick ≤ 0` → 0
 * (inicio del audio, previa incluida: la única búsqueda que puede aterrizar fuera del narrador); si no, el
 * tramo del narrador (ancho > 0 en ticks) con `desdeTick ≤ tick < hastaTick`, o el último con progreso 1 si
 * `tick` lo rebasa; posición lineal acotada a `[inicioS, finS − 0,001]`, nunca `finS` (en una frontera
 * compartida `instanteNarrado` elegiría el tramo siguiente, que puede ser una intervención de ancho cero). */
export function instanteAudio(tramos: readonly TramoTemporal[], tick: number): number {
  if (!Number.isFinite(tick)) throw new Error("Cursor inválido");
  const narrador = tramos.filter(t => t.hastaTick > t.desdeTick);
  if (tick <= 0 || !narrador.length) return 0;
  const ultimo = narrador[narrador.length - 1]!;
  const t = tick >= ultimo.hastaTick ? ultimo : narrador.find(x => x.desdeTick <= tick && tick < x.hastaTick) ?? narrador.find(x => x.hastaTick > tick) ?? ultimo;
  const progreso = Math.max(0, Math.min(1, (tick - t.desdeTick) / (t.hastaTick - t.desdeTick)));
  return Math.max(t.inicioS, Math.min(t.finS - 0.001, t.inicioS + progreso * (t.finS - t.inicioS)));
}
/** Brief 060 § 3.3 · Ensamblado de la pista al ritmo: por cada clip, ceros hasta `round(inicioS·sr)` (si el redondeo
 * solapara con el clip anterior, se empieza en la longitud actual) y después sus muestras; al final, ceros hasta
 * `round(duracionS·sr)`. Devuelve los fragmentos para `wavMono`; nunca recorta ni mezcla dos clips. */
export function ensamblarPista(clips: readonly { inicioS: number; muestras: Float32Array }[], duracionS: number, sampleRate: number): Float32Array[] {
  if (!Number.isFinite(duracionS) || duracionS < 0 || clips.some(c => !Number.isFinite(c.inicioS) || c.inicioS < 0)) throw new Error("Pista inválida");
  const fragmentos: Float32Array[] = [];
  let longitud = 0;
  for (const c of [...clips].sort((a, b) => a.inicioS - b.inicioS)) {
    const desplazamiento = Math.max(longitud, Math.round(c.inicioS * sampleRate));
    if (desplazamiento > longitud) fragmentos.push(new Float32Array(desplazamiento - longitud));
    fragmentos.push(c.muestras); longitud = desplazamiento + c.muestras.length;
  }
  const total = Math.round(duracionS * sampleRate);
  if (total > longitud) fragmentos.push(new Float32Array(total - longitud));
  return fragmentos;
}
