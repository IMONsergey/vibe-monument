# Visual Editor M2 — Deterministic Source Transactions

Status: active implementation gate.
Branch: `monument/visual-editor-m2-source-transactions`.
Parent release: `0.2.0-alpha.8` / Visual Editor M1.

This document is the implementation contract for the first direct source-editing lane in Monument. It must stay aligned with `MASTER_PRODUCT_CONTEXT.md`, CI contracts and the actual trust boundary.

## 1. Goal

M1 proved the live editor loop without creating a hidden document model:

`live product → Layers/Properties → source-authoritative Codex edit → HMR → Timeline/evidence`

M2 adds a faster path for edits where Monument can prove source ownership strongly enough to mutate source without asking Codex to reason about the change.

The target loop is:

`live product → Properties delta → deterministic dry-run → atomic source transaction → Timeline generation → evidence → Fresh Review → Ship`

If proof is insufficient, the edit must fall back to the M1 Codex path. A lower direct-edit hit rate is acceptable; an incorrect deterministic write is not.

## 2. Non-negotiable invariants

1. Source is authoritative. No durable DOM mutation, injected editor stylesheet or hidden project state.
2. Dry-run is advisory only. Native commit re-resolves ownership against current source before writing.
3. Direct writes must be bounded and deterministic.
4. Ambiguity is a routing decision, not something to guess through.
5. Direct writes are single-file atomic transactions in this slice.
6. Symlinks and paths escaping the canonical project root are refused.
7. A direct edit must immediately become a Version Timeline generation.
8. Evidence from the previous generation becomes stale.
9. Direct visual generations must never collide with Codex turn generations.
10. Project scripts never gain execution permission merely because an edit was direct.
11. Ship must remain closed during source-write/checkpoint/evidence handoff.
12. Remote preview never receives source-write authority.

## 3. Routing model

The native resolver returns one of three modes.

### `deterministic`

All requested properties resolve to exactly one safe literal CSS declaration owner in exactly one source file and the source literal matches the observed runtime value closely enough to prove ownership.

Monument may commit directly.

### `assisted`

The resolver has source evidence but direct mutation would require a scope/ownership decision.

Examples:
- repeated selector across responsive scopes;
- multiple plausible CSS owners;
- token-backed declaration such as `var(--space-xl)`;
- runtime value differs from source because of units/cascade/abstraction;
- a requested batch spans more than one file.

M2.1 does not invent an assisted-choice UI yet. These cases route to Codex.

### `codex`

No safe deterministic mapping is proven or the edit is outside the current direct grammar.

Examples:
- direct text;
- Tailwind utility replacement;
- JSX/TSX style or prop editing;
- structural DOM/component changes;
- unsupported CSS property/value grammar;
- no safe id/class evidence.

These use the existing source-authoritative Prompt Queue/Codex path.

## 4. M2.1 deterministic scope

The first production slice is intentionally narrow: **plain CSS literal declarations**.

Eligible source files:
- `.css` only;
- regular files only;
- symlink directories/files are not followed for direct mutation;
- generated/build/cache/vendor directories are skipped.

Current scan bounds:
- max 800 CSS files;
- max 1.5 MB per file;
- max 16 MB aggregate CSS scan;
- max 24 property changes in one transaction;
- max 300 bytes per property value;
- max 96 bytes for a selector id/class identifier.

Current property allowlist is the core M1 Properties surface:
- size/min/max;
- display/position;
- flex/grid layout fields;
- gap;
- padding/margin sides;
- typography;
- color/background;
- border/radius/shadow;
- opacity/overflow/z-index.

Direct text remains Codex-routed.

## 5. Ownership proof

The visible `Likely / Possible / Weak / Unknown` source card remains a user-facing search confidence signal. It is not authority for writes.

The native transaction resolver independently proves direct ownership.

Selector evidence currently uses bounded safe identifiers from the live selection:
- exact `#id` token match has highest weight;
- exact `.class` token matches contribute evidence;
- exact selector equality is only a weak fallback when no id/class evidence exists, and does not by itself bypass the safe-selector requirement for direct writes.

