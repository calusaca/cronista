# Tres voces: narrador, comentarista y estadista

## Alcance de esta revisión

Propuesta pedida por Carlos el 20 de octubre tras el brief 044: una transmisión
con tres roles que se ceden la palabra, como en las retransmisiones reales. Es un
brief de diseño; Carlos autorizó la implementación el 20 de octubre («dale»),
condicionada a cerrar el texto. Aplica solo a la emisión de la arena (`/arena`,
vistas en directo y búfer) en ES/EN. No cambia la crónica principal, el Analista
histórico, el simulador ni `RegistroArena`.

**Versión 3 (21 de octubre), cerrada.** La versión 2 incorporó los quince
hallazgos de la primera revisión de Codex (GPT-6.1 Sol, solo lectura); la
segunda revisión ([evidencia](../evidencia/tres-voces/codex-revision-v2.md))
dejó seis parciales y cinco bloqueos nuevos, y la verificación propia de Fable
añadió uno (atraso del plan de voz). Todos están resueltos en esta versión; las
decisiones se marcan con **[v3]**.

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
   `MESA_ARENA.respaldosComentarista` por idioma con `elegirVarianteVoz`,
   construida solo con los datos del hecho principal y verificada por la misma
   `verificarUpdate` (la prueba lo exige). Se publica con `rol: "comentarista"`
   y modo `llm` | `plantilla`.
3. **Estadista.** **Código determinista con pruebas, sin LLM** (regla del
   proyecto). Módulo `src/arena/estadista.ts`: `datosEstadista(registro, tick)`
   devuelve datos con textos ES/EN por plantilla y evidencia explícita. Tabla
   normativa:

   | Tema | Entrada | Fórmula | Periodo | Redondeo / sin muestra |
   | --- | --- | --- | --- | --- |
   | `marcador` | `inicial.marcador` + eventos `gol` ≤ tick | suma por lado | acumulado | entero; siempre disponible |
   | `reloj` | tick | `tick · ARENA.pasoS` | instante | segundos enteros |
   | `remates` | **[v3]** solo eventos `tiro` por lado; `tiro_fuera`, `atajada` y `gol` son desenlaces, nunca remates | conteo; «a puerta» = remates cuyo primer desenlace posterior (sin otro `tiro` de ningún lado en medio) es un `gol` del mismo `lado` y `jugador`, o una `atajada` cuyo `receptor` es el `jugador` del remate (la atajada lleva el `lado` del portero; el motor guarda al rematador en `receptor`, `src/arena/motor.ts`) | acumulado | entero; con 0 remates se dice «sin remates» citando el intervalo |
   | `atajadas` | eventos `atajada` por `jugador` (portero) | conteo | acumulado | entero |
   | `acciones` | eventos `pase`, `recepcion`, `recuperacion`, `intercepcion` por lado (`TipoEventoArena`; el motor no registra conducciones como eventos) | proporción de acciones del lado sobre el total, rotulada «proporción de acciones», no «posesión» | últimos `MESA_ARENA.ventanaAccionesS` s | porcentaje entero; con < `MESA_ARENA.minAcciones` acciones no se emite |
   | `faltas` | eventos `falta`, `amarilla`, `roja` por lado | conteos | acumulado | entero |
   | `cambios` | **[v3]** contadores `cambios` y `ventanas` de `EstadoEntrenador` por lado en el último fotograma ≤ tick (`estado.entrenadores[lado]`, fuente autoritativa del brief 044), con `TECNICA_ARENA.maxCambios/maxVentanas`; los eventos `cambio` ≤ tick son la evidencia | usados y restantes, jugadores y ventanas | acumulado | entero; 0 usados cita el intervalo; sin `entrenadores` en el fotograma no se emite |
   | `reinicios` | eventos `reinicio` por tipo | conteo | acumulado | entero |
   | `pases` | eventos `pase` con `distanciaM` | media | últimos `ventanaAccionesS` s | metro entero; < `minAcciones` no se emite |

   Evidencia: cada dato lista `eventos` (los que entran en la fórmula) y, cuando
   el valor no procede de eventos (marcador inicial, reloj, conteo cero,
   contadores del entrenador), el intervalo `[desdeTick, hastaTick]`
   inspeccionado y la fuente (`inicial` o `fotograma:<tick>`). **No hay tabla
   de liga**: la emisión no dispone de una clasificación con procedencia y no se
   calcula ninguna. **[v3] Registros anteriores a `reinicios-v3`:** el doble
   desenlace de un desvío (`atajada` con `motivo: "desvio"` seguida de
   `tiro_fuera` del mismo vuelo) no altera el conteo porque solo cuentan los
   eventos `tiro`; para «a puerta» ese remate cuenta una vez, por la atajada.
   Es una normalización de este brief; el 044 documentó el duplicado y lo
   corrigió solo para v3, sin tocar v1/v2. Un dato solo se emite si cambió
   respecto a la última candidatura del mismo tema en la sesión (comparación
   por valor, en el servidor). Cada candidatura lleva como máximo
   `MESA_ARENA.maxDatosEstadista` datos, ordenados por la tabla.

