// Brief 028 §2.4 — los experimentos CONTROLADOS del generador, re-corridos por el CLI: no miden la
// corrida exportada sino el motor (mismas semillas con y sin el factor). Las bandas son las de
// limites.ts y las definiciones, las de la suite estadística (estadisticas.stats, condiciones.stats,
// insolitos.stats): este archivo NO importa los modificadores del generador (parametros.ts).
// Criterio del veredicto: el valor puntual dentro de la banda, como en `npm run test:stats`.

import { AB_CONDICIONES as B, AB_NIEBLA, ESTILOS, N_AB, N_ESTADISTICA, PASE_M, SALIDA_TEMPRANA_MIN, TEMPERATURA_C, VENTAJA_FUERTE } from "../sim/limites";
import { micro, type MicroEvento } from "../sim/micro";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import { resumir } from "../sim/resumen";
import type { Condiciones, Estilo, Partido } from "../sim/tipos";
import { veredicto, type Medicion } from "./medir";
import { t, type Texto } from "./texto";

const ESTILOS_TODOS: readonly Estilo[] = ["posesion", "contragolpe", "presion"];
/** Condiciones neutras del control (las de condiciones.stats.test.ts). */
const NEUTRAS: Condiciones = { clima: "despejado", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } };

export interface TamanoExperimentos {
  /** Semillas 1..n de estilos y ventaja del fuerte (la suite usa N_ESTADISTICA). */
  estilos: number;
  /** Partidos por brazo de cada A/B (la suite usa N_AB). */
  ab: number;
}
export const TAMANO_SUITE: TamanoExperimentos = { estilos: N_ESTADISTICA, ab: N_AB };

export interface Experimento extends Medicion {
  grupo: "estilos" | "condiciones";
}

function exp(grupo: Experimento["grupo"], clave: string, medida: Texto, fuente: string, banda: { min?: number; max?: number }, medido: number, formato: Medicion["formato"], n: number, unidad: string): Experimento {
  const m = { clave, medida, fuente, ...banda, medido, formato, n, unidad };
  return { ...m, grupo, veredicto: veredicto(m) };
}

export function estilosYVentaja(n: number): Experimento[] {
  const semillas = Array.from({ length: n }, (_, i) => i + 1);
  const m = {} as Record<Estilo, { pasesClave: number; xgPorTiro: number; faltas: number }>;
  for (const estilo of ESTILOS_TODOS) {
    let pc = 0;
    let xg = 0;
    let tiros = 0;
    let faltas = 0;
    for (const s of semillas) {
      const r = resumir(
        simular(configDeSemilla(s, { ataque: ESTILOS.rating, defensa: ESTILOS.rating, estilo }, { ataque: ESTILOS.rating, defensa: ESTILOS.rating, estilo: ESTILOS_TODOS[s % 3] as Estilo })),
      );
      pc += r.local.pasesClave;
      xg += r.local.xg;
      tiros += r.local.tiros;
      faltas += r.local.faltas;
    }
    m[estilo] = { pasesClave: pc / n, xgPorTiro: xg / tiros, faltas: faltas / n };
  }
  const ratio = (estilo: Estilo, k: "pasesClave" | "xgPorTiro" | "faltas") => m[estilo][k] / Math.max(...ESTILOS_TODOS.filter((e) => e !== estilo).map((e) => m[e][k]));
  let gana = 0;
  for (const s of semillas) {
    const fuerteLocal = s % 2 === 1;
    const fuerte = { ...VENTAJA_FUERTE.fuerte, estilo: ESTILOS_TODOS[s % 3] as Estilo };
    const debil = { ...VENTAJA_FUERTE.debil, estilo: ESTILOS_TODOS[(s + 1) % 3] as Estilo };
    const r = resumir(simular(fuerteLocal ? configDeSemilla(s, fuerte, debil) : configDeSemilla(s, debil, fuerte)));
    const gf = fuerteLocal ? r.local.goles : r.visita.goles;
    const gd = fuerteLocal ? r.visita.goles : r.local.goles;
    if (gf > gd) gana++;
  }
  const r3 = { tipo: "dec", d: 3 } as const;
  return [
    exp("estilos", "estiloPosesion", t`Possession style: key passes vs the next style (ratio)`, "ESTILOS.pasesClavePosesionRatioMin", { min: ESTILOS.pasesClavePosesionRatioMin }, ratio("posesion", "pasesClave"), r3, n, "seeds per style"),
    exp("estilos", "estiloContragolpe", t`Counter-attack style: xG per shot vs the next style (ratio)`, "ESTILOS.xgPorTiroContragolpeRatioMin", { min: ESTILOS.xgPorTiroContragolpeRatioMin }, ratio("contragolpe", "xgPorTiro"), r3, n, "seeds per style"),
    exp("estilos", "estiloPresion", t`Pressing style: fouls vs the next style (ratio)`, "ESTILOS.faltasPresionRatioMin", { min: ESTILOS.faltasPresionRatioMin }, ratio("presion", "faltas"), r3, n, "seeds per style"),
    exp(
      "estilos",
      "ventaja",
      t`Stronger side (${VENTAJA_FUERTE.fuerte.ataque}/${VENTAJA_FUERTE.fuerte.defensa} vs ${VENTAJA_FUERTE.debil.ataque}/${VENTAJA_FUERTE.debil.defensa}) wins`,
      "VENTAJA_FUERTE",
      { min: VENTAJA_FUERTE.min, max: VENTAJA_FUERTE.max },
      gana / n,
      { tipo: "pct", d: 1 },
      n,
      "seeds",
    ),
  ];
}

