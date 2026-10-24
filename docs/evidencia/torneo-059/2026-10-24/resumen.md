# Torneo entre modelos · 2026-10-24

Generado por `npm run arena:torneo` a partir de `torneo.json` (no editar a mano; CI lo regenera y lo compara byte a byte).

- Inicio: 2026-10-24T01:31:50.961Z · fin: 2026-10-24T01:47:19.869Z · commit `c0231302197893816f457300321d8d9f2f09b9fc`
- Motor `arena-v3` · reglas `reinicios-v5` · 60 s por partido, intervalo 15 s · semilla 59
- Estado: completo

## Participantes

| Modelo | Deployment | Modelo y versión | Controlador | Precio entrada / salida / caché (USD por 1M) |
|---|---|---|---|---|
| GPT-5.6 Luna | `cronista-equilibrado` | gpt-5.6-luna 2026-07-09 | `azure-openai:cronista-equilibrado:reasoning-low` | 0.2 / 1.2 / 0.02 |
| GPT-5.4 mini | `cronista-rapido` | gpt-5.4-mini 2026-03-17 | `azure-openai:cronista-rapido:reasoning-low` | 0.75 / 4.5 / 0.075 |
| GPT-6 Luna | `cronista-luna6` | gpt-6-luna 2026-09-22 | `azure-openai:cronista-luna6:reasoning-low` | 0.1 / 0.5 / 0.01 |
| GPT-6 Sol | `cronista-sol6` | gpt-6-sol 2026-09-22 | `azure-openai:cronista-sol6:reasoning-low` | 2 / 10 / 0.2 |
| GPT-6 Astra | `cronista-astra6` | gpt-6-astra 2026-09-03 | `azure-openai:cronista-astra6:reasoning-low` | 10 / 50 / 1 |
| GPT-6.1 Sol | `cronista-sol61` | gpt-6.1-sol 2026-09-29 | `azure-openai:cronista-sol61:reasoning-low` | 2 / 10 / 0.2 († precio estimado con el de `cronista-sol6`) |

## Clasificación

| Pos | Modelo | PJ | G-E-P | Goles (GF:GC) | DG | Pts |
|---|---|---|---|---|---|---|
| 1 | GPT-6 Astra | 10 | 5-4-1 | 7:2 | +5 | 19 |
| 2 | GPT-6.1 Sol | 10 | 4-4-2 | 7:4 | +3 | 16 |
| 3 | GPT-5.4 mini | 10 | 4-3-3 | 5:4 | +1 | 15 |
| 4 | GPT-6 Luna | 10 | 4-3-3 | 6:6 | 0 | 15 |
| 5 | GPT-6 Sol | 10 | 2-2-6 | 6:10 | -4 | 8 |
| 6 | GPT-5.6 Luna | 10 | 1-4-5 | 3:8 | -5 | 7 |

«=» indica posición compartida tras puntos, DG, GF y la liguilla entre los empatados.

## Resultados (local en filas, visita en columnas)

| Local \ Visita | GPT-6 Astra | GPT-6.1 Sol | GPT-5.4 mini | GPT-6 Luna | GPT-6 Sol | GPT-5.6 Luna |
|---|---|---|---|---|---|---|
| GPT-6 Astra | — | 0–0 (P28) | 2–0 (P4) | 1–0 (P10) | 1–0 (P16) | 1–0 (P22) |
| GPT-6.1 Sol | 1–0 (P13) | — | 0–1 (P3) | 2–0 (P20) | 0–1 (P8) | 0–0 (P27) |
| GPT-5.4 mini | 0–0 (P19) | 0–0 (P18) | — | 0–1 (P9) | 1–0 (P26) | 0–0 (P14) |
| GPT-6 Luna | 0–0 (P25) | 0–1 (P5) | 1–0 (P24) | — | 2–1 (P15) | 1–1 (P17) |
| GPT-6 Sol | 1–1 (P1) | 1–2 (P23) | 0–2 (P11) | 0–0 (P30) | — | 0–1 (P6) |
| GPT-5.6 Luna | 0–1 (P7) | 1–1 (P12) | 0–1 (P29) | 0–1 (P2) | 0–2 (P21) | — |

