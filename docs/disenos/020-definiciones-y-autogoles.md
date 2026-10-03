# 020 — Definiciones con alma y autogoles

**Fecha:** 2026-10-02 · **Diseña:** Fable (pedido de Carlos: «chilenas,
tijeritas, goles desde media cancha — muy raro pero que pueda pasar; mano a
mano; por arriba; y autogoles») · **Implementa:** Opus (tras el 019) ·
**Estado:** cerrado

## 1 · `definicion` del tiro (aditivo — mecanismo del 011/015)

Campo opcional `definicion` en `tiro` (y gol/atajada por herencia), sorteado
del stream derivado DESPUÉS de los sorteos del 015 (nuevo fixture de orden si
hace falta, como `hashes-011`). La proyección legado se extiende
conscientemente; `hashes-legado.json` ni se toca.

Vocabulario cerrado y su coherencia (todo en `limites.ts`):

**Rev 1.1 (2026-10-02, Fable):** las bandas de velocidad originales de cabezazo
(40–75) y vaselina (40–70) chocaban con el piso absoluto de 60 km/h que el 015
juró («jamás un 8 km/h») — error de diseño de este brief, detectado por Opus
antes de escribir código. Resolución: **las definiciones anidan DENTRO del
contrato del 015** (el contrato jurado y probado no se reabre): cabezazo 60–75,
vaselina 60–70. La vaselina real suele ser más lenta, pero ninguna frase
narrable depende de la velocidad (V8 de vaselina paga por la altura y el mano a
mano, no por km/h), así que no hay mentira posible; queda como simplificación
anotada. La altura es campo del 011 y se FILTRA, jamás se reescribe
(`hashes-011` intacto). mano_a_mano baja su xG a ≥ 0.20 (sigue siendo ocasión
clara) porque con 0.25 el corpus solo ofrece 6,3 % de goles elegibles y el
objetivo es 8–14; si re-medido sigue bajo 8 %, se acepta además el pase atrás
al área chica desde banda (un pase recibido solo frente al portero ES un mano a
mano), manteniendo las demás coherencias.

| `definicion` | Rareza objetivo (entre GOLES) | Coherencia dura |
|---|---|---|
| `jugada` (default) | resto | — |
| `cabezazo` | 12–18 % | nace de córner o centro (banda), área, altura ≠ rasa, velocidad 60–75 (reescrita dentro del 015) |
| `mano_a_mano` | 8–14 % | nace de pase clave filtrado, zona central (área chica/frontal), xG ≥ 0.20 (fallback rev 1.1: + pase atrás al área chica) |
| `vaselina` | 1–3 % | altura alta (filtrada, no reescrita), velocidad 60–70 (reescrita dentro del 015), mano a mano o salida del portero |
| `chilena` | 0.1–0.4 % | área chica, nace de centro (banda/córner), altura alta de origen |
| `tijera` | dentro de la banda de chilena | variante de chilena (cae junta en la rareza) |
| `media_cancha` | 0.05–0.25 % | `distanciaM` 40–55 y velocidad ≥ 85 reescritas (cola nueva SOLO con esta definición, exenta de `DISTANCIA_ZONA.media_distancia`), xG ≤ 0.03 |

Fixture de orden: `hashes-015.json` grabado desde 90d37a0 (magnitudes del 015,
semillas 1..300, con el porqué anotado); la prueba compara todos los tiros
salvo los que el 020 reescribe a propósito (cabezazo, vaselina, media cancha).
Costo estadístico aceptado: cola < 70 km/h ~5 % → ~9 % (techo 15 %), media
92,4 → ~91 (banda 85–95).

- La rareza se mide en la suite estadística (bandas arriba, N = 1000); las
  definiciones también existen en tiros NO convertidos (más frecuentes:
  el mano a mano atajado es normal).
- Pizarra y relato: la definición se nombra en el paso y el rótulo
  («¡Chilena! · área chica · 4 m»); la animación de media cancha recorre su
  distancia real.
- V8 por definición: «de chilena / bicycle kick / overhead», «de vaselina /
  chipped the keeper», «mano a mano / one-on-one», «desde media cancha /
  from the halfway line», «de cabeza / header» — SOLO con el campo
  registrado. Mentiras de batería por cada una, ES y EN.
- Valoraciones (009): bonus en umbrales — chilena/media_cancha +0.5,
  vaselina +0.2 (son la jugada de la jornada).

## 2 · Autogoles (solo liga — gated por `config.variantes`, como la lesión)

- Con `variantes`: un gol puede ser `autogol: true` — el `jugador` es un
  DEFENSOR del equipo que lo sufre y el gol cuenta para el rival. Rareza
  ~2–3 % de los goles (umbral).
- Sin `variantes` (partidos por semilla): stream byte-idéntico — fixture
  reina intacto, prueba explícita.
- Coherencia: nace de centro o tiro rival (relacionadoCon); el autor está en
  cancha; el marcador y la tabla del 016 lo cuentan para el rival (oráculo de
  la tabla lo verifica).
- Analista: hecho `autogol` («en propia puerta») — relevancia alta (82, es
  LA anécdota); goleadores NO lo cuentan para el rival (regla FIFA: va como
  autogol, no al goleador); valoración del autor −1.0 (umbral).
- Verificador: V4/V8 — el nombre del autor pertenece al equipo que LO SUFRE y
  los verbos de mérito («marcó») no se le aplican al rival por él; «en propia
  puerta / own goal» solo con el hecho. Mentiras: atribuirle el gol al
  delantero rival ⇒ rechazada; «marcó X» siendo autogol ⇒ rechazada.
- Pizarra: paso «en propia puerta» y el punto del autor en el color del
  equipo que lo sufre (señal, no acento).

## Propiedades verificables

1. Fixture reina intacto; sin `variantes` ⇒ byte-idéntico.
2. Rarezas en banda (suite estadística); todas las definiciones existen en el
   corpus (ninguna banda vacía).
3. Coherencias duras de la tabla (invariantes, corpus 1..1000 + corpus liga).
4. Tabla/goleadores con autogol correctos (oráculo del 016 extendido).
5. Batería V8 por definición y por autogol, ES/EN.
6. Mutaciones mínimas: chilena sin coherencia de origen ⇒ muere; autogol
   contado al goleador ⇒ oráculo; «de chilena» con definicion=jugada ⇒
   batería; definición sorteada antes que el 015 ⇒ fixture de orden.

## Aceptación

Suites + stats + e2e vistos por Fable; smoke a ojo: UNA chilena y UN gol de
media cancha del corpus encontrados y mirados en su pizarra («¿se siente
legendario?»), un autogol de liga en su crónica («¿queda claro sin confundir
el marcador?»); rarezas anotadas.
