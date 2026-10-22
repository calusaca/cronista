// Brief 054 · Variedad del grito de gol: síntesis real de cada grito candidato con Azure Speech.
// Ejecutar desde la raíz: node --import tsx docs/evidencia/canto-gol-054/experimento.mts
//   SOLO_MEDIR=1 vuelve a medir los MP3 ya guardados sin llamar a Speech.
//   RONDA=2 sintetiza la ronda 2 (cota de duración de la forma completa con los gritos elegidos).
// Credenciales: .env y .cache/azure-servicios.env (nunca se imprimen ni se escriben).
// Misma ruta HTTP que src/arena/voz.ts (sintetizarVoz), mismo formato (audio-24khz-48kbitrate-mono-mp3)
// y la misma estructura SSML que parteCanto: un <s>, express-as + prosody por tramo, break final.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { sintetizarVoz, type prepararVoz } from "../../../src/arena/voz.ts";
import { CANTO_GOL } from "../../../src/sim/limites.ts";

for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
const DIR = "docs/evidencia/canto-gol-054"; mkdirSync(DIR, { recursive: true });
const FFMPEG = spawnSync(".cache/venv-video/bin/python", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).stdout.toString().trim();
const esc = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

type Tramo = { texto: string; rate: number; pitch: number; volume: number; grado: number; estilo: string };
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
const unaOracion = (voz: string, lang: string, tramos: Tramo[]) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${voz}"><s>${tramos.map(t => `<mstts:express-as style="${t.estilo}" styledegree="${t.grado.toFixed(2)}"><prosody rate="${pct(t.rate)}" pitch="${pct(t.pitch)}" volume="${pct(t.volume)}">${esc(t.texto)}</prosody></mstts:express-as>`).join("")}<break time="${CANTO_GOL.pausaFinalMs}ms"/></s></voice></speak>`;

// Brief 054 v1.1 (3): el rate de control del experimento (−30, el del 050) queda fijado aquí como literal
// histórico: CANTO_GOL.tramos.grito ya no lleva rate (cada grito del catálogo aporta el suyo).
const G = { ...CANTO_GOL.tramos.grito, rate: -30 }, N = CANTO_GOL.tramos.goleador, H = CANTO_GOL.tramos.hechos;
const VOZ = { es: "es-MX-JorgeNeural", en: "en-US-JennyNeural" } as const, LANG = { es: "es-MX", en: "en-US" } as const;
const ESTILO = { es: CANTO_GOL.estilos.es.grito, en: CANTO_GOL.estilos.en.grito } as const;
/** Grito solo: la prosodia de CANTO_GOL.tramos.grito salvo el rate indicado. */
const grito = (idioma: "es" | "en", id: string, texto: string, rate: number, descripcion: string, grupo: string) =>
  ({ id, idioma, voz: VOZ[idioma], descripcion, grupo, ronda: 1, tramos: [{ texto, rate, pitch: G.pitch, volume: G.volume, grado: G.grado, estilo: ESTILO[idioma] }] as Tramo[] });

