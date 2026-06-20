// Validate + normalize an overlay before it reshapes the surface, so a bad emit
// — from the model or hand-typed in the Composer — degrades to an error message
// instead of breaking the render path. Lenient where the renderers are already
// defensive; strict on the structural shape: views[] of { id, tesserae[] }.

const LAYOUTS = new Set(['stack', 'grid', 'split']);
const TYPES = new Set(['markdown', 'code', 'table', 'diagram', 'note', 'tasks']);

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

function cleanTessera(t) {
  if (!t || typeof t !== 'object' || typeof t.type !== 'string') return null;
  const known = TYPES.has(t.type);
  const type = known ? t.type : 'markdown';
  const out = { type };
  if (typeof t.title === 'string') out.title = t.title;
  if (Number.isFinite(t.span)) out.span = t.span;
  for (const k of ['body', 'lang', 'filename', 'tone', 'columns', 'rows', 'items']) {
    if (t[k] !== undefined) out[k] = t[k];
  }
  // an unknown type with no usable body → show its source so nothing is silently lost
  if (!known && out.body === undefined) out.body = '```json\n' + JSON.stringify(t, null, 2) + '\n```';
  return out;
}
