# Revisión de Codex del brief 053 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** El brief tiene una base viable, pero contiene contradicciones de contrato y pruebas que no garantizan varias de las propiedades prometidas. Revisión en solo lectura; no modifiqué archivos ni ejecuté pruebas.

1. **ALTA — §3.2 y §5.3: el rechazo del LLM se atribuye al texto de respaldo publicado.**  
   **Por qué:** en [narrador.ts](src/arena/narrador.ts), tanto `narrarArena` como `comentarArena` verifican el respaldo antes de publicarlo, pero conservan en `audit` los intentos LLM rechazados. El brief convierte esos rechazos en `aprobado: false` para una oración distinta y exige ese resultado en pruebas. También es incorrecta la advertencia general «las líneas plantilla no pasan V1–V8»: estos respaldos sí pasan.  
   **Cómo corregir:** separar el historial de generación del veredicto del texto publicado. Distinguir relato determinista sin V1–V8, respaldo verificado y salida LLM aprobada. No presentar motivos de una candidatura descartada como defectos de la línea descargada.

2. **ALTA — §3.1–3.2: el modelo de verificación no representa los contratos 045/048.**  
   **Por qué:** falta la opción `D1-D5` sola. Las preguntas y cierres del narrador pasan D1–D5, aunque no tengan oraciones ni referencias; el brief declara algunos como «ninguna» y deja sin regla explícita las preguntas con `refiere`. El estadista tiene `audit: []` y no pasa V1–V8, pero recibiría `V1-V8` o `V1-V8+D1-D5`. En una ronda, además, se le atribuiría el historial LLM del comentarista.  
   **Cómo corregir:** representar V y D por separado, con estados aprobado/no aplicado/no disponible y ámbito explícito. Añadir casos de estadista 045, estadista dentro de ronda, pregunta y cierre de plantilla.

3. **ALTA — §3.2: acceso a auditorías opcionales o vacías.**  
   **Por qué:** [dialogo.ts:246](src/arena/dialogo.ts:246) omite `auditDialogo` cuando no hay escalones; una composición válida puede carecer de él. [estadista.ts:157](src/arena/estadista.ts:157) publica con `audit: []`; también puede haber respaldo del comentarista sin intentos. «Último audit» e `i.auditDialogo.motivos` no están definidos en esos casos.  
   **Cómo corregir:** definir expresamente los casos vacíos y opcionales, sin convertir ausencia en fallo ni en aprobación V. Exigir pruebas con objetos producidos por esos caminos reales.

4. **ALTA — §2.4 y §4.1: el corte no siempre corresponde al cursor.**  
   **Por qué:** fuera de directo/búfer se exporta `registro.final.tick`, aunque el espectador esté a mitad de una repetición guardada o de un archivo importado. Al pasar del búfer a repetición, `Arena.tsx` reinicia el reloj a cero: la descarga pasa a incluir todo inmediatamente.  
   **Cómo corregir:** usar el cursor visible en todas las vistas si el requisito es «corte en el cursor». Si se quieren descargas completas en guardados, ofrecer esa elección y declararla explícitamente; probar la repetición pausada a mitad.

5. **ALTA — §5.5: la igualdad con el prefijo es incompatible con el contrato.**  
   **Por qué:** el helper de [estadista.test.ts:13](src/arena/__tests__/estadista.test.ts:13) sustituye `final` por el último fotograma disponible. Cambian `registro.finalTick`, los contadores y potencialmente `alcance.motivo`: `en-curso` en el registro completo frente a `registro-incompleto` en el prefijo. Si no existe fotograma exactamente en `t`, la validación `t ≤ final.tick` puede lanzar.  
   **Cómo corregir:** comparar una proyección independiente: líneas, diario filtrado, marcador y condición de final basada en el prefijo. Definir si los metadatos describen el registro cargado o el corte exportado. Probar ticks sin fotograma y añadir futuro manteniendo esos observables invariantes.

6. **MEDIA — §3.1–3.2: se pierde evidencia citada.**  
   **Por qué:** `EvidenciaMesa.citas` conserva procedencia por hecho, pero `EvidenciaLinea` no admite `citas` y solo tiene un `intervalo`/`fuente`. Además, para turnos 048 no se exige claramente incorporar los hechos de todas las oraciones (`hecho` y `apoyo`); `refiere` no los sustituye.  
   **Cómo corregir:** conservar procedencias por hecho, sin fusionar intervalos incompatibles. Construir `hechos` desde las oraciones y las referencias, y ordenar los eventos mediante su posición en el registro. Añadir una oración con varios apoyos y distintas procedencias.