// Ronda 1: cada grito candidato por separado (grafía estirada frente a prosodia).
const ronda1 = [
  grito("es", "01-control-gooool", "¡Gooool!", G.rate, "Grito vigente del 050 (control)", "control"),
  grito("es", "02-gooool-largo", "¡Goooooooool!", G.rate, "Vocal más estirada en el texto", "grafia"),
  grito("es", "03-gol-x4", "¡Gol, gol, gol, gol!", -10, "Repetición corta (ejemplo de Carlos «gol gol gol…»)", "repeticion"),
  grito("es", "04-gol-gol-gol-gooool", "¡Gol, gol, gol, gooool!", -20, "Repetición que remata en vocal larga", "repeticion"),
  grito("es", "05-golaaaazo", "¡Golaaaazo!", -20, "Ejemplo de Carlos «qué golaaaazo» con la vocal estirada", "golazo"),
  grito("es", "06-golazo-prosodia", "¡Golazo!", G.rate, "Golazo sin estirar, solo prosodia", "golazo"),
  grito("es", "07-que-golazo", "¡Qué golazo!", -25, "Golazo con exclamativo, solo prosodia", "golazo"),
  grito("es", "08-que-golaaaazo", "¡Qué golaaaazo!", -25, "Golazo con exclamativo y vocal estirada", "golazo"),
  grito("es", "09-remate-y-gol", "¡Remate y gol!", -20, "Ejemplo de Carlos «remate y go go go…» en forma corta", "remate"),
  grito("es", "10-remate-y-gooool", "¡Remate y gooool!", -25, "Remate y gol con vocal estirada", "remate"),
  grito("es", "11-yyyy-gooool", "¡Yyyy gooool!", G.rate, "Ejemplo de Carlos «yyyy guuuoooolll» con la conjunción estirada", "grafia"),
  grito("es", "12-y-gooool", "¡Y gooool!", G.rate, "Conjunción sin estirar", "grafia"),
  grito("es", "13-guuuoooolll", "¡Guuuoooolll!", G.rate, "Grafía literal de Carlos (riesgo de deletreo)", "grafia"),
  grito("es", "14-gooool-elles", "¡Goooolllll!", G.rate, "Vocal y consonante final estiradas", "grafia"),
  grito("es", "15-gooool-doble", "¡Gooool, gooool!", G.rate, "Dos gritos seguidos en una oración", "repeticion"),
  grito("es", "16-gooool-del-empate", "¡Gooool del empate!", G.rate, "Condicionado: situación empate", "situacion"),
  grito("es", "17-gooool-sobre-el-final", "¡Gooool sobre el final!", G.rate, "Condicionado: gol tardío (regla de 050)", "situacion"),
  grito("es", "18-y-otro-gooool", "¡Y otro gooool!", G.rate, "Condicionado: el equipo ya había marcado (goleada/ampliación)", "situacion"),
  grito("es", "19-mayusculas", "¡GOOOL!", G.rate, "Mayúsculas (riesgo de deletreo como sigla)", "grafia"),
  grito("es", "20-gol-prosodia-45", "¡Gol!", -45, "Solo prosodia, sin estirar (control del 050)", "prosodia"),
  grito("es", "21-gooool-rate-45", "¡Gooool!", -45, "Grafía estirada y rate más lento", "prosodia"),
  grito("es", "22-adentro-gooool", "¡Adentro, gooool!", -25, "Verificable: el balón cruzó la línea", "remate"),
  grito("es", "23-gooool-gol-gol", "¡Gooool, gol, gol!", -25, "Vocal larga primero y repetición corta después", "repeticion"),
  grito("en", "01-control-goooal", "Goooal!", G.rate, "Current 050 cry (control)", "control"),
  grito("en", "02-goooal-largo", "Goooooooal!", G.rate, "Longer stretched vowel in the text", "grafia"),
  grito("en", "03-goal-x4", "Goal, goal, goal, goal!", -10, "Short repetition", "repeticion"),
  grito("en", "04-go-go-go-goooal", "Go, go, go, goooal!", -20, "Carlos's «go go go goooll» example", "repeticion"),
  grito("en", "05-what-a-goal", "What a goal!", -25, "Golazo, prosody only", "golazo"),
  grito("en", "06-what-a-goooal", "What a goooal!", -25, "Golazo with stretched vowel", "golazo"),
  grito("en", "07-shoots-and-scores", "Shoots and scores!", -20, "Shot then goal", "remate"),
  grito("en", "08-shot-and-goooal", "Shot, and goooal!", -25, "Shot then stretched goal", "remate"),
  grito("en", "09-aaand-goooal", "Aaaand goooal!", G.rate, "Stretched conjunction (Carlos's «yyyy»)", "grafia"),
  grito("en", "10-and-goooal", "And goooal!", G.rate, "Conjunction without stretching", "grafia"),
  grito("en", "11-guuuoooal", "Guuuoooal!", G.rate, "Literal spelling from Carlos (risk of letter-by-letter)", "grafia"),
  grito("en", "12-goooallll", "Goooallll!", G.rate, "Stretched vowel and final consonant", "grafia"),
  grito("en", "13-goooal-doble", "Goooal, goooal!", G.rate, "Two cries in one sentence", "repeticion"),
  grito("en", "14-goooal-level", "Goooal, they're level!", -25, "Conditioned: equaliser", "situacion"),
  grito("en", "15-late-goooal", "A late, late goooal!", -25, "Conditioned: late goal (050 rule)", "situacion"),
  grito("en", "16-another-goooal", "Another goooal!", G.rate, "Conditioned: the team had already scored", "situacion"),
  grito("en", "17-mayusculas", "GOOOAL!", G.rate, "Upper case (risk of acronym spelling)", "grafia"),
  grito("en", "18-goal-prosodia-45", "Goal!", -45, "Prosody only (050 control)", "prosodia"),
  grito("en", "19-goooal-rate-45", "Goooal!", -45, "Stretched spelling with slower rate", "prosodia"),
  grito("en", "20-its-in-goooal", "It's in, goooal!", -25, "Verifiable: the ball crossed the line", "remate"),
  grito("en", "21-goooal-goal-goal", "Goooal, goal, goal!", -25, "Long vowel first, short repetition after", "repeticion"),
];

