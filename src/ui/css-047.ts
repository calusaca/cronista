// Brief 057 v1.1 § 7 [v1.2] · Comprobación estática de la regla 047 sobre globals.css: ninguna regla cuyo
// selector TERMINE en `.arena-player`, `.arena-ball` o `.arena-referee` (con atributos o pseudoclases sobre ese
// mismo elemento) declara `transform`, `transition` o `animation`. Los descendientes (p. ej. el anillo
// `.arena-player[data-gol] > .arena-token > circle.arena-goal-ring` del 050, o `.arena-token`, que lleva la
// escala del 047) quedan fuera. Pura: recibe el texto CSS. La usan la prueba unitaria y contraste.mjs.

export const ELEMENTOS_047 = ["arena-player", "arena-ball", "arena-referee"] as const;
const PROHIBIDAS = /^(transform|transition|animation)(-[a-z-]+)?$/;

export interface Violacion047 { selector: string; propiedad: string }

/** v1.3 (6) · Recorre `texto` y llama a `cada(c, i, profundidad)` solo con los caracteres estructurales: fuera de
 * cadenas ('…' o "…") y sin los escapados con barra invertida. La profundidad cuenta () y [] (ya actualizada al
 * abrir y al cerrar). Así un `[data-x="("]` o `"\,"` no abre paréntesis ni parte selectores. */
function recorrer(texto: string, cada: (c: string, i: number, profundidad: number) => void): void {
  let profundidad = 0, comilla: string | null = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (c === "\\") { i++; continue; }
    if (comilla) { if (c === comilla) comilla = null; continue; }
    if (c === '"' || c === "'") { comilla = c; continue; }
    if (c === "(" || c === "[") profundidad++;
    else if (c === ")" || c === "]") profundidad--;
    cada(c, i, profundidad);
  }
}
/** Último compuesto de un selector (tras el último combinador de descendencia: espacio, >, +, ~). */
function ultimoCompuesto(selector: string): string {
  let corte = 0;
  recorrer(selector, (c, i, profundidad) => { if (profundidad === 0 && (c === " " || c === ">" || c === "+" || c === "~")) corte = i + 1; });
  return selector.slice(corte).trim();
}
/** Codex 057 (impl., #3) · Parte una lista de selectores por las comas de primer nivel (fuera de paréntesis, de
 * atributos y de cadenas): `.a:is(.b, .c), .d` son dos selectores, no tres. */
export function partirLista(lista: string): string[] {
  const partes: string[] = []; let inicio = 0;
  recorrer(lista, (c, i, profundidad) => { if (c === "," && profundidad === 0) { partes.push(lista.slice(inicio, i)); inicio = i + 1; } });
  partes.push(lista.slice(inicio));
  return partes.map(x => x.trim()).filter(Boolean);
}
/** Pseudoclases funcionales cuyo argumento es el propio elemento (se resuelven); las demás (:not, :has,
 * :nth-child…) no lo designan y se ignoran. */
const MISMO_ELEMENTO = new Set(["is", "where", "matches", "-webkit-any"]);
/** ¿El compuesto designa a uno de los tres elementos? Clase exacta fuera de atributos, cadenas y pseudoclases que
 * no designan; dentro de :is()/:where(), basta con que un argumento termine en uno de ellos. */
function designa(compuesto: string): boolean {
  let simple = "", inicio = -1, nombre = "";
  const argumentos: { nombre: string; texto: string }[] = [];
  recorrer(compuesto, (c, i, profundidad) => {
    if (c === "(" && profundidad === 1) {
      const m = /::?([a-z-]+)$/i.exec(simple);
      nombre = m ? m[1]!.toLowerCase() : ""; if (m) simple = simple.slice(0, -m[0].length);
      inicio = i; return;
    }
    if (c === ")" && profundidad === 0 && inicio >= 0) { argumentos.push({ nombre, texto: compuesto.slice(inicio + 1, i) }); inicio = -1; return; }
    if ((c === "[" && profundidad === 1) || (c === "]" && profundidad === 0)) return;
    if (profundidad === 0) simple += c;
  });
  if (argumentos.some(a => MISMO_ELEMENTO.has(a.nombre) && partirLista(a.texto).some(x => designa(ultimoCompuesto(x))))) return true;
  return ELEMENTOS_047.some(clase => new RegExp(`\\.${clase}(?![\\w-])`).test(simple));
}
export function violaciones047(css: string): Violacion047[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const fuera: Violacion047[] = [];
  // Bloques hoja `selector { declaraciones }` (las @media/@supports se recorren por dentro; @keyframes se salta).
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m; (m = re.exec(limpio));) {
    const cabecera = m[1]!.trim();
    if (cabecera.startsWith("@") || /^(from|to|\d+%)(\s*,\s*(from|to|\d+%))*$/.test(cabecera)) continue;
    const selectores = partirLista(cabecera);
    const propiedades = m[2]!.split(";").map(d => d.split(":")[0]!.trim().toLowerCase()).filter(p => PROHIBIDAS.test(p));
    if (!propiedades.length) continue;
    for (const selector of selectores) if (designa(ultimoCompuesto(selector))) for (const propiedad of propiedades) fuera.push({ selector, propiedad });
  }
  return fuera;
}
