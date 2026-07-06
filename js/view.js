// Render one view into a mount: a heading + a grid of tesserae laid out by the
// view's `layout`. The single place tile specs become DOM.

import { escapeHtml } from './utils.js';
import { renderTessera, hydrate } from './tesserae.js';
import { renderMermaid } from './diagram.js';
import { enableResize } from './resize.js';

const LAYOUTS = new Set(['stack', 'grid', 'split']);

export function renderView(view, mount) {
  const layout = LAYOUTS.has(view.layout) ? view.layout : 'stack';
  const heading = view.heading || view.title || '';
  const sub = view.subtitle ? `<p class="doc-sub">${escapeHtml(view.subtitle)}</p>` : '';
  const tiles = (view.tesserae || []).map((t, i) => renderTessera(t, i)).join('');

  mount.innerHTML =
    `<div class="view-inner layout-${layout}">` +
      `<header class="view-head"><h1 class="doc-title">${escapeHtml(heading)}</h1>${sub}</header>` +
      `<div class="tessera-grid">${tiles}</div>` +
    `</div>`;

  hydrate(mount);
  enableResize(mount, view);   // drag a tile's corner to change its span (persists via reshape deltas)
  renderMermaid(mount);   // async; fills in when (and if) the lib loads
}
