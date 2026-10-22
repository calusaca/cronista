# 054 — Variedad del grito de gol: catálogo medido, rotación determinista y gritos condicionados

## Estado

Brief **cerrado** el 22 de octubre de 2026, escrito por Fable tras experimentar con Azure Speech
real. Debe poder implementarse en **medio día** (la entrega cierra el 27 de octubre). Lo marcado
**P1** es obligatorio; **P2** solo entra si P1 está en verde.

Pedido de Carlos (22 de octubre, tras oír el canto publicado): «El grito de gol está bien pero tal
vez que haya diferencias, suena igual siempre». Ejemplos suyos: «gooooooooolllllllll», «gol gol gol
gol gol gol», «qué golaaaazo», «yyyyy guuuoooolll», «remate y go go go go goooooll».

Amplía el [050](050-canto-de-gol.md) (v1.1) sin cambiar su estructura: el canto sigue siendo un
único `FragmentoVoz` con tres tramos (`grito`, `goleador`, `hechos`) dentro de un solo `<s>`, el
autogol sigue sin grito y las reglas de prioridad, orden cronológico entre goles, caducidad de la
Mesa y celebración visual no se tocan. Evidencia del experimento:
[`docs/evidencia/canto-gol-054/`](../evidencia/canto-gol-054/README.md) (48 clips reales, SSML y
medidas).

## 1. Qué pasa hoy (verificado en el código)

- **El grito es un texto fijo.** `CANTO_GOL.plantillas.grito` (`src/sim/limites.ts`) es
  `{ es: "¡Gooool!", en: "Goooal!" }`, sin variantes; `cantoGol` (`src/arena/relato.ts:73–88`) lo
  copia tal cual en el primer tramo. Solo el tramo `goleador` tiene cuatro variantes, elegidas en
  emisión por `elegirVarianteVoz` sobre los cuatro cantos completos y, en `vivo`/`completo`, por
  `varianteVoz(seed, evento.id)`.
- **La prosodia del grito también es fija.** `parteCanto` (`src/arena/voz.ts:320–331`) lee
  `CANTO_GOL.tramos.grito` (`rate −30, pitch 16, volume 30, grado 2`) para todo gol.
- **La memoria de escucha no sirve para el grito.** `RecuerdoVoz` (`src/arena/editorial.ts:6–19`)
  guarda 12 recuerdos de los últimos 600 ticks y vive en el estado del espectador
  (`ArenaEmisionBuffer.tsx`), solo en modo `buffer`; «Escuchar desde el inicio» (`completo`) no
  recibe memoria. Dos goles separados más de 60 s no se «recuerdan».
- **Relación gol–remate en el motor.** `resolverSalida` (`src/arena/motor.ts:528`) y el destino del
  vuelo (`motor.ts:682`) crean el `gol` con `desde = vuelo.origen` (el punto desde donde salió el
  balón) y `hasta` = punto de cruce de la línea de meta; `distanciaM` es la distancia entre ambos.
  El `tiro` previo (`sacarBalon`, `motor.ts:303`) tiene el mismo `desde`. En los 9 goles de los
  fixtures v1–v4, el duelo v3 y `arena-llm-v3` (análisis del 22 oct), **los 9** tienen un `tiro`
  del propio goleador con el mismo origen, de 0 a 9 ticks antes y sin ningún evento entre medias.
  La distancia en profundidad del origen a la línea (`|hasta.x − desde.x|`) va de 0,0 a 18,3 m:
  dos goles (v1 `a23`, 16,6 m; duelo `a14`, 18,3 m) salen desde fuera del área (16,5 m); el resto,
  desde dentro (0,0–7,9 m).
- **Consumidores.** `segmentoVozValido` (`src/arena/turnos.ts`) solo exige un fragmento; nada más
  valida `canto.tramos` (no hay esquema zod de la respuesta para el canto). El transcript y la
  descarga del 053 muestran `texto`.

## 2. Experimento con Speech real (22 de octubre)

Método en la [evidencia](../evidencia/canto-gol-054/README.md): 44 gritos sueltos (23 ES, 21 EN)
con la prosodia de `CANTO_GOL.tramos.grito` salvo el `rate`, más 4 clips de la forma completa; medidas
con ffmpeg (duración decodificada, pico y media del clip y de sus dos primeros segundos, **duración
del habla** entre el silencio inicial y el final, silencios internos). 48 solicitudes, 18.208
caracteres de SSML.

