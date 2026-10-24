# Brief 062 · Torneo lanzable desde el sitio: parte de servidor del P1-a

Opus, 24 oct 2026. Implementación **parcial** del [brief 062](../../disenos/062-torneo-lanzable-grupos-y-eliminatoria.md)
(v1.3; las § 19, 18 y 17 prevalecen en ese orden). Sin commit, sin despliegue, sin LLM ni Speech reales y sin tocar
Key Vault ni Azure. **Los lanzamientos quedan apagados por defecto** (`ARENA_TORNEO_SITIO` vale `'0'` en el bicep)
hasta superar el smoke simultáneo de capacidad (§ 17.5).

## Qué hay

| Pieza | Archivo |
|---|---|
| Constantes `TORNEO_SITIO` (bloque nuevo al final) | `src/sim/limites.ts` |
| Esquema 062 (`esquemaTorneo062`, unión `esquemaTorneoCualquiera`) y coherencia 062 | `src/arena/torneo.ts`, `src/arena/torneo-formatos.ts` |
| Plan de liga, siguiente partido, metadatos 062, estimación y duración por formato, frase de significación, día UTC | `src/arena/torneo-formatos.ts` |
| Grupos + eliminatoria **solo como funciones puras** (sorteo, plan intercalado, orden de grupo, cuadro, desempates, semillas de llaves). No se expone: el servidor solo admite la liga | `src/arena/torneo-formatos.ts` |
| `validarTorneo` 062 (plan reconstruido) | `src/arena/torneo-validacion.ts` |
| `alPublicar` opcional en `jugarEncuentro` y `entradasEstimacion` extraída de `estimarTorneo` (misma salida) | `src/arena/torneo-ejecucion.ts` |
| Rechazo de `--id sitio-…` | `src/arena/torneo-cli.ts` |
| Entradas generadas y su generador (`npm run arena:torneo-entradas`) | `src/arena/torneo-sitio-entradas.json`, `src/arena/torneo-entradas-cli.ts` |
| Almacén con texto, anexo y bytes, y plazo por operación en Blob | `src/arena/almacen-torneos.ts` |
| Gestor: mutex, latido, barrera de relevo, autosilencio, admisión, bucle con ritmo, tope, bolsa, cierre de arranque con reintentos, cancelación, liga de prueba | `src/arena/torneo-sitio.ts` |
| Rutas | `src/app/api/arena/torneos/sitio/route.ts` (GET estado, POST lanzar), `[id]/route.ts`, `[id]/[archivo]/route.ts`, `cancelar/route.ts`, `cerrar/route.ts` |
| Arranque del gestor (latido y cierre) | `src/instrumentation.ts` |
| CLI del operador (`npm run arena:torneo-sitio -- --estado / --cancelar / --cerrar`) | `src/arena/torneo-sitio-cli.ts` |
| Infra: `var maxReplicas`, `terminationGracePeriodSeconds: 30`, `commit`, `ARENA_ORIGEN_PUBLICO`, interruptor y token | `infra/arena-preview.bicep` |
| Despliegue: árbol limpio, `CRONISTA_COMMIT`, aviso con torneo activo (`--forzar`), interruptor (`--torneo-sitio 1`) y comprobación (no creación) del secreto | `scripts/deploy-azure-arena.mjs` |

## Pruebas y salida real

- `suites-062.txt`: las suites del 062 y del 059 (11 archivos, 183 pruebas) en verde.
- `npm-test.txt`: `npm test` completo en verde (121 archivos, 2689 pruebas) sobre el árbol compartido con el 060 y
  el 061 a medias. Una pasada anterior tuvo 1 fallo ajeno (`play-narrado.test.ts`, trabajo del 060 en curso) y el
  `typecheck` 1 error ajeno (`modelos-jugados.ts`); en la pasada final ya no estaban.
- `typecheck.txt`: `npm run typecheck`, `exit=0`.
- `mutaciones.md` (generado por `mutaciones.mjs`, salida en `mutaciones-salida.txt`): cada mutación se aplica al
  archivo real, se ejecuta solo la prueba que la nombra, se anota el md5 del archivo mutado y se revierte.

Archivos de prueba: `torneo-sitio.test.ts` (gestor: S1–S3, S6, S6b, S6c, S7, S7b con la ampliación de § 19, S7c,
S7d, S8, S9, S9b, S9c, S10, S10b b–d, S12, S13, S14, S15, S17 liga, R3, R4), `torneo-sitio-rutas.test.ts` (S4, S5,
H1, R1, cancelación y cierre con token, S10b a, R5), `torneo-formatos.test.ts` (G7 liga, G8, G9, G10, G12),
`torneo-grupos.test.ts` (G1–G7 y G8 grupos, puras) y `torneo-entradas.test.ts` (R2). Utilidades sin pruebas:
`torneo-sitio-ayuda.ts` (almacén falso atómico con ganchos, reloj falso, entornos).

## Secreto de administración (NO creado)

