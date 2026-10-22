// Brief 050 · Ronda 5 (2 clips): cota de duración de la forma de tres tramos en un solo <s> (v1.1),
// con la variante más larga del goleador, «sobre el final», goleada, marcador en cifras y nombres largos.
// Ejecutar desde la raíz: node --import tsx docs/evidencia/canto-gol-050/experimento-ronda5.mts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sintetizarVoz, type prepararVoz } from "../../../src/arena/voz.ts";

for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
const DIR = "docs/evidencia/canto-gol-050";
const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
type Tramo = { texto: string; rate: string; pitch: string; volume: string; grado: number; estilo: string };
const unaOracion = (voz: string, lang: string, tramos: Tramo[], pausaMs = 380) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voz}"><s>${tramos.map(t => `<mstts:express-as style="${t.estilo}" styledegree="${t.grado.toFixed(2)}"><prosody rate="${t.rate}" pitch="${t.pitch}" volume="${t.volume}">${esc(t.texto)}</prosody></mstts:express-as>`).join("")}<break time="${pausaMs}ms"/></s></voice></speak>`;
const G = { rate: "-30%", pitch: "+16%", volume: "+30%", grado: 2 }, N = { rate: "+10%", pitch: "+12%", volume: "+22%", grado: 1.8 }, H = { rate: "+6%", pitch: "+6%", volume: "+10%", grado: 1.3 };
const JL = "Maximiliano Torrealba Ríos", EQL = "Atlético Montefrío Bajo Sur";
const candidatos = [
  { id: "17-cota-larga-tres-tramos", idioma: "es" as const, voz: "es-MX-JorgeNeural", descripcion: "v1.1 · cota de duración con tres tramos en un <s>: grito, goleador (variante larga) y hechos (sobre el final, goleada, cifras, nombres de 26/27 c)", tramos: [
    { texto: "¡Gol, gol, gooool!", ...G, estilo: "cheerful" }, { texto: `¡Gol, gol de ${JL}!`, ...N, estilo: "cheerful" }, { texto: `Sobre el final, goleada de ${EQL}, 10 a 7, a los 179 segundos.`, ...H, estilo: "cheerful" } ] },
  { id: "17-cota-larga-tres-tramos", idioma: "en" as const, voz: "en-US-JennyNeural", descripcion: "v1.1 · duration bound with three spans in one <s>: cry (shouting), scorer (long variant) and facts", tramos: [
    { texto: "Goal, goal, goooal!", ...G, estilo: "shouting" }, { texto: `Goal, goal by ${JL}!`, ...N, estilo: "excited" }, { texto: `Late on, it's a rout for ${EQL}, 10–7, after 179 seconds.`, ...H, estilo: "excited" } ] },
];
const indice = JSON.parse(readFileSync(join(DIR, "indice.json"), "utf8")) as { candidatos: Record<string, unknown>[]; solicitudes: number; caracteresSsml: number };
for (const c of candidatos) {
  const ssml = unaOracion(c.voz, c.idioma === "es" ? "es-MX" : "en-US", c.tramos), texto = c.tramos.map(t => t.texto).join(" ");
  const preparada = { texto, ssml, voz: c.voz, idioma: c.idioma, version: "experimento-050", caracteresPresupuestados: ssml.length };
  const audio = await sintetizarVoz(preparada as unknown as ReturnType<typeof prepararVoz>, 230);
  const archivo = `${c.idioma}-${c.id}.mp3`;
  writeFileSync(join(DIR, archivo), Buffer.from(audio.base64, "base64"));
  indice.candidatos.push({ id: c.id, idioma: c.idioma, voz: c.voz, descripcion: c.descripcion, texto, caracteresTexto: texto.length, caracteresSsml: ssml.length, bytes: Buffer.byteLength(audio.base64, "base64"), archivo, ssml });
  indice.solicitudes += 1; indice.caracteresSsml += ssml.length;
  console.log(archivo, texto.length, "c", ssml.length, "ssml", Buffer.byteLength(audio.base64, "base64"), "B");
}
writeFileSync(join(DIR, "indice.json"), JSON.stringify(indice, null, 2) + "\n");
console.log(JSON.stringify({ solicitudes: indice.solicitudes, caracteresSsml: indice.caracteresSsml }));
