// Brief 050 · Ronda 4 (6 clips), tras la revisión de Codex (hallazgos 8 y 10):
//  - cota real de duración: la combinación más larga de plantillas con los nombres más largos (ES y EN);
//  - volumen del primer segundo en español: variantes de la forma elegida (rate −10 %, volume x-loud,
//    pitch +8 %, grito separado en tres tramos dentro de un solo <s>).
// Ejecutar desde la raíz: node --import tsx docs/evidencia/canto-gol-050/experimento-ronda4.mts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sintetizarVoz, type prepararVoz } from "../../../src/arena/voz.ts";

for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
const DIR = "docs/evidencia/canto-gol-050";
const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
type Tramo = { texto: string; rate: string; pitch: string; volume: string; grado: number; estilo: string };
const unaOracion = (voz: string, lang: string, tramos: Tramo[], pausaMs = 380) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voz}"><s>${tramos.map(t => `<mstts:express-as style="${t.estilo}" styledegree="${t.grado.toFixed(2)}"><prosody rate="${t.rate}" pitch="${t.pitch}" volume="${t.volume}">${esc(t.texto)}</prosody></mstts:express-as>`).join("")}<break time="${pausaMs}ms"/></s></voice></speak>`;
const G = { rate: "-20%", pitch: "+16%", volume: "+30%", grado: 2 }, H = { rate: "+6%", pitch: "+6%", volume: "+10%", grado: 1.3 };
// Nombres más largos del generador de la arena (24 y 26 caracteres, por encima de los fixtures: 16 y 23).
const JL = "Maximiliano Torrealba Ríos", EQL = "Atlético Montefrío Bajo Sur";
const candidatos: { id: string; idioma: "es" | "en"; voz: string; descripcion: string; tramos: Tramo[] }[] = [
  { id: "12-cota-larga", idioma: "es", voz: "es-MX-JorgeNeural", descripcion: "Cota de duración: variante 1 del grito, «sobre el final», goleada, marcador en cifras, nombres de 26/27 caracteres", tramos: [
    { texto: `¡Gol, gol, gooool de ${JL}!`, ...G, estilo: "cheerful" },
    { texto: `Sobre el final, goleada de ${EQL}, 10 a 7, a los 179 segundos.`, ...H, estilo: "cheerful" } ] },
  { id: "12-cota-larga", idioma: "en", voz: "en-US-JennyNeural", descripcion: "Duration bound: cry variant 1, late on, rout, numeric score, 26/27-character names", tramos: [
    { texto: `Goal, goal, goooal by ${JL}!`, ...G, estilo: "shouting" },
    { texto: `Late on, it's a rout for ${EQL}, 10–7, after 179 seconds.`, ...H, estilo: "excited" } ] },
  { id: "13-forma-elegida-rate-10", idioma: "es", voz: "es-MX-JorgeNeural", descripcion: "Forma elegida con el grito a rate −10 %", tramos: [
    { texto: "¡Gooool de Mateo Ferrán!", ...G, rate: "-10%", estilo: "cheerful" },
    { texto: "Sporting Montefrío Bajo se adelanta, uno a cero, a los 23 segundos.", ...H, estilo: "cheerful" } ] },
  { id: "14-forma-elegida-xloud", idioma: "es", voz: "es-MX-JorgeNeural", descripcion: "Forma elegida con volume=x-loud en el grito", tramos: [
    { texto: "¡Gooool de Mateo Ferrán!", ...G, volume: "x-loud", estilo: "cheerful" },
    { texto: "Sporting Montefrío Bajo se adelanta, uno a cero, a los 23 segundos.", ...H, estilo: "cheerful" } ] },
  { id: "15-forma-elegida-pitch-8", idioma: "es", voz: "es-MX-JorgeNeural", descripcion: "Forma elegida con pitch +8 % en el grito", tramos: [
    { texto: "¡Gooool de Mateo Ferrán!", ...G, pitch: "+8%", estilo: "cheerful" },
    { texto: "Sporting Montefrío Bajo se adelanta, uno a cero, a los 23 segundos.", ...H, estilo: "cheerful" } ] },
  { id: "16-grito-separado-un-s", idioma: "es", voz: "es-MX-JorgeNeural", descripcion: "Tres tramos en un solo <s>: «¡Gooool!» (rate −30 %), «¡Gol de Mateo Ferrán!» y los hechos", tramos: [
    { texto: "¡Gooool!", ...G, rate: "-30%", estilo: "cheerful" },
    { texto: "¡Gol de Mateo Ferrán!", rate: "+10%", pitch: "+12%", volume: "+22%", grado: 1.8, estilo: "cheerful" },
    { texto: "Sporting Montefrío Bajo se adelanta, uno a cero, a los 23 segundos.", ...H, estilo: "cheerful" } ] },
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
  console.log(archivo, texto.length, "c", Buffer.byteLength(audio.base64, "base64"), "B");
}
writeFileSync(join(DIR, "indice.json"), JSON.stringify(indice, null, 2) + "\n");
console.log(JSON.stringify({ solicitudes: indice.solicitudes, caracteresSsml: indice.caracteresSsml }));
