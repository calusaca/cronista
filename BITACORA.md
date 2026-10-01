# Bitácora — CRONISTA

| Fecha | Fase | Entrada | Responsable | Estado |
|---|---|---|---|---|
| 2026-09-30 | Diseño | Alcance cerrado en `docs/disenos/000-alcance.md`: tres pilares (simulador, cadena de agentes con Verificador, UI de explicabilidad), categoría objetivo Best Multi-Agent System | Fable | ✅ |
| 2026-09-30 | Diseño | Brief `001-simulador.md` cerrado: contrato, 12 propiedades verificables, umbrales centralizados en `limites.ts` | Fable | ✅ |
| 2026-09-30 | Diseño | Orden de prioridad ante conflictos agregado al 000 (decisión de Carlos: máximo todo, pero si choca, gana lo que ve el juez) | Fable | ✅ |
| 2026-09-30 | Diseño | Infraestructura de trabajo: agentes `opus-implementador` y `auditor-adversario` en `.claude/agents/`, skill `bitacora` en `.claude/skills/` | Fable | ✅ |
| 2026-09-30 | Diseño | Brief `002-analista.md` cerrado: 13 tipos de hecho, umbrales centralizados, fixtures + propiedades de corpus | Fable | ✅ |
| 2026-09-30 | Diseño | Investigación Agent Framework + Foundry entregada: AF sin SDK TS usable (npm stub 0.0.1-beta); Claude GA en Foundry vía Marketplace; dos trampas de cuenta (free trial cuota 0; el crédito no paga Claude) | investigador-foundry | ✅ |
| 2026-09-30 | Diseño | Brief `003-cronista-verificador.md` cerrado: cadena TS a mano, 6 reglas de verificación, modo acta, costura LLM con stub, sidecar AF opcional con timebox | Fable | ✅ |
| 2026-09-30 | Diseño | Decisión de Carlos: modelo barato por defecto (Sonnet 5 o Haiku 4.5); bake-off de prosa con 3 semillas antes de entregar | Carlos/Fable | ✅ |
| 2026-09-30 | Diseño | Briefs `004-ui.md` (interacción frase↔eventos, e2e Playwright del camino del juez) y `005-entrega.md` (cuenta Azure paso a paso, deploy, guion del video) cerrados. **Semana 0 completa.** | Fable | ✅ |
| 2026-09-30 | Diseño | Maqueta interactiva publicada para ver la interacción estrella con datos inventados (no es código del producto): https://claude.ai/artifact/9nmBqhWn5ovtbX9MFQT1yi | Fable | ✅ |
| 2026-09-30 | Diseño | Pedido de Carlos «ver cómo fue el gol»: tarjeta de momento con esquema de pizarra COMPROMETIDA en el 004 (prototipada en la maqueta, v2); repetición 2D animada como stretch con go/no-go el 19 oct; 3D con modelos descartado (inventaría trayectorias que los datos no respaldan) | Carlos/Fable | ✅ |
| 2026-09-30 | Diseño | Links del correo verificados: registro = Microsoft Innovation Studio (aka.ms/insidethegame, SPA — verificar en navegador con cuenta Microsoft); sesiones Reactor 14 oct (relevante, 10 AM CR) y 21 oct (opcional); playlists de estudio opcionales | Fable | ✅ |
| 2026-09-30 | Diseño | Regla de tiempos verificada en las OFFICIAL RULES: «newly created after the start of the Hackathon Registration Period» (29 sep). El código arranca HOY; calendario del 000 adelantado una semana | Fable | ✅ |
| 2026-09-30 | Implementación | git inicializado; brief 001 (simulador) lanzado a opus-implementador | Fable/Opus | ⏳ en curso |
| 2026-09-30 | Diseño | Pedido de Carlos «algo que haga decir: estos merecen el premio»: brief `006-caja-de-cristal.md` COMPROMETIDO (ver borradores, rechazos del Verificador y correcciones por frase; solo rechazos reales, jamás fabricados); «Partido en vivo» como stretch prioritario con go/no-go el 12 oct | Carlos/Fable | ✅ |
| 2026-09-30 | Implementación | Brief 001 implementado en `src/sim/` (tipos, limites, prng mulberry32, plantillas ficticias, motor de posesiones, verificadores puros, CLI). `npm test` 41/41 y `test:stats` 6/6 con N=1000 **corridos y vistos por Fable** (goles 2.855, xG 2.730, fuerte gana 63.0 %, amarillas 3.94, roja 12.5 %, estilos 1.55/1.25/1.22); smoke CLI semilla 42 revisado a ojo por Fable: se lee como fútbol. Mutaciones de control ejecutadas por Opus (prop. 3 en rojo) y revertidas | Opus/Fable | ⏳ pendiente de auditoría adversaria |
| 2026-09-30 | Auditoría | Auditor adversario sobre el 001: invariantes y determinismo entre procesos SÓLIDOS (13,293 partidos extremos, 0 violaciones); 1 hallazgo A (prueba de determinismo detecta mutación solo ~1/3 de las veces) y 7 B (tiro con doble desenlace indetectable, `cambio` sin `sale` hace invisible al sustituido fantasma, descuento del 2T sin prueba, límite de cambios como código muerto, fatiga/expulsión sin prueba, semillas que colisionan, NaN silencioso, CLI acepta flags malformados). Los 9 aceptados por Fable → revisión 1.1 del brief 001 | auditor-adversario/Fable | ✅ |
| 2026-09-30 | Implementación | Revisión 1.1 del 001 implementada en iteración 1: determinismo por hash del corpus en dos pasadas, props. 14–17, `cambio.sale`, semilla normalizada, config validada, xg NaN rechazado, CLI estricto. `npm test` 104/104 y `test:stats` 6/6 **corridos y vistos por Fable**; CLI de error y «entra X por Y» vistos. Mutaciones M1–M5 rojas (M2 demuestra el valor del hash de corpus: la semilla 7 sola no la atrapaba). Interpretación de fatiga (error defensivo) validada contra el texto del brief. **Brief 001 CERRADO** | Opus/Fable | ✅ |

