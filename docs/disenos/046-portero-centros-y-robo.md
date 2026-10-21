# 046 — Portero que sale y no pierde el balón en las manos, y centros desde la banda (reglas `reinicios-v4`)

## Estado

Brief **cerrado** el 21 de octubre de 2026. Lo escribe Opus porque Fable no tiene cupo; lo revisará
Codex antes de implementar. Parte del reporte de Carlos sobre la arena publicada
(`cronista-arena--0000011`) y de la investigación de
[docs/evidencia/motor-046/README.md](../evidencia/motor-046/README.md). Todas las decisiones están
tomadas. Las cifras de este brief se midieron hoy con controladores programados, partidos de
120 s y los scripts de [prototipo/](../evidencia/motor-046/prototipo/). La sección «Prototipo»
explica cómo reproducirlas.

Precedentes: [033](033-tactica-y-movimiento.md) (portero: «subir o retroceder según presión,
distancia al arco y cobertura»; M08: «llegada para centro: zona cercana, alejada y apoyo
retrasado; no todos deben entrar al área») y [044](044-correcciones-motor-arena.md) (cambio de
reglas con versión nueva y fixtures de reproducción exacta).

## Problemas y causas (resumen; detalle en la investigación)

1. **El portero no sale a achicar.** Su destino es el ancla fija `POR` (6, 34)
   (`catalogo.ts:80`). Está excluido de la presión y de los perseguidores, y `motor.ts:329-334`
   solo limita ese destino al área. En el mano a mano la mediana de su desplazamiento hacia el
   balón es 0,00 m.
2. **No hay centros.** El poseedor conduce en línea recta hacia x + 15 (`motor.ts:324-327`), así
   que el extremo cruza la línea de fondo y da saque de meta. `prefiereConducir`
   (`personalidades.ts:52`, aplicado en `motor.ts:296`) cancela el pase. `opcionPase`
   (`controladores.ts:58-77`) solo pasa a los pies, premia el avance en x y descarta los pases de
   más de 32 m o hacia atrás de más de 8 m. La línea de ataque más alta (87,2 m) queda antes del
   área. *Corrección a la investigación: cita `personalidades.ts:140`, pero la línea correcta es
   la 52.*
3. **«El portero tiene el balón y entra gol» (BLOQUEANTE).** El duelo de `moverBalon`
   (`motor.ts:482-496`) se aplica también al portero con el balón en las manos. Tras la atajada no
   hay protección. El portero no puede soltar antes de `accionCadaS` (2 s, `limites.ts:471`), pero
   se le puede disputar desde `recuperacionCadaS` (0,8 s, `limites.ts:472`). Mientras tanto avanza
   con el balón hacia el rematador por la conducción por defecto. Con el balón en las manos nada
   lo limita al área.
4. **Lateral A.** Una orden `pasar` hacia un receptor a más de `paseMaxM` deja al poseedor sin
   acción toda la ronda (`motor.ts:290-301`).
5. **Lateral B.** Un poseedor con `conducir` frena al acercarse a su destino y no lo renueva hasta
   quedar a 0,2 m, así que se queda casi parado (`motor.ts:327` frente a `motor.ts:346`).

**Los dos laterales entran en este brief.** Son baratos (una condición cada uno), afectan a la
misma función `accionBalon`/conducción que se toca aquí y el lateral B agrava el error 2.

## Línea base medida hoy (`reinicios-v3`, programados, 120 s)

| Métrica (definiciones en «Métricas de lote») | 30 semillas (1–30) | 100 semillas (1–100) | 100 semillas (101–200) |
| --- | --- | --- | --- |
| Goles por partido (desviación típica) | 2,23 (1,43) | 2,23 (1,54) | 2,35 (1,39) |
| Remates por partido | 3,87 | 3,81 | 4,23 |
| Episodios de mano a mano | 92 | 293 | 321 |
| Conversión del mano a mano (episodios que acaban en gol) | 0,435 | 0,464 | 0,474 |
| Parte de los goles que llegan en un mano a mano | 0,60 | 0,61 | 0,65 |
| Desplazamiento del portero hacia el balón: mediana / p75 | 0,00 / 0,00 m | 0,00 / 0,00 m | 0,00 / 0,00 m |
| Episodios con el portero desplazado más de 1 m | 0,033 | 0,051 | 0,044 |
| Pases desde la banda del último tercio que van al área | 6/35 = 0,171 | 16/127 = 0,126 | 9/122 = 0,074 |
| Saques de meta por partido / de ellos, por conducción | 0,57 / 0,57 | 0,87 / 0,85 | 0,99 / 0,88 |
| Atajadas con posesión / robos al portero tras la atajada | 28 / 5 | 90 / 18 | 88 / 16 |
| Pérdidas del portero con el balón dentro de su área (todas) | 5 | 21 | 19 |
| Goles tras una de esas pérdidas | 4 | 19 | 15 |
| 044: `tiro_fuera` tras un desvío / recepción con el portero como pasador | 0 / 0 | 0 / 0 | 0 / 0 |
| Lateral A: rondas con el poseedor bloqueado por `pasar` imposible | 5 | 6 | 3 |
| Lateral B: ticks de `conducir` con el poseedor a menos de 1 m/s | 0,358 | 0,391 | 0,367 |
| Fueras de juego (no se tocan; referencia) | 87 | 260 | 244 |

Las salidas JSON están en `docs/evidencia/motor-046/prototipo/r-base-*.json`.

## Decisión de versión

- Nueva constante de reglas **`"reinicios-v4"`**, que pasa a ser `ARENA.reglas` (predeterminada
  en `crearConfigArena`). `ARENA.version` sigue en `arena-v3`: el formato del registro no cambia,
  como en el 044.
- `reglasArena` (en `tipos.ts`) pasa a `["reinicios-v1", "reinicios-v2", "reinicios-v3", ARENA.reglas]`
  con `"reinicios-v3"` **literal**. `validarConfigArena` acepta las cuatro y rechaza cualquier
  otra.
- Helper `reglasDesde(config, "reinicios-vN")` en `motor.ts`, que compara por orden en
  `reglasArena`. **`motor.ts:525` (`this.config.reglas === ARENA.reglas`) pasa a
  `reglasDesde(config, "reinicios-v3")`.** Con la igualdad actual, al subir `ARENA.reglas` a v4
  los registros v3 perderían el rechace y los v4 también. La prueba de reproducción del fixture
  v3 es la que lo vigila.