Hallazgos que fijan el diseño:

1. **El deletreo se detecta por duración.** «¡Yyyy gooool!» habla 3,25 s frente a 1,41 s de «¡Y
   gooool!» (+1,84 s): Jorge deletrea la conjunción. **Rechazado.** «¡Goooolllll!» habla 0,79 s
   frente a 1,26 s de «¡Gooool!»: las eles finales **cortan** la vocal. **Rechazado.** «¡GOOOL!»
   dura 0,96 s (menos que en minúscula) y en inglés «GOOOAL!» es idéntico bit a bit en medidas a
   «Goooal!»: las mayúsculas no aportan nada. **Rechazadas.** «¡Guuuoooolll!» y «Guuuoooal!» no
   presentan anomalía de duración, pero el ES tiene un micro-silencio interno de 83 ms y ninguno
   gana nada frente a «¡Goooooooool!»/«Goooooooal!»: **fuera del catálogo**, grafía no editorial.
2. **La grafía estirada sí alarga a −30 %, también en inglés.** ES: «¡Gooool!» 1,26 s,
   «¡Goooooooool!» 1,68 s. EN: «Goooal!» 0,53 s, «Goooooooal!» 1,03 s (el 050 midió «sin efecto»
   a rate 0/−15 %; a −30 % hay +0,50 s). La prosodia sola rinde menos: «¡Gol!» a −45 % 0,60 s;
   «Goal!» a −45 % 0,72 s; «Goooal!» a −45 % 0,67 s. Decisión: variedad **en el texto**, con un
   `rate` por grito, siempre entre −10 y −30 %; −45 % no entra porque además alarga el silencio
   final (1,98 s frente a 1,64).
3. **La repetición corta es la más sonora.** «Goal, goal, goal, goal!» a −10 % da −13,1 dB en los
   dos primeros segundos (la media más alta de todo el lote; control −17,2); «¡Gol, gol, gol,
   gol!» −19,5 (igual que el control ES) con pico −4,7 frente a −7,2. Las pausas internas miden
   0,11–0,21 s (no son fronteras de oración: ninguna cuesta ≈ 1 s).
4. **«Golazo»:** «¡Golaaaazo!» y «¡Golazo!» son las medias **más bajas** del lote ES (−23,3 y
   −24,4 dB); «¡Qué golaaaazo!» sube a −20,6 dB con pico −3,2 y habla 1,15 s. En inglés «What a
   goal!» (−17,3) gana a «What a goooal!» (−18,4).
5. **«Remate y gol»:** «¡Remate y gooool!» (1,56 s) frente a «¡Remate y gol!» (1,05 s), misma
   sonoridad; en inglés «Shot, and goooal!» (−16,4 dB, 1,59 s) frente a «Shoots and scores!»
   (−18,3). La coma produce una pausa de 0,36 s, no una frontera.
6. **Cota de duración de la forma completa** con el grito más largo de cada idioma, nombres de
   26/27 caracteres, «sobre el final», goleada y marcador en cifras: **13,87 s (ES, 148 c) y
   14,56 s (EN, 141 c)** frente a `VOZ_BUFFER.duracionMaxS` = 24. SSML por gol e idioma: 731–739
   (050: 689–734).

**Límite:** pico, media y duración son indicadores indirectos; no miden emoción ni si una vocal
estirada suena natural. La escucha humana **está pendiente** (§ 7) y puede sustituir un texto por su
reserva o cambiar un `rate`, nunca la estructura ni la regla de selección.

## 3. Diseño

### 3.1 Catálogo de gritos (P1)

`CANTO_GOL.gritos`: diez entradas paralelas ES/EN, cada una con `clave`, texto y `rate` por idioma,
y opcionalmente `condicion` y `prioridad`. Cinco son **generales** (siempre elegibles) y cinco
**condicionadas** (elegibles solo cuando su condición se cumple sobre el registro). Las cifras son
las medidas (habla en segundos, media de los dos primeros segundos en dB):

