# 034 — Arena experimental con dos controladores de equipo

Fecha local: 17 de octubre de 2026, America/Guatemala.

## Objetivo y autorización

Carlos autorizó iniciar y avanzar con dos agentes que controlan los equipos y un
motor central programado. Se implementa un prototipo independiente del simulador
histórico, basado en los principios del [brief 033](033-tactica-y-movimiento.md).

La primera entrega es un escenario corto de juego abierto, con 22 jugadores,
formaciones 4-3-3 / 4-2-3-1 / 4-4-2, órdenes por jugador, movimiento continuo,
balón, pases, interceptaciones, conducciones y tiros. No es un partido reglamentario
completo: reinicios simplificados, sin duelos aéreos, faltas, tarjetas, lesiones,
sustituciones ni cambios de campo. Los partidos y datasets existentes mantienen
su contrato y sus resultados.

## Arquitectura comprometida

- Dos controladores reciben copias inmutables del mismo estado público, con el
  mismo identificador. Cada uno conoce su formación y responsabilidades; no recibe
  las órdenes privadas nuevas del contrario, el estado del azar ni eventos futuros.
- Responden en paralelo con JSON: identificador de observación, lado, intención
  táctica breve y una orden por jugador. El modelo propone; no declara goles,
  recepciones, infracciones o éxito.
- El coordinador valida esquema, identidad y límites. Orden inválida, excepción o
  plazo agotado activa un controlador programado y queda registrado. Se propaga
  cancelación a los transportes que admiten AbortSignal.
- El motor avanza a paso fijo una vez recogidas ambas órdenes. Resuelve acciones
  conjuntamente; el orden de llegada HTTP no concede tiempo deportivo adicional.
  Controladores locales ejecutan los objetivos y reaccionan a cambios de posesión.
- Se registran configuración, identidad de controladores, órdenes aceptadas,
  motivo de respaldo, eventos y fotogramas. Reproducir usa órdenes archivadas y
  semilla, sin llamar modelos. El archivo no incluye credenciales.

Las velocidades y probabilidades son parámetros sintéticos iniciales, centralizados
en `src/sim/limites.ts`; no se presentan como calibración profesional. El modelo
espacial es 2D y el fuera de juego, cuando interviene el receptor previsto, usa
posiciones puntuales aproximadas.

## Entregables

1. Núcleo `src/arena/`: catálogo, estados, validación, políticas, motor,
   coordinación y reproducción.
2. CLI `npm run arena`: modo programado, modo LLM con dos instancias independientes
   de la costura existente y reproducción de un registro. Límites de duración,
   número de rondas y espera; sin reintentos de inferencia automáticos.
3. Laboratorio web separado con cancha, reproducción, registro de decisiones y
   narración por eventos. El recorrido web programado no genera cargos de IA.
   La inferencia real comienza por CLI, donde se elige explícitamente ese modo.
4. Pruebas de concurrencia, aislamiento, respaldo, causalidad geométrica,
   continuidad, reglas aproximadas, determinismo con órdenes archivadas y legado.

## Modelos y configuración

No hace falta crear un deployment para el prototipo: puede reutilizarse el actual
con dos instancias independientes. Dos modelos distintos requieren dos deployments
operativos. La fábrica de `src/lib/llm.ts` resolverá sobreescrituras por equipo
`ARENA_LOCAL_*` / `ARENA_VISITA_*`, conservando las credenciales en el servidor.
La identidad de cada controlador permite distinguir mismo modelo / modelos
distintos / políticas programadas. No afirmar que se usaron dos modelos diferentes
cuando ambos apuntan al mismo deployment.

Respuestas JSON y validación local siguen la [documentación oficial de OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).
La costura actual usa JSON mode en Azure y texto JSON validado en Foundry; no se
atribuye garantía de JSON Schema del proveedor a esos transportes.

## Evidencia y hackathon

Comparar primero políticas programadas, dos agentes del mismo deployment y,
cuando esté disponible, dos deployments. Intercambiar lados y mantener plantillas
para separar efectos. Medir órdenes inválidas, respaldos, tiempo, llamadas,
acciones, movimiento y evaluación humana de plausibilidad; no usar goles como
única medida de calidad.

Las [reglas oficiales, §§4.2 y 6.2](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)
valoran innovación agéntica, datos sintéticos, implementación y presentación.
La competencia de equipos no demuestra por sí sola colaboración multiagente ni
una mejora de puntuación. Mantener el vínculo con inteligencia explicable,
narración y verificación; no reemplazar evidencia histórica por resultados nuevos.

## Validación requerida

Órdenes de 11 IDs únicos por lado; observaciones simultáneas e independientes;
rechazo de órdenes caducadas o de jugadores rivales; respaldo reproducible;
posiciones y velocidades acotadas; balón en vuelo antes de recepción; oposición
capaz de interceptar; ninguna recepción ficticia tras pase fallido; mismo registro
reproducido sin inferencia; estado inicial del siguiente intervalo igual al final
del anterior; pruebas del producto existente aprobadas.

## Entrega local

Implementado en `src/arena/`, `/arena` y `npm run arena`. [Guía de uso](../arena.md).
El ejemplo archivado acredita cuatro respuestas válidas del deployment existente,
dos rondas de 5 s, siete eventos y cero respaldos; se reproduce sin inferencia.
No acredita dos modelos diferentes ni una mejora de realismo evaluada por humanos.

Validación: 24 pruebas nuevas de arena, suite completa de 1453 unitarias,
89 recorridos e2e y 2 pruebas de empaquetado aprobados. Tras el último ajuste visual
de marcador se repitieron las 24 pruebas de arena, typecheck y sus cinco e2e.
Se corrigieron un título SVG con varios nodos que impedía hidratar, un selector
móvil que desbordaba, el alcance del selector de alertas de la prueba y la
conservación del fuera de juego en pases detenidos. Tres capturas revisadas.

La web ejecuta políticas programadas o reproduce archivos; no dispara inferencia.
## Publicación comprobada

Fuente `31cd966`, imagen `demo-20261018042118`, revisión `cronista--0000005`
activa en Azure existente. Los 220 archivos del contexto coinciden con el código;
sin entornos ni credenciales conocidas. [CI 39096736758](https://github.com/calusaca/cronista/actions/runs/39096736758)
verde: 1453 unitarias, 55 estadísticas, 89 e2e, 2 empaquetado, typecheck,
contenedor y Bicep. Siete comprobaciones HTTP públicas con proveedor real;
portada fresca en 23,3 s. Siete comprobaciones de navegador público sin errores
JS: ejemplo LLM archivado, movimiento/pausa, otra formación, móvil oscuro y
movimiento reducido; tres capturas revisadas. Descarga idéntica al ejemplo,
reimportación HTTP 200 y marcador alterado HTTP 400 conservando los 22 jugadores.
[Evidencia de la versión](../evidencia/arena.json).

La consulta del recurso confirmó un único deployment operativo, GPT-6.1 Sol.
No se creó ningún deployment nuevo de modelo. La comparación descriptiva con
políticas programadas produce secuencias distintas con la misma configuración;
no constituye una evaluación de superioridad o plausibilidad profesional.
