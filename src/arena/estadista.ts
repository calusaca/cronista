import type { HechoVerificable } from "../cadena/verificador";
import { ARENA, MESA_ARENA, TECNICA_ARENA } from "../sim/limites";
import type { EvidenciaMesa, IntervencionArena } from "./protocolo";
import { lados, type EventoArena, type RegistroArena } from "./tipos";

/** Brief 045 · Estadista: código determinista, sin LLM. Orden normativo de la tabla del brief. */
export const TEMAS_ESTADISTA = ["marcador", "reloj", "remates", "atajadas", "acciones", "faltas", "cambios", "reinicios", "pases"] as const;
export type TemaEstadista = (typeof TEMAS_ESTADISTA)[number];
export interface DatoEstadista {
  tema: TemaEstadista; tick: number;
  /** Valor comparable: una candidatura solo repite un tema si este valor cambió. */
  valor: unknown;
  texto_es: string; texto_en: string;
  evidencia: EvidenciaMesa;
  /** El mismo dato como hecho verificable: el comentarista puede citarlo. */
  hecho: HechoVerificable;
  /** v3.1 · Solo los datos con plaza entran en la comparación de cambio y en las plazas de una
   * candidatura. El `reloj` (cambia en cada vencimiento) no ocupa plaza: queda como hecho de
   * apoyo citable por el comentarista. */
  ocupaPlaza: boolean;
}

const segundosDe = (tick: number) => Math.floor(tick * ARENA.pasoS + 1e-9);
const ventanaTicks = () => Math.round(MESA_ARENA.ventanaAccionesS / ARENA.pasoS);

/** Remates = solo eventos `tiro`. «A puerta»: el primer desenlace posterior, sin otro `tiro`
 * de ningún lado en medio, es un `gol` del mismo lado y jugador o una `atajada` cuyo
 * `receptor` es el rematador (la atajada lleva el lado del portero). Un desvío pre-v3
 * (`atajada` + `tiro_fuera` del mismo vuelo) cuenta una vez, por la atajada. */
export function rematesPorLado(eventos: readonly EventoArena[], tick: number) {
  const hasta = eventos.filter(e => e.tick <= tick);
  const resultado = { local: { total: 0, aPuerta: 0, eventos: [] as string[] }, visita: { total: 0, aPuerta: 0, eventos: [] as string[] } };
  hasta.forEach((e, i) => {
    if (e.tipo !== "tiro") return;
    const r = resultado[e.lado]; r.total++; r.eventos.push(e.id);
    for (const d of hasta.slice(i + 1)) {
      if (d.tipo === "tiro") break;
      if (d.tipo !== "gol" && d.tipo !== "atajada" && d.tipo !== "tiro_fuera") continue;
      if (d.tipo === "gol" && d.lado === e.lado && d.jugador === e.jugador || d.tipo === "atajada" && d.receptor === e.jugador) { r.aPuerta++; r.eventos.push(d.id); }
      break;
    }
  });
  return resultado;
}

