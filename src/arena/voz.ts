import type { ComentarioArena } from "./narrador";
import { credencialAzure, endpointAzure } from "../lib/azure";
import { trazar } from "../lib/telemetria";
import { createHash } from "node:crypto";
import type { FragmentoVoz } from "./expresion";
import type { RegistroArena } from "./tipos";

export const VERSION_VOZ = "voz-expresiva-v1";
const formato = "audio-24khz-48kbitrate-mono-mp3";
// Intersección comprobada con /voices/list del recurso real; estilos publicados
// en la documentación general pueden no estar disponibles en esta región.
const estilosAdmitidos: Record<string, readonly string[]> = {
  "es-MX-JorgeNeural": ["chat", "cheerful"], "es-MX-DaliaNeural": [],
  "en-US-JennyNeural": ["excited", "sad"], "en-US-GuyNeural": ["excited", "sad"],
};
type Idioma = "es" | "en";
type OpcionesVoz = { signal?: AbortSignal; fetch?: typeof fetch };

const escapar = (texto: string) => texto.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
function vozConfigurada(idioma: Idioma) {
  const voz = idioma === "es" ? process.env.ARENA_VOZ_ES ?? "es-MX-JorgeNeural" : process.env.ARENA_VOZ_EN ?? "en-US-JennyNeural";
  const permitidas = idioma === "es" ? ["es-MX-JorgeNeural", "es-MX-DaliaNeural"] : ["en-US-JennyNeural", "en-US-GuyNeural"];
  if (!permitidas.includes(voz)) throw new Error("Voz expresiva no admitida");
  return voz;
}

/** Un documento por tramo: varias interpretaciones sin multiplicar solicitudes. */
export function prepararVoz(fragmentos: readonly FragmentoVoz[], idioma: Idioma) {
  const texto = fragmentos.map(f => f.texto).join(" ");
  if (!texto || texto.length > 6000 || fragmentos.length > 100) throw new Error("Texto de voz fuera de presupuesto");
  const voz = vozConfigurada(idioma);
  const contenido = fragmentos.map(f => {
    if (!f.texto || !Number.isFinite(f.intensidad) || f.intensidad < 0 || f.intensidad > 1 || !Number.isInteger(f.variante) || f.variante < 0 || f.variante > 3) throw new Error("Interpretación de voz inválida");
    const variacion = [-1, 0, 1, 2][f.variante]!;
    const activa = ["tension", "emocion", "sorpresa", "jubilo"].includes(f.emocion);
    const ritmo = (activa ? 4 + f.intensidad * 9 : f.emocion === "decepcion" ? -6 : 0) + variacion;
    const tono = (activa ? 1 + f.intensidad * 6 : f.emocion === "decepcion" ? -3 : 0) + variacion * 0.5;
    const volumen = activa ? 4 + f.intensidad * 10 : 0;
    let estilo = activa ? "excited" : f.emocion === "decepcion" ? "sad" : undefined;
    if (voz === "es-MX-JorgeNeural" && activa) estilo = "cheerful";
    if (estilo && !estilosAdmitidos[voz]!.includes(estilo)) estilo = undefined;
    const grado = (f.emocion === "jubilo" ? 1.1 + f.intensidad * 0.7 : 0.5 + f.intensidad * 0.8) + variacion * 0.025;
    const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
    const prosodia = `<prosody rate="${signed(ritmo)}" pitch="${signed(tono)}" volume="${signed(volumen)}">${escapar(f.texto)}</prosody>`;
    const frase = estilo ? `<mstts:express-as style="${estilo}" styledegree="${grado.toFixed(2)}">${prosodia}</mstts:express-as>` : prosodia;
    const pausa = f.emocion === "jubilo" ? 380 : f.emocion === "sorpresa" ? 160 : f.emocion === "tension" ? 65 : 110 + f.variante * 15;
    return `<s>${frase}<break time="${pausa}ms"/></s>`;
  }).join("");
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${idioma === "es" ? "es-MX" : "en-US"}"><voice name="${voz}">${contenido}</voice></speak>`;
  if (ssml.length > 24_000) throw new Error("Interpretación de voz fuera de presupuesto");
  // Reserva conservadora: incluye todas las marcas, además del texto hablado.
  return { texto, ssml, voz, idioma, version: VERSION_VOZ, caracteresPresupuestados: ssml.length };
}

