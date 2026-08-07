# Monument Design System — v0.1

The product deliberately does not copy private ChatGPT/OpenAI design tokens. It uses an independent system built around similar product-quality principles: calm contrast, progressive disclosure, strong typography, low-noise hierarchy, and fast keyboard ergonomics.

## Foundations

### Color roles

```css
--bg:        #f3f3f0;  /* desktop chrome */
--surface:   #fafaf8;  /* primary panels */
--surface-2: #f6f6f3;  /* secondary areas */
--surface-3: #ecece8;  /* selected/hovered */
--ink:       #181816;  /* primary text */
--muted:     #74746d;  /* secondary text */
--line:      rgba(24,24,22,.09);
--signal:    #d9f56a;  /* active work only */
--good:      #2d7954;
--warn:      #9a6718;
```

The signal color is intentionally scarce. It marks active agent work, selected product context, or another state that deserves immediate attention. It is not a general brand fill.

### Typography

Use the native platform stack first. On macOS the UI should feel at home with SF Pro Text characteristics without bundling proprietary font files.

- UI labels: 10–12 px
- normal UI body: 12–13 px
- task titles: 16–18 px
- hero/marketing surfaces inside preview are project-owned, not Monument typography
- code/terminal: native monospaced stack

### Geometry

- default control radius: 8 px
- panel radius: 12–14 px
- modal/floating surface: 14–18 px
- controls are 27–32 px high in dense work surfaces
- avoid card grids unless cards represent real independent objects

### Borders and shadows

Prefer one-pixel low-alpha borders. Shadows are reserved for surfaces floating above the app plane: preview frame, popovers, dialogs, command palette. Persistent sidebars should not cast shadows.

## Interaction rules

1. Product canvas gets the most pixels.
2. Tools collapse when not actively useful.
3. Hover may reveal affordances; critical state must never depend on hover.
4. Every mouse action used repeatedly needs a keyboard path.
5. Loading and agent activity are local to the object doing work — no global spinner unless the app itself is blocked.
6. Avoid celebratory UI for routine success. Quiet green verification is enough.
7. Approvals are explicit and visually distinct from ordinary chat messages.
8. Destructive operations require a clear object + consequence + scope.

## Motion

Motion communicates continuity rather than decoration.

- panel open/close: 160–220 ms
- selection transitions: 120–180 ms
- no spring overshoot on routine workspace chrome
- preserve user context when switching Preview ↔ Code or Desktop ↔ Mobile
- respect reduced motion

## Density

Monument is information-dense but not visually busy. The default state should show only:
- current project/task;
- primary artifact;
- Codex progress and input;
- state required to understand whether work is safe/complete.

Everything else is one action away.
