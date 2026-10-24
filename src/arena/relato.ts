import { hechosArena, type HechoArena } from "./inteligencia";
import { amenazaConBalon, expresionEvento, varianteVoz, type FragmentoVoz, type TramoCanto } from "./expresion";
import { RELATO_INTERVALOS } from "./protocolo";
import type { EstadoArena, EventoArena, RegistroArena } from "./tipos";
import type { Lado } from "../sim/tipos";
import { prngDerivado } from "../sim/prng";
import { ARENA, CANTO_GOL, MESA_ARENA, PRIORIDAD_EVENTO_ARENA, REPETICION_NARRADA } from "../sim/limites";
import type { IntervencionArena, VarianteIntercambio } from "./protocolo";
import { varianteEfectiva } from "./turnos";
import { comentarioEditorial, elegirVarianteVoz, type RecuerdoVoz } from "./editorial";

export const RELATO_INTERVALO_TICKS = RELATO_INTERVALOS.completo;
const importantes = new Set(["gol", "tiro", "atajada", "tiro_fuera", "falta", "amarilla", "roja", "cambio", "fuera_juego", "final_anticipado"]);

function textoEvento(h: HechoArena, e: EventoArena, registro: RegistroArena, idioma: "es" | "en", variante: number, breve: boolean) {
  const jugadores = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []];
  const j = jugadores.find(j => j.id === e.jugador)?.nombre, receptor = jugadores.find(j => j.id === e.receptor)?.nombre;
  if (!j) return idioma === "es" ? h.texto_es : h.texto_en;
  const es = idioma === "es";
  // Brief 050: el gol se canta con `cantoGol`; aquí solo llega si el goleador no está en la plantilla.
  if (e.autogol || e.motivo === "desvio") return es ? h.texto_es : h.texto_en;
  if (e.tipo === "atajada") return (es ? [`¡Ataja ${j}!`, `¡${j} detiene el remate!`, `¡El remate lo ataja ${j}!`, `¡Atajada de ${j}!`] : [`${j} makes the save!`, `${j} stops the shot!`, `The shot is saved by ${j}!`, `A save by ${j}!`])[variante]!;
  if (breve && e.tipo === "tiro") return (es ? [`¡Remata ${j}!`, `¡Disparo de ${j}!`, `¡${j} prueba el remate!`, `¡Le pega ${j}!`] : [`${j} shoots!`, `An attempt from ${j}!`, `${j} takes the shot!`, `${j} goes for goal!`])[variante]!;
  // Brief 051: el remate por encima del travesaño (reinicios-v5) tiene sus propias variantes breves.
  if (breve && e.tipo === "tiro_fuera" && e.motivo === "alto") return (es ? [`¡Alto el remate de ${j}!`, `¡Se va por encima el disparo de ${j}!`, `¡${j} la manda por encima del travesaño!`, `¡Por encima! Remate de ${j}.`] : [`${j} blazes it over!`, `${j}'s shot sails over the bar!`, `Over the bar from ${j}!`, `${j} lifts it over!`])[variante]!;
  if (breve && e.tipo === "fuera_juego") return (es ? [`Fuera de juego de ${j}.`, `Señalan posición adelantada de ${j}.`, `${j} estaba en fuera de juego.`, `La acción se detiene: fuera de juego de ${j}.`] : [`${j} is offside.`, `Offside against ${j}.`, `${j} was caught offside.`, `Play stops for offside against ${j}.`])[variante]!;
  // Brief 046: el centro tiene frase breve propia; el saque desde las manos usa el texto de `vista`.
  if (breve && e.tipo === "pase" && e.motivo === "centro") return es ? `¡Centro de ${j}!` : `${j} sends in a cross!`;
  if (e.tipo === "pase" && e.motivo === "saque_manos") return es ? h.texto_es : h.texto_en;
  if (breve && e.tipo === "pase" && receptor) return es ? `${j} busca a ${receptor}.` : `${j} looks for ${receptor}.`;
  if (breve && e.tipo === "recepcion") return es ? `Recibe ${j}.` : `${j} receives it.`;
  return es ? h.texto_es : h.texto_en;
}

