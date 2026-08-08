pub const PREVIEW_EDITOR_SCRIPT: &str = r#"
(() => {
  const allowed = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1';
  if (!allowed || window.__MONUMENT_EDITOR__) return;

  const MAX_LAYERS = 600;
  const MAX_DEPTH = 18;
  const idByElement = new WeakMap();
  const elementById = new Map();
  let nextId = 1;
  let active = false;
  let treeTimer = 0;
  let hoverOverlay = null;
  let selectedOverlay = null;
  let selectedId = null;
  let lastCanvasHoverId = null;

  function invoke() {
    return window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
  }

  function send(kind, payload) {
    const call = invoke();
    if (typeof call !== 'function') return false;
    call('preview_editor_emit', { message: { kind, payload } }).catch(() => {});
    return true;
  }

  function nodeId(element) {
    let id = idByElement.get(element);
    if (!id) {
      id = `m-${nextId++}`;
      idByElement.set(element, id);
      elementById.set(id, element);
    }
    return id;
  }

  function pruneIds() {
    for (const [id, element] of elementById) {
      if (!(element instanceof Element) || !element.isConnected) elementById.delete(id);
    }
  }

  function editorNode(element) {
    return element instanceof Element && (element.hasAttribute('data-monument-inspector') || element.hasAttribute('data-monument-editor'));
  }

  function ensureOverlays() {
    if (hoverOverlay?.isConnected && selectedOverlay?.isConnected) return;
    hoverOverlay = document.createElement('div');
    selectedOverlay = document.createElement('div');
    hoverOverlay.setAttribute('data-monument-editor', 'hover');
    selectedOverlay.setAttribute('data-monument-editor', 'selected');
    for (const [node, color, width] of [[hoverOverlay, '#70a7ff', '1px'], [selectedOverlay, '#d9f56a', '2px']]) {
      Object.assign(node.style, {
        position: 'fixed',
        zIndex: '2147483646',
        pointerEvents: 'none',
        display: 'none',
        border: `${width} solid ${color}`,
        borderRadius: '3px',
        boxSizing: 'border-box',
        boxShadow: color === '#d9f56a' ? '0 0 0 1px rgba(0,0,0,.18)' : 'none',
      });
      document.documentElement.appendChild(node);
    }
  }

  function draw(overlay, element) {
    ensureOverlays();
    if (!overlay || !(element instanceof Element) || !element.isConnected) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    const rect = element.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: rect.width > 0 && rect.height > 0 ? 'block' : 'none',
      left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    });
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function selectorFor(element) {
    if (!(element instanceof Element)) return '';
    if (element.id) return `#${cssEscape(element.id)}`;
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 7) {
      let part = current.tagName.toLowerCase();
      const stableClasses = [...current.classList]
        .filter((name) => name && name.length < 64 && !/^(css-|sc-|jsx-)/.test(name))
        .slice(0, 2);
      if (stableClasses.length) part += stableClasses.map((name) => `.${cssEscape(name)}`).join('');
      const parent = current.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = parent;
      if (current?.id) {
        parts.unshift(`#${cssEscape(current.id)}`);
        break;
      }
    }
    return parts.join(' > ');
  }

  function compactText(element, limit = 180) {
    const raw = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    return raw.slice(0, limit);
  }

  function directText(element) {
    const text = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 180);
  }

  function accessibleName(element) {
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('alt') ||
      element.getAttribute('title') ||
      (element instanceof HTMLInputElement ? element.placeholder : '') ||
      directText(element) ||
      compactText(element, 120)
    ).slice(0, 180);
  }

  const semanticTags = new Set(['body','main','header','footer','nav','aside','section','article','form','button','a','input','textarea','select','img','picture','video','canvas','svg','h1','h2','h3','h4','h5','h6','p','ul','ol','li','table','dialog']);
  const controlTags = new Set(['button','a','input','textarea','select','option','label']);
  const textTags = new Set(['h1','h2','h3','h4','h5','h6','p','span','strong','em','small','label','button','a']);

  function visible(element, style, rect) {
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
  }

  function meaningful(element, style, rect) {
    if (element === document.body) return true;
    if (!visible(element, style, rect)) return false;
    const tag = element.tagName.toLowerCase();
    if (semanticTags.has(tag) || element.hasAttribute('role') || element.id) return true;
    if (style.display === 'flex' || style.display === 'grid' || style.display === 'inline-flex' || style.display === 'inline-grid') return true;
    if (directText(element).length > 0) return true;
    if (element.children.length > 1 && rect.width >= 40 && rect.height >= 20) return true;
    return false;
  }

  function kindOf(element, style) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'img' || tag === 'picture' || tag === 'video' || tag === 'svg' || tag === 'canvas') return 'media';
    if (controlTags.has(tag) || element.hasAttribute('role')) return 'control';
    if (textTags.has(tag) && directText(element)) return 'text';
    if (style.display.includes('flex') || style.display.includes('grid') || element.children.length) return 'container';
    return 'element';
  }

  function rectPayload(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function layerFor(element, parentId, depth) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    return {
      id: nodeId(element), parentId, depth, tag,
      kind: kindOf(element, style),
      role: element.getAttribute('role'),
      name: accessibleName(element),
      text: directText(element),
      selector: selectorFor(element),
      classes: [...element.classList].slice(0, 8),
      rect: rectPayload(rect),
      visible: visible(element, style, rect),
      display: style.display,
      position: style.position,
      editable: {
        text: Boolean(directText(element)),
        media: tag === 'img' || tag === 'video',
        layout: element.children.length > 0 || style.display.includes('flex') || style.display.includes('grid'),
        style: true,
      },
    };
  }

  function treeSnapshot() {
    pruneIds();
    const nodes = [];
    const rootIds = [];
    let truncated = false;

    function walk(element, nearestParentId, depth) {
      if (!(element instanceof Element) || editorNode(element) || depth > MAX_DEPTH || truncated) return;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const include = meaningful(element, style, rect);
      let nextParent = nearestParentId;
      let nextDepth = depth;
      if (include) {
        if (nodes.length >= MAX_LAYERS) { truncated = true; return; }
        const layer = layerFor(element, nearestParentId, depth);
        nodes.push(layer);
        if (!nearestParentId) rootIds.push(layer.id);
        nextParent = layer.id;
        nextDepth = depth + 1;
      }
      for (const child of element.children) walk(child, nextParent, nextDepth);
    }

    if (document.body) walk(document.body, null, 0);
    return {
      url: location.href,
      capturedAt: Date.now(),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      nodes, rootIds, truncated,
    };
  }

  function selectionPayload(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const parent = element.parentElement;
    return {
      nodeId: nodeId(element),
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      classes: [...element.classList].slice(0, 12),
      role: element.getAttribute('role'),
      accessibleName: accessibleName(element),
      text: compactText(element, 480),
      selector: selectorFor(element),
      rect: rectPayload(rect),
      parent: parent ? { tag: parent.tagName.toLowerCase(), selector: selectorFor(parent) } : null,
      styles: {
        display: style.display, position: style.position,
        width: style.width, height: style.height,
        minWidth: style.minWidth, maxWidth: style.maxWidth,
        minHeight: style.minHeight, maxHeight: style.maxHeight,
        marginTop: style.marginTop, marginRight: style.marginRight, marginBottom: style.marginBottom, marginLeft: style.marginLeft,
        paddingTop: style.paddingTop, paddingRight: style.paddingRight, paddingBottom: style.paddingBottom, paddingLeft: style.paddingLeft,
        gap: style.gap, rowGap: style.rowGap, columnGap: style.columnGap,
        flexDirection: style.flexDirection, flexWrap: style.flexWrap,
        alignItems: style.alignItems, justifyContent: style.justifyContent,
        gridTemplateColumns: style.gridTemplateColumns, gridTemplateRows: style.gridTemplateRows,
        color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
        lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textAlign: style.textAlign,
        border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow,
        opacity: style.opacity, overflow: style.overflow, zIndex: style.zIndex,
      },
    };
  }

  function emitTree() {
    if (!active) return;
    send('tree', treeSnapshot());
  }

  function scheduleTree() {
    if (!active) return;
    clearTimeout(treeTimer);
    treeTimer = setTimeout(emitTree, 220);
  }

  function requestTree() {
    active = true;
    emitTree();
  }

  function setActive(next) {
    active = Boolean(next);
    document.documentElement.style.cursor = active ? 'default' : '';
    if (active) emitTree();
    else {
      clearTimeout(treeTimer);
      lastCanvasHoverId = null;
      if (hoverOverlay) hoverOverlay.style.display = 'none';
      if (selectedOverlay) selectedOverlay.style.display = 'none';
    }
    return active;
  }

  function selectElement(element) {
    if (!(element instanceof Element) || !element.isConnected || editorNode(element)) return false;
    const id = nodeId(element);
    selectedId = id;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    requestAnimationFrame(() => draw(selectedOverlay, element));
    send('selection', selectionPayload(element));
    return true;
  }

  function select(id) {
    const element = elementById.get(id);
    if (!selectElement(element)) {
      scheduleTree();
      return false;
    }
    return true;
  }

  function hover(id) {
    if (!id) {
      if (hoverOverlay) hoverOverlay.style.display = 'none';
      send('hover', { nodeId: null });
      return true;
    }
    const element = elementById.get(id);
    if (!(element instanceof Element) || !element.isConnected) return false;
    draw(hoverOverlay, element);
    send('hover', { nodeId: id });
    return true;
  }

  function elementAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    return element instanceof Element && !editorNode(element) ? element : null;
  }

  function onCanvasMove(event) {
    if (!active) return;
    const element = elementAtPoint(event.clientX, event.clientY);
    if (!element) return;
    const id = nodeId(element);
    draw(hoverOverlay, element);
    if (id !== lastCanvasHoverId) {
      lastCanvasHoverId = id;
      send('hover', { nodeId: id });
    }
  }

  function onCanvasLeave() {
    if (!active) return;
    lastCanvasHoverId = null;
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    send('hover', { nodeId: null });
  }

  function onCanvasClick(event) {
    if (!active) return;
    const element = elementAtPoint(event.clientX, event.clientY);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    selectElement(element);
  }

  const mutationObserver = new MutationObserver(scheduleTree);
  function observe() {
    if (!document.documentElement) return;
    mutationObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();

  document.addEventListener('pointermove', onCanvasMove, true);
  document.addEventListener('pointerleave', onCanvasLeave, true);
  document.addEventListener('click', onCanvasClick, true);
  window.addEventListener('scroll', () => {
    if (selectedId) draw(selectedOverlay, elementById.get(selectedId));
  }, true);
  window.addEventListener('resize', () => {
    if (selectedId) draw(selectedOverlay, elementById.get(selectedId));
    scheduleTree();
  });

  window.__MONUMENT_EDITOR__ = { requestTree, setActive, select, hover };
  send('ready', { url: location.href, at: Date.now() });
})();
"#;
