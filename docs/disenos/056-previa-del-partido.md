# 056 — Previa del partido: alineaciones tipo TV y presentación hablada de la mesa

## Estado

Brief **cerrado** el 22 de octubre de 2026, escrito por Fable sin código de producción. Se
implementa **después** de cerrar el [055](055-identidad-futbolera.md) (bloques A–C): el
P2 «alineaciones tipo TV» (055 § 7.2) y la «cabecera de jornada» (055 § 7.1) **pasan a este
brief** y quedan absorbidos; el 055 no los implementa. Entrega del hackathon: 27 de octubre
(meta de envío 26 oct, bitácora del 22 oct); el video se regraba después de este brief si entra.

Pedido de Carlos (22 de octubre, aprobado): «Normalmente antes de un partido se dan las
alineaciones, principales características de cada equipo; la alineación se da con la
formación. ¿Podemos implementar algo así?».

Alcance acordado, en dos bloques con corte (§ 9):

- **Bloque A · Tarjeta de alineaciones** (visual, texto accesible, ES/EN, 360 px): antes del
  saque inicial, una tarjeta por equipo con la formación dibujada en una media cancha, dorsales
  y apellidos en sus puestos, capitán, entrenador, banquillo, rasgos y condiciones del partido;
  en las vistas en vivo (búfer y «preparada»), guardadas y en la repetición; se oculta al
  empezar el juego.
- **Bloque B · Previa hablada** de la mesa del 045/048: el narrador lee formación, capitán y
  entrenador por plantilla; el estadista aporta características deterministas (nivel medio,
  perfiles de ataque y defensa, condiciones); todo derivado del registro, sin LLM, sin
  predicciones, dentro de los presupuestos de Speech y de las reglas de turno, y con sus
  líneas en la transcripción del 053 con clase de verificación propia.

Todo dato sale de `RegistroArena` (`config.partido`, `config.formaciones`,
`config.entrenadores`, `inicial.jugadores`, `inicial.banco`, `inicial.arbitro`,
`config.partido.condiciones`). **Nada inventado**: ni tabla, ni historial, ni estadio, ni
competición, ni pronóstico. Este brief **no cambia** el motor, `RegistroArena`, el validador
de archivos, los fixtures ni los textos que usan los e2e (lista cerrada en § 8).

## 1. Hechos verificados en el código (22 oct)

- **Datos disponibles** (`src/arena/tipos.ts`): `ConfigArena.formaciones: Record<Lado, FormacionArena>`
  (obligatorio; con «auto» el motor escribe la elegida, `motor.ts:43`), `entrenadores?`
  (`nombre`, `perfil`, `preferidas`, diez atributos 0–100), `aficiones?`, `partido: SimConfig`
  con `local/visita: { nombre, ataque, defensa, estilo, jugadores[16] }` y `condiciones?`
  (`clima`, `temperaturaC?`, `superficie`, `cesped?`, `presion`). `EstadoArena.inicial` trae
  `jugadores` (22, con `puesto` asignado por `asignarPuestos`, `dorsal`, `nombre`, `nivel`,
  `capitan?` por `designarCapitanes`, `personalidad?`, `posicionNatural?`), `banco?` (5 por
  lado), `arbitro?` (`nombre`, `criterioContacto?`), `entrenadores?[lado].formacion/plan`.
  Los archivos **arena-v1** no traen capitán, personalidad, banco, árbitro ni entrenadores
  (`ArenaPlantilla.tsx:69` ya lo declara); `arena-v2`/`v3` sí.
- **Geometría de la formación** (`src/arena/catalogo.ts`): `puestos(f)` devuelve `["POR", …]`
  (11 puestos, únicos por lado tras `asignarPuestos`), `anclas(f, lado, "base")` da la posición
  en metros de cada puesto (POR en x = 6; líneas a 0,25/0,47/0,69/0,8 del largo; con cinco
  líneas, 0,25–0,85); el estado inicial usa exactamente esas anclas (`motor.ts:97`).
- **Nombres**: `plantillas.ts:60` genera `«Nombre Apellido»` (dos palabras; `apellido()` puede
  dar una sola palabra compuesta). Dorsales titulares `1 2 3 4 5 6 8 10 7 9 11`, suplentes
  `13–17` (`plantillas.ts:54–56`).
- **Etiquetas existentes**: `etiquetasPerfil` y `etiquetaTemperamento` (`personalidades.ts:62–71`),
  `etiquetasEntrenador` (`entrenadores.ts:98`), climas y superficie traducidos en
  `ArenaContexto.tsx:16, 30`. Estilos del simulador `posesion | contragolpe | presion`
  (`src/sim/tipos.ts:6`) **no tienen etiqueta ES/EN en la arena**: se añaden aquí.
- **Dónde está el cursor** (`src/ui/Arena.tsx`): `tiempo` (s), `tickCifras = floor(tiempo / pasoS)`,
  `enDirecto`, `bufferActivo`, `preparandoPartido`, `estadoDirecto`. La emisión en búfer
  empuja el cursor con `alTiempo` (`Arena.tsx:300`); el `RelojBuffer` queda en `preparando` con
  `segundo = 0` hasta tener `BUFFER_ARENA.segundos` (20) de reserva (`buffer.ts:36–47`); la
  vista «preparada» genera todo con el cursor en 0; un registro cargado arranca pausado en 0 y
  «Volver al inicio» devuelve a 0. **El cursor en el tick 0 es el único estado «antes del
  saque» en las cuatro vistas**: no hace falta un estado nuevo.
- **Orden del tablero** (`Arena.tsx:257–298`): aviso de vista previa → `ArenaMarcador` →
  `.arena-match-clock` → `.arena-pitch-wrap` → `.arena-direction` → `arena-pitch-live-status` →
  `arena-restart` → `.arena-referee-info` → transporte → `ArenaCifras`. El 055 § 7.2 ya fijó
  «después de `.arena-direction`, nunca sobre la cancha» (los e2e pulsan fichas en el tick 0).
  El árbol de trabajo tiene el bloque A del 055 (escudos, `identidad`) y **no** el Z2 (sala de
  control en el acompañante): la tarjeta vive dentro de `.arena-board` y no depende de dónde
  quede la configuración.
- **Voz en búfer** (`src/ui/ArenaEmisionBuffer.tsx`): la narración está **apagada por defecto**
  («Activar narración»). Al activarla se pide una `entrada` (`entradaTick`) cuyo texto es
  `comentarioEditorial(…, entrada = true)`; en el tick 0 con saque de centro vigente dice
  «{equipo} prepara el saque de centro.» (`editorial.ts:86–91`). `aperturaPendiente` impide que
  un invitado suene antes de esa entrada (`turnos.ts:95`). Un invitado solo arranca sin fuente
  activa (las reservas cuentan), en calma, separado `MESA_ARENA.separacionInvitadosS` (6 s)
  del anterior, alternando roles, antes de `caducidadInvitadoS(tema)` (12 s; 20 s tras gol), y
  nunca interrumpe; una noticia del narrador (prioridad ≥ 35, incluido el saque de centro) sí
  interrumpe a un invitado (`planVozBuffer`, `buffer.ts:62`). Las variantes se eligen por la
  ventana conocida hasta la próxima noticia (`varianteElegible`), **sin saber si el reloj de
  presentación está detenido**: en `preparando` el cursor no avanza, pero `horizonteS` sigue
  midiendo hasta la primera noticia del prefijo. El consumidor pide una variante de invitado a la
  vez y, al reactivar la voz, termina las intervenciones con `tick < tick` de activación
  (`ArenaEmisionBuffer.tsx:139`). Un 429 o fallo de red se reintenta; un 409 es final
  (`esperaReintentoInvitado`).
- **Tiempo real antes del saque en búfer**: la producción llena los primeros 20 s sin esperar
  (`RitmoProduccionBuffer`); con controladores programados tarda ≈ 1–2 s; con LLM, dos rondas
  de decisión (ticks 0 y 150) medidas en 3–11 s cada una (smokes del 052). Así que `preparando`
  dura entre ≈ 2 y ≈ 25 s, y además el espectador tiene que pulsar «Activar narración». **No
  existe una ventana fija de 20 s para hablar**; el diseño no puede depender de ella (§ 2.2).
- **Diario e intervenciones** (`src/arena/sesiones.ts`, `mesa.ts`): las candidaturas se publican
  una vez en el diario (`tipo: "intervencion"`); `registrarGrabacion` (sesión de un ejemplo o
  archivo cargado, `sesiones.ts:234`) publica `sesion`, `inicio`, rondas, un `avance` y
  `terminada`, **sin intervenciones**; `ArenaNarracion` (modo `completo`) inserta las del diario
  tras el primer tramo cuyo `hastaTick ≥ tick` (`ArenaNarracion.tsx:111–115`). La ruta
  `/relato` con `intervencion` lee del diario (`intervencionPublicada`, 404 si no está) y
  sintetiza con clase `"invitado"` contra la bolsa `bolsaSpeechInvitados` (16 solicitudes /
  4.800 c de SSML por encuentro, `rechazoCuotaVoz`), ya justa a 180 s ES+EN (deuda del 048).
  `vistaPublicada(id, 0)` funciona en cuanto existe `inicio` (`sesiones.ts:280–296`).
- **Diálogo** (`src/arena/dialogo.ts:262–346`): `comprobarTurnos` exige que todo turno del
  narrador sea una plantilla de `MESA_ARENA` reconstruible con `{nombre}/{jugador}/{accion}`
  (D1) y **sin oraciones** (D5), y que cada oración del estadista sea un `hecho` `estadista:*`
  (D5). Una línea de alineaciones del narrador no puede pasar esas reglas tal cual: la previa
  necesita su propia comprobación (§ 3.6).
- **Transcripción** (`src/arena/transcripcion.ts`): clases cerradas
  `plantilla-sin-verificar | respaldo-verificado | llm-aprobado | dato-determinista | marco-de-dialogo`;
  los turnos del narrador se rotulan `marco-de-dialogo` y toda línea con `turnos` lleva
  `d: aprobada`; el orden canónico es `[tick, origen (relato 0 < comentario 1 < intervención 2), posición, k]`,
  así que en el tick 0 «Comienza el partido…» precede a cualquier intervención.
- **E2e con línea de tiempo controlada**: `e2e/arena-mesa.spec.ts:1–95` simula `/emision`
  (instantánea con `intervenciones`), `/eventos` (SSE con todas las publicaciones), `/herramientas`
  y `/relato` (WAV sintético de duración fija por `wavMono`), instrumenta `AudioContext` y lee el
  transcript por `MutationObserver`. `arena-buffer.spec.ts:70–74` deja la emisión en
  `ejecutando` con un SSE de solo `keepalive`: así el reloj queda en `preparando` todo el test.
- **Lista cerrada de selectores** vigente: la del 047 (§ Restricciones) más 049–055
  (`arena-stats`, `arena-downloads`, `arena-mesa-*`, `arena-voice-transcript`,
  `arena-narration-*`, `arena-player`, `arena-roster-person`, `arena-bench-person`,
  `arena-restart`, `arena-pitch`, `arena-clock`, `arena-buffer-status`, …). La tarjeta no reutiliza
  ninguno de esos `data-testid` en sus botones ni fichas.

## 2. Dirección y decisiones

**«Salen los equipos»**: antes del saque, la cancha muestra el partido que va a empezar como lo
hace una transmisión: dos tarjetas con escudo, nombre, formación dibujada, once con dorsal y
apellido, capitán, técnico, banquillo y una línea de condiciones y árbitro. La mesa lo presenta
en voz con el lenguaje de siempre (narrador → estadista), y todo lo que se dice está en el
registro. Al rodar el balón, las tarjetas desaparecen y la cancha vuelve a ser la imagen.

### 2.1 Decisiones de diseño (cerradas)

