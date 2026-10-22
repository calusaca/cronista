// Brief 052 v1.1 §3–5, §7 — smoke de admisión de un modelo al catálogo público de la arena.
// Sonda de formato con el esquema real y 4 partidos (espejo, cruzado A, cruzado B invertido y
// uno «web» con la configuración publicada). Se evalúan SOLO las decisiones del candidato, por
// identidad y lado. La evidencia guarda indicadores, nunca muestras crudas del modelo.
import type { Llm, Mensaje } from "../lib/llm";
import { ARENA, SMOKE_MODELOS_ARENA as S } from "../sim/limites";
import { contextoCompetitivo } from "./competencia";
import { crearControladorLlm, esquemaRespuestaArena, planProgramado, SISTEMA_ARENA, validarOrdenes } from "./controladores";
import { ejecutarArena, observarArena } from "./coordinador";
import { crearConfigArena, MotorArena } from "./motor";
import type { Lado } from "../sim/tipos";
import type { ObservacionArena } from "./tipos";

export type FormatoSonda = "json_schema" | "json_object" | "texto";
export type ResultadoSonda = "http" | "truncado" | "no_json" | "semantico" | "ok" | "filtro" | "vacio" | "error";
export interface EspecLlm { tipo: "azure-openai" | "foundry-modelos"; deployment: string; formatoJson?: FormatoSonda; esfuerzoRazonamiento?: "low" | "minimal" }
export interface CandidatoSmoke { id: string; nombrePublico: string; llm: EspecLlm["tipo"]; deployment: string; modelo: string; version: string; capacidad: number; formatoJson?: FormatoSonda; esfuerzoRazonamiento?: "low" | "minimal" }
/** Crea un Llm real (o falso en pruebas) con el transporte instrumentado. */
export type FabricaLlm = (espec: EspecLlm, transporte: typeof fetch) => Llm;

export interface Peticion { status: number; ms: number; finish: string | null; modelo: string | null; entrada: number | null; salida: number | null; razonamiento: number | null; cache: number | null; total: number | null; teniaThink: boolean; reasoningContentChars: number }

/** Transporte que mide cada petición y extrae SOLO indicadores (sin contenido). */
export function transporteInstrumentado(base: typeof fetch, registro: Peticion[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const t0 = performance.now();
    let r: Response;
    try { r = await base(url, init); }
    catch (error) {
      // Abortada (plazo) o fallo de red: status 0, sin cuerpo.
      registro.push({ status: 0, ms: Math.round(performance.now() - t0), finish: null, modelo: null, entrada: null, salida: null, razonamiento: null, cache: null, total: null, teniaThink: false, reasoningContentChars: 0 });
      throw error;
    }
    const p: Peticion ={ status: r.status, ms: Math.round(performance.now() - t0), finish: null, modelo: null, entrada: null, salida: null, razonamiento: null, cache: null, total: null, teniaThink: false, reasoningContentChars: 0 };
    try {
      const j = await r.clone().json() as { model?: string; choices?: { finish_reason?: string | null; message?: { content?: string | null; reasoning_content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; completion_tokens_details?: { reasoning_tokens?: number } } };
      const c = j.choices?.[0];
      p.finish = c?.finish_reason ?? null; p.modelo = typeof j.model === "string" ? j.model : null;
      p.entrada = j.usage?.prompt_tokens ?? null; p.salida = j.usage?.completion_tokens ?? null;
      p.razonamiento = j.usage?.completion_tokens_details?.reasoning_tokens ?? null; p.cache = j.usage?.prompt_tokens_details?.cached_tokens ?? null; p.total = j.usage?.total_tokens ?? null;
      p.teniaThink = /<\/?think>/.test(c?.message?.content ?? "");
      p.reasoningContentChars = typeof c?.message?.reasoning_content === "string" ? c.message.reasoning_content.length : 0;
    } catch { /* cuerpo no JSON: queda el status */ }
    registro.push(p);
    return r;
  }) as typeof fetch;
}

/** Mismo criterio que salidaFacturable del adaptador: razonamiento informado fuera de completion_tokens. */
export function razonamientoFuera(p: Peticion): boolean {
  return (p.razonamiento ?? 0) > 0 && p.total !== null && p.entrada !== null && p.salida !== null && p.total === p.entrada + p.salida + (p.razonamiento ?? 0);
}

