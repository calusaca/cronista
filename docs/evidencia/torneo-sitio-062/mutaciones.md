# Brief 062 · mutaciones de la parte de servidor (P1-a)

Generado por `node docs/evidencia/torneo-sitio-062/mutaciones.mjs` el 2026-10-24T08:14:28.130Z. Cada mutación se aplicó al
archivo real, se ejecutó solo la prueba que la nombra (`vitest -t`) y se revirtió (md5 comprobado). «md5» es el del archivo MUTADO.

| # | Mutación | Archivo | md5 mutado | Prueba (`-t`) | Resultado | Resumen de vitest |
|---|---|---|---|---|---|---|
| S1b | comprobar el activo después de crear dia- | `src/arena/torneo-sitio.ts` | `c128992c18c5e03f4cf8af0da3b73d1f` | torneo-sitio.test.ts · `S3 · un torneo activo de AYER` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S1-nuevo | crear el manifiesto sin `nuevo: true` | `src/arena/torneo-sitio.ts` | `43d42f3dd71c1eee954b738a98faef68` | torneo-sitio.test.ts · `OTRA operación` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S2 | día en America/Guatemala (UTC−6) en vez de UTC | `src/arena/torneo-formatos.ts` | `636b27d56fa6701f5682947959bdc12a` | torneo-sitio.test.ts · `S2 · día UTC` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S6-reserva | reserva abierta contada como 0 en el cierre de arranque | `src/arena/torneo-sitio.ts` | `3ab2b67bd46cb94b75ecc7ddc003f286` | torneo-sitio.test.ts · `S6 · arranque tras una caída` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S6-latido | cerrar con el latido ajeno fresco (barrera ignorada) | `src/arena/torneo-sitio.ts` | `87696a760c325b5e901c165624e68a9b` | torneo-sitio.test.ts · `S6 · arranque tras una caída` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S6b-anexo | ignorar el error del anexo del libro | `src/arena/torneo-sitio.ts` | `e44f79bf4569e0aaa52a2bb1d9238808` | torneo-sitio.test.ts · `un anexo del libro que lanza` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S6b-propia | dar por ajena una creación propia (respuesta perdida) | `src/arena/torneo-sitio.ts` | `440d9c385eda594591e7a4bc5c641c78` | torneo-sitio.test.ts · `persiste pero lanza` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S6c | SIGTERM sin `detenido` (el viejo escribe el cierre) | `src/arena/torneo-sitio.ts` | `23ce59291f1d401e6a4c5cbcc0be601c` | torneo-sitio.test.ts · `S6c · SIGTERM` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S7 | quitar el mutex | `src/arena/torneo-sitio.ts` | `52829220deda34d87a0291fb95a4b2dd` | torneo-sitio.test.ts · `S7 · exclusión directa` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S7b-relectura | liberar la barrera sin releer los libros (leídos al empezar el relevo) | `src/arena/torneo-sitio.ts` | `64cddf9c7b550cd6970f5ecda41f098f` | torneo-sitio.test.ts · `con un latido ajeno fresco` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S7b-latidos | ignorar los latidos ajenos | `src/arena/torneo-sitio.ts` | `87696a760c325b5e901c165624e68a9b` | torneo-sitio.test.ts · `con un latido ajeno fresco` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S19 | quitar la comprobación de vigencia antes de escribir | `src/arena/torneo-sitio.ts` | `5a646ba278ef19ad9895719d00ebdcce` | torneo-sitio.test.ts · `se CUELGA` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S7c-reintento | cierre de arranque sin reintento | `src/arena/torneo-sitio.ts` | `b4bbaaee2db5347639e3794851bc1a96` | torneo-sitio.test.ts · `se reintenta y cierra` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S7c-plazo | reintentar el cierre sin plazo | `src/arena/torneo-sitio.ts` | `c7267ec02532ad54031895bb2c566451` | torneo-sitio.test.ts · `más de cierrePlazoMs` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S7d | admitir sin el primer latido confirmado | `src/arena/torneo-sitio.ts` | `996198a1062121c4008a4a929032b147` | torneo-sitio.test.ts · `S7d` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S8 | guarda del tope sin la reserva (con lo conocido) | `src/arena/torneo-sitio.ts` | `48d093b579a7fd2a0629805415fbde8d` | torneo-sitio.test.ts · `S8 · tope` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S9-tipico | bolsa con el típico en vez del tope | `src/arena/torneo-sitio.ts` | `4abdb0960be23caabe67b8f52c8a280b` | torneo-sitio.test.ts · `conocido acumulado \+ tope > bolsa` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S9-ensayos | contar los ensayos en la bolsa | `src/arena/torneo-sitio.ts` | `9058dcdc9db9977f20ab3716cff8e643` | torneo-sitio.test.ts · `los ensayos no cuentan` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S9b | cierre (commit del partido + cierre final) fuera del mutex | `src/arena/torneo-sitio.ts` | `c5dd13a171f68360b92c48bb25ee5059` | torneo-sitio.test.ts · `S9b` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S9c | libro ilegible tratado como 0 | `src/arena/torneo-sitio.ts` | `c1d0f2bfc32543b87bed8759980b683a` | torneo-sitio.test.ts · `S9c` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S10 | una espera sin señal (pausa y enfriamientos) | `src/arena/torneo-sitio.ts` | `7278a477125c6fe82ccfe88ebf6bdbfc` | torneo-sitio.test.ts · `enfriamiento largo` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S10b-id | id de la prueba = id del día | `src/arena/torneo-sitio.ts` | `b0ff074c56196e718907d98510f05619` | torneo-sitio.test.ts · `\(b\) prueba cancelada` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S10b-dia | la prueba consume el cupo del día | `src/arena/torneo-sitio.ts` | `70e4e5c61b2577618d6c642726948171` | torneo-sitio.test.ts · `\(b\) prueba cancelada` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S10b-bolsa | gasto de la prueba fuera de la bolsa | `src/arena/torneo-sitio.ts` | `2299fe9481ed28057e77a5134d620380` | torneo-sitio.test.ts · `\(b\) prueba cancelada` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S12 | ignorar ARENA_MAX_REPLICAS con Blob | `src/arena/torneo-sitio.ts` | `75123eaee59e1a86864f4ee52d61a6ea` | torneo-sitio.test.ts · `S12 · réplica única` | ROJO (detectada) | Tests 1 failed · 3 passed · 40 skipped (44) |
| S13-plazo | sin plazo total | `src/arena/torneo-sitio.ts` | `b90640b9120b00ac3effaf519bc0b9aa` | torneo-sitio.test.ts · `pasado plazoTotalMs` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S13-intentos | un intento de más por partido | `src/arena/torneo-sitio.ts` | `db196f1bc281b0316c8c3ed18f543952` | torneo-sitio.test.ts · `1 \+ repeticionesMax veces` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S14 | sin ritmo de reloj | `src/arena/torneo-sitio.ts` | `fe767b9328b4cae294d887e13ffe304b` | torneo-sitio.test.ts · `S14 · ritmo` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| S15 | el torneo pasa por GestorSesiones | `src/arena/torneo-sitio.ts` | `9d1704b1b039d514cbabdf1face02793` | torneo-sitio.test.ts · `S15` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| R3 | ensayo admitido con Blob | `src/arena/torneo-sitio.ts` | `7095df10df1ca0b00844621096429dcb` | torneo-sitio.test.ts · `R3 ·` | ROJO (detectada) | Tests 1 failed · 1 passed · 42 skipped (44) |
| R4 | torneo-cli acepta el prefijo sitio- | `src/arena/torneo-cli.ts` | `92e26856daa56e2ef24c25174aa51f86` | torneo-sitio.test.ts · `R4 ·` | ROJO (detectada) | Tests 1 failed · 1 passed · 42 skipped (44) |
| S5 | tocar el almacén antes del interruptor | `src/app/api/arena/torneos/sitio/route.ts` | `f5669d3030c7a4580c1cd31c58e40869` | torneo-sitio-rutas.test.ts · `S5 ·` | ROJO (detectada) | Tests 10 failed · 16 skipped (26) |
| S4 | clave del limitador = primer salto de XFF | `src/arena/torneo-sitio.ts` | `e0699f86ef070c12787427a9d3219e1f` | torneo-sitio-rutas.test.ts · `S4 ·` | ROJO (detectada) | Tests 2 failed · 24 skipped (26) |
| H1 | `liberar` fuera de `finally` | `src/app/api/arena/torneos/sitio/route.ts` | `9d2d6dd7d3ba0e133131ad1dc34f3222` | torneo-sitio-rutas.test.ts · `cuerpo lento` | ROJO (detectada) | Tests 1 failed · 1 passed · 24 skipped (26) |
| R1 | archivo leído desde la URL (sin el manifiesto) | `src/arena/torneo-sitio.ts` | `7d27966ce9b1f1b3c5113db5b662b7d4` | torneo-sitio-rutas.test.ts · `R1 ·` | ROJO (detectada) | Tests 1 failed · 25 skipped (26) |
| R5 | bicep con literales distintos en scale | `infra/arena-preview.bicep` | `6a0b44b4f7f5ba05a08065a5e7b0f573` | torneo-sitio-rutas.test.ts · `R5 ·` | ROJO (detectada) | Tests 1 failed · 2 passed · 23 skipped (26) |
| R2 | redondeo distinto del típico por decisión | `src/arena/torneo.ts` | `d016879e99e256ea7518b2e02c1c6df8` | torneo-entradas.test.ts · `estimación archivada` | ROJO (detectada) | Tests 1 failed · 2 skipped (3) |
| G11-liga | validarTorneo 062 sin validar cada encuentro contra su plan y su .gz | `src/arena/torneo-validacion.ts` | `c3c0e6450805041937158a306d0443f5` | torneo-sitio.test.ts · `S17` | ROJO (detectada) | Tests 1 failed · 43 skipped (44) |
| G8-plan | omitir la reconstrucción del plan en la coherencia 062 | `src/arena/torneo-formatos.ts` | `a45dc1dfe9cc2103a64624c00f045a2b` | torneo-formatos.test.ts · `G8` | ROJO (detectada) | Tests 1 failed · 3 passed · 12 skipped (16) |
| G8-059 | aceptar `formato` en un 059 | `src/arena/torneo.ts` | `f2a1eb921f910343d81eae1a0c10b8d4` | torneo-formatos.test.ts · `G8` | ROJO (detectada) | Tests 1 failed · 3 passed · 12 skipped (16) |
| G9-desempates | estimar grupos sin desempates | `src/arena/torneo-formatos.ts` | `09c32178cf4b4bd2fde9aada9b9874cd` | torneo-formatos.test.ts · `G9` | ROJO (detectada) | Tests 2 failed · 1 passed · 13 skipped (16) |
| G9-tope | tope de grupos por debajo de la reserva | `src/sim/limites.ts` | `c498d8330dab7c33596ec516cc44a409` | torneo-formatos.test.ts · `G9` | ROJO (detectada) | Tests 1 failed · 2 passed · 13 skipped (16) |
| G10 | c = n − 1 en grupos | `src/arena/torneo-formatos.ts` | `ff7e10ac55c2b04b048c6498ae090b3b` | torneo-formatos.test.ts · `G10` | ROJO (detectada) | Tests 1 failed · 15 skipped (16) |
| G12 | aceptar campos extra en el encuentro 059 | `src/arena/torneo.ts` | `5a5218b3deaa1eca3ef0fbca0d37e3e5` | torneo-formatos.test.ts · `G12` | ROJO (detectada) | Tests 1 failed · 3 passed · 12 skipped (16) |
| C3 | el cierre no relee una instantánea que falló al leerse | `src/arena/torneo-sitio.ts` | `2c821e75527126f4127a5a617d7bf22b` | torneo-sitio.test.ts · `Codex #3` | ROJO (detectada) | Tests 2 failed · 42 skipped (44) |
| C4 | esperar la cancelación del cuerpo al vencer el plazo | `src/arena/torneo-sitio.ts` | `8c5f1fe2b6ef73c2635412e2f09fdbb6` | torneo-sitio-rutas.test.ts · `Codex #4` | ROJO (detectada) | Tests 1 failed · 25 skipped (26) |
| C5 | sin la segunda comprobación del torneo activo antes de ARM | `scripts/deploy-azure-arena.mjs` | `f69650fda9af780f2a663a87ea889570` | torneo-sitio-rutas.test.ts · `Codex #5` | ROJO (detectada) | Tests 1 failed · 25 skipped (26) |
| G1-sin-barajar | sorteo de grupos sin barajar | `src/arena/torneo-formatos.ts` | `a586b0b1dcad6e67938b94fdf20d7ecd` | torneo-grupos.test.ts · `G1` | ROJO (detectada) | Tests 3 failed · 22 skipped (25) |
| G1-entrada | barajar el orden de entrada (sin ordenar antes) | `src/arena/torneo-formatos.ts` | `e30cb0b6ff479a7d69c5675a321ede7d` | torneo-grupos.test.ts · `G1` | ROJO (detectada) | Tests 3 failed · 22 skipped (25) |
| G2-por-grupo | semillasCruce por grupo (no sobre los 6) | `src/arena/torneo-formatos.ts` | `3debbe8affe0664bf86912204c8d88b5` | torneo-grupos.test.ts · `G2` | ROJO (detectada) | Tests 1 failed · 2 passed · 22 skipped (25) |
| G2-vuelta | vuelta sin invertir los lados | `src/arena/torneo-formatos.ts` | `de7c8c14bca5924976767be5e74826f3` | torneo-grupos.test.ts · `G2` | ROJO (detectada) | Tests 2 failed · 1 passed · 22 skipped (25) |
| G3 | clasificarGrupo con todos los partidos (llaves incluidas) | `src/arena/torneo-formatos.ts` | `28ee4e8a80be055ce0204f439aff3d62` | torneo-grupos.test.ts · `G3` | ROJO (detectada) | Tests 1 failed · 24 skipped (25) |
| G4-alfabetico | orden alfabético en lugar del sorteo para pasar | `src/arena/torneo-formatos.ts` | `98ea1a746fbe0a0a459f2bee0e04d32a` | torneo-grupos.test.ts · `G4` | ROJO (detectada) | Tests 1 failed · 3 passed · 21 skipped (25) |
| G4-posesion | posesión como criterio en vez de remates directos | `src/arena/torneo-formatos.ts` | `a2235edad699a6313f132eda909368e5` | torneo-grupos.test.ts · `G4` | ROJO (detectada) | Tests 1 failed · 3 passed · 21 skipped (25) |
| G4-sorteo-antes | sorteo antes que remates | `src/arena/torneo-formatos.ts` | `814144cff455273f8af02b4f80ced40e` | torneo-grupos.test.ts · `G4` | ROJO (detectada) | Tests 1 failed · 3 passed · 21 skipped (25) |
| G5-1A2A | semifinal 1 = 1A–2A | `src/arena/torneo-formatos.ts` | `1f369a832cb6574b22fea3a03394b736` | torneo-grupos.test.ts · `G5` | ROJO (detectada) | Tests 1 failed · 24 skipped (25) |
| G5-local | el 2.º de local en la semifinal | `src/arena/torneo-formatos.ts` | `d91079408c291b53f28e1db2253938e2` | torneo-grupos.test.ts · `G5` | ROJO (detectada) | Tests 1 failed · 24 skipped (25) |
| G6-semilla | semilla nueva en el desempate | `src/arena/torneo-formatos.ts` | `9e068caeefecfec3ad6989199a419e84` | torneo-grupos.test.ts · `G6` | ROJO (detectada) | Tests 2 failed · 5 passed · 18 skipped (25) |
| G6-sin-invertir | desempate sin invertir los lados | `src/arena/torneo-formatos.ts` | `7ac0f0eaa06d10eccd987107f7cccc8f` | torneo-grupos.test.ts · `G6` | ROJO (detectada) | Tests 1 failed · 6 passed · 18 skipped (25) |
| G6-solo-desempate | criterios solo sobre el desempate | `src/arena/torneo-formatos.ts` | `7012bf1329d7e1ed687c5c9482891611` | torneo-grupos.test.ts · `G6` | ROJO (detectada) | Tests 3 failed · 4 passed · 18 skipped (25) |
| G6-sin-limite | desempates sin límite | `src/arena/torneo-formatos.ts` | `d2fdcd69707372f8cf8c0576db8bd16b` | torneo-grupos.test.ts · `G6` | ROJO (detectada) | Tests 1 failed · 6 passed · 18 skipped (25) |
| G6-sorteo-antes | sorteo antes que el coeficiente | `src/arena/torneo-formatos.ts` | `02c35a2dc99d0230d32daedd7948c97d` | torneo-grupos.test.ts · `G6` | ROJO (detectada) | Tests 1 failed · 6 passed · 18 skipped (25) |
| G7 | cuadro con un grupo incompleto (pendiente) | `src/arena/torneo-formatos.ts` | `ba2c38c569d0d67164d4d7780223dc7b` | torneo-grupos.test.ts · `G7` | ROJO (detectada) | Tests 1 failed · 2 passed · 22 skipped (25) |
| G8-grupos | omitir la reconstrucción del plan (grupos) | `src/arena/torneo-formatos.ts` | `a45dc1dfe9cc2103a64624c00f045a2b` | torneo-grupos.test.ts · `G8` | ROJO (detectada) | Tests 1 failed · 2 passed · 22 skipped (25) |

Detectadas: 64 de 64.
