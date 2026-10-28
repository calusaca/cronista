# Demo video shot list — between 1:50 and 1:58

Updated 27 October 2026 for brief 067 (block A), recorded on the published arena revision
`cronista-arena--0000052` (rules `reinicios-v10`, commit `8873622`) and the recap host
`cronista--0000007` (brief 069, commit `b362269`). Replaces the cut of 25 October (rev. 0000034),
which stays in the git history. New since that cut: shared state and team plans, live stats with
top speed in km/h, favourites and «Only my player», the audience views, the switch to Spanish with
real Spanish audio, the Microsoft Foundry analyst, the match report with the current look and the
synthetic dataset with its overlay JSON.

**Rules of the cut** (official rules §4.4, brief 067 § 2): more than 1:50.0 and less than 1:58.0;
1440×900, dark theme, English, captions burned in; footage of the real public apps; no third-party
trademarks, footage or music. The only audio is the project's own Azure Speech voices and a plain
English voice-over (`en-US-AndrewNeural`, used by no desk role); no background music. Nothing in the
narration may claim more than the screen or the linked evidence shows; no rule rejection is called
a caught hallucination.

## Scene by scene (brief 067 § 2.1)

| # | Scene | On screen | Audio | Serves |
|---|---|---|---|---|
| 1 | Hook | First frame of `/arena`: site bar, fictional crests and kits, referee | Voice-over | Presentation |
| 2 | Agents | **Choose models**: GPT-6 Astra (home), GPT-6.1 Sol (away), 120 s, **Start live match** | Voice-over names the roles: two LLM coaches, shared engine, desk of three voices | Multi-agent: distinct roles |
| 3 | Pre-match presentation | Line-up card during the live broadcast | Real audio, one piece only: welcome + home header (names the model in charge) | (iii) storytelling |
| 4 | Shared state | «Coaches are deciding · simulation clock paused», «Live · N s ready», **Team plans and player orders** (validated plan, intention, orders) | Voice-over | (a) ingestion; shared state and handoffs |
| 5 | Goal | Ball in the net, GOAL banner, goal view | Real goal call of this session | (d) render; (iii) |
| 6 | Desk and verification | Desk exchange with real audio if it follows the goal in the same take; **Inspect facts and checks** | Voice-over (V1–V8) | (c) explain; (iv); recovery |
| 7 | Live stats | Stats panel and the scorer's card: distance, **top speed in km/h**, passes | Voice-over | (b) interpret; (ii) player metrics |
| 8 | Personalisation | Player and club stars, **Only my player (and goals)**, **Understand this moment** in Fan, Analyst and Follow selected player, **ES** switch with 2–3 s of real Spanish audio, back to EN | Voice-over, then real Spanish audio | (e) personalise; (vi) multilingual |
| 9 | Foundry analyst | **Ask the match analyst**, answer with cited events, **Inspect tools and evidence** | Voice-over | Microsoft technology; agent with tools |
| 10 | Tournament | `/arena/torneo/2026-10-24`, the league already played; no tournament is launched | Voice-over | Multi-agent at scale; honesty |
| 11 | Match report | `/match/246` on the recap host: click a sentence, its events highlighted, **View process** | Voice-over; caption states the writer the page shows | (iii); (iv) |
| 12 | Data | `/datos` (dataset, DATASHEET, sample download) and `/api/overlay/246` | Voice-over | (v) data; (d) overlay |
| 13 | Close | Own cards: architecture, Azure services, quality (figures seen running); final arena frame | Voice-over | Implementation; impact |

Cut order if it does not fit: the overlay piece of 12 (only when it shortens the cut), the Spanish
audio of 8, the desk exchange of 6, the tournament. Scenes 2, 4, 5, 7 and 8 are never cut.

## What the video must not do

- Show Azure Portal, keys, e-mail or personal tabs; record only the public URLs and the static
  cards.
- Use Premier League, real club, broadcaster or Microsoft logos; the cards are plain text on the
  arena's own palette. The CRONISTA emblem and the procedurally generated fictional crests and kits
  (brief 055) are the project's own and may appear.
- Show or name models that are not in the public catalogue (the families tested in brief 052).
  The catalogue has six models, GPT-6 Astra and GPT-6.1 Sol included.
- Launch a tournament from the site for the video (the daily launch is public and costs money);
  use the tournaments already played.
- Call the verifier rejection a "caught hallucination" or say the pipeline writes better prose.
- Claim Microsoft Agent Framework, A2A, Fabric or AKS. MCP may be named only as brief 071 built it: a
  read-only server at `/api/mcp` over finished matches, through which the match-report agent reads its
  facts (third montage).
- Imply the arena is a regulation match, that voices were human-reviewed, or that model
  superiority was measured.

## Production notes

