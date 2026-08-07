export function createProjection() {
  return {
    thread: null,
    activeTurn: null,
    message: '',
    events: [],
    usage: null,
  };
}

export function projectCodexEvent(projection, message) {
  if (!message?.method) return projection;
  const next = {
    ...projection,
    events: [...projection.events],
  };
  const p = message.params ?? {};

  switch (message.method) {
    case 'thread/started':
      next.thread = p.thread ?? p;
      next.events.push({ type: 'thread', label: 'Session started' });
      break;
    case 'turn/started':
      next.activeTurn = p.turn ?? null;
      next.message = '';
      next.events.push({ type: 'turn', label: 'Codex started working' });
      break;
    case 'item/agentMessage/delta':
      next.message += p.delta ?? '';
      break;
    case 'turn/diff/updated':
      next.events.push({ type: 'diff', label: 'Changes updated', diff: p.diff ?? p });
      break;
    case 'turn/completed':
      next.activeTurn = p.turn ?? next.activeTurn;
      next.usage = p.usage ?? null;
      next.events.push({ type: 'turn', label: 'Turn completed' });
      break;
    default:
      if (message.method.startsWith('item/')) next.events.push({ type: 'item', label: message.method, params: p });
  }
  return next;
}
