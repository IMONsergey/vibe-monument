import { icons } from './icons.js';
import { projects, tasks } from './mock-data.js';
import { state, setState, subscribe } from './state.js';
import { paletteMarkup } from './views/palette.js';
import { sidebarMarkup } from './views/sidebar.js';
import { previewMarkup, bottomPanelMarkup } from './views/center.js';
import { agentMarkup } from './views/agent.js';

const app = document.querySelector('#app');
let toastTimer;

const commands = [
  { id: 'new-task', label: 'New task', hint: '⌘N', action: () => showToast('New task flow') },
  { id: 'preview', label: 'Show Preview', hint: '⌘1', action: () => setState({ centerMode: 'preview', paletteOpen: false }) },
  { id: 'code', label: 'Show Code', hint: '⌘2', action: () => setState({ centerMode: 'code', paletteOpen: false }) },
  { id: 'inspect', label: 'Inspect live interface', hint: 'I', action: () => setState({ centerMode: 'inspect', paletteOpen: false }) },
  { id: 'terminal', label: 'Open Terminal', hint: '⌘J', action: () => setState({ bottomOpen: true, bottomPanel: 'terminal', paletteOpen: false }) },
  { id: 'evidence', label: 'Open VibeOS Evidence', hint: '', action: () => setState({ bottomOpen: true, bottomPanel: 'evidence', paletteOpen: false }) },
  { id: 'files', label: 'Show Files', hint: '', action: () => setState({ leftRail: 'files', paletteOpen: false }) },
  { id: 'tasks', label: 'Show Tasks', hint: '', action: () => setState({ leftRail: 'tasks', paletteOpen: false }) },
];

function render() {
  const project = projects.find(p => p.id === state.currentProject) || projects[0];
  const task = tasks.find(t => t.id === state.currentTask) || tasks[0];
  app.innerHTML = `<div class="app-shell">
    <header class="titlebar"><div class="titlebar-left"><div class="traffic"><span></span><span></span><span></span></div><div class="brand">Monument</div></div>
      <div class="titlebar-center"><button class="project-pill"><span class="project-dot" style="--project-accent:${project.accent}"></span>${project.name}${icons.chevronDown}</button><span class="branch-pill">${icons.branch}${task.branch}</span></div>
      <div class="titlebar-right"><span class="status-pill"><span class="status-dot"></span>Codex connected</span><button class="icon-button" data-open-palette>${icons.command}</button><button class="icon-button" data-toast="Settings">${icons.settings}</button></div></header>
    <div class="workspace">${sidebarMarkup(state)}<main class="main ${state.bottomOpen ? '' : 'bottom-closed'}"><div class="workspace-toolbar"><div class="segmented"><button class="segment ${state.centerMode === 'preview' || state.centerMode === 'inspect' ? 'active' : ''}" data-mode="preview">Preview</button><button class="segment ${state.centerMode === 'code' ? 'active' : ''}" data-mode="code">Code</button></div><div class="url-pill">${icons.globe}<span>localhost:5173</span>${icons.refresh}</div><div class="toolbar-spacer"></div><div class="viewport-toggle"><button class="icon-button ${state.previewViewport === 'desktop' ? 'active' : ''}" data-viewport="desktop">${icons.desktop}</button><button class="icon-button ${state.previewViewport === 'mobile' ? 'active' : ''}" data-viewport="mobile">${icons.mobile}</button></div><button class="icon-button ${state.centerMode === 'inspect' ? 'active' : ''}" data-mode="inspect" title="Inspect live UI">${icons.layers}</button><button class="icon-button" data-toast="Open preview in browser">${icons.external}</button>${!state.bottomOpen ? `<button class="icon-button" data-open-bottom>${icons.panel}</button>` : ''}</div>
      <div class="canvas-wrap">${previewMarkup(state)}</div>${bottomPanelMarkup(state)}</main>${agentMarkup()}</div></div>${paletteMarkup(state, commands)}<div class="toast"></div>`;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-left]').forEach(el => el.addEventListener('click', () => setState({ leftRail: el.dataset.left })));
  document.querySelectorAll('[data-task]').forEach(el => el.addEventListener('click', () => setState({ currentTask: el.dataset.task })));
  document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => setState({ centerMode: el.dataset.mode })));
  document.querySelectorAll('[data-viewport]').forEach(el => el.addEventListener('click', () => setState({ previewViewport: el.dataset.viewport })));
  document.querySelectorAll('[data-bottom]').forEach(el => el.addEventListener('click', () => setState({ bottomPanel: el.dataset.bottom, bottomOpen: true })));
  document.querySelector('[data-close-bottom]')?.addEventListener('click', () => setState({ bottomOpen: false }));
  document.querySelector('[data-open-bottom]')?.addEventListener('click', () => setState({ bottomOpen: true }));
  document.querySelectorAll('[data-toast]').forEach(el => el.addEventListener('click', () => showToast(el.dataset.toast)));
  document.querySelector('[data-open-palette]')?.addEventListener('click', () => setState({ paletteOpen: true, paletteQuery: '' }));
  document.querySelector('[data-send]')?.addEventListener('click', () => { const ta = document.querySelector('.composer textarea'); if (ta?.value.trim()) { showToast('Turn sent to Codex'); ta.value = ''; } else showToast('Describe the change first'); });
  document.querySelector('.composer textarea')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.querySelector('[data-send]')?.click(); } });
  document.querySelector('[data-inspect-target]')?.addEventListener('click', (e) => {
    if (state.centerMode !== 'inspect') return;
    const ta = document.querySelector('.composer textarea');
    if (!ta) return;
    ta.value = `Selected: ${e.currentTarget.dataset.inspectTarget} (Hero.tsx:24)\n\n`;
    ta.focus();
    showToast('Element context attached to Codex');
  });
  document.querySelector('[data-palette-close]')?.addEventListener('click', () => setState({ paletteOpen: false, paletteQuery: '' }));
  document.querySelector('[data-palette-stop]')?.addEventListener('click', (e) => e.stopPropagation());
  const paletteInput = document.querySelector('.palette-input input');
  paletteInput?.addEventListener('input', (e) => setState({ paletteQuery: e.target.value }));
  document.querySelectorAll('[data-command]').forEach(el => el.addEventListener('click', () => commands.find(c => c.id === el.dataset.command)?.action()));
  if (state.paletteOpen) requestAnimationFrame(() => document.querySelector('.palette-input input')?.focus());
}

function showToast(message) {
  const toast = document.querySelector('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 1300);
}

subscribe(render);
render();

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setState({ paletteOpen: !state.paletteOpen, paletteQuery: '' }); }
  if (e.key === 'Escape' && state.paletteOpen) { e.preventDefault(); setState({ paletteOpen: false, paletteQuery: '' }); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setState({ bottomOpen: !state.bottomOpen }); }
  if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); setState({ centerMode: 'preview' }); }
  if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); setState({ centerMode: 'code' }); }
  if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'i' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') { setState({ centerMode: 'inspect' }); }
});
