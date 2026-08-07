import { icons } from '../icons.js';
import { escapeHtml } from '../utils.js';

export function paletteMarkup(state, commands) {
  if (!state.paletteOpen) return '';
  const q = state.paletteQuery.trim().toLowerCase();
  const filtered = commands.filter(c => c.label.toLowerCase().includes(q));
  return `<div class="palette-backdrop" data-palette-close><div class="palette" data-palette-stop>
    <div class="palette-input">${icons.search}<input aria-label="Command search" placeholder="Search actions, tasks, files…" value="${escapeHtml(state.paletteQuery)}" /></div>
    <div class="palette-results">${filtered.length ? filtered.map((c, i) => `<button class="palette-row ${i === 0 ? 'selected' : ''}" data-command="${c.id}"><span>${c.label}</span><kbd>${c.hint}</kbd></button>`).join('') : '<div class="palette-empty">No matching actions</div>'}</div>
    <div class="palette-footer"><span>Monument Command</span><span>↑↓ Navigate · ↵ Run · esc Close</span></div>
  </div></div>`;
}
