"use client";

// Brief 049 · Panel «Cifras del partido» (al estilo de un «Top Stats» de transmisión): una fila
// por ESTADISTICAS_ARENA.filasPanel, el lado que lidera resaltado y dos barras por fila. Todo
// sale del prefijo ≤ tick (en vivo siguiendo el cursor) y, al final, «Cifras finales».
import { capacidades, cifrasEquipos, destacados, ETIQUETAS_CIFRAS, memoAgregado, noSimulada, pasesIntentados, type Cifra, type FilaPanel, type MemoAgregado } from "../arena/estadisticas";
import type { RegistroArena } from "../arena/tipos";
import { ARENA, ESTADISTICAS_ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const PORCENTAJE: ReadonlySet<string> = new Set(["posesion_pct", "precision_pase"]);

/** Revisión Codex (049) · Límites del muestreo, condicionados por lo que simula el registro: hasta
 * dónde llegan los fotogramas, el descarte conservador de la distancia en intervalos con reinicio y
 * el balón parado (pausas con entrenadores, saques con reglas de reinicios; sin ninguno de los dos,
 * el tiempo del ejecutor sí cuenta como posesión). */
export function notaMuestreo(registro: RegistroArena, cubiertoHastaTick: number, idioma: "es" | "en"): string {
  const es = idioma === "es", s = (cubiertoHastaTick * ARENA.pasoS).toFixed(1), seg = es ? s.replace(".", ",") : s;
  const { faltas: pausas, reinicios: saques } = capacidades(registro);
  const base = es
    ? `Distancia, velocidad y posesión cubren hasta el último fotograma (${seg} s). La distancia descarta los intervalos con un reinicio: subestima el recorrido de forma conservadora.`
    : `Distance, speed and possession cover up to the last frame (${seg} s). Distance skips intervals containing a restart, a conservative underestimate.`;
  const parado = pausas && saques
    ? es ? " El balón parado (pausas y saques) no se atribuye a ningún equipo." : " A stopped ball (pauses and restarts) is not attributed to either team."
    : pausas
      ? es ? " Las pausas no se atribuyen; este registro no tiene saques reglamentarios, así que el tiempo del portero que reanuda sí cuenta como posesión." : " Pauses are not attributed; this recording has no regulation restarts, so the goalkeeper's restart time does count as possession."
      : es ? " Este registro no tiene pausas ni saques: el tiempo del ejecutor sí cuenta como posesión." : " This recording has no pauses or restarts: the taker's time does count as possession.";
  return base + parado;
}

/** Ancho (%) de la barra de un lado: el valor para los porcentajes; si no, su parte del total. */
export function anchoBarra(fila: Pick<FilaPanel, "clave" | "local" | "visita">, lado: Lado): number {
  const v = fila[lado].valor ?? 0;
  if (v <= 0) return 0;
  const bruto = PORCENTAJE.has(fila.clave) ? v : 100 * v / ((fila.local.valor ?? 0) + (fila.visita.valor ?? 0));
  return Math.min(100, Math.max(ESTADISTICAS_ARENA.barraMinPct, Math.round(bruto * 10) / 10));
}

export function ArenaCifras({ registro, tick, idioma, favorito, memo = memoAgregado }: {
  registro: RegistroArena; tick: number; idioma: "es" | "en"; favorito: Lado | null; memo?: MemoAgregado;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const cifras = cifrasEquipos(registro, tick, memo), intentos = pasesIntentados(registro, tick, memo);
  const vacio = memo(registro, tick).eventosPrefijo === 0;
  const valor = (c: Cifra, clave: string, lado: Lado) => {
    if (c.valor === null) return "—";
    if (PORCENTAJE.has(clave)) return es ? `${c.valor} %` : `${c.valor}%`;
    if (clave === "pases_completados") return <>{c.valor}<small> / {intentos[lado]}</small></>;
    return String(c.valor);
  };
  const nombres = registro.config.partido;
  return <section className="arena-stats" data-testid="arena-stats" aria-label={t("Match stats", "Cifras del partido")} data-final={cifras.final || undefined} data-tick={tick}>
    <div className="arena-stats-head">
      <p className="overline">{cifras.final ? t("Final stats", "Cifras finales") : t("Match stats · live", "Cifras del partido · en vivo")}</p>
      <span className="arena-stats-clock tnum">{reloj(tick * ARENA.pasoS)}</span>
    </div>
    <div className="arena-stats-teams">
      {(["local", "visita"] as const).map(lado => <span key={lado} data-side={lado} data-favorite={favorito === lado || undefined}>{nombres[lado].nombre}</span>)}
    </div>
    {vacio ? <p className="arena-empty">{t("Waiting for kick-off", "Esperando el inicio")}</p> : <div className="arena-stats-rows">
      {cifras.filas.map(f => {
        const nota = noSimulada(registro, f.clave);
        return <div key={f.clave} className="arena-stat-row" data-stat={f.clave} data-leader={f.lider ?? "none"} data-class={f.clase}>
          {(["local", "visita"] as const).map(lado => <span key={lado} className="arena-stat-value tnum" data-side={lado} data-lead={f.lider === lado || undefined} data-favorite={favorito === lado || undefined}>{valor(f[lado], f.clave, lado)}</span>)}
          <span className="arena-stat-label">{ETIQUETAS_CIFRAS[f.clave][idioma]}{nota && <small className="arena-stat-note">{t("not simulated in this recording", "no simulado en este registro")}</small>}</span>
          <span className="arena-stat-bars" aria-hidden="true">
            {(["local", "visita"] as const).map(lado => <span key={lado} className="arena-stat-track" data-side={lado}><span className="arena-stat-bar" data-side={lado} style={{ width: `${anchoBarra(f, lado)}%` }} /></span>)}
          </span>
        </div>;
      })}
    </div>}
    {cifras.final && !vacio && <Destacados registro={registro} tick={tick} idioma={idioma} memo={memo} />}
    <div className="arena-stats-foot">
      <p className="arena-muted arena-stats-legend"><span data-class="registrada">{t("Recorded", "Registrado")}</span>: {t("counted from engine events and frames.", "contado a partir de los eventos y fotogramas del motor.")} <span data-class="estimada">{t("Estimated", "Estimado")}</span>: {t("geometric index from each shot's distance and angle to goal; it orders shots and is not a probability or a calibrated model.", "índice geométrico según la distancia y el ángulo de cada remate al arco; ordena remates, no es una probabilidad ni un modelo calibrado.")}</p>
      <p className="arena-muted">{notaMuestreo(registro, cifras.cubiertoHastaTick, idioma)}</p>
      {!vacio && <details><summary>{t("Inspect events", "Consultar eventos")}</summary><dl className="arena-stats-evidence">{cifras.filas.map(f => <div key={f.clave}><dt>{ETIQUETAS_CIFRAS[f.clave][idioma]}</dt><dd>{(["local", "visita"] as const).map(lado => {
        const ev = f[lado].evidencia;
        return <span key={lado}>{nombres[lado].nombre}: {ev.eventos.length ? ev.eventos.join(" · ") : ev.fuente === "fotogramas" ? t(`frames 0–${(ev.intervalo![1] * ARENA.pasoS).toFixed(1)} s`, `fotogramas 0–${(ev.intervalo![1] * ARENA.pasoS).toFixed(1)} s`) : "—"}</span>;
      })}</dd></div>)}</dl></details>}
    </div>
  </section>;
}

const ROTULO_DESTACADO = {
  remates_directos: { es: "Más remates a puerta", en: "Most shots on target" },
  recuperaciones: { es: "Más balones recuperados", en: "Most balls recovered" },
  distancia_m: { es: "Más distancia recorrida", en: "Most distance covered" },
} as const;
/** Brief 049 § 4.2 (nivel 3) · Destacados del final, con nombre, dorsal, club y cifra. */
function Destacados({ registro, tick, idioma, memo }: { registro: RegistroArena; tick: number; idioma: "es" | "en"; memo: MemoAgregado }) {
  const lista = destacados(registro, tick, memo);
  if (!lista.length) return null;
  const plantilla = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []];
  return <div className="arena-stats-highlights" data-testid="arena-stats-highlights">
    <p className="overline">{idioma === "es" ? "Destacados" : "Highlights"}</p>
    <ul>{lista.map(d => { const j = plantilla.find(p => p.id === d.jugador)!; return <li key={d.clave} data-stat={d.clave} data-side={d.lado}>
      <span>{ROTULO_DESTACADO[d.clave][idioma]}</span><strong>{j.nombre} · {j.dorsal} · {registro.config.partido[d.lado].nombre}</strong><span className="tnum">{d.valor}{d.clave === "distancia_m" ? " m" : ""}</span>
    </li>; })}</ul>
  </div>;
}
