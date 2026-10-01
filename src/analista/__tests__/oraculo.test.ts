// ORÁCULO INDEPENDIENTE del Analista — revisión 2.3 del brief 002.
//
// REGLA DE INDEPENDENCIA: este archivo NO importa `analista.ts` ni `textos.ts`.
// Solo usa la función pública `analizar` (vía `../index`), los tipos, los umbrales
// (que son especificación, no implementación) y el simulador. Todo lo demás —
// marcador tras cada gol, penal, dominio solo con ofensivos, redondeo de xG,
// ventanas de presión, portero en el arco, minutos de disciplina, doble amarilla vs
// directa, desenlace de remontada— se RECALCULA aquí desde los eventos, por otro
// camino, y se compara contra la salida de `analizar`. Una prueba propia vigila que
// esta regla no se rompa.
//
// Punto de partida: el oráculo con el que la auditoría adversaria verificó las
// semillas 1..5000. Agregados: completitud (qué hechos DEBEN existir), `datos`
// exactos, secuencia de cifras que cada texto debe decir y nombres propios.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Lado, Partido } from "../../sim/tipos";
import { FIXTURES } from "../__fixtures__/partidos";
import { analizar } from "../index";
import type { Hecho, TipoHecho } from "../tipos";
import * as U from "../umbrales";

type Datos = Record<string, string | number>;

interface Esperado {
  tipo: TipoHecho;
  eventos: string[];
  datos: Datos;
  /** Cifras que el texto debe decir, en orden (ES y EN). */
  cifras: string[];
  /** Nombres propios que el texto debe nombrar (y ningún otro). */
  nombres: string[];
  claveRelevancia: U.ClaveRelevancia;
}

const LADOS: Lado[] = ["local", "visita"];
const otro = (l: Lado): Lado => (l === "local" ? "visita" : "local");
const mt = (m: number) => (m > 90 ? `90+${m - 90}` : String(m));
const x2 = (c: number) => (c / 100).toFixed(2);
const cen = (x?: number) => Math.round((x ?? 0) * 100);
const cifrasDe = (t: string) => t.match(/\d+(?:\.\d+)?/g) ?? [];

