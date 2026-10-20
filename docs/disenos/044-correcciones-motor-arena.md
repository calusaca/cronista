# Correcciones del motor de arena tras la revisión del 20 de octubre

## Alcance de esta revisión

Revisión de código del diff de Codex (briefs 034–043) hecha por Fable el 20 de
octubre con `/code-review`, con los dos hallazgos principales comprobados a mano
en `src/arena/motor.ts`. Este brief cierra los hallazgos de ese diff. Los módulos
nuevos sin rastrear tienen una auditoría aparte cuyo resultado, si procede, irá al
brief 045. No se agrega alcance funcional: solo corrección, consistencia con las
reglas del proyecto y rendimiento con salida idéntica.

## Hallazgos confirmados

### A. Un remate desviado por el portero se cuenta dos veces

`motor.ts` ≈505: al desviar (35 %) el vuelo conserva `tipo: "tiro"` con `origen`
reubicado al portero. Si el balón sale por la línea de fondo, `resolverSalida`
(≈404) emite además `tiro_fuera` para el tirador original. Consecuencias: la
narración dice «desvía el remate» y «el remate se va fuera»; remates contados
doble en resúmenes y estadísticas; distancia del `tiro_fuera` medida desde el
portero y no desde el tirador.

### B. Los cinco cambios prometidos son inalcanzables

`motor.ts` ≈225: cada sustitución incrementa `cambios` y `ventanas` a la vez y
solo hay una pendiente por parada. Con `maxVentanas: 3` el tope real es 3. El
prompt (`controladores.ts`, `SISTEMA_ARENA`) promete «cinco cambios y tres
ventanas», así que una cuarta propuesta recibe `orden_invalida`, gasta reintentos
y cae al respaldo programado.

### C. Temperatura incoherente con el clima

`app/api/arena/route.ts` ≈13: `temperaturaC` admite −8..41 para cualquier clima,
aunque `TEMPERATURA_C` fija calor 29..41 y frío −8..5. `ArenaEnDirecto` no pasa
por la validación del formulario: un campo vacío manda `Number("") = 0` y un
partido con «calor a 0 °C» alimenta los efectos de calor.

### D. Umbrales fuera de `src/sim/limites.ts`

En `motor.ts`: probabilidad de desvío `.35`, desplazamiento del desvío `±6`,
distancias de reinicio `2.1 / 10.2 / 9.65`, topes de saque inicial `50 / 43`,
`slice(0, 16)` de plantilla. Incumple la regla de CLAUDE.md.

### E. Prompt con cifras escritas a mano

`SISTEMA_ARENA` dice «al menos 20 s», «cinco cambios y tres ventanas, desde 20 s y
separados 15 s» como texto fijo, aunque `T` (TECNICA_ARENA) ya está importado y
`formaciones` sí se construye desde el catálogo. Si cambia un límite, el prompt
promete reglas viejas.

### F. Duplicado en `src/ui/Arena.tsx`

El objeto `entorno` de `simular` (≈148) copia `entornoElegido` (≈112). Dos copias
del mismo mapeo que pueden divergir en silencio.

### G. Rendimiento sin cambiar la salida

- `planesActivos` (≈537): tras un cambio o roja, las órdenes ya no coinciden con
  los IDs activos y se reconstruye un plan programado completo en cada tick de
  0,1 s durante el resto de la ronda.
- `transicion` (≈548): `this.eventos.some(...)` recorre todo el registro en cada
  tick; los eventos entran en orden de tick, así que basta mirar desde el final
  mientras `e.tick >= this.estado.tick`.
- `accionBalon` (≈275): `opcionPase(j, this.observar(j.lado))` se calcula aunque
  haya orden explícita `pasar/conducir/tirar` y el resultado se descarte.

### H. Artefacto de herramienta

`.primos/events.jsonl` (vacío) no es del proyecto; va al `.gitignore`.

## Cambio propuesto

### A y D: reglas `reinicios-v3`

1. Nueva constante de reglas `"reinicios-v3"`, predeterminada para `ARENA.version`
   (`arena-v3`). `"reinicios-v1"` y `"reinicios-v2"` siguen aceptadas y su
   comportamiento no cambia en nada: **antes de tocar el motor**, generar un
   fixture `src/arena/__fixtures__/arena-reinicios-v2.json` con el motor actual
   (semilla y duración cortas; debe contener al menos un `atajada` con
   `motivo: "desvio"` — buscar la semilla) y una prueba `reproducirArena(registro)`
   `toEqual(registro)` igual a la de v1. Esa prueba es la que demuestra que v2 no
   cambió.
2. Bajo `reinicios-v3`, el vuelo tras un desvío deja de ser un tiro: nuevo tipo de
   vuelo `"rechace"` (o el nombre que ya use el motor para balones sueltos, si
   existe) con `autor` = portero. `resolverSalida` solo emite `tiro_fuera` cuando
   `vuelo.tipo === "tiro"`, así que con el desvío ya no hay doble conteo. Si el
   rechace entra en el arco propio, es autogol del portero (regla existente de
   `autor.lado !== ataca`), y eso debe quedar probado.
3. Mover a `limites.ts` (en `ARENA` o `TECNICA_ARENA`, comentados): probabilidad
   de desvío, desplazamiento lateral del desvío, las tres distancias de reinicio,
   los dos topes del saque inicial y el tamaño de plantilla. Ninguna prueba repite
   las cifras a mano.
4. El relato/narrador que ya trataba `tiro_fuera` tras `atajada` no necesita
   cambios; si alguna plantilla dependía de ese par, documentarlo.

### B y E: ventanas de sustitución

