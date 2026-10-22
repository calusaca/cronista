# 052 — Modelos de otras familias en la arena (Foundry Models)

Fecha local: 22 de octubre de 2026, America/Guatemala. Autora: Fable (diseño y
factibilidad). Implementa: Opus, por este brief cerrado. Aprobación de Carlos:
objetivo y creación de deployments GlobalStandard de baja capacidad.

Estado: **cerrado, v1.0**. Alcance pensado para media jornada de implementación,
más una sesión de smoke real con los deployments creados.

## Objetivo

Que en el partido en vivo de `/arena` los equipos puedan ser dirigidos por modelos de
**familias distintas** (DeepSeek, Meta Llama, GPT-6 Luna) y no solo por dos deployments
GPT de Azure OpenAI. Refuerza «Best Multi-Agent System» (dos agentes adversarios
realmente heterogéneos, mismo motor neutral, misma validación) y «Best Use of
Microsoft Foundry» (Foundry Models sold by Azure, además de Azure OpenAI, Agent
Service, Speech y Evaluations ya integrados).

No cambia el motor, el protocolo de órdenes, el validador ni el narrador. Todo
modelo nuevo entra por la **única costura** `src/lib/llm.ts` y por el catálogo
`ARENA_MODELOS`; ninguna credencial nueva aparece en código ni en el navegador.

## Hechos verificados el 22 de octubre (lo que se llamó de verdad)

Evidencia en [`docs/evidencia/modelos-052/factibilidad-2026-10-22.json`](../evidencia/modelos-052/factibilidad-2026-10-22.json),
generada por una sonda con `fetch` que lee la clave de `.env` y no la imprime.

1. **Recurso.** `carlossandi-9096-resource` (kind `AIServices`, S0, northcentralus,
   `disableLocalAuth: false`). Expone dos hosts con la **misma clave**:
   `https://<recurso>.openai.azure.com/` (Azure OpenAI) y
   `https://<recurso>.services.ai.azure.com/` (Azure AI Model Inference / Foundry).
   Deployments actuales: `gpt-6.1-sol` (100), `cronista-rapido` = gpt-5.4-mini (30),
   `cronista-equilibrado` = gpt-5.6-luna (30). Ninguno de otra familia.
2. **Cómo se autentica la app hoy.** La Container App `cronista-arena` recibe
   `AZURE_OPENAI_API_KEY` desde el secreto de Key Vault `cronista-inferencia`
   (clave del recurso; el mismo secreto alimenta `AZURE_SPEECH_KEY`). La identidad
   administrada solo tiene `Foundry User` sobre el **proyecto**, no un rol de
   inferencia sobre la cuenta: la autenticación por identidad para chat completions
   **no está habilitada hoy** y habilitarla requeriría una asignación de rol nueva.
   Decisión: el adaptador nuevo **reutiliza la misma clave** (mismo `secretRef`).
3. **Seis llamadas reales** sobre el deployment existente `cronista-rapido`
   (gpt-5.4-mini), todas con cabecera `api-key`, salvo la quinta con `Authorization: Bearer <clave>`:

   | Ruta | `response_format` | HTTP | ms | Observación |
   |---|---|---|---|---|
   | `services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview` | `json_object` | 200 | 1819 | `usage` completo, `finish_reason: stop`, `model: gpt-5.4-mini-2026-03-17` |
   | misma ruta | `json_schema` + `strict: true` | 200 | 1751 | JSON conforme al esquema |
   | `services.ai.azure.com/openai/v1/chat/completions` (sin `api-version`) | `json_object` | 200 | 1319 | `model` = nombre del deployment |
   | misma ruta | `json_schema` + `strict: true` | 200 | 1171 | JSON conforme |
   | `openai.azure.com/openai/v1/chat/completions`, Bearer | `json_object` | 200 | 1978 | la clave también vale como bearer |
   | `openai/v1`, `model: DeepSeek-V4-Flash` (sin deployment) | `json_object` | **404** | 247 | `code: DeploymentNotFound`, mensaje claro |

   Conclusión: la ruta de Foundry Models (`/models/chat/completions`, Model Inference
   API, `api-version=2024-05-01-preview`) funciona en este recurso con la clave actual,
   acepta `model` = nombre del deployment y devuelve `usage.prompt_tokens`,
   `completion_tokens` y `completion_tokens_details.reasoning_tokens`. Lo mismo la
   ruta `openai/v1`. **No se probó ningún modelo no-OpenAI**: no existe deployment y
   este brief no crea recursos (ver «Deployments»).
4. **Catálogo del recurso** (`az cognitiveservices account list-models`, 137 modelos).
   `DeepSeek-V4-Flash` (format `DeepSeek`, versión `2026-04-23`, GA, capacidad
   GlobalStandard por defecto 5000), `Llama-4-Maverick-17B-128E-Instruct-FP8`
   (format `Meta`, versión `1`, GA, capacidad por defecto 10, máximo 10 000),
   `gpt-6-luna` (format `OpenAI`, versión `2026-09-22`, GA, capacidad 10 por defecto).
   Los `capabilities` de DeepSeek y Llama solo declaran `chatCompletion`; no hay
   indicador de JSON Schema.
5. **Documentación de Microsoft** (leída el 22 oct):
   - *Foundry Models sold by Azure*: `DeepSeek-V4-Flash` = «chat-completion (with
     reasoning content) · Response formats: Text, JSON · Tool calling: Yes»;
     `Llama-4-Maverick-17B-128E-Instruct-FP8` = «chat-completion · Response formats:
     **Text** · Tool calling: No». `gpt-6-luna` = Chat Completions, Structured outputs,
     reasoning effort (familia OpenAI: sin adaptador nuevo).
   - *Reasoning models*: «Some non-OpenAI reasoning models return a `reasoning_content`
     field alongside the final `content`»; no añadirlo al historial; los tokens de
     razonamiento cuentan en `max_completion_tokens`; `temperature`, `top_p` y
     similares pueden no admitirse. Ningún documento de Microsoft fija un parámetro
     para desactivar el pensamiento de DeepSeek V4; fuentes de terceros citan
     `thinking: {type: "disabled"}`, `chat_template_kwargs.enable_thinking` o
     `reasoning_effort`, entre sí incompatibles. **No se adopta ninguno sin smoke.**
   - *API v1*: `openai/v1` permite «chat completions calls with models from other
     providers like DeepSeek and Grok». Llama no aparece nombrado; por eso la ruta
     por defecto es la de Model Inference, documentada para todas las familias.
