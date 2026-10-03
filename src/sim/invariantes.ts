// Verificadores puros de las invariantes del brief 001 (props. 2–6) y del contrato.
// Cada función devuelve la lista de violaciones encontradas (vacía = cumple).
// La prop. 1 (determinismo) se prueba directamente en la suite.

import { ladoDelJugador, MAX_CAMBIOS, TITULARES, type Evento, type Lado, type Partido } from "./tipos";
import { cornerDelTiro, enBanda, origenDelTiro } from "./espacial";
import { micro, type MicroPartido } from "./micro";
import { NIVEL } from "./limites";
import { CESPEDES, CLIMAS_PARTIDO, DEF_CABEZAZO, DEF_MANO_A_MANO, DEF_MEDIA_CANCHA, DEF_VASELINA, DEFINICIONES, LESION_JORNADAS, NIVELES_PRESION, SUPERFICIES, TEMPERATURA_C } from "./limites";
import { ALTURAS, BANDAS, CANALES, DISTANCIA_ZONA, TIRO_LEJANO, VELOCIDAD, VELOCIDAD_LEJANO, VELOCIDAD_PENAL, XG_ALTO, CONDUCCION_M, PASE_M, TIPOS_MICRO, DESTINOS, LADO_PORTERO_DE, LADOS_PORTERO, ZONA_XG_BANDAS, ZONAS_AREA, ZONAS_ORIGEN, ZONAS_ORIGEN_PASE } from "./limites";

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
    const clave = `${ladoDelJugador(e)}|${e.jugador}`;
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
    // Brief 020: el autor de un autogol es del equipo que lo SUFRE.
    const lado = ladoDelJugador(e);
    const idx = plantilla[lado].indexOf(e.jugador);
    if (idx < 0) {
      err.push(`${e.id} (${e.tipo}): ${e.jugador} no está en la plantilla ${lado}`);
      continue;
    }
    const clave = `${lado}|${e.jugador}`;
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
      const previo = salieron.get(`${nombre === e.jugador ? ladoDelJugador(e) : e.equipo}|${nombre}`);
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
    // Brief 020: `autogol` solo en gol, solo con la variante, nunca de penal.
    if (e.autogol !== undefined) {
      if (e.tipo !== "gol" || e.autogol !== true) err.push(`${e.id}: autogol en ${e.tipo}`);
      if (p.config.variantes?.autogoles !== true) err.push(`${e.id}: autogol sin la variante`);
      const t = e.relacionadoCon ? porId.get(e.relacionadoCon) : undefined;
      if (t?.penal === true) err.push(`${e.id}: autogol de un penal`);
    }
    // Brief 019: `baja` solo en lesion, y siempre en lesion.
    if (e.tipo === "lesion" ? !Number.isInteger(e.baja) || (e.baja as number) < LESION_JORNADAS.min || (e.baja as number) > LESION_JORNADAS.max : e.baja !== undefined)
      err.push(`${e.id}: baja ${String(e.baja)} en ${e.tipo}`);
    if (e.tipo === "gol" && e.relacionadoCon) {
      const t = porId.get(e.relacionadoCon);
      if (t && t.xg !== e.xg) err.push(`${e.id}: gol no hereda el xg de su tiro`);
      if (t && e.autogol !== true && t.jugador !== e.jugador) err.push(`${e.id}: gol de otro jugador que el del tiro`);
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
    // Brief 015 — magnitudes del tiro: dónde pueden estar y credibilidad cruzada.
    for (const k of ["distanciaM", "velocidadKmh"] as const) {
      const v = e[k];
      if (v === undefined) continue;
      if (!["tiro", "gol", "atajada"].includes(e.tipo)) err.push(`${e.id}: ${k} en ${e.tipo}`);
      if (!Number.isInteger(v)) err.push(`${e.id}: ${k} no entero (${v})`);
    }
    if (e.tipo === "tiro" && e.distanciaM !== undefined) {
      const d = e.distanciaM;
      const xg = e.xg ?? 0;
      if (e.penal === true) {
        if (d !== DISTANCIA_ZONA.punto_penal.min) err.push(`${e.id}: penal desde ${d} m`);
      } else {
        const z = e.zonaOrigen;
        // Brief 020: la cola nueva (media cancha) es la ÚNICA exenta de la banda de su zona.
        if (e.definicion === "media_cancha") {
          if (d < DEF_MEDIA_CANCHA.distancia.min || d > DEF_MEDIA_CANCHA.distancia.max) err.push(`${e.id}: media cancha a ${d} m`);
        } else if (z && (d < DISTANCIA_ZONA[z].min || d > DISTANCIA_ZONA[z].max)) err.push(`${e.id}: ${z} a ${d} m`);
        if (xg >= XG_ALTO.xgMin && d > XG_ALTO.distanciaMax) err.push(`${e.id}: xG ${xg} desde ${d} m`);
        if (d >= TIRO_LEJANO.distanciaMin && Math.round(xg * 100) > Math.round(TIRO_LEJANO.xgMax * 100)) err.push(`${e.id}: ${d} m con xG ${xg}`);
      }
    }
    if (e.tipo === "tiro" && e.velocidadKmh !== undefined) {
      const v = e.velocidadKmh;
      const b = e.penal === true ? VELOCIDAD_PENAL : VELOCIDAD;
      if (v < b.min || v > b.max) err.push(`${e.id}: ${v} km/h fuera de [${b.min}, ${b.max}]`);
      if (e.penal !== true && (e.distanciaM ?? 0) >= VELOCIDAD_LEJANO.distanciaMin && v < VELOCIDAD_LEJANO.min) err.push(`${e.id}: ${v} km/h desde ${e.distanciaM} m`);
    }
    if ((e.tipo === "gol" || e.tipo === "atajada") && e.relacionadoCon) {
      const t = porId.get(e.relacionadoCon);
      for (const k of ["distanciaM", "velocidadKmh"] as const) if (t && t[k] !== undefined && e[k] !== t[k]) err.push(`${e.id}: ${k} ${String(e[k])} ≠ su tiro (${t[k]})`);
    }
    // Brief 020 (rev 1.1) — la definición: vocabulario, dónde vive y su coherencia dura.
    if (e.definicion !== undefined) {
      if (!DEFINICIONES.includes(e.definicion)) err.push(`${e.id}: definicion fuera de vocabulario (${String(e.definicion)})`);
      if (!["tiro", "gol", "atajada"].includes(e.tipo)) err.push(`${e.id}: definicion en ${e.tipo}`);
      if (e.tipo === "gol" && e.autogol === true) err.push(`${e.id}: un autogol no lleva la definición del tirador`);
      const t = e.relacionadoCon ? porId.get(e.relacionadoCon) : undefined;
      if ((e.tipo === "gol" || e.tipo === "atajada") && t && t.definicion !== e.definicion) err.push(`${e.id}: definicion ≠ su tiro`);
    }
    if (e.tipo === "tiro" && e.definicion !== undefined && e.definicion !== "jugada") {
      const o = origenDelTiro(p.eventos, i);
      const v = e.velocidadKmh ?? 0;
      const xgc = Math.round((e.xg ?? 0) * 100);
      const area = e.zonaOrigen === "area_chica" || e.zonaOrigen === "frontal_del_area";
      const mal = (m: string) => err.push(`${e.id}: ${e.definicion} ${m}`);
      if (e.penal === true) mal("en un penal");
      switch (e.definicion) {
        case "cabezazo":
          if (!area || !o.centro) mal("sin centro al área");
          if (e.altura === "raso") mal("a ras del suelo");
          if (v < DEF_CABEZAZO.velocidad.min || v > DEF_CABEZAZO.velocidad.max) mal(`a ${v} km/h`);
          break;
        case "mano_a_mano":
        case "vaselina":
          if (!area || !(o.filtrado || o.atras)) mal("sin pase filtrado ni pase atrás al área");
          if (xgc < Math.round(DEF_MANO_A_MANO.xgMin * 100)) mal(`con xG ${e.xg}`);
          if (e.definicion === "vaselina" && e.altura !== "alta") mal(`con altura ${String(e.altura)}`);
          if (e.definicion === "vaselina" && (v < DEF_VASELINA.velocidad.min || v > DEF_VASELINA.velocidad.max)) mal(`a ${v} km/h`);
          break;
        case "chilena":
        case "tijera":
          if (e.zonaOrigen !== "area_chica" || !o.centro || e.altura !== "alta") mal("sin centro alto al área chica");
          break;
        case "media_cancha":
          if (e.zonaOrigen !== "media_distancia") mal(`desde ${String(e.zonaOrigen)}`);
          if (xgc > Math.round(DEF_MEDIA_CANCHA.xgMax * 100)) mal(`con xG ${e.xg}`);
          if (v < DEF_MEDIA_CANCHA.velocidadMin) mal(`a ${v} km/h`);
          break;
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

/**
 * Brief 018 — contrato de las condiciones registradas (si las hay). Implementación propia,
 * independiente de la validación del motor: vocabularios cerrados, temperatura solo en calor
 * y frío y dentro de su banda, césped solo en natural, visitante un nivel por encima.
 */
export function verificarCondiciones(p: Partido): string[] {
  const c = p.config.condiciones;
  if (c === undefined) return [];
  const err: string[] = [];
  if (!CLIMAS_PARTIDO.includes(c.clima)) err.push(`condiciones: clima ${String(c.clima)}`);
  const banda = c.clima === "calor" ? TEMPERATURA_C.calor : c.clima === "frio" ? TEMPERATURA_C.frio : undefined;
  if (banda) {
    const t = c.temperaturaC;
    if (t === undefined || !Number.isInteger(t) || t < banda.min || t > banda.max) err.push(`condiciones: ${c.clima} a ${String(t)} °C`);
  } else if (c.temperaturaC !== undefined) err.push(`condiciones: ${c.clima} con temperatura`);
  if (!SUPERFICIES.includes(c.superficie)) err.push(`condiciones: superficie ${String(c.superficie)}`);
  if (c.superficie === "natural" ? c.cesped === undefined || !CESPEDES.includes(c.cesped) : c.cesped !== undefined) err.push(`condiciones: césped ${String(c.cesped)} en ${c.superficie}`);
  const nl = NIVELES_PRESION.indexOf(c.presion?.local);
  const nv = NIVELES_PRESION.indexOf(c.presion?.visita);
  if (nl < 0 || nv < 0 || nv !== nl + 1) err.push(`condiciones: presión ${String(c.presion?.local)}/${String(c.presion?.visita)}`);
  return err;
}

/**
 * Brief 019 — lesiones. Solo con la variante; cada `lesion` la sigue, en el mismo minuto, un
 * `cambio` de su equipo cuyo `sale` es el lesionado (y el lesionado no reaparece: lo vigila además
 * verificarSalidas); si cita una falta, es una falta ANTERIOR del rival. Las bajas del registro
 * (config.bajas) no están en la plantilla de su equipo ni aparecen en el partido.
 */
export function verificarLesiones(p: Partido): string[] {
  const err: string[] = [];
  const porId = new Map(p.eventos.map((e, i) => [e.id, i] as const));
  p.eventos.forEach((e, i) => {
    if (e.tipo !== "lesion") return;
    if (p.config.variantes?.lesiones !== true) err.push(`${e.id}: lesion sin la variante`);
    const sig = p.eventos[i + 1];
    if (!sig || sig.tipo !== "cambio" || sig.equipo !== e.equipo || sig.sale !== e.jugador || sig.minuto !== e.minuto) err.push(`${e.id}: lesion de ${String(e.jugador)} sin su cambio forzado`);
    for (const x of p.eventos.slice(i + 2)) if ((x.jugador === e.jugador && ladoDelJugador(x) === e.equipo) || (x.sale === e.jugador && x.equipo === e.equipo)) err.push(`${x.id}: ${String(e.jugador)} reaparece tras lesionarse en ${e.id}`);
    if (e.relacionadoCon !== undefined) {
      const j = porId.get(e.relacionadoCon);
      const f = j === undefined ? undefined : p.eventos[j];
      if (!f || f.tipo !== "falta" || f.equipo === e.equipo || (j as number) >= i) err.push(`${e.id}: relacionadoCon ${e.relacionadoCon} no es una falta previa del rival`);
    }
  });
  for (const lado of ["local", "visita"] as const) {
    for (const b of p.config.bajas?.[lado] ?? []) {
      if (p.config[lado].jugadores.some((j) => j.nombre === b.jugador)) err.push(`baja ${b.jugador} en la plantilla ${lado}`);
      if (p.eventos.some((e) => e.equipo === lado && (e.jugador === b.jugador || e.sale === b.jugador))) err.push(`baja ${b.jugador} aparece en el partido`);
    }
  }
  return err;
}

/** Brief 024 — con la variante de niveles, cada jugador trae su nivel entero en NIVEL (implementación propia). */
export function verificarNiveles(p: Partido): string[] {
  if (p.config.variantes?.niveles !== true) return [];
  const err: string[] = [];
  for (const lado of ["local", "visita"] as const)
    for (const j of p.config[lado].jugadores) if (!Number.isInteger(j.nivel) || (j.nivel as number) < NIVEL.min || (j.nivel as number) > NIVEL.max) err.push(`${lado}: ${j.nombre} con nivel ${String(j.nivel)}`);
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
  // Brief 018.
  condiciones: verificarCondiciones,
  // Brief 019.
  lesiones: verificarLesiones,
  // Brief 024.
  niveles: verificarNiveles,
  // Brief 013: la capa micro derivada también se verifica (es función pura del partido).
  micro: (p: Partido) => verificarMicro(p, micro(p)),
} as const;

// ---------------------------------------------------------------------------------
// Brief 013 (rev 1.1) — invariantes de la capa micro. Implementación independiente del
// generador: la plantilla en cancha se sigue aquí por su cuenta.
// ---------------------------------------------------------------------------------

/** Violaciones de la capa micro `m` respecto del partido `p` (vacía = cumple). */
export function verificarMicro(p: Partido, m: MicroPartido): string[] {
  const err: string[] = [];
  const idxMacro = new Map(p.eventos.map((e, i) => [e.id, i] as const));
  // Plantilla en cancha ANTES de cada evento macro (seguida aquí, aparte del generador).
  const cancha: Record<Lado, Set<string>>[] = [];
  const actual: Record<Lado, Set<string>> = {
    local: new Set(p.config.local.jugadores.slice(0, TITULARES).map((j) => j.nombre)),
    visita: new Set(p.config.visita.jugadores.slice(0, TITULARES).map((j) => j.nombre)),
  };
  for (const e of p.eventos) {
    cancha.push({ local: new Set(actual.local), visita: new Set(actual.visita) });
    if (e.tipo === "cambio" && e.jugador && e.sale) {
      actual[e.equipo].delete(e.sale);
      actual[e.equipo].add(e.jugador);
    }
    if (e.tipo === "tarjeta_roja" && e.jugador) actual[e.equipo].delete(e.jugador);
  }
  const otro = (l: Lado): Lado => (l === "local" ? "visita" : "local");
  let minAnterior = -Infinity;
  m.eventos.forEach((x, i) => {
    const esperado = `m${String(i + 1).padStart(4, "0")}`;
    if (x.id !== esperado) err.push(`${x.id}: id no secuencial (se esperaba ${esperado})`);
    if (!TIPOS_MICRO.includes(x.tipo)) err.push(`${x.id}: tipo ${String(x.tipo)}`);
    if (!CANALES.includes(x.canal)) err.push(`${x.id}: canal ${String(x.canal)}`);
    if (x.minuto < minAnterior) err.push(`${x.id}: minuto ${x.minuto} < anterior ${minAnterior}`);
    minAnterior = x.minuto;
    const k = idxMacro.get(x.ancla);
    if (k === undefined) {
      err.push(`${x.id}: ancla ${x.ancla} inexistente`);
      return;
    }
    const ancla = p.eventos[k] as Evento;
    const prev = p.eventos[k - 1];
    if (x.minuto > ancla.minuto || (prev && x.minuto < prev.minuto)) err.push(`${x.id}: minuto ${x.minuto} fuera de su tramo (${prev?.minuto ?? "?"}..${ancla.minuto})`);
    const c = cancha[k] as Record<Lado, Set<string>>;
    if (!c[x.equipo].has(x.jugador)) err.push(`${x.id}: ${x.jugador} no está en cancha (${x.tipo})`);
    if (x.receptor !== undefined && (!c[x.equipo].has(x.receptor) || x.receptor === x.jugador)) err.push(`${x.id}: receptor ${x.receptor} inválido`);
    if (x.rival !== undefined && !c[otro(x.equipo)].has(x.rival)) err.push(`${x.id}: rival ${x.rival} no está en cancha`);
    // campos por tipo y magnitudes
    if (x.tipo === "pase") {
      if (x.receptor === undefined || x.completado === undefined || x.distanciaM === undefined) err.push(`${x.id}: pase incompleto`);
      else {
        if (x.distanciaM < PASE_M.corto.min || x.distanciaM > PASE_M.largo.max) err.push(`${x.id}: pase de ${x.distanciaM} m`);
        if (x.distanciaM >= PASE_M.largo.min && x.zona === "ataque") err.push(`${x.id}: pase largo desde la zona de ataque`);
      }
    }
    if (x.tipo === "conduccion" && (x.distanciaM === undefined || x.distanciaM < CONDUCCION_M.min || x.distanciaM > CONDUCCION_M.max)) err.push(`${x.id}: conducción de ${String(x.distanciaM)} m`);
    if ((x.tipo === "regate" || x.tipo === "duelo") && (x.rival === undefined || x.exito === undefined)) err.push(`${x.id}: ${x.tipo} sin rival o sin resultado`);
    // continuidad causal (rev 1.1)
    const sig = m.eventos[i + 1];
    if (sig && sig.ancla === x.ancla) {
      const pierde = (x.tipo === "pase" && x.completado === false) || ((x.tipo === "regate" || x.tipo === "duelo") && x.exito === false);
      if (pierde) {
        if (sig.tipo !== "perdida" || sig.jugador !== x.jugador) err.push(`${x.id}→${sig.id}: tras perder la pelota debe venir su pérdida`);
      } else if (x.tipo === "perdida") {
        if (sig.tipo !== "recuperacion" || sig.equipo === x.equipo || sig.posesion === x.posesion) err.push(`${x.id}→${sig.id}: tras la pérdida recupera el rival en otra posesión`);
      } else {
        const tiene = x.tipo === "pase" ? x.receptor : x.jugador;
        if (sig.posesion !== x.posesion || sig.jugador !== tiene) err.push(`${x.id}→${sig.id}: continuidad rota (la tiene ${String(tiene)}, actúa ${sig.jugador})`);
      }
    }
  });
  // la posesión del tiro es del tirador (y la del pase clave, del asistente)
  p.eventos.forEach((a, k) => {
    if (a.tipo !== "tiro" && a.tipo !== "pase_clave") return;
    const del = m.eventos.filter((x) => x.ancla === a.id);
    const u = del[del.length - 1];
    if (!u) return;
    const tiene = u.tipo === "pase" && u.completado ? u.receptor : u.jugador;
    if (u.equipo !== a.equipo || tiene !== a.jugador) err.push(`${a.id} (${a.tipo} de ${a.jugador}): la pelota la tenía ${String(tiene)} (${u.id})`);
    void k;
  });
  return err;
}