5. `gestion.sustitucion` acepta **un objeto (forma actual) o un arreglo de 1 a
   `T.cambiosPorVentana`** (nueva constante, valor 3) pares `{sale, entra}` sin
   repetir jugadores. Todos se ejecutan en la misma interrupción, cuentan
   `cambios += n` y `ventanas += 1`. Se rechaza la propuesta entera si alguno
   supera `maxCambios`, repite jugador o reingresa a un retirado.
6. `validarOrdenes`, `esquemaRespuestaArena`, `realizarCambios`, la vista y el
   relato (evento `cambio` por cada par, mismo tick) aceptan ambas formas. Los
   registros guardados con la forma objeto se reproducen igual (fixture v2).
7. `SISTEMA_ARENA` construye las cifras desde `T.cambioPlanMinS`, `T.maxCambios`,
   `T.maxVentanas`, `T.cambiosPorVentana`, `T.cambioMinS` y
   `T.cambiosSeparacionS`. Prueba: cambiar una constante por `vi.spyOn`/mock no
   es necesario; basta con que la prueba del prompt lea las mismas constantes.

### C: temperatura por clima

8. En el esquema de la ruta, `superRefine`: si `clima` es `calor` o `frio`,
   `temperaturaC` debe estar dentro de `TEMPERATURA_C[clima]`; si `clima` es otro
   o falta, `temperaturaC` no se admite. Mensaje 400 en inglés como los demás.
9. `ArenaEnDirecto` y `Arena.tsx` usan un único `entornoElegido` (cierra F) y
   omiten `temperaturaC` cuando el campo está vacío o fuera de rango, dejando que
   `crearConfigArena` sortee una válida.

### G: rendimiento

10. Cachear el plan fusionado por ronda cuando cambian los IDs activos
    (recalcular en `realizarCambios` y en la roja, no por tick); recorrer
    `eventos` desde el final para `transicion`; calcular `paseLocal` solo si no
    hay `accionExplicita`. **Las tres optimizaciones deben dejar los fixtures v1,
    v2 y el nuevo v3 idénticos**; si alguna cambia un byte, no es una
    optimización y se descarta o se gatea por reglas.

### H

11. `.primos/` en `.gitignore`.

## Pruebas exigidas

- Unitarias nuevas en `src/arena/__tests__/`: desvío-que-sale sin `tiro_fuera`
  bajo v3 y con `tiro_fuera` bajo v2 (misma semilla); autogol de portero por
  rechace; cinco cambios en tres ventanas aceptados, sexto rechazado, cuarta
  ventana rechazada, par repetido rechazado; prompt con cifras de `T`;
  esquema de la ruta rechaza calor a 0 °C y frío a 41 °C, acepta calor a 32 °C.
- Fixture v2 y prueba de reproducción exacta; fixture v3 nuevo con la misma
  prueba (es el que protegerá los siguientes briefs).
- `npm test`, `npm run typecheck` y los e2e de arena existentes en verde.
- Mutaciones: quitar el gate de v3 debe romper la prueba de v2; volver a
  `tipo: "tiro"` en el desvío debe romper la de v3.

## Fuera de alcance

- `finTick` planificado vs real en la publicación `ordenes` cuando el partido
  termina antes: comportamiento conocido, `ronda` es la autoritativa. Se anota
  como deuda, no se toca.
- Cualquier cambio de narración, voz o UI más allá de aceptar el arreglo de
  sustituciones.

## Adenda tras la auditoría (20 de octubre)

La auditoría adversaria de la primera implementación confirmó las dos mutaciones
exigidas, la reproducción exacta de v1/v2/v3 y la desaparición del doble conteo
(0 `tiro_fuera` tras 146 desvíos en semillas 1–200, frente a 139 de 141 con v2).
Encontró una regresión y varias precisiones que cambian o aclaran este brief:

- **El rechace es balón suelto.** Darle al vuelo el `lado` del portero hacía que un
  compañero que lo recogía generase `recepcion` con el portero como pasador y que el
  editorial narrase un pase inexistente («found X with that pass»), y que solo el
  equipo atacante persiguiera el balón con anclas invertidas (tres goles distintos
  en semillas 30, 52 y 125). Decisión: el rechace conserva el `lado` del vuelo
  original (movimiento idéntico a v2) y cambia solo `tipo`, `autor` (portero) y
  `receptor`; cualquier jugador que lo toque produce `recuperacion` sin relación.
  El generador del fixture v3 entra en el repo para que sea regenerable.
- **Punto 9, precisión:** `crearConfigArena` no sortea la temperatura cuando falta;
  asigna un valor fijo dentro de la banda del clima. Ese valor pasa a `limites.ts`
  junto con los literales que seguían en `motor.ts` y `controladores.ts`
  (remate, áreas de reinicio, factor de falta, destino del desvío, verticalidad y
  las dimensiones de la cancha en el prompt).
- **Hallazgo C, precisión:** por la ruta HTTP, «calor a 0 °C» ya devolvía 400 por
  `validarConfig` (mensaje genérico, no efectos de calor). Lo que el `superRefine`
  añade es rechazar temperatura con clima que no la admite o sin clima, con mensaje
  explícito; `/api/arena/sesiones` debe exponer ese mismo mensaje.
- Las pruebas derivan las temperaturas de `TEMPERATURA_C` en lugar de repetir 32/41/0.
- La vista de cambios pendientes debe tener una prueba que falle si se muestra solo
  el primer par.
- **Límites aceptados, no corregidos:** la forma arreglo de `sustitucion` también es
  aceptada por el validador bajo v1/v2 (los registros reales de v1/v2 no la usan y
  se reproducen igual); el caché del plan fusionado cambia la salida y queda
  descartado; el esquema `anyOf` anidado no se validó contra Azure OpenAI en vivo.
