# 005 — Entrega: deploy, video y pitch

**Fecha:** 2026-09-30 · **Diseña:** Fable · **Ejecuta:** Opus (deploy) + Carlos
(cuenta Azure, grabación, registro) · **Semana 3** · **Estado:** cerrado

## Cuenta Azure (Carlos — el orden importa, sale de la investigación del 30-sep)

1. Crear la cuenta **el 6 de octubre, no antes**: los $200 de crédito caducan a los
   30 días y así cubren hasta la entrega.
2. **Upgradear a Pay-As-You-Go el día 1.** Una free trial tiene cuota **cero** para
   todos los LLMs aunque tenga los $200; el upgrade conserva el crédito restante y
   desbloquea las cuotas.
3. Saber de antemano: **el crédito NO paga Claude** (es oferta de Marketplace: se
   cobra a la tarjeta). Presupuesto real esperado: **menos de $10** con Sonnet/Haiku
   y la caché. El crédito sí paga el hosting (Container Apps).
4. Crear el recurso Foundry en **eastus2** (todas las variantes de Claude viven ahí)
   y verificar la página *Quota* apenas exista el recurso.
5. Alerta de presupuesto en Azure a $20: si suena, algo anda mal y se investiga.

## Deploy de la demo

**Azure Container Apps** (eastus2, mismo resource group): Dockerfile de Next.js en
modo standalone; `FOUNDRY_API_KEY` como secret de la app, jamás en la imagen ni en el
repo. URL pública para los jueces. Verificación honesta: abrirla desde una red
distinta a la de la casa (el puerto local ocupado ya nos mintió antes) y correr una
semilla nueva de punta a punta en producción.

Reglas §4.8 (verificadas 2026-09-30): el acceso para jueces debe mantenerse **hasta
el fin del Judging Period, 10 de noviembre** — el deploy y el presupuesto cubren
hasta esa fecha, no hasta la entrega. Las entregas son visibles para todos los
participantes del hackathon. Los jueces pueden evaluar solo con texto, imágenes y
video, así que la página del proyecto debe sostenerse sola sin la demo.

## Tecnologías GitHub (nota 2026-09-30, pregunta de Carlos sobre Copilot)

El criterio técnico lista «hero technologies» que incluyen GitHub Copilot Agent
Mode, GitHub CLI y GitHub SDK, junto a Foundry, Agent Framework y Azure. Copilot
NO es requisito: es un ítem de una lista donde ya usamos varios (Foundry para el
LLM, Azure para el deploy). Cobertura honesta de la parte GitHub:

- **GitHub CLI (`gh`)**: ya instalado; se usa de verdad para crear y administrar
  el repo. Está en la lista de hero technologies.
- **GitHub Actions (CI)**: workflow que corre `npm test` + `test:stats` + e2e en
  cada push del repo público. Además puntúa en «quality software development
  practices», que es rubro explícito del jurado.
- **Copilot code review (opcional, decisión de Carlos)**: si Carlos habilita
  Copilot (hay tier gratuito) en su cuenta de GitHub, se le pide revisión a los
  PRs del repo — uso real y citable.
- **Regla de integridad: el pitch y el README listan SOLO lo que usamos de
  verdad.** No se declara Copilot si no se usó. El stack real (Claude en
  Microsoft Foundry, cadena multi-agente propia, Azure Container Apps, GitHub
  CLI + Actions) ya cubre de sobra el criterio.

## Repo público (GitHub, se publica cerca de la entrega)

README en inglés: qué es, el diagrama de la cadena, cómo correrlo local **sin API
key** (modo stub — el juez técnico lo va a intentar), tecnologías Microsoft usadas,
licencia MIT. Antes de publicar: barrido de secretos en todo el historial de git.

## Video (máx. 1:50 — manda sobre todo lo demás, prioridad 1 del 000)

Estructura ajustada el 2026-09-30 con la investigación de jueces (los ganadores
tipo DELPHAI venden EL MOMENTO DEL RECHAZO, no la lista de features; los jueces
deciden en los primeros segundos y pueden cortar a los 2:00). En inglés, con
subtítulos. Guion palabra por palabra en `docs/entrega/guion-video.md` cuando la
UI exista:

