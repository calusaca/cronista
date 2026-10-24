# Azure integration review

The [new public arena](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena)
was deployed on 19 October 2026 with specific user consent. Its service and
browser checks run against the public URL. The existing report demo remains
on its previous release and address.

The arena runs independent team controllers against a shared, versioned engine.
They receive the same committed state and decision deadline, try to win and
adapt to public opponent actions. Local player control executes between model
decisions. The simulation clock pauses while the coaches decide; professional
football realism and model superiority have not been established.

The new Azure path includes:

- Private Blob journals, replay files, cached answers/audio and durable request
  reservations. A renewable lease limits coordination to one writer. Restarting
  never silently repeats an interrupted model request.
- A versioned Foundry analyst with read-only event/player functions. Server-side
  checks reject future ticks and unauthorized tool calls. Its sentences pass
  the maintained V1–V8 rules or use a labeled template fallback.
- Azure Speech for concise live passages and complete narration from kickoff
  through the final score. Complete playback includes all recorded events and
  can take longer than the short simulated match. Transcripts cite event IDs.
  The locally validated expressive revision adds per-sentence delivery, rising tension during
  observed carries towards the box, and celebration only for confirmed goals.
  Live windows cover three seconds. Deterministic variations preserve replay
  and cache stability. Spanish uses Jorge's resource-advertised `cheerful` style
  plus prosody; English uses Jenny's `excited` and `sad` styles. Editorial emotion
  labels do not imply a distinct native style for every voice. Five real speech
  [samples](../evidencia/voz-expresiva/muestras.json) and a same-text neutral goal
  comparison are retained. Human preference and naturalness review is pending.
  Publishing this revision requires specific consent after automatic approval
  review rejected the update before execution; the existing public app remains
  on the preceding voice release.
- Explicit OpenTelemetry spans in Application Insights, with an App Insights
  connection in Foundry. Captured traces include a real analyst operation and
  its five model/tool child spans. Prompts and credentials are not exported.
- A Key Vault secret reference used by the web application for model and Speech
  requests. The web application and completed manual Container Apps Job use
  managed identity for Blob. The analyst identity has Foundry User at project
  scope: this versioned-agent path also requires permission to read the agent.
- A manual evaluation worker with no infrastructure retries. It fixes settings
  per job ID, reuses completed seeds and preserves ambiguous reservations.

The real recorded duel used GPT-5.6 Luna and GPT-5.4 mini with four accepted team
decisions and zero programmed fallbacks. Twelve real speech passages cover all
33 events. Both complete audio files are available for review:
[Spanish](../evidencia/azure-voz/duelo-completo-es.mp3) and
[English](../evidencia/azure-voz/duelo-completo-en.mp3).

The initial Foundry narration evaluation did not show an improvement. After
enriching facts with their actual recipient/passer shirt number and requesting
structured output, a new two-window run used a different judge. All four paired
rows scored groundedness 5/5 and relevance 4/5; draft and pipeline scores were
equal. This small sample does not demonstrate a pipeline advantage, and changing
the judge prevents a causal before/after comparison. The initial results remain
archived. Human review of factual coverage and pronunciation is pending.

Evidence: [public service smoke](../evidencia/azure-arena-publica-smoke.json),
[public browser exercise](../evidencia/azure-browser-publico.json),
[local service smoke](../evidencia/azure-servicios-smoke.json),
[speech coverage](../evidencia/azure-voz-duelo.json),
[cloud traces](../evidencia/azure-trazas.json),
[public correlated traces](../evidencia/azure-trazas-publicas.json),
[web identity correction](../evidencia/azure-foundry-identidad-publica.json),
[completed job](../evidencia/azure-lotes.json),
[follow-up evaluation](../evidencia/arena-eval-revision-alcance/README.md).

Runtime limits are persisted: ten model matches, twenty analyst questions and
200,000 speech characters per UTC day (brief 058 C1, judging week), with per-session and concurrency limits.
These are usage limits, not a guarantee of a maximum total Azure invoice.
See [operations and limitations](../azure-integraciones.md).

To hear the complete match without starting a new model run, load the recorded
model duel, select **Enable narration for this recording**, then **Listen from
the start**. Spanish and English each have six chronological passages. The
browser check accelerates playback by seeking near each audio's end; human
listening and pronunciation review remain pending.
