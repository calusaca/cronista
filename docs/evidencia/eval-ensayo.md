# CRONISTA eval — single agent vs pipeline

> **ENSAYO RUN — NOT the headline figure.** The `ensayo` backend is a test fixture that plants one deliberate error per chronicle; this sample only proves the harness is deterministic and the pipeline publishes nothing unverified. The README figure comes from the real LLM.

Backend: `ensayo` · 20 fixed seeds (src/eval/umbrales-eval.ts) · judge: the existing Verifier (rules V1–V8), unchanged.

**7.6% of unverified sentences contained unsupported claims; the pipeline published 0.**

| Seed | Score | Single agent: sentences | with findings | % | rules | Pipeline: sentences | with findings | mode · attempts |
|---:|:---:|---:|---:|---:|:---|---:|---:|:---|
| 246 | 4–1 | 16 | 1 | 6.3 | V3 | 16 | 0 | llm · 2 |
| 116 | 2–0 | 10 | 1 | 10.0 | V3 | 10 | 0 | llm · 2 |
| 834 | 0–0 | 10 | 1 | 10.0 | V3 | 10 | 0 | llm · 2 |
| 289 | 0–1 | 11 | 1 | 9.1 | V3 | 11 | 0 | llm · 2 |
| 1 | 2–1 | 11 | 1 | 9.1 | V3 | 11 | 0 | llm · 2 |
| 3 | 1–2 | 11 | 1 | 9.1 | V3 | 11 | 0 | llm · 2 |
| 4 | 1–1 | 10 | 1 | 10.0 | V3 | 10 | 0 | llm · 2 |
| 5 | 1–4 | 17 | 1 | 5.9 | V3 | 17 | 0 | llm · 2 |
| 7 | 1–3 | 14 | 1 | 7.1 | V3 | 14 | 0 | llm · 2 |
| 8 | 0–2 | 9 | 1 | 11.1 | V3 | 9 | 0 | llm · 2 |
| 10 | 1–0 | 9 | 1 | 11.1 | V3 | 9 | 0 | llm · 2 |
| 11 | 3–2 | 17 | 1 | 5.9 | V3 | 17 | 0 | llm · 2 |
| 12 | 2–2 | 16 | 1 | 6.3 | V3 | 16 | 0 | llm · 2 |
| 19 | 2–4 | 13 | 1 | 7.7 | V3 | 13 | 0 | llm · 2 |
| 22 | 3–1 | 10 | 1 | 10.0 | V3 | 10 | 0 | llm · 2 |
| 23 | 4–4 | 22 | 1 | 4.5 | V3 | 22 | 0 | llm · 2 |
| 27 | 2–3 | 12 | 1 | 8.3 | V3 | 12 | 0 | llm · 2 |
| 32 | 3–3 | 14 | 1 | 7.1 | V3 | 14 | 0 | llm · 2 |
| 34 | 4–3 | 17 | 1 | 5.9 | V3 | 17 | 0 | llm · 2 |
| 40 | 0–3 | 13 | 1 | 7.7 | V3 | 13 | 0 | llm · 2 |
| **Total** | | **262** | **20** | **7.6** | | **262** | **0** | |

Estimated tokens: 201,042 (≈ 4 characters per token, both arms) · estimated cost: $0.00.
