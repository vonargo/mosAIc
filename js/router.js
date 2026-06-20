import { STATE } from './state.js';
import { VIEWS, getView } from './views/index.js';
import { renderNav } from './sidebar.js';

const defaultId = () => (VIEWS[0] ? VIEWS[0].id : '');

export function navigate(id) {
  window.location.hash = id || defaultId();
}

export function handleHash() {
  const id = window.location.hash.replace(/^#/, '') || defaultId();
  const view = getView(id) || VIEWS[0] || null;
  STATE.route = view ? view.id : null;

  const mount = document.getElementById('view');
  if (mount) {
    mount.innerHTML = '';
    if (view) view.render(mount);
  }
  renderNav();
  const main = document.getElementById('main');
  if (main) main.scrollTop = 0;
}
