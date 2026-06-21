# MosAIc — OKF Viewer mode (build brief)

*For the MosAIc build session. An additive feature: teach MosAIc to open an Open
Knowledge Format bundle. Read VISION.md / SCHEMA.md / CODEMAP.md first — this rides on
top of the existing surface → views → tesserae model, it doesn't replace anything.*

## What this is

Google Cloud's **Open Knowledge Format (OKF)** (released June 2026, Apache 2.0) packages
organizational knowledge as a **directory of Markdown files with YAML frontmatter** — a
portable "LLM-wiki" a human or an agent can read. Spec + samples + reference impls:
`github.com/GoogleCloudPlatform/knowledge-catalog` → `/okf` (read its `SPEC.md` first).

MosAIc already is a reconfigurable surface that renders structured markdown into tesserae.
So MosAIc can become **a viewer / working-surface for OKF bundles** — a more useful one
than the basic static HTML the spec ships with. That's the feature.

## The one rule: additive, not a pivot

OKF is an **input mode**, not a new identity. MosAIc stays MosAIc — the reconfigurable
LLM-interface shell. "Open an OKF bundle" joins the existing inputs (demo / composer /
prompt); it does not replace them. Keep it a clean, self-contained module.

## Explicitly NOT a knowledge graph

The owner finds knowledge-graph visualizations noise. **Do not build a node/edge graph.**
Render an OKF bundle as a **reading + working surface**: a navigable set of tesserae (one
per concept doc), grouped/filtered by the frontmatter, with clean markdown rendering and
the existing base+overlay reconfiguration. Calm, legible, Bear-blog-lean — the MosAIc
aesthetic, not a graph.

## OKF → MosAIc mapping (the contract)

An OKF bundle = a folder of `*.md`, each file carrying YAML frontmatter (v0.1 fields:
`type, title, description, resource, tags, timestamp`) plus a markdown body.

1. **Loader** — accept an OKF bundle: a folder (file picker / drag-drop), a `.zip`, or a
   URL. Parse each file's frontmatter + body. Be tolerant: missing optional fields
   degrade gracefully; a malformed file is skipped with a notice, never a crash.
2. **Map each OKF doc → one tessera.** `title` → tessera title; `type` → tessera
   kind/grouping; `description` → summary; `tags` → filter facets; `timestamp` →
   shown/sortable; the markdown body → rendered content. Map onto MosAIc's actual tessera
   schema (SCHEMA.md) — don't invent a parallel one.
3. **Render as a surface** — group tesserae by `type`, let `tags` filter, render bodies
   through MosAIc's markdown path. The user reconfigures via the overlay, as with any
   MosAIc surface.
4. **Read/view only for v1.** Editing or exporting OKF is a later iteration if it earns it.

## Why it's worth doing

OKF is new and needs good viewers; the ecosystem reference is a basic static page. MosAIc
as "the reconfigurable OKF reader" is a concrete, immediately-useful public tool — and a
legitimate reference-implementation-class contribution back to the OKF repo.

## Build order

1. OKF frontmatter parser + bundle loader (folder / zip / url) — pure, tested against the
   spec's sample bundles in the repo (`/okf` samples).
2. OKF-doc → tessera adapter (against SCHEMA.md).
3. An "Open OKF bundle" entry in the command bar; render the bundle as a surface.
4. Ship a sample: load one of OKF's published sample bundles, screenshot it for the README.

## Open

- License stays whatever MosAIc's is (MIT default). If the README references lineage,
  credit the original LLM-wiki idea (Andrej Karpathy) — intellectual honesty, and it reads
  better than implying you invented the pattern.
