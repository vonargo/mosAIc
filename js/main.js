// Boot + the command bar (the control plane).
//
// The command bar is chrome — persistent controls the surface can't reshape
// away, left → right: sidebar toggle · ▦ prompt + suggestions · Composer ·
// Reset · account · theme. The prompt is the main driver: signed in, a typed
// task is sent to a model that emits an overlay (billed to the viewer, see
// llm.js); the example suggestions apply canned overlays instantly with no
// sign-in. Tesserae are the content plane an overlay reshapes.

import { renderNav } from './sidebar.js';
import { handleHash, navigate } from './router.js';
import { STATE } from './state.js';
import { surface } from './surface.js';
import { TASKS, taskById } from './demo.js';
import { retheme } from './diagram.js';
import { openComposer } from './composer.js';
import { openOkfBundle, openOkfSample, okfSearch } from './okf-load.js';
import { openSnapshots } from './snapshots.js';
import { validateOverlay, composePatch } from './overlay.js';
import { initAuth, signIn, signOut, isSignedIn, userName, oauthAvailable, onAuthChange, generateOverlay } from './llm.js';
import { initSubjectRail } from './subject-rail-boot.js';

const PENDING_KEY = 'mosaic-pending';   // a typed task stashed across the sign-in redirect

// ── prompt + suggestions ────────────────────────────────────
const promptEl  = () => document.getElementById('cmd-prompt');
const suggestEl = () => document.getElementById('cmd-suggest');

function renderSuggestions() {
  const host = suggestEl();
  if (!host) return;
  host.innerHTML =
    `<div class="suggest-head">Examples — apply instantly, no sign-in</div>` +
    TASKS.map(t => `<button class="suggest-item" type="button" role="option" data-task="${t.id}">
        <span class="suggest-label">${t.label}</span><span class="suggest-hint">${t.hint || ''}</span>
      </button>`).join('') +
    `<button class="suggest-item" type="button" role="option" data-okf="sample">
        <span class="suggest-label">▣ Open a sample OKF bundle</span><span class="suggest-hint">Google Open Knowledge Format · rendered as a reading surface</span>
      </button>`;
  host.querySelectorAll('.suggest-item').forEach(el => el.addEventListener('mousedown', e => {
    e.preventDefault();   // fire before the input's blur (which hides the list)
    hideSuggest(); promptEl()?.blur();
    if (el.dataset.okf === 'sample') { openOkfSample(); return; }
    const t = taskById(el.dataset.task);
    if (t) applyOverlay(t.overlay, { task: t.id, label: t.label });
  }));
}

function showSuggest() { const s = suggestEl(); if (s && !promptEl().value.trim()) s.hidden = false; }
function hideSuggest() { const s = suggestEl(); if (s) s.hidden = true; }

async function submitPrompt() {
  const task = promptEl().value.trim();
  if (!task) { showSuggest(); return; }
  if (!isSignedIn()) {
    if (oauthAvailable()) {
      sessionStorage.setItem(PENDING_KEY, task);   // resume it after the redirect
      toast('Signing in with Hugging Face…');
      signIn();
    } else {
      toast('Sign-in (and typed tasks) works on the deployed Space. Here, try an example or the Composer.');
      showSuggest();
    }
    return;
  }
  await runTask(task);
}

async function runTask(task) {
  const form = document.getElementById('cmd-form');
  const input = promptEl();
  const spinner = document.querySelector('.cmd-spinner');
  hideSuggest();
  form?.classList.add('thinking'); input.disabled = true; if (spinner) spinner.hidden = false;
  try {
    const patch = await generateOverlay(task, STATE.overlay);   // model patches the *current* surface
    document.dispatchEvent(new CustomEvent('mosaic:apply', { detail: { overlay: patch, label: clip(task) } }));   // the listener strips (untrusted) + composes — one boundary
    input.value = '';
  } catch (e) {
    toast(e?.message || 'Could not generate an overlay.');
  } finally {
    form?.classList.remove('thinking'); input.disabled = false; if (spinner) spinner.hidden = true;
    input.focus();
  }
}

