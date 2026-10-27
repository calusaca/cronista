"use client";
// Brief 064 § 4.10 · «Match report» / «Crónica»: pide (POST) la crónica verificada del partido y abre su página. Una
// sola petición por fuente en todo el documento (mapa de módulo); espera accesible sin porcentajes (032); 429
// `en-curso` con su espera y «Reintentar». Nunca genera nada por adelantado (sin prefetch).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { claveFuente, type FuenteCronica } from "../arena/cronica-vista";
import { CRONICA_ARENA } from "../sim/limites";
import { useAvisoCarga } from "./Actividad";
import { TEXTOS_CRONICA_ARENA as T } from "./textos-cronica-arena";

export interface RespuestaBoton { huella: string; url: string; modo: "llm" | "acta"; provisional: boolean; desdeAlmacen: boolean }
type Resultado = { ok: true; respuesta: RespuestaBoton } | { ok: false; status: number; motivo?: string; retryAfterS?: number };

/** Texto honesto de cada fallo: 429 `en-curso` (otra crónica escribiéndose), `subidas` (admisión por hora de los partidos
 * subidos o jugados aquí: la fuente `{ registro }`), `registros-diarios` (partidos nuevos del día) y el resto. Usa el
 * `retry-after` de la API si lo trae. Exportada para la prueba. */
export function mensajeErrorCronica(r: { status: number; motivo?: string; retryAfterS?: number }, idioma: "es" | "en"): string {
  if (r.status === 429 && r.motivo === "en-curso") return T.ocupado[idioma](r.retryAfterS ?? CRONICA_ARENA.reintentoOcupadoS);
  if (r.status === 429 && r.motivo === "subidas") return T.subidas[idioma](r.retryAfterS);
  if (r.status === 429 && r.motivo === "registros-diarios") return T.registrosDiarios[idioma](r.retryAfterS);
  return T.fallo[idioma];
}

const enCurso = new Map<string, Promise<Resultado>>();
const enCursoRegistro = new WeakMap<object, Promise<Resultado>>();

async function pedir(fuente: FuenteCronica, signal: AbortSignal): Promise<Resultado> {
  try {
    const r = await fetch("/api/arena/cronicas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fuente), signal });
    const cuerpo = await r.json().catch(() => ({})) as { motivo?: string } & Partial<RespuestaBoton>;
    if (r.ok && typeof cuerpo.url === "string") return { ok: true, respuesta: cuerpo as RespuestaBoton };
    const espera = Number(r.headers.get("retry-after"));
    return { ok: false, status: r.status, ...(cuerpo.motivo ? { motivo: cuerpo.motivo } : {}), ...(Number.isFinite(espera) && espera > 0 ? { retryAfterS: espera } : {}) };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Una petición por fuente en el documento: si ya hay una en vuelo para la misma fuente, se comparte. Exportada para
 * la prueba (dos pulsaciones o dos botones del mismo partido = un solo POST). */
export function pedirUnaVez(fuente: FuenteCronica): Promise<Resultado> {
  const registro = "registro" in fuente && fuente.registro && typeof fuente.registro === "object" ? fuente.registro : null;
  const previa = registro ? enCursoRegistro.get(registro) : enCurso.get(claveFuente(fuente));
  if (previa) return previa;
  const p = pedir(fuente, AbortSignal.timeout(CRONICA_ARENA.plazoClienteMs)).finally(() => {
    if (registro) enCursoRegistro.delete(registro); else enCurso.delete(claveFuente(fuente));
  });
  if (registro) enCursoRegistro.set(registro, p); else enCurso.set(claveFuente(fuente), p);
  return p;
}

export function BotonCronica({ fuente, idioma, variante = "boton" }: { fuente: FuenteCronica; idioma: "es" | "en"; variante?: "boton" | "enlace" }) {
  const router = useRouter();
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<{ texto: string } | null>(null);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useAvisoCarga(pendiente, T.esperaTitulo[idioma], T.esperaDetalle[idioma]);
  const pulsar = async () => {
    if (pendiente) return;
    setPendiente(true); setError(null);
    const r = await pedirUnaVez(fuente);
    if (!vivo.current) return;
    if (r.ok) {
      router.push(`${r.respuesta.url}${idioma === "es" ? "?lang=es" : ""}`);
      return;
    }
    setPendiente(false);
    setError({ texto: mensajeErrorCronica(r, idioma) });
  };
  return <div className={`arena-cronica-boton${variante === "enlace" ? " arena-cronica-boton-enlace" : ""}`} lang={idioma}>
    <button type="button" className={variante === "enlace" ? "btn btn-quiet" : "btn btn-primary"} data-testid="arena-cronica" onClick={() => void pulsar()} disabled={pendiente} aria-describedby={variante === "boton" ? "arena-cronica-nota" : undefined}>
      {T.boton[idioma]}
    </button>
    {variante === "boton" && <span className="arena-muted" id="arena-cronica-nota">{T.botonNota[idioma]}</span>}
    {error && <p className="arena-cronica-error" role="alert" data-testid="arena-cronica-error">{error.texto} <button type="button" className="btn" onClick={() => void pulsar()}>{T.reintentar[idioma]}</button></p>}
  </div>;
}
