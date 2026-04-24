/* Original ASCII globe — dotted Earth rendered as monospace luminance-shaded sphere.
   Uses a compact land-mask (low-res grid of continent coverage) sampled in
   spherical coordinates, with Lambertian shading for unlit ocean dots. */
(function () {
  const el = document.getElementById('ascii');
  if (!el) return;

  // Land mask: 36 cols x 18 rows (each cell = 10° lon x 10° lat)
  // '#' = land, '.' = ocean. Approximate continents — original, hand-authored.
  const mask = [
    "....................................",
    "....................................",
    "..###########.....##########........",
    ".##############..############.......",
    "..#############..############.####..",
    "...##########....##############.....",
    "....#########.....#############.....",
    ".....########......############.....",
    "......#######......############.....",
    ".......######.......#########.......",
    ".......#####.........########.......",
    "........####.........#######........",
    ".........###..........######........",
    ".........###...........####.........",
    "..........##............##..........",
    "...........#.............#..........",
    "....................................",
    "....................................",
  ];
  const MCOLS = mask[0].length;
  const MROWS = mask.length;

  function isLand(lonDeg, latDeg) {
    // lon: -180..180, lat: -90..90
    let x = Math.floor(((lonDeg + 180) / 360) * MCOLS);
    let y = Math.floor(((90 - latDeg) / 180) * MROWS);
    if (x < 0) x = 0; if (x >= MCOLS) x = MCOLS - 1;
    if (y < 0) y = 0; if (y >= MROWS) y = MROWS - 1;
    return mask[y].charCodeAt(x) === 35; // '#'
  }

  // Luminance ramps (darker → lighter)
  const landRamp  = " .:-=+*#%@".split('');
  const oceanRamp = " ..··::".split('');

  function computeGrid() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 520) return { cols: 42, rows: 20 };
    if (vw < 820) return { cols: 54, rows: 22 };
    if (vh < 620) return { cols: 60, rows: 22 };
    if (vw < 1200) return { cols: 64, rows: 26 };
    return { cols: 72, rows: 28 };
  }

  let g = computeGrid();
  let A = 0; // spin around Y axis
  const tilt = 23.5 * Math.PI / 180; // axial tilt

  function frame() {
    const cols = g.cols, rows = g.rows;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    // aspect compensation: char cells are roughly 2x tall as wide → radius in
    // col-units is larger than row-units so sphere looks circular
    const rx = (cols / 2) - 1;
    const ry = (rows / 2) - 1;
    const R  = Math.min(rx, ry * 2) * 0.94; // unified radius in "col" units
    const ryEff = R / 2;                    // scaled down for rows

    // Light direction (from upper-left, slightly forward)
    const lx = -0.55, ly = -0.55, lz = 0.63; // normalized-ish

    const cosT = Math.cos(tilt),  sinT = Math.sin(tilt);
    const cosA = Math.cos(A),     sinA = Math.sin(A);

    let out = '';
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        // Normalize into unit sphere space (accounting for char aspect)
        const nx = (c - cx) / R;
        const ny = (r - cy) / ryEff;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) { line += ' '; continue; }
        const nz = Math.sqrt(1 - r2); // front of sphere

        // Apply inverse axial tilt (rotate view up by tilt)
        // p' = Rx(-tilt) * p
        const x1 = nx;
        const y1 =  ny * cosT + nz * sinT;
        const z1 = -ny * sinT + nz * cosT;

        // Apply spin around Y (planet rotation)
        const x2 =  x1 * cosA + z1 * sinA;
        const y2 =  y1;
        const z2 = -x1 * sinA + z1 * cosA;

        // To lat/lon (y = sin(lat))
        const lat = Math.asin(Math.max(-1, Math.min(1, y2))) * 180 / Math.PI;
        const lon = Math.atan2(x2, z2) * 180 / Math.PI;

        // Shading: lambertian vs light dir applied in VIEW space
        const diff = Math.max(0, nx * lx + ny * ly + nz * lz);

        if (isLand(lon, lat)) {
          // stippled land — vary density by diff + a jitter so it looks dotted
          const jitter = ((c * 928371 + r * 12389 + ((A * 1000) | 0) * 17) & 7) / 7;
          const shade = Math.min(1, diff * 1.15 + 0.05);
          const idx = Math.min(landRamp.length - 1,
                      Math.max(0, Math.floor(shade * landRamp.length * 0.9 + jitter * 0.6)));
          line += landRamp[idx];
        } else {
          // ocean: mostly sparse dots, denser near terminator highlight
          const e = ((c + r) & 1);
          if (diff > 0.75 && e) line += ':';
          else if (diff > 0.45 && ((c * 3 + r * 5) & 3) === 0) line += '·';
          else if (diff > 0.15 && ((c * 7 + r * 11) & 7) === 0) line += '.';
          else line += ' ';
        }
      }
      out += line + '\n';
    }
    el.textContent = out;
    A += 0.012;
  }

  let raf = null, last = 0;
  function loop(t) {
    if (t - last > 1000 / 24) { // 24fps, plenty
      frame();
      last = t;
    }
    raf = requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf) { raf = requestAnimationFrame(loop); }
  });

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { g = computeGrid(); }, 120);
  });

  raf = requestAnimationFrame(loop);
})();