Nombres ficticios por idioma en `MESA_ARENA.nombres`; no coinciden con
locutores reales ni con los que aparecen en los transcripts.

### Candidaturas en el servidor, reproducción en el consumidor

- **El servidor genera cada candidatura una sola vez** y la publica en el diario
  de la sesión como `PublicacionSesion` `{ tipo: "intervencion", intervencion }`,
  con `id` estable (`${rol}:${tema}:${tick}`), `rol`, `tick`, `tema`, `oraciones`,
  `hechos`, `evidencia`, `audit`, `modo` (`llm` | `plantilla` | `determinista`).
  Instantánea (`emision`), reproducción (`reproduccion`) y recuperación exponen
  `intervenciones` junto a `comentarios` (`ReproduccionArena` e
  `InstantaneaEmision` ganan el campo; `comentarioPublicado` gana un hermano
  `intervencionPublicada(id, intervencionId)`); `aplicarPublicacion`,
  `RegistroArena` y `hechosArena` no cambian. Leer, reconectar o reproducir
  nunca genera otra intervención.
- **[v3] Disparadores de candidatura**, estado del servidor por sesión (nada
  depende de la escucha de ningún consumidor):
  - Estadista: al avanzar el prefijo, cuando `tick − ultimaCandidaturaEstadistaTick
    ≥ MESA_ARENA.estadistaCadaS / ARENA.pasoS`, y una vez más con el tick final.
    Si ningún dato cambió, no hay candidatura y el temporizador **sí** se rearma
    (se vuelve a intentar al siguiente vencimiento).
  - Comentarista: por evento, cuando el prefijo incorpora un evento cuya
    prioridad en `PRIORIDAD_EVENTO_ARENA` (la tabla hoy local de `relato.ts`,
    exportada desde `src/sim/limites.ts`) es ≥ `MESA_ARENA.comentaristaDesdePrioridad`;
    por tiempo, cuando `tick − ultimaCandidaturaComentaristaTick ≥
    comentaristaCadaS / pasoS`. Ambos rearman el mismo temporizador al generar
    una candidatura (aceptada por el verificador o respaldo); una generación en
    curso bloquea otra; tope `maxComentaristaPorSesion` por sesión.
  - Generación LLM por `src/lib/llm.ts` con el mismo modelo del narrador, plazo
    `MESA_ARENA.plazoComentaristaMs`, un reintento con feedback (como
    `narrarArena`), presupuesto compartido con el vigente de la sesión; al
    agotarlo, respaldo por plantilla.
- **Cada consumidor decide la reproducción** con su memoria local de escucha
  (`RecuerdoVoz` gana `rol?: "narrador" | "comentarista" | "estadista"`; el
  esquema de `memoria` de la ruta de relato lo admite). Preparar o descartar
  una candidatura no la marca como escuchada; solo iniciar su audio. «No
  repetir mientras no cambie» es propiedad de las candidaturas (servidor), no
  de la memoria local.

### Un clip por intervención: cesión y voz invitada en el mismo audio

