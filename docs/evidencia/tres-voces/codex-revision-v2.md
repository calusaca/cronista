La v2 corrige gran parte de la revisión anterior, pero **no permite cerrar el brief**: persisten incompatibilidades con la caducidad del buffer, contratos incompletos del coordinador y errores en las fórmulas estadísticas. Revisión realizada solo mediante lectura; no modifiqué archivos.

**Comparación de los 15 hallazgos**

Las secciones citadas pertenecen a `docs/disenos/045-tres-voces.md`, versión 2.

| # | Estado | Justificación |
| --- | --- | --- |
| 1 | RESUELTO | **«Roles», narrador** distingue expresamente plantillas habladas y comentarios LLM exclusivamente textuales. |
| 2 | RESUELTO | **«Diferencia con el motor de arena» y «Ventana de calma»** sustituyen la promesa de caber antes del saque por ventanas de calma, admitiendo cortes sin prolongar el partido. |
| 3 | PARCIAL | **«Ventana de calma»** define que reanudar no corta por sí mismo, pero atribuye el corte a una primera noticia cuya prioridad suficiente no está garantizada; debe delimitarse esa promesa. |
| 4 | RESUELTO | **«Coordinador de turnos»** conserva la comparación vigente y añade `fuenteActiva === null`, incluidas reservas; las garantías siguen sujetas a admisión y caducidad del clip. |
| 5 | PARCIAL | **«Un clip por intervención»** resuelve secuenciación y solapes, pero deja ambiguo cómo decidir por duración la cesión y cómo acomodar cesión más dos oraciones en dos fragmentos. |
| 6 | PARCIAL | **«Coordinador de turnos»** incorpora relojes, fuente y duración, pero no define `ultimaNoticiaS`, el tipo de `clip`, la separación desde inicio o fin ni la representación de reservas en la memoria. |
| 7 | RESUELTO | **«Candidaturas en el servidor, reproducción en el consumidor»** separa identidad y deduplicación durables de la escucha local, que solo se registra al iniciar. |
| 8 | RESUELTO | **«Roles», comentarista**, exige hechos suministrados, V1–V8 y respaldo verificado, sin predicciones ni efectos tácticos no modelados. |
| 9 | PARCIAL | **«Roles», tabla del estadista**, añade fórmulas, pero la asociación por mismo `lado` falla en atajadas y falta definir ventanas de cambios; la atribución de deduplicación al 044 es incorrecta. |
| 10 | RESUELTO | **«Roles», evidencia del estadista**, admite intervalo e inicial para valores sin eventos y excluye la clasificación de liga. |
| 11 | RESUELTO | **«Roles», narrador**, identifica los tres candidatos que migran y elimina la recapitulación obligatoria tras gol. |
| 12 | PARCIAL | **«MESA_ARENA»** fija valores numéricos, pero conserva inventarios como `[...]` y `{...}`; su afirmación de oportunidad en 60 s no se deduce de esos valores. |
| 13 | PARCIAL | **«Candidaturas…»** define transporte, identidad y presupuesto, pero «sin intervención suya» no distingue candidatura de escucha local ni fija cómo se rearma el disparador temporal. |
| 14 | RESUELTO | **«Voz»** fija matriz, estilos, variables, degradación y publicación de la asignación efectiva; requiere ampliar el código actual. |
| 15 | RESUELTO | **«Pruebas exigidas»** usa emisión sintética, Speech controlado, datos cambiantes y casos separados de omisión, manteniendo las exclusiones del silencio. |

**(a) SSML con narrador e invitado**

**Actualmente no lo producen; se puede incorporar conservando la salida de `sintetizarVoz`.**

- `FragmentoVoz` no tiene `rol`: [expresion.ts:7](/home/calusaca/cronista/src/arena/expresion.ts:7).
- `prepararVoz` escoge una voz antes de recorrer los fragmentos y envuelve todo el contenido en un único `<voice>`: [voz.ts:31](/home/calusaca/cronista/src/arena/voz.ts:31), [voz.ts:49](/home/calusaca/cronista/src/arena/voz.ts:49).
- `ssmlComentario` construye fragmentos sin rol y delega en esa función: [voz.ts:59](/home/calusaca/cronista/src/arena/voz.ts:59).
- La lista actual excluye `es-MX-GerardoNeural` y `en-US-DavisNeural`; tampoco contiene todos los estilos propuestos: [voz.ts:12](/home/calusaca/cronista/src/arena/voz.ts:12), [voz.ts:22](/home/calusaca/cronista/src/arena/voz.ts:22).

Debe añadirse rol por fragmento, resolución efectiva por rol/idioma y agrupación de fragmentos contiguos en elementos `<voice>` hermanos. La cesión sería un grupo del narrador y las oraciones otro del invitado. Hay que ampliar explícitamente voces permitidas y estilos, manteniendo validación y escape.

