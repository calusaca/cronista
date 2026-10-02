// El Analista (brief 002): Partido → Hecho[]. Funciones puras y deterministas:
// sin LLM, sin azar, sin red, sin reloj. Cada hecho cita IDs de eventos reales.
//
// Decisiones del implementador (documentadas para el 003 y para Fable):
// - `eventos` de cada hecho va en el orden del stream y sin repetidos.
// - A igual relevancia desempata el minuto del EVENTO DEFINITORIO de cada tipo
//   (tabla DESEMPATE_EVENTO en umbrales.ts; revisión 2.3 [B1]).
// - `remontada` cita los goles del rival hasta el momento de máxima desventaja más
//   todos los goles posteriores (de ambos equipos): la secuencia que la define.
// - `expulsion_y_efecto` por doble amarilla cita además la amarilla previa: es la
//   prueba de que fue doble amarilla y no roja directa.
// - `presion_sostenida`: ventanas codiciosas sin solapamiento, dentro de un mismo periodo;
//   el tramo debe sumar además PRESION_XG_MIN_CENTESIMAS (revisión 2.1).
// - `portero_destacado`: el portero se sigue por plantilla (POR titular) y por cambios
//   (`sale` = portero ⇒ el que entra pasa a ser portero). Tras una roja al portero, el
//   que ataja no se puede identificar con los datos del simulador; si alguna atajada
//   del hecho cae ahí, el hecho no nombra a nadie (revisión 2.3 [B2]).
// - `disciplina` cuenta solo eventos `tarjeta_amarilla` (la segunda amarilla de una
//   expulsión llega como `tarjeta_roja`, contrato 001 v1.1).
// - `justicia_xg` sin ningún tiro (0 xG) cita el fin_periodo final, para que la lista
//   de eventos nunca quede vacía.
// - Brief 009: el portero en el arco (`porteros`) vive ahora en valoracion.ts, que lo
//   comparte con la valoración de jugadores; la regla es la misma.

import type { Evento, Lado, Partido } from "../sim/tipos";
import { micro, type MicroPartido } from "../sim/micro";
import { CANAL_TEXTO, minutoTxt, textos, xgTxt, type ClavePlantilla } from "./textos";
import { TIPOS_HECHO, type Hecho, type TipoHecho } from "./tipos";
import { figura, notaTxt, porteros } from "./valoracion";
import {
  DISCIPLINA_AMARILLAS_MIN,
  DOBLETE_MIN_GOLES,
  DOMINIO_PORCENTAJE_MIN,
  GOL_TARDIO_DESPUES_DE,
  GOL_TEMPRANO_ANTES_DE,
  PORTERO_ATAJADAS_MIN,
  PORTERO_XG_ATAJADO_MIN_CENTESIMAS,
  PRESION_TIROS_MIN,
  PRESION_VENTANA_MINUTOS,
  PRESION_XG_MIN_CENTESIMAS,
  DESEMPATE_EVENTO,
  RELEVANCIA,
  CANAL_AVANCES_MIN,
  CANAL_MIN,
  DOMINIO_MIN,
  DOMINIO_PASES_MIN,
  DUELO_MIN,
  PERDIDAS_MIN,
  type ClaveRelevancia,
} from "./umbrales";

type Datos = Record<string, string | number>;
type Borrador = Omit<Hecho, "id">;

const LADOS: readonly Lado[] = ["local", "visita"];
const rival = (l: Lado): Lado => (l === "local" ? "visita" : "local");

interface GolCtx {
  ev: Evento;
  i: number; // índice en el stream
  periodo: 1 | 2;
  marcador: Record<Lado, number>; // DESPUÉS de este gol
}

interface Ctx {
  ev: Evento[];
  indice: Map<string, number>;
  porId: Map<string, Evento>;
  periodo: (1 | 2)[]; // periodo de cada evento por índice
  nombre: Record<Lado, string>;
  goles: GolCtx[];
  fines: Evento[]; // fin_periodo en orden
  final: Record<Lado, number>;
}

function centesimas(xg: number | undefined): number {
  return Math.round((xg ?? 0) * 100);
}

