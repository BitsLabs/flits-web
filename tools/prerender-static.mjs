import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://flits.cc';
const pageMap = [
  ['pages/index-ventures.html', 'content/index-ventures.md', '/pages/index-ventures'],
  ['pages/contact.html', 'content/contact.md', '/pages/contact'],
  ['pages/ventures.html', 'content/ventures.md', '/pages/ventures'],
  ['pages/notes.html', 'content/notes.md', '/pages/notes'],
  ['pages/thesis.html', 'content/thesis.md', '/pages/thesis'],
  ['pages/principal.html', 'content/principal.md', '/pages/principal'],
  ['pages/legal.html', 'content/legal.md', '/pages/legal'],
  ['privacy.html', 'content/privacy.md', '/privacy'],
  ['support.html', 'content/support.md', '/support']
];

const articlePaths = JSON.parse(read('content/articles.json'));
const articleMap = articlePaths.map((mdPath) => {
  const slug = path.basename(mdPath, '.md');
  return [`pages/notes/${slug}.html`, path.join('content', mdPath), `/pages/notes/${slug}`];
});

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value = '') {
  return escapeHtml(value).replace(/\n/g, ' ');
}

function parseFrontMatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const data = {};
  let body = source;

  if (match) {
    body = source.slice(match[0].length);
    match[1].split(/\r?\n/).forEach((line) => {
      const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (pair) data[pair[1]] = pair[2].trim();
    });
  }

  return { data, body };
}

