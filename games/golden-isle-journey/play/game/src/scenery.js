// Painted, cached scenery. Every layer (sky, ridges, tree lines, city skylines, hall pillars, clouds, banyan trees)
// is painted ONCE into an offscreen sprite - gradient-mesh style: many soft overlapping radial gradients, lit
// masses, mottling, atmospheric haze - and then only blitted per frame (scrolled by wrapping a tile).
// Nothing here is per-frame vector work. Headless tests have no offscreen canvas, so it all draws nothing there.
import { mix, darken, sprite, stats } from './paint/kit.js';

const W = 720, H = 1560, TAU = Math.PI * 2;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- colour parsing: layers may be given as '#rrggbb' or 'rgba(r,g,b,a)'; the sprite is opaque, alpha applies at blit ----
export function parseCol(c) {
  if (c[0] === '#' && c.length === 7) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  const m = c.match(/[\d.]+/g) || [0, 0, 0];
  return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
}
const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const hexOf = (c) => toHex(parseCol(c));
const rgbaOf = (c, a) => { const [r, g, b] = parseCol(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
const RES = 0.5;

// A soft blob: a radial gradient ellipse that fades to nothing (the "mesh" primitive).
export function soft(g, x, y, rx, ry, rgb, a, rot = 0) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(rx, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
}
const rgbStr = (c) => { const [r, g, b] = parseCol(c); return `${r | 0},${g | 0},${b | 0}`; };

// ---------------------------------------------------------------- sky
export function skyP(ctx, stops, glow) {
  const key = 'sky|' + stops.join(',');
  const sp = sprite(key, W, H, 0, 0, 0.4, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, H);
    stops.forEach((c, i) => lg.addColorStop(i / (stops.length - 1), c));
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // gradient mesh: drifting patches of neighbouring stop colours, lighter toward the horizon
    for (let i = 0; i < 46; i++) {
      const y = hash(i * 3 + 1) * H, x = hash(i * 3 + 2) * W;
      const u = clamp(y / H * (stops.length - 1), 0, stops.length - 1), i0 = Math.floor(u), i1 = Math.min(stops.length - 1, i0 + 1);
      const c = mix(hexOf(stops[i0]), hexOf(stops[i1]), u - i0);
      const lit = hash(i * 7 + 5) > 0.5 ? mix(c, '#ffe0a8', 0.25) : mix(c, '#150a24', 0.3);
      soft(g, x, y, 180 + hash(i * 5) * 340, 60 + hash(i * 11) * 150, rgbStr(lit), 0.16 + hash(i) * 0.14, (hash(i * 13) - 0.5) * 0.5);
    }
    // long horizontal cloud banks catching the low light
    for (let i = 0; i < 14; i++) {
      const y = H * (0.18 + hash(i * 17) * 0.62), x = hash(i * 19) * W;
      const c = stops[Math.min(stops.length - 1, 2)];
      soft(g, x, y, 260 + hash(i) * 260, 14 + hash(i * 3) * 24, rgbStr(mix(hexOf(c), '#ffd8a0', 0.3)), 0.2, (hash(i * 23) - 0.5) * 0.08);
    }
  });
  if (sp.c) { stats.blits++; ctx.drawImage(sp.c, 0, 0, W, H); }
  if (glow) {
    const gr = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r), a = glow.alpha ?? 0.8;
    gr.addColorStop(0, `rgba(${glow.color},${a})`); gr.addColorStop(0.45, `rgba(${glow.color},${a * 0.35})`); gr.addColorStop(1, `rgba(${glow.color},0)`);
    ctx.fillStyle = gr; ctx.fillRect(glow.x - glow.r, glow.y - glow.r, glow.r * 2, glow.r * 2);
  }
}

// ---------------------------------------------------------------- tiling helper
// A wrapped strip: local origin at the base line, x in [0, P]. Content near the seam is drawn twice by `wrap`.
function tileSprite(key, P, up, down, res, fn) {
  return sprite(key, P, up + down, 0, up, res, fn);
}
function drawTile(ctx, sp, scroll, y, P) {
  if (!sp.c) return;
  stats.blits++;
  let x = -(((scroll % P) + P) % P);
  for (; x < W; x += P) ctx.drawImage(sp.c, x, y - sp.oy, sp.w, sp.h);
}
const wrap = (g, P, x, r, draw) => { draw(x); if (x - r < 0) draw(x + P); if (x + r > P) draw(x - P); };