function contexto(p: Partido): Ctx {
  const ev = p.eventos;
  const indice = new Map(ev.map((e, i) => [e.id, i] as const));
  const porId = new Map(ev.map((e) => [e.id, e] as const));
  const periodo: (1 | 2)[] = [];
  let inicios = 0;
  const marcador: Record<Lado, number> = { local: 0, visita: 0 };
  const goles: GolCtx[] = [];
  const fines: Evento[] = [];
  ev.forEach((e, i) => {
    if (e.tipo === "inicio_periodo") inicios++;
    const per: 1 | 2 = inicios >= 2 ? 2 : 1;
    periodo.push(per);
    if (e.tipo === "gol") {
      marcador[e.equipo] += 1;
      goles.push({ ev: e, i, periodo: per, marcador: { ...marcador } });
    }
    if (e.tipo === "fin_periodo") fines.push(e);
  });
  return {
    ev,
    indice,
    porId,
    periodo,
    nombre: { local: p.config.local.nombre, visita: p.config.visita.nombre },
    goles,
    fines,
    final: { ...marcador },
  };
}

/** IDs existentes, sin repetidos, en orden del stream. */
function citar(c: Ctx, ids: (string | undefined)[]): string[] {
  const unicos = [...new Set(ids.filter((x): x is string => x !== undefined && c.indice.has(x)))];
  return unicos.sort((a, b) => (c.indice.get(a) as number) - (c.indice.get(b) as number));
}

/**
 * Clave de la tabla RELEVANCIA para un hecho: su tipo, salvo `remontada`, que se
 * resuelve por `datos.desenlace` (revisión 2.2). Lanza si una remontada no trae un
 * desenlace válido (error de programa, nunca dato del partido).
 */
export function claveRelevancia(tipo: TipoHecho, datos: Datos): ClaveRelevancia {
  if (tipo !== "remontada") return tipo;
  if (datos.desenlace === "victoria") return "remontada_victoria";
  if (datos.desenlace === "empate") return "remontada_empate";
  throw new Error(`remontada sin desenlace válido: ${String(datos.desenlace)}`);
}

function hecho(c: Ctx, tipo: TipoHecho, clave: ClavePlantilla, ids: (string | undefined)[], datos: Datos): Borrador {
  return { tipo, ...textos(clave, datos), eventos: citar(c, ids), relevancia: RELEVANCIA[claveRelevancia(tipo, datos)], datos };
}

function equipos(c: Ctx): Datos {
  return { local: c.nombre.local, visita: c.nombre.visita };
}

// ---------------- detectores ----------------

function resultadoFinal(c: Ctx): Borrador[] {
  const fin = c.fines[c.fines.length - 1];
  const ganador = c.final.local > c.final.visita ? "local" : c.final.local < c.final.visita ? "visita" : "empate";
  return [
    hecho(c, "resultado_final", "resultado_final", [...c.goles.map((g) => g.ev.id), fin?.id], {
      ...equipos(c),
      goles_local: c.final.local,
      goles_visita: c.final.visita,
      ganador,
    }),
  ];
}

function marcadorPorPeriodo(c: Ctx): Borrador[] {
  return c.fines.slice(0, 2).map((fin, k) => {
    const periodo = (k + 1) as 1 | 2;
    const delPeriodo = c.goles.filter((g) => g.periodo === periodo);
    const hasta = c.goles.filter((g) => g.periodo <= periodo);
    const acum = hasta.length > 0 ? (hasta[hasta.length - 1] as GolCtx).marcador : { local: 0, visita: 0 };
    return hecho(c, "marcador_por_periodo", periodo === 1 ? "marcador_periodo_1" : "marcador_periodo_2", [...delPeriodo.map((g) => g.ev.id), fin.id], {
      ...equipos(c),
      periodo,
      goles_local_periodo: delPeriodo.filter((g) => g.ev.equipo === "local").length,
      goles_visita_periodo: delPeriodo.filter((g) => g.ev.equipo === "visita").length,
      marcador_local: acum.local,
      marcador_visita: acum.visita,
    });
  });
}

