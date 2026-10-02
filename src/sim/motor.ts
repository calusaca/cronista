// Motor del simulador: cadena de posesiones determinista por semilla.
// Única fuente de azar: crearRng(config.seed). Math.random prohibido en src/sim/.
//
// Convenciones (documentadas para el brief 002 en adelante):
// - `minuto` = minuto transcurrido (piso del reloj). El descuento del primer tiempo se
//   sella en el minuto 45; el segundo tiempo arranca en 45 y termina en 90 + descuento.
// - `zona` es relativa al equipo del evento: "ataque" = último tercio del rival.
// - `atajada` lleva el `equipo` del tirador (invariante 3) y no lleva `jugador`:
//   el portero que ataja es el del equipo contrario.
// - `cambio.jugador` es el suplente que ENTRA; `cambio.sale` es el que deja el campo (rev. 1.1).
// - Expulsión por doble amarilla: se emite una sola `tarjeta_roja` (el jugador ya tenía
//   una amarilla previa en el stream). Así ningún evento del expulsado sigue a su tarjeta.
// - `pase_clave` se emite solo cuando le sigue un tiro del mismo equipo (definición Opta).
// - `inicio_periodo` / `fin_periodo` llevan el equipo que sacó de centro en ese periodo.

import { ESTILO_ATAQUE, ESTILO_DEFENSA, P, PESOS } from "./parametros";
import { enriquecerEspacial, type OrigenTiro } from "./espacial";
import { crearRng, type Rng } from "./prng";
import {
  FUERZA_MAX,
  FUERZA_MIN,
  MAX_CAMBIOS,
  SUPLENTES,
  TITULARES,
  type Equipo,
  type Evento,
  type Jugador,
  type Lado,
  type Partido,
  type Posicion,
  type SimConfig,
  type TipoEvento,
  type Zona,
} from "./tipos";

interface EstadoEquipo {
  lado: Lado;
  eq: Equipo;
  enCampo: Jugador[];
  suplentes: Jugador[];
  amonestados: Set<string>;
  expulsados: number;
  cambios: number;
  planCambios: number[];
  goles: number;
}

type ExtraEvento = Partial<Pick<Evento, "jugador" | "zona" | "xg" | "penal" | "relacionadoCon" | "sale">>;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function redondear2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ---------------- funciones puras exportadas (revisión 1.1, [B4] [B5]) ----------------
// El motor las usa en su camino real; las pruebas unitarias las ejercitan sin estadística.

/** Situación de un equipo que necesitan los factores de ataque. */
export interface SituacionEquipo {
  eq: Pick<Equipo, "ataque" | "defensa" | "estilo">;
  expulsados: number;
  goles: number;
}

export interface FactoresAtaque {
  /** Probabilidad de que la posesión llegue al último tercio. */
  pAtaque: number;
  /** Desplazamiento del log-xG de los tiros del atacante. */
  xgShift: number;
}

/**
 * Cansancio en [0, 1] según el minuto de reloj: 0 antes de `P.fatigaDesde`, crece
 * lineal hasta 1 en `P.fatigaHasta`. Modela el ERROR DEFENSIVO que sube al final
 * (brief: "cansancio sube el error al final"): la defensa cansada concede más
 * llegadas y ocasiones más claras al rival.
 */
export function fatiga(minuto: number): number {
  return clamp((minuto - P.fatigaDesde) / (P.fatigaHasta - P.fatigaDesde), 0, 1);
}

/** Probabilidad de llegar al último tercio y desplazamiento de log-xG del atacante. */
export function factoresAtaque(atk: SituacionEquipo, def: SituacionEquipo, minuto: number): FactoresAtaque {
  const s = (atk.eq.ataque - def.eq.defensa) / 100;
  const f = fatiga(minuto);
  let p =
    P.ataqueBase *
    Math.exp(P.kFuerzaAtaque * s) *
    ESTILO_ATAQUE[atk.eq.estilo].ataque *
    ESTILO_DEFENSA[def.eq.estilo].ataqueRival *
    Math.pow(P.rojaPropiaAtaque, atk.expulsados) *
    Math.pow(P.rojaRivalAtaque, def.expulsados) *
    (1 + P.fatigaAtaque * f);
  if (minuto >= P.marcadorDesde) {
    if (atk.goles < def.goles) p *= 1 + P.perdiendoEmpuje;
    else if (atk.goles > def.goles) p *= 1 - P.ganandoRepliegue;
  }
  const xgShift =
    P.kFuerzaXg * s + ESTILO_ATAQUE[atk.eq.estilo].xgShift + P.fatigaXg * f + P.rojaRivalXg * def.expulsados;
  return { pAtaque: Math.min(p, P.ataqueMax), xgShift };
}

