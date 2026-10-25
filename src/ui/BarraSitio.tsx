"use client";
// Brief 064 § 3.1 (D1) · La única barra del sitio: CRONISTA · Arena · Torneo · ES/EN, en la arena, el torneo, la crónica
// de un partido de la arena y las rutas heredadas. Reutiliza las reglas Z1 del 047 (`topbar arena-topbar`). La marca
// lleva a la arena; no hay «Match reports», «League mode» ni «Data» en la barra.

import Link from "./Enlace";
import { EmblemaCronista } from "./Emblema";

export type SeccionSitio = "arena" | "torneo" | null;

/** Pura, para pruebas: los tres destinos con el `lang` aplicado. */
export function enlacesSitio(idioma: "es" | "en"): { marca: string; arena: string; torneo: string } {
  const q = idioma === "es" ? "?lang=es" : "";
  return { marca: `/arena${q}`, arena: `/arena${q}`, torneo: `/arena/torneo${q}` };
}

export function BarraSitio({ idioma, alCambiarIdioma, seccion }: { idioma: "es" | "en"; alCambiarIdioma: () => void; seccion: SeccionSitio }) {
  const es = idioma === "es";
  const destino = enlacesSitio(idioma);
  return <header className="topbar arena-topbar" lang={idioma}>
    <Link href={destino.marca} className="brand" prefetch={false}><EmblemaCronista /><span className="brand-mark">CRONISTA</span><span className="brand-tag">{es ? "Agentes de fútbol con evidencia" : "Football agents with evidence"}</span></Link>
    <nav className="topbar-links" aria-label={es ? "Secciones" : "Sections"}>
      <Link href={destino.arena} prefetch={false} data-testid="arena-link" aria-current={seccion === "arena" ? "page" : undefined}>Arena</Link>
      <Link href={destino.torneo} prefetch={false} data-testid="torneo-link" aria-current={seccion === "torneo" ? "page" : undefined}>{es ? "Torneo" : "Tournament"}</Link>
      <button type="button" className="btn" onClick={alCambiarIdioma} aria-label={es ? "Cambiar a inglés" : "Switch to Spanish"}>{es ? "EN" : "ES"}</button>
    </nav>
  </header>;
}
