// Boot + the command bar that drives reconfiguration.
//
// Flow: render the command bar and sidebar, route the hash, then wire events.
// Applying a task (or a composer overlay) sets STATE.overlay and re-routes —
// the whole render path reads from the effective surface, so sidebar + tiles
// reshape together. A one-time auto-demo on first visit makes that visible
// within a few seconds of landing.

import { renderNav } from './sidebar.js';
import { handleHash, navigate } from './router.js';
import { STATE } from './state.js';
import { surface } from './surface.js';
import { TASKS } from './demo.js';
import { retheme } from './diagram.js';

const MOSAIC_MARK =
  `<svg class="cmd-mark" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <rect x="0" y="0" width="8" height="8" rx="1.5"/><rect x="10" y="0" width="8" height="8" rx="1.5"/>
    <rect x="0" y="10" width="8" height="8" rx="1.5"/><rect x="10" y="10" width="8" height="8" rx="1.5"/>
  </svg>`;

function renderCommandBar() {
  const bar = document.getElementById('cmdbar');
  if (!bar) return;
  bar.innerHTML =
    `<div class="cmd-lead">${MOSAIC_MARK}<span class="cmd-label">Direct the surface</span></div>` +
    `<div class="cmd-tasks">` +
      TASKS.map(t => `<button class="cmd-chip${STATE.task === t.id ? ' active' : ''}" data-task="${t.id}">${t.label}</button>`).join('') +
      `<button class="cmd-reset" data-reset>Reset</button>` +
    `</div>`;

  bar.querySelectorAll('.cmd-chip').forEach(el => el.addEventListener('click', () => {
    const t = TASKS.find(x => x.id === el.dataset.task);
    if (t) applyOverlay(t.overlay, { task: t.id, label: t.label });
  }));
  bar.querySelector('[data-reset]')?.addEventListener('click', resetOverlay);
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
  renderCommandBar();
  if (label) toast(`Reconfigured · ${label}`);
}

function resetOverlay() {
  STATE.overlay = {};
  STATE.task = null;
  flashReshape();
  navigate(surface().views[0]?.id);
  renderCommandBar();
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

// First visit, no chosen route: land on base, then reshape once so the thesis
// reads immediately. sessionStorage keeps it to once per session/tab.
function maybeAutoDemo() {
  if (window.location.hash) return;
  if (sessionStorage.getItem('mosaic-demo')) return;
  sessionStorage.setItem('mosaic-demo', '1');
  const t = TASKS.find(x => x.id === 'debug') || TASKS[0];
  setTimeout(() => {
    const here = window.location.hash.replace(/^#/, '');
    if (!STATE.task && (here === '' || here === 'start')) {
      applyOverlay(t.overlay, { task: t.id, label: t.label });
    }
  }, 2200);
}

function boot() {
  renderCommandBar();
  renderNav();
  handleHash();
  window.addEventListener('hashchange', handleHash);

  document.addEventListener('mosaic:apply', e => applyOverlay(e.detail.overlay, { label: e.detail.label || 'Custom overlay' }));
  document.addEventListener('mosaic:reset', resetOverlay);

  const app = document.getElementById('app');
  if (localStorage.getItem('mosaic-sb-collapsed') === '1') app.classList.add('sb-collapsed');
  document.getElementById('sb-toggle').addEventListener('click', () => {
    app.classList.toggle('sb-collapsed');
    localStorage.setItem('mosaic-sb-collapsed', app.classList.contains('sb-collapsed') ? '1' : '0');
  });
  // Theme toggle. data-theme is seeded pre-paint by the inline <head> script
  // (so no flash on load); here we just flip + persist it, sync the button, and
  // repaint Mermaid diagrams to match (rendered SVGs don't re-theme themselves).
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

  maybeAutoDemo();
}

boot();
