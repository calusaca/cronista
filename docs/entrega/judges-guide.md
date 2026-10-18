# Try CRONISTA in one minute

Open the [public demo](https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io).
It runs on Azure Container Apps with real GPT-6.1 Sol output through Azure OpenAI.
A new report can take tens of seconds; the first public generation took about 31.
To try the interface locally without an API key, run `npm ci` and `npm run dev`,
then open `http://localhost:3000`. The local default uses a visibly labeled
deterministic Writer.

1. The home page opens a featured synthetic match, seed **246**, with its report
   already loaded. Click a report sentence: its cited match events light up in
   the timeline. Click an event to inspect the sentences that cite it.
2. Choose **Full match** for connected commentary by possession. Select a sentence
   to follow its action on the pitch, with shirt numbers and before/after views.
   **Play sequence** animates the same action's players and ball while the active
   sentence follows along. Pause, restart, change speed or select **Whole match**.
   Choose **Flowing / Detailed** to compare the two narrative styles.
   **Every action** keeps the original complete log; **Formations** shows both
   starting line-ups and the players on the pitch at the selected action.
   Search, jump to a minute or download the entire commentary in EN/ES. On mobile,
   open **Show this action on pitch** and return to the commentary when ready.
   The diagram, directions and support runs are explicitly modelled reconstructions;
   numbers, zones, distances and outcomes come from the events. No extra model calls.
   Playback uses an illustrative reading pace, with possible cuts between zones;
   reduced motion shows discrete steps. On mobile, playback hides the search tools
   temporarily to keep the pitch and controls together; return to commentary to search.
3. Choose **View process** to inspect the actual drafts and verdicts. The recorded
   public report passed on its first attempt: 11 sentence pairs, zero omissions.
   The earlier local video shows a separate generation with 12 pairs. New
   generations can differ. An approved draft is a successful check, not a correction.
4. Switch **EN / ES**, then **Fan / Analyst**. Analyst view exposes fact IDs,
   numbers and event citations. These views reuse the same report. A team
   perspective requests a separately generated version and may take longer.
5. Click a goal in the timeline and choose **3D**. The ball follows its recorded
   trajectory; player pieces stay in their schematic zones. WebGL is optional:
   the 2D view remains available when 3D is unsupported.
   **Follow the full build-up** opens its possession in the commentary.
6. Open **Data** for the dataset methodology, statistical results and a download
   of ten synthetic matches. Dataset seed N uses a documented variant
   configuration and is not the same configuration as the UI's `/match/N`.

The footer identifies the Writer and whether the report came from cache. A new
real-model report can take tens of seconds. A simulated replay is available
through **Watch live**; it is a replay of generated events, not a real broadcast.

Every sentence in the AI recap passes the maintained V1–V8 rules. Those checks cover
structure, citations, numbers, names and listed claim patterns; they do not prove
all possible assertions in free prose. The [recorded evaluation](../evidencia/eval-gpt-6.1-sol/informe.txt)
found zero flagged pairs in both baseline (0/163) and pipeline (0/167), without
demonstrating a reduction. The [known semantic counterexample](../evidencia/verificador-2026-10-10.md)
and the [deployment status](despliegue.md) remain explicit.
The separate full-match commentary uses deterministic templates and a labelled
spatial reconstruction; it does not claim observed off-ball tracking.
