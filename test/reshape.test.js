// test/reshape.test.js — reshape persistence: resize deltas survive re-render because
// effective() re-applies them per view+tile. localStorage is absent under node — the
// module falls back to in-memory (the try/catch), which is exactly what these lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE, effective, recordReshape, recordViewReshape, reorderReshape, insertReshape, removeReshape, reshapesFor, clearReshapes } from '../js/state.js';
import { validateOverlay } from '../js/overlay.js';
import { renderTessera } from '../js/tesserae.js';

const BASE = { title: 'T', views: [{ id: 'v1', title: 'One', tesserae: [{ type: 'markdown', body: 'a' }, { type: 'table', columns: ['c'], rows: [['x']] }] }] };

test('recordReshape stores per view+tile; reshapesFor reads it back', () => {
  clearReshapes();
  recordReshape('v1', 1, { span: 2 });
  assert.deepEqual(reshapesFor('v1'), { 1: { span: 2 } });
  recordReshape('v1', 1, { span: 1 });                 // later delta merges over
  assert.deepEqual(reshapesFor('v1'), { 1: { span: 1 } });
  recordReshape('', 0, { span: 2 });                   // junk ignored
  recordReshape('v1', 1.5, { span: 2 });
  assert.deepEqual(reshapesFor(''), {});
  clearReshapes();
});

test('collapse: the fold state survives validate (drag re-dispatch) and renders folded', () => {
  const v = validateOverlay({ views: [{ id: 'v', title: 'V', tesserae: [{ type: 'markdown', body: 'x', collapsed: true }] }] });
  assert.ok(v.ok);
  assert.equal(v.overlay.views[0].tesserae[0].collapsed, true);        // whitelist keeps it
  const html = renderTessera({ type: 'markdown', body: 'x', collapsed: true });
  assert.match(html, /class="tessera t-markdown collapsed"/);          // renders folded
  assert.match(html, /t-fold/);                                        // the fold affordance is present
  assert.match(renderTessera({ type: 'markdown', body: 'x' }), /aria-expanded="true"/);
});

test('spacer tile: validator keeps the type (not coerced to markdown), renderer emits a headless deletable cell', () => {
  const v = validateOverlay({ views: [{ id: 'v', title: 'V', tesserae: [{ type: 'spacer', span: 2 }] }] });
  assert.ok(v.ok);
  assert.equal(v.overlay.views[0].tesserae[0].type, 'spacer');     // NOT re-typed to markdown
  assert.equal(v.overlay.views[0].tesserae[0].span, 2);            // span carried (widen the gap)
  const html = renderTessera({ type: 'spacer', span: 2 });
  assert.match(html, /class="tessera t-spacer"/);
  assert.match(html, /t-del/);                                     // has a delete affordance
  assert.doesNotMatch(html, /t-fold/);                             // no fold — nothing to collapse
  assert.doesNotMatch(html, /tessera-head/);                       // no head chrome
});

test('effective() re-applies reshape deltas without mutating base', () => {
  clearReshapes();
  STATE.overlay = {};
  recordReshape('v1', 0, { span: 2 });
  const out = effective(BASE);
  assert.equal(out.views[0].tesserae[0].span, 2);      // delta applied
  assert.equal(BASE.views[0].tesserae[0].span, undefined);  // base untouched (pure)
  clearReshapes();
  assert.equal(effective(BASE).views[0].tesserae[0].span, undefined);  // cleared → gone
});

test('reorderReshape: a tile delta travels with its tile on a drag (from→to); _view stays put', () => {
  clearReshapes();
  recordReshape('v1', 0, { span: 2 });          // big tile at slot 0
  recordReshape('v1', 2, { collapsed: true });  // collapsed tile at slot 2
  recordViewReshape('v1', { layout: 'grid' });  // view-level override — must NOT move
  reorderReshape('v1', 0, 2);                    // drag slot 0 → slot 2 : reorder = [1,2,0,3]
  const r = reshapesFor('v1');
  assert.deepEqual(r[2], { span: 2 }, 'old slot 0 delta now at slot 2 (followed the tile)');
  assert.deepEqual(r[1], { collapsed: true }, 'old slot 2 delta shifted down to slot 1');
  assert.equal(r[0], undefined, 'nothing stale left at the vacated slot');
  assert.deepEqual(r._view, { layout: 'grid' }, 'view-level override untouched by the reindex');
  reorderReshape('v1', 2, 0);                     // reverse drag restores the mapping
  const back = reshapesFor('v1');
  assert.deepEqual(back[0], { span: 2 });
  assert.deepEqual(back[2], { collapsed: true });
  reorderReshape('v1', 0, 0);                     // no-op / junk guarded
  reorderReshape('', 0, 1);
  clearReshapes();
});

test('insertReshape shifts deltas at/after the insert point up by one; earlier deltas + _view stay', () => {
  clearReshapes();
  recordReshape('v1', 1, { span: 2 });
  recordReshape('v1', 3, { collapsed: true });
  recordViewReshape('v1', { layout: 'grid' });
  insertReshape('v1', 2);                          // a new tile appears at index 2
  const r = reshapesFor('v1');
  assert.deepEqual(r[1], { span: 2 }, 'before the insert point — unchanged');
  assert.deepEqual(r[4], { collapsed: true }, 'index 3 pushed to 4 by the insert');
  assert.equal(r[3], undefined, 'nothing stranded at the old index');
  assert.deepEqual(r._view, { layout: 'grid' }, 'view-level override untouched');
  insertReshape('v1', 99);                          // insert past the end — no delta moves
  assert.deepEqual(reshapesFor('v1')[4], { collapsed: true });
  clearReshapes();
});

test('removeReshape drops the deleted tile\'s delta and pulls later deltas down by one', () => {
  clearReshapes();
  recordReshape('v1', 1, { span: 2 });
  recordReshape('v1', 2, { collapsed: true });     // this tile is the one removed
  recordReshape('v1', 4, { span: 2 });
  recordViewReshape('v1', { layout: 'split' });
  removeReshape('v1', 2);
  const r = reshapesFor('v1');
  assert.deepEqual(r[1], { span: 2 }, 'before the removed index — unchanged');
  assert.deepEqual(r[3], { span: 2 }, 'index 4 pulled down to 3');
  assert.equal(r[2], undefined, 'the removed tile\'s delta is gone, nothing shifted into its slot wrongly');
  assert.deepEqual(r._view, { layout: 'split' }, 'view-level override untouched');
  clearReshapes();
});

test('view-level reshape: recordViewReshape({layout}) overrides the model layout in effective(), non-colliding with tile deltas', () => {
  clearReshapes();
  STATE.overlay = {};
  recordViewReshape('v1', { layout: 'grid' });
  recordReshape('v1', 0, { span: 2 });                     // tile delta coexists
  const out = effective(BASE);
  assert.equal(out.views[0].layout, 'grid');               // the human's layout wins
  assert.equal(out.views[0].tesserae[0].span, 2);          // tile delta still applies
  assert.equal(BASE.views[0].layout, undefined);           // base untouched
  clearReshapes();
  assert.equal(effective(BASE).views[0].layout, undefined);
});
