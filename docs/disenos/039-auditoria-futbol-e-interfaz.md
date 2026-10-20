# Auditoría de fútbol y recorrido de visualización

Fecha: 19 de octubre de 2026. Análisis del motor, cuatro registros archivados y pruebas controladas sin nuevas llamadas de inferencia. La auditoría de reglas y remates identifica trabajo pendiente; el cambio implementado abarca diversidad de formaciones y experiencia de visualización.

## Árbitro y reglas

**El motor no implementa todas las reglas del fútbol.** El árbitro que se desplaza en `src/arena/arbitro.ts` representa visualmente al oficial. Las sanciones efectivas se resuelven en `src/arena/motor.ts`; su presencia en pantalla no demuestra cumplimiento reglamentario.

| Reglas IFAB | Estado observado en el motor |
| --- | --- |
| 1–2: campo y balón | Campo de 105 × 68 m, balón puntual en 2D; faltan volumen y altura. |
| 3: jugadores | Once por equipo, banco, cambios simplificados, expulsiones y finalización con menos de siete; no cubre todos los procedimientos de sustitución. |
| 4: equipamiento | No modelado reglamentariamente. |
| 5–6: oficiales | Árbitro visual y sanciones por contacto; sin equipo arbitral completo, VAR ni cobertura de todas sus atribuciones. |
| 7: duración | Encuentros cortos, sin dos tiempos reglamentarios ni descuento completo. |
| 8–10: inicio, balón en juego y resultado | Marcador y cruces simplificados; reinicios recolocan el balón al portero. No se cubren todos los reinicios ni balón a tierra. |
| 11: fuera de juego | Comprobación simplificada ligada al pase y la recepción. No cubre interferencia sin tocar el balón ni todas las excepciones. |
| 12: faltas y conducta | Contactos sintéticos probabilísticos, amarilla, roja y segunda amarilla. Faltan mano, ventaja, DOGSO y otras infracciones. No se aplica la regla del portero de ocho segundos. |
| 13–17: reinicios | Sin ejecución reglamentaria de tiros libres, penales, bandas, saques de meta y córneres. |

