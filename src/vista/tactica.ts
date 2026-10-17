// Brief 030. Reconstrucción ZONAL, no tracking: geometría y apoyos modelados.
// No modifica el partido ni consume sorteos del simulador. Los metros del evento
// siguen siendo los originales; la orientación espacial pertenece a este modelo.
import { enCancha } from "../sim/micro";
import type { Jugador, Lado, Partido, Posicion } from "../sim/tipos";
import type { AccionCompleta } from "./partido-completo";

export interface PuntoCancha { x: number; y: number }
export interface FichaCancha extends Jugador { lado: Lado; punto: PuntoCancha }
export interface Formacion { esquema: string; porteros: number; jugadores: Jugador[] }
export interface ApoyoModelado { jugador: FichaCancha; desde: PuntoCancha; hasta: PuntoCancha }
export interface CuadroTactico {
  id: string; periodo: 1 | 2; equipo: Lado;
  fuente: "reconstruccion-zonal";
  formaciones: Record<Lado, Formacion>;
  antes: FichaCancha[]; jugadores: FichaCancha[];
  balon: { desde: PuntoCancha; hasta: PuntoCancha };
  actor?: string; receptor?: string; rival?: string;
  direccion?: "adelante" | "atras" | "lateral";
  paseCompletado?: boolean;
  cruzaMedio: boolean;
  apoyos: ApoyoModelado[];
}

export const CANCHA = { largo: 105, ancho: 68 } as const;
const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const sentidoAtaque = (lado: Lado, periodo: 1 | 2): 1 | -1 => (lado === "local") === (periodo === 1) ? 1 : -1;
/** También se gira el eje lateral: izquierda/derecha SIEMPRE desde el atacante. */
export function orientar(p: PuntoCancha, lado: Lado, periodo: 1 | 2): PuntoCancha {
  return sentidoAtaque(lado, periodo) === 1 ? { ...p } : { x: CANCHA.largo - p.x, y: CANCHA.ancho - p.y };
}
export const distancia = (a: PuntoCancha, b: PuntoCancha) => Math.hypot(b.x - a.x, b.y - a.y);

export function formacionDe(jugadores: Jugador[]): Formacion {
  const contar = (pos: Posicion) => jugadores.filter(j => j.posicion === pos).length;
  return { esquema: `${contar("DEF")}-${contar("MED")}-${contar("DEL")}`, porteros: contar("POR"), jugadores: [...jugadores] };
}

function distribuir(planteles: Record<Lado, Jugador[]>, periodo: 1 | 2, posesion: Lado, balon: PuntoCancha, inicial = false): FichaCancha[] {
  return (["local", "visita"] as const).flatMap(lado => {
    const pelota = orientar(balon, lado, periodo);
    return (["POR", "DEF", "MED", "DEL"] as const).flatMap(posicion => {
      const linea = planteles[lado].filter(j => j.posicion === posicion);
      const profundidad = inicial ? { POR: 6, DEF: 23, MED: 38, DEL: 49 } : { POR: 6, DEF: 27, MED: 51, DEL: 75 };
      const desplazamiento = inicial || posicion === "POR" ? 0 : (pelota.x - 52.5) * (lado === posesion ? .24 : .12) - (lado === posesion ? 0 : 7);
      return linea.map((j, i) => {
        const lateral = linea.length === 1 ? 34 : 9 + i * 50 / (linea.length - 1);
        // Escalonado gráfico del bloque sin balón: evita superponer ambos dorsales.
        const escalon = !inicial && lado !== posesion ? 6 : 0;
        const punto = orientar({ x: acotar(profundidad[posicion] + desplazamiento, 3, 99), y: acotar(lateral + (inicial ? 0 : (pelota.y - 34) * .12) + escalon, 4, 64) }, lado, periodo);
        return { ...j, lado, punto };
      });
    });
  });
}

