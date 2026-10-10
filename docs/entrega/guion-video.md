# Guion del video — palabra por palabra (máx. 1:50)

**Estado:** borrador listo para ensayar. Se congela cuando existan (a) la
cifra real de la eval y (b) el momento de rechazo REAL cazado con el LLM de
Foundry (lunes 6). **Regla dura:** el rechazo del video tiene que ser un
rechazo real del Verificador a prosa real del LLM — jamás fabricado ni del
modo ensayo. Cero features no entregadas. Sin música con copyright (silencio
o voz sola). Todo en inglés con subtítulos EN.

**Revisión del 10 oct:** la [sonda del verificador](../evidencia/verificador-2026-10-10.md)
demuestra que pasar V1–V8 no prueba toda afirmación posible. El guion describe
esas reglas y sus límites; no usar «cero alucinaciones» como conclusión de la
eval actual. La grabación de Foundry y el despliegue Azure siguen pendientes;
el diagrama y la voz finales deben nombrar solo tecnologías realmente usadas.

Narración total: ~240 palabras ≈ 1:45 a ritmo calmado. Ensayar con
cronómetro; si pasa de 1:48, cortar del tramo 0:55–1:10 (los toggles).

| Tiempo | En pantalla | Voz (exacta) |
|---|---|---|
| 0:00–0:08 | Crónica de IA genérica (maqueta propia, rotulada "AI recap — unverified") con un dato falso resaltado en rojo: un minuto que no coincide con la línea de tiempo al lado. | AI match reports have a problem nobody can see: they make things up. A wrong minute. A goal that never happened. And readers can't tell. |
| 0:08–0:15 | Corte a CRONISTA. La portada con el titular y el badge real de verificación. | This is CRONISTA. Every published sentence passes our defined checks, with evidence you can inspect. |
| 0:15–0:40 | **EL MOMENTO DEL RECHAZO** <!-- PLACEHOLDER: semilla y frase reales del LLM de Foundry -->. Caja de cristal abierta: el borrador del Writer con la frase marcada, la regla (p. ej. V3) y el evento real al lado; luego la reescritura aprobada. | Watch it work. The Writer — a large language model on Microsoft Foundry — just wrote this sentence. The Verifier checked it against the events… and blocked it: [PLACEHOLDER: leer el motivo real, p. ej. "that number appears nowhere in the match"]. It sends the error back, the Writer retries, and only a sentence that passes the checks gets published. |
| 0:40–0:55 | Clic en una frase de la crónica → los eventos que la respaldan se resaltan en la línea de tiempo. Clic en una nota de jugador → desglose. | Every sentence is a claim you can check: click it, and the evidence lights up. Even player ratings unfold into the exact events that earned them. |
| 0:55–1:10 | Toggle EN→ES, Fan→Analyst, perspectiva «mi equipo». Luego el modo liga: tabla, suspensiones, clima en la cabecera. | Fans in any market: two languages, fan or analyst view, your team's perspective — the story adapts, the facts never do. It runs a living league: suspensions carry over, and when the chronicle says the heat told, the drop was measured in that match. |
| 1:10–1:25 | La pizarra del gol 2D → botón 3D: el diorama con el gol de media cancha (46 m) volando hasta el palo. | Every goal becomes a tactics board — in 3D if you like. Only the ball moves, because only the ball's path is in the data. We never animate what we didn't record. |
| 1:25–1:40 | Diagrama con etapas deterministas y Writer LLM; nombrar backend y hosting comprobados al grabar. 5 s del simulador: `npm run sim` + cifra real del dataset. | Under the hood: Simulator, deterministic Analyst, Writer on [PLACEHOLDER: backend real], deterministic Verifier. Tested by over a thousand checks, on fully synthetic data with statistically validated match events. |
| 1:40–1:50 | Cifra real de hallazgos V1–V8 del baseline, con backend y muestra. Nota visible: «Rule checks have limits; independent audit: [PLACEHOLDER: resultado real]». Reconciliar contra el reporte antes de grabar. | [PLACEHOLDER: X] percent of baseline sentences failed our defined checks. Every published sentence passed. The checks have limits, so we also inspect the evidence. CRONISTA: personalize the story. Never the truth. |

## Checklist antes de grabar

- [ ] Cifra real de la eval en el tramo final (de `npm run eval` con Foundry).
- [ ] Métrica y limitaciones rotuladas; cualquier resultado de auditoría independiente existe y está documentado.
- [ ] Backend y hosting del diagrama coinciden con la demo pública.
- [ ] Semilla del rechazo real elegida y ensayada (el motivo se lee EN VOZ).
- [ ] La crónica falsa del arranque es maqueta PROPIA rotulada — ningún medio
      real, ninguna marca.
- [ ] Pantalla a 1280, tema claro, cursor visible y lento.
- [ ] Cronómetro: ≤ 1:50 con margen (los jueces cortan a 2:00).
- [ ] Ver el video terminado contra la regla §4.3: todo lo mostrado funciona
      tal cual en la demo pública.
- [ ] Subtítulos EN quemados o del reproductor; sin música.
- [ ] Prueba del espectador frío ANTES de publicar (005 §prueba fría).
