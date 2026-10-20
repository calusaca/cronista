# Plan de partidos en vivo y evaluación con Foundry

Fecha: 18 de octubre de 2026, America/Guatemala.

CRONISTA debe transformar un encuentro sintético en inteligencia explicable mientras se ejecuta. La arena suministra eventos; el análisis, la narración y la evidencia permiten que aficionados, analistas y productores los utilicen. La selección de modelos ofrece dos entradas al mismo recorrido: sorteo y elección manual.

## Entregas y criterios de aceptación

| Orden | Entrega | Criterio para terminar | Estado |
| --- | --- | --- | --- |
| 1 | Catálogo y elección de modelos | Catálogo configurado exclusivamente en el servidor; selección manual o sorteo reproducible; identidad fija por equipo y política programada separada. | Implementado y probado localmente |
| 2 | Ejecución incremental | Estados y eventos visibles antes del final; mismas observaciones y plazos por equipo; cancelación, reconexión sin repetir inferencias y archivo final reproducible. | Implementado y probado localmente |
| 3 | Inteligencia personalizada | Experiencias Fan, Analyst y jugador; estadísticas del prefijo, citas navegables y ausencia de resultados futuros. | Implementado y probado localmente |
| 4 | Narrador y verificación | Comentarios basados en hechos confirmados, generación asíncrona, motivos de rechazo inspeccionables y respaldo inmediato. | Implementado y probado con inferencia real |
| 5 | Evaluación y observabilidad | Dataset de ventanas temporales, comparación con condiciones iguales, mediciones de latencia, consumo y respaldo; trazas correlacionadas e integración de evaluación Foundry. | Evaluación, Application Insights conectado y trazas Azure Monitor comprobadas; revisión humana pendiente |
| 6 | Voz y entrega | Relato breve en vivo y narración completa EN/ES; demo pública comprobada, video menor de dos minutos y materiales EN. | Voz y nueva aplicación publicadas con autorización específica el 19 de octubre; video pendiente |

Cada entrega incluye comprobaciones de su comportamiento, actualización de evidencia y revisión en móvil. Los cambios se integran conservando los registros arena-v1, arena-v2 y arena-v3 y las evaluaciones históricas del simulador de crónicas.

## Ejecución y experiencia

El objetivo competitivo es ganar, marcando y evitando goles. Cada modelo recibe los parámetros públicos activos, el marcador, el tiempo disponible, las acciones observadas del rival y su propia última propuesta válida. Debe ajustar ataque, defensa y gestión para contrarrestar al contrario. El motor determina el éxito; la narración describe después los acontecimientos confirmados. Los patrones rivales se presentan con su muestra y citas, sin revelar sus próximas órdenes privadas.

Los modelos ejercen de entrenadores y controladores colectivos por intervalos. Los jugadores conservan un control local autónomo que reacciona a posesión y balón cercano. Cero respaldos significa que todas las decisiones de equipo provinieron de modelos; no significa una llamada LLM por cada contacto. La recepción de todos los parámetros activos no prueba que el modelo los gestione bien.

La validación competitiva tiene prioridad sobre el audio. Las órdenes solicitan JSON Schema estricto en Azure, se validan localmente y pueden corregirse una vez dentro del plazo común. Cada decisión registra sus solicitudes. Una orden inválida o un error de proveedor activa un respaldo identificado; ese encuentro se clasifica como ejecución con intervención programada y no como duelo puro.

El servidor mantiene el estado autoritativo. Una sesión identifica la configuración, los modelos asignados y una secuencia numerada de publicaciones. La interfaz recibe las publicaciones por SSE y reconstruye únicamente el prefijo confirmado. Reconectar continúa desde el último identificador; nunca crea otro encuentro.

La primera versión avanza el motor por fotogramas durante cada intervalo resuelto. En las fronteras muestra que los entrenadores están decidiendo y detiene el reloj simulado mientras ambos responden. Es generación en vivo con esperas explícitas. El ritmo continuo de un segundo simulado por segundo de reloj requiere una entrega posterior de planificación asíncrona con momentos comunes de aplicación; ninguna respuesta modifica el pasado.

Las sesiones conservan diario, archivos, reservas y caché mediante adaptadores local o Blob Storage. Una reinicialización identifica sesiones incompletas sin reiniciar inferencias. Blob añade lease del coordinador y presupuesto compartido; se mantiene una réplica. El seguimiento de sesiones vivas entre réplicas requiere una ampliación posterior.

