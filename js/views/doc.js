import { mdToHtml } from '../utils.js';

const sample = `
A markdown panel. Everything below is rendered by \`mdToHtml\` in \`utils.js\` — the reusable core of the doc surface.

## Why a panel, not a message

A chat message scrolls away. A **panel** persists, holds a place in the layout, and can be reshaped by an overlay — the model can rewrite *this* panel without replaying the whole conversation.

## A table

| piece | role |
| --- | --- |
| \`router\` | hash → view |
| \`state\` | base + overlay merge |
| \`views/\` | swappable panels |

## Some code

\`\`\`
const view = getView(id) || VIEWS[0];
view.render(mount);
\`\`\`

> Swap this view, add your own, or let an overlay reconfigure it. The shape is the product.
`;

export const doc = {
  id: 'doc',
  title: 'Document',
  render(mount) {
    mount.innerHTML = `
      <h1 class="doc-title">Document</h1>
      <p class="doc-sub">an example markdown panel</p>
      <div class="doc">${mdToHtml(sample)}</div>`;
  },
};
