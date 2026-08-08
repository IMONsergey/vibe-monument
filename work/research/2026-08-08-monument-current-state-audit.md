# Research — Monument current-state and supersession audit

Date: 2026-08-08
Decision supported: choose the safe base and architectural boundary for the Product Experience Refoundation.

## Questions

1. What is the actual source-of-truth branch and pull-request chain?
2. Which UI, native, Codex, Timeline, Evidence, Review, Ship, preview, and Intel contracts must survive a redesign?
3. Why is the current interface not salvageable through visual polish?
4. What existing failures must not be misattributed to the refoundation module?

## Findings

### Finding 1 — the active product is a stacked PR chain, not `main`

Status: VERIFIED

- Conclusion: the current active head is `181b5f5c14ec8cd71d4968d9f20f28afd6590fb1` on `monument/alpha-preview-intel`. It is 137 commits ahead of `origin/main` and follows this active chain:
  `main` (`d35944f`) → PR #41 M2.2 → PR #43 M2.3 → PR #46 M2.4 → PR #47 alpha.10.
- Evidence/source: GitHub branch/PR metadata and local `git log`, `git diff origin/main...HEAD`, accessed 2026-08-08.
- Freshness/date: exact at the time of audit; GitHub state can change.
- Project implication: the refoundation preview branches from PR #47's head and its draft PR must target `monument/alpha-preview-intel`. Targeting `main` would create a misleading 10k-line mixed diff.

### Finding 2 — old open work is not equivalent to the active stack

Status: VERIFIED

- Conclusion: PR #18 (old Auto Repair) and PR #28 (old alpha.6 release) are open but predate the active visual-editor/release stack. They are treated as superseded candidates, not as merge inputs. No branch is deleted or force-updated by this work.
- Evidence/source: GitHub PR metadata, bases, heads, dates, and commit ancestry, accessed 2026-08-08.
- Freshness/date: 2026-08-08.
- Project implication: the draft PR will document dependency on #47 and will not merge or rewrite historical branches.

### Finding 3 — the current screen is three products mounted at once

Status: VERIFIED

- Conclusion: `src/main.tsx` mounts `<App />`, `<VisualEditorLayer />`, and `<AlphaPreviewShell />` as siblings. Each owns fixed-position chrome and a separate visual language.
- Evidence/source:
  - `apps/desktop/src/main.tsx`
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/editor/VisualEditorLayer.tsx`
  - `apps/desktop/src/components/AlphaPreviewShell.tsx`
  - `apps/desktop/src/styles/product.css`
  - `apps/desktop/src/styles/visual-editor.css`
  - `apps/desktop/src/styles/alpha-preview.css`
- Freshness/date: head `181b5f5`, audited 2026-08-08.
- Project implication: spacing and color polish cannot solve the information architecture. The redesign must begin as an isolated workspace architecture and must not mutate production mounting yet.

### Finding 4 — persistent technical chrome overwhelms the product

Status: VERIFIED

- Conclusion: the live canvas competes with a permanent Tasks rail, editor Layers, a dense source-native Properties panel, top-level verification/Ship controls, floating composer chips, Timeline, and a separate Command Center. The right panel exposes transaction ownership, raw CSS, token scope, markup lanes, and source diffs before the user asks for them.
- Evidence/source: current React/CSS files listed above, plus `apps/desktop/src/editor/PropertiesPanel.tsx` and the visual-editor contract documents.
- Freshness/date: head `181b5f5`, audited 2026-08-08.
- Project implication: technical truth remains available, but moves behind progressive disclosure. The default surface must be the product itself.

### Finding 5 — the underlying safety architecture is stronger than the current UX

Status: VERIFIED

- Conclusion: source authority, bounded preview data, proof-gated deterministic writes, atomic native commits, generation-bound Timeline/Evidence, Fresh Review, and Intel packaging are explicit contracts. These are not redesign targets.
- Evidence/source:
  - `MASTER_PRODUCT_CONTEXT.md`
  - `NATIVE_BOUNDARY.md`
  - `VISUAL_EDITOR_M2_SOURCE_TRANSACTIONS.md`
  - `VISUAL_EDITOR_M2_TOKEN_SCOPE.md`
  - `VISUAL_EDITOR_M2_MARKUP_OWNERSHIP.md`
  - `EVIDENCE_CONTRACT.md`
  - `FRESH_REVIEW_SHIP_SPEC.md`
  - `RELEASE_CONTRACT.md`
  - `.github/workflows/monument-desktop.yml`
  - `.github/workflows/monument-intel-alpha-release.yml`
- Freshness/date: head `181b5f5`, audited 2026-08-08.
- Project implication: the new UX translates these contracts into plain-language state; it never bypasses or reimplements them.

### Finding 6 — Intel remains a release gate

Status: VERIFIED

- Conclusion: native CI targets `macos-15-intel`; the alpha release workflow builds `x86_64-apple-darwin`, mounts the DMG, checks architecture with `lipo`, and validates signing/plist metadata.
- Evidence/source: GitHub workflows at head `181b5f5`, accessed 2026-08-08.
- Freshness/date: 2026-08-08.
- Project implication: the standalone preview adds no runtime dependency and no native migration. Any later production slice must re-run the x86_64 native gate.

### Finding 7 — the inherited alpha head is not locally green

Status: VERIFIED

- Conclusion: before refoundation edits, `npm run check` and `npm run build` fail at `src/editor/contentEditing.ts:84` because a fallback `mode` widens to `string`; `npm test` reports 68 pass / 13 fail. Exact-head GitHub checks were queued or pending during the audit and were not represented as green.
- Evidence/source: local commands on clean head `181b5f5`, 2026-08-08.
- Freshness/date: 2026-08-08.
- Project implication: these failures are retained as pre-existing evidence. The refoundation preview has a dependency-free contract check so its result is distinguishable from the inherited alpha failures.

## Conflicts / uncertainty

- GitHub check and PR status are mutable; re-check before merge or retargeting.
- PR #18 and #28 are classified as superseded candidates from ancestry and scope, but only the repository owner should close them.
- The active stacked chain is large and some tests appear to assert contracts from adjacent stack layers; this module does not reconcile that stack.

## Recommendation

Build the first refoundation module as a standalone static preview on a branch based on PR #47. Keep production React/Tauri mounting unchanged. Validate the preview independently, publish a draft PR into #47's branch, and require explicit product approval before any migration slice.

## Sources

- GitHub repository: https://github.com/IMONsergey/vibe-monument (accessed 2026-08-08)
- Current head: `181b5f5c14ec8cd71d4968d9f20f28afd6590fb1`
- Local canonical product and contract documents listed in Findings 3–6.
