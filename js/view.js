// Render one view into a mount: a heading + a grid of tesserae laid out by the
// view's `layout`. The single place tile specs become DOM.

import { escapeHtml } from './utils.js';
import { renderTessera, hydrate } from './tesserae.js';
import { renderMermaid } from './diagram.js';
import { enableResize } from './resize.js';
import { enableDrag } from './drag.js';
import { recordReshape, recordViewReshape, insertReshape, removeReshape } from './state.js';

// A structural tile change (insert/delete) is a host gesture on the surface's own tiles → a TRUSTED
// apply, so the boundary composes it in without stripping provenance the neighbouring tiles carry.
function applyTesserae(view, tesserae, label) {
  document.dispatchEvent(new CustomEvent('mosaic:apply', {
    detail: { overlay: { views: [{ id: view.id, tesserae }] }, label, trusted: true },
  }));
}

const LAYOUTS = new Set(['stack', 'grid', 'split']);
// the layout chip: the model proposes a layout, the human owns it — click cycles, persists.
const MODES = ['stack', 'grid', 'split'];
const MODE_ICON = { stack: '☰', grid: '⊞', split: '◫' };

export function renderView(view, mount) {
  const layout = LAYOUTS.has(view.layout) ? view.layout : 'stack';
  const heading = view.heading || view.title || '';
  const sub = view.subtitle ? `<p class="doc-sub">${escapeHtml(view.subtitle)}</p>` : '';
  const specs = view.tesserae || [];
  const tiles = specs.map((t, i) => renderTessera(t, i)).join('');

  // Sticky TOC — panels with enough tiles get a pinned strip of tile titles at the top;
  // click → scroll to the tile. Untitled tiles label by TYPE. Short panels stay clean.
  // Spacers are gaps, not content — they don't earn a TOC entry (but keep their real index for data-ti).
  const TOC_MIN = 4;
  const toc = specs.filter(t => t && t.type !== 'spacer').length >= TOC_MIN
    ? `<nav class="view-toc" aria-label="Panel contents">` +
        specs.map((t, i) => {
          if (t && t.type === 'spacer') return '';
          const label = (t && t.title && String(t.title).trim()) ? t.title
            : (t && t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : 'Tile');
          return `<button class="toc-item" type="button" data-ti="${i}" title="${escapeHtml(String(label))}">${escapeHtml(String(label))}</button>`;
        }).join('') +
      `</nav>`
    : '';

  // Concept views (any tile carrying okf) keep a reading measure even in grid layout —
  // full-app-wide text columns aren't a calm reading surface.
  const okfView = specs.some(t => t && t.okf) ? ' view-okf' : '';
  mount.innerHTML =
    `<div class="view-inner layout-${layout}${okfView}">` +
      toc +
      `<header class="view-head"><h1 class="doc-title">${escapeHtml(heading)}</h1>${sub}` +
        `<button class="layout-toggle" type="button" title="Switch layout (stack reads, grid/split resize) — persists">${MODE_ICON[layout]} ${layout}</button>` +
        `<button class="blank-add" type="button" title="Insert a blank tile — a gap you can drag into place, resize, or remove">＋ blank</button>` +
      `</header>` +
      `<div class="tessera-grid">${tiles}</div>` +
    `</div>`;

  mount.querySelector('.layout-toggle')?.addEventListener('click', () => {
    const next = MODES[(MODES.indexOf(layout) + 1) % MODES.length];
    recordViewReshape(view.id, { layout: next });    // the override outlives reloads + re-renders
    renderView({ ...view, layout: next }, mount);    // repaint this mount now
  });

  // ＋ blank — append a spacer, then drag it where you want the gap. Insert at the end so no
  // existing reshape delta shifts (insertReshape is still correct for a mid-insert later).
  mount.querySelector('.blank-add')?.addEventListener('click', () => {
    const at = (view.tesserae || []).length;
    insertReshape(view.id, at);
    applyTesserae(view, [...(view.tesserae || []), { type: 'spacer', span: 1 }], 'blank added');
  });

  // × on a spacer — remove that tile and pull the reshape map down past it.
  mount.querySelectorAll('.t-del').forEach(btn => btn.addEventListener('click', () => {
    const idx = [...mount.querySelectorAll('.tessera-grid .tessera')].indexOf(btn.closest('.tessera'));
    if (idx < 0) return;
    removeReshape(view.id, idx);
    applyTesserae(view, (view.tesserae || []).filter((_, j) => j !== idx), 'blank removed');
  }));

  mount.querySelectorAll('.toc-item').forEach(btn => btn.addEventListener('click', () => {
    const tile = mount.querySelectorAll('.tessera')[parseInt(btn.dataset.ti, 10)];
    if (tile) tile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  hydrate(mount);

  // Collapse — fold a tile to its title bar; persists via the same reshape deltas as resize.
  mount.querySelectorAll('.tessera').forEach((tile, i) => {
    const fold = tile.querySelector('.t-fold');
    if (!fold) return;
    fold.addEventListener('click', () => {
      const on = tile.classList.toggle('collapsed');
      fold.textContent = on ? '▸' : '▾';
      fold.title = on ? 'Expand' : 'Collapse';
      fold.setAttribute('aria-expanded', on ? 'false' : 'true');
      recordReshape(view.id, i, { collapsed: on });
    });
  });

  enableDrag(mount, view);     // drag a tile to rearrange → a trusted overlay patch
  enableResize(mount, view);   // drag a tile's corner to change its span (persists via reshape deltas)
  renderMermaid(mount);   // async; fills in when (and if) the lib loads
}
