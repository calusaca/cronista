# 066 — Volver al partido después de salir de la pantalla

## Estado

Brief **cerrado v1.0**, lunes 26 de octubre de 2026. Lo diseña Opus 5.5 (coordinador) y lo implementa
`opus-implementador`. Carlos aprobó A + B + C el 26 oct.

**Pedido de Carlos (26 oct):**

> «cuando estoy en un partido y cambio a otra pantalla, el partido se pausa y no se puede continuar»

Su captura es de Edge en escritorio, a 1440 px:

- partido con modelos (GPT-6 Sol frente a GPT-5.4 mini), narrado y de 120 s;
- la emisión está en pausa en 0:22 y «Resume broadcast» se ve bajo la cancha;
- el panel del directo ya dice «Match complete · recording available»;
- el estado de la emisión dice «Broadcast paused · generation continues».

## 1. Hallazgos del coordinador (reproducidos contra producción, revisión 0000047, partidos programados)

| Escenario | Resultado |
|---|---|
| Pestaña oculta (propiedades `hidden` y `visibilityState` forzadas y página congelada por CDP), 40 s o 150 s, con la red cortada o no | Queda en «Broadcast paused». Con «Resume broadcast» sigue. **No se reprodujo el bloqueo** |
| Navegar a /arena/torneo y volver con «atrás» | Reconecta por `sessionStorage`, pero **salta** al vivo (de 0:00 a 0:48) |
| **Recarga** después de que el servidor terminó de generar (el móvil descarta la pestaña) | ❌ El partido desaparece: vuelve la vista previa (0:00 / 1:00) |

**Causas en el código:**

- **Ocultar pausa sin dar una forma visible de volver.** `ArenaEmisionBuffer.tsx:674`, en `visibilitychange`,
  pausa el reloj y suspende el audio. Al volver no hay aviso arriba, y el botón queda bajo la cancha.
- **La sesión se pierde al recargar.** Al llegar «terminada», `ArenaEnDirecto.tsx:138` hace
  `sessionStorage.removeItem(claveSesion)`, aunque la emisión del búfer siga en curso (la generación va muy por
  delante). Tampoco se guarda el segundo de la emisión, así que una reconexión salta al vivo
  (`inicioTick = final − 200`).
- **El audio se reanuda fuera del gesto.** `pausar()` (l. 690) solo llama a `reloj.continuar()`; el audio se
  reanuda después en `requestAnimationFrame` con `reanudarAudio()`, fuera del gesto del usuario. En iOS puede
  quedar mudo, o con `reanudando.current` atascado en `true` si `resume()` nunca resuelve.
- **El bloqueo de la captura de Carlos no se reprodujo.** El Chromium sin interfaz no pone la pestaña en `hidden`
  al cambiar a otra.

## 2. Alcance (A + B + C + D)

**D. Reproducir primero el caso de Carlos.**

- **Prueba e2e determinista:** una prueba en rojo que emule una pestaña oculta de verdad. Por ejemplo, un
  `addInitScript` que permita fijar `document.hidden` y `visibilityState`, emita `visibilitychange` y retenga los
  callbacks de `requestAnimationFrame` mientras está oculta, como hace un navegador real.
- **Caso a cubrir:**
  - partido en directo, en búfer y narrado, con el stub o el ENSAYO local;
  - se oculta en mitad de la emisión;
  - mientras está oculta, llega «terminada» (generación completa);
  - se vuelve y se pulsa «Resume broadcast»;
  - el reloj debe avanzar hasta el final.
- **Si se reproduce el bloqueo:** se corrige la causa raíz y se documenta.
- **Si no se reproduce:**
  - se documenta lo probado;
  - se revisan las rutas sospechosas: `reanudando` atascado, `bufferTerminada` y `hastaTick` tras «terminada»,
    `alActividad(false)` desmontando o remontando `ArenaEmisionBuffer` y `bufferRecibido`;
  - se añaden las defensas de A–C.
- **Sin coste en Azure:** nada de partidos con modelos.

