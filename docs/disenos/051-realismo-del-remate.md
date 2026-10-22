# 051 — Realismo del remate: colocación, portero con nivel y balón por encima (reglas `reinicios-v5`)

## Estado

Brief **cerrado** el 22 de octubre de 2026, escrito por Fable. Pedido de Carlos sobre la arena publicada:
todos apuntan al centro del arco (las atajadas dependen solo de dónde esté el portero), el nivel del portero
no cuenta, no hay compromiso entre colocar y pegar, y el modelo es plano (nada pasa por encima del travesaño).
Todas las decisiones están tomadas; las cifras se midieron hoy con el helper del repositorio y un prototipo
sobre una **copia** del motor ([evidencia](../evidencia/motor-051/README.md)). Debe poder implementarse en
**un día** (entrega el 27 de octubre); la sección «Prioridad y cortes» dice qué cae si no da tiempo.

Precedentes: [044](044-correcciones-motor-arena.md) (versión de reglas y fixtures de reproducción exacta),
[046](046-portero-centros-y-robo.md) v1.1/v1.2 (`reglasDesde`, `radioAtajada`, salida a achicar, helper de
métricas `src/arena/metricas-lote.ts`, bandas `LOTE_ARENA_046`, mutaciones, generador de fixture) y
[049](049-estadisticas-y-favoritos.md) (clasificación de remates a puerta / fuera o bloqueados).

## 1. Hechos verificados en el código (22 oct)

- **Decisión de rematar** (`motor.ts:308-313`): orden `tirar` del controlador o decisión local con
  `prefiereTirar` (`personalidades.ts:47-51`: radio `ARENA.radioTiroM` = 25 m, escalado por la tendencia
  `remate` solo si hay pase disponible). **No cambia en este brief.**
- **Ejecución** (`sacarBalon`, `motor.ts:274-288`): el destino es **siempre** el centro del arco rival
  (`motor.ts:297`), más `remateTrasLineaM` (0,5 m) tras la línea desde v1 con reinicios. Error lateral
  uniforme ±`errorTiroM`·(1 − nivel/100) (9 m), más lluvia y presión de la afición. Una sola extracción del
  PRNG `arena:golpe:${tick}:${id}`. El evento `tiro` guarda en `hasta` el destino ya perturbado.
- **Vuelo** (`moverBalon`, `motor.ts:603-623`): recta a `velocidadTiroMps` = 24 m/s (× velocidad del balón
  del entorno). Toca el balón el primer jugador cuyo punto proyectado sobre el segmento del paso queda a
  ≤ `controlM` (1,1 m); el portero en su área a ≤ `controlPorteroM` (1,7 m), que bajo v4 es
  `radioAtajada(d)` = max(0,5; 1,7·min(1; d/8)) (`portero.ts:43`), sin nivel. Si toca el portero: desvío con
  `desvioProbabilidad` = 0,35 fija (`motor.ts:626`) hacia 1 m tras su línea y ±6 m del centro (acaba en
  córner), si no, atrapa. Sin contacto: gol si |y − 34| ≤ 3,66 al cruzar la línea (`resolverSalida`,
  `motor.ts:504`), si no `tiro_fuera`.
- **Portero**: ancla `POR` (6, 34); bajo v4 sale solo en el mano a mano (`destinoSalida`, `motor.ts:409`).
  Fuera de ese caso está en el centro aunque el balón venga de un costado. El nivel del portero solo influye
  en su velocidad de carrera.
- **Niveles**: sin `variantes.niveles`, todos los jugadores de un equipo comparten
  `nivel = (ataque + defensa)/2` (`motor.ts:86`); en las semillas 1–200 va de 55 a 84 (mediana 70). La
  arena **sí acepta** `variantes.niveles` con `nivel` por jugador (comprobado hoy con el motor del repo).
- **Consumidores del desenlace**: `vista.ts:45-63` (textos ES/EN de `tiro`, `atajada`, `tiro_fuera`),
  `relato.ts:18-27` (variantes breves), `expresion.ts:36-37`, `narrador.ts:23` (tipos permitidos),
  `estadista.ts:30-44` (`rematesPorLado`: a puerta = gol del rematador o atajada cuyo `receptor` es el
  rematador), `estadisticas.ts:255-276` (049: directo = a puerta; indirecto = cualquier otro cierre, incluido
  `tiro_fuera`). Ninguno mira `motivo` en `tiro_fuera`.

## 2. Línea base medida hoy (`reinicios-v4`, programados, 120 s)

Definiciones en § 8. `prototipo/base.mts` sobre el motor del repositorio.

