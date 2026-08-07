import importlib.util, pathlib, sys
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('pricing',root/'pricing.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
assert m.cents('1.005') == 101
assert m.cents('2.675') == 268
assert m.cents('0.004') == 0
