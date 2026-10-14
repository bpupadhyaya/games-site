// All the drawing of Double Dutch: the dusk street, three people, the two ropes, trick icons and particles. Pure canvas.
// World units: x across, h = height above the pavement, z = depth (+ toward the viewer). All lengths are multiples of k, the height
// of a person on screen. The camera looks slightly down: screen y = ground + z * ELEV - h.
import { TRICK_BY_ID } from './moves.js';

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", system-ui, sans-serif';
export const BODY = '"Barlow", "Helvetica Neue", system-ui, sans-serif';
export const PAL = {
  text: '#fff4e4', dim: 'rgba(255,244,228,0.72)', gold: '#ffc83d', orange: '#ff8a1f', hot: '#ff3fa4', mint: '#3ee8b5', sky: '#35d0ff',
  plum: '#1a0f33', plumDeep: '#0f0720', ropeA: '#ffb21f', ropeB: '#38d6ff', bad: '#ff5a5f', good: '#7be26a',
};
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
export const ELEV = 0.34;

// ---- geometry of the scene for a given stage rectangle ----------------------------------------------------------------------------
export function stageGeo(r) {
  let k = Math.min(r.h * 0.5, r.w * 0.46);
  let gy = r.y + r.h * 0.78;
  gy = Math.max(gy, r.y + k * 1.32 + 14);                      // room for the rope at its top and a spin
  gy = Math.min(gy, r.y + r.h - k * 0.2 - 8);
  if (gy - k * 1.32 < r.y + 10) k = Math.max(40, (gy - r.y - 10) / 1.32);
  const jx = r.x + r.w / 2;
  const span = Math.min(r.w * 0.42, k * 1.9);                   // how far each turner stands from the middle
  return { r, k, gy, jx, ax: jx - span, bx: jx + span, horizon: gy - k * 0.5, H: 0.52 * k, R: 0.6 * k, za: 0.11 * k };
}

// ---- background: a dusk street -----------------------------------------------------------------------------------------------------
const FACADES = [['#8c3a2c', '#6e2a20'], ['#5d3f78', '#47295f'], ['#2f5e7d', '#1f4560'], ['#a1552f', '#7d3d1f'], ['#3f6b58', '#2c5242'], ['#7a3355', '#5d2340']];
const lit = (i, j, t, w) => ((i * 7 + j * 13) % 5 < 2) && ((Math.floor(t * 0.15 + i * 3 + j) % 7) !== 0 || w);

