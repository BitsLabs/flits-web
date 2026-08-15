/* Flits — header state, slide-over menu, search overlay */
(function () {
  var header = document.querySelector('.site-header');
  var menu = document.getElementById('menu');
  var search = document.getElementById('search');
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');

  /* ---- header background once scrolled ---- */
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var lock = function (on) {
    document.body.classList.toggle('is-locked', on);
  };

  var toggle = function (panel, triggers, open) {
    if (!panel) return;
    panel.setAttribute('data-open', open ? 'true' : 'false');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    for (var i = 0; i < triggers.length; i++) {
      triggers[i].setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    lock(open);
  };

  /* ---- menu ---- */
  var menuBtns = document.querySelectorAll('[data-menu]');
  var menuClose = document.querySelectorAll('[data-menu-close]');

  var setMenu = function (open) {
    toggle(menu, menuBtns, open);
    if (open && menuClose[0]) menuClose[0].focus();
  };

  Array.prototype.forEach.call(menuBtns, function (b) {
    b.addEventListener('click', function () { setMenu(true); });
  });
  Array.prototype.forEach.call(menuClose, function (b) {
    b.addEventListener('click', function () { setMenu(false); });
  });
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }

  /* ---- search ---- */
  var INDEX = [
    { title: 'Flits', kind: 'Home', url: '/', text: 'holding company digital products software portfolio patient capital est 2023 germany united kingdom' },
    { title: 'What Flits holds', kind: 'Holdings', url: '/#holdings', text: 'mobile apps stealth ventures b2b software digital assets domains investments minority stakes' },
    { title: 'Manuel Asbeck', kind: 'Principal', url: '/principal', text: 'founder managing director munich london information systems tu munich sole shareholder' },
    { title: 'Flits Notes', kind: 'Journal', url: '/notes', text: 'writing notes holding companies patience quiet software journal' },
    { title: 'Domains as Options', kind: 'Note · July 2026', url: '/notes/domains-as-options', text: 'domains options renewals premium names registry asymmetry portfolio' },
    { title: 'Founding Flits', kind: 'Note · June 2025', url: '/notes/founding-flits', text: 'founding holding company thesis slow strategy discounted cash flow venture fund studio agency' },
    { title: 'Privacy Policy', kind: 'Legal', url: '/privacy', text: 'privacy gdpr ccpa data trout ug apps services cookies retention' },
    { title: 'Imprint & Legal Notice', kind: 'Legal', url: '/legal', text: 'imprint impressum tmg trout ug flits ltd vat registration companies house' }
  ];

  var render = function (query) {
    if (!results) return;
    var q = query.trim().toLowerCase();
    var hits = q
      ? INDEX.filter(function (item) {
          return (item.title + ' ' + item.kind + ' ' + item.text).toLowerCase().indexOf(q) > -1;
        })
      : INDEX;

    if (!hits.length) {
      results.innerHTML = '<p class="search__empty">No results for “' +
        q.replace(/[<>&]/g, '') + '”.</p>';
      return;
    }

    results.innerHTML = hits.map(function (item) {
      return '<a href="' + item.url + '"><h2>' + item.title + '</h2><p>' + item.kind + '</p></a>';
    }).join('');
  };

  var searchBtns = document.querySelectorAll('[data-search]');
  var searchClose = document.querySelectorAll('[data-search-close]');

  var setSearch = function (open) {
    toggle(search, searchBtns, open);
    if (open) {
      render('');
      if (input) { input.value = ''; input.focus(); }
    }
  };

  Array.prototype.forEach.call(searchBtns, function (b) {
    b.addEventListener('click', function () { setSearch(true); });
  });
  Array.prototype.forEach.call(searchClose, function (b) {
    b.addEventListener('click', function () { setSearch(false); });
  });
  if (input) {
    input.addEventListener('input', function () { render(input.value); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (menu && menu.getAttribute('data-open') === 'true') setMenu(false);
    if (search && search.getAttribute('data-open') === 'true') setSearch(false);
  });
})();