| i | clave | condición | ES (rate) | habla / 2 s | EN (rate) | habla / 2 s |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `gooool` | — | ¡Gooool! (−30) | 1,26 / −19,5 | Goooal! (−30) | 0,53 / −17,2 |
| 1 | `gooool_largo` | — | ¡Goooooooool! (−30) | 1,68 / −20,5 | Goooooooal! (−30) | 1,03 / −15,5 |
| 2 | `gol_x4` | — | ¡Gol, gol, gol, gol! (−10) | 1,71 / −19,5 | Goal, goal, goal, goal! (−10) | 1,78 / −13,1 |
| 3 | `gol_gol_gooool` | — | ¡Gol, gol, gol, gooool! (−20) | 2,52 / −19,1 | Go, go, go, goooal! (−20) | 1,71 / −16,0 |
| 4 | `y_gooool` | — | ¡Y gooool! (−30) | 1,41 / −19,4 | Aaaand goooal! (−30) | 1,15 / −16,1 |
| 5 | `remate` | `remate` | ¡Remate y gooool! (−25) | 1,56 / −21,7 | Shot, and goooal! (−25) | 1,59 / −16,4 |
| 6 | `golazo` | `golazo`, prioridad 1 | ¡Qué golaaaazo! (−25) | 1,15 / −20,6 | What a goal! (−25) | 1,09 / −17,3 |
| 7 | `tardio` | `tardio`, prioridad 2 | ¡Gooool sobre el final! (−30) | 2,18 / −21,4 | A late, late goooal! (−25) | 2,24 / −15,3 |
| 8 | `empate` | `empate`, prioridad 3 | ¡Gooool del empate! (−30) | 1,95 / −22,3 | Goooal, they're level! (−25) | 1,74 / −14,2 |
| 9 | `otro` | `otro`, prioridad 4 | ¡Y otro gooool! (−30) | 1,51 / −20,5 | Another goooal! (−30) | 1,58 / −14,5 |

Correspondencia con los ejemplos de Carlos: «gooooooooolllllllll» → 1; «gol gol gol gol» → 2 y 3;
«qué golaaaazo» → 6; «yyyyy guuuoooolll» → 4 («Yyyy» se deletrea y «Guuuoooolll» no es grafía
editorial; «¡Y gooool!» conserva la idea); «remate y go go go goooooll» → 5 (ES) y 3 (EN).

**Reserva** (renderizan bien, no entran por el tope de diez; sirven para sustituir tras la escucha,
misma fila, mismo tipo): ES «¡Gooool, gooool!» (2,33 s, −18,1), «¡Adentro, gooool!» (1,62 s,
−17,9), «¡Gooool, gol, gol!» (2,21 s), «¡Qué golazo!», «¡Remate y gol!»; EN «Goooal, goooal!»,
«It's in, goooal!», «Goooal, goal, goal!» (−13,3), «And goooal!», «What a goooal!», «Shoots and
scores!». Las reservas se listan en la evidencia, **no** en `CANTO_GOL`.

**Rechazados** (no entran ni como reserva): «¡Yyyy gooool!» (deletreo), «¡Goooolllll!» y
«Goooallll!» (la ele corta o no aporta), «¡GOOOL!»/«GOOOAL!» (sin efecto), «¡Guuuoooolll!»/
«Guuuoooal!» (grafía no editorial, pronunciación incierta), «¡Golaaaazo!» y «¡Golazo!» (las más
bajas), y todo `rate −45 %`.

### 3.2 Condiciones (P1): solo desde el registro

Funciones puras en `src/arena/relato.ts`, con `gol` el evento y `a` el marcador tras el gol
(`marcadorTrasGol`):

| Condición | Regla | Qué dato la respalda |
| --- | --- | --- |
| `remate` | existe un `tiro` `t` con `t.jugador === gol.jugador`, `t.tick ≤ gol.tick`, `t.desde.x === gol.desde.x` y `t.desde.y === gol.desde.y`, y **ningún evento** con tick en `(t.tick, gol.tick]` distinto del propio gol cuyo `tipo` esté en `CANTO_GOL.gritoRemate.tiposQueRompen` (`pase`, `recepcion`, `intercepcion`, `recuperacion`, `atajada`, `tiro`, `tiro_fuera`, `fuera_juego`, `reinicio`) | el origen del gol es el origen del vuelo del remate (`motor.ts:528, 682`); un gol de centro o pase que cruza la línea no cumple (su vuelo es `pase`) |
| `golazo` | `remate` **y** `Math.abs(gol.hasta.x − gol.desde.x) ≥ CANTO_GOL.golazoDesdeM` | `hasta.x` es la línea de meta (0 o `ARENA.largoM`); la distancia en profundidad del origen a la línea está en el registro |
| `tardio` | `golTardio(gol.tick, duracionS, a)` (050) | reloj y marcador registrados |
| `empate` | `situacionGol(gol.lado, a) === "empate"` (050) | marcador registrado |
| `otro` | `situacionGol(gol.lado, a) ∈ {"ampliacion", "goleada"}` (050): el equipo ya iba por delante antes del gol, así que ya había marcado | marcador registrado |

