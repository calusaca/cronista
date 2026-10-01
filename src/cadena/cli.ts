// CLI de la crónica: `npm run cronica -- --seed 42 [--modo acta] [--json] [--sin-cache]`
// Imprime la crónica verificada con sus citas (oración → hechos → eventos).
// El LLM se elige por CRONISTA_LLM (stub por defecto); un .env en la raíz se carga si existe.

import { existsSync } from "node:fs";
import { crearLlmDesdeEnv } from "../lib/llm";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import { crearCacheDisco, directorioPorDefecto } from "./cache";
import { generarCronica } from "./cadena";
import { parsearArgsCronica } from "./cli-args";

const USO = "uso: npm run cronica -- [--seed <entero 0..4294967295>] [--modo llm|acta] [--perspectiva neutral|local|visita] [--json] [--sin-cache]";

async function main(): Promise<void> {
  const args = parsearArgsCronica(process.argv.slice(2));
  if (!args.ok) {
    console.error(`error: ${args.error}`);
    console.error(USO);
    process.exit(1);
  }
  const { seed, modo, json, sinCache, perspectiva } = args.opciones;
  if (existsSync(".env")) process.loadEnvFile(".env");

  // El acta no llama al LLM: se resuelve ANTES de validar su configuración (rev. 3.1),
  // así `--modo acta` funciona aunque CRONISTA_LLM=foundry no tenga credenciales.
  const llm = modo === "acta" ? undefined : crearLlmDesdeEnv();
  const partido = simular(configDeSemilla(seed));
  const { cronica, hechos, desdeCache } = await generarCronica(partido, {
    ...(llm ? { llm } : {}),
    forzarActa: modo === "acta",
    modoPersonalizacion: perspectiva === "neutral" ? "neutral" : `equipo:${perspectiva}`,
    ...(sinCache ? {} : { cache: crearCacheDisco() }),
  });

  if (json) {
    console.log(JSON.stringify({ cronica, hechos }, null, 2));
    return;
  }

  const porHecho = new Map(hechos.map((h) => [h.id, h] as const));
  const linea = "─".repeat(78);
  console.log(linea);
  console.log(`CRONISTA · crónica verificada · semilla ${seed}${perspectiva === "neutral" ? "" : ` · para la afición de ${perspectiva === "local" ? partido.config.local.nombre : partido.config.visita.nombre}`}`);
  console.log(
    `modo ${cronica.modo} · ${llm ? `LLM ${llm.id}` : "sin LLM (acta pedida)"} · intentos ${cronica.intentos} · frases omitidas ${cronica.frasesOmitidas}` +
      (desdeCache ? ` · desde caché (${directorioPorDefecto()})` : ""),
  );
  console.log(linea);
  console.log(`ES  ${cronica.titulo_es}`);
  console.log(`EN  ${cronica.titulo_en}`);
  console.log(linea);
  cronica.oraciones.forEach((o, i) => {
    console.log(`${String(i + 1).padStart(2)}. ES  ${o.texto_es}`);
    console.log(`    EN  ${o.texto_en}`);
    const cita = (id: string) => `${id} (${porHecho.get(id)?.tipo ?? "?"}: ${porHecho.get(id)?.eventos.join(" ") ?? ""})`;
    console.log(`    ↳ ${cita(o.hecho)}`);
    if (o.apoyo && o.apoyo.length > 0) console.log(`      apoyo: ${o.apoyo.join(", ")}`);
  });
  console.log(linea);
  console.log("Historia (006):");
  if (cronica.audit.length === 0) console.log("  sin intentos del LLM (acta pedida directamente)");
  for (const a of cronica.audit) {
    console.log(`  intento ${a.n}: ${a.veredicto.length === 0 ? "aprobado" : `${a.veredicto.length} motivo(s) — ${a.veredicto.map((m) => m.regla).join(", ")}`}`);
  }
  console.log(linea);
}

main().catch((e: unknown) => {
  console.error(`error: ${(e as Error).message}`);
  process.exit(1);
});