For each requested property Monument scans matching rule blocks and collects literal declaration candidates.

Direct mode requires exactly one candidate for each property.

If two responsive scopes both define `.hero { padding-top: ... }`, direct mode refuses to guess which scope the user intends.

## 6. CSS structural scanner

M2.1 does not use regex as a CSS parser and does not add a runtime dependency merely to obtain a first direct lane.

The Rust scanner is a bounded state machine that tracks:
- comments;
- quoted strings;
- escapes;
- braces;
- declaration semicolons;
- function parentheses.

It extracts leaf rule blocks and declaration value byte ranges while ignoring delimiters inside comments/strings/functions.

This is deliberately not advertised as a complete CSS AST. Unsupported/ambiguous constructs must lower the direct-edit hit rate, not weaken safety.

## 7. Value proof

A requested direct value is refused if it contains unsafe structural delimiters or malformed string/function balance.

The source declaration's current literal must match the live `before` value after conservative whitespace/case normalization. Zero-unit equivalence such as `0` vs `0px` is allowed.

Important boundary:

A source value like `var(--hero-space)` does **not** directly match runtime `32px`. The resolver classifies that as assisted/token-backed rather than replacing the variable reference with a literal and silently destroying the design system.

## 8. Dry-run and commit

Frontend `Apply` first invokes:

- `project_source_transaction_preview`

If and only if the result is deterministic for the entire bounded change set, frontend invokes:

- `project_source_transaction_commit`

The native commit does not trust the preview result. It:
1. canonicalizes the project root again;
2. runs the resolver again against current files;
3. requires deterministic mode again;
4. requires one source file for the entire batch;
5. rejects symlink/non-file targets;
6. canonicalizes the target and verifies it remains inside project root;
7. verifies every resolved byte range still contains the expected original literal;
8. applies replacements from highest byte offset to lowest;
9. re-runs structural CSS validation on the new file content;
10. writes a `create_new` temporary file in the same directory;
11. flushes and `sync_all`s it;
12. preserves source permissions;
13. atomically renames it over the original source file.

If source changed between resolution and write, commit fails rather than rebasing/guessing.

## 9. Native capability boundary

Both transaction commands are registered in the Tauri app command manifest and explicitly allowed only in the privileged `main` capability:

- `allow-project-source-transaction-preview`
- `allow-project-source-transaction-commit`

The remote preview capability is unchanged. It receives no source transaction permission.

The preview remains a bounded data producer, never an authority to mutate source.

## 10. Timeline generation model

Direct visual edits are first-class code generations, but they are not Codex turns.

Generation namespace:
- positive serials: Codex generations;
- negative serials: direct Visual Editor generations;
- zero: unbound/invalid sentinel.

A visual serial is generated from time plus a small local counter and stored in a Timeline checkpoint with:

- `kind: visual`;
- no Codex thread id;
- no Codex turn id;
- a human title derived from selected element + changed properties;
- a bounded detail record containing source path and property deltas.

This prevents collisions with future Codex turn serials while allowing the same evidence ledger to bind checks/browser/review/Ship to the exact source generation.

## 11. Transaction handoff safety

Frontend tracks three distinct transient states:

### Dirty source transaction

Native source changed but Timeline checkpoint has not successfully completed yet.

Ship blocks.

### Unacknowledged visual checkpoint

Timeline checkpoint exists, but the main product state has not yet refreshed and acknowledged that exact checkpoint as current.

Ship blocks so stale UI state can never accidentally certify the previous generation.

### Validation lock

The current visual generation is running its post-edit evidence cycle.

A second direct source transaction is refused until the first generation settles.

The App also publishes a source-mutation orchestration lock while Codex, Prompt Queue dispatch, Timeline operations, deterministic verification, browser capture or Fresh Review are actively changing/verifying project state. Direct writes refuse to start under that lock.

