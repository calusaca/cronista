# Tres voces: narrador, comentarista y estadista

## Alcance de esta revisión

Propuesta pedida por Carlos el 20 de octubre tras el brief 044: una transmisión
con tres roles que se ceden la palabra, como en las retransmisiones reales. Es un
brief de diseño; la implementación espera un «dale» explícito. Aplica solo a la
emisión de la arena (`/arena`, vistas en directo y búfer) en ES/EN. No cambia la
crónica principal, el Analista histórico, el simulador ni `RegistroArena`.

Versión 2, tras la revisión de Codex (GPT-6) del 20 de octubre contra el código:
quince hallazgos, todos incorporados o resueltos aquí.

## Qué muestran los seis transcripts

Se revisaron de nuevo los archivos de `docs/DatosPrueba` (subtítulos automáticos
con marca de tiempo y sin etiqueta de hablante; los roles se infieren por señales
verbales, no por audio). No se necesita ni se incorpora audio: los turnos, los
disparadores y el contenido por rol están en el texto, y la prosodia ya se mide
sobre el sistema propio (briefs 038–043). El material es ajeno y no entra en el
simulador ni en las plantillas; solo orienta el diseño.

| Rol | Señal en los transcripts | Cuándo habla |
| --- | --- | --- |
| Narrador | Hilo actor → destino → receptor; en radio reorienta con equipo, sector, marcador y periodo (Maipú–San Martín, líneas 282–297). | Balón en juego. Es quien manda y quien cede la palabra. |
| Comentarista | TV Madrid–Barcelona: el narrador lo llama por su nombre (6 veces) y él interpreta después de la acción (líneas 419–422, 446–448, 620–622); inglés City–Arsenal: «as you say» y táctica tras la jugada. | Pausas: reinicios, cambios, tras un gol antes del saque, descanso. Opina y predice; no narra. |
| Estadista / central informativa | Radio: «Central informativa» 25 veces, con tabla, otros marcadores, alineaciones y terna (líneas 130–297). En TV la posesión la lee el comentarista (líneas 651–653, 763–764). | Cortes largos; nunca sobre una jugada en marcha. |

Patrón de interacción: el narrador cede por nombre, el otro rol habla en una pausa
y el narrador retoma al primer toque. Nadie habla sobre un remate.

**Diferencia con el motor de arena.** Las pausas reales duran decenas de segundos;
las del motor duran `TECNICA_ARENA.pausaS` = 1,5 s y el reloj visual no espera al
audio (`src/arena/buffer.ts`, `RelojBuffer`). Por eso los invitados no hablan
«en la pausa» sino en **ventanas de calma**, y cualquier noticia del narrador los
corta con la política vigente. No se alarga el partido ni se cambian reglas del
motor.

## Diseño

### Roles

1. **Narrador (hablado).** Conserva íntegras las plantillas de `relatoBuffer`
   (`src/arena/relato.ts`). Los comentarios LLM actuales (`narrarArena`,
   publicaciones `tipo: "comentario"`) **siguen siendo textuales** y no generan
   turno de audio; en la interfaz se muestran como texto del narrador. De los
   candidatos de `comentarioEditorial` (`src/arena/editorial.ts`) se retiran
   `balance-remates`, `balance-pases` y `marcador`, que pasan al estadista; los
   demás candidatos se conservan. No se añade recapitulación tras gol.