/** Recalcula, desde los eventos, todos los hechos que el partido debe producir. */
function esperados(p: Partido): Map<string, Esperado> {
  const ev = p.eventos;
  const idx = new Map(ev.map((e, i) => [e.id, i] as const));
  const by = new Map(ev.map((e) => [e.id, e] as const));
  const I = (e: Evento) => idx.get(e.id) as number;
  const orden = (ids: (string | undefined)[]) =>
    [...new Set(ids.filter((x): x is string => x !== undefined))].sort((a, b) => (idx.get(a) as number) - (idx.get(b) as number));
  const segundo = ev.findIndex((e, i) => e.tipo === "inicio_periodo" && i > 0);
  const per = (e: Evento): 1 | 2 => (segundo >= 0 && I(e) >= segundo ? 2 : 1);
  const goles = ev.filter((e) => e.tipo === "gol");
  const marcadorTras = (i: number) => {
    const m = { local: 0, visita: 0 };
    for (const g of goles) if (I(g) <= i) m[g.equipo]++;
    return m;
  };
  const nombre = { local: p.config.local.nombre, visita: p.config.visita.nombre };
  const fines = ev.filter((e) => e.tipo === "fin_periodo");
  const finFinal = fines[fines.length - 1] as Evento;
  const final = marcadorTras(ev.length);
  const out = new Map<string, Esperado>();
  const poner = (clave: string, e: Omit<Esperado, "claveRelevancia"> & { claveRelevancia?: U.ClaveRelevancia }) =>
    out.set(clave, { claveRelevancia: e.tipo as U.ClaveRelevancia, ...e });

  // resultado_final
  poner("resultado_final", {
    tipo: "resultado_final",
    eventos: orden([...goles.map((g) => g.id), finFinal.id]),
    datos: {
      local: nombre.local,
      visita: nombre.visita,
      goles_local: final.local,
      goles_visita: final.visita,
      ganador: final.local > final.visita ? "local" : final.local < final.visita ? "visita" : "empate",
    },
    cifras: [String(final.local), String(final.visita)],
    nombres: [nombre.local, nombre.visita],
  });

  // marcador_por_periodo
  fines.slice(0, 2).forEach((fin, k) => {
    const P = k + 1;
    const gp = goles.filter((g) => per(g) === P);
    const m = marcadorTras(I(fin));
    const gl = gp.filter((g) => g.equipo === "local").length;
    const gv = gp.filter((g) => g.equipo === "visita").length;
    poner(`marcador_por_periodo|${P}`, {
      tipo: "marcador_por_periodo",
      eventos: orden([...gp.map((g) => g.id), fin.id]),
      datos: { local: nombre.local, visita: nombre.visita, periodo: P, goles_local_periodo: gl, goles_visita_periodo: gv, marcador_local: m.local, marcador_visita: m.visita },
      cifras: P === 1 ? [String(m.local), String(m.visita)] : [String(gl), String(gv), String(m.local), String(m.visita)],
      nombres: [nombre.local, nombre.visita],
    });
  });

  // gol_anotado, gol_temprano, gol_tardio
  for (const g of goles) {
    const tiro = by.get(g.relacionadoCon ?? "") as Evento;
    const m = marcadorTras(I(g));
    const xg = x2(cen(tiro.xg));
    poner(`gol_anotado|${g.id}`, {
      tipo: "gol_anotado",
      eventos: orden([tiro.id, g.id]),
      datos: {
        local: nombre.local,
        visita: nombre.visita,
        jugador: g.jugador as string,
        equipo: nombre[g.equipo],
        minuto: mt(g.minuto),
        xg,
        penal: tiro.penal === true ? "si" : "no",
        marcador_local: m.local,
        marcador_visita: m.visita,
      },
      cifras: [...cifrasDe(mt(g.minuto)), xg, String(m.local), String(m.visita)],
      nombres: [g.jugador as string, nombre.local, nombre.visita],
    });
    const tipo: TipoHecho | undefined =
      g.minuto < U.GOL_TEMPRANO_ANTES_DE ? "gol_temprano" : g.minuto > U.GOL_TARDIO_DESPUES_DE ? "gol_tardio" : undefined;
    if (tipo) {
      poner(`${tipo}|${g.id}`, {
        tipo,
        eventos: [g.id],
        datos: { jugador: g.jugador as string, equipo: nombre[g.equipo], minuto: mt(g.minuto) },
        cifras: cifrasDe(mt(g.minuto)),
        nombres: [g.jugador as string, nombre[g.equipo]],
      });
    }
  }

  // doblete_o_mas
  for (const lado of LADOS) {
    const porJugador = new Map<string, Evento[]>();
    for (const g of goles.filter((x) => x.equipo === lado)) porJugador.set(g.jugador as string, [...(porJugador.get(g.jugador as string) ?? []), g]);
    for (const [jugador, gs] of porJugador) {
      if (gs.length < U.DOBLETE_MIN_GOLES) continue;
      const minutos = gs.map((g) => mt(g.minuto)).join(", ");
      poner(`doblete_o_mas|${lado}|${jugador}`, {
        tipo: "doblete_o_mas",
        eventos: orden(gs.map((g) => g.id)),
        datos: { jugador, equipo: nombre[lado], goles: gs.length, minutos },
        // "doblete"/"triplete" no dicen el número; 4+ goles sí.
        cifras: [...(gs.length > 3 ? [String(gs.length)] : []), ...cifrasDe(minutos)],
        nombres: [jugador, nombre[lado]],
      });
    }
  }

  // remontada
  for (const lado of LADOS) {
    let peor = 0;
    let k = -1;
    goles.forEach((g, j) => {
      const m = marcadorTras(I(g));
      if (m[lado] - m[otro(lado)] < peor) {
        peor = m[lado] - m[otro(lado)];
        k = j;
      }
    });
    const dFinal = final[lado] - final[otro(lado)];
    if (k < 0 || dFinal < 0) continue;
    const gk = goles[k] as Evento;
    const mk = marcadorTras(I(gk));
    const desenlace = dFinal > 0 ? "victoria" : "empate";
    poner(`remontada|${lado}`, {
      tipo: "remontada",
      eventos: orden([...goles.slice(0, k + 1).filter((g) => g.equipo !== lado).map((g) => g.id), ...goles.slice(k + 1).map((g) => g.id)]),
      datos: {
        equipo: nombre[lado],
        rival: nombre[otro(lado)],
        desventaja_max: -peor,
        minuto_desventaja: mt(gk.minuto),
        desventaja_propios: mk[lado],
        desventaja_rival: mk[otro(lado)],
        final_propios: final[lado],
        final_rival: final[otro(lado)],
        desenlace,
      },
      cifras: [String(mk[lado]), String(mk[otro(lado)]), ...cifrasDe(mt(gk.minuto)), String(final[lado]), String(final[otro(lado)])],
      nombres: [nombre[lado], nombre[otro(lado)]],
      claveRelevancia: desenlace === "victoria" ? "remontada_victoria" : "remontada_empate",
    });
  }

  // dominio_periodo — SOLO acciones ofensivas
  for (const P of [1, 2]) {
    const of = ev.filter((e) => per(e) === P && (e.tipo === "tiro" || e.tipo === "corner" || e.tipo === "pase_clave"));
    if (of.length === 0) continue;
    for (const lado of LADOS) {
      const pr = of.filter((e) => e.equipo === lado);
      if (pr.length * 100 < U.DOMINIO_PORCENTAJE_MIN * of.length) continue;
      const pct = Math.round((pr.length * 1000) / of.length) / 10;
      poner(`dominio_periodo|${P}|${lado}`, {
        tipo: "dominio_periodo",
        eventos: pr.map((e) => e.id),
        datos: { equipo: nombre[lado], periodo: P, acciones_equipo: pr.length, acciones_total: of.length, porcentaje: pct },
        cifras: [String(pr.length), String(of.length), String(pct)],
        nombres: [nombre[lado]],
      });
    }
  }

  // presion_sostenida — ventanas codiciosas sin solape, dentro del periodo
  for (const lado of LADOS) {
    for (const P of [1, 2]) {
      const tiros = ev.filter((e) => e.tipo === "tiro" && e.equipo === lado && per(e) === P);
      let a = 0;
      while (a < tiros.length) {
        let b = a;
        while (b + 1 < tiros.length && (tiros[b + 1] as Evento).minuto - (tiros[a] as Evento).minuto <= U.PRESION_VENTANA_MINUTOS) b++;
        const g = tiros.slice(a, b + 1);
        const xs = g.reduce((s, e) => s + cen(e.xg), 0);
        if (g.length >= U.PRESION_TIROS_MIN && xs >= U.PRESION_XG_MIN_CENTESIMAS) {
          const desde = mt((g[0] as Evento).minuto);
          const hasta = mt((g[g.length - 1] as Evento).minuto);
          poner(`presion_sostenida|${(g[0] as Evento).id}`, {
            tipo: "presion_sostenida",
            eventos: g.map((e) => e.id),
            datos: { equipo: nombre[lado], tiros: g.length, desde, hasta, xg: x2(xs) },
            cifras: [String(g.length), ...cifrasDe(desde), ...cifrasDe(hasta), x2(xs)],
            nombres: [nombre[lado]],
          });
          a = b + 1;
        } else a++;
      }
    }
  }

  // justicia_xg
  {
    const tiros = ev.filter((e) => e.tipo === "tiro");
    const xg = { local: 0, visita: 0 };
    for (const t of tiros) xg[t.equipo] += cen(t.xg);
    const gan: Lado | undefined = final.local > final.visita ? "local" : final.local < final.visita ? "visita" : undefined;
    const contra = gan !== undefined && xg[gan] < xg[otro(gan)];
    const datos: Datos = {
      local: nombre.local,
      visita: nombre.visita,
      goles_local: final.local,
      goles_visita: final.visita,
      xg_local: x2(xg.local),
      xg_visita: x2(xg.visita),
      contra_la_corriente: contra ? "si" : "no",
    };
    if (contra && gan) Object.assign(datos, { ganador: nombre[gan], xg_ganador: x2(xg[gan]), xg_perdedor: x2(xg[otro(gan)]) });
    poner("justicia_xg", {
      tipo: "justicia_xg",
      eventos: tiros.length > 0 ? tiros.map((t) => t.id) : [finFinal.id],
      datos,
      cifras:
        contra && gan
          ? [x2(xg[gan]), x2(xg[otro(gan)]), String(final.local), String(final.visita)]
          : [String(final.local), x2(xg.local), String(final.visita), x2(xg.visita)],
      nombres: [nombre.local, nombre.visita],
    });
  }

  // portero_destacado — el portero en el arco se sigue aquí por separado
  {
    const pos = new Map<string, string>();
    for (const l of LADOS) for (const j of p.config[l].jugadores) pos.set(`${l}|${j.nombre}`, j.posicion);
    const arco: Record<Lado, string | undefined> = {
      local: p.config.local.jugadores.slice(0, 11).find((j) => j.posicion === "POR")?.nombre,
      visita: p.config.visita.jugadores.slice(0, 11).find((j) => j.posicion === "POR")?.nombre,
    };
    const quien = new Map<string, string | undefined>(); // id de atajada → portero que la hizo
    for (const e of ev) {
      if (e.tipo === "atajada") quien.set(e.id, arco[otro(e.equipo)]);
      if (e.tipo === "cambio") {
        if (e.sale === arco[e.equipo]) arco[e.equipo] = e.jugador;
        else if (arco[e.equipo] === undefined && pos.get(`${e.equipo}|${e.jugador}`) === "POR") arco[e.equipo] = e.jugador;
      }
      if (e.tipo === "tarjeta_roja" && e.jugador === arco[e.equipo]) arco[e.equipo] = undefined;
    }
    for (const defensor of LADOS) {
      const at = ev.filter((e) => e.tipo === "atajada" && e.equipo === otro(defensor));
      const xs = at.reduce((s, e) => s + cen(by.get(e.relacionadoCon ?? "")?.xg), 0);
      if (at.length < U.PORTERO_ATAJADAS_MIN && xs < U.PORTERO_XG_ATAJADO_MIN_CENTESIMAS) continue;
      const quienes = at.map((e) => quien.get(e.id));
      const conocidos = quienes.every((n) => n !== undefined);
      const porteros = [...new Set(quienes.filter((n): n is string => n !== undefined))];
      const datos: Datos = { equipo: nombre[defensor], atajadas: at.length, xg_atajado: x2(xs) };
      if (conocidos) datos.portero = porteros.join(" / ");
      poner(`portero_destacado|${defensor}`, {
        tipo: "portero_destacado",
        eventos: orden(at.flatMap((e) => [e.id, e.relacionadoCon])),
        datos,
        cifras: [String(at.length), x2(xs)],
        nombres: [...(conocidos ? porteros : []), nombre[defensor]],
      });
    }
  }

  // expulsion_y_efecto
  for (const r of ev.filter((e) => e.tipo === "tarjeta_roja")) {
    const i = I(r);
    const previa = ev.slice(0, i).find((a) => a.tipo === "tarjeta_amarilla" && a.equipo === r.equipo && a.jugador === r.jugador);
    const m = marcadorTras(i);
    const despues = goles.filter((g) => I(g) > i);
    const dl = despues.filter((g) => g.equipo === "local").length;
    const dv = despues.filter((g) => g.equipo === "visita").length;
    poner(`expulsion_y_efecto|${r.id}`, {
      tipo: "expulsion_y_efecto",
      eventos: orden([r.relacionadoCon, r.id, previa?.id, ...despues.map((g) => g.id)]),
      datos: {
        local: nombre.local,
        visita: nombre.visita,
        jugador: r.jugador as string,
        equipo: nombre[r.equipo],
        minuto: mt(r.minuto),
        motivo: previa ? "doble_amarilla" : "roja_directa",
        marcador_local: m.local,
        marcador_visita: m.visita,
        goles_despues_local: dl,
        goles_despues_visita: dv,
        goles_local: final.local,
        goles_visita: final.visita,
      },
      cifras: [...cifrasDe(mt(r.minuto)), String(m.local), String(m.visita), String(dl), String(dv)],
      nombres: [r.jugador as string, nombre.local, nombre.visita],
    });
  }

  // figura_del_partido (brief 009) — la valoración se RECALCULA aquí, por otro camino, con
  // los pesos de U.VALORACION (especificación) y el portero en el arco seguido aparte.
  {
    const C = (x: number) => Math.round(x * 100);
    const V = U.VALORACION;
    const plantilla = (l: Lado) => p.config[l].jugadores;
    const pos = new Map<string, string>();
    for (const l of LADOS) for (const j of plantilla(l)) pos.set(`${l}|${j.nombre}`, j.posicion);
    const arco: Record<Lado, string | undefined> = {
      local: plantilla("local").slice(0, 11).find((j) => j.posicion === "POR")?.nombre,
      visita: plantilla("visita").slice(0, 11).find((j) => j.posicion === "POR")?.nombre,
    };
    const suma = new Map<string, number>(); // lado|nombre → centésimas sumadas
    const golesC = new Map<string, number>(); // delta positivo de goles
    const citados = new Map<string, string[]>();
    const jugo = new Set<string>();
    for (const l of LADOS) if (arco[l]) jugo.add(`${l}|${arco[l]}`);
    const sumar = (l: Lado, n: string | undefined, e: Evento, c: number, deGol = false) => {
      if (!n) return;
      const k = `${l}|${n}`;
      jugo.add(k);
      suma.set(k, (suma.get(k) ?? 0) + c);
      if (deGol) golesC.set(k, (golesC.get(k) ?? 0) + c);
      citados.set(k, [...(citados.get(k) ?? []), e.id]);
    };
    const atajado = new Set(ev.filter((e) => e.tipo === "atajada").map((e) => e.relacionadoCon));
    for (const e of ev) {
      if (e.jugador) jugo.add(`${e.equipo}|${e.jugador}`);
      const def = otro(e.equipo);
      if (e.tipo === "gol") {
        sumar(e.equipo, e.jugador, e, C(V.gol), true);
        if (cen(e.xg) < C(V.gol_dificil_xg_max)) sumar(e.equipo, e.jugador, e, C(V.gol_dificil), true);
        sumar(def, arco[def], e, C(V.gol_recibido));
      }
      if (e.tipo === "tiro" && atajado.has(e.id)) sumar(e.equipo, e.jugador, e, C(V.tiro_atajado));
      if (e.tipo === "atajada") {
        sumar(def, arco[def], e, C(V.atajada));
        const x = Math.round(cen(by.get(e.relacionadoCon ?? "")?.xg) * V.xg_atajado_factor);
        if (x !== 0) sumar(def, arco[def], e, x);
      }
      if (e.tipo === "pase_clave") sumar(e.equipo, e.jugador, e, C(V.pase_clave));
      if (e.tipo === "corner") sumar(e.equipo, e.jugador, e, C(V.corner));
      if (e.tipo === "tarjeta_amarilla") sumar(e.equipo, e.jugador, e, C(V.amarilla));
      if (e.tipo === "tarjeta_roja") sumar(e.equipo, e.jugador, e, C(V.roja));
      if (e.tipo === "falta") sumar(e.equipo, e.jugador, e, C(V.falta));
      if (e.tipo === "fuera_de_juego") sumar(e.equipo, e.jugador, e, C(V.fuera_de_juego));
      // portero en el arco DESPUÉS de este evento
      if (e.tipo === "cambio") {
        if (e.sale !== undefined && e.sale === arco[e.equipo]) arco[e.equipo] = e.jugador;
        else if (arco[e.equipo] === undefined && pos.get(`${e.equipo}|${e.jugador}`) === "POR") arco[e.equipo] = e.jugador;
      }
      if (e.tipo === "tarjeta_roja" && e.jugador === arco[e.equipo]) arco[e.equipo] = undefined;
    }
    const nota = (k: string) => Math.min(C(V.max) / 10, Math.max(C(V.min) / 10, Math.round((C(V.base) + (suma.get(k) ?? 0)) / 10))) / 10;
    const candidatos = [...jugo].map((k) => {
      const [l, n] = k.split("|") as [Lado, string];
      return { k, l, n, nota: nota(k), goles: golesC.get(k) ?? 0, i: plantilla(l).findIndex((j) => j.nombre === n) };
    });
    candidatos.sort((a, b) => b.nota - a.nota || b.goles - a.goles || a.i - b.i || (a.l === b.l ? 0 : a.l === "local" ? -1 : 1));
    const top = candidatos[0];
    if (top && (citados.get(top.k) ?? []).length > 0) {
      const n = top.nota.toFixed(1);
      poner(`figura_del_partido|${top.l}`, {
        tipo: "figura_del_partido",
        eventos: orden(citados.get(top.k) as string[]),
        datos: { jugador: top.n, equipo: nombre[top.l], nota: n },
        cifras: [n],
        nombres: [top.n],
      });
    }
  }

  // disciplina
  for (const lado of LADOS) {
    const am = ev.filter((e) => e.tipo === "tarjeta_amarilla" && e.equipo === lado);
    if (am.length < U.DISCIPLINA_AMARILLAS_MIN) continue;
    const minutos = am.map((e) => mt(e.minuto)).join(", ");
    poner(`disciplina|${lado}`, {
      tipo: "disciplina",
      eventos: am.map((e) => e.id),
      datos: { equipo: nombre[lado], amarillas: am.length, minutos },
      cifras: [String(am.length), ...cifrasDe(minutos)],
      nombres: [nombre[lado]],
    });
  }
  return out;
}

