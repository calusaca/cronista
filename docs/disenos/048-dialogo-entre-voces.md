# 048 — Diálogo entre voces: intercambios de 2 a 4 turnos en la mesa de transmisión

## Estado

Brief **cerrado** el 21 de octubre de 2026. Lo escribe Opus porque Fable no tiene cupo y lo
revisará Codex antes de implementarse. Las decisiones tomadas sin revisión se marcan con
**[decisión]**. Debe poder implementarse en uno o dos días: la entrega cierra el 27 de octubre.

Pedido de Carlos (21 de octubre): «una de las características de las narraciones en vivo es la
interacción entre narrador, comentarista y estadista para intentar hacer la narración lo más
amena posible; revisa ejemplos en docs/DatosPrueba».

Punto de partida: [brief 045](045-tres-voces.md), versión 3.1, ya publicado (revisiones
`0000010` y `0000011`, [evidencia](../evidencia/tres-voces/README.md)). Hoy cada invitado habla
en un clip con una sola cesión del narrador («Adelante, Ana Cedeño.») y luego un monólogo. No
hay diálogo: nadie pregunta por algo concreto, nadie retoma lo que dijo otro y nadie cierra.

El 048 encaja con:
- el [046](046-portero-centros-y-robo.md) (`reinicios-v4`), ya implementado: aporta `motivo:
  "centro"` y `"saque_manos"` en los pases y `estado.balon.manos`;
- el [047](047-rediseno-visual-arena.md), ya implementado: Mesa con avatar y color por rol.

Este brief no cambia el motor, `RegistroArena`, `hechosArena`, V1–V8, la crónica principal ni el
Analista.

## 1. Qué muestran los seis transcripts

### Método

Se leyeron completos los seis archivos de `docs/DatosPrueba`. Son subtítulos automáticos con marca
de tiempo y sin etiqueta de hablante, así que los turnos se infieren por señales verbales:
vocativos, pregunta seguida de respuesta, «sí…» al comienzo de un turno, cambios de registro y
presentaciones.

Un **episodio de interacción** es un tramo en el que dos voces se dirigen la una a la otra o se
responden; un monólogo no cuenta. Los recuentos son aproximados (±10–15 %). El ASR deforma
nombres, por ejemplo «Se va» por «Seba» en Argentina–Cabo Verde, y a veces mezcla dos voces en
una línea.

El material es ajeno: **solo orienta el diseño**. Ninguna frase de los transcripts entra en las
plantillas, y una prueba lo comprueba (§ 6).

### Voces y cadencia

| Transcript | Voces que interactúan | Episodios | Por cada 10 min de juego | Turnos por episodio (mediana, rango) | Palabras por turno (mediana) |
| --- | --- | --- | --- | --- | --- |
| España–Argentina (streaming) | 2, que se alternan narrador y comentario por periodos | ≈ 91 | ≈ 5,1–5,9 | 3 (2–8) | narrador 25 (réplica 2–5), comentarista 45–50 |
| Argentina–Cabo Verde (streaming) | 3: narrador y dos comentaristas | ≈ 103 | ≈ 6,3 | 3–4 (2–12) | narrador 20, comentaristas 40–50, réplicas 1–5 |
| Maipú–San Martín (radio) | narrador, central informativa, campo; locutor comercial sin diálogo | 46 | ≈ 4,3 | 3 (2–9) | narrador 18, central 30, campo 20 |
| City–Arsenal (TV, inglés) | 2 | 40 | ≈ 4,0 | 3 (2–6) | narrador 20, comentarista 35 |
| Alajuelense–Saprissa (TV) | 5–6, con voz estadística sin nombre | 65 | ≈ 5,4 | 4 (2–9) | narrador 20, comentaristas 35, voz estadística 40 |
| Real Madrid–Barcelona (TV) | 3: narrador, comentarista y campo | 59 | ≈ 5,9 | 3 (2–7) | narrador 15, comentarista 50, campo 30 |

En total hay unos **404 episodios**, entre 4 y 6 por cada 10 minutos de juego. El intercambio
típico tiene **3 turnos**: el narrador cede o pregunta, otra voz responde y el narrador vuelve al
balón. Los turnos del narrador dentro de un episodio son cortos (15–25 palabras) y sus réplicas lo
son aún más (1–5 palabras). Los turnos de análisis duplican esa longitud.

### Momentos en que ocurren

Número de episodios por momento del partido:

| Momento | España–Arg. | Arg.–C. Verde | Maipú | City–Arsenal | Alajuelense | Madrid–Barça |
| --- | --- | --- | --- | --- | --- | --- |
| Tras falta, reinicio, córner o saque | 26 | 23 | 11 | 5 | 19 | 17 |
| Juego en curso | 19 | 35 | 14 | 11 | 9 | 14 |
| Tras atajada u ocasión | 13 | 9 | 2 | 6 | 6 | 11 |
| Tras gol | 4 | 8 | 3 | 2 | 7 | 4 |
| Cambio | 5 | 3 | 4 | 5 | 9 | 7 |
| Lesión o parón | 4 | 6 | 3 | 5 | 5 | 2 |
| Descanso, final y después del final | 14 | 10 | 7 | 6 | 2 | 3 |

Los balones parados y los momentos tras una ocasión concentran la mayor parte de los episodios. En
la arena equivalen a reinicios, atajadas (con el portero sosteniendo el balón, 046), goles y
cambios.

### Patrones

Ocurrencias comprobadas leyendo, no por expresión regular:

| Patrón | España–Arg. | Arg.–C. Verde | Maipú | City–Arsenal | Alajuelense | Madrid–Barça |
| --- | --- | --- | --- | --- | --- | --- |
| P1 · el narrador pregunta y otro responde | ≈ 25 | ≈ 28 | 32 episodios (≈ 38 preguntas) | 14 (4 explícitas) | 6 (+8 en entrevistas) | 9 |
| P2 · retoma explícita de lo dicho por otro | ≈ 19 | ≈ 18 | 3 | 12 | 5 | 4 |
| P3 · dato aportado o pedido e interpretado por otra voz | ≈ 14 | ≈ 14 | 8 (32 sin interpretar) | 6 | 3–4 (+10 sin interpretar) | ≈ 7 (+4 sin interpretar) |
| P4 · réplica breve de acuerdo o matiz | ≈ 70 (≈ 5 matices) | ≈ 45 | 34 | 25 | ≈ 40 | ≈ 14 |
| P5 · nombre o apelativo dirigido a otra voz | ≈ 145 | ≈ 150 | ≈ 95 | 2–4 | ≈ 36 | ≈ 30 |
| P6 · humor ligero | ≈ 20 | ≈ 37 | 3 | 5 | 6 | ≈ 5 |
| P7 · anticipación o predicción | ≈ 25 | ≈ 25 | 3 | 9 | ≈ 11 | ≈ 11 |
| P8 · el narrador retoma el juego tras el invitado | ≈ 58 | ≈ 35 | 38 | ≈ 12 | ≈ 30 | ≈ 35 |
| P9 · cesión explícita de la palabra | ≈ 25 | ≈ 75 | 19 (+11 al locutor comercial) | 1 | ≈ 16 | ≈ 22 |
| P10 · opinión libre sin dato | ≈ 55 | ≈ 35 | 15 | 34 | ≈ 50 | ≈ 50 |