2. **Comentarista (análisis con hechos citados).** Intervención LLM incorporada
   a la cola de voz. Reutiliza la tubería de `narrarArena`: hechos de
   `contextoNarradorArena` ampliados a los últimos `MESA_ARENA.hechosComentarista`
   hechos permitidos más los datos del estadista del mismo tick (cada uno es un
   `HechoVerificable` con `datos`), prompt propio `SISTEMA_COMENTARISTA_ARENA`,
   salida JSON `{"oraciones":[{"texto_es","texto_en","hecho","apoyo"}]}` con el
   máximo de oraciones derivado de `MESA_ARENA.maxOracionesComentarista`, y
   `verificarUpdate` con V1–V8 sin excepciones: nada de predicciones, efectos
   tácticos no modelados ni vocabulario de juicio no pagado por el hecho; el
   marcador, las condiciones y las ventanas de cambio solo se citan si figuran
   en los datos del hecho principal o de apoyo. Lo que distingue al comentarista
   del narrador es la función: conecta hechos (secuencia → desenlace, balances
   entre equipos), no describe la jugada en curso. Si el LLM falla o es
   rechazado, respaldo determinista: plantilla elegida entre
   `MESA_ARENA.respaldosComentarista` por idioma, construida solo con los datos
   del hecho principal y verificada por la misma `verificarUpdate` (la prueba lo
   exige). Se publica con `rol: "comentarista"` y modo `llm` | `plantilla`.
3. **Estadista.** **Código determinista con pruebas, sin LLM** (regla del
   proyecto). Módulo `src/arena/estadista.ts`: `datosEstadista(registro, tick)`
   devuelve datos con textos ES/EN por plantilla y evidencia explícita. Tabla
   normativa:

   | Tema | Entrada | Fórmula | Periodo | Redondeo / sin muestra |
   | --- | --- | --- | --- | --- |
   | `marcador` | `inicial.marcador` + eventos `gol` ≤ tick | suma por lado | acumulado | entero; siempre disponible |
   | `reloj` | tick | `tick · pasoS` | instante | segundos enteros |
   | `remates` | eventos `tiro` por lado | conteo; «a puerta» = remates cuyo desenlace es `gol` o `atajada` asociado al mismo remate (misma `lado`, primer desenlace posterior sin otro `tiro` en medio) | acumulado | entero; con 0 remates se dice «sin remates» citando el intervalo |
   | `atajadas` | eventos `atajada` por portero | conteo | acumulado | entero |
   | `acciones` | eventos `pase`, `recepcion`, `recuperacion`, `intercepcion` por lado (`TipoEventoArena`; el motor no registra conducciones como eventos) | proporción de acciones del lado sobre el total, rotulada «proporción de acciones», no «posesión» | últimos `MESA_ARENA.ventanaAccionesS` s | porcentaje entero; con < `MESA_ARENA.minAcciones` acciones no se emite |
   | `faltas` | eventos `falta`, `amarilla`, `roja` por lado | conteos | acumulado | entero |
   | `cambios` | eventos `cambio` por lado y `TECNICA_ARENA.maxCambios/maxVentanas` | usados y restantes | acumulado | entero; 0 usados cita el intervalo |
   | `reinicios` | eventos `reinicio` por tipo | conteo | acumulado | entero |
   | `pases` | eventos `pase` con `distanciaM` | media | últimos `ventanaAccionesS` s | metro entero; < `minAcciones` no se emite |

   Evidencia: cada dato lista `eventos` (los que entran en la fórmula) y, cuando
   el valor no procede de eventos (marcador inicial, reloj, conteo cero), el
   intervalo `[desdeTick, hastaTick]` inspeccionado y `inicial` como fuente.
   **No hay tabla de liga**: la emisión no dispone de una clasificación con
   procedencia y no se calcula ninguna. Para registros anteriores a
   `reinicios-v3`, los `tiro_fuera` que siguen a una `atajada` con `motivo:
   "desvio"` del mismo remate no cuentan como segundo remate (deduplicación
   documentada en el brief 044). Un dato solo se emite si cambió respecto a la
   última candidatura del mismo tema en la sesión (comparación por valor, en el
   servidor).

Nombres ficticios por idioma en `MESA_ARENA.nombres` (p. ej. ES «Rodrigo Valle»,
«Ana Cedeño», «Tomás Ibarra»; EN «Mark Ellison», «Priya Chandra», «Owen Platt»);
no coinciden con locutores reales ni con los que aparecen en los transcripts.

### Candidaturas en el servidor, reproducción en el consumidor

