# 067 — Entrega final: video nuevo y materiales al día

## Estado

Brief **cerrado v1.0**, martes 27 de octubre de 2026, 01:45 UTC. Lo diseña Opus 5.5 (coordinador). Pedido de
Carlos:

> «Revisa de nuevo los entregables para el hackathon, basate en la documentacion de la hackahton,
> docs/hackathon.md y prepara todo lo necesario, crea un nuevo video que muestre todos los features segun lo
> requerido por el hackathon»

**Fechas duras (OFFICIAL RULES):**
- la entrega cierra el **27 oct a las 23:59 PT** (28 oct, 06:59 UTC);
- el juzgamiento empieza el **27 oct a las 09:00 PT** (16:00 UTC).

## 1. Revisión de entregables contra las reglas (§ 4.4, § 4.8, § 4.9)

| Requisito oficial | Estado al 27 oct, 01:40 UTC | Acción |
|---|---|---|
| Pitch corto: qué es, tecnologías Microsoft/Azure, qué hace, qué problema resuelve | `docs/entrega/pitch.md`, congelado el 22 oct con cifras de entonces | Bloque B: actualizar las cifras |
| Video < 2 min, que muestre el proyecto funcionando y sin marcas ni música ajenas | Corte del 25 oct (1:45, rev. 0000034). No muestra 063–066, la personalización, las cifras, el analista Foundry ni el dataset | **Bloque A: video nuevo** |
| URL pública del video en YouTube, Vimeo, Facebook Video o Youku | `VIDEO_URL` sigue como marcador en el README | Carlos lo sube; después se sustituye el marcador |
| URL de un repositorio de GitHub **público** | `calusaca/cronista` es **PRIVATE** | Carlos decide; es imprescindible |
| Acceso gratuito a la demo hasta el 10 nov | La arena y la crónica están en Container Apps con `minReplicas` 1 | Mantener; nada de despliegues durante el juzgamiento sin necesidad |
| Materiales en inglés | README, guía y pitch están en EN, pero desactualizados | Bloque B |
| Campos de «Projects» completos y comprobante guardado | Pendiente | Carlos |

**Hallazgo: CI en rojo desde `d39f754`.** Los trabajos no llegan a arrancar: *«recent account payments have failed
or your spending limit needs to be increased»*. Es facturación de Actions en un repositorio privado, no fallo del
código. Al hacerlo público, Actions estándar es gratis y se relanza el CI del commit final.

## 2. Bloque A — video nuevo (implementador del video)

**Salida:**
- `docs/entrega/cronista-demo-final.mp4` y `docs/entrega/cronista-demo-final.en.srt`, que reemplazan el corte del
  25 oct (el anterior queda en el historial de git);
- informe de montaje en `docs/evidencia/video-067/`, con capturas de los fotogramas y un JSON de escenas y sesión.

**Herramienta:**
- se extiende `scripts/grabar-video-final.mjs` con fases nuevas; no se crea un script paralelo;
- los intermedios van en `.cache/video-final/`, con una toma nueva y sin pisar `toma4`.

**Reglas del corte:**
- todas las del corte anterior (`docs/entrega/guion-video.md`, «What the video must not do») siguen vigentes;
- más de **1:50,0 y menos de 1:58,0**;
- 1440×900, tema oscuro, inglés, subtítulos EN incrustados;
- voz en off `en-US-AndrewNeural`, sin música.

### 2.1 Escenas (orden, contenido y por qué)

Cada escena dice qué requisito sirve: § 4.1 (i) a–e, § 4.1 (ii)–(vi) y los criterios de «Best Multi-Agent
System».

| # | Escena (duración aprox.) | En pantalla | Sirve a |
|---|---|---|---|
| 1 | Gancho (6 s) | Primer fotograma de `/arena`: barra única, escudos y equipaciones propios, árbitro | Presentación |
| 2 | Agentes (10 s) | «Choose models»: GPT-6 Astra (local) y GPT-6.1 Sol (visita). Partido de **120 s** (valor por defecto, reglas v9) y «Start live match». La voz en off nombra los roles: dos entrenadores LLM, motor compartido y mesa de tres voces | Multiagente: roles distintos |
| 3 | Antesala (8 s) | Tarjeta de alineaciones con audio real y una sola pieza (bienvenida y local). Recortada y rotulada | (iii) narrativa |
| 4 | Ingesta y estado compartido (9 s) | Marcador con «Coaches are deciding · simulation clock paused» y luego «Live · N s ready». Se abre «Team plans and player orders»: el plan JSON validado y el motivo | (a) ingesta; multiagente: estado compartido y traspasos |
| 5 | Gol (10 s) | Balón en la red, rótulo GOAL, vista del gol y el **canto real** de esa sesión | (d) render; (iii) |
| 6 | Mesa y verificación (12 s) | El último intercambio de la mesa con audio real, si sigue al gol en la misma toma; si no, solo la tarjeta. «Inspect facts and checks»: hecho citado, eventos y V1–V8, con el intento rechazado si lo hay | (c) explicar; (iv); multiagente: recuperación |
| 7 | Cifras en vivo (8 s) | Panel de cifras (049) y ficha del jugador al pulsar un dorsal: distancia, **velocidad máxima en km/h** y pases, con su evidencia | (b) interpretar; (ii) identificación del jugador y métricas de velocidad y pase |
| 8 | Personalización (12 s) | Estrella de **club favorito** y de **jugador favorito**; «Only my player (and goals)»; «Understand this moment» en Fan, Analyst y Follow selected player; **ES** cambia texto y voz (2–3 s de audio ES real); vuelta a EN | (e) personalizar; (vi) multilingüe |
| 9 | Analista Foundry (8 s) | «Ask about this match», respuesta con eventos citados e «Inspect tools and evidence» | Tecnología Microsoft; agente con herramientas |
| 10 | Torneo (7 s) | `/arena/torneo/2026-10-24`, la liga ya jugada. **No se lanza ningún torneo** | Multiagente a escala; honestidad |
| 11 | Crónica verificada (8 s) | Clic en una frase, sus eventos resaltados y «View process» (borradores y veredictos). Se prefiere la página donde el redactor es **GPT-6.1 Sol**; el rótulo dice el redactor que muestra la página | (iii) crónicas automáticas; (iv) |
| 12 | Datos (5 s) | `/datos`: dataset sintético, DATASHEET y descarga; un vistazo a `/api/overlay/246` (JSON para overlay) | (v) innovación de datos; (d) render como overlay |
| 13 | Cierre (10 s) | Tarjetas propias: arquitectura (seis modelos y mesa), servicios Azure y calidad, con las cifras de § 2.3; fotograma final de la arena | Implementación; impacto |

