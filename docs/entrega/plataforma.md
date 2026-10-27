# Innovation Studio project page — fields ready to paste

The project page has no separate demo-URL, testing-instructions or category field, so all three go at the
top of **Description** (the portal's Getting Started page lists no submit button or category picker; the
page itself is the submission). The video goes in **Images/Video** once it is on YouTube. Texts follow
[`pitch.md`](pitch.md) and the [judges' guide](judges-guide.md).

## Tagline

Two AI coaches play, a three-voice AI desk calls it in English and Spanish, and every sentence links to the match events that prove it.

## Keywords

Multi-Agent System · Explainable AI · Azure OpenAI · Microsoft Foundry · Azure AI Speech · Azure Container Apps · Synthetic Data · Football Analytics · Match Storytelling · Personalization

## Description

TRY IT (free, no login, open until 10 Nov)
• Live arena: https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena
• Judges' guide (testing instructions, 3 minutes): https://github.com/calusaca/cronista/blob/main/docs/entrega/judges-guide.md
• Verified match recap: https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io
• Code: https://github.com/calusaca/cronista
• Demo video (under 2 minutes): https://youtu.be/JENkKNABuzI

CATEGORY: Best Multi-Agent Orchestration (Best Multi-Agent System in the official rules). It also uses Microsoft Foundry (agent service, evaluation, models) and Azure Container Apps.

WHAT WE BUILT
CRONISTA is a multi-agent football broadcast on Azure that turns synthetic match events into explainable, personalized match intelligence. Two LLM coaches, drawn from six Azure OpenAI deployments, receive the same observation and return strict JSON plans; a shared deterministic engine resolves passes, shots, tackles, fouls, offsides and goals. A three-voice desk narrates live in English or Spanish through Azure Speech: a template narrator calls the play, an LLM commentator may only analyse with cited facts, and a deterministic statistician quotes the numbers. A Microsoft Foundry agent answers viewer questions with read-only tools.

WHY IT MATTERS
AI commentary is fluent but hard to trust. In CRONISTA every sentence passes deterministic verifier rules (V1–V8) and links to its events; a failed sentence is retried with feedback, then replaced by a labelled template. "Inspect facts and checks" shows the proof on screen.

PERSONALIZED
Fan, Analyst and follow-a-player views; favourite club and player with "Only my player"; live stats and a player card with distance and top speed; ES/EN text and voices; a six-model tournament; replays and downloadable recordings; a reproducible synthetic dataset and overlay JSON.

MICROSOFT AND AZURE
Azure OpenAI, Microsoft Foundry Agent Service and Evaluation, Azure AI Speech, Container Apps and Jobs, Container Registry, Blob Storage, Key Vault, managed identity, Application Insights, Bicep, GitHub Actions. Orchestration is custom TypeScript (no Agent Framework, MCP or A2A).

Limits, stated honestly: a short synthetic 2D prototype; the rules check citations, numbers and names, not the relevance of an analysis.

## Images/Video

YouTube URL of `cronista-demo-final.mp4` (under 2 minutes). Keep the current cover image
([`portada-cronista.png`](portada-cronista.png)).
