import importlib.util, pathlib, sys
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('queue',root/'queue.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
q=m.Queue(); assert q.enqueue('a',1) is True; assert q.enqueue('a',2) is False; assert q.items == [('a',1)]; assert q.enqueue('b',3) is True
