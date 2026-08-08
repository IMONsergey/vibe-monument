# Visual Editor M2.1 — CSS Custom Property Scope Transactions

Status: **active stacked gate after M2 deterministic literal CSS v1**.

## Goal

Make existing CSS custom properties editable from Properties without flattening a design system by accident.

M2.1 does not treat `var(--token)` like a raw literal. It introduces an explicit scope choice:

- **This element** — replace the selected element's exact `property: var(--token)` reference with the requested literal value, leaving the token unchanged;
- **Token `--name` (global)** — change one proved global `:root` token definition, intentionally affecting every use of that token.

## Core invariant

> Monument never silently turns an instance visual edit into a global token edit.

The user must see and choose the source scope before any token-backed source mutation.

## Deterministic token v1 proof chain

Direct token editing is available only when all of these are true:

1. the live selected DOM element has an ID proven unique in the current preview;
2. exactly one supported plain-CSS declaration with rightmost `#id` owns the requested property;
3. its value is exactly one simple custom-property reference `var(--token)` with no fallback or `!important` tail;
4. exactly one supported global definition exists as a literal declaration under an exact `:root` rule;
5. that global token definition is a balanced literal and does not itself contain `var(...)`;
6. the token literal normalizes to the live computed `before` value;
7. the requested `after` value passes the same balanced-literal safety rules as M2 direct CSS;
8. current Timeline checkpoint and product-work coordination gates are still clean/idle.

If any proof is missing, token editing remains Codex-backed.

## Scope plans

### This element / detach

Before:

```css
#hero {
  padding-top: var(--space-xl);
}
```

Requested live value: `32px`.

After:

```css
#hero {
  padding-top: 32px;
}
```

`--space-xl` is unchanged everywhere else.

### Token / global

Before:

```css
:root {
  --space-xl: 24px;
}
```

After:

```css
:root {
  --space-xl: 32px;
}
```

The UI must label this as global and show an approximate bounded usage count before commit.

## Source safety

Both scopes use the M2 transaction invariants:

- dry-run first;
- exact file fingerprint;
- exact byte range;
- source-path containment;
- symlink refusal;
- re-plan before apply;
- exact old value at range;
- safe balanced replacement value;
- same-directory atomic temp write + sync + rename;
- immediate Version Timeline checkpoint;
- proved reverse transaction if checkpoint creation fails;
- checkpoint-bound verification/browser evidence after success.

Token mutation uses a dedicated native re-plan path; the frontend cannot forge a token plan and pass it directly to a generic writer.

## Deliberate v1 limitations

M2.1 v1 does **not** directly edit:

- fallback references such as `var(--x, 24px)`;
- nested token chains such as `--a: var(--b)`;
- scoped variables outside exact `:root`;
- duplicate token definitions;
- theme classes/data attributes;
- CSS-in-JS variables;
- SCSS variables;
- Tailwind theme values;
- computed token values whose literal representation does not normalize to the live computed value (for example a hex token observed by the browser as `rgb(...)`).

Those cases keep the existing Codex fallback until the relevant resolver is proven.

## UX

When a token chain is proved, Properties shows:

- token name;
- current global definition path:line;
- approximate bounded usage count;
- source before/after for **This element**;
- source before/after for **Token --name (global)**;
- explicit scope selection;
- Apply source;
- Use Codex.

Global scope is never preselected merely because a token exists. Default should favor the lower-blast-radius element scope.

## Definition of Done

- native `visual_token_plan` returns both scope dry-runs only after the full proof chain;
- native `visual_token_apply` replans and applies only the user-selected proved scope;
- token write commands are main-webview only;
- preview remains data-only;
- Properties renders the two scopes distinctly;
- changing draft/selection invalidates prepared token plans;
- commit rechecks live unique-ID scope and exact base checkpoint;
- Version/evidence/rollback flow is reused from M2;
- ambiguity and unsupported token forms route to Codex;
- Rust and Node contracts cover detach/global/stale/ambiguous cases;
- Intel native CI is green before merge.
