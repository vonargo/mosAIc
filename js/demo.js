// Demo tasks. Each is an overlay an LLM might emit for that kind of work —
// canned here so the surface visibly reconfigures with no model wired in. Each
// adds its own views (so the sidebar reshapes too) and a distinct tile layout.
// Content is generic and self-contained: no private data, nothing external.

export const TASKS = [
  {
    id: 'explain',
    label: 'Explain a codebase',
    hint: 'overview · architecture · a key file',
    overlay: {
      views: [
        {
          id: 'overview',
          title: 'Overview',
          heading: 'imgcli — overview',
          subtitle: 'a small CLI that batch-resizes images',
          layout: 'grid',
          tesserae: [
            {
              type: 'markdown', span: 2, title: 'What it is',
              body: `\`imgcli\` is a ~900-LOC Python tool that resizes folders of images in parallel. You point it at a directory, it writes resized copies and caches results by content hash.

- **input** — a glob of images + a target size
- **work** — a worker pool decodes, resizes, re-encodes
- **output** — resized files + a manifest`,
            },
            {
              type: 'table', title: 'Modules',
              columns: ['File', 'Role'],
              rows: [
                ['`cli.py`', 'argument parsing, entry point'],
                ['`resize.py`', 'the core resize + encode loop'],
                ['`io.py`', 'read/write, path handling'],
                ['`cache.py`', 'content-hash result cache'],
              ],
            },
            {
              type: 'diagram', title: 'Architecture',
              body: `flowchart LR
  CLI["cli.py"] --> Core["resize.py"]
  Core --> IO["io.py"]
  Core --> Cache["cache.py"]
  IO --> Disk[("disk")]
  Cache --> Disk`,
            },
            {
              type: 'note', tone: 'accent', title: 'Start here',
              body: `Entry point is \`cli.py\` → \`main()\`. Everything fans out from \`resize.run(paths, size)\`.`,
            },
          ],
        },
        {
          id: 'keyfile',
          title: 'Key file',
          heading: 'resize.py',
          subtitle: 'the core loop',
          layout: 'split',
          tesserae: [
            {
              type: 'code', span: 2, filename: 'resize.py', lang: 'python',
              body: `def run(paths, size, workers=8):
    """Resize every path to \`size\`, reusing cached results."""
    results = []
    with ThreadPoolExecutor(workers) as pool:
        for path in paths:
            results.append(pool.submit(_one, path, size))
    return [r.result() for r in results]

def _one(path, size):
    key = cache.key(path, size)
    if (hit := cache.get(key)):
        return hit
    img = io.read(path)
    out = img.resize(size, LANCZOS)
    dest = io.write(out, path, size)
    cache.put(key, dest)
    return dest`,
            },
            {
              type: 'markdown', title: 'Notes',
              body: `- The cache key is \`(content_hash, size)\` — safe across renames.
- Resizing is CPU-bound; the thread pool helps because decode/encode release the GIL.
- \`_one\` is the unit you'd test first.`,
            },
            {
              type: 'tasks', title: 'To understand next',
              items: [
                { text: 'How `cache.key` hashes content', done: false },
                { text: 'Where `io.write` chooses the dest path', done: false },
                { text: 'Error handling for unreadable files', done: false },
              ],
            },
          ],
        },
      ],
    },
  },

  {
    id: 'debug',
    label: 'Debug an error',
    hint: 'traceback · hypotheses · the fix',
    overlay: {
      views: [
        {
          id: 'debug',
          title: 'Debug',
          heading: 'Debugging a crash',
          subtitle: 'IndexError on the last batch',
          layout: 'split',
          tesserae: [
            {
              type: 'code', span: 2, title: 'Traceback', lang: 'text',
              body: `Traceback (most recent call last):
  File "cli.py", line 41, in main
    out = resize.run(paths, size)
  File "resize.py", line 28, in run
    return [r.result() for r in results]
  File "resize.py", line 19, in _one
    dest = io.write(out, path, size)
  File "io.py", line 55, in write
    name = parts[idx + 1]
IndexError: list index out of range`,
            },
            {
              type: 'tasks', title: 'Hypotheses',
              items: [
                { text: 'Path with no extension → split yields 1 part', done: false },
                { text: '`idx` computed before the bounds check', done: true },
                { text: 'Empty `paths` slice on the final batch', done: false },
              ],
            },
            {
              type: 'note', tone: 'warn', title: 'Repro',
              body: `Only fires on files **without a dotted extension** (e.g. \`Makefile\`, \`README\`). \`idx + 1\` walks off the end.`,
            },
          ],
        },
        {
          id: 'fix',
          title: 'Fix',
          heading: 'The fix',
          subtitle: 'guard the split',
          layout: 'stack',
          tesserae: [
            {
              type: 'markdown', title: 'Root cause',
              body: `\`io.write\` assumes every path has an extension and indexes \`parts[idx + 1]\` unconditionally. For extensionless files \`parts\` has a single element, so \`idx + 1\` is out of range.`,
            },
            {
              type: 'code', filename: 'io.py', lang: 'diff',
              body: `@@ def write(img, path, size):
     parts = path.name.split(".")
-    name = parts[idx + 1]
+    if idx + 1 >= len(parts):
+        name = parts[-1]            # no extension: use the stem
+    else:
+        name = parts[idx + 1]`,
            },
            {
              type: 'tasks', title: 'Verify',
              items: [
                { text: 'Add a regression test: extensionless input', done: false },
                { text: 'Run the suite', done: false },
                { text: 'Resize a folder containing `Makefile`', done: false },
              ],
            },
          ],
        },
      ],
    },
  },

  {
    id: 'plan',
    label: 'Plan a feature',
    hint: 'spec · milestones · rollout',
    overlay: {
      views: [
        {
          id: 'spec',
          title: 'Spec',
          heading: 'Feature: WebP output',
          subtitle: 'add a --format flag',
          layout: 'grid',
          tesserae: [
            {
              type: 'markdown', span: 2, title: 'Goal',
              body: `Let users pick an output format (\`--format webp|png|jpeg\`), defaulting to the input's format. WebP cuts file size ~30% for the same quality — the headline win.

**Non-goals:** animated WebP, AVIF (separate effort).`,
            },
            {
              type: 'tasks', title: 'Milestones',
              items: [
                { text: 'Plumb `--format` through `cli.py`', done: false },
                { text: 'Add encoder dispatch in `io.write`', done: false },
                { text: 'Cache key includes format', done: false },
                { text: 'Docs + examples', done: false },
              ],
            },
            {
              type: 'diagram', title: 'Flow',
              body: `flowchart TD
  Flag["--format"] --> Dispatch{encoder?}
  Dispatch -->|webp| W["encode_webp"]
  Dispatch -->|png| P["encode_png"]
  Dispatch -->|jpeg| J["encode_jpeg"]`,
            },
            {
              type: 'note', tone: 'info', title: 'Open questions',
              body: `- Quality flag per-format, or one global \`--quality\`?
- What happens when the source can't round-trip (e.g. alpha → JPEG)?`,
            },
          ],
        },
        {
          id: 'rollout',
          title: 'Rollout',
          heading: 'Rollout',
          subtitle: 'ship it safely',
          layout: 'stack',
          tesserae: [
            {
              type: 'table', title: 'Phases',
              columns: ['Phase', 'Scope', 'Gate'],
              rows: [
                ['1', 'WebP behind `--format`, opt-in', 'tests green'],
                ['2', 'Format inferred from `--out` extension', 'docs updated'],
                ['3', 'WebP default for web targets', 'benchmark vs PNG'],
              ],
            },
            {
              type: 'markdown', title: 'Risks',
              body: `- **Alpha loss** converting to JPEG — warn and skip, don't fail silently.
- **Cache invalidation** — bumping the key re-renders everything once; acceptable.`,
            },
          ],
        },
      ],
    },
  },

  {
    id: 'trip',
    label: 'Plan a trip',
    hint: 'itinerary · checklist · good to know',
    overlay: {
      views: [
        {
          id: 'trip',
          title: 'Trip',
          heading: 'A weekend in Lisbon',
          subtitle: 'two days, on foot',
          layout: 'grid',
          tesserae: [
            {
              type: 'markdown', span: 2, title: 'The plan',
              body: `Two unhurried days through **Lisbon** — old quarters and viewpoints — with a Sunday day-trip west to Sintra. Built for an easy pace, not a checklist march.`,
            },
            {
              type: 'table', title: 'Itinerary',
              columns: ['Day', 'Highlights'],
              rows: [
                ['Fri', 'Alfama lanes · Sé cathedral · sunset at Portas do Sol'],
                ['Sat', 'Belém tower · pastéis de Belém · tram 28'],
                ['Sun', 'Day-trip to Sintra · Pena Palace'],
              ],
            },
            {
              type: 'tasks', title: 'Before you go',
              items: [
                { text: 'Book the Sintra train (Rossio → Sintra)', done: false },
                { text: 'Reserve a pastéis de Belém slot', done: false },
                { text: 'Download an offline map', done: false },
              ],
            },
            {
              type: 'note', tone: 'info', title: 'Good to know',
              body: `Lisbon is **hilly** — comfortable shoes. Trams fill up by mid-morning, so go early. Budget roughly €80/day excluding the hotel.`,
            },
          ],
        },
      ],
    },
  },
];

export const taskById = (id) => TASKS.find(t => t.id === id) || null;
