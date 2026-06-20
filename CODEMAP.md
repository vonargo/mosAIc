# MosAIc — code map

*File-by-file orientation. Pairs with `BRIEF.md` (vision) and `SCHEMA.md` (the overlay contract).*

## What's here

A zero-backend static SPA. A fixed shell (`index.html`) — left **sidebar** of views, a sticky **command bar**, a **main** panel — driven by ES modules in `js/`. The surface is **data**: a *surface* holds *views*, each a layout of *tesserae* (the typed tiles a mosaic is made of). An LLM (or the in-app Composer) emits an **overlay**; `effective(base ⊕ overlay)` is the surface that actually renders. A hash router maps `#id` → a view in the *effective* surface and paints its tesserae into `#view`.

## Files

- `index.html` — shell DOM (`#sidebar`/`#nav`, `#cmdbar`, `#main`/`#view`); SVG favicon; loads fonts + `style.css`; boots `js/main.js`.
- `style.css` — theme vars in `:root`; flex layout; command bar; tessera grid + the three layouts (`stack`/`grid`/`split`); per-tile styles; reshape transitions (tile stagger, mark spin, toast); markdown styles.
- `js/state.js` — `STATE { route, overlay, task }` + `effective(base)`, the **base ⊕ overlay** merge (overlay views assigned over base by id, or appended; `remove` drops). Pure leaf, no imports. **The core mechanism.**
- `js/surface.js` — `BASE` (the default surface — the Start view: pitch + a live Composer) and `surface()` / `viewById(id)`, which read everything *post-merge* through `effective(BASE)`.
- `js/tesserae.js` — `renderTessera(t, i)` + the `RENDERERS` map (markdown, code, table, diagram, note, tasks, composer) + `hydrate()` for interactive tiles. **Add a tile type here: one function + one map entry.**
- `js/diagram.js` — `renderMermaid(root)`; lazily/​defensively imports Mermaid from a CDN, degrades to readable source text if it can't load (keeps an offline `index.html` open working).
- `js/view.js` — `renderView(view, mount)`: heading + a `.tessera-grid` laid out by `view.layout`, then `hydrate` + `renderMermaid`.
- `js/router.js` — `navigate(id)` (sets the hash) + `handleHash()` (resolve id → effective view via `viewById`, render, repaint nav, reset scroll).
- `js/sidebar.js` — `renderNav()` rebuilds `#nav` from `surface().views` (so it reshapes when an overlay adds/drops views).
- `js/demo.js` — `TASKS`: the three canned task overlays (Explain / Debug / Plan) that drive the command bar.
- `js/main.js` — `boot()`; renders the command bar; `applyOverlay()` / `resetOverlay()` set `STATE.overlay` and re-route (sidebar + tiles reshape together); a one-time auto-demo; `mosaic:apply` / `mosaic:reset` events from the Composer; toast + reshape flash; sidebar collapse (persisted).
- `js/utils.js` — `escapeHtml`, `slugify`, `mdInline`, `mdToHtml`. Pure leaf.

**Flow:** load → `boot()` → command bar + `renderNav()` → `handleHash()` resolves the hash against `effective(BASE)` → `renderView()` tiles the tesserae → a chip/Composer calls `applyOverlay()` → sets `STATE.overlay`, re-routes → sidebar + tiles reshape.

## Extension points

- **Add a tile type:** write `RENDERERS.foo(t)` in `js/tesserae.js` (return an HTML string), add `foo` to the map. Wire any interactivity in `hydrate()`. Reference it as `{ "type": "foo", … }` in an overlay.
- **Add a task:** push `{ id, label, overlay }` to `TASKS` in `js/demo.js`; it appears in the command bar.
- **The contract:** `SCHEMA.md`. The whole render path reads `effective()`, so the schema *is* the surface.

## Known rough edges

- `mdToHtml` list depth assumes 2-space indent; 4-space/tabs misbehave. Headings render as `.md-h` divs (h2–h6), not real heading tags.
- Diagram tiles need the Mermaid CDN to draw; offline they show their source text (by design — the app still runs).
- The `router` ↔ `sidebar` import cycle is safe (both imported symbols are functions called only at runtime).
- Only external dependencies are Google Fonts and the Mermaid CDN, both with graceful fallback.

## Runs?

Yes — valid ES-module graph, no console errors. Opening `index.html` (or `python3 -m http.server`) shows the shell, renders Start, auto-reshapes once to demonstrate, and reconfigures sidebar + tiles on every task/overlay. Verified end-to-end in a browser: all tile types, all three layouts, the command bar, the auto-demo, and the live Composer.
