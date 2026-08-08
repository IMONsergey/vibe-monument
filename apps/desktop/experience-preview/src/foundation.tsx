import './main.css';

import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import {
  ArrowLeft,
  ArrowUp,
  CheckCircle,
  Clip,
  Code,
  Cursor,
  History,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from '@openai/apps-sdk-ui/components/Icon';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { SegmentedControl } from '@openai/apps-sdk-ui/components/SegmentedControl';
import { Switch } from '@openai/apps-sdk-ui/components/Switch';
import { Textarea } from '@openai/apps-sdk-ui/components/Textarea';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function Foundation() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className="foundation-shell" data-density={density}>
      <header className="foundation-header">
        <div>
          <a href="./index.html" className="foundation-back"><ArrowLeft /> Workspace preview</a>
          <span className="mon-eyebrow">Product Experience Foundation · v0.1 preview</span>
          <h1>OpenAI primitives.<br />Monument semantics.</h1>
          <p>
            This lab renders the official <code>@openai/apps-sdk-ui@0.2.2</code> package directly,
            then shows the quiet canvas/editor composites built above it.
          </p>
        </div>
        <div className="foundation-controls">
          <SegmentedControl
            value={density}
            onChange={setDensity}
            aria-label="Foundation density"
            size="sm"
          >
            <SegmentedControl.Option value="compact">Compact</SegmentedControl.Option>
            <SegmentedControl.Option value="normal">Normal</SegmentedControl.Option>
            <SegmentedControl.Option value="spacious">Spacious</SegmentedControl.Option>
          </SegmentedControl>
          <Button
            color="secondary"
            variant="outline"
            size="md"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? <Moon /> : <Sun />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </Button>
        </div>
      </header>

      <section className="foundation-provenance" aria-label="Foundation provenance">
        <div><span className="provenance-dot published" /> <strong>OPENAI-PUBLISHED</strong><small>Package primitives and base tokens</small></div>
        <div><span className="provenance-dot derived" /> <strong>MONUMENT-DERIVED</strong><small>Canvas semantics and composites</small></div>
        <Badge color="success" variant="soft" size="sm" pill>Direct integration</Badge>
      </section>

      <section className="foundation-section">
        <div className="foundation-section-heading">
          <div><span>01</span><h2>Semantic roles</h2></div>
          <p>Components consume roles; theme remaps them once.</p>
        </div>
        <div className="swatch-grid">
          {[
            ['Workspace', 'var(--mon-surface-workspace)', 'surface.workspace'],
            ['Canvas', 'var(--mon-surface-canvas)', 'surface.canvas'],
            ['Elevated', 'var(--mon-surface-elevated)', 'surface.elevated'],
            ['Quiet', 'var(--mon-surface-quiet)', 'surface.quiet'],
            ['Selection', 'var(--mon-selection)', 'accent.selection'],
            ['AI active', 'var(--mon-ai-primary)', 'accent.aiPrimary'],
            ['Ready', 'var(--mon-status-ready)', 'status.ready'],
            ['Blocked', 'var(--mon-status-blocked)', 'status.blocked'],
          ].map(([label, color, token]) => (
            <article className="token-swatch" key={token}>
              <div style={{ background: color }} />
              <strong>{label}</strong>
              <code>{token}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="foundation-section">
        <div className="foundation-section-heading">
          <div><span>02</span><h2>Official primitives</h2></div>
          <p>Rendered from the package, not recreated.</p>
        </div>
        <div className="primitive-grid">
          <article className="primitive-card">
            <header><h3>Buttons</h3><code>Button</code></header>
            <div className="primitive-row">
              <Button color="primary" variant="solid" size="md"><Sparkles /> Primary</Button>
              <Button color="secondary" variant="soft" size="md">Soft</Button>
              <Button color="secondary" variant="outline" size="md">Outline</Button>
              <Button color="secondary" variant="ghost" size="md">Ghost</Button>
              <Button color="primary" variant="solid" size="md" disabled>Disabled</Button>
            </div>
          </article>

          <article className="primitive-card">
            <header><h3>Status</h3><code>Badge</code></header>
            <div className="primitive-row">
              <Badge color="secondary" variant="soft">Draft</Badge>
              <Badge color="info" variant="soft">Checking</Badge>
              <Badge color="warning" variant="soft">Needs review</Badge>
              <Badge color="success" variant="soft">Ready</Badge>
              <Badge color="danger" variant="soft">Blocked</Badge>
            </div>
          </article>

          <article className="primitive-card primitive-fields">
            <header><h3>Fields</h3><code>Input · Textarea · Switch</code></header>
            <label>
              Project name
              <Input variant="outline" size="md" defaultValue="Aster" startAdornment={<Search />} />
            </label>
            <label>
              Prompt
              <Textarea variant="soft" rows={2} defaultValue="Make the selected heading more compact." />
            </label>
            <Switch checked={enabled} onCheckedChange={setEnabled} label="Show contextual hints" />
          </article>

          <article className="primitive-card">
            <header><h3>Choice</h3><code>SegmentedControl</code></header>
            <SegmentedControl
              value={density}
              onChange={setDensity}
              aria-label="Example density"
              size="md"
              block
            >
              <SegmentedControl.Option value="compact">Compact</SegmentedControl.Option>
              <SegmentedControl.Option value="normal">Normal</SegmentedControl.Option>
              <SegmentedControl.Option value="spacious">Spacious</SegmentedControl.Option>
            </SegmentedControl>
          </article>
        </div>
      </section>

      <section className="foundation-section">
        <div className="foundation-section-heading">
          <div><span>03</span><h2>Monument composites</h2></div>
          <p>Product-specific arrangements above official primitives.</p>
        </div>
        <div className="composite-grid">
          <article className="composite-card composite-selection">
            <span className="composite-label">Hero heading</span>
            <h3>Objects for a slower home.</h3>
            <div className="composite-toolbar">
              <Button color="secondary" variant="ghost" size="sm" uniform aria-label="Select"><Cursor /></Button>
              <Button color="secondary" variant="ghost" size="sm" uniform aria-label="Inspect"><Code /></Button>
              <Button color="primary" variant="solid" size="sm" uniform aria-label="Ask Monument"><Sparkles /></Button>
            </div>
          </article>

          <article className="composite-card composite-activity">
            <span className="activity-icon activity-working"><Sparkles /></span>
            <div><strong>Refining the selected heading</strong><span>Inspecting structure · updating preview</span></div>
            <Badge color="info" variant="soft" size="sm">Working</Badge>
          </article>

          <article className="composite-card composite-proof">
            <div className="proof-emblem"><ShieldCheck /></div>
            <div><strong>Fresh Review next</strong><span>Checks passed for this generation.</span></div>
            <Button color="primary" variant="solid" size="sm">Review</Button>
          </article>

          <article className="composite-card composite-timeline">
            <div><History /><span className="composite-node" /></div>
            <div><strong>Heading refinement</strong><span>Now · current generation</span></div>
            <Badge color="warning" variant="soft" size="sm">Review next</Badge>
          </article>

          <article className="composite-card composite-composer">
            <div className="context-chip"><Cursor /> Hero heading</div>
            <div className="foundation-composer-row">
              <Button color="secondary" variant="ghost" size="md" uniform aria-label="Attach"><Clip /></Button>
              <span>Ask Monument to change the selected element…</span>
              <Button color="primary" variant="solid" size="md" uniform aria-label="Send"><ArrowUp /></Button>
            </div>
          </article>
        </div>
      </section>

      <section className="foundation-section foundation-rules">
        <div className="foundation-section-heading">
          <div><span>04</span><h2>Behavior contract</h2></div>
          <p>The system is defined by what it refuses to show by default.</p>
        </div>
        <div className="rule-grid">
          <article><span>01</span><strong>Canvas first</strong><p>The artifact occupies the visual hierarchy before system process.</p></article>
          <article><span>02</span><strong>Quiet at rest</strong><p>AI color and motion appear only while work is active.</p></article>
          <article><span>03</span><strong>One next action</strong><p>Proof, Review, and Ship summaries expose a single primary step.</p></article>
          <article><span>04</span><strong>Truth on demand</strong><p>Source and generation facts remain precise behind explicit disclosure.</p></article>
        </div>
      </section>

      <footer className="foundation-footer">
        <span><CheckCircle /> Official package rendered · semantic adapter active</span>
        <a href="./index.html">Return to workspace <ArrowUp /></a>
      </footer>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Monument foundation root is missing');

createRoot(root).render(
  <StrictMode>
    <Foundation />
  </StrictMode>,
);