/** Brief 050 · Situación del marcador tras un gol, en el orden de resolución del brief. */
export type SituacionGol = keyof typeof CANTO_GOL.plantillas.situacion.es;
type Marcador = { local: number; visita: number };
const rellenar = (plantilla: string, valores: Record<string, string | number>) => plantilla.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k]));

/** Marcador registrado tras el gol del `tick`: inicial + goles con tick ≤ `tick` (misma fórmula
 * que el cierre y el estadista). Nada posterior al tick entra. */
export function marcadorTrasGol(registro: RegistroArena, tick: number): Marcador {
  const marcador = { ...registro.inicial.marcador };
  for (const e of registro.eventos) if (e.tipo === "gol" && e.tick <= tick) marcador[e.lado]++;
  return marcador;
}

/** Solo desde el marcador: `a` después del gol de `lado`, `b` antes (a con a[lado] − 1). */
export function situacionGol(lado: Lado, a: Marcador): SituacionGol {
  const o: Lado = lado === "local" ? "visita" : "local", b = { ...a, [lado]: a[lado] - 1 } as Marcador;
  if (a[lado] === a[o]) return "empate";
  if (a[lado] < a[o]) return "recorte";
  if (a[lado] - a[o] >= CANTO_GOL.goleadaDesde) return "goleada";
  if (b[lado] > b[o]) return "ampliacion";
  if (b[lado] + b[o] === 0) return "apertura";
  return "ventaja";
}

/** «Sobre el final»: misma regla que la intensidad 1 de `expresionEvento`. */
export function golTardio(tick: number, duracionS: number, a: Marcador): boolean {
  return tick * ARENA.pasoS >= CANTO_GOL.tardioDesdeFraccion * duracionS && Math.abs(a.local - a.visita) <= CANTO_GOL.tardioDiferenciaMax;
}

/** Marcador hablado en el orden del visual (local, visita): palabras hasta numerosEnPalabrasHasta. */
export function marcadorHablado(m: Marcador, idioma: "es" | "en"): string {
  const n = (x: number) => x >= 0 && x <= CANTO_GOL.numerosEnPalabrasHasta ? CANTO_GOL.plantillas.numeros[idioma][x]! : String(x);
  return rellenar(CANTO_GOL.plantillas.marcador[idioma], { local: n(m.local), visita: n(m.visita) });
}

/** Brief 054 · Condiciones de los gritos condicionados (solo desde el registro). */
export type CondicionGrito = "remate" | "golazo" | "tardio" | "empate" | "otro";
/** Brief 054 · Entrada del catálogo `CANTO_GOL.gritos` (ES/EN paralelos). */
export interface GritoCanto { clave: string; condicion?: CondicionGrito; prioridad?: number; es: { texto: string; rate: number }; en: { texto: string; rate: number } }
/** El catálogo leído en tiempo de ejecución, con el tipo común de sus entradas. */
export const catalogoGritos = (): readonly GritoCanto[] => CANTO_GOL.gritos;

/** Índice del gol en `registro.eventos` (por identidad; si es una copia, por id). */
function indiceEvento(registro: RegistroArena, evento: EventoArena): number {
  const i = registro.eventos.indexOf(evento);
  return i >= 0 ? i : registro.eventos.findIndex(e => e.id === evento.id);
}

/** Brief 054 v1.1 · «Remate y gol», por POSICIÓN en `registro.eventos`: el evento anterior más cercano
 * del goleador es un `tiro` con tick ≤ el del gol y el mismo `desde`, y entre los índices del tiro y del
 * gol no hay ningún evento de `CANTO_GOL.gritoRemate.tiposQueRompen`. Lo posterior al gol no cuenta. */
export function golDeRemate(gol: EventoArena, registro: RegistroArena): boolean {
  if (gol.tipo !== "gol") return false;
  const rompen: readonly string[] = CANTO_GOL.gritoRemate.tiposQueRompen;
  for (let k = indiceEvento(registro, gol) - 1; k >= 0; k--) {
    const e = registro.eventos[k]!;
    if (e.jugador === gol.jugador) return e.tipo === "tiro" && e.tick <= gol.tick && e.desde.x === gol.desde.x && e.desde.y === gol.desde.y;
    if (rompen.includes(e.tipo)) return false;
  }
  return false;
}

