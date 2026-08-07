# Autonomy Policy

## Supervised — default

Routine inspection/edit/test operations may proceed within the approved task contract. High-impact actions stop at the human gate.

## Bounded autonomous

Allowed only with:

- enforced sandbox/container or equivalently constrained workspace;
- scoped writable paths and least-privilege credentials;
- no unattended production authority by default;
- bounded network/tool permissions;
- explicit iteration/time/retry limits;
- deterministic or observable success/stop criteria;
- isolated branch/worktree where practical.

Never use permission-bypass flags for unattended execution on an unsandboxed personal/work machine.

Stop when the same failure remains after two materially different attempts, evidence invalidates the plan, permissions are missing, a new irreversible decision appears, or scope expands beyond contract.