const pl = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Todos los datos disponibles en `tick`, en el orden de la tabla. Solo usa el prefijo ≤ tick. */
export function datosEstadista(registro: RegistroArena, tick: number): DatoEstadista[] {
  const eventos = registro.eventos.filter(e => e.tick <= tick);
  const L = registro.config.partido.local.nombre, V = registro.config.partido.visita.nombre, s = segundosDe(tick);
  const nombres = { local: L, visita: V };
  const jugadores = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []];
  const datos: DatoEstadista[] = [], orden = new Map(eventos.map((e, i) => [e.id, i]));
  const agregar = (tema: TemaEstadista, valor: unknown, texto_es: string, texto_en: string, evidencia: EvidenciaMesa, extra: Record<string, string | number>) => {
    // La evidencia sigue el orden del registro.
    evidencia = { ...evidencia, eventos: [...evidencia.eventos].sort((x, y) => orden.get(x)! - orden.get(y)!) };
    datos.push({ tema, tick, valor, texto_es, texto_en, evidencia, ocupaPlaza: tema !== "reloj", hecho: { id: `estadista:${tema}:${tick}`, tipo: "accion_arena", texto_es, texto_en, eventos: evidencia.eventos, relevancia: 50, datos: { local: L, visita: V, ...extra } } });
  };
  const acumulado = (ids: string[], cero: boolean): EvidenciaMesa => cero ? { eventos: ids, intervalo: [0, tick], fuente: "inicial" } : { eventos: ids };

  // marcador: inicial + goles ≤ tick. El marcador inicial no procede de eventos.
  const goles = eventos.filter(e => e.tipo === "gol"), m = { ...registro.inicial.marcador };
  for (const g of goles) m[g.lado]++;
  agregar("marcador", m, `Marcador: ${L} ${m.local}, ${V} ${m.visita}.`, `Score: ${L} ${m.local}, ${V} ${m.visita}.`,
    { eventos: goles.map(g => g.id), intervalo: [0, tick], fuente: "inicial" }, { goles_local: m.local, goles_visita: m.visita });

  // reloj: tick · pasoS en segundos enteros.
  agregar("reloj", s, `Llevamos ${s} segundos de juego.`, `${s} seconds played.`, { eventos: [], intervalo: [tick, tick], fuente: `fotograma:${tick}` }, { segundos: s });

  // remates
  const r = rematesPorLado(eventos, tick), totalRemates = r.local.total + r.visita.total;
  agregar("remates", { local: [r.local.total, r.local.aPuerta], visita: [r.visita.total, r.visita.aPuerta] },
    totalRemates ? `Remates: ${L} ${r.local.total} (${r.local.aPuerta} a puerta), ${V} ${r.visita.total} (${r.visita.aPuerta} a puerta).` : `Sin remates en los primeros ${s} segundos.`,
    totalRemates ? `Shots: ${L} ${r.local.total} (${r.local.aPuerta} on target), ${V} ${r.visita.total} (${r.visita.aPuerta} on target).` : `No shots in the first ${s} seconds.`,
    acumulado([...r.local.eventos, ...r.visita.eventos], !r.local.total || !r.visita.total),
    { remates_local: r.local.total, a_puerta_local: r.local.aPuerta, remates_visita: r.visita.total, a_puerta_visita: r.visita.aPuerta, segundos: s });

  // atajadas por portero
  const atajadas = eventos.filter(e => e.tipo === "atajada"), porPortero = new Map<string, EventoArena[]>();
  for (const a of atajadas) porPortero.set(a.jugador, [...porPortero.get(a.jugador) ?? [], a]);
  const lista = [...porPortero.entries()].map(([id, es]) => ({ id, n: es.length, lado: es[0]!.lado, nombre: jugadores.find(j => j.id === id)?.nombre ?? id }));
  agregar("atajadas", lista.map(p => [p.id, p.n]),
    lista.length ? `Atajadas: ${lista.map(p => `${p.nombre} (${nombres[p.lado]}), ${p.n}`).join("; ")}.` : `Sin atajadas en los primeros ${s} segundos.`,
    lista.length ? `Saves: ${lista.map(p => `${p.nombre} (${nombres[p.lado]}), ${p.n}`).join("; ")}.` : `No saves in the first ${s} seconds.`,
    acumulado(atajadas.map(a => a.id), !lista.length),
    Object.fromEntries([...lista.flatMap((p, i) => [[`portero_${i + 1}`, p.nombre], [`atajadas_${i + 1}`, p.n]]), ["segundos", s]]));

  // acciones: proporción en la ventana; con menos de minAcciones no se emite.
  const desde = Math.max(0, tick - ventanaTicks()), w = segundosDe(tick - desde);
  const enVentana = eventos.filter(e => e.tick > desde || desde === 0 && e.tick === 0);
  const acciones = enVentana.filter(e => ["pase", "recepcion", "recuperacion", "intercepcion"].includes(e.tipo));
  if (acciones.length >= MESA_ARENA.minAcciones) {
    const local = Math.round(acciones.filter(e => e.lado === "local").length * 100 / acciones.length), visita = 100 - local;
    agregar("acciones", { local, visita },
      `Proporción de acciones en los últimos ${w} segundos: ${L} ${local} %, ${V} ${visita} %.`,
      `Share of actions in the last ${w} seconds: ${L} ${local}%, ${V} ${visita}%.`,
      { eventos: acciones.map(e => e.id), intervalo: [desde, tick] }, { porcentaje_local: local, porcentaje_visita: visita, ventana: w, acciones: acciones.length });
  }

  // faltas, amarillas, rojas por lado
  const cuenta = (tipo: string, lado: "local" | "visita") => eventos.filter(e => e.tipo === tipo && e.lado === lado).length;
  const f = Object.fromEntries(lados.map(l => [l, { faltas: cuenta("falta", l), amarillas: cuenta("amarilla", l), rojas: cuenta("roja", l) }])) as Record<"local" | "visita", { faltas: number; amarillas: number; rojas: number }>;
  const disciplina = eventos.filter(e => e.tipo === "falta" || e.tipo === "amarilla" || e.tipo === "roja");
  const rojas = f.local.rojas + f.visita.rojas;
  agregar("faltas", f,
    disciplina.length ? `Faltas: ${L} ${f.local.faltas}, ${V} ${f.visita.faltas}. Amarillas: ${L} ${f.local.amarillas}, ${V} ${f.visita.amarillas}.${rojas ? ` Rojas: ${L} ${f.local.rojas}, ${V} ${f.visita.rojas}.` : ""}` : `Sin faltas en los primeros ${s} segundos.`,
    disciplina.length ? `Fouls: ${L} ${f.local.faltas}, ${V} ${f.visita.faltas}. Yellow cards: ${L} ${f.local.amarillas}, ${V} ${f.visita.amarillas}.${rojas ? ` Red cards: ${L} ${f.local.rojas}, ${V} ${f.visita.rojas}.` : ""}` : `No fouls in the first ${s} seconds.`,
    acumulado(disciplina.map(e => e.id), disciplina.length === 0 || lados.some(l => !f[l].faltas)),
    { faltas_local: f.local.faltas, faltas_visita: f.visita.faltas, amarillas_local: f.local.amarillas, amarillas_visita: f.visita.amarillas, rojas_local: f.local.rojas, rojas_visita: f.visita.rojas, segundos: s });

  // cambios: contadores del entrenador en el último fotograma ≤ tick (fuente autoritativa del 044).
  const fotograma = [...registro.fotogramas].reverse().find(x => x.tick <= tick);
  if (fotograma?.entrenadores) {
    const c = Object.fromEntries(lados.map(l => { const e = fotograma.entrenadores![l]; return [l, { usados: e.cambios, ventanas: e.ventanas, restantes: TECNICA_ARENA.maxCambios - e.cambios, ventanasRestantes: TECNICA_ARENA.maxVentanas - e.ventanas }]; })) as Record<"local" | "visita", { usados: number; ventanas: number; restantes: number; ventanasRestantes: number }>;
    const mx = TECNICA_ARENA.maxCambios, mv = TECNICA_ARENA.maxVentanas;
    agregar("cambios", c,
      `Cambios: ${L} ${c.local.usados} de ${mx} en ${c.local.ventanas} de ${mv} ventanas; ${V} ${c.visita.usados} de ${mx} en ${c.visita.ventanas} de ${mv} ventanas.`,
      `Substitutions: ${L} ${c.local.usados} of ${mx} in ${c.local.ventanas} of ${mv} windows; ${V} ${c.visita.usados} of ${mx} in ${c.visita.ventanas} of ${mv} windows.`,
      { eventos: eventos.filter(e => e.tipo === "cambio").map(e => e.id), intervalo: [0, tick], fuente: `fotograma:${fotograma.tick}` },
      { cambios_local: c.local.usados, ventanas_local: c.local.ventanas, cambios_visita: c.visita.usados, ventanas_visita: c.visita.ventanas, max_cambios: mx, max_ventanas: mv, restantes_local: c.local.restantes, restantes_visita: c.visita.restantes });
  }

  // reinicios por tipo
  const reinicios = eventos.filter(e => e.tipo === "reinicio");
  const tipoReinicio = (e: EventoArena) => e.reinicio ?? (e.motivo === "falta" ? "falta" : "portero");
  const tipos = ["centro", "banda", "esquina", "meta", "falta", "portero"] as const;
  const conteo = tipos.map(t => [t, reinicios.filter(e => tipoReinicio(e) === t).length] as const).filter(([, n]) => n > 0);
  const etiqueta = {
    es: { centro: ["saque de centro", "saques de centro"], banda: ["saque de banda", "saques de banda"], esquina: ["saque de esquina", "saques de esquina"], meta: ["saque de meta", "saques de meta"], falta: ["reanudación tras falta", "reanudaciones tras falta"], portero: ["reanudación del portero", "reanudaciones del portero"] },
    en: { centro: ["kick-off", "kick-offs"], banda: ["throw-in", "throw-ins"], esquina: ["corner", "corners"], meta: ["goal kick", "goal kicks"], falta: ["restart after a foul", "restarts after a foul"], portero: ["goalkeeper restart", "goalkeeper restarts"] },
  } as const;
  agregar("reinicios", conteo,
    conteo.length ? `Reinicios: ${conteo.map(([t, n]) => pl(n, etiqueta.es[t][0], etiqueta.es[t][1])).join(", ")}.` : `Sin reinicios en los primeros ${s} segundos.`,
    conteo.length ? `Restarts: ${conteo.map(([t, n]) => pl(n, etiqueta.en[t][0], etiqueta.en[t][1])).join(", ")}.` : `No restarts in the first ${s} seconds.`,
    acumulado(reinicios.map(e => e.id), !conteo.length), Object.fromEntries([...conteo.map(([t, n]) => [`reinicios_${t}`, n]), ["segundos", s]]));

  // pases: distancia media en la ventana; con menos de minAcciones no se emite.
  const pases = enVentana.filter(e => e.tipo === "pase");
  if (pases.length >= MESA_ARENA.minAcciones) {
    const media = Math.round(pases.reduce((t, e) => t + e.distanciaM, 0) / pases.length);
    agregar("pases", media,
      `Distancia media de pase en los últimos ${w} segundos: ${media} metros, en ${pases.length} pases.`,
      `Average pass distance in the last ${w} seconds: ${media} metres, over ${pases.length} passes.`,
      { eventos: pases.map(e => e.id), intervalo: [desde, tick] }, { media_m: media, pases: pases.length, ventana: w });
  }
  return datos;
}