- **El servidor genera cada candidatura una sola vez** y la publica en el diario
  de la sesión como `PublicacionSesion` `{ tipo: "intervencion", intervencion }`,
  con `id` estable (`${rol}:${tema}:${tick}`), `rol`, `tick`, `tema`, `oraciones`,
  `hechos`, `evidencia`, `audit`, `modo` (`llm` | `plantilla` | `determinista`).
  Instantánea (`emision`), reproducción (`reproduccion`) y recuperación exponen
  `intervenciones` junto a `comentarios`; `aplicarPublicacion`, `RegistroArena` y
  `hechosArena` no cambian. Leer, reconectar o reproducir nunca genera otra
  intervención.
- Disparadores de candidatura (servidor, al avanzar el prefijo): estadista cada
  `MESA_ARENA.estadistaCadaS` s de partido y al final; comentarista tras un hecho
  permitido con prioridad ≥ `MESA_ARENA.comentaristaDesdePrioridad` o al cumplirse
  `MESA_ARENA.comentaristaCadaS` s sin intervención suya, hasta
  `MESA_ARENA.maxComentaristaPorSesion`. Generación LLM por `src/lib/llm.ts` con
  el mismo modelo del narrador, plazo `MESA_ARENA.plazoComentaristaMs`, un
  reintento con feedback (como `narrarArena`), presupuesto compartido con el
  vigente de la sesión; al agotarlo, respaldo por plantilla.
- **Cada consumidor decide la reproducción** con su memoria local de escucha
  (`RecuerdoVoz` gana `rol`). Preparar o descartar una candidatura no la marca
  como escuchada; solo iniciar su audio. «No repetir mientras no cambie» es
  propiedad de las candidaturas (servidor), no de la memoria local.

### Un clip por intervención: cesión y voz invitada en el mismo audio

La cesión del narrador y la intervención del invitado se sintetizan en **un solo
documento SSML con dos elementos `<voice>`** (narrador → invitado): un clip, una
prioridad, un tick, una entrada de memoria y una duración decodificada ≤
`VOZ_BUFFER.duracionMaxS`. No hay cesiones sueltas ni retomas sintetizadas: el
siguiente clip del narrador es la retoma. La cesión se elige entre
`MESA_ARENA.cesiones` por idioma con `elegirVarianteVoz`; si la intervención
cabe sin ella (duración), se incluye; si no, se omite la cesión y no el dato.
`prepararVoz` y `ssmlComentario` aceptan `rol` por fragmento y eligen la voz por
rol; `sintetizarVoz` no cambia su contrato de salida.

El consumidor pide estas intervenciones por la ruta de relato existente con
`modo: "buffer"` y un `tipoRelato: "invitado"`; para ese tipo acepta hasta
`MESA_ARENA.fragmentosPorIntervencion` (2) fragmentos, con el resto de
validaciones intactas (`src/ui/ArenaEmisionBuffer.tsx`). Caducidad: una
intervención no arranca si `partidoS − tick/10 > MESA_ARENA.caducidadInvitadoS`.

### Coordinador de turnos

Función pura `siguienteTurno(entrada): { clip, memoria } | null` en
`src/arena/turnos.ts`, con `entrada = { registro, partidoS, ahoraAudioS,
fuenteActiva: { rol, prioridad, finS } | null, ultimaNoticiaS, candidatas:
{ id, rol, tick, prioridad, duracionS }[], memoria: RecuerdoVoz[] }`. El reloj de
audio y las duraciones decodificadas se inyectan; la función no lee el DOM ni
Web Audio. Reglas, con constantes en `MESA_ARENA`:

- **Noticias del narrador: política vigente sin cambios.** `planVozBuffer`
  sigue decidiendo con `VOZ_BUFFER.prioridadInterrupcion` (35) y comparación de
  prioridades; reinicios y remates cortan a quien esté hablando, como exige el
  brief 042.
- **Los invitados nunca interrumpen.** Comentarista y estadista solo arrancan
  con `fuenteActiva === null` (ninguna fuente audible, reservas incluidas) y
  entran al plan con `prioridad = MESA_ARENA.prioridadInvitado` (20, por debajo
  del umbral de interrupción), de modo que cualquier noticia ≥ 35 los corta y
  ellos no cortan nada.
