// Brief 051 · medición de remates (no es código de producción). Captura el contexto de cada
// remate al golpear envolviendo MotorArena.prototype.sacarBalon y clasifica el desenlace con los
// eventos, con la misma regla «a puerta» del estadista (gol del rematador o atajada cuyo receptor
// es el rematador). Geometría de ARENA; ninguna cifra propia salvo las etiquetas.
import { ARENA } from "/home/calusaca/cronista/src/sim/limites";
import { transformar } from "/home/calusaca/cronista/src/arena/catalogo";
import { distancia, proyeccion } from "/home/calusaca/cronista/src/arena/geometria";
import type { EventoArena } from "/home/calusaca/cronista/src/arena/tipos";
import { rematesPorLado } from "/home/calusaca/cronista/src/arena/estadista";

export interface Remate {
  seed: number; tick: number; autor: string; lado: string; nivelAutor: number; remateP: number | null;
  distanciaM: number; nivelPortero: number | null; porteroLineaM: number | null; porteroLateralM: number | null;
  hastaY: number; desenlace: string; golTrasRechace: boolean; aPuerta045: boolean; objetivoY?: number; alto?: boolean; potencia?: number;
}
const MEDIO = ARENA.anchoM / 2;

/** Instala la captura sobre la clase dada; devuelve el buffer y una función para vaciarlo. */
export function instalarCaptura(Motor: any) {
  const proto = Motor.prototype; const original = proto.sacarBalon;
  const buffer: Partial<Remate>[] = [];
  proto.sacarBalon = function (this: any, j: any, tipo: string, destino: any, receptor: any, extra: any) {
    if (tipo === "tiro") {
      const e = this.estado, arco = transformar({ x: ARENA.largoM, y: MEDIO }, j.lado);
      const k = e.jugadores.find((p: any) => p.lado !== j.lado && p.puesto === "POR");
      const ko = k ? transformar(k.posicion, j.lado) : null;
      buffer.push({ tick: e.tick + 1, autor: j.id, lado: j.lado, nivelAutor: j.nivel, remateP: j.personalidad?.remate ?? null,
        distanciaM: distancia(j.posicion, arco), nivelPortero: k?.nivel ?? null, porteroLineaM: ko ? ARENA.largoM - ko.x : null,
        porteroLateralM: k ? proyeccion(k.posicion, j.posicion, arco).distancia : null });
    }
    return original.call(this, j, tipo, destino, receptor, extra);
  };
  return { buffer, vaciar: () => buffer.splice(0, buffer.length) };
}

const neutro = new Set(["plan_equipo", "cambio"]);
/** Une la captura con los eventos y clasifica. */
export function clasificar(seed: number, eventos: readonly EventoArena[], capturas: Partial<Remate>[]): { remates: Remate[]; goles: number; golesRemate: number; golesSinRemate: number; autogoles: number } {
  const remates: Remate[] = [];
  let goles = 0, golesRemate = 0, autogoles = 0;
  // v1.1 #1: «a puerta» exactamente como el 045/049: ids de remates a puerta según rematesPorLado.
  const rp = rematesPorLado(eventos, Infinity), ids = new Set(eventos.filter(e => e.tipo === "tiro").map(e => e.id));
  const aPuerta045 = new Set<string>();
  for (const l of ["local", "visita"] as const) rp[l].eventos.forEach((id, i, xs) => { if (ids.has(id) && xs[i + 1] !== undefined && !ids.has(xs[i + 1]!)) aPuerta045.add(id); });
  eventos.forEach((e, i) => {
    if (e.tipo === "gol") { goles++; if (e.autogol) autogoles++; }
    if (e.tipo !== "tiro") return;
    const c = capturas.find(x => x.tick === e.tick && x.autor === e.jugador);
    if (!c) throw new Error(`remate sin captura: semilla ${seed}, ${e.id}`);
    let desenlace = "pendiente", golTrasRechace = false;
    for (let k = i + 1; k < eventos.length; k++) {
      const d = eventos[k]!;
      if (neutro.has(d.tipo)) continue;
      if (d.tipo === "tiro") { desenlace = "otro_tiro"; break; }
      if (d.tipo === "gol" && d.lado === e.lado && d.jugador === e.jugador) { desenlace = "gol"; golesRemate++; break; }
      if (d.tipo === "atajada" && d.receptor === e.jugador) {
        desenlace = d.motivo === "desvio" ? "desvio" : "atrapada";
        if (d.motivo === "desvio") { const g = eventos.slice(k + 1).find(x => !neutro.has(x.tipo)); golTrasRechace = g?.tipo === "gol"; }
        break;
      }
      if (d.tipo === "tiro_fuera" && d.jugador === e.jugador) { desenlace = d.motivo === "alto" ? "alto" : "fuera"; break; }
      if (d.tipo === "intercepcion" && d.receptor === e.jugador) { desenlace = "bloqueado"; break; }
      if (d.tipo === "recepcion" && d.receptor === e.jugador) { desenlace = "companero"; break; }
      if (d.tipo === "reinicio" || d.tipo === "recuperacion" || d.tipo === "gol" || d.tipo === "fuera_juego") { desenlace = "otro"; break; }
    }
    remates.push({ seed, ...(c as Remate), hastaY: e.hasta.y, desenlace, golTrasRechace, aPuerta045: aPuerta045.has(e.id), ...(e.motivo === "alto" ? { alto: true } : {}) });
  });
  return { remates, goles, golesRemate, golesSinRemate: goles - golesRemate, autogoles };
}

const media = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]!; };
const tasa = (a: number, b: number) => b ? a / b : null;
const r3 = (v: number | null) => v === null ? null : Math.round(v * 1000) / 1000;

