import { crearLlmDesdeEnv, crearLlmEquipoDesdeEnv, type Llm, type UsoLlm } from "../lib/llm";
import { prngDerivado } from "../sim/prng";
import { z } from "zod";
import { crearControladorLlm, crearControladorProgramado } from "./controladores";
import type { AsignacionModelos, ModeloPublico, SeleccionModelos } from "./protocolo";
import type { ControladorEquipo } from "./tipos";

type Env = Record<string, string | undefined>;
export interface ModeloConfigurado { publico: ModeloPublico; crear: () => Llm }
const claves = ["FOUNDRY_API_KEY", "FOUNDRY_BASE_URL", "FOUNDRY_DEPLOYMENT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_REASONING_EFFORT"];
const esquemaCatalogo = z.array(z.strictObject({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), nombre: z.string().min(1).max(80), prefijo: z.string().regex(/^ARENA_[A-Z0-9_]+_$/) })).min(1).max(12);

/** Solo configuración del servidor. Construir el catálogo no realiza inferencias. */
export function catalogoModelos(env: Env = process.env): ModeloConfigurado[] {
  if (env.ARENA_WEB_LLM !== "1") return [];
  const catalogo: ModeloConfigurado[] = [];
  if (env.ARENA_MODELOS) {
    for (const entrada of esquemaCatalogo.parse(JSON.parse(env.ARENA_MODELOS))) {
      if (catalogo.some(m => m.publico.id === entrada.id)) throw new Error("Identificadores de modelos repetidos");
      const configuracion: Env = { ...env, CRONISTA_LLM: env[entrada.prefijo + "LLM"] ?? env.CRONISTA_LLM };
      for (const clave of claves) if (env[entrada.prefijo + clave] !== undefined) configuracion[clave] = env[entrada.prefijo + clave];
      if (!["azure-openai", "foundry"].includes(configuracion.CRONISTA_LLM ?? "")) throw new Error("El catálogo necesita modelos reales");
      const crear = () => crearLlmDesdeEnv(configuracion, { maxRetries: 0 });
      catalogo.push({ publico: { id: entrada.id, nombre: entrada.nombre, controlador: crear().id }, crear });
    }
  } else {
    for (const lado of ["local", "visita"] as const) {
      const crear = () => crearLlmEquipoDesdeEnv(lado, env), llm = crear();
      if (!catalogo.some(m => m.publico.controlador === llm.id)) catalogo.push({ publico: { id: lado, nombre: llm.id, controlador: llm.id }, crear });
    }
  }
  return catalogo;
}

export function elegirModelos(seleccion: SeleccionModelos, seed: number, catalogo: ModeloConfigurado[]): { asignacion: AsignacionModelos; controladores: { local: ControladorEquipo; visita: ControladorEquipo }; uso: () => { local: UsoLlm | null; visita: UsoLlm | null } } {
  if (seleccion.modo === "programado") {
    const modelo = { id: "programado", nombre: "Programmed policy / Política programada", controlador: crearControladorProgramado().id };
    return { asignacion: { modo: "programado", local: modelo, visita: modelo }, controladores: { local: crearControladorProgramado(), visita: crearControladorProgramado() }, uso: () => ({ local: null, visita: null }) };
  }
  if (!catalogo.length) throw new Error("No hay modelos habilitados");
  let local: ModeloConfigurado | undefined, visita: ModeloConfigurado | undefined;
  if (seleccion.modo === "manual") {
    local = catalogo.find(m => m.publico.id === seleccion.local); visita = catalogo.find(m => m.publico.id === seleccion.visita);
  } else {
    const rng = prngDerivado(seed, "arena:seleccion-modelos:v1"), ordenados = [...catalogo].sort((a, b) => a.publico.id.localeCompare(b.publico.id));
    local = rng.pick(ordenados);
    const distintos = ordenados.filter(m => m.publico.controlador !== local!.publico.controlador);
    visita = rng.pick(distintos.length ? distintos : ordenados);
  }
  if (!local || !visita) throw new Error("Modelo fuera del catálogo");
  const llms = { local: local.crear(), visita: visita.crear() };
  return { asignacion: { modo: seleccion.modo, local: local.publico, visita: visita.publico }, controladores: { local: crearControladorLlm(llms.local), visita: crearControladorLlm(llms.visita) }, uso: () => ({ local: llms.local.uso?.() ?? null, visita: llms.visita.uso?.() ?? null }) };
}
