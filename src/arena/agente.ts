import { z } from "zod";
import { verificarUpdate, type HechoVerificable } from "../cadena/verificador";
import { credencialAzure, endpointAzure } from "../lib/azure";
import { trazar } from "../lib/telemetria";
import { conCancelacion } from "../lib/cancelacion";
import { contextoNarradorArena, SISTEMA_NARRADOR_ARENA, type ComentarioArena } from "./narrador";
import type { RegistroArena } from "./tipos";

export type PreguntaArena = "momento" | "jugador" | "ocasiones";
export interface PeticionAnalista { tick: number; pregunta: PreguntaArena; jugador: string | null; audiencia: "fan" | "analyst"; sesion?: string }
export interface LlamadaHerramienta { nombre: string; argumentos: unknown; hechos: string[]; error?: string }
export interface ResultadoAnalista { tick: number; agente: string; solicitudes: number; herramientas: LlamadaHerramienta[]; comentario: ComentarioArena | null; uso: { entrada: number; salida: number } }
interface RespuestaAgente { id: string; output: Array<{ type: string; name?: string; arguments?: string; call_id?: string; content?: Array<{ type: string; text?: string }> }>; output_text?: string; usage?: { input_tokens: number; output_tokens: number } }
export interface TransporteAgente { id: string; responder(input: unknown[], forzarHerramienta: boolean, signal: AbortSignal): Promise<RespuestaAgente> }

export const HERRAMIENTAS_ANALISTA = [
  { type: "function" as const, name: "consultar_eventos", description: "Consulta hechos confirmados. Usa tipo gol/tiro para ocasiones o todos para el momento actual.", strict: true,
    parameters: { type: "object", additionalProperties: false, required: ["desdeTick", "hastaTick", "tipo"], properties: { desdeTick: { type: "integer", minimum: 0 }, hastaTick: { type: "integer", minimum: 0 }, tipo: { type: "string", enum: ["todos", "gol", "tiro"] } } } },
  { type: "function" as const, name: "consultar_jugador", description: "Recupera acciones confirmadas del jugador seleccionado, sin eventos futuros.", strict: true,
    parameters: { type: "object", additionalProperties: false, required: ["jugadorId", "hastaTick"], properties: { jugadorId: { type: "string" }, hastaTick: { type: "integer", minimum: 0 } } } },
];
export function definicionAnalista(modelo: string) {
  return { kind: "prompt" as const, model: modelo, instructions: `${SISTEMA_NARRADOR_ARENA}\nEres el analista de CRONISTA. Debes consultar herramientas antes de responder. Devuelve el JSON de oraciones con hechos recuperados. No inventes estadísticas, causas ni superioridad táctica. Adapta claridad a Fan y detalle a Analyst. Las herramientas son de lectura: nunca cambian el partido.`, tools: HERRAMIENTAS_ANALISTA, reasoning: { effort: "low" as const } };
}

/** El prefijo autoritativo fija el límite incluso si el agente solicita otro tick. */
export function herramientasAnalista(registro: RegistroArena, hastaTick: number) {
  if (!Number.isInteger(hastaTick) || hastaTick < 0 || hastaTick > registro.final.tick) throw new Error("Instante no publicado");
  const historial = registro.fotogramas.filter(f => f.tick <= hastaTick);
  const hechos = [...new Map(historial.flatMap(f => contextoNarradorArena(registro, f.tick)).map(h => [h.id, h])).values()];
  const eventos = new Map(registro.eventos.filter(e => e.tick <= hastaTick).map(e => [e.id, e]));
  const limites = (tick: number) => { if (tick > hastaTick) throw new Error("La herramienta no puede consultar el futuro"); };
  return { hechos, ejecutar(nombre: string, argumentos: string): HechoVerificable[] {
    const raw: unknown = JSON.parse(argumentos);
    if (nombre === "consultar_eventos") {
      const p = z.strictObject({ desdeTick: z.number().int().nonnegative(), hastaTick: z.number().int().nonnegative(), tipo: z.enum(["todos", "gol", "tiro"]) }).parse(raw);
      limites(p.hastaTick); if (p.desdeTick > p.hastaTick) throw new Error("Ventana invertida");
      return hechos.filter(h => h.eventos.some(id => { const e = eventos.get(id); return e && e.tick >= p.desdeTick && e.tick <= p.hastaTick && (p.tipo === "todos" || e.tipo === p.tipo); })).slice(-8);
    }
    if (nombre === "consultar_jugador") {
      const p = z.strictObject({ jugadorId: z.string().max(40), hastaTick: z.number().int().nonnegative() }).parse(raw); limites(p.hastaTick);
      if (![...registro.inicial.jugadores, ...registro.inicial.banco ?? []].some(j => j.id === p.jugadorId)) throw new Error("Jugador inexistente");
      return hechos.filter(h => h.eventos.some(id => { const e = eventos.get(id); return e && e.tick <= p.hastaTick && (e.jugador === p.jugadorId || e.receptor === p.jugadorId); })).slice(-8);
    }
    throw new Error("Herramienta no permitida");
  } };
}