/** Lanza si un plan de cambios excede MAX_CAMBIOS. */
export function validarPlanCambios(plan: readonly number[]): void {
  if (plan.length > MAX_CAMBIOS) {
    throw new Error(`plan de cambios inválido: ${plan.length} cambios (máximo ${MAX_CAMBIOS})`);
  }
}

/**
 * Cuántos cambios del plan (minutos ordenados) se ejecutan ahora: los vencidos a
 * `minuto`, sin pasar nunca de MAX_CAMBIOS en total contando los ya hechos.
 */
export function cambiosEjecutables(plan: readonly number[], hechos: number, minuto: number): number {
  const vencidos = plan.filter((m) => m <= minuto).length;
  return Math.max(0, Math.min(vencidos, MAX_CAMBIOS - hechos));
}

/** Normaliza una semilla entera al rango [0, SEED_MAX] (módulo 2³²). Lanza si no es entera. */
export function normalizarSeed(seed: number): number {
  if (!Number.isInteger(seed)) throw new Error(`seed inválida: ${String(seed)} (debe ser un entero)`);
  return seed >>> 0;
}

/** Lanza ante una configuración inválida (revisión 1.1, [B7]). */
export function validarConfig(config: SimConfig): void {
  normalizarSeed(config.seed);
  const nombres = new Set<string>();
  for (const lado of ["local", "visita"] as const) {
    const eq = config[lado];
    if (!eq) throw new Error(`config inválida: falta el equipo ${lado}`);
    for (const campo of ["ataque", "defensa"] as const) {
      const v = eq[campo];
      if (!Number.isInteger(v) || v < FUERZA_MIN || v > FUERZA_MAX) {
        throw new Error(`config inválida: ${lado}.${campo} = ${String(v)} (entero en [${FUERZA_MIN}, ${FUERZA_MAX}])`);
      }
    }
    if (!ESTILOS_VALIDOS.includes(eq.estilo)) throw new Error(`config inválida: ${lado}.estilo = ${String(eq.estilo)}`);
    if (!Array.isArray(eq.jugadores) || eq.jugadores.length !== TITULARES + SUPLENTES) {
      throw new Error(`config inválida: ${lado} debe tener ${TITULARES + SUPLENTES} jugadores`);
    }
    for (const j of eq.jugadores) {
      if (typeof j.nombre !== "string" || j.nombre.trim() === "") throw new Error(`config inválida: jugador sin nombre en ${lado}`);
      if (nombres.has(j.nombre)) throw new Error(`config inválida: nombre de jugador repetido "${j.nombre}"`);
      nombres.add(j.nombre);
    }
  }
}

const ESTILOS_VALIDOS: readonly string[] = ["posesion", "contragolpe", "presion"];

class Simulacion {
  private readonly rng: Rng;
  private readonly eventos: Evento[] = [];
  /** Brief 011: origen de cada tiro (lo sabe el motor). No toca el stream principal. */
  private readonly origenes = new Map<string, OrigenTiro>();
  private readonly equipos: Record<Lado, EstadoEquipo>;
  private t = 0;
  private periodo: 1 | 2 = 1;
  private finPeriodo = 45;
  private minutoFinal = 90;

  constructor(private readonly config: SimConfig) {
    this.rng = crearRng(config.seed);
    this.equipos = {
      local: this.estadoInicial("local", config.local),
      visita: this.estadoInicial("visita", config.visita),
    };
  }

  private estadoInicial(lado: Lado, eq: Equipo): EstadoEquipo {
    const n = this.rng.weighted([0, 1, 2, 3], (k) => P.pesosCambios[k] ?? 0) ?? 0;
    const plan: number[] = [];
    for (let i = 0; i < n; i++) plan.push(P.cambioDesde + this.rng.next() * (P.cambioHasta - P.cambioDesde));
    plan.sort((a, b) => a - b);
    validarPlanCambios(plan);
    return {
      lado,
      eq,
      enCampo: eq.jugadores.slice(0, TITULARES),
      suplentes: eq.jugadores.slice(TITULARES),
      amonestados: new Set(),
      expulsados: 0,
      cambios: 0,
      planCambios: plan,
      goles: 0,
    };
  }

