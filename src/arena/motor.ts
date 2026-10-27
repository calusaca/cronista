// Mundo único, 2D, a paso fijo. Los planes eligen intenciones; este motor es la
// autoridad sobre contactos, posesión y resultados. No importa ningún LLM.
import { z } from "zod";
import { ARBITRAJE_ARENA as R, ARENA, ATAQUE_ARENA as A, ATRIBUTOS_ARENA as AT, ENTORNO_ARENA, ESTILO_JUEGO_ARENA as EJ, LARGO_ARENA as LA, PERSECUCION_ARENA as PE, FALTAS_ARENA_V10, LIBRE_ARENA, PENAL_ARENA, PORTERO_ARENA as PO, REMATE_ARENA_V9, TECNICA_ARENA as T } from "../sim/limites";
import { apartarDelSaque, colocacionPenal, desenlacePenal, ejecutorPenal, opcionDirecto, probabilidadPenal, puntoPenal } from "./libre";
import { validarConfig } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import { prngDerivado } from "../sim/prng";
import type { Condiciones, Lado, SimConfig } from "../sim/tipos";
import { aficionDe } from "../vista/grada";
import { asignarPuestos, compatibilidadPuesto, elegirFormacion } from "./alineacion";
import { emocionesEntrenador, entrenadorDe, estadoInicialEntrenador, planDelEntrenador, siguienteRevision } from "./entrenadores";
import { capacidadEfectiva, efectosEntorno, prepararPartido, reaccionarAficion, resumir } from "./entorno";
import { anclas, puestos, transformar } from "./catalogo";
import { crearArbitro, moverArbitro, probabilidadFalta } from "./arbitro";
import { evaluarPases, planProgramado } from "./controladores";
import { designarCapitanes, personalidadDe, prefiereConducir, prefiereTirar } from "./personalidades";
import { colocarCentro, cruceDeBanda, defensorDePorteria, PUNTO_CENTRAL } from "./reinicios";
import { distancia, enCancha, limitar, proyeccion } from "./geometria";
import { despejeManos, destinoSalida, enAreaPropia, limitarAreaPropia, manoAMano, radioAtajada, respetarManos, saqueAdmisible, saqueForzado, ticksManos } from "./portero";
import { alcancePortero, balonCercaDelArco, destinoPosicionamiento, errorRemate, estiradaPortero, objetivoRemate, potenciaRemate, probabilidadAlto, probabilidadDesvio, remateDeReglas, REMATE_NEUTRO, velocidadRemate } from "./remate";
import { ajusteDuelo, atributosDe, estiloJuegoDe, factorAceleracion, factorDesgaste, factorErrorPase, factorPotencia, factorVelocidadMax } from "./atributos";
import { alcanceLargo, altoLejano, destinoTrayectoria, errorExtraLargo, factorErrorLejano, lejosRemate, opcionPaseLargo, probabilidadLejano, puedeRematarLejos } from "./largo";
import { apoyoPersecucion, destinoPersecucion, destinoRepliegue, duracionPersecucionS, hastaTickPersecucion, limitarPersecucion, perseguidoresDe, seleccionRepliegue, superadoPor } from "./persecucion";
import { conduccionPorDefecto, destinosLlegada, enZonaCentro, limitarConduccion, lineaFueraDeJuego, opcionCentro, puedeCentrar, receptorCentro } from "./ataque";
import { atributosJugador, estilosJuego, formaciones, lados, paresSustitucion, perfilesEntrenador, reglasArena, rival, type AtributosJugador, type ConfigArena, type EstiloJuego, type EstadoArena, type EventoArena, type FormacionArena, type FueraDeJuegoObservado, type JugadorArena, type ObservacionArena, type OrdenesEquipo, type OrdenJugador, type Punto, type ReglasArena, type VersionArena, type TipoReinicioArena } from "./tipos";

export function crearConfigArena(opciones: { seed?: number; partido?: SimConfig; duracionS?: number; intervaloS?: number; local?: FormacionArena; visita?: FormacionArena; version?: VersionArena; entorno?: Partial<Condiciones>; reglas?: ReglasArena } = {}): ConfigArena {
  const version = opciones.version ?? ARENA.version;
  // Brief 046: fijar reglas archivadas (p. ej. generadores de fixtures v3); solo con el motor actual.
  if (opciones.reglas !== undefined && version !== ARENA.version) throw new Error("Reglas de reinicio desconocidas");
  const base = opciones.partido ?? configDeSemilla(opciones.seed ?? 42);
  const partido = version === ARENA.version ? prepararPartido(base) : base;
  if (opciones.entorno && version === ARENA.version) {
    const c = { ...partido.condiciones!, ...opciones.entorno };
    if (c.clima !== "calor" && c.clima !== "frio") delete c.temperaturaC;
    else if (opciones.entorno.clima && opciones.entorno.temperaturaC === undefined) c.temperaturaC = ARENA.temperaturaDefectoC[c.clima];
    if (c.superficie === "sintetica") delete c.cesped;
    else c.cesped ??= "corto";
    partido.condiciones = c;
  }
  const entrenadores = { local: entrenadorDe(partido.local), visita: entrenadorDe(partido.visita) };
  const forma = (lado: Lado) => {
    if (opciones[lado]) return opciones[lado]!;
    if (version !== ARENA.version) return lado === "local" ? "4-3-3" as const : "4-2-3-1" as const;
    const plantilla = plantillaArena(partido, lado, true);
    return elegirFormacion(plantilla, entrenadores[lado].preferidas);
  };
  const config: ConfigArena = {
    version, partido, ...(version === ARENA.version ? { reglas: opciones.reglas ?? ARENA.reglas } : {}),
    duracionS: opciones.duracionS ?? ARENA.duracionS,
    intervaloS: opciones.intervaloS ?? ARENA.intervaloS,
    formaciones: { local: forma("local"), visita: forma("visita") },
    ...(version === ARENA.version ? { entrenadores, aficiones: { local: aficionDe(partido.local.nombre), visita: aficionDe(partido.visita.nombre) } } : {}),
  };
  // Brief 063 § 4.3 (reinicios-v7): los atributos de toda la plantilla de arena de los dos lados, una sola vez.
  if (reglasDesde(config, "reinicios-v7")) config.atributos = atributosPlantillas(partido);
  // Brief 063 § 4.3 (reinicios-v8): la identidad de juego de cada club, derivada de su nombre.
  if (reglasDesde(config, "reinicios-v8")) config.estilosJuego = estilosPartido(partido);
  validarConfigArena(config);
  return config;
}
/** Brief 063 § 4.3 · `estiloJuegoDe` del nombre de cada club. */
export function estilosPartido(partido: SimConfig): Record<Lado, EstiloJuego> {
  return { local: estiloJuegoDe(partido.local.nombre), visita: estiloJuegoDe(partido.visita.nombre) };
}
/** Brief 063 § 4.3 · `atributosDe` para cada jugador de `plantillaArena(partido, lado, true)` de los dos lados. */
export function atributosPlantillas(partido: SimConfig): Record<string, AtributosJugador> {
  return Object.fromEntries(lados.flatMap(lado => plantillaArena(partido, lado, true).map(j => [j.id, atributosDe(partido[lado].nombre, j.nombre, j.posicionNatural!, j.personalidad!.perfil)])));
}
export function validarConfigArena(config: ConfigArena): void {
  if (config.version !== undefined && ![ARENA.version, ARENA.versionPersonalidades, ARENA.versionLegado].includes(config.version)) throw new Error("Versión de motor de arena desconocida");
  if (config.reglas !== undefined && (!(reglasArena as readonly string[]).includes(config.reglas) || config.version !== ARENA.version)) throw new Error("Reglas de reinicio desconocidas");
  // Brief 063 § 4.3: los atributos existen si y solo si las reglas son ≥ reinicios-v7; la identidad de juego, si y
  // solo si son ≥ reinicios-v8.
  const extra = config as unknown as Record<string, unknown>;
  const v7 = reglasDesde(config, "reinicios-v7"), v8 = reglasDesde(config, "reinicios-v8");
  if (extra.atributos !== undefined && !v7) throw new Error("Atributos fuera de su versión");
  if (extra.atributos === undefined && v7) throw new Error("Faltan los atributos de jugador");
  if (extra.estilosJuego !== undefined && !v8) throw new Error("Identidad de juego fuera de su versión");
  if (extra.estilosJuego === undefined && v8) throw new Error("Falta la identidad de juego");
  if (v8) z.strictObject({ local: z.enum(estilosJuego), visita: z.enum(estilosJuego) }).parse(extra.estilosJuego);
  validarConfig(config.partido);
  if (v7) {
    const valor = z.number().int().min(AT.min).max(AT.max);
    const uno = z.strictObject(Object.fromEntries(atributosJugador.map(a => [a, valor])) as Record<(typeof atributosJugador)[number], typeof valor>);
    const ids = lados.flatMap(lado => config.partido[lado].jugadores.slice(0, ARENA.plantillaArena).map((_, n) => `${lado}-${n}`));
    z.strictObject(Object.fromEntries(ids.map(id => [id, uno]))).parse(extra.atributos);
  }
  for (const lado of lados) {
    z.string().min(1).max(100).parse(config.partido[lado].nombre);
    for (const j of config.partido[lado].jugadores) {
      z.string().min(1).max(80).parse(j.nombre);
      z.enum(["POR", "DEF", "MED", "DEL"]).parse(j.posicion);
      z.number().int().min(1).max(99).parse(j.dorsal);
    }
    if (new Set(config.partido[lado].jugadores.map(j => j.dorsal)).size !== config.partido[lado].jugadores.length) throw new Error("Dorsales repetidos");
  }
  if ([config.partido.variantes?.lesiones, config.partido.variantes?.autogoles, config.partido.variantes?.insolitos, config.partido.variantes?.sanciones].some(Boolean)) throw new Error("La arena todavía no resuelve lesiones, autogoles, insólitos o sanciones de club");
  if (!Number.isInteger(config.duracionS) || config.duracionS < 1 || config.duracionS > ARENA.duracionMaxS) throw new Error("Duración de arena fuera de límites");
  if (!Number.isInteger(config.intervaloS) || config.intervaloS < ARENA.intervaloMinS || config.intervaloS > ARENA.intervaloMaxS) throw new Error("Intervalo de arena fuera de límites");
  if (Math.ceil(config.duracionS / config.intervaloS) > ARENA.maxRondas) throw new Error("Demasiadas decisiones");
  for (const lado of lados) if (!formaciones.includes(config.formaciones[lado])) throw new Error("Formación desconocida");
  if (config.version !== ARENA.version && lados.some(lado => !formaciones.slice(0, 3).includes(config.formaciones[lado]))) throw new Error("Formación no disponible en esta versión");
  if (config.version === ARENA.version) {
    const atributo = z.number().int().min(0).max(100);
    const entrenador = z.strictObject({ nombre: z.string().trim().min(1).max(80), perfil: z.enum(perfilesEntrenador), preferidas: z.array(z.enum(formaciones)).min(1).max(formaciones.length),
      ofensiva: atributo, defensiva: atributo, presion: atributo, verticalidad: atributo, amplitud: atributo, riesgo: atributo, adaptabilidad: atributo, paciencia: atributo, rotacion: atributo, serenidad: atributo });
    z.strictObject({ local: entrenador, visita: entrenador }).parse(config.entrenadores);
    const aficion = z.strictObject({ sector: z.string().min(1).max(100), canto: z.strictObject({ es: z.string().max(300), en: z.string().max(300) }) });
    z.strictObject({ local: aficion, visita: aficion }).parse(config.aficiones);
  }
}

