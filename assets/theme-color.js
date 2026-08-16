/* Flits — browser chrome colour

   One <meta name="theme-color">, written from the canvas the stylesheet is
   actually painting. Media-scoped theme-color tags are not dependable:
   Safari takes the first tag in document order and ignores the media
   attribute, so a light tag ends up tinting the status bar of a dark page.
   Reading the computed background instead keeps the two in step by
   construction, and re-reading it on a scheme change follows the device. */
(function () {
  if (!window.matchMedia) return;

  /* only used if the stylesheet has not applied — mirrors --bg */
  var FALLBACK_DARK = '#000000';
  var FALLBACK_LIGHT = '#ffffff';

  var query = window.matchMedia('(prefers-color-scheme: dark)');

  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }

  var canvas = function () {
    var bg = getComputedStyle(document.documentElement).backgroundColor;
    var parts = bg && bg.match(/^rgba?\(([^)]+)\)$/);
    /* alpha is undefined for rgb(), so this is only 0 for a transparent rgba() */
    var alpha = parts ? parseFloat(parts[1].split(',')[3]) : NaN;

    /* no colour yet, or see-through — fall back to the device preference */
    if (!parts || alpha === 0) {
      return query.matches ? FALLBACK_DARK : FALLBACK_LIGHT;
    }
    return bg;
  };

  var sync = function () {
    meta.setAttribute('content', canvas());
  };

  /* once for the first paint — the stylesheet may still be in flight, in
     which case this lands on the fallback — then again once it has applied */
  sync();
  window.addEventListener('load', sync);

  if (query.addEventListener) query.addEventListener('change', sync);
  else if (query.addListener) query.addListener(sync);
})();