export function claveAudio(preparada: ReturnType<typeof prepararVoz>, tick: number) {
  return "audio:" + createHash("sha256").update(JSON.stringify({ version: preparada.version, voz: preparada.voz, idioma: preparada.idioma, formato, tick, ssml: preparada.ssml })).digest("hex");
}

export function ssmlComentario(comentario: ComentarioArena, idioma: Idioma, registro?: RegistroArena) {
  const fragmentos: FragmentoVoz[] = comentario.oraciones.map((o, i) => {
    const h = comentario.hechos.find(h => h.id === o.hecho);
    const eventos = registro?.eventos.filter(e => e.tick <= comentario.tick && h?.eventos.includes(e.id));
    const gol = h?.tipo === "gol_anotado", atajada = eventos?.some(e => e.tipo === "atajada"), tiro = eventos?.some(e => e.tipo === "tiro");
    return { tick: comentario.tick, texto: idioma === "es" ? o.texto_es : o.texto_en, emocion: gol ? "jubilo" : atajada ? "sorpresa" : tiro ? "emocion" : "serena", intensidad: gol ? 0.92 : atajada || tiro ? 0.8 : 0.18, variante: i % 4, fuentes: h?.eventos ?? [], fotogramas: [] };
  });
  if (fragmentos.map(f => f.texto).join(" ").length > 1200) throw new Error("Comentario demasiado largo para voz");
  return prepararVoz(fragmentos, idioma);
}
export async function sintetizarComentario(comentario: ComentarioArena, idioma: Idioma, opciones: OpcionesVoz = {}) {
  return sintetizarVoz(ssmlComentario(comentario, idioma), comentario.tick, opciones);
}
export async function sintetizarTexto(texto: string, idioma: Idioma, tick: number, opciones: OpcionesVoz = {}) {
  return sintetizarVoz(prepararVoz([{ tick, texto, emocion: "serena", intensidad: 0.18, variante: 0, fuentes: [], fotogramas: [] }], idioma), tick, opciones);
}
export async function sintetizarVoz(preparada: ReturnType<typeof prepararVoz>, tick: number, opciones: OpcionesVoz = {}) {
  const { texto, ssml, idioma } = preparada;
  const endpoint = endpointAzure(process.env.AZURE_SPEECH_ENDPOINT, ".cognitiveservices.azure.com");
  const signal = AbortSignal.any([AbortSignal.timeout(15_000), ...(opciones.signal ? [opciones.signal] : [])]);
  const clave = process.env.AZURE_SPEECH_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  const authorization = !clave && process.env.AZURE_SPEECH_RESOURCE_ID ? `Bearer aad#${process.env.AZURE_SPEECH_RESOURCE_ID}#${(await credencialAzure().getToken("https://cognitiveservices.azure.com/.default")).token}` : null;
  if (!clave && !authorization) throw new Error("Speech sin credenciales");
  return trazar("arena.voz", { "arena.tick": tick, "arena.idioma": idioma, "speech.caracteres": texto.length, "speech.presupuesto_caracteres": preparada.caracteresPresupuestados, "speech.voz": preparada.voz, "speech.version": VERSION_VOZ }, async () => {
    const r = await (opciones.fetch ?? fetch)(`${endpoint}/tts/cognitiveservices/v1`, { method: "POST", signal, headers: { "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": formato, "user-agent": "CRONISTA", ...(clave ? { "Ocp-Apim-Subscription-Key": clave } : { Authorization: authorization! }) }, body: ssml });
    if (!r.ok || !r.body) throw new Error(`Speech HTTP ${r.status}`);
    const lector = r.body.getReader(), partes: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const { done, value } = await lector.read(); if (done) break; bytes += value.length; if (bytes > 512_000) { await lector.cancel(); throw new Error("Audio demasiado grande"); } partes.push(value); } }
    finally { lector.releaseLock(); }
    if (!bytes) throw new Error("Speech devolvió audio vacío");
    return { base64: Buffer.concat(partes).toString("base64"), tipo: "audio/mpeg", tick, idioma, caracteres: texto.length, caracteresPresupuestados: preparada.caracteresPresupuestados, voz: preparada.voz, version: VERSION_VOZ };
  });
}
