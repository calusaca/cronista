# Revisión de Codex del brief 051 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** El diseño contempla bien la compatibilidad por reglas, pero quedan ambigüedades de cálculo, discrepancias con las métricas actuales y garantías de pruebas que la evidencia no demuestra.

Revisión estática, en solo lectura. No modifiqué archivos ni ejecuté los lotes: el prototipo archivado requiere reconstruir su motor y adaptar sus rutas.

1. **ALTA — § 8: «a puerta» no tiene la misma clasificación que el 045/049.**

   **Por qué:** `rematesPorLado` en `estadista.ts` solo cierra su búsqueda ante otro `tiro`, `gol`, `atajada` o `tiro_fuera`; ignora intercepciones, recepciones y recuperaciones. El brief y `prototipo/remates.mts` introducen cierres adicionales. Por ejemplo, `tiro(A) → intercepcion(B) → gol(A)` puede contar a puerta en el estadista y bloqueado en el helper. `estadisticas.ts` hereda la clasificación del estadista. La equivalencia declarada no está garantizada.

   **Cómo corregir:** conservar intacto el contrato 045/049 y calcular «a puerta» mediante `rematesPorLado`; separar la clasificación física detallada. Añadir secuencias sintéticas con intercepción, recuperación, falta y recepción entre remate y gol, además del caso «alto».

2. **ALTA — §§ 4.7 y 6: división por cero en la estirada.**

   **Por qué:** `alcancePortero` puede devolver exactamente `cuerpoM` a bocajarro. Entonces `(distanciaLateral − cuerpoM)/(alcance − cuerpoM)` tiene denominador cero; con contacto justo en el límite produce `0/0`. Acotar un `NaN` no lo corrige. El prototipo sí incorpora una salvaguarda —si el radio no supera `cuerpoM`, usa estirada 0— que falta en el contrato del brief.

   **Cómo corregir:** especificar esa rama explícitamente y probar alcance igual a `cuerpoM`, tanto con distancia lateral menor como igual al radio. Exigir una probabilidad finita y acotada.

3. **ALTA — §§ 4.6 y 6: reacción calculada con distinta velocidad en brief y prototipo.**

   **Por qué:** el brief define el tiempo usando la velocidad del remate y exige aplicar el entorno al vuelo. Sin embargo, el prototipo mueve el balón con `velocidadRemate × velocidadBalon` y calcula el alcance dividiendo solo por `velocidadRemate`. En césped alto o superficie sintética, el portero reacciona a una velocidad distinta de la que lleva el balón.

   **Cómo corregir:** definir una única velocidad efectiva y reutilizarla en desplazamiento y reacción. Añadir pruebas con entorno que mantengan el alcance en el tramo no saturado. Las bandas medidas sin esos escenarios no resuelven esta discrepancia.

4. **ALTA — § 8: el refinamiento de «intercepción inmediata» abre una zona ciega.**

   **Por qué:** añadir el radio de 15 m excluye cualquier pérdida rápida lejana, aunque proceda de un saque defectuoso y no de una disputa aérea legal. `saquesPerdidos ≤ 0,35 por partido` permite pérdidas; no sustituye la prohibición anterior de intercepciones inmediatas. Las pruebas propuestas —5 m cuenta, 21 m no— solo verifican el filtro. Además, el JSON candidato sigue informando el incumplimiento original; no contiene una evaluación del nuevo radio. Su contador auxiliar `saquesCortos` usa la distancia perturbada del evento, no el indicador aéreo real.

   **Cómo corregir:** conservar ambos contadores, temporal y temporal con radio, y justificar sus bandas por separado. Añadir casos de saque corto defectuoso, saque largo defectuoso y disputa aérea legal, con límites exactos de tiempo y distancia. Regenerar los tres lotes con la definición elegida.

