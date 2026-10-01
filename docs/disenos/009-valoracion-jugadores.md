# 009 — Valoración de jugadores

**Fecha:** 2026-10-01 · **Diseña:** Fable (idea de Carlos) · **Implementa:** Opus
(tras el 008) · **Estado:** cerrado

## Objetivo

Nota de partido 1–10 por jugador, estilo prensa deportiva, **computada
deterministamente desde los eventos y explicable con un clic**: tocar la nota
muestra el desglose — qué eventos la ganaron y cuánto sumó cada uno. Responde a
«meaningful football statistics» y «player focused» de las reglas, con nuestro
sello: ratings auditables, no opiniones de una IA.

## Cálculo (determinista, en `src/analista/valoracion.ts`)

- Base 6.0; escala final acotada [3.0, 10.0]; redondeo a un decimal.
- Sumas y restas por evento, pesos en `umbrales.ts` comentados (valores
  iniciales, calibrables): gol +1.2 (+0.3 extra si xG < 0.15 — definición
  difícil), tiro a puerta (atajado) +0.3, pase clave +0.3, córner forzado +0.1,
  amarilla −0.5, roja −1.5, falta −0.1, fuera de juego −0.1.
- **Porteros** (posición POR): atajada +0.5, +xG atajado acumulado ×1.0; gol
  recibido −0.3.
- Solo jugadores con participación (≥1 evento o POR titular); un suplente se
  valora desde que entra. El expulsado conserva su nota al salir.
- Salida: `Valoracion { jugador, equipo, posicion, nota, desglose: [{evento,
  delta, motivo}] }` — el desglose cita IDs de eventos reales, siempre.

## Hecho nuevo: `figura_del_partido`

El mejor valorado del partido (desempate: más delta positivo por goles, luego
orden de plantilla). Texto: «{jugador} fue la figura del partido (nota {nota})» /
EN equivalente. Cita los eventos de su desglose. Relevancia 72 (entre gol y
resultado). La nota entra a `datos`, así V3 la verifica si la crónica la
menciona. Léxico: «figura / man of the match / player of the match» se habilita
en V8 SOLO con este hecho como principal.

## UI

- Panel de **Ratings** en la vista de partido (ambas plantillas con su nota,
  ordenadas; la figura destacada). Clic en una nota → desglose con sus eventos
  (y los eventos se resaltan en la línea de tiempo, como todo lo demás).
- En modo Analista, el desglose se muestra expandido.
- En el modo live (008): las notas evolucionan con el prefijo del replay —
  gratis, porque la valoración es función pura de los eventos vistos.
- Rotulado honesto: «computed from match events» en el panel.

## Propiedades verificables

1. Determinismo: mismos eventos ⇒ mismas notas byte a byte.
2. La nota es exactamente base + suma del desglose, acotada; cada delta cita un
   evento existente del jugador (oráculo del 002 extendido al nuevo hecho).
3. Sin clarividencia en live: la nota al minuto M solo usa eventos ≤ M.
4. Fixtures: hat-trick ⇒ figura; portero con 7 atajadas supera a un jugador de
   campo mediocre; expulsado temprano queda bajo; partido sin eventos de campo ⇒
   sin figura (no se inventa).
5. Pesos importados de umbrales, jamás repetidos en pruebas; rareza no aplica
   (figura sale siempre que haya participación — es un hecho descriptivo).
6. E2e: panel visible → clic en nota → desglose con ≥1 evento → evento
   resaltado.

## Calibración (1 oct, tras la implementación)

Con los pesos iniciales el portero salía figura en el 61 % de 500 semillas (en
la 246: portero 10.0 por encima de un doblete 8.9 — eso no lo firma un
periodista). Barrido del implementador + contraprueba independiente de Fable:
`atajada` baja de 0.5 a **0.1**; el factor de xG atajado se queda en 1.0 porque
un factor fraccionario sobre un xG en centésimas produce medias centésimas y
rompe la aritmética exacta del cálculo. Resultado medido: portero figura 5.8 %,
DEL 56 %, MED 29 %, DEF 9 %. Los valores viven solo en `umbrales.ts`; los de
arriba quedan como historia del punto de partida.

## Fuera de alcance

Comparaciones entre partidos, promedios de temporada, percentiles, ratings de
equipos.

## Aceptación

Suites y e2e vistos en verde; smoke a ojo de Fable con 2 semillas («¿estas notas
las firmaría un periodista?»); CLI `npm run analizar` muestra las valoraciones.