| Métrica | 1–30 | 1–100 | 101–200 | v3 1–100 (referencia) |
| --- | --- | --- | --- | --- |
| Goles por partido / goles sin remate | 2,13 / 0 | 2,59 / 0,02 | 2,42 / 0,02 | 2,23 / 0,03 |
| Remates por partido | 4,57 | 5,03 | 4,57 | 3,81 |
| Fracción a puerta (gol + atajada) | **0,927** | **0,918** | **0,945** | 0,934 |
| Conversión (gol / remates) | 0,467 | 0,511 | 0,525 | 0,577 |
| Atajadas / remates a puerta | 0,496 | 0,444 | 0,444 | 0,382 |
| Desvíos / atajadas | 0,254 | 0,337 | 0,344 | 0,338 |
| Fuera (ancho + alto) / remates; de ellos, altos | 0,015; 0 | 0,018; 0 | 0,018; 0 | 0,005; 0 |
| Bloqueados por jugador de campo / remates | 0,029 | 0,044 | 0,031 | 0,052 |
| Colocación: a puerta en las mitades exteriores del arco | **0,265** | **0,255** | **0,207** | 0,251 |
| Desvío medio del destino respecto del centro (m) | 1,30 | 1,30 | 1,25 | 1,28 |
| Distancia mediana del remate (m); portero: m a su línea / lateral mediana | 19,5; 7,0 / 1,66 | 19,8; 6,9 / 1,82 | 19,8; 7,0 / 1,82 | 20,0; 6,4 / 2,11 |
| Nivel del portero, partición por la mediana: atajadas alto − bajo | +0,118 | −0,020 | +0,041 | +0,041 |
| Nivel del rematador, partición por la mediana: a puerta alto − bajo | −0,007 | +0,003 | +0,002 | +0,032 |

**Experimento controlado** (mismas 100 semillas, niveles forzados con `variantes.niveles`): porteros a 40
frente a 90 → atajadas / a puerta 0,468 frente a 0,467 (**−0,001**: el nivel del portero no existe);
jugadores de campo a 40 frente a 90 → a puerta 0,742 frente a 0,947 (+0,205), conversión 0,368 frente a
0,492 (+0,124). La partición por la mediana es ruidosa (+0,118 en 30 semillas, −0,020 en 100) porque el nivel
de equipo confunde; por eso las bandas de nivel usan el experimento controlado (§ 8).

Lectura: el 92 % de los remates van entre los tres palos, la mitad son gol, el portero no tiene nivel, nadie
coloca (el destino medio está a 1,3 m del centro) y nada sale alto.

## 3. Decisión de versión

- Nueva constante de reglas **`"reinicios-v5"`**, que pasa a ser `ARENA.reglas` (predeterminada en
  `crearConfigArena`). `ARENA.version` sigue en `arena-v3`: el formato del registro no cambia.
- `reglasArena` (`tipos.ts:11`) pasa a `["reinicios-v1", "reinicios-v2", "reinicios-v3", "reinicios-v4", ARENA.reglas]`
  con `"reinicios-v4"` **literal**. `validarConfigArena` acepta las cinco y rechaza cualquier otra.
- Getter `private get v5() { return reglasDesde(this.config, "reinicios-v5"); }` en `MotorArena`. **Todo** lo
  de este brief se activa solo con `v5`; el getter `v4` y sus ramas no cambian. Los registros v1–v4
  (fixtures `src/arena/__fixtures__/arena-reinicios-v{1,2,3,4}.json`), los archivos sin `reglas` y las
  pruebas que fijan `reglas` se reproducen idénticos, byte a byte.
- Los generadores de fixtures y las pruebas del 046 que hoy usan `ARENA.reglas` con el sentido de «v4»
  pasan al literal `"reinicios-v4"` (como hizo el 046 con v3). `generar-reinicios-v4.ts` pide
  `reglas: "reinicios-v4"` explícito.
- **Nada se implementa en `planProgramado`, `opcionPase`, `prefiereTirar` ni `validarOrdenes`.** La
  observación no lleva `reglas` y la reproducción de los respaldos archivados depende de ellos.

## 4. El modelo, en diez líneas

1. **Objetivo.** El rematador apunta a un punto **dentro** del arco: el lado contrario a donde está el
   portero respecto de la línea rematador–centro del arco; si el portero está sobre esa línea (desvío
   lateral ≤ `indiferenciaM`), el palo lejano. Margen desde el palo = `margenPaloM` + `margenNivelM`·(1 − nivel/100)
   + `margenPersonalidadM`·(0,5 − remate/100), acotado a [`margenPaloM`; `arcoM`/2].
2. **Potencia.** `potencia` ∈ [0; 1] crece con la distancia al arco: 0 hasta `colocadoHastaM`, 1 desde
   `potenteDesdeM`. Un remate cercano se coloca; uno lejano se pega.
3. **Velocidad.** `velocidadTiroMps`·(1 + `potenciaVelocidad`·(potencia − 0,5)): 19,2–28,8 m/s.
4. **Error de ejecución.** Lateral respecto del objetivo, **triangular** (suma de dos extracciones uniformes
   del mismo PRNG `arena:golpe`), semiancho = `errorBaseM`·(1 − nivel/100)·acotar(d/`referenciaM`,
   `factorDistanciaMin`, `factorDistanciaMax`)·(1 + `errorPotencia`·potencia) + lluvia + presión.
