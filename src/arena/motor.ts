// Mundo único, 2D, a paso fijo. Los planes eligen intenciones; este motor es la
// autoridad sobre contactos, posesión y resultados. No importa ningún LLM.
import { ARENA } from "../sim/limites";
import { validarConfig } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import { prngDerivado } from "../sim/prng";
import type { Lado, SimConfig } from "../sim/tipos";
import { anclas, puestos, transformar } from "./catalogo";
import { opcionPase } from "./controladores";
import { distancia, enCancha, limitar, proyeccion } from "./geometria";
import { formaciones, lados, rival, type ConfigArena, type EstadoArena, type EventoArena, type FormacionArena, type JugadorArena, type ObservacionArena, type OrdenesEquipo, type Punto } from "./tipos";

export function crearConfigArena(opciones: { seed?: number; partido?: SimConfig; duracionS?: number; intervaloS?: number; local?: FormacionArena; visita?: FormacionArena } = {}): ConfigArena {
  const config: ConfigArena = {
    partido: opciones.partido ?? configDeSemilla(opciones.seed ?? 42),
    duracionS: opciones.duracionS ?? ARENA.duracionS,
    intervaloS: opciones.intervaloS ?? ARENA.intervaloS,
    formaciones: { local: opciones.local ?? "4-3-3", visita: opciones.visita ?? "4-2-3-1" },
  };
  validarConfigArena(config);
  return config;
}
export function validarConfigArena(config: ConfigArena): void {
  validarConfig(config.partido);
  if ([config.partido.variantes?.lesiones, config.partido.variantes?.autogoles, config.partido.variantes?.insolitos, config.partido.variantes?.sanciones].some(Boolean)) throw new Error("La arena todavía no resuelve lesiones, autogoles, insólitos o sanciones de club");
  if (!Number.isInteger(config.duracionS) || config.duracionS < 1 || config.duracionS > ARENA.duracionMaxS) throw new Error("Duración de arena fuera de límites");
  if (!Number.isInteger(config.intervaloS) || config.intervaloS < ARENA.intervaloMinS || config.intervaloS > ARENA.intervaloMaxS) throw new Error("Intervalo de arena fuera de límites");
  if (Math.ceil(config.duracionS / config.intervaloS) > ARENA.maxRondas) throw new Error("Demasiadas decisiones");
  for (const lado of lados) if (!formaciones.includes(config.formaciones[lado])) throw new Error("Formación desconocida");
}
export function crearEstadoArena(config: ConfigArena): EstadoArena {
  validarConfigArena(config);
  const jugadores: JugadorArena[] = lados.flatMap(lado => {
    const slots = puestos(config.formaciones[lado]);
    const referencias = anclas(config.formaciones[lado], lado, "base");
    return config.partido[lado].jugadores.slice(0, 11).map((j, n) => ({
      id: `${lado}-${n}`, lado, nombre: j.nombre, dorsal: j.dorsal, puesto: slots[n]!,
      nivel: config.partido.variantes?.niveles && j.nivel !== undefined ? j.nivel : (config.partido[lado].ataque + config.partido[lado].defensa) / 2,
      posicion: { ...referencias[slots[n]!]! }, velocidad: { x: 0, y: 0 }, energia: 1,
    }));
  });
  // Escenario de juego abierto. No se atribuye un saque inicial reglamentario.
  const portador = jugadores.find(j => j.id === "local-5")!;
  return { tick: 0, jugadores, balon: { posicion: { ...portador.posicion }, poseedor: portador.id, vuelo: null }, marcador: { local: 0, visita: 0 } };
}

export function datosEquipos(config: ConfigArena): ObservacionArena["equipos"] {
  return Object.fromEntries(lados.map(lado => [lado, {
    nombre: config.partido[lado].nombre, ataque: config.partido[lado].ataque,
    defensa: config.partido[lado].defensa, estilo: config.partido[lado].estilo,
    formacion: config.formaciones[lado],
  }])) as ObservacionArena["equipos"];
}

/** Aproximación puntual en el instante del golpe; la sanción solo se produce
 * cuando uno de estos jugadores interviene recibiendo el balón. */
export function adelantados(estado: EstadoArena, lado: Lado): string[] {
  const defensores = estado.jugadores.filter(j => j.lado !== lado).map(j => transformar(j.posicion, lado).x).sort((a, b) => b - a);
  const linea = Math.max(ARENA.largoM / 2, transformar(estado.balon.posicion, lado).x, defensores[1] ?? ARENA.largoM);
  return estado.jugadores.filter(j => j.lado === lado && transformar(j.posicion, lado).x > linea + ARENA.toleranciaM).map(j => j.id);
}

