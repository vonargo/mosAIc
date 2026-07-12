// test/snapshots.test.js — the risky part of "◆ Set" is the serialize/parse roundtrip and the
// import gate (a pasted/loaded file goes through the SAME validateOverlay as every other apply).
// The DOM drawer + localStorage are verified in the browser; these lock the pure core.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE, clearReshapes, recordReshape } from '../js/state.js';
import { serializeSurface, parseSurface, captureSurface } from '../js/snapshots.js';

test('serialize → parse roundtrips overlay + reshapes', () => {
  const overlay = { views: [{ id: 'v', title: 'V', tesserae: [{ type: 'markdown', body: 'x' }] }] };
  const reshapes = { v: { 0: { span: 2 }, _view: { layout: 'grid' } } };
  const res = parseSurface(serializeSurface(overlay, reshapes));
  assert.ok(res.ok);
  assert.equal(res.overlay.views[0].id, 'v');
  assert.equal(res.overlay.views[0].tesserae[0].type, 'markdown');
  assert.deepEqual(res.reshapes, reshapes);
});

test('parseSurface accepts a BARE overlay (no wrapper) and defaults reshapes to {}', () => {
  const res = parseSurface(JSON.stringify({ views: [{ id: 'v', title: 'V', tesserae: [{ type: 'note', body: 'n' }] }] }));
  assert.ok(res.ok);
  assert.equal(res.overlay.views[0].id, 'v');
  assert.deepEqual(res.reshapes, {});
});

test('parseSurface rejects bad JSON and invalid overlays through the same gate', () => {
  assert.equal(parseSurface('{not json').ok, false);
  assert.equal(parseSurface('42').ok, false);                       // not an object
  assert.equal(parseSurface(JSON.stringify({ overlay: { views: [] } })).ok, false);  // no usable views
});

test('parseSurface ignores a non-object reshapes field (degrades to {})', () => {
  const doc = JSON.stringify({ overlay: { views: [{ id: 'v', title: 'V', tesserae: [{ type: 'markdown', body: 'x' }] }] }, reshapes: 'oops' });
  const res = parseSurface(doc);
  assert.ok(res.ok);
  assert.deepEqual(res.reshapes, {});
});

test('captureSurface reflects the live STATE.overlay + reshape map', () => {
  clearReshapes();
  STATE.overlay = { views: [{ id: 'cap', title: 'Cap', tesserae: [{ type: 'markdown', body: 'a' }] }] };
  recordReshape('cap', 0, { span: 2 });
  const cap = captureSurface();
  assert.equal(cap.overlay.views[0].id, 'cap');
  assert.deepEqual(cap.reshapes.cap, { 0: { span: 2 } });
  // deep-cloned — mutating the capture doesn't touch STATE
  cap.overlay.views[0].id = 'mutated';
  assert.equal(STATE.overlay.views[0].id, 'cap');
  clearReshapes();
  STATE.overlay = {};
});