function plantillaArena(partido: SimConfig, lado: Lado, completa: boolean): JugadorArena[] {
  return partido[lado].jugadores.slice(0, completa ? ARENA.plantillaArena : 11).map((j, n) => ({
    id: `${lado}-${n}`, lado, nombre: j.nombre, dorsal: j.dorsal, puesto: j.posicion,
    nivel: partido.variantes?.niveles && j.nivel !== undefined ? j.nivel : (partido[lado].ataque + partido[lado].defensa) / 2,
    posicion: { x: ARENA.largoM / 2, y: lado === "local" ? 0 : ARENA.anchoM }, velocidad: { x: 0, y: 0 }, energia: 1,
    personalidad: personalidadDe(partido[lado].nombre, j.nombre, j.posicion), capitan: false,
    posicionNatural: j.posicion, amarillas: 0,
  }));
}
export function crearEstadoArena(config: ConfigArena): EstadoArena {
  validarConfigArena(config);
  if (config.version === ARENA.version) {
    const plantilla = lados.flatMap(lado => plantillaArena(config.partido, lado, true));
    const jugadores = lados.flatMap(lado => asignarPuestos(plantilla.filter(j => j.lado === lado), config.formaciones[lado]).map(j => ({ ...j, posicion: { ...anclas(config.formaciones[lado], lado, "base")[j.puesto]! } })));
    const activos = new Set(jugadores.map(j => j.id)); designarCapitanes(jugadores);
    const portador = jugadores.find(j => j.lado === "local" && j.posicionNatural === "MED") ?? jugadores.find(j => j.lado === "local" && j.puesto !== "POR")!;
    const entrenador = (lado: Lado) => estadoInicialEntrenador(config.entrenadores![lado], config.formaciones[lado], config.partido.seed, config.partido.condiciones);
    const estado: EstadoArena = { tick: 0, jugadores, banco: plantilla.filter(j => !activos.has(j.id)), retirados: [], expulsados: [],
      balon: { posicion: { ...portador.posicion }, poseedor: portador.id, vuelo: null }, marcador: { local: 0, visita: 0 },
      arbitro: crearArbitro(config.partido.seed, portador.posicion, true), entrenadores: { local: entrenador("local"), visita: entrenador("visita") },
      aficion: { local: { animo: ENTORNO_ARENA.animoInicial, reaccion: "atencion", evento: null }, visita: { animo: ENTORNO_ARENA.animoInicial, reaccion: "atencion", evento: null } }, pausa: null, finalizado: null,
      // Brief 063 § 4.2: desde reinicios-v6 la clave existe siempre (null o la persecución activa).
      ...(reglasDesde(config, "reinicios-v6") ? { persecucion: null } : {}) };
    if (centroReglamentario(config)) {
      const ejecutor = colocarCentro(estado, "local"), hastaTick = Math.round(T.pausaS / ARENA.pasoS);
      estado.balon = { posicion: { ...PUNTO_CENTRAL }, poseedor: ejecutor.id, vuelo: null };
      estado.saque = { tipo: "centro", lado: "local", ejecutor: ejecutor.id, punto: { ...PUNTO_CENTRAL }, hastaTick };
      estado.pausa = { lado: "local", punto: { ...PUNTO_CENTRAL }, hastaTick, motivo: "reinicio" };
      estado.arbitro = crearArbitro(config.partido.seed, PUNTO_CENTRAL, true);
    }
    return estado;
  }
  const jugadores: JugadorArena[] = lados.flatMap(lado => {
    const slots = puestos(config.formaciones[lado]);
    const referencias = anclas(config.formaciones[lado], lado, "base");
    return config.partido[lado].jugadores.slice(0, 11).map((j, n) => ({
      id: `${lado}-${n}`, lado, nombre: j.nombre, dorsal: j.dorsal, puesto: slots[n]!,
      nivel: config.partido.variantes?.niveles && j.nivel !== undefined ? j.nivel : (config.partido[lado].ataque + config.partido[lado].defensa) / 2,
      posicion: { ...referencias[slots[n]!]! }, velocidad: { x: 0, y: 0 }, energia: 1,
      ...(config.version === ARENA.versionPersonalidades ? { personalidad: personalidadDe(config.partido[lado].nombre, j.nombre, j.posicion) } : {}),
    }));
  });
  // Escenario de juego abierto. No se atribuye un saque inicial reglamentario.
  const portador = jugadores.find(j => j.id === "local-5")!;
  if (config.version === ARENA.versionPersonalidades) designarCapitanes(jugadores);
  return { tick: 0, jugadores, balon: { posicion: { ...portador.posicion }, poseedor: portador.id, vuelo: null }, marcador: { local: 0, visita: 0 },
    ...(config.version === ARENA.versionPersonalidades ? { arbitro: crearArbitro(config.partido.seed, portador.posicion) } : {}),
  };
}

export function datosEquipos(config: ConfigArena, estado?: EstadoArena): ObservacionArena["equipos"] {
  return Object.fromEntries(lados.map(lado => [lado, {
    nombre: config.partido[lado].nombre, ataque: config.partido[lado].ataque,
    defensa: config.partido[lado].defensa, estilo: config.partido[lado].estilo,
    formacion: estado?.entrenadores?.[lado].formacion ?? config.formaciones[lado],
    ...(config.entrenadores ? { entrenador: config.entrenadores[lado] } : {}),
    // Brief 063 § 4.3 (reinicios-v7): solo los IDs de ese lado (titulares y banco).
    ...(config.atributos ? { atributos: Object.fromEntries(Object.entries(config.atributos).filter(([id]) => id.startsWith(`${lado}-`))) } : {}),
    // Brief 063 § 4.3 (reinicios-v8): la identidad de juego de ese club.
    ...(config.estilosJuego ? { estiloJuego: config.estilosJuego[lado] } : {}),
  }])) as ObservacionArena["equipos"];
}

/** Aproximación puntual en el instante del golpe; la sanción solo se produce
 * cuando uno de estos jugadores interviene recibiendo el balón. */
export function adelantados(estado: EstadoArena, lado: Lado): string[] {
  const linea = lineaFueraDeJuego(estado, lado);
  return estado.jugadores.filter(j => j.lado === lado && transformar(j.posicion, lado).x > linea + ARENA.toleranciaM).map(j => j.id);
}

/** Brief 068 § 2.B · `fueraDeJuego` de la observación de `lado` (solo desde reinicios-v10): la x ABSOLUTA con un decimal de
 * `lineaFueraDeJuego` de cada lado (la función devuelve la x orientada del atacante) y los adelantados propios. */
export function fueraDeJuegoObservado(estado: EstadoArena, lado: Lado): FueraDeJuegoObservado {
  const absoluta = (l: Lado) => Math.round(transformar({ x: lineaFueraDeJuego(estado, l), y: 0 }, l).x * 10) / 10;
  return { propia: { linea: absoluta(lado), adelantados: adelantados(estado, lado) }, rival: { linea: absoluta(rival(lado)) } };
}
/** Brief 068: el pasador consciente del fuera de juego y `fueraDeJuego` en la observación existen desde estas reglas. */
export const REGLAS_FUERA_DE_JUEGO_068: ReglasArena = "reinicios-v10";

/** El saque de centro reglamentario (inicial y tras gol) existe desde reinicios-v2. */
const centroReglamentario = (config: ConfigArena) => config.reglas !== undefined && config.reglas !== "reinicios-v1";
/** Brief 046: ¿las reglas de la configuración son `desde` o posteriores? Compara por orden en
 * `reglasArena`; sin reglas (archivos antiguos) nunca. */
export const reglasDesde = (config: ConfigArena, desde: ReglasArena): boolean =>
  config.reglas !== undefined && reglasArena.indexOf(config.reglas) >= reglasArena.indexOf(desde);

