# 038 · Emisión casi en vivo con búfer

Carlos confirmó que la reproducción preparada es más fluida, pero el objetivo es
comenzar mientras el partido sigue generándose, con una reserva de 10–20 segundos.
Se conserva la reproducción completa del brief 037 y se añade una presentación
`buffer`, predeterminada en la web, con objetivo inicial de 20 segundos.

## Producción y consumo

El productor llena los primeros 20 segundos sin esperas de presentación. Desde
ese momento usa plazos absolutos a velocidad normal, con 20 segundos de adelanto
respecto a su reloj de emisión. Una decisión lenta consume reserva; al responder,
el motor puede recuperar su adelanto sin sumar esa demora a todas las rondas.
No cambia las observaciones causales, el horizonte de 30 segundos de los equipos,
las reglas del motor ni los límites de inferencia.

El consumidor conserva el prefijo creciente y usa su propio cursor interpolado.
Recibir una actualización no mueve la cancha hasta el estado recién recibido.
Empieza con 20 segundos utilizables. Si agota la reserva, se detiene explícitamente
y espera 10 segundos para continuar; al terminar la generación, drena el contenido
restante aunque sea menor. Pausar o esconder la pestaña detiene al espectador,
mientras el partido sigue generándose para los demás.

La ruta `GET /api/arena/sesiones/ID/emision` ofrece una instantánea del prefijo,
comentarios, estado y cursor del diario. La conexión SSE continúa desde ese cursor,
sin reconstruir ni generar otro partido. El enlace
`/arena?partido=ID&vista=buffer` incorpora a otro espectador aproximadamente
20–25 segundos detrás del frente disponible, alineado con las ventanas de voz.
Una reconexión nativa del SSE mantiene la secuencia y el cursor de reproducción.
Una reconexión manual vuelve a obtener una instantánea cerca del frente.

## Narración

La voz sigue siendo opcional. Al activarla se preparan ventanas de cinco segundos
por delante de la reproducción, con una intervención breve por ventana. Se
priorizan goles, expulsiones, ocasiones e incidencias; los pases rutinarios se
resumen y puede haber silencios. No pretende narrar todos los eventos. La voz
expresiva y el relato exhaustivo del modo preparado se conservan.

El navegador decodifica los audios antes de marcar una ventana como utilizable.
La reserva efectiva es el mínimo entre los movimientos disponibles y la voz
preparada. Web Audio programa las intervenciones en un reloj continuo que comparte
la cancha; las solicitudes siguientes no esperan al final del audio anterior.
Cada intervención comienza a partir del tick del hecho que describe. Las frases
ordinarias demasiado rezagadas se omiten; un gol puede interrumpir la intervención
anterior. La reproducción visual mantiene velocidad normal, sin alargarse para
recitar toda la crónica. Se acepta audio de hasta seis segundos, con ajuste máximo
1,2× para ocupar cinco; si la voz falla o excede ese límite, se informa y continúa
la reproducción visual. El espectador puede reactivar la voz.

Cambiar idioma, desactivar narración o abandonar la emisión aborta las peticiones
del consumidor y retira las fuentes de audio anteriores. Las síntesis ya reservadas
conservan su timeout y la caché compartida existente. Las ventanas se identifican
por sesión, idioma, SSML y versión de voz, reutilizables por otros espectadores.
Retención de 24 horas y presupuestos anteriores conservados.

## Límites y comprobación

Los 20 segundos expresan contenido preparado, no una espera inicial ni un retraso
máximo garantizados. El primer modelo puede tardar más y el plazo actual de
decisión sigue siendo 60 segundos. La caché, red y síntesis también añaden espera.
Un espectador que pausa puede quedar más atrás del frente. Los partidos de hasta
20 segundos pueden terminar antes del arranque. La sincronización es por
intervención, no por palabra. El esquema continúa siendo un prototipo de fútbol
sintético, sin validación profesional ni medición subjetiva de calidad acústica.

La validación cubre producción acotada, retrasos y recuperación, instantánea más
SSE sin huecos, determinismo del registro, cancelación y persistencia, fuentes de
voz sin hechos futuros, reloj real de audio, petición adelantada de ventanas,
respuestas atrasadas al cambiar idioma, fallos de voz, incorporación de otro
espectador y recuperación tras una espera prolongada. Se conserva la batería del
modo preparado. Evidencia y estado de publicación en
[`docs/evidencia/emision-buffer/validacion.json`](../evidencia/emision-buffer/validacion.json).

Publicada el 19 de octubre en la [arena de Azure](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena),
imagen `arena-20261019183630`, revisión `cronista-arena--0000003`, compilación ACR
`chb` correcta. Typecheck, build, standalone, dos comprobaciones de empaquetado,
1.544 unitarias en 66 archivos y 25 recorridos de arena aprobados. Los 288 archivos
enviados y los 13 hashes de la validación local coinciden con las fuentes finales.
La [comprobación pública](../evidencia/emision-buffer/publicacion.json) con equipos
programados empezó con 20 segundos generados antes del final del partido de 60,
restauró otro espectador sin otra creación y preparó seis ventanas reales de voz
por delante. Una fuente de voz llegó a su final natural en el navegador; pausa y
reanudación coordinaron audio y cancha. Móvil oscuro de 360 px sin desbordamiento
ni errores JS. No acredita escucha humana íntegra, calidad subjetiva o un benchmark
de latencia con equipos LLM.