Citas cortas, solo como ilustración:

- **P9 + P5**, cesión con marcador y nombre: «Recupera Argentina. El partido está 0 a0. Nacho.»
  (Argentina–Cabo Verde, l. 264). Es la fórmula dominante de ese transcript, unas 38 veces.
- **P1**, pregunta fija tras cada gol: «¿Cuánto pesa el gol, Seba?» (l. 455; siete veces).
- **P1 + P3**, dato pedido en un reinicio: «Te pregunto, Thomas, mientras se hace el saque de
  arco…» (Maipú, l. 330).
- **P3 contado**: «Es el cuarto envío largo que manda Argentina al segundo palo» (Argentina–Cabo
  Verde, l. 796–797).
- **P2 hacia un hecho anterior**: «ya hemos dicho que el tener una amarilla a piqué…» (Madrid,
  l. 374–375, remite a l. 58). También «as you said 424 or…» (City, l. 610).
- **P4 de matiz**: «te corrijo, son tres modificaciones en San Martín» (Maipú, l. 1074).
- **P2 + P3**: «¿Ya cuántas lleva Pancho? Lo que te decíamos hay que contárselas» (España,
  l. 1321).
- **P9 + P8**, relevo de palabra: «Éxito, mi Pancho…» / «Muchas gracias, Juan Carlos… Ya comienza
  el partido» (España, l. 314–315).
- **P9 seguido de dato**: «adelante Este es el clásico número 128…» (Alajuelense, l. 224–225).
- **P2**: «y el ritmo ahora lo decía Rodolfo» (Alajuelense, l. 297).

### Qué se puede reproducir con verificabilidad

| Patrón | ¿Reproducible? | Cómo, o por qué no |
| --- | --- | --- |
| P1 pregunta → respuesta | **Sí** | El servidor elige la pregunta después de tener la respuesta verificada, así que la pregunta solo nombra lo que la respuesta contiene (§ 3.3). |
| P9 cesión con nombre, P5 vocativos | **Sí** | Son plantillas con los nombres ficticios de la mesa. No afirman nada del partido. |
| P3 dato pedido o aportado | **Sí** | El estadista es determinista y su dato lleva evidencia. La «interpretación» solo existe si la oración del comentarista cita ese dato (`apoyo`) y pasa V1–V8. |
| P2 retoma | **Parcial** | Se reproduce la retoma del dato del estadista por el comentarista, comprobada por identificador. No se reproduce «como decías» sobre el relato vivo del narrador: el servidor no sabe qué oyó cada espectador. |
| P8 el narrador retoma | **Sí** | Cierre breve de plantilla («Gracias, …»). El siguiente clip del narrador sigue siendo la retoma del juego, como en el 045. |
| P4 acuerdo | **Parcial** | Solo acuse de turno («Anotado, …»). El matiz («sí, pero…») exige una contraafirmación libre, y V1–V8 no la pagan. |
| P7 anticipación | **No** | V8 rechaza el futuro y las predicciones. |
| P6 humor | **No** | No se verifica y conlleva riesgo con personas ficticias. |
| P10 opinión libre | **No** | Ya excluida por el 045. |
| Contexto externo (tabla, otros partidos, biografías) | **No** | Ya excluido por el 045: no hay datos con procedencia. |

## 2. Huecos reales del motor (medidos hoy)

**Duración de la voz.** Los cuatro mp3 públicos del 045 (`docs/evidencia/tres-voces/publico-*.mp3`,
48 kbit/s, es decir 6000 B/s) dan:

| Clip | Caracteres | Duración | Caracteres/s |
| --- | --- | --- | --- |
| Comentarista ES | 102 | 10,5 s | 9,8 |
| Comentarista EN | 106 | 10,4 s | 10,2 |
| Estadista ES | 118 | 11,4 s | 10,3 |
| Estadista EN | 107 | 11,3 s | 9,5 |

Cada clip incluye una cesión y un cambio de `<voice>`. **Hallazgo:** con
`maxCaracteresIntervencion = 280`, un clip lícito del 045 dura unos 28–29 s y supera
`VOZ_BUFFER.duracionMaxS = 24`, así que el consumidor lo descarta sin sonar. Es un error latente
(los clips reales tenían unos 100 caracteres) y este brief lo corrige (§ 4).

**Ventanas sin noticia.** Se simularon 30 semillas de 60 s con controladores programados y
`reinicios-v4` (procedimiento en el apéndice). Una ventana va del fin de una noticia del narrador
(prioridad ≥ 35, clip de unos 1,5 s, más `calmaMinS` = 1,5 s) hasta la siguiente noticia.
Proporción de ventanas de al menos 5, 8, 12 y 16 s según el evento que las abre:

| Tras | n | ≥ 5 s | ≥ 8 s | ≥ 12 s | ≥ 16 s |
| --- | --- | --- | --- | --- | --- |
| gol | 28 | 0,89 | 0,57 | 0,29 | 0,18 |
| atajada | 27 | 0,78 | 0,59 | 0,26 | 0,15 |
| cambio | 34 | 0,82 | 0,38 | 0,12 | 0,03 |
| tiro (el desenlace llega enseguida) | 62 | 0,11 | 0,06 | 0,03 | 0,02 |

Otras cifras por partido:
- 2,0 disparos del comentarista (prioridad ≥ 70);
- 4 pausas de reinicio;
- 2,2 balones en las manos del portero, de 3,9 s de media;
- 2,2 centros.

Consecuencia: un diálogo completo de 3–4 turnos dura de 12 a 18 s y cabe **solo en una de cada
cuatro ventanas, más o menos, después de un gol o una atajada**. La versión breve (cesión y una
oración, de 8 a 10 s) cabe en más de la mitad. Por eso cada intercambio se publica con **dos
variantes** y el consumidor, que va de 10 a 20 s por detrás del prefijo producido (búfer, brief
038), elige la que cabe en la ventana que ya conoce (§ 5).

## 3. Diseño

### 3.1 Intercambio y formas

**[decisión]** Un **intercambio** es la misma candidatura del 045 (`IntervencionArena`, generada
**una vez** en el servidor y publicada en el diario), ampliada con turnos materializados. Tiene de
1 a `MESA_ARENA.dialogo.maxTurnos` (4) turnos, y dos turnos consecutivos nunca son del mismo rol.
El **protagonista** (`intervencion.rol`, comentarista o estadista) conserva el significado del 045
para la alternancia, la caducidad y el identificador.

| Forma | Turnos (completa) | Cuándo | Patrones |
| --- | --- | --- | --- |
| `pregunta` | N pregunta → C responde → N cierra | Candidatura del comentarista sin dato del estadista en el intercambio | P1, P5, P9, P8 |
| `dato` | N pide un tema → E da el dato → C retoma el dato → N cierra | Candidatura del comentarista cuyo dato de mesa está vigente (§ 3.4) y que el comentarista cita como `apoyo` en alguna oración | P9, P3, P2, P8 |
| `ronda` | N pregunta → C responde → N pide un tema → E da el dato | Candidatura del comentarista con dato de mesa vigente que el comentarista no cita | P1, P9, P3 |
| `estadista` | N pide un tema → E da el dato → N cierra | Candidatura periódica del estadista o por `cambio` (§ 3.4) | P9, P3, P8 |
| `final` | N pide los números del partido → E da el dato → N cierra | Candidatura final del estadista. En vivo solo aparece como texto; suena en «Escuchar desde el inicio» | P9, P3 |

