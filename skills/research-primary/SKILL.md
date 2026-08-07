---
name: research-primary
description: "Research a technical/product question using authoritative sources and preserve provenance. Use when correctness depends on current external facts, unfamiliar libraries, standards, APIs, or prior-art; do not use web research when the repository itself is the source of truth."
---

# Primary-source research

1. State the decision/question the research must support.
2. Split it into independent questions when parallel investigation is possible.
3. Prefer primary sources: official docs, source code, specifications, papers, vendor changelogs, maintainers' own writing.
4. Check dates/version scope for unstable facts.
5. Distinguish:
   - `VERIFIED`: directly supported by evidence;
   - `INFERENCE`: reasoned from cited evidence;
   - `UNRESOLVED`: insufficient/conflicting evidence.
6. Capture exact source title/URL/version/date and the project implication.
7. Synthesize; do not paste a link dump or long copied passages.
8. Save durable findings under `work/research/` using `templates/RESEARCH.md`.

When research will drive implementation, cite the relevant artifact in the subsequent spec/plan.