1. Everything is produced by `scripts/grabar-video-final.mjs` (phases `arena`, `torneo`, `recap`,
   `datos`, `tarjetas`, `voz`, `montar`, `verificar`); intermediates live in `.cache/video-final/`.
   The page's own audio is captured from its `/relato` responses and matched by FNV-1a hash to the
   clip that actually started playing; `verificar` repeats that match for every real clip in the cut.
2. The Foundry analyst is asked **during** the match (from 12 s of play). After a full narrated
   120 s match, `/analisis` answers 429 «Se alcanzó el límite de consultas de este encuentro»: the
   per-match check adds every voice reservation of the session (narrator, guests, pre-match) against
   `PRESUPUESTO_AUDIO_ENCUENTRO` (24,000). Reproduced on the programmed rehearsal session
   `21e577c6-3361-4d2d-a116-af6b6aa15143` (27 Oct): `POST /api/arena/sesiones/<id>/analisis` with
   `{"tick":1200,"pregunta":"momento","jugador":null,"audiencia":"analyst"}` → 429. No app code was
   changed; the scene was recorded mid-match instead (allowed by brief 067 § 2.2).
3. The Spanish audio is the page's own narration after **Switch to Spanish** (brief 058 § 3.1: the
   narration resumes in the new language), not a separate request.
4. Verify the final file end to end, measure its length, test the public URL from another network,
   then publish on YouTube or Vimeo and replace `VIDEO_URL` in the README.

## Final cut as rendered (27 October 2026)

> **Third montage, 28 October, ~00:10 UTC** (same take `toma067-1`; only scene 11, its voice line and the architecture card
> change). Scene 11 now records the arena match report of **this same match**,
> `/arena/cronica/2c482d475f34dc63fa8e78c8013801218c1c18fc` (brief 064 B4, arena revision `cronista-arena--0000060` with the
> brief 071 MCP server), instead of `/match/246`: header (1–1, 120 s, GPT-6 Astra vs GPT-6.1 Sol), «Writer: GPT-6.1 Sol ·
> Azure OpenAI», «Facts retrieved via MCP», «7/7 sentences verified»; click on Ismael Barido's equaliser sentence → events
> a36/a37 lit in the timeline; **View process**. The label is built from what the recorded page shows: «Match report of this
> same match · written after the final whistle by GPT-6.1 Sol from its events · 7/7 sentences verified (V1–V8) · facts
> retrieved via MCP». New voice line (22 words, 7.47 s): "After the final whistle, another agent writes the match report
> from these events. Every sentence is verified; one click shows its evidence." The architecture card adds a box «MCP server ·
> read-only /api/mcp — the match-report agent reads its facts through it; any MCP client can query finished matches» next to
> the Foundry analyst (card top padding reduced so the row clears the captions). Length **1:57.52**. Command:
> `node scripts/grabar-video-final.mjs --fases=recap --recap=arena-cronica:2c482d475f34dc63fa8e78c8013801218c1c18fc`, then
> `node scripts/grabar-video-final.mjs --fases=voz,tarjetas,montar,verificar --toma=toma067-1 --decidiendo=76.6 --holgura=0.35
> "--ci=run 40462385259 · three jobs · commit be3c96a · 27 Oct 2026" --recap=arena-cronica:2c482d475f34dc63fa8e78c8013801218c1c18fc`.
> The table below describes the 27 October cut: its «Match report» row is replaced by the above (1:34.1–1:41.9), and the
> Data and Close rows shift 0.13 s later.

