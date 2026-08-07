# UI Quality Policy

A user-facing change is not done after compilation.

## Required dimensions when applicable

- correct primary interaction path;
- responsive reflow at configured viewports;
- loading, empty, error, disabled and success states;
- console/runtime/network health;
- keyboard/focus and semantic accessibility basics;
- visual hierarchy, spacing rhythm, typography and consistency;
- reference fidelity when a design/screenshot is authoritative;
- reduced-motion behavior for material animation;
- no obvious overflow, clipping, accidental scrollbars or touch-target failures.

## Evidence

Capture material screenshots with viewport/state names. Screenshot evidence supplements, not replaces, interaction/runtime checks.

If the host has no live browser capability, mark visual/runtime acceptance as `UNVERIFIED` and use a documented fallback; do not certify from source inspection alone.