Las reglas vigentes consultadas son [IFAB: árbitro](https://theifab.com/laws/latest/the-referee/), [fuera de juego](https://theifab.com/laws/latest/offside/) y [faltas y conducta](https://theifab.com/laws/latest/fouls-and-misconduct/). La regla actual del portero es ocho segundos y sanción de córner, con cuenta visible de los cinco últimos; no debe implementarse la antigua referencia de seis segundos y libre indirecto.

Para acercarse al fútbol reconocible, conviene introducir primero estados explícitos de interrupción y reinicio: gol → centro, salida lateral → banda, línea de fondo → saque de meta o córner, falta → libre o penal según lugar. Después completar fuera de juego y criterios disciplinarios. Cambiar esto exige versionar el motor para conservar las grabaciones existentes.

## Cómo intentan marcar y por qué los remates se parecen

La política programada busca pases con progreso, espacio y apoyos. Cuando no encuentra uno adecuado conduce hacia adelante, normalmente manteniendo su coordenada lateral. Considera rematar dentro de unos 25 m; si existe pase, reduce ese radio según la capacidad de remate. Las órdenes explícitas del controlador pueden condicionar la acción.

**Defecto confirmado:** `accionBalon` en `motor.ts` usa el centro del arco como destino de todos los tiros. Incluso una orden explícita que pide un costado pierde su destino al ejecutarse. Después `sacarBalon` añade error lateral según nivel efectivo, clima y presión. Ese error produce dispersión, pero no equivale a elegir dónde está el espacio libre. Tampoco hay una evaluación robusta del ángulo, el portero o el corredor de tiro.

Prueba contrafactual reproducible: con las mismas condiciones, órdenes a `(105,31)` y `(105,37)` terminan ambas en `(105,31.315440580295398)`. Ver `pruebaDireccionIgnorada` en la evidencia. El problema no se resuelve solo cambiando el prompt del modelo.

En los 50 partidos programados anteriores al cambio hubo 217 remates, 157 goles y cinco encuentros sin remates; 94 objetivos quedaron a menos de un metro del centro. La conversión de esta muestra sintética tampoco está calibrada como fútbol real. Los cuatro archivos de decisiones reales de IA tienen respectivamente 1, 0, 5 y 1 tiros: no permiten sostener que todos los encuentros tengan suficientes ocasiones.

La siguiente corrección debe elegir y respetar objetivos dentro de la portería según posición del portero, ángulo, bloqueos y precisión; revisar cuándo tirar frente a pasar, y calibrar portero y conversión. Los [ejercicios de finalización de FIFA](https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/creating-chances-and-finishing.php) dan una referencia práctica sobre ángulos y colocación. **Los remates y el arbitraje no se cambiaron en esta entrega.**

## Formaciones: siete antes, doce ahora

Se añadieron `4-3-1-2`, `4-2-2-2`, `3-4-2-1`, `5-3-2` y `5-4-1`, cada una con geometrías de base, ataque y defensa. Se conservaron las siete anteriores y su orden. El catálogo completo es:

`4-3-3`, `4-2-3-1`, `4-4-2`, `4-1-4-1`, `4-1-2-1-2`, `3-5-2`, `3-4-3`, `4-3-1-2`, `4-2-2-2`, `3-4-2-1`, `5-3-2`, `5-4-1`.

Además del número, había un sesgo de selección: muchos entrenadores compartían el primer esquema de su escuela. Ahora sus preferencias tienen un orden reproducible independiente, manteniendo el criterio de compatibilidad de la plantilla. No se obliga a que los rivales sean distintos.

| Muestra idéntica: semillas 1–1000, dos equipos por configuración | Antes | Después |
| --- | ---: | ---: |
| Formaciones en catálogo | 7 | 12 |
| Formaciones elegidas al menos una vez | 5 | 12 |
| Partidos con la misma formación inicial en ambos equipos | 335/1000 (33,5 %) | 94/1000 (9,4 %) |
| Mayor frecuencia de una formación | 844/2000 (42,2 %) | 246/2000 (12,3 %) |

En particular, `3-5-2` y `4-1-2-1-2` nunca aparecieron inicialmente en la muestra anterior. Las doce aparecen después. Los cuatro archivos históricos siguen reproduciéndose exactamente. La muestra posterior de 50 partidos tiene 179 tiros y 118 goles; esto mide un cambio de geometría y **no prueba una mejora del remate**.

## Por qué se parecen los equipos de la imagen

Los nombres coinciden con la configuración generada con semilla 42: Sporting Montefrío Bajo y Olímpico Brezal, dirigidos por Elio Ulvino y Leo Quinera. Ambos salen con escuela adaptable, pero no tienen atributos iguales:

| Rasgo estable | Elio | Leo |
| --- | ---: | ---: |
| Ofensiva | 66 | 73 |
| Defensiva | 75 | 74 |
| Presión | 54 | 67 |
| Verticalidad | 59 | 55 |
| Amplitud | 51 | 66 |
| Riesgo | 47 | 63 |
| Adaptabilidad | 81 | 99 |
| Paciencia | 56 | 68 |
| Rotación | 65 | 74 |
| Serenidad | 92 | 79 |

La interfaz mostraba principalmente el estado circunstancial y escondía estos rasgos en «Coach traits». Confianza arranca en 60 para ambos; frustración y urgencia arrancan en cero. La urgencia depende del marcador y el tiempo: empatados a mitad de un encuentro de 60 segundos, ambos pueden tener 25. La confianza usa pocos indicadores compartidos, así que puede coincidir. La frustración también depende de la serenidad y presión de cada equipo. Las emociones se actualizan en revisiones del entrenador; los conteos de «últimos 30 s» se recalculan en el instante mostrado.

En las 1000 configuraciones, 844 de 2000 técnicos (42,2 %) son adaptables y 281 parejas (28,1 %) comparten perfil. «Adaptable» participa en todas las listas de candidatos: dos opciones para equipos de posesión y tres para los demás. Su mayor frecuencia está incorporada en el sorteo; no se espera un reparto uniforme de las cinco escuelas. Esta revisión diversifica formaciones sin modificar ese reparto de personalidades.

La semilla 42 genera además el mismo entorno para ambos, incluido calor fuerte; el ajuste programado por calor favorece un ritmo medido. La escuela adaptable tenía el mismo orden de formaciones preferidas. Esto explica la similitud sin afirmar que sean agentes duplicados. No contamos con el registro exacto de la captura para atribuir cada decisión al instante fotografiado.

La nueva selección inicial de semilla 42 resulta en local `4-3-3` y visitante `3-4-3`. Los nombres y rasgos no cambian. La interfaz deja la semilla vacía por defecto para sortear nuevas condiciones en cada creación; conservar 42 en avanzado sigue permitiendo reproducir el escenario inicial.

## Recorrido de interfaz implementado

- Dos entradas: **Live / En vivo** (predeterminada) y **Saved matches / Partidos guardados**. La emisión en vivo usa internamente la reserva de 20 s; no ofrece un tercer modo ni usa «near-live» como nombre del producto.
- Configuración inicial: formación de local y visita, duración, entorno opcional. La elección automática se explica como decisión del entrenador. La semilla es opcional y está en un apartado avanzado con su efecto y límites: repite condiciones iniciales, no garantiza las mismas decisiones del modelo.
- La pestaña de guardados ofrece ejemplos archivados, importación y creación de grabaciones. No se hacen llamadas de inferencia al abrir la página ni al reproducir esos ejemplos.
- Cancha y panel de narración comparten una cuadrícula: audio, minuto a minuto, comentario y evidencia, más la vista para aficionado, analista o jugador. En móvil, el panel sigue inmediatamente a la cancha.
- La narración de texto se actualiza con el cursor visual y funciona con audio apagado. No muestra eventos futuros que ya existen en el búfer de producción. Los comentarios también respetan ese cursor y conservan la inspección de sus hechos y verificaciones.
- Los rasgos de ataque, riesgo y adaptabilidad de cada entrenador se muestran sin desplegar; se aclara que sus emociones reflejan el partido actual. Los planes individuales y órdenes de equipos quedan en un desplegable después del área de visualización.

## Ajuste al hackathon

Revisión de las [reglas oficiales de Microsoft](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md), apartados 4.1–4.9 y 6, el 19 de octubre:

El recorrido exigido es ingerir eventos sintéticos, interpretarlos, explicarlos, mostrarlos junto al partido y personalizarlos. La experiencia de usuario representa el 20 % de la evaluación. Por eso la narración, evidencia y selección de audiencia deben ser visibles cerca de la cancha. La categoría multiagente evalúa roles, coordinación, recuperación y resultado conjunto.

La entrega requiere repositorio GitHub público, demo accesible, pitch, video público de menos de dos minutos y materiales en inglés o traducidos. Inscripción hasta el 20 de octubre a las 12:00 PT; entrega hasta el 27 a las 23:59 PT. La demo debe seguir accesible durante la evaluación, hasta el 10 de noviembre a las 23:59 PT.

La consulta de GitHub del 19 de octubre confirma `calusaca/cronista` privado. Siguen pendientes publicar el repositorio, publicar el video final y acreditar la entrega en el portal. Este trabajo no publica el código ni presenta la candidatura. La visibilidad de esos elementos debe comprobarse antes de entregar. El simulador no sustituye el recorrido de inteligencia explicable y crónicas de la aplicación principal.

## Evidencia y reproducción

- [`antes.json`](../evidencia/auditoria-futbol/antes.json), [`despues.json`](../evidencia/auditoria-futbol/despues.json) y [`auditar.ts`](../evidencia/auditoria-futbol/auditar.ts).
- Auditoría: `node --import tsx docs/evidencia/auditoria-futbol/auditar.ts resultado.json`.
- Las cifras describen una muestra programada controlada y archivos archivados; no son una evaluación de todos los partidos históricos del servidor ni una evaluación nueva de modelos.
- Pruebas de geometría, diversidad y reproducción: `src/arena/__tests__/formaciones-diversidad.test.ts`.
- Navegador: `e2e/arena-formaciones.spec.ts`, junto con las suites existentes de arena y emisión.

Resultado local: 1559 pruebas unitarias, tipado y dos pruebas de empaquetado correctos; 28 escenarios distintos de navegador comprobados. Las correcciones de selectores y esperas de prueba, así como la revisión posterior de la cabecera, se detallan en la [evidencia de interfaz](../evidencia/interfaz-arena/README.md).

Publicación comprobada: [arena](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena), revisión `cronista-arena--0000004`. La [comprobación pública](../evidencia/interfaz-arena/navegador-publico.json) confirma modo inicial Live, doce formaciones, dos estructuras nuevas, texto y controles de audio junto a la cancha, pausa, apertura de grabación y móvil sin desbordamiento ni errores JS. Se usó un partido programado y no se activó voz de pago.