function windowAt(ctx, x, y, w, h, on) {
  ctx.fillStyle = on ? '#ffd88a' : '#2a1b3d'; ctx.fillRect(x, y, w, h);
  if (on) { ctx.fillStyle = 'rgba(255,200,110,0.35)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.fillStyle = '#ffe9b8'; ctx.fillRect(x, y, w, h * 0.35); }
  ctx.strokeStyle = 'rgba(20,10,30,0.7)'; ctx.lineWidth = Math.max(1.5, w * 0.08); ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
}

export function drawScene(ctx, W, H, g, t, o = {}) {
  const { k, gy, horizon } = g, pulse = o.pulse ?? 0;
  // sky: indigo to a hot orange band behind the roofs
  const roofLine = horizon - k * 1.85;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#150b38'); sky.addColorStop(0.45, '#4a2377'); sky.addColorStop(0.78, '#d9567f'); sky.addColorStop(1, '#ffb36b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 2);
  // stars and a low moon
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 26; i++) { const sx = ((i * 97) % 100) / 100 * W, sy = ((i * 53) % 100) / 100 * Math.max(10, roofLine - k * 0.5); const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + i); ctx.globalAlpha = 0.25 + 0.5 * tw; ctx.fillRect(sx, sy, 2, 2); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,236,200,0.9)'; ctx.beginPath(); ctx.arc(W * 0.3, Math.max(70, roofLine - k * 0.5), k * 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,236,200,0.1)'; ctx.beginPath(); ctx.arc(W * 0.3, Math.max(70, roofLine - k * 0.5), k * 0.18, 0, TAU); ctx.fill();
  // far skyline
  ctx.fillStyle = '#2a1650';
  for (let i = 0, x = -10; x < W + 40; i++) {
    const bw = k * (0.34 + ((i * 37) % 5) * 0.07), bh = k * (0.55 + ((i * 53) % 7) * 0.16);
    ctx.fillRect(x, horizon - k * 0.15 - bh, bw, bh + k * 0.2);
    ctx.fillStyle = 'rgba(255,210,120,0.55)';
    for (let wy = horizon - k * 0.15 - bh + 8; wy < horizon - k * 0.35; wy += k * 0.14) for (let wx = x + 5; wx < x + bw - 8; wx += k * 0.11) if (lit(i, Math.round(wy), t, false) && (Math.round(wx + wy) % 3 === 0)) ctx.fillRect(wx, wy, 3, 4);
    ctx.fillStyle = '#2a1650';
    x += bw + 4;
  }
  // the row of brownstones (brick facades with windows, doors and stoops), in front of the skyline
  const bw = Math.max(k * 0.95, W / 5.2), baseY = horizon + k * 0.04, top = roofLine - k * 0.15;
  const n = Math.ceil(W / bw) + 1, off = -((bw * 0.35) % bw);
  for (let i = 0; i < n; i++) {
    const x = off + i * bw, [c1, c2] = FACADES[(i * 5 + 2) % FACADES.length], ht = baseY - (top + ((i * 31) % 4) * k * 0.12);
    const y = baseY - ht;
    const gr = ctx.createLinearGradient(x, y, x + bw, y); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    ctx.fillStyle = gr; ctx.fillRect(x, y, bw - 2, ht);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + bw - 2 - k * 0.04, y, k * 0.04, ht);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y, bw - 2, k * 0.05);              // cornice
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + k * 0.05, bw - 2, k * 0.04);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let by = y + k * 0.16; by < baseY; by += k * 0.07) { ctx.moveTo(x, by); ctx.lineTo(x + bw - 2, by); }
    ctx.stroke();
    // windows in two columns, three rows
    const ww = bw * 0.2, wh = k * 0.26;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
      const wx = x + bw * (0.17 + col * 0.45), wy = y + k * 0.2 + row * (wh + k * 0.16);
      if (wy + wh > baseY - k * 0.5) continue;
      windowAt(ctx, wx, wy, ww, wh, lit(i, row * 2 + col, t, (i + row) % 3 === 0));
    }
    // front door and stoop
    const dw = bw * 0.2, dx = x + bw * 0.4, dh = k * 0.42;
    ctx.fillStyle = '#2a1736'; ctx.fillRect(dx, baseY - dh, dw, dh);
    ctx.fillStyle = 'rgba(255,200,110,0.55)'; ctx.fillRect(dx + 3, baseY - dh + 3, dw - 6, dh * 0.3);
    for (let s = 0; s < 3; s++) { ctx.fillStyle = s % 2 ? '#a79bb3' : '#c4bacf'; ctx.fillRect(dx - dw * 0.35 - s * 4, baseY - (s + 1) * k * 0.05, dw * 1.7 + s * 8, k * 0.05); }
    // fire escape on every third house
    if (i % 3 === 1) {
      ctx.strokeStyle = 'rgba(15,8,28,0.9)'; ctx.lineWidth = Math.max(2, k * 0.012);
      for (let f = 0; f < 2; f++) {
        const fy = y + k * 0.62 + f * k * 0.5, fx = x + bw * 0.1, fw = bw * 0.78;
        ctx.strokeRect(fx, fy, fw, k * 0.05);
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - k * 0.18); ctx.moveTo(fx + fw, fy); ctx.lineTo(fx + fw, fy - k * 0.18); ctx.moveTo(fx, fy - k * 0.18); ctx.lineTo(fx + fw, fy - k * 0.18);
        ctx.moveTo(fx + fw * 0.2, fy + k * 0.05); ctx.lineTo(fx + fw * 0.8, fy + k * 0.5); ctx.stroke();
      }
    }
  }
  // pavement: concrete slabs with perspective seams and painted chalk
  const gr = ctx.createLinearGradient(0, horizon, 0, H);
  gr.addColorStop(0, '#6c5a86'); gr.addColorStop(0.35, '#53426e'); gr.addColorStop(1, '#2f2145');
  ctx.fillStyle = gr; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.save(); ctx.beginPath(); ctx.rect(0, horizon, W, H - horizon); ctx.clip();
  ctx.strokeStyle = 'rgba(10,4,22,0.35)'; ctx.lineWidth = 1.5;
  const vx = g.jx, rows = 6;
  ctx.beginPath();
  for (let i = 0; i <= rows; i++) { const yy = horizon + (H - horizon) * Math.pow(i / rows, 1.7); ctx.moveTo(0, yy); ctx.lineTo(W, yy); }
  for (let i = -8; i <= 8; i++) { ctx.moveTo(vx + i * k * 0.12, horizon); ctx.lineTo(vx + i * k * 0.95, H); }
  ctx.stroke();
  // curb light and the pool of lamp light around the turners and jumper
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, horizon, W, 3);
  const lg = ctx.createRadialGradient(g.jx, gy + k * 0.05, k * 0.2, g.jx, gy + k * 0.05, Math.max(W * 0.5, k * 1.8));
  lg.addColorStop(0, 'rgba(255,200,120,0.38)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, horizon, W, H - horizon);
  // chalk: a hopscotch ladder and a ring, in perspective
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(2, k * 0.012); ctx.lineCap = 'round';
  const hx = g.jx - k * 1.45, hy0 = gy + k * 0.06;
  for (let i = 0; i < 4; i++) { const yy = hy0 + i * k * 0.1, w = k * (0.34 + i * 0.05); ctx.strokeRect(hx - w / 2, yy, w, k * 0.1); }
  ctx.beginPath(); ctx.ellipse(g.jx + k * 1.25, gy + k * 0.16, k * 0.4, k * 0.1, 0, 0, TAU); ctx.stroke();
  ctx.restore();

  // string lights across the street, bulbs pulsing with the beat
  const yL = Math.max(18, roofLine - k * 0.04);
  ctx.strokeStyle = 'rgba(20,10,32,0.9)'; ctx.lineWidth = 2; ctx.beginPath();
  const sag = k * 0.16, nb = Math.max(8, Math.round(W / (k * 0.34)));
  const cable = (u) => ({ x: u * W, y: yL + Math.sin(Math.PI * ((u * 2.5) % 1)) * sag });
  for (let s = 0; s <= 60; s++) { const p = cable(s / 60); if (s) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
  ctx.stroke();
  const bc = ['#ffd23f', '#ff3fa4', '#35d0ff', '#7be26a', '#ff8a1f'];
  for (let i = 0; i < nb; i++) {
    const p = cable((i + 0.5) / nb), c = bc[i % bc.length], on = 0.7 + 0.3 * Math.sin(t * 3 + i) + pulse * 0.5;
    ctx.fillStyle = rgba(c, 0.22 * on); ctx.beginPath(); ctx.arc(p.x, p.y + 6, k * 0.055, 0, TAU); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y + 6, Math.max(3, k * 0.02), 0, TAU); ctx.fill();
  }
  // streetlamp on the right
  const lx = Math.min(W - 24, g.bx + k * 0.9), lt = horizon - k * 1.55;
  ctx.fillStyle = '#17102b'; ctx.fillRect(lx - 3, lt, 6, horizon - lt + k * 0.35);
  ctx.fillStyle = 'rgba(255,214,140,0.14)'; ctx.beginPath(); ctx.arc(lx, lt, k * 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe2a8'; ctx.beginPath(); ctx.arc(lx, lt, k * 0.07, 0, TAU); ctx.fill();
  // vignette
  const vg = ctx.createRadialGradient(W / 2, gy - k * 0.5, k * 0.9, W / 2, gy - k * 0.5, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(10,4,24,0)'); vg.addColorStop(1, `rgba(10,4,24,${o.vignette ?? 0.45})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// A boombox on the curb: the speakers pulse with the beat. Drawn in front of the scene.
export function drawBoombox(ctx, x, y, s, pulse) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.62, s * 0.12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a2140'; ctx.beginPath(); ctx.roundRect(-s * 0.55, -s * 0.28, s * 1.1, s * 0.56, s * 0.08); ctx.fill();
  ctx.strokeStyle = '#8a7ab0'; ctx.lineWidth = Math.max(2, s * 0.04); ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.28); ctx.lineTo(-s * 0.3, -s * 0.46); ctx.lineTo(s * 0.3, -s * 0.46); ctx.lineTo(s * 0.3, -s * 0.28); ctx.stroke();
  for (const sx of [-0.3, 0.3]) {
    const r = s * (0.19 + 0.025 * pulse);
    ctx.fillStyle = '#120b22'; ctx.beginPath(); ctx.arc(sx * s, 0, s * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = pulse > 0.3 ? '#ff6bbd' : '#b04a86'; ctx.beginPath(); ctx.arc(sx * s, 0, r * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = '#251a3c'; ctx.beginPath(); ctx.arc(sx * s, 0, r * 0.22, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#ffc83d'; ctx.fillRect(-s * 0.12, -s * 0.12, s * 0.24, s * 0.08);
  ctx.fillStyle = '#35d0ff'; ctx.fillRect(-s * 0.12, s * 0.02, s * 0.24 * (0.4 + 0.6 * pulse), s * 0.05);
  ctx.restore();
}

// ---- people --------------------------------------------------------------------------------------------------------------------------
export const PEOPLE = {
  jumper: { skin: '#c98b5e', skinD: '#a36c44', hair: '#1c1210', kind: 'braids', top: '#ff8a1f', topD: '#c85d00', pants: '#26264f', pantsD: '#171735', shoe: '#ffffff', shoeAccent: '#ff3fa4', band: '#ff3fa4' },
  turnerA: { skin: '#f0c19c', skinD: '#d79d76', hair: '#3a2417', kind: 'cap', top: '#35d0ff', topD: '#1d9bc4', pants: '#3b3b55', pantsD: '#26263c', shoe: '#ffd23f', shoeAccent: '#1a0f33', band: '#ffd23f' },
  turnerB: { skin: '#7d4e33', skinD: '#613a24', hair: '#120a08', kind: 'puffs', top: '#ff3fa4', topD: '#c4237c', pants: '#e9e1d2', pantsD: '#bdb4a2', shoe: '#7be26a', shoeAccent: '#ffffff', band: '#7be26a' },
};

// Two-bone IK: the elbow/knee for a chain from (ax,ay) to a target, lengths l1 and l2; `side` picks which way the joint bends.
function ik(ax, ay, tx, ty, l1, l2, sd) {
  const side = typeof sd === 'object' ? sd : { s: sd, k: 1 };
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 1e-6;
  const reach = Math.min(d, (l1 + l2) * 0.999), ux = dx / d, uy = dy / d;
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)) * (side.k ?? 1);
  return { jx: ax + ux * a - uy * h * side.s, jy: ay + uy * a + ux * h * side.s, ex: ax + ux * reach, ey: ay + uy * reach };
}
function limb(ctx, pts, w, col, colD) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = colD; ctx.lineWidth = w * 1.14; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w * 0.88; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - w * 0.04) : ctx.moveTo(p[0], p[1] - w * 0.04))); ctx.stroke();
}