export class MotorArena {
  readonly estado: EstadoArena;
  readonly eventos: EventoArena[] = [];
  readonly fotogramas: EstadoArena[] = [];
  private ultimaAccion = -Infinity;
  private ultimaDisputa = -Infinity;
  private salidaConduccion: Punto | null = null;
  private get conReinicios() { return this.config.reglas !== undefined; }
  /** Todo el comportamiento del brief 046 (portero, centros y laterales) vive tras esta condición. */
  private get v4() { return reglasDesde(this.config, "reinicios-v4"); }
  /** Todo el comportamiento del brief 051 (remate colocado, potencia, alto, alcance y desvío por
   * nivel, posicionamiento del portero) vive tras esta condición. */
  private get v5() { return reglasDesde(this.config, "reinicios-v5"); }
  /** Todo el comportamiento del bloque A del brief 063 (repliegue de emergencia, persecución tras
   * pérdida y su frenado) vive tras esta condición. */
  private get v6() { return reglasDesde(this.config, "reinicios-v6"); }
  /** Todo el comportamiento de los bloques B y C del brief 063 (atributos, remate lejano, portero a la
   * trayectoria y balón largo) vive tras esta condición. */
  private get v7() { return reglasDesde(this.config, "reinicios-v7"); }
  /** Todo el comportamiento del bloque D del brief 063 (identidad de juego del club) vive tras esta condición. */
  private get v8() { return reglasDesde(this.config, "reinicios-v8"); }
  /** Brief 065 § 2: el error base del remate y el alcance máximo del portero de estas reglas (REMATE_ARENA_V9 desde v9). */
  private get remate9() { return remateDeReglas(reglasDesde(this.config, REMATE_ARENA_V9.desde)); }
  /** Brief 070 § 2.A (v11): la falta se reanuda con un tiro libre (`libre`) desde el punto de la falta. */
  private get libre11() { return reglasDesde(this.config, LIBRE_ARENA.desde); }
  /** Brief 070 § 2.B (v11): la falta dentro del área del infractor es penal. */
  private get penal11() { return reglasDesde(this.config, PENAL_ARENA.desde); }
  /** Brief 068 § 2.A y v1.1: en los pases rasos (pase explícito no largo, candidatos locales y saque de manos) el pasador
   * no elige a un receptor en `adelantados(estado, lado)` en el tick de la decisión. Bajo v1–v9, null (sin filtro). */
  private fueraPasador(lado: Lado): ReadonlySet<string> | null {
    return reglasDesde(this.config, REGLAS_FUERA_DE_JUEGO_068) ? new Set(adelantados(this.estado, lado)) : null;
  }
  /** Brief 063 § 3.2 y brief 068 § 2.A: los candidatos de `evaluarPases` sin los de `fuera` (el primero válido es el mejor). */
  private pasesValidos(j: JugadorArena, fuera: ReadonlySet<string> | null) {
    const c = evaluarPases(j, this.observar(j.lado));
    return fuera ? c.filter(x => !fuera.has(x.p.id)) : c;
  }
  /** Brief 063 § 4.2: los atributos guardados en la configuración (bajo v7; undefined en otro caso). */
  private atributos(id: string): AtributosJugador | undefined { return this.v7 ? this.config.atributos?.[id] : undefined; }
  /** Brief 063 § 9.2: la identidad de juego guardada en la configuración (bajo v8; undefined en otro caso). */
  private estiloJuego(lado: Lado): EstiloJuego | undefined { return this.v8 ? this.config.estilosJuego?.[lado] : undefined; }
  constructor(readonly config: ConfigArena, inicial: EstadoArena = crearEstadoArena(config)) {
    validarConfigArena(config);
    this.estado = structuredClone(inicial);
    if (centroReglamentario(config) && inicial.tick === 0 && inicial.saque?.tipo === "centro" && inicial.balon.poseedor === inicial.saque.ejecutor) {
      const ejecutor = this.estado.jugadores.find(j => j.id === inicial.saque!.ejecutor)!;
      this.evento("reinicio", ejecutor, PUNTO_CENTRAL, PUNTO_CENTRAL, null, { reinicio: "centro" });
    }
    this.fotogramas.push(structuredClone(this.estado));
  }
  private evento(tipo: EventoArena["tipo"], j: JugadorArena, desde: Punto, hasta: Punto, receptor: string | null = null, extra: Partial<EventoArena> = {}): EventoArena {
    // El golpe se resuelve en el paso que va a avanzar, nunca se añade al estado
    // ya publicado de la frontera anterior entre dos intervalos.
    const tick = this.estado.tick + (tipo === "pase" || tipo === "tiro" ? 1 : 0);
    const evento = { id: `a${this.eventos.length + 1}`, tick, tipo, lado: j.lado, jugador: j.id, receptor, desde: { ...desde }, hasta: { ...hasta }, distanciaM: distancia(desde, hasta), ...extra };
    this.eventos.push(evento); reaccionarAficion(this.estado, evento);
    return evento;
  }
  private observar(lado: Lado): ObservacionArena {
    return { id: `politica-local:${this.estado.tick}`, lado, tiempoS: this.estado.tick * ARENA.pasoS, horizonteS: this.config.intervaloS, estado: this.estado, equipos: datosEquipos(this.config, this.estado), condiciones: this.config.partido.condiciones ?? null, recientes: this.eventos.slice(-10),
      ...(this.estado.entrenadores ? { duracionS: this.config.duracionS, resumen: resumir(this.estado, this.eventos, T.ventanaMemoriaS) } : {}),
    };
  }
  private formar(lado: Lado, formacion: FormacionArena): void {
    const asignados = new Map(asignarPuestos(this.estado.jugadores.filter(j => j.lado === lado), formacion).map(j => [j.id, j.puesto]));
    for (const j of this.estado.jugadores) if (j.lado === lado) j.puesto = asignados.get(j.id)!;
  }
  private aplicarGestion(planes: Record<Lado, OrdenesEquipo>): void {
    if (!this.estado.entrenadores) return;
    const observaciones = Object.fromEntries(lados.map(lado => [lado, structuredClone(this.observar(lado))])) as Record<Lado, ObservacionArena>;
    for (const lado of lados) {
      const e = this.config.entrenadores![lado], actual = this.estado.entrenadores[lado], gestion = planes[lado].gestion;
      if (this.estado.tick < actual.proximaRevisionTick) {
        actual.plan.amplitud = planes[lado].amplitud; actual.plan.bloque = planes[lado].bloque;
        continue;
      }
      Object.assign(actual, emocionesEntrenador(observaciones[lado], lado));
      actual.ultimaRevisionTick = this.estado.tick;
      actual.proximaRevisionTick = siguienteRevision(this.config.partido.seed, e.nombre, this.estado.tick, e.paciencia);
      if (gestion) {
        if (gestion.mentalidad !== actual.plan.mentalidad) actual.ultimoPlanTick = this.estado.tick;
        if (gestion.formacion && gestion.formacion !== actual.formacion) {
          this.formar(lado, gestion.formacion); actual.formacion = gestion.formacion; actual.ultimoPlanTick = this.estado.tick;
        }
        actual.plan = planDelEntrenador(e, gestion.mentalidad, this.config.partido.condiciones);
        if (gestion.sustitucion) actual.pendiente = structuredClone(gestion.sustitucion);
      }
      actual.plan.amplitud = planes[lado].amplitud; actual.plan.bloque = planes[lado].bloque;
      const motivo = gestion?.motivo ?? "mantener", fuentes = gestion?.fuentes ?? [];
      actual.ultimaDecision = { tick: this.estado.tick + 1, motivo, fuentes };
      const capitan = this.estado.jugadores.find(j => j.lado === lado && j.capitan) ?? this.estado.jugadores.find(j => j.lado === lado)!;
      this.evento("plan_equipo", capitan, capitan.posicion, capitan.posicion, null, { tick: this.estado.tick + 1, entrenador: e.nombre, motivo, fuentes, formacion: actual.formacion });
    }
  }
  private asegurarCapitanes(): void {
    for (const lado of lados) if (!this.estado.jugadores.some(j => j.lado === lado && j.capitan)) {
      const propios = this.estado.jugadores.filter(j => j.lado === lado);
      if (propios.length) { designarCapitanes(propios); }
    }
  }
  private realizarCambios(): void {
    if (!this.estado.entrenadores) return;
    for (const lado of lados) {
      const tecnico = this.estado.entrenadores[lado], pares = paresSustitucion(tecnico.pendiente);
      if (!pares.length) continue;
      tecnico.pendiente = null;
      // Todos los pares comparten la interrupción: una sola ventana, un cambio por par.
      // Un par que dejó de ser posible (p. ej. el titular fue expulsado) se omite.
      if (tecnico.ventanas >= T.maxVentanas) continue;
      let realizados = 0;
      for (const par of pares) {
        const sale = this.estado.jugadores.find(j => j.id === par.sale && j.lado === lado);
        const suplente = this.estado.banco!.find(j => j.id === par.entra && j.lado === lado);
        if (!sale || !suplente || tecnico.cambios >= T.maxCambios) continue;
        const entra = { ...suplente, puesto: sale.puesto, posicion: { x: ARENA.largoM / 2, y: lado === "local" ? 0 : ARENA.anchoM }, velocidad: { x: 0, y: 0 }, capitan: false };
        sale.capitan = false;
        this.estado.jugadores = this.estado.jugadores.map(j => j.id === sale.id ? entra : j);
        this.estado.banco = this.estado.banco!.filter(j => j.id !== entra.id);
        this.estado.retirados!.push(sale);
        tecnico.cambios++; realizados++; tecnico.ultimoCambioTick = this.estado.tick;
        const evento = this.evento("cambio", entra, sale.posicion, entra.posicion, null, { sale: sale.id, entrenador: this.config.entrenadores![lado].nombre, motivo: "sustitucion" });
        tecnico.ultimaDecision = { tick: this.estado.tick, motivo: "sustitucion", fuentes: [...(realizados > 1 ? tecnico.ultimaDecision!.fuentes : []), evento.id] };
      }
      if (realizados) tecnico.ventanas++;
    }
    this.asegurarCapitanes();
  }
  private planesActivos(planes: Record<Lado, OrdenesEquipo>): Record<Lado, OrdenesEquipo> {
    if (!this.estado.entrenadores) return planes;
    return Object.fromEntries(lados.map(lado => {
      const ids = new Set(this.estado.jugadores.filter(j => j.lado === lado).map(j => j.id));
      const previas = planes[lado].ordenes;
      if (previas.length === ids.size && previas.every(o => ids.has(o.jugador) && (!o.receptor || ids.has(o.receptor)))) return [lado, planes[lado]];
      const base = planProgramado(this.observar(lado));
      return [lado, { ...planes[lado], ordenes: base.ordenes.map(o => previas.find(p => p.jugador === o.jugador && (!p.receptor || ids.has(p.receptor))) ?? o) }];
    })) as Record<Lado, OrdenesEquipo>;
  }
  private frenarJugadores(): void {
    const manos = this.v4 ? this.estado.balon.manos : undefined;
    for (const j of this.estado.jugadores) {
      const rapidez = Math.hypot(j.velocidad.x, j.velocidad.y);
      const factor = rapidez ? Math.max(0, 1 - ARENA.aceleracionMps2 * ARENA.pasoS / rapidez) : 0;
      let siguiente = enCancha({ x: j.posicion.x + j.velocidad.x * factor * ARENA.pasoS, y: j.posicion.y + j.velocidad.y * factor * ARENA.pasoS });
      // Brief 046 v1.1: la inercia de una pausa tampoco saca del área al portero con el balón en las manos.
      if (manos?.portero === j.id) siguiente = limitarAreaPropia(siguiente, j.lado);
      j.velocidad = { x: (siguiente.x - j.posicion.x) / ARENA.pasoS, y: (siguiente.y - j.posicion.y) / ARENA.pasoS }; j.posicion = siguiente;
    }
    const portador = this.estado.jugadores.find(j => j.id === this.estado.balon.poseedor);
    if (portador) this.estado.balon.posicion = { ...portador.posicion };
  }
  /** `extra` (solo reinicios-v4): `motivo` del evento (`centro`, `saque_manos`) y vuelo `centro`. */
  private sacarBalon(j: JugadorArena, tipo: "pase" | "tiro", destino: Punto, receptor: string | null, extra: { motivo?: "centro" | "saque_manos" | "largo" | "libre"; centro?: true; aereo?: true } = {}): void {
    const desde = { ...j.posicion };
    const rng = prngDerivado(this.config.partido.seed, `arena:golpe:${this.estado.tick}:${j.id}`);
    const entorno = this.estado.entrenadores ? efectosEntorno(this.config, this.estado, j.lado, distancia(desde, destino)) : null;
    const lluvia = this.config.partido.condiciones?.clima === "lluvia" ? ARENA.errorLluviaM : 0;
    const nivel = entorno ? capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto)) : j.nivel;
    let error = (1 - nivel / 100) * (tipo === "tiro" ? ARENA.errorTiroM : ARENA.errorPaseM)
      + (entorno ? entorno.errorLluviaM + entorno.errorPresionM + (tipo === "pase" ? entorno.errorNieblaM + entorno.errorCespedM : 0) : lluvia);
    // Brief 051 (v5): el remate apunta dentro del arco al lado libre del portero, con potencia según la
    // distancia, error triangular (dos extracciones de `arena:golpe`) y un posible balón por encima
    // (PRNG `arena:remate`). Pases y centros no cambian.
    // Brief 063 § 7.1 y § 8.2 (v7): la visión del pasador escala el error de todo pase; el balón largo suma su
    // error extra.
    const a7 = this.atributos(j.id);
    if (a7 && tipo === "pase") {
      error *= factorErrorPase(a7.vision);
      if (extra.motivo === "largo") error += errorExtraLargo(distancia(desde, destino), a7.vision);
    }
    let remate5: { potencia: number; alto: boolean } | null = null, lejano = false;
    if (this.v5 && tipo === "tiro") {
      const portero = this.estado.jugadores.find(p => p.lado !== j.lado && p.puesto === "POR");
      const d = distancia(desde, destino), potencia = potenciaRemate(d);
      destino = transformar({ x: ARENA.largoM, y: objetivoRemate(desde, portero?.posicion ?? null, nivel, j.personalidad?.remate ?? REMATE_NEUTRO, j.lado).y }, j.lado);
      // Brief 063 § 8.1 (v7): un remate desde más de radioTiroM (y como mucho maxM) es lejano: más error y más
      // probabilidad de irse alto (acotada). A d ≤ radioTiroM nada cambia.
      const lejos = this.v7 ? lejosRemate(d) : 0;
      lejano = lejos > 0;
      // Brief 065 § 2 (v9): el error base sale de las reglas.
      const base = errorRemate(nivel, d, potencia, this.remate9.errorBaseM);
      error = (lejano ? base * factorErrorLejano(lejos) : base) + (entorno ? entorno.errorLluviaM + entorno.errorPresionM : lluvia);
      const alto = lejano ? altoLejano(probabilidadAlto(nivel, potencia), lejos) : probabilidadAlto(nivel, potencia);
      remate5 = { potencia, alto: prngDerivado(this.config.partido.seed, `arena:remate:${this.estado.tick}:${j.id}`).chance(alto) };
    }
    const lateral = remate5 ? rng.next() + rng.next() - 1 : rng.next() * 2 - 1;
    const bruto = { x: destino.x + (this.conReinicios && tipo === "tiro" ? (j.lado === "local" ? ARENA.remateTrasLineaM : -ARENA.remateTrasLineaM) : 0), y: destino.y + lateral * error };
    const objetivo = this.conReinicios ? bruto : enCancha(bruto);
    const fuera = adelantados(this.estado, j.lado);
    this.estado.balon = { ...(this.conReinicios ? { ultimoToque: { jugador: j.id, lado: j.lado } } : {}), posicion: desde, poseedor: null, vuelo: { tipo, autor: j.id, lado: j.lado, receptor, origen: desde, destino: objetivo, inicioTick: this.estado.tick, adelantados: fuera, ...(extra.centro ? { centro: true as const } : {}), ...(extra.aereo ? { aereo: true as const } : {}),
      ...(remate5 ? { potencia: remate5.potencia, ...(remate5.alto ? { alto: true as const } : {}) } : {}), ...(lejano ? { lejano: true as const } : {}) } };
    // Brief 070 (v11): el remate directo de un tiro libre lleva `motivo: "libre"` aunque sea lejano (el vuelo conserva
    // `lejano` y su modelo de error).
    this.evento(tipo, j, desde, objetivo, receptor, extra.motivo === "libre" ? { motivo: "libre" } : lejano ? { motivo: "lejano" } : extra.motivo ? { motivo: extra.motivo } : {});
    this.ultimaAccion = this.estado.tick;
  }
  private accionBalon(planes: Record<Lado, OrdenesEquipo>, ejecutadas: Set<string>): void {
    const j = this.estado.jugadores.find(p => p.id === this.estado.balon.poseedor);
    const ritmo = j && this.estado.entrenadores ? T.ritmo[this.estado.entrenadores[j.lado].plan.ritmo] : 1;
    const manos = this.v4 ? this.estado.balon.manos : undefined;
    if (j && manos) { this.soltarManos(j, manos, planes, ejecutadas, ritmo); return; }
    if (!j || (this.estado.tick - this.ultimaAccion) * ARENA.pasoS < ARENA.accionCadaS / ritmo) return;
    const orden = planes[j.lado].ordenes.find(o => o.jugador === j.id)!;
    const usarOrden = !ejecutadas.has(j.id);
    const arco = transformar({ x: ARENA.largoM, y: ARENA.anchoM / 2 }, j.lado);
    const receptorOrden = usarOrden && orden.accion === "pasar" ? this.estado.jugadores.find(p => p.id === orden.receptor) : undefined;
    // Brief 068 § 2.A y v1.1 (v10): los adelantados del lado en este tick (la misma función e instante que fijan la lista
    // del árbitro al golpear). Un `pasar` explícito RASO a uno de ellos se trata como `pasarImposible`; el `pasar` largo
    // del LLM, el balón largo local y los centros no se filtran (v1.1: riesgo real de timing, el árbitro sanciona).
    const fuera = this.fueraPasador(j.lado);
    const ordenFuera = !!fuera && !!receptorOrden && fuera.has(receptorOrden.id);
    // Brief 063 § 8.2 (v7): un `pasar` a un compañero de campo entre paseMaxM y el alcance de visión del pasador
    // (de campo) sale como balón largo, sin exigir ventaja.
    const v7 = this.v7, a7 = this.atributos(j.id);
    const alcance = v7 && j.puesto !== "POR" ? alcanceLargo(a7) : null;
    const dOrden = receptorOrden ? distancia(j.posicion, receptorOrden.posicion) : Infinity;
    const pasarLargo = alcance !== null && !!receptorOrden && receptorOrden.lado === j.lado && receptorOrden.id !== j.id && receptorOrden.puesto !== "POR" && dOrden > ARENA.paseMaxM && dOrden <= alcance;
    // Brief 046, lateral A (v4): un `pasar` hacia un receptor inexistente o fuera de alcance no
    // bloquea al poseedor; en este tick decide en local y la orden sigue pendiente.
    const pasarImposible = this.v4 && usarOrden && orden.accion === "pasar" && !pasarLargo && (!receptorOrden || dOrden > ARENA.paseMaxM || ordenFuera);
    // Brief 063 § 8.1 (v7, v1.1 § 17.2): un `tirar` desde más de LARGO_ARENA.remate.maxM no se ejecuta; ese tick
    // decide en local (soltar el balón consume la orden; conducir no, v1.2 § 18.5).
    const tirarImposible = v7 && usarOrden && orden.accion === "tirar" && distancia(j.posicion, arco) > LA.remate.maxM;
    // V2 respeta un pase/conducción explícito aun cerca del arco. La personalidad
    // decide solo al elegir una acción local; no reemplaza una orden válida del LLM.
    // Bajo v1–v3, `centrar` no es explícita: decide en local (límite declarado del brief 046).
    const accionExplicita = usarOrden && (["pasar", "conducir", "tirar"].includes(orden.accion) || this.v4 && orden.accion === "centrar") && !pasarImposible && !tirarImposible;
    // Solo una acción local usa la opción de pase; con orden explícita se descartaba. Brief 063 § 3.2: los
    // candidatos de `evaluarPases` (su primero es exactamente `opcionPase`).
    // Brief 068 § 2.A (v10): pases rasos sin los adelantados; el primero válido es el mejor.
    const candidatosLocal = j.personalidad && !accionExplicita ? this.pasesValidos(j, fuera) : undefined;
    const paseLocal = candidatosLocal?.[0]?.p;
    const tiroLocal = j.personalidad
      ? !accionExplicita && prefiereTirar(j, distancia(j.posicion, arco), !!paseLocal)
      : distancia(j.posicion, arco) <= ARENA.radioTiroM;
    if ((usarOrden && orden.accion === "tirar" && !tirarImposible) || tiroLocal) {
      this.sacarBalon(j, "tiro", arco, null); ejecutadas.add(j.id); return;
    }
    // Brief 063 § 8.1 (v7): remate lejano local, tras `tiroLocal` falso y sin acción explícita, antes del centro. Bloque D
    // (v8): el umbral de potencia y la probabilidad según la identidad del club.
    const estilo = this.estiloJuego(j.lado);
    if (v7 && !accionExplicita && puedeRematarLejos(j, a7, this.estado, estilo)
      && prngDerivado(this.config.partido.seed, `arena:lejano:${this.estado.tick}:${j.id}`).chance(Math.min(1, probabilidadLejano(j.personalidad?.remate ?? REMATE_NEUTRO, a7!.potencia, estilo)))) {
      this.sacarBalon(j, "tiro", arco, null); ejecutadas.add(j.id); return;
    }
    if (this.v4 && usarOrden && orden.accion === "centrar") { this.centrarOrden(j, orden, ejecutadas); return; }
    if (this.v4 && !accionExplicita && j.puesto !== "POR" && enZonaCentro(transformar(j.posicion, j.lado)) && puedeCentrar(j)) {
      const centro = opcionCentro(j, this.estado);
      if (centro) { this.sacarBalon(j, "pase", centro.destino, centro.receptor.id, { motivo: "centro", centro: true }); ejecutadas.add(j.id); return; }
    }
    if (usarOrden && orden.accion === "conducir") { ejecutadas.add(j.id); this.ultimaAccion = this.estado.tick; return; }
    // Brief 063 § 8.2 (v7): el `pasar` largo del LLM, y después el balón largo local si puntúa más que el mejor
    // pase corto (fase aérea del 046: solo se toca a ≤ caidaM de su destino).
    if (usarOrden && orden.accion === "pasar" && pasarLargo) {
      this.sacarBalon(j, "pase", this.destinoPase(j, receptorOrden!), receptorOrden!.id, { motivo: "largo", aereo: true }); ejecutadas.add(j.id); return;
    }
    if (v7 && !(usarOrden && orden.accion === "pasar" && !pasarImposible) && !prefiereConducir(j) && j.puesto !== "POR") {
      // Bloque D (v8): el umbral de visión y la penalización por distancia según la identidad del club.
      // Brief 068 v1.1 (v10): el largo no se filtra; el mejor corto con el que se compara es el mejor raso válido.
      const largo = opcionPaseLargo(j, a7, this.estado, estilo);
      if (largo && largo.puntuacion > ((candidatosLocal ?? this.pasesValidos(j, fuera))[0]?.puntuacion ?? -Infinity)) {
        this.sacarBalon(j, "pase", largo.destino, largo.receptor.id, { motivo: "largo", aereo: true }); ejecutadas.add(j.id); return;
      }
    }
    const receptor = usarOrden && orden.accion === "pasar" && !pasarImposible ? receptorOrden
      : prefiereConducir(j) ? undefined : j.personalidad ? paseLocal : this.pasesValidos(j, fuera)[0]?.p;
    if (receptor && distancia(j.posicion, receptor.posicion) <= ARENA.paseMaxM) {
      // Extrapolación de velocidad actual, no consulta a una posición futura.
      const viaje = distancia(j.posicion, receptor.posicion) / ARENA.velocidadBalonMps;
      const destino = enCancha({ x: receptor.posicion.x + receptor.velocidad.x * viaje, y: receptor.posicion.y + receptor.velocidad.y * viaje });
      this.sacarBalon(j, "pase", destino, receptor.id); ejecutadas.add(j.id);
    }
  }
  /** Extrapolación de la velocidad actual del receptor (como el pase local). */
  private destinoPase(j: JugadorArena, receptor: JugadorArena): Punto {
    const viaje = distancia(j.posicion, receptor.posicion) / ARENA.velocidadBalonMps;
    return enCancha({ x: receptor.posicion.x + receptor.velocidad.x * viaje, y: receptor.posicion.y + receptor.velocidad.y * viaje });
  }
  /** Brief 046 (v4): el portero con el balón en las manos. Nunca tira, conduce ni centra. */
  private soltarManos(j: JugadorArena, manos: NonNullable<EstadoArena["balon"]["manos"]>, planes: Record<Lado, OrdenesEquipo>, ejecutadas: Set<string>, ritmo: number): void {
    // 1. Antes de accionCadaS / ritmo desde la posesión, no hace nada.
    if ((this.estado.tick - manos.desdeTick) * ARENA.pasoS < ARENA.accionCadaS / ritmo) return;
    let receptor: JugadorArena | undefined;
    let destino: Punto;
    const rivales = this.estado.jugadores.filter(p => p.lado !== j.lado);
    if (this.estado.tick >= manos.hastaTick) {
      // 3. Vencido el plazo, el saque forzado tiene prioridad sobre cualquier pase ordinario. v1.2:
      //    solo entre saques admisibles (largo aéreo o corto con línea limpia); si no hay, despeje aéreo.
      receptor = saqueForzado(j, this.estado, p => this.destinoPase(j, p));
      destino = receptor ? this.destinoPase(j, receptor) : despejeManos(j.posicion);
    } else {
      // 2. Antes del plazo solo suelta sin rivales a menos de distanciaManosM.
      if (rivales.some(p => distancia(p.posicion, j.posicion) < PO.distanciaManosM)) return;
      const orden = planes[j.lado].ordenes.find(o => o.jugador === j.id)!;
      // Brief 068 § 2.A (v10): el receptor explícito y el de `opcionPase` no pueden estar adelantados.
      const fuera = this.fueraPasador(j.lado);
      const explicito = !ejecutadas.has(j.id) && orden.accion === "pasar" ? this.estado.jugadores.find(p => p.id === orden.receptor && p.lado === j.lado && p.id !== j.id && !fuera?.has(p.id)) : undefined;
      receptor = explicito && distancia(j.posicion, explicito.posicion) <= PO.saqueManosMaxM ? explicito : this.pasesValidos(j, fuera)[0]?.p;
      if (!receptor) return;
      destino = this.destinoPase(j, receptor);
      // v1.2: un saque corto con un rival cerca de la línea no sale; espera (o el forzado).
      if (!saqueAdmisible(j.posicion, destino, rivales).admisible) return;
    }
    const aereo = !receptor || saqueAdmisible(j.posicion, destino, rivales).aereo;
    this.sacarBalon(j, "pase", destino, receptor?.id ?? null, { motivo: "saque_manos", ...(aereo ? { aereo: true as const } : {}) }); ejecutadas.add(j.id);
  }
  /** Brief 046 (v4): orden `centrar` del LLM. Si aún no es ejecutable, el poseedor conduce con
   * `conduccionPorDefecto` (en moverJugadores) y la orden queda pendiente. */
  private centrarOrden(j: JugadorArena, orden: OrdenJugador, ejecutadas: Set<string>): void {
    if (transformar(j.posicion, j.lado).x < A.zonaCentroXM || distancia(j.posicion, orden.destino) > A.centroMaxM) return;
    const designado = orden.receptor ? this.estado.jugadores.find(p => p.id === orden.receptor && p.lado === j.lado) : undefined;
    const receptor = designado ?? receptorCentro(j, orden.destino, this.estado);
    this.sacarBalon(j, "pase", orden.destino, receptor?.id ?? null, { motivo: "centro", centro: true }); ejecutadas.add(j.id);
  }
  /** Brief 046 (v4): el portero recibe el balón en las manos dentro de su área. Se acota su
   * posición (≥ controlM de su línea) y se anula su velocidad (v1.1). */
  private darManos(j: JugadorArena, desdeTick: number, hastaTick: number): void {
    j.posicion = limitarAreaPropia(j.posicion, j.lado); j.velocidad = { x: 0, y: 0 };
    this.estado.balon.posicion = { ...j.posicion };
    this.estado.balon.manos = { portero: j.id, desdeTick, hastaTick };
  }
  private moverJugadores(planes: Record<Lado, OrdenesEquipo>, posesionInicial: Lado | undefined): void {
    this.salidaConduccion = null;
    const antes = structuredClone(this.estado.jugadores);
    const balon = this.estado.balon;
    const poseedor = antes.find(j => j.id === balon.poseedor);
    const ladoBalon = poseedor?.lado ?? balon.vuelo?.lado;
    const perseguidores = perseguidoresDe(antes, balon.posicion);
    // Brief 046 (v4): condiciones evaluadas una vez por tick sobre el estado anterior al paso.
    const v4 = this.v4;
    const salida = v4 ? { local: manoAMano(this.estado, "local", PO.manoAManoRadioM), visita: manoAMano(this.estado, "visita", PO.manoAManoRadioM) } : null;
    const manos = v4 ? balon.manos : undefined, porteroManos = manos ? antes.find(j => j.id === manos.portero) : undefined;
    const llegada = v4 && ladoBalon ? destinosLlegada(this.estado, ladoBalon, planes[ladoBalon].ordenes, ladoBalon !== posesionInicial) : null;
    // Brief 063 (v6): la persecución vencida se borra al empezar el paso; el repliegue y quien persigue se
    // evalúan una vez sobre el estado anterior al paso, fuera de pausa y saque.
    const v7 = this.v7;
    const v6 = this.v6, enJuego = !this.estado.saque && !(this.estado.pausa && this.estado.tick < this.estado.pausa.hastaTick);
    if (v6 && this.estado.persecucion && this.estado.tick >= this.estado.persecucion.hastaTick) this.estado.persecucion = null;
    // Bloque D (v8): la identidad del lado que defiende suma al máximo del repliegue.
    const superado = this.v8 && v6 && enJuego ? superadoPor(this.estado) : null;
    const estiloDefensa = superado ? this.estiloJuego(rival(superado.lado)) : undefined;
    const repliegue = new Set(v6 && enJuego ? seleccionRepliegue(this.estado, perseguidores, estiloDefensa ? EJ.efectos[estiloDefensa].repliegue : 0).map(j => j.id) : []);
    const persecucion = v6 && enJuego ? this.estado.persecucion : null, persiguen = new Set<string>();
    if (persecucion && ladoBalon !== persecucion.lado && antes.some(j => j.id === persecucion.jugador)) {
      persiguen.add(persecucion.jugador);
      // Bloque D (v8): una identidad con `extra` añade un perseguidor de apoyo (el más cercano al balón).
      const estiloPersigue = this.estiloJuego(persecucion.lado), apoyo = estiloPersigue && EJ.efectos[estiloPersigue].extra ? apoyoPersecucion(antes, balon.posicion, persecucion, perseguidores) : undefined;
      if (apoyo) persiguen.add(apoyo.id);
    }
    for (const j of this.estado.jugadores) {
      const orden = planes[j.lado].ordenes.find(o => o.jugador === j.id)!;
      let destino = { ...orden.destino };
      if (ladoBalon !== posesionInicial && ladoBalon !== undefined) destino = { ...anclas(this.estado.entrenadores?.[j.lado].formacion ?? this.config.formaciones[j.lado], j.lado, ladoBalon === j.lado ? "ataque" : "defensa")[j.puesto]! };
      if (j.puesto !== "POR") {
        const nominal = transformar(destino, j.lado);
        nominal.y = ARENA.anchoM / 2 + (nominal.y - ARENA.anchoM / 2) * ARENA.amplitud[planes[j.lado].amplitud];
        // Bloque D (v8): la identidad del club se suma a la altura del bloque del plan.
        const estiloBloque = this.estiloJuego(j.lado);
        if (ladoBalon !== j.lado) nominal.x += estiloBloque ? ARENA.alturaBloqueM[planes[j.lado].bloque] + EJ.efectos[estiloBloque].bloqueM : ARENA.alturaBloqueM[planes[j.lado].bloque];
        destino = enCancha(transformar(nominal, j.lado));
      }
      const llega = llegada?.get(j.id);
      if (llega) destino = { ...llega };
      if (j.id === balon.vuelo?.receptor) destino = { ...balon.vuelo.destino };
      if ((ladoBalon !== j.lado || balon.poseedor === null && balon.vuelo === null) && perseguidores[j.lado] === j.id) destino = { ...balon.posicion };
      if (orden.accion === "presionar" && ladoBalon !== j.lado && j.puesto !== "POR") destino = { ...balon.posicion };
      // Brief 063 (v6): el repliegue gana a cualquier orden salvo presionar; después, la persecución.
      else if (repliegue.has(j.id)) destino = destinoRepliegue(balon.posicion, j.lado);
      else if (persiguen.has(j.id)) destino = destinoPersecucion(balon.posicion, j);
      // Límite universal del perdedor (v1.1 § 17.1): venga de la rama que venga, con el rival en posesión.
      if (persiguen.has(j.id) && ladoBalon === rival(j.lado)) destino = limitarPersecucion(destino, j);
      if (j.id === balon.poseedor) {
        // Los pases/tiros ya ejecutados no arrastran al portador a su propio
        // receptor: al conducir, el control local busca progresar.
        if (v4) destino = this.destinoPoseedor(j, orden, destino, !!manos);
        else if (orden.accion !== "conducir" || distancia(j.posicion, destino) < ARENA.toleranciaM) destino = enCancha({ x: j.posicion.x + (j.lado === "local" ? ARENA.avanceConduccionM : -ARENA.avanceConduccionM), y: j.posicion.y });
      }
      // Salida a achicar: objetiva, ninguna orden la activa ni la impide.
      if (salida?.[j.lado] && j.puesto === "POR" && j.id !== balon.poseedor) destino = destinoSalida(balon.posicion, j.lado);
      // Brief 051 (v5): fuera del mano a mano, con el balón de un rival (poseedor o vuelo) cerca de su
      // arco y sin saque, el portero se coloca sobre la línea balón–centro del arco.
      else if (this.v5 && j.puesto === "POR" && j.id !== balon.poseedor && ladoBalon !== undefined && ladoBalon !== j.lado && !this.estado.saque && balonCercaDelArco(balon.posicion, j.lado)) destino = destinoPosicionamiento(balon.posicion, j.lado);
      // Brief 063 § 8.1 (v7): ante un remate lejano rival el portero va al punto de la trayectoria en su x; sustituye
      // a la salida y al posicionamiento del 051 (el límite de área de abajo sigue).
      if (v7 && j.puesto === "POR" && j.id !== balon.poseedor && balon.vuelo?.tipo === "tiro" && balon.vuelo.lado !== j.lado && balon.vuelo.lejano) destino = destinoTrayectoria(balon.vuelo, j);
      // Ningún rival se dirige a menos de distanciaManosM del portero con el balón en las manos.
      if (porteroManos && j.lado !== porteroManos.lado) destino = respetarManos(destino, j.posicion, porteroManos.posicion);
      const porteroEnArea = v4 && j.puesto === "POR" && j.id === balon.poseedor && enAreaPropia(j.posicion, j.lado);
      if (porteroEnArea) destino = limitarAreaPropia(destino, j.lado);
      if (j.puesto === "POR" && j.id !== balon.poseedor) {
        const propio = transformar(destino, j.lado);
        propio.x = limitar(propio.x, ARENA.controlM, ARENA.areaLargoM);
        propio.y = limitar(propio.y, (ARENA.anchoM - ARENA.areaAnchoM) / 2, (ARENA.anchoM + ARENA.areaAnchoM) / 2);
        destino = transformar(propio, j.lado);
      }
      // Separación como dirección deseada, nunca corrección instantánea de x/y.
      let dx = destino.x - j.posicion.x, dy = destino.y - j.posicion.y;
      for (const otro of antes) if (otro.id !== j.id) {
        const d = distancia(j.posicion, otro.posicion);
        if (d > 0 && d < ARENA.separacionM) { dx += (j.posicion.x - otro.posicion.x) / d * ARENA.separacionM; dy += (j.posicion.y - otro.posicion.y) / d * ARENA.separacionM; }
      }
      const d = Math.hypot(dx, dy);
      const entorno = this.estado.entrenadores ? efectosEntorno(this.config, this.estado, j.lado) : null;
      const ritmo = this.estado.entrenadores ? T.ritmo[this.estado.entrenadores[j.lado].plan.ritmo] : 1;
      const nivel = entorno ? capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto)) : j.nivel;
      // Brief 063 § 7.1 (v7): la velocidad escala la velocidad máxima y la aceleración del jugador (no el frenado).
      const a7 = v7 ? this.config.atributos?.[j.id] : undefined;
      const maxBase = ARENA.velocidadMps * (ARENA.velocidadMinFactor + ARENA.velocidadNivelFactor * nivel / 100) * (ARENA.factorEnergiaMin + (1 - ARENA.factorEnergiaMin) * j.energia) * ritmo * (entorno?.velocidadJugador ?? 1);
      const max = a7 ? maxBase * factorVelocidadMax(a7.velocidad) : maxBase;
      const aceleracion = a7 ? ARENA.aceleracionMps2 * factorAceleracion(a7.velocidad) : ARENA.aceleracionMps2;
      const rapidez = Math.min(max, Math.sqrt(2 * aceleracion * Math.max(0, d - ARENA.toleranciaM)));
      const deseada = { x: d ? dx / d * rapidez : 0, y: d ? dy / d * rapidez : 0 };
      const ax = deseada.x - j.velocidad.x, ay = deseada.y - j.velocidad.y;
      // Brief 063 § 6.4 (v6): quien repliega o persigue frena a frenadoMps2 cuando la velocidad deseada reduce
      // su componente actual; el resto conserva exactamente la física anterior.
      const actual = Math.hypot(j.velocidad.x, j.velocidad.y);
      const frena = (repliegue.has(j.id) || persiguen.has(j.id)) && actual > 0 && (deseada.x * j.velocidad.x + deseada.y * j.velocidad.y) / actual < actual;
      const cambioMax = frena ? PE.frenadoMps2 : aceleracion;
      const delta = Math.hypot(ax, ay), factor = delta ? Math.min(1, cambioMax * ARENA.pasoS / delta) : 0;
      const velocidad = { x: j.velocidad.x + ax * factor, y: j.velocidad.y + ay * factor };
      let bruto = { x: j.posicion.x + velocidad.x * ARENA.pasoS, y: j.posicion.y + velocidad.y * ARENA.pasoS };
      // La posición, no solo el destino: ninguna separación lo empuja fuera del área ni tras su línea.
      if (porteroEnArea) bruto = limitarAreaPropia(bruto, j.lado);
      if (this.conReinicios && j.id === balon.poseedor && cruceDeBanda(j.posicion, bruto)) this.salidaConduccion = bruto;
      const siguiente = enCancha(bruto);
      const recorrido = distancia(j.posicion, siguiente);
      j.velocidad = { x: (siguiente.x - j.posicion.x) / ARENA.pasoS, y: (siguiente.y - j.posicion.y) / ARENA.pasoS };
      j.posicion = siguiente;
      const calor = entorno?.desgaste ?? (this.config.partido.condiciones?.clima === "calor" ? ARENA.factorCalor : 1);
      // Brief 063 § 7.1 (v7): la resistencia escala el desgaste por metro.
      const desgaste = recorrido * (entorno ? T.energiaPorMetro * (1 + Math.max(0, ritmo - 1) * T.desgasteRitmo) : ARENA.energiaPorMetro) * calor;
      j.energia = limitar(j.energia - (a7 ? desgaste * factorDesgaste(a7.resistencia) : desgaste) + (recorrido < ARENA.toleranciaM ? ARENA.recuperacionEnergiaS * ARENA.pasoS : 0), ARENA.energiaMin, 1);
    }
  }
  /** Brief 046 (v4): destino del poseedor. El de campo conduce hacia el área (sin cruzar la línea)
   * y renueva un `conducir` alcanzado; el portero nunca conduce por defecto. */
  private destinoPoseedor(j: JugadorArena, orden: OrdenJugador, destino: Punto, manos: boolean): Punto {
    const limitado = limitarConduccion(destino, j.lado);
    const conduce = orden.accion === "conducir" && distancia(j.posicion, limitado) >= A.renovarConduccionM;
    if (j.puesto === "POR") return conduce && !manos ? limitado : { ...j.posicion };
    return conduce ? limitado : conduccionPorDefecto(j);
  }
  /** `falta` (brief 070, solo "libre" y "penal" bajo v11): el ejecutor elegido por `resolverFalta` y el id de la falta. */
  private prepararSaque(tipo: TipoReinicioArena, lado: Lado, punto: Punto, ultimoToque?: string, falta?: { ejecutor: JugadorArena; id: string }): void {
    if (this.v6) this.estado.persecucion = null;
    this.realizarCambios();
    const propios = this.estado.jugadores.filter(j => j.lado === lado);
    const centroNuevo = tipo === "centro" && centroReglamentario(this.config);
    const ejecutor = falta ? falta.ejecutor : centroNuevo ? colocarCentro(this.estado, lado) : tipo === "meta" ? propios.find(j => j.puesto === "POR")! : propios.filter(j => j.puesto !== "POR").sort((a, b) => distancia(a.posicion, punto) - distancia(b.posicion, punto) || a.id.localeCompare(b.id))[0]!;
    const desde = { ...this.estado.balon.posicion };
    for (const j of this.estado.jugadores) {
      if (tipo === "centro" && !centroNuevo) {
        const base = anclas(this.estado.entrenadores![j.lado].formacion, j.lado, "base")[j.puesto]!;
        const nominal = transformar(base, j.lado); nominal.x = Math.min(nominal.x, j.lado === lado ? ARENA.centroPropioMaxM : ARENA.centroRivalMaxM);
        j.posicion = transformar(nominal, j.lado);
      } else if (tipo === "penal") {
        // Brief 070 § 2.B (v11): todos (salvo el ejecutor) fuera del área y a ≥ distanciaSaqueLibreM del punto; el
        // portero defensor en su línea, en el centro del arco.
        if (j.id !== ejecutor.id) j.posicion = colocacionPenal(j, rival(lado));
      } else if (j.lado !== lado) {
        // Brief 070 § 2.A (v11): en el tiro libre, los rivales a ≥ distanciaSaqueLibreM con el mismo empuje.
        const minimo = tipo === "banda" ? ARENA.distanciaSaqueBandaM : tipo === "esquina" ? ARENA.distanciaSaqueEsquinaM : tipo === "libre" ? ARENA.distanciaSaqueLibreM : ARENA.distanciaSaqueMetaM;
        if (distancia(j.posicion, punto) < minimo) {
          if (tipo === "libre") j.posicion = apartarDelSaque(j.posicion, punto, minimo);
          else {
            const dx = ARENA.largoM / 2 - punto.x, dy = ARENA.anchoM / 2 - punto.y, d = Math.hypot(dx, dy);
            j.posicion = enCancha({ x: punto.x + dx / d * minimo, y: punto.y + dy / d * minimo });
          }
        }
        if (tipo === "meta") { const nominal = transformar(j.posicion, lado); nominal.x = Math.max(nominal.x, ARENA.areaLargoM + ARENA.margenAreaMetaM); j.posicion = transformar(nominal, lado); }
      }
      j.velocidad = { x: 0, y: 0 };
    }
    ejecutor.posicion = { ...punto };
    this.estado.balon = { posicion: { ...punto }, poseedor: ejecutor.id, vuelo: null, ...(this.estado.balon.ultimoToque ? { ultimoToque: this.estado.balon.ultimoToque } : {}) };
    const hastaTick = this.estado.tick + Math.round(T.pausaS / ARENA.pasoS);
    this.estado.saque = { tipo, lado, ejecutor: ejecutor.id, punto: { ...punto }, hastaTick, ...(falta ? { falta: falta.id } : {}) };
    this.estado.pausa = { hastaTick, lado, punto: { ...punto }, motivo: "reinicio" };
    this.evento("reinicio", ejecutor, enCancha(desde), punto, null, falta ? { reinicio: tipo, fuentes: [falta.id] } : { reinicio: tipo, ultimoToque });
    this.ultimaAccion = this.estado.tick; this.ultimaDisputa = this.estado.tick;
  }
  /** `planes` y `ejecutadas` (brief 070): las órdenes vigentes del ejecutor de un tiro libre (v11). */
  private ejecutarSaque(planes?: Record<Lado, OrdenesEquipo>, ejecutadas?: Set<string>): void {
    const saque = this.estado.saque!;
    const autor = this.estado.jugadores.find(j => j.id === saque.ejecutor)!;
    // Brief 070 § 2.B (v11): el penal se resuelve con su propia probabilidad (`lanzarPenal`), no con el remate en juego.
    if (saque.tipo === "penal") { this.estado.saque = null; this.estado.pausa = null; this.lanzarPenal(autor, saque.falta!); return; }
    if (saque.tipo === "libre" && planes && ejecutadas) this.ejecutarLibre(autor, saque.punto, planes, ejecutadas);
    else {
      const receptor = this.estado.jugadores.filter(j => j.lado === saque.lado && j.id !== autor.id && j.puesto !== "POR").sort((a, b) => distancia(a.posicion, saque.punto) - distancia(b.posicion, saque.punto) || a.id.localeCompare(b.id))[0]!;
      this.sacarBalon(autor, "pase", receptor.posicion, receptor.id);
    }
    this.estado.balon.vuelo!.reinicio = saque.tipo;
    // Brief 070 § 2.A: en el tiro libre NO se limpia `adelantados` (el fuera de juego se aplica como en el juego).
    if (["banda", "esquina", "meta"].includes(saque.tipo)) this.estado.balon.vuelo!.adelantados = [];
    this.eventos.at(-1)!.reinicio = saque.tipo;
    this.estado.saque = null; this.estado.pausa = null;
  }
  /** Brief 070 § 2.A (v11) · ejecución del tiro libre. 1) Una orden explícita vigente del ejecutor, con las validaciones
   * del juego: `tirar` a ≤ LARGO_ARENA.remate.maxM; `pasar` a un compañero (no él mismo) raso a ≤ paseMaxM y no adelantado
   * (068), o largo como en `accionBalon` (063 § 8.2). 2) Si no, tiro directo con probabilidad LIBRE_ARENA.probDirecto si
   * el punto lo admite (`opcionDirecto`). 3) Si no, pase al compañero de campo más cercano, como en los otros saques. */
  private ejecutarLibre(autor: JugadorArena, punto: Punto, planes: Record<Lado, OrdenesEquipo>, ejecutadas: Set<string>): void {
    const arco = transformar({ x: ARENA.largoM, y: ARENA.anchoM / 2 }, autor.lado);
    const orden = planes[autor.lado].ordenes.find(o => o.jugador === autor.id);
    if (orden && !ejecutadas.has(autor.id)) {
      if (orden.accion === "tirar" && distancia(autor.posicion, arco) <= LA.remate.maxM) {
        this.sacarBalon(autor, "tiro", arco, null, { motivo: "libre" }); ejecutadas.add(autor.id); return;
      }
      const r = orden.accion === "pasar" ? this.estado.jugadores.find(p => p.id === orden.receptor && p.lado === autor.lado && p.id !== autor.id) : undefined;
      if (r) {
        const d = distancia(autor.posicion, r.posicion), alcance = autor.puesto !== "POR" ? alcanceLargo(this.atributos(autor.id)) : null;
        if (d <= ARENA.paseMaxM && !this.fueraPasador(autor.lado)?.has(r.id)) { this.sacarBalon(autor, "pase", this.destinoPase(autor, r), r.id); ejecutadas.add(autor.id); return; }
        if (alcance !== null && r.puesto !== "POR" && d > ARENA.paseMaxM && d <= alcance) { this.sacarBalon(autor, "pase", this.destinoPase(autor, r), r.id, { motivo: "largo", aereo: true }); ejecutadas.add(autor.id); return; }
      }
    }
    if (opcionDirecto(punto, autor.lado) && prngDerivado(this.config.partido.seed, `libre:${this.estado.tick}:${autor.id}`).chance(LIBRE_ARENA.probDirecto)) {
      this.sacarBalon(autor, "tiro", arco, null, { motivo: "libre" }); return;
    }
    const receptor = this.estado.jugadores.filter(j => j.lado === autor.lado && j.id !== autor.id && j.puesto !== "POR").sort((a, b) => distancia(a.posicion, punto) - distancia(b.posicion, punto) || a.id.localeCompare(b.id))[0]!;
    this.sacarBalon(autor, "pase", receptor.posicion, receptor.id);
  }
  /** Brief 070 § 2.B (v11) · el ejecutor remata el penal desde el punto. Desenlace con `desenlacePenal` y la probabilidad
   * de `probabilidadPenal` (potencia del ejecutor frente al nivel efectivo del portero); el vuelo dura lo de un remate de
   * esa distancia y nadie lo toca (`moverBalon`). El `tiro` lleva `motivo: "penal"` y `fuentes` a la falta. */
  private lanzarPenal(autor: JugadorArena, falta: string): void {
    const portero = this.estado.jugadores.find(j => j.lado !== autor.lado && j.puesto === "POR");
    const p = probabilidadPenal(this.atributos(autor.id)?.potencia, portero ? this.nivelEfectivo(portero) : undefined);
    const origen = { ...this.estado.balon.posicion };
    const { desenlace, destino } = desenlacePenal({ seed: this.config.partido.seed, tick: this.estado.tick, ejecutor: autor.id, lado: autor.lado, p, portero: portero ? { ...portero.posicion } : null });
    const tiro = this.evento("tiro", autor, origen, destino, null, { motivo: "penal", reinicio: "penal", fuentes: [falta] });
    this.estado.balon = { ultimoToque: { jugador: autor.id, lado: autor.lado }, posicion: origen, poseedor: null,
      vuelo: { tipo: "tiro", autor: autor.id, lado: autor.lado, receptor: null, origen, destino, inicioTick: this.estado.tick, adelantados: [], reinicio: "penal", potencia: potenciaRemate(distancia(origen, destino)), penal: { desenlace, tiro: tiro.id } } };
    this.ultimaAccion = this.estado.tick;
  }
  private resolverSalida(desde: Punto, hasta: Punto): boolean {
    const cruce = cruceDeBanda(desde, hasta);
    if (!cruce) return false;
    const vuelo = this.estado.balon.vuelo;
    const ultimo = this.estado.balon.ultimoToque ?? (vuelo ? { jugador: vuelo.autor, lado: vuelo.lado } : undefined);
    if (!ultimo) return false;
    this.estado.balon.posicion = cruce.punto;
    if (cruce.borde === "lateral") { this.prepararSaque("banda", rival(ultimo.lado), cruce.punto, ultimo.jugador); return true; }
    const defiende = defensorDePorteria(cruce.punto.x), ataca = rival(defiende);
    // Brief 051 (v5): un remate por encima del travesaño nunca es gol; sale por la línea de fondo.
    const alto = this.v5 && vuelo?.tipo === "tiro" && vuelo.alto === true;
    if (!alto && Math.abs(cruce.punto.y - ARENA.anchoM / 2) <= ARENA.arcoM / 2 && vuelo?.reinicio !== "banda" && !(vuelo?.reinicio && ultimo.lado === defiende)) {
      const autor = this.estado.jugadores.find(j => j.id === (vuelo?.autor ?? ultimo.jugador))!;
      // Brief 070 § 2.B (v11): el gol de penal cita su `tiro`, que a su vez cita la falta.
      this.evento("gol", autor, vuelo?.origen ?? desde, cruce.punto, null, { lado: ataca, ...(autor.lado !== ataca ? { autogol: true } : {}), ...(vuelo?.penal ? { fuentes: [vuelo.penal.tiro] } : {}) });
      this.estado.marcador[ataca]++;
      this.prepararSaque("centro", defiende, { x: ARENA.largoM / 2, y: ARENA.anchoM / 2 }, ultimo.jugador);
    } else {
      if (vuelo?.tipo === "tiro") { const autor = this.estado.jugadores.find(j => j.id === vuelo.autor)!; this.evento("tiro_fuera", autor, vuelo.origen, cruce.punto, null, alto ? { motivo: "alto" } : {}); }
      const esquina = ultimo.lado === defiende;
      this.prepararSaque(esquina ? "esquina" : "meta", esquina ? ataca : defiende, esquina ? { x: cruce.punto.x === 0 ? ARENA.esquinaM : ARENA.largoM - ARENA.esquinaM, y: cruce.punto.y < ARENA.anchoM / 2 ? ARENA.esquinaM : ARENA.anchoM - ARENA.esquinaM } : transformar({ x: ARENA.saqueMetaM, y: ARENA.anchoM / 2 }, defiende), ultimo.jugador);
    }
    return true;
  }
  private reiniciar(lado: Lado): void {
    // Reanudación experimental explícita desde el portero donde se encuentra.
    // No se representa como saque de centro o de meta reglamentario.
    if (this.v6) this.estado.persecucion = null;
    this.realizarCambios();
    const portero = this.estado.jugadores.find(j => j.lado === lado && j.puesto === "POR")!;
    const desde = this.estado.balon.posicion;
    this.evento("reinicio", portero, desde, portero.posicion);
    this.estado.balon = { posicion: { ...portero.posicion }, poseedor: portero.id, vuelo: null };
    if (this.v4 && enAreaPropia(portero.posicion, portero.lado)) this.darManos(portero, this.estado.tick, this.estado.tick + ticksManos());
    this.ultimaAccion = this.estado.tick;
    if (this.estado.entrenadores) this.estado.pausa = { hastaTick: this.estado.tick + Math.round(T.pausaS / ARENA.pasoS), lado, punto: { ...portero.posicion }, motivo: "reinicio" };
  }
  private resolverFalta(defensor: JugadorArena, portador: JugadorArena): boolean {
    if (!this.estado.entrenadores) return false;
    const p = defensor.personalidad!, rng = prngDerivado(this.config.partido.seed, `falta:arena-v3:${this.estado.tick}:${defensor.id}`);
    // Brief 068 § 2.C (v10): la probabilidad por FALTAS_ARENA_V10.factorProbabilidad, con tope 1.
    const probabilidad = probabilidadFalta(p, this.estado.arbitro!.criterioContacto!, reglasDesde(this.config, FALTAS_ARENA_V10.desde));
    if (!rng.chance(probabilidad)) return false;
    if (this.v6) this.estado.persecucion = null;
    const severidad = rng.next(), gravedad = severidad >= R.excesivaDesde ? "fuerza_excesiva" : severidad >= R.temerariaDesde ? "temeraria" : "imprudente";
    const falta = this.evento("falta", defensor, defensor.posicion, portador.posicion, portador.id, { gravedad });
    const arbitro = this.estado.arbitro!;
    arbitro.ultimaDecision = { tick: this.estado.tick, evento: falta.id, tipo: "falta" };
    let expulsar = gravedad === "fuerza_excesiva";
    if (gravedad === "temeraria") {
      defensor.amarillas = (defensor.amarillas ?? 0) + 1;
      const amarilla = this.evento("amarilla", defensor, defensor.posicion, defensor.posicion, null, { fuentes: [falta.id], gravedad });
      arbitro.ultimaDecision = { tick: this.estado.tick, evento: amarilla.id, tipo: "amarilla" };
      expulsar = defensor.amarillas >= 2;
    }
    if (expulsar) {
      const roja = this.evento("roja", defensor, defensor.posicion, defensor.posicion, null, { fuentes: [falta.id], gravedad, dobleAmarilla: gravedad === "temeraria" });
      arbitro.ultimaDecision = { tick: this.estado.tick, evento: roja.id, tipo: "roja" };
      defensor.capitan = false;
      this.estado.jugadores = this.estado.jugadores.filter(j => j.id !== defensor.id); this.estado.expulsados!.push(defensor);
      this.formar(defensor.lado, this.estado.entrenadores[defensor.lado].formacion); this.asegurarCapitanes();
      if (this.estado.jugadores.filter(j => j.lado === defensor.lado).length < R.minJugadores) {
        this.estado.finalizado = { tick: this.estado.tick, motivo: "menos_de_siete" };
        this.evento("final_anticipado", defensor, defensor.posicion, defensor.posicion); return true;
      }
    }
    this.realizarCambios();
    // Brief 070 (v11): tiro libre desde el punto de la falta (la posición del portador en el contacto, `falta.hasta`) o,
    // dentro del área del infractor, penal. La falta sobre el portero en su área sigue con el balón en las manos (abajo).
    const victima = this.estado.jugadores.find(j => j.id === portador.id);
    if (this.libre11 && !(victima?.puesto === "POR" && enAreaPropia(victima.posicion, victima.lado))) {
      const punto = enCancha(falta.hasta), penal = this.penal11 && enAreaPropia(punto, defensor.lado);
      const companeros = this.estado.jugadores.filter(j => j.lado === portador.lado);
      const ejecutor = victima ?? (penal ? ejecutorPenal(companeros, id => this.atributos(id)) : undefined)
        ?? companeros.filter(j => j.puesto !== "POR").sort((a, b) => distancia(a.posicion, punto) - distancia(b.posicion, punto) || a.id.localeCompare(b.id))[0]!;
      this.prepararSaque(penal ? "penal" : "libre", portador.lado, penal ? puntoPenal(portador.lado) : punto, undefined, { ejecutor, id: falta.id });
      return true;
    }
    const receptor = this.estado.jugadores.find(j => j.id === portador.id) ??this.estado.jugadores.filter(j => j.lado === portador.lado).sort((a, b) => distancia(a.posicion, portador.posicion) - distancia(b.posicion, portador.posicion))[0]!;
    this.estado.balon = { posicion: { ...receptor.posicion }, poseedor: receptor.id, vuelo: null };
    const finPausa = this.estado.tick + Math.round(T.pausaS / ARENA.pasoS);
    // Brief 046 v1.1: la falta sobre el portero en su área se reanuda con el balón en las manos y
    // un plazo nuevo (mínimo para soltar y máximo) que empieza al terminar la pausa.
    if (this.v4 && receptor.puesto === "POR" && enAreaPropia(receptor.posicion, receptor.lado)) this.darManos(receptor, finPausa, finPausa + ticksManos());
    this.evento("reinicio", receptor, portador.posicion, receptor.posicion, null, { motivo: "falta", fuentes: [falta.id] });
    this.estado.pausa = { hastaTick: finPausa, lado: receptor.lado, punto: { ...receptor.posicion }, motivo: "falta" };
    this.ultimaAccion = this.estado.tick; this.ultimaDisputa = this.estado.tick;
    return true;
  }
  /** `perdedorDuelo` (brief 063): el portador que pierde el balón en un duelo. */
  private recibir(j: JugadorArena, perdedorDuelo?: JugadorArena): void {
    const vuelo = this.estado.balon.vuelo;
    const desde = vuelo?.origen ?? this.estado.balon.posicion;
    if (vuelo?.adelantados.includes(j.id) && j.lado === vuelo.lado) {
      this.evento("fuera_juego", j, desde, j.posicion);
      this.reiniciar(rival(j.lado)); return;
    }
    if (this.v6) this.actualizarPersecucion(j, perdedorDuelo);
    // Un rechace es un balón suelto: quien lo recoja, de cualquier lado, lo recupera sin pasador.
    const suelto = !vuelo || vuelo.tipo === "rechace";
    const tipo = suelto ? "recuperacion" : j.lado === vuelo.lado ? "recepcion" : vuelo.tipo === "tiro" && j.puesto === "POR" ? "atajada" : "intercepcion";
    this.evento(tipo, j, desde, j.posicion, suelto ? null : vuelo.autor);
    this.estado.balon = { posicion: { ...j.posicion }, poseedor: j.id, vuelo: null, ...(this.conReinicios ? { ultimoToque: { jugador: j.id, lado: j.lado } } : {}) };
    // Brief 046 (v4): el portero que recibe dentro de su área, sea cual sea el tipo, lo tiene en las manos.
    if (this.v4 && j.puesto === "POR" && enAreaPropia(j.posicion, j.lado)) this.darManos(j, this.estado.tick, this.estado.tick + ticksManos());
    this.ultimaAccion = this.estado.tick;
    this.ultimaDisputa = this.estado.tick;
  }
  /** Brief 063 § 6.3 (v6), antes de reasignar el balón a `j`: el lado que perseguía y recupera deja de
   * perseguir; un portero que lo recibe en su área cancela cualquier persecución; si no, el perdedor de
   * campo (portador del duelo, autor del pase o remate interceptado, o último toque rival) persigue. */
  private actualizarPersecucion(j: JugadorArena, perdedorDuelo?: JugadorArena): void {
    const { vuelo, ultimoToque } = this.estado.balon;
    if (this.estado.persecucion?.lado === j.lado) this.estado.persecucion = null;
    if (j.puesto === "POR" && enAreaPropia(j.posicion, j.lado)) { this.estado.persecucion = null; return; }
    const id = perdedorDuelo?.id ?? (vuelo && (vuelo.tipo === "pase" || vuelo.tipo === "tiro") && vuelo.lado !== j.lado ? vuelo.autor : ultimoToque && ultimoToque.lado !== j.lado ? ultimoToque.jugador : undefined);
    const perdedor = id === undefined ? undefined : this.estado.jugadores.find(p => p.id === id);
    if (!perdedor || perdedor.lado === j.lado || perdedor.puesto === "POR") return;
    // Bloque D (v8): el factor de la identidad del club del perdedor.
    const segundos = duracionPersecucionS(perdedor, this.estado.entrenadores?.[perdedor.lado].plan.bloque, this.estiloJuego(perdedor.lado));
    this.estado.persecucion = { jugador: perdedor.id, lado: perdedor.lado, desdeTick: this.estado.tick, hastaTick: hastaTickPersecucion(this.estado.tick, segundos) };
  }
  /** Nivel con el que actúa un jugador: el efectivo por puesto con entrenadores, si no el nominal. */
  private nivelEfectivo(j: JugadorArena): number {
    return this.estado.entrenadores ? capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto)) : j.nivel;
  }
  private moverBalon(): void {
    const balon = this.estado.balon;
    const portador = this.estado.jugadores.find(j => j.id === balon.poseedor);
    if (portador) {
      if (this.conReinicios) { balon.ultimoToque = { jugador: portador.id, lado: portador.lado }; if (this.salidaConduccion && this.resolverSalida(balon.posicion, this.salidaConduccion)) return; }
      balon.posicion = { ...portador.posicion };
      // Brief 046 (v4): con el balón en las manos no hay duelo ni falta (recuperacionCadaS no aplica).
      if (this.v4 && balon.manos) return;
      if ((this.estado.tick - this.ultimaDisputa) * ARENA.pasoS < ARENA.recuperacionCadaS) return;
      const rivales = this.estado.jugadores.filter(j => j.lado !== portador.lado && distancia(j.posicion, portador.posicion) <= ARENA.controlM).sort((a, b) => distancia(a.posicion, portador.posicion) - distancia(b.posicion, portador.posicion) || a.id.localeCompare(b.id));
      const defensor = rivales[0];
      if (defensor) {
        this.ultimaDisputa = this.estado.tick;
        if (this.resolverFalta(defensor, portador)) return;
        // Brief 063 § 7.1 (v7): entrada del defensor y aguante del portador, antes del `limitar` existente.
        const bruto = ARENA.dueloBase + (defensor.nivel - portador.nivel) * ARENA.dueloNivel + (this.config.partido[defensor.lado].defensa - this.config.partido[portador.lado].ataque) * ARENA.dueloFuerza;
        const aD = this.atributos(defensor.id), aP = this.atributos(portador.id);
        const p = limitar(aD && aP ? bruto + ajusteDuelo(aD.entrada, aP.aguante) : bruto, ARENA.dueloMin, ARENA.dueloMax);
        if (prngDerivado(this.config.partido.seed, `arena:duelo:${this.estado.tick}:${defensor.id}`).chance(p)) this.recibir(defensor, portador);
      }
      return;
    }
    const vuelo = balon.vuelo;
    const desde = { ...balon.posicion };
    // Brief 051 (v5): potencia del remate en vuelo; una sola velocidad efectiva (con el entorno) mueve
    // el balón y fija el tiempo de reacción del portero (v1.1 #3).
    const remate5 = this.v5 && vuelo?.tipo === "tiro" && vuelo.potencia !== undefined ? { potencia: vuelo.potencia, alto: vuelo.alto === true } : null;
    let velocidadEfectiva = 0;
    if (vuelo) {
      const d = distancia(desde, vuelo.destino), base = (vuelo.tipo !== "pase" ? (remate5 ? velocidadRemate(remate5.potencia) : ARENA.velocidadTiroMps) : ARENA.velocidadBalonMps) * (this.estado.entrenadores ? efectosEntorno(this.config, this.estado, vuelo.lado).velocidadBalon : 1);
      // Brief 063 § 7.1 (v7): la potencia del autor escala la velocidad del remate (y el tiempo de reacción del portero).
      const autor = vuelo.tipo === "tiro" ? this.atributos(vuelo.autor) : undefined;
      const velocidad = autor ? base * factorPotencia(autor.potencia) : base;
      velocidadEfectiva = velocidad;
      const factor = d ? Math.min(1, velocidad * ARENA.pasoS / d) : 1;
      balon.posicion = factor === 1 ? { ...vuelo.destino } : { x: desde.x + (vuelo.destino.x - desde.x) * factor, y: desde.y + (vuelo.destino.y - desde.y) * factor };
    }
    const cruce = this.conReinicios ? cruceDeBanda(desde, balon.posicion) : null;
    // Brief 070 § 2.B (v11): el remate del penal ya tiene desenlace; nadie lo toca. Gol y fuera cruzan la línea de fondo
    // (`resolverSalida`: gol, o `tiro_fuera` y saque de meta); la atajada termina en las manos del portero al llegar.
    if (vuelo?.penal) {
      if (cruce && this.resolverSalida(desde, balon.posicion)) return;
      if (distancia(balon.posicion, vuelo.destino) === 0) {
        const portero = this.estado.jugadores.find(j => j.lado !== vuelo.lado && j.puesto === "POR");
        if (portero) this.recibir(portero); else delete vuelo.penal;
      }
      return;
    }
    const extremo = cruce?.punto ?? balon.posicion;
    const contactos = this.estado.jugadores.map(j => {
      const punto = proyeccion(j.posicion, desde, extremo);
      const propia = transformar(j.posicion, j.lado);
      const area = propia.x <= ARENA.areaLargoM && Math.abs(propia.y - ARENA.anchoM / 2) <= ARENA.areaAnchoM / 2;
      // Brief 046 (v4): ante un remate el radio del portero depende de la distancia de origen.
      // Brief 051 (v5): alcance según el nivel del portero y el tiempo de reacción con la velocidad efectiva.
      // Brief 065 (v9): alcance máximo de REMATE_ARENA_V9.
      const radio = j.puesto === "POR" && area ? (remate5 ? alcancePortero(this.nivelEfectivo(j), distancia(vuelo!.origen, j.posicion) / velocidadEfectiva, this.remate9.alcanceMaxM) : this.v4 && vuelo?.tipo === "tiro" ? radioAtajada(distancia(vuelo.origen, j.posicion)) : ARENA.controlPorteroM) : ARENA.controlM;
      // Brief 051 (v5): un remate por encima del travesaño no admite contactos de nadie.
      if (remate5?.alto) return { j, ...punto, contacto: false, radio };
      const ignorar = vuelo && ((j.id === vuelo.autor && (vuelo.reinicio || (this.estado.tick - vuelo.inicioTick) * ARENA.pasoS <= ARENA.ignorarAutorS)) || this.conReinicios && j.id === balon.ultimoToque?.jugador && (this.estado.tick - vuelo.inicioTick) * ARENA.pasoS <= ARENA.ignorarAutorS);
      // Fase aérea del centro (v1.1) y del saque largo del portero (v1.2): solo cuentan los contactos cuyo punto proyectado sobre la
      // trayectoria queda a ≤ caidaM del destino (perturbado) del vuelo.
      const aereo = this.v4 && (vuelo?.centro || vuelo?.aereo) && distancia({ x: desde.x + (extremo.x - desde.x) * punto.t, y: desde.y + (extremo.y - desde.y) * punto.t }, vuelo.destino) > A.caidaM;
      return { j, ...punto, contacto: !ignorar && !aereo && punto.distancia <= radio, radio };
    }).filter(c => c.contacto).sort((a, b) => a.t - b.t || a.distancia - b.distancia || a.j.id.localeCompare(b.j.id));
    if (contactos[0]) {
      const j = contactos[0].j;
      // Brief 051 (v5): desviar o atrapar según nivel, potencia y estirada; mismo PRNG `desvio`.
      const desvio = remate5 ? probabilidadDesvio(this.nivelEfectivo(j), remate5.potencia, estiradaPortero(contactos[0].distancia, contactos[0].radio)) : ARENA.desvioProbabilidad;
      if (this.conReinicios && vuelo?.tipo === "tiro" && j.lado !== vuelo.lado && j.puesto === "POR" && prngDerivado(this.config.partido.seed, `desvio:${this.estado.tick}:${j.id}`).chance(desvio)) {
        const punto = { ...j.posicion }, x = j.lado === "local" ? -ARENA.desvioFondoM : ARENA.largoM + ARENA.desvioFondoM;
        this.evento("atajada", j, vuelo.origen, punto, vuelo.autor, { motivo: "desvio" });
        const destino = { x, y: ARENA.anchoM / 2 + (punto.y < ARENA.anchoM / 2 ? -ARENA.desvioLateralM : ARENA.desvioLateralM) };
        // reinicios-v1/v2 conservaban el vuelo como "tiro" del rematador (y contaban un
        // segundo tiro_fuera si salía); desde v3 el desvío es un rechace del portero: un
        // balón suelto que conserva el lado del remate (movimiento y anclas como en v2).
        const rechace = reglasDesde(this.config, "reinicios-v3") ? { tipo: "rechace" as const, autor: j.id, receptor: null } : {};
        // Brief 051 (v5): el rechace no conserva la potencia del remate (solo existe en vuelos `tiro`).
        const previo = { ...vuelo }; if (remate5) delete previo.potencia;
        this.estado.balon = { posicion: punto, poseedor: null, ultimoToque: { jugador: j.id, lado: j.lado }, vuelo: { ...previo, ...rechace, origen: punto, destino, inicioTick: this.estado.tick, adelantados: [] } };
        return;
      }
      this.recibir(j); return;
    }
    if (cruce && this.resolverSalida(desde, balon.posicion)) return;
    if (vuelo && distancia(balon.posicion, vuelo.destino) === 0) {
      if (vuelo.tipo === "tiro") {
        const autor = this.estado.jugadores.find(j => j.id === vuelo.autor)!;
        const gol = Math.abs(balon.posicion.y - ARENA.anchoM / 2) <= ARENA.arcoM / 2;
        this.evento(gol ? "gol" : "tiro_fuera", autor, vuelo.origen, balon.posicion);
        if (gol) this.estado.marcador[autor.lado]++;
        this.reiniciar(rival(autor.lado));
      }
      // Un pase que se detiene sigue pendiente de contacto: se conserva quién
      // golpeó y la referencia de fuera de juego hasta la siguiente intervención.
    }
  }
  /** Los eventos entran en orden de tick: basta mirar la cola del registro. */
  private transicionEnTick(): boolean {
    for (let i = this.eventos.length - 1; i >= 0 && this.eventos[i]!.tick >= this.estado.tick; i--) {
      const e = this.eventos[i]!;
      if (e.tick === this.estado.tick && (["plan_equipo", "cambio", "falta", "amarilla", "roja"].includes(e.tipo) || this.conReinicios && e.tipo === "reinicio")) return true;
    }
    return false;
  }
  avanzar(planes: Record<Lado, OrdenesEquipo>, hastaTick: number): void {
    for (const _ of this.avanzarPorFotogramas(planes, hastaTick)) { /* Consumo sin esperas para ejecución y reproducción. */ }
  }
  /** Conserva el contexto de la ronda entre publicaciones; dividir avanzar() lo reiniciaría. */
  *avanzarPorFotogramas(planes: Record<Lado, OrdenesEquipo>, hastaTick: number): Generator<void> {
    if (!Number.isInteger(hastaTick) || hastaTick <= this.estado.tick || hastaTick > this.config.duracionS / ARENA.pasoS) throw new Error("Reloj de arena inválido");
    const ejecutadas = new Set<string>();
    this.aplicarGestion(planes);
    const posesionInicial = this.estado.jugadores.find(j => j.id === this.estado.balon.poseedor)?.lado ?? this.estado.balon.vuelo?.lado;
    while (this.estado.tick < hastaTick) {
      if (this.estado.finalizado) break;
      const activos = this.planesActivos(planes);
      const pausado = this.estado.pausa && this.estado.tick < this.estado.pausa.hastaTick;
      if (!pausado) {
        if (this.estado.entrenadores) this.estado.pausa = null;
        if (this.estado.saque) this.ejecutarSaque(activos, ejecutadas);
        else this.accionBalon(activos, ejecutadas);
        this.moverJugadores(activos, posesionInicial);
      } else this.frenarJugadores();
      this.estado.tick++;
      if (!pausado) this.moverBalon();
      if (this.estado.arbitro) moverArbitro(this.estado.arbitro, this.estado.balon.posicion);
      const transicion = this.estado.entrenadores && this.transicionEnTick();
      if (this.estado.tick % Math.round(ARENA.fotogramaS / ARENA.pasoS) === 0 || this.estado.tick === hastaTick || this.estado.finalizado || transicion) {
        this.fotogramas.push(structuredClone(this.estado));
        yield;
      }
    }
  }
}