**«Golazo» es una palabra valorativa.** Se declara así: solo la habilita una regla medible
(remate desde ≥ `golazoDesdeM` = `ARENA.areaLargoM`, 16,5 m, en profundidad: «desde fuera del
área»), igual que «goleada» es diferencia ≥ 3 por definición en el 050. No mide belleza, ángulo ni
dificultad; un remate desde la esquina del área, a 25 m del poste lejano pero a 16 m de la línea,
**no** es golazo por esta regla, y se acepta. En los fixtures, 2 de 9 goles la cumplen.

### 3.3 Selección y memoria (P1): determinista, por partido, sin repetir hasta agotar

Función pura `gritosPartido(registro, idioma): Map<idGol, clave>` en `relato.ts`, recorriendo los
goles **no autogol** en el orden del registro (tick y posición). Con `usados` vacío al inicio:

1. `elegibles` = gritos sin condición ∪ gritos cuya condición se cumple para este gol.
2. `disponibles` = `elegibles − usados`; si queda vacío, `usados` se vacía y
   `disponibles = elegibles` (segunda vuelta: la repetición solo empieza al agotar el catálogo).
3. Si hay `disponibles` con `prioridad`, gana la de **menor número** (`golazo` 1, `tardio` 2,
   `empate` 3, `otro` 4): un gol tardío que empata desde fuera del área canta `golazo`; el
   siguiente que cumpla las tres, `tardio`.
4. Si no, gana el primero de `disponibles` en el **orden del partido**: las claves sin prioridad
   (las cinco generales y `remate`) ordenadas por
   `prngDerivado(seed, \`${CANTO_GOL.semillaGritos}:${clave}\`).next()`, con `seed =
   registro.config.partido.seed`. El orden cambia de un partido a otro y es idéntico en cada
   repetición del mismo.
5. La clave elegida entra en `usados` y en el mapa.

`cantoGol(evento, registro, idioma, variante)` conserva su firma y toma el grito de
`gritosPartido(registro, idioma).get(evento.id)`; las cuatro variantes del goleador de un mismo gol
**comparten el grito**, así que `elegirVarianteVoz` sigue eligiendo entre cuatro textos que solo
difieren en el goleador y la memoria de escucha del 050 no cambia de función. Los tres modos
(`vivo`, `completo`, `buffer`) producen el mismo grito para el mismo gol porque solo dependen del
registro. Un gol que no se canta por caer en el mismo tramo de cinco segundos que otro (límite 2 de
la v1.1 del 050) **consume igualmente su grito**: la secuencia no depende de qué se oyó.

Se descarta usar la memoria de escucha (`RecuerdoVoz`) para rotar el grito: vive solo en el modo
`buffer`, dura 600 ticks y es por espectador; una rotación por registro vale para «Escuchar desde el
inicio», para la descarga del 053 y para dos espectadores a la vez.

### 3.4 Tramo y SSML (P1)

`TramoCanto` gana `grito?: string` (la `clave`), **obligatorio cuando `tipo === "grito"`**. El
texto del tramo es el texto del catálogo para el idioma; la invariante `texto === tramos.join(" ")`
y el único `<s>` no cambian. `parteCanto`:

- Para `tipo === "grito"`: busca `CANTO_GOL.gritos` por `grito`; si no existe, o el texto del tramo
  no es exactamente el del catálogo en ese idioma, lanza «Interpretación de voz inválida».
  Renderiza `<prosody rate="{rate del grito}%" pitch="+16%" volume="+30%">` con `styledegree 2`
  y el estilo de `CANTO_GOL.estilos[idioma].grito` (050), filtrado por la voz efectiva como hoy.