/** Brief 054 · «Golazo» por definición: remate cuya distancia en profundidad del origen a la línea de
 * meta (|hasta.x − desde.x|) es ≥ CANTO_GOL.golazoDesdeM. No mide belleza, ángulo ni dificultad. */
export function golazo(gol: EventoArena, registro: RegistroArena): boolean {
  return golDeRemate(gol, registro) && Math.abs(gol.hasta.x - gol.desde.x) >= CANTO_GOL.golazoDesdeM;
}

/** Brief 054 · Las cinco condiciones de un gol, con `a` = marcador tras el gol. */
export function condicionesGrito(gol: EventoArena, registro: RegistroArena): Record<CondicionGrito, boolean> {
  const a = marcadorTrasGol(registro, gol.tick), situacion = situacionGol(gol.lado, a);
  return {
    remate: golDeRemate(gol, registro),
    golazo: golazo(gol, registro),
    tardio: golTardio(gol.tick, registro.config.duracionS, a),
    empate: situacion === "empate",
    otro: situacion === "ampliacion" || situacion === "goleada",
  };
}

/** Brief 054 · Orden del partido de los gritos sin prioridad: por `prngDerivado(seed, semillaGritos:clave)`. */
export function ordenGritos(seed: number): string[] {
  return catalogoGritos().map((g, i) => ({ g, i })).filter(x => x.g.prioridad === undefined)
    .map(x => ({ ...x, r: prngDerivado(seed, `${CANTO_GOL.semillaGritos}:${x.g.clave}`).next() }))
    .sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.g.clave);
}

/** Brief 054 · Grito de cada gol no autogol del registro, en orden (tick, posición): sin repetir hasta
 * agotar los elegibles; un condicionado con prioridad disponible gana (menor número); si no, el primero
 * disponible en el orden del partido. Solo depende del registro: los tres modos, la transcripción y dos
 * espectadores oyen la misma secuencia. Un gol posterior nunca cambia el grito de uno anterior. La
 * selección no depende del idioma (las claves son comunes). */
export function gritosPartido(registro: RegistroArena, _idioma: "es" | "en"): Map<string, string> {
  const catalogo = catalogoGritos(), orden = ordenGritos(registro.config.partido.seed);
  const goles = registro.eventos.map((e, i) => ({ e, i })).filter(x => x.e.tipo === "gol" && !x.e.autogol).sort((a, b) => a.e.tick - b.e.tick || a.i - b.i);
  const usados = new Set<string>(), mapa = new Map<string, string>();
  for (const { e } of goles) {
    const condiciones = condicionesGrito(e, registro);
    const elegibles = catalogo.filter(g => !g.condicion || condiciones[g.condicion]);
    let disponibles = elegibles.filter(g => !usados.has(g.clave));
    if (!disponibles.length) { usados.clear(); disponibles = elegibles; }
    const prioritario = disponibles.filter(g => g.prioridad !== undefined).sort((a, b) => a.prioridad! - b.prioridad!)[0];
    const elegido = prioritario ?? orden.map(c => disponibles.find(g => g.clave === c)).find(g => g !== undefined)!;
    usados.add(elegido.clave); mapa.set(e.id, elegido.clave);
  }
  return mapa;
}

/** Brief 050 v1.1 · Canto de un gol: tramos grito + goleador (o autogol, sin grito) + hechos, con
 * `texto` = tramos unidos por un espacio. `goleador` sale de `evento.jugador`; `equipo`, de
 * `config.partido[evento.lado]` (en un autogol, el equipo beneficiado). Un desvío canta normal.
 * Brief 054: el grito sale de `gritosPartido(registro, idioma)` (las cuatro variantes lo comparten) y
 * el tramo lleva su clave. Devuelve null si el goleador no está en la plantilla (inicial ∪ banco) o si
 * el gol no está en `registro.eventos` (sin grito asignado). */
