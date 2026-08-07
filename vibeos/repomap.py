from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from .utils import dump_json, utc_now

SKIP_DIRS = {".git", "node_modules", ".next", "dist", "build", "coverage", ".venv", "venv", "__pycache__", ".vibeos/cache"}
MANIFESTS = {
    "package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod", "Gemfile", "composer.json",
    "pom.xml", "build.gradle", "Makefile", "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
}
EXT_LANG = {
    ".py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript/React", ".js": "JavaScript", ".jsx": "JavaScript/React",
    ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".php": "PHP", ".java": "Java", ".kt": "Kotlin", ".swift": "Swift",
    ".css": "CSS", ".scss": "SCSS", ".html": "HTML", ".vue": "Vue", ".svelte": "Svelte", ".sql": "SQL",
}


def _skip(path: Path, root: Path) -> bool:
    rel = path.relative_to(root)
    parts = rel.parts
    return any(part in SKIP_DIRS for part in parts)


def build_map(root: Path) -> dict[str, Any]:
    languages: Counter[str] = Counter()
    manifests: list[str] = []
    test_files: list[str] = []
    important_dirs: set[str] = set()
    file_count = 0

    for path in root.rglob("*"):
        if _skip(path, root):
            continue
        if path.is_dir():
            if path.parent == root and not path.name.startswith("."):
                important_dirs.add(path.name)
            continue
        file_count += 1
        rel = path.relative_to(root).as_posix()
        if path.name in MANIFESTS:
            manifests.append(rel)
        lang = EXT_LANG.get(path.suffix.lower())
        if lang:
            languages[lang] += 1
        low = rel.lower()
        if any(token in low for token in ("/test", "/tests", ".test.", ".spec.", "_test.")):
            if len(test_files) < 200:
                test_files.append(rel)

    package_scripts: dict[str, str] = {}
    pkg = root / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            package_scripts = {str(k): str(v) for k, v in data.get("scripts", {}).items()}
        except (json.JSONDecodeError, OSError):
            pass

    return {
        "generated_at": utc_now(),
        "file_count": file_count,
        "languages": dict(languages.most_common()),
        "manifests": sorted(manifests),
        "top_level_dirs": sorted(important_dirs),
        "tests_sample": sorted(test_files),
        "package_scripts": package_scripts,
    }


def write_map(root: Path) -> Path:
    target = root / ".vibeos" / "cache" / "repo-map.json"
    dump_json(target, build_map(root))
    return target
