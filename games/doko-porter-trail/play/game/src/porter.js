// The porter, the doko (woven basket), the namlo (headstrap), the tokma (T-shaped stick) and the goods.
// Drawn in virtual units, 100 units = 1 metre. Feet stand at (x, y). Everything is a smooth capsule or gradient fill.
import { K } from './engine.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const LOADS = {
  sacks: { name: 'rice sacks', fill: ['#f3e6c4', '#cdb98a'], tie: '#8a5a2b' },
  veg: { name: 'vegetables', fill: ['#8fcf5a', '#4f9a35'], tie: '#2f6a22' },
  oranges: { name: 'oranges', fill: ['#ffb43a', '#e8791a'], tie: '#4f9a35' },
  books: { name: 'books and slates', fill: ['#5d6b88', '#363f58'], tie: '#d9b35a' },
  salt: { name: 'salt and tea', fill: ['#f4f1ea', '#bfb8a6'], tie: '#b0432f' },
  millet: { name: 'millet sacks', fill: ['#d9a95a', '#a97a32'], tie: '#5a3a1a' },
  slates: { name: 'roof slates', fill: ['#8c97a6', '#566070'], tie: '#2f3640' },
  blankets: { name: 'blankets', fill: ['#c9473a', '#8a2a2a'], tie: '#f1c14a' },
};
export const LOAD_KEYS = ['sacks', 'veg', 'oranges', 'sacks', 'books', 'salt', 'millet', 'slates', 'blankets', 'sacks', 'blankets', 'sacks'];

const lerp = (a, b, t) => a + (b - a) * t;

function capsule(ctx, x0, y0, x1, y1, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// One goods item at local basket coordinates (cx, cy) with size r. `kind` is a LOADS key.
export function drawGood(ctx, kind, cx, cy, r, rot = 0) {
  const L = LOADS[kind] ?? LOADS.sacks;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, L.fill[0]); g.addColorStop(1, L.fill[1]);
  ctx.fillStyle = g;
  if (kind === 'oranges') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.22, 0, TAU); ctx.fill();
    ctx.fillStyle = L.tie; ctx.beginPath(); ctx.ellipse(r * 0.05, -r * 0.8, r * 0.28, r * 0.14, -0.4, 0, TAU); ctx.fill();
  } else if (kind === 'veg') {
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? L.fill[0] : L.fill[1]; ctx.beginPath(); ctx.ellipse(Math.cos(i * 1.3) * r * 0.45, Math.sin(i * 1.3) * r * 0.4, r * 0.55, r * 0.34, i, 0, TAU); ctx.fill(); }
  } else if (kind === 'books' || kind === 'slates') {
    ctx.beginPath(); ctx.roundRect(-r * 0.95, -r * 0.55, r * 1.9, r * 1.1, r * 0.1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-r * 0.9, -r * 0.5, r * 1.8, r * 0.18);
    ctx.fillStyle = L.tie; ctx.fillRect(-r * 0.12, -r * 0.55, r * 0.24, r * 1.1);
  } else if (kind === 'blankets') {
    ctx.beginPath(); ctx.roundRect(-r * 0.9, -r * 0.7, r * 1.8, r * 1.4, r * 0.35); ctx.fill();
    ctx.fillStyle = L.tie; ctx.fillRect(-r * 0.9, -r * 0.2, r * 1.8, r * 0.18); ctx.fillStyle = '#3a5a9a'; ctx.fillRect(-r * 0.9, r * 0.15, r * 1.8, r * 0.14);
  } else {
    ctx.beginPath(); ctx.roundRect(-r * 0.8, -r * 0.9, r * 1.6, r * 1.7, r * 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.2, r * 0.42, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = L.tie; ctx.lineWidth = Math.max(2, r * 0.14); ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.55); ctx.lineTo(r * 0.7, -r * 0.55); ctx.stroke();
  }
  ctx.restore();
}

// Slots of goods inside the basket mouth, in basket-local coordinates (origin low back, y up is negative). 8 slots.
const SLOTS = [[-17, -86], [17, -86], [0, -92], [-30, -76], [30, -76], [-9, -106], [10, -108], [0, -122]];
export const goodSlot = (i) => SLOTS[i % SLOTS.length];

