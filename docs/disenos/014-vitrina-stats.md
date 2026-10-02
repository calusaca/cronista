# 014 — Vitrina: panel de stats, presets creíbles y simular sin fricción

**Fecha:** 2026-10-01 · **Diseña:** Fable (pedidos de Carlos: «quién dominó
más, cuántas veces por la banda o el centro… que no siempre sean goleadas…
que siempre que se genera un partido me muestre directamente ese partido») ·
**Implementa:** Opus (tras el 013, depende de su capa micro) · **Estado:**
cerrado

## 1 · Panel «Match stats» (la cara visible del 013)

Nuevo panel en la vista de partido (debajo de Ratings, mismos tokens del 010):

- **Posesión**: barra por equipo con el % (del `dominio_global`/conteos micro),
  y por periodo en modo Analista.
- **Ataques por canal**: tres barras por equipo (banda izq / centro / banda
  der) con sus %.
- **Duelos**: top de regates «X {n}× sobre Y» (si los hay).
- **Pérdidas en salida**: por equipo y canal (si superan el umbral del hecho, se
  destacan).
- **Todo clicable, todo con prueba**: tocar una cifra abre su evidencia — los
  micro-eventos exactos para los hechos acotados (lista con minuto y canal), el
  desglose recomputable para los agregados (como el panel de Ratings). Rotulado
  honesto: «computed from 2,000+ simulated match events».
- **En vivo**: las stats evolucionan con el prefijo y se rotulan «so far»
  (gratis por la propiedad de prefijo del 013).
- A 360 px cabe sin desbordes (medido, como siempre).

## 2 · Presets curados: la variedad se ve

La distribución ya es creíble (ver medición en el 013); lo que falla es la
vitrina: la portada siempre es la 246 (4–1). El selector «Pick a story…» pasa a
ofrecer 5 historias que muestran el rango real del simulador:

- un **0–0** con un portero enorme (muchas atajadas de xG alto),
- un **1–0** sufrido (gol tardío),
- un **empate 2–2** con remontada parcial,
- la **246** (4–1 con roja y penal — la historia grande se queda),
- un partido con **duelo individual** fuerte del 013 (alguien dribla 5+ veces).

Las semillas se cazan con un script sobre el corpus (criterios arriba,
determinista, mostrar el script y las elegidas en el informe); los textos de
los presets dicen el TIPO de historia sin spoilear el marcador exacto
(«A goalless thriller», «A late winner»…). La portada sigue siendo la 246.

## 3 · Simular sin fricción

- **Simulate siempre lleva al partido**: con semilla válida navega a
  `/match/<semilla>` (comportamiento actual, se conserva y se asegura con
  e2e); con el campo VACÍO ya no se queda quieto: genera una semilla aleatoria
  y navega (mismo comportamiento que Random match).
- Semilla inválida sigue dando el error visible de siempre (no un partido
  inventado).

## Restricciones

- Depende del 013 (hechos y capa micro). Tokens del 010; ningún color nuevo.
- `juez.spec.ts` intacto; specs nuevos pueden sumarse (stats panel, semilla
  vacía); los existentes no pierden asertos.
- Umbrales de los destacados importados del 013; nada repetido a mano.

## Aceptación

Suites + e2e vistos por Fable; smoke a ojo de los 5 presets (claro/oscuro) —
«¿se siente la variedad?»; capturas para Carlos; a 360 px sin desbordes.
