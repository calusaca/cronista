# CRONISTA — Inside the Game Hackathon (Microsoft × Premier League)

Agente multi-etapa que convierte eventos sintéticos de fútbol en crónicas bilingües ES/EN
**verificables**: cada frase del texto está respaldada por eventos concretos del partido.
El reto oficial pide "explainable match intelligence"; este proyecto ataca esa palabra.

Fuentes oficiales: [reglas, conducta, licencia, formación y seguridad](docs/hackathon.md).
Estado revisado y prioridades: [revisión del 10 de octubre](docs/revision-2026-10-10.md).
Las reglas V1–V8 no prueban toda afirmación de prosa libre: [reproducción](docs/evidencia/verificador-2026-10-10.md).

## Fechas duras (hora del Pacífico)

- **20 oct 2026, 12:00 PM** — cierra el registro (https://aka.ms/insidethegame).
- **27 oct 2026, 11:59 PM** — cierre de entrega (la ventana 6–27 oct es solo para
  SUBIR el proyecto a la plataforma).
- Regla verificada en las OFFICIAL RULES (2026-09-30): «Projects must be newly
  created by the Entrant after the start of the Hackathon Registration Period»
  (29 sep 2026, 9 AM PT). Todo lo creado aquí es posterior, así que **se programa
  desde el 30 de septiembre**. El historial de git fecha la evidencia.

## Reglas del evento que nos atan

- El dataset debe ser sintético. Por decisión de este proyecto, todo dato sale del
  simulador y los equipos/jugadores son ficticios; no usamos metraje real. Las reglas
  permiten material audiovisual ajeno si se tienen los derechos necesarios (§4.7).
- Entrega: repo **público** en GitHub + video demo < 2 min + elevator pitch corto +
  acceso para que los jueces prueben el proyecto.
- Tecnología implementada: adaptadores **Microsoft Foundry** y **Azure OpenAI**, aún
  pendientes de evidencia de ejecución real. La orquestación actual es TypeScript
  propia; **Microsoft Agent Framework no está implementado**. Todo acceso a LLM pasa
  por una sola costura (`src/lib/llm.ts`); en desarrollo corre un stub determinista.
- Categoría objetivo: **Best Multi-Agent System**, optando también al Grand Prize.

## Alcance

Base en `docs/disenos/000-alcance.md`, ampliada por los briefs 006–028. Tres pilares:
simulador determinista, cadena Analista→Cronista→Verificador y UI de explicabilidad.
Ya existen personalización, replay incremental, overlay JSON, ligas, condiciones,
consecuencias, pizarra 3D y exportación de dataset. El replay es simulado, sin un feed
externo en vivo. No hay Fabric ni AKS y los idiomas son ES/EN. No se agrega alcance
sin actualizar el diseño correspondiente.

## Forma de trabajo

- Fable diseña y verifica; Opus implementa por brief cerrado en `docs/disenos/`
  (numerados 001, 002, …). Máximo 3 iteraciones por hallazgo; luego se escala a Carlos.
- `BITACORA.md`: tabla `Fecha | Fase | Entrada | Responsable | Estado` más la sección
  «Deudas conocidas (honestas)». ✅ solo con `npm test` o smoke **visto correr**.
- El Analista (detección de momentos clave y patrones) es **código determinista con
  tests, no un LLM**. El Verificador rechaza los incumplimientos de V1–V8; una
  afirmación fuera de las reglas mantenidas puede pasar y debe declararse como límite.
- Stack: Next.js + TypeScript, local-first. Azure aparece solo detrás de la costura LLM
  y en el despliegue final de la demo.
- Los umbrales estadísticos del simulador viven en un único archivo comentado
  (`src/sim/limites.ts`); ninguna prueba repite esas cifras a mano.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