## Partidos por jornada

- J1 · P1 · Sporting Marisal (GPT-6 Sol) 1–1 Atlético Quebralta (GPT-6 Astra) · `e01.json.gz` · sha256 `fa08f4274de9…`
- J1 · P2 · Atlético Nebrisa (GPT-5.6 Luna) 0–1 Unión Caleteo (GPT-6 Luna) · `e02.json.gz` · sha256 `21500524bc5f…`
- J1 · P3 · Unión Pradoalto (GPT-6.1 Sol) 0–1 Sporting Torreluna (GPT-5.4 mini) · `e03.json.gz` · sha256 `07262ddcf528…`
- J2 · P4 · Sporting Pradoalto (GPT-6 Astra) 2–0 Racing Arenablanca (GPT-5.4 mini) · `e04.json.gz` · sha256 `d102071852f6…`
- J2 · P5 · Racing Marisal (GPT-6 Luna) 0–1 Sporting Valdecristal (GPT-6.1 Sol) · `e05.json.gz` · sha256 `132a4782cb45…`
- J2 · P6 · Club Solcanto (GPT-6 Sol) 0–1 Olímpico Arenablanca (GPT-5.6 Luna) · `e06.json.gz` · sha256 `25920953e39d…`
- J3 · P7 · Unión Ventolera (GPT-5.6 Luna) 0–1 Sporting Islaverde Sur (GPT-6 Astra) · `e07.json.gz` · sha256 `6e6308329bd8…`
- J3 · P8 · Sporting Puertoscuro (GPT-6.1 Sol) 0–1 Club Quebralta (GPT-6 Sol) · `e08.json.gz` · sha256 `4b36be5c70fe…`
- J3 · P9 · Sporting Islaverde Sur (GPT-5.4 mini) 0–1 Deportivo Islaverde Sur (GPT-6 Luna) · `e09.json.gz` · sha256 `e30f0a7a5cb2…`
- J4 · P10 · Racing Pradoalto (GPT-6 Astra) 1–0 Atlético Ventolera (GPT-6 Luna) · `e10.json.gz` · sha256 `286d3a2b12ab…`
- J4 · P11 · Atlético Lumbrera (GPT-6 Sol) 0–2 Deportivo Arenablanca (GPT-5.4 mini) · `e11.json.gz` · sha256 `2d73c54c10e9…`
- J4 · P12 · Olímpico Ventolera (GPT-5.6 Luna) 1–1 Unión Solcanto (GPT-6.1 Sol) · `e12.json.gz` · sha256 `ae0a238ee931…`
- J5 · P13 · Atlético Islaverde Sur (GPT-6.1 Sol) 1–0 Unión Brezal (GPT-6 Astra) · `e13.json.gz` · sha256 `0aa7f460f1cf…`
- J5 · P14 · Atlético Ormidia (GPT-5.4 mini) 0–0 Deportivo Solcanto (GPT-5.6 Luna) · `e14.json.gz` · sha256 `c5720fe603e3…`
- J5 · P15 · Atlético Ventolera (GPT-6 Luna) 2–1 Unión Quebralta (GPT-6 Sol) · `e15.json.gz` · sha256 `3500f020984e…`
- J6 · P16 · Sporting Marisal (GPT-6 Astra) 1–0 Atlético Quebralta (GPT-6 Sol) · `e16.json.gz` · sha256 `c9ef6ccaa093…`
- J6 · P17 · Atlético Nebrisa (GPT-6 Luna) 1–1 Unión Caleteo (GPT-5.6 Luna) · `e17.json.gz` · sha256 `880793032758…`
- J6 · P18 · Unión Pradoalto (GPT-5.4 mini) 0–0 Sporting Torreluna (GPT-6.1 Sol) · `e18.json.gz` · sha256 `9c159e68f0c1…`
- J7 · P19 · Sporting Pradoalto (GPT-5.4 mini) 0–0 Racing Arenablanca (GPT-6 Astra) · `e19.json.gz` · sha256 `fe2d53379473…`
- J7 · P20 · Racing Marisal (GPT-6.1 Sol) 2–0 Sporting Valdecristal (GPT-6 Luna) · `e20.json.gz` · sha256 `eb1c047b872c…`
- J7 · P21 · Club Solcanto (GPT-5.6 Luna) 0–2 Olímpico Arenablanca (GPT-6 Sol) · `e21.json.gz` · sha256 `7807e9a91437…`
- J8 · P22 · Unión Ventolera (GPT-6 Astra) 1–0 Sporting Islaverde Sur (GPT-5.6 Luna) · `e22.json.gz` · sha256 `4fd9b4b468d4…`
- J8 · P23 · Sporting Puertoscuro (GPT-6 Sol) 1–2 Club Quebralta (GPT-6.1 Sol) · `e23.json.gz` · sha256 `67ee2b68ba56…`
- J8 · P24 · Sporting Islaverde Sur (GPT-6 Luna) 1–0 Deportivo Islaverde Sur (GPT-5.4 mini) · `e24.json.gz` · sha256 `33649ce04507…`
- J9 · P25 · Racing Pradoalto (GPT-6 Luna) 0–0 Atlético Ventolera (GPT-6 Astra) · `e25.json.gz` · sha256 `9ee28c7a92e4…`
- J9 · P26 · Atlético Lumbrera (GPT-5.4 mini) 1–0 Deportivo Arenablanca (GPT-6 Sol) · `e26.json.gz` · sha256 `0163d074c90b…`
- J9 · P27 · Olímpico Ventolera (GPT-6.1 Sol) 0–0 Unión Solcanto (GPT-5.6 Luna) · `e27.json.gz` · sha256 `cd34ed79d9c5…`
- J10 · P28 · Atlético Islaverde Sur (GPT-6 Astra) 0–0 Unión Brezal (GPT-6.1 Sol) · `e28.json.gz` · sha256 `ad27a6a1a5a0…`
- J10 · P29 · Atlético Ormidia (GPT-5.6 Luna) 0–1 Deportivo Solcanto (GPT-5.4 mini) · `e29.json.gz` · sha256 `d00eac8af029…`
- J10 · P30 · Atlético Ventolera (GPT-6 Sol) 0–0 Unión Quebralta (GPT-6 Luna) · `e30.json.gz` · sha256 `0741fefe8216…`

