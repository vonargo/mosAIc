# MosAIc — roadmap & ideas

*Forward-looking notes for whoever picks this up next — me later, or a forker. The **shipped** state is in [CODEMAP.md](CODEMAP.md) and [SCHEMA.md](SCHEMA.md); this is what's deliberately **not** built yet, plus the thinking behind it so you don't have to redo it.*

## The wire format (the big open question)

Today the model emits the overlay as **JSON** (`response_format: json_object` + a JS validator + one corrective retry — `js/llm.js`). JSON is precise and trivially validated, but models break it (escaping multi-line bodies, brackets) and it can't stream. The options, by axis:

| format | structure | code w/o escaping | model emits cleanly | validatable | streamable | parser dep |
|---|---|---|---|---|---|---|
| **JSON** (today) | ✓✓ | ✗ `\n \"` | ~ | ✓✓ | ✗ | none (`JSON.parse`) |
| full **YAML** (`\|` block scalars) | ✓✓ | ✓ | ~ (indent) | ✓ | ✗ | lib / restricted |
| **markdown** (block-inferred) | ✗ needs dialect | ✓✓ | ✓✓ | ~ | ✓✓ | custom |
| **YAML front-matter + markdown** | view ✓ / tile ~ | ✓✓ | ✓✓ | ✓ | ✓ | small custom |
| **XML / tags** | ✓✓ (attrs) | ~ (`<` `&`) | ✓✓ | ✓ | ✓✓ | none (`DOMParser`) |
| **tool calls / `json_schema`** | ✓✓ | ✗ (args) | ✓ | ✓✓ (enforced) | ✓✓ | none |

There's no free lunch — the axes trade against each other. The sharp tension: *code without escaping* → markdown / YAML block scalars; *per-tile metadata + zero-dep + streaming* → XML tags (`DOMParser` is the unlock; attributes carry `span`/`tone`/`lang` natively); *guaranteed-valid + edit-in-place* → tool calls / edit-ops.

**Two places the "the model can't break it" determinism can live:**
- **Provider-side:** strict `json_schema` / tool-calling = grammar-constrained decoding; the model emits JSON the grammar *won't let* be malformed. As strong as the provider supports — patchy across `provider: "auto"`, which is why we shipped the portable `json_object` + JS validator.
- **Client-side:** the model writes markdown/YAML *as plain text and never emits JSON at all*; a deterministic parser (`markdownToOverlay()`) produces the object. No bracket for it to break; bad input degrades a tile to text, not a crash.

The tidy "best of both, with tool calls": a single tool **`emit_surface({ source })`** where `source` is YAML-front-matter + markdown — provider-enforced envelope (forces *only* the surface, no preamble), a forgiving payload the model is fluent in, a deterministic local parser, and the existing `validateOverlay` as the backstop. All of these still compile to the same overlay `effective()` merges — it's a choice of *source syntax*, not architecture.

## Near-term improvements (roughly prioritized)

**Iteration shipped (v1.0):** successive typed tasks now patch the *current* surface — `generateOverlay(task, current)` sends it and the model emits a patch; `composeOverlay()` (`js/state.js`) folds it into the accumulated overlay by the same id-merge as `effective()`, so the mosaic **evolves** instead of regenerating. `Reset` returns to base. Refinements worth adding: an explicit **modify-vs-fresh** control (today the model infers from phrasing); **undo/history** (the overlay is serializable — a stack is cheap); routing to the *changed* view after a patch (it currently lands on `views[0]`); and guarding against id drift (a patch that renames ids appends duplicates rather than editing). The finer-grained version is **edit-ops** (#6).

1. **Strict `json_schema`** with the `json_object` + validator path as fallback — provider-enforced validity where supported, no cost where not. Biggest bang per line.
2. **Stream tiles in** as they arrive (the optional polish from the build) — needs a streamable format; `chatCompletionStream` already exists in `@huggingface/inference`.
3. **`markdownToOverlay()`** behind `mosaic:apply` — prototype + A/B against JSON for emit reliability before committing to it.
4. **Composer markdown mode** — let the Composer accept the friendly format too, not only JSON.
5. **Model picker** — `MODEL` in `js/llm.js` is a constant; surface it (+ provider) as a small setting, and show which-model / rough-cost near the prompt (the seasoned-user trust ask from the UX review).
6. **Edit-ops** — fine-grained tool calls (`add_tile`, `remove_view`) for incremental edits and native edit-in-place.

## Tests

A starter suite lives in `test/` — zero-dependency, Node's built-in runner:

```bash
node --test        # or: npm test
```

It covers the crown jewels: the `base ⊕ overlay` merge (`effective`), `validateOverlay` (including the *omit-tesserae-to-keep-base-tiles* regression), and the markdown link sanitizer (the `javascript:` XSS regression). **Not yet covered, worth adding:**

- `mdToHtml` block cases (tables, nested lists, fenced code, mermaid) and its known 2-space-indent rough edge.
- `extractJson` in `js/llm.js` (export it first) — fenced / prose-wrapped / unbalanced inputs.
- A **Playwright smoke suite** for the flows hand-verified during the build: load → apply example → Composer edit-in-place → reload persistence → signed-out graceful degradation. (The repo isn't wired for Playwright yet.)
- The model path (live OAuth + inference) can only be exercised on a deployed Space.

## Bigger ideas / v2

*The north star these point toward — MosAIc as an open render surface for LLM coauthoring — is in [VISION.md](VISION.md).*

- **Provider-agnostic proxy** — an optional OpenAI-compatible endpoint setting so MosAIc isn't HF-only (the brief's original "thin provider-agnostic proxy").
- **The plugin arc** — the brief's long game: a reconfigurable artifact layer a coding agent drives. The overlay schema is the seam; a host (IDE / agent) emits overlays over a transport instead of the in-browser model.
- **Share / persist** — the surface is just a serializable overlay; a shareable URL (or save-to-HF-dataset for signed-in users) is small.
- **Polish** — per-tile streaming render, diagram theming, keyboard navigation.

---

*Keep it minimal. The shape is the value — earn each addition.*
