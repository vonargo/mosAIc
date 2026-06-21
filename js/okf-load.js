// OKF browser loader: pick a folder of OKF markdown → parse → render it as a surface.
// The pure parsing/adapting lives in okf.js; this is just the File-API plumbing and
// the apply. A folder picker for v1 (reliable everywhere); drag-drop is a fast-follow.

import { parseOkfBundle, okfToOverlay } from './okf.js';

const toast = (msg) => document.dispatchEvent(new CustomEvent('mosaic:toast', { detail: msg }));

// Strip the chosen top-level folder name so paths are bundle-relative (/tables/x.md),
// which is what OKF cross-links resolve against.
const bundlePath = (f) => '/' + (f.webkitRelativePath || f.name).replace(/^[^/]*\//, '');

async function loadOkfFiles(fileList) {
  const md = [...(fileList || [])].filter((f) => /\.md$/i.test(f.name));
  if (!md.length) { toast('No .md files in that folder — pick an OKF bundle.'); return; }

  let files;
  try {
    files = await Promise.all(md.map(async (f) => ({ path: bundlePath(f), text: await f.text() })));
  } catch { toast('Could not read those files.'); return; }

  const { docs, skipped } = parseOkfBundle(files);
  if (!docs.length) { toast(`No valid OKF concepts found (${skipped.length} skipped).`); return; }

  const overlay = okfToOverlay(docs);
  const tail = skipped.length ? ` · ${skipped.length} skipped` : '';
  document.dispatchEvent(new CustomEvent('mosaic:apply', {
    detail: { overlay, label: `OKF · ${docs.length} concept${docs.length === 1 ? '' : 's'}${tail}` },
  }));
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
