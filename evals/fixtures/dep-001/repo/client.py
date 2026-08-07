from sdk import Client

def load(resource: str):
    return Client().fetch(resource)