const clip = (s) => s.length > 42 ? s.slice(0, 41) + '…' : s;

// ── account control ─────────────────────────────────────────
function renderAccount() {
  const btn = document.getElementById('cmd-account');
  if (!btn) return;
  const inb = isSignedIn();
  btn.textContent = inb ? '@' + userName() : 'Sign in';
  btn.classList.toggle('in', inb);
  btn.title = inb ? 'Sign out'
    : (oauthAvailable() ? 'Sign in with Hugging Face' : 'Sign-in is available on the deployed Space');
  btn.setAttribute('aria-label', inb ? 'Signed in — click to sign out' : 'Sign in with Hugging Face');
}

// ── overlay application (content plane) ─────────────────────
// Route to a view, re-rendering even when it's already the current route —
// setting an unchanged hash fires no `hashchange`, so editing the view you're on
// (or resetting while already on base) would otherwise not repaint.
function route(target) {
  const cur = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (target && target !== cur) navigate(target);   // hashchange → handleHash
  else handleHash();                                // same route → render now
}

// Show the OKF concept filter only when the surface is a loaded OKF bundle.
function syncOkfSearch(show) {
  const el = document.getElementById('okf-search');
  if (!el) return;
  el.hidden = !show;
  if (!show) el.value = '';
}

function applyOverlay(overlay, { task = null, label = null, target = null } = {}) {
  STATE.overlay = overlay || {};
  STATE.task = task;
  persistSurface();
  syncOkfSearch((overlay?.views || []).some(v => (v.tesserae || []).some(t => t && t.okf)));

  // Navigate to the explicit `target` (the NEW view a patch introduced — the listener passes the
  // patch's first view, since the *composed* surface's first view is a stale base panel). Direct
  // callers (the demo tasks) fall back to the overlay's first view, then the current route.
  const views = surface().views;
  const tgt = target || overlay?.views?.[0]?.id ||
    (views.find(v => v.id === STATE.route) ? STATE.route : views[0]?.id);

  flashReshape();
  route(tgt);
  if (label) toast(`Reconfigured · ${label}`);
}

function resetOverlay() {
  STATE.overlay = {};
  STATE.task = null;
  persistSurface();
  syncOkfSearch(false);
  flashReshape();
  route(surface().views[0]?.id);
  toast('Reset to base');
}

function flashReshape() {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('reshaping');
  void app.offsetWidth;            // restart the animation
  app.classList.add('reshaping');
  setTimeout(() => app.classList.remove('reshaping'), 700);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

// Persist the reshaped surface (per tab) so a reload — and the sign-in redirect —
// restores it instead of dropping back to Start Here. Validated on the way back
// in, so a stale/corrupt value can't break the render.
const SURFACE_KEY = 'mosaic-surface';
function persistSurface() {
  try {
    const ov = STATE.overlay;
    if (ov && (ov.views?.length || ov.remove?.length))
      sessionStorage.setItem(SURFACE_KEY, JSON.stringify({ overlay: ov, task: STATE.task }));
    else sessionStorage.removeItem(SURFACE_KEY);
  } catch { /* storage unavailable — just don't persist */ }
}
function restoreSurface() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SURFACE_KEY) || 'null');
    if (!saved?.overlay) return;
    const v = validateOverlay(saved.overlay);
    if (v.ok) { STATE.overlay = v.overlay; STATE.task = saved.task || null; }
  } catch { /* corrupt value — ignore, fall back to base */ }
}

