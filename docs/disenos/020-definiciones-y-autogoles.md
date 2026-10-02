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

| `definicion` | Rareza objetivo (entre GOLES) | Coherencia dura |
|---|---|---|
| `jugada` (default) | resto | — |
| `cabezazo` | 12–18 % | nace de córner o centro (banda), área, altura ≠ rasa, velocidad 40–75 |
| `mano_a_mano` | 8–14 % | nace de pase clave filtrado, zona central (área chica/frontal), xG ≥ 0.25 |
| `vaselina` | 1–3 % | altura alta, velocidad 40–70, mano a mano o salida del portero |
| `chilena` | 0.1–0.4 % | área chica, nace de centro (banda/córner), altura alta de origen |
| `tijera` | dentro de la banda de chilena | variante de chilena (cae junta en la rareza) |
| `media_cancha` | 0.05–0.25 % | `distanciaM` 40–55 (cola nueva SOLO con esta definición), xG ≤ 0.03, velocidad ≥ 85 |

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