function golesAnotados(c: Ctx): Borrador[] {
  return c.goles.map((g) => {
    const tiro = g.ev.relacionadoCon ? c.porId.get(g.ev.relacionadoCon) : undefined;
    const penal = tiro?.penal === true;
    return hecho(c, "gol_anotado", penal ? "gol_penal" : "gol", [g.ev.id, tiro?.id], {
      ...equipos(c),
      jugador: g.ev.jugador ?? "",
      equipo: c.nombre[g.ev.equipo],
      minuto: minutoTxt(g.ev.minuto),
      xg: xgTxt(centesimas(g.ev.xg)),
      penal: penal ? "si" : "no",
      marcador_local: g.marcador.local,
      marcador_visita: g.marcador.visita,
    });
  });
}

function dobletes(c: Ctx): Borrador[] {
  const porJugador = new Map<string, GolCtx[]>();
  for (const g of c.goles) {
    if (!g.ev.jugador) continue;
    const clave = `${g.ev.equipo}|${g.ev.jugador}`;
    porJugador.set(clave, [...(porJugador.get(clave) ?? []), g]);
  }
  const out: Borrador[] = [];
  for (const gs of porJugador.values()) {
    if (gs.length < DOBLETE_MIN_GOLES) continue;
    const primero = gs[0] as GolCtx;
    const clave: ClavePlantilla = gs.length === 2 ? "doblete" : gs.length === 3 ? "triplete" : "varios_goles";
    out.push(
      hecho(c, "doblete_o_mas", clave, gs.map((g) => g.ev.id), {
        jugador: primero.ev.jugador as string,
        equipo: c.nombre[primero.ev.equipo],
        goles: gs.length,
        minutos: gs.map((g) => minutoTxt(g.ev.minuto)).join(", "),
      }),
    );
  }
  return out;
}

/**
 * Remontada: el equipo estuvo abajo en algún momento (desventaja máxima > 0) y
 * terminó ganando o empatando.
 */
function remontadas(c: Ctx): Borrador[] {
  const out: Borrador[] = [];
  for (const lado of LADOS) {
    let peor = 0; // diferencia mínima (propio − rival) alcanzada
    let k = -1; // índice en c.goles donde se alcanzó por primera vez
    c.goles.forEach((g, j) => {
      const d = g.marcador[lado] - g.marcador[rival(lado)];
      if (d < peor) {
        peor = d;
        k = j;
      }
    });
    const dFinal = c.final[lado] - c.final[rival(lado)];
    if (k < 0 || dFinal < 0) continue;
    const enDesventaja = c.goles[k] as GolCtx;
    const ids = [
      ...c.goles.slice(0, k + 1).filter((g) => g.ev.equipo === rival(lado)).map((g) => g.ev.id),
      ...c.goles.slice(k + 1).map((g) => g.ev.id),
    ];
    out.push(
      hecho(c, "remontada", dFinal > 0 ? "remontada_victoria" : "remontada_empate", ids, {
        equipo: c.nombre[lado],
        rival: c.nombre[rival(lado)],
        desventaja_max: -peor,
        minuto_desventaja: minutoTxt(enDesventaja.ev.minuto),
        desventaja_propios: enDesventaja.marcador[lado],
        desventaja_rival: enDesventaja.marcador[rival(lado)],
        final_propios: c.final[lado],
        final_rival: c.final[rival(lado)],
        desenlace: dFinal > 0 ? "victoria" : "empate",
      }),
    );
  }
  return out;
}

function golesTempranosYTardios(c: Ctx): Borrador[] {
  const out: Borrador[] = [];
  for (const g of c.goles) {
    const tipo: TipoHecho | undefined =
      g.ev.minuto < GOL_TEMPRANO_ANTES_DE ? "gol_temprano" : g.ev.minuto > GOL_TARDIO_DESPUES_DE ? "gol_tardio" : undefined;
    if (!tipo) continue;
    out.push(
      hecho(c, tipo, tipo, [g.ev.id], {
        jugador: g.ev.jugador ?? "",
        equipo: c.nombre[g.ev.equipo],
        minuto: minutoTxt(g.ev.minuto),
      }),
    );
  }
  return out;
}

const OFENSIVOS = new Set(["tiro", "corner", "pase_clave"]);

