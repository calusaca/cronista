# Recuadro del gol en pantallas estrechas — revisión `cronista-arena--0000023`

Fecha: 23 oct 2026, 01:47 UTC. Commit `0d39ab0`, imagen `cronista:arena-20261023014428`.
La revisión tiene el 100 % del tráfico y está en estado Healthy.

Defecto del smoke de la revisión 0000022 ([README](../README.md)): a 360 y 390 px el recuadro
`arena-goal-view` tapaba el arco batido y el balón en la red, hasta el 100 % en el instante del gol.

La corrección: por debajo de 700 px, el recuadro pasa a la esquina inferior opuesta al arco batido.
La prueba de regresión está en `e2e/arena-gol-visual.spec.ts` y su mutación sale en rojo.

Repetición en público con el mismo script (`.cache/smoke-057-solape.mjs`, con salida a esta carpeta),
en [solape-recuadro.json](solape-recuadro.json):

| Ancho | Casos (gol en el arco izquierdo y en el derecho) | Balón tapado |
|---|---|---|
| 360 | 5 | 0 % en todos |
| 390 | 5 | 0 % en todos |
| 768 | 5 | 0 % en todos |
| 1440 | 5 | 0 % en todos |

Las capturas `solape-360-*.png` muestran el recuadro en la esquina opuesta.
No se usó Speech en esta repetición.
