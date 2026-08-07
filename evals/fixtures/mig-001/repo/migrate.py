def migrate(record: dict) -> dict:
    record['display_name'] = record.pop('name')
    record['schema_version'] = 2
    return record
