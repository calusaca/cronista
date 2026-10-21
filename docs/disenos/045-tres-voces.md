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

**Versión 3.1 (21 de octubre), correcciones tras la auditoría de la
implementación.** Dos revisiones independientes de la iteración 1
([Codex](../evidencia/tres-voces/codex-implementacion-1.md), NO CERRADO;
[auditor adversario](../evidencia/tres-voces/auditoria-implementacion-1.md), sin
bloqueantes) dejaron catorce hallazgos; Fable los verificó contra el código y
reprodujo los scripts del auditor. La lista cerrada de correcciones está en la
[sección final](#versión-31-21-de-octubre-correcciones-tras-la-auditoría-de-implementación);
las reglas que cambian se marcan con **[v3.1]** en su sección.

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
   entre equipos), no describe la jugada en curso. **[v3.1]** Cada oración
   cabe en `MESA_ARENA.maxCaracteresOracion` (ES y EN): el esquema JSON del
   comentarista lleva `maxLength` y, tras `verificarUpdate`, una oración más
   larga se rechaza como V1 con feedback; agotado el reintento, respaldo.
   Nunca se recorta prosa del LLM. Si el LLM falla o es
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
   | `reloj` | tick | `tick · ARENA.pasoS` | instante | segundos enteros. **[v3.1]** No ocupa plaza de candidatura (cambia en cada vencimiento y desplazaba a los demás temas); queda como hecho de apoyo citable por el comentarista |
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
   `MESA_ARENA.maxDatosEstadista` datos, ordenados por la tabla. **[v3.1]**
   Solo los datos con `ocupaPlaza` entran en la comparación de cambio y en las
   plazas; el `reloj` no (`ocupaPlaza: false`). Si ningún dato con plaza
   cambió, no hay candidatura. Cada texto de dato (ES y EN) cabe en
   `MESA_ARENA.maxCaracteresOracion`; si una plantilla lo supera, se acorta
   la plantilla, nunca el dato.

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
    `narrarArena`). **[v3.1] Presupuesto compartido concreto:**
    `MESA_ARENA.presupuestoLlamadasModelo` llamadas a `completar` por sesión,
    narrador y comentarista juntos, reintentos y plazos agotados incluidos,
    impuesto por `conPresupuesto(llm, max)` en `src/lib/llm.ts` (la única
    costura): la sesión envuelve una vez el modelo del narrador y entrega la
    misma instancia a `narrarArena` y a `MesaSesion`; agotado el presupuesto,
    `completar` lanza sin llamar al modelo y ambos caen a plantilla por su
    camino de error vigente, con el motivo en `audit`. Los topes propios (tres
    comentarios del narrador, `maxComentaristaPorSesion`) siguen vigentes.
  - **[v3.1] Cierre de la mesa.** `MesaSesion.cerrar()` descarta cualquier
    generación que termine después; la sesión lo llama en su `finally` antes de
    publicar `terminada`, en todos los caminos (completa, error, cancelada).
    Ningún mensaje sigue a `terminada` en el diario; una candidatura en vuelo
    durante un error se pierde (límite aceptado).
- **Cada consumidor decide la reproducción** con su memoria local de escucha
  (`RecuerdoVoz` gana `rol?: "narrador" | "comentarista" | "estadista"`; el
  esquema de `memoria` de la ruta de relato lo admite). Preparar o descartar
  una candidatura no la marca como escuchada; solo iniciar su audio. «No
  repetir mientras no cambie» es propiedad de las candidaturas (servidor), no
  de la memoria local. **[v3.1]** El recuerdo de un invitado lleva `texto =
  id` de la intervención, nunca el texto hablado (el esquema de `memoria`
  limita `texto` y una oración larga dejaba sin voz al narrador); la petición
  por `intervencion` no envía `memoria` y la ruta la ignora si llega. La
  memoria del invitado es trazabilidad local: la separación y la alternancia
  usan el estado del consumidor, no la memoria.

### Un clip por intervención: cesión y voz invitada en el mismo audio

La cesión del narrador y la intervención del invitado se sintetizan en **un solo
documento SSML con dos elementos `<voice>`** hermanos (narrador → invitado): un
clip, una prioridad, un tick y una entrada de memoria. No hay cesiones sueltas
ni retomas sintetizadas: el siguiente clip del narrador es la retoma.

