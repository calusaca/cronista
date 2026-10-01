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

## Video (≤ 2 min — manda sobre todo lo demás, prioridad 1 del 000)

Guion por segundos (Fable escribe el texto palabra por palabra en
`docs/entrega/guion-video.md` cuando la UI exista; esto fija la estructura):

| Tiempo | Qué se ve |
|---|---|
| 0:00–0:15 | El problema: los resúmenes de partidos con IA inventan datos. Nadie puede probar que su crónica dice la verdad. |
| 0:15–0:35 | La cadena en un diagrama simple: Analista → Cronista → Verificador. "Nothing unverified reaches the reader." |
| 0:35–1:25 | **Demo real**: simular partido → crónica aparece → clic en una frase → los eventos se iluminan → clic inverso → toggle ES/EN → barra de verificación. Mostrar un borrador rechazado y el reintento (panel dev). |
| 1:25–1:45 | Tecnología: Claude en Microsoft Foundry, cadena multi-agente (DevUI del sidecar si existe), Azure Container Apps. |
| 1:45–2:00 | Cierre: cada frase es demostrable con un clic. |

Graba Carlos (OBS o similar, pantalla + voz en inglés leída del guion o subtítulos
EN sobre voz ES — se decide al grabar). Reglas: **cero features en el video que no
estén entregadas** (§4.3 exige que el proyecto funcione «as depicted in the
video»); **sin música con copyright ni marcas de terceros** (§4.4) — silencio, voz
o música libre verificada; todos los materiales de la entrega **en inglés** (§4.9).

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