/** Una candidatura agrupa hasta `MESA_ARENA.maxDatosEstadista` datos, en el orden de la tabla.
 * v3.1: solo datos con plaza; el `reloj` nunca es una candidatura por sí mismo. */
export function intervencionEstadista(datos: readonly DatoEstadista[], tick: number): IntervencionArena {
  if (datos.some(d => !d.ocupaPlaza)) throw new Error("Un dato sin plaza no forma candidatura del estadista");
  return {
    id: `estadista:${datos.map(d => d.tema).join("+")}:${tick}`, rol: "estadista", tick, tema: datos.map(d => d.tema).join("+"),
    oraciones: datos.map(d => ({ texto_es: d.texto_es, texto_en: d.texto_en, hecho: d.hecho.id, apoyo: [] })),
    hechos: datos.map(d => d.hecho), evidencia: datos.map(d => d.evidencia), audit: [], modo: "determinista",
  };
}

/** Estado del servidor por sesión. Nada depende de la escucha de un consumidor. */
export class DisparadorEstadista {
  private ultimaEmitidaTick = -1;
  private ultimos = new Map<string, string>();
  /** v1.3 (3) · Revisión por tema y del temporizador: cada escritura la incrementa; un deshacer solo
   * restaura si la revisión sigue siendo la que dejó su propia escritura. */
  private revisiones = new Map<string, number>();
  private revisionTemporizador = 0;
  private temporizador = 0;
  get ultimaCandidaturaTick() { return this.temporizador; }
  set ultimaCandidaturaTick(tick: number) { this.temporizador = tick; this.revisionTemporizador++; }
  private escribir(tema: string, valor: string | undefined) {
    if (valor === undefined) this.ultimos.delete(tema); else this.ultimos.set(tema, valor);
    this.revisiones.set(tema, (this.revisiones.get(tema) ?? 0) + 1);
  }
  constructor(private fuente: (registro: RegistroArena, tick: number) => DatoEstadista[] = datosEstadista) {}
  vence(tick: number, final = false) { return final ? tick !== this.ultimaEmitidaTick : tick - this.ultimaCandidaturaTick >= Math.round(MESA_ARENA.estadistaCadaS / ARENA.pasoS); }
  private cambiado(d: DatoEstadista) { return d.ocupaPlaza && this.ultimos.get(d.tema) !== JSON.stringify(d.valor); }
  /** Al vencer, se rearma SIEMPRE (haya o no candidatura). Un dato solo entra si cambió
   * su valor respecto a la última candidatura del mismo tema; solo compiten los datos con
   * plaza (v3.1: el `reloj` no). Brief 048: con `forzar` vence en este mismo avance (evento
   * `cambio`) y los temas `preferidos` que cambiaron van primero; después, la tabla. */
  evaluar(registro: RegistroArena, tick: number, final = false, opciones: { preferidos?: readonly TemaEstadista[]; forzar?: boolean } = {}): IntervencionArena | null {
    if (!opciones.forzar && !this.vence(tick, final)) return null;
    this.ultimaCandidaturaTick = tick;
    const preferidos = opciones.preferidos ?? [];
    const cambiados = this.fuente(registro, tick).filter(d => this.cambiado(d));
    const datos = [...preferidos.flatMap(t => cambiados.filter(d => d.tema === t)), ...cambiados.filter(d => !preferidos.includes(d.tema))].slice(0, MESA_ARENA.maxDatosEstadista);
    if (!datos.length) return null;
    for (const d of datos) this.escribir(d.tema, JSON.stringify(d.valor));
    this.ultimaEmitidaTick = tick;
    return intervencionEstadista(datos, tick);
  }
  /** Brief 048 · Dato de mesa: consulta SIN consumir el primer dato con plaza y valor cambiado
   * entre `temas`, en ese orden. */
  candidato(registro: RegistroArena, tick: number, temas: readonly string[]): DatoEstadista | undefined {
    const datos = this.fuente(registro, tick);
    for (const tema of temas) { const d = datos.find(d => d.tema === tema && this.cambiado(d)); if (d) return d; }
    return undefined;
  }
  /** Brief 048 v1.1 (7) · El dato sigue vigente si no se emitió su valor y el prefijo vigente
   * conserva ese mismo valor. */
  sigueVigente(dato: DatoEstadista, prefijo: RegistroArena): boolean {
    if (!this.cambiado(dato)) return false;
    const actual = this.fuente(prefijo, prefijo.final.tick).find(d => d.tema === dato.tema);
    return !!actual && JSON.stringify(actual.valor) === JSON.stringify(dato.valor);
  }
  /** Brief 048 · El dato de mesa dicho en una ronda: actualiza `ultimos` (no `ultimaEmitidaTick`,
   * exclusivo de las candidaturas del estadista) y rearma el temporizador con max(actual, tick).
   * Devuelve cómo deshacerlo si la publicación falla. */
  registrar(dato: DatoEstadista, tick: number): () => void {
    const previo = { valor: this.ultimos.get(dato.tema), tick: this.ultimaCandidaturaTick };
    this.escribir(dato.tema, JSON.stringify(dato.valor));
    this.ultimaCandidaturaTick = Math.max(this.ultimaCandidaturaTick, tick);
    const propia = { tema: this.revisiones.get(dato.tema), temporizador: this.revisionTemporizador };
    // v1.3 (3) · Deshacer por revisión: solo se restaura lo que nadie volvió a escribir después (otra
    // emisión del tema o un rearme del temporizador, aunque sea con el mismo valor o el mismo tick).
    return () => {
      if (this.revisiones.get(dato.tema) === propia.tema) this.escribir(dato.tema, previo.valor);
      if (this.revisionTemporizador === propia.temporizador) this.ultimaCandidaturaTick = previo.tick;
    };
  }
}