export async function transporteFoundry(): Promise<TransporteAgente> {
  const endpoint = endpointAzure(process.env.AZURE_AI_PROJECT_ENDPOINT, ".services.ai.azure.com");
  const nombre = process.env.ARENA_AGENTE_NOMBRE, version = process.env.ARENA_AGENTE_VERSION;
  if (!nombre || !version) throw new Error("Falta versión del agente");
  const { AIProjectClient } = await import("@azure/ai-projects");
  const cliente = new AIProjectClient(endpoint, credencialAzure()).getOpenAIClient({ maxRetries: 0, timeout: 25_000 });
  return { id: `foundry-agent:${nombre}:${version}`, responder: (input, forzarHerramienta, signal) => cliente.post<RespuestaAgente>("/responses", { signal,
    body: { agent_reference: { type: "agent_reference", name: nombre, version }, input, tool_choice: forzarHerramienta ? "required" : "auto", max_output_tokens: 1600, store: false },
  }) };
}

export async function analizarArena(registro: RegistroArena, p: PeticionAnalista, transporte: TransporteAgente, signalExterno?: AbortSignal): Promise<ResultadoAnalista> {
  return trazar("arena.analisis", { "gen_ai.operation.name": "invoke_agent", "gen_ai.provider.name": "microsoft.foundry", "gen_ai.agent.id": transporte.id, "gen_ai.agent.name": process.env.ARENA_AGENTE_NOMBRE ?? "cronista-analista", "gen_ai.agent.version": process.env.ARENA_AGENTE_VERSION ?? "", "arena.sesion.id": p.sesion ?? "", "arena.tick": p.tick }, async () => ejecutarAnalisis(registro, p, transporte, signalExterno));
}
async function ejecutarAnalisis(registro: RegistroArena, p: PeticionAnalista, transporte: TransporteAgente, signalExterno?: AbortSignal): Promise<ResultadoAnalista> {
  const limite = Math.min(p.tick, registro.final.tick), herramientas = herramientasAnalista(registro, limite);
  const recuperados = new Map<string, HechoVerificable>(), llamadas: LlamadaHerramienta[] = [], audit: ComentarioArena["audit"] = [];
  const entrada: unknown[] = [{ role: "user", content: JSON.stringify({ pregunta: p.pregunta, jugador: p.jugador, audiencia: p.audiencia, hastaTick: limite, instruccion: "Consulta las acciones confirmadas que respondan a esta pregunta; devuelve hasta dos oraciones bilingües con sus IDs de hechos." }) }];
  const signal = AbortSignal.any([AbortSignal.timeout(30_000), ...(signalExterno ? [signalExterno] : [])]);
  let solicitudes = 0; const uso = { entrada: 0, salida: 0 };
  const principalInicial = contextoNarradorArena(registro, limite).at(-1);
  if (!principalInicial) return { tick: limite, agente: transporte.id, solicitudes, herramientas: llamadas, comentario: null, uso };
  let principal = principalInicial;
  for (let i = 0; i < 3; i++) {
    try {
      signal.throwIfAborted(); solicitudes++;
      const respuesta = await trazar("arena.agente", { "gen_ai.operation.name": "chat", "gen_ai.request.model": process.env.ARENA_AGENTE_MODELO ?? "cronista-rapido", "gen_ai.agent.id": transporte.id, "arena.tick": limite, "arena.intento": solicitudes }, async () => conCancelacion(() => transporte.responder(entrada, recuperados.size === 0, signal), signal));
      signal.throwIfAborted();
      uso.entrada += respuesta.usage?.input_tokens ?? 0; uso.salida += respuesta.usage?.output_tokens ?? 0;
      const tools = respuesta.output.filter(x => x.type === "function_call");
      if (tools.length) {
        if (tools.length > 4 || llamadas.length + tools.length > 6) throw new Error("Demasiadas herramientas");
        entrada.push(...respuesta.output);
        for (const tool of tools) {
          let seleccion: HechoVerificable[] = [], error: string | undefined;
          try { seleccion = await trazar("arena.herramienta", { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": tool.name ?? "desconocida", "arena.tick": limite }, async () => herramientas.ejecutar(tool.name ?? "", tool.arguments ?? "{}")); }
          catch { error = "Argumentos fuera del prefijo publicado o herramienta no permitida"; }
          seleccion.forEach(h => recuperados.set(h.id, h));
          llamadas.push({ nombre: tool.name ?? "", argumentos: (() => { try { return JSON.parse(tool.arguments ?? "{}"); } catch { return null; } })(), hechos: seleccion.map(h => h.id), ...(error ? { error } : {}) });
          entrada.push({ type: "function_call_output", call_id: tool.call_id, output: JSON.stringify({ hechos: seleccion, ...(error ? { error } : {}) }) });
        }
        continue;
      }
      const texto = respuesta.output_text ?? respuesta.output.flatMap(x => x.content ?? []).filter(x => x.type === "output_text").map(x => x.text ?? "").join("");
      const lista = [...recuperados.values()];
      let id: unknown; try { id = JSON.parse(texto).oraciones?.[0]?.hecho; } catch { /* valida V1 */ }
      principal = lista.find(h => h.id === id) ?? lista.at(-1) ?? principalInicial;
      const r = verificarUpdate(texto, lista, { config: registro.config.partido }, principal.id, 2);
      audit.push({ intento: solicitudes, oraciones: r.oraciones ?? [], motivos: r.motivos });
      if (lista.length && !r.motivos.length && r.oraciones) return { tick: limite, agente: transporte.id, solicitudes, herramientas: llamadas, uso, comentario: { tick: limite, modelo: transporte.id, modo: "llm", principal: principal.id, hechos: lista, oraciones: r.oraciones, audit } };
      entrada.push(...respuesta.output, { role: "user", content: `Corrige el JSON sin nuevas consultas: ${JSON.stringify(r.motivos)}. Cita un solo hecho recuperado por oración y solo datos presentes en él.` });
    } catch { audit.push({ intento: solicitudes, oraciones: [], motivos: [{ oracion: -1, regla: "V1", detalle: "Agente no disponible, cancelado o plazo agotado" }] }); break; }
  }
  const hechos = recuperados.size ? [...recuperados.values()] : [principalInicial];
  principal = hechos.find(h => h.id === principal.id) ?? hechos.at(-1)!;
  const oraciones = [{ texto_es: principal.texto_es, texto_en: principal.texto_en, hecho: principal.id, apoyo: [] }];
  if (verificarUpdate(JSON.stringify({ oraciones }), hechos, { config: registro.config.partido }, principal.id, 2).motivos.length) throw new Error("Respaldo del analista inválido");
  return { tick: limite, agente: transporte.id, solicitudes, herramientas: llamadas, uso, comentario: { tick: limite, modelo: transporte.id, modo: "plantilla", principal: principal.id, hechos, oraciones, audit } };
}
