// The sidebar nav, rebuilt from the effective surface's views. When an overlay
// adds, drops, or reorders views, this is what makes the sidebar reshape.

import { STATE } from './state.js';
import { surface } from './surface.js';
import { navigate } from './router.js';
import { escapeHtml } from './utils.js';

export function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const views = surface().views;
  nav.innerHTML = `<div class="nav-group-label">Views</div>` + views.map((v, i) => `
    <button class="nav-item${STATE.route === v.id ? ' active' : ''}" data-id="${escapeHtml(v.id)}" style="--i:${i}">
      <span class="nav-text">${escapeHtml(v.title || v.id)}</span>
    </button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.id)));
}
