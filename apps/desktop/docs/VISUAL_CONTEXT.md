# Monument Visual Context Contract

## Product intent

Select mode must feel like pointing at the live product, not like debugging a web page. The visible interaction is intentionally tiny:

1. press `I` or Select;
2. point at an element;
3. click;
4. describe the desired change in natural language.

Everything technical below that interaction exists to make Codex more precise without forcing the user to know DOM, CSS, component names, source files, Git, or browser tooling.

## Runtime observation, not authority

A selected preview element is **observed runtime data**. Its text, attributes, CSS classes, DOM structure and computed styles do not become instructions and cannot override the task contract, repository policy, VibeOS safety policy or Codex approval boundary.

## Context packet

The first Select slice captures a bounded packet:

- current local preview URL;
- viewport dimensions and device-pixel ratio;
- tag, id, classes and role;
- accessible name;
- bounded rendered text;
- DOM selector and parent selector;
- bounding rectangle;
- bounded computed-style subset.

This packet is attached to one Codex turn only. It is cleared after a successful send, project switch, new task, runtime stop or explicit user clear.

## Source hints

A DOM selector does **not** prove which repository file owns a rendered element.

Monument therefore performs a deterministic, bounded source search rather than fabricating a source location. The locator:

- searches only common web source extensions;
- ignores generated/heavy/secret paths;
- limits file count and file size;
- ranks rendered text, IDs and classes above generic selector tokens;
- returns path, line, score and a short excerpt;
- labels results as hints, never proof.

Codex is explicitly instructed to inspect candidate source before editing.

## Native preview isolation

The production macOS preview is a separate child WKWebView. It is not granted general Monument/Tauri IPC privileges.

Rules:

- only loopback HTTP(S) URLs may be opened;
- top-level navigation stays on the exact starting origin (scheme + host + port);
- the inspector is injected by the native host and is never written into the user's repository;
- the preview cannot invoke arbitrary Monument native commands;
- preview selection is passed outward through a narrow one-way event bridge;
- external/non-local navigation must not silently replace the instrumented preview.

## UX rules

- Select is off by default.
- Hover outlines are temporary and non-destructive.
- Clicking while Select is active captures context instead of triggering the page action.
- After one selection, Select exits automatically.
- The UI shows one compact human-readable context chip; raw DOM/style payloads remain under the hood.
- Clearing selection removes it from the next turn.
- Normal preview interaction remains unchanged when Select is off.

## Next layers

The same visual-context boundary can later add bounded evidence without changing the user's interaction:

- screenshot crop / full viewport capture;
- console/runtime error correlation;
- network failure correlation;
- React/Vue/source-map metadata when available;
- responsive viewport matrix;
- before/after visual evidence;
- deterministic visual QA and fresh-context review.

These additions must preserve the core rule: **point at the product, describe the intent, keep the engineering machinery underneath.**