## Deudas conocidas (honestas)

- **Registro en el hackathon pendiente** — Carlos, antes del 20 oct 12:00 PM PT en
  https://aka.ms/insidethegame.
- **Cuenta de Azure pendiente** — Carlos, **el 6 de octubre** (no antes: los $200
  caducan en 30 días). El día 1: upgrade a Pay-As-You-Go (free trial = cuota 0 en
  LLMs) y recurso Foundry en eastus2. El crédito NO paga Claude: la tarjeta verá un
  gasto pequeño (< $10 con Sonnet/Haiku). Detalle en `docs/disenos/005-entrega.md`.
- **Azure CLI no instalado** en la máquina (se instala cuando toque el deploy).
- Repo de GitHub (público) se crea cerca de la entrega; git local ya inicializado
  para fechar la evidencia de que todo es posterior al 29 sep.
- El descuento del primer tiempo queda sellado al minuto 45 (para no romper la
  monotonía con el arranque del segundo tiempo).
- `Evento.sale` es opcional en el tipo TS y obligatorio vía `verificarContrato`;
  una unión discriminada sería más estricta (se evalúa si algún consumidor tropieza).
- `atajada` lleva el equipo del tirador y no nombra al portero; el Analista debe
  resolver el nombre del arquero vía plantilla (posición POR) para `portero_destacado`.
- Umbrales fijados por Opus donde el brief callaba (GOLES_FRANJA, XG_MEDIA,
  AMARILLAS_MEDIA, ROJA_MAX/MIN, firma de presión⇒faltas): validados por Fable el
  30 sep al ver la suite, pero el auditor debe atacarlos.
