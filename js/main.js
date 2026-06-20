import { renderSidebar } from './sidebar.js';
import { handleHash } from './router.js';

function boot() {
  renderSidebar();
  handleHash();
  window.addEventListener('hashchange', handleHash);

  const app = document.getElementById('app');
  if (localStorage.getItem('mosaic-sb-collapsed') === '1') app.classList.add('sb-collapsed');
  document.getElementById('sb-toggle').addEventListener('click', () => {
    app.classList.toggle('sb-collapsed');
    localStorage.setItem('mosaic-sb-collapsed', app.classList.contains('sb-collapsed') ? '1' : '0');
  });
}

boot();