/** Clave con la que se empareja un hecho emitido con su esperado (solo desde el contrato). */
function claveDe(p: Partido, h: Hecho): string {
  const by = new Map(p.eventos.map((e) => [e.id, e] as const));
  const lado = (n: unknown): string => (n === p.config.local.nombre ? "local" : n === p.config.visita.nombre ? "visita" : `?${String(n)}`);
  const citado = (tipo: string) => h.eventos.find((id) => by.get(id)?.tipo === tipo) ?? "?";
  switch (h.tipo) {
    case "resultado_final":
    case "justicia_xg":
      return h.tipo;
    case "marcador_por_periodo":
      return `${h.tipo}|${h.datos.periodo}`;
    case "gol_anotado":
    case "gol_temprano":
    case "gol_tardio":
      return `${h.tipo}|${citado("gol")}`;
    case "doblete_o_mas":
      return `${h.tipo}|${by.get(citado("gol"))?.equipo ?? "?"}|${h.datos.jugador}`;
    case "dominio_periodo":
      return `${h.tipo}|${h.datos.periodo}|${lado(h.datos.equipo)}`;
    case "presion_sostenida":
      return `${h.tipo}|${h.eventos[0]}`;
    case "expulsion_y_efecto":
      return `${h.tipo}|${citado("tarjeta_roja")}`;
    default:
      return `${h.tipo}|${lado(h.datos.equipo)}`;
  }
}