La cesión del narrador y la intervención del invitado se sintetizan en **un solo
documento SSML con dos elementos `<voice>`** hermanos (narrador → invitado): un
clip, una prioridad, un tick y una entrada de memoria. No hay cesiones sueltas
ni retomas sintetizadas: el siguiente clip del narrador es la retoma.

- **[v3] Transporte.** El consumidor pide la intervención por la ruta de relato
  existente con `modo: "buffer"` y un campo nuevo del esquema estricto,
  `intervencion: <id del diario>` (con `desdeTick = hastaTick = tick` de la
  intervención). El servidor la lee del diario con `intervencionPublicada`
  (nunca la regenera), construye el segmento con `tipoRelato: "invitado"`,
  `rol`, `prioridad = MESA_ARENA.prioridadInvitado`, `cierre: false`, y
  sintetiza con la caché `extra` como hoy.
- **[v3] Fragmentos.** Exactamente **uno o dos** `FragmentoVoz`, cada uno con
  `rol` (campo nuevo de `FragmentoVoz`): el primero, opcional, es la cesión
  (`rol: "narrador"`, elegida entre `MESA_ARENA.cesiones` por idioma con
  `elegirVarianteVoz`, con el nombre del invitado); el segundo agrupa **todas**
  las oraciones del invitado en un solo texto (`rol` del invitado). `prepararVoz`
  agrupa fragmentos contiguos del mismo rol en un `<voice>` y resuelve la voz
  por rol e idioma; `ssmlComentario` asigna `rol` a sus fragmentos;
  `sintetizarVoz` no cambia su contrato de salida y `voz` pasa a ser la del
  invitado (el hash de `claveAudio` ya cubre todo el SSML). El consumidor
  (`src/ui/ArenaEmisionBuffer.tsx`) valida para `tipoRelato === "invitado"`:
  `1 ≤ fragmentos.length ≤ 2`, todos con `tick` igual al de la intervención,
  `audio` obligatorio si hay texto; las demás validaciones se mantienen para
  los otros tipos.
- **[v3] Duración, decidida por caracteres en el servidor, sin circularidad.**
  Si `caracteres(cesión) + caracteres(invitado) ≤ MESA_ARENA.maxCaracteresIntervencion`
  se incluye la cesión; si no, se omite la cesión y no el dato. Si el invitado
  solo supera el máximo, el estadista recorta a su primer dato y el
  comentarista a su primera oración (ambas siguen verificadas por sí mismas).
  En el consumidor, un clip decodificado con `duration > VOZ_BUFFER.duracionMaxS`
  se descarta sin arrancar (no se recorta audio).

### Coordinador de turnos

**[v3]** Función pura `siguienteTurno(entrada): { id, recuerdo } | null` en
`src/arena/turnos.ts`. No lee el DOM ni Web Audio; el consumidor la llama en
cada fotograma **antes** de la rama de reservas y arranca el clip devuelto; solo
si `fuente.start` ocurre añade `recuerdo` a la memoria con `recordarVoz`.

```ts
interface EntradaTurno {
  partidoS: number;                 // cursor visible
  ahoraAudioS: number;              // reloj Web Audio
  fuenteActiva: { rol: Rol; prioridad: number; finS: number } | null; // reservas incluidas (prioridad −1)
  finUltimaNoticiaS: number | null; // fin (reloj de audio) del último clip del narrador con prioridad ≥ VOZ_BUFFER.prioridadInterrupcion; null si aún no hubo
  finUltimoInvitadoS: number | null; ultimoInvitado: { rol: Rol; tick: number } | null;
  pausaVigente: boolean;            // estado.pausa.hastaTick > tick en el fotograma del cursor
  terminada: boolean; cerrando: boolean;
  candidatas: { id: string; rol: Rol; tick: number; duracionS: number }[]; // solo con audio decodificado
}
```

Reglas, con constantes en `MESA_ARENA`:

- **Noticias del narrador: política vigente sin cambios.** `planVozBuffer`
  sigue decidiendo con `VOZ_BUFFER.prioridadInterrupcion` (35) y comparación
  estricta de prioridades. **[v3] Promesa acotada:** un clip del narrador
  **admitido** (no caducado, duración válida) con prioridad ≥ 35 corta al
  invitado, porque 35 > `prioridadInvitado`; entre fuentes del narrador se
  conserva la comparación vigente (un reinicio 35 no corta un gol 100).
