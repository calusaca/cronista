# Brief 063 · publicación 3 (`reinicios-v8`) · identidad de juego del club

Programados, 120 s. Todos los JSON se midieron con `src/arena/metricas-lote-cli.ts` en un árbol limpio en el commit
`f3314e9` (`arbolConCambios: false`). Ningún ajuste de § 12.2 fue necesario: `bloqueM` sigue en ±5.

## Lotes (bandas de v7: 046 recalibradas, 051, bloque A, bloques B y C)

| Lote | Goles | Mano a mano (conv.) | Centros | repliegueCorren | persecucionPerdedor | repliegueSeleccion | Largos / éxito | Lejanos / conv. / a puerta | Incumplimientos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1–30 | 1,77 | 0,333 | 0,70 | 0,664 | 0,430 | 0,970 | 33 en el lote / 0,33 | 28 en el lote / 0,04 / 0,25 | ninguno |
| 1–100 (+ controlado 051) | 1,97 | 0,381 | 0,64 | 0,678 | 0,485 | 0,964 | 1,00 / 0,49 | 0,84 / 0,17 / 0,46 | ninguno |
| 101–200 | 2,04 | 0,342 | 0,70 | 0,672 | 0,487 | 0,972 | 1,08 / 0,54 | 0,63 / 0,14 / 0,37 | ninguno |

Controlado del 051 en 1–100: porteros 0,247 (≥ 0,1) y campo 0,208 (≥ 0,1).
Remates en 1–100: 5,08 por partido, a puerta 0,675, conversión 0,388.

## Experimento controlado de identidad (`v8-identidad-1-100.json`, identidad del `local` forzada, semillas 1–100)

| Identidad | x media sin balón | Balones largos | Remates lejanos | Persecución (s por partido) | Goles por partido |
| --- | --- | --- | --- | --- | --- |
| presión | 47,8 m | 0,43 | 0,37 | 8,27 | 1,99 |
| defensivo | 43,1 m | 0,55 | 0,23 | 6,46 | 2,09 |
| directo | 45,7 m | 0,91 | 0,58 | 7,43 | 2,08 |
| posesión | 45,4 m | 0,04 | 0,12 | 8,77 | 2,09 |
| ofensivo | 48,0 m | 0,26 | 0,54 | 8,21 | 1,97 |

| Diferencia | Banda | Medido | |
| --- | --- | --- | --- |
| x media sin balón (presión − defensivo) | ≥ 3 m | 4,77 | cumple |
| Balones largos (directo − posesión) | ≥ 0,6 | 0,87 | cumple |
| Remates lejanos (ofensivo − posesión) | ≥ 0,2 | 0,42 | cumple |
| Segundos de persecución (presión − defensivo) | ≥ 1,0 | 1,82 | cumple |

## Escenas (`v8-escenas-1-10.json`)

`--escenas` añade `identidades` por semilla. Semillas 1–10: directo–ofensivo, presión–posesión, ofensivo–contragolpe,
ofensivo–contragolpe, directo–contragolpe, posesión–presión, directo–ofensivo, presión–contragolpe, defensivo–directo y
posesión–contragolpe (local–visita).

## Smoke visual (`../smoke-d/`, `e2e/arena-identidad-juego.spec.ts`)

- `alineacion-identidad-{en,es}-360.png` y `entrenador-identidad-{en,es}-360.png`: fixture v8 (semilla 14, defensivo
  frente a ofensivo), píldora, descripción abierta y línea del entrenador a 360 px sin desbordes. La grabación v7 no
  muestra nada de esto (comprobado en el mismo spec).
- Partidos contrastados (120 s, semillas buscadas por el spec):
  - presión frente a defensivo, semilla 11: Sporting Puertoscuro (presión, visita) y Unión Caleteo (defensivo, local).
    Bloque medio sin balón en ese partido: presión 47,5 m, defensivo 49,2 m; ningún balón largo. Fotograma de 62,5 s con
    la presión defendiendo (bloque 42,2 m en ese instante).
  - directo frente a posesión, semilla 24: Atlético Lumbrera (directo, visita) y Olímpico Marisal (posesión, local).
    Bloque medio 46,5 m frente a 40,3 m; ningún balón largo y un remate lejano del directo. Fotograma de 68,5 s.
- **Lectura honesta:** en un solo partido de 120 s el bloque medio depende también de dónde está el balón cuando el rival ataca, y los balones
  largos son ≈ 1 por partido entre los dos equipos. La diferencia de identidad se ve en el lote controlado (tabla de
  arriba), no necesariamente en un partido suelto: en la semilla 11 el equipo de presión defendió más bajo que el
  defensivo.
