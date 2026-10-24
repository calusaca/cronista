# Brief 058 · Bloque A · Narración activa por defecto en el directo (24 oct 2026)

Capturas del e2e `e2e/arena-antesala.spec.ts` (prueba A6), regeneradas solo con `CAPTURAS_058=1`
(`CAPTURAS_058=1 npx playwright test e2e/arena-antesala.spec.ts`). Servidor de e2e con `/herramientas`,
`POST /api/arena/sesiones`, `/emision`, `/eventos` y `/relato` simulados: sin Speech ni LLM reales.

| Archivo | Qué muestra |
| --- | --- |
| `casilla-{en,es}-{claro,oscuro}-{1440,360}.png` | Panel «Live match» con la casilla «Narrate the match» / «Narrar el partido» marcada por defecto junto a «Start live match». |
| `narracion-activa-{en,es}-{claro,oscuro}-{1440,360}.png` | El búfer tras un solo clic: «Turn narration off» con `aria-pressed="true"` y la nota fija «Narration started with the match…». |

Lo que comprueban las pruebas (todas vistas en verde):

- A1: el `AudioContext`, su `resume()` y el `start()` de la muestra de silencio ocurren dentro del gesto del
  clic (instrumentado con escuchadores de captura y burbuja en `window`), en ≤ 50 ms; un solo contexto, en
  `running`, adoptado por el búfer; la activación automática no escribe la preferencia; ninguna petición
  `breve`.
- A1b: con el `POST` a 3 s, la voz arranca igual con el contexto cebado.
- A1c: al cambiar de idioma con la voz activa, se reactiva sola en el idioma nuevo; apagada, no.
- A2: «Turn narration off» guarda «0»; tras recargar, la casilla sale sin marcar y la voz no arranca;
  marcarla guarda «1»; con `localStorage` bloqueado la página carga y A1 funciona.
- A3: con `voz: false` no hay casilla ni contexto y el reloj avanza como hoy.
- A4: con `resume()` que no se resuelve, «Enable audio playback» aparece antes de `desbloqueoMs` + 0,5 s,
  el reloj llega a 0:01 y el clic lo recupera.
- A5: un enlace compartido no activa la voz solo; «Enable narration» guarda «1».
- A6: a 360 y 1440 px, claro y oscuro, EN y ES: sin desbordamiento horizontal; la casilla mide ≥ 44 px y
  queda en una fila con su texto.

Límites: autoplay solo medido en Chromium; Safari y Firefox sin probar. Un cebado diferido a un microtask
(`await Promise.resolve()`) no se distingue del síncrono con esta instrumentación (ver bitácora, Ma1).

## Bloque B · Antesala (24 oct 2026)

Capturas de la prueba B11 (también solo con `CAPTURAS_058=1`): `antesala-{en,es}-{claro,oscuro}-{1440,360}.png`
muestran el búfer durante la antesala: la región viva dice «Pre-match presentation · n/20 s ready» /
«Presentación del partido · n/20 s listos», el botón «Skip to kick-off» / «Saltar al saque» está junto a
«Pausar emisión» y la transcripción es la del clip en curso. Sin Speech real: los clips son WAV sintéticos y el
texto sale de `antesalaPartido` con la misma asignación que el `POST` simulado.

Pruebas e2e de B, todas vistas en verde: B1 (orden, huecos ≤ huecoS + 0,2 s, reloj en 0:00 en cada fotograma,
entrada al final y saque en ≤ 1 s, sin previa), B2 (saltar con el teclado y foco en el botón de narración), B3
(404: abandono tras maxFallosSeguidos y suelta en ≤ 2 s; la previa del 056 suena), B4 (reloj en marcha: sin
antesala), B5 `@lento` (clips de 20 s: corte y suelta entre t0 + topeS y + 1,5 s), B6 (pausa en 0:00 y a mitad;
reserva llenada justo después de activar), B7 (respuesta tardía tras saltar descartada), B8 (cambio de idioma con
la reserva completa: 0:00 en cada fotograma y vuelta a empezar en ES), B9 (Speech lento: ≤ 2 en vuelo; entrada con
el último clip en vuelo; sin invitados), B10 (dos espectadores) y A4b (habilitar el audio en 0:00 inicia la antesala).

Pendiente: smoke con Speech real (duración por clip, caracteres de la bolsa `antesala`, segundo del saque, escucha
de «GPT-6 Sol» y de las formaciones) y el bloque C (resaltado).
