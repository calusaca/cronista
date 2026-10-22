# Revisión de Codex de la implementación del brief 050 (iteración 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** La implementación resuelve la mayor parte de la v1.1, pero queda una discrepancia funcional y varias pruebas no acreditan los escenarios exigidos.

Revisión en solo lectura, sin modificar archivos. He tomado los resultados de suites y mutaciones indicados como evidencia aportada; no los he vuelto a ejecutar. He excluido los cambios de 051–053.

1. **Mayor — Guy pierde `shouting`, aunque el punto 5 exige conservarlo.**  
   **Archivo:** [src/arena/voz.ts:17](src/arena/voz.ts:17), [voz-expresiva.test.ts:186](src/arena/__tests__/voz-expresiva.test.ts:186).  
   El filtro admite `shouting` para Jenny, pero no para Guy. La prueba interpreta «el resto de voces no cambia» como permiso para omitirlo, pese a que la v1.1 exige expresamente probar Guy con `shouting` y `excited`.  
   **Reproducción:** configurar `ARENA_VOZ_EN=en-US-GuyNeural` y preparar un canto normal: aparecen dos `express-as excited`; el grito queda solo con `prosody`. La prueba actual garantiza ese resultado contrario al requisito.

2. **Mayor — El escenario M7(a) utiliza un gol antiguo que ya ha caducado.**  
   **Archivo:** [src/arena/__tests__/buffer.test.ts:225](src/arena/__tests__/buffer.test.ts:225).  
   Los ticks son 231 y 271, con cursor en 27,4 s: el primero tiene **4,3 s de atraso**, por encima del límite de 3 s. Su planificación devuelve `null` incluso eliminando la comparación cronológica. Además, la prueba construye su propio orden y llama a `golSuperado`; no observa que el consumidor borre el clip. El caso de respuestas fuera de orden también se limita al helper.  
   **Reproducción:** sustituir en `planVozBuffer` la condición de gol posterior por igualdad de prioridad: el rechazo concreto del gol antiguo en M7(a) sigue pasando por caducidad. Para acreditar el escenario, usar dos goles vigentes y observar el consumidor. Esto no contradice que otras pruebas hayan puesto esa mutación en rojo.

3. **Mayor — El e2e del cierre no introduce el tramo normal pendiente exigido.**  
   **Archivo:** [e2e/arena-canto-gol.spec.ts:135](e2e/arena-canto-gol.spec.ts:135), [e2e/arena-canto-gol.spec.ts:165](e2e/arena-canto-gol.spec.ts:165).  
   Solo se retrasa la respuesta del cierre, 1,5 s; las respuestas normales se entregan inmediatamente. La secuencia `[9, 2]` demuestra canto → cierre en ese montaje, pero no la protección ante un tramo normal cuya respuesta llega después del cierre.  
   **Reproducción:** retener explícitamente una respuesta normal, esperar al arranque del cierre y liberarla entonces; verificar que no aparece otra fuente. El montaje actual no ejercita esa carrera.

4. **Menor — M11 comprueba renders independientes, no la persistencia de una celebración montada.**  
   **Archivo:** [src/ui/__tests__/arena-canto-gol.test.tsx:99](src/ui/__tests__/arena-canto-gol.test.tsx:99).  
   `tablero()` calcula el gol fuera de `Arena` y usa `renderToStaticMarkup` de nuevo en cada llamada. Avanzar temporizadores entre esos renders no ejecuta efectos ni conserva estado del componente.  
   **Reproducción:** introducir una expiración mediante efecto en la integración de `Arena`: esta prueba seguiría pasando porque no monta esa integración. El e2e aporta cobertura de retroceso, pero falta mantener el cursor inmóvil durante más de ocho segundos y comprobar que la celebración permanece.

5. **Menor — Falta la comprobación del coste con el productor real sobre v3/v4.**  
   **Archivo:** [src/arena/__tests__/voz-expresiva.test.ts:223](src/arena/__tests__/voz-expresiva.test.ts:223), [src/arena/voz.ts:118](src/arena/voz.ts:118).  
   Se comprueba la síntesis del canto, pero no el delta de SSML de **+330 a +375 caracteres por gol** solicitado en el punto 10(b). Las medidas del experimento no sustituyen esa comprobación de integración.  
   **Reproducción:** comparar `prepararVoz(...).caracteresPresupuestados` del canto y del control anterior para cada gol de v3/v4, en ambos idiomas. No hay una aserción equivalente entre las pruebas revisadas.

La comprobación de los diez puntos queda así:

| Punto v1.1 | Resultado | Archivo:línea y evidencia |
|---|---|---|
| **1. Orden entre goles** | Implementado; cobertura incompleta | `buffer.ts:61` compara instantes; `ArenaEmisionBuffer.tsx:286` descarta anteriores. Hallazgo 2. |
| **2. Goles en una ventana** | Conforme al límite aceptado | `canto-gol.test.ts`, caso «límite declarado»: solo canta el último y cuenta ambos goles. E2e con ticks 231/290 en ventanas distintas. |
| **3. Caducidad por tema** | Conforme | `turnos.ts:42`, `:47`, `:70`, `:177`; `ArenaEmisionBuffer.tsx:214`, `:227`, `:274`: selección, descarte, petición y reintento reciben el tema. |
| **4. Celebración con cota inferior** | Conforme | `vista.ts:30`: elige el mayor tick sobre todos los eventos; tolerancia numérica de `1e-9` en la cota inferior. |
| **5. Estilos efectivos** | Parcial | `voz.ts:17`: Jenny correcto; Guy incumple la expectativa explícita. Hallazgo 1. |
| **6. Anillo y reglas del 047** | Conforme | `globals.css:3082`: especificidad suficiente, `fill: none`; `Arena.tsx:269`: último hijo. E2e comprueba selección, foco, favorito y ausencia de movimiento CSS en los grupos. |
| **7. Pruebas y mutaciones** | Parcial | M4 cambia la constante en runtime y M9 consulta el atributo directamente. M7/M11 tienen las limitaciones de los hallazgos 2 y 4. |
| **8. Duración y cierre** | Parcial | `ArenaEmisionBuffer.tsx:166` rechaza audio real superior a 24 s. Hay medidas experimentales; el e2e usa WAV simulado de 9 s y omite la respuesta normal tardía. Hallazgo 3. |
| **9. Autogol y desvío** | Conforme | `relato.ts:73`: autogol sin grito y desvío normal; `ArenaCelebracion.tsx:26`: «Autogol»/«Own goal» con equipo beneficiado. |
| **10. Tres tramos, volumen y coste** | Parcial | `limites.ts:947`, `voz.ts:62`: tres tramos y un único `<s>`. Coste integrado sin verificar; escucha humana pendiente declarada en la evidencia. |

Las plantillas revisadas derivan jugador, equipo, marcador y segundos del registro; las seis situaciones no anticipan el resultado final. No encontré afirmaciones adicionales no sustentadas en ellas.