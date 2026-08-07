import importlib.util, pathlib, sys
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('slug',root/'slug.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
assert m.slugify('Hello, World!') == 'hello-world'
assert m.slugify('  Café déjà vu  ') == 'cafe-deja-vu'
assert m.slugify('A---B___C') == 'a-b-c'
assert m.slugify('') == ''
