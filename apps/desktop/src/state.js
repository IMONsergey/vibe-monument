export const state = {
  currentProject: 'northstar',
  currentTask: 'hero',
  centerMode: 'preview',
  previewViewport: 'desktop',
  bottomPanel: 'terminal',
  bottomOpen: false,
  leftRail: 'tasks',
  codexExpanded: true,
  theme: 'light',
  paletteOpen: false,
  paletteQuery: '',
};

const listeners = new Set();

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
