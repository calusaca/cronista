# 016 — El mundo: países, ligas y campeonatos

**Fecha:** 2026-10-02 · **Diseña:** Fable (pedido de Carlos: «ligas inventadas
con equipos inventados… que jueguen campeonatos») · **Implementa:** Opus ·
**Estado:** cerrado · Primero del programa del mundo (016 mundo → 018
condiciones → 019 consecuencias; el 017 es un arreglo chico de legibilidad
que va antes)

## Objetivo

Pasar de partidos sueltos a un **mundo ficticio completo**: países con clima,
ligas con calendario, una temporada entera simulada y navegable. Es la base
que 017 (clima/cancha/presión) y 018 (sanciones/lesiones/ratings de
temporada) necesitan, y el argumento de «synthetic data creation» a escala:
no un partido inventado — una liga entera, coherente y verificable.

## 1 · El mundo (`src/mundo/`)

- **8 países ficticios**, cada uno con nombre propio y **perfil climático**
  (se consume en 017): `tropical | desertico | templado | nordico | lluvioso |
  de_altura`. Nombres inventados con el generador existente de nombres
  (ningún país real — coherente con la regla de cero datos reales).
- **1 liga por país** (nombre propio: «Liga del Sol Alto»…), **10 equipos por
  liga**, generados con las plantillas existentes; cada equipo gana `pais`,
  `liga` y (para 017) su **cancha**: superficie (`natural | sintetica`) y
  césped (`corto | alto`) — por ahora solo identidad, sin efecto.
- Todo determinista desde una semilla de mundo (`MUNDO_SEMILLA` en umbrales).

## 2 · La temporada

- **Round-robin ida y vuelta**: 18 jornadas, 5 partidos por jornada,
  calendario determinista (algoritmo del círculo).
- **Cada partido de liga ES un partido normal**: su semilla es
  `semillaDePartido(liga, temporada, jornada, índice)` (hash determinista) y
  su página es la vista de partido de SIEMPRE (crónica, stats, pizarra,
  ratings, live — todo gratis). La config del partido la fabrica la
  temporada; en este brief es la config estándar (017 le suma condiciones).
- **Tabla de posiciones**: puntos (3/1/0), DG, goles; desempate puntos → DG →
  goles → orden alfabético. **Goleadores** de la liga (top). Ambas son
  funciones puras de los resultados.

## 3 · Regla de oro (la de siempre)

`configDeSemilla` y todos los caminos existentes NO cambian: la prueba del
fixture `hashes-legado.json` pasa sin tocarla. El mundo es código NUEVO
alrededor del motor, no un cambio del motor. Los partidos de liga usan las
mismas funciones públicas del simulador.

## 4 · UI

- **`/liga`** (y home gana un enlace «League mode»): tabla de posiciones,
  selector de jornada con sus 5 partidos (marcadores + link a cada partido),
  goleadores. Partido de liga muestra breadcrumb («Liga del Sol Alto ·
  Jornada 7») y navegación anterior/siguiente.
- Honesto como siempre: «A fully simulated fictional league» en la cabecera.
- Tokens del 010; 360 px sin desbordes. La tabla es el único elemento que
  puede scrollear horizontal en móvil, en su propio contenedor.

## Fuera de alcance

Varios campeonatos simultáneos en la UI (el mundo genera 8 ligas, la UI
muestra UNA — las demás esperan), copas, ascensos/descensos, mercado de pases,
condiciones (017), sanciones/lesiones/rating general (018).

## Propiedades verificables

1. Fixture reina intacto (hashes-legado sin tocar).
2. Determinismo: la temporada completa dos veces ⇒ byte-idéntica (tabla
   incluida).
3. Calendario: cada equipo juega 18 partidos, 9 de local, exactamente 2 contra
   cada rival (ida y vuelta, localía invertida).
4. **Oráculo de la tabla**: recomputación independiente en el test desde los
   resultados de los partidos (puntos, DG, desempates) ⇒ coincide. Mutación:
   empate vale 2 ⇒ muere; DG invertida ⇒ muere.
5. Goleadores == recuento independiente de eventos gol.
6. E2e: /liga → tabla visible → clic en un partido de la jornada → vista de
   partido completa con breadcrumb → volver.

## Aceptación

Suites + e2e vistos por Fable; smoke a ojo de la tabla y 2 partidos de liga;
los nombres del mundo leídos a ojo (que suenen a mundo, no a lorem).
