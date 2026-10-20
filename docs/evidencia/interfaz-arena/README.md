# Validación de interfaz y diversidad de formaciones

19 de octubre de 2026. La [auditoría](../../disenos/039-auditoria-futbol-e-interfaz.md) distingue cambios implementados, mediciones y trabajo pendiente de arbitraje/remates.

## Comprobaciones locales

- 67 archivos y 1559 pruebas unitarias aprobadas; TypeScript sin errores.
- Dos pruebas de empaquetado aprobadas; contexto de Azure limitado a 289 archivos permitidos.
- 28 escenarios distintos de navegador aprobados. La ejecución inicial tuvo 25 aprobados y tres fallos de selectores/recorrido de prueba; los tres se corrigieron y repitieron contra el mismo build, con resultado 2 + 1 aprobado. No hubo cambios de producción entre esas repeticiones.
- Tras ajustar la posición del panel para respetar la cabecera fija, se recompiló y aprobaron los tres escenarios de formaciones/interfaz. Se repitió además el caso visual con una aserción explícita de que la cabecera no tape el panel. Esa prueba espera a que la grabación seleccionada termine de cargar antes de avanzar su cursor.
- Las pruebas usan controladores programados, transportes de voz simulados o seis MP3 reales archivados; no generan nuevas inferencias ni síntesis de pago.

Ver [`validacion-local.json`](validacion-local.json), las [capturas de escritorio](escritorio-local.png) y [móvil](movil-local.png). El JSON conserva hashes de los archivos de producción comprobados.

Comandos principales:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run --reporter=dot --maxWorkers=2
node --test scripts/*.test.mjs
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright ./node_modules/.bin/playwright test e2e/arena.spec.ts e2e/arena-buffer.spec.ts e2e/arena-formaciones.spec.ts --workers=1
```

## Comprobación pública

`comprobar-publicacion.mjs` abre la aplicación, comprueba las dos entradas y las doce formaciones, crea un partido programado con las nuevas estructuras, confirma la presentación con reserva, el texto junto a la cancha con audio apagado, la pausa, el diseño móvil y la apertura de una grabación archivada. Cancela su partido al terminar. No llama a modelos ni activa la síntesis de voz.

```bash
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright node docs/evidencia/interfaz-arena/comprobar-publicacion.mjs
```

El resultado público se guarda en `navegador-publico.json` y las capturas `*-publico.png` / `configuracion-publica.png`.

Comprobación pública aprobada en la revisión `cronista-arena--0000004`, imagen `arena-20261019201001`, compilación ACR `chd`. La aplicación principal sigue en `cronista--0000005`. Ver [`publicacion.json`](publicacion.json) y [`navegador-publico.json`](navegador-publico.json). La compilación anterior `chc` se canceló antes de desplegar para incorporar el ajuste final de posición de la narración.
