/* Flits — header state, slide-over menu */
(function () {
  var header = document.querySelector('.site-header');
  var menu = document.getElementById('menu');

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

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (menu && menu.getAttribute('data-open') === 'true') setMenu(false);
  });
})();
