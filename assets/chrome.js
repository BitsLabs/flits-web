// Flits - shared header and footer
(function () {
  function canonicalPath(path) {
    if (!path || path === '/Flits' || path === '/Flits.html') return '/';
    return path.replace(/\.html?$/i, '');
  }

  function isActive(href) {
    try {
      return canonicalPath(new URL(href, window.location.origin).pathname) === canonicalPath(window.location.pathname);
    } catch (e) {
      return false;
    }
  }

  function navLink(href, label) {
    return '<a href="' + href + '"' + (isActive(href) ? ' class="active"' : '') + '>' + label + '</a>';
  }

  function renderHeader() {
    return '<header>' +
      '<a class="brand" href="/">' +
        '<img class="logo" src="/assets/flits-logo.png" alt="Flits" width="20" height="20" style="height:20px;width:20px;display:block;" />' +
        '<span class="name">Flits</span>' +
      '</a>' +
      '<nav class="nav"><div class="links">' +
        navLink('/index-ventures', 'Index') +
        navLink('/thesis', 'Thesis') +
        navLink('/principal', 'Principal') +
        navLink('/contact', 'Contact') +
      '</div></nav>' +
    '</header>';
  }

  function renderFooter() {
    return '<footer>' +
      '<div class="meta">' +
        '<span>&copy; 2026 Flits</span>' +
      '</div>' +
      '<div class="tickers">' +
        '<a href="/index-ventures">index</a>' +
        '<a href="/legal">legal</a>' +
        '<a href="/privacy">privacy</a>' +
        '<a href="https://www.linkedin.com/company/flitsco">in</a>' +
      '</div>' +
    '</footer>';
  }

  function init() {
    var shell = document.querySelector('.shell');
    if (!shell) return;
    if (!shell.querySelector('header')) shell.insertAdjacentHTML('afterbegin', renderHeader());
    if (!shell.querySelector('footer')) shell.insertAdjacentHTML('beforeend', renderFooter());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