/** Dos observaciones sin inferencia: saque inicial (local) y mitad de un partido programado
 * con entrenadores (visita). */
export function observacionesSonda(seed: number): ObservacionArena[] {
  const config = crearConfigArena({ seed, duracionS: S.webS, intervaloS: S.webIntervaloS });
  const motor = new MotorArena(config);
  const inicial = observarArena(motor, "local");
  const objetivo = Math.round(S.webS / 2 / ARENA.pasoS), paso = Math.round(S.webIntervaloS / ARENA.pasoS);
  while (motor.estado.tick < objetivo && !motor.estado.finalizado) {
    const planes = { local: planProgramado(observarArena(motor, "local")), visita: planProgramado(observarArena(motor, "visita")) };
    motor.avanzar(planes, Math.min(objetivo, motor.estado.tick + paso));
  }
  return [inicial, observarArena(motor, "visita")];
}

/** ¿El JSON respeta enum e items exactos del esquema real? (no se confía en el 200). */
export function respetaEsquema(raw: unknown, obs: ObservacionArena): boolean {
  const esquema = esquemaRespuestaArena(obs) as { required: string[] };
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  const ids = obs.estado.jugadores.filter(j => j.lado === obs.lado).map(j => j.id);
  const ordenes = o.ordenes;
  return Object.keys(o).sort().join() === [...esquema.required].sort().join() && o.observacion === obs.id && o.lado === obs.lado && Array.isArray(ordenes) && ordenes.length === ids.length
    && ordenes.every(x => !!x && typeof x === "object" && ids.includes((x as { jugador: string }).jugador) && ((x as { receptor: unknown }).receptor === null || ids.includes((x as { receptor: string }).receptor)));
}

export function mensajeObservacion(obs: ObservacionArena): Mensaje[] {
  return [{ rol: "user", contenido: JSON.stringify({ ...obs, competencia: contextoCompetitivo(obs), ultimaPropuestaValidaPropia: null }) }];
}

export function clasificarError(mensaje: string): { resultado: ResultadoSonda; status?: number } {
  const http = mensaje.match(/^(?:Foundry Models|Azure OpenAI) (\d{3}) /);
  if (http) return { resultado: "http", status: Number(http[1]) };
  if (/truncada|sin cerrar/.test(mensaje)) return { resultado: "truncado" };
  if (/filtro de contenido/.test(mensaje)) return { resultado: "filtro" };
  if (/vacía/.test(mensaje)) return { resultado: "vacio" };
  if (/fuera de la envoltura|no es JSON|malformada/.test(mensaje)) return { resultado: "no_json" };
  return { resultado: "error" };
}

export interface IntentoSonda { formato: FormatoSonda; observacion: "inicio" | "mitad"; resultado: ResultadoSonda; status?: number; respetaEsquema: boolean | null; peticion: Peticion | null }

export async function sondaFormato(candidato: CandidatoSmoke, fabrica: FabricaLlm, base: typeof fetch, seed: number): Promise<{ elegido: FormatoSonda | null; intentos: IntentoSonda[] }> {
  const formatos: FormatoSonda[] = candidato.llm === "azure-openai" ? ["json_schema"] : (candidato.formatoJson ? [candidato.formatoJson] : ["json_schema", "json_object", "texto"]);
  const observaciones = observacionesSonda(seed), intentos: IntentoSonda[] = [];
  for (const formato of formatos) {
    let todosOk = true;
    for (const [i, obs] of observaciones.entries()) {
      const registro: Peticion[] = [];
      const llm = fabrica({ tipo: candidato.llm, deployment: candidato.deployment, formatoJson: formato, ...(candidato.esfuerzoRazonamiento ? { esfuerzoRazonamiento: candidato.esfuerzoRazonamiento } : {}) }, transporteInstrumentado(base, registro));
      const intento: IntentoSonda = { formato, observacion: i === 0 ? "inicio" : "mitad", resultado: "ok", respetaEsquema: null, peticion: null };
      try {
        const salida = await llm.completar(SISTEMA_ARENA, mensajeObservacion(obs), { esquema: { nombre: "ordenes_arena", json: esquemaRespuestaArena(obs) }, maxTokens: ARENA.tokensOrdenes });
        let raw: unknown;
        try { raw = JSON.parse(salida); } catch { intento.resultado = "no_json"; }
        if (intento.resultado === "ok") {
          intento.respetaEsquema = respetaEsquema(raw, obs);
          try { validarOrdenes(raw, obs); } catch { intento.resultado = "semantico"; }
        }
      } catch (error) {
        Object.assign(intento, clasificarError(error instanceof Error ? error.message : ""));
      }
      intento.peticion = registro[0] ?? null;
      intentos.push(intento);
      if (intento.resultado !== "ok") { todosOk = false; break; }
    }
    if (todosOk) return { elegido: formato, intentos };
  }
  return { elegido: null, intentos };
}

