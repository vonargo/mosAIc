// js/subject-rail.js — the subject rail's PURE core: for the active view, rank everything
// else on the surface (other views + loaded OKF concept tiles) by relatedness — the mind
// map, realized, strongest on top. Stage B is client-side term overlap (instant, zero
// tokens, works signed-out); stage C (llm.js scoreRelated, see subject-rail-boot.js) can
// only RE-SCORE these rows — applyRerank drops unknown refs, so a model can never mint,
// remove, or retitle a rail row. The data contract is {scorer, ranked:[{kind,ref,title,
// score}]} — swap the scorer, never repaint the component.

import { escapeHtml } from './utils.js';

export const RAIL_K = 6;                       // rail cap; "＋N more" expands in place
const str = (x) => (x == null ? '' : String(x));
const clamp01 = (n) => (typeof n === 'number' && isFinite(n)) ? Math.max(0, Math.min(1, n)) : 0;

// tokenize: lowercase alphanumeric runs of 3+, minus a tiny stopword set.
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'you', 'your', 'has', 'have', 'how', 'what', 'its', 'can', 'one', 'all', 'any', 'not', 'out', 'into', 'over', 'when', 'then', 'than', 'them', 'they']);
export function tokens(s) {
  return new Set((str(s).toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w)));
}

// |∩| / sqrt(|a|·|b|) — cosine-style overlap on token sets, clamped 0..1. Deterministic.
export function overlapScore(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return clamp01(n / Math.sqrt(a.size * b.size));
}

// the searchable text of a view / a concept tile (mirrors okfFilter's haystack shape).
const viewHay = (v) => [v.title, v.heading, v.subtitle, ...(v.tesserae || []).map(t => str(t && t.title))].join(' ');
const tileHay = (t) => [t.title, t.okf && t.okf.conceptType, ((t.okf && t.okf.tags) || []).join(' '), t.okf && t.okf.description, t.body].map(str).join(' ');

// every candidate the rail can rank: the OTHER views (ref = view id) and any OKF concept
// tiles (ref = `viewId::tileIndex`, so a click can land on the exact tile).
export function candidateIndex(views, activeId) {
  const out = [];
  for (const v of views || []) {
    if (!v || !v.id || v.id === activeId) continue;
    out.push({ kind: 'view', ref: v.id, title: str(v.title || v.id), hay: viewHay(v) });
    (v.tesserae || []).forEach((t, i) => {
      if (t && t.okf) out.push({ kind: 'concept', ref: v.id + '::' + i, title: str(t.title) || 'concept', hay: tileHay(t) });
    });
  }
  return out;
}

// stage B: rank all candidates against the active view. Zero scores are dropped
// (nothing related → the rail hides itself).
export function rankBySubject(activeView, views) {
  if (!activeView) return { scorer: 'overlap', ranked: [] };
  const subject = tokens(viewHay(activeView));
  const ranked = candidateIndex(views, activeView.id)
    .map(c => ({ kind: c.kind, ref: c.ref, title: c.title, score: overlapScore(subject, tokens(c.hay)) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return { scorer: 'overlap', ranked };
}

// stage C validation — the rescore-only invariant: model scores may only re-score KNOWN
// refs. Unknown refs are dropped, scores clamped 0..1, rows never added/removed/retitled;
// a ref the model omitted keeps its overlap score.
export function applyRerank(ranked, scores) {
  const byRef = new Map((Array.isArray(scores) ? scores : [])
    .filter(s => s && typeof s.ref === 'string' && typeof s.score === 'number')
    .map(s => [s.ref, clamp01(s.score)]));
  return (ranked || []).map(r => ({ ...r, score: byRef.has(r.ref) ? byRef.get(r.ref) : r.score }))
    .sort((a, b) => b.score - a.score);
}

// one rail row → HTML. Every interpolation escaped; the strength bar width is clamped.
export function railRowHtml(item) {
  const title = str(item.title) || str(item.ref);
  const w = Math.round(clamp01(item.score) * 100);
  return `<button class="srail-row" type="button" data-kind="${escapeHtml(str(item.kind))}" data-ref="${escapeHtml(str(item.ref))}" title="${escapeHtml(title)} · ${w}%">` +
    `<span class="srail-title">${escapeHtml(title)}</span>` +
    `<span class="srail-meta"><span class="srail-kind">${escapeHtml(str(item.kind))}</span>` +
    `<span class="srail-bar"><i style="width:${w}%"></i></span></span></button>`;
}

// the rail's inner HTML: top-K rows (all when expanded), an in-place expand toggle, the
// scorer label (honest about which substance ranked), and — signed-in — the ✦ rerank button.
export function railHtml(data, { expanded = false, canRerank = false } = {}) {
  const ranked = (data && Array.isArray(data.ranked)) ? data.ranked : [];
  if (!ranked.length) return '';
  const show = expanded ? ranked : ranked.slice(0, RAIL_K);
  const more = ranked.length - RAIL_K;
  const scorer = str(data.scorer) === 'ai' ? '✦ AI' : 'overlap';
  return `<div class="srail-head"><span class="srail-label">Related</span><span class="srail-scorer">${escapeHtml(scorer)}</span>` +
    (canRerank ? `<button class="srail-rerank" type="button" title="Re-rank with the model — one call, billed to your account">✦ rerank</button>` : '') +
    `</div>` +
    show.map(railRowHtml).join('') +
    (more > 0 ? `<button class="srail-more" type="button">${expanded ? '− less' : `＋${more} more`}</button>` : '');
}
