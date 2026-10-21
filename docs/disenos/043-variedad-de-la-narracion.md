# Variedad de la narración y uso de los transcripts

> Nota (22 oct 2026): los transcripts de `docs/DatosPrueba` son material ajeno, solo local y fuera del repositorio; ver [referencias](../referencias-transcripts.md).

## Alcance de esta revisión

Revisión solicitada después de publicar la sincronía del brief 042. Es un análisis
y una propuesta, seguidas de implementación autorizada con «ok dale».
No se inicia un entrenamiento de modelos.

Se comprobaron por SHA-256 los seis archivos de `docs/DatosPrueba`: coinciden con
el corpus de `docs/evidencia/analisis-transcripts.json`. Se conserva su inventario:
cinco transcripts en español, uno en inglés y unas 135.882 palabras después de
retirar metadatos de tiempos. El conteo procede de esa auditoría, no de una nueva
transcripción de audio. Esta revisión vuelve a examinar pasajes de los seis
archivos y contrasta sus recursos con la ruta de voz actual de `src/arena`.
No es una anotación manual exhaustiva ni una escucha de los encuentros. Los cortes
de subtítulos no permiten medir pausas reales entre voces.

## Causas actuales de la repetición

1. `src/arena/relato.ts`, función `relatoBuffer`, construye el texto hablado con
   plantillas. La ruta `/api/arena/sesiones/[id]/relato` sintetiza ese texto; no
   solicita redacción al LLM de `src/arena/narrador.ts`. Los comentarios LLM son
   otro consumidor y no sustituyen automáticamente este relato hablado.
2. Los estados tienen una única construcción por situación: «tiene el balón»,
   «el balón viaja», «balón suelto» o «prepara la reanudación». La propiedad
   `variante` que acompaña al fragmento no cambia esas palabras.
3. Cada quince segundos existe una oportunidad de comentario estadístico con la
   misma estructura: «En los últimos… intentos de pase… recepciones… remates…».
   Un evento prioritario puede desplazarlo; no es un comentario que necesariamente
   se escuche en cada intervalo.
4. El respaldo de continuidad alterna exactamente dos frases neutrales por idioma
   (`indiceReserva % 2`). La tercera es exclusivamente el cierre. Garantiza voz
   disponible, pero su repertorio se agota enseguida.
5. Las ventanas no reciben un historial de las ideas y frases efectivamente
   escuchadas. Cambiar una variante por semilla no evita repeticiones cercanas.
6. La comprobación de vigencia descarta correctamente un estado cuando cambia la
   posesión, el vuelo o el sector antes de que empiece el audio. Si la síntesis
   tarda, esto puede aumentar el uso del respaldo. No se ha medido aquí su
   frecuencia en una sesión normal ni un porcentaje de repetición audible.

## Qué aportan los seis ejemplos

| Transcript | Pasajes revisados | Recurso que conviene trasladar |
| --- | --- | --- |
| Argentina–Cabo Verde | Líneas 776–794 y 1220–1232 | Salida desde el fondo, sector y continuidad; alternancia de acción y comentario. También muestra charla ajena y errores que deben excluirse. |
| Alajuelense–Saprissa | Líneas 447–462 y 689–703 | Acción breve antes del gol y reconstrucción posterior; nombres enlazados al volver al juego. |
| Maipú–San Martín | Líneas 303–311 y 343–357 | Reorientar con tiempo, marcador y dueño del saque; separar relato, comentarista y publicidad. |
| España–Argentina | Líneas 328–347 y 905–910 | Construcción de una posesión mediante receptores, retrocesos y cambios de costado; distinguir cambios confirmados de conjeturas. |
| City–Arsenal | Líneas 45–48 y 578–590 | Descripción de una secuencia y análisis posterior al gol; redacción inglesa propia. |
| Madrid–Barcelona | Líneas 414–422 y 519–532 | Conectar recuperación, transición y desenlace; explicar la construcción después del momento decisivo. |

