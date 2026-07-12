// Tesserae — the typed tiles a view is laid out from.
//
// One renderer per `type`, registered in RENDERERS. Each takes a tessera spec
// and returns an HTML string for the tile body; `renderTessera` wraps it in the
// shared chrome. Adding a tile type = write a function, add one line to the map.
// Interactive tiles (code-copy, tasks) wire up in `hydrate()`, run once after
// the HTML lands. Tesserae are content only — controls live in the command bar.

import { escapeHtml, mdToHtml, mdInline } from './utils.js';
import { resolveSpan } from './resize.js';

const RENDERERS = {
  markdown(t) {
    return `<div class="md">${mdToHtml(t.body || '')}</div>`;
  },

  code(t) {
    const bar = (t.filename || t.lang)
      ? `<div class="code-bar"><span class="code-name">${escapeHtml(t.filename || '')}</span>` +
        `<span class="code-lang">${escapeHtml(t.lang || '')}</span>` +
        `<button class="t-copy" type="button" title="Copy">copy</button></div>`
      : `<button class="t-copy t-copy-float" type="button" title="Copy">copy</button>`;
    return `<div class="code">${bar}<pre><code>${escapeHtml(t.body || '')}</code></pre></div>`;
  },

  table(t) {
    // A table can arrive as structured top-level `columns`/`rows`, as `data:{headers|columns, rows}`,
    // or as a markdown table in `body`. Accept all three; fall back to the markdown renderer.
    const d = (t.data && typeof t.data === 'object') ? t.data : {};
    const cols = Array.isArray(t.columns) ? t.columns : (Array.isArray(d.headers) ? d.headers : (Array.isArray(d.columns) ? d.columns : []));
    const rs = Array.isArray(t.rows) ? t.rows : (Array.isArray(d.rows) ? d.rows : []);
    if (!cols.length && !rs.length) return `<div class="md">${mdToHtml(t.body || '')}</div>`;
    const cell = c => mdInline(escapeHtml(String(c ?? '')));
    const head = cols.map(h => `<th>${cell(h)}</th>`).join('');
    const rows = rs.map(r =>
      `<tr>${(r || []).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('');
    return `<table class="md-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  },

  // Mermaid renders these in-place (see diagram.js). The raw source is kept as
  // textContent so it degrades to readable text if the CDN is unreachable. Strip a
  // ```mermaid fence if the body arrives wrapped, so mermaid parses the source not the wrapper.
  diagram(t) {
    let src = String(t.body || (t.data && t.data.diagram) || '').trim();
    src = src.replace(/^```+\s*mermaid\s*/i, '').replace(/^```+\s*/, '').replace(/```+\s*$/, '').trim();
    return `<div class="mermaid">${escapeHtml(src)}</div>`;
  },

  note(t) {
    const tone = ['info', 'accent', 'warn', 'ok'].includes(t.tone) ? t.tone : 'info';
    return `<div class="note note-${tone}">${mdToHtml(t.body || '')}</div>`;
  },

  tasks(t) {
    // Items may be objects ({text|label|task, done|completed}) OR plain strings; fall back to body.
    const src = Array.isArray(t.items) ? t.items : (Array.isArray(t.data && t.data.items) ? t.data.items : []);
    if (!src.length && t.body) return `<div class="md">${mdToHtml(t.body)}</div>`;
    const items = src.map((it, i) => {
      const isStr = typeof it === 'string';
      const text = isStr ? it : String((it && (it.text ?? it.label ?? it.task)) || '');
      const checked = !isStr && !!(it && (it.done || it.completed));
      const done = checked ? ' done' : '';
      return `<li class="task-item${done}" data-i="${i}" role="checkbox" tabindex="0" aria-checked="${checked}">` +
        `<span class="task-box"></span><span class="task-text">${mdInline(escapeHtml(text))}</span></li>`;
    }).join('');
    return `<ul class="tasks">${items}</ul>`;
  },
};

// Provenance strip for OKF concepts — a PRESENCE check, not verification: it surfaces whether a
// concept carries a source link / citations (`sourced`) vs not (`unsourced`). "sourced" means a
// citation is present, NOT that the claim is true (a concept can cite anywhere and show sourced).
// Rides on any tessera carrying `okf` metadata; renders the badge, a sanitized link, a date, tags.
const okfDate = (ts) => String(ts || '').slice(0, 10);
function okfMeta(okf) {
  if (!okf) return '';
  const safe = /^https?:\/\//i.test(okf.resource || '') ? okf.resource : '';
  const bits = [okf.sourced
    ? `<span class="okf-badge okf-sourced" title="Cites a source link or references">● sourced</span>`
    : `<span class="okf-badge okf-unsourced" title="No resource or citations — provenance unknown">○ unsourced</span>`];
  if (safe) bits.push(`<a class="okf-link" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">source ↗</a>`);
  if (okf.timestamp) bits.push(`<span class="okf-when">updated ${escapeHtml(okfDate(okf.timestamp))}</span>`);
  const tags = (okf.tags || []).map((t) => `<span class="okf-tag">${escapeHtml(t)}</span>`).join('');
  return `<div class="okf-meta">${bits.join(' <span class="okf-dot">·</span> ')}` +
    `${tags ? `<span class="okf-tags">${tags}</span>` : ''}</div>`;
}

export function renderTessera(t, i = 0) {
  // A spacer is a deliberate empty cell — a gap you can place, drag, resize, and delete. No head,
  // no fold, no content; just enough of a frame to see the hole and a × to remove it.
  if (t && t.type === 'spacer') {
    const sp = resolveSpan(t);
    return `<section class="tessera t-spacer" style="--span:${sp};--i:${i}" aria-label="Blank tile">` +
      `<span class="spacer-mark">blank</span>` +
      `<button class="t-del" type="button" title="Remove blank">×</button>` +
      `<span class="tessera-resize" aria-hidden="true"></span></section>`;
  }
  const type = t && RENDERERS[t.type] ? t.type : 'markdown';
  const fn = RENDERERS[type];
  const span = resolveSpan(t);
  const collapsed = !!(t && t.collapsed);
  // Untitled tiles fall back to their TYPE as the label, so a composed table/diagram/code is
  // always identifiable; titled tiles keep their title (+ the type tag).
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const titleText = t.title && t.title.trim() ? t.title : typeLabel;
  const head = `<div class="tessera-head"><span class="tessera-title">${escapeHtml(titleText)}</span>` +
    `<span class="tessera-tag">${escapeHtml(type)}</span>` +
    `<button class="t-fold" type="button" aria-expanded="${collapsed ? 'false' : 'true'}" ` +
    `title="${collapsed ? 'Expand' : 'Collapse'}">${collapsed ? '▸' : '▾'}</button></div>`;
  const sub = t.okf && t.okf.description
    ? `<div class="tessera-sub">${escapeHtml(t.okf.description)}</div>` : '';
  return `<section class="tessera t-${type}${collapsed ? ' collapsed' : ''}" style="--span:${span};--i:${i}">${head}${sub}` +
    `<div class="tessera-body">${fn(t)}</div>${okfMeta(t.okf)}` +
    `<span class="tessera-resize" aria-hidden="true"></span></section>`;
}

// Wire interactive tiles. Idempotent per element via a data flag.
export function hydrate(root) {
  root.querySelectorAll('.t-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.code')?.querySelector('code');
      if (!code) return;
      navigator.clipboard?.writeText(code.textContent).then(() => {
        const was = btn.textContent; btn.textContent = 'copied'; btn.classList.add('did');
        setTimeout(() => { btn.textContent = was; btn.classList.remove('did'); }, 1200);
      });
    });
  });

  root.querySelectorAll('.task-item').forEach(li => {
    const toggle = () => {
      const on = li.classList.toggle('done');
      li.setAttribute('aria-checked', on ? 'true' : 'false');
    };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
  });
}
