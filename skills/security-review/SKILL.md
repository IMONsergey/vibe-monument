---
name: security-review
description: "Review a change for security, secrets, trust boundaries and high-impact operations. Use for auth, permissions, user input, external integrations, data storage, dependency changes, migrations, production tooling, or high-risk releases."
---

# Security review

1. Identify assets, trust boundaries, inputs, identities/permissions and external systems touched.
2. Check authentication vs authorization separately.
3. Check input validation/encoding, injection surfaces, path/file handling and unsafe command construction.
4. Check secret handling and logging/telemetry exposure.
5. Check dependency/supply-chain changes and executable third-party hooks/plugins.
6. Check data lifecycle: storage, access, deletion, migration, rollback.
7. Check network/SSRF-like boundaries and external fetch behavior when relevant.
8. For autonomous agents, confirm sandbox, credential, network, writable-path and iteration boundaries.
9. Report evidence-backed findings with `BLOCKER/MAJOR/MINOR/NIT` severity.

Do not approve a high-impact change only because the happy-path tests pass.
