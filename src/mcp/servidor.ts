// Brief 071 § 2.A · Servidor MCP de solo lectura de CRONISTA sobre partidos TERMINADOS. Tres herramientas:
//   list_matches       ejemplos archivados (`ARCHIVOS_EJEMPLO`) + encuentros de los torneos guardados (no en curso)
//   get_match_facts    la selección de `seleccionCronicaArena` (la misma que recibe el redactor) de un archivo, un
//                      encuentro de torneo o la huella de un registro guardado. Nunca `sesion` ni `registro`.
//   get_match_report   la crónica verificada YA guardada de una huella. Nunca genera: sin crónica → error legible con
//                      la URL de la página (botón «Match report»).
// Ninguna llamada a un LLM ni a Speech, ninguna escritura, ningún secreto ni variable de entorno en las respuestas.
// Lo usan la ruta `/api/mcp` (Streamable HTTP sin sesión: un servidor por petición) y el cronista (cliente in-process).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import paquete from "../../package.json";
import type { CronicaVerificada } from "../cadena/tipos";
import type { AlmacenTorneos } from "../arena/almacen-torneos";
import type { ArchivoCronica, ServicioCronicas } from "../arena/cronica";
import { huellaRegistro, leerRegistroGuardado } from "../arena/cronica-almacen";
import { ARCHIVOS_EJEMPLO, ErrorCronica, fuenteArchivo, fuenteHuella, fuenteTorneo, resolverFuente, type DepsFuentes } from "../arena/cronica-fuentes";
import { seleccionCronicaArena, type HechoCronicaArena } from "../arena/cronica-hechos";
import { urlCronica } from "../arena/cronica-vista";
import type { TorneoCualquiera } from "../arena/torneo";
import type { RegistroArena } from "../arena/tipos";
import { MCP_ARENA } from "../sim/limites";
import { estadoOracion, resumenVerificacion } from "../vista/evidencia";
import { z } from "zod";

export const NOMBRE_SERVIDOR_MCP = "cronista";
export const VERSION_SERVIDOR_MCP: string = (paquete as { version: string }).version;

/** Lo que el servidor necesita: lecturas del almacén de crónicas, las fuentes y la lectura sin coste del servicio. */
export interface DepsMcp {
  almacen: () => Promise<AlmacenTorneos>;
  fuentes: DepsFuentes;
  /** El servicio de crónicas del proceso; el servidor solo usa `leer` (lee y re-verifica, nunca genera ni escribe, 064 I7). */
  cronicas: Pick<ServicioCronicas, "leer">;
  /** Origen público (`https://…`) para dar URLs absolutas; sin él, rutas relativas. */
  origen?: string;
}

/** Fuente aceptada por `get_match_facts`: solo partidos terminados (sin `sesion` ni `registro`). */
export const esquemaFuenteMcp = z.union([fuenteArchivo, fuenteTorneo, fuenteHuella]);
export type FuenteMcp = z.infer<typeof esquemaFuenteMcp>;

export interface PartidoMcp {
  fuente: { archivo: keyof typeof ARCHIVOS_EJEMPLO } | { torneo: string; encuentro: string };
  equipos: { local: string; visita: string };
  marcador: { local: number; visita: number };
  reglas: string;
  duracionS: number;
}
export interface HechosMcp {
  huella: string;
  equipos: { local: string; visita: string };
  marcador: { local: number; visita: number };
  reglas: string;
  duracionS: number;
  /** Si la selección cabe en la entrada del redactor (si no, la crónica es un acta `tamano`). */
  cabe: boolean;
  /** `seleccionCronicaArena(registro).hechos`, tal cual: el hecho verificable (ids de evento incluidos) y su evidencia. */
  hechos: HechoCronicaArena[];
}

class ErrorHerramienta extends Error {}
const resultado = (datos: object): CallToolResult => ({ structuredContent: datos as Record<string, unknown>, content: [{ type: "text", text: JSON.stringify(datos) }] });
const error = (texto: string): CallToolResult => ({ isError: true, content: [{ type: "text", text: texto }] });
async function herramienta(f: () => Promise<object>): Promise<CallToolResult> {
  try { return resultado(await f()); }
  catch (e) {
    if (e instanceof ErrorHerramienta || e instanceof ErrorCronica) return error(e.message);
    console.warn("CRONISTA: herramienta MCP no disponible", { tipo: e instanceof Error ? e.name : "Error" });
    return error("The match store is not available right now; try again later.");
  }
}

