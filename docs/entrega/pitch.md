# Submission text (English, ready to paste)

Frozen on 22 October 2026 against the published arena revision `cronista-arena--0000013`
([evidence](../evidencia/publicacion-048/)) and the recap demo. Every figure below is backed by a
file in `docs/evidencia/`; see the [README](../../README.md) for the links. Change nothing here
without re-checking that evidence.

## Elevator pitch (≤ 100 words)

CRONISTA is a multi-agent football broadcast on Azure. Two LLM coaches on separate Azure OpenAI
deployments compete on a shared deterministic engine while a three-voice desk (template narrator,
fact-citing LLM commentator, deterministic statistician) hands the floor around in Spanish or
English through Azure Speech. A Microsoft Foundry agent answers viewer questions with read-only
tools. Every sentence passes deterministic checks and links to its events; failed sentences are
retried, then replaced by verified templates. It solves AI narration's trust problem:
explainable, personalized, bilingual intelligence judges can inspect. Hosted on Azure Container
Apps with Blob, Key Vault and Application Insights.

## Extended description (≤ 250 words)

**What we built.** CRONISTA turns synthetic football events into explainable match intelligence
through two Azure-hosted experiences. The **live arena** is a multi-agent system: two LLM team
controllers (Azure OpenAI, strict JSON plans, deadlines, programmed fallback) compete on a shared
deterministic 2D engine with coaches, substitutions, weather, an active goalkeeper and crosses. A
broadcast desk narrates it in Spanish or English: a template narrator plays the ball, an LLM
commentator analyses only with cited facts and passes verifier rules V1–V8 or falls back to a
verified template, and a deterministic statistician quotes the numbers. Exchanges are journaled
and voiced by Azure Speech, one voice per role. A versioned Microsoft Foundry agent with read-only
tools answers viewer questions on the confirmed play. The **verified recap** demo writes bilingual
reports whose sentences show their events, with every rejected draft inspectable.

**Microsoft and Azure technologies.** Azure OpenAI, Microsoft Foundry Agent Service and
Evaluation, Azure AI Speech, Azure Container Apps and Jobs, Container Registry, Blob Storage,
Key Vault, managed identity, Application Insights, Bicep, GitHub Actions. Orchestration is custom
TypeScript; Agent Framework, MCP and A2A are not used.

**What it proves.** Latest public run: 4/4 coach decisions were valid, 7/7 desk exchanges
composed without structural failures, and real audio played in both languages. 1,788 unit tests,
58 statistical checks and 129 browser journeys run in CI. Stated limits: a short synthetic
prototype, rules that check citations and numbers rather than the relevance of an analysis, and
no demonstrated prose improvement over a first draft.

[Open the live arena](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena) ·
[Verified recap demo](https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io) ·
[Judges' guide](judges-guide.md)