- **Los invitados nunca interrumpen.** Solo arrancan con `fuenteActiva === null`
  (ninguna fuente audible, reservas incluidas: la excepción `prioridadAnterior
  < 0` de `planVozBuffer` no se alcanza porque el filtro es previo) y entran
  con `prioridad = MESA_ARENA.prioridadInvitado` (20): por debajo del umbral,
  no cortan nada; por encima de los comentarios editoriales (10), ganan el
  hueco libre frente a ellos.
- **[v3] Ventana de calma, medida en el reloj de audio desde el fin de la
  última noticia:** un invitado arranca si `finUltimaNoticiaS === null` o
  `ahoraAudioS − finUltimaNoticiaS ≥ MESA_ARENA.calmaMinS`, o si `pausaVigente`.
  `calmaMinS` (1,5 s) es menor que `VOZ_BUFFER.reservaTrasS` (2 s): una
  candidatura decodificada y admisible ocupa el hueco antes de que entre una
  reserva; si aún no está decodificada, la reserva suena y el invitado espera a
  que termine. Al reanudarse el juego no se detiene al invitado por sí mismo:
  lo detiene la primera noticia del narrador con prioridad ≥ 35 (saque,
  remate, falta, cambio), si la hay; los pases no tienen prioridad en
  `PRIORIDAD_EVENTO_ARENA` y no cortan.
- **[v3] Atraso y caducidad, separados del cierre final.** Para
  `tipoRelato === "invitado"` el consumidor **no aplica** el filtro de atraso
  (`atrasoNormalS`, hoy en la línea del descarte previo) ni el de repetición
  (`repetidaVoz`), y llama a `planVozBuffer` con el último argumento `cierre =
  true` **solo como exención del atraso** (el segmento lleva `cierre: false`,
  no activa `s.cerrando` y la ruta del servidor no entra en la rama de cierre).
  La caducidad la aplica `siguienteTurno`: una candidatura no arranca si
  `partidoS − tick · ARENA.pasoS > MESA_ARENA.caducidadInvitadoS`, ni si
  `tick · pasoS > partidoS`.
- **[v3] Separación y orden.** `ahoraAudioS − finUltimoInvitadoS ≥
  separacionInvitadosS` (o `finUltimoInvitadoS === null`). Con candidaturas
  de ambos roles se alterna: primero el rol distinto de `ultimoInvitado.rol`
  (comentarista si no hubo ninguno); dentro de un rol, la de tick más
  reciente; las demás del mismo rol se descartan como superadas.
- **[v3] Final.** Con `terminada || cerrando` no arranca ningún invitado: el
  cierre del narrador tiene precedencia y después no suena nadie (brief 041).
  La candidatura final del estadista se muestra en la Mesa como texto.
- **Silencio.** Techo y exclusiones del brief 041 intactos (pausa manual,
  pestaña oculta, audio desactivado o bloqueado); las reservas siguen siendo
  del narrador.

### `MESA_ARENA` (en `src/sim/limites.ts`, comentada)