// o: { x, gy, k, lift, crouch, lean, bow, turn (radians), feet:[{dx,dy}x2] (k units, +dx outward, +dy up), arms:[{tx,ty}|{a,b}]x2, look, mouth, shadow }
// Returns joints that callers use (hands for ropes, head for pop-ups).
export function drawPerson(ctx, st, o) {
  const k = o.k, c = Math.cos(o.turn ?? 0), wf = Math.max(0.24, Math.abs(c)), back = c < 0;
  const crouch = o.crouch ?? 0, lift = o.lift ?? 0, bow = o.bow ?? 0, lean = (o.lean ?? 0) * k;
  const L1 = 0.245 * k, L2 = 0.245 * k;
  const hipY = o.gy - (0.5 * k * (1 - 0.34 * crouch)) - lift * k;
  const hipW = 0.062 * k * wf, x0 = o.x;
  const feet = o.feet ?? [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }];
  const foot = [0, 1].map((i) => ({ x: x0 + (i ? 1 : -1) * (0.085 * k * (0.5 + 0.5 * wf) + (feet[i].dx ?? 0) * k), y: o.gy - (feet[i].dy ?? 0) * k - 0.025 * k }));
  const shW = 0.115 * k * wf, shY = hipY - (0.3 * k) * (1 - bow * 0.28), shX = x0 + lean + bow * 0.05 * k;
  const hcx = shX + (bow ? bow * 0.02 * k : 0), headR = 0.072 * k, hcy = shY - 0.055 * k - headR + bow * 0.04 * k;
  // ground shadow
  if (o.shadow !== false) {
    const sh = clamp(1 - lift * 1.4, 0.35, 1);
    ctx.fillStyle = `rgba(8,2,20,${0.38 * sh})`; ctx.beginPath(); ctx.ellipse(x0, o.gy + 0.012 * k, 0.17 * k * (0.7 + 0.3 * sh), 0.045 * k, 0, 0, TAU); ctx.fill();
  }
  // hair behind the head (braids or puffs hang behind)
  if (st.kind === 'braids') {
    ctx.strokeStyle = st.hair; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const sw = (o.sway ?? 0) * s;
      ctx.lineWidth = 0.034 * k; ctx.beginPath(); ctx.moveTo(hcx + s * headR * 0.85, hcy - headR * 0.1);
      ctx.quadraticCurveTo(hcx + s * headR * 1.35 + sw * k, hcy + headR * 1.0, hcx + s * headR * 1.1 + sw * 1.8 * k, hcy + headR * 2.1 + Math.abs(lift) * 0.1 * k); ctx.stroke();
      ctx.fillStyle = st.band; ctx.beginPath(); ctx.arc(hcx + s * headR * 1.1 + sw * 1.8 * k, hcy + headR * 2.1 + Math.abs(lift) * 0.1 * k, 0.022 * k, 0, TAU); ctx.fill();
    }
  }
  // legs: pants then sneaker
  const joints = [0, 1].map((i) => {
    const hx = x0 + (i ? 1 : -1) * hipW, s = i ? 1 : -1;
    const j = ik(hx, hipY, foot[i].x, foot[i].y, L1, L2, { s: -s, k: 0.32 });
    return { hx, ...j };
  });
  const order = back ? [1, 0] : [0, 1];
  for (const i of order) {
    const j = joints[i];
    limb(ctx, [[j.hx, hipY], [j.jx, j.jy], [j.ex, j.ey]], 0.092 * k, st.pants, st.pantsD);
    // sneaker
    const s = i ? 1 : -1, fx = foot[i].x + s * 0.008 * k, fy = foot[i].y + 0.012 * k, tilt = clamp((o.feetTilt ?? 0), -0.5, 0.5);
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(tilt * s);
    ctx.fillStyle = 'rgba(10,4,20,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.026 * k, 0.07 * k, 0.02 * k, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = st.shoe; ctx.beginPath(); ctx.roundRect(-0.062 * k, -0.034 * k, 0.124 * k, 0.062 * k, 0.03 * k); ctx.fill();
    ctx.fillStyle = st.shoeAccent; ctx.fillRect(-0.04 * k, -0.034 * k, 0.05 * k, 0.03 * k);
    ctx.fillStyle = '#2b2236'; ctx.fillRect(-0.062 * k, 0.018 * k, 0.124 * k, 0.014 * k);
    ctx.restore();
  }
  // hips and torso
  ctx.fillStyle = st.pants; ctx.beginPath(); ctx.roundRect(x0 - hipW - 0.04 * k, hipY - 0.045 * k, (hipW + 0.04 * k) * 2, 0.1 * k, 0.04 * k); ctx.fill();
  const tg = ctx.createLinearGradient(shX - shW, 0, shX + shW, 0);
  tg.addColorStop(0, st.top); tg.addColorStop(1, st.topD);
  ctx.fillStyle = tg; ctx.beginPath();
  ctx.moveTo(x0 - hipW - 0.035 * k, hipY - 0.02 * k); ctx.lineTo(x0 + hipW + 0.035 * k, hipY - 0.02 * k);
  ctx.quadraticCurveTo(shX + shW + 0.02 * k, shY + 0.14 * k, shX + shW + 0.012 * k, shY + 0.01 * k);
  ctx.quadraticCurveTo(shX + shW * 0.7, shY - 0.045 * k, shX, shY - 0.05 * k);
  ctx.quadraticCurveTo(shX - shW * 0.7, shY - 0.045 * k, shX - shW - 0.012 * k, shY + 0.01 * k);
  ctx.quadraticCurveTo(shX - shW - 0.02 * k, shY + 0.14 * k, x0 - hipW - 0.035 * k, hipY - 0.02 * k);
  ctx.fill();
  // hoodie details: centre seam, pocket, a stripe
  if (!back) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(1.5, 0.008 * k);
    ctx.beginPath(); ctx.moveTo(shX, shY + 0.02 * k); ctx.lineTo(x0, hipY - 0.03 * k); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x0 - hipW * 1.05, hipY - 0.12 * k, hipW * 2.1, 0.022 * k);
  } else { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(shX, shY + 0.07 * k, shW * 0.8, 0.07 * k, 0, 0, TAU); ctx.fill(); }
  // arms
  const arms = o.arms ?? [{ a: 0.2 }, { a: 0.2 }];
  const hands = [0, 1].map((i) => {
    const s = i ? 1 : -1, sx = shX + s * (shW + 0.008 * k), sy = shY + 0.025 * k, A = arms[i];
    let tx, ty;
    if (A.tx !== undefined) { tx = A.tx; ty = A.ty; }
    else { const a = (A.a ?? 0.2), len = 0.3 * k * (A.len ?? 0.96); tx = sx + s * Math.sin(a) * len; ty = sy + Math.cos(a) * len; }
    const j = ik(sx, sy, tx, ty, 0.165 * k, 0.15 * k, { s: Math.sign(s * (A.bend ?? 1)) || s, k: 0.7 });
    return { sx, sy, ...j, tx, ty };
  });
  for (const i of back ? [1, 0] : [0, 1]) {
    const h = hands[i];
    limb(ctx, [[h.sx, h.sy], [h.jx, h.jy]], 0.075 * k, st.top, st.topD);
    limb(ctx, [[h.jx, h.jy], [h.ex, h.ey]], 0.058 * k, st.skin, st.skinD);
    ctx.fillStyle = st.skin; ctx.beginPath(); ctx.arc(h.ex, h.ey, 0.034 * k, 0, TAU); ctx.fill();
  }
  // neck, head
  ctx.fillStyle = st.skinD; ctx.fillRect(hcx - 0.026 * k, shY - 0.09 * k, 0.052 * k, 0.07 * k);
  ctx.fillStyle = st.skin; ctx.beginPath(); ctx.ellipse(hcx, hcy, headR * (0.92 + 0.08 * wf), headR * 1.06, 0, 0, TAU); ctx.fill();
  // hair
  ctx.fillStyle = st.hair;
  if (st.kind === 'puffs') {
    ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.12, headR * 1.08, Math.PI * 0.95, TAU + 0.15); ctx.fill();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hcx + s * headR * 0.98, hcy - headR * 0.82, headR * 0.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = st.band; ctx.fillRect(hcx - headR * 0.98, hcy - headR * 0.62, headR * 1.96, headR * 0.16);
  } else if (st.kind === 'cap') {
    ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.08, headR * 1.04, Math.PI * 0.96, TAU + 0.1); ctx.fill();
    ctx.fillStyle = st.band; ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.18, headR * 1.1, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#e8b21a'; ctx.beginPath(); ctx.ellipse(hcx + (back ? 0 : headR * 0.15), hcy - headR * 0.28, headR * 1.15, headR * 0.2, 0, 0, TAU); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.12, headR * 1.08, Math.PI * 0.95, TAU + 0.15); ctx.fill();
    ctx.fillStyle = st.band; ctx.fillRect(hcx - headR * 1.0, hcy - headR * 0.66, headR * 2.0, headR * 0.17);
  }
  if (back) { ctx.fillStyle = st.hair; ctx.beginPath(); ctx.ellipse(hcx, hcy + headR * 0.1, headR * 0.98, headR * 1.02, 0, 0, TAU); ctx.fill(); }
  else {
    const lx = (o.look ?? 0) * headR * 0.2, m = o.mouth ?? 0;
    ctx.fillStyle = '#1d1220';
    ctx.beginPath(); ctx.ellipse(hcx - headR * 0.37 + lx, hcy + headR * 0.08, headR * 0.1, headR * 0.15, 0, 0, TAU); ctx.ellipse(hcx + headR * 0.37 + lx, hcy + headR * 0.08, headR * 0.1, headR * 0.15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,14,20,0.8)'; ctx.lineWidth = Math.max(1.2, 0.009 * k); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hcx - headR * 0.55 + lx, hcy - headR * 0.18); ctx.lineTo(hcx - headR * 0.2 + lx, hcy - headR * 0.24); ctx.moveTo(hcx + headR * 0.2 + lx, hcy - headR * 0.24); ctx.lineTo(hcx + headR * 0.55 + lx, hcy - headR * 0.18); ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,110,0.22)'; ctx.beginPath(); ctx.arc(hcx - headR * 0.62, hcy + headR * 0.42, headR * 0.17, 0, TAU); ctx.arc(hcx + headR * 0.62, hcy + headR * 0.42, headR * 0.17, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b2a2a'; ctx.fillStyle = '#6b2a2a';
    if (m > 0.3) { ctx.beginPath(); ctx.ellipse(hcx + lx, hcy + headR * 0.52, headR * 0.24, headR * 0.15 * m, 0, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(hcx + lx, hcy + headR * 0.3, headR * 0.28, 0.25, Math.PI - 0.25); ctx.stroke(); }
  }
  return { hcx, hcy, headR, hands, hipY, shX, shY, foot };
}

// ---- the ropes -----------------------------------------------------------------------------------------------------------------------
// Where a rope's handle is for a turner at `x` with the rope at angle th (0 = top). Returns screen {x, y, z}.
export function handleOf(g, which, th, side) {
  const za = which === 'A' ? g.za : -g.za, r = 0.055 * g.k, hx = side < 0 ? g.ax : g.bx;
  const h = g.H + r * Math.cos(th), z = za + r * Math.sin(th);
  return { x: hx + (side < 0 ? 0.27 : -0.27) * g.k, y: g.gy + z * ELEV - h, z };
}

// th: rope angle, 0 over the head, PI on the ground. Draws the whole rope, with its ground shadow. frontOnly/backOnly split the
// pass so the jumper can be painted between them.
export function ropePoints(g, which, th) {
  const za = which === 'A' ? g.za : -g.za, k = g.k, N = 30, pts = [];
  const xl = g.ax + 0.27 * k, xr = g.bx - 0.27 * k, r = 0.055 * k;
  for (let i = 0; i <= N; i++) {
    const u = i / N, s = Math.pow(Math.sin(Math.PI * u), 0.72);
    const rad = r + (g.R - r) * s;
    let h = g.H + rad * Math.cos(th), z = za + rad * Math.sin(th);
    const hit = h < 0.012 * k;
    if (hit) h = 0.012 * k;
    pts.push({ x: lerp(xl, xr, u), y: g.gy + z * ELEV - h, z, floor: hit, gy: g.gy + z * ELEV, u });
  }
  return pts;
}
export function zMid(g, which, th) {
  const za = which === 'A' ? g.za : -g.za;
  return za + g.R * Math.sin(th);
}
export function drawRope(ctx, g, which, th, o = {}) {
  const pts = ropePoints(g, which, th), k = g.k, col = which === 'A' ? PAL.ropeA : PAL.ropeB, colD = which === 'A' ? '#b86b00' : '#1b8fb8';
  const zm = pts[Math.floor(pts.length / 2)].z, near = 1 + clamp(zm / (k * 4), -0.2, 0.25);
  const w = Math.max(3.5, 0.03 * k * near);
  // shadow on the pavement
  ctx.strokeStyle = 'rgba(6,2,16,0.32)'; ctx.lineWidth = w * 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + 3, p.gy + 4) : ctx.moveTo(p.x + 3, p.gy + 4))); ctx.stroke();
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); };
  ctx.strokeStyle = colD; ctx.lineWidth = w * 1.18; path(); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w * 0.86; path(); ctx.stroke();
  ctx.setLineDash([w * 0.5, w * 1.7]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = w * 0.45; path(); ctx.stroke(); ctx.setLineDash([]);
  if (o.glow) { ctx.strokeStyle = rgba(col, 0.35 * o.glow); ctx.lineWidth = w * 3; path(); ctx.stroke(); }
}

