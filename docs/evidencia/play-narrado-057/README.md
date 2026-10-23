# Brief 057: evidencia local (Reproducir con narración, gol en la red y vista del arco)

Fecha: 22–23 de octubre de 2026. Implementación por Opus del [brief 057 v1.2](../../disenos/057-play-narrado-y-gol.md).
Todo lo que hay aquí sale de pruebas **locales**: build de producción en el puerto 3417, con Speech y LLM
**simulados**. No se llamó a Azure Speech ni a ningún LLM. El smoke público con Speech real (criterio 10.7)
**sigue pendiente**.

## Capturas (las genera el e2e)

| Archivo | Qué muestra | Prueba |
| --- | --- | --- |
| `barra-preparando-1440-claro.png` | «Play without narration», «Preparing narration 0/3», velocidad 1× bloqueada, conmutador «With narration» marcado y texto de ayuda | `e2e/arena-play-narrado.spec.ts`, prueba principal |
| `barra-sonando-1440-claro.png` | Pista sonando: el botón dice «Pause» y la cancha sigue a la voz | igual |
| `barra-preparando-360-oscuro.png`, `barra-sonando-360-oscuro.png` | 360 × 780, oscuro, movimiento reducido: sin desborde | prueba de 360 px |
| `gol-red-recuadro-izquierdo-1440-claro.png`, `gol-red-recuadro-derecho-1440-claro.png` | Balón dentro de la red (fuera de la línea), 22 fichas quietas en el fotograma previo, rótulo «Goal» y vista frontal del arco en la esquina del arco batido | `e2e/arena-gol-visual.spec.ts`, prueba B1 |
| `gol-recuadro-360-oscuro-reducido.png`, `gol-recuadro-360-claro.png`, `gol-recuadro-1440-oscuro.png` | Vista del arco a 360 y 1440 px, claro y oscuro; sin desborde | prueba B2 |
| `contraste-057.txt` | `contraste.mjs` contra el build local, ejemplo de entrenadores IA, segundo 26,5 (gol 1 en celebración) | ver abajo |

Las capturas del gol usan el ejemplo público `arena-llm-v3.json`, que no tiene reglas de reinicio: tras la red
se corta al portero con el balón, **no** al centro (declarado en § 12 del brief). El corte al centro con
«Kick-off» se comprueba con el fixture `arena-reinicios-v5` importado (prueba M11 del e2e), sin captura.

## Contraste (criterio 10.6)

`node docs/evidencia/rediseno-047/contraste.mjs http://127.0.0.1:3418/arena 26.5 --cargar=ejemplo-v3`
(Node 24): **0 pares fuera de criterio**. Los pares nuevos dan 16,2 tanto para el texto de la figcaption sobre
la caja (mínimo 4,5) como para los postes sobre la caja (mínimo 3), en los dos temas. La caja es `color-mix(--ar-score-bg 92 %,
transparent)`; el script mide contra el color sin componer (no aplica el 8 % de transparencia sobre el
césped). La comprobación estática de la regla 047 (`src/ui/css-047.ts`) corre al principio del script y no
encontró violaciones.

## Resultados de las suites (vistos correr)

- `npm test`: 101 archivos, 2390 pruebas en verde (2391 tras el seguimiento).
- `npm run typecheck`: sin errores. `npm run build`: compila. No hay script de lint en el repositorio.
- `npx playwright test` (suite completa, build de producción, puerto 3417): **180 passed** en la primera entrega. Tras el
  seguimiento la suite tenía 185 pruebas, que no se corrieron completas entonces. Tras v1.3: **190 passed**, la suite completa vista correr.

## Seguimiento del 23 de octubre

- **Escudo del rótulo de gol.** En la primera tanda de capturas, el escudo del rótulo de gol ocupaba casi
  toda la cancha. Era un defecto anterior, causado por `.arena-pitch-wrap svg { width: 100% }`, y el
  coordinador lo corrigió a `.arena-pitch-wrap > svg`. Todas las capturas de esta carpeta se rehicieron
  después de la corrección. Regresión: `e2e/arena-gol-visual.spec.ts`, prueba «regresión · el escudo del rótulo…»,
  a 1440 y 360 px. La mutación al selector antiguo la pone en rojo.
- **Revisión de Codex (iteración 1).** Tres hallazgos corregidos, cada uno con su prueba y su mutación en rojo:
  - Ninguna petición de relato se inicia en el idioma nuevo tras cambiar de idioma; la prueba cuenta los fetch iniciados.
  - Los resultados tardíos de `audio.play()` se descartan; se prueba con `play()` retenido.
  - La comprobación estática 047 resuelve `:is()`/`:where()` y las comas internas.
- **Suites rehechas:** `npm test` 101 archivos y 2391 pruebas; `typecheck` en verde; `npx playwright test e2e/arena` 101 passed.

## Versión 1.3 (iteración 2 de 3)

- La subida que recibe un 429 se reintenta una sola vez y solo si `retry-after` ≤ 5 s
  (`PLAY_NARRADO.subida.reintentoMaxS`). Con un `retry-after` mayor, la degradación es inmediata:
  «Too many uploaded recordings; narration returns in N min. Playing without voice.» /
  «Demasiadas grabaciones subidas; la narración vuelve en N min. Reproduciendo sin voz.».
- En la fase «pulsar», el play del control nativo pasa la barra a Pausa.
- Reproducir arranca la pista en el cursor: con el cursor en 0:15, el reloj queda ≥ 0:14.
- La rama `{"archivo"` vuelve al tope de 16 KB, y un esquema inválido responde 400 «Cuerpo inválido».
- `css-047` respeta comillas y escapes.
- Mutaciones en rojo: Mv13a–Mv13f.
- Suites: `npm test` 101 archivos y 2395 pruebas; `typecheck` en verde; e2e completo **190 passed**.
- Límite (v1.3, punto 7): tras un 429 que cancela el cuerpo, un cliente con keep-alive puede ver `ECONNRESET`
  en la petición siguiente. El navegador lo trata como `sin-sesion`.

## Límites

- Speech simulado: las pruebas usan WAV de silencio y `construirRelato` real. No hay escucha humana ni
  medición del gasto real.
- La altura del balón en la vista del arco es ilustrativa: se deriva de la distancia del remate, porque el
  motor no registra altura. El balón está dibujado a escala esquemática (radio de 0,18 m).
