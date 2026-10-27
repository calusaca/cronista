# Submission text (English, ready to paste)

Updated on 27 October 2026 against the published arena revision `cronista-arena--0000049` <!-- 068 -->
and the recap demo; the public smoke figures come from revision `cronista-arena--0000013`
([evidence](../evidencia/publicacion-048/)) and the test figures from commit `950007c`. Every figure below is backed by a
file in `docs/evidencia/`; see the [README](../../README.md) for the links. Change nothing here
without re-checking that evidence.

## Elevator pitch (≤ 100 words)

CRONISTA is a multi-agent football broadcast on Azure. Two LLM coaches from six Azure OpenAI
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
controllers drawn from six Azure OpenAI deployments (strict JSON plans, deadlines, programmed
fallback) compete on a shared deterministic 2D engine with player attributes, club identities
and weather. A broadcast desk narrates it in Spanish or English: a template narrator calls the
play, an LLM commentator must cite facts and pass verifier rules V1–V8 or fall back to a verified
template, and a deterministic statistician quotes the numbers. Azure Speech voices every
journaled exchange. Viewers get live stats, a player card with distance and top speed,
favourites, and a Foundry agent answering questions with read-only tools. A six-model
tournament replays every match. The **verified recap** demo writes bilingual
reports whose sentences show their events and rejected drafts.

**Microsoft and Azure technologies.** Azure OpenAI, Microsoft Foundry Agent Service and
Evaluation, Azure AI Speech, Azure Container Apps and Jobs, Container Registry, Blob Storage,
Key Vault, managed identity, Application Insights, Bicep, GitHub Actions. Orchestration is custom
TypeScript; Agent Framework, MCP and A2A are not used.

**What it proves.** Public smoke: 4/4 valid coach decisions, 7/7 desk exchanges without
structural failures, real audio in both languages. The code carries 2,945 unit tests, 75
statistical checks and 343 browser journeys. Stated limits: a short synthetic
prototype, rules that check citations and numbers rather than the relevance of an analysis, and
no demonstrated prose improvement over a first draft.

[Open the live arena](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena) ·
[Verified recap demo](https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io) ·
[Judges' guide](judges-guide.md)
