# Brief 052 — modelos de otras familias: evidencia de admisión

Generado por `npm run arena:smoke-modelos` (no editar a mano; se regenera en cada corrida).
Criterio (v1.1 §3): las 4 partidas (espejo, cruzado A, cruzado B invertido y web 180 s / 30 s) suman las decisiones esperadas del candidato; todas con `origen: "controlador"`, `tiempoMs ≤ 30.000`, ≤ 2 solicitudes, `respuestasConUso === llamadas`, precio anotado en [precios.json](precios.json). Solo cuentan las decisiones cuyo `controlador` es el candidato; las del rival (`cronista-rapido`) se reportan aparte.

Sin muestras crudas: se guardan indicadores (`teniaThink`, `reasoningContentChars`, `finish`, tokens) y nunca texto del modelo, claves ni endpoints. Ningún resultado demuestra que un modelo sea mejor entrenador.

## Resultado por modelo

| Modelo (deployment) | Estado | Formato | Decisiones válidas | Latencia máx. / mediana | Solicitudes máx. | Tokens entrada / salida | Costo smoke | Causa |
|---|---|---|---|---|---|---|---|---|
| Grok 4.7 (Foundry) (`cronista-grok`, grok-4.7) | probado, no admitido | json_schema | 17 / 22 | 60.002 / 32.173 ms | 1 | 162.265 / 26.197 (incl. razonamiento informado fuera de completion) | 0,4444 USD | 5 de 22 decisiones cayeron a respaldo (error_controlador, plazo_agotado); 13 decisiones > 30000 ms (máx. 60002 ms); respuestasConUso (17) ≠ llamadas (22) |
| GPT-6 Luna (`cronista-luna6`, gpt-6-luna) | **admitido** | json_schema (azure-openai) | 22 / 22 | 8488 / 6084 ms | 1 | 204.784 / 13.070 | 0,0249 USD | — |
| gpt-oss-120b (open weights, Foundry) (`cronista-oss`, gpt-oss-120b) | probado, no admitido | ninguno ok (partidos con json_object) | 2 / 22 | 24.314 / 13.220 ms | 2 | 262.371 / 53.800 | 0,0716 USD | sonda sin formato ok (json_schema/inicio: ok, json_schema/mitad: truncado, json_object/inicio: ok, json_object/mitad: semantico, texto/inicio: semantico); 20 de 22 decisiones cayeron a respaldo (error_controlador, orden_invalida) |
| DeepSeek-V4-Flash | no probado | — | — | — | — | — | — | no probado: cuota GlobalStandard 0 en la suscripción (InsufficientQuota); sin deployment |
| Llama-4-Maverick-17B-128E-Instruct-FP8 | no probado | — | — | — | — | — | — | no probado: cuota GlobalStandard 0 en la suscripción (InsufficientQuota); sin deployment |
| Llama-4-Scout-17B-16E-Instruct | no probado | — | — | — | — | — | — | no probado: Marketplace no ofrece el producto a la región de facturación de la cuenta (CR); sin deployment |
| mistral-medium-2505 | no probado | — | — | — | — | — | — | no probado: Marketplace no ofrece el producto a la región de facturación de la cuenta (CR); sin deployment |

## Sonda de formato (esquema real, 2048 tokens)

| Deployment | Formato | Observación | Resultado | HTTP | ms | finish | entrada / salida / razonamiento | marcador think | reasoning_content (caracteres) | Respeta esquema |
|---|---|---|---|---|---|---|---|---|---|---|
| `cronista-grok` | json_schema | inicio | ok | 200 | 32.187 | stop | 8118 / 417 / 873 | no | 0 | sí |
| `cronista-grok` | json_schema | mitad | ok | 200 | 40.129 | stop | 9741 / 475 / 1149 | no | 0 | sí |
| `cronista-luna6` | json_schema | inicio | ok | 200 | 6608 | stop | 7748 / 580 / 155 | no | 0 | sí |
| `cronista-luna6` | json_schema | mitad | ok | 200 | 8655 | stop | 9340 / 856 / 381 | no | 0 | sí |
| `cronista-oss` | json_schema | inicio | ok | 200 | 12.808 | stop | 7255 / 1800 / — | no | 4288 | sí |
| `cronista-oss` | json_schema | mitad | truncado | 200 | 12.493 | length | 8824 / 2048 / — | no | 6355 | — |
| `cronista-oss` | json_object | inicio | ok | 200 | 10.595 | stop | 7255 / 1877 / — | no | 4704 | sí |
| `cronista-oss` | json_object | mitad | semantico | 200 | 7704 | stop | 8824 / 1517 / — | no | 5091 | no |
| `cronista-oss` | texto | inicio | semantico | 200 | 8459 | stop | 7255 / 1841 / — | no | 5218 | no |

