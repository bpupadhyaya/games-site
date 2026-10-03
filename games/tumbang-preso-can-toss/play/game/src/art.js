// Drawing primitives for the street scene: the baked dirt ground, the wall and kerbs, the tin can, the slippers and the
// round token players. Everything is lit geometry projected through the one fixed camera (view.js), so shapes keep true
// perspective: nothing is a flat sprite. Pure drawing, no state.
import { CAN, FIELD, SLIP, HOME_SLOTS } from './sim.js';
export { FONT } from './ui.js';

const TAU = Math.PI * 2;
export const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- host (off-screen surfaces) -------------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}

// ---- palette -------------------------------------------------------------------------------------------------------------
export const PAWN = {
  you: { main: '#f2b632', hi: '#ffe08a', dark: '#9a6a0a', name: 'You' },
  taya: { main: '#d4322e', hi: '#ff8f7c', dark: '#7a1210', name: 'Guard' },
  a: { main: '#25a39a', hi: '#8ff0e4', dark: '#0d5a55', name: 'Pia' },
  b: { main: '#8a62d6', hi: '#cdb4ff', dark: '#432a82', name: 'Tina' },
  c: { main: '#f2b632', hi: '#ffe08a', dark: '#9a6a0a', name: 'Rey' },
};
export const pawnLook = (a, youId) => {
  if (a.role === 'taya') return PAWN.taya;
  if (a.id === youId) return PAWN.you;
  return a.slot < -1 ? PAWN.a : a.slot > 1 ? PAWN.b : PAWN.c;
};
export const hex = (c, k) => {
  const n = parseInt(c.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k)), g = Math.min(255, Math.round(((n >> 8) & 255) * k)), b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
};
const mix = (c1, c2, t) => {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const f = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return `rgb(${f(16)},${f(8)},${f(0)})`;
};

// ---- the ground texture: a top-down picture of the yard, baked once, then laid onto the fixed camera in strips ---------------
export const TEX = { ppm: 90, x0: -4.0, x1: 4.0, z0: -3.8, z1: 9.0 };
const TW = Math.round((TEX.x1 - TEX.x0) * TEX.ppm), TH = Math.round((TEX.z1 - TEX.z0) * TEX.ppm);
const tx = (x) => (x - TEX.x0) * TEX.ppm, tz = (z) => (z - TEX.z0) * TEX.ppm;

