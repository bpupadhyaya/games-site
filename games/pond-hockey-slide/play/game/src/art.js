// Drawing of the pond, the banks, the goals, the snow drifts, the puck and the six skaters (people seen from above).
// Pure drawing: nothing here changes game state. World coordinates (the pond is 600 x 900, origin at the centre).
import { HW, HH, CORNER, GOAL_HW, NET_D, POST_R, R_PUCK } from './sim.js';

const TAU = Math.PI * 2;
// The page can hand over a way to make an off-screen canvas (main.js does); without one (tests) everything is drawn directly.
let canvasFactory = null;
export const setCanvasFactory = (f) => { canvasFactory = f; };
export const makeCanvas = (w, h) => (canvasFactory ? canvasFactory(w, h) : null);
export const BANK = 46;           // thickness of the snowbank around the ice

// A tiny deterministic hash for decorative scatter (scratches, trees, speckles): no random numbers at draw time.
export const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function rr(ctx, x, y, w, h, r, keep = false) {
  if (!keep) ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- the people -------------------------------------------------------------------------------------------------
// Six looks: side 0 wears cedar red, side 1 lake blue. Skin, hair and toques differ so the six read as six people.
export const LOOKS = [
  { skin: '#e9b995', hair: '#4a2c1a', toque: '#f4ede0', band: '#b8262a', jacket: ['#d2463f', '#8f1d1f'], scarf: '#f1e3c4', pants: '#2d3342', build: 1.0, long: false },
  { skin: '#8d5a3c', hair: '#15110f', toque: '#b8262a', band: '#f4ede0', jacket: ['#cf3d3a', '#7f171b'], scarf: '#2e3a52', pants: '#252b38', build: 1.08, long: true },
  { skin: '#f3cdb0', hair: '#c98f45', toque: '#2e3a52', band: '#e8b84a', jacket: ['#d8554a', '#98262a'], scarf: '#e8b84a', pants: '#303846', build: 0.94, long: true },
  { skin: '#f0c3a2', hair: '#9b5a2a', toque: '#f4ede0', band: '#2f78b5', jacket: ['#3f86c4', '#1d4f84'], scarf: '#f4ede0', pants: '#2a303c', build: 1.04, long: false },
  { skin: '#b97a52', hair: '#1c1612', toque: '#2f78b5', band: '#f4ede0', jacket: ['#3a7fbd', '#18467a'], scarf: '#c9d6e2', pants: '#232a36', build: 1.1, long: true },
  { skin: '#e6b08c', hair: '#6b4a2e', toque: '#cfe3f2', band: '#1d4f84', jacket: ['#4a93d0', '#1f5a94'], scarf: '#f0c968', pants: '#2c3340', build: 0.96, long: true },
];
export const lookOf = (b) => LOOKS[b.side * 3 + b.idx];

function capsule(ctx, x0, y0, x1, y1, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// A skater: `b` is the physics body (x, y, face, glide, swing, hit), `t` the animation clock, `o.ring` outlines the one to pull.
// Seen from above: boots and blades, padded jacket with shoulders, arms to the stick, scarf, and a knit toque over a head.
const shade = (hex, k) => {          // darken (k<0) or lighten (k>0) a #rrggbb colour
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) : v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
export function drawSkater(ctx, b, t, o = {}) {
  const L = lookOf(b), sc = L.build * 1.12 * (o.scale ?? 1);
  const gl = b.glide || 0, sw = b.swing || 0;
  const bob = Math.sin(t * 9 + b.idx * 2) * gl;
  ctx.save(); ctx.translate(b.x, b.y);
  // shadow on the ice
  const sg = ctx.createRadialGradient(4, 7, 4, 4, 7, 44);
  sg.addColorStop(0, 'rgba(20,50,80,0.36)'); sg.addColorStop(1, 'rgba(20,50,80,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(4, 7, 42, 38, 0, 0, TAU); ctx.fill();
  if (o.ring) { ctx.lineWidth = 4; ctx.strokeStyle = o.ring; ctx.globalAlpha = o.ringA ?? 0.9; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.rotate(b.face); ctx.scale(sc, sc);
  const idle = Math.sin(t * 2 + b.idx * 1.7) * (1 - gl);
  const lean = gl * 3 + (b.hit || 0) * 2;
  const J0 = L.jacket[0], J1 = L.jacket[1];
  // skates: steel blade under a leather boot, toes peeking out in front of the body
  for (const sy of [-8.5, 8.5]) {
    const sx = (sy < 0 ? -bob : bob) * 3;
    ctx.fillStyle = '#c9d3dc'; rr(ctx, -20 + sx, sy - 1.6, 44, 3.2, 1.6); ctx.fill();
    ctx.fillStyle = '#2b2623'; rr(ctx, -12 + sx, sy - 5.6, 30, 11.2, 5.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, -4 + sx, sy - 4.4, 18, 2.4, 1.2); ctx.fill();
  }
  // scarf tail streams behind
  const tail = -16 - gl * 7, wob = Math.sin(t * 8 + b.idx) * 4 * gl;
  ctx.fillStyle = L.scarf; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(tail * 0.6, -9 + wob, tail - 8, -3 + wob * 1.5); ctx.lineTo(tail - 8, 6 + wob * 1.5); ctx.quadraticCurveTo(tail * 0.6, 5 + wob, -8, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); ctx.translate(-1 + lean * 0.4, 0); ctx.rotate(Math.sin(t * 7 + b.idx) * 0.07 * gl);
  // arm targets: the stick is held by two mittens a hand's width apart along its shaft
  const sa = -0.12 - sw * 1.15 + idle * 0.03 + (b.hit || 0) * 0.35;
  const dx = Math.cos(sa), dy = Math.sin(sa);
  const pivot = { x: 25 + lean, y: -2 }, upper = { x: pivot.x - dx * 14 + 1, y: pivot.y - dy * 14 + 7 };
  const arm = (sy, hand) => {
    const sx0 = 1, sy0 = sy * 21, ex = (sx0 + hand.x) / 2 + 4, ey = (sy0 + hand.y) / 2 + sy * 4;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = shade(J1, -0.2); ctx.lineWidth = 11.5; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey); ctx.lineTo(hand.x - 2, hand.y); ctx.stroke();
    ctx.strokeStyle = J1; ctx.lineWidth = 9.6; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey); ctx.lineTo(hand.x - 2, hand.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(sx0 + 1, sy0 - sy * 2); ctx.lineTo(ex + 1, ey - sy * 2); ctx.stroke();
  };
  // torso: padded jacket, shaded across the shoulders like a cylinder
  const jg = ctx.createLinearGradient(0, -26, 0, 26); jg.addColorStop(0, shade(J1, -0.2)); jg.addColorStop(0.3, J0); jg.addColorStop(0.5, shade(J0, 0.12)); jg.addColorStop(0.7, J0); jg.addColorStop(1, shade(J1, -0.2));
  ctx.fillStyle = jg; rr(ctx, -13, -26, 26, 52, 12); ctx.fill();
  ctx.save(); rr(ctx, -13, -26, 26, 52, 12); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5;
  for (const k of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(k, -26); ctx.quadraticCurveTo(k + 2.2, 0, k, 26); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2;
  for (const k of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(k + 1.4, -26); ctx.quadraticCurveTo(k + 3.6, 0, k + 1.4, 26); ctx.stroke(); }
  const hl = ctx.createRadialGradient(-2, -12, 1, -2, -12, 22); hl.addColorStop(0, 'rgba(255,255,255,0.3)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(-14, -27, 28, 54);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1.3; rr(ctx, -13, -26, 26, 52, 12); ctx.stroke();
  ctx.fillStyle = shade(J1, -0.25); ctx.beginPath(); ctx.ellipse(-8.5, 0, 5.2, 8, 0, 0, TAU); ctx.fill();          // the hood lying on the back
  arm(-1, pivot); arm(1, upper);
  // mittens
  for (const h of [upper, pivot]) { ctx.fillStyle = '#2f3a47'; ctx.beginPath(); ctx.arc(h.x, h.y, 5.4, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(h.x - 1.4, h.y - 1.6, 2, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(h.x, h.y, 5.4, 0, TAU); ctx.stroke(); }
  // the stick
  ctx.save(); ctx.translate(pivot.x, pivot.y); ctx.rotate(sa);
  ctx.strokeStyle = '#6e4a2a'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(40, 3); ctx.stroke();
  ctx.strokeStyle = '#b08756'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-20, -0.9); ctx.lineTo(40, 2.1); ctx.stroke();
  ctx.strokeStyle = '#1d2128'; ctx.lineWidth = 5.2; ctx.beginPath(); ctx.moveTo(40, 3); ctx.lineTo(42, 17); ctx.stroke();
  ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(41.2, 7); ctx.lineTo(41.9, 15); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // head: hair behind, ears, a crescent of face, the knit toque, a thick scarf around the neck
  ctx.save(); ctx.translate(3 + lean * 0.6, idle * 0.5);
  ctx.strokeStyle = L.scarf; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.ellipse(-1.5, 0, 9.5, 13.5, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-1.5, 0, 12.4, 16.2, 0, 0, TAU); ctx.stroke();
  if (L.long) { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(-9.5, 0, 7.5, 8 + Math.abs(Math.sin(t * 5 + b.idx)) * gl * 2, 0, 0, TAU); ctx.fill(); }
  else { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(-8, 0, 5.5, 8, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = L.skin;
  for (const sy of [-11.8, 11.8]) { ctx.beginPath(); ctx.ellipse(0, sy, 3, 3.8, 0, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(9.8, 0, 4.8, 7.8, 0, 0, TAU); ctx.fill();            // forehead and cheeks under the brim
  ctx.fillStyle = shade(L.skin, -0.12); ctx.beginPath(); ctx.ellipse(14.6, 0, 2.7, 2.3, 0, 0, TAU); ctx.fill();   // nose
  ctx.fillStyle = 'rgba(150,70,60,0.3)'; ctx.beginPath(); ctx.ellipse(12, -4.5, 1.6, 2.4, 0, 0, TAU); ctx.ellipse(12, 4.5, 1.6, 2.4, 0, 0, TAU); ctx.fill();
  // toque
  const tg = ctx.createRadialGradient(-2, -3, 1, 0, 0, 13); tg.addColorStop(0, shade(L.toque, 0.18)); tg.addColorStop(1, shade(L.toque, -0.12));
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3.5, Math.sin(a) * 3.5); ctx.quadraticCurveTo(Math.cos(a + 0.15) * 7, Math.sin(a + 0.15) * 7, Math.cos(a) * 10.4, Math.sin(a) * 10.4); ctx.stroke(); }
  ctx.strokeStyle = L.band; ctx.lineWidth = 2.6; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, 0, 10.6, 1.0, TAU - 1.0); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
  ctx.fillStyle = shade(L.band, 0.1); ctx.beginPath(); ctx.arc(-2.5, 0, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-3.4, -1, 1.5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawPuck(ctx, p, t) {
  const r = R_PUCK, sp = Math.hypot(p.vx, p.vy);
  ctx.save(); ctx.translate(p.x, p.y);
  const sg = ctx.createRadialGradient(2, 3, 2, 2, 3, r * 1.9); sg.addColorStop(0, 'rgba(15,40,70,0.45)'); sg.addColorStop(1, 'rgba(15,40,70,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(2, 3, r * 1.9, 0, TAU); ctx.fill();
  if (sp > 120) {                       // a soft streak behind a fast puck
    const a = Math.atan2(p.vy, p.vx), len = Math.min(54, sp * 0.05);
    const g = ctx.createLinearGradient(0, 0, -Math.cos(a) * len, -Math.sin(a) * len); g.addColorStop(0, 'rgba(40,52,70,0.35)'); g.addColorStop(1, 'rgba(40,52,70,0)');
    ctx.strokeStyle = g; ctx.lineWidth = r * 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(a) * len, -Math.sin(a) * len); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, r + 2); g.addColorStop(0, '#4a5568'); g.addColorStop(0.5, '#1b2029'); g.addColorStop(1, '#0b0e13');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, r - 2.2, 3.6, 5.1); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-3.6, -4.2, 4.6, 2.2, -0.7, 0, TAU); ctx.fill();
  void t;
  ctx.restore();
}

// ---- the pond ---------------------------------------------------------------------------------------------------
// The ice surface with scratches. `glow` (0..1) warms it after a goal.
export function drawIce(ctx, glow = 0, glowOnly = false) {
  ctx.save();
  if (glowOnly) { rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER); ctx.fillStyle = `rgba(255,226,140,${0.22 * glow})`; ctx.fill(); ctx.restore(); return; }
  rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER);
  const g = ctx.createRadialGradient(-30, -60, 40, 0, 0, 560);
  g.addColorStop(0, '#f1fafe'); g.addColorStop(0.55, '#d7ecf7'); g.addColorStop(1, '#aacde3');
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  // a faint line pattern, like a pond that was skated all morning: long arcs and scratches
  for (let i = 0; i < 70; i++) {
    const x = (hash(i * 3.1) - 0.5) * (HW * 2 + 40), y = (hash(i * 5.7) - 0.5) * (HH * 2 + 40), a = hash(i * 7.3) * TAU, l = 40 + hash(i * 2.9) * 150, bend = (hash(i * 1.3) - 0.5) * 70;
    ctx.strokeStyle = i % 3 ? 'rgba(255,255,255,0.55)' : 'rgba(90,140,180,0.22)'; ctx.lineWidth = i % 5 ? 1.1 : 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + bend, y + Math.sin(a) * l * 0.5 - bend, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // a few cracks
  ctx.strokeStyle = 'rgba(110,160,200,0.3)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 4; i++) {
    let x = (hash(i * 11.1) - 0.5) * (HW * 1.6), y = (hash(i * 13.7) - 0.5) * 760; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (hash(i * 31 + k) - 0.5) * 70; y += (hash(i * 17 + k * 3) - 0.3) * 50; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // soft blue vignette toward the banks (the ice is thicker and bluer there)
  const v = ctx.createRadialGradient(0, 0, 250, 0, 0, 560); v.addColorStop(0, 'rgba(60,120,170,0)'); v.addColorStop(1, 'rgba(60,120,170,0.22)');
  ctx.fillStyle = v; ctx.fillRect(-HW, -HH, HW * 2, HH * 2);
  // a face-off circle, scratched in
  ctx.strokeStyle = 'rgba(120,170,205,0.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-HW, 0); ctx.lineTo(-80, 0); ctx.moveTo(80, 0); ctx.lineTo(HW, 0); ctx.stroke();
  if (glow > 0) { ctx.fillStyle = `rgba(255,226,140,${0.22 * glow})`; ctx.fillRect(-HW, -HH, HW * 2, HH * 2); }
  ctx.restore();
}

// Skate trails: [{ x0,y0,x1,y1,a }] thin lines that fade.
export function drawTrails(ctx, trails) {
  ctx.save(); ctx.lineCap = 'round';
  for (const q of trails) {
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * q.a})`; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(q.x0, q.y0); ctx.lineTo(q.x1, q.y1); ctx.stroke();
    ctx.strokeStyle = `rgba(80,130,175,${0.22 * q.a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x0 + 1, q.y0 + 1.5); ctx.lineTo(q.x1 + 1, q.y1 + 1.5); ctx.stroke();
  }
  ctx.restore();
}

// A drift of loose snow: a soft mound that slows whoever crosses it.
export function drawSnow(ctx, s, t) {
  ctx.save(); ctx.translate(s.x, s.y);
  const pts = 18, rad = (i) => s.r * (0.88 + 0.16 * hash(s.seed * 7 + i * 3.7));
  const path = () => { ctx.beginPath(); for (let i = 0; i <= pts; i++) { const a = (i % pts) / pts * TAU, r = rad(i % pts); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.94; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); };
  // soft shadow and body
  ctx.save(); ctx.translate(5, 8); path(); ctx.fillStyle = 'rgba(60,100,140,0.28)'; ctx.fill(); ctx.restore();
  path(); const g = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.35, s.r * 0.1, 0, 0, s.r * 1.05);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#eef5fa'); g.addColorStop(1, '#c9dbe8');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(120,160,195,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); path(); ctx.clip();
  for (let i = 0; i < 26; i++) {
    const a = hash(s.seed + i * 1.7) * TAU, d = Math.sqrt(hash(s.seed * 3 + i)) * s.r * 0.9;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(150,185,215,0.35)'; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2 + hash(i + s.seed) * 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
  void t;
  ctx.restore();
}

// The snowbank around the ice, cut open at both goals.
export function drawBanks(ctx) {
  ctx.save();
  const ow = HW + BANK, oh = HH + BANK;
  ctx.beginPath();
  rr(ctx, -ow, -oh, ow * 2, oh * 2, CORNER + BANK * 0.8);
  rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER, true);
  const g = ctx.createLinearGradient(-ow, -oh, ow, oh); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e4eef6'); g.addColorStop(1, '#bcd0df');
  ctx.fillStyle = g; ctx.fill('evenodd');
  // outer edge shadow and the inner lip
  ctx.save(); ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(70,110,150,0.35)'; ctx.lineWidth = 10; rr(ctx, -HW - 2, -HH - 2, HW * 2 + 4, HH * 2 + 4, CORNER + 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; rr(ctx, -HW - 12, -HH - 12, HW * 2 + 24, HH * 2 + 24, CORNER + 12); ctx.stroke();
  for (let i = 0; i < 110; i++) {
    const a = hash(i * 1.9) * TAU, k = hash(i * 4.3); const ex = Math.cos(a) * (HW + BANK * (0.2 + 0.7 * k)) * 1.0, ey = Math.sin(a) * (HH + BANK * (0.2 + 0.7 * k));
    const x = Math.max(-ow, Math.min(ow, ex * 1.12)), y = Math.max(-oh, Math.min(oh, ey * 1.06));
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(140,175,205,0.3)'; ctx.beginPath(); ctx.arc(x, y, 2 + hash(i) * 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// One goal: two posts, a net and a plank base; `sy` -1 = top end, +1 = bottom end. `flash` 0..1 after a goal.
export function drawGoal(ctx, sy, flash = 0, t = 0) {
  ctx.save(); ctx.translate(0, sy * HH); ctx.scale(1, sy);
  // the opening in the snowbank, a trampled floor under the net
  ctx.fillStyle = '#9db6c8'; ctx.fillRect(-GOAL_HW - 14, -4, (GOAL_HW + 14) * 2, NET_D + 20);
  ctx.fillStyle = '#c9dbe7'; ctx.fillRect(-GOAL_HW, -4, GOAL_HW * 2, NET_D + 10);
  // net: back and side frame, mesh
  ctx.fillStyle = 'rgba(20,36,52,0.34)'; ctx.fillRect(-GOAL_HW + 3, 0, GOAL_HW * 2 - 6, NET_D);
  ctx.save(); ctx.beginPath(); ctx.rect(-GOAL_HW + 3, 0, GOAL_HW * 2 - 6, NET_D); ctx.clip();
  ctx.strokeStyle = `rgba(255,255,255,${0.7 + 0.25 * flash})`; ctx.lineWidth = 1.1;
  for (let x = -GOAL_HW; x <= GOAL_HW; x += 9) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(t * 3 + x) * flash * 3, NET_D); ctx.stroke(); }
  for (let y = 0; y <= NET_D; y += 9) { ctx.beginPath(); ctx.moveTo(-GOAL_HW, y); ctx.lineTo(GOAL_HW, y + Math.sin(t * 4 + y) * flash * 2); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#e9edf1'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-GOAL_HW, 0); ctx.lineTo(-GOAL_HW, NET_D); ctx.lineTo(GOAL_HW, NET_D); ctx.lineTo(GOAL_HW, 0); ctx.stroke();
  // goal line
  ctx.strokeStyle = 'rgba(200,50,50,0.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-GOAL_HW, 0); ctx.lineTo(GOAL_HW, 0); ctx.stroke();
  // posts
  for (const sx of [-1, 1]) {
    const g = ctx.createRadialGradient(sx * GOAL_HW - 2, -2, 1, sx * GOAL_HW, 0, POST_R + 2); g.addColorStop(0, '#ff6b5e'); g.addColorStop(1, '#a31d1d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx * GOAL_HW, 0, POST_R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(sx * GOAL_HW - 2.5, -2.5, 2.6, 0, TAU); ctx.fill();
  }
  if (flash > 0) {
    const g = ctx.createRadialGradient(0, 10, 10, 0, 10, 160); g.addColorStop(0, `rgba(255,236,150,${0.7 * flash})`); g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g; ctx.fillRect(-190, -60, 380, 230);
  }
  ctx.restore();
}

// ---- the shore: full-screen scenery behind the pond ---------------------------------------------------------------
// Pine trees seen from above (snow dusted) scattered in world space outside the banks. Draw inside the board transform.
export function drawShore(ctx, extent = 2400, vb = null) {
  const ox = HW + BANK, oy = HH + BANK;
  // snow ground, big enough to cover any screen at the smallest board scale
  const g = ctx.createRadialGradient(0, 0, 400, 0, 0, extent);
  g.addColorStop(0, '#9fbbd0'); g.addColorStop(0.5, '#7898b3'); g.addColorStop(1, '#46657f');
  ctx.fillStyle = g; ctx.fillRect(-extent, -extent, extent * 2, extent * 2);
  // drifts of snow on the ground
  for (let i = 0; i < 40; i++) {
    const x = (hash(i * 2.3) - 0.5) * extent * 1.6, y = (hash(i * 4.1) - 0.5) * extent * 1.6;
    if (Math.abs(x) < ox + 20 && Math.abs(y) < oy + 20) continue;
    if (vb && (x < vb.x0 - 200 || x > vb.x1 + 200 || y < vb.y0 - 120 || y > vb.y1 + 120)) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, 60 + hash(i) * 120, 30 + hash(i * 3) * 60, hash(i * 5) * 3, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 90; i++) {
    const x = (hash(i * 1.71) - 0.5) * extent * 1.5, y = (hash(i * 2.93) - 0.5) * extent * 1.5;
    if (Math.abs(x) < ox + 56 && Math.abs(y) < oy + 56) continue;
    const r = 34 + hash(i * 6.1) * 34;
    if (vb && (x < vb.x0 - r * 1.3 || x > vb.x1 + r * 1.3 || y < vb.y0 - r * 1.3 || y > vb.y1 + r * 1.3)) continue;
    pine(ctx, x, y, r, i);
  }
}
function pine(ctx, x, y, r, i) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(40,70,100,0.22)'; ctx.beginPath(); ctx.ellipse(r * 0.25, r * 0.35, r * 1.05, r * 0.95, 0, 0, TAU); ctx.fill();
  const layers = [['#173f35', 1], ['#1f5444', 0.74], ['#2a6a55', 0.48]];
  layers.forEach(([c, k], j) => {
    ctx.fillStyle = c; ctx.beginPath();
    for (let a = 0; a < 16; a++) { const ang = a / 16 * TAU + j * 0.2 + i, rad = (a % 2 ? 0.62 : 1) * r * k; if (a === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad); else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); }
    ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let k = 0; k < 9; k++) { const a = hash(i * 9 + k) * TAU, d = hash(i * 5 + k) * r * 0.8; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2 + hash(k + i) * 4, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A tiny pond for the Rules pictures: banks, ice, goals and whatever the caller draws in world units afterwards.
export function drawPondBase(ctx, o = {}) {
  drawBanks(ctx); drawIce(ctx, 0);
  drawGoal(ctx, -1, 0, 0); drawGoal(ctx, 1, 0, 0);
  for (const s of o.snow ?? []) drawSnow(ctx, s, 0);
}
export { rr as roundRectPath };
void GOAL_HW;
