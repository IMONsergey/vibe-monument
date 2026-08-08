import { useEffect, useMemo, useState } from 'react';
import type { EditorSourceOwnership } from './ownership';
import type { VisualPropertyChange } from './intent';
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

export function PropertiesPanel({ selection, layer, ownership, applying, applyMessage, onApply }: {
  selection: EditorSelection | null;
  layer: EditorLayer | null;
  ownership: EditorSourceOwnership | null;
  applying: boolean;
  applyMessage: string | null;
  onApply: (changes: VisualPropertyChange[]) => Promise<boolean>;
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

  const changeDraft = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const reset = () => setDraft(initialDraft(selection, layer));
  const applyChanges = async () => {
    if (!changes.length || applying) return;
    if (await onApply(changes)) setDraft(initialDraft(selection, layer));
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

        <section className="property-source-note">
          <strong>Source-authoritative editing</strong>
          <span>Editable fields do not mutate the preview directly. Apply sends the requested property delta plus this live selection through Monument’s normal source/Codex/Timeline/evidence pipeline.</span>
        </section>
      </div>

      <div className={`property-apply-bar ${changes.length ? 'dirty' : ''}`}>
        <div><strong>{changes.length ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'No changes'}</strong><span>{applyMessage || (changes.length ? 'Ready to update real source' : 'Edit a property above')}</span></div>
        {changes.length ? <button type="button" className="secondary" disabled={applying} onClick={reset}>Reset</button> : null}
        <button type="button" disabled={!changes.length || applying} onClick={() => void applyChanges()}>{applying ? 'Queueing…' : 'Apply'}</button>
      </div>
    </aside>
  );
}
