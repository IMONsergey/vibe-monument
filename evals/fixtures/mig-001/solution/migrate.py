def migrate(record: dict) -> dict:
    out = dict(record)
    version = out.get('schema_version', 1)
    if version >= 2:
        return out
    if 'display_name' not in out and 'name' in out:
        out['display_name'] = out['name']
    out.pop('name', None)
    out['schema_version'] = 2
    return out
