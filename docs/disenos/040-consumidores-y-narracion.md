# Emisión: consumidores independientes y narración selectiva

19 de octubre de 2026. Implementa la separación acordada entre generación completa, reproducción del partido, descripción exhaustiva y narración selectiva.

## Contrato de sincronización

El productor conserva eventos, identificadores y ticks en el mismo registro incremental. La cancha y la descripción usan el cursor de presentación. El consumidor de voz prepara sus propios pasajes por adelantado, pero solo puede iniciar uno cuando el cursor visible alcanza el tick de todos los hechos que contiene. Recibir datos futuros permite preparar trabajo; no permite anunciarlo antes.

La disponibilidad de voz deja de formar parte del límite del reloj visual. Tanto el reloj como su reserva dependen únicamente del prefijo del partido. Activar/desactivar la narración, esperar una síntesis, decodificar audio o recibir un error no reinicia ni detiene ese reloj. El final visual se reconoce por el mensaje `fin` o por una instantánea que ya contiene el final del juego; no espera la terminación de los comentarios LLM.

Una pausa solicitada por el espectador suspende el audio y el cursor. Al volver, ambos se reanudan sin saltar jugadas. Una demora de producción que agote los datos disponibles sí exige recuperar reserva: este cambio elimina la dependencia de voz, no garantiza disponibilidad ilimitada de datos o red.

El [brief 041](041-reinicios-y-continuidad-de-voz.md) amplía esta revisión para
mantener continuidad de voz; sustituye la posibilidad de ventanas sin narración
por contenido del estado actual y una reserva de audio local.

## Narración de la emisión

- Se siguen examinando ventanas de cinco segundos para detectar noticias. Esto no obliga a pronunciar una frase en cada ventana.
- Goles, tarjetas, ocasiones y cambios tienen prioridad sobre comentarios generales. En los intervalos de contexto de quince segundos, una infracción menor puede ceder su lugar al análisis de la secuencia observada.
- El contexto usa los últimos treinta segundos disponibles hasta su propio tick: intentos de pase, recepciones, remates y recuperaciones. Evita presentar recepciones de la ventana como una fracción de sus intentos: un pase puede haber comenzado antes de la ventana.
- Los pasajes se reproducen a velocidad natural del audio sintetizado. Admiten hasta 24 segundos, de modo que una intervención puede atravesar varias jugadas. La prosodia expresiva de Speech se conserva; no se acelera el audio para encajarlo en cinco segundos.
- Los pasajes normales que esperan más de ocho segundos se descartan; los importantes tienen hasta doce segundos. Esto limita cuándo pueden comenzar, no recorta un pasaje que ya está hablando.
- Una noticia de prioridad 80 o superior interrumpe una intervención de prioridad menor. El gol tiene prioridad 100. Dos pasajes no se superponen.
- Se mantienen como máximo dos solicitudes de voz simultáneas y se prepara hasta 25 segundos por delante. Las solicitudes obsoletas se retiran del consumidor sin detener el partido. El servidor puede terminar una síntesis ya reservada y conservarla en caché compartida.
- Un error afecta a ese pasaje; el consumidor sigue intentando preparar los siguientes momentos. La transcripción muestra únicamente el pasaje que comenzó a hablar, con sus fuentes, nunca las frases futuras almacenadas.
- El cierre es un pasaje separado que requiere el final confirmado, incluye el marcador y puede sonar después de que la cancha llegue al final. No altera la duración del partido.

El relato de emisión sigue utilizando plantillas derivadas de eventos y conteos. Los comentarios LLM verificados continúan como consumidor adicional. No se presenta el contexto por plantillas como texto generado por un modelo ni como prosa pasada por el verificador de crónicas.

La escucha completa de una grabación conserva su recorrido específico ya existente. Este cambio trata la emisión **En vivo**, cuya reproducción ya no usa la voz como reloj maestro.

## Descripción completa

El panel junto a la cancha mantiene una vista de las últimas acciones y enlaza la descripción completa. Esta conserva todas las acciones confirmadas hasta el cursor visible. Se presenta en páginas de cuarenta eventos para acotar el trabajo de renderizado, sin descartar eventos del registro. Permite avanzar, retroceder y volver a seguir el partido. Al retroceder el cursor del partido, el historial también deja de mostrar los eventos que todavía no han ocurrido en ese instante.

## Validación

Pruebas unitarias de sincronización, prioridad, duración natural, contexto sin hechos futuros y cierre. Pruebas de navegador con una síntesis bloqueada mientras siguen moviéndose el reloj y los jugadores, error de voz, cambio de idioma, pasaje de quince segundos interrumpido por un gol y cierre que continúa después del final visual. El historial se recorre completo y se compara por identificadores con el registro original.

La evidencia se conserva en `docs/evidencia/consumidores-arena/`. Las pruebas automáticas usan voz simulada o MP3 archivados y no generan inferencias de pago.

Publicada y comprobada en la revisión `cronista-arena--0000005`. La [comprobación pública con Speech real](../evidencia/consumidores-arena/navegador-publico.json) confirma avance durante la espera de voz y al desactivarla, preparación de audio de 11,856 segundos y reproducción a velocidad natural.
