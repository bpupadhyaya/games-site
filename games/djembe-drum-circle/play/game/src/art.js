// Drawing: the dusk backdrop, the lit goblet drum, hit effects and the three note glyphs. Pure canvas, no assets.
// The drum's static part (body, rope, rim, skin) is painted once into an off-screen canvas per size and re-used each frame;
// where there is no OffscreenCanvas (tests) it is simply painted directly. Light comes from the fire at the lower left.
import { STROKE_INFO, ZONE_BASS, ZONE_TONE } from './rhythm.js';
import { DRUM_RY, DRUM_BODY } from './layout.js';

export const FONT = '"Cormorant Garamond", Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const PAL = { cream: '#fbeed2', gold: '#f4c46a', dim: 'rgba(251,238,210,0.62)', ink: '#1a0d14', panel: 'rgba(24,11,20,0.78)', line: 'rgba(244,196,106,0.32)' };

// ---- zones ---------------------------------------------------------------------------------------------------------------------
export function zoneOf(g, x, y) {
  const u = (x - g.cx) / g.rx, v = (y - g.cy) / g.ry;
  const r = Math.hypot(u, v);
  return { r, u, v };
}

// ---- backdrop --------------------------------------------------------------------------------------------------------------------
const STARS = Array.from({ length: 46 }, (_, i) => ({ x: ((i * 7919) % 1000) / 1000, y: ((i * 104729) % 1000) / 1000, s: 1 + (i % 3) * 0.7, p: i * 1.7 }));
const EMBERS = Array.from({ length: 30 }, (_, i) => ({ x: ((i * 6151) % 1000) / 1000, sp: 18 + (i % 7) * 7, ph: ((i * 3571) % 1000) / 1000, sz: 1.3 + (i % 4) * 0.6, sw: 12 + (i % 5) * 5 }));