- `CANTO_GOL.tramos.grito` pierde `rate` (lo aporta cada grito) y conserva `pitch`, `volume` y
  `grado`. Los demás tramos no cambian.
- `claveAudio` ya cubre el SSML: cada grito es una entrada de caché distinta, **sin solicitudes
  nuevas** (el gol sigue ocupando su tramo de cinco segundos).

### 3.5 Duración y presupuesto (P1)

- Cota medida de la forma completa con el grito más largo: 13,87 s (ES) y 14,56 s (EN) <
  `VOZ_BUFFER.duracionMaxS` (24). El 050 medía 13,87 / 14,23: el EN sube 0,33 s.
- `maxCaracteres` sigue en 150: la combinación más larga con los nombres de la prueba del 050
  (fixtures + 20 semillas: «Olímpico Montefrío Bajo», «Vicente Valinardi») mide 145 (ES) y 131 (EN)
  caracteres; con los nombres de la cota (26/27 c), 148. La prueba del presupuesto pasa a recorrer
  los diez gritos. Si un fixture nuevo la rompiera, se sube a 160 (160 / 9,5 + 0,38 ≈ 17,2 s < 24),
  nunca se acorta un grito.
- Coste de Speech: el grito pasa de 8 a ≤ 23 caracteres; SSML por gol e idioma 731–739 frente a
  689–734 (**+0 a +15**). Peor caso 3 goles × 2 idiomas ≈ +90 de 24.000: despreciable. Sin
  solicitudes nuevas.

### 3.6 Compatibilidad con el 050 (P1)

Sin cambios: autogol sin grito (`plantillas.autogol`); tres tramos en un `<s>`; `planVozBuffer`
(nada corta un canto; un gol más reciente sí, por `eventoS`); caducidad por `tema: "gol"`;
`golEnCelebracion`, rótulo y marcador; `expresionEvento`; selectores del 047/049. El rótulo visual
sigue diciendo «Gol»/«Goal»: el catálogo es de voz y transcript.

### 3.7 Constantes (`CANTO_GOL` en `src/sim/limites.ts`, comentadas)

```ts
  /** Brief 054 · Prosodia común del grito; el rate lo aporta cada grito del catálogo. */
  tramos: {
    grito: { pitch: 16, volume: 30, grado: 2 },
    goleador: { rate: 10, pitch: 12, volume: 22, grado: 1.8 },
    hechos: { rate: 6, pitch: 6, volume: 10, grado: 1.3 },
    autogol: { rate: 0, pitch: 3, volume: 6, grado: 1 },
  },
  /** Brief 054 · Catálogo de gritos medido el 22 oct (docs/evidencia/canto-gol-054/indice.json): habla
   * 0,5–2,5 s por grito, media de los dos primeros segundos −22,3…−19,1 dB (ES) y −17,3…−13,1 (EN).
   * Grafías rechazadas por duración: «Yyyy» (deletreo, +1,84 s), «lll» final (corta la vocal),
   * mayúsculas (sin efecto). rate entre −10 y −30: −45 alarga el silencio final sin sostener más.
   * Sin `condicion` = general; con `prioridad` = condicionado que se antepone a la rotación. */
  gritos: [
    { clave: "gooool", es: { texto: "¡Gooool!", rate: -30 }, en: { texto: "Goooal!", rate: -30 } },
    { clave: "gooool_largo", es: { texto: "¡Goooooooool!", rate: -30 }, en: { texto: "Goooooooal!", rate: -30 } },
    { clave: "gol_x4", es: { texto: "¡Gol, gol, gol, gol!", rate: -10 }, en: { texto: "Goal, goal, goal, goal!", rate: -10 } },
    { clave: "gol_gol_gooool", es: { texto: "¡Gol, gol, gol, gooool!", rate: -20 }, en: { texto: "Go, go, go, goooal!", rate: -20 } },
    { clave: "y_gooool", es: { texto: "¡Y gooool!", rate: -30 }, en: { texto: "Aaaand goooal!", rate: -30 } },
    { clave: "remate", condicion: "remate", es: { texto: "¡Remate y gooool!", rate: -25 }, en: { texto: "Shot, and goooal!", rate: -25 } },
    { clave: "golazo", condicion: "golazo", prioridad: 1, es: { texto: "¡Qué golaaaazo!", rate: -25 }, en: { texto: "What a goal!", rate: -25 } },
    { clave: "tardio", condicion: "tardio", prioridad: 2, es: { texto: "¡Gooool sobre el final!", rate: -30 }, en: { texto: "A late, late goooal!", rate: -25 } },
    { clave: "empate", condicion: "empate", prioridad: 3, es: { texto: "¡Gooool del empate!", rate: -30 }, en: { texto: "Goooal, they're level!", rate: -25 } },
    { clave: "otro", condicion: "otro", prioridad: 4, es: { texto: "¡Y otro gooool!", rate: -30 }, en: { texto: "Another goooal!", rate: -30 } },
  ],
  /** «Golazo» es valorativo: solo lo habilita un remate cuyo origen dista de la línea de meta, en
   * profundidad (|hasta.x − desde.x|), al menos el largo del área: «desde fuera del área». 2 de 9
   * goles de los fixtures (16,6 y 18,3 m). No mide ángulo ni dificultad. */
  golazoDesdeM: ARENA.areaLargoM,
  /** «Remate y gol»: el gol comparte origen con un `tiro` del goleador y ningún evento de estos
   * tipos cae entre ambos (9 de 9 goles de los fixtures lo cumplen; un centro o pase que cruza la
   * línea, no). */
  gritoRemate: { tiposQueRompen: ["pase", "recepcion", "intercepcion", "recuperacion", "atajada", "tiro", "tiro_fuera", "fuera_juego", "reinicio"] },
  /** Semilla derivada del orden de rotación de los gritos sin prioridad (por partido). */
  semillaGritos: "canto-gol-054:grito",
```

