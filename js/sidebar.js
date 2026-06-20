import { STATE } from './state.js';
import { VIEWS } from './views/index.js';
import { navigate } from './router.js';

export function renderSidebar() {
  renderNav();
}

export function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = `<div class="nav-group-label">Views</div>` + VIEWS.map(v => `
    <div class="nav-item${STATE.route === v.id ? ' active' : ''}" data-id="${v.id}">
      <span class="nav-text">${v.title}</span>
    </div>`).join('');
  nav.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.id)));
}
