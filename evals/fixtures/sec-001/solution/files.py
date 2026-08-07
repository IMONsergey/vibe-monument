from pathlib import Path

def resolve_upload(root: str, user_path: str) -> Path:
    base = Path(root).resolve()
    candidate = (base / user_path).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise ValueError('path escapes upload root') from exc
    return candidate
