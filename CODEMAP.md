# MosAIc — code map

*File-by-file orientation. Pairs with `VISION.md` (the north star), `SCHEMA.md` (the overlay contract), `ROADMAP.md` (what's next + the wire-format thinking), and `BRIEF.md` (the original build brief). Pure-core tests: `node --test`.*

## What's here

A zero-backend static SPA. A fixed shell (`index.html`) — left **sidebar** of views, a sticky **command bar**, a **main** panel — driven by ES modules in `js/`.

Two planes. The **content plane** is the surface — **data**: a *surface* holds *views*, each a layout of *tesserae* (the typed tiles a mosaic is made of). The **control plane** is the command bar — chrome (sidebar toggle · prompt + example suggestions · Composer · Reset · account/sign-in · theme). Controls live there so the surface can't reshape its own controls away.

A **model** emits an **overlay** (signed in, the prompt sends a typed task to HF Inference Providers billed to the viewer); the Composer and the example suggestions emit the same shape by hand / from canned data. `effective(base ⊕ overlay)` is the surface that actually renders. A hash router maps `#id` → a view in the *effective* surface and paints its tesserae into `#view`.

## Files

- `index.html` — shell DOM: `#sidebar`/`#nav`; the `#cmdbar` with its static controls (`#sb-toggle`, `.cmd-mark`, the `#cmd-form`/`#cmd-prompt` prompt + `#cmd-suggest`, `#composer-open`, `#cmd-reset`, `#cmd-account`, `#theme-toggle`); `#main`/`#view`; SVG favicon; an inline `<head>` script that seeds `data-theme` pre-paint; loads fonts + `style.css`; boots `js/main.js`.
- `style.css` — theme vars in `:root` (+ a `:root[data-theme="dark"]` palette); flex layout; command bar (prompt, suggestions, account); Composer drawer; tessera grid + the three layouts (`stack`/`grid`/`split`); per-tile styles; reshape transitions (tile stagger, mark spin, toast); markdown styles.
- `js/state.js` — `STATE { route, overlay, task }` + `effective(base)`, the **base ⊕ overlay** merge (overlay views assigned over base by id, or appended; `remove` drops), and `composeOverlay(acc, patch)` — folds a model patch into the accumulated overlay by the same rules, so successive tasks **evolve** the surface instead of regenerating. Pure leaf, no imports. **The core mechanism.**
- `js/surface.js` — `BASE` (the default surface — the **Start Here** view: a pure explainer, content only) and `surface()` / `viewById(id)`, which read everything *post-merge* through `effective(BASE)`.
- `js/tesserae.js` — `renderTessera(t, i)` + the `RENDERERS` map (markdown, code, table, diagram, note, tasks — content only) + `hydrate()` for interactive tiles (code-copy, tasks). **Add a tile type here: one function + one map entry.**
- `js/overlay.js` — `validateOverlay(input)`: normalizes + guards an overlay (from the model or the Composer) before it reshapes the surface, so a bad emit degrades to a message instead of breaking the render path.
- `js/llm.js` — the typed/model path: HF OAuth (`oauthLoginUrl` / `oauthHandleRedirectIfPresent`, viewer token) + Inference Providers (`InferenceClient.chatCompletion`), called from the browser so inference bills to the viewer. `generateOverlay(task, current)` uses `SCHEMA.md` as the system prompt and the `demo.js` overlays as few-shot, with guided JSON + a corrective retry; when a current surface is passed it instructs **patch-mode** (modify/extend the surface, not regenerate it). HF libs load lazily from a pinned CDN and fail soft.
- `js/composer.js` — the **Composer**: a command-bar driver (not a tessera). Opens a drawer with the overlay JSON editor; Apply (validated) / Reset dispatch the same `mosaic:apply` / `mosaic:reset` events the prompt uses.
- `js/demo.js` — `TASKS`: four canned overlays (Explain / Debug / Plan a feature / Plan a trip) that feed both the example suggestions and `generateOverlay`'s few-shot.
- `js/diagram.js` — `renderMermaid(root)` + `retheme()`; lazily/​defensively imports Mermaid from a pinned CDN, picks the theme from `data-theme`, repaints on toggle, degrades to readable source text if it can't load.
- `js/view.js` — `renderView(view, mount)`: heading + a `.tessera-grid` laid out by `view.layout`, then `hydrate` + `renderMermaid`.
- `js/router.js` — `navigate(id)` (sets the hash) + `handleHash()` (resolve id → effective view via `viewById`, render, repaint nav, reset scroll).
- `js/sidebar.js` — `renderNav()` rebuilds `#nav` from `surface().views` (so it reshapes when an overlay adds/drops views).
- `js/main.js` — `boot()`; `renderSuggestions()` (the no-login examples dropdown); the prompt (`submitPrompt` → signed in: `runTask` → `generateOverlay`; signed out: stash + `signIn`); `renderAccount` + `initAuth` (auth state); `applyOverlay` / `resetOverlay` (re-route, sidebar + tiles reshape); a defensive `validateOverlay` on the `mosaic:apply` listener; sidebar collapse, theme; toast + reshape flash.
- `js/utils.js` — `escapeHtml`, `slugify`, `mdInline`, `mdToHtml`. Pure leaf.

**Flow:** load → seed `data-theme` → `boot()` → `renderSuggestions` + `renderNav` + `initAuth` → `handleHash()` resolves the hash against `effective(BASE)` → `renderView()` tiles the tesserae. Driving it: a typed task (signed in) → `generateOverlay` patches the current surface → `composeOverlay` folds it in (the mosaic evolves) → `mosaic:apply`; an example → `applyOverlay`; the Composer → validate → `mosaic:apply`. Each sets `STATE.overlay` and re-routes; the command-bar controls are unaffected.

## Extension points

- **Add a tile type:** write `RENDERERS.foo(t)` in `js/tesserae.js` (return an HTML string), add `foo` to the map; allow it in `TYPES` in `js/overlay.js`. Wire any interactivity in `hydrate()`. Reference it as `{ "type": "foo", … }` in an overlay.
- **Add an example:** push `{ id, label, hint, overlay }` to `TASKS` in `js/demo.js`; it appears in the prompt's example suggestions *and* becomes a few-shot for the model.
- **Add a control:** it's chrome — add it to `#cmdbar` in `index.html` and wire it once in `boot()`; don't make it a tessera (the surface would be able to reshape it away).
- **Swap the model:** the `MODEL` constant in `js/llm.js` (`provider: "auto"` routes to whoever serves it).
- **The contract:** `SCHEMA.md`. The whole render path reads `effective()`, so the schema *is* the surface.

## Known rough edges

- `mdToHtml` list depth assumes 2-space indent; 4-space/tabs misbehave. Headings render as `.md-h` divs (h2–h6), not real heading tags.
- Diagram tiles need the Mermaid CDN to draw; offline they show their source text (by design — the app still runs).
- The typed/model path needs the OAuth app the deployed Space provisions (`window.huggingface.variables`); running locally, `oauthAvailable()` is false, so sign-in/typed tasks are disabled — the examples and Composer still work.
- The `router` ↔ `sidebar` import cycle is safe (both imported symbols are functions called only at runtime).
- External dependencies are Google Fonts, the Mermaid CDN, and (only on the model path) `@huggingface/hub` + `@huggingface/inference` from a pinned CDN — all with graceful fallback.

## Runs?

Yes — valid ES-module graph, no console errors. Opening `index.html` (or `python3 -m http.server`) shows the shell and lands on **Start Here** (the explainer) and stays. A signed-out visitor drives the first reshape from an example suggestion or the Composer; on the deployed Space, a signed-in visitor types a task and a model emits the overlay. Verified end-to-end in a browser (signed-out): the prompt + suggestions, instant example apply, Composer with validation (a bad overlay degrades to an inline error), sidebar collapse/expand, Reset, light/dark, all tile types and the three layouts.
