# Brief 070 · `reinicios-v11`: tiro libre real y penal (27 oct 2026)

Lote de medida:
- programados, sin LLM;
- 120 s (`LOTE_ARENA_046.duracionS`);
- semillas 1–100 y 101–200, v10 frente a v11.

Script: `medir.mts`, que usa `src/arena/metricas-070.ts`. Datos: `reinicios-v{10,11}-{1,101}-100.json` (con los
conteos por partido). Uso: `node --import tsx docs/evidencia/motor-070/medir.mts reinicios-v11 1 100`.

| Lote | Reglas | Faltas/p | Recupera el infractor (§ 1) | Ídem con intercepciones | Tiros libres/p | Directos/p (goles) | Penales/p | Conversión | Goles/p | Tiros/p | Fueras de juego/p |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1–100 | v10 | 2,19 | 25,1 % (55/219) | 27,9 % | — | — | — | — | 2,41 | 5,70 | 1,15 |
| 1–100 | **v11** | 1,83 | **8,2 %** (15/183) | 15,8 % | 1,65 | 0,04 (1) | **0,18** | 11/18 = 0,61 | 2,33 | 5,65 | 1,20 |
| 101–200 | v10 | 1,55 | 26,5 % | 28,4 % | — | — | — | — | 2,50 | 5,78 | 1,10 |
| 101–200 | v11 | 1,34 | 7,5 % | 17,2 % | 1,18 | 0,02 (1) | 0,16 | 12/16 = 0,75 | 2,43 | 5,67 | 1,10 |

- «Recupera el infractor» es la métrica del § 1 del brief, la misma del diagnóstico: faltas tras las que el equipo
  infractor tiene una `recuperacion` o comete otra `falta` con tick ≤ tick de la falta + 4,5 s (la ventana empieza en la
  falta e incluye la pausa; los `reinicio` no cuentan). La columna siguiente añade las `intercepcion` (un tiro libre es un
  pase): es informativa, sin banda.
- Rivales a < 9,15 m del balón en el tick de ejecución: **0** en las 179 ejecuciones (tiros libres y penales) de 1–100
  y en las 134 de 101–200.
- Conversión de penales en 1–200 juntas: **23/34 = 0,676** (banda 0,6–0,9), sobre los penales lanzados. Desenlaces:
  23 goles, 6 atajadas, 3 fuera y 2 sin desenlace: en las semillas 21 y 29 el penal se lanza en el último instante y el
  partido termina con el balón en vuelo (cuentan como no convertidos; sobre los 32 resueltos, 0,719).
- Fueras de juego tras un tiro libre: 20 de 165 en 1–100 y 11 de 118 en 101–200. El tiro libre no limpia
  `adelantados` (como pide el brief) y el ejecutor, sin orden, pasa al compañero más cercano, como en los otros saques.
- Tiros libres con opción de directo (≤ 25 m y pasillo de 12 m): 10 de 165 en 1–100 (32 a ≤ 30 m del centro del
  arco); salieron 4 directos, todos dentro del pasillo. En 101–200, 7 de 118 y 2 directos. Ningún directo salió de una
  orden `tirar` fuera del pasillo. Script: `directos.mts`.

## Bandas `BANDAS_070`

Se miden sobre v11 y se comprueban en `motor070.stats.test.ts`.

| Banda | Valor | Resultado |
|---|---|---|
| Recuperación del infractor (1–100) | 8,2 % (≤ 10 %) | cumple |
| Rivales a < 9,15 m en la ejecución (1–100) | 0 | cumple |
| Penales por partido (1–100) | 0,18, en [0,08; 0,35] | cumple |
| Conversión de penales (1–200 juntas) | 0,676, en [0,6; 0,9] | cumple |
| Faltas y demás bandas del 068 (1–100) | 1,83 faltas, 1,20 fueras de juego, goles 2,33 ≥ 2,16 × 0,95 | cumple |

Bandas viejas (046 recalibradas, 051 y 063 A, B y C) sobre v11, sin incumplimientos en los tres lotes:
- el rápido (1–30): `viejas-v11-rapido.json`;
- 1–100: `viejas-v11-1-100.json` (goles 2,33; conversión 0,412; mano a mano 0,362 ≤ 0,42);
- 101–200: `viejas-v11-101-100.json` (goles 2,43; conversión 0,423; mano a mano 0,363). En este lote las bandas del 068
  de faltas no aplican (se miden en 1–100, como en el 068: v10 ya tenía 1,55 faltas y 32 % sin falta en 101–200).

Script: `viejas.mts`. Los penales no cuentan como mano a mano: el muestreo excluye los ticks con saque y el balón sale
en vuelo en el mismo tick.

## Constantes finales

Sin iteraciones: `LIBRE_ARENA.probDirecto` 0,5 y `PENAL_ARENA.conversion` 0,76 son las propuestas del brief.

## Otros resultados

- Coste de la petición: el cociente pasa de 1,2482 a 1,2723 (v10/v5 y v11/v5, semillas 1–50) por `frasesTiroLibre()` en
  el sistema; `factorObservacion063` sube de 1,38 a 1,40 y las entradas del sitio se regeneran (promptMax 14.324).
- Voz: en `voz/` (0 rechazos; peor caso ES+EN narrador 52 / 20.271 c, invitados 26 / 19.828 c).
- `npm run test:stats`: 85/85 en 888 s (`test-stats-070.txt`).
- Mutaciones: en `mutaciones.txt`.
