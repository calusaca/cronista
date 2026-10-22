# Demo video shot list — 1:55 maximum

Updated 22 October 2026 for the published arena revision `cronista-arena--0000018` (commit
`e853fa2`: goal calls 050, shot realism `reinicios-v5` 051, GPT-6 Luna in the catalogue 052,
match and player stats 049, commentary downloads 053) and the recap demo. Replaces the earlier
22 October cut (rev. 0000013) and the 17 October draft.

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
| E | EN goal call (brief 050), public smoke of rev. 0000018 — fallback only if the call cannot be captured live; then the caption must say it is the archived smoke clip | 10.6 s | [`publico-canto_en.mp3`](../evidencia/publicacion-050-053/publico-canto_en.mp3) |

Lengths were measured from the MP3 frames; the public smoke lists their SHA-256 hashes. Screen
footage is captured live from the public URLs on the day of recording; the goal and desk audio
is the page's own audio from that match, captured as it plays (clips A–E are spares). If a live match
cannot be started because the daily quota is spent, scene 2 uses **Saved matches → Load recorded
model duel**, and the caption says "recorded duel, no new inference".

## Scene by scene (target 1:54)

| Time | On screen | Audio | Caption (burned in) | Judging criterion it serves |
|---|---|---|---|---|
| 0:00–0:08 | Arena home in dark mode, 0–0, 22 shirts, referee; cursor over the three desk cards. | Voice-over: "AI can call a football match. Can it prove what it says? CRONISTA is a multi-agent broadcast where every sentence is traceable." | *CRONISTA — multi-agent match broadcast · every sentence traceable* | UX (hook); category |
| 0:08–0:22 | **Live** tab: Controller selection **Choose models**, Home **GPT-6 Luna**, Away **GPT-5.6 Luna**; **Start live match**; cut to *Live · 19 s ready* with the assignment line. | Voice-over: "Two LLM coaches, GPT-6 Luna and GPT-5.6 Luna, receive the same committed observation and return a plan for every player. A shared deterministic engine resolves the play; the clock waits for both." | *Home: GPT-6 Luna · Away: GPT-5.6 Luna · chosen manually · same observation, strict JSON, 60 s deadline* | Agentic design; technological implementation |
| 0:22–0:47 | Narration enabled; pitch and desk. A goal: **GOAL** banner over the pitch, scoreboard highlight and scorer ring while the real goal call plays; then the **Latest exchange** about that goal. | **Real audio as played by the page** (no voice-over): goal call «Goooal! … scores! … take the lead, nil–one, after N seconds», play-by-play, then the desk exchange (narrator → commentator, LLM verified). | Top: *Goal call · real narrator audio as played in the public broadcast · GOAL banner and scoreboard highlight*, then *Real audio from this match · desk exchange …* with the roles heard. Bottom: transcript of each clip prefixed by its role. | UX; multi-agent handoffs; storytelling |
| 0:47–1:00 | **Inspect facts and checks** on the commentator card: fact and event IDs, rejected attempts with their rule. | Voice-over: "The commentator may only analyse with a cited fact. Eight deterministic rules check citations, numbers, names and claims. A failed sentence is retried once, then replaced by a labelled template." | *V1–V8: schema · citations · numbers · names · coverage · ES=EN · negations · strong claims* | Explainability |
| 1:00–1:10 | **Final stats** panel (possession, shots, passes, saves, highlights); then the scorer's card with live per-player stats. | Voice-over: "Match stats and each player's numbers are computed only from confirmed events, live as the broadcast plays." | *Match stats and the selected player's stats · counted from confirmed engine events · estimates labelled* | Personalization (player focus); data |
| 1:10–1:19 | **Download commentary** panel, click **Download commentary (Markdown)**; then an own card with the real file name and an unedited excerpt of the downloaded file. | Voice-over: "Every line of the commentary can be downloaded, with its time, voice, evidence and checks." | *Download commentary · Markdown or JSON · each line with time, voice, evidence and checks* | Explainability; real-world use |
| 1:19–1:29 | **Ask the match analyst**: *What just happened?*, style Analyst, **Ask analyst**; answer; **Inspect tools and evidence** with `consultar_eventos`. | Voice-over: "A versioned Microsoft Foundry agent answers viewer questions with read-only tools over the confirmed play only. Its sentences pass the same verifier." | *Microsoft Foundry Agent Service · agent cronista-analista:1 · tools reject future ticks* | Hero technology; agentic design |
| 1:29–1:40 | Recap demo, seed 246: click a sentence, events light up; **View process** (approved in attempt 1). | Voice-over: "The same verifier guards the automated recap: click any sentence to see its events and open the process view with every draft and verdict. We claim traceability, not better prose." | *Automated recap · GPT-6.1 Sol · 0/163 baseline, 0/167 pipeline flagged · no reduction demonstrated* | Challenge coverage; honesty |
| 1:40–1:54 | Own cards (no logos): architecture, Azure services, quality (2,037 unit · 148 Playwright · 61 statistical; CI run 39743502851 on `0d16663`); final arena frame. | Voice-over: "It runs on Azure Container Apps with Blob, Key Vault, Application Insights, Speech and Foundry. More than two thousand automated tests run in CI. Everything is synthetic. CRONISTA: narrate the match, prove every sentence." | Azure services line, then *All data synthetic · open source · claims link to evidence* | Technological implementation; impact |

