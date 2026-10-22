# Demo video shot list — 1:55 maximum

Updated 22 October 2026 for the published arena revision `cronista-arena--0000013` and the recap
demo. Replaces the 17 October script, whose local recording (`demo-en-borrador.mp4`, 1:50, no
audio) showed only the recap app and is now superseded.

**Rules of the cut** (official rules §4.4): under two minutes; footage of the real public apps;
English captions burned in; no third-party trademarks, footage or music. The only audio is the
project's own Azure Speech voices and a plain English voice-over; no background music. Nothing in
the narration may claim more than the linked evidence shows; the recap evaluation is presented as
"no reduction demonstrated", and no rule rejection is called a caught hallucination.

**Audio sources (already recorded, real Azure Speech, Chromium-decoded):**

| Clip | Content | Length | File |
|---|---|---|---|
| A | EN three-voice exchange: narrator question → commentator → narrator close | 15.0 s | [`publico-comentarista_en.mp3`](../evidencia/publicacion-048/publico-comentarista_en.mp3). Note: `publico-dialogo_completa_en.mp3` (18.8 s), cited here before, is the **statistician** exchange (same bytes as clip D), not the commentator one |
| B | EN short variant (handover + first sentence) | 8.0 s | [`publico-dialogo_breve_en.mp3`](../evidencia/publicacion-048/publico-dialogo_breve_en.mp3) |
| C | ES four-voice round: narrator → commentator → narrator → statistician (177 characters, ~16.7 s) | 16.7 s | [`publico-ronda-457-es.mp3`](../evidencia/publicacion-048/publico-ronda-457-es.mp3) |
| D | EN statistician exchange | 18.8 s | [`publico-estadista_en.mp3`](../evidencia/publicacion-048/publico-estadista_en.mp3) |

Lengths were measured from the MP3 frames; the public smoke lists their SHA-256 hashes. Screen
footage is captured live from the public URLs on the day of recording (scenes 2–6 can use the
match in [`smoke-publico.json`](../evidencia/publicacion-048/smoke-publico.json) via its share
link if it is still within the 24-hour retention; otherwise start a new one). If a live match
cannot be started because the daily quota is spent, scene 2 uses **Saved matches → Load recorded
model duel**, and the caption says "recorded duel, no new inference".

## Scene by scene (total 1:52)

| Time | On screen | Audio | Caption (burned in) | Judging criterion it serves |
|---|---|---|---|---|
| 0:00–0:08 | Arena home in dark mode, scoreboard 0–0, pitch with 22 shirts, referee. Cursor hovers the three desk cards. | Voice-over: "AI can call a football match. Can it prove what it says? CRONISTA is a multi-agent broadcast where every sentence is traceable." | *CRONISTA — multi-agent match broadcast · every sentence traceable* | UX & presentation (hook); category (multi-agent) |
| 0:08–0:22 | **Live** tab: Random coaches shows two deployment names; press **Start live match**. Scoreboard reads *Coaches are deciding · simulation clock paused*, then *Live · 19 s ready*. | Voice-over: "Two LLM coaches on separate Azure OpenAI deployments receive the same committed observation and return a plan for every player. A shared deterministic engine resolves the play; the clock waits for both." | *Home: GPT-5.6 Luna · Away: GPT-5.4 mini · same observation, strict JSON, 60 s deadline, programmed fallback* | Agentic design (distinct roles, shared state); technological implementation |
| 0:22–0:32 | Open **Team plans and player orders**: a validated plan with per-player orders (for example `centrar`), mentality and stated reason, with no programmed fallback shown. | Voice-over: "Plans are validated against the engine. An invalid or late answer gets one correction with feedback, then a recorded programmed fallback. The match never stalls." | *Validated plan · 1 correction with feedback · fallback recorded, never silent* | Agentic design (failure recovery) |
| 0:32–0:52 | Press **Enable narration**. Pitch plays; desk cards fill: narrator card, then **Latest exchange** with the three turns highlighted as each voice speaks. | **Clip A** (18.8 s, real EN audio): narrator question → commentator analysis → narrator close. No voice-over on top. | Live transcript of clip A, each line prefixed by the speaker's role: *Narrator (templates) · Commentator (LLM, verified) · Narrator* | UX & presentation; category (effective handoffs); multi-language storytelling |
| 0:52–1:04 | Click **Inspect facts and checks** on the commentator card: fact IDs, event IDs, verdict "Approved by V1–V8", mode `llm` with deployment name; scroll to a rejected attempt with its rule. | Voice-over: "The commentator may only analyse with a cited fact. Eight deterministic rules check citations, numbers, names and claims. A failed sentence is retried once, then replaced by a labelled template." | *V1–V8: schema · citations · numbers · names · coverage · ES=EN · negations · strong claims* | Explainability; technological implementation |
| 1:04–1:16 | **Ask about this match**: choose *What just happened?* (the other prompts are *What has my selected player done?* and *Which chances have there been?*), style Analyst, press **Ask the match analyst**; answer appears; open **Inspect tools and evidence** showing `consultar_eventos` with tick bounds. | Voice-over: "A versioned Microsoft Foundry agent answers viewer questions with read-only tools over the confirmed play only. Its sentences pass the same verifier." | *Microsoft Foundry Agent Service · agent cronista-analista:1 · tools reject future ticks* | Technological implementation (hero technology); agentic design |
| 1:16–1:28 | Press **ES**: page, desk names and voices switch. Change **Understand this moment** to *Follow selected player* after clicking a shirt number. | **Clip C** starts (ES four-voice round) at low level under a short voice-over: "Spanish or English, fan, analyst or one player: the same intelligence, rendered for each viewer." | *ES / EN · Fan · Analyst · Follow a player — same facts, different experience* | Personalization; multi-language; UX |
| 1:28–1:40 | Cut to the recap demo, seed 246: click a sentence, events light up; **View process** shows drafts and verdicts. | Voice-over: "The same verifier guards the automated recap: click any sentence to see its events and open the process view with every draft and verdict. We claim traceability, not better prose." | *Automated recap · GPT-6.1 Sol · 0/163 baseline, 0/167 pipeline flagged · no reduction demonstrated* | Challenge coverage (automated match recap); honesty for real-world impact |
| 1:40–1:52 | Static card (own design, no logos): architecture diagram from the README; second card with Azure services; third card with the test counts and CI badge; final frame returns to the arena pitch. | Voice-over: "It runs on Azure Container Apps with Blob, Key Vault, Application Insights, Speech and Foundry. Nearly two thousand automated tests run in CI. Everything is synthetic. CRONISTA: narrate the match, prove every sentence." | *Azure OpenAI · Foundry Agent Service · Azure Speech · Container Apps + Jobs · Blob · Key Vault · App Insights · ACR · Bicep · GitHub Actions* then *All data synthetic · open source · claims link to evidence* | Technological implementation; real-world impact; adherence to category |

