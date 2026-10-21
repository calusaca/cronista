import type { EstadoArena, RegistroArena } from "./tipos";
import { firmaEstadoVoz } from "./buffer";

/** Memoria del consumidor: solo intervenciones cuyo audio llegó a empezar. */
export interface RecuerdoVoz { tick: number; texto: string; clave?: string; tema?: string; estado?: "iniciada" | "completa" | "interrumpida"; rol?: "narrador" | "comentarista" | "estadista" }
export const normalizarVoz = (texto: string) => texto.toLocaleLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function recordarVoz(memoria: readonly RecuerdoVoz[], intervencion: RecuerdoVoz): RecuerdoVoz[] {
  return [...memoria.filter(m => m.tick <= intervencion.tick && m.tick >= intervencion.tick - 600), intervencion].slice(-12);
}
export function repetidaVoz(memoria: readonly RecuerdoVoz[], intervencion: RecuerdoVoz) {
  return memoria.some(m => m.tick <= intervencion.tick && intervencion.tick - m.tick < 600 &&
    (intervencion.clave && m.clave === intervencion.clave || intervencion.tick - m.tick < 450 && normalizarVoz(m.texto) === normalizarVoz(intervencion.texto)
      || intervencion.tema && intervencion.tema !== "reserva" && m.tema === intervencion.tema && intervencion.tick - m.tick < (intervencion.tema.startsWith("balance") ? 450 : 150)));
}
export function elegirVarianteVoz(textos: readonly string[], memoria: readonly RecuerdoVoz[], tick: number, inicio: number): string {
  const orden = textos.map((_, i) => textos[(i + inicio) % textos.length]!);
  return orden.find(texto => !repetidaVoz(memoria, { tick, texto })) ?? orden[0]!;
}
export function elegirReservaVoz<T extends { texto: string; cierre?: boolean }>(reservas: readonly T[], memoria: readonly RecuerdoVoz[], cierre = false): T | undefined {
  if (cierre) return reservas.find(r => r.cierre);
  // Orden de escucha, no tick: durante una recuperación el reloj puede quedarse quieto.
  const escuchado = memoria.map(m => normalizarVoz(m.texto));
  const ultima = (r: T) => escuchado.lastIndexOf(normalizarVoz(r.texto));
  return reservas.filter(r => !r.cierre).sort((a, b) => ultima(a) - ultima(b))[0];
}

/** Campo propio/rival depende del equipo, las bandas del eje transversal. */
export function zonaRelato(estado: EstadoArena, lado: "local" | "visita" | undefined, es: boolean) {
  const { x, y } = estado.balon.posicion;
  const sector = x >= 35 && x <= 70 ? (es ? "en el mediocampo" : "in midfield")
    : lado ? (lado === "local" ? x < 35 : x > 70) ? (es ? "en campo propio" : "in their own half") : (es ? "en campo rival" : "in the opposition half")
    : (es ? "fuera de la zona central" : "away from midfield");
  return y < 15 || y > 53 ? `${sector}, ${es ? "junto a la banda" : "near the touchline"}` : sector;
}

