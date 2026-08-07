from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class GuardResult:
    decision: str
    reasons: tuple[str, ...]


DENY_PATTERNS = [
    (r"(^|\s)rm\s+-rf\s+/(?:\s|$)", "recursive deletion of filesystem root"),
    (r"(^|\s)mkfs(?:\.|\s)", "filesystem formatting"),
    (r"(^|\s)dd\s+.*\bof=/dev/", "raw device overwrite"),
]
CONFIRM_PATTERNS = [
    (r"\bgit\s+reset\s+--hard\b", "destructive git reset"),
    (r"\bgit\s+clean\s+-[^\n]*[fd]", "deleting untracked files"),
    (r"\bgit\s+push\b[^\n]*(--force|-f\b)", "force push"),
    (r"\brm\s+-r[f]?\b", "recursive deletion"),
    (r"\bDROP\s+(TABLE|DATABASE|SCHEMA)\b", "destructive SQL"),
    (r"\bTRUNCATE\s+TABLE\b", "destructive SQL"),
    (r"\bterraform\s+destroy\b", "infrastructure destruction"),
    (r"\bkubectl\s+delete\b", "cluster deletion"),
    (r"\b(?:npm|pnpm|yarn|bun)\s+publish\b", "package publication"),
    (r"\bgh\s+release\s+create\b", "release publication"),
]


def classify(command: str) -> GuardResult:
    reasons: list[str] = []
    for pattern, reason in DENY_PATTERNS:
        if re.search(pattern, command, flags=re.IGNORECASE):
            reasons.append(reason)
    if reasons:
        return GuardResult("DENY", tuple(reasons))
    for pattern, reason in CONFIRM_PATTERNS:
        if re.search(pattern, command, flags=re.IGNORECASE):
            reasons.append(reason)
    if reasons:
        return GuardResult("CONFIRM", tuple(reasons))
    return GuardResult("ALLOW", ())
