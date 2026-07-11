// js/subject-rail.js — the subject rail's PURE core: for the active view, rank everything
// else on the surface (other views + loaded OKF concept tiles) by relatedness — the mind
// map, realized, strongest on top. Stage B (v2) is field-weighted lexical scoring with IDF —
// both sides are structured, so title/tags/heading matches outrank body matches, and rare
// discriminative terms outrank ubiquitous ones. Still instant, zero tokens, works signed-out,
// and every line of the ranking math is readable below. Stage C (llm.js scoreRelated, see
// subject-rail-boot.js) can only RE-SCORE these rows — applyRerank drops unknown refs, so a
// model can never mint, remove, or retitle a rail row. The data contract is {scorer,
// ranked:[{kind,ref,title,score}]} — swap the scorer, never repaint the component.
// (Scorer v2 design owes the thread: field weighting + IDF + the Unicode tokenizer — "model
// proposes, host disposes" — credit John6666, HF forum t/177021.)

import { escapeHtml } from './utils.js';

export const RAIL_K = 6;                       // rail cap; "＋N more" expands in place
const str = (x) => (x == null ? '' : String(x));
const clamp01 = (n) => (typeof n === 'number' && isFinite(n)) ? Math.max(0, Math.min(1, n)) : 0;

// ── tokenizer v2 ─────────────────────────────────────────────────────────────
// NFKC-normalize, PRESERVE compound technical tokens before segmentation (node.js, OAuth2,
// rfc-6902, a/b.md — exactly the terms that distinguish concepts in a technical bundle),
// then segment Unicode-aware: Intl.Segmenter where available, \p{L}\p{M}\p{N} regex fallback.
// Length ≥2 keeps the acronyms the old [a-z0-9]{3,} regex was blind to (AI, UI, HF, OS) and
// non-Latin scripts (Cyrillic etc.) tokenize instead of vanishing.
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'you', 'your', 'has', 'have', 'how', 'what', 'its', 'can', 'one', 'all', 'any', 'not', 'out', 'into', 'over', 'when', 'then', 'than', 'them', 'they',
  'of', 'to', 'in', 'is', 'it', 'on', 'as', 'at', 'by', 'or', 'an', 'be', 'we', 'do', 'if', 'so', 'no', 'up', 'my', 'me']);