Voice-over word count: 204 words over about 80 seconds of spoken time (the rest is the project's
own audio), at most 2.75 words per second in any scene. Clip B and clip D are spares: if clip A is replaced by a
freshly recorded exchange, keep the same caption format.

## What the video must not do

- Show Azure Portal, keys, e-mail or personal tabs; record only the two public URLs and the
  static cards.
- Use Premier League, club, broadcaster or Microsoft logos; the cards are plain text on the
  arena's own palette.
- Call the verifier rejection a "caught hallucination" or say the pipeline writes better prose.
- Claim Microsoft Agent Framework, MCP or A2A, Fabric or AKS.
- Imply the arena is a regulation match, that voices were human-reviewed, or that model
  superiority was measured.

## Production notes

1. Record at 1440×900 in Chromium with the arena in dark mode; keep 2× playback speed off during
   the desk scene so the highlighted turns follow the audio.
2. Capture scene 4 with real narration enabled; if Speech is slow, the bundled backup clips will
   sound. Re-take rather than cut, so the caption matches what is heard.
3. Mix clips A and C from the evidence files or from the session's own cached MP3s (identical
   bytes for the same SSML); normalise loudness, no music bed.
4. Burn captions from the table above (`subtitulos-en.srt` is regenerated from this file;
   `tarjetas-video.html` holds the three static cards).
5. Verify the final file end to end, measure its length (must be under 2:00), test the public URL
   from another network, then publish on YouTube or Vimeo and replace `VIDEO_URL` in the README.

## Final cut as rendered (22 October 2026)

File `cronista-demo-final.mp4` (1:46.8, 1440×900, H.264 + AAC, captions burned in) with
transcript `cronista-demo-final.en.srt`, built by `scripts/grabar-video-final.mjs` from the
public apps. Arena session `5d04f28f-df15-453e-95ad-4a5b992b0d77` (Random models → Home GPT-5.6
Luna, Away GPT-5.4 mini; 4 team decisions, 0 programmed fallbacks, 2–0). Voice-over:
`en-US-AndrewNeural` (not used by any desk role). No music. Deviations from the table above:

| Scene | What the final cut uses |
|---|---|
| 2 (0:08–0:22) | Start click, then a cut to "Live · 19 s ready". The "Coaches are deciding" status was not on screen in this take: the buffered broadcast skips the first decision's waiting state and was ready 3 s after start. |
| 3 (0:22–0:33) | Both LLM plans and 11 player orders (`cubrir`, `apoyar`, `pasar`, `profundidad`; no `centrar` in this match). The coaches wrote their stated intent in Spanish. |
| 4 (0:33–0:48) | 14.9 s instead of 20 s. Instead of clip A it uses the audio the page actually played in this match, matched by hash to the session's `/relato` responses: narrator "Lucio Breloera scores the goal!", then the **short variant** of the exchange (narrator handover → commentator, LLM verified). The card shows the full four-turn exchange, which the page's own note explains. Captions carry the role of each voice. |
| 5 (0:48–1:00) | Commentator card with cited facts, "Attempt 1: V3 …" rejected and "Attempt 2: passed the V1–V8 rules", as planned. |
| 6 (1:00–1:11) | Analyst style, AI answer from `foundry-agent:cronista-analista:1`; the tools panel shows `consultar_eventos` with fact IDs and "Passed V1–V8". Tick bounds (0–600) are in the API response, not displayed. |
| 7 (1:11–1:22) | ES switch (desk names change), a selected shirt, "Seguir al jugador seleccionado". Clip C (a different match, 21 Oct) under the voice-over at about −14 dB; its tail is captioned "[Spanish desk audio: a four-voice round recorded in the public arena on 21 Oct]". |
| 8 (1:22–1:34) | Seed 246 was approved on the first attempt, so the process view shows one approved draft; the voice-over line was changed accordingly (see the table). |
| 9 (1:34–1:47) | Own cards (architecture, Azure services, quality with CI run 39699195295 on commit 9704dce), then the final arena pitch. |

A visible cursor was drawn over the page during recording (Playwright does not record the
pointer); no application code was changed.
