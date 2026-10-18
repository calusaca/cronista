"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useAvisoCarga } from "./Actividad";

export function DescargaMuestra({ href, children }: { href: string; children: ReactNode }) {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const peticion = useRef<AbortController | null>(null);
  useEffect(() => () => { peticion.current?.abort(); }, []);
  useAvisoCarga(cargando, "Preparing download…", "Fetching the dataset sample. Your download will start when it is ready.");

  async function descargar(ev: MouseEvent<HTMLAnchorElement>) {
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    if (peticion.current) return;
    const controller = new AbortController();
    peticion.current = controller;
    setCargando(true);
    setResultado(null);
    setError(false);
    try {
      const respuesta = await fetch(href, { signal: controller.signal });
      if (!respuesta.ok) throw new Error("download failed");
      const blob = await respuesta.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = href.split("/").pop()!;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResultado("Download started. Check your browser’s downloads.");
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      peticion.current = null;
      if (!controller.signal.aborted) setCargando(false);
    }
  }

  return <>
    <a className="btn btn-primary datos-descarga" href={href} download data-testid="sample-download" onClick={descargar} aria-disabled={cargando || undefined} aria-busy={cargando}>
      {cargando ? "Preparing download…" : children}
    </a>
    <p className="ratings-note" role="status" aria-live="polite" data-testid="download-status">{resultado}</p>
    {error && <p role="alert" className="work-error" data-testid="download-error">Could not download the sample. Select Download to try again.</p>}
  </>;
}
