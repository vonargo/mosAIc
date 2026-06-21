// OKF browser loader: pick a folder of OKF markdown → parse → render it as a surface.
// The pure parsing/adapting lives in okf.js; this is just the File-API plumbing and
// the apply. A folder picker for v1 (reliable everywhere); drag-drop is a fast-follow.

import { parseOkfBundle, okfToOverlay, okfFilter } from './okf.js';

const toast = (msg) => document.dispatchEvent(new CustomEvent('mosaic:toast', { detail: msg }));

// Strip the chosen top-level folder name so paths are bundle-relative (/tables/x.md),
// which is what OKF cross-links resolve against.
const bundlePath = (f) => '/' + (f.webkitRelativePath || f.name).replace(/^[^/]*\//, '');

// The concepts of the currently-loaded bundle, kept so the filter can re-scope them.
let _docs = [];

// Parse a bundle's files and apply it as a surface. Shared by the folder picker and
// the built-in sample; surfaces a notice if nothing usable parsed.
function applyOkf(files) {
  const { docs, skipped } = parseOkfBundle(files);
  if (!docs.length) { toast(`No valid OKF concepts found (${skipped.length} skipped).`); return; }
  _docs = docs;
  const tail = skipped.length ? ` · ${skipped.length} skipped` : '';
  document.dispatchEvent(new CustomEvent('mosaic:apply', {
    detail: { overlay: okfToOverlay(docs), label: `OKF · ${docs.length} concept${docs.length === 1 ? '' : 's'}${tail}` },
  }));
}

// Deterministic filter over the loaded bundle — re-applies the matching subset as the
// surface (which also scopes the next LLM query to those concepts). Empty query → all.
export function okfSearch(query) {
  if (!_docs.length) return;
  const hits = okfFilter(_docs, query);
  if (!hits.length) { toast('No concepts match — clear the filter to see all.'); return; }
  document.dispatchEvent(new CustomEvent('mosaic:apply', {
    detail: { overlay: okfToOverlay(hits), label: `OKF · ${hits.length} of ${_docs.length}` },
  }));
}

async function loadOkfFiles(fileList) {
  const md = [...(fileList || [])].filter((f) => /\.md$/i.test(f.name));
  if (!md.length) { toast('No .md files in that folder — pick an OKF bundle.'); return; }
  try {
    applyOkf(await Promise.all(md.map(async (f) => ({ path: bundlePath(f), text: await f.text() }))));
  } catch { toast('Could not read those files.'); }
}

// The built-in sample bundle (shipped under /samples) — a no-upload, no-login on-ramp,
// so the deployed Space demos OKF in one click, like the example overlays.
const SAMPLE_BASE = 'samples/store-catalog/';
const SAMPLE_FILES = ['index.md', 'orders.md', 'customers.md', 'monthly-revenue.md', 'refund-rate.md', 'refund-playbook.md'];
export async function openOkfSample() {
  try {
    applyOkf(await Promise.all(SAMPLE_FILES.map(async (n) => {
      const r = await fetch(SAMPLE_BASE + n);
      if (!r.ok) throw new Error(n);
      return { path: '/' + n, text: await r.text() };
    })));
  } catch { toast('Could not load the sample OKF bundle.'); }
}

// Open the folder picker. webkitdirectory yields every file in the folder, each with
// a `webkitRelativePath` we turn into a bundle-relative path.
export function openOkfBundle() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.webkitdirectory = true;
  input.style.display = 'none';
  input.addEventListener('change', () => { loadOkfFiles(input.files); input.remove(); });
  document.body.appendChild(input);
  input.click();
}