/** Nombres propios del partido que aparecen en un texto (los más largos primero, sin solapes). */
function nombresEn(p: Partido, t: string): string[] {
  const todos = [p.config.local.nombre, p.config.visita.nombre, ...p.config.local.jugadores.map((j) => j.nombre), ...p.config.visita.jugadores.map((j) => j.nombre)].sort(
    (a, b) => b.length - a.length,
  );
  const vistos: string[] = [];
  let resto = t;
  for (const n of todos) {
    if (resto.includes(n)) {
      vistos.push(n);
      resto = resto.split(n).join("\u0000");
    }
  }
  return vistos.sort();
}

/**
 * Atribución en el texto: cada aparición «Jugador (Equipo)» —y «A / B (Equipo)» de
 * los porteros— debe emparejar al jugador con SU equipo. El conjunto de nombres no
 * basta: un texto de gol nombra a los dos equipos en el marcador, así que «Juan
 * (Rival)» pasaría un control por conjunto.
 */
function atribucionesFalsas(p: Partido, t: string): string[] {
  const err: string[] = [];
  const equipoDe = new Map<string, string>();
  for (const l of LADOS) for (const j of p.config[l].jugadores) equipoDe.set(j.nombre, p.config[l].nombre);
  const equipos = new Set([p.config.local.nombre, p.config.visita.nombre]);
  for (const m of t.matchAll(/([^()]+?) \(([^()]+)\)/g)) {
    const equipo = (m[2] as string).trim();
    if (!equipos.has(equipo)) continue; // paréntesis que no nombran un equipo (p. ej. «(minutos …)»)
    // El tramo antes del paréntesis puede ser «A / B» (porteros) o una frase que termina en el jugador.
    const tramo = (m[1] as string).split(/[;:,.]/).pop() as string;
    for (const parte of tramo.split(" / ")) {
      const jugador = [...equipoDe.keys()].filter((n) => parte.trim().endsWith(n)).sort((a, b) => b.length - a.length)[0];
      if (jugador !== undefined && equipoDe.get(jugador) !== equipo) err.push(`«${jugador} (${equipo})»: ${jugador} juega en ${equipoDe.get(jugador)}`);
    }
  }
  return err;
}

