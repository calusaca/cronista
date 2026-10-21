import type { ReactNode } from "react";
import type { ComentarioArena } from "../arena/narrador";
import type { IntervencionArena, RolMesa } from "../arena/protocolo";
import { ARENA, MESA_ARENA } from "../sim/limites";

/** Brief 045 · Mesa de transmisión: la última intervención de cada rol NO posterior al
 * cursor visible. Los comentarios LLM del narrador siguen siendo textuales. */
export function ArenaMesa({ comentarios, intervenciones, tick, idioma }: { comentarios: readonly ComentarioArena[]; intervenciones: readonly IntervencionArena[]; tick: number; idioma: "es" | "en" }) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const rotulo: Record<RolMesa, string> = { narrador: t("play-by-play", "relato"), comentarista: t("analysis with cited facts", "análisis con hechos citados"), estadista: t("match data", "dato del partido") };
  const modo = (m: "llm" | "plantilla" | "determinista") => m === "llm" ? "IA / AI" : m === "plantilla" ? t("Template fallback", "Respaldo por plantilla") : t("Deterministic", "Determinista");
  const instante = (n: number) => `${(n * ARENA.pasoS).toFixed(1)} s`;
  const procedencia = (p: { eventos: readonly string[]; intervalo?: readonly [number, number]; fuente?: string } | undefined) => !p ? "" : [
    p.eventos.join(" · "), p.intervalo ? `${t("interval", "intervalo")} ${instante(p.intervalo[0])}–${instante(p.intervalo[1])}${p.fuente ? ` · ${p.fuente}` : ""}` : "",
  ].filter(Boolean).join(" · ");
  const narrador = comentarios.filter(c => c.tick <= tick).at(-1);
  const ultima = (rol: Exclude<RolMesa, "narrador">) => intervenciones.filter(i => i.rol === rol && i.tick <= tick).sort((a, b) => a.tick - b.tick).at(-1);
  const auditoria = (audit: ComentarioArena["audit"]) => audit.map(a => <p key={a.intento}>{t("Attempt", "Intento")} {a.intento}: {a.motivos.length ? a.motivos.map(m => `${m.regla}: ${m.detalle}`).join(" · ") : t("passed the V1–V8 rules", "aprobado por las reglas V1–V8")}</p>);
  const tarjeta = (rol: RolMesa, contenido: ReactNode) => <article key={rol} className="arena-mesa-card" data-mesa-role={rol} data-testid={`arena-mesa-${rol}`}>
    <h3>{MESA_ARENA.nombres[idioma][rol]} <span className="arena-muted">· {rotulo[rol]}</span></h3>
    {contenido}
  </article>;
  const invitado = (rol: Exclude<RolMesa, "narrador">) => {
    const i = ultima(rol);
    if (!i) return tarjeta(rol, <p className="arena-muted">{rol === "comentarista" ? t("The analysis will appear in a calm moment, citing confirmed facts.", "El análisis aparecerá en un momento de calma, citando hechos confirmados.") : t("Match data will appear here as it changes.", "Los datos del partido aparecerán aquí cuando cambien.")}</p>);
    return tarjeta(rol, <div data-intervencion={i.id} data-intervencion-tick={i.tick}>
      <p className="arena-muted" data-testid={`arena-mesa-${rol}-modo`}>{instante(i.tick)} · {modo(i.modo)}{i.modelo && i.modo === "llm" ? ` · ${i.modelo}` : ""}</p>
      {i.oraciones.map((o, k) => <p key={k}>{es ? o.texto_es : o.texto_en}</p>)}
      <details><summary>{t("Inspect facts and checks", "Consultar hechos y verificaciones")}</summary>
        {i.oraciones.map((o, k) => {
          const e = i.evidencia[k];
          // v3.1: por oración, cada hecho citado (principal y apoyos) con su texto; para los datos
          // del estadista, su procedencia (intervalo y fuente) tomada de `evidencia.citas`.
          const citados = [...new Set([o.hecho, ...o.apoyo ?? []])];
          return <div key={k} data-oracion={k}>{citados.map(id => {
            const h = i.hechos.find(h => h.id === id);
            const p = e?.citas?.find(c => c.hecho === id) ?? (i.rol === "estadista" ? e : h ? { eventos: h.eventos } : undefined);
            return <p key={id} data-hecho-citado={id}><strong>{procedencia(p) || id}</strong>{h ? ` · ${es ? h.texto_es : h.texto_en}` : ""}</p>;
          })}</div>;
        })}
        {auditoria(i.audit)}
      </details>
    </div>);
  };
  return <section className="arena-intelligence arena-mesa" aria-label={t("Broadcast desk", "Mesa de transmisión")} data-testid="arena-mesa">
    <h2>{t("Broadcast desk", "Mesa de transmisión")}</h2>
    {tarjeta("narrador", narrador ? <div>
      <p className="arena-muted">{instante(narrador.tick)} · {modo(narrador.modo)} · {narrador.modelo}</p>
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
