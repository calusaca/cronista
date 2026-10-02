# 017 — xG en cristiano: «% de gol» en la vista Aficionado

**Fecha:** 2026-10-02 · **Diseña:** Fable (feedback de Carlos: «no pongas xG,
no entiendo qué es eso») · **Implementa:** Opus (ANTES del 016: es chico y es
de cara al usuario) · **Estado:** cerrado

## Objetivo

«xG» es jerga de analistas. En la vista **Aficionado** (la de por defecto),
toda cifra de xG del CHROME de la interfaz se muestra como probabilidad de
gol en lenguaje humano; en la vista **Analista** se queda «xG 0.35» (los
analistas hablan así). Es nuestra historia de personalización aplicada a la
presentación: mismo dato, dos lecturas — jamás dos verdades.

## Qué cambia

- **Un solo formateador** (`formatoXg(xg, modo, idioma)` en `src/ui/textos.ts`):
  Aficionado ⇒ ES «35 % de gol» / EN «35% chance»; Analista ⇒ «xG 0.35».
  Ninguna cifra de xG se formatea a mano en componentes.
- Dónde aplica (todo el chrome): línea de tiempo («Shot · Celeloya · 35 % de
  gol»), rótulos de la pizarra («3 m · 92 km/h · 24 % de gol»), relato jugada
  a jugada, desglose de ratings («definición difícil»), chips del modo
  Analista (quedan en xG por definición de ese modo), barra/stats.
- **Explicador de una línea**, visible una vez en el panel de stats y en la
  pizarra (title/caption): ES «% de gol: qué tan probable era que ese remate
  terminara en gol» / EN equivalente.
- **La crónica NO cambia**: las oraciones verificadas quedan como están (V3/V6
  intactos — 35 % y 0.35 son cifras distintas y no se mezclan). Enseñarle al
  Cronista a decir «una de cada tres» es tarea del día de Foundry, no de hoy.

## Restricciones

1. Redondeo honesto: `Math.round(xg*100)` %, y el valor crudo sigue en los
   `data-*` existentes (los tests y el overlay no cambian de contrato).
2. Specs e2e: SOLO pueden actualizarse los asertos de etiqueta afectados
   (p. ej. el texto del tiro en la línea de tiempo); nada se afloja. El modo
   Analista sigue mostrando «xG» y su e2e lo confirma.
3. 360 px sin desbordes (el texto «% de gol» es más largo que «xG 0.35»).

## Aceptación

Suites + e2e vistos por Fable; smoke a ojo: vista Aficionado sin ninguna
«xG» visible, vista Analista con xG intacto, ES y EN.