/** Compara la salida de `analizar` contra el oráculo. Devuelve las discrepancias. */
function oraculo(p: Partido, hs: Hecho[]): string[] {
  const err: string[] = [];
  const esp = esperados(p);
  const vistos = new Set<string>();
  const ev = p.eventos;
  const idx = new Map(ev.map((e, i) => [e.id, i] as const));
  for (const h of hs) {
    const clave = claveDe(p, h);
    const pre = `${h.id} ${clave}`;
    if (vistos.has(clave)) err.push(`${pre}: hecho duplicado`);
    vistos.add(clave);
    const e = esp.get(clave);
    if (!e) {
      err.push(`${pre}: hecho que el oráculo no esperaba`);
      continue;
    }
    if (h.tipo !== e.tipo) err.push(`${pre}: tipo ${h.tipo} ≠ ${e.tipo}`);
    if (h.eventos.join() !== e.eventos.join()) err.push(`${pre}: eventos [${h.eventos.join()}] ≠ [${e.eventos.join()}]`);
    if (JSON.stringify(sortKeys(h.datos)) !== JSON.stringify(sortKeys(e.datos)))
      err.push(`${pre}: datos ${JSON.stringify(sortKeys(h.datos))} ≠ ${JSON.stringify(sortKeys(e.datos))}`);
    if (h.relevancia !== U.RELEVANCIA[e.claveRelevancia]) err.push(`${pre}: relevancia ${h.relevancia} ≠ ${U.RELEVANCIA[e.claveRelevancia]}`);
    for (const [lengua, t] of [["es", h.texto_es], ["en", h.texto_en]] as const) {
      const c = cifrasDe(t).join(" ");
      if (c !== e.cifras.join(" ")) err.push(`${pre}: texto_${lengua} dice [${c}], debe decir [${e.cifras.join(" ")}]`);
      const n = nombresEn(p, t).join(" | ");
      const nEsp = [...new Set(e.nombres)].sort().join(" | ");
      if (n !== nEsp) err.push(`${pre}: texto_${lengua} nombra [${n}], debe nombrar [${nEsp}]`);
      for (const a of atribucionesFalsas(p, t)) err.push(`${pre}: texto_${lengua} atribuye mal ${a}`);
    }
  }
  for (const clave of esp.keys()) if (!vistos.has(clave)) err.push(`falta el hecho ${clave}`);

  // Orden: relevancia descendente; a igualdad, minuto y luego posición del evento definitorio.
  const definitorio = (h: Hecho) => {
    const id = h.eventos.find((x) => ev[idx.get(x) ?? -1]?.tipo === U.DESEMPATE_EVENTO[h.tipo]) ?? h.eventos[0];
    const i = idx.get(id as string) ?? 0;
    return { minuto: ev[i]?.minuto ?? 0, i };
  };
  for (let k = 1; k < hs.length; k++) {
    const a = hs[k - 1] as Hecho;
    const b = hs[k] as Hecho;
    if (a.relevancia < b.relevancia) err.push(`${b.id}: orden de relevancia roto`);
    else if (a.relevancia === b.relevancia) {
      const da = definitorio(a);
      const db = definitorio(b);
      if (da.minuto > db.minuto || (da.minuto === db.minuto && da.i > db.i)) err.push(`${b.id}: desempate cronológico roto (${a.tipo} vs ${b.tipo})`);
    }
  }
  return err;
}