// The doko (basket) with its heap of goods, hanging from `pivot` (its low back) and rotated by `rot`.
function drawDoko(ctx, pivot, rot, items, loadKind) {
  ctx.save();
  ctx.translate(pivot.x, pivot.y); ctx.rotate(rot);
  // basket body: narrow bottom, wide mouth, slightly bowed
  const basket = new Path2DLike(ctx);
  basket.path();
  const bg = ctx.createLinearGradient(-34, 0, 34, 0);
  bg.addColorStop(0, '#9a6a2c'); bg.addColorStop(0.45, '#e3b468'); bg.addColorStop(1, '#a8742e');
  ctx.fillStyle = bg; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(70,40,10,0.28)'; ctx.lineWidth = 2.2;
  for (let i = -8; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 9 - 60, 20); ctx.lineTo(i * 9 + 40, -90); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 9 + 60, 20); ctx.lineTo(i * 9 - 40, -90); ctx.stroke(); }
  ctx.fillStyle = 'rgba(60,34,10,0.35)'; ctx.fillRect(-60, -34, 120, 6); ctx.fillRect(-60, -62, 120, 5);
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = '#6a4414'; basket.path(); ctx.stroke();
  // goods heaped in the mouth (drawn back to front by slot)
  const n = Math.max(0, Math.min(items, 8));
  for (let i = 0; i < n; i++) { const [sx, sy] = SLOTS[i]; drawGood(ctx, loadKind, sx, sy - 8, 14 + (i === 7 ? 0 : 1), (i % 3 - 1) * 0.12); }
  // front rim
  ctx.fillStyle = '#7a4f1c'; ctx.beginPath(); ctx.roundRect(-36, -82, 72, 9, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,170,0.35)'; ctx.fillRect(-32, -81, 64, 2.4);
  ctx.restore();

}

// namlo: the woven strap across the forehead (f), over the crown (c) and the nape (n), back to the basket's upper rim (bx, by).
function drawNamlo(ctx, f, c, n, bx, by) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(c.x, c.y, n.x, n.y); ctx.lineTo(bx, by); };
  ctx.strokeStyle = '#7a2a20'; ctx.lineWidth = 4.6; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,140,0.65)'; ctx.lineWidth = 1.3; ctx.setLineDash([3, 4]); path(); ctx.stroke(); ctx.setLineDash([]);
}
const basketTop = (pivot, rot) => ({ x: pivot.x + Math.sin(rot) * 42 - Math.cos(rot) * 3, y: pivot.y - Math.cos(rot) * 42 });

const BACK_X = 17;