const reglasDe = (r: RegistroArena): string => r.config.reglas ?? r.version;
const datosPartido = (r: RegistroArena) => ({
  equipos: { local: r.config.partido.local.nombre, visita: r.config.partido.visita.nombre },
  marcador: { local: r.final.marcador.local, visita: r.final.marcador.visita }, reglas: reglasDe(r), duracionS: r.config.duracionS,
});

// Los ejemplos son archivos estáticos del repositorio: se reproducen una vez por conjunto de fuentes (los fallos no se memorizan).
const memoEjemplos = new WeakMap<DepsFuentes, Map<string, Promise<RegistroArena>>>();
function registroEjemplo(fuentes: DepsFuentes, archivo: keyof typeof ARCHIVOS_EJEMPLO): Promise<RegistroArena> {
  let m = memoEjemplos.get(fuentes);
  if (!m) { m = new Map(); memoEjemplos.set(fuentes, m); }
  let p = m.get(archivo);
  if (!p) {
    p = resolverFuente({ archivo }, fuentes).then((x) => x.registro);
    p.catch(() => { if (m.get(archivo) === p) m.delete(archivo); });
    m.set(archivo, p);
  }
  return p;
}

const enCurso = (t: TorneoCualquiera) => t.estado === "en_curso";

/** `list_matches`: ejemplos y encuentros de torneos terminados, con el tope `MCP_ARENA.maxPartidosLista`. */
export async function listarPartidos(deps: DepsMcp): Promise<{ partidos: PartidoMcp[]; truncada: boolean }> {
  const partidos: PartidoMcp[] = [];
  for (const archivo of Object.keys(ARCHIVOS_EJEMPLO) as (keyof typeof ARCHIVOS_EJEMPLO)[]) {
    const r = await registroEjemplo(deps.fuentes, archivo).catch(() => null);
    if (r) partidos.push({ fuente: { archivo }, ...datosPartido(r) });
  }
  const torneos = (await deps.fuentes.listarTorneos?.().catch(() => [])) ?? [];
  for (const t of [...torneos].filter((x) => !enCurso(x)).sort((a, b) => b.inicioUtc.localeCompare(a.inicioUtc) || a.id.localeCompare(b.id))) {
    for (const e of [...t.encuentros].sort((a, b) => a.n - b.n)) {
      partidos.push({
        fuente: { torneo: t.id, encuentro: String(e.n).padStart(2, "0") },
        equipos: { local: e.local.club, visita: e.visita.club }, marcador: { local: e.local.goles, visita: e.visita.goles },
        reglas: t.motor.reglas, duracionS: t.duracionS,
      });
    }
  }
  return { partidos: partidos.slice(0, MCP_ARENA.maxPartidosLista), truncada: partidos.length > MCP_ARENA.maxPartidosLista };
}

/** Selección de hechos de una fuente ya admitida (sin memoria). */
async function calcularHechos(deps: DepsMcp, fuente: FuenteMcp): Promise<HechosMcp> {
  let registro: RegistroArena, huella: string;
  if ("huella" in fuente) {
    const r = await leerRegistroGuardado(await deps.almacen(), fuente.huella);
    if (!r) throw new ErrorHerramienta(`No saved match with fingerprint ${fuente.huella}. Use list_matches to find one.`);
    registro = r; huella = fuente.huella;
  } else {
    registro = "torneo" in fuente ? (await resolverFuente(fuente, deps.fuentes)).registro : await registroEjemplo(deps.fuentes, fuente.archivo);
    huella = huellaRegistro(registro);
  }
  const { hechos, cabe } = seleccionCronicaArena(registro);
  return { huella, ...datosPartido(registro), cabe, hechos };
}

// Revisión Codex (071) · LRU por proceso y por conjunto de fuentes (MCP_ARENA.memoHechos): un partido terminado no
// cambia (la huella es su SHA-256; los encuentros de torneo se validan por SHA-256), así que repetir la consulta no
// vuelve a leer ni a reproducir el registro. Solo se memoriza un resultado ya obtenido (nunca un fallo ni una lectura
// pendiente que pudiera quedarse colgada); cada llamada recibe una copia.
const memoHechos = new WeakMap<DepsFuentes, Map<string, HechosMcp>>();
const claveFuenteMcp = (f: FuenteMcp) => ("huella" in f ? `h:${f.huella}` : "torneo" in f ? `t:${f.torneo}:${f.encuentro}` : `a:${f.archivo}`);

