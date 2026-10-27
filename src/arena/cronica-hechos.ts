// Brief 064 § 4.2 · Analista de arena: convierte un registro COMPLETO de la arena en hechos verificables para la crónica
// (código determinista, sin LLM). Catálogo cerrado: resultado, goles, autogoles, varios goles, expulsiones, final
// anticipado, remates, atajadas, remates lejanos, amarillas, balones largos, cambios y fueras de juego.
//
// Reglas del catálogo (§ 4.2, v1.1 y v1.2):
// - `local`, `visita`, `equipo` y `beneficiado` son NOMBRES de club (el Verificador los compara con los del resultado);
//   en un autogol, `equipo` = club del autor (el que lo sufre) y `beneficiado` = club del lado del evento.
// - El tiro de un gol se identifica por posición (`tiroDelGol`); `metros` = recorrido del remate; `distancia_m` (la
//   clave de «desde fuera del área») solo si el remate salió de fuera del área rival por geometría.
// - Ninguna clave temporal histórica (`minuto`, `desde`, `hasta`, `minuto_desventaja`, `minutos`, `periodo`) ni ticks.
// - Cada texto empieza por una palabra de FUNCIONALES o por un nombre del plantel; el tiempo va como «a los 34 s».
// - Ids `c01…` por relevancia descendente, luego tick del primer evento, luego orden de la tabla.
//
// `seleccionCronicaArena` es LA selección (catálogo → maxHechos → ajuste a maxCaracteresEntrada) que usan la
// generación, el GET y la página: un solo cálculo determinista para generar y para leer (v1.2).