5. **Por encima del travesaño.** Con probabilidad `altoBase` + `altoPotencia`·potencia + `altoNivel`·(1 − nivel/100)
   (PRNG `arena:remate:${tick}:${id}`), el vuelo lleva `alto: true`: nadie lo toca y al cruzar la línea de
   fondo es `tiro_fuera` con `motivo: "alto"`, nunca gol. Es una dimensión vertical **modelada**, no simulada.
6. **Alcance del portero.** Radio de contacto ante un `tiro` = max(`cuerpoM`, (`alcanceMinM` +
   (`alcanceMaxM` − `alcanceMinM`)·nivel/100)·min(1, t/`reaccionS`)), con t = distancia origen–portero /
   velocidad del remate y `reaccionS` = `PORTERO_ARENA.reaccionM` / `velocidadTiroMps` (0,33 s). A nivel 50
   vale 1,65 m, casi el `controlPorteroM` de hoy.
7. **Atrapar o desviar.** Probabilidad de desvío = acotar(`desvioBase` + `desvioPotencia`·(potencia − 0,5)
   − `desvioNivel`·(nivel − 50)/50 + `desvioEstirada`·estirada, `desvioMin`, `desvioMax`), con estirada =
   (distancia lateral del balón al portero − `cuerpoM`)/(alcance − `cuerpoM`) acotada a [0; 1]. Mismo PRNG
   `desvio:${tick}:${id}` de hoy. El rechace sigue siendo el del 044 (balón suelto hacia el córner).
8. **Posicionamiento.** Fuera del mano a mano, con el balón de un rival (poseedor o vuelo) a ≤
   `manoAManoRadioM` del centro de su arco y sin saque, el destino del portero es C + u·`posicionamientoM`
   (3 m sobre la bisectriz arco–balón), con el límite de área existente. En el mano a mano manda la salida
   del 046. Así el lado «libre» del punto 1 existe de verdad.
9. **Bloqueos** de jugadores de campo: sin cambios (posicionales, `controlM`); un vuelo `alto` no se bloquea.
10. **Determinismo.** Todo sale de `prngDerivado` con las claves citadas; el lado del objetivo no usa PRNG.

Los niveles del rematador y del portero son `capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto))` cuando
hay entrenadores (como el error de hoy), y `j.nivel` si no. Sin personalidad, `remate` = 50.

## 5. Constantes nuevas en `src/sim/limites.ts`

Un objeto nuevo y comentado; ninguna prueba repite estas cifras. Son las del candidato medido (§ 8).

```ts
/** Brief 051 · Remate (reinicios-v5). Cifras sintéticas calibradas con el prototipo del 22 oct. */
export const REMATE_ARENA = {
  /** Objetivo dentro del arco: margen mínimo desde el palo, más margen por falta de nivel y por
   * personalidad (tendencia `remate` baja = más conservador). Acotado a [margenPaloM, arcoM/2]. */
  margenPaloM: 0.5, margenNivelM: 1.5, margenPersonalidadM: 0.6,
  /** Desvío lateral del portero (m) respecto de la línea rematador–arco por debajo del cual se considera
   * centrado y el rematador elige el palo lejano. */
  indiferenciaM: 0.5,
  /** Error lateral (semiancho triangular, m) a nivel 0 y distancia referenciaM; escala con la distancia
   * acotada a [factorDistanciaMin, factorDistanciaMax] y crece con la potencia. Sustituye a
   * ARENA.errorTiroM solo para el remate bajo v5. */
  errorBaseM: 5.5, referenciaM: 16, factorDistanciaMin: 0.5, factorDistanciaMax: 1.2, errorPotencia: 0.3,
  /** Potencia 0 hasta colocadoHastaM, 1 desde potenteDesdeM (distancia al centro del arco). */
  colocadoHastaM: 8, potenteDesdeM: 20,
  /** Velocidad del remate = ARENA.velocidadTiroMps × (1 + potenciaVelocidad × (potencia − 0,5)). */
  potenciaVelocidad: 0.4,
  /** Probabilidad de que el balón salga por encima del travesaño (dimensión vertical modelada). */
  altoBase: 0.02, altoPotencia: 0.06, altoNivel: 0.04,
  /** Alcance del portero (m) a nivel 0 y 100, con el tiempo de reacción de PORTERO_ARENA (reaccionM /
   * velocidadTiroMps) y el mínimo cuerpoM. A nivel 50 ≈ ARENA.controlPorteroM. */
  alcanceMinM: 0.9, alcanceMaxM: 2.4,
  /** Desvío en vez de atrapada: base, más potencia, menos nivel, más estirada; acotado. */
  desvioBase: 0.35, desvioPotencia: 0.2, desvioNivel: 0.15, desvioEstirada: 0.3, desvioMin: 0.1, desvioMax: 0.8,
  /** Fuera del mano a mano, el portero se coloca a estos metros del centro del arco sobre la bisectriz. */
  posicionamientoM: 3,
} as const;
```

