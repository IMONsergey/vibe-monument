# Visual Editor M2.2 — Token-aware CSS editing

Status: implementation complete on active branch; merge gated by exact-head CI.
Branch: `monument/visual-editor-m2-token-editing`.
PR: #41.

## 1. Product objective

M2.2 makes common token-backed CSS properties source-native without weakening Monument's proof model.

Core invariant:

> **Prove property ownership → prove material scope → expose conservative blast-radius evidence → ask for explicit scope when material → dry-run exact source intent → re-prove natively → mutate source atomically → bind the exact visual generation to evidence/review/Ship. Otherwise use Codex.**

There is no durable preview-only CSS or token state.

## 2. End-to-end flow

For source such as:

```css
#hero-card {
  gap: var(--space-4);
}
```

Properties performs:

1. user changes one supported visual property;
2. debounced native probe proves one non-conditional selected-property owner;
3. native host extracts one simple custom-property reference;
4. native host discovers bounded token definitions and source references;
5. independent token-scope inspection cross-checks the blast-radius evidence;
6. Properties shows token/source/scope choices;
7. user chooses `This element`, proven local scope, global token, or Codex;
8. global choice always requires explicit confirmation;
9. native dry-run returns exact source intent;
10. commit re-runs ownership/scope resolution and never trusts frontend preview output;
11. one atomic source write occurs;
12. one `kind: visual` Timeline checkpoint is created;
13. stale Browser Evidence is invalidated;
14. exact-generation checks/browser evidence run;
15. Fresh Review + Ship continue against the same generation.

## 3. Native commands

### Read-only scope inspection

`project_token_scope_inspect(projectPath, token)`

Returns bounded definition/reference evidence and remains a generic token-inspection primitive.

### Selected-property probe

`project_token_edit_probe(projectPath, selection, change)`

Returns:
- eligibility/reason;
- exact selected-property source owner;
- token name;
- definitions with path/line/selector/current value;
- global/scoped classification;
- conditional ancestry signal;
- selected-scope proof for scoped definitions;
- conservative source-reference count;
- truncation state;
- true single-instance eligibility.

### Transaction preview

`project_token_transaction_preview(projectPath, selection, change, decision)`

Returns exact scope/path/line/selector/source-before/source-after and bounded source-reference evidence when safe.

### Transaction commit

`project_token_transaction_commit(projectPath, selection, change, decision)`

Commit independently re-runs probe + decision resolution before source mutation.

## 4. Scope semantics

### 4.1 This element

`This element` is stricter than ordinary selector ownership.

It is deterministic only when all are true:
- selected live element has an id;
- preview proves that id is unique in the current document;
- exact source owner is non-conditional;
- exact source owner is id-owned and reaches native id-owner confidence;
- source scan is not truncated;
- selected-property ownership is unique.

Eligible example:

```css
#hero-card { gap: var(--space-4); }
```

can become:

```css
#hero-card { gap: 24px; }
```

A class-owned rule such as `.card` never receives single-element authority because it may affect multiple instances. Duplicate live ids also disable it.

Monument never synthesizes a selector from untrusted preview strings.

### 4.2 Local scope

A scoped custom-property definition is directly editable only when:
- it is non-conditional;
- its selector is independently proven against the selected element;
- the chosen exact path/line/selector/old value remains current at commit.

A local class/component scope may intentionally affect multiple instances and is therefore not represented as `This element`.

### 4.3 Global token

Definitions owned by `:root`, `html` or `html:root` are global.

**Every global token mutation requires explicit confirmation, regardless of observed source-reference count.**

Reason: source-reference count does not claim exact live impact through cascade, inheritance or runtime composition.

Properties cross-checks blast-radius evidence through two independent native paths:
- selected-property transaction probe;
- generic token-scope inspector.

It uses the conservative maximum and propagates truncation. UI language calls this `source refs`, not exact affected elements.

### 4.4 Responsive / conditional scope

M2.2 tracks at-rule ancestry.

Selected-property owners inside `@media` or other conditional/nested at-rules do not receive direct token authority. Conditional token definitions remain visible as evidence but are read-only.

Breakpoint-aware authoring is a separate future gate.

### 4.5 Use Codex

Codex remains available at all times and is mandatory for unsupported, ambiguous, truncated, conditional or structural cases.

## 5. Token reference grammar

The deterministic M2.2 source owner supports one simple custom-property reference.

The bounded scanner recognizes normal CSS trivia around `var()`:
- case-insensitive `var` function spelling;
- whitespace after `(`;
- CSS comments as trivia;
- exact custom-property boundary so `--space` is not confused with `--space-large`.

Fallback expressions, nested token graphs, `calc(var(...))`, Sass/Less variables, CSS-in-JS and JS/TS theme objects remain outside M2.2 direct authority.

