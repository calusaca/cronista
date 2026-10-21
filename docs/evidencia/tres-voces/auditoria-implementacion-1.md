# Auditoría adversaria de la implementación del brief 045 (iteración 1)

Agente `auditor-adversario` (Opus), 21 oct 2026, sobre el árbol sin commit. Scripts de
reproducción fuera del repo; árbol restaurado y comprobado con md5 tras 11 mutaciones.

**Veredicto:** no listo para ✅; nada bloqueante.

| # | Severidad | Hallazgo |
|---|---|---|
| 1 | Mayor | Una oración del comentarista verificada pero larga (549 caracteres con un LLM simulado que repite el hecho) salta `maxCaracteresIntervencion`: `relatoIntervencion` recorta a una oración sin limitar su longitud. El consumidor guarda ese texto en la memoria y la ruta de relato rechaza `memoria[].texto` > 500 con 400, lo que deja sin voz la emisión hasta que el recuerdo caduca. |
| 2 | Menor | Ninguna prueba exige el mismo `jugador` en el gol de «a puerta» (mutación M7 en verde). |
| 3 | Menor (diseño) | `reloj` cambia en cada vencimiento y ocupa siempre una de las dos plazas del estadista: en 20 semillas de 120 s, `cambios`, `reinicios` y `pases` no aparecen nunca. |
| 4 | Menor | En el camino de error de la sesión no se espera la generación del comentarista en curso; la candidatura se pierde y `comentaristas` queda incrementado. |
| 5 | Menor | No hay presupuesto LLM compartido con el narrador; el comentarista tiene su tope propio. |
| 6 | Menor | `catalogoVoces` no guarda en caché un fallo: cada consulta reintenta con hasta 5 s de espera. |
| 7 | Menor | Cesiones no filtradas por rol («Ana Cedeño, con el dato.»); cesión dependiente de la memoria de cada espectador; un invitado listo salta también la `entrada` de prioridad 10; apoyo del estadista sin eventos queda sin intervalo ni fuente. |
| 8 | Menor | En el replay guardado las intervenciones se muestran pero no suenan (`ArenaNarracion` no las recibe). |

Mutaciones: 10 de 11 rompen una prueba (quitar `fuenteActiva`, atajada por lado, `tiro_fuera`
como remate, datos sin cambio, evidencia sin intervalo, comentarista sin verificar, sin bloqueo
de `generando`, sin rearme, sin tope); la del gol sin jugador queda en verde.

Verificado y conforme: coordinador de turnos y su cableado (antes de reservas, memoria solo al
arrancar, exención de atraso sin `cerrando`, `finUltimaNoticia` solo con prioridad ≥ 35),
conteos del estadista sobre fixtures v1/v2/v3, respaldos del comentarista (12.045 casos, 0
fallos), candidaturas una sola vez, 404 y ventana estricta en la ruta, SSML con uno o dos
`<voice>`, degradación de voces, Mesa con tres tarjetas y sin cifras normativas a mano.
