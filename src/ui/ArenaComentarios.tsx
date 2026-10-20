import type { ComentarioArena } from "../arena/narrador";
import { ARENA } from "../sim/limites";

export function ArenaComentarios({ comentarios, tick, idioma, compacto = false }: { comentarios: ComentarioArena[]; tick: number; idioma: "es" | "en"; compacto?: boolean }) {
  const es = idioma === "es", visibles = comentarios.filter(c => c.tick <= tick).slice(compacto ? -1 : -3);
  if (!visibles.length && !compacto) return null;
  return <section className="arena-intelligence" aria-label={es ? "Comentarios verificados" : "Verified commentary"}>
    <h2>{es ? "Comentario del narrador" : "Narrator commentary"}</h2>
    {!visibles.length && <p>{es ? "Los comentarios aparecerán al confirmarse las jugadas. Su evidencia estará disponible aquí." : "Commentary will appear as play is confirmed, with its evidence here."}</p>}
    {visibles.map(c => <article key={`${c.tick}:${c.principal}`}>
      <p className="arena-muted">{(c.tick * ARENA.pasoS).toFixed(1)} s · {c.modo === "llm" ? "IA / AI" : es ? "Respaldo por plantilla" : "Template fallback"} · {c.modelo}</p>
      {c.oraciones.map((o, i) => <p key={i}>{es ? o.texto_es : o.texto_en}</p>)}
      <details><summary>{es ? "Consultar hechos y verificaciones" : "Inspect facts and checks"}</summary>
        {c.hechos.filter(h => c.oraciones.some(o => o.hecho === h.id)).map(h => <p key={h.id}><strong>{h.eventos.join(" · ")}</strong> · {es ? h.texto_es : h.texto_en}</p>)}
        {c.audit.map(a => <p key={a.intento}>{es ? "Intento" : "Attempt"} {a.intento}: {a.motivos.length ? a.motivos.map(m => `${m.regla}: ${m.detalle}`).join(" · ") : es ? "aprobado por las reglas V1–V8" : "passed the V1–V8 rules"}</p>)}
      </details>
    </article>)}
    <p className="arena-muted">{es ? "El comentario identifica el instante que describe; puede llegar con demora. Las reglas comprueban citas, datos y patrones mantenidos, sin certificar toda afirmación posible." : "Each comment identifies the moment it describes and may arrive later. Checks cover citations, data and maintained claim patterns, rather than every possible assertion."}</p>
  </section>;
}