**Cut from the previous version to fit 1:55:** the Team plans and player orders scene, the Spanish
switch with *Follow selected player* (and clip C under it). Spanish remains available in the app
and is described in the README. Only GPT-6 Luna, GPT-5.6 Luna and GPT-5.4 mini appear; other model
families tested in brief 052 were not admitted and are neither shown nor claimed.

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
2. Capture the goal and desk scene with real narration enabled, switched on as soon as the
   broadcast is ready; if Speech is slow, the bundled backup clips will
   sound. Re-take rather than cut, so the caption matches what is heard.
3. Mix the session's own audio (captured from the page's `/relato` responses and matched by hash
   to what actually started playing); normalise loudness, no music bed.
4. Burn captions from the table above; `scripts/grabar-video-final.mjs` generates the SRT, the
   static cards and the download excerpt card.
5. Verify the final file end to end, measure its length (must be under 2:00), test the public URL
   from another network, then publish on YouTube or Vimeo and replace `VIDEO_URL` in the README.

## Final cut as rendered (22 October 2026, arena rev. 0000018)

File `cronista-demo-final.mp4` (1:53.5, 1440×900, H.264 + AAC, captions burned in) with
transcript `cronista-demo-final.en.srt`, built by `scripts/grabar-video-final.mjs`
(`--fases=arena --duracion=60 --modelos=luna6,equilibrado`, then `tarjetas,voz,montar,verificar`).
Arena session `62b0aa76-957d-4ca3-b86e-c57490fab901`: manual selection, Home GPT-6 Luna, Away
GPT-5.6 Luna, 60 s, `reinicios-v5`, 4 team decisions, 0 programmed fallbacks, final 0–2. A
180 s take recorded first (session `6dd9a1e0…`, 2–1, 12 decisions) was not used: its desk
analysis around the goals fell back to templates. Voice-over `en-US-AndrewNeural`; no music.

| Scene | What the final cut uses |
|---|---|
| Goal (0:22–0:47) | The goal call was captured from the page as it played (matched by hash to the session's `/relato` audio), not taken from `publico-canto_en.mp3`: «Goooal! Darío Loraránez scores! Club Pradoalto take the lead, nil–one, after 26 seconds.» A play-by-play line that the broadcast itself cut short is captioned with an ellipsis. Then the short variant of the commentator exchange (narrator → commentator, LLM verified); the card shows the full exchange. |
| Verification | The commentator card for the second goal is a labelled template fallback with its two rejected attempts (V3, V4) visible. |
| Stats | Final stats panel at 1:00, then the scorer's card (2 goals, 3 shots, distance, top speed, time on the ball, estimated shot index). |
| Download | Real click on *Download commentary (Markdown)*; the card shows the real file name `cronista-arena-70975826-comentarios-en.md` and an unedited excerpt (header lines and the start of the broadcast section; the skipped summary is marked "…"). |
| Analyst | AI answer from the Foundry agent; the tools panel shows a rejected attempt (V3/V4/V7) and "3: Passed V1–V8". |
| Recap | Same recording of seed 246 as the previous cut. |

A visible cursor was drawn over the page during recording (Playwright does not record the
pointer); no application code was changed.
