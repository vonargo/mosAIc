// Zero-dependency tests for MosAIc's pure core. Run with Node's built-in runner:
//
//   node --test        (or:  npm test)
//
// Only the pure modules are covered here — anything touching the DOM, a CDN, or
// OAuth can't run under Node. See ROADMAP.md "Tests" for the browser smoke suite
// that would. These cover the crown jewels: the base ⊕ overlay merge, the
// overlay validator (incl. the two bugs found in review), and the link sanitizer.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STATE, effective } from '../js/state.js';
import { validateOverlay } from '../js/overlay.js';
import { mdInline } from '../js/utils.js';

const BASE = {
  title: 'Base',
  views: [{ id: 'start', title: 'Start', tesserae: [{ type: 'markdown', body: 'hi' }] }],
};
const reset = () => { STATE.overlay = {}; STATE.task = null; };

// ── effective(): base ⊕ overlay ─────────────────────────────
test('effective: an empty overlay returns the base', () => {
  reset();
  assert.deepEqual(effective(BASE).views.map(v => v.id), ['start']);
});

test('effective: a new view id is appended', () => {
  reset();
  STATE.overlay = { views: [{ id: 'debug', title: 'Debug' }] };
  assert.deepEqual(effective(BASE).views.map(v => v.id), ['start', 'debug']);
});

test('effective: a matching id merges, and omitted tesserae keeps the base tiles', () => {
  reset();
  STATE.overlay = { views: [{ id: 'start', title: 'Renamed' }] };   // note: no tesserae
  const start = effective(BASE).views.find(v => v.id === 'start');
  assert.equal(start.title, 'Renamed');
  assert.deepEqual(start.tesserae, [{ type: 'markdown', body: 'hi' }]);   // preserved
});

test('effective: remove drops a view', () => {
  reset();
  STATE.overlay = { views: [{ id: 'x', title: 'X' }], remove: ['start'] };
  assert.deepEqual(effective(BASE).views.map(v => v.id), ['x']);
});

// ── validateOverlay(): normalize + guard ────────────────────
test('validateOverlay: rejects non-objects and a missing views array', () => {
  assert.equal(validateOverlay(null).ok, false);
  assert.equal(validateOverlay({}).ok, false);
  assert.equal(validateOverlay({ views: 'nope' }).ok, false);
});

test('validateOverlay: accepts a well-formed overlay', () => {
  const v = validateOverlay({ views: [{ id: 'a', title: 'A', layout: 'grid', tesserae: [{ type: 'code', body: 'x' }] }] });
  assert.equal(v.ok, true);
  assert.equal(v.overlay.views[0].layout, 'grid');
});

test('validateOverlay: omits tesserae when absent (so the merge can keep base tiles)', () => {
  const v = validateOverlay({ views: [{ id: 'a', title: 'A' }] });
  assert.equal(v.ok, true);
  assert.equal('tesserae' in v.overlay.views[0], false);
});

test('validateOverlay: an unknown tile type degrades to markdown', () => {
  const v = validateOverlay({ views: [{ id: 'a', tesserae: [{ type: 'frobnicate', body: 'x' }] }] });
  assert.equal(v.overlay.views[0].tesserae[0].type, 'markdown');
});

// ── mdInline(): link sanitizer (the javascript: XSS regression) ─
test('mdInline: neutralizes a javascript: link, preserves http(s)', () => {
  assert.match(mdInline('[ok](https://example.com)'), /href="https:\/\/example\.com"/);
  const bad = mdInline('[x](javascript:alert(1))');
  assert.match(bad, /href="#"/);
  assert.doesNotMatch(bad, /javascript:/);
});
