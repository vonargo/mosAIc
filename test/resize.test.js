// test/resize.test.js — the span math (pure). The corner gesture is DOM, verified in-browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpan, nextSpan, spanFromDrag } from '../js/resize.js';

test('resolveSpan: explicit span ≥1 wins (a resize to 1 sticks); junk/absent → 1', () => {
  assert.equal(resolveSpan({ span: 2 }), 2);
  assert.equal(resolveSpan({ span: 1 }), 1);
  assert.equal(resolveSpan({ span: 3.4 }), 3);
  assert.equal(resolveSpan({}), 1);
  assert.equal(resolveSpan({ span: 0 }), 1);
  assert.equal(resolveSpan({ span: 'x' }), 1);
  assert.equal(resolveSpan(null), 1);
});

test('nextSpan toggles 1↔2', () => {
  assert.equal(nextSpan(1), 2);
  assert.equal(nextSpan(2), 1);
  assert.equal(nextSpan(3), 2);
});

test('spanFromDrag: start + columns travelled, clamped [1, maxSpan]; colW ≤ 0 → no change', () => {
  assert.equal(spanFromDrag(1, 260, 250, 3), 2);
  assert.equal(spanFromDrag(1, 900, 250, 3), 3);     // clamped to grid width
  assert.equal(spanFromDrag(2, -260, 250, 3), 1);
  assert.equal(spanFromDrag(2, -900, 250, 3), 1);    // floor 1
  assert.equal(spanFromDrag(2, 100, 0, 3), 2);       // no geometry → no change
});
