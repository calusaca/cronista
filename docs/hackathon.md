# Inside the Game: fuentes y preparación de la entrega

> Actualización del 27 oct: repositorio **público** desde las 03:45 UTC; arena y crónica en Azure
> Container Apps con una réplica caliente cada una (arena en `cronista-arena--0000054` <!-- 070 -->);
> catálogo público de seis modelos de Azure OpenAI; [pitch](entrega/pitch.md),
> [guía EN para jueces](entrega/judges-guide.md) y [README](../README.md) al día con las cifras medidas en
> `950007c`. El video final está en regrabación ([brief 067](disenos/067-entrega-final-video-y-materiales.md)).
> Pendientes de Carlos: subir el video y pasar la URL, decidir los cupos temporales del juzgamiento y completar
> los campos de «Projects» guardando el comprobante antes del **27 oct, 23:59 PT**. La nota del 17 oct se
> conserva debajo; la versión anterior de la matriz queda en el historial de git.
>
> Nota del 17 oct: integración real con GPT-6.1 Sol completada; evaluación 0/163 frente a 0/167, sin
> reducción observada ([evidencia](evidencia/validacion-entrega.json)).


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

| Evidencia o entregable | Estado al 27 oct | Acción para cerrarlo |
| --- | --- | --- |
| Inscripción | Registrada como completada en [BITACORA.md](../BITACORA.md), 30 sep; sin acceso al comprobante de la plataforma | Conservar confirmación y comprobar composición del equipo. |
| Proyecto en la plataforma | Creación confirmada por el usuario el 10 oct | Carlos: completar los campos con pitch, repositorio, video y demo; crear el proyecto no confirma la entrega. |
| Fecha de creación | Primer commit: 30 sep, 18:08 Costa Rica (`3c46f0f`) | Conservar historial y procedencia; git respalda la cronología, no prueba por sí solo toda la autoría. |
| Datos sintéticos | ✅ Generador, dataset descargable y [DATASHEET](dataset/DATASHEET.md); la arena usa clubes, jugadores y entrenadores ficticios | Ninguna. |
| Crédito Azure | Crédito de 150 USD confirmado por Carlos; los topes diarios y por sesión acotan el gasto | Vigilar el consumo durante el juzgamiento. |
| Integración Microsoft | ✅ Azure OpenAI real (seis modelos en la arena, GPT-6.1 Sol en la crónica), Foundry Agent Service y Evaluation, Azure AI Speech, Blob, Key Vault, Application Insights, Container Apps; [README](../README.md#microsoft-and-azure-technologies) | Ninguna. No se usan Agent Framework, MCP, A2A, Fabric ni AKS. |
| Calidad de ejecución | ✅ [Run 40462385259](https://github.com/calusaca/cronista/actions/runs/40462385259) sobre `be3c96a` (27 oct), **verde en los tres trabajos**: 2.994 unitarias en 143 archivos, 85 estadísticas, 343 Playwright y contenedor/Bicep. Del 26 oct hasta hacerlo público, los trabajos no arrancaban por la facturación de Actions. | Mantener el CI en verde en cada cambio. |
| Repositorio público | ✅ `calusaca/cronista` público desde el 27 oct, 03:45 UTC | Ninguna. |
| Demo accesible | ✅ [Arena](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena) y [crónica](https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io) en Container Apps con `minReplicas` 1; smoke público tras cada publicación en [BITACORA.md](../BITACORA.md) | Mantenerlas hasta el 10 nov; nada de despliegues durante el juzgamiento sin necesidad. Cupos temporales del juzgamiento: decide Carlos. |
| Video | En regrabación ([brief 067](disenos/067-entrega-final-video-y-materiales.md), bloque A); corte anterior del 25 oct en el historial de git; `VIDEO_URL` del README sigue como marcador | Carlos: subir el video a YouTube (público o no listado) y pasar la URL para sustituir el marcador. |
| Pitch | ✅ [pitch.md](entrega/pitch.md) actualizado el 27 oct: 98 palabras el elevator pitch y 248 la descripción | Pegarlo en la plataforma. |
| Instrucciones de prueba | ✅ [Guía EN para jueces](entrega/judges-guide.md): arena, torneo, crónica y límites | Ninguna. |
| Derechos y elegibilidad | MIT propia y mundo ficticio; situación personal no comprobable en el repo | Completar declaración del equipo sobre derechos, conflictos y condiciones de participación. |
| Confirmación de entrega | Pendiente de Carlos | Completar los campos de «Projects» y guardar el comprobante antes del **27 oct, 23:59 PT**. |

## Categoría y formación

El objetivo documentado es **Best Multi-Agent System**. La recuperación con feedback y la trazabilidad de CRONISTA son argumentos útiles; el código actual contiene un Writer LLM y etapas deterministas, con orquestación TypeScript propia. Presentar esta distinción expresamente y justificar la colaboración con evidencia. La aceptación de esa arquitectura por los jueces no está garantizada. Referencia: [categorías, §4.2](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

Como recomendación de trabajo, priorizar las playlists [Azure AI Foundry](https://aka.ms/asn/foundry) y [Agentic Workflows](https://aka.ms/asn/agenticworkflows) para resolver operación y trazas. [Foundry Agents](https://aka.ms/asn/foundryagents) sirve para valorar una integración adicional si queda tiempo. La [playlist Data](https://aka.ms/asn/data) puede ayudar a presentar el generador; [Copilot](https://aka.ms/asn/ghcopilot) es pertinente si realmente se utiliza y se documenta su contribución. Estos enlaces provienen de [RESOURCE PLAYLISTS.md](https://github.com/microsoft/insidethegamehackathon/blob/main/RESOURCE%20PLAYLISTS.md).
