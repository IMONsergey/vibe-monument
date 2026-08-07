export const projects = [
  { id: 'northstar', name: 'Northstar', path: '~/Projects/northstar', accent: '#d5f44a' },
  { id: 'atlas', name: 'Atlas', path: '~/Projects/atlas', accent: '#b9d7ff' },
  { id: 'signal', name: 'Signal', path: '~/Projects/signal', accent: '#ffd2b9' },
];

export const tasks = [
  { id: 'hero', title: 'Refine launch hero', subtitle: 'Landing page', status: 'working', branch: 'codex/hero-refine', age: 'now', unread: true },
  { id: 'billing', title: 'Fix billing settings', subtitle: 'Dashboard', status: 'ready', branch: 'codex/billing-settings', age: '18m' },
  { id: 'nav', title: 'Mobile navigation', subtitle: 'Website', status: 'review', branch: 'codex/mobile-nav', age: '1h' },
  { id: 'tokens', title: 'Design token cleanup', subtitle: 'System', status: 'done', branch: 'codex/token-cleanup', age: '2h' },
];

export const activity = [
  { type: 'note', title: 'Understood the reference', detail: 'Keeping the hero quieter, widening the content measure, and reducing decorative contrast.' },
  { type: 'edit', title: 'Edited 3 files', detail: 'Hero.tsx · hero.css · marketing.ts' },
  { type: 'command', title: 'Ran visual checks', detail: 'Desktop 1440×900 · Mobile 390×844', ok: true },
  { type: 'review', title: 'Fresh review', detail: '1 minor spacing issue found', pending: true },
];

export const fileTree = [
  { name: 'app', kind: 'folder', open: true, children: [
    { name: 'components', kind: 'folder', open: true, children: [
      { name: 'Hero.tsx', kind: 'file', active: true },
      { name: 'Navigation.tsx', kind: 'file' },
      { name: 'LogoCloud.tsx', kind: 'file' },
    ]},
    { name: 'styles', kind: 'folder', open: true, children: [
      { name: 'hero.css', kind: 'file' },
      { name: 'tokens.css', kind: 'file' },
    ]},
  ]},
  { name: 'public', kind: 'folder' },
  { name: 'AGENTS.md', kind: 'file' },
  { name: 'package.json', kind: 'file' },
];

export const evidence = [
  { label: 'Build', value: 'passed', state: 'good' },
  { label: 'Tests', value: '48 passed', state: 'good' },
  { label: 'Desktop', value: 'verified', state: 'good' },
  { label: 'Mobile', value: 'verified', state: 'good' },
  { label: 'Console', value: 'clean', state: 'good' },
  { label: 'Review', value: '1 finding', state: 'warn' },
];
