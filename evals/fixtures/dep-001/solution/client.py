from sdk import Client

def load(resource: str):
    return Client().get(resource, timeout=5)
