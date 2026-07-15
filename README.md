---
title: MosAIc
emoji: 🎨
colorFrom: indigo
colorTo: gray
sdk: static
pinned: true
license: mit
short_description: "Reconfigurable LLM surface that reshapes per task"
tags:
  - llm
  - inference-providers
  - oauth
  - ui
  - coauthoring
  - agent
  - okf
hf_oauth: true
hf_oauth_scopes:
  - inference-api
---

# MosAIc

**A reconfigurable surface for directing an LLM — the panels reshape per task, instead of a linear chat transcript.**

> **⚠️  Authenticity notice.** The only official home of MosAIc is
> **https://github.com/vonargo/mosAIc**. MosAIc is distributed as **source
> only — there are no official binary or installer downloads.** Lookalike
> sites (including typosquatted domains that proxy this repo's pages, e.g.
> "ithub"-style Fastly mirrors) have distributed **malware** under this
> project's name via fake "release" downloads. If you see a "Loader",
> installer, or password-protected archive claiming to be MosAIc, it is not
> ours — do not run it. Get the code only by cloning this repository.

Most LLM interfaces are a scroll: one conversation, no matter the work. MosAIc is a *surface* instead — a sidebar of views and a field of typed tiles. The model emits a small JSON **overlay** describing the shape it wants; MosAIc lays it out. Keep asking and the surface **evolves** — each task patches the current one instead of starting over. Same mechanism, any task.

It's **bring-your-own-LLM**: sign in with Hugging Face, type a task, and it's sent to a model on [Inference Providers](https://huggingface.co/docs/inference-providers) billed to **your own account** — no shared key, and no *MosAIc* backend. MosAIc is the surface, not the model.

> **What leaves your browser:** "no backend" means no MosAIc server — *not* local-only. The model path sends your **typed task, and any OKF bundle you've loaded**, to a third-party inference provider (`provider:"auto"`). The examples and the Composer run fully in the browser; the typed/model path does not.

![MosAIc reshaping into a codebase-overview surface](screenshot.png)

## Try it

It's a static site — no backend, no build step.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

or just open `index.html`.

Three ways to drive it, all from the command bar:

- **Type a task** (signed in) → a model emits an overlay and the whole shell — sidebar *and* tiles — reshapes, on your own HF credits.
- **An example** (`Explain a codebase`, `Debug an error`, `Plan a feature`, `Plan a trip`, or **Open a sample OKF bundle**) → applies a canned overlay instantly, no sign-in.
- **The Composer** → paste/edit overlay JSON and **Apply** it by hand.

The typed/model path needs the OAuth app that the deployed Space provides; running locally, the **examples and Composer** still work, so you can explore the surface with no sign-in. To deploy your own and light up the model path, see **[DEPLOY.md](DEPLOY.md)**.

## How it reshapes

The mechanism is **base + overlay**. A base surface plus an overlay a model emits, merged by view id: `effective(base) = base ⊕ overlay`. The render path reads only from `effective()`, so one overlay reshapes everything. A small validator (`js/overlay.js`) checks every overlay first, so a bad emit degrades to a message instead of breaking the surface.

A **surface** holds **views**; a view lays out **tesserae** — the typed content tiles a mosaic is made of (markdown, code, table, diagram, note, tasks). Controls (the prompt, examples, Composer, theme, sidebar toggle) live in the command bar — chrome the surface can't reshape away. The overlay contract is small and documented in **[SCHEMA.md](SCHEMA.md)** — the target a model writes to.

## 2.0 — the subject surface

The sidebar now carries a **subject rail**: for whatever view you're on, everything else on the surface — other views and any loaded OKF concepts — is listed **ranked by relatedness, strongest on top**, each row a click-through with a strength bar. It's the mind map, realized as a list. The ranking is computed **in your browser** (instant, zero tokens, works signed-out); the rail shows which scorer ranked it. As of 2.1 the scorer is **field-weighted lexical with IDF**: title and tag matches outrank body matches, rare discriminative terms outrank ubiquitous ones, and the tokenizer is Unicode-aware (acronyms, Cyrillic, and compound tokens like `node.js` all score). The scorer design owes a debt to John6666's survey in [the announcement thread](https://discuss.huggingface.co/t/177021) — as does the principle the whole rail runs on: *model proposes, host disposes*.

Signed in, a **✦ rerank** button asks the model to re-score the same rows — one small call, and nothing is sent until you click. Rerank sends the current view's title and each candidate's title plus a ≤200-character snippet to the model on your Hugging Face account — the same data flow as typing a task. The model can only *re-score* the rows the rail already computed; it can never add, remove, or retitle one.

The tiles got hands, too: **drag a tile** to rearrange a view, **drag a tile's corner** to resize it across columns (a click on the corner toggles wide/narrow) — both persist across reloads — and views with four or more tiles get a **pinned table of contents** that scrolls to a tile on click.

## Open a knowledge base (OKF)

MosAIc also reads **[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)** — Google Cloud's portable "LLM-wiki" spec: a folder of markdown files with YAML frontmatter. Click **▣ OKF** in the command bar to open a bundle (a folder), or pick **"Open a sample OKF bundle"** from the examples — no sign-in. (Opening your own folder uses the directory picker, which Safari doesn't support — use Chrome or Firefox, or the sample bundle.)

Where the reference viewer draws a force-directed graph, MosAIc renders an OKF bundle as a **calm reading surface**: one view per concept `type`, each concept a card, cross-links that navigate in place, and — because OKF's frontmatter has no trust field — a **provenance strip** that surfaces what each concept *does* carry (a source link, a freshness date, citations) and flags what it doesn't (`sourced` vs `unsourced`). The parser + adapter are pure and tested (`js/okf.js`); build notes in [OKF-VIEWER-BRIEF.md](OKF-VIEWER-BRIEF.md).

## Shape

- `index.html` + `style.css` — the shell, command bar, and aesthetic (Syne + IBM Plex)
- `js/state.js` — `STATE` + `effective(base)`, the base ⊕ overlay merge
- `js/surface.js` — the base surface; `js/demo.js` — the task overlays
- `js/tesserae.js` — one renderer per content tile (adding a type is one function)
- `js/composer.js` — the Composer drawer (a command-bar driver)
- `js/llm.js` — the typed/model path: HF OAuth (viewer token) + Inference Providers
- `js/overlay.js` — validates a model/Composer overlay before it's applied
- `js/okf.js` + `js/okf-load.js` — open a Google **OKF** knowledge bundle and render it as a reading surface
- `js/view.js`, `js/router.js`, `js/sidebar.js` — the render path
- `js/diagram.js` — diagram tiles via Mermaid (loaded lazily, degrades to source text offline)

See **[CODEMAP.md](CODEMAP.md)** for the file-by-file orientation, **[SCHEMA.md](SCHEMA.md)** for the overlay contract, **[ROADMAP.md](ROADMAP.md)** for what's next, and **[VISION.md](VISION.md)** for the north star (where this is ultimately headed). Pure-core tests run with `node --test`.

## License

MIT.
