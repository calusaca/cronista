# Revisión de Codex de la implementación del brief 045 (iteración 2, v3.1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 21 oct 2026, sobre el árbol sin commit con C1–C12. Informe íntegro:

**Veredicto: NO CERRADO.** Los seis hallazgos anteriores están resueltos según el alcance revisado de v3.1. Quedan tres incumplimientos: el replay admite invitados demasiado largos, su progreso no descuenta intervenciones omitidas y la ruta sigue validando una memoria que C2 exige ignorar.

Revisión estática del árbol sin commit, incluidos los archivos sin seguimiento. No modifiqué archivos ni ejecuté suites o mutaciones. Tomo como resultados aportados el typecheck verde, 1670/1670 unitarias, 46/46 e2e y la aceptación real de `maxLength` por Azure.

**Hallazgos anteriores**

| # | Estado | Evidencia |
|---|---|---|
| 1. Invitados sin audio en replay | Resuelto | `src/ui/Arena.tsx:251` entrega las intervenciones; `src/ui/ArenaNarracion.tsx:60` las solicita y `:79` las intercala en la pista. Hay e2e de reproducción y fallo individual. |
| 2. Presupuesto LLM compartido inexistente | Resuelto | `src/lib/llm.ts:103` reserva por invocación; `src/arena/sesiones.ts:123` envuelve una vez el modelo y lo comparte con ambos roles. |
| 3. Procedencia estadística perdida | Resuelto | `src/arena/narrador.ts:103` conserva los datos; `:118` copia sus citas. `src/ui/ArenaMesa.tsx:34` muestra principal, apoyos y procedencia. |
| 4. E2e aproximado | Resuelto respecto de C11 | `e2e/arena-mesa.spec.ts:29` comprueba cursor en arranques; `:230` espera toda la ventana de caducidad y `:246` comprueba continuidad. La v3.1 acepta expresamente noticias por ventana y duraciones del fixture. |
| 5. Prioridades normativas literales | Resuelto | `e2e/arena-mesa.spec.ts:25` toma reinicio y tiro de `PRIORIDAD_EVENTO_ARENA`. |
| 6. Pruebas insuficientes | Resuelto según C12 | `src/arena/__tests__/mesa-voz.test.ts:62` verifica el recorte real; las pruebas `C12b` y `C12c` de `estadista.test.ts` contrastan categorías y jugador. La prueba del consumidor con `start()` fallido se retira explícitamente del alcance. |

**Correcciones C1–C12**

“Demuestra” indica que las aserciones revisadas comprueban el comportamiento; no significa que haya ejecutado la mutación.

| Corrección | Código / aceptación | ¿La prueba citada lo demuestra? |
|---|---|---|
| C1. Longitud | **Cumple.** Esquema limitado y rechazo V1 posterior a V1–V8: `narrador.ts:109–113`, `:129`. | **Sí.** Comprueba dos intentos, longitud en el motivo, respaldo, esquema ES/EN, datos sobre fixtures y semillas, y relación entre constantes. |
| C2. Memoria y cesión | **Parcial.** Recuerdo con `texto=id`, peticiones sin memoria y cesión determinista cumplen. La ruta no ignora memoria inválida: hallazgo N3. | **Parcial.** El e2e controla los cuerpos y la prueba compara SSML/clave. La prueba HTTP solo envía memorias válidas; no detecta N3. |
| C3. Reloj sin plaza | **Cumple.** `estadista.ts:58`, `:153`, `:174`. | **Sí.** Veinte semillas, ninguna candidatura con reloj, presencia de remates, primera candidatura completa y rechazo explícito del reloj. |
| C4. Cierre | **Cumple.** `mesa.ts:22` y comprobación de vigencia antes de publicar; `sesiones.ts:179` cierra ambos productores antes de `terminada`. | **Sí.** Barrera unitaria y escenario integrado con escritura final fallida, modelo lento, otro encuentro y recuperación (`mesa.test.ts:258`). |
| C5. Presupuesto | **Cumple.** Reserva antes de delegar; ambos roles registran el error y usan plantilla: `llm.ts:103`, `narrador.ts:67`, `:135`. | **Sí para el contrato.** Envoltura, agotamiento en ambos roles e integración comprueban el límite. El caso llamado “plazo” simula una excepción, pero el incremento previo cubre también una llamada posteriormente cancelada. |
| C6. Caché de fallos | **Cumple.** `voz.ts:147–162` guarda `null` ante HTTP, excepción, JSON inválido o lista vacía. | **Sí para las ramas ejercitadas.** Comprueba fallo HTTP, transporte, lista vacía, vencimiento y caché de éxito. No prueba específicamente timeout y JSON malformado. |
| C7. Procedencia | **Cumple.** `narrador.ts:118–122`; `ArenaMesa.tsx:34–38`. | **Sí.** Comprueba copia de citas, unión de eventos y representación del apoyo y su fuente. |
| C8. Rol y apertura | **Cumple.** `relato.ts:149`; `turnos.ts` bloquea con `aperturaPendiente`; `ArenaEmisionBuffer.tsx:196` reúne los tres estados exigidos. | **Sí.** Recorre idiomas, roles y variantes; prueba pura del bloqueo y e2e con apertura más lenta que el invitado. |
| C9. Replay | **Parcial.** Inserción, petición, validación estructural y tramos de ancho cero cumplen. Faltan límite de duración y ajuste del total: N1–N2. | **Parcial.** Comprueba IDs, duración, transcript y fallo 503. En el fallo espera expresamente el total original, por lo que contradice el criterio “total − 1”. |
| C10. Constantes | **Cumple.** `e2e/arena-mesa.spec.ts:25`. | **Sí.** Los fixtures consumen directamente las prioridades exportadas. |
| C11. Cronología | **Cumple.** Instrumentación del reloj, ventana completa y ausencia de huecos de calma. | **Sí para el criterio revisado.** Las aserciones ya no dependen solo de que ningún invitado llegue a sonar. |
| C12. Pruebas | **Cumple.** Recorte a primera oración, reinicios por tipo y gol por mismo jugador. | **Sí.** Las aserciones distinguen primera/última oración, categorías con igual total y jugadores diferentes. |

