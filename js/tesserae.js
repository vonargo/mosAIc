// Tesserae — the typed tiles a view is laid out from.
//
// One renderer per `type`, registered in RENDERERS. Each takes a tessera spec
// and returns an HTML string for the tile body; `renderTessera` wraps it in the
// shared chrome. Adding a tile type = write a function, add one line to the map.
// Interactive tiles (code-copy, tasks) wire up in `hydrate()`, run once after
// the HTML lands. Tesserae are content only — controls live in the command bar.

import { escapeHtml, mdToHtml, mdInline } from './utils.js';

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
    const cell = c => mdInline(escapeHtml(String(c ?? '')));
    const head = (t.columns || []).map(h => `<th>${cell(h)}</th>`).join('');
    const rows = (t.rows || []).map(r =>
      `<tr>${(r || []).map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('');
    return `<table class="md-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  },

  // Mermaid renders these in-place (see diagram.js). The raw source is kept as
  // textContent so it degrades to readable text if the CDN is unreachable.
  diagram(t) {
    return `<div class="mermaid">${escapeHtml(t.body || '')}</div>`;
  },

  note(t) {
    const tone = ['info', 'accent', 'warn', 'ok'].includes(t.tone) ? t.tone : 'info';
    return `<div class="note note-${tone}">${mdToHtml(t.body || '')}</div>`;
  },

  tasks(t) {
    const items = (t.items || []).map((it, i) => {
      const done = it && it.done ? ' done' : '';
      return `<li class="task-item${done}" data-i="${i}" role="checkbox" tabindex="0" aria-checked="${!!(it && it.done)}">` +
        `<span class="task-box"></span><span class="task-text">${mdInline(escapeHtml(String(it && it.text || '')))}</span></li>`;
    }).join('');
    return `<ul class="tasks">${items}</ul>`;
  },
};

export function renderTessera(t, i = 0) {
  const type = t && RENDERERS[t.type] ? t.type : 'markdown';
  const fn = RENDERERS[type];
  const span = t.span > 1 ? t.span : 1;
  const head = t.title
    ? `<div class="tessera-head"><span class="tessera-title">${escapeHtml(t.title)}</span><span class="tessera-tag">${escapeHtml(type)}</span></div>`
    : '';
  return `<section class="tessera t-${type}" style="--span:${span};--i:${i}">${head}` +
    `<div class="tessera-body">${fn(t)}</div></section>`;
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
