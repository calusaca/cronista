# 037 · Generar primero y reproducir desde caché

Solicitud: analizar y comenzar a implementar si mejora la fluidez frente a
producir el partido y la voz mientras se consumen.

El análisis del código es positivo: `GestorSesiones.crear` introduce esperas para
acompasar los avances y los entrenadores detienen el reloj; `ArenaNarracion`
espera el final de un audio antes de solicitar el siguiente. Persistir el partido
no elimina por sí solo estas pausas de la presentación.

## Comportamiento

- La web ofrece «Generar primero» como presentación predeterminada y conserva el
  modo en vivo. El servidor omite las esperas de presentación en generación
  preparada; los modelos siguen observando únicamente el estado causal actual.
- El diario SSE informa del progreso y permite reconectar a la misma sesión.
  El consumidor preparado solo instala el registro completo al terminar; empieza
  pausado en el segundo cero. Nunca presenta un partido parcial como completo.
- Un recurso de reproducción devuelve registro, comentarios y métricas de una
  sesión completa. Releerlo o compartir su ID no vuelve a consultar a modelos.
  Aprovecha la persistencia local/Blob y la retención existente de 24 horas.
- La narración completa solicita todos los tramos antes de reproducir, recupera
  sus audios de la caché durable existente y comprueba que decodifican. Une el PCM
  decodificado en un WAV para una sola pista continua. No hay peticiones de voz
  en las transiciones durante la reproducción. Los límites existentes se mantienen.
- El reloj del audio guía el tiempo visual interpolando dentro de cada tramo.
  La correspondencia es por tramo, sin afirmar sincronía de cada palabra o evento.
  La presentación puede durar más que el partido simulado.
- Cancelar, cambiar idioma o cambiar partido aborta las peticiones pendientes y
  evita instalar resultados atrasados. Una preparación fallida no empieza a medias.
  Una síntesis ya reservada conserva su timeout y termina en la caché aunque se
  desconecte un consumidor; los demás pueden reutilizarla. Los fallos de descarga
  permiten reconectar a la misma sesión sin repetir el partido.

No se reutiliza una partida distinta por coincidencia de semilla: la caché se
identifica por sesión, idioma, versión de voz y contenido del SSML. Un nuevo
partido conserva su propia identidad y consumo; sus espectadores reutilizan el
resultado. La preparación inicial puede tardar; no se promete latencia ni calidad
acústica subjetiva. Implementación y comprobación local antes de publicar.

Implementación local comprobada: 1.537 unitarias, 19 recorridos de arena y cinco
casos finales del modo preparado (20 casos únicos), incluidos los seis MP3 reales
archivados. Typecheck, build, standalone y dos comprobaciones de empaquetado
aprobados. [Evidencia](../evidencia/partido-preparado/validacion.json).
Publicada el 19 de octubre en la [arena de Azure](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena),
revisión `cronista-arena--0000002`. La [comprobación pública](../evidencia/partido-preparado/publicacion.json)
verificó generación programada, inicio pausado, enlace compartido y reproducción
visual sin red. Los seis MP3 del duelo archivado se prepararon como una pista
WAV de 204,528 segundos; los 33 eventos quedaron cubiertos y no hubo peticiones
adicionales de voz durante la reproducción. Búsqueda y final del audio
actualizaron la cancha; móvil oscuro de 360 px sin desbordamiento ni errores JS.
La reproducción se revisó con saltos, sin acreditar escucha humana íntegra.