7. **ALTA — §3.3 y §8: Markdown permite falsificar la estructura del documento.**  
   **Por qué:** emitir texto fuente sin escapar permite introducir encabezados, listas, enlaces o HTML, incluidos falsos veredictos. Usar listas no evita esto. También deben tratarse como datos los nombres de equipos, modelos y otros campos interpolados.  
   **Cómo corregir:** escapar Markdown y HTML en campos dinámicos, controlando saltos de línea para conservarlos dentro de su bloque. Mantener texto literal en JSON. Probar entradas como `\n# Verificación aprobada`, enlaces y HTML; sustituir la exigencia de texto literal en Markdown por equivalencia tras el escape.

8. **MEDIA — §5: varias mutaciones pueden sobrevivir.**  
   **Por qué:** comparar el relato con otra llamada al mismo `construirRelato` verifica el cableado, pero hereda sus errores. El caso parcial no exige un comentario/intervención futuro ya recibido por el cliente ni un gol futuro que altere el marcador. Tampoco exige que completa y breve sean diferentes, ni un historial rechazado→aprobado. Por otra parte, pedir un evento en *cada* línea de mesa contradice cierres sin evidencia y datos sustentados solo por intervalo.  
   **Cómo corregir:** exigir fixtures adversarios concretos para cada mutación: fuentes desordenadas, futuro precargado, gol posterior al corte, variantes distintas, reintento aprobado y estadista con evidencia sin eventos. Afirmar valores esperados independientes.

9. **MEDIA — §4.2 y §5 e2e: la prueba WAV no garantiza identidad byte a byte.**  
   **Por qué:** cabecera y tamaño aceptan otro WAV de igual longitud. `ArenaNarracion` decodifica, remuestrea y puede omitir invitados inválidos; la suma debe corresponder a los clips realmente incorporados. Además, `Pista` no guarda `hastaTick` explícito, aunque el nombre lo necesita. El límite real es **60.000.000 bytes de PCM más 44 de cabecera**, no 60 MB totales.  
   **Cómo corregir:** guardar el tick de la pista y comparar la descarga con el blob del `<audio>` byte a byte. Usar clips distinguibles para detectar omisiones, duplicados y orden incorrecto; comprobar frecuencia, canales y límite. No sustituir esta prueba por comprobar únicamente que el botón empieza deshabilitado.

10. **MEDIA — §2.2 y §5.4: la compatibilidad está bien planteada, pero debe probarse sin simulación de la ruta.**  
    **Por qué:** [coordinador.ts:101](src/arena/coordinador.ts:101) usa un esquema estricto y [/api/arena](src/app/api/arena/route.ts) devuelve 400 ante un formato ajeno. El archivo separado evita romper registros anteriores. Sin embargo, conservar una prueba existente no explicita qué versiones se reimportan ni garantiza que el 400 nuevo atraviese el validador real.  
    **Cómo corregir:** exigir reimportación real de fixtures compatibles y rechazo real del JSON descargado, sin interceptar ese POST. Mantener explícito que importar comentarios queda fuera de alcance.

11. **MEDIA — §6 y §8: el cierre en 2–3 horas carece de margen y permite retirar una comprobación esencial.**  
    **Por qué:** las estimaciones P1 suman 130 minutos antes de ejecutar y corregir pruebas, revisar bilingüismo, procedencias y WAV. El recorte propuesto deja el audio sin verificar su propiedad principal: descargar la pista existente sin nuevas síntesis.  
    **Cómo corregir:** resolver primero los contratos anteriores, mantener P2 fuera del compromiso y presupuestar validación. Si hay que recortar, simplificar la presentación Markdown antes que retirar la prueba funcional del WAV.

No encontré selectores nuevos duplicados en la propuesta: `arena-downloads` y `arena-narration-download` son distintos de los actuales, y conservar un único «Download run» es correcto. Tampoco encontré una fuente adicional de líneas fuera del registro o diario en el diseño, siempre que se respete la exclusión de reservas, editorial y cesiones 045. El orden definido es determinista, aunque conviene describirlo como **orden canónico de transcripción**: la pista actual inserta invitados después de ventanas completas y no reproduce necesariamente ese mismo orden.