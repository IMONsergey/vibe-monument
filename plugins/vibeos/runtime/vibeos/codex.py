from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any

from .utils import dump_json, sha256_file

PLUGIN_NAME = "vibeos"
MARKETPLACE_NAME = "imon-vibeos"


def _safe_link(target: str, dest: Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_symlink():
        if os.readlink(dest) == target:
            return f"ok {dest}"
        dest.unlink()
    elif dest.exists():
        return f"preserved real path {dest}"
    dest.symlink_to(target, target_is_directory=True)
    return f"linked {dest} -> {target}"


def install_codex_repo_layout(root: Path) -> list[str]:
    """Expose canonical repository skills to Codex while keeping one source of truth."""
    return [_safe_link("../skills", root / ".agents" / "skills")]


def _source_hashes(root: Path) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for src in sorted((root / "skills").rglob("*")):
        if src.is_file():
            hashes[src.relative_to(root / "skills").as_posix()] = sha256_file(src)
    return hashes


def build_codex_plugin(root: Path) -> dict[str, Any]:
    """Build the repository marketplace plugin in the layout used by openai/plugins."""
    plugin_root = root / "plugins" / PLUGIN_NAME
    if plugin_root.exists():
        shutil.rmtree(plugin_root)
    (plugin_root / ".codex-plugin").mkdir(parents=True)

    # Skills are copied into the distributable plugin. Supporting contracts are bundled
    # because skills may point to these files while the plugin is installed from cache.
    shutil.copytree(root / "skills", plugin_root / "skills")
    shutil.copytree(root / "agents", plugin_root / "agents")
    shutil.copytree(root / "workflows", plugin_root / "workflows")
    shutil.copytree(root / "policies", plugin_root / "policies")
    shutil.copytree(root / "templates", plugin_root / "templates")
    shutil.copy2(root / "AGENTS.md", plugin_root / "AGENTS.md")
    shutil.copy2(root / "LICENSE", plugin_root / "LICENSE")

    # Bundle the dependency-free project runtime so repo-bootstrap can install
    # the full control plane from an installed Codex plugin.
    runtime_root = plugin_root / "runtime"
    shutil.copytree(root / "vibeos", runtime_root / "vibeos", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (runtime_root / "bin").mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / "bin" / "vibeos", runtime_root / "bin" / "vibeos")
    shutil.copytree(root / "workflows", runtime_root / "workflows")
    shutil.copytree(root / "policies", runtime_root / "policies")
    shutil.copytree(root / "templates", runtime_root / "templates")
    shutil.copytree(root / "agents", runtime_root / "agents")
    shutil.copytree(root / "context", runtime_root / "context")
    shutil.copy2(root / "AGENTS.md", runtime_root / "AGENTS.md")
    (runtime_root / ".vibeos").mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / ".vibeos" / "router.toml", runtime_root / ".vibeos" / "router.toml")
    if (root / ".vibeos" / "schemas").exists():
        shutil.copytree(root / ".vibeos" / "schemas", runtime_root / ".vibeos" / "schemas")
    config_template = (root / ".vibeos" / "config.toml").read_text(encoding="utf-8")
    import re
    config_template = re.sub(r'^project_name\s*=.*$', 'project_name = "UNCONFIGURED"', config_template, flags=re.MULTILINE)
    config_template = re.sub(r'^mode\s*=.*$', 'mode = "project"', config_template, flags=re.MULTILINE)
    for key in ("install", "dev", "lint", "typecheck", "test", "build", "e2e"):
        config_template = re.sub(rf'^{key}\s*=.*$', f'{key} = ""', config_template, flags=re.MULTILINE)
    (runtime_root / ".vibeos" / "config.template.toml").write_text(config_template, encoding="utf-8")

    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    manifest = {
        "name": PLUGIN_NAME,
        "version": version,
        "description": "Codex-native risk routing, evidence gates, fresh-context review, memory hygiene, and live UI QA.",
        "author": {
            "name": "IMON",
            "url": "https://github.com/IMONsergey"
        },
        "homepage": "https://github.com/IMONsergey/vibe-monument",
        "repository": "https://github.com/IMONsergey/vibe-monument",
        "license": "MIT",
        "keywords": ["codex", "agent-skills", "software-engineering", "code-review", "visual-qa", "evals"],
        "skills": "./skills/",
        "interface": {
            "displayName": "IMON VibeOS",
            "shortDescription": "Codex-native engineering OS with evidence gates",
            "longDescription": "A Codex-native engineering operating layer: route work by risk, keep context focused, implement verifiable slices, collect evidence, use fresh-context review, and perform live visual QA.",
            "developerName": "IMON",
            "category": "Developer Tools",
            "capabilities": ["Interactive", "Read", "Write"],
            "websiteURL": "https://github.com/IMONsergey/vibe-monument",
            "defaultPrompt": [
                "Route this task with VibeOS and implement it in Codex.",
                "Review this change using VibeOS evidence gates."
            ],
            "brandColor": "#111111",
            "screenshots": []
        }
    }
    dump_json(plugin_root / ".codex-plugin" / "plugin.json", manifest)
    hashes = _source_hashes(root)
    dump_json(plugin_root / ".vibeos-source-hashes.json", hashes)

    marketplace = {
        "name": MARKETPLACE_NAME,
        "interface": {"displayName": "IMON VibeOS for Codex"},
        "plugins": [{
            "name": PLUGIN_NAME,
            "source": {"source": "local", "path": "./plugins/vibeos"},
            "policy": {
                "installation": "AVAILABLE",
                "authentication": "ON_INSTALL",
                "products": ["CODEX"]
            },
            "category": "Developer Tools"
        }]
    }
    dump_json(root / ".agents" / "plugins" / "marketplace.json", marketplace)
    return {"plugin_root": str(plugin_root.relative_to(root)), "skills": len(hashes), "version": version}


def codex_status(root: Path) -> dict[str, Any]:
    plugin_root = root / "plugins" / PLUGIN_NAME
    manifest = plugin_root / ".codex-plugin" / "plugin.json"
    market = root / ".agents" / "plugins" / "marketplace.json"
    repo_skills = root / ".agents" / "skills"
    return {
        "repository_skills": str(repo_skills.relative_to(root)) if repo_skills.exists() else None,
        "plugin": str(plugin_root.relative_to(root)) if manifest.exists() else None,
        "marketplace": str(market.relative_to(root)) if market.exists() else None,
        "codex_only": True,
    }
