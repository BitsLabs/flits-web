// Flits - Markdown-backed subpages
(function () {
  var CDN = {
    markdownIt: 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js',
    footnote: 'https://cdn.jsdelivr.net/npm/markdown-it-footnote@4.0.0/dist/markdown-it-footnote.min.js',
    taskLists: 'https://cdn.jsdelivr.net/npm/markdown-it-task-lists@2.1.1/dist/markdown-it-task-lists.min.js',
    texmath: 'https://cdn.jsdelivr.net/npm/markdown-it-texmath@1.0.0/texmath.min.js',
    katexJs: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    katexCss: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
  };

  var siteRoot = new URL('../', document.currentScript ? document.currentScript.src : window.location.href);
  var scriptPromises = {};
  var parserPromise;
  var textCache = new Map();
  var jsonCache = new Map();
  var contentPages = [
    'content/index-ventures.md',
    'content/contact.md',
    'content/ventures.md',
    'content/notes.md',
    'content/thesis.md',
    'content/principal.md',
    'content/legal.md',
    'content/privacy.md',
    'content/support.md'
  ];

  function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return scriptPromises[src];
  }

  function loadStyle(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseFrontMatter(source) {
    var match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    var data = {};
    var body = source;

    if (match) {
      body = source.slice(match[0].length);
      match[1].split(/\r?\n/).forEach(function (line) {
        var pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!pair) return;
        data[pair[1]] = pair[2].trim();
      });
    }

    return { data: data, body: body };
  }

  function resolveUrl(path, base) {
    return new URL(path, base || window.location.href).href;
  }

  function fetchText(url) {
    var key = resolveUrl(url);
    if (!textCache.has(key)) {
      textCache.set(key, fetch(key, { credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('Fetch failed: ' + res.status);
          return res.text();
        })
        .catch(function (error) {
          textCache.delete(key);
          throw error;
        }));
    }
    return textCache.get(key);
  }

  function fetchJson(url) {
    var key = resolveUrl(url);
    if (!jsonCache.has(key)) {
      jsonCache.set(key, fetch(key, { credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('JSON fetch failed: ' + res.status);
          return res.json();
        })
        .catch(function (error) {
          jsonCache.delete(key);
          throw error;
        }));
    }
    return jsonCache.get(key);
  }

  function localMarkdown(source) {
    var lines = source.replace(/\r\n/g, '\n').split('\n');
    var html = [];
    var paragraph = [];
    var list = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push('<p>' + inline(paragraph.join(' ')) + '</p>');
      paragraph = [];
    }

    function flushList() {
      if (!list) return;
      html.push('</' + list + '>');
      list = null;
    }

    function inline(text) {
      return escapeHtml(text)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    function tableAt(index) {
      if (!lines[index + 1] || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) return null;
      var rows = [];
      var cursor = index;
      while (lines[cursor] && lines[cursor].indexOf('|') !== -1) {
        if (cursor !== index + 1) {
          rows.push(lines[cursor].trim().replace(/^\||\|$/g, '').split('|').map(function (cell) {
            return inline(cell.trim());
          }));
        }
        cursor += 1;
      }
      return { rows: rows, end: cursor };
    }

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var table = tableAt(i);
      if (table) {
        flushParagraph();
        flushList();
        var head = table.rows.shift() || [];
        html.push('<table><thead><tr>' + head.map(function (cell) { return '<th>' + cell + '</th>'; }).join('') + '</tr></thead><tbody>');
        table.rows.forEach(function (row) {
          html.push('<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>');
        });
        html.push('</tbody></table>');
        i = table.end - 1;
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }
      if (/^#{1,6}\s+/.test(line)) {
        flushParagraph();
        flushList();
        var depth = line.match(/^#+/)[0].length;
        html.push('<h' + depth + '>' + inline(line.replace(/^#{1,6}\s+/, '')) + '</h' + depth + '>');
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        flushParagraph();
        if (list !== 'ul') {
          flushList();
          list = 'ul';
          html.push('<ul>');
        }
        html.push('<li>' + inline(line.replace(/^\s*[-*]\s+/, '')) + '</li>');
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        flushParagraph();
        if (list !== 'ol') {
          flushList();
          list = 'ol';
          html.push('<ol>');
        }
        html.push('<li>' + inline(line.replace(/^\s*\d+\.\s+/, '')) + '</li>');
        continue;
      }
      paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return html.join('\n');
  }

  function getParser() {
    if (parserPromise) return parserPromise;

    loadStyle(CDN.katexCss);
    parserPromise = loadScript(CDN.markdownIt).then(function () {
      var md = window.markdownit({
        html: true,
        linkify: true,
        typographer: true,
        breaks: false
      });

      return Promise.allSettled([
        loadScript(CDN.footnote),
        loadScript(CDN.taskLists),
        loadScript(CDN.katexJs).then(function () { return loadScript(CDN.texmath); })
      ]).then(function () {
        if (window.markdownitFootnote) md.use(window.markdownitFootnote);
        if (window.markdownitTaskLists) md.use(window.markdownitTaskLists, { enabled: true });
        if (window.texmath && window.katex) {
          md.use(window.texmath, {
            engine: window.katex,
            delimiters: 'dollars',
            katexOptions: { throwOnError: false }
          });
        }

        return function (source) { return md.render(source); };
      });
    }).catch(function () {
      return localMarkdown;
    });

    return parserPromise;
  }

  function setHtml(selector, value, root) {
    var node = root.querySelector(selector);
    if (node && value) node.innerHTML = value;
  }

  function setText(selector, value, root) {
    var node = root.querySelector(selector);
    if (node && value) node.textContent = value;
  }

  function rewriteRelativeUrls(root, baseUrl) {
    root.querySelectorAll('img[src], a[href]').forEach(function (node) {
      var attr = node.tagName.toLowerCase() === 'img' ? 'src' : 'href';
      var value = node.getAttribute(attr);
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(value)) return;
      node.setAttribute(attr, resolveUrl(value, baseUrl));
    });
  }

  function articleSlug(path) {
    return path.split('/').pop().replace(/\.md$/i, '');
  }

  function articlePageHref(path) {
    return '/pages/notes/' + articleSlug(path);
  }

  function fallbackBackHref() {
    return '/pages/notes';
  }

  function articleBackHref() {
    var fallback = fallbackBackHref();
    try {
      var key = 'flits:return:' + window.location.pathname.replace(/\.html?$/i, '');
      var stored = window.sessionStorage && window.sessionStorage.getItem(key);
      if (stored) return stored;

      if (document.referrer) {
        var referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin && referrer.href !== window.location.href) {
          if (/\/Flits(?:\.html)?$/i.test(referrer.pathname)) referrer.pathname = '/';
          referrer.pathname = referrer.pathname.replace(/\.html?$/i, '');
          return referrer.href;
        }
      }
    } catch (e) {}
    return fallback;
  }

  function updateArticleBackLinks(root) {
    root.querySelectorAll('[data-article-back]').forEach(function (link) {
      link.setAttribute('href', articleBackHref());
    });
  }

  function backArrow() {
    return '<span class="arrow"><svg viewBox="0 0 20 8" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" shape-rendering="geometricPrecision"><path d="M1 4 L20 4 M1 4 L5 0.5 M1 4 L5 7.5"/></svg></span>';
  }

  function renderArticleIndex(section, body, parsed, mdUrl) {
    var manifestUrl = resolveUrl(parsed.data.articles, mdUrl);

    return fetchJson(manifestUrl)
      .then(function (paths) {
        return Promise.all(paths.map(function (path) {
          var url = resolveUrl(path, manifestUrl);
          return fetchText(url)
            .then(function (source) {
              var article = parseFrontMatter(source);
              return {
                url: url,
                href: articlePageHref(path),
                slug: articleSlug(path),
                title: article.data.title || articleSlug(path),
                date: article.data.date || '',
                excerpt: article.data.excerpt || '',
                hasBody: article.body.trim().length > 0
              };
            });
        }));
      })
      .then(function (articles) {
        body.innerHTML = '<div class="notes">' + articles.map(function (article) {
          var title = article.hasBody
            ? '<a class="title" href="' + escapeHtml(article.href) + '">' + escapeHtml(article.title) + '</a>'
            : '<span class="title">' + escapeHtml(article.title) + '</span>';
          return '<article>' +
            '<span class="date">' + escapeHtml(article.date) + '</span>' +
            '<div>' + title +
            '<div class="excerpt">' + escapeHtml(article.excerpt) + '</div></div>' +
            '</article>';
        }).join('') + '</div>';
      });
  }

  function renderArticle(section, url, isolated, updateTitle) {
    var body = section.querySelector('.markdown-body');
    if (!body) return Promise.resolve();

    if (section.dataset.loadedArticle === url && body.innerHTML.trim()) {
      updateArticleBackLinks(section);
      return Promise.resolve();
    }

    section.dataset.loadedArticle = url;

    body.setAttribute('aria-busy', 'true');

    return fetchText(url)
      .then(function (source) {
        var parsed = parseFrontMatter(source);
        if (updateTitle !== false && parsed.data.title) document.title = parsed.data.title + ' - Flits';
        return getParser().then(function (render) {
          body.innerHTML = '<article class="article">' +
            '<a class="article-back" href="' + escapeHtml(articleBackHref()) + '" data-article-back>' + backArrow() + (isolated ? 'Back' : 'Notes') + '</a>' +
            '<div class="date">' + escapeHtml(parsed.data.date || '') + '</div>' +
            '<h2>' + escapeHtml(parsed.data.title || '') + '</h2>' +
            render(parsed.body) +
            '</article>';
          body.removeAttribute('aria-busy');
          rewriteRelativeUrls(body, url);
          enhanceTables(section);
        });
      })
      .catch(function (error) {
        body.removeAttribute('aria-busy');
        body.innerHTML = '<p class="error">Could not load article.</p>';
        section.dataset.loadedArticle = '';
        if (window.console) console.error(error);
      });
  }

  function loadArticlePage(section) {
    var mdUrl = resolveUrl(section.dataset.articleMd, window.location.href);
    return renderArticle(section, mdUrl, true, true);
  }

  function enhanceTables(root) {
    root.querySelectorAll('.markdown-body table').forEach(function (table) {
      var headers = Array.from(table.querySelectorAll('thead th')).map(function (th) {
        return th.textContent.trim().toLowerCase();
      });

      if (headers.join('|') === '#|name|description|status') {
        table.classList.add('md-ledger');
        table.querySelectorAll('tbody tr').forEach(function (row) {
          var status = row.cells[3] && row.cells[3].textContent.trim().toLowerCase();
          if (status === 'operating' || /^since\b/.test(status)) row.classList.add('active');
        });
      }

      if (headers.join('|') === 'date|title|excerpt') {
        table.classList.add('md-notes');
      }

      if (headers.join('|') === 'channel|details') {
        table.classList.add('md-contact');
      }
      });
  }

  function renderPageSection(section, baseUrl, updateTitle) {
    if (section.dataset.loaded === section.dataset.md) return Promise.resolve();
    section.dataset.loaded = section.dataset.md;

    var body = section.querySelector('.markdown-body');
    if (!body) return Promise.resolve();

    body.setAttribute('aria-busy', 'true');

    var mdUrl = resolveUrl(section.dataset.md, baseUrl);

    return fetchText(mdUrl)
      .then(function (source) {
        var parsed = parseFrontMatter(source);
        setText('.kicker', parsed.data.kicker, section);
        setHtml('h1', parsed.data.heading, section);
        setText('.side .intro', parsed.data.intro, section);
        setText('.side .aside', parsed.data.aside, section);
        if (updateTitle && parsed.data.title) document.title = parsed.data.title + ' - Flits';

        if (parsed.data.articles) {
          return renderArticleIndex(section, body, parsed, mdUrl).then(function () {
            body.removeAttribute('aria-busy');
          });
        }

        return getParser().then(function (render) {
          body.innerHTML = render(parsed.body);
          body.removeAttribute('aria-busy');
          rewriteRelativeUrls(body, mdUrl);
          enhanceTables(section);
        });
      })
      .catch(function (error) {
        body.removeAttribute('aria-busy');
        body.innerHTML = '<p class="error">Could not load Markdown content.</p>';
        section.dataset.loaded = '';
        if (window.console) console.error(error);
      });
  }

  function loadPage(section) {
    return renderPageSection(section, window.location.href, true);
  }

  function preloadPageContent(path) {
    var mdUrl = resolveUrl(path, siteRoot);
    return fetchText(mdUrl)
      .then(function (source) {
        var parsed = parseFrontMatter(source);
        if (!parsed.data.articles) return null;
        var manifestUrl = resolveUrl(parsed.data.articles, mdUrl);
        return fetchJson(manifestUrl).then(function (articles) {
          return Promise.all(articles.map(function (articlePath) {
            return fetchText(resolveUrl(articlePath, manifestUrl));
          }));
        });
      })
      .catch(function () {});
  }

  window.FlitsMarkdownInit = function () {
    return Promise.all(
      Array.from(document.querySelectorAll('[data-md]')).map(loadPage)
        .concat(Array.from(document.querySelectorAll('[data-article-md]')).map(loadArticlePage))
    );
  };

  window.FlitsMarkdownHydrateMain = function (html, pageUrl) {
    var doc = new DOMParser().parseFromString('<main>' + html + '</main>', 'text/html');
    var main = doc.querySelector('main');
    return Promise.all(
      Array.from(main.querySelectorAll('[data-md]')).map(function (section) {
        return renderPageSection(section, pageUrl, false);
      }).concat(Array.from(main.querySelectorAll('[data-article-md]')).map(function (section) {
        return renderArticle(section, resolveUrl(section.dataset.articleMd, pageUrl), true, false);
      }))
    ).then(function () {
      return main.innerHTML;
    });
  };

  window.FlitsMarkdownPreloadAll = function () {
    getParser().catch(function () {});
    return Promise.all(contentPages.map(preloadPageContent));
  };

  document.addEventListener('click', function (event) {
    var index = event.target.closest && event.target.closest('[data-article-index]');
    if (index) {
      var page = index.closest('[data-md]');
      if (!page) return;
      event.preventDefault();
      page.dataset.loaded = '';
      loadPage(page);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.FlitsMarkdownPreloadAll();
      window.FlitsMarkdownInit();
    });
  } else {
    window.FlitsMarkdownPreloadAll();
    window.FlitsMarkdownInit();
  }
})();
