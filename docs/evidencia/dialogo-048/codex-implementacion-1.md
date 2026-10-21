# Revisión de Codex de la implementación del brief 048 (iteración 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 21 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.**

Revisión estática del diff y los tres archivos nuevos, tomando la versión 1.1 como normativa. No modifiqué archivos ni repetí las suites o las mutaciones; los resultados verdes y el 24/25 son datos del implementador. Las reproducciones siguientes describen casos que faltaría ejecutar como pruebas.

1. **[Mayor] La excepción del 045 también permite arrancar intercambios nuevos que no caben.**  
   **Archivo:** `src/arena/turnos.ts:51`; origen en `src/arena/dialogo.ts:210`.

   `breve.estado === "inexistente"` permite arrancar la completa sin consultar la ventana. Pero ese estado representa tanto diarios antiguos como intercambios del 048 cuyas variantes quedaron iguales tras la escalera. `CandidataTurno` no permite distinguirlos.

   **Reproducción:** componer una intervención del 048 que colapse a cesión y primera oración; suministrar su audio válido de 10 s y `ventanaS: 0` o `1`. `varianteElegible` devuelve `"completa"`, aunque ninguna variante cabe. Esto rebasa la excepción de compatibilidad del punto 2 y contradice la selección del punto 1.

   Conservar el comportamiento del 045 es defendible para diarios antiguos; extenderlo a cualquier intervención sin `turnosBreve` no queda autorizado por esa compatibilidad.

2. **[Mayor] Publicar y confirmar memoria no están serializados entre las dos voces.**  
   **Archivo:** `src/arena/mesa.ts:38`, `:44`, `:46`, `:57` y `:83`.

   La composición lee la memoria antes del `await publicar`, pero solo la confirma después. Mientras una publicación del estadista espera almacenamiento, puede resolverse el LLM del comentarista y componer otra intervención desde la misma memoria anterior. La cola de `GestorSesiones` ordena la escritura (`src/arena/sesiones.ts:71`), pero no incluye composición y confirmación.

   **Reproducción:** retener la promesa de publicación de un estadista; resolver entretanto una generación del comentarista que produzca una ronda; dejar terminar ambas publicaciones. Las dos composiciones pueden tratar al estadista como aún no presentado y elegir plantillas sin considerar la intervención precedente del diario.

   Confirmar después de publicar es correcto, pero hace falta serializar la operación completa. Las pruebas actuales usan publicaciones inmediatamente resueltas y no cubren este entrelazado.

3. **[Mayor] El rollback del dato puede borrar emisiones posteriores válidas.**  
   **Archivo:** `src/arena/estadista.ts:202` y `:205`; uso en `src/arena/mesa.ts:43`.

   `registrar` devuelve un rollback que restaura incondicionalmente el valor y temporizador anteriores. Durante el `await publicar`, `avanzar` puede ejecutar otra evaluación del estadista. Si después falla la publicación de la ronda, el rollback sobrescribe ese estado más reciente.

   **Reproducción:** registrar una ronda y retener su publicación; avanzar hasta una emisión periódica o un `cambio` con un valor nuevo del mismo tema; rechazar la publicación retenida. El rollback restaura `ultimos` y `ultimaCandidaturaTick` anteriores, permitiendo repetir un dato ya emitido y alterando su cadencia.

   La prueba de fallo en `src/arena/__tests__/mesa.test.ts:390` demuestra rollback aislado, no rollback concurrente. La decisión de registrar antes y deshacer después necesita exclusión o una restauración que respete actualizaciones posteriores.

4. **[Mayor, validación] La prueba de presupuesto evita el orden que debe proteger.**  
   **Archivo:** `src/arena/__tests__/mesa-voz.test.ts:350`, especialmente `:355`.

   Se sintetizan **todos los tramos del narrador antes de los invitados**. Luego se comprueba un cierre español. Esto demuestra que queda presupuesto para ese cierre después de haber pagado por adelantado el relato ordinario; no demuestra que los invitados dejen presupuesto para el narrador pendiente durante el partido.

   **Reproducción de la carencia:** intercalar peticiones como el consumidor real —apertura, tramos, invitados y tramos posteriores—, en ambos idiomas, y exigir éxito de los tramos restantes y cierres. Ese recorrido no está probado.

   Los límites 2400/6 están correctamente conectados al presupuesto de SSML, pero siguen siendo una calibración pendiente: `src/sim/limites.ts:759` los declara “por validar en el smoke”. En `docs/evidencia/dialogo-048/` solo está la revisión del brief; no encontré evidencia nueva de audio real que valide duración o reservas.

5. **[Menor] La petición de la completa ignora noticias pendientes que sí anulan la ventana de selección.**  
   **Archivo:** `src/ui/ArenaEmisionBuffer.tsx:184`.

   Al seleccionar qué audio arrancar se pasa `noticiaPendiente`; al decidir si se sintetiza la completa, no. Por tanto, ambas operaciones usan horizontes diferentes.

   **Reproducción:** noticia recién alcanzada, aún no vocalizada; siguiente noticia lejana; breve ya solicitada. La selección tiene ventana 0, pero la preparación puede pedir la completa y gastar Speech. El punto 9 exige pedirla solo cuando la ventana conocida la admite.

   No provoca por sí solo un arranque indebido con dos variantes, pero consume presupuesto que debía conservarse.

