// Brief 030: relato conectado a los registros y a su pizarra, sin generación libre.
import type { Lado, Partido } from "../sim/tipos";
import { segmentoVacio } from "../sim/micro";
import type { LenguaXg, ModoXg } from "../ui/textos";
import { explicarAccion, filtrarAcciones, type AccionCompleta } from "./partido-completo";
import { cuadrosTacticos, type CuadroTactico } from "./tactica";

export interface JugadaRelatada { id: string; equipo: Lado; periodo: 1 | 2; desde: number; hasta: number; acciones: AccionCompleta[] }
export interface FraseRelato { accion: AccionCompleta; texto: string }
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

export function frasesDeJugada(p: Partido, jugada: JugadaRelatada, cuadros: Map<string, CuadroTactico>, lengua: LenguaXg, modo: ModoXg): FraseRelato[] {
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

export function exportarRelato(p: Partido, jugadas: JugadaRelatada[], cuadros: Map<string, CuadroTactico>, lengua: LenguaXg, modo: ModoXg): string {
  const es = lengua === "es";
  return [
    `${es ? "Relato del partido" : "Match commentary"}: ${p.config.local.nombre} — ${p.config.visita.nombre}`,
    es ? "Partido simulado. Dorsales, zonas, distancias y resultados del registro. Direcciones, posiciones y apoyos: reconstrucción esquemática, sin tracking ni segundos exactos. Izquierda/derecha desde el equipo que ataca." : "Simulated match. Recorded shirt numbers, zones, distances and outcomes. Directions, positions and support runs: schematic reconstruction, without tracking or exact seconds. Left/right from the attacking team's perspective.",
    ...jugadas.flatMap((j, i) => ["", `${es ? "Jugada" : "Sequence"} ${i + 1} · ${j.periodo}${es ? "T" : "H"} · ${j.desde}′–${j.hasta}′`, ...frasesDeJugada(p, j, cuadros, lengua, modo).map(f => `[${f.accion.id}] ${f.texto}`), ...j.acciones.flatMap(a => { const c = cuadros.get(a.id); return c?.apoyos.length ? [textoApoyos(c, p, lengua)] : []; }).slice(0, 1)]),
  ].join("\n") + "\n";
}

export function construirRelato(p: Partido, filas: AccionCompleta[]) {
  return { jugadas: agruparJugadas(filas), cuadros: cuadrosTacticos(p, filas) };
}
