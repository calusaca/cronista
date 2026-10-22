# Revisión de Codex de la implementación del brief 053 (iteración 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** Encontré una pérdida de auditoría D y una excepción al contrato de prefijo que las pruebas actuales no detectan. La identidad del WAV descargado con el blob del audio sí está comprobada.

Revisión en solo lectura, limitada al 053. No modifiqué archivos ni repetí las suites completas; tomo los resultados facilitados como antecedentes. Ejecuté dos reproducciones puntuales en memoria.

### Hallazgos

1. **MEDIA — Se pierde el rechazo D de una composición del estadista.**  
   **Ubicación:** [transcripcion.ts:258](src/arena/transcripcion.ts:258), especialmente líneas 259–260; [transcripcion.test.ts:217](src/arena/__tests__/transcripcion.test.ts:217).

   Se calculan los motivos de composición rechazada, pero se descartan cuando `i.rol !== "comentarista"`. La v1.1 §2 pide conservarlos como `historial.dialogo` cuando la intervención se publica sin turnos. Estos motivos pertenecen a **esa composición**: conservarlos no supone atribuir al estadista los intentos LLM del comentarista.

   **Reproducción:** cargar `arena-reinicios-v4.json`, crear `MesaSesion` con `componer` que invoque `componerIntercambio` y añada `" Dato inventado."` al primer turno; ejecutar `mesa.final(registro)` y transcribir lo publicado. Obtuve una intervención del estadista con rechazos **D1 y D5** en `auditDialogo`, pero sus dos líneas carecen de `historial.dialogo` y el Markdown omite el rechazo. El diario del JSON sí conserva la auditoría original.

   La prueba de la línea 217 exige precisamente la salida sin historial: consolida esta omisión. Debe conservarse el rechazo de composición sin inventar intentos V ni copiar historial ajeno. Conviene aclarar la tabla del §1 para distinguir explícitamente ambas cosas.

2. **MEDIA — La propiedad del prefijo falla al comienzo; la prueba evita ese caso.**  
   **Ubicación:** [transcripcion.ts:179](src/arena/transcripcion.ts:179); [transcripcion.test.ts:294](src/arena/__tests__/transcripcion.test.ts:294), especialmente línea 296.

   Con corte cero no se genera relato. Al avanzar al primer tick sin fotograma aparecen líneas de tick cero, incumpliendo la exigencia del §5(b): toda línea añadida debe tener `tick ∈ (t', t]`.

   **Reproducción:** con `arena-reinicios-v4.json` y diario vacío, comparar las transcripciones en `t'=0` y `t=1`. La primera tiene cero líneas; la segunda incorpora dos de **tick 0**: «Comienza el partido…» y el saque de centro. Reproduje el mismo incumplimiento en los ticks 2, 3 y 4.

   La prueba escoge únicamente un evento sin fotograma con `tick > 100`, por lo que no demuestra la propiedad general. Aquí también hay una tensión dentro del brief: debe declararse una excepción inicial o revisarse la regla de cero líneas en el corte cero.

3. **BAJA — Los clips distinguibles del e2e no verifican el orden de montaje del audio.**  
   **Ubicación:** [arena-descargas.spec.ts:211](e2e/arena-descargas.spec.ts:211), líneas 217–224.

   El hash demuestra correctamente **descarga = blob del `<audio>`**. El tamaño demuestra la suma de muestras incorporadas. Ninguna aserción utiliza las frecuencias distintas para comprobar el orden de los clips.

   **Reproducción conceptual:** invertir `muestras` antes de llamar a `wavMono`, manteniendo segmentos y contadores. El audio y la descarga compartirían el mismo hash, tamaño y cabecera; estas comprobaciones seguirían pasando. Es una limitación de cobertura, no evidencia de que el montaje actual esté desordenado. Para demostrarlo haría falta comprobar muestras o frecuencias en posiciones esperadas.

### Comprobación de los puntos 1–11 de la v1.1

| Punto | Resultado | Archivo:línea y evidencia |
|---|---|---|
| **1. Veredicto del texto publicado** | Conforme | `transcripcion.ts:157–161, 198–205, 239–251`: V aprobado por contrato; rechazos separados como historial; clases diferenciadas. Caminos reales en `transcripcion.test.ts:153–178`. |
| **2. V/D por rol** | **Pendiente** | `transcripcion.ts:241–266`: D aprobado con turnos y no aplicado sin ellos; estadista y marcos sin V ni historial LLM ajeno. **Se pierde el rechazo D propio del estadista: hallazgo 1.** |
| **3. Auditorías opcionales/vacías** | Conforme | `transcripcion.ts:158, 236, 258`: accesos protegidos. Casos vacío, ausente y escalonado en `transcripcion.test.ts:196–203`. |
| **4. Cursor en todas las vistas** | Conforme | `Arena.tsx:198, 296`: pasa `tickCifras` siempre. `ArenaDescargas.tsx:22–30`: construye al pulsar. Guardado a mitad en `arena-descargas.spec.ts:118–131`; búfer en `142–187`. |
| **5. Corte y proyección** | **Pendiente** | `transcripcion.ts:195–197, 212, 235, 284–291`: diario, marcador y contadores cortados; sin `finalTick` ni `motivo`. `estadisticas.ts:147–148` evita leer `registro.final` para determinar el final. **Excepción inicial no cubierta: hallazgo 2.** |
| **6. Citas y procedencia** | Conforme | `transcripcion.ts:213–232`: conserva citas, intervalo y fuente; varias oraciones mantienen procedencias separadas; eventos ordenados por posición. Casos adversarios en `transcripcion.test.ts:254–280`. |
| **7. Markdown escapado** | Conforme | `transcripcion.ts:296–297, 307–360`: escape de textos, nombres, modelos, ids, referencias y motivos; texto junto al rótulo. Entradas adversarias en `transcripcion.test.ts:395–413`. |
| **8. Fixtures adversarios** | Parcial | `transcripcion.test.ts:80–97, 102–129, 158–193, 313–326`: relato reducido, orden, variantes, reintentos y futuro precargado. Persisten las lagunas de los hallazgos 1 y 2. |
| **9. WAV idéntico y límites** | Conforme para identidad | `ArenaNarracion.tsx:138–143, 189`: conserva tick/idioma y descarga el mismo blob. Invalidación en `:37`. Hash, tamaño, cabecera e idioma en `arena-descargas.spec.ts:190–243`. Límite exacto en `arena-descargas.test.tsx:54–60`. Alcance del montaje: hallazgo 3. |
| **10. Importación real** | Conforme | `arena-descargas.spec.ts:101, 246–254`: POST reales, tres registros públicos aceptados y transcripción rechazada; sin interceptar `/api/arena`. `transcripcion.ts:281`: `importable: false`. |
| **11. Recorte y presupuesto** | Sin recorte esencial observado | Se mantienen agrupación Markdown (`transcripcion.ts:350–360`) y prueba funcional WAV (`arena-descargas.spec.ts:190–243`). El tiempo real invertido no se puede determinar mediante estos archivos. |

Las líneas se derivan del registro y del diario recibido: `transcripcion.ts:179–269` no introduce reservas, editorial ni respuestas del asistente como fuentes adicionales. El montaje en `Arena.tsx:294–296` pasa únicamente `comentarios` e `intervenciones`.

El cierre requiere resolver el tratamiento del rechazo D del estadista y explicitar/probar la excepción del prefijo inicial.