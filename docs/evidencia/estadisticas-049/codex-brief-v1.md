# Revisión de Codex del brief 049 (versión 1)

GPT-6.1 Sol vía `npx @openai/codex exec --sandbox read-only`, 22 oct 2026. Informe íntegro.

**Veredicto: NO CERRADO.** El brief tiene una base útil, pero aún contiene contradicciones y transiciones incompletas que permitirían implementaciones con cifras distintas y pruebas en verde. Revisión estática en solo lectura; no modifiqué archivos ni ejecuté pruebas.

1. **[Bloqueante] §2.1 y §7 — `final` contradice el contrato de prefijo.**  
   Se prohíbe leer `registro.final`, pero inmediatamente se exige usar `registro.final.tick` y `finalizado`. Además, el helper `prefijo` de `estadista.test.ts:13` reemplaza `final` por el último fotograma disponible: si el cursor alcanza la duración configurada entre dos fotogramas, el registro completo y su prefijo pueden producir distinto `final`.  
   **Corregir:** derivar el final exclusivamente de información visible: duración alcanzada o `final_anticipado`/fotograma finalizado con tick ≤ cursor. Probar igualdad de **todo** `CifrasEquipo`, incluido `final`, al terminar normalmente y por expulsiones.

2. **[Mayor] §2.2, §7 y §10 — El pase detenido está descrito contra el motor.**  
   `moverBalon` conserva el vuelo de un pase al llegar a destino; `recibir` genera `recepcion` si después lo controla un compañero, manteniendo al pasador en `receptor` (`motor.ts:566–580` y comentario al final de `moverBalon`). Por tanto, ese pase **sí cumple** la definición de completado. El brief exige lo contrario y propone probar una recuperación que esa trayectoria no genera.  
   **Corregir:** contar esa recepción como completado. Si se quiere distinguir un pase verdaderamente suelto, describir una secuencia que exista en el motor y su evidencia.

3. **[Bloqueante] §2.2 — La máquina no define el cierre completo de pases.**  
   `recepcion` e `intercepcion` dicen «cierra», pero no especifican limpiar el pase abierto; `recuperacion` no lo cierra; `pase` y `tiro` no explican qué ocurre con la otra acción abierta. Tampoco existe una definición exhaustiva de `resueltos`. Esto permite arrastrar un pase antiguo y atribuirle una intercepción o reinicio posterior.  
   **Corregir:** dar una tabla exhaustiva con estado anterior, condición de asociación, resultado, contadores y estado posterior. Enumerar qué resultados entran en precisión y separar cancelado, fallido y pendiente. Exigir que cada pase se resuelva como máximo una vez.

4. **[Mayor] §2.2 — Pérdidas y recuperaciones confunden toque, control y balón suelto.**  
   No se indica cómo inicializar la máquina desde `registro.inicial.balon.poseedor`: una primera desposesión puede desaparecer. Una atajada con desvío asigna `poseedor = portero`, aunque el motor deja `poseedor: null`; después se excluye también la recuperación, no solo la pérdida ficticia del portero. En v1/v2, un mismo vuelo puede generar desvío y luego intercepción, que la tabla cuenta siempre como recuperación.  
   **Corregir:** separar controlador efectivo, autor del vuelo y último toque. Definir expresamente las recuperaciones tras desvío por ambos equipos, en v1/v2 y v3/v4, y probarlas. Si se excluyen deliberadamente, precisar el nombre de la cifra y su alcance.

5. **[Mayor] §2.3 y §6 — La extracción amplía la regla de desenlace del 045.**  
   `rematesPorLado` (`estadista.ts:30`) solo interrumpe la búsqueda ante otro tiro o el primer `gol`/`atajada`/`tiro_fuera`. El nuevo helper añade cierres por recepción, intercepción y recuperación. Ya no es literalmente una extracción sin cambio de comportamiento: una intercepción seguida de un desenlace asociado al tirador puede producir resultados distintos. Además, un tiro terminado por reinicio puede quedar pendiente indefinidamente según el helper, mientras la máquina declara cerrarlo.  
   **Corregir:** separar la asociación histórica de «a puerta» de la clasificación nueva, o especificar una regla común y demostrar su equivalencia en las secuencias admitidas. Resolver explícitamente reinicios y fin de partido. Comparar también los ids de evidencia del estadista, no solo `aPuerta`.

6. **[Mayor] §1, §2.5 y §10 — Se mezclan versiones de registro con versiones de reglas.**  
   §1 reconoce faltas y amarillas en `arena-reinicios-v1`; §10 afirma que «registros v1 y legados» no las tienen. Son ejes distintos. La condición conjunta «sin entrenadores / sin reglas» tampoco sirve para todas las filas: puede haber árbitro con entrenadores y sin reinicios reglamentarios.  
   **Corregir:** definir capacidades por separado: faltas/tarjetas según simulación arbitral; esquinas según reglas de reinicio; centros según v4. Mantener los eventos existentes como fuente de verdad y distinguir «cero observado» de «no simulado».

7. **[Mayor] §2.4–2.5 — La posesión temporal necesita una definición de pausas y cobertura.**  
   La integral propuesta cuenta como posesión los segundos de pausa de un saque o falta, porque el ejecutor ya figura como poseedor. Solo integra pares completos hasta el último fotograma ≤ cursor, de modo que queda una cola temporal sin contabilizar. No es una fuga de futuro, pero la UI presenta tiempo al cursor sin explicar esa cobertura.  
   **Corregir:** decidir si incluye tiempo detenido, fijar el tratamiento de la cola y documentar el instante realmente cubierto. Probar pausas, expulsión del poseedor, ausencia del jugador y cursor entre muestras. La ponderación por ticks y la atribución del rechace al lado del remate sí coinciden con el modelo documentado.

