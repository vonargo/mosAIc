// OKF core: frontmatter parsing, bundle classification, and the overlay adapter.
// Inline spec-faithful fixtures — no filesystem, same zero-dep style as core.test.js.
// (The repo's published "samples" are agent seeds, not generated bundles, so these
// hand-authored docs — straight from SPEC.md — are the ground truth.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseOkfDoc, parseOkfBundle, okfToOverlay, okfFilter } from '../js/okf.js';

const ORDERS = `---
type: BigQuery Table
title: Customer Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?t=orders
tags: [sales, orders, revenue]
timestamp: 2026-05-28T14:30:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| \`customer_id\` | STRING | FK into [customers](/tables/customers.md). |

# Joins

Joined with [customers](/tables/customers.md) on \`customer_id\`.

# Citations

[1] [BigQuery schema](https://console.cloud.google.com/bigquery?t=orders)
`;

const CUSTOMERS = `---
type: BigQuery Table
title: Customers
resource: https://console.cloud.google.com/bigquery?t=customers
tags:
  - sales
  - crm
timestamp: 2026-05-20T09:00:00Z
---

# Schema

One row per customer.
`;

const REVENUE = `---
type: Metric
title: "Monthly Revenue"
description: Completed-order revenue per month.
tags: [revenue, finance]
owner: finance-team
---

Sum of revenue from [orders](/tables/orders.md), by month.
`;

const REFUNDS = `---
type: Playbook
---

# Refunds

Steps to process a refund. See [orders](/tables/orders.md).
`;

const NO_TYPE = `---
title: Missing type
description: No type field, which is required.
---

Body.
`;

const BUNDLE = [
  { path: '/index.md', text: '# Catalog\n\n- [Orders](/tables/orders.md)\n' },
  { path: '/log.md', text: '# Log\n\n- 2026-05-28 — initial catalog\n' },
  { path: '/tables/orders.md', text: ORDERS },
  { path: '/tables/customers.md', text: CUSTOMERS },
  { path: '/metrics/monthly_revenue.md', text: REVENUE },
  { path: '/playbooks/refunds.md', text: REFUNDS },
  { path: '/no-type.md', text: NO_TYPE },
];

