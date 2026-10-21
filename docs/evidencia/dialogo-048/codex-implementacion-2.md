# Revisión de Codex de la implementación del brief 048 (iteración 2, v1.2)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 21 oct 2026. Informe íntegro; resuelto en la versión 1.3 del brief.

**Veredicto: NO CERRADO.**

Revisión en solo lectura de la implementación sin commit, con **v1.2 como norma prevalente**. No modifiqué archivos. Los resultados de typecheck, 1780 pruebas, 58 de estadísticas, 129 de Playwright y mutaciones son los comunicados por el implementador; no repetí esas suites. Ejecuté dos reproducciones puntuales en memoria.

### Estado de los seis hallazgos anteriores

| # | Hallazgo | Estado | Evidencia actual |
|---|---|---|---|
| 1 | Excepción 045 aplicada al 048 colapsado | **Resuelto** | `src/arena/turnos.ts:15,53–58`: distingue origen y exige ventana para 048. Consumidor: `src/ui/ArenaEmisionBuffer.tsx:224`. |
| 2 | Composición y memoria sin serializar | **Resuelto** | `src/arena/mesa.ts:37–65`: composición, publicación y confirmación comparten cola. Subsiste el problema de estado del estadista descrito abajo. |
| 3 | Rollback pisa estado posterior | **Parcial** | `src/arena/estadista.ts:208–210`: compara antes de restaurar, pero igualdad de tick no identifica quién escribió el temporizador. Reproducción nueva nº 2. |
| 4 | Presupuesto probado en orden artificial | **Parcial** | `src/arena/__tests__/mesa-voz.test.ts:363–403`: ahora intercala peticiones, pero no exige equivalencia de rechazos a 180 s ES+EN. |
| 5 | Petición de completa ignora noticias pendientes | **Resuelto** | `src/arena/turnos.ts:124–125`; `src/ui/ArenaEmisionBuffer.tsx:186,220`: horizonte compartido. |
| 6 | Negativo D3 solo demuestra D1 | **Resuelto** | `src/arena/dialogo.ts:344–345`: cualquier conector produce D3. Prueba específica en `src/arena/__tests__/dialogo.test.ts:441`. |

### Estado de los siete hallazgos de auditoría

| # | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| 1 | Pregunta sobre tarjeta, respuesta sobre otro hecho | **Resuelto** | `src/arena/dialogo.ts:81–95,313–317`: repaso exige disparador presente y principal coincidente. |
| 2 | Invitados agotan Speech del narrador | **Parcial** | Cuota y reserva implementadas en `src/arena/sesiones.ts:43–49`; no garantizan protección del narrador pendiente. |
| 3 | Rollback restaura estado obsoleto | **Parcial** | Caso de otro valor protegido; caso concurrente del mismo tick sigue fallando. |
| 4 | Falta forma final o termina diciendo «Seguimos» | **Resuelto** | `src/arena/mesa.ts:114–122`; `src/arena/dialogo.ts:177–178,293–295`. |
| 5 | Ronda recortada pierde cierre | **Resuelto** | `src/arena/dialogo.ts:193–198`: añade cierre cuando cabe. |
| 6 | Variante insinúa proximidad de noticias | **Resuelto documentalmente** | Declarado expresamente en v1.2, punto 10; comportamiento conservado. |
| 7 | Mutantes supervivientes | **Resuelto en cobertura; ejecución reportada** | Negativos A02/A03/A05 y F02, B13, D04/E04 y e2e G01/G03/G04 presentes. No certifiqué independientemente la ejecución de mutaciones. |

### Comprobación de v1.2

| Punto | Estado | Archivo:línea y conclusión |
|---|---|---|
| 1. Pertinencia | **Cumple** | `src/arena/dialogo.ts:81–95,313–317`: sin caída al último hecho para decidir repaso. |
| 2. Cuotas Speech | **Parcial** | `src/arena/sesiones.ts:43–49`; ruta `src/app/api/arena/sesiones/[id]/relato/route.ts:36,46`. Clases correctamente asignadas; protección insuficiente del narrador. |
| 3. Publicación serializada | **Parcial** | `src/arena/mesa.ts:49–64` serializa el intercambio, pero `:75` evalúa y consume estado antes de entrar en cola. |
| 4. Final siempre publicado | **Cumple** | `src/arena/mesa.ts:120–122`: respaldo si el periódico ya emitió; `:59` evita colisión de identificador. Cierres propios en `src/arena/dialogo.ts:178`. |
| 5. Ronda recortada | **Cumple** | `src/arena/dialogo.ts:195–198`: conserva cierre si cabe. |
| 6. Origen 045/048 | **Cumple** | `src/arena/turnos.ts:15,54–57`; integración en `src/ui/ArenaEmisionBuffer.tsx:224`. |
| 7. Petición de completa | **Cumple** | `src/ui/ArenaEmisionBuffer.tsx:186–188,220`: utiliza `horizonteS`, incluidas noticias pendientes. |
| 8. D3 | **Cumple** | `src/arena/dialogo.ts:287,344–345`: rechazo explícito con motivo D3. |
| 9. Nuevos negativos | **Cumple en cobertura** | `src/arena/__tests__/dialogo.test.ts:370,458,468,476`; `turnos.test.ts:143`; `mesa-voz.test.ts:327`; `src/ui/__tests__/arena-mesa.test.ts:98`; `e2e/arena-mesa.spec.ts:447,532,601`. |
| 10. Límites honestos | **Cumple documentalmente** | Declarados en el brief. El límite presupuestario adicional de 180 s requiere decisión explícita; no queda aceptado por este punto. |

