/* Background scene shared by every page: starfield, a procedurally shaded moon,
   the station's orbit, a status-coloured glow and a large word set behind the limb.
   CHC.scene.init(canvas); CHC.scene.set({ tint: '#38BDF8', word: 'NOMINAL' }); */
(function () {
  'use strict';
  const C = window.CHC = window.CHC || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Moon texture: craters stamped into a height map, then lit per pixel as a sphere.
  function renderMoon(S) {
    const r = rng(7), R = S / 2, H = new Float32Array(S * S), A = new Float32Array(S * S);
    const G = 64, lat = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) lat[i] = r();
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = lat[(yi & 63) * G + (xi & 63)], b = lat[(yi & 63) * G + ((xi + 1) & 63)];
      const c = lat[((yi + 1) & 63) * G + (xi & 63)], d = lat[((yi + 1) & 63) * G + ((xi + 1) & 63)];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const fbm = (x, y) => { let v = 0, a = .5, f = 1; for (let o = 0; o < 5; o++) { v += a * noise(x * f, y * f); a *= .5; f *= 2.03; } return v; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, u = x / S, v = y / S;
      H[i] = fbm(u * 26, v * 26) * 3.2 + fbm(u * 70, v * 70) * 1.1;
      const m = fbm(u * 3.2 + 9, v * 3.2 + 4);
      A[i] = .5 + .34 * fbm(u * 9 + 3, v * 9 + 7) - (m > .52 ? Math.min(.22, (m - .52) * 1.6) : 0);
    }
    for (let n = 0; n < 1100; n++) {
      const ang = r() * 6.283, dist = Math.sqrt(r()) * R * .97, cx = R + Math.cos(ang) * dist, cy = R + Math.sin(ang) * dist;
      const rad = S * (.003 + .042 * Math.pow(r(), 6)), ext = Math.ceil(rad * 1.5), depth = Math.min(rad * .5, 5) * (.5 + r() * .7);
      for (let y = Math.max(1, cy - ext | 0); y < Math.min(S - 1, cy + ext); y++) for (let x = Math.max(1, cx - ext | 0); x < Math.min(S - 1, cx + ext); x++) {
        const t = Math.hypot(x - cx, y - cy) / rad; if (t > 1.5) continue;
        const i = y * S + x;
        H[i] += (t < 1 ? -(1 - t * t) * depth : 0) + Math.exp(-Math.pow((t - 1) / .2, 2)) * depth * .35;
        if (t < .85) A[i] += .015;
      }
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    let lx = -.38, ly = -.92, lz = .1; const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
      const px = (x - R) / R, py = (y - R) / R, q = px * px + py * py; if (q >= 1) continue;
      const i = y * S + x, pz = Math.sqrt(1 - q);
      let nx = px - (H[i + 1] - H[i - 1]) * .2, ny = py - (H[i + S] - H[i - S]) * .2, nz = pz;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const lam = Math.max(0, nx * lx + ny * ly + nz * lz);
      const c = Math.min(1, A[i] * Math.pow(lam, 1.3) * 1.3 + .012);
      const o = i * 4, edge = Math.min(1, (1 - Math.sqrt(q)) * R);
      d[o] = c * 226; d[o + 1] = c * 236; d[o + 2] = c * 255; d[o + 3] = edge * 255;
    }
    g.putImageData(img, 0, 0); return cv;
  }

  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  let cv, ctx, W, H, dpr, moon, stars, cur = [56, 189, 248], target = [56, 189, 248], word = '', prevWord = '', wordT = 1, mx = 0, my = 0, raf = 0, last = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    stars = document.createElement('canvas'); stars.width = cv.width; stars.height = cv.height;
    const s = stars.getContext('2d'), r = rng(3);
    for (let i = 0; i < 260; i++) {
      const b = r();
      s.fillStyle = `rgba(${200 + r() * 55 | 0},${215 + r() * 40 | 0},255,${.25 + b * .65})`;
      s.beginPath(); s.arc(r() * cv.width, r() * cv.height, (.4 + b * b * 1.1) * dpr, 0, 6.283); s.fill();
    }
    draw(performance.now());
  }
  function drawWord(text, alpha, px, py, r) {
    if (!text || alpha <= 0) return;
    let size = Math.min(H * .34, W * .2);
    ctx.font = `600 ${size}px Outfit, system-ui, sans-serif`;
    const maxW = W * .5, w = ctx.measureText(text).width;
    if (w > maxW) { size *= maxW / w; ctx.font = `600 ${size}px Outfit, system-ui, sans-serif`; }
    const base = py - r + size * .42, g = ctx.createLinearGradient(0, base - size * .8, 0, base);
    g.addColorStop(0, `rgba(255,255,255,${.15 * alpha})`);
    g.addColorStop(1, `rgba(255,255,255,${.015 * alpha})`);
    ctx.textAlign = 'right'; ctx.fillStyle = g; ctx.fillText(text, W - Math.max(24, W * .03), base);
  }
  function draw(now) {
    if (!ctx) return;
    for (let i = 0; i < 3; i++) cur[i] += (target[i] - cur[i]) * .06;
    wordT = Math.min(1, wordT + .04);
    const t = `${cur[0] | 0},${cur[1] | 0},${cur[2] | 0}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B0F19'; ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W * .08, -H * .1, 0, W * .08, -H * .1, Math.max(W, H) * .8);
    g.addColorStop(0, `rgba(${t},.2)`); g.addColorStop(.5, 'rgba(30,58,138,.14)'); g.addColorStop(1, 'rgba(11,15,25,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(stars, 0, 0, W, H);

    const small = W < 700, mid = W < 1100;
    const r = small ? W * .95 : Math.max(H * .78, W * .34);
    const px = (small ? W * .8 : mid ? W * .92 : W * .86) + mx * 10;
    const py = (small ? H * .74 + r : mid ? H * 1.24 : H * 1.14) + my * 8;
    drawWord(prevWord, 1 - wordT, px, py, r); drawWord(word, wordT, px, py, r);

    const orbit = front => {
      ctx.save(); ctx.translate(px, py); ctx.rotate(-.3); ctx.scale(1, .26);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.28, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
      ctx.restore(); ctx.strokeStyle = `rgba(255,255,255,${front ? .28 : .13})`; ctx.lineWidth = 1; ctx.stroke();
    };
    orbit(false);
    g = ctx.createRadialGradient(px, py, r * .97, px, py, r * 1.16);
    g.addColorStop(0, `rgba(${t},.42)`); g.addColorStop(.35, `rgba(${t},.12)`); g.addColorStop(1, `rgba(${t},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 1.16, 0, 6.283); ctx.fill();
    ctx.globalAlpha = small ? .6 : mid ? .8 : 1; ctx.drawImage(moon, px - r, py - r, r * 2, r * 2); ctx.globalAlpha = 1;
    g = ctx.createRadialGradient(px - r * .5, py - r * .55, r * .2, px, py, r);
    g.addColorStop(0, `rgba(${t},.1)`); g.addColorStop(1, `rgba(${t},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill();
    orbit(true);
    const a = Math.PI * (.62 + .1 * Math.sin(now / 9000)), ex = Math.cos(a) * r * 1.28, ey = Math.sin(a) * r * 1.28 * .26;
    const sx = px + ex * Math.cos(-.3) - ey * Math.sin(-.3), sy = py + ex * Math.sin(-.3) + ey * Math.cos(-.3);
    ctx.fillStyle = `rgba(${t},.35)`; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, 6.283); ctx.fill();

    g = ctx.createLinearGradient(0, 0, W * .55, 0); g.addColorStop(0, 'rgba(11,15,25,.55)'); g.addColorStop(1, 'rgba(11,15,25,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function loop(now) { raf = requestAnimationFrame(loop); if (now - last < 33) return; last = now; draw(now); }
  const kick = () => { if (reduce) { cur = target.slice(); wordT = 1; draw(0); } };

  C.scene = {
    init(canvas) {
      cv = canvas; ctx = cv.getContext('2d'); moon = renderMoon(900);
      addEventListener('resize', resize); resize();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(performance.now()));
      if (reduce) return;
      addEventListener('pointermove', e => { mx = e.clientX / W - .5; my = e.clientY / H - .5; });
      document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(loop); });
      raf = requestAnimationFrame(loop);
    },
    set(o) {
      if (o.tint) target = hex(o.tint);
      if (o.word != null && o.word !== word) { prevWord = word; word = o.word; wordT = 0; }
      kick();
    },
  };
})();