`plantillas.grito` **desaparece** (lo sustituye `gritos`). Ninguna prueba repite textos, `rate`,
umbrales ni la lista de tipos a mano: los lee de `CANTO_GOL`.

## 4. Fuera de alcance

- Gritos por audiencia, por club favorito o por voz distinta; segunda voz en el canto; público.
- Variantes del tramo `hechos` o del autogol; cambios en situaciones, «sobre el final» o `goleadaDesde`.
- Juicios no medibles («golazo» por ángulo, «gol cantado», «error del portero»).
- Más de diez gritos por idioma, o gritos con dos oraciones (cada frontera cuesta ≈ 1 s, 050 § 2.3).
- Cambios en el motor, `RegistroArena`, `hechosArena`, V1–V8, la Mesa, la crónica principal, la
  celebración visual o los selectores.

## 5. Pruebas exigidas

Cada mutación se ejecuta y se anota en la bitácora con la prueba que pone en rojo.

**`src/arena/__tests__/grito-gol.test.ts` (nuevo).**
- Catálogo: diez entradas, claves únicas, ES y EN con texto no vacío y `rate` entero en [−30, −10];
  exactamente cinco sin `condicion`; toda entrada con `prioridad` tiene `condicion` y las prioridades
  son únicas; ningún texto contiene «yyy», «lll», ni una palabra en mayúsculas sostenidas (lista de
  grafías rechazadas en la prueba); textos ≤ 23 caracteres.
- `remate`: verdadero en los 9 goles de los fixtures v1–v4, duelo y `arena-llm-v3`; falso para un
  gol sintético sin `tiro`; falso si el `tiro` del goleador tiene otro `desde`; falso si entre el
  `tiro` y el gol hay un `pase` (o cualquier tipo de `tiposQueRompen`); verdadero si entre medias
  solo hay `plan_equipo`.
- `golazo`: verdadero en v1 `a23` y duelo `a14`, falso en v3 `a10`; umbral exacto con
  `desde.x = hasta.x ± golazoDesdeM` (sí) y `± (golazoDesdeM − 0,1)` (no), en los dos lados; falso
  sin `remate` aunque la distancia cumpla.
- `tardio`, `empate`, `otro`: los mismos marcadores de la tabla del 050; `otro` verdadero en
  `ampliacion` y `goleada`, falso en `apertura`, `ventaja`, `empate` y `recorte`.
- Prioridad: gol que cumple `golazo`, `tardio` y `empate` → `golazo`; el siguiente con `tardio` y
  `empate` → `tardio`; el siguiente con `empate` → `empate`.
