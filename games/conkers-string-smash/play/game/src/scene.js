// The look: a misty golden-hour autumn park, two forearms holding two conkers on strings, and the conkers themselves drawn as lit, glossy, grained
// chestnuts with a pale patch (the weak spot), cracks that grow with damage, and chips when one shatters. Pure drawing; the only inputs are the
// state passed in and the time `t` (leaves drift as a function of t, so nothing here keeps its own state).
import { L, R, PD, bobPos } from './sim.js';

export const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- camera: world metres -> screen design units --------------------------------------------------------------------------------
export const WORLD = { x0: -0.5, x1: 0.73, y0: -0.26, y1: 0.74 };
export function makeCam(rx, ry, rw, rh, mirror) {
  const ww = WORLD.x1 - WORLD.x0, wh = WORLD.y1 - WORLD.y0;
  const k = Math.min(rw / ww, rh / wh), cx = rx + rw / 2, cy = ry + rh / 2, wxc = (WORLD.x0 + WORLD.x1) / 2, wyc = (WORLD.y0 + WORLD.y1) / 2;
  const m = mirror ? -1 : 1;
  return {
    k, mirror, rect: { x: rx, y: ry, w: rw, h: rh },
    X: (x) => cx + m * (x - wxc) * k, Y: (y) => cy + (y - wyc) * k,
    wx: (sx) => wxc + ((sx - cx) / k) * m, wy: (sy) => wyc + (sy - cy) / k,
    groundY: cy + (WORLD.y1 + 0.05 - wyc) * k,
  };
}