const TECH_RE = /[\p{L}\p{N}]+(?:[.+#/_-][\p{L}\p{N}]+)+/gu;   // compound tech tokens, kept whole
const WORD_RE = /[\p{L}\p{M}\p{N}_]{2,}/gu;                     // Unicode fallback segmentation
const seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('und', { granularity: 'word' }) : null;

export function tokens(s) {
  let text;
  try { text = str(s).normalize('NFKC').toLowerCase(); } catch { text = str(s).toLowerCase(); }
  const out = new Set();
  // 1) compound technical tokens survive whole (and are removed so segmentation can't split them)
  text = text.replace(TECH_RE, (m) => { out.add(m); return ' '; });
  // 2) Unicode word segmentation for the rest
  if (seg) {
    for (const part of seg.segment(text)) {
      if (part.isWordLike && part.segment.length >= 2 && !STOP.has(part.segment)) out.add(part.segment);
    }
  } else {
    for (const m of text.match(WORD_RE) || []) if (!STOP.has(m)) out.add(m);
  }
  return out;
}

// legacy v1 scorer — kept exported (tested; also the honest name for what it was).
export function overlapScore(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return clamp01(n / Math.sqrt(a.size * b.size));
}

// ── field extraction — BOTH sides share the taxonomy (the both-sides-structured insight) ──
// weights: title 4 · tags 3 · headings/tile-titles 2 · body 1.
export const FIELD_W = { title: 4, tags: 3, heads: 2, body: 1 };
const viewFields = (v) => ({
  title: [v.title, v.heading].map(str).join(' '),
  tags: '',
  heads: (v.tesserae || []).map(t => str(t && t.title)).join(' '),
  body: str(v.subtitle),
});
const tileFields = (t) => ({
  title: str(t.title),
  tags: [((t.okf && t.okf.tags) || []).join(' '), t.okf && t.okf.conceptType].map(str).join(' '),
  heads: '',
  body: [t.okf && t.okf.description, t.body].map(str).join(' '),
});
// per-token weight = the strongest field the token appears in on that side.
function tokenWeights(fields) {
  const w = new Map();
  for (const [f, weight] of Object.entries(FIELD_W)) {
    for (const t of tokens(fields[f])) if ((w.get(t) || 0) < weight) w.set(t, weight);
  }
  return w;
}

// the searchable text of a view / a concept tile (feeds the rerank snippet + legacy callers).
const viewHay = (v) => Object.values(viewFields(v)).join(' ');
const tileHay = (t) => Object.values(tileFields(t)).join(' ');

// every candidate the rail can rank: the OTHER views (ref = view id) and any OKF concept
// tiles (ref = `viewId::tileIndex`, so a click can land on the exact tile).
export function candidateIndex(views, activeId) {
  const out = [];
  for (const v of views || []) {
    if (!v || !v.id || v.id === activeId) continue;
    out.push({ kind: 'view', ref: v.id, title: str(v.title || v.id), hay: viewHay(v), w: tokenWeights(viewFields(v)) });
    (v.tesserae || []).forEach((t, i) => {
      if (t && t.okf) out.push({ kind: 'concept', ref: v.id + '::' + i, title: str(t.title) || 'concept', hay: tileHay(t), w: tokenWeights(tileFields(t)) });
    });
  }
  return out;
}

// ── stage B, scorer v2: field-weighted lexical with IDF, cosine-normalized ──
// idf(t) = log(1 + (N − df + 0.5)/(df + 0.5)) over the candidate corpus (BM25-flavored) —
// rare discriminative terms outrank terms every candidate carries. score = idf-weighted dot
// of the two sides' field-weight vectors / √(self·self) → bounded 0..1, deterministic, and
// small enough to read. Zero scores are dropped (nothing related → the rail hides itself).
export function rankBySubject(activeView, views) {
  if (!activeView) return { scorer: 'lexical v2', ranked: [] };
  const cands = candidateIndex(views, activeView.id);
  const N = cands.length;
  const df = new Map();
  for (const c of cands) for (const t of c.w.keys()) df.set(t, (df.get(t) || 0) + 1);
  const idf = (t) => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
  const self = (w) => { let s = 0; for (const [t, wt] of w) s += wt * wt * idf(t); return s; };

  const aw = tokenWeights(viewFields(activeView));
  const aSelf = self(aw);
  const ranked = cands
    .map(c => {
      let dot = 0;
      for (const [t, wt] of aw) { const cwt = c.w.get(t); if (cwt) dot += wt * cwt * idf(t); }
      const denom = Math.sqrt(aSelf * self(c.w));
      return { kind: c.kind, ref: c.ref, title: c.title, score: denom > 0 ? clamp01(dot / denom) : 0 };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return { scorer: 'lexical v2', ranked };
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

// one rail row → HTML. Every interpolation escaped. The BAR is rank-relative (score/top score —
// v2's cosine-IDF scores are honest but small, and a 3%-wide bar reads as nothing); the raw
// score stays in the tooltip so the display never lies, it just scales.
export function railRowHtml(item, topScore = 1) {
  const title = str(item.title) || str(item.ref);
  const raw = clamp01(item.score);
  const w = Math.round(clamp01(topScore > 0 ? raw / topScore : 0) * 100);
  return `<button class="srail-row" type="button" data-kind="${escapeHtml(str(item.kind))}" data-ref="${escapeHtml(str(item.ref))}" title="${escapeHtml(title)} · score ${raw.toFixed(2)}">` +
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
  const scorer = str(data.scorer) === 'ai' ? '✦ AI' : (str(data.scorer) || 'lexical');   // show the real scorer name
  return `<div class="srail-head"><span class="srail-label">Related</span><span class="srail-scorer">${escapeHtml(scorer)}</span>` +
    (canRerank ? `<button class="srail-rerank" type="button" title="Re-rank with the model — one call, billed to your account">✦ rerank</button>` : '') +
    `</div>` +
    show.map(r => railRowHtml(r, ranked[0].score)).join('') +
    (more > 0 ? `<button class="srail-more" type="button">${expanded ? '− less' : `＋${more} more`}</button>` : '');
}
