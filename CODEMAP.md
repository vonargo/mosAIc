# MosAIc — code map

*File-by-file orientation. Pairs with `BRIEF.md` (vision) and `SCHEMA.md` (the overlay contract).*

## What's here

A zero-backend static SPA. A fixed shell (`index.html`) — left **sidebar** of views, a sticky **command bar**, a **main** panel — driven by ES modules in `js/`.

Two planes: the **content plane** is the surface — **data**: a *surface* holds *views*, each a layout of *tesserae* (the typed tiles a mosaic is made of). The **control plane** is the command bar — chrome (sidebar toggle · "Direct the surface" + task chips + Composer + Reset · theme toggle). Controls live there so the surface can't reshape its own controls away. An LLM (or the command-bar Composer) emits an **overlay**; `effective(base ⊕ overlay)` is the surface that actually renders. A hash router maps `#id` → a view in the *effective* surface and paints its tesserae into `#view`.

## Files

- `index.html` — shell DOM: `#sidebar`/`#nav`, the `#cmdbar` with its static controls (`#sb-toggle`, lead + `#cmd-tasks`, `#composer-open`, `#cmd-reset`, `#theme-toggle`), `#main`/`#view`; SVG favicon; an inline `<head>` script that seeds `data-theme` pre-paint; loads fonts + `style.css`; boots `js/main.js`.
- `style.css` — theme vars in `:root` (+ a `:root[data-theme="dark"]` palette); flex layout; command bar + controls; Composer drawer; tessera grid + the three layouts (`stack`/`grid`/`split`); per-tile styles; reshape transitions (tile stagger, mark spin, toast); markdown styles.
- `js/state.js` — `STATE { route, overlay, task }` + `effective(base)`, the **base ⊕ overlay** merge (overlay views assigned over base by id, or appended; `remove` drops). Pure leaf, no imports. **The core mechanism.**
- `js/surface.js` — `BASE` (the default surface — the **Start Here** view: a pure explainer, content only) and `surface()` / `viewById(id)`, which read everything *post-merge* through `effective(BASE)`.
- `js/tesserae.js` — `renderTessera(t, i)` + the `RENDERERS` map (markdown, code, table, diagram, note, tasks — content only) + `hydrate()` for interactive tiles (code-copy, tasks). **Add a tile type here: one function + one map entry.**
- `js/composer.js` — the **Composer**: a command-bar driver (not a tessera). Opens a drawer with the overlay JSON editor; Apply/Reset dispatch the same `mosaic:apply` / `mosaic:reset` events the chips use.
- `js/diagram.js` — `renderMermaid(root)` + `retheme()`; lazily/​defensively imports Mermaid from a pinned CDN, picks the theme from `data-theme`, repaints on toggle, degrades to readable source text if it can't load.
- `js/view.js` — `renderView(view, mount)`: heading + a `.tessera-grid` laid out by `view.layout`, then `hydrate` + `renderMermaid`.
- `js/router.js` — `navigate(id)` (sets the hash) + `handleHash()` (resolve id → effective view via `viewById`, render, repaint nav, reset scroll).
- `js/sidebar.js` — `renderNav()` rebuilds `#nav` from `surface().views` (so it reshapes when an overlay adds/drops views).
- `js/demo.js` — `TASKS`: the three canned task overlays (Explain / Debug / Plan) that drive the command-bar chips.
- `js/main.js` — `boot()`; renders the task chips (`renderChips`); wires the persistent controls once (Composer, Reset, sidebar collapse, theme); `applyOverlay()` / `resetOverlay()` set `STATE.overlay` and re-route (sidebar + tiles reshape together); `mosaic:apply` / `mosaic:reset` listeners; toast + reshape flash.
- `js/utils.js` — `escapeHtml`, `slugify`, `mdInline`, `mdToHtml`. Pure leaf.

**Flow:** load → seed `data-theme` → `boot()` → `renderChips` + `renderNav()` → `handleHash()` resolves the hash against `effective(BASE)` → `renderView()` tiles the tesserae → a chip or the Composer calls `applyOverlay()` → sets `STATE.overlay`, re-routes → sidebar + tiles reshape. Controls in the command bar are unaffected.

## Extension points

- **Add a tile type:** write `RENDERERS.foo(t)` in `js/tesserae.js` (return an HTML string), add `foo` to the map. Wire any interactivity in `hydrate()`. Reference it as `{ "type": "foo", … }` in an overlay.
- **Add a task:** push `{ id, label, overlay }` to `TASKS` in `js/demo.js`; it appears as a command-bar chip.
- **Add a control:** it's chrome — add it to `#cmdbar` in `index.html` and wire it once in `boot()`; don't make it a tessera (the surface would be able to reshape it away).
- **The contract:** `SCHEMA.md`. The whole render path reads `effective()`, so the schema *is* the surface.

## Known rough edges

- `mdToHtml` list depth assumes 2-space indent; 4-space/tabs misbehave. Headings render as `.md-h` divs (h2–h6), not real heading tags.
- Diagram tiles need the Mermaid CDN to draw; offline they show their source text (by design — the app still runs).
- The `router` ↔ `sidebar` import cycle is safe (both imported symbols are functions called only at runtime).
- Only external dependencies are Google Fonts and the Mermaid CDN, both with graceful fallback.

## Runs?

Yes — valid ES-module graph, no console errors. Opening `index.html` (or `python3 -m http.server`) shows the shell and lands on **Start Here** (the explainer); the user drives the first reshape from a task chip or the Composer. Verified end-to-end in a browser: all tile types, all three layouts, the command-bar controls (sidebar collapse/expand, Composer drawer, Reset, theme toggle), and light/dark.
