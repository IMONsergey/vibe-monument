import type { EditorLayer, EditorSelection } from './types';

type PropertyRow = { label: string; key: string; value?: string };

function rows(selection: EditorSelection, keys: Array<[string, string]>): PropertyRow[] {
  return keys.map(([label, key]) => ({ label, key, value: selection.styles[key] || '—' }));
}

function PropertyGroup({ title, items }: { title: string; items: PropertyRow[] }) {
  return (
    <section className="property-group">
      <div className="property-group-title">{title}</div>
      <div className="property-grid">
        {items.map((item) => (
          <label className="property-field" key={item.key} title={item.key}>
            <span>{item.label}</span>
            <input value={item.value || '—'} readOnly />
          </label>
        ))}
      </div>
    </section>
  );
}

export function PropertiesPanel({ selection, layer }: { selection: EditorSelection | null; layer: EditorLayer | null }) {
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
        <div><strong>Properties</strong><span>{layer?.kind || selection.tag} · runtime</span></div>
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

        <PropertyGroup title="Size" items={rows(selection, [
          ['W', 'width'], ['H', 'height'], ['Min W', 'minWidth'], ['Max W', 'maxWidth'], ['Min H', 'minHeight'], ['Max H', 'maxHeight'],
        ])} />
        <PropertyGroup title="Layout" items={rows(selection, [
          ['Display', 'display'], ['Position', 'position'], ['Direction', 'flexDirection'], ['Wrap', 'flexWrap'], ['Align', 'alignItems'], ['Justify', 'justifyContent'], ['Gap', 'gap'], ['Columns', 'gridTemplateColumns'],
        ])} />
        <PropertyGroup title="Spacing" items={rows(selection, [
          ['P top', 'paddingTop'], ['P right', 'paddingRight'], ['P bottom', 'paddingBottom'], ['P left', 'paddingLeft'],
          ['M top', 'marginTop'], ['M right', 'marginRight'], ['M bottom', 'marginBottom'], ['M left', 'marginLeft'],
        ])} />
        <PropertyGroup title="Typography" items={rows(selection, [
          ['Font', 'fontFamily'], ['Size', 'fontSize'], ['Weight', 'fontWeight'], ['Line', 'lineHeight'], ['Tracking', 'letterSpacing'], ['Align', 'textAlign'], ['Color', 'color'],
        ])} />
        <PropertyGroup title="Appearance" items={rows(selection, [
          ['Fill', 'backgroundColor'], ['Image', 'backgroundImage'], ['Border', 'border'], ['Radius', 'borderRadius'], ['Shadow', 'boxShadow'], ['Opacity', 'opacity'], ['Overflow', 'overflow'], ['Z', 'zIndex'],
        ])} />

        <section className="property-source-note">
          <strong>Observed runtime values</strong>
          <span>M1 reads the real rendered product. Direct property writes arrive only after Monument can prove the owning source/token; ambiguous edits will route through Codex instead of creating preview-only CSS.</span>
        </section>
      </div>
    </aside>
  );
}
