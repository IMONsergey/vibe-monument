# Visual Editor M2.2 — Token-aware CSS editing

Status: implementation complete on active branch; merge gated by exact-head CI.
Branch: `monument/visual-editor-m2-token-editing`.
PR: #41.

## Product objective

Increase the Visual Editor direct-edit hit rate for real design systems without weakening Monument's proof-driven source-authority model.

M2.1 correctly refuses direct mutation when a selected property is backed by `var(--token)`. M2.2 adds the missing scope/blast-radius decision and a dedicated deterministic source transaction.

The product rule is:

> **Never mutate a shared design token just because one selected element changed. Prove token ownership, show blast radius, require an explicit material scope choice, re-prove on commit, then bind the result to the normal engineering chain.**

## End-to-end product flow

For a supported property whose proven source is a simple token reference such as:

```css
.card {
  gap: var(--space-4);
}
```

Properties now performs:

1. user edits the live computed property draft;
2. Monument debounces a native token ownership probe;
3. native host proves one selected-property CSS owner;
4. native host extracts one simple `var(--token)` reference;
5. native host discovers bounded definitions + usages;
6. Properties shows the token, source owner and blast radius;
7. user chooses one material scope:
   - **This element**;
   - **Local scope**;
   - **Global token**;
   - **Use Codex**;
8. global shared mutation requires explicit confirmation;
9. Monument runs native transaction preview;
10. commit re-runs all ownership/scope proof instead of trusting the frontend preview;
11. native host performs one atomic source write;
12. Monument creates a `kind: visual` Timeline generation;
13. stale Browser Evidence is invalidated;
14. normal generation-bound verification / Browser Evidence runs;
15. Fresh Review and Ship continue to use the same exact generation identity.

There is no preview-only persistent style or token state.

## Implemented native commands

### Existing read-only scope inspector

`project_token_scope_inspect(projectPath, token)`

Returns bounded custom-property definitions/usages and remains useful as a generic token-inspection primitive.

### M2.2 selected-property probe

`project_token_edit_probe(projectPath, selection, change)`

Returns:

- whether token editing is eligible;
- exact selected property source owner;
- token name;
- token definitions with path / line / selector / current value;
- global vs scoped definition classification;
- whether each scoped definition is proven against selected id/class evidence;
- bounded usage count;
- truncation state;
- whether instance detachment is eligible.

### M2.2 dry-run

`project_token_transaction_preview(projectPath, selection, change, decision)`

Returns the exact chosen source path, selector, line, source-before/source-after, scope and affected usage count when the transaction is safe.

### M2.2 commit

`project_token_transaction_commit(projectPath, selection, change, decision)`

Commit independently re-runs probe and decision resolution. Frontend preview output is never write authority.

## Scope semantics

### This element / instance detach

When one exact selected rule is proven with id/class ownership evidence, Monument may replace:

```css
gap: var(--space-4);
```

with the requested literal value in that same proven declaration.

This intentionally detaches only that selected source rule from the token. Monument does not synthesize a new selector from preview strings.

### Local scope

A scoped custom-property definition is directly editable only when its selector itself has strong id/class evidence for the selected element.

Example:

```css
.card {
  --space-4: 12px;
  gap: var(--space-4);
}
```

The local definition can be offered as an explicit choice. An unrelated `.other { --space-4: ... }` definition is visible as evidence but receives no deterministic write authority for the selected `.card`.

### Global token

Definitions owned by `:root`, `html`, or `html:root` are global.

Global mutation is always an explicit choice. When more than one bounded usage is proven, Apply is physically disabled until the user confirms the shared blast radius.

### Use Codex

Codex remains available at all times and is the mandatory fallback when deterministic proof is missing, truncated, ambiguous or structurally unsupported.

## Safety boundaries

### Bounded scanning

- maximum 800 plain CSS files;
- maximum 1.5 MB per file;
- maximum 16 MB total scan budget;
- bounded selectors, values, definitions and usages;
- common generated/vendor directories skipped;
- symlink directory/file entries skipped during discovery.

A truncated scan cannot grant deterministic mutation authority.

### Ownership

- safe id/class evidence required;
- property owner selector score must contain proven id/class evidence;
- exactly one selected property owner is required;
- duplicate owners are refused, never ranked into authority;
- only one simple `var(--token)` reference is deterministic in this gate;
- token fallbacks, calc/alias expression ownership and other token expression graphs remain Codex-backed.

