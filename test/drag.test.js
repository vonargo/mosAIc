// test/drag.test.js — reorder is pure; and the trust rationale is LOCKED: a reordered
// okf-carrying tile keeps its okf through the apply boundary only when trusted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reorder } from '../js/drag.js';
import { composePatch } from '../js/overlay.js';

test('reorder moves from→to, pure, no-op on bad/equal indices', () => {
  const l = ['a', 'b', 'c', 'd'];
  assert.deepEqual(reorder(l, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(reorder(l, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(l, ['a', 'b', 'c', 'd']);            // source untouched
  assert.deepEqual(reorder(l, 1, 1), l);
  assert.deepEqual(reorder(l, -1, 2), l);
  assert.deepEqual(reorder(l, 0, 9), l);
  assert.deepEqual(reorder(null, 0, 1), []);
});

test('a dragged okf tile keeps its provenance ONLY through a trusted apply (why drag dispatches trusted)', () => {
  const okfTile = { type: 'markdown', title: 'Concept', body: 'x', okf: { sourced: true } };
  const patch = { views: [{ id: 'v', title: 'V', tesserae: [okfTile] }] };
  const trusted = composePatch({}, structuredClone(patch), { trusted: true });
  const stripped = composePatch({}, structuredClone(patch), { trusted: false });
  assert.ok(trusted.views[0].tesserae[0].okf, 'trusted keeps okf');
  assert.equal(stripped.views[0].tesserae[0].okf, undefined, 'untrusted strips okf');
});
