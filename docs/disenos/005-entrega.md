# 005 — Entrega: deploy, video y pitch

**Fecha:** 2026-09-30 · **Diseña:** Fable · **Ejecuta:** Opus (deploy) + Carlos
(cuenta Azure, grabación, registro) · **Semana 3** · **Estado:** cerrado

## Cuenta Azure (actualizado el 10 de octubre de 2026)

La captura aportada por el usuario el 10 oct muestra **Visual Studio Enterprise
Subscription**, estado **Active** y **US$150 de crédito restante**. El período
de facturación mostrado es `10/8/2026–11/7/2026`. El origen del beneficio queda
confirmado por la captura; renovación efectiva, cobertura del deployment y cuota
siguen pendientes de comprobación. No se consultó la cuenta directamente.
Esta información sustituye la hipótesis anterior de una cuenta gratuita con
US$200 durante 30 días. No guardar identificadores de suscripción ni datos de
contacto de la captura en la documentación.

1. Confirmar la renovación del crédito y servicios
   elegibles. Para el beneficio de Visual Studio, Microsoft indica que sus créditos
   cubren Azure OpenAI, sujetos a acceso y disponibilidad del servicio:
   [elegibilidad Dev/Test](https://learn.microsoft.com/en-us/visualstudio/subscriptions/vs-azure-eligibility).
2. Priorizar **Azure OpenAI** con un deployment cubierto por el beneficio y
   compatible con `llm-azure-openai.ts`. Confirmar cuota disponible antes de crear
   el deployment: el saldo no acredita capacidad de inferencia.
   [Cuotas y límites](https://learn.microsoft.com/en-us/azure/foundry/openai/quotas-limits).
3. Claude queda como alternativa de facturación separada: Microsoft requiere una
   suscripción con modalidad de pago elegible y señala que puede cobrar a la tarjeta
   en lugar de aplicar créditos. No cambiar de oferta de suscripción como paso
   automático para usar los US$150.
   [Requisitos y facturación de Claude](https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/how-to/use-foundry-models-claude).
4. Elegir región, modelo y modalidad de deployment según la disponibilidad real de
   la cuenta. La recomendación histórica de `eastus2` no fija la región de todos los
   backends ni confirma sus cuotas.
5. Ejecutar primero el [smoke real](../smoke-foundry.md), revisar su salida y costo,
   y después la evaluación de 20 semillas. Los precios de la evaluación se completan
   con el modelo y tarifa observados; el importe del crédito no es un precio por token.

### Distribución propuesta del crédito

Estos importes son **topes de planificación**, pendientes de confirmar la cobertura
del beneficio y la tarifa del deployment; no son una predicción del costo real.

| Uso | Importe propuesto |
| --- | --- |
| Smoke, integración y evaluación | Hasta US$20 |
| Hosting de la demo, si la oferta permite el uso previsto | Hasta US$30 |
| Reserva | US$100 |

Objetivo inicial: consumir como máximo US$50. Revisar consumo después del smoke y
configurar un presupuesto con alertas al 80 % y 100 %, si la suscripción lo admite.
Los presupuestos de Cost Management **avisan, no detienen el consumo**, y sus datos
se actualizan con retraso: [documentación de presupuestos](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets).

El beneficio de Visual Studio está destinado a desarrollo/pruebas y tiene
restricciones de continuidad. Confirmar la aptitud de la oferta para mantener la
demo accesible durante la evaluación antes de elegir el hosting:
[condiciones del crédito](https://azure.microsoft.com/en-us/pricing/member-offers/credit-for-visual-studio-subscribers/).

## Deploy planificado de la demo

**Azure Container Apps** (región por confirmar, mismo resource group): Dockerfile de Next.js en
modo standalone; la clave del backend elegido como secret de la app, jamás en la imagen ni en el
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

## Prueba del espectador frío (agregada 2026-10-01)

Antes de grabar el video y antes de entregar: **una persona que no sepa nada del
proyecto** (ni de fútbol, idealmente) abre la demo y ve el video. Si en 30
segundos no puede decir qué hace y por qué importa, se corrige lo que la confundió
— no se le explica. Es la simulación más barata del juez real, que llega frío y
con 4 minutos. Carlos elige al conejillo; sus tropiezos van a la bitácora.

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
