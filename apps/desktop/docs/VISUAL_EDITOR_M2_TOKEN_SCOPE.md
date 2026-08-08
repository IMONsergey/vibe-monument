# Visual Editor M2.2 — Token-aware CSS scope

Status: active implementation gate.
Branch: `monument/visual-editor-m2-token-scope`.

## Product objective

Increase the Visual Editor direct-edit hit rate for real design systems without weakening Monument's proof-driven source-authority model.

M2.1 correctly refuses direct mutation when a literal declaration is backed by `var(--token)`. M2.2 adds an explicit scope model before any token mutation is allowed.

The product rule is:

> **Never mutate a shared design token just because one selected element changed. Prove token ownership, show blast radius, and require an explicit scope choice.**

## Phase A implemented in this branch

### Native token-scope inspection

New privileged-main command:

- `project_token_scope_inspect(projectPath, token)`

The inspector is read-only. It scans bounded plain CSS sources and returns:

- token name;
- all bounded custom-property definitions found;
- source path + line + selector + current value for each definition;
- global (`:root` / `html`) vs scoped owner classification;
- bounded `var(--token...)` usage locations;
- exact definition/usage counts;
- truncation signal;
- a conservative recommendation for the next product action.

### Safety boundaries

- maximum 800 CSS files;
- maximum 1.5 MB per file;
- maximum 16 MB total scan budget;
- symlink entries are ignored;
- common generated/vendor directories are skipped;
- token names are bounded and restricted to safe CSS custom-property identifiers;
- result payloads are bounded;
- inspection performs no source write;
- command is registered only in the privileged `main` webview capability;
- remote preview receives no new permission.

## Scope semantics

### Global token

A definition owned by `:root`, `html`, or `html:root`.

Global mutation is potentially high blast-radius. Monument must never apply it implicitly from a single-element visual edit.

Future UI must offer explicit choices such as:

1. **This element only** — create/update a proven instance-level override.
2. **This local component/scope** — mutate a proven scoped token owner.
3. **Everywhere using this token** — mutate the global token only after showing usage count and explicit confirmation.
4. **Use Codex** — fallback for ambiguity or structural work.

### Scoped token

A custom property defined under a non-global selector.

Scoped mutation may become deterministic only when Monument can prove that the selected runtime element is owned by that selector/scope. Mere token-name equality is not sufficient.

### Multiple owners

Multiple definitions of the same token name require an explicit owner choice. Monument must not choose by file order, selector score, source-hint score, or nearest textual match.

## Why inspection is separate from mutation

The M2.1 source transaction engine is deliberately conservative and atomic. Token mutation adds a second dimension: blast radius.

Separating read-only scope inspection from write authority gives us a stable trust boundary:

1. observe selected runtime property;
2. detect `var(--token)` ownership candidate;
3. inspect definitions + usages;
4. determine whether scope is unambiguous enough to offer a bounded human choice;
5. only then prepare a deterministic source transaction;
6. re-resolve everything natively at commit time;
7. checkpoint + evidence + Fresh Review + Ship as normal.

## Required next implementation slices

### Phase B — Properties choice UX

When M2.1 returns `assisted` because the source value is token-backed:

- parse the token candidate from the proven declaration;
- call `project_token_scope_inspect`;
- show a compact scope card in Properties;
- show usage/blast-radius count;
- disable unsafe choices when inspection is truncated or ownership is ambiguous;
- retain **Use Codex** at all times.

### Phase C — deterministic token mutation

Add a dedicated native preview/commit transaction for a selected token definition.

Commit must:

- re-run token inspection;
- require the same chosen owner path/line/selector/value;
- prove file fingerprint/source range again;
- reject symlink/path escape/concurrent modification;
- validate the replacement CSS value;
- perform atomic same-directory write;
- preserve the existing Visual Editor generation/evidence handoff.

### Phase D — instance override

For **This element only**, Monument may insert or update a literal declaration only when one exact selector owner for the selected element is already proven. It must not synthesize arbitrary selectors from untrusted preview strings.

### Phase E — design token product surface

Once mutation is safe:

- token badge on token-backed Properties;
- token name/value preview;
- usage count;
- local/global scope marker;
- searchable design-token picker;
- recent/project tokens;
- explicit detach-from-token action;
- no hidden editor-only token state.

## Explicit non-goals for this gate

- Tailwind theme mutation;
- Sass/Less variables;
- CSS-in-JS tokens;
- JS/TS theme objects;
- token alias graph mutation;
- multi-file token transactions;
- automatic global token changes without confirmation;
- synthesized selector ownership from preview-only evidence.

These stay Codex-backed until dedicated ownership engines exist.

## Definition of Done

M2.2 is complete only when:

- bounded token inspection is green in Rust tests;
- command is main-webview only;
- token-backed Properties automatically enter assisted scope UX;
- global/shared blast radius is visible before mutation;
- deterministic chosen-owner token mutation has dry-run + native re-resolution;
- exact Timeline generation/evidence/Fresh Review/Ship semantics remain unchanged;
- unsupported/ambiguous cases always preserve Codex fallback;
- no preview-only persistent styling or hidden token document model is introduced.

## Product standard

A Framer-class editor must feel immediate, but Monument has a stronger requirement than a page builder: the repository is the product truth.

The correct hierarchy remains:

> **Prove scope → expose blast radius → ask only when the choice is material → mutate source atomically → bind evidence. Otherwise use Codex.**
