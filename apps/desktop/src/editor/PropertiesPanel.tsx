import { useEffect, useMemo, useState } from 'react';
import type { EditorSourceOwnership } from './ownership';
import type { VisualPropertyChange } from './intent';
import {
  probeVisualMarkupEdit,
  type VisualMarkupDecision,
  type VisualMarkupEditProbe,
} from './markupEditing';
import {
  defaultTokenDecision,
  probeVisualTokenEdit,
  tokenDecisionKey,
  tokenDecisionRequiresGlobalConfirmation,
  type VisualTokenEditDecision,
  type VisualTokenEditProbe,
} from './tokenEditing';
import type { EditorLayer, EditorSelection } from './types';

type PropertySpec = { label: string; key: string; editable?: boolean; wide?: boolean };
type PropertyGroupSpec = { title: string; items: PropertySpec[] };

const GROUPS: PropertyGroupSpec[] = [
  { title: 'Size', items: [
    { label: 'W', key: 'width', editable: true }, { label: 'H', key: 'height', editable: true },
    { label: 'Min W', key: 'minWidth', editable: true }, { label: 'Max W', key: 'maxWidth', editable: true },
    { label: 'Min H', key: 'minHeight', editable: true }, { label: 'Max H', key: 'maxHeight', editable: true },
  ] },
  { title: 'Layout', items: [
    { label: 'Display', key: 'display', editable: true }, { label: 'Position', key: 'position', editable: true },
    { label: 'Direction', key: 'flexDirection', editable: true }, { label: 'Wrap', key: 'flexWrap', editable: true },
    { label: 'Align', key: 'alignItems', editable: true }, { label: 'Justify', key: 'justifyContent', editable: true },
    { label: 'Gap', key: 'gap', editable: true }, { label: 'Columns', key: 'gridTemplateColumns', editable: true, wide: true },
  ] },
  { title: 'Spacing', items: [
    { label: 'P top', key: 'paddingTop', editable: true }, { label: 'P right', key: 'paddingRight', editable: true },
    { label: 'P bottom', key: 'paddingBottom', editable: true }, { label: 'P left', key: 'paddingLeft', editable: true },
    { label: 'M top', key: 'marginTop', editable: true }, { label: 'M right', key: 'marginRight', editable: true },
    { label: 'M bottom', key: 'marginBottom', editable: true }, { label: 'M left', key: 'marginLeft', editable: true },
  ] },
  { title: 'Typography', items: [
    { label: 'Font', key: 'fontFamily', editable: true, wide: true }, { label: 'Size', key: 'fontSize', editable: true },
    { label: 'Weight', key: 'fontWeight', editable: true }, { label: 'Line', key: 'lineHeight', editable: true },
    { label: 'Tracking', key: 'letterSpacing', editable: true }, { label: 'Align', key: 'textAlign', editable: true },
    { label: 'Color', key: 'color', editable: true, wide: true },
  ] },
  { title: 'Appearance', items: [
    { label: 'Fill', key: 'backgroundColor', editable: true, wide: true }, { label: 'Image', key: 'backgroundImage', editable: true, wide: true },
    { label: 'Border', key: 'border', editable: true, wide: true }, { label: 'Radius', key: 'borderRadius', editable: true },
    { label: 'Shadow', key: 'boxShadow', editable: true, wide: true }, { label: 'Opacity', key: 'opacity', editable: true },
    { label: 'Overflow', key: 'overflow', editable: true }, { label: 'Z', key: 'zIndex', editable: true },
  ] },
];

const EDITABLE_KEYS = new Set(GROUPS.flatMap((group) => group.items.filter((item) => item.editable).map((item) => item.key)));
const TEXT_KEY = 'textContent';
const MAX_DRAFT_VALUE = 300;
const MAX_TEXT_VALUE = 1200;

function cleanDraft(value: string, limit = MAX_DRAFT_VALUE): string {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, limit);
}

function canEditText(selection: EditorSelection | null, layer: EditorLayer | null): boolean {
  return Boolean(selection && layer?.editable.text && !selection.directTextTruncated && selection.directText.length > 0);
}

function initialDraft(selection: EditorSelection | null, layer: EditorLayer | null): Record<string, string> {
  if (!selection) return {};
  const values = Object.fromEntries([...EDITABLE_KEYS].map((key) => [key, selection.styles[key] || '']));
  if (canEditText(selection, layer)) values[TEXT_KEY] = selection.directText;
  return values;
}

