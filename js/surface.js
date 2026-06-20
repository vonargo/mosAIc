// The live surface = BASE ⊕ overlay.
//
// BASE is the default mosaic you land on; an overlay reshapes it. The render
// path (router, sidebar) reads the surface only through `surface()` / `viewById()`
// so it never sees the base directly — every read is post-merge.

import { STATE, effective } from './state.js';

// A sample overlay the Start composer ships pre-filled with — editing it and
// hitting Apply adds a "Notes" view to the sidebar, proving the surface is live.
const COMPOSER_SAMPLE = `{
  "views": [
    {
      "id": "notes",
      "title": "Notes",
      "layout": "stack",
      "tesserae": [
        { "type": "markdown", "title": "Scratch",
          "body": "Edit this JSON and **Apply** — MosAIc adds a *Notes* view to the sidebar and renders it. This is the exact contract an LLM emits.\\n\\n- rename the view\\n- add a tessera\\n- switch the layout" },
        { "type": "tasks", "title": "Try", "items": [
          { "text": "Rename this view", "done": false },
          { "text": "Add a code tessera", "done": false },
          { "text": "Switch layout to grid", "done": false }
        ] }
      ]
    }
  ]
}`;

export const BASE = {
  title: 'MosAIc',
  views: [
    {
      id: 'start',
      title: 'Start',
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
          body: `Pick a task in the command bar above — watch the **sidebar and the tiles** both reconfigure. Then edit the overlay below and **Apply** to drive it yourself.`,
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
          body: `A **surface** holds **views**; a view lays out **tesserae** — the typed tiles a mosaic is made of.

| piece | is |
| --- | --- |
| surface | the whole mosaic |
| view | one screen / sidebar entry |
| tessera | one typed tile |`,
        },
        {
          type: 'composer', span: 2,
          title: 'Composer — emit an overlay',
          value: COMPOSER_SAMPLE,
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