**Orden de recorte si no cabe:**
1. la pieza del overlay en la 12;
2. el audio ES de la 8 (queda el cambio visual);
3. la mesa de la 6 (queda la inspección);
4. el torneo.

Las escenas 2, 4, 5, 7 y 8 no se recortan.

### 2.2 Toma

- Un partido en directo real en la arena pública:
  - **manual**, GPT-6 Astra contra GPT-6.1 Sol, 120 s, narración por defecto;
  - **máximo 3 tomas con modelos.**
- Si el gol no llega en una toma, se repite. Si tras tres no hay gol, se usa el mejor intento con un gol del
  partido, o se para y se informa.
- Las escenas 7–9 se graban **en la misma sesión**, durante el partido o tras el final; no hace falta otro partido.
- Las crónicas, el torneo y los datos se graban por separado (`--fases`).
- Los cupos temporales de la arena siguen puestos (100 partidos con modelos y 2.000.000 caracteres de Speech al día).
- **Prohibido:**
  - lanzar torneos;
  - desplegar;
  - cambiar código de la app.

  Si un defecto de la app impide una escena, se para y se informa con la reproducción.

### 2.3 Cifras del cierre

Leer de lo que se ve correr en HEAD, nunca de documentos viejos:
- `npm test`: el número de pruebas aprobadas y de archivos;
- e2e: el número de pruebas de `npx playwright test --list`, rotulado «Playwright journeys»;
- stats: 75, vistas el 26 oct en el brief 065.

La tarjeta **no cita un run de CI**, porque el CI no corre por facturación (§ 1). Dice «run locally on `<sha>`».
Seis modelos en el catálogo público. Reglas `reinicios-v9`.

### 2.4 Verificación

- La fase `verificar` debe pasar: duración, flujos y fotogramas por escena.
- Revisar a ojo un fotograma por escena.
- Comprobar que cada subtítulo de la mesa coincide con el audio que suena (por huella, como en el corte anterior).
- Actualizar en `docs/entrega/guion-video.md`:
  - las escenas nuevas;
  - la sección «Final cut as rendered» con sesión, horas, decisiones, respaldos y goles;
  - las desviaciones.
- Gitleaks antes de commitear.
- **Commit con rutas explícitas:** script, `guion-video.md`, mp4, srt y `docs/evidencia/video-067/`. Nada de
  `git add -A`: hay archivos sin commit que no son nuestros (bloque B4 del 064, `CLAUDE.md`, `BITACORA.md` y
  `HANDOFF.md`).
- **Push a main** y no desplegar.
- No tocar `BITACORA.md` ni `HANDOFF.md`: el coordinador los actualiza con el informe.

## 3. Bloque B — materiales EN al día (agente de documentación)

**Archivos:**
- `README.md`;
- `docs/entrega/pitch.md`;
- `docs/entrega/judges-guide.md`;
- la matriz de `docs/hackathon.md`.

**Qué cambia:**
- solo hechos desactualizados: catálogo de seis modelos, reglas v9, 120 s por defecto, decisiones cada 30 s,
  bolsas de voz 40 / 24.000, cifras de pruebas medidas en HEAD, revisión publicada `cronista-arena--0000049` y
  novedades 063–066 donde corresponda;
- el CI: decir la verdad sin citar un run verde inexistente;
- `VIDEO_URL` sigue como marcador;
- cada cifra enlaza evidencia existente.

**Qué no se hace:**
- no se toca el bloque A;
- no se toca la app.

**Commit:** con rutas explícitas, gitleaks y push.

## 4. Lo que decide y hace Carlos

1. Hacer público el repositorio: lo exige § 4.4, y además arregla el CI.
2. Subir el video a YouTube (público o no listado) y pasar la URL.
3. Decidir los cupos temporales para el juzgamiento.
4. Completar los campos de «Projects» con el pitch, el repositorio, el video y la demo, y guardar el comprobante
   antes del **27 oct a las 23:59 PT**.
