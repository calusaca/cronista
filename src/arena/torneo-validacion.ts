// Brief 059 v1.2 — Validación compartida de los partidos contra sus archivos (§ 15.5, § 16.1): huella SHA-256 del
// archivo íntegro, descompresión acotada, reproducción con el motor, configuración completa prescrita por el plan,
// clubes, goles, controladores, cifras 049 recalculadas y lo declarado que consta en el archivo. Usa `node:zlib`,
// `node:crypto` y el motor: solo servidor, CLI y CI. Lo puro y apto para el cliente está en `torneo.ts`.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { ARENA, TORNEO_SITIO } from "../sim/limites";
import { planTorneo, validarMetadatos062 } from "./torneo-formatos";
import type { Lado } from "../sim/tipos";
import { reproducirArena } from "./coordinador";
import { cifrasEquipos, pasesIntentados, type ClaveCifraEquipo } from "./estadisticas";
import { crearConfigArena } from "./motor";
import { archivoEncuentro, calendarioTorneo, esquemaEncuentro, esquemaIndice, esquemaTorneoCualquiera, LADOS_TORNEO, validarCoherencia,
  type CifrasLado, type DeclaradoLado, type EjecutorEncuentro, type EncuentroPlan, type EncuentroTorneo, type LadoEncuentro, type MarcoTorneo,
  type ParticipanteTorneo, type TorneoCualquiera } from "./torneo";
import type { ConfigArena, RegistroArena, ReglasArena, VersionArena } from "./tipos";

export const sha256 = (datos: Uint8Array | string) => createHash("sha256").update(datos).digest("hex");
// ---------------------------------------------------------------------------------------------------
// Cifras del 049 recalculadas desde el registro (nunca las estimadas `igr` ni `remates_cercanos`).
// ---------------------------------------------------------------------------------------------------
export function cifrasDeRegistro(registro: RegistroArena): Record<Lado, CifrasLado> {
  const tick = registro.final.tick, panel = cifrasEquipos(registro, tick), intentados = pasesIntentados(registro, tick);
  const fila = (clave: ClaveCifraEquipo) => { const f = panel.filas.find(x => x.clave === clave); if (!f) throw new Error(`Cifra ${clave} ausente del panel`); return f; };
  const de = (lado: Lado): CifrasLado => ({
    posesionPct: fila("posesion_pct")[lado].valor, remates: fila("remates")[lado].valor, rematesDirectos: fila("remates_directos")[lado].valor,
    pasesCompletados: fila("pases_completados")[lado].valor, pasesIntentados: intentados[lado], recuperaciones: fila("recuperaciones")[lado].valor,
  });
  return { local: de("local"), visita: de("visita") };
}

/** § 16.1 · La configuración que el plan prescribe: la MISMA llamada en el CLI y en la validación. */
export function configDelPlan(plan: Pick<EncuentroPlan, "seed">, t: MarcoTorneo): ConfigArena {
  return crearConfigArena({ seed: plan.seed, duracionS: t.duracionS, intervaloS: t.intervaloS, version: t.motor.version as VersionArena, reglas: t.motor.reglas as ReglasArena });
}

/** Lo que consta en el archivo por lado (tiempos, solicitudes y motivos de cada decisión). */
export function constaEnArchivo(registro: RegistroArena, lado: Lado): Pick<DeclaradoLado, "tiemposMs" | "llamadas" | "motivos"> {
  const ds = registro.rondas.map(r => r.decisiones[lado]);
  return { tiemposMs: ds.map(d => d.tiempoMs), llamadas: ds.map(d => d.llamadas ?? 0), motivos: ds.map(d => d.motivo) };
}

/** Partido archivado a partir de lo declarado por el ejecutor y del registro (el CLI lo usa para saber si un
 * partido está hecho; validarEncuentro sigue contrastándolo todo contra el archivo). */
export function encuentroDesdeEjecutor(ej: EjecutorEncuentro, plan: EncuentroPlan, registro: RegistroArena): EncuentroTorneo {
  const cifras = cifrasDeRegistro(registro);
  const lado = (l: Lado): LadoEncuentro => ({ participante: plan[l], club: registro.config.partido[l].nombre, goles: registro.final.marcador[l], cifras: cifras[l], declarado: ej[l] });
  return { n: plan.n, jornada: plan.jornada, cruce: plan.cruce, vuelta: plan.vuelta, seed: plan.seed, archivo: archivoEncuentro(plan.n), archivoSha256: ej.archivoSha256, intento: ej.intento, local: lado("local"), visita: lado("visita") };
}