6. **Cuota de la suscripción en northcentralus** (`az cognitiveservices usage list`):
   `AIServices.GlobalStandard.DeepSeek-V4-Flash` **límite 0** y
   `AIServices.GlobalStandard.Llama-4-Maverick-17B-128E-Instruct-FP8` **límite 0**
   (43 familias AIServices en cero). Con cuota: `gpt-6-luna` 250 (OpenAI),
   `Llama-4-Scout-17B-16E-Instruct` 20, `grok-4.7` 80, `mistral-medium-2505` 20,
   `gpt-oss-120b` 5000, `Llama-3.3-70B-Instruct` 20. Esto es el **riesgo principal**:
   la creación de los dos deployments pedidos puede fallar por cuota aunque el modelo
   figure en el catálogo. El brief define sustitutos por familia (abajo).
7. **Precios** (Azure Retail Prices API, consumo global, USD por millón de tokens):
   DeepSeek-V4-Flash entrada 0,19–0,23 / salida 0,51–0,61 según medidor;
   Llama-4-Maverick 0,25 / 1,00; gpt-5.4-mini 0,75 / 4,50. **gpt-5.6-luna y gpt-6-luna
   no aparecen por la API** con los filtros probados: se verifican en el portal antes
   de publicar la cifra. Consumo real observado por decisión del entrenador
   (duelo archivado, GPT-5.6 Luna `low`): ≈ 8 200 tokens de entrada y ≈ 500 de salida.

## El diseño en ocho líneas

1. Un adaptador nuevo `src/lib/llm-foundry-modelos.ts` (`CRONISTA_LLM=foundry-modelos`) habla con `{endpoint}/models/chat/completions?api-version=2024-05-01-preview` con `api-key`, `model` = deployment, `max_tokens`, sin `temperature`, y devuelve un `Llm` con `id: foundry-modelos:<deployment>` y `uso()`.
2. El formato JSON es configuración por modelo (`FOUNDRY_MODELOS_FORMATO_JSON = json_schema | json_object | texto`, por defecto `json_object`); con `texto` el adaptador extrae el primer objeto JSON balanceado de la respuesta. La corrección con el mensaje del validador sigue siendo del controlador (`ARENA.intentosOrdenes = 2`) y es idéntica para todos los adaptadores.
3. El adaptador ignora `message.reasoning_content` y recorta bloques `<think>…</think>` del `content` antes de devolverlo; lo devuelto es lo que el controlador reinyecta como `assistant` en el reintento, así el razonamiento nunca vuelve al historial.
4. Errores, truncado (`finish_reason: length`), filtro de contenido y respuesta vacía lanzan con los mismos motivos que `llm-azure-openai.ts`; sin reintentos propios; `AbortSignal` propagado al `fetch` (plazo de 60 s del coordinador intacto).
5. La costura `llm.ts` suma el tipo y sus variables (`FOUNDRY_MODELOS_ENDPOINT`, `FOUNDRY_MODELOS_API_KEY`, `FOUNDRY_MODELOS_DEPLOYMENT`, `FOUNDRY_MODELOS_FORMATO_JSON`, `FOUNDRY_MODELOS_API_VERSION` opcional); `modelos.ts` y `crearLlmEquipoDesdeEnv` las admiten por prefijo `ARENA_<ID>_…` y aceptan `foundry-modelos` como modelo real.
6. El catálogo público solo lista modelos que pasaron el smoke; nombres honestos con origen: «DeepSeek-V4-Flash (Foundry)», «Llama-4-Maverick (Foundry)», «GPT-6 Luna». El narrador, el comentarista y el agente analista siguen en `cronista-rapido`.
7. Bicep: el secreto `inferencia` existente se mapea también a `ARENA_<ID>_FOUNDRY_MODELOS_API_KEY`; el endpoint `services.ai.azure.com` entra como parámetro `foundryEndpoint`; nada nuevo en Key Vault.
8. Un smoke por CLI (`npm run arena:smoke-modelos`) sonda los tres formatos con una llamada, juega un partido de 60 s con el modelo en ambos banquillos y otro contra `cronista-rapido`, y escribe `docs/evidencia/modelos-052/<id>.json` + `README.md`; solo con 0 respaldos y todas las decisiones ≤ 30 s el modelo entra a `ARENA_MODELOS`.

## Adaptador `src/lib/llm-foundry-modelos.ts`

```ts
export const API_VERSION_FOUNDRY_MODELOS = "2024-05-01-preview";
export const FORMATOS_JSON_FOUNDRY_MODELOS = ["json_schema", "json_object", "texto"] as const;
export interface ConfigFoundryModelos {
  apiKey: string; endpoint: string; deployment: string;          // https://<recurso>.services.ai.azure.com
  formatoJson?: FormatoJsonFoundryModelos;                        // por defecto "json_object"
  apiVersion?: string; fetch?: typeof fetch;
}
export function urlFoundryModelos(cfg): string   // `${endpoint sin barra}/models/chat/completions?api-version=…`
export function limpiarRespuestaModelo(texto: string): string
export function extraerObjetoJson(texto: string): string
export function crearLlmFoundryModelos(cfg): Llm
```

