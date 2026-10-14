// Kho-Kho art. A floodlit evening match seen from above: a packed red-clay court with white lines, the central lane with its
// eight seats, two wooden poles, dark stands with a hint of crowd and light pools in the corners. The court is painted ONCE into a
// cached layer; players are drawn live (lit shapes, a stride cycle, a number on the back).
// Every function draws in canonical court units (engine COURT: 640 x 1000).
import { COURT, SEAT_Y, POLE_Y } from './engine.js';

const TAU = Math.PI * 2;
export const CW = 640, CH = 1000;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export const CHASER = { shirt: ['#46e6d4', '#0a8b86'], trim: '#ffffff', name: 'Chasers' };
export const RUNNER = { shirt: ['#ffa05c', '#d4421a'], trim: '#fff0c4', name: 'Runners' };
const SKINS = ['#d99a6c', '#c58a5c', '#a96f45', '#e3ad80', '#8d5a36', '#f0be92'];
export const skinFor = (i) => SKINS[((i % SKINS.length) + SKINS.length) % SKINS.length];

const mk = (w, h, scale, fn) => {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), g = c.getContext('2d'); g.scale(scale, scale); fn(g); return c;
  } catch { return null; }
};
const cache = new Map();
function layer(key, w, h, scale, paint) {
  let e = cache.get(key);
  if (!e) { e = { c: mk(w, h, scale, paint), w, h, paint }; cache.set(key, e); }
  return (ctx, x, y, s = 1) => {
    if (e.c) ctx.drawImage(e.c, x, y, e.w * s, e.h * s);
    else { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); e.paint(ctx); ctx.restore(); }
  };
}

// ---------------------------------------------------------------- backdrop: night stadium, tiled across the whole screen
function paintTile(g) {
  const r = lcg(5);
  g.fillStyle = '#0c1030'; g.fillRect(0, 0, 160, 160);
  g.strokeStyle = 'rgba(140,160,255,0.06)'; g.lineWidth = 2;
  for (let i = -160; i < 320; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 160, 160); g.stroke(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,${200 + (r() * 55) | 0},${120 + (r() * 100) | 0},${0.04 + r() * 0.1})`; g.beginPath(); g.arc(r() * 160, r() * 160, 0.8 + r() * 1.6, 0, TAU); g.fill(); }
}
const tile = layer('tile', 160, 160, 1, paintTile);
let tilePattern = null, tileCtx = null;
export function drawBackdrop(ctx, W_, H_, tint = 0) {
  if (tileCtx !== ctx) {
    tilePattern = null; tileCtx = ctx; tile(ctx, -9999, -9999, 1);
    const e = cache.get('tile');
    if (e && e.c && ctx.createPattern) tilePattern = ctx.createPattern(e.c, 'repeat');
  }
  ctx.fillStyle = tilePattern ?? '#0c1030'; ctx.fillRect(0, 0, W_, H_);
  const vg = ctx.createRadialGradient(W_ / 2, H_ * 0.45, Math.min(W_, H_) * 0.2, W_ / 2, H_ / 2, Math.max(W_, H_) * 0.8);
  vg.addColorStop(0, 'rgba(90,110,230,0.16)'); vg.addColorStop(1, `rgba(3,4,18,${0.62 + tint})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W_, H_);
}

