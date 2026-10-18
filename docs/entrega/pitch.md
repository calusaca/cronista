# Elevator pitch (borrador — se congela al entregar)

**EN corto (96 palabras; adaptar al límite real del formulario):**

CRONISTA turns synthetic football events into bilingual match reports with
clickable evidence. A deterministic Analyst supplies cited facts, a Writer on
Microsoft Foundry produces prose, and a deterministic Verifier checks each
sentence before publication. Readers inspect the original drafts, switch
languages, explore player ratings, and replay goals in 3D. Every team and player
is fictional. Our recorded 20-match evaluation found zero flagged sentence
pairs in both baseline and pipeline output; it did not demonstrate a reduction.
The contribution is inspectable evidence and an explicit recovery path, with
documented limits. Built with Azure OpenAI and automated tests.

**EN ampliado:**

CRONISTA generates bilingual football match chronicles with a clickable evidence
trail. A staged pipeline — deterministic Analyst, LLM
Writer on Microsoft Foundry, deterministic Verifier — turns synthetic match
events into explainable match intelligence: the Verifier checks citations,
numbers, names and maintained claim patterns, and retries failures with feedback,
and the Glass Box shows every draft it rejected and why. It runs a living
fictional world: eight countries, leagues with standings and suspensions that
carry across matchdays, weather that provably slows the second half (A/B over
500 matches — and the chronicle may only say "the heat told" when it was
measured in that match), bicycle kicks and halfway-line goals with hard
coherence constraints, auditable player ratings, verified live replays, and a
3D goal diorama where only the ball moves — because only the ball's trajectory
is recorded data. Readers click any sentence to see its evidence and switch
language, fan/analyst view, or team perspective — personalizing the story,
never the truth. A separate full-match commentary connects every recorded action
to a schematic pitch, with shirt numbers, team formations and labelled modelled
support runs. We red-teamed our own verifier across five adversarial
rounds; the crafted lies it rejects ship as a permanent battery within 1,429
unit tests. The automated suites also contain 55 statistical checks and 62 browser
journeys. In a 20-match GPT-6.1 Sol evaluation, both the first-draft baseline
and published pipeline output had zero sentence-level Verifier findings
(0/163 and 0/167 bilingual units). This sample did not demonstrate fewer
findings with the pipeline. Independent semantic evaluation is still needed
for unrestricted prose. Built with Microsoft Foundry / Azure OpenAI
and GitHub Actions, hosted on Azure Container Apps.

[Try the public demo](https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io).

Resultado y límites: `docs/evidencia/eval-gpt-6.1-sol/informe.txt`.
El único rechazo de la cadena fue un falso positivo V8; no presentarlo como
una alucinación atrapada. Ese falso positivo ya fue corregido; la evaluación
original se conserva con su evaluador archivado y la revalidación posterior es
offline, sin una nueva corrida del modelo. El resultado de ensayo del 7,6 % no
corresponde al LLM real.
<!-- Nota: verificar al congelar que todo lo afirmado siga siendo cierto
     (regla: el pitch promete solo lo entregado) y que quepa en el límite
     del formulario; reconciliar cifras con la suite del momento. -->
