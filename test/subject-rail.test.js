// test/subject-rail.test.js — the rail's pure core: overlap ranking, candidate indexing
// (views + okf concept tiles), the rescore-only rerank invariant, escaped HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokens, overlapScore, candidateIndex, rankBySubject, applyRerank, railHtml, railRowHtml, RAIL_K } from '../js/subject-rail.js';
import { TASKS } from '../js/demo.js';

const VIEWS = [
  { id: 'oauth', title: 'OAuth flow', heading: 'OAuth 2.0 flow', tesserae: [{ type: 'markdown', title: 'Token exchange', body: 'x' }] },
  { id: 'tokens', title: 'Access tokens', heading: 'Access tokens explained', tesserae: [{ type: 'markdown', title: 'Token lifetime', body: 'x' }] },
  { id: 'recipes', title: 'Pasta recipes', heading: 'Weeknight pasta', tesserae: [{ type: 'markdown', title: 'Carbonara', body: 'x' }] },
  { id: 'kb', title: 'Concepts', tesserae: [
    { type: 'markdown', title: 'OAuth scopes', body: 'scope grants', okf: { tags: ['oauth', 'auth'], description: 'scopes' } },
    { type: 'markdown', title: 'Béchamel', body: 'butter flour milk', okf: { tags: ['cooking'], description: 'sauce' } },
  ] },
];

test('tokens: lowercase 3+ alnum runs, stopwords dropped', () => {
  const t = tokens('The OAuth 2.0 Flow and the token');
  assert.ok(t.has('oauth') && t.has('flow') && t.has('token'));
  assert.ok(!t.has('the') && !t.has('and') && !t.has('2'));
});

test('overlapScore: 0 on disjoint/empty; symmetric; clamped', () => {
  assert.equal(overlapScore(tokens('alpha beta'), tokens('gamma delta')), 0);
  assert.equal(overlapScore(new Set(), tokens('alpha')), 0);
  const a = tokens('oauth token flow'), b = tokens('token flow lifetime');
  assert.ok(overlapScore(a, b) > 0 && overlapScore(a, b) <= 1);
  assert.equal(overlapScore(a, b), overlapScore(b, a));
});

test('candidateIndex: other views + okf concept tiles (ref viewId::i); active excluded; non-okf tiles are not candidates', () => {
  const c = candidateIndex(VIEWS, 'oauth');
  const refs = c.map(x => x.ref);
  assert.ok(!refs.includes('oauth'));
  assert.ok(refs.includes('tokens') && refs.includes('recipes') && refs.includes('kb'));
  assert.ok(refs.includes('kb::0') && refs.includes('kb::1'));       // concepts
  assert.equal(c.find(x => x.ref === 'kb::0').kind, 'concept');
  assert.ok(!refs.includes('tokens::0'));                             // plain tile ≠ candidate
});

test('rankBySubject v2: related ranks above unrelated; zero-score dropped; sorted desc; field weight shows', () => {
  const { scorer, ranked } = rankBySubject(VIEWS[0], VIEWS);
  assert.equal(scorer, 'lexical v2');
  const refs = ranked.map(r => r.ref);
  assert.ok(refs.indexOf('tokens') >= 0, 'token-overlapping view ranks');
  assert.ok(refs.indexOf('kb::0') >= 0, 'oauth concept ranks');
  assert.equal(refs[0], 'kb::0', 'title+tag match outranks a body-ish match (field weighting)');
  assert.ok(!refs.includes('recipes'), 'pasta does not rank for OAuth');   // zero-score dropped
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].score >= ranked[i].score);
});

// ── scorer v2 specifics (field weights · IDF · the Unicode tokenizer) ──
test('tokenizer v2: 2-letter acronyms live, Cyrillic tokenizes, compound tech tokens survive whole', () => {
  const t = tokens('The AI UI runs on node.js with OAuth2 — Настройка памяти');
  assert.ok(t.has('ai') && t.has('ui'), 'acronyms no longer invisible');
  assert.ok(t.has('node.js'), 'compound tech token kept whole');
  assert.ok(t.has('oauth2'), 'alnum tech token kept');
  assert.ok(t.has('настройка') && t.has('памяти'), 'Cyrillic tokenizes instead of vanishing');
  assert.ok(!t.has('the') && !t.has('on'), 'stopwords (incl. 2-letter) still dropped');
});

test('field weighting: a TITLE match outranks the same term buried in a BODY', () => {
  const active = { id: 'a', title: 'Provenance', tesserae: [] };
  const views = [active,
    { id: 'in-title', title: 'Provenance ledger', tesserae: [] },
    { id: 'in-body', title: 'Notes', subtitle: 'provenance provenance provenance', tesserae: [] },
  ];
  const { ranked } = rankBySubject(active, views);
  assert.equal(ranked[0].ref, 'in-title');
});

test('IDF: a rare shared term outranks a term every candidate carries', () => {
  const active = { id: 'a', title: 'verdigris surface', tesserae: [] };
  const views = [active,
    { id: 'rare', title: 'verdigris surface', tesserae: [] },        // shares rare + common
    { id: 'common1', title: 'surface one', tesserae: [] },           // 'surface' is everywhere
    { id: 'common2', title: 'surface two', tesserae: [] },
    { id: 'common3', title: 'surface three', tesserae: [] },
  ];
  const { ranked } = rankBySubject(active, views);
  assert.equal(ranked[0].ref, 'rare');
  assert.ok(ranked[0].score > ranked[1].score * 1.5, 'the rare-term match wins decisively, not marginally');
});

test('applyRerank: rescore-only — unknown refs ignored, no rows added/removed, clamped, resorted', () => {
  const ranked = [{ kind: 'view', ref: 'a', title: 'A', score: 0.9 }, { kind: 'view', ref: 'b', title: 'B', score: 0.5 }];
  const out = applyRerank(ranked, [{ ref: 'b', score: 5 }, { ref: 'ghost', score: 1 }, { ref: 'a', score: 0.1 }]);
  assert.equal(out.length, 2);                        // no minted rows
  assert.equal(out[0].ref, 'b');                      // clamped to 1 → first
  assert.equal(out[0].score, 1);
  assert.equal(out[1].score, 0.1);
  assert.ok(!out.some(r => r.ref === 'ghost'));
});

test('the demo showcase lights the rail: every multi-view example ranks ≥1 related row for its first view', () => {
  for (const task of TASKS) {
    const views = task.overlay.views || [];
    if (views.length < 2) continue;
    const { ranked } = rankBySubject(views[0], views);
    assert.ok(ranked.length >= 1, `example "${task.id}" leaves the rail dark`);
  }
});

test('railHtml: caps at RAIL_K with a ＋N more toggle; escapes hostile titles; empty → hidden', () => {
  const many = { scorer: 'overlap', ranked: Array.from({ length: RAIL_K + 3 }, (_, i) => ({ kind: 'view', ref: 'v' + i, title: 'V' + i, score: 1 - i * 0.05 })) };
  const html = railHtml(many, {});
  assert.match(html, /＋3 more/);
  assert.equal((html.match(/srail-row/g) || []).length, RAIL_K);
  assert.match(railHtml(many, { expanded: true }), /− less/);
  assert.equal(railHtml({ scorer: 'overlap', ranked: [] }, {}), '');
  const evil = railRowHtml({ kind: 'view', ref: 'x', title: '<img src=x onerror=alert(1)>', score: 0.5 });
  assert.doesNotMatch(evil, /<img src=x/);
  assert.match(evil, /&lt;img/);
});
