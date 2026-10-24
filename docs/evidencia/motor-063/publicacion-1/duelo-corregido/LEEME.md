# Brief 063 · publicación 1 · `persecucionPerdedor` con el robo en duelo corregido

Hallazgo P2 de Codex sobre la publicación 1: `src/arena/metricas-lote.ts` detectaba el robo en duelo solo
porque el poseedor cambiaba entre dos muestras sin vuelo en la primera. Un pase soltado e interceptado en el
mismo paso, o un remate atajado en ese paso, daba la misma transición y contaba como duelo.

Corrección (commit `aa986f1`, solo el helper; el motor `reinicios-v6` no cambia): el paso entre las dos
muestras debe tener como único evento no neutro una `recuperacion` sin pasador del nuevo poseedor
(`roboEnDuelo`). Quedan fuera pases, tiros, intercepciones, atajadas, reinicios, faltas y fueras de juego.
Pruebas sintéticas en `src/arena/__tests__/metricas-lote.test.ts`.

Lotes vueltos a medir en un árbol limpio en `aa986f1` (`arbolConCambios: false`), con programados y 120 s:

| Lote | Reglas | `persecucionPerdedor` antes | después | muestras antes → después | Banda | Incumplimientos |
| --- | --- | --- | --- | --- | --- | --- |
| 1–30 (`rapido`) | v6 | 0,470 | **0,476** | 2 009 → 1 712 | ≥ 0,38 | ninguno |
| 1–100 (`completo`) | v6 | 0,471 | **0,476** | 7 103 → 5 807 | ≥ 0,40 | ninguno |
| 101–200 (`completo`) | v6 | 0,483 | **0,483** | 7 470 → 6 236 | ≥ 0,40 | ninguno |
| 1–100 (contraste) | v5 | 0,304 | **0,307** | 7 190 → 5 848 | debe incumplir ≥ 0,40 | incumple (como antes) |

Lectura: la definición corregida descarta entre un 15 % y un 19 % de las muestras (las transiciones que no
eran duelos), y la fracción apenas se mueve. v6 sigue dentro de su banda en los tres lotes y v5 sigue
incumpliéndola. No se cambió v6 ni ninguna banda. `repliegueCorren` y `repliegueSeleccion` no dependen de esta
corrección y dan las mismas cifras que en los JSON originales de la carpeta superior.

Archivos: `v6-lote-1-30.json`, `v6-lote-1-100.json`, `v6-lote-101-100.json` y `v5-contraste-1-100.json`, salida de
`node --import tsx src/arena/metricas-lote-cli.ts --desde D --semillas N --reglas R --salida …`.
