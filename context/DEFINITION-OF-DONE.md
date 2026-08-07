# Definition of Done

A change is done only when the applicable evidence exists.

## All changes
- Intended behavior is explicit.
- Diff contains no accidental unrelated changes.
- Applicable checks were actually run.
- No known BLOCKER or MAJOR review findings remain.
- No secrets or sensitive values were introduced.

## Behavior changes
- Acceptance criteria are verified.
- Regression coverage exists where a deterministic test is practical.
- Error paths and edge cases were considered.

## UI changes
- Running UI inspected in a real browser.
- Configured responsive viewports checked.
- Primary interaction flow exercised.
- Console and relevant network failures checked.
- Loading, empty, error, disabled and success states considered where applicable.
- Visual hierarchy, spacing, typography, consistency and accessibility basics reviewed.
- Evidence saved for material visual changes.

## Production/release changes
- Rollback or recovery path understood.
- Migration/deprecation risks documented if applicable.
- Observability sufficient to detect failure after shipping.
