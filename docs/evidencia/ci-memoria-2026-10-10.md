# Memoria del dataset: reproducción y corrección

**Fecha:** 2026-10-10. **Base:** `c27518d`. Entorno local Windows, **Node 22.23.3**,
la misma versión observada en el runner de la [CI fallida](https://github.com/calusaca/cronista/actions/runs/38088012063).

## Causa y cambio

`condicionesAB` retenía nueve brazos con 500 partidos cada uno y su capa micro
completa. Las mediciones necesitaban sumas y proporciones, pero conservaban
millones de objetos hasta calcular todas las condiciones.

Ahora cada brazo acumula contadores mientras genera un partido por vez. Las
semillas, las condiciones, el tamaño de muestra y las fórmulas se conservan.
La exportación de los 100 partidos y los archivos de referencia no se modifican.

## Mediciones observadas

| Ejecución | Presupuesto de old space | Resultado |
| --- | --- | --- |
| Código base, regeneración completa | 2.048 MiB | Aborto, exit 134, heap agotado alrededor de 2.039 MiB. |
| Código corregido, misma regeneración | 512 MiB | Exit 0, 51,8 s, pico RSS **199,6 MiB**, heap usado al finalizar 87,6 MiB. |

El límite de old space no es un límite de memoria total del proceso: en esta
ejecución V8 informó un límite de heap efectivo de 560 MiB. El pico RSS se midió
con `process.resourceUsage().maxRSS`; incluye más que el heap. Los tiempos y el
pico son una observación local, no un benchmark del runner Linux.

Se comprobaron **18/18 experimentos en banda**. Los cuatro archivos regenerados
coinciden con los versionados mediante SHA-256 y comparación byte a byte:

| Archivo | SHA-256 |
| --- | --- |
| `DATASHEET.md` | `0c287866c23e993318f295e80a483e01a1e854563c07e19ac99fb48f90a317a5` |
| `ficha.json` | `70c3d1e4bef43a0fb945a727312f4b3503f19ae7a40ef2db771445997602467b` |
| `partidos.jsonl` | `0e719e1ca8214cd5867d92947f0e0e5967770ec9dbf62746877c0d32efa938f4` |
| `resumen.csv` | `77c68be04f4e2900653a4d5b0b281bddcf6cd35371df634f3347213c2d3abb63` |

## Reproducción

Desde la raíz, con Node 22.23.3 seleccionado:

```powershell
node --max-old-space-size=512 --import tsx src/dataset/cli.ts --out .cache/dataset-heap-512
node --max-old-space-size=2048 node_modules/vitest/vitest.mjs run --config vitest.stats.config.ts src/dataset/__tests__/dataset.stats.test.ts
```

La prueba adicional de `dataset.stats.test.ts` ejecuta el CLI en un subproceso
con old space de 512 MiB y compara los cuatro archivos de referencia. Evita
depender de la memoria disponible en la máquina que ejecuta Vitest.

Validación de suites completas y nueva CI: pendiente de cierre de las ejecuciones.