let bdCache = null;
function paintBackdropStatic(ctx, w, h, hz, land) {
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#120a20'); sky.addColorStop(0.5, '#331432'); sky.addColorStop(0.8, '#7d3629'); sky.addColorStop(1, '#d97a30');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz + 2);
  // low sun glow
  const sun = ctx.createRadialGradient(w * 0.62, hz, 0, w * 0.62, hz, Math.max(w, h) * 0.55);
  sun.addColorStop(0, 'rgba(255,170,70,0.55)'); sun.addColorStop(0.35, 'rgba(235,110,50,0.18)'); sun.addColorStop(1, 'rgba(235,110,50,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, hz + 2);
  // far hills
  ctx.fillStyle = '#2a0f1c';
  ctx.beginPath(); ctx.moveTo(0, hz);
  for (let i = 0; i <= 12; i++) ctx.lineTo((i / 12) * w, hz - 22 - 26 * Math.sin(i * 1.3 + 0.6) - 14 * Math.sin(i * 2.9));
  ctx.lineTo(w, hz); ctx.closePath(); ctx.fill();
  // baobab silhouettes
  baobab(ctx, w * (land ? 0.1 : 0.14), hz + 6, Math.min(h * 0.2, 250) * (land ? 1.05 : 1), 1);
  if (w > h) baobab(ctx, w * 0.9, hz + 6, Math.min(h * 0.16, 200), -1);
  // ground
  const gr = ctx.createLinearGradient(0, hz, 0, h);
  gr.addColorStop(0, '#2b130e'); gr.addColorStop(0.35, '#1a0a09'); gr.addColorStop(1, '#0b0507');
  ctx.fillStyle = gr; ctx.fillRect(0, hz, w, h - hz);
  ctx.fillStyle = 'rgba(255,150,60,0.08)'; ctx.fillRect(0, hz, w, 3);
  const v = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,1,8,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

export function drawBackdrop(ctx, w, h, t, o = {}) {
  const hz = o.horizon ?? h * 0.58, calm = !!o.calm;
  // The still part (sky, sun, hills, trees, ground, vignette) is painted once per size into an off-screen canvas.
  const m = ctx.getTransform?.(), scale = Math.max(0.5, (m && m.a) || 1), key = `${w}|${h}|${Math.round(hz)}|${scale.toFixed(2)}|${!!o.land}`;
  let used = false;
  if (typeof OffscreenCanvas !== 'undefined' && w * scale < 4096 && h * scale < 4096) {
    if (!bdCache || bdCache.key !== key) {
      const off = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), c = off.getContext('2d');
      c.scale(scale, scale); paintBackdropStatic(c, w, h, hz, o.land); bdCache = { key, off };
    }
    ctx.drawImage(bdCache.off, 0, 0, w, h); used = true;
  }
  if (!used) paintBackdropStatic(ctx, w, h, hz, o.land);
  for (const s of STARS) {
    const a = 0.25 + 0.45 * (calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.3 + s.p)), y = s.y * hz * 0.72;
    ctx.fillStyle = `rgba(255,236,200,${a * (1 - y / hz)})`; ctx.beginPath(); ctx.arc(s.x * w, y, s.s, 0, 7); ctx.fill();
  }
  // firelight pool (under the drum), with a slow flicker
  if (o.pool) {
    const p = o.pool, fl = calm ? 1 : 1 + 0.08 * Math.sin(t * 6.3) + 0.05 * Math.sin(t * 11.7), pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    pg.addColorStop(0, `rgba(255,160,70,${0.42 * fl})`); pg.addColorStop(0.5, `rgba(220,100,40,${0.14 * fl})`); pg.addColorStop(1, 'rgba(220,100,40,0)');
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.45); ctx.translate(-p.x, -p.y); ctx.fillStyle = pg; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); ctx.restore();
  }
  // embers
  if (!calm) for (const e of EMBERS) {
    const k = (e.ph + t * e.sp / (h * 0.9)) % 1, y = h * (1 - k * 0.85), x = e.x * w + Math.sin(t * 0.8 + e.ph * 9) * e.sw;
    ctx.fillStyle = `rgba(255,${150 + (e.ph * 80) | 0},70,${0.55 * Math.sin(k * Math.PI)})`; ctx.beginPath(); ctx.arc(x, y, e.sz, 0, 7); ctx.fill();
  }
}
function baobab(ctx, x, y, hgt, dir) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.fillStyle = '#0c0510'; ctx.strokeStyle = '#0c0510'; ctx.lineCap = 'round';
  const tw = hgt * 0.17;
  ctx.beginPath(); ctx.moveTo(-tw * 1.15, 0); ctx.bezierCurveTo(-tw * 0.9, -hgt * 0.25, -tw * 0.55, -hgt * 0.45, -tw * 0.5, -hgt * 0.62);
  ctx.lineTo(tw * 0.5, -hgt * 0.62); ctx.bezierCurveTo(tw * 0.55, -hgt * 0.45, tw * 0.9, -hgt * 0.25, tw * 1.15, 0); ctx.closePath(); ctx.fill();
  const limbs = [[-0.2, -0.62, -0.62, -0.86, 11], [0, -0.62, 0.05, -0.97, 12], [0.2, -0.62, 0.7, -0.84, 11], [-0.1, -0.7, -0.34, -0.98, 7], [0.1, -0.7, 0.4, -0.98, 7]];
  for (const [x0, y0, x1, y1, lw] of limbs) { ctx.lineWidth = lw * hgt / 250; ctx.beginPath(); ctx.moveTo(x0 * hgt * 0.4, y0 * hgt); ctx.lineTo(x1 * hgt * 0.5, y1 * hgt); ctx.stroke(); }
  for (const [cx, cy, r] of [[-0.62, -0.88, 0.1], [0.05, -1, 0.12], [0.7, -0.86, 0.1], [-0.34, -1, 0.08], [0.4, -1, 0.08], [-0.3, -0.9, 0.09], [0.3, -0.92, 0.09]]) {
    ctx.beginPath(); ctx.ellipse(cx * hgt * 0.5, cy * hgt, r * hgt * 1.15, r * hgt * 0.62, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---- the drum ----------------------------------------------------------------------------------------------------------------------
const bodyW = (t) => (t < 0.58 ? 0.3 + 0.68 * Math.pow(1 - t / 0.58, 2.3) : 0.3 + 0.3 * Math.pow((t - 0.58) / 0.42, 1.7));   // half width as a share of rx
const SKIN = ['#f3e3bd', '#dcc08c', '#a98650'];

// Paints the static drum into ctx with the centre of the skin at (0, 0).
function paintStatic(c, rx, ry) {
  const Hb = DRUM_BODY * rx;
  const at = (t, th, k = 1) => ({ x: Math.cos(th) * bodyW(t) * rx * k, y: t * Hb + Math.sin(th) * bodyW(t) * ry * k });
  // floor shadow
  c.save(); c.translate(0, Hb + 6); c.scale(1, 0.34);
  const sh = c.createRadialGradient(0, 0, 0, 0, 0, rx * 0.95); sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh; c.beginPath(); c.arc(0, 0, rx * 0.95, 0, 7); c.fill(); c.restore();
  // body outline
  const N = 44, edge = [];
  for (let i = 0; i <= N; i++) edge.push(at(i / N, Math.PI));
  const redge = []; for (let i = N; i >= 0; i--) redge.push(at(i / N, 0));
  const bottom = []; for (let i = 0; i <= 18; i++) bottom.push(at(1, Math.PI - (i / 18) * Math.PI));
  const body = new Path2DLike(c);
  body.begin(); edge.forEach((p, i) => (i ? body.line(p) : body.move(p))); bottom.forEach((p) => body.line(p)); redge.forEach((p) => body.line(p)); body.close();
  const wood = c.createLinearGradient(-rx, 0, rx, 0);
  wood.addColorStop(0, '#1e0e08'); wood.addColorStop(0.16, '#552a13'); wood.addColorStop(0.38, '#a8622b'); wood.addColorStop(0.55, '#8a4d22'); wood.addColorStop(0.82, '#4a2410'); wood.addColorStop(1, '#170a06');
  c.fillStyle = wood; body.fill();
  c.save(); body.clip();
  // grain
  for (let k = -7; k <= 7; k++) {
    c.beginPath();
    for (let i = 0; i <= N; i++) { const t = i / N, x = (k / 8) * bodyW(t) * rx + Math.sin(t * 9 + k) * rx * 0.012, y = t * Hb + (0.5 + 0.5 * Math.sin(k)) * 0; i ? c.lineTo(x, y + ry * 0.2) : c.moveTo(x, y + ry * 0.2); }
    c.strokeStyle = k % 2 ? 'rgba(255,200,130,0.07)' : 'rgba(20,6,2,0.14)'; c.lineWidth = rx * 0.012; c.stroke();
  }
  // soft specular streak where the firelight catches the wood
  const sp = c.createLinearGradient(-rx * 0.62, 0, -rx * 0.02, 0);
  sp.addColorStop(0, 'rgba(255,225,170,0)'); sp.addColorStop(0.55, 'rgba(255,225,170,0.2)'); sp.addColorStop(1, 'rgba(255,225,170,0)');
  c.fillStyle = sp; c.fillRect(-rx, 0, rx * 2, Hb + ry);
  // shade toward the foot and under the rim
  const vs = c.createLinearGradient(0, 0, 0, Hb);
  vs.addColorStop(0, 'rgba(10,3,2,0.55)'); vs.addColorStop(0.12, 'rgba(10,3,2,0)'); vs.addColorStop(0.62, 'rgba(10,3,2,0.1)'); vs.addColorStop(1, 'rgba(10,3,2,0.5)');
  c.fillStyle = vs; c.fillRect(-rx, 0, rx * 2, Hb + ry);
  // carved zigzag band (a geometric pattern, hand-cut look)
  const ta = 0.66, tb = 0.85, n = 14;
  for (const t of [ta, tb]) { c.beginPath(); for (let i = 0; i <= 30; i++) { const p = at(t, Math.PI - (i / 30) * Math.PI); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.strokeStyle = 'rgba(25,9,4,0.8)'; c.lineWidth = rx * 0.022; c.stroke(); c.strokeStyle = 'rgba(255,205,140,0.35)'; c.lineWidth = rx * 0.008; c.translate(0, rx * 0.014); c.stroke(); c.translate(0, -rx * 0.014); }
  for (let i = 0; i < n; i++) {
    const t0 = Math.PI - (i / n) * Math.PI, t1 = Math.PI - ((i + 1) / n) * Math.PI, tm = (t0 + t1) / 2, up = i % 2 === 0;
    const a = at(up ? ta : tb, t0), b = at(up ? ta : tb, t1), p = at(up ? tb : ta, tm);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(p.x, p.y); c.closePath();
    c.fillStyle = `rgba(30,11,5,${0.35 + 0.5 * Math.sin(tm)})`; c.fill();
    c.strokeStyle = 'rgba(255,205,140,0.22)'; c.lineWidth = rx * 0.006; c.stroke();
  }
  // warm bounce from the fire-lit ground
  const bn = c.createLinearGradient(0, Hb * 0.7, 0, Hb + ry * 0.4); bn.addColorStop(0, 'rgba(255,150,60,0)'); bn.addColorStop(1, 'rgba(255,150,60,0.2)');
  c.fillStyle = bn; c.fillRect(-rx, Hb * 0.7, rx * 2, Hb);
  // rim light on the right edge (teal moon-like cool light) and warm key on the left
  const rl = c.createLinearGradient(rx * 0.55, 0, rx, 0); rl.addColorStop(0, 'rgba(80,200,200,0)'); rl.addColorStop(1, 'rgba(110,220,220,0.22)');
  c.fillStyle = rl; c.fillRect(0, 0, rx, Hb + ry);
  c.restore();
  c.strokeStyle = 'rgba(8,2,2,0.7)'; c.lineWidth = rx * 0.012; body.stroke();

  // rope lacing: three rings and a zigzag of strands between the top two
  const ropeRing = (t, wdt) => {
    c.beginPath(); for (let i = 0; i <= 40; i++) { const p = at(t, Math.PI - (i / 40) * Math.PI, 1.02); i ? c.lineTo(p.x, p.y + wdt * 0.9) : c.moveTo(p.x, p.y + wdt * 0.9); } c.lineCap = 'round'; c.strokeStyle = 'rgba(8,2,0,0.4)'; c.lineWidth = wdt * 1.25; c.stroke();
    c.beginPath(); for (let i = 0; i <= 40; i++) { const p = at(t, Math.PI - (i / 40) * Math.PI, 1.015); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
    c.lineCap = 'round'; c.strokeStyle = '#2b1609'; c.lineWidth = wdt + rx * 0.014; c.stroke();
    c.strokeStyle = '#d8b67e'; c.lineWidth = wdt; c.stroke();
    c.strokeStyle = 'rgba(255,240,200,0.55)'; c.lineWidth = wdt * 0.28; c.translate(0, -wdt * 0.2); c.stroke(); c.translate(0, wdt * 0.2);
  };
  const strand = (a, b) => {
    c.beginPath(); c.moveTo(a.x + rx * 0.012, a.y + rx * 0.016); c.lineTo(b.x + rx * 0.012, b.y + rx * 0.016); c.lineCap = 'round'; c.strokeStyle = 'rgba(8,2,0,0.38)'; c.lineWidth = rx * 0.046; c.stroke();
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    c.strokeStyle = '#2b1609'; c.lineWidth = rx * 0.036; c.stroke(); c.strokeStyle = '#cfa96f'; c.lineWidth = rx * 0.024; c.stroke();
    c.strokeStyle = 'rgba(255,238,200,0.5)'; c.lineWidth = rx * 0.008; c.translate(-rx * 0.004, -rx * 0.006); c.stroke(); c.translate(rx * 0.004, rx * 0.006);
  };
  const t1 = 0.045, t2 = 0.36, t3 = 0.5, M = 15;
  for (let i = 0; i < M; i++) {                                // zigzag between ring 1 and ring 2
    const a0 = Math.PI - (i / M) * Math.PI, a1 = Math.PI - ((i + 0.5) / M) * Math.PI, a2 = Math.PI - ((i + 1) / M) * Math.PI;
    strand(at(t1, a0, 1.01), at(t2, a1, 1.01)); strand(at(t2, a1, 1.01), at(t1, a2, 1.01));
  }
  ropeRing(t1, rx * 0.04); ropeRing(t2, rx * 0.04);
  for (let i = 0; i <= M; i++) { const a = Math.PI - (i / M) * Math.PI; strand(at(t2, a, 1.01), at(t3, a, 1.01)); }
  ropeRing(t3, rx * 0.04);

  // hoop and skin
  const hoop = (k, col, lw) => { c.beginPath(); c.ellipse(0, 0, rx * k, ry * k, 0, 0, 7); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); };
  hoop(1.0, '#1d0d06', rx * 0.1); hoop(1.0, '#6b4224', rx * 0.075);
  c.save(); c.lineCap = 'round';
  c.beginPath(); c.ellipse(0, 0, rx * 1.004, ry * 1.004, 0, Math.PI * 0.85, Math.PI * 1.75); c.strokeStyle = 'rgba(255,224,170,0.55)'; c.lineWidth = rx * 0.022; c.stroke();
  c.beginPath(); c.ellipse(0, 0, rx * 0.99, ry * 0.99, 0, -0.1, Math.PI * 0.55); c.strokeStyle = 'rgba(20,6,2,0.55)'; c.lineWidth = rx * 0.03; c.stroke();
  c.beginPath(); c.ellipse(0, 0, rx * 1.006, ry * 1.006, 0, -0.5, 0.25); c.strokeStyle = 'rgba(120,225,225,0.32)'; c.lineWidth = rx * 0.014; c.stroke();
  c.restore();
  c.save(); c.beginPath(); c.ellipse(0, 0, rx * 0.965, ry * 0.965, 0, 0, 7); c.clip();
  const sk = c.createRadialGradient(-rx * 0.22, -ry * 0.3, rx * 0.04, 0, 0, rx);
  sk.addColorStop(0, SKIN[0]); sk.addColorStop(0.65, SKIN[1]); sk.addColorStop(1, SKIN[2]);
  c.fillStyle = sk; c.fillRect(-rx, -ry, rx * 2, ry * 2);
  // mottling and the worn middle
  for (let i = 0; i < 14; i++) { const a = i * 2.399, d = (0.25 + ((i * 37) % 60) / 100) * rx * 0.8, px = Math.cos(a) * d, py = Math.sin(a) * d * DRUM_RY; const g = c.createRadialGradient(px, py, 0, px, py, rx * 0.16); g.addColorStop(0, `rgba(120,80,40,${0.025 + (i % 3) * 0.012})`); g.addColorStop(1, 'rgba(120,80,40,0)'); c.fillStyle = g; c.fillRect(px - rx * 0.2, py - rx * 0.2, rx * 0.4, rx * 0.4); }
  const wear = c.createRadialGradient(0, 0, 0, 0, 0, rx * ZONE_BASS); wear.addColorStop(0, 'rgba(110,72,36,0.2)'); wear.addColorStop(1, 'rgba(110,72,36,0)');
  c.save(); c.scale(1, DRUM_RY); c.fillStyle = wear; c.beginPath(); c.arc(0, 0, rx * ZONE_BASS, 0, 7); c.fill(); c.restore();
  // fibres, a soft sheen from the fire, and the shade where the skin curls over the hoop
  for (let i = 0; i < 110; i++) { const an = i * 2.399, r0 = rx * (0.08 + ((i * 37) % 80) / 100), r1 = r0 + rx * 0.1; c.beginPath(); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0 * DRUM_RY); c.lineTo(Math.cos(an + 0.07) * r1, Math.sin(an + 0.07) * r1 * DRUM_RY); c.strokeStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(120,80,40,0.07)'; c.lineWidth = rx * 0.004; c.stroke(); }
  c.save(); c.scale(1, DRUM_RY);
  const shn = c.createRadialGradient(-rx * 0.34, -rx * 0.42, 0, -rx * 0.34, -rx * 0.42, rx * 0.75); shn.addColorStop(0, 'rgba(255,255,255,0.3)'); shn.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = shn; c.fillRect(-rx, -rx, rx * 2, rx * 2);
  const es = c.createRadialGradient(0, 0, rx * 0.72, 0, 0, rx * 0.97); es.addColorStop(0, 'rgba(70,40,15,0)'); es.addColorStop(1, 'rgba(70,40,15,0.38)');
  c.fillStyle = es; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
  // the hoop throws a soft shadow onto the skin from the upper left, and the skin has a long anisotropic highlight
  c.save(); c.beginPath(); c.ellipse(0, 0, rx * 0.965, ry * 0.965, 0, 0, 7); c.clip();
  c.beginPath(); c.ellipse(rx * 0.03, ry * 0.05, rx * 0.985, ry * 0.985, 0, Math.PI * 0.9, Math.PI * 1.7); c.strokeStyle = 'rgba(40,18,6,0.34)'; c.lineWidth = rx * 0.07; c.stroke();
  c.beginPath(); c.ellipse(-rx * 0.04, -ry * 0.04, rx * 0.8, ry * 0.8, 0, Math.PI * 1.05, Math.PI * 1.55); c.strokeStyle = 'rgba(255,255,245,0.34)'; c.lineWidth = rx * 0.05; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.ellipse(-rx * 0.04, -ry * 0.04, rx * 0.8, ry * 0.8, 0, Math.PI * 1.1, Math.PI * 1.45); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = rx * 0.016; c.stroke();
  c.restore();
  // skin fold where it wraps the hoop
  c.beginPath(); c.ellipse(0, 0, rx * 0.94, ry * 0.94, 0, 0, 7); c.strokeStyle = 'rgba(90,58,28,0.5)'; c.lineWidth = rx * 0.05; c.stroke();
  c.restore();
}

// A tiny Path2D stand-in that works on a plain 2D context (and on the test's null context).
class Path2DLike {
  constructor(c) { this.c = c; }
  begin() { this.c.beginPath(); }
  move(p) { this.c.moveTo(p.x, p.y); }
  line(p) { this.c.lineTo(p.x, p.y); }
  close() { this.c.closePath(); }
  fill() { this.c.fill(); }
  stroke() { this.c.stroke(); }
  clip() { this.c.clip(); }
}

let cached = null;
function staticLayer(rx, ry, scale) {
  const key = `${Math.round(rx)}|${scale.toFixed(2)}`;
  if (cached && cached.key === key) return cached;
  if (typeof OffscreenCanvas === 'undefined') return null;
  const padX = rx * 0.14, top = ry * 1.2, bot = DRUM_BODY * rx + ry * 1.0;
  const W = Math.ceil((rx * 2 + padX * 2) * scale), H = Math.ceil((top + bot) * scale);
  if (W > 4096 || H > 4096 || W < 4 || H < 4) return null;
  const off = new OffscreenCanvas(W, H), c = off.getContext('2d');
  c.scale(scale, scale); c.translate(rx + padX, top);
  paintStatic(c, rx, ry);
  cached = { key, off, ox: -(rx + padX), oy: -top, w: W / scale, h: H / scale };
  return cached;
}

// fx: { ripples: [{x,y,age,stroke}], glow: {B,T,S}, guide: {stroke, pulse} | null, labels: bool, shake: {x,y} }
export function drawDrum(ctx, g, fx = {}) {
  const { cx, cy, rx, ry } = g;
  ctx.save();
  if (g.clip) { ctx.beginPath(); ctx.rect(g.clip.x, g.clip.y - 6, g.clip.w, g.clip.h + 6); ctx.clip(); }
  const sx = fx.shake ? fx.shake.x : 0, sy = fx.shake ? fx.shake.y : 0;
  ctx.translate(cx + sx, cy + sy);
  const m = ctx.getTransform?.(), scale = Math.max(0.5, (m && m.a) || 1) / 1;
  const layer = staticLayer(rx, ry, scale);
  if (layer) ctx.drawImage(layer.off, layer.ox, layer.oy, layer.w, layer.h);
  else paintStatic(ctx, rx, ry);

  // dynamic skin layer: zone hints, glows, guide, ripples
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.965, ry * 0.965, 0, 0, 7); ctx.clip();
  const ring = (k0, k1, fill) => { ctx.beginPath(); ctx.ellipse(0, 0, rx * k1, ry * k1, 0, 0, 7); if (k0 > 0) ctx.ellipse(0, 0, rx * k0, ry * k0, 0, 0, 7, true); ctx.fillStyle = fill; ctx.fill('evenodd'); };
  const zones = { B: [0, ZONE_BASS], T: [ZONE_BASS, ZONE_TONE], S: [ZONE_TONE, 1.2] };
  for (const s of ['B', 'T', 'S']) {
    const gl = fx.glow?.[s] ?? 0;
    if (gl > 0.02) ring(zones[s][0], zones[s][1], rgba(STROKE_INFO[s].color, 0.2 * gl * gl + 0.04 * gl));
  }
  if (fx.guide) { const s = fx.guide.stroke, a = 0.2 + 0.2 * (fx.guide.pulse ?? 0.5); ring(zones[s][0], zones[s][1], rgba(STROKE_INFO[s].color, a)); }
  if (!fx.calm) { const fl = 0.07 + 0.04 * Math.sin((fx.t ?? 0) * 7.1) + 0.03 * Math.sin((fx.t ?? 0) * 13.3), gg = ctx.createRadialGradient(-rx * 0.5, ry * 0.35, 0, -rx * 0.5, ry * 0.35, rx * 0.9); gg.addColorStop(0, `rgba(255,170,80,${fl})`); gg.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = gg; ctx.fillRect(-rx, -ry, rx * 2, ry * 2); }
  for (const k of [ZONE_BASS, ZONE_TONE]) { ctx.beginPath(); ctx.ellipse(0, 0, rx * k, ry * k, 0, 0, 7); ctx.setLineDash([rx * 0.04, rx * 0.035]); ctx.strokeStyle = fx.labels ? 'rgba(60,35,15,0.55)' : 'rgba(60,35,15,0.22)'; ctx.lineWidth = rx * 0.008; ctx.stroke(); ctx.setLineDash([]); }
  for (const r of fx.ripples ?? []) {
    const px = r.x - cx, py = r.y - cy, a = 1 - r.age / 0.7;
    if (a <= 0) continue;
    const dent = ctx.createRadialGradient(px, py, 0, px, py, rx * 0.26); dent.addColorStop(0, `rgba(70,40,15,${0.34 * Math.max(0, 1 - r.age / 0.28)})`); dent.addColorStop(1, 'rgba(70,40,15,0)');
    ctx.fillStyle = dent; ctx.fillRect(px - rx * 0.3, py - rx * 0.3, rx * 0.6, rx * 0.6);
    for (let k = 0; k < 2; k++) {
      const rr = (r.age * 0.9 + k * 0.1) * rx * 0.75 + rx * 0.04;
      ctx.beginPath(); ctx.ellipse(px, py, rr, rr * DRUM_RY, 0, 0, 7);
      ctx.strokeStyle = rgba(STROKE_INFO[r.stroke].color, 0.65 * a * (k ? 0.5 : 1)); ctx.lineWidth = rx * (k ? 0.012 : 0.02) * (0.4 + a); ctx.stroke();
    }
  }
  if (fx.labels) {
    ctx.font = `800 ${Math.round(rx * 0.075)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [s, k] of [['B', 0], ['T', (ZONE_BASS + ZONE_TONE) / 2], ['S', (ZONE_TONE + 0.97) / 2]]) {
      const label = STROKE_INFO[s].name.toUpperCase();
      for (const sgn of s === 'B' ? [0] : [-1, 1]) { const px = s === 'B' ? 0 : sgn * rx * k * 0.98, py = s === 'B' ? 0 : 0; ctx.fillStyle = 'rgba(40,22,10,0.78)'; ctx.fillText(label, px, py + (s === 'B' ? 0 : ry * 0.02), s === 'B' ? rx * 0.8 : rx * 0.36); }
    }
  }
  ctx.restore();
  ctx.restore();
}

export function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

// ---- note glyphs ---------------------------------------------------------------------------------------------------------------
// kind: 'target' (solid) | 'ghost' (outline, the lead drummer's phrase) | 'done' (faded after judging)
export function drawNote(ctx, stroke, x, y, r, { soft = false, kind = 'target', alpha = 1, glow = 0 } = {}) {
  const info = STROKE_INFO[stroke], rr = soft ? r * 0.74 : r;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  if (glow > 0) { const g = ctx.createRadialGradient(0, 0, rr * 0.5, 0, 0, rr * 2.4); g.addColorStop(0, rgba(info.color, 0.55 * glow)); g.addColorStop(1, rgba(info.color, 0)); ctx.fillStyle = g; ctx.fillRect(-rr * 2.4, -rr * 2.4, rr * 4.8, rr * 4.8); }
  const shape = () => {
    ctx.beginPath();
    if (stroke === 'S') { ctx.moveTo(0, -rr * 1.12); ctx.lineTo(rr * 1.12, 0); ctx.lineTo(0, rr * 1.12); ctx.lineTo(-rr * 1.12, 0); ctx.closePath(); }
    else ctx.arc(0, 0, rr, 0, 7);
  };
  if (kind === 'ghost') {
    shape(); ctx.setLineDash([rr * 0.35, rr * 0.28]); ctx.strokeStyle = rgba(info.color, 0.8); ctx.lineWidth = Math.max(2, rr * 0.14); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = rgba(info.color, 0.14); shape(); ctx.fill();
  } else if (stroke === 'T') {
    shape(); ctx.fillStyle = '#10201f'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.8, 0, 7); ctx.strokeStyle = info.color; ctx.lineWidth = rr * 0.42; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.95, Math.PI * 1.05, Math.PI * 1.6); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = rr * 0.1; ctx.stroke();
  } else {
    shape();
    const g = ctx.createRadialGradient(-rr * 0.3, -rr * 0.35, rr * 0.1, 0, 0, rr * 1.2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, info.color); g.addColorStop(1, info.dark);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(20,8,4,0.7)'; ctx.lineWidth = rr * 0.09; ctx.stroke();
  }
  ctx.restore();
}

// ---- the drummer's hand --------------------------------------------------------------------------------------------------------------
// A stylised hand seen from above lands on the skin where a program-played stroke falls, with the shape of the stroke:
// bass = flat palm on the middle, tone = fingers together, slap = loose fingers whipped onto the edge.
export function drawHand(ctx, g, h) {
  const life = 0.4;
  if (h.age >= life) return;
  const s = g.rx / 330 * 1.3, land = Math.min(1, h.age / 0.1), fade = h.age < 0.14 ? 1 : Math.max(0, 1 - (h.age - 0.14) / (life - 0.14));
  const hover = 1 - land, ang = (h.ang ?? -0.12);
  ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
  const bass = h.stroke === 'B', slap = h.stroke === 'S';
  const palm = bass ? { x: 0, y: 0 } : { x: 0, y: (slap ? 112 : 104) * s };
  const spread = bass ? 1 : slap ? 1.45 : 0.62, curl = slap ? 0.12 : 0;
  const lens = [58, 70, 66, 50].map((v) => v * s);
  const draw = (dx, dy, tone, a) => {
    ctx.save(); ctx.translate(dx - hover * 10 * s, dy - hover * 26 * s); ctx.scale(1 + hover * 0.16, 1 + hover * 0.16); ctx.globalAlpha = a * fade;
    const pg = ctx.createRadialGradient(palm.x - 18 * s, palm.y - 20 * s, 4 * s, palm.x, palm.y, 70 * s);
    const col = tone === 0 ? ['#d99a68', '#b87444', '#7c4a28'] : ['#000', '#000', '#000'];
    pg.addColorStop(0, col[0]); pg.addColorStop(0.6, col[1]); pg.addColorStop(1, col[2]);
    ctx.fillStyle = tone === 0 ? pg : 'rgba(10,3,0,0.55)';
    ctx.beginPath(); ctx.ellipse(palm.x, palm.y, 54 * s, 46 * s, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const fx = (i - 1.5) * 25 * s * spread, a2 = (i - 1.5) * 0.15 * (spread - 0.55) - curl * (i - 1.5) * 0.3, len = lens[i], w = 21 * s;
      ctx.save(); ctx.translate(palm.x + fx * 0.8, palm.y - 34 * s); ctx.rotate(a2);
      const fg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); fg.addColorStop(0, '#c58654'); fg.addColorStop(0.45, '#dba070'); fg.addColorStop(1, '#8a5430');
      ctx.fillStyle = tone === 0 ? fg : 'rgba(10,3,0,0.55)';
      ctx.beginPath(); ctx.roundRect(-w / 2, -len, w, len + 8 * s, w / 2); ctx.fill();
      if (tone === 0) { ctx.strokeStyle = 'rgba(50,22,8,0.45)'; ctx.lineWidth = 1.5 * s; ctx.stroke(); ctx.fillStyle = 'rgba(255,230,190,0.28)'; ctx.beginPath(); ctx.ellipse(-w * 0.18, -len + w * 0.55, w * 0.16, w * 0.3, 0, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.save(); ctx.translate(palm.x - 50 * s, palm.y - 2 * s); ctx.rotate(-0.7);
    ctx.fillStyle = tone === 0 ? '#c58654' : 'rgba(10,3,0,0.55)'; ctx.beginPath(); ctx.roundRect(-11 * s, -52 * s, 22 * s, 62 * s, 11 * s); ctx.fill();
    if (tone === 0) { ctx.strokeStyle = 'rgba(50,22,8,0.45)'; ctx.lineWidth = 1.5 * s; ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  };
  draw(14 * s * (0.4 + hover), 20 * s * (0.4 + hover), 1, 0.7 * (0.35 + 0.65 * land));         // contact shadow, closer as the hand lands
  draw(0, 0, 0, 0.96);
  ctx.restore();
}