`ARENA.errorTiroM`, `desvioProbabilidad`, `desvioLateralM`, `desvioFondoM` y `PORTERO_ARENA.reaccionM/cuerpoM`
no cambian: v1–v4 los siguen usando y v5 reutiliza `reaccionM`, `cuerpoM`, `desvioLateralM` y `desvioFondoM`.

## 6. Cambios en el motor y en los tipos

Módulo puro nuevo **`src/arena/remate.ts`** (como `portero.ts`), importado por el motor y por las pruebas:
`objetivoRemate(origen, portero | null, nivel, remate, lado) → { y, lado: ±1, margenM }` (y orientada, el
motor la transforma), `potenciaRemate(d)`, `velocidadRemate(potencia)`, `errorRemate(nivel, d, potencia)`,
`probabilidadAlto(nivel, potencia)`, `alcancePortero(nivel, tiempoS)`, `probabilidadDesvio(nivel, potencia,
estirada)`, `destinoPosicionamiento(balon, lado)`.

- **`Vuelo`** (`tipos.ts`) gana `potencia?: number` y `alto?: true`, opcionales como `centro`/`aereo`; solo
  existen bajo v5. **`EventoArena`**: `tiro_fuera` puede llevar `motivo: "alto"`. Ningún campo nuevo en
  `tiro` (su `hasta` ya es el destino perturbado; las métricas de colocación se calculan con él).
- **`sacarBalon`** (v5, `tipo === "tiro"`): calcula objetivo, potencia, error y `alto`; el destino pasa a ser
  `transformar({ x: largoM, y: objetivo }, lado)` y conserva `remateTrasLineaM`. El PRNG `arena:golpe` hace
  **dos** extracciones (error triangular); el `alto` sale del PRNG `arena:remate`. Pases y centros no cambian.
- **`moverBalon`** (v5): velocidad del vuelo `tiro` = `velocidadRemate(potencia)` (× entorno); radio del
  portero en su área = `alcancePortero(nivel, distancia(origen, portero)/velocidad)`; un vuelo `alto` no
  admite contactos de nadie; probabilidad de desvío = `probabilidadDesvio(...)` con la distancia lateral del
  contacto. El rechace y su destino no cambian (044).
- **`resolverSalida`** (v5): si el vuelo es `tiro` con `alto`, al cruzar la línea de fondo es
  `tiro_fuera` con `motivo: "alto"` aunque |y − 34| ≤ arcoM/2, y sigue el saque de meta (último toque del
  atacante). Un remate `alto` que cruza por la banda sigue siendo saque de banda sin `tiro_fuera`, como hoy.
- **`moverJugadores`** (v5): tras la rama de `destinoSalida` (`motor.ts:409`), `else if` del posicionamiento
  (§ 4.8). Pasa por el límite de área de `motor.ts:414-419`.
- **Orden `tirar` del LLM**: misma ruta (`sacarBalon(j, "tiro", arco, null)`), así que el objetivo lo elige
  el motor igual que en la decisión local. **No se añade campo de lado al esquema** (§ 11).
- `SISTEMA_ARENA` añade una frase construida con constantes (`frasesRemate()` como `frasesCentroPortero`):
  el motor coloca el remate al lado libre del portero, el nivel del portero cuenta en la atajada y un remate
  lejano puede irse alto; `tirar` no necesita destino.

## 7. Relato, narración, estadista y UI

- **`vista.narrarEventoArena`**, `tiro_fuera` con `motivo: "alto"`: «El remate de {nombre} se va por
  encima del travesaño.» / «{nombre}'s shot goes over the bar.». Sin motivo, el texto actual («sale fuera» /
  «goes wide»). Alimenta `hechosArena`, narrador, comentarista y descripción.
- **`relato.ts`, modo breve**: variantes para `tiro_fuera` alto, cuatro por idioma como las de `tiro`:
  ES «¡Alto el remate de {j}!», «¡Se va por encima el disparo de {j}!», «¡{j} la manda por encima del
  travesaño!», «¡Por encima! Remate de {j}.»; EN «{j} blazes it over!», «{j}'s shot sails over the bar!»,
  «Over the bar from {j}!», «{j} lifts it over!». `expresion.ts` conserva «decepción» para ambos motivos.
- **Estadista (045) y 049: sin cambios.** `rematesPorLado` no se toca (git diff vacío); un `tiro_fuera`
  alto es «fuera o bloqueado» (indirecto) exactamente como hoy. No hay tema de estadista para los altos.
- **Mesa y diálogo (048): sin cambios.** `PRIORIDAD_EVENTO_ARENA` igual.
- **`Arena.tsx`, texto de límites (ES/EN)**: una frase: «el remate se coloca dentro del arco y puede irse
  por encima del travesaño por una probabilidad modelada, sin altura simulada; no hay palos ni rebotes».
- **`metricas-lote-cli.ts`**: imprime también las métricas de remate (§ 8); los JSON de evidencia guardan
  semillas, duración, reglas y commit como hoy.

## 8. Métricas de lote y bandas

