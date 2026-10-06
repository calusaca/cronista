// Brief 028 §3 — el DATASHEET del repo, servido tal cual (texto Markdown) desde /datos.
import { leerDatasheet } from "../../../vista/datos";

export function GET(): Response {
  return new Response(leerDatasheet(), { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
