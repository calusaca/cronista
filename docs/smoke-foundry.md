# Smoke manual — CRONISTA contra Foundry o Azure OpenAI

> Actualización del 17 oct: smoke y caché reales completados con GPT-6.1 Sol en
> Azure OpenAI; ver [primera corrida](evidencia/primera-corrida-azure-openai.json),
> [caché](evidencia/cache-azure-openai.json) y [evaluación real](evidencia/eval-gpt-6.1-sol/informe.txt).
> Usar `AZURE_OPENAI_REASONING_EFFORT=low` para ese deployment. Claude permanece
> bloqueado por Marketplace. El procedimiento original del 10 oct se conserva
> debajo; el [runbook de hosting](entrega/despliegue.md) contiene los pasos vigentes.


**Estado al 10 oct:** adaptadores probados offline; corrida real pendiente de
configuración y evidencia. Este procedimiento comprueba el deployment elegido,
la cadena y la caché. No sustituye una evaluación independiente de fidelidad.

## Requisitos

- Deployment disponible en la cuenta, con endpoint y cuota confirmados. Elegir
  uno de los dos adaptadores y comprobar que admite sus parámetros; los tests
  offline no confirman disponibilidad, precios ni compatibilidad de un modelo real.
- `.env` en la raíz, copiado de `.env.example` y excluido de git. Completarlo
  localmente; no guardar claves en la evidencia.
- Directorio de caché vacío y exclusivo para esta prueba (`CRONISTA_CACHE_DIR`)
  para evitar que las corridas con caché reutilicen evidencia de una prueba anterior.
- Para **Claude vía Foundry**:

  ```
  CRONISTA_LLM=foundry
  FOUNDRY_API_KEY=<clave del recurso>
  FOUNDRY_BASE_URL=https://<recurso>.services.ai.azure.com/anthropic
  FOUNDRY_DEPLOYMENT=<nombre exacto del deployment>
  CRONISTA_CACHE_DIR=.cache/smoke-azure
  ```

- Para **Azure OpenAI**:

  ```
  CRONISTA_LLM=azure-openai
  AZURE_OPENAI_ENDPOINT=https://<recurso>.openai.azure.com
  AZURE_OPENAI_API_KEY=<clave del recurso>
  AZURE_OPENAI_DEPLOYMENT=<nombre exacto del deployment>
  AZURE_OPENAI_API_VERSION=<versión compatible, o vacío para el default del adaptador>
  CRONISTA_CACHE_DIR=.cache/smoke-azure
  ```

El endpoint debe corresponder al adaptador seleccionado. Los contratos actuales
están en `src/lib/llm-foundry.ts` y `src/lib/llm-azure-openai.ts`: Foundry envía
`thinking: adaptive`; Azure OpenAI envía `temperature: 0.3`,
`max_completion_tokens` y `response_format: json_object`. Si el deployment no los
admite, registrar el error y ajustar el adaptador con pruebas antes de continuar.

## Pasos

1. Typecheck y CI del código que se va a probar en verde. Anotar su commit.
2. Una corrida real, sin caché, con la semilla de referencia:

   ```
   npm run cronica -- --seed 42 --sin-cache
   ```

   Esperado: cabecera `modo llm · LLM foundry:<deployment>` o
   `modo llm · LLM azure-openai:<deployment>`, crónica
   ES/EN con citas `↳ hNN (...)`, y la sección «Historia» con el veredicto de cada
   intento. Si el modelo falla las reglas tres veces, sale `modo acta` — también es
   un resultado válido de recuperación. Un acta tras errores de transporte
   (401, 429, etc.) no demuestra inferencia real: revisar el audit y distinguir
   una respuesta del modelo rechazada de una llamada que no recibió respuesta.
   Para consultar los detalles, una corrida con `--json` expone `cronica.audit`.
   Cada corrida sin caché puede volver a llamar al servicio.
   Las frases publicadas pasan V1–V8; eso no garantiza toda su semántica.
   Revisar manualmente ES y EN contra los hechos y eventos de esta salida.
3. Repetir el mismo comando **con** caché (sin `--sin-cache`) dos veces: la segunda
   debe decir `desde caché` y no llamar al LLM (cero costo). La primera corrida
   con caché debe llamar al servicio y guardar su resultado; la corrida inicial
   con `--sin-cache` no escribe en caché.
4. Guardar la salida completa de (2) en `docs/evidencia/primera-corrida-foundry.md`
   o `docs/evidencia/primera-corrida-azure-openai.md`. Anotar fecha UTC, commit,
   backend, deployment, modelo/versión y región observados en la cuenta, semilla,
   modo final, intentos y resultado de la revisión manual. No incluir claves ni
   cabeceras de autenticación. No atribuir costos medidos si solo hay estimaciones.
   Si hubo un rechazo real, anotar la semilla para el video (brief 006).

## Si falla

| Síntoma | Causa probable |
|---|---|
| `necesita la variable FOUNDRY_…` o `AZURE_OPENAI_…` | falta una variable del backend seleccionado en `.env` |
| 401 / 403 | clave equivocada o del recurso equivocado |
| 404 | endpoint, deployment o api-version incorrectos; comprobar la URL del adaptador |
| 400 sobre parámetros | incompatibilidad entre el contrato del adaptador y el deployment |
| 429 / cuota | revisar cuota asignada y límites de tasa del deployment; no inferir la causa solo del código HTTP |
