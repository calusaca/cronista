"use client";

// Brief 049 (v1.1 § 10) · Estrellas de club y jugador favoritos y avisos. La estrella es una
// forma CSS en un <span aria-hidden> propio (sin texto ni ::before con contenido: 047).
import type { FavoritosArena } from "../arena/favoritos";

export function EstrellaFavorito({ activo, nombre, tipo, alternar, idioma, testId, lado }: {
  activo: boolean; nombre: string; tipo: "club" | "jugador"; alternar: () => void; idioma: "es" | "en";
  testId: "arena-favorite-club" | "arena-favorite-player"; lado?: "local" | "visita";
}) {
  const es = idioma === "es";
  const etiqueta = activo
    ? es ? `Quitar ${nombre} de favoritos` : `Remove ${nombre} from favourites`
    : tipo === "club" ? es ? `Marcar ${nombre} como club favorito` : `Mark ${nombre} as favourite club`
      : es ? `Marcar ${nombre} como jugador favorito` : `Mark ${nombre} as favourite player`;
  return <button type="button" className="arena-fav-toggle" aria-pressed={activo} aria-label={etiqueta} title={etiqueta} data-testid={testId} data-side={lado} onClick={alternar}>
    <span className="arena-fav-star" aria-hidden="true" />
  </button>;
}

/** Favoritos que no juegan este partido y error de almacenamiento. */
export function AvisosFavoritos({ favoritos, presentes, olvidar, error, idioma }: {
  favoritos: FavoritosArena; presentes: { lado: unknown; jugador: unknown }; olvidar: (que: "club" | "jugador") => void;
  error: boolean; idioma: "es" | "en";
}) {
  const es = idioma === "es";
  const club = favoritos.club && !presentes.lado ? favoritos.club : null;
  const jugador = favoritos.jugador && !presentes.jugador ? favoritos.jugador : null;
  if (!club && !jugador && !error) return null;
  return <div className="arena-fav-notes" data-testid="arena-favorite-notes">
    {club && <p className="arena-muted">{es ? `Tu club favorito, ${club}, no juega este partido.` : `Your favourite club, ${club}, is not playing this match.`} <button type="button" className="btn" onClick={() => olvidar("club")}>{es ? "Olvidar favorito" : "Forget favourite"}</button></p>}
    {jugador && <p className="arena-muted">{es ? `Tu jugador favorito, ${jugador.nombre} (${jugador.club}, ${jugador.dorsal}), no juega este partido.` : `Your favourite player, ${jugador.nombre} (${jugador.club}, ${jugador.dorsal}), is not playing this match.`} <button type="button" className="btn" onClick={() => olvidar("jugador")}>{es ? "Olvidar favorito" : "Forget favourite"}</button></p>}
    {error && <p role="status">{es ? "No se pudo guardar tu favorito en este navegador" : "Your favourite could not be saved in this browser"}</p>}
  </div>;
}