/** Descomprime un registro sin agotar memoria (como mucho ARENA.archivoMaxBytes). */
export function descomprimirRegistro(bytesGz: Uint8Array): unknown {
  let textoJson: string;
  try { textoJson = gunzipSync(bytesGz, { maxOutputLength: ARENA.archivoMaxBytes }).toString("utf8"); }
  catch { throw new Error(`Registro comprimido ilegible o mayor que ${ARENA.archivoMaxBytes} bytes`); }
  return JSON.parse(textoJson) as unknown;
}

/** § 15.5 + § 16.1 · Validación de un partido contra su archivo íntegro. Lanza ante cualquier desajuste y
 * devuelve el registro reproducido. La comprueban el CLI (antes de dar un partido por hecho y al escribir
 * `torneo.json`) y CI. */
export function validarEncuentro(e: EncuentroTorneo, plan: EncuentroPlan, participantes: readonly ParticipanteTorneo[], bytesGz: Uint8Array, t: MarcoTorneo): RegistroArena {
  esquemaEncuentro.parse(e);
  // 1. Huella del archivo íntegro tal como se publica.
  if (sha256(bytesGz) !== e.archivoSha256) throw new Error(`P${e.n}: la huella SHA-256 del archivo no coincide`);
  if (e.archivo !== archivoEncuentro(plan.n)) throw new Error(`P${e.n}: nombre de archivo inesperado`);
  if (e.n !== plan.n || e.jornada !== plan.jornada || e.cruce !== plan.cruce || e.vuelta !== plan.vuelta || e.seed !== plan.seed || e.local.participante !== plan.local || e.visita.participante !== plan.visita) throw new Error(`P${e.n}: el partido no coincide con el calendario`);
  // 2. Descompresión acotada y reproducción con el motor.
  const raw = descomprimirRegistro(bytesGz);
  const registro = reproducirArena(raw);
  // 3–4 (§ 16.1). Configuración COMPLETA igual a la prescrita por el plan (JSON: el archivo es JSON).
  const esperada = JSON.parse(JSON.stringify(configDelPlan(plan, t))) as unknown;
  if (!isDeepStrictEqual((raw as { config: unknown }).config, esperada)) throw new Error(`P${e.n}: configuración distinta de la prescrita por el plan`);
  const cifras = cifrasDeRegistro(registro);
  for (const lado of LADOS_TORNEO) {
    const l = e[lado], p = participantes.find(x => x.id === l.participante);
    if (!p) throw new Error(`P${e.n}: participante ${l.participante} ausente`);
    if (l.club !== registro.config.partido[lado].nombre) throw new Error(`P${e.n}: club ${lado} distinto del registro`);
    // 5. Cada decisión de ese lado lleva el controlador del participante que el plan pone ahí.
    if (!registro.rondas.every(r => r.decisiones[lado].controlador === p.controlador)) throw new Error(`P${e.n}: controlador ${lado} distinto del participante`);
    // 6. Goles.
    if (l.goles !== registro.final.marcador[lado]) throw new Error(`P${e.n}: goles ${lado} distintos del registro`);
    // 7. Cifras 049 recalculadas.
    if (!isDeepStrictEqual(l.cifras, cifras[lado])) throw new Error(`P${e.n}: cifras ${lado} distintas de las recalculadas`);
    // 8. Lo declarado que consta en el archivo.
    const consta = constaEnArchivo(registro, lado);
    if (!isDeepStrictEqual(l.declarado.tiemposMs, consta.tiemposMs) || !isDeepStrictEqual(l.declarado.llamadas, consta.llamadas) || !isDeepStrictEqual(l.declarado.motivos, consta.motivos)) throw new Error(`P${e.n}: tiempos, solicitudes o motivos ${lado} distintos del archivo`);
  }
  return registro;
}

