# Integraciones Azure de la arena

Actualizado el 19 de octubre de 2026, America/Guatemala. La
[nueva arena pública](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena)
se publicó con autorización específica del usuario. La demo anterior conserva
su dirección y revisión. La evidencia registra el
[despliegue](evidencia/azure-arena-publicacion.json), el
[recorrido de servicios](evidencia/azure-arena-publica-smoke.json) y el
[navegador público](evidencia/azure-browser-publico.json).

## Qué quedó incorporado

| Servicio | Comportamiento | Evidencia |
| --- | --- | --- |
| Blob Storage | Diario, registros y caché de consultas/audio duraderos; lease para un coordinador, renovación y reservas antes de gastar. | [Reinicio, exclusión y caché](evidencia/azure-servicios-smoke.json) |
| Foundry Agent Service | Analista versionado con funciones para eventos y jugadores; consulta únicamente el prefijo confirmado y verifica sus frases. | [Agente](evidencia/azure-agente.json), [consulta pública](evidencia/azure-arena-publica-smoke.json) |
| Azure Speech | Relato breve en vivo y relato completo, EN/ES, además de comentarios del analista. | [Cobertura completa del duelo](evidencia/azure-voz-duelo.json) |
| Azure Monitor / Application Insights | Spans explícitos de sesión, decisiones, narrador, verificador, herramientas, voz y lotes; conexión de App Insights con Foundry. | [Trazas públicas](evidencia/azure-trazas-publicas.json), [trazas previas](evidencia/azure-trazas.json) |
| Key Vault / Managed Identity | Referencia de secreto en la app; inferencia y Speech comprobados sin claves en la imagen. Identidad para Blob y el proyecto Foundry. | [Recorrido público](evidencia/azure-arena-publica-smoke.json), [resultado del Job](evidencia/azure-lotes-resultado.json) |
| Container Apps Jobs | Trabajador manual, sin reintentos automáticos de infraestructura, configuración fija por ID y reserva por semilla. | [Ejecución Succeeded](evidencia/azure-lotes.json) |
| Foundry Models (Model Inference API) | Adaptador `foundry-modelos` para entrenadores de otras familias: misma clave del recurso (secreto `inferencia`), `/models/chat/completions`, razonamiento descartado antes del reintento y admisión al catálogo solo con smoke real. Probado offline con transporte falso y en real con `grok-4.7` (con `reasoning_effort` low: 13 de 22 decisiones > 30 s) y `gpt-oss-120b` (truncado a 2.048 tokens); ninguno admitido, así que el catálogo público no usa este adaptador. Sí se admitió GPT-6 Luna (Azure OpenAI). No probados: DeepSeek y Llama Maverick (cuota 0), Llama Scout y Mistral (Marketplace no disponible para la cuenta). | [Admisión y despliegues](evidencia/modelos-052/README.md) |
| Foundry Evaluation | Comparación pareada de borrador y resultado final, con respuestas, consumo y limitaciones conservados. | [Revisión con juez distinto](evidencia/arena-eval-revision-alcance/README.md) |

El partido público de prueba duró 60 segundos simulados y 72,1 segundos de
ejecución: cuatro decisiones LLM válidas en cuatro solicitudes, cero respaldos
programados y tres comentarios LLM verificados. Publicó 123 avances y su registro
reproduce el mismo final. El primer avance llegó 5,7 segundos después de conectar
SSE; esa cifra no mide un arranque en frío completo. El resultado fue 0–0.
La [grabación](evidencia/azure-publica/partido.json) queda conservada.

La primera consulta pública al analista activó el respaldo por falta de permiso.
Se corrigió la identidad, se retiraron los dos roles redundantes y una pregunta
posterior obtuvo respuesta LLM verificada con dos solicitudes y una herramienta.
La [evidencia de identidad](evidencia/azure-foundry-identidad-publica.json)
conserva la causa y el alcance de la corrección. El navegador comprobó también
reconexión sin nuevas inferencias, selectores, árbitro, rasgos y móvil de 360 px.
Los doce audios públicos EN/ES coinciden byte por byte con los ya generados;
el navegador recorrió los seis españoles acelerando la reproducción con saltos.

## Narración del partido completo

**Narración en vivo** produce tramos de hasta tres segundos desde eventos ya
confirmados. Resume acciones ordinarias y conserva goles, tiros, atajadas, faltas,
tarjetas y cambios. Comienza en el tramo actual cuando se activa. La generación y
el habla añaden demora; una narración extensa puede quedarse detrás del juego.

**Escuchar desde el inicio** recorre todos los eventos registrados en orden,
incluye presentación y marcador final y termina automáticamente. Conserva
transcripción y fuentes por tramo. Puede durar más que el mini-partido: leer
todos los contactos requiere más tiempo que ejecutarlos. La cancha selecciona
el instante final del tramo descrito; no hay sincronización palabra a palabra.

