# 012 — Cierre de la auditoría consolidada (008–011)

**Fecha:** 2026-10-01 · **Diseña:** Fable (hallazgos del auditor-adversario,
ninguno refutado) · **Implementa:** Opus · **Estado:** cerrado

## Contexto

La ronda consolidada sobre c37def8..8c0c0ac confirmó lo estructural (ninguna
update ve eventos del futuro; proyección legado bien vigilada; caché del vivo
re-verifica; `figura` y su hecho coinciden 1000/1000) y encontró huecos de
léxico en vivo, un falso positivo caro, deuda de suite y pizarras incoherentes.
Riesgo priorizado por el auditor: el lenguaje natural del relato en vivo
(«sentenció», «sealed it») es lo primero que escribiría un LLM real el 6 oct.

Decisiones sin cambio de código (documentadas aquí): figura con nota baja
(mín. 6.4) y figura sin gol habiendo goleadores son fútbol de partido
tranquilo — el desglose clicable las defiende; el desempate usa la nota
redondeada (la que se muestra) y luego goles — un empate visible resuelto por
goles es criterio de prensa, no mentira.

## A · Reglas y léxico del vivo (riesgo medio del auditor)

1. **Regla de CIERRE para momentos no finales** (solo updates, como la de
   balance): en todo momento ≠ `final` se rechaza vocabulario de partido
   terminado o decidido, en AMBOS idiomas por separado: «resultado final»,
   «full time», «terminó / el partido terminó / ended / the match ended»,
   «cerró el marcador / completed the scoring», «sentenció / sealed the win /
   sealed it», «encaminó la victoria / on course for victory», «definitivo /
   would prove decisive / decisive», «gol del triunfo». Léxico `CIERRE_EN_VIVO`
   en `lexico.ts`. En el momento `final` NO aplica.
2. **Ampliar `BALANCE_POSTERIOR`:** «luego», «a continuación», «más tarde»,
   «en lo que quedaba / lo que restaba», «subsequently», «from there», «for
   the remainder», «afterwards» ya está — revisar simetría completa ES/EN y
   que la regla corra sobre los DOS textos (el auditor probó que apagar el
   inglés no rompe nada hoy: P08).
3. **Ampliar `FUTURO`:** condicional español («-ría» como sufijo verbal con
   lista de verbos del dominio: terminaría, sería, acabaría, quedaría…),
   «would», perífrasis «va a + infinitivo», «looks set to», «on course to».
4. **Batería nueva:** TODAS las frases exactas del informe del auditor (A1 y
   A2, semillas 1, 2 y 7, ES y EN) entran como mentiras que se rechazan con su
   regla, más 2 verdades de control por regla (p. ej. «sentenció» SÍ pasa en
   el momento final).

## B · Léxico V8 de figura (A3)

- Ampliar la entrada de figura: «el mejor de la cancha / del partido», «el
  mejor hombre», «el hombre más destacado», «la estrella del partido», «best
  player on the pitch», «star man», «man of the hour». ES y EN se verifican
  POR SEPARADO (el auditor mostró que hoy el español se salva solo por su par
  inglés).
- Batería: las frases exactas de A3 (semilla 246, portero y Doraena como
  principales) rechazadas; «figura» con el hecho correcto sigue pasando.

## C · Falso positivo del empate (clase B, costo real)

«Empató / equalised / drew level» con un gol como hecho principal se vuelve
**computable**: se acepta si y solo si el marcador tras ese gol (en los
`datos` del hecho) queda igualado. Prueba con la semilla 7 (`gol-e046`,
1–1): la frase del empate pasa en crónica y en vivo; la misma frase con un
gol que NO empata se rechaza.

## D · «Gol definitivo» (A4)

«Definitivo / settled the match / to settle it» entra al léxico de la regla
computable del gol decisivo: solo se acepta si ese gol es el ÚLTIMO del
partido Y deja al equipo ganador por delante (la combinación ya computable).
En vivo lo cubre la regla A1 (nunca antes del final).

