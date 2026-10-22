"use client";

// Brief 049 § 4.1 · Cifras en vivo del jugador seleccionado (prefijo ≤ tick), con la evidencia de
// cada cifra como botones de salto cuando el transporte está habilitado.
import type { ReactNode } from "react";
import { acumuladoDe, cifrasJugador, ETIQUETAS_CIFRAS, memoAgregado, noSimulada, type ClaveCifraJugador, type MemoAgregado } from "../arena/estadisticas";
import type { JugadorArena, RegistroArena } from "../arena/tipos";
import { notaMuestreo } from "./ArenaCifras";
import { ARENA, ESTADISTICAS_ARENA } from "../sim/limites";

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ArenaCifrasJugador({ registro, tick, jugador, idioma, transporte, saltar, memo = memoAgregado }: {
  registro: RegistroArena; tick: number; jugador: Pick<JugadorArena, "id" | "puesto">; idioma: "es" | "en";
  transporte: boolean; saltar?: (s: number) => void; memo?: MemoAgregado;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const { cifras, cubiertoHastaTick } = cifrasJugador(registro, tick, jugador.id, memo);
  const desvios = acumuladoDe(memo(registro, tick), jugador.id).desvios.length;
  const v = (k: ClaveCifraJugador) => cifras[k].valor;
  const txt = (k: ClaveCifraJugador, sufijo = "") => v(k) === null ? "—" : `${v(k)}${sufijo}`;
  const etiqueta = (k: ClaveCifraJugador) => ETIQUETAS_CIFRAS[k][idioma];
  const nota = <small>{t("not simulated in this recording", "no simulado en este registro")}</small>;
  const porSegundos = (n: number) => es ? String(n).replace(".", ",") : String(n);
  const filas: { clave: ClaveCifraJugador; dt: string; dd: ReactNode }[] = [
    { clave: "goles", dt: etiqueta("goles"), dd: txt("goles") },
    ...v("autogoles") ? [{ clave: "autogoles" as const, dt: etiqueta("autogoles"), dd: txt("autogoles") }] : [],
    { clave: "remates", dt: etiqueta("remates"), dd: <>{txt("remates")}<small>{t(`${v("remates_directos")} on target · ${v("remates_indirectos")} off target or blocked`, `${v("remates_directos")} directos (a puerta) · ${v("remates_indirectos")} indirectos (fuera o bloqueados)`)}{v("remates_pendientes") ? t(` · still in play: ${v("remates_pendientes")}`, ` · en juego: ${v("remates_pendientes")}`) : ""}</small></> },
    { clave: "pases_completados", dt: t("Passes completed / attempted", "Pases completados / intentados"), dd: <>{txt("pases_completados")} / {txt("pases")}<small>{t("Accuracy", "Precisión")} {v("precision_pase") === null ? "—" : es ? `${v("precision_pase")} %` : `${v("precision_pase")}%`}{v("distancia_media_pase") !== null ? ` · ${t("average", "media")} ${v("distancia_media_pase")} m` : ""}{v("centros") ? ` · ${v("centros")} ${t("crosses", "centros")}` : ""}</small></> },
    { clave: "recuperaciones", dt: etiqueta("recuperaciones"), dd: txt("recuperaciones") },
    { clave: "perdidas", dt: etiqueta("perdidas"), dd: txt("perdidas") },
    { clave: "faltas_cometidas", dt: t("Fouls committed / suffered", "Faltas cometidas / recibidas"), dd: noSimulada(registro, "faltas_cometidas") ? <>—{nota}</> : `${txt("faltas_cometidas")} / ${txt("faltas_recibidas")}` },
    ...v("amarillas") ? [{ clave: "amarillas" as const, dt: etiqueta("amarillas"), dd: txt("amarillas") }] : [],
    ...v("rojas") ? [{ clave: "rojas" as const, dt: etiqueta("rojas"), dd: txt("rojas") }] : [],
    ...v("fueras_juego") ? [{ clave: "fueras_juego" as const, dt: etiqueta("fueras_juego"), dd: txt("fueras_juego") }] : [],
    ...jugador.puesto === "POR" ? [{ clave: "atajadas" as const, dt: etiqueta("atajadas"), dd: <>{txt("atajadas")}{desvios ? <small>{t(`of which ${desvios} deflected`, `de ellas ${desvios} desvíos`)}</small> : null}</> }] : [],
    { clave: "distancia_m", dt: etiqueta("distancia_m"), dd: txt("distancia_m", " m") },
    { clave: "velocidad_max_kmh", dt: etiqueta("velocidad_max_kmh"), dd: v("velocidad_max_kmh") === null ? "—" : `${porSegundos(v("velocidad_max_kmh")!)} km/h` },
    { clave: "posesion_s", dt: etiqueta("posesion_s"), dd: `${porSegundos(v("posesion_s")!)} s` },
    { clave: "acciones_balon", dt: etiqueta("acciones_balon"), dd: txt("acciones_balon") },
    { clave: "igr", dt: etiqueta("igr"), dd: v("remates") ? (es ? String(v("igr")).replace(".", ",") : String(v("igr"))) : "—" },
  ];
  const conEvidencia = filas.flatMap(f => {
    const claves: ClaveCifraJugador[] = f.clave === "remates" ? ["remates", "remates_directos"] : f.clave === "pases_completados" ? ["pases", "pases_completados"] : f.clave === "faltas_cometidas" ? ["faltas_cometidas", "faltas_recibidas"] : [f.clave];
    return claves.filter(k => cifras[k].evidencia.eventos.length).map(k => ({ clave: k, ids: cifras[k].evidencia.eventos }));
  });
  const tickDe = memo(registro, tick).tickDe;
  return <>
    <dl className="arena-player-stats" data-testid="arena-player-stats" data-tick={tick}>
      {filas.map(f => <div key={f.clave} data-stat={f.clave} data-class={cifras[f.clave].clase}><dt>{f.dt}</dt><dd className="tnum">{f.dd}</dd></div>)}
    </dl>
    {!!conEvidencia.length && <details className="arena-player-evidence"><summary>{t("See the events behind these stats", "Ver los eventos de estas cifras")}</summary>
      {conEvidencia.map(({ clave, ids }) => <p key={clave}><strong>{etiqueta(clave)}</strong>{ids.length > ESTADISTICAS_ARENA.evidenciasVisibles && <span className="arena-muted"> · {t(`last ${ESTADISTICAS_ARENA.evidenciasVisibles} of ${ids.length}`, `últimos ${ESTADISTICAS_ARENA.evidenciasVisibles} de ${ids.length}`)}</span>}<br />
        {ids.slice(-ESTADISTICAS_ARENA.evidenciasVisibles).map(id => { const s = (tickDe.get(id) ?? 0) * ARENA.pasoS; return <button type="button" key={id} className="arena-evidence-link" disabled={!transporte} aria-label={`${t("Go to event", "Ir al evento")} ${id} · ${reloj(s)}`} onClick={() => saltar?.(s)}>{id} · {reloj(s)}</button>; })}
      </p>)}
    </details>}
    <p className="arena-muted arena-player-stats-note">{t(`Stats recorded from the engine's events and frames (sampled every ${ARENA.fotogramaS} s). Distance and speed are sampling approximations.`, `Cifras registradas a partir de los eventos y fotogramas del motor (muestreo cada ${String(ARENA.fotogramaS).replace(".", ",")} s). Distancia y velocidad son aproximaciones por muestreo.`)} {notaMuestreo(registro, cubiertoHastaTick, idioma)}</p>
  </>;
}