function dominio(c: Ctx): Borrador[] {
  const out: Borrador[] = [];
  for (const periodo of [1, 2] as const) {
    const of = c.ev.filter((e, i) => c.periodo[i] === periodo && OFENSIVOS.has(e.tipo));
    const total = of.length;
    if (total === 0) continue;
    for (const lado of LADOS) {
      const propios = of.filter((e) => e.equipo === lado);
      // Comparación en enteros: 65 % exacto emite, 64.9 % no.
      if (propios.length * 100 < DOMINIO_PORCENTAJE_MIN * total) continue;
      out.push(
        hecho(c, "dominio_periodo", periodo === 1 ? "dominio_1" : "dominio_2", propios.map((e) => e.id), {
          equipo: c.nombre[lado],
          periodo,
          acciones_equipo: propios.length,
          acciones_total: total,
          porcentaje: Math.round((propios.length * 1000) / total) / 10,
        }),
      );
    }
  }
  return out;
}

function presion(c: Ctx): Borrador[] {
  const out: Borrador[] = [];
  for (const lado of LADOS) {
    for (const periodo of [1, 2] as const) {
      const tiros = c.ev.filter((e, i) => e.tipo === "tiro" && e.equipo === lado && c.periodo[i] === periodo);
      let a = 0;
      while (a < tiros.length) {
        const inicio = tiros[a] as Evento;
        let b = a;
        while (b + 1 < tiros.length && (tiros[b + 1] as Evento).minuto - inicio.minuto <= PRESION_VENTANA_MINUTOS) b++;
        const grupo = tiros.slice(a, b + 1);
        const xgGrupo = grupo.reduce((s, e) => s + centesimas(e.xg), 0);
        if (grupo.length >= PRESION_TIROS_MIN && xgGrupo >= PRESION_XG_MIN_CENTESIMAS) {
          out.push(
            hecho(c, "presion_sostenida", "presion", grupo.map((e) => e.id), {
              equipo: c.nombre[lado],
              tiros: grupo.length,
              desde: minutoTxt(inicio.minuto),
              hasta: minutoTxt((grupo[grupo.length - 1] as Evento).minuto),
              xg: xgTxt(xgGrupo),
            }),
          );
          a = b + 1;
        } else {
          a++;
        }
      }
    }
  }
  return out;
}

function justiciaXg(c: Ctx): Borrador[] {
  const tiros = c.ev.filter((e) => e.tipo === "tiro" && e.xg !== undefined);
  const xg: Record<Lado, number> = { local: 0, visita: 0 };
  for (const t of tiros) xg[t.equipo] += centesimas(t.xg);
  const gl = c.final.local;
  const gv = c.final.visita;
  const ganador: Lado | undefined = gl > gv ? "local" : gl < gv ? "visita" : undefined;
  const contra = ganador !== undefined && xg[ganador] < xg[rival(ganador)];
  const base: Datos = {
    ...equipos(c),
    goles_local: gl,
    goles_visita: gv,
    xg_local: xgTxt(xg.local),
    xg_visita: xgTxt(xg.visita),
    contra_la_corriente: contra ? "si" : "no",
  };
  const ids = tiros.length > 0 ? tiros.map((t) => t.id) : [c.fines[c.fines.length - 1]?.id];
  if (contra && ganador) {
    return [
      hecho(c, "justicia_xg", "justicia_contra_corriente", ids, {
        ...base,
        ganador: c.nombre[ganador],
        xg_ganador: xgTxt(xg[ganador]),
        xg_perdedor: xgTxt(xg[rival(ganador)]),
      }),
    ];
  }
  return [hecho(c, "justicia_xg", "justicia_neutra", ids, base)];
}

function porteroDestacado(p: Partido, c: Ctx): Borrador[] {
  const gk = porteros(p);
  const out: Borrador[] = [];
  for (const tirador of LADOS) {
    const defensor = rival(tirador);
    const atajadas = c.ev
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.tipo === "atajada" && e.equipo === tirador);
    const xgAtajado = atajadas.reduce((s, { e }) => s + centesimas(c.porId.get(e.relacionadoCon ?? "")?.xg), 0);
    if (atajadas.length < PORTERO_ATAJADAS_MIN && xgAtajado < PORTERO_XG_ATAJADO_MIN_CENTESIMAS) continue;
    // Se nombra solo si TODAS las atajadas tienen portero identificado (revisión 2.3,
    // [B2]); si alguna fue tras una roja al portero sin reemplazo identificable, el
    // hecho no nombra a nadie: atribuirle esas atajadas al expulsado sería mentir.
    const quienes = atajadas.map(({ i }) => gk[defensor][i]);
    const todosConocidos = quienes.every((n) => n !== undefined);
    const nombres = [...new Set(quienes.filter((n): n is string => n !== undefined))];
    const datos: Datos = {
      equipo: c.nombre[defensor],
      atajadas: atajadas.length,
      xg_atajado: xgTxt(xgAtajado),
    };
    if (todosConocidos) datos.portero = nombres.join(" / ");
    out.push(
      hecho(c, "portero_destacado", todosConocidos ? "portero" : "portero_sin_nombre", atajadas.flatMap(({ e }) => [e.id, e.relacionadoCon]), datos),
    );
  }
  return out;
}