1. **Un solo origen de verdad, puro y compartido**: `src/arena/previa.ts` deriva **del registro**
   tanto el contenido de la tarjeta (`previaVisual`) como las tres intervenciones habladas
   (`previaPartido`). La previa **no entra en el diario del servidor**: el cliente la deriva del
   `registro` que ya tiene y el servidor la vuelve a derivar del prefijo publicado al sintetizar.
   Así funciona igual en una sesión en vivo, en una grabación registrada (`registrarGrabacion`,
   que no publica intervenciones), en los tres ejemplos públicos y en un archivo cargado, sin
   tocar el formato ni los fixtures. Dos espectadores ven y oyen la misma previa.
2. **Visible exactamente mientras el cursor está en el tick 0** (`tickCifras === 0`), en las
   cuatro vistas, con un botón para plegarla; se desmonta en cuanto el cursor avanza. Sin
   animación de entrada ni salida.
3. **La voz es best-effort en búfer y completa en la repetición.** El reloj de presentación no se
   toca (038: solo los datos limitan su avance). La previa hablada son tres intervenciones del
   estadista en el tick 0 con sus propias reglas de turno (§ 5.1); en `preparando` (reloj
   detenido) se piden y suenan **completas** sin mirar la ventana; al rodar el balón, lo que
   quede suena en los huecos de calma hasta caducar a `PREVIA_ARENA.caducidadS` (30 s) y el
   saque de centro corta lo que esté sonando, como cualquier noticia. En «Escuchar desde el
   inicio» las tres piezas se insertan **antes** del primer tramo del narrador.
4. **Sin comentarista ni LLM en la previa.** Un «análisis previo» con V1–V8 costaría una llamada
   del presupuesto de 12 por sesión y hasta cuatro solicitudes de la bolsa de invitados, y lo
   único que un LLM añade sobre los datos de la plantilla es opinión o pronóstico, que V1–V8
   rechazan o dejan pasar según la frase (deuda conocida del verificador). Toda la previa es
   plantilla determinista con pruebas; la transcripción la rotula como tal.
5. **Nivel de detalle hablado**: formación, capitán, nivel medio y técnico por equipo; condiciones,
   árbitro y perfiles de ataque/defensa de ambos. **No se leen los 22 nombres**: a 9,5 c/s
   (`MESA_ARENA.dialogo.caracteresPorSegundoVoz`) once nombres son ≈ 25 s por equipo, más que
   `VOZ_BUFFER.duracionMaxS` (24 s) para un solo clip. Los nombres están en la tarjeta y en la
   descripción; la voz dice lo que una transmisión lee en voz alta.
6. **Comprobación propia**: `comprobarPrevia(intervencion, registro)` vuelve a derivar la previa
   del registro y exige igualdad exacta de textos, oraciones, hechos y evidencia; `comprobarTurnos`
   delega en ella cuando `forma === "previa"`. La transcripción rotula estas líneas
   `dato-determinista` con `d: no-aplica` (no son un intercambio compuesto) y las ordena antes
   del relato del tick 0.

### 2.2 Presupuesto de tiempo por vista (decisión)

| Vista | Reloj | Tarjeta | Voz de la previa |
| --- | --- | --- | --- |
| Búfer, `preparando` (≈ 2–25 s reales, según controladores) | detenido en 0 | visible | Solo si la narración está activa: entrada del narrador («… prepara el saque de centro») y después las piezas **completas**, en orden, separadas `PREVIA_ARENA.separacionS` (1,2 s); sin esperar la calma de 6 s ni mirar la ventana. Lo que no quepa sigue en la fila siguiente. |
| Búfer, `reproduciendo` hasta `caducidadS` (30 s de partido) | corre | oculta desde el primer avance del cursor | Las piezas restantes arrancan en huecos de calma como cualquier invitado (variante por ventana, nunca interrumpen, el saque y las noticias las cortan); a los 30 s caducan sin sonar. Activar la voz dentro de esos 30 s también las pide. |
| Vivo «preparada» (crear partido guardado) | 0 mientras genera | visible | No hay emisión de voz; al terminar, «Escuchar desde el inicio». |
| Guardado / ejemplo / archivo cargado | 0 hasta Reproducir | visible; se oculta al reproducir; vuelve con «Volver al inicio» o al arrastrar a 0 | «Escuchar desde el inicio»: las tres piezas completas **antes** del primer tramo, con el cursor detenido en 0 (tramo de ancho cero del 045 v3.1). |
| `directo` (presentación heredada) | avanza con cada `avance` | visible hasta el primer avance | Solo texto en la Mesa (045: ni vivo ni directo sintetizan invitados). |

Duración hablada estimada (`estimarDuracionS`): pieza por equipo 125–185 caracteres → 13–19 s;
pieza de condiciones 150–200 → 16–21 s; previa completa en la repetición ≈ 45–60 s. En búfer con
controladores programados, en la práctica se oirá la primera pieza (si la voz ya estaba
activa) y el resto en las primeras calmas; con LLM, dos piezas antes del saque es lo esperable.
Se declara como límite (§ 12); el canal garantizado es la tarjeta.

## 3. Datos y voz — `src/arena/previa.ts` (puro, sin DOM, sin red, sin LLM)

```ts
import type { FormacionArena, JugadorArena, RegistroArena } from "./tipos";
import type { IntervencionArena } from "./protocolo";
import type { Lado } from "../sim/tipos";

export interface PuestoPrevia { puesto: string; jugador: JugadorArena; x: number; y: number }   // x,y en unidades de la tarjeta (§ 4.2)
export interface EquipoPrevia {
  lado: Lado; nombre: string; formacion: FormacionArena; puestos: PuestoPrevia[];            // 11, en el orden de puestos(formacion)
  capitan: JugadorArena | null; entrenador: { nombre: string; perfil: string; preferidas: FormacionArena[] } | null;
  banco: JugadorArena[]; nivelMedio: number;                                                   // media redondeada del nivel del once
  perfiles: { perfil: string; n: number }[];                                                   // conteo de personalidad.perfil del once, desc.; [] en v1
  ataque: number; defensa: number; estilo: "posesion" | "contragolpe" | "presion";
}
export interface PreviaVisual {
  equipos: Record<Lado, EquipoPrevia>;
  condiciones: { clima: string; temperaturaC?: number; superficie: "natural" | "sintetica"; cesped?: "corto" | "alto" } | null;
  arbitro: string | null;
}
export function previaVisual(registro: RegistroArena): PreviaVisual;
/** Las tres intervenciones habladas, en orden: previa:1-local:0, previa:2-visita:0, previa:3-condiciones:0. */
export function previaPartido(registro: RegistroArena): IntervencionArena[];
export const esPrevia = (i: Pick<IntervencionArena, "id" | "forma">) => i.forma === "previa" || i.id.startsWith("previa:");
/** Re-deriva y compara; devuelve motivos (vacío = igual). */
export function comprobarPrevia(i: IntervencionArena, registro: RegistroArena): { regla: "P1"; detalle: string }[];
export function apellidoCorto(nombre: string): string;   // § 4.3
```

### 3.1 Derivación visual

- `formacion = registro.config.formaciones[lado]` (autoritativa para el inicio; `inicial.entrenadores`
  la repite). Para cada `puesto` de `puestos(formacion)`, el jugador es el único de
  `inicial.jugadores` con ese `lado` y `puesto`; si falta o sobra alguno (registro corrupto), la
  función lanza `Error("Alineación inconsistente")` y la interfaz **no muestra** la tarjeta (sin
  romper la página: `Arena.tsx` envuelve la derivación en `useMemo` con `try` y devuelve `null`).
- `x, y` salen de `anclas(formacion, "local", "base")[puesto]` (siempre orientación local, en
  metros) proyectadas a la tarjeta (§ 4.2). Los dos equipos se dibujan igual, portero abajo.
- `capitan = inicial.jugadores.find(lado && capitan) ?? null`; `entrenador = config.entrenadores?.[lado] ?? null`
  (solo `nombre`, `perfil`, `preferidas`); `banco = inicial.banco?.filter(lado) ?? []`;
  `nivelMedio = Math.round(media(once.nivel))`; `perfiles`: conteo de `personalidad.perfil`
  ordenado por `n` desc. y, a igual `n`, por orden de `perfilesJugador`; `ataque/defensa/estilo`
  de `config.partido[lado]`.
- `condiciones = config.partido.condiciones ?? null` (solo esos campos); `arbitro = inicial.arbitro?.nombre ?? null`.

### 3.2 Las tres piezas habladas

Cada pieza es una `IntervencionArena` con `rol: "estadista"`, `tick: 0`, `tema: "previa"`,
`forma: "previa"`, `modo: "determinista"`, `audit: []`, `turnos` materializados (ES y EN
paralelos) y `turnosBreve` (una variante de un turno). Los turnos del narrador llevan
`funcion: "dato"` y **sí** llevan `oraciones` (la regla D5 del 048 no aplica a la forma
`previa`; § 3.6). Ninguna plantilla de `MESA_ARENA.dialogo` se usa: las de la previa viven en
`PREVIA_ARENA.plantillas` (§ 6) y se rellenan solo con valores del registro.

| Pieza · id | Turno 1 (narrador) | Turno 2 (estadista) | Breve |
| --- | --- | --- | --- |
| `previa:1-local:0` | `alineacion`: «Así sale {equipo}, en {formacion}: {capitan} lleva el brazalete.» / «Here is {equipo}, in a {formacion}: {capitan} wears the armband.» — sin capitán (v1): «Así sale {equipo}, en {formacion}.» / «Here is {equipo}, in a {formacion}.» | `plantel`: «Once de nivel medio {nivel}; en el banquillo, {entrenador}, {perfil}.» / «A starting eleven with an average ability of {nivel}; {entrenador} in the dugout, {perfil}.» — sin entrenador: «Once de nivel medio {nivel}.» / «A starting eleven with an average ability of {nivel}.» | solo el turno 1 |
| `previa:2-visita:0` | ídem para la visita | ídem | solo el turno 1 |
| `previa:3-condiciones:0` | `condiciones`: «Arbitra {arbitro}. {clima}{temperatura} y {superficie}.» / «{arbitro} is the referee. {clima}{temperatura} and {superficie}.» — sin árbitro: se omite «Arbitra …»; sin condiciones: se omite la segunda frase; sin ninguno de los dos: **no hay turno 1** | `perfiles`: «Perfiles de equipo: {local}, ataque {a1} y defensa {d1}; {visita}, ataque {a2} y defensa {d2}.» / «Team profiles: {local}, attack {a1} and defence {d1}; {visita}, attack {a2} and defence {d2}.» | solo el turno 2 |

Valores: `{formacion}` tal cual («4-3-3»; en voz Speech lo lee bien como cifras separadas por
guion, comprobado en los cantos del 050 con «uno a cero»; no se convierte a palabras); `{perfil}`
= `etiquetasEntrenador[perfil][idioma]` en minúscula inicial; `{clima}` y `{superficie}` de
`PREVIA_ARENA.textos` (§ 6); `{temperatura}` = «, {n} grados» / «, {n} degrees» solo si
`temperaturaC` existe. En una pieza por equipo, `{equipo}` es el nombre del club; nunca se
abrevia ni se traduce.

**Escalera de la previa** (determinista, misma para ES y EN, anotada en
`auditDialogo.escalones`), mientras `max(ES, EN)` del texto de la variante supere
`MESA_ARENA.maxCaracteresIntervencion` (210): 1) piezas 1–2: quitar «, {perfil}»; pieza 3:
quitar «{temperatura}»; 2) quitar el turno del estadista (piezas 1–2) o del narrador (pieza 3):
la completa pasa a coincidir con la breve y `turnosBreve` se omite (variante colapsada del
048 v1.1). Cada oración cabe además en `MESA_ARENA.maxCaracteresOracion` (200) por
construcción (prueba sobre fixtures y 60 semillas). Invariante probada:
`estimarDuracionS(turnos) ≤ VOZ_BUFFER.duracionMaxS` en todas las semillas.

