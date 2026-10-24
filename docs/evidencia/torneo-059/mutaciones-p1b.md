# Brief 059 · mutaciones de P1-B (página, carga en /arena, lector y métricas)

Generado el 2026-10-24T01:52:59.051Z con un script local: cada mutación se aplicó, se ejecutó la prueba indicada (vitest o la e2e de Playwright, con su build), se vio en rojo y se revirtió (md5 restaurado = original). 16 mutaciones, 16 en rojo.

| # | Mutación | Archivo mutado | md5 del archivo mutado | Prueba | Resultado |
|---|---|---|---|---|---|
| M12 | latencia con las decisiones que esperaron un 429 | `src/arena/torneo.ts` | `bcec9c42564058cdea12e67dc13dd506` | `vitest src/arena/__tests__/torneo.test.ts -t "M12"` | rojo · Tests  1 failed / 2 passed / 28 skipped (31) |
| M12 | precisión de pase como media de porcentajes | `src/arena/torneo.ts` | `b657e365326a216a5aa1d9b5670ac113` | `vitest src/arena/__tests__/torneo.test.ts -t "M12"` | rojo · Tests  1 failed / 2 passed / 28 skipped (31) |
| M12 | media parcial cuando falta un partido (null) | `src/arena/torneo.ts` | `9914028183d8c233c9e7a30d35fd1abf` | `vitest src/arena/__tests__/torneo.test.ts -t "M12"` | rojo · Tests  1 failed / 2 passed / 28 skipped (31) |
| deuda | torneo.ts vuelve a importar node:crypto (deuda de cliente) | `src/arena/torneo.ts` | `e89a491d255108c91eee75a4a963bf22` | `vitest src/arena/__tests__/torneo.test.ts -t "apto para el cliente"` | rojo · Tests  1 failed / 30 skipped (31) |
| M23 | lector sin la regex del id (lee lo que pida la URL) | `src/arena/torneo-archivo.ts` | `ee92e15ac9804e105ac51db25c4025c5` | `vitest src/arena/__tests__/torneo-archivo.test.ts -t "404"` | rojo · Tests  1 failed / 2 skipped (3) |
| M23 | lector sin la coherencia interna | `src/arena/torneo-archivo.ts` | `a6b6b3b49b657a519dfea0cab7edd9eb` | `vitest src/arena/__tests__/torneo-archivo.test.ts -t "incoherente"` | rojo · Tests  1 failed / 2 skipped (3) |
| M25 | mostrar 0 por null | `src/ui/ArenaTorneo.tsx` | `f01ce3205bb36668a10dc67b3887359e` | `vitest src/ui/__tests__/ArenaTorneo.test.tsx -t "M25"` | rojo · Tests  1 failed / 5 passed (6) |
| M25 | quitar «†» de las declaradas | `src/ui/ArenaTorneo.tsx` | `c53444753b225e09c1901391b757d487` | `vitest src/ui/__tests__/ArenaTorneo.test.tsx -t "M25"` | rojo · Tests  1 failed / 5 passed (6) |
| M25 | cifra fija «0,125» escrita a mano | `src/ui/ArenaTorneo.tsx` | `a0eae24d5df34ec79d5df429734cd44e` | `vitest src/ui/__tests__/ArenaTorneo.test.tsx -t "M25"` | rojo · Tests  1 failed / 5 passed (6) |
| M25 | sin banda de ensayo | `src/ui/ArenaTorneo.tsx` | `23bd7535ad6fce76b7922aa7ec719072` | `vitest src/ui/__tests__/ArenaTorneo.test.tsx -t "M25"` | rojo · Tests  1 failed / 5 passed (6) |
| M25 | sin banda de incompleto | `src/ui/ArenaTorneo.tsx` | `d3efcb8fc128006dc01d48ce2e8fd527` | `vitest src/ui/__tests__/ArenaTorneo.test.tsx -t "M25"` | rojo · Tests  1 failed / 5 passed (6) |
| §15.8 | partido no gana sobre torneo | `src/ui/torneo-carga.ts` | `97b6848d389ebcc735456a5ab46e5436` | `vitest src/ui/__tests__/torneo-carga.test.ts -t "precedencia"` | rojo · Tests  1 failed / 4 skipped (5) |
| §15.8 | torneo.json sin coherencia al abrir un partido | `src/ui/torneo-carga.ts` | `b4ea4254ea9da3e522f3ed0a76d76a8c` | `vitest src/ui/__tests__/torneo-carga.test.ts -t "incoherente"` | rojo · Tests  1 failed / 4 skipped (5) |
| N13 | origenTorneo sin limpiar al empezar otra carga | `src/ui/Arena.tsx` | `3cd1a27f8efa3d717c2a9b1242c4dc6f` | `playwright e2e/arena-torneo.spec.ts -g "N13"` | rojo · 1 failed |
| N14 | respuesta tardía del torneo: sin señal en la carga ni en el POST del torneo y sin comprobación de vigencia | `src/ui/Arena.tsx` | `7633f646248545eb23968d166fba9eae` | `playwright e2e/arena-torneo.spec.ts -g "N14"` | rojo · 1 failed |

