// test/reshape.test.js — reshape persistence: resize deltas survive re-render because
// effective() re-applies them per view+tile. localStorage is absent under node — the
// module falls back to in-memory (the try/catch), which is exactly what these lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE, effective, recordReshape, recordViewReshape, reshapesFor, clearReshapes } from '../js/state.js';
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
