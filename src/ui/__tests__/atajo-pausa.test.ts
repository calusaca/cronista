// Brief 060 § 4.4 + v1.1 (9) · Tabla de destinos del atajo de espacio, con descendientes, diálogos y enlaces.
import { describe, expect, it } from "vitest";
import { atajoPausa, type EslabonFoco } from "../atajo-pausa";

const e = (etiqueta: string, o: Partial<EslabonFoco> = {}): EslabonFoco => ({ etiqueta, rol: null, tieneHref: false, editable: false, tabindex: null, ...o });
const base = [e("MAIN"), e("BODY")];

describe("060 · atajoPausa", () => {
  it("verdadero en body, html, main o un elemento no enfocable", () => {
    expect(atajoPausa([e("BODY")])).toBe(true);
    expect(atajoPausa([e("HTML")])).toBe(true);
    expect(atajoPausa(base)).toBe(true);
    expect(atajoPausa([e("P"), e("SECTION"), ...base])).toBe(true);
    expect(atajoPausa([e("A"), ...base])).toBe(true); // `a` sin href no es un enlace
  });
  it("falso en controles nativos, enlaces con href, summary, audio y video (M13: el select)", () => {
    for (const etiqueta of ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY", "AUDIO", "VIDEO"]) expect(atajoPausa([e(etiqueta), ...base]), etiqueta).toBe(false);
    expect(atajoPausa([e("A", { tieneHref: true }), ...base])).toBe(false);
  });
  it("falso con roles interactivos, contenido editable o tabindex (las fichas de la cancha)", () => {
    for (const rol of ["slider", "button", "checkbox", "switch", "tab", "option", "combobox", "textbox"]) expect(atajoPausa([e("DIV", { rol }), ...base]), rol).toBe(false);
    expect(atajoPausa([e("DIV", { editable: true }), ...base])).toBe(false);
    expect(atajoPausa([e("g", { rol: "button", tabindex: "0" }), e("svg"), ...base])).toBe(false);
    expect(atajoPausa([e("DIV", { tabindex: "-1" }), ...base])).toBe(false);
  });
  it("falso en descendientes no enfocables de un control y dentro de un diálogo", () => {
    expect(atajoPausa([e("SPAN"), e("BUTTON"), ...base])).toBe(false);
    expect(atajoPausa([e("#text-holder"), e("SUMMARY"), e("DETAILS"), ...base])).toBe(false);
    expect(atajoPausa([e("text"), e("g", { rol: "button", tabindex: "0" }), e("svg"), ...base])).toBe(false);
    expect(atajoPausa([e("P"), e("DIV", { rol: "dialog" }), ...base])).toBe(false);
  });
});