// pose: { x, y, phase, walking 0..1, breathLevel 0..1, lean (torso, rad), load (load angle rad), rest (0..1 propped), stumble (0..1),
//         items, loadKind, t (clock for breathing), slope (rad) }
export function drawPorter(ctx, pose) {
  const { x, y, phase = 0, walking = 0, breathLevel = 1, lean = 0, load = 0, rest = 0, stumble = 0, items = 5, loadKind = 'sacks', t = 0, slope = 0 } = pose;
  const sc = pose.scale ?? 1;
  ctx.save();
  ctx.translate(x, y); ctx.scale(sc, sc);
  // contact shadow
  const sg = ctx.createRadialGradient(0, 0, 4, 0, 0, 62);
  sg.addColorStop(0, 'rgba(0,0,0,0.38)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.scale(1, 0.2); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 62, 0, TAU); ctx.fill(); ctx.restore();

  const w = walking;
  const sw = Math.sin(phase * TAU), cw = Math.cos(phase * TAU);
  const THIGH = 43, SHIN = 43;
  const heavy = 1 - breathLevel;                         // tired porters walk lower and shorter
  const stride = (0.62 - 0.12 * heavy) * w;
  // leg angles: hip swing, knee bend (back leg lifts)
  const leg = (off) => {
    const s = Math.sin(phase * TAU + off), c = Math.cos(phase * TAU + off);
    const th = s * stride + 0.04;
    const kn = Math.max(0, c) * 0.95 * w + 0.12 * w;
    return { th, kn };
  };
  const A = leg(0), B = leg(Math.PI);
  const reach = (l) => THIGH * Math.cos(l.th) + SHIN * Math.cos(l.th - l.kn);
  const hip = Math.max(reach(A), reach(B));
  const bob = (1 - Math.abs(Math.sin(phase * TAU)) * 0.05 * w) ;
  const py = -hip * (0.99 + 0.0 * bob) + (rest ? 3 + 0 * t : 0) + Math.abs(cw) * 2.5 * w;
  const hipX = 0, hipY = py;
  const legPts = (l) => {
    const kx = hipX + Math.sin(l.th) * THIGH, ky = hipY + Math.cos(l.th) * THIGH;
    const a2 = l.th - l.kn;
    return { kx, ky, fx: kx + Math.sin(a2) * SHIN, fy: ky + Math.cos(a2) * SHIN, a2 };
  };
  const La = legPts(A), Lb = legPts(B);

  // trousers and feet (back leg first, darker)
  const drawLeg = (L, dark) => {
    capsule(ctx, hipX, hipY, L.kx, L.ky, 17, dark ? '#4a3a2c' : '#5c4836');
    capsule(ctx, L.kx, L.ky, L.fx, L.fy - 3, 14, dark ? '#4a3a2c' : '#5c4836');
    capsule(ctx, L.fx - 2, L.fy - 1, L.fx + 11, L.fy - 1, 9, dark ? '#2a2018' : '#3a2c20');
  };
  const backFirst = Math.cos(phase * TAU) > 0 ? [Lb, La] : [La, Lb];
  drawLeg(backFirst[0], true);

  // torso orientation
  const tl = lean + (rest ? 0.12 : 0) + stumble * 0.2 * Math.sin(t * 28);
  const sh = { x: hipX + Math.sin(tl) * 56, y: hipY - Math.cos(tl) * 56 };
  const breatheAmp = 1.2 + 3.2 * heavy;
  const chest = Math.sin(t * (rest ? 3.4 + 4 * heavy : 0.0)) * breatheAmp * (rest ? 1 : 0);
  const head = { x: sh.x + Math.sin(tl + 0.08) * 22 + 2, y: sh.y - Math.cos(tl + 0.08) * 22 - 4 + chest * 0.3 };

  // ---- the doko (behind the body) -------------------------------------------------------------------------------------
  const pivot = { x: hipX - Math.cos(tl) * 15 + Math.sin(tl) * 20, y: hipY - Math.sin(tl) * -15 - Math.cos(tl) * 22 };
  const rot = load * 1.15 + tl * 0.55 + (rest ? -0.04 : 0) + Math.sin(phase * TAU * 2) * 0.012 * w;
  drawDoko(ctx, pivot, rot, items, loadKind);

  // hand position: the front hand carries the T-stick (tokma) at waist height; resting, it steadies the basket
  const handW = { x: hipX + Math.sin(tl) * 26 + 22, y: hipY - 30 };
  const stickX = handW.x + 6 + Math.sin(phase * TAU) * 16 * w;
  if (rest) {
    const sx = pivot.x - 26;
    capsule(ctx, sx, -2, sx + 4, pivot.y - 6, 7, '#6a4a22');
    capsule(ctx, sx - 16, pivot.y - 6, sx + 22, pivot.y - 6 + 2, 8, '#7a5628');
  } else {
    capsule(ctx, handW.x, handW.y + 4, stickX, -1, 6, '#6a4a22');
    capsule(ctx, handW.x - 11, handW.y, handW.x + 11, handW.y, 7.5, '#7a5628');
  }

  // front leg
  drawLeg(backFirst[1], false);

  // torso: vest over a cream shirt
  const tg = ctx.createLinearGradient(hipX - 20, 0, hipX + 24, 0);
  tg.addColorStop(0, '#2f4a7a'); tg.addColorStop(1, '#4a6fae');
  ctx.strokeStyle = tg; ctx.lineWidth = 28; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hipX, hipY - 4); ctx.lineTo(sh.x, sh.y + 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(hipX + 7, hipY - 8); ctx.lineTo(sh.x + 7, sh.y); ctx.stroke();
  // waist cloth
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(hipX - 12, hipY - 9); ctx.lineTo(hipX + 13, hipY - 9 - tl * 6); ctx.stroke();

  // arm: shoulder, elbow dropped behind the line, hand on the stick (or on the basket when resting)
  const hand = rest ? { x: pivot.x - 4, y: pivot.y - 30 } : handW;
  const el = { x: lerp(sh.x, hand.x, 0.5) - 9, y: lerp(sh.y, hand.y, 0.5) + 4 };
  capsule(ctx, sh.x, sh.y + 3, el.x, el.y, 12.5, '#e6d8b8');
  capsule(ctx, el.x, el.y, hand.x, hand.y, 10.5, '#c08a5e');
  ctx.fillStyle = '#b07a52'; ctx.beginPath(); ctx.arc(hand.x, hand.y, 6.5, 0, TAU); ctx.fill();

  // neck, head, face
  capsule(ctx, sh.x, sh.y, head.x - 1, head.y + 9, 10, '#b07a52');
  const hg = ctx.createRadialGradient(head.x - 3, head.y - 4, 2, head.x, head.y, 18);
  hg.addColorStop(0, '#e0b087'); hg.addColorStop(1, '#a8714a');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(head.x, head.y, 12.5, 14.5, tl * 0.5, 0, TAU); ctx.fill();
  // hair: back and top of the head only
  ctx.fillStyle = '#1e1612'; ctx.beginPath(); ctx.ellipse(head.x - 3.5, head.y - 5, 11.5, 11, tl * 0.5 - 0.15, Math.PI * 0.55, Math.PI * 1.85); ctx.fill();
  // ear
  ctx.fillStyle = '#b07a52'; ctx.beginPath(); ctx.ellipse(head.x - 4.5, head.y + 1.5, 3.4, 4.6, 0, 0, TAU); ctx.fill();
  // eye, brow, nose, mouth
  ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.ellipse(head.x + 6.5, head.y - 1, 3, 2.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1e1612'; ctx.beginPath(); ctx.arc(head.x + 7.4, head.y - 1, 1.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1e1612'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(head.x + 3.2, head.y - 4.6); ctx.lineTo(head.x + 10, head.y - 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,40,20,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(head.x + 11.5, head.y); ctx.lineTo(head.x + 13.8, head.y + 3.4); ctx.lineTo(head.x + 10.5, head.y + 3.8); ctx.stroke();
  ctx.strokeStyle = '#6a3a2a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(head.x + 5, head.y + 8); ctx.lineTo(head.x + 10, head.y + (heavy > 0.6 ? 9.4 : 8)); ctx.stroke();

  const bt = basketTop(pivot, rot);
  drawNamlo(ctx, { x: head.x + 9, y: head.y - 8 }, { x: head.x + 2, y: head.y - 17 }, { x: head.x - 8, y: head.y - 9 }, bt.x, bt.y);

  ctx.restore();
}

// The basket outline as a tiny helper so it can be stroked and filled with the same path.
class Path2DLike {
  constructor(ctx) { this.ctx = ctx; }
  path() {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(-17, 12); c.lineTo(17, 12);
    c.quadraticCurveTo(30, -34, 36, -80);
    c.lineTo(-36, -80);
    c.quadraticCurveTo(-30, -34, -17, 12);
    c.closePath();
  }
}

// World position of a goods slot, for the falling-item effect: (x, y) are the porter's feet, same pose object as drawPorter.
export function goodWorldPos(pose, i) {
  const { x, y, lean = 0, load = 0, rest = 0, phase = 0, walking = 0 } = pose;
  const sc = pose.scale ?? 1;
  const THIGH = 43, SHIN = 43;
  const tl = lean + (rest ? 0.12 : 0);
  const hipY = -(THIGH + SHIN) * 0.98;
  const px = -Math.cos(tl) * 15 + Math.sin(tl) * 20, py = hipY - Math.cos(tl) * 22 + Math.sin(tl) * 15;
  const rot = load * 1.15 + tl * 0.55 + (rest ? -0.04 : 0);
  const [sx, sy] = SLOTS[i % SLOTS.length];
  const lx = sx, ly = sy - 8;
  return { x: x + (px + lx * Math.cos(rot) - ly * Math.sin(rot)) * sc, y: y + (py + lx * Math.sin(rot) + ly * Math.cos(rot)) * sc };
}
export const _clamp = clamp;
