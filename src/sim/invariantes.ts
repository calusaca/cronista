// Verificadores puros de las invariantes del brief 001 (props. 2–6) y del contrato.
// Cada función devuelve la lista de violaciones encontradas (vacía = cumple).
// La prop. 1 (determinismo) se prueba directamente en la suite.

import { MAX_CAMBIOS, TITULARES, type Lado, type Partido } from "./tipos";
import { cornerDelTiro, enBanda } from "./espacial";
import { ALTURAS, BANDAS, DESTINOS, LADO_PORTERO_DE, LADOS_PORTERO, ZONA_XG_BANDAS, ZONAS_AREA, ZONAS_ORIGEN, ZONAS_ORIGEN_PASE } from "./limites";

/** Prop. 2 — minutos enteros, monótonos no decrecientes y dentro de [0, fin_periodo final]. */
export function verificarMinutos(p: Partido): string[] {
  const err: string[] = [];
  const ev = p.eventos;
  const ultimoFin = [...ev].reverse().find((e) => e.tipo === "fin_periodo");
  if (!ultimoFin) return ["no hay fin_periodo"];
  const tope = ultimoFin.minuto;
  let anterior = -Infinity;
  for (const e of ev) {
    if (!Number.isInteger(e.minuto)) err.push(`${e.id}: minuto no entero (${e.minuto})`);
    if (e.minuto < anterior) err.push(`${e.id}: minuto ${e.minuto} < anterior ${anterior}`);
    if (e.minuto < 0 || e.minuto > tope) err.push(`${e.id}: minuto ${e.minuto} fuera de [0, ${tope}]`);
    anterior = e.minuto;
  }
  return err;
}

/** Prop. 3 — gol/atajada → tiro anterior del mismo equipo; tarjeta → falta previa. */
export function verificarRelaciones(p: Partido): string[] {
  const err: string[] = [];
  const indice = new Map(p.eventos.map((e, i) => [e.id, i] as const));
  p.eventos.forEach((e, i) => {
    const necesita =
      e.tipo === "gol" || e.tipo === "atajada"
        ? "tiro"
        : e.tipo === "tarjeta_amarilla" || e.tipo === "tarjeta_roja"
          ? "falta"
          : undefined;
    if (!necesita) return;
    if (!e.relacionadoCon) {
      err.push(`${e.id} (${e.tipo}): sin relacionadoCon`);
      return;
    }
    const j = indice.get(e.relacionadoCon);
    const ref = j === undefined ? undefined : p.eventos[j];
    if (j === undefined || !ref) {
      err.push(`${e.id} (${e.tipo}): relacionadoCon ${e.relacionadoCon} no existe`);
      return;
    }
    if (j >= i) err.push(`${e.id} (${e.tipo}): relacionadoCon ${ref.id} no es anterior`);
    if (ref.tipo !== necesita) err.push(`${e.id} (${e.tipo}): apunta a ${ref.tipo}, se esperaba ${necesita}`);
    if (necesita === "tiro" && ref.equipo !== e.equipo) err.push(`${e.id} (${e.tipo}): el tiro ${ref.id} es del otro equipo`);
  });
  return err;
}

/** Prop. 4 — un expulsado (roja o segunda amarilla) no aparece en eventos posteriores. */
export function verificarExpulsados(p: Partido): string[] {
  const err: string[] = [];
  const amarillas = new Map<string, number>();
  const fuera = new Map<string, string>(); // clave lado|jugador → id del evento de expulsión
  for (const e of p.eventos) {
    // Un expulsado tampoco puede ser "el que sale" de un cambio posterior.
    if (e.sale !== undefined) {
      const exp = fuera.get(`${e.equipo}|${e.sale}`);
      if (exp !== undefined) err.push(`${e.id} (${e.tipo}): ${e.sale} sale en un cambio tras su expulsión en ${exp}`);
    }
    if (!e.jugador) continue;
    const clave = `${e.equipo}|${e.jugador}`;
    const exp = fuera.get(clave);
    if (exp !== undefined) err.push(`${e.id} (${e.tipo}): ${e.jugador} aparece tras su expulsión en ${exp}`);
    if (e.tipo === "tarjeta_roja") fuera.set(clave, e.id);
    if (e.tipo === "tarjeta_amarilla") {
      const n = (amarillas.get(clave) ?? 0) + 1;
      amarillas.set(clave, n);
      if (n >= 2) fuera.set(clave, e.id);
    }
  }
  return err;
}

