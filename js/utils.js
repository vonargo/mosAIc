export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* Inline markdown — code, bold, italic, strike, links. Operates on text that
   is *already* HTML-escaped. Exported so tesserae (e.g. table cells) reuse it. */
export function mdInline(t) {
  return t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
      // Allow relative/anchor URLs and http(s)/mailto only; neutralize the rest
      // (e.g. javascript:, data:) — this is shared, paste-and-trade overlay JSON.
      const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i);
      return (!scheme || /^(https?|mailto)$/i.test(scheme[1]))
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`
        : `<a href="#" rel="noopener noreferrer">${text}</a>`;
    });
}

/* Markdown → HTML. Small, dependency-free. Covers headings, lists, tables,
   fenced code, blockquotes, rules, and inline emphasis/code/links.
   A ```mermaid fence emits <div class="mermaid"> so the diagram lib can
   render it. This is the reusable core of the markdown tessera. */
export function mdToHtml(md) {
  if (!md) return '';
  const fences = [];
  let src = String(md).replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, body) => {
    const code = escapeHtml(body.replace(/\n$/, ''));
    if (lang.trim().toLowerCase() === 'mermaid') {
      fences.push(`<div class="mermaid">${code}</div>`);
    } else {
      fences.push(`<div class="code-block"><pre><code>${code}</code></pre></div>`);
    }
    return ` F${fences.length - 1} `;
  });
  src = escapeHtml(src);

  const inline = mdInline;

  const lines = src.split('\n');
  const out = [];
  let i = 0, para = [], listStack = [];

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeLists = (depth = 0) => { while (listStack.length > depth) out.push(listStack.pop() === 'ol' ? '</ol>' : '</ul>'); };

  while (i < lines.length) {
    const line = lines[i];

    // table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushPara(); closeLists();
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(`<table class="md-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }

    // fenced block placeholder
    const fence = line.match(/^ F(\d+) \s*$/);
    if (fence) { flushPara(); closeLists(); out.push(fences[+fence[1]]); i++; continue; }

    // heading
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { flushPara(); closeLists(); out.push(`<div class="md-h md-h${h[1].length}">${inline(h[2])}</div>`); i++; continue; }

    // rule
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { flushPara(); closeLists(); out.push('<hr class="md-hr">'); i++; continue; }

    // blockquote
    if (/^\s*(&gt;|>)\s?/.test(line)) {
      flushPara(); closeLists();
      const q = [];
      while (i < lines.length && /^\s*(&gt;|>)\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*(&gt;|>)\s?/, '')); i++; }
      out.push(`<blockquote class="md-quote">${inline(q.join(' '))}</blockquote>`);
      continue;
    }

    // list
    const li = line.match(/^(\s*)([-*]|\d+[.)])\s+(.+)$/);
    if (li) {
      flushPara();
      const depth = Math.floor(li[1].length / 2) + 1;
      const type = /^[-*]$/.test(li[2]) ? 'ul' : 'ol';
      while (listStack.length > depth) out.push(listStack.pop() === 'ol' ? '</ol>' : '</ul>');
      while (listStack.length < depth) { out.push(type === 'ol' ? '<ol>' : '<ul>'); listStack.push(type); }
      out.push(`<li>${inline(li[3])}</li>`);
      i++; continue;
    }

    if (!line.trim()) { flushPara(); closeLists(); i++; continue; }
    closeLists();
    para.push(line.trim());
    i++;
  }
  flushPara(); closeLists();
  return out.join('\n');
}
