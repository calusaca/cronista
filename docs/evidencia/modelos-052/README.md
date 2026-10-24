# Brief 052 — modelos de otras familias: evidencia de admisión

Generado por `npm run arena:smoke-modelos` (no editar a mano; se regenera en cada corrida).
Criterio (v1.1 §3): las 4 partidas (espejo, cruzado A, cruzado B invertido y web 180 s / 30 s) suman las decisiones esperadas del candidato; todas con `origen: "controlador"`, `tiempoMs ≤ 30.000`, ≤ 2 solicitudes, `respuestasConUso === llamadas`, precio anotado en [precios.json](precios.json). Solo cuentan las decisiones cuyo `controlador` es el candidato; las del rival (`cronista-rapido`) se reportan aparte.

Condición de publicación (§5): si la proyección de gasto no cabe en el crédito, se retira del catálogo el modelo más caro hasta cumplirla. «Apto en smoke; no publicado (§5)» = pasó los cuatro partidos pero queda con `publicar: false` en `infra/modelos-arena.json` y fuera de `ARENA_MODELOS` (motivo en `precios.json` → `presupuesto.retiradosPorCosto`).

Sin muestras crudas: se guardan indicadores (`teniaThink`, `reasoningContentChars`, `finish`, tokens) y nunca texto del modelo, claves ni endpoints. Ningún resultado demuestra que un modelo sea mejor entrenador.

## Resultado por modelo

| Modelo (deployment) | Estado | Formato | Decisiones válidas | Latencia máx. / mediana | Solicitudes máx. | Tokens entrada / salida | Costo smoke | Causa |
|---|---|---|---|---|---|---|---|---|
| GPT-6 Astra (`cronista-astra6`, gpt-6-astra) | apto en smoke; **no publicado** (§5) | json_schema (azure-openai) | 22 / 22 | 10.615 / 9393 ms | 1 | 203.290 / 9705 | 2,3088 USD | §5: pasó el smoke (22/22), pero es el más caro del catálogo (10 / 50 USD por 1M, ≈ 2,71 USD por lado y ≈ 5,58 USD por partido Astra contra Astra en la cota de §5); con él la proyección hasta el 10 nov pasa de ≈ 160 a ≈ 1.150 USD. Retirado primero (decisión de Opus el 22 oct al aplicar §5; Carlos puede revertirla). |
| Grok 4.7 (Foundry) (`cronista-grok`, grok-4.7) | probado, no admitido | json_schema | 17 / 22 | 60.002 / 32.173 ms | 1 | 162.265 / 26.197 (incl. razonamiento informado fuera de completion) | 0,4444 USD | 5 de 22 decisiones cayeron a respaldo (error_controlador, plazo_agotado); 13 decisiones > 30000 ms (máx. 60002 ms); respuestasConUso (17) ≠ llamadas (22) |
| GPT-6 Luna (`cronista-luna6`, gpt-6-luna) | **admitido** | json_schema (azure-openai) | 22 / 22 | 8488 / 6084 ms | 1 | 204.784 / 13.070 | 0,0249 USD | — |
| gpt-oss-120b (open weights, Foundry) (`cronista-oss`, gpt-oss-120b) | probado, no admitido | ninguno ok (partidos con json_object) | 2 / 22 | 24.314 / 13.220 ms | 2 | 262.371 / 53.800 | 0,0716 USD | sonda sin formato ok (json_schema/inicio: ok, json_schema/mitad: truncado, json_object/inicio: ok, json_object/mitad: semantico, texto/inicio: semantico); 20 de 22 decisiones cayeron a respaldo (error_controlador, orden_invalida) |
| GPT-6 Sol (`cronista-sol6`, gpt-6-sol) | apto en smoke; **no publicado** (§5) | json_schema (azure-openai) | 22 / 22 | 10.869 / 6521 ms | 2 | 214.009 / 12.133 | 0,4900 USD | §5: pasó el smoke (22/22), pero con 2 / 10 USD por 1M (≈ 0,55 USD por lado y ≈ 1,27 USD por partido Sol contra Sol en la cota de §5) casi duplica la proyección previa, que ya no cumple. Retirado después de Astra (decisión de Opus el 22 oct al aplicar §5; Carlos puede revertirla). |
| GPT-6.1 Sol (`cronista-sol61`, gpt-6.1-sol) | **admitido** | json_schema (azure-openai) | 22 / 22 | 10.711 / 8417 ms | 1 | 204.523 / 10.496 | 0,4698 USD | — |
| DeepSeek-V4-Flash | no probado | — | — | — | — | — | — | no probado: cuota GlobalStandard 0 en la suscripción (InsufficientQuota); sin deployment |
| Llama-4-Maverick-17B-128E-Instruct-FP8 | no probado | — | — | — | — | — | — | no probado: cuota GlobalStandard 0 en la suscripción (InsufficientQuota); sin deployment |
| Llama-4-Scout-17B-16E-Instruct | no probado | — | — | — | — | — | — | no probado: Marketplace no ofrece el producto a la región de facturación de la cuenta (CR); sin deployment |
| mistral-medium-2505 | no probado | — | — | — | — | — | — | no probado: Marketplace no ofrece el producto a la región de facturación de la cuenta (CR); sin deployment |

