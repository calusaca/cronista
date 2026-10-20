# Herramientas Azure para la siguiente entrega de CRONISTA

Revisión: 18 de octubre de 2026, America/Guatemala. Complementa el
[plan 035](035-partidos-en-vivo-y-foundry.md). Las recomendaciones son una
selección para este proyecto, no requisitos adicionales del concurso.

Actualización de ejecución: las prioridades se implementaron en la
[entrega Azure](../azure-integraciones.md), con pruebas reales de Blob, agente,
Speech, trazas y un Job completado. Key Vault contiene el secreto y la nueva
aplicación usa sus referencias. La publicación fue autorizada el 19 de octubre;
la aplicación anterior conserva su versión.

Las [reglas oficiales](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)
evalúan implementación, diseño agéntico, impacto, experiencia y ajuste a categoría,
con el mismo peso. Premian el uso efectivo de tecnologías y una solución completa.
Nuestra interpretación es que cada integración debe resolver un problema y
demostrar su efecto; contar servicios no permite predecir una puntuación.
Las [playlists oficiales](https://github.com/microsoft/insidethegamehackathon/blob/main/RESOURCE%20PLAYLISTS.md)
proponen formación en Foundry, agentes, workflows y datos; no exigen usar todas.

## Estado acreditable

Container Apps y ACR alojan la demo anterior y la nueva arena pública. Esta dispone
de sesiones SSE, cancelación, reconexión y archivo final. Los dos deployments de
Foundry/Azure OpenAI disputaron un [duelo registrado](../evidencia/arena-duelo-competitivo.json)
con cuatro decisiones aceptadas y cero respaldos. Los jugadores conservan control
local entre consultas. El SDK de proyectos Foundry envió una evaluación real y
recuperó resultados: la [muestra](../evidencia/arena-eval-foundry/README.md) no demostró mejora.

Hay trazas cloud correlacionadas, diarios y reservas de consumo en Blob. La nueva
aplicación mantiene una réplica máxima y su identidad administrada accede a ACR,
Blob, Key Vault y el proyecto Foundry. La configuración de la demo anterior se
conserva; no hereda automáticamente estos servicios.

## Integraciones priorizadas

| Prioridad | Herramienta | Cambio propuesto | Evidencia de aceptación |
| --- | --- | --- | --- |
| 1 | Foundry Evaluation, ampliar lo existente | Revisar alcance de citas; varias semillas y ventanas, juez distinto y revisión humana. | Respuestas pareadas, errores temporales, falsos positivos, latencia, consumo y fallos publicados. |
| 1 | Azure Monitor + Application Insights + trazas Foundry | Correlacionar sesión, ronda, controlador, narrador y verificador. | Seguir una jugada desde decisión hasta comentario; localizar HTTP 429, plazos y respaldos. |
| 1 | Blob Storage; Azure Files como alternativa inicial del diario | Conservar registros, datasets, presupuesto y estado fuera del disco efímero. | Reiniciar conserva archivos y presupuesto; reconectar no repite inferencias. |
| 2 | Foundry Agent Service con funciones del partido | Analista consultable: pregunta → herramientas sobre hechos publicados → explicación con citas → verificación. | Una consulta Fan/Analyst selecciona herramientas útiles y cita los hechos recuperados. |
| 2 | Managed Identity y Key Vault cuando queden claves externas | Acceso a datos mediante RBAC y referencias de secretos cuando sean necesarias. | Acceso con identidad de la app, permisos mínimos y configuración reproducible. |
| 3 | Azure Speech | Audio EN/ES del texto aprobado, voluntario y sincronizado. | Escuchar una explicación y abrir los mismos eventos que respaldan el texto. |
| 3 | Azure Container Apps Jobs | Corpus y evaluación fuera del proceso web, con presupuesto y trabajo identificable. | Un lote produce informe sin bloquear sesiones ni repetir llamadas por reintentos de infraestructura. |

Las prioridades fortalecen implementación, fiabilidad y utilidad. Foundry y los
handoffs especializados también encajan en sus categorías. Las puntuaciones y
premios dependen de los jueces y de resultados demostrados, no de tener recursos.

## Observabilidad: integración inmediata recomendada

[Foundry](https://learn.microsoft.com/en-us/azure/foundry/concepts/observability)
combina evaluación, monitorización y trazas.
[Application Insights con OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=nodejs)
permite mantener la orquestación TypeScript. Ver nuestros spans externos en
Foundry requiere conexión al recurso y atributos de correlación; no asumir que
aparecen por enviar cualquier métrica a Azure Monitor.

Árbol propuesto: `sesion → ronda → decision_local/decision_visita`, y
`sesion → narracion → verificacion → publicacion`. Etiquetas: versión del motor,
semilla, tick observado, modelo, solicitud, estado, motivo de rechazo y uso
informado. Medir primer estado, esperas p50/p95, latencia del narrador y respaldos.
Un fallo de instrumentación no debe detener el encuentro. Tokens no equivalen
a una factura completa.

Por defecto exportar metadatos y hashes, sin claves ni mensajes completos;
configurar sampling y retención. Algunas vistas de agentes externos figuran como
preview en la [documentación de trazas](https://learn.microsoft.com/en-us/azure/foundry/observability/how-to/trace-agent-framework).
El panel propio debe conservar valor aunque esa vista no esté disponible.

## Datos duraderos antes de ampliar réplicas

[Blob Storage](https://learn.microsoft.com/en-us/javascript/api/%40azure/storage-blob/)
sirve para archivos y datasets. Sus
[leases](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-lease-javascript)
pueden delimitar un escritor junto con comprobaciones de versión de metadata.
Propuesta: archivo final inmutable, publicaciones numeradas y registro de consumo.
Un lease no convierte una llamada al modelo en operación exactamente una vez ni
conserva un proceso que murió.

Para conservar la implementación actual de archivos, Container Apps admite
[montajes Azure Files](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts).
Es alternativa de persistencia, no coordinador distribuido. Mantener una réplica
hasta tener dueño de trabajo compartido, estado durable y recuperación explícita.
Una sesión interrumpida no reinicia inferencias silenciosamente. Los presupuestos
de inferencia también necesitan ámbito compartido antes de escalar.

## Agente que explique jugadas con herramientas

[Agent Service y function calling](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/function-calling)
incluye integración TypeScript. El agente útil podría responder «¿qué cambió en
los últimos 30 segundos?» o «¿cómo participa mi jugador?». Funciones propuestas,
todavía no implementadas:

- `consultar_eventos(desdeTick, hastaTick)`.
- `consultar_jugador(jugadorId, hastaTick)`.
- `resumir_equipo(lado, ventanaS, hastaTick)`.
- `obtener_hechos(ids, hastaTick)`.

La sesión fija el límite publicado y el servidor rechaza ticks futuros y planes
privados. La respuesta conserva IDs, distingue intención del entrenador de efecto
observado y pasa al verificador. El agente no modifica marcador, física ni
arbitraje. Los entrenadores mantienen decisiones simultáneas y modelo fijo.

Medir utilidad y demora frente al resumen actual. Los equipos rivales demuestran
competencia; la colaboración se acredita en analista, narrador y verificador.
No reemplazar funciones deterministas por LLMs para aumentar el número de agentes.
[Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview)
es otra opción; migrar la orquestación TypeScript necesita beneficio probado.
Empezar por una función acotada de Agent Service reduce el cambio. El
[editor visual de Foundry Workflows](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/workflow)
anuncia retiro el 1 de diciembre de 2026; no basar la entrega en ese editor.

## Identidad, voz y lotes

[Container Apps con Key Vault](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
admite referencias de secretos con identidad administrada. La app ya conserva
claves como secretos de Container Apps en el servidor. Esta mejora administra
permisos y rotación; no corrige una exposición conocida al navegador. Para datos
nuevos, preferir identidad y RBAC antes de introducir otra clave.

[Speech](https://learn.microsoft.com/azure/ai-services/speech-service/get-started-text-to-speech)
dispone de síntesis JavaScript. Leer solo texto aprobado, mantener tick original,
limitar la cola, descartar comentarios atrasados y permitir silencio e idioma.
Medir demora y consumo antes de habilitar audio público.

[Container Apps Jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs)
admite ejecuciones manuales, programadas y por eventos. Primero serviría para
corpus y evaluación. Identificar lote/semilla/configuración y conservar resultados
antes de marcar éxito. Un reintento no vuelve a comprar inferencias sin una
política explícita. No extraer todo el bucle vivo a otro servicio de inmediato.

## Opciones posteriores

| Opción | Cuándo se justifica | Decisión actual |
| --- | --- | --- |
| Fabric Real-Time Intelligence, Eventstreams, Eventhouse y KQL | Historial consultable, comparación táctica entre encuentros y panel de broadcast compartido. | Candidato fuerte para datos; terminar persistencia y evaluación antes de integrarlo. |
| Azure AI Search | Recuperación sobre un corpus histórico grande o conocimiento externo. | Los hechos del partido ya tienen IDs; funciones directas bastan para el próximo agente. |
| Functions/Durable Functions y mensajería | Trabajadores con recuperación entre procesos y varios consumidores. | Revisar al superar una réplica y necesitar trabajo durable. |
| SignalR/Web PubSub | Muchos espectadores o intercambio bidireccional de interacción. | SSE cubre el flujo actual; medir antes de reemplazarlo. |
| AKS | Requisitos operativos de Kubernetes que Container Apps no cubra. | Mantener el alojamiento probado. |
| Azure Machine Learning | Entrenamiento y calibración de políticas aprendidas. | Los modelos actuales deciden; no aprenden por refuerzo en cada partido. |

[Fabric Real-Time Intelligence](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/overview)
sí encaja con eventos de fútbol y con tecnologías destacadas del hackathon. Su
valor sería consultar múltiples encuentros y detectar patrones; no atribuir
causalidad o superioridad desde una muestra pequeña.

[Azure MCP Server](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/overview)
sirve para desarrollo y diagnóstico de recursos. Su documentación limita el
servidor local al entorno autorizado de desarrollo; no lo expondría al aficionado
ni daría permisos de Azure a entrenadores. Las funciones del partido son otra
interfaz, restringida al estado publicado.

## Orden de ejecución

1. Revisar rechazos del narrador y ampliar evaluación sin ocultar fallos.
2. Conectar telemetría y guardar un recorrido completo correlacionado.
3. Persistir archivos y presupuesto; demostrar recuperación tras reinicio.
4. Probar el analista de Agent Service con una pregunta y evidencia navegable.
5. Añadir voz si el recorrido anterior funciona y cabe en la demo.

Antes de publicar: evidencia reproducible, documentación EN, recorrido móvil,
archivo disponible cuando falle el proveedor y límites medidos. Esta revisión
no creó nuevos recursos Azure ni publicó la aplicación; la ejecución posterior
se documenta por separado en la entrega de integraciones.
