// Brief 021 — la pizarra 3D: función PURA evento → parámetros de escena. Todo sale de campos
// registrados del evento y de LA MISMA geometría de la pizarra 2D (geometriaJugada: compartida,
// no duplicada). Cada parámetro lleva su `cita`: el campo del que sale. Los jugadores son fichas
// quietas en sus zonas; lo único que se anima es el balón, por un arco paramétrico del origen
// registrado al palo + altura registrados, con la duración que dan la velocidad y la distancia.
//
// Coordenadas de la escena (metros): x lateral (la izquierda del atacante es x < 0), y altura,
// z distancia a la línea de gol (el arco atacado en z = 0).

import { ALTURA_DESTINO_M, CAMARA_LENTA, COMBA_M, PASE_3D_S, SALIDA_M } from "../sim/limites";
import type { Evento } from "../sim/tipos";
import type { PasoJugada } from "./evidencia";
import { geometriaJugada, type Punto, UNIDADES_POR_M } from "./pizarra";

export interface P3 {
  x: number;
  y: number;
  z: number;
}

/** Un parámetro con el campo registrado que lo respalda. */
export interface Citado<T> {
  valor: T;
  cita: string;
}

export interface Tramo {
  rol: "pase" | "remate" | "desvio";
  desde: P3;
  hasta: P3;
  /** Comba sobre la recta, en metros. */
  comba: Citado<number>;
  duracionS: Citado<number>;
}

export interface Ficha {
  rol: "pasador" | "tirador" | "autor";
  jugador: string;
  x: number;
  z: number;
  cita: string;
}

export interface Escena3D {
  /** Id del gol (la escena solo existe para goles ya emitidos). */
  gol: string;
  tramos: Tramo[];
  fichas: Ficha[];
  destino: Citado<P3>;
  definicion?: string;
  /** Hasta dónde llega el campo dibujado (m desde la línea de gol). */
  profundidadM: number;
  duracionTotalS: number;
  rotulo: string;
}

/** EL rótulo honesto (el mismo de la pizarra 2D). */
export const ROTULO_3D = "positions by zone, from match data — schematic";

/** De la pizarra 2D (unidades) a metros de la escena: la MISMA escala de la 2D. */
export const enMetros = (p: Punto): { x: number; z: number } => ({ x: (p.x - 50) / UNIDADES_POR_M, z: (p.y - 2) / UNIDADES_POR_M });

/** Duración del remate: distancia registrada / velocidad registrada (m/s) × cámara lenta de la escena. */
export function duracionRemate(distanciaM: number, velocidadKmh: number): number {
  return (distanciaM / (velocidadKmh / 3.6)) * CAMARA_LENTA;
}

/**
 * Los parámetros de la escena del gol `golId`, o undefined si el gol no existe o no tiene detalle
 * espacial (entonces no hay 3D: la 2D convencional manda). Pura y determinista.
 */
