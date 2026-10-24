// Brief 046 · Métricas de lote con metadatos de reproducción. Brief 051: también las métricas de
// remate (bandas de LOTE_ARENA_051) y, con --controlado, el experimento controlado de niveles.
// Brief 063: las bandas del bloque A (LOTE_ARENA_063, desde reinicios-v6) y, con --escenas, la lista por
// semilla de los episodios superados con repliegue y de cada persecución (en segundos), para el smoke.
// `node --import tsx src/arena/metricas-lote-cli.ts --desde 1 --semillas 100 [--reglas reinicios-v4] [--controlado] [--escenas] [--salida archivo.json]`
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ARENA, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51 } from "../sim/limites";
import { bandasLote, escenasLote, incumplimientos, incumplimientos063, incumplimientosControlado, medirControlado, medirLote } from "./metricas-lote";
import { reglasArena, type ReglasArena } from "./tipos";

const arg = (nombre: string) => { const i = process.argv.indexOf(`--${nombre}`); return i > 0 ? process.argv[i + 1] : undefined; };
const desde = Number(arg("desde") ?? L.completo.semillaDesde), semillas = Number(arg("semillas") ?? L.completo.semillas);
const reglas = (arg("reglas") ?? ARENA.reglas) as ReglasArena;
const controlado = process.argv.includes("--controlado");
if (!reglasArena.includes(reglas) || !Number.isInteger(desde) || !Number.isInteger(semillas) || semillas < 1) throw new Error("Argumentos inválidos");
const git = (...a: string[]) => { try { return execFileSync("git", ["-c", `safe.directory=${process.cwd()}`, ...a], { encoding: "utf8" }).trim(); } catch { return null; } };
const inicio = performance.now();
const archivo = arg("salida");
const escribir = (salida: object) => { const texto = JSON.stringify(salida, null, 1); if (archivo) writeFileSync(archivo, texto + "\n"); console.log(texto); };
const metadatos = () => ({ generado: new Date().toISOString(), commit: git("rev-parse", "HEAD"), arbolConCambios: !!git("status", "--porcelain"), reglas, semillas: { desde, hasta: desde + semillas - 1 } });

if (process.argv.includes("--escenas")) {
  const s = (tick: number) => Math.round(tick * ARENA.pasoS * 10) / 10;
  const escenas = (await escenasLote({ desde, semillas, reglas })).map(e => ({
    seed: e.seed,
    superados: e.superados.map(x => ({ desdeS: s(x.desdeTick), hastaS: s(x.hastaTick), poseedor: x.poseedor, repliegue: x.repliegue })),
    persecuciones: e.persecuciones.map(x => ({ jugador: x.jugador, linea: x.linea, desdeS: s(x.desdeTick), hastaS: s(x.hastaTick) })),
  }));
  escribir({ ...metadatos(), duracionS: L.duracionS, controladores: "programado:geometria-v3 (ambos lados)", escenas });
} else {
  const metricas = await medirLote({ desde, semillas, reglas });
  const rapido = semillas === L.rapido.semillas;
  const { b046: banda, b051: banda051, b063 } = bandasLote(reglas, rapido ? "rapido" : "completo");
  let experimento: Record<string, unknown> | undefined;
  if (controlado) {
    const porteros = await medirControlado({ desde, semillas, reglas, quien: "portero" });
    const campo = await medirControlado({ desde, semillas, reglas, quien: "campo" });
    const resumen = (x: Awaited<ReturnType<typeof medirControlado>>) => ({ diferencia: x.diferencia, bajo: x.bajo.remate, alto: x.alto.remate });
    experimento = { niveles: L51.nivelesControlado, porteros: resumen(porteros), campo: resumen(campo),
      incumplimientos: incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, banda051) };
  }
  escribir({
    ...metadatos(), duracionS: metricas.duracionS,
    controladores: "programado:geometria-v3 (ambos lados)", banda: rapido ? "rapido" : "completo",
    incumplimientos: [...incumplimientos(metricas, banda, banda051), ...(b063 ? incumplimientos063(metricas, b063) : [])], segundos: Math.round((performance.now() - inicio) / 100) / 10,
    ...(experimento ? { controlado: experimento } : {}), metricas,
  });
}
