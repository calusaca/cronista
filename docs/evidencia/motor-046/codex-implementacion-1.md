# Revisión de Codex de la implementación del brief 046 (iteración 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 21 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** Encontré tres discrepancias funcionales y evidencia de aceptación pendiente. No modifiqué archivos.

1. **Mayor — El saque forzado conserva el criterio anterior a la v1.1.**  
   `src/arena/portero.ts:71` calcula distancia de los rivales **al segmento de pase**. La v1.1 exige elegir al compañero con mayor margen respecto de su rival más cercano (`docs/disenos/046-portero-centros-y-robo.md:548`).

   **Reproducción ejecutada:** portero en `(6,34)`, compañeros A en `(80,34)` y B en `(6,60)`, rival en `(20,34)`. A tiene al rival a 60 m y B a 29,53 m; corresponde A. `saqueForzado` devuelve B porque el rival está sobre el segmento hacia A.

   **Prueba engañosa:** `src/arena/__tests__/motor046.test.ts:125` define su oráculo mediante esa misma proyección. La expectativa de `:290` confirma el criterio anterior, aunque la prueba se presenta como cobertura de la v1.1.

2. **Mayor — El recorte al campo rompe la distancia de protección de las manos.**  
   `src/arena/portero.ts:55` proyecta a 4 m y luego aplica `enCancha`. Cerca de una línea, ese segundo paso vuelve a introducir el destino dentro del radio protegido. El motor lo utiliza en `src/arena/motor.ts:407`.

   **Reproducción ejecutada:**
   ```ts
   respetarManos(
     { x: 0, y: 34 },   // destino rival
     { x: 3, y: 34 },   // posición rival
     { x: 1.1, y: 34 }, // portero en controlM
   )
   // Devuelve { x: 0, y: 34 }: distancia 1,1 m; exigida 4 m.
   ```
   La inmunidad al duelo sigue funcionando, pero incumple la protección de destinos y puede prolongar la espera hasta el saque forzado.

   **Cobertura insuficiente:** la prueba de `src/arena/__tests__/motor046.test.ts:336` comprueba proyecciones que caben dentro del campo; no demuestra la garantía junto a las líneas.

3. **Mayor — Tras una falta, el mínimo para soltar empieza antes de terminar la pausa.**  
   `src/arena/motor.ts:557` fija `hastaTick` desde el final de la pausa, pero conserva `desdeTick = tick` de la falta. `soltarManos`, en `:337`, usa ese inicio para autorizar el saque voluntario. La v1.1 pide un plazo nuevo que empiece al terminar la pausa.

   **Reproducción ejecutada:** semilla 7, falta sobre el portero local en tick 0:
   ```text
   finPausa = 15
   manos = { desdeTick: 0, hastaTick: 55 }
   ritmo = 1
   decisión en tick 20 → pase con motivo saque_manos
   ```
   Suelta solo **0,5 s después de la pausa**, aunque el mínimo es 2 s.

   **Prueba engañosa:** `src/arena/__tests__/motor046.test.ts:398` exige precisamente `desdeTick: reinicio.tick`. Además, mantiene un rival pegado: comprueba inmunidad y vencimiento, pero no el inicio del plazo voluntario tras la pausa.

4. **Mayor — Falta evidencia requerida para cerrar la entrega.**  
   No encontré en `docs/evidencia/motor-046/` capturas del smoke desplegado exigido en `docs/disenos/046-portero-centros-y-robo.md:469`, ni resultados del Playwright completo ni de la llamada LLM real 2/2 requerida en `:535`. Los lotes y el JSON de mutaciones no acreditan esas condiciones.

   **Comprobación reproducible:** el inventario del directorio contiene lotes, investigación, prototipo y mutaciones; no contiene esas evidencias. `BITACORA.md:184` sigue registrando implementación pendiente.

La trazabilidad de reglas queda así. «Conforme» indica correspondencia entre código y pruebas inspeccionadas; las excepciones remiten a los hallazgos anteriores.

