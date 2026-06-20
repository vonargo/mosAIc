# The overlay schema

MosAIc's core contract: the JSON an LLM emits to **reconfigure the surface**. Keep it small — the simpler the target, the more reliable the reconfiguration.

Three nouns: a **surface** holds **views**; a view lays out **tesserae** (the typed tiles a mosaic is made of).

```
surface ─┬─ view ─┬─ tessera   (markdown | code | table | diagram | note | tasks)
         │        ├─ tessera
         │        └─ …
         ├─ view …
```

## Surface

The whole renderable state.

```jsonc
{
  "title": "MosAIc",      // optional; sidebar/brand title
  "views": [ View, ... ]  // ordered; views[0] is the default route
}
```

## View

One sidebar entry / one screen.

```jsonc
{
  "id": "overview",            // required — slug; the route (#overview) and the merge key
  "title": "Overview",         // sidebar label
  "heading": "imgcli — overview", // optional; big heading (defaults to title)
  "subtitle": "what it does",  // optional; under the heading
  "layout": "grid",            // "stack" (default) | "grid" | "split"
  "tesserae": [ Tessera, ... ]
}
```

Layouts:

| layout | tiling |
| --- | --- |
| `stack` | one reading-width column (good for docs) |
| `grid`  | two equal columns; tiles may set `span` |
| `split` | a wide primary column + a narrower side column |

## Tessera

One typed tile. Common fields: `type` (required), `title` (optional header), `span` (optional, `1`–`2`, widens the tile in grid/split).

```jsonc
{ "type": "markdown", "body": "# Markdown…" }

{ "type": "code", "lang": "python", "filename": "main.py", "body": "def f(): ..." }

{ "type": "table", "columns": ["A", "B"], "rows": [["1", "2"], ["3", "4"]] }

{ "type": "diagram", "body": "flowchart LR\n  A --> B\n  B --> C" }   // Mermaid syntax

{ "type": "note", "tone": "info|accent|warn|ok", "body": "a callout…" }

{ "type": "tasks", "items": [ { "text": "do a thing", "done": false } ] }
```

Tesserae are **content only** — there is no control tile. The prompt, the example suggestions, and the Composer (the live overlay editor) are *chrome*: they live in the command bar so the surface can't reshape its own controls away.

Markdown and note bodies accept the full markdown renderer (headings, lists, tables, fenced code, inline emphasis/code/links). Table cells accept inline markdown.

Adding a tile type is one renderer function in `js/tesserae.js` + one line in its `RENDERERS` map.

## Overlay (the patch an LLM emits)

An overlay has the **same shape as a surface** and is **merged over the base by view `id`**:

- **matching id** → the overlay view's fields are assigned over the base view. Set `tesserae` to replace the tiles; omit it to keep them.
- **new id** → appended as a new view (a new sidebar entry).
- **`"remove": ["id", …]`** (surface-level, optional) → drops those views.

So in one line: `effective(base).views` = the base views, each overlay view assigned over the matching id (or appended), minus `remove`.

The whole render path reads only from the effective surface, so a single overlay reshapes **both** the sidebar and the tiles.

### Example — reshape into a debugging surface

```json
{
  "views": [
    {
      "id": "debug",
      "title": "Debug",
      "layout": "split",
      "tesserae": [
        { "type": "code", "title": "Traceback", "lang": "text", "span": 2, "body": "IndexError: list index out of range" },
        { "type": "tasks", "title": "Hypotheses", "items": [
          { "text": "Off-by-one in the slice", "done": false },
          { "text": "Empty input on the last batch", "done": false }
        ] },
        { "type": "markdown", "title": "Fix", "body": "Guard the split: `parts[-1]` when there's no extension." }
      ]
    }
  ]
}
```

Applying this adds a **Debug** entry to the sidebar and renders a split layout: the traceback full-width across the top, a hypotheses checklist and a fix note below.

## Driving it from a model

MosAIc has a built-in **bring-your-own** model path: signed in with Hugging Face, a typed task is sent to a model on [Inference Providers](https://huggingface.co/docs/inference-providers) billed to the viewer. This schema is the system prompt, the example overlays are the few-shot, and the validated result feeds the `mosaic:apply` path (see `js/llm.js`). No model *ships* with MosAIc and there's no shared key — the Composer drives the same path with hand-edited JSON, and forks can point `js/llm.js` at any chat-completion endpoint.
