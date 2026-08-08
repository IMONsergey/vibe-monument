import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import {
  ArrowRotateCcw,
  ArrowUp,
  Branch,
  CheckCircle,
  ChevronRight,
  Clip,
  CloseBold,
  Code,
  Cursor,
  Desktop,
  Edit,
  History,
  Keyboard,
  LightMode,
  MenuSidebar,
  Moon,
  Search,
  SettingsSlider,
  ShieldCheck,
  SidebarRight,
  Sparkles,
  Stop,
  Sun,
  Terminal,
} from '@openai/apps-sdk-ui/components/Icon';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { SegmentedControl } from '@openai/apps-sdk-ui/components/SegmentedControl';
import { Switch } from '@openai/apps-sdk-ui/components/Switch';
import { Textarea } from '@openai/apps-sdk-ui/components/Textarea';
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Surface = 'map' | 'inspector' | 'timeline' | 'proof' | 'codex' | 'command' | null;
type SelectionId = 'eyebrow' | 'headline' | 'body' | 'cta';
type AgentState = 'idle' | 'working' | 'complete' | 'approval';
type Viewport = 'desktop' | 'tablet' | 'mobile';
type InspectorTab = 'design' | 'content' | 'implementation';
type ProofState = 'unknown' | 'needs-checks' | 'checking' | 'needs-review' | 'ready' | 'blocked';
type TextAlignment = 'left' | 'center' | 'right';

const selectionMeta: Record<SelectionId, { label: string; kind: string; path: string }> = {
  eyebrow: {
    label: 'Collection label',
    kind: 'Text',
    path: 'src/sections/Hero.tsx:18',
  },
  headline: {
    label: 'Hero heading',
    kind: 'Heading',
    path: 'src/sections/Hero.tsx:21',
  },
  body: {
    label: 'Hero description',
    kind: 'Paragraph',
    path: 'src/sections/Hero.tsx:25',
  },
  cta: {
    label: 'Collection link',
    kind: 'Action',
    path: 'src/sections/Hero.tsx:30',
  },
};

const proofCopy: Record<ProofState, { label: string; detail: string }> = {
  unknown: { label: 'Not checked', detail: 'No proof exists for this simulated generation yet.' },
  'needs-checks': { label: 'Needs checks', detail: 'The canvas changed since the last proof.' },
  checking: { label: 'Checking', detail: 'Validating the current simulated generation.' },
  'needs-review': { label: 'Review next', detail: 'Checks passed; fresh review is still required.' },
  ready: { label: 'Ready', detail: 'The simulated generation is ready to prepare.' },
  blocked: { label: 'Blocked', detail: 'Browser proof found a simulated responsive overflow.' },
};

function isActivationKey(event: ReactKeyboardEvent<HTMLElement>) {
  return event.key === 'Enter' || event.key === ' ';
}