export function cantoGol(evento: EventoArena, registro: RegistroArena, idioma: "es" | "en", variante: number): { texto: string; tramos: TramoCanto[] } | null {
  if (evento.tipo !== "gol") return null;
  const p = CANTO_GOL.plantillas;
  const goleador = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []].find(j => j.id === evento.jugador)?.nombre;
  if (!goleador) return null;
  const clave = evento.autogol ? undefined : gritosPartido(registro, idioma).get(evento.id);
  const grito = clave === undefined ? undefined : catalogoGritos().find(g => g.clave === clave);
  if (!evento.autogol && !grito) return null;
  const equipo = registro.config.partido[evento.lado].nombre, a = marcadorTrasGol(registro, evento.tick);
  const tardio = golTardio(evento.tick, registro.config.duracionS, a);
  const plantillaSituacion: string = p.situacion[idioma][situacionGol(evento.lado, a)];
  // Tras el prefijo, la plantilla que empieza por palabra (no por el equipo) va en minúscula.
  const situacion = rellenar(tardio && !plantillaSituacion.startsWith("{") ? plantillaSituacion[0]!.toLowerCase() + plantillaSituacion.slice(1) : plantillaSituacion, { equipo });
  const hechos = rellenar(p.hechos[idioma], { situacion: (tardio ? p.tardio[idioma] : "") + situacion, marcador: marcadorHablado(a, idioma), segundos: Math.floor(evento.tick * ARENA.pasoS + 1e-9) });
  const tramos: TramoCanto[] = evento.autogol
    ? [{ texto: rellenar(p.autogol[idioma], { goleador }), tipo: "autogol" }, { texto: hechos, tipo: "hechos" }]
    : [{ texto: grito![idioma].texto, tipo: "grito", grito: grito!.clave }, { texto: rellenar(p.goleador[idioma][variante % p.goleador[idioma].length]!, { goleador }), tipo: "goleador" }, { texto: hechos, tipo: "hechos" }];
  return { texto: tramos.map(t => t.texto).join(" "), tramos };
}

/** Posesión continua y avance comprobados en estados ya publicados. */
function conducciones(registro: RegistroArena, hastaTick: number, idioma: "es" | "en"): FragmentoVoz[] {
  const frames = registro.fotogramas.filter(f => f.tick <= hastaTick);
  const resultado: FragmentoVoz[] = []; let ultimoTick = -40;
  for (let i = 0; i < frames.length; i++) {
    const actual = frames[i]!;
    if (actual.tick - ultimoTick < 40 || actual.balon.vuelo || actual.pausa && actual.pausa.hastaTick > actual.tick) continue;
    let indice = i - 1;
    while (indice >= 0 && frames[indice]!.tick > actual.tick - 10) indice--;
    if (indice < 0) continue;
    const antes = frames[indice]!, id = actual.balon.poseedor;
    if (actual.tick - antes.tick > 15) continue;
    if (!id || frames.slice(indice, i + 1).some(f => f.balon.poseedor !== id || f.balon.vuelo || f.pausa && f.pausa.hastaTick > f.tick)) continue;
    const j = actual.jugadores.find(j => j.id === id), previo = antes.jugadores.find(j => j.id === id);
    if (!j || !previo) continue;
    const sentido = j.lado === "local" ? 1 : -1;
    const avance = j.lado === "local" ? j.posicion.x / ARENA.largoM : (ARENA.largoM - j.posicion.x) / ARENA.largoM;
    if (avance < 0.75 || sentido * j.velocidad.x < 1 || sentido * (j.posicion.x - previo.posicion.x) < 2) continue;
    const variante = varianteVoz(registro.config.partido.seed, `conduccion:${id}:${actual.tick}`);
    const texto = (idioma === "es" ? [`${j.nombre} avanza hacia el área.`, `¡Progresa ${j.nombre} con el balón!`, `${j.nombre} lleva el balón hacia el área.`, `¡Sigue avanzando ${j.nombre}!`] : [`${j.nombre} advances towards the box.`, `${j.nombre} drives forward with the ball!`, `${j.nombre} carries the ball towards the box.`, `${j.nombre} keeps advancing!`])[variante]!;
    resultado.push({ tick: actual.tick, texto, emocion: "tension", intensidad: Math.max(0.5, amenazaConBalon(actual, j.lado)), variante, fuentes: [], fotogramas: [antes.tick, actual.tick] });
    ultimoTick = actual.tick;
  }
  return resultado;
}