  // ---------------- utilidades ----------------

  private rival(lado: Lado): Lado {
    return lado === "local" ? "visita" : "local";
  }

  private minutoActual(): number {
    const m = Math.floor(this.t);
    return this.periodo === 1 ? Math.min(m, 45) : clamp(m, 45, this.minutoFinal);
  }

  private emitir(tipo: TipoEvento, equipo: Lado, extra: ExtraEvento = {}, minuto?: number): string {
    const id = `e${String(this.eventos.length + 1).padStart(3, "0")}`;
    const ev: Evento = { id, minuto: minuto ?? this.minutoActual(), tipo, equipo };
    if (extra.jugador !== undefined) ev.jugador = extra.jugador;
    if (extra.zona !== undefined) ev.zona = extra.zona;
    if (extra.xg !== undefined) ev.xg = extra.xg;
    if (extra.penal !== undefined) ev.penal = extra.penal;
    if (extra.relacionadoCon !== undefined) ev.relacionadoCon = extra.relacionadoCon;
    if (extra.sale !== undefined) ev.sale = extra.sale;
    this.eventos.push(ev);
    return id;
  }

  private avanzar(dt: number): void {
    this.t += dt;
  }

  private elegir(
    est: EstadoEquipo,
    pesos: Record<Posicion, number>,
    excluir?: string,
    cautela = false,
  ): Jugador | undefined {
    return this.rng.weighted(est.enCampo, (j) => {
      if (j.nombre === excluir) return 0;
      let w = pesos[j.posicion];
      if (cautela && est.amonestados.has(j.nombre)) w *= P.cautelaAmonestado;
      return w;
    });
  }

  private lanzadorPenal(est: EstadoEquipo): Jugador | undefined {
    for (const pos of ["DEL", "MED", "DEF"] as const) {
      const j = est.enCampo.find((x) => x.posicion === pos);
      if (j) return j;
    }
    return undefined;
  }

  private fatiga(): number {
    return fatiga(this.t);
  }

  private factores(atk: EstadoEquipo, def: EstadoEquipo): FactoresAtaque {
    return factoresAtaque(atk, def, this.t);
  }

  // ---------------- acciones ----------------

  /** Falta + posible tarjeta. Devuelve el id de la falta, o undefined si no hubo infractor. */
  private falta(est: EstadoEquipo, zona: Zona, pAmarilla: number = P.pAmarilla): string | undefined {
    const j = this.elegir(est, PESOS.falta as Record<Posicion, number>, undefined, true);
    if (!j) return undefined;
    const idFalta = this.emitir("falta", est.lado, { jugador: j.nombre, zona });
    if (this.rng.chance(P.pRojaDirecta)) {
      this.emitir("tarjeta_roja", est.lado, { jugador: j.nombre, zona, relacionadoCon: idFalta });
      this.expulsar(est, j);
    } else if (this.rng.chance(pAmarilla * (1 + P.fatigaFaltas * this.fatiga()))) {
      if (est.amonestados.has(j.nombre)) {
        // Segunda amarilla ⇒ expulsión, emitida como tarjeta_roja.
        this.emitir("tarjeta_roja", est.lado, { jugador: j.nombre, zona, relacionadoCon: idFalta });
        this.expulsar(est, j);
      } else {
        this.emitir("tarjeta_amarilla", est.lado, { jugador: j.nombre, zona, relacionadoCon: idFalta });
        est.amonestados.add(j.nombre);
      }
    }
    return idFalta;
  }

  private expulsar(est: EstadoEquipo, j: Jugador): void {
    est.enCampo = est.enCampo.filter((x) => x.nombre !== j.nombre);
    est.expulsados += 1;
  }