### Chosen token definition

Commit requires the exact chosen:

- source path;
- source line;
- selector;
- previous value.

A stale or ambiguous target is rejected and must be reselected against current source.

### Shared-token protection

A global token with more than one proven usage cannot be mutated unless `confirmSharedGlobal` is explicitly true.

Scoped token mutation requires `selectedScope === true` from native selector proof.

### Filesystem / write boundary

Commit:

- canonicalizes project root;
- checks target with `symlink_metadata`;
- refuses symlink and non-file targets;
- canonicalizes target and requires it to remain inside canonical root;
- rechecks the exact replacement range/source value;
- validates the requested CSS value with bounded balanced grammar;
- validates the full resulting CSS structure;
- writes a create-new temp file in the same directory;
- flushes and `sync_all`s;
- preserves permissions;
- atomically renames temp over the source target;
- uses no interpolated shell and no blind regex replacement.

## Properties UX implemented

A token-backed single-property draft gets a dedicated source-native card containing:

- `Token-backed` badge;
- token name;
- exact selected property source path + line;
- bounded usage count;
- native recommendation/context;
- explicit scope choices;
- local definition source/value details;
- global definition source + blast-radius details;
- required shared-global confirmation;
- source before/after preview;
- explicit Codex fallback.

Default choice is the narrowest proven safe scope:

1. This element, when instance detachment is proven;
2. a selected local scope when instance ownership is unavailable;
3. otherwise Codex.

Global mutation is never the default.

Token probing is debounced so ordinary property typing does not synchronously block the product UI.

## Timeline / evidence / Ship integration

Token writes do not create a parallel history model.

They use the same direct Visual Editor handoff as literal source transactions:

- `markSourceTransactionDirty`;
- stale Browser Evidence invalidation;
- `checkpointVisualSourceTransaction`;
- negative direct-visual generation serial;
- `recordSourceTransactionCheckpoint`;
- `monument:source-transaction` event;
- App generation-bound verification / browser capture;
- Fresh Review;
- Ship gate.

The handoff also carries token name, selected scope and affected usage count for human-readable product feedback.

## Regression / production contracts

### Rust unit coverage

`token_transaction.rs` covers:

- token ownership + blast-radius discovery;
- instance detachment;
- shared global confirmation;
- selected local-scope proof;
- duplicate selected property-owner refusal.

`token_scope.rs` separately covers exact token-name usage matching so `--space` is not confused with `--space-large`.

### Node regression contract

`tests/visual-editor-token-editing.test.js` locks:

- native safety primitives;
- command registration / trusted-main capability;
- explicit scope UX;
- shared-global confirmation;
- source preview;
- Timeline/evidence handoff;
- preservation of literal direct editing and Codex fallback.

### Production source contract

`npm run check:native` now runs both:

- `scripts/check_native_source.mjs`;
- `scripts/check_token_editing.mjs`.

The token contract checks production command registration, capability isolation, source-write safety, UI and generation handoff.

## Deliberately not claimed by M2.2 core

- Tailwind theme/token mutation;
- Sass/Less variables;
- CSS-in-JS tokens;
- JS/TS theme objects;
- arbitrary token alias graphs;
- `calc(var(...))` ownership;
- token fallback expression mutation;
- responsive breakpoint authoring;
- multi-file atomic token transactions;
- arbitrary selector synthesis;
- searchable project-wide token replacement picker.

A searchable token catalog/picker is a product extension on top of this safe mutation foundation, not a prerequisite for making existing token-backed Properties source-native.

## Definition of Done

M2.2 core is complete when the exact PR head has:

- green TypeScript check;
- green production token contract;
- green Node regression suite;
- green Vite production build;
- green Rust unit tests / `cargo test --all-targets` on Intel CI;
- token-backed Properties scope UX;
- visible blast radius;
- deterministic instance/local/global transaction paths;
- explicit shared-global confirmation;
- native re-resolution on commit;
- atomic source write;
- exact Timeline/evidence/Fresh Review/Ship handoff;
- Codex fallback for every unsupported/ambiguous case;
- no new preview source-write permission;
- no hidden editor-only source of truth.

## Product standard

The correct hierarchy is:

> **Prove scope → expose blast radius → ask only when the choice is material → preview exact source intent → re-prove natively → mutate source atomically → bind evidence. Otherwise use Codex.**