`sintetizarVoz` envía el SSML recibido y devuelve un único MP3; no exige una sola voz: [voz.ts:75](/home/calusaca/cronista/src/arena/voz.ts:75), [voz.ts:83](/home/calusaca/cronista/src/arena/voz.ts:83), [voz.ts:89](/home/calusaca/cronista/src/arena/voz.ts:89). Puede conservarse el contrato definiendo `voz` como voz principal del invitado; el hash ya incluye todo el SSML: [voz.ts:55](/home/calusaca/cronista/src/arena/voz.ts:55).

**(b) Prioridad 20 e interrupciones**

La garantía es **condicional**, no absoluta. Según [buffer.ts:61](/home/calusaca/cronista/src/arena/buffer.ts:61):

- Una noticia admitida con prioridad **≥35** corta una fuente activa de prioridad 20: cumple el umbral inclusivo y la comparación estricta `prioridad > prioridadAnterior`.
- Prioridades iguales no se cortan.
- Un invitado de prioridad 20 **no corta una fuente ordinaria**, aunque esta tenga prioridad 10: ser superior no basta; también debe alcanzar 35.
- **Sí puede cortar una reserva** si se llama directamente al plan: `prioridadAnterior < 0` es una excepción independiente del umbral. Las reservas usan −1: [ArenaEmisionBuffer.tsx:175](/home/calusaca/cronista/src/ui/ArenaEmisionBuffer.tsx:175). Por tanto, «nunca interrumpe» depende del filtro previo `fuenteActiva === null`.
- Una noticia ≥35 caducada, futura o con duración inválida se rechaza antes de decidir interrupción.
- Con `finAnteriorS === ahoraAudioS`, el plan considera libre la fuente; conviene mantener el contrato de fuente activa hasta su limpieza efectiva.

Además, «reinicios y remates cortan a quien esté hablando» es demasiado amplio: un reinicio 35 no corta un gol 100. Debe decir «cortan al invitado; para las demás fuentes se conserva la comparación vigente».

**(c) Deduplicación pre-v3 y brief 044**

**Coincide con el problema histórico, pero no con una deduplicación ya implementada o prescrita por el 044.**

El 044 documenta el duplicado en **«Hallazgos confirmados, A»** y exige conservar intactos v1/v2, corrigiendo v3 mediante `rechace`: [044:75](/home/calusaca/cronista/docs/disenos/044-correcciones-motor-arena.md:75), [044:83](/home/calusaca/cronista/docs/disenos/044-correcciones-motor-arena.md:83).

La implementación coincide:

- Solo un vuelo `tiro` produce `tiro_fuera` al salir: [motor.ts:415](/home/calusaca/cronista/src/arena/motor.ts:415).
- El desvío cambia a `rechace` únicamente bajo las reglas actuales v3; v1/v2 conservan el tiro: [motor.ts:520](/home/calusaca/cronista/src/arena/motor.ts:520).
- El relato sigue seleccionando eventos sin esa deduplicación: [relato.ts:93](/home/calusaca/cronista/src/arena/relato.ts:93).
- El balance editorial ya cuenta exclusivamente eventos `tiro`: [editorial.ts:104](/home/calusaca/cronista/src/arena/editorial.ts:104).

Si el nuevo estadista también cuenta solo `tiro`, el segundo `tiro_fuera` **ya queda excluido del total**. Debe describirse como normalización nueva de desenlaces históricos, sin atribuirla al 044.

Hay otro error: una atajada pertenece al lado del portero, opuesto al rematador; además registra al tirador en `receptor`: [motor.ts:476](/home/calusaca/cronista/src/arena/motor.ts:476), [motor.ts:520](/home/calusaca/cronista/src/arena/motor.ts:520). La asociación «misma `lado`» de la tabla no cuenta correctamente remates a puerta.

**(d) Oportunidad real en 60 s**

**Los valores no la garantizan.** Este es un contraejemplo válido sin pausas adicionales que habiliten invitados. Tomo calmas cerradas de cuatro segundos, terminadas por una noticia del narrador:

| Tiempo de partido | Situación | Consecuencia |
| --- | --- | --- |
| 0–16 s | Noticias del narrador; última en 16 | Habla el narrador. |
| 16–20 s | Primera calma | Antes de 20 no se cumple `calmaMinS`; en 20 llega otra noticia y reinicia la espera. |
| 20 s | Candidatura del estadista | No encuentra ventana; caduca después de 32. |
| 25 s | Candidatura temporal del comentarista | Caduca después de 37. |
| 30 s | Único remate, prioridad 60 | Habla el narrador; el tiro solo no alcanza el disparador 70. |
| 36–40 s | Segunda calma | Se repite el problema del límite; las anteriores candidaturas ya caducaron. |
| 40 s | Nueva candidatura estadística | Caduca después de 52. |
| 56–60 s | Tercera calma | Tampoco ofrece margen después de cumplir cuatro segundos. |
| 60 s | Final y candidatura estadística | La reproducción posterior al final y su arbitraje con el cierre no están definidos. |

Incluso sin noticia exactamente en el extremo, el plan programa el inicio **30 ms después**: [buffer.ts:67](/home/calusaca/cronista/src/arena/buffer.ts:67). No hay margen audible garantizado dentro de cuatro segundos.