Las tres evidencias Azure v1.2 contienen **29 intervenciones y cero motivos D registrados**. Aportan evidencia del comentarista real y de la composición; esos JSON no incluyen mediciones de audio o consumo Speech que certifiquen duración y presupuesto.

### Hallazgos nuevos

**1. [Mayor] La cuota limita invitados, pero todavía permite que provoquen 429 del narrador.**

**Archivo:** `src/arena/sesiones.ts:47–49`; constantes en `src/sim/limites.ts:764–768`.

La cuota de invitados es un máximo de consumo, no una asignación independiente que preserve la capacidad necesaria para los tramos restantes del narrador. Ambos consumen las mismas 80 solicitudes; solo dos quedan reservadas para cierres.

**Reproducción ejecutada con `rechazoCuotaVoz`:**

1. Reservar 16 audios invitados de 300 caracteres: admitidos dentro de cuota.
2. Solicitar 74 audios ordinarios del narrador de 250 caracteres.
3. Comparar con el mismo recorrido sin invitados.

| Resultado | Sin invitados | Con invitados |
|---|---:|---:|
| Tramos del narrador admitidos | 74 | 62 |
| Cierre de 335 caracteres admitido | Sí | Sí |

Los caracteres caben; los invitados causan **12 rechazos adicionales por solicitudes**. Intercalar las primeras reservas durante el partido conserva el problema.

La prueba de 180 s ES+EN (`src/arena/__tests__/mesa-voz.test.ts:397–403`) solo exige rechazos sin invitados y éxito de cierres: **no compara los rechazos adicionales causados por invitados**.

**2. [Mayor] El rollback del mismo tick altera una emisión periódica posterior y puede omitir un dato.**

**Archivos:** `src/arena/mesa.ts:60–62,75–76`; `src/arena/estadista.ts:175–181,208–210`.

`evaluar()` sigue ejecutándose fuera de la cola. Además, comparar únicamente el valor del temporizador no distingue dos escrituras en el mismo tick.

**Reproducción ejecutada**, con el fixture `arena-reinicios-v4.json` y publicación retenida:

1. Componer una ronda en tick 367 con dato `marcador`; retener su publicación.
2. Forzar evaluación del estadista en ese mismo tick mediante un disparo de cambio.
3. Rechazar la publicación retenida.
4. Dejar terminar la publicación periódica encolada.

Resultado observado:

- El periódico publica `cambios` y `remates`; no incluye `marcador`, consumido provisionalmente por la ronda fallida.
- `marcador` vuelve a quedar pendiente.
- `ultimaCandidaturaTick` termina en **0**, aunque el periódico acaba de publicarse en **367**.

La prueba concurrente existente usa ticks diferentes y otro valor del tema; no cubre esta igualdad. Hace falta incluir la evaluación y su estado en la transacción serializada, o identificar las escrituras con una revisión que permita restaurar exclusivamente la propia.

**3. [Menor, validación] La prueba intercalada no comprueba los cierres con invitados en todos sus recorridos.**

**Archivo:** `src/arena/__tests__/mesa-voz.test.ts:390`.

La expresión `sin.estado.get(k) ?? con.estado.get(k)` devuelve siempre el estado de `sin` cuando la clave existe en ambos mapas.

**Reproducción:** hacer fallar únicamente el cierre de `con` en 60 o 120 s. Esa aserción seguirá leyendo el 200 de `sin`. Debe comprobar cada recorrido por separado.

### Cola y elección B13

No encontré un ciclo de espera entre la cola de Mesa y la del diario: el publicador de Mesa escribe directamente mediante `GestorSesiones.publicar`. Una publicación retenida bloquea las posteriores y puede detener un avance que espera al estadista; es espera por almacenamiento, sin evidencia de un deadlock autónomo. El problema reproducido es la modificación del estado **fuera de la cola**, no su encadenamiento de promesas.

B13 está corregido: `src/arena/turnos.ts:65,82–85` conserva la candidata anterior cuando la nueva solo está pendiente y busca una variante elegible. La prueba en `turnos.test.ts:143` cubre descarte y selección. No identifiqué una regresión nueva de ese caso.

### Decisión sobre 180 s ES+EN

**Es un bloqueo para cerrar el brief tal como está escrito.**

Que el narrador solo ya exceda 24.000 caracteres demuestra un límite previo; no demuestra que los invitados sean inocuos. La reproducción nº 1 muestra que pueden agravar el agotamiento. V1.2 exige explícitamente proteger narrador y cierre en 60, 120 y 180 s ES+EN.

Puede aceptarse como límite de producto mediante una decisión explícita que ajuste el alcance y el criterio de aceptación. Un comentario en constantes y una prueba que espera agotamiento no sustituyen esa decisión. Incluso aceptándolo, seguirían pendientes la protección frente al gasto adicional de invitados y el rollback concurrente.

**NO CERRADO** por los hallazgos 1 y 2.