from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .config import load_config, load_router
from .memory import lint_memory
from .utils import sha256_file

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LOCAL_REF_RE = re.compile(r"`((?:templates|policies|workflows|context|\.vibeos)/[^`\n]+)`")
RUNTIME_REF_PREFIXES = (".vibeos/cache/", ".vibeos/state/", ".vibeos/evidence/")

FRAMEWORK_REQUIRED = [
    "README.md", "README_RU.md", "AGENTS.md", "LICENSE", "VERSION", "CHANGELOG.md", "SECURITY.md",
    ".vibeos/config.toml", ".vibeos/router.toml", ".agents/plugins/marketplace.json",
    "plugins/vibeos/.codex-plugin/plugin.json",
    "context/PROJECT.md", "context/DOMAIN.md", "context/ARCHITECTURE.md", "context/DEFINITION-OF-DONE.md",
    "policies/CONTEXT.md", "policies/MEMORY.md", "policies/QUALITY_GATES.md", "policies/SECURITY.md", "policies/AUTONOMY.md", "policies/GIT.md",
    "policies/TRUST_ZONES.md", "policies/EVIDENCE.md", "policies/UI_QUALITY.md",
    "templates/SPEC.md", "templates/PLAN.md", "templates/EXECUTION_PACKET.md", "templates/REVIEW_PACKET.md", "templates/HANDOFF.md", "templates/LEARNING.md",
    "templates/TASK_CONTRACT.md", "templates/EVIDENCE.md", "templates/INCIDENT.md", "templates/MIGRATION.md",
    "evals/SCORECARD.md", "evals/ROUTING_CASES.jsonl", "evals/replay/PUBLIC_REPLAY_SEEDS.jsonl",
]

PROJECT_REQUIRED = [
    "AGENTS.md", "AGENTS.vibeos.md", "bin/vibeos", "vibeos/cli.py",
    ".vibeos/config.toml", ".vibeos/router.toml",
    "context/PROJECT.md", "context/DOMAIN.md", "context/ARCHITECTURE.md", "context/DEFINITION-OF-DONE.md",
    "policies/CONTEXT.md", "policies/MEMORY.md", "policies/QUALITY_GATES.md", "policies/SECURITY.md", "policies/AUTONOMY.md", "policies/GIT.md",
    "policies/TRUST_ZONES.md", "policies/EVIDENCE.md", "policies/UI_QUALITY.md",
    "templates/SPEC.md", "templates/PLAN.md", "templates/EXECUTION_PACKET.md", "templates/REVIEW_PACKET.md", "templates/HANDOFF.md", "templates/LEARNING.md",
    "templates/TASK_CONTRACT.md", "templates/EVIDENCE.md", "templates/INCIDENT.md", "templates/MIGRATION.md",
]


def _frontmatter(text: str) -> tuple[dict[str, str], int]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("missing YAML frontmatter")
    end = None
    for i, line in enumerate(lines[1:], 1):
        if line.strip() == "---":
            end = i
            break
    if end is None:
        raise ValueError("unterminated YAML frontmatter")
    meta: dict[str, str] = {}
    for line in lines[1:end]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, end


def _validate_no_alt_agent_surfaces(root: Path, errors: list[str]) -> None:
    for forbidden in ("CLAUDE.md", ".claude", ".cursor", "adapters"):
        if (root / forbidden).exists():
            errors.append(f"non-Codex active surface present: {forbidden}")