### 3.3 Oraciones, hechos y evidencia

Cada turno tiene exactamente una oración: `{ texto_es, texto_en, hecho, apoyo: [] }`. El
`hecho` es un `HechoVerificable` `{ id, tipo: "accion_arena", texto_es, texto_en, eventos: [], relevancia: 50, datos }`
con ids `previa:alineacion:{lado}`, `previa:plantel:{lado}`, `previa:condiciones`,
`previa:perfiles` y `datos` con todos los valores sustituidos (`equipo`, `formacion`,
`capitan`, `nivel`, `entrenador`, `perfil`, `arbitro`, `clima`, `temperatura_c`, `superficie`,
`ataque_local`, …). Evidencia por oración (`EvidenciaMesa`): `{ eventos: [], intervalo: [0, 0], fuente }`
con `fuente: "inicial"` para alineación, capitán y nivel, y `fuente: "config"` para
entrenador, condiciones, árbitro y perfiles (valor nuevo del campo libre `fuente`, documentado
en `protocolo.ts`). Así la Mesa y la transcripción muestran la procedencia como con cualquier
dato del estadista («intervalo 0,0 s · inicial»).

### 3.4 Determinismo y estabilidad

`previaPartido` depende solo de `config` e `inicial`: dos llamadas, dos clientes y el servidor
coinciden byte a byte; las publicaciones `avance` no la cambian (`Arena.tsx` la memoiza por
`[registro.config, registro.inicial]`). Los ids empiezan por `previa:` y no colisionan con el
diario (`${rol}:${tema}:${tick}` con `rol ∈ comentarista | estadista`).

### 3.5 Registros v1 y degradación

Sin capitán, entrenador, banco ni árbitro: la tarjeta omite esas filas; las piezas 1–2 quedan
con el turno del narrador sin capitán y el estadista con solo el nivel; la pieza 3 queda con el
turno de perfiles (ataque/defensa/estilo existen en todo `SimConfig`). Nunca se inventa un
valor por defecto que no esté en el archivo.

### 3.6 Comprobación

`comprobarPrevia(i, registro)` reconstruye `previaPartido(registro)`, busca la pieza con el
mismo `id` y compara `toEqual` (`turnos`, `turnosBreve`, `oraciones`, `hechos`, `evidencia`,
`forma`, `tema`, `tick`, `rol`); cada diferencia es un motivo `P1` con la ruta del campo.
`comprobarTurnos` (`dialogo.ts`) gana una primera línea:
`if (i.forma === "previa") return comprobarPrevia(i, registro).map(m => ({ regla: "D1", detalle: `previa: ${m.detalle}` }))`
(D1 = «referencia sin procedencia»: una previa que no se reconstruye no procede del registro).
El tipo `AuditDialogo.motivos[].regla` no cambia. `FormaDialogo` gana `"previa"`; la etiqueta
`formas.previa` = «previa» / «pre-match» en `ROTULOS_TRANSCRIPCION`.

## 4. Tarjeta de alineaciones — `src/ui/ArenaPrevia.tsx` (Bloque A)

### 4.1 DOM

Se renderiza en `Arena.tsx` **inmediatamente después de `.arena-direction`** y antes de
`arena-pitch-live-status`, solo cuando `previaVisible = tickCifras === 0 && previa !== null`:

```tsx
<section className="arena-lineups" data-testid="arena-lineups" aria-labelledby="arena-lineups-title" data-collapsed={plegada || undefined}>
  <div className="arena-lineups-head">
    <h2 id="arena-lineups-title">{t("Starting line-ups", "Alineaciones")}</h2>
    <p className="arena-lineups-conditions">{chips}</p>                         {/* § 4.4; solo con datos */}
    <button type="button" className="btn" data-testid="arena-lineups-toggle" aria-expanded={!plegada} aria-controls="arena-lineups-body" onClick={…}>{plegada ? t("Show line-ups", "Mostrar alineaciones") : t("Hide line-ups", "Ocultar alineaciones")}</button>
  </div>
  {!plegada && <div className="arena-lineups-grid" id="arena-lineups-body">
    {lados.map(lado => <article className={`arena-lineup arena-${lado}`} data-testid="arena-lineup" data-side={lado} key={lado}>
      <header className="arena-lineup-head"><Escudo identidad={identidad[lado]} size={IDENTIDAD_ARENA.escudoPx.plan} /><h3>{nombre}</h3><span className="arena-lineup-shape tnum">{formacion}</span></header>
      <svg className="arena-lineup-pitch" viewBox={`0 0 ${T.ancho} ${T.alto}`} aria-hidden="true" focusable="false">…</svg>   {/* § 4.2 */}
      <ol className="arena-lineup-list">{puestos.map(p => <li key={p.jugador.id}><button type="button" className="arena-lineup-player" data-testid="arena-lineup-player" data-player={p.jugador.id} aria-pressed={seleccionado === p.jugador.id} onClick={() => seleccionar(p.jugador.id)}><span className="tnum">{p.jugador.dorsal}</span><strong>{p.jugador.nombre}</strong><span className="arena-muted">{p.puesto}{p.jugador.capitan ? ` · ${t("Captain", "Capitán")}` : ""}</span></button></li>)}</ol>
      {entrenador && <p className="arena-lineup-coach"><span className="overline">{t("Coach", "DT")}</span> {entrenador.nombre} · {etiquetasEntrenador[entrenador.perfil][idioma]}{preferidas.length > 1 && ` · ${t("Prefers", "Prefiere")} ${preferidas.join(", ")}`}</p>}
      <p className="arena-lineup-traits"><span className="overline">{t("Key traits", "Rasgos")}</span> {t("Average ability", "Nivel medio")} {nivelMedio} · {t("Attack", "Ataque")} {ataque} · {t("Defence", "Defensa")} {defensa} · {estilo}{perfiles.slice(0, 2).map(p => ` · ${etiquetasPerfil[p.perfil][idioma]} ×${p.n}`)}</p>
      {banco.length > 0 && <details className="arena-lineup-bench"><summary>{t(`Bench (${banco.length})`, `Suplentes (${banco.length})`)}</summary><ul>{banco.map(j => <li key={j.id}><button type="button" className="arena-lineup-player" data-player={j.id} onClick={() => seleccionar(j.id)}>{j.dorsal} · {j.nombre}<span className="arena-muted">{j.posicionNatural ?? ""}</span></button></li>)}</ul></details>}
    </article>)}
  </div>}
  <p className="arena-muted arena-lineups-note">{t("Synthetic indices from the match run (1–100); fictional clubs and players.", "Índices sintéticos del registro (1–100); clubes y jugadores ficticios.")}</p>
</section>
```

- `plegada` es estado de `Arena.tsx`, se reinicia a `false` con cada `cargaId`. Plegar deja la
  cabecera (título, chips y botón); al avanzar el cursor la sección entera se desmonta y vuelve
  si el cursor regresa a 0 (desplegada).
- Pulsar un jugador llama a `setSeleccionado` (misma ficha y cifras del 049). Los botones **no**
  llevan `data-testid="arena-player"`, `arena-roster-person` ni `arena-bench-person`.
- El SVG es `aria-hidden`: la lista `ol` es la versión legible (dorsal · nombre · puesto ·
  Capitán). Los escudos siguen `aria-hidden` (055). Ningún texto oculto.
- El 055 § 7.1 (cabecera de jornada) queda cubierto por los chips de § 4.4: no se añade
  `arena-matchday`.

### 4.2 Media cancha (geometría; constantes en `PREVIA_ARENA.tarjeta`, § 6)

`viewBox 0 0 68 64`, ancho = 68 (metros de ancho reales), portería propia abajo. Proyección de
un ancla `(x, y)` en metros (orientación local): `cx = y`, `cy = lineaFondo − x · escalaLargo`
con `lineaFondo = 60` y `escalaLargo = 0.6` (54 unidades para los 90 m útiles: POR en 56,4;
línea más alta de cinco en 6,45; la mediana queda en 28,5 y se dibuja con su arco). Marcas:
borde del campo (`rect` 0–68 × 0–60), área (40,32 × 9,9 centrada, sobre la línea de fondo),
área chica (18,32 × 3,3), punto de penal (`cy = 60 − 11 · 0.6`), línea de medio campo en 28,5 y
semicírculo central (r = 9,15 · 0,6 hacia abajo). Clases `arena-grass`, `arena-lines`,
`arena-spot` si sus reglas no están acotadas al SVG principal (Opus lo verifica en
`globals.css`; si lo están, se añaden reglas `.arena-lineup-pitch .arena-grass {…}` con los
mismos tokens `--ar-grass-a` y `--ar-line`). Sin franjas.

Ficha por puesto (`<g className="arena-lineup-slot" data-slot={puesto} data-player={id} transform="translate(cx cy)">`,
atributo SVG, no CSS): `<g className="arena-token"><circle className="arena-kit" r={radioFicha} /><text>{dorsal}</text>{capitan && <g className="arena-captain-mark">…</g>}</g>`
con `radioFicha = 3.2` (las reglas `.arena-local .arena-token > .arena-kit` del 055 v1.1 § 2
tiñen la camiseta sin regla nueva; la marca de capitán reutiliza `.arena-captain-mark`,
escalada ×1,6 con `transform` de atributo) y debajo
`<text className="arena-lineup-name" y={desplazamientoNombre} textAnchor="middle" textLength={…} lengthAdjust="spacingAndGlyphs">{apellidoCorto(nombre)}</text>`
con `desplazamientoNombre = 5.2`, `font-size` 2,6 unidades (≈ 12 px a 360 px, ≈ 14 px en
escritorio), `fill: var(--ar-bug-ink)` (blanco sobre césped: 5,07/5,79 medidos en el 055) y
`textLength` **solo si** el ancho estimado (`0.58 · caracteres · 2.6`) supera
`anchoNombreMax = 12.5` unidades (cinco jugadores en línea: 13,6 de separación). El dorsal usa
el `fill` de la camiseta (`tinta`) por la regla existente `.arena-token > text`.

### 4.3 Apellido corto

`apellidoCorto(nombre)`: última palabra del nombre (`split(/\s+/).at(-1)`), sin truncar; si el
nombre tiene una sola palabra, esa. Mayúsculas y acentos intactos. Es solo el rótulo del
dibujo; la lista lleva el nombre completo.

### 4.4 Chips de condiciones y árbitro

En `.arena-lineups-conditions`, chips (`--chip`) con lo que exista, en este orden:
`{clima}{ · N °C}`, `{superficie}`, `{Árbitro: nombre}`. Textos ES/EN de `PREVIA_ARENA.textos`
(los mismos de la voz: «Cielo despejado», «Lluvia», «Césped natural corto», …) con «Referee» /
«Árbitro». Sin semilla (ya está en el formulario), sin estadio ni competición.

### 4.5 CSS (solo `globals.css`, tokens del 047/055)

- `.arena-lineups { margin-top: var(--ar-s4); padding: var(--ar-s4); background: var(--ar-surface-2); border: 1px solid var(--line); border-radius: var(--ar-r); }`
- `.arena-lineups-head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ar-s2) var(--ar-s3); }` con el botón `margin-left: auto` y 44 px de alto mínimo.
- `.arena-lineups-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ar-s4); }`; `@media (max-width: 719px) { grid-template-columns: 1fr; }`.
- `.arena-lineup-pitch { display: block; width: 100%; height: auto; border-radius: 6px; }`
- `.arena-lineup-list { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ar-s1) var(--ar-s3); margin: var(--ar-s3) 0 0; padding: 0; list-style: none; }`; a 360 px una columna. Botones 44 px de alto, `text-align: left`, foco `outline: 2px solid var(--ar-select)`.
- Sin `transition`, sin `animation`, sin `transform` CSS. Movimiento reducido: nada que añadir.
- Objetivos medibles a 1440×900 (claro y oscuro) y 360×740: sin desborde; `scrollWidth ≤ 360`; la tarjeta no cambia `marcadorAbajo` ni `canchaAbajo` del 055 (está debajo). Se registra `alineacionesAbajo` (fondo de `.arena-lineups`) en el script de capturas, solo informativo.