/** Cada frase usa únicamente hechos y estados anteriores o simultáneos a su tick. */
export function construirRelato(registro: RegistroArena, desdeTick: number, hastaTick: number, modo: "vivo" | "completo" | "buffer", idioma: "es" | "en", opciones: { cierre?: boolean; entradaTick?: number; memoria?: readonly RecuerdoVoz[]; evento?: string } = {}) {
  const intervalo = RELATO_INTERVALOS[modo];
  // Compatibilidad con clientes anteriores que pedían ventanas vivas de 10 s.
  const legado = modo === "vivo" && desdeTick % 100 === 0 && hastaTick <= desdeTick + 100;
  if (!Number.isInteger(desdeTick) || desdeTick < 0 || !Number.isInteger(hastaTick) || hastaTick <= desdeTick || hastaTick > registro.final.tick || !(desdeTick % intervalo === 0 && hastaTick <= desdeTick + intervalo || legado)) throw new Error("Ventana de relato no publicada o inválida");
  const pertenece = (tick: number) => tick > desdeTick || desdeTick === 0 && tick === 0;
  const hechos = hechosArena(registro, hastaTick), todos = hechos.filter(h => pertenece(h.tick));
  if (opciones.cierre && modo !== "buffer") throw new Error("El cierre selectivo requiere emisión en vivo");
  if (opciones.entradaTick !== undefined && (modo !== "buffer" || opciones.cierre || !Number.isInteger(opciones.entradaTick) || opciones.entradaTick < desdeTick || opciones.entradaTick > hastaTick)) throw new Error("Entrada de narración inválida");
  // Brief 060 v1.1 (3) · `evento`: solo en la pista al ritmo (buffer), nunca con cierre ni entrada.
  if (opciones.evento !== undefined && (modo !== "buffer" || opciones.cierre || opciones.entradaTick !== undefined)) throw new Error("El evento elegido solo se admite en buffer, sin cierre ni entrada");
  if (modo === "buffer") return relatoBuffer(registro, desdeTick, hastaTick, idioma, todos, opciones.cierre, opciones.entradaTick, opciones.memoria, opciones.evento);
  const seleccion = modo === "completo" ? todos : todos.filter(h => importantes.has(h.tipo) || h === todos.at(-1));
  const ids = new Set(seleccion.map(h => h.id));
  const eventos = new Map(registro.eventos.filter(e => e.tick <= hastaTick).map(e => [e.id, e]));
  const frames = registro.fotogramas.filter(f => f.tick <= hastaTick);
  let cursor = 0, estado: EstadoArena = registro.inicial;
  let anterior: { tick: number; intensidad: number; lado: EventoArena["lado"] } | null = null;
  const fragmentos: FragmentoVoz[] = [];
  for (const h of hechos) {
    const e = eventos.get(h.id.slice(6))!;
    while (cursor < frames.length && frames[cursor]!.tick <= e.tick) estado = frames[cursor++]!;
    const expresion = expresionEvento(e, estado, anterior, registro.config.duracionS);
    anterior = { tick: e.tick, intensidad: expresion.intensidad, lado: e.lado };
    if (!ids.has(h.id)) continue;
    const variante = varianteVoz(registro.config.partido.seed, e.id);
    // Brief 050: los tres modos producen el mismo canto (aquí, la variante por semilla).
    const canto = cantoGol(e, registro, idioma, variante);
    fragmentos.push({ tick: e.tick, texto: canto?.texto ?? textoEvento(h, e, registro, idioma, variante, modo === "vivo"), ...expresion, variante, fuentes: h.eventos, fotogramas: [], ...canto ? { canto: { tramos: canto.tramos } } : {} });
  }
  const carreras = conducciones(registro, hastaTick, idioma).filter(f => pertenece(f.tick));
  fragmentos.push(...carreras); fragmentos.sort((a, b) => a.tick - b.tick);
  if (desdeTick === 0) fragmentos.unshift({ tick: 0, texto: idioma === "es" ? modo === "vivo" ? "Comienza el partido." : `Comienza el partido entre ${registro.config.partido.local.nombre} y ${registro.config.partido.visita.nombre}.` : modo === "vivo" ? "The match begins." : `The match between ${registro.config.partido.local.nombre} and ${registro.config.partido.visita.nombre} begins.`, emocion: "serena", intensidad: 0.25, variante: 0, fuentes: [], fotogramas: [0] });
  if (hastaTick === Math.round(registro.config.duracionS * 10) || registro.final.finalizado && hastaTick === registro.final.tick) {
    const m = registro.final.marcador;
    fragmentos.push({ tick: hastaTick, texto: idioma === "es" ? `Final del partido. ${registro.config.partido.local.nombre}, ${m.local}; ${registro.config.partido.visita.nombre}, ${m.visita}.` : `Full time. ${registro.config.partido.local.nombre}, ${m.local}; ${registro.config.partido.visita.nombre}, ${m.visita}.`, emocion: "serena", intensidad: 0.25, variante: 1, fuentes: [], fotogramas: [hastaTick] });
  }
  return { desdeTick, hastaTick, modo, idioma, texto: fragmentos.map(f => f.texto).join(" "), fragmentos, fuentes: seleccion.flatMap(h => h.eventos), fotogramas: [...new Set(fragmentos.flatMap(f => f.fotogramas))], eventosDisponibles: todos.length, eventosNarrados: seleccion.length, conduccionesNarradas: carreras.length };
}

