// Boot + the command bar (the control plane).
//
// The command bar is chrome — persistent controls the surface can't reshape
// away, left → right: sidebar toggle · "Direct the surface" + task chips +
// Composer + Reset · theme toggle. Tesserae are the content plane an overlay
// reshapes. Applying a task chip or a Composer overlay sets STATE.overlay and
// re-routes; the render path reads the effective surface, so the sidebar and
// tiles reshape together. Only the chips are re-rendered here; everything else
// is static markup wired once.

import { renderNav } from './sidebar.js';
import { handleHash, navigate } from './router.js';
import { STATE } from './state.js';
import { surface } from './surface.js';
import { TASKS } from './demo.js';
import { retheme } from './diagram.js';
import { openComposer } from './composer.js';

// The task chips — the only dynamic part of the command bar (active state
// tracks STATE.task). The rest of the bar is static chrome.
function renderChips() {
  const host = document.getElementById('cmd-tasks');
  if (!host) return;
  host.innerHTML = TASKS.map(t =>
    `<button class="cmd-chip${STATE.task === t.id ? ' active' : ''}" data-task="${t.id}">${t.label}</button>`).join('');
  host.querySelectorAll('.cmd-chip').forEach(el => el.addEventListener('click', () => {
    const t = TASKS.find(x => x.id === el.dataset.task);
    if (t) applyOverlay(t.overlay, { task: t.id, label: t.label });
  }));
}

function applyOverlay(overlay, { task = null, label = null } = {}) {
  STATE.overlay = overlay || {};
  STATE.task = task;

  const views = surface().views;
  const target =
    overlay?.views?.[0]?.id ||                                  // jump to what was just emitted
    (views.find(v => v.id === STATE.route) ? STATE.route : views[0]?.id);

  flashReshape();
  navigate(target);          // → handleHash re-renders the view + sidebar
  renderChips();
  if (label) toast(`Reconfigured · ${label}`);
}

function resetOverlay() {
  STATE.overlay = {};
  STATE.task = null;
  flashReshape();
  navigate(surface().views[0]?.id);
  renderChips();
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
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}

function boot() {
  renderChips();
  renderNav();
  handleHash();
  window.addEventListener('hashchange', handleHash);

  // Composer + chips emit the same events; the Composer button opens the drawer.
  document.addEventListener('mosaic:apply', e => applyOverlay(e.detail.overlay, { label: e.detail.label || 'Custom overlay' }));
  document.addEventListener('mosaic:reset', resetOverlay);
  document.getElementById('composer-open')?.addEventListener('click', openComposer);
  document.getElementById('cmd-reset')?.addEventListener('click', resetOverlay);

  // Sidebar collapse. Lives in the command bar so it stays reachable when the
  // sidebar is hidden — collapse *and* re-open (the old in-sidebar button hid
  // itself on collapse). State persisted in localStorage.
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
  // <head> script; here we flip + persist, sync the button, and repaint Mermaid
  // diagrams to match (a rendered SVG doesn't re-theme itself).
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
