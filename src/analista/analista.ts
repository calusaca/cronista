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

import { ladoDelJugador, type Evento, type Lado, type Partido } from "../sim/tipos";
import { micro, type MicroPartido } from "../sim/micro";
import { CANAL_TEXTO, CANCHA_TEXTO, CAUSA_TEXTO, CLIMA_TEXTO, PRESION_TEXTO, jornadasTxt, listaBajas, minutoTxt, temperaturaTxt, textos, xgTxt, type ClavePlantilla } from "./textos";
import { medirCalor, medirCancha, medirNiebla, medirPresion } from "./condiciones";
import { rachasOle } from "./grada";
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
  // Brief 020: el autogol no es «X marcó» (va como autogol, hecho propio). Brief 025: el olímpico
  // tampoco va como gol de tiro (no hay tiro): tiene su hecho `gol_olimpico`.
  return c.goles.filter((g) => g.ev.autogol !== true && g.ev.definicion !== "olimpico").map((g) => {
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
      // Brief 015: las magnitudes del tiro (si el partido las trae) para que V3/V6 las verifiquen.
      ...(tiro?.distanciaM !== undefined ? { distancia_m: tiro.distanciaM } : {}),
      ...(tiro?.velocidadKmh !== undefined ? { velocidad_kmh: tiro.velocidadKmh } : {}),
      // Brief 020: la definición registrada (V8 la exige para «de chilena», «mano a mano»…).
      ...(tiro?.definicion !== undefined ? { definicion: tiro.definicion } : {}),
    });
  });
}

/** Brief 020: `autogol` — el autor es del equipo que lo SUFRE; cita el gol y el tiro rival. */
function autogoles(c: Ctx): Borrador[] {
  return c.goles
    .filter((g) => g.ev.autogol === true)
    .map((g) =>
      hecho(c, "autogol", "autogol", [g.ev.id, g.ev.relacionadoCon], {
        ...equipos(c),
        jugador: g.ev.jugador ?? "",
        equipo: c.nombre[ladoDelJugador(g.ev)],
        beneficiado: c.nombre[g.ev.equipo],
        minuto: minutoTxt(g.ev.minuto),
        marcador_local: g.marcador.local,
        marcador_visita: g.marcador.visita,
      }),
    );
}

