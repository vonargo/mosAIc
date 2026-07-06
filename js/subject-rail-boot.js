// js/subject-rail-boot.js — DOM wiring for the subject rail (pure core: subject-rail.js).
// Renders into #subject-rail (sidebar, under the nav); re-ranks on every route/surface
// change — pure local overlap, instant, zero tokens. Clicking a row navigates (a concept
// row also scrolls to its tile). "＋N more" expands in place (no new view — the sidebar
// stays the model's compose target, unpolluted).

import { STATE } from './state.js';
import { surface, viewById } from './surface.js';
import { navigate } from './router.js';
import { rankBySubject, railHtml } from './subject-rail.js';

let expanded = false;
let data = { scorer: 'overlap', ranked: [] };

const mountEl = () => document.getElementById('subject-rail');

function scrollToTile(idx) {
  // after navigation renders, land on the concept's tile
  setTimeout(() => {
    const tile = document.querySelectorAll('#view .tessera')[idx];
    if (tile) tile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function render() {
  const el = mountEl();
  if (!el) return;
  const html = railHtml(data, { expanded, canRerank: false });
  el.innerHTML = html;
  el.hidden = !html;
}

function refresh() {
  const active = viewById(STATE.route);
  data = rankBySubject(active, surface().views);
  expanded = false;
  render();
}

export function initSubjectRail() {
  const el = mountEl();
  if (!el) return;
  el.addEventListener('click', (e) => {
    const row = e.target.closest('.srail-row');
    if (row) {
      const ref = row.getAttribute('data-ref') || '';
      if (row.getAttribute('data-kind') === 'concept') {
        const [viewId, idx] = ref.split('::');
        navigate(viewId);
        scrollToTile(parseInt(idx, 10) || 0);
      } else navigate(ref);
      return;
    }
    if (e.target.closest('.srail-more')) { expanded = !expanded; render(); }
  });
  window.addEventListener('hashchange', refresh);
  document.addEventListener('mosaic:apply', () => setTimeout(refresh, 0));   // after the boundary applies
  document.addEventListener('mosaic:reset', () => setTimeout(refresh, 0));
  refresh();
}
