import { useEffect, useMemo, useState } from 'react';
import type { EditorSourceOwnership } from './ownership';
import type { VisualPropertyChange } from './intent';
import type { PreparedVisualSourceEdit } from './sourceTransaction';
import type { PreparedVisualTokenEdit, VisualTokenScope } from './tokenTransaction';
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

export function PropertiesPanel({
  selection,
  layer,
  ownership,
  applying,
  applyMessage,
  sourcePreview,
  tokenPreview,
  tokenScope,
  onTokenScope,
  onApply,
  onConfirmSource,
  onConfirmToken,
  onUseCodex,
  onDismissPrepared,
}: {
  selection: EditorSelection | null;
  layer: EditorLayer | null;
  ownership: EditorSourceOwnership | null;
  applying: boolean;
  applyMessage: string | null;
  sourcePreview: PreparedVisualSourceEdit | null;
  tokenPreview: PreparedVisualTokenEdit | null;
  tokenScope: VisualTokenScope;
  onTokenScope: (scope: VisualTokenScope) => void;
  onApply: (changes: VisualPropertyChange[]) => Promise<boolean>;
  onConfirmSource: () => Promise<boolean>;
  onConfirmToken: () => Promise<boolean>;
  onUseCodex: () => Promise<boolean>;
  onDismissPrepared: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(selection, layer));

  useEffect(() => {
    setDraft(initialDraft(selection, layer));
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

  const hasPrepared = Boolean(sourcePreview || tokenPreview);
  const changeDraft = (key: string, value: string) => {
    if (hasPrepared) onDismissPrepared();
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const reset = () => {
    if (hasPrepared) onDismissPrepared();
    setDraft(initialDraft(selection, layer));
  };
  const applyChanges = async () => {
    if (!changes.length || applying) return;
    if (await onApply(changes)) setDraft(initialDraft(selection, layer));
  };
  const confirmSource = async () => {
    if (!sourcePreview || applying) return;
    if (await onConfirmSource()) setDraft(initialDraft(selection, layer));
  };
  const confirmToken = async () => {
    if (!tokenPreview || applying) return;
    if (await onConfirmToken()) setDraft(initialDraft(selection, layer));
  };
  const useCodex = async () => {
    if (!hasPrepared || applying) return;
    if (await onUseCodex()) setDraft(initialDraft(selection, layer));
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
  const selectedTokenPlan = tokenPreview ? (tokenScope === 'element' ? tokenPreview.elementPlan : tokenPreview.tokenPlan) : null;

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
          <div className="property-text-warning">Direct text exceeds the safe editor limit. Use the prompt for this text change so Codex can inspect the complete source before editing.</div>
        ) : null}

        {GROUPS.map((group) => <PropertyGroup key={group.title} group={group} selection={selection} draft={draft} onChange={changeDraft} />)}

        {sourcePreview ? (
          <section className="property-direct-source-card">
            <div className="property-direct-source-head">
              <div><strong>Direct source edit</strong><span>Deterministic · {Math.round(sourcePreview.plan.confidence * 100)}%</span></div>
              <code>{sourcePreview.plan.sourcePath}:{sourcePreview.plan.line}</code>
            </div>
            <div className="property-source-diff">
              <div><span>Before</span><pre>{sourcePreview.plan.previewBefore}</pre></div>
              <div><span>After</span><pre>{sourcePreview.plan.previewAfter}</pre></div>
            </div>
            <p>Monument proved one unique live <code>#{selection.id}</code>-owned literal CSS declaration. Apply re-checks the live ID scope, file fingerprint and source range before one atomic write.</p>
          </section>
        ) : null}

        {tokenPreview && selectedTokenPlan ? (
          <section className={`property-token-source-card ${tokenScope === 'token' ? 'global' : 'element'}`}>
            <div className="property-token-source-head">
              <div><strong>Design token</strong><code>{tokenPreview.tokenName}</code></div>
              <span>~{tokenPreview.usageCount} source mention{tokenPreview.usageCount === 1 ? '' : 's'}</span>
            </div>
            <div className="property-token-scope" role="group" aria-label="Design token edit scope">
              <button type="button" className={tokenScope === 'element' ? 'active' : ''} disabled={applying} onClick={() => onTokenScope('element')}>
                <strong>This element</strong><span>Detach token here</span>
              </button>
              <button type="button" className={tokenScope === 'token' ? 'active' : ''} disabled={applying} onClick={() => onTokenScope('token')}>
                <strong>Token {tokenPreview.tokenName}</strong><span>Global source change</span>
              </button>
            </div>
            <div className="property-direct-source-head token-path"><code>{selectedTokenPlan.sourcePath}:{selectedTokenPlan.line}</code><span>{tokenScope === 'token' ? 'global :root' : `#${selection.id}`}</span></div>
            <div className="property-source-diff">
              <div><span>Before</span><pre>{selectedTokenPlan.previewBefore}</pre></div>
              <div><span>After</span><pre>{selectedTokenPlan.previewAfter}</pre></div>
            </div>
            <p>{tokenScope === 'token'
              ? `This intentionally changes ${tokenPreview.tokenName} at its proved global :root definition and may affect every use. Monument will re-plan the same token scope before writing.`
              : `This changes only #${selection.id} by replacing its ${tokenPreview.tokenName} reference with the requested literal value. The global token stays unchanged.`}</p>
          </section>
        ) : null}

        <section className="property-source-note">
          <strong>Source-authoritative editing</strong>
          <span>Apply tries the lowest-risk deterministic path first. Literal CSS writes require one exact owner. Token-backed values require a proved reference plus a proved global definition and an explicit scope choice. Everything ambiguous remains Codex-backed.</span>
        </section>
      </div>

      <div className={`property-apply-bar ${changes.length ? 'dirty' : ''} ${hasPrepared ? 'direct-ready' : ''}`}>
        <div>
          <strong>{tokenPreview ? `Choose ${tokenPreview.tokenName} scope` : sourcePreview ? 'Direct edit ready' : changes.length ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'No changes'}</strong>
          <span>{applyMessage || (changes.length ? 'Ready to update real source' : 'Edit a property above')}</span>
        </div>
        {changes.length ? <button type="button" className="secondary" disabled={applying} onClick={reset}>Reset</button> : null}
        {hasPrepared ? <button type="button" className="secondary" disabled={applying} onClick={() => void useCodex()}>Use Codex</button> : null}
        <button type="button" disabled={!changes.length || applying} onClick={() => void (sourcePreview ? confirmSource() : tokenPreview ? confirmToken() : applyChanges())}>
          {applying ? (hasPrepared ? 'Applying…' : 'Planning…') : hasPrepared ? 'Apply source' : 'Apply'}
        </button>
      </div>
    </aside>
  );
}