/** Cada ventana ofrece una jugada seleccionada o un comentario del estado actual.
 * Todo el contexto de una intervención termina en su propio tick de publicación. */
function relatoBuffer(registro: RegistroArena, desdeTick: number, hastaTick: number, idioma: "es" | "en", hechos: HechoArena[], cierre = false, entradaTick?: number, memoria: readonly RecuerdoVoz[] = [], elegido?: string) {
  const prioridadEvento = PRIORIDAD_EVENTO_ARENA;
  const candidatos = registro.eventos.filter(e => (e.tick > desdeTick || desdeTick === 0 && e.tick === 0) && e.tick <= hastaTick && prioridadEvento[e.tipo]);
  candidatos.sort((a, b) => prioridadEvento[b.tipo]! - prioridadEvento[a.tipo]! || b.tick - a.tick);
  // Brief 060 v1.1 (3) · Con `elegido`, la ventana narra ESE evento importante (de la ventana) en lugar de candidatos[0].
  const forzado = elegido === undefined ? undefined : candidatos.find(e => e.id === elegido);
  if (elegido !== undefined && (!forzado || prioridadEvento[forzado.tipo]! < REPETICION_NARRADA.prioridadEspera)) throw new Error("Evento fuera de la ventana o de prioridad insuficiente");
  const evento = forzado ?? candidatos[0], hecho = evento && hechos.find(h => h.eventos.includes(evento.id));
  const fragmentos: FragmentoVoz[] = [];
  const es = idioma === "es";
  let prioridad = 10, eventosNarrados = 0;
  let tipoRelato: "jugada" | "comentario" | "estado" | "entrada" | "cierre" = "comentario", firmaEstado: string | undefined;
  let claveVoz: string | undefined, temaVoz: string | undefined;
  if (entradaTick !== undefined) { tipoRelato = "entrada"; }
  else if (cierre) {
    tipoRelato = "cierre";
    if (!(hastaTick === Math.round(registro.config.duracionS / ARENA.pasoS) || registro.final.finalizado && hastaTick === registro.final.tick)) throw new Error("El partido todavía no ha terminado");
    const goles = registro.eventos.filter(e => e.tipo === "gol" && e.tick <= hastaTick);
    const marcador = { ...registro.inicial.marcador };
    for (const gol of goles) marcador[gol.lado]++;
    fragmentos.push({ tick: hastaTick, texto: es ? `Final del partido. ${registro.config.partido.local.nombre}, ${marcador.local}; ${registro.config.partido.visita.nombre}, ${marcador.visita}.` : `Full time. ${registro.config.partido.local.nombre}, ${marcador.local}; ${registro.config.partido.visita.nombre}, ${marcador.visita}.`, emocion: "serena", intensidad: .25, variante: 0, fuentes: goles.map(e => e.id), fotogramas: [hastaTick] });
    prioridad = 0;
  } else if (evento && hecho) {
    tipoRelato = "jugada";
    const estado = [...registro.fotogramas].reverse().find(f => f.tick <= evento.tick) ?? registro.inicial;
    const variante = varianteVoz(registro.config.partido.seed, evento.id);
    // Brief 050: un gol ofrece sus cuatro cantos completos; la elección es la de siempre.
    const cantos = Array.from({ length: 4 }, (_, i) => cantoGol(evento, registro, idioma, i));
    const textos = cantos.map((c, i) => c?.texto ?? textoEvento(hecho, evento, registro, idioma, i, true));
    const texto = elegirVarianteVoz(textos, memoria, evento.tick, variante);
    const canto = cantos[textos.indexOf(texto)];
    claveVoz = `evento:${evento.id}`; temaVoz = evento.tipo;
    fragmentos.push({ tick: evento.tick, texto, ...expresionEvento(evento, estado, null, registro.config.duracionS), variante: varianteVoz(registro.config.partido.seed, evento.id), fuentes: [evento.id], fotogramas: [], ...canto ? { canto: { tramos: canto.tramos } } : {} });
    prioridad = prioridadEvento[evento.tipo]!; eventosNarrados = 1;
  } else if (desdeTick === 0 && !forzado) {
    fragmentos.push({ tick: 0, texto: es ? `Comienza el partido entre ${registro.config.partido.local.nombre} y ${registro.config.partido.visita.nombre}.` : `The match between ${registro.config.partido.local.nombre} and ${registro.config.partido.visita.nombre} begins.`, emocion: "serena", intensidad: .25, variante: 0, fuentes: [], fotogramas: [0] });
  }
  // 060 · Un evento elegido sin hecho narrable no se sustituye por un comentario: el clip queda vacío (silencio).
  if (!fragmentos.length && !forzado) {
    const tick = entradaTick ?? hastaTick;
    const comentario = comentarioEditorial(registro, tick, idioma, memoria, entradaTick !== undefined);
    tipoRelato = entradaTick === undefined ? comentario?.firmaEstado ? "estado" : "comentario" : "entrada";
    if (comentario) {
      firmaEstado = comentario.firmaEstado; claveVoz = comentario.clave; temaVoz = comentario.tema;
      fragmentos.push({ tick, texto: comentario.texto, emocion: "serena", intensidad: .25, variante: Math.floor(tick / 50) % 4, fuentes: comentario.fuentes, fotogramas: comentario.fotogramas });
      eventosNarrados = comentario.fuentes.length;
    }
  }
  return { desdeTick, hastaTick, modo: "buffer" as const, idioma, texto: fragmentos.map(f => f.texto).join(" "), fragmentos, fuentes: fragmentos.flatMap(f => f.fuentes), fotogramas: fragmentos.flatMap(f => f.fotogramas), eventosDisponibles: hechos.filter(h => h.tick <= (entradaTick ?? hastaTick)).length, eventosNarrados, conduccionesNarradas: 0, prioridad, cierre, tipoRelato, firmaEstado, claveVoz, temaVoz, ...(entradaTick === undefined ? {} : { entradaTick }) };
}

