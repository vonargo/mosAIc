// OKF (Open Knowledge Format — Google Cloud, v0.1) → MosAIc.
//
// An additive *input mode*: open an OKF bundle (a folder of markdown files with
// YAML frontmatter) and render it as a calm reading surface — not the force-directed
// graph the reference viewer ships. This module is the pure core: parse a bundle,
// then map it onto MosAIc's existing surface → views → tesserae model (SCHEMA.md).
// The browser loader feeds it files; the render path is unchanged.
//
// We hand-roll a tiny frontmatter reader instead of pulling in a YAML dependency —
// OKF frontmatter is deliberately simple (scalars, a `tags` list, ISO dates).
// Tolerant by design: missing optional fields degrade, unknown keys are preserved
// (the spec requires it), and a malformed file is skipped with a reason — never a
// crash. Spec: github.com/GoogleCloudPlatform/knowledge-catalog → /okf/SPEC.md

const RESERVED = new Set(['index.md', 'log.md']);   // spec-reserved filenames; no frontmatter
const KNOWN = new Set(['type', 'title', 'description', 'resource', 'tags', 'timestamp']);

const stripQuotes = (s) => s.replace(/^(["'])([\s\S]*)\1$/, '$2');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const titleFromFilename = (name) =>
  name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

// A minimal YAML-frontmatter reader: `key: scalar`, `key: [a, b]`, and block lists
// (`key:` then `  - item`). Enough for OKF v0.1; an unrecognized shape degrades to a
// raw string rather than throwing. Splitting on the first colon keeps URLs intact.
function parseFrontmatter(fm) {
  const out = {};
  const lines = fm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    const m = lines[i].match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (val === '') {                                  // block list on following "  - x" lines, or empty
      const list = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        list.push(stripQuotes(lines[++i].replace(/^\s*-\s+/, '').trim()));
      }
      out[key] = list.length ? list : '';
    } else if (val[0] === '[' && val[val.length - 1] === ']') {   // inline list
      out[key] = val.slice(1, -1).split(',').map((s) => stripQuotes(s.trim())).filter(Boolean);
    } else {
      out[key] = stripQuotes(val.trim());
    }
  }
  return out;
}

// Pull a `# Citations` section's numbered links into structured sources.
function extractCitations(body) {
  const at = body.search(/^#+\s+Citations\s*$/im);
  if (at < 0) return [];
  const out = [];
  const re = /^\[(\d+)\]\s+\[([^\]]+)\]\(([^)\s]+)\)/gm;
  let m;
  while ((m = re.exec(body.slice(at)))) out.push({ n: Number(m[1]), text: m[2], url: m[3] });
  return out;
}

// Internal cross-links (other concepts in the bundle) — for navigation, not a graph.
function extractLinks(body) {
  const seen = new Set(), out = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(body))) {
    const target = m[2];
    if (/^https?:/i.test(target)) continue;            // external → a citation, not a cross-link
    const internal = target.startsWith('/') || target.startsWith('./') || target.startsWith('../') || /\.md($|#)/i.test(target);
    if (internal && !seen.has(target)) { seen.add(target); out.push({ text: m[1], target }); }
  }
  return out;
}

// One OKF file → a parsed concept, or a { reserved } / { malformed } marker.
export function parseOkfDoc(path, raw) {
  const text = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
  const name = path.split('/').pop();
  if (RESERVED.has(name)) return { reserved: name.replace(/\.md$/i, ''), path, body: text.trim() };

  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) return { malformed: 'no frontmatter block', path };

  const fm = parseFrontmatter(fmMatch[1]);
  if (!fm.type) return { malformed: 'missing required `type`', path };

  const body = fmMatch[2].trim();
  const tags = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);
  const custom = {};
  for (const k of Object.keys(fm)) if (!KNOWN.has(k)) custom[k] = fm[k];

  return {
    path, name,
    type: String(fm.type),
    title: fm.title || titleFromFilename(name),
    description: fm.description || '',
    resource: fm.resource || '',
    tags,
    timestamp: fm.timestamp || '',
    body,
    citations: extractCitations(body),
    links: extractLinks(body),
    custom,
  };
}