export type NombrePartido = "espejo" | "cruzadoA" | "cruzadoB" | "web";
export interface DecisionSmoke { partido: NombrePartido; ronda: number; lado: Lado; controlador: string; origen: string; motivo: string; tiempoMs: number; llamadas: number | null; promptMax: number | null }
export interface LadoSmoke { lado: Lado; controlador: string; esCandidato: boolean; uso: { llamadas: number; respuestasConUso: number; entrada: number; salida: number; cache: number } | null; razonamientoInformado: number; razonamientoFueraDeCompletion: boolean; peticiones: number; promptMax: number | null; salidaFacturableMax: number | null; estados: Record<string, number>; finishes: Record<string, number>; teniaThink: number; reasoningContentChars: number; modelos: string[] }
export interface PartidoSmoke { nombre: NombrePartido; duracionS: number; intervaloS: number; esperaMs: number; marcador: unknown; esperadas: number; observadas: number; lados: LadoSmoke[] }

const DEFINICION: Record<NombrePartido, { duracionS: number; intervaloS: number; local: "candidato" | "rival"; visita: "candidato" | "rival" }> = {
  espejo: { duracionS: S.cortoS, intervaloS: S.cortoIntervaloS, local: "candidato", visita: "candidato" },
  cruzadoA: { duracionS: S.cortoS, intervaloS: S.cortoIntervaloS, local: "candidato", visita: "rival" },
  cruzadoB: { duracionS: S.cortoS, intervaloS: S.cortoIntervaloS, local: "rival", visita: "candidato" },
  web: { duracionS: S.webS, intervaloS: S.webIntervaloS, local: "candidato", visita: "rival" },
};
export const PARTIDOS_SMOKE = Object.keys(DEFINICION) as NombrePartido[];
/** Decisiones del candidato esperadas por partido (rondas × lados que dirige). */
export function esperadasPorPartido(nombre: NombrePartido): number {
  const d = DEFINICION[nombre];
  return Math.ceil(d.duracionS / d.intervaloS) * (Number(d.local === "candidato") + Number(d.visita === "candidato"));
}

