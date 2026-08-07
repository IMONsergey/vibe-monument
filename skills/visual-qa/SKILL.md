---
name: visual-qa
description: "Audit a running user-facing interface for visual, responsive, interaction, accessibility and runtime quality. Use after material frontend/UI changes or before shipping a website; do not substitute static code inspection for live-browser evidence."
---

# Live visual QA

1. Launch/use the real local preview or test environment.
2. Identify the changed routes/components and intended design reference.
3. Exercise the primary interaction path before judging appearance.
4. Check configured viewports from `.vibeos/config.toml`; add project-specific sizes if needed.
5. Inspect:
   - hierarchy and information priority;
   - spacing, rhythm, grid, alignment;
   - typography and readable density;
   - color/contrast and theme consistency;
   - responsive reflow, overflow and touch targets;
   - states: loading, empty, error, disabled, success;
   - focus/keyboard basics and accessible naming where applicable;
   - motion and reduced-motion behavior where applicable;
   - copy clarity;
   - obvious generic AI/SaaS patterns that conflict with the product's visual language.
6. Check browser console and relevant network failures.
7. Capture screenshots for material changes, ideally before/after or reference/final.
8. Record findings under `work/visual-qa/` using `templates/VISUAL_QA.md`.
9. After fixes, re-open/re-capture the affected states; do not assume CSS edits solved the issue.

A screenshot proves appearance at one state/viewport only. It does not prove interactions, accessibility or runtime health.
