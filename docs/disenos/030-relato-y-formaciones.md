# 030 — Relato espacial y formaciones

**Fecha:** 2026-10-17. Carlos aprueba combinar resumen y detalle; pide una
narración que permita imaginar la cancha, con dorsales, posiciones, dirección
del balón y apoyos, además de las formaciones de ambos equipos.

## Experiencia

- Conservar la crónica principal y cada acción del brief 029. «Partido completo»
  abre un relato por jugadas/posesiones; «Cada acción» conserva el registro.
- Relato ES/EN conectado, con nombres y dorsales reales de la plantilla, zonas,
  canales, distancias/resultados y eventos especiales. Cada frase selecciona su
  acción en una cancha; se puede avanzar/retroceder sin llamadas al modelo.
- Agrupar todos los IDs una sola vez, sin ocultar acciones al paginar. Búsqueda,
  salto al minuto y descarga del relato entero; la descarga original se conserva.
- Cancha con ambos equipos, balón, actor/receptor y trayecto. Explicar siempre
  desde qué perspectiva se dice izquierda/derecha; cambiar los arcos en el 2T.
- «Formaciones» tiene entrada propia y muestra dibujo, dorsales, nombres y líneas
  del equipo. Calcular el esquema de los jugadores realmente en cancha: los
  titulares actuales son 4-3-3; no ofrecer formaciones ficticias seleccionables.
  Consultar las alineaciones al inicio y en cada acción, incluidos cambios/rojas.
- Móvil, claro/oscuro, teclado y foco; no revelar el futuro durante el replay.

## Datos y límites

`Jugador` ya registra dorsal y POR/DEF/MED/DEL. `MicroEvento` ya registra zona,
canal, posesión, nombres, distancia y resultado. Una capa geométrica pura genera
una **reconstrucción esquemática**, con procedencia explícita: no hay tracking ni
se conocen coordenadas precisas o desmarques observados. Sus direcciones y apoyos
son modelados y se distinguen de las distancias/zonas de los eventos originales.
Las frases espaciales se derivan del mismo cuadro que se dibuja, nunca de una
inferencia libre del LLM. No afirmar segundos exactos, intención, rivales
superados o una causa táctica no registrada. No cambiar el stream macro/micro,
resultados, dataset, prompts, Verificador ni evaluación histórica.

Los tres enlaces únicos de YouTube proporcionados por Carlos se intentaron abrir;
no se pudieron reproducir/obtener transcripciones. No se afirma haber escuchado
sus narraciones ni se copian grabaciones o comentarios. Su ejemplo escrito guía
el estilo. No se incorpora metraje real al mundo ficticio.

Referencias proporcionadas (no reproducidas): [1](https://www.youtube.com/watch?v=tq4A5U4SP3w),
[2](https://www.youtube.com/live/R2mx12xNHzc),
[3](https://www.youtube.com/watch?v=9gyv2xh7qQw).

## Verificación

Cobertura/orden exactos, agrupación causal, dorsales, continuidad verbal,
esquemas calculados, sustituciones/expulsados, orientación del 2T y prefijos.
Coordenadas acotadas y trayectos/apoyos consistentes con su propio modelo;
procedencia visible. Navegador: las tres vistas, frase→cancha, navegación,
búsqueda/minuto, descargas completas y accesibilidad/móvil. Suites existentes,
build/CI y prueba del despliegue real antes de darlo por publicado.
