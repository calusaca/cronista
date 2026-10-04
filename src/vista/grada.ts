// Brief 026 — la grada: reacciones de la afición DERIVADAS de los datos del partido.
// Capa de vista pura (como la evidencia): mismos eventos ⇒ mismas reacciones, byte a byte. No
// cambia ningún dato y no tiene RNG propio; la única aleatoriedad es la identidad de la afición
// (nombre del sector y su cántico), derivada del NOMBRE del equipo con un flujo propio: sirve
// igual para partidos sueltos y de liga, y el mundo no cambia.
//
// Cada reacción cita ids reales (macro y, el olé, micro) y tiene un evento macro que la DISPARA:
// solo depende de lo anterior a ese evento, así que sobre un prefijo salen exactamente las
// primeras reacciones del partido (sin clarividencia).

import { marcadorAntes, rachasOle } from "../analista/grada";
import {
  AFICION_COLECTIVOS,
  AFICION_FINALES,
  AFICION_SEMILLA,
  AFICION_SILABAS,
  ALIENTO_DIFERENCIA,
  ALIENTO_MINUTO,
  CANTICOS,
  OVACION_NOTA_MIN,
  TIPOS_REACCION,
} from "../analista/umbrales";
import { figura, notaTxt, valorar } from "../analista/valoracion";
import { micro, type MicroPartido } from "../sim/micro";
import { prngDerivado } from "../sim/prng";
import type { Lado, Partido } from "../sim/tipos";

export type TipoReaccion = (typeof TIPOS_REACCION)[number];

export interface Aficion {
  /** Nombre del sector («Marea Velarina»): ficción declarada, de sílabas propias. */
  sector: string;
  /** Su único cántico: una línea de las plantillas cerradas (CANTICOS), con el nombre del equipo. */
  canto: { es: string; en: string };
}

export interface Reaccion {
  tipo: TipoReaccion;
  /** Minuto en que suena (el del último pase de la racha; el del gol; 45; el del cambio; 75). */
  minuto: number;
  /** El sector que reacciona. */
  lado: Lado;
  /** Evento macro que la dispara (antes de él no se puede saber). */
  disparo: string;
  /** Ids macro citados (gol, fin de periodo, cambio, fuentes de la nota, goles del marcador). */
  eventos: string[];
  /** Ids micro citados (los pases del olé). */
  micro: string[];
  texto_es: string;
  texto_en: string;
  /** Solo en el olé y el aliento: el cántico de la afición. */
  canto?: { es: string; en: string };
}

/**
 * El nombre propio del equipo: sin la palabra de club del principio («Racing Torarido» ⇒
 * «Torarido»; «Juventud Islaverde Sur» ⇒ «Islaverde Sur»). Con una sola palabra, esa.
 */
export function nombrePropio(equipo: string): string {
  const partes = equipo.trim().split(/\s+/);
  return partes.length > 1 ? partes.slice(1).join(" ") : equipo.trim();
}

/** La identidad de la afición, derivada del nombre del equipo (pura: mismo nombre ⇒ misma afición). */
export function aficionDe(equipo: string): Aficion {
  const rng = prngDerivado(AFICION_SEMILLA, `aficion:${equipo}`);
  const colectivo = rng.pick(AFICION_COLECTIVOS);
  const n = rng.int(2, 3);
  let palabra = "";
  for (let i = 0; i < n; i++) palabra += rng.pick(AFICION_SILABAS);
  palabra += rng.pick(AFICION_FINALES);
  const sector = `${colectivo} ${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}`;
  const plantilla = rng.pick(CANTICOS);
  const rellenar = (t: string) => t.replaceAll("{n}", nombrePropio(equipo)).replaceAll("{s}", sector);
  return { sector, canto: { es: rellenar(plantilla.es), en: rellenar(plantilla.en) } };
}

