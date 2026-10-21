# Revisión de Codex del brief 046 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 21 oct 2026. Informe íntegro; resuelto en la versión 1.1 del brief.

**Veredicto: NO CERRADO.** El brief contempla correctamente el cambio del rechace a `reglasDesde(v3)` y la conservación de `planProgramado`/`opcionPase`, pero quedan contradicciones y garantías sin cubrir. Revisión estática del código y de la evidencia; no modifiqué archivos ni ejecuté los lotes.

1. **Bloqueante — «Métricas de lote»: el contraste v3 exige incumplir una métrica imposible bajo v3.**  
   «Robo al portero en manos» exige que exista `balon.manos`, estado exclusivo de v4. Su contador dará cero en v3, precisamente el valor que se exige incumplir. La tabla reconoce la diferencia al anotar «18 (como pérdidas)».  
   **Corregir:** contrastar v3 mediante la métrica amplia de pérdidas o robos tras atajada; reservar el contador de inmunidad para v4.

2. **Mayor — «Error 3»: el saque forzado no garantiza el máximo de cuatro segundos.**  
   Puede no existir ningún compañero a ≤ `saqueManosMaxM`. Además, el brief exige elegir el de mayor margen al vencer el plazo, mientras el prototipo solo busca ese candidato si previamente no encontró un pase ordinario. Son comportamientos distintos.  
   **Corregir:** definir una alternativa sin receptor cercano y dar prioridad inequívoca al vencimiento. Añadir pruebas sin candidatos y con un pase ordinario distinto del mejor saque forzado.

3. **Mayor — «Sin avanzar ni salir del área»: falta cubrir las pausas.**  
   El límite de posición se prescribe en `moverJugadores`, antes de `cruceDeBanda`. Sin embargo, `reiniciar` puede crear `manos` y una pausa, durante la cual `frenarJugadores` conserva desplazamiento por inercia y solo aplica `enCancha`. Cerca de la línea, el portero puede quedar por debajo de `controlM`, incumpliendo la garantía.  
   **Corregir:** aplicar también el límite durante el frenado, bajo v4, o fijar explícitamente posición y velocidad al adquirir las manos. Probar ambas porterías durante una pausa.

4. **Mayor — «Error 3» y `resolverFalta`: protección incompleta tras una falta sobre el portero.**  
   `resolverFalta` reasigna directamente el balón al jugador que recibió la falta; no llama a `recibir`. Si es un portero dentro del área, queda con posesión pero sin `manos`, de nuevo disputable tras la pausa. El brief no decide si esa reanudación debe tener protección.  
   **Corregir:** definir expresamente ese estado y su plazo. Añadir una prueba de falta sobre un portero con balón en los pies, seguida de reanudación y nueva disputa.

5. **Mayor — «Fase aérea»: el extremo del paso habilita contactos fuera de la zona de caída.**  
   La condición propuesta comprueba la distancia del extremo al destino y después conserva los contactos de **todo** el segmento. Un paso que termina dentro de `caidaM` puede admitir una intercepción cuya proyección queda fuera de ese radio.  
   **Corregir:** recortar el segmento a la zona disputable o comprobar también el punto de contacto. Añadir un defensor justo antes del límite, con el extremo del paso ya dentro.

6. **Mayor — Centros cuyo destino perturbado sale del campo: resultado sin especificar.**  
   `sacarBalon` añade error lateral y, con reinicios, conserva el objetivo bruto. Un centro explícito al borde del área puede acabar fuera del campo. La regla aérea habla del extremo del paso, mientras el motor calcula contactos hasta el cruce y resuelve después la salida; no queda fijada la prioridad para este caso.  
   **Corregir:** declarar si se conserva ese error y se produce banda/meta/esquina, qué punto gobierna la fase aérea y cuándo prevalece un contacto. Exigir casos con caída fuera del campo.

