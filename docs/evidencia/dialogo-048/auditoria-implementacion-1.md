# Auditoría adversaria de la implementación del brief 048 (iteración 1)

Agente `auditor-adversario` (Opus), 21 oct 2026, en copias aisladas; ~3.770 intercambios en 50 semillas × 60 y 120 s,
cuatro modos de LLM simulado (fiel, adversario, mixto, ninguno) y fallos de publicación inyectados.

**Veredicto:** no cumple hasta corregir 1 y 2.

| # | Severidad | Hallazgo |
|---|---|---|
| 1 | Mayor | La pregunta «repasemos la amarilla a X» recibe una respuesta sobre otro hecho: el contexto del comentarista no admite tarjetas y `principalEsperado` cae al último hecho. 12 de 12 disparos por amarilla. También observado con Azure real (`dialogo-azure-real-v1.json`). |
| 2 | Mayor | La reserva de Speech no protege el cierre con peticiones en orden temporal: 120 s ES+EN con ambas variantes → 15/48 tramos del narrador y ambos cierres en 429. |
| 3 | Menor | El rollback del dato de la ronda tras un fallo de publicación puede restaurar un estado anterior a una emisión periódica posterior. |
| 4 | Menor | La forma `final` puede cerrar con «Seguimos» tras el pitazo; en 5 de 100 sesiones no hay forma `final`. |
| 5 | Menor | ~49 % de las rondas pierden el turno del estadista y quedan sin cierre del narrador. |
| 6 | Menor | La variante elegida insinúa si viene una noticia en ~20 s; no está declarado como límite. |
| 7 | Calidad | Mutantes supervivientes: unitarios A02, A03, A05, B13, D04, E04, F02; e2e G01, G03, G04. |

Cumple: 0 motivos D1–D5, 0 referencias futuras, 0 jugadores mal nombrados, 0 datos falsos, 0 oraciones que
fallen V1–V8 por separado; estimación de duración máxima 23,31 s (≤ 24 s, margen ~1,1 s); ruta sin recomposición;
compatibilidad con diarios del 045; ningún invitado caducado, solapado o tras el cierre.
