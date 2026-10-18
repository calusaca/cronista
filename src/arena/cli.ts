import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { crearLlmEquipoDesdeEnv } from "../lib/llm";
import { ARENA } from "../sim/limites";
import type { SimConfig } from "../sim/tipos";
import { crearControladorLlm, crearControladorProgramado } from "./controladores";
import { ejecutarArena, reproducirArena } from "./coordinador";
import { crearConfigArena } from "./motor";
import { formaciones, type FormacionArena } from "./tipos";

async function main() {
  const { values } = parseArgs({ options: {
    seed: { type: "string", default: "42" }, segundos: { type: "string", default: String(ARENA.duracionS) },
    intervalo: { type: "string", default: String(ARENA.intervaloS) }, modo: { type: "string", default: "programado" },
    local: { type: "string", default: "4-3-3" }, visita: { type: "string", default: "4-2-3-1" },
    salida: { type: "string" }, reproducir: { type: "string" }, espera: { type: "string", default: String(ARENA.esperaMs) },
    config: { type: "string" },
  }, strict: true });
  if (values.salida && existsSync(values.salida)) throw new Error("El archivo de salida ya existe");
  let registro;
  if (values.reproducir) {
    if (statSync(values.reproducir).size > ARENA.archivoMaxBytes) throw new Error("Archivo demasiado grande");
    registro = reproducirArena(JSON.parse(readFileSync(values.reproducir, "utf8")));
  } else {
    if (!["programado", "llm"].includes(values.modo)) throw new Error("modo: programado | llm");
    if (!formaciones.includes(values.local as FormacionArena) || !formaciones.includes(values.visita as FormacionArena)) throw new Error("formación: 4-3-3 | 4-2-3-1 | 4-4-2");
    if (values.config && statSync(values.config).size > ARENA.archivoMaxBytes) throw new Error("Configuración demasiado grande");
    const partido = values.config ? JSON.parse(readFileSync(values.config, "utf8")) as SimConfig : undefined;
    const config = crearConfigArena({ seed: Number(values.seed), ...(partido ? { partido } : {}), duracionS: Number(values.segundos), intervaloS: Number(values.intervalo), local: values.local as FormacionArena, visita: values.visita as FormacionArena });
    if (values.modo === "llm" && existsSync(".env")) process.loadEnvFile(".env");
    const controladores = values.modo === "llm" ? {
      local: crearControladorLlm(crearLlmEquipoDesdeEnv("local")), visita: crearControladorLlm(crearLlmEquipoDesdeEnv("visita")),
    } : { local: crearControladorProgramado(), visita: crearControladorProgramado() };
    console.error(`Arena experimental · ${config.duracionS} s · máximo ${Math.ceil(config.duracionS / config.intervaloS) * 2} decisiones de equipo · ${values.modo}`);
    console.error(`Local: ${controladores.local.id} · visita: ${controladores.visita.id}`);
    registro = await ejecutarArena(config, controladores, { esperaMs: Number(values.espera), alProgreso: r => console.error(`Resuelto ${r.finTick * ARENA.pasoS} s · ${r.decisiones.local.origen} / ${r.decisiones.visita.origen}`) });
  }
  // El propio archivo debe reproducirse antes de ofrecerlo para descarga.
  reproducirArena(registro);
  const resumen = {
    version: registro.version, segundos: registro.final.tick * ARENA.pasoS, rondas: registro.rondas.length,
    eventos: registro.eventos.length, marcador: registro.final.marcador,
    controladores: registro.rondas[0]?.decisiones ? { local: registro.rondas[0].decisiones.local.controlador, visita: registro.rondas[0].decisiones.visita.controlador } : {},
    respaldos: registro.rondas.flatMap(r => Object.values(r.decisiones)).filter(d => d.origen === "respaldo").length,
    reproduccion: "coincide",
  };
  if (values.salida) { writeFileSync(values.salida, JSON.stringify(registro) + "\n", { flag: "wx" }); console.log(JSON.stringify({ ...resumen, archivo: values.salida }, null, 2)); }
  else console.log(JSON.stringify(resumen, null, 2));
}
main().catch(() => {
  // Los errores de transporte pueden contener material del proveedor. El registro
  // conserva códigos de respaldo; la CLI no vuelca respuestas o credenciales.
  console.error("No se pudo ejecutar/reproducir la arena. Revisa argumentos, configuración y ruta de salida; el archivo de destino debe ser nuevo.");
  process.exitCode = 1;
});
