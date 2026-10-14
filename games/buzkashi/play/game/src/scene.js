// The field seen from above: steppe ground, spectators, rope fence, the white circle, the post, riders and the sack, dust and the guide lines.
// Pure drawing from a state object; nothing here changes the simulation. The field is turned a quarter turn in landscape so it fills the
// screen either way; the camera follows the action along the long axis when the field does not fit.
import { FIELD, FLAG, CIRCLE, CENTRE, FLAG_WIND, FLAG_RING, SCOOP_REACH } from './consts.js';
import { frame3d } from './cam3d.js';

const TAU = Math.PI * 2;
export const FRAME = { x0: -18.4, x1: 18.4, y0: -29.6, y1: 29.6 };   // what the camera may show (the field plus the stands)
export const VIS = 2.15;
const SPAN = 30;                                                      // metres of the field's width shown across the short side of the screen                                               // riders are drawn this much larger than their body circle
const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const LOOKS = [
  { name: 'Dawn', g0: '#c9b77e', g1: '#9f9158', tuft: '#8a7c44', tint: 'rgba(255,170,120,0.13)', out0: '#2a2438', out1: '#463a4e', rope: '#e9d9b8', night: 0, snow: 0 },
  { name: 'Day', g0: '#cdbf80', g1: '#a39a5c', tuft: '#7c8a44', tint: null, out0: '#40563f', out1: '#587553', rope: '#f1e7c9', night: 0, snow: 0 },
  { name: 'Afternoon', g0: '#d2b878', g1: '#a98f55', tuft: '#8f7a3a', tint: 'rgba(255,196,100,0.11)', out0: '#4c5a3c', out1: '#6d7a47', rope: '#f6e6bf', night: 0, snow: 0 },
  { name: 'Winter', g0: '#c3bfa4', g1: '#9a9a88', tuft: '#7d7e6c', tint: 'rgba(170,200,240,0.14)', out0: '#38465a', out1: '#55667c', rope: '#f4f4ee', night: 0.1, snow: 1 },
  { name: 'Floodlit', g0: '#bcb280', g1: '#8f8960', tuft: '#6a6c3c', tint: 'rgba(8,16,48,0.26)', out0: '#0a0e1e', out1: '#17203a', rope: '#d9d4c2', night: 0.7, snow: 0 },
];

const SPECK = Array.from({ length: 360 }, (_, i) => ({ x: FIELD.x0 + hash(i) * 32, y: FIELD.y0 + hash(i + 900) * 54, r: 0.06 + hash(i + 1700) * 0.16, a: 0.08 + hash(i + 2500) * 0.16, dark: hash(i + 3100) > 0.4 }));
const TUFT = Array.from({ length: 150 }, (_, i) => ({ x: FIELD.x0 + hash(i + 40) * 32, y: FIELD.y0 + hash(i + 940) * 54, a: hash(i + 1740) * TAU, l: 0.5 + hash(i + 2540) * 0.9 }));
const PATCH = Array.from({ length: 16 }, (_, i) => ({ x: (hash(i + 70) - 0.5) * 28, y: (hash(i + 710) - 0.5) * 48, rx: 2 + hash(i + 1370) * 5, ry: 1.5 + hash(i + 2110) * 4, a: hash(i + 330) * 3 }));
const CROWD = ['#d9c7a0', '#8fb3c9', '#c96a5a', '#e0b24a', '#7fa56e', '#b693c4', '#e8e0d0'];
const COATS = [['#a87038', '#6a3e18'], ['#d8d2c6', '#8e8a82'], ['#3a302a', '#171210'], ['#b4602c', '#6e3414'], ['#d6b070', '#98763a']];
const TEAM = [
  { coat: '#f0a830', coat2: '#b87414', blanket: '#1f4f9a', trim: '#f6d98a', band: '#2a64bd' },
  { coat: '#f3ead6', coat2: '#b9ad92', blanket: '#b3302a', trim: '#f4e2b4', band: '#d4463c' },
];