function expulsiones(c: Ctx): Borrador[] {
  const out: Borrador[] = [];
  c.ev.forEach((r, i) => {
    if (r.tipo !== "tarjeta_roja") return;
    const amarillaPrevia = c.ev
      .slice(0, i)
      .find((a) => a.tipo === "tarjeta_amarilla" && a.equipo === r.equipo && a.jugador === r.jugador);
    const antes = c.goles.filter((g) => g.i < i);
    const despues = c.goles.filter((g) => g.i > i);
    const enEseMomento = antes.length > 0 ? (antes[antes.length - 1] as GolCtx).marcador : { local: 0, visita: 0 };
    out.push(
      hecho(
        c,
        "expulsion_y_efecto",
        amarillaPrevia ? "expulsion_doble_amarilla" : "expulsion_directa",
        [r.id, r.relacionadoCon, amarillaPrevia?.id, ...despues.map((g) => g.ev.id)],
        {
          ...equipos(c),
          jugador: r.jugador ?? "",
          equipo: c.nombre[r.equipo],
          minuto: minutoTxt(r.minuto),
          motivo: amarillaPrevia ? "doble_amarilla" : "roja_directa",
          marcador_local: enEseMomento.local,
          marcador_visita: enEseMomento.visita,
          goles_despues_local: despues.filter((g) => g.ev.equipo === "local").length,
          goles_despues_visita: despues.filter((g) => g.ev.equipo === "visita").length,
          goles_local: c.final.local,
          goles_visita: c.final.visita,
        },
      ),
    );
  });
  return out;
}

/**
 * Brief 009: la figura del partido — el mejor valorado (valoracion.ts). Cita los eventos
 * de su desglose; la nota va en `datos` (con un decimal, como la dice el texto) para que
 * V3 la verifique. Sin desglose no hay figura.
 */
function figuraDelPartido(p: Partido, c: Ctx): Borrador[] {
  const f = figura(p);
  if (!f) return [];
  return [
    hecho(c, "figura_del_partido", "figura_del_partido", f.desglose.map((d) => d.evento), {
      jugador: f.jugador,
      equipo: f.equipo,
      nota: notaTxt(f.nota),
    }),
  ];
}

function disciplina(c: Ctx): Borrador[] {
  const out: Borrador[] = [];
  for (const lado of LADOS) {
    const amarillas = c.ev.filter((e) => e.tipo === "tarjeta_amarilla" && e.equipo === lado);
    if (amarillas.length < DISCIPLINA_AMARILLAS_MIN) continue;
    out.push(
      hecho(c, "disciplina", "disciplina", amarillas.map((e) => e.id), {
        equipo: c.nombre[lado],
        amarillas: amarillas.length,
        minutos: amarillas.map((e) => minutoTxt(e.minuto)).join(", "),
      }),
    );
  }
  return out;
}

// ---------------- brief 013: hechos de la capa micro ----------------

/** Hecho que cita micro-eventos (en su orden): `citar` solo conoce los macro. */
function hechoMicro(tipo: TipoHecho, clave: ClavePlantilla, ids: string[], datos: Datos): Borrador {
  return { tipo, ...textos(clave, datos), eventos: [...new Set(ids)], relevancia: RELEVANCIA[claveRelevancia(tipo, datos)], datos };
}

const canalDatos = (canal: string): Datos => ({ canal, canal_es: (CANAL_TEXTO[canal] as { es: string }).es, canal_en: (CANAL_TEXTO[canal] as { en: string }).en });
const pct = (a: number, b: number) => Math.round((a * 100) / b);

