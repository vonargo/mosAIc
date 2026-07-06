// js/resize.js — resize a tile by dragging its bottom-right corner: the span widens or
// narrows by however many columns you drag (a tiny travel = a click = toggle 1↔2). The
// committed span persists as a reshape delta (state.js) — effective() re-applies it on
// every render, so it survives an overlay re-render and a reload. Span math is pure +
// tested; the corner gesture is a thin pointer binding (verified in-browser).

import { recordReshape } from './state.js';

// An explicit span (≥1) WINS — so a resize down to 1 sticks. Junk/absent → 1.
// (No per-type wide defaults: existing surfaces set span explicitly, and introducing
// defaults would silently reshape every canned example.)
export function resolveSpan(t) {
  const s = t && t.span;
  return Number.isFinite(s) && s >= 1 ? Math.round(s) : 1;
}

// A click toggles 1↔2 (quick wide/narrow); a drag resizes to any width (spanFromDrag).
export const nextSpan = (span) => (span === 2 ? 1 : 2);

// Target span from horizontal travel: start + columns moved, clamped [1, maxSpan].
export function spanFromDrag(startSpan, dx, colW, maxSpan) {
  if (!(colW > 0)) return startSpan;
  const target = startSpan + Math.round(dx / colW);
  return Math.max(1, Math.min(Math.max(1, maxSpan || 1), target));
}

const MOVE_PX = 24;   // travel that separates a deliberate drag from a click

function gridColumnCount(grid) {
  const t = getComputedStyle(grid).gridTemplateColumns;
  const n = (t && t !== 'none') ? t.split(' ').filter(Boolean).length : 1;
  return Math.max(1, n);
}
function columnStride(grid) {
  const s = getComputedStyle(grid);
  const tracks = (s.gridTemplateColumns || '').split(' ').filter(Boolean);
  return (parseFloat(tracks[0]) || 248) + (parseFloat(s.columnGap || s.gap) || 0);
}

// Wire corner-resize onto each tile of a rendered view. Re-run after every render
// (renderView calls it). Live preview while dragging; commit on release via recordReshape
// (no re-render, no flicker — the DOM already shows the previewed span).
export function enableResize(mount, view) {
  const grid = mount && mount.querySelector('.tessera-grid');
  if (!grid || !view || !Array.isArray(view.tesserae)) return;
  [...grid.querySelectorAll('.tessera')].forEach((tile, i) => {
    const handle = tile.querySelector('.tessera-resize');
    if (!handle) return;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();                 // never start a reorder-drag
      const startX = e.clientX;
      const startSpan = parseInt(tile.style.getPropertyValue('--span'), 10) || 1;
      const maxSpan = gridColumnCount(grid);
      const colW = columnStride(grid);
      let preview = startSpan;
      tile.classList.add('resizing');
      try { handle.setPointerCapture(e.pointerId); } catch { /* unsupported — fine */ }

      const onMove = (ev) => {
        const next = spanFromDrag(startSpan, ev.clientX - startX, colW, maxSpan);
        if (next !== preview) { preview = next; tile.style.setProperty('--span', String(next)); }
      };
      const finish = (ev) => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        tile.classList.remove('resizing');
        const moved = Math.abs(ev.clientX - startX) > MOVE_PX;
        const target = moved ? preview : nextSpan(startSpan);
        tile.style.setProperty('--span', String(target));
        if (target !== startSpan) recordReshape(view.id, i, { span: target });
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
  });
}
