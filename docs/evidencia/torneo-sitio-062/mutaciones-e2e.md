# Brief 062 · mutaciones de los e2e del P1-a

Generado por `node docs/evidencia/torneo-sitio-062/mutaciones-e2e.mjs` el 2026-10-24T09:42:07.026Z. Cada mutación se aplicó al archivo real,
se ejecutó Playwright solo con el caso que la nombra (el servidor del e2e se reconstruye) y se revirtió (md5 comprobado).

| # | Mutación | Archivo | md5 mutado | Caso (`-g`) | Resultado | Resumen |
|---|---|---|---|---|---|---|
| E1-rotulo | quitar el rótulo de origen | `src/ui/ArenaTorneo.tsx` | `d29c99dad00ab9bd4cae41972aa09d63` | `1 · lista con los dos orígenes` | ROJO (detectada) | 1 failed |
| E3-base | repetición del sitio pedida a /torneos (sin la base del prefijo) | `src/ui/torneo-carga.ts` | `6278c8c32f8d966364277cab334e1f61` | `3 · «Watch replay»` | ROJO (detectada) | 1 failed |
| E4-cupo | el motivo «cupo» no se muestra | `src/ui/ArenaTorneoLanzar.tsx` | `e25505ae68c7be8ef9dd97e73f07a150` | `4 · lanzar una liga` | ROJO (detectada) | 1 failed |
| E5-origen | sin la comprobación del Origin | `src/app/api/arena/torneos/sitio/route.ts` | `5b6038c97af19462861826fe9bfee8f4` | `5 · un POST con un Origin ajeno` | ROJO (detectada) | 1 failed |
| E7-360 | las cifras del panel sin envolver a 360 px | `src/app/globals.css` | `77771e9e329e24f8db900bf2c2926381` | `7 · 360 px \(light, en\)` | ROJO (detectada) | 1 failed |

Detectadas: 5 de 5.
