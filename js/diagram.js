// Diagram tiles, rendered with Mermaid loaded lazily from a CDN.
//
// The import is dynamic and guarded: if the CDN is unreachable (offline open),
// it fails softly and the diagram degrades to its readable source text rather
// than taking the app down. That keeps a static, no-network open of index.html
// working — just without rendered graphs.

let mermaid = null;
let tried = false;

async function ensure() {
  if (mermaid || tried) return mermaid;
  tried = true;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
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
