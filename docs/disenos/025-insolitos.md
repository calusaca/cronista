# 025 — Eventos insólitos

**Fecha:** 2026-10-03 · **Diseña:** Fable (idea de Carlos; investigación de
casos reales: perro de 1962 y Argentina 2018, apagones, gol olímpico de
Onzari 1924, porteros goleadores) · **Implementa:** Opus (tras el 024) ·
**Estado:** cerrado

## Objetivo

Rarezas que hacen único un partido entre mil, cada una registrada como dato,
coherente y narrable SOLO con su hecho. Lista cerrada de CINCO; gated por
`config.variantes.insolitos` (ausente ⇒ byte-idéntico; la liga lo enciende),
sorteos derivados siempre.

## Los cinco (rarezas objetivo en limites.ts, medidas en el corpus de liga)

1. **Gol olímpico**: el córner entra directo. `definicion: "olimpico"` (se
   suma al vocabulario del 020) en un gol cuyo `relacionadoCon` ES el córner,
   sin tiro intermedio. Rareza: 0,02–0,1 % de los goles. V8: «olímpico /
   de córner directo / straight from the corner» solo con la definición.
   Coherencia: nace de córner, zona area_chica, el autor es quien sacó.
2. **El portero sube y marca**: minuto ≥ 88, su equipo pierde por 1, hay
   córner ⇒ evento `subida_portero` (p baja); el POR entra a los pesos del
   cabezazo de ESE córner. Si marca: la anécdota del año. Rareza de la
   subida ~1–3 % de los córners elegibles; del gol, la que salga (anotarla).
   Invariante: el POR jamás remata sin subida registrada; tras el córner
   vuelve (ningún otro evento suyo de campo).
3. **Doble palo**: tiros no convertidos ganan `alPalo?: 1 | 2` (uno o los dos
   palos en la misma jugada). Rareza: al palo 2–5 % de los tiros no gol;
   doble 0,5–2 % de esos. La pizarra lo dibuja (el rebote entre palos solo
   si alPalo=2). V8: «al palo / off the post», «doble palo / hit both posts».
4. **Interrupción breve**: evento `interrupcion` con causa de lista cerrada
   FICTICIA (`perro | objeto | globos`), minuto y duración 1–3' que SE SUMA
   al descuento de ese tiempo (coherencia con fin_periodo, invariante).
   Rareza ~1–2 % de los partidos. V8: «se interrumpió / play was stopped»
   solo con el hecho. Sin marcas, sin incidentes reales.
5. **Niebla**: clima nuevo (se suma a CLIMAS_PARTIDO y a PROB_CLIMA de los
   perfiles nordico/lluvioso/de_altura, prob. baja). Efecto medible (A/B
   N=500, banda aparte): completación de pases LARGOS −k (no ve lejos);
   hecho `efecto_niebla` SOLO con la caída medida en ese partido (patrón
   018). V8: «la niebla / in the fog».

## Reglas

- Cada rareza en limites, medida y anotada; ninguna banda vacía en el corpus
  de liga (si una no aparece en 720 partidos, se busca semilla de prueba con
  condición forzada, patrón C13).
- Hechos nuevos: `gol_olimpico` (85 — ES la anécdota), `subida_portero` (70),
  `doble_palo` (55), `interrupcion` (40), `efecto_niebla` (56). Batería de
  mentiras ES/EN por cada frase V8 (frase sin el hecho ⇒ rechazada).
- Sin clarividencia: en vivo, nada de esto se insinúa antes de su minuto.
- La severidad del reloj: la interrupción no puede hacer que el descuento
  exceda los límites de P.descuento2 + duración (ajustar invariante del
  reloj conscientemente, anotado).

## Mutaciones mínimas

Olímpico con tiro intermedio ⇒ invariante; POR remata sin subida ⇒
invariante; interrupción sin sumar descuento ⇒ invariante del reloj; niebla
narrada sin medición ⇒ batería; «hit both posts» con alPalo=1 ⇒ batería.

## Aceptación

Suites + stats + e2e vistos por Fable. Smoke: cazar en el corpus de liga (o
con semilla forzada) UN gol olímpico, UNA subida del portero y UN doble palo,
y mirarlos en pizarra y crónica («¿se siente leyenda sin mentir?»).