// ---------------------------------------------------------------- ridges (hills with painted light)
export function ridgeP(ctx, { base, amp = 60, wl = 420, scroll = 0, color, seed = 0, bottom = H }) {
  const P = 2880, n = Math.max(1, Math.round(P / (TAU * wl))), kk = n / P * TAU;
  const alpha = parseCol(color)[3], hexc = hexOf(color), up = amp + 24, down = amp + 90;
  const key = `ridge|${hexc}|${amp}|${n}|${seed}`;
  const prof = (x) => 0.55 * Math.sin(x * kk + seed) + 0.3 * Math.sin(x * kk * 2 + seed * 1.7) + 0.15 * Math.sin(x * kk * 5 + seed * 2.9);
  const sp = tileSprite(key, P, up, down, RES, (g) => {
    const top = -amp - 12;
    const lg = g.createLinearGradient(0, top, 0, down);
    lg.addColorStop(0, mix(hexc, '#ffc880', 0.3)); lg.addColorStop(0.35, hexc); lg.addColorStop(1, darken(hexc, 0.3));
    g.fillStyle = lg; g.beginPath(); g.moveTo(0, down);
    for (let x = 0; x <= P; x += 16) g.lineTo(x, -amp * prof(x)); g.lineTo(P, down); g.closePath(); g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 90; i++) { // sunlit and shadowed mottling along the crest
      const x = hash(i * 3 + seed) * P, y = -amp * prof(x) + 8 + hash(i * 5 + seed) * amp * 0.9;
      const lit = hash(i * 7) > 0.45;
      soft(g, x, y, 60 + hash(i * 9) * 110, 16 + hash(i * 11) * 40, lit ? rgbStr(mix(hexc, '#ffd08a', 0.42)) : rgbStr(darken(hexc, 0.4)), lit ? 0.28 : 0.3);
    }
    const mg = g.createLinearGradient(0, -amp * 0.2, 0, down); mg.addColorStop(0, rgbaOf(mix(hexc, '#f8c890', 0.25), 0)); mg.addColorStop(1, rgbaOf(mix(hexc, '#f8c890', 0.25), 0.35));
    g.fillStyle = mg; g.fillRect(0, -amp, P, amp + down);
    g.restore();
    g.strokeStyle = rgbaOf(mix(hexc, '#ffd898', 0.6), 0.42); g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= P; x += 16) { const y = -amp * prof(x); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  });
  ctx.save(); if (alpha < 1) ctx.globalAlpha *= alpha;
  drawTile(ctx, sp, scroll, base, P);
  const yb = base + down;
  if (bottom > yb) { ctx.fillStyle = darken(hexc, 0.3); ctx.fillRect(0, yb - 1, W, bottom - yb + 1); }
  ctx.restore();
}

// ---------------------------------------------------------------- foliage
function leafMass(g, x, y, r, c0, sunK) {
  const gr = g.createRadialGradient(x + r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  gr.addColorStop(0, mix(c0, '#ffe8a8', sunK * 0.55)); gr.addColorStop(0.55, c0); gr.addColorStop(1, darken(c0, 0.28));
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.84, 0, 0, TAU); g.fill();
  // leaf clusters: ragged edge tufts and tonal flecks so it reads as foliage, not a ball
  const n = Math.max(10, Math.round(r * 0.5));
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU + hash(x * 0.37 + j) * 0.5, rr = r * (0.7 + hash(y * 0.11 + j * 3) * 0.42);
    const lx = x + Math.cos(a) * rr, ly = y + Math.sin(a) * rr * 0.84, up = Math.sin(a) < 0;
    g.fillStyle = up ? mix(c0, '#ffe8a8', sunK * 0.5) : darken(c0, 0.22 + hash(j) * 0.14);
    g.beginPath(); g.ellipse(lx, ly, r * 0.16, r * 0.075, a + 0.4, 0, TAU); g.fill();
  }
}
function canopy(g, cx, cy, spread, r, c0, seed, sunK = 0.3, count = 9, cut = null) {
  const list = [];
  for (let b = 0; b < count; b++) list.push([cx + (hash(seed + b * 3) - 0.5) * spread, cy + (hash(seed + b * 3 + 1) - 0.4) * spread * 0.55, r * (0.7 + hash(seed + b * 3 + 2) * 0.5)]);
  list.sort((a, b) => b[1] - a[1]);   // lower masses first, upper ones catch the light
  for (const [x, y, rr] of list) {
    leafMass(g, x, y, rr, c0, sunK);
    g.fillStyle = rgbaOf(mix(c0, '#fff0b0', 0.55), 0.3);
    for (let j = 0; j < 7; j++) { const a = -0.3 - hash(seed + b0(y) + j * 2) * 1.6; g.beginPath(); g.ellipse(x + Math.cos(a) * rr * 0.7, y + Math.sin(a) * rr * 0.6, rr * 0.12, rr * 0.055, a, 0, TAU); g.fill(); }
  }
  if (cut) {   // dappled light coming through
    g.fillStyle = cut;
    for (let b = 0; b < 12; b++) { const [x, y, rr] = list[b % list.length]; g.beginPath(); g.ellipse(x + (hash(seed + b * 5) - 0.5) * rr, y - rr * 0.3 + (hash(seed + b * 7) - 0.5) * rr * 0.5, 6, 2.6, hash(seed + b) * 3, 0, TAU); g.fill(); }
  }
}
const b0 = (v) => Math.floor(v * 7);