El token solo se lee de la variable de entorno `ARENA_ADMIN_TOKEN` (≥ `TORNEO_SITIO.admin.tokenMinCaracteres`
caracteres). Sin él, los lanzamientos se deshabilitan con el motivo `cancelacion`. Cuando Carlos lo decida, se crea
en Key Vault sin que pase por la línea de órdenes ni por la salida:

```bash
umask 077; f=$(mktemp)
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" > "$f"
az keyvault secret set --vault-name <vault> --name cronista-arena-admin --file "$f" --output none
shred -u "$f"
```

`deploy-azure-arena.mjs` **comprueba** que exista (`az keyvault secret show … --query id`) y solo entonces pasa
`adminTokenEnKeyVault=true` al bicep, que lo monta como secreto `arena-admin` (`keyVaultUrl`) y variable
`ARENA_ADMIN_TOKEN` (`secretRef`). El operador lo lee para el CLI sin imprimirlo:
`export ARENA_ADMIN_TOKEN="$(az keyvault secret show --vault-name <vault> --name cronista-arena-admin --query value -o tsv)"`.

Encender los lanzamientos: `npm run azure:arena -- --torneo-sitio 1` (exige el secreto), solo tras el smoke de § 17.5.

## Ensayo local (sin IA)

```bash
ARENA_TORNEO_SITIO=1 CRONISTA_COMMIT=$(git rev-parse HEAD) ARENA_ORIGEN_PUBLICO=http://localhost:3000 \
ARENA_ADMIN_TOKEN=<32+ caracteres> ARENA_TORNEO_SITIO_ENSAYO=1 ARENA_TORNEO_SITIO_SEGUNDOS=10 ARENA_TORNEO_SITIO_SIN_RITMO=1 \
ARENA_TORNEOS_SITIO_DIR=.cache/arena-torneos-sitio-ensayo npm run dev
```

El ensayo se rechaza (motivo `desactivado`) si `ARENA_BLOB_ENDPOINT` está definido (R3).

## Decisiones de interpretación (reportadas, no improvisadas en silencio)

1. **`esquemaTorneo` conserva el esquema 059**; la unión discriminada se llama `esquemaTorneoCualquiera`. Hacer de
   `esquemaTorneo` la unión rompía la compilación de `src/ui/__tests__` y `src/ui/*` (fuera de mi alcance). Quien
   integre la UI cambia `torneo-carga.ts` a la unión.
2. **`finUtc` es `null` mientras `en_curso`** en el esquema 062 (coherencia: null ⇔ en_curso).
3. **Cierre de arranque conserva los `pendientes`** de la última instantánea (§ 17.2 dice `pendientes = []`, pero
   eso rompería el prefijo exigido por la coherencia si había un pendiente intermedio).
4. **`arranqueEsperaMs` no existe**: la barrera de relevo de § 18.1 la sustituye (el cierre corre al liberarla).
   `sondeoCancelacionMs`, `reconciliacionRetrasoMs` e `intentosMaxPorPartido` se eliminaron (§ 17.10).
5. **`motivoFin` de un defecto** (validación o secreto en el registro): `incompleto` / `infraestructura`.
6. **Ficha** (`GET` estado): añade `disponible` (grupos `false` en P1-a), `reservaMaxPartidoMicroUsd` y
   `tipicoMicroUsd.maxConDesempates` (para «hasta 2,65 con desempates»); `bolsa.conocidoMicroUsd` es `null` hasta
   releer los libros. Motivos añadidos a § 6.8: `origen`, `cancelacion`, `replicas`, `iniciando`, `relevo`, `cierre`.
   Un proceso silenciado responde `desactivado`. `POST` con `formato: "grupos"` ⇒ 422 `formato`.
7. **`?prueba=1` con un token incorrecto ⇒ 401** (sin cabecera se ignora, como pide S10b).
8. **`ARENA_ORIGEN_PUBLICO`** se calcula en el bicep (`https://cronista-arena.<defaultDomain>`) en vez de pasarlo el
   script con `az containerapp show`: es el mismo valor sin una llamada más.
9. **El script de despliegue no crea el secreto** (instrucción del coordinador); solo lo comprueba.
10. **Almacén Blob propio** en `almacen-torneos.ts` en lugar de delegar en `almacenBlob`: `almacen.ts` no admite el
    `abortSignal` por operación que exige § 18.1 y no se toca.
11. **El gestor arranca** (latido y cierre) con el interruptor encendido **o** con Blob configurado, aunque el
    interruptor esté apagado: así un torneo a medias se cierra «interrumpido» tras el apagado de emergencia
    (§ 17.6). Coste: una escritura de latido cada 10 s en Blob.
12. **SIGTERM**: Next registra antes su limpieza asíncrona (`process.exit(143)`); el manejador del gestor corre en la
    misma emisión, de forma síncrona, y no cambia la salida del proceso.

## Límites y pendientes

