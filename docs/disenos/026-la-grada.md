# 026 — La grada: reacciones de la afición derivadas de los datos

**Fecha:** 2026-10-03 · **Diseña:** Fable (idea de Carlos, versión honesta:
NADA adaptado de cánticos reales — derechos de autor y asociación con clubes
reales, con la Premier League de organizadora) · **Implementa:** Opus (tras
el 025) · **Estado:** cerrado

## Objetivo

La emoción de la grada como **capa derivada pura de los datos del partido** —
la marca de la casa aplicada al público: el «¡olé!» solo suena si la racha de
pases registrada lo paga. Sin RNG propio (función pura de los eventos+micro ⇒
sirve para partidos sueltos Y liga, sin variantes ni fixtures: no cambia
ningún dato, solo LEE).

## 1 · `reacciones(partido)` en `src/vista/grada.ts` (capa de vista, como la evidencia)

Lista cerrada de SEIS reacciones, umbrales en `analista/umbrales.ts`:

1. **¡Olé!**: racha de ≥ OLE_RACHA_MIN (12) pases completados consecutivos
   del mismo equipo, después del minuto 60, yendo ese equipo en ventaja.
   Cita los pases de la racha (ids reales de la capa micro).
2. **Rugido**: cada gol (cita el gol). La del equipo que lo sufre: silencio
   (no es reacción, es la ausencia — no se emite nada).
3. **Silbidos al descanso**: local perdiendo al 45' (cita fin_periodo y el
   marcador parcial).
4. **Ovación a la figura**: cuando la figura del partido (009) sale
   sustituida con nota ≥ OVACION_NOTA_MIN (7.5) (cita el cambio y las
   fuentes de su nota).
5. **Aliento**: el local pierde al 75' y la diferencia es 1 (cita el estado).
6. **Grito del gol de visita**: gol visitante = rugido del sector visitante,
   rotulado como tal.

## 2 · Identidad de la afición (ficción declarada)

- Cada equipo del mundo gana `aficion`: nombre del sector (generador de
  sílabas propio, p. ej. «Marea Dorinana») y UN cántico de UNA línea con
  letra 100 % original generada de plantillas propias con el nombre del
  equipo («¡Dorinana, Dorinana, nadie te para!») — lista de plantillas
  cerrada en umbrales, CERO melodías ni letras adaptadas de nada real.
- Derivado con prngDerivado (patrón reservas 019): el mundo no cambia.
- El cántico aparece SOLO como texto del ticker en la reacción 1 y 5.

## 3 · UI

- Ticker del vivo: las reacciones entran en su minuto con icono de grada;
  propiedad de prefijo (el olé al minuto M solo usa pases ≤ M — sin
  clarividencia, probado).
- Vista normal: bloque «Crowd» discreto en stats con las reacciones del
  partido, clicables a su evidencia como todo lo demás.
- Rotulado honesto: «derived from match data».

## 4 · Narración

- Hecho nuevo `ole_de_la_grada` (relevancia 50): «la grada coreó el olé con
  una racha de 14 pases» — cita la racha. V8: «olé / la grada rugió / the
  crowd roared» SOLO con su hecho (batería ES/EN).
- Las demás reacciones NO son hechos narrables v1 (viven en ticker/panel).

## Propiedades verificables

1. Pureza: mismos eventos ⇒ mismas reacciones byte a byte; cero RNG.
2. Oráculo: recomputación independiente de las rachas sobre la capa micro.
3. Prefijo: reacciones(prefijo M) == primeras reacciones(partido) hasta M.
4. Cada reacción cita ids existentes; el cántico solo sale de las plantillas.
5. E2e: ticker muestra una reacción → clic → evidencia resaltada.

## Mutaciones mínimas

Racha contada con pases incompletos ⇒ oráculo; olé antes del 60' ⇒ umbral;
ovación sin nota mínima ⇒ umbral; «olé» narrado sin hecho ⇒ batería;
reacción en el prefijo antes de su minuto ⇒ prueba de prefijo.

## Aceptación

Suites + e2e vistos por Fable; smoke: un olé cazado en el corpus y visto en
el ticker con su racha resaltada («¿emociona sin inventar?»).
