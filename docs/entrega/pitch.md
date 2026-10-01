# Elevator pitch (borrador — se congela al entregar)

**EN (para el formulario de la plataforma):**

CRONISTA generates bilingual football match chronicles where every sentence can
be proven with a click. A multi-agent pipeline — deterministic Analyst, LLM
Writer on Microsoft Foundry, deterministic Verifier — turns synthetic match
events into explainable match intelligence: the Verifier blocks any sentence
whose numbers, names or claims the events don't back, retries with feedback,
and the Glass Box shows every draft it rejected and why. Readers click any
sentence to see its evidence, watch matches as verified live replays, get
player ratings computed from events with an auditable breakdown, and switch
language, fan/analyst view, or team perspective — personalizing the story,
never the truth. We red-teamed our own verifier across multiple adversarial
rounds; the 141 crafted lies it now rejects ship as a permanent test battery
(500+ tests, CI). Built with Microsoft Foundry, Azure Container Apps and
GitHub Actions. A single agent publishes unsupported claims; our pipeline
publishes zero — reproducibly (`npm run eval`).

<!-- PLACEHOLDER: cifra real de la eval cuando exista -->
<!-- Nota: verificar al congelar que todo lo afirmado siga siendo cierto
     (regla: el pitch promete solo lo entregado). -->