### 4.6 Textos nuevos (ES/EN, lista cerrada, no usados por e2e existentes)

«Starting line-ups» / «Alineaciones»; «Hide line-ups» / «Ocultar alineaciones»; «Show line-ups» /
«Mostrar alineaciones»; «Coach» / «DT»; «Prefers» / «Prefiere»; «Key traits» / «Rasgos»;
«Average ability» / «Nivel medio»; «Attack» / «Ataque»; «Defence» / «Defensa»; «Bench (n)» /
«Suplentes (n)»; «Captain» / «Capitán» (ya existe); estilos «Possession» / «Posesión»,
«Counter-attack» / «Contragolpe», «Pressing» / «Presión»; la nota de § 4.1; los textos de
`PREVIA_ARENA.textos`.

## 5. Voz (Bloque B)

### 5.1 Coordinador (`src/arena/turnos.ts`, puro)

1. `caducidadInvitadoS(tema)`: `tema === "previa"` → `PREVIA_ARENA.caducidadS` (30).
2. `EntradaTurno.ultimoInvitado` gana `tema?: string`; la separación exigida entre el fin del
   invitado anterior y una candidata es `PREVIA_ARENA.separacionS` (1,2) **si ambos son previa**;
   si no, `MESA_ARENA.separacionInvitadosS` (6) como hoy. La separación se evalúa por candidata
   (hoy es una sola comprobación global: se mueve dentro del bucle sin cambiar el resultado
   para candidatas no previa).
3. Orden dentro del rol: por `tick` desc. y, a igual tick, por `id` **ascendente** (las tres
   piezas comparten el tick 0: `1-local` < `2-visita` < `3-condiciones`). Hoy el empate depende
   del orden de inserción.
4. `EntradaTurno.relojDetenido: boolean` (el consumidor pasa `estado ∈ {preparando, recuperando}`
   del `RelojBuffer`). Para una candidata previa con `relojDetenido`, `varianteElegible` recibe
   `Number.POSITIVE_INFINITY` como ventana (completa si está decodificada). Las demás candidatas
   siguen usando `ventanaS`: ninguna prueba del 045/048 cambia.
5. `esperaReintentoInvitado(fallo, reintentos, edad, tema)`: un `409` es reintentable **solo**
   con `tema === "previa"` (la vista publicada aún no tiene `inicio`; ventana de milisegundos).

`descartesTurno`, la calma (`calmaMinS`, `pausaVigente`), la alternancia de roles, la regla de
«nunca interrumpir» y `aperturaPendiente` no cambian: la entrada del narrador precede a la previa.

### 5.2 Consumidor (`ArenaEmisionBuffer.tsx`)

- Recibe `intervenciones` ya **fusionadas** desde `Arena.tsx`: `mesa = [...previa, ...intervenciones]`
  (§ 5.5). No conoce nada especial salvo pasar `relojDetenido` y `ultimoInvitado.tema`.
- Petición de variantes (`pedirVariante`): para una previa con `relojDetenido`, pide la
  **completa** directamente (sin la breve antes); con el reloj en marcha, la regla del 048 v1.1 (9).
- La caducidad, los reintentos y la terminación al reactivar siguen las reglas generales con las
  constantes de la previa. Las reservas de voz (041) se comportan igual: si una reserva está
  sonando, la previa espera a que termine (nunca se superponen voces).

### 5.3 Ruta `/api/arena/sesiones/[id]/relato`

Con `intervencion` que empiece por `previa:`: `const registro = await gestor.vistaPublicada(id, 0)`
y `intervencion = previaPartido(registro).find(i => i.id === p.intervencion)` (404 «Intervención no
publicada» si no existe). Lo demás igual: ventana `desdeTick = hastaTick = 0`, `relatoIntervencion`
(ya sirve turnos materializados: un fragmento por turno, roles alternos, `tipoRelato: "invitado"`),
`prepararVoz` con las voces del catálogo y síntesis vía `gestor.extra(…, clase = "previa")`.
`segmentoVozValido` del consumidor pasa sin cambios.

### 5.4 Presupuesto de Speech

`ClaseVoz` gana `"previa"`. `rechazoCuotaVoz` añade una rama: las síntesis `previa` consumen
**solo** de `PREVIA_ARENA.bolsaSpeech` (12 solicitudes / 7.200 caracteres de SSML por encuentro:
3 piezas × 2 variantes × 2 idiomas, ≈ 600 c de SSML cada una) y nunca de la del narrador ni de
la de invitados, ni al revés (patrón de la v1.3 del 048). Coste máximo añadido: esa bolsa
(≈ 0,12 USD por encuentro a precio de lista de voz neural). El tope diario de `extra` (800 audios
/ 120.000 c) no cambia; la previa suma a él como cualquier audio.

### 5.5 `Arena.tsx`: una sola fusión

```ts
const previa = useMemo(() => { try { return previaPartido(registro); } catch { return []; } }, [registro.config, registro.inicial]);
const previaCarta = useMemo(() => { try { return previaVisual(registro); } catch { return null; } }, [registro.config, registro.inicial]);
const mesa = useMemo(() => [...previa, ...intervenciones], [previa, intervenciones]);
```

`mesa` se pasa a `ArenaEmisionBuffer`, `ArenaNarracion`, `ArenaMesa` y `ArenaDescargas` en lugar de
`intervenciones`. En la Mesa, la tarjeta del estadista muestra en el tick 0 su turno de la previa
(«dato del partido · 0,0 s · Determinista») con la procedencia «intervalo 0,0–0,0 s · inicial/config»;
los turnos del narrador no aparecen en la Mesa (hoy tampoco los marcos).

### 5.6 Repetición guardada (`ArenaNarracion.tsx`, modo `completo`)

Las intervenciones con `esPrevia` van **antes** del primer tramo (`piezas = [...previa, tramo 0–100, …]`),
cada una como tramo de ancho cero `{ desdeTick: 0, hastaTick: 0 }` (el cursor queda en 0 mientras
hablan). Las demás intervenciones del tick 0 conservan la regla actual (tras el primer tramo). Se
pide siempre `variante: "completa"`. Una pieza que falle u obtenga un clip > `duracionMaxS` se omite
sin romper la pista (regla existente). El WAV del 053 incluye la previa porque es el mismo blob.

### 5.7 Transcripción (`transcripcion.ts`, 053)

Para `i.forma === "previa"`: cada turno es una línea con `rol` del turno, `origen: "intervencion"`,
`modo: "determinista"`, `clase: "dato-determinista"`, `v: no-aplica`, `d: no-aplica`,
`intervencion: { id, tema, forma: "previa", turno, funcion: "dato" }`, evidencia por oración como
hoy (`intervalo [0, 0]`, `fuente`). Orden: la clave de origen de una previa es **−1**, así las
líneas de la previa preceden a «Comienza el partido…» en el tick 0, en el orden de las piezas y de
sus turnos. `ROTULOS_TRANSCRIPCION.nota` añade una frase: «La previa (alineaciones, técnicos y
condiciones) se deriva del registro por plantilla determinista.» / «The pre-match segment (line-ups,
coaches and conditions) is derived from the match run by deterministic template.». El JSON lleva
las tres piezas en `diario.intervenciones` (vienen de `mesa`), con `forma: "previa"`. Nada más cambia.

## 6. Constantes — `src/sim/limites.ts` (comentadas, después de `IDENTIDAD_ARENA`)

```ts
/** Brief 056 · Previa del partido: alineaciones tipo TV y tres piezas habladas derivadas del registro.
 * Los topes de caracteres y la velocidad de voz se LEEN de MESA_ARENA (no se repiten). */
export const PREVIA_ARENA = {
  /** Caducidad (s de partido) de las tres piezas; mayor que la general (12) para cubrir el primer tramo. */
  caducidadS: 30,
  /** Separación (s de audio) entre dos piezas de la previa; entre una previa y otro invitado rige la general (6). */
  separacionS: 1.2,
  /** Bolsa propia de Speech por encuentro: 3 piezas × 2 variantes × 2 idiomas, ≈ 600 c de SSML cada una. */
  bolsaSpeech: { solicitudes: 12, caracteres: 7200 },
  /** Orden y claves de las piezas; el id es `previa:${n}-${clave}:0`. */
  piezas: ["local", "visita", "condiciones"],
  /** Media cancha de la tarjeta, en unidades del viewBox (ancho = metros reales de ancho). */
  tarjeta: { ancho: 68, alto: 64, lineaFondo: 60, escalaLargo: 0.6, largoUtilM: 90, radioFicha: 3.2, fuenteDorsal: 3, fuenteNombre: 2.6, anchoNombreMax: 12.5, desplazamientoNombre: 5.2, anchoPorCaracter: 0.58, escalaCapitan: 1.6, maxPerfilesMostrados: 2 },
  /** Plantillas habladas (ES/EN paralelas). Llaves: equipo, formacion, capitan, nivel, entrenador, perfil, arbitro, clima, temperatura, superficie, local, visita, a1, d1, a2, d2. */
  plantillas: {
    es: {
      alineacion: "Así sale {equipo}, en {formacion}: {capitan} lleva el brazalete.", alineacionSinCapitan: "Así sale {equipo}, en {formacion}.",
      plantel: "Once de nivel medio {nivel}; en el banquillo, {entrenador}, {perfil}.", plantelSinPerfil: "Once de nivel medio {nivel}; en el banquillo, {entrenador}.", plantelSinEntrenador: "Once de nivel medio {nivel}.",
      arbitro: "Arbitra {arbitro}.", condiciones: "{clima}{temperatura} y {superficie}.", temperatura: ", {n} grados",
      perfiles: "Perfiles de equipo: {local}, ataque {a1} y defensa {d1}; {visita}, ataque {a2} y defensa {d2}.",
    },
    en: {
      alineacion: "Here is {equipo}, in a {formacion}: {capitan} wears the armband.", alineacionSinCapitan: "Here is {equipo}, in a {formacion}.",
      plantel: "A starting eleven with an average ability of {nivel}; {entrenador} in the dugout, {perfil}.", plantelSinPerfil: "A starting eleven with an average ability of {nivel}; {entrenador} in the dugout.", plantelSinEntrenador: "A starting eleven with an average ability of {nivel}.",
      arbitro: "{arbitro} is the referee.", condiciones: "{clima}{temperatura} and {superficie}.", temperatura: ", {n} degrees",
      perfiles: "Team profiles: {local}, attack {a1} and defence {d1}; {visita}, attack {a2} and defence {d2}.",
    },
  },
  /** Textos compartidos por la tarjeta y la voz. En la frase hablada van en minúscula salvo al inicio. */
  textos: {
    clima: { es: { despejado: "Cielo despejado", calor: "Calor", lluvia: "Lluvia", frio: "Frío", niebla: "Niebla" }, en: { despejado: "Clear skies", calor: "Heat", lluvia: "Rain", frio: "Cold", niebla: "Fog" } },
    superficie: { es: { natural_corto: "césped natural corto", natural_alto: "césped natural alto", sintetica: "superficie sintética" }, en: { natural_corto: "short natural grass", natural_alto: "long natural grass", sintetica: "artificial surface" } },
    estilo: { es: { posesion: "Posesión", contragolpe: "Contragolpe", presion: "Presión" }, en: { posesion: "Possession", contragolpe: "Counter-attack", presion: "Pressing" } },
  },
} as const;
```

