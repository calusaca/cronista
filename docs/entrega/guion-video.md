# Demo video shot list — 1:55 maximum

Updated 23 October 2026 for the published arena revision `cronista-arena--0000023` (commit
`0d39ab0`: varied goal cries 054, football identity with emblem, fictional crests and kits 055,
pre-match line-ups and spoken pre-match 056, Play with narration and the visible goal 057; GPT-6
Sol in the public catalogue). Replaces the earlier cuts for revisions 0000013 and 0000018. GPT-6 Astra is deployed but not
public, and is neither shown nor mentioned.

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
| 1 · Hook (~8 s) | First frame of `/arena` in dark mode: own emblem, both fictional crests on the scoreboard, coloured kits on the pitch, referee; cursor over the scoreboard and two tokens. | Voice-over: "AI can call a football match. Can it prove what it says? CRONISTA is a multi-agent broadcast where every sentence is traceable." | *CRONISTA — multi-agent match broadcast · own emblem, fictional crests and kits · every sentence traceable* | UX (hook); category |
| 2 · Models (~13 s) | Side panel: Controller selection **Choose models**, Home **GPT-6 Sol**, Away **GPT-6 Luna**; **Start live match**; **Enable narration** while the broadcast is still preparing. | Voice-over: "Two LLM coaches, GPT-6 Sol and GPT-6 Luna, receive the same committed observation and return a plan for every player. A shared deterministic engine resolves the play; the clock waits for both." | *Home: GPT-6 Sol · Away: GPT-6 Luna · chosen manually · same observation, strict JSON, 60 s deadline* | Agentic design; technological implementation |
| 3 · Pre-match (~14 s) | The same match, opened from **Saved matches** and played with **With narration** (brief 057) from 0:00: the **Starting line-ups** card with both formations drawn with shirt numbers, captain, coach, traits, and chips for weather, pitch and referee. | **Real spoken pre-match** by the statistician as the narrated track played it (first piece: home line-up, formation, captain, coach). No voice-over. | *Pre-match · same match replayed with narration from Saved matches · line-up card and the statistician's spoken pre-match, real audio as played*; transcript prefixed "Statistician (spoken pre-match)". | UX; storytelling; data |
| 4 · Goal and desk (~20 s) | Live broadcast: the ball in the net, **GOAL** banner with the crest, scoreboard highlight, scorer ring and the **Goal view** inset while the real varied cry plays; then **Latest exchange** while the desk speaks. | Real audio as played: goal call (one of ten cries per language), then the desk exchange (narrator → commentator). | *Goal call · real narrator audio as played in the live broadcast · ball in the net, GOAL banner, goal view (height illustrative)*, then *Real audio from this match · desk exchange …*; per-clip transcript. | UX; multi-agent handoffs |
| 5 · Verification (~12 s) | **Inspect facts and checks** on the commentator card. | Voice-over (V1–V8 line). | *V1–V8: schema · citations · …* | Explainability |
| 6 · Stats (~10.5 s) | Final stats panel with event icons, then the scorer's card with live stats. | Voice-over (stats line). | *Match stats and the selected player's stats …* | Personalization; data |
| 7 · Download (~8.5 s) | **Download commentary (Markdown)** click, then the card with the real file name and an unedited excerpt. | Voice-over (download line). | *Download commentary · Markdown or JSON …* | Explainability |
| 8 · Foundry analyst (~10 s, kept if it fits) | **Ask the match analyst**, style Analyst, answer and tools. | Voice-over (analyst line). | *Microsoft Foundry Agent Service · agent cronista-analista:1 · tools reject future ticks* | Hero technology |
| 9 · Close (~14 s) | Own cards: architecture, Azure services, quality (2,395 unit · 190 Playwright · 61 statistical; CI run 39883072278 on `368357e`); final arena frame. | Voice-over (closing line). | Azure services line, then *All data synthetic · open source · claims link to evidence* | Technological implementation; impact |

**Cut to fit 1:55**: the script drops scenes in this order until the cut fits: the recap demo
(seed 246) first, then the Foundry analyst. Team plans and the Spanish switch were already cut in
the previous version. The cut actually rendered is recorded below.

## What the video must not do

- Show Azure Portal, keys, e-mail or personal tabs; record only the two public URLs and the
  static cards.
- Use Premier League, real club, broadcaster or Microsoft logos; the cards are plain text on the
  arena's own palette. The CRONISTA emblem and the procedurally generated fictional crests and kits
  (brief 055) are the project's own and may appear.
- Show or name models that are not in the public catalogue (GPT-6 Astra, the families tested in
  brief 052).
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

## Final cut as rendered (23 October 2026, arena rev. 0000023)

File `cronista-demo-final.mp4` (1:51.5, 1440×900, H.264 + AAC, 9.7 MB, captions burned in) with
transcript `cronista-demo-final.en.srt`, built by `scripts/grabar-video-final.mjs`:
`--fases=arena --toma=toma2 --duracion=60 --modelos=sol6,luna6`, then `--fases=previa`, then
`tarjetas,voz,montar,verificar`. Voice-over `en-US-AndrewNeural`; no music.

Live match: session `558b241f-3794-4e3a-9c7c-b1d16729e6b2`, manual selection, Home GPT-6 Sol, Away
GPT-6 Luna, 60 s, `reinicios-v5`, 4 team decisions, 0 programmed fallbacks, final 0–3 (goals at 12.2,
24.3 and 37.3 s).

| Time | Scene | What the cut uses |
|---|---|---|
| 0:00–0:08 | Hook | First frame of `/arena`: emblem, two crests, kits. |
| 0:08–0:22 | Models | Choose models → GPT-6 Sol / GPT-6 Luna → Start live match → Enable narration. |
| 0:22–0:36 | Pre-match | In the live take the narration became ready before the clock stopped, so the spoken pre-match was not played there. The scene uses the **same match** reopened from Saved matches with *With narration* (brief 057), from 0:00. The first pre-match piece is "Here is Sporting Quebralta, in a three-five-two: Rafael Celoales wears the armband…" (12.8 s), taken from the page's own `/relato` response, which also built the narrated track. The caption says it is the replay. |
| 0:36–0:56 | Goal and desk | Live broadcast. The third goal call as played: «Shot, and goooal! Mateo Soreloya, goal! It's a rout for Deportivo Lumbrera, nil–three, after 37 seconds.» Ball in the net, GOAL banner, Goal view inset. Then the short desk exchange (narrator → commentator, LLM verified). |
| 0:56–1:09 | Verification | Commentator card: cited facts, "Attempt 1: passed the V1–V8 rules" (no rejection in this match; the voice-over describes the mechanism). |
| 1:09–1:19 | Stats | Final stats with event icons, then the scorer's card (3 goals, 3 shots, 303 m, 24.2 km/h). |
| 1:19–1:28 | Download | Real click on *Download commentary (Markdown)*; card with the real file name `cronista-arena-1555788435-comentarios-en.md` and an unedited excerpt that starts with the pre-match conversation. |
| 1:28–1:38 | Analyst | Foundry agent, AI answer. |
| 1:38–1:51 | Close | Architecture, Azure services and quality cards; final arena frame. |

**Cut:** the recap demo (seed 246), dropped automatically to stay under 1:55; Team plans and the
Spanish switch were already out. A first take on revision 0000021 (session `a19fc7b5…`, 23 Oct
00:03 UTC) was stopped before the montage, because a published bug made the crest in the goal banner
cover the pitch, and was discarded. The CRONISTA emblem and the procedurally generated fictional
crests and kits are the project's own. A visible cursor was drawn over the page during recording
(Playwright does not record the pointer); no application code was changed.
