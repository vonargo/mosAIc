# MosAIc — build brief

*For the session that builds this out. Read this first, then `CODEMAP.md` for the code orientation.*

## What MosAIc is

MosAIc is a **reconfigurable HTML interface for directing an LLM** — an alternative to the linear chat transcript. Instead of scrolling a conversation, you work in a structured, persistent surface: a sidebar of views + a main panel area. The LLM can **reshape the layout and content to fit the task** — emit a structure, the surface renders it.

The **shape is the product**: sidebar + swappable views + a config that drives the layout + clean markdown rendering. It's **bring-your-own-LLM** — MosAIc ships *no* model; it's the surface you wire one into.

Longer arc (not this build, but design with it in mind): a reconfigurable "artifact layer" that coding agents and assistants can drive and reshape per task — eventually a plugin. Right now: ship a clean, usable shell as a HuggingFace **Static Space**.

## One hard rule

MosAIc is **public and self-contained**. Keep it that way: no private data, no external service baked in, nothing that has to ship from outside this repo. Everything here stands on its own — build straight from this brief.

## Scope — ship the shell (option C)

- **SHIP:** the shell (sidebar + main), hash router → swappable view modules, a central `STATE` store with a **base + overlay merge** (the reconfiguration mechanism), markdown↔HTML rendering, the aesthetic.
- **DO NOT ship a built-in model call.** MosAIc is bring-your-own-LLM. A later version can add a thin, *provider-agnostic* model proxy (OpenAI-compatible) — out of scope for the first publish.
- **Target:** a HuggingFace **Static Space** (pure HTML/CSS/JS, no backend, runs by opening `index.html`).

## The reconfigurable idea (the heart of it)

The shape's power is **`base + overlay`**: a base structure (panels/views) plus an overlay that reshapes it — `effective(base) = base ⊕ overlay` (see `js/state.js`). An LLM emits an **overlay** (which panels, what content, what layout) → MosAIc applies it → the surface reconfigures. The skeleton ships the static version; the build adds:
1. a **layout/overlay schema** an LLM can target (the contract), and
2. the **render path** that applies an overlay to the panel set.

*(Keep the overlay schema a small, documented JSON contract — the simpler the LLM's target, the more reliable the reconfiguration.)*

## What's staged (clean, runs as-is)

```
index.html            shell: sidebar + main, loads js/main.js
style.css             the aesthetic (Syne + IBM Plex, lean/calm)
js/main.js            boot: render sidebar, route, wire events
js/router.js          hash router → view dispatch (data-driven registry)
js/state.js           STATE store + base/overlay merge hook
js/sidebar.js         nav rendered from the view registry
js/utils.js           escapeHtml, slugify, mdToHtml  ← reusable, generic
js/views/index.js     the view registry (add views here)
js/views/welcome.js   example view
js/views/doc.js        example markdown-doc view (the doc surface)
README.md             HF Static Space front-matter + blurb
CODEMAP.md            file-by-file orientation + rough edges
```

Open `index.html` (or `python3 -m http.server`) and it runs: sidebar, routing, two views, markdown rendering, the look.

## Build tasks (rough order)

1. **Overlay schema** — define the JSON an LLM emits to reconfigure the surface (panels, layout, content). This is the core IP; get it clean.
2. **Render path** — apply an overlay → panel set. Make adding a panel type trivial.
3. **Real panel types** — replace the example views with the useful ones: markdown doc, code block, table, diagram (mermaid is easy to vendor), maybe a task/checklist panel.
4. **(Optional, likely v2)** a provider-agnostic LLM demo — OpenAI-compatible, key entered client-side or via a Space secret. Keep it optional so the shell stands alone.
5. **Package as a Static Space** — `README.md` front-matter (`sdk: static`), license, a screenshot or two, a short "what is this."
6. **Polish** — responsive, keyboard nav, localStorage persistence (sidebar collapse is already wired).

## Keep it minimal

The shape is the value. Resist bloat — a small, sharp, obviously-useful shell beats a feature pile. Earn each addition.

## Name

**MosAIc** — *mosaic* (a surface of rearrangeable tiles) with the AI infix, and a quiet nod to NCSA **Mosaic**, the first graphical web browser. For now it's just the name — no logo/brand system until it earns a second use.

*(Open: license — default MIT unless told otherwise.)*