/** Valida el esquema, la coherencia y cada partido contra su `.gz` (leído con `leer(archivo)`). */
export function validarTorneo(raw: unknown, leer: (archivo: string) => Uint8Array): TorneoCualquiera {
  const t = esquemaTorneoCualquiera.parse(raw);
  const errores = validarCoherencia(t);
  if (errores.length) throw new Error(`Torneo ${t.id} incoherente: ${errores.join("; ")}`);
  if (t.version === TORNEO_SITIO.version) {
    // Brief 062 § 17.3 · `plan[e.n − 1]` sale de planTorneo reconstruido; por encuentro, metadatos (puro) y base.
    const plan = planTorneo(t.formato, t.participantes.map(p => p.id), t.semilla, t);
    for (const e of t.encuentros) validarEncuentro(validarMetadatos062(e, plan[e.n - 1]!), plan[e.n - 1]!, t.participantes, leer(e.archivo), t);
    return t;
  }
  const plan = calendarioTorneo(t.participantes.map(p => p.id), t.semilla);
  if (t.encuentros.length + t.pendientes.length !== plan.length) throw new Error("Encuentros más pendientes distintos del plan");
  if (t.tipo === "real" && plan.length !== t.participantes.length * (t.participantes.length - 1)) throw new Error("Un torneo real juega ida y vuelta completa");
  for (const e of t.encuentros) validarEncuentro(e, plan[e.n - 1]!, t.participantes, leer(e.archivo), t);
  return t;
}

/** Revisión Codex (#1) · Todo lo publicado en una raíz de torneos (`public/torneos` o el fixture): los directorios
 * coinciden EXACTAMENTE con `indice.json` (ni huérfanos ni entradas sin directorio), cada directorio contiene solo
 * `torneo.json` y los `eNN.json.gz` de sus encuentros, y cada torneo supera `validarTorneo` con su id, fecha y
 * título iguales a los del índice. Lanza ante el primer desajuste; devuelve los torneos en el orden del índice. */
export function validarRaizTorneos(raiz: string): TorneoCualquiera[] {
  const entradas = existsSync(raiz) ? readdirSync(raiz, { withFileTypes: true }) : [];
  const dirs = entradas.filter(x => x.isDirectory()).map(x => x.name).sort();
  const sueltos = entradas.filter(x => !x.isDirectory() && x.name !== "indice.json").map(x => x.name);
  if (sueltos.length) throw new Error(`Archivos inesperados en ${raiz}: ${sueltos.join(", ")}`);
  if (!existsSync(join(raiz, "indice.json"))) { if (dirs.length) throw new Error(`${raiz}: torneos sin indice.json`); return []; }
  const indice = esquemaIndice.parse(JSON.parse(readFileSync(join(raiz, "indice.json"), "utf8")));
  const ids = indice.map(x => x.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${raiz}/indice.json: ids repetidos`);
  const ordenado = [...indice].sort((a, b) => b.inicioUtc.localeCompare(a.inicioUtc) || a.id.localeCompare(b.id));
  if (ordenado.some((x, i) => x.id !== indice[i]!.id)) throw new Error(`${raiz}/indice.json: no está ordenado por inicioUtc descendente`);
  const huerfanos = dirs.filter(d => !ids.includes(d)), ausentes = ids.filter(id => !dirs.includes(id));
  if (huerfanos.length) throw new Error(`Torneos huérfanos (sin entrada en indice.json): ${huerfanos.join(", ")}`);
  if (ausentes.length) throw new Error(`Entradas de indice.json sin directorio: ${ausentes.join(", ")}`);
  return indice.map(entrada => {
    const dir = join(raiz, entrada.id);
    const t = validarTorneo(JSON.parse(readFileSync(join(dir, "torneo.json"), "utf8")), archivo => readFileSync(join(dir, archivo)));
    if (t.id !== entrada.id || t.inicioUtc !== entrada.inicioUtc || t.titulo.es !== entrada.titulo.es || t.titulo.en !== entrada.titulo.en) throw new Error(`${entrada.id}: id, fecha o título distintos del índice`);
    const esperados = ["torneo.json", ...t.encuentros.map(e => e.archivo)].sort(), presentes = readdirSync(dir).sort();
    if (esperados.join() !== presentes.join()) throw new Error(`${entrada.id}: archivos distintos de los del torneo (${presentes.filter(x => !esperados.includes(x)).join(", ") || "faltan"})`);
    return t;
  });
}