/** `get_match_facts`: la selección de hechos de un partido terminado (la misma función que usa el redactor). */
export async function hechosDePartido(deps: DepsMcp, fuente: FuenteMcp): Promise<HechosMcp> {
  if ("torneo" in fuente) {
    const t = await deps.fuentes.torneo(fuente.torneo);
    if (t && enCurso(t)) throw new ErrorHerramienta("That tournament is still in progress; only finished tournaments are served.");
  }
  let memo = memoHechos.get(deps.fuentes);
  if (!memo) { memo = new Map(); memoHechos.set(deps.fuentes, memo); }
  const clave = claveFuenteMcp(fuente);
  let h = memo.get(clave);
  if (h) memo.delete(clave);
  else h = await calcularHechos(deps, fuente);
  memo.set(clave, h);
  while (memo.size > MCP_ARENA.memoHechos) memo.delete(memo.keys().next().value!);
  return structuredClone(h);
}

const autorDe = (a: ArchivoCronica) => a.cronica.modo === "acta"
  ? { tipo: "acta", etiqueta: "Deterministic record (no language model)" }
  : { tipo: "modelo", etiqueta: a.redactor?.etiqueta ?? "", fixture: a.redactor?.fixture ?? false };

/** `get_match_report`: la crónica verificada guardada. Nunca genera ni escribe (usa la lectura del servicio). */
export async function informeGuardado(deps: DepsMcp, huella: string): Promise<object> {
  const url = `${deps.origen ?? ""}${urlCronica(huella)}`;
  const l = await deps.cronicas.leer(huella);
  if (!l) throw new ErrorHerramienta(`No saved match with fingerprint ${huella}. This server never writes reports; use list_matches and get_match_facts.`);
  if (l.estado !== "lista" || !l.archivo) {
    throw new ErrorHerramienta(`No verified match report is saved for this match (state: ${l.estado}). This server never writes reports: open ${url} and press "Match report" to write it, then call get_match_report again.`);
  }
  const a = l.archivo, c: CronicaVerificada = a.cronica, v = resumenVerificacion(c);
  return {
    huella, url, estado: l.estado, modo: c.modo, provisional: a.provisional, ...(a.motivoActa ? { motivoActa: a.motivoActa } : {}),
    autor: autorDe(a), generadaUtc: a.generadaUtc, ...(a.hechosVia ? { hechosVia: a.hechosVia } : {}),
    titulo: { es: c.titulo_es, en: c.titulo_en },
    frases: c.oraciones.map((o, i) => ({ es: o.texto_es, en: o.texto_en, hecho: o.hecho, apoyo: o.apoyo ?? [], estado: estadoOracion(c, i) })),
    verificacion: { reglas: "V1-V8", frases: v.oraciones, intentos: v.intentos, corregidas: v.corregidas, omitidas: v.omitidas },
  };
}

const SOLO_LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

/** Un `McpServer` nuevo con las tres herramientas (sin sesión: uno por petición HTTP o por conexión in-process). */
export function crearServidorMcp(deps: DepsMcp): McpServer {
  const s = new McpServer({ name: NOMBRE_SERVIDOR_MCP, version: VERSION_SERVIDOR_MCP }, {
    instructions: "Read-only access to FINISHED synthetic matches of the CRONISTA arena (fictional teams and players). list_matches → get_match_facts (the exact facts the match-report writer receives, with event ids) → get_match_report (only if a verified report is already saved; this server never generates).",
  });
  s.registerTool("list_matches", {
    title: "List finished matches",
    description: `Finished synthetic matches available: the archived examples and the matches of saved model tournaments (never live ones). Each item has its "fuente" (pass it to get_match_facts), teams, score, rules and duration in seconds. At most ${MCP_ARENA.maxPartidosLista} items.`,
    annotations: SOLO_LECTURA,
  }, () => herramienta(() => listarPartidos(deps)));
  s.registerTool("get_match_facts", {
    title: "Get the verifiable facts of a finished match",
    description: "The deterministic fact selection the CRONISTA writer receives for a finished match: each fact with its bilingual text, its data and the ids of the engine events that support it, plus the match fingerprint (huella), teams, score and rules. fuente: { archivo } | { torneo, encuentro } | { huella } (from list_matches or a report URL). Live sessions and uploaded logs are not accepted.",
    inputSchema: { fuente: esquemaFuenteMcp },
    annotations: SOLO_LECTURA,
  }, ({ fuente }) => herramienta(() => hechosDePartido(deps, fuente)));
  s.registerTool("get_match_report", {
    title: "Get a saved verified match report",
    description: "The verified bilingual (ES/EN) match report already saved for a match fingerprint: sentences with their fact ids and state, the labelled author and the verification summary. Never writes a report: if none is saved, the error gives the page URL where a person can request it.",
    inputSchema: { huella: fuenteHuella.shape.huella },
    annotations: SOLO_LECTURA,
  }, ({ huella }) => herramienta(() => informeGuardado(deps, huella)));
  return s;
}
