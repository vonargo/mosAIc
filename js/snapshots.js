// Snapshots — "◆ Set": freeze the current arrangement as a durable, named thing.
//
// The auto-save (persistSurface) keeps the working surface per-TAB in sessionStorage, so it survives
// a same-tab reload but not a new tab / close / the sign-in redirect — by design (a demo visitor
// starts clean). A snapshot is the opposite: an explicit, named capture in localStorage that survives
// all of that. The surface IS an overlay, so a snapshot is just {overlay + the reshape map} at a moment
// — captured, restored, exported, or imported through the same one apply boundary the model uses.

import { escapeHtml } from './utils.js';
import { validateOverlay } from './overlay.js';
import { STATE, exportReshapes, importReshapes } from './state.js';

const SNAP_KEY = 'mosaic-snapshots';
const FORMAT = 1;

// ── pure core (no DOM, no storage) — the serialize/parse roundtrip is the risky part, so it's testable
export function captureSurface() {
  return { overlay: JSON.parse(JSON.stringify(STATE.overlay || {})), reshapes: exportReshapes() };
}

// A portable document: a versioned wrapper around {overlay, reshapes} for export/import (and share).
export function serializeSurface(overlay, reshapes) {
  return JSON.stringify({ mosaic: 'surface', format: FORMAT, overlay: overlay || {}, reshapes: reshapes || {} }, null, 2);
}

// Parse an exported surface (or a bare overlay) → { ok, overlay, reshapes } | { ok:false, error }.
// The overlay is re-validated (same gate as every other apply); reshapes must be a plain object.
export function parseSurface(text) {
  let doc;
  try { doc = JSON.parse(text); } catch (e) { return { ok: false, error: 'not JSON — ' + e.message }; }
  if (!doc || typeof doc !== 'object') return { ok: false, error: 'empty document' };
  const rawOverlay = ('overlay' in doc) ? doc.overlay : doc;         // accept a bare overlay too
  const v = validateOverlay(rawOverlay);
  if (!v.ok) return { ok: false, error: v.error };
  const reshapes = (doc.reshapes && typeof doc.reshapes === 'object') ? doc.reshapes : {};
  return { ok: true, overlay: v.overlay, reshapes };
}

// ── storage (localStorage) — keyed map { name: { savedAt, overlay, reshapes } }
function readSnaps() { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '{}') || {}; } catch { return {}; } }
function writeSnaps(obj) { try { localStorage.setItem(SNAP_KEY, JSON.stringify(obj)); } catch { /* storage off */ } }

export function listSnapshots() {
  const all = readSnaps();
  return Object.keys(all).map(name => ({ name, savedAt: all[name].savedAt || 0 }))
    .sort((a, b) => b.savedAt - a.savedAt);
}
export function saveSnapshot(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  const all = readSnaps();
  const cap = captureSurface();
  all[n] = { savedAt: Date.now(), overlay: cap.overlay, reshapes: cap.reshapes };
  writeSnaps(all);
  return true;
}
export function deleteSnapshot(name) { const all = readSnaps(); delete all[name]; writeSnaps(all); }

// Restore = swap the reshape map in, then apply the overlay as a full REPLACE. Trusted: it's the
// human's own saved surface, so provenance (okf) it legitimately carries is kept, not stripped.
function applySurface(overlay, reshapes, label) {
  importReshapes(reshapes || {});
  document.dispatchEvent(new CustomEvent('mosaic:apply', {
    detail: { overlay, label: label || 'snapshot', trusted: true, replace: true },
  }));
}
export function restoreSnapshot(name) {
  const snap = readSnaps()[name];
  if (!snap) return false;
  applySurface(snap.overlay || {}, snap.reshapes || {}, 'Set · ' + name);
  return true;
}

