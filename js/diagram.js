// Diagram tiles, rendered with Mermaid loaded lazily from a CDN.
//
// The import is dynamic and guarded: if the CDN is unreachable (offline open),
// it fails softly and the diagram degrades to its readable source text rather
// than taking the app down. That keeps a static, no-network open of index.html
// working — just without rendered graphs.

// Pinned to an exact version on purpose. A floating major (mermaid@11) lets a
// minor/patch release silently change — or break — diagram rendering. Bump this
// deliberately, then re-test. Verify the URL 200s before changing it.
const MERMAID_VERSION = '11.15.0';
const MERMAID_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;

let mermaid = null;
let tried = false;

async function ensure() {
  if (mermaid || tried) return mermaid;
  tried = true;
  try {
    const mod = await import(MERMAID_URL);
    mermaid = mod.default;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
    });
  } catch (_) {
    mermaid = null;   // leave the source text in place as the fallback
  }
  return mermaid;
}

export async function renderMermaid(root) {
  const nodes = [...root.querySelectorAll('.mermaid:not([data-mm])')];
  if (!nodes.length) return;
  nodes.forEach(n => { n.dataset.mm = '1'; });

  const mm = await ensure();
  if (!mm) { nodes.forEach(n => n.classList.add('mermaid-fallback')); return; }

  try {
    await mm.run({ nodes });
  } catch (_) {
    nodes.forEach(n => n.classList.add('mermaid-fallback'));
  }
}