- Todo lo de este brief se activa solo con `reglasDesde(config, "reinicios-v4")`. Los registros
  v1–v3 (fixtures `src/arena/__fixtures__/arena-reinicios-v{1,2,3}.json`) y los archivos sin
  `reglas` (`public/experimentos/arena-*.json`, `docs/evidencia/azure-publica/partido.json`)
  se reproducen idénticos, byte a byte.
- `crearConfigArena` admite una opción `reglas?: ReglasArena`, solo con `ARENA.version`. Sirve a
  generadores de fixtures y pruebas que necesiten fijar v3. `generar-reinicios-v3.ts` pasa a
  pedir `reglas: "reinicios-v3"` de forma explícita. Las pruebas del 044 que usan `ARENA.reglas`
  con el sentido de «v3» (p. ej. `correcciones044.test.ts:50`) pasan al literal
  `"reinicios-v3"`.
- **Nada de esto se implementa en `planProgramado`, `opcionPase` ni `validarOrdenes`**, salvo
  aceptar la acción `centrar`. La observación no lleva `reglas`, y `reproducirArena` compara los
  respaldos archivados con `planProgramado(obs)`: si estas funciones cambiaran, los registros
  v1–v3 con respaldo dejarían de reproducirse. Todo comportamiento nuevo vive en el motor
  (`accionBalon`, `moverJugadores`, `moverBalon`, `recibir`, `reiniciar`) y en dos módulos
  puros nuevos, `src/arena/portero.ts` y `src/arena/ataque.ts`, que el motor llama bajo v4.

## Constantes nuevas en `src/sim/limites.ts`

Son dos objetos nuevos y comentados más las bandas de lote. Ninguna prueba repite estas cifras;
las pruebas importan los objetos.

```ts
/** Brief 046 · Portero (reinicios-v4). Cifras sintéticas por calibrar. */
export const PORTERO_ARENA = {
  /** Radio (m) desde el centro del arco propio en el que un poseedor rival sin defensores de
   * campo por delante activa la salida. Mayor que ARENA.radioTiroM para salir antes del remate. */
  manoAManoRadioM: 28,
  /** Salida: distancia al balón que conserva = max(holguraM, fraccion × distancia arco–balón). */
  salidaFraccion: 0.3, salidaHolguraM: 1,
  /** Distancia máxima (m) de la salida desde el centro del arco (dentro del área de 16,5 m). */
  salidaMaxM: 14,
  /** Radio de atajada ante un remate: controlPorteroM × min(1, d/reaccionM), nunca menor que
   * cuerpoM; d = distancia del origen del remate al portero. Un remate a bocajarro reduce el
   * tiempo de reacción. */
  reaccionM: 8, cuerpoM: 0.5,
  /** Balón en las manos: plazo (s) para ponerlo en juego. Siempre mayor que
   * ARENA.accionCadaS / min(TECNICA_ARENA.ritmo), así que existe una ventana para soltar. */
  manosMaxS: 4,
  /** Distancia (m) que los rivales respetan con el portero que tiene el balón en las manos;
   * hasta vencer el plazo, el portero no suelta mientras un rival esté más cerca. */
  distanciaManosM: 4,
  /** Alcance máximo (m) del saque del portero desde las manos (el pase normal es paseMaxM). */
  saqueManosMaxM: 40,
} as const;

/** Brief 046 · Conducción y centros (reinicios-v4). Coordenadas orientadas: el atacante va hacia x = largoM. */
export const ATAQUE_ARENA = {
  /** x orientada desde la que la banda (|y − ancho/2| ≥ areaAnchoM/2) es zona de centro. */
  zonaCentroXM: 75,
  /** La conducción nunca apunta a menos de estos metros de la línea de fondo ni de banda. */
  margenFondoM: 2, margenBandaM: 2,
  /** Un `conducir` a menos de esta distancia (m) de su destino se renueva (antes, 0,2 m). */
  renovarConduccionM: 2,
  /** Punto de giro en la zona de centro: (largoM − giroFondoM, borde del área − giroInteriorM). */
  giroFondoM: 6, giroInteriorM: 2,
  /** Objetivos del centro: palo cercano y lejano a paloXM de la línea y ±paloYM del centro del
   * arco; punto penal a penalXM. */
  paloXM: 5.5, paloYM: 3, penalXM: 11,
  /** Un compañero de campo a ≤ llegadaM del objetivo puede ser el receptor del centro. */
  llegadaM: 14,
  /** Distancia máxima (m) de un centro. */
  centroMaxM: 40,
  /** Fase aérea: el centro solo se puede tocar a ≤ caidaM de su destino. */
  caidaM: 5,
  /** Un jugador que prefiere conducir solo centra desde esta x o en el punto de giro. */
  conductorCentroXM: 95,
  /** Jugadores que atacan el área: palo cercano, palo lejano, punto penal (M08 del brief 033). */
  rematadores: 3,
  /** La llegada no rebasa la línea de fuera de juego vigente menos este margen (m). */
  margenFueraJuegoM: 0.5,
} as const;
```

Las bandas de lote viven en `LOTE_ARENA_046` (sección «Métricas de lote»), también en
`limites.ts`.

## Error 3 (bloqueante): el portero con el balón en las manos

**Estado.** `EstadoArena.balon` gana `manos?: { portero: string; desdeTick: number; hastaTick: number }`,
que solo existe bajo v4.

- Se crea en `recibir(j)` cuando `j.puesto === "POR"` y `j` está dentro de su propia área, sea
  cual sea el tipo (`atajada`, `recuperacion`, `intercepcion`, `recepcion`). También se crea en
  `reiniciar(lado)` (reanudación desde el portero tras un fuera de juego) si el portero está en
  su área. `hastaTick = tick + round(manosMaxS / pasoS)`.
- Desaparece sola en cuanto el motor reasigna `estado.balon` (pase, saque, falta, gol…). No
  existe si el portero recibe fuera del área: con el balón en los pies se le puede disputar como
  hoy.
- La observación del LLM la recibe dentro de `estado`, así que sabe que no puede disputar ese
  balón.