7. **Mayor — Fuera de juego: la prueba de llegada no verifica la sanción del centro.**  
   Limitar destinos a la línea vigente no garantiza que el jugador esté habilitado al golpe: puede partir adelantado o sobrepasarla por inercia y separación. La sanción actual depende de `vuelo.adelantados`, capturado al lanzar, y de `recibir`; ninguna prueba exigida demuestra que el centro conserva esa referencia.  
   **Corregir:** probar un adelantado que vuelve antes de recibir y debe ser sancionado, y un habilitado que rebasa la línea después del golpe y puede recibir. Incluir un receptor incidental distinto del designado.

8. **Mayor — «Llegada al área»: contradicción sobre las órdenes de resguardo.**  
   Se admiten jugadores cuyo destino fue sustituido por anclas tras cambiar la posesión, pero también se afirma que `cubrir`, `mover` y `presionar` nunca entran. El prototipo usa `cambio || accionPermitida`, por lo que sí incluye esas órdenes cuando cambia la posesión. Las cifras publicadas incorporan esa decisión.  
   **Corregir:** elegir la precedencia y volver a medir si prevalece el resguardo. La prueba 13 debe incluir un cambio de posesión dentro de la ronda.

9. **Mayor — «Controladores LLM»: falta especificar el recorrido de una orden `centrar` inválida.**  
   La prueba 16 comprueba rechazo directo, pero no que una respuesta inválida active el respaldo en el coordinador y siga siendo reproducible. Tampoco define qué ocurre si `receptor: null` no encuentra compañero de campo; un receptor explícito propio puede ser el portero, mientras el automático lo excluye.  
   **Corregir:** fijar elegibilidad y ausencia de receptor. Probar una respuesta LLM inválida completa, `motivo: "orden_invalida"`, respaldo archivado y reproducción exacta.

10. **Mayor — «Decisión de versión» y prueba 17: los fixtures no demuestran cualquier gating.**  
    Es correcto congelar los controladores: `reproducirArena` valida órdenes archivadas y compara los respaldos con `planProgramado(obs)`. Pero un fixture solo detecta reglas cuyos escenarios atraviesa; no garantiza que «cualquier regla nueva» activada mediante `conReinicios` rompa la prueba.  
    **Corregir:** exigir una matriz de escenarios v1/v2/v3/sin `reglas` frente a v4 para cada comportamiento nuevo, además de fixtures con respaldo. Mantener intactas también las dependencias compartidas que generan esos planes.

11. **Mayor — «Pruebas exigidas»: varias mutaciones no están demostradas por los casos descritos.**  
    La prueba 7 no coloca explícitamente un defensor a la **misma** x: cambiar `≤` por `<` puede pasar. La prueba 16 compara cifras del prompt con constantes: escribir a mano el mismo valor también pasa. En la prueba 4 falta precisar posición del rival y velocidad para que retirar el límite de posición provoque necesariamente el fallo.  
    **Corregir:** construir casos de igualdad, verificar la construcción del prompt con valores alterados o mediante comprobación estructural, y fijar un escenario de empuje reproducible que cruce el límite sin la protección.

12. **Mayor — Evidencia y umbrales: las métricas propuestas no coinciden completamente con las medidas.**  
    `comun*.mts` captura después de `moverBalon`, únicamente cuando este se ejecuta; no captura todos los ticks de pausa. El análisis de episodios comprueba continuidad por índice, no por diferencia de ticks. Además, `robosEnManos` cuenta transiciones de posesión sin capturar `manos` ni faltas: respalda la métrica amplia, no la dura.  
    **Corregir:** fijar momento de muestreo, continuidad temporal, denominadores y tratamiento de muestras vacías. Recalcular las bandas con el helper definitivo antes de prohibir ajustarlas.

13. **Menor — Constantes y evidencia: quedan cifras repetidas y trazabilidad insuficiente.**  
    `base046.mts` repite `105`, `68`, `34`, `25`, `70`, `30` y `50`, incluidos valores derivados del paso temporal. El brief también usa coordenadas y umbrales literales en escenarios pese a afirmar que las pruebas importarán las cifras. Los JSON no identifican `S0`, opciones del prototipo ni revisión del código.  
    **Corregir:** derivar geometría y ticks de constantes, separar valores deliberados del escenario y guardar metadatos de reproducción. Generar las tablas desde los resultados para evitar divergencias manuales.