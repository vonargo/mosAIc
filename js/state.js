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

// ── Reshape persistence ─────────────────────────────────────────────────────
// A resize is *reshape intent*, decoupled from the view DATA (which an overlay can
// regenerate). Persist a per-view+tile delta in localStorage and re-apply it in
// effective(), so a resize survives a re-render and a reload. Keyed viewId → tile index.
const RESHAPE_KEY = 'mosaic-reshapes';
let RESHAPE = (() => { try { return JSON.parse(localStorage.getItem(RESHAPE_KEY) || '{}') || {}; } catch { return {}; } })();
function saveReshapes() { try { localStorage.setItem(RESHAPE_KEY, JSON.stringify(RESHAPE)); } catch { /* storage off — keep in memory */ } }

export function recordReshape(viewId, idx, patch) {
  if (!viewId || !Number.isInteger(idx) || !patch) return;
  RESHAPE[viewId] = RESHAPE[viewId] || {};
  RESHAPE[viewId][idx] = { ...RESHAPE[viewId][idx], ...patch };
  saveReshapes();
}
export const reshapesFor = (viewId) => RESHAPE[viewId] || {};
export function clearReshapes() { RESHAPE = {}; saveReshapes(); }   // tests / deliberate reset

// A VIEW-level reshape (e.g. {layout}) — the human's override of the model's choice, stored
// under the non-numeric key '_view' so it can't collide with tile indices.
export function recordViewReshape(viewId, patch) {
  if (!viewId || !patch) return;
  RESHAPE[viewId] = RESHAPE[viewId] || {};
  RESHAPE[viewId]._view = { ...RESHAPE[viewId]._view, ...patch };
  saveReshapes();
}

// Reshape deltas are keyed by tile INDEX, so a drag-reorder must splice the map the
// same way it splices the tesserae — otherwise a tile's size/collapse stays at the old
// slot and whatever lands there inherits it (looks like a "swap"). Mirror reorder(from→to)
// on the numeric keys; '_view' is view-level and does not move. No-op on bad/equal indices.
export function reorderReshape(viewId, from, to) {
  const r = viewId && RESHAPE[viewId];
  if (!r || from === to || !Number.isInteger(from) || !Number.isInteger(to)) return;
  const at = (i) => {                          // old index → new index under reorder(from→to)
    if (i === from) return to;
    if (from < to && i > from && i <= to) return i - 1;
    if (from > to && i >= to && i < from) return i + 1;
    return i;
  };
  const next = {};
  for (const k of Object.keys(r)) {
    if (k === '_view') { next._view = r._view; continue; }
    const i = Number(k);
    next[Number.isInteger(i) ? at(i) : k] = r[k];
  }
  RESHAPE[viewId] = next;
  saveReshapes();
}

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
  const out = remove.size ? views.filter(v => !remove.has(v.id)) : views;
  // re-apply persisted reshape deltas — view-level ('_view', e.g. the layout override) first,
  // then per-tile. New objects throughout, so base/overlay are never mutated (effective stays pure).
  for (let i = 0; i < out.length; i++) {
    const r = RESHAPE[out[i].id];
    if (!r) continue;
    if (r._view) out[i] = { ...out[i], ...r._view };
    if (Array.isArray(out[i].tesserae)) out[i].tesserae = out[i].tesserae.map((t, j) => (r[j] ? { ...t, ...r[j] } : t));
  }
  return { title: ov.title || base.title || 'MosAIc', views: out };
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