**Hallazgos nuevos**

1. **Mayor — El replay reproduce invitados que deberían descartarse por duración.**

   **Archivo:** `src/ui/ArenaNarracion.tsx:89`, `:96`.

   La decodificación comprueba duración positiva y finita y un canal, pero no `VOZ_BUFFER.duracionMaxS`. `segmentoVozValido` tampoco comprueba duración. El consumidor en directo sí aplica ese límite en `ArenaEmisionBuffer.tsx:153`.

   **Reproducción:** en la tercera prueba de `e2e/arena-mesa.spec.ts`, devolver para un invitado un WAV mono de `VOZ_BUFFER.duracionMaxS + 1` segundos. El replay lo incorpora a `muestras`, duración y transcript; debería omitirlo y continuar. El límite global de tamaño de pista no sustituye al límite por intervención.

2. **Menor — El progreso conserva intervenciones descartadas en su total.**

   **Archivo:** `src/ui/ArenaNarracion.tsx:85`, `:97`, `:109`.

   `total` queda fijado a todas las piezas. Cuando un invitado falla, `continue` evita incorporarlo, pero no reduce el total. Una preparación terminada puede quedar, por ejemplo, en **7/8**.

   **Reproducción:** ejecutar el escenario 503 ya existente del replay. El propio e2e espera `data-progress-total = tramos + intervenciones.length` y `data-progress-ready = tramos + invitadosOk`. Esa expectativa deja verde el incumplimiento del criterio C9 de reproducir con “total − 1”.

3. **Menor — La ruta valida la memoria antes de poder ignorarla.**

   **Archivo:** `src/app/api/arena/sesiones/[id]/relato/route.ts:15`, `:17`.

   La memoria no participa en la síntesis del invitado, pero permanece dentro del esquema que se valida antes de entrar en la rama `intervencion`. Por tanto, todavía puede impedir obtener el clip.

   **Reproducción:** pedir una intervención publicada con ventana exacta y añadir `memoria: [{ tick: 1, texto: "x".repeat(501) }]`. La ruta devuelve **400**; la misma petición sin memoria puede devolver **200**. C2 exige ignorarla si llega. La prueba actual usa 400 caracteres y no distingue ambos comportamientos.

Respecto de los riesgos solicitados: `conPresupuesto` cuenta cada reintento que vuelve a invocar `completar`, incluso si falla; no contabiliza intentos internos de un transporte. En las rutas configuradas revisadas, Foundry se construye con `maxRetries: 0` y Azure hace una solicitud por invocación. Al agotarse, ambos roles registran el presupuesto en `audit` y pasan a plantilla.

No encontré una publicación posterior a `terminada`: las generaciones aún no publicadas quedan bloqueadas por las banderas y las ya encoladas preceden a `terminada` en `sesion.cola`. Tampoco encontré una regresión adicional en las cesiones por rol, `texto=id` o el cálculo de `aperturaPendiente`.

**NO CERRADO:** corregir N1–N3 y ajustar las pruebas que actualmente no los detectan. El smoke público y la medición de Speech exigidos por el brief tampoco quedan acreditados por esta revisión.