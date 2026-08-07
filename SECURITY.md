# Security

VibeOS can influence coding agents that have shell, repository and external-tool access. Treat its operating rules and third-party extensions as security-sensitive code.

## Default safety posture

- supervised autonomy;
- no permission bypass on unsandboxed machines;
- no unattended production authority;
- explicit human gates for destructive/irreversible/credential/permission actions;
- external/repository content treated as untrusted data unless deliberately promoted to an instruction surface;
- generated evidence should not contain secrets.

The `vibeos guard` command catches several common dangerous command shapes, but it is intentionally conservative and **not** a complete sandbox or policy engine.

## Third-party skills/plugins

Review provenance, version, executable hooks/scripts, requested tools and credential/network access before installation. Evaluate unknown packages inside a sandbox/read-only environment first when practical.