Invariantes probadas desde las constantes: `caducidadS > MESA_ARENA.caducidadInvitadoS`;
`separacionS < MESA_ARENA.separacionInvitadosS`; `bolsaSpeech.solicitudes ≥ piezas.length · 2 · 2`;
cada plantilla ES/EN con las mismas llaves; `tarjeta.lineaFondo − tarjeta.largoUtilM · escalaLargo ≥ 4`
(la línea más alta cabe con su nombre).

## 7. Pruebas exigidas

`src/arena/__tests__/previa.test.ts`:

- **Determinismo y fuentes**: sobre los fixtures `arena-reinicios-v3.json`, `arena-llm-v1.json`,
  `arena-llm-v3.json`, `arena-duelo-v3.json` y 60 semillas (`crearConfigArena({ seed })` +
  `crearEstadoArena`), `previaPartido` es `toEqual` en dos llamadas y tras una publicación `avance`
  (prefijo recortado y completo). Cada valor sustituido existe en el registro: `{capitan}` es el
  `nombre` del jugador con `capitan` de ese lado; `{formacion}` = `config.formaciones[lado]`;
  `{entrenador}`/`{perfil}` de `config.entrenadores`; `{nivel}` = media redondeada; `{arbitro}` =
  `inicial.arbitro.nombre`; `a1…d2` de `config.partido`. **Mutaciones**: cambiar el capitán en una
  copia del registro cambia la pieza 1 y `comprobarPrevia` de la pieza original devuelve un motivo;
  intercambiar los nombres de dos jugadores, cambiar la formación o el clima también.
- **Presupuestos**: para todas las semillas y fixtures, `max(ES, EN)` de cada variante ≤
  `MESA_ARENA.maxCaracteresIntervencion`, cada oración ≤ `maxCaracteresOracion`,
  `estimarDuracionS(turnos) ≤ VOZ_BUFFER.duracionMaxS`; con nombres artificialmente largos
  (registro modificado con nombres de 40 caracteres) la escalera recorta en el orden fijado y lo
  anota en `escalones`; nunca queda un texto vacío.
- **Degradación v1**: `arena-llm-v1.json` → piezas 1–2 con `alineacionSinCapitan` y
  `plantelSinEntrenador`; pieza 3 solo con perfiles; `previaVisual` sin capitán, técnico ni banco.
- **Estructura**: ids y orden de `PREVIA_ARENA.piezas`; `rol: "estadista"`, `tick: 0`,
  `forma: "previa"`, `modo: "determinista"`; turnos alternos; `comprobarTurnos` devuelve `[]`
  para las tres y motivos `D1` con «previa:» para una alterada; `relatoIntervencion` sobre cada
  pieza y variante pasa `segmentoVozValido`; `evidencia[k].fuente ∈ {"inicial", "config"}` e
  `intervalo [0, 0]`.
- **Visual**: `previaVisual` da 11 puestos por lado iguales a `puestos(formacion)`, cada uno con
  el jugador cuyo `puesto` coincide; `x, y` iguales a la proyección de `anclas`; `apellidoCorto`
  («Nombre Apellido» → «Apellido», «Nombre» → «Nombre»); un registro con dos jugadores en el mismo
  puesto lanza «Alineación inconsistente».

`src/arena/__tests__/turnos.test.ts` (ampliación):

- `caducidadInvitadoS("previa")` = `PREVIA_ARENA.caducidadS`; con el reloj detenido una previa
  completa de 19 s es elegible con `ventanaS = 4`; la misma candidata **no previa** elige la breve;
  separación 1,2 s entre dos previas y 6 s entre una previa y un comentarista; empate de tick
  resuelto por id; `esperaReintentoInvitado({ tipo: "http", estado: 409 }, 0, 0, "previa")` > 0 y
  `null` con otro tema. Las pruebas existentes del 045/048 siguen idénticas.

`src/arena/__tests__/mesa-voz.test.ts` (ampliación): `rechazoCuotaVoz` con clase `"previa"`
rechaza al llenar `bolsaSpeech` y **no** altera los rechazos del narrador, del cierre ni de los
invitados (recorridos con y sin previa comparados por separado, patrón v1.3 (1)); la ruta `/relato`
con `intervencion: "previa:1-local:0"` sobre una sesión de `registrarGrabacion` (sin diario)
devuelve 200 con `tipoRelato: "invitado"` y clase `previa` en las reservas; un id `previa:x` desconocido
→ 404.

`src/arena/__tests__/transcripcion.test.ts` (ampliación): con `intervenciones = previaPartido(registro)`
y `hastaTick = 0`, las líneas de la previa están **antes** de «Comienza el partido…», con
`clase: "dato-determinista"`, `d: no-aplica`, `forma: "previa"`, `funcion: "dato"`; el Markdown
rotula «previa» / «pre-match» y la nota nueva; los fixtures existentes del 053 (sin previa) no
cambian ninguna cuenta.

`src/ui/__tests__/arena-previa.test.tsx` (`renderToStaticMarkup`):

- Con `arena-reinicios-v3.json`: dos `article[data-side]`; en cada uno 11 `g.arena-lineup-slot`
  con `data-slot` igual a `puestos(formacion)` y `data-player` del jugador correcto; exactamente
  una `.arena-captain-mark` por lado; 11 botones `arena-lineup-player` con dorsal, nombre y puesto;
  «Capitán» una vez por lado; DT con `etiquetasEntrenador`; `Suplentes (5)`; chips con clima,
  superficie y árbitro; `svg` `aria-hidden="true"`; ningún `data-testid="arena-player"`,
  `arena-roster-person` ni `arena-bench-person` dentro de `.arena-lineups`.
- Con `arena-llm-v1.json`: sin DT, sin banco, sin marca de capitán, sin chips de árbitro; sin errores.
- `Arena` con el fixture renderiza `.arena-lineups` como hermano siguiente de `.arena-direction`;
  con `previaVisual` forzada a lanzar, no hay `.arena-lineups` y el resto del tablero está.
- Sin hex en TSX: `ArenaPrevia.tsx` entra en la lista de la prueba del 055.

`e2e/arena-previa.spec.ts` (serializado con los demás de arena):

1. **Antes del saque, con el reloj detenido** (patrón `arena-mesa.spec`/`arena-buffer.spec:70`):
   `/emision` devuelve el prefijo del `arena-duelo-v3.json` recortado al tick 0 (`final = inicial`,
   `fotogramas = [inicial]`, eventos con `tick ≤ 0`) con `estado: "ejecutando"`, `/eventos` solo
   `keepalive`, `/herramientas` con voz, `/relato`: la `entrada` con WAV de 0,3 s y cada
   `intervencion` `previa:*` con `relatoIntervencion(previaPartido(prefijo), seed, idioma, variante)`
   y WAV de 1,5 s. Se comprueba: `arena-buffer-status` «Preparing broadcast · 0/20 s ready»,
   `arena-clock` «0:00», `arena-lineups` visible con 22 `arena-lineup-player` y 2 `data-side`;
   «Enable narration» → en ≤ 8 s el transcript muestra `data-narration-kind="invitado"` con texto
   «Here is {local}»; las tres piezas arrancan en orden `1-local, 2-visita, 3-condiciones`
   (`instrumentar` + etiquetas), todas con `variante="completa"`, huecos entre piezas
   ≤ `separacionS + 1` s, sin solaparse; las peticiones de `intervencion` no incluyen `variante: "breve"`.
   Clic en un `arena-lineup-player` → `arena-player-card` muestra ese nombre.
2. **Se oculta al rodar el balón** (sin voz): «Saved matches» → «Load AI coaches example»:
   `arena-lineups` visible y `arena-clock` «0:00»; pulsar «Play» → `arena-lineups` `toHaveCount(0)`
   en ≤ 2 s; «Restart» → visible otra vez y desplegada; `arena-lineups-toggle` pliega
   (`aria-expanded="false"`, sin `arena-lineup`) y despliega; a 360×780, oscuro, movimiento
   reducido y español: `scrollWidth ≤ 360`, encabezado «Alineaciones» y «Suplentes (5)» visibles.
3. **«Escuchar desde el inicio» empieza por la previa** (patrón `arena-mesa.spec:262`): sesión
   de grabación del ejemplo (`/api/arena/grabaciones` real) con `/relato` simulado como en (1): las
   tres primeras peticiones llevan `intervencion: "previa:…"` y `variante: "completa"`, luego el
   tramo `0–100`; durante la previa `arena-clock` sigue en «0:00» y `arena-narration-transcript`
   tiene `data-narration-role="estadista"` y `data-narration-tick="0"`; después del primer tramo
   el reloj avanza.

**Mutaciones que deben poner algo en rojo**: previa publicada en el diario en vez de derivada
(prueba de `registrarGrabacion` sin intervenciones + ruta 200); id de pieza desordenado (e2e 1 y
`turnos.test`); separación general aplicada entre previas (e2e 1); breve pedida con el reloj
detenido (e2e 1); previa insertada tras el primer tramo (e2e 3); tarjeta visible con el cursor
> 0 (e2e 2); un nombre inventado o un capitán distinto (`comprobarPrevia`); clase
`marco-de-dialogo` en un turno de la previa (transcripción); cobro a la bolsa de invitados
(`mesa-voz`); `data-testid="arena-player"` en la tarjeta (UI); hex en `ArenaPrevia.tsx`.

## 8. Impacto en e2e y selectores (lista cerrada)

Siguen resolviendo igual, sin tocar `e2e/` salvo el archivo nuevo: `arena.spec.ts:236–254`
(22 `arena-player` y un árbitro: la tarjeta no usa ese testid), `arena-formaciones.spec.ts`
(alineación tablero/acompañante: la tarjeta está dentro del tablero, bajo la cancha),
`arena-buffer.spec.ts` (estados del búfer, continuidad de voz: la previa no suena en esas pruebas
porque sus `/relato` simulados responden 503/404 a `intervencion`, o la emisión arranca con el
cursor > 30 s), `arena-mesa.spec.ts` (los fixtures sirven `intervenciones` propias; la previa
derivada se suma: **Opus verifica** que `cursorEnVentana` y los conteos de fuentes de esas pruebas
toleran tres candidatas más en el tick 0 —caducan a los 30 s y las pruebas arrancan con cortes
≥ 20 s—; si alguna cuenta fuentes exactas en los primeros 30 s, la ruta simulada de esa prueba
responde 404 a `previa:*`, que ya es el comportamiento de «sin invitados en esta prueba»),
`arena-descargas.spec.ts` (el hash del WAV se compara consigo mismo; los conteos del JSON se leen
del archivo), `arena-canto-gol.spec.ts`, `arena-cifras.spec.ts`, `arena-identidad.spec.ts`.
Selectores nuevos: `arena-lineups`, `arena-lineups-toggle`, `arena-lineup[data-side]`,
`arena-lineup-player[data-player]`, `.arena-lineup-slot[data-slot][data-player]`,
`.arena-lineup-name`. Textos accesibles que **no** cambian: todos los existentes.

## 9. Prioridad, orden del día y estimación

Empieza al cerrar el 055 (previsto 23–24 oct). Estimación honesta: **≈ 10 h** en dos bloques.

- **Bloque A · Tarjeta (≈ 5 h), obligatorio**: `previa.ts` (`previaVisual`, `apellidoCorto`) +
  `PREVIA_ARENA` + pruebas 1,5 h; `ArenaPrevia.tsx` + CSS + visibilidad en `Arena.tsx` + prueba de
  UI 2 h; e2e (2) + capturas 1440/360 claro/oscuro en `docs/evidencia/previa-056/` + suites +
  bitácora 1,5 h. Entrega mínima cerrable: criterios 10.1–10.3.