**Inmunidad.** Mientras existe `balon.manos`, `moverBalon` no evalúa duelo ni falta sobre el
portero: hace `return` tras copiar la posición del balón, antes de comprobar
`recuperacionCadaS`. Esa es la garantía del bloqueante.

**Protección (sin pausa global).** El juego no se detiene: sus compañeros se despliegan, como
hoy. La ventana de protección dura todo el tiempo que el balón está en las manos:

- En `moverJugadores`, a todo rival cuyo destino final quede a menos de `distanciaManosM` del
  portero (perseguidor, `presionar`, orden del LLM o ancla) se le proyecta ese destino a esa
  distancia, en la dirección destino − portero, o jugador − portero si coinciden.
- **Conciliación de `limites.ts:471-472`.** `recuperacionCadaS` (0,8 s) deja de aplicarse al
  portero con el balón en las manos. `accionCadaS / ritmo` (1,8–2,35 s) sigue siendo el mínimo
  para soltar, y `manosMaxS` (4 s) es el máximo. La constante se documenta con esa relación, y
  una prueba comprueba `manosMaxS > accionCadaS / min(ritmo)` con las constantes.

**Qué hace después.** En `accionBalon`, con `balon.manos` presente, se aplican estas reglas en
este orden:

1. Antes de `accionCadaS / ritmo` desde la posesión, no hace nada.
2. Antes de `hastaTick`, solo suelta si **ningún rival está a menos de `distanciaManosM`**. Usa
   la orden `pasar` del LLM si el receptor es propio, está activo y a ≤ `saqueManosMaxM`; si no,
   usa `opcionPase(j, obs)`, sin cambios.
3. Al llegar a `hastaTick`, sale el saque forzado hacia el compañero a ≤ `saqueManosMaxM` con
   mayor margen (distancia mínima de los rivales a la línea de pase), con desempate por `id`.
4. El pase sale con `sacarBalon(…, "pase", …)` y el evento lleva `motivo: "saque_manos"`.
   `tirar`, `conducir` y `centrar` se ignoran mientras está en las manos.

**Sin avanzar ni salir del área.** Bajo v4, el portero poseedor **nunca conduce por defecto**:
su destino es su propia posición. Si está en su área, ese destino y además la **posición**
resultante de cada paso se limitan a la caja del área, con `x` propia ∈ [`controlM`, `areaLargoM`]
e `y` ∈ banda del área. El límite se aplica a `bruto` antes de comprobar `cruceDeBanda`, de
modo que la separación de un rival no puede empujarlo más allá. **Garantía:** con el balón en
las manos no puede cruzar su línea ni salir del área; por tanto no hay autogol por conducción ni
`salidaConduccion` del portero.

**Prototipo.** Se midió sin y con el paso 2: sin esperar a que el rival se aleje quedaban 2
saques interceptados al instante en 100 partidos, ambos con gol. Con la espera hubo 0 en 200
partidos.

## Error 1: la salida a achicar

**Condición objetiva, sin depender de órdenes.** Se usa la función pura
`manoAMano(estado, ladoPortero, radioM)` de `portero.ts`. Devuelve el poseedor rival si:

- no hay `saque` ni `pausa` vigentes;
- el poseedor es un jugador de campo rival;
- está a ≤ `radioM` del centro del arco del portero;
- **todos** los jugadores de campo del portero tienen la x orientada (en el sentido del atacante)
  menor o igual que la del poseedor, es decir, ninguno está más cerca de la línea.

Es el criterio A de la investigación. El motor la llama con `PORTERO_ARENA.manoAManoRadioM`, y
la métrica con `ARENA.radioTiroM` para comparar con la línea base. Se evalúa una vez por tick,
antes de mover, sobre el estado anterior al paso.

**Movimiento.** En `moverJugadores`, si `manoAMano` devuelve poseedor y el portero no tiene el
balón, su destino pasa a `C + u·s`, donde:

- `C` es el centro de su arco;
- `u` es la dirección de `C` al balón;
- `s = min(salidaMaxM, max(controlM, d − max(salidaHolguraM, salidaFraccion·d)))`, con `d` la
  distancia de `C` al balón.

El destino sigue pasando por el límite de área existente (`motor.ts:329-334`). La velocidad y la
aceleración son las del motor; no hay atajos. **Vuelta:** cuando deja de cumplirse la condición
(pase, remate, pérdida o un defensor que lo alcanza), su destino vuelve a ser el normal (orden y
límite al área) y regresa con la misma física. Sin histéresis. Vale igual con controladores LLM:
ninguna orden la activa ni la impide; la orden del portero solo fija su destino fuera del mano a
mano.

**Efecto en duelo y remate.**

- **Duelo:** si el portero llega a `controlM` del poseedor, se aplica el duelo y la falta
  existentes, con el portero como defensor. Si gana, `recibir` lo deja con el balón en las manos
  (error 3).
- **Remate:** bajo v4, el radio de contacto del portero en su área ante un `tiro` es
  `max(cuerpoM, controlPorteroM × min(1, distancia(vuelo.origen, portero) / reaccionM))`. Pases y
  centros conservan `controlPorteroM`. Así una salida pegada al rematador no lo convierte en
  invencible: en el prototipo, sin esta regla la conversión baja a 0,32, y con ella queda en
  0,38.

## Error 2: centros

Todo es reacción local del motor bajo v4. No cambia `opcionPase`, `planProgramado` ni
`prefiereConducir`.

**Conducción (todo poseedor de campo, por defecto o con `conducir` o `centrar` aún no
ejecutable).** El destino por defecto lo calcula `conduccionPorDefecto(j)` en `ataque.ts`, en
coordenadas orientadas:

- **x < `zonaCentroXM`:** como hoy, recto hacia x + `avanceConduccionM`.
- **Zona de centro** (x ≥ `zonaCentroXM` y |y − 34| ≥ `areaAnchoM/2`): hacia el **punto de giro**
  `(largoM − giroFondoM, 34 ± (areaAnchoM/2 − giroInteriorM))` del lado del balón. El extremo
  encara el área en diagonal en vez de seguir por la línea.
- **Último tercio central:** `avanceConduccionM` en dirección al centro del arco rival.
- **Siempre:** x ≤ `largoM − margenFondoM` e y ∈ [`margenBandaM`, `anchoM − margenBandaM`].
- **Orden `conducir`:** el destino del LLM se limita igual. Si queda a menos de
  `renovarConduccionM`, se renueva con el destino por defecto (cierra el lateral B).

