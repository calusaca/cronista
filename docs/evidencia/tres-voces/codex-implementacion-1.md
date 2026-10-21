# Revisión de Codex de la implementación del brief 045 (iteración 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 21 oct 2026, sobre el árbol sin commit. Informe íntegro:

**Veredicto: NO CERRADO.** La implementación cubre buena parte del brief v3, pero faltan la reproducción de invitados en replay, el presupuesto LLM compartido y parte de la validación exigida.

Revisión de solo lectura sobre el diff y los archivos nuevos indicados. TypeScript pasó con `tsc --noEmit --incremental false`. No ejecuté las suites unitarias ni e2e; sus resultados no se dan por comprobados.

1. **Mayor — El replay guardado no reproduce las intervenciones del diario.**  
   **Archivo:** [src/ui/Arena.tsx:251](src/ui/Arena.tsx:251), [src/ui/ArenaNarracion.tsx:46](src/ui/ArenaNarracion.tsx:46).  
   Las intervenciones se cargan y aparecen en la Mesa, pero únicamente se pasan a `ArenaEmisionBuffer`. Al abrir la repetición se monta `ArenaNarracion`, que no recibe intervenciones y solicita exclusivamente tramos `vivo`/`completo`, sin `intervencion`. Incumple «en replay guardado se muestran y reproducen las intervenciones del diario».  
   **Reproducción:** terminar una emisión con invitados, pulsar «Abrir repetición disponible» y escuchar desde el inicio. La Mesa muestra los invitados, pero ninguna solicitud de audio incluye sus identificadores.

2. **Mayor — No existe el presupuesto LLM compartido exigido.**  
   **Archivo:** [src/arena/sesiones.ts:131](src/arena/sesiones.ts:131), [src/arena/narrador.ts:105](src/arena/narrador.ts:105).  
   Narrador y comentarista comparten la instancia del modelo, pero no un presupuesto que se reserve y agote. El narrador conserva su contador independiente de tres comentarios; la Mesa permite hasta `maxComentaristaPorSesion`, cada uno con dos intentos. `uso()` contabiliza consumo, sin impedir nuevas llamadas. El respaldo se activa por fallo, rechazo o plazo, no por agotamiento del presupuesto compartido.  
   **Prueba demostrativa:** usar un LLM con contador, agotar el presupuesto vigente mediante comentarios del narrador y disparar después al comentarista. Actualmente este vuelve a llamar a `completar` en lugar de ir directamente a plantilla.

3. **Mayor — El comentarista pierde la procedencia de los datos estadísticos que cita.**  
   **Archivo:** [src/arena/narrador.ts:97](src/arena/narrador.ts:97), [src/arena/narrador.ts:102](src/arena/narrador.ts:102).  
   Los datos del estadista se convierten únicamente en `HechoVerificable`; su `intervalo` y `fuente` se pierden. La evidencia de la oración se reconstruye solo con identificadores de eventos. Por tanto, citar como apoyo el reloj, un conteo cero o los contadores del entrenador no conserva la procedencia explícita que justifica ese valor. La tarjeta del comentarista tampoco muestra los hechos de apoyo.  
   **Prueba demostrativa:** devolver una oración válida con una acción como hecho principal y `estadista:cambios:<tick>` como apoyo. Comprobar que la evidencia publicada contiene `fotograma:<tick>` y el intervalo inspeccionado: actualmente no los contiene.

4. **Mayor — El e2e comprueba una aproximación de la línea de tiempo, no toda la secuencia exigida.**  
   **Archivo:** [e2e/arena-mesa.spec.ts:128](e2e/arena-mesa.spec.ts:128), [e2e/arena-mesa.spec.ts:185](e2e/arena-mesa.spec.ts:185).  
   La primera prueba sí mide fuentes, interrupción del comentarista, alternancia, separación parcial, cierre y silencio. Sin embargo:
   
   - No contrasta los arranques con el cursor del partido en 5/20/30/40 s; para el primer estadista solo exige que preceda al reinicio.
   - La apertura dura 1,4 s y el tiro 1,6 s, frente a los 1,5 s especificados.
   - La prueba aparte genera una noticia por ventana de `BUFFER_ARENA.tramoTicks` —actualmente cinco segundos—, no una por segundo, y observa solo hasta aproximadamente el segundo 22.
   
   **Prueba demostrativa:** registrar el cursor visible en cada `fuente.start` y contrastarlo con los hitos; para el segundo escenario, comprobar explícitamente una noticia por segundo y observar todo el intervalo previsto. Las aserciones actuales no demuestran esas promesas.