- **Bloque B · Voz (≈ 5 h), solo con A en verde**: `previaPartido`, escalera, `comprobarPrevia`,
  rama en `comprobarTurnos` + pruebas 1,5 h; `turnos.ts` (cinco reglas) + consumidor + fusión en
  `Arena.tsx` + ruta + `rechazoCuotaVoz` + pruebas 1,5 h; repetición guardada + transcripción +
  Mesa + pruebas 1 h; e2e (1) y (3) + smoke local con Speech real de las tres piezas en ES y EN
  (archivar los MP3 y el SSML en `docs/evidencia/previa-056/`) 1 h.

Corte: si A no está en verde el **24 oct a las 18:00**, B pasa al 25 por la mañana; si B no está
en verde el **25 oct a las 18:00**, se entrega solo A y la bitácora lo declara como recorte del 056.
El 26 queda para desplegar, smoke público, regrabar el video y enviar. No se recorta A; si A no
cabe, se escala a Carlos antes de decidir.

## 10. Criterios de aceptación (todos vistos correr)

1. `npm test`, `npm run typecheck`, `npm run build` en verde;
   `npm run e2e -- e2e/arena-previa.spec.ts e2e/arena.spec.ts e2e/arena-formaciones.spec.ts e2e/arena-buffer.spec.ts e2e/arena-mesa.spec.ts e2e/arena-descargas.spec.ts e2e/arena-identidad.spec.ts`
   en verde, serializados; `git diff --stat src/arena/motor.ts src/arena/tipos.ts src/app/api/arena/route.ts public/experimentos src/arena/__fixtures__` vacío.
2. Capturas antes/después a 1440×900 y 360×740, claro y oscuro, de la portada con el ejemplo
   cargado en el tick 0 y tras pulsar Reproducir (sin tarjeta), guardadas en
   `docs/evidencia/previa-056/`; `node docs/evidencia/rediseno-047/contraste.mjs` con los pares
   nuevos (`.arena-lineup-name` `fill` frente a `.arena-lineup-pitch .arena-grass` ≥ 4,5;
   `.arena-lineup-player` texto frente a `.arena-lineups` fondo ≥ 4,5; chips ≥ 4,5) con código 0
   en claro y oscuro.
3. Revisión de alguien distinto del implementador (Fable, Codex o `auditor-adversario`) de la
   tarjeta sobre dos partidos distintos (`arena-llm-v3`, `arena-duelo-v3`) y un v1
   (`arena-llm-v1`): puestos correctos a ojo contra `ArenaContexto` «Formación con nombres».
4. (Bloque B) Smoke local con `ARENA_VOZ=1` y Speech real: partido programado de 60 s en búfer con
   la narración activada **antes** de iniciar; se oyen la entrada y al menos la pieza 1 antes del
   saque o en la primera calma, sin solaparse; «Escuchar desde el inicio» del mismo partido
   reproduce las tres piezas antes de «Comienza el partido», y la transcripción descargada las
   lista primero con clase «dato determinista (sin V1–V8)» y forma «previa». Duración real de
   cada pieza anotada en la bitácora frente a la estimación de § 2.2.
5. Tras desplegar: smoke público del punto 4 sobre la URL pública con un partido LLM; evidencia en
   `docs/evidencia/previa-056/`.

## 11. Fuera de alcance

- Comentarista o cualquier LLM en la previa; pronósticos, favoritismo, «claves del partido».
- Tabla de posiciones, historial, enfrentamientos previos, estadio, competición, público asistente,
  nombres de los suplentes en voz, lectura de los 22 nombres.
- Cambiar el reloj de presentación del búfer (ninguna espera previa al saque), el motor, el
  formato del registro, el validador o los fixtures.
- Alineaciones durante el partido (las cubre `ArenaContexto`) o tras un cambio; túnel, himnos,
  animaciones de entrada; música.
- Previa en `/`, `/match`, `/liga` o en las crónicas históricas.
- Edición manual de alineaciones o formaciones desde la tarjeta.

## 12. Límites honestos y riesgos

- **En búfer la previa hablada es parcial por diseño**: el reloj no espera a la voz (038), la
  narración está apagada por defecto y `preparando` dura entre 2 y 25 s. Lo esperable con LLM es
  oír una o dos piezas antes del saque y el resto en las primeras calmas; con programados, casi
  todo tras el saque; a los 30 s lo pendiente caduca sin sonar. La tarjeta es el canal garantizado;
  la repetición guardada es la previa completa. Si Carlos prefiere una espera fija antes del
  saque, es un brief nuevo (cambia el reloj, `arena-buffer-status` y las medidas del 048).
- **El saque de centro corta la previa**: `reinicio` tiene prioridad 35 = `prioridadInterrupcion`.
  Es la regla de siempre; se acepta para no demorar la noticia. La pieza cortada no se repite.
- **Orden entrada → previa**: la apertura del narrador («… prepara el saque de centro») sigue
  precediendo a los invitados (045 v3.1). Suena como «saque → alineaciones»; invertirlo exige
  tocar `aperturaPendiente` y queda para una v1.1 si molesta al oído en el smoke.
- **Coste**: hasta 12 síntesis y 7.200 c de SSML más por encuentro, sumadas al tope diario de
  800/120.000. En la repetición guardada se usan 6 por idioma escuchado. Decisión de Carlos si
  se quiere recortar (bajar `bolsaSpeech`).
- **Apellidos largos en líneas de cinco**: `textLength` comprime el rótulo del dibujo; a 360 px
  puede quedar denso. La lista de texto siempre lleva el nombre completo.
- **`arena-mesa.spec` cuenta fuentes de audio**: la previa añade tres candidatas en el tick 0. Si
  una prueba del 045/048 contara fuentes exactas en los primeros 30 s, su ruta simulada responde
  404 a `previa:*` (comportamiento ya previsto para «sin invitados»). Si hace falta ese cambio en
  `e2e/`, se anota en la bitácora como la única excepción a «sin tocar e2e».
- **Z2 del 055**: si el 055 mueve la sala de control al acompañante, la tarjeta no cambia (vive en
  el tablero). En móvil alarga la columna del tablero antes de las cifras y el transporte; se
  acepta y se mide (`alineacionesAbajo`).
- **`fuente: "config"`** es un valor nuevo del campo libre `EvidenciaMesa.fuente`; los consumidores
  lo muestran tal cual.
- **Clase `dato-determinista` en líneas del narrador**: es una excepción a la tabla del 053 § 1,
  justificada porque el narrador lee un dato del registro, no un marco; la nota de la transcripción
  lo dice. La garantía es la reconstrucción exacta (`comprobarPrevia`), no V1–V8.
- **Partido sin `condiciones`** (registros sueltos por semilla sin entorno): la pieza 3 habla solo
  del árbitro y los perfiles, y los chips muestran solo el árbitro. Correcto, no es un fallo.

## Versión 1.1 (22 de octubre): decisiones tras la revisión de Codex

Codex (GPT-6.1 Sol, solo lectura) revisó la versión 1 y la declaró **no cerrada**
([informe íntegro](../evidencia/previa-056/codex-brief-v1.md): 6 altas, 7 medias). Fable verificó
cada hallazgo contra `route.ts`, `ArenaEmisionBuffer.tsx`, `sesiones.ts`, `motor.ts`,
`turnos.ts`, `arena-mesa.spec.ts` y `arena-descargas.spec.ts`, y midió el SSML real de la previa
con `prepararVoz` ([script y salida](../evidencia/previa-056/medir-ssml.mts),
[medición](../evidencia/previa-056/medir-ssml-2026-10-22.txt)). **Lo que sigue prevalece sobre el
texto anterior** donde se contradigan; la numeración es la del informe.

### 1. La ruta rechaza las ventanas `[0, 0]` (alta) — aceptado

Verificado: `route.ts:24` declara `hastaTick: z.number().int().positive()`. Cambio en el esquema:
`hastaTick: z.number().int().nonnegative().max(1800)`. Tras el `parse`, la rama **sin**
`intervencion` exige `p.hastaTick > p.desdeTick` y lanza `ErrorSesion("Ventana de relato vacía", 400)`
(antes `construirRelato` lo rechazaba con el 400 genérico; ahora el mensaje es explícito). La rama
con `intervencion` conserva la regla «`desdeTick === hastaTick === intervencion.tick`» (vale 0).
Pruebas HTTP reales en `http-vista.test.ts` (o el archivo de rutas que ya use `GestorSesiones`):
previa `[0, 0]` → 200 con `tipoRelato: "invitado"`; narrador `[0, 0]` y `[50, 50]` → 400 «Ventana
de relato vacía»; intervención ordinaria del diario pedida con `[tick, tick + 1]` → 400 «Ventana de
intervención inválida»; `hastaTick: -1` → 400 de Zod.

### 2. Sin un avance publicado no hay apertura ni previa (alta) — aceptado

Verificado: `ArenaEmisionBuffer.tsx:176` pide la entrada solo con `hastaTick > 0`, y
`aperturaPendiente` bloquea a los invitados hasta que la entrada suena. Es una protección del 045
que **no se toca**: sin un primer `avance` el servidor aún no ha confirmado nada que narrar.
Decisión: la previa hablada en búfer existe **desde el primer avance publicado**, igual que todo
lo demás; antes solo está la tarjeta (que no depende de la voz). El e2e (1) de § 7 se corrige:
la instantánea de `/emision` lleva el prefijo recortado a `BUFFER_ARENA.tramoTicks` (50 ticks,
5 s < 20 s de reserva) con `estado: "ejecutando"` y el SSE solo `keepalive`; así el reloj queda en
`preparando` (`arena-buffer-status` «Preparing broadcast · 5/20 s ready»), `hastaTick = 50`, la
entrada se pide (`entradaTick: 0`, ventana `[0, 50]`) y la previa arranca tras ella. La tabla de
§ 2.2 cambia la primera fila: «Búfer, `preparando` **con al menos un avance**».

### 3. Reactivar la voz terminaba la previa pendiente (alta) — aceptado

Verificado: `ArenaEmisionBuffer.tsx:139` termina al reactivar toda intervención conocida con
`tick < tick` de activación; las tres piezas tienen `tick: 0`. Excepción acotada: esa limpieza
**omite** las candidaturas con `esPrevia` que no hayan arrancado (`!s.pedidas.has(id)`) mientras
`(tick − 0) / 10 ≤ PREVIA_ARENA.caducidadS`; las ya arrancadas, descartadas o caducadas están en
`pedidas` y no se tocan; las que quedaran fuera de la caducidad se terminan como hoy. Las variantes
de una previa conservada que estuvieran `pidiendo` siguen su curso (sus `AbortController` no se
abortan al silenciar: `cambiarVoz` solo detiene la fuente activa). Pruebas unitarias sobre un helper
puro nuevo `candidatasAlReactivar(invitados, tick)` (extraído de ese bucle; devuelve los ids a
terminar): previa pendiente a 5 s → se conserva; previa pendiente a 31 s → se termina; previa ya
arrancada → no aparece (está en `pedidas`); una candidata ordinaria del 048 a 5 s con `tick 20` →
se termina como hoy. E2e dentro del escenario (4) de § 10: desactivar en el segundo 3 con la pieza
2 pendiente, reactivar en el 6 → la pieza 2 suena; segunda variante del mismo escenario con
primera activación tardía en el 8 → las tres piezas se piden y suena al menos la 1.

### 4. La escalera no garantizaba los límites (alta) — aceptado

Verificado: `motor.ts:60–76` admite clubes de hasta 100 caracteres, jugadores y entrenadores de
hasta 80; medido con nombres reales del simulador la completa EN de la pieza 1 ya da 203 caracteres
(límite 210). Escalera **por pieza**, en orden, hasta que `max(ES, EN)` de la variante quepa en
`MESA_ARENA.maxCaracteresIntervencion` y cada oración en `maxCaracteresOracion`; cada escalón se
anota en `auditDialogo.escalones` y la variante breve recorre la misma escalera desde su propio
texto:

