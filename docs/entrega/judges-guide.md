# Try CRONISTA in two minutes

Two public apps on Azure Container Apps, East US 2, each kept on one warm replica until the
judging period ends on 10 November 2026, so there is no cold start
([`infra/arena-preview.bicep`](../../infra/arena-preview.bicep), `minReplicas = 1`):

- **Live arena (start here):** <https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena>
- **Verified match recap:** <https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io>

No login. The arena uses real Azure OpenAI, Azure Speech and a Microsoft Foundry agent, under the
quotas listed at the end. The latest public walkthrough of exactly this path is recorded in
[`docs/evidencia/publicacion-048/`](../evidencia/publicacion-048/).

## Path 1 · The live arena (about 90 seconds)

1. **Open the arena.** It lands on the **Live** tab with a saved preview on the pitch. The
   top-right **ES / EN** button switches the whole page, including the voices.
2. **Pick the coaches.** Under *Choose who manages each team*, leave **Random** (two different
   deployments drawn from GPT-5.6 Luna, GPT-5.4 mini, GPT-6 Luna and GPT-6 Sol, all on Azure OpenAI; the
   controller label under each team names the deployment that played) or choose them manually.
   Grok 4.7 and gpt-oss-120b were also tried through Foundry Models, but they were too slow or
   ran out of output tokens and were not admitted
   ([evidence](../evidencia/modelos-052/README.md)). **Programmed** runs the same
   path with no model calls. Keep **Coach decides** for formations and the default 120-second
   duration; weather, pitch and crowd are optional. Press **Start live match**.
3. **Watch the handover between agents.** The scoreboard shows *Coaches are deciding · simulation
   clock paused* while both models answer, then *Live · N s ready* once the 20-second buffer is
   filled. Open **Team plans and player orders** below the pitch to read each coach's validated
   JSON plan, its stated reason and whether a programmed fallback was used.
4. **Listen to the narration.** With **Narrate the match** ticked next to **Start live match**
   (the default), narration starts with the match, without another click; **Turn narration off**
   mutes it and the browser remembers that choice. On a shared link, press **Enable narration**
   (and **Enable audio playback** if the browser blocks sound). The
   narrator (Mark Ellison / Rodrigo Valle) calls the play; in the first calm window he hands the
   floor to the commentator (Priya Chandra / Ana Cedeño) or the statistician (Owen Platt / Tomás
   Ibarra). The **Broadcast desk** panel shows the three cards and, after the first exchange,
   **Latest exchange** with the full conversation. Each card states its mode: *AI* with the
   deployment name, *Deterministic*, or a labelled template fallback.
5. **Inspect the evidence.** Open **Inspect facts and checks** on any card: the fact IDs, the
   event IDs behind them, the verifier verdict (V1–V8) and any rejected attempt with the rule
   that failed. **Template and reference** on a narrator turn shows which template was used and
   which record it refers to (checks D1–D5).
6. **Ask the Foundry analyst.** In **Ask about this match**, choose *What just happened?*, *What
   has my selected player done?* or *Which chances have there been?* and an **Explanation style** of
   Fan or Analyst, then **Ask the match analyst**. The answer cites events; **Inspect tools and
   evidence** lists the agent's read-only tool calls. Two questions per match.
7. **Personalize.** Under **Understand this moment**, switch **Fan / Analyst / Follow selected
   player** (click a shirt number on the pitch first). Switch **ES / EN** again: text, desk and
   voices change together.
8. **After the final whistle.** *Match complete · recording available*: **Listen from the start**
   prepares a continuous audio account (it can take longer than the match itself), **Open or
   share this saved match** gives a link that replays without new inference, and the recording
   can be downloaded as JSON and re-imported.

If the daily model quota is already spent, go to **Saved matches** → **Load recorded model duel**:
a real GPT-5.6 Luna vs GPT-5.4 mini match replayed with no model calls, with
**Enable narration for this recording** serving cached real audio.

## Path 2 · The verified recap (about 30 seconds)

1. The home page opens the featured match, seed **246**, with its GPT-6.1 Sol report loaded.
   **Click a sentence**: its cited events light up in the timeline; click an event to see the
   sentences that cite it.
2. **View process** shows the real drafts and verdicts. The recorded public report passed on its
   first attempt (11 sentence pairs); an approved draft is a successful check, not a correction.
3. Switch **EN / ES** and **Fan / Analyst** (same report, different rendering). A **team
   perspective** requests a new generation and can take tens of seconds.
4. **Full match** follows every possession with shirt numbers; **Play sequence** animates the
   selected action on the schematic pitch. Click a goal and choose **3D**: only the ball moves,
   because only its trajectory is recorded.
5. **Data** explains the synthetic dataset and downloads ten matches;
   `/api/overlay/246` returns the machine-readable overlay for the featured match.

## Limits you may hit

- **Model matches:** one live model match at a time and two concurrent sessions per replica;
  **ten model matches per UTC day**. A match lasts at most 180 simulated seconds, with coach
  decisions every 30 seconds. Programmed and saved matches make no model calls and do not count
  toward the daily quota.
- **Analyst:** two questions per match, twenty per UTC day; at most three agent requests per
  question. Over quota, the panel says the service is unavailable and the confirmed events stay
  visible.
- **Speech:** per match, 80 narrator requests / 24,000 characters plus a separate pool of 16
  requests / 4,800 characters for the guest voices; 800 requests / 200,000 characters per day (raised from 120,000 for the judging week).
  The guest pool fits about 6–8 clips, so a full default 120-second match exhausts it even in one
  language (measured with simulated Speech: [evidence](../evidencia/motor-065/voz/README.md)); guests then return 429
  and the narrator is unaffected (the public smoke saw the same at 60 s in both languages). Bundled
  backup clips cover Speech delays; a silent clip is never a failed match.
- **Retention:** journals and recordings are kept 24 hours, 24 sessions per replica. A shared
  link older than that will not resolve; generate a new match.
- **Recap app:** a fresh real-model report (team perspective) took 19–31 seconds in the recorded
  runs; the featured report is cached.

Sources: [Azure integrations and limits](../azure-integraciones.md),
[`MESA_ARENA` and `VOZ_BUFFER` in `src/sim/limites.ts`](../../src/sim/limites.ts),
[deployment runbook](despliegue.md). To run everything offline: `npm ci && npm run dev`, then open
`http://localhost:3000/arena` (programmed coaches, no keys needed).