// ---------------------------------------------------------------- the court
function paintCourt(g) {
  const C = COURT, r = lcg(77);
  const x0 = C.x0, x1 = C.x1, y0 = C.y0, y1 = C.y1, sp = C.spine;
  // stands: a dark apron all round with specks of crowd, so the lit clay is the brightest thing on screen
  g.save(); g.shadowColor = 'rgba(2,3,16,0.9)'; g.shadowBlur = 40;
  g.fillStyle = 'rgba(5,7,28,0.88)'; g.beginPath(); g.roundRect(x0 - 52, y0 - 52, x1 - x0 + 104, y1 - y0 + 104, 46); g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect(x0 - 52, y0 - 52, x1 - x0 + 104, y1 - y0 + 104, 46); g.rect(x0 - 30, y0 - 30, x1 - x0 + 60, y1 - y0 + 60); g.clip('evenodd');
  for (let i = 0; i < 420; i++) {
    const x = x0 - 52 + r() * (x1 - x0 + 104), y = y0 - 52 + r() * (y1 - y0 + 104), h = 190 + ((r() * 90) | 0), l = 55 + ((r() * 25) | 0);
    g.fillStyle = `hsla(${h},70%,${l}%,${0.12 + r() * 0.25})`; g.beginPath(); g.arc(x, y, 1.3 + r() * 2.2, 0, TAU); g.fill();
  }
  g.restore();
  // low boards round the court
  g.fillStyle = '#1a2160'; g.beginPath(); g.roundRect(x0 - 22, y0 - 22, x1 - x0 + 44, y1 - y0 + 44, 24); g.fill();
  g.strokeStyle = '#ffcf5a'; g.lineWidth = 3; g.beginPath(); g.roundRect(x0 - 22, y0 - 22, x1 - x0 + 44, y1 - y0 + 44, 24); g.stroke();
  for (let i = 0; i < 40; i++) {      // chevrons along the boards
    const t = i / 40; g.fillStyle = 'rgba(255,207,90,0.18)';
    g.fillRect(x0 - 18 + t * (x1 - x0 + 36), y0 - 18, 6, 10); g.fillRect(x0 - 18 + t * (x1 - x0 + 36), y1 + 8, 6, 10);
  }
  // clay, a lit rectangle with a soft shadow
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 26; g.shadowOffsetY = 6;
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#d0693c'); gr.addColorStop(0.5, '#c25a31'); gr.addColorStop(1, '#b54e2b');
  g.fillStyle = gr; g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 10); g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 10); g.clip();
  // end zones a shade lighter, the central lane lighter still
  g.fillStyle = 'rgba(255,214,170,0.10)'; g.fillRect(x0, y0, x1 - x0, C.end); g.fillRect(x0, y1 - C.end, x1 - x0, C.end);
  g.fillStyle = 'rgba(255,224,190,0.16)'; g.fillRect(sp - 12, y0, 24, y1 - y0);
  // grit, scuffs, rake marks
  for (let i = 0; i < 1500; i++) { const dark = r() > 0.5; g.fillStyle = dark ? `rgba(90,30,10,${0.04 + r() * 0.08})` : `rgba(255,214,170,${0.05 + r() * 0.1})`; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.8 + r() * 5, 0.6 + r() * 2.2, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 46; i++) { g.strokeStyle = `rgba(100,40,15,${0.05 + r() * 0.07})`; g.lineWidth = 1 + r() * 1.6; const y = y0 + r() * (y1 - y0), x = x0 + r() * (x1 - x0 - 180); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 60, y - 5 + r() * 10, x + 110, y + r() * 9, x + 170, y - 4 + r() * 8); g.stroke(); }
  g.restore();
  // lines: boundary, end-zone lines, the lane, seat dividers
  g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (x, y, xx, yy, w = 5, a = 0.95) => { g.strokeStyle = `rgba(0,0,0,0.18)`; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x, y + 1.5); g.lineTo(xx, yy + 1.5); g.stroke(); g.strokeStyle = `rgba(255,252,240,${a})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(xx, yy); g.stroke(); };
  g.strokeStyle = 'rgba(255,252,240,0.95)'; g.lineWidth = 6; g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 10); g.stroke();
  line(x0, y0 + C.end, x1, y0 + C.end, 4, 0.8); line(x0, y1 - C.end, x1, y1 - C.end, 4, 0.8);
  line(sp - 12, y0 + C.end, sp - 12, y1 - C.end, 4, 0.9); line(sp + 12, y0 + C.end, sp + 12, y1 - C.end, 4, 0.9);
  const pitch = (SEAT_Y[1] - SEAT_Y[0]);
  for (let i = 0; i <= SEAT_Y.length; i++) { const y = SEAT_Y[0] - pitch / 2 + i * pitch; line(sp - 12, y, sp + 12, y, 3, 0.9); }
  // light pools from four floodlights
  g.save(); g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 10); g.clip(); g.globalCompositeOperation = 'lighter';
  for (const [lx, ly] of [[x0 + 30, y0 + 40], [x1 - 30, y0 + 40], [x0 + 30, y1 - 40], [x1 - 30, y1 - 40]]) {
    const lg = g.createRadialGradient(lx, ly, 6, lx, ly, 340); lg.addColorStop(0, 'rgba(255,236,190,0.17)'); lg.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = lg; g.fillRect(0, 0, CW, CH);
  }
  g.restore();
}
export function drawCourt(ctx) { layer('court', CW, CH, 1.3, paintCourt)(ctx, 0, 0); }
// The same painted court at a higher resolution, as a plain canvas for the 3D ground (null where OffscreenCanvas is missing).
export const courtImage = (scale = 2) => mk(CW, CH, scale, paintCourt);

// ---------------------------------------------------------------- a pole at the end of the lane
export function drawPole(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(30,8,0,0.35)'; ctx.beginPath(); ctx.ellipse(7, 8, 17, 12, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14); g.addColorStop(0, '#f6d08f'); g.addColorStop(0.6, '#b9803a'); g.addColorStop(1, '#6e4310');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,220,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(-4, -5, 4.5, 2.5, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- an athlete running, seen from above
// o: { kit, ang (0 = facing up the screen), phase, moving, scale, alpha, num, skin, hair, ring }
export function drawAthlete(ctx, x, y, o) {
  const kit = o.kit ?? RUNNER, s = o.scale ?? 1, ang = o.ang ?? 0, ph = o.phase ?? 0, mv = o.moving ? 1 : 0, sw = Math.sin(ph) * mv;
  const skin = o.skin ?? SKINS[0], hair = o.hair ?? '#1b120c';
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x, y); ctx.scale(s, s);
  // soft ground shadow (the light is high and a little to the left)
  ctx.fillStyle = 'rgba(30,6,0,0.34)'; ctx.beginPath(); ctx.ellipse(5, 8, 20, 15, 0, 0, TAU); ctx.fill();
  ctx.rotate(ang);
  // legs in shorts: two strides, one forward while the other is back
  for (const side of [-1, 1]) {
    const f = sw * side * 9;
    ctx.fillStyle = kit.shirt[1]; ctx.beginPath(); ctx.ellipse(side * 6.5, 7 - f, 5.6, 10.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2ece0'; ctx.beginPath(); ctx.ellipse(side * 6.5, 15 - f * 1.15, 4.4, 5.6, 0, 0, TAU); ctx.fill();
  }
  // arms swing against the legs
  ctx.strokeStyle = skin; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (const side of [-1, 1]) { const f = sw * side * 8; ctx.beginPath(); ctx.moveTo(side * 15, -2); ctx.lineTo(side * 19, 5 + f); ctx.stroke(); }
  // shirt: lit from the top left, number on the back
  const sh = ctx.createLinearGradient(-17, -10, 17, 12); sh.addColorStop(0, kit.shirt[0]); sh.addColorStop(1, kit.shirt[1]);
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, 0, 18, 12.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = kit.trim; ctx.fillRect(-18, -2, 36, 3);        // a band across the shoulders
  if (o.num) { ctx.save(); ctx.translate(0, 3.5); ctx.rotate(Math.PI); ctx.fillStyle = 'rgba(8,10,30,0.85)'; ctx.font = '800 11px "Barlow Condensed", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(o.num), 0, 4); ctx.restore(); }
  // head with hair and a head band, a little forward of the shoulders
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-10.5, -1, 2.8, 4, 0, 0, TAU); ctx.ellipse(10.5, -1, 2.8, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -3, 10.2, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(-3, -7, 1, 0, -3, 10.2); hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -3, 10.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = kit.trim; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, -3, 9.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, -11.6, 3.2, 2.2, 0, 0, TAU); ctx.fill();   // nose and brow: the front
  ctx.restore();
  if (o.ring) { ctx.save(); ctx.strokeStyle = o.ring; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y + 1, 29 * s, 0, TAU); ctx.stroke(); ctx.restore(); }
}

// ---------------------------------------------------------------- a seated chaser on the lane, facing left (-1) or right (+1)
export function drawSeated(ctx, x, y, face, o = {}) {
  const kit = o.kit ?? CHASER, s = o.scale ?? 1, skin = o.skin ?? SKINS[0], hair = o.hair ?? '#1b120c';
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(30,6,0,0.34)'; ctx.beginPath(); ctx.ellipse(4 + face * 3, 6, 21, 15, 0, 0, TAU); ctx.fill();
  ctx.rotate(face > 0 ? Math.PI / 2 : -Math.PI / 2);        // local "up" now points the way the player faces
  // knees drawn up in front, hands resting on them
  ctx.fillStyle = kit.shirt[1]; ctx.beginPath(); ctx.ellipse(-7, -9, 5.5, 8, 0.15, 0, TAU); ctx.ellipse(7, -9, 5.5, 8, -0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f2ece0'; ctx.beginPath(); ctx.ellipse(-7, -17, 4.2, 4.2, 0, 0, TAU); ctx.ellipse(7, -17, 4.2, 4.2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = skin; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -1); ctx.lineTo(-9, -11); ctx.moveTo(14, -1); ctx.lineTo(9, -11); ctx.stroke();
  const sh = ctx.createLinearGradient(-16, -8, 16, 12); sh.addColorStop(0, kit.shirt[0]); sh.addColorStop(1, kit.shirt[1]);
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, 1, 17, 11.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.fillStyle = kit.trim; ctx.fillRect(-17, -1, 34, 3);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-9.5, -3, 2.6, 3.6, 0, 0, TAU); ctx.ellipse(9.5, -3, 2.6, 3.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -5, 9.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = kit.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -5, 8.8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, -13, 3, 2.1, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