5. **Menor — Persisten cifras normativas repetidas a mano en pruebas.**  
   **Archivo:** [e2e/arena-mesa.spec.ts:86](e2e/arena-mesa.spec.ts:86).  
   El reinicio usa literalmente prioridad `35`, aunque la prueba importa `VOZ_BUFFER` y existe `PRIORIDAD_EVENTO_ARENA`. El tiro también duplica la prioridad `60` de esa tabla. Esto contradice la exigencia de una fuente única para las cifras normativas. Los ticks y duraciones propios del escenario son otra cosa; esos literales sí forman parte del fixture.  
   **Prueba demostrativa:** cambiar la prioridad exportada del reinicio: este fixture sigue usando la cifra antigua.

6. **Menor — Algunas pruebas exigidas no demuestran lo que anuncian.**  
   **Archivo:** [src/arena/__tests__/mesa-voz.test.ts:48](src/arena/__tests__/mesa-voz.test.ts:48), [src/arena/__tests__/estadista.test.ts:65](src/arena/__tests__/estadista.test.ts:65), [src/arena/__tests__/turnos.test.ts:56](src/arena/__tests__/turnos.test.ts:56).  
   El recorte de una intervención se prueba con cadenas artificiales de letras, sin verificar que el dato/oración resultante siga pasando `verificarUpdate`. Los reinicios se contrastan por suma total, sin comprobar el conteo independiente **por tipo**. La prueba de memoria llama manualmente a `recordarVoz`; no ejercita un consumidor cuyo audio no llegue a arrancar.  
   **Pruebas demostrativas:** recortar una intervención real verificada y volver a verificarla; intercambiar las categorías de dos reinicios conservando el total; simular un fallo de `fuente.start` y comprobar que no crece la memoria. Las pruebas actuales no cubren esas regresiones.

**Lo que sí cumple el brief**

| Sección | Resultado de la revisión |
|---|---|
| **Roles** | Narrador LLM textual; retirada de los tres temas editoriales; comentarista con prompt propio, V1–V8, reintento y respaldo verificado; estadista determinista. |
| **Candidaturas en el servidor** | Publicación en el diario con identificadores estables; exposición en instantánea, reproducción y recuperación. Las lecturas y solicitudes de audio no regeneran candidaturas. |
| **Estadista** | Cuenta solo `tiro`; relaciona atajadas por `receptor`; contempla el desvío pre-v3; usa los contadores del entrenador para cambios. Hay pruebas específicas de estas reglas. |
| **Un clip por intervención** | Agrupa las oraciones del invitado; cesión opcional por caracteres; SSML con voces hermanas; descarte del audio demasiado largo. |
| **Coordinador de turnos** | Función pura, bloqueo con fuente activa y reserva, calma, separación, caducidad, alternancia y bloqueo final. Los invitados evitan los filtros de atraso y repetición del narrador. |
| **`MESA_ARENA`** | Valores, nombres y plantillas coinciden con el brief y están comentados. |
| **Voz** | Voces por rol e idioma, estilos permitidos, variables de entorno y degradación publicada en `herramientas`. |
| **Interfaz** | Tres tarjetas, rótulos ES/EN, filtro por cursor y `data-narration-role`; prueba estática y comprobación móvil previstas. |

En particular, **no encontré una carrera reproducible en el flujo normal de `MesaSesion`**: el contador se reserva antes de iniciar la generación y `generando` permanece ocupado hasta terminar la publicación. Tampoco encontré intervenciones incorporadas a `RegistroArena`/`hechosArena`, invitados interrumpiendo reservas ni aceptación de dos fragmentos para un relato ordinario.

La ruta con `intervencion` cumple los controles solicitados: búsqueda en el diario con **404** para desconocidos, modo `buffer`, ventana exacta, rechazo de cierre/entrada, ausencia de regeneración y síntesis mediante `extra` con clave basada en el SSML. La prueba HTTP cubre desconocido y ventana incorrecta; no comprueba explícitamente la deduplicación concurrente de Speech.

**NO CERRADO:** deben resolverse los incumplimientos anteriores y acreditarse las suites exigidas, además de la publicación, el smoke con tres voces reales y la medición de llamadas a Speech requeridos para el cierre.