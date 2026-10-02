# 015 — Magnitudes del tiro: distancia y velocidad creíbles

**Fecha:** 2026-10-01 · **Diseña:** Fable (pedido de Carlos: «Juan dispara,
velocidad del disparo, distancia 18 metros… pero de una manera creíble») ·
**Implementa:** Opus (tras el 014) · **Estado:** cerrado

## Objetivo

Los tiros macro ganan dos mediciones físicas — **distancia al arco en metros**
y **velocidad del disparo en km/h** — con los rangos del fútbol real y
coherentes con todo lo que el evento ya registra. La crónica puede narrarlas
(«remató desde 18 metros, a 97 km/h») y V3 las verifica como cualquier cifra.

## 1 · Campos nuevos (mismo mecanismo del 011)

- `tiro` (y `gol`/`atajada` por herencia): `distanciaM` (entero, metros) y
  `velocidadKmh` (entero, km/h), sorteados con `prngDerivado(semilla, id)` —
  ni un sorteo del stream principal.
- **Proyección legado, extensión consciente:** la lista de campos a borrar en
  la prueba del fixture suma `distanciaM` y `velocidadKmh`. El fixture
  `hashes-legado.json` NO se regenera; la prueba debe seguir reproduciéndolo.
  (Tercera extensión de la lista; el mecanismo está probado en 011 y 013.)

## 2 · Credibilidad: bandas y coherencia (todo en `limites.ts`, atacable)

- **Distancia por zona** (coherente con `zonaOrigen` del 011): área chica
  2–6 m; punto penal = 11 exacto; frontal 16–22 m; bandas 10–24 m; media
  distancia 20–32 m.
- **Coherencia distancia↔xG:** bandas cruzadas — un xG alto exige distancia
  corta (xG ≥ 0.3 ⇒ ≤ 12 m) y una distancia larga exige xG bajo (≥ 20 m ⇒
  xG ≤ 0.15). El penal (0.76, 11 m) queda exento por definición.
- **Velocidad realista:** tiros normales 60–125 km/h con media ~90; el penal
  75–110; correlación suave distancia↔velocidad (desde lejos se le pega más:
  ≥ 20 m ⇒ ≥ 80 km/h). Jamás un «8 km/h»: el mínimo absoluto vive en limites.
- **Invariantes** sobre el corpus 1..1000 + suite estadística (distribución de
  velocidades con media y colas razonables, distancias por zona pobladas).

## 3 · Dónde se ve

- **Pizarra/animación (011):** el rótulo del remate suma las mediciones —
  «Doraena · edge of the box · 18 m · 97 km/h». Las posiciones siguen siendo
  por zona (el rótulo honesto no cambia: las magnitudes son mediciones del
  evento, no coordenadas).
- **Línea de tiempo:** el texto del tiro puede sumar «· 18 m» (criterio del
  implementador si no satura; a 360 px no se desborda).
- **Crónica:** `distanciaM`/`velocidadKmh` entran a los `datos` de los hechos
  de gol/tiro ⇒ el Cronista PUEDE narrarlas y V3 las verifica; V6 exige que ES
  y EN digan la misma cifra. Léxico V8: «desde fuera del área / from outside
  the box» se habilita solo con `distanciaM ≥ 17`; «un misil / a rocket» solo
  con `velocidadKmh ≥ 100`. Mentiras de batería: cifra cambiada, «desde fuera
  del área» con 9 m, «misil» con 70 km/h.

## Fuera de alcance

Trayectorias, coordenadas exactas, velocidad de los jugadores, mapas de calor.

## Propiedades verificables

1. Fixture de hashes intacto (proyección extendida conscientemente).
2. Determinismo byte a byte con los campos nuevos.
3. Invariantes de coherencia zona↔distancia↔xG↔velocidad en 1..1000.
4. Fixtures: penal ⇒ 11 m; gol de media distancia ⇒ ≥ 20 m y xG ≤ 0.15.
5. Batería V8/V3 nueva; mutación de control: generador ignora la banda de
   coherencia ⇒ muere; «fuera del área» sin el umbral ⇒ muere.

## Aceptación

Suites + stats + e2e vistos por Fable; smoke a ojo de 3 pizarras con
mediciones (¿las firmaría un comentarista?); cifras de distribución anotadas.