export function treeP(ctx, { base, scroll = 0, color, seed = 0, h = 320, gap = 150, cut = null }) {
  const K = Math.max(4, Math.round(2400 / gap)), P = K * gap, hexc = hexOf(color), alpha = parseCol(color)[3];
  const up = h * 1.6, down = 40;
  const key = `tree|${hexc}|${seed}|${h}|${gap}|${cut ? 1 : 0}`;
  const sp = tileSprite(key, P, up, down, RES, (g) => {
    for (let i = 0; i < K; i++) {
      const k = i * 13 + seed, x = i * gap + hash(k) * gap * 0.6 + gap * 0.2, th = h * (0.7 + hash(k + 1) * 0.6), tw = 10 + hash(k + 2) * 10;
      wrap(g, P, x, th * 0.5, (xx) => {
        // trunk: bark gradient with a lit edge
        const bg = g.createLinearGradient(xx - tw, 0, xx + tw, 0); bg.addColorStop(0, darken(hexc, 0.3)); bg.addColorStop(0.6, mix(hexc, '#8a6a3a', 0.28)); bg.addColorStop(1, darken(hexc, 0.15));
        g.fillStyle = bg; g.beginPath(); g.moveTo(xx - tw, 6); g.quadraticCurveTo(xx - tw * 0.4, -th * 0.5, xx - tw * 0.45, -th * 0.8); g.lineTo(xx + tw * 0.45, -th * 0.8); g.quadraticCurveTo(xx + tw * 0.4, -th * 0.5, xx + tw, 6); g.fill();
        canopy(g, xx, -th * 0.92, th * 0.8, th * 0.12, hexc, k * 3, 0.36, 26, cut);
      });
    }
    // low ground mist at the trunks
    const mg = g.createLinearGradient(0, -h * 0.5, 0, down); mg.addColorStop(0, rgbaOf(mix(hexc, '#ffe0a0', 0.4), 0)); mg.addColorStop(1, rgbaOf(mix(hexc, '#ffe0a0', 0.4), 0.3));
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = mg; g.fillRect(0, -h * 0.5, P, h * 0.5 + down);
  });
  ctx.save(); if (alpha < 1) ctx.globalAlpha *= alpha;
  drawTile(ctx, sp, scroll, base, P);
  ctx.restore();
}

// A great banyan-like tree at the screen edge, painted once. `side` -1 = left edge, 1 = right edge.
export function banyanP(ctx, { x, base, h = 900, side = 1, t = 0, rm = false, color = '#06120e', seed = 0 }) {
  const key = `banyan|${color}|${h}|${seed}`, res = 0.5;
  const sp = sprite(key, 900, h + 240 + 500 * 0, 460, h + 200, res, (g) => {
    const bk = g.createLinearGradient(-150, 0, 190, 0); bk.addColorStop(0, darken(color, 0.1)); bk.addColorStop(0.5, mix(color, '#6a5a2a', 0.36)); bk.addColorStop(1, mix(color, '#3a4a20', 0.2));
    g.fillStyle = bk;
    g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(-40, -60, -30, -h * 0.5); g.lineTo(-20, -h); g.lineTo(70, -h); g.quadraticCurveTo(80, -h * 0.5, 130, -40); g.lineTo(190, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.34)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const gx = -20 + i * 12; g.beginPath(); g.moveTo(gx - i * 8, 0); g.quadraticCurveTo(gx + (hash(i + seed) - 0.5) * 30, -h * 0.4, gx + 6, -h * 0.95); g.stroke(); }
    g.strokeStyle = 'rgba(238,220,140,0.34)'; g.lineWidth = 6; g.beginPath(); g.moveTo(66, -h * 0.9); g.quadraticCurveTo(80, -h * 0.5, 126, -50); g.stroke();
    // aerial roots
    for (let i = 0; i < 10; i++) {
      const rx = -50 - i * 32 + hash(i + seed) * 20, top = -h + 40, len = 380 + hash(i * 7 + seed) * 460;
      g.strokeStyle = mix(color, '#5a4620', 0.34); g.lineWidth = 5 + hash(i * 2 + seed) * 6; g.beginPath(); g.moveTo(rx, top); g.quadraticCurveTo(rx + 8, top + len * 0.5, rx + 12, top + len); g.stroke();
      g.strokeStyle = 'rgba(238,220,140,0.2)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(rx + 2, top); g.quadraticCurveTo(rx + 10, top + len * 0.5, rx + 14, top + len); g.stroke();
    }
    // canopy: many lit leaf masses
    const c0 = mix(color, '#2a5a34', 0.35);
    canopy(g, 20, -h - 10, 540, 130, c0, seed * 5 + 3, 0.34, 20, 'rgba(238,230,150,0.32)');
  });
  const sw = rm ? 0 : Math.sin(t * 0.5 + seed) * 0.012;
  ctx.save(); ctx.translate(x, base); ctx.scale(side, 1); ctx.transform(1, 0, sw, 1, 0, 0);
  if (sp.c) { stats.blits++; ctx.drawImage(sp.c, -sp.ox, -sp.oy, sp.w, sp.h); }
  ctx.restore();
}

