// Validate + normalize an overlay before it reshapes the surface, so a bad emit
// — from the model or hand-typed in the Composer — degrades to an error message
// instead of breaking the render path. Lenient where the renderers are already
// defensive; strict on the structural shape: views[] of { id, tesserae[] }.

import { composeOverlay } from './state.js';

const LAYOUTS = new Set(['stack', 'grid', 'split']);
// 'spacer' is an inert empty tile (a deliberate gap in the grid) — no body, url, or script, so it's
// safe to allow through the shared, model-emittable gate (unlike an image tile).
const TYPES = new Set(['markdown', 'code', 'table', 'diagram', 'note', 'tasks', 'spacer']);

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Returns { ok: true, overlay } or { ok: false, error }.
export function validateOverlay(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'overlay must be a JSON object' };

  // Canonical shape is { views: [...] }; also accept a bare view or an array of views.
  let raw = input;
  if (Array.isArray(input)) raw = { views: input };
  else if (!('views' in input) && (input.tesserae || input.id)) raw = { views: [input] };

  if (!Array.isArray(raw.views)) return { ok: false, error: 'overlay needs a "views" array' };

  const views = [];
  const seen = new Set();
  raw.views.forEach((v, i) => {
    if (!v || typeof v !== 'object') return;
    let id = (typeof v.id === 'string' && v.id.trim()) ? slug(v.id) : (slug(v.title) || `view-${i + 1}`);
    while (seen.has(id)) id += '-2';
    seen.add(id);
    // Only carry keys that were actually present, so an overlay that updates an
    // existing view id keeps the base view's other fields (SCHEMA: "omit to
    // keep them"). The renderer/sidebar default title + layout for new views.
    const view = { id };
    if (typeof v.title === 'string') view.title = v.title;
    if (typeof v.heading === 'string') view.heading = v.heading;
    if (typeof v.subtitle === 'string') view.subtitle = v.subtitle;
    if (LAYOUTS.has(v.layout)) view.layout = v.layout;
    if (Array.isArray(v.tesserae)) view.tesserae = v.tesserae.map(cleanTessera).filter(Boolean);
    views.push(view);
  });

  const remove = Array.isArray(raw.remove) ? raw.remove.filter(x => typeof x === 'string') : null;
  if (!views.length && !(remove && remove.length)) return { ok: false, error: 'overlay has no usable views' };

  const overlay = { views };
  if (typeof raw.title === 'string') overlay.title = raw.title;
  if (remove) overlay.remove = remove;
  return { ok: true, overlay };
}

// Provenance (`okf`) is host-owned: only the OKF loader (okfToOverlay) may stamp a
// tile's sourced/unsourced badge. A model patch is untrusted — and because the model
// is shown the current surface (which carries those host badges), a generated tile can
// mirror a `sourced` badge onto its own content. Strip `okf` from model output before
// it merges, so the model proposes content and only the host stamps provenance. Applied
// to the model's patch upstream of composeOverlay, where it's still separable from the
// host badges already in STATE.overlay. Mutates + returns (the patch is freshly parsed).
export function stripProvenance(overlay) {
  if (!overlay || typeof overlay !== 'object') return overlay;
  for (const v of overlay.views || []) {
    for (const t of (v && v.tesserae) || []) {
      if (t && typeof t === 'object') delete t.okf;
    }
  }
  return overlay;
}

function cleanTessera(t) {
  if (!t || typeof t !== 'object' || typeof t.type !== 'string') return null;
  const known = TYPES.has(t.type);
  const type = known ? t.type : 'markdown';
  const out = { type };
  if (typeof t.title === 'string') out.title = t.title;
  if (Number.isFinite(t.span)) out.span = t.span;
  if (typeof t.collapsed === 'boolean') out.collapsed = t.collapsed;   // fold state survives a re-validate (e.g. drag)
  for (const k of ['body', 'lang', 'filename', 'tone', 'columns', 'rows', 'items', 'okf']) {
    if (t[k] !== undefined) out[k] = t[k];
  }
  // an unknown type with no usable body → show its source so nothing is silently lost
  if (!known && out.body === undefined) out.body = '```json\n' + JSON.stringify(t, null, 2) + '\n```';
  return out;
}

// The apply boundary (post-validate), as a pure function so it's testable without the DOM.
// Host owns provenance: an UNTRUSTED overlay (the model AND the hand-typed Composer) is stripped
// of `okf` here — only a trusted source (the OKF loader) keeps it, so no dispatch path can mint a
// `sourced` badge. Then it COMPOSES onto the running surface (the mosaic evolves) unless `replace`.
export function composePatch(base, validated, { trusted = false, replace = false } = {}) {
  const patch = trusted ? validated : stripProvenance(validated);
  return replace ? patch : composeOverlay(base, patch);
}
