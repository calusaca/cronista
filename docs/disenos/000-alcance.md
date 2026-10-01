# 000 — Alcance cerrado

**Fecha:** 2026-09-30 · **Responsable:** Fable · **Estado:** cerrado

## Contexto

Hackathon "Inside the Game" (Microsoft × Premier League). Reto textual: construir
aplicaciones y agentes de IA que transformen eventos sintéticos de fútbol en
**"explainable match intelligence"**. Carlos pidió pocos requisitos hechos muy bien
en vez de muchos a medias, y delegó la decisión de alcance.

## Decisión

Atacar la palabra **"explicable"**. La mayoría de las entregas van a ser un LLM que
escribe resúmenes sin garantía de fidelidad. CRONISTA garantiza que **cada frase de la
crónica es trazable a los eventos que la respaldan**, y la UI lo demuestra con un clic.

## Los tres pilares (esto se hace excelente)

### 1. Simulador de partidos sintéticos (brief 001)
Motor determinista con semilla que produce un stream de eventos JSON futbolísticamente
creíble. Es la base de todo, es 100 % local y testeable, y de regalo cubre el caso de
uso "expand datasets for AI and analytics" del hackathon (el simulador ES un generador
de datasets).

### 2. Cadena de agentes con verificación (briefs 002–003)
- **Analista** — código determinista (no LLM): detecta momentos clave, rachas,
  patrones tácticos y cifras del partido a partir de los eventos. Salida: hechos
  estructurados con referencia a los IDs de evento que los sustentan.
- **Cronista** — LLM vía Azure AI Foundry, orquestado con Microsoft Agent Framework:
  redacta la crónica ES y EN usando SOLO los hechos del Analista, citando el ID de
  cada hecho usado.
- **Verificador** — contrasta cada frase emitida contra los hechos citados; una frase
  sin respaldo se rechaza y el Cronista reintenta. Nada sin respaldo llega al lector.

### 3. UI de explicabilidad (brief 004)
Next.js. Línea de tiempo del partido + crónica bilingüe. **La interacción estrella:**
clic en cualquier frase de la crónica → se resaltan en la línea de tiempo los eventos
exactos que la respaldan. Una sola interacción, pulida de verdad.

## El factor que destaca (pedido de Carlos, 2026-09-30)

- **Comprometido — la Caja de cristal (brief 006):** junto a cada frase, «cómo se
  escribió»: borrador, rechazo del Verificador con su regla, feedback y corrección.
  *"Glass box, not black box."* Es la prueba viviente del sistema multi-agente y
  nadie puede fingirla sin tenerla.
- **Stretch prioritario — Partido en vivo:** replay acelerado donde los eventos
  entran minuto a minuto y la crónica crece con actualizaciones verificadas antes de
  publicarse. Cubriría un tercer caso de uso oficial ("analyze match events in real
  time"). Si entra, evaluar también el **export de overlay** (endpoint JSON con las
  actualizaciones verificadas, con minutado): las reglas §4.1 mencionan
  explícitamente salidas "timed and machine-readable" para overlays de broadcast —
  sería el guiño al caso studio/streaming a costo casi nulo sobre el modo en vivo.
  **Go/no-go el 12 de octubre** (antes que los demás stretches porque toca
  la arquitectura del Analista: analizar prefijos de eventos, que ya es compatible
  con su diseño de función pura). Si entra, abre el video.

## La quinta etapa: personalización (2026-09-30, lectura completa de las reglas)

La tubería oficial del reto es Ingest → Interpret → Explain → Render →
**Personalize**, y las reglas advierten: «a Project that only generates metrics
has no audience». El Grand Prize pide experiencias personalizadas explícitamente.
Se revierte el descarte original: personalización **comprometida y acotada** en el
brief 007 (modo Aficionado/Analista, modo «mi equipo», ES/EN como idioma), bajo el
principio de que se personaliza selección, orden y tono — jamás la verdad: todo
pasa por el mismo Verificador.

Otros hallazgos de la lectura completa (2026-09-30):
- La categoría Multi-Agent acepta «another supported orchestration approach»: la
  cadena TS propia califica por sí sola bien demostrada; el sidecar AF queda como
  bonus genuino, no requisito.
- «Creativity and optimized synthetic data creation» es rubro puntuado del criterio
  técnico: el simulador auditado se luce en README y video, no se esconde.
