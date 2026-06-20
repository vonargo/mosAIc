// The live surface = BASE ⊕ overlay.
//
// BASE is the default mosaic you land on; an overlay reshapes it. The render
// path (router, sidebar) reads the surface only through `surface()` / `viewById()`
// so it never sees the base directly — every read is post-merge.
//
// BASE's one view, "Start Here", is a pure explainer: content only, no controls.
// The controls (Composer, task chips, …) live in the command bar — see main.js.

import { STATE, effective } from './state.js';

// A compact example of the contract, shown as a code tessera on the landing.
// The editable version lives in the command-bar Composer (js/composer.js).
const OVERLAY_EXAMPLE = `{
  "views": [
    {
      "id": "debug",
      "title": "Debug",
      "layout": "split",
      "tesserae": [
        { "type": "code",     "title": "Traceback", "body": "IndexError: ..." },
        { "type": "tasks",    "title": "Hypotheses",
          "items": [ { "text": "Off-by-one on the last batch" } ] },
        { "type": "markdown", "title": "Fix", "body": "Guard the slice." }
      ]
    }
  ]
}`;

export const BASE = {
  title: 'MosAIc',
  views: [
    {
      id: 'start',
      title: 'Start Here',
      heading: 'MosAIc',
      subtitle: 'a reconfigurable surface for directing an LLM',
      layout: 'split',
      tesserae: [
        {
          type: 'markdown', span: 2,
          body: `Most LLM interfaces are a **scroll** — one linear transcript, no matter the task. MosAIc is a **surface** instead: a sidebar of views and a field of tiles that **reshape to fit the work**.

The model doesn't just answer — it emits a small JSON **overlay** describing the shape it wants, and MosAIc lays it out: which views, which tiles, what layout. Same mechanism, any task.`,
        },
        {
          type: 'note', tone: 'accent', title: 'Try it',
          body: `Pick a task in the command bar — watch the **sidebar and the tiles** both reconfigure. Or open the **Composer** (top bar) to emit your own overlay and drive it yourself.`,
        },
        {
          type: 'diagram', title: 'The mechanism',
          body: `flowchart LR
  base["base surface"] --> eff["effective()"]
  ov["LLM overlay"] --> eff
  eff --> render["rendered mosaic"]`,
        },
        {
          type: 'markdown', span: 2, title: 'The pieces',
          body: `A **surface** holds **views**; a view lays out **tesserae** — the typed tiles a mosaic is made of: \`markdown\`, \`code\`, \`table\`, \`diagram\`, \`note\`, \`tasks\`.

| piece | is |
| --- | --- |
| surface | the whole mosaic |
| view | one screen / sidebar entry |
| tessera | one typed tile |`,
        },
        {
          type: 'code', span: 2, lang: 'json', filename: 'the JSON an LLM emits',
          body: OVERLAY_EXAMPLE,
        },
      ],
    },
  ],
};

export const surface = () => effective(BASE);

export const viewById = (id) => {
  const views = surface().views;
  return views.find(v => v.id === id) || views[0] || null;
};
