# 011 — La jugada con detalle: animación respaldada y partido al azar

**Fecha:** 2026-10-01 · **Diseña:** Fable (pedidos de Carlos: «ponele más
detalle para poder respaldar la animación» y «todos los resultados dan 4–1») ·
**Implementa:** Opus · **Estado:** cerrado

## Objetivo

Dos cosas que el juez siente en los primeros 60 segundos:

1. **La jugada del gol se anima sin inventar nada.** Hoy la pizarra usa
   posiciones convencionales y lo confiesa. Carlos pidió la animación con la
   regla correcta: primero más detalle EN LOS EVENTOS, y la animación se
   respalda en eso. Nada que no esté registrado se dibuja.
2. **La variedad de partidos se siente.** Medido: 33 marcadores distintos en
   500 semillas (1–1×51, 1–2×44, 0–1×44…). Pero la portada siempre es la 246
   (4–1) y Carlos creyó que «todo da 4–1». Falta un botón de partido al azar.

## 1 · Detalle espacial en el simulador (aditivo, sin tocar un partido existente)

Campos nuevos OPCIONALES en eventos de ataque:

- `tiro` (y `gol` vía su tiro): `zona` de origen — vocabulario cerrado en
  `limites.ts`: `area_chica | punto_penal | frontal_del_area | banda_izquierda |
  banda_derecha | media_distancia` — y `destino`: `palo_izquierdo |
  palo_derecho | centro_del_arco`, con `altura`: `raso | media | alta`.
- `atajada`: `lado` del portero (`su_izquierda | su_derecha | centro`),
  coherente con el `destino` del tiro relacionado (tabla fija: palo_izquierdo
  del tirador = su_derecha del portero, etc. — invariante).
- `corner`: `lado` (`izquierdo | derecho`).
- `pase_clave`: `zona` de origen (mismo vocabulario).

**Regla dura — los partidos de hoy NO cambian:**

- Los campos nuevos salen de un stream DERIVADO: `prngDerivado(semilla,
  evento.id)` (hash determinista), JAMÁS del stream principal. Ni un `next()`
  extra en el flujo existente.
- Prueba de no-regresión: la proyección legado (eventos SIN los campos nuevos)
  del corpus hasheado del 001 produce EXACTAMENTE los hashes ya grabados (los
  archivos de hash del corpus no se tocan). Se agrega un segundo hash que
  incluye los campos nuevos.

**Coherencia (invariantes nuevos, bandas en `limites.ts`):**

- `penal` ⇒ `zona = punto_penal`.
- Tiro nacido de córner (relacionadoCon) ⇒ zona de área (`area_chica` o
  `frontal_del_area`).
- Coherencia zona↔xG por bandas: `area_chica` solo con xG alto,
  `media_distancia` solo con xG bajo (bandas con holgura, en limites, atacables
  por el auditor).
- Gol ⇒ el `destino` existe; atajada ⇒ `lado` coherente con el tiro.
- Determinismo byte a byte del partido completo con campos incluidos.

## 2 · Pizarra y animación del gol (UI)

- La pizarra pasa de posiciones convencionales a **posiciones por zona desde
  los datos**: tabla fija `zona → (x, y)` en el SVG (una sola, en el
  componente). El rótulo cambia a «positions by zone, from match data» — ya no
  pide perdón, pero tampoco promete centímetros: son zonas.
- **Animación 2D en el mismo SVG**: el balón recorre la secuencia registrada
  (origen → remate → gol/atajada, máx. 3 pasos, ~2.5 s), el destino del remate
  apunta al palo registrado, y al terminar queda la pizarra completa. Botón
  «Replay». `prefers-reduced-motion` ⇒ sin animación, pizarra estática directa.
- Todo lo dibujado cita lo registrado: minutos, nombres, xG, zona, palo. Nada
  más. Si un gol viejo en caché no tuviera campos nuevos (no pasará: se
  recalculan del partido), la pizarra cae a la versión estática convencional
  con su rótulo anterior.

## 3 · Partido al azar

- Botón **«Random match»** (icono de dado, texto) junto al formulario de la
  semilla: navega a `/match/<semilla aleatoria 1..99999>`. `Math.random` está
  bien AQUÍ (componente de UI; sigue prohibido en `src/sim/`).
- A 360 px cabe sin desbordar (se mide como en el 010).

## Fuera de alcance

- Narrar zona/palo en la crónica (léxico V8 para «definió al palo derecho»):
  fase posterior si sobra tiempo, NO en este brief. Los `datos` de los hechos
  no cambian; el Verificador y el oráculo del 002 no ven los campos nuevos.
- Posiciones exactas de 22 jugadores, trayectorias de pase completas, 3D.

## Propiedades verificables

1. Proyección legado del corpus ⇒ hashes grabados intactos (el test viejo pasa
   sin editar sus datos).
2. Determinismo del partido con campos nuevos (doble corrida byte a byte).
3. Invariantes de coherencia (penal, córner, zona↔xG, lado del portero) en el
   corpus 1..500; valores/bandas importados de limites, jamás repetidos.
4. Fixtures: gol de penal ⇒ pizarra con punto penal; gol tras córner ⇒ origen
   en la esquina; atajada ⇒ lado coherente.
5. E2e: clic en un gol ⇒ animación corre (o pizarra directa con
   reduced-motion) ⇒ al terminar, pizarra con zona y palo visibles; botón
   Random navega a un partido válido. El camino del juez existente queda
   intacto; solo el spec de la pizarra puede ganar asertos (no perderlos).
6. Mutaciones de control mínimas: animación desconectada del dato de destino
   (dibuja siempre al centro) ⇒ muere; stream derivado reemplazado por el
   principal ⇒ muere la prueba de hashes legado.

## Aceptación

Suites, stats y e2e vistos en verde por Fable; smoke a ojo con ≥3 goles de
semillas distintas (penal, córner, jugada normal) en claro y oscuro; capturas
para Carlos. Rótulos honestos revisados.