Petición: `POST urlFoundryModelos`, cabeceras `content-type: application/json`,
`api-key`, cuerpo `{ model: deployment, messages: [system, …], max_tokens, response_format? }`.
`max_tokens` = `opciones.maxTokens ?? MAX_TOKENS_FOUNDRY_MODELOS (4000)`, con el mismo
rechazo de presupuesto inválido que Azure OpenAI (entero, 1..16 000). Sin `temperature`,
`top_p` ni `reasoning_effort` (los modelos con razonamiento los rechazan y el smoke
no demostró que haga falta). `response_format`:

| `formatoJson` | Se envía | Uso previsto |
|---|---|---|
| `json_schema` | `{type:"json_schema", json_schema:{name, strict:true, schema}}` si hay `opciones.esquema`; si no, `json_object` | solo si el smoke lo acepta (200 y JSON conforme) |
| `json_object` | `{type:"json_object"}` | DeepSeek-V4-Flash (documenta «JSON») |
| `texto` | nada | Llama-4-Maverick (documenta solo «Text») |

Respuesta (zod): `choices[0].message.content: string | null`, `finish_reason: string | null`,
`usage.prompt_tokens`, `usage.completion_tokens`, opcionales `prompt_tokens_details.cached_tokens`
y `completion_tokens_details.reasoning_tokens` (se contabilizan en `UsoLlm.salida` porque
ya van dentro de `completion_tokens`; no se crea un campo nuevo en `UsoLlm`).
`message.reasoning_content` se tolera y se descarta. Luego:

1. `limpiarRespuestaModelo`: elimina todo bloque `<think>…</think>`; si queda un
   `<think>` sin cierre, lanza «Foundry Models: respuesta con razonamiento sin cerrar»
   (equivale a truncado). Recorta espacios.
2. Con `formatoJson === "texto"`: `extraerObjetoJson` quita vallas ```json … ``` y
   devuelve el primer objeto `{…}` balanceado (contando llaves fuera de cadenas);
   sin objeto ⇒ «Foundry Models: la respuesta no contiene un objeto JSON». No se
   intenta reparar JSON inválido: eso lo hace el reintento del controlador.
3. Errores HTTP con los mismos motivos que Azure OpenAI (401 clave rechazada, 429
   cuota o límite de tasa, ≥ 500 error del servicio, 404 `DeploymentNotFound` como
   «petición rechazada» con los 200 primeros caracteres del detalle); `length` ⇒
   truncada; `content_filter` ⇒ bloqueada; vacía ⇒ vacía. Prefijo «Foundry Models».

`id` = `foundry-modelos:<deployment>` (sin sufijo de razonamiento: no se envía).
`uso()` devuelve copia de `UsoLlm` con `llamadas`, `respuestasConUso`, `entrada`,
`salida`, `cache`. La caché de crónicas distingue backend por `id`; el adaptador no
se usa para el Writer en esta entrega (podría, sin cambios).

## Costura, catálogo y configuración

- `llm.ts`: `TipoLlm` y `TIPOS_LLM` incorporan `"foundry-modelos"`; `crearLlmDesdeEnv`
  exige `FOUNDRY_MODELOS_API_KEY`, `FOUNDRY_MODELOS_ENDPOINT`, `FOUNDRY_MODELOS_DEPLOYMENT`
  con el mismo mensaje `CRONISTA_LLM=foundry-modelos necesita la variable …`; valida
  `FOUNDRY_MODELOS_FORMATO_JSON` contra `FORMATOS_JSON_FOUNDRY_MODELOS` antes de llamar.
  La lista de claves por prefijo (`claves` en `modelos.ts` y la de `crearLlmEquipoDesdeEnv`)
  pasa a una única constante exportada `CLAVES_LLM_POR_PREFIJO` en `llm.ts` que incluye
  las cinco nuevas; `modelos.ts` acepta `["azure-openai", "foundry", "foundry-modelos"]`.
- `.env.example`: bloque «Foundry Models (otras familias)», indicando que la clave es
  la misma del recurso y que `FOUNDRY_MODELOS_ENDPOINT` es el host `services.ai.azure.com`.
- `infra/arena-preview.bicep`: parámetro `foundryEndpoint` (lo pasa
  `scripts/deploy-azure-arena.mjs` desde `FOUNDRY_BASE_URL` ya presente en `.env`,
  recortando el sufijo `/anthropic` si lo trae), y por cada modelo admitido:

  ```bicep
  { name: 'ARENA_DEEPSEEK_LLM', value: 'foundry-modelos' }
  { name: 'ARENA_DEEPSEEK_FOUNDRY_MODELOS_ENDPOINT', value: foundryEndpoint }
  { name: 'ARENA_DEEPSEEK_FOUNDRY_MODELOS_API_KEY', secretRef: 'inferencia' }
  { name: 'ARENA_DEEPSEEK_FOUNDRY_MODELOS_DEPLOYMENT', value: 'cronista-deepseek' }
  { name: 'ARENA_DEEPSEEK_FOUNDRY_MODELOS_FORMATO_JSON', value: 'json_object' }   // lo que dijo el smoke
  { name: 'ARENA_LUNA6_LLM', value: 'azure-openai' }
  { name: 'ARENA_LUNA6_AZURE_OPENAI_DEPLOYMENT', value: 'cronista-luna6' }
  ```

  `ARENA_MODELOS` final solo con los que pasaron el smoke, p. ej.
  `[{"id":"equilibrado","nombre":"GPT-5.6 Luna","prefijo":"ARENA_EQUILIBRADO_"},{"id":"rapido","nombre":"GPT-5.4 mini","prefijo":"ARENA_RAPIDO_"},{"id":"luna6","nombre":"GPT-6 Luna","prefijo":"ARENA_LUNA6_"},{"id":"deepseek","nombre":"DeepSeek-V4-Flash (Foundry)","prefijo":"ARENA_DEEPSEEK_"},{"id":"llama","nombre":"Llama-4-Maverick (Foundry)","prefijo":"ARENA_LLAMA_"}]`.
  `ARENA_NARRADOR_MODELO=rapido` y `ARENA_AGENTE_MODELO` no cambian. El esfuerzo de
  razonamiento global `low` sigue aplicando a los deployments OpenAI.
