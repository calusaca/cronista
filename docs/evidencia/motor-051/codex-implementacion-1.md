# Revisión de Codex de la implementación del brief 051 (iteración 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** No encontré un defecto funcional confirmado en el motor revisado. Quedan huecos de pruebas y falta evidencia exigida para cerrar la implementación.

1. **MEDIA — El caso del umbral de indiferencia no demuestra el desempate.**  
   Archivo: `src/arena/__tests__/motor051.test.ts:265`.

   El portero de `casi` está del lado que hace elegir `+1` tanto por palo lejano como por lado contrario al portero. La aserción pasa aunque se ignore `indiferenciaM`.

   **Reproducción:** calcular el producto cruzado del escenario y elegir directamente `cruz > 0 ? 1 : -1`: devuelve el mismo `+1` esperado. Además, comprobé que la separación construida resulta `0.5000000000000036`, ligeramente superior al umbral; tampoco acredita la igualdad inclusiva.

   Hace falta un escenario donde ambas ramas elijan lados opuestos, con separación inferior, igual y superior al umbral; para la igualdad conviene una recta horizontal.

2. **BAJA — La prueba de relato no cubre las cuatro variantes por idioma.**  
   Archivo: `src/arena/__tests__/motor051.test.ts:641`.

   Se construye un único relato por idioma y se exige que contenga **alguna** variante. Solo se ejercita la elegida determinísticamente para ese evento.

   **Reproducción:** conservar la variante seleccionada y sustituir las otras tres por textos incorrectos: esta comprobación seguiría pasando. Las ocho frases actuales son correctas por inspección, pero falta la cobertura exigida por la prueba 10.

3. **MEDIA — Falta la evidencia JSON de la auditoría de mutaciones.**  
   Referencia: `docs/disenos/051-realismo-del-remate.md:489`; alcance de las pruebas: `src/arena/__tests__/motor051.test.ts:482`.

   La v1.1 exige auditoría con restauración por MD5 y evidencia JSON. En el árbol entregado no encontré ese artefacto para el 051. Los cuatro `implementacion-*.json` contienen lotes, no resultados de mutaciones ni huellas de restauración.

   **Reproducción:** `rg --files | rg 'mutaci|auditoria.*051|051.*auditoria'` solo encuentra el JSON del 046. Tomo las 26 mutaciones en rojo como resultado comunicado; falta poder auditar cuáles se aplicaron, qué prueba falló y cómo se verificó la restauración.

La comprobación de los nueve puntos de la v1.1 queda así:

| Punto | Evidencia `archivo:línea` | Resultado |
|---|---|---|
| 1. «A puerta» del 045 | `metricas-lote.ts:16`, `:91`, `:167`, `:325`; `motor051.test.ts:675` | Importa `rematesPorLado`; clasificación física y discrepancias separadas. `estadista.ts` sin diff. |
| 2. Estirada finita | `remate.ts:62`, `:66`; `motor051.test.ts:315` | Rama explícita cuando alcance ≤ cuerpo; probabilidad finita y acotada. |
| 3. Velocidad efectiva única | `motor.ts:634`, `:650`; `motor051.test.ts:444` | Misma velocidad con entorno para desplazamiento y reacción; pruebas de contacto saturado y no saturado. |
| 4. Intercepciones del 046 | `metricas-lote.ts:193`, `:415`; `limites.ts:602`, `:608`, `:623`; `motor051.test.ts:696` | Conserva contador temporal y añade cercano; límites inclusivos y bandas separadas correctos. |
| 5. Recta y degenerados | `remate.ts:24`; `motor051.test.ts:247` | Producto cruzado normalizado, origen coincidente y empate central implementados. Hueco del umbral: hallazgo 1. |
| 6. Línea balón–centro | `portero.ts:36`; `remate.ts:74`; `motor051.test.ts:337` | Dirección compartida con salida; prueba distingue la bisectriz angular. |
| 7. Integraciones discriminantes | `motor051.test.ts:444`, `:482`, `:522`, `:553`; `motor051.stats.test.ts:35` | Casos independientes para entorno, términos del desvío, vuelo rival y velocidad; contraste v4 descrito como conjunto. |
| 8. Trazabilidad | `metricas-lote-cli.ts:28`; `implementacion-v5-1-100.json:2`; `prototipo/reconstruir.sh:7` | Lotes identifican commit base, árbol modificado, reglas, semillas y duración. No reconstruí el prototipo en este entorno. |
| 9. P1 y compatibilidad | `tipos.ts:12`; `motor.ts:167`; `motor046.test.ts:791`; `motor046.stats.test.ts:9`; `generar-reinicios-v4.ts:57` | Migración a v4 literal y eliminación del requisito de prompt correctas. Falta evidencia del hallazgo 3. |

**Compatibilidad comprobada ejecutando `reproducirArena`:** pasaron los fixtures v1, v2, v3, v4, v5 y `arena-v2.json` sin reglas. La reproducción valida eventos, fotogramas, estado final y respaldos archivados. Los controladores compartidos revisados no tienen diff.

Las nuevas extracciones `arena:remate` y la segunda extracción de `arena:golpe` están exclusivamente dentro de la ruta v5. Altos, alcance, velocidad, desvío y posicionamiento también están protegidos por v5; los bloqueos de campo conservan su radio anterior.

Los JSON entregados muestran intercepciones temporal/cercana de **1/0**, **1/0**, **0/0**, y **0/0** para la base v4, conforme al ajuste autorizado.

No modifiqué archivos. No repetí las suites completas ni las mutaciones. Intenté ejecutar las pruebas focalizadas, pero Vitest requiere archivos temporales y no pudo arrancar bajo el sistema de archivos de solo lectura. El smoke desplegado queda fuera del cierre de implementación según la v1.1.