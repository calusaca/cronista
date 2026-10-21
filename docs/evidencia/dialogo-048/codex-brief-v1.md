# Revisión de Codex del brief 048 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 21 oct 2026. Informe íntegro; resuelto en la versión 1.1 del brief.

**Veredicto: NO CERRADO.**

La ampliación conserva una base adecuada del 045 —candidaturas publicadas una vez, memoria de escucha con `texto = id` y prioridad de las noticias—, pero aún deja decisiones que pueden producir comportamientos incompatibles entre servidor, ruta y consumidor. Revisión estática, sin modificar archivos ni ejecutar pruebas o mutaciones.

1. **[Bloqueante] La selección puede elegir una variante inválida.**  
   **Sección:** §5, coordinador y descartes.  
   **Por qué:** se considera válida la candidatura si alguna variante es válida, pero después se elige completa por «decodificada y cabe», o breve por «decodificada». Falta exigir en cada rama duración finita, positiva y `≤ VOZ_BUFFER.duracionMaxS`. Una completa de 25 s podría ganar si la ventana es de 30 s aunque solo la breve sea válida. Además, «sin breve» mezcla ausencia deliberada con petición pendiente o fallida.  
   **Corregir:** definir estados por variante —inexistente, pendiente, válida, inválida, fallida— y seleccionar exclusivamente entre variantes válidas. Probar completa inválida/breve válida y el caso inverso.

2. **[Mayor] El contrato de variante se contradice en intervenciones antiguas.**  
   **Sección:** §5, transporte y validación.  
   **Por qué:** pedir `breve` sin `turnosBreve` devuelve completa, pero el consumidor exige que `variante` coincida con la pedida. La respuesta legítima sería rechazada.  
   **Corregir:** distinguir variante solicitada de efectiva, o normalizar la petición antes de enviarla. Exigir una prueba de ruta y consumidor para diarios del 045 y composiciones degradadas.

3. **[Mayor] D1–D5 no prueban la relación que algunas preguntas presuponen.**  
   **Sección:** §3.3 y plantillas de §4.  
   **Por qué:** `secuencia` solo exige un hecho anterior citado. Eso no demuestra que pertenezca a la jugada previa ni explique «cómo se llegó» al disparador. `centro` admite cualquier cita de un centro, sin exigir antecedentes que respondan «cómo nació». La reconstrucción literal comprueba procedencia de nombres y acciones, pero no esas relaciones. V1–V8 tampoco certifican pertinencia causal.  
   **Corregir:** usar marcos neutrales de repaso, o exigir una relación explícita y comprobable entre los eventos. Añadir negativos con un pase anterior ajeno a la jugada y un centro citado sin antecedentes.

4. **[Mayor] La prioridad de marcos deja casos sin resolución definida.**  
   **Sección:** §3.3, `secuencia`, `generico` y D1.  
   **Por qué:** un disparo por tiempo, autogol o `final_anticipado` con una cita anterior cumple `secuencia` antes de alcanzar `generico`. Sin embargo, `acciones` carece de entradas para tiempo y `final_anticipado`, y el autogol debería usar genérico. Tampoco se fija inequívocamente qué hecho ocupa `refiere[0]` cuando hay varios candidatos.  
   **Corregir:** resolver primero los casos obligatoriamente genéricos; restringir después los marcos específicos a tipos soportados y fijar el desempate y orden de referencias.

5. **[Mayor] La ventana conocida es viable, pero no garantiza lo que promete el texto.**  
   **Sección:** §2 y §5, `ventanaConocidaS`.  
   **Por qué:** el consumidor sí dispone del prefijo adelantado y puede inspeccionarlo internamente sin mostrar eventos futuros. Sin embargo, la ventana mide tiempo de partido hasta un evento; las noticias suenan según disponibilidad, caducidad y planificación de audio. También puede existir una noticia ya vencida en el cursor pero todavía admisible y pendiente de sonar. `terminada` aparece en la firma sin comportamiento diferenciado.  
   **Corregir:** describirla como horizonte conservador de planificación; incluir las noticias pendientes admisibles y definir los casos de cursor detenido, límite exacto del prefijo y sesión terminada. Mantener referencias, textos y fotogramas visibles filtrados por cursor. Probar que conocer una noticia futura no adelanta su presentación.

6. **[Mayor] La mutación M13 no demuestra composición única.**  
   **Sección:** §3.6 y §8.  
   **Por qué:** `componerIntercambio` es determinista y no llama al LLM. Una ruta que recomponga plantillas en cada lectura puede conservar el contador del stub y pasar la prueba anunciada. Esto permitiría variar nombres, memoria y SSML entre espectadores.  
   **Corregir:** comprobar que ruta, reconexión y recuperación devuelven exactamente los turnos materializados del diario. Ejecutar una mutación que recomponga sin llamar al modelo y exigir que falle.