function dobletes(c: Ctx): Borrador[] {
  const porJugador = new Map<string, GolCtx[]>();
  for (const g of c.goles) {
    if (!g.ev.jugador || g.ev.autogol === true) continue;
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
    if (g.ev.autogol === true) continue; // brief 020: «X marcó en el minuto…» no es de un autogol
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
function perdidasEnSalida(c: Ctx, m: MicroPartido, subsumidos: ReadonlySet<Lado> = new Set()): Borrador[] {
  const out: Borrador[] = [];
  for (const lado of LADOS) {
    // Brief 018 (verificación de Fable): si ese equipo ya tiene presion_que_ahoga, ese hecho lo
    // SUBSUME (las mismas pérdidas en salida, contadas con su causa): no se narran dos veces.
    if (subsumidos.has(lado)) continue;
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

// ---------------- brief 018: condiciones y sus efectos medidos ----------------

/**
 * `condiciones_del_partido`: dato puro, la config registrada (clima, cancha, presión). Cita el
 * inicio del partido. Existe desde el 0' (en vivo, también).
 */
function condicionesDelPartido(p: Partido, c: Ctx): Borrador[] {
  const k = p.config.condiciones;
  const inicio = c.ev.find((e) => e.tipo === "inicio_periodo");
  if (!k || !inicio) return [];
  const conTemp = k.temperaturaC !== undefined;
  const clima = conTemp ? { es: `${temperaturaTxt(k.temperaturaC as number)} °C`, en: `${temperaturaTxt(k.temperaturaC as number)} °C` } : (CLIMA_TEXTO[k.clima] as { es: string; en: string });
  const cancha = CANCHA_TEXTO[k.superficie === "sintetica" ? "sintetica" : `natural_${k.cesped}`] as { es: string; en: string };
  const pl = PRESION_TEXTO[k.presion.local] as { es: string; en: string };
  const pv = PRESION_TEXTO[k.presion.visita] as { es: string; en: string };
  return [
    hecho(c, "condiciones_del_partido", "condiciones_del_partido", [inicio.id], {
      ...equipos(c),
      clima: k.clima,
      ...(conTemp ? { temperatura_c: k.temperaturaC as number } : {}),
      superficie: k.superficie,
      ...(k.cesped ? { cesped: k.cesped } : {}),
      presion_local: k.presion.local,
      presion_visita: k.presion.visita,
      clima_es: clima.es,
      clima_en: clima.en,
      cancha_es: cancha.es,
      cancha_en: cancha.en,
      presion_local_es: pl.es,
      presion_local_en: pl.en,
      presion_visita_es: pv.es,
      presion_visita_en: pv.en,
    }),
  ];
}

/** `efecto_calor`: SOLO con calor registrado Y la caída medida en ESTE partido (desglose por periodo). */
function efectoCalor(p: Partido, c: Ctx, m: MicroPartido): Borrador[] {
  const x = medirCalor(p, m);
  if (!x || !x.efecto) return [];
  return [
    hechoMicro("efecto_calor", "efecto_calor", inicios(c), {
      ...equipos(c),
      temperatura_c: x.temperaturaC,
      periodo: 2,
      pases_primer_tiempo: x.pases1,
      pases_segundo_tiempo: x.pases2,
      porcentaje: x.porcentaje,
    }),
  ];
}

/** `cancha_incomoda`: SOLO con césped natural alto Y la completación corta del visitante bajo umbral. */
function canchaIncomoda(p: Partido, c: Ctx, m: MicroPartido): Borrador[] {
  const x = medirCancha(p, m);
  if (!x || !x.efecto) return [];
  return [
    hechoMicro("cancha_incomoda", "cancha_incomoda", inicios(c), {
      ...equipos(c),
      equipo: c.nombre.visita,
      cesped: "alto",
      porcentaje: x.porcentaje,
      completados: x.completados,
      intentados: x.intentados,
      porcentaje_local: x.porcentajeLocal,
      completados_local: x.completadosLocal,
      intentados_local: x.intentadosLocal,
    }),
  ];
}

/** `presion_que_ahoga`: SOLO con presión alta Y sus pérdidas tempranas en salida sobre el umbral. Cita esas pérdidas. */
function presionQueAhoga(p: Partido, c: Ctx, m: MicroPartido): Borrador[] {
  const x = medirPresion(p, m);
  if (!x || !x.efecto) return [];
  return [hechoMicro("presion_que_ahoga", "presion_que_ahoga", x.ids, { ...equipos(c), equipo: c.nombre[x.lado], presion: "alta", perdidas: x.ids.length, limite: x.limite })];
}

// ---------------- brief 025: los insólitos ----------------

function insolitos(p: Partido, c: Ctx, m: MicroPartido): Borrador[] {
  const out: Borrador[] = [];
  for (const g of c.goles) {
    if (g.ev.definicion !== "olimpico") continue;
    out.push(
      hecho(c, "gol_olimpico", "gol_olimpico", [g.ev.relacionadoCon, g.ev.id], {
        ...equipos(c),
        jugador: g.ev.jugador ?? "",
        equipo: c.nombre[g.ev.equipo],
        minuto: minutoTxt(g.ev.minuto),
        definicion: "olimpico",
        marcador_local: g.marcador.local,
        marcador_visita: g.marcador.visita,
      }),
    );
  }
  c.ev.forEach((e, i) => {
    if (e.tipo === "subida_portero" && e.jugador) {
      // el remate de su córner (si lo hubo) y su gol
      const corner = c.ev[i + 1];
      const tiro = c.ev.slice(i + 2).find((x, k) => x.tipo === "tiro" && x.jugador === e.jugador && c.ev.slice(i + 2, i + 2 + k).every((y) => !["tiro", "corner", "pase_clave", "fuera_de_juego"].includes(y.tipo)));
      const gol = tiro ? c.ev.find((x) => x.tipo === "gol" && x.relacionadoCon === tiro.id) : undefined;
      out.push(
        hecho(c, "subida_portero", gol ? "subida_portero_gol" : tiro ? "subida_portero_remate" : "subida_portero", [e.id, corner?.id, tiro?.id, gol?.id], {
          jugador: e.jugador,
          equipo: c.nombre[e.equipo],
          minuto: minutoTxt(e.minuto),
          remate: tiro ? "si" : "no",
          gol: gol ? "si" : "no",
        }),
      );
    }
    if (e.tipo === "tiro" && e.alPalo !== undefined && e.jugador) {
      out.push(hecho(c, "doble_palo", e.alPalo === 2 ? "doble_palo" : "al_palo", [e.id], { jugador: e.jugador, equipo: c.nombre[e.equipo], minuto: minutoTxt(e.minuto), palos: e.alPalo }));
    }
    if (e.tipo === "interrupcion" && e.causa && e.duracion !== undefined) {
      const t = CAUSA_TEXTO[e.causa] as { es: string; en: string };
      out.push(hecho(c, "interrupcion", "interrupcion", [e.id], { minuto: minutoTxt(e.minuto), duracion: e.duracion, causa: e.causa, causa_es: t.es, causa_en: t.en }));
    }
  });
  const niebla = medirNiebla(p, m);
  if (niebla?.efecto) out.push(hechoMicro("efecto_niebla", "efecto_niebla", inicios(c), { ...equipos(c), completados: niebla.completados, intentados: niebla.intentados, porcentaje: niebla.porcentaje }));
  return out;
}

// ---------------- brief 026: la grada ----------------

/** `ole_de_la_grada`: cada racha del olé (src/analista/grada.ts). Cita los pases de la racha (micro, contrato del 013). */
function oleDeLaGrada(p: Partido, c: Ctx, m: MicroPartido): Borrador[] {
  return rachasOle(p, m).map((r) =>
    hechoMicro("ole_de_la_grada", "ole_de_la_grada", r.pases.map((x) => x.id), {
      equipo: c.nombre[r.equipo],
      pases: r.pases.length,
      minuto: minutoTxt((r.pases[r.pases.length - 1] as MicroPartido["eventos"][number]).minuto),
    }),
  );
}

// ---------------- brief 019: consecuencias ----------------

/** `lesion_en_partido`: cada lesión del partido (cita la lesión, su cambio forzado y la falta, si la hubo). */
function lesiones(c: Ctx): Borrador[] {
  const out: Borrador[] = [];
  c.ev.forEach((e, i) => {
    if (e.tipo !== "lesion" || !e.jugador || e.baja === undefined) return;
    const cambio = c.ev[i + 1]?.tipo === "cambio" ? c.ev[i + 1] : undefined;
    const falta = e.relacionadoCon ? c.porId.get(e.relacionadoCon) : undefined;
    const j = jornadasTxt(e.baja);
    out.push(
      hecho(c, "lesion_en_partido", falta?.jugador ? "lesion_falta" : "lesion", [e.id, cambio?.id, falta?.id], {
        jugador: e.jugador,
        equipo: c.nombre[e.equipo],
        minuto: minutoTxt(e.minuto),
        jornadas: e.baja,
        baja_es: j.es,
        baja_en: j.en,
        ...(falta?.jugador ? { infractor: falta.jugador } : {}),
      }),
    );
  });
  return out;
}

/** `bajas_del_partido`: las bajas que el registro de la temporada trae a este partido (por equipo). */
function bajasDelPartido(p: Partido, c: Ctx): Borrador[] {
  const inicio = c.ev.find((e) => e.tipo === "inicio_periodo");
  if (!inicio) return [];
  const out: Borrador[] = [];
  for (const lado of LADOS) {
    const bs = p.config.bajas?.[lado] ?? [];
    if (bs.length === 0) continue;
    const l = listaBajas(bs);
    out.push(
      hecho(c, "bajas_del_partido", "bajas_del_partido", [inicio.id], {
        equipo: c.nombre[lado],
        bajas: bs.length,
        suspendidos: bs.filter((b) => b.motivo === "suspension").length,
        lesionados: bs.filter((b) => b.motivo === "lesion").length,
        lista_es: l.es,
        lista_en: l.en,
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
    ...autogoles(c),
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
  // Brief 018: presion_que_ahoga subsume a perdidas_en_salida del MISMO equipo.
  const presionAlta = medirPresion(partido, m);
  const subsumidos = new Set<Lado>(presionAlta?.efecto ? [presionAlta.lado] : []);
  borradores.push(...duelos(c, m), ...perdidasEnSalida(c, m, subsumidos), ...dominioGlobal(c, m), ...dominioPorCanal(c, m));
  // Brief 018: solo si el partido registra condiciones (los partidos sueltos no las tienen).
  // Brief 025: los insólitos (solo con la variante) y el efecto medido de la niebla.
  borradores.push(...insolitos(partido, c, m));
  borradores.push(...oleDeLaGrada(partido, c, m));
  // Brief 019: lesiones (solo con la variante) y las bajas del registro (solo partidos de liga).
  borradores.push(...lesiones(c), ...bajasDelPartido(partido, c));
  borradores.push(...condicionesDelPartido(partido, c), ...efectoCalor(partido, c, m), ...canchaIncomoda(partido, c, m), ...presionQueAhoga(partido, c, m));
  borradores.sort(comparar(c, m));
  return borradores.map((b, i) => ({ id: `h${String(i + 1).padStart(2, "0")}`, ...b }));
}
