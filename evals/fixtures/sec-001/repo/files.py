from pathlib import Path

def resolve_upload(root: str, user_path: str) -> Path:
    return Path(root) / user_path
