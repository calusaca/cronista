# 068 — Pasador consciente del fuera de juego, la regla en el prompt y más faltas (`reinicios-v10`)

## Estado

Brief **cerrado v1.0**, martes 27 de octubre de 2026, 03:50 UTC. Lo diseña Opus 5.5 (coordinador) y lo implementa
`opus-implementador`. Carlos aprobó A + B + C el 27 oct («si dale A+B+C»).

**Pedido de Carlos (27 oct):**

> «los delanteros están siendo muchas veces tomados en posicion prohibida, debemos procurar que los modelos cuando
> jueguen intenten no caer siempre en esa falta, no se si no tienen las reglas claras, y tambien no he escuchado
> faltas nunca en los juegos, pueden pasar?»

**Plazo duro:** el juzgamiento empieza el 27 oct a las **16:00 UTC** (09:00 PT). El coordinador despliega; para
desplegar con margen, la entrega del implementador (commit y push con todo en verde) debe estar **antes de las
09:30 UTC**. Si a las 08:30 UTC no hay forma de llegar, se para y se informa de lo que esté verde.

## v1.1 (04:20 UTC): prevalece sobre §§ 2.A, 2.B y 3

El implementador midió que A completo, con el balón largo y el centro filtrados, incumple bandas que no se pueden
mover:
- fueras de juego 0,09 < 0,3;
- goles 2,90 > 2,8 (046 recalibrada);
- conversión 0,4286 > 0,42 (051);
- `exitoLargos` 0,967 > 0,7 (063), porque casi todo largo fallido era un fuera de juego.

Datos en `docs/evidencia/motor-068/diagnostico/`.

**Decisión del coordinador:** se toma el **alcance del prototipo**.
- **A filtra solo los pases rasos:**
  - el `pasar` explícito no largo (tratado como `pasarImposible`);
  - los candidatos de `evaluarPases` y `opcionPase`;
  - el receptor del saque de manos.
- **No se filtran** el balón largo (`opcionPaseLargo` y el `pasar` largo del LLM) ni los centros (`opcionCentro`,
  `centrarOrden`). Quedan como el riesgo real de timing: un balón a la espalda o un centro sí puede acabar en fuera de
  juego.
- **B, la frase del prompt**, debe decirlo con exactitud:
  - el poseedor no da un pase corto a un compañero adelantado;
  - un balón largo o un centro a un compañero adelantado **se sanciona**, así que el entrenador debe ordenar esos
    pases a quien esté en línea.
- **Banda de § 3** «receptor previsto = 0»: se redefine como **0 en pases rasos de campo** (sin `motivo` `largo`,
  `centro` ni `saque_manos`). Las demás bandas no cambian.
- Factor de faltas: 3, medido sin incumplimientos.

## 1. Diagnóstico del coordinador

**Torneo del 24 oct, 30 partidos con modelos** (`public/torneos/2026-10-24/e*.json.gz`, `reinicios-v5`, 60 s):
- 1,23 fueras de juego por partido para unos 12,4 pases: 1 de cada 10;
- **34 de 37** fueras de juego son un pase al **receptor previsto**, que ya estaba adelantado en el instante del
  pase.

**Programados, v9, 120 s, semillas 1–100:** 2,85 fueras de juego, 0,61 faltas, 60 % de partidos sin falta.

**Causas en el código:**
- **Nadie mira el fuera de juego al pasar.** En `MotorArena.accionBalon` (`src/arena/motor.ts`, en torno a
  l. 370–440), ni el `pasar` explícito del LLM, ni `evaluarPases`/`opcionPase`, ni el balón largo, ni el centro
  miran `adelantados(...)`. El árbitro sí sanciona en `recibir` (l. 727) con la lista fijada al golpear (l. 364).
- **El prompt no menciona el fuera de juego.** `SISTEMA_ARENA` (`src/arena/controladores.ts:179`) no lo nombra y la
  observación no trae la línea.
- **Las faltas solo nacen en duelos.** Salen de `resolverFalta` (l. 683), con
  `R.faltaBase 0.015 + faltaAgresividad·agr + faltaIndisciplina·(1−disc)` multiplicado por el criterio del árbitro
  (`limites.ts` ≈ l. 943). Con pocos duelos por partido, la mayoría de los partidos no tiene ninguna. El narrador
  sí las canta (`relato.ts:13`).

**Prototipo** (copia en el scratchpad, sin tocar el repo; v9, 120 s, semillas 1–100, programados):

| | Fueras de juego | Faltas | % sin falta | Amarillas | Rojas | Goles | Tiros |
|---|---|---|---|---|---|---|---|
| v9 | 2,85 | 0,61 | 60 | 0,27 | 0,01 | 2,16 | 4,83 |
| Con el filtro del pasador | 1,06 | 0,64 | 53 | 0,29 | 0,02 | 2,47 | 5,51 |
| Con el filtro y la probabilidad de falta ×3 | ≈1,1 | 2,05 | 15 | 0,75 | 0,09 | ≈2,4 | ≈5,5 |

