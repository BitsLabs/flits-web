/* Flits — line charts for notes.

   Usage in a note:

     <link rel="stylesheet" href="/assets/chart.css?v=1">      (in <head>)
     <script src="/assets/chart.js?v=1" defer></script>        (before </body>)

     <figure class="chart">
       <script type="application/json">
       {
         "title": "...",
         "subtitle": "...",
         "x": { "label": "Years", "ticks": [0, 2, 4, 6, 8, 10], "format": "number" },
         "y": { "min": 0, "max": 1, "ticks": [0, 0.25, 0.5, 0.75, 1], "format": "percent" },
         "series": [ { "name": "q = 5%", "points": [[0, 1], [1, 0.95]] } ]
       }
       </script>
       <figcaption>...</figcaption>
     </figure>

   A <script type="application/json"> is inert markup, so the data sits next to
   the figure without a build step and without executing.

   Four series maximum. The categorical palette is assigned in fixed order and
   never cycled; a fifth series would need folding together or faceting into two
   charts instead.

   On label collisions: where lines converge at the right edge, labels are moved
   apart and a leader line connects each one back to its own line end, rather
   than letting them overlap or silently stacking them somewhere detached from
   the data. That is the failure this component exists to avoid. */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var MAX_SERIES = 4;

  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, String(attrs[k]));
    if (text != null) n.textContent = text;
    return n;
  }

  function html(name, cls, text) {
    var n = document.createElement(name);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmt(v, kind) {
    if (kind === 'percent') {
      var p = v * 100;
      return (Math.abs(p) < 10 && p % 1 !== 0 ? p.toFixed(1) : Math.round(p)) + '%';
    }
    if (kind === 'currency') return '$' + Math.round(v).toLocaleString('en-US');
    if (Math.abs(v) >= 1000) return v.toLocaleString('en-US');
    return String(Math.round(v * 100) / 100);
  }

  /** Evenly spaced ticks over a range, used when a chart does not name its own. */
  function ticksFor(min, max, count) {
    var out = [], i;
    for (i = 0; i <= count; i++) out.push(min + ((max - min) * i) / count);
    return out;
  }

  /**
   * Push labels apart so none overlap, keeping each as close to its line end as
   * the spacing allows. Sweep down, then back up off the bottom edge, then
   * clamp. Whatever movement is left over gets a leader line, so a label that
   * had to travel still reads as belonging to its own series.
   */
  function resolveLabels(items, gap, top, bottom) {
    items.sort(function (a, b) { return a.want - b.want; });
    var i;
    for (i = 0; i < items.length; i++) {
      items[i].y = items[i].want;
      if (i > 0 && items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
    }
    var overflow = items.length ? items[items.length - 1].y - bottom : 0;
    if (overflow > 0) {
      for (i = items.length - 1; i >= 0; i--) {
        items[i].y -= overflow;
        if (i < items.length - 1 && items[i + 1].y - items[i].y < gap) {
          items[i].y = items[i + 1].y - gap;
        }
      }
    }
    for (i = 0; i < items.length; i++) items[i].y = Math.max(top, items[i].y);
    return items;
  }

  function build(fig, spec) {
    var series = spec.series.slice(0, MAX_SERIES);
    var xSpec = spec.x || {};
    var ySpec = spec.y || {};

    var width = fig.clientWidth || 640;
    // Below this the right-hand label gutter costs more than it gives, so the
    // legend carries identity on its own.
    var compact = width < 560;

    // Text is sized in CSS pixels against the viewBox, so a wide viewBox scaled
    // down to a phone shrinks the ticks with it. The compact layout uses a
    // narrower viewBox so the type lands near its intended size.
    var W = compact ? 420 : 760;
    var H = compact ? 300 : 400;
    var m = {
      top: compact ? 14 : 18,
      right: compact ? 14 : 150,
      bottom: xSpec.label ? (compact ? 46 : 54) : (compact ? 30 : 36),
      left: compact ? 44 : 54
    };
    var pw = W - m.left - m.right;
    var ph = H - m.top - m.bottom;

    var xs = [], ys = [];
    series.forEach(function (s) {
      s.points.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    });
    var x0 = xSpec.min != null ? xSpec.min : Math.min.apply(null, xs);
    var x1 = xSpec.max != null ? xSpec.max : Math.max.apply(null, xs);
    var y0 = ySpec.min != null ? ySpec.min : Math.min.apply(null, ys);
    var y1 = ySpec.max != null ? ySpec.max : Math.max.apply(null, ys);
    if (y1 === y0) y1 = y0 + 1;

    var sx = function (v) { return m.left + ((v - x0) / (x1 - x0)) * pw; };
    var sy = function (v) { return m.top + ph - ((v - y0) / (y1 - y0)) * ph; };

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      'aria-label': (spec.title || 'Chart') + '. ' + (spec.subtitle || '') +
        ' Values are listed in the table below the chart.'
    });

    var yTicks = ySpec.ticks || ticksFor(y0, y1, 4);
    var xTicks = xSpec.ticks || ticksFor(x0, x1, 4);

    var grid = el('g', { class: 'grid' });
    yTicks.forEach(function (t) {
      grid.appendChild(el('line', { x1: m.left, x2: m.left + pw, y1: sy(t), y2: sy(t) }));
    });
    svg.appendChild(grid);

    var axis = el('g', { class: 'axis' });
    axis.appendChild(el('line', {
      x1: m.left, x2: m.left + pw, y1: m.top + ph, y2: m.top + ph
    }));
    svg.appendChild(axis);

    yTicks.forEach(function (t) {
      svg.appendChild(el('text', {
        class: 'tick', x: m.left - (compact ? 8 : 12), y: sy(t) + 4, 'text-anchor': 'end'
      }, fmt(t, ySpec.format)));
    });

    xTicks.forEach(function (t) {
      svg.appendChild(el('text', {
        class: 'tick', x: sx(t), y: m.top + ph + (compact ? 18 : 22), 'text-anchor': 'middle'
      }, fmt(t, xSpec.format)));
    });

    if (xSpec.label) {
      svg.appendChild(el('text', {
        class: 'axis-label', x: m.left + pw / 2, y: H - 8, 'text-anchor': 'middle'
      }, xSpec.label));
    }

    series.forEach(function (s, i) {
      var color = 'var(--chart-' + (i + 1) + ')';
      var d = s.points.map(function (p, j) {
        return (j ? 'L' : 'M') + sx(p[0]).toFixed(2) + ' ' + sy(p[1]).toFixed(2);
      }).join(' ');
      svg.appendChild(el('path', { class: 'line', d: d, stroke: color }));
      s._color = color;
      s._end = s.points[s.points.length - 1];
    });

    if (!compact) {
      // Each label is two lines, name above value, so it occupies roughly 29px
      // of the viewBox. The minimum gap has to clear the whole block: a gap
      // smaller than the block is exactly how one series' value ends up sitting
      // on top of the next one's name.
      var LABEL_BLOCK = 30;
      var labels = resolveLabels(series.map(function (s, i) {
        return { i: i, want: sy(s._end[1]), s: s };
      }), LABEL_BLOCK, m.top + 14, m.top + ph - 14);

      labels.forEach(function (item) {
        var s = item.s;
        var ex = sx(s._end[0]);
        var ey = sy(s._end[1]);
        var lx = m.left + pw + 22;

        if (Math.abs(item.y - ey) > 1.5) {
          svg.appendChild(el('path', {
            class: 'leader',
            d: 'M' + (ex + 6) + ' ' + ey.toFixed(2) + ' L' + (lx - 10) + ' ' + item.y.toFixed(2)
          }));
        }
        svg.appendChild(el('text', {
          class: 'end-label', x: lx, y: item.y - 3
        }, s.name));
        svg.appendChild(el('text', {
          class: 'end-value', x: lx, y: item.y + 12
        }, fmt(s._end[1], ySpec.format)));
      });
    }

    // Drawn after the labels so the ring sits above any leader that passes under.
    series.forEach(function (s) {
      svg.appendChild(el('circle', {
        class: 'end-dot', cx: sx(s._end[0]), cy: sy(s._end[1]), r: 4, fill: s._color
      }));
    });

    return { svg: svg, series: series, sx: sx, sy: sy, m: m, pw: pw, ph: ph, W: W, ySpec: ySpec, xSpec: xSpec };
  }

  function addHover(fig, view) {
    var svg = view.svg, series = view.series;
    var layer = el('g', { class: 'hover', style: 'display:none' });
    var rule = el('line', { class: 'crosshair', y1: view.m.top, y2: view.m.top + view.ph });
    layer.appendChild(rule);
    var dots = series.map(function (s) {
      var c = el('circle', { class: 'hover-dot', r: 4.5, fill: s._color });
      layer.appendChild(c);
      return c;
    });
    svg.appendChild(layer);

    var tip = html('div', 'chart__tip');
    var dl = document.createElement('dl');
    var dt = document.createElement('dt');
    dl.appendChild(dt);
    var rows = series.map(function (s) {
      var dd = document.createElement('dd');
      var i = html('i');
      i.style.color = s._color;
      var name = html('span', null, s.name);
      name.style.marginLeft = '0';
      name.style.paddingLeft = '0';
      var val = html('span');
      dd.appendChild(i); dd.appendChild(name); dd.appendChild(val);
      dl.appendChild(dd);
      return val;
    });
    tip.appendChild(dl);
    fig.appendChild(tip);

    function hide() {
      layer.style.display = 'none';
      tip.setAttribute('data-open', 'false');
    }

    function move(ev) {
      var box = svg.getBoundingClientRect();
      var scale = view.W / box.width;
      var px = (ev.clientX - box.left) * scale;
      if (px < view.m.left - 8 || px > view.m.left + view.pw + 8) return hide();

      // Nearest sample on the first series decides the x, so every series is
      // read at the same instant rather than each at its own nearest point.
      var pts = series[0].points, best = 0, bd = Infinity, k;
      for (k = 0; k < pts.length; k++) {
        var d = Math.abs(view.sx(pts[k][0]) - px);
        if (d < bd) { bd = d; best = k; }
      }

      var xv = pts[best][0];
      rule.setAttribute('x1', view.sx(xv));
      rule.setAttribute('x2', view.sx(xv));
      dt.textContent = (view.xSpec.label ? view.xSpec.label + ' ' : '') + fmt(xv, view.xSpec.format);

      series.forEach(function (s, i) {
        var p = s.points[Math.min(best, s.points.length - 1)];
        dots[i].setAttribute('cx', view.sx(p[0]));
        dots[i].setAttribute('cy', view.sy(p[1]));
        rows[i].textContent = fmt(p[1], view.ySpec.format);
      });

      layer.style.display = '';
      tip.setAttribute('data-open', 'true');
      var left = (view.sx(xv) / view.W) * box.width;
      var w = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(box.width - w, left - w / 2)) + 'px';
      tip.style.top = '0px';
    }

    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointerdown', move);
  }

  function legendFor(series) {
    var wrap = html('div', 'chart__legend');
    series.forEach(function (s) {
      var span = html('span');
      var dot = html('i');
      dot.style.color = s._color;
      span.appendChild(dot);
      span.appendChild(document.createTextNode(s.name));
      wrap.appendChild(span);
    });
    return wrap;
  }

  /** The accessible alternative, and the relief the light palette's contrast
      warning requires: every plotted value is readable as text. */
  function tableFor(spec, series) {
    var d = html('details', 'chart__table');
    d.appendChild(html('summary', null, 'Show the numbers'));
    var scroller = html('div');
    var t = document.createElement('table');

    var head = document.createElement('tr');
    head.appendChild(html('th', null, (spec.x && spec.x.label) || 'x'));
    series.forEach(function (s) { head.appendChild(html('th', null, s.name)); });
    t.appendChild(head);

    series[0].points.forEach(function (p, i) {
      var tr = document.createElement('tr');
      tr.appendChild(html('td', null, fmt(p[0], spec.x && spec.x.format)));
      series.forEach(function (s) {
        var q = s.points[i];
        tr.appendChild(html('td', null, q ? fmt(q[1], spec.y && spec.y.format) : ''));
      });
      t.appendChild(tr);
    });

    scroller.appendChild(t);
    d.appendChild(scroller);
    return d;
  }

  function render(fig) {
    var src = fig.querySelector('script[type="application/json"]');
    if (!src) return;
    var spec;
    try {
      spec = JSON.parse(src.textContent);
    } catch (e) {
      return;
    }
    if (!spec.series || !spec.series.length) return;

    var caption = fig.querySelector('figcaption');
    Array.prototype.slice.call(fig.children).forEach(function (c) {
      if (c !== src && c !== caption) fig.removeChild(c);
    });

    var view = build(fig, spec);

    if (spec.title || spec.subtitle) {
      var head = html('div', 'chart__head');
      if (spec.title) head.appendChild(html('p', 'chart__title', spec.title));
      if (spec.subtitle) head.appendChild(html('p', 'chart__subtitle', spec.subtitle));
      fig.insertBefore(head, fig.firstChild);
    }

    fig.insertBefore(view.svg, caption || null);
    if (view.series.length > 1) fig.insertBefore(legendFor(view.series), caption || null);
    fig.appendChild(tableFor(spec, view.series));

    if (!matchMedia('(hover: none)').matches) addHover(fig, view);
  }

  function init() {
    var figs = Array.prototype.slice.call(document.querySelectorAll('figure.chart'));
    if (!figs.length) return;
    figs.forEach(render);

    // The compact layout is chosen from the container width, so a resize past
    // the breakpoint has to redraw.
    var t;
    addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { figs.forEach(render); }, 180);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