/** Un trayecto modelado de longitud dada que cabe en la cancha (sin recortar metros). */
export function destinoModelado(desde: PuntoCancha, metros: number, angulo: number): PuntoCancha {
  for (let i = 0; i <= 144; i++) {
    const a = angulo + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 72;
    const punto = { x: desde.x + metros * Math.cos(a), y: desde.y + metros * Math.sin(a) };
    if (punto.x >= 0 && punto.x <= 105 && punto.y >= 0 && punto.y <= 68) return punto;
  }
  // Solo para entradas ajenas al contrato (el pase más largo registrado es 55 m).
  return { x: acotar(desde.x + metros * Math.cos(angulo), 0, 105), y: acotar(desde.y + metros * Math.sin(angulo), 0, 68) };
}

function puntoDelRegistro(a: AccionCompleta): PuntoCancha {
  const e = a.registro.evento;
  if (a.registro.capa === "micro") {
    const m = a.registro.evento;
    return orientar({ x: { defensa: 18, medio: 52.5, ataque: 86 }[m.zona], y: { banda_izquierda: 12, centro: 34, banda_derecha: 56 }[m.canal] }, a.equipo, a.periodo);
  }
  if (e.tipo === "inicio_periodo" || e.tipo === "fin_periodo") return { x: 52.5, y: 34 };
  if (a.registro.evento.tipo === "corner") return orientar({ x: 103, y: a.registro.evento.banda === "derecha" ? 66 : 2 }, a.equipo, a.periodo);
  const macro = a.registro.evento;
  if (macro.tipo === "atajada") return orientar({ x: 5, y: 34 }, a.equipo, a.periodo);
  const origen = macro.zonaOrigen;
  const x = origen ? { area_chica: 100, punto_penal: 94, frontal_del_area: 85, banda_izquierda: 88, banda_derecha: 88, media_distancia: 74 }[origen] : e.zona ? { defensa: 18, medio: 52.5, ataque: 86 }[e.zona] : 52.5;
  return orientar({ x, y: origen === "banda_izquierda" ? 10 : origen === "banda_derecha" ? 58 : 34 }, a.equipo, a.periodo);
}

function compatible(punto: PuntoCancha, a: AccionCompleta): boolean {
  if (a.registro.capa !== "micro") return false;
  const p = orientar(punto, a.equipo, a.periodo);
  const e = a.registro.evento;
  const tercio = p.x < 35 ? "defensa" : p.x > 70 ? "ataque" : "medio";
  const canal = p.y < 23 ? "banda_izquierda" : p.y > 45 ? "banda_derecha" : "centro";
  return tercio === e.zona && canal === e.canal;
}

export function cuadroInicial(p: Partido): CuadroTactico {
  const planteles = enCancha(p, 0);
  const balon = { x: 52.5, y: 34 };
  const jugadores = distribuir(planteles, 1, "local", balon, true);
  return { id: "formacion-inicial", periodo: 1, equipo: "local", fuente: "reconstruccion-zonal", formaciones: { local: formacionDe(planteles.local), visita: formacionDe(planteles.visita) }, antes: jugadores, jugadores, balon: { desde: balon, hasta: balon }, cruzaMedio: false, apoyos: [] };
}

