import type { ComentarioArena } from "./narrador";
import { credencialAzure, endpointAzure } from "../lib/azure";
import { trazar } from "../lib/telemetria";
import { createHash } from "node:crypto";
import type { FragmentoVoz, TipoTramoCanto } from "./expresion";
import type { RegistroArena } from "./tipos";
import { CANTO_GOL, MESA_ARENA } from "../sim/limites";

export const VERSION_VOZ = "voz-expresiva-v1";
const formato = "audio-24khz-48kbitrate-mono-mp3";
// Intersección comprobada con /voices/list del recurso real; estilos publicados
// en la documentación general pueden no estar disponibles en esta región.
// Brief 045: voces del comentarista y del estadista consultadas el 20 de octubre.
const estilosAdmitidos: Record<string, readonly string[]> = {
  "es-MX-JorgeNeural": ["chat", "cheerful"], "es-MX-DaliaNeural": [], "es-MX-GerardoNeural": [],
  // Brief 050 v1.1 (5): `shouting` de Jenny y de Guy, catálogo real del 22 oct (canto-gol-050/catalogo-estilos.json).
  "en-US-JennyNeural": ["excited", "sad", "shouting"], "en-US-GuyNeural": ["excited", "sad", "newscast", "shouting"], "en-US-DavisNeural": ["chat"],
};
type Idioma = "es" | "en";
export type RolVoz = "narrador" | "comentarista" | "estadista";
type OpcionesVoz = { signal?: AbortSignal; fetch?: typeof fetch };
const roles: readonly RolVoz[] = ["narrador", "comentarista", "estadista"];
const permitidas: Record<Idioma, readonly string[]> = {
  es: ["es-MX-JorgeNeural", "es-MX-DaliaNeural", "es-MX-GerardoNeural"],
  en: ["en-US-JennyNeural", "en-US-GuyNeural", "en-US-DavisNeural"],
};
const predeterminadas: Record<Idioma, Record<RolVoz, string>> = {
  es: { narrador: "es-MX-JorgeNeural", comentarista: "es-MX-DaliaNeural", estadista: "es-MX-GerardoNeural" },
  en: { narrador: "en-US-JennyNeural", comentarista: "en-US-DavisNeural", estadista: "en-US-GuyNeural" },
};
/** Estilo propio de cada invitado, aplicado solo si la voz lo admite. */
const estiloInvitado: Partial<Record<RolVoz, string>> = { comentarista: "chat", estadista: "newscast" };

const escapar = (texto: string) => texto.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
/** `ARENA_VOZ_ES/EN` siguen siendo la voz del narrador; los invitados tienen la suya. */
const variableVoz = (idioma: Idioma, rol: RolVoz) => `ARENA_VOZ_${idioma.toUpperCase()}${rol === "narrador" ? "" : `_${rol.toUpperCase()}`}`;
function vozConfigurada(idioma: Idioma, rol: RolVoz = "narrador") {
  const voz = process.env[variableVoz(idioma, rol)] ?? predeterminadas[idioma][rol];
  if (!permitidas[idioma].includes(voz)) throw new Error("Voz expresiva no admitida");
  return voz;
}

export interface AsignacionVoz { voz: string; motivo: "predeterminada" | "entorno" | "degradada:narrador" | "degradada:comentarista" }
/** Voz efectiva por rol. Sin catálogo (null) no se degrada. Si falta la del comentarista
 * usa la del narrador; si falta la del estadista, la del comentarista (o la del narrador). */
export function asignarVoces(idioma: Idioma, catalogo?: ReadonlySet<string> | null): Record<RolVoz, AsignacionVoz> {
  const origen = (rol: RolVoz): AsignacionVoz["motivo"] => process.env[variableVoz(idioma, rol)] ? "entorno" : "predeterminada";
  const disponible = (voz: string) => !catalogo || catalogo.has(voz);
  const narrador: AsignacionVoz = { voz: vozConfigurada(idioma, "narrador"), motivo: origen("narrador") };
  const propiaC = vozConfigurada(idioma, "comentarista"), propiaE = vozConfigurada(idioma, "estadista");
  const comentarista: AsignacionVoz = disponible(propiaC) ? { voz: propiaC, motivo: origen("comentarista") } : { voz: narrador.voz, motivo: "degradada:narrador" };
  const estadista: AsignacionVoz = disponible(propiaE) ? { voz: propiaE, motivo: origen("estadista") } : disponible(propiaC) ? { voz: propiaC, motivo: "degradada:comentarista" } : { voz: narrador.voz, motivo: "degradada:narrador" };
  return { narrador, comentarista, estadista };
}
export const vocesDe = (asignacion: Record<RolVoz, AsignacionVoz>): Record<RolVoz, string> => ({ narrador: asignacion.narrador.voz, comentarista: asignacion.comentarista.voz, estadista: asignacion.estadista.voz });

