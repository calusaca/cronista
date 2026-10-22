# Revisión de Codex de la implementación del brief 049 (iteración 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** No encontré errores numéricos ni fugas de futuro en las comprobaciones ejecutadas. Quedan pruebas obligatorias del ciclo de favoritos sin cubrir y tres incumplimientos menores. No modifiqué archivos.

1. **[Mayor] Las pruebas no ejercitan el ciclo de favoritos montado en cliente.**  
   Archivos: `src/ui/__tests__/arena-favoritos.test.ts:34`, `:56`; `src/ui/__tests__/arena-cifras.test.tsx:134`, `:145`; `e2e/arena-cifras.spec.ts:49`.  
   El getter que lanza y el suplente se prueban mediante funciones puras; el aviso se renderiza pasando `error` explícitamente. `renderToStaticMarkup` no ejecuta los efectos de hidratación de `Arena`. El e2e cubre persistencia normal, pero no los fallos exigidos por §10.
   
   **Reproducción:** montar `Arena` con un getter de `localStorage` que lance y comprobar el aviso; después, con `setItem` que lance, pulsar una estrella y comprobar simultáneamente aviso y favorito aplicado en memoria. También falta comprobar la preselección efectiva del suplente en la ficha. El código parece implementar esos comportamientos, pero las pruebas entregadas no los demuestran.

2. **[Menor] Sigue habiendo trabajo sobre todos los eventos en cada render de animación.**  
   Archivos: `src/ui/ArenaCifrasJugador.tsx:17`, `:46`; `src/ui/ArenaCifras.tsx:26`; `src/ui/Arena.tsx:195`.  
   La agregación está correctamente memoizada, pero las proyecciones vuelven a ejecutarse y la ficha reconstruye `tickDe` recorriendo **todo** `registro.eventos`, incluso manteniendo registro, tick y jugador.
   
   **Reproducción comprobada:** tres renders consecutivos al tick 200 produjeron una agregación, pero **tres recorridos completos de `registro.eventos.map`**. Memoizar las proyecciones y ese índice evitaría el trabajo por fotograma solicitado en §2.7.

3. **[Menor] Las notas no explican completamente los límites del muestreo.**  
   Archivos: `src/ui/ArenaCifrasJugador.tsx:56`; `src/ui/ArenaCifras.tsx:58`; cálculo en `src/arena/estadisticas.ts:238`.  
   Falta declarar que descartar intervalos con reinicios también elimina movimiento real y subestima conservadoramente la distancia, como exige §8. Además, el panel afirma sin excepción que el balón parado no se atribuye, aunque en registros sin `pausa`/`saque` se cuenta el tiempo del ejecutor.
   
   **Reproducción:** renderizar el panel de `arena-v2.json` al final: aparece esa afirmación absoluta. La ficha añade una salvedad para legado, pero el panel no.

4. **[Menor] La bitácora no declara el nivel finalmente entregado.**  
   Archivo: `BITACORA.md:195`.  
   La entrada sigue indicando «implementación en curso» y describe también decisiones superadas —extracción de desenlace y xG—. §13 exige nombrar el nivel alcanzado y los recortes.
   
   **Reproducción:** contrastar esa entrada con las filas implementadas: están presentes nivel 2, IGR, destacados y «Solo mi jugador».

La comprobación de los trece puntos de la v1.1 queda así:

| Punto | Resultado | Evidencia archivo:línea |
|---|---|---|
| 1. Final desde prefijo | Conforme: duración, evento o fotograma visible; no lee `registro.final` | `estadisticas.ts:138`, `:252`; `estadisticas.test.ts:236` |
| 2. Pase detenido | Conforme: recepción asociada completa el pase con evidencia de ambos eventos | `estadisticas.ts:177`; `estadisticas.test.ts:360` |
| 3. Máquina exhaustiva | Conforme en revisión: cancelación, fallos, pendientes, precisión y limpieza del estado | `estadisticas.ts:152`, `:159`, `:167`; `estadisticas.test.ts:358` |
| 4. Toque/control/suelto | Conforme: inicialización, retirada del controlador y familias de desvío | `estadisticas.ts:149`, `:189`, `:196`, `:218`; pruebas `:402`, `:432`, `:443` |
| 5. Compatibilidad 045 | Conforme: importa `rematesPorLado`; clasificación posterior separada | `estadisticas.ts:253`; `estadisticas.test.ts:282`, `:347` |
| 6. Capacidades | Conforme: independientes; distingue `null` de cero | `estadisticas.ts:99`, `:299`, `:357`; pruebas `:521` |
| 7. Posesión/cobertura | Cálculo conforme: ponderación temporal, pausas, mapa inicial y cola; salvedad textual pendiente | `estadisticas.ts:235`, `:244`, `:274`; pruebas `:488`, `:508` |
| 8. Distancia/velocidad | Cálculo conforme: reinicios globales, cambio solo para quien entra, vector de velocidad; falta nota conservadora | `estadisticas.ts:230`, `:238`; pruebas `:460`, `:473` |
| 9. IGR | Conforme: degenerados cero, límites y etiquetas estimadas | `estadisticas.ts:78`, `:85`; pruebas `:536`, `:546` |
| 10. Favoritos | Implementación coherente; pruebas de ciclo incompletas, hallazgo 1 | `favoritos.ts:20`, `:25`, `:36`, `:43`; `Arena.tsx:82`, `:116`, `:129`, `:159`, `:197` |
| 11. Agregación única | Conforme para agregación; trabajo residual por render, hallazgo 2 | `estadisticas.ts:143`, `:225`, `:279`; `Arena.tsx:194`; pruebas `:623` |
| 12. Pruebas discriminantes | Anclas IGR, evidencias, recuentos independientes y selector presentes | `estadisticas.test.ts:188`, `:282`, `:360`, `:432`, `:536`; `arena-cifras.spec.ts:35` |
| 13. Entrega/validación | Alcance implementado amplio; declaración de nivel pendiente | `limites.ts:831`; `BITACORA.md:195` |

Las referencias abreviadas corresponden a `src/arena/estadisticas.ts`, `src/arena/__tests__/estadisticas.test.ts` y los archivos UI indicados.

**Comprobaciones adicionales ejecutadas:**

- Cinco fixtures, **488 cortes**, **15.486 proyecciones de jugador** y **123.888 valores** contrastados mediante filtros independientes y cálculos de distancia, velocidad y posesión sobre fotogramas reales.
- Igualdad completa de cifras entre registro completo y prefijo en esos cortes.
- **3.878 comparaciones de HTML ES/EN** del panel y fichas entre registro completo y prefijo: sin diferencias ni texto futuro.
- `git diff --exit-code -- src/arena/estadista.ts`: vacío, código de salida 0.
- `git diff --check`: sin incidencias.

Las dos decisiones consultadas son aceptables:

- **Tokens `--ar-*-bug`:** están acotados al panel y corresponden a su fondo constante. La evidencia guardada mide **6,13:1** para el líder en ambos temas. El informe de regresión 047 termina con cuatro elementos obligatorios **ausentes**; eso no demuestra una regresión de contraste, pero tampoco es un informe completamente verde.
- **`reglasDesdeCliente` duplicada:** reproduce la regla del motor y dispone de comparación para todas las reglas y su ausencia (`estadisticas.test.ts:587`). No encontré divergencia.

Intenté repetir las tres suites afectadas con caché desactivada, pero Vitest falló antes de ejecutar pruebas al intentar crear su directorio temporal SSR en este entorno de solo lectura. Los 1848/58/132 verdes y las 18 mutaciones quedan como resultados aportados, no reproducidos por esta revisión; tampoco repetí el build.