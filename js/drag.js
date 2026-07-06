// js/drag.js — drag-to-rearrange tiles within a view. A drop reorders the view's tesserae
// and dispatches `mosaic:apply` — the SAME boundary the model edits through — so the new
// arrangement validates, composes, and persists (sessionStorage). Native HTML5 DnD; the
// reorder is pure + tested. Drag is suppressed from interactive controls.

export function reorder(list, from, to) {
  const a = Array.isArray(list) ? list.slice() : [];
  if (from < 0 || to < 0 || from >= a.length || to >= a.length || from === to) return a;
  const [moved] = a.splice(from, 1);
  a.splice(to, 0, moved);
  return a;
}

const INTERACTIVE = 'button, input, textarea, select, a, .task-item, .t-copy, .tessera-resize';

export function enableDrag(mount, view) {
  const grid = mount && mount.querySelector('.tessera-grid');
  if (!grid || !view || !Array.isArray(view.tesserae)) return;
  const tiles = [...grid.querySelectorAll('.tessera')];
  let from = null;
  const clearMarks = () => grid.querySelectorAll('.drop-target').forEach((t) => t.classList.remove('drop-target'));

  tiles.forEach((tile, i) => {
    tile.setAttribute('draggable', 'true');
    tile.addEventListener('dragstart', (e) => {
      if (e.target.closest(INTERACTIVE)) { e.preventDefault(); return; }
      from = i; tile.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch { /* some browsers */ }
    });
    tile.addEventListener('dragend', () => { tile.classList.remove('dragging'); clearMarks(); from = null; });
    tile.addEventListener('dragover', (e) => { if (from == null || from === i) return; e.preventDefault(); clearMarks(); tile.classList.add('drop-target'); });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
    tile.addEventListener('drop', (e) => {
      e.preventDefault(); clearMarks();
      if (from == null || from === i) return;
      const next = reorder(view.tesserae, from, i);
      // Host gesture on the surface's own tiles → TRUSTED dispatch: the boundary must not
      // strip provenance (okf) the tiles legitimately carry (a loaded bundle). The patch
      // touches only this view's tesserae; the boundary composes it over the overlay.
      document.dispatchEvent(new CustomEvent('mosaic:apply', {
        detail: { overlay: { views: [{ id: view.id, tesserae: next }] }, label: 'rearranged', trusted: true },
      }));
    });
  });
}
