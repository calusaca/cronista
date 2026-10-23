// Brief 057 v1.1 § 7 [v1.2] · Regla 047 sobre globals.css: ninguna regla cuyo selector termine en
// .arena-player, .arena-ball o .arena-referee declara transform, transition o animation (M19). Los
// descendientes (anillo .arena-goal-ring del 050, .arena-token) y la vista del arco del 057 quedan fuera.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { violaciones047 } from "../css-047";

const css = readFileSync("src/app/globals.css", "utf8");

describe("057 · comprobación estática de la regla 047", () => {
  it("globals.css no tiene violaciones", () => {
    expect(violaciones047(css)).toEqual([]);
  });
  it("detecta la propiedad en el propio elemento, con atributos o pseudoclases y dentro de @media; deja pasar descendientes", () => {
    expect(violaciones047(".arena-player[data-gol] { animation: x 1s; }")).toEqual([{ selector: ".arena-player[data-gol]", propiedad: "animation" }]);
    expect(violaciones047("@media (min-width: 1px) { .x, .arena-shell .arena-ball:hover { transition-duration: .2s; } }")).toEqual([{ selector: ".arena-shell .arena-ball:hover", propiedad: "transition-duration" }]);
    expect(violaciones047("g.arena-referee{transform:scale(2)}")).toHaveLength(1);
    expect(violaciones047(".arena-player[data-gol] > .arena-token > circle.arena-goal-ring { animation: a 1s; }")).toEqual([]);
    expect(violaciones047(".arena-player .arena-token { transform: scale(1.2); }")).toEqual([]);
    expect(violaciones047(".arena-goal-view-ball { animation: a 1s; } .arena-players { transition: all 1s; }")).toEqual([]);
    expect(violaciones047("@keyframes k { from { transform: none; } to { transform: none; } }")).toEqual([]);
  });
});

describe("057 · regresiones de la revisión de Codex (impl., #3)", () => {
  it(":is()/:where() con uno de los tres elementos es violación; sus comas internas no parten el selector", () => {
    expect(violaciones047(":is(.arena-ball) { transform: scale(2); }")).toEqual([{ selector: ":is(.arena-ball)", propiedad: "transform" }]);
    expect(violaciones047("g:where(.x, .arena-referee):hover { transition: all 1s; }")).toHaveLength(1);
    expect(violaciones047(":is(.arena-shell .arena-player) { animation: a 1s; }")).toHaveLength(1);
    expect(violaciones047(".arena-player:is(.local, .visita) > .arena-token { animation: a 1s; }")).toEqual([]);
    expect(violaciones047(".arena-player:not(.arena-ball) > circle { transform: none; }")).toEqual([]);
    expect(violaciones047(".arena-ball:not(.x), .y { animation: a 1s; }")).toEqual([{ selector: ".arena-ball:not(.x)", propiedad: "animation" }]);
  });
});

describe("057 v1.3 (6) · comillas y escapes", () => {
  it("paréntesis, corchetes y comas dentro de cadenas no cuentan", () => {
    expect(violaciones047('.arena-player[data-x="("] > .arena-token { animation: a 1s }')).toEqual([]);
    expect(violaciones047(".arena-player[data-x=')'] > .arena-token, .y { transform: none }")).toEqual([]);
    expect(violaciones047('.arena-ball[data-x="a,b"] { transition: all 1s }')).toEqual([{ selector: '.arena-ball[data-x="a,b"]', propiedad: "transition" }]);
    expect(violaciones047('.x[data-y="]"] .arena-referee { transform: scale(2) }')).toHaveLength(1);
    expect(violaciones047('.a\\(b .arena-ball { animation: a 1s }')).toHaveLength(1);
  });
});
