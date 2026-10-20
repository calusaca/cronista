# Validación de consumidores independientes

La [especificación](../../disenos/040-consumidores-y-narracion.md) describe el reloj de presentación, el consumidor selectivo de voz y la descripción completa.

## Validación local

- TypeScript correcto, 67 archivos y 1561 pruebas unitarias aprobadas; los 20 casos de buffer/voz se repitieron tras el ajuste final de selección de contexto.
- Dos pruebas de empaquetado aprobadas. Contexto de publicación limitado a 290 archivos permitidos.
- 31 escenarios distintos de navegador comprobados. En la última ejecución conjunta, 30 aprobaron y uno tenía el marcador esperado invertido en el test. Corregido al equipo local, ese escenario pasó contra el mismo build. Las pruebas previas también detectaron una expectativa antigua de una sola solicitud en vez de dos y un registro de prueba demasiado corto para paginar; se actualizaron.
- El caso de voz larga usa audio de quince segundos a velocidad 1 y comprueba su interrupción al producirse el gol en el tick 231. La transcripción no anuncia el gol antes de verlo.
- Se bloquean dos solicitudes de voz mientras siguen avanzando reloj y jugadores. Se prueban también errores por pasaje, cambio de idioma, reservas agotadas por falta de datos del partido y reconexión.
- El cierre sigue sonando después de terminar visualmente un partido corto, incluso si el estado global de sesión todavía espera comentarios.
- El historial paginado se recorre por completo y sus 94 identificadores coinciden con los eventos originales. Al retroceder el partido no aparecen eventos futuros.

[`validacion-local.json`](validacion-local.json) conserva el alcance y hashes de producción. Estas pruebas no generan nuevas inferencias ni síntesis de pago.

## Comprobación pública

`comprobar-publicacion.mjs` crea un partido programado de 60 segundos con semilla 2. Al habilitar la voz, bloquea localmente las dos primeras solicitudes mientras comprueba que el reloj continúa. Después libera las solicitudes al servicio real de voz y comprueba que se decodifica al menos un pasaje de más de seis segundos y que los audios se reproducen a velocidad 1. Desactivar la voz también permite continuar el partido. Comprueba descripción y móvil, guarda capturas y cancela su encuentro al salir.

Esta comprobación usa **Speech real** y consume el presupuesto de caracteres configurado. No llama a los controladores de modelos.

```bash
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright node docs/evidencia/consumidores-arena/comprobar-publicacion.mjs
```

El resultado queda en `navegador-publico.json`; no incluye el audio base64, credenciales ni cabeceras privadas.

Comprobación pública aprobada en `cronista-arena--0000005`, compilación ACR `che`. Speech real produjo pasajes decodificados de 3,096, 5,232 y 11,856 segundos; la intervención reproducida usó velocidad 1. La prueba pública verificó avance durante la demora artificial y después de apagar la voz, descripción y móvil sin desbordamiento ni errores JS. El pasaje largo se preparó por adelantado; la interrupción de un pasaje de quince segundos se verificó en el navegador local. Ver [`publicacion.json`](publicacion.json) y [`navegador-publico.json`](navegador-publico.json).
