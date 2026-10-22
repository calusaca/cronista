// Brief 050 · Ronda 3 (2 clips): la forma elegida, dos tramos de prosodia dentro de un solo <s>
// (cada frontera de elemento o de oración cuesta ≈ 0,9–1,4 s de silencio en las rondas 1 y 2).
// Ejecutar desde la raíz: node --import tsx docs/evidencia/canto-gol-050/experimento-ronda3.mts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sintetizarVoz, type prepararVoz } from "../../../src/arena/voz.ts";

for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
const DIR = "docs/evidencia/canto-gol-050";
const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
type Tramo = { texto: string; rate: string; pitch: string; volume: string; grado: number; estilo: string };
const unaOracion = (voz: string, lang: string, tramos: Tramo[], pausaMs: number) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voz}"><s>${tramos.map(t => `<mstts:express-as style="${t.estilo}" styledegree="${t.grado.toFixed(2)}"><prosody rate="${t.rate}" pitch="${t.pitch}" volume="${t.volume}">${esc(t.texto)}</prosody></mstts:express-as>`).join("")}<break time="${pausaMs}ms"/></s></voice></speak>`;
const J = "Mateo Ferrán", EQ = "Sporting Montefrío Bajo", S = 23;
const candidatos = [
  { id: "11-forma-elegida", idioma: "es" as const, voz: "es-MX-JorgeNeural", descripcion: "Forma elegida: grito con el goleador (cheerful 2, rate −20 %, pitch +16 %, vol +30 %) y hechos (cheerful 1,3, rate +6 %, pitch +6 %, vol +10 %) en un solo <s>, pausa final 380 ms", tramos: [
    { texto: `¡Gooool de ${J}!`, rate: "-20%", pitch: "+16%", volume: "+30%", grado: 2, estilo: "cheerful" },
    { texto: `${EQ} se adelanta, uno a cero, a los ${S} segundos.`, rate: "+6%", pitch: "+6%", volume: "+10%", grado: 1.3, estilo: "cheerful" },
  ] },
  { id: "11-forma-elegida", idioma: "en" as const, voz: "en-US-JennyNeural", descripcion: "Forma elegida: grito con el goleador (shouting 2, rate −20 %, pitch +16 %, vol +30 %) y hechos (excited 1,3, rate +6 %, pitch +6 %, vol +10 %) en un solo <s>, pausa final 380 ms", tramos: [
    { texto: `Goooal by ${J}!`, rate: "-20%", pitch: "+16%", volume: "+30%", grado: 2, estilo: "shouting" },
    { texto: `${EQ} take the lead, one–nil, after ${S} seconds.`, rate: "+6%", pitch: "+6%", volume: "+10%", grado: 1.3, estilo: "excited" },
  ] },
];
const indice = JSON.parse(readFileSync(join(DIR, "indice.json"), "utf8")) as { candidatos: Record<string, unknown>[]; solicitudes: number; caracteresSsml: number };
for (const c of candidatos) {
  const ssml = unaOracion(c.voz, c.idioma === "es" ? "es-MX" : "en-US", c.tramos, 380), texto = c.tramos.map(t => t.texto).join(" ");
  const preparada = { texto, ssml, voz: c.voz, idioma: c.idioma, version: "experimento-050", caracteresPresupuestados: ssml.length };
  const audio = await sintetizarVoz(preparada as unknown as ReturnType<typeof prepararVoz>, 230);
  const archivo = `${c.idioma}-${c.id}.mp3`;
  writeFileSync(join(DIR, archivo), Buffer.from(audio.base64, "base64"));
  indice.candidatos.push({ id: c.id, idioma: c.idioma, voz: c.voz, descripcion: c.descripcion, texto, caracteresTexto: texto.length, caracteresSsml: ssml.length, bytes: Buffer.byteLength(audio.base64, "base64"), archivo, ssml });
  indice.solicitudes += 1; indice.caracteresSsml += ssml.length;
  console.log(archivo, Buffer.byteLength(audio.base64, "base64"), "B");
}
writeFileSync(join(DIR, "indice.json"), JSON.stringify(indice, null, 2) + "\n");
console.log(JSON.stringify({ solicitudes: indice.solicitudes, caracteresSsml: indice.caracteresSsml }));