export async function partidoSmoke(nombre: NombrePartido, candidato: EspecLlm, rival: EspecLlm, fabrica: FabricaLlm, base: typeof fetch, seed: number, alProgreso?: (texto: string) => void, ritmoMsPorSegundo = 1000): Promise<{ partido: PartidoSmoke; decisiones: DecisionSmoke[] }> {
  const d = DEFINICION[nombre];
  const registros: Record<Lado, Peticion[]> = { local: [], visita: [] };
  const llms = { local: fabrica(d.local === "candidato" ? candidato : rival, transporteInstrumentado(base, registros.local)), visita: fabrica(d.visita === "candidato" ? candidato : rival, transporteInstrumentado(base, registros.visita)) };
  const idCandidato = fabrica(candidato, base).id;
  const cortes: Record<Lado, number[]> = { local: [0], visita: [0] };
  let ultimoTick = 0;
  const registro = await ejecutarArena(crearConfigArena({ seed, duracionS: d.duracionS, intervaloS: d.intervaloS }), { local: crearControladorLlm(llms.local), visita: crearControladorLlm(llms.visita) }, {
    esperaMs: ARENA.esperaMs,
    // Ritmo «directo» (presentación por defecto de la web): el tiempo simulado avanza al ritmo del
    // reloj, así la cadencia de solicitudes por minuto es la que verá el deployment publicado.
    alPublicar: async pub => {
      if (pub.tipo !== "avance" || ritmoMsPorSegundo <= 0) return;
      const ms = (pub.estado.tick - ultimoTick) * ARENA.pasoS * ritmoMsPorSegundo;
      ultimoTick = pub.estado.tick;
      if (ms > 0) await new Promise(r => setTimeout(r, ms));
    },
    alProgreso: r => {
      for (const lado of ["local", "visita"] as const) cortes[lado].push(registros[lado].length);
      alProgreso?.(`${nombre} · ${r.finTick * ARENA.pasoS} s · ${r.decisiones.local.origen}/${r.decisiones.visita.origen} · ${Math.round(r.decisiones.local.tiempoMs)}/${Math.round(r.decisiones.visita.tiempoMs)} ms`);
    },
  });
  const maximo = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.max(...v) : null; };
  const decisiones: DecisionSmoke[] = registro.rondas.flatMap((ronda, i) => (["local", "visita"] as const).map(lado => {
    const dec = ronda.decisiones[lado];
    return { partido: nombre, ronda: i + 1, lado, controlador: dec.controlador, origen: dec.origen, motivo: dec.motivo, tiempoMs: Math.round(dec.tiempoMs), llamadas: dec.llamadas ?? null,
      promptMax: maximo(registros[lado].slice(cortes[lado][i], cortes[lado][i + 1]).map(p => p.entrada)) };
  }));
  const lados: LadoSmoke[] = (["local", "visita"] as const).map(lado => {
    const ps = registros[lado];
    return { lado, controlador: llms[lado].id, esCandidato: llms[lado].id === idCandidato, uso: llms[lado].uso?.() ?? null,
      razonamientoInformado: ps.reduce((a, p) => a + (p.razonamiento ?? 0), 0),
      razonamientoFueraDeCompletion: ps.some(razonamientoFuera),
      peticiones: ps.length, promptMax: maximo(ps.map(p => p.entrada)),
      salidaFacturableMax: maximo(ps.map(p => p.salida === null ? null : p.salida + (razonamientoFuera(p) ? p.razonamiento ?? 0 : 0))), estados: ps.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a; }, {}),
      finishes: ps.reduce<Record<string, number>>((a, p) => { const k = p.finish ?? "sin_finish"; a[k] = (a[k] ?? 0) + 1; return a; }, {}), teniaThink: ps.filter(p => p.teniaThink).length,
      reasoningContentChars: ps.reduce((a, p) => a + p.reasoningContentChars, 0), modelos: [...new Set(ps.map(p => p.modelo).filter((m): m is string => !!m))] };
  });
  const observadas = decisiones.filter(x => x.controlador === idCandidato).length;
  return { partido: { nombre, duracionS: d.duracionS, intervaloS: d.intervaloS, esperaMs: ARENA.esperaMs, marcador: registro.final.marcador, esperadas: esperadasPorPartido(nombre), observadas, lados }, decisiones };
}

export interface Precio { entrada: number; salida: number; cache?: number }
export interface EvidenciaSmoke {
  version: "052-v1.1"; generadoUtc: string; seed: number;
  candidato: CandidatoSmoke & { controlador: string };
  rival: { controlador: string; deployment: string };
  cotas: { decisionMaxMs: number; solicitudesMax: number; tokensOrdenes: number; esperaMs: number };
  sonda: { elegido: FormatoSonda | null; intentos: IntentoSonda[] };
  partidos: PartidoSmoke[];
  decisionesCandidato: DecisionSmoke[];
  decisionesRival: DecisionSmoke[];
  resumen: { esperadas: number; observadas: number; controlador: number; respaldos: number; tiempoMaxMs: number | null; llamadasMax: number | null; promptMaxWeb: number | null; tokensCandidato: { entrada: number; salida: number; cache: number; razonamientoInformado: number; llamadas: number; respuestasConUso: number }; razonamientoFueraDeCompletion: boolean };
  costo: { precio: Precio | null; smokeUsd: number | null; ladoWebUsd: number | null; nota: string };
  admision: { admitido: boolean; causas: string[] };
}