function Selectable({
  id,
  selected,
  onSelect,
  onInspect,
  onPrompt,
  children,
}: {
  id: SelectionId;
  selected: boolean;
  onSelect: (id: SelectionId) => void;
  onInspect: () => void;
  onPrompt: () => void;
  children: ReactNode;
}) {
  const meta = selectionMeta[id];

  return (
    <div className={`demo-selectable ${selected ? 'is-selected' : ''}`} data-selection={id}>
      <div
        className="demo-selection-target"
        role="button"
        tabIndex={0}
        aria-label={`Select ${meta.label}`}
        aria-pressed={selected}
        onClick={() => onSelect(id)}
        onKeyDown={(event) => {
          if (!isActivationKey(event)) return;
          event.preventDefault();
          onSelect(id);
        }}
      >
        {children}
      </div>

      {selected ? (
        <>
          <span className="selection-label">{meta.label}</span>
          <span className="selection-handle handle-nw" aria-hidden="true" />
          <span className="selection-handle handle-ne" aria-hidden="true" />
          <span className="selection-handle handle-sw" aria-hidden="true" />
          <span className="selection-handle handle-se" aria-hidden="true" />
          <div className="selection-toolbar" role="toolbar" aria-label={`${meta.label} actions`}>
            <Button
              color="secondary"
              variant="ghost"
              size="sm"
              uniform
              aria-label="Edit content"
              title="Edit content"
              onClick={onInspect}
            >
              <Edit />
            </Button>
            <Button
              color="secondary"
              variant="ghost"
              size="sm"
              uniform
              aria-label="Open contextual inspector"
              title="Open contextual inspector"
              onClick={onInspect}
            >
              <SidebarRight />
            </Button>
            <Button
              color="primary"
              variant="solid"
              size="sm"
              uniform
              aria-label="Ask Monument about selection"
              title="Ask Monument about selection"
              onClick={onPrompt}
            >
              <Sparkles />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Sheet({
  surfaceId,
  title,
  eyebrow,
  side = 'right',
  compact = false,
  onClose,
  children,
}: {
  surfaceId: Exclude<Surface, 'command' | null>;
  title: string;
  eyebrow: string;
  side?: 'left' | 'right' | 'bottom';
  compact?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = `mon-${surfaceId}-title`;

  return (
    <section
      className="mon-sheet"
      data-side={side}
      data-compact={compact}
      data-transient-surface={surfaceId}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <header className="mon-sheet-header">
        <div>
          <span className="mon-eyebrow">{eyebrow}</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <Button
          color="secondary"
          variant="ghost"
          size="sm"
          uniform
          data-surface-autofocus
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <CloseBold />
        </Button>
      </header>
      <div className="mon-sheet-body">{children}</div>
    </section>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [surface, setSurface] = useState<Surface>(null);
  const [selection, setSelection] = useState<SelectionId | null>('headline');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('design');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [proofState, setProofState] = useState<ProofState>('unknown');
  const [prompt, setPrompt] = useState('');
  const [announcement, setAnnouncement] = useState(
    'Hero heading selected. Interactive concept preview is ready.',
  );
  const [commandQuery, setCommandQuery] = useState('');
  const [headlineRefined, setHeadlineRefined] = useState(false);
  const [activeVersion, setActiveVersion] = useState('v10');
  const [inspectorCompact, setInspectorCompact] = useState(true);
  const [alignment, setAlignment] = useState<TextAlignment>('left');
  const [mapQuery, setMapQuery] = useState('');
  const [heroExpanded, setHeroExpanded] = useState(true);
  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null);
  const [commandIndex, setCommandIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const timers = useRef<number[]>([]);

  const selected = selection ? selectionMeta[selection] : null;
  const proof = proofCopy[proofState];

  const openSurface = useCallback((next: Exclude<Surface, null>) => {
    if (surface === null && document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    setSurface(next);
  }, [surface]);

  const closeSurface = useCallback(() => {
    setSurface(null);
    setCommandQuery('');
    setRestoreCandidate(null);
    window.requestAnimationFrame(() => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      returnFocusRef.current = null;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSurface('command');
        return;
      }

      if (event.key === 'Escape') {
        if (surface) closeSurface();
        return;
      }

      if (surface === 'command' && event.key === 'Tab') {
        const dialog = document.querySelector<HTMLElement>('[data-transient-surface="command"]');
        const focusable = dialog
          ? [...dialog.querySelectorAll<HTMLElement>('input, button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
          : [];
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }

      if (isTyping) return;

      const key = event.key.toLowerCase();
      if (key === 'm') openSurface('map');
      if (key === 'v') openSurface('timeline');
      if (key === 'p') openSurface('proof');
      if (key === 'i') openSurface(selected ? 'inspector' : 'map');
      if (key === 'd') openSurface('codex');
      if (key === 't') {
        setTheme((current) => {
          const next = current === 'light' ? 'dark' : 'light';
          setAnnouncement(`Switched to ${next} theme.`);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSurface, openSurface, selected, surface]);

  useEffect(() => {
    if (!surface) return;
    const frame = window.requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(`[data-transient-surface="${surface}"]`);
      const target = container?.querySelector<HTMLElement>('[data-surface-autofocus]');
      (target ?? container)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [surface]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const schedule = (callback: () => void, delay: number) => {
    timers.current.push(window.setTimeout(callback, delay));
  };

  const selectElement = (id: SelectionId) => {
    setSelection(id);
    setAnnouncement(`${selectionMeta[id].label} selected.`);
  };

  const focusComposer = () => {
    closeSurface();
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const runPrompt = (event?: FormEvent) => {
    event?.preventDefault();
    if (agentState === 'working') return;

    const task =
      prompt.trim() ||
      `Make the ${(selected?.label ?? 'current page').toLowerCase()} feel calmer and more editorial.`;
    setPrompt('');
    setAgentState('working');
    setProofState('checking');
    closeSurface();
    setAnnouncement(`Monument is working: ${task}`);

    schedule(() => {
      setHeadlineRefined(true);
      setAgentState('complete');
      setProofState('needs-review');
      setAnnouncement('Simulated change complete. Checks passed; fresh review is next.');
    }, 1650);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
    setAnnouncement(`Switched to ${theme === 'light' ? 'dark' : 'light'} theme.`);
  };

  const runProof = () => {
    setProofState('checking');
    setAnnouncement('Running simulated checks for the current generation.');
    schedule(() => {
      setProofState('needs-review');
      setAnnouncement('Simulated checks passed. Fresh review is still required.');
    }, 1250);
  };

  const completeReview = () => {
    setProofState('ready');
    setAnnouncement('Simulated Fresh Review completed with no blockers.');
  };

  const commandItems = useMemo(
    () => [
      {
        label: 'Open product map',
        description: 'Find and select an element',
        shortcut: 'M',
        icon: <MenuSidebar />,
        action: () => openSurface('map'),
      },
      {
        label: 'Inspect selection',
        description: selected?.label ?? 'Choose an element first',
        shortcut: 'I',
        icon: <SidebarRight />,
        action: () => openSurface(selected ? 'inspector' : 'map'),
      },
      {
        label: 'Open Timeline',
        description: 'Preview or restore a checkpoint',
        shortcut: 'V',
        icon: <History />,
        action: () => openSurface('timeline'),
      },
      {
        label: 'Open Proof',
        description: proof.label,
        shortcut: 'P',
        icon: <ShieldCheck />,
        action: () => openSurface('proof'),
      },
      {
        label: 'Show Codex details',
        description: agentState === 'idle' ? 'No active work' : agentState,
        shortcut: 'D',
        icon: <Terminal />,
        action: () => openSurface('codex'),
      },
      {
        label: `Use ${theme === 'light' ? 'dark' : 'light'} theme`,
        description: 'Same semantic system',
        shortcut: 'T',
        icon: theme === 'light' ? <Moon /> : <Sun />,
        action: () => {
          toggleTheme();
          closeSurface();
        },
      },
    ],
    [agentState, closeSurface, openSurface, proof.label, selected, theme],
  );

  const visibleCommands = commandItems.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(commandQuery.toLowerCase()),
  );

  const visibleMapItems = (Object.keys(selectionMeta) as SelectionId[]).filter((id) =>
    `${selectionMeta[id].label} ${selectionMeta[id].kind}`.toLowerCase().includes(mapQuery.toLowerCase()),
  );

  useEffect(() => {
    setCommandIndex(0);
  }, [commandQuery, surface]);

  const runCommand = (index: number) => {
    const item = visibleCommands[index];
    if (!item) return;
    item.action();
    setCommandQuery('');
  };

  return (
    <div className="experience-shell" data-agent={agentState}>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <header className="window-bar">
        <div className="window-project">
          <div className="traffic-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <button
            className="brand-lockup"
            type="button"
            aria-label="Open product map"
            onClick={() => openSurface('map')}
          >
            <span className="brand-mark" aria-hidden="true" />
            <span>Monument</span>
          </button>
          <span className="window-divider" aria-hidden="true" />
          <button className="project-crumb" type="button" onClick={() => openSurface('map')}>
            Aster <ChevronRight /> Home
          </button>
          <Badge color="secondary" variant="soft" size="sm" pill>
            <Branch /> preview
          </Badge>
        </div>

        <div className="window-viewport">
          <SegmentedControl
            value={viewport}
            onChange={setViewport}
            aria-label="Preview viewport"
            size="sm"
          >
            <SegmentedControl.Option value="desktop" aria-label="Desktop viewport">
              <Desktop />
            </SegmentedControl.Option>
            <SegmentedControl.Option value="tablet" aria-label="Tablet viewport">
              768
            </SegmentedControl.Option>
            <SegmentedControl.Option value="mobile" aria-label="Mobile viewport">
              390
            </SegmentedControl.Option>
          </SegmentedControl>
        </div>

        <div className="window-actions">
          <Badge color="info" variant="soft" size="sm" pill className="concept-badge">
            Simulated concept
          </Badge>
          <Button
            color="secondary"
            variant="ghost"
            size="sm"
            className="proof-trigger"
            onClick={() => openSurface('proof')}
          >
            <span className={`status-dot status-${proofState}`} aria-hidden="true" />
            {proof.label}
          </Button>
          <Button
            color="secondary"
            variant="ghost"
            size="sm"
            uniform
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon /> : <LightMode />}
          </Button>
          <Button
            color="secondary"
            variant="outline"
            size="sm"
            aria-label="Open command palette"
            onClick={() => openSurface('command')}
          >
            <Search />
            <span className="command-label">Commands</span>
            <kbd>⌘K</kbd>
          </Button>
        </div>
      </header>

      <main
        className="workspace"
        data-surface={surface ?? 'none'}
        aria-label="Monument canvas-first workspace"
      >
        <section className="canvas-frame" aria-label="Live product canvas">
          <div className="canvas-meta">
            <div>
              <span className="canvas-live-dot" aria-hidden="true" />
              Live product
            </div>
            <span>{viewport === 'desktop' ? '1440 × 900' : viewport === 'tablet' ? '768 × 1024' : '390 × 844'}</span>
          </div>

          <div className="product-viewport-wrap">
            <article
              className={`product-viewport ${headlineRefined ? 'is-refined' : ''}`}
              data-viewport={viewport}
              data-version={activeVersion}
              data-alignment={alignment}
              aria-label="Aster sample product"
            >
              <nav className="demo-nav" aria-label="Sample product navigation">
                <a href="#hero" className="demo-wordmark">
                  ASTER
                </a>
                <div className="demo-nav-links">
                  <a href="#objects">Objects</a>
                  <a href="#journal">Journal</a>
                  <a href="#about">About</a>
                </div>
                <a href="#collection" className="demo-index-link">
                  Index <span aria-hidden="true">06</span>
                </a>
              </nav>

              <section className="demo-hero" id="hero">
                <div className="demo-copy">
                  <Selectable
                    id="eyebrow"
                    selected={selection === 'eyebrow'}
                    onSelect={selectElement}
                    onInspect={() => openSurface('inspector')}
                    onPrompt={focusComposer}
                  >
                    <p className="demo-eyebrow">Edition 06 · Quiet utility</p>
                  </Selectable>

                  <Selectable
                    id="headline"
                    selected={selection === 'headline'}
                    onSelect={selectElement}
                    onInspect={() => openSurface('inspector')}
                    onPrompt={focusComposer}
                  >
                    <h1>Objects for a slower home.</h1>
                  </Selectable>

                  <Selectable
                    id="body"
                    selected={selection === 'body'}
                    onSelect={selectElement}
                    onInspect={() => openSurface('inspector')}
                    onPrompt={focusComposer}
                  >
                    <p className="demo-body">
                      A seasonal study of tools, vessels, and small rituals made to improve with use.
                    </p>
                  </Selectable>

                  <Selectable
                    id="cta"
                    selected={selection === 'cta'}
                    onSelect={selectElement}
                    onInspect={() => openSurface('inspector')}
                    onPrompt={focusComposer}
                  >
                    <span className="demo-cta">
                      Explore the collection <ArrowUp />
                    </span>
                  </Selectable>
                </div>

                <div
                  className="demo-art"
                  role="img"
                  aria-label="Abstract arrangement of crafted objects"
                >
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />
                  <div className="art-plinth" />
                  <div className="art-vessel">
                    <span />
                  </div>
                  <div className="art-stem stem-one" />
                  <div className="art-stem stem-two" />
                  <p className="art-caption">Ash vessel / hand finished / 2026</p>
                </div>
              </section>

              <footer className="demo-footer">
                <span>Helsinki · 60.1699° N</span>
                <span>Scroll to observe</span>
              </footer>
            </article>
          </div>
        </section>

        {agentState !== 'idle' ? (
          <button className="activity-capsule" type="button" onClick={() => openSurface('codex')}>
            <span className={`activity-icon activity-${agentState}`} aria-hidden="true">
              {agentState === 'working' ? <Sparkles /> : agentState === 'approval' ? <Stop /> : <CheckCircle />}
            </span>
            <span className="activity-copy">
              <strong>
                {agentState === 'working'
                  ? 'Refining the selected heading'
                  : agentState === 'approval'
                    ? 'Approval needed'
                    : 'Heading refined'}
              </strong>
              <span>
                {agentState === 'working'
                  ? 'Inspecting structure · updating preview'
                  : agentState === 'approval'
                    ? 'Review the release boundary before continuing'
                    : '1 element changed · checks passed'}
              </span>
            </span>
            <ChevronRight />
          </button>
        ) : null}

        <form className="composer-shell" data-agent={agentState} onSubmit={runPrompt}>
          <div className="composer-context">
            <span className="context-chip">
              {selected ? <Cursor /> : <Code />} {selected?.label ?? 'Current page'}
              {selected ? (
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => {
                    setSelection(null);
                    closeSurface();
                    setAnnouncement('Selection cleared. Composer is using the current page as context.');
                  }}
                >
                  <CloseBold />
                </button>
              ) : null}
            </span>
            <span className="composer-mode">Work locally</span>
          </div>
          <div className="composer-row">
            <Button
              color="secondary"
              variant="ghost"
              size="lg"
              uniform
              aria-label="Attach context"
              title="Attach context"
              onClick={() => openSurface('map')}
            >
              <Clip />
            </Button>
            <Textarea
              ref={composerRef}
              className="composer-input"
              variant="soft"
              size="lg"
              rows={1}
              maxRows={4}
              autoResize
              value={prompt}
              aria-label="Ask Monument"
              placeholder={`Ask Monument to change the ${(selected?.label ?? 'current page').toLowerCase()}…`}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  runPrompt();
                }
              }}
            />
            <Button
              color="primary"
              variant="solid"
              size="lg"
              uniform
              loading={agentState === 'working'}
              aria-label={agentState === 'working' ? 'Monument is working' : 'Send prompt'}
              type="submit"
            >
              <ArrowUp />
            </Button>
          </div>
        </form>

        {surface === 'map' ? (
          <Sheet surfaceId="map" title="Product map" eyebrow="Structure" side="left" onClose={closeSurface}>
            <div className="sheet-search">
              <Input
                variant="soft"
                size="md"
                aria-label="Search product elements"
                placeholder="Search this page"
                startAdornment={<Search />}
                value={mapQuery}
                onChange={(event) => setMapQuery(event.target.value)}
              />
            </div>
            <nav className="product-tree" aria-label="Product element tree">
              <div className="tree-row tree-root">
                <Code /> Home page
              </div>
              <button type="button" className="tree-row tree-branch" disabled title="Not expanded in this concept">
                <ChevronRight /> Navigation
              </button>
              <button
                type="button"
                className={`tree-row tree-branch ${heroExpanded ? 'is-open' : ''}`}
                aria-expanded={heroExpanded}
                onClick={() => setHeroExpanded((current) => !current)}
              >
                <ChevronRight /> Hero
              </button>
              {(heroExpanded || mapQuery ? visibleMapItems : []).map((id) => (
                <button
                  type="button"
                  className={`tree-row tree-leaf ${selection === id ? 'is-current' : ''}`}
                  key={id}
                  onClick={() => {
                    selectElement(id);
                    closeSurface();
                  }}
                >
                  <span className="tree-type">{selectionMeta[id].kind.slice(0, 1)}</span>
                  <span>{selectionMeta[id].label}</span>
                  {selection === id ? <CheckCircle /> : null}
                </button>
              ))}
              {visibleMapItems.length === 0 ? <p className="tree-empty">No matching element.</p> : null}
              <button type="button" className="tree-row tree-branch" disabled title="Not expanded in this concept">
                <ChevronRight /> Collection grid
              </button>
              <button type="button" className="tree-row tree-branch" disabled title="Not expanded in this concept">
                <ChevronRight /> Footer
              </button>
            </nav>
            <p className="sheet-note">
              This is a bounded runtime projection. Source remains authoritative.
            </p>
          </Sheet>
        ) : null}

        {surface === 'inspector' && selected ? (
          <Sheet
            surfaceId="inspector"
            title={selected.label}
            eyebrow={selected.kind}
            compact={inspectorCompact}
            onClose={closeSurface}
          >
            <SegmentedControl
              value={inspectorTab}
              onChange={setInspectorTab}
              aria-label="Inspector section"
              size="sm"
              block
            >
              <SegmentedControl.Option value="design">Design</SegmentedControl.Option>
              <SegmentedControl.Option value="content">Content</SegmentedControl.Option>
              <SegmentedControl.Option value="implementation">Source</SegmentedControl.Option>
            </SegmentedControl>

            {inspectorTab === 'design' ? (
              <div className="inspector-stack">
                <section className="inspector-section">
                  <div className="inspector-heading">
                    <h3>Layout</h3>
                    <span>One element</span>
                  </div>
                  <div className="field-grid">
                    <label>
                      Width
                      <Input size="sm" variant="soft" value="Auto" readOnly aria-label="Width" />
                    </label>
                    <label>
                      Max
                      <Input size="sm" variant="soft" value="720 px" readOnly aria-label="Maximum width" />
                    </label>
                  </div>
                  <div className="alignment-control" role="group" aria-label="Text alignment">
                    {(['left', 'center', 'right'] as TextAlignment[]).map((value) => (
                      <button
                        type="button"
                        className={alignment === value ? 'is-active' : ''}
                        aria-pressed={alignment === value}
                        onClick={() => {
                          setAlignment(value);
                          setAnnouncement(`${selected.label} aligned ${value} in the concept preview.`);
                        }}
                        key={value}
                      >
                        {value[0].toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="inspector-section">
                  <div className="inspector-heading">
                    <h3>Typography</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setHeadlineRefined(false);
                        setAlignment('left');
                        setAnnouncement('Design values reset in the concept preview.');
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <label className="field-row">
                    <span>Size</span>
                    <Input size="sm" variant="soft" value={headlineRefined ? '68 px' : '76 px'} readOnly aria-label="Text size" />
                  </label>
                  <label className="field-row">
                    <span>Line height</span>
                    <Input size="sm" variant="soft" value="0.96" readOnly aria-label="Line height" />
                  </label>
                  <label className="field-row">
                    <span>Tracking</span>
                    <Input size="sm" variant="soft" value={headlineRefined ? '-2.2 px' : '-3.0 px'} readOnly aria-label="Letter spacing" />
                  </label>
                </section>
                <section className="inspector-section">
                  <div className="inspector-heading">
                    <h3>Behavior</h3>
                  </div>
                  <Switch
                    checked={inspectorCompact}
                    onCheckedChange={setInspectorCompact}
                    label="Compact inspector density"
                  />
                </section>
              </div>
            ) : null}

            {inspectorTab === 'content' ? (
              <div className="inspector-stack">
                <section className="inspector-section">
                  <label className="content-editor-label" htmlFor="selected-content">
                    Visible copy
                  </label>
                  <Textarea
                    id="selected-content"
                    variant="outline"
                    rows={4}
                    defaultValue={
                      selection === 'headline'
                        ? 'Objects for a slower home.'
                        : selection === 'body'
                          ? 'A seasonal study of tools, vessels, and small rituals made to improve with use.'
                          : selection === 'eyebrow'
                            ? 'Edition 06 · Quiet utility'
                            : 'Explore the collection'
                    }
                  />
                  <p className="field-help">Preview only. No source file is written from this concept.</p>
                </section>
                <Button color="primary" variant="solid" size="md" block onClick={() => runPrompt()}>
                  <Sparkles /> Ask Monument to apply
                </Button>
              </div>
            ) : null}

            {inspectorTab === 'implementation' ? (
              <div className="inspector-stack">
                <section className="source-summary">
                  <div className="source-icon"><Code /></div>
                  <div>
                    <strong>Direct source owner found</strong>
                    <span>This change affects one static element.</span>
                  </div>
                  <Badge color="success" variant="soft" size="sm">Proved</Badge>
                </section>
                <section className="inspector-section source-facts">
                  <div><span>File</span><code>{selected.path}</code></div>
                  <div><span>Lane</span><code>static JSX content</code></div>
                  <div><span>Scope</span><code>one element</code></div>
                </section>
                <details className="technical-details">
                  <summary>Transaction details</summary>
                  <pre>{`authority: source\npreview: bounded\ncommit: atomic\ntimeline: generation-bound`}</pre>
                </details>
              </div>
            ) : null}
          </Sheet>
        ) : null}

        {surface === 'timeline' ? (
          <Sheet surfaceId="timeline" title="Timeline" eyebrow="Version history" side="bottom" onClose={closeSurface}>
            <div className="timeline-intro">
              <p>Preview a checkpoint without changing source. Restore stays explicit.</p>
              <Badge color="secondary" variant="outline" size="sm" pill>
                Source v10
              </Badge>
            </div>
            <div className="timeline-track">
              {[
                { id: 'v8', time: '10:18', title: 'Navigation rhythm', proof: 'Proved' },
                { id: 'v9', time: '10:42', title: 'Hero composition', proof: 'Proved' },
                { id: 'v10', time: 'Now', title: 'Heading refinement', proof: proof.label },
              ].map((version) => (
                <button
                  type="button"
                  className={`timeline-card ${activeVersion === version.id ? 'is-current' : ''}`}
                  key={version.id}
                  onClick={() => {
                    setActiveVersion(version.id);
                    setRestoreCandidate(null);
                    setAnnouncement(`Previewing simulated checkpoint ${version.id}.`);
                  }}
                >
                  <span className="timeline-node" />
                  <span className="timeline-time">{version.time}</span>
                  <strong>{version.title}</strong>
                  <span>{version.proof}</span>
                </button>
              ))}
            </div>
            <div className="timeline-actions">
              <span>Previewing {activeVersion} · source unchanged</span>
              <Button
                color="secondary"
                variant="outline"
                size="md"
                disabled={activeVersion === 'v10'}
                onClick={() => setRestoreCandidate(activeVersion)}
              >
                <ArrowRotateCcw /> {activeVersion === 'v10' ? 'Current checkpoint' : `Restore ${activeVersion}`}
              </Button>
            </div>
            {restoreCandidate ? (
              <section className="restore-confirmation" aria-label={`Confirm restore ${restoreCandidate}`}>
                <div>
                  <strong>Restore {restoreCandidate}?</strong>
                  <span>The production flow would create a new generation and re-run proof.</span>
                </div>
                <div>
                  <Button color="secondary" variant="ghost" size="sm" onClick={() => setRestoreCandidate(null)}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    variant="solid"
                    size="sm"
                    onClick={() => {
                      setHeadlineRefined(restoreCandidate === 'v10');
                      setProofState('needs-checks');
                      setAnnouncement(`Simulated restore of ${restoreCandidate} complete. Proof is now out of date.`);
                      setRestoreCandidate(null);
                      closeSurface();
                    }}
                  >
                    Restore preview
                  </Button>
                </div>
              </section>
            ) : null}
          </Sheet>
        ) : null}

        {surface === 'proof' ? (
          <Sheet surfaceId="proof" title="Proof" eyebrow="Current generation" onClose={closeSurface}>
            <section className={`proof-hero proof-${proofState}`}>
              <div className="proof-emblem"><ShieldCheck /></div>
              <div>
                <Badge
                  color={
                    proofState === 'ready'
                      ? 'success'
                      : proofState === 'checking'
                        ? 'info'
                        : proofState === 'blocked'
                          ? 'danger'
                          : proofState === 'unknown'
                            ? 'secondary'
                            : 'warning'
                  }
                  variant="soft"
                  size="sm"
                >
                  {proof.label}
                </Badge>
                <h3>{proof.detail}</h3>
              </div>
            </section>
            <ol className="proof-stages">
              <li data-state={proofState === 'unknown' || proofState === 'needs-checks' ? 'current' : 'complete'}>
                <span className="proof-stage-icon"><CheckCircle /></span>
                <div><strong>Deterministic checks</strong><span>Structure, source boundary, build contract</span></div>
                <span>{proofState === 'unknown' ? 'Not run' : proofState === 'needs-checks' ? 'Run' : 'Passed'}</span>
              </li>
              <li
                data-state={
                  proofState === 'blocked'
                    ? 'blocked'
                    : proofState === 'checking'
                      ? 'current'
                      : proofState === 'unknown' || proofState === 'needs-checks'
                        ? 'waiting'
                        : 'complete'
                }
              >
                <span className="proof-stage-icon"><Desktop /></span>
                <div><strong>Browser proof</strong><span>Current canvas generation</span></div>
                <span>
                  {proofState === 'blocked'
                    ? 'Failed'
                    : proofState === 'checking'
                      ? 'Running'
                      : proofState === 'unknown' || proofState === 'needs-checks'
                        ? 'Waiting'
                        : 'Passed'}
                </span>
              </li>
              <li data-state={proofState === 'needs-review' ? 'current' : proofState === 'ready' ? 'complete' : 'waiting'}>
                <span className="proof-stage-icon"><Search /></span>
                <div><strong>Fresh Review</strong><span>Independent, exact generation</span></div>
                <span>{proofState === 'ready' ? 'Passed' : proofState === 'needs-review' ? 'Review' : 'Waiting'}</span>
              </li>
              <li data-state={proofState === 'ready' ? 'current' : 'waiting'}>
                <span className="proof-stage-icon"><Branch /></span>
                <div><strong>Release readiness</strong><span>Intel package remains a production gate</span></div>
                <span>{proofState === 'ready' ? 'Ready' : 'Blocked'}</span>
              </li>
            </ol>
            {proofState === 'blocked' ? (
              <section className="proof-blocker" role="status">
                <strong>Compact viewport footer exceeds its safe area.</strong>
                <span>Adjust the responsive boundary before asking for another review.</span>
              </section>
            ) : null}
            <div className="proof-primary-action">
              {proofState === 'unknown' || proofState === 'needs-checks' || proofState === 'checking' || proofState === 'blocked' ? (
                <Button
                  color="primary"
                  variant="solid"
                  size="lg"
                  block
                  loading={proofState === 'checking'}
                  onClick={runProof}
                >
                  <ShieldCheck />
                  {proofState === 'blocked'
                    ? 'Retry current checks'
                    : proofState === 'unknown'
                      ? 'Run first proof'
                      : 'Run current checks'}
                </Button>
              ) : proofState === 'needs-review' ? (
                <Button color="primary" variant="solid" size="lg" block onClick={completeReview}>
                  <Search /> Start Fresh Review
                </Button>
              ) : (
                <Button
                  color="primary"
                  variant="solid"
                  size="lg"
                  block
                  onClick={() => {
                    setAgentState('approval');
                    openSurface('codex');
                  }}
                >
                  <Branch /> Prepare release
                </Button>
              )}
            </div>
            <details className="technical-details">
              <summary>Evidence details</summary>
              <pre>{`generation: preview-${activeVersion}\nsource authority: unchanged\nintel gate: required in production\nstate: simulated`}</pre>
              <div className="proof-scenarios" role="group" aria-label="Concept proof scenarios">
                <span>Preview edge state</span>
                <Button color="secondary" variant="ghost" size="sm" onClick={() => setProofState('unknown')}>
                  Unknown
                </Button>
                <Button color="danger" variant="ghost" size="sm" onClick={() => setProofState('blocked')}>
                  Blocked
                </Button>
              </div>
            </details>
          </Sheet>
        ) : null}

        {surface === 'codex' ? (
          <Sheet surfaceId="codex" title="Monument activity" eyebrow="Codex" onClose={closeSurface}>
            <section className="codex-summary">
              <span className={`activity-icon activity-${agentState}`}>
                {agentState === 'working' ? <Sparkles /> : agentState === 'approval' ? <Stop /> : <CheckCircle />}
              </span>
              <div>
                <h3>
                  {agentState === 'working'
                    ? 'Working on the heading'
                    : agentState === 'approval'
                      ? 'Waiting for approval'
                      : agentState === 'complete'
                        ? 'Change complete'
                        : 'No active work'}
                </h3>
                <p>
                  {agentState === 'approval'
                    ? 'Preparing a release crosses a privileged boundary. The concept stops here.'
                    : 'Task detail stays close to the result and out of the default canvas.'}
                </p>
              </div>
            </section>
            <ol className="activity-steps">
              <li className="is-complete"><CheckCircle /> Read selected element <span>0.2s</span></li>
              <li className={agentState === 'idle' ? '' : 'is-complete'}><CheckCircle /> Plan bounded change <span>0.4s</span></li>
              <li className={agentState === 'working' ? 'is-active' : agentState === 'idle' ? '' : 'is-complete'}>
                <Sparkles /> Update preview <span>{agentState === 'working' ? 'Now' : '1.0s'}</span>
              </li>
              <li className={agentState === 'complete' || agentState === 'approval' ? 'is-complete' : ''}>
                <ShieldCheck /> Validate result <span>{agentState === 'complete' || agentState === 'approval' ? 'Passed' : 'Waiting'}</span>
              </li>
            </ol>
            {agentState === 'approval' ? (
              <div className="approval-card">
                <strong>Production approval required</strong>
                <p>This preview does not commit, push, package, or publish anything.</p>
                <div>
                  <Button color="secondary" variant="outline" size="md" onClick={() => setAgentState('complete')}>
                    Cancel
                  </Button>
                  <Button color="primary" variant="solid" size="md" disabled>
                    Approve in production
                  </Button>
                </div>
              </div>
            ) : null}
            <details className="technical-details">
              <summary>Protocol details</summary>
              <pre>{`transport: simulated\ntools: none\nnetwork: disabled\nproject writes: none`}</pre>
            </details>
          </Sheet>
        ) : null}

        {surface === 'command' ? (
          <div
            className="command-scrim"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSurface();
            }}
          >
            <section
              className="command-palette"
              data-transient-surface="command"
              role="dialog"
              aria-modal="true"
              aria-label="Commands"
            >
              <div className="command-search">
                <Search />
                <input
                  ref={commandInputRef}
                  data-surface-autofocus
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setCommandIndex((current) => Math.min(current + 1, Math.max(visibleCommands.length - 1, 0)));
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setCommandIndex((current) => Math.max(current - 1, 0));
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      runCommand(commandIndex);
                    }
                  }}
                  aria-label="Search commands"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="mon-command-results"
                  aria-activedescendant={visibleCommands[commandIndex] ? `mon-command-${commandIndex}` : undefined}
                  placeholder="Go to a surface or action…"
                />
                <kbd>esc</kbd>
              </div>
              <div className="command-results" id="mon-command-results" role="listbox" aria-label="Workspace commands">
                <span className="command-group-label">Workspace</span>
                {visibleCommands.map((item, index) => (
                  <button
                    type="button"
                    id={`mon-command-${index}`}
                    className={`command-item ${commandIndex === index ? 'is-active' : ''}`}
                    role="option"
                    aria-selected={commandIndex === index}
                    key={item.label}
                    onMouseEnter={() => setCommandIndex(index)}
                    onClick={() => {
                      runCommand(index);
                    }}
                  >
                    <span className="command-icon">{item.icon}</span>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    <kbd>{item.shortcut}</kbd>
                  </button>
                ))}
                {visibleCommands.length === 0 ? (
                  <p className="command-empty">No matching workspace action.</p>
                ) : null}
              </div>
              <footer className="command-footer">
                <span><Keyboard /> ↑↓ navigate · enter open</span>
                <a href="./foundation.html">Open foundation lab <ChevronRight /></a>
              </footer>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