function boot() {
  restoreSurface();   // bring back the reshaped surface after a reload / redirect
  renderSuggestions();
  renderNav();
  handleHash();
  window.addEventListener('hashchange', handleHash);
  initSubjectRail();   // the subject rail — related views/concepts, ranked, under the nav

  // Apply path — the model, the Composer, and the OKF loader all dispatch mosaic:apply. This is
  // the ONE boundary: validate → strip provenance unless trusted → compose (unless replace).
  document.addEventListener('mosaic:apply', e => {
    const { overlay: raw, label, trusted = false, replace = false } = e.detail || {};
    const v = validateOverlay(raw);
    if (!v.ok) { toast('Invalid overlay — ' + v.error); return; }
    // The single apply boundary: strip provenance unless trusted, then compose unless replace
    // (composePatch — pure + tested in core.test.js). Navigate to the patch's own first view
    // (strip preserves ids), not the composed surface's stale base view.
    const next = composePatch(STATE.overlay, v.overlay, { trusted, replace });
    applyOverlay(next, { label: label || 'Custom overlay', target: v.overlay.views?.[0]?.id });
  });
  document.addEventListener('mosaic:reset', resetOverlay);
  document.getElementById('composer-open')?.addEventListener('click', openComposer);
  document.getElementById('okf-open')?.addEventListener('click', openOkfBundle);
  document.getElementById('snap-open')?.addEventListener('click', openSnapshots);
  const okfSearchEl = document.getElementById('okf-search');
  let okfSearchT;
  okfSearchEl?.addEventListener('input', () => {
    clearTimeout(okfSearchT);
    okfSearchT = setTimeout(() => okfSearch(okfSearchEl.value), 250);
  });
  document.getElementById('cmd-reset')?.addEventListener('click', resetOverlay);
  document.addEventListener('mosaic:toast', e => toast(e.detail));

  // Prompt
  const form = document.getElementById('cmd-form');
  const input = promptEl();
  form?.addEventListener('submit', e => { e.preventDefault(); submitPrompt(); });
  input?.addEventListener('focus', showSuggest);
  input?.addEventListener('input', () => (input.value.trim() ? hideSuggest() : showSuggest()));
  input?.addEventListener('blur', () => setTimeout(hideSuggest, 120));   // let a suggestion click land
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideSuggest(); });

  // Account / auth
  renderAccount();
  onAuthChange(renderAccount);
  document.getElementById('cmd-account')?.addEventListener('click', () => {
    if (isSignedIn()) { signOut(); toast('Signed out'); }
    else if (oauthAvailable()) signIn();
    else toast('Sign-in is available on the deployed Hugging Face Space.');
  });
  initAuth().then(() => {
    renderAccount();
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (!pending) return;
    sessionStorage.removeItem(PENDING_KEY);
    if (isSignedIn()) { if (input) input.value = pending; runTask(pending); }
  });

  // Sidebar collapse — in the command bar so it's reachable when the sidebar is
  // hidden (collapse *and* re-open). Persisted; the chevron rolls with the dock.
  const app = document.getElementById('app');
  const sbToggle = document.getElementById('sb-toggle');
  const syncSb = () => {
    const collapsed = app.classList.contains('sb-collapsed');
    sbToggle?.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    sbToggle?.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
    if (sbToggle) sbToggle.title = collapsed ? 'Show sidebar' : 'Hide sidebar';
  };
  if (localStorage.getItem('mosaic-sb-collapsed') === '1') app.classList.add('sb-collapsed');
  syncSb();
  sbToggle?.addEventListener('click', () => {
    app.classList.toggle('sb-collapsed');
    localStorage.setItem('mosaic-sb-collapsed', app.classList.contains('sb-collapsed') ? '1' : '0');
    syncSb();
  });

  // Theme toggle (far right). data-theme is seeded pre-paint by the inline
  // <head> script; here we flip + persist, sync the button, and repaint diagrams.
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const syncThemeBtn = (t) => {
    if (!themeBtn) return;
    const dark = t === 'dark';
    themeBtn.textContent = `${dark ? '☀' : '☾'} Theme`;
    themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  syncThemeBtn(root.getAttribute('data-theme'));
  themeBtn?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('mosaic-theme', next);
    syncThemeBtn(next);
    retheme();
  });
}

boot();
