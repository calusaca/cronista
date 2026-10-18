// Brief 030: relato conectado a los registros y a su pizarra, sin generación libre.
import type { Lado, Partido } from "../sim/tipos";
import { segmentoVacio } from "../sim/micro";
import type { LenguaXg, ModoXg } from "../ui/textos";
import { explicarAccion, filtrarAcciones, type AccionCompleta } from "./partido-completo";
import { cuadroInicial, cuadrosTacticos, type CuadroTactico } from "./tactica";

export interface JugadaRelatada { id: string; equipo: Lado; periodo: 1 | 2; desde: number; hasta: number; acciones: AccionCompleta[] }
export interface FraseRelato { accion: AccionCompleta; texto: string }
export type EstiloRelato = "fluido" | "detallado";
export const JUGADAS_POR_PAGINA = 8;

/** No selecciona highlights: TODOS los IDs quedan en el mismo orden, una sola vez. */
export function agruparJugadas(filas: AccionCompleta[]): JugadaRelatada[] {
  const jugadas: JugadaRelatada[] = [];
  for (const a of filas) {
    const ultima = jugadas.at(-1);
    const prev = ultima?.acciones.at(-1);
    const e = a.registro.evento;
    const microPrev = ultima?.acciones.slice().reverse().find(x => x.registro.capa === "micro");
    const empieza = ultima?.acciones.length === 1 && prev?.registro.evento.tipo === "inicio_periodo";
    const misma = a.registro.capa === "micro" && microPrev?.registro.capa === "micro" && a.registro.evento.posesion === microPrev.registro.evento.posesion;
    const cierra = a.registro.capa === "macro" && prev?.registro.capa === "micro" && prev.registro.evento.ancla === a.id;
    const relacionadoId = a.registro.capa === "macro" ? a.registro.evento.relacionadoCon : undefined;
    const relacionado = relacionadoId && ultima?.acciones.some(x => x.id === relacionadoId);
    const consecuencia = a.registro.capa === "macro" && prev?.registro.capa === "macro" && e.tipo !== "inicio_periodo" && e.tipo !== "fin_periodo" && prev.registro.evento.tipo !== "inicio_periodo" && a.minuto - prev.minuto <= 1 && segmentoVacio(a.registro.evento, prev.registro.evento);
    if (ultima && ultima.periodo === a.periodo && (misma || (empieza && a.registro.capa === "micro") || cierra || relacionado || consecuencia)) {
      ultima.acciones.push(a); ultima.hasta = a.minuto;
    } else {
      jugadas.push({ id: `jugada-${a.id}`, equipo: a.equipo, periodo: a.periodo, desde: a.minuto, hasta: a.minuto, acciones: [a] });
    }
    // La jugada del saque inicial adopta el equipo de su primera posesión registrada.
    if (e.tipo !== "inicio_periodo" && empieza && a.registro.capa === "micro" && ultima) ultima.equipo = a.equipo;
  }
  return jugadas;
}

export function nombreConDorsal(p: Partido, nombre: string | undefined, lengua: LenguaXg): string {
  if (!nombre) return lengua === "es" ? "el jugador registrado" : "the recorded player";
  const j = [...p.config.local.jugadores, ...p.config.visita.jugadores].find(j => j.nombre === nombre);
  return j ? `${j.nombre} (#${j.dorsal})` : nombre;
}

const ZONAS = { es: { defensa: "el tercio defensivo", medio: "el mediocampo", ataque: "el tercio de ataque" }, en: { defensa: "the defensive third", medio: "midfield", ataque: "the final third" } };
const CANALES = { es: { banda_izquierda: "por la izquierda", centro: "por el centro", banda_derecha: "por la derecha" }, en: { banda_izquierda: "on the left", centro: "through the middle", banda_derecha: "on the right" } };