// ---------------------------------------------------------------- clouds (each one painted once)
export function cloudP(ctx, { y, h = 300, scroll = 0, color, n = 6, seed = 0, scale = 1 }) {
  const span = W + 500, hexc = hexOf(color), alpha = parseCol(color)[3];
  ctx.save(); if (alpha < 1) ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const k = i * 11 + seed;
    const x = ((hash(k) * span - scroll * (0.5 + hash(k + 1) * 0.5)) % span + span) % span - 250;
    const cy = y + hash(k + 2) * h, s = (0.6 + hash(k + 3) * 0.9) * scale;
    const sp = sprite(`cloud|${hexc}|${k}|${s.toFixed(2)}`, 420 * s, 130 * s, 210 * s, 70 * s, 0.6, (g) => {
      const base = parseCol(hexc);
      for (let j = 0; j < 16; j++) {
        const px = (hash(k * 3 + j) - 0.5) * 300 * s, py = (hash(k * 3 + j + 40) - 0.5) * 50 * s - Math.abs(px) * 0.06 * 0;
        const r = (30 + hash(k * 3 + j + 80) * 44) * s;
        soft(g, px, py, r * 1.9, r * 0.62, `${base[0]},${base[1]},${base[2]}`, 0.75);
      }
      for (let j = 0; j < 8; j++) { const px = (hash(k * 5 + j) - 0.3) * 240 * s, py = -14 * s - hash(k * 5 + j + 9) * 22 * s; soft(g, px, py, 70 * s, 12 * s, rgbStr(mix(hexc, '#ffd8a8', 0.6)), 0.38); }
    });
    if (sp.c) { stats.blits++; ctx.drawImage(sp.c, x - sp.ox, cy - sp.oy, sp.w, sp.h); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- skylines
export function dome(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x - r, y + 1);
  ctx.bezierCurveTo(x - r * 1.25, y - r * 0.9, x - r * 0.35, y - r * 1.15, x, y - r * 1.7);
  ctx.bezierCurveTo(x + r * 0.35, y - r * 1.15, x + r * 1.25, y - r * 0.9, x + r, y + 1);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 1.5, y - r * 2.1, 3, r * 0.5);
}
function litDome(g, x, y, r, c) {
  const gr = g.createRadialGradient(x + r * 0.35, y - r * 0.9, r * 0.05, x, y - r * 0.5, r * 1.5);
  gr.addColorStop(0, mix(c, '#ffe0a0', 0.6)); gr.addColorStop(0.45, mix(c, '#e8a860', 0.22)); gr.addColorStop(1, darken(c, 0.35));
  g.fillStyle = gr; dome(g, x, y, r);
  g.strokeStyle = rgbaOf(mix(c, '#ffe0a0', 0.5), 0.22); g.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * r * 0.36, y); g.quadraticCurveTo(x + i * r * 0.5, y - r * 0.9, x + i * r * 0.04, y - r * 1.6); g.stroke(); }
  g.fillStyle = '#f2c46a'; g.beginPath(); g.arc(x, y - r * 2.15, 2.6, 0, TAU); g.fill();
}
function archWindow(g, wx, wy, lit, dark) {
  if (lit) {
    g.save(); g.globalCompositeOperation = 'lighter'; soft(g, wx, wy + 4, 26, 30, lit, 0.4); g.restore();
    const wg = g.createLinearGradient(0, wy - 8, 0, wy + 14); wg.addColorStop(0, `rgba(${lit},0.98)`); wg.addColorStop(1, `rgba(${lit},0.72)`); g.fillStyle = wg;
  } else g.fillStyle = dark;
  g.beginPath(); g.moveTo(wx - 7, wy + 13); g.lineTo(wx - 7, wy); g.arc(wx, wy, 7, Math.PI, 0); g.lineTo(wx + 7, wy + 13); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,10,20,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(wx, wy - 7); g.lineTo(wx, wy + 13); g.stroke();
}
export function skylineP(ctx, { base, scroll = 0, color, seed = 0, h = 300, gap = 170, kind = 'palace', lit = null }) {
  const K = Math.max(4, Math.round(2400 / gap)), P = K * gap, hexc = hexOf(color), alpha = parseCol(color)[3];
  const up = h + 320, down = 40;
  const key = `sky|${hexc}|${seed}|${h}|${gap}|${kind}|${lit || 0}`;
  const dark = darken(hexc, 0.45);
  const sp = tileSprite(key, P, up, down, RES, (g) => {
    for (let i = 0; i < K; i++) {
      const k = i * 17 + seed;
      const bw = gap * (0.62 + hash(k) * 0.34), bh = h * (0.45 + hash(k + 1) * 0.55), x = i * gap + (gap - bw) / 2;
      wrap(g, P, x + bw / 2, bw, (xc) => {
        const x0 = xc - bw / 2;
        const hg = g.createLinearGradient(x0, 0, x0 + bw, 0); hg.addColorStop(0, darken(hexc, 0.12)); hg.addColorStop(0.55, hexc); hg.addColorStop(1, mix(hexc, kind === 'lanka' ? '#ffcf78' : '#ffb870', kind === 'lanka' ? 0.34 : 0.24));
        g.fillStyle = hg; g.fillRect(x0, -bh, bw, bh + 8);
        const vg = g.createLinearGradient(0, -bh - 60, 0, 6); vg.addColorStop(0, 'rgba(255,200,130,0.16)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,0,10,0.28)');
        g.fillStyle = vg; g.fillRect(x0, -bh, bw, bh + 8);
        // cornice + carved bands
        g.fillStyle = rgbaOf(mix(hexc, '#ffd898', 0.5), 0.34); g.fillRect(x0 - 4, -bh - 3, bw + 8, 5);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0 - 4, -bh + 2, bw + 8, 4);
        if (kind === 'palace') {
          const r = bw * (0.22 + hash(k + 2) * 0.12);
          litDome(g, xc, -bh, r, hexc);
          if (hash(k + 3) > 0.4) for (const dx of [0.14, 0.86]) {   // small open pavilions on the roof corners
            const px = x0 + bw * dx, pr = r * 0.42, ph = r * 0.7;
            g.fillStyle = dark; g.fillRect(px - pr, -bh - ph, 3, ph); g.fillRect(px + pr - 3, -bh - ph, 3, ph);
            litDome(g, px, -bh - ph, pr, hexc);
          }
          // a great arched gate low in the front
          g.fillStyle = darken(hexc, 0.5); g.beginPath(); g.moveTo(xc - bw * 0.14, 8); g.lineTo(xc - bw * 0.14, -bh * 0.28); g.arc(xc, -bh * 0.28, bw * 0.14, Math.PI, 0); g.lineTo(xc + bw * 0.14, 8); g.fill();
        } else if (kind === 'lanka') {
          const tiers = 3 + Math.floor(hash(k + 2) * 3), gold = lit ? `rgba(${lit},0.6)` : 'rgba(255,214,130,0.5)';
          let tw = bw * 0.7, ty = -bh;
          for (let j = 0; j < tiers; j++) {
            const th = 30 + hash(k + j) * 16;
            const tg = g.createLinearGradient(xc - tw / 2, 0, xc + tw / 2, 0); tg.addColorStop(0, darken(hexc, 0.1)); tg.addColorStop(0.65, mix(hexc, '#ffcf78', 0.2)); tg.addColorStop(1, mix(hexc, '#ffe4a0', 0.4));
            g.fillStyle = tg; g.beginPath();
            g.moveTo(xc - tw / 2 - 10, ty); g.lineTo(xc + tw / 2 + 10, ty); g.lineTo(xc + tw / 2 - 4, ty - 10); g.lineTo(xc + tw * 0.36, ty - th); g.lineTo(xc - tw * 0.36, ty - th); g.lineTo(xc - tw / 2 + 4, ty - 10); g.closePath(); g.fill();
            g.strokeStyle = gold; g.lineWidth = 2.2; g.beginPath(); g.moveTo(xc - tw / 2 - 10, ty); g.lineTo(xc + tw / 2 + 10, ty); g.stroke();
            g.fillStyle = gold; g.beginPath(); g.arc(xc - tw / 2 - 10, ty, 2.5, 0, TAU); g.arc(xc + tw / 2 + 10, ty, 2.5, 0, TAU); g.fill();
            g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(xc - tw * 0.2, ty - th * 0.8, tw * 0.4, th * 0.55);
            ty -= th; tw *= 0.72;
          }
          g.fillStyle = gold; g.fillRect(xc - 1.5, ty - 34, 3, 36); g.beginPath(); g.arc(xc, ty - 36, 6, 0, TAU); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.3)'; for (let m = 0; m < bw / 14; m++) g.fillRect(x0 + m * 14 + 2, -bh - 9, 8, 7);   // crenellations
        } else {
          g.fillStyle = dark; g.fillRect(x0 - 5, -bh - 8, bw + 10, 10);
          if (hash(k + 4) > 0.5) { g.fillStyle = hg; g.fillRect(x0 + bw * 0.2, -bh - 40, bw * 0.3, 34); g.fillStyle = dark; g.fillRect(x0 + bw * 0.2 - 3, -bh - 44, bw * 0.3 + 6, 6); }
        }
        const cols = Math.max(1, Math.floor(bw / 40)), rows = Math.max(1, Math.floor(bh / 70));
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
          if (lit && hash(k + c * 7 + r * 11 + 9) > 0.55) continue;
          if (!lit && hash(k + c * 7 + r * 11 + 9) > 0.35) continue;
          archWindow(g, x0 + (c + 0.5) * (bw / cols), -bh + 34 + r * 66, lit, dark);
        }
      });
    }
    // haze at the base so layers sit back into the air
    const mg = g.createLinearGradient(0, -h * 0.6, 0, down); mg.addColorStop(0, rgbaOf(mix(hexc, '#ffc890', 0.4), 0)); mg.addColorStop(1, rgbaOf(mix(hexc, '#ffc890', 0.4), 0.4));
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = mg; g.fillRect(0, -h * 0.6, P, h * 0.6 + down);
  });
  ctx.save(); if (alpha < 1) ctx.globalAlpha *= alpha;
  drawTile(ctx, sp, scroll, base, P);
  ctx.restore();
}

