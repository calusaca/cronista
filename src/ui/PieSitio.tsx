// Brief 064 § 3.4 (D6) · Pie común de la arena, el torneo y la crónica de un partido de la arena: el dataset sintético
// queda a un clic desde todas las páginas. Va después de `</main>`; en la arena hereda los tokens de
// `:root:has(main.arena-shell)`.
import Link from "./Enlace";

export function PieSitio({ idioma }: { idioma: "es" | "en" }) {
  const es = idioma === "es";
  return <footer className="footer arena-footer" lang={idioma} data-testid="site-footer">
    <span>{es ? "Todo partido es simulado; equipos y jugadores son ficticios." : "Every match is simulated; teams and players are fictitious."}</span>
    <span className="arena-footer-enlaces">
      <Link href="/datos" prefetch={false} data-testid="dataset-link">{es ? "Dataset sintético" : "Synthetic dataset"}</Link>
      <Link href="/cronicas" prefetch={false} data-testid="simulator-link">{es ? "Simulador de 90 minutos" : "90-minute simulator"}</Link>
    </span>
  </footer>;
}