## 12. Post-edit engineering chain

A successful direct transaction dispatches `monument:source-transaction` synchronously.

The main product loop then:
1. starts the visual validation lock;
2. closes stale Ship state;
3. invalidates previous Fresh Review UI state;
4. refreshes Version Timeline to the exact visual checkpoint;
5. runs deterministic verification for the visual generation;
6. respects existing per-project Auto checks consent;
7. refreshes project inspection;
8. if a live preview is running, clears old browser evidence buffer;
9. allows HMR to settle;
10. captures fresh browser runtime/console/network evidence for the same negative visual generation;
11. releases the validation/source-mutation lock.

A direct edit therefore uses the same proof-oriented product loop as Codex work without pretending the edit was a Codex turn.

## 13. Ship semantics

Ship treats any non-zero generation serial as generation-bound.

It still requires exact equality between the current Timeline generation and:
- deterministic verification evidence;
- browser evidence when required;
- Fresh Review checkpoint;
- pending work/agent state.

Ship additionally blocks if any direct source transaction is:
- dirty/uncheckpointed;
- checkpointed but not yet acknowledged by the main Timeline state;
- still inside the visual validation lock.

## 14. Current user-facing behavior

Properties `Apply` now has two outcomes.

### Direct

Example status:

`Applied directly · 1 source change · src/styles/hero.css`

The change is already in real source, is a Timeline version and enters evidence processing.

### Codex fallback

Example status:

`Codex fallback queued for source update`

This is expected, not an error. Ambiguous/token/structural cases keep the stronger reasoning path.

The user-facing source confidence card remains separate from the native write proof so a friendly UI hint can never silently become write authority.

## 15. Explicitly not implemented in M2.1

These remain future work and must not be described as direct today:
- CSS variable/token scope editing;
- design-token picker and local/global/instance scope choice;
- Tailwind utility replacement;
- JSX/TSX literal style edits;
- simple component prop/variant editing;
- className composition edits;
- styled-components/emotion/CSS-in-JS ownership;
- CSS Modules semantic ownership beyond literal CSS scan;
- responsive breakpoint authoring UI;
- multi-file direct transaction;
- direct text transaction;
- drag resize/spacing handles;
- multi-select/reparent/reorder;
- AST-aware assisted-choice preview UI.

All of these currently fall back to Codex or remain non-direct editor work.

## 16. CI / regression contract

M2.1 must remain covered by:
- Rust unit tests inside `source_transaction.rs`;
- `visual-editor-source-edit.test.js` hybrid direct/fallback contract;
- `visual-editor-source-transaction.test.js` trust-boundary contract;
- `check_native_source.mjs` command/ACL/atomic-write/release contract;
- TypeScript compile;
- Vite production build;
- `cargo test --all-targets` on Intel macOS CI.

Static contracts explicitly guard:
- command registration and ACL;
- no interpolated shell execution;
- bounded scan constants;
- re-resolution before commit;
- symlink/root containment;
- create-new temp file + fsync + atomic rename;
- visual generation namespace;
- evidence binding;
- transaction validation/orchestration lock;
- Ship handoff safety;
- Codex fallback remains available.

## 17. Next M2 slices

Priority after M2.1:
1. token-aware CSS variable ownership and explicit scope choice;
2. literal CSS dry-run UI with source snippet/diff before commit where useful;
3. Tailwind class parser + safe utility replacement;
4. JSX/TSX literal style and simple prop ownership;
5. AST-backed component text editing;
6. component prop/variant extraction;
7. responsive breakpoint ownership and explicit scope UI;
8. design-system token picker;
9. direct canvas handles built on the same transaction engine;
10. multi-property/multi-node transaction planning once atomic multi-file semantics are proven.

## 18. Product standard

Direct editing is a performance optimization over a proof system, not an excuse to bypass the engineering system.

The correct hierarchy is:

> **Prove ownership → mutate source atomically → bind generation → collect evidence. Otherwise use Codex.**