// ---- backdrop ---------------------------------------------------------------------------------------------------------------------
const LEAF_COLS = ['#d9531e', '#e8892a', '#c23b1c', '#f0b33a', '#a8431c', '#7d8c2e'];
export function drawBackdrop(ctx, w, h, t, groundY, o = {}) {
  const gy = clamp(groundY, h * 0.5, h * 0.92);
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, '#9fb7a6'); sky.addColorStop(0.45, '#e9dcb0'); sky.addColorStop(1, '#f6d99a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, gy + 2);
  // low sun glow
  const sx = w * 0.72, sy = gy - h * 0.1;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.55);
  glow.addColorStop(0, 'rgba(255,236,170,0.85)'); glow.addColorStop(0.35, 'rgba(255,214,130,0.35)'); glow.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, gy);
  // far tree line: soft silhouettes in misty greens and ochres
  for (let layer = 0; layer < 3; layer++) {
    const base = gy - h * (0.05 + layer * 0.012), amp = h * (0.16 - layer * 0.03);
    const col = ['rgba(120,138,104,0.55)', 'rgba(150,140,86,0.6)', 'rgba(176,122,62,0.62)'][layer];
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, gy);
    for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, base - amp * (0.45 + 0.55 * Math.abs(Math.sin(x * 0.011 + layer * 2.3) * Math.cos(x * 0.0043 + layer))));
    ctx.lineTo(w + 20, gy); ctx.closePath(); ctx.fill();
  }
  // big soft canopy blobs (out of focus) top left and top right, with bokeh dots
  const blob = (x, y, r, c0, c1) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const big = Math.max(w, h);
  blob(w * 0.08, h * 0.04, big * 0.34, 'rgba(226,120,38,0.78)', 'rgba(226,120,38,0)');
  blob(w * 0.92, h * 0.02, big * 0.3, 'rgba(204,70,28,0.7)', 'rgba(204,70,28,0)');
  blob(w * 0.5, -h * 0.02, big * 0.3, 'rgba(238,176,58,0.55)', 'rgba(238,176,58,0)');
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3.1) * w, y = hash(i * 7.7) * gy * 0.55, r = (0.012 + hash(i * 2.9) * 0.03) * big;
    ctx.globalAlpha = 0.16 + hash(i * 5.3) * 0.18; ctx.fillStyle = LEAF_COLS[i % 4]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // two dark trunks at the edges (for depth)
  const trunk = (x0, wd) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + wd, 0); g.addColorStop(0, 'rgba(46,28,16,0.0)'); g.addColorStop(0.2, 'rgba(46,28,16,0.8)'); g.addColorStop(0.8, 'rgba(70,42,22,0.8)'); g.addColorStop(1, 'rgba(46,28,16,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, 0, wd, gy + 6);
  };
  trunk(-w * 0.02, w * 0.1); trunk(w * 0.9, w * 0.14);
  // the ground: olive earth, a lighter band at the horizon and a darker front
  const gr = ctx.createLinearGradient(0, gy, 0, h);
  gr.addColorStop(0, '#8a7a3a'); gr.addColorStop(0.12, '#6e5a2a'); gr.addColorStop(1, '#2d2112');
  ctx.fillStyle = gr; ctx.fillRect(0, gy, w, h - gy);
  ctx.fillStyle = 'rgba(255,230,160,0.22)'; ctx.fillRect(0, gy, w, 3);
  // leaf litter on the ground and a few spiky green husks
  const nLit = 70;
  for (let i = 0; i < nLit; i++) {
    const x = hash(i * 1.7) * w, y = gy + (h - gy) * (0.04 + Math.pow(hash(i * 4.1), 1.3) * 0.96), sz = (h - gy) * (0.02 + hash(i * 9.3) * 0.035) * (0.6 + (y - gy) / (h - gy));
    ctx.save(); ctx.translate(x, y); ctx.rotate(hash(i * 6.1) * TAU); ctx.fillStyle = LEAF_COLS[i % LEAF_COLS.length]; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.6, sz * 0.8, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = Math.max(1, sz * 0.12);
    ctx.beginPath(); ctx.moveTo(-sz * 1.5, 0); ctx.lineTo(sz * 1.5, 0); ctx.stroke(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (!o.noHusks) for (let i = 0; i < 4; i++) {
    const x = w * (0.1 + i * 0.27 + hash(i + 3) * 0.1), y = gy + (h - gy) * (0.45 + hash(i * 3.3) * 0.4), r = Math.max(14, (h - gy) * 0.07);
    husk(ctx, x, y, r, i);
  }
  // drifting leaves in front (a function of t)
  for (let i = 0; i < 14; i++) {
    const sp = 18 + hash(i * 2.2) * 30, x0 = hash(i * 8.8) * (w + 80) - 40, ph = hash(i * 1.3) * TAU;
    const x = ((x0 + t * sp * 0.6 + Math.sin(t * 0.7 + ph) * 26) % (w + 80) + (w + 80)) % (w + 80) - 40, y = ((hash(i * 4.4) * h + t * (22 + hash(i * 6.6) * 28)) % (gy * 1.05));
    const rot = t * (0.8 + hash(i) * 1.2) + ph, sz = big * (0.008 + hash(i * 3.9) * 0.01);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = 0.8; ctx.fillStyle = LEAF_COLS[i % LEAF_COLS.length];
    ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.6, sz * Math.abs(Math.cos(rot * 1.3)) * 0.8 + 0.5, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // a gentle vignette keeps the eye on the middle
  const v = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(30,16,6,0)'); v.addColorStop(1, 'rgba(30,16,6,0.42)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// A green spiky husk, split open, with a conker inside (decoration on the ground).
export function husk(ctx, x, y, r, seed = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(hash(seed + 9) * 0.6 - 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 1.2, r * 0.3, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 0, 0, 0, r * 1.2); g.addColorStop(0, '#9bb63f'); g.addColorStop(1, '#4f6a1c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3d5214'; ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); ctx.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); ctx.stroke(); }
  ctx.fillStyle = '#e8e2b2'; ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.12, r * 0.58, r * 0.36, 0.3, 0, TAU); ctx.fill();
  drawConker(ctx, r * 0.1, r * 0.1, r * 0.46, { rot: 0.3, psi: 1.2, seed: seed + 5, noShadow: true });
  ctx.restore();
}

