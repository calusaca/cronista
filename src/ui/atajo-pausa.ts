// Brief 060 § 4.4 + v1.1 (9) · Atajo de la barra de espacio: decide, sin DOM, si una pulsación con este destino puede
// pausar o reanudar. Recibe la cadena de ancestros desde el destino hasta document.body (incluidos).

export interface EslabonFoco { etiqueta: string; rol: string | null; tieneHref: boolean; editable: boolean; tabindex: string | null }

/** Elementos y roles que ya usan el espacio (o el foco) por sí mismos. */
const ETIQUETAS = new Set(["input", "select", "textarea", "button", "summary", "audio", "video"]);
const ROLES = new Set(["slider", "button", "checkbox", "switch", "tab", "option", "combobox", "textbox"]);

/** Verdadero solo si ningún eslabón es interactivo (la lista de § 4.4 y `a` con href), editable, tiene `tabindex` o es
 * un diálogo: es decir, con el foco en body, html, main o en un elemento no enfocable fuera de esos casos. */
export function atajoPausa(cadena: readonly EslabonFoco[]): boolean {
  return cadena.every(e => {
    const etiqueta = e.etiqueta.toLowerCase(), rol = e.rol?.trim().toLowerCase() ?? null;
    if (ETIQUETAS.has(etiqueta) || etiqueta === "a" && e.tieneHref) return false;
    if (e.editable || e.tabindex !== null) return false;
    if (rol && (ROLES.has(rol) || rol === "dialog")) return false;
    return true;
  });
}

/** Cadena de ancestros de un destino del DOM (para el manejador de `keydown`). */
export function cadenaFoco(destino: EventTarget | null): EslabonFoco[] {
  const cadena: EslabonFoco[] = [];
  for (let n = destino instanceof Element ? destino : null; n; n = n.parentElement) {
    cadena.push({ etiqueta: n.tagName, rol: n.getAttribute("role"), tieneHref: n.hasAttribute("href"), editable: n instanceof HTMLElement && n.isContentEditable, tabindex: n.getAttribute("tabindex") });
    if (n === document.body) break;
  }
  return cadena;
}