> **Second montage, 27 October, ~20:00 UTC** (same take `toma067-1`, no new recording, voice-over reused from its cache):
> the architecture card now reads `reinicios-v11` and drops the «Not implemented: …» footnote, the Azure card drops the
> «Not used: …» footnote (custom TypeScript orchestration stays in the card's overline and in the README), and the quality
> card shows run 40462385259 on `be3c96a`: 2,994 tests in 143 files, 343 Playwright journeys, 85 statistical checks.
> Length unchanged (1:57.36); captions unchanged. Command: `node scripts/grabar-video-final.mjs --fases=voz,tarjetas,montar,verificar
> --toma=toma067-1 --decidiendo=76.6 --holgura=0.35 "--ci=run 40462385259 · three jobs · commit be3c96a · 27 Oct 2026"`.

File `cronista-demo-final.mp4` (**1:57.36**, 1440×900, H.264 + AAC, 9.7 MB, captions burned in)
with transcript `cronista-demo-final.en.srt`. Montage report, frames and hash checks:
[`docs/evidencia/video-067/`](../evidencia/video-067/). Commands:

```
node scripts/grabar-video-final.mjs --fases=torneo,datos            # 05:45 UTC
node scripts/grabar-video-final.mjs --fases=recap                    # 05:58 UTC, after the 069 deploy
node scripts/grabar-video-final.mjs --fases=arena --toma=toma067-1 --controladores=manual --modelos=astra6,sol61 --duracion=120
node scripts/grabar-video-final.mjs --fases=voz,tarjetas,montar,verificar --toma=toma067-1 --decidiendo=76.6 --holgura=0.35 \
  "--ci=run 40454094376 · three jobs · commit d3df090 · 27 Oct 2026" "--stats-nota=same CI run, rules up to reinicios-v10"
```

**Live match:** session `e99d346b-b7b7-4571-af10-ccd0e75256ed`, recorded 27 Oct from 06:01 UTC,
manual selection, Home **GPT-6 Astra** (Atlético Puertoscuro), Away **GPT-6.1 Sol** (Olímpico
Nebrisa), 120 s, rules `reinicios-v10`, 8 team decisions, 0 programmed fallbacks (model waits
7.3–12.4 s), final **1–1**: goals at 13.8 s (Tomás Celinánez, home) and 52.3 s (Ismael Barido,
away); 3 fouls, 1 yellow, 1 red, 2 offsides. One model take used out of the three allowed; two
earlier rehearsals used the **programmed** demonstration (no models) to test the selectors.

| Time | Scene | What the cut uses |
|---|---|---|
| 0:00.0–0:07.9 | Hook | First frame of `/arena` (saved preview). |
| 0:07.9–0:18.8 | Agents | Choose models → GPT-6 Astra / GPT-6.1 Sol → Start live match. |
| 0:18.8–0:31.6 | Pre-match presentation | Real audio: «Welcome to the arena: Atlético Puertoscuro against Olímpico Nebrisa.» «Atlético Puertoscuro line up in a four-two-three-one, with GPT-6 Astra in charge.» The rest of the ~55 s presentation is cut. |
| 0:31.6–0:39.3 | Shared state | «Coaches are deciding · simulation clock paused» next to «Pre-match presentation · broadcast ready» (recording 76.6 s, line-up view), «Live · 70 s ready» at kick-off, then the plans of window 0:00–0:30 (both `LLM · azure-openai:…`, intention, width/block, 11 player orders). |
| 0:39.3–0:50.6 | Goal | «What a goal! Ismael Barido, goal! Olímpico Nebrisa level it, one–one, after 52 seconds.» Ball in the net, GOAL banner, goal view. |
| 0:50.6–0:59.2 | Verification | Commentator card: cited fact a67 and its rejected attempt 1 («V1: Comentarista no disponible o plazo agotado; presupuesto de llamadas agotado») replaced by the labelled template. |
| 0:59.2–1:06.7 | Live stats | Final stats panel; Ismael Barido's card: 233 m, top speed 27.3 km/h, passes 2/3. |
| 1:06.7–1:19.3 | Personalisation | Player star, club star, Only my player, audience Fan → Analyst → Follow selected player, ES switch; real Spanish audio «Final del partido. Atlético…» (2.6 s of a 4.9 s clip), then back to EN. |
| 1:19.3–1:27.4 | Foundry analyst | Asked at 17.0 s of play: «AI explanation», tool `consultar_eventos`, cited events a10/a12, «2: Passed V1–V8». |
| 1:27.4–1:34.1 | Tournament | League of 24 Oct (GPT-6 Astra first, 19 pts). |
| 1:34.1–1:41.8 | Match report | `/match/246` on the recap host, page label «Writer: Microsoft Foundry · gpt-6.1-sol · served from cache», 11/11 sentences verified; click a sentence, View process. |
| 1:41.8–1:47.4 | Data | `/datos` (100 matches, DATASHEET, 10-match JSONL sample) and `/api/overlay/246` pretty-printed. |
| 1:47.4–1:57.4 | Close | Architecture (rules `reinicios-v10`), Azure services, quality: 2,961 tests in 142 files, 343 Playwright journeys, 80 statistical checks, CI run 40454094376 passed (three jobs, `d3df090`); final arena frame. |

**Deviations from brief 067 § 2.1:**
- Scene 4: the «Coaches are deciding» status did not appear in the first 4 s after the click (the
  page still said «Connecting to the match…»), so the piece comes from the same take at 76.6 s,
  when the coaches were deciding the next window during the pre-match presentation.
- Scene 6: no desk exchange directly follows the goal call (the LLM exchange on the save started
  10 s later and did not fit), so the scene is the inspection only. The visible card is a template
  fallback because the commentator's call budget was spent; the card says so.
- Scene 9 was recorded during the match (see production note 2); its answer covers the first goal,
  whose call sounded off-screen and is therefore not used.
- Scene 8 uses the page's own Spanish narration instead of a separate «Prepare comment audio» clip.
- Scene 3 lasts 12.8 s (brief: ~8 s) because both sentences of the single piece are kept whole.
- The quality card cites CI run 40454094376: the CI started running again when the repository was
  made public (brief 067 § 2.3 had expected «run locally»), and that run passed its three jobs with
  the same counts (2961/142, 343, 80).
