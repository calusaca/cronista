# Evidencia del brief 044 (20 de octubre de 2026)

Publicación de la arena con las correcciones del motor: revisión
`cronista-arena--0000009`, imagen `arena-20261020065222`, commit `5f89c16`.

- `smoke-publico.json`: smoke HTTP contra el servicio público. Catálogo, partida de
  60 s con dos controladores Azure OpenAI (`equilibrado` y `rapido`), flujo SSE
  hasta `completa`, registro con `reinicios-v3`, reproducción consistente, voz y
  analista. Generado con una copia de `.cache/probar-arena-publica.mjs` que escribe
  en esta carpeta y comprueba las reglas.
- `voz-publica-es-0-10.mp3`: audio real devuelto por `/relato` para los primeros
  10 segundos de esa partida.
- `navegador-publico.json`, `arena-publica-desktop.png`, `arena-publica-mobile360.png`:
  carga de `/arena` en Chromium headless a 1440 px y 360 px; errores JS, respuestas
  5xx y desbordamiento horizontal registrados (ninguno).
- `../azure-arena-publicacion.json`: salida del script de publicación.

Límites: una sola partida corta; no se midió latencia de voz ni calidad de las
decisiones de los modelos. Los comprobadores archivados de entregas anteriores
esperan `reinicios-v2` y ya no aplican a partidas nuevas.