El texto del relato procede de plantillas deterministas de eventos confirmados;
Speech lo convierte en audio. Las explicaciones LLM del analista/narrador son
adicionales y pasan por V1–V8. No se presenta toda locución como prosa generada y
certificada semánticamente por un LLM. SSML escapa nombres y texto.

La revisión de voz expresiva se publicó el 19 de octubre tras la instrucción
de continuar la tarea pendiente. La [evidencia de publicación](evidencia/voz-expresiva/publicacion.json)
conserva el rechazo previo y la autorización posterior. La
[comprobación pública](evidencia/voz-expresiva/navegador-publico.json) reprodujo
los seis tramos con `voz-expresiva-v1`, cubrió los 33 eventos y verificó por hash
las cinco muestras y el MP3 completo. No hubo errores JavaScript ni desborde
horizontal a 360 px. Los límites de consumo siguen siendo los mismos.

La revisión interpreta cada frase: calma, tensión, emoción,
sorpresa, júbilo, decepción o tono serio. Combina el tipo de jugada con posesión,
avance hacia la portería rival, velocidad y defensores próximos. Una conducción
necesita posesión continua y al menos dos metros de progreso en estados ya
publicados; añade referencias temporales a esos estados. No crea eventos del
motor ni cambia la grabación. El júbilo exige un gol confirmado.

Las pausas, velocidad, tono e intensidad varían por semilla y acción, de forma
reproducible. Los eventos de una frase no consultan estados posteriores. La
tensión decae y los reinicios vuelven a calma. El modo completo mantiene todos
los eventos y suma las conducciones observadas. Tres segundos es el tamaño de
ventana en vivo, no una garantía de latencia ni de duración del audio.

El catálogo **real** del recurso anuncia `cheerful` y `chat` para Jorge en
español; no anuncia `excited` ni los estilos de Dalia que aparecen en la tabla
general de documentación. La entrega usa únicamente estilos comprobados:
Jorge con `cheerful` y prosodia para la activación, prosodia para la decepción;
Jenny con `excited` y `sad` en inglés. Las etiquetas editoriales de emoción no
equivalen a estilos nativos distintos en todas las voces.
[Catálogo observado](evidencia/voz-expresiva/catalogo.json).

Las muestras proceden del duelo archivado, sin nuevas inferencias de equipo:
[calma](evidencia/voz-expresiva/calma-es.mp3),
[ataque](evidencia/voz-expresiva/ataque-es.mp3),
[gol expresivo](evidencia/voz-expresiva/gol-es.mp3),
[el mismo texto sereno](evidencia/voz-expresiva/gol-es-sereno.mp3) y
[gol EN](evidencia/voz-expresiva/gol-en.mp3).
Chromium decodificó los cinco; el gol expresivo y el sereno tienen texto idéntico
y audio diferente. Falta revisión humana de naturalidad y preferencia.

El [relato expresivo completo ES, 3:25](evidencia/voz-expresiva/duelo-es-completo.mp3)
conserva los 33 eventos y tres conducciones observadas. El navegador de producción
local reprodujo sus seis tramos y comprobó el analista, móvil de 360 px y ausencia
de errores JavaScript. El [informe](evidencia/voz-expresiva/relato-completo.json)
conserva fuentes y emociones por tramo; el MP3 concatenado se decodificó con
Chromium. Se revisaron capturas de transcripción y móvil; la prueba de reproducción
acelera los audios con saltos y no sustituye escucha humana íntegra.

