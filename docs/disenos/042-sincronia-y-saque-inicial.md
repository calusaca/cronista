# Sincronía de voz y saque inicial

19 de octubre de 2026. Autorizado tras analizar dos problemas: reactivar la voz
podía reproducir jugadas anteriores y el estado inicial todavía era juego abierto.

## Entrada y reproducción de voz

La primera activación crea el consumidor de audio. Cada activación solicita una
entrada con `entradaTick`, anclada al cursor visible al hacer la solicitud. El
servidor describe el último estado publicado anterior o simultáneo a ese instante,
sin seleccionar el gol u otra noticia anterior de la misma ventana de cinco segundos.
Las fuentes, posiciones y conteos de la entrada tampoco incorporan datos posteriores.

Apagar la narración detiene la fuente audible y suspende el contexto, conservando
audio preparado y solicitudes futuras. La preparación sigue leyendo el cursor del
partido después de esa primera activación. Encenderla reutiliza ese contexto y
descarta intervenciones anteriores a la nueva activación, incluida una respuesta
de entrada de una activación pasada. Un cambio de sesión o idioma sí descarta el
consumidor y cancela sus solicitudes.

Una intervención puede iniciar hasta tres segundos después del instante que
describe; antes se admitían ocho o doce. Se conservan la duración natural y el
cierre posterior al final. Los comentarios de secuencias pueden durar más y las
acciones de prioridad 35 o superior, incluidos saques y remates, interrumpen un
comentario de menor prioridad. No se lee cada pase.

Las frases de estado se acortan y llevan una firma de posesión, vuelo o saque y
sector del campo. Si ese estado ya cambió cuando llega el momento de reproducirlas,
se descartan. La reserva neutral del brief 041 sigue cubriendo silencios de dos
segundos sin afirmar hechos inventados. La síntesis lenta puede retrasar la primera
frase específica; se conserva la continuidad sin reproducir una jugada caducada.

## Balón en el punto central

Los nuevos registros usan `reglas: "reinicios-v2"`. Tanto el inicio como el saque
posterior al gol usan la misma colocación: balón en `(52,5; 34)`, inmóvil durante
la pausa de 1,5 s y primer pase desde ese punto. Inicialmente saca el local; después
del gol lo hace el equipo que lo recibió. Los demás jugadores están en su mitad y
los rivales fuera del círculo central.

La colocación comprime las líneas de la formación hacia su mitad, conservando su
separación; el recorte de x usado anteriormente podía superponer compañeros. La
colocación es un corte explícito en la reproducción, con evento de saque inicial
en el instante cero que se conserva también en la publicación incremental.

Los registros sin marca y los `reinicios-v1` mantienen sus reglas anteriores. Se
archivó un registro de la revisión pública 0000006 para comprobar su reproducción
exacta con este motor, además de los ejemplos v1/v2/v3 existentes. Los demás límites
de arbitraje y de la aproximación 2D siguen documentados en el brief 041.

## Comprobación

Doce formaciones: balón central durante toda la pausa, primer toque y distancias.
Goles a ambas porterías y saque por el equipo receptor. Reconstrucción por SSE y
reproducción determinista de registros actuales y anteriores.

Voz: entrada a mitad de ventana sin repetir el gol anterior, ausencia de hechos
futuros, vencimiento a tres segundos y prioridad de saques/remates. Chromium activa,
silencia y reactiva durante el partido; una respuesta de entrada llega tarde y el
gol ocurre mientras la voz está apagada. Se comprueba un solo contexto, reutilización
de preparación futura y entrada desde el cursor actual. Los casos anteriores de
continuidad, pausa, cambio de idioma, error de síntesis y cierre se conservan.

Resultados y publicación: `docs/evidencia/sincronia-arena/`.

Publicada y comprobada en `cronista-arena--0000007`. Pasaron 1.586 unitarias, tipado,
dos pruebas de empaquetado y 35 escenarios de arena entre la corrida general y focos
corregidos. Speech real confirmó un solo contexto al reactivar, entrada del tick
170 en el segundo 17 y gol del tick 275 narrado en el segundo 27. Silencio máximo
PCM de 3,182 s, excluyendo el apagado voluntario del espectador.