En el prototipo, el filtro excluía al receptor si estaba en `adelantados(estado, lado)` en el tick de la decisión,
en el pase explícito, `evaluarPases` y `opcionPase`. La probabilidad de `resolverFalta` se multiplicó por 3.

## 2. Alcance (solo bajo `reglasDesde(config, "reinicios-v10")`; v1–v9 idénticas)

Las versiones publicadas quedan congeladas. Los dorados y fixtures de v1–v9 **no cambian ni un byte**.

### A. Pasador consciente del fuera de juego

En el tick de la decisión, `fuera = adelantados(this.estado, j.lado)`: la **misma** función y el mismo instante
que fija la lista del árbitro al golpear. Bajo v10:

- **Pase explícito del LLM** (`pasar` con `receptor` en `fuera`, corto o largo). Se trata como `pasarImposible`:
  - ese tick decide en local, con los candidatos ya filtrados;
  - si conduce, la orden sigue pendiente, como hoy con `pasarImposible`.
- **Pases locales.**
  - `evaluarPases(...)`, `opcionPase(...)` y `opcionPaseLargo(...)` no devuelven a nadie de `fuera`: se filtra el
    candidato y se toma el siguiente, sin elegir a nadie peor que el mejor válido.
  - Si no queda candidato, el comportamiento es el de hoy sin pase: conduce.
- **Centros.** Rige en `opcionCentro` o `receptorCentro` y en `centrarOrden`:
  - el receptor designado o elegido no puede estar en `fuera`;
  - con un designado en `fuera`, la orden se ejecuta con el receptor válido más cercano al destino (como con
    `null`);
  - si no hay ninguno, el centro espera.
- **Saque de manos del portero.** `soltarManos` aplica el mismo filtro al receptor explícito y al de
  `opcionPase`. Los saques forzados y despejes no cambian (no tienen receptor o es aéreo y largo).
- **El árbitro no cambia.** Un balón suelto, un rechace o un centro que acaba en un adelantado sigue siendo fuera
  de juego, como en el fútbol.
- **Sin error de percepción.** El filtro es determinista: el pasador ve la línea y no se añade azar.

### B. La regla en el prompt y la línea en la observación

- **Frase nueva en `controladores.ts`.** `frasesFueraDeJuego()` sigue el patrón de `frasesLargo`: se construye
  solo con constantes y la prueba la construye también con valores alterados. Contenido en ES (el prompt está en
  ES):
  - qué es fuera de juego en este motor: más adelantado que el penúltimo rival, el balón y la mitad de la cancha
    en el instante del pase, con `ARENA.toleranciaM`;
  - que se sanciona con reinicio para el rival;
  - que el poseedor **no pasa ni centra** a un compañero en esa posición: conduce o elige otro;
  - que un `profundidad`/`apoyar` debe atacar el espacio partiendo en línea con la línea del rival;
  - que `fueraDeJuego` en la observación da la x de la línea de cada lado y los IDs propios adelantados en ese
    instante.
- **La frase solo va en el prompt de partidos v10.**
  - Si `SISTEMA_ARENA` es una constante compartida por todas las versiones, se compone por reglas, como ya se hace
    con otras frases si existe el patrón.
  - Si no existe, se añade de forma incondicional y se declara: los partidos nuevos son todos v10 y las
    repeticiones no llaman al LLM.
  - Hay que comprobar qué hace el torneo.
- **Observación bajo v10:**
  ```
  fueraDeJuego: { propia: { linea: number, adelantados: string[] }, rival: { linea: number } }
  ```
  - `linea` es la x **absoluta** (no orientada) con un decimal, de `lineaFueraDeJuego`;
  - `adelantados` es de `adelantados(estado, lado)`.
  - El nombre exacto lo puede ajustar el implementador si choca con un tipo existente; queda documentado en el
    código.
- **Coste:**
  - si `factorObservacion063` o la estimación de tokens depende de las reglas, se recalcula para v10 como en
    v8/v9, con el número nuevo comentado;
  - liga ≤ 8 USD y grupos ≤ 7 USD siguen.
  - El esquema de respuesta del LLM no cambia.

### C. Más faltas

- Constante nueva en `src/sim/limites.ts`, comentada con el pedido y el prototipo:
  `FALTAS_ARENA_V10 = { desde: "reinicios-v10", factorProbabilidad: 3 }`, o el patrón `desde:` ya usado en
  `REMATE_ARENA_V9`.
- `resolverFalta` multiplica su probabilidad por el factor solo bajo v10, con un tope de `Math.min(1, …)`.
- Gravedad, tarjetas, expulsiones y reinicios: mismas reglas. Las tarjetas suben en proporción.
- **Ajuste permitido si una banda falla:** el factor baja a 2,5 y después a 2, como máximo dos iteraciones.
  **No se mueven bandas.** Si sigue fallando, se para y se informa.