- **[v3] Transporte.** El consumidor pide la intervención por la ruta de relato
  existente con `modo: "buffer"` y un campo nuevo del esquema estricto,
  `intervencion: <id del diario>` (con `desdeTick = hastaTick = tick` de la
  intervención y **[v3.1]** sin `memoria`). El servidor la lee del diario con `intervencionPublicada`
  (nunca la regenera), construye el segmento con `tipoRelato: "invitado"`,
  `rol`, `prioridad = MESA_ARENA.prioridadInvitado`, `cierre: false`, y
  sintetiza con la caché `extra` como hoy.
- **[v3] Fragmentos.** Exactamente **uno o dos** `FragmentoVoz`, cada uno con
  `rol` (campo nuevo de `FragmentoVoz`): el primero, opcional, es la cesión
  (`rol: "narrador"`, **[v3.1]** elegida entre `MESA_ARENA.cesiones[idioma][rol]`
  por `varianteVoz(seed, intervencion.id)`, sin memoria: un SSML por
  intervención e idioma y una sola entrada de caché de audio para todos los
  espectadores; al comentarista nunca se le cede «con el dato», con el nombre
  del invitado); el segundo agrupa **todas**
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
  se descarta sin arrancar (no se recorta audio). **[v3.1]** Como toda oración
  y todo dato caben en `maxCaracteresOracion` y `maxCaracteresOracion +
  max(caracteres(cesiones)) ≤ maxCaracteresIntervencion` (comprobado en prueba
  a partir de las constantes), el recorte a una oración o un dato siempre cabe.

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
  aperturaPendiente: boolean;       // [v3.1] la entrada del narrador aún no sonó (pedida, en vuelo o decodificada sin consumir)
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
- **[v3.1] Apertura.** Con `aperturaPendiente` no arranca ningún invitado: la
  entrada del narrador (prioridad 10, como el editorial) precede siempre a los
  invitados aunque su audio llegue más tarde. El consumidor la marca pendiente
  desde la activación hasta que la entrada arranca, o hasta que su petición
  falla o caduca (entonces los invitados siguen). La preferencia del invitado
  sobre el editorial (prioridad < `prioridadInvitado`) no alcanza a `entrada`
  ni a `cierre`.
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
  // [v3.1] Por oración del comentarista (maxLength del esquema + rechazo V1) y por dato del
  // estadista (prueba sobre fixtures y semillas). 200 + la cesión más larga cabe en 280.
  maxCaracteresOracion: 200,
  // [v3.1] Llamadas a completar por sesión, narrador + comentarista, reintentos incluidos.
  // Cubre 3 comentarios + 6 candidaturas a la primera; los reintentos consumen de aquí.
  presupuestoLlamadasModelo: 12,
  // [v3.1] Caché del catálogo real de Speech: una hora si respondió; un minuto tras un fallo
  // (antes cada consulta reintentaba con hasta 5 s de espera).
  catalogoVocesCacheS: 3600, catalogoVocesReintentoS: 60,
  nombres: {
    es: { narrador: "Rodrigo Valle", comentarista: "Ana Cedeño", estadista: "Tomás Ibarra" },
    en: { narrador: "Mark Ellison", comentarista: "Priya Chandra", estadista: "Owen Platt" },
  },
  cesiones: {                     // [v3.1] por idioma y rol; el comentarista no recibe «con el dato»
    es: {
      comentarista: ["{nombre}, ¿qué ves?", "Te escucho, {nombre}.", "Adelante, {nombre}."],
      estadista: ["{nombre}, con el dato.", "Vamos con {nombre} y los números.", "Adelante, {nombre}."],
    },
    en: {
      comentarista: ["{nombre}, what do you see?", "Over to you, {nombre}.", "Go ahead, {nombre}."],
      estadista: ["{nombre}, with the numbers.", "Let's hear the numbers, {nombre}.", "Go ahead, {nombre}."],
    },
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
como hoy. **[v3.1]** En la tarjeta del comentarista, cada oración lista sus
hechos citados (principal y apoyos) con su texto y, para los datos del
estadista, su procedencia (`intervalo` y `fuente`) tomada de `evidencia.citas`.
El transcript de voz expone `data-narration-role` (también en `ArenaNarracion`).
ES/EN completos; móvil 360 px sin desborde; movimiento reducido respetado.
**[v3.1] Repetición guardada:** «Escuchar desde el inicio» (`ArenaNarracion`,
modo `completo`) inserta las intervenciones del diario, en orden de tick, tras
el primer tramo del narrador cuyo `hastaTick ≥ tick`, pedidas por
`intervencion` con `modo: "buffer"` y validadas con `segmentoVozValido`; cada
una es un tramo `{ desdeTick: tick, hastaTick: tick }` de la pista (el cursor
se detiene en ese instante mientras habla el invitado; `instanteNarrado` lo
admite) y aparece en el transcript con su rol. Una intervención cuyo audio
falle o no valide se omite sin romper la pista. El modo `vivo` y la vista
`directo` muestran las intervenciones solo como texto en la Mesa. No se
generan nuevas.

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
  | 0 | Apertura del narrador (≈1,5 s), **[v3.1]** con respuesta más lenta que la del primer invitado | arranca el narrador antes que nadie (`aperturaPendiente`) |
  | ≈2 | **[v3.1]** Estadista #1 (tick 10, 4 s, dato con plaza), sin noticia previa ≥ 35 | arranca tras la apertura (calma `null`), `data-narration-role="estadista"` |
  | 15 | Reinicio del narrador (`PRIORIDAD_EVENTO_ARENA.reinicio`, ≈1,5 s) | corta cualquier reserva; fija `finUltimaNoticiaS` |
  | 20 | Comentarista #1 (tick 200, 6 s, modo `llm`) | arranca tras calma y separación; una sola fuente |
  | 23 | Tiro (`PRIORIDAD_EVENTO_ARENA.tiro`, ≈1,5 s) | **corta al comentarista** (`interrumpida`); el comentarista no cortó nada |
  | 30 | Estadista #2 (tick 300, 3 s) con dato cambiado | arranca; orden alternado respetado |
  | 40 | Comentarista #2 (tick 400, modo `plantilla`) | arranca; rótulo de modo visible |
  | 60 | Final: cierre del narrador; estadista final solo texto | ningún invitado tras `cerrando` |

  Las duraciones de los clips son valores del fixture (≈1,5 s), no cifras
  normativas; las prioridades del narrador salen de `PRIORIDAD_EVENTO_ARENA`
  **[v3.1]**. Se comprueba además que las fuentes no se solapan (intervalos
  audibles medidos, reservas y transiciones incluidas), que el silencio máximo
  respeta el límite vigente con las exclusiones del brief 041, **[v3.1]** que
  el cursor visible al arrancar cada invitado está entre `tick · pasoS` y
  `tick · pasoS + caducidadInvitadoS`, y móvil 360 px. Prueba aparte con
  **[v3.1]** noticias continuas (una por tramo del narrador, cada una corta a
  la anterior, sin hueco ≥ `calmaMinS` entre fuentes, comprobado) y audio del
  invitado con 3 s de demora, observada hasta `tick · pasoS +
  caducidadInvitadoS` de la última intervención: ningún invitado arranca, no
  hay cesión suelta y la Mesa muestra igualmente las tarjetas de texto.
- Mutaciones: quitar `fuenteActiva === null` rompe turnos; hacer que el
  estadista no liste evidencia rompe la suya; dejar pasar una oración sin
  hecho rompe la del comentarista; emitir un dato sin cambio rompe la de
  candidaturas; **[v3]** contar `tiro_fuera` como remate rompe la del desvío
  pre-v3; asociar la atajada por `lado` rompe la de «a puerta».
- **[v3.1]** Las pruebas y mutaciones de la versión 3.1 (sección final) se
  exigen además de las anteriores.
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
- **[v3.1]** El presupuesto compartido cuenta llamadas, no tokens ni coste;
  acota el gasto por sesión (`presupuestoLlamadasModelo`), no lo optimiza. Si
  el narrador consume reintentos, las últimas candidaturas del comentarista
  salen por plantilla verificada.
- **[v3.1]** Los invitados suenan en la emisión en búfer y en «Escuchar desde
  el inicio» de la repetición guardada (con el cursor detenido mientras
  hablan); en la vista `directo` y en el modo `vivo` solo aparecen como texto
  en la Mesa.
- **[v3.1]** La memoria local del invitado (`texto = id`) no influye en ninguna
  petición: es trazabilidad. Una candidatura del comentarista en vuelo cuando
  la sesión termina por error se descarta; en el camino normal se espera.
- Los nombres de los roles son ficticios y no representan a nadie.

## Versión 3.1 (21 de octubre): correcciones tras la auditoría de implementación

Fuentes: [revisión de Codex](../evidencia/tres-voces/codex-implementacion-1.md)
(seis hallazgos, NO CERRADO) y [auditoría adversaria](../evidencia/tres-voces/auditoria-implementacion-1.md)
(ocho hallazgos, ninguno bloqueante). Fable verificó cada uno contra el código y
corrió los scripts de reproducción del auditor: `largo` (oración de 549
caracteres aceptada en modo `llm`, texto 549 > 280), `memoria` (`texto` de 549
→ 400 en la ruta de relato), `temas` (120 candidaturas en 20 semillas: `reloj`
en 120, `cambios`/`reinicios`/`pases` en 0), `tras-terminada` (la candidatura
tardía no se publicó solo porque el bloqueo se liberó; `publicar` no tiene
guarda por `terminada`, y `emision()` deriva el estado del último mensaje) y
`respaldos` (12.045 casos, 0 fallos). Resultado: todo hallazgo real está
cubierto por una corrección numerada; lo que no procede se explica.

| Hallazgo | Clasificación | Corrección |
| --- | --- | --- |
| Codex 1 / Auditor 8: el replay guardado no reproduce invitados | real, decisión de diseño | C9 |
| Codex 2 / Auditor 5: sin presupuesto LLM compartido | real, decisión de diseño | C5 |
| Codex 3 / Auditor 7d: apoyos del estadista sin procedencia | real, dentro del brief | C7 |
| Codex 4: e2e aproxima la línea de tiempo | parcial: cursor en arranques y continuidad de noticias son reales; las duraciones 1,4/1,6 s son del fixture | C11 |
| Codex 5: `35` y `60` a mano en el e2e | real, menor | C10 |
| Codex 6: recorte no reverificado, reinicios por suma, memoria manual | reales las dos primeras; la tercera no procede tras C2 (la memoria del invitado ya no influye en ninguna petición) | C12 |
| Auditor 1: oración larga rompe la memoria y silencia al narrador | real, mayor | C1 y C2 |
| Auditor 2: «a puerta» sin prueba del mismo jugador | real, menor | C12 |
| Auditor 3: `reloj` ocupa siempre una plaza | real, decisión de diseño | C3 |
| Auditor 4: camino de error sin esperar al comentarista | real, y peor: una publicación tardía puede seguir a `terminada` si el bloqueo sigue vigente | C4 |
| Auditor 6: fallo del catálogo sin caché | real, menor | C6 |
| Auditor 7a: cesiones sin filtrar por rol | real, menor | C8 |
| Auditor 7b: cesión dependiente de la memoria de cada espectador | real (multiplica entradas de caché) | C2 |
| Auditor 7c: un invitado listo adelanta a la apertura | real, menor | C8 |

Regla general de esta versión: las cifras nuevas viven en `MESA_ARENA`
(`maxCaracteresOracion`, `presupuestoLlamadasModelo`, `catalogoVocesCacheS`,
`catalogoVocesReintentoS`) y ninguna prueba las repite a mano. No se amplía el
alcance: `RegistroArena`, `hechosArena`, el motor y V1–V8 no cambian.

### Lista cerrada de correcciones

1. **C1 · Longitud de oración del comentarista: límite en el esquema y rechazo,
   nunca recorte de prosa.** El esquema JSON que recibe el LLM lleva
   `maxLength: MESA_ARENA.maxCaracteresOracion` en `texto_es` y `texto_en`;
   `comentarArena`, tras `verificarUpdate`, rechaza toda oración cuyo
   `texto_es` o `texto_en` supere ese máximo con motivo `V1` (detalle con los
   caracteres y el máximo), da feedback al reintento y, agotado, cae al
   respaldo. Los datos del estadista y los respaldos caben por construcción.
   *Aceptación:* el escenario `largo` del auditor (LLM simulado que repite el
   hecho ocho veces) termina en modo `plantilla`, con dos intentos en `audit` y
   motivo `V1` que cita la longitud; para todo dato de `datosEstadista` sobre
   los fixtures v1–v3 y sobre 20 semillas × 120 s evaluado cada
   `estadistaCadaS`, `texto_es.length` y `texto_en.length ≤ maxCaracteresOracion`;
   `maxCaracteresOracion + max(caracteres(cesiones))` ≤ `maxCaracteresIntervencion`
   calculado desde las constantes. *Mutación:* quitar la comprobación de
   longitud → el escenario `largo` devuelve modo `llm` → rojo
   (`mesa.test.ts`); alargar una plantilla del estadista por encima del
   máximo → rojo (`estadista.test.ts`).
2. **C2 · Memoria y cesión sin texto hablado.** El recuerdo que el consumidor
   añade al arrancar un invitado es el `recuerdo` devuelto por
   `siguienteTurno` tal cual (`texto = id`); la petición por `intervencion`
   no lleva `memoria` y la ruta la ignora si llega; `relatoIntervencion(
   intervencion, seed, idioma)` pierde el parámetro de memoria y elige la
   cesión por `varianteVoz(seed, intervencion.id)` dentro de
   `cesiones[idioma][rol]`. *Aceptación:* en el e2e de la mesa, ningún cuerpo
   de `/relato` con `intervencion` lleva `memoria`, y todo `memoria[].texto`
   de las peticiones del narrador es un texto del narrador o un id de
   intervención (`^(comentarista|estadista):`); `relatoIntervencion` y
   `prepararVoz` producen el mismo `ssml` (misma `claveAudio`) en dos llamadas
   para la misma intervención e idioma. *Mutación:* volver a sobreescribir
   `texto` con el texto del segmento → la aserción sobre los cuerpos del e2e
   queda en rojo; hacer depender la cesión de una memoria → la prueba de
   determinismo de `mesa-voz.test.ts` queda en rojo.
3. **C3 · El `reloj` no ocupa plaza.** `DatoEstadista.ocupaPlaza: boolean`
   (`false` solo para `reloj`); `DisparadorEstadista.evaluar` compara y
   reparte plazas solo entre datos con plaza; `intervencionEstadista` lanza
   si recibe un dato sin plaza. El `reloj` sigue en `datosEstadista` como
   hecho de apoyo. Las pruebas y e2e que construían intervenciones con
   `slice(1, 2)` (el reloj) eligen un dato con plaza. *Aceptación:* el
   script `temas` del auditor convertido en prueba (20 semillas × 120 s, cada
   fotograma): ninguna candidatura contiene `reloj`; `remates` aparece en al
   menos una y la primera candidatura de cada partido lleva
   `maxDatosEstadista` datos. *Mutación:* `ocupaPlaza: true` para el reloj →
   rojo; `intervencionEstadista` sin la comprobación → la prueba que espera
   el lanzamiento queda en rojo.
4. **C4 · Cierre de la mesa antes de `terminada`.** `MesaSesion.cerrar()`
   marca la mesa cerrada; toda generación que resuelva después no publica.
   `GestorSesiones` llama `mesa.cerrar()` en el `finally` de la tarea, antes de
   publicar `terminada`, en todos los caminos. *Aceptación:* en
   `mesa.test.ts`, con un LLM simulado retenido, `programarComentarista` →
   `cerrar()` → liberar → `publicar` no se llama; en el escenario
   `tras-terminada` del auditor (fallo de disco al escribir el registro
   final, narrador lento) el último mensaje del diario es `terminada`, el
   estado es `error` y la sesión recuperada también. *Mutación:* `cerrar()`
   sin efecto → la prueba unitaria ve una publicación tras el cierre → rojo.
5. **C5 · Presupuesto compartido de llamadas.** `conPresupuesto(llm, max)` en
   `src/lib/llm.ts`: cuenta cada invocación de `completar` (también las que
   agotan plazo o fallan), lanza `Error("Presupuesto de llamadas agotado")`
   sin llamar al modelo al alcanzar `max`, y delega `id` y `uso`.
   `GestorSesiones.crear` envuelve el narrador una vez por sesión con
   `MESA_ARENA.presupuestoLlamadasModelo` y entrega la misma instancia a
   `narrarArena` y `MesaSesion`; los `catch` de ambos registran en `audit` el
   mensaje del error. *Aceptación:* prueba de la envoltura (N llamadas pasan,
   la N+1 lanza sin tocar el stub, `uso()` delega); `narrarArena` y
   `comentarArena` con la envoltura agotada devuelven plantilla con 0
   llamadas al stub y `audit[0].motivos[0].detalle` menciona el presupuesto;
   en `GestorSesiones` con ritmo 0, 90 s y un stub siempre rechazado por V4,
   las llamadas al stub son exactamente `presupuestoLlamadasModelo` (la prueba
   comprueba que las oportunidades, tres comentarios × 2 más candidaturas × 2,
   lo superan) y al menos una intervención lleva el motivo del presupuesto.
   *Mutación:* no envolver en el gestor → llamadas > presupuesto → rojo.
6. **C6 · Caché del fallo del catálogo.** `catalogoVoces` guarda el resultado
   `catalogoVocesCacheS` segundos si respondió y `null` durante
   `catalogoVocesReintentoS` tras cualquier fallo (HTTP, plazo, JSON inválido,
   lista vacía); `olvidarCatalogoVoces()` sigue siendo solo para pruebas.
   *Aceptación:* con `fetch` simulado en fallo, dos consultas seguidas hacen
   una sola llamada; con temporizadores simulados, pasado el reintento vuelve
   a consultar. *Mutación:* no cachear el fallo → dos llamadas → rojo.
7. **C7 · Procedencia de los apoyos.** `EvidenciaMesa` gana `citas?:
   { hecho: string; eventos: string[]; intervalo?: [number, number];
   fuente?: string }[]`: una entrada por hecho citado por la oración
   (principal y apoyos) que sea un dato del estadista, copiada de
   `DatoEstadista.evidencia`; `eventos` sigue siendo la unión. `comentarArena`
   conserva los `DatoEstadista` junto a sus hechos para construirla. La tarjeta
   del comentarista lista, por oración, los hechos citados con su texto y, en
   las citas, intervalo y fuente. *Aceptación:* un LLM simulado devuelve la
   oración fiel del principal con `apoyo: ["estadista:cambios:<tick>"]`
   (`reloj` si el fixture no trae entrenadores): `evidencia[0].citas` contiene
   `{ hecho, fuente: "fotograma:<tick>", intervalo: [0, tick] }` y
   `renderToStaticMarkup` de la Mesa con esa intervención contiene
   `fotograma:` y el texto del apoyo. *Mutación:* omitir `citas` → rojo en
   `mesa.test.ts` y en `arena-mesa.test.ts`.
8. **C8 · Cesiones por rol y apertura con precedencia.** (a) `cesiones` por
   idioma y rol, tres por rol, según el bloque `MESA_ARENA` de arriba.
   (b) `EntradaTurno.aperturaPendiente`; `siguienteTurno` devuelve `null`
   mientras sea `true`; el consumidor la calcula como `entradaPendiente`, o
   petición `entrada:` en vuelo, o clip `entrada` sin consumir.
   *Aceptación:* para todo idioma, rol y variante, la cesión está en
   `cesiones[idioma][rol]` y contiene el nombre del rol; `siguienteTurno(
   base({ aperturaPendiente: true }))` es `null` con todo lo demás favorable;
   en el e2e de la mesa, con la respuesta de la apertura más lenta que la del
   primer invitado (tick 10), `fuentes[0]` sigue siendo la entrada.
   *Mutación:* elegir la cesión del otro rol → rojo; ignorar
   `aperturaPendiente` → rojo en `turnos.test.ts` y el e2e arranca al
   invitado primero → rojo.
9. **C9 · Repetición guardada en `completo`.** `ArenaNarracion` recibe
   `intervenciones` desde `Arena.tsx` (el mismo estado que alimenta la Mesa) y
   aplica la regla de la sección «Interfaz»: inserción tras el primer tramo
   con `hastaTick ≥ tick`, petición por `intervencion` con `modo: "buffer"`,
   validación con `segmentoVozValido`, tramo de ancho cero en ticks,
   transcript con `data-narration-role`, omisión silenciosa ante fallo, y el
   progreso cuenta tramos más intervenciones. *Aceptación:* tercera prueba en
   `e2e/arena-mesa.spec.ts`: sesión terminada con dos intervenciones en el
   diario simulado y rutas simuladas (tramos del narrador de 1 s, invitados
   de 0,5 s por id); tras «Escuchar desde el inicio», cada id se pide
   exactamente una vez con `desdeTick = hastaTick = tick` y `modo: "buffer"`,
   `progreso.total` = tramos + 2, la duración del `<audio>` es la suma (±0,1 s)
   y el transcript muestra `data-narration-role` del invitado en su instante;
   con la ruta devolviendo 503 para uno de los ids, la pista se reproduce con
   total − 1. `pista-audio.test.ts` fija que `instanteNarrado` sobre un tramo
   `{ desdeTick: t, hastaTick: t }` devuelve `tick = t` en todo su intervalo.
   *Mutación:* no insertar las intervenciones → ids no pedidos y duración
   corta → rojo.
10. **C10 · Sin cifras normativas a mano en el e2e.** Las prioridades del
    reinicio y del tiro del fixture salen de `PRIORIDAD_EVENTO_ARENA`; la
    prioridad editorial 10 del fixture y las duraciones son del fixture.
    *Aceptación:* en `e2e/arena-mesa.spec.ts` no aparecen `35` ni `60` como
    prioridades. *Mutación (la de Codex):* cambiar
    `PRIORIDAD_EVENTO_ARENA.reinicio` → el fixture lo sigue.
11. **C11 · E2e: cursor en los arranques y continuidad probada.** (a) El
    script de instrumentación registra el reloj visible (`arena-clock`) en
    cada `fuente.start`; para cada invitado, el cursor en segundos está en
    `[tick · pasoS, tick · pasoS + caducidadInvitadoS]` (tolerancia 1 s por la
    resolución del reloj). (b) La prueba de noticias continuas observa hasta
    `tick · pasoS + caducidadInvitadoS` de la última intervención y comprueba
    que entre fuentes consecutivas del narrador no hay hueco ≥ `calmaMinS`,
    además de lo ya exigido. *Mutación:* relajar la caducidad en
    `siguienteTurno` → un invitado arranca fuera del intervalo → rojo (a);
    dejar un hueco ≥ `calmaMinS` en el fixture → la propia prueba lo detecta
    y no puede dar verde por casualidad (b).
12. **C12 · Pruebas que no demostraban lo anunciado.** (a) Recorte: para una
    intervención en modo `llm` de dos oraciones (stub que añade una segunda
    oración fiel sobre otro hecho), `verificarUpdate({ oraciones:
    [oraciones[0]] })` pasa con los mismos hechos, y `relatoIntervencion` de
    una intervención que supera el máximo deja exactamente
    `oraciones[0].texto`; *mutación:* recortar a la última oración → rojo.
    (b) Reinicios: el `valor` (`[tipo, n][]`) coincide con un conteo
    independiente por tipo sobre v1–v3, y al menos un fixture tiene dos
    tipos; *mutación:* intercambiar dos categorías conservando el total →
    rojo. (c) «A puerta» con jugador distinto: eventos sintéticos `tiro`
    de `local-9` seguido de `gol` del mismo lado por `local-10` → no cuenta;
    por `local-9` → cuenta; *mutación (M7 del auditor):* quitar la
    comparación de `jugador` → rojo. (d) La prueba de memoria manual de Codex
    no se amplía: tras C2 la memoria del invitado no influye en ninguna
    petición; se conserva la prueba pura de que decidir no toca la memoria.

Cierre de la 3.1: `npm test`, `npm run typecheck` y los e2e de arena en verde
con las doce correcciones; auditoría adversaria de la iteración 2 y revisión de
Codex antes de publicar; smoke público con las tres voces oídas y la medición
de llamadas a Speech, como exige la sección de pruebas.
