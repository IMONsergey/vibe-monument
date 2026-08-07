def parse_headers(lines: list[str]) -> dict[str,str]:
    out={}
    for line in lines:
        if ':' not in line: continue
        key,value=line.split(':',1)
        key=key.strip().lower(); value=value.strip()
        if key: out[key]=value
    return out