- Rotación: registro sintético sin remates (gate `remate` falso) con tantos goles alternos
  (`apertura`, `empate`, `ventaja`, `empate`, …) como haga falta: ningún grito se repite hasta agotar
  los elegibles, `empate` sale en el primer gol que empata y no en el segundo (ya usado, va a la
  rotación), y tras agotar el catálogo la secuencia vuelve a empezar sin repetir dentro de la vuelta.
- Determinismo: dos llamadas sobre el mismo registro dan el mismo mapa; en los 20 fixtures
  sintéticos de semillas 5000–5019 (goles sintéticos idénticos), al menos dos órdenes distintos de
  las claves generales (M19).
- Modos: para cada gol de los fixtures, `vivo`, `completo` y `buffer` (con y sin memoria) producen
  el mismo `grito` en el tramo 0; las cuatro variantes del goleador comparten el grito.
- Autogol: sigue sin tramo `grito` y no consume grito (el siguiente gol normal recibe el primero
  del orden).
- Presupuesto: todas las combinaciones (10 gritos × 4 variantes × situaciones × tardío × ES/EN) con
  los nombres más largos → `texto.length ≤ maxCaracteres`; invariante de 050 sobre `duracionMaxS`.

**`voz-expresiva.test.ts` (ampliar).**
- Para cada grito, idioma y voz del narrador: un `<s>`, tres `express-as` (o `prosody`), el primero
  con `rate` igual al del grito, `pitch`/`volume`/`styledegree` de `CANTO_GOL.tramos.grito`, estilo
  de `CANTO_GOL.estilos`, `break` final de `pausaFinalMs`, sin `<break>` intermedio.
- Tramo `grito` sin `grito` (clave), con clave inexistente, o con texto distinto del catálogo en ese
  idioma → lanza. `claveAudio` cambia al cambiar el grito con el mismo goleador.

**`canto-gol.test.ts` (ajustar).** Donde leía `plantillas.grito`, lee `gritos`; la prueba de
«texto === tramos unidos» recorre el mapa completo de gritos del fixture.

**E2e.** Ninguno nuevo. `e2e/arena-buffer.spec.ts` y `e2e/arena-canto-gol.spec.ts` no contienen
textos literales del grito (verificado el 22 oct); si una aserción comparase «¡Gooool!» se cambia a
leer el texto de la respuesta de `/relato`. Selectores intactos.

**Mutaciones (cada una pone al menos una prueba en rojo).**

| # | Mutación | Prueba |
| --- | --- | --- |
| M13 | `usados` ignorado (siempre el primer elegible) | rotación sin repetición |
| M14 | `remate` sin comparar `desde` | gol con `tiro` de otro origen |
| M15 | `tiposQueRompen` vacío | `pase` entre `tiro` y gol |
| M16 | umbral de golazo escrito a mano (16,5) | sobreescritura en runtime de `CANTO_GOL.golazoDesdeM` (como M4 del 050) |
| M17 | prioridad no antepuesta a la rotación | gol tardío recibe un general |
| M18 | `parteCanto` usa un `rate` fijo en vez del del grito | SSML por grito |
| M19 | orden sin semilla (identidad) | 20 semillas, ≥ 2 órdenes |
| M20 | texto del tramo distinto del catálogo aceptado | lanza |
| M21 | autogol consume grito | siguiente gol normal |
| M22 | `otro` verdadero en `apertura` | tabla de condiciones |

**Cierre.** `npm test`, `npm run typecheck`, `npm run e2e` de arena en verde; publicación y smoke
público con un partido de **al menos dos goles** oído en ES y EN: gritos distintos, clips guardados
y duración medida en `docs/evidencia/canto-gol-054/`; bitácora con las mutaciones anotadas.

## 6. Orden sugerido para medio día

1. `CANTO_GOL.gritos`, `golazoDesdeM`, `gritoRemate`, `semillaGritos`; quitar `plantillas.grito` y
   `tramos.grito.rate`; condiciones y `gritosPartido` en `relato.ts`; `cantoGol` con `grito` en el
   tramo; pruebas de condiciones, prioridad y rotación (1 h 30).