**Opción de centro (`opcionCentro(j, estado)` en `ataque.ts`).**

- **Objetivos (orientados):** palo cercano `(largoM − paloXM, 34 + s·paloYM)`, punto penal
  `(largoM − penalXM, 34)` y palo lejano `(largoM − paloXM, 34 − s·paloYM)`, con
  `s = signo(y − 34)` (1 si es 0).
- **Por objetivo T** a ≤ `centroMaxM` del poseedor: el receptor es el compañero de campo más
  cercano a T dentro de `llegadaM`. Su ventaja es (distancia mínima de un **rival de campo** a T)
  − (distancia del receptor a T). El portero no cuenta: disputa el centro al caer, por contacto.
- **Elección:** el objetivo con mayor ventaja, si es mayor que 0; empate por el orden de la
  lista.
- **Ejecución:** `sacarBalon(j, "pase", T, receptor)`, con el error lateral habitual y el cálculo
  de fuera de juego habitual; el evento lleva `motivo: "centro"`. El vuelo gana `centro: true`.
  El receptor ya corre al destino del vuelo (`motor.ts:321`): es un pase a un punto, no a los
  pies.

**Fase aérea.** En `moverBalon`, un vuelo con `centro: true` no admite contactos mientras el
extremo del segmento del paso esté a más de `caidaM` de su destino. Cerca de la caída se
disputa con los radios habituales, incluido `controlPorteroM` del portero en su área. Si nadie
lo toca, el balón queda en el destino, como cualquier pase que se detiene.

**Prioridad en `accionBalon` (decisión local; orden explícita aparte).** El remate
(`prefiereTirar`) va primero. Después, el **centro**, si el poseedor de campo está en la zona de
centro y `opcionCentro` encuentra opción. Luego el pase local y por último la conducción.

**Personalidad.** Si `prefiereConducir(j)`, solo centra con x ≥ `conductorCentroXM` o a menos de
`renovarConduccionM` de su punto de giro. Antes de eso conduce, pero hacia el área y no hacia la
línea, así que el «conductor» deja de regalar saques de meta y llega a centrar o a rematar.

**Llegada al área (M08).** En `moverJugadores` se aplica cuando el lado A tiene el balón en la
zona de centro: un poseedor de campo de A o un vuelo `centro` de A. Hasta `rematadores` jugadores
de campo de A, sin contar al poseedor ni al receptor del vuelo, reciben como destino palo
cercano, palo lejano y punto penal, en ese orden, asignados por la x orientada más alta
(desempate por `id`). Pueden ser jugadores con orden `apoyar` o `profundidad`, o jugadores cuyo
destino el motor ya sustituyó por las anclas tras un cambio de posesión (`motor.ts:314`). La
x del destino se limita a la línea de fuera de juego vigente (la misma referencia que
`adelantados`) menos `margenFueraJuegoM`. El destino del receptor de un vuelo sigue teniendo
prioridad. Con `cubrir`, `mover` o `presionar` el jugador no entra: así el LLM puede reservar
resguardo.

**Filtros de `opcionPase`.** No cambian. El centro es una opción aparte, con sus propios límites
(`centroMaxM`, `llegadaM`), y no hereda `paseMaxM`, `avanceMinPaseM` ni el margen de línea,
porque va por arriba.

## Laterales

- **A (`pasar` imposible).** Bajo v4, una orden `pasar` cuyo receptor no existe o está a más de
  `paseMaxM` se trata como no explícita en ese tick: el poseedor decide en local y la orden
  sigue pendiente por si el receptor entra en alcance más tarde en la ronda.
- **B (`conducir` frenado).** Lo cierra `renovarConduccionM` (ver «Conducción»).

## Controladores LLM

- **Acción nueva `centrar`**, en `esquemaOrdenes` (`tipos.ts`):
  `{ "jugador", "accion": "centrar", "destino": {x,y}, "receptor": "ID propio" | null }`.
  - **`validarOrdenes`:** `destino` debe estar dentro del área rival, con las coordenadas de
    `obs.lado`, `areaLargoM` y `areaAnchoM`; si no, error «Centro fuera del área rival».
    `receptor` es `null` o un ID propio distinto del jugador. `pasar` sigue exigiendo receptor;
    el resto de acciones, `null`.
  - **`esquemaRespuestaArena`:** recoge el enum ampliado sin más cambios.
  - **Motor (v4).** Si el jugador es el poseedor, está a x ≥ `zonaCentroXM` (banda o centro) y a
    ≤ `centroMaxM` del destino, ejecuta el centro a `destino`. El receptor es el de la orden o,
    si es `null`, el compañero de campo más cercano al destino. Si todavía no puede, conduce con
    `conduccionPorDefecto` y la orden queda pendiente. Si el jugador no es el poseedor, su
    destino es el de la orden, como en cualquier otra acción.
  - **Reglas v1–v3:** el esquema y el validador aceptan `centrar`, pero el motor lo trata como
    acción no explícita: decide en local. Los registros archivados no contienen esa acción. Es
    un límite declarado, igual que el arreglo de sustituciones del 044.
- **`SISTEMA_ARENA`** añade dos frases construidas con constantes (`zonaCentroXM` en
  coordenadas de cada lado, `centroMaxM`, `accionCadaS`, `manosMaxS`, `distanciaManosM`):
  - qué hace `centrar` y su destino en el área rival;
  - que el portero sale solo ante un mano a mano y que el balón en sus manos no se disputa: lo
    pone en juego entre `accionCadaS` y `manosMaxS` s, y no hace falta ordenarlo.
- **Salida, protección y llegada** son del motor y valen igual para el LLM. El portero sigue sin
  admitir `presionar`, como hoy.

## Relato, narración y estadista

- **`vista.narrarEventoArena`**, para `pase` con `motivo`:
  - `"centro"`: «{nombre} centra al área hacia {receptor} ({m} m).» / «{nombre} crosses into the
    box towards {receptor} ({m} m).»;
  - `"saque_manos"`: «{nombre} pone el balón en juego desde sus manos hacia {receptor} ({m} m).» /
    «{nombre} puts the ball back in play from the hands towards {receptor} ({m} m).».

  Estos textos alimentan `hechosArena`, el narrador, el comentarista y la descripción.
