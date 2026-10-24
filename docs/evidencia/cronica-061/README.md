# Evidencia del brief 061 (v1.1): crónicas con la barra y la paleta de la arena

Implementación del [brief 061](../../disenos/061-cronica-look-arena-y-volver.md), versión 1.1. Todo se midió el
24 de octubre de 2026 contra el build local del e2e (`CRONISTA_LLM=ensayo`, puerto 3417). No hubo inferencia
real ni Speech. **No está desplegado**: faltan el smoke público y la medición de contraste contra el sitio público
(§ 10.4 y § 6.3), que van tras la publicación.

## Qué cambió

- **Núcleo (P1-D, C y B).** Las perspectivas usan `replace`. «Simulate match» con la semilla que ya se ve no
  navega si la perspectiva es neutral (V2). Hay un enlace «← Arena» (`to-arena`) en `/` y `/match/[seed]` (V3).
  La barra de las crónicas es la de la arena (`topbar arena-topbar topbar-cronicas`), con «Match reports ·
  League mode · Data · Arena», `aria-current`, `sim-error` y las reglas de ajuste de V1.
- **Ampliado (P1-A).** Los tokens del `:root` del 010 y sus dos bloques oscuros toman los valores del 047.
  Se conservan `--pitch-line`, `--card-yellow`, `--scrim` y los radios. `--ar-live` cambia con el tema (V5).

## Capturas (viewport; 900 px de alto, 780 a 360 px)

Generadas con `capturas.mjs`. Las de «antes» salen del sitio público (rev. 0000030); las de «después», del build
local. Páginas: `partido-246` (`/match/246`), `portada` (`/`), `liga`, `datos` y `arena`, para cotejar.

| Página | Antes (público, 0000030) | Después (local) |
| --- | --- | --- |
| `/match/246` | `antes-partido-246-{360,1440}-{claro,oscuro}.png` | `despues-partido-246-{360,960,1440}-{claro,oscuro}.png` |
| `/` | `antes-portada-…` | `despues-portada-…` |
| `/liga` | `antes-liga-…` | `despues-liga-…` |
| `/datos` | `antes-datos-…` | `despues-datos-…` |
| `/arena` (referencia) | `antes-arena-…` | `despues-arena-…` |

Lado a lado, por ejemplo: [crónica, 1440, claro](despues-partido-246-1440-claro.png) frente a
[arena, 1440, claro](despues-arena-1440-claro.png), y [crónica, 360, oscuro](despues-partido-246-360-oscuro.png)
frente a [arena, 360, oscuro](despues-arena-360-oscuro.png).

## Contraste (§ 6.3 + V4)

`contraste.mjs` mide sobre estilos computados en `/match/246`, con la primera frase seleccionada, el error de la
barra visible (semilla «abc») y la caja de cristal abierta en la frase corregida del LLM de ensayo, a 1440 y
360 px. Resultado local: **0 pares fuera de criterio** en claro y en oscuro
([claro](contraste-claro.txt), [oscuro](contraste-oscuro.txt)). Las cifras coinciden con las previstas en el
brief: por ejemplo, la barra 16,20 / 18,72, `.sim-error` 8,20, `.volver-arena` 5,67 (claro) y 16,20 (oscuro),
`.verdict.rejected` 5,81 / 8,20, `--card-yellow` 3,41 / 6,94, y el punto del emblema 3,57 / 6,13.

Repetir (con el servidor del e2e levantado):

```sh
node docs/evidencia/cronica-061/contraste.mjs --tema=claro > docs/evidencia/cronica-061/contraste-claro.txt
node docs/evidencia/cronica-061/contraste.mjs --tema=oscuro > docs/evidencia/cronica-061/contraste-oscuro.txt
# Contra el público, tras desplegar (la caja de cristal pasa a opcional):
node docs/evidencia/cronica-061/contraste.mjs https://<sitio> --publico
```

## Límites

- Entre 1280 y ≈ 1440 px la barra va en una sola fila, como pide V1, y la navegación se parte en dos filas
  (en tres a 1280 con el error visible). No hay desborde, pero la barra es más alta; el tope de 1279 no se subió
  porque la regla de V1 solo lo permite si hay desborde.
- «← Arena» es un `push` a `/arena`, no una vuelta: no restaura `?partido=`, fragmentos ni un directo.
- La pizarra 3D en oscuro tiene suelo azul noche y líneas de ≈ 1,95 (cifra estimada en el brief, no medida aquí) hasta el P2-b.
- El contraste se mide por pares elegidos; no cubre hover ni la pizarra 3D.