interface CandidatoVoz {
  texto: string; clave: string; tema: string; peso: number;
  fuentes: string[]; fotogramas: number[]; firmaEstado?: string;
}
export function comentarioEditorial(registro: RegistroArena, tick: number, idioma: "es" | "en", memoria: readonly RecuerdoVoz[] = [], entrada = false) {
  const es = idioma === "es", estado = [...registro.fotogramas].reverse().find(f => f.tick <= tick) ?? registro.inicial;
  const eventos = registro.eventos.filter(e => e.tick <= tick), recientes = eventos.filter(e => e.tick > tick - 150);
  const jugadores = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []];
  const nombre = (id: string | null) => jugadores.find(j => j.id === id)?.nombre;
  const historial = memoria.filter(m => m.tick <= tick && m.tick >= tick - 600);
  const variante = Math.abs(registro.config.partido.seed + Math.floor(tick / 50)) % 4;
  const candidatos: CandidatoVoz[] = [];
  const agregar = (textos: string[], clave: string, tema: string, peso: number, fuentes: string[] = [], fotogramas: number[] = [], firmaEstado?: string) => {
    candidatos.push({ texto: elegirVarianteVoz(textos, historial, tick, variante % textos.length), clave, tema, peso, fuentes, fotogramas, firmaEstado });
  };
  const poseedor = estado.jugadores.find(j => j.id === estado.balon.poseedor), vuelo = estado.balon.vuelo;
  const lado = poseedor?.lado ?? vuelo?.lado, zona = zonaRelato(estado, lado, es);
  const firma = firmaEstadoVoz(estado);
  const saque = estado.saque && estado.pausa && estado.pausa.hastaTick > estado.tick;
  if (saque) {
    const equipo = registro.config.partido[estado.saque!.lado].nombre;
    const tipo = { centro: es ? "saque de centro" : "kick-off", banda: es ? "saque de banda" : "throw-in", esquina: es ? "saque de esquina" : "corner", meta: es ? "saque de meta" : "goal kick" }[estado.saque!.tipo];
    agregar(es ? [`${equipo} prepara el ${tipo}.`, `La reanudación será para ${equipo}: ${tipo}.`, `${tipo[0]!.toUpperCase() + tipo.slice(1)} para ${equipo}.`, `Le corresponde el ${tipo} a ${equipo}.`]
      : [`${equipo} prepares for the ${tipo}.`, `${equipo} will restart with a ${tipo}.`, `A ${tipo} for ${equipo}.`, `The ${tipo} belongs to ${equipo}.`], `estado:${firma}`, "reanudacion", 60, [], [estado.tick], firma);
  } else if (poseedor) {
    const j = poseedor.nombre;
    agregar(es ? [`${j} lleva la pelota ${zona}.`, `Con el balón ${j}, ${zona}.`, `La posesión es de ${j}, ${zona}.`, `${j} tiene el control ${zona}.`]
      : [`${j} has possession ${zona}.`, `With ${j} on the ball, ${zona}.`, `${j} controls it ${zona}.`, `The ball is with ${j}, ${zona}.`], `estado:${firma}`, "posesion", 60, [], [estado.tick], firma);
  } else if (vuelo) {
    const j = nombre(vuelo.autor);
    agregar(es ? [`La pelota está en recorrido ${zona}.`, `El balón se desplaza ${zona}.`, `${j ? `Envío de ${j}` : "Envío en marcha"}, ${zona}.`, `La pelota sigue su trayectoria ${zona}.`]
      : [`The ball is in flight ${zona}.`, `The ball travels ${zona}.`, `${j ? `A delivery from ${j}` : "A delivery in motion"}, ${zona}.`, `The ball continues on its path ${zona}.`], `estado:${firma}`, "vuelo", 60, [], [estado.tick], firma);
  } else {
    agregar(es ? [`La pelota queda suelta ${zona}.`, `Balón sin dueño ${zona}.`, `Todavía sin control la pelota, ${zona}.`, `Nadie tiene aún la posesión ${zona}.`]
      : [`A loose ball ${zona}.`, `Neither side has the ball ${zona}.`, `The ball is still unclaimed ${zona}.`, `No player in possession ${zona}.`], `estado:${firma}`, "balon-libre", 60, [], [estado.tick], firma);
  }
  if (!entrada) {
    if (poseedor) {
      const tramo = registro.fotogramas.filter(f => f.tick <= tick && f.tick >= tick - 50);
      let corte = -1;
      tramo.forEach((f, i) => { if (f.balon.poseedor !== poseedor.id || f.balon.vuelo || f.pausa && f.pausa.hastaTick > f.tick) corte = i; });
      const antes = tramo.slice(corte + 1).find(f => f.tick <= estado.tick - 10);
      const previo = antes?.jugadores.find(j => j.id === poseedor.id);
      const sentido = poseedor.lado === "local" ? 1 : -1;
      if (antes && previo && sentido * (poseedor.posicion.x - previo.posicion.x) >= 3) {
        agregar(es ? [`${poseedor.nombre} ganó terreno con la pelota ${zona}.`, `En esta conducción, ${poseedor.nombre} avanzó ${zona}.`, `${poseedor.nombre} progresó con el balón, ${zona}.`]
          : [`${poseedor.nombre} gained ground with the ball ${zona}.`, `${poseedor.nombre} carried the ball forwards ${zona}.`, `${poseedor.nombre} made progress on the ball, ${zona}.`], `conduccion:${poseedor.id}:${Math.floor(sentido * poseedor.posicion.x / 15)}`, "conduccion", 80, [], [antes.tick, estado.tick]);
      }
    }
    // Una recepción confirma quién recibió, aunque no fuera el destinatario inicial.
    const recepciones = recientes.filter(e => e.tipo === "recepcion" && nombre(e.jugador) && nombre(e.receptor));
    const ultima = recepciones.at(-1), previa = recepciones.at(-2);
    const recepcion = previa && ultima && ultima.receptor === previa.jugador && ultima.lado === previa.lado ? previa : ultima;
    if (recepcion) {
      const a = nombre(recepcion.receptor)!, b = nombre(recepcion.jugador)!;
      const posterior = recientes.filter(e => e.tick > recepcion.tick && e.tipo === "recepcion" && e.receptor === recepcion.jugador && e.lado === recepcion.lado).at(-1);
      const continua = posterior && !recientes.some(e => e.tick > recepcion.tick && e.tick < posterior.tick && (e.lado !== recepcion.lado || !["pase", "recepcion", "plan_equipo"].includes(e.tipo)));
      const c = continua && nombre(posterior.jugador);
      agregar(es ? [c ? `${a} conectó con ${b}, que después encontró a ${c}.` : `${a} conectó con ${b} en esa combinación.`, c ? `La secuencia pasó de ${a} a ${b}, y de ahí a ${c}.` : `El envío de ${a} llegó a los pies de ${b}.`]
        : [c ? `${a} found ${b}, who then picked out ${c}.` : `${a} found ${b} with that pass.`, c ? `From ${a} to ${b}, then on to ${c}.` : `${b} received the delivery from ${a}.`], `secuencia:${posterior && continua ? posterior.id : recepcion.id}`, "secuencia", 85, [recepcion.id, ...(posterior && continua ? [posterior.id] : [])]);
    }
    const recuperacion = [...recientes].reverse().find(e => ["intercepcion", "recuperacion"].includes(e.tipo) && nombre(e.jugador));
    if (recuperacion) {
      const j = nombre(recuperacion.jugador)!, equipo = registro.config.partido[recuperacion.lado].nombre;
      agregar(es ? [`${j} recuperó la pelota para ${equipo} en este tramo.`, `En la última recuperación apareció ${j}, de ${equipo}.`]
        : [`${j} won the ball for ${equipo} in this spell.`, `${j}, of ${equipo}, made that recent recovery.`], `recuperacion:${recuperacion.id}`, "recuperacion", 70, [recuperacion.id]);
    }
    // Brief 045: los balances de remates y pases y el marcador pasan al estadista (estadista.ts).
  }
  const disponibles = candidatos.filter(c => !repetidaVoz(historial, { ...c, tick }));
  // El tema tiene descanso incluso cuando cambiaron los actores o las cifras.
  const puntuar = (c: CandidatoVoz) => c.peso - (historial.some(m => m.tema === c.tema && tick - m.tick < (c.tema.startsWith("balance") ? 450 : 200)) ? 65 : 0);
  return disponibles.sort((a, b) => puntuar(b) - puntuar(a))[0] ?? (entrada ? candidatos[0] : undefined);
}
