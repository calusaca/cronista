// Brief 050 · Experimento de «canto de gol» con Azure Speech real.
// Ejecutar desde la raíz: node --import tsx docs/evidencia/canto-gol-050/experimento.mts
// Credenciales: .env y .cache/azure-servicios.env (nunca se imprimen ni se escriben).
// Reutiliza la misma ruta HTTP que src/arena/voz.ts (sintetizarVoz) y el mismo formato
// (audio-24khz-48kbitrate-mono-mp3). Mide duración, pico y RMS con el ffmpeg del venv de video.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { prepararVoz, sintetizarVoz } from "../../../src/arena/voz.ts";

for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
const DIR = "docs/evidencia/canto-gol-050"; mkdirSync(DIR, { recursive: true });
const FFMPEG = execFileSync(".cache/venv-video/bin/python", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();
const endpoint = new URL(process.env.AZURE_SPEECH_ENDPOINT ?? "");
if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".cognitiveservices.azure.com")) throw new Error("Endpoint de Speech inválido");
const clave = process.env.AZURE_SPEECH_KEY ?? process.env.AZURE_OPENAI_API_KEY;
if (!clave) throw new Error("Speech sin credenciales");

// 1. Catálogo real: estilos de las voces del narrador y alternativas con «shouting»/«excited».
const lista = await (await fetch(`${endpoint.href.replace(/\/$/, "")}/tts/cognitiveservices/voices/list`, { headers: { "Ocp-Apim-Subscription-Key": clave, "user-agent": "CRONISTA" } })).json() as { ShortName: string; Locale: string; StyleList?: string[] }[];
const interes = lista.filter(v => ["es-MX", "en-US", "es-ES"].includes(v.Locale) && (v.StyleList?.length || ["es-MX-JorgeNeural", "en-US-JennyNeural"].includes(v.ShortName)));
const catalogo = interes.map(v => ({ voz: v.ShortName, locale: v.Locale, estilos: v.StyleList ?? [] }));
writeFileSync(join(DIR, "catalogo-estilos.json"), JSON.stringify({ consultadoUtc: new Date().toISOString(), region: "la del recurso (no se escribe)", vocesConEstilos: catalogo }, null, 2) + "\n");
const estilos = (voz: string) => new Set(lista.find(v => v.ShortName === voz)?.StyleList ?? []);
console.log("Jorge:", [...estilos("es-MX-JorgeNeural")], "Jenny:", [...estilos("en-US-JennyNeural")], "Davis:", [...estilos("en-US-DavisNeural")], "Guy:", [...estilos("en-US-GuyNeural")]);

const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
type Seg = { texto: string; rate: string; pitch: string; volume: string; grado?: number; pausaMs: number; estilo?: string };
function ssmlDe(voz: string, lang: string, estiloBase: string | undefined, segs: Seg[]) {
  const cuerpo = segs.map(s => {
    const pros = `<prosody rate="${s.rate}" pitch="${s.pitch}" volume="${s.volume}">${esc(s.texto)}</prosody>`;
    const estilo = s.estilo ?? estiloBase;
    const frase = estilo && estilos(voz).has(estilo) ? `<mstts:express-as style="${estilo}" styledegree="${(s.grado ?? 1.5).toFixed(2)}">${pros}</mstts:express-as>` : pros;
    return `<s>${frase}<break time="${s.pausaMs}ms"/></s>`;
  }).join("");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voz}">${cuerpo}</voice></speak>`;
}

// Hechos ficticios del ejemplo (equipos de la semilla 42 del brief 039).
const J = "Mateo Ferrán", EQ = "Sporting Montefrío Bajo", MIN = 23;
const candidatos: { id: string; idioma: "es" | "en"; voz: string; descripcion: string; ssml: string; texto: string }[] = [];
const push = (id: string, idioma: "es" | "en", voz: string, descripcion: string, ssml: string, texto: string) => candidatos.push({ id, idioma, voz, descripcion, ssml, texto });

