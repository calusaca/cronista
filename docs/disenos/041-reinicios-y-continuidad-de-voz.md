# Reinicios y continuidad de voz

19 de octubre de 2026. Petición: saque de centro por el equipo que recibió el gol,
saques de banda y esquina visibles, y narración que combine jugadas y comentarios
sin silencios de más de cinco segundos. La continuidad solicitada es la de la voz.

## Reanudaciones

Los nuevos partidos añaden `reglas: "reinicios-v1"`. Los registros existentes sin
esta marca conservan su física original y su reproducción determinista.

El motor conserva el último toque y detecta la primera línea que cruza el balón,
antes de resolver contactos fuera del campo. Los errores de pase pueden salir
del terreno; ya no se recortan siempre a la línea. Un portero puede retener un
remate o desviarlo, con decisión reproducible a partir de la semilla.

- Tras gol, balón inmóvil en el centro y saque por el equipo que recibió el gol.
  Excepto el ejecutor, todos quedan en su propia mitad y los rivales fuera del
  círculo central. La [Regla 8 de IFAB](https://www.theifab.com/laws/latest/the-start-and-restart-of-play/)
  respalda este procedimiento.
- Salida lateral: saque para el rival del último jugador que tocó el balón,
  desde el punto de salida, con separación de los rivales. No se permite gol
  directo desde banda. Referencia: [Regla 15](https://www.theifab.com/laws/latest/the-throw-in/).
- Salida por el fondo sin gol: esquina si tocó el defensor; meta si tocó el
  atacante. Se elige la esquina más cercana al cruce. Referencia:
  [Regla 17](https://www.theifab.com/laws/latest/the-corner-kick/).

Se registran el tipo de saque, equipo, ejecutor, punto y último toque. Una pausa
de 1,5 s permite identificar la reanudación; después el ejecutor pasa a un compañero.
Banda, esquina y meta no generan fuera de juego directo. La interfaz muestra el
saque junto al campo y en la descripción completa, en español e inglés.
La colocación se representa como un corte, sin interpolar jugadores a través del campo.

Es una aproximación 2D con balón puntual: no modela altura, radio completo, manos,
postura de lanzamiento ni todas las infracciones o sanciones de reanudación.
Las faltas y los fueras de juego conservan su procedimiento simplificado.

## Voz continua

La narración selecciona una ocasión relevante o explica el estado publicado del
balón en cada ventana de cinco segundos. Cada quince segundos puede comentar los
conteos observados en los últimos treinta. Un pasaje puede durar hasta 24 s a
velocidad natural; no es necesario leer todas las acciones. La descripción de
texto conserva el historial íntegro.

El consumidor prepara hasta dos solicitudes simultáneas y no anuncia hechos
antes de su cursor. Si pasan dos segundos sin voz, reproduce un comentario neutral
de reserva incluido en el paquete de la aplicación. Son seis MP3 reales generados
con Azure Speech: dos comentarios y un cierre por idioma, 503 caracteres de texto
en total. No dependen de red ni de voces instaladas en el navegador una vez cargada
la aplicación. `scripts/generar-voz-reserva.mts` permite regenerarlos con las
credenciales del entorno; el catálogo no contiene credenciales.

Los comentarios de reserva no afirman marcador, posesión ni acciones inventadas
y no llevan citas de eventos. Un pasaje actual puede interrumpirlos; un gol
conserva prioridad sobre el análisis. La cola nunca superpone voces. El objetivo
de pausa máxima es cinco segundos; el umbral de dos deja margen para arrancar audio.
La voz continúa durante la recuperación automática del búfer. La pausa manual,
una pestaña oculta, desactivar voz o el bloqueo de audio del navegador sí la detienen.
El cierre confirmado termina la narración; si falla su síntesis se usa el cierre
neutral archivado, sin inventar un marcador ni repetir comentarios indefinidamente.

Las plantillas de contexto y la reserva no se presentan como texto LLM verificado.
Los comentarios LLM verificados mantienen su consumidor separado.

## Validación

Pruebas deterministas de goles en ambas porterías, responsable del primer pase,
posición, pausa, bandas superiores/inferiores, esquinas y metas en ambos fondos,
primer cruce de línea, gol directo desde banda, descripción bilingüe y corte visual.
Pruebas de voz sobre hechos pasados, prioridad y sustitución del comentario de reserva.
El navegador mide intervalos de fuentes Web Audio audibles con Speech bloqueado y
fallido, incluyendo recuperación del búfer; no solo la presencia de un texto.

Evidencia y resultados: `docs/evidencia/reinicios-y-voz/`.

Publicación comprobada en `cronista-arena--0000006`: silencio máximo PCM de 3,166 s
durante una observación pública de 22,585 s con Speech real y espera controlada.
Las comprobaciones locales pasan 1.571 unitarias, tipado, dos pruebas de empaquetado
y 118 escenarios únicos de navegador entre corrida general y correcciones (34 de arena).