// Camera: world metres -> virtual screen units. area = the rectangle of the screen the field may use; focus = the world y at the screen centre
// (along the long axis, clamped so that the stands never leave the frame).
function makeCam2d(W, H, area, land, focus) {
  const a = area || { x: 0, y: 0, w: W, h: H };
  const fw = FRAME.x1 - FRAME.x0, fl = FRAME.y1 - FRAME.y0;
  const f0 = focus && typeof focus === 'object' ? focus : { x: 0, y: focus || 0 };
  // the short side of the screen shows SPAN metres across the field (or the whole width when it fits); the long side follows the action
  const short = land ? a.h : a.w, long = land ? a.w : a.h;
  const sP = Math.min(a.w / fw, a.h / fl), sL = Math.min(a.w / fl, a.h / fw);
  land = sL > sP * 1.02;
  const s = Math.max(land ? sL : sP, (land ? a.h : a.w) / SPAN);
  void short; void long;
  const visAcross = (land ? a.h : a.w) / s, visAlong = (land ? a.w : a.h) / s;
  const fx = visAcross >= fw ? 0 : clamp(f0.x, FRAME.x0 + visAcross / 2, FRAME.x1 - visAcross / 2);
  const fy = visAlong >= fl ? 0 : clamp(f0.y, FRAME.y0 + visAlong / 2, FRAME.y1 - visAlong / 2);
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  const c = { s, land, cx, cy, W, H, area: a, focus: { x: fx, y: fy }, vis: visAlong };
  c.x = land ? (wx, wy) => cx + (wy - fy) * s : (wx) => cx + (wx - fx) * s;
  c.y = land ? (wx) => cy + (wx - fx) * s : (wx, wy) => cy - (wy - fy) * s;
  c.head = (th) => (land ? Math.PI / 2 - th : -th);
  c.world = (px, py) => (land ? { x: (py - cy) / s + fx, y: (px - cx) / s + fy } : { x: (px - cx) / s + fx, y: fy - (py - cy) / s });
  return c;
}
// The 3D field (web/view3d/field3d.js) puts itself on globalThis.__field3d when WebGL2 and the assets are available. While it is there, the
// camera is the perspective broadcast camera of cam3d.js and the scene is rendered by three.js; otherwise (no WebGL2, context lost, ?fig=2d, tests)
// the flat top-down scene below is drawn with the old camera. Input and the HUD always ask makeCam, so both agree with what is on screen.
export const field3d = () => { const F = globalThis.__field3d; return F && F.ready && !F.lost && !F.off ? F : null; };
export function makeCam(W, H, area, land, focus, o) {
  if (field3d()) { const c = frame3d(W, H, area, land, focus, { ...(globalThis.__camOverride || {}), ...(o || {}) }); c.is3d = true; return c; }
  return makeCam2d(W, H, area, land, focus);
}
export const groundCanvas = (idx, ppm = 30) => groundTexture(LOOKS[Math.max(0, Math.min(LOOKS.length - 1, idx | 0))], Math.max(0, Math.min(LOOKS.length - 1, idx | 0)), ppm);
// where the camera wants to look: between the human rider and the sack
export const focusFor = (s) => {
  // the action cluster: your rider, the sack and every rider within a few metres of the sack, weighted towards the sack
  const me = s.riders[0], sk = s.sack;
  let x = me.x * 0.4 + sk.x * 0.6, y = me.y * 0.4 + sk.y * 0.6, w = 1;
  for (const r of s.riders) if (r !== me && Math.hypot(r.x - sk.x, r.y - sk.y) < 6) { x += (r.x - x) * 0.12; y += (r.y - y) * 0.12; w++; }
  // keep the scoring circle in view once the sack has been taken round the post
  if (sk.rounded) { x = x * 0.7 + CIRCLE.x * 0.3; y = y * 0.7 + CIRCLE.y * 0.3; }
  return { x, y };
};
export const stepFocus = (f, t, dt) => { const k = Math.min(1, dt * 3); f.x += (t.x - f.x) * k; f.y += (t.y - f.y) * k; };

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const rectOf = (c, x0, y0, x1, y1) => {
  const ax = c.x(x0, y0), ay = c.y(x0, y0), bx = c.x(x1, y1), by = c.y(x1, y1);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
};
function poly(ctx, c, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => { const x = c.x(p.x, p.y), y = c.y(p.x, p.y); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
}

function drawOutside(ctx, c, look) {
  const W = c.W, H = c.H;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, look.out0); g.addColorStop(1, look.out1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const f = rectOf(c, FIELD.x0, FIELD.y0, FIELD.x1, FIELD.y1), m = 6.4 * c.s;
  ctx.save();
  ctx.fillStyle = `rgba(10,8,16,${0.3 + look.night * 0.25})`; rrect(ctx, f.x - m, f.y - m, f.w + 2 * m, f.h + 2 * m, m * 0.5); ctx.fill();
  // spectators in three rows along the rope, seen from above: shoulders in a coat, a head, a cap or a wrapped cloth, a long shadow
  ctx.globalAlpha = 1 - look.night * 0.45;
  const u = c.s;                                        // one metre
  let n = 0;
  const COAT = ['#6b4c30', '#344b63', '#7a342c', '#a88a48', '#44603f', '#574066', '#8e8570', '#262b36', '#8a5c3c', '#4b5a60', '#3a2f28', '#6f6a56'];
  const CAP = ['#17110d', '#2a1d12', '#1d1612', '#3a2a1c', '#d8cdb4', '#52382a', '#101010'];
  const SKIN = ['#e0b08a', '#c98f66', '#b87f58', '#d6a27a', '#a8704a'];
  const person = (x, y, ang, row) => {
    n++;
    const h1 = hash(n), h2 = hash(n + 31), h3 = hash(n + 77), h4 = hash(n + 123);
    const sz = u * (0.4 + h1 * 0.05) * (1 - row * 0.05);
    ctx.save(); ctx.translate(x + (h2 - 0.5) * u * 0.35, y + (h3 - 0.5) * u * 0.3); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(14,8,4,0.34)'; ctx.beginPath(); ctx.ellipse(sz * 0.3, sz * 0.4, sz * 1.25, sz * 0.7, 0, 0, TAU); ctx.fill();
    const cg = ctx.createLinearGradient(0, -sz, 0, sz); const base = COAT[Math.floor(h4 * COAT.length)];
    cg.addColorStop(0, base); cg.addColorStop(1, 'rgba(20,12,8,0.55)');
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, sz * 1.2, sz * 0.66, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, sz * 0.2, sz * 1.1, sz * 0.46, 0, 0, TAU); ctx.fill();
    if (h1 > 0.45) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(0.8, sz * 0.1); ctx.beginPath(); ctx.moveTo(-sz * 0.9, sz * 0.1); ctx.lineTo(sz * 0.9, sz * 0.1); ctx.stroke(); }
    // arms: some are raised (cheering) and show as small hands above the head
    if (h2 > 0.82) { ctx.fillStyle = SKIN[Math.floor(h3 * SKIN.length)]; for (const e of [-1, 1]) { ctx.beginPath(); ctx.arc(e * sz * 0.95, -sz * 0.55, sz * 0.2, 0, TAU); ctx.fill(); } }
    const skin = SKIN[Math.floor(h3 * SKIN.length)], cap = CAP[Math.floor(h1 * 7)];
    ctx.fillStyle = skin; for (const e of [-1, 1]) { ctx.beginPath(); ctx.arc(e * sz * 0.5, sz * 0.12, sz * 0.14, 0, TAU); ctx.fill(); }   // ears
    ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(0, sz * 0.1, sz * 0.5, 0, TAU); ctx.fill();                                              // cap or hair
    ctx.restore();
  };
  const f0 = f;
  for (let row = 2; row >= 0; row--) {
    const d = (1.7 + row * 1.45) * u, step = u * (1.1 + hash(row + 40) * 0.1);
    const xo = f0.x - d, xi = f0.x + f0.w + d, yo = f0.y - d, yi = f0.y + f0.h + d;
    for (let x = xo; x <= xi; x += step) for (const y of [yo, yi]) if (x > -20 && x < c.W + 20 && y > -20 && y < c.H + 20) person(x, y, y === yo ? 0.1 : -0.1, row);
    for (let y = yo + step; y < yi; y += step) for (const x of [xo, xi]) if (y > -20 && y < c.H + 20 && x > -20 && x < c.W + 20) person(x, y, Math.PI / 2 + (x === xo ? 0.1 : -0.1), row);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // felt tents (round roofs seen from above) beyond the stands
  const tent = (x, y, rad, col) => {
    if (x < -rad || y < -rad || x > W + rad || y > H + rad) return;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(rad * 0.18, rad * 0.22, rad, rad * 0.95, 0, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(-rad * 0.25, -rad * 0.3, rad * 0.1, 0, 0, rad); gr.addColorStop(0, '#f6efe0'); gr.addColorStop(1, col);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,20,0.5)'; ctx.lineWidth = Math.max(1, rad * 0.06);
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * TAU / 8) * rad, Math.sin(i * TAU / 8) * rad); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, rad * 0.35, 0, TAU); ctx.stroke();
    ctx.restore();
  };
  const tr = 3.2 * c.s, o = (6.4 + 3.4) * c.s;
  tent(f.x - o, f.y - o * 0.6, tr, '#b86a4a'); tent(f.x + f.w + o, f.y - o * 0.5, tr, '#c9a35a');
  tent(f.x - o, f.y + f.h + o * 0.55, tr, '#7e8fa8'); tent(f.x + f.w + o, f.y + f.h + o * 0.6, tr, '#a96a7c');
}