/** `duelo_ganado`: un atacante que regateó con éxito ≥ DUELO_MIN veces al MISMO defensor. Cita esos regates. */
function duelos(c: Ctx, m: MicroPartido): Borrador[] {
  const pares = new Map<string, MicroPartido["eventos"]>();
  for (const x of m.eventos) {
    if (x.tipo !== "regate" || x.exito !== true || !x.rival) continue;
    const k = `${x.equipo}|${x.jugador}|${x.rival}`;
    pares.set(k, [...(pares.get(k) ?? []), x]);
  }
  const out: Borrador[] = [];
  for (const xs of pares.values()) {
    if (xs.length < DUELO_MIN) continue;
    const x = xs[0] as MicroPartido["eventos"][number];
    out.push(
      hechoMicro("duelo_ganado", "duelo_ganado", xs.map((y) => y.id), {
        jugador: x.jugador,
        equipo: c.nombre[x.equipo],
        rival: x.rival as string,
        equipo_rival: c.nombre[rival(x.equipo)],
        regates: xs.length,
      }),
    );
  }
  return out;
}

/** `perdidas_en_salida`: por equipo, el canal con más pérdidas en su zona de salida, si llega a PERDIDAS_MIN. */
function perdidasEnSalida(c: Ctx, m: MicroPartido): Borrador[] {
  const out: Borrador[] = [];
  for (const lado of LADOS) {
    const por = new Map<string, string[]>();
    for (const x of m.eventos) if (x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa") por.set(x.canal, [...(por.get(x.canal) ?? []), x.id]);
    const mejor = [...por.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!mejor || mejor[1].length < PERDIDAS_MIN) continue;
    out.push(hechoMicro("perdidas_en_salida", "perdidas_en_salida", mejor[1], { equipo: c.nombre[lado], ...canalDatos(mejor[0]), perdidas: mejor[1].length }));
  }
  return out;
}

/** Periodo de cada micro-evento: el de su ancla macro. */
function periodoMicro(c: Ctx, x: MicroPartido["eventos"][number]): 1 | 2 {
  return c.periodo[c.indice.get(x.ancla) ?? 0] ?? 1;
}

/** Inicios de periodo del partido (o del prefijo): la evidencia de los agregados. */
const inicios = (c: Ctx) => c.ev.filter((e) => e.tipo === "inicio_periodo").map((e) => e.id);

/** `dominio_global`: % de posesión por pases intentados, con su desglose por periodo. */
function dominioGlobal(c: Ctx, m: MicroPartido): Borrador[] {
  const pases = m.eventos.filter((x) => x.tipo === "pase");
  if (pases.length < DOMINIO_PASES_MIN) return [];
  for (const lado of LADOS) {
    const propios = pases.filter((x) => x.equipo === lado).length;
    const porcentaje = pct(propios, pases.length);
    if (porcentaje < DOMINIO_MIN) continue;
    const datos: Datos = { equipo: c.nombre[lado], porcentaje, pases_equipo: propios, pases_total: pases.length };
    for (const per of [1, 2] as const) {
      const delPer = pases.filter((x) => periodoMicro(c, x) === per);
      if (delPer.length === 0) continue;
      datos[`pases_equipo_p${per}`] = delPer.filter((x) => x.equipo === lado).length;
      datos[`pases_total_p${per}`] = delPer.length;
    }
    return [hechoMicro("dominio_global", "dominio_global", inicios(c), datos)];
  }
  return [];
}

/** `dominio_por_canal`: el canal de la mayoría de los avances de un equipo, con el desglose por canal. */
function dominioPorCanal(c: Ctx, m: MicroPartido): Borrador[] {
  const out: Borrador[] = [];
  for (const lado of LADOS) {
    const av = m.posesiones.filter((x) => x.equipo === lado && x.avance);
    if (av.length < CANAL_AVANCES_MIN) continue;
    const cuenta = { banda_izquierda: 0, centro: 0, banda_derecha: 0 } as Record<string, number>;
    for (const x of av) cuenta[x.canal] = (cuenta[x.canal] ?? 0) + 1;
    const [canal, n] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0] as [string, number];
    const porcentaje = pct(n, av.length);
    if (porcentaje < CANAL_MIN) continue;
    out.push(
      hechoMicro("dominio_por_canal", "dominio_por_canal", inicios(c), {
        equipo: c.nombre[lado],
        ...canalDatos(canal),
        porcentaje,
        avances_canal: n,
        avances_total: av.length,
        avances_izquierda: cuenta.banda_izquierda as number,
        avances_centro: cuenta.centro as number,
        avances_derecha: cuenta.banda_derecha as number,
      }),
    );
  }
  return out;
}