- **`relato.ts`, modo breve:** «¡Centro de {j}!» / «{j} sends in a cross!». `saque_manos` usa el
  texto de `vista`.
- **Sin eventos nuevos**, solo `motivo` en `pase`. `PRIORIDAD_EVENTO_ARENA`, `importantes`, la
  mesa y los turnos no cambian: la voz en vivo no anuncia el centro como noticia propia
  (límite), y sí el remate o gol que siga.
- **Estadista (045): no cuenta centros.** Su tabla normativa (v3.1) queda igual. Los centros
  entran en `pases`, y con menos de un centro cada 30 s un tema propio no alcanzaría
  `minAcciones`. Queda para un brief posterior si Carlos lo pide.
- **`Arena.tsx`, texto de límites (ES/EN).** Sustituir «sin… juego aéreo» por: «los centros
  tienen una fase aérea simplificada, sin alturas ni cabezazos, que solo se disputa cerca del
  punto de caída; el portero no puede ser disputado con el balón en las manos». Es el único
  cambio de UI; ver el riesgo con el 047.

## Métricas de lote

Las calcula un helper de prueba, `src/arena/__tests__/metricas-lote.ts`, que envuelve
`MotorArena.prototype.moverBalon` y `accionBalon` con llamada al original, como los scripts.
Importa `manoAMano` y los predicados de zona del código de producción y las cifras de
`limites.ts`. Siempre son controladores programados, partidos de 120 s y `crearConfigArena({ seed, duracionS })`.

**Definiciones**

- **Mano a mano:** al menos 3 ticks consecutivos con
  `manoAMano(estado, rival, ARENA.radioTiroM)` y el mismo poseedor.
  - El **desplazamiento** es la proyección del movimiento del portero, entre el primer y el último
    tick, sobre la dirección inicial portero → balón.
  - La **conversión** es la fracción de episodios cuyo desenlace es gol: el primer evento
    `tiro/pase/recuperacion/intercepcion/falta/fuera_juego/reinicio/gol` en ≤ 3 s tras el último
    tick y, si es `tiro`, su resultado.
- **Proporción de centros:** pases de juego abierto (sin `reinicio`) desde la banda del último
  tercio (x orientada ≥ `LOTE_ARENA_046.bandaMetricaXM` = 70 e |y − 34| > `areaAnchoM/2`) cuyo
  destino cae en el área rival, divididos por todos los pases desde esa banda. Los **centros por
  partido** son los pases con `motivo: "centro"`.
- **Saque de meta por conducción:** `reinicio` de tipo `meta` cuyo tick anterior tenía como
  poseedor a un jugador de campo del equipo que atacaba.
- **Robo al portero en manos (duro):** un evento `recuperacion` o `falta` de un rival mientras
  existe `balon.manos`.
- **Pérdida del portero en su área (amplio):** el poseedor pasa de un portero dentro de su área a
  un rival entre dos ticks. Incluye un saque interceptado al instante.
- **044:** `tiro_fuera` inmediatamente después de una `atajada` con `motivo: "desvio"`, y
  `recepcion` cuyo pasador es un portero tras un rechace.
- **Lateral B:** ticks con poseedor de campo, sin pausa, con orden `conducir` y velocidad menor
  de 1 m/s, divididos por los ticks con poseedor con `conducir`.

**Bandas (`LOTE_ARENA_046` en `limites.ts`).** La columna del prototipo es la mejor estimación de
lo que dará la implementación.

| Métrica | Base 1–100 | Prototipo 1–30 / 1–100 / 101–200 | 30 semillas, vitest (`npm test`) | 100 semillas, `npm run test:stats` |
| --- | --- | --- | --- | --- |
| Robos al portero en manos | 18 (como pérdidas) | 0 / 0 / 0 | = 0 | = 0 |
| Pérdidas del portero en su área | 21 | 0 / 0 / 0 | ≤ 1 en total | ≤ 0,03 por partido |
| Desplazamiento del portero en mano a mano, mediana | 0,00 m | 1,95 / 1,35 / 1,35 m | ≥ 1,0 m | ≥ 1,0 m |
| Episodios con desplazamiento > 1 m | 0,051 | 0,66 / 0,59 / 0,60 | ≥ 0,45 | ≥ 0,45 |
| Conversión del mano a mano | 0,464 | 0,355 / 0,376 / 0,383 | — (muestra corta) | ∈ [0,25; 0,42] |
| Proporción de centros desde la banda | 0,126 | 0,37 / 0,42 / 0,38 | ≥ 0,25 | ≥ 0,30 |
| Centros (`motivo`) por partido | 0 | 0,43 / 0,61 / 0,63 | ≥ 0,3 | ≥ 0,4 |
| Saques de meta por conducción por partido | 0,85 | 0 / 0 / 0 | ≤ 0,05 | ≤ 0,05 |
| Goles por partido | 2,23 | 2,07 / 2,54 / 2,40 | ∈ [1,5; 3,0] | ∈ [1,8; 2,8] |
| 044: `tiro_fuera` tras desvío / recepción del portero tras rechace | 0 / 0 | 0 / 0 | = 0 / = 0 | = 0 / = 0 |
| Lateral B: fracción de `conducir` frenado | 0,391 | 0,205 / 0,160 / 0,145 | ≤ 0,25 | ≤ 0,25 |

Además, `test:stats` corre **el mismo lote bajo `reinicios-v3`** y exige que **incumpla** el
robo = 0, la mediana de desplazamiento y la proporción de centros. Así se demuestra que las
bandas distinguen el cambio sin escribir las cifras de la línea base en las pruebas.

Si la implementación queda fuera de una banda, se ajustan **las constantes** de
`PORTERO_ARENA`/`ATAQUE_ARENA`, no las bandas. Tras 3 iteraciones se escala a Carlos.

## Pruebas exigidas

Las unitarias van en `src/arena/__tests__/motor046.test.ts` y usan escenarios construidos sobre
`crearEstadoArena` + `MotorArena`, como en `correcciones044.test.ts`. Cada una nombra la mutación
que debe ponerla en rojo; la auditoría las aplica todas.