N14: la primera versión de la mutación (quitar solo la señal de la carga del .gz y la comprobación de vigencia) quedó en **verde**: tras «Cancelar», el `POST /api/arena` con la señal ya abortada también impide el reemplazo. Son defensas redundantes; la mutación final quita las tres en el camino del torneo y la prueba se pone en rojo.

No aplicables en P1 (§ 15): M24 (la rama `torneo:` de `/api/arena/grabaciones` se eliminó; la narración usa `{ registro }`) y la parte «alterado → 409» de M23 (no hay ruta GET; el servidor no valida registros en P1: lo hace CI).

## Revisión de Codex, iteración 1 (#1 huérfanos e índice; #2 registro ligado a su encuentro)

| # | Mutación | Archivo mutado | md5 del archivo mutado | Prueba | Resultado |
|---|---|---|---|---|---|
| C1 | CI recorre solo el índice: sin rechazo de huérfanos | `src/arena/torneo-validacion.ts` | `8e746824caf8c0a058f27e0968c113f5` | `vitest src/arena/__tests__/torneos-archivados.test.ts -t "huérfano"` | rojo · Tests  1 failed / 9 skipped (10) |
| C1 | CI sin comprobar los archivos de cada directorio | `src/arena/torneo-validacion.ts` | `39b4a56406a1ccb8152086e04a7b46f6` | `vitest src/arena/__tests__/torneos-archivados.test.ts -t "huérfano"` | rojo · Tests  1 failed / 9 skipped (10) |
| C1 | servidor sirve ids fuera del índice | `src/arena/torneo-archivo.ts` | `6cb3a331c674cef02fd92c61fb5f82a3` | `vitest src/arena/__tests__/torneo-archivo.test.ts -t "huérfano"` | rojo · Tests  1 failed / 3 skipped (4) |
| C2 | carga sin la huella SHA-256 del archivo | `src/ui/torneo-carga.ts` | `d7ac5f7a757a85b17cebebb30da68140` | `vitest src/ui/__tests__/torneo-carga.test.ts -t "Codex #2"` | rojo · Tests  1 failed / 5 skipped (6) |
| C2 | carga sin contrastar el registro con el encuentro | `src/ui/torneo-carga.ts` | `c0e79ae85355119ae3ad4ed444f70f5d` | `vitest src/ui/__tests__/torneo-carga.test.ts -t "Codex #2"` | rojo · Tests  1 failed / 5 skipped (6) |
| C2 | contraste sin los controladores por lado | `src/ui/torneo-carga.ts` | `a2c1f15768b0a0d72b505c5cde24f641` | `vitest src/ui/__tests__/torneo-carga.test.ts -t "Codex #2"` | rojo · Tests  1 failed / 5 skipped (6) |