5. **MEDIA — §§ 4.1 y 9.1: la distancia a una recta se implementa como distancia a un segmento.**

   **Por qué:** `objetivoRemate` usa `proyeccion(...).distancia`, pero `geometria.ts` acota la proyección a `[0,1]`. Un portero situado sobre la prolongación de la línea rematador–centro puede superar `indiferenciaM` aunque su separación perpendicular sea cero. El producto cruzado y el umbral estarían clasificando geometrías distintas. Tampoco queda decidido el desempate con rematador exactamente centrado ni el origen coincidente con el centro del arco.

   **Cómo corregir:** definir la separación perpendicular a la recta mediante el producto cruzado normalizado, con tratamiento explícito del segmento degenerado y del empate. Probar portero antes, dentro y después del segmento, en ambos lados.

6. **MEDIA — § 4.8: «bisectriz» y fórmula no describen lo mismo.**

   **Por qué:** `C + u·posicionamientoM` sigue la línea centro del arco–balón. Fuera del eje central no es, en general, la bisectriz del ángulo formado por los dos postes vistos desde el balón. El prototipo mide la primera geometría.

   **Cómo corregir:** decidir entre mantener la fórmula y llamarla posicionamiento sobre la línea balón–centro, o implementar la bisectriz angular real y volver a medir. Añadir un caso cercano y lateral que distinga ambas.

7. **ALTA — § 9.13: el contraste v4 no demuestra que cada regla sea necesaria.**

   **Por qué:** quitar solo velocidad variable, estirada o posicionamiento no convierte v5 en v4: siguen activos objetivo, error, alcance y altos. Por tanto, no se sostiene que «cualquier regla […] quitada deja v5 igual a v4 en su banda». Tampoco hay una banda específica para el desvío dependiente de potencia y estirada. Las pruebas 3 y 6 pueden detectar velocidad fija y probabilidad constante, pero no acreditan que cada término llegue correctamente desde el motor.

   **Cómo corregir:** sustituir esa garantía por una matriz real de mutaciones. Exigir casos de integración que fallen al eliminar por separado potencia, nivel y estirada del desvío; entorno de la reacción; y posicionamiento durante un vuelo rival. Mantener el contraste v4 como comprobación conjunta del cambio.

8. **MEDIA — Evidencia: reproducción y trazabilidad incompletas.**

   **Por qué:** los scripts importan `../proto/motor.ts`, mientras el material está archivado bajo `prototipo/`; `parchar.py` busca `motor.orig.ts` junto a sí mismo. El procedimiento del README no deja esas rutas listas sin pasos adicionales. También hay imports absolutos al workspace. Los JSON examinados no guardan el commit individualmente y los lotes 046 del candidato declaran `reglas: "reinicios-v4"` pese a ejecutar el modelo experimental.

   **Cómo corregir:** documentar una reconstrucción ejecutable con estructura exacta, rutas configurables, revisión base y huella del parche. Etiquetar inequívocamente motor base y modelo experimental. Generar las tablas desde los JSON para evitar transcripciones manuales.

9. **MEDIA — §§ 9–13: cortes contradictorios y riesgo de exceder un día.**

   **Por qué:** P1 exige § 9 entero, incluida la prueba 11 del prompt; P2 permite posponer precisamente ese prompt y su prueba. Además, hay que migrar expectativas explícitas del 046: actualmente se exige `ARENA.reglas === v4` y se rechaza v5. El trabajo incluye matriz de versiones, mutaciones, fixture con búsqueda, lotes controlados y e2e, pero el coste publicado contabiliza principalmente simulaciones.

   **Cómo corregir:** resolver la contradicción P1/P2 y definir un cierre obligatorio verificable. Mantener como prioridad compatibilidad, modelo y métricas; separar el smoke desplegado. Presupuestar la auditoría de mutaciones y la migración de pruebas, además de los lotes.

Sobre **versionado y PRNG**, no encontré un cambio productivo v5 ya aplicado en los archivos revisados. El plan de § 3 es adecuado: v4 literal, `reglasDesde`, controladores compartidos intactos y segunda extracción de `arena:golpe` exclusivamente bajo v5. La clave actual del desvío es efectivamente `desvio:${tick}:${id}`. Esa compatibilidad queda pendiente de verificar en la implementación; las métricas equivalentes del prototipo con `V5=0` no prueban reproducción byte a byte de v1–v4.