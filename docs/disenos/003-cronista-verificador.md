# 003 — Cronista y Verificador

**Fecha:** 2026-09-30 · **Diseña:** Fable (con informe de investigador-foundry) ·
**Implementa:** Opus · **Estado:** CERRADO (rev 3.2, 2 rondas de auditoría,
2026-09-30; pendiente solo la corrida real contra Foundry al existir la cuenta)

## Decisiones de stack (según investigación del 2026-09-30)

- **La cadena se orquesta a mano en TypeScript puro** (`src/cadena/`). Es el patrón
  que el propio Azure Architecture Center documenta como sequential + evaluator.
- **LLM: Claude vía Microsoft Foundry** con `@anthropic-ai/foundry-sdk` (^0.5),
  endpoint `https://<recurso>.services.ai.azure.com/anthropic`, `apiVersion
  "2023-06-01"`, auth por API key. Recurso Foundry en **eastus2**. **No enviar
  `temperature` ni `top_k`** (Foundry los rechaza en Claude 5.x);
  `thinking: {type:"adaptive"}`.
- **Modelo: barato por defecto** (decisión de Carlos, 2026-09-30). Deployment de
  desarrollo `claude-sonnet-5` ($2/$10 por MTok; ~$7 todo el hackathon) o
  `claude-haiku-4-5` ($1/$5). El Verificador garantiza la fidelidad factual con
  cualquier tamaño de modelo: entre modelos solo cambia la calidad de la prosa.
  Antes de entregar, **bake-off con 3 semillas** (Haiku vs Sonnet vs Opus, cuesta
  centavos): se elige a ojo y se cambia solo el nombre del deployment — cero código.
  La caché de abajo reduce el costo real todavía más.
- **Opción de costo cero real** (2026-09-30, pregunta de Carlos): el hackathon NO
  reparte créditos de API; lo único gratis es el crédito estándar de Azure ($200 /
  30 días de cuenta nueva). Ese crédito **no paga Claude** (Marketplace → tarjeta)
  pero **sí paga los modelos first-party de Azure OpenAI** desplegados en el mismo
  Foundry — y un modelo OpenAI en Foundry cuenta igualmente como uso de Microsoft
  Foundry ante el jurado. Candidato pagado-con-crédito (verificado 2026-09-30):
  **GPT-6.1 Sol**, GA en Foundry desde el 29 sep, rendimiento cercano al tope de
  OpenAI a 1/5 del precio. El bake-off final es GPT-6.1 Sol ($0 de tarjeta) contra
  Sonnet/Haiku (~$3–7 de tarjeta). Nota: la suscripción de ChatGPT de Carlos trae
  el mismo modelo pero como app de chat, sin API — no sirve para el pipeline. La costura `llm.ts` ya soporta ambos:
  gana el que escriba mejor prosa; si el OpenAI empata, gana el gratis. El
  desarrollo diario sigue siendo con el stub ($0 siempre).
