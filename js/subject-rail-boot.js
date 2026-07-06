// js/subject-rail-boot.js — DOM wiring for the subject rail (pure core: subject-rail.js).
// Renders into #subject-rail (sidebar, under the nav); re-ranks on every route/surface
// change — pure local overlap, instant, zero tokens. Clicking a row navigates (a concept
// row also scrolls to its tile). "＋N more" expands in place (no new view — the sidebar
// stays the model's compose target, unpolluted).

import { STATE } from './state.js';
import { surface, viewById } from './surface.js';
import { navigate } from './router.js';
import { rankBySubject, railHtml, candidateIndex, applyRerank } from './subject-rail.js';
import { isSignedIn, scoreRelated } from './llm.js';

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
  const html = railHtml(data, { expanded, canRerank: isSignedIn() && data.scorer !== 'ai' });
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
    const rr = e.target.closest('.srail-rerank');
    if (rr) {
      // ✦ rerank — explicit consent per call (never auto-spends tokens on navigation). One
      // small call re-SCORES the same rows; applyRerank enforces the rescore-only invariant.
      const active = viewById(STATE.route);
      if (!active) return;
      rr.disabled = true; rr.textContent = '…';
      const cands = candidateIndex(surface().views, active.id);
      scoreRelated([active.title, active.heading].filter(Boolean).join(' — '), cands)
        .then(scores => { data = { scorer: 'ai', ranked: applyRerank(data.ranked, scores) }; render(); })
        .catch(err => {
          document.dispatchEvent(new CustomEvent('mosaic:toast', { detail: err?.message || 'Rerank failed — kept the overlap ranking.' }));
          render();   // restores the button
        });
      return;
    }
    if (e.target.closest('.srail-more')) { expanded = !expanded; render(); }
  });
  window.addEventListener('hashchange', refresh);
  document.addEventListener('mosaic:apply', () => setTimeout(refresh, 0));   // after the boundary applies
  document.addEventListener('mosaic:reset', () => setTimeout(refresh, 0));
  refresh();
}