## Partidos

| Deployment | Partido | Duración / intervalo | Esperadas / observadas | Respaldos del candidato | Latencia máx. candidato | HTTP del candidato | finish del candidato | Prompt máx. | Marcador |
|---|---|---|---|---|---|---|---|---|---|
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

## Costo estimado por lado en un partido web (§5)

| Deployment | Precio entrada / salida (USD/1M) | Prompt máx. web | Costo por lado | Nota |
|---|---|---|---|---|
| `cronista-grok` | 2 / 6 | 10.280 | 0,4692 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2234 × salida) / 1e6 (§5). El proveedor informa reasoning_tokens fuera de completion_tokens (total_tokens = prompt + completion + reasoning): se facturan como salida y max_tokens no los acota; la cota de salida por solicitud es la mayor observada. |
| `cronista-luna6` | 0.1 / 0.5 | 9896 | 0,0271 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2048 × salida) / 1e6 (§5). |
| `cronista-oss` | 0.15 / 0.6 | 9352 | 0,0358 USD | ladoWebUsd = 12 solicitudes × (promptMax_web × 1.25 × entrada + 2048 × salida) / 1e6 (§5). |

## Condición de presupuesto (§5)

Entrada por solicitud: prompt máximo web observado 10.348 × 1.25; 12 solicitudes por lado; salida 2048 tokens (o la mayor observada si el razonamiento va fuera de `completion_tokens`). Narrador/comentarista: 12 llamadas en `cronista-rapido` × (10.348 de entrada como cota + 1200 de salida) = 0,158 USD. Speech: 120.000 caracteres/día × 15 USD/1M = 1,80 USD/día. Días hasta el 2026-11-10: 20. Condición: (costoMaxPartido × 10 + Speech/día) × días ≤ crédito − 30.

| Catálogo | Modelo más caro | Costo máx. por partido | Gasto proyectado | Crédito | Margen | ¿Cumple? |
|---|---|---|---|---|---|---|
| previo al 052 (`cronista-equilibrado`, `cronista-rapido`) | `cronista-rapido` 0,227 USD/lado | 0,612 USD | 158,39 USD | hipótesis (pendiente de Carlos): 50 USD | -138,39 USD | **no** |
| previo al 052 (`cronista-equilibrado`, `cronista-rapido`) | `cronista-rapido` 0,227 USD/lado | 0,612 USD | 158,39 USD | último dato verificado (10 oct): 150 USD | -38,39 USD | **no** |
| publicado + admitidos (`cronista-equilibrado`, `cronista-rapido`, `cronista-luna6`) | `cronista-rapido` 0,227 USD/lado | 0,612 USD | 158,39 USD | hipótesis (pendiente de Carlos): 50 USD | -138,39 USD | **no** |
| publicado + admitidos (`cronista-equilibrado`, `cronista-rapido`, `cronista-luna6`) | `cronista-rapido` 0,227 USD/lado | 0,612 USD | 158,39 USD | último dato verificado (10 oct): 150 USD | -38,39 USD | **no** |
| publicado + cronista-grok (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-grok`) | `cronista-grok` 0,469 USD/lado | 1,096 USD | 255,27 USD | hipótesis (pendiente de Carlos): 50 USD | -235,27 USD | **no** |
| publicado + cronista-grok (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-grok`) | `cronista-grok` 0,469 USD/lado | 1,096 USD | 255,27 USD | último dato verificado (10 oct): 150 USD | -135,27 USD | **no** |
| publicado + cronista-oss (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-oss`) | `cronista-rapido` 0,227 USD/lado | 0,612 USD | 158,39 USD | hipótesis (pendiente de Carlos): 50 USD | -138,39 USD | **no** |
| publicado + cronista-oss (no admitido, referencia) (`cronista-equilibrado`, `cronista-rapido`, `cronista-oss`) | `cronista-rapido` 0,227 USD/lado | 0,612 USD | 158,39 USD | último dato verificado (10 oct): 150 USD | -38,39 USD | **no** |

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

Precios: [precios.json](precios.json) (Azure Retail Prices API). Despliegues: [despliegues.json](despliegues.json). Detalle por decisión: `<id>.json`.