function frasesDetalladas(p: Partido, jugada: JugadaRelatada, cuadros: Map<string, CuadroTactico>, lengua: LenguaXg, modo: ModoXg): FraseRelato[] {
  const es = lengua === "es";
  return jugada.acciones.map((a, i) => {
    const e = a.registro.evento;
    const q = cuadros.get(a.id);
    const nombre = (n: string | undefined) => nombreConDorsal(p, n, lengua);
    if (a.registro.capa === "macro") {
      let texto = explicarAccion(a, p, lengua, modo);
      // Sustitución en una pasada: no reescribir nombres que ya se han expandido.
      const nombres = [...p.config.local.jugadores, ...p.config.visita.jugadores].map(j => j.nombre).sort((u, v) => v.length - u.length);
      const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (nombres.length) texto = texto.replace(new RegExp(nombres.map(escapar).join("|"), "g"), n => nombre(n));
      if (e.tipo === "inicio_periodo") texto = es
        ? `${a.periodo === 1 ? "¡Comienza el encuentro!" : "¡Vuelve a rodar el balón en el segundo tiempo!"} ${p.config[e.equipo].nombre} pone el balón en juego desde el centro.`
        : `${a.periodo === 1 ? "Kick-off!" : "The second half gets under way!"} ${p.config[e.equipo].nombre} puts the ball in play from the centre spot.`;
      return { accion: a, texto };
    }
    const m = a.registro.evento;
    const prev = jugada.acciones[i - 1];
    const mismaZona = prev?.registro.capa === "micro" && prev.registro.evento.zona === m.zona && prev.registro.evento.canal === m.canal;
    const repite = mismaZona && prev?.registro.evento.jugador === m.jugador;
    const sitio = mismaZona ? "" : `${es ? "Desde" : "From"} ${ZONAS[lengua][m.zona]}, ${CANALES[lengua][m.canal]}, `;
    const sujeto = repite ? (es ? "después " : "then ") : `${nombre(m.jugador)} `;
    const prefijo = sitio + sujeto;
    const metros = m.distanciaM === undefined ? "" : ` ${m.distanciaM} ${es ? "metros" : "metres"}`;
    const direccion = q?.direccion ? (es ? { adelante: "hacia adelante", atras: "hacia atrás", lateral: "en lateral" } : { adelante: "forward", atras: "backwards", lateral: "sideways" })[q.direccion] : "";
    let texto: string;
    switch (m.tipo) {
      case "pase": texto = es
        ? `${prefijo}juega un pase${q?.direccion === "lateral" ? " lateral" : ""} de${metros}${direccion && q?.direccion !== "lateral" ? ` ${direccion}` : ""} hacia ${nombre(m.receptor)}. ${m.completado ? "El balón llega a su compañero." : "El envío no llega a su receptor."}`
        : `${prefijo}plays a pass of${metros}${direccion ? ` ${direccion}` : ""} to ${nombre(m.receptor)}. ${m.completado ? "The ball reaches the teammate." : "The pass does not reach its receiver."}`; break;
      case "conduccion": texto = es
        ? `${prefijo}conduce el balón${metros}${direccion ? ` ${direccion}` : ""}${q?.cruzaMedio ? ", cruzando la línea de medio campo en el esquema" : ""}.`
        : `${prefijo}carries the ball${metros}${direccion ? ` ${direccion}` : ""}${q?.cruzaMedio ? ", crossing halfway in the schematic view" : ""}.`; break;
      case "regate": texto = es ? `${prefijo}encara a ${nombre(m.rival)}. ${m.exito ? "Supera al rival y conserva el balón." : "El rival frena su regate."}` : `${prefijo}takes on ${nombre(m.rival)}. ${m.exito ? "Beats the opponent and keeps the ball." : "The opponent stops the dribble."}`; break;
      case "duelo": texto = es ? `${prefijo}disputa la pelota con ${nombre(m.rival)} y ${m.exito ? "gana" : "pierde"} el duelo.` : `${prefijo}contests the ball with ${nombre(m.rival)} and ${m.exito ? "wins" : "loses"} the duel.`; break;
      case "perdida": texto = es ? `${prefijo}pierde la posesión.` : `${prefijo}loses possession.`; break;
      case "recuperacion": texto = es ? `${prefijo}recupera el balón para ${p.config[m.equipo].nombre}.` : `${prefijo}wins the ball back for ${p.config[m.equipo].nombre}.`; break;
    }
    return { accion: a, texto: texto.charAt(0).toUpperCase() + texto.slice(1) };
  });
}

