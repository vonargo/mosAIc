---
title: MosAIc
emoji: 🎨
colorFrom: indigo
colorTo: gray
sdk: static
pinned: false
license: mit
---

# MosAIc

A **reconfigurable HTML surface for directing an LLM** — an alternative to the linear chat transcript.

Instead of scrolling a conversation, you work in a structured, persistent surface: a sidebar of views and a main panel area that **reshapes to fit the task**. The model emits a structure; the surface renders it. Bring your own LLM — MosAIc is the surface, not the model.

## Run it

It's a static site — no backend.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

or just open `index.html`.

## Shape

- `index.html` + `style.css` — the shell and aesthetic
- `js/` — a tiny hash router, a `STATE` store with a base + overlay merge (the reconfiguration mechanism), a sidebar rendered from a view registry, and a markdown↔HTML renderer
- `js/views/` — swappable view modules; add your own

See `BRIEF.md` for the design and the build plan.

## License

MIT.