N = narrador, C = comentarista, E = estadista.

**Variante breve** (`turnosBreve`): la cesión genérica del 045 (`MESA_ARENA.cesiones[idioma][rol]`)
seguida del primer turno del protagonista, que es la primera oración del comentarista o el primer
dato del estadista. Es el clip del 045. Si la variante completa queda igual a la breve, no se
publica `turnosBreve`.

### 3.2 Quién genera cada turno

- **Narrador:** solo plantillas cerradas: **marcos** (pregunta o petición), **cierres** y la cesión
  del 045. No lleva oraciones de hechos ni LLM. Sus huecos son solo `{nombre}` (nombre de la mesa),
  `{accion}` (sintagma cerrado por tipo de evento) y `{jugador}` (nombre del `jugador` del evento
  referido, copiado del registro).
- **Comentarista:** LLM por `src/lib/llm.ts` con V1–V8 sin excepciones y respaldo por plantilla.
  Es la misma tubería de `comentarArena` del 045, con el mismo presupuesto compartido y sin
  llamadas nuevas. Su turno puede llevar un **conector** de plantilla antes de la oración que
  retoma el dato del estadista (§ 3.3).
- **Estadista:** `datosEstadista`, determinista y con evidencia, sin cambios en su tabla.

La pregunta del narrador **no pasa V1–V8**, porque V8 rechaza toda pregunta por diseño
(`verificador.ts:424`). En su lugar, cada turno de plantilla pasa la **comprobación de turnos
D1–D5** (§ 3.3): la plantilla no puede afirmar nada que no esté en un registro referido por
identificador.

### 3.3 Encadenar referencias sin inventar: elección a posteriori y reglas D1–D5

El servidor compone el intercambio **después** de tener las oraciones verificadas, en
`componerIntercambio` (módulo nuevo `src/arena/dialogo.ts`, función pura). Cada plantilla se
elige por lo que efectivamente contienen los turnos siguientes.

**Clave del marco del narrador hacia el comentarista**, en este orden:
1. `centro`: alguna oración del comentarista cita (principal o apoyo) un hecho `arena:<id>` cuyo
   evento es un `pase` con `motivo: "centro"` (046). `{jugador}` es el autor de ese pase.
2. `secuencia`: alguna oración cita un hecho de arena con `tick` anterior al del evento que
   dispara la candidatura. `{accion}` se construye con ese evento disparador.
3. `repaso`: el evento disparador es `gol` sin `autogol`, `atajada`, `tiro_fuera`, `amarilla` o
   `roja`. `{accion}` se construye con él; en una `atajada`, `jugador` es el portero, como en el
   motor.
4. `generico`: disparo por tiempo, `final_anticipado`, autogol o respaldo sin evento. Usa
   `MESA_ARENA.cesiones[idioma].comentarista`.

**Marco hacia el estadista:** su clave es el `tema` del **primer** dato que dice el turno E
siguiente (`marcador`, `remates`, …). Con `final`, se usa la lista `final`.

**Conector** (forma `dato`): va dentro del turno C, inmediatamente antes de la primera oración que
cita como `apoyo` el hecho del dato que el turno E anterior acaba de decir. `{nombre}` es el
estadista.

**Cierre:** `{nombre}` es el último invitado que habló.

**Nombres:** la primera vez que la mesa se dirige a un invitado en la sesión usa el nombre
completo de `MESA_ARENA.nombres`. Después usa el primer token («Ana», «Tomás», «Priya»,
«Owen»). El estado `presentados` vive en `MesaSesion`.

**Reglas D1–D5** (`comprobarTurnos(intervencion, registro)`, pura). El servidor las ejecuta antes
de publicar sobre `turnos` y `turnosBreve`. Si alguna falla, publica la candidatura **sin**
`turnos` (camino del 045) y deja los motivos en `auditDialogo`.

- **D1 · Reconstrucción y procedencia.** Cada turno, en ES y en EN, es exactamente la plantilla
  `plantilla` con sus huecos rellenos, el conector en su posición y sus `oraciones` en orden. Los
  huecos se resuelven así:
  - `{nombre}` es un nombre de la mesa (completo o primer token);
  - `{jugador}` es `nombre` del `jugador` del evento de `refiere[0]`, buscado en
    `registro.inicial.jugadores` ∪ `banco`;
  - `{accion}` es `dialogo.acciones[idioma][tipo]` del mismo evento.
- **D2 · Coherencia del marco.** La clave del marco cumple su condición de § 3.3 con las
  oraciones de los turnos siguientes. El marco del estadista coincide con el tema del primer dato
  del turno E que lo sigue. `final` solo aparece en la candidatura final.
- **D3 · Conector cierto.** Solo hay conector si la oración que lo sigue cita como `apoyo` el
  hecho del dato que dijo el turno E inmediatamente anterior.
- **D4 · Un hecho, una vez.** Un hecho es principal de, como mucho, una oración dicha en cada
  variante. Si el comentarista citó como **principal** el hecho que dirá E, esa oración se retira
  del turno C. Nunca es la primera, porque esa narra el disparador (V5 y prompt del 045).
- **D5 · Forma.** El intercambio cumple todo lo siguiente:
  - tiene de 1 a `maxTurnos` turnos y nunca dos consecutivos del mismo rol;
  - los turnos del narrador no llevan oraciones;
  - cada turno de invitado lleva al menos una oración;
  - la primera oración del turno del comentarista tiene como principal el hecho disparador (o el
    último hecho, si el disparo fue por tiempo);
  - ES y EN tienen las mismas plantillas, conectores y oraciones;
  - el número de caracteres de ES y de EN no supera `maxCaracteresIntervencion` en ninguna de
    las dos variantes.

### 3.4 Dato de mesa y disparadores

- **Comentarista.** Disparadores sin cambios respecto al 045: por evento con prioridad ≥ 70 o por
  tiempo, mismo tope por sesión y mismo plazo. Al lanzar la generación en el tick `T`:
  1. `MesaSesion` consulta sin consumir (`DisparadorEstadista.candidato(registro, T, temas)`) el
     primer dato con plaza y valor cambiado entre los temas de
     `MESA_ARENA.dialogo.temasPorDisparador[tipo del disparo | "tiempo"]`. Ese es el **dato de
     mesa**.
  2. El mensaje de usuario del comentarista gana el campo `dato_mesa: <id del hecho>` (el hecho
     ya figura entre los hechos que recibe desde el 045).
  3. `SISTEMA_COMENTARISTA_ARENA` gana una línea: «Si recibes dato_mesa, puedes citarlo solo en
     apoyo de una oración sobre un hecho de arena; no repitas sus cifras: el estadista las dirá.»
  4. Al resolver la generación, si el dato de mesa ya no está vigente (el estadista periódico lo
     emitió entre tanto, o cambió de valor), se compone la forma `pregunta`. Si sigue vigente:
     - forma `dato` si alguna oración lo cita como `apoyo`;
     - forma `ronda` si ninguna lo cita;
     - en ambos casos la oración E se añade a `intervencion.oraciones` con su `evidencia`.
  5. Solo después de la escalera (§ 3.5) y de D1–D5, y si la variante completa conserva el turno
     E, `DisparadorEstadista.registrar(dato, T)` marca el dato como emitido y rearma el
     temporizador con `max(actual, T)`.