/** Prop. 5 — todo jugador existe en su plantilla; un suplente solo aparece tras su cambio. */
export function verificarJugadores(p: Partido): string[] {
  const err: string[] = [];
  const plantilla: Record<Lado, string[]> = {
    local: p.config.local.jugadores.map((j) => j.nombre),
    visita: p.config.visita.jugadores.map((j) => j.nombre),
  };
  const entraron = new Set<string>();
  for (const e of p.eventos) {
    if (!e.jugador) continue;
    const idx = plantilla[e.equipo].indexOf(e.jugador);
    if (idx < 0) {
      err.push(`${e.id} (${e.tipo}): ${e.jugador} no está en la plantilla ${e.equipo}`);
      continue;
    }
    const clave = `${e.equipo}|${e.jugador}`;
    const esSuplente = idx >= TITULARES;
    if (e.tipo === "cambio") {
      if (!esSuplente) err.push(`${e.id}: cambio con titular ${e.jugador} como entrante`);
      if (entraron.has(clave)) err.push(`${e.id}: ${e.jugador} entra dos veces`);
      entraron.add(clave);
    } else if (esSuplente && !entraron.has(clave)) {
      err.push(`${e.id} (${e.tipo}): suplente ${e.jugador} aparece antes de su cambio`);
    }
  }
  return err;
}

/** Prop. 6 — máximo de cambios por equipo; 2 inicios y 2 fines en orden; nada fuera de periodo. */
export function verificarCambiosYPeriodos(p: Partido): string[] {
  const err: string[] = [];
  const cambios: Record<Lado, number> = { local: 0, visita: 0 };
  for (const e of p.eventos) if (e.tipo === "cambio") cambios[e.equipo] += 1;
  for (const lado of ["local", "visita"] as const) {
    if (cambios[lado] > MAX_CAMBIOS) err.push(`${lado}: ${cambios[lado]} cambios (> ${MAX_CAMBIOS})`);
  }
  const marcas = p.eventos.filter((e) => e.tipo === "inicio_periodo" || e.tipo === "fin_periodo").map((e) => e.tipo);
  const esperado = ["inicio_periodo", "fin_periodo", "inicio_periodo", "fin_periodo"];
  if (JSON.stringify(marcas) !== JSON.stringify(esperado)) err.push(`periodos: ${marcas.join(",")}`);
  let dentro = false;
  for (const e of p.eventos) {
    if (e.tipo === "inicio_periodo") {
      if (dentro) err.push(`${e.id}: inicio_periodo dentro de un periodo`);
      dentro = true;
    } else if (e.tipo === "fin_periodo") {
      if (!dentro) err.push(`${e.id}: fin_periodo sin inicio`);
      dentro = false;
    } else if (!dentro) {
      err.push(`${e.id} (${e.tipo}): fuera de periodo`);
    }
  }
  return err;
}

/** Prop. 14 (rev. 1.1, [B1]) — cada tiro tiene a lo sumo un desenlace; ningún relacionadoCon de gol/atajada se repite. */
export function verificarDesenlaces(p: Partido): string[] {
  const err: string[] = [];
  const usados = new Map<string, string>(); // id del tiro → id del primer desenlace
  for (const e of p.eventos) {
    if ((e.tipo !== "gol" && e.tipo !== "atajada") || e.relacionadoCon === undefined) continue;
    const previo = usados.get(e.relacionadoCon);
    if (previo !== undefined) err.push(`${e.id} (${e.tipo}): el tiro ${e.relacionadoCon} ya tenía desenlace en ${previo}`);
    else usados.set(e.relacionadoCon, e.id);
  }
  return err;
}

/**
 * Prop. 15 (rev. 1.1, [B2]) — el que `sale` en un cambio existe en su plantilla, estaba
 * en el campo (titular o suplente ya entrado, no salido antes) y no aparece en ningún
 * evento posterior (ni como `jugador` ni como `sale`).
 */