// ---------------- orden y API ----------------

/**
 * Evento definitorio de un hecho (revisión 2.3, [B1]): el primer evento citado del
 * tipo que fija DESEMPATE_EVENTO; si no cita ninguno de ese tipo, el primer citado.
 */
function definitorio(c: Ctx, h: Borrador): Evento | undefined {
  const tipo = DESEMPATE_EVENTO[h.tipo];
  const id = h.eventos.find((x) => c.porId.get(x)?.tipo === tipo) ?? h.eventos[0];
  return id === undefined ? undefined : c.porId.get(id);
}

/**
 * Orden total y estable: relevancia descendente; a igualdad, minuto del evento
 * definitorio; luego su posición en el stream; luego el orden de TIPOS_HECHO;
 * por último la lista de eventos citados (comparación lexicográfica de índices).
 */
function comparar(c: Ctx, m: MicroPartido) {
  // Brief 013: un hecho que cita micro-eventos se ordena por su PRIMER micro-evento citado
  // (minuto, y su posición detrás de todo el stream macro para el desempate siguiente).
  const microIdx = new Map(m.eventos.map((x, i) => [x.id, i] as const));
  const primerMicro = (h: Borrador) => {
    const i = microIdx.get(h.eventos[0] ?? "");
    return i === undefined ? undefined : (m.eventos[i] as MicroPartido["eventos"][number]);
  };
  const primero = (h: Borrador) => {
    const e = definitorio(c, h);
    if (e) return c.indice.get(e.id) as number;
    const x = primerMicro(h);
    return x ? c.ev.length + (microIdx.get(x.id) as number) : Number.MAX_SAFE_INTEGER;
  };
  const minuto = (h: Borrador) => definitorio(c, h)?.minuto ?? primerMicro(h)?.minuto ?? Number.MAX_SAFE_INTEGER;
  return (a: Borrador, b: Borrador): number => {
    if (a.relevancia !== b.relevancia) return b.relevancia - a.relevancia;
    if (minuto(a) !== minuto(b)) return minuto(a) - minuto(b);
    if (primero(a) !== primero(b)) return primero(a) - primero(b);
    const ta = TIPOS_HECHO.indexOf(a.tipo);
    const tb = TIPOS_HECHO.indexOf(b.tipo);
    if (ta !== tb) return ta - tb;
    const ia = a.eventos.map((id) => c.indice.get(id) ?? 0);
    const ib = b.eventos.map((id) => c.indice.get(id) ?? 0);
    for (let k = 0; k < Math.min(ia.length, ib.length); k++) {
      if (ia[k] !== ib[k]) return (ia[k] as number) - (ib[k] as number);
    }
    return ia.length - ib.length;
  };
}

/** Hechos del partido, ordenados por relevancia, con IDs "h01", "h02", … */
export function analizar(partido: Partido): Hecho[] {
  const c = contexto(partido);
  const borradores: Borrador[] = [
    ...resultadoFinal(c),
    ...marcadorPorPeriodo(c),
    ...golesAnotados(c),
    ...dobletes(c),
    ...remontadas(c),
    ...golesTempranosYTardios(c),
    ...dominio(c),
    ...presion(c),
    ...justiciaXg(c),
    ...porteroDestacado(partido, c),
    ...expulsiones(c),
    ...disciplina(c),
    ...figuraDelPartido(partido, c),
  ];
  // Brief 013: la capa micro es función pura del partido (o del prefijo): se deriva aquí.
  const m = micro(partido);
  borradores.push(...duelos(c, m), ...perdidasEnSalida(c, m), ...dominioGlobal(c, m), ...dominioPorCanal(c, m));
  borradores.sort(comparar(c, m));
  return borradores.map((b, i) => ({ id: `h${String(i + 1).padStart(2, "0")}`, ...b }));
}
