# Demo video shot list — 1:55 maximum

Updated 25 October 2026 for the published arena revision `cronista-arena--0000034` (commit
`02c8e3f`): narration on by default and the spoken pre-match presentation before kick-off (058),
the model tournament at `/arena/torneo` (059, 062), match-paced narrated replay (060), match
reports with the arena look (061), six models in the public catalogue. Replaces the cuts for
revisions 0000013, 0000018 and 0000023.

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

## Scene by scene (target ≤ 1:55)

| Order | On screen | Audio | Caption (burned in) | Judging criterion it serves |
|---|---|---|---|---|
| 1 · Hook (~8 s) | First frame of `/arena`: emblem, fictional crests, kits, referee. | Voice-over: "AI can call a football match. Can it prove what it says? …" | *CRONISTA — multi-agent match broadcast · own emblem, fictional crests and kits · every sentence traceable* | UX; category |
| 2 · Models (~14 s) | **Choose models**: Home **GPT-6 Astra**, Away **GPT-6.1 Sol**; **Start live match** (narration starts by itself). | Voice-over: "Six models are in the catalogue; here GPT-6 Astra and GPT-6.1 Sol coach the two teams. …" | *Home: GPT-6 Astra · Away: GPT-6.1 Sol · chosen manually · same observation, strict JSON, 60 s deadline* | Agentic design |
| 3 · Pre-match presentation (~19 s, two pieces) | Line-up card while the live broadcast holds the kick-off; **Skip to kick-off** visible. | Real audio as played: welcome + home header, cut, away header (each header names the model in charge). | *Pre-match presentation · real audio as played in the live broadcast · shortened in the edit …* | UX; storytelling |
| 4 · Goal (~13 s) | Ball in the net, **GOAL** banner, scoreboard highlight, **Goal view** inset. | Real goal call as played. | *Goal call · real narrator audio as played in the live broadcast · ball in the net, GOAL banner, goal view (height illustrative)* | UX |
| 5 · Verification (~12 s) | **Inspect facts and checks** on the commentator card. | Voice-over (V1–V8 line). | *V1–V8: schema · …* | Explainability |
| 6 · Tournament (~13 s) | `/arena/torneo/2026-10-24` standings, then the knockout of the groups tournament. No tournament is launched. | Voice-over: "The six models also play each other: a full league, won by GPT-6 Astra, and a groups and knockout test bracket. …" | *Model tournament · league of 24 Oct, archived and validated in CI · groups + knockout: operator test tournament · results describe these matches, not model quality* | Multi-agent; honesty |
| 7 · Match report (~11.5 s) | `/match/246` on the arena host with the new look and **← Arena**; click a sentence; **View process**. | Voice-over (recap line). | Caption states the writer the page shows. | Challenge coverage |
| 8 · Close (~14 s) | Own cards: architecture (six models), Azure services, quality (2,741 unit · 286 Playwright · 61 statistical; CI run 40104418250 on `02c8e3f`); final arena frame. | Voice-over (closing line). | Azure services line, then *All data synthetic · open source · claims link to evidence* | Implementation; impact |

The script drops, in this order, the Foundry analyst, the download, the stats and the match report
until the cut fits 1:55. A desk exchange is shown only if it follows the goal call in the same take.

## What the video must not do

- Show Azure Portal, keys, e-mail or personal tabs; record only the public URLs and the static
  cards.
- Use Premier League, real club, broadcaster or Microsoft logos; the cards are plain text on the
  arena's own palette. The CRONISTA emblem and the procedurally generated fictional crests and kits
  (brief 055) are the project's own and may appear.
- Show or name models that are not in the public catalogue (the families tested in brief 052).
  The catalogue now has six models, GPT-6 Astra and GPT-6.1 Sol included.
- Launch a tournament from the site for the video (the daily launch is public and costs money);
  use the tournaments already played.
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

## Final cut as rendered (25 October 2026, arena rev. 0000034)

File `cronista-demo-final.mp4` (1:45.4, 1440×900, H.264 + AAC, 9.5 MB, captions burned in) with
transcript `cronista-demo-final.en.srt`, built by `scripts/grabar-video-final.mjs`
(`--fases=arena --toma=toma4 --duracion=60 --modelos=astra6,sol61`, `--fases=torneo,recap`, then
`tarjetas,voz,montar,verificar`). Voice-over `en-US-AndrewNeural`; no music.

Live match: session `dfa09da9-248e-4aa0-ad90-7fdaae9003c9`, recorded 25 Oct 00:05 UTC, manual
selection, Home GPT-6 Astra, Away GPT-6.1 Sol, 60 s, 4 team decisions, 0 programmed fallbacks,
final 1–0 (goal at 47.3 s). A first take on 24 Oct (session `4ee18b13…`, 16:12 UTC) had no audio
because the arena's daily Speech budget was already spent; it was discarded.

| Time | Scene | What the cut uses |
|---|---|---|
| 0:00–0:08 | Hook | First frame of `/arena`. |
| 0:08–0:22 | Models | Choose models → GPT-6 Astra / GPT-6.1 Sol → Start live match. |
| 0:22–0:41 | Pre-match presentation | Live broadcast, real audio: «Welcome to the arena: Juventud Caleteo against Racing Arenablanca.» «Juventud Caleteo line up in a five-three-two, with GPT-6 Astra in charge.», cut, «Racing Arenablanca line up in a three-five-two, with GPT-6.1 Sol in charge.» The full presentation lasted about 55 s; the rest is cut in the edit and the caption says so. |
| 0:41–0:54 | Goal | «What a goal! Mateo Rosánez scores! Juventud Caleteo take the lead, one–nil, after 47 seconds.» with the ball in the net, GOAL banner and Goal view. No desk exchange followed the goal before full time, so this cut has no desk-exchange scene. |
| 0:54–1:07 | Verification | Commentator card on the goal: cited fact a34, "Attempt 1: passed the V1–V8 rules" (no rejection in this match; the voice-over describes the mechanism). |
| 1:07–1:20 | Tournament | League of 24 Oct (GPT-6 Astra first, 19 pts) and the knockout of the groups tournament `sitio-prueba-32ad2249691f`, an operator test tournament (champion GPT-6 Luna); captioned as such. |
| 1:20–1:32 | Match report | `/match/246` on the arena host: arena look and «← Arena», but the page labels its writer as the **offline stub** (deterministic templates, 17/17 verified); the GPT-6.1 Sol report is on the recap demo host, which still has the old look. The caption says the writer is the stub. |
| 1:32–1:45 | Close | Architecture, Azure services and quality cards; final arena frame. |

**Cut:** desk exchange (none after the goal), stats and player card, commentary download, Foundry
analyst, Spanish switch, Team plans. Nothing in the cut is a tournament launched from the site.
A visible cursor was drawn over the page during recording; no application code was changed.
