import importlib.util, pathlib, sys, tempfile
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('files',root/'files.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as td:
    base=pathlib.Path(td); safe=m.resolve_upload(td,'nested/a.txt'); assert safe == (base/'nested/a.txt').resolve()
    try: m.resolve_upload(td,'../secret.txt')
    except ValueError: pass
    else: raise AssertionError('traversal accepted')