// ── parseOkfDoc ─────────────────────────────────────────────
test('parseOkfDoc: a full concept — all fields, inline tags, citations, cross-links', () => {
  const d = parseOkfDoc('/tables/orders.md', ORDERS);
  assert.equal(d.type, 'BigQuery Table');
  assert.equal(d.title, 'Customer Orders');
  assert.deepEqual(d.tags, ['sales', 'orders', 'revenue']);
  assert.match(d.resource, /bigquery/);
  assert.equal(d.timestamp, '2026-05-28T14:30:00Z');
  assert.equal(d.citations.length, 1);
  assert.equal(d.citations[0].url, 'https://console.cloud.google.com/bigquery?t=orders');
  assert.deepEqual(d.links.map((l) => l.target), ['/tables/customers.md']);   // deduped
  assert.match(d.body, /^# Schema/);                                          // frontmatter stripped
});

test('parseOkfDoc: block-list tags + missing optional description', () => {
  const d = parseOkfDoc('/tables/customers.md', CUSTOMERS);
  assert.deepEqual(d.tags, ['sales', 'crm']);
  assert.equal(d.description, '');
});

test('parseOkfDoc: quoted title is unquoted + a custom key is preserved', () => {
  const d = parseOkfDoc('/metrics/monthly_revenue.md', REVENUE);
  assert.equal(d.title, 'Monthly Revenue');
  assert.equal(d.custom.owner, 'finance-team');
});

test('parseOkfDoc: minimal doc — only required type, title derived from filename', () => {
  const d = parseOkfDoc('/playbooks/refunds.md', REFUNDS);
  assert.equal(d.type, 'Playbook');
  assert.equal(d.title, 'Refunds');
  assert.deepEqual(d.tags, []);
  assert.equal(d.resource, '');
});

test('parseOkfDoc: reserved index.md / log.md are flagged, not parsed as concepts', () => {
  assert.equal(parseOkfDoc('/index.md', '# hi').reserved, 'index');
  assert.equal(parseOkfDoc('/log.md', '# log').reserved, 'log');
});

test('parseOkfDoc: missing required `type` is malformed', () => {
  assert.match(parseOkfDoc('/no-type.md', NO_TYPE).malformed, /type/);
});

test('parseOkfDoc: a file with no frontmatter is malformed', () => {
  assert.match(parseOkfDoc('/loose.md', 'just a body, no frontmatter').malformed, /frontmatter/);
});

// ── parseOkfBundle ──────────────────────────────────────────
test('parseOkfBundle: sorts a bundle into docs / reserved / skipped', () => {
  const { docs, reserved, skipped } = parseOkfBundle(BUNDLE);
  assert.equal(docs.length, 4);        // orders, customers, monthly_revenue, refunds
  assert.equal(reserved.length, 2);    // index, log
  assert.equal(skipped.length, 1);     // no-type
  assert.match(skipped[0].reason, /type/);
});

// ── okfToOverlay ────────────────────────────────────────────
test('okfToOverlay: one view per type, one markdown tessera per doc', () => {
  const { docs } = parseOkfBundle(BUNDLE);
  const overlay = okfToOverlay(docs);
  assert.deepEqual(overlay.views.map((v) => v.id), ['bigquery-table', 'metric', 'playbook']);
  const table = overlay.views.find((v) => v.id === 'bigquery-table');
  assert.equal(table.tesserae.length, 2);                 // orders + customers
  assert.equal(table.tesserae[0].type, 'markdown');
  assert.equal(table.tesserae[0].title, 'Customer Orders');
});

test('okfToOverlay: concept views are grid with full-row tiles — reads like a column, but resizable', () => {
  const { docs } = parseOkfBundle(BUNDLE);
  const overlay = okfToOverlay(docs);
  for (const v of overlay.views) {
    assert.equal(v.layout, 'grid');                       // stack hides the resize handle
    for (const t of v.tesserae) assert.equal(t.span, 2);  // full row by default → same reading feel
  }
});

test('okfToOverlay: carries OKF metadata + the sourced/unsourced provenance signal', () => {
  const { docs } = parseOkfBundle(BUNDLE);
  const overlay = okfToOverlay(docs);
  const orders = overlay.views.find((v) => v.id === 'bigquery-table').tesserae[0];
  assert.equal(orders.okf.resource, 'https://console.cloud.google.com/bigquery?t=orders');
  assert.deepEqual(orders.okf.tags, ['sales', 'orders', 'revenue']);
  assert.equal(orders.okf.sourced, true);                 // has a resource + a citation
  const refunds = overlay.views.find((v) => v.id === 'playbook').tesserae[0];
  assert.equal(refunds.okf.sourced, false);               // no resource, no citations → unsourced
});

test('okfToOverlay: in-bundle cross-links are rewritten to in-app routes; external links untouched', () => {
  const { docs } = parseOkfBundle(BUNDLE);
  const overlay = okfToOverlay(docs);
  const orders = overlay.views.find((v) => v.id === 'bigquery-table').tesserae[0];
  assert.match(orders.body, /\[customers\]\(#bigquery-table\)/);   // /tables/customers.md → its view
  assert.doesNotMatch(orders.body, /customers\.md/);               // original target gone
  assert.match(orders.body, /\(https:\/\/console\.cloud\.google\.com/);  // citation URL left alone
});

// ── okfFilter(): deterministic search = the LLM-scoping mechanism ─
test('okfFilter: empty returns all; a term matches across type/title/tags/body', () => {
  const { docs } = parseOkfBundle(BUNDLE);
  assert.equal(okfFilter(docs, '').length, docs.length);
  assert.equal(okfFilter(docs, 'bigquery').length, 2);                            // both BigQuery Tables (by type)
  assert.deepEqual(okfFilter(docs, 'playbook').map((d) => d.type), ['Playbook']); // by type
});

test('okfFilter: multiple words are AND-ed across the concept', () => {
  const { docs } = parseOkfBundle(BUNDLE);
  assert.deepEqual(okfFilter(docs, 'monthly finance').map((d) => d.title), ['Monthly Revenue']); // title + tag
  assert.equal(okfFilter(docs, 'bigquery playbook').length, 0);                                  // no concept is both
});
