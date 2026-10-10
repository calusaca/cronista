# Inside the Game: fuentes y preparación de la entrega

Revisado el **10 de octubre de 2026**. El estado del código y las prioridades están en la [revisión del proyecto](revision-2026-10-10.md). Las fuentes oficiales pueden cambiar: volver a consultarlas al congelar la entrega.

## Documentos oficiales

| Documento | Para qué consultarlo |
| --- | --- |
| [Portal oficial — Microsoft Innovation Studio](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon) | Referencia del evento en la plataforma donde el usuario confirmó la creación del proyecto. |
| [OFFICIAL RULES.md](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) | Calendario, elegibilidad, reto, categorías, entrega y evaluación. |
| [CODE OF CONDUCT.md](https://github.com/microsoft/insidethegamehackathon/blob/main/CODE%20OF%20CONDUCT.md) | Convivencia, respeto, privacidad y reporte de conductas inapropiadas. |
| [LICENSE.md](https://github.com/microsoft/insidethegamehackathon/blob/main/LICENSE.md) | Licencia MIT del repositorio de Microsoft; conservar sus avisos si se reutiliza material suyo. |
| [RESOURCE PLAYLISTS.md](https://github.com/microsoft/insidethegamehackathon/blob/main/RESOURCE%20PLAYLISTS.md) | Formación sobre Copilot, Foundry, agentes, workflows y datos. |
| [SECURITY.md](https://github.com/microsoft/insidethegamehackathon/blob/main/SECURITY.md) | Canal privado para vulnerabilidades de repositorios Microsoft; no reportarlas en issues públicos. |

La licencia del evento no sustituye la [licencia propia de CRONISTA](../LICENSE). Las playlists son recursos de aprendizaje, no una lista de tecnologías que debamos implementar. SECURITY.md describe el canal de Microsoft; no establece automáticamente un canal para vulnerabilidades de CRONISTA.

## Portal del evento y proyecto CRONISTA

El [portal de Inside the Game Developer Hackathon](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon)
queda registrado como punto de acceso al evento. El usuario confirmó la creación
del proyecto el **10 de octubre de 2026**. Añadir también el enlace directo a la
ficha de CRONISTA cuando esté disponible y conservar la confirmación del envío final.

Antes de entregar, revisar los campos y avisos de la plataforma y contrastarlos
con OFFICIAL RULES.md. La matriz de preparación de este documento reúne las
acciones pendientes de código público, demo, video, pitch e instrucciones de prueba.

**Verificación del enlace (10 oct):** respondió HTTP 200 con el documento inicial
de Innovation Studio. El contenido dinámico del evento no pudo leerse desde esta
sesión; los requisitos y fechas resumidos abajo proceden de las reglas oficiales
ya revisadas. Los avisos específicos del portal quedan pendientes de comprobación.

## Requisitos oficiales resumidos

Las [reglas, §§1–7](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md), establecen:

- Registro: **20 oct, 13:00 Costa Rica**; entrega: **28 oct, 00:59**; acceso de jueces hasta **11 nov, 01:59**. Equivalentes oficiales: 20 oct 12:00 PT, 27 oct 23:59 PT y 10 nov 23:59 PT.
- Mayoría de edad; equipos de hasta cuatro, representante autorizado; revisar exclusiones territoriales, laborales y conflictos (§3).
- Proyecto nuevo posterior al **29 sep, 09:00 PT**, original, con derechos y licencias suficientes; sin premio previo ni apoyo preferencial incompatible (§§4.3–4.12).
- Datos sintéticos futbolísticamente plausibles; material audiovisual ajeno solamente con autorización (§4.7).
- Pitch, GitHub **público**, video público **menor de 2 minutos** mostrando funcionamiento y demo/build gratuito accesible; materiales en inglés o traducidos (§§4.4–4.9).
- Reto: ingestión, interpretación, explicación, representación y personalización (§4.1).
- Filtro inicial de viabilidad y tecnología; cinco criterios de **20 %**: implementación, innovación agéntica, impacto, UX/presentación y categoría. Desempate por orden de criterios (§6).
- Se conserva la propiedad; se concede a Microsoft/Premier League una licencia amplia, perpetua, irrevocable y comercial sobre la entrega (§7).

La conversión de noviembre contempla el cambio de horario del Pacífico; Costa Rica permanece en UTC−6. Meta interna propuesta: entregar el **26 de octubre**, con margen.

## Preparación específica de CRONISTA

| Evidencia o entregable | Estado al revisar | Acción para cerrarlo |
| --- | --- | --- |
| Inscripción | Registrada como completada en [BITACORA.md](../BITACORA.md), 30 sep; sin acceso al comprobante de la plataforma | Conservar confirmación y comprobar composición del equipo. |
| Proyecto en la plataforma | Creación confirmada por el usuario el 10 oct | Completar materiales y verificar el envío final; crear el proyecto no confirma la entrega. |
| Fecha de creación | Primer commit: 30 sep, 18:08 Costa Rica (`3c46f0f`) | Conservar historial y procedencia; git respalda la cronología, no prueba por sí solo toda la autoría. |
| Datos sintéticos | Generador y dataset disponibles | Mostrar [DATASHEET](dataset/DATASHEET.md), límites y cómo reproducirlo. |
| Crédito Azure | Captura del 10 oct: Visual Studio Enterprise, suscripción activa y US$150 restantes | Verificar renovación, cobertura y cuota del deployment; distribución propuesta en [005 — Entrega](disenos/005-entrega.md). |
| Integración Microsoft | Adaptadores Foundry y Azure OpenAI implementados y probados con transporte simulado | Guardar una corrida real sin caché con deployment y backend identificados. |
| Calidad de ejecución | [CI de `fix/dataset-memory` en verde](https://github.com/calusaca/cronista/actions/runs/38095123207): typecheck, 1.350 unitarias, 55 estadísticas y 47 e2e; dataset idéntico bajo 512 MiB de old space | Integrar la rama a `main` y mantener estas comprobaciones en cada cambio. |
| Repositorio público | `calusaca/cronista` existe pero GitHub devuelve `PRIVATE` | Preparar publicación del código y revisar contenido e historial antes de cambiar visibilidad. |
| Demo accesible | README sin URL; no hay evidencia de despliegue ni infraestructura versionada | Desplegar, probar desde otra red y mantener disponibilidad durante la evaluación. |
| Video | Guion EN; sin URL ni grabación final | Grabar el producto real, usar un rechazo real si se muestra, medir duración y publicar. |
| Pitch | Borrador EN | Acortar, retirar tecnologías aún no desplegadas y afirmaciones universales de veracidad. |
| Instrucciones de prueba | Quick start EN local | Añadir instrucciones EN para la demo, backend, limitaciones y ruta de prueba de 60 segundos. |
| Derechos y elegibilidad | MIT propia y mundo ficticio; situación personal no comprobable en el repo | Completar declaración del equipo sobre derechos, conflictos y condiciones de participación. |
| Confirmación de entrega | No encontrada | Completar campos en Projects y guardar comprobante de recepción. |

## Categoría y formación

El objetivo documentado es **Best Multi-Agent System**. La recuperación con feedback y la trazabilidad de CRONISTA son argumentos útiles; el código actual contiene un Writer LLM y etapas deterministas, con orquestación TypeScript propia. Presentar esta distinción expresamente y justificar la colaboración con evidencia. La aceptación de esa arquitectura por los jueces no está garantizada. Referencia: [categorías, §4.2](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

Como recomendación de trabajo, priorizar las playlists [Azure AI Foundry](https://aka.ms/asn/foundry) y [Agentic Workflows](https://aka.ms/asn/agenticworkflows) para resolver operación y trazas. [Foundry Agents](https://aka.ms/asn/foundryagents) sirve para valorar una integración adicional si queda tiempo. La [playlist Data](https://aka.ms/asn/data) puede ayudar a presentar el generador; [Copilot](https://aka.ms/asn/ghcopilot) es pertinente si realmente se utiliza y se documenta su contribución. Estos enlaces provienen de [RESOURCE PLAYLISTS.md](https://github.com/microsoft/insidethegamehackathon/blob/main/RESOURCE%20PLAYLISTS.md).
