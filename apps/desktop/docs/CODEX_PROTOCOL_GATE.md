# Monument Codex Protocol Gate

This document is a product/runtime invariant, not a future wish list.

## Goal

Monument must feel simple while remaining an exact client of the installed Codex `app-server` protocol. The UI may translate protocol details into product language, but it must never invent approval semantics or silently auto-approve a request it does not understand.

## Implemented gate

- native Codex binary/version discovery;
- runtime generation of the installed binary's JSON Schema bundle via `codex app-server generate-json-schema`;
- bidirectional JSON-RPC handling (client requests, server responses, server notifications, server-initiated requests);
- bounded retry with jitter for app-server ingress saturation (`-32001`);
- current `turn/start` text input shape without legacy `textElements`;
- command execution approvals;
- file-change approvals;
- granular permission requests;
- `request_user_input` questions;
- safe decline/cancel fallback for MCP elicitations that Monument cannot render exactly;
- `serverRequest/resolved` cleanup;
- real command/file activity projection from item lifecycle events;
- inline human-facing approval/question UX;
- Diagnostics surface showing actual Codex version and schema-generation compatibility;
- `account/read` projection into product state;
- Codex-managed ChatGPT sign-in via `account/login/start`, with the auth URL opened by a bounded macOS HTTPS-only system command;
- login/account notifications that recover the composer automatically after authentication.

## Hard rules

1. Unknown server-initiated requests are never auto-approved.
2. Approval choices shown in the UI are bounded by the choices understood for that request type.
3. Opening a project does not grant permissions or run commands.
4. A protocol mismatch must be visible in Diagnostics rather than silently reinterpreted.
5. Generated protocol output is version-specific and is treated as the compatibility source for the installed Codex binary.
6. Product language may simplify labels, but wire payloads remain protocol-accurate.
7. Monument does not copy or persist ChatGPT/Codex auth tokens; authentication remains owned by Codex.
8. External auth navigation is restricted to HTTPS and uses argv execution, never shell interpolation.

## Next protocol work

- consume generated bindings in development/CI rather than only probing at runtime;
- render supported MCP elicitation schemas;
- expose supported model/reasoning controls only from actual app-server capabilities;
- add deterministic fake app-server fixtures for every server-request lifecycle;
- add explicit login cancellation/logout and auth-expiry recovery surfaces when those paths become necessary in product usage.
