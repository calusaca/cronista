"use client";

import { useEffect, useState } from "react";
import { narrarEventoArena } from "../arena/vista";
import type { EventoArena, RegistroArena } from "../arena/tipos";
import { ARENA } from "../sim/limites";

const POR_PAGINA = 40;
const reloj = (tick: number) => `${Math.floor(tick * ARENA.pasoS / 60)}:${String(Math.floor(tick * ARENA.pasoS % 60)).padStart(2, "0")}`;
/** Conserva cada evento visible. Paginar no borra ni filtra acciones del registro. */
export function ArenaDescripcion({ eventos, registro, idioma, saltar }: { eventos: EventoArena[]; registro: RegistroArena; idioma: "es" | "en"; saltar: (segundos: number) => void }) {
  const [elegida, setElegida] = useState<number | null>(null);
  useEffect(() => setElegida(null), [registro.inicial]);
  const t = (en: string, es: string) => idioma === "es" ? es : en;
  // Siguiendo el partido se muestran las POR_PAGINA acciones más recientes hasta el reloj (no la
  // última página fija): así una acción inspeccionada desde otro panel sigue visible aunque otras
  // compartan su tick. Al navegar, las páginas son fijas y estables mientras avanza el reloj.
  const siguiendo = elegida === null;
  const ultima = Math.max(0, Math.ceil(eventos.length / POR_PAGINA) - 1), pagina = siguiendo ? ultima : Math.min(elegida, ultima);
  const desde = siguiendo ? Math.max(0, eventos.length - POR_PAGINA) : pagina * POR_PAGINA, visibles = eventos.slice(desde, desde + POR_PAGINA);
  return <section id="arena-description" className="arena-events" aria-label={t("Event narration", "Narración de eventos")} data-testid="arena-description">
    <h2>{t("Complete description", "Descripción completa")}</h2>
    <p className="arena-muted">{t("Every recorded action up to the pitch clock, including attempted passes and their outcomes. This event description remains available independently of the spoken commentary.", "Todas las acciones registradas hasta el reloj de la cancha, incluidos los intentos de pase y sus desenlaces. Esta descripción está disponible independientemente del relato hablado.")}</p>
    {!eventos.length ? <p className="arena-empty">{t("Play or move the timeline to inspect the events.", "Reproduce o avanza en la línea de tiempo para ver los eventos.")}</p> : <>
      <div className="arena-description-controls">
        <button className="btn" disabled={desde === 0} onClick={() => setElegida(siguiendo ? Math.floor((desde - 1) / POR_PAGINA) : pagina - 1)}>{t("Earlier actions", "Acciones anteriores")}</button>
        <output data-testid="arena-description-count">{t(`${desde + 1}–${desde + visibles.length} of ${eventos.length} actions`, `${desde + 1}–${desde + visibles.length} de ${eventos.length} acciones`)}</output>
        <button className="btn" disabled={siguiendo || pagina === ultima} onClick={() => setElegida(pagina + 1)}>{t("Later actions", "Acciones siguientes")}</button>
        <button className="btn" aria-pressed={elegida === null} onClick={() => setElegida(null)}>{t("Follow the match", "Seguir el partido")}</button>
      </div>
      <ol start={desde + 1}>{visibles.map(e => <li key={e.id} data-event-id={e.id} data-event-tick={e.tick}><button onClick={() => saltar(e.tick * ARENA.pasoS)} className="arena-event-time">{reloj(e.tick)}</button><span>{narrarEventoArena(e, registro, idioma)}</span><code>{e.id}</code></li>)}</ol>
    </>}
    <p className="arena-muted">{t("Descriptions use engine-event templates. They do not pass through the recap's V1–V8 verifier.", "Las descripciones usan plantillas de eventos del motor. No pasan por el verificador V1–V8 de la crónica.")}</p>
  </section>;
}