export function evaluarAdmision(e: Omit<EvidenciaSmoke, "admision">): { admitido: boolean; causas: string[] } {
  const causas: string[] = [];
  if (!e.sonda.elegido) causas.push(`sonda sin formato ok (${e.sonda.intentos.map(i => `${i.formato}/${i.observacion}: ${i.resultado}`).join(", ")})`);
  for (const p of e.partidos) if (p.esperadas !== p.observadas) causas.push(`${p.nombre}: ${p.observadas} decisiones del candidato observadas, ${p.esperadas} esperadas (corrida inválida)`);
  const r = e.resumen;
  if (r.controlador !== r.esperadas) causas.push(`${r.esperadas - r.controlador} de ${r.esperadas} decisiones cayeron a respaldo (${[...new Set(e.decisionesCandidato.filter(d => d.origen !== "controlador").map(d => d.motivo))].join(", ")})`);
  const lentas = e.decisionesCandidato.filter(d => d.tiempoMs > e.cotas.decisionMaxMs).length;
  if (lentas) causas.push(`${lentas} decisiones > ${e.cotas.decisionMaxMs} ms (máx. ${r.tiempoMaxMs} ms)`);
  if (e.decisionesCandidato.some(d => d.llamadas === null || d.llamadas > e.cotas.solicitudesMax)) causas.push(`alguna decisión con más de ${e.cotas.solicitudesMax} solicitudes`);
  if (r.tokensCandidato.respuestasConUso !== r.tokensCandidato.llamadas) causas.push(`respuestasConUso (${r.tokensCandidato.respuestasConUso}) ≠ llamadas (${r.tokensCandidato.llamadas})`);
  if (!e.costo.precio) causas.push("sin precio anotado en precios.json (§5)");
  return { admitido: causas.length === 0, causas };
}

