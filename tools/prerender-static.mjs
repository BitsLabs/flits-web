import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://flits.cc';
const pageMap = [
  ['index-ventures.html', 'content/index-ventures.md', '/index-ventures'],
  ['contact.html', 'content/contact.md', '/contact'],
  ['ventures.html', 'content/ventures.md', '/ventures'],
  ['notes.html', 'content/notes.md', '/notes'],
  ['thesis.html', 'content/thesis.md', '/thesis'],
  ['principal.html', 'content/principal.md', '/principal'],
  ['legal.html', 'content/legal.md', '/legal'],
  ['privacy.html', 'content/privacy.md', '/privacy'],
  ['support.html', 'content/support.md', '/support']
];

const articlePaths = JSON.parse(read('content/articles.json'));
const articleMap = articlePaths.map((mdPath) => {
  const slug = path.basename(mdPath, '.md');
  return [`notes/${slug}.html`, path.join('content', mdPath), `/notes/${slug}`];
});

const homeLocales = {
  zh: {
    file: 'zh.html',
    route: '/zh',
    title: 'Flits - 年轻公司的长期归宿',
    description: 'Flits 构建、投资并长期守护一系列数字产品、系统和资产。',
    strings: {
      'nav.index': '目录',
      'nav.ventures': '企业',
      'nav.thesis': '理念',
      'nav.notes': '笔记',
      'home.eyebrow': '承载雄心',
      'home.tagline': '构建、投资并守护一系列数字产品、系统和资产。',
      'home.sub': '成立于 MMXXIII — 耐心资本，永久归宿。'
    }
  }
};

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content);
}

function relativeUrl(fromFile, toFile) {
  return path.relative(path.dirname(fromFile), toFile).replace(/\\/g, '/') || path.basename(toFile);
}

function normalizeAssetUrls(html, htmlPath) {
  const assetPath = relativeUrl(htmlPath, 'assets');
  return html.replace(/((?:href|src)=["'])(?:\.\/)?(?:\.\.\/)*assets\//g, `$1${assetPath}/`);
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

function applyStaticTranslations(html, strings) {
  return html.replace(/(<([A-Za-z0-9]+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (match, open, tag, key, body, close) => {
    if (!Object.prototype.hasOwnProperty.call(strings, key)) return match;
    return `${open}${escapeHtml(strings[key])}${close}`;
  });
}

function renderHomeLocale(locale, config) {
  let html = normalizeAssetUrls(read('index.html'), config.file);
  html = applyStaticTranslations(html, config.strings)
    .replace(/<html lang="[^"]*">/, `<html lang="${locale}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(config.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeAttr(config.description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${siteUrl}${config.route}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeAttr(config.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeAttr(config.description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${siteUrl}${config.route}">`)
    .replace('<script src="assets/i18n.js', `<script>window.FlitsLocaleOverride='${locale}';</script>\n<script src="assets/i18n.js`);
  write(config.file, html);
}

function renderPage(htmlPath, mdPath, route) {
  const parsed = parseFrontMatter(read(mdPath));
  let html = normalizeAssetUrls(read(htmlPath), htmlPath);
  let bodyHtml;

  if (parsed.data.articles) {
    const notes = articlePaths.map((articlePath) => {
      const article = parseFrontMatter(read(path.join('content', articlePath)));
      const slug = path.basename(articlePath, '.md');
      return '<article>' +
        `<span class="date">${escapeHtml(article.data.date || '')}</span>` +
        '<div>' +
        `<a class="title" href="/notes/${slug}">${escapeHtml(article.data.title || slug)}</a>` +
        `<div class="excerpt">${escapeHtml(article.data.excerpt || '')}</div>` +
        '</div>' +
        '</article>';
    }).join('');
    bodyHtml = `<div class="notes">${notes}</div>`;
  } else {
    bodyHtml = enhanceStaticTables(renderMarkdown(parsed.body));
  }

  html = html
    .replace(/data-md="[^"]*"/, `data-md="${relativeUrl(htmlPath, mdPath)}"`)
    .replace(/<div class="kicker">[\s\S]*?<\/div>/, `<div class="kicker">${escapeHtml(parsed.data.kicker || '')}</div>`)
    .replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${parsed.data.heading || escapeHtml(parsed.data.title || '')}</h1>`)
    .replace(/<p class="intro">[\s\S]*?<\/p>/, `<p class="intro">${escapeHtml(parsed.data.intro || '')}</p>`)
    .replace(/<p class="aside">[\s\S]*?<\/p>/, `<p class="aside">${escapeHtml(parsed.data.aside || '')}</p>`)
    .replace(/<div class="body markdown-body">[\s\S]*?<\/div>\s*<\/section>/, `<div class="body markdown-body">\n${normalizeAssetUrls(bodyHtml, htmlPath)}\n      </div>\n    </section>`);

  write(htmlPath, upsertHead(html, route, parsed));
}

function renderArticle(htmlPath, mdPath, route) {
  const parsed = parseFrontMatter(read(mdPath));
  let html = normalizeAssetUrls(read(htmlPath), htmlPath);
  const title = escapeHtml(parsed.data.title || '');
  const bodyHtml = '<article class="article">' +
    '<a class="article-back" href="/notes" data-article-back><span class="arrow"><svg viewBox="0 0 20 8" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" shape-rendering="geometricPrecision"><path d="M1 4 L20 4 M1 4 L5 0.5 M1 4 L5 7.5"/></svg></span>Back</a>' +
    `<div class="date">${escapeHtml(parsed.data.date || '')}</div>` +
    `<h2>${title}</h2>` +
    renderMarkdown(parsed.body) +
    '</article>';

  html = html
    .replace(/data-article-md="[^"]*"/, `data-article-md="${relativeUrl(htmlPath, mdPath)}"`)
    .replace(/<div class="body markdown-body">[\s\S]*?<\/div>\s*<\/section>/, `<div class="body markdown-body">\n${normalizeAssetUrls(bodyHtml, htmlPath)}\n      </div>\n    </section>`);
  write(htmlPath, upsertHead(html, route, parsed));
}

pageMap.forEach(([htmlPath, mdPath, route]) => renderPage(htmlPath, mdPath, route));
articleMap.forEach(([htmlPath, mdPath, route]) => renderArticle(htmlPath, mdPath, route));
Object.entries(homeLocales).forEach(([locale, config]) => renderHomeLocale(locale, config));

const routes = ['/', ...Object.values(homeLocales).map(({ route }) => route), ...pageMap.map(([, , route]) => route), ...articleMap.map(([, , route]) => route)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
