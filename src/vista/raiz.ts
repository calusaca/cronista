// Brief 064 § 3.2 (D2/D3) · Raíz del sitio: `/` lleva a la arena con una redirección 307 que conserva la query íntegra
// y en su orden; los enlaces viejos `/?perspectiva=…` van a la portada de crónicas (`/cronicas`). En el host de la demo
// de crónicas, `CRONISTA_RAIZ=cronicas` (leída en cada petición) mantiene `/` como portada. Funciones puras.

export type QueryRaiz = URLSearchParams | Record<string, string | string[] | undefined>;

function aParametros(query: QueryRaiz): URLSearchParams {
  if (query instanceof URLSearchParams) return new URLSearchParams(query);
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (valor === undefined) continue;
    for (const v of Array.isArray(valor) ? valor : [valor]) q.append(clave, v);
  }
  return q;
}

/** Destino de `/`: `/cronicas?<query>` si la query trae `perspectiva`; si no, `/arena?<query>`. */
export function destinoRaiz(query: QueryRaiz): string {
  const q = aParametros(query);
  const base = q.has("perspectiva") ? "/cronicas" : "/arena";
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** D3 · ¿La raíz de este host es la portada de crónicas? Se lee en cada petición, no al importar. */
export function raizEsCronicas(env: Record<string, string | undefined> = process.env): boolean {
  return env.CRONISTA_RAIZ?.trim() === "cronicas";
}

/** D5 · Idioma inicial de la barra en las rutas heredadas: `es` solo con `?lang=es`. */
export function idiomaDeLang(lang: string | string[] | undefined): "es" | "en" {
  return lang === "es" ? "es" : "en";
}