## Sonda de formato (esquema real, 2048 tokens)

| Deployment | Formato | Observación | Resultado | HTTP | ms | finish | entrada / salida / razonamiento | marcador think | reasoning_content (caracteres) | Respeta esquema |
|---|---|---|---|---|---|---|---|---|---|---|
| `cronista-astra6` | json_schema | inicio | ok | 200 | 8882 | stop | 7748 / 430 / 0 | no | 0 | sí |
| `cronista-astra6` | json_schema | mitad | ok | 200 | 9332 | stop | 9340 / 438 / 0 | no | 0 | sí |
| `cronista-grok` | json_schema | inicio | ok | 200 | 32.187 | stop | 8118 / 417 / 873 | no | 0 | sí |
| `cronista-grok` | json_schema | mitad | ok | 200 | 40.129 | stop | 9741 / 475 / 1149 | no | 0 | sí |
| `cronista-luna6` | json_schema | inicio | ok | 200 | 6608 | stop | 7748 / 580 / 155 | no | 0 | sí |
| `cronista-luna6` | json_schema | mitad | ok | 200 | 8655 | stop | 9340 / 856 / 381 | no | 0 | sí |
| `cronista-oss` | json_schema | inicio | ok | 200 | 12.808 | stop | 7255 / 1800 / — | no | 4288 | sí |
| `cronista-oss` | json_schema | mitad | truncado | 200 | 12.493 | length | 8824 / 2048 / — | no | 6355 | — |
| `cronista-oss` | json_object | inicio | ok | 200 | 10.595 | stop | 7255 / 1877 / — | no | 4704 | sí |
| `cronista-oss` | json_object | mitad | semantico | 200 | 7704 | stop | 8824 / 1517 / — | no | 5091 | no |
| `cronista-oss` | texto | inicio | semantico | 200 | 8459 | stop | 7255 / 1841 / — | no | 5218 | no |
| `cronista-sol6` | json_schema | inicio | ok | 200 | 6364 | stop | 7748 / 470 / 46 | no | 0 | sí |
| `cronista-sol6` | json_schema | mitad | ok | 200 | 6953 | stop | 9340 / 561 / 71 | no | 0 | sí |
| `cronista-sol61` | json_schema | inicio | ok | 200 | 8088 | stop | 7748 / 434 / 0 | no | 0 | sí |
| `cronista-sol61` | json_schema | mitad | ok | 200 | 7458 | stop | 9340 / 431 / 0 | no | 0 | sí |

## Partidos