```ts
export const MESA_ARENA = {
  prioridadInvitado: 20,          // por debajo de VOZ_BUFFER.prioridadInterrupcion (35), por encima del editorial (10)
  calmaMinS: 1.5,                 // s de audio desde el fin de la última noticia; < VOZ_BUFFER.reservaTrasS
  separacionInvitadosS: 6,        // s de audio entre el fin de un invitado y el inicio del siguiente
  caducidadInvitadoS: 12,         // s de partido; más vieja no arranca
  estadistaCadaS: 20,             // cadencia de candidaturas del estadista
  ventanaAccionesS: 30, minAcciones: 6,
  maxDatosEstadista: 2,
  comentaristaDesdePrioridad: 70, // tiro_fuera, atajada, amarilla, roja, gol, final_anticipado
  comentaristaCadaS: 25, maxComentaristaPorSesion: 6, plazoComentaristaMs: 6000,
  hechosComentarista: 8, maxOracionesComentarista: 2,
  fragmentosPorIntervencion: 2, maxCaracteresIntervencion: 280,
  nombres: {
    es: { narrador: "Rodrigo Valle", comentarista: "Ana Cedeño", estadista: "Tomás Ibarra" },
    en: { narrador: "Mark Ellison", comentarista: "Priya Chandra", estadista: "Owen Platt" },
  },
  cesiones: {
    es: ["{nombre}, ¿qué ves?", "Te escucho, {nombre}.", "{nombre}, con el dato.", "Adelante, {nombre}."],
    en: ["{nombre}, what do you see?", "Over to you, {nombre}.", "{nombre}, with the numbers.", "Go ahead, {nombre}."],
  },
  respaldosComentarista: {        // solo datos del hecho principal; cada una pasa verificarUpdate en la prueba
    es: ["{jugador} ({equipo}) protagoniza la última acción destacada, a {distancia} metros.",
         "La jugada más reciente lleva la firma de {jugador}, de {equipo}.",
         "{equipo} aparece en la última acción relevante, con {jugador}."],
    en: ["{jugador} ({equipo}) features in the latest key action, from {distancia} metres.",
         "The most recent play carries the mark of {jugador}, of {equipo}.",
         "{equipo} shows up in the latest relevant action, through {jugador}."],
  },
} as const;
```

Ninguna prueba repite estas cifras a mano. **[v3]** El brief ya no afirma que
un partido arbitrario garantice los tres roles en 60 s: la oportunidad depende
de huecos sin noticia, de que las candidaturas lleguen decodificadas y de las
reservas. La prueba e2e construye una línea de tiempo explícita (abajo) con
margen audible; en partidos reales los invitados hablan en los tramos sin
noticia del narrador (que hoy ocupa el comentario editorial) y pueden ser
cortados.

### Voz

Una voz por rol e idioma, lista permitida y `estilosAdmitidos` ampliados en
`voz.ts`. Voces fijadas tras consultar el catálogo real de Speech el 20 de
octubre (lectura, sin síntesis; 17 voces es-MX y 70 en-US):

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

- `turnos.test.ts` con `EntradaTurno` explícitas: un invitado no arranca con
  fuente activa (incluida una reserva con prioridad −1); arranca con
  `finUltimaNoticiaS === null`, con calma cumplida o con pausa vigente, y no
  antes; separación y caducidad; alternancia comentarista/estadista y descarte
  de candidaturas superadas del mismo rol; `terminada`/`cerrando` bloquean; el
  `recuerdo` devuelto lleva `rol` y solo se añade al arrancar. Una prueba de
  `buffer.test.ts` comprueba que `planVozBuffer` con prioridad
  `prioridadInvitado` nunca devuelve `interrumpirAnterior` sobre una fuente
  ≥ 0 y que una noticia ≥ `prioridadInterrupcion` sí interrumpe a 20.
- `estadista.test.ts`: cada dato de la tabla coincide con un conteo
  independiente sobre los fixtures v1, v2 y v3 (incluido un desvío pre-v3 con
  `tiro_fuera` posterior: un remate, a puerta); «a puerta» asocia la atajada
  por `receptor` (prueba con remates de ambos lados seguidos); `cambios` lee
  los contadores del entrenador; cada dato lista su evidencia (eventos o
  intervalo + fuente); con menos de `minAcciones` no hay proporción; un valor
  sin cambio no produce candidatura y el temporizador se rearma.
- Comentarista: una oración sin hecho, con nombre inventado, predicción o
  juicio no pagado se rechaza y cae al respaldo; cada respaldo de
  `MESA_ARENA.respaldosComentarista` pasa `verificarUpdate` con hechos reales
  en ES y EN; ninguna intervención aparece en `RegistroArena` ni en
  `hechosArena`; el tope por sesión, el plazo y el rearme del temporizador se
  respetan con un LLM simulado lento; el disparador por evento usa
  `PRIORIDAD_EVENTO_ARENA`.