export function verificarSalidas(p: Partido): string[] {
  const err: string[] = [];
  const plantilla: Record<Lado, string[]> = {
    local: p.config.local.jugadores.map((j) => j.nombre),
    visita: p.config.visita.jugadores.map((j) => j.nombre),
  };
  const entraron = new Set<string>();
  const salieron = new Map<string, string>(); // lado|jugador → id del cambio
  for (const e of p.eventos) {
    for (const nombre of [e.jugador, e.sale]) {
      if (nombre === undefined) continue;
      const previo = salieron.get(`${e.equipo}|${nombre}`);
      if (previo !== undefined) err.push(`${e.id} (${e.tipo}): ${nombre} aparece tras salir en ${previo}`);
    }
    if (e.tipo !== "cambio" || e.sale === undefined) continue;
    const idx = plantilla[e.equipo].indexOf(e.sale);
    if (idx < 0) err.push(`${e.id}: sale ${e.sale}, que no está en la plantilla ${e.equipo}`);
    else if (idx >= TITULARES && !entraron.has(`${e.equipo}|${e.sale}`)) err.push(`${e.id}: sale el suplente ${e.sale}, que nunca entró`);
    if (e.sale === e.jugador) err.push(`${e.id}: entra y sale el mismo jugador`);
    if (e.jugador !== undefined) entraron.add(`${e.equipo}|${e.jugador}`);
    salieron.set(`${e.equipo}|${e.sale}`, e.id);
  }
  return err;
}

const xgValido = (xg: number | undefined): boolean => xg !== undefined && Number.isFinite(xg) && xg > 0 && xg < 1;

/** Contrato del 001: ids secuenciales, xg/penal/sale solo donde corresponde, gol coherente con su tiro. */
export function verificarContrato(p: Partido): string[] {
  const err: string[] = [];
  const porId = new Map(p.eventos.map((e) => [e.id, e] as const));
  p.eventos.forEach((e, i) => {
    const esperado = `e${String(i + 1).padStart(3, "0")}`;
    if (e.id !== esperado) err.push(`${e.id}: id no secuencial (se esperaba ${esperado})`);
    if (e.penal !== undefined && e.tipo !== "tiro") err.push(`${e.id}: penal fuera de un tiro`);
    if (e.xg !== undefined && e.tipo !== "tiro" && e.tipo !== "gol") err.push(`${e.id}: xg en ${e.tipo}`);
    // Prop. 17 (rev. 1.1, [B7]): xg finito y en (0, 1). Escrito en positivo para que NaN no pase.
    if ((e.tipo === "tiro" || e.tipo === "gol") && !xgValido(e.xg)) err.push(`${e.id}: ${e.tipo} con xg inválido (${String(e.xg)})`);
    if (e.tipo === "cambio" && (typeof e.sale !== "string" || e.sale === "")) err.push(`${e.id}: cambio sin sale`);
    if (e.tipo !== "cambio" && e.sale !== undefined) err.push(`${e.id}: sale en ${e.tipo}`);
    if (e.tipo === "gol" && e.relacionadoCon) {
      const t = porId.get(e.relacionadoCon);
      if (t && t.xg !== e.xg) err.push(`${e.id}: gol no hereda el xg de su tiro`);
      if (t && t.jugador !== e.jugador) err.push(`${e.id}: gol de otro jugador que el del tiro`);
    }
    if ((e.tipo === "tarjeta_amarilla" || e.tipo === "tarjeta_roja") && e.relacionadoCon) {
      const f = porId.get(e.relacionadoCon);
      if (f && (f.jugador !== e.jugador || f.equipo !== e.equipo)) err.push(`${e.id}: tarjeta a otro jugador que el de la falta`);
    }
  });
  return err;
}

/**
 * Brief 011 — coherencia del detalle espacial. Los campos son OPCIONALES (un partido sin
 * ellos, como los fixtures hechos a mano, es válido); si están, tienen que cuadrar:
 * - vocabulario cerrado y solo en los tipos de evento que corresponden;
 * - penal ⇔ zonaOrigen = punto_penal;
 * - tiro tras córner (brief 012: LA definición `cornerDelTiro`, la misma del generador y
 *   la pizarra) ⇒ zona de área, sin excepciones (rev 1.1 del 012: el frontal empieza en 0.01);
 * - zona↔xG: la banda COMPLETA de cada zona (ZONA_XG_BANDAS, brief 012 §F1);
 * - el gol repite zona/destino/altura de su tiro; la atajada, el lado del portero que
 *   corresponde al destino del tiro (LADO_PORTERO_DE); pase clave solo desde ZONAS_ORIGEN_PASE.
 */