def _validate_skills(root: Path, errors: list[str], warnings: list[str]) -> tuple[set[str], int]:
    skills_dir = root / "skills"
    skill_names: set[str] = set()
    skill_files = 0
    if not skills_dir.exists():
        errors.append("missing skills/ directory")
        return skill_names, skill_files

    for skill_dir in sorted(p for p in skills_dir.iterdir() if p.is_dir()):
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            errors.append(f"{skill_dir.name}: missing SKILL.md")
            continue
        skill_files += 1
        text = skill_file.read_text(encoding="utf-8")
        try:
            meta, end = _frontmatter(text)
        except ValueError as exc:
            errors.append(f"{skill_dir.name}: {exc}")
            continue
        name = meta.get("name", "")
        desc = meta.get("description", "")
        if name != skill_dir.name:
            errors.append(f"{skill_dir.name}: frontmatter name is {name!r}")
        if not NAME_RE.fullmatch(name) or len(name) > 64:
            errors.append(f"{skill_dir.name}: invalid skill name")
        if name in skill_names:
            errors.append(f"duplicate skill name: {name}")
        skill_names.add(name)
        if not desc:
            errors.append(f"{skill_dir.name}: missing description")
        elif len(desc) > 1024:
            errors.append(f"{skill_dir.name}: description exceeds 1024 characters")
        lines = text.splitlines()
        if len(lines) > 350:
            warnings.append(f"{skill_dir.name}: SKILL.md has {len(lines)} lines; consider progressive disclosure")
        if len(lines[end + 1:]) < 3:
            warnings.append(f"{skill_dir.name}: suspiciously small skill body")
        for rel in LOCAL_REF_RE.findall(text):
            clean = rel.rstrip(".,;:")
            if clean.startswith(RUNTIME_REF_PREFIXES):
                continue
            if not (root / clean).exists():
                errors.append(f"{skill_file.relative_to(root)} references missing file: {clean}")
        for stale in (".vibeos/config.yaml", ".vibeos/router.yaml"):
            if stale in text:
                errors.append(f"{skill_file.relative_to(root)} still references v1 path {stale}")
    return skill_names, skill_files


def _validate_codex_package(root: Path, errors: list[str]) -> None:
    repo_skills = root / ".agents" / "skills"
    if not repo_skills.exists():
        errors.append("missing Codex repository skills surface: .agents/skills")
    elif repo_skills.is_symlink() and not repo_skills.resolve().exists():
        errors.append("broken Codex skill symlink: .agents/skills")

    plugin_root = root / "plugins" / "vibeos"
    hashes_file = plugin_root / ".vibeos-source-hashes.json"
    manifest_file = plugin_root / ".codex-plugin" / "plugin.json"
    marketplace_file = root / ".agents" / "plugins" / "marketplace.json"
    if not hashes_file.exists() or not manifest_file.exists() or not marketplace_file.exists():
        errors.append("Codex plugin/marketplace is incomplete; run `vibeos codex build-plugin`")
        return

    expected = json.loads(hashes_file.read_text(encoding="utf-8"))
    actual: dict[str, str] = {}
    for src in sorted((root / "skills").rglob("*")):
        if src.is_file():
            actual[src.relative_to(root / "skills").as_posix()] = sha256_file(src)
    if expected != actual:
        errors.append("Codex plugin is stale relative to canonical skills; run `vibeos codex build-plugin`")

    try:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        if manifest.get("name") != "vibeos":
            errors.append("Codex plugin manifest has unexpected name")
        if manifest.get("skills") != "./skills/":
            errors.append("Codex plugin manifest must expose ./skills/")
        capabilities = set(manifest.get("interface", {}).get("capabilities", []))
        if not {"Interactive", "Read", "Write"}.issubset(capabilities):
            errors.append("Codex plugin manifest must expose Interactive/Read/Write capabilities")
        if not (plugin_root / "runtime" / "bin" / "vibeos").exists():
            errors.append("Codex plugin is missing bundled project runtime")
        if not (plugin_root / "skills" / "repo-bootstrap" / "scripts" / "install-runtime.py").exists():
            errors.append("Codex plugin is missing bundled repo-bootstrap installer")
    except json.JSONDecodeError as exc:
        errors.append(f"Codex plugin manifest invalid JSON: {exc}")

    try:
        market = json.loads(marketplace_file.read_text(encoding="utf-8"))
        entries = [p for p in market.get("plugins", []) if p.get("name") == "vibeos"]
        if len(entries) != 1:
            errors.append("Codex marketplace must contain exactly one vibeos plugin entry")
        else:
            entry = entries[0]
            if entry.get("source", {}).get("path") != "./plugins/vibeos":
                errors.append("Codex marketplace path must be ./plugins/vibeos")
            if entry.get("policy", {}).get("products") != ["CODEX"]:
                errors.append("Codex marketplace plugin must be scoped to products=[CODEX]")
    except json.JSONDecodeError as exc:
        errors.append(f"Codex marketplace invalid JSON: {exc}")


