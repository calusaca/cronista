import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { planProgramado, validarOrdenes } from "./controladores";
import { crearEstadoArena, datosEquipos, MotorArena, validarConfigArena } from "./motor";
import { lados, type ConfigArena, type ControladorEquipo, type DecisionArena, type ObservacionArena, type RegistroArena, type RondaArena } from "./tipos";

function congelar<T>(obj: T): T {
  if (typeof obj === "object" && obj !== null && !Object.isFrozen(obj)) {
    for (const v of Object.values(obj)) congelar(v);
    Object.freeze(obj);
  }
  return obj;
}
export function observarArena(motor: MotorArena, lado: Lado): ObservacionArena {
  const publico = {
    estado: structuredClone(motor.estado), equipos: datosEquipos(motor.config),
    condiciones: structuredClone(motor.config.partido.condiciones ?? null),
    recientes: structuredClone(motor.eventos.slice(-10)),
  };
  const id = createHash("sha256").update(JSON.stringify(publico)).digest("hex");
  return congelar({ id, lado, tiempoS: motor.estado.tick * ARENA.pasoS, horizonteS: motor.config.intervaloS, ...publico });
}

async function decidir(controlador: ControladorEquipo, obs: ObservacionArena, esperaMs: number, signal?: AbortSignal): Promise<DecisionArena> {
  const inicio = performance.now(), cancelacion = new AbortController();
  let agotado = false;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let detener: (() => void) | undefined;
  const plazo = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => { agotado = true; cancelacion.abort(); rechazar(new Error("plazo")); }, esperaMs);
    detener = () => { cancelacion.abort(); rechazar(new DOMException("Cancelado", "AbortError")); };
    signal?.addEventListener("abort", detener, { once: true });
    if (signal?.aborted) detener();
  });
  let motivo: DecisionArena["motivo"] = "valida";
  try {
    const raw = await Promise.race([Promise.resolve().then(() => {
      cancelacion.signal.throwIfAborted();
      return controlador.decidir(obs, cancelacion.signal);
    }), plazo]);
    let ordenes;
    try { ordenes = validarOrdenes(raw, obs); } catch { motivo = "orden_invalida"; }
    if (ordenes) return { controlador: controlador.id, tipo: controlador.tipo, origen: "controlador", motivo, tiempoMs: performance.now() - inicio, ordenes };
  } catch {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    motivo = agotado ? "plazo_agotado" : "error_controlador";
  } finally {
    clearTimeout(temporizador);
    if (detener) signal?.removeEventListener("abort", detener);
  }
  return { controlador: controlador.id, tipo: controlador.tipo, origen: "respaldo", motivo, tiempoMs: performance.now() - inicio, ordenes: planProgramado(obs) };
}

export async function ejecutarArena(config: ConfigArena, controladores: Record<Lado, ControladorEquipo>, opciones: { esperaMs?: number; signal?: AbortSignal; alProgreso?: (ronda: RondaArena) => void } = {}): Promise<RegistroArena> {
  validarConfigArena(config);
  const esperaMs = opciones.esperaMs ?? ARENA.esperaMs;
  if (!Number.isFinite(esperaMs) || esperaMs <= 0 || esperaMs > ARENA.esperaMaxMs) throw new Error("Plazo de arena inválido");
  const motor = new MotorArena(config);
  const inicial = structuredClone(motor.estado), rondas: RondaArena[] = [];
  const total = Math.round(config.duracionS / ARENA.pasoS);
  while (motor.estado.tick < total) {
    opciones.signal?.throwIfAborted();
    const inicioTick = motor.estado.tick;
    // Ambas observaciones se construyen ANTES de invocar a cualquier controlador.
    const observaciones = { local: observarArena(motor, "local"), visita: observarArena(motor, "visita") };
    const [local, visita] = await Promise.all(lados.map(lado => decidir(controladores[lado], observaciones[lado], esperaMs, opciones.signal)));
    const decisiones = { local: local!, visita: visita! };
    const finTick = Math.min(total, inicioTick + Math.round(config.intervaloS / ARENA.pasoS));
    motor.avanzar({ local: decisiones.local.ordenes, visita: decisiones.visita.ordenes }, finTick);
    const ronda = { observacion: observaciones.local.id, inicioTick, finTick, decisiones };
    rondas.push(ronda); opciones.alProgreso?.(ronda);
  }
  return { version: ARENA.version, config: structuredClone(config), inicial, rondas, eventos: motor.eventos, fotogramas: motor.fotogramas, final: structuredClone(motor.estado) };
}

const esquemaDecision = z.strictObject({
  controlador: z.string().min(1).max(200), tipo: z.enum(["programado", "llm"]),
  origen: z.enum(["controlador", "respaldo"]), motivo: z.enum(["valida", "orden_invalida", "error_controlador", "plazo_agotado"]),
  tiempoMs: z.number().min(0), ordenes: z.unknown(),
});
const esquemaArchivo = z.strictObject({
  version: z.literal(ARENA.version), config: z.unknown(), inicial: z.unknown(),
  rondas: z.array(z.strictObject({ observacion: z.string().max(80), inicioTick: z.number().int().min(0), finTick: z.number().int().min(1), decisiones: z.strictObject({ local: esquemaDecision, visita: esquemaDecision }) })).min(1).max(ARENA.maxRondas),
  eventos: z.unknown(), fotogramas: z.unknown(), final: z.unknown(),
});

/** Recalcula todo desde configuración + órdenes. Valida los resultados del archivo
 * contra el motor versionado; no autentica quién produjo esas órdenes. */
export function reproducirArena(raw: unknown): RegistroArena {
  const entrada = esquemaArchivo.parse(raw);
  const config = entrada.config as ConfigArena;
  validarConfigArena(config);
  const inicial = crearEstadoArena(config);
  if (!isDeepStrictEqual(inicial, entrada.inicial)) throw new Error("El estado inicial no coincide con la configuración");
  const motor = new MotorArena(config), rondas: RondaArena[] = [];
  const total = Math.round(config.duracionS / ARENA.pasoS);
  for (const r of entrada.rondas) {
    const finTick = Math.min(total, motor.estado.tick + Math.round(config.intervaloS / ARENA.pasoS));
    if (r.inicioTick !== motor.estado.tick || r.finTick !== finTick) throw new Error("Secuencia de reloj alterada");
    const decisiones = {} as RondaArena["decisiones"];
    for (const lado of lados) {
      const obs = observarArena(motor, lado);
      if (r.observacion !== obs.id) throw new Error("Observación archivada alterada");
      const d = r.decisiones[lado], ordenes = validarOrdenes(d.ordenes, obs);
      if ((d.origen === "controlador") !== (d.motivo === "valida")) throw new Error("Procedencia de la decisión incoherente");
      if (d.origen === "respaldo" && !isDeepStrictEqual(ordenes, planProgramado(obs))) throw new Error("Respaldo archivado alterado");
      decisiones[lado] = { ...d, ordenes };
    }
    motor.avanzar({ local: decisiones.local.ordenes, visita: decisiones.visita.ordenes }, finTick);
    rondas.push({ ...r, decisiones });
  }
  if (motor.estado.tick !== total) throw new Error("Registro incompleto");
  if (!isDeepStrictEqual(motor.eventos, entrada.eventos) || !isDeepStrictEqual(motor.fotogramas, entrada.fotogramas) || !isDeepStrictEqual(motor.estado, entrada.final)) throw new Error("El registro no coincide con la reproducción del motor");
  return { version: ARENA.version, config: structuredClone(config), inicial, rondas, eventos: motor.eventos, fotogramas: motor.fotogramas, final: structuredClone(motor.estado) };
}