function sortKeys(d: Datos): Datos {
  return Object.fromEntries(Object.entries(d).sort(([a], [b]) => a.localeCompare(b)));
}

// ---------------- pruebas ----------------

const CORPUS = 1000;
const SEMILLA_AUDITORIA = 497; // la semilla con la que la auditoría delató el borde de justicia_xg
const partidos: Partido[] = Array.from({ length: CORPUS }, (_, i) => simular(configDeSemilla(i + 1)));
const analisis = partidos.map((p) => analizar(p));

describe("oráculo independiente (rev. 2.3)", () => {
  it("regla de independencia: este archivo no importa analista.ts ni textos.ts", () => {
    const fuente = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const importes = [...fuente.matchAll(/^import[^;]*from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(importes.filter((x) => /\/(analista|textos)(\.ts)?$/.test(x ?? ""))).toEqual([]);
    expect(importes).toContain("../index");
  });

  it("el detector de atribuciones funciona (si no, el control no protege nada)", () => {
    const p = partidos[0] as Partido;
    const [L, V] = [p.config.local, p.config.visita];
    const jl = (L.jugadores[9] as { nombre: string }).nombre;
    const pl = (L.jugadores[0] as { nombre: string }).nombre;
    const pv = (V.jugadores[0] as { nombre: string }).nombre;
    expect(atribucionesFalsas(p, `${jl} (${L.nombre}) marcó; ${L.nombre} 1–0 ${V.nombre}.`)).toEqual([]);
    expect(atribucionesFalsas(p, `${jl} (${V.nombre}) marcó; ${L.nombre} 1–0 ${V.nombre}.`)).toHaveLength(1);
    expect(atribucionesFalsas(p, `${pl} / ${pv} (${L.nombre}) hizo 7 atajadas.`)).toHaveLength(1);
    expect(atribucionesFalsas(p, `${L.nombre} recibió 4 tarjetas amarillas (minutos 3, 9).`)).toEqual([]);
  });

  it(`corpus 1..${CORPUS}: cada hecho coincide con el recálculo (completitud, eventos, datos, cifras, nombres, orden)`, () => {
    const fallas = partidos.flatMap((p, i) => oraculo(p, analisis[i] as Hecho[]).map((e) => `seed ${p.config.seed} ${e}`));
    expect(fallas.slice(0, 15)).toEqual([]);
  });

  it(`semilla ${SEMILLA_AUDITORIA} (explícita)`, () => {
    const p = simular(configDeSemilla(SEMILLA_AUDITORIA));
    expect(oraculo(p, analizar(p))).toEqual([]);
  });

  it.each(Object.keys(FIXTURES))("fixture %s: coincide con el oráculo", (nombre) => {
    const { partido } = FIXTURES[nombre as keyof typeof FIXTURES]();
    expect(oraculo(partido, analizar(partido))).toEqual([]);
  });
});

describe("paridad ES/EN sobre el corpus (rev. 2.3)", () => {
  it("los dígitos de texto_es y texto_en son idénticos y en el mismo orden", () => {
    const fallas: string[] = [];
    partidos.forEach((p, i) => {
      for (const h of analisis[i] as Hecho[]) {
        const es = cifrasDe(h.texto_es).join(" ");
        const en = cifrasDe(h.texto_en).join(" ");
        if (es !== en) fallas.push(`seed ${p.config.seed} ${h.id}: [${es}] vs [${en}]`);
      }
    });
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("los nombres propios son los mismos en ES y EN y cada jugador pertenece al equipo que dice el hecho", () => {
    const fallas: string[] = [];
    partidos.forEach((p, i) => {
      const plantilla = (equipo: unknown) =>
        equipo === p.config.local.nombre ? p.config.local.jugadores : equipo === p.config.visita.nombre ? p.config.visita.jugadores : [];
      const equipos = new Set([p.config.local.nombre, p.config.visita.nombre]);
      for (const h of analisis[i] as Hecho[]) {
        const es = nombresEn(p, h.texto_es);
        const en = nombresEn(p, h.texto_en);
        if (es.join("|") !== en.join("|")) fallas.push(`seed ${p.config.seed} ${h.id}: nombres ES ≠ EN`);
        const delEquipo = new Set(plantilla(h.datos.equipo).map((j) => j.nombre));
        for (const n of es) {
          if (equipos.has(n)) continue;
          if (!delEquipo.has(n)) fallas.push(`seed ${p.config.seed} ${h.id} ${h.tipo}: ${n} no es de ${String(h.datos.equipo)}`);
        }
      }
    });
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("no hay palabras con mayúscula fuera del vocabulario fijo de las plantillas (ningún nombre inventado)", () => {
    // Vocabulario capitalizado que las plantillas usan al inicio de frase.
    const VOCABULARIO = new Set(["Resultado", "Full", "Al", "Half", "Segundo", "Second", "Goles", "Goals", "El", "The", "En", "In"]);
    const raros = new Map<string, string>();
    partidos.forEach((p, i) => {
      const todos = [p.config.local.nombre, p.config.visita.nombre, ...p.config.local.jugadores.map((j) => j.nombre), ...p.config.visita.jugadores.map((j) => j.nombre)].sort(
        (a, b) => b.length - a.length,
      );
      for (const h of analisis[i] as Hecho[]) {
        for (const t of [h.texto_es, h.texto_en]) {
          let r = t;
          for (const n of todos) r = r.split(n).join(" ");
          for (const w of r.match(/(?<![\p{L}])\p{Lu}\p{L}*/gu) ?? []) if (!VOCABULARIO.has(w)) raros.set(w, `seed ${p.config.seed} ${h.id}: ${t}`);
        }
      }
    });
    expect([...raros.entries()].slice(0, 5)).toEqual([]);
  });
});