export function startTextureBake() {
  const cv = makeCanvas(TW, TH);
  if (!cv) return { failed: true, step: () => null };
  const c = cv.getContext('2d');
  let stage = 0;
  const blot = (r, n, rmin, rmax, col, amin, amax) => {
    for (let i = 0; i < n; i++) {
      const x = r() * TW, y = r() * TH, rad = rmin + r() * (rmax - rmin), al = amin + r() * (amax - amin);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, col.replace('A', String(al))); g.addColorStop(1, col.replace('A', '0'));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
  };
  const chalkLine = (r, x0, y0, x1, y1, w) => {
    for (let pass = 0; pass < 4; pass++) {
      c.strokeStyle = `rgba(250,246,236,${0.34 + r() * 0.22})`; c.lineWidth = w * (0.55 + r() * 0.5); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0 + (r() - 0.5) * 2, y0 + (r() - 0.5) * 2);
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 24));
      for (let i = 1; i <= n; i++) { const t = i / n; c.lineTo(x0 + (x1 - x0) * t + (r() - 0.5) * 2.4, y0 + (y1 - y0) * t + (r() - 0.5) * 2.4); }
      c.stroke();
    }
  };
  const stages = [
    () => {
      // base dirt and large soft patches of dust and wear
      c.fillStyle = '#8c7861'; c.fillRect(0, 0, TW, TH);
      const g = c.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, '#85715b'); g.addColorStop(0.5, '#9a846b'); g.addColorStop(1, '#8a765f');
      c.fillStyle = g; c.fillRect(0, 0, TW, TH);
      const r = lcg(2024);
      blot(r, 38, 50, 150, 'rgba(196,172,138,A)', 0.1, 0.22);
      blot(r, 34, 40, 120, 'rgba(70,54,42,A)', 0.08, 0.2);
      // the worn patch round the can and in front of the toe line
      let w = c.createRadialGradient(tx(0), tz(CAN.z), 0, tx(0), tz(CAN.z), 1.7 * TEX.ppm);
      w.addColorStop(0, 'rgba(60,46,36,0.28)'); w.addColorStop(1, 'rgba(60,46,36,0)'); c.fillStyle = w; c.fillRect(0, 0, TW, TH);
      const hw = c.createLinearGradient(0, tz(-1.9), 0, tz(0.2)); hw.addColorStop(0, 'rgba(214,194,160,0.0)'); hw.addColorStop(0.7, 'rgba(214,194,160,0.2)'); hw.addColorStop(1, 'rgba(214,194,160,0.05)');
      c.fillStyle = hw; c.fillRect(tx(-3.3), tz(-1.9), tx(3.3) - tx(-3.3), tz(0.2) - tz(-1.9));
    },
    () => {
      // grain, pebbles, little scuffs
      const r = lcg(777);
      for (let i = 0; i < 9000; i++) {
        const x = r() * TW, y = r() * TH, rad = 0.5 + r() * 1.3;
        c.fillStyle = r() < 0.5 ? `rgba(40,30,24,${0.08 + r() * 0.16})` : `rgba(235,214,182,${0.08 + r() * 0.18})`;
        c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
      }
      for (let i = 0; i < 90; i++) {
        const x = r() * TW, y = r() * TH, rad = 1.4 + r() * 2.8;
        c.fillStyle = 'rgba(40,30,24,0.28)'; c.beginPath(); c.arc(x + 1.2, y + 1.6, rad, 0, TAU); c.fill();
        c.fillStyle = `rgba(${150 + (r() * 60) | 0},${130 + (r() * 50) | 0},${105 + (r() * 40) | 0},0.9)`; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,246,228,0.35)'; c.beginPath(); c.arc(x - rad * 0.25, y - rad * 0.3, rad * 0.45, 0, TAU); c.fill();
      }
    },
    () => {
      // cracks and tyre marks
      const r = lcg(31337);
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 0; i < 14; i++) {
        let x = r() * TW, y = r() * TH, a = r() * TAU;
        c.strokeStyle = `rgba(36,26,20,${0.26 + r() * 0.2})`; c.lineWidth = 0.8 + r() * 1.4;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 9; k++) { a += (r() - 0.5) * 1.0; x += Math.cos(a) * (14 + r() * 22); y += Math.sin(a) * (14 + r() * 22); c.lineTo(x, y); }
        c.stroke();
      }
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = 'rgba(52,40,32,0.14)'; c.lineWidth = 12 + r() * 8;
        c.beginPath(); const x0 = r() * TW; c.moveTo(x0, 0);
        c.bezierCurveTo(x0 + 60, TH * 0.3, x0 - 70, TH * 0.6, x0 + 20, TH); c.stroke();
      }
    },
    () => {
      // kerbs, gutter and the chalk: toe line, circle, footprints
      const r = lcg(4242);
      for (const side of [-1, 1]) {
        const xa = side < 0 ? 0 : tx(3.3), xb = side < 0 ? tx(-3.3) : TW;
        const g = c.createLinearGradient(xa, 0, xb, 0);
        g.addColorStop(side < 0 ? 0 : 0, '#3a3029'); g.addColorStop(1, '#3a3029');
        c.fillStyle = '#4a3e34'; c.fillRect(xa, 0, xb - xa, TH);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(side < 0 ? xb - 10 : xa, 0, 10, TH);
        c.fillStyle = '#b8ab98'; c.fillRect(side < 0 ? xb : xa - 9, 0, 9, TH);
      }
      chalkLine(r, tx(-3.25), tz(0), tx(3.25), tz(0), 7);
      c.strokeStyle = 'rgba(250,246,236,0.42)'; c.lineWidth = 6; c.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        c.strokeStyle = `rgba(250,246,236,${0.42 + r() * 0.22})`; c.lineWidth = 4.5 + r() * 3.5;
        c.beginPath();
        const a0 = r() * TAU;
        for (let i = 0; i <= 72; i++) { const a = a0 + (i / 72) * TAU * 1.01; const rr = CAN.circle * TEX.ppm + (r() - 0.5) * 2.4; const px = tx(0) + Math.cos(a) * rr, py = tz(CAN.z) + Math.sin(a) * rr; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); }
        c.stroke();
      }
      // chalk dots where the throwers stand
      for (const sx of HOME_SLOTS) {
        c.fillStyle = 'rgba(250,246,236,0.5)';
        for (const o of [-0.1, 0.1]) { c.save(); c.translate(tx(sx + o), tz(-0.55)); c.rotate(0.15 * (o > 0 ? 1 : -1)); c.beginPath(); c.ellipse(0, 0, 5, 9, 0, 0, TAU); c.fill(); c.restore(); }
      }
    },
  ];
  return {
    failed: false,
    step(all) {
      do { stages[stage](); stage++; } while (all && stage < stages.length);
      return stage >= stages.length ? cv : null;
    },
  };
}

