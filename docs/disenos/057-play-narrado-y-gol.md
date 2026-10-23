# 057 — Reproducir con narración y gol visible: balón en la red, vuelta al centro y vista del arco

## Estado

Brief **cerrado** el 23 de octubre de 2026, escrito por Fable sin código de producción. Se implementa
después del [056](056-previa-del-partido.md) (publicado en la revisión `cronista-arena--0000021`).

**Versión 1.1 (23 de octubre), cerrada.** La revisión de Codex de la versión 1 dio NO CERRADO (5 altos,
4 medios). Las decisiones de la [sección final](#versión-11-23-de-octubre-decisiones-tras-la-revisión-de-codex)
**prevalecen sobre el texto anterior** donde lo contradigan; el texto del cuerpo se corrigió solo donde
afirmaba algo falso.

**Versión 1.3 (23 de octubre).** La auditoría adversaria (Fable) y la segunda revisión de Codex dejan ocho
decisiones en la [sección final](#versión-13-23-de-octubre-decisiones-tras-la-auditoría-adversaria-y-la-segunda-revisión-de-codex),
que prevalecen sobre todo lo anterior.

**Versión 1.2 (23 de octubre), cerrada.** Segunda ronda de Codex: 8 de 9 hallazgos cerrados y dos
correcciones nuevas, marcadas **[v1.2]** dentro de la sección final: (N1) cambiar de idioma cancela y deja la
narración **apagada** (lo que exige `e2e/arena.spec.ts:499–503`, protegido); la pista en el idioma nuevo solo
se pide con una pulsación posterior, comprobada en el e2e nuevo; (N2) la comprobación estática de CSS mira
solo las declaraciones aplicadas a los propios `.arena-player`, `.arena-ball` y `.arena-referee` (último
compuesto del selector) y deja pasar descendientes como el anillo `.arena-goal-ring` de `globals.css:3105`;
M19 apunta a esos tres elementos y conserva los estilos computados del e2e.
Entrega del hackathon: 27 de octubre; la regrabación del video prevista para la madrugada del 23
**no depende de este brief**: si entra a tiempo, Carlos decide si se vuelve a grabar.

Pedidos de Carlos (22–23 de octubre, aprobados):

- **A.** «Cuando hago play a un partido salvado no puedo escuchar la narración.»
- **B.** «Cuando hay un gol permitir simular que la bola entra al marco, y tal vez mostrar el marco
  donde entró el gol con alguna animación… luego ya comenzar del centro de nuevo.»

Alcance en tres bloques con corte (§ 9): **A · Reproducir con narración** (obligatorio), **B1 · El
gol en la cancha** (balón a la red, pausa con la celebración, vuelta al centro y saque) y **B2 · Vista
frontal del arco** (recuadro con palos, travesaño, red y el balón entrando donde dice el registro).

Reglas que no se negocian: todo dato visible sale de `RegistroArena`; lo que es reconstrucción se
**rotula** como tal (CLAUDE.md: «las direcciones y apoyos del relato espacial son una reconstrucción
modelada y rotulada; dorsales, zonas, distancias y resultados proceden de los registros»); no se cambia
el motor, `RegistroArena`, el validador, `hechosArena`, V1–V8, la Mesa del 045/048, el canto del
050/054 ni la crónica principal; `.arena-player`, `.arena-ball` y `.arena-referee` no reciben
`transform`, `transition` ni `animation` de CSS ([047](047-rediseno-visual-arena.md)); los selectores
de la lista cerrada del 047 siguen resolviendo igual.

## 1. Hechos verificados en el código (23 oct)

### 1.1 Reproducir y narración (bloque A)

- **«Reproducir» solo mueve la cancha.** `Arena.tsx:268`: el botón alterna `reproduciendo`; el bucle de
  `requestAnimationFrame` (`Arena.tsx:101–115`) avanza `tiempo` a `velocidad` (1×/2×/4×). Nada de voz.
- **La voz vive en otro sitio.** `ArenaNarracion.tsx` (sección «Escucha el partido», en el acompañante):
  botón «Escuchar desde el inicio» → `modo = "completo"` → pide a `/api/arena/sesiones/{id}/relato` todas las
  ventanas de `RELATO_INTERVALOS.completo` más las intervenciones del diario y la previa del 056, decodifica
  cada clip, monta una pista WAV (`wavMono`, 053) y la reproduce en un `<audio controls>`; la cancha sigue
  a la voz (`instanteNarrado`, `pista-audio.ts:23`) y `alActividadAudio(true)` **deshabilita** Reproducir,
  Volver al inicio, Velocidad y el deslizador (`Arena.tsx:268–273`, `audioActivo`), además del transporte de
  la ficha (`transporte` en `ArenaPlantilla`). Progreso visible solo en ese panel: «Preparando narración:
  3/12 tramos» (`role="status"`, `data-progress-ready/total`).
- **Hace falta una sesión.** Toda la voz cuelga de `sesion`. Hoy la tienen: los partidos generados en vivo
  o «preparados» (`/api/arena/sesiones`, también por `?partido=ID`), y los tres ejemplos archivados **tras**
  pulsar «Activar narración de esta grabación» (`activarArchivo` → `POST /api/arena/grabaciones` con
  `{ archivo }`; la ruta relee el JSON de `public/experimentos/`, lo valida con `reproducirArena` y llama a
  `registrarGrabacion(registro, referencia)`, que crea una sesión `completa` sin inferencia y la indexa por
  `grabacion-<referencia>.json` para devolver el mismo `id` si ya existe). **No la tienen**: «Crear grabación
  sin IA» (`POST /api/arena` `accion: simular`) ni «Abrir registro guardado» (`accion: reproducir`): la
  interfaz dice «Genera un encuentro para activar su narración» (`ArenaNarracion.tsx:195`) y no hay forma
  de oírlos. Las sesiones caducan a las 24 h (`duracionRetencionMs`, `sesiones.ts:36`) y se retienen como
  máximo 24 (`maxRetenidas`); `registrarGrabacion` exige `referencia` `^[a-z0-9-]{1,50}$` y responde 429 si
  otra sesión se está iniciando (`creando`).
- **La ruta de grabaciones** solo existe con `ARENA_VOZ=1` o `ARENA_ANALISTA_LLM=1` (503 en otro caso), lee
  el cuerpo con `leerJsonAcotado(req)` (**16 KB** por defecto, `peticiones.ts:23`) y admite solo
  `{ archivo: "duelo" | "ejemplo-v3" | "ejemplo" }`. `POST /api/arena` lee hasta `ARENA.archivoMaxBytes`
  (8 MB) con su propio lector (`route.ts:19–33`).
- **Presupuestos de Speech** (`sesiones.ts`): por sesión 80 solicitudes / 24.000 caracteres de SSML para el
  narrador (con reserva del cierre), bolsas propias de invitados (048) y previa (056); diario 800 audios /
  120.000 caracteres; cada síntesis queda cacheada por `claveAudio` en los `extras` de la sesión, así que
  volver a oír la misma pista no gasta nada. Dos consultas `extra` simultáneas como máximo (429).
- **Autoplay.** `ArenaNarracion.tsx:159` llama a `audio.play()` cuando hay `url`; si el navegador lo
  bloquea, el estado pasa a `pulsar` («Pulsa reproducir para escuchar»).
- **E2e que tocan Reproducir con voz simulada:** `arena.spec.ts:385–402` («…abort… Play… transform cambia»)
  carga `?partido=ID` con `herramientas` en `voz: true`, aborta `**/api/arena/**` y pulsa Play esperando
  movimiento mudo. `arena-previa.spec.ts:74/86` pulsan Play sin simular voz (el servidor de e2e no tiene
  `ARENA_VOZ`, así que `/herramientas` devuelve `voz: false`). `arena.spec.ts:504` espera «Reproducir» habilitado
  tras detener la narración.

### 1.2 El gol en la reproducción (bloque B)

Medido sobre los fixtures `arena-reinicios-v{1,2,3,5}.json` y los ejemplos públicos (`duelo-v3`, `llm-v3`,
sin `reglas`):

- **El evento `gol`** lleva siempre `desde` (origen del vuelo o del último toque) y `hasta` = **punto exacto
  de cruce de la línea de meta** (`motor.ts:527`, `cruce.punto`: `x` ∈ {0, 105}, `y` dentro del arco; p. ej.
  v1 `a23` `hasta = (105, 31,95)`, v5 `a34` `hasta = (0, 36,41)`), `distanciaM` = |desde − hasta|, `lado` =
  equipo que anota (en un autogol, el beneficiado), `autogol?`. En registros sin reinicios (`moverBalon`,
  `motor.ts:681`) `hasta` es el destino del vuelo, también sobre la línea. **No existe ningún dato de
  altura**: el motor es 2D; el «alto» del 051 es una probabilidad que acaba en `tiro_fuera`, nunca en gol.
- **El tick del gol es el tick del saque de centro.** Con reglas (`reinicios-v1`…`v5`), `resolverSalida`
  anota el gol y en el **mismo tick** llama a `prepararSaque("centro")`, que coloca a los 22 con
  `colocarCentro` (v2+) y deja el balón en (52,5, 34) con `saque.hastaTick = tick + 15`
  (`TECNICA_ARENA.pausaS` = 1,5 s); el evento `reinicio` (`reinicio: "centro"`) fuerza un fotograma de
  transición en ese tick. Resultado en el registro: el fotograma anterior al gol muestra el balón en vuelo
  (v1 `a23`: tick 265, balón en x = 101,8) **o todavía en los pies del rematador** (v5 `a12`: tick 190, balón
  en x = 99,9; el tiro es en 191 y el gol en 194), y el fotograma del tick del gol ya tiene el balón en el
  centro, los 22 recolocados y el marcador sumado. El pase de saque llega en `hastaTick + 1`.
- **Cómo se ve hoy.** `estadoVisual` (`vista.ts:6–26`) detecta un `reinicio` entre los dos fotogramas (`corte`)
  y entonces **congela** el balón en la posición del fotograma anterior y, si el reinicio lleva tipo, también a
  los jugadores; al llegar al tick del gol todo **salta** al centro. El balón nunca llega a la línea: se
  detiene a 3 m del arco (v1) o no sale de los pies del goleador (v5, remates cortos), y aparece en el círculo
  central junto con los 22 teletransportados. Durante los 1,5 s de pausa se ve «Saque de centro · equipo»
  (`arena-restart`) y, desde el 050, el rótulo «Gol», el marcador realzado y el anillo del goleador durante
  8 s (`CANTO_GOL.celebracionS`), todo derivado del cursor con cota inferior (`golEnCelebracion`).
- **Registros sin reglas** (`duelo-v3`, `llm-v3`): tras el gol no hay saque de centro; `reiniciar()` entrega
  el balón al portero rival (v3 `a14`: tick 231 balón en x = 104,3 → fotograma 235 en x = 95,0 con `pausa`
  hasta 246). `corte` también aplica (reinicio sin tipo: balón congelado, jugadores interpolados).
- **Lo que ya existe para dibujar un arco:** `ARCO_3D = { anchoM: 7,32, altoM: 2,44 }` y
  `ALTURA_DESTINO_M = { raso: 0,25, media: 1,2, alta: 2,1 }` (`limites.ts:337–338`, pizarra 3D de la crónica),
  y `potenciaRemate(distanciaM)` (`remate.ts:37`, pura: 0 hasta `REMATE_ARENA.colocadoHastaM` = 8 m, 1 desde
  `potenteDesdeM` = 20 m).
- **Firma de voz.** `firmaEstadoVoz` (`buffer.ts:8`) lee `estadoVisual` para invalidar clips en la emisión con
  búfer: cualquier cambio en `estadoVisual` tocaría la voz en vivo. Por eso la reconstrucción del gol **no**
  se mete en `estadoVisual` (§ 4).
- **E2e sobre el balón:** `arena-buffer.spec.ts:14–15` y `:51` esperan `cx="52.5" cy="34"` en el saque inicial
  y **en el tick exacto del reinicio «centro» tras un gol**; `arena-canto-gol.spec.ts:71` exige
  `animation-name: none`, `transition: all 0s` y `transform: none` de CSS en `.arena-ball`.

## 2. Decisiones de diseño (cerradas)

1. **Reproducir arranca la pista narrada** cuando el conmutador «Con narración» está activo (por defecto,
   si hay voz disponible). Se reutiliza íntegro el modo `completo` del 045/053 (misma pista, mismo WAV
   descargable); no se crea un segundo reproductor ni se sintetiza nada nuevo. «Escuchar desde el inicio» y
   «Detener narración» siguen existiendo y haciendo lo mismo.
2. **Toda grabación es narrable.** Si el registro no tiene sesión, el cliente **sube el registro** a
   `POST /api/arena/grabaciones` (`{ registro }`), el servidor lo valida con el **mismo** `reproducirArena`
   del camino de importación y crea una sesión de grabación con `registrarGrabacion`. Los ejemplos
   archivados se registran solos (`{ archivo }`, como hoy). Un `?partido=` caducado se recupera subiendo el
   registro que ya está en memoria. Decisión de camino: **subida validada**, no «confiar en el cliente» ni
   «sesión sin registro»: la ruta de voz necesita el registro en el servidor para construir el relato, y el
   validador garantiza que lo que se narra es lo que se ve.
3. **Con pista, el audio es el reloj**: Reproducir/Pausar pausan el `<audio>`; Volver al inicio y el
   deslizador **buscan en el audio** (inversa de `instanteNarrado`); la velocidad queda fija en 1×. Sin
   pista, todo sigue como hoy.
4. **Degradación siempre a reproducción muda** con un mensaje claro (sin voz, sin sesión, red, presupuesto,
   sesión caducada), nunca un botón que no hace nada.
5. **El gol en la cancha es una reconstrucción rotulada sobre datos del registro**: el balón viaja en línea
   recta desde su última posición registrada hasta `gol.hasta` (punto de cruce registrado), entra
   `profundidadRedM` en la red y se queda ahí `enRedS` segundos de partido con los 22 **quietos en su último
   fotograma previo**; después se corta al estado registrado (balón y jugadores en el centro, estado
   `arena-restart`) y el saque llega cuando dice el registro (`hastaTick`). **Sin cambios en el motor:**
   `enRedS` (1,0 s) es menor que `TECNICA_ARENA.pausaS` (1,5 s), así que la secuencia pedida —red → pausa
   con celebración → centro → saque— cabe en la pausa ya registrada. Alargar la pausa real exigiría una
   regla `reinicios-v6`: **corte decidido** (§ 11), no imprescindible.
6. **La altura del balón en la vista frontal es ilustrativa y se dice.** El motor no registra altura. Regla
   determinista y honesta: banda `raso` / `media` / `alta` de `ALTURA_DESTINO_M` elegida por
   `potenciaRemate(gol.distanciaM)` (remate corto → raso, lejano → alto, coherente con el modelo del 051) y
   rótulo «altura ilustrativa (banda), derivada de la distancia del remate: el motor no registra altura».
   La **posición lateral sí es dato**: `gol.hasta.y`. Se descartan la altura aleatoria (inventa) y la
   altura fija (no distingue nada y también habría que rotularla).
7. **Todo lo visual del gol se deriva del cursor** (como la celebración del 050): sin temporizadores ni
   estado propio, funciona en repetición, búfer, directo, al arrastrar y en pausa; retroceder funciona; un
   gol futuro nunca se muestra (cota inferior). La animación del recuadro es la **fase del cursor**, no
   CSS; con `prefers-reduced-motion` las fases intermedias no existen (estados discretos).

## 3. Bloque A · Reproducir con narración

### 3.1 Interfaz (`Arena.tsx`, barra `.arena-playback`)

- Nuevo control al final de la barra: `<label className="arena-with-voice"><input type="checkbox"
  data-testid="arena-play-voice" checked={conVoz} onChange… /> {t("With narration", "Con narración")}</label>`.
  Visible solo con `vozDisponible` (lo publica `ArenaNarracion`, § 3.3) y fuera de directo y búfer;
  `conVoz` arranca en `true` cuando `vozDisponible` pasa a `true` (una vez) y el usuario puede apagarlo.
  No se persiste (P2 descartado, § 11). Deshabilitado mientras la pista está `preparando`.
- **Botón principal** (hoy «Play»/«Reproducir» · «Pause»/«Pausar»): mismo elemento, mismos textos en reposo
  (los e2e lo localizan por nombre exacto). Estados con `conVoz`:

  | Fase de la pista | Texto | `aria-pressed` | Al pulsar |
  | --- | --- | --- | --- |
  | `inactiva` / `final` | Reproducir | false | `iniciar()` (si `tiempo ≥ finS`, antes `saltar(0)`) |
  | `registrando` / `preparando` | Reproducir sin narración | false | `detener()` y reproducción muda desde el cursor |
  | `sonando` | Pausar | true | `pausar()` |
  | `pausada` / `pulsar` | Reproducir | false | `reanudar()` (es un gesto del usuario: desbloquea autoplay) |

  Sin `conVoz`, el botón se comporta exactamente como hoy.
- **Progreso junto al botón**, mientras `registrando`/`preparando`: `<span className="arena-play-progress"
  data-testid="arena-play-progress" aria-hidden="true">{t("Preparing narration 3/12", "Preparando narración
  3/12")}</span>` (cifras de `alEstado`; en `registrando`, «Registrando la grabación…»). Es `aria-hidden`
  porque el `role="status"` de `ArenaNarracion` ya anuncia el mismo progreso: una sola región viva.
- **Volver al inicio**: con pista `sonando`/`pausada` → `buscar(0)`; en `preparando` deshabilitado; sin pista
  como hoy. **Velocidad**: deshabilitada con pista (`sonando`/`pausada`/`preparando`); vuelve al valor
  elegido al terminar. **Deslizador**: habilitado con pista `sonando`/`pausada`; `onChange` → `buscar(tick)`.
- **`saltar(s)`** (ficha, contexto, descripción, cifras): si la pista está `sonando`/`pausada` →
  `buscar(s / pasoS)`; si no, como hoy. `transporte` de `ArenaPlantilla` pasa a `!enDirecto && !bufferActivo
  && fase !== "preparando"`.
- **Degradación**: cuando `alEstado` entrega `fase: "error"` con `motivo`, `Arena` muestra `<p role="status"
  className="arena-muted" data-testid="arena-play-fallback">` con «Narración no disponible ({motivo});
  reproduciendo sin voz.» / «Narration unavailable ({motivo}); playing without voice.» y arranca la
  reproducción muda desde el cursor **solo si el usuario no canceló** (`detener()` explícito no dispara
  reproducción). Motivos (ES / EN): `sin-voz` «el audio no está disponible» / «audio is unavailable»;
  `sin-sesion` «no se pudo registrar la grabación» / «the recording could not be registered»; `red` «fallo de
  red» / «network error»; `presupuesto` «presupuesto de voz agotado» / «voice budget exhausted»; `caducada`
  «la sesión compartida caducó» / «the shared session expired». El aviso desaparece en la siguiente carga
  (`cargaId`) o al volver a pulsar Reproducir.
- **Fin de la pista**: `terminar()` deja el cursor en `hastaTick` y la fase en `final`; Reproducir vuelve a
  leer «Reproducir»; pulsarlo hace `saltar(0)` + `iniciar()` (la pista está en caché por `clave`: ninguna
  petición nueva). El texto de ayuda bajo la barra añade, solo con `conVoz`: «Con narración, el audio marca
  el ritmo: la velocidad es 1× y el deslizador busca en la voz.» / EN equivalente.

### 3.2 Contrato entre `Arena` y `ArenaNarracion`

`ArenaNarracion` gana tres props y un tipo exportado:

```ts
export type FaseNarracion = "inactiva" | "registrando" | "preparando" | "sonando" | "pausada" | "pulsar" | "final" | "error";
export type MotivoNarracion = "sin-voz" | "sin-sesion" | "red" | "presupuesto" | "caducada";
export interface EstadoNarracion { fase: FaseNarracion; listos: number; total: number; motivo?: MotivoNarracion; vozDisponible: boolean }
export interface ControlesNarracion { iniciar(): void; pausar(): void; reanudar(): void; buscar(tick: number): void; detener(): void }
// props nuevas: registro: RegistroArena; alEstado: (e: EstadoNarracion) => void; alControles: (c: ControlesNarracion) => void
```

- `alControles` se llama una vez al montar (objeto estable con `useRef`); `alEstado` en cada cambio de fase o
  de progreso. `fase` deriva de lo que ya existe: `modo`, `estado` (`esperando`/`preparando`/`reproduciendo`/
  `pulsar`/`final`/`error`), `progreso` y los eventos `play`/`pause`/`ended` del `<audio>` (el `<audio controls>`
  sigue visible y manejable: pausar desde él también pone `pausada`).
- `iniciar()`: si `!disponible` → `error sin-voz`; si no hay `sesion` → `registrar()` (§ 3.3) y después
  `setModo("completo")`; si ya hay pista para la `clave` actual → reproduce sin pedir nada. `pausar()` /
  `reanudar()` → `audio.pause()` / `audio.play()`. `buscar(tick)` → `audio.currentTime =
  instanteAudio(pista.tramos, tick)` y `sincronizar()` (el cursor queda en el tick que la pista mapea, no
  necesariamente el pedido: granularidad de tramo, § 12). `detener()` → `setModo("apagado")` (cancela
  peticiones en vuelo como hoy: `generacion.current++`).
- `instanteAudio(tramos, tick)` (nuevo en `pista-audio.ts`, puro): primer tramo **del narrador** (ancho > 0
  en ticks) con `hastaTick ≥ tick`, posición lineal dentro; `tick ≤ 0` → 0; `tick ≥` último `hastaTick` → fin del
  último tramo. Propiedad: `instanteNarrado(tramos, instanteAudio(tramos, t)).tick ≈ t` (±1 tick) para todo
  `t` dentro de un tramo del narrador; las intervenciones (ancho cero) nunca son destino de una búsqueda.
- `alActividadAudio` se mantiene (lo usa el transporte de la ficha) pero `Arena` deja de usarlo para
  deshabilitar la barra: la barra se gobierna por `fase`.
- `motivo` según el fallo: `/herramientas` con `voz: false` → `sin-voz`; `grabaciones` ≠ 2xx (tras el reintento
  de § 3.3) → `sin-sesion`; `relato` 404 de la sesión → se intenta **una** re-registración por subida (§ 3.3)
  y, si vuelve a fallar, `caducada`; 429 persistente o 503 → `presupuesto`; `TypeError` de `fetch` → `red`;
  cualquier otro → `sin-sesion`.

### 3.3 Sesión para cualquier grabación (`/api/arena/grabaciones`)

Esquema del cuerpo: `z.union([z.strictObject({ archivo: z.enum([...]) }), z.strictObject({ registro: z.unknown() })])`,
leído con `leerJsonAcotado(req, ARENA.archivoMaxBytes)` (8 MB; un cuerpo mayor → **413** con `ErrorPeticion`,
v1.1 § 9; hoy el lector lanza un `Error` genérico que `respuestaErrorSesion` convierte en 400 con mensaje
genérico). Sigue exigiendo `ARENA_VOZ=1` o `ARENA_ANALISTA_LLM=1` (503).

Rama `registro`:

1. `const registro = reproducirArena(datos.registro)` — **el validador real**: vuelve a jugar las órdenes
   archivadas y compara observaciones, estado inicial y reloj; cualquier error de validación → `ErrorSesion(
   "Registro inválido", 400)` (sin filtrar el mensaje interno).
2. Solo registros **completos**: `registro.final.tick · pasoS ≥ config.duracionS` o `final.finalizado`; si no,
   400 «Registro incompleto» (la pista completa necesita el partido entero; el búfer tiene su propio camino).
3. `referencia = "subida-" + sha256(JSON.stringify(registro)).slice(0, 40)` (47 caracteres, cumple
   `^[a-z0-9-]{1,50}$`): el mismo archivo subido dos veces, o por dos espectadores, devuelve el **mismo `id`**
   mientras la sesión se retenga (índice `grabacion-<referencia>.json` + comparación byte a byte que ya hace
   `registrarGrabacion`).
4. `registrarGrabacion(registro, referencia)` → `{ id }`. Metadatos como hoy (`asignacion.modo: "programado"`,
   controladores tomados de `rondas[0]`).

Límites y cuotas: la **admisión** (v1.1 § 3: limitador por IP y global, un solo replay de subida en curso)
se decide **antes** de leer el cuerpo y de ejecutar `reproducirArena`; `creando` solo serializa la escritura
dentro de `registrarGrabacion` y **no** protege la validación. El cliente reintenta **una vez** un 429 tras
`PLAY_NARRADO.reintentoRegistroMs` (1.500 ms) y después degrada (`sin-sesion`). La retención (24 sesiones,
24 h) y los presupuestos de Speech por sesión y diarios no cambian: una grabación subida cuesta lo mismo que
una «preparada» de la misma duración. El servidor no guarda nada que no pase el validador.

Cliente (`ArenaNarracion.registrar()`): con `archivo` → `{ archivo }` (como `activarArchivo` hoy); si no →
`{ registro }` con el `registro` recibido por props. Al recibir `{ id }` → `alRegistrar(id)` (ya existe:
`Arena` guarda `sesionActual`). El botón «Activar narración de esta grabación» se mantiene (lo usa
`arena-previa.spec.ts:264`) y pasa a llamar al mismo `registrar()`; con un registro sin sesión y sin archivo
el botón también aparece (antes solo el texto «Genera un encuentro…», que desaparece cuando hay voz y el
registro es completo; se conserva para registros incompletos).

### 3.4 Vistas en vivo y búfer

Sin cambios: la barra `.arena-playback` no se renderiza con `bufferActivo`; en directo «preparada» Reproducir
sigue `bloqueado`; el conmutador no se muestra. `ArenaEmisionBuffer` no se toca. `alActividadAudio` sigue
llegando a `Arena` para `transporte`.

## 4. Bloque B1 · El gol en la cancha

### 4.1 Función pura `reconstruccionGol` (`src/arena/vista.ts`)

```ts
export type FaseGol = "vuelo" | "red";
export interface ReconstruccionGol { fase: FaseGol; gol: EventoArena; balon: Punto; congelado: EstadoArena | null }
export function reconstruccionGol(registro: RegistroArena, segundos: number, discreto = false): ReconstruccionGol | null
```

Con `tick = segundos / pasoS` (misma tolerancia que `estadoVisual`), `G` = evento `gol` candidato y `A` = último
fotograma con `A.tick < G.tick`:

- **Fase `red`**: existe `G` con `0 ≤ tick − G.tick < GOL_VISUAL.enRedS / pasoS` (el de mayor tick si hubiera
  varios, como `golEnCelebracion`). `balon = { x: G.hasta.x + s · profundidad(u), y: G.hasta.y }` con `s = +1`
  si `G.hasta.x ≥ largoM / 2`, `−1` si no; `u = min(1, (tick − G.tick) / (entradaRedS / pasoS))`;
  `profundidad(u) = u · profundidadRedM` (en `discreto`, `u = 1`). `congelado = A` (jugadores y árbitro del
  último fotograma previo al gol, sin interpolar) si `A` existe; si `G.tick` es el primer fotograma (no
  ocurre en registros reales), `congelado = null` y la cancha muestra el estado registrado.
- **Fase `vuelo`**: no hay fase `red` y existe `G` con `A.tick ≤ tick < G.tick` y **ningún fotograma entre
  `tick` y `G.tick`** (el cursor está en el último hueco antes del gol). `balon = lerp(A.balon.posicion,
  G.hasta, (tick − A.tick) / (G.tick − A.tick))`; `congelado = A` también aquí (v1.1 § 7: hoy
  `estadoVisual` congela a los jugadores solo si el reinicio lleva tipo y **sigue interpolando al árbitro**
  hacia su posición del saque; la reconstrucción congela a los 22 y al árbitro en `A` en las dos fases, en
  todas las versiones). Esta fase mira al **futuro inmediato** (`G.hasta`, ≤ 0,5 s): es la **única excepción
  declarada** a «ningún gol futuro» (v1.1 § 5) y no expone `gol`. En `discreto` esta fase **no existe**
  (devuelve `null`): movimiento reducido = estados discretos.
- Condiciones de validez de `G` (fallbacks para v1–v5 y archivos sin reglas): `hasta` finito y
  `|hasta.y − anchoM/2| ≤ arcoM/2 + 0,5`; si no se cumple, `G` no se reconstruye (la cancha queda como hoy).
  El autogol se reconstruye igual (el `hasta` es el cruce real; el arco es el del lado de `hasta.x`, no el de
  `lado`).
- Nunca lee ni escribe `estadoVisual`; nunca usa `Date.now`; no modifica el registro.

### 4.2 Cableado (`Arena.tsx`)

- `const escena = reconstruccionGol(registro, tiempo, reducido)`; la cancha dibuja `escena?.balon ??
  estado.balon.posicion` en `cx`/`cy` del `<circle className="arena-ball">` (**atributos SVG**, como hoy;
  ninguna regla CSS nueva sobre `.arena-ball`) y, en fase `red`, `escena.congelado.jugadores` y
  `escena.congelado.arbitro` en lugar de los de `estado` (siguen en el atributo `transform` del `g`). El
  marcador, el rótulo, el anillo y las cifras siguen leyendo `estado`/`gol`: el marcador **ya suma** en el tick
  del gol (050), la red lo acompaña.
- `.arena-ball` gana `data-reconstruccion={escena?.fase}` (ausente fuera de las dos fases) para pruebas y
  depuración. Sin `<title>` en el círculo (los e2e del 047 cuentan hijos de los grupos; el balón no los tiene y
  así sigue).
- `arena-restart` («Saque de centro · equipo») **no se muestra mientras `escena?.fase === "red"`**: el balón
  aún no está en el centro; aparece en el corte y dura hasta `saque.hastaTick` como hoy. El rótulo «Gol» del
  050 sí se muestra desde el tick del gol (es la «pausa breve con la celebración»).
- **Rótulo de reconstrucción (obligatorio aunque B2 se recorte):** el texto de ayuda bajo la barra
  (`Arena.tsx:275`) añade una frase permanente: «Tras un gol, el balón se dibuja entrando en la red en el punto
  de cruce registrado y los jugadores quedan quietos un instante antes de volver al centro: es una
  reconstrucción visual; el registro sitúa el saque en el mismo tick del gol.» / «After a goal the ball is
  drawn into the net at the recorded crossing point and the players hold still for a moment before returning
  to the centre: a visual reconstruction; the record places the kick-off at the goal tick.» Y la sección
  «Alcance y límites» añade: «El balón en la red y la vista frontal del arco son reconstrucciones: la posición
  lateral viene del registro; la altura es ilustrativa.»
- Secuencia visible resultante (v2+): vuelo recto hasta la línea → balón un metro dentro de la red, los 22
  quietos, rótulo «Gol» y marcador realzado (1,0 s) → corte: balón y jugadores en el centro, «Saque de centro ·
  equipo» (0,5 s) → pase de saque. Registros sin reglas: tras la red, corte al estado registrado (balón en las
  manos del portero, sin saque de centro): se declara en § 12.

## 5. Bloque B2 · Vista frontal del arco

### 5.1 Datos (`src/arena/vista.ts`, puras)

```ts
export type BandaAltura = keyof typeof ALTURA_DESTINO_M; // "raso" | "media" | "alta"
export function alturaIlustrativa(gol: EventoArena): { banda: BandaAltura; metros: number; derivada: boolean }
export function vistaArco(registro: RegistroArena, gol: EventoArena): { defiende: Lado; lateralM: number; altura: ReturnType<typeof alturaIlustrativa> }
```

- `alturaIlustrativa`: `p = potenciaRemate(gol.distanciaM)`; `banda = p < GOL_VISUAL.cortesPotencia.raso ?
  "raso" : p < cortesPotencia.media ? "media" : "alta"`; `metros = ALTURA_DESTINO_M[banda]` (siempre
  `< ARCO_3D.altoM`). Si `distanciaM` no es finito → `{ banda: "raso", derivada: false }` y el rótulo dice «sin
  distancia registrada». Sobre los fixtures: v1 `a23` (16,6 m) → alta; v1 `a40` (7,5 m) → raso; v5 `a12`
  (5,8 m) → raso; duelo `a14` (20,3 m) → alta; `llm-v3 a18` (1,3 m, conducción) → raso. «Media» necesita 12–16 m
  (evento sintético en la prueba).
- `vistaArco`: `defiende = gol.hasta.x ≥ largoM/2 ? "visita" : "local"` (el local ataca a la derecha y no hay
  cambio de campo; **se decide por `hasta.x`, no por `lado`**, para que el autogol señale el arco correcto);
  `lateralM = s · (gol.hasta.y − anchoM/2)` con `s = +1` si `defiende === "visita"` (mirando hacia +x, la
  banda inferior del dibujo, +y, queda a la **derecha** del espectador) y `−1` si `defiende === "local"`;
  acotado a `±(arcoM/2 − GOL_VISUAL.vista.radioBalonM)`.

### 5.2 Componente `ArenaVistaArco` (`src/ui/ArenaCelebracion.tsx`)

Props: `{ registro, gol, tick, idioma, identidad, reducido }`. Se renderiza dentro de `.arena-pitch-wrap`,
**después** del `<svg>` de la cancha, solo cuando `gol` (el de `golEnCelebracion`) no es `null`: aparece en
el tick del gol y desaparece a los `celebracionS` (8 s), sincronizado con el rótulo y el marcador del 050.

```html
<figure class="arena-goal-view" data-testid="arena-goal-view" data-arco="visita" data-altura="alta" data-lado="local">
  <svg viewBox="0 0 100 46" role="img" aria-label="Vista frontal del arco de {defiende}: el balón entra a {lateral} m del centro, a la {izquierda|derecha} del espectador; altura ilustrativa (alta)">
    <!-- red: <pattern> de rejilla 2×2 unidades, trazo --ar-score-ink al 35 % -->
    <!-- postes x = 50 ± 36,6, de y = 17,6 a 42; travesaño y = 17,6; línea de meta y = 42 (1 unidad = 0,1 m) -->
    <circle class="arena-goal-view-ball" cx cy r />
  </svg>
  <figcaption><strong>{t("Goal view", "Vista del arco")}</strong> · {nombre de defiende} · {t("lateral from the record", "lateral del registro")} · {t("illustrative height (alta)", "altura ilustrativa (alta)")}</figcaption>
</figure>
```

- Balón: destino `cx = 50 + lateralM · 10`, `cy = 42 − metros · 10`, `r = GOL_VISUAL.vista.radioBalonM · 10`
  (0,18 m: esquemático, no a escala; se dice en § 12). **Entrada por fase del cursor**: `u = min(1, (tick −
  gol.tick) / (entradaRedS / pasoS))`; `cx = 50 + u · (destino − 50)`, `cy = 42 − 3 − u · (42 − 3 − cyDestino)`,
  `r = r_final · (0,5 + 0,5 u)`. Con `reducido`, `u = 1`. Sin CSS `animation` sobre el balón del recuadro;
  la única animación es la entrada del propio `figure` (`arena-gol-vista`, 240 ms, una vez, como el rótulo) y
  queda en `none` con `prefers-reduced-motion` (se añade al bloque existente de `globals.css:3112`).
- Red ligeramente «hundida» alrededor del balón: **no** (fuera de alcance; § 11).
- Autogol: el `figure` lleva `data-autogol` y la figcaption antepone «Autogol ·» (`CANTO_GOL.plantillas.rotulo.
  autogol`); el arco sigue siendo el de `defiende` por `hasta.x`.

### 5.3 CSS (`globals.css`, tokens del 047/055, sin colores nuevos)

- `.arena-goal-view { position: absolute; bottom: var(--ar-s3); width: clamp(128px, 32%, 240px); margin: 0;
  padding: var(--ar-s1); border-radius: var(--ar-r-sm); background: color-mix(in srgb, var(--ar-score-bg) 92%,
  transparent); color: var(--ar-score-ink); border-left: 6px solid var(--ar-home); box-shadow: 0 0 0 1px
  var(--ar-home-ui); pointer-events: none; z-index: 1; }` · `[data-arco="visita"] { right: var(--ar-s3); }` ·
  `[data-arco="local"] { left: var(--ar-s3); }` · `[data-lado="visita"] { border-left-color: var(--ar-away);
  box-shadow: 0 0 0 1px var(--ar-away-ring); }` (el borde es decorativo: el equipo va escrito).
- `svg { display: block; width: 100%; height: auto; }` · postes y travesaño `stroke: var(--ar-score-ink);
  stroke-width: 1.6` · red `stroke: var(--ar-score-ink); opacity: .35; stroke-width: .5` · balón
  `fill: var(--ar-ball); stroke: var(--ar-bug); stroke-width: .6` (mismos tokens que `.arena-ball`).
- `figcaption { font: 600 11px/1.3 var(--font-display), sans-serif; margin-top: var(--ar-s1);
  overflow-wrap: anywhere; }`; a ≤ 480 px la figcaption pasa a dos líneas (`strong` en la primera).
- Está en la esquina inferior del lado del arco batido: no tapa el rótulo (arriba, centrado) ni la boca del
  arco de la cancha (y = 30–38 de 68, zona media). A 360 px: ancho 128 px, alto ≈ 59 px + figcaption; sin
  desborde (`scrollWidth ≤ 360`). Contraste: `--ar-score-ink` sobre `--ar-score-bg` (16,2, medido en el 050);
  `contraste.mjs` añade el par de la figcaption y de los postes.

## 6. Constantes (`src/sim/limites.ts`, comentadas, después de `CANTO_GOL`)

```ts
/** Brief 057 · Reproducir con narración. */
export const PLAY_NARRADO = {
  /** Un solo reintento del registro de la grabación tras un 429 de `creando` (ms). */
  reintentoRegistroMs: 1500,
} as const;
/** Brief 057 · Reconstrucción visual del gol: datos del registro (punto de cruce `gol.hasta`, distancia,
 * fotogramas) más una profundidad en la red y una altura ilustrativas. Nada de esto cambia el motor ni el
 * registro. */
export const GOL_VISUAL = {
  /** Segundos de partido en que el balón recorre `profundidadRedM` tras cruzar la línea (fase del cursor). */
  entradaRedS: 0.3,
  /** Segundos de partido con el balón en la red y los 22 quietos en su último fotograma previo. DEBE ser
   * menor que TECNICA_ARENA.pausaS (1,5 s): el corte al centro precede al saque registrado. */
  enRedS: 1.0,
  /** Metros tras la línea de meta a los que se detiene el balón (el arco real mide ≈ 2 m de fondo). */
  profundidadRedM: 1.0,
  /** Banda de altura de ALTURA_DESTINO_M según potenciaRemate(distanciaM) (051): corto → raso, lejano → alta.
   * Es ilustrativa: el motor es 2D y no registra altura. */
  cortesPotencia: { raso: 0.34, media: 0.67 },
  vista: {
    /** Radio esquemático del balón en la vista frontal (m); el real es 0,11. */
    radioBalonM: 0.18,
    /** Altura (viewBox) desde la que «llega» el balón antes de la fase del cursor, en décimas de metro. */
    llegadaAltaM: 0.3,
  },
} as const;
```

Invariantes probadas (no cifras repetidas): `GOL_VISUAL.enRedS < TECNICA_ARENA.pausaS`; `entradaRedS ≤ enRedS`;
`0 < profundidadRedM ≤ 2`; `cortesPotencia.raso < cortesPotencia.media < 1`; `max(ALTURA_DESTINO_M) <
ARCO_3D.altoM`; `vista.radioBalonM < ARCO_3D.anchoM / 2`.

## 7. Pruebas exigidas y mutaciones

Cada mutación se ejecuta y se anota en la bitácora con la prueba que la pone en rojo. Ninguna prueba repite
cifras de `GOL_VISUAL`, `TECNICA_ARENA`, `CANTO_GOL` o `ARENA` a mano.

**`src/arena/__tests__/gol-visual.test.ts` (nuevo).** Sobre los fixtures `arena-reinicios-v1/v3/v5.json`
(goles de los dos lados), `public/experimentos/arena-duelo-v3.json` y `arena-llm-v3.json` (sin reglas,
gol por conducción):

- `reconstruccionGol`: antes del último fotograma previo al gol → `null`; en el hueco previo → `vuelo`, balón
  sobre el segmento `A.balon → G.hasta` (colinealidad y monotonía de `x`), `congelado === null`; en `G.tick` →
  `red`, `balon.y === G.hasta.y`, `|balon.x − G.hasta.x| = 0` en el tick exacto y `= profundidadRedM` desde
  `G.tick + entradaRedS`, con signo según el lado del arco (`x > largoM` en el arco derecho, `x < 0` en el
  izquierdo); `congelado.jugadores` idénticos (ids y posiciones) al último fotograma con `tick < G.tick`; en
  `G.tick + enRedS` → `null` y `estadoVisual` da el balón en (52,5, 34) (v2+) o en el estado registrado (sin
  reglas); `discreto = true` → nunca `vuelo`, `red` con `u = 1`; con dos goles (v1) cada uno reconstruye el
  suyo; evento `gol` sintético con `hasta.y` fuera del arco → `null`; el registro no se modifica
  (`JSON.stringify` antes/después).
- `alturaIlustrativa`: las cinco distancias de los fixtures dan las bandas de § 5.1; un evento sintético a
  14 m → `media`; `distanciaM: NaN` → `raso` con `derivada: false`; `metros < ARCO_3D.altoM`.
- `vistaArco`: `defiende` y signo lateral para un gol en cada arco; autogol sintético (`lado` del beneficiado,
  `hasta.x = 0`) → `defiende === "local"`; acotación a `±(arcoM/2 − radio)`.
- Invariantes de § 6.
- `instanteAudio`: con tramos reales de una pista sintética (narrador + intervención de ancho cero + previa
  en [0, 0]), `instanteNarrado(tramos, instanteAudio(tramos, t)).tick` difiere de `t` en ≤ 1 tick para `t` en
  cada tramo del narrador; nunca devuelve un instante dentro de un tramo de ancho cero; `t ≤ 0` → 0; `t ≥ fin`
  → fin del último tramo.

**`src/ui/__tests__/arena-gol-visual.test.tsx` (nuevo, `renderToStaticMarkup`).** `ArenaVistaArco` con el
gol v1 `a23` en `G.tick`, `G.tick + entradaRedS/2` y `G.tick + entradaRedS`: `data-arco`, `data-altura`,
`cx` monótono hacia el destino y `r` creciente; en `reducido` el primer render ya está en el destino;
figcaption con «ilustrativa»/«illustrative», el nombre del equipo que defiende y «lateral»; autogol →
`data-autogol` y «Autogol»/«Own goal»; `gol = null` → nada. Y el tablero de 050 (marcador y rótulo) sigue
idéntico con la escena presente.

**`src/arena/__tests__/grabaciones-subida.test.ts` (nuevo, patrón de `servicios-azure.test.ts:144`).**
Con `ARENA_VOZ=1` y un `GestorSesiones` temporal: `{ registro: v5 }` → 200 y `registro(id)` igual al archivo;
segunda subida del mismo archivo → **mismo `id`**; registro con una `y` de un evento alterada → 400; con una
orden de `rondas[0]` alterada → 400; registro truncado (`final.tick` menor que la duración, sin `finalizado`)
→ 400 «incompleto»; cuerpo de `archivoMaxBytes + 1` bytes → 400; sin `ARENA_VOZ` → 503; `{ archivo: "duelo" }`
sigue funcionando (prueba existente en verde).

**`e2e/arena-play-narrado.spec.ts` (nuevo; rutas y Speech simulados como en `arena-descargas.spec.ts`:
`herramientas` → `voz: true`; `grabaciones` → `{ id }` de una sesión programada real creada con
`crearSesion`; `relato` → `construirRelato` real + WAV de silencio por ventana).**

| Qué ocurre | Qué se comprueba |
| --- | --- |
| «Crear grabación sin IA» (POST real a `/api/arena`), conmutador visible y marcado, Play | una petición a `grabaciones` con cuerpo `{ registro }` cuyo `final.tick` es el del registro; `arena-play-progress` visible con `n/total`; el botón lee «Play without narration» mientras prepara; al sonar, `audio.paused === false`, el botón lee «Pause» y `arena-clock` avanza sin que `requestAnimationFrame` de `Arena` esté activo (el deslizador cambia con `audio.currentTime`) |
| «Pause» | `audio.paused === true`, el cursor no cambia en 300 ms; «Play» → vuelve a sonar desde el mismo `currentTime` |
| Deslizador a mitad del partido | `audio.currentTime` cambia al valor de `instanteAudio` de los tramos servidos y el reloj muestra el tick mapeado; «Restart» → `currentTime === 0` y `0:00` |
| Fin del audio (clips cortos) | botón «Play»; al pulsarlo no hay peticiones nuevas a `relato` (pista en caché) y vuelve a sonar desde 0 |
| `relato` responde 404 | `arena-play-fallback` con «expired»/«caducó» o «registered» según el camino, la cancha se mueve (`transform` de una ficha cambia) y `audio` sin `src` |
| `herramientas` con `voz: false` | el conmutador no existe; Play mueve la cancha como hoy |
| Conmutador desmarcado | Play no pide `grabaciones` ni `relato` |
| Cargar «ejemplo de entrenadores IA» con voz y Play | `grabaciones` recibe `{ archivo: "ejemplo-v3" }`, no `{ registro }` |
| 360 × 780, oscuro, `reducedMotion: reduce` | `scrollWidth ≤ 360`; «Listen from the start», «Stop narration» y «Download audio (WAV)» siguen presentes y el WAV se habilita tras preparar |

**`e2e/arena-gol-visual.spec.ts` (nuevo; ejemplo `arena-llm-v3.json` cargado como en
`arena-canto-gol.spec.ts`, cursor con el deslizador).** Con `g1` (arco izquierdo) y `g2` (arco derecho):
cursor en `g.tick/10 − 0,2` → `.arena-ball[data-reconstruccion="vuelo"]` con `cx` entre la posición del
fotograma previo y `hasta.x`; en `g.tick/10` → `data-reconstruccion="red"`, `cy` = `hasta.y`; en `g.tick/10 +
enRedS/2` → `cx` fuera de la cancha hacia el arco batido, 22 fichas con el `transform` del fotograma previo,
`arena-goal-view[data-arco]` del lado correcto con `data-altura` y texto «illustrative», **sin**
`arena-restart`; en `g.tick/10 + enRedS` → `cx="52.5"` o el estado registrado, `arena-restart` presente (v2+
solo: con el ejemplo sin reglas se comprueba que el balón vuelve al valor del fotograma), sin
`data-reconstruccion`; en `g.tick/10 + celebracionS` → sin `arena-goal-view`. `emulateMedia({ reducedMotion:
"reduce" })` → `animationName === "none"` en `.arena-goal-view` y en `g.tick/10 − 0,2` **no** hay
`data-reconstruccion="vuelo"`. Estilos calculados de `.arena-ball`: `animation-name: none`, `transform: none`
(como `arena-canto-gol.spec.ts:71`). 360 px sin desborde.

**Mutaciones (cada una pone al menos una prueba en rojo).**

| # | Mutación | Prueba |
| --- | --- | --- |
| M1 | cota inferior quitada en `reconstruccionGol` (un gol futuro reconstruye) | antes del fotograma previo → `null` |
| M2 | `balon.y` tomado de `desde.y` en vez de `hasta.y` | fase `red` |
| M3 | signo del arco por `lado` en vez de `hasta.x` | autogol en `vistaArco` y profundidad hacia el campo |
| M4 | `congelado` = fotograma del tick del gol (jugadores ya en el centro) | fichas iguales al fotograma previo |
| M5 | corte al centro omitido (`red` sin tope) | `G.tick + enRedS` → `null`; e2e `arena-restart` presente |
| M6 | `vuelo` también en `discreto` | prueba con `discreto = true` |
| M7 | `enRedS` escrito a mano ≥ `pausaS` | invariante |
| M8 | banda de altura fija («media» siempre) | cinco distancias de los fixtures |
| M9 | figcaption sin «ilustrativa» | prueba UI y e2e |
| M10 | fase del recuadro por `Date.now` en vez del cursor | prueba UI: tres ticks con `vi.useFakeTimers` y reloj avanzado sin mover el cursor → mismo `cx` |
| M11 | `arena-restart` visible durante `red` | e2e gol visual |
| M12 | rama `registro` sin `reproducirArena` | `y` alterada → 400 |
| M13 | `referencia` con `Math.random` | mismo `id` en la segunda subida |
| M14 | lector de 16 KB en la rama `registro` | subida del fixture v5 (≈ 3 MB) → 200 |
| M15 | `buscar` no toca `audio.currentTime` | e2e deslizador |
| M16 | degradación sin reproducción muda | e2e 404 |
| M17 | conmutador activo con `voz: false` | e2e y prueba UI |
| M18 | `instanteAudio` cae en un tramo de ancho cero | propiedad inversa |
| M19 | CSS `animation` en `.arena-ball` o `.arena-goal-view-ball` | e2e estilos calculados / grep de `globals.css` en la prueba de contraste |

## 8. Impacto en e2e y selectores (lista cerrada)

Siguen resolviendo igual: `getByRole("button", { name: "Play"/"Reproducir"/"Pause", exact: true })` (los
textos en reposo no cambian), `arena-clock`, `arena-ball`, `arena-player`, `arena-referee`, `arena-restart`,
`arena-narration`, «Listen from the start», «Stop narration», «Enable narration for this recording»,
`arena-narration-download`, `.arena-score`, `.arena-goal-banner`, `g[data-gol]`.

Selectores nuevos: `arena-play-voice`, `arena-play-progress`, `arena-play-fallback`, `arena-goal-view`
(`data-arco`, `data-altura`, `data-lado`, `data-autogol`), `.arena-ball[data-reconstruccion]`,
`.arena-goal-view-ball`.

**Cambios autorizados en e2e existentes** (como en 056 v1.3; ninguna otra aserción se relaja):

1. `e2e/arena-buffer.spec.ts:46–51` («reinicios: banda, esquina, meta y centro»): para `tipo === "centro"`
   con `evento.tick > 0` el cursor se coloca en `(evento.tick + GOL_VISUAL.enRedS / ARENA.pasoS) / 10`
   (importando `GOL_VISUAL`), porque durante `enRedS` el balón está en la red y `arena-restart` no se muestra
   por diseño (§ 4.2). Las aserciones de «Kick-off», equipo, descripción y `cx/cy` se conservan.
2. `e2e/arena.spec.ts:385–402` (abortar `**/api/arena/**` y Play): el conmutador arranca marcado (voz
   simulada) y la degradación por `red` debe producir el mismo movimiento mudo; si la prueba resulta
   intermitente por el tiempo de la degradación, **se autoriza** desmarcar `arena-play-voice` antes de Play en
   esa prueba y nada más. Opus anota en la bitácora si hizo falta.
3. Los mocks de `**/api/arena/grabaciones` que devuelven `{ id }` para cualquier cuerpo
   (`arena-previa.spec.ts:250`, `arena.spec.ts:450`) siguen válidos.

## 9. Prioridad, orden del día y estimación

Estimación honesta: **≈ 12,5 h**, en este orden y con estos cortes.

- **A · Reproducir con narración (≈ 6 h), obligatorio.** Ruta `grabaciones` (`{ registro }`, lector de 8 MB,
  validador, referencia por hash, registro completo) + prueba 1,5 h; `instanteAudio` + propiedad 0,5 h;
  `ArenaNarracion` (fases, controles, `registrar`, re-registro por 404, reintento 429) 1,5 h; barra de
  `Arena.tsx` (conmutador, textos, progreso, degradación, `saltar` por audio, velocidad fija) 1 h; e2e
  nuevo + revisión de las dos pruebas de § 8 1,5 h. Entrega mínima cerrable: criterios 10.1–10.4.
- **B1 · El gol en la cancha (≈ 2,5 h), si A está en verde.** `reconstruccionGol` + `GOL_VISUAL` + pruebas
  1 h; cableado, `arena-restart`, rótulo de reconstrucción, cambio autorizado del e2e del búfer 1 h; e2e del
  gol (parte cancha) 0,5 h.
- **B2 · Vista frontal (≈ 3 h), si B1 está en verde.** `alturaIlustrativa` + `vistaArco` + pruebas 0,75 h;
  `ArenaVistaArco` + CSS + prueba UI 1,5 h; e2e (parte recuadro), contraste y capturas 0,75 h.
- **Cierre (≈ 1 h):** `npm test`, `typecheck`, e2e de arena serializados, capturas en
  `docs/evidencia/play-narrado-057/` (1440 y 360, claro/oscuro: barra con el conmutador, progreso, red con
  el rótulo y el recuadro), bitácora con mutaciones.

Calendario: implementación el **23** (A y B1), auditoría/Codex y B2 el **24**, despliegue y smoke público el
**25** (con Speech real: un partido sin IA creado en la web, Play con narración oído de principio a fin en ES,
con un gol visto entrar en la red y el recuadro en pantalla; MP3 de la ventana del gol archivado). Si A no
está en verde el 24 a las 12:00, B1 y B2 se posponen y la bitácora lo declara; si B2 no está en verde el 25 a
las 12:00, se entrega A + B1 y B2 queda como recorte del 057. No se recorta A; si A no cabe, se escala a
Carlos antes de decidir.

## 10. Criterios de aceptación (todos vistos correr)

1. `npm test`, `npm run typecheck`, `npm run build` en verde; `npm run e2e -- e2e/arena-play-narrado.spec.ts
   e2e/arena-gol-visual.spec.ts e2e/arena.spec.ts e2e/arena-buffer.spec.ts e2e/arena-canto-gol.spec.ts
   e2e/arena-previa.spec.ts e2e/arena-descargas.spec.ts e2e/arena-identidad.spec.ts` en verde, serializados;
   `git diff --stat src/arena/motor.ts src/arena/tipos.ts src/arena/coordinador.ts src/arena/buffer.ts
   public/experimentos src/arena/__fixtures__` **vacío**.
2. En la web local con `ARENA_VOZ=1`: «Crear grabación sin IA» → Reproducir → se oye la narración desde el
   inicio, la cancha sigue a la voz, Pausar pausa, el deslizador busca en la voz, «Descargar audio (WAV)» se
   habilita; «Abrir registro guardado» con un archivo descargado → lo mismo; con `ARENA_VOZ=0` el conmutador
   no aparece y Reproducir es como hoy.
3. Un `?partido=ID` de una sesión borrada del almacén reproduce con voz tras re-registrarse (una sola
   subida) o degrada con «caducó».
4. Mutaciones M12–M18 anotadas en la bitácora (A); M1–M11 y M19 con B1/B2.
5. B1: en el ejemplo de entrenadores IA, el balón entra en la red en los dos goles, los 22 quedan quietos un
   segundo y el saque de centro llega sin saltos del balón desde la red al centro **salvo el corte declarado**;
   el texto de ayuda lleva el rótulo de reconstrucción.
6. B2: capturas con el recuadro a 1440 y 360 px; `node docs/evidencia/rediseno-047/contraste.mjs` con los
   pares nuevos en 0 fallos.
7. Smoke público del 25 archivado en `docs/evidencia/play-narrado-057/` (JSON de la sesión, MP3 del gol,
   capturas). Sin él, la fila de bitácora queda ⏳.

## 11. Fuera de alcance (cortes decididos)

- **Regla `reinicios-v6` con pausa larga tras gol** (p. ej. 4 s reales en la red). Daría tiempo real de
  celebración y «vuelta al centro» en el registro, pero exige literal de versión, validador, fixture nuevo,
  matriz de versiones, lotes y bandas (≈ 4–6 h, patrón del 051) a cuatro días de la entrega. La reconstrucción
  cabe en los 1,5 s registrados. Candidato a brief si Carlos quiere más tiempo de red.
- Repeticiones del gol a cámara lenta, trayectoria curva, red hundida, rebotes, palos, efecto de
  «vibración» del arco, confeti, sonido de público.
- Persistir el conmutador «Con narración» por espectador (localStorage) y recordar el idioma de la pista.
- Velocidad 2×/4× con voz (`playbackRate` distorsiona la prosodia medida en 050/054).
- Narración en vivo desde Reproducir (en directo y búfer ya tienen su propia voz).
- Lado del remate en la orden `tirar`, altura simulada en el motor, cambios en `potenciaRemate`.
- Cambios en la Mesa, el canto, la transcripción del 053 (la pista es la misma), el Analista o la crónica.

## 12. Límites honestos y riesgos

- **La altura es ilustrativa.** El motor es 2D: la banda raso/media/alta sale de la distancia del remate con
  la misma curva de potencia del 051, no de ningún dato de vuelo. Se rotula en la figcaption, en el
  `aria-label` y en «Alcance y límites». Un gol de cabeza o una vaselina no existen en la arena.
- **La red y la pausa son reconstrucción.** El registro pone el saque de centro en el tick del gol; el balón
  en la red (1 m, 1,0 s) y los 22 quietos son un relleno visual del hueco que el motor no fotografía. El
  vuelo previo es la recta entre la última posición registrada del balón y el cruce real: para remates
  cortos (v5) la velocidad aparente es menor que la del motor porque arranca desde el fotograma anterior
  (hasta 0,5 s antes del tiro). No se afirma ninguna trayectoria observada.
- **Registros sin reglas** (`duelo-v3`, `llm-v3`): tras la red no hay saque de centro en el registro; el
  corte lleva al portero con el balón, como hoy. El recuadro y la red funcionan igual.
- **Sincronía con la voz.** En modo `completo` la cancha sigue al audio por tramos de 10 s con interpolación
  lineal (`instanteNarrado`): el balón entra en la red cuando el cursor cruza el tick del gol, que cae
  **dentro** de la ventana cuyo canto suena, no necesariamente en el «¡Gooool!». Igual que hoy con el rótulo
  del 050. Buscar con el deslizador aterriza en el tick que la pista mapea (granularidad de tramo).
- **Gasto de Speech.** Con el conmutador activo por defecto, cada Reproducir de una grabación sin pista en
  caché sintetiza la pista completa (≈ 15–20 solicitudes para 60 s; 180 s en ES+EN supera el presupuesto por
  sesión, deuda conocida del 048). Mitigación: caché por `clave` en servidor y cliente; una preparación a la
  vez; el usuario puede apagarlo. El smoke mide solicitudes y caracteres de una sesión.
- **Autoplay.** `audio.play()` tras la preparación asíncrona puede bloquearse en navegadores estrictos; la
  fase `pulsar` lo cubre y el botón Reproducir reanuda dentro de un gesto. Sin medir fuera de Chromium.
- **Subida de registros.** Abre a cualquier espectador la creación de sesiones de grabación validadas (8 MB,
  `reproducirArena` de hasta 180 s); misma superficie que `POST /api/arena reproducir` más el almacenamiento
  de 24 sesiones retenidas. `creando` serializa; no hay límite por IP (como en el resto de la arena).
- **Sesiones compartidas.** Un `?partido=` caducado solo se recupera si el registro completo está en memoria
  (lo está: `reproduccion` lo entregó); si el enlace llega con el almacén vacío, se degrada con mensaje.
- **E2e.** Dos pruebas existentes cambian de forma autorizada (§ 8); si la degradación por red resulta
  intermitente, el remedio autorizado es desmarcar el conmutador en esa prueba, no relajar la aserción.
- **Escucha humana** del canto (050/054) sigue pendiente; este brief no la resuelve.

## Versión 1.1 (23 de octubre): decisiones tras la revisión de Codex

La revisión de Codex de la versión 1 (solo lectura, ciclo 1 de 3) dio NO CERRADO: cinco hallazgos altos y
cuatro medios. Fable verificó cada uno contra el código. **Estas decisiones prevalecen** sobre el texto
anterior donde lo contradigan; la numeración es la de Codex.

1. **Alto · Un solo dueño del reloj — aceptado.** Confirmado: el bucle de la cancha mantiene su cursor
   `actual` (`src/ui/Arena.tsx:101–115`) y la pista escribe el mismo cursor desde `sincronizar`
   (`src/ui/ArenaNarracion.tsx:160–176`); la v1 no exigía detener uno al arrancar el otro. Decisión:
   `Arena` guarda `dueno: "mudo" | "voz" | null` y aplica la **exclusión antes de registrar, preparar o
   reproducir**: (a) `iniciar()` solo se llama con `reproduciendo === false` (si estaba en marcha, primero
   `setReproduciendo(false)`); (b) la reproducción muda solo arranca con `fase ∈ {inactiva, final, error}`;
   si la fase es otra, primero `detener()`; (c) un efecto único `useEffect(() => { if (faseActiva(fase))
   setReproduciendo(false) }, [fase])` cubre «Escuchar desde el inicio» y cualquier arranque de pista desde
   `ArenaNarracion`: la cancha muda se apaga **en el mismo render** en que la fase pasa a `registrando`;
   (d) **apagar el conmutador** con la pista en `registrando`/`preparando`/`sonando`/`pausada` llama a
   `detener()` (cancela peticiones, pausa el `<audio>`, suelta la URL) y **no** arranca la reproducción muda
   (cambió un ajuste, no pulsó Reproducir); el cursor se queda donde estaba. `faseActiva` = `registrando |
   preparando | sonando | pausada | pulsar`. Pruebas: unitaria de la función pura `transicionReloj(dueno,
   accion, fase) → { reproduciendo, orden }` que decide cada caso de la tabla de § 3.1 más «conmutador off» y
   «Escuchar desde el inicio»; e2e: con la cancha muda en marcha, «Escuchar desde el inicio» detiene el
   movimiento antes de la primera petición a `relato` (el `transform` de una ficha no cambia entre el clic y la
   primera petición retenida); con la pista sonando, desmarcar el conmutador deja `audio.paused === true`, sin
   `src`, y la cancha quieta 500 ms.
2. **Alto · Registrar cancelaba el inicio recién pedido — aceptado.** Confirmado: el efecto de
   `ArenaNarracion.tsx:38` (`[sesion, archivo, idioma]`) borra la pista y pone `modo = "apagado"` cuando
   `alRegistrar(id)` cambia `sesion`, así que `registrar()` seguido de `setModo("completo")` se perdería; y dos
   grabaciones sin sesión ni archivo no cambian ninguna dependencia de ese efecto. Decisión: `ArenaNarracion`
   recibe `carga: number` (el `cargaId` de `Arena`, que ya incrementa en cada carga correcta) y lo añade a las
   dependencias de los dos efectos de reinicio (`:38` y `:40–49`). La intención de inicio es un `useRef<{ carga,
   idioma } | null>` (`inicioPendiente`): `iniciar()` sin sesión lo fija y llama a `registrar()`; el efecto de
   reinicio, tras adoptar la nueva `sesion`, **consume** la intención solo si `carga` e `idioma` coinciden con
   los actuales (si no, la descarta sin arrancar). `registrar()` captura `g = generacion.current` como el resto
   de peticiones y toda respuesta tardía (registro, reintento de 429, `relato`, decodificación, `play()`) se
   descarta con `vigente()`; cambiar de carga o de idioma incrementa `generacion` y aborta `peticion.current`
   (mecanismo existente). Pruebas (respuestas retenidas con barrera, como `arena.spec.ts:480–504`): (a)
   registro retenido → se carga otro partido → al liberar, **ninguna** petición a `relato` ni `src` en el
   `<audio>` y ningún `arena-play-fallback`; (b) registro retenido → «Reproducir sin narración» → al liberar no
   arranca la pista; (c) **[v1.2]** preparación retenida → cambio de idioma → **se cancela todo y la narración
   queda apagada**: la pista vieja no suena, el `<audio>` no recibe `src`, no hay transcripción y el estado
   dice «Audio desactivado» (es exactamente lo que exige `arena.spec.ts:499–503`, protegido y sin tocar); la
   intención pendiente se descarta con el idioma, **nunca** se pide la pista nueva sola. Comprobación
   posterior en el e2e nuevo: tras ese cambio, una **nueva pulsación de Reproducir** (conmutador marcado)
   pide la pista en el idioma nuevo (`idioma: "es"` en todas las peticiones a `relato`) y suena; (d) unitaria
   de la pura `consumirIntencion(pendiente, carga, idioma)` (idioma distinto → `null`).
3. **Alto · `creando` no protege la validación — aceptado; afirmación de la v1 retirada.** Confirmado:
   `reproducirArena` corre antes de `registrarGrabacion` y el bloqueo vive dentro de esta
   (`src/arena/sesiones.ts:240–244`); el replay es síncrono (`src/arena/coordinador.ts:116–136`). No existe
   ningún limitador reutilizable en `src/arena` ni en las rutas (búsqueda de `limitador`, `rateLimit`,
   `x-forwarded-for`, `porIp`: sin resultados). Decisión: módulo puro nuevo **`src/arena/admision.ts`** con
   `class Admision { constructor(limites, reloj = Date.now); admitir(clave: string): { ok: true; liberar(): void }
   | { ok: false; motivo: "ip" | "global" | "en-curso"; reintentarEnMs: number } }` (ventana deslizante en
   memoria por clave y global, más un contador de trabajos en curso). Constantes en `PLAY_NARRADO.subida`:
   `porIpPorHora: 6`, `globalPorHora: 30`, `enCurso: 1`. La ruta, **antes de leer el cuerpo** y solo en la rama
   sin `archivo` (se decide por `content-length` o por el primer byte: si el cuerpo empieza por `{"archivo"`
   se salta la admisión; en la duda, admisión), llama a `admitir(ip)` con `ip` = primer salto de
   `x-forwarded-for` o `"desconocida"`; un rechazo responde **429** con `retry-after` en segundos y mensaje
   «Hay otra subida en curso» / «Demasiadas subidas; espera un momento», sin leer el resto del cuerpo
   (`req.body.cancel()`). `liberar()` en `finally`, tras el replay y el registro. Un `content-length` mayor que
   `archivoMaxBytes` responde 413 antes de leer (el lector sigue siendo la garantía real). Pruebas: con reloj
   inyectado, la séptima subida de la misma IP en una hora → 429 `ip`; la 31.ª global → 429 `global`; dos
   subidas concurrentes (la primera retenida en un `reproducirArena` simulado con `vi.mock`) → la segunda 429
   `en-curso` **sin** haber llamado a `reproducirArena` (espía con 1 llamada); al avanzar el reloj una hora,
   vuelve a admitir; la rama `{ archivo }` no consume cupo. El cliente trata el 429 como en § 3.3 (un reintento
   tras `reintentoRegistroMs` o `retry-after`, el mayor). **Se retira** del brief toda frase que presente
   `creando` como protección de CPU o de abuso.
4. **Alto · Procedencia declarada, no verificada — aceptado.** Confirmado: `esquemaDecision`
   (`coordinador.ts:95–100`) conserva `controlador`, `tipo`, `origen`, `motivo`, `tiempoMs` y `llamadas` tal
   como vienen del archivo; el replay valida órdenes y resultados, no quién los produjo (comentario en
   `coordinador.ts:107–108`); `registrarGrabacion` convierte `d.controlador` en `asignacion.local.nombre`
   (`sesiones.ts:251–252`), y ese nombre se muestra en `ArenaEnDirecto.tsx:157` (`arena-live-assignment`) al
   abrir `?partido=ID`. Decisiones: (a) `AsignacionModelos` gana `procedencia?: "verificada" | "declarada"`
   (`protocolo.ts:11`); `registrarGrabacion(registro, referencia, procedencia)` la escribe en `meta.json`, en
   el mensaje `sesion` y en las respuestas de `reproduccion`/`emision`; los tres archivos siguen sin campo
   (equivale a «archivo del repositorio»), las subidas llevan `"declarada"`. (b) `ArenaEnDirecto.tsx:157`
   añade, solo con `declarada`, « · {t("controllers declared by the file, not verified", "controladores
   declarados por el archivo, no verificados")}»; el texto de `Arena.tsx:354` («Registro importado…») ya cubre
   el panel de planes. (c) **Hash canónico**: `contenidoCanonico(registro)` (puro, en `coordinador.ts`) =
   `{ version, config, inicial, rondas: rondas.map(r => ({ observacion: r.observacion, inicioTick, finTick,
   ordenes: { local: r.decisiones.local.ordenes, visita: r.decisiones.visita.ordenes } })), eventos, fotogramas,
   final }`; `referencia = "subida-" + sha256(JSON.stringify(contenidoCanonico(registro))).slice(0, 40)` y la
   comparación de deduplicación de `registrarGrabacion` usa el mismo canónico cuando `procedencia ===
   "declarada"` (hoy compara el JSON completo y, si difiere, crea otra sesión: con metadatos distintos se
   duplicarían sesiones y cupos). El primer metadato subido es el que queda en la sesión retenida, y es
   declarado. Pruebas: el mismo partido subido con `controlador: "GPT-6 Sol"` y luego `"Mi modelo"` → mismo
   `id`, `asignacion.procedencia === "declarada"`, y `arena-live-assignment` con el rótulo; `{ archivo: "duelo" }`
   sin `procedencia` (prueba existente intacta); la transcripción del 053 no cambia (no exporta `asignacion`:
   comprobado con `grep` en `transcripcion.ts`).
5. **Alto · «Ningún gol futuro» frente al vuelo previo — aceptado; decisión: excepción declarada.**
   Confirmado: la fase `vuelo` consulta `G.hasta` de un evento posterior al cursor. Decisión (la propuesta
   de empezar en `G.tick` dejaría el balón congelado a metros del arco, que es el defecto que Carlos ve):
   el **vuelo previo es la única excepción**, acotada al último hueco de fotogramas antes del gol (≤
   `fotogramaS` = 0,5 s), y se declara en § 4.1, § 12 y en el texto de ayuda («…el balón se dibuja llegando a
   la red…»). Todo lo demás —marcador, rótulo, anillo, recuadro, `data-gol`, nombre del goleador y
   `escena.gol`— queda sujeto a `tick ≥ G.tick`. El tipo pasa a ser una unión discriminada: `{ fase: "vuelo";
   balon; congelado }` **sin `gol`** y `{ fase: "red"; gol; balon; congelado }`. `data-reconstruccion="vuelo"`
   se conserva (no identifica el gol). Mutación M1 se divide: **M1a** `reconstruccionGol` devuelve algo con el
   cursor antes del último fotograma previo (cota del hueco) → prueba `null`; **M1b** fase `red` o `gol`
   expuesto con `tick < G.tick` → prueba sobre el tipo y sobre `golEnCelebracion` (ya tiene su prueba del 050).
6. **Medio · Inversa del audio en los extremos — aceptado.** Confirmado: con previa (056) el primer tramo
   es `[0, 0]` en ticks con audio de ≈ 12 s, así que «`tick ≤ 0 → 0`» cae dentro de una intervención; y en una
   frontera `instanteNarrado` elige el tramo siguiente (`segundos < finS`, `pista-audio.ts:25`), que puede ser
   una intervención de ancho cero. Decisión, contrato cerrado de `instanteAudio(tramos, tick)`:
   - `tick ≤ 0` → **0** (inicio del audio, previa incluida: «Volver al inicio» vuelve a oír la previa; es la
     excepción declarada y la única búsqueda que puede aterrizar fuera del narrador);
   - si no, tramo = primer tramo con `hastaTick > desdeTick` (narrador) y `desdeTick ≤ tick < hastaTick`; si
     `tick ≥` el último `hastaTick` del narrador → el último tramo del narrador con progreso 1;
   - instante = `inicioS + progreso · (finS − inicioS)`, **acotado a `[inicioS, finS − 0,001]`**: nunca se
     devuelve `finS`, así que `instanteNarrado` no salta al tramo siguiente en una frontera compartida.
   Pruebas (sustituyen a la propiedad sola): pista sintética con previa `[0,0]`, narrador `[0,100]`,
   intervención `[100,100]`, narrador `[100,200]`: `instanteAudio(0) === 0`; `instanteAudio(100)` cae en el
   segundo tramo del narrador con progreso 0 (no en la intervención ni al final del primero);
   `instanteAudio(200)` = fin del último narrador − 1 ms; para `t ∈ (0, 200)` en pasos de 1 tick,
   `instanteNarrado(...).indice` es un tramo del narrador y `|tick − t| ≤ 1`. **M18** pasa a: «frontera sin
   acotar (`finS` exacto) → la prueba del tick 100 en rojo».
7. **Medio · Matriz v1–v5 y regla 047 — aceptado en parte.** Confirmado: la v1 omitía los fixtures v2
   (`a12`, tick 189, arco izquierdo) y v4 (`a22`, tick 367, visita, `hasta` (0, 34,2), 2 m → `raso`); y
   `estadoVisual` congela a los jugadores solo con reinicio tipado y **sigue interpolando al árbitro**
   (`vista.ts:19–25`). Decisión: `congelado = A` (22 y árbitro) en **las dos fases**, todas las versiones;
   `gol-visual.test.ts` recorre los **cinco** fixtures `arena-reinicios-v1…v5` más `duelo-v3` y `llm-v3`
   (sin reglas) con la misma tabla de aserciones, parametrizada. Sobre 047: el cableado por atributos SVG
   **sí cumple** (Codex lo confirma); se amplía la comprobación: el e2e de gol visual repite íntegro el bucle
   de `arena-canto-gol.spec.ts:71` (`animation-name: none`, `transition-property`/`transition: all 0s`,
   `transform: none` de CSS) sobre `.arena-player`, `.arena-ball` **y** `.arena-referee` en fase `red`, y la
   prueba de contraste añade una comprobación estática de `globals.css` **[v1.2]** que falla solo si una regla
   cuyo **selector termina en** `.arena-player`, `.arena-ball` o `.arena-referee` (con o sin atributos o
   pseudoclases sobre ese mismo elemento, p. ej. `.arena-player[data-gol]`, `.arena-player:focus-visible`;
   **no** sus descendientes como `.arena-player[data-gol] > .arena-token > circle.arena-goal-ring`, cuya
   `animation` del 050 está permitida en `globals.css:3105`, ni `.arena-token`, que lleva la escala del 047)
   declara `transform`, `transition` o `animation`. Se implementa analizando cada bloque `selector { … }`,
   separando por comas y mirando el último compuesto de cada selector. **M19** pasa a tres mutaciones
   dirigidas a esos tres elementos: añadir `animation`, `transition` o `transform` a una regla de
   `.arena-player`, `.arena-ball` o `.arena-referee` (una cada vez) → la comprobación estática y los estilos
   computados del e2e en rojo; añadirlas al anillo descendiente **no** debe ponerla en rojo (caso de control).
8. **Medio · Pruebas que no demostraban lo anunciado — aceptado.** Decisiones concretas:
   - **M10**: prueba unitaria de `ArenaVistaArco` con `renderToStaticMarkup`: dos renders con el mismo `tick`
     y `vi.useFakeTimers` avanzado 5 s entre ambos → **markup idéntico**; el `cx` cambia solo al cambiar `tick`.
   - **Un solo escritor (e2e)**: se retira la frase «sin que el RAF de `Arena` esté activo». Se comprueba:
     con la pista sonando, en dos instantes separados 1 s, `arena-clock` coincide con
     `reloj(instanteNarrado(tramos, audio.currentTime).tick · pasoS)` con tolerancia de 0,3 s (los `tramos` se
     reconstruyen en la prueba a partir de las duraciones de los WAV servidos); con `audio.pause()` el reloj no
     cambia en 500 ms; tras `Pause` y «Volver al inicio», idem desde `0:00`.
   - **Alteración concreta en la prueba de la ruta**: (i) `rondas[0].observacion` cambiada → 400
     («Observación archivada alterada» es determinista: `coordinador.ts:125`); (ii) `rondas[1].decisiones.local.
     ordenes.ordenes[0].destino.x + 5` sobre el fixture v5 → 400 (cambia el movimiento y por tanto
     `eventos`/`fotogramas`, `coordinador.ts:136`); (iii) `y` de un evento alterada → 400. Las tres se nombran
     en la prueba.
   - **Pruebas nuevas obligatorias**: cancelación durante el registro (2b), cambio de carga durante la
     preparación (2a), conmutador apagado con audio (1d), **autoplay bloqueado** (`addInitScript` que hace que
     el primer `HTMLMediaElement.prototype.play` rechace con `NotAllowedError` → fase `pulsar`, botón «Play»,
     clic → suena), **error tardío** (`relato` 200 en las dos primeras ventanas y 500 en la tercera → la pista
     no arranca, `audio` sin `src`, `arena-play-fallback` visible y la cancha muda en marcha). Regla cerrada
     de motivos para la respuesta de `relato`, que sustituye a la de § 3.2: 404 → `caducada` (tras el único
     re-registro); 429 → `presupuesto`; 503 → `sin-voz`; cualquier otro 4xx/5xx → `red`; `TypeError` de
     `fetch` → `red`; `grabaciones` ≠ 2xx tras el reintento → `sin-sesion`.
   - **Autorización de e2e cerrada**: solo los dos cambios de § 8. `e2e/arena.spec.ts:68–86` (caché de la
     pista y `ended`) y `:480–504` (cancelación y respuestas atrasadas) **no se tocan ni se relajan**; el
     nuevo contrato debe dejarlos en verde tal cual.
9. **Medio · Lector tipificado y reestimación — aceptado.** Confirmado: `leerJsonAcotado` lanza
   `Error("Petición demasiado grande")` y `respuestaErrorSesion` lo convierte en 400 con el mensaje genérico
   (`sesiones.ts:427–428`), no en el 413 prometido. Decisiones: `peticiones.ts` exporta `class ErrorPeticion
   extends Error { constructor(mensaje, readonly status: 413 | 400) }` y `leerJsonAcotado` la lanza
   (413 «Petición demasiado grande», 400 «Petición vacía» / JSON inválido); `respuestaErrorSesion` responde
   `error.status` y `error.message` también para `ErrorPeticion` (las demás rutas que la usan heredan el 413
   sin cambiar su comportamiento para errores genéricos). Pruebas: cuerpo `{ "registro": … }` servido como
   `ReadableStream` en fragmentos de 64 KB hasta `archivoMaxBytes + 1` → 413 **antes** de que `JSON.parse`
   o `reproducirArena` se ejecuten (espías); el fixture v5 (≈ 3 MB) → 200; un partido programado de
   `ARENA.duracionMaxS` (180 s) generado en la prueba con `ejecutarArena` → tamaño medido `< archivoMaxBytes`
   (aserción) y 200. **Reestimación** (sustituye a § 9): A **8,5 h** (ruta + admisión + canónico + lector +
   pruebas 3 h; `instanteAudio` 0,5 h; `ArenaNarracion` con intención pendiente, `carga`, fases y controles
   2 h; barra y exclusión del reloj 1 h; e2e con barreras, autoplay y error tardío 2 h), B1 **2,5 h**, B2
   **3 h**, cierre **2 h** (suites completas, mutaciones con md5, capturas, contraste), Speech real +
   despliegue + smoke público **1,5 h** aparte: ≈ **17,5 h**. Compromiso: **A con sus pruebas el 23** y, si no
   está en verde el 24 a las 10:00, el 24 se dedica a A; **B1 solo con A en verde** (24), **B2 solo con B1
   en verde el 25 a las 10:00**; despliegue y smoke el 25 por la tarde con lo que haya en verde; el 26 queda
   para corregir el smoke y enviar. No se recorta A.

### Qué cambia para Opus (lista)

- `Arena.tsx`: `dueno` del reloj y `transicionReloj` pura; efecto único que apaga la cancha muda al activarse
  la pista; conmutador off → `detener()` sin reproducción muda; `carga={cargaId}` a `ArenaNarracion` (1, 2).
- `ArenaNarracion.tsx`: prop `carga` en los efectos de reinicio; `inicioPendiente` consumido tras adoptar la
  sesión si coinciden `carga` e `idioma`; `registrar()` con `generacion`; mapa de motivos con la regla de 5xx (2, 8).
- `src/arena/admision.ts` nuevo + `PLAY_NARRADO.subida`; ruta `grabaciones` con admisión antes de leer,
  `content-length` → 413 temprano, `retry-after`, `liberar()` en `finally` (3).
- `AsignacionModelos.procedencia`, `registrarGrabacion(…, procedencia)` con comparación canónica,
  `contenidoCanonico` en `coordinador.ts`, rótulo en `ArenaEnDirecto.tsx:157` (4).
- `reconstruccionGol` como unión discriminada sin `gol` en `vuelo`; `congelado = A` (22 + árbitro) en ambas
  fases; texto de ayuda con «llegando a la red» (5, 7).
- `instanteAudio` con los tres desempates y la cota `finS − 0,001` (6).
- Pruebas: cinco fixtures + dos ejemplos; 047 sobre los tres selectores con `grep` de CSS; M1a/M1b, M10, M18,
  M19×3; alteraciones (i)–(iii); e2e nuevos de carreras, autoplay y error tardío; reloj comparado con
  `instanteNarrado` (7, 8).
- `ErrorPeticion` en `peticiones.ts` y en `respuestaErrorSesion`; pruebas de 413 por fragmentos y de 180 s (9).
- Calendario y estimación del punto 9; la fila de bitácora queda ⏳ hasta el smoke público.

## Versión 1.3 (23 de octubre): decisiones tras la auditoría adversaria y la segunda revisión de Codex

Las decide Opus por delegación de Carlos («haz lo que creas mejor»). Fable auditó y Codex revisó.
**Prevalecen** sobre el texto anterior.

1. **El 429 de la subida no cuelga la reproducción** (auditoría, hallazgo A). Esto cierra la contradicción
   entre la decisión 4 y la v1.1 § 3.
   - El cliente reintenta **una sola vez** y solo si `retry-after` ≤ `PLAY_NARRADO.subida.reintentoMaxS`,
     que vale 5 s. Este es el caso «en curso», con `retry-after` de 2 s.
   - Con un `retry-after` mayor (cuota por IP o global agotada) degrada **de inmediato** a reproducción muda.
     El motivo nuevo es `ocupado`: ES «Demasiadas grabaciones subidas; la narración vuelve en N min.»,
     EN «Too many uploaded recordings; narration returns in N min.», con N redondeado hacia arriba.
2. **Fase `pulsar` con el control nativo.** Si el `<audio>` arranca por su propio control mientras el estado
   es `pulsar`, el estado pasa a `reproduciendo` y la barra muestra Pausa.
3. **Reproducir respeta el cursor.** Esto corrige la tabla de la § 3.1.
   - Con la pista lista, o en cuanto quede lista, la reproducción busca el instante del cursor con
     `instanteAudio`. El camino del juez es «arrastro hasta el gol y pulso Reproducir».
   - Si el cursor está en el final, empieza en 0. Si está en el tick 0, rige la regla de la previa de la v1.1 § 6.
4. **Pruebas obligatorias nuevas.**
   - E2e de subida con 429 + `retry-after: 2` una vez: reintenta y suena.
   - E2e con 429 + `retry-after: 3600`: degrada al momento con el motivo `ocupado`, sin esperar.
   - E2e con 500: muestra `sin-sesion`.
   - E2e de `pulsar` seguido de play nativo.
   - E2e de Reproducir desde el cursor a 0:15: el reloj ≥ 0:14.
   - Mutaciones que deben salir rojas: quitar el reintento, mapear el fallo de la subida a `red` y arrancar en 0.
5. **Rama `{ archivo }`.** Si el cuerpo empieza por `{"archivo"`, el tope de lectura vuelve a 16 KB.
   Los errores de esquema (ZodError) responden 400 «Cuerpo inválido» / «Invalid body», no el mensaje de configuración.
6. **`css-047` con comillas** (Codex, 2.ª revisión).
   - Los recorridos de selectores mantienen el estado de comillas y escapes.
   - Paréntesis y comas solo cuentan fuera de cadenas.
   - Regresión: `.arena-player[data-x="("] > .arena-token { animation: a 1s }` no es violación.
7. **Límite declarado en la § 12.** Tras un 429 que cancela el cuerpo, un cliente con keep-alive puede ver
   `ECONNRESET` en la petición siguiente. En el navegador se trata como `sin-sesion`. No se corrige ahora.
8. **Recuento honesto.** La suite e2e completa tiene 185 pruebas tras el seguimiento. Se corrigen el README y la BITACORA.