// Ronda 2: forma completa de tres tramos (parteCanto) con gritos candidatos, para la cota de duración
// y para la escucha en contexto. Nombres de 26/27 caracteres, «sobre el final», goleada y marcador en cifras,
// como la cota del 050 (es-17/en-17).
const JL = "Maximiliano Torrealba Ríos", EQL = "Atlético Montefrío Bajo Sur";
const completo = (idioma: "es" | "en", id: string, gritoTexto: string, rate: number, descripcion: string, goleador: string, hechos: string) => ({
  id, idioma, voz: VOZ[idioma], descripcion, grupo: "completo", ronda: 2, tramos: [
    { texto: gritoTexto, rate, pitch: G.pitch, volume: G.volume, grado: G.grado, estilo: CANTO_GOL.estilos[idioma].grito },
    { texto: goleador, rate: N.rate, pitch: N.pitch, volume: N.volume, grado: N.grado, estilo: CANTO_GOL.estilos[idioma].goleador },
    { texto: hechos, rate: H.rate, pitch: H.pitch, volume: H.volume, grado: H.grado, estilo: CANTO_GOL.estilos[idioma].hechos },
  ] as Tramo[],
});
const ronda2 = JSON.parse(process.env.RONDA2 ?? "[]") as { idioma: "es" | "en"; id: string; texto: string; rate: number; descripcion: string }[];
const candidatosRonda2 = ronda2.map(c => c.idioma === "es"
  ? completo("es", c.id, c.texto, c.rate, c.descripcion, `¡Gol, gol de ${JL}!`, `Sobre el final, goleada de ${EQL}, 10 a 7, a los 179 segundos.`)
  : completo("en", c.id, c.texto, c.rate, c.descripcion, `Goal, goal by ${JL}!`, `Late on, it's a rout for ${EQL}, 10–7, after 179 seconds.`));

function ffmpeg(args: string[]) { const r = spawnSync(FFMPEG, ["-hide_banner", "-nostats", ...args], { encoding: "utf8" }); return (r.stderr ?? "") + (r.stdout ?? ""); }
function volumen(archivo: string, desdeS?: number, duracionS?: number) {
  const salida = ffmpeg(["-i", archivo, ...(desdeS !== undefined ? ["-ss", String(desdeS)] : []), ...(duracionS !== undefined ? ["-t", String(duracionS)] : []), "-af", "volumedetect", "-f", "null", "-"]);
  const num = (re: RegExp) => { const m = salida.match(re); return m ? Number(m[1]) : null; };
  return { picoDb: num(/max_volume: (-?[\d.]+) dB/), mediaDb: num(/mean_volume: (-?[\d.]+) dB/) };
}
function duracionDecodificada(archivo: string) {
  const m = ffmpeg(["-i", archivo, "-f", "null", "-"]).match(/time=(\d+):(\d+):(\d+\.\d+)/g);
  if (!m) return null;
  const u = m.at(-1)!.match(/time=(\d+):(\d+):(\d+\.\d+)/)!;
  return Math.round((Number(u[1]) * 3600 + Number(u[2]) * 60 + Number(u[3])) * 1000) / 1000;
}
/** Fin del habla (s): inicio del último silencio a −30 dB (≥ 80 ms) que llega hasta el final; y silencios internos. */
function habla(archivo: string, dur: number) {
  const salida = ffmpeg(["-i", archivo, "-af", "silencedetect=noise=-30dB:d=0.08", "-f", "null", "-"]);
  const inicios = [...salida.matchAll(/silence_start: (-?[\d.]+)/g)].map(m => Number(m[1]));
  const fines = [...salida.matchAll(/silence_end: (-?[\d.]+)/g)].map(m => Number(m[1]));
  // ffmpeg cierra el silencio final en el EOF: es el que termina a ≤ 0,1 s del final; el inicial empieza en 0.
  const tramos = inicios.map((s, i) => ({ inicio: s, fin: fines[i] ?? dur }));
  const final = tramos.find(t => t.fin >= dur - 0.1 && t.inicio > 0.3), inicial = tramos.find(t => t.inicio <= 0.02);
  const finHabla = final ? final.inicio : dur, inicioHabla = inicial ? inicial.fin : 0;
  const internos = tramos.filter(t => t !== final && t !== inicial).map(t => Math.round((t.fin - t.inicio) * 1000) / 1000).filter(d => d >= 0.08);
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return { inicioHablaS: r(inicioHabla), finHablaS: r(Math.max(0, finHabla)), hablaS: r(Math.max(0, finHabla - inicioHabla)), silencioFinalS: r(dur - finHabla), silenciosInternosS: internos };
}
function medir(archivo: string) {
  const total = volumen(archivo), dur = duracionDecodificada(archivo) ?? 0;
  const dos = volumen(archivo, 0, 2), h = habla(archivo, dur);
  return { duracionS: dur, picoDb: total.picoDb, mediaDb: total.mediaDb, dosPrimerosS: dos, ...h };
}

