# 023 — Adaptador Azure OpenAI (para el bake-off del 6 oct)

**Fecha:** 2026-10-03 · **Diseña:** Fable (deuda conocida de la bitácora) ·
**Implementa:** Opus (tras el 022) · **Estado:** cerrado

## Objetivo

`src/lib/llm-azure-openai.ts`: cuarto backend del seam de `src/lib/llm.ts`
(`CRONISTA_LLM=azure-openai`), para que el lunes el bake-off GPT-6.1 Sol
(crédito Azure, $0) vs Claude (Marketplace) sea enchufar variables y correr.
Se construye y prueba HOY offline con fetch inyectado — el patrón exacto con
el que se construyó `llm-foundry.ts` antes de existir la cuenta.

## Diseño

- Mismo contrato que los demás backends (misma función, mismos tipos zod,
  mismo manejo de errores → acta; cache compartida por (semilla, deployment,
  modo/perspectiva) con hash de hechos — el campo deployment ya distingue
  backends, verificarlo).
- Azure OpenAI chat completions: `POST {AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}`,
  header `api-key`. Variables: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`,
  `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` (default documentado
  en `.env.example` SIN valores). `response_format: {type:"json_object"}` si
  el prompt del 003 lo requiere; temperatura la que use foundry para Claude…
  NO: para Azure OpenAI sí se permite temperature — fijarla explícita en
  umbrales del backend con comentario (la prohibición de temperature era de
  Claude 5.x en Foundry, no de GPT).
- Sin credenciales ⇒ mensaje claro y fallo limpio (patrón del foundry).
- Pruebas con fetch inyectado: URL/headers/payload correctos, respuesta feliz
  parseada por zod, respuesta malformada ⇒ acta, 401/429/500 ⇒ acta con
  motivo, truncamiento ⇒ acta.

## Mutaciones mínimas

Header api-key ausente ⇒ muere; api-version hardcodeada fuera de env/default
⇒ muere; respuesta sin validar por zod ⇒ muere; cache sin el deployment en la
clave ⇒ muere.

## Aceptación

Suites verdes vistas por Fable; `.env.example` actualizado sin valores; cero
cambios en los otros backends; sin e2e (no hay UI).