### Versión de reglas

- `ARENA.reglas = "reinicios-v10"`, con su línea en el comentario de versiones.
- El literal se añade en `reglasArena` (`src/arena/tipos.ts`).
- Cualquier lista o validación de reglas admitidas (torneo, crónica, importador, dataset, `cronica-hechos`) acepta
  v10, como hizo el 065 con v9.
- Fixture nueva `src/arena/__fixtures__/arena-reinicios-v10.json`, siguiendo el patrón de la v9.

## 3. Bandas y mediciones

**Lote de medida:** programados, 120 s, semillas 1–100 y 101–200, v9 frente a v10. Se guarda en
`docs/evidencia/motor-068/` con el script usado, como hizo el 065.

**Bandas nuevas en `npm run test:stats`:** leen sus umbrales de `limites.ts`, en un bloque comentado
`BANDAS_068`; ninguna prueba repite cifras.

| Métrica (v10, 120 s, semillas 1–100) | Banda |
|---|---|
| Fueras de juego por partido | **≤ 1,4** y ≥ 0,3 (sigue existiendo) |
| Fueras de juego cuyo receptor era el receptor previsto de un pase de campo | **0** (A garantiza que no ocurre) |
| Faltas por partido | 1,5 – 2,8 |
| Partidos sin falta | ≤ 25 % |
| Rojas por partido | ≤ 0,15 |
| Goles por partido | ≥ el de v9 en el mismo lote × 0,95 |

**Bandas que ya existen:**
- todas las del 046, 051, 063 y 065 deben seguir cumpliéndose sobre v10 (incluidos `golesTrasSaque` y la
  conversión del mano a mano ≤ 0,42), con `npm run test:stats` completo;
- si una banda vieja falla por la pausa extra de las faltas, se aplica el ajuste de C; no se mueven bandas.

**Voz.** Más faltas y tarjetas son más cantos del narrador. Hay que medir con Speech simulado, como
`docs/evidencia/motor-065/voz/` (semillas 1–8, 120 s, ES y ES+EN con una variante), que **ni el narrador ni los
invitados** se quedan sin bolsa en v10. Si se agota, se informa con la cifra; no se suben bolsas sin Carlos.

## 4. Pruebas

**Unitarias:**
- A:
  - un `pasar` explícito a un adelantado no sale ese tick y la orden queda pendiente si conduce;
  - el local no elige a un adelantado y elige al siguiente;
  - el centro con un designado adelantado va al válido más cercano;
  - en el saque de manos se aplica el filtro;
  - un balón suelto que recoge un adelantado sigue siendo fuera de juego;
  - todo esto bajo v9 se comporta como antes.
- B:
  - la frase se construye con constantes alteradas;
  - la observación trae `fueraDeJuego` solo en v10 y su `linea` coincide con `lineaFueraDeJuego`.
- C:
  - la probabilidad aplica el factor leído de `limites.ts` solo en v10.

**Mutaciones vistas en rojo:**
- quitar el filtro del pase explícito;
- quitar el filtro local;
- poner el factor a 1.

**Verificación de entrega:**
- `tsc` limpio, `npm test`, `npm run test:stats` completo y la e2e completa (puerto 3417).
- Las capturas de `docs/evidencia` reescritas por la e2e se restauran con `git checkout`.
- **Fallo conocido en HEAD:** `navegacion-064:32`. Cualquier otro fallo se compara con HEAD y se declara.

## 5. Fuera de alcance

- Cambiar el árbitro, la lógica de duelos o la frecuencia de duelos.
- Bandas de juego aéreo.
- La UI: si algún texto de la UI o de la documentación enumera versiones de reglas, solo se añade v10. Por ejemplo,
  `docs/arena.md`.
- Desplegar a Azure: lo hace el coordinador.
- El bloque B4 del 064 sin commit en el árbol (`BotonCronica.tsx`, `CronicaArena.tsx`, `textos-cronica-arena.ts`,
  `src/app/arena/cronica/`, cambios en `CajaDeCristal.tsx`, `textos.ts`, su bloque de `globals.css` y sus líneas de
  `Arena.tsx`), `CLAUDE.md` y `BITACORA.md` **no se tocan ni se commitean**.

## 6. Entrega

- Commits con **rutas explícitas**, nunca `git add -A`, y gitleaks antes de cada commit. Push a main al terminar
  con todo en verde.
- **HANDOFF.md:** el implementador mantiene su sección en cada hito.
- **Informe final** para el coordinador:
  - tabla v9/v10 (fueras de juego, faltas, % sin falta, tarjetas, goles, tiros);
  - el factor final;
  - pruebas vistas y mutaciones;
  - medición de voz;
  - desviaciones;
  - propuesta de fila para BITACORA.