/** Brief 045: un clip por intervención. Fragmento opcional de cesión del narrador y un
 * fragmento con TODAS las oraciones del invitado. La duración se decide por caracteres:
 * si cesión + invitado supera el máximo se omite la cesión (nunca el dato); si el invitado
 * solo lo supera, se recorta a su primera oración (primer dato del estadista).
 * v3.1: sin memoria. La cesión sale de `cesiones[idioma][rol]` por `varianteVoz(seed, id)`:
 * un SSML por intervención e idioma, una sola entrada de caché para todos los espectadores. */
export function relatoIntervencion(intervencion: IntervencionArena, seed: number, idioma: "es" | "en", variante: VarianteIntercambio = "completa") {
  if (intervencion.turnos?.length) return relatoTurnos(intervencion, seed, idioma, variante);
  return { ...relato045(intervencion, seed, idioma), variante: "completa" as VarianteIntercambio, turnos: 0 };
}

/** Brief 048 · Un fragmento por turno de la variante servida, leído tal cual del diario (los turnos
 * están materializados: aquí no se elige ni se compone nada). `breve` sin `turnosBreve` sirve la
 * completa; la respuesta declara la variante efectiva. */
function relatoTurnos(intervencion: IntervencionArena, seed: number, idioma: "es" | "en", pedida: VarianteIntercambio) {
  const es = idioma === "es", tick = intervencion.tick;
  const variante = varianteEfectiva(intervencion, pedida);
  const turnos = variante === "breve" ? intervencion.turnosBreve! : intervencion.turnos!;
  const intensidad = { narrador: .25, comentarista: .18, estadista: .1 } as const;
  const fragmentos: FragmentoVoz[] = turnos.map((t, k) => ({
    tick, texto: es ? t.texto_es : t.texto_en, emocion: "serena" as const, intensidad: intensidad[t.rol], variante: varianteVoz(seed, `${intervencion.id}:${k}`),
    fuentes: [...new Set(t.oraciones.flatMap(o => intervencion.evidencia[o]?.eventos ?? []))], fotogramas: [], rol: t.rol,
  }));
  const fuentes = [...new Set(fragmentos.flatMap(f => f.fuentes))];
  return {
    desdeTick: tick, hastaTick: tick, modo: "buffer" as const, idioma, texto: fragmentos.map(f => f.texto).join(" "), fragmentos, fuentes, fotogramas: [] as number[],
    eventosDisponibles: 0, eventosNarrados: turnos.reduce((n, t) => n + t.oraciones.length, 0), conduccionesNarradas: 0, prioridad: MESA_ARENA.prioridadInvitado, cierre: false, tipoRelato: "invitado" as const,
    firmaEstado: undefined, claveVoz: intervencion.id, temaVoz: `${intervencion.rol}:${intervencion.tema}`, rol: intervencion.rol, intervencion: intervencion.id, modoIntervencion: intervencion.modo, cesion: turnos[0]?.rol === "narrador",
    variante, turnos: turnos.length,
  };
}

