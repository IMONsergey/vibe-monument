import { icons } from '../icons.js';
import { evidence } from '../mock-data.js';
import { escapeHtml } from '../utils.js';

export function previewMarkup(state) {
  if (state.centerMode === 'code') {
    return `<div class="code-view visible">
      ${[
        ['import { motion } from ', '"motion/react"'],
        ['', ''],
        ['export function ', 'Hero() {'],
        ['  return (', ''],
        ['    <section className=', '"hero"'],
        ['      <div className=', '"hero-copy"'],
        ['        <span className=', '"eyebrow"'],
        ['          Built for focused teams', ''],
        ['        </span>', ''],
        ['        <h1>', ''],
        ['          Turn complex work into', ''],
        ['          <em>clear momentum.</em>', ''],
        ['        </h1>', ''],
        ['      </div>', ''],
        ['    </section>', ''],
        ['  )', ''],
        ['}', ''],
      ].map((l, i) => `<div class="code-line"><span class="line-no">${i + 1}</span><span>${escapeHtml(l[0])}<span class="syntax-str">${escapeHtml(l[1])}</span></span></div>`).join('')}
    </div>`;
  }
  return `<div class="canvas-frame ${state.previewViewport} ${state.centerMode === 'inspect' ? 'inspecting' : ''}">
    <div class="preview-site">
      <nav class="site-nav"><div class="site-logo"></div><div class="site-links"><span>Product</span><span>Solutions</span><span>Resources</span><span>Pricing</span></div><div class="site-cta">Start building</div></nav>
      <section class="hero">
        <div class="hero-copy"><div class="eyebrow"><span class="eyebrow-dot"></span>New · Workflows that stay clear</div><h1 data-inspect-target="Hero heading">Turn complex work into clear momentum.</h1><p>A calm workspace for teams that want fewer status meetings, sharper decisions, and work that keeps moving.</p><div class="hero-actions"><div class="hero-primary">Start for free ${icons.chevronRight}</div><div class="hero-secondary">Watch overview</div></div></div>
        <div class="hero-visual"><div class="glow"></div><div class="product-card main-card"><div class="fake-appbar"><span class="fake-dot"></span><span class="fake-dot"></span><span class="fake-dot"></span></div><div class="fake-body"><div class="fake-sidebar"><div class="fake-line dark" style="width:62%"></div><div class="fake-line" style="width:84%"></div><div class="fake-line" style="width:70%"></div><div class="fake-line" style="width:78%"></div></div><div class="fake-content"><div class="fake-line dark" style="width:31%;height:9px"></div><div class="fake-line" style="width:54%"></div><div class="fake-chart"></div><div class="fake-metrics"><span class="fake-metric"></span><span class="fake-metric"></span><span class="fake-metric"></span></div></div></div></div><div class="product-card float-card"><div class="fake-appbar"><span class="fake-dot"></span><span class="fake-dot"></span></div><div class="fake-content"><div class="fake-line dark" style="width:46%;height:8px"></div><div class="fake-chart"></div></div></div></div>
        <div class="inspect-badge">Hero / Heading · Hero.tsx:24</div>
      </section>
    </div>
  </div>`;
}

export function bottomPanelMarkup(state) {
  const terminal = `<div class="terminal-body"><div><span class="terminal-muted">northstar</span> <span class="terminal-green">git:(codex/hero-refine)</span> npm run dev</div><div class="terminal-muted">&nbsp;</div><div>  <span class="terminal-cyan">VITE</span> v8.1.0  ready in 312 ms</div><div class="terminal-muted">&nbsp;</div><div>  ➜  Local:   http://localhost:5173/</div><div>  ➜  press h + enter to show help</div><div class="terminal-muted">&nbsp;</div><div><span class="terminal-green">✓</span> visual capture refreshed · 1440×900</div><div><span class="terminal-green">✓</span> console clean · 0 errors</div></div>`;
  const evidenceHtml = `<div class="evidence-grid">${evidence.map(e => `<div class="evidence-card"><div class="evidence-label">${e.label}</div><div class="evidence-value ${e.state}">${e.state === 'good' ? icons.check : icons.circle}${e.value}</div></div>`).join('')}</div>`;
  const gitHtml = `<div class="git-panel"><div class="git-summary">${icons.branch}<strong>codex/hero-refine</strong><span style="color:var(--muted)">3 changed files</span></div><div class="diff-file"><strong>Hero.tsx</strong><span class="diff-stat">+18 −7</span></div><div class="diff-file"><strong>hero.css</strong><span class="diff-stat">+24 −16</span></div><div class="diff-file"><strong>marketing.ts</strong><span class="diff-stat">+3 −3</span></div></div>`;
  const bodies = { terminal, evidence: evidenceHtml, git: gitHtml, console: `<div class="terminal-body"><span class="terminal-muted">No console errors or warnings in the current preview.</span></div>`, problems: `<div class="git-panel"><div class="git-summary">${icons.check}<strong>No blocking problems</strong></div></div>`, network: `<div class="git-panel"><div class="diff-file"><strong>document</strong><span class="diff-stat">200 · 18 ms</span></div><div class="diff-file"><strong>app.js</strong><span class="diff-stat">200 · 24 ms</span></div></div>` };
  return `<section class="bottom-panel ${state.bottomOpen ? '' : 'closed'}"><div class="bottom-tabs">
    ${[['terminal','Terminal',icons.terminal],['problems','Problems',icons.circle],['console','Console',icons.code],['network','Network',icons.globe],['git','Git',icons.git],['evidence','Evidence',icons.shield]].map(([id,label,icon]) => `<button class="bottom-tab ${state.bottomPanel === id ? 'active' : ''}" data-bottom="${id}">${icon}${label}</button>`).join('')}
    <button class="icon-button bottom-close" data-close-bottom>${icons.close}</button></div><div class="panel-body">${bodies[state.bottomPanel]}</div></section>`;
}
