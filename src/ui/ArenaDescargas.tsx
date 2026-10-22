"use client";
import type { ComentarioArena } from "../arena/narrador";
import type { IntervencionArena } from "../arena/protocolo";
import type { RegistroArena } from "../arena/tipos";
import { construirTranscripcion, finalDelPrefijo, nombreDescarga, relojTranscripcion, transcripcionJson, transcripcionMarkdown } from "../arena/transcripcion";

/** Mismo patrón que «Download run»: Blob + ObjectURL + <a download> + revokeObjectURL. */
export function descargarBlob(nombre: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a"); enlace.href = url; enlace.download = nombre;
  enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Brief 053 · «Descargar comentarios»: transcripción de lo publicado hasta el reloj visible
 * (`hastaTick` = tick entero del cursor en todas las vistas). Se construye en el momento del clic:
 * nada se precalcula ni se memoiza, y no hay ninguna petición de red. */
export function ArenaDescargas({ registro, comentarios, intervenciones, sesion, hastaTick, enCurso, idioma, sinPartido }: {
  registro: RegistroArena; comentarios: readonly ComentarioArena[]; intervenciones: readonly IntervencionArena[]; sesion: string | null;
  hastaTick: number; enCurso: boolean; idioma: "es" | "en"; sinPartido: boolean;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const corte = Math.max(0, Math.min(hastaTick, registro.final.tick));
  const parcial = !finalDelPrefijo(registro, corte);
  const reloj = relojTranscripcion(corte);
  const descargar = (formato: "md" | "json") => {
    const transcripcion = construirTranscripcion({ registro, comentarios, intervenciones, sesion, generado: new Date().toISOString() }, corte, idioma);
    const blob = formato === "md"
      ? new Blob([transcripcionMarkdown(transcripcion)], { type: "text/markdown;charset=utf-8" })
      : new Blob([transcripcionJson(transcripcion)], { type: "application/json" });
    descargarBlob(nombreDescarga(transcripcion, formato), blob);
  };
  return <section className="arena-intelligence arena-downloads" data-testid="arena-downloads" aria-label="Descargas de la transmisión / Broadcast downloads" data-partial={parcial ? "true" : "false"} data-until-tick={corte}>
    <h2>{t("Download commentary", "Descargar comentarios")}</h2>
    <p className="arena-muted" id="arena-downloads-help">{enCurso
      ? t(`Transcript of the broadcast published so far, up to the visible clock: ${reloj}. Each line carries its time, voice, evidence and checks.`, `Transcripción de la transmisión publicada hasta ahora, hasta el reloj visible: ${reloj}. Cada línea lleva su tiempo, voz, evidencia y verificación.`)
      : t(`Transcript of the broadcast up to the visible clock: ${reloj}. Move the match time to the end to download the whole match. Each line carries its time, voice, evidence and checks.`, `Transcripción de la transmisión hasta el reloj visible: ${reloj}. Lleva el tiempo de juego al final para descargar el partido entero. Cada línea lleva su tiempo, voz, evidencia y verificación.`)}</p>
    <div className="arena-downloads-actions">
      <button className="btn" disabled={sinPartido} aria-describedby="arena-downloads-help" onClick={() => descargar("md")}>{t("Download commentary (Markdown)", "Descargar comentarios (Markdown)")}</button>
      <button className="btn" disabled={sinPartido} aria-describedby="arena-downloads-help" onClick={() => descargar("json")}>{t("Download commentary (JSON)", "Descargar comentarios (JSON)")}</button>
    </div>
    <p className="arena-muted">{t("The complete run (JSON) is downloaded under “Saved matches” when the match ends.", "El registro completo (JSON) se descarga en “Partidos guardados” al terminar el partido.")}</p>
  </section>;
}
