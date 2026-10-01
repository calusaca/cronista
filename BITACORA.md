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