## Gasto (tope por estimación)

- Gasto conocido†: 6.9665 USD (usage informado por la API a precio de lista, más el máximo estimado de cada intento sin usage y de cada reserva sin cierre).
- Típico estimado: 7.0768 USD · tope por estimación: 16.0000 USD · reserva del partido más caro: 7.3696 USD.
- † Declarado por el ejecutor; no se puede comprobar con el registro. El precio de lista no es la factura: el control real del gasto es la facturación de Azure.

## Lo que esta tabla no demuestra

- En una prueba de signos ilustrativa —que supone cruces independientes y una probabilidad de ½ de ganar cada uno—, ni ganar los 5 cruces alcanzaría p < 0,05 (p = 0,0625). La tabla describe este torneo; no ordena los modelos por calidad.
- Cada modelo juega con los dos clubes y en los dos lados de cada cruce; eso reparte las condiciones entre los modelos, no elimina su efecto.
- Recalculado por el motor: goles, clubes, configuración, semilla y cifras del 049. Declarado por el ejecutor (con la huella SHA-256 del archivo íntegro): latencias, solicitudes, motivos, identidad del modelo por lado, tokens, coste y modelos devueltos.
- Motor 2D sintético con parámetros por calibrar y reglas simplificadas; no es un partido reglamentario.
