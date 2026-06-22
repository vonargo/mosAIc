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

import { STATE, effective, composeOverlay } from '../js/state.js';
import { validateOverlay, stripProvenance } from '../js/overlay.js';
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

// ── composeOverlay(): the mosaic evolves (a patch folded into the accumulator) ─
test('composeOverlay: a new view is appended to the accumulator', () => {
  const next = composeOverlay({ views: [{ id: 'a', title: 'A' }] }, { views: [{ id: 'b', title: 'B' }] });
  assert.deepEqual(next.views.map(v => v.id), ['a', 'b']);
});

test('composeOverlay: editing a view merges fields; omitted tesserae keeps its tiles', () => {
  const acc = { views: [{ id: 'a', title: 'A', tesserae: [{ type: 'markdown', body: 'keep' }] }] };
  const a = composeOverlay(acc, { views: [{ id: 'a', title: 'A2' }] }).views.find(v => v.id === 'a');
  assert.equal(a.title, 'A2');
  assert.deepEqual(a.tesserae, [{ type: 'markdown', body: 'keep' }]);   // preserved across the patch
});

test('composeOverlay: tesserae present replaces the tiles', () => {
  const acc = { views: [{ id: 'a', tesserae: [{ type: 'markdown', body: 'old' }] }] };
  const next = composeOverlay(acc, { views: [{ id: 'a', tesserae: [{ type: 'code', body: 'new' }] }] });
  assert.deepEqual(next.views[0].tesserae, [{ type: 'code', body: 'new' }]);
});

test('composeOverlay: remove drops a built view and is remembered; re-adding clears it', () => {
  const removed = composeOverlay({ views: [{ id: 'a' }, { id: 'b' }] }, { remove: ['a'] });
  assert.deepEqual(removed.views.map(v => v.id), ['b']);
  assert.deepEqual(removed.remove, ['a']);
  const readded = composeOverlay(removed, { views: [{ id: 'a', title: 'A' }] });
  assert.deepEqual(readded.views.map(v => v.id), ['b', 'a']);
  assert.ok(!(readded.remove || []).includes('a'));
});

test('composeOverlay + effective: successive patches accumulate, removing a base view sticks', () => {
  reset();
  let ov = composeOverlay({}, { views: [{ id: 'spec', title: 'Spec' }] });
  ov = composeOverlay(ov, { views: [{ id: 'rollout', title: 'Rollout' }] });
  STATE.overlay = ov;
  assert.deepEqual(effective(BASE).views.map(v => v.id), ['start', 'spec', 'rollout']);   // evolved, not reset
  STATE.overlay = composeOverlay(ov, { remove: ['start'] });
  assert.deepEqual(effective(BASE).views.map(v => v.id), ['spec', 'rollout']);             // base view dropped
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

// ── stripProvenance(): the host owns provenance, the model may not mint it ──────
// The model is shown the current surface (which carries host-computed okf badges), so
// a generated tile can mirror a `sourced` badge onto its own content. We strip okf from
// model output before it merges — the model proposes content; only the host stamps trust.
test('stripProvenance: drops a model-supplied okf block, leaves content intact', () => {
  const patch = { views: [{ id: 'a', tesserae: [{ type: 'markdown', body: 'x', okf: { sourced: true, resource: 'https://evil.example/fake' } }] }] };
  stripProvenance(patch);
  assert.equal('okf' in patch.views[0].tesserae[0], false);
  assert.equal(patch.views[0].tesserae[0].body, 'x');
});

test('stripProvenance + composeOverlay: a model patch cannot mint provenance; host okf survives', () => {
  const host = { views: [{ id: 'concepts', tesserae: [{ type: 'markdown', title: 'Orders', body: '…', okf: { sourced: true } }] }] };
  const modelPatch = { views: [{ id: 'summary', tesserae: [{ type: 'markdown', body: 'a generated summary', okf: { sourced: true } }] }] };
  const next = composeOverlay(host, stripProvenance(modelPatch));
  assert.equal('okf' in next.views.find(v => v.id === 'summary').tesserae[0], false);   // model badge stripped
  assert.equal(next.views.find(v => v.id === 'concepts').tesserae[0].okf.sourced, true); // host badge preserved
});

// Guard: the host OKF overlay ALSO flows through validateOverlay (applyOkf →
// mosaic:apply), so okf must survive cleanTessera or real host badges break. The model
// path is sanitized upstream by stripProvenance instead — do NOT "fix" this by dropping
// okf from cleanTessera's preserved keys; that strips host provenance too.
test('validateOverlay: preserves host-computed okf (why okf must stay in cleanTessera)', () => {
  const v = validateOverlay({ views: [{ id: 'c', tesserae: [{ type: 'markdown', body: 'x', okf: { sourced: true } }] }] });
  assert.equal(v.overlay.views[0].tesserae[0].okf.sourced, true);
});

// ── mdInline(): link sanitizer (the javascript: XSS regression) ─
test('mdInline: neutralizes a javascript: link, preserves http(s)', () => {
  assert.match(mdInline('[ok](https://example.com)'), /href="https:\/\/example\.com"/);
  const bad = mdInline('[x](javascript:alert(1))');
  assert.match(bad, /href="#"/);
  assert.doesNotMatch(bad, /javascript:/);
});

test('mdInline: in-app # links stay in the same tab (no target=_blank)', () => {
  const a = mdInline('[Customers](#bigquery-table)');
  assert.match(a, /href="#bigquery-table"/);
  assert.doesNotMatch(a, /target=/);
});