// ---- the conker ---------------------------------------------------------------------------------------------------------------------
// o: rot = how far the string is turned (so the grain turns with it), psi = where the pale patch faces, dmg = 0..1, seed, glow = 0..1 (a highlight ring),
// alpha, flash (white flash on a touch).
export function drawConker(ctx, x, y, r, o = {}) {
  const { rot = 0, psi = 0, dmg = 0, seed = 1, glow = 0, alpha = 1, flash = 0, noShadow = false } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow > 0) { const g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.1); g.addColorStop(0, `rgba(255,222,120,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,222,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, TAU); ctx.fill(); }
  // body
  const body = ctx.createRadialGradient(x - r * 0.34, y - r * 0.4, r * 0.05, x - r * 0.05, y - r * 0.05, r * 1.12);
  body.addColorStop(0, '#f2a65c'); body.addColorStop(0.14, '#cf7430'); body.addColorStop(0.5, '#8d3411'); body.addColorStop(0.86, '#471608'); body.addColorStop(1, '#210a03');
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  // grain: dark streaks that run around the nut, turning with it
  ctx.lineCap = 'round';
  for (let i = 0; i < 15; i++) {
    const a = rot * 0.6 + hash(seed * 13 + i) * TAU, rr = r * (0.25 + hash(seed * 5 + i * 2) * 0.9), len = 0.5 + hash(seed + i * 3) * 0.9;
    ctx.strokeStyle = `rgba(32,10,2,${0.16 + hash(seed * 7 + i) * 0.2})`; ctx.lineWidth = Math.max(1, r * (0.05 + hash(i + seed) * 0.07));
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, rr, a + 2.2, a + 2.2 + len); ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const a = rot * 0.6 + hash(seed * 3 + i * 17) * TAU, rr = r * (0.3 + hash(i * 9 + seed) * 0.6);
    ctx.strokeStyle = `rgba(255,170,90,${0.07 + hash(i + seed * 5) * 0.08})`; ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath(); ctx.arc(x - Math.cos(a) * r * 0.3, y - Math.sin(a) * r * 0.3, rr, a, a + 0.6); ctx.stroke();
  }
  // the pale patch (weak spot): psi 0 = down along the string at rest; the conker turns with the string, `rot` radians
  const pa = Math.PI / 2 - psi + rot * 0 + (o.pdir ?? 0);
  const px = x + Math.cos(pa) * r * 0.6, py = y + Math.sin(pa) * r * 0.6;
  ctx.save(); ctx.translate(px, py); ctx.rotate(pa + Math.PI / 2);
  const pg = ctx.createRadialGradient(0, -r * 0.05, 0, 0, 0, r * 0.62);
  pg.addColorStop(0, '#f1dfb4'); pg.addColorStop(0.55, '#d6b883'); pg.addColorStop(0.9, '#a8793c'); pg.addColorStop(1, '#5c2c0e');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.52, r * 0.36, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,24,6,0.6)'; ctx.lineWidth = Math.max(1, r * 0.04); ctx.stroke();
  ctx.fillStyle = 'rgba(90,50,20,0.35)';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc((hash(seed + i) - 0.5) * r * 0.7, (hash(seed * 3 + i) - 0.5) * r * 0.4, Math.max(0.6, r * 0.022), 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.restore();
  // soft shade on the lower right, then the gloss
  const sh = ctx.createRadialGradient(x + r * 0.45, y + r * 0.5, r * 0.1, x + r * 0.45, y + r * 0.5, r * 1.1);
  sh.addColorStop(0, 'rgba(255,150,70,0.0)'); sh.addColorStop(1, 'rgba(10,2,0,0.38)');
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  ctx.save(); ctx.translate(x - r * 0.36, y - r * 0.42); ctx.rotate(-0.6);
  const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.4); gl.addColorStop(0, 'rgba(255,248,230,0.95)'); gl.addColorStop(0.5, 'rgba(255,236,200,0.45)'); gl.addColorStop(1, 'rgba(255,230,190,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.4, r * 0.22, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,196,120,0.38)'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.arc(x, y, r * 0.93, 0.2, 1.25); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,6,0,0.55)'; ctx.lineWidth = Math.max(1, r * 0.04); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  // cracks
  if (dmg > 0.08) drawCracks(ctx, x, y, r, dmg, seed);
  if (flash > 0) { ctx.globalAlpha = flash * 0.3; ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.restore();
  void noShadow;
}

function drawCracks(ctx, x, y, r, dmg, seed) {
  const n = dmg < 0.3 ? 1 : dmg < 0.5 ? 2 : dmg < 0.75 ? 3 : 5;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 1.01, 0, TAU); ctx.clip(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let c = 0; c < n; c++) {
    let a = hash(seed * 9 + c * 3.3) * TAU, px = x + Math.cos(a) * r * 1.02, py = y + Math.sin(a) * r * 1.02;
    const segs = 4 + Math.round(dmg * 5), pts = [[px, py]];
    for (let s = 0; s < segs; s++) {
      a += (hash(seed * 31 + c * 7 + s) - 0.5) * 1.5 + 3.14159 * 0.0;
      const toward = Math.atan2(y - py, x - px); a = a * 0.45 + toward * 0.55;
      const step = r * (0.2 + hash(seed + c * 5 + s * 11) * 0.22) * (0.5 + dmg);
      px += Math.cos(a) * step; py += Math.sin(a) * step; pts.push([px, py]);
    }
    const draw = (col, wdt, dx, dy) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + dx, p[1] + dy) : ctx.moveTo(p[0] + dx, p[1] + dy))); ctx.stroke(); };
    draw('rgba(255,225,170,0.55)', Math.max(1.2, r * 0.07), 0.8, 0.8);
    draw('rgba(18,5,0,0.95)', Math.max(1, r * 0.05 * (0.6 + dmg)), 0, 0);
  }
  ctx.restore();
}

// ---- strings, hands, arms -------------------------------------------------------------------------------------------------------------
export function drawString(ctx, x0, y0, x1, y1, k) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(40,24,10,0.5)'; ctx.lineWidth = Math.max(2, k * 0.012) + 1.5; ctx.beginPath(); ctx.moveTo(x0 + 1, y0 + 2); ctx.lineTo(x1 + 1, y1 + 2); ctx.stroke();
  ctx.strokeStyle = '#e8dcb6'; ctx.lineWidth = Math.max(2, k * 0.012); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,240,0.55)'; ctx.lineWidth = Math.max(1, k * 0.004); ctx.beginPath(); ctx.moveTo(x0 - 0.6, y0); ctx.lineTo(x1 - 0.6, y1); ctx.stroke();
  ctx.restore();
}

// A forearm in a sleeve ending in a fist, coming from off-screen toward (hx, hy). dir = +1 from the left, -1 from the right.
export function drawArm(ctx, hx, hy, dir, k, pal, reach = 0) {
  const th = k * 0.115, len = k * 1.4;
  const ang = -0.5 * dir * (1 + reach * 0.0);        // the arm rises away from the hand toward the screen edge
  const ex = hx - dir * Math.cos(ang) * len * 0, sx = hx - dir * len, sy = hy + Math.sin(0.5) * len * 0.0 - k * 0.42;
  void ex;
  ctx.save();
  // forearm (skin) as a thick rounded line from the elbow off-screen to the wrist
  const wx = hx - dir * k * 0.08, wy = hy - k * 0.045;
  const armG = ctx.createLinearGradient(0, hy - th, 0, hy + th); armG.addColorStop(0, pal.skinHi); armG.addColorStop(1, pal.skin);
  const sleeveLen = k * 0.62;
  const ux = wx - sx, uy = wy - sy, ul = Math.hypot(ux, uy), nx = -uy / ul, ny = ux / ul;
  const quad = (ax, ay, bx, by, wA, wB, fill) => {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(ax + nx * wA, ay + ny * wA); ctx.lineTo(bx + nx * wB, by + ny * wB); ctx.lineTo(bx - nx * wB, by - ny * wB); ctx.lineTo(ax - nx * wA, ay - ny * wA); ctx.closePath(); ctx.fill();
  };
  // sleeve from the screen edge up to a cuff, wrist (skin) between cuff and fist
  const cx = wx - (ux / ul) * k * 0.2, cy = wy - (uy / ul) * k * 0.2;
  quad(sx, sy, cx, cy, th * 1.15, th * 0.78, pal.sleeve);
  quad(sx, sy, cx, cy, th * 0.2, th * 0.12, 'rgba(255,255,255,0.12)');
  quad(cx - (ux / ul) * k * 0.06, cy - (uy / ul) * k * 0.06, cx, cy, th * 0.82, th * 0.82, pal.cuff);
  quad(cx, cy, wx, wy, th * 0.62, th * 0.55, armG);
  void sleeveLen;
  // folds in the sleeve
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(1, k * 0.006);
  for (let i = 1; i < 4; i++) { const f = i / 4.5, fx = sx + (cx - sx) * f, fy = sy + (cy - sy) * f; ctx.beginPath(); ctx.moveTo(fx + nx * th, fy + ny * th); ctx.quadraticCurveTo(fx - ux / ul * 6, fy - uy / ul * 6, fx - nx * th, fy - ny * th); ctx.stroke(); }
  ctx.restore();
}
// The fist holding the string, drawn after the strings so the string seems to come out of it. dir = +1 for the left arm (facing right).
export function drawFist(ctx, hx, hy, dir, k, pal) {
  const fr = k * 0.056;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, fr * 0.07); ctx.strokeStyle = pal.line;
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const g = ctx.createLinearGradient(0, hy - fr, 0, hy + fr); g.addColorStop(0, pal.skinHi); g.addColorStop(1, pal.skin);
  // back of the hand
  ctx.fillStyle = g; rr(hx - fr * 1.25, hy - fr * 0.85, fr * 2.0, fr * 1.7, fr * 0.7); ctx.fill(); ctx.stroke();
  // four curled fingers, stacked, on the side that faces the other player
  const fx0 = hx + dir * fr * 0.1 - (dir < 0 ? fr * 0.95 : 0);
  for (let i = 0; i < 4; i++) {
    const y = hy - fr * 0.8 + i * fr * 0.42;
    ctx.fillStyle = g; rr(fx0 + (dir > 0 ? fr * 0.2 : 0), y, fr * 0.95, fr * 0.46, fr * 0.22); ctx.fill(); ctx.stroke();
  }
  // the thumb across the top
  ctx.fillStyle = pal.skinHi; ctx.beginPath(); ctx.ellipse(hx + dir * fr * 0.45, hy - fr * 0.7, fr * 0.78, fr * 0.3, dir * 0.25, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}
export const PALS = [
  { sleeve: '#2f7f7c', cuff: '#e9e0c4', skin: '#d79a72', skinHi: '#efbf98', line: 'rgba(90,40,16,0.55)' },
  { sleeve: '#bd5a28', cuff: '#f1e4b8', skin: '#a8714c', skinHi: '#c99770', line: 'rgba(60,26,10,0.6)' },
];

// ---- one duel scene -------------------------------------------------------------------------------------------------------------------
// sim: the live physics (S striker, D defender; ps = striker's hand); duel: conkers and damage; opts: { sSide: 0|1 (which player strikes), aim: {...}, flash }
export function drawDuel(ctx, cam, sim, conkers, sSide, o = {}) {
  const dSide = 1 - sSide, k = cam.k;
  const ps = sim.ps, pd = PD;
  const S = bobPos(ps, sim.S.phi), D = bobPos(pd, sim.D.phi);
  const sx = cam.X(S.x), sy = cam.Y(S.y), dx = cam.X(D.x), dy = cam.Y(D.y);
  const sdir = cam.mirror ? -1 : 1;                    // the striker's side on screen: +1 left, -1 right (arm comes from there)
  const r = R * k;
  const cS = conkers[sSide], cD = conkers[dSide];
  // arms
  drawArm(ctx, cam.X(ps.x), cam.Y(ps.y), sdir, k, PALS[sSide]);
  drawArm(ctx, cam.X(pd.x), cam.Y(pd.y), -sdir, k, PALS[dSide]);
  // strings and conkers (the string runs from the fist to the top of the conker)
  const turn = (b) => (cam.mirror ? -b.phi : b.phi);
  if (!cS.gone) { drawString(ctx, cam.X(ps.x), cam.Y(ps.y), sx, sy, k); }
  if (!cD.gone) { drawString(ctx, cam.X(pd.x), cam.Y(pd.y), dx, dy, k); }
  // ring/glow if wanted
  const fl = o.flash || 0;
  const pS = patchArgs(cS.psi, sim.S.phi, cam.mirror), pDd = patchArgs(cD.psi, -sim.D.phi, !cam.mirror);
  if (!cS.gone) drawConker(ctx, sx, sy, r, { rot: turn(sim.S), psi: pS.psi, pdir: pS.pdir, dmg: cS.dmg, seed: cS.seed || 3, glow: o.glowS || 0, flash: fl });
  if (!cD.gone) drawConker(ctx, dx, dy, r, { rot: turn(sim.D), psi: pDd.psi, pdir: pDd.pdir, dmg: cD.dmg, seed: cD.seed || 7, glow: o.glowD || 0, flash: fl });
  drawFist(ctx, cam.X(ps.x), cam.Y(ps.y), sdir, k, PALS[sSide]);
  drawFist(ctx, cam.X(pd.x), cam.Y(pd.y), -sdir, k, PALS[dSide]);
  return { S: { x: sx, y: sy }, D: { x: dx, y: dy }, r };
}
// The pale patch on screen. In the toward-opponent frame its direction (math angle, y up) is -pi/2 + psi + phi; drawConker wants a canvas angle (y down), which is
// pi/2 - psi - phi when the opponent is on the right of the screen and its mirror image (pi/2 + psi + phi) when the opponent is on the left.
export const patchArgs = (psi, phiToward, mirrored) => (mirrored ? { psi: -psi, pdir: phiToward } : { psi, pdir: -phiToward });

// ---- particles ------------------------------------------------------------------------------------------------------------------------
export function drawParts(ctx, cam, parts) {
  for (const p of parts) {
    const a = clamp(1 - p.t / p.max, 0, 1), x = cam.X(p.x), y = cam.Y(p.y), s = p.size * cam.k;
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6);
    if (p.k === 'chip') {
      ctx.translate(x, y); ctx.rotate(p.rot + p.vr * p.t);
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(0, -s); ctx.lineTo(s * 1.1, s * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,0.5)'; ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(0, -s); ctx.lineTo(s * 0.2, 0); ctx.closePath(); ctx.fill();
    } else if (p.k === 'spark') {
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, s), 0, TAU); ctx.fill();
    } else if (p.k === 'dust') {
      ctx.fillStyle = p.col; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.arc(x, y, s * (1 + p.t * 1.4), 0, TAU); ctx.fill();
    } else if (p.k === 'ring') {
      ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(2, s * 0.25); ctx.beginPath(); ctx.arc(x, y, cam.k * (0.04 + p.t * 0.5), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}
export { L };
