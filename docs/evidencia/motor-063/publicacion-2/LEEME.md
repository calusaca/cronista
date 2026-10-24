# Brief 063 · publicación 2 (`reinicios-v7`) · lotes y experimento controlado

**Estado: no publicable.** Tras el ajuste permitido de § 12.2, una banda obligatoria del experimento controlado de
atributos sigue fuera: `entrada` (robos hechos por partido del `local`, 80 − 30) = **0,17 < 0,30** en las semillas
1–100. Se para y se reporta, sin ampliar la banda.

Programados, 120 s. Los JSON de esta carpeta salen de `src/arena/metricas-lote-cli.ts` en un árbol limpio en el
commit `047ae16` (rama `brief-063-publicacion-2`, `arbolConCambios: false`).

## Lotes completos y rápido (todas las bandas: 046 recalibradas, 051, bloque A, bloques B y C)

| Lote | Goles | Mano a mano (conv.) | Centros | repliegueCorren | persecucionPerdedor | repliegueSeleccion | Largos / éxito | Lejanos / conv. / a puerta | Incumplimientos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1–30 | 1,70 | 0,451 | 0,73 | 0,685 | 0,522 | 0,971 | 13 en el lote / 0,38 | 19 en el lote / 0 / 0,42 | ninguno |
| 1–100 (+ controlado 051) | 1,88 | 0,418 | 0,65 | 0,673 | 0,509 | 0,968 | 0,66 / 0,39 | 0,67 / 0,18 / 0,49 | ninguno |
| 101–200 | 2,02 | 0,392 | 0,75 | 0,668 | 0,493 | 0,970 | 0,77 / 0,56 | 0,59 / 0,17 / 0,44 | ninguno |

Distancia de los remates (1–100): mediana 19,4 m, p90 26,9 m, máxima 32,9 m (v6: 19,0; 24,7; 25,0).
Contraste B y C (`v6-contraste-1-100.json`): 0 balones largos y 0 remates lejanos.

## Experimento controlado de atributos (`v7-atributos-1-100.json`, solo el `local`, jugadores de campo)

| Atributo | Métrica | Banda | Medido | |
| --- | --- | --- | --- | --- |
| velocidad (30 → 80) | velocidad máxima media | ≥ 0,4 m/s | 0,659 | cumple |
| resistencia | energía final media | ≥ 0,03 | 0,059 | cumple |
| aguante | robos sufridos por minuto de posesión (bajo − alto) | ≥ 0,3 | 0,514 | cumple |
| **entrada** | robos hechos por partido | ≥ 0,3 | **0,170** | **incumple** |
| visión | balones largos por partido | ≥ 0,8 | 1,39 | cumple |
| potencia | remates lejanos por partido | ≥ 0,4 | 0,90 | cumple |
| visión 60 → 90 (§ 18.3) | error medio del pase corto, alto/bajo | ≤ 0,95 | 0,826 | cumple |
| potencia 65 → 90 (§ 18.3) | ticks de vuelo por metro, alto/bajo | ≤ 0,985 | 0,942 | cumple |

Los robos se cuentan con la detección corregida del robo en duelo (`roboEnDuelo`, ver publicación 1). Con la
definición antigua (cualquier cambio de poseedor sin vuelo previo) la diferencia de `entrada` es casi la misma
(0,21 con 0,15 de efecto en 1–100), así que no es un efecto de la definición.

## Ajustes de § 12.2

1. `LARGO_ARENA.remate.probabilidad` y `pase.penalizacion`: no aplica (lejanos y largos dentro de banda).
2. `aguanteDuelo`/`entradaDuelo` 0,15 → 0,12 (**aplicado**, comentado junto a la constante). Antes del ajuste
   (`antes-del-ajuste/`): el lote 1–100 incumplía la conversión del mano a mano del 046 (0,4202 > 0,42) y `entrada`
   daba 0,22. Después: los lotes cumplen todo y `entrada` da 0,17.

Ningún ajuste permitido sube el efecto de la entrada. La cifra de la banda (0,59 medido) salió del prototipo con
`reinicios-v8` y la identidad del primer prototipo, que añade perseguidores y duelos; en v7 hay menos duelos del
`local` como defensor. Con 0,15, el lote 101–200 da 0,28 con la definición corregida: también por debajo.

Decisión pendiente (Fable/Carlos): bajar o trasladar a v8 la banda de `entrada`, subir `entradaDuelo` fuera de la
lista de ajustes, o medir con más semillas. Implementar cualquiera de ellas no le corresponde al implementador.