- La demo debe quedar accesible a jueces hasta el **10 de noviembre**; las entregas
  son visibles para todos los participantes; el video no puede llevar música con
  copyright; todos los materiales en inglés.
- Juicio en dos etapas: la 1 es pass/fail de encaje con tema y tecnologías.

## Lo que NO se hace (y no se discute sin reabrir este brief)

- Tiempo real / streaming de partidos en vivo.
- Personalización más allá del alcance del 007 (perfiles persistentes, cuentas,
  recomendaciones).
- Integración enterprise (Fabric, M365, dashboards corporativos).
- Infraestructura pesada (AKS, microservicios). El deploy de la demo es lo mínimo
  que funcione bien (Azure Container Apps o Static Web Apps, se decide en el 005).
- Más idiomas que ES/EN.
- Audio, video generado, avatares.

## Mapa contra los 5 criterios del jurado (20 % cada uno)

| Criterio | Con qué se cubre |
|---|---|
| Technological Implementation | Simulador con suite de invariantes + estadística; costura LLM limpia |
| Agentic Design & Innovation | Cadena Analista→Cronista→Verificador; el Verificador es la innovación |
| Real-World Impact | Crónicas fieles y bilingües = problema real de medios deportivos |
| User Experience & Presentation | La interacción frase→eventos; video de 2 min centrado en ella |
| Adherence to Category | Multi-Agent System con Agent Framework, literal |

**Categoría objetivo:** Best Multi-Agent System ($1,500 por persona) + opción a Grand Prize.

## Orden de prioridad ante conflictos (decisión de Carlos, 2026-09-30)

Se intenta que todo quede excelente, pero si perfeccionar una pieza le quita calidad a
otra, se sacrifica en este orden (lo de abajo cede ante lo de arriba):

1. **Lo que el juez ve en 2 minutos**: la crónica bilingüe y el clic frase→eventos.
   Es el escaparate de todo; una garantía invisible no puntúa.
2. **Que el Verificador sea real, no teatro**: cada frase de verdad contrastada contra
   los eventos. Si se descubre que es decorado, perdemos la credibilidad entera.
3. **Simulador creíble y determinista**: suficientemente bueno (invariantes verdes,
   partidos que parecen partidos). "Perfecto" aquí no paga: el juez no va a auditar
   la distribución de goles.
4. **Todo lo demás**: elegancia del deploy, más tipos de evento, más estadísticas,
   detalles visuales secundarios. Primera fila de sacrificio.

Regla práctica: ante la duda, se pule lo que sale en el video.

## Calendario

Actualizado 2026-09-30: las reglas permiten crear el proyecto desde el 29 sep
(inicio del registro), así que el código arranca de una y ganamos una semana.

| Semana | Fechas | Qué |
|---|---|---|
| 0 | 30 sep | Diseño completo (briefs 000–005) ✓ + arranque del código |
| 1 | 30 sep – 5 oct | Simulador + Analista, todo local con tests (briefs 001–002) |
| 2 | 6 – 12 oct | Cronista + Verificador (con stub) + UI (003–004). Carlos: cuenta Azure el 6 |
| 3 | 13 – 19 oct | Foundry real, integración, pulido; go/no-go de stretches (replay 2D, sidecar AF) |
| 4 | 20 – 26 oct | Deploy, video, pitch (005); meta interna de entrega: 26 oct |
| — | 27 oct | Cierre oficial 11:59 PM PT |

## Entregables del hackathon (checklist)

- [ ] Registro antes del 20 oct (Carlos)
- [ ] Proyecto funcionando con acceso para jueces
- [ ] Repo público en GitHub
- [ ] Video demo ≤ 2 minutos
- [ ] Elevator pitch (qué se construyó, qué tecnología Microsoft se usó)

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Cuenta/crédito Azure se atrasa | Toda la cadena corre contra stub determinista; Foundry se enchufa en semana 2 |
| Foundry/Agent Framework con fricción | La costura `llm.ts` permite degradar a Azure OpenAI directo sin tocar agentes |
| El Verificador rechaza demasiado | El Cronista recibe los hechos ya masticados; reintento máx. 2, luego frase se omite |
| Video de 2 min queda flojo | Se guioniza en el brief 005 alrededor de la interacción estrella, no de features |
