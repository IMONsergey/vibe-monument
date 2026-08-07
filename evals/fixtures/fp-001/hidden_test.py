import importlib.util, pathlib, sys
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('app',root/'app.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
assert m.label() == 'Checkout'