const tiposCanto: readonly TipoTramoCanto[] = ["grito", "goleador", "hechos", "autogol"];
/** Brief 050 v1.1 · Canto de gol: un único `<s>` con un `express-as`/`prosody` por tramo, sin `<s>`
 * ni `<break>` entre tramos (cada frontera cuesta ≈ 1 s) y el silencio final de CANTO_GOL. Prosodia
 * y styledegree de CANTO_GOL.tramos; estilo de CANTO_GOL.estilos filtrado por la voz efectiva. Solo
 * el narrador con `jubilo` y con `texto` igual a los tramos unidos. */
function parteCanto(f: FragmentoVoz, rol: RolVoz, voz: string, idioma: Idioma): string {
  const tramos = f.canto!.tramos;
  if (rol !== "narrador" || f.emocion !== "jubilo" || !Array.isArray(tramos) || !tramos.length || tramos.some(t => !t.texto || !tiposCanto.includes(t.tipo)) || f.texto !== tramos.map(t => t.texto).join(" ")) throw new Error("Interpretación de voz inválida");
  const porciento = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
  const frases = tramos.map(t => {
    const p = CANTO_GOL.tramos[t.tipo], deseado: string = CANTO_GOL.estilos[idioma][t.tipo];
    const estilo = estilosAdmitidos[voz]!.includes(deseado) ? deseado : undefined;
    const prosodia = `<prosody rate="${porciento(p.rate)}" pitch="${porciento(p.pitch)}" volume="${porciento(p.volume)}">${escapar(t.texto)}</prosody>`;
    return estilo ? `<mstts:express-as style="${estilo}" styledegree="${p.grado.toFixed(2)}">${prosodia}</mstts:express-as>` : prosodia;
  });
  return `<s>${frases.join("")}<break time="${CANTO_GOL.pausaFinalMs}ms"/></s>`;
}

/** Un documento por tramo: varias interpretaciones sin multiplicar solicitudes. Los fragmentos
 * contiguos del mismo rol comparten un `<voice>`; una intervención puede llevar dos hermanos. */