| Deployment | Partido | Duración / intervalo | Esperadas / observadas | Respaldos del candidato | Latencia máx. candidato | HTTP del candidato | finish del candidato | Prompt máx. | Marcador |
|---|---|---|---|---|---|---|---|---|---|
| `cronista-astra6` | espejo | 60 s / 15 s | 8 / 8 | 0 | 10.615 ms | 200×8 | stop×8 | 9713 | {"local":1,"visita":1} |
| `cronista-astra6` | cruzadoA | 60 s / 15 s | 4 / 4 | 0 | 9627 ms | 200×4 | stop×4 | 9777 | {"local":1,"visita":1} |
| `cronista-astra6` | cruzadoB | 60 s / 15 s | 4 / 4 | 0 | 9805 ms | 200×4 | stop×4 | 9833 | {"local":0,"visita":0} |
| `cronista-astra6` | web | 180 s / 30 s | 6 / 6 | 0 | 9772 ms | 200×6 | stop×6 | 9877 | {"local":1,"visita":1} |
| `cronista-grok` | espejo | 60 s / 15 s | 8 / 8 | 3 (error_controlador) | 50.045 ms | 200×5, 429×3 | — | 10.231 | {"local":0,"visita":0} |
| `cronista-grok` | cruzadoA | 60 s / 15 s | 4 / 4 | 0 | 45.424 ms | 200×4 | — | 10.209 | {"local":0,"visita":0} |
| `cronista-grok` | cruzadoB | 60 s / 15 s | 4 / 4 | 1 (plazo_agotado) | 60.002 ms | 0×1, 200×3 | — | 10.136 | {"local":1,"visita":1} |
| `cronista-grok` | web | 180 s / 30 s | 6 / 6 | 1 (plazo_agotado) | 60.001 ms | 0×1, 200×5 | — | 10.280 | {"local":0,"visita":0} |
| `cronista-luna6` | espejo | 60 s / 15 s | 8 / 8 | 0 | 7973 ms | 200×8 | — | 9928 | {"local":0,"visita":0} |
| `cronista-luna6` | cruzadoA | 60 s / 15 s | 4 / 4 | 0 | 7432 ms | 200×4 | — | 9787 | {"local":0,"visita":0} |
| `cronista-luna6` | cruzadoB | 60 s / 15 s | 4 / 4 | 0 | 7352 ms | 200×4 | — | 9887 | {"local":1,"visita":0} |
| `cronista-luna6` | web | 180 s / 30 s | 6 / 6 | 0 | 8488 ms | 200×6 | — | 9896 | {"local":2,"visita":1} |
| `cronista-oss` | espejo | 60 s / 15 s | 8 / 8 | 7 (error_controlador, orden_invalida) | 24.314 ms | 200×10 | — | 10.222 | {"local":0,"visita":0} |
| `cronista-oss` | cruzadoA | 60 s / 15 s | 4 / 4 | 4 (orden_invalida, error_controlador) | 21.017 ms | 200×6 | — | 10.208 | {"local":0,"visita":0} |
| `cronista-oss` | cruzadoB | 60 s / 15 s | 4 / 4 | 3 (error_controlador) | 21.920 ms | 200×6 | — | 9825 | {"local":0,"visita":0} |
| `cronista-oss` | web | 180 s / 30 s | 6 / 6 | 6 (error_controlador, orden_invalida) | 18.137 ms | 200×8 | — | 9352 | {"local":0,"visita":1} |
| `cronista-sol6` | espejo | 60 s / 15 s | 8 / 8 | 0 | 7463 ms | 200×8 | stop×8 | 9915 | {"local":0,"visita":0} |
| `cronista-sol6` | cruzadoA | 60 s / 15 s | 4 / 4 | 0 | 6199 ms | 200×4 | stop×4 | 9695 | {"local":1,"visita":0} |
| `cronista-sol6` | cruzadoB | 60 s / 15 s | 4 / 4 | 0 | 6967 ms | 200×4 | stop×4 | 9860 | {"local":1,"visita":1} |
| `cronista-sol6` | web | 180 s / 30 s | 6 / 6 | 0 | 10.869 ms | 200×7 | stop×7 | 10.292 | {"local":0,"visita":1} |
| `cronista-sol61` | espejo | 60 s / 15 s | 8 / 8 | 0 | 10.711 ms | 200×8 | stop×8 | 9903 | {"local":0,"visita":1} |
| `cronista-sol61` | cruzadoA | 60 s / 15 s | 4 / 4 | 0 | 9380 ms | 200×4 | stop×4 | 9823 | {"local":0,"visita":1} |
| `cronista-sol61` | cruzadoB | 60 s / 15 s | 4 / 4 | 0 | 9318 ms | 200×4 | stop×4 | 9716 | {"local":1,"visita":1} |
| `cronista-sol61` | web | 180 s / 30 s | 6 / 6 | 0 | 9255 ms | 200×6 | stop×6 | 10.041 | {"local":4,"visita":2} |

## Costo estimado por lado en un partido web (§5)

| Deployment | Precio entrada / salida (USD/1M) | Prompt máx. web | Costo por lado | Nota |
|---|---|---|---|---|
| `cronista-astra6` | 10 / 50 | 9877 | 2,7104 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2048 × salida) / 1e6 (§5). |
| `cronista-grok` | 2 / 6 | 10.280 | 0,4692 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2234 × salida) / 1e6 (§5). El proveedor informa reasoning_tokens fuera de completion_tokens (total_tokens = prompt + completion + reasoning): se facturan como salida y max_tokens no los acota; la cota de salida por solicitud es la mayor observada. |
| `cronista-luna6` | 0.1 / 0.5 | 9896 | 0,0271 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2048 × salida) / 1e6 (§5). |
| `cronista-oss` | 0.15 / 0.6 | 9352 | 0,0358 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2048 × salida) / 1e6 (§5). |
| `cronista-sol6` | 2 / 10 | 10.292 | 0,5545 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2048 × salida) / 1e6 (§5). |
| `cronista-sol61` | 2 / 10 | 10.041 | 0,5470 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2048 × salida) / 1e6 (§5). |

## Condición de presupuesto (§5)

