import { icons } from '../icons.js';
import { activity } from '../mock-data.js';

export function agentMarkup() {
  return `<aside class="agent-panel"><div class="agent-header"><div class="agent-title"><span class="codex-mark">${icons.sparkle}</span>Codex</div><div class="agent-head-actions"><button class="icon-button" data-toast="Fork session">${icons.branch}</button><button class="icon-button" data-toast="Session options">${icons.more}</button></div></div>
    <div class="agent-scroll"><div class="task-heading"><div class="task-kicker"><span class="status-dot"></span>Building</div><h2>Refine launch hero</h2><p>Match the supplied direction while keeping the page calmer, more premium, and easier to scan.</p></div>
      <div class="agent-section"><div class="agent-section-title">Plan</div><div class="plan">
        <div class="plan-row done"><span class="plan-icon">${icons.check}</span><span>Inspect project and reference</span><span class="plan-meta">done</span></div>
        <div class="plan-row done"><span class="plan-icon">${icons.check}</span><span>Refine hero structure</span><span class="plan-meta">done</span></div>
        <div class="plan-row done"><span class="plan-icon">${icons.check}</span><span>Verify responsive states</span><span class="plan-meta">done</span></div>
        <div class="plan-row active"><span class="plan-icon">${icons.sparkle}</span><span>Fresh-context review</span><span class="plan-meta">running</span></div>
        <div class="plan-row"><span class="plan-icon"></span><span>Resolve findings and ship</span><span class="plan-meta">next</span></div>
      </div></div>
      <div class="agent-section"><div class="agent-section-title">Activity</div><div class="activity-list">${activity.map((a, idx) => `<div class="activity-row"><div class="activity-top"><span class="activity-icon">${a.type === 'edit' ? icons.code : a.type === 'command' ? icons.terminal : a.type === 'review' ? icons.eye : icons.sparkle}</span>${a.title}${a.ok ? '<span style="margin-left:auto;color:var(--good)">✓</span>' : ''}</div><div class="activity-detail">${a.detail}</div>${a.pending ? '<div class="review-finding">Hero copy sits 6–8 px too close to the navigation at 1280 px. Everything else is within the visual contract.</div>' : ''}</div>`).join('')}</div></div>
    </div>
    <div class="agent-composer"><div class="composer"><textarea placeholder="Tell Codex what to change…"></textarea><div class="composer-actions"><button class="composer-chip">${icons.plus} Attach</button><button class="composer-chip">${icons.eye} Reference</button><button class="composer-chip">${icons.chevronDown} Ultra</button><button class="send-button" data-send>${icons.chevronRight}</button></div></div></div>
  </aside>`;
}
