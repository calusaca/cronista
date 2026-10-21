# Evidencia del brief 045 (Tres voces)

- `codex-revision-v1.md`: revisión de diseño de Codex (GPT-6.1 Sol vía `npx @openai/codex exec`, solo lectura, 20 de octubre de 2026) sobre la versión 1 del brief; 15 hallazgos, todos incorporados en la versión 2.
- `codex-revision-v2.md`: segunda revisión (21 de octubre de 2026) sobre la versión 2: 9 de 15 resueltos, 6 parciales, cinco bloqueos nuevos y confirmación del hallazgo propio sobre el atraso del plan de voz; veredicto NO CERRADO. Todos resueltos en la versión 3 del brief (marcas **[v3]**).
- Catálogo de voces consultado en solo lectura el 20 de octubre: existen `es-MX-GerardoNeural` y `en-US-DavisNeural`; Dalia y Gerardo sin estilos, Guy con `newscast`, Davis con `chat`.

## Implementación (21 de octubre de 2026)

- `codex-implementacion-1.md` y `auditoria-implementacion-1.md`: primera iteración sobre la implementación de la versión 3 (Codex y `auditor-adversario`). Veredicto común: no listo; un hallazgo mayor (oración larga del comentarista que rompía la memoria de escucha) y varios menores. Todos se convirtieron en las correcciones C1–C12 de la versión 3.1 del brief.
- `codex-implementacion-2.md`: segunda iteración sobre la versión 3.1. Los seis hallazgos previos resueltos; quedan tres (duración máxima de invitados en el replay, total de progreso y memoria ignorada en la ruta), corregidos en la iteración 3.
- `comentarista-azure-real.json`: dos llamadas reales del comentarista a Azure OpenAI (GPT-6.1 Sol) con el esquema estricto que incluye `maxLength`; ambas en modo `llm`, una aceptada al segundo intento tras un rechazo de V1–V8.

## Publicación y smoke público (21 de octubre de 2026)

- Imagen `arena-20261021134105`, revisión `cronista-arena--0000010` con el 100 % del tráfico (`../azure-arena-publicacion.json`).
- `smoke-publico.json`: partido real de 60 s (semilla 27103) con dos controladores Azure OpenAI. El diario publicó siete intervenciones: cuatro del comentarista, todas en modo `llm` y aceptadas por V1–V8, y tres del estadista, deterministas. SSE, reproducción e instantánea exponen los mismos identificadores, y un identificador desconocido devuelve 404.
- Audio real de Speech por rol e idioma (`publico-*.mp3`): narrador `es-MX-JorgeNeural`/`en-US-JennyNeural`, comentarista `es-MX-DaliaNeural`/`en-US-DavisNeural`, estadista `es-MX-GerardoNeural`/`en-US-GuyNeural`. Cada clip trae la cesión del narrador y el texto del invitado, dos `<voice>` en un mismo SSML. Las voces se comprobaron por la asignación publicada y los bytes devueltos; nadie las escuchó.
- `navegador-publico.json` y `mesa-publica-*.png`: Chromium contra la URL pública, en escritorio y a 360 px, con el partido compartido. La Mesa muestra las tres tarjetas al final, sin errores JS, sin respuestas 5xx y sin desborde horizontal.
- Coste de Speech: el texto de los invitados suma unos 970 caracteres en ES y 951 en EN por partido de 60 s. Es una estimación a partir del texto, no un conteo de llamadas. Desde la v3.1 cada intervención tiene un SSML único por idioma, así que la caché la comparte entre espectadores.
