// Art: the garden court scene baked once per screen size and surface (sky, wall, lights, lawn, rails, floor with its painted
// lines), plus the lit, reflective ball sprites and their grooves. All procedural and seeded. Baking uses OffscreenCanvas
// when the host has it (every browser / webview) and quietly does nothing in the headless test harness.
import { COURT, HALF, R_B } from './sim.js';

const TAU = Math.PI * 2;
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export const newCanvas = (w, h) => {
  w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
};
// device pixels per virtual unit (main.js keeps it current) so baked art and sprites stay sharp on every screen
let Q = 1;
export const setScale = (k) => { Q = Math.max(0.5, Math.min(3, k || 1)); };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))},${a})`;

// ---- palettes ------------------------------------------------------------------------------------------------------------
export const PALETTES = {
  classic: [
    { name: 'Rosso', hi: '#ffb4a8', base: '#d3232f', dark: '#5c0810', groove: 'rgba(60,4,10,0.75)', glow: '#ff6b5e' },
    { name: 'Verde', hi: '#a6f0bf', base: '#1e9b57', dark: '#073d22', groove: 'rgba(2,44,22,0.75)', glow: '#4ee08a' },
  ],
  bold: [
    { name: 'Blu', hi: '#bcdcff', base: '#2a6fdb', dark: '#0a2a66', groove: 'rgba(4,18,60,0.75)', glow: '#6fb0ff' },
    { name: 'Arancio', hi: '#ffe2ae', base: '#f08a1c', dark: '#7a3a02', groove: 'rgba(80,32,0,0.7)', glow: '#ffb45a' },
  ],
};
// the two team palettes in use (mutated in place by setPalette so every importer sees the change)
export const TEAM = [{ ...PALETTES.classic[0] }, { ...PALETTES.classic[1] }];
export const setPalette = (id) => { const p = PALETTES[id] ?? PALETTES.classic; TEAM[0] = { ...p[0] }; TEAM[1] = { ...p[1] }; };
const PALLINO_PAL = { hi: '#fffbe0', base: '#f1d04a', dark: '#8f6c0c', groove: 'rgba(110,80,0,0.5)' };
export const FLOORS = {
  shell: { base: [236, 220, 188], dark: [200, 176, 138], fleck: [255, 250, 230], speck: [150, 124, 92], line: '#fffdf5' },
  clay: { base: [190, 98, 62], dark: [150, 70, 44], fleck: [226, 150, 112], speck: [110, 50, 32], line: '#fff4e6' },
  lawn: { base: [96, 156, 74], dark: [68, 124, 56], fleck: [150, 204, 110], speck: [48, 96, 40], line: '#ffffff' },
  sand: { base: [231, 204, 152], dark: [200, 170, 118], fleck: [255, 240, 205], speck: [170, 138, 92], line: '#fffaf0' },
};
export const palOf = (s) => FLOORS[s.pal] ?? FLOORS.shell;

// ---- the floor texture (u across the court, v down it) ----------------------------------------------------------------------
const TW = 256, TH = 1100;
function floorTexture(P, seed) {
  const cv = newCanvas(TW, TH);
  if (!cv) return null;
  const c = cv.getContext('2d'), rnd = lcg(seed);
  c.fillStyle = rgb(P.base); c.fillRect(0, 0, TW, TH);
  // broad soft patches
  for (let i = 0; i < 70; i++) {
    const x = rnd() * TW, y = rnd() * TH, r = 22 + rnd() * 60, g = c.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.5;
    g.addColorStop(0, rgb(dark ? P.dark : P.fleck, 1, 0.22)); g.addColorStop(1, rgb(dark ? P.dark : P.fleck, 1, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fine grain
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * TW, y = rnd() * TH, d = rnd() < 0.55;
    c.fillStyle = rgb(d ? P.speck : P.fleck, 1, d ? 0.16 + rnd() * 0.22 : 0.2 + rnd() * 0.4);
    c.fillRect(x, y, 1 + rnd() * 1.6, 1 + rnd() * 1.4);
  }
  // rake lines along the court
  c.globalAlpha = 0.06; c.strokeStyle = rgb(P.dark);
  for (let i = 0; i < 40; i++) { const x = rnd() * TW; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (rnd() - 0.5) * 8, TH); c.stroke(); }
  c.globalAlpha = 1;
  // the throwing area is a touch darker, with the painted lines
  const vy = (y) => (y / COURT.L) * TH;
  c.fillStyle = 'rgba(40,30,18,0.1)'; c.fillRect(0, 0, TW, vy(COURT.foul));
  c.fillStyle = P.line;
  c.globalAlpha = 0.92; c.fillRect(0, vy(COURT.foul) - 3, TW, 6);               // foul line
  c.globalAlpha = 0.7; c.fillRect(0, vy(COURT.center) - 2, TW, 4);             // centre line
  c.globalAlpha = 0.5;
  c.fillRect(TW / 2 - 1.5, vy(COURT.center) - 11, 3, 22);
  c.fillRect(TW / 2 - 1.5, vy(COURT.foul) - 12, 3, 24);
  c.globalAlpha = 1;
  // the rails throw a soft shadow on the floor along both sides, the sun makes a warm pool in the middle
  let g = c.createLinearGradient(0, 0, TW, 0);
  g.addColorStop(0, 'rgba(20,12,6,0.4)'); g.addColorStop(0.07, 'rgba(20,12,6,0.12)'); g.addColorStop(0.16, 'rgba(20,12,6,0)'); g.addColorStop(0.84, 'rgba(20,12,6,0)'); g.addColorStop(0.93, 'rgba(20,12,6,0.12)'); g.addColorStop(1, 'rgba(20,12,6,0.4)');
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  g = c.createRadialGradient(TW * 0.55, TH * 0.6, 20, TW * 0.55, TH * 0.6, TH * 0.5);
  g.addColorStop(0, 'rgba(255,238,190,0.2)'); g.addColorStop(1, 'rgba(255,238,190,0)');
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  g = c.createLinearGradient(0, TH - 260, 0, TH);
  g.addColorStop(0, 'rgba(30,18,8,0)'); g.addColorStop(1, 'rgba(30,18,8,0.22)');
  c.fillStyle = g; c.fillRect(0, TH - 260, TW, 260);
  return cv;
}

// ---- the baked scene -------------------------------------------------------------------------------------------------------
const quad = (c, a, b, d, e) => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); };
function bulb(c, x, y, r, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, `rgba(255,244,200,${0.95 * a})`); g.addColorStop(0.18, `rgba(255,222,140,${0.55 * a})`); g.addColorStop(1, 'rgba(255,200,100,0)');
  c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
}
// Draws the scene in two layers: `back` (everything behind the balls) and `front` (the near rail in the side view, which hides part of the floor).
function paintScene(c, L, surf, k, front) {
  const cam = L.cam, w = L.w, h = L.h, P = palOf(surf), side = cam.side, rnd = lcg(0x6b0c + (surf.pal.length * 977));
  const pr = (x, y, z = 0) => cam.project(x, y, z);
  c.scale(k, k);
  const yN = side ? 0.05 : 0.2, SW = side ? 12 : 30;
  // ---- the rails: walnut with a varnished top, grain, bevel and brass studs --------------------------------------------------
  const rail = (sgn, faces) => {
    const o = 0.17, zt = COURT.railH;
    const a0 = pr(sgn * HALF, yN, 0), a1 = pr(sgn * HALF, COURT.L, 0), b1 = pr(sgn * HALF, COURT.L, zt), b0 = pr(sgn * HALF, yN, zt);
    const t0 = pr(sgn * (HALF + o), yN, zt), t1 = pr(sgn * (HALF + o), COURT.L, zt), o0 = pr(sgn * (HALF + o), yN, 0), o1 = pr(sgn * (HALF + o), COURT.L, 0);
    if (faces.outer) {
      const g = c.createLinearGradient(0, t0.y, 0, o0.y); g.addColorStop(0, '#7a4a26'); g.addColorStop(0.5, '#5a3318'); g.addColorStop(1, '#34190a');
      c.fillStyle = g; quad(c, o0, o1, t1, t0); c.fill();
      c.strokeStyle = 'rgba(255,214,160,0.18)'; c.lineWidth = 1;
      for (let i = 1; i < 5; i++) { const f = i / 5; c.beginPath(); c.moveTo(o0.x + (t0.x - o0.x) * f, o0.y + (t0.y - o0.y) * f); c.lineTo(o1.x + (t1.x - o1.x) * f, o1.y + (t1.y - o1.y) * f); c.stroke(); }
    }
    if (faces.top) {
      const g = c.createLinearGradient(b0.x, b0.y, t0.x, t0.y); g.addColorStop(0, '#e0a96a'); g.addColorStop(0.5, '#c88a4e'); g.addColorStop(1, '#a8703a');
      c.fillStyle = g; quad(c, b0, b1, t1, t0); c.fill();
      // grain along the top
      c.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const f = rnd(), y0 = yN + rnd() * 3, y1 = y0 + 2 + rnd() * 9, A = pr(sgn * (HALF + o * f), y0, zt), B = pr(sgn * (HALF + o * f), Math.min(COURT.L, y1), zt);
        c.strokeStyle = rnd() < 0.5 ? `rgba(90,50,20,${0.12 + rnd() * 0.18})` : `rgba(255,236,200,${0.1 + rnd() * 0.15})`; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
      }
      // varnish highlight along the inner edge
      c.strokeStyle = 'rgba(255,244,214,0.65)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.stroke();
      c.strokeStyle = 'rgba(70,36,12,0.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(t0.x, t0.y); c.lineTo(t1.x, t1.y); c.stroke();
      // brass studs
      for (let y = 1; y < COURT.L; y += 2) { const p = pr(sgn * (HALF + o * 0.5), y, zt), r = Math.max(1.1, p.s * 0.022); c.fillStyle = '#e8c870'; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.4, 0, TAU); c.fill(); }
    }
    if (faces.inner) {
      let g = c.createLinearGradient(0, b0.y, 0, a0.y); g.addColorStop(0, '#a8683a'); g.addColorStop(0.55, '#7a4422'); g.addColorStop(1, '#4a2410');
      c.fillStyle = g; quad(c, a0, a1, b1, b0); c.fill();
      // planks, grain and a soft shadow where the rail meets the floor
      c.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const f = rnd(), yy = yN + rnd() * (COURT.L - 2), A = pr(sgn * HALF, yy, zt * f), B = pr(sgn * HALF, Math.min(COURT.L, yy + 1 + rnd() * 5), zt * f);
        c.strokeStyle = rnd() < 0.5 ? `rgba(40,18,6,${0.15 + rnd() * 0.2})` : `rgba(255,220,170,${0.08 + rnd() * 0.12})`; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
      }
      c.strokeStyle = 'rgba(30,14,6,0.5)'; c.lineWidth = 1;
      for (let y = 2; y < COURT.L; y += 2) { const p = pr(sgn * HALF, y, 0), q = pr(sgn * HALF, y, zt); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); }
      g = c.createLinearGradient(0, a0.y - 3, 0, a0.y + 14); g.addColorStop(0, 'rgba(10,4,0,0.5)'); g.addColorStop(1, 'rgba(10,4,0,0)');
    }
  };
  const endWall = (yy, faceDir) => {
    const zt = COURT.wallH, a = pr(-HALF - 0.17, yy, 0), b = pr(HALF + 0.17, yy, 0), d = pr(HALF + 0.17, yy, zt), e = pr(-HALF - 0.17, yy, zt);
    const g = c.createLinearGradient(0, e.y, 0, a.y); g.addColorStop(0, '#b0703f'); g.addColorStop(0.6, '#7a4423'); g.addColorStop(1, '#4a2410');
    c.fillStyle = g; quad(c, a, b, d, e); c.fill();
    c.strokeStyle = 'rgba(30,14,6,0.4)'; c.lineWidth = 1;
    for (let i = 1; i < 5; i++) { const f = i / 5; c.beginPath(); c.moveTo(e.x + (a.x - e.x) * f, e.y + (a.y - e.y) * f); c.lineTo(d.x + (b.x - d.x) * f, d.y + (b.y - d.y) * f); c.stroke(); }
    const dy = faceDir * 0.17, tb = pr(-HALF - 0.17, yy + dy, zt), tc = pr(HALF + 0.17, yy + dy, zt);
    c.fillStyle = '#e0a468'; quad(c, e, d, tc, tb); c.fill();
    c.strokeStyle = 'rgba(255,236,190,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(d.x, d.y); c.stroke();
  };
  if (front) {
    // only the near rail (side view): it stands in front of the floor and the balls
    rail(1, { outer: true, top: true, inner: false });
    return;
  }
  // ---- sky, hills, trees, the stucco wall and the lawn ------------------------------------------------------------------------
  const A = side ? [-(HALF + 4.2), -12] : [-16, COURT.L + 0.7], B = side ? [-(HALF + 4.2), COURT.L + 12] : [16, COURT.L + 0.7];
  const bl = [pr(A[0], A[1], 0), pr(B[0], B[1], 0)], tl = [pr(A[0], A[1], 2.6), pr(B[0], B[1], 2.6)];
  const slope = (p, q) => (q.y - p.y) / (q.x - p.x || 1e-6);
  const yAt = (pq, x) => pq[0].y + (x - pq[0].x) * slope(pq[0], pq[1]);
  const x0 = -40, x1 = w + 40;
  const yb0 = yAt(bl, x0), yb1 = yAt(bl, x1), yt0 = yAt(tl, x0), yt1 = yAt(tl, x1);
  const lawn = c.createLinearGradient(0, Math.min(yb0, yb1), 0, h);
  lawn.addColorStop(0, '#6aa24c'); lawn.addColorStop(1, '#4a8838');
  c.fillStyle = lawn; c.fillRect(0, 0, w, h);
  // sky above the wall top line
  let g = c.createLinearGradient(0, 0, 0, Math.max(40, Math.max(yt0, yt1) + 60));
  g.addColorStop(0, '#5f94cf'); g.addColorStop(0.55, '#a9c9e8'); g.addColorStop(1, '#f6dcae');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, -2); c.lineTo(w, -2); c.lineTo(x1, yt1); c.lineTo(x0, yt0); c.closePath(); c.fill();
  const sun = c.createRadialGradient(w * 0.22, Math.max(30, Math.min(yt0, yt1) - 20), 4, w * 0.22, Math.max(30, Math.min(yt0, yt1) - 20), w * 0.8);
  sun.addColorStop(0, 'rgba(255,240,196,0.85)'); sun.addColorStop(0.3, 'rgba(255,222,160,0.28)'); sun.addColorStop(1, 'rgba(255,222,160,0)');
  c.fillStyle = sun; c.fillRect(0, 0, w, Math.max(yb0, yb1));
  // the backdrop is drawn in the frame of the wall's base line (so it follows the camera's slant)
  const th = Math.atan2(yb1 - yb0, x1 - x0), wl = Math.hypot(x1 - x0, yb1 - yb0), wallPx = Math.max(24, ((yb0 + yb1) - (yt0 + yt1)) / 2);
  const sc = Math.max(0.5, wallPx / 110);
  c.save(); c.translate(x0, yb0); c.rotate(th);
  // hills and cypresses behind the wall
  c.fillStyle = 'rgba(142,150,186,0.8)'; c.beginPath(); c.moveTo(0, -wallPx);
  for (let x = 0; x <= wl; x += 30) c.lineTo(x, -wallPx - 16 * sc - Math.sin(x * 0.011) * 10 * sc - Math.sin(x * 0.027 + 1) * 6 * sc);
  c.lineTo(wl, -wallPx + 30); c.lineTo(0, -wallPx + 30); c.closePath(); c.fill();
  for (let i = 0; i < Math.max(9, wl / 90); i++) {
    const x = rnd() * wl, ht = (60 + rnd() * 70) * sc, wd = (13 + rnd() * 8) * sc, base = -wallPx + 14 * sc;
    c.fillStyle = `rgba(${34 + rnd() * 12},${70 + rnd() * 20},${46 + rnd() * 10},0.95)`; c.beginPath(); c.moveTo(x, base - ht);
    c.bezierCurveTo(x + wd, base - ht * 0.7, x + wd * 0.9, base - ht * 0.15, x + wd * 0.35, base); c.lineTo(x - wd * 0.35, base); c.bezierCurveTo(x - wd * 0.9, base - ht * 0.15, x - wd, base - ht * 0.7, x, base - ht); c.fill();
  }
  // the stucco wall
  g = c.createLinearGradient(0, -wallPx, 0, 0); g.addColorStop(0, '#e8c28f'); g.addColorStop(0.7, '#d9a974'); g.addColorStop(1, '#b8845a');
  c.fillStyle = g; c.fillRect(0, -wallPx, wl, wallPx);
  for (let i = 0; i < wl * 0.9; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '255,236,200' : '110,70,40'},${0.04 + rnd() * 0.08})`; c.fillRect(rnd() * wl, -wallPx + rnd() * wallPx, 1 + rnd() * 3, 1 + rnd() * 2); }
  c.fillStyle = '#9b4a2c'; c.fillRect(0, -wallPx - 7 * sc, wl, 9 * sc); c.fillStyle = '#c4633b'; c.fillRect(0, -wallPx - 7 * sc, wl, 3 * sc);
  const aw = Math.max(46, wallPx * 0.5), n = Math.ceil(wl / (aw * 1.7));
  for (let i = 0; i <= n; i++) {
    const ax = (i + 0.5) * (wl / n), ah = wallPx * 0.62, ay = -6;
    c.fillStyle = 'rgba(52,34,28,0.55)'; c.beginPath(); c.moveTo(ax - aw / 2, ay); c.lineTo(ax - aw / 2, ay - ah + aw / 2); c.arc(ax, ay - ah + aw / 2, aw / 2, Math.PI, 0); c.lineTo(ax + aw / 2, ay); c.fill();
    c.strokeStyle = 'rgba(255,230,190,0.5)'; c.lineWidth = 2; c.stroke();
    const px = ax + (wl / n) * 0.5, ps = Math.max(10, wallPx * 0.12);
    c.fillStyle = '#b4522d'; c.beginPath(); c.moveTo(px - ps, -ps * 1.5); c.lineTo(px + ps, -ps * 1.5); c.lineTo(px + ps * 0.7, 1); c.lineTo(px - ps * 0.7, 1); c.fill();
    c.fillStyle = '#3f7d3c'; c.beginPath(); c.arc(px, -ps * 2.2, ps * 1.1, 0, TAU); c.fill();
    c.fillStyle = '#e9b73f'; for (let q = 0; q < 4; q++) { c.beginPath(); c.arc(px + (rnd() - 0.5) * ps * 1.6, -ps * 2.2 + (rnd() - 0.5) * ps * 1.4, ps * 0.2, 0, TAU); c.fill(); }
  }
  g = c.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, 'rgba(10,30,5,0.32)'); g.addColorStop(1, 'rgba(10,30,5,0)'); c.fillStyle = g; c.fillRect(0, 0, wl, 40);
  c.restore();
  // ---- the lawn: mown stripes in perspective, blades, soft tree shadows --------------------------------------------------------
  for (let y = -8, kk = 0; y < COURT.L + 6; y += 1.6, kk++) {
    if (kk % 2) continue;
    const a = pr(-30 + (side ? 18 : 0), y), b = pr(side ? 12 : 30, y), d = pr(side ? 12 : 30, y + 1.6), e = pr(-30 + (side ? 18 : 0), y + 1.6);
    c.fillStyle = 'rgba(255,255,255,0.055)'; quad(c, a, b, d, e); c.fill();
  }
  const inCourt = (x, y) => Math.abs(x) < HALF + 0.35 && y > -1.2 && y < COURT.L + 0.5;
  for (let i = 0; i < 5200; i++) {
    const x = (side ? -14 : -14) + rnd() * (side ? 27 : 28), y = -7 + rnd() * (COURT.L + 12);
    if (inCourt(x, y) || (side && x > 9)) continue;
    const p = pr(x, y, 0); if (p.x < -10 || p.x > w + 10 || p.y < Math.min(yb0, yb1) - 4 || p.y > h + 10) continue;
    const len = Math.max(2.2, p.s * (0.05 + rnd() * 0.05)), lean = (rnd() - 0.5) * len * 0.7;
    c.strokeStyle = rnd() < 0.55 ? `rgba(${28 + rnd() * 30},${90 + rnd() * 50},${24 + rnd() * 30},${0.35 + rnd() * 0.3})` : `rgba(${170 + rnd() * 50},${210 + rnd() * 40},${110 + rnd() * 40},${0.18 + rnd() * 0.22})`;
    c.lineWidth = Math.max(0.7, p.s * 0.012); c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x + lean * 0.3, p.y - len * 0.6, p.x + lean, p.y - len); c.stroke();
  }
  // planters (far side in the side view; both sides behind the thrower's view)
  const pots = [];
  for (const sg of side ? [-1] : [-1, 1]) for (let y = 1.5; y < COURT.L; y += 2.6) pots.push([sg * (HALF + (side ? 2.3 : 1.5)), y]);
  if (side) for (let x = -(HALF + 1.5); x < 0; x += 0) { break; }
  pots.sort((m, n) => n[1] - m[1]);
  for (const [px0, py0] of pots) {
    const a = pr(px0, py0, 0), s = a.s;
    c.fillStyle = 'rgba(10,30,6,0.3)'; c.beginPath(); c.ellipse(a.x + s * 0.3, a.y + s * 0.05, s * 0.65, s * 0.2, 0, 0, TAU); c.fill();
    c.fillStyle = '#b4522d'; c.beginPath(); c.moveTo(a.x - s * 0.28, a.y - s * 0.4); c.lineTo(a.x + s * 0.28, a.y - s * 0.4); c.lineTo(a.x + s * 0.2, a.y); c.lineTo(a.x - s * 0.2, a.y); c.fill();
    c.fillStyle = 'rgba(255,214,170,0.35)'; c.fillRect(a.x - s * 0.26, a.y - s * 0.4, s * 0.08, s * 0.38);
    const tg = c.createRadialGradient(a.x - s * 0.15, a.y - s * 0.95, s * 0.05, a.x, a.y - s * 0.8, s * 0.55);
    tg.addColorStop(0, '#7cc255'); tg.addColorStop(0.7, '#3d8238'); tg.addColorStop(1, '#245c2a');
    c.fillStyle = tg; c.beginPath(); c.arc(a.x, a.y - s * 0.8, s * 0.5, 0, TAU); c.fill();
    for (let q = 0; q < 14; q++) { c.fillStyle = `rgba(${40 + rnd() * 40},${100 + rnd() * 60},${40},0.5)`; c.beginPath(); c.arc(a.x + (rnd() - 0.5) * s * 0.9, a.y - s * 0.8 + (rnd() - 0.5) * s * 0.9, s * 0.07, 0, TAU); c.fill(); }
    c.fillStyle = '#f2c94c'; for (let q = 0; q < 5; q++) { c.beginPath(); c.arc(a.x + (rnd() - 0.5) * s * 0.7, a.y - s * 0.8 + (rnd() - 0.5) * s * 0.7, s * 0.07, 0, TAU); c.fill(); }
  }
  // ---- the court: far rail, walls, then the floor ----------------------------------------------------------------------------
  if (side) rail(-1, { outer: false, top: true, inner: true });
  else { rail(-1, { outer: true, top: true, inner: true }); rail(1, { outer: true, top: true, inner: true }); }
  const tex = floorTexture(P, 0x5eed + surf.pal.length * 31);
  const f0 = pr(-HALF, yN, 0), f1 = pr(-HALF, COURT.L, 0), f2 = pr(HALF, COURT.L, 0), f3 = pr(HALF, yN, 0);
  if (tex) {
    const NS = 150;
    c.save(); c.beginPath(); c.moveTo(f0.x, f0.y); c.lineTo(f1.x, f1.y); c.lineTo(f2.x, f2.y); c.lineTo(f3.x, f3.y); c.closePath(); c.clip();
    for (let i = 0; i < NS; i++) {
      const ya = yN + ((COURT.L - yN) * i) / NS, yb = yN + ((COURT.L - yN) * (i + 1)) / NS;
      const va = (ya / COURT.L) * TH, vb = Math.min(TH, (yb / COURT.L) * TH), dv = Math.max(1, vb - va);
      const p00 = pr(-HALF, ya), p10 = pr(HALF, ya), p01 = pr(-HALF, yb + 0.02);
      c.save(); c.transform((p10.x - p00.x) / TW, (p10.y - p00.y) / TW, (p01.x - p00.x) / dv, (p01.y - p00.y) / dv, p00.x, p00.y);
      c.drawImage(tex, 0, va, TW, dv, 0, 0, TW, dv); c.restore();
    }
    c.restore();
  } else { c.fillStyle = rgb(P.base); quad(c, f0, f1, f2, f3); c.fill(); }
  endWall(COURT.L, 1);
  if (side) endWall(yN, -1);
  // string lights across the garden
  for (const yy of [COURT.L + 0.4, 13, 6]) {
    const a = pr(-HALF - 1.7, yy, 3.1), b = pr(HALF + 1.7, yy, 3.1);
    for (const sgn of [-1, 1]) { const p = pr(sgn * (HALF + 1.7), yy, 3.1), q = pr(sgn * (HALF + 1.7), yy, 0); c.strokeStyle = '#3a2a1c'; c.lineWidth = Math.max(2, p.s * 0.05); c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x, p.y); c.stroke(); }
    const sag = Math.max(8, Math.hypot(b.x - a.x, b.y - a.y) * 0.06), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag * 2;
    c.strokeStyle = 'rgba(30,22,16,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke();
    for (let i = 0; i <= 10; i++) { const t = i / 10, x = (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * mx + t * t * b.x, y = (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * my + t * t * b.y; bulb(c, x, y, Math.max(2.2, a.s * 0.03), 0.95); }
  }
  // gentle vignette
  g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  g.addColorStop(0, 'rgba(20,10,30,0)'); g.addColorStop(1, 'rgba(20,10,30,0.3)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

const scenes = new Map();
// { back, front } canvases for this layout and surface (front is null in the behind-the-thrower view)
export function getScene(L, surf) {
  const k = Math.min(Q * 1.2, 4096 / Math.max(L.w, L.h));
  const key = `${L.key}|${surf.pal}|${k.toFixed(2)}`;
  let s = scenes.get(key);
  if (s !== undefined) return s;
  s = null;
  if (canBake()) {
    const back = newCanvas(L.w * k, L.h * k);
    if (back) {
      paintScene(back.getContext('2d'), L, surf, k, false);
      let front = null;
      if (L.cam.side) { front = newCanvas(L.w * k, L.h * k); if (front) paintScene(front.getContext('2d'), L, surf, k, true); }
      s = { back, front };
    }
  }
  scenes.set(key, s);
  if (scenes.size > 5) scenes.delete(scenes.keys().next().value);
  return s;
}
export const sceneReady = () => canBake();


// ---- balls -------------------------------------------------------------------------------------------------------------------
// The shaded sphere, cached per team and size: base colour lit from the upper left, a reflection of the sky above and the warm
// court below the horizon, a window highlight, and a rim of bounce light. Grooves are drawn on top, rotated with the ball.
const sprites = new Map();
function ballSprite(pal, size, key) {
  const k = `${key}|${size}`;
  let sp = sprites.get(k);
  if (sp !== undefined) return sp;
  const S = size * 2 + 4, cv = newCanvas(S, S);
  sp = cv;
  if (cv) {
    const c = cv.getContext('2d'), cx = S / 2, cy = S / 2, r = size;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.save(); c.clip();
    let g = c.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx, cy, r * 1.05);
    g.addColorStop(0, pal.hi); g.addColorStop(0.32, pal.base); g.addColorStop(1, pal.dark);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    // environment: sky overhead, horizon band, warm ground below
    g = c.createLinearGradient(0, cy - r, 0, cy + r * 0.15);
    g.addColorStop(0, 'rgba(190,225,255,0.5)'); g.addColorStop(0.7, 'rgba(255,238,200,0.18)'); g.addColorStop(1, 'rgba(255,238,200,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, r, r, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,248,226,0.34)'; c.beginPath(); c.ellipse(cx, cy + r * 0.12, r * 0.97, r * 0.07, -0.08, 0, TAU); c.fill();
    g = c.createLinearGradient(0, cy + r * 0.2, 0, cy + r);
    g.addColorStop(0, 'rgba(230,196,140,0)'); g.addColorStop(1, 'rgba(236,204,150,0.34)');
    c.fillStyle = g; c.fillRect(0, cy + r * 0.2, S, r);
    // the lawn bounces a little green onto the lower left, a warm lamp onto the lower right, a thin strip of sky shows along the top
    g = c.createRadialGradient(cx - r * 0.45, cy + r * 0.55, 0, cx - r * 0.45, cy + r * 0.55, r * 0.8);
    g.addColorStop(0, 'rgba(130,200,90,0.28)'); g.addColorStop(1, 'rgba(130,200,90,0)'); c.fillStyle = g; c.fillRect(0, 0, S, S);
    g = c.createRadialGradient(cx + r * 0.5, cy + r * 0.45, 0, cx + r * 0.5, cy + r * 0.45, r * 0.7);
    g.addColorStop(0, 'rgba(255,208,140,0.22)'); g.addColorStop(1, 'rgba(255,208,140,0)'); c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.strokeStyle = 'rgba(235,246,255,0.42)'; c.lineWidth = Math.max(1, r * 0.07); c.beginPath(); c.arc(cx + r * 0.05, cy + r * 0.12, r * 0.84, -Math.PI * 0.78, -Math.PI * 0.32); c.stroke();
    // window highlight (a lamp or the sky) and a pin-point sparkle
    c.save(); c.translate(cx - r * 0.4, cy - r * 0.45); c.rotate(-0.6);
    g = c.createLinearGradient(-r * 0.3, 0, r * 0.3, 0); g.addColorStop(0, 'rgba(255,255,255,0.15)'); g.addColorStop(0.5, 'rgba(255,255,255,0.92)'); g.addColorStop(1, 'rgba(255,255,255,0.2)');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * 0.3, r * 0.15, 0, 0, TAU); c.fill(); c.restore();
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(cx - r * 0.55, cy - r * 0.2, r * 0.05, 0, TAU); c.fill();
    // bounce light on the shadow side
    g = c.createRadialGradient(cx + r * 0.1, cy + r * 0.1, r * 0.55, cx + r * 0.25, cy + r * 0.3, r * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,236,190,0.3)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.restore();
    c.lineWidth = Math.max(1, r * 0.04); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(cx, cy, r - c.lineWidth / 2, 0, TAU); c.stroke();
  }
  sprites.set(k, sp);
  if (sprites.size > 60) sprites.delete(sprites.keys().next().value);
  return sp;
}

// ring directions in the ball's own frame
const RINGS = [[0, 0.6, 0.8], [0.82, -0.28, 0.5], [-0.5, 0.7, -0.5]].map((n) => { const l = Math.hypot(...n); const N = n.map((v) => v / l); const t = Math.abs(N[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; const e1n = [N[1] * t[2] - N[2] * t[1], N[2] * t[0] - N[0] * t[2], N[0] * t[1] - N[1] * t[0]]; const l1 = Math.hypot(...e1n); const e1 = e1n.map((v) => v / l1); const e2 = [N[1] * e1[2] - N[2] * e1[1], N[2] * e1[0] - N[0] * e1[2], N[0] * e1[1] - N[1] * e1[0]]; return { e1, e2 }; });
export const identityRot = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
// roll the ball's frame by a ground displacement (dx, dy) of radius r
export function rollRot(Rm, dx, dy, r) {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return Rm;
  const ang = d / r, ax = -dy / d, ay = dx / d, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  const M = [t * ax * ax + c, t * ax * ay, s * ay, t * ax * ay, t * ay * ay + c, -s * ax, -s * ay, s * ax, c];
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = M[i * 3] * Rm[j] + M[i * 3 + 1] * Rm[3 + j] + M[i * 3 + 2] * Rm[6 + j];
  return o;
}

// Draw one ball (or the pallino) at a world position. cam = layout camera; Rm = its rotation; o: { alpha, pal }
export function drawBall(ctx, cam, b, Rm, o = {}) {
  const p = cam.project(b.x, b.y, b.z), rp = Math.max(2, b.r * p.s);
  const pal = b.k ? PALLINO_PAL : (o.pal ?? TEAM[b.team]);
  const size = Math.max(3, Math.round((rp * Q) / 2) * 2);
  const sp = ballSprite(pal, size, b.k ? 'p' : `t${b.team}${pal.name}`);
  if (!sp) return;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const k = rp / size;
  if (rp > 6) {
    // a faint mirror image in the varnished floor
    const m = cam.project(b.x, b.y, -b.z), baseA = (o.alpha ?? 1) * 0.16 / (1 + Math.max(0, b.z - b.r) * 1.6);
    ctx.save(); ctx.globalAlpha = baseA; ctx.translate(m.x, m.y); ctx.scale(1, -0.9);
    ctx.drawImage(sp, -(size + 2) * k, -(size + 2) * k, (size * 2 + 4) * k, (size * 2 + 4) * k); ctx.restore();
  }
  ctx.drawImage(sp, p.x - (size + 2) * k, p.y - (size + 2) * k, (size * 2 + 4) * k, (size * 2 + 4) * k);
  if (!b.k && rp > 5 && Rm) {
    // grooves: great circles seen from the camera
    const eye = cam.eye, vx = eye[0] - b.x, vy = eye[1] - b.y, vz = eye[2] - b.z, vl = Math.hypot(vx, vy, vz) || 1;
    const V = [vx / vl, vy / vl, vz / vl];
    // camera up vector (perpendicular to V, towards +z): u = (z-axis - (z.V)V) normalised
    let ux = -V[2] * V[0], uy = -V[2] * V[1], uz = 1 - V[2] * V[2]; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const rx = uy * V[2] - uz * V[1], ry = uz * V[0] - ux * V[2], rz = ux * V[1] - uy * V[0];
    ctx.beginPath(); ctx.arc(p.x, p.y, rp * 0.985, 0, TAU); ctx.clip();
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass === 0 ? Math.max(1, rp * 0.1) : Math.max(0.8, rp * 0.05);
      ctx.strokeStyle = pass === 0 ? pal.groove : 'rgba(255,255,255,0.28)';
      const off = pass === 0 ? 0 : -rp * 0.05;
      for (const ring of RINGS) {
        ctx.beginPath(); let pen = false;
        for (let i = 0; i <= 28; i++) {
          const th = (i / 28) * TAU, ct = Math.cos(th), st = Math.sin(th);
          const lx = ring.e1[0] * ct + ring.e2[0] * st, ly = ring.e1[1] * ct + ring.e2[1] * st, lz = ring.e1[2] * ct + ring.e2[2] * st;
          const wx = Rm[0] * lx + Rm[1] * ly + Rm[2] * lz, wy = Rm[3] * lx + Rm[4] * ly + Rm[5] * lz, wz = Rm[6] * lx + Rm[7] * ly + Rm[8] * lz;
          if (wx * V[0] + wy * V[1] + wz * V[2] <= 0.02) { pen = false; continue; }
          const sx = p.x + (wx * rx + wy * ry + wz * rz) * rp + off, sy = p.y - (wx * ux + wy * uy + wz * uz) * rp + off;
          if (!pen) { ctx.moveTo(sx, sy); pen = true; } else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    }
    // re-apply a little shading over the grooves so they sit in the surface
    const g = ctx.createRadialGradient(p.x - rp * 0.35, p.y - rp * 0.4, rp * 0.1, p.x, p.y, rp * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g; ctx.fillRect(p.x - rp, p.y - rp, rp * 2, rp * 2);
  }
  ctx.restore();
}
// soft floor shadow; it shifts away from the light and fades as the ball rises
export function drawShadow(ctx, cam, b, alpha = 1) {
  const lift = Math.max(0, b.z - b.r), q = cam.project(b.x + 0.32 * lift + 0.05, b.y + 0.2 * lift + 0.03, 0), rp = b.r * q.s;
  const a = alpha * 0.5 / (1 + lift * 0.9), rx = rp * (1.25 + lift * 0.4), ry = rp * (0.55 + lift * 0.15);
  const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rx);
  g.addColorStop(0, `rgba(20,12,6,${a})`); g.addColorStop(0.55, `rgba(20,12,6,${a * 0.55})`); g.addColorStop(1, 'rgba(20,12,6,0)');
  ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, ry / rx); ctx.translate(-q.x, -q.y);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, rx, 0, TAU); ctx.fill(); ctx.restore();
}
// flat ball icon for HUDs and menus
export function drawBallIcon(ctx, x, y, rpx, team, alpha = 1, rot = null) {
  const pal = team < 0 ? PALLINO_PAL : TEAM[team];
  const size = Math.max(3, Math.round((rpx * Q) / 2) * 2), sp = ballSprite(pal, size, team < 0 ? 'p' : `t${team}${pal.name}`);
  if (!sp) return;
  ctx.save(); ctx.globalAlpha = alpha;
  const k = rpx / size;
  ctx.drawImage(sp, x - (size + 2) * k, y - (size + 2) * k, (size * 2 + 4) * k, (size * 2 + 4) * k);
  ctx.restore();
}
export const BALL_R = R_B;
