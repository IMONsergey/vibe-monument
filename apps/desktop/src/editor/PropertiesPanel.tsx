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
    { label: 'Display', key: 'display' }, { label: 'Position', key: 'position' },
    { label: 'Direction', key: 'flexDirection', editable: true }, { label: 'Wrap', key: 'flexWrap', editable: true },
    { label: 'Align', key: 'alignItems', editable: true }, { label: 'Justify', key: 'justifyContent', editable: true },
    { label: 'Gap', key: 'gap', editable: true }, { label: 'Columns', key: 'gridTemplateColumns' },
  ] },
  { title: 'Spacing', items: [
    { label: 'P top', key: 'paddingTop', editable: true }, { label: 'P right', key: 'paddingRight', editable: true },
    { label: 'P bottom', key: 'paddingBottom', editable: true }, { label: 'P left', key: 'paddingLeft', editable: true },
    { label: 'M top', key: 'marginTop', editable: true }, { label: 'M right', key: 'marginRight', editable: true },
    { label: 'M bottom', key: 'marginBottom', editable: true }, { label: 'M left', key: 'marginLeft', editable: true },
  ] },
  { title: 'Typography', items: [
    { label: 'Font', key: 'fontFamily', wide: true }, { label: 'Size', key: 'fontSize', editable: true },
    { label: 'Weight', key: 'fontWeight', editable: true }, { label: 'Line', key: 'lineHeight', editable: true },
    { label: 'Tracking', key: 'letterSpacing', editable: true }, { label: 'Align', key: 'textAlign', editable: true },
    { label: 'Color', key: 'color', editable: true, wide: true },
  ] },
  { title: 'Appearance', items: [
    { label: 'Fill', key: 'backgroundColor', editable: true, wide: true }, { label: 'Image', key: 'backgroundImage', wide: true },
    { label: 'Border', key: 'border' }, { label: 'Radius', key: 'borderRadius', editable: true },
    { label: 'Shadow', key: 'boxShadow', wide: true }, { label: 'Opacity', key: 'opacity', editable: true },
    { label: 'Overflow', key: 'overflow', editable: true }, { label: 'Z', key: 'zIndex', editable: true },
  ] },
];

const EDITABLE_KEYS = new Set(GROUPS.flatMap((group) => group.items.filter((item) => item.editable).map((item) => item.key)));
const MAX_DRAFT_VALUE = 300;

function cleanDraft(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, MAX_DRAFT_VALUE);
}

function initialDraft(selection: EditorSelection | null): Record<string, string> {
  if (!selection) return {};
  return Object.fromEntries([...EDITABLE_KEYS].map((key) => [key, selection.styles[key] || '']));
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
          const value = item.editable ? (draft[item.key] ?? observed) : observed;
          const dirty = item.editable && value.trim() !== observed.trim();
          return (
            <label className={`property-field ${item.wide ? 'wide' : ''} ${item.editable ? 'editable' : 'readonly'} ${dirty ? 'dirty' : ''}`} key={item.key} title={item.editable ? `Edit ${item.key}` : `${item.key} · observed runtime value`}>
              <span>{item.label}</span>
              <input
                value={value || '—'}
                readOnly={!item.editable}
                spellCheck={false}
                onFocus={(event) => { if (item.editable && event.currentTarget.value === '—') onChange(item.key, ''); }}
                onChange={item.editable ? (event) => onChange(item.key, cleanDraft(event.target.value)) : undefined}
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
  onApply: (changes: VisualPropertyChange[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(selection));

  useEffect(() => {
    setDraft(initialDraft(selection));
  }, [selection]);

  const changes = useMemo<VisualPropertyChange[]>(() => {
    if (!selection) return [];
    return [...EDITABLE_KEYS].flatMap((property) => {
      const before = selection.styles[property] || '';
      const after = (draft[property] ?? before).trim();
      return after && after !== before.trim() ? [{ property, before, after }] : [];
    });
  }, [draft, selection]);

  const changeDraft = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const reset = () => setDraft(initialDraft(selection));
  const applyChanges = async () => {
    if (!changes.length || applying) return;
    await onApply(changes);
    setDraft(initialDraft(selection));
  };

  if (!selection) {
    return (
      <aside className="visual-properties-panel" aria-label="Properties">
        <div className="visual-panel-header"><div><strong>Properties</strong><span>Live computed values</span></div></div>
        <div className="properties-empty"><div>◇</div><strong>Select a layer</strong><span>Choose an element on the canvas or in Layers to inspect its real layout and styles.</span></div>
      </aside>
    );
  }

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

        {GROUPS.map((group) => <PropertyGroup key={group.title} group={group} selection={selection} draft={draft} onChange={changeDraft} />)}

        <section className="property-source-note">
          <strong>Source-authoritative editing</strong>
          <span>Editable fields do not mutate the preview directly. Apply sends the requested property delta plus this live selection through Monument’s normal source/Codex/Timeline/evidence pipeline.</span>
        </section>
      </div>

      <div className={`property-apply-bar ${changes.length ? 'dirty' : ''}`}>
        <div><strong>{changes.length ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'No changes'}</strong><span>{applyMessage || (changes.length ? 'Ready to update real source' : 'Edit an enabled property above')}</span></div>
        {changes.length ? <button type="button" className="secondary" disabled={applying} onClick={reset}>Reset</button> : null}
        <button type="button" disabled={!changes.length || applying} onClick={() => void applyChanges()}>{applying ? 'Queueing…' : 'Apply'}</button>
      </div>
    </aside>
  );
}
