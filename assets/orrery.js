/* Flits orrery — a quiet, patient animation of concentric orbits.
   SVG is authored in JS so sizing is responsive and the render loop can
   advance angles smoothly. Fits the paper/mono aesthetic: thin dashed rules,
   tiny filled discs, slow speeds, no color. */
(function () {
  function initOrrery() {
  if (window.FlitsOrreryDestroy) window.FlitsOrreryDestroy();
  const mount = document.getElementById('ascii');
  if (!mount) return;

  const wrap = document.createElement('div');
  wrap.className = 'orrery';
  wrap.setAttribute('aria-hidden', 'true');
  mount.replaceWith(wrap);

  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Scene content extends to ~r=172 but is tilted on Y by cos(TILT) so the
  // vertical extent is much smaller than the horizontal. The viewBox is
  // anamorphic on purpose — it crops the tall transparent padding that the
  // tilt would otherwise leave above and below the art.
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-180 -92 360 184');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  wrap.appendChild(svg);

  let fg = '#1a1916';
  let muted = '#7a756a';
  let rule = '#d9d4c7';

  function readTheme() {
    const root = getComputedStyle(document.documentElement);
    fg = (root.getPropertyValue('--fg') || fg).trim();
    muted = (root.getPropertyValue('--muted') || muted).trim();
    rule = (root.getPropertyValue('--rule') || rule).trim();
  }

  function applyTheme() {
    readTheme();
    svg.querySelectorAll('[data-fill="fg"]').forEach((el) => el.setAttribute('fill', fg));
    svg.querySelectorAll('[data-fill="muted"]').forEach((el) => el.setAttribute('fill', muted));
    svg.querySelectorAll('[data-stroke="fg"]').forEach((el) => el.setAttribute('stroke', fg));
    svg.querySelectorAll('[data-stroke="muted"]').forEach((el) => el.setAttribute('stroke', muted));
    svg.querySelectorAll('[data-stroke="rule"]').forEach((el) => el.setAttribute('stroke', rule));
    svg.querySelectorAll('[data-stop-color="fg"]').forEach((el) => el.setAttribute('stop-color', fg));
  }

  readTheme();

  // ---- Defs ----
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);

  // Soft radial glow behind the core
  const grad = document.createElementNS(SVG_NS, 'radialGradient');
  grad.setAttribute('id', 'flits-core-glow');
  grad.setAttribute('cx', '0.5'); grad.setAttribute('cy', '0.5'); grad.setAttribute('r', '0.5');
  [
    ['0%',   0.22],
    ['45%',  0.06],
    ['100%', 0.0 ],
  ].forEach(([off, op]) => {
    const s = document.createElementNS(SVG_NS, 'stop');
    s.setAttribute('offset', off);
    s.setAttribute('stop-color', fg);
    s.setAttribute('data-stop-color', 'fg');
    s.setAttribute('stop-opacity', String(op));
    grad.appendChild(s);
  });
  defs.appendChild(grad);

  // Fading gradient along comet trail (linear, reused & rotated per frame)
  const cometGrad = document.createElementNS(SVG_NS, 'linearGradient');
  cometGrad.setAttribute('id', 'flits-comet');
  cometGrad.setAttribute('x1', '0'); cometGrad.setAttribute('y1', '0');
  cometGrad.setAttribute('x2', '1'); cometGrad.setAttribute('y2', '0');
  const cg1 = document.createElementNS(SVG_NS, 'stop');
  cg1.setAttribute('offset', '0%');   cg1.setAttribute('stop-color', fg); cg1.setAttribute('stop-opacity', '0');
  cg1.setAttribute('data-stop-color', 'fg');
  const cg2 = document.createElementNS(SVG_NS, 'stop');
  cg2.setAttribute('offset', '100%'); cg2.setAttribute('stop-color', fg); cg2.setAttribute('stop-opacity', '0.85');
  cg2.setAttribute('data-stop-color', 'fg');
  cometGrad.append(cg1, cg2);
  defs.appendChild(cometGrad);

  // ---- Scene group (tilted on X) ----
  const TILT_DEG = 66;
  const tiltY = Math.cos(TILT_DEG * Math.PI / 180);
  const scene = document.createElementNS(SVG_NS, 'g');
  scene.setAttribute('transform', `scale(1, ${tiltY.toFixed(4)})`);
  svg.appendChild(scene);

  // ---- Background starfield ----
  // Stars live OUTSIDE the tilted scene group so they aren't squashed into
  // a horizontal band — they wrap the whole frame evenly.
  const starLayer = document.createElementNS(SVG_NS, 'g');
  starLayer.setAttribute('class', 'stars');
  svg.insertBefore(starLayer, svg.firstChild);

  const stars = [];
  const SEED = 2026;
  let s = SEED;
  function rand() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
  // Distribute stars in polar coords around the center, with y scaled to the
  // viewBox aspect. This wraps stars evenly around the orrery ellipse
  // (including above + below + left + right) instead of packing them into
  // top/bottom bands like a rectangular sampler would.
  const VB_X = 180, VB_Y = 92;
  // Stars are placed on elliptical shells that share the viewBox aspect
  // ratio. Every shell wraps the center evenly (all rotations); the inner
  // shells sit just outside the orrery's footprint; the outermost shell
  // rides along the frame. This avoids the rectangular-corner pile-up
  // that biased an earlier version to the vertical extremes.
  let placed = 0, tries = 0;
  while (placed < 90 && tries < 1500) {
    tries++;
    const ang = rand() * Math.PI * 2;
    // Shell radius in X-units; y uses the viewBox aspect so shells are
    // ellipses that match the frame.
    const shell = 0.40 + Math.pow(rand(), 0.7) * 0.58; // 0.40..0.98
    const cx = Math.cos(ang) * shell * VB_X;
    const cy = Math.sin(ang) * shell * VB_Y;
    if (Math.abs(cx) > VB_X - 2 || Math.abs(cy) > VB_Y - 2) continue;
    const inCore = (cx * cx) / (175 * 175) + (cy * cy) / (72 * 72) < 1;
    if (inCore) continue;
    // Thin out extreme top/bottom so a wide viewBox doesn't read as bands.
    const yFrac = Math.abs(cy) / VB_Y;
    if (yFrac > 0.78 && rand() > 0.35) continue;
    const bright = rand();
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', cx.toFixed(1));
    dot.setAttribute('cy', cy.toFixed(1));
    dot.setAttribute('r',  bright > 0.92 ? 0.95 : (bright > 0.7 ? 0.65 : 0.45));
    dot.setAttribute('fill', muted);
    dot.setAttribute('data-fill', 'muted');
    const base = 0.2 + bright * 0.5;
    dot.setAttribute('opacity', base.toFixed(2));
    starLayer.appendChild(dot);
    stars.push({ el: dot, base, phase: rand() * Math.PI * 2 });
    placed++;
  }

  // ---- Orbits (dashed, concentric) ----
  // Speeds slowed considerably and spaced to suggest a real Keplerian system.
  const orbits = [
    { r: 30,  speed: 0.0022, body: 1.4, lead: 0.55, dash: '1 3',  label: null   },
    { r: 54,  speed: 0.0015, body: 2.0, lead: 0.50, dash: '1 3',  label: null   },
    { r: 82,  speed: 0.0010, body: 1.8, lead: 0.45, dash: '1 4',  label: null   },
    { r: 112, speed: 0.00068, body: 2.8, lead: 0.40, dash: '1 4', label: 'III'  },
    { r: 142, speed: 0.00045, body: 1.6, lead: 0.35, dash: '1 5', label: null   },
    { r: 168, speed: 0.00028, body: 2.2, lead: 0.30, dash: '1 6', label: null   },
  ];

  const bodies = orbits.map((o, i) => {
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('r', o.r);
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', rule);
    ring.setAttribute('data-stroke', 'rule');
    ring.setAttribute('stroke-width', '0.6');
    ring.setAttribute('stroke-dasharray', o.dash);
    ring.setAttribute('opacity', '0.9');
    scene.appendChild(ring);

    // Tick marks every 30° on every other ring — clock/astrolabe feel
    if (i % 2 === 1) {
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        const t = document.createElementNS(SVG_NS, 'line');
        t.setAttribute('x1', (Math.cos(a) * (o.r - 1.5)).toFixed(2));
        t.setAttribute('y1', (Math.sin(a) * (o.r - 1.5)).toFixed(2));
        t.setAttribute('x2', (Math.cos(a) * (o.r + 1.5)).toFixed(2));
        t.setAttribute('y2', (Math.sin(a) * (o.r + 1.5)).toFixed(2));
        t.setAttribute('stroke', rule);
        t.setAttribute('data-stroke', 'rule');
        t.setAttribute('stroke-width', '0.4');
        t.setAttribute('opacity', '0.6');
        scene.appendChild(t);
      }
    }

    // Trailing arc
    const trail = document.createElementNS(SVG_NS, 'path');
    trail.setAttribute('fill', 'none');
    trail.setAttribute('stroke', muted);
    trail.setAttribute('data-stroke', 'muted');
    trail.setAttribute('stroke-width', '0.75');
    trail.setAttribute('stroke-linecap', 'round');
    trail.setAttribute('opacity', '0.5');
    scene.appendChild(trail);

    // Planet
    const body = document.createElementNS(SVG_NS, 'circle');
    body.setAttribute('r', o.body);
    body.setAttribute('fill', fg);
    body.setAttribute('data-fill', 'fg');
    scene.appendChild(body);

    // Halo ring on one chosen planet (the "III" — a gas giant feel)
    let halo = null;
    if (i === 3) {
      halo = document.createElementNS(SVG_NS, 'ellipse');
      halo.setAttribute('rx', (o.body + 3.5).toFixed(2));
      halo.setAttribute('ry', (o.body + 1.2).toFixed(2));
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', fg);
      halo.setAttribute('data-stroke', 'fg');
      halo.setAttribute('stroke-width', '0.6');
      halo.setAttribute('opacity', '0.75');
      scene.appendChild(halo);
    }

    // Moon on orbit 2
    let moon = null;
    if (i === 2) {
      moon = document.createElementNS(SVG_NS, 'circle');
      moon.setAttribute('r', 0.95);
      moon.setAttribute('fill', fg);
      moon.setAttribute('data-fill', 'fg');
      moon.setAttribute('opacity', '0.8');
      scene.appendChild(moon);
    }

    const phase = (i * 1.37 + rand() * 0.8) * Math.PI;
    return { ...o, angle: phase, body, trail, moon, halo };
  });

  // ---- Comet on a steeper/elliptical path ----
  // Separate from the circular orbits — a wanderer.
  const cometOrbit = { a: 150, b: 95, rot: -0.32, speed: 0.00045 };
  const cometTrailLen = 0.55; // radians along its path
  const cometTrail = document.createElementNS(SVG_NS, 'path');
  cometTrail.setAttribute('fill', 'none');
  cometTrail.setAttribute('stroke', 'url(#flits-comet)');
  cometTrail.setAttribute('stroke-width', '1.0');
  cometTrail.setAttribute('stroke-linecap', 'round');
  cometTrail.setAttribute('opacity', '0.9');
  scene.appendChild(cometTrail);
  const cometHead = document.createElementNS(SVG_NS, 'circle');
  cometHead.setAttribute('r', 1.6);
  cometHead.setAttribute('fill', fg);
  cometHead.setAttribute('data-fill', 'fg');
  scene.appendChild(cometHead);
  let cometAngle = Math.PI * 0.8;

  // ---- Central sun ----
  const sunOuter = document.createElementNS(SVG_NS, 'circle');
  sunOuter.setAttribute('r', '10');
  sunOuter.setAttribute('fill', 'none');
  sunOuter.setAttribute('stroke', fg);
  sunOuter.setAttribute('data-stroke', 'fg');
  sunOuter.setAttribute('stroke-width', '0.7');
  sunOuter.setAttribute('opacity', '0.8');
  scene.appendChild(sunOuter);

  const glow = document.createElementNS(SVG_NS, 'circle');
  glow.setAttribute('r', '70');
  glow.setAttribute('fill', 'url(#flits-core-glow)');
  glow.setAttribute('pointer-events', 'none');
  scene.insertBefore(glow, scene.firstChild);

  const sun = document.createElementNS(SVG_NS, 'circle');
  sun.setAttribute('r', '4.2');
  sun.setAttribute('fill', fg);
  sun.setAttribute('data-fill', 'fg');
  scene.appendChild(sun);

  // Cardinal tick marks around sun
  for (let k = 0; k < 8; k++) {
    const tick = document.createElementNS(SVG_NS, 'line');
    const a = (k * Math.PI) / 4;
    const r0 = 13, r1 = k % 2 === 0 ? 18 : 16;
    tick.setAttribute('x1', (Math.cos(a) * r0).toFixed(2));
    tick.setAttribute('y1', (Math.sin(a) * r0).toFixed(2));
    tick.setAttribute('x2', (Math.cos(a) * r1).toFixed(2));
    tick.setAttribute('y2', (Math.sin(a) * r1).toFixed(2));
    tick.setAttribute('stroke', muted);
    tick.setAttribute('data-stroke', 'muted');
    tick.setAttribute('stroke-width', '0.6');
    tick.setAttribute('opacity', k % 2 === 0 ? '0.85' : '0.5');
    scene.appendChild(tick);
  }

  // ---- Drifting outer meridian ----
  const meridian = document.createElementNS(SVG_NS, 'path');
  meridian.setAttribute('fill', 'none');
  meridian.setAttribute('stroke', muted);
  meridian.setAttribute('data-stroke', 'muted');
  meridian.setAttribute('stroke-width', '0.5');
  meridian.setAttribute('stroke-dasharray', '2 5');
  meridian.setAttribute('opacity', '0.32');
  scene.appendChild(meridian);
  let meridianAngle = 0;

  let pulse = 0;

  function describeArc(r, a0, a1, steps = 18) {
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      d += (i === 0 ? 'M' : 'L') +
        (Math.cos(a) * r).toFixed(2) + ' ' +
        (Math.sin(a) * r).toFixed(2) + ' ';
    }
    return d;
  }

  function describeEllipse(a, b, rot, a0, a1, steps = 24) {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = a0 + (a1 - a0) * t;
      const x0 = Math.cos(ang) * a;
      const y0 = Math.sin(ang) * b;
      const x = x0 * cr - y0 * sr;
      const y = x0 * sr + y0 * cr;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    }
    return d;
  }

  function tick(dt) {
    for (const o of bodies) {
      o.angle += o.speed * dt;
      const x = Math.cos(o.angle) * o.r;
      const y = Math.sin(o.angle) * o.r;
      o.body.setAttribute('cx', x.toFixed(2));
      o.body.setAttribute('cy', y.toFixed(2));
      o.trail.setAttribute('d', describeArc(o.r, o.angle - o.lead, o.angle));
      if (o.moon) {
        const ma = o.angle * 5.8;
        const mr = 4.4;
        o.moon.setAttribute('cx', (x + Math.cos(ma) * mr).toFixed(2));
        o.moon.setAttribute('cy', (y + Math.sin(ma) * mr).toFixed(2));
      }
      if (o.halo) {
        o.halo.setAttribute('cx', x.toFixed(2));
        o.halo.setAttribute('cy', y.toFixed(2));
        // Halo tilts with planet's orbital position for a slight 3D illusion
        const tiltAng = Math.cos(o.angle) * 14;
        o.halo.setAttribute('transform',
          `rotate(${tiltAng.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);
      }
    }

    // Comet on ellipse
    cometAngle += cometOrbit.speed * dt;
    const ca1 = cometAngle;
    const ca0 = cometAngle - cometTrailLen;
    cometTrail.setAttribute('d',
      describeEllipse(cometOrbit.a, cometOrbit.b, cometOrbit.rot, ca0, ca1));
    const cr = Math.cos(cometOrbit.rot), sr = Math.sin(cometOrbit.rot);
    const cx0 = Math.cos(ca1) * cometOrbit.a;
    const cy0 = Math.sin(ca1) * cometOrbit.b;
    cometHead.setAttribute('cx', (cx0 * cr - cy0 * sr).toFixed(2));
    cometHead.setAttribute('cy', (cx0 * sr + cy0 * cr).toFixed(2));

    meridianAngle += 0.00022 * dt;
    meridian.setAttribute('d',
      describeArc(172, meridianAngle - 1.1, meridianAngle + 1.1, 32));

    // Sun breathes slowly
    pulse += 0.0009 * dt;
    const sp = 1 + Math.sin(pulse) * 0.07;
    sun.setAttribute('r', (4.2 * sp).toFixed(3));
    sunOuter.setAttribute('r', (10 + Math.sin(pulse) * 0.7).toFixed(3));

    // Stars twinkle subtly
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      const tw = Math.sin(pulse * 1.3 + st.phase) * 0.15;
      st.el.setAttribute('opacity', Math.max(0.1, st.base + tw).toFixed(2));
    }
  }

  let raf = null, last = 0;
  function loop(t) {
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    tick(dt);
    raf = requestAnimationFrame(loop);
  }
  function onVisibilityChange() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; last = 0; }
    else if (!raf) { raf = requestAnimationFrame(loop); }
  }

  const colorSchemeQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  function onColorSchemeChange() {
    applyTheme();
  }

  const themeObserver = new MutationObserver(applyTheme);

  document.addEventListener('visibilitychange', onVisibilityChange);
  if (colorSchemeQuery) {
    if (colorSchemeQuery.addEventListener) colorSchemeQuery.addEventListener('change', onColorSchemeChange);
    else if (colorSchemeQuery.addListener) colorSchemeQuery.addListener(onColorSchemeChange);
  }
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-appearance'] });
  if (document.body) {
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-appearance'] });
  }

  window.FlitsOrreryDestroy = function () {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (colorSchemeQuery) {
      if (colorSchemeQuery.removeEventListener) colorSchemeQuery.removeEventListener('change', onColorSchemeChange);
      else if (colorSchemeQuery.removeListener) colorSchemeQuery.removeListener(onColorSchemeChange);
    }
    themeObserver.disconnect();
    window.FlitsOrreryDestroy = null;
  };

  applyTheme();
  raf = requestAnimationFrame(loop);
  }

  window.FlitsOrreryInit = initOrrery;
  initOrrery();
})();
