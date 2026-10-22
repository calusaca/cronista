// Brief 050 · Ronda 2 (4 clips): estructura compacta sin <s> por segmento (los <s> de la ronda 1
// insertaban ≈ 1 s de silencio cada uno), grito más largo y estilo shouting solo en el grito (EN).
// Ejecutar desde la raíz: node --import tsx docs/evidencia/canto-gol-050/experimento-ronda2.mts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sintetizarVoz, type prepararVoz } from "../../../src/arena/voz.ts";

for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
const DIR = "docs/evidencia/canto-gol-050";
const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
type Seg = { texto: string; rate: string; pitch: string; volume: string; grado: number; pausaMs: number; estilo: string };
const compacto = (voz: string, lang: string, segs: Seg[]) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voz}">${segs.map(s => `<mstts:express-as style="${s.estilo}" styledegree="${s.grado.toFixed(2)}"><prosody rate="${s.rate}" pitch="${s.pitch}" volume="${s.volume}">${esc(s.texto)}</prosody></mstts:express-as><break time="${s.pausaMs}ms"/>`).join("")}</voice></speak>`;
const J = "Mateo Ferrán", EQ = "Sporting Montefrío Bajo", MIN = 23;
const candidatos: { id: string; idioma: "es" | "en"; voz: string; descripcion: string; ssml: string; texto: string }[] = [];
for (const idioma of ["es", "en"] as const) {
  const es = idioma === "es", voz = es ? "es-MX-JorgeNeural" : "en-US-JennyNeural", lang = es ? "es-MX" : "en-US", estilo = es ? "cheerful" : "excited";
  const cola = es ? `${EQ} se adelanta. Minuto ${MIN}: uno a cero.` : `${EQ} take the lead. Minute ${MIN}: one–nil.`;
  const golDe = es ? `¡Gol de ${J}!` : `Goal by ${J}!`;
  const base: Seg[] = [
    { texto: es ? "¡Gooool!" : "Goooal!", rate: "-30%", pitch: "+18%", volume: "+30%", grado: 2, pausaMs: 120, estilo },
    { texto: golDe, rate: "+10%", pitch: "+12%", volume: "+22%", grado: 1.8, pausaMs: 250, estilo },
    { texto: cola, rate: "+4%", pitch: "+4%", volume: "+8%", grado: 1.2, pausaMs: 380, estilo },
  ];
  candidatos.push({ id: "9-compacto", idioma, voz, descripcion: "Tres segmentos sin <s>, pausas 120/250/380 ms, grito «Gooool» a rate −30 %", ssml: compacto(voz, lang, base), texto: base.map(s => s.texto).join(" ") });
  if (es) {
    const largo: Seg[] = [{ ...base[0]!, texto: "¡Goooooool!", rate: "-40%" }, base[1]!, base[2]!];
    candidatos.push({ id: "10-compacto-grito-largo", idioma, voz, descripcion: "Compacto con grito de vocal repetida y rate −40 %", ssml: compacto(voz, lang, largo), texto: largo.map(s => s.texto).join(" ") });
  } else {
    const shout: Seg[] = [{ ...base[0]!, estilo: "shouting" }, base[1]!, base[2]!];
    candidatos.push({ id: "10-compacto-grito-shouting", idioma, voz, descripcion: "Compacto con estilo shouting solo en el grito (Jenny lo admite en el catálogo), excited después", ssml: compacto(voz, lang, shout), texto: shout.map(s => s.texto).join(" ") });
  }
}
const indice = JSON.parse(readFileSync(join(DIR, "indice.json"), "utf8")) as { candidatos: Record<string, unknown>[]; solicitudes: number; caracteresSsml: number };
for (const c of candidatos) {
  const preparada = { texto: c.texto, ssml: c.ssml, voz: c.voz, idioma: c.idioma, version: "experimento-050", caracteresPresupuestados: c.ssml.length };
  const audio = await sintetizarVoz(preparada as unknown as ReturnType<typeof prepararVoz>, 230);
  const archivo = `${c.idioma}-${c.id}.mp3`;
  writeFileSync(join(DIR, archivo), Buffer.from(audio.base64, "base64"));
  indice.candidatos.push({ id: c.id, idioma: c.idioma, voz: c.voz, descripcion: c.descripcion, texto: c.texto, caracteresTexto: c.texto.length, caracteresSsml: c.ssml.length, bytes: Buffer.byteLength(audio.base64, "base64"), archivo, ssml: c.ssml });
  indice.solicitudes += 1; indice.caracteresSsml += c.ssml.length;
  console.log(archivo, Buffer.byteLength(audio.base64, "base64"), "B");
}
writeFileSync(join(DIR, "indice.json"), JSON.stringify(indice, null, 2) + "\n");
console.log(JSON.stringify({ solicitudes: indice.solicitudes, caracteresSsml: indice.caracteresSsml }));
