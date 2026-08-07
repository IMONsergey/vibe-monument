import { icons } from '../icons.js';
import { projects, tasks, fileTree } from '../mock-data.js';

function fileTreeMarkup(nodes, depth = 0) {
  return nodes.map((node) => {
    const prefix = node.kind === 'folder' ? (node.open ? '▾' : '›') : '';
    const child = node.children ? fileTreeMarkup(node.children, depth + 1) : '';
    return `<div class="file-node ${node.active ? 'active' : ''}" style="padding-left:${8 + depth * 13}px">
      <span class="file-caret">${prefix}</span><span>${node.name}</span>
    </div>${child}`;
  }).join('');
}

export function sidebarMarkup(state) {
  return `<aside class="sidebar">
    <div class="sidebar-nav">
      <button class="nav-chip ${state.leftRail === 'tasks' ? 'active' : ''}" data-left="tasks">Tasks</button>
      <button class="nav-chip ${state.leftRail === 'files' ? 'active' : ''}" data-left="files">Files</button>
      <div class="sidebar-tools"><button class="icon-button" data-toast="New task">${icons.plus}</button><button class="icon-button" data-toast="Search">${icons.search}</button></div>
    </div>
    ${state.leftRail === 'tasks' ? `
      <div class="sidebar-section">
        <div class="section-label">Recent</div>
        <div class="task-list">${tasks.map(t => `<button class="task ${state.currentTask === t.id ? 'active' : ''}" data-task="${t.id}">
          ${t.unread ? '<span class="task-unread"></span>' : ''}
          <span class="task-icon">${t.status === 'done' ? icons.check : t.status === 'review' ? icons.eye : icons.sparkle}</span>
          <span class="task-copy"><div class="task-title">${t.title}</div><div class="task-sub">${t.subtitle}</div></span><span class="task-age">${t.age}</span>
        </button>`).join('')}</div>
      </div>
      <div class="sidebar-section">
        <div class="section-label">Projects</div>
        <div class="project-list">${projects.map(p => `<div class="project-row" style="--project-accent:${p.accent}"><span class="project-dot"></span>${p.name}<span style="margin-left:auto;color:var(--muted-2)">${icons.chevronRight}</span></div>`).join('')}</div>
      </div>` : `
      <div class="sidebar-section" style="padding-top:4px;overflow:auto;">
        <div class="section-label">Northstar</div>
        <div class="file-tree">${fileTreeMarkup(fileTree)}</div>
      </div>`}
    <div class="sidebar-footer"><div class="account"><div class="avatar">S</div><div class="account-copy"><div class="account-title">Personal workspace</div><div class="account-sub">Codex connected</div></div>${icons.more}</div></div>
  </aside>`;
}