function inline(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;
  let raw = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  }

  function flushRaw() {
    if (!raw.length) return;
    html.push(raw.join('\n'));
    raw = [];
  }

  function tableAt(index) {
    if (!lines[index + 1] || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) return null;
    const rows = [];
    let cursor = index;
    while (lines[cursor] && lines[cursor].includes('|')) {
      if (cursor !== index + 1) {
        rows.push(lines[cursor].trim().replace(/^\||\|$/g, '').split('|').map((cell) => inline(cell.trim())));
      }
      cursor += 1;
    }
    return { rows, end: cursor };
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (raw.length) {
      raw.push(line);
      if (/^<\/(?:figure|div|section|table)>$/.test(trimmed)) flushRaw();
      continue;
    }

    if (/^<(?:figure|div|section|table)(?:\s|>)/.test(trimmed)) {
      flushParagraph();
      flushList();
      raw.push(line);
      if (/^<\/(?:figure|div|section|table)>$/.test(trimmed)) flushRaw();
      continue;
    }

    const table = tableAt(i);
    if (table) {
      flushParagraph();
      flushList();
      const head = table.rows.shift() || [];
      html.push(`<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>`);
      table.rows.forEach((row) => {
        html.push(`<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`);
      });
      html.push('</tbody></table>');
      i = table.end - 1;
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      flushList();
      const depth = line.match(/^#+/)[0].length;
      html.push(`<h${depth}>${inline(line.replace(/^#{1,6}\s+/, ''))}</h${depth}>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      if (list !== 'ul') {
        flushList();
        list = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      if (list !== 'ol') {
        flushList();
        list = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushRaw();
  return html.join('\n');
}

function enhanceStaticTables(html) {
  return html
    .replace(/<table><thead><tr><th>#<\/th><th>Name<\/th><th>Description<\/th><th>Status<\/th><\/tr><\/thead><tbody>/g, '<table class="md-ledger"><thead><tr><th>#</th><th>Name</th><th>Description</th><th>Status</th></tr></thead><tbody>')
    .replace(/<table><thead><tr><th>Channel<\/th><th>Details<\/th><\/tr><\/thead><tbody>/g, '<table class="md-contact"><thead><tr><th>Channel</th><th>Details</th></tr></thead><tbody>');
}

function descriptionFor(parsed) {
  return parsed.data.intro || parsed.data.excerpt || parsed.body.replace(/[#*_`|>\[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 155);
}

function upsertHead(html, route, parsed) {
  const canonical = `${siteUrl}${route}`;
  const description = descriptionFor(parsed);
  let next = html;
  next = next.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(parsed.data.title || 'Flits')} - Flits</title>`);
  const tags = [
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:title" content="${escapeAttr((parsed.data.title || 'Flits') + ' - Flits')}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    '<meta property="og:type" content="website">'
  ].join('\n');

  if (next.includes('<link rel="canonical"')) {
    next = next
      .replace(/<meta name="description" content="[^"]*">\n?/g, '')
      .replace(/<link rel="canonical" href="[^"]*">\n?/g, '')
      .replace(/<meta property="og:[^>]+>\n?/g, '');
  }
  return next.replace('</title>\n', `</title>\n${tags}\n`);
}

function renderPage(htmlPath, mdPath, route) {
  const parsed = parseFrontMatter(read(mdPath));
  let html = read(htmlPath);
  let bodyHtml;

  if (parsed.data.articles) {
    const notes = articlePaths.map((articlePath) => {
      const article = parseFrontMatter(read(path.join('content', articlePath)));
      const slug = path.basename(articlePath, '.md');
      return '<article>' +
        `<span class="date">${escapeHtml(article.data.date || '')}</span>` +
        '<div>' +
        `<a class="title" href="/pages/notes/${slug}">${escapeHtml(article.data.title || slug)}</a>` +
        `<div class="excerpt">${escapeHtml(article.data.excerpt || '')}</div>` +
        '</div>' +
        '</article>';
    }).join('');
    bodyHtml = `<div class="notes">${notes}</div>`;
  } else {
    bodyHtml = enhanceStaticTables(renderMarkdown(parsed.body));
  }

  html = html
    .replace(/<div class="kicker">[\s\S]*?<\/div>/, `<div class="kicker">${escapeHtml(parsed.data.kicker || '')}</div>`)
    .replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${parsed.data.heading || escapeHtml(parsed.data.title || '')}</h1>`)
    .replace(/<p class="intro">[\s\S]*?<\/p>/, `<p class="intro">${escapeHtml(parsed.data.intro || '')}</p>`)
    .replace(/<p class="aside">[\s\S]*?<\/p>/, `<p class="aside">${escapeHtml(parsed.data.aside || '')}</p>`)
    .replace(/<div class="body markdown-body">[\s\S]*?<\/div>\s*<\/section>/, `<div class="body markdown-body">\n${bodyHtml}\n      </div>\n    </section>`);

  write(htmlPath, upsertHead(html, route, parsed));
}

function renderArticle(htmlPath, mdPath, route) {
  const parsed = parseFrontMatter(read(mdPath));
  let html = read(htmlPath);
  const title = escapeHtml(parsed.data.title || '');
  const bodyHtml = '<article class="article">' +
    '<a class="article-back" href="/pages/notes" data-article-back><span class="arrow"><svg viewBox="0 0 20 8" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" shape-rendering="geometricPrecision"><path d="M1 4 L20 4 M1 4 L5 0.5 M1 4 L5 7.5"/></svg></span>Back</a>' +
    `<div class="date">${escapeHtml(parsed.data.date || '')}</div>` +
    `<h2>${title}</h2>` +
    renderMarkdown(parsed.body) +
    '</article>';

  html = html.replace(/<div class="body markdown-body">[\s\S]*?<\/div>\s*<\/section>/, `<div class="body markdown-body">\n${bodyHtml}\n      </div>\n    </section>`);
  write(htmlPath, upsertHead(html, route, parsed));
}

pageMap.forEach(([htmlPath, mdPath, route]) => renderPage(htmlPath, mdPath, route));
articleMap.forEach(([htmlPath, mdPath, route]) => renderArticle(htmlPath, mdPath, route));

const routes = ['/', ...pageMap.map(([, , route]) => route), ...articleMap.map(([, , route]) => route)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