for (const idioma of ["es", "en"] as const) {
  const es = idioma === "es", voz = es ? "es-MX-JorgeNeural" : "en-US-JennyNeural", lang = es ? "es-MX" : "en-US", estilo = es ? "cheerful" : "excited";
  const cola = es ? `${EQ} se adelanta. Minuto ${MIN}: uno a cero.` : `${EQ} take the lead. Minute ${MIN}: one–nil.`;
  const golDe = es ? `¡Gol de ${J}!` : `Goal by ${J}!`;
  // 1. Control: lo que hoy sintetiza prepararVoz para un gol (jubilo 0,92, variante 0).
  const control = prepararVoz([{ tick: 230, texto: golDe, emocion: "jubilo", intensidad: 0.92, variante: 0, fuentes: [], fotogramas: [] }], idioma);
  push("1-control-actual", idioma, voz, "Etiqueta actual «¡Gol de X!» con la prosodia vigente de prepararVoz (jubilo 0,92)", control.ssml, control.texto);
  // 2. Texto completo (grito + goleador + equipo + minuto + marcador) con la misma prosodia única.
  const largo = prepararVoz([{ tick: 230, texto: `${es ? "¡Gooool! " : "Goooal! "}${golDe} ${cola}`, emocion: "jubilo", intensidad: 0.92, variante: 0, fuentes: [], fotogramas: [] }], idioma);
  push("2-texto-largo-prosodia-unica", idioma, voz, "Estructura completa en un solo fragmento con la prosodia vigente", largo.ssml, largo.texto);
  // 3. Rampa por segmentos: grito alto y lento → goleador rápido → datos descendiendo.
  const rampa: Seg[] = [
    { texto: es ? "¡Gooool!" : "Goooal!", rate: "-15%", pitch: "+18%", volume: "+30%", grado: 2, pausaMs: 150 },
    { texto: golDe, rate: "+10%", pitch: "+12%", volume: "+22%", grado: 1.8, pausaMs: 220 },
    { texto: cola, rate: "+4%", pitch: "+4%", volume: "+8%", grado: 1.2, pausaMs: 380 },
  ];
  push("3-rampa-segmentos", idioma, voz, "Tres segmentos con rampa descendente de tono/volumen y styledegree 2 → 1,2", ssmlDe(voz, lang, estilo, rampa), rampa.map(s => s.texto).join(" "));
  // 4. «¡Gol, gol, gol!» en crescendo (tres gritos con tono y volumen crecientes) y la cola de la 3.
  const triple: Seg[] = [
    { texto: es ? "¡Gol!" : "Goal!", rate: "+5%", pitch: "+6%", volume: "+10%", grado: 1.4, pausaMs: 60 },
    { texto: es ? "¡Gol!" : "Goal!", rate: "0%", pitch: "+12%", volume: "+18%", grado: 1.7, pausaMs: 60 },
    { texto: es ? "¡Gooool!" : "Goooal!", rate: "-15%", pitch: "+20%", volume: "+30%", grado: 2, pausaMs: 150 },
    rampa[1]!, rampa[2]!,
  ];
  push("4-triple-gol-crescendo", idioma, voz, "«¡Gol, gol, gol!» con crescendo por segmento y la misma cola", ssmlDe(voz, lang, estilo, triple), triple.map(s => s.texto).join(" "));
  // 5. Vocal estirada solo en el texto («Gooooool», sin bajar el ritmo) frente a 6. estirado por prosodia.
  const vocalTexto: Seg[] = [{ texto: es ? "¡Goooooool!" : "Goooooal!", rate: "0%", pitch: "+18%", volume: "+30%", grado: 2, pausaMs: 150 }, rampa[1]!, rampa[2]!];
  push("5-vocal-estirada-texto", idioma, voz, "Grito con vocal repetida en el texto, ritmo normal", ssmlDe(voz, lang, estilo, vocalTexto), vocalTexto.map(s => s.texto).join(" "));
  const vocalProsodia: Seg[] = [{ texto: es ? "¡Gol!" : "Goal!", rate: "-45%", pitch: "+18%", volume: "+30%", grado: 2, pausaMs: 150 }, rampa[1]!, rampa[2]!];
  push("6-vocal-estirada-prosodia", idioma, voz, "Grito «¡Gol!» estirado solo con rate −45 %", ssmlDe(voz, lang, estilo, vocalProsodia), vocalProsodia.map(s => s.texto).join(" "));
  // 7. Nombre repetido.
  const nombre: Seg[] = [
    { texto: es ? "¡Gooool!" : "Goooal!", rate: "-15%", pitch: "+18%", volume: "+30%", grado: 2, pausaMs: 150 },
    { texto: es ? `¡${J}! ¡${J}!` : `${J}! ${J}!`, rate: "+8%", pitch: "+12%", volume: "+22%", grado: 1.8, pausaMs: 200 },
    { texto: es ? `Gol para ${EQ}. Minuto ${MIN}: uno a cero.` : `Goal for ${EQ}. Minute ${MIN}: one–nil.`, rate: "+4%", pitch: "+4%", volume: "+8%", grado: 1.2, pausaMs: 380 },
  ];
  push("7-nombre-repetido", idioma, voz, "Grito, nombre del goleador dos veces y datos", ssmlDe(voz, lang, estilo, nombre), nombre.map(s => s.texto).join(" "));
}
// 8. Solo informativo (no es la voz del narrador): en-US-DavisNeural con «shouting» si el catálogo lo lista.
if (estilos("en-US-DavisNeural").has("shouting")) {
  const segs: Seg[] = [{ texto: "Goooal!", rate: "-10%", pitch: "+10%", volume: "+20%", grado: 2, pausaMs: 150, estilo: "shouting" }, { texto: `Goal by ${J}!`, rate: "+6%", pitch: "+6%", volume: "+15%", grado: 1.5, pausaMs: 200, estilo: "shouting" }, { texto: `${EQ} take the lead. Minute ${MIN}: one–nil.`, rate: "+2%", pitch: "0%", volume: "+5%", grado: 1, pausaMs: 380, estilo: "excited" }];
  push("8-davis-shouting-informativo", "en", "en-US-DavisNeural", "Alternativa informativa con estilo shouting (no es la voz del narrador)", ssmlDe("en-US-DavisNeural", "en-US", "shouting", segs), segs.map(s => s.texto).join(" "));
}
const jorgeShout = [...estilos("es-MX-JorgeNeural")].find(e => ["shouting", "excited"].includes(e));
const esAlt = catalogo.find(v => v.locale.startsWith("es-") && v.estilos.includes("shouting"));
if (!jorgeShout && esAlt) {
  const segs: Seg[] = [{ texto: "¡Gooool!", rate: "-10%", pitch: "+10%", volume: "+20%", grado: 2, pausaMs: 150, estilo: "shouting" }, { texto: `¡Gol de ${J}!`, rate: "+6%", pitch: "+6%", volume: "+15%", grado: 1.5, pausaMs: 200, estilo: "shouting" }, { texto: `${EQ} se adelanta. Minuto ${MIN}: uno a cero.`, rate: "+2%", pitch: "0%", volume: "+5%", grado: 1, pausaMs: 380, estilo: "cheerful" }];
  push(`8-${esAlt.voz}-shouting-informativo`, "es", esAlt.voz, `Alternativa informativa en español con shouting (${esAlt.voz}; no es la voz del narrador)`, ssmlDe(esAlt.voz, esAlt.locale, "shouting", segs), segs.map(s => s.texto).join(" "));
}