// ── export / import (a file) ────────────────────────────────────────────────
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ── the drawer (mirrors the Composer's pattern) ──────────────────────────────
let drawer = null;
const fmtWhen = (ts) => { try { return new Date(ts).toLocaleString(); } catch { return ''; } };

function rowsHtml() {
  const snaps = listSnapshots();
  if (!snaps.length) return `<p class="snap-empty">No saved arrangements yet. Name this one and press <strong>Set</strong>.</p>`;
  return `<ul class="snap-list">` + snaps.map(s =>
    `<li class="snap-item"><span class="snap-name">${escapeHtml(s.name)}</span>` +
    `<span class="snap-when">${escapeHtml(fmtWhen(s.savedAt))}</span>` +
    `<span class="snap-acts"><button class="snap-restore" type="button" data-name="${escapeHtml(s.name)}">Restore</button>` +
    `<button class="snap-del" type="button" data-name="${escapeHtml(s.name)}" title="Delete">✕</button></span></li>`).join('') +
    `</ul>`;
}

function refreshList() { if (drawer) drawer.querySelector('.snap-listwrap').innerHTML = rowsHtml(); }

function build() {
  drawer = document.createElement('div');
  drawer.className = 'composer-drawer snap-drawer';
  drawer.innerHTML = `
    <div class="composer-scrim" data-close></div>
    <aside class="composer-panel" role="dialog" aria-modal="true" aria-label="Set — save this arrangement">
      <div class="composer-panel-head">
        <span class="composer-panel-title">◆ Set — save this arrangement</span>
        <button class="composer-close" type="button" data-close aria-label="Close">✕</button>
      </div>
      <p class="composer-panel-hint">Freeze the current layout as a named arrangement you can return to. Saved on this browser; survives new tabs and reloads.</p>
      <div class="snap-saverow">
        <input class="snap-input" type="text" placeholder="Name this arrangement…" aria-label="Snapshot name" autocomplete="off" spellcheck="false">
        <button class="snap-save" type="button">◆ Set</button>
      </div>
      <div class="snap-listwrap">${rowsHtml()}</div>
      <div class="composer-row snap-io">
        <button class="snap-export" type="button">Export JSON</button>
        <button class="snap-import" type="button">Import JSON</button>
        <input class="snap-file" type="file" accept="application/json,.json" hidden>
        <span class="composer-msg snap-msg" role="status"></span>
      </div>
    </aside>`;
  document.body.appendChild(drawer);

  const input = drawer.querySelector('.snap-input');
  const msg = drawer.querySelector('.snap-msg');
  const flash = (t, err) => { msg.textContent = t; msg.className = 'composer-msg snap-msg' + (err ? ' err' : ''); };

  drawer.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeSnapshots));

  const doSave = () => {
    if (!saveSnapshot(input.value)) { flash('Name it first.', true); input.focus(); return; }
    const n = input.value.trim(); input.value = '';
    refreshList(); flash('Set “' + n + '”.', false);
  };
  drawer.querySelector('.snap-save').addEventListener('click', doSave);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });

  drawer.querySelector('.snap-listwrap').addEventListener('click', e => {
    const r = e.target.closest('.snap-restore');
    const d = e.target.closest('.snap-del');
    if (r) { restoreSnapshot(r.dataset.name); closeSnapshots(); }
    else if (d) { deleteSnapshot(d.dataset.name); refreshList(); }
  });

  drawer.querySelector('.snap-export').addEventListener('click', () => {
    const cap = captureSurface();
    downloadText('mosaic-arrangement.json', serializeSurface(cap.overlay, cap.reshapes));
    flash('Exported.', false);
  });
  const file = drawer.querySelector('.snap-file');
  drawer.querySelector('.snap-import').addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseSurface(String(reader.result || ''));
      if (!res.ok) { flash('Invalid file — ' + res.error, true); return; }
      applySurface(res.overlay, res.reshapes, 'Imported arrangement');
      closeSnapshots();
    };
    reader.readAsText(f);
    file.value = '';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeSnapshots();
  });
  return drawer;
}

export function openSnapshots() {
  const d = drawer || build();
  refreshList();
  d.querySelector('.snap-msg').textContent = '';
  d.classList.add('open');
  requestAnimationFrame(() => d.querySelector('.snap-input').focus());
}
export function closeSnapshots() {
  if (!drawer) return;
  drawer.classList.remove('open');
  document.getElementById('snap-open')?.focus();
}
