// The Composer — a command-bar driver, not a tessera.
//
// Controls are chrome: they live in the command bar so the surface can't reshape
// them away, and they're reachable from every view. The Composer opens a drawer
// with the overlay JSON editor and applies it through the same mosaic:apply /
// mosaic:reset events the task chips use. Tesserae stay pure content.

import { escapeHtml } from './utils.js';
import { validateOverlay } from './overlay.js';
import { STATE } from './state.js';

// Pre-filled sample: the exact JSON an LLM emits. Applying it adds a Notes view
// to the sidebar — proof the surface is live.
const SAMPLE = `{
  "views": [
    {
      "id": "notes",
      "title": "Notes",
      "layout": "stack",
      "tesserae": [
        { "type": "markdown", "title": "Scratch",
          "body": "Edit this JSON and **Apply** — MosAIc adds a *Notes* view to the sidebar and renders it. This is the exact contract an LLM emits.\\n\\n- rename the view\\n- add a tessera\\n- switch the layout" },
        { "type": "tasks", "title": "Try", "items": [
          { "text": "Rename this view", "done": false },
          { "text": "Add a code tessera", "done": false },
          { "text": "Switch the layout to grid", "done": false }
        ] }
      ]
    }
  ]
}`;

let drawer = null;

function build() {
  drawer = document.createElement('div');
  drawer.className = 'composer-drawer';
  drawer.innerHTML = `
    <div class="composer-scrim" data-close></div>
    <aside class="composer-panel" role="dialog" aria-modal="true" aria-label="Composer — emit an overlay">
      <div class="composer-panel-head">
        <span class="composer-panel-title">Composer — emit an overlay</span>
        <button class="composer-close" type="button" data-close aria-label="Close composer">✕</button>
      </div>
      <p class="composer-panel-hint">The JSON an LLM emits to reshape the surface. Edit it and <strong>Apply</strong>.</p>
      <textarea class="composer-input" spellcheck="false" aria-label="Overlay JSON">${escapeHtml(SAMPLE)}</textarea>
      <div class="composer-row">
        <button class="composer-apply" type="button">Apply overlay</button>
        <button class="composer-reset" type="button">Reset to base</button>
        <span class="composer-msg" role="status"></span>
      </div>
    </aside>`;
  document.body.appendChild(drawer);

  const ta = drawer.querySelector('.composer-input');
  const msg = drawer.querySelector('.composer-msg');
  const clear = () => { msg.textContent = ''; msg.className = 'composer-msg'; };

  drawer.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeComposer));

  drawer.querySelector('.composer-apply').addEventListener('click', () => {
    let parsed;
    try { parsed = JSON.parse(ta.value); }
    catch (e) { msg.textContent = 'Invalid JSON — ' + e.message; msg.className = 'composer-msg err'; return; }
    const v = validateOverlay(parsed);
    if (!v.ok) { msg.textContent = 'Invalid overlay — ' + v.error; msg.className = 'composer-msg err'; return; }
    clear();
    document.dispatchEvent(new CustomEvent('mosaic:apply', { detail: { overlay: v.overlay, label: 'Composer' } }));
    closeComposer();
  });

  drawer.querySelector('.composer-reset').addEventListener('click', () => {
    clear();
    document.dispatchEvent(new CustomEvent('mosaic:reset'));
    closeComposer();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeComposer();
  });
  return drawer;
}

// Seed the editor with the overlay that's *currently applied*, so you edit the
// surface you're looking at (e.g. tweak an example you just opened) instead of
// always emitting a fresh one. On the base — nothing applied — show the sample.
function seedJson() {
  const ov = STATE.overlay;
  return (ov && Array.isArray(ov.views) && ov.views.length) ? JSON.stringify(ov, null, 2) : SAMPLE;
}

export function openComposer() {
  const d = drawer || build();
  const ta = d.querySelector('.composer-input');
  ta.value = seedJson();
  const msg = d.querySelector('.composer-msg');
  msg.textContent = ''; msg.className = 'composer-msg';
  d.classList.add('open');
  requestAnimationFrame(() => ta.focus());
}

export function closeComposer() {
  if (!drawer) return;
  drawer.classList.remove('open');
  document.getElementById('composer-open')?.focus();   // return focus to the opener
}