## 6. Trust and write boundary

### Preview

Remote preview may emit bounded visual evidence including `idUnique`.

It receives no source-write, filesystem, process, Git, Codex or generic system permission.

`idUnique` is evidence only; Rust independently decides whether single-instance authority exists.

### Bounded scanning

- max 800 plain CSS files;
- max 1.5 MB/file;
- max 16 MB total scan;
- bounded selector/value/definition/reference payloads;
- generated/vendor directories skipped;
- symlink discovery entries skipped.

Truncation removes deterministic write authority.

### Commit

Native commit:
- re-runs property/token ownership resolution;
- requires exact chosen path/line/selector/previous value;
- requires explicit confirmation for every global mutation;
- requires selected-scope proof for local mutation;
- refuses conditional direct mutation;
- refuses symlink/non-file targets;
- canonicalizes target and requires containment inside canonical root;
- checks exact current replacement range/value;
- validates bounded balanced CSS replacement grammar;
- structurally validates updated CSS;
- writes create-new temp in same directory;
- flushes + `sync_all`;
- preserves permissions;
- atomically renames over target;
- uses no shell interpolation and no blind regex mutation.

The product-level orchestration locks from M2.1 also prevent overlapping Monument writes/checks/review operations.

## 7. Properties UX

A token-backed single-property draft exposes:
- `Token-backed` badge;
- token name;
- exact selected-property source path/line;
- conservative source-reference count;
- native reasoning copy;
- `This element` only when true unique-instance proof exists;
- eligible local scopes;
- non-conditional global definitions;
- explicit Codex route;
- always-required global confirmation;
- bounded source before/after preview;
- responsive/conditional read-only warning;
- truncated-scan refusal.

Default selection is narrowest proven safe scope:
1. unique-instance detach;
2. selected local scope;
3. otherwise Codex.

Global mutation is never default.

## 8. Timeline / evidence / Ship integration

Token writes use the same direct-edit generation pipeline as literal CSS:

- source-mutation/race preflight;
- clean exact Timeline provenance;
- native dry-run + native commit;
- `markSourceTransactionDirty`;
- stale Browser Evidence invalidation;
- `checkpointVisualSourceTransaction`;
- negative direct-visual generation identity;
- `recordSourceTransactionCheckpoint`;
- `monument:source-transaction`;
- exact-generation verification/browser capture;
- Fresh Review;
- Ship gate.

No separate token history model exists.

## 9. Regression / production contracts

Rust coverage includes:
- token ownership and source-reference discovery;
- valid `var()` whitespace/comment/case handling;
- unique-id-only instance detach;
- class-owned instance refusal;
- duplicate-live-id refusal;
- global confirmation even with one observed ref;
- selected local-scope proof;
- duplicate property-owner refusal;
- responsive selected-property refusal;
- conditional token-definition refusal.

Node/source contracts include:
- main-only command permissions;
- preview unique-id evidence propagation;
- native unique-instance authority;
- explicit token scope UX;
- count-independent global confirmation;
- independent blast-radius cross-check;
- responsive/conditional refusal;
- exact source preview;
- Timeline/evidence handoff;
- literal M2.1 preservation;
- Codex fallback preservation.

`npm run check:native` executes the dedicated token-editing contract alongside the existing native source contract.

## 10. Deliberately outside M2.2

- Tailwind utility/theme mutation;
- JSX/TSX literal style/simple prop mutation;
- component text AST mutation;
- className composition editing;
- Sass/Less variables;
- CSS-in-JS ownership;
- JS/TS theme objects;
- arbitrary token alias graphs;
- fallback/calc token expressions;
- breakpoint authoring;
- multi-file atomic transactions;
- arbitrary selector synthesis;
- project-wide searchable token picker.

## 11. Definition of Done

M2.2 core is merge-ready only when the exact final PR head has:
- green TypeScript/source contracts;
- green dedicated token production contract;
- green Node regression suite;
- green production Vite build;
- green Rust tests / `cargo test --all-targets` on Intel CI;
- complete token-backed Properties scope UX;
- conservative source-reference blast-radius evidence;
- unique-instance/local/global deterministic paths;
- explicit confirmation for every global mutation;
- native re-resolution on commit;
- responsive/conditional refusal;
- atomic source write;
- exact Timeline/evidence/Fresh Review/Ship handoff;
- no new preview source-write authority;
- aligned master + deep specs.

## 12. Next gate

M2.3 is one large module: **Tailwind utility ownership + JSX/TSX literal style/simple-prop ownership + unified source routing**.

The goal is to reduce Codex fallback substantially on modern React/Tailwind projects while preserving the same proof-driven transaction architecture.
