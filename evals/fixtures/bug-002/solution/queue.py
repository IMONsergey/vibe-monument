class Queue:
    def __init__(self): self.items=[]; self._ids=set()
    def enqueue(self, job_id, payload):
        if job_id in self._ids: return False
        self._ids.add(job_id); self.items.append((job_id,payload)); return True
