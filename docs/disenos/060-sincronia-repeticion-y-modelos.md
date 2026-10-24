# 060 — Repetición narrada al ritmo del partido, pausar y detener, y modelos que jugaron

## Estado

**Versión 1.1 (24 de octubre).** Codex dio la v1.0 por NO CERRADA en la iteración 1 de 3, con 7 hallazgos
altos y 4 medios. Cada uno se verificó contra el código y las decisiones las tomó el coordinador por delegación
de Carlos. La [sección final](#versión-11-24-de-octubre-decisiones-tras-la-revisión-de-codex)
**prevalece sobre todo el texto anterior** donde lo contradiga.

Brief **v1.0, cerrado**, sábado 24 de octubre de 2026. Lo escribió Opus como diseñador porque Fable no tiene
cupo, y **Codex aún no lo ha revisado**: si una versión posterior contradice este texto, prevalece la versión
posterior. El brief no incluye código de producción y lo implementa Opus.

Se apoya en el 057 v1.3 (Reproducir con narración), el 058 v1.3 (A y B, antesala), el 056 (previa), el 045/048
(Mesa) y el 059 (repeticiones del torneo). El 062 también toca `src/ui/Arena.tsx`; quien integre primero avisa
al otro (§ 9).

Pedidos de Carlos (24 oct, revisión `cronista-arena--0000030`), textuales:

1. «Cuando se carga un encuentro salvado, la simulación se ve muy lenta y la narración va adelante».
2. «Cuando se carga un encuentro salvado no dice los modelos que jugaron».
3. «necesitamos también controles para pausar un partido, o detenerlo del todo, tanto la narración como la
   simulación».

Prioridad del coordinador: **(1) sincronía > (3) pausar/detener > (2) modelos**. El 26 se reserva a la entrega.

Reglas que no se negocian:

- No cambian el motor, `RegistroArena`, el validador, los fixtures, V1–V8, D1–D5, la Mesa, el canto ni los
  presupuestos de voz (`PRESUPUESTO_AUDIO_ENCUENTRO`, bolsas, `SPEECH_DIARIO`).
- La voz **nunca** empieza a contar un hecho antes de que la cancha lo muestre.
- Cada constante nueva vive comentada en `src/sim/limites.ts`, y ninguna prueba repite cifras a mano.
- Se mantiene la regla 047: sin `transform`, `transition` ni `animation` CSS en `.arena-player`, `.arena-ball`
  y `.arena-referee`.
- Las e2e protegidas del 057 y del 058 solo cambian donde § 8.2 lo autoriza, y nunca se relajan.

## 0. El diseño en diez líneas

1. **Causa (§ 1.4).** El botón Reproducir sintetiza el relato **detallado**: todas las acciones en tramos de
   10 s. La voz dura unas 3,4 veces el partido, y la cancha reparte cada tramo **linealmente** sobre su audio.
   Como la voz reparte su tiempo por frases y la cancha por ticks, la voz se adelanta a la jugada hasta 16 s.
2. **Bloque A (P1).** Reproducir usa una pista nueva, **al ritmo del partido**. Hay un clip por ventana de 5 s
   (`modo: "buffer"`, el mismo contenido del directo), anclado al tick de su hecho. La cancha corre a 1× y se
   detiene solo en casos rotulados.
3. Un planificador puro (`planificarPista`) coloca cada clip después de su hecho (`reaccionS`) y con un retraso
   acotado (`retrasoMaxS`). Las piezas menores se omiten. Las importantes (remate o más, cierre) nunca se omiten:
   si hace falta, la cancha espera. El WAV intercala silencio entre los clips.
4. Los tramos siguen siendo `TramoTemporal`: `instanteNarrado` e `instanteAudio` no cambian, y la búsqueda, la
   pausa, «Restart» y el WAV siguen funcionando.
5. La previa (≈ 44 s medidos) se oye con la cancha en 0:00 y se puede saltar con «Skip to kick-off».
6. El relato detallado del panel («Listen from the start») no cambia de mapeo. Se rotula como más lento que
   el partido y como posiblemente adelantado dentro de cada tramo. Anclarlo por frase queda en P2.
7. **Bloque B (P1).** Una sola barra de transporte va justo debajo de la cancha, en cualquier modo, con
   Pausar/Reanudar y Detener. «Pause broadcast» se mueve allí con su mismo nombre. La barra añade **Detener**:
   en directo cancela la sesión y en repetición vuelve a 0:00 sin audio. La barra de espacio funciona cuando
   ningún control tiene el foco.
8. **Bloque C (P1-c).** Una línea fija bajo el reloj, `arena-models`, dice «Local: <modelo> · Visita:
   <modelo> · <procedencia>», con nombres del catálogo y respaldos o mezclas por lado.
9. La procedencia es **verificada** solo si el servidor asignó la sesión. El resto se rotula **declarada** (por
   el archivo, el ejemplo del proyecto o el ejecutor del torneo), **programado, sin IA** o **ensayo**.
10. Calendario: A el sábado 24, B y C el domingo 25 con publicación y smoke, y el 26 queda reservado (§ 9).

## 1. Medidas (24 oct, datos reales)

### 1.1 Método

- **Público** (`cronista-arena--0000030`, Speech real, 2 pistas):
  - pista 1: «Saved matches» → «Load recorded model duel» → Reproducir, EN;
  - pista 2: `?partido=34c24e93-…` en ES. Es una sesión del servidor creada para medir: 30 s, `manual`, GPT-5.4
    mini contra GPT-6 Luna, con 3 intervenciones de la Mesa.
- **Local** (build de producción standalone en el puerto 3418): se reprodujo la pista 1 con el **audio real
  capturado**. Las rutas devolvieron los mismos cuerpos y se obtuvieron los mismos números (± 0,01 s).
- Cada 100 ms se muestrean `audio.currentTime`, el valor del deslizador y `arena-clock`. Las respuestas de
  `/relato` se capturan en orden, y cada pieza se decodifica para obtener su duración.
- El inicio hablado de cada frase se estima de dos formas:
  - silencios: los N − 1 huecos más largos del PCM. Cada frontera `<s>` cuesta 1,0–1,3 s, que coincide con el
    comentario de `voz.ts`;
  - proporción de caracteres.
  - Para el gol del duelo se contrasta además con el pico de energía del grito.
- Scripts y salidas en [`docs/evidencia/repeticion-060/`](../evidencia/repeticion-060/). Las capturas con audio
  están en `.cache/060/`, fuera de git, para reproducir en local sin Speech.

### 1.2 Cuánto avanza la cancha por segundo de audio

| Pista | Previa | Narrador (por tramo de 10 s) | Invitados | Total |
|---|---|---|---|---|
| Duelo EN (60 s) | 43,9 s de audio a **0** s/s | 0,218 · 0,494 · 0,258 · 0,279 · 0,555 · 0,218 (media 0,294) | — | 60 s de cancha en 247,9 s de audio: **0,24×** |
| `?partido=` ES (30 s) | 42,1 s a **0** s/s | 0,179 · 0,226 · 0,264 (media 0,218) | 47,1 s a **0** s/s (11,6 + 19,3 + 16,3) | 30 s en 227,1 s: **0,13×** |

- El error máximo entre el deslizador y `instanteNarrado(tramos, currentTime)` fue de 0,05–0,07 s. Es decir,
  el código hace exactamente lo que dice: la cancha sigue al audio.
- El audio avanzó a 1,000 s por segundo de reloj de pared.
- La repetición muda arranca a **2×** (`useState(2)`), así que el contraste al activar la voz es todavía mayor.

### 1.3 Desfase entre la voz y la cancha

«Adelanto» es el tiempo real que pasa desde que la voz empieza la frase hasta que la cancha llega al tick del
hecho. Primero va la estimación por silencios y después, entre paréntesis, la de caracteres.

| Pista | Hecho (tick) | Voz | La cancha llega | Adelanto de la voz |
|---|---|---|---|---|
| Duelo EN | remate (22,2 s) | 7,3 s (3,5) del tramo | 8,5 s | **1,2–5,0 s** |
| Duelo EN | gol (23,1 s) | 9,7 s (8,1; pico de energía 7,3) | 12,0 s | **2,3–4,7 s** |
| Duelo EN | «Full time» (60,0 s) | 38,6 s (40,0) | 45,8 s | **5,8–7,2 s** (dice «final» con la cancha en 58,4 s) |
| `?partido=` ES | falta (16,0 s) | 10,6 s (9,1) | 26,5 s | **15,9–17,4 s** |
| `?partido=` ES | remate (19,0 s) | 29,0 s (24,7) | 39,8 s | **10,8–15,1 s** |
| `?partido=` ES | gol (19,7 s) | 31,8 s (29,3) | 42,9 s | **11,1–13,6 s** (3,1 s de partido) |
| `?partido=` ES | «Final del partido» (30,0 s) | 31,1 s (31,5) | 37,8 s | **6,3–6,7 s** |
| `?partido=` ES | comentarista, amarilla (6,9 s) | tras el tramo [0, 10] | — | **detrás**: suena con la cancha en 10,0 s y la detiene 11,6 s |

### 1.4 Causa raíz

1. **Contenido.** `iniciar()` de la barra pone `modo = "completo"` (`ArenaNarracion.tsx`). `construirRelato(…,
   "completo")` narra **todos** los hechos (pases, recepciones, reinicios, el entrenador) con su texto largo:
   de 4 a 11 frases por tramo de 10 s, y cada frontera `<s>` añade ≈ 1,1 s de silencio. El narrador habla
   204 s por 60 s de partido. Con la cancha atada al audio, el ritmo no puede ser natural sea cual sea el mapeo.
2. **Mapeo lineal por tramo.** `instanteNarrado` reparte los 100 ticks de cada tramo linealmente sobre su
   audio. La voz, en cambio, reparte el tiempo por frases. Cuando los hechos se concentran al final del tramo
   (ES [100, 200]: ticks 112–197, la mayoría por encima de 160), la voz llega al gol al 72 % del audio mientras
   la cancha está en el tick 172. La frase final («Final del partido») ocupa el último 15 % del audio, pero su
   tick es el 100 %. El adelanto máximo posible es casi la duración del tramo de audio (hasta ≈ 55 s).
3. **Piezas de ancho cero.** La previa (tres piezas en [0, 0], ≈ 43 s) y las intervenciones de la Mesa (ancho
   cero, insertadas tras el primer tramo con `hastaTick ≥ tick`) congelan la cancha mientras suenan: 0 s de
   cancha por segundo de audio. Estas no adelantan la voz, sino que la **retrasan**: la amarilla de 6,9 s se
   comenta con la cancha en 10,0 s. Sí explican buena parte de la lentitud: 89 s de los 227 de la pista ES.

No es un fallo del reloj, del audio ni de la búsqueda. Es el diseño del 057 (§ «Sincronía con la voz», que ya
lo declaraba como límite) aplicado a un contenido pensado para leerse, no para acompañar el juego a 1×.

### 1.5 Controles de pausa y detención (inventario, build local)

| Modo | Pausar | Detener | Dónde está (medido) |
|---|---|---|---|
| Directo con búfer | «Pause broadcast»/«Resume broadcast»: congela el reloj y suspende el `AudioContext`; «generation continues». Probado: 0:01 → 0:01 en 2,5 s y reanuda | «Cancel live match» (DELETE). Deja «Match cancelled», la emisión desmontada, el registro parcial en pantalla (reloj 0:03 / 0:26, Play habilitado), sin enlace y «Start live match» habilitado. «Turn narration off» solo silencia | Escritorio: Pause en la columna derecha, a la altura de la cancha; Cancel, ≈ 220 px **sobre** el reloj, en la sala de control. **360 px: Pause ≈ 2.960 px y Cancel ≈ 2.500 px bajo el reloj** |
| Directo preparado («Generate match») | No hay (no se ve juego mientras se genera) | «Cancel live match» | Sala de control |
| Repetición sin voz | Play/Pause (cancha) | No hay. «Restart» busca 0:00 sin detener | **Bajo la tarjeta de alineaciones** (056) en el tick 0: Play a ≈ 1.760 px del reloj en escritorio y ≈ 2.900 px a 360 px |
| Repetición con voz (057) | Play/Pause gobierna pista y cancha; además, el `<audio controls>` del panel | «Stop narration» solo en el panel y solo con la narración activa. A 360 px, «Listen from the start» queda a ≈ 5.190 px del reloj | Igual |
| Repetición de torneo | Igual que la repetición | Igual | Igual |

No hay atajo de teclado en la arena (no existe ningún `keydown` en `Arena.tsx`).

### 1.6 Qué se muestra hoy de los modelos

| Forma de carga | `arena-live-assignment` | Procedencia 059 | `.arena-controller` (panel plegable de decisiones) |
|---|---|---|---|
| Ejemplos archivados (duelo, ejemplo-v3, ejemplo) | — | — | id crudo: `azure-openai:cronista-equilibrado:reasoning-low`, `azure-openai:gpt-6.1-sol:reasoning-low` |
| `?partido=` de una sesión del servidor | «Local: GPT-5.4 mini · Visita: GPT-6 Luna» | — | id crudo |
| Archivo importado | — | — | id crudo; «Imported recording: … not independently authenticated» |
| «Create recording without AI» | — | — | `programado:geometria-v3` |
| Repetición de torneo (`encuentro=07`) | — | «Home: Unión Ventolera (GPT-5.6 Luna) · Away: …» | id crudo |
| Torneo con `encuentro=7` (sin cero) | — | **no carga** (queda la vista previa) | — |

- Solo el `?partido=` de una sesión del servidor y el torneo dicen el modelo con su nombre público.
- En ningún caso aparece junto a la cancha.
- `registrarGrabacion` crea las sesiones de grabación con `modo: "programado"` y `nombre` = id crudo.
- En el torneo del 24 de oct no hay respaldos (0 de 60 lados).

## 2. Opciones para (1) y decisión

| Opción | Qué hace | Voz por delante | Ritmo de la cancha | Coste | Riesgo |
|---|---|---|---|---|---|
| **A. Pista al ritmo del partido** (elegida) | Clips de 5 s (`buffer`) anclados a su tick; la cancha corre a 1× y espera solo en casos rotulados | Imposible por construcción (`reaccionS`) | 1× salvo previa, Mesa con choque, esperas de jugadas clave y final (estimado: 74–81 s de pista por 60 s, § 3.7) | ≈ 6 h; un módulo puro nuevo, cambios en `ArenaNarracion`, e2e 057 adaptadas | Plan nuevo (puro y probado por propiedades); ≈ 13 solicitudes de narrador por 60 s y por idioma |
| B. Anclar por frase la pista detallada | Detectar el inicio de cada frase por silencios y mover la cancha a 1× entre anclas, esperando a la voz | Casi nunca (depende de la segmentación) | 1× a tirones: parada ≈ 75 % del tiempo (sigue durando 248 s) | ≈ 5–8 h; heurística de PCM | La segmentación falla en voces expresivas (lo medido: un remate en 7,3 s frente a 3,5 s) |
| C. Acotar el desfase | Pinzar el cursor al tick de la frase que suena (estimada por caracteres) | Reducida, no garantizada | Igual de lento, con saltos | ≈ 2–3 h | La estimación por caracteres yerra 1–4 s |
| D. Reutilizar la emisión con búfer para repeticiones | Abrir `ArenaEmisionBuffer` sobre la sesión registrada | No (como el directo) | 1× con pausas < 5 s | > 1 día | Pierde búsqueda, WAV y «Restart» del 057 y rompe muchas e2e protegidas |

**Decisión: A** para la barra (Reproducir). La pista detallada sigue en el panel con su rótulo, y **B queda en
P2** para ella. C no garantiza el requisito y D no cabe en el calendario.

## 3. Bloque A · Pista al ritmo del partido (P1-A)

### 3.1 Contenido y orden de las peticiones

`ArenaNarracion` gana un modo `"ritmo"`.

- `ControlesNarracion.iniciar(desdeTick)`, usado por la barra, activa `"ritmo"`.
- «Listen from the start» del panel sigue activando `"completo"`, sin cambios.
- Helper `const conPista = (m) => m === "completo" || m === "ritmo"`. Toda comprobación de `modo ===
  "completo"` que se refiere a la pista pasa a `conPista(modo)`: fase derivada, `sincronizar`, RAF, `terminar`,
  `buscar`, el re-registro tras 404 y `alActividadAudio`.
- La `clave` de la pista incluye el modo: `${sesion}:${idioma}:${hastaTick}:${modo}:${ids}`. Así, preparar una
  pista nunca reutiliza la otra.

Peticiones en `"ritmo"`, secuenciales y en este orden. El progreso «Preparing narration n/m» cuenta las piezas:

1. **Previa**: las piezas `esPrevia` del diario, igual que hoy (`variante: "completa"`).
2. **Narrador**: una ventana por cada `k·RELATO_INTERVALOS.buffer`, con cuerpo `{ desdeTick, hastaTick:
   min(desde + intervalo, hastaTick), modo: "buffer", idioma, memoria }`.
   - `memoria` se encadena de forma determinista. Tras cada respuesta del narrador con texto: `memoria =
     recordarVoz(memoria, { tick: s.fragmentos[0].tick, texto: s.texto.slice(0, 500), clave: s.claveVoz, tema:
     s.temaVoz })`.
   - La memoria es la misma para todos los espectadores, así que la caché del servidor se comparte.
   - Los invitados no entran en la memoria.
3. **Invitados** (no previa, `tick ≤ hastaTick`): igual que hoy, tras la primera ventana con `hastaTick ≥ tick`,
   pero con `variante: "breve"`. El servidor sirve la completa si no hay breve (048).
4. **Cierre**, solo si `registroCompleto(registro)`: `{ desdeTick: última ventana, hastaTick, modo: "buffer",
   idioma, cierre: true, memoria }`.

Validación de cada respuesta del narrador: `desdeTick`, `hastaTick`, `idioma` y `modo === "buffer"`
coinciden.

- `audio: null` (texto vacío): no se crea clip y la pieza cuenta como lista.
- Fallo HTTP de una ventana o del cierre: falla la pista con el motivo de siempre (`motivoRelato`, 404 →
  re-registro único).
- Fallo de un invitado: se omite, como hoy.

### 3.2 Planificador puro (`src/arena/plan-pista.ts`, nuevo)

```ts
export type TipoPieza = "previa" | "narrador" | "invitado" | "cierre";
export interface PiezaPlan { id: string; tipo: TipoPieza; tick: number; duracionS: number; prioridad: number; orden: number }
export interface Colocada { id: string; tipo: TipoPieza; inicioS: number; finS: number; cursorTick: number; modo?: "corre" | "detiene" }
export interface PlanPista {
  tramos: TramoTemporal[];             // contiguos desde 0; ancho > 0 ⇒ (finS − inicioS) = (hastaTick − desdeTick)·pasoS
  colocadas: Colocada[];               // ordenadas por inicioS, sin solaparse
  omitidas: { id: string; motivo: "retraso" | "cede" | "caducada" }[];
  esperas: { tipo: "previa" | "invitado" | "clave" | "final"; inicioS: number; finS: number; tick: number }[];
  inicioJuegoS: number;                // inicio del primer tramo con ancho > 0 (fin de la previa)
  duracionS: number;
}
export function planificarPista(piezas: readonly PiezaPlan[], finTick: number): PlanPista;
```

Las entradas son el `tick` de la pieza y su `duracionS` decodificada. Para el narrador, el tick es
`s.fragmentos[0].tick`: el del hecho de una `jugada`, o `hastaTick` de un comentario. Para invitados, el tick
de la intervención; para la previa, 0; para el cierre, `finTick`. La prioridad del narrador es `s.prioridad`
(`relatoBuffer`), la de los invitados `MESA_ARENA.prioridadInvitado` y la del cierre `+∞`. `orden` es el de la
petición y desempata. Constantes en § 6 (`REPETICION_NARRADA`).

Reglas, aplicadas en orden cronológico (tick y después `orden`) sobre un cursor de cancha `P` (s de partido),
un tiempo de audio `T` y el instante `voz` en que la voz queda libre:

1. **Previa**: las piezas `previa`, una tras otra desde T = 0 con P = 0. Son tramos de ancho cero (espera
   `previa`). `inicioJuegoS` es su final.
2. **Correr es la regla**: fuera de las esperas, la cancha avanza a 1× y P(T) es lineal con pendiente 1.
3. **Narrador**, con `A = tick·pasoS` y `objetivo = min(A + reaccionS, fin)`:
   - el clip empieza en el primer T en que la voz esté libre y P ≥ objetivo;
   - retraso = P(inicio) − A;
   - **siempre** retraso ≥ `reaccionS` (o P = fin): la voz nunca se adelanta;
   - si retraso ≤ `retrasoMaxS`, se coloca y la cancha sigue corriendo mientras suena;
   - si retraso > `retrasoMaxS` y `prioridad ≥ prioridadEspera`, se aplica una **espera clave**. La cancha
     corre hasta `A + retrasoMaxS`, se detiene hasta que la voz queda libre y el clip empieza con retraso =
     `retrasoMaxS`;
   - si retraso > `retrasoMaxS` y la prioridad es menor, se omite con motivo `retraso`.
4. **Ceder ante lo importante (anticipación)**: un clip con `prioridad < prioridadEspera` (narrador o invitado)
   se omite con motivo `cede` si, colocado, terminaría después del `objetivo` del siguiente clip con
   `prioridad ≥ prioridadEspera`, o del cierre. Así casi nunca hace falta una espera clave.
5. **Invitado** (Mesa):
   - empieza cuando la voz queda libre con P ≥ tick. Si entonces P − tick > `MESA_ARENA.caducidadInvitadoS`,
     se omite con motivo `caducada`;
   - si cabe sin ceder (regla 4), **corre**: la cancha sigue mientras habla; el invitado comenta hechos
     anteriores, así que va detrás, nunca delante;
   - si chocaría con un clip importante, **detiene**: espera `invitado` de su duración en P = el cursor del
     momento, y después sigue la regla 3 para el clip importante.
6. **Cierre**: la cancha corre hasta `fin`. El cierre empieza cuando la voz queda libre con P = fin y la
   espera `final` cubre su duración.
7. Entre dos clips colocados hay al menos `huecoS` de silencio.

Invariantes, que son las propiedades de las pruebas de § 7:

- (a) nunca delante: todo narrador, invitado y cierre colocado tiene `cursorTick·pasoS ≥ A + reaccionS − ε`
  (cierre: = fin);
- (b) retraso acotado: narrador `≤ A + retrasoMaxS + ε`;
- (c) 1×;
- (d) solo hay esperas de los cuatro tipos;
- (e) sin solapes;
- (f) nunca se omite un clip con `prioridad ≥ prioridadEspera` ni el cierre;
- (g) tramos contiguos que cubren `[0, duracionS]` y terminan en `finTick`;
- (h) determinista.

### 3.3 Ensamblado y reloj

- El WAV es mono a 24 kHz (`wavMono`). Por cada colocada se añaden ceros hasta `round(inicioS·sr)` (si el
  redondeo solapara, se empieza en la longitud actual) y después las muestras del clip. Al final se añaden
  ceros hasta `round(duracionS·sr)`. 60 MB de PCM equivalen a 1.250 s, así que no hay riesgo.
- `Pista` añade `plan`. El segmento visible (transcripción) es `segmentoEn(colocadas, t)`: la última colocada
  con `inicioS ≤ t`, o la primera si no hay. En `"completo"` la relación sigue siendo 1:1 con los tramos, como
  hoy.
- `sincronizar`, la búsqueda (`instanteAudio`), «Restart», la pausa, el fin y el WAV usan `plan.tramos` sin
  cambios en `pista-audio.ts`.
- Al buscar el tick de una espera se cae en el tramo que corre a continuación (contrato vigente del 057).

### 3.4 Saltar la previa

`EstadoNarracion` gana `previa: boolean` (pista sonando o en pausa, con `t < plan.inicioJuegoS`). El valor se
actualiza en `sincronizar`. `ControlesNarracion` gana `saltarPrevia()`, que fija `audio.currentTime =
plan.inicioJuegoS` y sincroniza.

La barra muestra «Skip to kick-off» / «Saltar al saque» (`data-testid="arena-replay-skip"`) solo con
`previa: true`. Al desaparecer el botón, el foco pasa al botón principal: el foco nunca queda en `<body>`
(058 v1.1 § 10).

### 3.5 Textos

- Nota de la barra con narración: se conserva el prefijo «With narration, the audio sets the pace» (lo exige
  la e2e del 057).
  - EN: «With narration, the audio sets the pace: the pitch plays at 1× and only stops for the pre-match
    presentation, a studio guest or to let a key play be called; the voice never comes before the play.»
  - ES: «Con narración, el audio marca el ritmo: la cancha va a 1× y solo se detiene en la presentación, ante
    un invitado de la Mesa o para cantar una jugada clave; la voz nunca se adelanta a la jugada.»
- Panel (detallado), segunda frase nueva:
  - EN: «This detailed account narrates every action in 10-second passages: it lasts several times the match
    and, within a passage, the voice can run ahead of the pitch. Play, under the pitch, uses the match-pace
    narration.»
  - ES: «Este relato detallado narra cada acción en tramos de 10 s: dura varias veces el partido y, dentro de
    un tramo, la voz puede adelantarse a la cancha. Reproducir, bajo la cancha, usa la narración al ritmo del
    partido.»
- Mientras haya una espera de la Mesa o una espera clave, `arena-play-progress` no se usa. Un `<p
  class="arena-muted" data-testid="arena-replay-hold">` dice «Pitch held while the commentator/guest
  finishes» / «Cancha detenida mientras termina el narrador/invitado», sin `role="status"` (no se anuncia en
  cada parada).

### 3.6 El relato detallado (sin cambios de mapeo en P1)

`"completo"` sigue como está: lo cubren e2e no autorizadas a cambiar (§ 8.3), y el texto de § 3.5 deja claro
su límite. En **P2** se ancla por frase (opción B) usando la segmentación por silencios medida en § 1.1, con
la comprobación «número de huecos = número de frases» y un respaldo a la espera por tramo completo.

### 3.7 Lo que se espera (estimación, no medida)

Con los textos reales de `relatoBuffer` (memoria encadenada), duraciones estimadas con el ritmo medido (11,6
car/s + 1,1 s por frase) y el planificador simplificado de
[`estimacion-plan.txt`](../evidencia/repeticion-060/estimacion-plan.txt):

- 60 s de partido dan 74–81 s de pista de narrador (hoy, 204 s), más la previa saltable;
- se omiten de 3 a 5 comentarios menores;
- las esperas suman 7–14 s, casi todas por el «Full time» y el canto del gol;
- los retrasos de inicio van de 0,3 a 2,7 s.

El smoke del domingo medirá lo mismo con Speech real (§ 10).

## 4. Bloque B · Pausar y detener (P1-B)

### 4.1 Una barra junto a la cancha

`.arena-playback` (con la clase y el botón `.btn-primary`, que usa `scripts/grabar-video-final.mjs`) y
`input.arena-seek` se mueven a **justo después de `.arena-pitch-wrap` y antes de `.arena-direction`**. Así se
conserva `.arena-direction + .arena-lineups` (e2e del 056) y la barra deja de quedar bajo la tarjeta de
alineaciones.

| Modo | Contenido de la barra (nombres accesibles EN / ES) |
|---|---|
| Repetición | Play/Pause (sin cambios, `aria-pressed` como hoy) · **Stop / Detener** (nuevo, `data-testid="arena-stop"`) · Restart · Skip to kick-off (§ 3.4) · Speed · With narration. Debajo, el deslizador |
| Directo con búfer | **Pause broadcast / Resume broadcast** (movido; uno solo en la página) · **Stop match / Detener partido** (nuevo, `data-testid="arena-stop"`). Sin deslizador |
| Directo preparado o «directo» heredado | **Stop match / Detener partido** (no hay pausa: no se ve juego que congelar). Sin deslizador |

- «Pause broadcast» sale de la sección `arena-buffer` y se pinta en la barra con `createPortal`.
  - `Arena` crea la ranura `<div className="arena-playback" data-modo="directo" ref={setRanura}>` y pasa
    `ranura` a `ArenaEmisionBuffer`.
  - Mientras `ranura` es `null`, no se pinta en ningún sitio: nunca hay dos.
  - La lógica (`reloj.pausar`/`continuar`, `contexto.suspend`) no cambia.
  - «Turn narration off», «Skip to kick-off» de la antesala y «Enable audio playback» se quedan donde están.
- «Cancel live match» se queda en `ArenaEnDirecto` (lo usa `arena.spec.ts`). Su función pasa a `Arena` por una
  prop estable `alCancelar(fn)`, que registra la función de cancelar. «Stop match» llama a la misma función:
  la misma petición, los mismos estados y el mismo manejo de errores.

### 4.2 Semántica

| Modo | Pausar/Reanudar | Detener |
|---|---|---|
| Repetición sin voz | Play/Pause de hoy | `setReproduciendo(false)`, cursor 0:00. Habilitado si `reproduciendo` o `tiempo > 0` |
| Repetición con voz | Play/Pause de hoy (pausa la pista y la cancha a la vez y reanuda en el mismo `currentTime`) | `controlesVoz.detener()` (cancela el registro o la preparación, pausa el audio y suelta la URL), dueño del reloj `null`, cursor 0:00 y aviso borrado. **La pista preparada se conserva** (`pista.current` y caché por `clave`): Reproducir otra vez no vuelve a pedir `/relato`. Habilitado si `faseActiva(fase)`, `reproduciendo` o `tiempo > 0` |
| Directo con búfer, sesión ejecutándose | «Pause broadcast»: como hoy (reloj y voz congelados; **la generación continúa**, y así lo dice el estado) | Cancela la sesión (DELETE, semántica existente). Al llegar `terminada` (`cancelada`), la emisión se desmonta y cierra su `AudioContext` (ya lo hace `limpiar(true)`). **Nuevo**: el cursor vuelve a 0:00. Lo generado **se queda en esta pestaña** como repetición parcial (p. ej. 0:26), sin enlace para compartir. Las llamadas a modelos ya hechas no se devuelven. Los ajustes y «Start live match» vuelven a habilitarse |
| Directo con búfer, sesión ya completa (emisión aún en pantalla) | Igual | No hay DELETE: la emisión se cierra como «Open available replay» y el cursor queda en 0:00, en pausa y sin voz. El enlace «Open or share this saved match» sigue |
| Directo preparado / «directo» | — | Cancela la sesión, igual que arriba |

`aria-describedby` de «Stop match» apunta a una nota `arena-muted`:

- EN: «Stops the match: generation is cancelled and what was already generated stays in this tab as a partial
  replay, without a share link.»
- ES: «Detiene el partido: se cancela la generación y lo ya generado queda en esta pestaña como repetición
  parcial, sin enlace para compartir.»

Cuando Detener se deshabilita a sí mismo (repetición en 0:00), el foco pasa al botón principal.

### 4.3 Antesala del 058

Pausar durante la antesala ya está cubierto: la retención sigue, la antesala espera a «Resume broadcast» y el
reloj no se mueve (e2e B6, intocable). Mover el botón con un portal no cambia la lógica. Detener durante la
antesala cancela la sesión y desmonta la emisión: no hay saque que soltar.

### 4.4 Teclado

- `keydown` en `window` dentro de `Arena`. Con `key === " "`, sin repetición ni modificadores, actúa si
  `atajoPausa(destino)` es verdadero.
  - El atajo pulsa la acción de pausa de la barra: Play/Pause en repetición, «Pause broadcast» en búfer.
  - Hace `preventDefault` solo cuando actúa.
- `atajoPausa` es puro (`src/ui/atajo-pausa.ts`) y recibe la etiqueta, el rol, `isContentEditable`, si hay
  `tabindex` y si está dentro de `[role=dialog]`. Solo es verdadero si el foco está en `body`, `html`, `main`
  o un elemento no enfocable. Nunca en `input`, `select`, `textarea`, `button`, `a[href]`, `summary`, `audio`,
  `video`, `[contenteditable]`, `[role=slider|button|checkbox|switch|tab|option|combobox|textbox]` ni en
  elementos con `tabindex` (las fichas de la cancha).
- Los botones de pausa llevan `aria-keyshortcuts="Space"`. Bajo la barra aparece la nota «Space pauses or
  resumes when no control has focus» / «Espacio pausa o reanuda si ningún control tiene el foco».

### 4.5 Accesibilidad, idiomas, 360 px y la regla 047

- Nombres accesibles fijos en EN y ES:
  - «Stop»/«Detener» en repetición y «Stop match»/«Detener partido» en directo, para que no se confundan con
    «Stop narration»/«Detener narración» del panel;
  - el resto conserva sus nombres.
- `aria-pressed`: el botón Play/Pause conserva el de hoy (protegido). Los botones nuevos y «Pause broadcast»
  cambian de etiqueta sin `aria-pressed`, para no duplicar la semántica.
- 360 px:
  - la barra se envuelve;
  - cada botón mide al menos 44 px de alto;
  - `scrollWidth ≤ 360`;
  - el borde superior de la barra queda a ≤ 32 px del inferior de `.arena-pitch-wrap` (en 1440 y en 360).
- CSS solo en `.arena-playback[data-modo]`, `.arena-models` y `.arena-replay-hold`, con tokens del 047/055, sin
  hex y sin `transition`/`animation`/`transform`. `css-047` sigue en verde y `contraste.mjs` añade los pares
  nuevos en claro y oscuro.

## 5. Bloque C · Modelos que jugaron (P1-c)

### 5.1 Nombres (`src/arena/modelos-jugados.ts`, puro)

`nombreControlador(id, catalogo)`, con `catalogo` = `infra/modelos-arena.json` importado. Es estático: los
nombres ya son públicos en `/api/arena/modelos` y el archivo no contiene secretos.

- `programado:*` → «Programmed policy» / «Política programada».
- `ensayo:*` o `stub*` → «Rehearsal (no model)» / «Ensayo (sin modelo)».
- `(azure-openai|foundry|foundry-modelos):<d>[:reasoning-x]`, en este orden:
  1. entrada con `nombre === d` → `nombrePublico`;
  2. si no, entrada con `modelo === d` → `«<nombrePublico> (deployment <d>)»` (ejemplo-v3:
     «GPT-6.1 Sol (deployment gpt-6.1-sol)»);
  3. si no, «deployment <d> (not in the catalog)» / «deployment <d> (fuera del catálogo)».
- Cualquier otro id se muestra literal.

### 5.2 Por lado: mezcla y respaldos

`ladoJugado(registro, lado)` cuenta las decisiones de `registro.rondas` (las publicadas hasta ese momento en
directo) por `controlador` y por `origen === "respaldo"`.

- Un solo controlador sin respaldos → su nombre.
- Con respaldos → «GPT-6 Luna (1 of 4 decisions by programmed fallback)» / «GPT-6 Luna (1 de 4 decisiones con
  respaldo programado)».
- Varios controladores → «mixed: GPT-6 Luna ×3, Programmed policy ×1» / «mezcla: GPT-6 Luna ×3, Política
  programada ×1».

### 5.3 Procedencia

`Arena` guarda `contextoModelos`, que se fija en cada carga y se limpia en las mismas transiciones que
`origenTorneo`:

| Carga | Contexto | Procedencia mostrada |
|---|---|---|
| Directo o `?partido=` (asignación de `recibirPreparado`/mensaje `sesion`) | `{ forma: "sesion", asignacion }` | **verificada** si, para cada lado, `controladorVerificado(asignacion, lado).clausula === "modelo"` (058) **y** `asignacion[lado].controlador` coincide con todos los `controlador` de ese lado en `rondas`. Los nombres vienen de `asignacion[lado].nombre`. **Programado, sin IA** si la cláusula es `"programado"` en los dos lados. Si no (grabaciones registradas, `procedencia: "declarada"` o incoherencia), **declarada por el archivo**, con nombres desde `rondas` |
| Ejemplos archivados | `{ forma: "ejemplo" }` | declarada por el archivo (ejemplo archivado del proyecto) |
| Archivo importado | `{ forma: "importado" }` | declarada por el archivo |
| Torneo | `{ forma: "torneo" }` | declarada por el ejecutor del torneo (nombres desde `rondas` + catálogo; la línea 059 sigue igual) |
| «Create recording without AI» y la vista previa inicial | `{ forma: "simulado" }` | programado, sin IA (si alguna decisión no es `programado`, declarada) |
| Cualquier id `ensayo:*` | — | ensayo: entrenadores programados con nombre de prueba |

Registrar una grabación para la voz (`alRegistrar`) **no** cambia el contexto: la sesión de grabación no es la
de la partida.

### 5.4 La línea

Va en `<p className="arena-models" data-testid="arena-models" data-procedencia={…}>`, **inmediatamente
después de `.arena-match-clock`**, siempre que haya un registro, también en directo.

- ES: «Local: {L} · Visita: {V} · {procedencia}»
- EN: «Home: {L} · Away: {V} · {provenance}»

| Procedencia | EN | ES |
|---|---|---|
| verificada | verified: assigned by this session's server | verificada: la asignó el servidor de esta sesión |
| declarada (archivo, importado) | declared by the file, not verified | declarada por el archivo, no verificada |
| declarada (ejemplo) | declared by the project's archived file, not verified | declarada por el archivo archivado del proyecto, no verificada |
| declarada (torneo) | declared by the tournament runner, not verified | declarada por el ejecutor del torneo, no verificada |
| programado | programmed, no AI | programado, sin IA |
| ensayo | rehearsal: programmed coaches with test names | ensayo: entrenadores programados con nombre de prueba |

- Sin `role="status"`.
- El texto **no** contiene «Imported recording:» ni «Two independent», que usan `getByText` en e2e existentes.
- A 360 px se envuelve sin desbordar.
- `arena-live-assignment`, la línea del torneo y `.arena-controller` (ids crudos, protegidos por
  `arena.spec.ts`/`arena-formaciones.spec.ts`) no cambian.

## 6. Constantes (`src/sim/limites.ts`, después de `ANTESALA_ARENA`)

```ts
/** Brief 060 · Pista narrada al ritmo del partido (Reproducir). Medido el 24 oct: con el relato detallado la
 * cancha iba a 0,13–0,29× y la voz se adelantaba hasta 16 s (docs/evidencia/repeticion-060). */
export const REPETICION_NARRADA = {
  /** s de partido mínimos entre que la cancha muestra el hecho y la voz empieza a contarlo (nunca delante). */
  reaccionS: 0.3,
  /** s de partido máximos de retraso de un clip del narrador; más allá se omite o, si es clave, la cancha espera. */
  retrasoMaxS: 3,
  /** Prioridad (PRIORIDAD_EVENTO_ARENA) desde la que un clip nunca se omite: remate (60) o más. */
  prioridadEspera: 60,
  /** s de silencio mínimo entre dos clips colocados. */
  huecoS: 0.25,
  /** Variante pedida a los invitados de la Mesa en esta pista (048: «breve» cae en «completa» si no hay). */
  varianteInvitado: "breve",
} as const;
```

Se reutilizan `RELATO_INTERVALOS.buffer`, `MESA_ARENA.prioridadInvitado`, `MESA_ARENA.caducidadInvitadoS`,
`VOZ_BUFFER.duracionMaxS` (un invitado más largo se omite, como hoy) y `PISTA_MAX_PCM_BYTES`. Ninguna prueba
escribe 0,3, 3, 60 ni 0,25: las leen de `REPETICION_NARRADA`.

## 7. Pruebas unitarias y mutaciones

- `src/arena/__tests__/plan-pista.test.ts`, por propiedades con `prngDerivado` (200 casos):
  - generador de piezas: previa 0–3, narrador cada 5 s con prioridades de la tabla real, 0–4 invitados,
    cierre;
  - duraciones de 0,5 a `VOZ_BUFFER.duracionMaxS`;
  - comprueba los invariantes (a)–(h) de § 3.2.
- Casos fijos:
  - gol tras un comentario largo: el comentario `cede`;
  - dos claves seguidas: la segunda espera, con retraso = `retrasoMaxS`;
  - invitado que choca con un gol: `detiene`;
  - invitado que caduca;
  - sin previa: `inicioJuegoS = 0`;
  - cierre con la voz ocupada.
- Ensamblado (`ensamblarPista`, puro, en `pista-audio.ts`): con clips de muestras conocidas, el desplazamiento
  de cada clip es `round(inicioS·sr)`, no hay solapes y la longitud total es `round(duracionS·sr)`.
- `instanteAudio`/`instanteNarrado` sobre `plan.tramos`: la propiedad inversa del 057 se cumple en los tramos
  que corren, y buscar un tick de espera cae en el tramo siguiente.
- `modelos-jugados.test.ts`:
  - toda entrada `publicar: true` del catálogo se resuelve por `nombre`;
  - `gpt-6.1-sol` se resuelve por `modelo` con el sufijo de deployment;
  - un id desconocido queda «fuera del catálogo»;
  - `programado:` y `ensayo:` dan sus textos;
  - mezcla y respaldos con sus textos;
  - los duelos archivados (los tres de `public/experimentos`) dan los nombres del catálogo (leídos, no
    escritos a mano);
  - procedencias de § 5.3, incluida la rebaja por incoherencia y por `procedencia: "declarada"`.
- `atajo-pausa.test.ts`: la tabla de destinos de § 4.4.

| Mutación | La detecta |
|---|---|
| M1 · inicio en `A` sin `reaccionS` | propiedad (a) |
| M2 · un clip menor con retraso > `retrasoMaxS` | (b) |
| M3 · omitir un clip con prioridad ≥ `prioridadEspera` en vez de esperar | (f) |
| M4 · tramos que corren a 0,9× | (c) |
| M5 · invitado colocado antes de su tick | (a) |
| M6 · previa tras el primer tramo que corre | caso «previa primero» y `inicioJuegoS` |
| M7 · ignorar `voz` (solapes) | (e) |
| M8 · cierre antes de `finTick` | (a)/(g) |
| M9 · ensamblado sin el ajuste de solape por redondeo | prueba de ensamblado |
| M10 · `iniciar()` en `"completo"` | e2e E1 (modo de los pedidos) |
| M11 · `clave` sin el modo | e2e E4 (panel y después barra) |
| M12 · Detener sin volver a 0:00 | e2e E5 |
| M13 · el espacio actúa con el foco en un `select` | unidad y e2e E6 |
| M14 · «Stop match» sin DELETE | e2e E7 |
| M15 · «Pause broadcast» pintado también en su sitio viejo | e2e E7 (uno solo) |
| M16 · verificada con `procedencia: "declarada"` | unidad |
| M17 · no rebajar la incoherencia entre asignación y `rondas` | unidad |
| M18 · no contar respaldos | unidad |
| M19 · buscar por `modelo` antes que por `nombre` | unidad (sol61 frente a gpt-6.1-sol) |

## 8. E2e

### 8.1 Nuevas: `e2e/arena-repeticion-060.spec.ts`

Voz y relato simulados como en el 057: WAV de silencio de duración controlada por pieza, y `construirRelato`
real en `"buffer"` con `memoria` y `cierre`.

- **E1 · Ritmo y orden.** Grabación sin IA de 30 s → Reproducir.
  - Los pedidos son la previa, ventanas de `RELATO_INTERVALOS.buffer` en orden (`modo: "buffer"`), los
    invitados con `variante: "breve"` y el cierre.
  - Con la pista sonando, en un tramo que corre, dos lecturas separadas 1 s dan Δcursor/Δaudio en
    [0,9; 1,1].
  - El cursor coincide con `instanteNarrado(plan.tramos, currentTime)` (± 0,3 s). El `plan` se reconstruye en
    la prueba con `planificarPista` y las duraciones servidas.
- **E2 · Nunca delante.** Con un gol en el registro, se pausa y se busca `currentTime =` el `inicioS` del clip
  del gol: el reloj muestra un tick ≥ tick del gol + `reaccionS`.
- **E3 · Saltar la previa.**
  - Con la previa sonando aparece `arena-replay-skip`;
  - al pulsarlo: `currentTime = plan.inicioJuegoS`, el botón desaparece y el foco queda en el botón
    principal;
  - en ES, «Saltar al saque».
- **E4 · Dos pistas, dos claves.** «Listen from the start» (`"completo"`), «Stop narration», y después
  Reproducir en la barra: pide ventanas `"buffer"` (no reutiliza la detallada). Detener y Reproducir otra vez
  no hace ningún pedido nuevo a `/relato`.
- **E5 · Detener en repetición.**
  - Con voz: audio en pausa sin `src`, reloj 0:00, Play habilitado y foco en el botón principal.
  - Sin voz: el reloj en marcha vuelve a 0:00 y se queda quieto 500 ms.
  - Durante la preparación: cancela sin pedir más tramos.
- **E6 · Espacio.** Con el foco en `body`, el espacio pausa y reanuda (la repetición muda y la pista). Con el
  foco en el selector de velocidad, en el deslizador o en una ficha de la cancha, no hace nada.
- **E7 · Directo con búfer.**
  - Hay un único «Pause broadcast» y su `closest(".arena-board")` existe.
  - Pausa: el reloj queda quieto 2 s y el estado dice «generation continues».
  - «Stop match»: un único DELETE, «Match cancelled», reloj 0:00, Play habilitado y «Start live match»
    habilitado.
  - Durante la antesala retenida (fixture B6 del 058): pausar no suelta el saque.
- **E8 · Modelos por forma.** Duelo, ejemplo-v3, archivo importado, grabación sin IA, `?partido=` de una sesión
  `manual` del servidor (con `CRONISTA_LLM=ensayo`: los ids `ensayo:*` dan «ensayo»), torneo de ensayo
  (fixture 059) y un registro con un respaldo inyectado. En cada uno, `arena-models` muestra el texto y el
  `data-procedencia` de § 5, en EN y ES.
- **E9 · 360 × 780, oscuro y movimiento reducido.**
  - `scrollWidth ≤ 360`;
  - barra a ≤ 32 px de la cancha;
  - botones de ≥ 44 px;
  - `arena-models` visible sin desbordar;
  - capturas en `docs/evidencia/repeticion-060/`.

### 8.2 Existentes que se autoriza a cambiar (solo esto)

`e2e/arena-play-narrado.spec.ts` (057), únicamente en lo que depende del modo de la pista de la barra:

- (i) `simularVoz` responde a `modo: "buffer"` con `construirRelato(…, "buffer", { memoria, cierre })`;
- (ii) `tramosDe` pasa a ser `planificarPista` sobre las duraciones servidas;
- (iii) las secuencias de pedidos esperadas pasan a ventanas de `RELATO_INTERVALOS.buffer` más el cierre. En la
  prueba «200 en dos ventanas y 500 en la tercera», `[0, buffer, 2·buffer]`;
- (iv) `p.modo === "completo"` pasa a `"buffer"`.

No se tocan ni se relajan las tolerancias (0,3 s; 500 ms; 0,01 s), las aserciones de pausa, búsqueda, Restart,
fin, autoplay, 404, 429, 500, WAV y 360 px, ni ningún nombre de botón. Cualquier otra necesidad se escala.

### 8.3 Intocables

- `arena.spec.ts`, `arena-mesa.spec.ts`, `arena-previa.spec.ts`, `arena-descargas.spec.ts`: el panel y la pista
  detallada no cambian.
- `arena-antesala.spec.ts`, `arena-buffer.spec.ts`, `arena-canto-gol.spec.ts`, `arena-sincronia.spec.ts`,
  `arena-variedad.spec.ts`: «Pause broadcast» se busca por rol en la página.
- `arena-torneo.spec.ts`, `arena-formaciones.spec.ts`.

Si alguna falla por el traslado de la barra, se escala sin editarla.

## 9. Prioridades, calendario y estimación

| Bloque | Qué | Estimación (Opus) | Cuándo |
|---|---|---|---|
| Revisión | Codex revisa este brief; v1.1 si hace falta (máximo 3 iteraciones) | 1–1,5 h | sábado 24, mañana |
| **P1-A** | § 3: `plan-pista.ts`, `ensamblarPista`, modo `"ritmo"`, saltar previa, textos, unidades, E1–E4, adaptación de § 8.2 | 6 h | sábado 24 |
| Revisión | Codex revisa la implementación de A | 1 h | sábado 24, noche |
| **P1-B** | § 4: barra trasladada, portal, Detener (repetición y directo), espacio, E5–E7, 360 px | 4 h | domingo 25, mañana |
| **P1-c** | § 5: `modelos-jugados.ts`, línea `arena-models`, E8 | 2,5 h | domingo 25, tarde |
| Cierre | `npm test`, e2e completas, `npm run azure:arena`, smoke público con Speech real (≤ 2 pistas: duelo EN y un `?partido=` ES) que mide § 1.2–1.3 con los mismos scripts, bitácora | 2,5 h | domingo 25, noche |
| — | **Lunes 26 reservado a la entrega**: solo correcciones que bloqueen | — | — |

Total: ≈ 17–18 h, en dos días, con revisiones.

Reglas de corte:

- Si A no está en verde el **domingo a las 12:00**, B se reduce a trasladar la barra y Detener en repetición
  («Stop match» pasa a P2), y C pasa a P2.
- Si A no está el **domingo a las 18:00**, no se publica nada del 060: queda la revisión 0000030 y la
  limitación se declara.

P2, solo después de la entrega:

- anclar por frase el relato detallado;
- no sintetizar los clips que el plan va a omitir (estimándolos por caracteres);
- saltar una intervención de la Mesa;
- «Stop match» con confirmación;
- el deslizador en directo.

Coordinación con el 062: el 060 toca en `Arena.tsx` la barra, el reloj y `contextoModelos`, y el 062 sus
entradas del torneo. Quien llegue después rebasa; los dos están en `main` con commits de rutas explícitas
(nunca `git add -A`).

## 10. Criterios de aceptación (todos vistos correr)

1. `npm test` en verde, con las pruebas y mutaciones de § 7 (cada mutación vista en rojo y revertida).
2. E2e completas en verde. Solo cambió lo autorizado en § 8.2, y el diff de los archivos de § 8.3 está vacío.
3. Smoke público con Speech real:
   - duelo EN: la cancha corre a 1× (± 0,1) en los tramos que corren, y el total de pista narrada es ≤ 1,6 ×
     la duración del partido sin contar la previa;
   - el inicio de los clips del gol y del final queda ≥ `reaccionS` después de su tick, con la cancha ya en
     el hecho (con el mismo método de silencios de § 1.1);
   - se anotan las solicitudes y los caracteres de Speech.
4. En el público, las seis formas de § 1.6 muestran `arena-models` con la procedencia correcta (EN y ES).
5. Pausa y Detener funcionan en directo con búfer, en preparado y en repetición (con y sin voz), a 1440 y a
   360 px.
6. Bitácora con la fila de implementación y las deudas de § 12.

## 11. Fuera de alcance

- Cambiar la pista detallada, la emisión en directo, el contenido de `relatoBuffer` o la Mesa.
- Persistir la preferencia de pausa.
- Atajos distintos del espacio.
- Un selector entre la narración detallada y la de ritmo en la barra.
- Verificar criptográficamente la identidad de los controladores de un archivo.

## 12. Límites honestos y riesgos

- **La pista al ritmo narra una jugada o un comentario por cada 5 s**, como el directo, y no cada pase. El
  relato de cada acción sigue en el panel, que dura varias veces el partido y puede adelantarse dentro de un
  tramo (medido: hasta ≈ 16 s). Queda rotulado, con P2.
- **La cancha se detiene** en cuatro casos:
  - la previa (≈ 43–44 s, saltable);
  - un invitado que chocaría con una jugada clave;
  - una jugada clave que llega con la voz ocupada (≤ la duración del clip anterior);
  - el «Full time».
  En el resto de casos, los invitados hablan con el juego en marcha y van **detrás** (≤
  `caducidadInvitadoS`).
- **«Nunca delante» se mide al inicio del clip.** Speech añade ≈ 0,1–0,3 s de silencio inicial que no se mide
  clip a clip, y que solo hace más tardía la voz. La frase clave (el grito, «¡Remata…!») va al principio de
  su clip.
- **Coste.** Por 60 s y por idioma hay ≈ 13 solicitudes de narrador (antes, 6), más la previa y los
  invitados, pero ≈ 70 % menos caracteres. Los clips que el plan omite se sintetizan igual. En 180 s ES+EN
  puede agotarse el presupuesto por sesión del narrador (80 solicitudes / 24.000 caracteres). Entonces se
  degrada a reproducción muda con aviso, como hoy.
- La memoria encadenada de la repetición no es la de quien oyó el directo: los textos pueden diferir de los de
  la emisión.
- **Detener en directo** cancela la generación: los tokens gastados no se recuperan y lo generado no se
  comparte.
- El espacio no actúa si un lector de pantalla en modo de exploración lo intercepta. Solo se ha probado en
  Chromium.
- **Los nombres de modelo** salen del catálogo empaquetado: un deployment renombrado después saldrá como
  «fuera del catálogo». Los ejemplos del proyecto se rotulan «declarada» aunque su inferencia real esté en
  `docs/evidencia`, porque el servidor no la verifica.
- **Medida pública.** Se creó una sesión real de 30 s (GPT-5.4 mini contra GPT-6 Luna) para medir. Las dos
  pistas de Speech real consumieron ≈ 2 × 9 solicitudes.

## 13. Decisiones de Carlos (con valor por defecto; el implementador no espera)

1. En la pista al ritmo, ¿la previa suena al pulsar Reproducir, con el botón para saltarla? Por defecto, **sí**.
2. ¿«Stop match» sin confirmación? Por defecto, **sí**. La nota explica qué se pierde.
3. ¿Mantener el relato detallado en el panel? Por defecto, **sí**, rotulado.

## Versión 1.1 (24 de octubre): decisiones tras la revisión de Codex

Esta sección **prevalece sobre todo el texto anterior**. Cada hallazgo se comprobó en el código, y el
coordinador decidió por delegación de Carlos. Numeración de Codex.

### (1) Alta · Final del partido: objetivos saturados y excepción terminal — aceptado

Comprobado: con un hecho en `A > fin − reaccionS`, la v1.0 exigía a la vez `P = fin` e invariante (a). La espera
clave podía situarse en `A + retrasoMaxS > fin`.

Contrato nuevo de § 3.2:

- `objetivo = min(A + reaccionS, fin)` y `topeClave = min(A + retrasoMaxS, fin)`.
- **Excepción terminal, declarada:** una pieza con `A + reaccionS > fin` empieza con la cancha **ya en
  `fin`**. Su reacción es `fin − A < reaccionS`, y nunca negativa.
- Se separan dos magnitudes:
  - **retraso de partido**: `P(inicio) − A`, en s de partido. Está saturado: P nunca supera `fin`;
  - **espera de audio**: la duración en s de audio de cada tramo de ancho cero, en `esperas[]`.
  La cota `retrasoMaxS` se aplica al retraso de partido. Las esperas en `fin` (cierre, piezas terminales) no
  cuentan como retraso.
- Invariante (a′): `instanteNarrado(tramos, inicioS).tick · pasoS ≥ min(A + reaccionS, fin) − ε` para toda pieza
  colocada.
- Invariante (b′) [v1.2]: `P(inicio) ≤ min(A + retrasoMaxS, fin) + ε` para el narrador. La igualdad obligatoria
  `P(inicio) = fin` solo rige cuando `A + reaccionS ≥ fin`. Caso fijo obligatorio: `A + reaccionS < fin < A +
  retrasoMaxS`; la pieza puede empezar antes de `fin`, cumpliendo (a′) y (b′).
- El criterio 10.3 pasa a «inicio de los clips del gol y del final ≥ `min(tick·pasoS + reaccionS, fin)`».

### (2) Alta · Invitados: nunca se omiten por `cede` — aceptado

Comprobado: las reglas 4 y 5 se contradecían. Decisión:

- La regla 4 (`cede`) aplica **solo al narrador**.
- Un invitado solo se omite por `caducada` (o por `VOZ_BUFFER.duracionMaxS`, como hoy).
- Choque de un invitado: el invitado chocaría si `inicio + duracion + huecoS > objetivo` del siguiente clip
  con `prioridad ≥ prioridadEspera`, o del cierre. En ese caso el invitado **detiene** la cancha: espera
  `invitado` de su duración. La espera queda rotulada en `arena-replay-hold` con el texto de § 3.5.
- El cálculo de choque **incluye `huecoS`**. Prueba fija: el invitado justo en el límite con y sin `huecoS`.
- Mutación M20: aplicar `cede` a los invitados. La detecta el caso fijo «invitado que choca con un gol → se
  conserva y detiene».

### (3) Alta · Varios hechos importantes en una ventana — aceptado, cambio mínimo y solo para el ritmo

Comprobado en `src/arena/relato.ts:238–240`: `relatoBuffer` ordena los candidatos y narra solo `candidatos[0]`.
Dos goles en 5 s producen un único clip.

Decisión, con el cambio mínimo autorizado y **sin efecto en el directo**:

- `construirRelato(…, "buffer", opciones)` acepta `opciones.evento?: string` (id de evento).
  - Con `evento`, `relatoBuffer` narra **ese** evento en lugar de `candidatos[0]`.
  - El evento debe estar en `(desdeTick, hastaTick]` (o en `tick 0` con `desdeTick 0`) y tener
    `PRIORIDAD_EVENTO_ARENA[tipo] ≥ REPETICION_NARRADA.prioridadEspera`. Si no, error.
  - Incompatible con `cierre` y `entradaTick`.
  - Sin `evento` el resultado es **byte a byte el de hoy**. Prueba de igualdad sobre los tres registros de
    `public/experimentos`, todas las ventanas y los dos idiomas.
- La ruta `/relato` admite `evento: z.string().min(1).max(120).optional()` solo con `modo: "buffer"`, sin
  `intervencion`, `cierre` ni `entradaTick` (400 en otro caso). El directo nunca lo envía.
- Pista de ritmo (§ 3.1, paso 2): por cada ventana, el cliente calcula con el registro los eventos de la ventana
  con prioridad ≥ `prioridadEspera`.
  - La primera petición va sin `evento` y da el de mayor prioridad, como hoy.
  - Por cada evento importante **distinto** del narrado, una petición más con `evento`, en orden de tick.
  - Todas encadenan la `memoria`.
  - Se respeta `PRESUPUESTO_AUDIO_ENCUENTRO`: cada petición extra cuenta como narrador.
- Pruebas:
  - unidad, dos goles en la misma ventana de 5 s (registro sintético construido en la prueba): dos peticiones,
    dos clips colocados y ninguno omitido;
  - gol + tarjeta (amarilla, 85) en la misma ventana: dos clips;
  - un `evento` de prioridad < `prioridadEspera`: 400;
  - mutación M21: ignorar `evento` (narrar siempre `candidatos[0]`). La detecta la prueba de dos goles.
- Los e2e del directo (`arena-buffer`, `arena-antesala`, `arena-canto-gol`, `arena-sincronia`,
  `arena-variedad`) no cambian: siguen en § 8.3.

### (4) Alta · Detener en directo: protocolo explícito — aceptado, con alcance reducido en P1

Comprobado:

- `ArenaEnDirecto.tsx:81` solo reenvía publicaciones si la presentación **no** es preparada.
- La reproducción solo se carga con `completa`.
- `cancelar()` no hace nada sin `id`.

Protocolo P1:

- **Bandera única** `detenidoPorUsuario` en `ArenaEnDirecto`, fijada por «Stop match» y por «Cancel live match».
- **Inicio pendiente (sin `id`):** no se aborta el `POST`, porque el servidor puede haber creado la sesión.
  Cuando llega la respuesta con `id`, se envía DELETE de inmediato y la sesión **no** se adopta: ni `setId` ni
  `alPreparado`. Si el `POST` falla, no hay nada que cancelar.
- **Directo preparado:** DELETE. Ignora cualquier `terminada` posterior, también `completa` (carrera con la
  finalización): no pide `/reproduccion` ni carga nada.
  - La vista vuelve al partido anterior (el registro que había antes de empezar) o a la vista vacía/previa
    inicial, con el cursor en 0:00, sin audio y sin selección.
  - Aparece un aviso `role="status"`: «Match cancelled» / «Partido cancelado».
  - Cargar el prefijo cancelado queda en **P2**.
- **Directo con búfer:** DELETE. Las publicaciones ya están en `Arena`.
  - Con `terminada` cancelada: emisión desmontada (cierra su `AudioContext`), cursor 0:00, sin audio y el
    prefijo visible como repetición parcial local, sin enlace (lo medido).
  - Si la sesión llega a `completa` antes que el DELETE, se respeta `completa` (registro completo y enlace) y
    Detener solo cierra la emisión en 0:00.
- **Limpieza explícita** en todos los casos:
  - `setReproduciendo(false)`, tiempo 0 y `cursor.current = 0`;
  - selección `null`;
  - `sesionActual` (si no hubo `completa`) y `bufferActivo` a `false`;
  - `estadoDirecto` a «esperando»;
  - `controlesVoz.detener()`.
- **E7 amplía:**
  - Detener con el `POST` retenido: un DELETE tras su respuesta, ningún `/eventos` ni `/reproduccion`, y la
    vista anterior;
  - preparado con `terminada: completa` llegando después del DELETE: no se carga;
  - búfer con DELETE y `terminada: cancelada`.

### (5) Alta · Antesala en pausa: se mantiene el límite del 058, declarado y probado — aceptado

Comprobado: `ArenaEmisionBuffer.tsx:530` procesa el tope de pared durante la suspensión («El tope de pared corre
aunque el audio esté suspendido», 058 v1.1 § 2).

- **Se retira** la frase de § 4.3 «la retención sigue» sin matices.
- Contrato vigente: pausar durante la antesala la suspende y congela el reloj. Si la pausa cruza
  `ANTESALA_ARENA.topeS`, el tope **suelta la retención**. Al reanudar, el partido arranca sin completar la
  antesala.
- Límite declarado en § 12.
- E7 añade una prueba: pausa en la antesala más larga que el tope (con reloj de prueba o tope reducido por la
  misma vía que usan las e2e del 058). Al reanudar, el reloj avanza y la antesala no continúa. Antes del tope,
  la retención se mantiene.

### (6) Alta · Timeout del 057 incompatible con 1× — aceptado

Comprobado en `e2e/arena-play-narrado.spec.ts:152–160`: 30 s de grabación y `End of narration` en 20 s.

- Se autoriza **solo** cambiar ese `timeout` por uno derivado del plan:
  `(planificarPista(…).duracionS + 10) · 1000` (los 10 s son el margen de arranque, una constante local con
  comentario).
- Si hace falta, también `test.setTimeout` con el mismo cálculo.
- Las aserciones funcionales no cambian: reloj final, Play habilitado, una reproducción más sin pedidos nuevos y
  una sola grabación.
- La misma regla vale para cualquier otra espera del 057 cuyo valor dependa de que la pista termine; se nombran
  en la bitácora.

### (7) Alta · Oráculos independientes — aceptado

- **Unidad:** los invariantes (a′), (b′) y (c) se comprueban **sobre `plan.tramos`** con `instanteNarrado`, no
  con `colocada.cursorTick`:
  - en el `inicioS` de cada colocada y en cada frontera de tramo, `instanteNarrado(tramos, s).tick · pasoS` se
    compara con el instante del hecho en segundos (`tick · pasoS`), nunca «tick + segundos»;
  - (c) se comprueba muestreando cada tramo que corre en 10 puntos.
  - `cursorTick` debe coincidir con ese cálculo (± 1e-6): mutación M22, desplazar `tramos` sin tocar
    `cursorTick`.
- **Cursor preciso en e2e:** `arena-clock` lleva `data-cursor-s={tiempo.toFixed(3)}`. Es el único cambio de
  marcado para pruebas, y el deslizador (paso 0,1) no sirve de oráculo.
- **E1/E2 sin el planificador:**
  - cada clip simulado es un **tono** de amplitud constante y duración conocida, distinta por pieza;
  - la prueba descarga el blob de la pista (`audio.src`), lo decodifica y localiza el inicio de cada clip por
    sus muestras no nulas;
  - para cada inicio, con el audio en pausa, `currentTime` = inicio y `data-cursor-s` ≥ `min(tick del
    fragmento servido · pasoS + reaccionS, fin) − 0,05`;
  - además, una **reproducción efectiva**: con el audio sonando, la primera muestra con `currentTime ≥` inicio
    del clip del gol cumple lo mismo (− 0,1 por la cadencia del RAF);
  - el ritmo de 1× se mide con dos lecturas de `data-cursor-s` y `currentTime` dentro de un tramo sin tono.
  - `planificarPista` solo se usa en las e2e para el timeout de (6).

### (8) Media · M19 no discriminaba — aceptado

Unidad con catálogo sintético: la entrada X tiene `nombre: "dep-a"` y la entrada Y tiene `modelo: "dep-a"`.
`nombreControlador("azure-openai:dep-a:reasoning-low")` debe dar el nombre de **X**. M19 (buscar por `modelo`
primero) queda en rojo.

### (9) Media · Espacio: ancestros y acción por fase — aceptado

- `atajoPausa(cadena)` recibe la **cadena de ancestros** desde el destino hasta `document.body`:
  `{ etiqueta, rol, tieneHref, editable, tabindex }[]`.
- Es falso si **algún** eslabón es interactivo (la lista de § 4.4 más `a` con `href`), editable, tiene
  `tabindex`, o está dentro de `[role=dialog]`. Así se cubren los descendientes no enfocables de un botón.
- El espacio **solo pausa o reanuda cuando hay reproducción o emisión activa**:

| Situación | Espacio |
|---|---|
| Repetición muda reproduciendo | pausa (como Pause) |
| Repetición muda pausada por el usuario (bandera `pausadaPorUsuario`, que se borra al detener, al llegar al final, al cargar y al buscar a 0:00 con Restart) | reanuda |
| Pista `sonando` | pausa |
| Pista `pausada` o `pulsar` | reanuda |
| `registrando` / `preparando` | **nada** (no cancela la voz ni arranca la reproducción muda) |
| Inactiva, final, error o sin partido | nada |
| Búfer `reproduciendo` / `recuperando` | Pause broadcast |
| Búfer `pausada` | Resume broadcast |
| Búfer `preparando` / `final` | nada |

- Unidad: tabla de destinos con descendientes (`span` dentro de `button`, texto dentro de `summary`), diálogo y
  `a` con y sin `href`.
- E6: preparación retenida, donde el espacio no hace pedidos ni cambia el reloj, y búfer.

### (10) Media · Procedencia por lado — aceptado

- La identidad y la procedencia se resuelven **por lado** (`ladoJugado` + `procedenciaLado`):
  - **verificada**: sesión del servidor con `controladorVerificado(…).clausula === "modelo"` y todas las
    decisiones de ese lado con `controlador === asignacion[lado].controlador`;
  - **programado, sin IA**: cláusula `"programado"` (sesión) o forma `simulado`, y **todas** las decisiones del
    lado con `tipo === "programado"` e id `programado:*`. La coherencia se exige también a los programados;
  - **ensayo**: todas las decisiones del lado con id `ensayo:*`;
  - en cualquier otro caso, **declarada** con el calificativo de la forma de carga. Una incoherencia rebaja
    a declarada y añade «(assignment and record differ)» / «(la asignación y el registro difieren)».
- **Sin decisiones** (directo al empezar, registro sin rondas):
  - sesión → nombre de `asignacion[lado].nombre` con «(no decisions yet)» / «(sin decisiones aún)» y la
    procedencia de la asignación («verificada» solo si la cláusula es `"modelo"`);
  - sin sesión → «no recorded decisions» / «sin decisiones registradas».
- **Agregación:**
  - si los dos lados comparten procedencia, un solo sufijo final, como en § 5.4;
  - si difieren, sufijo por lado: «Local: A (verificada) · Visita: B (ensayo: …)»;
  - `data-procedencia` vale la común o `"mixta"`.
- **E8**: fixtures servidos por `page.route` sobre `/emision` y `/reproduccion` (como `arena-sincronia.spec.ts`),
  con oráculo independiente: los nombres esperados se leen del JSON del catálogo con una búsqueda local de la
  prueba y los rótulos son los literales de la tabla. Casos:
  - **verificada** (asignación `manual` con ids `azure-openai:cronista-*` de catálogo y rondas coherentes);
  - **incoherente** (la asignación dice luna6 y las rondas dicen rapido);
  - **mixta** (un lado verificado y el otro con respaldo y otro id);
  - **sin decisiones**;
  - y, sin mock, ejemplos, importado, simulado y torneo de ensayo.

### (11) Media · Viabilidad y coste — aceptado; compromiso reducido

- **Medición previa obligatoria** (primer paso de A, ≈ 45 min, sin Speech), con `construirRelato` +
  `prepararVoz(…).caracteresPresupuestados`, script en `docs/evidencia/repeticion-060/`:
  - solicitudes y caracteres **SSML** por clase (narrador, cierre, invitado, previa), por idioma y por pista
    (ritmo y detallada);
  - para los tres registros de `public/experimentos`, un `?partido=` con Mesa y 180 s;
  - escenarios: solo ritmo; detallada y después ritmo; directo y después ritmo, con las mismas ventanas
    `buffer`, pero con memoria distinta, así que sin caché compartida.
  - **Puerta:** si un escenario de 60 s supera el 50 % de `PRESUPUESTO_AUDIO_ENCUENTRO` (solicitudes o
    caracteres), se escala al coordinador antes de seguir. El resultado se anota en § 12.
- **Compromiso:**
  - se compromete **solo A corregido** (§ 3 + (1)(2)(3)(6)(7) + la medición);
  - **B** (barra, Detener, espacio, con (4)(5)(9)) y **C** (modelos, con (8)(10)) quedan **condicionales**;
  - prioridad **A > B > C**, pero **C puede adelantarse** a B porque Carlos lo pidió y es barato (≈ 2,5 h).
- **Calendario revisado (sustituye a § 9):**

| Cuándo | Qué | Estimación |
|---|---|---|
| Sábado 24 | Medición de coste (puerta) · A completo con unidades, M1–M9 y M20–M22, E1–E4 y § 8.2 + (6) | 7–8 h |
| Sábado 24, noche | Revisión de Codex de A; una pasada completa de e2e **medida** (se anota su duración) | 1,5 h + pasada |
| Domingo 25, mañana | Correcciones de A (reserva de 2 h) y otra pasada completa | 2 h + pasada |
| Domingo 25 | Con el tiempo que quede, medido: C (2,5 h) y/o B (5 h, con el protocolo de (4)) | condicional |
| Domingo 25, noche | Publicación, smoke público con Speech real (≤ 2 pistas) y bitácora | 2 h |
| Lunes 26 | Reservado a la entrega | — |

- **Reglas de corte:**
  - B o C solo empiezan si quedan, medidas, sus horas más una pasada completa de e2e antes de las 18:00 del
    domingo;
  - lo que no empiece pasa a P2 y queda en la bitácora;
  - si A no está en verde a las 18:00 del domingo, no se publica nada del 060.

### Resto de cambios derivados

- **§ 7:** se añaden M20 (cede a invitados), M21 (ignorar `evento`) y M22 (desplazar `tramos`). M1–M8 se
  comprueban sobre `tramos` (7).
- **§ 8.2:** se añade lo autorizado en (6). Por (3), `src/arena/relato.ts` y la ruta `/relato` cambian solo
  como dice (3), y la prueba de igualdad sin `evento` protege el directo.
- **§ 12, límites nuevos:**
  - excepción terminal (1);
  - la antesala puede soltarse durante una pausa larga (5);
  - en preparado, detener no conserva lo generado (4, P2);
  - las peticiones extra por ventanas con varios hechos importantes (3) cuentan para el presupuesto del
    narrador.


## Versión 1.2 (24 de octubre), cerrada

La segunda revisión de Codex dio por cerrados 10 de los 11 hallazgos. Opus corrige el invariante terminal (b′), que
en la v1.1 obligaba a `P = fin` aunque la reacción completa cupiera antes del final. Ahora (b′) es una cota superior,
`P(inicio) ≤ min(A + retrasoMaxS, fin) + ε`, y la igualdad con `fin` solo rige cuando `A + reaccionS ≥ fin`. Se
añade el caso fijo `A + reaccionS < fin < A + retrasoMaxS`. Sin otros cambios. Prevalece sobre la v1.1 en este punto.