| Pieza | 1 | 2 | 3 | 4 | 5 (siempre cabe) |
| --- | --- | --- | --- | --- | --- |
| 1 y 2 (equipo) | quitar «, {perfil}» | quitar el turno del estadista (= breve) | `{capitan}` → `apellidoCorto` | `{equipo}` → «el local» / «la visita» («the home side» / «the away side») | quitar la cláusula del capitán: «Así sale el local, en cuatro-tres-tres.» |
| 3 (condiciones) | quitar `{temperatura}` | quitar la oración del árbitro | quitar el turno del narrador (= breve) | `{local}`/`{visita}` → «el local» / «la visita» en perfiles | — (el escalón 4 ya acota: ≤ 110 caracteres con cifras de tres dígitos) |

Cota probada por construcción: en el escalón final los textos solo contienen plantilla, una
formación en palabras (máx. «cuatro-uno-dos-uno-dos», 22 caracteres) y cifras ≤ 3 dígitos: pieza 1
≤ 60, pieza 3 ≤ 110 caracteres, ES y EN. Las referencias «el local» / «la visita» son inequívocas
porque el marcador y la tarjeta muestran quién es quién, y así lo hace el relato por plantillas
cuando no nombra al club. La escalera opera sobre el **texto** (como el 048); el escape XML lo
hace `prepararVoz` (`<>&"'`) y entra en el presupuesto de SSML (§ 9), no en el de texto. Pruebas:
registro con club de 100 caracteres y capitán, entrenador y árbitro de 80 (con `&`, `<` y
comillas) en ES y EN → todas las variantes caben, `escalones` lista exactamente los pasos
aplicados, ningún texto queda vacío, `prepararVoz` no lanza y el SSML contiene las entidades
escapadas; cliente y servidor comparten `previaPartido`, así que la reducción es idéntica por
construcción y la prueba de § 11 (cliente frente a ruta) lo verifica.

### 5. El desempate por id cambiaba el coordinador fuera de la previa (alta) — aceptado

El orden dentro del rol sigue siendo el actual (tick desc., estable) para toda candidata **no**
previa; el desempate por id ascendente se aplica **solo** entre dos candidatas con `esPrevia`. Y el
orden es obligatorio, no preferente (§ 11): una previa `k` **no es elegible** mientras exista otra
previa con id menor vigente y con futuro (`conFuturo`: válida o pendiente); si la anterior falló o
caducó, la siguiente pasa. Como el consumidor pide una variante a la vez en orden de tick estable
(`[...intervenciones].sort`, y `mesa` ya viene `[1, 2, 3]`), las peticiones también salen en orden.
Regresiones en `turnos.test.ts`: dos candidatas ordinarias del mismo rol y tick con ids en orden
inverso → misma elección que hoy (se fija el resultado actual como esperado antes de tocar el código);
un `estadista:…:final` con sufijo → igual que hoy; mezcla previa + ordinaria → la ordinaria no cambia;
previa 2 válida y previa 1 pendiente → `null`; previa 1 `fallida` → previa 2.

### 6. Los e2e existentes se rompen con ids desconocidos (alta) — aceptado

Verificado: `arena-mesa.spec.ts:125, 226, 295, 418, 527, 584, 627, 680` y
`arena-descargas.spec.ts:88` usan `intervenciones.find(x => x.id === p.intervencion)!` y llaman
`relatoIntervencion(i, …)`: un id `previa:*` haría lanzar al manejador de la ruta (petición
abortada → el consumidor la trata como fallo de red y reintenta tres veces), no un 404. Además
`arena-descargas.spec.ts:231` exige `data-progress-total = tramos + 1`: con la previa en la pista
el total sería `tramos + 4` mientras las piezas no se omitan. Decisión (única excepción autorizada a
«sin tocar `e2e/`», anotada en la bitácora): en esos nueve manejadores se añade **una** guarda
`if (!i) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } });`
antes de usar `i`; ninguna aserción cambia. Con 404 la previa se omite (regla existente en búfer y
en la repetición: `total--`), así que `data-progress-total` vuelve a `tramos + 1` antes de que la
pista exista, y `cursorEnVentana` no ve ninguna fuente previa. Cobertura donde la previa **sí**
suena: e2e (1), (3) y (4) de este brief. Se retira la frase «Opus verifica» de § 8: esta es la
auditoría.

### 7. Evidencia con fuentes incorrectas y mixtas (media) — aceptado

Cierto: el árbitro sale de `inicial.arbitro` y la formación de `config.formaciones`. Nuevo modelo,
sustituye a § 3.3: **un hecho por dato**, con su procedencia exacta, y una oración por turno que
cita el principal en `hecho` y los demás en `apoyo`; la evidencia de la oración lleva `citas` (una
por hecho, `EvidenciaMesa.citas`, ya consumidas por la Mesa y la transcripción) y `eventos: []`,
`intervalo: [0, 0]`, y **sin** `fuente` plana cuando hay más de una procedencia.

| Hecho | Procedencia (`fuente`) | Datos |
| --- | --- | --- |
| `previa:equipo:{lado}` | `config.partido` | `equipo` |
| `previa:formacion:{lado}` | `config.formaciones` | `formacion`, `formacion_hablada` |
| `previa:capitan:{lado}` | `inicial.jugadores` | `capitan`, `dorsal` |
| `previa:nivel:{lado}` | `inicial.jugadores` | `nivel`, `jugadores: 11` |
| `previa:entrenador:{lado}` | `config.entrenadores` | `entrenador`, `perfil` |
| `previa:arbitro` | `inicial.arbitro` | `arbitro` |
| `previa:condiciones` | `config.partido.condiciones` | `clima`, `temperatura_c?`, `superficie`, `cesped?` |
| `previa:perfiles:{lado}` | `config.partido` | `ataque`, `defensa`, `estilo` |

Oraciones: turno 1 de las piezas 1–2 → principal `formacion`, apoyo `equipo`, `capitan`; turno 2 →
principal `nivel`, apoyo `entrenador`; pieza 3 turno 1 → principal `condiciones` (o `arbitro` si no
hay condiciones), apoyo el otro; turno 2 → principal `perfiles:local`, apoyo `perfiles:visita`. La
Mesa muestra cada cita con «intervalo 0,0–0,0 s · config.formaciones», etc. Pruebas: para cada
oración, el conjunto `{hecho} ∪ apoyo` coincide con las claves de `citas`, cada cita lleva la
`fuente` de la tabla y `datos` reproduce exactamente los valores sustituidos en el texto; mutación:
cambiar la `fuente` de una cita → `comprobarPrevia` la detecta (compara la evidencia completa) y la
prueba de tabla también.

### 8. Superficie natural sin `cesped` (media) — aceptado

Verificado: `Condiciones.cesped` es opcional («solo en superficie natural») y `ArenaContexto.tsx:30`
hoy asume «corto» si falta. Para la previa: `PREVIA_ARENA.textos.superficie` gana `natural`
(«césped natural» / «natural grass») y la clave se elige así: `sintetica` → `sintetica`;
`natural` con `cesped` → `natural_corto | natural_alto`; `natural` sin `cesped` → `natural`. Igual en
chips, voz y `datos` (sin `cesped`). Prueba con las tres variantes más la ausencia total de
`condiciones` (se omite la frase, § 3.5). No se corrige `ArenaContexto` aquí (fuera de alcance; se
anota como deuda menor).

### 9. Presupuesto de Speech sin medir y rama del narrador (media) — aceptado

Verificado: `rechazoCuotaVoz` cuenta como narrador toda reserva con `clase !== "invitado"`
(`sesiones.ts:51`): una clase `previa` restaría del narrador. Cambio: `const narrador = audio.filter(x => x.clase !== "invitado" && x.clase !== "previa")`
y rama propia para `previa` contra `PREVIA_ARENA.bolsaSpeech`. **Medición real** del 22 oct con
`prepararVoz` sobre textos de longitud típica (voces predeterminadas; evidencia enlazada arriba):
completa ES 573–578 c de SSML, EN 646–665; breve 362–442; suma de las 8 síntesis de dos piezas en
dos idiomas 4.003 → tres piezas ≈ 6.000. Con nombres al máximo admitido la completa llega a
≈ 210 + 460 de marcas ≈ 670–700 y la breve ≈ 500: cota 6 × 700 + 6 × 500 = 7.200 justo. Decisión:
`bolsaSpeech: { solicitudes: 12, caracteres: 9000 }` (25 % de margen sobre la cota; ≈ 0,14 USD por
encuentro a precio de lista). Prueba de **suficiencia**: para los cuatro fixtures, 60 semillas y el
registro de nombres máximos de § 4, en ES y EN, con catálogo completo **y** degradado
(`asignarVoces` sin la voz del estadista → voz del comentarista; sin ninguna → del narrador), la suma
de `caracteresPresupuestados` de las 12 síntesis ≤ `bolsaSpeech.caracteres` y 12 ≤ `solicitudes`;
prueba de **aislamiento** (patrón v1.3 (1) del 048): recorridos con y sin previa a 60/120/180 s, ES
y ES+EN, comparados por separado: rechazos del narrador idénticos, cierres 200 donde lo eran, bolsa
de invitados idéntica. Mutación: previa cobrando al narrador o a los invitados → rojo.

### 10. Interacción con saque, reservas y silencio del 041 (media) — aceptado

Nuevo e2e (4) en `arena-previa.spec.ts`, línea de tiempo controlada completa:

- `/emision`: prefijo del `arena-duelo-v3.json` recortado a 50 ticks, `estado: "ejecutando"`;
  `/eventos`: el manejador **espera** `PREP_MS = 7000` antes de responder con todas las
  publicaciones (avances hasta el final, intervenciones ordinarias del fixture a partir del tick 300,
  `terminada`), así que el reloj queda en `preparando` 7 s y después arranca; `/herramientas` con
  voz; reservas estáticas reales (`public/voz-reserva/`).
- `/relato`: entrada y ventanas del narrador con WAV de 0,8 s (`construirRelato` real sobre el
  prefijo de la petición); `previa:1` completa 3 s servida tras 1 s de demora; `previa:2` completa
  4 s servida **tras 9 s** (llega con el reloj ya en marcha); `previa:3` completa 3 s; intervenciones
  ordinarias 404.
- Aserciones (`instrumentar` del `arena-mesa.spec`): la entrada suena antes que cualquier previa; la
  previa 1 arranca con `arena-clock` «0:00» y variante `completa`; la previa 2, pedida como
  `completa` durante `preparando` y recibida después, arranca en el primer hueco de calma solo si
  cabe en la ventana (si no, el consumidor pide la breve: se acepta cualquiera de los dos resultados
  pero se exige que **no** se solape con ninguna fuente); la noticia del narrador con tick > 0
  (reinicio o remate del fixture) que llega mientras suena una previa la marca `detenida` y esa
  previa **no vuelve a arrancar** (una sola fuente con su `texto`); la previa 3 no arranca con el
  cursor > `caducidadS` (se fuerza: su clip se sirve a los 35 s de partido → cero fuentes con su
  texto); silencio máximo entre fuentes audibles ≤ `VOZ_BUFFER.silencioMaxS` (5 s) durante los
  primeros 40 s con voz activa (las reservas cubren los huecos: al menos una fuente de reserva, con
  `texto` del índice); el reloj avanza a velocidad 1 desde que termina `preparando`
  independientemente de las síntesis (`arena-clock` ≥ 20 s a los 27 s desde la activación ± 1 s).
- Variante del mismo escenario para el hallazgo 3 (desactivar/reactivar y activación tardía).

### 11. Mutaciones no cubiertas (media) — aceptado

- **Nunca en el diario**: en `mesa.test.ts` y en la prueba de `GestorSesiones` que recorre una
  sesión completa (`reproduccion-preparada.test.ts` o `mesa-voz.test.ts`), se afirma que ningún
  mensaje publicado tiene `tipo: "intervencion"` con id `previa:*` ni `forma: "previa"`; además la
  sesión de `registrarGrabacion` sigue sin intervenciones.
