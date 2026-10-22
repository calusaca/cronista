# Revisión de Codex del brief 056 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** La derivación compartida desde `config` e `inicial` es viable, pero el brief aún contiene bloqueos de integración y garantías que sus pruebas no demuestran. Revisión estática; no modifiqué archivos ni ejecuté suites.

1. **ALTA · §§ 5.3, 5.6 y 7 — La ruta rechaza las tres piezas del tick 0.**  
   **Por qué:** el esquema actual de [`route.ts`](src/app/api/arena/sesiones/[id]/relato/route.ts:24) exige `hastaTick` positivo. Las peticiones previstas llevan `desdeTick = hastaTick = 0`: fallan antes de derivar la previa. «Lo demás igual» omite este cambio necesario.  
   **Cómo corregir:** permitir cero exclusivamente para ventanas de intervención válidas, conservando el rechazo de ventanas vacías del narrador. Exigir pruebas HTTP reales: previa `[0,0]` → 200; narrador `[0,0]` → rechazo; intervención ordinaria con ventana incorrecta → rechazo.

2. **ALTA · §§ 2.2, 5.2 y 7, e2e 1 — El escenario detenido en tick 0 bloquea la apertura.**  
   **Por qué:** [`ArenaEmisionBuffer.tsx`](src/ui/ArenaEmisionBuffer.tsx:176) solo solicita la entrada cuando `hastaTick > 0`. El e2e propone `final = inicial`, ningún avance y solo *keepalive*. `entradaPendiente` permanece activa y `aperturaPendiente` impide toda previa. El WAV simulado de entrada nunca se solicita.  
   **Cómo corregir:** usar un prefijo publicado mayor que cero y menor que la reserva inicial, manteniendo el cursor detenido; si se requiere voz sin ningún avance publicado, diseñar explícitamente ese camino. No quitar la protección de apertura del 045 para hacer pasar la prueba.

3. **ALTA · §§ 2.2 y 5.2 — La reactivación contradice la disponibilidad durante los primeros 30 segundos.**  
   **Por qué:** al reactivar, el consumidor termina las candidaturas locales cuyo `tick` es anterior al cursor. Todas las previas tienen `tick: 0`. Una previa pendiente al desactivar puede quedar terminada al reactivar en el segundo 5, aunque el brief promete que dentro de esos 30 segundos se pide y sigue siendo elegible.  
   **Cómo corregir:** definir una excepción acotada para previas pendientes y vigentes, preservando las ya iniciadas, interrumpidas o consumidas. Probar por separado primera activación tardía y desactivar/reactivar, incluidos los límites de caducidad.

4. **ALTA · § 3.2 — La escalera no garantiza los límites para registros válidos.**  
   **Por qué:** el código admite clubes de hasta 100 caracteres y jugadores de hasta 80. La oración de perfiles conserva ambos clubes incluso después de quitar el narrador; puede superar 200/210 caracteres sin otro escalón disponible. La alineación también puede exceder su límite con club y capitán largos. Probar nombres de 40 caracteres no cubre el contrato admitido.  
   **Cómo corregir:** definir una salida final que siempre quepa, por ejemplo referencias inequívocas «local/visita» y omisiones documentadas. Probar máximos válidos, ambos idiomas y caracteres que requieren escape XML. La reducción debe ser idéntica en cliente y servidor.

5. **ALTA · § 5.1.3 — El desempate modifica el coordinador fuera de la previa.**  
   **Por qué:** ordenar globalmente por `id` ascendente a igual tick cambia el orden estable actual para candidatas del 045/048, incluidos posibles finales con sufijo. No es cierto que el resultado ajeno a la previa permanezca necesariamente igual.  
   **Cómo corregir:** aplicar el orden de piezas exclusivamente entre previas y conservar el orden existente para las demás. Añadir regresiones con candidatas ordinarias del mismo rol y tick, ids en orden inverso y mezcla con previas.

6. **ALTA · §§ 7, 8 y 12 — La compatibilidad con los e2e existentes está afirmada sobre un comportamiento inexistente.**  
   **Por qué:** varios mocks de [`arena-mesa.spec.ts`](e2e/arena-mesa.spec.ts:290) usan `intervenciones.find(...)!` y llaman a `relatoIntervencion` sin comprobar si existe. Un id `previa:*` desconocido no recibe automáticamente 404: provoca una excepción en el mock. También hay aserciones sobre peticiones y recorrido de pista. Los cortes ≥20 segundos no bastan para excluir candidatas que caducan a los 30.  
   **Cómo corregir:** sustituir «Opus verifica» por una auditoría concreta de los mocks afectados. Autorizar cambios mínimos que respondan 404 a ids desconocidos, manteniendo intactas las aserciones originales. Añadir cobertura nueva donde la previa sí se reproduce.

7. **MEDIA · §§ 3.3 y 3.6 — La evidencia declara fuentes incorrectas y pierde procedencia mixta.**  
   **Por qué:** el árbitro sale de `inicial.arbitro`, pero se etiqueta `config`; la formación sale de `config.formaciones`, pero alineación figura como `inicial`. El turno de plantel mezcla nivel de `inicial` con entrenador de `config`; condiciones mezcla árbitro y entorno. Una sola `fuente` no describe esas combinaciones. Reconstruir exactamente el mismo objeto incorrecto no detecta el problema.  
   **Cómo corregir:** usar citas por hecho o separar hechos/oraciones por procedencia, aprovechando `EvidenciaMesa.citas`. Probar rutas de origen concretas, no solo pertenencia a `{"inicial","config"}`.