- **UI y e2e** (otro implementador usa Playwright): panel `ArenaTorneoLanzar`, `ArenaTorneoGrupos`, páginas,
  `torneo-carga.ts` (base de la URL por prefijo y unión de esquemas), lista de los dos orígenes, U1 y el e2e
  1, 3, 4, 5 y 7. `listarTorneosSitio()` ya existe para la lista.
- **Fixture del sitio** (`src/arena/__fixtures__/torneos-sitio/`, `--fixture`) y `scripts/e2e-torneos.mjs`: con la UI.
- **P1-b**: exponer grupos (FORMATOS_DISPONIBLES), S17 grupos en el gestor, G11 sobre el fixture del sitio y e2e 2.
- **Smoke y TPM**: no hay `az` en esta máquina; la capacidad real de TPM sigue sin verificar (§ 1).
- **Barrera**: es una declaración por reloj (latido 10 s, silencio a 30 s, barrera a 45 s, plazo por operación de
  10 s), no una exclusión distribuida (§ 19.4). El plazo del SDK es del lado del cliente.

## Revisión de Codex, iteración 1 (hallazgos 3–5)

- **#3** · `intentarCierre` vuelve a leer y validar la instantánea (`leerInstantanea`) cuando la lectura anterior
  falló, y limpia el error si ahora funciona; una instantánea que resulta ya cerrada deja de estar pendiente.
  Pruebas «Codex #3» (un fallo único al recargar; dos fallos y cierre por reintento o por `/cerrar`); mutación C3.
- **#4** · `leerCuerpoAcotado` lanza `lector.cancel()` sin esperarla: el 408/413 sale a tiempo y la ruta libera el
  limitador en su `finally`. Prueba «Codex #4» (flujo cuya cancelación nunca resuelve); mutación C4.
- **#5** · `deploy-azure-arena.mjs` comprueba el torneo activo antes de compilar en ACR y otra vez justo antes de
  ARM. Prueba «Codex #5» (estática sobre el script, que no se puede importar sin desplegar); mutación C5. Límite
  declarado: entre la segunda consulta y el cambio de revisión quedan segundos sin exclusión; con el interruptor
  apagado no hay admisiones públicas y la barrera de mantenimiento completa queda para cuando se encienda.

Tras los cambios: `npm test` 2695/2695 (122 archivos), `npm run typecheck` exit 0 y 64 de 64 mutaciones en rojo.

## UI del P1-a (unidad en verde; e2e escrito, sin ejecutar)

- Panel `src/ui/ArenaTorneoLanzar.tsx` (selector liga / grupos deshabilitado «Disponible pronto», cifras de la Ficha
  del servidor, botón con el motivo visible, confirmación en la página, POST sin doble envío); textos en
  `src/ui/textos-torneo-sitio.ts`.
- `src/ui/ArenaTorneo.tsx`: rótulo de origen, leyenda «†» según quién declara, bandas (incompleto con motivo,
  cancelado, interrumpido, prueba), bloque «En juego» con sondeo cada `sondeoUiMs` solo con la pestaña visible,
  `aria-live` solo con cambios, descargas por la ruta del sitio y lista «Torneos» separada por origen
  (`src/ui/torneo-lista.ts`). Los clubes del partido en juego los calcula el servidor (`clubesDelPlan`): el motor
  no va al navegador (una prueba lo vigila; mutación U1-bundle).
- Páginas con `src/arena/torneo-pagina.ts`; repetición del sitio por `torneo-carga.ts` (base según el prefijo).
- Fixture del sitio `src/arena/__fixtures__/torneos-sitio/` (`npm run arena:torneo-sitio -- --fixture …`), sembrado
  por `scripts/e2e-torneos.mjs`; entorno del e2e en `playwright.config.ts`; `e2e/arena-torneo-sitio.spec.ts`
  (1, 3, 4, 5 y 7) **sin ejecutar** (Playwright reservado).
- `npm run build` en verde (`build.txt`; hubo que borrar `.next/cache`, que daba un pánico interno de Turbopack).
- Decisión: la portada muestra el torneo activo y, si no hay, el más reciente **real** antes que uno de ensayo
  (en producción no hay ensayos); evita que el ensayo lanzado por el e2e desplace al archivado del 24 oct.

## P1-b · grupos + eliminatoria (expuesto)

- `FORMATOS_DISPONIBLES = ["liga", "grupos"]`; S17 de grupos en el gestor (completo y con el empate forzado de la
  semifinal 1: los partidos de ensayo de 10 s acaban 0–0, así que siempre hay desempate y criterio).
- UI `src/ui/ArenaTorneoGrupos.tsx`; repetición con «(operator test tournament)» y la fase (`torneo-carga.ts` +
  una línea en `Arena.tsx`); fixture de grupos de prueba `sitio-prueba-aaaaaa660000` (21 oct).
- Visto correr: `npm test` 2732/2732, typecheck 0, e2e completa 284/284 (`e2e-completa.txt`), mutaciones de unidad
  82/82 (`mutaciones.md`) y e2e 8/8 (`mutaciones-e2e.md`).
