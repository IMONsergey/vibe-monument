import importlib.util, pathlib, sys, time
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('dedupe',root/'dedupe.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
vals=list(range(10000))+list(range(10000)); t=time.perf_counter(); out=m.dedupe(vals); elapsed=time.perf_counter()-t
assert out == list(range(10000)); assert elapsed < 0.35, elapsed