Se amplía el helper del 046 (`src/arena/metricas-lote.ts`) **en la misma pasada**: `MetricasPartido` gana los
contadores de remate y `MetricasLote` sus cocientes; `incumplimientos` recibe además la banda de
`LOTE_ARENA_051`. Programados, 120 s, todos los ticks, denominador cero = «sin muestra» (incumple).

**Definiciones (por remate = evento `tiro`).** Desenlace = primer evento posterior no neutro entre: `gol`
del mismo lado y jugador (**gol**); `atajada` con `receptor` = rematador (**atrapada** o **desvío** según
`motivo`); `tiro_fuera` del rematador (**ancho**, o **alto** si `motivo: "alto"`); `intercepcion` con
`receptor` = rematador (**bloqueado**); cualquier otro cierre (`recepcion`, `reinicio`, `recuperacion`,
otro `tiro`) = otro. **A puerta** = gol + atrapada + desvío (misma regla que `rematesPorLado`).
**Conversión** = gol / remates. **Atajadas / a puerta**. **Fuera** = (ancho + alto) / remates; **altos /
fuera**. **Bloqueados / remates**. **Goles sin remate** por partido = goles cuyo evento previo no neutro no es
un `tiro` ni un desvío (conducción hasta la línea, rechace). **Colocación a los lados** = remates con
|`hasta.y` − 34| ≤ arcoM/2 cuyo |`hasta.y` − 34| > arcoM/4, sobre los que van dentro del arco. **Desvío
medio** = media de |`hasta.y` − 34|. **Experimento controlado**: el mismo lote se corre dos veces con
`variantes.niveles` y `nivel` forzado (helper `partidoConNiveles(seed, nivelPortero | null, nivelCampo | null)`
en `metricas-lote.ts`; los no forzados reciben el nivel de su equipo): **porteros 40 frente a 90** →
diferencia de atajadas / a puerta; **jugadores de campo 40 frente a 90** → diferencia de conversión.

**Candidato medido (prototipo con las constantes de § 5) frente a la base v4:**

| Métrica | v4 1–100 | v5 1–30 | v5 1–100 | v5 101–200 |
| --- | --- | --- | --- | --- |
| Goles por partido / sin remate | 2,59 / 0,02 | 2,30 / 0 | 2,17 / 0 | 2,22 / 0 |
| Remates por partido | 5,03 | 4,80 | 5,05 | 4,95 |
| A puerta | 0,918 | 0,778 | 0,719 | 0,739 |
| Conversión | 0,511 | 0,479 | 0,430 | 0,448 |
| Atajadas / a puerta; desvíos / atajadas | 0,444; 0,337 | 0,384; 0,372 | 0,402; 0,418 | 0,393; 0,507 |
| Fuera; altos / fuera | 0,018; 0 | 0,181; 0,269 (7 altos) | 0,240; 0,223 | 0,234; 0,353 |
| Bloqueados | 0,044 | 0,028 | 0,032 | 0,022 |
| Colocación a los lados; desvío medio (m) | 0,255; 1,30 | 0,902; 2,85 | 0,875; 2,86 | 0,841; 2,82 |
| Controlado, porteros 40 → 90: atajadas / a puerta | 0,468 → 0,467 (−0,001) | 0,233 → 0,531 (+0,298) | 0,229 → 0,458 (+0,229) | — |
| Controlado, campo 40 → 90: conversión; a puerta | 0,368 → 0,492; 0,742 → 0,947 | — | 0,355 → 0,560 (+0,205); 0,705 → 0,796 | — |
| 046: conversión del mano a mano; mediana de salida (m) | 0,365; 1,34 | 0,389; 1,47 | 0,346; 1,56 | 0,369; 1,31 |
| 046: centros por partido; proporción desde la banda | 0,71; 0,485 | 0,63; 0,458 | 0,52; 0,394 | 0,65; 0,411 |

**Bandas (`LOTE_ARENA_051`, en `limites.ts`).**

| Métrica | `rapido` (1–30, `npm test`) | `completo` (1–100 y 101–200, `test:stats`) |
| --- | --- | --- |
| A puerta | ∈ [0,55; 0,88] | ∈ [0,60; 0,85] |
| Conversión | — | ∈ [0,30; 0,50] |
| Atajadas / a puerta | ∈ [0,25; 0,60] | ∈ [0,30; 0,55] |
| Fuera | ∈ [0,08; 0,40] | ∈ [0,12; 0,35] |
| Altos | ≥ 2 remates altos | altos / fuera ∈ [0,10; 0,45] |
| Bloqueados | ≤ 0,10 | ≤ 0,10 |
| Goles sin remate por partido | ≤ 0,05 | ≤ 0,05 |
| Colocación a los lados | ≥ 0,60 | ≥ 0,60 |
| Controlado, porteros 90 − 40 | ≥ 0,10 | ≥ 0,10 |
| Controlado, campo 90 − 40 (conversión) | — | ≥ 0,10 |
| Goles por partido (046, sin cambio) | ∈ [1,5; 3,0] | ∈ [1,8; 2,8] |