export function escenaDelGol(eventos: readonly Evento[], pasos: PasoJugada[]): Escena3D | undefined {
  const geo = geometriaJugada(pasos, eventos);
  const tiro = pasos.find((p) => p.rol === "tiro")?.evento;
  const gol = pasos.find((p) => p.rol === "gol")?.evento;
  if (!geo || !tiro || !gol) return undefined;
  const altura = (tiro.altura ?? "media") as keyof typeof ALTURA_DESTINO_M;
  const fin = enMetros(geo.arco);
  const destino: Citado<P3> = { valor: { x: fin.x, y: ALTURA_DESTINO_M[altura], z: 0 }, cita: "tiro.destino + tiro.altura" };
  const remate = enMetros(geo.remate);
  const def = tiro.definicion;
  const salida =
    def === "cabezazo" ? { y: SALIDA_M.cabezazo, cita: "tiro.definicion (cabezazo)" } : def === "chilena" || def === "tijera" ? { y: SALIDA_M.chilena, cita: `tiro.definicion (${def})` } : { y: SALIDA_M.suelo, cita: "remate desde el suelo" };
  const desdeRemate: P3 = { x: remate.x, y: salida.y, z: remate.z };

  const tramos: Tramo[] = [];
  const fichas: Ficha[] = [];
  const pasador = geo.origenRol ? pasos.find((p) => p.rol === geo.origenRol)?.evento : undefined;
  if (geo.origen) {
    const o = enMetros(geo.origen);
    tramos.push({
      rol: "pase",
      desde: { x: o.x, y: SALIDA_M.suelo, z: o.z },
      hasta: desdeRemate,
      comba: { valor: COMBA_M.pase, cita: `${geo.origenRol} (zona registrada; comba de convención)` },
      duracionS: { valor: PASE_3D_S, cita: "convención de la escena: el pase no registra velocidad" },
    });
    if (pasador?.jugador) fichas.push({ rol: "pasador", jugador: pasador.jugador, x: o.x, z: o.z, cita: geo.origenRol === "corner" ? "corner.banda" : "pase_clave.zonaOrigen" });
  }
  if (tiro.jugador) fichas.push({ rol: "tirador", jugador: tiro.jugador, x: remate.x, z: remate.z, cita: def === "media_cancha" ? "tiro.distanciaM (media cancha)" : "tiro.zonaOrigen" });

  // El remate: comba por definición (vaselina, media cancha) o por la altura registrada.
  const comba: Citado<number> =
    def === "vaselina" ? { valor: COMBA_M.vaselina, cita: "tiro.definicion (vaselina)" } : def === "media_cancha" ? { valor: COMBA_M.media_cancha, cita: "tiro.definicion (media_cancha)" } : { valor: COMBA_M[altura], cita: "tiro.altura" };
  const duracion: Citado<number> =
    tiro.distanciaM !== undefined && tiro.velocidadKmh !== undefined
      ? { valor: duracionRemate(tiro.distanciaM, tiro.velocidadKmh), cita: "tiro.distanciaM / tiro.velocidadKmh × CAMARA_LENTA" }
      : { valor: PASE_3D_S, cita: "convención de la escena: el tiro no registra magnitudes" };
  if (geo.autor && gol.autogol === true) {
    // Autogol: el remate llega al autor (área chica) y de ahí, desviado, al palo registrado.
    const a = enMetros(geo.autor);
    const enAutor: P3 = { x: a.x, y: ALTURA_DESTINO_M[altura], z: a.z };
    tramos.push({ rol: "remate", desde: desdeRemate, hasta: enAutor, comba, duracionS: duracion });
    tramos.push({ rol: "desvio", desde: enAutor, hasta: destino.valor, comba: { valor: COMBA_M.raso, cita: "gol.autogol" }, duracionS: { valor: duracion.valor / 4, cita: "gol.autogol (fracción del remate)" } });
    if (gol.jugador) fichas.push({ rol: "autor", jugador: gol.jugador, x: a.x, z: a.z, cita: "gol.jugador (autogol)" });
  } else {
    tramos.push({ rol: "remate", desde: desdeRemate, hasta: destino.valor, comba, duracionS: duracion });
  }

  const profundidad = Math.max(20, ...tramos.map((t) => t.desde.z + 6));
  return {
    gol: gol.id,
    tramos,
    fichas,
    destino,
    ...(def && def !== "jugada" ? { definicion: def } : {}),
    profundidadM: profundidad,
    duracionTotalS: tramos.reduce((s, t) => s + t.duracionS.valor, 0),
    rotulo: ROTULO_3D,
  };
}

/** Posición del balón en un tramo, t ∈ [0, 1]: recta + parábola de comba (pura; la usa el render). */
export function puntoDelTramo(t: Tramo, f: number): P3 {
  const u = Math.max(0, Math.min(1, f));
  return {
    x: t.desde.x + (t.hasta.x - t.desde.x) * u,
    y: t.desde.y + (t.hasta.y - t.desde.y) * u + 4 * t.comba.valor * u * (1 - u),
    z: t.desde.z + (t.hasta.z - t.desde.z) * u,
  };
}