| Tiempo | Qué se ve |
|---|---|
| 0:00–0:08 | El problema con un ejemplo: una crónica de IA inventando un dato en pantalla. |
| 0:08–0:15 | La solución en una frase: "Every sentence is verified against the match events before a reader sees it." |
| 0:15–1:20 | **Demo centrada en el rechazo**: el Cronista escribe → el Verificador BLOQUEA una frase con el evento real en pantalla (Caja de cristal) → la reescritura aprobada. Luego: clic frase→eventos, toggle ES/EN ("fans in any market"), pizarra del gol. |
| 1:20–1:40 | Diagrama de arquitectura con los servicios de Microsoft nombrados con precisión + 10 s del simulador sintético (criterio textual "optimized synthetic data creation", y es el PRIMER criterio de desempate). |
| 1:40–1:50 | **La cifra** de la eval comparativa (abajo) y cierre: "Personalize the story — never the truth." |

Graba Carlos (OBS o similar, pantalla + voz en inglés leída del guion o subtítulos
EN sobre voz ES — se decide al grabar). Reglas: **cero features en el video que no
estén entregadas** (§4.3 exige que el proyecto funcione «as depicted in the
video»); **sin música con copyright ni marcas de terceros** (§4.4) — silencio, voz
o música libre verificada; todos los materiales de la entrega **en inglés** (§4.9).

## La cifra: eval comparativa un-agente vs pipeline (de la investigación de jueces)

La categoría Multi-Agent pide demostrar «an end-to-end outcome a single agent
could not achieve as effectively» — una cifra lo prueba, un adjetivo no (DELPHAI
ganó con evals reproducibles). `npm run eval` (corre con el LLM real, semana 3):
- Baseline: el Cronista solo, sin Verificador — se publica su primer intento.
- Pipeline: la cadena completa.
- Métrica sobre N=20 semillas: frases con motivos (según el Verificador) que
  llegarían al lector en cada caso. Pipeline = 0 por construcción; el baseline da
  la cifra del titular («X % of unverified sentences contained unsupported
  claims»). Resultado reproducible, en el README, costo en centavos con caché.

## README (orden de los ganadores: RiskWise, DELPHAI)

1. Frase gancho + GIF del momento del rechazo + «Try it live» + video, arriba.
2. Diagrama de arquitectura (Mermaid).
3. **Tabla de agentes contra las 5 exigencias de la categoría** (roles
   distintos / estado compartido / traspasos / recuperación de fallos / qué no
   lograría un agente solo) — la etapa 1 y el 20 % de Adherence se juzgan contra
   ese texto exacto.
4. «How verification works» con las reglas V1–V8.
5. Mapa de cada tecnología Microsoft a su archivo en el código (nombradas
   exactamente como las reglas: Microsoft Foundry, etc. — solo las usadas).
6. Quick start de un comando (modo stub, sin API key).
7. La eval reproducible con sus resultados.
8. **Responsible AI y limitaciones conocidas**: datos 100 % sintéticos sin
   personas reales; ninguna frase sin respaldo llega al lector; qué pasa cuando
   el Verificador no puede respaldar (omisión/acta, visible en la Caja de
   cristal); los límites honestos del léxico (del brief 003).
9. Cómo se usaron las herramientas GitHub (solo lo real).

Vocabulario literal del tema en pitch/README/video: «explainable match
intelligence», «real-time narratives», «automated match recaps», «fans in any
market». La etapa 1 es pass/fail de encaje temático.

Recordatorio de marcas (riesgo serio): cero nombres o logos de clubes reales de
la Premier League en UI, video y README — ya es regla nuestra, pero el video se
revisa contra esto explícitamente.

## Pitch y submission

Elevator pitch en inglés (un párrafo: qué se construyó + qué tecnologías Microsoft),
lo redacta Fable y lo aprueba Carlos. Checklist final contra el 000: registro ✓,
proyecto accesible ✓, repo público ✓, video ✓, pitch ✓ — **todo subido antes del
27 de octubre, 11:59 PM hora del Pacífico** (en Costa Rica: ~1 AM del 28; no jugar
con esa noche: meta interna 26 de octubre).

## Aceptación

- URL pública funcionando desde red externa, vista por Fable y Carlos.
- Video subido (unlisted) y revisado contra la regla de "cero features no entregadas".
- Submission confirmada con captura guardada en `docs/entrega/`.
