class Queue:
    def __init__(self): self.items=[]
    def enqueue(self, job_id, payload): self.items.append((job_id,payload))