- **Estadista.** Periódico cada `estadistaCadaS`, como en el 045. Además, cuando `nuevos` contiene
  un evento `cambio`, vence en ese mismo avance con preferencia por el tema `cambios`
  (`evaluar(…, { preferidos: ["cambios"] })`): primero los temas preferidos que cambiaron y luego
  la tabla. La forma es `estadista`.
- **Final.** `mesa.final(registro)` publica la forma `final`.
- **Sin disparos nuevos por centro o saque de manos.** En el 046 no son noticia. El centro entra
  por el marco `centro` (§ 3.3) y las manos del portero como calma (§ 5).

### 3.5 Escalera de presupuesto (determinista, misma para ES y EN)

Cada variante se mide con `max(caracteres ES, caracteres EN)` del texto completo de sus turnos.
Mientras supere `maxCaracteresIntervencion`, se aplica el siguiente escalón y se anota en
`auditDialogo.escalones`:

1. Quitar el cierre.
2. Forma `dato` o `ronda`: retirar el turno E (y su marco y su conector), pasar a la forma
   `pregunta` y anular `registrar`. Como la composición termina antes de publicar, no se registra
   ningún dato que no se vaya a decir.
3. Forma `estadista` o `final`: dejar solo el primer dato (regla del 045). Forma `pregunta`:
   dejar solo la primera oración del comentarista (regla C12a del 045).
4. Sustituir el marco por la cesión genérica del rol.
5. Quitar el marco. Queda un solo turno: el dato o la oración, nunca omitidos (045).

**Invariantes calculadas a partir de las constantes** (prueba):
- `maxCaracteresOracion ≤ maxCaracteresIntervencion`, así que el escalón 5 siempre cabe;
- `maxCaracteresIntervencion / caracteresPorSegundoVoz < VOZ_BUFFER.duracionMaxS`.

### 3.6 Variedad y memoria

- Las plantillas se eligen en el servidor, **una vez**, y se guardan materializadas en los turnos.
  `relatoIntervencion` no elige nada: hay un SSML por intervención, idioma y variante, compartido
  por todos los espectadores en la caché `extra`, como en la v3.1.
- Elección: dentro de la clave, se rota desde `varianteVoz(seed, `${id}:${funcion}`)` y se toma la
  primera plantilla cuyo id no esté entre las `memoriaPlantillas` últimas usadas para esa función
  en la sesión. Si todas están entre ellas, se toma la usada hace más tiempo. Los índices ES y EN
  son paralelos, así que se elige un índice, no un texto.
- La memoria (`MemoriaDialogo`: ids recientes por función y `presentados`) vive en `MesaSesion`.
  Si el servidor se reinicia y recupera la sesión, la memoria empieza de cero (límite aceptado).

### 3.7 Datos publicados

En `src/arena/protocolo.ts`:

```ts
export type FormaDialogo = "pregunta" | "dato" | "ronda" | "estadista" | "final";
export type FuncionTurno = "pregunta" | "cesion" | "respuesta" | "dato" | "cierre";
export interface TurnoMesa {
  rol: RolMesa; funcion: FuncionTurno;
  texto_es: string; texto_en: string;        // texto hablado completo del turno
  oraciones: number[];                       // índices en intervencion.oraciones, en orden
  plantilla?: string;                        // "marco.secuencia#2", "cierre#0", "cesion.estadista#1"…
  conector?: { plantilla: string; antesDe: number }; // turno C: índice de la oración que retoma
  refiere?: string[];                        // hechos que dan valor a {jugador}/{accion}/tema
}
// IntervencionArena gana (opcionales; las del 045 siguen siendo válidas):
//   forma?: FormaDialogo; turnos?: TurnoMesa[]; turnosBreve?: TurnoMesa[];
//   auditDialogo?: { motivos: { regla: "D1" | "D2" | "D3" | "D4" | "D5"; detalle: string }[]; escalones: string[] };
```

Sin cambios: `id` (`${rol}:${tema}:${tick}`), `rol`, `tick`, `hechos`, `audit` y `modo`.
`oraciones` y `evidencia` siguen alineadas e incluyen la oración E en las formas `dato` y
`ronda`. Las intervenciones sin `turnos` (diarios anteriores, o una composición que falló D1–D5)
se reproducen como en el 045.

## 4. Constantes (`MESA_ARENA` en `src/sim/limites.ts`, comentadas)

Cambios sobre el 045:

```ts
// [048] antes 280: 280 caracteres a 9,5 c/s duran ≈ 29 s > VOZ_BUFFER.duracionMaxS (24 s) y el
// consumidor descartaba el clip. 210 / 9,5 ≈ 22 s.
maxCaracteresIntervencion: 210,
// [048] se elimina fragmentosPorIntervencion: el máximo de fragmentos es dialogo.maxTurnos.
```

Bloque nuevo:

```ts
/** Brief 048 · Diálogo entre voces. */
dialogo: {
  /** Turnos por intervención (un fragmento de voz y un <voice> por turno). */
  maxTurnos: 4,
  /** Caracteres por segundo de voz: el mínimo medido en los cuatro mp3 públicos del 045
   * (9,5–10,3 c/s, cesión y cambio de voz incluidos). Solo sirve para invariantes y para el informe. */
  caracteresPorSegundoVoz: 9.5,
  /** Plantillas recientes por función que no se repiten si hay alternativa. */
  memoriaPlantillas: 2,
  /** Temas del dato de mesa por disparo del comentarista, en orden de preferencia. */
  temasPorDisparador: {
    gol: ["marcador", "remates"], atajada: ["atajadas", "remates"], tiro_fuera: ["remates"],
    amarilla: ["faltas"], roja: ["faltas"], final_anticipado: ["marcador"], tiempo: ["remates", "acciones", "pases"],
  },
  acciones: {
    es: { gol: "el gol de {jugador}", atajada: "la atajada de {jugador}", tiro_fuera: "el remate de {jugador}", amarilla: "la amarilla a {jugador}", roja: "la roja a {jugador}" },
    en: { gol: "{jugador}'s goal", atajada: "{jugador}'s save", tiro_fuera: "{jugador}'s shot", amarilla: "the booking for {jugador}", roja: "the red card for {jugador}" },
  },
  marcos: {
    es: {
      repaso: ["{nombre}, repasemos {accion}.", "{nombre}, vamos con {accion}.", "Sobre {accion}, {nombre}, ¿qué tenemos?"],
      secuencia: ["{nombre}, ¿cómo se llegó a {accion}?", "{nombre}, ¿de dónde viene {accion}?", "{nombre}, cuéntanos la jugada previa a {accion}."],
      centro: ["{nombre}, ¿cómo nació el centro de {jugador}?", "{nombre}, el centro de {jugador}: ¿de dónde sale?", "Vamos al centro de {jugador}, {nombre}."],
      estadista: {
        marcador: ["{nombre}, ¿cómo está el marcador?", "El marcador, {nombre}."],
        remates: ["{nombre}, ¿cómo van los remates?", "{nombre}, los remates."],
        atajadas: ["{nombre}, ¿cuántas atajadas llevamos?", "Las atajadas, {nombre}."],
        faltas: ["{nombre}, ¿cómo van las faltas?", "{nombre}, la disciplina."],
        cambios: ["{nombre}, ¿cómo van los cambios?", "Los cambios, {nombre}."],
        acciones: ["{nombre}, ¿cómo se reparten las acciones?", "{nombre}, el reparto de acciones."],
        reinicios: ["{nombre}, ¿cómo van los reinicios?", "Los reinicios, {nombre}."],
        pases: ["{nombre}, ¿cómo están los pases?", "{nombre}, la distancia de pase."],
      },
      final: ["{nombre}, los números del partido.", "{nombre}, cerramos con los datos.", "Para cerrar, {nombre}, los números."],
    },
    en: {
      repaso: ["{nombre}, let's go over {accion}.", "{nombre}, take us through {accion}.", "{nombre}, what do we have on {accion}?"],
      secuencia: ["{nombre}, how did we get to {accion}?", "{nombre}, where did {accion} come from?", "{nombre}, walk us through the build-up to {accion}."],
      centro: ["{nombre}, how did the cross from {jugador} come about?", "{nombre}, the cross from {jugador}: where did it start?", "Over to the cross from {jugador}, {nombre}."],
      estadista: {
        marcador: ["{nombre}, where does the score stand?", "The score, {nombre}."],
        remates: ["{nombre}, how are the shots looking?", "{nombre}, the shots."],
        atajadas: ["{nombre}, how many saves so far?", "The saves, {nombre}."],
        faltas: ["{nombre}, how are the fouls looking?", "{nombre}, discipline."],
        cambios: ["{nombre}, where are the substitutions?", "The substitutions, {nombre}."],
        acciones: ["{nombre}, how is the share of actions?", "{nombre}, the share of actions."],
        reinicios: ["{nombre}, how are the restarts?", "The restarts, {nombre}."],
        pases: ["{nombre}, how are the passes?", "{nombre}, the pass distance."],
      },
      final: ["{nombre}, the match numbers.", "{nombre}, let's close with the data.", "To close, {nombre}, the numbers."],
    },
  },
  conectores: {
    es: ["Con ese dato, {nombre}.", "Sobre tus números, {nombre}.", "Enlazo con lo tuyo, {nombre}."],
    en: ["With that figure, {nombre}.", "On your numbers, {nombre}.", "Picking up from you, {nombre}."],
  },
  cierres: {
    es: ["Gracias, {nombre}.", "Anotado, {nombre}.", "Muy bien, {nombre}. Seguimos."],
    en: ["Thanks, {nombre}.", "Noted, {nombre}.", "Good, {nombre}. Back to the play."],
  },
},
```

Siguen vigentes, sin cambios:
- `cesiones` (cesión genérica y variante breve), `nombres` y `respaldosComentarista`;
- `maxOracionesComentarista: 2`, `maxCaracteresOracion: 200` y las demás cifras del 045.

Las listas ES y EN tienen la misma longitud y los mismos huecos en cada índice. Ninguna prueba
repite a mano una cifra ni un texto de este bloque: los lee de `MESA_ARENA`.

Se comprobó al redactar el brief que ningún tramo literal de cuatro o más palabras de estas
plantillas aparece en los transcripts. Hay coincidencias de tres palabras, como «el gol de» o
«back to the», que son genéricas.

## 5. Síntesis, transporte y reproducción

**SSML.**
- `relatoIntervencion(intervencion, seed, idioma, variante = "completa")` produce un fragmento por
  turno de la variante, con `rol` del turno, `tick` de la intervención, `fuentes` igual a los
  eventos de las oraciones del turno, `variante: varianteVoz(seed, `${id}:${k}`)` e intensidad
  por rol como en el 045. Sin `turnos`, conserva el camino del 045.
- `prepararVoz` no cambia: agrupa los fragmentos contiguos del mismo rol, que por D5 no existen,
  así que salen de 1 a 4 elementos `<voice>` hermanos en un único documento.
- La respuesta añade `variante` y `turnos` (el número).

**Transporte.**
- La ruta de relato acepta `variante: z.enum(["completa", "breve"]).optional()`, con
  `"completa"` por defecto.
- Con `intervencion`, lee del diario y nunca regenera, como en el 045.
- `breve` sobre una intervención sin `turnosBreve` devuelve la completa.
- La caché `extra` se indexa por el SSML, así que las dos variantes son entradas distintas y cada
  una se comparte entre espectadores.

**Validación del consumidor** (`segmentoVozValido`, para `tipoRelato === "invitado"`). Se exige:
- de 1 a `dialogo.maxTurnos` fragmentos, todos con el `tick` de la intervención;
- ningún par consecutivo con el mismo `rol`;
- `variante` igual a la pedida;
- audio obligatorio.

Las demás validaciones no cambian.

**Ventana conocida.** Función pura nueva en `src/arena/turnos.ts`:

```ts
ventanaConocidaS(registro: RegistroArena, partidoS: number, terminada: boolean): number | null
```

Con `p = PRIORIDAD_EVENTO_ARENA[e.tipo] ?? 0`, devuelve:
- `e.tick · pasoS − partidoS` para el primer evento `e` del prefijo con `e.tick · pasoS > partidoS`
  y `p ≥ VOZ_BUFFER.prioridadInterrupcion`;
- si no lo hay, `registro.final.tick · pasoS − partidoS`, que es una cota inferior si la sesión no
  terminó;
- `null` si `partidoS` está fuera del prefijo.

**Coordinador.**
- `EntradaTurno` gana `ventanaS: number | null`.
- Cada candidata gana `duracionBreveS?: number`. `duracionS` pasa a ser la duración de la
  variante completa, o `undefined` si aún no está decodificada.
- `siguienteTurno` devuelve `{ id, variante, recuerdo }`. Con las reglas del 045 intactas (fuente
  activa, calma, separación, alternancia, caducidad, apertura y final), elige la variante así:
  1. **completa** si está decodificada y `ventanaS !== null && duracionS ≤ ventanaS`;
  2. si no, **breve** si está decodificada;
  3. si no existe `turnosBreve` (las dos variantes coinciden), **completa**, como en el 045:
     puede ser cortada;
  4. si no, ninguna, y se espera a la breve hasta que caduque.
- `descartesTurno` considera válida una candidata si alguna de sus variantes es válida.

**Manos del portero como calma.** El consumidor calcula
`pausaVigente = calmaEnFotograma(cursor)`, función pura exportada. Es verdadera con una `pausa`
vigente (045) o con `balon.manos.hastaTick > tick` (046). Con ello, tras una atajada el diálogo
arranca al terminar la noticia, sin esperar `calmaMinS`.

**Peticiones.**
- `ArenaEmisionBuffer` pide `completa` y, si la intervención tiene `turnosBreve`, también `breve`,
  con la misma ventana de petición y caducidad del 045.