type Registro = Record<string, unknown> & { archivo: string; caracteresTexto: number; texto: string };
const rutaIndice = join(DIR, "indice.json");
const indice = existsSync(rutaIndice) ? JSON.parse(readFileSync(rutaIndice, "utf8")) as { candidatos: Registro[]; solicitudes: number; caracteresSsml: number } & Record<string, unknown>
  : { generadoUtc: new Date().toISOString(), formato: "audio-24khz-48kbitrate-mono-mp3", solicitudes: 0, caracteresSsml: 0, escuchaHumana: "pendiente", candidatos: [] as Registro[] };

const candidatos = process.env.RONDA === "2" ? candidatosRonda2 : ronda1;
if (!process.env.SOLO_MEDIR) {
  for (const c of candidatos) {
    const archivo = `${c.idioma}-${c.id}.mp3`;
    if (indice.candidatos.some(x => x.archivo === archivo)) { console.log("ya existe", archivo); continue; }
    const ssml = unaOracion(c.voz, LANG[c.idioma], c.tramos), texto = c.tramos.map(t => t.texto).join(" ");
    const preparada = { texto, ssml, voz: c.voz, idioma: c.idioma, version: "experimento-054", caracteresPresupuestados: ssml.length };
    const audio = await sintetizarVoz(preparada as unknown as ReturnType<typeof prepararVoz>, 230);
    writeFileSync(join(DIR, archivo), Buffer.from(audio.base64, "base64"));
    indice.candidatos.push({ id: c.id, idioma: c.idioma, voz: c.voz, grupo: c.grupo, ronda: c.ronda, descripcion: c.descripcion, texto, rateGrito: c.tramos[0]!.rate, caracteresTexto: texto.length, caracteresSsml: ssml.length, bytes: Buffer.byteLength(audio.base64, "base64"), archivo, ssml });
    indice.solicitudes += 1; indice.caracteresSsml += ssml.length;
    console.log("sintetizado", archivo, texto.length, "c", ssml.length, "ssml");
  }
}
for (const c of indice.candidatos) {
  const m = medir(join(DIR, c.archivo));
  Object.assign(c, m, { caracteresPorSegundo: m.hablaS ? Math.round(c.caracteresTexto / m.hablaS * 10) / 10 : null });
  console.log(`${c.archivo}\t${m.duracionS}s\thabla ${m.hablaS}s (${m.inicioHablaS}→${m.finHablaS}, fin ${m.silencioFinalS})\tpico ${m.picoDb}\tmedia ${m.mediaDb}\t2s ${m.dosPrimerosS.mediaDb}/${m.dosPrimerosS.picoDb}\tint ${JSON.stringify(m.silenciosInternosS)}\t«${c.texto}»`);
}
indice.metodo = "ffmpeg: duración por decodificación completa; pico y media (volumedetect) del clip y de sus dos primeros segundos; fin del habla = inicio del último silencio a −30 dB (≥ 80 ms) que llega al final; silencios internos listados";
writeFileSync(rutaIndice, JSON.stringify(indice, null, 2) + "\n");
console.log(JSON.stringify({ solicitudes: indice.solicitudes, caracteresSsml: indice.caracteresSsml, clips: indice.candidatos.length }));