- **Ventana de calma.** Un invitado arranca solo si `partidoS − ultimaNoticiaS
  ≥ MESA_ARENA.calmaMinS` o hay `pausa` vigente en el fotograma del cursor
  (`estado.pausa.hastaTick > tick`). Al reanudarse el juego no se detiene al
  invitado por sí mismo: lo detiene la primera noticia del narrador (saque,
  pase con prioridad de jugada, remate), que ya existe en la cola.
- **Orden entre invitados.** Si ambos tienen candidatura, primero el
  comentarista cuando su tick es más reciente que la última intervención del
  estadista; si no, el estadista. Separación mínima entre invitados
  `MESA_ARENA.separacionInvitadosS`.
- **Silencio.** Techo y exclusiones del brief 041 intactos (pausa manual,
  pestaña oculta, audio desactivado o bloqueado); las reservas siguen siendo
  del narrador.

### `MESA_ARENA` (en `src/sim/limites.ts`, comentada)

```ts
export const MESA_ARENA = {
  prioridadInvitado: 20,          // por debajo de VOZ_BUFFER.prioridadInterrupcion
  calmaMinS: 4,                   // segundos sin noticia del narrador para que entre un invitado
  separacionInvitadosS: 10,       // entre dos intervenciones de invitados
  caducidadInvitadoS: 12,         // una intervención más vieja que esto no arranca
  estadistaCadaS: 20,             // cadencia de candidaturas del estadista
  ventanaAccionesS: 30, minAcciones: 6,
  maxDatosEstadista: 2,
  comentaristaDesdePrioridad: 70, // tiro_fuera, atajada, gol, roja
  comentaristaCadaS: 25, maxComentaristaPorSesion: 6, plazoComentaristaMs: 6000,
  hechosComentarista: 8, maxOracionesComentarista: 2,
  fragmentosPorIntervencion: 2,
  nombres: { es: {...}, en: {...} }, cesiones: { es: [...], en: [...] }, respaldosComentarista: { es: [...], en: [...] },
} as const;
```

Ninguna prueba repite estas cifras a mano. Con estos valores, en un partido de
60 s con una calma de 4 s cada 20 s y un remate, los tres roles tienen
oportunidad de hablar; la prueba e2e lo construye explícitamente (abajo).

### Voz

Una voz por rol e idioma, lista permitida ampliada en `voz.ts`. Voces fijadas
tras consultar el catálogo real de Speech el 20 de octubre (lectura, sin
síntesis; 17 voces es-MX y 70 en-US):

| Rol | ES | EN | Estilo |
| --- | --- | --- | --- |
| Narrador | `es-MX-JorgeNeural` (`chat`, `cheerful`) | `en-US-JennyNeural` | Como hoy. |
| Comentarista | `es-MX-DaliaNeural` (sin estilos) | `en-US-DavisNeural` (`chat`) | Serena por prosodia; `chat` solo en EN. |
| Estadista | `es-MX-GerardoNeural` (sin estilos) | `en-US-GuyNeural` (`newscast`) | Intensidad baja; `newscast` solo en EN. |

Precedencia: `ARENA_VOZ_{ES,EN}_{COMENTARISTA,ESTADISTA}` si están definidas;
`ARENA_VOZ_ES/EN` siguen siendo la voz del narrador. **Degradación**: si la voz
del comentarista falta en el catálogo, usa la del narrador; si falta la del
estadista, usa la del comentarista (o la del narrador si también falta). La
asignación efectiva y su motivo se publican en `/api/arena/herramientas`
(`voces: { rol: { voz, motivo } }`). Un fallo transitorio de síntesis no es
degradación: usa el respaldo vigente.

### Interfaz

El panel «Comentario del narrador» pasa a **Mesa de transmisión**: tres tarjetas
(narrador, comentarista, estadista) con la última intervención de cada uno **no
posterior al cursor visible**, su rótulo («relato», «análisis con hechos
citados», «dato del partido»), el instante, el modo y la evidencia desplegable
como hoy. El transcript de voz expone `data-narration-role`. ES/EN completos;
móvil 360 px sin desborde; movimiento reducido respetado. En replay guardado se
muestran y reproducen las intervenciones del diario; no se generan nuevas.

