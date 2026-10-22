// Brief 055 (v1.1 § 11) · Lámina de revisión visual: los escudos de TODOS los nombres posibles
// (PREFIJOS × LUGARES) con su equipación principal y alternativa, para buscar parecidos con clubes
// reales antes de ✅. Uso (desde la raíz del repo): npx tsx docs/evidencia/identidad-055/lamina.mjs
// Escribe docs/evidencia/identidad-055/lamina.html (autocontenida, sin red).
import { writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { identidadClub } from "../../../src/arena/identidad.ts";
import { LUGARES, PREFIJOS } from "../../../src/sim/plantillas.ts";
import { Escudo } from "../../../src/ui/Escudo.tsx";

const filas = PREFIJOS.flatMap(p => LUGARES.map(l => identidadClub(`${p} ${l}`)));
const celda = i => h("figure", { key: i.nombre },
  h("div", { className: "par" },
    h(Escudo, { identidad: i, size: 56 }),
    h("span", { className: "kit", style: { background: i.principal.fondo, color: i.principal.tinta } }, "1"),
    h("span", { className: "kit", style: { background: i.alternativa.fondo, color: i.alternativa.tinta } }, "2")),
  h("figcaption", null, h("strong", null, i.nombre), h("br"), `${i.principal.id} / ${i.alternativa.id} · ${i.patron} · ${i.forma}`));
const cuerpo = renderToStaticMarkup(h("main", null,
  h("h1", null, `Lámina de escudos · ${filas.length} clubes (brief 055)`),
  h("p", null, "Escudo permanente (principal + patrón en la alternativa) y las dos equipaciones. Revisión de parecidos: sin leones, coronas, cuatro cuadrados ni iniciales de clubes reales."),
  h("section", null, filas.map(celda))));
writeFileSync("docs/evidencia/identidad-055/lamina.html", `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Lámina de escudos 055</title>
<style>body{margin:0;padding:16px;background:#eef1f6;font:14px/1.4 system-ui,sans-serif;color:#0f172a}
section{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
figure{margin:0;padding:10px;border-radius:10px;background:#fff;border:1px solid #d9dfe9}
.par{display:flex;align-items:center;gap:8px}.kit{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;font-weight:900;border:1px solid #2f7d47}
figcaption{margin-top:6px;font-size:12px}.arena-crest-iniciales{font-weight:900;letter-spacing:.02em;font-family:system-ui,sans-serif}</style></head><body>${cuerpo}</body></html>\n`);
console.log(`lamina.html: ${filas.length} escudos`);