// ---- icons -----------------------------------------------------------------------------------------------------------------------------
function arrow(ctx, dir, cx, cy, s, col) {
  const a = { up: -Math.PI / 2, left: Math.PI, right: 0, down: Math.PI / 2 }[dir];
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(3, s * 0.15); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(s * 0.1, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.46, 0); ctx.lineTo(s * 0.04, -s * 0.3); ctx.lineTo(s * 0.04, s * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// A trick call: a rounded tile in the trick's colour with its swipe arrow.
export function drawTrickIcon(ctx, id, cx, cy, size, o = {}) {
  const T = TRICK_BY_ID[id];
  ctx.save();
  if (o.bg !== false) { ctx.fillStyle = o.fill ?? T.col; ctx.beginPath(); ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.24); ctx.fill(); }
  arrow(ctx, T.dir, cx, cy, size * 0.62, o.arrow ?? '#1a0f33');
  ctx.restore();
}
export function drawStars(ctx, cx, cy, size, n, max = 3) {
  for (let i = 0; i < max; i++) {
    const x = cx + (i - (max - 1) / 2) * size * 1.15, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let p = 0; p < 10; p++) { const r = p % 2 ? size * 0.22 : size * 0.5, a = -Math.PI / 2 + (p * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = on ? PAL.gold : 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.06); ctx.lineJoin = 'round'; ctx.strokeStyle = on ? '#b8860b' : 'rgba(255,255,255,0.28)'; ctx.stroke();
    ctx.restore();
  }
}
// A coiled rope: the lives counter.
export function drawCoil(ctx, cx, cy, s, on) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = on ? PAL.ropeA : 'rgba(255,255,255,0.2)'; ctx.lineWidth = Math.max(3, s * 0.13); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, i * s * 0.1 - s * 0.05, s * 0.42 - i * s * 0.05, s * 0.2 - i * s * 0.02, 0, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = on ? PAL.ropeB : 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(s * 0.35, -s * 0.05); ctx.quadraticCurveTo(s * 0.55, -s * 0.3, s * 0.4, -s * 0.42); ctx.stroke();
  ctx.restore();
}
// A pass marker for the rope strip and the routine sheet: a disc in the rope's colour, ringed when it carries a call.
export function drawPassDot(ctx, p, cx, cy, size, o = {}) {
  const col = p.rope === 'A' ? PAL.ropeA : PAL.ropeB;
  ctx.save();
  if (p.call) { drawTrickIcon(ctx, p.call, cx, cy, size * 1.04); ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, size * 0.1); ctx.beginPath(); ctx.roundRect(cx - size * 0.56, cy - size * 0.56, size * 1.12, size * 1.12, size * 0.28); ctx.stroke(); }
  else {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, size * (p.pepper ? 0.3 : 0.38), 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(cx - size * 0.1, cy - size * 0.1, size * 0.1, 0, TAU); ctx.fill();
  }
  if (o.label) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(11, size * 0.3)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.label, cx, cy + size * 0.78); }
  ctx.restore();
}

