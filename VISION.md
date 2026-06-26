# MosAIc — vision

*The north star, not a backlog. The shipped thing is deliberately tiny (see [CODEMAP.md](CODEMAP.md)); this is the bet behind it. It's a scaffold — reshape the voice and the claims in your own words.*

## The bet

LLM interfaces are still a **scroll** — a transcript where the actual artifact (the explanation, the plan, the code walk-through) is buried in chat history. MosAIc bets the artifact *is* the interface: the model builds and reshapes a **persistent, structured surface**, and the human and the model **co-edit** it. The conversation produces a living workspace, not a log.

## Why it's a *control surface*, not just an app

The whole surface is driven by one small, validated contract — the **overlay schema**. That's the seam, and it's the point: it decouples *who decides the layout* from *what renders it*. Today an in-browser model emits overlays; the same contract can be driven later by a coding agent, an IDE, a backend, or a swarm of agents, over any transport.

So MosAIc is less "AI that builds a page" and more **a render target for LLM output**. The bet: an open, minimal, forkable *protocol* for LLM-built surfaces is worth more than any one feature — and the overlay schema *could become* to LLM output what HTML is to a browser. That's the aspiration, not the status: today it's one in-browser emitter and one renderer.

## Honest positioning

This is adjacent to Notion / SharePoint / Copilot Pages — Microsoft already ships "AI co-creates you a page," so the category is real and the giants are in it. The bet is therefore **not** to out-feature them. It's the opposite of their model: **open, minimal, self-hostable, bring-your-own-model, bring-your-own-credits, forkable, schema-first.** Be the open seam everyone can build on, not another closed surface.

## Coauthoring

Human and model both emit overlays — the model from a prompt, the human from the Composer (or, later, by editing tiles directly). The surface becomes **shared working memory**: a persistent, structured place where a person and one or more agents think together, instead of trading turns in a transcript.

## What it unlocks (later — the *fancy* stuff)

- **Code explainer** — an interactive annotated walk-through: code + a linked diagram + step navigation.
- **Live tiles** — runnable code, charts that update, embedded tool output: tiles that *do*, not just show.
- **Two-way tiles** — forms, checklists, sliders the model reads back: the coauthoring loop closed.
- **Agent workbench** — a long-running agent updates the surface as it works: the plan fills in, tool results land as tiles.
- **A tile plugin API** — third parties register new tile types; the surface extends without forking the core.
- **Transports** — drive the same schema over postMessage / WebSocket / MCP from an IDE or agent, not only the in-browser model.

---

*None of this is now. The shape is the value; the surface stays small until a real use earns the next piece. Concrete near-term steps live in [ROADMAP.md](ROADMAP.md).*
