import importlib.util, pathlib, sys
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('headers',root/'headers.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
assert m.parse_headers(['Content-Type: text/plain',' X-ID : 42 ','bad','X-ID: 43']) == {'content-type':'text/plain','x-id':'43'}
