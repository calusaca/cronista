# 031 — Relato fluido y reproducción en cancha

**Fecha local:** 2026-10-17 (America/Guatemala). Carlos autoriza avanzar con las
referencias disponibles mientras busca más ejemplos. Amplía el brief 030.
Durante la ejecución incorpora dos transcripts de estilo radio: seis archivos
locales en total, con unas 136.000 palabras tras retirar metadatos de tiempo.
El [análisis con referencias](../evidencia/analisis-transcripts.json) distingue
acción, comentario, publicidad y otros partidos dentro de una retransmisión.

## Decisión y alcance cerrado

Mejorar la continuidad ES/EN conservando cada acción y ofrecer reproducción 2D
sobre la cancha existente. La evaluación del backlog recomienda este alcance
acotado: aprovecha geometría, eventos e identidad ya disponibles; no requiere
otra llamada al modelo, infraestructura nueva ni un motor físico.

Las [reglas oficiales, §6](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)
se consultaron de nuevo: UX/presentación pesa 20 %; implementación, innovación
agéntica, impacto y adecuación a la categoría pesan otro 20 % cada uno.
**Inferencia de diseño:** texto y movimiento vinculados pueden explicar mejor
el valor en una demostración breve. No hay aumento de puntuación medido ni la
animación añade agentes o demuestra una ventaja frente a un único agente.

## Relato

- Primera mención por posesión con nombre y dorsal; después, nombre breve solo
  si identifica inequívocamente al jugador entre las dos plantillas.
- Enlazar recepción y acción siguiente únicamente tras un pase completado al
  actor de la misma posesión. «Devuelve» requiere A→B→A completados; no implica
  pared, primer toque o movimiento sin balón observado.
- Variar verbos sin alterar resultados; evitar la confirmación redundante de
  todos los pases. Conservar nombres, metros y resultados en el registro técnico.
- Mantener una cláusula seleccionable e ID por acción, descarga íntegra y orden.
  La variante detallada sigue disponible para comparar y en el registro técnico.
- Presentar los esquemas iniciales por sus posiciones registradas. No deducir
  cambios tácticos de una sustitución ni copiar hechos/nombres del corpus.
- La radio refuerza la necesidad de reorientar al lector: declarar la perspectiva
  izquierda/derecha y mantener equipos, periodo, minuto y marcador junto a la
  acción activa; no confundir tiempo del video con el del encuentro.

## Reproducción

- Reutilizar las fichas con dorsales, formas/colores de equipo y balón del SVG.
- Reproducir/pausar la jugada seleccionada o el partido; velocidad 0,5×/1×/2×,
  reinicio de la jugada y navegación existente. Empieza detenido, se detiene al
  terminar su alcance, al seleccionar manualmente, al ocultarse o al salir.
- La acción activa selecciona la misma frase y usa el mismo cuadro que el texto.
  Interpolar solo antes→después dentro de cada acción. Entre cuadros puede haber
  un corte por cambio de zona: no inventar recorridos para ocultarlo.
- Duración de lectura ilustrativa, sin segundos de partido inventados, sin audio
  nuevo y sin interpolación si el usuario prefiere movimiento reducido.
- Móvil, teclado, foco, antes/después y detalle técnico conservados; sin llamadas
  API adicionales. Cambios, expulsiones y 2T provienen de los cuadros existentes.

## Verificación

Pruebas semánticas de recepción/devolución/ambigüedad y todos los IDs ES/EN;
interpolación con extremos y límites correctos, sin mutación. Navegador: movimiento
real de ficha y balón, pausa estable, selección sincronizada, final de jugada,
reinicio, velocidad, salto manual, pestaña oculta, movimiento reducido y móvil.
Typecheck, suites completas y recorrido visual antes de publicar en la demo.
Medir la reducción de repetición/longitud como descripción, no como puntuación
de calidad ni comprensión humana demostrada. Corpus original conservado local.
