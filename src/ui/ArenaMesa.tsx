import type { ReactNode } from "react";
import type { ComentarioArena } from "../arena/narrador";
import type { IntervencionArena, RolMesa, TurnoMesa } from "../arena/protocolo";
import { ARENA, MESA_ARENA } from "../sim/limites";

type Invitado = Exclude<RolMesa, "narrador">;
/** Aparición de un invitado: su turno en un intercambio (048) o la intervención entera (045). */
type Aparicion = { intervencion: IntervencionArena; rol: Invitado; oraciones: number[]; orden: number };

/** Brief 045 · Mesa de transmisión: la última intervención de cada rol NO posterior al
 * cursor visible. Los comentarios LLM del narrador siguen siendo textuales.
 * Brief 048 · «Última conversación»: los turnos de la variante completa del último intercambio
 * ≤ cursor; las tarjetas de los invitados muestran el último turno de su rol, sea de un
 * intercambio propio o de otro (el dato del estadista en una ronda). */
export function ArenaMesa({ comentarios, intervenciones, tick, idioma }: { comentarios: readonly ComentarioArena[]; intervenciones: readonly IntervencionArena[]; tick: number; idioma: "es" | "en" }) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const rotulo: Record<RolMesa, string> = { narrador: t("play-by-play", "relato"), comentarista: t("analysis with cited facts", "análisis con hechos citados"), estadista: t("match data", "dato del partido") };
  const modo = (m: "llm" | "plantilla" | "determinista") => m === "llm" ? "IA / AI" : m === "plantilla" ? t("Template fallback", "Respaldo por plantilla") : t("Deterministic", "Determinista");
  const instante = (n: number) => `${(n * ARENA.pasoS).toFixed(1)} s`;
  const procedencia = (p: { eventos: readonly string[]; intervalo?: readonly [number, number]; fuente?: string } | undefined) => !p ? "" : [
    p.eventos.join(" · "), p.intervalo ? `${t("interval", "intervalo")} ${instante(p.intervalo[0])}–${instante(p.intervalo[1])}${p.fuente ? ` · ${p.fuente}` : ""}` : "",
  ].filter(Boolean).join(" · ");
  const narrador = comentarios.filter(c => c.tick <= tick).at(-1);
  // Orden estable: por tick y, a igual tick, por orden del diario.
  const hasta = intervenciones.map((i, orden) => ({ i, orden })).filter(x => x.i.tick <= tick).sort((a, b) => a.i.tick - b.i.tick || a.orden - b.orden);
  const apariciones: Aparicion[] = hasta.flatMap(({ i, orden }) => i.turnos?.length
    ? i.turnos.flatMap(turno => turno.rol === "narrador" ? [] : [{ intervencion: i, rol: turno.rol, oraciones: turno.oraciones, orden }])
    : [{ intervencion: i, rol: i.rol, oraciones: i.oraciones.map((_, k) => k), orden }]);
  const ultima = (rol: Invitado) => apariciones.filter(a => a.rol === rol).at(-1);
  const auditoria = (audit: ComentarioArena["audit"]) => audit.map(a => <p key={a.intento}>{t("Attempt", "Intento")} {a.intento}: {a.motivos.length ? a.motivos.map(m => `${m.regla}: ${m.detalle}`).join(" · ") : t("passed the V1–V8 rules", "aprobado por las reglas V1–V8")}</p>);
  // Brief 047: iniciales decorativas derivadas del nombre ficticio existente (no es copy nuevo).
  const iniciales = (nombre: string) => nombre.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const tarjeta = (rol: RolMesa, contenido: ReactNode) => <article key={rol} className="arena-mesa-card" data-mesa-role={rol} data-testid={`arena-mesa-${rol}`}>
    <span className="arena-mesa-avatar" aria-hidden="true">{iniciales(MESA_ARENA.nombres[idioma][rol])}</span>
    <h3>{MESA_ARENA.nombres[idioma][rol]} <span className="arena-muted">· {rotulo[rol]}</span></h3>
    {contenido}
  </article>;
  /** v3.1 · Por oración, cada hecho citado (principal y apoyos) con su texto; para los datos del
   * estadista, su procedencia (intervalo y fuente) tomada de `evidencia.citas`. */
  const citas = (i: IntervencionArena, indices: readonly number[], rol: Invitado) => indices.map(k => {
    const o = i.oraciones[k];
    if (!o) return null;
    const e = i.evidencia[k];
    const citados = [...new Set([o.hecho, ...o.apoyo ?? []])];
    return <div key={k} data-oracion={k}>{citados.map(id => {
      const h = i.hechos.find(h => h.id === id);
      const p = e?.citas?.find(c => c.hecho === id) ?? (rol === "estadista" ? e : h ? { eventos: h.eventos } : undefined);
      return <p key={id} data-hecho-citado={id}><strong>{procedencia(p) || id}</strong>{h ? ` · ${es ? h.texto_es : h.texto_en}` : ""}</p>;
    })}</div>;
  });
  const invitado = (rol: Invitado) => {
    const a = ultima(rol);
    if (!a) return tarjeta(rol, <p className="arena-muted">{rol === "comentarista" ? t("The analysis will appear in a calm moment, citing confirmed facts.", "El análisis aparecerá en un momento de calma, citando hechos confirmados.") : t("Match data will appear here as it changes.", "Los datos del partido aparecerán aquí cuando cambien.")}</p>);
    const i = a.intervencion;
    // El dato del estadista es determinista aunque viaje en una candidatura del comentarista.
    const modoTurno = rol === "estadista" ? "determinista" : i.modo;
    return tarjeta(rol, <div data-intervencion={i.id} data-intervencion-tick={i.tick}>
      <p className="arena-muted arena-mesa-meta" data-testid={`arena-mesa-${rol}-modo`}>{instante(i.tick)} · {modo(modoTurno)}{i.modelo && modoTurno === "llm" ? ` · ${i.modelo}` : ""}</p>
      {a.oraciones.map(k => i.oraciones[k] ? <p key={k}>{es ? i.oraciones[k]!.texto_es : i.oraciones[k]!.texto_en}</p> : null)}
      <details><summary>{t("Inspect facts and checks", "Consultar hechos y verificaciones")}</summary>
        {citas(i, a.oraciones, rol)}
        {rol === i.rol && auditoria(i.audit)}
      </details>
    </div>);
  };
  // 048 · Última conversación: el último intercambio ≤ cursor, solo si tiene turnos.
  const ultimoIntercambio = hasta.at(-1)?.i;
  const turnoDialogo = (i: IntervencionArena, turno: TurnoMesa, k: number) => {
    const nombre = MESA_ARENA.nombres[idioma][turno.rol];
    return <li key={k} data-turno-rol={turno.rol} data-turno-funcion={turno.funcion} className="arena-dialogo-turno">
      <span className="arena-mesa-avatar arena-dialogo-avatar" aria-hidden="true">{iniciales(nombre)}</span>
      <div className="arena-dialogo-cuerpo">
        <p className="arena-dialogo-nombre"><strong>{nombre}</strong></p>
        <p>{es ? turno.texto_es : turno.texto_en}</p>
        <details><summary>{turno.plantilla ? t("Template and reference", "Plantilla y referencia") : t("Cited facts", "Hechos citados")}</summary>
          {turno.plantilla && <p data-plantilla={turno.plantilla}>{t("template", "plantilla")} · <code>{turno.plantilla}</code></p>}
          {(turno.refiere ?? []).map(id => {
            const h = i.hechos.find(h => h.id === id);
            return <p key={id} data-refiere={id}>{t("refers to", "refiere")} · <strong>{id}</strong>{h ? ` · ${es ? h.texto_es : h.texto_en}` : ""}</p>;
          })}
          {turno.rol !== "narrador" && citas(i, turno.oraciones, turno.rol)}
          {!!i.auditDialogo?.escalones.length && <p data-escalones>{t("budget steps", "escalones de presupuesto")} · {i.auditDialogo.escalones.join(" · ")}</p>}
        </details>
      </div>
    </li>;
  };
  return <section className="arena-intelligence arena-mesa" aria-label={t("Broadcast desk", "Mesa de transmisión")} data-testid="arena-mesa">
    <h2>{t("Broadcast desk", "Mesa de transmisión")}</h2>
    {ultimoIntercambio?.turnos?.length ? <div className="arena-dialogo" data-testid="arena-mesa-dialogo" data-dialogo-intervencion={ultimoIntercambio.id} data-dialogo-forma={ultimoIntercambio.forma}>
      <h3>{t("Latest exchange", "Última conversación")} <span className="arena-muted">· {instante(ultimoIntercambio.tick)}</span></h3>
      <ol>{ultimoIntercambio.turnos.map((turno, k) => turnoDialogo(ultimoIntercambio, turno, k))}</ol>
      <p className="arena-muted arena-dialogo-nota">{t("The full exchange is shown; the voice may play its short version when it does not fit before the next play", "Se muestra el intercambio completo; la voz puede emitir su versión breve si no cabe antes de la siguiente jugada")}</p>
    </div> : null}
    {tarjeta("narrador", narrador ? <div>
      <p className="arena-muted arena-mesa-meta">{instante(narrador.tick)} · {modo(narrador.modo)} · {narrador.modelo}</p>
      {narrador.oraciones.map((o, i) => <p key={i}>{es ? o.texto_es : o.texto_en}</p>)}
      <details><summary>{t("Inspect facts and checks", "Consultar hechos y verificaciones")}</summary>
        {narrador.hechos.filter(h => narrador.oraciones.some(o => o.hecho === h.id)).map(h => <p key={h.id}><strong>{h.eventos.join(" · ")}</strong> · {es ? h.texto_es : h.texto_en}</p>)}
        {auditoria(narrador.audit)}
      </details>
    </div> : <p className="arena-muted">{t("Commentary will appear as play is confirmed, with its evidence here.", "Los comentarios aparecerán al confirmarse las jugadas. Su evidencia estará disponible aquí.")}</p>)}
    {invitado("comentarista")}
    {invitado("estadista")}
    <p className="arena-muted">{t("Each card identifies the moment it describes and may arrive later. Checks cover citations, data and maintained claim patterns, rather than the relevance of an analysis.", "Cada tarjeta identifica el instante que describe; puede llegar con demora. Las reglas comprueban citas, datos y patrones mantenidos, sin certificar la pertinencia de un análisis.")}</p>
  </section>;
}
