// Brief 052 v1.1 §6–7: funciones puras de publicación de la arena, separadas del script
// (que muta Azure al importarse) para poder probarlas con `npm run test:deploy`.
import { readFileSync } from "node:fs";

const LLMS = new Set(["azure-openai", "foundry-modelos"]);
const FORMATOS = new Set(["json_schema", "json_object", "texto"]);
const ESFUERZOS = new Set(["low", "minimal"]);

/** Catálogo publicado = entradas de infra/modelos-arena.json con `publicar: true`, en orden.
 * De la misma entrada salen deployment, nombre público y prefijo: no pueden divergir. */
export function catalogoPublicado(modelos) {
  if (!Array.isArray(modelos)) throw new Error("modelos-arena.json debe ser un arreglo");
  const vistos = new Set();
  const publicados = modelos.filter(m => m.publicar === true).map(m => {
    if (!/^[a-z0-9-]{1,40}$/.test(m.id ?? "")) throw new Error(`id inválido en modelos-arena.json: ${m.id}`);
    if (vistos.has(m.id)) throw new Error(`id repetido en modelos-arena.json: ${m.id}`);
    vistos.add(m.id);
    if (!LLMS.has(m.llm)) throw new Error(`llm inválido para ${m.id}: ${m.llm}`);
    if (typeof m.nombrePublico !== "string" || !m.nombrePublico.trim() || m.nombrePublico.length > 80) throw new Error(`nombrePublico inválido para ${m.id}`);
    if (typeof m.nombre !== "string" || !m.nombre) throw new Error(`deployment inválido para ${m.id}`);
    if (m.llm === "foundry-modelos" && !FORMATOS.has(m.formatoJson)) throw new Error(`formatoJson inválido para ${m.id}: ${m.formatoJson}`);
    if (m.esfuerzoRazonamiento !== undefined && (m.llm !== "foundry-modelos" || !ESFUERZOS.has(m.esfuerzoRazonamiento))) throw new Error(`esfuerzoRazonamiento inválido para ${m.id}: ${m.esfuerzoRazonamiento}`);
    return { id: m.id, nombre: m.nombrePublico, prefijo: `ARENA_${m.id.toUpperCase().replace(/-/g, "_")}_`, llm: m.llm, deployment: m.nombre, formatoJson: m.llm === "foundry-modelos" ? m.formatoJson : "", esfuerzoRazonamiento: m.esfuerzoRazonamiento ?? "" };
  });
  if (!publicados.length) throw new Error("El catálogo publicado necesita al menos un modelo");
  return publicados;
}

export function leerCatalogoPublicado(ruta = "infra/modelos-arena.json") {
  return catalogoPublicado(JSON.parse(readFileSync(ruta, "utf8")));
}

/** Host de Foundry Models desde FOUNDRY_BASE_URL (recorta /anthropic y barras finales). */
export function endpointFoundryModelos(baseUrl) {
  if (!baseUrl) throw new Error("Falta FOUNDRY_BASE_URL para derivar foundryEndpoint");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") throw new Error("foundryEndpoint debe ser https");
  return `${url.origin}${url.pathname.replace(/\/+$/, "").replace(/\/anthropic$/, "")}`;
}
