// Diagram tiles, rendered with Mermaid loaded lazily from a CDN.
//
// The import is dynamic and guarded: if the CDN is unreachable (offline open),
// it fails softly and the diagram degrades to its readable source text rather
// than taking the app down. That keeps a static, no-network open of index.html
// working — just without rendered graphs.
//
// Mermaid's theme follows MosAIc's: the page's data-theme picks 'dark' vs
// 'neutral' at init, and retheme() repaints every diagram when the user flips
// the toggle — a rendered SVG is otherwise frozen at its original theme.

// Pinned to an exact version on purpose. A floating major (mermaid@11) lets a
// minor/patch release silently change — or break — diagram rendering. Bump this
// deliberately, then re-test. Verify the URL 200s before changing it.
const MERMAID_VERSION = '11.15.0';
const MERMAID_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;

let mermaid = null;
let tried = false;
let theme = null;   // the mermaid theme currently initialized

const wantTheme = () =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'neutral';

function init(mm, t) {
  mm.initialize({
    startOnLoad: false,
    theme: t,
    securityLevel: 'loose',
    fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
  });
  theme = t;
}

async function ensure() {
  if (mermaid || tried) return mermaid;
  tried = true;
  try {
    const mod = await import(MERMAID_URL);
    mermaid = mod.default;
    init(mermaid, wantTheme());
  } catch (_) {
    mermaid = null;   // leave the source text in place as the fallback
  }
  return mermaid;
}

export async function renderMermaid(root) {
  const nodes = [...root.querySelectorAll('.mermaid:not([data-mm])')];
  if (!nodes.length) return;

  const mm = await ensure();
  nodes.forEach(n => {
    if (n.dataset.src == null) n.dataset.src = n.textContent;   // keep source for re-theming
    n.dataset.mm = '1';
  });
  if (!mm) { nodes.forEach(n => n.classList.add('mermaid-fallback')); return; }

  try {
    await mm.run({ nodes });
  } catch (_) {
    nodes.forEach(n => n.classList.add('mermaid-fallback'));
  }
}

// Repaint every diagram in the current theme. A rendered SVG is frozen, so we
// restore each diagram's source, drop the processed flags, and re-run.
export async function retheme() {
  const mm = await ensure();
  if (!mm || wantTheme() === theme) return;
  init(mm, wantTheme());
  document.querySelectorAll('.mermaid[data-src]').forEach(n => {
    n.innerHTML = '';
    n.textContent = n.dataset.src;
    n.removeAttribute('data-processed');
    n.classList.remove('mermaid-fallback');
    delete n.dataset.mm;
  });
  await renderMermaid(document);
}