export function agregar(reglas: string, seeds: { desde: number; hasta: number }, partidos: ReturnType<typeof clasificar>[]) {
  const n = partidos.length, rem = partidos.flatMap(p => p.remates);
  const cuenta = (f: (r: Remate) => boolean) => rem.filter(f).length;
  const aPuerta = rem.filter(r => r.desenlace === "gol" || r.desenlace === "atrapada" || r.desenlace === "desvio");
  const atajadas = cuenta(r => r.desenlace === "atrapada" || r.desenlace === "desvio");
  const goles = cuenta(r => r.desenlace === "gol");
  // Correlación con el nivel: partir por la mediana del nivel del portero / del rematador (cada remate cuenta una vez).
  const nivK = mediana(rem.map(r => r.nivelPortero ?? 0))!, nivR = mediana(rem.map(r => r.nivelAutor))!;
  const kAlto = aPuerta.filter(r => (r.nivelPortero ?? 0) > nivK), kBajo = aPuerta.filter(r => (r.nivelPortero ?? 0) <= nivK);
  const tasaAtaja = (xs: Remate[]) => tasa(xs.filter(r => r.desenlace !== "gol").length, xs.length);
  const rAlto = rem.filter(r => r.nivelAutor > nivR), rBajo = rem.filter(r => r.nivelAutor <= nivR);
  const tasaPuerta = (xs: Remate[]) => tasa(xs.filter(r => r.desenlace === "gol" || r.desenlace === "atrapada" || r.desenlace === "desvio").length, xs.length);
  const tasaGol = (xs: Remate[]) => tasa(xs.filter(r => r.desenlace === "gol").length, xs.length);
  // Colocación: destino perturbado (hasta.y) de los remates que van dentro del arco.
  const dentro = rem.filter(r => Math.abs(r.hastaY - MEDIO) <= ARENA.arcoM / 2);
  const lados = cuenta(r => Math.abs(r.hastaY - MEDIO) <= ARENA.arcoM / 2 && Math.abs(r.hastaY - MEDIO) > ARENA.arcoM / 4);
  const porDesenlace = Object.fromEntries(["gol", "atrapada", "desvio", "fuera", "alto", "bloqueado", "companero", "otro_tiro", "otro", "pendiente"].map(d => [d, cuenta(r => r.desenlace === d)]));
  return {
    reglas, semillas: seeds, partidos: n, golesPorPartido: r3(partidos.reduce((s, p) => s + p.goles, 0) / n),
    golesRematePorPartido: r3(partidos.reduce((s, p) => s + p.golesRemate, 0) / n), golesSinRematePorPartido: r3(partidos.reduce((s, p) => s + p.golesSinRemate, 0) / n),
    autogoles: partidos.reduce((s, p) => s + p.autogoles, 0), golesTrasRechace: cuenta(r => r.golTrasRechace),
    tiros: rem.length, tirosPorPartido: r3(rem.length / n), porDesenlace,
    aPuertaFraccion: r3(tasa(aPuerta.length, rem.length)), aPuerta045Fraccion: r3(tasa(cuenta(r => r.aPuerta045), rem.length)), discrepancia045: cuenta(r => r.aPuerta045 !== (r.desenlace === "gol" || r.desenlace === "atrapada" || r.desenlace === "desvio")),
    conversion: r3(tasa(goles, rem.length)), atajadasSobreAPuerta: r3(tasa(atajadas, aPuerta.length)), atajadasSobreAPuerta045: r3(tasa(atajadas, cuenta(r => r.aPuerta045))),
    desvioSobreAtajadas: r3(tasa(porDesenlace.desvio!, atajadas)), fueraFraccion: r3(tasa(porDesenlace.fuera! + porDesenlace.alto!, rem.length)), altoSobreFuera: r3(tasa(porDesenlace.alto!, porDesenlace.fuera! + porDesenlace.alto!)),
    bloqueadoFraccion: r3(tasa(porDesenlace.bloqueado!, rem.length)),
    distanciaMediaM: r3(media(rem.map(r => r.distanciaM))), distanciaMedianaM: r3(mediana(rem.map(r => r.distanciaM))),
    porteroLineaMediaM: r3(media(rem.map(r => r.porteroLineaM ?? 0))), porteroLateralMedianaM: r3(mediana(rem.map(r => r.porteroLateralM ?? 0))),
    nivelPortero: { medianaCorte: nivK, aPuertaAlto: kAlto.length, aPuertaBajo: kBajo.length, atajaAlto: r3(tasaAtaja(kAlto)), atajaBajo: r3(tasaAtaja(kBajo)), diferencia: r3((tasaAtaja(kAlto) ?? 0) - (tasaAtaja(kBajo) ?? 0)) },
    nivelRematador: { medianaCorte: nivR, tirosAlto: rAlto.length, tirosBajo: rBajo.length, aPuertaAlto: r3(tasaPuerta(rAlto)), aPuertaBajo: r3(tasaPuerta(rBajo)), golAlto: r3(tasaGol(rAlto)), golBajo: r3(tasaGol(rBajo)), diferenciaPuerta: r3((tasaPuerta(rAlto) ?? 0) - (tasaPuerta(rBajo) ?? 0)) },
    colocacion: { dentro: dentro.length, aLosLadosFraccion: r3(tasa(lados, dentro.length)), desvioMedioM: r3(media(rem.map(r => Math.abs(r.hastaY - MEDIO)))), izquierdaFraccion: r3(tasa(cuenta(r => r.hastaY < MEDIO), rem.length)) },
  };
}
