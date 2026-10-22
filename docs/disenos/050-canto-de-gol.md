# 050 — Canto de gol: emoción y celebración verificables en la arena

## Estado

Brief **cerrado** el 22 de octubre de 2026, escrito por Fable tras experimentar con Azure Speech
real. Debe poder implementarse en **medio día** (la entrega cierra el 27 de octubre). Lo marcado
**P1** es obligatorio; **P2** solo entra si P1 está en verde.

Pedido de Carlos (22 de octubre): «Cuando se hace un gol, se debe "cantar" con más emoción y
algún grado de celebración».

**Versión 1.1 (22 de octubre), cerrada.** La revisión de Codex de la versión 1 dio NO CERRADO
(1 bloqueante, 8 mayores, 1 menor). Las decisiones de la [sección final](#versión-11-22-de-octubre-decisiones-tras-la-revisión-de-codex)
prevalecen sobre el texto anterior; en particular, el canto final tiene **tres tramos** en un
solo `<s>` y el recorte P1/P2 está en «Qué cambia para Opus».

Aplica a la voz del narrador de la arena (`/arena`, emisión en búfer y «Escuchar desde el inicio»)
y a la cancha y el marcador. No cambia el motor, `RegistroArena`, `hechosArena`, V1–V8, la Mesa de
transmisión del [045](045-tres-voces.md)/[048](048-dialogo-entre-voces.md) salvo lo dicho en § 3.5,
ni la crónica principal.

Evidencia del experimento: [`docs/evidencia/canto-gol-050/`](../evidencia/canto-gol-050/README.md)
(21 clips reales, catálogo de voces, SSML y medidas).

## 1. Qué pasa hoy (verificado en el código)

- **Texto.** `textoEvento` (`src/arena/relato.ts:19`) devuelve para un `gol` una de cuatro
  etiquetas de 21 caracteres: «¡Gol de X!», «¡Gol! ¡Lo anota X!», «¡X marca el gol!», «¡Gol, gol de
  X!». Un autogol o un desvío usan el texto del hecho. No se dicen el equipo, el marcador ni el
  tiempo. En emisión, `relatoBuffer` elige la variante con `elegirVarianteVoz` sobre esos cuatro
  textos y la ventana de cinco segundos narra solo ese evento (`prioridad` 100,
  `PRIORIDAD_EVENTO_ARENA.gol`).
- **Expresión.** `expresionEvento` (`src/arena/expresion.ts:34`): `jubilo`, intensidad 0,92, o 1
  si el gol llega desde el 80 % de la duración con diferencia ≤ 1 (cifras a mano).
- **SSML.** `prepararVoz` (`src/arena/voz.ts:66–90`): `cheerful` en `es-MX-JorgeNeural`,
  `excited` en `en-US-JennyNeural`, `styledegree = 1,1 + 0,7·intensidad` (1,74–1,80),
  `rate ≈ +12 %`, `pitch ≈ +6,5 %`, `volume ≈ +13 %`, un `<s>` y `<break time="380ms"/>`.
  Medido: el clip actual dura 2,37 s (ES) y 2,85 s (EN), de los cuales ≈ 1,2 s son el silencio
  final; el habla ocupa ≈ 1 s. Es una etiqueta, no un canto.
- **Consumidor.** `segmentoVozValido` (`src/arena/turnos.ts:158`) rechaza todo segmento del
  narrador con más de un fragmento: el canto **debe seguir siendo un único `FragmentoVoz`**.
  Un clip decodificado con duración > `VOZ_BUFFER.duracionMaxS` (24 s) se descarta sin sonar.
- **Prioridad.** `planVozBuffer` (`src/arena/buffer.ts:61`): una fuente ocupada solo se corta por
  una prioridad ≥ 35 **estrictamente mayor**. Nada supera 100, así que hoy ningún audio corta un
  gol; pero un **segundo gol** mientras suena el primero tampoco lo corta, y como su clip caduca
  a los 3 s (`atrasoImportanteS`), ese segundo gol se queda sin voz. El cierre (prioridad 0,
  exento de atraso) espera a que termine la fuente activa; después del cierre no habla nadie
  ([041](041-reinicios-y-continuidad-de-voz.md)).
- **Mesa.** El comentarista se dispara con el gol (prioridad ≥ 70; temas `marcador`, `remates`)
  y su candidatura caduca a `MESA_ARENA.caducidadInvitadoS` = 12 s de partido desde el tick del
  gol; arranca tras `calmaMinS` = 1,5 s desde el fin de la última noticia del narrador.
- **Interfaz.** No hay ninguna señal de gol: el marcador cambia de cifra y nada más. El
  [047](047-rediseno-visual-arena.md) prohíbe `transform`, `transition` y `animation` de CSS en
  `.arena-player`, `.arena-ball` y `.arena-referee`; exige que `.arena-score strong` contenga
  exactamente `{local}–{visita}` y que `.arena-score` contenga el nombre del local; los e2e del
  049 leen `.arena-score > span` `.first()`/`.last()` y `data-favorite`. La única animación es
  el pulso del punto «en directo», apagado con `prefers-reduced-motion`.
- **Grada.** `src/arena/entorno.ts` ya registra `estado.aficion[lado].reaccion = "rugido"` en
  cada gol (brief 026). No hay audio de público.

## 2. Experimento con Speech real (22 de octubre)

Método en la [evidencia](../evidencia/canto-gol-050/README.md): 21 síntesis con las voces del
narrador por la ruta de `sintetizarVoz`, mismo formato que producción, medidas con ffmpeg
(duración decodificada, pico y media del clip, de su primer segundo y del resto, silencios a
−30 dB). Hechos ficticios de ejemplo: Mateo Ferrán, Sporting Montefrío Bajo, segundo 23, 1–0.

Hallazgos que fijan el diseño:

1. **Catálogo.** `es-MX-JorgeNeural` solo admite `cheerful` y `chat`; **ninguna voz es-MX ni
   es-ES del recurso tiene `shouting` ni `excited`**. `en-US-JennyNeural` sí admite `shouting`
   (además de `excited`). Se conserva la voz del narrador en los dos idiomas.
2. **Volumen.** Speech satura cerca de −2,5 dB de pico en cuanto se pide `volume ≥ +20 %`; el
   margen real está en el primer segundo (el grito): el control da −20,9 dB (ES) y −20,6 dB (EN);
   la rampa por tramos sube a −18,4 (ES) y, con `shouting`, a −14,2 (EN). `styledegree` 2 es
   el máximo documentado y no produce artefactos medibles.
3. **Duración.** Cada frontera de `<s>`, de `mstts:express-as` o de oración cuesta 0,85–1,45 s
   de silencio y el final añade ≈ 1,2 s. Tres tramos en elementos separados duran 10,5–14,2 s;
   el texto completo en un solo elemento, 9,1–10 s; **la forma elegida (dos tramos de prosodia
   dentro de un único `<s>`) dura 8,68 s (ES) y 9,07 s (EN)**, con ≈ 5,6 s de habla. «¡Gol, gol,
   gol!» como tres elementos es lo más largo (13–14 s) y su primer segundo es el **más bajo**
   (−22,4 dB) por las pausas: queda descartado como estructura y admitido solo como texto de
   un tramo.
4. **Vocal estirada.** En español la repetición de la vocal sí alarga el grito («¡Gooool!» 1,03 s
   a −15 %, 1,26 s a −30 %; «¡Goooooool!» 1,74 s a −40 %; «¡Gol!» a −45 % solo 0,60 s). En
   inglés no («Goooal!» 0,53 s, «Goooooal!» 0,56 s) y la palanca es `rate` («Goal!» a −45 % =
   0,84 s). Decisión: «¡Gooool» + `rate −20 %` en ES; «Goooal» + `rate −20 %` + `shouting` en EN.
5. **Ritmo.** Los cantos van a 7,0–10,6 caracteres/s; la forma elegida, 10,6 (ES) y 9,8 (EN).
   La constante `MESA_ARENA.dialogo.caracteresPorSegundoVoz` (9,5) sirve como estimación
   conservadora sin añadir otra.
6. **Alternativa descartada.** `en-US-DavisNeural` con `shouting` sale más bajo (−25,2 dB en el
   primer segundo) y no es la voz del narrador.

**Límite:** pico, media y duración son indicadores indirectos; no miden emoción percibida ni si
Jorge pronuncia «Gooool» como vocal sostenida. La escucha humana de `es-11` y `en-11` (y de
`en-10` frente a `en-9` para `shouting`) **está pendiente** y puede cambiar una constante de
prosodia, nunca la estructura.

## 3. Diseño

### 3.1 Estructura del canto (P1)

Un gol produce **un solo `FragmentoVoz`** con **dos tramos** de prosodia:

| Tramo | Contenido | Fuente del dato |
| --- | --- | --- |
| A · grito | «¡Gooool de {goleador}!» (cuatro variantes) | `evento.jugador` → `nombre` en `inicial.jugadores ∪ banco` |
| B · hechos | «{equipo} {situación}, {marcador}, a los {segundos} segundos.» | `evento.lado` → `config.partido[lado].nombre`; marcador = `inicial.marcador` + goles ≤ tick (misma fórmula que el cierre y el estadista); segundos = ⌊tick · `ARENA.pasoS`⌋ |

`texto` del fragmento = tramo A + espacio + tramo B (invariante, § 3.2). `fuentes = [evento.id]`,
`emocion: "jubilo"`, `intensidad` como hoy, `prioridad` = `PRIORIDAD_EVENTO_ARENA.gol`,
`claveVoz = evento:<id>`. La variante del tramo A se elige como hoy: `elegirVarianteVoz` sobre
los cuatro textos completos. El tramo B no tiene variantes: es la parte verificable.

**Situación** (solo desde el marcador registrado; `s` = lado del gol, `o` = rival, `a` = marcador
después del gol, `b` = antes, es decir `a` con `a[s] − 1`), en este orden:

| Clave | Regla | ES | EN |
| --- | --- | --- | --- |
| `empate` | `a[s] === a[o]` | «{equipo} empata» | «{equipo} level it» |
| `recorte` | `a[s] < a[o]` | «{equipo} recorta distancias» | «{equipo} pull one back» |
| `goleada` | `a[s] − a[o] ≥ goleadaDesde` | «Goleada de {equipo}» | «It's a rout for {equipo}» |
| `ampliacion` | `b[s] > b[o]` | «{equipo} amplía la ventaja» | «{equipo} extend their lead» |
| `apertura` | `b[s] + b[o] === 0` | «{equipo} se adelanta» | «{equipo} take the lead» |
| `ventaja` | resto (`b[s] === b[o]`, no 0–0) | «{equipo} se pone por delante» | «{equipo} go in front» |

**Sobre el final** (modificador, no clave): si `tick · pasoS ≥ tardioDesdeFraccion · duracionS` y
`|a.local − a.visita| ≤ tardioDiferenciaMax`, el tramo B empieza por «Sobre el final, …» / «Late
on, …». Es la misma regla que hoy da intensidad 1 en `expresionEvento`, que pasa a leer esas dos
cifras de `CANTO_GOL`. No se dice «gol de la victoria» ni nada sobre el resultado final (V8 no
lo admitiría y el partido no ha terminado).

**Marcador hablado:** siempre en el orden del marcador visual (`local a visita` / `local–visita`),
con números en palabras de 0 a 9 («uno a cero»; en inglés `nil` para 0: «one–nil») y en cifras
desde 10. Es el mismo orden que `.arena-score strong`.

**Tiempo en segundos**, no en minutos: el partido simulado dura 60–180 s y el reloj muestra
`0:23 / 1:00`; «minuto 23» sería falso. Se usa la misma unidad que el dato `reloj` del estadista
(«Llevamos {s} segundos de juego»).

**Autogol** (`evento.autogol`): sin grito. Tramo A = «Gol en propia puerta de {goleador}.» /
«An own goal by {goleador}.», con prosodia `autogol`; tramo B igual (el `lado` del evento es el
equipo que recibe el gol a favor, `src/arena/motor.ts:506`). Un `gol` con `motivo: "desvio"`
sigue el camino del autogol en el texto A («Gol de {goleador}, con desvío.» como hoy usa el hecho)
y conserva el grito; si Opus no encuentra un fixture con desvío, lo documenta y no lo inventa.

**Plantillas** (en `CANTO_GOL.plantillas`, § 3.7; ES y EN paralelas, mismos huecos por índice).
Tramo A, cuatro variantes:

| i | ES | EN |
| --- | --- | --- |
| 0 | ¡Gooool de {goleador}! | Goooal by {goleador}! |
| 1 | ¡Gol, gol, gooool de {goleador}! | Goal, goal, goooal by {goleador}! |
| 2 | ¡Gooool, gol de {goleador}! | Goooal, {goleador} scores! |
| 3 | ¡Gooool! ¡{goleador}! | Goooal! {goleador}! |

La variante 3 tiene dos oraciones y cuesta ≈ 0,9 s más (frontera medida); se acepta por variedad.
Tramo B: «{situación}, {marcador}, a los {segundos} segundos.» / «{situación}, {marcador},
after {segundos} seconds.», con el prefijo de «sobre el final» cuando aplica.

Los tres modos de `construirRelato` producen el mismo fragmento: `buffer` (emisión) y `completo`
(«Escuchar desde el inicio») lo sintetizan; `vivo` lo muestra como texto. El transcript de voz
muestra `texto` tal cual («¡Gooool de …!» es grafía habitual de prensa deportiva en español).

### 3.2 SSML (P1)

`FragmentoVoz` gana `canto?: { tramos: { texto: string; tipo: "grito" | "hechos" | "autogol" }[] }`.
`prepararVoz`:

- Solo lo acepta con `rol` narrador (o ausente) y `emocion: "jubilo"`; en otro caso lanza
  «Interpretación de voz inválida». Exige `texto === tramos.map(t => t.texto).join(" ")`.
- Renderiza **un único `<s>`** que contiene, por tramo, `<mstts:express-as style=… styledegree=…>
  <prosody rate pitch volume>texto</prosody></mstts:express-as>` (o solo `<prosody>` si la voz
  efectiva no admite el estilo, como hoy) y termina con `<break time="{pausaFinalMs}ms"/>`.
  Sin `<s>` ni `<break>` entre tramos: cada frontera adicional cuesta ≈ 1 s (§ 2.3).
- Prosodia y `styledegree` de `CANTO_GOL.tramos[tipo]`; estilo de `CANTO_GOL.estilos[idioma][tipo]`
  filtrado por `estilosAdmitidos` de la voz efectiva. **Deja de usarse** `1,1 + 0,7·intensidad` para
  el canto; `intensidad` sigue viajando en el fragmento para el transcript y las pruebas
  existentes. El resto de emociones no cambia.
- `claveAudio` ya cubre el SSML completo: un canto por texto, idioma y voz en la caché `extra`.

SSML de referencia (es-11 de la evidencia):

```xml
<speak …><voice name="es-MX-JorgeNeural"><s>
  <mstts:express-as style="cheerful" styledegree="2.00"><prosody rate="-20%" pitch="+16%" volume="+30%">¡Gooool de Mateo Ferrán!</prosody></mstts:express-as>
  <mstts:express-as style="cheerful" styledegree="1.30"><prosody rate="+6%" pitch="+6%" volume="+10%">Sporting Montefrío Bajo se adelanta, uno a cero, a los 23 segundos.</prosody></mstts:express-as>
  <break time="380ms"/></s></voice></speak>
```

### 3.3 Duración y presupuesto de Speech (P1)

- `caracteres(texto) ≤ CANTO_GOL.maxCaracteres` (150) para toda combinación de plantilla,
  situación, modificador y los nombres más largos de los fixtures v1–v4 y de 20 semillas del
  generador (prueba). Estimación `150 / caracteresPorSegundoVoz + pausaFinalMs/1000 ≈ 16,2 s <
  VOZ_BUFFER.duracionMaxS` (invariante calculada en prueba). La garantía sigue siendo el rechazo
  por duración real del consumidor (24 s); el canto medido dura ≈ 9 s con nombres de 16–23
  caracteres.
- Coste: el SSML del gol pasa de ≈ 360 a ≈ 520–560 caracteres (+≈ 200 por gol e idioma). Con
  1–3 goles por partido de 60 s (0,93 de media en 30 semillas del 048; 1,5–3 por 120 s en el lote
  046), el aumento es ≤ 1.700 caracteres de los 24.000 de `PRESUPUESTO_AUDIO_ENCUENTRO` (≈ 7 %
  en el peor caso) y **ninguna solicitud más**: el gol ya ocupa su tramo de cinco segundos. La
  deuda de 180 s en ES+EN del 048 no cambia de naturaleza.

### 3.4 Prioridad e interrupciones (P1)

1. **Nada corta un canto**: ya es así por `prioridad > prioridadAnterior` con 100 como máximo;
   se fija en prueba explícita (reinicio 35, tiro 60, atajada 80, roja 95 e invitado 20 devuelven
   `null` sobre una fuente activa de prioridad `PRIORIDAD_EVENTO_ARENA.gol`).
2. **Un gol posterior sí corta un canto en curso** (regla nueva en `planVozBuffer`): si
   `prioridad === prioridadAnterior === PRIORIDAD_EVENTO_ARENA.gol`, se interrumpe. Los clips se
   consumen una sola vez y en orden de tick, así que el único caso de igualdad es un gol más
   reciente; sin esta regla el segundo gol caduca a los 3 s y se queda sin voz.
3. **Cierre** ([041](041-reinicios-y-continuidad-de-voz.md)): un gol en el último segundo se
   canta completo; el cierre (prioridad 0, exento de atraso) arranca al terminar el canto; tras el
   cierre no suena nadie. Sin cambios de código; se prueba.
4. Los clips de prioridad < 100 que caduquen durante el canto (un reinicio a los 2 s del gol, un
   remate inmediato) se descartan por atraso, como hoy. Límite aceptado: durante ≈ 9 s el narrador
   solo canta el gol.
5. Las reservas (prioridad −1) y el silencio máximo del 041 no cambian.

### 3.5 Después del gol: la Mesa (P1)

Se conserva el intercambio disparado por el gol (048, formas `pregunta`/`ronda`, temas `marcador`
y `remates`). Un cambio: la **caducidad de una candidatura cuyo `tema` es `gol`** pasa a
`CANTO_GOL.caducidadInvitadoTrasGolS` (20 s) en `siguienteTurno`, `descartesTurno` y en la ventana
de petición del consumidor; para los demás temas sigue `caducidadInvitadoS` (12 s). Motivo: el canto
(≈ 9 s) más `calmaMinS` consumen 10,5 s de los 12, y la generación LLM tarda hasta 6 s más la
síntesis: casi ninguna reacción al gol llegaría a sonar. `calmaMinS` y la prioridad del invitado no
cambian; la variante completa cabrá menos veces tras un gol (§ 2 del 048) y lo normal será la breve.
El smoke mide cuántos intercambios tras gol arrancan y con qué variante.

### 3.6 Celebración visual (P1 marcador y ficha; P2 rótulo animado)

Función pura `golEnCelebracion(registro, tick): EventoArena | null` en `src/arena/vista.ts`:
el último evento `gol` con `tick − gol.tick < CANTO_GOL.celebracionS / ARENA.pasoS`. Se calcula
desde el **cursor visible** (`estadoVisual`), así que funciona igual en emisión, directo,
repetición, al arrastrar el deslizador y en pausa, sin temporizadores ni estado propio, y
desaparece sola a los 8 s de partido.

- **Marcador.** `.arena-score` recibe `data-gol="local" | "visita"` mientras dura la celebración.
  CSS: la barra de color del equipo que marcó (`::before` del local o `::after` de la visita)
  pasa de 6 a 10 px de ancho y recibe `box-shadow: 0 0 0 2px var(--ar-score-bg)`; `strong` recibe
  `box-shadow: 0 0 0 3px var(--ar-score-bg)` y la animación `arena-gol-marcador` (dos pulsos de
  600 ms de ese `box-shadow`). **El texto de `strong` no cambia** y los `span` siguen siendo los
  dos de siempre con `data-favorite`.
- **Rótulo.** Dentro de `.arena-pitch-wrap` (que pasa a `position: relative`), **antes** del
  `<svg>`, se añade `<p className="arena-goal-banner" data-lado={lado} aria-live="polite">` con
  `<span className="arena-goal-word">{t("Goal", "Gol")}</span>`, el nombre del equipo y el del
  goleador separados por «·». Posición absoluta arriba y centrada, `pointer-events: none`,
  `max-width: calc(100% - 2·var(--ar-s3))`, `overflow-wrap: anywhere`; fondo `--ar-score-bg`, tinta
  `--ar-score-ink` (par ya medido: 16,2), borde izquierdo de 6 px con `--ar-home`/`--ar-away` y
  anillo de 1 px `--ar-home-ui`/`--ar-away-ring` como las barras del marcador (decorativo: el
  equipo va escrito, no solo en color). Mayúsculas por CSS solo en `.arena-goal-word`. Entra con
  `arena-gol-rotulo` (240 ms, una vez). **Sin `role="status"`**: varios e2e localizan
  `getByRole("status")` dentro de paneles y el tablero no debe sumar otro.
- **Ficha del goleador.** El `g.arena-player` cuyo `data-player === gol.jugador` recibe
  `data-gol="true"` y, como **último hijo** de su `.arena-token`, `<circle className="arena-goal-ring"
  r="3.2" aria-hidden="true" />` con `fill: none`, `stroke: var(--ar-select)` (≥ 4,4 frente al césped,
  047) y `stroke-width: .5`, con la animación `arena-gol-anillo` (opacidad 1 → .25, 1,2 s,
  infinita mientras dure la celebración). Nada de `transform`, `transition` ni `animation` en
  `.arena-player`, `.arena-ball` ni `.arena-referee` (047); el anillo es un elemento propio y
  `.arena-token > circle` sigue devolviendo primero el círculo de la ficha. Si el goleador ya no
  está en el campo (sustituido), no hay anillo y el rótulo se muestra igual.
- **Movimiento reducido.** Con `prefers-reduced-motion: reduce`, `arena-gol-marcador`,
  `arena-gol-rotulo` y `arena-gol-anillo` quedan en `none`: el rótulo, el anillo y el realce
  aparecen estáticos y desaparecen a los 8 s. Se añade al bloque existente de `globals.css`.
- **Tokens.** Ningún color nuevo: solo `--ar-score-bg`, `--ar-score-ink`, `--ar-select`,
  `--ar-home*`, `--ar-away*`. Claro y oscuro heredan. 360 px sin desborde (`scrollWidth ≤ 360`).
- **Selectores intactos** (lista del 047): no cambian `data-testid`, roles, nombres ni textos
  existentes; `.arena-score strong` sigue siendo exactamente el marcador; `.arena-score` contiene
  el nombre del local; `arena-referee` conserva un solo `rect`.

**Audio de público: ninguno.** No hay grabaciones propias ni licenciadas, un ruido sintetizado
sonaría peor que el silencio y competiría con la voz en el mismo contexto de audio. La grada sigue
representada por `estado.aficion` (texto) y por la celebración visual. Decisión cerrada para la
entrega; un brief posterior podría generar un rugido propio y sincronizarlo con `rugido`.

### 3.7 Constantes (`CANTO_GOL` en `src/sim/limites.ts`, comentadas)

```ts
/** Brief 050 · Canto de gol del narrador. Prosodia y estructura medidas el 22 oct con Speech real
 * (docs/evidencia/canto-gol-050/indice.json): dos tramos en un solo <s> duran ≈ 9 s; cada frontera
 * de elemento u oración añade ≈ 1 s de silencio. La escucha humana puede ajustar cifras, no la estructura. */
export const CANTO_GOL = {
  /** Porcentajes SSML y styledegree por tramo. El grito usa el máximo (2); los hechos bajan para que
   * el marcador se entienda; el autogol no grita. */
  tramos: {
    grito:   { rate: -20, pitch: 16, volume: 30, grado: 2 },
    hechos:  { rate: 6, pitch: 6, volume: 10, grado: 1.3 },
    autogol: { rate: 0, pitch: 3, volume: 6, grado: 1 },
  },
  /** Estilo por idioma y tramo según el catálogo real del 22 oct: Jorge solo cheerful/chat (ninguna
   * voz es-* del recurso tiene shouting); Jenny admite shouting. Si la voz efectiva no lo admite,
   * se omite express-as y queda la prosodia (comportamiento vigente de prepararVoz). */
  estilos: {
    es: { grito: "cheerful", hechos: "cheerful", autogol: "cheerful" },
    en: { grito: "shouting", hechos: "excited", autogol: "excited" },
  },
  /** Silencio final del canto (como el jubilo actual). */
  pausaFinalMs: 380,
  /** Caracteres máximos del texto (tramos unidos): 150 / MESA_ARENA.dialogo.caracteresPorSegundoVoz
   * + 0,38 ≈ 16,2 s < VOZ_BUFFER.duracionMaxS. El canto real con nombres de 16–23 caracteres dura ≈ 9 s. */
  maxCaracteres: 150,
  /** «Sobre el final»: desde esta fracción de la duración y con diferencia ≤ tardioDiferenciaMax tras
   * el gol. Misma regla que la intensidad 1 de expresionEvento (que pasa a leer de aquí). */
  tardioDesdeFraccion: 0.8, tardioDiferenciaMax: 1,
  /** Diferencia a favor, después del gol, desde la que el tramo B dice «goleada». */
  goleadaDesde: 3,
  /** Segundos de partido (cursor visible) que duran el rótulo, el anillo y el realce del marcador. */
  celebracionS: 8,
  /** Caducidad de la candidatura de la Mesa disparada por un gol: el canto (≈ 9 s) y calmaMinS ocupan
   * casi los 12 s de caducidadInvitadoS. Los demás temas conservan la del 045. */
  caducidadInvitadoTrasGolS: 20,
  /** Números del marcador en palabras hasta aquí; desde 10, cifras. */
  numerosEnPalabrasHasta: 9,
  plantillas: {
    grito: {
      es: ["¡Gooool de {goleador}!", "¡Gol, gol, gooool de {goleador}!", "¡Gooool, gol de {goleador}!", "¡Gooool! ¡{goleador}!"],
      en: ["Goooal by {goleador}!", "Goal, goal, goooal by {goleador}!", "Goooal, {goleador} scores!", "Goooal! {goleador}!"],
    },
    autogol: { es: "Gol en propia puerta de {goleador}.", en: "An own goal by {goleador}." },
    situacion: {
      es: { empate: "{equipo} empata", recorte: "{equipo} recorta distancias", goleada: "Goleada de {equipo}", ampliacion: "{equipo} amplía la ventaja", apertura: "{equipo} se adelanta", ventaja: "{equipo} se pone por delante" },
      en: { empate: "{equipo} level it", recorte: "{equipo} pull one back", goleada: "It's a rout for {equipo}", ampliacion: "{equipo} extend their lead", apertura: "{equipo} take the lead", ventaja: "{equipo} go in front" },
    },
    hechos: { es: "{situacion}, {marcador}, a los {segundos} segundos.", en: "{situacion}, {marcador}, after {segundos} seconds." },
    tardio: { es: "Sobre el final, ", en: "Late on, " },
    numeros: { es: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"], en: ["nil", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"] },
    marcador: { es: "{local} a {visita}", en: "{local}–{visita}" },
  },
} as const;
```

Ninguna prueba repite estas cifras ni textos a mano: los lee de `CANTO_GOL`. `expresionEvento`
sustituye su `0.8` y su `1` por `tardioDesdeFraccion` y `tardioDiferenciaMax`.

## 4. Fuera de alcance

- Audio de público, rugidos sintetizados, música o efectos.
- Repeticiones visuales, estelas del balón, confeti, cambios de cámara o pantalla completa.
- Cambios en el motor, `RegistroArena`, `hechosArena`, V1–V8, `PRIORIDAD_EVENTO_ARENA`,
  `MESA_ARENA.calmaMinS`, las voces invitadas, la crónica principal o el Analista.
- Cantos distintos por audiencia (aficionado/analista/jugador) o por club favorito.
- Cambiar la voz del narrador o añadir una segunda voz al canto.

## 5. Pruebas exigidas

Cada mutación se ejecuta y se anota en la bitácora con la prueba que pone en rojo.

**`src/arena/__tests__/canto-gol.test.ts` (nuevo).**
- Sobre los fixtures v1–v4 y goles sintéticos: `goleador` sale de `jugador` (nunca de `receptor`
  ni de `ultimoToque`), `equipo` de `config.partido[lado]`, el marcador suma solo goles ≤ tick
  (un `gol` añadido en `tick + 1` no cambia el texto) y los segundos son ⌊tick · pasoS⌋.
- Tabla de situaciones: para cada clave un marcador antes/después construido a mano y el texto
  esperado leído de `CANTO_GOL.plantillas`; el orden de resolución (empate antes que recorte,
  goleada antes que ampliación) con un caso que cumpla dos reglas.
- «Sobre el final» con tick justo en el umbral y fuera, y con diferencia 2 (no aplica);
  `expresionEvento` devuelve intensidad 1 exactamente en los mismos casos.
- Autogol sintético: tramo A sin grito, tipo `autogol`, `lado` = equipo que recibe el gol a favor.
- Números: 0 → «cero»/«nil», 9 → palabra, 10 → «10»; orden local–visita.
- Presupuesto: todas las combinaciones (4 variantes × 6 situaciones × tardío × ES/EN) con los
  nombres más largos de los fixtures y de 20 semillas → `texto.length ≤ maxCaracteres`;
  invariante `maxCaracteres / caracteresPorSegundoVoz + pausaFinalMs / 1000 < VOZ_BUFFER.duracionMaxS`.
- `texto === tramos.join(" ")` en todo fragmento con `canto`; ES y EN con la misma estructura.
- Ningún tramo B contiene «gana», «victoria», «winner» ni «decisivo» (lista en la prueba):
  nada sobre el resultado final.
- `elegirVarianteVoz` con memoria que ya oyó la variante 0 elige otra.

**`voz-expresiva.test.ts` (ampliar).**
- `prepararVoz` con `canto`: exactamente un `<s>`, dos `<mstts:express-as>` (o `<prosody>` sin
  estilo si la voz no lo admite), valores de `rate`/`pitch`/`volume`/`styledegree` iguales a
  `CANTO_GOL.tramos`, estilos de `CANTO_GOL.estilos` (ES `cheerful`; EN `shouting` y `excited`),
  `break` final igual a `pausaFinalMs` y ningún `<break>` entre tramos.
- `canto` con `rol: "comentarista"`, con `emocion` distinta de `jubilo` o con `texto` ≠ unión
  → lanza.
- Las pruebas actuales de `jubilo` sin `canto` (`cheerful`/`excited`, sin `express-as` cuando la
  voz no lo admite) siguen en verde.

**`buffer.test.ts` (ampliar).**
- Sobre una fuente activa de prioridad `PRIORIDAD_EVENTO_ARENA.gol`: reinicio, tiro, atajada,
  roja e invitado devuelven `null`; otro gol devuelve `interrumpirAnterior: true`; el cierre
  (`cierre = true`, prioridad 0) devuelve `null` mientras está ocupada y un plan al liberarse.

**`turnos.test.ts` (ampliar).**
- Una candidata con `tema: "gol"` arranca a `caducidadInvitadoS + 1` s del gol y no a
  `caducidadInvitadoTrasGolS + 1`; una de `tema: "atajada"` sigue caducando a `caducidadInvitadoS`.
- `segmentoVozValido` acepta el segmento del canto (un fragmento con `canto`) y rechaza dos
  fragmentos (documenta por qué el canto es un solo fragmento).

**`src/ui/__tests__/arena-canto-gol.test.tsx` (nuevo, `renderToStaticMarkup` como en
`arena-cifras.test.tsx`).**
- `golEnCelebracion`: en el tick del gol y hasta `celebracionS − pasoS` devuelve el gol; en
  `celebracionS` devuelve `null`; con dos goles devuelve el último.
- Con el cursor dentro de la celebración: `.arena-score[data-gol]` con el lado correcto, `strong`
  con exactamente `{l}–{v}`, dos `span`, el rótulo con «Gol»/«Goal», el equipo y el goleador,
  `data-gol` en la ficha del goleador y `.arena-goal-ring` como último hijo de su `.arena-token`;
  fuera de la celebración nada de lo anterior. Goleador sustituido → rótulo sin anillo.

**E2e `e2e/arena-canto-gol.spec.ts` (nuevo; rutas y Speech simulados como en
`e2e/arena-buffer.spec.ts`, «un pasaje largo … un gol lo interrumpe», duelo v3 con gol en el tick
231; `construirRelato` real en la ruta simulada para que el fragmento lleve `canto`; duraciones
del fixture y prioridades de `PRIORIDAD_EVENTO_ARENA`; `celebracionS` importado de `CANTO_GOL`).**

| Qué ocurre | Qué se comprueba |
| --- | --- |
| Gol en el tick 231 con clip de 9 s; reinicio en el tick siguiente con clip de 1,5 s | la fuente del gol no queda `detenida`; la del reinicio no arranca; `.arena-score strong` = «1–0»; el transcript muestra el texto del canto |
| Cursor en [231, 231 + celebracionS·10) | rótulo visible con equipo y goleador; `g[data-gol]` es `gol.jugador`; `.arena-score[data-gol="local"]` |
| Cursor ≥ 231 + celebracionS·10 | rótulo ausente; ningún `data-gol` |
| Segundo fixture: dos goles sintéticos a 4 s | la fuente del primer canto queda `detenida` y la del segundo arranca |
| `emulateMedia({ reducedMotion: "reduce" })`, 360 × 780, oscuro | `animationName === "none"` en rótulo, anillo y `strong`; `scrollWidth ≤ 360`; los e2e de 047/049 sobre el marcador siguen en verde |

**Mutaciones (cada una pone al menos una prueba en rojo).**

| # | Mutación | Prueba |
| --- | --- | --- |
| M1 | `goleador` tomado de `receptor` | hechos del canto |
| M2 | marcador que suma goles > tick | gol futuro |
| M3 | `empate` y `ventaja` intercambiados | tabla de situaciones |
| M4 | umbral tardío escrito a mano (0,8) en `expresionEvento` | cambiar `tardioDesdeFraccion` en la prueba con `vi.spyOn` del módulo de límites, o comprobar que el módulo lo importa |
| M5 | tramos en `<s>` separados o con `<break>` intermedio | forma del SSML |
| M6 | `styledegree` calculado con la fórmula antigua | valores de `CANTO_GOL.tramos` |
| M7 | igualdad de prioridad no interrumpe | segundo gol |
| M8 | caducidad del gol igual a la general | turnos |
| M9 | rótulo con `role="status"` | e2e de 049 (`getByRole("status")` en la ficha) |
| M10 | anillo como primer hijo de `.arena-token` | prueba UI (último hijo) y script de contraste |
| M11 | celebración por temporizador en vez de cursor | prueba UI con cursor retrocedido |
| M12 | tramo B con «gana» | lista negra |

**Cierre.** `npm test`, `npm run typecheck`, `npm run e2e` de arena en verde;
`node docs/evidencia/rediseno-047/contraste.mjs` sigue saliendo con 0 (no hay pares nuevos; si
Opus añade un color, añade el par); capturas claro/oscuro y 360 px con el rótulo visible en
`docs/evidencia/canto-gol-050/`; publicación y smoke público con un gol real oído en ES y EN
(clip guardado y duración medida); bitácora con las mutaciones anotadas.

## 6. Orden sugerido para medio día

1. `CANTO_GOL`, `expresionEvento` leyendo las dos cifras, `cantoGol()` en `relato.ts` (texto y
   tramos) y `canto` en `FragmentoVoz`; pruebas de hechos y situaciones (1,5 h).
2. `prepararVoz` con `canto`; pruebas de SSML; comprobar `claveAudio` estable (45 min).
3. `planVozBuffer` (segundo gol) y caducidad por `tema: "gol"`; pruebas (30 min).
4. `golEnCelebracion`, marcador, rótulo, anillo y CSS con movimiento reducido; prueba UI (1 h).
5. E2e, `npm run e2e` de arena, contraste, capturas, bitácora (1 h). Si el tiempo se agota, el
   rótulo animado pasa a estático (P2) y se anota.

## 7. Límites honestos y riesgos

- **La emoción no está medida, solo aproximada.** Pico, media y duración no miden lo que oye una
  persona. La escucha humana de los clips de la evidencia está pendiente; si Carlos prefiere
  `excited` a `shouting` en inglés o menos pitch en español, cambia una constante.
- **«Gooool» es una grafía, no una garantía de pronunciación.** La duración medida (1,2–2 s)
  sugiere vocal sostenida en español; en inglés la repetición no alarga nada y el efecto depende de
  `rate`. Si al escuchar Jorge deletrea, se cambia la plantilla a «¡Gol de {goleador}!» con
  `rate −30 %` sin tocar la estructura.
- **El canto ocupa ≈ 9 s** en los que el narrador no dice otra cosa; un remate o reinicio
  inmediatos caducan. Es el precio de cantar el gol completo; no se acorta el audio.
- **Menos diálogos completos tras gol.** La ventana del 048 se reduce en ≈ 7,5 s; la caducidad
  ampliada evita que el invitado calle del todo, pero suena más tarde del gol (hasta 20 s) y casi
  siempre en variante breve. Se mide en el smoke.
- **Dos goles en menos de 9 s** cortan el primer canto; el transcript marca el primero como
  `interrumpida`. Es raro (pausa de 1,5 s y saque en medio) y preferible a perder el segundo.
- **Las situaciones son etiquetas de marcador, no juicios.** «Goleada» es diferencia ≥ 3 por
  definición de `CANTO_GOL`; «sobre el final» es una fracción de la duración simulada. Nada afirma
  quién ganará.
- **El rótulo y el anillo dependen del cursor visible**, no de la reproducción del audio: con la
  voz apagada o retrasada, la celebración visual aparece en el instante del gol igualmente, y el
  canto puede sonar hasta 3 s después.
- **Coste de Speech:** +≈ 200 caracteres de SSML por gol e idioma, sin solicitudes nuevas; la deuda
  de presupuesto a 180 s en ES+EN (048) sigue siendo decisión de Carlos.
- **Sin público.** La celebración es voz y pantalla; cualquier rugido queda para otro brief.

## Versión 1.1 (22 de octubre): decisiones tras la revisión de Codex

La revisión de Codex de la versión 1 ([evidencia](../evidencia/canto-gol-050/codex-brief-v1.md),
GPT-6.1 Sol, solo lectura) dio NO CERRADO: 1 bloqueante, 8 mayores y 1 menor. Fable verificó cada
hallazgo contra el código y amplió el experimento (rondas 4 y 5, ocho clips más: 29 en total,
19.236 caracteres de SSML). Estas decisiones **prevalecen sobre el texto anterior**; la numeración
es la de Codex.

1. **Bloqueante · Un gol antiguo no puede cortar al reciente.** Confirmado:
   `src/ui/ArenaEmisionBuffer.tsx:251` ordena los clips por prioridad descendente y, en empate,
   por **tick descendente**; con dos cantos disponibles arrancaría el nuevo y, en el fotograma
   siguiente, la regla de igualdad de la v1 dejaría que el viejo lo cortara. Decisión: `Activa`
   gana `tick`; `planVozBuffer` gana el parámetro `eventoAnteriorS` y la igualdad de prioridad
   solo interrumpe si `prioridad === prioridadAnterior === PRIORIDAD_EVENTO_ARENA.gol` **y**
   `eventoS > eventoAnteriorS`; el consumidor **descarta como superado** todo clip de prioridad
   gol con `tick ≤ s.activa.tick` mientras la fuente activa sea un gol. Pruebas: (a) dos clips de
   gol ya disponibles, el nuevo arranca y el viejo se borra sin arrancar; (b) respuestas fuera de
   orden (el clip del gol viejo llega después de arrancar el nuevo) → se borra; (c) el segundo gol
   que llega mientras suena el primero → corta. Mutación M7 pasa a ser «igualdad sin comparar
   ticks» → (a) en rojo.
2. **Dos goles en la misma ventana de cinco segundos.** Confirmado: `relatoBuffer`
   (`src/arena/relato.ts:98–100`) narra una sola noticia por tramo de 50 ticks y, entre goles,
   el más reciente. Decisión: **límite declarado**, no se amplía el productor (el canto es un
   solo fragmento, § 1): si dos goles caen en el mismo tramo, solo el último se canta; el
   primero sigue en la descripción, el marcador, la celebración visual (que es por cursor) y la
   Mesa. Es casi imposible en el motor (pausa de 1,5 s y saque en medio). Prueba unitaria que
   documenta ese caso sobre un registro sintético; el e2e del segundo gol usa ticks en tramos
   distintos (231 y 290).
3. **Caducidad de 20 s en todos los caminos.** Confirmado: `CandidataTurno` no lleva `tema`
   (`src/arena/turnos.ts:15`), y `aTiempo` (41), `descartesTurno` (64), el consumidor (226) y
   `esperaReintentoInvitado` (173) usan `caducidadInvitadoS`. Decisión: función pura
   `caducidadInvitadoS(tema: string): number` en `turnos.ts` (`tema === "gol"` →
   `CANTO_GOL.caducidadInvitadoTrasGolS`; resto → `MESA_ARENA.caducidadInvitadoS`);
   `CandidataTurno` gana `tema` (el consumidor lo copia de `intervencion.tema`);
   `esperaReintentoInvitado` gana el parámetro `tema`; `horizonteS` no cambia. Pruebas: un 429
   entre los segundos 12 y 20 de una candidatura `gol` se reintenta y una `atajada` no; límite
   exacto (20,0 s sí, 20,1 s no); `descartesTurno` conserva la candidatura `gol` a los 15 s.
4. **La celebración no admite goles futuros.** Confirmado: la condición escrita en § 3.6 era
   una resta sin cota inferior. Decisión: `golEnCelebracion` devuelve el gol de **mayor tick**
   que cumple `0 ≤ tick − gol.tick < CANTO_GOL.celebracionS / ARENA.pasoS`, sobre
   `registro.eventos` completo (no solo el prefijo visible), para que retroceder el cursor
   funcione. Pruebas: antes del primer gol → `null`; entre dos goles → el primero solo dentro de
   su ventana; al retroceder desde después del segundo hasta el primero → el primero; cursor en el
   tick exacto del gol → el gol.
5. **`shouting` de Jenny en la lista admitida.** Confirmado: `estilosAdmitidos` en
   `src/arena/voz.ts:16` solo tiene `excited` y `sad` para `en-US-JennyNeural`. Decisión: se añade
   `shouting` (catálogo real del 22 oct, `catalogo-estilos.json`); el resto de voces no cambia.
   Pruebas: `prepararVoz` con `canto` y Jenny produce `style="shouting"` en el grito y `excited`
   en los demás tramos; con `ARENA_VOZ_EN` apuntando a `en-US-GuyNeural` (admite `shouting` y
   `excited`) también; con Jorge, `cheerful` en todos; con una voz simulada sin estilos, solo
   `<prosody>`.
6. **El anillo no se convierte en disco.** Confirmado: `.arena-local .arena-token > circle`
   (`globals.css:2879`, especificidad 0,2,1), la visita, selección/foco (2883–2884) y favorito
   (3058–3059, 0,3,1) pintan todo círculo hijo. Decisión: regla propia
   `.arena-player[data-gol] > .arena-token > circle.arena-goal-ring { fill: none; stroke:
   var(--ar-select); stroke-width: .5; stroke-dasharray: none }` (0,4,1, gana a todas) y el
   anillo solo existe cuando `data-gol` está presente. Pruebas e2e (P2, § «Qué cambia»): estilos
   calculados del anillo con local, visitante, seleccionado, con foco y favorito (`fill` =
   `none`, `stroke` = `--ar-select`), y `animation-name`, `transition-property` y `transform`
   de CSS en `.arena-player`, `.arena-ball` y `.arena-referee` iguales a `none`/`all 0s`/`none`
   como hoy (la posición sigue en el atributo `transform`).
7. **Mutaciones con prueba en rojo garantizada.** Decisión: M9 se comprueba directamente
   (`p.arena-goal-banner` sin atributo `role` y `getByRole("status", { name: /Gol|Goal/ })` con
   cero coincidencias en el tablero); M4 se prueba sobreescribiendo en tiempo de ejecución
   `CANTO_GOL.tardioDesdeFraccion` (el objeto es mutable en runtime; la prueba lo restaura en
   `afterEach`) y comprobando que `expresionEvento` y el prefijo «sobre el final» cambian con la
   constante, de modo que un `0.8` literal queda en rojo; M11 exige una secuencia explícita
   (cursor después de la ventana → sin rótulo; retroceso antes del gol → sin rótulo; dentro de la
   ventana → rótulo) con `vi.useFakeTimers` y avance de reloj sin cambios de cursor → nada cambia.
   Opus anota en la bitácora el resultado real (rojo/verde) de cada mutación ejecutada.
8. **Duración medida, no estimada; cierre probado de extremo a extremo.** Medido (ronda 5):
   la combinación más larga de la forma final (§ punto 10: tres tramos), con nombres de 26 y 27
   caracteres, «sobre el final», goleada y marcador en cifras, dura **13,87 s (ES, 143 c) y
   14,23 s (EN, 140 c)**, frente a `VOZ_BUFFER.duracionMaxS` = 24. La estimación por caracteres
   solo decide el tope de plantillas; la cota es esta medida y se repite en el smoke con un gol
   real. Confirmado además que `ArenaNarracion` («Escuchar desde el inicio») no rechaza un
   tramo del narrador por duración (`src/ui/ArenaNarracion.tsx:120–130`, solo «Pista demasiado
   larga» por bytes): decisión, **no se añade rechazo**; la pista completa reproduce el canto sin
   recortar y la cota medida lo cubre. E2e nuevo (P2): gol en la última ventana con clip de 9 s,
   cierre pedido con respuesta tardía y un tramo normal pendiente → orden de fuentes
   canto → cierre, ninguna fuente después del cierre, `data-narration-kind` del cierre al final.
9. **Autogol y desvío, contrato único.** Confirmado: el texto del hecho (`src/arena/vista.ts:50`)
   es «Gol de {nombre}.» y no distingue desvíos; `motivo: "desvio"` existe en el gol. Decisión:
   un gol con `motivo: "desvio"` recibe el **canto normal** (el desvío no se verbaliza; el
   goleador es `jugador`, como en el marcador); se elimina la frase de la v1 sobre «con desvío».
   Autogol: sin tramo grito; tramo goleador = `plantillas.autogol`; el rótulo usa
   `plantillas.rotulo.autogol` («Autogol» / «Own goal») en vez de «Gol»/«Goal», con el equipo
   beneficiado (`evento.lado`) y el jugador. Pruebas: autogol que empata (`empate`) y autogol que
   pone por delante al rival (`apertura`/`ventaja` según el marcador previo), con el rótulo
   identificando la propia puerta; las seis situaciones siguen sobre `evento.lado`.
10. **Evidencia de volumen, coste y plazo.** (a) Volumen: la media del primer segundo
    penalizaba a la forma de la v1 porque el grito arrastra la vocal; medida sobre los **dos
    primeros segundos** (ronda 4, `README.md`): control −23,6 dB, forma v1 −21,8, `x-loud` −24,0
    (peor), pitch +8 % −21,8, rate −10 % −21,9, y **grito separado en tres tramos dentro de un solo
    `<s>` −19,5 dB (+4,1 dB sobre el control, pico −1,1 dB)**, por 9,93 s en vez de 8,68.
    **Decisión: la forma final tiene tres tramos en un único `<s>`** —`grito` («¡Gooool!» /
    «Goooal!», sin variantes), `goleador` (cuatro variantes) y `hechos`— en los dos idiomas
    (EN medido en ronda 5: −12,9 dB en dos segundos con `shouting`). `CANTO_GOL.tramos` pasa a
    `grito { rate −30, pitch 16, volume 30, grado 2 }`, `goleador { 10, 12, 22, 1.8 }`,
    `hechos { 6, 6, 10, 1.3 }`, `autogol { 0, 3, 6, 1 }`; `plantillas.grito` = `{ es: "¡Gooool!",
    en: "Goooal!" }` y `plantillas.goleador` = ES `["¡Gol de {goleador}!", "¡Lo marca
    {goleador}!", "¡{goleador}, gol!", "¡Gol, gol de {goleador}!"]`, EN `["Goal by {goleador}!",
    "{goleador} scores!", "{goleador}, goal!", "Goal, goal by {goleador}!"]`. La invariante
    `texto === tramos.join(" ")` y el único `<s>` no cambian. (b) Coste, medido con SSML real:
    hoy 359 caracteres por gol e idioma; forma final 689–734 (**+330 a +375**, según nombres y
    variante); peor caso 3 goles × 2 idiomas ≈ +2.250 de 24.000 (≈ 9 %), sin solicitudes nuevas.
    Opus comprueba con `prepararVoz` sobre los fixtures v3 y v4 que el delta por gol queda en
    ese rango. (c) Plazo: la v1 sumaba 5 h 15 min sin validación; la estimación realista del
    conjunto es 7–8 h. Se fija el recorte P1 de abajo para medio día (≈ 4,5 h); lo demás es P2
    y se declara en la bitácora si no entra. (d) La escucha humana sigue pendiente; puede
    cambiar cifras de `CANTO_GOL.tramos` o el estilo EN, no la estructura.

### Qué cambia para Opus

- **P1 (medio día, obligatorio):** `CANTO_GOL` con los tramos y plantillas del punto 10;
  `cantoGol()` en `relato.ts` con las seis situaciones, «sobre el final», autogol y desvío
  (punto 9); `canto` en `FragmentoVoz` y su renderizado en `prepararVoz` (un `<s>`, tres
  tramos, `shouting` admitido para Jenny, punto 5); `expresionEvento` leyendo
  `tardioDesdeFraccion`/`tardioDiferenciaMax`; orden cronológico entre goles (punto 1) y
  caducidad por tema (punto 3); `golEnCelebracion` con cota inferior (punto 4); marcador con
  `data-gol` y rótulo **estático** (sin animación) con `rotulo.autogol`; pruebas unitarias y
  UI de §5 ajustadas a esta versión (incluidas M4, M7, M9 y M11 según el punto 7), y una
  ampliación del e2e existente «un pasaje largo … un gol lo interrumpe» en
  `e2e/arena-buffer.spec.ts`: rótulo y `data-gol` del marcador en el gol del tick 231, texto
  del canto en el transcript, fuente del gol no detenida por el reinicio.
- **P2 (siguiente franja):** anillo del goleador con su regla CSS (punto 6) y sus estilos
  calculados en e2e; animaciones `arena-gol-*` con `prefers-reduced-motion`; e2e de dos goles
  (ticks 231 y 290) y de gol final + cierre tardío (punto 8); par del rótulo en
  `contraste.mjs`; smoke público bilingüe con un gol oído y su duración; registro de las
  mutaciones restantes.
- **Se retira de la v1:** la fórmula `1,1 + 0,7·intensidad` para el canto, la igualdad de
  prioridad sin ticks, la frase sobre «con desvío», la forma de dos tramos y la medida del
  primer segundo como criterio.