## E · Deuda de suite (P05–P08, P10, P12)

Una prueba por mutación superviviente, cada una con la técnica que ya usamos
contra «pruebas contra constantes»:

- P05: semilla 7, momento `gol-e046` — el hecho `remontada` del prefijo NO
  llega al Cronista (aserto directo sobre `contextoDelMomento`).
- P06/P07: mentiras que SOLO el léxico atrapa (sin cifras inventadas que
  disparen V3), una por idioma y por léxico.
- P08: mentira de balance SOLO en el texto inglés (español limpio) ⇒
  rechazada.
- P10: `hechoEnVivo` también recorta la evidencia posterior a la roja
  (defensa en profundidad) + aserto de que la expulsión en vivo no cita ningún
  evento con id posterior al de la roja.
- P12: prueba de distribución con COPIA INDEPENDIENTE de las bandas tal como
  las fija este brief (ver F) — si el generador y el invariante se mueven
  juntos, esta prueba se pone roja.

## F · Coherencia espacial y pizarra (visible para un juez)

1. **Matriz completa de bandas xG por zona** en `limites.ts` (hoy solo
   área chica y media distancia): área chica [0.15, 1.0]; punto penal =
   [XG_PENAL exacto]; frontal **[0.01, 0.50)**; bandas [0.01, 0.30); media
   distancia [0.01, 0.15). El generador sortea respetándolas y el invariante
   las exige en el corpus; la prueba P12 lleva su copia literal.
   *(Rev 1.1: el frontal arrancaba en 0.03 y eso contradecía F4 — 645 tiros
   tras córner con xG 0.01–0.02 no tenían zona de área posible. Decisión de
   Fable: piso del frontal a 0.01, SIN exenciones del invariante — un tiro
   raso desde el frontal tras el despeje de un córner es fútbol normal. La
   copia literal de P12 se actualiza en el mismo cambio, conscientemente.)*
2. **El penal nunca es «tras córner»:** un tiro con `penal` no hereda origen
   de córner y su pizarra es: falta (texto) → punto penal → arco. Muere la
   secuencia banderín → punto penal (4 goles del corpus).
3. **Origen de la jugada = el evento atacante relacionado INMEDIATO:** si hay
   `pase_clave` entre el córner y el tiro, la pizarra dibuja el pase (el
   córner queda en los pasos de texto). Máximo 3 pasos se mantiene. Muere
   banderín → media distancia (19 goles).
4. **UNA definición de «tras córner»**, compartida por generador y pizarra
   (función única exportada, p. ej. en `espacial.ts`): el tiro del MISMO
   equipo inmediatamente posterior al córner como siguiente evento de ataque Y
   con Δ ≤ 1 minuto. La pizarra y el generador no pueden divergir (los 76
   tiros «de córner» a 3+ minutos dejan de serlo; los campos espaciales SÍ
   pueden cambiar — la proyección legado NO: la prueba del fixture sigue
   intacta, el fixture no se regenera).

## Restricciones

- Los campos espaciales pueden cambiar de valores (no son legado); el fixture
  `hashes-legado.json` NO se toca y su prueba pasa.
- Léxicos solo en `lexico.ts`; bandas solo en `limites.ts`; cero umbrales en
  pruebas salvo las copias independientes marcadas (P12 y la tabla del
  portero, que ya existe).
- Las reglas nuevas del vivo no tocan la crónica completa salvo C y D (que
  son computables y la mejoran).
- `juez.spec.ts` intacto; e2e verdes.

## Aceptación

Suites + stats + e2e vistos por Fable; la batería del auditor entera en
rojo→verde (sus frases rechazadas, sus verdades aceptadas); re-conteo de
pizarra en el corpus: 0 banderín→punto penal, 0 banderín→media distancia,
0 goles fuera de banda xG de su zona; mutaciones P05–P08, P10 y P12 ahora
mueren (mostrarlo), y las K/M/N siguen muriendo donde se re-corran.
