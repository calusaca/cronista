# Brief 068 · `reinicios-v10`: pasador consciente del fuera de juego, la regla en el prompt y más faltas (27 oct 2026)

Lote de medida:
- programados, sin LLM;
- 120 s (`LOTE_ARENA_046.duracionS`);
- semillas 1–100 y 101–200, v9 frente a v10.

Script: `medir.mts`, que usa `src/arena/metricas-068.ts`. Datos: `reinicios-v{9,10}-{1,101}-100.json`.
Uso: `node --import tsx docs/evidencia/motor-068/medir.mts reinicios-v10 1 100`.

| Lote | Reglas | Fueras de juego/p | Fueras del receptor previsto de un pase raso | Faltas/p | % sin falta | Amarillas/p | Rojas/p | Goles/p | Tiros/p |
|---|---|---|---|---|---|---|---|---|---|
| 1–100 | v9 | 2,85 | 209 | 0,61 | 60 | 0,27 | 0,01 | 2,16 | 4,83 |
| 1–100 | **v10** | **1,15** | **0** | **2,19** | **13** | 0,82 | 0,08 | **2,41** | 5,70 |
| 101–200 | v9 | 2,92 | 236 | 0,34 | 73 | 0,15 | 0 | 2,06 | 5,07 |
| 101–200 | v10 | 1,10 | 0 | 1,55 | 32 | 0,64 | 0,07 | 2,50 | 5,78 |

En v9, «del receptor previsto» cuenta los pases rasos de campo: sin `motivo` (`largo`, `centro`, `saque_manos`) y sin
`reinicio`.

## Bandas `BANDAS_068`

Se miden sobre v10, semillas 1–100, y se comprueban en `motor068.stats.test.ts`.

| Banda | Valor | Resultado |
|---|---|---|
| Fueras de juego | 1,15, en [0,3; 1,4] | cumple |
| Fueras del receptor previsto de un pase raso | 0 | cumple |
| Faltas | 2,19, en [1,5; 2,8] | cumple |
| Partidos sin falta | 13 % (≤ 25 %) | cumple |
| Rojas | 0,08 (≤ 0,15) | cumple |
| Goles | 2,41 ≥ 2,16 × 0,95 | cumple |

Las bandas del 046 (recalibradas), del 051 y del 063 (A, B y C) no tienen incumplimientos en ninguno de los tres lotes
medidos:
- el rápido (1–30);
- 1–100;
- 101–200.

## Factor de faltas

Queda en **3** (`FALTAS_ARENA_V10.factorProbabilidad`), sin iteraciones.

## Diagnóstico de la v1.1

En `diagnostico/`. A completo, con el balón largo y el centro también filtrados, dejaba 0,09 fueras de juego e
incumplía estas bandas:
- goles del 046: 2,90 > 2,8;
- conversión del 051: 0,4286 > 0,42;
- `exitoLargos` del 063: 0,967 > 0,7.

Por eso el coordinador decidió la v1.1: solo se filtran los pases rasos.

Detalles del diagnóstico:
- `diag2.mts` usaba dos interruptores temporales del motor (`SIN_CENTRO` y `SIN_LARGO` en `globalThis`), que ya se
  retiraron del código.
- `it0-*` y `diag2-x-*` son de A completo.
- `diag2-cl-*` es el alcance del prototipo, que es el de la v1.1.
- `v11-*` es la v1.1 ya implementada.

## Otros resultados

- Coste de la petición en `factorObservacion063`: el cociente pasa de 1,2144 a 1,2482 (v10/v5) y el factor sube de 1,34
  a 1,38. El detalle está en el comentario de `limites.ts`.
- Mutaciones: en `mutaciones.txt`.
- Voz: en `voz/`.