## Fuera de alcance

- Audio de los transcripts, diarización o cualquier uso del material ajeno más
  allá de orientar el diseño.
- Más de tres roles, reportero de campo, publicidad, otros partidos, tabla de liga.
- Cambios en la crónica principal, el Analista histórico, el simulador, las
  reglas del motor (`pausaS` incluida) o `RegistroArena`.
- Entrenar o afinar modelos.

## Pruebas exigidas

- `turnos.test.ts` con entradas explícitas (`fuenteActiva`, `ahoraAudioS`,
  `ultimaNoticiaS`, candidatas con duración): un invitado no arranca con fuente
  activa; arranca solo en calma o pausa vigente; una noticia ≥ 35 lo corta y él
  nunca corta; separación y caducidad; orden comentarista/estadista; la memoria
  devuelta no marca candidatas no iniciadas.
- `estadista.test.ts`: cada dato de la tabla coincide con un conteo
  independiente sobre los fixtures v1, v2 y v3 (incluida la deduplicación
  pre-v3); cada dato lista su evidencia (eventos o intervalo + `inicial`); con
  menos de `minAcciones` no hay proporción; un valor sin cambio no produce
  candidatura.
- Comentarista: una oración sin hecho, con nombre inventado, predicción o
  juicio no pagado se rechaza y cae al respaldo; cada respaldo de
  `MESA_ARENA.respaldosComentarista` pasa `verificarUpdate` con hechos reales;
  ninguna intervención aparece en `RegistroArena` ni en `hechosArena`; el tope
  por sesión y el plazo se respetan con un LLM simulado lento.
- Servidor: candidaturas generadas una vez; instantánea, reproducción y
  recuperación exponen las mismas `intervenciones`; leer y reconectar no llaman
  al LLM (contador en el stub).
- Voz: el SSML contiene dos `<voice>` en una intervención con cesión y uno sin
  ella; la voz se elige por rol; con una voz ausente del catálogo (simulado) la
  degradación sigue la precedencia y `herramientas` la declara.
- UI: `renderToStaticMarkup` con las tres tarjetas, rótulos ES/EN y ninguna
  intervención posterior al cursor.
- E2e de arena con emisión sintética controlada (rutas simuladas como en
  `e2e/arena-buffer.spec.ts`): un partido de 60 s con calmas suficientes, datos
  que cambian y un remate durante un turno del comentarista; Speech simulado con
  duraciones y demoras inyectadas. Se comprueba que suenan los tres roles, que
  las fuentes no se solapan, que el remate corta al comentarista, que
  `data-narration-role` cambia, que el silencio máximo respeta el límite vigente
  con las exclusiones del brief 041, y móvil 360 px. Prueba aparte con calma
  insuficiente y audio tardío: omisión sin cesión suelta.
- Mutaciones: quitar `fuenteActiva === null` rompe turnos; hacer que el
  estadista no liste evidencia rompe la suya; dejar pasar una oración sin hecho
  rompe la del comentarista; emitir un dato sin cambio rompe la de candidaturas.
- `npm test`, `npm run typecheck` y los e2e de arena en verde; publicación y
  smoke público con voz real (tres voces oídas) antes de marcar ✅.

## Límites honestos

- V1–V8 comprueban citas, nombres, cifras y patrones; **no certifican la
  pertinencia de un análisis**. El comentarista se rotula como análisis con
  hechos citados, no como opinión libre, porque el verificador no admite juicio
  sin respaldo.
- Las ventanas de calma de 4 s son más cortas que las pausas reales de una
  retransmisión; los invitados serán breves y a veces cortados. Es el precio de
  no alterar el motor.
- El estadista habla solo de lo que el registro contiene; «proporción de
  acciones» no es posesión en tiempo.
- Más caracteres sintetizados: medir en el smoke el aumento de llamadas a Speech
  frente a la revisión 0000009 y anotarlo; el presupuesto de la sesión se
  conserva.
- Los nombres de los roles son ficticios y no representan a nadie.