export function prepararVoz(fragmentos: readonly FragmentoVoz[], idioma: Idioma, voces?: Partial<Record<RolVoz, string>>) {
  const texto = fragmentos.map(f => f.texto).join(" ");
  if (!texto || texto.length > 6000 || fragmentos.length > 100) throw new Error("Texto de voz fuera de presupuesto");
  const vozDe = (rol: RolVoz) => {
    const voz = voces?.[rol] ?? vozConfigurada(idioma, rol);
    if (!permitidas[idioma].includes(voz)) throw new Error("Voz expresiva no admitida");
    return voz;
  };
  const grupos: { rol: RolVoz; voz: string; partes: string[] }[] = [];
  for (const f of fragmentos) {
    const rol = f.rol ?? "narrador";
    if (!roles.includes(rol) || !f.texto || !Number.isFinite(f.intensidad) || f.intensidad < 0 || f.intensidad > 1 || !Number.isInteger(f.variante) || f.variante < 0 || f.variante > 3) throw new Error("Interpretación de voz inválida");
    const voz = vozDe(rol);
    if (f.canto) {
      const ultimo = grupos.at(-1), parte = parteCanto(f, rol, voz, idioma);
      if (ultimo && ultimo.rol === rol) ultimo.partes.push(parte); else grupos.push({ rol, voz, partes: [parte] });
      continue;
    }
    const variacion = [-1, 0, 1, 2][f.variante]!;
    const activa = ["tension", "emocion", "sorpresa", "jubilo"].includes(f.emocion);
    const ritmo = (activa ? 4 + f.intensidad * 9 : f.emocion === "decepcion" ? -6 : 0) + variacion;
    const tono = (activa ? 1 + f.intensidad * 6 : f.emocion === "decepcion" ? -3 : 0) + variacion * 0.5;
    const volumen = activa ? 4 + f.intensidad * 10 : 0;
    let estilo = rol !== "narrador" ? estiloInvitado[rol] : activa ? "excited" : f.emocion === "decepcion" ? "sad" : undefined;
    if (rol === "narrador" && voz === "es-MX-JorgeNeural" && activa) estilo = "cheerful";
    if (estilo && !estilosAdmitidos[voz]!.includes(estilo)) estilo = undefined;
    const grado = (f.emocion === "jubilo" ? 1.1 + f.intensidad * 0.7 : 0.5 + f.intensidad * 0.8) + variacion * 0.025;
    const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
    const prosodia = `<prosody rate="${signed(ritmo)}" pitch="${signed(tono)}" volume="${signed(volumen)}">${escapar(f.texto)}</prosody>`;
    const frase = estilo ? `<mstts:express-as style="${estilo}" styledegree="${grado.toFixed(2)}">${prosodia}</mstts:express-as>` : prosodia;
    const pausa = f.emocion === "jubilo" ? 380 : f.emocion === "sorpresa" ? 160 : f.emocion === "tension" ? 65 : 110 + f.variante * 15;
    const parte = `<s>${frase}<break time="${pausa}ms"/></s>`;
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.rol === rol) ultimo.partes.push(parte); else grupos.push({ rol, voz, partes: [parte] });
  }
  const contenido = grupos.map(g => `<voice name="${g.voz}">${g.partes.join("")}</voice>`).join("");
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${idioma === "es" ? "es-MX" : "en-US"}">${contenido}</speak>`;
  if (ssml.length > 24_000) throw new Error("Interpretación de voz fuera de presupuesto");
  // La voz declarada es la del invitado si lo hay (el hash de claveAudio cubre todo el SSML).
  const voz = [...grupos].reverse().find(g => g.rol !== "narrador")?.voz ?? grupos[0]!.voz;
  // Reserva conservadora: incluye todas las marcas, además del texto hablado.
  return { texto, ssml, voz, idioma, version: VERSION_VOZ, caracteresPresupuestados: ssml.length };
}

export function claveAudio(preparada: ReturnType<typeof prepararVoz>, tick: number) {
  return "audio:" + createHash("sha256").update(JSON.stringify({ version: preparada.version, voz: preparada.voz, idioma: preparada.idioma, formato, tick, ssml: preparada.ssml })).digest("hex");
}

export function ssmlComentario(comentario: ComentarioArena, idioma: Idioma, registro?: RegistroArena) {
  const fragmentos: FragmentoVoz[] = comentario.oraciones.map((o, i) => {
    const h = comentario.hechos.find(h => h.id === o.hecho);
    const eventos = registro?.eventos.filter(e => e.tick <= comentario.tick && h?.eventos.includes(e.id));
    const gol = h?.tipo === "gol_anotado", atajada = eventos?.some(e => e.tipo === "atajada"), tiro = eventos?.some(e => e.tipo === "tiro");
    return { tick: comentario.tick, texto: idioma === "es" ? o.texto_es : o.texto_en, emocion: gol ? "jubilo" : atajada ? "sorpresa" : tiro ? "emocion" : "serena", intensidad: gol ? 0.92 : atajada || tiro ? 0.8 : 0.18, variante: i % 4, fuentes: h?.eventos ?? [], fotogramas: [], rol: "narrador" };
  });
  if (fragmentos.map(f => f.texto).join(" ").length > 1200) throw new Error("Comentario demasiado largo para voz");
  return prepararVoz(fragmentos, idioma);
}
export async function sintetizarComentario(comentario: ComentarioArena, idioma: Idioma, opciones: OpcionesVoz = {}) {
  return sintetizarVoz(ssmlComentario(comentario, idioma), comentario.tick, opciones);
}
export async function sintetizarTexto(texto: string, idioma: Idioma, tick: number, opciones: OpcionesVoz = {}) {
  return sintetizarVoz(prepararVoz([{ tick, texto, emocion: "serena", intensidad: 0.18, variante: 0, fuentes: [], fotogramas: [] }], idioma), tick, opciones);
}