Las pausas del motor de 1,5 s pueden habilitar otra oportunidad por la condición alternativa, pero no garantizan fuente libre: [limites.ts:515](/home/calusaca/cronista/src/sim/limites.ts:515). Las reservas también compiten: entran tras dos segundos sin audio, antes de cumplir cuatro segundos de calma, y un invitado debe esperar que terminen: [buffer.ts:4](/home/calusaca/cronista/src/arena/buffer.ts:4), [ArenaEmisionBuffer.tsx:170](/home/calusaca/cronista/src/ui/ArenaEmisionBuffer.tsx:170).

El E2E sí puede construir oportunidades, pero debe fijar intervalos más amplios o pausas explícitas, duraciones de reservas y clips, disponibilidad y orden. Para que **un único remate corte al comentarista**, este debe haber empezado por el disparador temporal anterior; ese mismo remate no puede simultáneamente originar su candidatura y cortar un turno ya iniciado.

**(f) Esperar cuatro segundos frente al descarte a los tres**

**Sí, si la candidatura lleva el tick de la noticia desde la que espera cuatro segundos:** su edad será ≥4 y el plan la descartará por superar 3 s. La caducidad propuesta de 12 s nunca llegará a aplicarse efectivamente: [buffer.ts:64](/home/calusaca/cronista/src/arena/buffer.ts:64). El consumidor también la elimina antes de llamar al plan: [ArenaEmisionBuffer.tsx:154](/home/calusaca/cronista/src/ui/ArenaEmisionBuffer.tsx:154).

No ocurre *siempre* con toda candidatura: una creada durante una calma ya avanzada puede llegar con edad ≤3 s; una pausa vigente también permite entrar sin esperar cuatro segundos.

**No basta con poner `cierre:true` en el segmento.** Actualmente eso:

- Activa `s.cerrando`, que impide reproducir clips posteriores: [ArenaEmisionBuffer.tsx:152](/home/calusaca/cronista/src/ui/ArenaEmisionBuffer.tsx:152), [ArenaEmisionBuffer.tsx:166](/home/calusaca/cronista/src/ui/ArenaEmisionBuffer.tsx:166).
- Solicita la rama de final del partido en el servidor: [relato.ts:102](/home/calusaca/cronista/src/arena/relato.ts:102).

El brief debe separar **exención del atraso ordinario** y **cierre final**. Puede permitir `cierre=true` solo en la llamada interna a `planVozBuffer` para invitados, conservando `segmento.cierre=false`; debe además exceptuar el descarte previo y aplicar los 12 s en `siguienteTurno` antes de cada inicio.

**(e) Otros bloqueos nuevos de v2**

1. **Contabilidad de sustituciones incompleta.** «Cambios» no define cómo contar ventanas. El 044 permite varias sustituciones por ventana: [044:98](/home/calusaca/cronista/docs/disenos/044-correcciones-motor-arena.md:98). Contar eventos `cambio` sirve para jugadores sustituidos, pero no para ventanas consumidas; debe definirse la agrupación o fuente autoritativa.

2. **Transporte del invitado sin selector.** El esquema estricto actual no admite `tipoRelato`, identificador de intervención ni `rol` en memoria: [route.ts:12](/home/calusaca/cronista/src/app/api/arena/sesiones/[id]/relato/route.ts:12). La v2 debe definir cómo solicitar una candidatura concreta del diario sin regenerarla, y actualizar el esquema.

3. **Dos fragmentos frente a dos oraciones más cesión.** `ssmlComentario` genera un fragmento por oración. Debe fijarse que todas las oraciones del invitado se agrupen en un fragmento, o ampliar el máximo. «Resto de validaciones intactas» tampoco puede ser literal: actualmente audio exige exactamente un fragmento: [ArenaEmisionBuffer.tsx:106](/home/calusaca/cronista/src/ui/ArenaEmisionBuffer.tsx:106).

4. **Duración de cesión circular.** «Si la intervención cabe sin ella, se incluye» no demuestra que quepa *con* ella. Debe definirse comprobación del clip combinado, eventual segunda síntesis sin cesión y omisión si el invitado solo supera 24 s.

5. **Cadencia y arbitraje sin estado normativo.** Falta definir qué actualiza `ultimaNoticiaS`, desde dónde se mide la separación, qué ocurre sin intervención previa del estadista y qué significa «sin intervención suya» en el servidor. También debe asignarse precedencia entre invitado y cierre final.

La lista mínima de cambios de redacción necesarios es:

- Separar caducidad de invitados, exención de atraso y cierre final, incluyendo el filtro previo del consumidor.
- Sustituir la garantía de tres roles con calmas de cuatro segundos por una línea de tiempo controlada con margen audible, reservas y remate explícitos.
- Corregir asociación tiro–atajada, normalización pre-v3 y conteo de ventanas de sustitución.
- Completar entradas, memoria, relojes, disparadores y desempates del coordinador.
- Definir petición por identificador durable, agrupación de fragmentos y decisión de duración con/sin cesión.
- Completar los inventarios pendientes y limitar las promesas de interrupción a clips admitidos y prioridades compatibles.

VEREDICTO: NO CERRADO