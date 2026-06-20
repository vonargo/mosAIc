// The live surface = BASE ⊕ overlay.
//
// BASE is the default mosaic you land on; an overlay reshapes it. The render
// path (router, sidebar) reads the surface only through `surface()` / `viewById()`
// so it never sees the base directly — every read is post-merge.
//
// BASE's one view, "Start Here", is a pure explainer: content only, no controls.
// The controls (the prompt, Composer, …) live in the command bar — see main.js.

import { STATE, effective } from './state.js';

// A compact example of the contract, shown as a code tessera on the landing.
// The editable version lives in the command-bar Composer (js/composer.js).
const OVERLAY_EXAMPLE = `{
  "views": [
    {
      "id": "debug", "title": "Debug", "layout": "split",
      "tesserae": [
        { "type": "code", "title": "Traceback", "body": "IndexError: ..." },
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
      layout: 'grid',
      tesserae: [
        {
          type: 'markdown', span: 2,
          body: `Most AI chat is one scrolling column of text — the same shape whether you're debugging code or planning a trip. **MosAIc lays the answer out instead**: a sidebar and a field of panels that rearrange to fit what you asked.

So the parts that belong together — a traceback, your hypotheses, the fix — sit **side by side** instead of scrolling past each other. The model decides the layout as part of its answer; you don't arrange anything. Same idea, any task.`,
        },
        {
          type: 'note', tone: 'accent', span: 2, title: 'Try it',
          body: `**No sign-in needed to explore** — click the prompt up top, pick an **example**, and watch the whole surface (sidebar and tiles) reshape. Then **sign in** to type your own task: it runs on a model billed to **your** Hugging Face account, your token never leaving the browser. Or open the **Composer** to lay the JSON out by hand.`,
        },
        {
          type: 'diagram', title: 'The mechanism',
          body: `flowchart LR
  base["base surface"] --> eff["effective()"]
  ov["model overlay"] --> eff
  eff --> render["rendered mosaic"]`,
        },
        {
          type: 'markdown', title: 'The pieces',
          body: `A **surface** holds **views**; each view lays out **tiles** — we call them *tesserae*, the typed pieces a mosaic is made of (\`markdown\`, \`code\`, \`table\`, \`diagram\`, \`note\`, \`tasks\`).

| piece | is |
| --- | --- |
| surface | the whole mosaic |
| view | one screen / sidebar entry |
| tessera | one typed tile |`,
        },
        {
          type: 'code', span: 2, lang: 'json', filename: 'the JSON a model emits',
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
