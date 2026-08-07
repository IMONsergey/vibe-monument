# Browser Evidence QA Matrix

This matrix defines the minimum behavior expected before Browser Evidence can be considered a product gate rather than a logging experiment.

## 1. Clean local page

Given a running trusted localhost preview with no captured warnings/errors/failures:

- capture succeeds;
- current viewport is recorded;
- Browser Evidence shows a quiet clean observation state;
- the UI does not claim the whole task/product is verified;
- query strings/fragments are absent from stored URLs.

## 2. Console warning

When the page calls `console.warn`:

- the bounded message appears under Console;
- normal `console.log` noise is not collected;
- the warning does not automatically become a blocking Ship finding by itself in this gate;
- secret-like values are redacted before leaving the page buffer.

## 3. Console error / runtime exception

When the page produces `console.error`, an uncaught `error`, or `unhandledrejection`:

- the event is captured once in the bounded observation window;
- runtime evidence remains distinct from deterministic build/test evidence;
- error strings are treated as untrusted runtime data;
- no raw stack/request payload is promoted into policy/instructions.

## 4. Failed fetch

When `fetch` rejects or returns a non-OK response:

- method, sanitized URL, status (when available), duration and failure state are captured;
- request headers are not captured;
- request body is not captured;
- response body/text/JSON is not captured;
- URL query/hash is removed.

## 5. Failed XHR

Same privacy and evidence expectations as fetch.

## 6. Slow successful request

A successful fetch/XHR above the slow threshold:

- is recorded as slow, not failed;
- does not expose request/response payloads;
- duration is bounded numeric evidence, not an agent inference.

## 7. Payload bounds

Generate more events than the configured ring-buffer limits:

- old events roll out;
- capture stays bounded;
- snapshot exports only the smaller final observation window;
- oversized native payloads are rejected.

## 8. Secret redaction

Emit messages containing representative patterns:

- `Bearer <token>`;
- JWT-like three-part tokens;
- `sk-...` style keys;
- GitHub token-like strings;
- Slack token-like strings;
- query-string values.

Expected:

- stored browser evidence contains redaction markers rather than original secrets;
- the underlying application behavior is not modified beyond observation wrappers.

## 9. New Codex turn makes evidence stale

After current deterministic/browser evidence exists, start another Codex turn:

- `turnSerial` increments on real `turn/started`;
- previous package checks appear stale immediately;
- previous Browser Evidence appears stale immediately;
- old green states never remain visually current while files are changing.

## 10. Turn completion

After Codex completes:

- deterministic Auto-QA remains governed by per-project permission;
- if preview is running, Browser Evidence can be captured from the already-running product without starting a new package script;
- evidence records the turn generation it belongs to;
- real Git/file snapshot refresh follows verification.

## 11. Auto-QA permission disabled

With automatic package checks disabled:

- turn completion does not execute `npm/pnpm/yarn/bun` checks;
- deterministic evidence becomes permission-required when checks are detected;
- Browser Evidence may still observe the already-running preview;
- enabling Auto-QA remains an explicit user action.

## 12. HMR / full reload

After the dev server reloads the page:

- initialization instrumentation is reinstalled through the native preview script;
- capture does not depend on modifying user source files;
- page reload never grants extra Tauri IPC privileges.

## 13. Preview stopped

When preview is stopped:

- capture action becomes unavailable;
- no background browser evidence polling continues;
- old evidence remains historical/stale rather than being silently deleted.

## 14. Desktop / mobile preview

Capture in both normal viewport modes:

- recorded viewport matches the actual child WKWebView size;
- viewport evidence is observation only;
- this does not yet claim full responsive-matrix verification.

## 15. Application restart

After restarting Monument:

- locally persisted previous evidence can be shown;
- when current turn/code-state identity cannot be proven, evidence is conservatively stale;
- false freshness is never preferred over false staleness.

## 16. Ship remains blocked

Even with:

- deterministic checks passing;
- current Browser Evidence clean;

Ship remains blocked until the later fresh-review/release-readiness gate exists.

## Gate definition

Browser Evidence is complete only when the product can truthfully say:

> **For this code generation and this observed live-preview window, these are the bounded browser/runtime signals Monument actually saw.**

It must never imply:

> **Therefore the whole product is correct.**
