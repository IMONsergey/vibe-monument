---
name: accessibility-review
description: "Review a user-facing change for practical accessibility failures using live behavior and DOM semantics. Use for material UI work before shipping, especially forms, navigation, dialogs, interactive controls, keyboard flows, or content with contrast/state changes."
---

# Accessibility review

Use the running product when possible.

1. Walk the primary flow with keyboard only: focus order, visible focus, traps, escape/close behavior, and unreachable controls.
2. Inspect semantic roles/names for interactive elements; prefer native elements over ARIA reconstruction.
3. Check labels, instructions, validation/error association, disabled/loading states, and status announcements where behavior changes dynamically.
4. Check color contrast and that meaning is not conveyed only by color.
5. Check touch target practicality and zoom/reflow at the configured mobile viewport.
6. Check reduced-motion behavior for material animation.
7. Use automated accessibility tooling if the host provides it, but treat automated results as partial coverage.
8. Record actionable findings and evidence; re-test fixed states.

Do not turn accessibility review into generic style critique; report failures tied to real user interaction or recognized semantics.
