// Flits — page transitions
// Intercept internal link clicks, play a short leave animation, then navigate.
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var LEAVE_MS = 240;

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

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a');
    if (!a || !isInternal(a)) return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    var href = a.href;
    setTimeout(function () { window.location.href = href; }, LEAVE_MS);
  });

  // When coming back via bfcache, clear the leaving state so pages don't appear dimmed.
  window.addEventListener('pageshow', function () {
    document.body.classList.remove('is-leaving');
  });
})();
