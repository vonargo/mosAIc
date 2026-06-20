# MosAIc — code map

*Orientation for building on the staged skeleton. Pairs with `BRIEF.md` (vision + scope).*

## What's here

A zero-backend static SPA: a fixed shell (`index.html`) with a left sidebar of views and a main panel, driven by ES modules in `js/`. A hash router maps `#id` → a view from a data-driven registry; each view is `{ id, title, render(mount) }` and paints HTML into `#view`. `js/utils.js` has a dependency-free markdown→HTML renderer the views use. `js/state.js` holds `STATE` plus the `base + overlay` merge (`effective()`) — the reconfiguration hook (see BRIEF, "the reconfigurable idea").

## Files

- `index.html` — shell DOM (`#sidebar` with `#nav`, `#main` with `#view`); loads fonts + `style.css`; bootstraps via `js/main.js`.
- `style.css` — theme vars in `:root`; flex layout; sidebar collapse via `#app.sb-collapsed`; markdown styles (`.md-h*`, `.md-table`, `.md-quote`, `.code-block pre`).
- `js/main.js` — `boot()`: render sidebar, route, wire `hashchange` + the sidebar toggle (persisted in `localStorage['mosaic-sb-collapsed']`).
- `js/router.js` — `navigate(id)` (sets the hash) + `handleHash()` (resolve id→view, render into `#view`, repaint nav, reset scroll).
- `js/state.js` — `STATE { route, overlay }` + `effective(base)` = `{...base, ...overlay[base.id]}`. Leaf module.
- `js/sidebar.js` — `renderNav()` rebuilds `#nav` from `VIEWS`, marks the active item, wires click → `navigate`.
- `js/utils.js` — `escapeHtml`, `slugify`, `mdToHtml` (fenced code incl. a `mermaid` case, tables, h2–h6, rules, blockquotes, nested lists, inline emphasis/code/links). Leaf module.
- `js/views/index.js` — `VIEWS` registry + `getView(id)`. **Register new views here.**
- `js/views/{welcome,doc}.js` — the two example views.

**Flow:** load → `boot()` → `renderNav()` fills the sidebar → `handleHash()` resolves the hash (default = first view) → `view.render(#view)` → nav clicks set the hash → `hashchange` re-renders.

## Extension points

- **Add a view:** create `js/views/foo.js` exporting `{ id, title, render(mount) }`, then add it to `VIEWS` in `js/views/index.js`. It auto-appears in the sidebar and routes at `#foo`. Use `mdToHtml` for content.
- **The reconfiguration hook:** `STATE.overlay` + `effective(base)` in `js/state.js`. Today it is **inert** — defined but not yet on the render path. The build (BRIEF tasks 1–2) defines the overlay schema and routes view resolution through `effective()` so an overlay merges over a base before render. Generalize the shallow `{...base, ...ov}` into a multi-panel layout.

## Known rough edges (fine for a skeleton — know them before building)

- `effective()` / `STATE.overlay` have no call sites yet — a staged hook, not live.
- `mdToHtml` list depth assumes 2-space indent; 4-space/tabs misbehave. The fenced-code placeholder is whitespace-sensitive. Headings are h2–h6 (views render their own `<h1 class="doc-title">`).
- `renderSidebar()` is a thin wrapper that just calls `renderNav()` — one job, two names.
- Only external dependency is Google Fonts (graceful fallback offline).

## Runs?

Yes. Valid ES-module import graph; the `router`↔`sidebar` circular import is safe (both imported symbols are functions called only at runtime, after both modules finish evaluating). Opening `index.html` (or `python3 -m http.server`) shows the sidebar + two views, renders Welcome by default, routes on click, and persists the sidebar-collapse — no console errors.