interface PasesContados {
  total: number;
  completados: number;
}

/** Solo se retienen sumas; los partidos y sus micro-eventos no se conservan entre iteraciones. */
interface Brazo {
  pases2T: number;
  tiros2T: number;
  faltas2T: number;
  pases: PasesContados;
  cortos: Record<"local" | "visita", PasesContados>;
  largos: PasesContados;
  cortosNiebla: PasesContados;
  atajadas: number;
  cornersTrasAtajada: number;
  tirosSinPenal: number;
  velocidadTotal: number;
  mediaDistancia: number;
  perdidasTempranas: number;
  perdidasPosteriores: number;
}

function periodos(p: Partido): Map<string, 1 | 2> {
  const out = new Map<string, 1 | 2>();
  let inicios = 0;
  for (const e of p.eventos) {
    if (e.tipo === "inicio_periodo") inicios++;
    out.set(e.id, inicios >= 2 ? 2 : 1);
  }
  return out;
}

const contarPase = (cuenta: PasesContados, pase: MicroEvento): void => {
  cuenta.total++;
  if (pase.completado) cuenta.completados++;
};
const completacion = (cuenta: PasesContados): number => cuenta.completados / cuenta.total;

/** Mismas semillas y recuentos del A/B, con memoria acotada al tamaño de UN partido. */
function medirBrazo(n: number, c?: Condiciones, insolitos = false): Brazo {
  const vacio = (): PasesContados => ({ total: 0, completados: 0 });
  const b: Brazo = {
    pases2T: 0, tiros2T: 0, faltas2T: 0,
    pases: vacio(), cortos: { local: vacio(), visita: vacio() }, largos: vacio(), cortosNiebla: vacio(),
    atajadas: 0, cornersTrasAtajada: 0, tirosSinPenal: 0, velocidadTotal: 0, mediaDistancia: 0,
    perdidasTempranas: 0, perdidasPosteriores: 0,
  };
  for (let i = 0; i < n; i++) {
    const cfg = configDeSemilla(i + 1);
    const p = simular({ ...cfg, ...(c ? { condiciones: c } : {}), ...(insolitos ? { variantes: { insolitos: true } } : {}) });
    const pp = periodos(p);
    p.eventos.forEach((e, k) => {
      if (pp.get(e.id) === 2) {
        if (e.tipo === "tiro") b.tiros2T++;
        if (e.tipo === "falta") b.faltas2T++;
      }
      if (e.tipo === "atajada") {
        b.atajadas++;
        const sig = p.eventos[k + 1];
        if (sig?.tipo === "corner" && sig.equipo === e.equipo) b.cornersTrasAtajada++;
      }
      if (e.tipo === "tiro" && e.penal !== true) {
        b.tirosSinPenal++;
        b.velocidadTotal += e.velocidadKmh ?? 0;
        if (e.zonaOrigen === "media_distancia") b.mediaDistancia++;
      }
    });
    for (const x of micro(p).eventos) {
      if (x.tipo === "pase") {
        if (pp.get(x.ancla) === 2) b.pases2T++;
        contarPase(b.pases, x);
        if ((x.distanciaM ?? 0) < PASE_M.corto.max) contarPase(b.cortos[x.equipo], x);
        if (x.distanciaM !== undefined) {
          if (x.distanciaM >= PASE_M.largo.min) contarPase(b.largos, x);
          if (x.distanciaM < PASE_M.corto.max) contarPase(b.cortosNiebla, x);
        }
      }
      if (x.tipo === "perdida" && x.equipo === "visita" && x.zona === "defensa") {
        if (x.minuto < SALIDA_TEMPRANA_MIN) b.perdidasTempranas++;
        else b.perdidasPosteriores++;
      }
    }
  }
  return b;
}

