// ¿Admite la arena niveles forzados por jugador (variantes.niveles)? Motor del repositorio.
import { configDeSemilla } from "/home/calusaca/cronista/src/sim/plantillas";
import { crearConfigArena } from "/home/calusaca/cronista/src/arena/motor";
import { ejecutarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { crearControladorProgramado } from "/home/calusaca/cronista/src/arena/controladores";

export function partidoConNiveles(seed: number, nivelPortero: number | null, nivelCampo: number | null) {
  const base = configDeSemilla(seed);
  const equipo = (lado: "local" | "visita") => {
    const nivelEquipo = Math.round((base[lado].ataque + base[lado].defensa) / 2);
    return { ...base[lado], jugadores: base[lado].jugadores.map(j => ({ ...j, nivel: j.posicion === "POR" ? (nivelPortero ?? nivelEquipo) : (nivelCampo ?? nivelEquipo) })) };
  };
  return { ...base, variantes: { ...(base.variantes ?? {}), niveles: true }, local: equipo("local"), visita: equipo("visita") };
}

if (process.argv[1]?.endsWith("niveles-check.mts")) {
  try {
    const cfg = crearConfigArena({ seed: 3, partido: partidoConNiveles(3, 90, null), duracionS: 20 });
    const r = await ejecutarArena(cfg, { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    console.log("niveles forzados OK; porteros:", r.inicial.jugadores.filter(j => j.puesto === "POR").map(j => j.nivel), "campo:", r.inicial.jugadores.find(j => j.puesto !== "POR")!.nivel, "eventos", r.eventos.length, "reglas", r.config.reglas);
  } catch (e) { console.log("ERROR", (e as Error).message); }
}