async function cabecerasSpeech(): Promise<Record<string, string>> {
  const clave = process.env.AZURE_SPEECH_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  const authorization = !clave && process.env.AZURE_SPEECH_RESOURCE_ID ? `Bearer aad#${process.env.AZURE_SPEECH_RESOURCE_ID}#${(await credencialAzure().getToken("https://cognitiveservices.azure.com/.default")).token}` : null;
  if (!clave && !authorization) throw new Error("Speech sin credenciales");
  return clave ? { "Ocp-Apim-Subscription-Key": clave } : { Authorization: authorization! };
}

export async function sintetizarVoz(preparada: ReturnType<typeof prepararVoz>, tick: number, opciones: OpcionesVoz = {}) {
  const { texto, ssml, idioma } = preparada;
  const endpoint = endpointAzure(process.env.AZURE_SPEECH_ENDPOINT, ".cognitiveservices.azure.com");
  const signal = AbortSignal.any([AbortSignal.timeout(15_000), ...(opciones.signal ? [opciones.signal] : [])]);
  const credencial = await cabecerasSpeech();
  return trazar("arena.voz", { "arena.tick": tick, "arena.idioma": idioma, "speech.caracteres": texto.length, "speech.presupuesto_caracteres": preparada.caracteresPresupuestados, "speech.voz": preparada.voz, "speech.version": VERSION_VOZ }, async () => {
    const r = await (opciones.fetch ?? fetch)(`${endpoint}/tts/cognitiveservices/v1`, { method: "POST", signal, headers: { "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": formato, "user-agent": "CRONISTA", ...credencial }, body: ssml });
    if (!r.ok || !r.body) throw new Error(`Speech HTTP ${r.status}`);
    const lector = r.body.getReader(), partes: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const { done, value } = await lector.read(); if (done) break; bytes += value.length; if (bytes > 512_000) { await lector.cancel(); throw new Error("Audio demasiado grande"); } partes.push(value); } }
    finally { lector.releaseLock(); }
    if (!bytes) throw new Error("Speech devolvió audio vacío");
    return { base64: Buffer.concat(partes).toString("base64"), tipo: "audio/mpeg", tick, idioma, caracteres: texto.length, caracteresPresupuestados: preparada.caracteresPresupuestados, voz: preparada.voz, version: VERSION_VOZ };
  });
}

let catalogoCache: { hasta: number; voces: Set<string> | null } | undefined;
/** Catálogo real de Speech (`/voices/list`), solo lectura, en caché
 * `MESA_ARENA.catalogoVocesCacheS` si respondió. Si no se puede consultar devuelve null:
 * entonces no hay degradación, y un fallo de síntesis posterior usa el respaldo vigente.
 * v3.1: el fallo (HTTP, plazo, JSON inválido, lista vacía) también se guarda, durante
 * `MESA_ARENA.catalogoVocesReintentoS`, para no esperar el plazo en cada consulta. */
export async function catalogoVoces(opciones: OpcionesVoz = {}): Promise<ReadonlySet<string> | null> {
  if (catalogoCache && catalogoCache.hasta > Date.now()) return catalogoCache.voces;
  const guardar = (voces: Set<string> | null) => {
    catalogoCache = { hasta: Date.now() + (voces ? MESA_ARENA.catalogoVocesCacheS : MESA_ARENA.catalogoVocesReintentoS) * 1000, voces };
    return voces;
  };
  try {
    const endpoint = endpointAzure(process.env.AZURE_SPEECH_ENDPOINT, ".cognitiveservices.azure.com");
    const signal = AbortSignal.any([AbortSignal.timeout(5_000), ...(opciones.signal ? [opciones.signal] : [])]);
    const r = await (opciones.fetch ?? fetch)(`${endpoint}/tts/cognitiveservices/voices/list`, { signal, headers: { "user-agent": "CRONISTA", ...await cabecerasSpeech() } });
    if (!r.ok) return guardar(null);
    const lista = await r.json() as { ShortName?: unknown }[];
    if (!Array.isArray(lista)) return guardar(null);
    const voces = new Set(lista.flatMap(v => typeof v?.ShortName === "string" ? [v.ShortName] : []));
    return guardar(voces.size ? voces : null);
  } catch { return guardar(null); }
}
/** Solo pruebas. */
export function olvidarCatalogoVoces() { catalogoCache = undefined; }