  /** Tiro y su resolución. Devuelve true si fue gol. */
  private tiro(
    atk: EstadoEquipo,
    tirador: Jugador,
    xg: number,
    opciones: { penal: boolean; profundidad: number; origen: OrigenTiro },
  ): boolean {
    const xgR = clamp(redondear2(xg), P.xgMin, P.xgMax);
    const idTiro = this.emitir("tiro", atk.lado, { jugador: tirador.nombre, zona: "ataque", xg: xgR, penal: opciones.penal });
    this.origenes.set(idTiro, opciones.origen);
    const u = this.rng.next();
    if (u < xgR) {
      this.emitir("gol", atk.lado, { jugador: tirador.nombre, zona: "ataque", xg: xgR, relacionadoCon: idTiro });
      atk.goles += 1;
      return true;
    }
    const pAtajada = opciones.penal ? P.pAtajadaPenal : P.pAtajada;
    if (this.rng.chance(pAtajada)) {
      this.emitir("atajada", atk.lado, { zona: "ataque", relacionadoCon: idTiro });
      if (!opciones.penal && this.rng.chance(P.pCornerTrasAtajada)) return this.corner(atk, opciones.profundidad + 1);
    } else if (!opciones.penal && this.rng.chance(P.pCornerTrasDesvio)) {
      return this.corner(atk, opciones.profundidad + 1);
    }
    return false;
  }

  private sortearXg(mu: number, shift: number): number {
    return Math.exp(mu + shift + P.xgSigma * this.rng.normal());
  }

  /** Corner y posible cabezazo. Devuelve true si terminó en gol. */
  private corner(atk: EstadoEquipo, profundidad: number): boolean {
    this.avanzar(P.pasoEvento);
    const lanzador = this.elegir(atk, PESOS.corner as Record<Posicion, number>);
    this.emitir("corner", atk.lado, lanzador ? { jugador: lanzador.nombre, zona: "ataque" } : { zona: "ataque" });
    if (profundidad > 2 || !this.rng.chance(P.pTiroCorner)) return false;
    const def = this.equipos[this.rival(atk.lado)];
    const cabeceador = this.elegir(atk, PESOS.cabezazo as Record<Posicion, number>, lanzador?.nombre);
    if (!cabeceador) return false;
    this.avanzar(P.pasoEvento);
    const { xgShift } = this.factores(atk, def);
    return this.tiro(atk, cabeceador, this.sortearXg(P.xgMuCabezazo, xgShift), { penal: false, profundidad, origen: "corner" });
  }

  /** Juega una posesión del lado `lado`; devuelve quién tiene la siguiente. */
  private posesion(lado: Lado): Lado {
    const atk = this.equipos[lado];
    const def = this.equipos[this.rival(lado)];
    const inicio = this.t;
    const dur =
      (P.duracionMin + this.rng.next() * P.duracionRango) * ESTILO_ATAQUE[atk.eq.estilo].duracion;
    const { pAtaque, xgShift } = this.factores(atk, def);
    const mFaltasDef = ESTILO_DEFENSA[def.eq.estilo].faltas * (1 + P.fatigaFaltas * this.fatiga());
    let gol = false;

    this.avanzar(P.pasoEvento);
    if (!this.rng.chance(pAtaque)) {
      // La jugada muere antes del último tercio.
      if (this.rng.chance(P.pFaltaDefensorMedio * mFaltasDef)) {
        const zona: Zona = def.eq.estilo === "presion" && this.rng.chance(0.5) ? "ataque" : "medio";
        this.falta(def, zona);
      } else if (this.rng.chance(P.pFaltaAtacante)) {
        this.falta(atk, this.rng.chance(0.5) ? "medio" : "defensa");
      }
    } else {
      const r = this.rng.next();
      const cTiro = P.pTiro;
      const cOffside = cTiro + P.pFueraDeJuego;
      const cFalta = cOffside + P.pFaltaArea * mFaltasDef;
      const cCorner = cFalta + P.pCornerDirecto;
      if (r < cTiro) {
        const tirador = this.elegir(atk, PESOS.tiro as Record<Posicion, number>);
        if (tirador) {
          if (this.rng.chance(ESTILO_ATAQUE[atk.eq.estilo].paseClave)) {
            const asistente = this.elegir(atk, PESOS.paseClave as Record<Posicion, number>, tirador.nombre);
            if (asistente) {
              const zona: Zona = atk.eq.estilo === "contragolpe" && this.rng.chance(0.4) ? "medio" : "ataque";
              this.emitir("pase_clave", atk.lado, { jugador: asistente.nombre, zona });
              this.avanzar(P.pasoEvento);
            }
          }
          gol = this.tiro(atk, tirador, this.sortearXg(P.xgMu, xgShift), { penal: false, profundidad: 0, origen: "jugada" });
        }
      } else if (r < cOffside) {
        const j = this.elegir(atk, PESOS.fueraDeJuego as Record<Posicion, number>);
        if (j) this.emitir("fuera_de_juego", atk.lado, { jugador: j.nombre, zona: "ataque" });
      } else if (r < cFalta) {
        const esPenal = this.rng.chance(P.pPenalTrasFalta);
        const idFalta = this.falta(def, "defensa", esPenal ? P.pAmarillaPenal : P.pAmarilla);
        if (idFalta) {
          this.avanzar(P.pasoEvento);
          if (esPenal) {
            const lanzador = this.lanzadorPenal(atk);
            if (lanzador) gol = this.tiro(atk, lanzador, P.xgPenal, { penal: true, profundidad: 0, origen: "penal" });
          } else if (this.rng.chance(P.pTiroLibreTrasFalta)) {
            const j = this.elegir(atk, PESOS.tiroLibre as Record<Posicion, number>);
            if (j) gol = this.tiro(atk, j, this.sortearXg(P.xgMuTiroLibre, xgShift), { penal: false, profundidad: 0, origen: "tiro_libre" });
          }
        }
      } else if (r < cCorner) {
        gol = this.corner(atk, 0);
      }
    }

    this.t = Math.max(this.t, inicio + dur);
    if (gol) {
      this.avanzar(P.tiempoGol);
      return def.lado; // saca de centro el que recibió el gol
    }
    return def.lado;
  }

