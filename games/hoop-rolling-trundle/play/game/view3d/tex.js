// Procedural canvas textures for the village lane (cobbles, dirt, mud, planks, grass, brick, plaster, tiles, hedge, stripes, soft sprites).
// Every texture is tileable, drawn once and cached; colours are kept light/neutral so materials tint them to the course's theme.
// 2.4 m per texture tile unless a function says otherwise (TILE below), so the same texel density is used on every surface.
export const TILE = 2.4;

const cache = new Map();
const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const mk = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const shade = (c, k) => { const p = parseInt(c.slice(1), 16); const f = (s) => Math.max(0, Math.min(255, Math.round(((p >> s) & 255) * k))); return `rgb(${f(16)},${f(8)},${f(0)})`; };

function wrapDraw(g, w, h, fn) {      // draw a shape so it also appears on the opposite edge when it crosses (tileable)
  for (const dx of [0, -w, w]) for (const dy of [0, -h, h]) fn(dx, dy);
}

function speckle(g, w, h, rnd, n, cols, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    const x = rnd() * w, y = rnd() * h, r = rmin + rnd() * (rmax - rmin);
    wrapDraw(g, w, h, (dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 6.2832); g.fill(); });
  }
}

const BUILD = {
  cobble() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(11);
    g.fillStyle = '#4a4238'; g.fillRect(0, 0, W, W);
    const rows = 18, rh = W / rows;
    const pal = ['#a39a8c', '#8f877b', '#b3a995', '#9a8f7e', '#7f786d', '#b9ad98', '#8b8478', '#a8957a'];
    for (let j = 0; j < rows; j++) {
      const n = 12 + (j % 3 === 0 ? 1 : 0) * 0, sw = W / n;
      let x = -(j % 2) * sw * 0.5 - r() * 4;
      for (let i = 0; i < n + 1; i++) {
        const w = sw * (0.86 + r() * 0.12), y = j * rh + 1.6, h = rh - 3.2 + (r() - 0.5) * 2;
        const col = pal[Math.floor(r() * pal.length)];
        wrapDraw(g, W, W, (dx, dy) => {
          const gr = g.createLinearGradient(0, y + dy, 0, y + dy + h);
          gr.addColorStop(0, shade(col, 1.12)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, 0.78));
          g.fillStyle = gr; g.beginPath(); g.roundRect(x + dx + 1.5, y + dy, w - 3, h, 5); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.roundRect(x + dx + 4, y + dy + 1.5, w - 10, 3, 2); g.fill();
        });
        x += sw;
      }
    }
    speckle(g, W, W, r, 260, ['rgba(40,34,26,0.35)', 'rgba(255,255,255,0.10)'], 0.8, 2.2);
    return c;
  },
  dirt() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(23);
    g.fillStyle = '#d8c7a6'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) {          // soft blotches
      const x = r() * W, y = r() * W, rad = 18 + r() * 60, a = 0.05 + r() * 0.08, dark = r() < 0.5;
      wrapDraw(g, W, W, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 1, x + dx, y + dy, rad); gr.addColorStop(0, dark ? `rgba(90,62,30,${a})` : `rgba(255,244,214,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); });
    }
    // two faint wheel ruts along the road
    for (const u of [0.28, 0.72]) { const gr = g.createLinearGradient((u - 0.07) * W, 0, (u + 0.07) * W, 0); gr.addColorStop(0, 'rgba(70,46,20,0)'); gr.addColorStop(0.5, 'rgba(70,46,20,0.16)'); gr.addColorStop(1, 'rgba(70,46,20,0)'); g.fillStyle = gr; g.fillRect((u - 0.07) * W, 0, 0.14 * W, W); }
    speckle(g, W, W, r, 900, ['rgba(60,40,18,0.35)', 'rgba(255,250,235,0.35)', 'rgba(120,96,64,0.45)'], 0.7, 2.4);
    speckle(g, W, W, r, 70, ['#9c8d78', '#b7a78e', '#7d705f'], 2, 4.5);
    return c;
  },
  mud() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(31);
    g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * W, rad = 14 + r() * 50, dark = r() < 0.55;
      wrapDraw(g, W, W, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 1, x + dx, y + dy, rad); gr.addColorStop(0, dark ? 'rgba(40,26,14,0.30)' : 'rgba(176,142,104,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); });
    }
    for (let i = 0; i < 26; i++) {           // wet sheen streaks
      const x = r() * W, y = r() * W, w = 20 + r() * 50;
      wrapDraw(g, W, W, (dx, dy) => { g.strokeStyle = 'rgba(210,200,185,0.22)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + w, y + dy + (r() - 0.5) * 8); g.stroke(); });
    }
    speckle(g, W, W, r, 500, ['rgba(30,20,10,0.4)', 'rgba(150,120,90,0.35)'], 0.8, 2.6);
    return c;
  },
  plank() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(41);
    const n = 12, bh = W / n;
    for (let j = 0; j < n; j++) {
      const k = 0.9 + r() * 0.2;
      const gr = g.createLinearGradient(0, j * bh, 0, (j + 1) * bh);
      gr.addColorStop(0, shade('#c99a5c', k * 1.05)); gr.addColorStop(1, shade('#a9793f', k));
      g.fillStyle = gr; g.fillRect(0, j * bh, W, bh);
      g.strokeStyle = 'rgba(70,42,14,0.30)'; g.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const y = j * bh + 3 + r() * (bh - 6); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 3, W * 0.6, y + (r() - 0.5) * 3, W, y + (r() - 0.5) * 2); g.stroke(); }
      g.fillStyle = 'rgba(30,18,6,0.85)'; g.fillRect(0, j * bh, W, 2.2);
      for (const x of [14, W - 14]) { g.fillStyle = 'rgba(40,40,44,0.85)'; g.beginPath(); g.arc(x, j * bh + bh / 2, 2.6, 0, 6.2832); g.fill(); }
    }
    return c;
  },
  grass() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(53);
    g.fillStyle = '#d9e6c9'; g.fillRect(0, 0, W, W);
    // mowing stripes along the road (v direction = canvas y; stripes alternate across the x axis)
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,40,0,0.07)'; g.fillRect(i * W / 4, 0, W / 4, W); }
    speckle(g, W, W, r, 3600, ['rgba(40,90,20,0.30)', 'rgba(210,235,160,0.35)', 'rgba(20,60,10,0.24)'], 0.6, 1.5);
    for (let i = 0; i < 90; i++) {          // daisies and buttercups
      const x = r() * W, y = r() * W, col = r() < 0.6 ? 'rgba(255,255,255,0.85)' : 'rgba(255,214,70,0.85)';
      wrapDraw(g, W, W, (dx, dy) => { g.fillStyle = col; g.beginPath(); g.arc(x + dx, y + dy, 1.4, 0, 6.2832); g.fill(); });
    }
    return c;
  },
  brick() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(61);
    g.fillStyle = '#6a5a4c'; g.fillRect(0, 0, W, W);
    const bw = 64, bh = 24;
    for (let j = 0; j < W / bh + 1; j++) for (let i = -1; i < W / bw + 1; i++) {
      const x = i * bw + (j % 2) * bw / 2, y = j * bh, k = 0.84 + r() * 0.3;
      g.fillStyle = shade('#c0765a', k); g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 2, y + 2, bw - 4, 3);
    }
    speckle(g, W, W, r, 500, ['rgba(40,20,10,0.25)', 'rgba(255,230,200,0.12)'], 0.6, 1.8);
    return c;
  },
  plaster() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(67);
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 80; i++) {
      const x = r() * W, y = r() * W, rad = 20 + r() * 70;
      wrapDraw(g, W, W, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 1, x + dx, y + dy, rad); gr.addColorStop(0, r() < 0.5 ? 'rgba(120,100,70,0.10)' : 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); });
    }
    speckle(g, W, W, r, 700, ['rgba(80,70,50,0.18)', 'rgba(255,255,255,0.2)'], 0.6, 1.6);
    return c;
  },
  tiles() {
    const W = 512, c = mk(W, W), g = c.getContext('2d'), r = lcg(71);
    g.fillStyle = '#4a3a34'; g.fillRect(0, 0, W, W);
    const tw = 32, th = 28;
    for (let j = 0; j < W / th + 1; j++) for (let i = -1; i < W / tw + 1; i++) {
      const x = i * tw + (j % 2) * tw / 2, y = j * th, k = 0.8 + r() * 0.38;
      const gr = g.createLinearGradient(0, y, 0, y + th); gr.addColorStop(0, shade('#d9a49a', k * 1.1)); gr.addColorStop(1, shade('#b8786c', k * 0.85));
      g.fillStyle = gr; g.beginPath(); g.roundRect(x + 1, y + 1, tw - 2, th + 6, [0, 0, 8, 8]); g.fill();
    }
    return c;
  },
  hedge() {
    const W = 256, c = mk(W, W), g = c.getContext('2d'), r = lcg(79);
    g.fillStyle = '#9ec08a'; g.fillRect(0, 0, W, W);
    speckle(g, W, W, r, 700, ['rgba(20,70,20,0.45)', 'rgba(170,215,110,0.5)', 'rgba(10,50,16,0.5)'], 2, 6);
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * W, col = ['#f4f0e2', '#ff8fa8', '#ffd24a', '#c33a4a'][Math.floor(r() * 4)]; g.fillStyle = col; wrapDraw(g, W, W, (dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, 6.2832); g.fill(); }); }
    return c;
  },
  bark() {
    const W = 128, c = mk(W, W), g = c.getContext('2d'), r = lcg(83);
    g.fillStyle = '#7a6048'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 40; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(30,20,10,0.5)' : 'rgba(190,160,120,0.35)'; g.lineWidth = 1 + r() * 2; const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, W * 0.3, x - 6, W * 0.7, x + 2, W); g.stroke(); }
    return c;
  },
  wood() {
    const W = 256, c = mk(W, W), g = c.getContext('2d'), r = lcg(89);
    g.fillStyle = '#b8895a'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 46; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(60,34,12,0.35)' : 'rgba(240,210,160,0.30)'; g.lineWidth = 1 + r() * 1.6; const y = r() * W; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 6, W * 0.7, y + (r() - 0.5) * 6, W, y); g.stroke(); }
    return c;
  },
  water() {
    const W = 256, c = mk(W, W), g = c.getContext('2d'), r = lcg(97);
    g.fillStyle = '#9fd0e0'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = r() * W, w = 10 + r() * 26;
      wrapDraw(g, W, W, (dx, dy) => { g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(30,90,130,0.30)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + w / 2, y + dy - 3, x + dx + w, y + dy); g.stroke(); });
    }
    return c;
  },
  awning() {
    const c = mk(128, 64), g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff6e2' : '#c9473a'; g.fillRect(i * 16, 0, 16, 64); }
    return c;
  },
  puff() {
    const c = mk(64, 64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  },
  ripple() {
    const c = mk(128, 128), g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 52, 0, 6.2832); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 36, 0, 6.2832); g.stroke();
    return c;
  },
};

/** name -> THREE.CanvasTexture (cached). */
export function tex(THREE, name, { repeat = true } = {}) {
  const key = name;
  if (cache.has(key)) return cache.get(key);
  const c = BUILD[name]();
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Kerb stripes in the course's two colours (one texture per course theme). */
export function kerbTex(THREE, a, b) {
  const key = 'kerb' + a + b;
  if (cache.has(key)) return cache.get(key);
  const c = mk(64, 128), g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; g.fillRect(0, 64, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, 5, 128); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(59, 0, 5, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t); return t;
}

/** A vertical sky gradient, used as the scene background until the photographic sky has loaded and as a fallback. */
export function skyTex(THREE, stops) {
  const key = 'sky' + stops.join();
  if (cache.has(key)) return cache.get(key);
  const c = mk(4, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, stops[0]); gr.addColorStop(0.55, stops[1]); gr.addColorStop(1, stops[2]);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

/** The FINISH banner texture. */
export function bannerTex(THREE, text, bg = '#b8342a', fg = '#fff3d6', trim = '#f3c14a') {
  const key = 'ban' + text + bg;
  if (cache.has(key)) return cache.get(key);
  const c = mk(512, 128), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = trim; g.fillRect(0, 6, 512, 8); g.fillRect(0, 114, 512, 8);
  g.font = '700 82px "Fredoka", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(60,10,6,0.6)'; g.strokeText(text, 256, 66); g.fillStyle = fg; g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

export function clearTexCache() { cache.clear(); }
export { hex, lcg };