function ownershipLabel(ownership: EditorSourceOwnership | null): string {
  if (!ownership) return 'Locating source…';
  if (ownership.level === 'likely') return 'Likely source';
  if (ownership.level === 'possible') return 'Possible source';
  if (ownership.level === 'weak') return 'Weak source signal';
  return 'Source unresolved';
}

function PropertyGroup({ group, selection, draft, onChange }: {
  group: PropertyGroupSpec;
  selection: EditorSelection;
  draft: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <section className="property-group">
      <div className="property-group-title">{group.title}</div>
      <div className="property-grid">
        {group.items.map((item) => {
          const observed = selection.styles[item.key] || '';
          const value = draft[item.key] ?? observed;
          const dirty = value.trim() !== observed.trim();
          return (
            <label className={`property-field ${item.wide ? 'wide' : ''} editable ${dirty ? 'dirty' : ''}`} key={item.key} title={`Edit ${item.key}`}>
              <span>{item.label}</span>
              <input
                value={value || '—'}
                spellCheck={false}
                onFocus={(event) => { if (event.currentTarget.value === '—') onChange(item.key, ''); }}
                onChange={(event) => onChange(item.key, cleanDraft(event.target.value))}
              />
              {dirty ? <i className="property-dirty-dot" /> : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}

function TokenScopeCard({ probe, change, decision, onDecision }: {
  probe: VisualTokenEditProbe;
  change: VisualPropertyChange;
  decision: VisualTokenEditDecision;
  onDecision: (decision: VisualTokenEditDecision) => void;
}) {
  const localDefinitions = probe.definitions.filter((definition) =>
    !definition.conditional && definition.scope === 'scoped' && definition.selectedScope,
  );
  const globalDefinitions = probe.definitions.filter((definition) =>
    !definition.conditional && definition.scope === 'global',
  );
  const conditionalDefinitions = probe.definitions.filter((definition) => definition.conditional);
  const currentKey = tokenDecisionKey(decision);
  const selectedDefinition = decision.mode === 'token' ? decision.definition : null;
  const globalConfirmationRequired = tokenDecisionRequiresGlobalConfirmation(probe, decision);
  const beforeLine = decision.mode === 'instance'
    ? `${probe.source?.property || change.property}: ${probe.source?.sourceValue || probe.token}`
    : decision.mode === 'token'
      ? `${probe.token}: ${decision.definition.value}`
      : null;
  const afterLine = decision.mode === 'instance'
    ? `${probe.source?.property || change.property}: ${change.after}`
    : decision.mode === 'token'
      ? `${probe.token}: ${change.after}`
      : null;

  return (
    <section className="property-token-card">
      <div className="property-token-head">
        <div><span className="property-token-badge">Token-backed</span><strong>{probe.token}</strong></div>
        <span>{probe.usageCount} source ref{probe.usageCount === 1 ? '' : 's'}</span>
      </div>
      <div className="property-token-source">
        <code>{probe.source?.path}:{probe.source?.line}</code>
        <span>{probe.reason}</span>
      </div>
      <div className="property-token-choice-title">Change scope</div>
      <div className="property-token-choices">
        <button
          type="button"
          className={currentKey === 'instance' ? 'selected' : ''}
          disabled={!probe.instanceEligible}
          onClick={() => onDecision({ mode: 'instance' })}
        >
          <strong>This element</strong>
          <span>Requires a unique live ID plus an ID-owned source rule. Detach only that proven instance from {probe.token}.</span>
        </button>
        {localDefinitions.map((definition) => {
          const next: VisualTokenEditDecision = { mode: 'token', definition, confirmSharedGlobal: false };
          return (
            <button
              type="button"
              className={currentKey === tokenDecisionKey(next) ? 'selected' : ''}
              key={`local:${definition.path}:${definition.line}:${definition.selector}`}
              onClick={() => onDecision(next)}
            >
              <strong>Local scope · {definition.selector}</strong>
              <span>{definition.path}:{definition.line} · current {definition.value}</span>
            </button>
          );
        })}
        {globalDefinitions.map((definition) => {
          const next: VisualTokenEditDecision = { mode: 'token', definition, confirmSharedGlobal: false };
          return (
            <button
              type="button"
              className={currentKey === tokenDecisionKey(next) ? 'selected global' : 'global'}
              key={`global:${definition.path}:${definition.line}:${definition.selector}`}
              onClick={() => onDecision(next)}
            >
              <strong>Global token</strong>
              <span>{definition.path}:{definition.line} · {probe.usageCount} bounded source ref{probe.usageCount === 1 ? '' : 's'} observed</span>
            </button>
          );
        })}
        <button
          type="button"
          className={currentKey === 'codex' ? 'selected' : ''}
          onClick={() => onDecision({ mode: 'codex' })}
        >
          <strong>Use Codex</strong>
          <span>Keep the source-aware reasoning path for this edit.</span>
        </button>
      </div>
      {conditionalDefinitions.length ? (
        <div className="property-token-warning">
          {conditionalDefinitions.length} responsive/conditional token definition{conditionalDefinitions.length === 1 ? '' : 's'} detected. They stay read-only here until breakpoint-aware authoring exists; use Codex for those scopes.
        </div>
      ) : null}
      {selectedDefinition?.scope === 'global' ? (
        <label className={`property-token-confirm ${globalConfirmationRequired ? 'required' : ''}`}>
          <input
            type="checkbox"
            checked={decision.mode === 'token' && decision.confirmSharedGlobal}
            onChange={(event) => {
              if (decision.mode === 'token') onDecision({ ...decision, confirmSharedGlobal: event.target.checked });
            }}
          />
          <span>I understand this changes a global token. The bounded scans currently observe {probe.usageCount} source ref{probe.usageCount === 1 ? '' : 's'}; live impact may be broader through cascade and inheritance.</span>
        </label>
      ) : null}
      {beforeLine && afterLine ? (
        <div className="property-token-diff" aria-label="Source preview">
          <div><span>−</span><code>{beforeLine}</code></div>
          <div><span>+</span><code>{afterLine}</code></div>
        </div>
      ) : null}
      {probe.truncated ? <div className="property-token-warning">The bounded token scan was truncated. Deterministic token mutation is disabled; use Codex.</div> : null}
    </section>
  );
}

function MarkupSourceCard({ probe, decision, onDecision }: {
  probe: VisualMarkupEditProbe;
  decision: VisualMarkupDecision;
  onDecision: (decision: VisualMarkupDecision) => void;
}) {
  const operation = probe.operation;
  const laneLabel = operation?.lane === 'tailwind' ? 'Tailwind utility' : operation?.lane === 'jsx-style' ? 'JSX inline style' : 'JSX/Tailwind';
  return (
    <section className={`property-markup-card ${probe.mode}`}>
      <div className="property-markup-head">
        <div><span className="property-markup-badge">Source-native</span><strong>{laneLabel}</strong></div>
        {operation ? <span>{operation.ownerKind}</span> : <span>Codex route</span>}
      </div>
      {operation ? <code>{operation.path}:{operation.line}</code> : null}
      <span className="property-markup-copy">{probe.reason}</span>
      {operation ? (
        <div className="property-markup-diff" aria-label="Markup source preview">
          <div><span>−</span><code>{operation.sourceBefore}</code></div>
          <div><span>+</span><code>{operation.sourceAfter}</code></div>
        </div>
      ) : null}
      <div className="property-markup-actions">
        <button
          type="button"
          className={decision === 'direct' ? 'selected' : ''}
          disabled={probe.mode !== 'deterministic' || !operation}
          onClick={() => onDecision('direct')}
        >
          <strong>Apply to source</strong>
          <span>{operation?.lane === 'tailwind' ? 'Replace this proven static utility.' : 'Replace this proven JSX style literal.'}</span>
        </button>
        <button
          type="button"
          className={decision === 'codex' ? 'selected' : ''}
          onClick={() => onDecision('codex')}
        >
          <strong>Use Codex</strong>
          <span>Inspect surrounding component/source semantics before editing.</span>
        </button>
      </div>
    </section>
  );
}

export function PropertiesPanel({ selection, layer, ownership, applying, applyMessage, onApply }: {
  selection: EditorSelection | null;
  layer: EditorLayer | null;
  ownership: EditorSourceOwnership | null;
  applying: boolean;
  applyMessage: string | null;
  onApply: (
    changes: VisualPropertyChange[],
    tokenDecision?: VisualTokenEditDecision,
    markupDecision?: VisualMarkupDecision,
  ) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(selection, layer));
  const [tokenProbe, setTokenProbe] = useState<VisualTokenEditProbe | null>(null);
  const [tokenDecision, setTokenDecision] = useState<VisualTokenEditDecision | null>(null);
  const [markupProbe, setMarkupProbe] = useState<VisualMarkupEditProbe | null>(null);
  const [markupDecision, setMarkupDecision] = useState<VisualMarkupDecision | null>(null);
  const [sourceProbeLoading, setSourceProbeLoading] = useState(false);

  useEffect(() => {
    setDraft(initialDraft(selection, layer));
    setTokenProbe(null);
    setTokenDecision(null);
    setMarkupProbe(null);
    setMarkupDecision(null);
    setSourceProbeLoading(false);
  }, [selection, layer?.text, layer?.editable.text]);

  const changes = useMemo<VisualPropertyChange[]>(() => {
    if (!selection) return [];
    const styleChanges = [...EDITABLE_KEYS].flatMap((property) => {
      const before = selection.styles[property] || '';
      const after = (draft[property] ?? before).trim();
      return after && after !== before.trim() ? [{ property, before, after }] : [];
    });
    if (!canEditText(selection, layer)) return styleChanges;
    const beforeText = selection.directText;
    const afterText = (draft[TEXT_KEY] ?? beforeText).trim();
    return afterText && afterText !== beforeText.trim()
      ? [{ property: TEXT_KEY, before: beforeText, after: afterText }, ...styleChanges]
      : styleChanges;
  }, [draft, layer, selection]);

  useEffect(() => {
    setTokenProbe(null);
    setTokenDecision(null);
    setMarkupProbe(null);
    setMarkupDecision(null);
    if (!selection || changes.length !== 1 || changes[0].property === TEXT_KEY) {
      setSourceProbeLoading(false);
      return;
    }
    let disposed = false;
    setSourceProbeLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const token = await probeVisualTokenEdit(selection, changes[0]);
        if (disposed) return;
        if (token?.eligible) {
          setTokenProbe(token);
          setTokenDecision(defaultTokenDecision(token));
          setMarkupProbe(null);
          setMarkupDecision(null);
          return;
        }
        const markup = await probeVisualMarkupEdit(selection, changes[0]);
        if (disposed) return;
        setTokenProbe(null);
        setTokenDecision(null);
        setMarkupProbe(markup);
        setMarkupDecision(markup ? (markup.mode === 'deterministic' ? 'direct' : 'codex') : null);
      })().finally(() => {
        if (!disposed) setSourceProbeLoading(false);
      });
    }, 180);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [changes, selection]);

  const changeDraft = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const reset = () => {
    setDraft(initialDraft(selection, layer));
    setTokenProbe(null);
    setTokenDecision(null);
    setMarkupProbe(null);
    setMarkupDecision(null);
  };
  const globalConfirmationRequired = Boolean(tokenProbe && tokenDecision && tokenDecisionRequiresGlobalConfirmation(tokenProbe, tokenDecision));
  const applyChanges = async () => {
    if (!changes.length || applying || sourceProbeLoading || globalConfirmationRequired) return;
    const token = tokenProbe ? tokenDecision ?? { mode: 'codex' as const } : undefined;
    const markup = !tokenProbe && markupProbe ? markupDecision ?? 'codex' : undefined;
    if (await onApply(changes, token, markup)) {
      setDraft(initialDraft(selection, layer));
      setTokenProbe(null);
      setTokenDecision(null);
      setMarkupProbe(null);
      setMarkupDecision(null);
    }
  };

  if (!selection) {
    return (
      <aside className="visual-properties-panel" aria-label="Properties">
        <div className="visual-panel-header"><div><strong>Properties</strong><span>Live computed values</span></div></div>
        <div className="properties-empty"><div>◇</div><strong>Select a layer</strong><span>Choose an element on the canvas or in Layers to inspect its real layout and styles.</span></div>
      </aside>
    );
  }

  const textEditable = canEditText(selection, layer);
  const applyStatus = applyMessage
    || (sourceProbeLoading ? 'Inspecting source ownership…'
      : globalConfirmationRequired ? `Confirm global ${tokenProbe?.token || 'token'} scope`
        : tokenProbe ? 'Choose a safe token scope, then apply'
          : markupProbe?.mode === 'deterministic' && markupDecision === 'direct' ? `Direct ${markupProbe.operation?.lane === 'tailwind' ? 'Tailwind' : 'JSX style'} source edit ready`
            : markupProbe ? `Codex fallback · ${markupProbe.reason}`
              : changes.length ? 'Ready to update real source' : 'Edit a property above');

  return (
    <aside className="visual-properties-panel" aria-label="Properties">
      <div className="visual-panel-header">
        <div><strong>Properties</strong><span>{layer?.kind || selection.tag} · source-native</span></div>
        <span className="properties-live">Live</span>
      </div>
      <div className="properties-scroll">
        <section className="property-selection-card">
          <div className="property-selection-name"><span>&lt;{selection.tag}&gt;</span><strong>{selection.accessibleName || layer?.name || selection.text || selection.tag}</strong></div>
          <code>{selection.selector}</code>
          <div className="property-selection-meta">
            <span>{Math.round(selection.rect.width || 0)} × {Math.round(selection.rect.height || 0)}</span>
            {selection.role ? <span>role={selection.role}</span> : null}
            {selection.idUnique ? <span>unique id</span> : null}
            {selection.classes.length ? <span>{selection.classes.length} class{selection.classes.length === 1 ? '' : 'es'}</span> : null}
          </div>
        </section>

        <section className={`property-source-card ${ownership?.level || 'loading'}`}>
          <div className="property-source-head"><strong>{ownershipLabel(ownership)}</strong>{ownership?.primary ? <span>score {ownership.primary.score}</span> : null}</div>
          {ownership?.primary ? <code>{ownership.primary.path}:{ownership.primary.line}</code> : <span className="property-source-copy">Monument is matching runtime evidence against real project source.</span>}
          {ownership ? <span className="property-source-copy">{ownership.detail}</span> : null}
          {ownership?.alternatives.length ? <details><summary>{ownership.alternatives.length} alternative candidate{ownership.alternatives.length === 1 ? '' : 's'}</summary><div>{ownership.alternatives.map((hint) => <code key={`${hint.path}:${hint.line}`}>{hint.path}:{hint.line} · {hint.score}</code>)}</div></details> : null}
        </section>

        {textEditable ? (
          <section className="property-group property-content-group">
            <div className="property-group-title">Content</div>
            <label className={`property-text-field ${(draft[TEXT_KEY] ?? '').trim() !== selection.directText.trim() ? 'dirty' : ''}`}>
              <span>Text</span>
              <textarea
                value={draft[TEXT_KEY] ?? selection.directText}
                maxLength={MAX_TEXT_VALUE}
                onChange={(event) => changeDraft(TEXT_KEY, event.target.value.slice(0, MAX_TEXT_VALUE))}
              />
            </label>
          </section>
        ) : selection.directTextTruncated ? (
          <div className="property-text-warning">Direct text exceeds the safe editor limit. Use the prompt so Codex can inspect the complete source before editing.</div>
        ) : null}

        {GROUPS.map((group) => <PropertyGroup key={group.title} group={group} selection={selection} draft={draft} onChange={changeDraft} />)}

        {tokenProbe && tokenDecision && changes.length === 1 ? (
          <TokenScopeCard probe={tokenProbe} change={changes[0]} decision={tokenDecision} onDecision={setTokenDecision} />
        ) : null}

        {!tokenProbe && markupProbe && markupDecision && changes.length === 1 ? (
          <MarkupSourceCard probe={markupProbe} decision={markupDecision} onDecision={setMarkupDecision} />
        ) : null}

        <section className="property-source-note">
          <strong>Source-authoritative editing</strong>
          <span>Monument routes each edit through the narrowest proven lane: token scope, JSX/Tailwind static ownership, literal CSS, then Codex. Dynamic class composition, spreads, responsive/state variants, custom-component ambiguity and unsupported values never gain deterministic write authority. Every direct edit becomes one Version Timeline generation and invalidates stale evidence.</span>
        </section>
      </div>

      <div className={`property-apply-bar ${changes.length ? 'dirty' : ''}`}>
        <div><strong>{changes.length ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'No changes'}</strong><span>{applyStatus}</span></div>
        {changes.length ? <button type="button" className="secondary" disabled={applying} onClick={reset}>Reset</button> : null}
        <button type="button" disabled={!changes.length || applying || sourceProbeLoading || globalConfirmationRequired} onClick={() => void applyChanges()}>{applying ? 'Applying…' : 'Apply'}</button>
      </div>
    </aside>
  );
}