| # | Prueba | Mutación que la pone en rojo |
| --- | --- | --- |
| 1 | Portero con balón en manos tras una atajada, rival pegado con nivel 100 frente a 1: ni `recuperacion` ni `falta` rival hasta que suelta; sigue siendo poseedor | Quitar el `return` por `balon.manos` en `moverBalon` |
| 2 | `balon.manos` se crea al recibir dentro del área (también con `reiniciar`), con `hastaTick` derivado de `manosMaxS`, y no existe si recibe fuera del área | Crear `manos` sin comprobar el área |
| 3 | No suelta antes de `accionCadaS / ritmo`; con un rival a menos de `distanciaManosM` espera; al vencer `hastaTick` suelta con `motivo: "saque_manos"` hacia el compañero de mayor margen | Quitar el saque forzado; quitar la espera; permitir soltar en el tick de la atajada |
| 4 | Con el balón en las manos a x = `controlM` + 0,1, una orden LLM `conducir`/`tirar` hacia detrás del arco y un rival empujando por separación, durante 3 s: sigue dentro del área con x ≥ `controlM`, sin `gol` ni `reinicio` | Quitar el límite de **posición**, dejando solo el de destino |
| 5 | La proyección de destinos rivales respeta `distanciaManosM` (función pura) | Quitar la proyección |
| 6 | Relación de constantes: `manosMaxS > accionCadaS / min(ritmo)` | Bajar `manosMaxS` por debajo |
| 7 | Mano a mano a 20 m con un controlador «LLM» fijo (portero con `cubrir` en el ancla, sin `presionar`): en 1 s el portero avanza sobre la línea arco–balón y queda en el área; con un defensor por delante no se mueve del ancla | Condicionar la salida a la orden; usar `<` en vez de `≤` en el criterio de defensores; quitar la salida |
| 8 | Radio de reacción: igual a `controlPorteroM` desde `reaccionM`, `cuerpoM` a bocajarro, monótono. Integración: un remate a 2 m con desvío lateral entre ambos radios es atajada en v3 y no en v4 | Devolver siempre `controlPorteroM` |
| 9 | Un extremo en (95, 5) con `conducir` hacia (105, 5) durante 4 s no provoca `reinicio` de meta ni de banda; x ≤ `largoM − margenFondoM` + tolerancia | Quitar el límite de destino |
| 10 | Sin opción de centro, el poseedor en la zona de centro va hacia el punto de giro (la y se acerca a 34) | Mantener la conducción recta en la zona |
| 11 | Centro: con un compañero a 8 m del palo lejano y ningún rival de campo más cerca, sale `pase` con `motivo: "centro"`, `vuelo.centro`, ese receptor y destino = objetivo ± error lateral; un «conductor» en x < `conductorCentroXM` no centra y en x ≥ sí | Destino a los pies del receptor; quitar la condición de personalidad |
| 12 | Fase aérea: un defensor en la trayectoria lejos de la caída no intercepta; uno a menos de `caidaM` del destino sí puede | Quitar la regla aérea |
| 13 | Llegada: con el balón en la zona de centro, hasta `rematadores` compañeros con `apoyar`/`profundidad` reciben palo cercano, lejano y penal; uno con `cubrir` no; con la línea defensiva en x = 92, ningún destino supera la línea menos `margenFueraJuegoM` | Ignorar la línea de fuera de juego; incluir `cubrir` |
| 14 | Lateral A: `pasar` a un receptor a más de `paseMaxM` → el poseedor actúa en local dentro de `accionCadaS`; en v3 no actúa en toda la ronda (misma semilla) | Quitar la caída a decisión local |
| 15 | Lateral B: `conducir` con destino a 1,5 m mantiene velocidad ≥ 2 m/s tras 1 s | Volver a la tolerancia de 0,2 m |
| 16 | `validarOrdenes`: acepta `centrar` con destino en el área rival y receptor `null` o propio; rechaza destino fuera del área, receptor igual al jugador o rival. `esquemaRespuestaArena` incluye `centrar`. El motor ejecuta `centrar` desde la zona y conduce si aún no está en ella. El prompt contiene las cifras leídas de las constantes | No comprobar el área en el validador; cifras escritas a mano en el prompt |
| 17 | Versiones: v1/v2/v3 se reproducen exactos (pruebas existentes); fixture nuevo `arena-reinicios-v4.json` con generador `generar-reinicios-v4.ts` en el repo y prueba `reproducirArena(r)` `toEqual(r)`; `validarConfigArena` acepta v1–v4 y rechaza `reinicios-v5`; el valor por defecto es v4 | Activar cualquier regla nueva con `conReinicios` en vez de `reglasDesde(v4)` (rompe v3); volver a `=== ARENA.reglas` en el desvío (rompe v3) |
| 18 | Textos ES/EN de `centro` y `saque_manos` en `narrarEventoArena` y en el modo breve de `relato.ts`; el narrador de plantilla sobre el fixture v4, con el centro como hecho principal, pasa V1–V8 (no lanza «La plantilla de arena no pasa el verificador») | Quitar la rama de `motivo` (texto genérico de pase) |

**Condiciones del fixture v4** (las comprueba la prueba): una atajada seguida de un pase
`saque_manos`; un centro; un mano a mano en el que el portero se desplaza más de 1 m; un desvío
con rechace, para que el 044 quede cubierto en v4. Duración corta, `tiempoMs` a 0 y semilla
buscada por el generador.

**Lote.** `src/arena/__tests__/motor046.test.ts` incluye el lote de 30 semillas, con un timeout
explícito. `src/arena/__tests__/motor046.stats.test.ts` corre el de 100 semillas y el contraste
con v3.

**Pruebas existentes.**

- Las que dependen de semillas concretas y del comportamiento v3 fijan
  `reglas: "reinicios-v3"`.
- Las que prueban el comportamiento actual buscan su semilla. **Nunca** se reescriben
  expectativas a mano para que pasen.
- Caso conocido: `e2e/arena-buffer.spec.ts:15` usa la semilla 5 para encontrar un saque de meta.
  Con v4 casi desaparecen los saques de meta por conducción, así que la tabla de semillas se
  calcula dentro del spec con `ejecutarArena`, como en `arena-formaciones.spec.ts:84`. Hay que
  buscar la primera semilla con cada tipo de reinicio.