6. **[Menor, validación] El negativo D3 no demuestra que D3 rechace cualquier conector.**  
   **Archivo:** `src/arena/dialogo.ts:322`; prueba en `src/arena/__tests__/dialogo.test.ts:358`.

   D3 aún implementa la condición antigua: admite conceptualmente un conector si la oración cita en apoyo el dato del estadista anterior. Retirar las listas hace que ese conector falle por **D1**, porque su plantilla no existe; no garantiza un motivo D3.

   **Reproducción:** construir E → C con apoyo correcto al dato de E y un conector con plantilla inexistente. Se obtiene D1, pero la condición de `:325` no añade D3.

   La composición publicada sigue protegida por D1. La afirmación “D3 rechaza cualquiera” y la cobertura atribuida a esa regla son, sin embargo, incorrectas.

La comprobación de cada punto de la versión 1.1 queda así:

| Punto | Evidencia `archivo:línea` | Resultado |
|---|---|---|
| Alcance | `src/arena/dialogo.ts:145`, `:253` | Se componen las cuatro formas acordadas; `dato` queda rechazado. |
| 1. Estados y selección | `src/arena/turnos.ts:14`, `:37`, `:50` | Estados explícitos y validación de duración correctos; excepción excesiva del hallazgo 1. |
| 2. Variante efectiva / 045 | `src/arena/turnos.ts:139`; `src/arena/relato.ts:146`; `src/arena/__tests__/mesa-voz.test.ts:329` | Normalización y ruta compatibles. La prueba del consumidor utiliza su validador puro. |
| 3. Marcos neutrales | `src/sim/limites.ts:782`; `src/arena/dialogo.ts:29` | Sin familias `centro` o `secuencia`; marcos de repaso neutrales. |
| 4. Resolución y referencias | `src/arena/dialogo.ts:70`, `:76`, `:151`, `:287` | Genéricos obligatorios antes de repaso; referencia inicial al disparador. |
| 5. Horizonte conservador | `src/arena/turnos.ts:109`, `:120` | Noticias pendientes anulan la ventana dentro de su admisibilidad; límite exacto tratado explícitamente. Véase hallazgo 5. |
| 6. Composición única | `src/arena/relato.ts:155`; `src/arena/__tests__/mesa-voz.test.ts:306` | La ruta lee turnos materializados; comparación con diario útil. No reproduje M13. |
| 7. Dato de ronda | `src/arena/mesa.ts:82`; `src/arena/estadista.ts:193`, `:201` | Revalida valor y no toca `ultimaEmitidaTick`; rollback concurrente defectuoso. |
| 8. Duración | `src/arena/turnos.ts:130`; `src/arena/__tests__/mesa-voz.test.ts:270` | Estimación y rechazo real presentes. La prueba sintética demuestra la cota aritmética, no duración real de Speech. |
| 9. Speech | `src/app/api/arena/sesiones/[id]/relato/route.ts:37`; `src/arena/sesiones.ts:328` | Reserva por SSML y solicitudes implementada; recorrido de presupuesto insuficiente. |
| 10. Regresiones 045 | `e2e/arena-mesa.spec.ts:177`, `:206`; `src/arena/__tests__/mesa.test.ts:230` | Conservadas pruebas de corte, noticias continuas, respuesta tardía y cierre durante generación. Mutaciones no verificadas independientemente. |
| 11. Memorias | `src/arena/dialogo.ts:173`, `:231`; `src/arena/mesa.ts:46` | Ambas variantes parten del mismo estado; solo se confirman plantillas retenidas. Falta serialización entre publicaciones. |
| 12. Negativos / C12a | `src/arena/__tests__/dialogo.test.ts:323`, `:244`, `:188` | Hay negativos, agotamiento y conservación de primera oración. D3 tiene la limitación descrita; casos largos simulados no prueban por sí solos reverificación V1–V8. |
| 13. Procedimiento | `src/arena/ventanas-dialogo.ts:19`, `:37` | Procedimiento versionado y prioridades derivadas. Mantiene el tramo literal de 50 ticks en `:41`. |

Sobre las nueve decisiones del implementador:

| Decisión | Juicio |
|---|---|
| 1. Regla 045 sin breve | Aceptable para diarios antiguos; demasiado amplia para intercambios 048 colapsados. |
| 2. Constantes 0,4 / 2400 / 6 | Parámetros provisionales razonables; falta validación real y prueba de presupuesto intercalada. |
| 3. Retirar conectores | Coherente con el alcance; D3 no rechaza literalmente cualquiera. |
| 4. Pendiente anula ventana hasta 3 s | Correcto: coincide con los atrasos admisibles actuales del narrador. |
| 5. Breve en límite exacto | Correcto: excepción expresamente prevista por v1.1 §5. |
| 6. Estado `{completa, breve}` | Adecuado para variantes; insuficiente para distinguir compatibilidad 045 del colapso 048. |
| 7. Registrar antes y deshacer | Insuficiente sin serialización; hallazgo 3. |
| 8. Escalón 4 colapsa en breve | Correcto como deduplicación; activa indebidamente la excepción del hallazgo 1. |
| 9. M13 recompone | Es la mutación pertinente. La prueba compara materialización, pero no certifiqué su ejecución ni el resultado 24/25. |

Del **046** no encontré cambios del motor ni regresiones estáticas en centros o saques de manos; la calma incorpora correctamente las manos vigentes del portero. Del **047**, las tarjetas mantienen avatar y rol, y la conversación añade identificación por turno sin adelantar intervenciones posteriores al cursor. La ausencia de regresiones visuales completas depende de las pruebas de navegador reportadas.

**NO CERRADO** por la excepción de selección del 048, la concurrencia de publicación/memoria y el rollback que puede restaurar estado obsoleto.