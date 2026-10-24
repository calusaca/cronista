# Brief 062 · mutaciones de la parte de servidor (P1-a)

Generado por `node docs/evidencia/torneo-sitio-062/mutaciones.mjs` el 2026-10-24T07:46:02.888Z. Cada mutación se aplicó al
archivo real, se ejecutó solo la prueba que la nombra (`vitest -t`) y se revirtió (md5 comprobado). «md5» es el del archivo MUTADO.

| # | Mutación | Archivo | md5 mutado | Prueba (`-t`) | Resultado | Resumen de vitest |
|---|---|---|---|---|---|---|
| S1b | comprobar el activo después de crear dia- | `src/arena/torneo-sitio.ts` | `f45e782bde2857b48d35ddeb53328d2c` | torneo-sitio.test.ts · `S3 · un torneo activo de AYER` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S1-nuevo | crear el manifiesto sin `nuevo: true` | `src/arena/torneo-sitio.ts` | `d8eb4cd249f521c59136ca815f5c2dbd` | torneo-sitio.test.ts · `OTRA operación` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S2 | día en America/Guatemala (UTC−6) en vez de UTC | `src/arena/torneo-formatos.ts` | `636b27d56fa6701f5682947959bdc12a` | torneo-sitio.test.ts · `S2 · día UTC` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S6-reserva | reserva abierta contada como 0 en el cierre de arranque | `src/arena/torneo-sitio.ts` | `876305957662356fd784180a9d7f5e2a` | torneo-sitio.test.ts · `S6 · arranque tras una caída` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S6-latido | cerrar con el latido ajeno fresco (barrera ignorada) | `src/arena/torneo-sitio.ts` | `6df7644ec22f6345537ed359d4995448` | torneo-sitio.test.ts · `S6 · arranque tras una caída` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S6b-anexo | ignorar el error del anexo del libro | `src/arena/torneo-sitio.ts` | `31d62665f8ac820e00e139b10eaa7b61` | torneo-sitio.test.ts · `un anexo del libro que lanza` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S6b-propia | dar por ajena una creación propia (respuesta perdida) | `src/arena/torneo-sitio.ts` | `b7c9ad8b5d20d0f7e3ad9b33dc57c192` | torneo-sitio.test.ts · `persiste pero lanza` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S6c | SIGTERM sin `detenido` (el viejo escribe el cierre) | `src/arena/torneo-sitio.ts` | `ad710b937feb9424d547b45cb2ea69e0` | torneo-sitio.test.ts · `S6c · SIGTERM` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S7 | quitar el mutex | `src/arena/torneo-sitio.ts` | `61d39cdf0e304f7d919de10059c1a607` | torneo-sitio.test.ts · `S7 · exclusión directa` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S7b-relectura | liberar la barrera sin releer los libros (leídos al empezar el relevo) | `src/arena/torneo-sitio.ts` | `5430d013632ebd10a0ec46801d56e703` | torneo-sitio.test.ts · `con un latido ajeno fresco` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S7b-latidos | ignorar los latidos ajenos | `src/arena/torneo-sitio.ts` | `6df7644ec22f6345537ed359d4995448` | torneo-sitio.test.ts · `con un latido ajeno fresco` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S19 | quitar la comprobación de vigencia antes de escribir | `src/arena/torneo-sitio.ts` | `d44ecff9943b4308685dc0b4e76b7794` | torneo-sitio.test.ts · `se CUELGA` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S7c-reintento | cierre de arranque sin reintento | `src/arena/torneo-sitio.ts` | `658aad47154a27b350863c025560588d` | torneo-sitio.test.ts · `se reintenta y cierra` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S7c-plazo | reintentar el cierre sin plazo | `src/arena/torneo-sitio.ts` | `8a3ee60aa9f83e9da1c6f3bd1eb62441` | torneo-sitio.test.ts · `más de cierrePlazoMs` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S7d | admitir sin el primer latido confirmado | `src/arena/torneo-sitio.ts` | `b897f94dd823d40156051f90371dc34a` | torneo-sitio.test.ts · `S7d` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S8 | guarda del tope sin la reserva (con lo conocido) | `src/arena/torneo-sitio.ts` | `fc9b46c07781585cb8b77e58f54c2ed2` | torneo-sitio.test.ts · `S8 · tope` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S9-tipico | bolsa con el típico en vez del tope | `src/arena/torneo-sitio.ts` | `b7a9d6f1d45d86a6871d3085dfe441ae` | torneo-sitio.test.ts · `conocido acumulado \+ tope > bolsa` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S9-ensayos | contar los ensayos en la bolsa | `src/arena/torneo-sitio.ts` | `a4fccf2bf880d2b04dde3225bf76e60d` | torneo-sitio.test.ts · `los ensayos no cuentan` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S9b | cierre (commit del partido + cierre final) fuera del mutex | `src/arena/torneo-sitio.ts` | `dde686364e48aa0d5622d04b24392dc0` | torneo-sitio.test.ts · `S9b` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S9c | libro ilegible tratado como 0 | `src/arena/torneo-sitio.ts` | `ac85aee01ad5ae3b695ce1591125fb90` | torneo-sitio.test.ts · `S9c` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S10 | una espera sin señal (pausa y enfriamientos) | `src/arena/torneo-sitio.ts` | `8fa10e098d01cd1f02861b6dd8931eb9` | torneo-sitio.test.ts · `enfriamiento largo` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S10b-id | id de la prueba = id del día | `src/arena/torneo-sitio.ts` | `683f7dd9d2a84cbaebe69ed6979877cd` | torneo-sitio.test.ts · `\(b\) prueba cancelada` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S10b-dia | la prueba consume el cupo del día | `src/arena/torneo-sitio.ts` | `3cba2c6d7764395a2d52cd9a28f97ac2` | torneo-sitio.test.ts · `\(b\) prueba cancelada` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S10b-bolsa | gasto de la prueba fuera de la bolsa | `src/arena/torneo-sitio.ts` | `79f3b9d188f9de4fddae70c4fd6ff213` | torneo-sitio.test.ts · `\(b\) prueba cancelada` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S12 | ignorar ARENA_MAX_REPLICAS con Blob | `src/arena/torneo-sitio.ts` | `c2242eedc7dd46ff67d0b4a616e9e78e` | torneo-sitio.test.ts · `S12 · réplica única` | ROJO (detectada) | Tests 1 failed · 3 passed · 38 skipped (42) |
| S13-plazo | sin plazo total | `src/arena/torneo-sitio.ts` | `22eb22e7dd35d4dd8b8a2ee17d21275d` | torneo-sitio.test.ts · `pasado plazoTotalMs` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S13-intentos | un intento de más por partido | `src/arena/torneo-sitio.ts` | `3a30af88e66534238b26e73b10022456` | torneo-sitio.test.ts · `1 \+ repeticionesMax veces` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S14 | sin ritmo de reloj | `src/arena/torneo-sitio.ts` | `fd612d381174b9b0430a8e6f65eca5eb` | torneo-sitio.test.ts · `S14 · ritmo` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| S15 | el torneo pasa por GestorSesiones | `src/arena/torneo-sitio.ts` | `75b42a3e9cf6eacb57c7108029ae0be9` | torneo-sitio.test.ts · `S15` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| R3 | ensayo admitido con Blob | `src/arena/torneo-sitio.ts` | `b259455b0c88ae2e946766a779156894` | torneo-sitio.test.ts · `R3 ·` | ROJO (detectada) | Tests 1 failed · 1 passed · 40 skipped (42) |
| R4 | torneo-cli acepta el prefijo sitio- | `src/arena/torneo-cli.ts` | `92e26856daa56e2ef24c25174aa51f86` | torneo-sitio.test.ts · `R4 ·` | ROJO (detectada) | Tests 1 failed · 1 passed · 40 skipped (42) |
| S5 | tocar el almacén antes del interruptor | `src/app/api/arena/torneos/sitio/route.ts` | `f5669d3030c7a4580c1cd31c58e40869` | torneo-sitio-rutas.test.ts · `S5 ·` | ROJO (detectada) | Tests 10 failed · 14 skipped (24) |
| S4 | clave del limitador = primer salto de XFF | `src/arena/torneo-sitio.ts` | `54457230cb5701f8b720bba3954a7bc0` | torneo-sitio-rutas.test.ts · `S4 ·` | ROJO (detectada) | Tests 2 failed · 22 skipped (24) |
| H1 | `liberar` fuera de `finally` | `src/app/api/arena/torneos/sitio/route.ts` | `9d2d6dd7d3ba0e133131ad1dc34f3222` | torneo-sitio-rutas.test.ts · `cuerpo lento` | ROJO (detectada) | Tests 1 failed · 1 passed · 22 skipped (24) |
| R1 | archivo leído desde la URL (sin el manifiesto) | `src/arena/torneo-sitio.ts` | `8939aba946a6200e9c0d0d0e2328f762` | torneo-sitio-rutas.test.ts · `R1 ·` | ROJO (detectada) | Tests 1 failed · 23 skipped (24) |
| R5 | bicep con literales distintos en scale | `infra/arena-preview.bicep` | `6a0b44b4f7f5ba05a08065a5e7b0f573` | torneo-sitio-rutas.test.ts · `R5 ·` | ROJO (detectada) | Tests 1 failed · 2 passed · 21 skipped (24) |
| R2 | redondeo distinto del típico por decisión | `src/arena/torneo.ts` | `d016879e99e256ea7518b2e02c1c6df8` | torneo-entradas.test.ts · `estimación archivada` | ROJO (detectada) | Tests 1 failed · 2 skipped (3) |
| G11-liga | validarTorneo 062 sin validar cada encuentro contra su plan y su .gz | `src/arena/torneo-validacion.ts` | `c3c0e6450805041937158a306d0443f5` | torneo-sitio.test.ts · `S17` | ROJO (detectada) | Tests 1 failed · 41 skipped (42) |
| G8-plan | omitir la reconstrucción del plan en la coherencia 062 | `src/arena/torneo-formatos.ts` | `a45dc1dfe9cc2103a64624c00f045a2b` | torneo-formatos.test.ts · `G8` | ROJO (detectada) | Tests 1 failed · 3 passed · 12 skipped (16) |
| G8-059 | aceptar `formato` en un 059 | `src/arena/torneo.ts` | `f2a1eb921f910343d81eae1a0c10b8d4` | torneo-formatos.test.ts · `G8` | ROJO (detectada) | Tests 1 failed · 3 passed · 12 skipped (16) |
| G9-desempates | estimar grupos sin desempates | `src/arena/torneo-formatos.ts` | `09c32178cf4b4bd2fde9aada9b9874cd` | torneo-formatos.test.ts · `G9` | ROJO (detectada) | Tests 2 failed · 1 passed · 13 skipped (16) |
| G9-tope | tope de grupos por debajo de la reserva | `src/sim/limites.ts` | `c498d8330dab7c33596ec516cc44a409` | torneo-formatos.test.ts · `G9` | ROJO (detectada) | Tests 1 failed · 2 passed · 13 skipped (16) |
| G10 | c = n − 1 en grupos | `src/arena/torneo-formatos.ts` | `ff7e10ac55c2b04b048c6498ae090b3b` | torneo-formatos.test.ts · `G10` | ROJO (detectada) | Tests 1 failed · 15 skipped (16) |
| G12 | aceptar campos extra en el encuentro 059 | `src/arena/torneo.ts` | `5a5218b3deaa1eca3ef0fbca0d37e3e5` | torneo-formatos.test.ts · `G12` | ROJO (detectada) | Tests 1 failed · 3 passed · 12 skipped (16) |
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

Detectadas: 61 de 61.