// 2. Síntesis y medición.
function medir(archivo: string, desdeS?: number, duracionS?: number) {
  const args = ["-hide_banner", "-nostats", "-i", archivo, ...(desdeS !== undefined ? ["-ss", String(desdeS)] : []), ...(duracionS !== undefined ? ["-t", String(duracionS)] : []), "-af", "volumedetect", "-f", "null", "-"];
  let salida = "";
  try { execFileSync(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { salida = String((e as { stderr?: Buffer }).stderr ?? ""); }
  if (!salida) salida = execFileSync(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
  const num = (re: RegExp) => { const m = salida.match(re); return m ? Number(m[1]) : null; };
  const dur = salida.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  return { duracionS: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null, picoDb: num(/max_volume: (-?[\d.]+) dB/), mediaDb: num(/mean_volume: (-?[\d.]+) dB/) };
}
const indice: Record<string, unknown>[] = [];
let caracteres = 0;
for (const c of candidatos) {
  const preparada = { texto: c.texto, ssml: c.ssml, voz: c.voz, idioma: c.idioma, version: "experimento-050", caracteresPresupuestados: c.ssml.length };
  const audio = await sintetizarVoz(preparada as unknown as ReturnType<typeof prepararVoz>, 230);
  const archivo = join(DIR, `${c.idioma}-${c.id}.mp3`);
  writeFileSync(archivo, Buffer.from(audio.base64, "base64"));
  const total = medir(archivo), grito = medir(archivo, 0, 1), resto = total.duracionS ? medir(archivo, 1, Math.max(0.5, total.duracionS - 1)) : { picoDb: null, mediaDb: null };
  caracteres += c.ssml.length;
  const fila = { id: c.id, idioma: c.idioma, voz: c.voz, descripcion: c.descripcion, texto: c.texto, caracteresTexto: c.texto.length, caracteresSsml: c.ssml.length, bytes: Buffer.byteLength(audio.base64, "base64"), archivo: `${c.idioma}-${c.id}.mp3`, duracionS: total.duracionS, picoDb: total.picoDb, mediaDb: total.mediaDb, primerSegundo: { picoDb: grito.picoDb, mediaDb: grito.mediaDb }, resto: { picoDb: resto.picoDb, mediaDb: resto.mediaDb }, ssml: c.ssml };
  indice.push(fila);
  console.log(`${fila.archivo}\t${fila.duracionS}s\tpico ${fila.picoDb} dB\tmedia ${fila.mediaDb} dB\t1er s ${grito.mediaDb} dB\tresto ${resto.mediaDb} dB\t${fila.bytes} B`);
}
writeFileSync(join(DIR, "indice.json"), JSON.stringify({ generadoUtc: new Date().toISOString(), formato: "audio-24khz-48kbitrate-mono-mp3", solicitudes: candidatos.length, caracteresSsml: caracteres, metodo: "ffmpeg volumedetect sobre el MP3 completo, su primer segundo (grito) y el resto; duración de la cabecera de ffmpeg", escuchaHumana: "pendiente", candidatos: indice }, null, 2) + "\n");
console.log(JSON.stringify({ solicitudes: candidatos.length, caracteresSsml: caracteres }));