// ---- the ground: one painted texture per look (steppe grass, worn earth, scuffs, stones), built once and drawn scaled; falls back to the
// plain gradient where there is no DOM (tests). Deterministic: a seeded generator, never the clock.
const TEX_PPM = 22;
const texCache = new Map();
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function groundTexture(look, idx, PPM = TEX_PPM) {
  const ckey = `${idx}@${PPM}`;
  if (texCache.has(ckey)) return texCache.get(ckey);
  if (typeof document === 'undefined') return null;
  const W = Math.round((FIELD.x1 - FIELD.x0) * PPM), H = Math.round((FIELD.y1 - FIELD.y0) * PPM);
  const DOC = globalThis.document;
  const cv = DOC.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  if (!g) return null;
  const rnd = mulberry(1000 + idx * 77);
  const wx = (x) => (x - FIELD.x0) * PPM, wy = (y) => (FIELD.y1 - y) * PPM;
  const lerpHex = (a, b, t) => { const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`; };
  // base: a warm gradient, light in the middle, darker toward the rope
  const bg = g.createRadialGradient(W / 2, H / 2, PPM * 2, W / 2, H / 2, PPM * 38);
  bg.addColorStop(0, look.g0); bg.addColorStop(1, look.g1);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // big soft mottling in three sizes: patches of greener grass, pale dry earth and darker damp earth
  const blot = (n, r0, r1, col, a) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H, r = (r0 + rnd() * (r1 - r0)) * PPM;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col.replace('A', String(a * (0.5 + rnd() * 0.7)))); gr.addColorStop(1, col.replace('A', '0'));
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.45 + rnd() * 0.5), rnd() * 3, 0, 7); g.fill();
    }
  };
  blot(46, 2.5, 7, 'rgba(120,118,56,A)', 0.2);     // grass
  blot(38, 2, 6, 'rgba(236,216,160,A)', 0.2);      // dry pale
  blot(30, 1.5, 5, 'rgba(92,66,34,A)', 0.2);       // damp
  // worn earth: the lane between circle and post, the centre, round the post and the circle
  const wear = (x, y, rx, ry, a) => { const gr = g.createRadialGradient(wx(x), wy(y), 0, wx(x), wy(y), rx * PPM); gr.addColorStop(0, `rgba(104,78,44,${a})`); gr.addColorStop(1, 'rgba(104,78,44,0)'); g.save(); g.translate(wx(x), wy(y)); g.scale(1, ry / rx); g.translate(-wx(x), -wy(y)); g.fillStyle = gr; g.beginPath(); g.arc(wx(x), wy(y), rx * PPM, 0, 7); g.fill(); g.restore(); };
  for (let i = 0; i <= 8; i++) wear((rnd() - 0.5) * 4, FLAG.y - 2 - i * (FLAG.y - CIRCLE.y - 4) / 8, 5.5, 5.5, 0.16);
  wear(FLAG.x, FLAG.y, 8, 8, 0.3); wear(CIRCLE.x, CIRCLE.y, 7, 7, 0.28); wear(CENTRE.x, CENTRE.y, 6, 6, 0.24);
  // fine grain, then grass in short tufts that all lean the same way (wind), pale tips
  const PK = (PPM / 22) ** 2;
  for (let i = 0; i < Math.round(16000 * PK); i++) {
    const x = rnd() * W, y = rnd() * H, d = rnd() > 0.45;
    g.fillStyle = d ? `rgba(58,40,18,${0.06 + rnd() * 0.12})` : `rgba(255,244,214,${0.06 + rnd() * 0.12})`;
    g.fillRect(x, y, 1 + rnd() * 1.3, 1 + rnd() * 1.3);
  }
  g.lineCap = 'round';
  for (let i = 0; i < Math.round(2300 * PK * 1.4); i++) {
    const x = rnd() * W, y = rnd() * H;
    const worn = Math.hypot(x / PPM + FIELD.x0, FIELD.y1 - y / PPM) ;          // thinner grass near the middle lane
    if (Math.abs(x / PPM + FIELD.x0) < 3.2 && rnd() < 0.7) continue;
    void worn;
    const n = 3 + Math.floor(rnd() * 5), lean = 0.25 + (rnd() - 0.5) * 0.4, tone = rnd();
    for (let k = 0; k < n; k++) {
      const ox = (rnd() - 0.5) * 7 * PPM / 22, oy = (rnd() - 0.5) * 4 * PPM / 22, l = (5 + rnd() * 8) * 0.8;
      g.strokeStyle = tone > 0.6 ? lerpHex('#8a8a4a', '#b8a460', rnd()) : tone > 0.25 ? lerpHex('#6a7238', '#a09a52', rnd()) : lerpHex('#b09a5c', '#d8c88c', rnd());
      g.globalAlpha = 0.5 + rnd() * 0.4; g.lineWidth = 0.9 + rnd() * 0.8;
      g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + l * lean * 0.3, y + oy - l * 0.6, x + ox + l * lean, y + oy - l); g.stroke();
    }
  }
  g.globalAlpha = 1;
  // hoof scuffs along the play: small crescents of dark and pale churned earth
  for (let i = 0; i < 380; i++) {
    const x = (rnd() - 0.5) * 24, y = (rnd() - 0.5) * 46, a = rnd() * 6.28;
    g.strokeStyle = rnd() > 0.5 ? 'rgba(70,48,24,0.2)' : 'rgba(238,220,176,0.22)'; g.lineWidth = 1.2 + rnd() * 1.2;
    g.beginPath(); g.arc(wx(x), wy(y), 2 + rnd() * 2.5, a, a + 1.2); g.stroke();
  }
  // stones and clods
  for (let i = 0; i < 110; i++) {
    const x = rnd() * W, y = rnd() * H, r = 1.4 + rnd() * 2.6;
    g.fillStyle = 'rgba(40,28,14,0.35)'; g.beginPath(); g.ellipse(x + 1, y + 1.2, r * 1.1, r * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = rnd() > 0.5 ? '#b8ad94' : '#8a7a5a'; g.beginPath(); g.ellipse(x, y, r, r * 0.75, rnd(), 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.4, r * 0.25, 0, 0, 7); g.fill();
  }
  if (look.snow) {
    // frost: a pale wash, drifts along the rope, and a fine scatter of flecks (no big round patches)
    g.fillStyle = 'rgba(236,242,248,0.2)'; g.fillRect(0, 0, W, H);
    for (const sx of [0, 1]) {
      const gr = g.createLinearGradient(sx ? W : 0, 0, sx ? W - 3.2 * PPM : 3.2 * PPM, 0);
      gr.addColorStop(0, 'rgba(244,248,252,0.55)'); gr.addColorStop(1, 'rgba(244,248,252,0)');
      g.fillStyle = gr; g.fillRect(sx ? W - 3.2 * PPM : 0, 0, 3.2 * PPM, H);
    }
    for (let i = 0; i < 1100; i++) {
      const x = rnd() * W, y = rnd() * H, r = 0.6 + rnd() * 1.6;
      g.fillStyle = `rgba(250,252,255,${0.18 + rnd() * 0.3})`; g.beginPath(); g.ellipse(x, y, r * 1.6, r * 0.8, rnd() * 0.6, 0, 7); g.fill();
    }
  }
  texCache.set(ckey, cv);
  if (texCache.size > 2) texCache.delete(texCache.keys().next().value);
  return cv;
}

function drawGround(ctx, c, look, lookIdx) {
  const r = rectOf(c, FIELD.x0, FIELD.y0, FIELD.x1, FIELD.y1);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, r.x - c.s * 0.4, r.y - c.s * 0.1, r.w + c.s * 0.8, r.h + c.s * 0.9, c.s * 1.6); ctx.fill();
  const tex = groundTexture(look, lookIdx);
  rrect(ctx, r.x, r.y, r.w, r.h, c.s * 1.6);
  if (tex) {
    ctx.fillStyle = look.g1; ctx.fill();
    ctx.clip();
    const k = c.s / TEX_PPM;
    ctx.save(); ctx.translate(c.x(FIELD.x0, FIELD.y1), c.y(FIELD.x0, FIELD.y1));
    if (c.land) ctx.rotate(Math.PI / 2);
    ctx.scale(k, k); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(tex, 0, 0); ctx.restore();
    if (look.snow) { ctx.globalAlpha = 0.2; ctx.fillStyle = '#f2f6fb'; for (const sx of [-1, 1]) { const b = rectOf(c, sx > 0 ? FIELD.x1 - 2.6 : FIELD.x0, FIELD.y0, sx > 0 ? FIELD.x1 : FIELD.x0 + 2.6, FIELD.y1); ctx.fillRect(b.x, b.y, b.w, b.h); } ctx.globalAlpha = 1; }
  } else {
    const gg = ctx.createRadialGradient(c.x(0, 0), c.y(0, 0), c.s * 2, c.x(0, 0), c.y(0, 0), c.s * 36);
    gg.addColorStop(0, look.g0); gg.addColorStop(1, look.g1);
    ctx.fillStyle = gg; ctx.fill();
    ctx.clip();
  }
  ctx.globalAlpha = 1;
  // shade along the rope
  ctx.strokeStyle = 'rgba(20,16,6,0.28)'; ctx.lineWidth = c.s * 1.6; rrect(ctx, r.x, r.y, r.w, r.h, c.s * 1.6); ctx.stroke();
  ctx.restore();
}

// limed marks: the lime is laid by hand, so the line is a little uneven, breaks in places and spills dust either side
function chalkRing(ctx, cx, cy, R, w, alpha, seed, dash) {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = `rgba(255,252,240,${alpha})`; ctx.lineWidth = Math.max(1.5, w);
  if (dash) ctx.setLineDash([w * 3.2, w * 2.6]);
  ctx.beginPath(); ctx.arc(cx, cy, R, hash(seed) * TAU, hash(seed) * TAU + TAU); ctx.stroke(); ctx.setLineDash([]);
  // the lime is laid by hand: thin places and specks of earth on the line
  const N = Math.round(R * 1.4 / Math.max(1, w));
  for (let i = 0; i < N; i++) {
    const a = hash(seed + i * 1.7) * TAU, d = (hash(seed + i * 2.9) - 0.5) * w * 0.7;
    ctx.fillStyle = `rgba(120,96,58,${0.18 + 0.25 * hash(seed + i * 4.3)})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R + d), cy + Math.sin(a) * (R + d), Math.max(0.7, w * (0.08 + 0.12 * hash(seed + i))), 0, TAU); ctx.fill();
  }
}
function drawMarkings(ctx, c, look, t) {
  ctx.save();
  // the scoring circle, limed white
  const cx = c.x(CIRCLE.x, CIRCLE.y), cy = c.y(CIRCLE.x, CIRCLE.y), R = CIRCLE.r * c.s;
  const gr = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.12); gr.addColorStop(0, 'rgba(255,252,240,0.07)'); gr.addColorStop(0.85, 'rgba(255,252,240,0.2)'); gr.addColorStop(1, 'rgba(255,252,240,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.fill();
  // lime dust either side of the line
  for (let i = 0; i < 90; i++) {
    const a = hash(i + 11) * TAU, d = R * (0.9 + hash(i + 37) * 0.28);
    ctx.fillStyle = `rgba(255,250,236,${0.10 + hash(i + 59) * 0.16})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(0.8, c.s * (0.04 + hash(i + 5) * 0.07)), 0, TAU); ctx.fill();
  }
  chalkRing(ctx, cx, cy, R, c.s * 0.34, 0.92, 1, false);
  chalkRing(ctx, cx, cy, R * 0.7, c.s * 0.14, 0.5, 77, true);
  // the centre, a dotted ring of lime
  const mx = c.x(CENTRE.x, CENTRE.y), my = c.y(CENTRE.x, CENTRE.y);
  chalkRing(ctx, mx, my, CENTRE.r * c.s, c.s * 0.14, 0.6, 133, true);
  // half way line, very faint
  const a = rectOf(c, FIELD.x0 + 1, -0.1, FIELD.x1 - 1, 0.1);
  ctx.fillStyle = 'rgba(255,252,240,0.1)'; ctx.fillRect(a.x, a.y, Math.max(a.w, 2), Math.max(a.h, 2));
  ctx.restore();
}

function drawRope(ctx, c, look) {
  const r = rectOf(c, FIELD.x0, FIELD.y0, FIELD.x1, FIELD.y1);
  ctx.save();
  rrect(ctx, r.x, r.y, r.w, r.h, c.s * 1.6);
  ctx.lineWidth = Math.max(3, c.s * 0.34); ctx.strokeStyle = look.rope; ctx.stroke();
  ctx.lineWidth = Math.max(1.2, c.s * 0.1); ctx.strokeStyle = 'rgba(80,50,20,0.55)'; ctx.setLineDash([c.s * 0.8, c.s * 0.7]); ctx.stroke(); ctx.setLineDash([]);
  // posts with a little coloured pennant, alternating the two team colours
  const posts = [];
  const nx = 8, ny = 14;
  for (let i = 0; i <= nx; i++) { const t = i / nx; posts.push([r.x + t * r.w, r.y], [r.x + t * r.w, r.y + r.h]); }
  for (let i = 1; i < ny; i++) { const t = i / ny; posts.push([r.x, r.y + t * r.h], [r.x + r.w, r.y + t * r.h]); }
  posts.forEach(([x, y], i) => {
    if (x < -10 || y < -10 || x > c.W + 10 || y > c.H + 10) return;
    ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.arc(x, y, Math.max(2, c.s * 0.3), 0, TAU); ctx.fill();
    ctx.fillStyle = i % 2 ? TEAM[0].band : TEAM[1].band; ctx.beginPath(); ctx.arc(x - c.s * 0.1, y - c.s * 0.1, Math.max(1.4, c.s * 0.16), 0, TAU); ctx.fill();
  });
  ctx.restore();
}

// the post: base, a long shadow, the pole and a pennant that flutters; the gold ring fills as a rider winds round it
function drawFlag(ctx, c, t, windFrac, rounded, guide) {
  const px = c.x(FLAG.x, FLAG.y), py = c.y(FLAG.x, FLAG.y), s = c.s;
  ctx.save(); ctx.translate(px, py);
  if (guide < 2) {
    ctx.strokeStyle = rounded ? 'rgba(127,214,154,0.55)' : `rgba(255,255,255,${0.22 + 0.1 * Math.sin(t * 4)})`; ctx.lineWidth = Math.max(2, s * 0.14);
    ctx.setLineDash([s * 0.7, s * 0.6]); ctx.beginPath(); ctx.arc(0, 0, FLAG_RING * s * 0.55, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (windFrac > 0.01 && !rounded) {
    ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = Math.max(3, s * 0.36); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, FLAG_RING * s * 0.55, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(windFrac, 0, 1)); ctx.stroke();
  }
  // shadow
  ctx.fillStyle = 'rgba(20,10,0,0.32)'; ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(s * 3.6, s * 2.6); ctx.lineTo(s * 3.1, s * 3.0); ctx.lineTo(s * 0.2, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a1c10'; ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, TAU); ctx.fill();
  const gg = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 1, 0, 0, s * 0.7); gg.addColorStop(0, '#f3dcaa'); gg.addColorStop(1, '#8d6a2c');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, TAU); ctx.fill();
  // pole (leans up and away so it reads as tall) and pennant
  const tx = -s * 0.5, ty = -s * 3.4;
  ctx.strokeStyle = '#e9dcc0'; ctx.lineWidth = Math.max(2, s * 0.22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, ty); ctx.stroke();
  const fl = Math.sin(t * 5) * s * 0.18;
  ctx.fillStyle = rounded ? '#3fb36e' : '#e8452c';
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + s * 1.3, ty + fl - s * 0.1, tx + s * 2.4, ty + s * 0.35 + fl); ctx.quadraticCurveTo(tx + s * 1.2, ty + s * 0.55 - fl, tx, ty + s * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + s * 1.3, ty + fl - s * 0.1, tx + s * 2.4, ty + s * 0.35 + fl); ctx.lineTo(tx + s * 1.1, ty + s * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// the sack: a stuffed leather dummy sewn in the shape of a calf, seen from above (barrel, four stiff leg stumps, a stitched neck stump and a
// rope loop); a gold ring pulses round it once it has been taken round the post. Same size and look as the one the 3D rider holds.
function drawSack(ctx, c, sk, t, carried) {
  const px = c.x(sk.x, sk.y), py = c.y(sk.x, sk.y), u = c.s * VIS * 0.82;      // u = one metre of the dummy
  ctx.save(); ctx.translate(px, py);
  if (sk.rounded) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.strokeStyle = `rgba(255,214,90,${0.55 + 0.35 * pulse})`; ctx.lineWidth = Math.max(2.5, u * 0.14);
    ctx.beginPath(); ctx.arc(0, 0, u * (0.78 + 0.08 * pulse), 0, TAU); ctx.stroke();
  }
  const rot = (sk.spin || 0) + (carried ? 0.4 : 0);
  // shadow on the ground
  ctx.fillStyle = 'rgba(20,10,0,0.34)'; ctx.beginPath(); ctx.ellipse(u * 0.12, u * 0.14, u * 0.62, u * 0.4, rot, 0, TAU); ctx.fill();
  ctx.rotate(rot);
  const leather = ctx.createLinearGradient(0, -u * 0.34, 0, u * 0.34); leather.addColorStop(0, '#b78552'); leather.addColorStop(0.55, '#8f6137'); leather.addColorStop(1, '#5e3b1e');
  const dark = '#3a200c';
  // four leg stumps pointing out and a little forward / back
  ctx.lineCap = 'round';
  for (const [x, y, ex, ey] of [[0.26, -0.2, 0.46, -0.44], [0.26, 0.2, 0.46, 0.44], [-0.28, -0.2, -0.5, -0.42], [-0.28, 0.2, -0.5, 0.42]]) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(3, u * 0.17); ctx.beginPath(); ctx.moveTo(x * u, y * u); ctx.lineTo(ex * u, ey * u); ctx.stroke();
    ctx.strokeStyle = '#8a5c34'; ctx.lineWidth = Math.max(2, u * 0.12); ctx.beginPath(); ctx.moveTo(x * u, y * u); ctx.lineTo(ex * u, ey * u); ctx.stroke();
    ctx.fillStyle = '#24160c'; ctx.beginPath(); ctx.arc(ex * u, ey * u, u * 0.07, 0, TAU); ctx.fill();
  }
  // neck stump (forward) with a stitched cap
  ctx.fillStyle = '#7d522d'; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, u * 0.04);
  ctx.beginPath(); ctx.ellipse(0.52 * u, 0, 0.14 * u, 0.15 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(244,222,176,0.9)'; ctx.setLineDash([u * 0.04, u * 0.04]); ctx.beginPath(); ctx.arc(0.52 * u, 0, 0.1 * u, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // barrel: chest and haunch
  ctx.fillStyle = leather; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.4, u * 0.05);
  ctx.beginPath(); ctx.ellipse(0.12 * u, 0, 0.38 * u, 0.31 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-0.2 * u, 0, 0.34 * u, 0.28 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // soft light on the upper left of the belly
  const hl = ctx.createRadialGradient(-0.02 * u, -0.1 * u, 0, -0.02 * u, -0.1 * u, 0.4 * u); hl.addColorStop(0, 'rgba(255,236,200,0.36)'); hl.addColorStop(1, 'rgba(255,236,200,0)');
  ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(0, 0, 0.62 * u, 0.3 * u, 0, 0, TAU); ctx.fill();
  // the stitched seam along the back, with cross stitches
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.2, u * 0.04); ctx.beginPath(); ctx.moveTo(-0.5 * u, 0); ctx.lineTo(0.42 * u, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(244,222,176,0.9)'; ctx.lineWidth = Math.max(1, u * 0.03);
  for (let i = 0; i < 9; i++) { const x = (-0.46 + i * 0.1) * u; ctx.beginPath(); ctx.moveTo(x, -0.05 * u); ctx.lineTo(x + 0.04 * u, 0.05 * u); ctx.stroke(); }
  // a rope loop for the grip
  ctx.strokeStyle = '#eadcc0'; ctx.lineWidth = Math.max(1.4, u * 0.045); ctx.beginPath(); ctx.ellipse(0.28 * u, -0.1 * u, 0.12 * u, 0.07 * u, -0.5, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---- a horse and rider from above. Local frame: +x forward, +y to the rider's right on screen. Units: metres * c.s * VIS. -----------------------
function drawRider(ctx, c, r, o) {
  const k = c.s * VIS, px = c.x(r.x, r.y), py = c.y(r.x, r.y), team = TEAM[r.team], coat = COATS[(r.id * 2 + r.team * 3) % COATS.length];
  const head = c.head(r.th);
  const sw = Math.sin(r.stride * TAU), swb = Math.sin(r.stride * TAU + Math.PI);
  const gaitAmp = Math.min(1, r.v / 9) * 0.3 + 0.03;
  const lean = r.lean, yaw = Math.max(-1, Math.min(1, r.yaw / 2.4)) * (c.land ? -1 : 1);
  // shadow
  ctx.save(); ctx.translate(px + k * 0.22, py + k * 0.3); ctx.rotate(head);
  ctx.fillStyle = 'rgba(20,10,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, k * 0.95, k * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(px, py); ctx.rotate(head);
  // the gallop: the whole horse rises and falls a little twice a stride, the head nods
  const pace = Math.min(1, r.v / 9);
  const bob = 1 + Math.sin(r.stride * TAU * 2) * pace * 0.026; ctx.scale(bob, bob);
  // legs
  const leg = (x, side, ph) => {
    const ox = Math.sin(r.stride * TAU + ph) * gaitAmp;
    ctx.strokeStyle = coat[1]; ctx.lineWidth = k * 0.11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x * k, side * 0.28 * k); ctx.lineTo((x + ox) * k, side * 0.5 * k); ctx.stroke();
    ctx.fillStyle = '#1b100a'; ctx.beginPath(); ctx.ellipse((x + ox) * k, side * 0.52 * k, k * 0.1, k * 0.07, 0, 0, TAU); ctx.fill();
  };
  leg(0.52, -1, 0); leg(0.52, 1, Math.PI); leg(-0.5, -1, Math.PI); leg(-0.5, 1, 0);
  // tail
  ctx.strokeStyle = coat[1] === '#171210' ? '#0d0a08' : '#2a1a0c'; ctx.lineCap = 'round'; ctx.lineWidth = k * 0.15;
  const tw = yaw * 0.28 + Math.sin(r.stride * TAU) * 0.08;
  ctx.beginPath(); ctx.moveTo(-0.78 * k, 0); ctx.quadraticCurveTo(-1.15 * k, tw * k * 0.5, -1.55 * k, tw * k * 1.1); ctx.stroke();
  // neck and head
  const hy = yaw * 0.16 + Math.sin(r.stride * TAU * 2 + 0.8) * pace * 0.05;
  const ng = ctx.createLinearGradient(0, -0.3 * k, 0, 0.3 * k); ng.addColorStop(0, coat[0]); ng.addColorStop(1, coat[1]);
  ctx.fillStyle = ng;
  ctx.beginPath(); ctx.moveTo(0.5 * k, -0.33 * k); ctx.quadraticCurveTo(0.95 * k, -0.24 * k + hy * k * 0.5, 1.22 * k, -0.12 * k + hy * k); ctx.lineTo(1.22 * k, 0.12 * k + hy * k); ctx.quadraticCurveTo(0.95 * k, 0.24 * k + hy * k * 0.5, 0.5 * k, 0.33 * k); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1.36 * k, hy * k * 1.1, 0.3 * k, 0.16 * k, hy * 0.7, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, k * 0.03); ctx.strokeStyle = 'rgba(24,12,6,0.55)'; ctx.stroke();
  ctx.fillStyle = '#1a0e06'; ctx.beginPath(); ctx.ellipse(1.6 * k, hy * k * 1.2, 0.07 * k, 0.09 * k, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = coat[1]; for (const e of [-1, 1]) { ctx.beginPath(); ctx.ellipse(1.18 * k, (e * 0.1 + hy) * k, 0.07 * k, 0.045 * k, e * 0.5, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = k * 0.06; ctx.beginPath(); ctx.moveTo(0.5 * k, 0); ctx.quadraticCurveTo(0.9 * k, hy * k * 0.5, 1.25 * k, hy * k); ctx.stroke();
  // reins in the team colour
  ctx.strokeStyle = team.band; ctx.lineWidth = Math.max(1, k * 0.025);
  for (const e of [-1, 1]) { ctx.beginPath(); ctx.moveTo(1.3 * k, (e * 0.1 + hy) * k); ctx.lineTo(0.38 * k, e * 0.22 * k); ctx.stroke(); }
  // body
  const bg = ctx.createLinearGradient(0, -0.45 * k, 0, 0.45 * k); bg.addColorStop(0, coat[0]); bg.addColorStop(0.6, coat[0]); bg.addColorStop(1, coat[1]);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(-0.02 * k, 0, 0.86 * k, 0.48 * k, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, k * 0.035); ctx.strokeStyle = 'rgba(24,12,6,0.6)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(-0.1 * k, -0.16 * k, 0.5 * k, 0.1 * k, 0, 0, TAU); ctx.fill();
  // saddle blanket with a woven trim
  rrect(ctx, -0.5 * k, -0.45 * k, 1.0 * k, 0.9 * k, 0.14 * k); ctx.fillStyle = team.blanket; ctx.fill();
  ctx.lineWidth = Math.max(1, k * 0.05); ctx.strokeStyle = team.trim; ctx.stroke();
  ctx.fillStyle = team.trim; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo((i * 0.17) * k - 0.04 * k, 0); ctx.lineTo(i * 0.17 * k, -0.09 * k); ctx.lineTo(i * 0.17 * k + 0.04 * k, 0); ctx.lineTo(i * 0.17 * k, 0.09 * k); ctx.closePath(); ctx.fill(); }
  // the rider's legs hang down the horse's flanks to the stirrups
  for (const e of [-1, 1]) {
    ctx.strokeStyle = team.coat2; ctx.lineCap = 'round'; ctx.lineWidth = k * 0.15;
    const sw2 = Math.sin(r.stride * TAU * 2) * pace * 0.03;
    ctx.beginPath(); ctx.moveTo(0.02 * k, e * 0.26 * k); ctx.lineTo((0.1 + sw2) * k, e * 0.52 * k); ctx.stroke();
    ctx.fillStyle = '#1b100a'; ctx.beginPath(); ctx.ellipse((0.16 + sw2) * k, e * 0.55 * k, 0.14 * k, 0.06 * k, 0, 0, TAU); ctx.fill();
  }
  // the rider: long coat, shoulders across the horse, arms forward to the reins or out to the sack, fur cap
  const lx = (o.sackLocal ? Math.sign(o.sackLocal.y) : 0) * lean * 0.3;
  const bx = 0.0 + lean * 0.12 * (o.sackLocal ? 1 : 0), by = lx * k;
  const cg = ctx.createLinearGradient(0, by - 0.4 * k, 0, by + 0.4 * k); cg.addColorStop(0, team.coat); cg.addColorStop(1, team.coat2);
  ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(bx * k, by, 0.32 * k, 0.44 * k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = team.coat2; ctx.lineWidth = Math.max(1, k * 0.04); ctx.beginPath(); ctx.moveTo(bx * k + 0.06 * k, by - 0.3 * k); ctx.lineTo(bx * k + 0.06 * k, by + 0.3 * k); ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineWidth = k * 0.13; ctx.strokeStyle = team.coat;
  const arm = (side) => {
    let tx = 0.5 * k, ty = side * 0.22 * k;
    if (o.sackLocal && Math.sign(o.sackLocal.y || 1) === side) { tx = clampV(o.sackLocal.x * c.s, -0.2 * k, 0.9 * k); ty = clampV(o.sackLocal.y * c.s, -0.95 * k, 0.95 * k); }
    ctx.beginPath(); ctx.moveTo(bx * k + 0.06 * k, by + side * 0.34 * k); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = '#d9a37a'; ctx.beginPath(); ctx.arc(tx, ty, k * 0.07, 0, TAU); ctx.fill();
  };
  arm(-1); arm(1);
  const hx = bx * k + 0.1 * k, hyy = by;
  ctx.fillStyle = '#d9a37a'; ctx.beginPath(); ctx.arc(hx + 0.06 * k, hyy, k * 0.14, 0, TAU); ctx.fill();
  const cap = ctx.createRadialGradient(hx, hyy - k * 0.04, 1, hx, hyy, k * 0.24); cap.addColorStop(0, '#4a3a2c'); cap.addColorStop(1, '#1f150d');
  ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(hx - 0.02 * k, hyy, 0.2 * k, 0.24 * k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = team.band; ctx.lineWidth = Math.max(1.5, k * 0.07); ctx.beginPath(); ctx.arc(hx - 0.02 * k, hyy, 0.17 * k, -0.9, 0.9); ctx.stroke();
  ctx.restore();
  if (o.mine) drawMineRing(ctx, px, py, k, r);
}
// your rider: a gold ring with the stamina on it
function drawMineRing(ctx, px, py, k, r) {
  ctx.save(); ctx.translate(px, py);
  const R = k * 1.05;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(3, k * 0.17); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  const tired = r.st < 0.12;
  ctx.strokeStyle = tired ? '#ff8a5a' : '#ffd45a'; ctx.lineWidth = Math.max(2.5, k * 0.12); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(r.st, 0.02, 1)); ctx.stroke();
  ctx.restore();
}
const clampV = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- real 3D horses and riders (view3d, see web/view3d/riders.js). Presentation only: every field below is read from the sim state. ----------
// main.js puts the atlas renderer on globalThis.__riders3d when WebGL2 and the modules are available; without it (or with ?fig=2d) the
// flat drawing above is used for every rider.
const COAT3 = COATS.map((c) => c[0]);
const MANE3 = ['#2a190d', '#9a968c', '#0e0b09', '#5a2c12', '#f0e4c4'];
const TEAM3 = [
  { kit: '#c58a2e', trim: '#2a64bd', blanket: '#1f4f9a' },
  { kit: '#e6dcc2', trim: '#d4463c', blanket: '#b3302a' },
];
const pres = { t: null, side: new Map() };
function riderStates(c, s, car, info) {
  const dtRaw = pres.t === null ? 0 : info.time - pres.t; pres.t = info.time;
  const dt = clampV(dtRaw, 0, 0.1);
  const out = [];
  for (const r of s.riders) {
    const k = c.s * VIS, px = c.x(r.x, r.y), py = c.y(r.x, r.y), m = 3.4 * k;
    if (px < -m || py < -m || px > c.W + m || py > c.H + m) continue;
    const head = c.head(r.th);
    const toLocal = (wx, wy) => {
      const dx = c.x(wx, wy) - px, dy = c.y(wx, wy) - py;
      return { x: (dx * Math.cos(-head) - dy * Math.sin(-head)) / c.s, y: (dx * Math.sin(-head) + dy * Math.cos(-head)) / c.s };   // metres: x ahead, y to the rider's right
    };
    const carrying = car === r;
    // the working hand is the one on the side the camera sees (the screen's lower half), with a little hysteresis so it never flickers
    let mir = pres.side.get(r.id) || 1;
    const cs = Math.cos(head);
    if (cs > 0.3) mir = 1; else if (cs < -0.3) mir = -1;
    let kind = null, reach = null, tugAt = null;
    const sk = s.sack;
    if (r.scoopT > 0 && !car) {
      const l = toLocal(sk.x, sk.y); kind = 'grab';
      mir = l.y >= 0 ? 1 : -1;                                   // it lies on one side: use that hand
      reach = { x: -l.y, z: l.x };
    } else if (r.tug > 0 && car && car !== r) {
      const l = toLocal(car.x, car.y); kind = 'tug';
      mir = l.y >= 0 ? 1 : -1;
      tugAt = { x: -l.y, z: l.x, y: 1.0 };
    }
    if (pres.side.get(r.id) !== mir) pres.side.set(r.id, mir);
    const yawRate = r.yaw * (c.land ? -1 : 1);                   // + = turning left on the screen
    const pace = Math.min(1, r.v / 9);
    out.push({
      id: r.id, dt, ph: ((r.stride % 1) + 1) % 1, spd: r.v, t: info.time, yaw: Math.PI / 2 - head,
      roll: -clampV(yawRate / 2.4, -1, 1) * 0.16 * pace, mir, lean: r.lean, kind, reach, tugAt,
      carry: carrying, shield: !!r.shield, sprint: !!r.sprint, stun: false, cheer: false,
      look: { ...TEAM3[r.team], horse: COAT3[(r.id * 2 + r.team * 3) % COAT3.length], mane: MANE3[(r.id * 2 + r.team * 3) % COAT3.length] },
      r, px, py, k, head,
    });
  }
  return out;
}

function drawTug(ctx, c, a, b, t) {
  const x = (c.x(a.x, a.y) + c.x(b.x, b.y)) / 2, y = (c.y(a.x, a.y) + c.y(b.x, b.y)) / 2, s = c.s;
  ctx.save(); ctx.translate(x, y);
  const k = 0.5 + 0.5 * Math.sin(t * 30);
  for (let i = 0; i < 7; i++) {
    const an = i * TAU / 7 + t * 2, d = s * (0.7 + 0.5 * ((i * 37) % 7) / 7 + 0.35 * k);
    ctx.fillStyle = `rgba(236,220,184,${0.5 - 0.2 * k})`; ctx.beginPath(); ctx.arc(Math.cos(an) * d, Math.sin(an) * d, s * (0.2 + 0.1 * k), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawDashed(ctx, c, pts, color, width, dash) {
  if (!pts || pts.length < 2) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash);
  poly(ctx, c, pts); ctx.stroke(); ctx.restore();
}

// ---- the whole scene --------------------------------------------------------------------------------------------------------------------------
// info: { run (state s), time, look, guide (0 guided, 1 marks, 2 off), plan (points|null), target ({x,y}|null) , highlight }
const budget = { low: 1.1e6, medium: 2.0e6, high: 3.2e6 };
function drawScene3d(ctx, c, info, F) {
  const s = info.run, t = info.time;
  let dev = 1;
  try { dev = ctx.getTransform().a || 1; } catch { /* keep 1 */ }
  let w = c.W * dev, h = c.H * dev;
  const cap = budget[F.quality] || budget.medium, k = Math.min(1, Math.sqrt(cap / Math.max(1, w * h)));
  w *= k; h *= k;
  F.size(w, h);
  F.setGuide(info.guide);
  F.sync(c, s, info);
  F.render();
  ctx.drawImage(F.canvas, 0, 0, c.W, c.H);
  if (!s) return;
  const car = s.sack.h >= 0 ? s.riders[s.sack.h] : null;
  // guides drawn on the ground (projected): the carry route, the plan, the target and the finger
  const line = (pts, col, wd, dash) => {
    if (!pts || pts.length < 2) return;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash);
    ctx.beginPath(); pts.forEach((p, i) => { const x = c.x(p.x, p.y, 0.05), y = c.y(p.x, p.y, 0.05); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); ctx.restore();
  };
  const u = c.pxm;
  if (info.guide === 0) line([{ x: CENTRE.x, y: CENTRE.y }, { x: FLAG.x + 6, y: FLAG.y - 3 }, { x: FLAG.x, y: FLAG.y + 5.2 }, { x: FLAG.x - 6, y: FLAG.y - 3 }, { x: CIRCLE.x, y: CIRCLE.y }], 'rgba(255,255,255,0.3)', Math.max(2, u * 0.12), [u * 0.7, u * 0.6]);
  if (info.plan) line(info.plan, 'rgba(255,214,90,0.95)', Math.max(3, u * 0.2), [u * 0.6, u * 0.45]);
  const ring = (x, y, R, col, wd, frac) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
    ctx.beginPath(); const n = 40, a0 = -Math.PI / 2, a1 = a0 + TAU * (frac ?? 1);
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const px = c.x(x + Math.cos(a) * R, y + Math.sin(a) * R, 0.06), py = c.y(x + Math.cos(a) * R, y + Math.sin(a) * R, 0.06); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke(); ctx.restore();
  };
  const me = s.riders[0];
  if (me && info.showMine !== false) {
    ring(me.x, me.y, 1.7, 'rgba(0,0,0,0.35)', Math.max(3, u * 0.17));
    ring(me.x, me.y, 1.7, me.st < 0.12 ? '#ff8a5a' : '#ffd45a', Math.max(2.5, u * 0.12), clamp(me.st, 0.02, 1));
  }
  if (info.target) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    ring(info.target.x, info.target.y, 1.5 + 0.35 * pulse, `rgba(255,214,90,${0.7 + 0.3 * pulse})`, Math.max(3, u * 0.18));
  }
  if (info.touch) {
    const x = c.x(info.touch.x, info.touch.y), y = c.y(info.touch.x, info.touch.y);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, u * 0.1); ctx.lineCap = 'round';
    const q = u * 0.8;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(x + dx * q * 0.45, y + dy * q * 0.45); ctx.lineTo(x + dx * q, y + dy * q); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, u * 0.2, 0, TAU); ctx.fill(); ctx.restore();
  }
  void car;
}

export function drawScene(ctx, c, info) {
  const F3 = c && c.is3d ? field3d() : null;
  if (F3) { drawScene3d(ctx, c, info, F3); return; }
  const look = LOOKS[Math.max(0, Math.min(LOOKS.length - 1, info.look | 0))];
  const s = info.run, t = info.time;
  drawOutside(ctx, c, look);
  ctx.save();
  if (s && s.shake > 0) { const a = s.shake * 5; ctx.translate(Math.sin(t * 70) * a, Math.cos(t * 83) * a); }
  drawGround(ctx, c, look, Math.max(0, Math.min(LOOKS.length - 1, info.look | 0)));
  drawMarkings(ctx, c, look, t);
  const car = s && s.sack.h >= 0 ? s.riders[s.sack.h] : null;
  const windFrac = car ? Math.abs(car.wind) / FLAG_WIND : 0;
  drawFlag(ctx, c, t, windFrac, !!(s && s.sack.rounded), info.guide);
  // the guide: a faint line from the centre round the post and home, or the carry as it stands
  if (info.guide === 0 && s) {
    const dest = [{ x: CENTRE.x, y: CENTRE.y }, { x: FLAG.x + 6, y: FLAG.y - 3 }, { x: FLAG.x, y: FLAG.y + 5.2 }, { x: FLAG.x - 6, y: FLAG.y - 3 }, { x: CIRCLE.x, y: CIRCLE.y }];
    drawDashed(ctx, c, dest, 'rgba(255,255,255,0.28)', Math.max(2, c.s * 0.16), [c.s * 0.8, c.s * 0.7]);
  }
  if (info.plan) drawDashed(ctx, c, info.plan, 'rgba(255,214,90,0.95)', Math.max(3, c.s * 0.28), [c.s * 0.7, c.s * 0.5]);
  if (s) {
    // dust
    for (const p of s.parts) {
      const a = Math.max(0, p.life / p.max), r = (p.size + (1 - a) * 0.9) * c.s;
      ctx.fillStyle = `rgba(226,208,170,${0.42 * a})`; ctx.beginPath(); ctx.arc(c.x(p.x, p.y), c.y(p.x, p.y), r, 0, TAU); ctx.fill();
    }
    if (!car && s.resetT <= 0) {
      // the scoop reach ring, only for your own rider close to a loose sack
      drawSack(ctx, c, s.sack, t, false);
    }
    if (s.resetT > 0 && !car) { /* the sack is being brought out */ }
    const order = [...s.riders].sort((a, b) => (c.land ? a.x - b.x : b.y - a.y));
    // the 3D layer renders every visible rider once per frame into its atlas; riders it could not draw fall back to the flat picture
    const f3 = info.no3d ? null : globalThis.__riders3d;
    let st3 = null, use3 = false;
    if (f3 && f3.render && !f3.lost) {
      st3 = riderStates(c, s, car, info);
      const tf = ctx.getTransform ? ctx.getTransform() : null;
      const dev = (tf && tf.a) || 1;
      use3 = st3.length > 0 && f3.render(st3, c.s * VIS * dev);
    }
    const slotOf = new Map();
    if (use3) for (const q of st3) if (q.slot) slotOf.set(q.id, q);
    for (const r of order) {
      const q = slotOf.get(r.id);
      if (q) {
        // ground shadow, then the horse and the man
        ctx.save(); ctx.translate(q.px + q.k * 0.16, q.py + q.k * 0.2); ctx.rotate(q.head);
        ctx.fillStyle = 'rgba(20,10,0,0.24)'; ctx.beginPath(); ctx.ellipse(q.k * 0.12, 0, q.k * 1.2, q.k * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore();
        f3.blit(ctx, q.slot, q.px, q.py, q.k);
        if (r.id === 0 && info.showMine !== false) drawMineRing(ctx, q.px, q.py, q.k, r);
        continue;
      }
      let sackLocal = null;
      if (r.scoopT > 0 || (car === r)) {
        const dx = c.x(s.sack.x, s.sack.y) - c.x(r.x, r.y), dy = c.y(s.sack.x, s.sack.y) - c.y(r.x, r.y), h = c.head(r.th);
        sackLocal = { x: (dx * Math.cos(-h) - dy * Math.sin(-h)) / c.s, y: (dx * Math.sin(-h) + dy * Math.cos(-h)) / c.s };
      }
      drawRider(ctx, c, r, { mine: r.id === 0 && info.showMine !== false, sackLocal });
      if (car === r) drawSack(ctx, c, s.sack, t, true);
    }
    for (const r of s.riders) if (r.tug > 0 && car && r !== car && Math.hypot(r.x - car.x, r.y - car.y) < 4) drawTug(ctx, c, r, car, t);
    if (info.target) {
      const x = c.x(info.target.x, info.target.y), y = c.y(info.target.x, info.target.y), pulse = 0.5 + 0.5 * Math.sin(t * 7);
      ctx.save(); ctx.strokeStyle = `rgba(255,214,90,${0.7 + 0.3 * pulse})`; ctx.lineWidth = Math.max(3, c.s * 0.22);
      ctx.beginPath(); ctx.arc(x, y, c.s * (1.5 + 0.3 * pulse), 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (info.touch) {
      const x = c.x(info.touch.x, info.touch.y), y = c.y(info.touch.x, info.touch.y);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, c.s * 0.14); ctx.lineCap = 'round';
      const q = c.s * 0.9;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(x + dx * q * 0.45, y + dy * q * 0.45); ctx.lineTo(x + dx * q, y + dy * q); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y, c.s * 0.22, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
  drawRope(ctx, c, look);
  if (look.tint) { ctx.fillStyle = look.tint; ctx.fillRect(0, 0, c.W, c.H); }
  if (look.night > 0.5) {
    for (const [fx, fy] of [[-17, 26], [17, 26], [-17, -26], [17, -26], [-17, 0], [17, 0]]) {
      const g = ctx.createRadialGradient(c.x(fx, fy), c.y(fx, fy), 0, c.x(fx, fy), c.y(fx, fy), c.s * 24);
      g.addColorStop(0, 'rgba(255,248,215,0.26)'); g.addColorStop(1, 'rgba(255,248,215,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, c.W, c.H);
    }
  }
}
export { SCOOP_REACH };
