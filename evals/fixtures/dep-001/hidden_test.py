import pathlib, sys
sys.path.insert(0,str(pathlib.Path(sys.argv[1]))); import client
assert client.load('users') == {'resource':'users','timeout':5}