// ---------------------------------------------------------------- hall: carved pillars, scalloped arches (lamps are drawn live by stage.hall)
export function hallP(ctx, { scroll = 0, color, top = 0, floor, gap = 240 }) {
  const K = Math.round(1440 / gap), P = K * gap, hexc = hexOf(color), up = floor - top + 60;
  const key = `hall|${hexc}|${top}|${floor}|${gap}`;
  const sp = sprite(key, P, up + 50, 0, up, 0.55, (g) => {
    const Y = (y) => y - floor;            // sprite space: floor line at y = 0
    for (let i = 0; i < K; i++) {
      const x = i * gap;
      wrap(g, P, x, 60, (xx) => {
        // wall niche between pillars: warm recess
        const ng = g.createLinearGradient(0, Y(top + 200), 0, Y(floor)); ng.addColorStop(0, rgbaOf(mix(hexc, '#e8a060', 0.25), 0.5)); ng.addColorStop(1, rgbaOf(mix(hexc, '#e8a060', 0.1), 0.6));
        g.fillStyle = ng; g.beginPath(); g.moveTo(xx + 46, Y(floor - 110)); g.lineTo(xx + 46, Y(top + 340)); g.quadraticCurveTo(xx + 46, Y(top + 250), xx + gap / 2, Y(top + 230)); g.quadraticCurveTo(xx + gap - 46, Y(top + 250), xx + gap - 46, Y(top + 340)); g.lineTo(xx + gap - 46, Y(floor - 110)); g.closePath(); g.fill();
        // scalloped arch to the next pillar
        g.fillStyle = hexc; g.beginPath();
        g.moveTo(xx, Y(top)); g.lineTo(xx + gap, Y(top)); g.lineTo(xx + gap, Y(top + 170));
        const n = 5;
        for (let s = n; s > 0; s--) {
          const x1 = xx + gap * (s / n), xm = xx + gap * ((s - 0.5) / n), lift = 120 * Math.sin(((s - 0.5) / n) * Math.PI);
          g.quadraticCurveTo(xm, Y(top + 170 - lift - 44), x1 - gap / n, Y(top + 170 - 120 * Math.sin(((s - 1) / n) * Math.PI)));
        }
        g.closePath(); g.fill();
        const ag = g.createLinearGradient(0, Y(top), 0, Y(top + 170)); ag.addColorStop(0, 'rgba(0,0,0,0.35)'); ag.addColorStop(1, 'rgba(255,190,110,0.12)'); g.fillStyle = ag; g.fill();
        g.lineWidth = 3.2; g.strokeStyle = 'rgba(244,196,100,0.62)'; g.stroke();
        g.lineWidth = 1.2; g.strokeStyle = 'rgba(244,196,100,0.3)'; g.save(); g.translate(0, 14); g.stroke(); g.restore();
        // fluted pillar: lit edge, carved inlay, gold capital and plinth
        const pg = g.createLinearGradient(xx - 24, 0, xx + 24, 0); pg.addColorStop(0, 'rgba(0,0,0,0.5)'); pg.addColorStop(0.5, 'rgba(255,196,120,0.34)'); pg.addColorStop(0.72, 'rgba(255,214,150,0.24)'); pg.addColorStop(1, 'rgba(0,0,0,0.42)');
        g.fillStyle = hexc; g.fillRect(xx - 24, Y(top + 150), 48, floor - top - 150);
        g.fillStyle = pg; g.fillRect(xx - 24, Y(top + 150), 48, floor - top - 150);
        g.strokeStyle = 'rgba(244,196,100,0.4)'; g.lineWidth = 1.6;
        for (const dx of [-12, 0, 12]) { g.beginPath(); g.moveTo(xx + dx, Y(top + 190)); g.lineTo(xx + dx, Y(floor - 60)); g.stroke(); }
        g.fillStyle = 'rgba(244,196,100,0.66)';
        for (let kk = 0; kk < 6; kk++) { const yy = top + 230 + kk * ((floor - top - 330) / 5); g.beginPath(); g.moveTo(xx, Y(yy - 8)); g.lineTo(xx + 7, Y(yy)); g.lineTo(xx, Y(yy + 8)); g.lineTo(xx - 7, Y(yy)); g.fill(); }
        g.fillStyle = hexc; g.fillRect(xx - 38, Y(floor - 40), 76, 44); g.fillRect(xx - 36, Y(top + 150), 72, 28);
        g.fillStyle = 'rgba(244,196,100,0.78)'; g.fillRect(xx - 36, Y(top + 150), 72, 5); g.fillRect(xx - 36, Y(top + 173), 72, 3); g.fillRect(xx - 38, Y(floor - 40), 76, 4);
        // capital brackets
        g.fillStyle = 'rgba(244,196,100,0.5)'; g.beginPath(); g.moveTo(xx - 36, Y(top + 178)); g.quadraticCurveTo(xx - 56, Y(top + 186), xx - 62, Y(top + 214)); g.lineTo(xx - 34, Y(top + 190)); g.fill();
        g.beginPath(); g.moveTo(xx + 36, Y(top + 178)); g.quadraticCurveTo(xx + 56, Y(top + 186), xx + 62, Y(top + 214)); g.lineTo(xx + 34, Y(top + 190)); g.fill();
      });
    }
    // polished floor reflection line
    const fg = g.createLinearGradient(0, -6, 0, 40); fg.addColorStop(0, 'rgba(255,200,120,0.18)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fillRect(0, 0, P, 40);
  });
  // sprite local y=0 is `floor` -> blit so that y0 = floor - sp.oy
  drawTile(ctx, sp, scroll, floor, P);
}

// ---------------------------------------------------------------- walls and garden trees (Lanka terraces, Ayodhya rooftops)
const patterns = new WeakMap();
function wallSprite(glow) {
  return sprite('wallpat|' + glow, 240, 360, 0, 0, 0.6, (g) => {
    for (let i = 0; i < 40; i++) soft(g, hash(i * 3) * 240, hash(i * 5 + 1) * 360, 40 + hash(i) * 60, 20 + hash(i * 7) * 40, hash(i * 11) > 0.8 ? '150,170,255' : '0,0,20', hash(i * 11) > 0.8 ? 0.03 : 0.1);
    g.lineWidth = 1.2;
    for (let r = 0; r < 12; r++) {
      const y = r * 30 + 0.5;
      g.strokeStyle = 'rgba(0,0,10,0.16)'; g.beginPath(); g.moveTo(0, y); g.lineTo(240, y); g.stroke();
      g.strokeStyle = 'rgba(255,220,170,0.05)'; g.beginPath(); g.moveTo(0, y + 1.5); g.lineTo(240, y + 1.5); g.stroke();
      g.strokeStyle = 'rgba(0,0,10,0.11)'; g.beginPath();
      for (let x = (r % 2) * 40; x < 240; x += 80) { g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 30); }
      g.stroke();
    }
    for (const [wx, wy, on] of [[60, 66, 1], [180, 66, 0], [60, 216, 0], [180, 216, 1]]) {
      // recessed arched window with a carved surround
      g.fillStyle = 'rgba(0,0,10,0.5)'; g.beginPath(); g.moveTo(wx - 17, wy + 46); g.lineTo(wx - 17, wy); g.arc(wx, wy, 17, Math.PI, 0); g.lineTo(wx + 17, wy + 46); g.fill();
      if (on) { g.save(); g.globalCompositeOperation = 'lighter'; soft(g, wx, wy + 14, 46, 52, glow, 0.36); g.restore(); }
      const wg = g.createLinearGradient(0, wy - 12, 0, wy + 44); wg.addColorStop(0, on ? `rgba(${glow},0.95)` : 'rgba(6,8,30,0.9)'); wg.addColorStop(1, on ? `rgba(${glow},0.6)` : 'rgba(10,12,40,0.9)');
      g.fillStyle = wg; g.beginPath(); g.moveTo(wx - 12, wy + 44); g.lineTo(wx - 12, wy); g.arc(wx, wy, 12, Math.PI, 0); g.lineTo(wx + 12, wy + 44); g.fill();
      g.strokeStyle = 'rgba(244,196,100,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(wx - 15, wy + 46); g.lineTo(wx - 15, wy); g.arc(wx, wy, 15, Math.PI, 0); g.lineTo(wx + 15, wy + 46); g.stroke();
      g.strokeStyle = 'rgba(30,10,20,0.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(wx, wy - 12); g.lineTo(wx, wy + 44); g.moveTo(wx - 12, wy + 18); g.lineTo(wx + 12, wy + 18); g.stroke();
      g.fillStyle = 'rgba(244,196,100,0.5)'; g.fillRect(wx - 20, wy + 46, 40, 4);
    }
  });
}
// A lit stone wall with carved windows: base colour, moon/lamp light falling from the top, gold cornice.
export function wall(ctx, x, y, w, h, base, { glow = '255,190,110', top = 0.14 } = {}) {
  const gr = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 420));
  gr.addColorStop(0, mix(base, '#9aa8ff', top)); gr.addColorStop(1, base);
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  const sp = wallSprite(glow);
  if (sp.c) {
    let p = patterns.get(sp.c);
    if (!p) { p = ctx.createPattern(sp.c, 'repeat'); patterns.set(sp.c, p); }
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y); ctx.scale(1 / 0.6, 1 / 0.6); ctx.fillStyle = p; ctx.fillRect(0, 0, w * 0.6, h * 0.6); ctx.restore();
  }
  ctx.fillStyle = 'rgba(244,196,100,0.62)'; ctx.fillRect(x, y + 2, w, 3);
  ctx.fillStyle = 'rgba(0,0,10,0.28)'; ctx.fillRect(x, y + 5, w, 10);
}
export function gardenTree(ctx, x, y, s, color = '#0c2a26', seed = 0, rim = '#b8c8ff') {
  const sp = sprite(`gtree|${color}|${seed}|${rim}`, 320, 340, 160, 300, 0.6, (g) => {
    const bg = g.createLinearGradient(-9, 0, 9, 0); bg.addColorStop(0, darken(color, 0.3)); bg.addColorStop(1, mix(color, '#6a6a5a', 0.3));
    g.fillStyle = bg; g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-4, -120, -7, -170); g.lineTo(7, -170); g.quadraticCurveTo(4, -120, 14, 0); g.fill();
    canopy(g, 0, -205, 210, 44, color, seed * 7 + 2, 0.2, 16, null);
    g.fillStyle = rgbaOf(rim, 0.22); for (let j = 0; j < 20; j++) { g.beginPath(); g.ellipse((hash(j + seed) - 0.3) * 120 - 20, -250 - hash(j * 3 + seed) * 50, 5, 2.2, hash(j) * 3, 0, TAU); g.fill(); }
  });
  if (sp.c) { stats.blits++; ctx.drawImage(sp.c, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s); }
}
export function moon(ctx, x, y, r, rgb = '230,236,255', wax = 0.2) {
  const sp = sprite(`moon|${rgb}|${r}`, r * 2 + 8, r * 2 + 8, r + 4, r + 4, 1, (g) => {
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, `rgb(${rgb})`); gr.addColorStop(1, mix(hexOf(`rgb(${rgb})`), '#8a90c0', 0.5));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.save(); g.clip();
    for (const [dx, dy, rr] of [[-0.35, 0.1, 0.24], [0.2, -0.3, 0.16], [0.28, 0.32, 0.2], [-0.1, -0.45, 0.1]]) soft(g, dx * r, dy * r, rr * r, rr * r, '120,130,170', 0.35);
    g.restore();
  });
  soft(ctx, x, y, r * 4.5, r * 4.5, rgbStr(`rgb(${rgb})`), 0.22 + wax);
  if (sp.c) { stats.blits++; ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h); }
}
export { soft as softBlob };