8. **[Menor] §2.4 y §7 — Distancia y velocidad: las fórmulas son razonables, pero falta precisar sus límites.**  
   Saltar cualquier par con `cambio` descarta también la carrera válida de los otros jugadores. Saltar reinicios elimina recolocaciones, pero también el movimiento real del intervalo: la subestimación excede la suma de cuerdas. La prueba de velocidad formula una cota en m/s y dice comprobarla «en km/h», sin escribir la conversión.  
   **Corregir:** declarar el descarte conservador de intervalos o limitarlo por jugador y tipo de discontinuidad; escribir la cota con unidades y `kmhPorMps`. Mantener la velocidad máxima obtenida del vector muestreado, sin sustituirla por distancia entre fotogramas.

9. **[Mayor] §2.6 y §4.3 — «Goles esperados estimados» sigue prometiendo una probabilidad que el modelo no demuestra.**  
   El propio brief afirma que la fórmula solo ordena geometrías y no está calibrada. Sumar ese índice y llamarlo goles esperados, o aplicar un umbral para «grandes chances», no adquiere interpretación probabilística por añadir «estimado». Además, θ = 0 acaba dando `min = 0.02`, incluso sobre o detrás de la línea.  
   **Corregir:** para este alcance, renombrar a «índice geométrico de remate» y definir sus unidades, o retirar ambas filas. Si se conserva xG, justificar su interpretación y especificar casos degenerados y dominio. Sigue siendo P2.

10. **[Mayor] §3 — Falta cerrar el ciclo de persistencia e inicialización de favoritos.**  
    `leerFavoritos` devuelve vacío tanto si no hay favoritos como si falla el acceso; con esa firma la UI no puede distinguir el fallo para mostrar el aviso exigido. Tampoco se define cómo impedir que una escritura inicial vacía borre lo almacenado antes de completar la lectura. `ArenaInteligencia` conserva `modo` con `useState("fan")` y no se remonta al cambiar registro: cambiar solo su valor inicial no cumple la preselección al cargar otro partido.  
    **Corregir:** definir lectura, hidratación, estado de error y escritura posterior a acciones explícitas. Reinicializar selección y audiencia una vez por carga, sin sobrescribir elecciones manuales con cada actualización del directo. Probar también favorito suplente y fallo al obtener `window.localStorage`.

11. **[Mayor] §2.7 — La complejidad y el rendimiento prometidos no quedan demostrados.**  
    Buscar reinicios/cambios entre cada par puede costar O(fotogramas × eventos); sumar cifras llamando al cálculo individual por cada jugador añade otro factor. El brief no fija cómo evitarlo. «Muy por debajo de un milisegundo» carece de medición y el humo permite hasta 500 ms por 100 llamadas, además de no cubrir ficha, render ni actualizaciones de registro.  
    **Corregir:** exigir una agregación común por prefijo y recorrer ordenadamente muestras y discontinuidades. Retirar la afirmación temporal o respaldarla con medición. Comprobar que el cálculo no se repite en cada render de animación cuando el tick y el registro no cambian.

12. **[Mayor] §7 — Varias pruebas no garantizan las mutaciones anunciadas.**  
    - El valor del punto penal calculado desde la misma fórmula puede seguir verde al mutar una constante o copiar un error algebraico.
    - Quitar `clamp` no falla necesariamente con posiciones ordinarias: faltan entradas que activen ambos extremos.
    - Comparar UI con `cifrasEquipos` demuestra cableado, pero permite que ambos compartan un error.
    - Igualar `aPuerta` tras la extracción no protege la evidencia ni todos los cierres.
    - El selector `arena-player-stats[data-stat="remates"]` no coincide con el DOM exigido: `data-stat` está en un descendiente.

    **Corregir:** añadir casos discriminantes con resultados razonados independientemente, límites que activen el clamp y aserciones sobre evidencia y cierres. Mantener constantes normativas importadas, pero no convertir todos los resultados esperados en una repetición del algoritmo. Los desplazamientos sintéticos 3–4–5 y las cifras obtenidas del JSON son datos de prueba válidos, no cifras normativas a mano.

13. **[Mayor] §7–§10 — El cierre en un día tiene criterios incompatibles.**  
    P1 exige máquina completa, panel, ficha, favoritos, ES/EN, accesibilidad, contraste y regresión de arena. §10 permite recortar completados, pérdidas y recuperaciones, aunque siguen siendo obligatorios en §8 y en las pruebas. Además, exige `npm run lint`, pero `package.json` no contiene ese script.  
    **Corregir:** establecer una única entrega mínima y una hora de corte con criterios de aceptación coherentes; mover explícitamente lo recortable a otra prioridad. Corregir el comando de validación. No considerar cerrado un alcance cuya contingencia incumple su propio P1.

**NO CERRADO** hasta resolver, como mínimo, el contrato de prefijo, la máquina de acciones, la compatibilidad por capacidades y las pruebas de asociación. El recuento de esquinas por `reinicio: "esquina"`, fueras de juego por evento y atajadas por el lado del portero está bien encaminado; los problemas están en sus condiciones de disponibilidad y en la asociación entre acciones.