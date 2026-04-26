// Flits — browser-language i18n (en / de / zh)
(function () {
  function localeFromPath() {
    var first = (window.location.pathname || '').split('/')[1];
    if (first === 'de') return 'de';
    if (first === 'zh') return 'zh';
    return null;
  }

  function detectLocale() {
    if (window.FlitsLocaleOverride === 'de') return 'de';
    if (window.FlitsLocaleOverride === 'zh') return 'zh';

    var pathLocale = localeFromPath();
    if (pathLocale) return pathLocale;

    var langs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++) {
      var lang = (langs[i] || '').toLowerCase().replace(/_/g, '-').split('-')[0];
      if (lang === 'de') return 'de';
      if (lang === 'zh') return 'zh';
    }
    return 'en';
  }

  var TRANSLATIONS = {
    en: {
      'nav.index':     'Index',
      'nav.thesis':    'Thesis',
      'nav.principal': 'Principal',
      'nav.contact':   'Contact',
      'nav.ventures':  'Ventures',
      'nav.notes':     'Notes',
      'footer.legal':   'legal',
      'footer.privacy': 'privacy',
      'home.eyebrow': 'Holding ambition',
      'home.tagline': 'Building, backing and keeping a family of digital products, systems, and assets.',
      'home.sub':     'Est. MMXXIII — patient capital, permanent homes.',
      'article.back':   'Back',
      'error.load':    'Could not load content.',
      'error.article': 'Could not load article.'
    },
    de: {
      'nav.index':     'Index',
      'nav.thesis':    'Thesis',
      'nav.principal': 'Leitung',
      'nav.contact':   'Kontakt',
      'nav.ventures':  'Ventures',
      'nav.notes':     'Notizen',
      'footer.legal':   'impressum',
      'footer.privacy': 'privacy',
      'home.eyebrow': 'Langfristig gedacht',
      'home.tagline': 'Flits entwickelt, hält und begleitet digitale Produkte, Systeme und Beteiligungen.',
      'home.sub':     'Est. MMXXIII — mit Geduld gebaut, auf Dauer angelegt.',
      'article.back':   'Zurück',
      'error.load':    'Inhalt konnte nicht geladen werden.',
      'error.article': 'Artikel konnte nicht geladen werden.'
    },
    zh: {
      'nav.index':     '目录',
      'nav.thesis':    '理念',
      'nav.principal': '负责人',
      'nav.contact':   '联系',
      'nav.ventures':  '企业',
      'nav.notes':     '笔记',
      'footer.legal':   '法律',
      'footer.privacy': '隐私',
      'home.eyebrow': '承载雄心',
      'home.tagline': '构建、投资并守护一系列数字产品、系统和资产。',
      'home.sub':     '成立于 MMXXIII — 耐心资本，永久归宿。',
      'article.back':   '返回',
      'error.load':    '无法加载内容。',
      'error.article': '无法加载文章。'
    }
  };

  var locale = detectLocale();
  var strings = TRANSLATIONS[locale] || TRANSLATIONS.en;

  function t(key) {
    return strings[key] || TRANSLATIONS.en[key] || key;
  }

  window.FlitsLocale = locale;
  window.FlitsT = t;

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n'));
      if (val) el.textContent = val;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }
})();