- `infra/modelos-arena.bicep`: tres recursos nuevos (`cronista-luna6`,
  `cronista-deepseek`, `cronista-llama`) con `versionUpgradeOption: 'NoAutoUpgrade'`,
  cada uno tras un `param incluir<Id> bool` para poder desplegar la plantilla aunque
  una familia no tenga cuota. La operación real se hace con `az` (abajo) y la
  plantilla queda como reproducción, igual que en el 035.
- Sorteo (`elegirModelos`): sin cambios; con cinco entradas sigue prefiriendo
  controladores distintos. `ModeloPublico.controlador` muestra
  `foundry-modelos:cronista-deepseek` en `.arena-controller`, que ya es la forma de
  decir con qué se jugó. Los e2e que esperan `cronista-equilibrado`/`cronista-rapido`
  no se tocan: siguen siendo los dos primeros del catálogo.

## Criterio de inclusión y protocolo de smoke

Script `src/arena/smoke-modelos-cli.ts` (`npm run arena:smoke-modelos -- --id deepseek --deployment cronista-deepseek [--formato auto]`),
sin tocar la app pública ni su cupo diario de diez partidos:

1. **Sonda de formato** (3 llamadas como máximo, `max_tokens` 200, esquema de dos
   órdenes): prueba `json_schema`, luego `json_object`, luego `texto`; se queda con el
   primero que devuelve 200 y un JSON válido conforme. Registra HTTP, ms, `usage`,
   presencia de `reasoning_content` o `<think>`, y los 120 primeros caracteres.
2. **Partido espejo**: `ejecutarArena` con 60 s, intervalo 15 s, el candidato en los
   dos banquillos (8 decisiones) y las mismas cotas de la web (`esperaMs` 60 000,
   `tokensOrdenes` 2048, 2 solicitudes por decisión).
3. **Partido cruzado**: candidato local contra `cronista-rapido` visita, 60 s.
4. Escribe `docs/evidencia/modelos-052/<id>.json` con identidad del controlador,
   versión del modelo, formato elegido, por decisión `motivo`, `tiempoMs`,
   `llamadas`, y `uso` total; y actualiza `docs/evidencia/modelos-052/README.md`
   con la tabla por modelo. Sin claves ni endpoint completo (host enmascarado).

**Entra al catálogo público** el modelo que cumple a la vez: 16 de 16 decisiones
con `origen: "controlador"` (cero respaldos programados), ninguna decisión por encima
de 30 000 ms (mitad del plazo: deja margen a la latencia pública), no más de 2
solicitudes en ninguna decisión, `respuestasConUso === llamadas`. Si falla una sola
condición, el modelo queda documentado como «probado, no admitido» con la causa y
**no** aparece en `ARENA_MODELOS`. No se afirma superioridad táctica de ninguno.

## Deployments: comandos exactos

Cuenta y grupo fijos; `--sku-capacity` bajo porque GlobalStandard no cobra en reposo
y un partido usa como máximo ≈ 24 solicitudes de ≈ 10 000 tokens por lado:

```bash
source .cache/azure-cli-env.sh
RG="rg-carlos.sandi-6716"; CUENTA="carlossandi-9096-resource"
# GPT-6 Luna (familia OpenAI; cuota disponible: 250)
az cognitiveservices account deployment create -g "$RG" -n "$CUENTA" --deployment-name cronista-luna6 \
  --model-name gpt-6-luna --model-version 2026-09-22 --model-format OpenAI --sku-name GlobalStandard --sku-capacity 30
# DeepSeek-V4-Flash (cuota en cero el 22 oct: puede fallar por InsufficientQuota)
az cognitiveservices account deployment create -g "$RG" -n "$CUENTA" --deployment-name cronista-deepseek \
  --model-name DeepSeek-V4-Flash --model-version 2026-04-23 --model-format DeepSeek --sku-name GlobalStandard --sku-capacity 50
# Llama-4-Maverick (cuota en cero el 22 oct: puede fallar)
az cognitiveservices account deployment create -g "$RG" -n "$CUENTA" --deployment-name cronista-llama \
  --model-name Llama-4-Maverick-17B-128E-Instruct-FP8 --model-version 1 --model-format Meta --sku-name GlobalStandard --sku-capacity 10
# Comprobación (lectura)
az cognitiveservices account deployment list -g "$RG" -n "$CUENTA" -o table
```

Si el servicio rechaza la capacidad pedida, repetir con el valor por defecto del
catálogo (5000 para DeepSeek, 10 para Llama). Si rechaza por **cuota**, primero
solicitar cuota desde Foundry → Quota para la familia (puede tardar); si no llega el
23 oct, usar los sustitutos **con cuota comprobada** en la región, en este orden y
manteniendo la diversidad de familias:

```bash
# Meta, sustituto de Maverick (cuota 20)
az cognitiveservices account deployment create -g "$RG" -n "$CUENTA" --deployment-name cronista-llama \
  --model-name Llama-4-Scout-17B-16E-Instruct --model-version 1 --model-format Meta --sku-name GlobalStandard --sku-capacity 10
# xAI, sustituto de DeepSeek (cuota 80)
az cognitiveservices account deployment create -g "$RG" -n "$CUENTA" --deployment-name cronista-grok \
  --model-name grok-4.7 --model-version 1 --model-format xAI --sku-name GlobalStandard --sku-capacity 10
# Mistral AI, segunda alternativa (cuota 20)
az cognitiveservices account deployment create -g "$RG" -n "$CUENTA" --deployment-name cronista-mistral \
  --model-name mistral-medium-2505 --model-version 1 --model-format "Mistral AI" --sku-name GlobalStandard --sku-capacity 10
```

