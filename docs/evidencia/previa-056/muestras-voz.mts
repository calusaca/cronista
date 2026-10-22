// Brief 056 (criterio 10.4, parte de síntesis) · Las tres piezas de la previa con Azure Speech real, en ES y
// EN y en sus dos variantes, por la misma ruta que la ruta /relato: previaPartido → relatoIntervencion →
// prepararVoz (voces del catálogo real con su degradación) → sintetizarVoz. Guarda MP3, SSML y un índice con
// la duración decodificada frente a la estimación (estimarDuracionS) y los caracteres cobrados (SSML).
// Ejecutar desde la raíz: node --import tsx docs/evidencia/previa-056/muestras-voz.mts [semilla]
// Credenciales: .env y .cache/azure-servicios.env (nunca se imprimen ni se escriben).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { crearConfigArena, crearEstadoArena } from "../../../src/arena/motor.ts";
import { previaPartido } from "../../../src/arena/previa.ts";
import { relatoIntervencion } from "../../../src/arena/relato.ts";
import { estimarDuracionS, varianteEfectiva } from "../../../src/arena/turnos.ts";
import type { RegistroArena } from "../../../src/arena/tipos.ts";
import { asignarVoces, catalogoVoces, prepararVoz, sintetizarVoz, vocesDe } from "../../../src/arena/voz.ts";
import { PREVIA_ARENA } from "../../../src/sim/limites.ts";

for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
const DIR = "docs/evidencia/previa-056/voz"; mkdirSync(DIR, { recursive: true });
const FFMPEG = spawnSync(".cache/venv-video/bin/python", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).stdout.toString().trim();
function duracionDecodificada(archivo: string) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", archivo, "-f", "null", "-"], { encoding: "utf8" });
  const m = ((r.stderr ?? "") + (r.stdout ?? "")).match(/time=(\d+):(\d+):(\d+\.\d+)/g);
  if (!m) return null;
  const [h, mi, s] = m.at(-1)!.slice(5).split(":").map(Number) as [number, number, number];
  return Math.round((h * 3600 + mi * 60 + s) * 100) / 100;
}

const seed = Number(process.argv[2] ?? 4242);
const config = crearConfigArena({ seed, duracionS: 60 }), inicial = crearEstadoArena(config);
const registro: RegistroArena = { version: config.version!, config, inicial, rondas: [], eventos: [], fotogramas: [inicial], final: inicial };
const piezas = previaPartido(registro);
const filas: Record<string, unknown>[] = [];
let solicitudes = 0, caracteres = 0;
for (const idioma of ["es", "en"] as const) {
  const voces = vocesDe(asignarVoces(idioma, await catalogoVoces()));
  for (const i of piezas) for (const pedida of ["completa", "breve"] as const) {
    const variante = varianteEfectiva(i, pedida);
    if (variante !== pedida) continue; // pieza colapsada: la breve es la completa
    const relato = relatoIntervencion(i, seed, idioma, variante);
    const preparada = prepararVoz(relato.fragmentos, idioma, voces);
    const base = `${idioma}-${i.id.replace(/[:]/g, "_")}-${variante}`;
    writeFileSync(`${DIR}/${base}.ssml.xml`, preparada.ssml + "\n");
    const audio = await sintetizarVoz(preparada, 0);
    writeFileSync(`${DIR}/${base}.mp3`, Buffer.from(audio.base64, "base64"));
    solicitudes++; caracteres += preparada.caracteresPresupuestados;
    const turnos = variante === "breve" ? i.turnosBreve! : i.turnos!;
    const fila = { archivo: `${base}.mp3`, idioma, pieza: i.id, variante, texto: relato.texto, roles: relato.fragmentos.map(f => f.rol), voces: [...new Set([...preparada.ssml.matchAll(/<voice name="([^"]+)">/g)].map(m => m[1]))],
      caracteresTexto: relato.texto.length, caracteresSsml: preparada.caracteresPresupuestados, estimadaS: Math.round(estimarDuracionS(turnos) * 100) / 100, realS: duracionDecodificada(`${DIR}/${base}.mp3`) };
    filas.push(fila); console.log(JSON.stringify(fila));
  }
}
const indice = { generado: new Date().toISOString(), semilla: seed, bolsa: PREVIA_ARENA.bolsaSpeech, solicitudes, caracteresSsml: caracteres, filas };
writeFileSync(`${DIR}/indice.json`, JSON.stringify(indice, null, 2) + "\n");
console.log(JSON.stringify({ solicitudes, caracteresSsml: caracteres, bolsa: PREVIA_ARENA.bolsaSpeech }));