- Los clips se guardan con la clave `${id}|${variante}`.
- La memoria de escucha sigue siendo `texto = id`, añadida solo al arrancar.
- Al arrancar una variante se descarta la otra.

**Repetición guardada** («Escuchar desde el inicio», `completo`):
- pide siempre `variante: "completa"`, con la inserción por tick de la v3.1;
- la forma `final`, cuyo tick es el final, se inserta tras el último tramo, después del cierre
  del narrador.

En `vivo` y `directo` los intercambios siguen siendo texto en la Mesa (045).

## 6. Interfaz

**Mesa (047).** Dentro de `ArenaMesa`, antes de las tres tarjetas, se añade el bloque
**«Última conversación / Latest exchange»** (`data-testid="arena-mesa-dialogo"`). Se muestra solo
si la última intervención no posterior al cursor tiene `turnos`. Contiene:
- un `<ol>` con un `<li data-turno-rol data-turno-funcion>` por turno de la variante **completa**;
- en cada turno, el avatar de iniciales con el color de rol (`--rol`, clases del 047, 28 px), el
  nombre de la mesa y el texto del turno;
- en cada turno, un `<details>`:
  - en los turnos de plantilla, el id de la plantilla y, por cada `refiere`, el texto del hecho
    («plantilla · refiere»);
  - en los turnos con oraciones, los hechos citados y su procedencia, con el mismo renderizado
    por oración de la v3.1;
  - si existe, `auditDialogo.escalones`.

Nota final, en 12 px atenuado: «Se muestra el intercambio completo; la voz puede emitir su versión
breve si no cabe antes de la siguiente jugada» / «The full exchange is shown; the voice may play
its short version when it does not fit before the next play».

**Tarjetas.**
- Las del comentarista y el estadista muestran el **último turno de su rol** no posterior al
  cursor, sea de un intercambio propio o de otro (el turno E de una `ronda`).
- En la tarjeta del comentarista ya no aparecen las oraciones E añadidas.
- La tarjeta del narrador no cambia: sigue mostrando los comentarios LLM textuales.

**Transcripción de voz.**
- En `ArenaEmisionBuffer` y `ArenaNarracion`, un `<p data-narration-role>` por fragmento.
- El `details` exterior conserva `data-narration-role` (protagonista) y añade
  `data-narration-variant`.

**Requisitos generales.** ES/EN completos, 360 px sin desborde, sin animaciones nuevas
(movimiento reducido respetado) y contraste con los tokens del 047.

## 7. Fuera de alcance

- Humor, opinión, predicción o anticipación («ojo con…»), matices de desacuerdo y «como decías»
  sobre el relato vivo del narrador.
- Contexto externo (tabla u otros partidos), reportero de campo y cuarto rol.
- Diálogo que reaccione a lo que oyó cada espectador.
- Cambios en el motor, `PRIORIDAD_EVENTO_ARENA`, `relatoBuffer`, V1–V8, `RegistroArena` y
  `hechosArena`.
- Que el comentarista intervenga en el cierre en vivo (brief 041: tras el cierre no suena nadie).

## 8. Pruebas exigidas

Ninguna prueba repite cifras ni textos de `MESA_ARENA` a mano. Las mutaciones se ejecutan y se
anotan en la evidencia.

**`src/arena/__tests__/dialogo.test.ts` (nuevo).**
- Las cinco formas se componen sobre los fixtures `reinicios-v3` y `reinicios-v4` con un LLM
  simulado:
  - `pregunta` con el disparador gol;
  - `secuencia` cuando la segunda oración cita un pase anterior;
  - `centro` sobre el centro `a19` del fixture v4, o sobre un centro sintético si falta;
  - `dato` con el marcador en `apoyo`;
  - `ronda` sin cita;
  - `estadista` y `final`.
- Todas pasan D1–D5. Cada turno se reconstruye desde la plantilla, los huecos y las oraciones.
- `{jugador}` sale del evento referido: en la atajada, el portero.
- Autogol → marco `generico`.
- ES y EN tienen la misma estructura.
- La escalera con oraciones largas (simuladas) deja ≤ `maxCaracteresIntervencion` en las dos
  variantes y anota los escalones; en el último escalón queda un turno con la primera oración.
- Memoria: cuatro intercambios seguidos con la misma clave no repiten plantilla dentro de
  `memoriaPlantillas`; el primero usa el nombre completo y los siguientes, el corto.
- Plantillas:
  - ES/EN paralelas (misma longitud y mismos huecos por índice);
  - huecos ⊆ {`{nombre}`, `{jugador}`, `{accion}`};
  - ningún dígito;
  - ningún tramo literal de ≥ 4 palabras (normalizado sin tildes ni signos) presente en los
    archivos de `docs/DatosPrueba`.
- Invariantes de § 3.5 calculadas desde las constantes.

**`mesa.test.ts`.**
- `dato_mesa` llega en el mensaje del LLM simulado.
- Con dato de mesa registrado, el estadista periódico no lo repite.
- Si el estadista lo emitió mientras el LLM trabajaba, sale `pregunta` y no hay turno E.
- Un evento `cambio` dispara el estadista con `cambios` primero.
- La forma `final` existe.
- El número de llamadas al LLM es igual que en el 045 para la misma sesión con el mismo stub.
- Si D1–D5 fallan (composición forzada inválida), se publica sin `turnos` y con `auditDialogo`.

**`turnos.test.ts`.**
- Elección de variante: completa si cabe; breve si no cabe; espera de la breve; completa única
  como en el 045.
- `ventanaConocidaS`:
  - con un evento de prioridad igual a `VOZ_BUFFER.prioridadInterrupcion` (el `reinicio`), que
    cuenta;
  - con un `pase`, sin prioridad, que no cuenta;
  - sin noticias en el prefijo;
  - fuera del prefijo.
- `calmaEnFotograma` con `pausa`, con `manos` y sin ninguna.
- `segmentoVozValido`: acepta `maxTurnos` fragmentos alternados; rechaza `maxTurnos + 1`, dos del
  mismo rol seguidos y una `variante` distinta.

**`mesa-voz.test.ts`.**
- El SSML tiene tantos `<voice>` como turnos (3 y 4), en el orden de roles.
- Mismo SSML y misma `claveAudio` para el mismo id, idioma y variante; distinto entre variantes.
- La ruta no llama al LLM al pedir cualquiera de las dos variantes (contador del stub).

**`src/ui/__tests__/arena-mesa.test.ts`.**
- `renderToStaticMarkup` con un intercambio `ronda`: el bloque de conversación muestra los roles
  en orden, los nombres y los `details` de plantilla y referencia.
- Ningún intercambio posterior al cursor.
- La tarjeta del estadista muestra el turno E de la `ronda`; la del comentarista no muestra la
  oración E.

**E2e (`e2e/arena-mesa.spec.ts`, línea de tiempo controlada).** Rutas y Speech simulados como en
el 045, con duraciones fijas por `(id, variante)` en el fixture (no son normativas) y las
prioridades tomadas de `PRIORIDAD_EVENTO_ARENA`. La línea de tiempo deja márgenes de al menos
1 s en cada frontera.

