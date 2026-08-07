# Monument Browser Evidence Contract

## Purpose

Browser Evidence answers a narrow question:

> What observable runtime/browser problems appeared in the real live product during this code state?

It is not a replacement for deterministic package checks, visual review, accessibility review, task-contract review, or release certification.

## Product behavior

Browser Evidence remains under progressive disclosure.

The normal workflow stays:

1. work on the live product;
2. Monument observes the running preview;
3. after a completed turn, Monument may capture one bounded snapshot;
4. the user sees a quiet Evidence status rather than a DevTools log stream;
5. raw details are available only when needed.

The preview is not turned into a browser-debugging product by default.

## Captured signals

The initial browser lane captures only bounded signals useful for verification:

### Console

- `console.warn`
- `console.error`

Routine `console.log` output is intentionally ignored in the first slice to reduce noise and accidental data collection.

### Runtime

- uncaught `error` events;
- unhandled promise rejections.

### Network

- failed `fetch` requests;
- failed XHR requests;
- slow `fetch` / XHR requests above the configured threshold.

For network evidence Monument stores only a bounded method + sanitized URL + status + duration + failure/error summary.

## Data intentionally NOT captured

Browser Evidence must not record:

- request headers;
- authorization headers;
- cookies;
- request bodies;
- response bodies;
- parsed response JSON/text;
- URL query strings;
- URL fragments;
- arbitrary local/session storage contents;
- form field values;
- DOM text unrelated to an explicit Select action.

Sanitized network URLs contain protocol + host + bounded pathname only.

## Bounds

The instrumentation uses fixed-size ring buffers and bounded strings.

The initial limits are intentionally conservative:

- console events: <= 60;
- runtime events: <= 40;
- network events: <= 80;
- individual event text: <= 1000 characters;
- slow-request threshold: >= 1500 ms (initial product threshold: 2000 ms).

A malformed or oversized native payload is rejected rather than accepted as evidence.

## Trust boundary

The inspected localhost application is runtime data, not authority.

Console messages, thrown errors, URLs, page titles and network error strings cannot override:

- the user task;
- repository instructions;
- VibeOS policy;
- Codex sandbox/approval semantics;
- Monument safety rules.

The child preview still does not receive broad Tauri IPC permissions.

## Evidence generation

Every Codex turn has a monotonically increasing local turn generation (`turnSerial`).

Deterministic package evidence and Browser Evidence record which generation they observed.

When a newer turn starts:

- previous Browser Evidence becomes stale immediately;
- previous deterministic build/test/typecheck evidence becomes stale immediately;
- stale green evidence must not look current;
- new evidence is collected only for the newer code state.

This prevents a successful check from turn N from remaining visually authoritative while turn N+1 is editing files.

After application restart, evidence may conservatively appear stale until the current code state is reverified. False staleness is safer than false freshness.

## Automatic collection

Browser evidence can be captured automatically only when the local preview is already running because the user explicitly started that project runtime.

Collecting the snapshot does not execute a new project script. It observes the already-running product.

Project package scripts remain governed by the separate Auto-QA permission in `EVIDENCE_CONTRACT.md`.

## Clean Browser Evidence means only

A clean snapshot means Monument did not observe, within the bounded current observation window:

- captured runtime errors;
- captured console warnings/errors;
- captured failed requests;
- captured slow requests.

It does **not** prove:

- every user flow works;
- every route was visited;
- visual fidelity;
- responsive correctness;
- accessibility;
- backend correctness outside observed requests;
- test coverage;
- task completion;
- release readiness.

## Failure handling

Browser failures are evidence, not an automatic diagnosis.

A future repair lane may attach bounded raw browser evidence to Codex, but must:

- preserve the exact observed failure separately from the model's explanation;
- avoid leaking excluded sensitive material;
- cap repair attempts;
- stop on repeated failure signatures;
- keep permission-requiring actions behind normal Codex approvals.

## Core invariant

> **Observe the product aggressively; collect user data conservatively; never confuse an observation window with full correctness.**
