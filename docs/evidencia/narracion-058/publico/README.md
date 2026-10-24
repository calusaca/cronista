# Smoke público del bloque A del brief 058 (narración por defecto en el directo)

- **Fecha:** 24 oct 2026, 01:36 UTC.
- **Revisión:** la de la arena tras el despliegue del commit `9041246`.
- **Navegador:** Chromium headless con `--autoplay-policy=user-gesture-required`.
- **Script:** `.cache/smoke-058a.mjs`, fuera de git.
- **Modo:** «Programmed demonstration», que no consume el cupo diario de partidos con modelos.

## Resultados

| Comprobación | Resultado |
|---|---|
| Casilla «Narrate the match» marcada por defecto | sí |
| Tras «Start live match», «Turn narration off» con `aria-pressed=true`, sin otro clic | sí (botón visible a los 25,5 s del clic) |
| Nota fija | «Narration started with the match. «Turn narration off» mutes it; this browser remembers your choice.» |
| Botón «Enable audio playback» (autoplay bloqueado) | no aparece: el contexto quedó desbloqueado dentro del clic |
| Respuestas de voz en 20 s | 46 × 200 y 1 × 429 (bolsa de una voz invitada) |
| Errores de JavaScript | ninguno |

Captura: [directo-narracion-activa-1440.png](directo-narracion-activa-1440.png).

## Sin comprobar

- La escucha humana.
- Navegadores distintos de Chromium.
- Por qué el botón tardó 25 s en aparecer: probablemente la creación de la sesión mientras corría el torneo
  en paralelo; pendiente de medir sin carga.