| s | Qué ocurre | Qué se comprueba |
| --- | --- | --- |
| 0 | Apertura del narrador | arranca primero (v3.1) |
| 8 | Gol (noticia) | — |
| ≈ 11 | `comentarista:gol:80`, forma `ronda`; completa 10 s, breve 5 s; siguiente noticia a los 25 s | se piden las dos variantes; arranca la **completa**; la transcripción muestra los roles narrador, comentarista, narrador y estadista; no es cortada |
| 25 | Atajada (noticia) y manos del portero hasta los 29 s | — |
| ≈ 27 | `comentarista:atajada:250`, forma `pregunta`; completa 8 s, breve 4 s; siguiente noticia a los 33 s | arranca la **breve** (8 > ventana); arranca al cumplirse la separación, antes de «fin de la noticia + `calmaMinS`», gracias a las manos; termina antes de los 33 s |
| 33 | Tiro (noticia) | — |
| 45 | Cambio (noticia), `estadista:cambios:450`, forma `estadista`, completa 6 s; sin noticias hasta el final | arranca la **completa**; `data-narration-variant="completa"` |
| 60 | Final: forma `final` | solo texto en la Mesa; ningún invitado tras `cerrando` |

En todo el recorrido se comprueba además:
- no hay fuentes solapadas;
- el cursor al arrancar cada invitado está en `[tick · pasoS, tick · pasoS + caducidadInvitadoS]`;
- ningún cuerpo con `intervencion` lleva `memoria`;
- cada cuerpo lleva `variante`;
- el bloque `arena-mesa-dialogo` refleja el último intercambio ≤ cursor;
- a 360 px no hay desborde.

Segunda prueba, nueva: con la respuesta de la variante breve retrasada 3 s y la completa que no
cabe, el invitado espera y arranca la breve en cuanto llega.

Tercera prueba, ampliación de C9 del 045: «Escuchar desde el inicio» pide cada intervención una
sola vez con `variante: "completa"`, y la transcripción muestra los roles de cada turno en orden.

**Mutaciones.** Cada una debe poner en rojo al menos una prueba:

| # | Mutación | Prueba que se pone en rojo |
| --- | --- | --- |
| M1 | `{jugador}` tomado del `receptor` | D1 |
| M2 | Marco `secuencia` sin un hecho anterior citado | D2 |
| M3 | Conector cuando el dato solo se cita como principal | D3 |
| M4 | E dice un dato que C también dice como principal | D4 |
| M5 | Escalera sin comprobación de presupuesto | presupuesto |
| M6 | Escalera decidida por idioma | estructura ES/EN |
| M7 | Memoria ignorada | rotación |
| M8 | `siguienteTurno` siempre elige la completa, o la elige con `duracionS > ventanaS` | turnos y e2e |
| M9 | Sin `registrar` | repetición del estadista |
| M10 | `segmentoVozValido` admite 5 fragmentos o dos del mismo rol seguidos | validación |
| M11 | Plantilla con un tramo de cuatro palabras de un transcript | plantillas |
| M12 | `calmaEnFotograma` sin `manos` | calma y e2e |
| M13 | La ruta compone en lugar de leer (llama al LLM) | contador del stub |

**Pruebas del 045 que se adaptan, sin perder lo que demostraban:**
- **C1.** La invariante `maxCaracteresOracion + max(cesiones) ≤ maxCaracteresIntervencion` se
  sustituye por las de § 3.5. La prueba de longitud de las oraciones del comentarista y de los
  datos no cambia.
- **Recorte.** La prueba de recorte (C12a) pasa a ser el escalón 3 de la escalera.

**Cierre.** `npm test`, `npm run typecheck` y los e2e de arena en verde; auditoría adversaria y
revisión de Codex; publicación y smoke público.

## 9. Medición en el smoke público

Se hacen dos partidos de 60 s con controladores Azure OpenAI y voz real, en ES y en EN. La
evidencia va a `docs/evidencia/dialogo-048/`.

**Diario.**
- Formas por partido.
- Proporción de intervenciones con variante completa de ≥ 3 turnos.
- Escalones aplicados.
- Motivos D1–D5, que deben ser 0.

**Navegador** (Chromium contra la URL pública, con la instrumentación de `fuente.start` del e2e):
- clips de invitado arrancados por variante;
- **proporción de clips con diálogo**: clips arrancados con ≥ 3 turnos sobre el total de clips de
  invitado arrancados;
- **duración media** por variante;
- clips interrumpidos.

**Speech.**
- Duración real frente a la estimada (`caracteres / caracteresPorSegundoVoz`).
- Ningún clip por encima de `VOZ_BUFFER.duracionMaxS`. Si lo hay, se ajusta
  `caracteresPorSegundoVoz` a la cifra medida y se recalcula `maxCaracteresIntervencion`; nunca
  se recorta audio.
- Caracteres sintetizados por partido frente a los 970 (ES) y 951 (EN) que estimó el 045.

**Audio.** Un mp3 real de un intercambio de 3 o 4 turnos por idioma, con las voces comprobadas
por la asignación publicada.

No se fija una meta de proporción. La expectativa honesta, según § 2, es de alrededor de un
diálogo completo audible por partido de 60 s: unos dos disparos del comentarista por una
probabilidad de 0,25–0,3 de que quepa, más algún intercambio del estadista. Los demás suenan en
su versión breve.

## 10. Límites honestos

- **Lo que verifican D1–D5.** Las preguntas, conectores y cierres del narrador **no pasan V1–V8**,
  porque V8 rechaza las preguntas por diseño. D1–D5 garantizan otra cosa: que solo nombran
  personas y acciones copiadas de registros referidos por identificador, y que su clave coincide
  con lo que dicen los turnos siguientes. No certifican que la pregunta sea la mejor posible.
- **La «interpretación» del comentarista.** Es una oración verificada que cita el dato en
  `apoyo`. V3 le impide repetir sus cifras, así que la forma `dato` será poco frecuente (se mide).
  V1–V8 no certifican la pertinencia del análisis (045).
- **Las variantes y lo que se oye.** El intercambio se genera una vez y no sabe qué oyó cada
  espectador. Si suena la variante breve, el dato E de una `dato` o una `ronda` no se oye; aun
  así queda registrado como emitido y no se repite. Sigue visible en la Mesa.
- **La ventana y la duración son estimaciones.** La ventana solo se conoce dentro del prefijo
  recibido; más allá, la completa solo arranca si cabe hasta el final del prefijo. La duración por
  caracteres sale de cuatro clips.
- **La arena es densa.** En 60 s solo una de cada cuatro ventanas, aproximadamente, admite un
  diálogo completo tras un gol o una atajada. La frecuencia real de episodios (4–6 por cada
  10 minutos de 90) no es comparable.
- **Repetición guardada y vista en directo.** El intercambio final solo suena en la repetición
  guardada; en vivo es texto. En las vistas `vivo` y `directo` todo sigue siendo texto.
- **Coste de Speech.** Sube, porque se sintetizan dos variantes y el clip completo es más largo.
  Se mide en el smoke; no hay llamadas LLM nuevas.
- **Memoria y personajes.** La memoria de plantillas no sobrevive a un reinicio del servidor. Los
  nombres siguen siendo ficticios.