- **Cliente frente a ruta**: prueba HTTP que crea una sesión de grabación del fixture, pide las tres
  piezas y las dos variantes por la ruta y compara `relato.fragmentos` (texto, rol, tick, fuentes) con
  `relatoIntervencion(previaPartido(registro)[k], seed, idioma, variante)` calculado en la prueba:
  `toEqual`.
- **Audio fuera de orden**: `turnos.test.ts` (§ 5) y e2e (4) (previa 2 servida antes que la 1 → la 1
  suena primero).
- **Campos contractuales**: `comprobarPrevia` recibe una copia con cada campo mutado por separado
  (`texto_es`, `texto_en`, `oraciones[k].hecho`, `apoyo`, `hechos[k].datos`, `evidencia[k].citas[j].fuente`,
  `turnosBreve`, `forma`, `tema`, `tick`, `rol`, `id`) y devuelve exactamente un motivo con la ruta
  del campo; la copia intacta devuelve `[]`.
- **Transcripción**: para **cada** línea de la previa, `evidencia.hechos` = `{hecho} ∪ apoyo`,
  `evidencia.citas` presente con las fuentes de la tabla del § 7, `fotogramas: []`; orden
  intrapieza por `turno`; piezas en orden; todas antes de «Comienza el partido…». Los rótulos
  `orden` y el quinto `omitido` de `ROTULOS_TRANSCRIPCION` cambian a «…la pista de audio inserta a
  los invitados tras la ventana del narrador, salvo la previa, que va antes del primer tramo.» /
  «…the audio track inserts guests after the narrator's window, except the pre-match segment, which
  comes before the first passage.» (ES y EN; la prueba de completitud de rótulos se actualiza).

### 12. Foco y estado al desmontar la tarjeta (media) — aceptado

- El cuerpo `#arena-lineups-body` queda **siempre montado** mientras la tarjeta exista, con el
  atributo `hidden` cuando `plegada`; `aria-controls` apunta a un nodo estable.
- `plegada` se reinicia a `false` con `cargaId` **y** al salir del tick 0 (efecto: `if (tickCifras > 0) setPlegada(false)`),
  así «volver a 0» siempre muestra la tarjeta desplegada.
- Política de foco: la tarjeta se desmonta al avanzar el cursor; si en ese momento
  `document.activeElement` está dentro de `.arena-lineups`, el efecto de limpieza mueve el foco al
  primer `.arena-player` del SVG principal (`tabIndex 0`, ya focalizable); si no existe, a
  `#arena-watch` (`tabIndex -1` existente). Nunca se deja el foco en `body`.
- Pruebas: UI (`renderToStaticMarkup`) comprueba `hidden` y `aria-controls`; e2e (2) añade:
  `Tab` hasta `arena-lineups-toggle`, `Enter` (pliega, `aria-expanded="false"`, cuerpo `hidden`),
  `Enter` (despliega), `Tab` hasta un `arena-lineup-player`, `Enter` (la ficha muestra ese
  jugador); con el foco en un botón de la tarjeta, pulsar «Play» por teclado desde ese botón no es
  posible (está fuera), así que se usa `page.keyboard` para enfocar el botón y `page.getByRole("button", { name: "Play" }).click()`:
  tras la desaparición, `document.activeElement` es un `.arena-player` (`data-testid="arena-player"`);
  «Restart» → tarjeta desplegada aunque se hubiera plegado antes; selección de un suplente desde
  `arena-lineup-bench` → `arena-player-card` «Available substitute».

### 13. Estimación, cortes y geometría (media) — aceptado

- **Geometría derivada**: `PREVIA_ARENA.tarjeta` deja `ancho` y `largoUtilM`; el viewBox usa
  `ARENA.anchoM` (68) y la escala se calcula como
  `escalaLargo = (lineaFondo − margenSuperior) / ARENA.largoM` con `margenSuperior = 8` (constante
  nueva; alto 64, línea de fondo 60 → 0,495). Posiciones: `cy = lineaFondo − x · escalaLargo` (POR
  en 57; línea más alta en 15,8; mediana en 34 con su arco). La prueba comprueba que toda ancla de
  las doce formaciones cae dentro del viewBox con su nombre (`cy + desplazamientoNombre ≤ alto`).
- **Formación hablada**: se pronuncia en palabras con `CANTO_GOL.plantillas.numeros[idioma]`
  (0–9 ya definidas): «cuatro-tres-tres» / «four-three-three»; `formacion_hablada` va en `datos`.
  La tarjeta muestra las cifras. Cómo lo lee Speech se confirma en el smoke (criterio 10.4) y se
  anota; si suena mal, se cambia el separador a «, » sin tocar nada más.
- **Duración, consumo y pronunciación** se presentan como estimaciones hasta el smoke: la bitácora
  registrará los MP3 reales, su duración y los caracteres cobrados.
- **Aceptación separada**: § 10 se parte en **10.A** (bloque A: 10.1 con `npm test`, `typecheck`,
  `build` y `npm run e2e -- e2e/arena-previa.spec.ts e2e/arena.spec.ts e2e/arena-formaciones.spec.ts e2e/arena-identidad.spec.ts`,
  donde `arena-previa.spec.ts` contiene solo el escenario (2); 10.2 capturas y contraste; 10.3
  revisión visual) y **10.B** (bloque B: la lista completa de 10.1 con los escenarios (1), (3) y (4),
  más `arena-buffer`, `arena-mesa`, `arena-descargas`; 10.4 smoke local; 10.5 smoke público).
- **Estimación revisada**: A ≈ 5,5 h (añade foco, `hidden`, geometría derivada y e2e de teclado);
  B ≈ 8 h (ruta y pruebas HTTP 1 h; `previa.ts` hablada con escalera, citas y `comprobarPrevia`
  2 h; coordinador + consumidor + reactivación + cuota 2 h; repetición, transcripción, Mesa 1 h;
  e2e (1), (3), (4) y guardas 404 en nueve mocks 1,5 h; smoke real ES/EN 0,5 h) **más 1 h de
  regresiones** (suite completa de arena serializada). Total ≈ 14,5 h, en dos días y medio.

### Qué cambia para Opus (lista)

1. `route.ts`: `hastaTick` no negativo; «Ventana de relato vacía» explícita; pruebas HTTP (§ 1).
2. La previa hablada existe desde el primer avance; e2e (1) con prefijo de 50 ticks (§ 2).
3. Helper puro `candidatasAlReactivar` con la excepción de la previa vigente (§ 3).
4. Escalera de cinco escalones por pieza con «el local / la visita» y cota probada; nombres máximos
   con caracteres XML en las pruebas (§ 4).
5. Desempate por id **solo** entre previas; orden obligatorio (una previa espera a la anterior); regresiones (§ 5).
6. Guardas `if (!i) 404` en los nueve mocks de `arena-mesa.spec.ts` y `arena-descargas.spec.ts`
   (única excepción a «sin tocar e2e»; aserciones intactas) (§ 6).
7. Un hecho por dato con `fuente` exacta y `citas` por oración; sin `fuente` plana mixta (§ 7).
8. Superficie `natural` sin longitud: «césped natural» / «natural grass» (§ 8).
9. `rechazoCuotaVoz`: el narrador excluye `previa`; `bolsaSpeech 12 / 9.000`; pruebas de
   suficiencia (SSML real, catálogo degradado) y aislamiento (§ 9).
10. E2e (4): preparación → saque → calma → caducidad, con síntesis demorada, reserva audible, corte
    por noticia sin repetición y silencio ≤ 5 s; variantes de reactivación (§§ 3, 10).
11. Pruebas de «nunca en el diario», cliente frente a ruta, audio fuera de orden, mutación por campo,
    transcripción con citas en todas las líneas y rótulos `orden`/`omitido` actualizados (§ 11).
12. Cuerpo `hidden` estable, reinicio de `plegada` al salir del tick 0, foco al primer
    `.arena-player`, e2e de teclado (§ 12).
13. Geometría desde `ARENA.anchoM`/`largoM` + `margenSuperior`; formación en palabras con
    `CANTO_GOL.plantillas.numeros`; aceptación 10.A/10.B separada (§ 13).

### Bloques A/B y cortes realistas (sustituye a § 9)

La implementación empieza al cerrar el 055 (previsto **23 oct**); entrega del hackathon el 27 de
octubre, meta de envío el 26.

- **Bloque A · Tarjeta (≈ 5,5 h)**, obligatorio: `previa.ts` (`previaVisual`, `apellidoCorto`,
  geometría derivada) + `PREVIA_ARENA` + pruebas; `ArenaPrevia.tsx` + CSS + visibilidad, plegado,
  foco; prueba de UI; e2e (2) con teclado; capturas y contraste; suites; bitácora. Aceptación
  **10.A**. Debe estar en verde el **24 oct a las 14:00**; si no, se escala a Carlos ese mismo día
  (A no se recorta).
- **Bloque B · Voz (≈ 8 h + 1 h de regresiones)**, solo con A en verde: empieza como muy tarde el
  **24 oct a las 15:00** y debe estar en verde el **25 oct a las 20:00** (aceptación **10.B**,
  incluido el smoke local con Speech real ES/EN). Si a esa hora falta algo, se entrega solo A, se
  revierten los cambios de B que no estén en verde (la ruta, el coordinador y los mocks no se
  dejan a medias) y la bitácora lo declara como recorte del 056.
- **26 oct**: despliegue, smoke público (10.5), regrabación del video y envío. Nada del 056 se
  implementa el 26.

Orden de recorte dentro de B si el tiempo aprieta: e2e (4) → reactivación (§ 3) → repetición
guardada (§ 5.6). Lo que se recorte deja su constante y su prueba fuera, no a medias, y se anota.

## Versión 1.2 (22 de octubre, coordinador): dos ajustes durante la implementación

1. **Selectores de la tarjeta.** El DOM de §4.1/§8 rompía dos e2e existentes en modo estricto
   (`e2e/arena.spec.ts` busca `[data-player=…]` sin acotar y `e2e/arena-identidad.spec.ts` busca `header`). Dentro de
   la tarjeta se usa `<div className="arena-lineup-head">` en lugar de `<header>` y `data-lineup-player` en lugar de
   `data-player`. Ningún e2e existente se modifica.
2. **Fichas encimadas.** Con la escala derivada, las líneas de 0,69 y 0,80 quedaban a 5,7 unidades con fichas de 6,4 de
   diámetro (4-2-3-1 y 4-2-2-2). El dibujo muestra solo el dorsal (los nombres están en la lista de texto de la tarjeta)
   y el eje de profundidad se estira con una constante de `PREVIA_ARENA.tarjeta` para que la distancia entre centros de
   cualquier par de fichas sea ≥ diámetro + 1 unidad, probado en las 12 formaciones del catálogo.

## Versión 1.3 (22 de octubre, coordinador): cambios autorizados en e2e para el Bloque B

Con el Bloque B aplicado, cinco e2e existentes fallaban por supuestos que el brief no previó. Se autorizan, sin
relajar ninguna otra aserción:

1. `e2e/arena-descargas.spec.ts` (aserciones de `diario.intervenciones`, líneas ~159 y ~213): pasan a esperar las
   intervenciones del diario más las tres piezas de la previa derivadas del registro, porque §5.7 manda incluirlas en
   la descarga. La comparación sigue siendo exacta (lista completa, en orden).
2. `e2e/arena-buffer.spec.ts` (~271), `e2e/arena-sincronia.spec.ts` (~7) y `e2e/arena.spec.ts` (~441): la misma guarda
   404 para ids `previa:*` que ya tienen los nueve mocks autorizados en la v1.1 §6.
3. El escenario (3) simula `/api/arena/grabaciones` como `arena.spec.ts` (el servidor de e2e no tiene `ARENA_VOZ=1`).