La repetición de un nombre para identificar al poseedor es funcional. La repetición
de una intervención sin aportar información nueva produce la sensación de bucle.
Los ejemplos cambian de función: sitúan, cuentan, reaccionan, explican y vuelven a
la acción. Un catálogo de sinónimos por sí solo no reproduce ese comportamiento.

## Cambio propuesto

- Conservar memoria de frases, temas y hechos ya narrados durante los últimos
  30–60 segundos, como punto inicial a validar. Actualizarla cuando empieza la
  reproducción, distinguiendo lo completado de lo interrumpido. Una frase
  preparada que nunca se escucha no debe marcarse como narrada.
- Seleccionar la función de la próxima intervención según el juego y lo ya dicho:
  jugada, ubicación, balance reciente, marcador/tiempo o explicación de un desenlace.
  Evitar repetir una idea cambiando solamente dos palabras.
- Reconstruir secuencias a partir de eventos confirmados. Para comentarios de
  movimiento, usar trayectorias observadas; para presión o apoyos, exigir evidencia
  adicional. Expresar campo propio/rival, banda y cercanía al área desde una
  orientación declarada, en vez de depender del eje horizontal de la pantalla.
- Reservar cifras para comentarios que aporten algo al momento, en lugar de usar
  el mismo inventario estadístico por calendario. Usar comentarios más largos
  durante circulación tranquila y cláusulas breves ante remates y goles.
- Preparar con el buffer intervenciones basadas en hechos recientes que sigan
  siendo ciertos cuando se reproduzcan. Verificar vigencia antes de hablar y
  permitir que una ocasión importante interrumpa comentarios de menor prioridad.
- Ampliar y seleccionar el respaldo con memoria de uso, manteniendo su carácter
  neutral. Priorizar comentarios útiles del partido sobre muletillas de cobertura.
  Dos clips no bastan para sostener variedad cuando falla la síntesis.
- Mantener consumidores independientes, sincronía al reactivar, ausencia de
  anticipaciones y el requisito de no superar cinco segundos sin voz mientras
  esté habilitada. La descripción sigue mostrando todas las acciones.

Comprobarlo en tramos tranquilos y de peligro, con síntesis lenta o fallida y al
reactivar la voz. Medir repeticiones exactas y de ideas en audio realmente iniciado,
uso del respaldo, antigüedad de las afirmaciones y silencio audible. La naturalidad
requiere además escuchar y comparar; el número de variantes no la demuestra.

## ¿Hacen falta más ejemplos?

No para corregir las causas identificadas y construir una primera guía de estilo.
Los seis archivos ofrecen material suficiente para seleccionar ejemplos de acción,
circulación tranquila, reanudaciones y análisis posterior. La limitación inmediata
es su selección y uso en el sistema.

Si se amplía el corpus, priorizar fragmentos elegidos por su estilo: cinco a diez
minutos de circulación sin ocasiones, una pausa larga y una ocasión con comentario
posterior. Para el inglés conviene ampliar la variedad de voces, pues hay un solo
archivo. Audio alineado sería útil para evaluar entonación y pausas; el texto solo
no conserva esas características de forma fiable.

Antes de usar ejemplos, retirar metadatos duplicados, anuncios, saludos y noticias
de otros partidos; corregir errores de reconocimiento y separar acción, comentario
y conjetura. Conservar los originales y seleccionar patrones, sin trasladar sus
nombres, resultados o antecedentes al encuentro sintético.

## Qué significaría entrenar un narrador

Entrenar modifica los parámetros de un modelo a partir de datos y de un objetivo.
Puede hacerse desde cero, pero para este producto lo relevante sería ajustar un
modelo existente con demostraciones de entradas y narraciones deseadas
(`fine-tuning` supervisado).

Cada ejemplo útil tendría eventos confirmados hasta un instante, estado del juego,
idioma y lo ya narrado como entrada, y la intervención deseada como salida. Un
transcript sin esa relación no enseña por sí solo qué hechos conocía el narrador
ni cómo sincronizar su respuesta con nuestro simulador. Separar partidos completos
entre entrenamiento y evaluación evita probar con fragmentos casi idénticos a los
usados para aprender.