/** Memoria local a la posesión: la abreviación nunca consulta acciones futuras. */
export function frasesDeJugada(p: Partido, jugada: JugadaRelatada, cuadros: Map<string, CuadroTactico>, lengua: LenguaXg, modo: ModoXg, estilo: EstiloRelato = "fluido"): FraseRelato[] {
  const detalladas = frasesDetalladas(p, jugada, cuadros, lengua, modo);
  if (estilo === "detallado") return detalladas;
  const es = lengua === "es";
  const jugadores = [...p.config.local.jugadores, ...p.config.visita.jugadores];
  const mencionados = new Set<string>();
  const citar = (n: string | undefined) => {
    if (!n) return nombreConDorsal(p, n, lengua);
    if (!mencionados.has(n)) { mencionados.add(n); return nombreConDorsal(p, n, lengua); }
    const apellido = n.split(/\s+/).at(-1)!;
    return jugadores.filter(j => j.nombre.split(/\s+/).at(-1) === apellido).length === 1 ? apellido : n;
  };
  return jugada.acciones.map((a, i) => {
    if (a.registro.capa === "macro") {
      // Los eventos especiales conservan toda su atribución y cifras.
      return detalladas[i]!;
    }
    const e = a.registro.evento;
    const anterior = jugada.acciones[i - 1];
    const prev = anterior?.registro.capa === "micro" ? anterior.registro.evento : undefined;
    const continua = prev && anterior?.equipo === a.equipo && anterior.periodo === a.periodo && prev.posesion === e.posesion;
    const recibe = continua && prev.tipo === "pase" && prev.completado === true && prev.receptor === e.jugador;
    const devuelve = recibe && e.tipo === "pase" && e.completado === true && e.receptor === prev.jugador && e.jugador !== e.receptor;
    const mismaZona = continua && prev.zona === e.zona && prev.canal === e.canal;
    const sitio = mismaZona ? "" : `${es ? "En" : "In"} ${ZONAS[lengua][e.zona]}, ${CANALES[lengua][e.canal]}, `;
    const actor = citar(e.jugador);
    const sujeto = recibe ? (es ? `${actor} recibe y ` : `${actor} receives and `) : `${actor} `;
    const q = cuadros.get(a.id);
    const direccion = q?.direccion ? (es ? { adelante: "hacia adelante", atras: "hacia atrás", lateral: "en lateral" } : { adelante: "forward", atras: "backwards", lateral: "sideways" })[q.direccion] : "";
    const metros = e.distanciaM === undefined ? "" : `${e.distanciaM} ${es ? "metros" : "metres"}`;
    const trayecto = [metros, direccion].filter(Boolean).join(" ");
    // Variantes estables por ID, sin consumir sorteos ni inferir intención/ritmo.
    const variante = [...a.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
    let accion: string;
    switch (e.tipo) {
      case "pase": {
        const receptor = citar(e.receptor);
        if (!e.completado) accion = es ? `busca a ${receptor} con un pase de ${trayecto}, pero el envío no llega.` : `looks for ${receptor} with a pass of ${trayecto}, but it does not reach the receiver.`;
        else if (devuelve) accion = es ? `se la devuelve a ${receptor} con un pase de ${trayecto}.` : `returns it to ${receptor} with a pass of ${trayecto}.`;
        else accion = es ? `${["entrega", "juega", "conecta"][variante]} ${trayecto} ${variante === 2 ? "con" : "para"} ${receptor}.` : `${["passes", "plays the ball", "finds"][variante]} ${variante === 2 ? receptor + " with a pass of " + trayecto : trayecto + " to " + receptor}.`;
        break;
      }
      case "conduccion": accion = es ? `${["conduce", "lleva el balón", "se mueve con la pelota"][variante]} ${trayecto}${q?.cruzaMedio ? ", cruzando la línea de medio campo en el esquema" : ""}.` : `${["carries the ball", "takes the ball", "moves with the ball"][variante]} ${trayecto}${q?.cruzaMedio ? ", crossing halfway in the schematic view" : ""}.`; break;
      case "regate": accion = es ? `encara a ${citar(e.rival)} y ${e.exito ? "lo supera, conservando el balón" : "el rival frena su regate"}.` : `takes on ${citar(e.rival)} ${e.exito ? "and beats the opponent, keeping the ball" : "but the opponent stops the dribble"}.`; break;
      case "duelo": accion = es ? `disputa la pelota con ${citar(e.rival)} y ${e.exito ? "gana" : "pierde"} el duelo.` : `contests the ball with ${citar(e.rival)} and ${e.exito ? "wins" : "loses"} the duel.`; break;
      case "perdida": accion = es ? "pierde la posesión." : "loses possession."; break;
      case "recuperacion": accion = es ? `recupera el balón para ${p.config[e.equipo].nombre}.` : `wins the ball back for ${p.config[e.equipo].nombre}.`; break;
    }
    const texto = sitio + sujeto + accion;
    return { accion: a, texto: texto.charAt(0).toUpperCase() + texto.slice(1) };
  });
}

export function introduccionFormaciones(p: Partido, lengua: LenguaXg): string {
  const c = cuadroInicial(p);
  return (["local", "visita"] as const).map(lado => {
    const f = c.formaciones[lado];
    const portero = f.jugadores.find(j => j.posicion === "POR");
    return lengua === "es" ? `${p.config[lado].nombre} parte con un ${f.esquema}${portero ? ` y ${nombreConDorsal(p, portero.nombre, lengua)} en la portería` : ""}.` : `${p.config[lado].nombre} starts in a ${f.esquema}${portero ? ` with ${nombreConDorsal(p, portero.nombre, lengua)} in goal` : ""}.`;
  }).join(" ");
}

export function textoApoyos(cuadro: CuadroTactico, p: Partido, lengua: LenguaXg): string {
  if (!cuadro.apoyos.length) return "";
  const nombres = cuadro.apoyos.map(a => nombreConDorsal(p, a.jugador.nombre, lengua));
  const quienes = nombres.join(lengua === "es" ? " y " : " and ");
  return lengua === "es" ? `En la pizarra simulada, ${quienes} ${nombres.length === 1 ? "avanza" : "avanzan"} como ${nombres.length === 1 ? "opción" : "opciones"} de apoyo al poseedor.` : `In the simulated shape, ${quienes} ${nombres.length === 1 ? "moves" : "move"} up as ${nombres.length === 1 ? "a passing option" : "passing options"} for the ball carrier.`;
}

export function buscarJugadas(jugadas: JugadaRelatada[], buscar: string, p: Partido): JugadaRelatada[] {
  if (!buscar.trim()) return jugadas;
  const ids = new Set(filtrarAcciones(jugadas.flatMap(j => j.acciones), { buscar, periodo: "todos", equipo: "todos", tipo: "todos" }, p).map(a => a.id));
  return jugadas.filter(j => j.acciones.some(a => ids.has(a.id)));
}

export function exportarRelato(p: Partido, jugadas: JugadaRelatada[], cuadros: Map<string, CuadroTactico>, lengua: LenguaXg, modo: ModoXg, estilo: EstiloRelato = "fluido"): string {
  const es = lengua === "es";
  return [
    `${es ? "Relato del partido" : "Match commentary"}: ${p.config.local.nombre} — ${p.config.visita.nombre}`,
    es ? "Partido simulado. Dorsales, zonas, distancias y resultados del registro. Direcciones, posiciones y apoyos: reconstrucción esquemática, sin tracking ni segundos exactos. Izquierda/derecha desde el equipo que ataca." : "Simulated match. Recorded shirt numbers, zones, distances and outcomes. Directions, positions and support runs: schematic reconstruction, without tracking or exact seconds. Left/right from the attacking team's perspective.",
    introduccionFormaciones(p, lengua),
    ...jugadas.flatMap((j, i) => ["", `${es ? "Jugada" : "Sequence"} ${i + 1} · ${j.periodo}${es ? "T" : "H"} · ${j.desde}′–${j.hasta}′`, ...frasesDeJugada(p, j, cuadros, lengua, modo, estilo).map(f => `[${f.accion.id}] ${f.texto}`), ...j.acciones.flatMap(a => { const c = cuadros.get(a.id); return c?.apoyos.length ? [textoApoyos(c, p, lengua)] : []; }).slice(0, 1)]),
  ].join("\n") + "\n";
}

export function construirRelato(p: Partido, filas: AccionCompleta[]) {
  return { jugadas: agruparJugadas(filas), cuadros: cuadrosTacticos(p, filas) };
}