/** Camino del 045 para intervenciones sin `turnos` (diarios anteriores o composición rechazada). */
function relato045(intervencion: IntervencionArena, seed: number, idioma: "es" | "en") {
  const es = idioma === "es", tick = intervencion.tick;
  const textos = intervencion.oraciones.map(o => es ? o.texto_es : o.texto_en);
  const completo = textos.join(" ");
  const usadas = completo.length > MESA_ARENA.maxCaracteresIntervencion ? 1 : textos.length;
  const invitado = textos.slice(0, usadas).join(" ");
  const nombre = MESA_ARENA.nombres[idioma][intervencion.rol];
  const cesiones = MESA_ARENA.cesiones[idioma][intervencion.rol].map(c => c.replace("{nombre}", nombre));
  const cesion = cesiones[varianteVoz(seed, intervencion.id) % cesiones.length]!;
  const conCesion = cesion.length + invitado.length <= MESA_ARENA.maxCaracteresIntervencion;
  const fuentes = [...new Set(intervencion.evidencia.slice(0, usadas).flatMap(e => e.eventos))];
  const fragmentos: FragmentoVoz[] = [
    ...(conCesion ? [{ tick, texto: cesion, emocion: "serena" as const, intensidad: .25, variante: 0, fuentes: [], fotogramas: [], rol: "narrador" as const }] : []),
    { tick, texto: invitado, emocion: "serena", intensidad: intervencion.rol === "estadista" ? .1 : .18, variante: varianteVoz(seed, `${intervencion.id}:invitado`), fuentes, fotogramas: [], rol: intervencion.rol },
  ];
  return {
    desdeTick: tick, hastaTick: tick, modo: "buffer" as const, idioma, texto: fragmentos.map(f => f.texto).join(" "), fragmentos, fuentes, fotogramas: [] as number[],
    eventosDisponibles: 0, eventosNarrados: usadas, conduccionesNarradas: 0, prioridad: MESA_ARENA.prioridadInvitado, cierre: false, tipoRelato: "invitado" as const,
    firmaEstado: undefined, claveVoz: intervencion.id, temaVoz: `${intervencion.rol}:${intervencion.tema}`, rol: intervencion.rol, intervencion: intervencion.id, modoIntervencion: intervencion.modo, cesion: conCesion,
  };
}