def run_doctor(root: Path) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        config = load_config(root)
        router = load_router(root)
    except Exception as exc:
        return {"errors": [f"config parse failure: {exc}"], "warnings": [], "stats": {}}

    mode = str(config.get("mode", "framework"))
    if mode not in {"framework", "project"}:
        errors.append(f"unknown VibeOS mode: {mode}")
    required = FRAMEWORK_REQUIRED if mode == "framework" else PROJECT_REQUIRED
    for rel in required:
        if not (root / rel).exists():
            errors.append(f"missing required file: {rel}")

    if int(config.get("version", 0)) != 2:
        errors.append("config.toml version must be 2")
    if int(router.get("version", 0)) != 2:
        errors.append("router.toml version must be 2")
    if config.get("runtime") != "codex" or config.get("codex_only") is not True:
        errors.append("VibeOS 2 active config must declare runtime='codex' and codex_only=true")

    kernel_path = root / ("AGENTS.md" if mode == "framework" else "AGENTS.vibeos.md")
    if kernel_path.exists() and len(kernel_path.read_bytes()) > 16 * 1024:
        warnings.append(f"{kernel_path.name} exceeds 16 KiB; always-loaded kernel is becoming too large")

    _validate_no_alt_agent_surfaces(root, errors)

    skill_names: set[str] = set()
    skill_files = 0
    if mode == "framework":
        skill_names, skill_files = _validate_skills(root, errors, warnings)

    workflows = router.get("workflows", {})
    for name, definition in workflows.items():
        if not (root / "workflows" / f"{name}.md").exists():
            errors.append(f"router references missing workflow file: workflows/{name}.md")
        if mode == "framework":
            for key in ("core_skills", "conditional_skills"):
                for skill in definition.get(key, []):
                    if skill not in skill_names:
                        errors.append(f"router {name} references missing skill: {skill}")

    if mode == "framework":
        _validate_codex_package(root, errors)
    else:
        agents = root / "AGENTS.md"
        if agents.exists():
            text = agents.read_text(encoding="utf-8")
            if "<!-- IMON-VIBEOS-CODEX:BEGIN -->" not in text:
                warnings.append("project AGENTS.md has no managed VibeOS Codex pointer block")

    project_name = str(config.get("project_name", ""))
    commands = config.get("commands", {})
    if project_name == "UNCONFIGURED":
        warnings.append("project is not bootstrapped; run `./bin/vibeos bootstrap`")
    if not any(str(v).strip() for v in commands.values()):
        warnings.append("no project commands detected/configured")

    mem = lint_memory(root, int(config.get("memory", {}).get("volatile_fact_max_age_days", 7)))
    errors.extend(mem["errors"])
    warnings.extend(mem["warnings"])

    routing_cases = 0
    replay_cases = 0
    if mode == "framework":
        cases = root / "evals" / "ROUTING_CASES.jsonl"
        if cases.exists():
            for line_no, line in enumerate(cases.read_text(encoding="utf-8").splitlines(), 1):
                if not line.strip():
                    continue
                routing_cases += 1
                try:
                    row = json.loads(line)
                    if row.get("expected") not in workflows:
                        errors.append(f"routing case line {line_no}: unknown expected workflow {row.get('expected')}")
                except json.JSONDecodeError as exc:
                    errors.append(f"routing case line {line_no}: invalid JSON: {exc}")
        replay_file = root / "evals" / "replay" / "PUBLIC_REPLAY_SEEDS.jsonl"
        if replay_file.exists():
            replay_cases = sum(1 for line in replay_file.read_text(encoding="utf-8").splitlines() if line.strip())

    return {
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "mode": mode,
            "skills": skill_files,
            "workflows": len(workflows),
            "routing_cases": routing_cases,
            "replay_seeds": replay_cases,
        },
    }