  private procesarCambios(): void {
    for (const lado of ["local", "visita"] as const) {
      const est = this.equipos[lado];
      const ahora = cambiosEjecutables(est.planCambios, est.cambios, this.t);
      for (let k = 0; k < ahora; k++) {
        est.planCambios.shift();
        const sale = this.elegir(est, PESOS.saleCambio as Record<Posicion, number>);
        if (!sale) continue;
        const candidatos = est.suplentes.filter((s) => s.posicion !== "POR");
        if (candidatos.length === 0) continue;
        const entra = candidatos.find((s) => s.posicion === sale.posicion) ?? (candidatos[0] as Jugador);
        est.suplentes = est.suplentes.filter((s) => s.nombre !== entra.nombre);
        est.enCampo = est.enCampo.map((j) => (j.nombre === sale.nombre ? entra : j));
        est.cambios += 1;
        this.emitir("cambio", lado, { jugador: entra.nombre, sale: sale.nombre });
      }
    }
  }

  private jugarPeriodo(periodo: 1 | 2, saque: Lado): void {
    this.periodo = periodo;
    this.t = periodo === 1 ? 0 : 45;
    const descuento =
      periodo === 1
        ? this.rng.int(P.descuento1.min, P.descuento1.max)
        : this.rng.int(P.descuento2.min, P.descuento2.max);
    this.finPeriodo = (periodo === 1 ? 45 : 90) + descuento;
    if (periodo === 2) this.minutoFinal = this.finPeriodo;
    this.emitir("inicio_periodo", saque, {}, periodo === 1 ? 0 : 45);
    let poseedor: Lado = saque;
    while (this.t < this.finPeriodo) {
      if (periodo === 2) this.procesarCambios();
      poseedor = this.posesion(poseedor);
    }
    this.emitir("fin_periodo", saque, {}, periodo === 1 ? 45 : this.minutoFinal);
  }

  correr(): Partido {
    const saque: Lado = this.rng.chance(0.5) ? "local" : "visita";
    this.jugarPeriodo(1, saque);
    this.jugarPeriodo(2, this.rival(saque));
    // Brief 011: detalle espacial DESPUÉS de simular, desde streams derivados por (semilla, id).
    enriquecerEspacial(this.eventos, this.config.seed, this.origenes);
    return { config: this.config, eventos: this.eventos };
  }
}

/**
 * Simula un partido completo. Determinista: misma config ⇒ mismo Partido.
 * Lanza ante config inválida. El Partido guarda la semilla NORMALIZADA, que es la que
 * generó sus eventos (simular(p.config) reproduce p exactamente).
 */
export function simular(config: SimConfig): Partido {
  validarConfig(config);
  // Copia defensiva: el Partido devuelto no comparte referencias con el llamador.
  const copia: SimConfig = JSON.parse(JSON.stringify(config)) as SimConfig;
  copia.seed = normalizarSeed(config.seed);
  return new Simulacion(copia).correr();
}
