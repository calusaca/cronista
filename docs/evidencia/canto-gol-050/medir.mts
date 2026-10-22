// Brief 050 · Vuelve a medir los MP3 ya sintetizados (sin nuevas llamadas a Speech) y
// reescribe indice.json. Ejecutar: node --import tsx docs/evidencia/canto-gol-050/medir.mts
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const DIR = "docs/evidencia/canto-gol-050";
const FFMPEG = spawnSync(".cache/venv-video/bin/python", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).stdout.toString().trim();
function medir(archivo: string, desdeS?: number, duracionS?: number) {
  const args = ["-hide_banner", "-nostats", "-i", archivo, ...(desdeS !== undefined ? ["-ss", String(desdeS)] : []), ...(duracionS !== undefined ? ["-t", String(duracionS)] : []), "-af", "volumedetect", "-f", "null", "-"];
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  const salida = (r.stderr ?? "") + (r.stdout ?? "");
  const num = (re: RegExp) => { const m = salida.match(re); return m ? Number(m[1]) : null; };
  const dur = salida.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  return { duracionS: dur ? Math.round((Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])) * 1000) / 1000 : null, picoDb: num(/max_volume: (-?[\d.]+) dB/), mediaDb: num(/mean_volume: (-?[\d.]+) dB/) };
}
// Duración precisa decodificando (la cabecera MP3 puede redondear): cuenta muestras con astats.
function duracionDecodificada(archivo: string) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", archivo, "-f", "null", "-"], { encoding: "utf8" });
  const m = (r.stderr ?? "").match(/time=(\d+):(\d+):(\d+\.\d+)/g);
  if (!m) return null;
  const u = m.at(-1)!.match(/time=(\d+):(\d+):(\d+\.\d+)/)!;
  return Math.round((Number(u[1]) * 3600 + Number(u[2]) * 60 + Number(u[3])) * 1000) / 1000;
}
const indice = JSON.parse(readFileSync(join(DIR, "indice.json"), "utf8")) as { candidatos: Record<string, unknown>[] } & Record<string, unknown>;
for (const c of indice.candidatos) {
  const archivo = join(DIR, c.archivo as string);
  const total = medir(archivo), decod = duracionDecodificada(archivo);
  const dur = decod ?? total.duracionS ?? 0;
  const grito = medir(archivo, 0, 1), resto = medir(archivo, 1, Math.max(0.5, dur - 1));
  Object.assign(c, { duracionS: dur, picoDb: total.picoDb, mediaDb: total.mediaDb, primerSegundo: { picoDb: grito.picoDb, mediaDb: grito.mediaDb }, resto: { picoDb: resto.picoDb, mediaDb: resto.mediaDb }, caracteresPorSegundo: dur ? Math.round((c.caracteresTexto as number) / dur * 10) / 10 : null });
  console.log(`${c.archivo}\t${dur}s\tpico ${total.picoDb}\tmedia ${total.mediaDb}\t1er s ${grito.mediaDb}\tresto ${resto.mediaDb}\t${c.caracteresTexto} c → ${c.caracteresPorSegundo} c/s`);
}
indice.metodo = "ffmpeg: duración por decodificación completa (último time= de la salida), pico y media (volumedetect) del MP3 completo, de su primer segundo (grito) y del resto";
writeFileSync(join(DIR, "indice.json"), JSON.stringify(indice, null, 2) + "\n");