**e2e y visual.** No hay elemento visual nuevo: la cancha ya dibuja el balón sobre el portero y
los movimientos. No se pide un spec nuevo; deben seguir en verde los e2e de arena y Playwright
completo. Para marcar ✅ hace falta además un smoke **visto correr** en la arena desplegada con
captura en `docs/evidencia/motor-046/`: una salida del portero, un centro y una atajada seguida
de saque desde las manos.

**Comandos.** `npm run typecheck`, `npm test`, `npm run test:stats` (al menos el archivo nuevo) y
`npx playwright test` en verde.

## Orden de implementación

1. **Antes de tocar el motor:**
   - opción `reglas` en `crearConfigArena`;
   - generador v3 y pruebas del 044 con el literal `"reinicios-v3"`;
   - `reglasDesde`;
   - comprobar que v1/v2/v3 siguen exactos.
2. Constantes en `limites.ts`, `reinicios-v4` y los módulos `portero.ts` y `ataque.ts` con sus
   pruebas puras.
3. Error 3, error 1, error 2 y laterales en el motor, cada uno tras `reglasDesde(v4)`.
4. Esquema, validador y prompt; textos de narración; texto de límites en `Arena.tsx`.
5. Fixture v4 y su generador; lote de 30 y de 100; contraste con v3.
6. Evidencia: salidas del lote en `docs/evidencia/motor-046/` y fila en `BITACORA.md`.

## Fuera de alcance y límites honestos

- No hay regla de cesión: el portero puede tomar con las manos, dentro del área, un pase de un
  compañero.
- No hay penales: una falta del portero en la salida se reanuda como cualquier falta de la
  arena.
- No hay vaselina, regate al portero ni elección de palo del rematador. El radio de reacción es
  una aproximación del tiempo de reacción, no un modelo de remate.
- No hay juego aéreo real: el centro solo se aísla de los contactos hasta `caidaM`; no hay altura
  ni cabezazo.
- La salida solo se activa con poseedor. No se anticipa a un pase al espacio en vuelo.
- Solo `centrar` tiene destino de pase a un punto; `pasar` sigue siendo a los pies.
- Bajo v1–v3, `centrar` se acepta pero no se ejecuta como tal (ver «Controladores LLM»).
- El estadista no tiene tema de centros. La voz en vivo no anuncia el centro como noticia propia.
- Los fueras de juego (unos 2,5 por partido en la base y en el prototipo) no se tocan aquí.
- Los 4 s de `manosMaxS` son sintéticos (la regla real es de 6 s). Todos los parámetros están por
  calibrar.
- Las bandas se midieron con controladores programados. Con LLM no hay lote medido; solo las
  pruebas 7 y 16 cubren su compatibilidad.
- No se presenta como partido reglamentario ni como calidad táctica profesional.

## Prototipo de exploración (no entregado)

Para fijar bandas alcanzables, se parcheó una **copia** de `motor.ts` fuera del repositorio. El
diff está en `docs/evidencia/motor-046/prototipo/prototipo-046.diff`, con banderas por variable
de entorno. Con todas las correcciones y `ESPERA=1 SINPOR=1 LLEG=14 REM=3` reproduce la columna
«Prototipo». Con las correcciones apagadas da las mismas métricas que el motor actual en las 30
semillas. La implementación debe seguir este brief, no el diff, que no tiene gating por versión
ni tipos.

## Riesgos para tenerlo antes del 27 de octubre

- **Caos numérico.** Cualquier diferencia de detalle con el prototipo cambia las cifras por
  semilla. Las bandas tienen margen, pero un desajuste fino puede costar iteraciones. Calendario
  razonable: implementación el 22–23, auditoría y Codex el 24, despliegue y smoke el 25.
- **Reproducción.** El fallo más probable es un gating incompleto. Lo detectan los fixtures v3 y
  la mutación de la prueba 17, que deben correr antes que nada.
- **Pruebas con semillas fijas.** Unitarias y e2e (al menos `arena-buffer.spec.ts`) cambiarán
  bajo v4. Corregirlas con búsqueda de semilla lleva tiempo, sobre todo en Playwright.
- **Colisión con el brief 047.** El 047 rediseña `Arena.tsx` y la cancha en paralelo. El 046 solo
  toca la cadena de límites en ese archivo; quien integre segundo resuelve el conflicto sin
  reescribir el texto del otro.
- **Narración.** Si V1–V8 rechazara algún texto de centro, el narrador de plantilla lanzaría una
  excepción. La prueba 18 lo detecta antes del despliegue.
- **Esquema LLM.** Ampliar el enum es compatible con el esquema estricto de Azure, pero no se ha
  probado en vivo con `centrar`. Requiere una llamada real (2/2) antes de dar ✅ al modo LLM.

## Versión 1.1 (21 de octubre): decisiones tras la revisión de Codex

La revisión de Codex de la versión 1 ([evidencia](../evidencia/motor-046/codex-brief-v1.md)) dio NO CERRADO.
Estas decisiones prevalecen sobre el texto anterior donde lo contradigan; se numeran como los hallazgos.

1. **Contraste v3.** El lote v3 se contrasta con la métrica amplia «pérdidas del portero tras atajada»
   (el portero defensor pierde la posesión ante un rival antes de soltar el balón). El contador de robos con
   `balon.manos` es exclusivo de v4 y debe ser 0 allí; no se exige que v3 lo incumpla.
2. **Saque forzado.** Al vencer el plazo de 4 s el vencimiento tiene prioridad sobre cualquier pase ordinario:
   se elige el compañero de campo con mayor margen sobre su rival más cercano, **sin límite de distancia**
   (`saqueManosMaxM` solo acota el saque voluntario). Si no hay ningún compañero de campo, el portero despeja a un
   punto sin receptor: centro del campo en x, su misma y acotada al campo. Pruebas: sin candidatos cercanos;
   y con un pase ordinario disponible distinto del mejor saque forzado (gana el forzado).
3. **Límite del área en pausas.** Bajo v4 el límite de posición del portero con `manos` se aplica también en
   `frenarJugadores`. Al adquirir `manos`, su posición se acota dentro del área y a ≥ `controlM` de su línea de
   gol, y su velocidad se anula. Prueba en ambas porterías durante una pausa con inercia hacia la línea.