Referencias encontradas para comparar estilos de relato: las
[narraciones de RNE del Mundial 2010](https://www.rtve.es/deportes/20110711/asi-canto-rne-partidos-espana-mundial-sudafrica/445909.shtml)
y los [resúmenes oficiales de Catar 2022](https://www.fifa.com/en/tournaments/mens/worldcup/qatar2022/qatar-highlights).
Se conservan como enlaces de referencia; esta entrega no mide sus características
acústicas ni afirma haber evaluado su audio.

El duelo archivado de GPT-5.6 Luna contra GPT-5.4 mini tiene doce audios reales:
seis por idioma, cubriendo sus 33 eventos. Cargar/reproducir el encuentro no vuelve
a consultar a los equipos. **Activar narración de esta grabación** crea o recupera
su sesión; los audios idénticos se sirven desde caché. Los archivos de usuario
importados siguen disponibles para reproducción visual; su activación de voz no
está implementada en esta entrega.

Para escuchar el resultado sin desplegar la web:
[MP3 completo ES, 3:10](evidencia/azure-voz/duelo-completo-es.mp3) ·
[MP3 completo EN, 3:03](evidencia/azure-voz/duelo-completo-en.mp3).
Se unieron los tramos del mismo formato sin nuevas síntesis; Chromium comprobó
las duraciones. Falta revisión humana de pronunciación y escucha íntegra.

## Límites y recuperación

- Una réplica activa con lease compartido. Se rechaza otro escritor; no se
  implementa seguimiento distribuido de una sesión viva entre varias réplicas.
- Dos encuentros concurrentes, uno con modelos; diez encuentros de modelos por
  día UTC. Hasta 180 segundos y consultas cada 30 segundos en web.
- Dos servicios adicionales concurrentes, dos preguntas por sesión y veinte
  preguntas por día UTC. Máximo tres solicitudes del agente por pregunta y seis
  funciones. Las herramientas rechazan futuro, IDs ajenos y mutaciones.
- Voz: hasta 80 solicitudes y 24.000 caracteres reservados por sesión; 800
  solicitudes y 120.000 por día UTC. La revisión expresiva reserva el SSML
  completo de forma conservadora, además de limitar a 6.000 el texto hablado.
  Cada síntesis tiene plazo de quince segundos. La caché incluye voz, versión,
  idioma, tick y SSML; repetir la interpretación recupera el mismo audio.
- Las reservas sobreviven a reinicios. Un fallo ambiguo queda reservado y no se
  vuelve a pagar automáticamente. La caché es por sesión y no es una garantía de
  entrega exactamente una vez del proveedor.
- Diarios/registros hasta 24 horas y 24 sesiones; los servicios en curso quedan
  protegidos de la limpieza. Los metadatos mínimos conservan el presupuesto.

Los límites se aplican al almacenamiento configurado. Tokens y caracteres
informados no equivalen a una factura completa. Log Analytics conserva 30 días
y tiene cuota diaria configurada de 1 GB; esa cuota no constituye un tope de gasto
de todos los servicios Azure.

Las sesiones interrumpidas no reinician inferencias. El adaptador local conserva
el alcance de un proceso; Blob añade coordinación durable. Los datasets y el
archivo final del Job se conservan por ID. Repetir una semilla completada lee su
resultado; una reserva interrumpida exige revisión antes de otro ID.

## Operación

La configuración está en `.env.example`. Las claves permanecen en servidor.
Desarrollo usa Azure CLI; Container Apps/Jobs usa su identidad asignada.
El analista usa Foundry User, por ID estable
`53ca6127-db72-4b80-b1b0-d745d6d5456d`, limitado al proyecto. El antiguo rol
Azure AI Developer corresponde a hubs/workspaces y no autoriza esta API.
El agente versionado con `agent_reference` requiere `AIServices/agents/read`;
el rol limitado a `responses/*` tampoco basta en este recorrido. Véase la
[guía RBAC vigente](https://learn.microsoft.com/en-us/azure/foundry/concepts/rbac-foundry).
Speech sin clave requiere el rol Cognitive Services Speech User sobre su recurso.
`@microsoft/opentelemetry` exporta atributos explícitos, sin prompts, argumentos,
credenciales ni texto libre de errores. Los diarios privados sí conservan las
respuestas necesarias para inspección y reproducción.

```bash
# Validación local y construcción del artefacto; no publica.
npm run typecheck
npm run build
npm run package:standalone
npm run azure:arena -- --prepare

# Preparar cinco muestras y su SSML sin llamadas de pago.
npm run arena:voz-muestras

# Con la configuración Azure, reservar y sintetizar un máximo de cinco audios.
npm run arena:voz-muestras -- --sintetizar

# Corpus offline local. Repetir el mismo ID reutiliza resultados.
npm run arena:lote -- --id prueba-v1 --semillas 42,43 --segundos 30
```

En esta máquina, con los servicios ya preparados, se puede abrir la arena en
localhost con modelos, analista y voz habilitados:

```bash
source .cache/azure-cli-env.sh
CRONISTA_LLM=stub PORT=3418 HOSTNAME=127.0.0.1 node --env-file=.env --env-file=.cache/azure-servicios.env --env-file=.cache/arena-modelos.env .next/standalone/server.js
```

Abrir `http://127.0.0.1:3418/arena`. Elegir modelos al azar o manualmente y ejecutar
el encuentro. Las llamadas reales empiezan al solicitar el partido, el análisis
o la voz; la portada de esta revisión usa el modo offline. Los archivos `.cache`
son configuración privada de esta máquina y no se publican ni incluyen en imágenes.

Los scripts `azure:servicios`, `arena:agente` y `azure:lotes` aprovisionaron los
recursos y el Job ya verificados. Crean recursos o versiones; no ejecutarlos
como comprobaciones de lectura. `azure:arena` sin `--prepare` crea una imagen y
publica `cronista-arena`. La ejecución del 19 de octubre se autorizó expresamente;
no es necesario volver a desplegar para probar la URL existente.

Siguen pendientes revisión humana de calidad y pronunciación, comparación
táctica con lados alternados, reloj continuo
durante decisiones y video actualizado para el hackathon.
