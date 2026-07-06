// Render one view into a mount: a heading + a grid of tesserae laid out by the
// view's `layout`. The single place tile specs become DOM.

import { escapeHtml } from './utils.js';
import { renderTessera, hydrate } from './tesserae.js';
import { renderMermaid } from './diagram.js';
import { enableResize } from './resize.js';
import { enableDrag } from './drag.js';

const LAYOUTS = new Set(['stack', 'grid', 'split']);

export function renderView(view, mount) {
  const layout = LAYOUTS.has(view.layout) ? view.layout : 'stack';
  const heading = view.heading || view.title || '';
  const sub = view.subtitle ? `<p class="doc-sub">${escapeHtml(view.subtitle)}</p>` : '';
  const specs = view.tesserae || [];
  const tiles = specs.map((t, i) => renderTessera(t, i)).join('');

  // Sticky TOC — panels with enough tiles get a pinned strip of tile titles at the top;
  // click → scroll to the tile. Untitled tiles label by TYPE. Short panels stay clean.
  const TOC_MIN = 4;
  const toc = specs.length >= TOC_MIN
    ? `<nav class="view-toc" aria-label="Panel contents">` +
        specs.map((t, i) => {
          const label = (t && t.title && String(t.title).trim()) ? t.title
            : (t && t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : 'Tile');
          return `<button class="toc-item" type="button" data-ti="${i}" title="${escapeHtml(String(label))}">${escapeHtml(String(label))}</button>`;
        }).join('') +
      `</nav>`
    : '';

  mount.innerHTML =
    `<div class="view-inner layout-${layout}">` +
      toc +
      `<header class="view-head"><h1 class="doc-title">${escapeHtml(heading)}</h1>${sub}</header>` +
      `<div class="tessera-grid">${tiles}</div>` +
    `</div>`;

  mount.querySelectorAll('.toc-item').forEach(btn => btn.addEventListener('click', () => {
    const tile = mount.querySelectorAll('.tessera')[parseInt(btn.dataset.ti, 10)];
    if (tile) tile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  hydrate(mount);
  enableDrag(mount, view);     // drag a tile to rearrange → a trusted overlay patch
  enableResize(mount, view);   // drag a tile's corner to change its span (persists via reshape deltas)
  renderMermaid(mount);   // async; fills in when (and if) the lib loads
}