4. **Falta sobre el portero.** Bajo v4, si `resolverFalta` entrega el balón al portero dentro de su área, la
   reanudación queda en `manos` con un plazo nuevo que empieza al terminar la pausa. Prueba: falta sobre el
   portero con el balón en los pies, reanudación e intento de disputa (rechazado).
5. **Fase aérea.** Solo cuentan los contactos cuyo punto proyectado sobre la trayectoria está a ≤ `caidaM`
   del punto de caída; se descarta el resto del segmento aunque el extremo del paso esté dentro. Prueba con un
   defensor justo antes del límite y el extremo ya dentro (sin contacto).
6. **Centro con caída fuera del campo.** Se conserva el error de ejecución del motor. La fase aérea la gobierna
   el destino perturbado. Un contacto válido (punto 5) anterior al cruce prevalece; si no hay ninguno y el balón
   sale, aplica el reinicio normal (banda, meta o esquina). Pruebas con caída fuera por la banda y por el fondo.
7. **Fuera de juego en el centro.** La sanción sigue usando `vuelo.adelantados`, capturado al golpear. Pruebas:
   un adelantado al golpe que vuelve antes de recibir es sancionado; uno habilitado al golpe que rebasa la línea
   después puede recibir; un receptor incidental distinto del designado sigue la misma regla.
8. **Llegada al área.** Se adopta la regla del prototipo, que es la medida: al cambiar la posesión dentro de la
   ronda, los jugadores cuyo destino se sustituyó por anclas son elegibles para atacar el área, cualquiera que
   fuera su orden (`cambio || accionPermitida`). Sin cambio de posesión, `cubrir`, `mover` y `presionar` no
   entran. La prueba 13 incluye un cambio de posesión dentro de la ronda.
9. **`centrar` del LLM.** Una orden `centrar` inválida (destino fuera del área rival, receptor inexistente, rival
   o portero propio) la rechaza `validarOrdenes`, y el coordinador aplica el respaldo vigente con su motivo de
   orden inválida; queda archivada y la reproducción es exacta. Con `receptor: null`, el receptor es el
   compañero de campo más cercano al destino (nunca el portero); si no hay ninguno, el balón va al destino sin
   receptor. Prueba de extremo a extremo: respuesta LLM simulada inválida, respaldo archivado, reproducción exacta.
10. **Matriz de versiones.** Además de los fixtures, cada comportamiento nuevo (manos, achique, conducción sin
    salida, centro, llegada, laterales) tiene un escenario mínimo ejecutado con `reglas` v1, v2, v3, ausente y v4:
    solo v4 cambia el resultado. `planProgramado`, `opcionPase` y sus dependencias compartidas no cambian.
11. **Pruebas reforzadas.** La prueba 7 incluye un defensor exactamente a la misma x que el poseedor. La prueba 16
    verifica el prompt construyéndolo con constantes alteradas (inyección o comprobación estructural), no
    comparando cifras. La prueba 4 fija posición y velocidad del rival para que, sin el límite, el portero cruce.
12. **Medición.** Las métricas de lote se calculan con un helper del repo (bajo `src/arena/`, con pruebas), que
    muestrea **todos** los ticks, pausas incluidas, y mide la continuidad de episodios por diferencia de ticks.
    Denominador cero cuenta como «sin muestra», nunca como cumplimiento. Las bandas de la tabla se recalculan una
    vez con ese helper sobre el código final; si cambian, se ajustan antes de congelarlas, con la línea base v3
    medida con el mismo helper, y se documenta.
13. **Constantes y trazabilidad.** El helper y las pruebas derivan geometría y ticks de `ARENA`/`limites.ts`; los
    valores propios de un escenario se nombran como tales. Los JSON de evidencia guardan semillas, duración,
    versión de reglas y commit.

## Versión 1.2 (21 de octubre): el saque del portero no regala el gol

La auditoría adversaria de la implementación ([evidencia](../evidencia/motor-046/auditoria-implementacion-1.md))
mostró que el objetivo 3 de Carlos («el portero tenía la bola y entra gol») seguía ocurriendo por otra vía: el
rival plantado a ~3,9 m bloquea el saque voluntario y el saque forzado le entrega el balón. Prevalece sobre lo anterior.

1. **Histéresis.** Los rivales se mantienen a `distanciaManosM + margenManosM` (constante nueva, 1,5 m) del
   portero con manos; el saque voluntario solo se bloquea con un rival a menos de `distanciaManosM`. Con la
   tolerancia de llegada, un rival respetuoso nunca bloquea el saque.
2. **Saque largo aéreo.** Un saque desde las manos (voluntario o forzado) a más de `saqueAereoMinM` (constante
   nueva, 20 m) usa la fase aérea del centro: solo se puede tocar a ≤ `caidaM` del punto de caída. Un saque corto
   exige línea de pase limpia: ningún rival a menos de `lineaSaqueMinM` (constante nueva, 3 m) del segmento.
3. **Elección del saque forzado.** Entre los compañeros de campo con saque admisible (largo aéreo o corto con
   línea limpia) se elige el de mayor margen respecto de su rival más cercano (v1.1 #2). Si ninguno es admisible,
   despeje aéreo sin receptor al punto de la v1.1 #2.
4. **Métricas que ven el fallo.** El helper cuenta, desde cada saque de manos hasta el primer toque: «saque
   perdido» si el primer toque es rival; «intercepción inmediata» si ocurre en ≤ 1 s; y «gol tras saque» si hay
   gol del rival sin toque defensor intermedio en los 10 s siguientes. Bandas v4 (1–100 y 101–200):
   intercepción inmediata = 0; goles tras saque ≤ 0,05 por partido; saques perdidos ≤ 0,35 por partido. La
   banda amplia anterior pasa a usar estas definiciones. El lote v3 debe incumplir la de goles tras saque.
5. **Validación de `centrar`.** Se rechaza si el ejecutor es el portero y si el destino está a menos de
   `margenLineaCentroM` (constante nueva, 1,5 m) de la línea de gol; `receptorCentro` nunca devuelve al portero.
6. **Pruebas.** Cada punto tiene prueba con mutación en rojo, y se añaden las de los seis mutantes supervivientes
   de la auditoría (B2). Si una banda nueva no se alcanza, se ajustan como máximo dos veces las constantes
   nuevas de este apartado y se documenta.
