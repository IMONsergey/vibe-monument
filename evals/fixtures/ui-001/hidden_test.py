import pathlib, re, sys
text=(pathlib.Path(sys.argv[1])/'index.html').read_text()
low=text.lower()
assert '<meta name="viewport"' in low
assert '<nav' in low and 'aria-label="primary"' in low
assert '<button' in low and 'type="button"' in low and 'aria-expanded' in low
assert '@media' in low and 'max-width' in low
assert not re.search(r'<div[^>]+onclick=',low)