**Contraste.** `test:stats` corre el lote 1–100 bajo `reinicios-v4` y exige que **incumpla** a puerta
(0,918 > 0,85), colocación (0,255 < 0,60), altos / fuera (0 < 0,10) y la diferencia controlada de porteros
(−0,001 < 0,10). Las demás bandas son guardas de realismo que v4 puede cumplir. Las bandas de
`LOTE_ARENA_046` (044 incluido) se exigen íntegras sobre v5 en los tres lotes; el candidato las cumple todas
salvo el caso del punto siguiente.

**Refinamiento de una métrica del 046 (decisión).** Sobre el candidato, el lote 1–100 y el 1–30 dan
`intercepcionesInmediatas = 1`: la semilla 23, un saque aéreo de 25,1 m (justo sobre `saqueAereoMinM` = 25,
el ajuste 1 de 2 que el 046 v1.2 hizo por esa misma semilla) disputado legalmente en su caída (v1.1 #5), a
21,3 m del portero y 1,1 s después del golpe, que la convención del tick del evento (`tick + 1`) mide como
1,0 s ([evidencia](../evidencia/motor-051/lotes/candidato-p3-intercepcion-semilla23.txt)). Esa banda se
escribió para el saque regalado al rival plantado junto al portero (v1.2 #4), no para la disputa de una
caída a 20 m, que ya vigila `saquesPerdidos` (≤ 0,35). **Decisión:** «intercepción inmediata» = primer toque
rival en ≤ `saqueInmediataS` **y a ≤ `inmediataRadioM` del origen del saque** (constante nueva en
`LOTE_ARENA_046`, 15 m). La base v4 del repo sigue en 0; el contraste v3 del 046 no usa esta métrica. Se
rechaza el segundo ajuste de `saqueAereoMinM`: movería la semilla, no el problema. Prueba unitaria con una
lista sintética de eventos: toque a 5 m en 0,8 s cuenta; toque a 21 m en 1,0 s no.

**Recalibración.** Si la implementación queda fuera de una banda nueva, se ajustan **como máximo dos veces**
las constantes de `REMATE_ARENA` (nunca las bandas ni las del 046), se documenta cada ajuste junto a la
constante y se regeneran los JSON de evidencia; a la tercera se escala a Carlos. Con las 27 variantes de
`calibracion/` como mapa: subir `errorBaseM` o `alcanceMaxM` baja los goles; `posicionamientoM` = 2 los
sube y debilita la diferencia de porteros; el error uniforme (en vez de triangular) baja los goles a 1,5.

**Coste.** `test:stats` suma al lote actual los dos lotes controlados de porteros y los dos de campo
(≈ 20 s cada uno) y el contraste v4; `npm test` suma dos lotes de 30 semillas (≈ 5 s cada uno). Las métricas
de remate salen de la misma pasada que las del 046.

## 9. Pruebas exigidas

Unitarias en `src/arena/__tests__/motor051.test.ts` (escenarios sobre `crearEstadoArena` + `MotorArena`
con `reglas: "reinicios-v5"`, como `motor046.test.ts`); lote completo y contraste en
`motor051.stats.test.ts`. Cada prueba nombra la mutación que la pone en rojo; la auditoría las aplica todas.

| # | Prueba | Mutación que la pone en rojo |
| --- | --- | --- |
| 1 | `objetivoRemate`: portero desplazado a +y → objetivo a −y y viceversa, en ambos lados del campo; portero centrado → palo lejano respecto de la y del rematador; margen monótono decreciente en nivel y en `remate`, acotado; el objetivo siempre queda a ≥ `margenPaloM` del palo | Ignorar al portero; quitar la cota |
| 2 | Error: con semilla fija, `hasta.y` = objetivo + (r₁ + r₂ − 1)·semiancho con el mismo PRNG `arena:golpe`; nivel 100 a 8 m sin entorno → error 0; el semiancho escala con la distancia dentro de las cotas y con la potencia | Una sola extracción (uniforme); quitar el factor de distancia |
| 3 | Potencia y velocidad: 0 a ≤ `colocadoHastaM`, 1 a ≥ `potenteDesdeM`; el vuelo tarda más ticks con potencia 0 que con 1 (misma distancia) | Velocidad fija |
| 4 | Alto: una semilla donde `arena:remate` sale alto → `vuelo.alto`, el portero en la trayectoria no lo toca, al cruzar la línea entre los palos es `tiro_fuera` con `motivo: "alto"`, sin gol, y sigue saque de meta; por la banda, saque de banda sin `tiro_fuera` | Permitir contacto al vuelo alto; quitar la condición en `resolverSalida` |
| 5 | `alcancePortero`: nivel 0 → `alcanceMinM`, 100 → `alcanceMaxM`, ×min(1, t/reaccionS), nunca < `cuerpoM`. Integración con `variantes.niveles`: el mismo remate que pasa a 2,1 m del portero lo ataja con nivel 100 y entra con nivel 30 | Ignorar el nivel; devolver `controlPorteroM` |
| 6 | `probabilidadDesvio`: crece con potencia y estirada, decrece con nivel, acotada; integración: un contacto que es «atrapada» con nivel 90 es «desvío» con nivel 10 (misma semilla) | Constante `desvioProbabilidad` |
| 7 | Posicionamiento: poseedor rival a 20 m y 15 m del eje con un defensor por delante (sin mano a mano) → en 1 s el portero se ha movido hacia C + u·`posicionamientoM` y queda en su área; con el balón a > `manoAManoRadioM` vuelve al ancla; en mano a mano manda `destinoSalida` (prueba 7 del 046 intacta) | Quitar la rama; aplicarla también en mano a mano |
| 8 | Orden `tirar` de un controlador fijo → mismo objetivo, potencia y `alto` que la decisión local en el mismo estado; `validarOrdenes`, el esquema y los respaldos archivados no cambian | Ruta distinta para la orden |
| 9 | Versiones: v1–v4 exactos (pruebas existentes); fixture nuevo `arena-reinicios-v5.json` con generador `generar-reinicios-v5.ts` y prueba `reproducirArena(r)` `toEqual(r)`; `validarConfigArena` acepta v1–v5 y rechaza `reinicios-v6`; valor por defecto v5; **matriz**: cada comportamiento nuevo (objetivo, error, alto, alcance, desvío, posicionamiento, velocidad) tiene un escenario mínimo con `reglas` v1, v2, v3, v4, ausente y v5: solo v5 cambia el resultado | Activar cualquier regla nueva con `v4` o `conReinicios` (rompe el fixture v4); volver a `=== ARENA.reglas` en alguna rama del 046 (rompe v4) |
| 10 | Textos ES/EN del `tiro_fuera` alto en `vista` y las cuatro variantes breves de `relato`; el narrador de plantilla sobre el fixture v5 con el alto como hecho principal pasa V1–V8; `rematesPorLado` y `agregarPrefijo` (049) cuentan el alto como fuera o bloqueado y el `git diff` de `estadista.ts` queda vacío | Texto genérico sin motivo; contar el alto como a puerta |
| 11 | Prompt: `frasesRemate()` construido con constantes alteradas (estructural, como la 16 del 046) | Cifras escritas a mano |
| 12 | Lote rápido (1–30) en `motor051.test.ts` con timeout explícito: bandas `rapido` de `LOTE_ARENA_051` y de `LOTE_ARENA_046`, incluidos los dos lotes controlados de porteros | — |
| 13 | `motor051.stats.test.ts`: lotes 1–100 y 101–200 con todas las bandas `completo` (051 y 046), los cuatro lotes controlados, y el contraste v4 que incumple las cuatro bandas discriminantes | Cualquier regla de § 4 quitada deja v5 igual a v4 en su banda |
| 14 | `intercepcionesInmediatas` refinada: lista sintética (toque a 5 m en 0,8 s cuenta; a 21 m en 1,0 s no); las pruebas del 046 siguen en verde | Ignorar el radio |

**Fixture v5.** Generador `src/arena/__fixtures__/generar-reinicios-v5.ts` (en el repo), `DURACION_FIXTURE_V5_S = 90`,
`tiempoMs` a 0, búsqueda de semilla 1–400. Condiciones que la prueba comprueba: un `tiro_fuera` alto, una
atajada con desvío, una atajada sin desvío, un `tiro_fuera` ancho y un gol de remate colocado en una mitad
exterior del arco. A 60 s ninguna semilla de 200 reúne siquiera cuatro; a 90 s la primera es la 81 en el
prototipo (≈ 3 MB; tope `archivoMaxBytes` 8 MB). La implementación encontrará su propia semilla.

**Pruebas existentes.** Las que dependen de semillas y del comportamiento v4 fijan `reglas: "reinicios-v4"`;
las que prueban el comportamiento actual buscan su semilla. **Nunca** se reescriben expectativas a mano.
Caso conocido: `e2e/arena-buffer.spec.ts` y los specs que calculan tablas de semillas con `ejecutarArena`
cambiarán de semilla bajo v5; se recalculan dentro del spec, no a mano.

**Comandos.** `npm run typecheck`, `npm test`, `npm run test:stats` (al menos los archivos 046 y 051) y
`npx playwright test` en verde. Para ✅: smoke **visto correr** en la arena desplegada con captura en
`docs/evidencia/motor-051/`: un remate colocado al palo con gol, una atajada de un remate colocado y un
remate alto narrado en ES y EN.

## 10. Orden de implementación

1. **Antes de tocar el motor:** `"reinicios-v4"` literal en `reglasArena`, generador v4 y pruebas del 046
   con el literal, getter `v5`; comprobar que v1–v4 siguen exactos.
2. `REMATE_ARENA`, `remate.ts` con sus pruebas puras (1, 3, 5, 6 en su parte pura).
3. Motor: `sacarBalon`, `moverBalon`, `resolverSalida`, `moverJugadores`, cada rama tras `v5` (2, 4, 7, 8).
4. Textos, prompt, texto de límites en `Arena.tsx` (10, 11).
5. Helper de métricas (remate, experimento controlado, refinamiento del 046), bandas, fixture v5 y
   generador, lotes y contraste (9, 12–14).
6. Evidencia: JSON de los lotes en `docs/evidencia/motor-051/lotes/`, fila en `BITACORA.md`.

## 11. Prioridad y cortes

**P1 (obligatorio):** § 3, § 4 completo, § 5, § 6, § 7 (textos de `vista` y `relato`), § 8 con el
experimento controlado y el refinamiento del 046, § 9 entero.

**P2 (si P1 está en verde a media tarde):** texto de límites en `Arena.tsx`; frase del prompt (`frasesRemate`)
y su prueba 11; smoke desplegado para el ✅ (sin él queda ⏳).

**Cortes decididos (no se implementan):**

- **Lado del remate en la orden `tirar`.** El esquema no cambia: añadir un campo con el esquema estricto de
  Azure obliga a hacerlo obligatorio y nulo en las nueve acciones, no se ha probado en vivo y el 046 ya dejó
  anotado ese riesgo. El motor coloca por el LLM. Límite declarado; candidato a brief posterior.
- **Palos y rebotes.** No hay poste ni larguero como obstáculo ni rechace al campo. Se midió un rechace del
  portero hacia el campo (50–70 % de los desvíos, 8 m): no produjo ningún gol ni cambió los remates por
  partido, porque quien recoge debe esperar `accionCadaS` antes de rematar. Descartado por inútil.
- **Altura simulada.** El «alto» es una probabilidad; no hay trayectoria vertical, vaselina ni cabezazo.
- **Decisión de rematar** (`prefiereTirar`, `radioTiroM`) y **bloqueos**: sin cambios.
- **Estadista, mesa y diálogo**: sin tema ni marco nuevos para el remate alto.

## 12. Fuera de alcance y límites honestos

- Los remates por partido (≈ 5 en 120 s) y los goles (≈ 2,2) siguen siendo cifras de un escenario
  comprimido, no de un partido real (≈ 25 remates y 2,7 goles en 90 min). Se respeta la banda de goles del 046
  a costa de una conversión (0,43) y una fracción a puerta (0,72) más altas que las reales (≈ 0,11 y ≈ 0,35).
- Los niveles por equipo van de 55 a 84: la diferencia de porteros solo es visible en el experimento
  controlado; la partición por la mediana no se usa como banda porque es ruido (+0,13 / +0,04 / +0,19 en
  los tres lotes del candidato).
- El objetivo mira la posición del portero en el instante del golpe, no su movimiento; el portero no finta
  ni anticipa el lado.
- El error lateral es triangular sintético; no se ajustó a datos reales.
- La velocidad del remate solo afecta al tiempo de reacción del portero y a los ticks de vuelo.
- `alto` hace el vuelo intocable para todos, también para un defensor pegado al rematador: un bloqueo
  posible se narra como remate alto. Ambos son «fuera o bloqueado» en el 049.
- Las bandas se midieron con controladores programados; con LLM no hay lote (solo la prueba 8).
- El prototipo (`docs/evidencia/motor-051/prototipo/`) no es la implementación: cualquier diferencia de
  detalle cambia las cifras por semilla. Las bandas tienen margen (goles 2,17–2,30 frente a 1,8) y hay dos
  ajustes permitidos.

## 13. Riesgos para tenerlo antes del 27 de octubre

- **Caos numérico.** Como en el 046: la implementación no coincidirá tick a tick con el prototipo. Si la
  banda de goles del 046 cae por debajo de 1,8 en 1–100, el primer ajuste es `posicionamientoM` 3 → 2,5 y
  el segundo `alcanceMaxM` 2,4 → 2,2; se documentan. Calendario: implementación el 23, auditoría y Codex el
  24, despliegue y smoke el 25.
- **Reproducción.** El fallo más probable es un gating incompleto (p. ej. las dos extracciones del PRNG
  `arena:golpe` bajo v4). Lo detectan los fixtures v1–v4 y la matriz de la prueba 9; corren antes que nada.
- **Pruebas y e2e con semillas fijas.** Cambian bajo v5; se recalculan con búsqueda, nunca a mano.
- **Fixture de 90 s.** ≈ 3 MB más en el repo; si pesa demasiado, 75 s con las mismas condiciones y búsqueda
  hasta 600 semillas antes de recortar condiciones (nunca quitar el alto).
- **Banda del 046 refinada.** Si Codex o la auditoría objetan el radio de 15 m, la alternativa aceptable es
  excluir solo los saques cuyo vuelo fue aéreo (haría falta guardar `aereo` en el evento `pase`), no mover
  `saqueAereoMinM`.
- **Narración.** Si V1–V8 rechazara el texto del alto, el narrador de plantilla lanzaría una excepción; la
  prueba 10 lo detecta antes del despliegue.
