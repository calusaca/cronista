# Elevator pitch (borrador — se congela al entregar)

**EN (para el formulario de la plataforma):**

**Review status (October 10):** real-model evaluation and demo hosting are pending.
This draft describes the implemented design; remove this note only after the
submission evidence is complete.

CRONISTA generates bilingual football match chronicles with a clickable evidence
trail. A staged pipeline — deterministic Analyst, LLM
Writer on Microsoft Foundry, deterministic Verifier — turns synthetic match
events into explainable match intelligence: the Verifier checks citations,
numbers, names and maintained claim patterns, retries failures with feedback,
and the Glass Box shows every draft it rejected and why. It runs a living
fictional world: eight countries, leagues with standings and suspensions that
carry across matchdays, weather that provably slows the second half (A/B over
500 matches — and the chronicle may only say "the heat told" when it was
measured in that match), bicycle kicks and halfway-line goals with hard
coherence constraints, auditable player ratings, verified live replays, and a
3D goal diorama where only the ball moves — because only the ball's trajectory
is recorded data. Readers click any sentence to see its evidence and switch
language, fan/analyst view, or team perspective — personalizing the story,
never the truth. We red-teamed our own verifier across five adversarial
rounds; the crafted lies it rejects ship as a permanent battery (1,100+ tests,
CI). Every published sentence passes the defined V1–V8 checks; independent
semantic evaluation is still needed for unrestricted prose. The reproducible
comparison (`npm run eval`) measures findings under those rules. Implemented
with Microsoft Foundry and Azure OpenAI adapters and GitHub Actions;
Azure Container Apps hosting is planned.

<!-- PLACEHOLDER: cifra real de la eval cuando exista -->
<!-- Nota: verificar al congelar que todo lo afirmado siga siendo cierto
     (regla: el pitch promete solo lo entregado) y que quepa en el límite
     del formulario; reconciliar cifras con la suite del momento. -->
