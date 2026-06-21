// Central store + the reconfiguration mechanism.
//
// MosAIc renders a *mosaic*: a surface of views, each a layout of **tesserae**
// — the typed tiles a mosaic is made of (markdown, code, table, diagram, …).
// The reconfiguration mechanism is base + overlay: an LLM emits an *overlay*
// (a surface-shaped patch) and `effective()` merges it over the base by view
// id. The whole render path reads only from `effective()`, so a single overlay
// reshapes the entire shell — sidebar and tiles alike. This is the core IP.

export const STATE = {
  route: null,    // current view id
  overlay: {},    // a surface patch: { title?, views?: [view…], remove?: [id…] }
  task: null,     // active demo task id (for command-bar highlight); null = base
};

// base ⊕ overlay → effective surface.
//
// Each overlay view is Object.assign'd over the base view with the same id
// (set `tesserae` to replace the tiles, omit the key to keep them), or appended
// as a new view (→ a new sidebar entry). `remove` drops views by id. Pure: no
// DOM, no imports — the leaf the render path resolves through.
export function effective(base) {
  if (!base) return { title: 'MosAIc', views: [] };
  const ov = STATE.overlay || {};
  const views = (base.views || []).map(v => ({ ...v }));
  const byId = new Map(views.map(v => [v.id, v]));

  for (const ovv of ov.views || []) {
    if (!ovv || !ovv.id) continue;
    const cur = byId.get(ovv.id);
    if (cur) Object.assign(cur, ovv);                 // shallow field merge over the base view
    else { const nv = { ...ovv }; views.push(nv); byId.set(nv.id, nv); }   // new view → appended
  }

  const remove = new Set(ov.remove || []);
  return {
    title: ov.title || base.title || 'MosAIc',
    views: remove.size ? views.filter(v => !remove.has(v.id)) : views,
  };
}

// Fold a new overlay (a patch the model emits against the *current* surface) into
// the accumulated overlay, using the same shallow-merge-by-id rules as effective():
// matching id → fields assigned (omit `tesserae` to keep the view's tiles), new id
// → appended, `remove` → dropped from the accumulator and remembered (so a removed
// *base* view stays dropped after the next merge over base). This is what lets the
// mosaic *evolve* across successive tasks instead of being regenerated each time.
// Pure: (accumulatedOverlay, patch) → accumulatedOverlay.
export function composeOverlay(acc, patch) {
  acc = acc || {}; patch = patch || {};
  const views = (acc.views || []).map(v => ({ ...v }));
  const byId = new Map(views.map(v => [v.id, v]));

  for (const pv of patch.views || []) {
    if (!pv || !pv.id) continue;
    const cur = byId.get(pv.id);
    if (cur) Object.assign(cur, pv);                                   // edit in place (omit tesserae = keep)
    else { const nv = { ...pv }; views.push(nv); byId.set(nv.id, nv); } // new view → appended
  }

  let remove = [...(acc.remove || [])];
  for (const id of patch.remove || []) {
    const i = views.findIndex(v => v.id === id);
    if (i >= 0) views.splice(i, 1);
    if (!remove.includes(id)) remove.push(id);
  }
  remove = remove.filter(id => !views.some(v => v.id === id));         // a re-added view isn't "removed"

  const out = { views };
  const title = patch.title || acc.title;
  if (title) out.title = title;
  if (remove.length) out.remove = remove;
  return out;
}
