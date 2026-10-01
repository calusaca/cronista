# 003 — Cronista y Verificador

**Fecha:** 2026-09-30 · **Diseña:** Fable (con informe de investigador-foundry) ·
**Implementa:** Opus (semana 2, tras el 002) · **Estado:** cerrado

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

## Aceptación

- Suite de fixtures + e2e con stub **vistos correr en verde**; salida en bitácora.
- Una corrida real contra Foundry (cuando exista la cuenta) guardada en
  `docs/evidencia/primera-corrida-foundry.md`.
- Mutación de control de V3 y V4 vista en rojo y restaurada.