El nombre público sigue al modelo real desplegado («Llama-4-Scout (Foundry)»,
«Grok 4.7 (Foundry)»); nunca se anuncia DeepSeek si lo que corre es otro.
`gpt-oss-120b` (OpenAI-OSS, cuota 5000) queda como última reserva: añade familia
de pesos abiertos pero no diversidad de proveedor.

## Pruebas (vitest), con mutaciones que deben fallar

`src/lib/__tests__/llm-foundry-modelos.test.ts`, patrón de `llm-azure-openai.test.ts`
(fetch inyectado, sin red):

1. URL exacta (`/models/chat/completions`, `api-version` por defecto y sobreescrita),
   cabecera `api-key`, cuerpo con `model` = deployment, `max_tokens`, sin `temperature`
   ni `reasoning_effort`. Mutación: enviar `temperature` ⇒ falla.
2. `response_format` por formato: `json_schema` con esquema ⇒ `strict: true` y el
   esquema recibido; `json_object`; `texto` ⇒ clave ausente. Mutación: `texto` enviando
   `json_object` ⇒ falla.
3. `limpiarRespuestaModelo`: `<think>…</think>{json}` ⇒ `{json}`; dos bloques; sin
   bloque ⇒ idéntico; `<think>` sin cierre ⇒ lanza. `reasoning_content` presente y
   `content` limpio ⇒ se devuelve solo `content`. Mutación: no recortar ⇒ falla.