- **Microsoft Agent Framework NO tiene SDK TypeScript usable** (npm 0.0.1-beta stub;
  discusión oficial #6181 sin respuesta). Ver anexo: sidecar Python opcional.
- Validación de esquema con `zod` (^4).

## La cadena

```
Partido → analizar() → Hecho[] → [Cronista LLM ⇄ Verificador]×(1+máx 2 reintentos) → CronicaVerificada
```

```ts
// src/cadena/tipos.ts
interface Oracion { texto_es: string; texto_en: string; hechos: string[]; }
interface CronicaDraft { titulo_es: string; titulo_en: string; oraciones: Oracion[]; }
interface CronicaVerificada extends CronicaDraft {
  intentos: number;            // 1–3
  frasesOmitidas: number;      // rechazadas sin reemplazo válido
  modo: "llm" | "acta";        // "acta" = fallback sin LLM
}
type Motivo = { oracion: number; regla: "V1"|"V2"|"V3"|"V4"|"V5"|"V6"; detalle: string };
```

**Guarda de entrada** (de la auditoría del 002): el pipeline corre
`verificarContrato` + invariantes del simulador sobre el `Partido` ANTES de
`analizar`, y falla fuerte si algo no cuadra. `analizar` garantiza sus propiedades
solo para salida válida del simulador; esta guarda hace imposible alimentarlo con
otra cosa por accidente.

## La costura LLM

`src/lib/llm.ts` expone `completar(system: string, mensajes: Mensaje[]): Promise<string>`
con dos implementaciones elegidas por `CRONISTA_LLM=stub|foundry`:

- `llm-foundry.ts` — el SDK real, config por env (`FOUNDRY_API_KEY`,
  `FOUNDRY_BASE_URL`, `FOUNDRY_DEPLOYMENT`). La clave jamás llega al cliente ni al repo;
  `.env.example` documenta las variables sin valores.
- `llm-stub.ts` — determinista: construye el JSON correcto desde las plantillas de los
  hechos. **Todo el pipeline funciona offline con el stub**; Foundry se enchufa sin
  tocar una línea de la cadena.

## El Cronista

System prompt fijo: redactá la crónica usando SOLO los hechos dados; salida JSON con
el esquema `CronicaDraft`; cada oración cita los IDs de hechos que usa; ES y EN con
las mismas cifras; prosa sobria de periodismo deportivo, cero datos inventados.
Entrada: los `Hecho[]` serializados (id, textos, datos, relevancia). Debe cubrir todo
hecho con `relevancia ≥ umbrales.COBERTURA` (en `src/cadena/umbrales.ts`).

## El Verificador (determinista, sin LLM)

| Regla | Rechaza cuando |
|---|---|
| V1 | la salida no parsea o no cumple el esquema zod |
| V2 | una oración cita un hecho inexistente, o no cita ninguno |
| V3 | un número en el texto no aparece en los `datos`/textos de los hechos citados |
| V4 | un nombre propio no pertenece a los equipos/jugadores de los hechos citados (jugador fantasma) |
| V5 | queda sin citar algún hecho con `relevancia ≥ COBERTURA` |
| V6 | ES y EN de una oración difieren en sus números, o alguno está vacío |

Protocolo: veredicto con `Motivo[]` → reintento con feedback explícito (máx. 2).
Tras agotar reintentos: se **omiten** las oraciones aún rechazadas si V5 se sigue
cumpliendo; si no, **modo acta**: la crónica se arma directo de las plantillas del
Analista (seca pero 100 % fiel). **Nada sin verificar llega jamás al lector.**

## Caché

La crónica verificada se cachea en disco por `(seed, deployment)`: misma semilla ⇒
cero llamadas repetidas al LLM. Acota el costo y hace la demo instantánea.

## Propiedades verificables

Fixtures con LLMs falsos inyectados por la costura: (a) salida perfecta ⇒ pasa a la
primera; (b) número inventado ⇒ V3 y reintento; (c) jugador fantasma ⇒ V4;
(d) oración sin cita ⇒ V2; (e) cobertura incompleta ⇒ V5; (f) JSON roto ⇒ V1;
(g) malicioso persistente ⇒ termina en modo acta con crónica válida. E2e con stub
sobre semillas 1..50: siempre produce `CronicaVerificada`, nunca lanza. Mutación de
control: anular V3 debe poner rojo el fixture (b).

## Anexo: sidecar Agent Framework (opcional, semana 3, timebox 1 día)

Para el checkbox real de Agent Framework ("Best Multi-Agent System"): servicio Python
pequeño con `agent-framework` 1.0 GA — `WorkflowBuilder` secuencial con arista
condicional de feedback — cuyos ejecutores llaman la cadena TS por HTTP; su DevUI
muestra el grafo en vivo (oro para el video). Si el tiempo no da, se corta sin dolor
(prioridad 4 del 000) y el pitch explica que AF aún no publica SDK TS, con enlace a
la discusión #6181: argumento defendible, no excusa.

## Revisión 3.1 — un hecho por oración (2026-09-30, Fable, por auditoría adversaria)

La auditoría demostró que V1–V6 son reglas léxicas y no sostienen la promesa
completa: 25 de 26 mentiras construidas pasaron (recombinación de cifras entre
hechos citados, ganador invertido con tokens legítimos, citar sin narrar, números
en palabras fuera del diccionario, nombres tras puntuación). Respuesta
arquitectónica, no parches:

### 1. Cambio de contrato: hecho principal
```ts
interface Oracion {
  texto_es: string; texto_en: string;
  hecho: string;        // EL hecho que esta oración narra (exactamente uno)
  apoyo?: string[];     // hechos de contexto; solo amplían el resaltado en la UI
}
```
- **V3/V4 verifican contra el hecho principal**, no contra la unión de citas:
  números y nombres de la oración deben existir en `datos`/textos de SU hecho.
  Mata la recombinación (A3) y los nombres compuestos de piezas de dos hechos.
- **V5 → narración obligatoria**: todo hecho requerido es `hecho` principal de
  alguna oración (citarlo en `apoyo` no basta). Mata A5.
- El prompt del Cronista cambia acorde: una oración = un hecho, y lo dice.

### 2. Léxicos completos (A2, B5)
- Números en palabras 0–99 ES/EN, ordinales (tercer/third…), `docena/dozen`,
  `doblete/triplete/brace/hat-trick` (mapeados a su cuenta real), `par/ambos/both`.
- Normalización Unicode de dígitos (fullwidth ７ ⇒ 7) antes de V3/V6.
- Falsos positivos corregidos: «con diez/ten men» válido si el hecho principal es
  expulsión; «one-two», «los 90 minutos», «2nd» al léxico; títulos EN en Title
  Case con diccionario corto de palabras comunes.

### 3. V4 cerrado (A1)
«Inicio de frase» = solo la posición 0 del texto; después de puntuación, una
palabra capitalizada debe ser nombre del hecho principal O estar en el diccionario
corto de palabras funcionales (Después, El, La, The, A, In… — lo controlamos
nosotros porque controlamos los idiomas). Nombres compuestos se cotejan completos.

### 4. Reglas nuevas
- **V7 — negaciones**: construcción que niega eventos («sin», «no hubo», «ni»,
  «ningún», without/no + sustantivo de evento) se rechaza: ningún hecho afirma
  ausencias. Determinista y barato.
- **V8 — vocabulario de juicio**: palabras de juicio fuerte solo si el hecho
  principal las habilita (tabla en umbrales.ts): «dominó» ⇐ dominio_periodo;
  «mereció / contra la corriente» ⇐ justicia_xg; «goleada» ⇐ margen ≥ 3 en datos;
  «monólogo», «paliza» y similares fuera de tabla ⇒ rechazo. El color que el
  Cronista puede usar es el que los hechos pagan.

### 5. La batería del auditor como prueba permanente
`__tests__/mentiras.test.ts`: las 26 mentiras del informe (adaptadas al contrato
nuevo) deben ser TODAS rechazadas con la regla esperada; los falsos positivos de
B5 deben ser aceptados. Fuente: scratchpad del auditor (`ataque.ts`,
`protocolo.ts`).

### 6. Mutaciones y caché (A6, B1–B4, B6, B7)
- Tests que matan las 11 mutaciones supervivientes (prioridad: M14 — la
  re-verificación al leer caché es la única barrera contra caché manipulada).
- Caché: entrada que no pasa esquema zod completo (incluido `audit`) o no pasa el
  Verificador ⇒ **se regenera**, nunca lanza ni se sirve; nombres `.tmp` únicos
  (pid+aleatorio); `--modo acta` resuelve antes de validar el env del LLM.
- B6: si el último intento falla por V1, se recupera el mejor intento previo
  (menos oraciones rechazadas) por la vía de omisión antes de caer al acta.
- Tests para el orden del acta y la versión de caché.

### 7. La promesa, en palabras exactas (para 000/006/pitch)
Lo que garantizamos y podemos demostrar: **cada oración narra un hecho
verificado; cada número, nombre y juicio fuerte está respaldado por ese hecho;
la estructura hace imposible recombinar hechos para mentir; y todo rechazo queda
visible en la Caja de cristal.** Ni más ni menos.

## Revisión 3.2 — afirmaciones computables y robustez (2026-09-30, Fable, ronda 2)

La ronda 2 confirmó el cierre de la ronda 1 y delimitó el residuo: mentiras de
color/causa/tiempo con vocabulario abierto. La respuesta distingue lo computable
de lo incerrable:

### 1. Bugs reales (clase A, se cierran)
- **Sujeto de V8**: «Ante J, A ganó 4–1» pasa porque V8 toma el primer equipo
  antes del verbo. El sujeto es el sintagma inmediatamente antes del verbo (sin
  preposición delante: ante/contra/frente a/against/versus descartan candidato).
  Casos R01/T01/R02 (pasiva: «fue superado por» invierte roles) a la batería.
- **Marcador no orientable**: «4 a 1» / «4 to 1» se orientan igual que «4–1»;
  tabla de guiones Unicode (U+2010, U+2212, etc.) normalizada ANTES de V3/V6.
- **Léxico**: twice/dos veces/por partida doble (= 2), ordinales completos 1º–20º
  + decenas ES/EN, «no ganó / unable to / failed to win / sin victoria /
  penalty-free / -free» a V7/V8.

### 2. Afirmaciones computables nuevas (V8 crece donde el dato paga)
Cada una se verifica contra `datos` del hecho principal, determinista:
- **«gol de la victoria / winner / decisivo»** ⇐ ese gol puso el marcador que
  decidió (computable con marcador del hecho + resultado final).
- **«valla invicta / clean sheet»** ⇐ goles recibidos = 0.
- **Franjas temporales**: «tras el descanso» ⇐ minuto > 45; «sobre el final /
  late on» ⇐ minuto ≥ `FINAL_MIN` (umbral comentado); «temprano» ⇐ ≤ 10.
- **V7 con respaldo**: una negación se ACEPTA si los datos del principal afirman
  ese cero (p. ej. «sin que A respondiera» con expulsion_y_efecto que dice
  «después A marcó 0»). Cierra el falso positivo P03 sin abrir la puerta.

### 3. Muletillas enumeradas (la cola abierta, acotada con honestidad)
El lenguaje para el color es abierto; las muletillas típicas de un LLM no.
`lexico.ts` gana la lista del auditor: golazo, polémico/a, controversially,
gracias a, por culpa de, error del portero/defensa, el mejor de la tarde,
épico, se impuso, doblegó, sucumbió, cayó, superó, edged, downed, cruised past,
got the better of (los verbos de resultado entran a la tabla V8 con orientación).
**Límite documentado** (000/006/pitch): la verificación de color cubre las
afirmaciones computables y el léxico mantenido; una figura retórica inédita no
listada puede pasar — el riesgo residual real según la auditoría es medio solo
ahí, y la Caja de cristal lo deja inspeccionable.

### 4. Falsos positivos (cuestan reintentos)
Aperturas al diccionario (However, Shortly, Poco/Minutos/Momentos después,
Solo, Moments); nombres cortos de equipo válidos tras puntuación (prefijos
derivados de la plantilla); P08 se mantiene (coherente con un-hecho-por-oración).

### 5. Robustez (B de ronda 2)
- **B6 bien definido**: el mejor intento previo minimiza (oraciones rechazadas +
  hechos requeridos que quedarían sin narrar tras omitir); con eso
  `[sinGol, mal(h14), roto]` rescata el intento de h14, no cae al acta.
- **Concurrencia Windows**: rename con reintentos y catch (si falla, se sirve el
  resultado calculado SIN cachear — nunca lanzar después de pagar al LLM);
  limpieza de `.tmp` huérfanos al abrir la caché.
- **Coherencia del audit servido desde caché**: refinamientos zod (n secuencial
  desde 1, último veredicto vacío en modo llm, intentos = audit.length, modo/
  intentos consistentes, apoyo sin duplicados); incoherente ⇒ regenerar. La Caja
  de cristal no muestra historia fabricada.

### 6. Suite
Tests que matan las 9 mutaciones supervivientes (N17, N09, N04, N03, N06, N15,
N14, N16, N02) + los casos R/T/P de ronda 2 a la batería permanente (los de
probabilidad casi nula — homóglifos, espacio de ancho cero, futuro — también:
ya están escritos y son gratis).

## Aceptación

- Suite de fixtures + e2e con stub **vistos correr en verde**; salida en bitácora.
- Una corrida real contra Foundry (cuando exista la cuenta) guardada en
  `docs/evidencia/primera-corrida-foundry.md`.
- Mutación de control de V3 y V4 vista en rojo y restaurada.