export class MotorArena {
  readonly estado: EstadoArena;
  readonly eventos: EventoArena[] = [];
  readonly fotogramas: EstadoArena[] = [];
  private ultimaAccion = -Infinity;
  private ultimaDisputa = -Infinity;
  constructor(readonly config: ConfigArena, inicial: EstadoArena = crearEstadoArena(config)) {
    validarConfigArena(config);
    this.estado = structuredClone(inicial);
    this.fotogramas.push(structuredClone(this.estado));
  }
  private evento(tipo: EventoArena["tipo"], j: JugadorArena, desde: Punto, hasta: Punto, receptor: string | null = null): void {
    // El golpe se resuelve en el paso que va a avanzar, nunca se añade al estado
    // ya publicado de la frontera anterior entre dos intervalos.
    const tick = this.estado.tick + (tipo === "pase" || tipo === "tiro" ? 1 : 0);
    this.eventos.push({ id: `a${this.eventos.length + 1}`, tick, tipo, lado: j.lado, jugador: j.id, receptor, desde: { ...desde }, hasta: { ...hasta }, distanciaM: distancia(desde, hasta) });
  }
  private observar(lado: Lado): ObservacionArena {
    return { id: "politica-local", lado, tiempoS: this.estado.tick * ARENA.pasoS, horizonteS: this.config.intervaloS, estado: this.estado, equipos: datosEquipos(this.config), condiciones: this.config.partido.condiciones ?? null, recientes: [] };
  }
  private sacarBalon(j: JugadorArena, tipo: "pase" | "tiro", destino: Punto, receptor: string | null): void {
    const desde = { ...j.posicion };
    const rng = prngDerivado(this.config.partido.seed, `arena:golpe:${this.estado.tick}:${j.id}`);
    const lluvia = this.config.partido.condiciones?.clima === "lluvia" ? ARENA.errorLluviaM : 0;
    const error = (1 - j.nivel / 100) * (tipo === "tiro" ? ARENA.errorTiroM : ARENA.errorPaseM) + lluvia;
    const objetivo = enCancha({ x: destino.x, y: destino.y + (rng.next() * 2 - 1) * error });
    const fuera = adelantados(this.estado, j.lado);
    this.estado.balon = { posicion: desde, poseedor: null, vuelo: { tipo, autor: j.id, lado: j.lado, receptor, origen: desde, destino: objetivo, inicioTick: this.estado.tick, adelantados: fuera } };
    this.evento(tipo, j, desde, objetivo, receptor);
    this.ultimaAccion = this.estado.tick;
  }
  private accionBalon(planes: Record<Lado, OrdenesEquipo>, ejecutadas: Set<string>): void {
    const j = this.estado.jugadores.find(p => p.id === this.estado.balon.poseedor);
    if (!j || (this.estado.tick - this.ultimaAccion) * ARENA.pasoS < ARENA.accionCadaS) return;
    const orden = planes[j.lado].ordenes.find(o => o.jugador === j.id)!;
    const usarOrden = !ejecutadas.has(j.id);
    const arco = transformar({ x: ARENA.largoM, y: ARENA.anchoM / 2 }, j.lado);
    if ((usarOrden && orden.accion === "tirar") || distancia(j.posicion, arco) <= ARENA.radioTiroM) {
      this.sacarBalon(j, "tiro", arco, null); ejecutadas.add(j.id); return;
    }
    if (usarOrden && orden.accion === "conducir") { ejecutadas.add(j.id); this.ultimaAccion = this.estado.tick; return; }
    const receptor = usarOrden && orden.accion === "pasar" ? this.estado.jugadores.find(p => p.id === orden.receptor) : opcionPase(j, this.observar(j.lado));
    if (receptor && distancia(j.posicion, receptor.posicion) <= ARENA.paseMaxM) {
      // Extrapolación de velocidad actual, no consulta a una posición futura.
      const viaje = distancia(j.posicion, receptor.posicion) / ARENA.velocidadBalonMps;
      const destino = enCancha({ x: receptor.posicion.x + receptor.velocidad.x * viaje, y: receptor.posicion.y + receptor.velocidad.y * viaje });
      this.sacarBalon(j, "pase", destino, receptor.id); ejecutadas.add(j.id);
    }
  }
  private moverJugadores(planes: Record<Lado, OrdenesEquipo>, posesionInicial: Lado | undefined): void {
    const antes = structuredClone(this.estado.jugadores);
    const balon = this.estado.balon;
    const poseedor = antes.find(j => j.id === balon.poseedor);
    const ladoBalon = poseedor?.lado ?? balon.vuelo?.lado;
    const perseguidores = Object.fromEntries(lados.map(lado => [lado, antes.filter(j => j.lado === lado && j.puesto !== "POR").sort((a, b) => distancia(a.posicion, balon.posicion) - distancia(b.posicion, balon.posicion) || a.id.localeCompare(b.id))[0]?.id]));
    for (const j of this.estado.jugadores) {
      const orden = planes[j.lado].ordenes.find(o => o.jugador === j.id)!;
      let destino = { ...orden.destino };
      if (ladoBalon !== posesionInicial && ladoBalon !== undefined) destino = { ...anclas(this.config.formaciones[j.lado], j.lado, ladoBalon === j.lado ? "ataque" : "defensa")[j.puesto]! };
      if (j.puesto !== "POR") {
        const nominal = transformar(destino, j.lado);
        nominal.y = ARENA.anchoM / 2 + (nominal.y - ARENA.anchoM / 2) * ARENA.amplitud[planes[j.lado].amplitud];
        if (ladoBalon !== j.lado) nominal.x += ARENA.alturaBloqueM[planes[j.lado].bloque];
        destino = enCancha(transformar(nominal, j.lado));
      }
      if (j.id === balon.vuelo?.receptor) destino = { ...balon.vuelo.destino };
      if ((ladoBalon !== j.lado || balon.poseedor === null && balon.vuelo === null) && perseguidores[j.lado] === j.id) destino = { ...balon.posicion };
      if (orden.accion === "presionar" && ladoBalon !== j.lado && j.puesto !== "POR") destino = { ...balon.posicion };
      if (j.id === balon.poseedor) {
        // Los pases/tiros ya ejecutados no arrastran al portador a su propio
        // receptor: al conducir, el control local busca progresar.
        if (orden.accion !== "conducir" || distancia(j.posicion, destino) < ARENA.toleranciaM) destino = enCancha({ x: j.posicion.x + (j.lado === "local" ? ARENA.avanceConduccionM : -ARENA.avanceConduccionM), y: j.posicion.y });
      }
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
      const max = ARENA.velocidadMps * (ARENA.velocidadMinFactor + ARENA.velocidadNivelFactor * j.nivel / 100) * (ARENA.factorEnergiaMin + (1 - ARENA.factorEnergiaMin) * j.energia);
      const rapidez = Math.min(max, Math.sqrt(2 * ARENA.aceleracionMps2 * Math.max(0, d - ARENA.toleranciaM)));
      const deseada = { x: d ? dx / d * rapidez : 0, y: d ? dy / d * rapidez : 0 };
      const ax = deseada.x - j.velocidad.x, ay = deseada.y - j.velocidad.y;
      const delta = Math.hypot(ax, ay), factor = delta ? Math.min(1, ARENA.aceleracionMps2 * ARENA.pasoS / delta) : 0;
      const velocidad = { x: j.velocidad.x + ax * factor, y: j.velocidad.y + ay * factor };
      const siguiente = enCancha({ x: j.posicion.x + velocidad.x * ARENA.pasoS, y: j.posicion.y + velocidad.y * ARENA.pasoS });
      const recorrido = distancia(j.posicion, siguiente);
      j.velocidad = { x: (siguiente.x - j.posicion.x) / ARENA.pasoS, y: (siguiente.y - j.posicion.y) / ARENA.pasoS };
      j.posicion = siguiente;
      const calor = this.config.partido.condiciones?.clima === "calor" ? ARENA.factorCalor : 1;
      j.energia = limitar(j.energia - recorrido * ARENA.energiaPorMetro * calor + (recorrido < ARENA.toleranciaM ? ARENA.recuperacionEnergiaS * ARENA.pasoS : 0), ARENA.energiaMin, 1);
    }
  }
  private reiniciar(lado: Lado): void {
    // Reanudación experimental explícita desde el portero donde se encuentra.
    // No se representa como saque de centro o de meta reglamentario.
    const portero = this.estado.jugadores.find(j => j.lado === lado && j.puesto === "POR")!;
    const desde = this.estado.balon.posicion;
    this.evento("reinicio", portero, desde, portero.posicion);
    this.estado.balon = { posicion: { ...portero.posicion }, poseedor: portero.id, vuelo: null };
    this.ultimaAccion = this.estado.tick;
  }
  private recibir(j: JugadorArena): void {
    const vuelo = this.estado.balon.vuelo;
    const desde = vuelo?.origen ?? this.estado.balon.posicion;
    if (vuelo?.adelantados.includes(j.id) && j.lado === vuelo.lado) {
      this.evento("fuera_juego", j, desde, j.posicion);
      this.reiniciar(rival(j.lado)); return;
    }
    const tipo = vuelo ? j.lado === vuelo.lado ? "recepcion" : vuelo.tipo === "tiro" && j.puesto === "POR" ? "atajada" : "intercepcion" : "recuperacion";
    this.evento(tipo, j, desde, j.posicion, vuelo?.autor ?? null);
    this.estado.balon = { posicion: { ...j.posicion }, poseedor: j.id, vuelo: null };
    this.ultimaAccion = this.estado.tick;
    this.ultimaDisputa = this.estado.tick;
  }
  private moverBalon(): void {
    const balon = this.estado.balon;
    const portador = this.estado.jugadores.find(j => j.id === balon.poseedor);
    if (portador) {
      balon.posicion = { ...portador.posicion };
      if ((this.estado.tick - this.ultimaDisputa) * ARENA.pasoS < ARENA.recuperacionCadaS) return;
      const rivales = this.estado.jugadores.filter(j => j.lado !== portador.lado && distancia(j.posicion, portador.posicion) <= ARENA.controlM).sort((a, b) => distancia(a.posicion, portador.posicion) - distancia(b.posicion, portador.posicion) || a.id.localeCompare(b.id));
      const defensor = rivales[0];
      if (defensor) {
        this.ultimaDisputa = this.estado.tick;
        const p = limitar(ARENA.dueloBase + (defensor.nivel - portador.nivel) * ARENA.dueloNivel + (this.config.partido[defensor.lado].defensa - this.config.partido[portador.lado].ataque) * ARENA.dueloFuerza, ARENA.dueloMin, ARENA.dueloMax);
        if (prngDerivado(this.config.partido.seed, `arena:duelo:${this.estado.tick}:${defensor.id}`).chance(p)) this.recibir(defensor);
      }
      return;
    }
    const vuelo = balon.vuelo;
    const desde = { ...balon.posicion };
    if (vuelo) {
      const d = distancia(desde, vuelo.destino), velocidad = vuelo.tipo === "tiro" ? ARENA.velocidadTiroMps : ARENA.velocidadBalonMps;
      const factor = d ? Math.min(1, velocidad * ARENA.pasoS / d) : 1;
      balon.posicion = factor === 1 ? { ...vuelo.destino } : { x: desde.x + (vuelo.destino.x - desde.x) * factor, y: desde.y + (vuelo.destino.y - desde.y) * factor };
    }
    const contactos = this.estado.jugadores.map(j => {
      const punto = proyeccion(j.posicion, desde, balon.posicion);
      const propia = transformar(j.posicion, j.lado);
      const area = propia.x <= ARENA.areaLargoM && Math.abs(propia.y - ARENA.anchoM / 2) <= ARENA.areaAnchoM / 2;
      const radio = j.puesto === "POR" && area ? ARENA.controlPorteroM : ARENA.controlM;
      const ignorar = vuelo && j.id === vuelo.autor && (this.estado.tick - vuelo.inicioTick) * ARENA.pasoS <= ARENA.ignorarAutorS;
      return { j, ...punto, contacto: !ignorar && punto.distancia <= radio };
    }).filter(c => c.contacto).sort((a, b) => a.t - b.t || a.distancia - b.distancia || a.j.id.localeCompare(b.j.id));
    if (contactos[0]) { this.recibir(contactos[0].j); return; }
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
  avanzar(planes: Record<Lado, OrdenesEquipo>, hastaTick: number): void {
    if (!Number.isInteger(hastaTick) || hastaTick <= this.estado.tick || hastaTick > this.config.duracionS / ARENA.pasoS) throw new Error("Reloj de arena inválido");
    const ejecutadas = new Set<string>();
    const posesionInicial = this.estado.jugadores.find(j => j.id === this.estado.balon.poseedor)?.lado ?? this.estado.balon.vuelo?.lado;
    while (this.estado.tick < hastaTick) {
      this.accionBalon(planes, ejecutadas);
      this.moverJugadores(planes, posesionInicial);
      this.estado.tick++;
      this.moverBalon();
      if (this.estado.tick % Math.round(ARENA.fotogramaS / ARENA.pasoS) === 0 || this.estado.tick === hastaTick) this.fotogramas.push(structuredClone(this.estado));
    }
  }
}