/** Las reacciones del partido (o del prefijo visto), en el orden en que suenan. */
/** Brief 027: ¿se juega a puerta cerrada? (sanción de club del registro, con su variante). */
export function aPuertaCerrada(p: Partido): boolean {
  return p.config.variantes?.sanciones === true && (p.config.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada");
}

export function reacciones(p: Partido, m: MicroPartido = micro(p)): Reaccion[] {
  // Brief 027: a puerta cerrada no hay público — ninguna reacción, de nadie (tampoco la visitante).
  if (aPuertaCerrada(p)) return [];
  const ev = p.eventos;
  const idx = new Map(ev.map((e, i) => [e.id, i] as const));
  const antes = marcadorAntes(p);
  const nombre: Record<Lado, string> = { local: p.config.local.nombre, visita: p.config.visita.nombre };
  const afi: Record<Lado, Aficion> = { local: aficionDe(nombre.local), visita: aficionDe(nombre.visita) };
  const golesAntes = (k: number) => ev.slice(0, k).filter((e) => e.tipo === "gol").map((e) => e.id);
  const out: Reaccion[] = [];

  // 1 · ¡Olé! — la racha de la capa micro (la misma medición que el hecho del Analista).
  for (const r of rachasOle(p, m)) {
    const ultimo = r.pases[r.pases.length - 1];
    if (!ultimo) continue;
    const a = afi[r.equipo];
    out.push({
      tipo: "ole",
      minuto: ultimo.minuto,
      lado: r.equipo,
      disparo: r.ancla,
      eventos: [],
      micro: r.pases.map((x) => x.id),
      texto_es: `¡Olé! ${a.sector} canta «${a.canto.es}»: ${r.pases.length} pases seguidos de ${nombre[r.equipo]}`,
      texto_en: `Olé! ${a.sector} sing “${a.canto.en}”: ${r.pases.length} passes in a row by ${nombre[r.equipo]}`,
      canto: a.canto,
    });
  }

  ev.forEach((e, k) => {
    // 2 · Rugido (local) y 6 · grito del sector visitante: cada gol, del sector del que lo SUMA.
    // El que lo sufre calla: el silencio no es una reacción y no se emite.
    if (e.tipo === "gol") {
      const lado = e.equipo;
      const a = afi[lado];
      const quien = e.autogol === true ? `en propia puerta de ${e.jugador ?? "un rival"}` : `de ${e.jugador ?? nombre[lado]}`;
      const who = e.autogol === true ? `${e.jugador ?? "a defender"}'s own goal` : `${e.jugador ?? nombre[lado]}'s goal`;
      out.push({
        tipo: lado === "local" ? "rugido" : "grito_visitante",
        minuto: e.minuto,
        lado,
        disparo: e.id,
        eventos: [e.id],
        micro: [],
        texto_es: lado === "local" ? `Rugido de ${a.sector}: gol ${quien}` : `Sector visitante: ${a.sector} grita el gol ${quien}`,
        texto_en: lado === "local" ? `Roar from ${a.sector}: ${who}` : `Away section: ${a.sector} roar for ${who}`,
      });
    }
    // 4 · Ovación: sale sustituido el mejor valorado HASTA ESE MOMENTO, con nota ≥ OVACION_NOTA_MIN.
    // (No «la figura del partido»: eso es un hecho de cierre, y aquí no hay clarividencia.)
    if (e.tipo === "cambio" && e.sale) {
      const visto: Partido = { config: p.config, eventos: ev.slice(0, k + 1) };
      const vals = valorar(visto);
      const f = figura(visto, vals);
      if (f && f.jugador === e.sale && f.lado === e.equipo && f.nota >= OVACION_NOTA_MIN) {
        const a = afi[e.equipo];
        out.push({
          tipo: "ovacion",
          minuto: e.minuto,
          lado: e.equipo,
          disparo: e.id,
          eventos: [e.id, ...new Set(f.desglose.map((d) => d.evento))],
          micro: [],
          texto_es: `Ovación de ${a.sector} para ${e.sale} (nota ${notaTxt(f.nota)}, la mejor hasta ahora) al ser sustituido`,
          texto_en: `Standing ovation from ${a.sector} for ${e.sale} (rated ${notaTxt(f.nota)}, the best so far) as he goes off`,
        });
      }
    }
  });

  // 3 · Silbidos al descanso: el local pierde al terminar el 1.er tiempo.
  const descanso = ev.findIndex((e) => e.tipo === "fin_periodo");
  const fin1 = ev[descanso];
  if (fin1) {
    const g = antes.get(fin1.id) ?? { local: 0, visita: 0 };
    if (g.local < g.visita) {
      out.push({
        tipo: "silbidos_descanso",
        minuto: fin1.minuto,
        lado: "local",
        disparo: fin1.id,
        eventos: [fin1.id, ...golesAntes(descanso)],
        micro: [],
        texto_es: `Silbidos al descanso: ${afi.local.sector} despide a ${nombre.local}, que pierde ${g.local}–${g.visita}`,
        texto_en: `Whistles at half-time: ${afi.local.sector} see ${nombre.local} trail ${g.local}–${g.visita}`,
      });
    }
  }

  // 5 · Aliento: al llegar al ALIENTO_MINUTO, el local pierde por ALIENTO_DIFERENCIA.
  const t75 = ev.findIndex((e) => e.minuto >= ALIENTO_MINUTO);
  const e75 = ev[t75];
  if (e75) {
    const g = antes.get(e75.id) ?? { local: 0, visita: 0 };
    if (g.visita - g.local === ALIENTO_DIFERENCIA) {
      const a = afi.local;
      out.push({
        tipo: "aliento",
        minuto: ALIENTO_MINUTO,
        lado: "local",
        disparo: e75.id,
        eventos: golesAntes(t75),
        micro: [],
        texto_es: `Aliento: ${a.sector} empuja con «${a.canto.es}» — ${nombre.local} pierde por uno al ${ALIENTO_MINUTO}'`,
        texto_en: `Backing the team: ${a.sector} sing “${a.canto.en}” — ${nombre.local} one goal down at ${ALIENTO_MINUTO}'`,
        canto: a.canto,
      });
    }
  }

  // El orden en que suenan: por el evento que las dispara; a igual disparo, la lista cerrada.
  const orden = (r: Reaccion) => TIPOS_REACCION.indexOf(r.tipo);
  return out.sort((a, b) => (idx.get(a.disparo) ?? 0) - (idx.get(b.disparo) ?? 0) || orden(a) - orden(b));
}
