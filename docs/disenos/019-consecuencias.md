# 019 — Consecuencias: sanciones, lesiones y el rating de temporada

**Fecha:** 2026-10-02 · **Diseña:** Fable (pedidos de Carlos: «que se
lesionen», expulsiones con consecuencia, y «rating general, no de cada
partido» — idea de su amigo) · **Implementa:** Opus (tras el 018) ·
**Estado:** cerrado

## Objetivo

La temporada del 016 se vuelve VIVA: lo que pasa en un partido afecta el
siguiente. Expulsado ⇒ suspendido; lesionado ⇒ fuera N jornadas; y cada
jugador acumula un **rating general de temporada** auditable. Nada de esto
toca los partidos sueltos por semilla (regla de oro intacta).

## 1 · Sanciones (solo liga)

- Doble amarilla ⇒ 1 jornada de suspensión; roja directa ⇒ 2. (Acumulación de
  amarillas: fuera de alcance v1.)
- La temporada lleva el registro y arma la alineación de la jornada siguiente
  sin el sancionado (entra el suplente de su posición del plantel extendido).
- Determinista: la temporada entera dos veces ⇒ idéntica, sanciones incluidas.

## 2 · Lesiones (solo partidos de liga — gated por config, como el 018)

- Evento macro nuevo `lesion` habilitado SOLO por `config.variantes` (ausente
  ⇒ stream byte-idéntico: fixture reina intacto). Sale de una falta dura
  (relacionadoCon) o de un sobreesfuerzo; el lesionado sale del partido
  (cambio forzado) y queda fuera `jornadas` (1–4, severidad sorteada).
- Rareza en umbrales (~0,3 lesiones/partido); invariante: el lesionado no
  vuelve a aparecer en ese partido ni en las jornadas de baja.
- Hechos: `lesion_en_partido` («X se retiró lesionado al 61'») y, en la
  PREVIA de la crónica de liga, `bajas_del_partido` («Y llega sin X,
  suspendido») — datos del registro de temporada, citables. V8: «diezmado /
  depleted» solo con ≥ 2 bajas.

## 3 · Rating general de temporada

- Por jugador: **media de sus notas de partido** (las del 009) ponderada
  simple por partidos jugados, a un decimal, con `partidos` visible al lado
  («7.1 en 12 partidos»). Nada de opinión: es la agregación de lo ya
  auditado.
- Página de liga gana pestaña **Players**: top por rating (mín. 5 partidos,
  umbral en umbrales), goleadores, tarjetas, lesionados actuales.
- Clic en un rating general ⇒ el desglose: la lista de sus partidos con la
  nota de cada uno, cada fila linkeando al partido (donde vive el desglose
  fino del 009). Auditable de punta a punta.
- Oráculo: recomputación independiente de la media y del top en el test.

## Restricciones

- Fixture reina intacto; `variantes` ausente ⇒ byte-idéntico (prueba
  explícita como la del 018).
- Umbrales/severidades solo en umbrales; rarezas anotadas.
- Mutaciones mínimas: suspensión ignorada ⇒ muere (el sancionado aparece);
  media del rating con una nota inflada ⇒ oráculo; lesionado reaparece ⇒
  invariante.

## Aceptación

Suites + e2e (pestaña Players: top visible → clic → desglose → link a un
partido) vistos por Fable; smoke a ojo de una temporada: un suspendido que se
pierde la jornada siguiente, visto en las alineaciones.
