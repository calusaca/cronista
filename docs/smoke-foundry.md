# Smoke manual — Cronista contra Microsoft Foundry

Para el día que exista la cuenta de Azure (ver `docs/disenos/005-entrega.md`). Hasta
entonces, `llm-foundry.ts` está probado **offline** (`src/lib/__tests__/llm.test.ts`
verifica con un `fetch` inyectado la URL, `x-api-key`, `anthropic-version: 2023-06-01`,
modelo = deployment, `thinking: adaptive` y que NO se envían `temperature` ni `top_k`).

## Requisitos

- Recurso Foundry en **eastus2** con un deployment de Claude (barato por defecto:
  `claude-sonnet-5` o `claude-haiku-4-5`).
- `.env` en la raíz (copiado de `.env.example`, **nunca** commiteado):

  ```
  CRONISTA_LLM=foundry
  FOUNDRY_API_KEY=<clave del recurso>
  FOUNDRY_BASE_URL=https://<recurso>.services.ai.azure.com/anthropic
  FOUNDRY_DEPLOYMENT=claude-sonnet-5
  ```

## Pasos

1. `npm test` en verde (la cadena con stub y la costura offline).
2. Una corrida real, sin caché, con la semilla de referencia:

   ```
   npm run cronica -- --seed 42 --sin-cache
   ```

   Esperado: cabecera `modo llm · LLM foundry:<deployment> · intentos N`, crónica
   ES/EN con citas `↳ hNN (...)`, y la sección «Historia» con el veredicto de cada
   intento. Si el modelo falla las reglas tres veces, sale `modo acta` — también es
   un resultado válido (nada sin verificar llega al lector).
3. Repetir el mismo comando **con** caché (sin `--sin-cache`) dos veces: la segunda
   debe decir `desde caché` y no llamar al LLM (cero costo).
4. Guardar la salida completa de (2) en `docs/evidencia/primera-corrida-foundry.md`
   (criterio de aceptación del 003). Si alguna corrida tuvo un rechazo real, anotar la
   semilla: es candidata para el video (regla de honestidad del 006).

## Si falla

| Síntoma | Causa probable |
|---|---|
| `necesita la variable FOUNDRY_…` | falta una variable en `.env` |
| 401 / 403 | clave equivocada o del recurso equivocado |
| 404 | `FOUNDRY_BASE_URL` sin `/anthropic`, o deployment mal escrito |
| 400 sobre `temperature`/`top_k` | alguien los agregó a `llm-foundry.ts`: Foundry los rechaza |
| 429 / cuota | free trial con cuota 0: hace falta el upgrade a Pay-As-You-Go (005) |
