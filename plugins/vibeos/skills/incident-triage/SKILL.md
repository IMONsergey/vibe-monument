---
name: incident-triage
description: "Triage an active production-like incident or outage while minimizing blast radius and preserving evidence. Use when service availability, data integrity, security, billing, or a live user-critical path is currently failing."
---

# Incident triage

Prioritize containment and evidence over elegant refactoring.

1. State observed impact, start time if known, affected scope, and current user/business risk.
2. Preserve logs/metrics/errors and identify the last known good state/change.
3. Choose the safest reversible mitigation first: disable a feature, rollback, shed load, or isolate a failing dependency when authorized.
4. Separate mitigation from root-cause investigation.
5. Keep a timestamped incident artifact using `templates/INCIDENT.md`.
6. Do not perform destructive data repair or credential changes without explicit approval.
7. After stabilization, reproduce/localize root cause and add a regression guard.
8. Close with impact, timeline, cause confidence, mitigation, permanent fix, and follow-up prevention work.