// ---- the static backdrop: sky, rooftops, wall, kerbs and the ground laid onto the camera (baked once per camera) ---------------
function wallQuad(ctx, cam, x0, y0, x1, y1, z) {
  const a = cam.P(x0, y0, z), b = cam.P(x1, y0, z), c = cam.P(x1, y1, z), d = cam.P(x0, y1, z);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
}
export const WALL_Z = 8.55;
function paintWall(ctx, cam) {
  const z = WALL_Z;
  const r = lcg(515);
  // buildings behind the wall: dusk silhouettes with a few warm windows
  const top = cam.P(0, 1.5, z)[1];
  const sky = ctx.createLinearGradient(0, top - 330, 0, top + 8); sky.addColorStop(0, '#1a2336'); sky.addColorStop(0.55, '#4a3a4a'); sky.addColorStop(1, '#d08a58');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 720, top + 8);
  let x = -5.6;
  while (x < 5.6) {
    const w = 0.9 + r() * 1.4, h = 2.2 + r() * 3.6;
    wallQuad(ctx, cam, x, 1.5, x + w, 1.5 + h, z + 0.3); ctx.fillStyle = `rgb(${34 + (r() * 16) | 0},${30 + (r() * 14) | 0},${42 + (r() * 16) | 0})`; ctx.fill();
    for (let k = 0; k < 7; k++) {
      if (r() < 0.55) continue;
      const wx = x + 0.15 + r() * (w - 0.45), wy = 1.8 + r() * (h - 0.5);
      wallQuad(ctx, cam, wx, wy, wx + 0.2, wy + 0.26, z + 0.3); ctx.fillStyle = `rgba(255,${190 + (r() * 40) | 0},${110 + (r() * 40) | 0},0.85)`; ctx.fill();
    }
    x += w + 0.04;
  }
  // the wall: painted bands and a simple mural of shapes (no letters, no logos)
  wallQuad(ctx, cam, -4.3, 0, 4.3, 1.5, z);
  const wg = ctx.createLinearGradient(0, cam.P(0, 1.5, z)[1], 0, cam.P(0, 0, z)[1]); wg.addColorStop(0, '#d9c9a8'); wg.addColorStop(1, '#a48d6d');
  ctx.fillStyle = wg; ctx.fill();
  const band = (y0, y1, col) => { wallQuad(ctx, cam, -4.3, y0, 4.3, y1, z); ctx.fillStyle = col; ctx.fill(); };
  band(0.0, 0.34, '#5c4a3b'); band(0.34, 0.4, '#e8d9b8');
  const shapes = [['#d4322e', 0.1], ['#25a39a', 0.85], ['#f2b632', 1.7], ['#8a62d6', 2.5], ['#d4322e', 3.2], ['#25a39a', 3.9]];
  shapes.forEach(([col, off], i) => {
    const cx = -3.9 + off + (i % 2) * 0.15;
    ctx.fillStyle = col; ctx.globalAlpha = 0.85;
    if (i % 3 === 0) { const a = cam.P(cx, 0.55, z), b = cam.P(cx + 0.55, 0.55, z), c = cam.P(cx + 0.27, 1.25, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill(); }
    else if (i % 3 === 1) { const p = cam.P(cx + 0.25, 0.9, z), q = cam.P(cx + 0.55, 0.9, z); ctx.beginPath(); ctx.arc(p[0], p[1], Math.abs(q[0] - p[0]) * 0.9, 0, TAU); ctx.fill(); }
    else { wallQuad(ctx, cam, cx, 0.55, cx + 0.5, 1.15, z); ctx.fill(); }
    ctx.globalAlpha = 1;
  });
  // brick seams
  ctx.strokeStyle = 'rgba(80,60,40,0.18)'; ctx.lineWidth = 1;
  for (let y = 0.45; y < 1.5; y += 0.2) { const a = cam.P(-4.3, y, z), b = cam.P(4.3, y, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  // coping on top and the shadow it casts
  wallQuad(ctx, cam, -4.4, 1.5, 4.4, 1.62, z); ctx.fillStyle = '#efe3c7'; ctx.fill();
  wallQuad(ctx, cam, -4.3, 0, 4.3, 0.1, z); ctx.fillStyle = 'rgba(30,20,12,0.28)'; ctx.fill();
}

export function startBackdrop(cam, tex) {
  const cv = makeCanvas(720, 1280);
  if (!cv) return { failed: true, step: () => null };
  const c = cv.getContext('2d');
  c.fillStyle = '#17131a'; c.fillRect(0, 0, 720, 1280);
  paintWall(c, cam);
  // ground rows, far to near
  const yFar = Math.floor(cam.P(0, 0, TEX.z1)[1]), yNear = Math.min(1280, Math.ceil(cam.P(0, 0, TEX.z0)[1]));
  let y = yFar;
  return {
    failed: false,
    step(rowsPerStep) {
      const n = rowsPerStep ?? 9999;
      for (let i = 0; i < n && y < yNear; i++, y++) {
        const g = cam.groundAt(360, y + 0.5);
        const g2 = cam.groundAt(360, y + 1.5);
        const z = g.z, rows = Math.max(1, Math.abs(g2.z - g.z) * TEX.ppm);
        if (z < TEX.z0 || z > TEX.z1) continue;
        const dep = cam.depthAtZ(z), k = cam.F / dep;
        const dx0 = cam.cx + k * TEX.x0, dw = k * (TEX.x1 - TEX.x0);
        const sy = tz(z) - rows / 2;
        c.drawImage(tex, 0, Math.max(0, sy), TW, rows, dx0, y, dw, 1.5);
      }
      if (y < yNear) return null;
      // the kerb faces, a dusk grade and the vignette
      const dk = c.createLinearGradient(0, 0, 0, 1280); dk.addColorStop(0, 'rgba(255,170,90,0.10)'); dk.addColorStop(0.5, 'rgba(255,190,120,0.02)'); dk.addColorStop(1, 'rgba(20,10,30,0.22)');
      c.fillStyle = dk; c.fillRect(0, 0, 720, 1280);
      return cv;
    },
  };
}

// ---- generic lit surfaces ---------------------------------------------------------------------------------------------------
const LIGHT = (() => { const l = [-0.45, 0.8, -0.35]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
const VIEWDIR_EPS = 0;
// facet colour from a base colour, the facet normal, and a metal flag (adds the sharp reflection stripes)
function shade(base, n, o = {}) {
  const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  let k = (o.amb ?? 0.42) + (o.dif ?? 0.62) * d;
  if (o.rim) { const rim = Math.max(0, n[1] * 0.2 + n[2] * 0.9) * o.rim; k += rim * 0.25; }
  let spec = 0;
  if (o.spec) {
    const h = [LIGHT[0], LIGHT[1] + 0.55, LIGHT[2] - 0.7]; const hl = Math.hypot(...h);
    spec = Math.pow(Math.max(0, (n[0] * h[0] + n[1] * h[1] + n[2] * h[2]) / hl), o.shin ?? 24) * o.spec;
  }
  return { k, spec };
}
function fillFacet(ctx, pts, base, n, o) {
  const { k, spec } = shade(base, n, o);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  const v = parseInt(base.startsWith('#') ? base.slice(1) : '808080', 16);
  const q = (sh) => Math.max(0, Math.min(255, Math.round(((v >> sh) & 255) * k + 255 * spec)));
  const col = base.startsWith('#') ? `rgb(${q(16)},${q(8)},${q(0)})` : base;
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 0.7; ctx.strokeStyle = col; ctx.stroke();
}

// A surface of revolution about a vertical axis through (x, z), built from a profile [{y, r}] bottom to top. Each ring's centre can
// be pushed by a lean (dx, dz) that grows with height. Facets are drawn back to front; only those facing the camera.
export function drawLathe(ctx, cam, x, z, y0, profile, base, o = {}) {
  const N = o.facets ?? 22, lean = o.lean ?? [0, 0], sq = o.squash ?? 1;
  const cp = cam.pos;
  const rings = profile.map((p) => {
    const hy = p.y * sq, k = hy / (profile[profile.length - 1].y * sq || 1);
    return { y: y0 + hy, r: p.r, ox: lean[0] * k * k, oz: lean[1] * k * k };
  });
  const facets = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    const dr = b.r - a.r, dy = (b.y - a.y) || 1e-6;
    const nl = Math.hypot(dr, dy);
    const nr = dy / nl, ny = -dr / nl;
    for (let j = 0; j < N; j++) {
      const t0 = (j / N) * TAU, t1 = ((j + 1) / N) * TAU, tm = (t0 + t1) / 2;
      const nx = Math.cos(tm) * nr, nz = Math.sin(tm) * nr;
      const cxw = x + (a.ox + b.ox) / 2 + Math.cos(tm) * (a.r + b.r) / 2, czw = z + (a.oz + b.oz) / 2 + Math.sin(tm) * (a.r + b.r) / 2, cyw = (a.y + b.y) / 2;
      if (nx * (cp[0] - cxw) + ny * (cp[1] - cyw) + nz * (cp[2] - czw) <= VIEWDIR_EPS) continue;
      facets.push({ i, j, t0, t1, n: [nx, ny, nz], depth: cam.depth(cxw, cyw, czw), a, b });
    }
  }
  facets.sort((p, q) => q.depth - p.depth);
  for (const f of facets) {
    const { a, b, t0, t1 } = f;
    const pts = [
      cam.P(x + a.ox + Math.cos(t0) * a.r, a.y, z + a.oz + Math.sin(t0) * a.r), cam.P(x + a.ox + Math.cos(t1) * a.r, a.y, z + a.oz + Math.sin(t1) * a.r),
      cam.P(x + b.ox + Math.cos(t1) * b.r, b.y, z + b.oz + Math.sin(t1) * b.r), cam.P(x + b.ox + Math.cos(t0) * b.r, b.y, z + b.oz + Math.sin(t0) * b.r),
    ];
    const col = o.colorFor ? o.colorFor(f.i, rings) : base;
    fillFacet(ctx, pts, col, f.n, o);
  }
  return rings;
}

// ---- shadows ------------------------------------------------------------------------------------------------------------------
export function drawShadow(ctx, cam, x, z, r, alpha = 0.42, h = 0) {
  const sx = x + h * 0.28, sz = z + h * 0.18;
  const rr = r * (1 + h * 0.35);
  ctx.save();
  const c = cam.P(sx, 0, sz);
  const pts = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; pts.push(cam.P(sx + Math.cos(a) * rr * 1.1, 0, sz + Math.sin(a) * rr * 0.9)); }
  const e = pts.reduce((m, p) => ({ x0: Math.min(m.x0, p[0]), x1: Math.max(m.x1, p[0]), y0: Math.min(m.y0, p[1]), y1: Math.max(m.y1, p[1]) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
  const rx = (e.x1 - e.x0) / 2, ry = (e.y1 - e.y0) / 2;
  ctx.translate(c[0], (e.y0 + e.y1) / 2); ctx.scale(1, Math.max(0.05, ry / Math.max(1, rx)));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(24,14,8,${alpha / (1 + h * 0.8)})`); g.addColorStop(0.65, `rgba(24,14,8,${alpha * 0.55 / (1 + h * 0.8)})`); g.addColorStop(1, 'rgba(24,14,8,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- the can ------------------------------------------------------------------------------------------------------------------
// A tin can: bright rolled-steel body, a paper label in the middle, a rim ring on top. Standing or lying (axis tilts with can.tilt).
export function drawCan(ctx, cam, can, o = {}) {
  const wob = o.wob ?? 0;
  const R = CAN.r, Hh = CAN.h;
  const lie = Math.min(1, Math.max(0, o.tilt ?? can.tilt));
  // axis direction: standing = up; lying = horizontal, perpendicular to the way it travels (so it rolls)
  const dirx = Math.cos(can.dir), dirz = -Math.sin(can.dir);   // perpendicular to heading (sin dir, cos dir)
  const ang = lie * (Math.PI / 2);
  const ax = [Math.cos(ang) * 0 + Math.sin(ang) * dirx, Math.cos(ang), Math.sin(ang) * dirz];
  const wx = Math.sin(wob * 40) * 0.05 * Math.min(1, wob * 3) * (1 - lie);
  ax[0] += wx;
  const al = Math.hypot(...ax); ax[0] /= al; ax[1] /= al; ax[2] /= al;
  // centre of the can: standing, its middle sits Hh/2 up; lying, its radius up
  const cy = can.y + (1 - lie) * (Hh / 2) + lie * R;
  const cx = can.x, cz = can.z;
  // two vectors spanning the cross-section
  let ux = 1, uy = 0, uz = 0;
  if (Math.abs(ax[0]) > 0.9) { ux = 0; uy = 0; uz = 1; }
  let vx = ax[1] * uz - ax[2] * uy, vy = ax[2] * ux - ax[0] * uz, vz = ax[0] * uy - ax[1] * ux; let vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
  ux = vy * ax[2] - vz * ax[1]; uy = vz * ax[0] - vx * ax[2]; uz = vx * ax[1] - vy * ax[0]; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const N = 28, half = Hh / 2;
  const roll = can.roll;
  const ringPt = (t, ang2, rr) => [cx + ax[0] * t + (ux * Math.cos(ang2) + vx * Math.sin(ang2)) * rr, cy + ax[1] * t + (uy * Math.cos(ang2) + vy * Math.sin(ang2)) * rr, cz + ax[2] * t + (uz * Math.cos(ang2) + vz * Math.sin(ang2)) * rr];
  const segs = [[-half, -half * 0.62, 'steel'], [-half * 0.62, half * 0.62, 'label'], [half * 0.62, half, 'steel']];
  const cp = cam.pos;
  const facets = [];
  for (const [t0, t1, kind] of segs) {
    for (let j = 0; j < N; j++) {
      const a0 = (j / N) * TAU, a1 = ((j + 1) / N) * TAU, am = (a0 + a1) / 2;
      const n = [ux * Math.cos(am) + vx * Math.sin(am), uy * Math.cos(am) + vy * Math.sin(am), uz * Math.cos(am) + vz * Math.sin(am)];
      const mid = ringPt((t0 + t1) / 2, am, R);
      if (n[0] * (cp[0] - mid[0]) + n[1] * (cp[1] - mid[1]) + n[2] * (cp[2] - mid[2]) <= 0) continue;
      facets.push({ t0, t1, kind, a0, a1, am, n, depth: cam.depth(mid[0], mid[1], mid[2]), j });
    }
  }
  facets.sort((p, q) => q.depth - p.depth);
  // end caps: draw the far cap first if visible (rare), the near cap after the body
  const capVisible = (s) => {
    const n = [ax[0] * s, ax[1] * s, ax[2] * s]; const c0 = ringPt(s * half, 0, 0);
    return n[0] * (cp[0] - c0[0]) + n[1] * (cp[1] - c0[1]) + n[2] * (cp[2] - c0[2]) > 0;
  };
  const drawCap = (s) => {
    const pts = []; for (let j = 0; j < N; j++) pts.push(cam.P(...ringPt(s * half, (j / N) * TAU, R)));
    const n = [ax[0] * s, ax[1] * s, ax[2] * s];
    const kk = shade('#c9d0d8', n, { amb: 0.5, dif: 0.7, spec: 0.5, shin: 8 });
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = hex('#dfe4ea', Math.min(1.15, kk.k + 0.1)); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = '#8f98a3'; ctx.stroke();
    // the inner pressed ring
    const inner = []; for (let j = 0; j < N; j++) inner.push(cam.P(...ringPt(s * (half + 0.004), (j / N) * TAU, R * 0.78)));
    ctx.beginPath(); inner.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = hex('#b4bcc6', Math.min(1.1, kk.k)); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(70,80,92,0.6)'; ctx.stroke();
  };
  if (capVisible(-1)) drawCap(-1);
  for (const f of facets) {
    const p = [cam.P(...ringPt(f.t0, f.a0, R)), cam.P(...ringPt(f.t0, f.a1, R)), cam.P(...ringPt(f.t1, f.a1, R)), cam.P(...ringPt(f.t1, f.a0, R))];
    if (f.kind === 'label') {
      // paper label with a cream stripe; it turns with the can's roll
      const ph = (f.am + roll) % TAU;
      const stripe = Math.sin(ph * 3) > 0.55;
      fillFacet(ctx, p, stripe ? '#f1e6c8' : '#d6452b', f.n, { amb: 0.46, dif: 0.6 });
    } else fillFacet(ctx, p, '#c3cad3', f.n, { amb: 0.3, dif: 0.55, spec: 0.85, shin: 14 });
  }
  if (capVisible(1)) drawCap(1);
  // ping glint
  if ((o.ping ?? 0) > 0.02) {
    const c0 = cam.P(cx, cy + (1 - lie) * 0.05, cz);
    const rr = cam.F / cam.depth(cx, cy, cz) * 0.9 * (0.6 + (1 - o.ping) * 1.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], rr);
    g.addColorStop(0, `rgba(255,255,255,${0.55 * o.ping})`); g.addColorStop(0.3, `rgba(190,225,255,${0.3 * o.ping})`); g.addColorStop(1, 'rgba(160,210,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c0[0], c0[1], rr, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---- slippers ------------------------------------------------------------------------------------------------------------------
// A flip-flop: a foot-shaped sole with thickness, a toe post and a Y strap. yaw turns about the vertical; pitch tumbles it end over end.
const SOLE = (() => {
  const pts = [];
  const L = 0.62, n = 22;
  for (let i = 0; i <= n; i++) { const t = i / n, x = -L / 2 + t * L, u = (x / (L / 2)); const wdt = 0.14 * Math.pow(Math.max(0, 1 - u * u), 0.55) * (1 + 0.28 * u); pts.push([x, wdt]); }
  for (let i = n - 1; i >= 1; i--) pts.push([pts[i][0], -pts[i][1]]);
  return pts;
})();
export const SLIP_COLORS = { 1: ['#25a39a', '#0d5a55'], 2: ['#f2b632', '#9a6a0a'], 3: ['#8a62d6', '#432a82'] };
export function drawSlipper(ctx, cam, s, o = {}) {
  const [main, dark] = SLIP_COLORS[s.owner] ?? SLIP_COLORS[2];
  const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
  // local (lx along length, lz across) -> world, with pitch about the across axis
  const W = (lx, ly, lz) => { const x1 = lx * cp - ly * sp, y1 = lx * sp + ly * cp; return [s.x + x1 * cy - lz * sy, s.y + y1, s.z + x1 * sy + lz * cy]; };
  const thick = 0.045;
  // face-down check: the top face normal after pitch
  const ny = cp;
  const top = SOLE.map(([lx, lz]) => cam.P(...W(lx, thick, lz)));
  const bot = SOLE.map(([lx, lz]) => cam.P(...W(lx, 0, lz)));
  ctx.save();
  // edge (thickness)
  ctx.beginPath(); bot.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  ctx.fillStyle = ny > 0 ? dark : hex(main, 0.7); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = dark; ctx.stroke();
  // join top and bottom outlines
  for (let i = 0; i < SOLE.length; i++) {
    const j = (i + 1) % SOLE.length;
    ctx.beginPath(); ctx.moveTo(bot[i][0], bot[i][1]); ctx.lineTo(bot[j][0], bot[j][1]); ctx.lineTo(top[j][0], top[j][1]); ctx.lineTo(top[i][0], top[i][1]); ctx.closePath();
    ctx.fillStyle = dark; ctx.fill(); ctx.lineWidth = 0.6; ctx.strokeStyle = dark; ctx.stroke();
  }
  ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  const a = cam.P(...W(-0.25, thick, 0)), b = cam.P(...W(0.25, thick, 0));
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  if (ny > 0) { g.addColorStop(0, hex(main, 0.95)); g.addColorStop(1, hex(main, 1.2)); } else { g.addColorStop(0, '#e8e2d4'); g.addColorStop(1, '#cfc8b8'); }
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = ny > 0 ? dark : '#8d8576'; ctx.stroke();
  if (ny > 0) {
    // a pale tread pattern and a toe-post strap
    const post = cam.P(...W(0.11, thick, 0));
    const hl = cam.P(...W(-0.07, thick + 0.05, 0.075)), hr = cam.P(...W(-0.07, thick + 0.05, -0.075));
    const hl0 = cam.P(...W(-0.07, thick, 0.1)), hr0 = cam.P(...W(-0.07, thick, -0.1));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const strap = (col, wd) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(hl0[0], hl0[1]); ctx.quadraticCurveTo(hl[0], hl[1] - 3, post[0], post[1]); ctx.lineTo(hr0[0], hr0[1]); ctx.moveTo(hr0[0], hr0[1]); ctx.quadraticCurveTo(hr[0], hr[1] - 3, post[0], post[1]); ctx.stroke(); };
    const wpx = Math.max(2.4, cam.F / cam.depth(s.x, s.y, s.z) * 0.055);
    strap('rgba(40,28,20,0.5)', wpx + 2); strap('#f6efe0', wpx);
    ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.arc(post[0], post[1], wpx * 0.9, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the round token players ------------------------------------------------------------------------------------------------
// A chess-pawn style token: flared base, bell body, collar and a ball head, lit from the upper left. The lean pushes the head ahead of
// the feet while running; the body squashes a little with each stride. No faces, no limbs: a clean marker that moves smoothly.
const PAWN_PROFILE = [
  { y: 0, r: 0.0 }, { y: 0.0, r: 0.3 }, { y: 0.03, r: 0.33 }, { y: 0.07, r: 0.31 }, { y: 0.11, r: 0.25 }, { y: 0.22, r: 0.2 }, { y: 0.45, r: 0.15 }, { y: 0.62, r: 0.12 },
  { y: 0.68, r: 0.2 }, { y: 0.72, r: 0.21 }, { y: 0.75, r: 0.14 },
  { y: 0.79, r: 0.1 }, { y: 0.84, r: 0.2 }, { y: 0.92, r: 0.27 }, { y: 1.02, r: 0.28 }, { y: 1.12, r: 0.25 }, { y: 1.19, r: 0.18 }, { y: 1.23, r: 0.08 }, { y: 1.24, r: 0.0 },
];
export function drawPawn(ctx, cam, a, look, o = {}) {
  const { x, z } = o.pos;
  const y0 = o.lift ?? 0;
  const spd = Math.hypot(o.vx ?? 0, o.vz ?? 0);
  const lean = [(o.vx ?? 0) * 0.09 + (o.fx ?? 0), (o.vz ?? 0) * 0.09 + (o.fz ?? 0)];
  const stride = Math.sin((o.step ?? 0) * Math.PI);
  const bob = spd > 0.4 ? Math.abs(stride) * 0.06 : 0;
  const sq = 1 - (spd > 0.4 ? 0.025 * (1 - Math.abs(stride)) : 0) + (o.idle ?? 0) * 0.012;
  const PS = 1.3;
  const colorFor = (i) => (i <= 2 ? look.dark : i >= 8 && i <= 10 ? '#f6efe0' : look.main);
  drawLathe(ctx, cam, x, z, y0 + bob, PAWN_PROFILE, look.main, { facets: 40, lean, squash: sq * PS, colorFor, amb: 0.42, dif: 0.62 });
  // soft gloss on the head and shoulder, so the token reads as a lit, smooth object
  const hp = cam.P(x + lean[0] - 0.08, y0 + bob + 1.1 * sq * PS, z + lean[1] - 0.12), kk = cam.F / cam.depth(x, 1.0, z);
  const g = ctx.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], kk * 0.17);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp[0], hp[1], kk * 0.17, 0, TAU); ctx.fill();
  return { top: cam.P(x + lean[0], y0 + bob + 1.3 * sq * PS, z + lean[1]), base: cam.P(x, 0, z) };
}

// ---- small helpers for effects --------------------------------------------------------------------------------------------
export function groundRing(ctx, cam, x, z, r, col, lw = 3) {
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, p = cam.P(x + Math.cos(a) * r, 0.01, z + Math.sin(a) * r); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
}
export { SLIP, FIELD };
