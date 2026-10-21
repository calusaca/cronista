# Investigación previa al brief 046 (21 de octubre de 2026)

Carlos probó la arena publicada (revisión `cronista-arena--0000011`) y reportó tres errores.
Un agente de investigación (Opus, sin modificar el repo) los reprodujo sobre `arena-v3` /
`reinicios-v3` con controladores programados, en lotes de 30 y 100 semillas de 120 s. Las
salidas de 100 semillas están en `salida-error{1,2,3}-n100.txt`.

## 1. El portero no sale a achicar

Causa: su destino es siempre el ancla fija `POR` (6, 34) (`src/arena/catalogo.ts:80`,
`src/arena/controladores.ts:100-103`); queda fuera de la presión (`controladores.ts:92`,
`motor.ts:323`) y de los perseguidores (`motor.ts:310`); al cambiar la posesión vuelve al ancla
(`motor.ts:314`); `motor.ts:329-334` solo limita el destino al área.

Mano a mano (poseedor a ≤ 25 m del arco y ningún defensor de campo más cerca de la línea):
293 en 100 semillas; mediana del desplazamiento del portero hacia el balón 0,00 m; 136 acaban en
gol. En 30 semillas son el 60 % de todos los goles. Ejemplo: semilla 18, `visita-8` conduce de
x = 27,7 a la línea entre los ticks 630 y 678; `local-0` sigue en (6,2; 34,0); gol `a44` sin tiro.

Hallazgo lateral: una orden `pasar` a un receptor a más de 32 m bloquea al poseedor toda la
ronda (`motor.ts:285-297`); 3 goles conduciendo en 100 semillas.

## 2. No hay centros desde la banda

Banda del último tercio (x ≥ 70, fuera del ancho del área): 127 pases en 100 semillas, 16 al
área (12,6 %). De 301 posesiones allí, 84 acaban en saque de meta porque el extremo conduce más
allá de la línea de fondo. Causas: conducción en línea recta a x + 15 (`motor.ts:327`,
`controladores.ts:117`); la personalidad cancela el pase (`personalidades.ts:140`, 70,6 % de los
ticks posibles, 484 con un compañero libre en el área); `opcionPase` (`controladores.ts:58-77`)
solo pasa a los pies, premia el avance en x y descarta pases de más de 32 m o hacia atrás de más
de 8 m; la línea de ataque más alta (87,2 m, `catalogo.ts:81`) queda antes del área, que estuvo
vacía en el 75 % de las decisiones en banda.

Hallazgo lateral: un poseedor con orden `conducir` se frena antes de la tolerancia de 0,2 m y
queda casi parado hasta el fin de la ronda (`motor.ts:327` frente a `motor.ts:346`).

## 3. Gol con el balón del portero

No es un autogol (0 en 100 semillas): el rematador le roba el balón al portero tras la atajada.
El duelo se aplica al portero con el balón en las manos (`motor.ts:488-496`); tras la atajada no
hay pausa (`motor.ts:476-480`); el portero no puede soltar el balón hasta 2 s, pero puede ser
disputado desde 0,8 s (`limites.ts:471-472`); el atacante persigue el balón (`motor.ts:310`,
`322`) y el portero avanza hacia él (`motor.ts:327`). 18 de 90 atajadas acaban en robo y 18 robos
terminan en gol (8,1 % de los 223 goles). Ejemplo: semilla 18, atajada `a5` (tick 115), robo `a6`
(tick 125), gol `a8` (tick 144).

Riesgo no observado: el portero con balón no tiene el límite de área; cruzar su propia línea entre
los palos contaría como autogol (`motor.ts:352`, `409-413`).

## Controladores LLM

Comparten el motor. No pueden ordenar un centro ni un pase a un espacio, y no pueden hacer que el
portero reaccione: `presionar` se ignora para el portero y su destino vuelve al ancla al cambiar
la posesión. El error 3 les afecta igual.

## Línea base consolidada y prototipo (brief 046)

`prototipo/` contiene lo que fijó las cifras del [brief 046](../../disenos/046-portero-centros-y-robo.md):

- `base046.mts` (con `comun.mts`): métricas de lote del brief sobre el motor actual. Ejecución
  desde el repo: `N=100 S0=0 node --import tsx <ruta>/base046.mts`. Salidas: `r-base-*.json`
  (semillas 1–30, 1–100 y 101–200; 120 s; programados).
- `prototipo-046.diff`: parche de exploración sobre una **copia** de `src/arena/motor.ts`, con
  banderas por entorno (`FIX=1,2,3,L`, `ESPERA`, `SINPOR`, `LLEG`, `REM`…). No es código del
  repositorio ni debe aplicarse a él. Para reproducir: copiar `motor.ts` a `<dir>/proto/motor.ts`,
  aplicar el diff, convertir sus imports relativos en absolutos hacia `src/` y enlazar
  `node_modules`. Después, con los scripts en `<dir>/repro/`, ejecutar
  `PROTO=1 ESPERA=1 SINPOR=1 LLEG=14 REM=3 N=100 node --import tsx <dir>/repro/base046.mts`.
  `comun-proto.mts` usa el motor parcheado con el bucle de `ejecutarArena` sin LLM. Con
  `FIX=none`, las métricas de 30 semillas coinciden con las del motor actual. Salidas:
  `r-prop-*.json`.
