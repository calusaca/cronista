import { crearControladorProgramado } from "./controladores";
import { ejecutarArena, reproducirArena } from "./coordinador";
import { crearConfigArena } from "./motor";
import { almacenBlob, almacenLocal } from "./almacen";
import type { AlmacenArena } from "./almacen";
import { datasetEvaluacionArena } from "./inteligencia";
import { evaluarNarracionArena } from "./evaluacion";
import { crearLlmDesdeEnv } from "../lib/llm";
import { trazar } from "../lib/telemetria";
import { z } from "zod";

export const esquemaLote = z.strictObject({ id: z.string().regex(/^[a-z0-9-]{1,60}$/), semillas: z.array(z.number().int().nonnegative().max(4294967295)).min(1).max(24), segundos: z.number().int().min(15).max(180), ventanas: z.number().int().min(1).max(4), narrar: z.boolean(), maxSolicitudes: z.number().int().min(0).max(32) });
export type ConfigLote = z.infer<typeof esquemaLote>;
export async function ejecutarLote(raw: ConfigLote, almacen?: AlmacenArena) {
  const p = esquemaLote.parse(raw);
  if (new Set(p.semillas).size !== p.semillas.length || p.narrar && p.semillas.length * p.ventanas * 2 > p.maxSolicitudes) throw new Error("Lote repetido o fuera del presupuesto de inferencia");
  const a = almacen ?? (process.env.ARENA_BLOB_ENDPOINT ? await almacenBlob(process.env.ARENA_BLOB_ENDPOINT, process.env.ARENA_BLOB_CONTENEDOR ?? "arena", `lotes/${p.id}/`) : almacenLocal(`.cache/arena-lotes/${p.id}`));
  await a.iniciar(); const bloqueo = await a.bloquear();
  try {
    let manifiesto: { config: ConfigLote; semillas: Record<string, "pendiente" | "completa"> };
    try { manifiesto = JSON.parse(await a.leer("manifiesto.json")); }
    catch (error) { if ((error as { code?: string }).code === "ENOENT" || (error as { statusCode?: number }).statusCode === 404) { manifiesto = { config: p, semillas: {} }; await a.escribir("manifiesto.json", JSON.stringify(manifiesto), true); } else throw error; }
    if (JSON.stringify(manifiesto.config) !== JSON.stringify(p)) throw new Error("Un ID de lote no puede cambiar su configuración");
    const informes = [];
    for (const seed of p.semillas) {
      if (!bloqueo.vigente()) throw new Error("Se perdió la coordinación del lote");
      if (manifiesto.semillas[seed] === "pendiente") throw new Error("Semilla interrumpida: revisar el gasto antes de volver a ejecutar con otro ID");
      if (manifiesto.semillas[seed] === "completa") { informes.push(JSON.parse(await a.leer(`informe-${seed}.json`))); continue; }
      manifiesto.semillas[seed] = "pendiente"; await a.escribir("manifiesto.json", JSON.stringify(manifiesto));
      const informe = await trazar("arena.lote.semilla", { "arena.lote.id": p.id, "arena.seed": seed }, async () => {
        const registro = await ejecutarArena(crearConfigArena({ seed, duracionS: p.segundos }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
        reproducirArena(registro);
        const evaluacion = p.narrar ? await evaluarNarracionArena(registro, crearLlmDesdeEnv(process.env, { maxRetries: 0 }), { maxVentanas: p.ventanas }) : null;
        const filas = evaluacion?.filas ?? datasetEvaluacionArena(registro, 15).slice(0, p.ventanas);
        if (!bloqueo.vigente()) throw new Error("Se perdió la coordinación antes de guardar");
        await a.escribir(`dataset-${seed}.jsonl`, filas.map(f => JSON.stringify(f)).join("\n") + "\n", true);
        if (evaluacion) await a.escribir(`evaluacion-${seed}.json`, JSON.stringify(evaluacion), true);
        return { seed, reproducido: true, marcador: registro.final.marcador, eventos: registro.eventos.length, filas: filas.length, modo: evaluacion ? "narrador_real_sobre_motor_programado" : "sin_inferencia", uso: evaluacion?.uso ?? null };
      });
      await a.escribir(`informe-${seed}.json`, JSON.stringify(informe), true);
      manifiesto.semillas[seed] = "completa"; await a.escribir("manifiesto.json", JSON.stringify(manifiesto)); informes.push(informe);
    }
    const resultado = { id: p.id, config: p, informes, completadoUtc: new Date().toISOString() };
    await a.escribir("resultado.json", JSON.stringify(resultado)); return resultado;
  } finally { await bloqueo.liberar(); }
}