export async function ejecutarSmokeModelo(opciones: { candidato: CandidatoSmoke; rival: EspecLlm; fabrica: FabricaLlm; fetch: typeof fetch; seed: number; precio: Precio | null; alProgreso?: (texto: string) => void; partidos?: NombrePartido[]; ritmoMsPorSegundo?: number }): Promise<EvidenciaSmoke> {
  const { candidato, fabrica, seed } = opciones;
  opciones.alProgreso?.(`sonda de formato · ${candidato.deployment}`);
  const sonda = await sondaFormato(candidato, fabrica, opciones.fetch, seed);
  opciones.alProgreso?.(`sonda: ${sonda.intentos.map(i => `${i.formato}/${i.observacion}=${i.resultado}${i.peticion ? ` ${i.peticion.ms} ms` : ""}`).join(", ")}`);
  // Sin formato ok, los partidos se juegan igual (para documentar la causa) con el primer formato
  // que devolvió JSON parseable (corregible por el reintento) o json_object; no hay admisión.
  const respaldo = sonda.intentos.find(i => i.resultado === "semantico")?.formato ?? candidato.formatoJson ?? "json_object";
  const espec: EspecLlm = { tipo: candidato.llm, deployment: candidato.deployment, ...(candidato.llm === "foundry-modelos" ? { formatoJson: sonda.elegido ?? respaldo } : {}), ...(candidato.esfuerzoRazonamiento ? { esfuerzoRazonamiento: candidato.esfuerzoRazonamiento } : {}) };
  const idCandidato = fabrica(espec, opciones.fetch).id, idRival = fabrica(opciones.rival, opciones.fetch).id;
  if (idCandidato === idRival) throw new Error("El candidato no puede ser el rival de referencia");
  const partidos: PartidoSmoke[] = [], decisiones: DecisionSmoke[] = [];
  // Con la sonda fallida igual se juegan los partidos con el formato por defecto: se documenta la causa.
  for (const nombre of opciones.partidos ?? PARTIDOS_SMOKE) {
    const r = await partidoSmoke(nombre, espec, opciones.rival, fabrica, opciones.fetch, seed, opciones.alProgreso, opciones.ritmoMsPorSegundo ?? 1000);
    partidos.push(r.partido); decisiones.push(...r.decisiones);
  }
  const delCandidato = decisiones.filter(d => d.controlador === idCandidato), delRival = decisiones.filter(d => d.controlador !== idCandidato);
  const ladosCandidato = partidos.flatMap(p => p.lados.filter(l => l.esCandidato));
  const suma = (f: (l: LadoSmoke) => number) => ladosCandidato.reduce((a, l) => a + f(l), 0);
  const tokens = { entrada: suma(l => l.uso?.entrada ?? 0), salida: suma(l => l.uso?.salida ?? 0), cache: suma(l => l.uso?.cache ?? 0), razonamientoInformado: suma(l => l.razonamientoInformado), llamadas: suma(l => l.uso?.llamadas ?? 0), respuestasConUso: suma(l => l.uso?.respuestasConUso ?? 0) };
  const fuera = ladosCandidato.some(l => l.razonamientoFueraDeCompletion);
  const max = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.max(...v) : null; };
  const promptMaxWeb = max(partidos.filter(p => p.nombre === "web").flatMap(p => p.lados.filter(l => l.esCandidato).map(l => l.promptMax)));
  const precio = opciones.precio;
  // UsoLlm.salida ya incluye el razonamiento informado FUERA de completion_tokens (salidaFacturable).
  // En ese caso max_tokens no acota la salida: la cota por solicitud es la mayor observada.
  const salidaPorSolicitud = Math.max(ARENA.tokensOrdenes, max(ladosCandidato.map(l => l.salidaFacturableMax)) ?? 0);
  const solicitudesWebLado = Math.ceil(S.webS / S.webIntervaloS) * ARENA.intentosOrdenes;
  const costo = {
    precio,
    smokeUsd: precio ? Number((((tokens.entrada - tokens.cache) * precio.entrada + tokens.cache * (precio.cache ?? precio.entrada) + tokens.salida * precio.salida) / 1e6).toFixed(4)) : null,
    ladoWebUsd: precio && promptMaxWeb !== null ? Number((solicitudesWebLado * (promptMaxWeb * S.factorEntradaReintento * precio.entrada + salidaPorSolicitud * precio.salida) / 1e6).toFixed(4)) : null,
    nota: `ladoWebUsd = ${solicitudesWebLado} solicitudes × (promptMax_web × ${S.factorEntradaReintento} × entrada + ${salidaPorSolicitud} × salida) / 1e6 (§5).${fuera ? " El proveedor informa reasoning_tokens fuera de completion_tokens (total_tokens = prompt + completion + reasoning): se facturan como salida y max_tokens no los acota; la cota de salida por solicitud es la mayor observada." : ""}`,
  };
  const sinAdmision: Omit<EvidenciaSmoke, "admision"> = {
    version: "052-v1.1", generadoUtc: new Date().toISOString(), seed,
    candidato: { ...candidato, ...(espec.formatoJson ? { formatoJson: espec.formatoJson } : {}), controlador: idCandidato },
    rival: { controlador: idRival, deployment: opciones.rival.deployment },
    cotas: { decisionMaxMs: S.decisionMaxMs, solicitudesMax: ARENA.intentosOrdenes, tokensOrdenes: ARENA.tokensOrdenes, esperaMs: ARENA.esperaMs },
    sonda, partidos, decisionesCandidato: delCandidato, decisionesRival: delRival,
    resumen: { esperadas: partidos.reduce((a, p) => a + p.esperadas, 0), observadas: delCandidato.length, controlador: delCandidato.filter(d => d.origen === "controlador").length, respaldos: delCandidato.filter(d => d.origen !== "controlador").length,
      tiempoMaxMs: max(delCandidato.map(d => d.tiempoMs)), llamadasMax: max(delCandidato.map(d => d.llamadas)), promptMaxWeb, tokensCandidato: tokens, razonamientoFueraDeCompletion: fuera },
    costo,
  };
  return { ...sinAdmision, admision: evaluarAdmision(sinAdmision) };
}

/** Serializa la evidencia redactando secretos y hosts; lanza si queda alguno o si aparece
 * un marcador de razonamiento (v1.1 §7: sin muestras crudas). */
export function serializarEvidencia(evidencia: unknown, secretos: string[]): string {
  let texto = JSON.stringify(evidencia, null, 2) + "\n";
  for (const s of secretos.filter(x => x && x.length >= 4)) texto = texto.split(s).join("[REDACTED]");
  for (const s of secretos.filter(x => x && x.length >= 4)) if (texto.includes(s)) throw new Error("La evidencia conserva un secreto");
  if (/<\/?think>/.test(texto)) throw new Error("La evidencia conserva marcadores de razonamiento");
  return texto;
}