// ---- particles -----------------------------------------------------------------------------------------------------------------------
const SPARK = ['#ffc83d', '#ff3fa4', '#35d0ff', '#7be26a', '#ff8a1f'];
export function burst(parts, rng, x, y, n, power = 1, kind = 'spark') {
  for (let i = 0; i < n; i++) {
    const a = rng.range(-Math.PI * 0.95, -Math.PI * 0.05), v = rng.range(90, 300) * power;
    parts.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rng.range(3, 7), life: rng.range(0.5, 1.0), age: 0, col: kind === 'dust' ? '#d9c9ee' : rng.pick(SPARK), rot: rng.range(0, TAU), spin: rng.range(-8, 8) });
  }
  if (parts.length > 140) parts.splice(0, parts.length - 140);
}
export function dust(parts, rng, x, y, n, spread) {
  for (let i = 0; i < n; i++) {
    parts.push({ kind: 'dust', x: x + rng.range(-spread, spread), y, vx: rng.range(-60, 60), vy: rng.range(-70, -15), r: rng.range(4, 9), life: rng.range(0.35, 0.7), age: 0, col: '#e3d4f5', rot: 0, spin: 0 });
  }
  if (parts.length > 140) parts.splice(0, parts.length - 140);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.vy += (p.kind === 'dust' ? 60 : 520) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = clamp(1 - p.age / p.life, 0, 1);
    ctx.save(); ctx.globalAlpha = p.kind === 'dust' ? a * 0.55 : a; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
    if (p.kind === 'dust') { ctx.beginPath(); ctx.arc(0, 0, p.r * (1 + (1 - a) * 0.8), 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); for (let q = 0; q < 8; q++) { const r = q % 2 ? p.r * 0.45 : p.r * 1.2, an = (q * Math.PI) / 4; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}
