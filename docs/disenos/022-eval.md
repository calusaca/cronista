# 022 — La eval: un agente vs pipeline, la cifra del titular

**Fecha:** 2026-10-03 · **Diseña:** Fable (diseño base en 005 §eval) ·
**Implementa:** Opus · **Estado:** cerrado

## Objetivo

`npm run eval`: la cifra reproducible que la categoría Multi-Agent pide («an
end-to-end outcome a single agent could not achieve as effectively»). Compara,
sobre las mismas semillas, lo que publicaría un agente solo contra lo que
publica la cadena completa. El harness se construye y prueba HOY con
`CRONISTA_LLM=ensayo`; el lunes corre idéntico con `foundry`.

## Diseño

- `src/eval/cli.ts` (`npm run eval`), reutilizando la cadena existente — cero
  lógica nueva de verificación.
- **Baseline («single agent»)**: el Cronista genera y su PRIMER intento se
  toma como lo publicado — sin reintentos, sin omisión, sin acta. El juez de
  la métrica es el Verificador existente corriendo en modo evaluación sobre
  ese texto (cuenta frases con hallazgos V1–V8).
- **Pipeline**: la cadena completa de siempre; se cuentan las frases con
  hallazgos que LLEGAN al lector (por construcción deben ser 0 — si no, eso
  es un bug del producto y la eval lo delata: assert).
- Semillas: `EVAL_SEMILLAS` en `src/eval/umbrales-eval.ts` — N=20 fijas,
  variadas (incluir 246, 116, 834, 289 y 16 más del corpus con marcadores
  distintos). Mismas semillas siempre ⇒ reproducible.
- Salida: tabla por semilla (frases baseline, con hallazgos, % · frases
  pipeline, con hallazgos) + titular: «X % of unverified sentences contained
  unsupported claims; the pipeline published 0» + costo estimado (tokens
  usados; con caché, centavos). Exit code 0 solo si pipeline = 0.
- Backend por `CRONISTA_LLM` como todo lo demás; con `ensayo` el resultado es
  determinista y el titular esperado se conoce (el ensayo mete un error
  deliberado por crónica ⇒ baseline > 0 SIEMPRE, cifra exacta fijable en
  prueba).
- La corrida con ensayo deja su salida de muestra en
  `docs/evidencia/eval-ensayo.md` (rotulada como ensayo, NO es la cifra del
  README — esa es del LLM real del lunes).

## Propiedades verificables

1. Determinismo con ensayo: dos corridas ⇒ bytes idénticos.
2. Prueba que fija el titular con ensayo (cifra exacta, desde la batería).
3. Pipeline = 0 con ensayo Y con stub (prueba en ambos backends).
4. El baseline no reintenta jamás (mutación: baseline con reintentos ⇒ la
   cifra cambia ⇒ muere).
5. Sin red: con `foundry` sin credenciales, mensaje claro y exit ≠ 0 (patrón
   del 003).

## Mutaciones mínimas

Baseline con reintentos ⇒ muere; juez que ignora V8 ⇒ muere (la cifra baja);
semillas leídas de otro lado que umbrales-eval ⇒ muere; pipeline contado sobre
el borrador y no sobre lo publicado ⇒ muere.

## Aceptación

`npm run eval` visto por Fable con ensayo (dos corridas idénticas); suites
verdes; sin e2e nuevo (es CLI). Sin tocar nada de src/cadena salvo imports.
