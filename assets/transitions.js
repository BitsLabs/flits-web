// Flits — page transitions
// Intercept internal link clicks, fetch the next document, and swap only <main>.
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var LEAVE_MS = reduceMotion ? 0 : 240;
  var siteRoot = new URL('../', document.currentScript ? document.currentScript.src : window.location.href);
  var cache = new Map();
  var navigating = false;

  function isInternal(a) {
    if (!a || !a.href) return false;
    if (a.target && a.target !== '' && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    var url;
    try { url = new URL(a.href, window.location.href); } catch (e) { return false; }
    if (url.origin !== window.location.origin) return false;
    // only .html (or no extension) — skip mailto, #hash on same page, assets
    if (url.pathname === window.location.pathname && url.hash) return false;
    if (a.protocol === 'mailto:' || a.protocol === 'tel:') return false;
    if (!/\.html?$/i.test(url.pathname) && url.pathname !== '/') return false;
    return true;
  }

  function samePage(url) {
    return url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      url.hash === window.location.hash;
  }

  function isNotesArticle(url) {
    return /\/pages\/notes\/[^/]+\.html$/i.test(url.pathname);
  }

  function rememberReturnTarget(url) {
    if (!isNotesArticle(url)) return;
    try {
      window.sessionStorage.setItem('flits:return:' + url.pathname, window.location.href);
    } catch (e) {}
  }

  function linkUrl(a) {
    var raw = a.getAttribute('href') || '';
    if (/^(pages\/|\.\/pages\/|Flits\.html$|\.\/Flits\.html$)/.test(raw)) {
      return new URL(raw.replace(/^\.\//, ''), siteRoot);
    }
    return new URL(a.href, window.location.href);
  }

  function parsePage(html, url) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var main = doc.querySelector('main');
    if (!main) throw new Error('No <main> found in fetched page.');
    var title = doc.querySelector('title') ? doc.querySelector('title').textContent : document.title;
    var mainHtml = main.innerHTML;

    if (window.FlitsMarkdownHydrateMain) {
      return window.FlitsMarkdownHydrateMain(mainHtml, url.href).then(function (hydratedMain) {
        return { title: title, main: hydratedMain };
      });
    }

    return Promise.resolve({ title: title, main: mainHtml });
  }

  function fetchPage(url) {
    var key = url.href;
    if (!cache.has(key)) {
      cache.set(key, fetch(key, { credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('Page fetch failed: ' + res.status);
          return res.text();
        })
        .then(function (html) {
          return parsePage(html, url);
        })
        .catch(function (error) {
          cache.delete(key);
          throw error;
        }));
    }
    return cache.get(key);
  }

  function preloadInternalLinks() {
    window.setTimeout(function () {
      document.querySelectorAll('a[href]').forEach(function (a) {
        if (!isInternal(a)) return;
        try {
          var url = linkUrl(a);
          if (!samePage(url)) fetchPage(url).catch(function () {});
        } catch (e) {}
      });
    }, 0);
  }

  function settleMain() {
    if (window.FlitsOrreryInit) window.FlitsOrreryInit();
    if (window.FlitsMarkdownInit) window.FlitsMarkdownInit();
    document.body.classList.remove('is-leaving', 'is-navigating');
    navigating = false;
  }

  function updateActiveLinks() {
    document.querySelectorAll('.nav a').forEach(function (a) {
      try {
        a.classList.toggle('active', linkUrl(a).pathname === window.location.pathname);
      } catch (e) {
        a.classList.remove('active');
      }
    });
  }

  function swapTo(url, options) {
    if (navigating) return;
    navigating = true;
    options = options || {};

    document.body.classList.add('is-navigating');

    fetchPage(url).then(function (page) {
      var currentMain = document.querySelector('main');
      if (!currentMain) {
        window.location.href = url.href;
        return;
      }

      document.body.classList.add('is-leaving');
      setTimeout(function () {
        if (window.FlitsOrreryDestroy) window.FlitsOrreryDestroy();
        currentMain.innerHTML = page.main;
        document.title = page.title;

        if (options.replace) {
          window.history.replaceState({ flits: true }, page.title, url.href);
        } else {
          window.history.pushState({ flits: true }, page.title, url.href);
        }

        updateActiveLinks();
        preloadInternalLinks();
        window.requestAnimationFrame(settleMain);
      }, LEAVE_MS);
    }).catch(function () {
      window.location.href = url.href;
    });
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a');
    if (!a || !isInternal(a)) return;
    var url = linkUrl(a);
    if (samePage(url)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    rememberReturnTarget(url);
    swapTo(url);
  });

  document.addEventListener('mouseover', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || !isInternal(a)) return;
    fetchPage(linkUrl(a)).catch(function () {});
  });

  document.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || !isInternal(a)) return;
    fetchPage(linkUrl(a)).catch(function () {});
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadInternalLinks);
  } else {
    preloadInternalLinks();
  }

  window.addEventListener('popstate', function () {
    swapTo(new URL(window.location.href), { replace: true });
  });

  // When coming back via bfcache, clear the leaving state so pages don't appear dimmed.
  window.addEventListener('pageshow', function () {
    document.body.classList.remove('is-leaving', 'is-navigating');
    navigating = false;
    preloadInternalLinks();
  });
})();