// A whole bundle → { docs, reserved, skipped }. `files` = [{ path, text }].
export function parseOkfBundle(files) {
  const docs = [], reserved = [], skipped = [];
  for (const f of files || []) {
    const r = parseOkfDoc(f.path, f.text);
    if (r.malformed) skipped.push({ path: r.path, reason: r.malformed });
    else if (r.reserved) reserved.push(r);
    else docs.push(r);
  }
  return { docs, reserved, skipped };
}

// Resolve an OKF link target to a bundle-relative path. Absolute `/a/b.md` stays;
// `./` and `../` resolve against the linking doc's directory.
function resolveBundlePath(target, docPath) {
  if (target.startsWith('/')) return target;
  const dir = docPath.slice(0, docPath.lastIndexOf('/') + 1);
  const out = [];
  for (const p of (dir + target).split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop(); else out.push(p);
  }
  return '/' + out.join('/');
}

// Rewrite in-bundle cross-links to in-app routes (#viewId of the concept they point
// at), so "connectivity as reading" navigates instead of 404-ing. External links and
// bare anchors are left untouched.
function rewriteCrossLinks(body, docPath, pathToView) {
  return body.replace(/(\]\()([^)\s]+)(\))/g, (m, open, target, close) => {
    if (/^(https?:|mailto:|#)/i.test(target)) return m;
    const view = pathToView.get(resolveBundlePath(target.replace(/#.*$/, ''), docPath));
    return view ? `${open}#${view}${close}` : m;
  });
}

// Concepts → a MosAIc overlay: one view per `type`, one markdown tessera per doc.
// OKF metadata rides under `okf` on each tessera for the filter + provenance layer
// (the OKF render path reads it; effective()'s shallow merge preserves it). `sourced`
// is the provenance signal — true only if the concept cites a resource or sources.
// Cross-links between concepts are rewritten to in-app routes.
export function okfToOverlay(docs) {
  const list = docs || [];
  const byType = new Map();
  for (const d of list) {
    if (!byType.has(d.type)) byType.set(d.type, []);
    byType.get(d.type).push(d);
  }

  // Assign one view id per type, and map every concept path to its view.
  const typeId = new Map(), pathToView = new Map(), seen = new Set();
  for (const [type, group] of byType) {
    let id = slug(type) || 'concepts';
    while (seen.has(id)) id += '-2';
    seen.add(id);
    typeId.set(type, id);
    for (const d of group) pathToView.set(d.path, id);
  }

  const views = [];
  for (const [type, group] of byType) {
    views.push({
      id: typeId.get(type),
      title: type,
      heading: type,
      subtitle: `${group.length} ${group.length === 1 ? 'concept' : 'concepts'}`,
      // grid + full-row tiles: reads exactly like the old one-column stack, but the corner
      // resize works — drag a concept down to span 1 and two concepts sit side by side.
      // (stack hides the resize handle: span is a no-op in a flex column.)
      layout: 'grid',
      tesserae: group.map((d) => ({
        type: 'markdown',
        span: 2,
        title: d.title,
        body: rewriteCrossLinks(d.body, d.path, pathToView),
        okf: {
          path: d.path, conceptType: d.type, description: d.description,
          resource: d.resource, timestamp: d.timestamp, tags: d.tags,
          citations: d.citations, links: d.links, custom: d.custom,
          sourced: !!(d.resource || d.citations.length),
        },
      })),
    });
  }
  return { views };
}

// Filter OKF docs by a free-text query — case-insensitive match across title, type,
// tags, description, and body; multiple words are AND'd; an empty query returns all.
// The deterministic, model-free way to narrow a bundle — and, since the filtered set
// re-applies as the surface, to SCOPE what a subsequent LLM query operates on. Pure.
export function okfFilter(docs, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return docs || [];
  const terms = q.split(/\s+/);
  return (docs || []).filter((d) => {
    const hay = [d.title, d.type, d.description, (d.tags || []).join(' '), d.body].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