- Servidor: candidaturas generadas una vez; instantánea, reproducción y
  recuperación exponen las mismas `intervenciones`; leer, reconectar y pedir
  el audio de una intervención por `intervencion` no llaman al LLM (contador
  en el stub); un `intervencion` desconocido devuelve 404.
- Voz: el SSML contiene dos `<voice>` en una intervención con cesión y uno sin
  ella; la cesión se omite al superar `maxCaracteresIntervencion` y el
  invitado se recorta a un dato/una oración; la voz se elige por rol; con una
  voz ausente del catálogo (simulado) la degradación sigue la precedencia y
  `herramientas` la declara.
- UI: `renderToStaticMarkup` con las tres tarjetas, rótulos ES/EN y ninguna
  intervención posterior al cursor; el consumidor acepta dos fragmentos solo
  con `tipoRelato: "invitado"`.
- **[v3] E2e de arena con emisión sintética controlada** (rutas simuladas como en
  `e2e/arena-buffer.spec.ts`, Speech simulado con duraciones fijas y demoras
  inyectadas, `intervenciones` servidas por la instantánea simulada). Línea
  de tiempo del partido de 60 s, en segundos de partido:

  | s | Qué ocurre | Qué se comprueba |
  | --- | --- | --- |
  | 0 | Apertura del narrador (1,5 s) | arranca el narrador |
  | 5 | Estadista #1 (tick 50, 4 s), sin noticia previa ≥ 35 | arranca (calma `null`), `data-narration-role="estadista"` |
  | 15 | Reinicio del narrador (prioridad 35, 1,5 s) | corta cualquier reserva; fija `finUltimaNoticiaS` |
  | 20 | Comentarista #1 (tick 200, 6 s, modo `llm`) | arranca tras calma y separación; una sola fuente |
  | 23 | Tiro (prioridad 60, 1,5 s) | **corta al comentarista** (`interrumpida`); el comentarista no cortó nada |
  | 30 | Estadista #2 (tick 300, 3 s) con dato cambiado | arranca; orden alternado respetado |
  | 40 | Comentarista #2 (tick 400, modo `plantilla`) | arranca; rótulo de modo visible |
  | 60 | Final: cierre del narrador; estadista final solo texto | ningún invitado tras `cerrando` |

  Se comprueba además que las fuentes no se solapan (intervalos audibles
  medidos, reservas y transiciones incluidas), que el silencio máximo respeta
  el límite vigente con las exclusiones del brief 041, y móvil 360 px. Prueba
  aparte con noticia cada segundo y audio del invitado con 3 s de demora:
  ningún invitado arranca, no hay cesión suelta y la Mesa muestra igualmente
  las tarjetas de texto.
- Mutaciones: quitar `fuenteActiva === null` rompe turnos; hacer que el
  estadista no liste evidencia rompe la suya; dejar pasar una oración sin
  hecho rompe la del comentarista; emitir un dato sin cambio rompe la de
  candidaturas; **[v3]** contar `tiro_fuera` como remate rompe la del desvío
  pre-v3; asociar la atajada por `lado` rompe la de «a puerta».
- `npm test`, `npm run typecheck` y los e2e de arena en verde; publicación y
  smoke público con voz real (tres voces oídas) antes de marcar ✅.

## Límites honestos

- V1–V8 comprueban citas, nombres, cifras y patrones; **no certifican la
  pertinencia de un análisis**. El comentarista se rotula como análisis con
  hechos citados, no como opinión libre, porque el verificador no admite juicio
  sin respaldo.
- Los huecos entre noticias del narrador son más cortos que las pausas reales de
  una retransmisión; los invitados serán breves y a veces cortados, y un
  partido concreto puede no dar oportunidad a los tres. Es el precio de no
  alterar el motor.
- El estadista habla solo de lo que el registro contiene; «proporción de
  acciones» no es posesión en tiempo.
- Más caracteres sintetizados: medir en el smoke el aumento de llamadas a Speech
  frente a la revisión 0000009 y anotarlo; el presupuesto de la sesión se
  conserva.
- Los nombres de los roles son ficticios y no representan a nadie.