La inferencia web se habilita mediante configuración del servidor. Se acotan concurrencia, duración y número de consultas. El navegador elige identificadores del catálogo y nunca proporciona endpoints, credenciales o instrucciones de sistema.

## Inteligencia y comparación

Los entrenadores rivales generan decisiones competitivas. La colaboración para la categoría multiagente se demuestra en el recorrido analista, narrador y verificador, con hechos y estados compartidos, feedback y recuperación.

Los hechos deben citar eventos anteriores o simultáneos al instante del comentario. Las explicaciones distinguen entre intención declarada y efecto observado. Las estadísticas del motor espacial se presentan como sintéticas y no heredan la calibración del simulador histórico.

La evaluación usa ventanas temporales archivadas y condiciones comparables. Compara un narrador con el recorrido completo, aislando el efecto de verificación con el mismo primer borrador cuando corresponda. Mide afirmaciones sin respaldo, cobertura, claridad de personalización, latencia p50/p95, tiempos hasta primera publicación, respaldos y consumo. Se complementa con revisión humana ciega. Los errores inyectados se reportan por separado como pruebas de robustez.

## Integraciones de Foundry

La [revisión 036 de herramientas Azure](036-herramientas-azure-hackathon.md)
prioriza evaluación, Application Insights/OpenTelemetry y almacenamiento durable;
después un analista de Agent Service con funciones acotadas al prefijo visible.

Prioridad: evaluación y trazas, selección de modelos, Agent Service con herramientas útiles y, después, Speech. Las herramientas de consulta deben limitarse al prefijo publicado. Model Router se puede evaluar para narración; los entrenadores conservan el deployment elegido durante el partido.

La [entrega de integraciones Azure](../azure-integraciones.md) incorpora Blob,
agente versionado, Speech, Application Insights, Key Vault y Job manual. El relato
completo recorre todos los eventos confirmados; el modo en vivo los resume. Sus
textos deterministas y los comentarios LLM verificados tienen procedencia visible.

El editor visual de Foundry Workflows anuncia su retiro para el 1 de diciembre de 2026. La entrega mantiene la orquestación TypeScript existente; cualquier adopción de Agent Framework debe resolver una necesidad comprobada de coordinación.

## Evidencia del avance local

El [duelo real de modelos distintos](../evidencia/arena-duelo-competitivo.json)
registró cuatro decisiones válidas, cero respaldos y tres comentarios LLM
verificados. Su primer avance se publicó a los 4,8 segundos; el encuentro de
60 segundos tardó 68,8 segundos incluyendo esperas. El archivo se puede cargar en
la arena local y reproducir sin inferencia. No demuestra superioridad táctica.

La [evaluación Foundry](../evidencia/arena-eval-foundry/README.md) está completada
con dos ventanas y cuatro filas pareadas. El primer borrador recibió puntuaciones
mayores que el pipeline; no se afirma una mejora. Los rechazos por alcance de
citas se revisaron enriqueciendo los datos del propio hecho. La
[revisión con otro juez](../evidencia/arena-eval-revision-alcance/README.md) aprobó
las cuatro filas con puntuaciones iguales entre borrador y pipeline; tampoco
demuestra ventaja. Los fallos HTTP 429 del
deployment anterior se registran como recuperación, no como duelos sin respaldo.

Prioridades siguientes: revisión de calidad y alcance de citas, medición
competitiva con semillas y lados alternados, planificación asíncrona con momentos
comunes de aplicación, seguimiento distribuido si se habilitan varias réplicas,
revisión humana y video de entrega. Speech, caché durable, analista con
herramientas y trazas ya tienen comprobaciones reales. La nueva aplicación se
publicó con autorización específica; la demo anterior conserva su versión.
El audio sigue siendo opcional.

## Fechas de entrega

Objetivo de congelamiento de funcionalidades: 26 de octubre. Cierre oficial: 28 de octubre a las 00:59, hora de Guatemala. La publicación requiere un recorrido comprobado, repositorio y video públicos y materiales de evaluación en inglés. Una versión archivada debe seguir disponible durante la evaluación.

## Referencias

- [Reglas oficiales y criterios](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).
- [Evaluadores de calidad de Foundry](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/rag-evaluators).
- [Evaluadores personalizados](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/custom-evaluators).
- [Observabilidad](https://learn.microsoft.com/en-us/azure/foundry/concepts/observability).
- [Instrumentación TypeScript](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/vs-code-tracing).
- [Agent Service y funciones](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/function-calling).
- [Model Router](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-router).
- [Retiro del editor visual](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/workflow).
- [Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech).
