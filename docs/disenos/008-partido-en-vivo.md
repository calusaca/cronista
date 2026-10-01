# 008 — Partido en vivo

**Fecha:** 2026-10-01 · **Diseña:** Fable · **Implementa:** Opus · **Estado:**
cerrado (go adelantado del 12 oct: prerequisitos auditados y 2 semanas de ventaja)

## Objetivo

Replay acelerado de un partido simulado: los eventos entran minuto a minuto, la
línea de tiempo crece, y en los momentos clave aparecen **actualizaciones
narrativas verificadas** antes de mostrarse. Cubre el caso de uso oficial
«analyze match events in real time» + «real-time narratives». Honestidad: es un
**replay** de un partido determinista y la UI lo rotula así — no fingimos
streaming en vivo.

## Arquitectura

- **Análisis incremental gratis**: `analizar(eventos[0..i])` ya es función pura —
  los hechos «hasta el minuto M» salen de llamarla sobre el prefijo. Cero cambios
  al 002.
- **Actualizaciones**: en cada momento clave (gol, roja, descanso, final) el
  Cronista escribe UNA actualización corta (1–2 oraciones, mismo contrato
  un-hecho-por-oración) usando SOLO hechos del prefijo; pasa el **mismo
  Verificador V1–V8** antes de mostrarse; con stub, plantillas. La cobertura V5
  de crónica completa no aplica a updates: cada update debe narrar como principal
  el hecho del momento que la dispara.
- **La propiedad estrella — sin clarividencia**: una actualización del minuto M
  solo puede citar hechos y eventos con minuto ≤ M. El update del 1–0 no puede
  mencionar el resultado final. Propiedad verificable con fixtures y corpus
  (update de cada momento clave de las semillas 1..100: ningún evento citado
  futuro, ningún número del futuro en el texto).
- **Caché** por `(seed, momento, deployment, modo)`: demo instantánea y costo
  acotado (~5–8 llamadas por partido con LLM real, una vez).

## UI

Botón **Watch live** en la vista de partido → modo replay: línea de tiempo
creciendo, marcador progresivo, **ticker** de actualizaciones verificadas (cada
una clicable → sus eventos, como las frases), velocidad ×1/×5/pausa, y
**Skip to full-time** → la crónica completa de siempre. Rotulado «Replay».

## Export de overlay (broadcast)

Endpoint `GET /api/overlay/[seed]`: JSON minutado de las actualizaciones
verificadas `{minuto, texto_es, texto_en, hecho, eventos}` — la salida «timed
and machine-readable» que §4.1 de las reglas pide para overlays de broadcast.
Se documenta en el README como punto de integración para estudio/streaming.

## Propiedades verificables

1. Sin clarividencia (arriba) — fixtures + corpus 1..100.
2. Determinismo: mismo seed ⇒ mismos momentos, mismas updates.
3. Toda update mostrada pasó V1–V8 (fixture con cronista malicioso en modo
   update: la mentira no llega al ticker; cae a plantilla del hecho — el acta de
   los updates).
4. El overlay JSON valida contra esquema zod y coincide con lo que la UI muestra.
5. E2e: Watch live → updates aparecen en orden de minuto → clic en una →
   eventos resaltados → Skip → crónica completa visible. Pausa funciona.

## Fuera de alcance

WebSockets/streaming real, varios partidos a la vez, notificaciones.

## Aceptación

`npm test` y `npm run e2e` vistos correr en verde; CLI o ruta para el overlay
vista; smoke a ojo de Fable con 2 semillas en modo live.