4. `extraerObjetoJson`: valla ```json, prosa antes y después, llaves dentro de
   cadenas, sin objeto ⇒ lanza. Mutación: cortar en la primera `}` ⇒ falla con llaves anidadas.
5. `UsoLlm`: suma `prompt_tokens`/`completion_tokens`/`cached_tokens`;
   `respuestasConUso` solo con `usage`; `reasoning_tokens` no crea campo nuevo.
6. Errores: 401, 429, 500, 404 `DeploymentNotFound`, `length`, `content_filter`,
   `content: null`, JSON malformado ⇒ mensajes con prefijo «Foundry Models» y motivo.
7. Fábrica: `crearLlmDesdeEnv({CRONISTA_LLM:"foundry-modelos",…}).id ===
   "foundry-modelos:cronista-deepseek"`; cada variable faltante nombra la variable;
   `FOUNDRY_MODELOS_FORMATO_JSON=xml` ⇒ error antes de llamar; `TIPOS_LLM` lo incluye y
   el mensaje de tipo inválido lo lista.
8. `catalogoModelos`: entrada `ARENA_X_LLM=foundry-modelos` con sus claves por prefijo
   ⇒ `controlador: "foundry-modelos:…"`; construir el catálogo **no** invoca `fetch`
   (transporte espía con contador en 0); `JSON.stringify(publico)` no contiene la clave
   ni el endpoint. Mutación: catálogo que llama `completar` al construir ⇒ falla.
9. `crearControladorLlm` con un `Llm` falso que devuelve `<think>…</think>` + JSON
   inválido y luego JSON válido ⇒ segunda solicitud lleva el mensaje del validador y
   el `assistant` previo es el texto **limpio**. Esto demuestra que el reintento es el
   mismo para todos los adaptadores.

E2E: no se añade ninguno que requiera inferencia. `arena.spec.ts` sigue verde porque
el catálogo del entorno de pruebas no cambia.

## Costos por partido (estimación, no medición)

Cotas web: 180 s, decisiones cada 30 s ⇒ 6 decisiones por lado, ≤ 12 solicitudes por
lado, ≈ 8 200 tokens de entrada y ≤ 2 048 de salida por solicitud (observado ≈ 500).

| Lado dirigido por | Entrada ≤ 100 K | Salida típica 6 K / tope 24 K | Por lado |
|---|---|---|---|
| DeepSeek-V4-Flash | 0,019–0,023 USD | 0,003–0,015 USD | ≈ 0,02–0,04 USD |
| Llama-4-Maverick | 0,025 USD | 0,006–0,024 USD | ≈ 0,03–0,05 USD |
| GPT-5.4 mini | 0,075 USD | 0,027–0,108 USD | ≈ 0,10–0,18 USD |
| GPT-5.6 Luna / GPT-6 Luna | sin precio verificado por API | — | verificar en el portal |

Un partido completo con dos modelos nuevos más narrador en `cronista-rapido` queda
por debajo de 0,30 USD incluso con los topes de salida; diez partidos diarios hasta
el 10 de noviembre (19 días) son < 60 USD en el peor caso frente al crédito de
150 USD, siempre que Luna no supere ~0,5 USD por lado (confirmar). El smoke completo
(5 modelos × 3 partidos cortos) cuesta centavos. Se registra el gasto real del
recurso en el portal antes y después del smoke y se anota en el README de evidencia.

## Documentación que cambia con la implementación

- `docs/arena.md` § «Configuración del servidor y límites»: bloque `foundry-modelos`,
  tabla de modelos admitidos con fecha y enlace a la evidencia; § «Duelo real»:
  nota de que el catálogo público puede incluir otras familias.
- `README.md`: filas «Home / Away coach» y «Azure OpenAI» de la tabla de tecnologías
  pasan a nombrar Foundry Models con el archivo del adaptador; diagrama con las
  familias reales que entraron.
- `docs/entrega/judges-guide.md`: el párrafo de «Start a live match» dice qué
  familias pueden salir sorteadas y que el nombre del controlador identifica el
  deployment; «Load recorded model duel» sigue siendo Luna vs mini.
- `docs/azure-integraciones.md` § «Qué quedó incorporado»: Foundry Models (Model
  Inference API) como integración adicional, con lo probado y lo no probado.
- `.env.example` y este brief («Entrega local» al cerrar).

## Riesgos y límites honestos

- **Cuota en cero** para DeepSeek-V4-Flash y Llama-4-Maverick en esta suscripción y
  región: puede impedir exactamente los dos modelos pedidos. El plan de sustitutos
  mantiene dos familias no-OpenAI con cuota comprobada; se dice qué corrió.
- **JSON sin esquema**: Llama solo documenta texto; la tasa de órdenes inválidas
  puede ser mayor y agotar las dos solicitudes. El smoke lo mide; si cae a respaldos,
  no entra. No se añade una tercera solicitud ni se relaja el validador.
- **Latencia y razonamiento**: DeepSeek puede pensar largo y chocar con 2 048
  tokens o con 30 s; el `max_tokens` cubre pensamiento más respuesta. Si el smoke
  muestra truncados, se prueba una variante con `max_tokens` 4 096 dentro del mismo
  plazo antes de descartar; no se activan parámetros de terceros no documentados.
- **Sin identidad administrada** para inferencia: la clave del recurso sigue siendo
  el único secreto; cualquier cambio a Entra queda fuera de este brief.
- **Precios de Luna** no verificados por API: la estimación de costo se publica
  solo después de verlos en el portal.
- Ningún resultado de la arena demuestra que un modelo «sea mejor entrenador»;
  los partidos siguen siendo demostraciones funcionales con control local autónomo.

## Plan de media jornada

1. (45 min) Adaptador + fábrica + constante de claves por prefijo + `.env.example`.
2. (45 min) Pruebas 1–9 con mutaciones; `npm test` verde.
3. (20 min) Comandos `az` de deployments (Carlos o Fable con la CLI); espera 5 min.
4. (45 min) Script de smoke y su ejecución por modelo; evidencia en `modelos-052/`.
5. (30 min) Bicep + `deploy-azure-arena.mjs` + `ARENA_MODELOS` con los admitidos;
   publicación por el flujo existente; smoke público de un partido sorteado.
6. (30 min) Documentación y bitácora con lo que realmente corrió.

## Fuera de alcance

Model Router, tool calling, streaming, Responses API, cambiar el Writer de crónicas a
otra familia, evaluación comparativa de calidad táctica entre familias, cuota de
Claude en Marketplace (sigue bloqueada) y cualquier parámetro propietario de
pensamiento no documentado por Microsoft.

## Versión 1.1 (22 de octubre): decisiones tras la revisión de Codex

Codex (GPT-6.1 Sol, solo lectura) devolvió **NO CERRADO** con nueve hallazgos
([informe](../evidencia/modelos-052/codex-brief-v1.md)). Fable verificó cada uno
contra el código el mismo día. Lo que sigue **prevalece** sobre la v1.0 donde
difiera; la numeración es la del informe. Estado al escribir: Opus ya implementa la
v1; en el recurso existen `cronista-luna6` (gpt-6-luna, 30) y `cronista-grok`
(grok-4.7, 10); Scout y Mistral todavía no.

### 1. Razonamiento: gramática de envoltura admitida (hallazgo confirmado)

Verificado: `controladores.ts:229` reinyecta como `assistant` exactamente lo que
devolvió `completar`; la limpieza del adaptador es la única barrera. La v1.0 dejaba
indefinido el `</think>` huérfano y permitía elegir un objeto de ejemplo dentro del
razonamiento. Gramática cerrada de `limpiarRespuestaModelo(texto)`:

| Forma del `content` | Resultado |
|---|---|
| `(<think>…</think>)+ resto` (bloques completos solo al **inicio**, con espacios entre ellos) | `resto` recortado |
| `… </think> resto` sin `<think>` de apertura (plantillas que omiten la apertura) | todo hasta el **último** `</think>` se descarta; queda `resto` |
| `<think>` abierto sin cierre en cualquier posición | lanza «Foundry Models: razonamiento sin cerrar» (equivale a truncado; sin reintento) |
| `<think>` o `</think>` **después** del inicio del resto (dentro del JSON o detrás de él) | lanza «Foundry Models: marcadores de razonamiento fuera de la envoltura» |
| sin marcadores | idéntico |

Solo se reconoce la envoltura inicial; nunca se borra texto dentro del `resto`, así
que una cadena legítima del JSON no se altera. `reasoning_content` se descarta
siempre. En modo `texto`, `extraerObjetoJson` actúa **después** de la limpieza y:
si hay una valla ```json … ``` toma la primera valla; si no, toma el **último**
objeto `{…}` balanceado de nivel superior (la respuesta final va al final; un
ejemplo en prosa previa no gana). Pruebas obligatorias: marcadores en cada fila de
la tabla; objeto de ejemplo antes del definitivo; la segunda petición del reintento
no contiene `<think>` ni `reasoning_content`; la evidencia del smoke no contiene
`<think>` (ver 7).

### 2. Reintento: errores de contenido no lanzan (hallazgo confirmado)

Verificado: `crearControladorLlm` no captura excepciones de `completar`; en
`coordinador.ts:48-51` esa excepción se vuelve `error_controlador` y respaldo
programado, sin segunda solicitud. Regla, idéntica para todos los adaptadores:

- **Lanzan** (sin reintento, como hoy en Azure OpenAI): HTTP ≠ 2xx, respuesta no
  JSON del proveedor, `finish_reason: length` o `content_filter`, `content`
  `null`/vacío, razonamiento sin cerrar o fuera de la envoltura (1).
- **No lanzan**: todo lo que es texto del modelo tras la limpieza. En modo `texto`,
  si no hay valla ni objeto balanceado, `completar` devuelve el **texto limpio
  tal cual**; en el controlador `JSON.parse` falla, `validarOrdenes(undefined)`
  falla y la segunda solicitud lleva el mensaje del validador, exactamente como una
  cadena JSON inválida devuelta por Azure OpenAI. Se elimina el error «la respuesta
  no contiene un objeto JSON» de la v1.0.
- Límite de 2 solicitudes y plazo compartido sin cambios. El reintento nunca
  reinyecta razonamiento porque lo reinyectado es la salida ya limpia (1).

### 3. Admisión por identidad y lado, con 16 decisiones del candidato (confirmado)

Verificado: `esquemaDecision` ya persiste `controlador`, `origen`, `motivo`,
`tiempoMs` y `llamadas` por decisión; no hace falta un campo nuevo. La v1.0 contaba
16 mezclando 4 de mini. Protocolo corregido (4 partidos):

| Partido | Local | Visita | Decisiones del candidato |
|---|---|---|---|
| espejo | candidato | candidato | 8 (4 rondas × 2) |
| cruzado A | candidato | `cronista-rapido` | 4 |
| cruzado B (lados invertidos) | `cronista-rapido` | candidato | 4 |
| **web** (ver 4) | candidato | `cronista-rapido` | 6 |

Se evalúan **solo** las decisiones cuyo `controlador` es el id del candidato,
separadas por lado; las de mini se reportan aparte y no cuentan ni a favor ni en
contra. Cantidades esperadas explícitas en la evidencia (`esperadas`, `observadas`);
una discrepancia invalida la corrida. Umbrales: 22 de 22 con `origen:
"controlador"`, `tiempoMs ≤ 30 000` en todas, `llamadas ≤ 2`, `respuestasConUso ===
llamadas` del `uso` del lado del candidato.

### 4. Sonda y smoke representativos (confirmado)

- La sonda de formato usa `esquemaRespuestaArena(obs)` **real** sobre dos
  observaciones generadas sin inferencia (un partido programado: tick 0 y una
  observación con `entrenadores` a mitad de partido), `maxTokens = ARENA.tokensOrdenes`
  (2048) y el `SISTEMA_ARENA` íntegro. Resultado clasificado por formato:
  `http` (4xx: formato no admitido), `truncado` (`length`), `no_json` (texto no
  parseable), `semantico` (JSON que `validarOrdenes` rechaza) u `ok`. Se elige el
  primer formato `ok` en el orden `json_schema`, `json_object`, `texto`; `strict`
  solo se da por aplicado si el JSON respeta `enum` e `items` exactos del esquema
  real (se comprueba localmente, no se confía en el 200).
- Se añade el partido **web**: 180 s, intervalo 30 s, `esperaMs` 60 000, el
  mismo `formatoJson`, 2048 tokens y esfuerzo publicados, es decir, la configuración
  exacta de `ARENA_MODELOS` que se va a desplegar. Cubre crecimiento de contexto y
  ventanas de gestión. La variante de 4096 tokens de la v1.0 **se retira**: el
  controlador siempre envía `ARENA.tokensOrdenes`; si el modelo trunca a 2048, queda
  «probado, no admitido» con causa `truncado`.
- La evidencia registra por decisión el `prompt_tokens` máximo observado; es la
  entrada que usa el cálculo de costo (5).

### 5. Costo: sin «peor caso» global; condición presupuestaria comprobable (confirmado)

Se retira la afirmación «< 60 USD». Antes de admitir cualquier modelo, Fable o Carlos
anotan en `docs/evidencia/modelos-052/precios.json` los precios **vistos en el
portal** (entrada, salida, caché) de todos los deployments del catálogo, incluidos
`cronista-equilibrado`, `cronista-luna6`, `cronista-grok` y los sustitutos; un
modelo sin precio anotado no entra. Fórmula por partido web, por lado y modelo m:
`12 solicitudes × (E_m × precioEntrada_m + 2048 × precioSalida_m)` con `E_m` =
`prompt_tokens` máximo del smoke web × 1,25 (el reintento añade la respuesta y el
diagnóstico). Costo de partido para una combinación = suma de los dos lados +
narrador/comentarista (`presupuestoLlamadasModelo` = 12 llamadas en `cronista-rapido`,
1 200 tokens de salida cada una, entrada medida) + Speech (120 000 caracteres/día
ya acotados). Como la selección manual permite el mismo modelo en ambos lados, la
**combinación más cara** es el modelo más caro dos veces. Condición de publicación:
`costoMaxPartido × 10 partidos/día × díasHastaEl10Nov ≤ créditoRestante − 30 USD`.
Si no se cumple, se retira del catálogo el modelo más caro (no se reduce el cupo
diario ni se cambian las cotas) hasta cumplirla, y se documenta.

### 6. Sustitutos: comprobados solo cuando existen; reproducción parametrizada (confirmado)

La v1.0 llamó «comprobados» a sustitutos con cuota positiva pero sin deployment.
Corrección: un sustituto está comprobado cuando `az … deployment list` lo muestra
`Succeeded` **y** la sonda (4) devolvió `ok`. Hoy: `cronista-grok` existe;
Llama-4-Scout y mistral-medium-2505 están pendientes de creación. La capacidad
aceptada se anota tal cual (unidades no verificadas; no se sube automáticamente;
si el servicio rechaza un valor se reintenta con el `default` del catálogo y se
registra). `infra/modelos-arena.bicep` pasa a un parámetro `modelos` (arreglo de
objetos `{ nombre, modelo, version, formato, capacidad }`) con un bucle `for`, y los
dos deployments de 2026-10-19 se expresan como elementos del arreglo por defecto;
`ARENA_MODELOS` y los nombres públicos se derivan del mismo arreglo en
`deploy-azure-arena.mjs` para que nombre público, deployment y modelo real no puedan
divergir.

### 7. Secretos en errores, artefactos y publicación (confirmado, media)

- El adaptador redacta el detalle del error del proveedor con la clave efectiva
  (`texto.split(apiKey).join("[REDACTED]")`) antes de recortarlo a 200 caracteres.
- `deploy-azure.mjs:58` y `deploy-azure-arena.mjs:14` dejan de enumerar dos
  variables: la lista de secretos pasa a ser **toda** variable de entorno cuyo nombre
  termina en `_API_KEY` o `_KEY` (incluye las prefijadas `ARENA_<ID>_…`), más
  `APPLICATIONINSIGHTS_CONNECTION_STRING`; `stageSource` y `redact` reciben esa lista.
- Evidencia del smoke: **sin muestras crudas**. Por decisión se guardan indicadores
  (`teniaThink: boolean`, `reasoningContentChars: number`, `formato`, `finish`), y
  el único texto conservado es el JSON ya validado de las órdenes (que ya se
  publica en los registros de la arena). Se retiran los «120 primeros caracteres».
- Pruebas centinela: un `fetch` falso que devuelve 400 con la clave en el cuerpo ⇒
  el mensaje lanzado no la contiene; un artefacto de smoke generado con respuesta
  que incluye `<think>` y una clave centinela ⇒ el archivo no contiene ninguno.

### 8. Pruebas con el adaptador real (confirmado)

La prueba 9 de la v1.0 se sustituye y la lista se completa:

9. `crearControladorLlm(crearLlmFoundryModelos({ fetch: falso }))` con dos respuestas
   en secuencia: `<think>…</think>` + JSON inválido y luego JSON válido. Se captura la
   **segunda petición completa**: su mensaje `assistant` es el texto limpio y su
   `user` final contiene el mensaje del validador. Mutaciones que deben fallar:
   omitir la limpieza en `completar`; no pasar `signal` al `fetch` (se afirma
   `init.signal === señal`); hacer dos `fetch` por `completar` (`llamadas` y número
   de peticiones capturadas deben coincidir); sumar `reasoning_tokens` además de
   `completion_tokens` (`salida` debe ser igual a `completion_tokens`); no contar el
   `usage` de una respuesta `length` o `content_filter` antes de lanzar (como hace
   Azure OpenAI en `llm-azure-openai.ts:94-98`); aceptar `maxTokens` 0 o 20 000.
10. Cancelación: abortar la señal durante el `fetch` falso ⇒ `completar` rechaza
    con `AbortError` y no hay segunda petición.
11. Sin reintentos HTTP propios: un 500 produce exactamente una petición.
12. Modo `texto` sin objeto ⇒ `completar` **resuelve** con el texto limpio (no
    lanza) y el controlador emite la segunda solicitud (2).

### 9. Plan en dos entregas con corte (confirmado, media)

- **Entrega A — adaptador y costura** (sin depender de Azure): adaptador, fábrica,
  constante de claves por prefijo, lista de secretos ampliada, Bicep parametrizado,
  pruebas 1–12, `.env.example`. Se puede integrar y publicar con `ARENA_MODELOS`
  **sin cambios**: la arena sigue igual para los jueces.
- **Entrega B — admisión operativa**, con precondiciones: deployments `Succeeded`
  y `precios.json` completo. Corte: **23 de octubre, 16:00 America/Guatemala**. Lo
  que a esa hora no haya pasado los cuatro partidos (3) con la configuración
  publicada (4) y la condición presupuestaria (5) queda documentado en el README de
  evidencia como «probado, no admitido» con causa, o «no probado» si no hubo
  deployment. Se publica el catálogo con los admitidos aunque sean cero; no se
  promete diversidad de familias que no se demostró.
- Tiempos estimados, con la espera real de decisiones: sonda ≈ 1 min por formato,
  partidos cortos ≈ 3–5 min cada uno, partido web ≈ 6–8 min; por candidato ≈ 25 min.
  Con cuatro candidatos (`luna6`, `grok`, Scout, Mistral) ≈ 2 h de smoke, además de
  la Entrega A. Es más que media jornada en total; la media jornada de la v1.0 se
  entiende como la Entrega A. La mención de «3 partidos por modelo» en costos queda
  reemplazada por los cuatro de la tabla (3).

### Qué cambia para Opus (aplicable sobre la v1 en curso)

1. `limpiarRespuestaModelo`: implementar la tabla del punto 1 (solo envoltura
   inicial; `</think>` huérfano ⇒ descartar hasta el último; `<think>` sin cierre o
   marcadores después del inicio del resto ⇒ lanzar). `extraerObjetoJson`: valla
   primero, si no el **último** objeto balanceado; **sin objeto ⇒ devolver el texto
   limpio, no lanzar**.
2. En `completar`, solo lanzan transporte/proveedor, `length`, `content_filter`,
   vacío y las dos excepciones de razonamiento; contar `usage` antes de lanzar;
   redactar la clave en el detalle del error.
3. Smoke CLI: cuatro partidos (espejo, cruzado A, cruzado B invertido, web 180 s /
   30 s con la configuración publicada); evaluar por `controlador` e informar
   `esperadas`/`observadas`; sonda con `esquemaRespuestaArena` real, 2048 tokens y
   clasificación `http | truncado | no_json | semantico | ok`; evidencia con
   indicadores, sin muestras crudas; registrar `prompt_tokens` máximo y la
   capacidad aceptada del deployment. Retirar la variante de 4096 tokens.
4. Secretos: lista de secretos en los dos scripts de publicación = toda variable
   `*_API_KEY` / `*_KEY` + la cadena de Insights; pruebas centinela.
5. Pruebas: sustituir la 9 por las 9–12 de arriba con el adaptador real y `fetch`
   falso; mutaciones enumeradas.
6. `infra/modelos-arena.bicep` con parámetro `modelos` en bucle; `ARENA_MODELOS` y
   nombres públicos derivados del mismo arreglo en `deploy-azure-arena.mjs`.
7. Entregar A aunque B no termine; B solo con deployments `Succeeded` y
   `precios.json`; corte 23 oct 16:00; README de evidencia con admitidos, «probado,
   no admitido» y «no probado». No anunciar DeepSeek ni Llama Maverick: hoy no
   tienen cuota ni deployment.
