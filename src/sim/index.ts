// API pública del simulador (brief 001).
export * from "./tipos";
export {
  simular,
  validarConfig,
  normalizarSeed,
  fatiga,
  factoresAtaque,
  validarPlanCambios,
  cambiosEjecutables,
  type SituacionEquipo,
  type FactoresAtaque,
} from "./motor";
export { parsearArgs, type OpcionesCli, type ResultadoArgs } from "./cli-args";
export { configDeSemilla, generarEquipo, generarPlantilla, type OpcionesEquipo } from "./plantillas";
export { crearRng, mulberry32, type Rng } from "./prng";
export { resumir, franjaDe, golesConPeriodo, type Resumen, type ConteoEquipo } from "./resumen";
export { VERIFICADORES } from "./invariantes";