// A standard on a pole: gold finial, painted swallow-tail cloth with a bordered field, swaying in the wind. (x, y) = pole foot.
export function banner(ctx, x, y, h, t = 0, cloth = '#b8321c', rm = false) {
  const sp = sprite(`banner|${cloth}`, 120, 200, 20, 190, 1, (g) => {
    const pg = g.createLinearGradient(-3, 0, 3, 0); pg.addColorStop(0, '#6a4a1a'); pg.addColorStop(0.5, '#e6bc5a'); pg.addColorStop(1, '#5a3a10');
    g.fillStyle = pg; g.fillRect(-2.5, -180, 5, 180);
    g.fillStyle = '#f2c46a'; g.beginPath(); g.arc(0, -184, 6, 0, TAU); g.fill(); g.beginPath(); g.moveTo(0, -206); g.lineTo(4, -190); g.lineTo(-4, -190); g.closePath(); g.fill();
    const cg = g.createLinearGradient(0, -170, 90, -110); cg.addColorStop(0, mix(cloth, '#ffd08a', 0.35)); cg.addColorStop(0.5, cloth); cg.addColorStop(1, darken(cloth, 0.4));
    g.fillStyle = cg; g.beginPath(); g.moveTo(2, -172); g.quadraticCurveTo(50, -180, 96, -160); g.lineTo(76, -140); g.lineTo(96, -118); g.quadraticCurveTo(50, -112, 2, -118); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(248,204,100,0.9)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(248,204,100,0.85)'; g.beginPath(); g.moveTo(26, -145); g.lineTo(36, -156); g.lineTo(46, -145); g.lineTo(36, -134); g.closePath(); g.fill();
    for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(0,0,0,${0.1 + hash(i) * 0.1})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(12 + i * 14, -170 + i * 2); g.quadraticCurveTo(14 + i * 14, -145, 12 + i * 14, -118 + i); g.stroke(); }
  });
  const k = h / 190, sw = rm ? 0 : Math.sin(t * 2.4 + x * 0.05) * 0.06;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.transform(1, 0, sw, 1, 0, 0);
  if (sp.c) { stats.blits++; ctx.drawImage(sp.c, -sp.ox, -sp.oy, sp.w, sp.h); }
  ctx.restore();
}