**A. Retomar donde ibas.**

- La clave de sesión y la presentación se conservan hasta que:
  1. la emisión llega al final;
  2. el espectador empieza otro partido;
  3. pulsa «Stop match» o «Cancel live match».

  «terminada» ya no las borra mientras la emisión del búfer no haya acabado.
- Se guarda en `sessionStorage` el segundo de la emisión, con un throttle de ~1 s y al ocultarse.
- **Al recargar o volver a /arena con una sesión guardada:**
  - **sesión aún ejecutándose:** reconecta y retoma en el segundo guardado, no en `final − 200`;
  - **sesión ya completa:** carga la emisión o la grabación completa y la deja **en pausa** en el segundo guardado,
    lista para continuar con la narración si estaba activa;
  - **en ambos casos** aparece el aviso de B.
- **Sesión caducada o inexistente** (404 o 410): se limpia la clave y se muestra un aviso breve: «This match is no
  longer available» / «Este partido ya no está disponible». Nunca una pantalla sin explicación.
- **Lo compartido sigue igual:** `?partido=` y `?vista=buffer` se comportan como hoy.

**B. Aviso al volver.**

- Si la pausa la causó ocultar la pestaña (no el espectador), o si se retoma por A, aparece **sobre la cancha** un
  botón grande, «Continue match» / «Continuar partido», con el minuto en el que se quedó.
- Va dentro de `.arena-pitch-wrap` o justo encima, a la vista en 390 px y en 1440 px, sin tapar el marcador.
- Lo pueden pulsar el ratón, el teclado y la tecla Espacio (`aria-keyshortcuts` como el botón actual).
- Desaparece al continuar.
- **Una pausa pedida por el espectador no muestra el aviso:** basta el botón de siempre.
- Textos ES/EN en el sitio de textos de la arena.
- **Opcional, si queda limpio:** al volver a ser visible tras una pausa por ocultación, continuar solo si el audio
  puede reanudarse sin gesto; si no, el botón. Decide el implementador y lo justifica.

**C. Audio dentro del gesto.**

- «Continue match» y «Resume broadcast» llaman a `sonido.current.contexto.resume()` de forma **síncrona** dentro
  del manejador del clic, antes de cualquier `await`.
- `reanudarAudio` no puede quedar bloqueado: si `resume()` no resuelve en `NARRACION_DIRECTO.desbloqueoMs`, se
  libera `reanudando` y se muestra «Habilitar reproducción de audio».
- Con la narración desactivada, nada de esto cambia.

## 3. Fuera de alcance

- Cambiar la repetición con «Play» (`ArenaNarracion`, play-narrado): se recupera bien con su `<audio>`. Solo se toca
  si D lo señala.
- Persistencia en el servidor.
- El bloque B4 del 064 sin commit en el árbol: no se toca ni se commitea. Si se edita `Arena.tsx`, se stagean solo
  los hunks propios.

## 4. Pruebas y entrega

- **Unitarias** de la lógica de retomar: qué se guarda, cuándo se borra y la decisión al montar.
- **e2e `e2e/arena-volver-066.spec.ts`:**
  - D (oculta, termina mientras está oculta y continúa hasta 2:00);
  - recarga con la sesión completa, que retoma en pausa en el segundo guardado y muestra «Continue match»;
  - navegar a Torneo y volver, que retoma en el segundo y no salta;
  - una pausa del espectador no muestra el aviso;
  - todo a 390×844 y 1440×900.
  - Cada caso con una mutación vista, por ejemplo devolver el `removeItem` en «terminada».
- **Verificación de entrega:** tsc, `npm test` y la e2e completa (puerto 3417). Las capturas de `docs/evidencia`
  reescritas se restauran con checkout.
- **Fallos conocidos de la e2e oficial:** el único conocido en HEAD es `navegacion-064:32` (orden de la query).
- **Commits y push:** commits con rutas explícitas, gitleaks y push a main. **No desplegar.**
- **HANDOFF.md** se actualiza en cada hito.
