from __future__ import annotations

from dataclasses import dataclass
from typing import Any


SIGNALS = (
    "unclear_acceptance",
    "public_api_or_contract",
    "data_model_or_migration",
    "auth_permissions_security",
    "destructive_or_irreversible",
    "production_or_billing",
    "multi_module",
    "user_facing_ui",
    "external_dependency_change",
    "novel_or_unfamiliar_code",
    "incident_or_outage",
)

INTENT_MAP = {
    "fast": "FAST_PATCH",
    "fast_patch": "FAST_PATCH",
    "build": "BUILD",
    "bug": "BUG",
    "ui": "UI",
    "research": "RESEARCH",
    "epic": "EPIC",
    "review": "REVIEW",
    "ship": "SHIP",
    "migration": "MIGRATION",
    "dependency": "DEPENDENCY",
    "incident": "INCIDENT",
}


@dataclass(frozen=True)
class RouteResult:
    workflow: str
    risk: int
    reasons: tuple[str, ...]
    required_skills: tuple[str, ...]
    conditional_skills: tuple[str, ...]
    fresh_review: bool
    security_review: bool
    require_full_spec: bool


def route_task(router: dict[str, Any], config: dict[str, Any], intent: str, active_signals: set[str]) -> RouteResult:
    intent_key = intent.lower().strip()
    if intent_key not in INTENT_MAP:
        raise ValueError(f"unknown intent: {intent}")

    workflows = router["workflows"]
    hard_routes = router.get("hard_routes", {})
    weights = router.get("risk_weights", {})
    reasons: list[str] = []

    workflow = INTENT_MAP[intent_key]
    for signal in active_signals:
        if signal not in SIGNALS:
            raise ValueError(f"unknown signal: {signal}")

    # Deterministic hard-route precedence: live incident dominates migration,
    # migration dominates ordinary dependency work. Never depend on set order.
    hard_precedence = ("incident_or_outage", "data_model_or_migration", "external_dependency_change")
    for signal in hard_precedence:
        if signal in active_signals and signal in hard_routes:
            workflow = hard_routes[signal]
            reasons.append(f"hard route: {signal} -> {workflow}")
            break

    # UI intent should stay UI unless a stronger hard route applies.
    if "user_facing_ui" in active_signals and workflow in {"FAST_PATCH", "BUILD"}:
        workflow = "UI"
        reasons.append("user-facing UI requires live visual QA")

    base = int(workflows[workflow].get("base_risk", 0))
    signal_risk = sum(int(weights.get(s, 0)) for s in active_signals)
    risk = max(0, min(100, base + signal_risk))

    thresholds = config.get("routing", {})
    fast_max = int(thresholds.get("fast_patch_max_risk", 20))
    if workflow == "FAST_PATCH" and risk > fast_max:
        workflow = "UI" if "user_facing_ui" in active_signals else "BUILD"
        base = int(workflows[workflow].get("base_risk", 0))
        risk = max(0, min(100, base + signal_risk))
        reasons.append(f"risk exceeded FAST_PATCH threshold ({fast_max})")

    if not reasons:
        reasons.append(f"intent {intent_key} mapped to {workflow}")
    for signal in sorted(active_signals):
        reasons.append(f"risk signal: {signal} (+{weights.get(signal, 0)})")

    wf = workflows[workflow]
    full_spec = risk >= int(thresholds.get("full_spec_min_risk", 45)) or workflow in {"MIGRATION", "EPIC"}
    fresh_review = risk >= int(thresholds.get("fresh_review_min_risk", 30)) or workflow in {"REVIEW", "SHIP", "MIGRATION", "INCIDENT"}
    security_review = risk >= int(thresholds.get("security_review_min_risk", 50)) or "auth_permissions_security" in active_signals

    return RouteResult(
        workflow=workflow,
        risk=risk,
        reasons=tuple(reasons),
        required_skills=tuple(wf.get("core_skills", [])),
        conditional_skills=tuple(wf.get("conditional_skills", [])),
        fresh_review=fresh_review,
        security_review=security_review,
        require_full_spec=full_spec,
    )
