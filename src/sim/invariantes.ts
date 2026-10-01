// Verificadores puros de las invariantes del brief 001 (props. 2–6) y del contrato.
// Cada función devuelve la lista de violaciones encontradas (vacía = cumple).
// La prop. 1 (determinismo) se prueba directamente en la suite.

import { MAX_CAMBIOS, TITULARES, type Lado, type Partido } from "./tipos";

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

export const VERIFICADORES = {
  minutos: verificarMinutos,
  relaciones: verificarRelaciones,
  expulsados: verificarExpulsados,
  jugadores: verificarJugadores,
  cambiosYPeriodos: verificarCambiosYPeriodos,
  desenlaces: verificarDesenlaces,
  salidas: verificarSalidas,
  contrato: verificarContrato,
} as const;
