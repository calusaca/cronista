# Revisión de Codex del brief 050 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** El diseño tiene una base trazable, pero quedan fallos de orden temporal, integración y pruebas que impiden considerarlo listo para implementar en medio día. Revisión en solo lectura; no modifiqué archivos ni ejecuté síntesis, publicación o mutaciones.

1. **Bloqueante — §3.4: un gol antiguo puede interrumpir al más reciente.**  
   **Por qué:** el brief afirma que los clips se consumen en orden de tick. Sin embargo, [ArenaEmisionBuffer.tsx](src/ui/ArenaEmisionBuffer.tsx:278) ordena por prioridad descendente y, en empate, por tick **descendente**. Con dos goles disponibles y vigentes, puede arrancar el nuevo y, en la siguiente iteración, el antiguo cortarlo mediante la nueva igualdad de prioridad. Consumir cada clip una vez no garantiza cronología.  
   **Cómo corregir:** permitir la interrupción entre goles únicamente si el evento entrante es posterior al activo; descartar los goles anteriores superados. Probar respuestas fuera de orden y dos clips ya disponibles, además del segundo gol que llega mientras suena el primero.

2. **Mayor — §3.4 y e2e: dos goles a cuatro segundos pueden compartir ventana.**  
   **Por qué:** [relato.ts](src/arena/relato.ts:106) selecciona una sola noticia por ventana de cinco segundos y, entre goles, el más reciente. Dos goles separados cuatro segundos pueden caer en la misma ventana: el primero nunca produce canto y cambiar `planVozBuffer` no lo recupera. El fixture propuesto no especifica esta condición.  
   **Cómo corregir:** declarar explícitamente la limitación o ampliar el productor. Para probar la interrupción, situar los goles en ventanas distintas; añadir otro caso que documente qué ocurre cuando comparten ventana.

3. **Mayor — §3.5: los 20 segundos no llegan a todos los caminos.**  
   **Por qué:** `CandidataTurno` carece de `tema`; el consumidor tampoco lo transmite al coordinador. Además, [esperaReintentoInvitado](src/arena/turnos.ts:186) sigue cerrando los reintentos a los 12 segundos. Cambiar selección, descartes y petición inicial deja una reacción al gol vigente pero sin posibilidad de reintentar.  
   **Cómo corregir:** definir una función común de caducidad por tema y propagar el tema desde la intervención hasta selección, descarte, petición y reintento. Probar un 429 o fallo de red entre los segundos 12 y 20, y el límite exacto de caducidad.

4. **Mayor — §3.6: la celebración admite goles futuros.**  
   **Por qué:** la condición escrita, `tick − gol.tick < duración`, también se cumple cuando la diferencia es negativa. Con el registro completo o adelantado, puede mostrarse un gol antes de ocurrir y al retroceder el cursor.  
   **Cómo corregir:** exigir `0 ≤ tick − gol.tick < celebracionS / pasoS` y elegir el mayor tick elegible. Añadir pruebas antes del primer gol, entre dos goles y al retroceder desde después del segundo.

5. **Mayor — §3.2: el filtro actual elimina `shouting` de Jenny.**  
   **Por qué:** la evidencia local acredita ese estilo, pero [voz.ts](src/arena/voz.ts:16) solo admite `excited` y `sad` para Jenny. Aplicar literalmente “filtrado por `estilosAdmitidos`” omitiría el estilo elegido. Los experimentos construyen SSML directamente y no detectan esta integración.  
   **Cómo corregir:** incluir expresamente la actualización de la lista admitida. Probar `prepararVoz` con Jenny y con voces efectivas alternativas, verificando tanto la presencia del estilo compatible como su omisión cuando corresponda.

6. **Mayor — §3.6: la cascada existente puede convertir el anillo en un disco.**  
   **Por qué:** [globals.css](src/app/globals.css:2879) aplica `fill` y `stroke` a **todos** los círculos de `.arena-token`, con selectores más específicos que `.arena-goal-ring`. También intervienen selección, foco y favorito. Ser el último hijo preserva el primer círculo usado por pruebas, pero no protege la apariencia del nuevo.  
   **Cómo corregir:** excluir el anillo de los selectores de ficha o definir reglas suficientemente específicas. Comprobar estilos calculados con local, visitante, selección, foco y favorito. Mantener la animación en el círculo propio respeta el 047; falta comprobar también que los grupos exteriores siguen sin animación, transición ni transform CSS.

7. **Mayor — §5: varias mutaciones no tienen una prueba que garantice rojo.**  
   **Por qué:** M9 no queda cubierta por el e2e citado: [arena-cifras.spec.ts](e2e/arena-cifras.spec.ts:111) busca `status` **dentro de la ficha**; un rótulo hermano en la cancha no altera esa consulta. M4 permite comprobar una importación, aunque el código siga usando `0.8`. M11 menciona cursor retrocedido, pero ese caso no aparece entre las pruebas UI exigidas.  
   **Cómo corregir:** afirmar directamente que el rótulo carece de `role="status"`; sustituir la configuración con un mock y comprobar el cambio de comportamiento del umbral; exigir una secuencia explícita de avance y retroceso. Registrar resultados reales de las mutaciones.

8. **Mayor — §3.3 y §3.4: falta verificar duración e integración del cierre.**  
   **Por qué:** `150 / 9.5 + 0.38 < 24` demuestra una estimación, no una cota del audio: las variantes tienen distinta puntuación y prosodia. Además, en [ArenaNarracion.tsx](src/ui/ArenaNarracion.tsx:105) el narrador completo no tiene el mismo rechazo de 24 segundos que los invitados. La prueba unitaria propuesta para el cierre tampoco demuestra que el consumidor reproduzca canto completo → cierre → silencio, especialmente con peticiones pendientes.  
   **Cómo corregir:** distinguir duración por canto y por segmento completo; medir combinaciones largas representativas y definir qué ocurre si exceden el límite. Añadir e2e con gol final, cierre preparado y respuestas tardías, verificando que nadie habla después.

9. **Menor — §3.1: situaciones correctas, contrato de autogol y desvío incompleto.**  
   **Por qué:** las seis situaciones son coherentes para un gol que incrementa exactamente una unidad el marcador de `evento.lado`; ese lado también es correcto para autogoles según el motor. Pero el rótulo siempre presenta equipo y “goleador” sin identificar la propia puerta. Para `motivo: "desvio"` se exige conservar grito y simultáneamente un texto A sin grito, ausente de las constantes. El texto actual del hecho tampoco añade “con desvío” a un gol.  
   **Cómo corregir:** mantener las reglas del marcador, añadir pruebas con autogol que empata y que da ventaja al rival, identificarlo en el rótulo y fijar una única plantilla de desvío sustentada en el registro. No inferirlo de una atajada cercana.

10. **Mayor — §2, §3.3 y §6: evidencia insuficiente para cerrar emoción, coste y plazo.**  
    **Por qué:** la escucha humana sigue pendiente. La forma española elegida tiene media del primer segundo de **−22,6 dB**, frente a **−20,9 dB** del control: la mejora citada de otra estructura no valida esta. El incremento de SSML tampoco será uniformemente “≈200”: depende de nombres, variante y situación. Finalmente, las tareas estimadas suman **5 h 15 min**, sin margen explícito para doce mutaciones, escucha, despliegue y smoke bilingüe.  
    **Cómo corregir:** completar la escucha comparada, calcular diferencias de SSML con `prepararVoz` sobre registros concretos y verificar presupuesto del encuentro. Reestimar incluyendo integración y validación; definir un recorte P1 efectivo, pues quitar solo la animación del rótulo no resuelve ese volumen de trabajo.