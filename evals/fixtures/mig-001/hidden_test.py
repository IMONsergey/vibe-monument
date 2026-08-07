import importlib.util, pathlib, sys
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('migrate',root/'migrate.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
a={'name':'Ada'}; b=m.migrate(a); assert a == {'name':'Ada'}; assert b == {'display_name':'Ada','schema_version':2}; assert m.migrate(b)==b
c={'schema_version':2,'display_name':'Grace','extra':1}; assert m.migrate(c)==c