## Apéndice: medición de ventanas (reproducible)

El script no forma parte del repositorio. Se ejecuta con `node --import tsx` desde la raíz del
proyecto.

**Simulación.** Simula 30 semillas de 60 s con `ejecutarArena(crearConfigArena({ seed,
duracionS: 60 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() })`
y las reglas por defecto (`reinicios-v4`).

**Ventanas.** Para cada evento con `PRIORIDAD_EVENTO_ARENA ≥ 50`, la ventana es el tiempo hasta el
siguiente evento con prioridad ≥ 35 (o hasta el final), en segundos, menos 3 s (noticia de 1,5 s
más `calmaMinS`).

**Otras cifras.**
- Las manos se cuentan como tramos de fotogramas con `balon.manos.hastaTick > tick`.
- Los centros, como pases con `motivo: "centro"`.

**Duración de los mp3.** Es el tamaño en bytes dividido entre 6000, porque el formato es
`audio-24khz-48kbitrate-mono-mp3`.

## Versión 1.1 (21 de octubre): decisiones tras la revisión de Codex

La revisión de Codex de la versión 1 ([evidencia](../evidencia/dialogo-048/codex-brief-v1.md)) dio NO CERRADO.
Estas decisiones prevalecen sobre el texto anterior; la numeración sigue la de los hallazgos.

**Alcance de esta entrega (hallazgo 13).** Se implementan las formas `pregunta`, `ronda`, `estadista` y `final`.
La forma `dato` queda fuera: es rara (V3) y es la que más estado concurrente añade. Los marcos causales
`secuencia` y `centro` se retiran (ver 3).

1. **Variantes con estado explícito.** Cada variante tiene estado `inexistente | pendiente | valida | invalida |
   fallida`. Solo es `valida` con audio decodificado de duración finita, positiva y ≤ `VOZ_BUFFER.duracionMaxS`.
   El coordinador elige únicamente entre variantes válidas: la completa si cabe en la ventana, si no la breve si
   cabe; si ninguna cabe o ninguna es válida, no arranca. Pruebas: completa inválida con breve válida, y al revés.
2. **Variante pedida y efectiva.** El consumidor solo pide `breve` si la intervención trae `turnosBreve`. La
   respuesta incluye `variante` efectiva y el consumidor valida contra la pedida tras esa normalización. Los
   diarios del 045 (sin `turnos`) se sirven como hoy, como una sola variante completa. Prueba de ruta y consumidor
   con un diario del 045.
3. **Marcos neutrales.** Las preguntas del narrador no presuponen relación causal: solo nombran al jugador y la
   acción del evento disparador y piden la lectura del invitado (marco `repaso` o `generico`). Se eliminan
   `secuencia` y `centro`. Pruebas negativas: una plantilla que afirme «cómo nació» o «la jugada previa» no existe
   en las listas (comprobación sobre `MESA_ARENA`).
4. **Orden de resolución.** Primero los casos genéricos obligatorios (disparo por tiempo, autogol,
   `final_anticipado`, o acción sin entrada en `acciones`); después `repaso`. `refiere[0]` es siempre el evento
   disparador; las demás referencias siguen el orden del registro.
5. **Ventana como horizonte conservador.** `ventanaConocidaS` es el tiempo de partido desde el cursor hasta la
   primera noticia (prioridad ≥ `VOZ_BUFFER.prioridadInterrupcion`) del prefijo recibido, contando también las
   noticias ya alcanzadas pero aún pendientes de sonar (que la anulan: ventana 0). Con el cursor detenido o la
   sesión terminada, la ventana es la del prefijo hasta su final; en el límite exacto del prefijo, se usa la
   breve. La ventana solo decide la variante: textos, referencias y fotogramas visibles siguen filtrados por el
   cursor. Prueba: conocer una noticia futura no adelanta su presentación ni su texto.
6. **Composición única.** La ruta, la reconexión y la recuperación devuelven exactamente los `turnos` y
   `turnosBreve` materializados en el diario; la ruta nunca llama a `componerIntercambio`. Mutación: una ruta que
   recompone (aunque sea determinista) debe fallar la prueba que compara texto y SSML con lo guardado.
7. **Dato del estadista en una ronda.** `MesaSesion` es la única que publica. Al publicar una `ronda`, revalida en
   la misma llamada síncrona el dato contra el prefijo vigente: si su valor cambió o ya se emitió, se retira el
   turno del estadista (la ronda queda como `pregunta`). Registrar el dato actualiza `ultimos` y no
   `ultimaEmitidaTick`, que sigue siendo exclusivo de las candidaturas del estadista. Pruebas: valor cambiado
   durante el LLM, emisión periódica en el mismo tick, fallo de publicación (no registra) y tick final.
8. **Duración.** La estimación por caracteres solo decide la composición; la garantía es el rechazo por duración
   real del consumidor (punto 1). La estimación suma `pausaTurnoS` (constante nueva) por cada turno más allá del
   primero. Pruebas con los textos más largos posibles en ES y EN y cuatro turnos: estimación ≤
   `VOZ_BUFFER.duracionMaxS`. Si el smoke mide clips reales por encima, se ajustan juntas
   `caracteresPorSegundoVoz` y las plantillas, sin bajar de una oración del comentarista.
9. **Presupuesto de Speech.** La ruta de intervención rechaza con 429 la síntesis de un invitado cuando, tras
   reservarla, quedarían menos de `reservaSpeechNarradorCaracteres` (constante nueva) de SSML o
   `reservaSpeechNarradorSolicitudes` (constante nueva) solicitudes en el presupuesto del encuentro; el
   consumidor lo trata como variante `fallida`. Se presupuesta con `caracteresPresupuestados` (SSML). El
   consumidor pide primero la breve y solo pide la completa si la ventana conocida la admite. Prueba con `extra`
   real y Speech simulado: un partido con todas sus intervenciones deja presupuesto para el cierre.
10. **Regresiones del 045.** Las pruebas del 045 siguen vigentes sin cambios de comportamiento (noticias
    continuas, caducidad con respuestas tardías, cierre durante una generación, una noticia corta al invitado).
    Se añaden mutaciones que impiden cortar un diálogo activo, permiten arrancar una variante caducada o publican
    tras `cerrar()`, y cada una debe poner una prueba en rojo.
11. **Memoria de plantillas y nombres.** Ambas variantes se componen desde el mismo estado previo. La memoria de
    plantillas y la marca de «invitado presentado» solo se confirman tras publicar en el diario, con las plantillas
    de la variante completa. Una composición rechazada por D1–D5, recortada o con publicación fallida no consume
    memoria. Pruebas para los tres casos.
12. **Pruebas negativas.** D1–D5 se prueban con casos inválidos construidos independientemente, cada uno
    rechazado por su regla concreta; con `refiere` alterado el texto no se reconstruye; la rotación de plantillas
    se prueba sobre la ventana de memoria con las listas agotadas. Se mantiene C12a.
13. **Cifras y procedimiento.** El procedimiento de medición de ventanas se versiona en `src/arena/` con sus
    umbrales derivados de constantes; las cifras históricas del brief quedan como medidas, no como reglas.