Entrada por solicitud: prompt máximo web observado 10.471 × 1.25; 12 solicitudes por lado; salida 2048 tokens (o la mayor observada si el razonamiento va fuera de `completion_tokens`). Narrador/comentarista: 12 llamadas en `cronista-rapido` × (10.471 de entrada como cota + 1200 de salida) = 0,159 USD. Speech: 120.000 caracteres/día × 15 USD/1M = 1,80 USD/día. Días hasta el 2026-11-10: 18. Condición: (costoMaxPartido × 10 + Speech/día) × días ≤ crédito − 30.

| Catálogo | Modelo más caro | Costo máx. por partido | Gasto proyectado | Crédito | Margen | ¿Cumple? |
|---|---|---|---|---|---|---|
| previo al 052 (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | hipótesis (pendiente de Carlos): 50 USD | -1016,77 USD | **no** |
| previo al 052 (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | último dato verificado (10 oct): 150 USD | -916,77 USD | **no** |
| publicado + admitidos (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | hipótesis (pendiente de Carlos): 50 USD | -1016,77 USD | **no** |
| publicado + admitidos (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | último dato verificado (10 oct): 150 USD | -916,77 USD | **no** |
| publicado + cronista-astra6 (apto en smoke, retirado por §5, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | hipótesis (pendiente de Carlos): 50 USD | -1016,77 USD | **no** |
| publicado + cronista-astra6 (apto en smoke, retirado por §5, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | último dato verificado (10 oct): 150 USD | -916,77 USD | **no** |
| publicado + cronista-grok (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`, `cronista-grok`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | hipótesis (pendiente de Carlos): 50 USD | -1016,77 USD | **no** |
| publicado + cronista-grok (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`, `cronista-grok`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | último dato verificado (10 oct): 150 USD | -916,77 USD | **no** |
| publicado + cronista-oss (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`, `cronista-oss`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | hipótesis (pendiente de Carlos): 50 USD | -1016,77 USD | **no** |
| publicado + cronista-oss (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`, `cronista-oss`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | último dato verificado (10 oct): 150 USD | -916,77 USD | **no** |
| publicado + cronista-sol6 (apto en smoke, retirado por §5, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | hipótesis (pendiente de Carlos): 50 USD | -1016,77 USD | **no** |
| publicado + cronista-sol6 (apto en smoke, retirado por §5, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-sol6`, `cronista-astra6`, `cronista-luna6`, `cronista-sol61`) | `cronista-astra6` 2,710 USD/lado | 5,580 USD | 1036,77 USD | último dato verificado (10 oct): 150 USD | -916,77 USD | **no** |

## Despliegues intentados

| Deployment | Modelo | Resultado | Capacidad aceptada | Error |
|---|---|---|---|---|
| `cronista-luna6` | gpt-6-luna | Succeeded | 30 | — |
| `cronista-deepseek` | DeepSeek-V4-Flash | fallido | — | (InsufficientQuota) This operation require 50 new capacity in quota Requests Per Minute - DeepSeek-V4-Flash, which is bigger than the current available capacity 0. The current quota usage is 0 and the quota limit is 0 for quota Requests Per Minute - DeepSeek-V4-Flash. |
| `cronista-llama` | Llama-4-Maverick-17B-128E-Instruct-FP8 | fallido | — | (InsufficientQuota) This operation require 10 new capacity in quota Tokens Per Minute (thousands) - Llama-4-Maverick-17B-128E-Instruct-FP8, which is bigger than the current available capacity 0. The current quota usage is 0 and the quota limit is 0 for quota Tokens Per Minute (thousands) - Llama-4-Maverick-17B-128E-Instruct-FP8. |
| `cronista-llama` | Llama-4-Scout-17B-16E-Instruct | fallido | — | (UserError) Error occurred when subscribing to Marketplace: Marketplace Subscription purchase eligibility check failed, error message [Publisher 'metagenai' does not offer product 'llama-4-scout-17b-16e-instruct-offer', plan 'llama-4-scout-17b-16e-instruct-plan', in your subscription/Azure account's region 'CR'.] |
| `cronista-grok` | grok-4.7 | Succeeded | 10 | — |
| `cronista-mistral` | mistral-medium-2505 | fallido | — | (UserError) Error occurred when subscribing to Marketplace: Marketplace Subscription purchase eligibility check failed, error message [Publisher '000-000' does not offer product 'mistral-medium-2505', plan 'mistral-medium-2505-paid-tier', in your subscription/Azure account's region 'CR'.] |
| `cronista-oss` | gpt-oss-120b | Succeeded | 50 | — |
| `cronista-sol6` | gpt-6-sol | Succeeded | 100 | — |
| `cronista-astra6` | gpt-6-astra | Succeeded | 100 | — |
| `cronista-sol61` | gpt-6.1-sol | Succeeded | 100 | — |

Precios: [precios.json](precios.json) (Azure Retail Prices API). Despliegues: [despliegues.json](despliegues.json). Detalle por decisión: `<id>.json`.