2. `TramoCanto.grito`, `parteCanto` con validación y `rate` por grito; pruebas de SSML (30 min).
3. Ajustes de `canto-gol.test.ts`, presupuesto con diez gritos, modos y determinismo (1 h).
4. Typecheck, e2e de arena, publicación, smoke con dos goles, bitácora (1 h).

## 7. Límites honestos y riesgos

- **La emoción no está medida ni oída.** Las grafías estiradas se admiten por duración y sonoridad;
  nadie ha oído aún «¡Goooooooool!» ni «Aaaand goooal!». Carlos debe escuchar primero `es-04`,
  `es-02`, `es-08`, `es-12`, `es-11` (rechazado: confirmar el deletreo), `en-02`, `en-04`, `en-09`,
  `en-15`, `en-08` y, en contexto, `es-30`, `en-30`, `es-31`, `en-31`. Si una grafía suena mal, se
  sustituye por su reserva (§ 3.1) sin tocar la regla.
- **Diez gritos para 1–3 goles por partido.** Dentro de un partido nada se repite; la variedad entre
  partidos la da el orden por semilla. Un mismo partido repetido suena igual, a propósito.
- **`remate` es casi siempre verdadero** (9 de 9 goles de los fixtures): «¡Remate y gooool!» es en la
  práctica un sexto grito general, con una puerta que solo se cierra para goles de centro o pase. Se
  acepta: la puerta existe y es verificable.
- **«Golazo» no mide belleza.** Solo profundidad del origen ≥ 16,5 m con remate del goleador; un
  remate desde la esquina del área no cuenta. Es una etiqueta por definición, como «goleada».
- **Redundancia aceptada.** «¡Gooool del empate!» y «Goooal, they're level!» se solapan con el tramo
  de hechos («empata» / «level it»); igual «sobre el final» / «Late on». Es la forma de que el grito
  tenga contenido verificable.
- **Deletreo residual.** La detección por duración no garantiza que ninguna grafía se pronuncie
  raro: «¡Guuuoooolll!» no dio anomalía y se excluyó por principio; «¡Goooooooool!» tampoco la dio
  y entra. La escucha decide.
- **Un gol no cantado consume su grito** (dos goles en el mismo tramo de cinco segundos, límite del
  050): el oyente puede perder un grito del catálogo sin oírlo. Es rarísimo y preferible a una
  secuencia que dependa de lo que se oyó.
- **Coste:** +0 a +15 caracteres de SSML por gol e idioma; sin solicitudes nuevas. La deuda de
  presupuesto a 180 s en ES+EN (048) no cambia.

## Versión 1.1 (22 de octubre, coordinador): aclaraciones antes de implementar

El implementador detectó que la regla de `remate` de §3.2, formulada por intervalo de ticks
`(t.tick, gol.tick]`, contradice las pruebas de §5: el motor registra el `reinicio` del saque de centro en el
mismo tick que el gol, detrás de él en `registro.eventos`, y con la regla literal solo 3 de 9 goles de los
fixtures serían `remate` (y ningún `golazo`). Decisiones, que prevalecen sobre §3.2 y §3.7:

1. **Regla por posición (como en §1).** Un gol es `remate` si el `tiro` del goleador con el mismo `desde` es el
   evento anterior más cercano de ese jugador y, **entre el índice del `tiro` y el índice del gol en
   `registro.eventos`**, no hay ningún evento de `tiposQueRompen`. Los eventos posteriores al gol en el registro
   (su `reinicio`, cambios del mismo tick) nunca cuentan. Con esta regla los 9 goles de los fixtures son
   `remate` y `a23` (v1) y `a14` (duelo) son `golazo`, como exigen las pruebas. La mutación M15 inserta un
   `pase` entre ambos índices.
2. **E2e.** `e2e/arena-canto-gol.spec.ts` y `e2e/arena-buffer.spec.ts` dejan de leer
   `CANTO_GOL.plantillas.grito` y comparan con el texto que devuelve `/relato` (el primer tramo del canto).
3. **Script de evidencia.** `docs/evidencia/canto-gol-054/experimento.mts` fija su velocidad de control en −30
   como literal del experimento (es evidencia histórica, no normativa) para seguir siendo reproducible.
4. **Firma.** Se mantiene `gritosPartido(registro, idioma)` como en el brief; la selección no depende del idioma.
