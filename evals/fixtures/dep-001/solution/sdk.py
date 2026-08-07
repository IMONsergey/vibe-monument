class Client:
    VERSION = 2
    def get(self, resource: str, *, timeout: int = 5):
        return {'resource': resource, 'timeout': timeout}