8. **MEDIA · §§ 3.1, 3.5 y 6 — Falta una degradación sin inventar para superficie natural sin `cesped`.**  
   **Por qué:** `Condiciones.cesped` es opcional, pero el vocabulario solo contempla `natural_corto`, `natural_alto` y `sintetica`. El brief no determina qué hacer cuando existe superficie natural sin longitud registrada. Elegir «corto» introduciría un dato; construir una clave ausente produciría texto inválido.  
   **Cómo corregir:** añadir «césped natural / natural grass» para ausencia de longitud y probarlo en tarjeta, voz y reconstrucción. La normalización de nuevas configuraciones no sustituye esta regla para registros cargados.

9. **MEDIA · §§ 5.4, 6 y 7 — El presupuesto Speech está dimensionado a mano, sin prueba de suficiencia.**  
   **Por qué:** 12 solicitudes cubren la combinatoria declarada, pero «≈600 caracteres SSML» por síntesis no demuestra que 7.200 alcancen. `prepararVoz` añade voces, prosodia, estilo, pausas y escapes. La prueba propuesta verifica agotamiento y aislamiento, pero puede pasar aunque la bolsa impida completar todas las variantes e idiomas prometidos. Además, la rama actual del narrador cuenta toda clase distinta de `invitado`: añadir solo una rama `previa` no evita que sus reservas resten cuota al narrador.  
   **Cómo corregir:** medir SSML real con `prepararVoz`, sumar las claves únicas y probar recorridos completos ES/EN con ambas variantes y catálogos degradados. Excluir explícitamente `previa` del cómputo del narrador. Mantener comparaciones independientes con y sin previa, incluida la reserva del cierre.

10. **MEDIA · §§ 5.1, 5.2, 7 y 12 — No se demuestra la interacción nueva con saque, reservas y silencio del 041.**  
    **Por qué:** el nuevo e2e detenido no ejercita la transición a reproducción. Los otros separan «ocultar sin voz» y repetición guardada. Quedan sin probar una completa solicitada durante preparación que termina de llegar después, el corte por saque, la no repetición de la pieza cortada y la continuidad durante fallos/reintentos. Las pruebas antiguas no cubren estas candidatas nuevas.  
    **Cómo corregir:** añadir una línea temporal con preparación → saque → calma → caducidad, síntesis demorada y reserva audible. Medir ausencia de solapes, prioridad del saque y silencio máximo del 041. Mantener el reloj independiente de la voz.

11. **MEDIA · §§ 3.6, 5.7 y 7 — Varias mutaciones anunciadas no quedan realmente cubiertas.**  
    **Por qué:** igualdad entre llamadas y comprobación mediante el mismo derivador permiten errores compartidos. Publicar además la previa en el diario podría seguir pasando la prueba de grabación sin diario. El desempate por id tampoco demuestra orden obligatorio: si la pieza 2 está decodificada antes que la 1, el coordinador puede elegirla. Las pruebas de transcripción no aseguran evidencia completa en los turnos del narrador.  
    **Cómo corregir:** exigir ausencia de `previa:*` en publicaciones reales; comparar cliente y ruta sobre el mismo prefijo; probar disponibilidad de audio fuera de orden; mutar evidencia y cada campo contractual. Para 053, comprobar hechos y procedencia de **todos** los turnos, orden intrapieza y actualizar el texto que actualmente dice que la pista inserta invitados después de la ventana del narrador.

12. **MEDIA · §§ 4.1, 4.5 y 7 — Falta resolver foco y estado al desmontar la tarjeta.**  
    **Por qué:** la sección desaparece automáticamente con botones potencialmente enfocados. No hay política de foco ni prueba de teclado. Además, `aria-controls` apunta a un cuerpo eliminado al plegar; el estado se reinicia por `cargaId`, pero también se promete volver desplegada al regresar a cero, cosa que ese reinicio por sí solo no garantiza.  
    **Cómo corregir:** mantener un destino controlado estable, definir el retorno de foco cuando desaparezca un control enfocado y especificar el reinicio al abandonar tick 0. Probar plegar → avanzar → volver, navegación por teclado y selección de suplentes.

13. **MEDIA · §§ 6, 9, 10 y 12 — La estimación y el corte no reflejan las dependencias pendientes.**  
    **Por qué:** las cinco horas de voz incluyen contrato HTTP, coordinador, dos consumidores, cuotas, verificación, transcripción, regresiones y Speech real bilingüe. El e2e y los mocks parten de supuestos rotos. El mínimo A exige 10.1, que incluye el e2e completo con escenarios de B. También se repiten dimensiones del campo —68 y 90— en lugar de derivarlas de `ARENA` y las anclas.  
    **Cómo corregir:** separar aceptación ejecutable de A y B, reservar tiempo explícito para regresiones y fijar un punto de inicio máximo de B. Derivar la geometría física de constantes existentes. Presentar duración, consumo y pronunciación como estimaciones pendientes de medición: el canto «uno a cero» no verifica cómo Speech leerá «4-3-3».

El bloque visual puede avanzar tras precisar degradación, foco y criterios de aceptación. El bloque hablado necesita resolver los bloqueos de tick 0 y cerrar las pruebas de integración antes de considerarse listo para implementar.