/** Prefijo estable: ningún cuadro consulta acciones posteriores a la suya. */
export function cuadrosTacticos(p: Partido, filas: AccionCompleta[]): Map<string, CuadroTactico> {
  const indices = new Map(p.eventos.map((e, i) => [e.id, i]));
  const planteles = new Map<number, Record<Lado, Jugador[]>>();
  const salida = new Map<string, CuadroTactico>();
  let anterior: AccionCompleta | undefined;
  let previo: CuadroTactico | undefined;
  for (const a of filas) {
    const e = a.registro.evento;
    const hasta = a.registro.capa === "micro" ? indices.get(a.registro.evento.ancla) ?? 0 : (indices.get(a.id) ?? 0) + 1;
    let cancha = planteles.get(hasta);
    if (!cancha) { cancha = enCancha(p, hasta); planteles.set(hasta, cancha); }
    const inicial = e.tipo === "inicio_periodo";
    const mismaPosesion = a.registro.capa === "micro" && anterior?.registro.capa === "micro" && a.registro.evento.posesion === anterior.registro.evento.posesion && a.registro.evento.ancla === anterior.registro.evento.ancla;
    const desde = mismaPosesion && previo && compatible(previo.balon.hasta, a) ? { ...previo.balon.hasta } : puntoDelRegistro(a);
    const antes = distribuir(cancha, a.periodo, a.equipo, desde, inicial);
    const actor = a.registro.capa === "macro" && e.tipo === "atajada" ? a.registro.portero : e.jugador;
    const receptor = a.registro.capa === "micro" ? a.registro.evento.receptor : undefined;
    const rival = a.registro.capa === "micro" ? a.registro.evento.rival : undefined;
    let hastaBalon = { ...desde };
    let direccion: CuadroTactico["direccion"];
    if (a.registro.capa === "micro" && (e.tipo === "pase" || e.tipo === "conduccion")) {
      const destino = antes.find(j => j.lado === a.equipo && j.nombre === receptor)?.punto;
      const angulo = e.tipo === "pase" && destino && distancia(destino, desde) > .1 ? Math.atan2(destino.y - desde.y, destino.x - desde.x) : sentidoAtaque(a.equipo, a.periodo) === 1 ? 0 : Math.PI;
      hastaBalon = destinoModelado(desde, e.distanciaM ?? 0, angulo);
      const avance = (hastaBalon.x - desde.x) * sentidoAtaque(a.equipo, a.periodo);
      direccion = avance > 2 ? "adelante" : avance < -2 ? "atras" : "lateral";
    } else if (a.registro.capa === "macro" && (e.tipo === "tiro" || e.tipo === "gol")) {
      hastaBalon = orientar({ x: 105, y: e.destino === "palo_izquierdo" ? 30.5 : e.destino === "palo_derecho" ? 37.5 : 34 }, a.equipo, a.periodo);
    }
    const jugadores = distribuir(cancha, a.periodo, a.equipo, hastaBalon, inicial);
    // Actor y receptor se ubican en el trayecto de ESTA acción; no en su puesto base.
    for (const j of antes) {
      if (j.nombre === actor) j.punto = { ...desde };
      if (j.nombre === rival) j.punto = { x: acotar(desde.x + sentidoAtaque(a.equipo, a.periodo) * 2, 0, 105), y: acotar(desde.y + 2, 0, 68) };
    }
    for (const j of jugadores) {
      if (j.nombre === actor) j.punto = e.tipo === "conduccion" ? { ...hastaBalon } : { ...desde };
      if (j.nombre === receptor) j.punto = { ...hastaBalon };
      if (j.nombre === rival) j.punto = { x: acotar(desde.x + sentidoAtaque(a.equipo, a.periodo) * 2, 0, 105), y: acotar(desde.y + 2, 0, 68) };
    }
    const progresa = a.registro.capa === "micro" && (e.tipo === "conduccion" || (e.tipo === "pase" && a.registro.evento.completado)) && direccion === "adelante";
    const apoyos = progresa ? jugadores.filter(j => j.lado === a.equipo && j.posicion !== "POR" && j.nombre !== actor && j.nombre !== receptor).flatMap(j => {
      const inicio = antes.find(v => v.nombre === j.nombre)!.punto;
      return (j.punto.x - inicio.x) * sentidoAtaque(a.equipo, a.periodo) > 1 ? [{ jugador: j, desde: inicio, hasta: j.punto }] : [];
    }).sort((u, v) => distancia(u.hasta, hastaBalon) - distancia(v.hasta, hastaBalon)).slice(0, 2) : [];
    const x0 = orientar(desde, a.equipo, a.periodo).x;
    const x1 = orientar(hastaBalon, a.equipo, a.periodo).x;
    const cuadro: CuadroTactico = { id: a.id, periodo: a.periodo, equipo: a.equipo, fuente: "reconstruccion-zonal", formaciones: { local: formacionDe(cancha.local), visita: formacionDe(cancha.visita) }, antes, jugadores, balon: { desde, hasta: hastaBalon }, actor, receptor, rival, direccion, ...(a.registro.capa === "micro" && e.tipo === "pase" ? { paseCompletado: a.registro.evento.completado } : {}), cruzaMedio: x0 < 52.5 && x1 > 52.5, apoyos };
    salida.set(a.id, cuadro); anterior = a; previo = cuadro;
  }
  return salida;
}