export function condicionesAB(n: number): Experimento[] {
  const brazo = (c?: Condiciones, insolitos = false) => medirBrazo(n, c, insolitos);
  const control = brazo();
  const calor = brazo({ ...NEUTRAS, clima: "calor", temperaturaC: TEMPERATURA_C.calor.max });
  const tibio = brazo({ ...NEUTRAS, clima: "calor", temperaturaC: B.calorTemperaturaBaja });
  const lluvia = brazo({ ...NEUTRAS, clima: "lluvia" });
  const sintetica = brazo({ ...NEUTRAS, superficie: "sintetica", cesped: undefined });
  const alto = brazo({ ...NEUTRAS, cesped: "alto" });
  const presion = brazo({ ...NEUTRAS, presion: { local: "media", visita: "alta" } });

  const p2 = (b: Brazo) => b.pases2T / control.pases2T;
  const sueltas = (b: Brazo) => b.cornersTrasAtajada / b.atajadas;
  const vel = (b: Brazo) => b.velocidadTotal / b.tirosSinPenal;
  const md = (b: Brazo) => b.mediaDistancia / b.tirosSinPenal;
  const perd = (b: Brazo, temprano: boolean) => temprano ? b.perdidasTempranas : b.perdidasPosteriores;

  const cal = TEMPERATURA_C.calor.max;
  const r3 = { tipo: "dec", d: 3 } as const;
  const d4 = { tipo: "dec", d: 4 } as const;
  const u = "matches per arm";
  const out: Experimento[] = [
    exp("condiciones", "calorPases2T", t`Heat ${cal} °C: second-half passes (ratio)`, "AB_CONDICIONES.calorPases2T", B.calorPases2T, p2(calor), r3, n, u),
    exp("condiciones", "calorGradiente", t`Heat ${B.calorTemperaturaBaja} °C: second-half passes (ratio; must sit between the ${cal} °C ratio and no effect)`, "AB_CONDICIONES.calorTemperaturaBaja", { min: p2(calor), max: 1 }, p2(tibio), r3, n, u),
    exp("condiciones", "calorTiros2T", t`Heat ${cal} °C: second-half shots (ratio)`, "AB_CONDICIONES.calorTiros2T", B.calorTiros2T, calor.tiros2T / control.tiros2T, r3, n, u),
    exp("condiciones", "calorFaltas2T", t`Heat ${cal} °C: second-half fouls (ratio)`, "AB_CONDICIONES.calorFaltas2T", B.calorFaltas2T, calor.faltas2T / control.faltas2T, r3, n, u),
    exp("condiciones", "lluviaCompletacion", t`Rain: pass completion (difference)`, "AB_CONDICIONES.lluviaCompletacion", B.lluviaCompletacion, completacion(lluvia.pases) - completacion(control.pases), d4, n, u),
    exp("condiciones", "lluviaCorner", t`Rain: saves that end in a corner (ratio)`, "AB_CONDICIONES.lluviaCornerTrasAtajada", B.lluviaCornerTrasAtajada, sueltas(lluvia) / sueltas(control), r3, n, u),
    exp("condiciones", "sinteticaVelocidad", t`Artificial turf: mean shot speed (difference, km/h)`, "AB_CONDICIONES.sinteticaVelocidadKmh", B.sinteticaVelocidadKmh, vel(sintetica) - vel(control), { tipo: "dec", d: 2 }, n, u),
    exp("condiciones", "sinteticaMediaDistancia", t`Artificial turf: share of long-range shots (ratio)`, "AB_CONDICIONES.sinteticaMediaDistancia", B.sinteticaMediaDistancia, md(sintetica) / md(control), r3, n, u),
    exp("condiciones", "cespedVisita", t`Long grass: away short-pass completion (difference)`, "AB_CONDICIONES.cespedVisitaCortos", B.cespedVisitaCortos, completacion(alto.cortos.visita) - completacion(control.cortos.visita), d4, n, u),
    exp(
      "condiciones",
      "cespedLocal",
      t`Long grass: home short-pass completion (difference; must stay near zero)`,
      "AB_CONDICIONES.cespedLocalTolerancia",
      { min: -B.cespedLocalTolerancia, max: B.cespedLocalTolerancia },
      completacion(alto.cortos.local) - completacion(control.cortos.local),
      d4,
      n,
      u,
    ),
    exp("condiciones", "presionTemprana", t`High press: build-up losses before minute ${SALIDA_TEMPRANA_MIN} (ratio)`, "AB_CONDICIONES.presionSalidaTemprana", B.presionSalidaTemprana, perd(presion, true) / perd(control, true), r3, n, u),
    exp("condiciones", "presionDespues", t`High press: build-up losses from minute ${SALIDA_TEMPRANA_MIN} on (ratio; no effect expected)`, "AB_CONDICIONES.presionSalidaDespues", B.presionSalidaDespues, perd(presion, false) / perd(control, false), r3, n, u),
  ];

  // Niebla (025): necesita la variante de insólitos (es un clima de esa variante).
  const cNiebla = brazo(NEUTRAS, true);
  const niebla = brazo({ ...NEUTRAS, clima: "niebla" }, true);
  out.push(exp("condiciones", "nieblaLargos", t`Fog: long-pass completion (difference)`, "AB_NIEBLA.largos", AB_NIEBLA.largos, completacion(niebla.largos) - completacion(cNiebla.largos), d4, n, u));
  out.push(
    exp("condiciones", "nieblaCortos", t`Fog: short-pass completion (difference; must stay near zero)`, "AB_NIEBLA.cortosTolerancia", { min: -AB_NIEBLA.cortosTolerancia, max: AB_NIEBLA.cortosTolerancia }, completacion(niebla.cortosNiebla) - completacion(cNiebla.cortosNiebla), d4, n, u),
  );
  return out;
}

export function experimentos(tam: TamanoExperimentos = TAMANO_SUITE): Experimento[] {
  return [...estilosYVentaja(tam.estilos), ...condicionesAB(tam.ab)];
}