Dar instrucciones y algunos ejemplos en cada solicitud es otra opción: cambia el
contexto de esa solicitud, sin modificar los parámetros del modelo. Para este caso
conviene empezar por selección editorial, memoria y ejemplos de estilo, y evaluar
antes de decidir si un ajuste del modelo aporta una mejora medible. Un ajuste no
reemplaza los eventos del partido actual, el reloj ni la memoria de reproducción.

La redacción y la voz son capas distintas: el sintetizador pronuncia el texto que
recibe. Entrenar el texto no equivale a entrenar la entonación de un locutor.

Referencias consultadas para los conceptos: documentación oficial de OpenAI,
[optimización de modelos](https://developers.openai.com/api/docs/guides/model-optimization)
y [ajuste supervisado](https://developers.openai.com/api/docs/guides/supervised-fine-tuning).
Estas referencias describen el método; aquí no se propone un proveedor ni un
servicio de entrenamiento concreto.

## Implementación

`src/arena/editorial.ts` selecciona intervenciones con claves de hechos y temas.
Conserva hasta doce recuerdos de los últimos sesenta segundos; una idea tiene un
descanso mínimo de quince segundos y los balances, de cuarenta y cinco. Un mismo
hecho no se vuelve a contar durante sesenta segundos. La memoria distingue audio
iniciado, completado e interrumpido. Los goles y otras noticias prioritarias no
se silencian por compartir tema con una anterior.

El navegador envía esa memoria acotada al preparar ventanas y revalida lo recibido
antes de hablar. Solo registra una intervención cuando inicia su fuente de audio.
La entrada al reactivar conserva la obligación de describir el estado actual,
aunque ese tema se hubiera oído antes. Las recepciones enlazadas exigen continuidad
entre los participantes y ausencia de un corte intermedio del rival. El envío
intentado no demuestra quién terminó recibiéndolo.

Los estados expresan campo propio/rival y banda según coordenadas longitudinales y
transversales. La firma de vigencia incluye ahora la banda para descartar una
descripción espacial que haya quedado obsoleta. Las noticias prioritarias conservan
sus instantes y fuentes. Desaparece el inventario estadístico obligatorio cada
quince segundos. Cuando todos los candidatos repiten información, se deja el turno
al respaldo en vez de sintetizar de nuevo la misma frase.

El catálogo contiene doce comentarios neutrales distintos y un cierre por idioma,
26 MP3 reales de Azure Speech. Se sintetizaron 2.039 caracteres de texto. Es un
respaldo sobre conceptos de fútbol, sin afirmar movimientos o intenciones que no
estén comprobados. Se elige primero la frase menos recientemente oída, manteniendo
la cobertura de fallos y demoras de la síntesis dinámica.

Validación y publicación: `docs/evidencia/variedad-narracion/`.

Publicada y comprobada en `cronista-arena--0000008`, ACR `chh`, con 296 archivos
coincidentes con las fuentes locales. Pasaron 1.594 unitarias en 69 archivos,
tipado, build/standalone, dos comprobaciones de empaquetado y 37 escenarios únicos
de navegador entre la corrida general y las correcciones de fixtures.

Con Speech fallido durante cuarenta segundos se oyeron seis respaldos distintos;
el silencio máximo PCM fue de 3,127 s. En el servicio público, con demora controlada
y desactivación/reactivación, se oyeron cuatro intervenciones distintas y la memoria
llegó al servidor. El silencio máximo PCM fue de 3,156 s, excluyendo el apagado
voluntario. Se comprobó un solo contexto de audio, ausencia de anticipaciones,
escritorio y móvil de 360 px sin errores JavaScript ni desborde. Algunas solicitudes
de síntesis devolvieron 429; el respaldo cubrió esas intervenciones no disponibles.
La prueba pública no demuestra que se sintetice o se lea cada noticia seleccionada.
