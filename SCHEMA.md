# The overlay schema

MosAIc's core contract: the JSON an LLM emits to **reconfigure the surface**. Keep it small — the simpler the target, the more reliable the reconfiguration.

Three nouns: a **surface** holds **views**; a view lays out **tesserae** (the typed tiles a mosaic is made of).

```
surface ─┬─ view ─┬─ tessera   (markdown | code | table | diagram | note | tasks | composer)
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

{ "type": "composer", "value": "{ \"views\": [] }" }   // a live overlay editor
```

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

MosAIc ships no model — it's the surface you wire one into. To drive it, prompt your LLM with this schema and have it return an overlay as JSON, then apply it (the in-app **Composer** tile does exactly this with hand-edited JSON; a model integration would feed the same `mosaic:apply` path).
