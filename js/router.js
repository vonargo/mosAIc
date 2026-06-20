// Hash router. Resolves `#id` against the *effective* surface (post-overlay)
// via surface.js, then renders the view through the tessera render path.

import { STATE } from './state.js';
import { surface, viewById } from './surface.js';
import { renderNav } from './sidebar.js';
import { renderView } from './view.js';

const defaultId = () => surface().views[0]?.id || '';

export function navigate(id) {
  window.location.hash = id || defaultId();
}

export function handleHash() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, '')) || defaultId();
  const view = viewById(id);
  STATE.route = view ? view.id : null;

  const mount = document.getElementById('view');
  if (mount) {
    mount.innerHTML = '';
    if (view) renderView(view, mount);
  }
  renderNav();
  const main = document.getElementById('main');
  if (main) main.scrollTop = 0;
}
