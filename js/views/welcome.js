import { mdToHtml } from '../utils.js';

const md = `
A reconfigurable surface for directing an LLM — the shape reshapes to fit the task, instead of a linear chat log.

## How it works

- The **sidebar** lists views; the **main area** renders the active one.
- A central \`STATE\` store holds a **base + overlay**: a base structure plus an overlay that reshapes it. That overlay is what an LLM emits to reconfigure the surface.
- Views are small swappable modules in \`js/views/\`. Add one, register it in \`views/index.js\`, and it appears here.

## Next

This is the staged shell. See \`BRIEF.md\` for the build plan — the overlay schema, the render path, and the real panel types.
`;

export const welcome = {
  id: 'welcome',
  title: 'Welcome',
  render(mount) {
    mount.innerHTML = `
      <h1 class="doc-title">MosAIc</h1>
      <p class="doc-sub">a reconfigurable surface for directing an LLM</p>
      <div class="doc">${mdToHtml(md)}</div>`;
  },
};