import { COBERTURA } from "../cadena/umbrales";
import { mensajeInicial, SYSTEM_PROMPT } from "../cadena/prompt";
import type { HechoVerificable } from "../cadena/verificador";
import { ARENA, CRONICA_ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { enAreaRival } from "./ataque";
import { rematesPorLado } from "./estadista";
import type { EvidenciaMesa } from "./protocolo";
import { tiroDelGol } from "./relato";
import { lados, type EventoArena, type JugadorArena, type RegistroArena } from "./tipos";

export interface HechoCronicaArena { hecho: HechoVerificable; evidencia: EvidenciaMesa }

/** Un registro completo cubre la duración configurada (o terminó antes por final anticipado). Movida de grabaciones. */
export const registroCompleto = (r: Pick<RegistroArena, "config" | "final">): boolean =>
  r.final.tick >= Math.round(r.config.duracionS / ARENA.pasoS) || Boolean(r.final.finalizado);

/**
 * § 4.5 · System prompt de la crónica de arena: el de la cadena + un anexo fijo (ES y EN en la misma cadena). Es una
 * constante (v1.2: la selección lo usa para medir la entrada); la duración exacta la da el hecho del resultado.
 */
export const SISTEMA_CRONICA_ARENA = `${SYSTEM_PROMPT}

ANEXO PARA LA ARENA: Es un encuentro sintético de unos pocos segundos en un motor 2D; su duración en segundos está en el hecho del resultado (duracion_s). El tiempo se cuenta en segundos («a los 34 s»), nunca en minutos ni en tiempos; no hay primer ni segundo tiempo. No nombres entrenadores, árbitro, modelos ni controladores. No afirmes persecuciones, presión, intenciones, tácticas ni causas: solo lo que dice cada hecho.
ARENA ANNEX: This is a synthetic match of a few seconds in a 2D engine; its length in seconds is in the result fact (duracion_s). Time is counted in seconds ("after 34 s"), never in minutes or halves; there is no first or second half. Do not name coaches, the referee, models or controllers. Do not claim chasing, pressing, intentions, tactics or causes: only what each fact says.`;

const R = CRONICA_ARENA.relevancia;
/** Orden de la tabla del § 4.2 (desempate final). */
const ORDEN_TABLA = ["resultado", "gol", "autogol", "varios", "expulsion", "finalAnticipado", "remates", "atajadas", "lejano", "amarilla", "largos", "cambio", "fueraJuego"] as const;
type Clase = (typeof ORDEN_TABLA)[number];

/** `⌊tick · pasoS + 1e-9⌋`, como `segundosDe` del estadista. */
export const segundoArena = (tick: number): number => Math.floor(tick * ARENA.pasoS + 1e-9);

interface Candidato { clase: Clase; tick: number; texto_es: string; texto_en: string; datos: Record<string, string | number>; eventos: string[]; evidencia?: Omit<EvidenciaMesa, "eventos"> }

function plantillaDe(registro: RegistroArena): Map<string, JugadorArena> {
  return new Map([...registro.inicial.jugadores, ...(registro.inicial.banco ?? [])].map((j) => [j.id, j] as const));
}

/** Desenlace de un tiro: el primer gol/atajada/tiro_fuera posterior que le corresponde, sin otro tiro en medio. */
function desenlace(eventos: readonly EventoArena[], i: number): EventoArena | undefined {
  const t = eventos[i]!;
  for (const d of eventos.slice(i + 1)) {
    if (d.tipo === "tiro") return undefined;
    if (d.tipo === "gol" && d.lado === t.lado && d.jugador === t.jugador) return d;
    if (d.tipo === "atajada" && d.receptor === t.jugador) return d;
    if (d.tipo === "tiro_fuera" && d.jugador === t.jugador) return d;
    if (d.tipo === "gol" || d.tipo === "atajada" || d.tipo === "tiro_fuera") return undefined;
  }
  return undefined;
}

const vez = (n: number) => (n === 1 ? "1 vez" : `${n} veces`);

/** El catálogo completo del registro (antes de recortes), ordenado y con ids `c01…`. Lanza con un registro incompleto. */
export function hechosCronicaArena(registro: RegistroArena): HechoCronicaArena[] {
  if (!registroCompleto(registro)) throw new Error("hechosCronicaArena: el registro no está completo");
  const plantilla = plantillaDe(registro);
  const club: Record<Lado, string> = { local: registro.config.partido.local.nombre, visita: registro.config.partido.visita.nombre };
  const L = club.local, V = club.visita;
  const eventos = registro.eventos;
  const indice = new Map(eventos.map((e, i) => [e.id, i] as const));
  const enOrden = (ids: string[]) => [...new Set(ids)].filter((id) => indice.has(id)).sort((a, b) => indice.get(a)! - indice.get(b)!);
  const jug = (id: string) => plantilla.get(id);
  const nd = (j: JugadorArena) => `${j.nombre} (${j.dorsal})`;
  const c: Candidato[] = [];

  // Resultado
  const goles = eventos.filter((e) => e.tipo === "gol");
  const fin = eventos.find((e) => e.tipo === "final_anticipado");
  const gl = registro.final.marcador.local, gv = registro.final.marcador.visita;
  const duracion = segundoArena(registro.final.tick);
  const evResultado = enOrden([...goles.map((g) => g.id), ...(fin ? [fin.id] : [])]);
  c.push({
    clase: "resultado", tick: evResultado.length ? eventos[indice.get(evResultado[0]!)!]!.tick : 0,
    texto_es: `Final: ${L} ${gl}, ${V} ${gv}, en ${duracion} s de juego.`,
    texto_en: `Final score: ${L} ${gl}, ${V} ${gv}, after ${duracion} s of play.`,
    datos: { local: L, visita: V, goles_local: gl, goles_visita: gv, duracion_s: duracion },
    eventos: evResultado,
    ...(evResultado.length === 0 ? { evidencia: { intervalo: [0, registro.final.tick] as [number, number], fuente: "inicial" } } : {}),
  });

  // Goles y autogoles (marcador por posición: inicial + goles hasta este, inclusive)
  const marcador = { ...registro.inicial.marcador };
  const porGoleador = new Map<string, EventoArena[]>();
  for (const e of eventos) {
    if (e.tipo !== "gol") continue;
    marcador[e.lado]++;
    const j = jug(e.jugador);
    if (!j) continue;
    const s = segundoArena(e.tick);
    const m = `${L} ${marcador.local}, ${V} ${marcador.visita}`;
    if (e.autogol) {
      const autor = club[j.lado], beneficiado = club[e.lado];
      c.push({
        clase: "autogol", tick: e.tick,
        texto_es: `Gol en propia puerta de ${nd(j)}, de ${autor}, a los ${s} s: ${m}.`,
        texto_en: `An own goal by ${nd(j)}, of ${autor}, after ${s} s: ${m}.`,
        datos: { local: L, visita: V, jugador: j.nombre, dorsal: j.dorsal, equipo: autor, beneficiado, segundo: s, marcador_local: marcador.local, marcador_visita: marcador.visita },
        eventos: [e.id],
      });
      continue;
    }
    const tiro = tiroDelGol(e, registro);
    const metros = tiro ? Math.round(tiro.distanciaM) : undefined;
    const fuera = tiro !== null && !enAreaRival(tiro.desde, tiro.lado);
    // Brief 070 § 2.C (reinicios-v11): el gol de penal lo dice y cita también la falta (`fuentes` del tiro).
    const penal = tiro?.motivo === "penal";
    const conRemate = metros !== undefined ? (penal ? { es: `, de penal, con un remate de ${metros} m`, en: `, from the penalty spot, with a ${metros} m shot` } : { es: `, con un remate de ${metros} m`, en: `, with a ${metros} m shot` }) : { es: "", en: "" };
    c.push({
      clase: "gol", tick: tiro?.tick ?? e.tick,
      texto_es: `Gol de ${nd(j)} para ${club[e.lado]} a los ${s} s${conRemate.es}; marcador: ${m}.`,
      texto_en: `Goal by ${nd(j)} for ${club[e.lado]} after ${s} s${conRemate.en}; score: ${m}.`,
      datos: { local: L, visita: V, jugador: j.nombre, dorsal: j.dorsal, equipo: club[e.lado], segundo: s, marcador_local: marcador.local, marcador_visita: marcador.visita,
        ...(metros !== undefined ? { metros } : {}), ...(fuera && metros !== undefined ? { distancia_m: metros } : {}) },
      eventos: enOrden([...(penal ? tiro!.fuentes ?? [] : []), ...(tiro ? [tiro.id] : []), e.id]),
    });
    porGoleador.set(e.jugador, [...(porGoleador.get(e.jugador) ?? []), e]);
  }

  // Varios goles del mismo jugador (sin autogoles)
  for (const [id, gs] of porGoleador) {
    if (gs.length < 2) continue;
    const j = jug(id)!;
    const equipo = club[gs[0]!.lado];
    c.push({
      clase: "varios", tick: gs[0]!.tick,
      texto_es: `${j.nombre} marcó ${gs.length} goles para ${equipo}.`,
      texto_en: `${j.nombre} scored ${gs.length} goals for ${equipo}.`,
      datos: { jugador: j.nombre, equipo, goles: gs.length },
      eventos: enOrden(gs.map((g) => g.id)),
    });
  }

  // Expulsiones (+ la falta del mismo jugador con el mismo tick)
  for (const e of eventos) {
    if (e.tipo !== "roja") continue;
    const j = jug(e.jugador);
    if (!j) continue;
    const s = segundoArena(e.tick);
    const falta = eventos.find((f) => f.tipo === "falta" && f.jugador === e.jugador && f.tick === e.tick && (e.fuentes ?? []).includes(f.id))
      ?? eventos.find((f) => f.tipo === "falta" && f.jugador === e.jugador && f.tick === e.tick);
    c.push({
      clase: "expulsion", tick: e.tick,
      texto_es: `Roja para ${nd(j)}, de ${club[e.lado]}, a los ${s} s.`,
      texto_en: `Red card for ${nd(j)}, of ${club[e.lado]}, after ${s} s.`,
      datos: { jugador: j.nombre, dorsal: j.dorsal, equipo: club[e.lado], segundo: s },
      eventos: enOrden([...(falta ? [falta.id] : []), e.id]),
    });
  }

  // Final anticipado
  if (fin) {
    const s = segundoArena(fin.tick);
    const quedan = registro.final.jugadores.filter((j) => j.lado === fin.lado).length;
    c.push({
      clase: "finalAnticipado", tick: fin.tick,
      texto_es: `Final anticipado a los ${s} s: ${club[fin.lado]} se quedó con ${quedan} jugadores.`,
      texto_en: `Final whistle after ${s} s: ${club[fin.lado]} were left with ${quedan} players.`,
      datos: { equipo: club[fin.lado], segundo: s, jugadores: quedan },
      eventos: [fin.id],
    });
  }

  // Remates (rematesPorLado del estadista, hasta el final)
  const rem = rematesPorLado(eventos, registro.final.tick);
  if (rem.local.total + rem.visita.total >= 1) {
    const ids = enOrden([...rem.local.eventos, ...rem.visita.eventos]);
    const es = (n: string, r: { total: number; aPuerta: number }) => `${n} remató ${vez(r.total)}, ${r.aPuerta} a puerta`;
    const en = (n: string, r: { total: number; aPuerta: number }) => `${n} had ${r.total} ${r.total === 1 ? "shot" : "shots"}, ${r.aPuerta} on target`;
    c.push({
      clase: "remates", tick: eventos[indice.get(ids[0]!)!]!.tick,
      texto_es: `${es(L, rem.local)}; ${es(V, rem.visita)}.`,
      texto_en: `${en(L, rem.local)}; ${en(V, rem.visita)}.`,
      datos: { local: L, visita: V, remates_local: rem.local.total, a_puerta_local: rem.local.aPuerta, remates_visita: rem.visita.total, a_puerta_visita: rem.visita.aPuerta },
      eventos: ids,
    });
  }

  // Atajadas de cada portero (todas las `atajada` del jugador)
  const atajadas = new Map<string, EventoArena[]>();
  for (const e of eventos) if (e.tipo === "atajada") atajadas.set(e.jugador, [...(atajadas.get(e.jugador) ?? []), e]);
  for (const [id, as] of atajadas) {
    const j = jug(id);
    if (!j) continue;
    const equipo = club[j.lado];
    c.push({
      clase: "atajadas", tick: as[0]!.tick,
      texto_es: `Atajadas de ${nd(j)}, de ${equipo}: ${as.length}.`,
      texto_en: `Saves by ${nd(j)}, of ${equipo}: ${as.length}.`,
      datos: { jugador: j.nombre, dorsal: j.dorsal, equipo, atajadas: as.length },
      eventos: enOrden(as.map((a) => a.id)),
    });
  }

  // Remates lejanos (v7+): los maxPorClase.lejanos de más metros (a igual metros, el primero)
  const lejanos = eventos.map((e, i) => ({ e, i })).filter((x) => x.e.tipo === "tiro" && x.e.motivo === "lejano" && jug(x.e.jugador))
    .sort((a, b) => Math.round(b.e.distanciaM) - Math.round(a.e.distanciaM) || a.i - b.i).slice(0, CRONICA_ARENA.maxPorClase.lejanos);
  for (const { e, i } of lejanos) {
    const j = jug(e.jugador)!;
    const s = segundoArena(e.tick), metros = Math.round(e.distanciaM);
    const d = desenlace(eventos, i);
    c.push({
      clase: "lejano", tick: e.tick,
      texto_es: `${nd(j)} remató desde ${metros} m a los ${s} s.`,
      texto_en: `${nd(j)} shot from ${metros} m after ${s} s.`,
      datos: { jugador: j.nombre, dorsal: j.dorsal, equipo: club[e.lado], segundo: s, metros, ...(!enAreaRival(e.desde, e.lado) ? { distancia_m: metros } : {}) },
      eventos: enOrden([e.id, ...(d ? [d.id] : [])]),
    });
  }

  // Amarillas (las primeras maxPorClase.amarillas)
  for (const e of eventos.filter((x) => x.tipo === "amarilla" && jug(x.jugador)).slice(0, CRONICA_ARENA.maxPorClase.amarillas)) {
    const j = jug(e.jugador)!;
    const s = segundoArena(e.tick);
    c.push({
      clase: "amarilla", tick: e.tick,
      texto_es: `Amarilla para ${nd(j)}, de ${club[e.lado]}, a los ${s} s.`,
      texto_en: `Yellow card for ${nd(j)}, of ${club[e.lado]}, after ${s} s.`,
      datos: { jugador: j.nombre, dorsal: j.dorsal, equipo: club[e.lado], segundo: s },
      eventos: [e.id],
    });
  }

  // Balones largos por equipo (v7+)
  for (const lado of lados) {
    const ls = eventos.filter((e) => e.tipo === "pase" && e.motivo === "largo" && e.lado === lado);
    if (ls.length === 0) continue;
    c.push({
      clase: "largos", tick: ls[0]!.tick,
      texto_es: `${club[lado]} jugó ${ls.length === 1 ? "1 balón largo" : `${ls.length} balones largos`}.`,
      texto_en: `${club[lado]} played ${ls.length === 1 ? "1 long ball" : `${ls.length} long balls`}.`,
      datos: { equipo: club[lado], balones_largos: ls.length },
      eventos: ls.map((e) => e.id),
    });
  }

  // Cambios (los primeros maxPorClase.cambios); `jugador` entra, `sale` sale
  for (const e of eventos.filter((x) => x.tipo === "cambio" && jug(x.jugador) && x.sale && jug(x.sale)).slice(0, CRONICA_ARENA.maxPorClase.cambios)) {
    const entra = jug(e.jugador)!, sale = jug(e.sale!)!;
    const s = segundoArena(e.tick);
    c.push({
      clase: "cambio", tick: e.tick,
      texto_es: `En ${club[e.lado]} entró ${entra.nombre} por ${sale.nombre} a los ${s} s.`,
      texto_en: `In ${club[e.lado]}, ${entra.nombre} replaced ${sale.nombre} after ${s} s.`,
      datos: { equipo: club[e.lado], entra: entra.nombre, sale: sale.nombre, segundo: s },
      eventos: [e.id],
    });
  }

  // Fueras de juego por equipo
  for (const lado of lados) {
    const fs = eventos.filter((e) => e.tipo === "fuera_juego" && e.lado === lado);
    if (fs.length === 0) continue;
    c.push({
      clase: "fueraJuego", tick: fs[0]!.tick,
      texto_es: `${club[lado]} incurrió ${vez(fs.length)} en fuera de juego.`,
      texto_en: `${club[lado]} were caught offside ${fs.length === 1 ? "1 time" : `${fs.length} times`}.`,
      datos: { equipo: club[lado], fueras_de_juego: fs.length },
      eventos: fs.map((e) => e.id),
    });
  }

  const orden = c.map((x, k) => ({ x, k })).sort((a, b) =>
    R[b.x.clase] - R[a.x.clase] || a.x.tick - b.x.tick || ORDEN_TABLA.indexOf(a.x.clase) - ORDEN_TABLA.indexOf(b.x.clase) || a.k - b.k);
  return orden.map(({ x }, n) => {
    const id = `c${String(n + 1).padStart(2, "0")}`;
    const ids = x.eventos;
    return {
      hecho: { id, tipo: tipoDe(x.clase), texto_es: x.texto_es, texto_en: x.texto_en, eventos: ids, relevancia: R[x.clase], datos: x.datos } as HechoVerificable,
      evidencia: { eventos: ids, ...(x.evidencia ?? {}) },
    };
  });
}

function tipoDe(clase: Clase): HechoVerificable["tipo"] {
  switch (clase) {
    case "resultado": return "resultado_final";
    case "gol": return "gol_anotado";
    case "autogol": return "autogol";
    case "varios": return "doblete_o_mas";
    default: return "accion_arena";
  }
}

/** ¿El hecho es de narración obligatoria (V5)? */
export const esObligatorio = (h: Pick<HechoVerificable, "relevancia">): boolean => h.relevancia >= COBERTURA;

/** Caracteres de la entrada inicial (system + mensaje inicial) para estos hechos. */
export const caracteresEntrada = (hechos: readonly HechoCronicaArena[]): number =>
  SISTEMA_CRONICA_ARENA.length + mensajeInicial(hechos.map((h) => h.hecho)).length;

/**
 * v1.2 · LA selección: catálogo → maxHechos (los obligatorios siempre) → quitar el no obligatorio de menor relevancia
 * mientras la entrada no quepa en maxCaracteresEntrada. Como el catálogo está ordenado por relevancia descendente, el
 * resultado es siempre un prefijo (los ids siguen consecutivos). `cabe: false` = ni los obligatorios caben (acta
 * `tamano`); entonces `hechos` son los obligatorios.
 */
export function seleccionCronicaArena(registro: RegistroArena): { hechos: HechoCronicaArena[]; cabe: boolean } {
  const todos = hechosCronicaArena(registro);
  const obligatorios = todos.filter((h) => esObligatorio(h.hecho)).length;
  let n = Math.max(obligatorios, Math.min(todos.length, CRONICA_ARENA.maxHechos));
  while (n > obligatorios && caracteresEntrada(todos.slice(0, n)) > CRONICA_ARENA.maxCaracteresEntrada) n--;
  const hechos = todos.slice(0, n);
  return { hechos, cabe: caracteresEntrada(hechos) <= CRONICA_ARENA.maxCaracteresEntrada };
}