export function verificarEspacial(p: Partido): string[] {
  const err: string[] = [];
  const porId = new Map(p.eventos.map((e) => [e.id, e] as const));
  const en = (tipos: string[], e: Partido["eventos"][number]) => tipos.includes(e.tipo);
  p.eventos.forEach((e, i) => {
    if (e.zonaOrigen !== undefined) {
      if (!ZONAS_ORIGEN.includes(e.zonaOrigen)) err.push(`${e.id}: zonaOrigen fuera de vocabulario (${String(e.zonaOrigen)})`);
      if (!en(["tiro", "gol", "pase_clave"], e)) err.push(`${e.id}: zonaOrigen en ${e.tipo}`);
    }
    if (e.destino !== undefined) {
      if (!DESTINOS.includes(e.destino)) err.push(`${e.id}: destino fuera de vocabulario (${String(e.destino)})`);
      if (!en(["tiro", "gol"], e)) err.push(`${e.id}: destino en ${e.tipo}`);
    }
    if (e.altura !== undefined) {
      if (!ALTURAS.includes(e.altura)) err.push(`${e.id}: altura fuera de vocabulario (${String(e.altura)})`);
      if (!en(["tiro", "gol"], e)) err.push(`${e.id}: altura en ${e.tipo}`);
    }
    if (e.ladoPortero !== undefined) {
      if (!LADOS_PORTERO.includes(e.ladoPortero)) err.push(`${e.id}: ladoPortero fuera de vocabulario (${String(e.ladoPortero)})`);
      if (e.tipo !== "atajada") err.push(`${e.id}: ladoPortero en ${e.tipo}`);
    }
    if (e.banda !== undefined) {
      if (!BANDAS.includes(e.banda)) err.push(`${e.id}: banda fuera de vocabulario (${String(e.banda)})`);
      if (e.tipo !== "corner") err.push(`${e.id}: banda en ${e.tipo}`);
    }
    if (e.tipo === "tiro" && e.zonaOrigen !== undefined) {
      if (e.penal === true && e.zonaOrigen !== "punto_penal") err.push(`${e.id}: penal con zonaOrigen ${e.zonaOrigen}`);
      if (e.penal !== true && e.zonaOrigen === "punto_penal") err.push(`${e.id}: punto_penal en un tiro que no es penal`);
      const xg = e.xg ?? 0;
      if (cornerDelTiro(p.eventos, i) && !ZONAS_AREA.includes(e.zonaOrigen))
        err.push(`${e.id}: tiro de córner desde ${e.zonaOrigen} (fuera del área)`);
      if (!enBanda(e.zonaOrigen, xg)) {
        const b = ZONA_XG_BANDAS[e.zonaOrigen];
        err.push(`${e.id}: ${e.zonaOrigen} con xG ${xg} (banda [${b.min}, ${b.max}${b.incluyeMax ? "]" : ")"})`);
      }
    }
    if (e.tipo === "pase_clave" && e.zonaOrigen !== undefined && !ZONAS_ORIGEN_PASE.includes(e.zonaOrigen))
      err.push(`${e.id}: pase clave desde ${e.zonaOrigen}`);
    const tiro = e.relacionadoCon ? porId.get(e.relacionadoCon) : undefined;
    if (e.tipo === "gol" && tiro) {
      if (tiro.destino !== undefined && e.destino === undefined) err.push(`${e.id}: gol sin destino (su tiro lo tiene)`);
      for (const k of ["zonaOrigen", "destino", "altura"] as const)
        if (e[k] !== undefined && e[k] !== tiro[k]) err.push(`${e.id}: gol con ${k} ${String(e[k])} ≠ su tiro (${String(tiro[k])})`);
    }
    if (e.tipo === "atajada" && tiro) {
      if (tiro.destino !== undefined && e.ladoPortero === undefined) err.push(`${e.id}: atajada sin ladoPortero (su tiro tiene destino)`);
      if (e.ladoPortero !== undefined && tiro.destino !== undefined && e.ladoPortero !== LADO_PORTERO_DE[tiro.destino])
        err.push(`${e.id}: portero a ${e.ladoPortero} con tiro al ${tiro.destino}`);
    }
  });
  return err;
}

export const VERIFICADORES = {
  minutos: verificarMinutos,
  relaciones: verificarRelaciones,
  expulsados: verificarExpulsados,
  jugadores: verificarJugadores,
  cambiosYPeriodos: verificarCambiosYPeriodos,
  desenlaces: verificarDesenlaces,
  salidas: verificarSalidas,
  contrato: verificarContrato,
  espacial: verificarEspacial,
} as const;
