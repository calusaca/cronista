# 058 — Narración por defecto en el directo y antesala hablada antes del saque

## Estado

Brief **cerrado** el 23 de octubre de 2026. Lo escribió Opus en el papel de diseñador, porque Fable no tiene
cupo; no hay código de producción.

**Versión 1.3 (24 de octubre), cerrada.** Dos correcciones antes del bloque B: hechos por clip e idioma, y la e2e
B5 con clips de 20 s (≤ `VOZ_BUFFER.duracionMaxS`). Ver la [sección final](#versión-13-24-de-octubre-dos-correcciones-antes-del-bloque-b).

**Versión 1.2 (23 de octubre), cerrada.** La segunda revisión de Codex cerró 11 de 12 hallazgos y encontró un
error nuevo (N1): la transferencia de retención mezclaba `Date.now()` con `performance.now()` y segundos con
milisegundos. Opus lo corrige en la decisión del cambio de idioma con `venceMs` monotónico, con prueba y mutación.

**Versión 1.1 (23 de octubre).** La revisión de Codex de la v1 la dio por NO CERRADA: 7 hallazgos altos y 5
medios, en el ciclo 1 de 3. Cada hallazgo se verificó contra el código. Las decisiones de la
[sección final](#versión-11-23-de-octubre-decisiones-tras-la-revisión-de-codex) **prevalecen sobre todo el
texto anterior** donde lo contradigan; el cuerpo solo se corrigió donde afirmaba algo falso (§ 9). Se implementa después del [057](057-play-narrado-y-gol.md) v1.3, publicado en
`cronista-arena--0000023`. La entrega del hackathon es el 27 de octubre y **el 26 queda reservado a la
entrega**: despliegue, smoke público, video y envío.

Pedidos de Carlos (23 de octubre), textuales:

1. «sobre la narración, podemos hacer que comience siempre por default, es un poco enredado comenzar el juego
   y correr a iniciar la narración».
2. «Analizar si es necesario y si se puede hacer antes de iniciar el juego, apenas tenemos la información de los
   equipos que la narración comience hablando sobre los equipos, un overview, las formaciones, diciendo los
   nombres por línea y el entrenador, como a modo de introducción y proveyendo tiempo para que se genere el
   juego. Si fuera posible, a como dicen el nombre que en la pantalla se muestre a quién se refiere y sus
   estadísticas.»
3. Indicación posterior: «revisa los transcripts en docs/DatosPrueba para ver ejemplos de presentaciones».
   Se usan **solo patrones y estructura**; ninguna frase, nombre ni dato entra al repositorio
   ([referencias](../referencias-transcripts.md)). Las plantillas nuevas pasan la prueba de huellas.

Tres bloques con corte (§ 10):

| Bloque | Prioridad | Qué entrega |
| --- | --- | --- |
| **A · Narración activa por defecto** | P0, no se recorta | Quien pulsa «Iniciar partido en vivo» oye la emisión sin otro clic. El audio se desbloquea en ese gesto, la preferencia se recuerda y hay un control claro para silenciar. |
| **B · Antesala** | P1 | En cuanto llega la configuración, la narración presenta los equipos: formación, controlador, once por líneas y entrenador. El saque espera a que termine la antesala o se llene el búfer, lo que llegue después, con un tope y un botón para saltarla. |
| **C · Resaltado sincronizado** | P1-b, se recorta primero | Mientras se nombra una línea, sus fichas se iluminan en la tarjeta de alineaciones y una tira «En voz» muestra el perfil previo de esos jugadores. Antes del partido no hay estadísticas de juego y no se inventan. |

Reglas que no se negocian:

- Todo lo hablado y lo mostrado sale de `RegistroArena` o de la asignación pública de la sesión.
- Plantillas deterministas ES/EN con reconstrucción exacta; sin LLM en la antesala.
- La antesala no cambia el motor, `RegistroArena`, el validador, los fixtures, V1–V8, D1–D5, la Mesa, el canto
  ni el 057.
- La regla 047 sigue intacta: sin `transform`, `transition` ni `animation` CSS en `.arena-player`,
  `.arena-ball` y `.arena-referee`.
- Cada constante nueva vive en `src/sim/limites.ts`, y ninguna prueba repite cifras a mano.

## 1. Hechos verificados (23 oct, código y evidencias)

### 1.1 La narración en el directo hoy

- **El arranque.** «Iniciar partido en vivo» (`src/ui/ArenaEnDirecto.tsx:153`) llama a `comenzar()`. Esa
  función hace `POST /api/arena/sesiones` y, con el `id`, pide `/emision` (reintenta el 409 ocho veces cada
  250 ms). Después pasa la instantánea a `Arena.recibirPreparado`, que monta
  `<ArenaEmisionBuffer key={sesion}>` (`Arena.tsx:377`).
- **La voz arranca apagada.** `ArenaEmisionBuffer.tsx:82` tiene `voz = false`. El botón «Activar narración» /
  «Enable narration» (`:389`) llama a `cambiarVoz()`, y es ahí, dentro de un clic, donde se crea el
  `AudioContext({ sampleRate: 24000 })` (`:128`).
- **Web Audio, no `<audio>`.** El directo usa Web Audio, no un elemento `<audio>` (ese lo usa `ArenaNarracion`
  en la repetición completa). Por eso lo que hay que cebar en el gesto es el `AudioContext`.
- **El estado «pulsar».** Si `resume()` no deja el contexto en `running`, aparece «Habilitar reproducción de
  audio» (`:109–116`, `:390`).
- **Un riesgo actual.** Si la promesa de `resume()` nunca se resuelve, `reanudando` queda en `true` y el botón
  no aparece.
- **El reinicio.** Cambiar de idioma o de sesión reinicia todo y deja la voz apagada (`:102–107`).
- **Las e2e de voz en búfer cargan el enlace compartido.** Casi todas abren `?partido=ID&vista=buffer` y luego
  pulsan «Enable narration»: `arena-buffer`, `arena-mesa`, `arena-sincronia`, `arena-variedad`,
  `arena-canto-gol`, `arena-reservas` y `arena-previa`.
- **Dos pruebas cambian el idioma antes de pulsar.** `arena-reservas.spec.ts:78–81` pasa a español y pulsa
  «Activar narración», y ese cambio de idioma ya cuenta como gesto del usuario.
- **Ninguna e2e con voz simulada pulsa «Start live match».** Las que lo pulsan (`arena.spec.ts:150`,
  `arena-formaciones.spec.ts:40`, `arena-buffer.spec.ts:145`) corren contra el servidor de e2e sin
  `ARENA_VOZ`, donde `/herramientas` devuelve `voz: false`.

### 1.2 Por qué no sonó la previa en el directo (toma 2 del video, 23 oct, rev. 0000021)

Datos: [`guion-video.md`](../entrega/guion-video.md), fila 0:22–0:36, y los registros locales de la toma
(`.cache/video-final/toma2/datos.json`: marcas, `peticionesRelato`, `eventosAudio`). Los tiempos se cuentan
desde la carga de la página.

| t (s) | Hecho |
| --- | --- |
| 17,2 | Clic en «Start live match» (GPT-6 Sol contra GPT-6 Luna). |
| 22,5 | Respuesta del `POST`: aparece la asignación (5,3 s en la réplica pública). |
| 24,7 | Ya existe el botón «Enable narration», así que la instantánea con `config` e `inicial` había llegado. Estado: «Preparing broadcast · 0/20 s ready». El guion lo pulsa en ese momento. |
| 25,5–26,6 | Las tres piezas completas de la previa llegan con 200: 12,8 s, 12,7 s y unos 15 s de audio. |
| 26,8 | Suena una **reserva pregrabada**. |
| 27,8 | Primer avance: `/relato` del tramo 0–20 y la entrada «The kick-off belongs to…». |
| 28,0 | El reloj ya corre: el tramo del saque corta la entrada a los 0,2 s. La previa pide la breve (una con 429) y no vuelve a sonar. |

Las causas encadenadas son cinco:

1. La voz estaba apagada y se activó 7,5 s después del clic.
2. El coordinador no deja hablar a un invitado antes de la entrada del narrador (`aperturaPendiente`, 045
   v3.1; `turnos.ts:85`).
3. La entrada solo se pide con un avance publicado (`hastaTick > 0`, 056 v1.1 § 2;
   `ArenaEmisionBuffer.tsx:178`).
4. Con el primer avance, la reserva de 20 s se llena casi al instante: `RitmoProduccionBuffer`
   (`buffer.ts:17–29`) produce los primeros 20 s sin pausa y la siguiente ronda es en el tick 300. Por eso el
   reloj (`RelojBuffer`, `buffer.ts:33–51`, «solo los datos limitan su avance», 038) arrancó 0,2 s después.
5. La reserva pregrabada ocupó la fuente activa del hueco.

Entre «tenemos la configuración» y el saque hubo unos **3 s**. La previa necesitaba unos 40 s.

### 1.3 Cuánto tarda en generarse el primer búfer

- **`inicio` se publica primero.** `inicio` (con `config` e `inicial`) se publica **antes** de la primera
  decisión (`coordinador.ts:66`, luego `esperando`, luego la ronda). La configuración llega con la primera
  instantánea, 1–8 s después del clic según la réplica (7,5 s en la toma 2).
- **El primer avance espera a la primera ronda.** Con LLM, los dos controladores deciden la ronda del tick 0 en
  paralelo. Latencias del 052: Sol, mediana 6,5 s y máximo 10,9 s; Luna, 6,1 y 8,5 s; Astra, 9,4 y 10,6 s.
  El reloj arranca unos **7–16 s** después del clic (10,8 s en la toma 2).
- **Con controladores programados**, en unos 1–2 s.
- **Después de los 20 s iniciales**, el productor sigue un reloj absoluto a 1×. Si un cliente retiene su reloj,
  la reserva crece y no se pierde nada.

### 1.4 Speech: no hay marcas de tiempo fiables dentro de un clip

`sintetizarVoz` (`voz.ts:159–172`) usa la API REST `tts/cognitiveservices/v1`. Devuelve **solo el MP3**: sin
eventos `bookmark` ni `WordBoundary`, que existen únicamente en el SDK por WebSocket, que no está en el
proyecto. `prepararVoz` mete cada fragmento en `<s>…<break/></s>` y no emite `<bookmark>`. **Decisión**: la
sincronía se hace **por clip**. Cada línea de la alineación es un clip propio y el consumidor sabe con
exactitud cuándo empieza y termina cada uno (`AudioBufferSourceNode.start/onended`). No se estiman tiempos
dentro de un clip.

### 1.5 Presupuestos de Speech vigentes

- **Por encuentro** (`sesiones.ts:38–60`, `rechazoCuotaVoz`), cada clase cobra solo de su bolsa:
  - narrador: 80 solicitudes / 24.000 c de SSML, con la reserva del cierre dentro;
  - invitados: 16 / 4.800 (`MESA_ARENA.dialogo.bolsaSpeechInvitados`);
  - previa: 12 / 9.000 (`PREVIA_ARENA.bolsaSpeech`).
- **Por día**: 800 audios / 120.000 c, en total (`sesiones.ts:358`).
- **Caché.** Cada síntesis se cachea por `claveAudio` en la sesión. Dos espectadores que piden el mismo clip
  pagan una sola vez.
- **Concurrencia.** Hay como máximo **dos consultas `extra` simultáneas en toda la réplica**
  (`sesiones.ts:317`, suma de `extrasActivos`). La tercera recibe 429.
- **Consumo de un directo real (toma 2, 60 s, EN).** 14 tramos y entrada del narrador, 6 de la previa y 6
  invitados; además 2 respuestas 429. Con el tamaño típico del SSML medido (≈ 400 c por tramo, ≈ 550–650 c
  por pieza de la previa) son unos 11.000 c.

### 1.6 Datos disponibles para la antesala y el perfil previo

- `config.partido.{local,visita}.nombre`, `config.formaciones[lado]`,
  `config.entrenadores?[lado].{nombre, perfil}`.
- `inicial.jugadores`: `dorsal`, `nombre`, `puesto`, `nivel` 1–100, `capitan?`, `posicionNatural?` y
  `personalidad?` con su `perfil` y índices 0–100. Desde arena-v2; los v1 traen solo dorsal, nombre, puesto y
  nivel.
- `inicial.arbitro?`.
- **Las líneas existen en el catálogo.** `puestos(f)` y `estructuraBase(f)` (`catalogo.ts:70–71`) devuelven
  los puestos de la línea base en orden, de izquierda a derecha y de atrás adelante. Las doce formaciones
  tienen al menos tres líneas: defensa, una o dos de medio y ataque. Comprobado ejecutando el catálogo.
- **El «entrenador» tiene dos caras.** Una es la **persona ficticia** del registro (`config.entrenadores`). La
  otra es el **controlador** que decide las órdenes: `AsignacionModelos` de la sesión, publicada en el
  mensaje `sesion` y devuelta en `InstantaneaEmision.asignacion`. Puede ser `nombre` «GPT-6 Sol» o similar;
  con `modo: "programado"`, `local.id === "programado"`; con `procedencia: "declarada"`, viene de una
  grabación subida y no está verificada.
- **Cinco modelos públicos.** Con GPT-6 Astra (`infra/modelos-arena.json`, `publicar: true` en el árbol de
  trabajo), el catálogo público tiene cinco: GPT-5.6 Luna, GPT-5.4 mini, GPT-6 Luna, GPT-6 Sol y GPT-6
  Astra. La antesala lee `nombre` de la asignación y no fija ninguna lista.
- **Lo que ya existe del 056.**
  - `previaVisual` y `ArenaPrevia`: tarjeta con media cancha, dorsales, lista `ol` accesible, DT, rasgos,
    banco y chips.
  - `previaPartido`: tres piezas `previa:1-local:0`, `previa:2-visita:0` y `previa:3-condiciones:0`, con su
    escalera, `comprobarPrevia`, `apellidoCorto`, formación hablada con `CANTO_GOL.plantillas.numeros`, bolsa
    12 / 9.000 y la ruta `/relato` con id `previa:*` derivada de `vistaPublicada(id, 0)`.
  - Transcripción del 053 y pista completa del 057, con las tres piezas en el tick 0.

### 1.7 Cómo arrancan las retransmisiones reales (análisis agregado de los 6 transcripts locales)

Solo patrones; sin texto literal. Tres de los seis muestran la previa completa; en los otros tres el archivo
empieza a mitad.

- **Orden típico**: bienvenida, contexto con un dato, alineaciones, entrenador, árbitro, lado o quién saca, y
  paso al saque. La bienvenida aparece en 4 de 6 (los dos sin ella empiezan a mitad de la previa); el
  contexto en 6 de 6; el dato estadístico en 4 de 6.
- **Alineación hablada** en 5 de 6, y de ambos equipos en 4. En 5 de 5 se **empieza por el portero**; en 4
  de 5, **por líneas hasta los delanteros**; en 1, por dorsal ascendente.
- **Nombres**: solo apellidos en 2 de 5, nombre completo en 2, nombre de uso en 1; con dorsal en 3 de 5. La
  formación se dice en cifras en 1 de 5; lo habitual es describirla en palabras.
- **Entrenador** en 5 de 6, y en 4 **pegado a la alineación**, para abrirla o cerrarla. **Árbitro** en 5 de 6
  (4 antes del saque); clima en 3 de 6.
- **Transición al saque** en 6 de 6: cuenta atrás hacia el pitazo (3), relevo al narrador del partido (3) o
  quién está junto al balón (2).
- **Voces**: el narrador lee las alineaciones en 3 de 5; en uno se reparten un equipo por voz. El comentarista
  aporta la formación y el análisis.
- **Duración**: la lectura de una alineación dura entre 13 y 70 s por equipo, con mediana de unos 24 s (en
  TV, 17–32 s); el ritmo es de unos 0,45 nombres por segundo. La previa completa de TV editada dura unos
  2:40; en radio y streaming, 26–42 min.

### 1.8 Medición real de la antesala propuesta (Speech real, 23 oct, voces predeterminadas)

Se hicieron 18 síntesis (9 clips por idioma) con el guion de § 4.1 sobre `arena-llm-v3.json` (4-2-3-1 contra
4-2-3-1) y la misma ruta HTTP y el mismo `prepararVoz` que en producción. Los MP3 y la medición quedaron en el
scratchpad de la sesión de diseño (no se versionan).

| Clip | ES (c / s) | EN (c / s) |
| --- | --- | --- |
| apertura | 71 / 5,40 | 70 / 5,23 |
| cabecera local | 76 / 6,26 | 82 / 6,28 |
| atrás local (POR + 4 DEF) | 76 / 6,72 | 72 / 6,16 |
| medio local (5) | 65 / 5,95 | 67 / 6,12 |
| arriba local + DT | 36 / 4,65 | 44 / 5,11 |
| cabecera visita | 70 / 6,00 | 76 / 6,02 |
| atrás visita | 74 / 6,79 | 70 / 6,74 |
| medio visita | 61 / 5,90 | 63 / 5,80 |
| arriba visita + DT | 37 / 4,65 | 45 / 5,04 |
| **Total** | **566 c / 52,3 s** | **589 c / 52,5 s** |

- **SSML.** 5.889 c en las 18 síntesis, unos 327 c por clip. El sobrecoste de las marcas de un clip de una sola
  voz es de unos 263 c (medido con `prepararVoz`).
- **Ritmo efectivo.** Unos 10,8 c/s, incluido el silencio final de cada clip.
- **Primer guion medido.** Con apertura más larga (con los controladores), cabecera con capitán y cuatro clips
  de línea separados, duraba 59,5 s en ES y 59,2 s en EN, en 11 clips. Se descartó por largo.

Con los huecos entre clips (8 × 0,3 s) y la entrada del narrador (unos 3 s), la **antesala dura unos 58 s**.
Las alineaciones solas (dos equipos) ocupan unos 47 s, unos 23,5 s por equipo: dentro de la mediana de TV.

## 2. Análisis: ¿hace falta la antesala?

- **Para cubrir la generación, no hace falta.** El primer búfer está listo 7–16 s después del clic con LLM y
  1–2 s con programados (§ 1.3). Una presentación con nombres dura unos 58 s (§ 1.8). La antesala **no
  esconde una espera**: **retrasa el saque** unos 40–50 s con LLM y unos 55 s con programados respecto de hoy.
  Hay que decirlo así.
- **Para la historia y la demo, sí aporta.**
  - Hoy la previa hablada del 056 no suena nunca en el directo (§ 1.2).
  - Es lo que hace una transmisión (§ 1.7).
  - Da a los jueces el «quién es quién» antes de ver jugar: las fichas se encienden al oír sus nombres.
  - Presenta qué modelo dirige cada equipo, que es el corazón del producto.
- **Honestidad.** Todo es dato del registro o de la asignación, con reconstrucción exacta. No hay pronósticos
  ni historial.
- **Alcance y plazo.** Entra con un guion compacto (9 clips, una sola voz), sin estado de sesión nuevo, y con
  el bloque A primero. El resaltado (C) es lo primero que se recorta.
- **Decisión**: se implementa, con tres salvaguardas:
  - un **tope** de 75 s;
  - un botón **«Saltar al saque»** siempre visible durante la antesala;
  - **abandono automático** si la voz falla.

  Si Carlos prefiere no retrasar el saque, la decisión C2 de § 14 desactiva la retención y deja la antesala
  como hoy el 056 (parcial). El cambio es una constante.

## 3. Bloque A · Narración activa por defecto (P0)

### 3.1 Cuándo se activa sola

`narracionAutomatica` es verdadera si se cumplen las tres condiciones:

1. `leerPreferenciaNarracion()` no es `false` (§ 3.3);
2. la sesión **la inició este espectador en esta página** con «Iniciar partido en vivo» y la casilla marcada
   (`arranquePropio(sesion)`, § 3.2);
3. `/herramientas` dijo `voz: true` (el `disponible` que `ArenaEmisionBuffer` ya consulta).

Con un enlace compartido, al recargar la página o al reconectar no hay gesto, y el navegador bloquearía el
audio de todos modos. Se mantiene el comportamiento de hoy («Activar narración»). Así ninguna e2e existente
cambia (§ 1.1), y la prueba de `arena-reservas` que cambia de idioma antes de pulsar sigue igual. Al cambiar de
idioma en una sesión propia, la narración vuelve a activarse sola en el idioma nuevo, si la preferencia sigue
activa y la voz estaba activa antes del cambio.

### 3.2 Desbloqueo dentro del gesto: `src/ui/audio-directo.ts` (módulo nuevo, solo cliente)

```ts
export function cebarAudioDirecto(): void;            // síncrono, dentro del onClick
export function tomarAudioCebado(): AudioContext | null; // lo adopta ArenaEmisionBuffer (una vez)
export function marcarArranquePropio(id: string): void; export function arranquePropio(id: string): boolean;
export function leerPreferenciaNarracion(): boolean;   // por defecto NARRACION_DIRECTO.porDefecto
export function guardarPreferenciaNarracion(v: boolean): void;
```

- **`cebarAudioDirecto()`**, todo síncrono y en `try/catch`:
  1. si no hay contexto cebado o está `closed`, crea `new AudioContext({ sampleRate: 24000 })`;
  2. llama a `resume()` (sin `await`);
  3. arranca un `AudioBufferSourceNode` con un búfer de 1 muestra en silencio hacia `destination`, el
     desbloqueo clásico de WebKit.

  Se llama en el `onClick` de «Iniciar partido en vivo» **antes** de cualquier `await`, y solo con la casilla
  marcada y la voz disponible.
- **Quién lo adopta.** `ArenaEmisionBuffer`, al crear su `Sonido` (`cambiarVoz`, hoy en `:128`), usa
  `tomarAudioCebado() ?? new AudioContext(...)`. El contexto adoptado se cierra en `limpiar()` como hoy. Un
  contexto cebado que nadie adopta (por ejemplo, porque el `POST` falló) se reutiliza en el siguiente clic. Se
  mantiene uno solo por página.
- **`marcarArranquePropio(s.id)`** se llama al recibir el `id` del `POST` (`ArenaEnDirecto.tsx:118`). Es
  memoria del módulo, no de almacenamiento: una recarga la borra.
- **Tope de espera (`NARRACION_DIRECTO.desbloqueoMs`).** Al activar la voz, sola o a mano, se arma un
  temporizador de 1.500 ms. Si al vencer `contexto.state !== "running"`, `pulsar` pasa a `true`. Esto corrige
  también el riesgo de § 1.1 (una promesa de `resume()` que nunca se resuelve).

### 3.3 Preferencia por espectador

- **Clave.** `NARRACION_DIRECTO.clavePreferencia` (`"cronista:arena:narracion"`), con valor `"1"` o `"0"`.
  Si falta o no se puede leer (modo privado, almacenamiento bloqueado), vale `porDefecto` (`true`).
- **Lectura y escritura** en `try/catch`. Una excepción nunca rompe la página ni la emisión.
- **Solo los gestos del usuario escriben**: la casilla de § 3.4, «Activar narración» (`"1"`) y «Desactivar
  narración» (`"0"`). La activación automática no escribe nada.

### 3.4 Interfaz

- **Casilla junto a «Iniciar partido en vivo».**

  ```tsx
  <label data-testid="arena-live-voice">
    <input type="checkbox" checked={narrar} …/> {t("Narrate the match", "Narrar el partido")}
  </label>
  ```

  Solo aparece con `presentacionVista === "buffer"` y `/herramientas` con `voz: true` (`ArenaEnDirecto` lo
  consulta al montar, junto a `/modelos`). Se deshabilita con `bloqueado`. Su valor inicial sale de
  `leerPreferenciaNarracion()` después de hidratar, en un efecto, para no romper el SSR. Si no hay voz, no
  aparece y nada cambia.
- **En el búfer**, con la voz activada sola:
  - el botón existente muestra «Desactivar narración» / «Turn narration off» con `aria-pressed="true"`
    (**mismo texto que hoy**; las e2e lo buscan por nombre);
  - debajo de los controles, una nota fija y sin región viva:

    ```html
    <p class="arena-muted" data-testid="arena-voice-default-note">
    ```

    con el texto «La narración empezó con el partido. «Desactivar narración» la silencia; este navegador
    recuerda tu elección.» / «Narration started with the match. «Turn narration off» mutes it; this browser
    remembers your choice.».
- **Silenciar es un solo clic**, y queda recordado.
- **Sin cambios**: «Habilitar reproducción de audio» (`pulsar`), el aviso de error y el estado de voz. No se
  añade ningún `role="status"` nuevo.

### 3.5 Cuando no hay voz

| Caso | Qué pasa |
| --- | --- |
| `/herramientas` con `voz: false` | La casilla no aparece, no se ceba nada y el búfer muestra el aviso de hoy («El audio no está disponible…»). Sin antesala; el reloj, como hoy. La tarjeta de alineaciones sigue visible mientras se prepara. |
| Autoplay bloqueado | Si el contexto no corre a los `desbloqueoMs`, aparece «Habilitar reproducción de audio». La antesala **no retiene** el reloj mientras el audio no corre (§ 4.5). Si el espectador lo habilita con el reloj aún en 0:00, la antesala empieza entonces. |
| Presupuesto de Speech agotado (429 de la bolsa o del día) o red caída | Cada tramo del narrador falla como hoy: lo cubren las reservas pregrabadas y aparece el aviso existente. En la antesala, cada clip se reintenta una vez (§ 4.6). Tras `maxFallosSeguidos` fallos seguidos, la antesala se **abandona** y suelta el reloj, sin bloquear el saque. |

### 3.6 Coste de «por defecto»

- **Por partido.** Un directo de 60 s escuchado en un idioma cuesta unas **29 síntesis y unos 11.000 c**:
  - 14 del narrador (≈ 5.600 c);
  - invitados, típicamente ≈ 6 (≈ 2.400 c; su tope sigue en 16 / 4.800);
  - antesala, 9 (≈ 2.950 c medidos), que sustituye a las piezas del 056 en ese partido (§ 4.6).

  Las bolsas por encuentro alcanzan: narrador 80 / 24.000, invitados sin cambio y antesala nueva 18 / 10.000
  (§ 7).
- **Por día.** Con el tope de 120.000 c caben **unos 10 directos narrados en un idioma** (unos 5 si se
  escuchan ES y EN), además de lo que gasten las repeticiones del 057 (≈ 8.700 c cada pista de 60 s).
- **Precio.** A unos 15,5 USD por millón de caracteres (precio que usa el 056), el día completo cuesta como
  máximo ≈ 1,9 USD. El modelo elegido no cambia el coste de voz: GPT-6 Astra solo encarece las decisiones,
  no la narración.
- **Decisión.** Se mantiene el tope diario (800 / 120.000). Subirlo a 200.000 c durante la semana de jueces
  (≈ +1,2 USD al día) es la decisión **C1** de Carlos (§ 14). Si se toma, se cambia el literal de
  `sesiones.ts:358` sin tocar nada más.

## 4. Bloque B · Antesala (P1)

### 4.1 Guion (determinista, una sola voz: el narrador)

**Una sola voz** (decisión). En 3 de 5 transcripts el narrador lee las alineaciones. Un diálogo duplicaría las
síntesis y alargaría unos 10–15 s una antesala que ya ronda el minuto. El estadista conserva su papel en las
piezas del 056, que siguen en la repetición y en la activación tardía.

| # | id | Contenido | Fuente |
| --- | --- | --- | --- |
| 1 | `antesala:01-apertura:0` | Bienvenida y cruce de equipos. | `config.partido` |
| 2 | `antesala:02-local-cabecera:0` | Equipo, formación hablada y controlador. | `config.formaciones`, asignación |
| 3 | `antesala:03-local-atras:0` | Portero; defensa (primera línea base). | `inicial.jugadores` |
| 4 | `antesala:04-local-medio:0` | Medio: las líneas base intermedias, en orden. | `inicial.jugadores` |
| 5 | `antesala:05-local-arriba:0` | Ataque (última línea base); cierra con el entrenador. | `inicial.jugadores`, `config.entrenadores` |
| 6–9 | `antesala:06…09-visita-*:0` | Igual para la visita. | — |
| — | entrada del narrador (existente) | «{equipo} prepara el saque de centro.»: el paso al saque. | 045 |

Notas:

- Los nombres hablados son `apellidoCorto(nombre)` (056 § 4.3), en el orden de la línea base: de izquierda a
  derecha y de la línea más retrasada a la más adelantada.
- Si dos jugadores **del mismo equipo** comparten `apellidoCorto`, esos dos se nombran con el nombre completo.
- No se leen capitán, árbitro, clima ni nivel medio: están en la tarjeta y en las piezas del 056, y cada uno
  añadiría unos 2–5 s. Es un recorte declarado: 5 de 6 transcripts nombran al árbitro.

### 4.2 Plantillas (`ANTESALA_ARENA.plantillas`, ES/EN paralelas, verificadas contra las huellas)

| Clave | ES | EN |
| --- | --- | --- |
| `apertura` | «Bienvenidos a la arena: {local} contra {visita}.» | «Welcome to the arena: {local} against {visita}.» |
| `cabeceraModelo` | «{equipo} sale en {formacion}, con {modelo} al mando.» | «{equipo} line up in a {formacion}, with {modelo} in charge.» |
| `cabeceraProgramada` | «{equipo} sale en {formacion}, con un plan programado.» | «{equipo} line up in a {formacion}, on a programmed plan.» |
| `cabecera` | «{equipo} sale en {formacion}.» | «{equipo} line up in a {formacion}.» |
| `atras` | «En la portería, {portero}; en defensa, {defensas}.» | «In goal, {portero}; at the back, {defensas}.» |
| `medio` | «En el medio, {medios}.» | «In midfield, {medios}.» |
| `arriba` | «Arriba, {delanteros}.» | «Up front, {delanteros}.» |
| `entrenador` (sufijo de `arriba`) | « Dirige {entrenador}.» | « {entrenador} is the coach.» |
| `lista` | «A, B y C» | «A, B and C» |
| `dorsal` | «el {n}» | «number {n}» |

- **Qué cabecera se usa.**
  - `cabeceraModelo`: con `asignacion.modo ∈ {azar, manual}`, `procedencia !== "declarada"` y
    `asignacion[lado].id !== "programado"`; `{modelo}` es `asignacion[lado].nombre`.
  - `cabeceraProgramada`: con `asignacion[lado].id === "programado"`.
  - `cabecera`, en cualquier otro caso (sin asignación, grabación subida, controladores declarados): sin
    cláusula de controlador. Nunca se dice un modelo que no esté verificado.
- **`{formacion}`** es la formación en palabras (helper del 056).
- **Sin entrenador** (registros v1) se omite el sufijo `entrenador`.
- **Prueba de huellas.** El tramo literal de cuatro o más palabras se probó en el diseño contra
  `huellas-transcripts.json` y dio 0 coincidencias. La prueba se repite en `antesala.test.ts` con los
  ayudantes de `dialogo.test.ts:386`.

### 4.3 Escaleras (deterministas, anotadas en `auditDialogo.escalones`)

**Por clip**, hasta que `max(ES, EN) ≤ MESA_ARENA.maxCaracteresIntervencion` (210) y cada oración quepa en
`maxCaracteresOracion` (200):

- **cabecera**:
  1. quitar la cláusula del controlador (pasa a `cabecera`);
  2. `{equipo}` pasa a `PREVIA_ARENA.plantillas[idioma].referencias[lado]`.
- **atrás, medio, arriba**:
  1. quitar el sufijo del entrenador (solo en `arriba`);
  2. los nombres de ese clip pasan a dorsales (`dorsal`).

  Con dorsales siempre cabe: seis jugadores dan menos de 90 c.
- **apertura**: si no cabe, **se omite** el clip.

**Por guion**: si la duración estimada supera `ANTESALA_ARENA.objetivoS` (66 s), se aplican estos escalones
en orden mientras siga sobrando:

1. quitar la apertura;
2. quitar las cláusulas de controlador;
3. quitar los sufijos de entrenador.

La duración estimada es `Σ estimarDuracionS(turnos)` (9,5 c/s, conservador frente a los 10,8 medidos) más
`huecoS` por cada hueco entre clips. Nunca se quitan las líneas: son el pedido.

### 4.4 Estructura, hechos y comprobación (`src/arena/antesala.ts`, puro)

```ts
export function antesalaPartido(registro: RegistroArena, asignacion: AsignacionModelos | null): IntervencionArena[];
export const esAntesala = (i: Pick<IntervencionArena, "id">) => i.id.startsWith("antesala:");
export function bloqueAntesala(id: string): { lado: Lado | null; bloque: "apertura" | "cabecera" | "atras" | "medio" | "arriba" } | null;
export function jugadoresDelBloque(registro: RegistroArena, lado: Lado, bloque: "atras" | "medio" | "arriba"): JugadorArena[];
export function comprobarAntesala(i: IntervencionArena, registro: RegistroArena, asignacion: AsignacionModelos | null): { regla: "P1"; detalle: string }[];
```

- **Forma de cada pieza.** Es una `IntervencionArena` con estos campos:
  - `rol: "estadista"`, `tick: 0`, `tema: "antesala"`, `forma: "previa"` y `modo: "determinista"`, la
    misma convención que el 056;
  - `turnos`: **un solo turno** del `narrador` con `funcion: "dato"`, sin `turnosBreve`;
  - una oración por frase; las piezas `arriba` con entrenador llevan dos.
- **Hechos.** Uno por dato, con su procedencia exacta en las `citas` (patrón del 056 v1.1 § 7). Cada hecho
  guarda en `datos` los valores sustituidos:

  | Hecho | `fuente` | `datos` |
  | --- | --- | --- |
  | `antesala:equipos` | `config.partido` | — |
  | `antesala:formacion:{lado}` | `config.formaciones` | `formacion`, `formacion_hablada` |
  | `antesala:controlador:{lado}` | `sesion.asignacion` | `modo`, `id`, `nombre` |
  | `antesala:linea:{lado}:{bloque}` | `inicial.jugadores` | `jugadores` (ids en orden), `puestos`, `dorsales`, `hablados` |
  | `antesala:entrenador:{lado}` | `config.entrenadores` | — |

  `sesion.asignacion` es un valor nuevo del campo libre `fuente`, y se documenta en `protocolo.ts`.
- **`comprobarAntesala`** vuelve a derivar con `antesalaPartido` y compara con `toEqual`. Cada campo distinto
  es un motivo P1 con la ruta del campo, igual que `comprobarPrevia`. La garantía es la reconstrucción exacta;
  D1–D5 y V1–V8 no aplican porque no hay prosa libre ni intercambio compuesto. Las piezas no entran en `mesa`
  ni en el diario, así que `comprobarTurnos` no las ve.
- **Determinismo.** La función depende solo de `config`, `inicial` y `asignacion`. Cliente y servidor la
  calculan igual, byte a byte.

### 4.5 Reloj: retención y suelta (`RelojBuffer`, `buffer.ts`)

- Campo nuevo `retenido = false` y dos métodos:
  - `retener()` solo hace efecto con `estado === "preparando"` y `segundo === inicioS === 0`;
  - `soltar()` lo devuelve a `false`.
- `avanzar()`: después de la comprobación de `pausada`/`final`, devuelve `segundo` sin moverse mientras
  `retenido`. `continuar()` con `retenido` vuelve a `preparando` (no a `recuperando`).
- Al soltar rige la regla de siempre: el reloj arranca cuando la reserva llega a `BUFFER_ARENA.segundos`, o
  ya, si la reserva es mayor. **El saque espera a que termine la antesala o a que se llene el búfer, lo que
  llegue después.**
- `pausar()` durante la retención suspende el audio como hoy; la antesala se reanuda con «Continuar emisión».
- **Retención inicial.** Si `narracionAutomatica` puede llegar a ser verdadera (preferencia activa, arranque
  propio, `inicioTick === 0`), el consumidor llama a `retener()` al montar. Así el reloj no arranca en el
  primer fotograma antes de saber si hay voz. Suelta a los `NARRACION_DIRECTO.esperaHerramientasMs` (1.500
  ms) si `/herramientas` no respondió o respondió `voz: false`, si el contexto no corre a los `desbloqueoMs`,
  o si la antesala no puede empezar. Si la antesala empieza, la retención continúa.
- **Dónde lo ve el espectador.** El estado de `arena-buffer-status`, la única región viva, cambia de texto
  mientras dura la retención:
  - con la reserva por debajo de 20 s: «Presentación del partido · {n}/20 s listos» / «Pre-match presentation
    · {n}/20 s ready»;
  - con la reserva completa: «Presentación del partido · emisión lista» / «Pre-match presentation · broadcast
    ready».

### 4.6 Reproductor de la antesala (`ArenaEmisionBuffer`)

**Empieza** solo si se cumple todo esto:

- voz activa y no silenciada;
- `contexto.state === "running"`;
- `reloj.estado ∈ {preparando, pausada}` con `segundo === 0` e `inicioTick === 0`;
- `antesala.length > 0`;
- la antesala no se ejecutó antes en este montaje.

Vale tanto si la voz se activó sola como a mano. Con el reloj ya en marcha **no hay antesala**: rige el 056.

**Lógica pura** en `src/arena/antesala.ts`: `pasoAntesala(estado, entrada)` devuelve `{ estado, arrancar?,
soltarReloj }`. Las pruebas cubren la tabla siguiente sin DOM.

| Situación | Acción |
| --- | --- |
| Inicio | `reloj.retener()`. Fase `activa`; `inicioAudioS = contexto.currentTime`. |
| Peticiones | En orden del guion, **una a la vez**: el tope global del servidor es de 2 (§ 1.5). Cada una va a `/relato` con `{ desdeTick: 0, hastaTick: 0, modo: "buffer", idioma, intervencion: id, variante: "completa" }`, con plazo de 15 s y validación con `segmentoVozValido`. |
| Mientras está `activa` | No se piden tramos, entrada ni invitados hasta que estén pedidos todos los clips del guion. No suenan reservas, tramos del narrador ni invitados. La entrada puede pedirse en cuanto se pidió el último clip y hay avance. |
| Siguiente clip | Arranca en `max(fin del anterior + huecoS, ahora)` si ya está decodificado. Si no llega en `esperaClipS` (4 s), se marca fallido y se pasa al siguiente. |
| 429, red o 409 | Un reintento a los `reintentoMs` (600). Un 404 es final. |
| Fallos | Tras `maxFallosSeguidos` (2) seguidos, fin con motivo `fallos`. |
| Primer clip que **suena** | Las tres piezas del 056 (`esPrevia`) quedan terminadas (`terminarInvitado`): la antesala las sustituye en esta activación. Si la antesala se abandona antes de sonar, las piezas del 056 siguen como hoy. |
| Fin del guion | Se espera la entrada del narrador hasta `esperaClipS`: si está, suena como último clip; si no (sin avance aún), se termina sin ella y la entrada sonará después, como hoy. |
| Tope | Si `contexto.currentTime − inicioAudioS ≥ topeS` (75 s), no arranca ningún clip más; el que suena termina. El tiempo es el del audio: no corre con la página oculta ni en pausa. |
| «Saltar al saque» | Detiene la fuente, fin con motivo `saltada`. |
| «Desactivar narración» | Fin con motivo `voz-apagada`. |
| Cambio de idioma | `limpiar()` suelta el reloj. Si la nueva activación automática ocurre con el reloj aún en 0:00, la antesala vuelve a empezar en el idioma nuevo. |
| Cualquier fin | `reloj.soltar()`; la emisión sigue con las reglas de siempre. La fase es terminal: no se repite. |

**Botón** `<button className="btn" data-testid="arena-antesala-skip">`, con el texto «Saltar al saque» /
«Skip to kick-off». Se ve solo con la fase `activa`, junto a «Pausar emisión».

**Sin solapes.** Mientras está `activa`, la antesala es la única fuente. Los huecos son de 0,3 s, más la espera
de un clip tardío (≤ 4 s), siempre por debajo de `VOZ_BUFFER.silencioMaxS` (5 s).

### 4.7 Ruta, asignación y presupuesto

- **`/api/arena/sesiones/[id]/relato`.** Un id `antesala:*` sigue la misma rama que `previa:*`:
  - `vista = vistaPublicada(id, 0)` y `asignacion = await gestor.asignacionPublicada(id)` (método nuevo: lee
    `sesion.asignacion` o `meta.json`);
  - `antesalaPartido(vista, asignacion).find(...)`, con 404 «Intervención no publicada» si no existe;
  - la misma ventana `[0, 0]`, `relatoIntervencion`, `prepararVoz` con las voces del catálogo y la síntesis
    vía `gestor.extra(…, clase = "antesala")`;
  - un 409 sin `inicio` se reintenta como en el 056 (`esperaReintentoInvitado` acepta `tema === "antesala"`
    igual que `"previa"`).
- **Cliente.** `Arena` guarda la asignación (`asignacionActual`):
  - se asigna en `recibirPreparado(resultado.asignacion)` y con la publicación `sesion`, y se reinicia con
    cada carga;
  - se calcula `const antesala = useMemo(() => { try { return antesalaPartido(registro, asignacionActual); }
    catch { return []; } }, [registro.config, registro.inicial, asignacionActual])`;
  - se pasa a `ArenaEmisionBuffer` como `antesala` y **no** se fusiona en `mesa`.
- **`ClaseVoz` gana `"antesala"`.** `rechazoCuotaVoz` la cobra solo de `ANTESALA_ARENA.bolsaSpeech` (18 / 10.000
  por encuentro: 9 clips × 2 idiomas). El narrador excluye esa clase de su suma, y ninguna otra bolsa la
  cuenta ni le presta (patrón del 048 v1.3 (1)).
- **Cota.** Con el texto al máximo de la escalera, cada clip mide ≤ 210 c de texto + ≈ 265 de marcas + los
  escapes, unos 520. 18 × 520 son unos 9.400 c. Lo típico, medido, son unos 2.950 por idioma.
- **Coste máximo añadido por encuentro.** ≈ 0,16 USD. El tope diario no cambia.

### 4.8 ¿Estado «antesala» en la sesión? No: basta el cliente

- El servidor no necesita saber nada:
  - cada espectador tiene su propio `RelojBuffer`;
  - el productor sigue su reloj absoluto (§ 1.3), así que la reserva solo crece;
  - la ruta deriva la antesala de lo ya publicado.
- **Dos espectadores** oyen el mismo guion (es determinista y está en caché) y cada uno saca cuando termina su
  antesala.
- **Consecuencia aceptada.** En un partido de 60 s con antesala, la sesión puede terminar en el servidor antes
  del saque visible. El búfer ya lo maneja (`terminada`) y aparece «Abrir repetición disponible» como hoy.

## 5. Bloque C · Resaltado sincronizado (P1-b)

- **Aviso del clip que suena.** `ArenaEmisionBuffer` gana `alAntesala?: (foco: FocoAntesala | null) => void`,
  con `FocoAntesala = { lado: Lado | null; bloque: "apertura" | "cabecera" | "atras" | "medio" | "arriba";
  jugadores: string[] }`. Lo llama al arrancar cada clip de la antesala y con `null` al terminar la antesala.
  `jugadores` sale de `jugadoresDelBloque` (el mismo orden que la voz). `Arena` guarda el foco y lo pasa a
  `ArenaPrevia`.
- **Marcas en `ArenaPrevia`:**
  - `data-speaking="true"` en el `article.arena-lineup` del lado durante `cabecera`;
  - en `.arena-lineup-slot` y en el botón `arena-lineup-player` de cada jugador del bloque;
  - en `.arena-lineup-coach` durante `arriba` si se nombró al entrenador.
- **Tira «En voz»** en `.arena-lineups-head`, visible aunque la tarjeta esté plegada:

  ```tsx
  <div data-testid="arena-lineups-now" className="arena-lineups-now">
  ```

  Contiene «En voz · {equipo} · {Portería y defensa | Medio | Ataque | Formación}» y, para cada jugador del
  bloque, una línea con lo que existe:
  - siempre: dorsal, nombre completo, puesto y «Nivel {nivel}»;
  - si hay `personalidad`: `etiquetasPerfil[perfil]` y `etiquetaTemperamento`;
  - si hay `posicionNatural` y es distinta del puesto: «Rol natural: {posicionNatural}»;
  - «Capitán», si lo es.

  Bajo la tira, siempre, la nota «Perfil previo: índices sintéticos del registro; aún no hay estadísticas de
  juego.» / «Pre-match profile: synthetic indices from the record; no match statistics yet.».
- **Nada inventado.** Ni goles, ni tiros, ni energía, ni promedios que no estén en `inicial`.
- **Accesibilidad.**
  - La tira **no** es región viva: la voz ya informa y `arena-buffer-status` anuncia la fase. No se duplica
    ningún `role="status"`.
  - Sin desplazamiento automático: no se secuestra el scroll.
  - Con movimiento reducido no cambia nada, porque el resaltado es un cambio de atributo sin animación.
  - A 360 px la tira se envuelve; cada línea mide al menos 44 px de alto y `scrollWidth ≤ 360`.
- **CSS** (`globals.css`, tokens del 047/055, sin hex y sin `transition`/`animation`/`transform`):
  - `.arena-lineup-slot[data-speaking] .arena-kit { stroke: var(--ar-select); stroke-width: .9 }`;
  - `.arena-lineup-player[data-speaking] { outline: 2px solid var(--ar-select); background:
    var(--ar-surface-3, var(--ar-surface-2)) }`;
  - `.arena-lineups-now { … }` con la tipografía de la tarjeta.

  `contraste.mjs` añade los pares nuevos (texto de la tira ≥ 4,5; contorno ≥ 3), en claro y oscuro. La
  comprobación `css-047` sigue en verde: no se toca ningún selector de `.arena-player`, `.arena-ball` ni
  `.arena-referee`.
- **Resaltado en la cancha principal** (las 22 fichas del tick 0): **P2** (§ 12).

## 6. Compatibilidad

- **057 (Reproducir narrado) y «Escuchar desde el inicio».** **Sin cambios en P1.** La pista completa
  sigue llevando las tres piezas del 056 en el tick 0, y la antesala es solo del directo. Llevar la antesala a
  la pista completa, con su resaltado por tramos de ancho cero, es **P2** (§ 12). Hasta entonces la repetición
  presenta los equipos más corto que el directo; se declara en § 13.
- **056.** `previaPartido`, la tarjeta, la bolsa 12 / 9.000, la escalera y la transcripción no cambian.
  - En el búfer con antesala, las tres piezas quedan terminadas desde el primer clip que suena (§ 4.6).
  - Sin antesala (activación tardía, enlace compartido con el reloj en marcha), todo sigue como hoy.
- **053 (descargas).** **Sin cambios en P1**: la transcripción sigue listando las tres piezas del 056 en el
  tick 0. Su nota gana una frase, ES y EN: «En el directo, si la narración está activa antes del saque, la
  antesala lee las alineaciones por líneas (plantilla determinista); esta transcripción conserva la previa del
  registro.» Incluir las piezas de la antesala en Markdown y JSON es **P2**.
- **045/048 (Mesa y turnos).** `turnos.ts` no cambia. `aperturaPendiente` y la regla «entrada antes que
  invitados» siguen igual: la antesala ocurre **antes** y fuera del coordinador.
- **047.** Como se dijo en § 5. Los e2e de estilos computados en `.arena-player` y `.arena-ball` siguen igual.
- **Cinco modelos.** La cabecera dice `asignacion[lado].nombre` tal cual (cualquiera de los cinco). Las
  pruebas toman los nombres del catálogo y no fijan cuántos modelos hay. «Modelos al azar» puede elegir GPT-6
  Astra: es coste de decisiones (§ 3.6), no de este brief. Con «dos instancias del mismo modelo», cada
  cabecera nombra el mismo modelo, y es cierto.
- **Video y guía de jueces.**
  - `scripts/grabar-video-final.mjs:204` espera «Enable narration». Se adapta: si el botón muestra «Turn
    narration off», no se pulsa. Es herramienta, no e2e.
  - `docs/entrega/judges-guide.md:30` (paso 4) pasa a decir que la narración arranca con el partido y que
    «Turn narration off» la silencia. La regrabación del video y su guion quedan a criterio de Carlos.

## 7. Constantes (`src/sim/limites.ts`, comentadas, después de `GOL_VISUAL`)

```ts
/** Brief 058 · Narración activa por defecto en el directo (solo cliente). */
export const NARRACION_DIRECTO = {
  /** Preferencia por espectador en localStorage: "1" | "0"; ausente o ilegible ⇒ porDefecto. */
  clavePreferencia: "cronista:arena:narracion",
  porDefecto: true,
  /** Si el AudioContext no corre tras este plazo (ms), se muestra «Habilitar reproducción de audio». */
  desbloqueoMs: 1500,
  /** Retención inicial del reloj (ms) mientras se sabe si hay voz en una sesión propia. */
  esperaHerramientasMs: 1500,
} as const;

/** Brief 058 · Antesala: nueve clips de plantilla, una sola voz, antes del saque. Medido con Speech real el
 * 23 oct: 52,3 s (ES) y 52,5 s (EN) de audio para dos 4-2-3-1; ≈ 327 c de SSML por clip. */
export const ANTESALA_ARENA = {
  bloques: ["cabecera", "atras", "medio", "arriba"],
  /** Silencio (s de audio) entre dos clips de la antesala. */
  huecoS: 0.3,
  /** Espera máxima (s de audio) de un clip aún no decodificado antes de saltarlo. */
  esperaClipS: 4,
  /** Tope (s de audio desde el primer clip) de la retención del reloj. */
  topeS: 75,
  /** Duración estimada máxima del guion (estimarDuracionS + huecos); por encima se aplica la escalera de guion. */
  objetivoS: 66,
  maxFallosSeguidos: 2, reintentoMs: 600, maxReintentos: 1,
  /** Bolsa propia por encuentro: 9 clips × 2 idiomas; cota ≈ 520 c por clip con la escalera al máximo. */
  bolsaSpeech: { solicitudes: 18, caracteres: 10_000 },
  plantillas: { es: { /* § 4.2 */ }, en: { /* § 4.2 */ } },
  /** Rótulos de la tira «En voz» (§ 5). */
  bloquesRotulo: { es: { cabecera: "Formación", atras: "Portería y defensa", medio: "Medio", arriba: "Ataque" }, en: { cabecera: "Formation", atras: "Goal and defence", medio: "Midfield", arriba: "Attack" } },
} as const;
```

**Invariantes probadas desde las constantes**:

- `topeS > objetivoS`;
- `huecoS + esperaClipS < VOZ_BUFFER.silencioMaxS`;
- `desbloqueoMs ≤ esperaHerramientasMs`;
- `bolsaSpeech.solicitudes ≥ 9 · 2`;
- las mismas llaves en ES y en EN;
- `objetivoS` y `topeS` no se repiten como literales en ninguna prueba.

## 8. Pruebas exigidas

**`src/ui/__tests__/audio-directo.test.ts`** (entorno con `localStorage` y `AudioContext` simulados):

- Preferencia ausente → `true`. Con «0» → `false`. Un `getItem` o `setItem` que lanza no rompe nada y
  devuelve `porDefecto`.
- `guardar` escribe «1» o «0».
- `cebarAudioDirecto` crea un solo contexto aunque se llame dos veces. `tomarAudioCebado` lo entrega una vez y
  después devuelve `null`. Un contexto `closed` no se entrega.
- `arranquePropio` solo es cierto para el id marcado.

**`src/arena/__tests__/buffer.test.ts`** (ampliación), sobre `RelojBuffer`:

- Con `retener()`, el reloj no avanza con 30 s de reserva. `soltar()` arranca al momento.
- `retener()` con `segundo > 0` no hace efecto.
- `continuar()` con `retenido` vuelve a `preparando`.
- Las pruebas existentes siguen idénticas.

**`src/arena/__tests__/antesala.test.ts`**:

- **Guion.** Sobre los cuatro fixtures del 056, 60 semillas y las doce formaciones:
  - ids y orden de § 4.1;
  - `atras` = portero + primera línea base, `medio` = las líneas intermedias en orden, `arriba` = la última,
    contra `puestos` y `estructuraBase`;
  - cada nombre hablado es el `apellidoCorto` (o el nombre completo si hay colisión) de ese jugador;
  - el entrenador sale de `config.entrenadores`.
- **Controlador.** Las cuatro ramas de cabecera (`azar`/`manual`, programado, declarada, `null`), con nombres
  tomados del catálogo real (`catalogoModelos`); ninguna dice un modelo con `procedencia: "declarada"`.
- **Escaleras.** Registro con clubes de 100 c y jugadores y entrenadores de 80 c, con `&`, `<` y comillas:
  - cada clip ≤ 210 y cada oración ≤ 200;
  - los escalones salen en el orden fijado y quedan anotados;
  - el clip pasa a dorsales y la apertura se omite;
  - `prepararVoz` no lanza y escapa.

  Guion: sobre fixtures y semillas, la duración estimada es ≤ `objetivoS`; un registro forzado por encima
  aplica los escalones 1 → 3 en orden.
- **v1** (`arena-llm-v1.json`): sin sufijo de entrenador ni perfiles. El guion existe y cabe.
- **Comprobación.** La copia intacta da `[]`. Mutar por separado `texto_es`, `texto_en`, `hechos[k].datos`,
  `citas[j].fuente`, el orden de dos jugadores de una línea, `id`, `tema` o `forma` da exactamente un motivo
  con la ruta. Cambiar el nombre de un jugador en el registro cambia el clip de su línea.
- **Huellas.** Ningún tramo de cuatro palabras de las plantillas coincide con `huellas-transcripts.json`.
- **`pasoAntesala`** (pura), con un caso por fila de § 4.6:
  - orden;
  - hueco;
  - clip tardío saltado a los `esperaClipS`;
  - reintento único del 429 y 404 final;
  - abandono tras `maxFallosSeguidos`;
  - tope por tiempo de audio, que no corre suspendido;
  - saltar;
  - voz apagada;
  - entrada al final, presente y ausente;
  - piezas del 056 terminadas solo cuando suena el primer clip;
  - sin antesala si `inicioTick > 0` o si el reloj ya corrió.

**`src/arena/__tests__/mesa-voz.test.ts`** (ampliación):

- `rechazoCuotaVoz` con clase `"antesala"`: llena su bolsa y rechaza.
- **Aislamiento**: recorridos con y sin antesala a 60/120/180 s, en ES y en ES+EN, comparados por separado.
  Rechazos del narrador idénticos, bolsa de invitados y de previa idénticas.
- **Suficiencia**: las 18 síntesis con catálogo completo y degradado, sobre fixtures, semillas y el registro
  de nombres máximos, caben en la bolsa.
- **Ruta HTTP**:
  - `antesala:03-local-atras:0` sobre una sesión real de `GestorSesiones` da 200 con `tipoRelato:
    "invitado"`;
  - id inventado → 404;
  - `hastaTick: 1` → 400.
- **Cliente frente a ruta**: `relato.fragmentos` de la ruta es `toEqual` a
  `relatoIntervencion(antesalaPartido(registro, asignacion)[k], …)` calculado en la prueba, con la asignación
  de la sesión.
- Ningún mensaje del diario tiene id `antesala:*`.

**`src/ui/__tests__/arena-previa.test.tsx`** (ampliación, bloque C):

- Con `foco` = `atras` local: `data-speaking` está exactamente en los 5 slots y botones de ese bloque (contra
  `jugadoresDelBloque`) y en ningún otro.
- Con `cabecera`, en el `article` del lado.
- La tira lista exactamente los campos de § 5. Con un v1, solo dorsal, nombre, puesto y nivel.
- Ningún número de la tira que no esté en `inicial`.
- Sin `role="status"` ni `aria-live` en la tira.

**Mutaciones que deben salir en rojo** (cada una, ejecutada y con el md5 restaurado, como en el 057):

| Id | Mutación | La detecta |
| --- | --- | --- |
| Ma1 | Cebar el contexto después de un `await` | e2e A1: contexto `running` y creado dentro del clic |
| Ma2 | `porDefecto: false` | e2e A1 |
| Ma3 | La preferencia no se guarda al pulsar «Desactivar narración» | e2e A2 |
| Ma4 | `localStorage` que lanza propaga la excepción | prueba unitaria |
| Ma5 | Activación automática sin arranque propio | unitaria y la suite e2e existente (`arena-mesa`/`arena-reservas`) |
| Ma6 | Sin el temporizador de `desbloqueoMs` | e2e A4 |
| Mb1 | No se retiene el reloj | e2e B1 |
| Mb2 | La entrada antes del guion | e2e B1 |
| Mb3 | Las piezas del 056 no se terminan | e2e B1 (aparece una petición `previa:*` o su fuente) |
| Mb4 | Sin tope | `pasoAntesala` |
| Mb5 | «Saltar» no suelta el reloj | e2e B2 |
| Mb6 | Sin abandono por fallos | e2e B3 |
| Mb7 | La antesala cobra al narrador | `mesa-voz` |
| Mb8 | Nombre de otro jugador en un clip | `comprobarAntesala` |
| Mb9 | Extremos dentro de «medio» | antesala.test |
| Mb10 | Sin resolver colisiones de apellido | antesala.test |
| Mb11 | Escalera desordenada | antesala.test |
| Mb12 | La ruta ignora la asignación | cliente frente a ruta |
| Mb13 | Antesala con `inicioTick > 0` | `pasoAntesala` |
| Mc1 | Foco desfasado un clip | e2e B1 |
| Mc2 | Cifra que no está en `inicial` en la tira | UI |
| Mc3 | Hex en TSX | prueba existente del 055 |

## 9. E2e

**Nuevo `e2e/arena-antesala.spec.ts`** (serializado con los de arena). Patrón de `arena-previa.spec.ts`:
`instrumentar`, WAV sintético de duración fija y `/emision`, `/eventos`, `/herramientas` y `/relato`
simulados.

- **A1 · Arranque con voz por defecto.**
  - Montaje: `/herramientas` con `voz: true`; el `POST /api/arena/sesiones` simulado devuelve un id; la
    instantánea, el prefijo del `arena-duelo-v3.json` recortado al tick 0 con estado `ejecutando`; SSE solo
    `keepalive`. El `AudioContext` está instrumentado (marca de tiempo del constructor y del clic).
  - Clic en «Start live match» con `arena-live-voice` marcada.
  - Se espera:
    - un contexto creado durante el clic (≤ 50 ms) y en `running`;
    - el botón «Turn narration off» con `aria-pressed="true"` sin otro clic;
    - la nota `arena-voice-default-note`;
    - ninguna petición con `variante: "breve"`.
- **A2 · Preferencia.**
  - «Turn narration off» → `localStorage` = «0».
  - Recargar y repetir A1: la casilla aparece sin marcar, la voz no arranca y el botón dice «Enable
    narration».
  - Marcar la casilla e iniciar: arranca, y la preferencia queda en «1».
  - Variante con `localStorage` bloqueado (`addInitScript` que lanza): la página carga y A1 funciona.
- **A3 · Sin voz.** Con `/herramientas` en `voz: false` no hay casilla ni contexto creado, y el reloj se
  comporta como hoy.
- **A4 · Autoplay bloqueado.** `AudioContext.prototype.resume` instrumentado para no resolver nunca, con
  estado `suspended`. Antes de 1,5 s + 0,5 aparece «Enable audio playback». El reloj no queda retenido: llega a
  «0:01» cuando la reserva lo permite.
- **B1 · Antesala completa.**
  - Montaje como en A1. `/eventos` entrega a los 2 s todas las publicaciones hasta el tick 300, así que la
    reserva supera los 20 s enseguida. Cada clip `antesala:*` es un WAV de 0,6 s; la entrada, uno de 0,3 s.
  - Se espera:
    - las fuentes de la antesala en el orden del guion, sin solaparse, con huecos ≤ `huecoS` + 0,2 s;
    - el reloj en «0:00» y `arena-buffer-status` con «Pre-match presentation» durante todo el guion;
    - la entrada después del último clip;
    - el reloj avanzando dentro del segundo siguiente al fin de la entrada;
    - ninguna petición ni fuente `previa:*`;
    - por cada clip, `data-speaking` exactamente en los jugadores de `jugadoresDelBloque` (bloque C), y la tira
      con «In goal» o «Midfield»…
- **B2 · Saltar.** A mitad del guion, «Skip to kick-off»: la fuente se detiene, `arena-antesala-skip`
  desaparece y el reloj avanza en ≤ 1,5 s.
- **B3 · Fallos.** `/relato` responde 404 a `antesala:*`:
  - la retención se suelta en ≤ 2 s;
  - las piezas del 056 suenan como en `arena-previa` (1);
  - no se ve «Pre-match presentation» después de la suelta.
- **B4 · Sin antesala con el reloj en marcha.** Enlace compartido con la instantánea en el tick 300, y
  «Enable narration»: ninguna petición `antesala:*`.

**E2e existentes.** Se espera que **ninguno cambie**, porque la activación automática exige arranque propio
(§ 3.1).

**[Corregido en v1.1 § 11]** La v1 afirmaba aquí que todos los manejadores simulados responden 404 a ids
desconocidos, y es falso. `arena-variedad.spec.ts:26` acepta cualquier petición y `arena-buffer.spec.ts:302`
solo filtra `previa:*`. El análisis por prueba está en la v1.1 § 11.

Solo se autorizan estos cambios:

1. en un manejador de `/relato` que **no** responda 404 a un id desconocido, la misma guarda del 056 para
   `antesala:*`;
2. en `arena-previa.spec.ts` (1) y (4), si el abandono rompe por tiempo una cota, responder 404 a
   `antesala:*` al principio del manejador.

Ninguna aserción se relaja. `arena.spec.ts:499–503` y los textos de `arena-buffer-status` del 038 siguen
protegidos. Opus anota en la bitácora si hizo falta alguno de los dos.

## 10. Prioridad, calendario y estimación

| Día | Trabajo | Corte |
| --- | --- | --- |
| **23 oct** (tarde y noche) | Revisión de Codex de este brief y v1.1, si hace falta (≤ 1,5 h). Opus empieza A si el brief queda cerrado. | — |
| **24 oct** | **A** (≈ 4 h): módulo `audio-directo` 0,75 h; casilla, cebado y herramientas en `ArenaEnDirecto` 0,75 h; activación automática, adopción del contexto, `desbloqueoMs` y cambio de idioma en `ArenaEmisionBuffer` 1 h; pruebas unitarias y e2e A1–A4 1,5 h. **B, primera mitad** (≈ 5 h): `antesala.ts` (guion, escaleras, hechos, comprobación, `pasoAntesala`), constantes y pruebas 3 h; `RelojBuffer` 0,5 h; ruta, `asignacionPublicada`, clase y bolsa, y pruebas HTTP 1,5 h. | A en verde **el 24 a las 14:00**; si no, se escala a Carlos ese día. A no se recorta. |
| **25 oct** | **B, segunda mitad** (≈ 4,5 h): reproductor en `ArenaEmisionBuffer` 2,5 h; e2e B1–B4 1,5 h; smoke local con Speech real en ES y EN, con la duración medida anotada, 0,5 h. **C** (≈ 2,5 h): `alAntesala`, `data-speaking`, tira, CSS, contraste, UI y aserciones de B1. Regresiones (suite e2e completa serializada) y bitácora 1 h. Auditoría (Codex o `auditor-adversario`) 1,5 h. | B en verde **el 25 a las 14:00**, o se revierte entero (nada a medias) y se entrega solo A. C en verde **el 25 a las 19:00**, o se revierte C y queda la antesala sin resaltado. |
| **26 oct** | Reservado a la entrega: despliegue, smoke público (§ 11.5), video si Carlos lo decide, guía de jueces y envío. **Nada del 058 se implementa el 26.** | — |

**Total P1 ≈ 18,5 h** (A 4 + B 9,5 + C 2,5 + regresiones 1 + auditoría 1,5). Es justo para dos días. El orden
de recorte es C → B; A no se recorta.

**P2** (solo si todo P1 está en verde antes del 25 a las 12:00; si no, queda como deuda): antesala en la pista
completa del 057 con resaltado, unas 2 h; piezas de la antesala en la transcripción del 053, 1 h; resaltado en
la cancha principal, 1 h.

## 11. Criterios de aceptación (todos vistos correr)

1. **Suites y build.**
   - `npm test`, `npm run typecheck` y `npm run build` en verde.
   - `npm run e2e -- e2e/arena-antesala.spec.ts e2e/arena-previa.spec.ts e2e/arena-buffer.spec.ts
     e2e/arena-mesa.spec.ts e2e/arena-sincronia.spec.ts e2e/arena-variedad.spec.ts e2e/arena-canto-gol.spec.ts
     e2e/arena-reservas.spec.ts e2e/arena.spec.ts e2e/arena-play-narrado.spec.ts e2e/arena-descargas.spec.ts`
     en verde y serializado, y la suite completa antes del despliegue.
   - `git diff --stat src/arena/motor.ts src/arena/tipos.ts src/arena/turnos.ts src/arena/__fixtures__
     public/experimentos` vacío.
2. **Mutaciones.** Las de § 8, ejecutadas y en rojo, con la lista en la bitácora.
3. **Capturas.** `docs/evidencia/antesala-058/`: 1440×900 y 360×740, en claro y en oscuro, de la casilla, la
   antesala con el resaltado de «atrás» y la tira, y el estado «Presentación del partido».
   `contraste.mjs` termina con código 0.
4. **Smoke local** con `ARENA_VOZ=1` y Speech real: partido programado de 60 s en búfer iniciado con un clic y
   **sin pulsar «Activar narración»**.
   - Se oyen los 9 clips y la entrada antes de que el reloj pase de 0:00, y después el saque.
   - Se anotan la duración real de cada clip frente a § 1.8, los caracteres cobrados a la bolsa `antesala` y el
     segundo del saque, contado desde el clic.
   - Repetición en ES.
   - «Saltar al saque» probado una vez.
   - Escucha humana de la pronunciación de «GPT-6 Sol» y de las formaciones en palabras.
5. **Tras desplegar.** Smoke público del punto 4 con un partido LLM (dos modelos del catálogo), con la evidencia
   en `docs/evidencia/antesala-058/`.
6. **Revisión** de alguien distinto del implementador, Codex o `auditor-adversario`, con veredicto APTO.

## 12. Fuera de alcance (cortes decididos)

- LLM, pronósticos, historial o «clave del partido» opinada en la antesala.
- Diálogo de varias voces en la antesala.
- Árbitro, clima, capitán y nivel medio hablados en la antesala: siguen en la tarjeta y en el 056.
- `<bookmark>` y marcas de tiempo por palabra: exigirían el SDK de Speech.
- Resaltado por jugador dentro de un clip: la sincronía es por línea.
- Activación automática en enlaces compartidos o tras recargar.
- Estado de antesala en el servidor.
- Antesala en la vista «preparada», en `/`, `/match` o `/liga`.
- **P2** (§ 10): antesala en la pista completa del 057, en la transcripción del 053 y resaltado en la cancha
  principal.

## 13. Límites honestos y riesgos

- **El saque se retrasa.** Con la voz activa, el saque visible llega unos 55–65 s después del clic, frente a
  los 2–16 s de hoy. Es el precio de leer las alineaciones (≈ 47 s medidos). Hay botón para saltar y un tope
  de 75 s. En el video de menos de 2 minutos, la antesala habrá que recortarla en montaje.
- **La antesala no cubre la generación, la sustituye como espera.** Con LLM la generación dura 7–16 s; el
  resto es presentación. No se presentará como «tiempo que necesita el modelo».
- **Sincronía por línea, no por nombre.** La ficha se ilumina por grupo (portería y defensa, medio, ataque)
  durante todo el clip. Es exacta respecto al audio, pero no marca cada apellido al pronunciarse.
- **Apellidos.** Por duración, la voz dice apellidos (o dorsales con nombres larguísimos); la tarjeta muestra
  el nombre completo. En 2 de 5 transcripts se usan solo apellidos.
- **Activación automática solo en sesiones propias.** Quien abre un enlace compartido sigue pulsando «Activar
  narración», porque el navegador no permite sonido sin gesto. Si lo pulsa con el reloj en 0:00, oye la
  antesala.
- **Autoplay sin medir fuera de Chromium.** El cebado sigue el patrón conocido para WebKit (silencio dentro del
  gesto) y el estado «pulsar» lo cubre, pero no se ha probado en Safari ni en Firefox.
- **Presupuesto diario.** Con la voz por defecto caben unos 10 directos narrados al día en un idioma. Durante
  el juicio puede agotarse (C1). Agotado, la emisión sigue con reservas pregrabadas y la antesala se abandona.
- **Concurrencia global de Speech (2).** Con varios espectadores a la vez, los 429 alargan la antesala o saltan
  clips (un reintento por clip). No se cambia el tope del servidor.
- **La repetición no coincide con el directo.** Hasta P2, la pista completa y las descargas conservan la previa
  del 056, más breve que la antesala que se oyó en vivo. Las descargas lo dicen en su nota.
- **Sesión terminada antes del saque visible.** En partidos de 60 s con antesala puede aparecer «Abrir
  repetición disponible» mientras se sigue viendo la emisión. Es correcto, pero puede sorprender.
- **Pronunciación.** No se ha escuchado aún cómo suenan «GPT-6 Astra» ni las formaciones en palabras. Se
  comprueba en el smoke (§ 11.4).

## 14. Decisiones de Carlos

- **C1 · Tope diario de Speech.** Mantener 120.000 c / 800 audios (por defecto) o subirlo a 200.000 c / 1.200
  durante la semana de jueces (≈ +1,2 USD al día como máximo).
- **C2 · Retener el saque.** Por defecto, sí, con tope de 75 s. Si prefiere un saque inmediato,
  `ANTESALA_ARENA.topeS = 0` deja la antesala como hoy el 056: suena lo que quepa antes del saque, sin espera.
- **C3 · Regrabar el video** con el directo que ya incluye la antesala, o conservar el tercer corte.

## Versión 1.1 (23 de octubre): decisiones tras la revisión de Codex

Codex revisó la v1 en solo lectura y la dio por **NO CERRADA**: 7 hallazgos altos y 5 medios, en el ciclo 1
de 3. Cada hallazgo se verificó contra el código. El coordinador fijó preferencias para los hallazgos #1–#12 y
tomó por delegación las decisiones C1–C3. **Lo que sigue prevalece sobre el texto anterior.** La numeración es
la del informe de Codex.

### 1. Alto · `turnos.ts` queda intacto — aceptado

Es cierto: § 4.7 pedía ampliar `esperaReintentoInvitado` (que admite 409 solo con `tema === "previa"`,
`turnos.ts:209`), mientras § 6 y § 11.1 exigían que `turnos.ts` no cambiara.

**Decisión**:

- **El reintento de la antesala vive en `pasoAntesala`**, con esta regla:
  - 429, red o plazo agotado: un reintento a los `reintentoMs`;
  - 409 (la vista aún sin `inicio`): hasta `maxReintentos409` (3) reintentos cada `reintentoMs`;
  - 404, 400 o una respuesta inválida (`segmentoVozValido` falso, decodificación fallida o duración fuera de
    rango): fallo final del clip.
- **`turnos.ts` no se toca** (su diff vacío sigue en el criterio 11.1). `segmentoVozValido` y
  `estimarDuracionS` se importan sin cambios.
- En el **servidor**, la rama `antesala:*` de la ruta no llama a `esperaReintentoInvitado`: ese helper es del
  cliente.

Constantes nuevas en `ANTESALA_ARENA`: `maxReintentos409: 3`. `reintentoMs` (600) y `maxReintentos` (1) se
mantienen.

### 2. Alto · Retener el reloj y permitir la antesala son cosas distintas; el límite cuenta desde el clic — aceptado

Es cierto. Un clip puede durar hasta `VOZ_BUFFER.duracionMaxS` (24 s, `buffer.ts:4`), así que dejar terminar el
clip activo alargaba la retención. Además, `topeS = 0` impedía cualquier clip en lugar de dar una antesala
parcial. Se separan dos decisiones:

- **Permitir la antesala** (que suene) depende de las condiciones de inicio de § 4.6, corregidas en § 3.
- **Retener el reloj** depende de `ANTESALA_ARENA.topeS`. Ahora es el **tiempo máximo de retención, en
  segundos de reloj de pared, contado desde el clic que pidió la narración**:
  - el clic de «Iniciar partido en vivo» en una sesión propia; `marcarArranquePropio(id, t0)` guarda
    `t0 = performance.now()` del manejador;
  - o el clic de «Activar narración» / «Habilitar reproducción de audio» en una activación manual.

  La pausa y la página oculta **cuentan**; se declara en § 13.

**Al vencer el límite**, con la antesala aún activa, se hace en el mismo paso:

1. **cortar la fuente** de la antesala que esté sonando (`stop()` y `recuerdo.estado = "interrumpida"`);
2. invalidar el token (§ 4);
3. `reloj.soltar()`.

Fin con motivo `tope`. Así la retención nunca supera `topeS` desde el clic, más un fotograma.

**Un clip que atraviesa el límite** se corta en el límite. Un clip que llega decodificado después del límite
no arranca.

**`topeS = 0`: antesala sin retención.** Es el modo de la decisión C2 si se revierte. El reloj no se retiene
nunca y la antesala suena mientras corre el partido, como hoy la previa del 056:

- un clip de la antesala arranca solo si no hay fuente activa y ningún clip del narrador puede arrancar en ese
  fotograma. La rama de la antesala va después del bucle de clips del narrador y antes de la de reservas;
- suena con prioridad `MESA_ARENA.prioridadInvitado` (20): una noticia del narrador (≥ 35) la interrumpe con
  `planVozBuffer`, el editorial (10) no;
- tras una interrupción, la antesala sigue con el **siguiente** clip en el próximo hueco. El cortado no se
  repite;
- con el cursor por encima de `PREVIA_ARENA.caducidadS` (30 s) no arranca ningún clip más (fin con motivo
  `caducada`);
- el resto de reglas no cambia: piezas del 056 terminadas al sonar el primer clip, resaltado, token,
  «Saltar» (aquí solo detiene la antesala).

**Pruebas en `pasoAntesala`**:

- retención soltada exactamente en `t0 + topeS` con la fuente cortada;
- un clip de 10 s que empieza a `t0 + topeS − 3` se corta a los 3 s y el reloj se suelta en ese mismo paso;
- un clip decodificado después del límite no arranca;
- `topeS = 0`: `retener` nunca vale `true`, una noticia interrumpe un clip, el siguiente arranca en el hueco y
  a los 30 s de cursor no arranca nada.

**E2e B5** (`topeS` real de 75 s es largo para una e2e): la prueba del límite usa `pasoAntesala`. El e2e
comprueba solo que, con clips de 30 s y un clic a `t0`, la fuente se detiene y el reloj avanza entre `t0 + topeS`
y `t0 + topeS + 1,5 s`. Lleva `test.setTimeout(120_000)` y está marcada `@lento` (corre serializada en CI).

### 3. Alto · Una transición atómica de activación y retención — aceptado

Es cierto: § 4.6 admitía empezar con el reloj en `pausada`, mientras `retener()` solo actuaba en `preparando`
(§ 4.5). El bucle avanza el reloj antes de procesar el audio (`ArenaEmisionBuffer.tsx:262`), y la activación
manual no tenía una operación que retuviera antes del siguiente `avanzar`.

**Decisión**: hay una sola transición, pura y síncrona, decidida por
`activarAntesala(entrada) → { retener: boolean; iniciar: boolean; motivo?: string }` (en `antesala.ts`).

- **Dónde se aplica.** El consumidor la llama y aplica `reloj.retener()` **en el mismo manejador
  síncrono**, sin esperar a un fotograma ni a una promesa, en tres sitios:
  - al activar la voz a mano (`cambiarVoz`);
  - al pulsar «Habilitar reproducción de audio»;
  - al montar con activación automática.

  Como el bucle `requestAnimationFrame` solo corre entre eventos, el siguiente `avanzar` ya ve `retenido`.
- **Condición para `retener`**:
  - la antesala está permitida (voz activa, guion no vacío, no ejecutada antes en este montaje);
  - `inicioTick === 0` y `reloj.segundo === 0`;
  - `reloj.estado ∈ {preparando, pausada}`;
  - `topeS > 0` y `ahora < t0 + topeS`.
- **`RelojBuffer.retener()`** se corrige: actúa con `segundo === 0` y `estado ∈ {preparando, pausada}`.
  `continuar()` desde `pausada` con `retenido` vuelve a `preparando`.
- **`iniciar`** (la antesala empieza a pedir y a sonar) exige además `contexto.state === "running"` y que el
  reloj no esté en `pausada`. Si el contexto no corre, la retención se mantiene hasta `desbloqueoMs` y se
  suelta si sigue sin correr (§ 3.2 de la v1).
- **Con la reserva ya completa**, la retención aplicada en el manejador impide el arranque.

Pruebas (unitarias de `activarAntesala` y de `RelojBuffer`; e2e B6):

- (a) activación a mano con la emisión **en pausa** en 0:00: retiene; la antesala empieza al pulsar
  «Continuar emisión»;
- (b) pausa a mitad de la antesala y continuación: el reloj no se mueve, la fuente se suspende y se reanuda, y
  el estado vuelve a `preparando`;
- (c) activación a mano con la **reserva ya completa**, en el mismo fotograma en que el reloj saldría de
  `preparando`: el reloj sigue en 0:00 en el fotograma siguiente;
- (d) activación a mano con el reloj ya en `reproduciendo`: sin retención ni antesala.

### 4. Alto · Un token de ejecución invalidado en cualquier final — aceptado

Es cierto: la v1 no definía la cancelación de las respuestas, decodificaciones y callbacks de la antesala, y
el cambio de idioma soltaba antes de decidir si volvía a retener.

**El token.** Es `s.antesala.token`, un entero que incrementa un contador del componente (`ejecucion.current`,
que sobrevive a `limpiar()`). **Cualquier final** lo invalida: completa, saltada, tope, fallos, caducada,
voz apagada, cambio de idioma, cambio de sesión, desmontaje y `limpiar()`.

**Al invalidarlo**, en el mismo paso:

1. se abortan los `AbortController` de las peticiones de la antesala;
2. se detiene la fuente de la antesala (`onended` comprueba el token y no toca el estado);
3. se llama a `alAntesala(null)`;
4. se suelta o se transfiere la retención (abajo).

**Tras cada operación asíncrona** (respuesta de `fetch`, `json()`, `decodeAudioData`, temporizadores de
reintento, `onended`) se comprueba `token === s.antesala.token && g === generacion.current`. Si no coincide, se
descarta sin efectos.

**Cambio de idioma, transferencia atómica.** En el efecto `[sesion, idioma]`, antes de `limpiar()`:

```ts
// v1.2 (Codex, 2.ª ronda, N1): un único vencimiento en milisegundos monotónicos, reutilizado en activación,
// transferencia y comprobación del tope. Nunca se mezcla Date.now() con performance.now().
const venceMs = t0 + ANTESALA_ARENA.topeS * 1000;
const transferir = reloj.retenido && narracionAutomatica && vozEstabaActiva && performance.now() < venceMs;
```

**[v1.2] Prueba obligatoria:** con `t0` distinto de cero (reloj controlado), la transferencia ocurre antes de `venceMs` y
se rechaza después; B8 se conserva con la reserva completa. Mutación: volver a `Date.now() < t0 + topeS` debe dar rojo.

- **Si `transferir`**, la retención **no se suelta**. `limpiar()` invalida el token viejo y la reactivación
  automática del idioma nuevo hace `activarAntesala` dentro del mismo efecto, sin ceder el control al bucle.
  Reusa el mismo `t0`, de modo que el límite no se reinicia, y crea un token nuevo. La antesala vuelve a
  empezar desde el primer clip en el idioma nuevo.
- **Si no**, `reloj.soltar()` dentro del mismo efecto.

En ningún caso hay un fotograma con el reloj suelto entre las dos operaciones.

Pruebas:

- e2e B7: con la respuesta de un clip retenida, pulsar «Saltar al saque», liberarla y comprobar que no arranca
  ninguna fuente nueva de la antesala, que el foco no cambia y que no hay más peticiones `antesala:*`;
- e2e B8: con la reserva completa y la antesala sonando en EN, pasar a español; el reloj sigue en 0:00 durante
  la transferencia, comprobado en cada fotograma con `requestAnimationFrame` instrumentado; el clip EN que
  llega tarde se descarta, la antesala sigue en ES desde el clip 1 y el límite es el original;
- unitaria: en `pasoAntesala`, con un token distinto toda entrada es nula.

### 5. Alto · Arbitraje de solicitudes en el cliente — aceptado, con alcance acotado

Es cierto: hoy el consumidor puede tener 2 peticiones del narrador y 1 de invitados en vuelo
(`ArenaEmisionBuffer.tsx:178`, `:184`, `:227`). El servidor rechaza con 429 desde dos consultas `extra`
activas **en toda la réplica**, antes de mirar la caché (`sesiones.ts:317`).

**Decisión**:

- **Un árbitro compartido** en el consumidor: `elegirSolicitud(pendientes, enVuelo, fase)`, puro, en
  `antesala.ts`. **Mientras la antesala está activa**, todas las peticiones a `/relato` del consumidor pasan
  por él:
  - **máximo 2 en vuelo por espectador** (`ANTESALA_ARENA.maxEnVuelo = VOZ_BUFFER.concurrencia`);
  - **prioridad**: clip de la antesala, entrada del narrador, tramos del narrador e invitados;
  - **la antesala tiene como máximo 1 en vuelo**, así que siempre queda hueco para la entrada.
- **Los tramos** se pueden pedir con un hueco libre una vez pedidos todos los clips del guion. Sus clips no
  suenan hasta que termina la antesala.
- **Los invitados** no se piden mientras la antesala está activa.
- **Al terminar la antesala**, el árbitro deja de intervenir y rigen los límites de hoy (narrador 2 +
  invitado 1). Limitar a 2 la emisión entera cambiaría los tiempos del 045/048, que cubren e2e protegidos
  (`arena-mesa.spec.ts`, con respuestas retenidas del narrador). Este brief **acota** la preferencia del
  coordinador a la fase en que la antesala compite, y lo declara en § 13.
- **Contabilidad y contención son cosas distintas.** La prueba de aislamiento (§ 8) solo garantiza el
  aislamiento **contable** (`rechazoCuotaVoz`, puro): las bolsas no se prestan. La **contención operativa**
  (429 por las 2 consultas globales) no se aísla; con varios espectadores es un límite declarado.

Pruebas:

- unitaria de `elegirSolicitud`: prioridades, tope de 2 y nunca 2 de la antesala;
- e2e B9, **Speech lento**: cada `/relato` responde a los 2,5 s; un contador de peticiones concurrentes en el
  manejador nunca supera 2; con el último clip aún pendiente, la entrada se pide y no se pide ningún
  invitado;
- e2e B10, **dos espectadores**: dos páginas en la misma sesión simulada; cada una respeta ≤ 2 en vuelo y
  completa o abandona su antesala. La contención real del servidor no se simula: es límite.

### 6. Alto · Cota de SSML demostrada con `prepararVoz` — aceptado; la bolsa se ajusta

Es cierto: el presupuesto cobra el SSML ya escapado (`voz.ts:35` escapa `<>&"'` a entidades de 4–6
caracteres; `voz.ts:128` cobra `ssml.length`). Un nombre lleno de `&` multiplica la longitud, y el tope de 210
caracteres de texto no la acota.

**Decisión**:

- **La escalera de cada clip tiene un segundo criterio**: `longitudEscapada(texto) ≤
  ANTESALA_ARENA.maxTextoEscapadoC` (300). `longitudEscapada` es pura, vive en `antesala.ts` y usa la misma
  tabla de escapes que `voz.ts:35`. Una prueba compara las dos sobre cadenas adversarias, a través de
  `prepararVoz`: tienen que crecer igual.
- **Los escalones no cambian.** Los que vacían nombres (equipo → referencia, nombres → dorsales, quitar
  entrenador, omitir la apertura) dejan solo plantilla y cifras, que no tienen caracteres escapables. Siempre
  hay un escalón que cumple.
- **La cota se demuestra en `mesa-voz.test.ts`**, donde `prepararVoz` es importable (en el servidor): para los
  18 clips (9 × ES/EN) con catálogo completo y degradado (`asignarVoces` con y sin la voz de cada rol), sobre
  los fixtures, 60 semillas, el registro de nombres máximos (100 y 80 c) y un registro **adversario** con
  nombres de 80 `&` y de 80 `'` en clubes, jugadores y entrenadores:
  - cada clip cumple `caracteresPresupuestados ≤ ANTESALA_ARENA.maxSsmlClipC` (590 = 300 + 290 de marcas;
    también se afirma que las marcas miden ≤ 290);
  - la suma de los 18 es ≤ `bolsaSpeech.caracteres`.
- **Bolsa ajustada**: `bolsaSpeech: { solicitudes: 18, caracteres: 10_800 }` (18 × 590 = 10.620).
- Si la prueba no cabe, se **sube la bolsa** a la cifra demostrada y se anota; no se relaja la prueba.

### 7. Medio · `hechos[].datos` compatible con el tipo — aceptado

Es cierto: `HechoVerificable.datos` es `Record<string, string | number>` (`src/analista/tipos.ts:53`). No se
amplía el esquema. **Claves canónicas e indexadas**, desde 1:

| Hecho | `datos` |
| --- | --- |
| `antesala:equipos` | `local`, `visita` |
| `antesala:formacion:{lado}` | `equipo`, `formacion`, `formacion_hablada` |
| `antesala:controlador:{lado}` | `equipo`, `modo`, `controlador_id`, `controlador_nombre`, `clausula` (`modelo`, `programado` o `ninguna`) |
| `antesala:linea:{lado}:{bloque}` | `equipo`, `n`, y para k = 1…n: `jugador_k` (id), `dorsal_k`, `puesto_k`, `nombre_k`, `hablado_k` (lo que se dice: apellido, nombre completo o «el {n}»), `orden_k` (posición en `puestos(f)`) |
| `antesala:entrenador:{lado}` | `equipo`, `entrenador` |

Las claves `controlador_*` solo existen con una cláusula distinta de `ninguna`. Prueba: cada valor sustituido
en el texto está en `datos` con su clave, y `datos` no tiene claves fuera de la tabla.

### 8. Alto · Oráculos independientes y procedencia verificada — aceptado

Es cierto: comprobar con `comprobarAntesala`, que llama al mismo generador, no detecta un error sistemático
del generador. Y `procedencia` es opcional (`protocolo.ts:13`).

**(a) Oráculos por campo.** `antesala.test.ts` calcula lo esperado **sin** importar nada de `antesala.ts` ni
de `previa.ts`, directamente del registro y de la asignación:

- **formación**: `config.formaciones[lado]` y su versión en palabras, con su propio mapa de dígitos en la
  prueba;
- **líneas**: `puestos(f)` y `estructuraBase(f)` del catálogo, repartidos en la prueba como POR + primera
  línea, intermedias y última; jugador por `lado` + `puesto`; apellido como la última palabra con su propia
  regla de colisión en la prueba;
- **entrenador**: `config.entrenadores[lado].nombre`;
- **controlador**: la tabla de (b), escrita a mano en la prueba.

Mutaciones nuevas, que deben salir en rojo **aunque `comprobarAntesala` siga en verde**:

| Id | Mutación del **generador** |
| --- | --- |
| Mb8b | Líneas tomadas del orden de `anclas` |
| Mb8c | Lados intercambiados |
| Mb8d | Formación de `estructura(f, true)` en lugar de la base |
| Mb8e | Controlador de la visita en la cabecera local |

**(b) Cuándo se nombra un controlador.** `controladorVerificado(asignacion, lado)`, pura, con la regla basada
en **cómo crea el servidor la asignación**, no en una etiqueta:

| Asignación | Cláusula | Por qué |
| --- | --- | --- |
| `procedencia === "declarada"` | ninguna | Grabación subida (`grabaciones/route.ts:83`). |
| `modo ∈ {azar, manual}` y `procedencia` ausente o `"verificada"` | `modelo` (`asignacion[lado].nombre`) | Solo `GestorSesiones.crear` produce esos modos: `elegirModelos` con el catálogo del servidor (`modelos.ts`, `sesiones.ts:141`). `registrarGrabacion` escribe siempre `modo: "programado"` (`sesiones.ts:255`). |
| `modo === "programado"` y `asignacion[lado].id === "programado"` | `programado` | Solo lo produce `elegirModelos` en modo programado (`modelos.ts:36`). `registrarGrabacion` escribe `id: lado` (`sesiones.ts:254`), también en los archivos del repositorio sin `procedencia`. |
| Cualquier otra (grabaciones del repositorio o subidas, `null`) | ninguna | Origen no creado por el servidor con su catálogo. |

- **Procedencia ausente = verificada** solo cuando la sesión la creó el servidor con el catálogo. En
  grabaciones, subidas o no, nunca.
- **Alcance de «verificado».** Significa «asignado por el servidor desde su catálogo». **No es prueba de la
  identidad del despliegue**: el nombre es el `nombrePublico` del catálogo. Así lo dice la nota de las
  descargas (P2) y § 13.
- **Una sola fuente.** El servidor usa siempre la asignación de su propia sesión (`asignacionPublicada`) y
  nunca una que venga del cliente.

Pruebas:

- `crear` en azar y en manual (con el catálogo simulado de los cinco modelos): cláusula `modelo` con el
  nombre de cada lado;
- `crear` programado: cláusula `programado`;
- `registrarGrabacion` con `archivo` (procedencia ausente) y con subida (`declarada`): ninguna;
- asignaciones sintéticas `{modo: "manual", procedencia: "declarada"}`, `{modo: "programado", local.id:
  "local"}` y `null`: ninguna;
- e2e B1: la cabecera dice el nombre del modelo del `POST` simulado.

### 9. Medio · Prueba del gesto dentro del manejador — aceptado

Es cierto: una distancia de 50 ms no distingue una llamada síncrona de una hecha tras
`await Promise.resolve()`. Además, el `try/catch` síncrono no captura el rechazo de `resume()`.

**Decisión**:

- `cebarAudioDirecto()` llama a `void contexto.resume().catch(() => {})`.
- **e2e A1 instrumentado** (`addInitScript`):
  - un escuchador `click` de `window` en **captura** pone `__enGesto = true`, y uno en **burbuja**
    registrado al final lo pone a `false`. El manejador de React corre en la raíz, entre ambos;
  - el constructor de `AudioContext`, `resume()` y `AudioBufferSourceNode.prototype.start` registran
    `__enGesto` en el momento de la llamada;
  - se exige que las tres llamadas del cebado tengan `__enGesto === true`.

  Ma1 (cebar tras un `await`) deja las tres en `false` y sale en rojo.
- **Variante A1b**: el `POST /api/arena/sesiones` simulado responde a los 3 s. La voz arranca igual, con el
  contexto adoptado.
- **A4** añade la recuperación: «Habilitar reproducción de audio» → el contexto pasa a `running` (con
  `resume` restaurado en ese clic) y, con el reloj aún en 0:00, empieza la antesala.

### 10. Medio · El foco se deriva de la pieza que suena — aceptado

**Decisión**:

- **`alAntesala(foco)`** se llama al **arrancar** cada fuente y `alAntesala(null)` en su `onended` o
  `stop()`. Durante huecos, esperas y reintentos no hay foco.
- **El foco sale de la pieza efectiva**:
  - `FocoAntesala` gana `entrenador: boolean`, que es verdadero solo si las oraciones de la pieza citan
    `antesala:entrenador:{lado}`; si la escalera quitó el sufijo, es `false`;
  - `jugadores` sale de los `jugador_k` del hecho `antesala:linea`, no de recalcular.
- **Sin cifras inventadas, por jugador y por campo.** Cada fila de la tira lleva `data-jugador` y cada valor
  `data-campo` (`dorsal`, `nombre`, `puesto`, `nivel`, `perfil`, `temperamento`, `rol-natural`, `capitan`). La
  prueba de UI compara **cada** valor con el campo de **ese** jugador en `inicial.jugadores`, y ninguna fila
  tiene un `data-campo` fuera de la lista. Mc2 se redefine: poner el nivel de otro jugador.
- **Foco de teclado.** Si «Saltar al saque» tiene el foco cuando desaparece (por pulsarlo o por cualquier
  final), el foco pasa al botón de narración («Desactivar narración»), que siempre existe con la voz activa.
  Nunca se queda en `<body>`. E2e B2: `Tab` hasta «Skip to kick-off», `Enter` y comprobar que
  `document.activeElement` es el botón de narración.

### 11. Medio · Análisis de las e2e existentes, prueba por prueba — aceptado; la afirmación de la v1 era falsa

Ya se corrigió en § 9. **La antesala solo se engancha** si se cumplen las tres condiciones siguientes en la
activación:

- `inicioTick === 0`, es decir, una instantánea con `final.tick < 250` (`ArenaEnDirecto.tsx:59`);
- un reloj todavía en `preparando`/`pausada` con `segundo === 0`, es decir, reserva < 20 s y sesión no
  terminada (`buffer.ts:41–43`);
- la voz activada.

| Prueba (activa la voz) | Instantánea | ¿Antesala? | Efecto |
| --- | --- | --- | --- |
| `arena-mesa.spec.ts` (todas las que usan `preparar(…, 200)`) | 200 ticks, `ejecutando` | No: reserva = 20 s, el reloj sale en el primer fotograma (`buffer.ts:42`) | Ninguno |
| `arena-sincronia.spec.ts:7` | corte 400 | No (`inicioTick` 200) | Ninguno |
| `arena-variedad.spec.ts` (acepta cualquier id) | registro completo | No (`inicioTick` 400) | Ninguno |
| `arena-canto-gol.spec.ts` 168, 249, 274 | corte 300 | No | Ninguno |
| `arena-canto-gol.spec.ts:191` | 150 ticks, `duracionS` 15 → terminada | No: terminada, el reloj sale en el primer fotograma | Ninguno |
| `arena-reservas.spec.ts` (3) | 200 ticks | No | Ninguno |
| `arena-buffer.spec.ts` 61 (completa), 78, 209, 257, 272 (corte 300), 174 (real ≥ 200), 237 y 343 (sesiones de 12 s y 2 s terminadas) | — | No | Ninguno |
| `arena-buffer.spec.ts:302` (solo filtra `previa:*`) | corte 300 | No (`inicioTick` 100) | Ninguno |
| **`arena-previa.spec.ts` (1)** (línea 179) | corte 50, solo `keepalive` | **Sí** | `/relato` responde 404 a `antesala:*` (`piezas.find`, líneas 189–190) → dos fallos finales → abandono antes de que suene nada, unos 2 viajes locales. Las piezas del 056 no se tocan. |
| **`arena-previa.spec.ts` (4)** (líneas 332 y 369) | corte 50, `PREP_MS` 7000 | **Sí**, en la primera activación | Igual: 404 (líneas 309–310) → abandono. En la reactivación de la línea 369 la antesala no se repite (fase terminal). |
| `arena-previa.spec.ts` (4) tardía (línea 382) | — | No: el reloj ya corre | Ninguno |

**Autorizado**:

- Ningún cambio de aserción.
- La única adaptación permitida es añadir, al principio del manejador de `/relato` de `arena-previa.spec.ts`
  (1) y (4), `if (p.intervencion?.startsWith("antesala:")) return r.fulfill({ status: 404 })`. Solo hace falta
  si la implementación del manejador cambia y deja de dar 404.
- Si una aserción protegida falla por el comportamiento nuevo (por ejemplo, un tiempo medido desde la
  activación), **no se relaja**: se revisa el diseño y se escala al coordinador.
- Opus vuelve a comprobar esta tabla en la implementación (`grep` de «Enable narration» y del corte) y anota
  en la bitácora cualquier diferencia.

### 12. Medio · Calendario: A comprometido; B y C condicionales — aceptado

Reestimación con las decisiones 1–11:

| Bloque | Horas | Contenido |
| --- | --- | --- |
| A | ≈ 5 | Módulo y preferencia; casilla y cebado; activación automática, adopción y `desbloqueoMs`; e2e A1/A1b/A2–A4 con instrumentación del gesto; mutaciones Ma1–Ma6 |
| B | ≈ 12 | `antesala.ts`: guion, escaleras con `longitudEscapada`, hechos indexados, `comprobarAntesala`, `controladorVerificado`, `activarAntesala`, `pasoAntesala`, `elegirSolicitud` y oráculos, 4 h. `RelojBuffer` 0,5 h. Ruta, `asignacionPublicada`, clase y bolsa, y pruebas HTTP y de cota, 2 h. Reproductor, token, árbitro y modo sin retención en el consumidor, 3 h. E2e B1–B10 1,5 h. Smoke Speech real ES/EN 1 h |
| C | ≈ 3 | Foco por fuente, `data-speaking`, tira con `data-campo`, foco de teclado, CSS, contraste y UI |
| Validación | ≈ 2,5 | Al menos dos pasadas completas (typecheck, `npm test`, build, e2e de arena serializado) y bitácora |
| Auditoría | ≈ 2 | Codex o `auditor-adversario` sobre lo entregado |

**Reglas de corte** (sustituyen a § 10):

- **A está comprometido.** Se implementa primero, el 24 por la mañana. Al terminar A se **mide** la duración
  de una pasada de validación completa y se anota en la bitácora.
- **B empieza solo si A está en verde el 24 a las 14:00** y las horas que quedan hasta el 25 a las 20:00
  alcanzan para B más dos pasadas medidas.

  Si no se cumple, B no empieza y queda como deuda. Si empieza y no está en verde el 25 a las 20:00, **se
  revierte entero** (nada a medias) y se entrega solo A.
- **C empieza solo si B está en verde el 25 a las 12:00.** Con esta estimación es **improbable**: C entra solo
  si B termina antes de lo previsto. Si no, queda como deuda declarada; la antesala funciona sin resaltado.
- **El 26** se reserva a la entrega: despliegue, smoke público, guía de jueces y envío. Nada del 058 se
  implementa ese día.

### 13. Decisiones C1–C3 (tomadas por el coordinador por delegación de Carlos)

- **C1 · Tope diario de Speech: 200.000 caracteres la semana de jueces.**
  - El literal de `sesiones.ts:358` pasa a una constante en `src/sim/limites.ts`:

    ```ts
    /** Brief 058 · C1 (23 oct): tope diario de Speech de la réplica. 200.000 c la semana de jueces (antes 120.000);
     * 800 audios sin cambio. A ≈ 15,5 USD por millón, como máximo ≈ 3,1 USD al día. Revisar tras el fallo. */
    export const SPEECH_DIARIO = { audios: 800, caracteres: 200_000 } as const;
    ```

    `sesiones.ts` lee `SPEECH_DIARIO` para audio y conserva el 20 de análisis.
  - Prueba: con un total diario simulado de `caracteres − 1`, una síntesis de 2 c da 429 y una de 1 c pasa.
    Las cifras se leen de la constante.
  - Efecto: caben unos 18 directos narrados al día en un idioma, en vez de unos 10.
  - Se declara como coste: ≈ +1,2 USD al día como máximo.
  - Es parte de A, porque no depende de la antesala.
- **C2 · Retener el saque: sí.** `topeS = 75` (s desde el clic). El modo `topeS = 0` (§ 2) queda implementado
  y probado como reversión de una constante.
- **C3 · Regrabación del video**: se decide al publicar. No forma parte de este brief.

### 14. Cambios en constantes, pruebas, criterios y límites (resumen para Opus)

**Constantes.** `ANTESALA_ARENA` queda así:

| Campo | Valor | Cambio |
| --- | --- | --- |
| `topeS` | 75 | s de pared desde el clic; 0 = sin retención |
| `maxReintentos409` | 3 | nueva |
| `maxEnVuelo` | `VOZ_BUFFER.concurrencia` | nueva; se lee, no se repite |
| `maxTextoEscapadoC` | 300 | nueva |
| `maxSsmlClipC` | 590 | nueva |
| `bolsaSpeech` | `{ solicitudes: 18, caracteres: 10_800 }` | ajustada |

**Invariantes nuevas**:

- `maxSsmlClipC · 18 ≤ bolsaSpeech.caracteres`;
- `maxEnVuelo ≥ 2`, para que siempre quepan la antesala y la entrada.

**Constante nueva**: `SPEECH_DIARIO` (§ 13).

**Pruebas nuevas.** Las de §§ 1–11 de esta sección:

- en `pasoAntesala`: tope, clip que atraviesa el límite, `topeS = 0`, token y reintentos;
- `activarAntesala`;
- `elegirSolicitud`;
- oráculos;
- `controladorVerificado`;
- `longitudEscapada` frente a `voz.ts`;
- cota con `prepararVoz` y el registro adversario;
- e2e A1b y B5–B10.

**Mutaciones añadidas**:

| Id | Mutación |
| --- | --- |
| Mb8b–Mb8e | Las de § 8 (a) |
| Mb14 | Dejar terminar el clip tras el límite |
| Mb15 | `topeS = 0` que silencia la antesala |
| Mb16 | Respuesta tardía tras saltar que arranca |
| Mb17 | Soltar antes de reactivar al cambiar idioma |
| Mb18 | Un tercer `/relato` en vuelo durante la antesala |
| Mb19 | Escalera sin `longitudEscapada` |
| Mb20 | Procedencia ausente aceptada en grabaciones |
| Mc4 | Foco que sigue tras el `onended` |
| Mc5 | Foco de teclado en `<body>` tras saltar |

**Criterio 11.1**: `git diff --stat src/arena/turnos.ts` sigue vacío.

**Límites honestos añadidos a § 13**:

- El límite de retención es **de reloj de pared desde el clic**: pausar o esconder la pestaña durante la
  antesala lo consume, y al volver puede acabar al instante.
- El árbitro de 2 en vuelo rige **solo durante la antesala**. Después, un espectador puede volver a tener 3
  peticiones (2 del narrador + 1 de invitado), como hoy, y la tercera puede recibir el 429 global y
  reintentarse.
- La **contención global** del servidor (2 consultas `extra` en toda la réplica) no se resuelve. Con varios
  espectadores a la vez, los 429 alargan la antesala o la abandonan (dos fallos seguidos).
- «Controlador verificado» significa asignado por el servidor desde su catálogo, no la identidad comprobada
  del despliegue.
- En el modo `topeS = 0` la antesala puede sonar a trozos entre noticias, como hoy la previa del 056.

## Versión 1.3 (24 de octubre): dos correcciones antes del bloque B

Las decide Opus. El implementador del bloque A detuvo B por dos defectos del brief. **Prevalecen** sobre el texto anterior.

1. **Hechos por idioma (§ 7 de la v1.1).**
   - Cada clip se genera en un solo idioma, así que sus `hechos` se construyen **por clip y por idioma** con
     `antesalaPartido(registro, asignacion, idioma)`.
   - En un clip en español, `formacion_hablada` y `hablado_k` guardan la forma española; en uno en inglés, la inglesa.
     No hay claves con sufijo de idioma: un `datos` describe exactamente lo que dice **ese** clip.
   - Las claves no cambian. Se sigue exigiendo que cada valor dicho esté en `datos` con su clave.
   - El oráculo independiente (§ 8 de la v1.1) calcula la forma hablada esperada **para el idioma del clip**, a partir de
     `config.formaciones` y de los nombres del registro. Lo hace con una tabla propia en la prueba, sin importar el
     generador.
   - Mutación obligatoria: generar `formacion_hablada` en el otro idioma tiene que dar rojo.
2. **E2e B5 con clips válidos.**
   - Un clip de más de `VOZ_BUFFER.duracionMaxS` (24 s) se invalida, así que la prueba no puede usar clips de 30 s.
   - B5 usa clips simulados de **20 s**: con el `topeS` real de 75 s, el cuarto clip **atraviesa** el límite.
   - Comprueba que la fuente se detiene y el reloj avanza entre `t0 + topeS` y `t0 + topeS + 1,5 s`.
   - Las cifras se importan de `limites.ts`; ninguna se escribe a mano.
   - Sigue marcada `@lento`, con `test.setTimeout(120_000)`.
