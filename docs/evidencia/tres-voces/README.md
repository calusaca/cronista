# Evidencia del brief 045 (Tres voces)

- `codex-revision-v1.md`: revisión de diseño de Codex (GPT-6.1 Sol vía `npx @openai/codex exec`, solo lectura, 20 de octubre de 2026) sobre la versión 1 del brief; 15 hallazgos, todos incorporados en la versión 2.
- `codex-revision-v2.md`: segunda revisión (21 de octubre de 2026) sobre la versión 2: 9 de 15 resueltos, 6 parciales, cinco bloqueos nuevos y confirmación del hallazgo propio sobre el atraso del plan de voz; veredicto NO CERRADO. Todos resueltos en la versión 3 del brief (marcas **[v3]**).
- Catálogo de voces consultado en solo lectura el 20 de octubre: existen `es-MX-GerardoNeural` y `en-US-DavisNeural`; Dalia y Gerardo sin estilos, Guy con `newscast`, Davis con `chat`.

## Implementación (21 de octubre de 2026)

- `codex-implementacion-1.md` y `auditoria-implementacion-1.md`: primera iteración sobre la implementación de la versión 3 (Codex y `auditor-adversario`). Veredicto común: no listo; un hallazgo mayor (oración larga del comentarista que rompía la memoria de escucha) y varios menores. Todos se convirtieron en las correcciones C1–C12 de la versión 3.1 del brief.
- `codex-implementacion-2.md`: segunda iteración sobre la versión 3.1. Los seis hallazgos previos resueltos; quedan tres (duración máxima de invitados en el replay, total de progreso y memoria ignorada en la ruta), corregidos en la iteración 3.
- `comentarista-azure-real.json`: dos llamadas reales del comentarista a Azure OpenAI (GPT-6.1 Sol) con el esquema estricto que incluye `maxLength`; ambas en modo `llm`, una aceptada al segundo intento tras un rechazo de V1–V8.