7. **[Mayor] El consumo del dato no está especificado como una operación atómica.**  
   **Sección:** §3.4.  
   **Por qué:** el comentarista resuelve sobre una instantánea mientras el estadista avanza. El código actual registra datos dentro de `evaluar`; el 048 añade consulta, comprobación de vigencia y registro posterior. Falta definir contra qué prefijo se compara el valor y cómo se serializan comprobación, publicación y registro. Además, `registrar(dato, T)` necesita indicar qué ocurre con `ultimaEmitidaTick`, usada para evitar duplicados finales.  
   **Corregir:** fijar una operación serializada de publicación y consumo, con revalidación contra el último prefijo. Cubrir cambio de valor durante el LLM, emisión periódica concurrente, fallo de publicación y registro en el tick final.

8. **[Mayor] El límite de caracteres no garantiza una duración inferior a 24 s.**  
   **Sección:** §2, §3.5, §4 y §9.  
   **Por qué:** `210 / 9,5` deja margen, pero cuatro clips con dos voces no establecen una cota para cuatro turnos. `prepararVoz` añade pausas por fragmento y variación de prosodia. Ajustar únicamente `caracteresPorSegundoVoz` podría obligar a bajar el máximo de intervención por debajo de los 200 caracteres permitidos por oración, rompiendo el último escalón.  
   **Corregir:** distinguir estimación de garantía, conservar el rechazo por duración real y definir un margen por turnos. Si falla el smoke, ajustar conjuntamente longitud de oración, intervención y plantillas; probar extremos ES/EN y cuatro turnos.

9. **[Mayor] Falta presupuestar Speech con la unidad que realmente reserva el servicio.**  
   **Sección:** §5, §9 y §10.  
   **Por qué:** la ruta pasa `preparada.caracteresPresupuestados`, que equivale a longitud de **SSML**, a `gestor.extra`. El servicio limita a 80 reservas y 24.000 caracteres por encuentro, además del presupuesto diario. Dos variantes y más elementos `<voice>` aumentan ambas magnitudes; comparar solo texto hablado con 970/951 caracteres no demuestra que quede presupuesto para noticias y cierre. La caché comparte espectadores, pero cada SSML diferente consume otra reserva.  
   **Corregir:** calcular solicitudes, texto y SSML por sesión e idioma, incluyendo narrador, reservas y repetición. Definir precedencia ante agotamiento y probar con `extra` real y Speech simulado que la doble variante no deja sin presupuesto al cierre.

10. **[Mayor] La nueva línea temporal no sustituye las pruebas de interrupción del 045.**  
    **Sección:** §8, E2E y regresiones.  
    **Por qué:** el recorrido nuevo hace terminar los invitados antes de las noticias; no demuestra que una noticia corte un diálogo activo. Tampoco exige expresamente conservar la prueba de noticias continuas, caducidad con respuestas tardías y cierre durante una generación. Los tests unitarios de D1–D5 no cubren esas transiciones del consumidor.  
    **Corregir:** declarar aditivas las pruebas del 048 y enumerar las garantías del 045 que permanecen. Añadir mutaciones que impidan cortar un diálogo, permitan arrancar una variante caducada o publiquen tras `cerrar()`.

11. **[Mayor] Las memorias de plantillas y nombres necesitan una regla de confirmación.**  
    **Sección:** §3.3, §3.5 y §3.6.  
    **Por qué:** no se determina si una plantilla eliminada por la escalera, una composición rechazada por D1–D5 o una publicación fallida consume memoria y marca al invitado como presentado. Completa y breve pueden dirigirse por primera vez al mismo invitado: su construcción no debería hacer que una use nombre corto por haber construido antes la otra.  
    **Corregir:** componer ambas variantes desde el mismo estado previo y confirmar memoria solo tras publicación satisfactoria, indicando qué plantillas retenidas cuentan. Probar degradación, rechazo y fallo de publicación.

12. **[Menor] Algunas pruebas pueden pasar sin comprobar la regla anunciada.**  
    **Sección:** §8, D1–D5 y mutaciones.  
    **Por qué:** componer casos válidos y comprobar que pasan D1–D5 no demuestra rechazo de M1–M4. También falta verificar que cambiar `refiere` no permita reconstruir el texto con un evento distinto del elegido. «Cuatro intercambios no repiten dentro de memoria» debe comprobar la ventana reciente, pues las listas son finitas.  
    **Corregir:** exigir casos inválidos construidos independientemente, con rechazo por regla concreta; probar referencias alternativas y rotación con agotamiento de opciones. Mantener C12a: conservar la primera oración y volver a verificarla.

13. **[Menor] Quedan cifras normativas duplicadas y el alcance de 1–2 días carece de recorte acordado.**  
    **Sección:** §2, apéndice y plan general.  
    **Por qué:** prioridades 35/50/70, calma y otras cifras aparecen en el procedimiento escrito; el script de medición no está versionado. Pueden quedar obsoletas sin poner una prueba en rojo. La entrega combina protocolo, verificador nuevo, estado concurrente, doble audio, compatibilidad, dos consumidores, UI, mutaciones y smoke público.  
    **Corregir:** versionar el procedimiento y derivar sus umbrales de constantes; separar medidas históricas de reglas. Fijar una primera entrega concreta —por ejemplo, pregunta/respuesta/cierre— o justificar tiempo para las cinco formas, concurrencia y doble variante.

Para cerrar el brief deben resolverse primero los contratos de variantes, referencias y consumo del dato, y quedar explícitas las pruebas de regresión y el presupuesto real de Speech.