| Regla del brief / v1.1 | Implementación y comprobación | Resultado |
|---|---|---|
| v4 predeterminada; versión de formato conservada; v1–v4 admitidas | `src/sim/limites.ts:485`; `src/arena/tipos.ts:11`; `src/arena/motor.ts:42`; prueba `motor046.test.ts:737` | Conforme |
| Opción explícita `reglas`, solo con versión actual | `src/arena/motor.ts:26`; prueba `motor046.test.ts:754` | Conforme |
| Gating ordinal y rechace desde v3 | `src/arena/motor.ts:151`, `:163`, `:629` | Conforme |
| Controladores programados y opción de pase preservados | Diff de `src/arena/controladores.ts`; reproducción histórica | Conforme |
| Manos al recibir y reiniciar dentro del área | `src/arena/motor.ts:520`, `:576`; prueba `motor046.test.ts:232` | Conforme |
| Inmunidad a duelo y falta | `src/arena/motor.ts:587`; prueba `motor046.test.ts:216` | Conforme |
| Adquisición: acotar posición y anular velocidad | `src/arena/motor.ts:366` | Conforme |
| Límites de posición durante movimiento y frenado | `src/arena/motor.ts:434`, `:267`; pruebas `motor046.test.ts:319`, `:363` | Conforme |
| Protección de destinos rivales | `src/arena/portero.ts:47`; `src/arena/motor.ts:407` | **Hallazgo 2** |
| Espera, saque voluntario, prioridad del vencimiento y despeje sin receptor | `src/arena/motor.ts:335`; pruebas `motor046.test.ts:266`, `:298` | Conforme salvo criterio forzado |
| Criterio de selección del saque forzado v1.1 | `src/arena/portero.ts:68`; prueba `motor046.test.ts:290` | **Hallazgo 1** |
| Falta al portero: manos y plazo posterior a pausa | `src/arena/motor.ts:557`; prueba `motor046.test.ts:383` | **Hallazgo 3** |
| Mano a mano objetivo, igualdad de x y salida independiente de órdenes | `src/arena/portero.ts:26`, `:35`; `src/arena/motor.ts:380`, `:405`; prueba `motor046.test.ts:410` | Conforme |
| Radio de reacción en tiros; radios normales en pases y centros | `src/arena/portero.ts:43`; `src/arena/motor.ts:613`; prueba `motor046.test.ts:430` | Conforme |
| Conducción, giro, márgenes y renovación | `src/arena/ataque.ts:23`; `src/arena/motor.ts:446`; pruebas `motor046.test.ts:457`, `:466`, `:655` | Conforme |
| Centro local: objetivos, ventaja, personalidad y prioridad | `src/arena/ataque.ts:45`; `src/arena/motor.ts:311`; prueba `motor046.test.ts:482` | Conforme |
| Fase aérea por punto proyectado y destino perturbado | `src/arena/motor.ts:617`; prueba `motor046.test.ts:519` | Conforme |
| Caída fuera: contacto anterior al cruce y reinicio normal | `src/arena/motor.ts:606`, `:635`; prueba `motor046.test.ts:534` | Conforme |
| Fuera de juego capturado al golpe, incluido receptor incidental | `src/arena/motor.ts:284`, `:566`; prueba `motor046.test.ts:551` | Conforme |
| Llegada: tres objetivos, línea legal, exclusiones y cambio de posesión | `src/arena/ataque.ts:94`; `src/arena/motor.ts:382`; prueba `motor046.test.ts:589` | Conforme |
| Lateral A: pase imposible cae a decisión local | `src/arena/motor.ts:301`; prueba `motor046.test.ts:645` | Conforme |
| `centrar`: esquema, validación, receptor nulo y ejecución pendiente | `src/arena/tipos.ts:128`; `src/arena/controladores.ts:50`; `src/arena/motor.ts:358`; prueba `motor046.test.ts:670` | Conforme |
| Respaldo LLM inválido archivado y reproducible | `src/arena/__tests__/motor046.test.ts:717` | Conforme |
| Prompt construido con constantes alterables | `src/arena/controladores.ts:137`; prueba `motor046.test.ts:706` | Conforme |
| Matriz v1/v2/v3/ausente/v4 por comportamiento | `src/arena/__tests__/motor046.test.ts:766` | Presente |
| Narración ES/EN y plantilla verificada | `src/arena/vista.ts:41`; `src/arena/relato.ts:23`; prueba `motor046.test.ts:789` | Conforme |
| Fixture v4, generador y tiempos normalizados | `src/arena/__fixtures__/generar-reinicios-v4.ts:45`; prueba `motor046.test.ts:737` | Conforme |
| Métricas: todos los ticks, continuidad y denominadores vacíos | `src/arena/metricas-lote.ts:53`, `:132`, `:213`; `metricas-lote.test.ts:34` | Conforme |
| Contraste v3 mediante pérdidas tras atajada | `src/arena/__tests__/motor046.stats.test.ts:21` | Conforme |
| Evidencia de lotes con semillas, duración, reglas y commit | `src/arena/metricas-lote-cli.ts:22`; JSON de lotes | Presente; árbol declarado con cambios |
| Búsqueda de semillas e2e y límites ES/EN | `e2e/arena-buffer.spec.ts:15`; `src/ui/Arena.tsx:301` | Conforme |
| Playwright completo, smoke desplegado y LLM real | Evidencia requerida por el brief | **Hallazgo 4** |

Comprobé directamente la reproducción de los fixtures v1–v4, los tres `public/experimentos/arena-*.json` y `docs/evidencia/azure-publica/partido.json`: los ocho mantienen igualdad profunda y de JSON serializado. No encontré comportamiento nuevo filtrado por `conReinicios`; el cálculo compartido extraído para fuera de juego conserva la fórmula anterior.

No pude repetir Vitest: incluso sin caché, su infraestructura intenta escribir temporales y el entorno de solo lectura lo impide. Los 1700 tests, 57 estadísticos y 34 mutaciones quedan como resultados aportados, no revalidados por esta revisión. Los contraejemplos anteriores sí se ejecutaron directamente mediante Node.