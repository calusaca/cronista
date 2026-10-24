# Brief 062 · mutaciones de los e2e del P1-a

Generado por `node docs/evidencia/torneo-sitio-062/mutaciones-e2e.mjs` el 2026-10-24T14:38:11.226Z. Cada mutación se aplicó al archivo real,
se ejecutó Playwright solo con el caso que la nombra (el servidor del e2e se reconstruye) y se revirtió (md5 comprobado).

| # | Mutación | Archivo | md5 mutado | Caso (`-g`) | Resultado | Resumen |
|---|---|---|---|---|---|---|
| E1-rotulo | quitar el rótulo de origen | `src/ui/ArenaTorneo.tsx` | `6096ba28835664c64d83575b756c7ade` | `1 · lista con los dos orígenes` | ROJO (detectada) | 1 failed |
| E3-base | repetición del sitio pedida a /torneos (sin la base del prefijo) | `src/ui/torneo-carga.ts` | `dcc958837f3dbd4c01ab1d67249c78f2` | `3 · «Watch replay»` | ROJO (detectada) | 1 failed |
| E4-cupo | el motivo «cupo» no se muestra | `src/ui/ArenaTorneoLanzar.tsx` | `e25505ae68c7be8ef9dd97e73f07a150` | `2 · lanzar grupos\|4 · al recargar` | ROJO (detectada) | 1 failed, 1 passed |
| E5-origen | sin la comprobación del Origin | `src/app/api/arena/torneos/sitio/route.ts` | `5b6038c97af19462861826fe9bfee8f4` | `5 · un POST con un Origin ajeno` | ROJO (detectada) | 1 failed |
| E2-pasa | «Advances» sin texto en las tablas de grupo | `src/ui/ArenaTorneoGrupos.tsx` | `d01235ba1dac9c4930ac6ca9d8b7e96c` | `2 · lanzar grupos` | ROJO (detectada) | 1 failed |
| E3c-prueba | la repetición de una prueba no lo dice en su procedencia | `src/ui/torneo-carga.ts` | `a5c9cec9e1769b89cbd631a0a27f70e7` | `3c · una semifinal` | ROJO (detectada) | 1 failed |
| E7-cuadro | el cuadro en dos columnas también a 360 px | `src/app/globals.css` | `0301dbf3878e733d2f426d582c89fc46` | `7 · 360 px \(light, en\)` | ROJO (detectada) | 1 failed |
| E8-paren | hueco de la línea flexible dentro del paréntesis del modelo | `src/app/globals.css` | `04089fe2c57c825805ce327de17fe371` | `8 · 1440 px` | ROJO (detectada) | 1 failed |
| E8-cabeceras | cabeceras de la matriz de grupo sin margen interior | `src/app/globals.css` | `10b181d96d77c2abe1c001dd39f27796` | `8 · 1440 px` | ROJO (detectada) | 1 failed |
| E7-360 | las cifras del panel sin envolver a 360 px | `src/app/globals.css` | `4f675c7c3e7f2fa6b5c9a03cedf24158` | `7 · 360 px \(light, en\)` | ROJO (detectada) | 1 failed |

Detectadas: 10 de 10.
