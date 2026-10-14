// Log Rolling: all the drawing of the world (sky, water, the log, the two birlers, splashes). Pure drawing: it reads the
// world from sim.js and never changes it. Scene units: 1000 x 560, water line at y = 330, log top at about y = 262.
import { SCENE } from './layout.js';

// The 3D layer (web/view3d) fills gl in each frame when it is drawing the scene: { on, project, sr, ... } or null. band/world: what to draw this frame.
export const glState = { gl: null, lic: '', band: null, world: null };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const WL = SCENE.wl;
export const LOG = { cx: 500, cy: 322, len: 700, r: 62, top: 262 };
export const SPOT = [310, 690];                 // x of the two birlers' feet
export const HIT_T = 0.78;                      // seconds from losing balance to the water

export const THEMES = [
  { key: 'pond', name: 'Mill Pond', sky: ['#ffe2b0', '#ffc2a0', '#9fc6e0'], sun: { x: 0.74, y: 0.24, r: 54, c: '#fff4cc' }, far: '#8da3b4', mid: '#5c7a6c', near: '#34503f', water: ['#8cc1d2', '#3b7592'], light: '#fff2d0', fog: 'rgba(255,226,190,0.35)' },
  { key: 'river', name: 'Cedar River', sky: ['#7cc2ee', '#b8e0f6', '#e6f4fa'], sun: { x: 0.2, y: 0.18, r: 44, c: '#ffffff' }, far: '#7f9fb4', mid: '#4a7a5a', near: '#2b5236', water: ['#5eb0c8', '#20607c'], light: '#ffffff', fog: 'rgba(230,246,255,0.25)' },
  { key: 'lake', name: 'Lantern Lake', sky: ['#2a2358', '#7a3f78', '#f2985e'], sun: { x: 0.5, y: 0.5, r: 62, c: '#ffd89a' }, far: '#4b3a68', mid: '#2e2a52', near: '#171a38', water: ['#7a5a96', '#1d2250'], light: '#ffd9a0', fog: 'rgba(255,170,110,0.25)' },
  { key: 'rapids', name: 'Spring Rapids', sky: ['#56606c', '#7e8a96', '#aab6bf'], sun: { x: 0.8, y: 0.2, r: 0, c: '#fff' }, far: '#66767e', mid: '#3d5648', near: '#26382e', water: ['#6e8f9a', '#2a4650'], light: '#e8f2f6', fog: 'rgba(200,215,225,0.3)' },
];

// Small deterministic hash noise (no rng: the picture must be a pure function of the world).
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- sky, banks and water (screen space; sr is the scene rect, s pixels per scene unit) ------------------------------------------
export function drawBackdrop(ctx, stage, sr, th, t) {
  const s = sr.s, wy = sr.y + WL * s, x0 = stage.x, x1 = stage.x + stage.w, y0 = stage.y, y1 = stage.y + stage.h;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, stage.w, stage.h); ctx.clip();
  // sky
  const g = ctx.createLinearGradient(0, y0, 0, wy);
  g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(x0, y0, stage.w, wy - y0);
  // sun and its glow
  if (th.sun.r > 0) {
    const sx = x0 + stage.w * th.sun.x, sy = y0 + (wy - y0) * th.sun.y;
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, th.sun.r * s * 4.2); rg.addColorStop(0, 'rgba(255,244,210,0.75)'); rg.addColorStop(1, 'rgba(255,244,210,0)');
    ctx.fillStyle = rg; ctx.fillRect(x0, y0, stage.w, wy - y0);
    ctx.beginPath(); ctx.arc(sx, sy, th.sun.r * s, 0, TAU); ctx.fillStyle = th.sun.c; ctx.fill();
  }
  // clouds drifting slowly
  ctx.fillStyle = th.key === 'lake' ? 'rgba(255,170,160,0.22)' : th.key === 'rapids' ? 'rgba(70,80,90,0.28)' : 'rgba(255,255,255,0.55)';
  for (let k = 0; k < 5; k++) {
    const cx = x0 + ((hash(k + 3) * 1.4 + t * (0.003 + hash(k) * 0.004)) % 1.3 - 0.15) * stage.w, cy = y0 + (wy - y0) * (0.1 + hash(k + 9) * 0.35), w = (90 + hash(k + 20) * 120) * s;
    ctx.beginPath(); ctx.ellipse(cx, cy, w, w * 0.2, 0, 0, TAU); ctx.ellipse(cx - w * 0.4, cy + w * 0.05, w * 0.55, w * 0.16, 0, 0, TAU); ctx.ellipse(cx + w * 0.5, cy + w * 0.04, w * 0.6, w * 0.15, 0, 0, TAU); ctx.fill();
  }
  // far hills, mid trees, near bank (silhouettes)
  const ridge = (col, base, amp, seed, trees) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, wy);
    const step = 14 * s;
    for (let x = x0; x <= x1 + step; x += step) {
      const u = (x - x0) / (stage.w || 1);
      let y = wy - base * s - amp * s * (0.55 * Math.sin(u * 5.1 + seed) + 0.3 * Math.sin(u * 11.7 + seed * 2) + 0.15 * Math.sin(u * 23 + seed * 3));
      if (trees) y -= (hash(Math.floor((x - x0) / step) + seed * 31) > 0.5 ? 1 : 0.35) * trees * s * (0.6 + 0.4 * Math.sin(x * 0.05 + seed));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, wy); ctx.closePath(); ctx.fill();
  };
  ridge(th.far, 74, 38, 1.3, 0);
  ridge(th.mid, 36, 16, 4.1, 26);
  ridge(th.near, 8, 8, 7.7, 14);
  // theme props on the bank
  if (th.key === 'pond') {                      // an old mill with a wheel
    const mx = x0 + stage.w * 0.14, my = wy - 20 * s;
    ctx.fillStyle = '#5a4034'; ctx.fillRect(mx - 46 * s, my - 78 * s, 92 * s, 78 * s);
    ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.moveTo(mx - 56 * s, my - 78 * s); ctx.lineTo(mx, my - 118 * s); ctx.lineTo(mx + 56 * s, my - 78 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,120,0.9)'; ctx.fillRect(mx - 10 * s, my - 56 * s, 20 * s, 22 * s);
    ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(mx + 62 * s, my - 22 * s, 24 * s, 0, TAU); ctx.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + t * 0.5; ctx.beginPath(); ctx.moveTo(mx + 62 * s, my - 22 * s); ctx.lineTo(mx + 62 * s + Math.cos(a) * 24 * s, my - 22 * s + Math.sin(a) * 24 * s); ctx.stroke(); }
  } else if (th.key === 'lake') {                 // strings of lanterns
    ctx.strokeStyle = 'rgba(20,14,40,0.8)'; ctx.lineWidth = 2 * s;
    for (const [ax, bx] of [[0.0, 0.5], [0.5, 1.0]]) {
      const ax_ = x0 + stage.w * ax, bx_ = x0 + stage.w * bx, ay = y0 + (wy - y0) * 0.16, mid = (ax_ + bx_) / 2;
      ctx.beginPath(); ctx.moveTo(ax_, ay); ctx.quadraticCurveTo(mid, ay + 46 * s, bx_, ay); ctx.stroke();
      for (let k = 1; k < 8; k++) {
        const u = k / 8, px = ax_ + (bx_ - ax_) * u, py = ay + 2 * 46 * s * u * (1 - u) * 0.5 * 2 / 2 + 0;
        const yy = ay + (1 - Math.pow(2 * u - 1, 2)) * 23 * s * 2 * 0.5;
        const lg = ctx.createRadialGradient(px, yy + 8 * s, 0, px, yy + 8 * s, 22 * s); lg.addColorStop(0, 'rgba(255,214,130,0.95)'); lg.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = lg; ctx.fillRect(px - 22 * s, yy - 14 * s, 44 * s, 44 * s);
        ctx.fillStyle = k % 2 ? '#ffb347' : '#ff7a59'; ctx.beginPath(); ctx.ellipse(px, yy + 8 * s, 6 * s, 8 * s, 0, 0, TAU); ctx.fill();
        void py;
      }
    }
  } else if (th.key === 'river') {                // big boulders at the bank
    for (let k = 0; k < 5; k++) {
      const bx = x0 + stage.w * (0.04 + k * 0.23 + hash(k + 40) * 0.05), bw = (40 + hash(k + 50) * 40) * s;
      ctx.fillStyle = k % 2 ? '#7b8a90' : '#68777e'; ctx.beginPath(); ctx.ellipse(bx, wy - 2 * s, bw, bw * 0.5, 0, Math.PI, TAU); ctx.fill();
    }
  }
  // water
  const wg = ctx.createLinearGradient(0, wy, 0, y1);
  wg.addColorStop(0, th.water[0]); wg.addColorStop(1, th.water[1]);
  ctx.fillStyle = wg; ctx.fillRect(x0, wy, stage.w, y1 - wy);
  // reflection of the glow
  if (th.sun.r > 0) {
    const sx = x0 + stage.w * th.sun.x;
    for (let k = 0; k < 7; k++) {
      const yy = wy + (6 + k * 15) * s, ww = (80 - k * 6 + Math.sin(t * 1.4 + k) * 10) * s;
      ctx.fillStyle = `rgba(255,236,190,${0.35 - k * 0.04})`; ctx.fillRect(sx - ww / 2, yy, ww, 3.5 * s);
    }
  }
  // wave rows
  const rows = 11;
  for (let k = 0; k < rows; k++) {
    const yy = wy + (10 + k * 22 + k * k * 0.9) * s, amp = (1.8 + k * 0.35) * s, sp = 0.7 + k * 0.08;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 12; x += 12) { const y = yy + Math.sin(x * 0.02 / Math.max(0.5, s) + t * sp + k * 1.7) * amp; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(8,24,40,0.16)'; ctx.lineWidth = (1.4 + k * 0.25) * s; ctx.stroke();
  }
  if (th.key === 'rapids') {                      // white water streaks and rain
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 * s;
    for (let k = 0; k < 18; k++) { const xx = x0 + ((hash(k + 60) + t * 0.06 * (1 + hash(k + 70))) % 1) * stage.w, yy = wy + (14 + hash(k + 80) * 190) * s; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + (26 + hash(k) * 30) * s, yy + 1.5 * s); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,235,245,0.4)'; ctx.lineWidth = 1.5 * s;
    for (let k = 0; k < 60; k++) { const xx = x0 + hash(k + 90) * stage.w, yy = y0 + ((hash(k + 120) + t * 1.7) % 1) * (y1 - y0); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 6 * s, yy + 20 * s); ctx.stroke(); }
  }
  // haze at the horizon
  const hz = ctx.createLinearGradient(0, wy - 26 * s, 0, wy + 26 * s); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(0.5, th.fog); hz.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hz; ctx.fillRect(x0, wy - 26 * s, stage.w, 52 * s);
  ctx.restore();
}

// ---- the log (scene units) ---------------------------------------------------------------------------------------------------
// th is the spin angle in turns of the picture (any number); shows grooves rolling and a barber-pole of paint.
export function drawLog(ctx, w, t) {
  const L = LOG, x0 = L.cx - L.len / 2, x1 = L.cx + L.len / 2, R = L.r, cy = L.cy, ang = w.th * 2.2;
  ctx.save();
  // shadow on the water
  ctx.fillStyle = 'rgba(6,20,34,0.28)'; ctx.beginPath(); ctx.ellipse(L.cx, WL + 6, L.len / 2 + 20, 16, 0, 0, TAU); ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  g.addColorStop(0, '#d8a46a'); g.addColorStop(0.28, '#b9803f'); g.addColorStop(0.62, '#7d5226'); g.addColorStop(1, '#3c240f');
  ctx.beginPath(); ctx.moveTo(x0 + 10, cy - R); ctx.lineTo(x1 - 10, cy - R); ctx.quadraticCurveTo(x1 + 8, cy, x1 - 10, cy + R); ctx.lineTo(x0 + 10, cy + R); ctx.quadraticCurveTo(x0 - 8, cy, x0 + 10, cy - R); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // grooves of the bark, moving vertically as the log turns
  for (let k = 0; k < 16; k++) {
    const a = ang + k * TAU / 16 + hash(k) * 0.12, c = Math.cos(a);
    if (c < 0.06) continue;
    const y = cy + Math.sin(a) * R;
    ctx.strokeStyle = `rgba(36,20,8,${0.22 + 0.4 * c})`; ctx.lineWidth = 1 + 2.4 * c;
    ctx.beginPath(); ctx.moveTo(x0, y); for (let x = x0; x <= x1; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.03 + k) * 1.4); ctx.stroke();
  }
  // paint stripes: two spirals (cream and red) that travel along the log as it turns
  const pole = (offset, col, wid) => {
    for (let pass = 0; pass < 1; pass++) {
      let open = false;
      ctx.strokeStyle = col;
      for (let x = x0; x <= x1; x += 6) {
        const a = ang * 1.0 + (x - x0) * 0.018 + offset, c = Math.cos(a);
        if (c <= 0.04) { if (open) ctx.stroke(); open = false; continue; }
        const y = cy + Math.sin(a) * R;
        ctx.lineWidth = wid * (0.4 + 0.8 * c);
        if (!open) { ctx.beginPath(); ctx.moveTo(x, y); open = true; } else ctx.lineTo(x, y);
      }
      if (open) ctx.stroke();
    }
  };
  ctx.lineCap = 'butt';
  pole(0, 'rgba(250,240,214,0.92)', 15); pole(Math.PI, 'rgba(196,52,40,0.9)', 15);
  // knots
  for (let k = 0; k < 4; k++) {
    const a = ang * 1.0 + k * 1.7 + 0.4, c = Math.cos(a); if (c < 0.2) continue;
    const kx = x0 + 90 + k * 170 + hash(k + 5) * 30, ky = cy + Math.sin(a) * R * 0.92;
    ctx.fillStyle = 'rgba(50,28,10,0.8)'; ctx.beginPath(); ctx.ellipse(kx, ky, 13 * c, 9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(210,160,100,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(kx, ky, 8 * c, 5, 0, 0, TAU); ctx.stroke();
  }
  // soft light on the top
  const hl = ctx.createLinearGradient(0, cy - R, 0, cy - R * 0.3); hl.addColorStop(0, 'rgba(255,236,200,0.5)'); hl.addColorStop(1, 'rgba(255,236,200,0)');
  ctx.fillStyle = hl; ctx.fillRect(x0, cy - R, L.len, R * 0.7);
  ctx.restore();
  // end grain at the left end
  ctx.save(); ctx.translate(x0 + 2, cy); ctx.fillStyle = '#e6c08a'; ctx.beginPath(); ctx.ellipse(0, 0, 13, R * 0.94, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(110,70,30,0.6)'; ctx.lineWidth = 2; for (const k of [0.8, 0.55, 0.3]) { ctx.beginPath(); ctx.ellipse(0, 0, 13 * k, R * 0.94 * k, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

// The water in front of the log: tint, foam on the waterline and little rings round the ends.
export function drawLogWater(ctx, w, th, t) {
  const L = LOG, x0 = L.cx - L.len / 2 - 40, x1 = L.cx + L.len / 2 + 40;
  ctx.save();
  const g = ctx.createLinearGradient(0, WL, 0, WL + 90); g.addColorStop(0, th.water[0] + 'bb'); g.addColorStop(1, th.water[1] + '00');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x0, WL);
  for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, WL + Math.sin(x * 0.045 + t * 2.1) * 2.2 + Math.sin(x * 0.11 - t * 3.3) * 1);
  ctx.ellipse((x0 + x1) / 2, WL, (x1 - x0) / 2, 90, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  // foam, livelier when the log spins fast
  const sp = clamp(Math.abs(w.v), 0, 1);
  ctx.strokeStyle = `rgba(255,255,255,${0.45 + sp * 0.35})`; ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = x0 + 30; x <= x1 - 30; x += 8) { const y = WL + Math.sin(x * 0.07 + t * 3) * (1.2 + sp * 2.4); if (x === x0 + 30) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const u = (t * 0.5 + k / 3) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - u)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x0 + 42, WL + 10, 14 + u * 60, 5 + u * 14, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x1 - 42, WL + 10, 14 + u * 60, 5 + u * 14, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ---- the people ---------------------------------------------------------------------------------------------------------------
export const LOOKS = [
  { name: 'You', shirt: ['#b3261e', '#1c1214'], pants: '#27406a', skin: '#e0ac84', hair: '#4a2c18', hat: 'toque', hatCol: '#f08a1a', beard: false, long: false },
  { name: 'Ada', shirt: ['#2f7a4a', '#14301f'], pants: '#3a3a44', skin: '#f0c4a0', hair: '#6a3a1c', hat: 'none', hatCol: '#000', beard: false, long: true },
  { name: 'Jonas', shirt: ['#2c5aa8', '#e6ecf4'], pants: '#5a4a34', skin: '#d6a07a', hair: '#2a1a10', hat: 'cap', hatCol: '#2a6a5a', beard: true, long: false },
  { name: 'Mae', shirt: ['#e0b324', '#4a3410'], pants: '#2e2e3c', skin: '#a8714c', hair: '#1c1010', hat: 'none', hatCol: '#000', beard: false, long: true },
  { name: 'Tobias', shirt: ['#3a3a42', '#9a2a22'], pants: '#1e2230', skin: '#c99a78', hair: '#8a8a8a', hat: 'cap', hatCol: '#b3261e', beard: true, long: false },
];
const lookFor = (i, w) => LOOKS[i === 0 ? 0 : 1 + clamp(w.rival, 0, 3)];

function ik(hx, hy, fx, fy, l1, l2, dir) {
  const dx = fx - hx, dy = fy - hy;
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = hx + (dx * a) / (Math.hypot(dx, dy) || 1), my = hy + (dy * a) / (Math.hypot(dx, dy) || 1);
  const px = -dy / (Math.hypot(dx, dy) || 1), py = dx / (Math.hypot(dx, dy) || 1);
  return { x: mx + px * h * dir, y: my + py * h * dir };
}
function limb(ctx, pts, wid, col, edge = 'rgba(20,10,6,0.85)') {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.strokeStyle = edge; ctx.lineWidth = wid + 3.2; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = wid; ctx.stroke();
}

// Draws one birler with feet at (0,0) in local space facing +x. o: { lean (local, + toward the facing way), ph, speed, t, cheer, flail }
function figure(ctx, look, o) {
  const lean = clamp(o.lean, -1.3, 1.3), ph = o.ph, flail = o.flail || 0;
  const al = lean * 0.42;                                    // torso angle in radians (+ forward)
  const L1 = 47, L2 = 45, hipY = -(L1 + L2) * (0.93 - Math.min(0.12, Math.abs(lean) * 0.1)) + Math.abs(Math.sin(ph * 2)) * 2.2 * clamp(o.speed, 0, 1);
  const stride = 26 * (0.35 + 0.65 * clamp(Math.abs(o.speed), 0, 1)) + (o.cheer ? 0 : 0);
  const foot = (p) => ({ x: Math.sin(p) * stride + (o.speed < 0 ? 0 : 0), y: -Math.max(0, Math.cos(p)) * 10 * clamp(Math.abs(o.speed) * 1.4, 0.15, 1) });
  const fa = foot(ph), fb = foot(ph + Math.PI);
  const hip = { x: -Math.sin(al) * 0 + lean * -6, y: hipY };
  // far leg first
  const legCol = look.pants, boot = '#2a1a10';
  const kneeB = ik(hip.x, hip.y, fb.x, fb.y, L1, L2, -1), kneeA = ik(hip.x, hip.y, fa.x, fa.y, L1, L2, -1);
  const drawLeg = (knee, f, dark) => {
    limb(ctx, [hip, knee, f], 15, dark ? shade(legCol, -0.25) : legCol);
    ctx.fillStyle = boot; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(f.x + 6, f.y - 5, 15, 7, -0.05, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9b48a'; ctx.fillRect(f.x - 9, f.y - 1.5, 30, 3);
  };
  // arms are drawn relative to the shoulder in the rotated torso frame
  const arm = (side, front) => {
    const base = (front ? 1.05 : -0.95) + lean * (front ? -0.35 : -0.5) + Math.sin(o.t * 7 + (front ? 0 : 2)) * 0.12 * (0.4 + Math.abs(lean)) + flail * (front ? 1.2 : -1.2) * Math.sin(o.t * 14 + (front ? 0 : 1.6));
    const raise = o.cheer ? (front ? 2.6 : -2.6) : base;
    const e = { x: Math.sin(raise) * 33, y: -Math.cos(raise) * -33 * -1 };
    // angle 0 = hanging down, + toward the front
    const ex = Math.sin(raise) * 33, ey = Math.cos(raise) * 33;
    const fr = raise + (front ? -0.55 : 0.55) * (o.cheer ? 0.4 : 1), hx = ex + Math.sin(fr) * 31, hy = ey + Math.cos(fr) * 31;
    void e; void side;
    return [{ x: 0, y: 0 }, { x: ex, y: ey }, { x: hx, y: hy }];
  };
  const sleeve = look.shirt[0], skin = look.skin;
  drawLeg(kneeB, fb, true);
  // torso + head in the rotated frame
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(al);
  const sh = { x: 0, y: -60 };
  // back arm
  ctx.save(); ctx.translate(sh.x, sh.y);
  const ab = arm(0, false); limb(ctx, ab.slice(0, 2), 12, shade(sleeve, -0.2)); limb(ctx, ab.slice(1), 10, skin); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(ab[2].x, ab[2].y, 6, 0, TAU); ctx.fill();
  ctx.restore();
  // torso
  ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(-17, -58); ctx.quadraticCurveTo(0, -70, 17, -58); ctx.lineTo(15, -2); ctx.quadraticCurveTo(0, 6, -15, -2); ctx.closePath();
  ctx.fillStyle = sleeve; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = look.shirt[1];                      // plaid
  for (let k = -3; k < 4; k++) { ctx.globalAlpha = 0.55; ctx.fillRect(k * 10 - 3, -72, 6, 80); }
  for (let k = 0; k < 8; k++) { ctx.globalAlpha = 0.5; ctx.fillRect(-20, -66 + k * 10, 40, 5); }
  ctx.globalAlpha = 1;
  const sg = ctx.createLinearGradient(-17, 0, 17, 0); sg.addColorStop(0, 'rgba(255,255,255,0.18)'); sg.addColorStop(0.55, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = sg; ctx.fillRect(-20, -72, 40, 80);
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,10,6,0.85)'; ctx.lineWidth = 2.2; ctx.stroke();
  // suspenders and belt
  ctx.strokeStyle = '#2a2e3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-6, -64); ctx.lineTo(-7, -4); ctx.moveTo(7, -64); ctx.lineTo(8, -4); ctx.stroke();
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(-15, -6, 30, 5);
  // neck + head
  ctx.fillStyle = skin; ctx.fillRect(-4, -72, 9, 12);
  ctx.save(); ctx.translate(2, -88); ctx.rotate(-al * 0.7 + lean * 0.12);
  const hg = ctx.createRadialGradient(-3, -4, 2, 0, 0, 20); hg.addColorStop(0, shade(skin, 0.18)); hg.addColorStop(1, shade(skin, -0.12));
  ctx.fillStyle = hg; ctx.strokeStyle = 'rgba(20,10,6,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 15, 18, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // nose, ear, eye, mouth
  ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(13, -3); ctx.lineTo(20, 4); ctx.lineTo(12, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shade(skin, -0.1); ctx.beginPath(); ctx.ellipse(-4, 2, 3.5, 5, 0, 0, TAU); ctx.fill();
  const scare = Math.abs(lean) > 0.75 || flail > 0;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(7, -4, scare ? 4 : 3.2, scare ? 4.2 : 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(8, -4, scare ? 1.9 : 1.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(4, -9 + (scare ? -1 : 0)); ctx.lineTo(11, -9 + (scare ? -3 : 0)); ctx.stroke();
  ctx.beginPath(); if (scare || o.cheer) ctx.ellipse(9, 11, 3.5, o.cheer ? 2.4 : 3.4, 0, 0, TAU); else { ctx.moveTo(6, 11); ctx.quadraticCurveTo(10, 12, 13, 10); } ctx.stroke();
  if (look.beard) { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(2, 28, 14, 10); ctx.quadraticCurveTo(10, 14, 6, 11); ctx.quadraticCurveTo(-2, 14, -6, 6); ctx.fill(); }
  // hair and hats
  ctx.fillStyle = look.hair;
  ctx.beginPath(); ctx.ellipse(-3, -8, 15, 12, 0, Math.PI * 0.95, TAU * 0.98); ctx.fill();
  if (look.long) { ctx.beginPath(); ctx.moveTo(-12, -6); ctx.quadraticCurveTo(-26, 12, -20, 34 + Math.sin(o.t * 4) * 2); ctx.quadraticCurveTo(-10, 28, -6, 8); ctx.fill(); }
  if (look.hat === 'toque') {
    ctx.fillStyle = look.hatCol; ctx.beginPath(); ctx.ellipse(0, -11, 16.5, 12, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = shade(look.hatCol, -0.25); ctx.fillRect(-16, -12, 32, 6);
    ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(0, -24, 5, 0, TAU); ctx.fill();
  } else if (look.hat === 'cap') {
    ctx.fillStyle = look.hatCol; ctx.beginPath(); ctx.ellipse(0, -10, 16, 11, 0, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(26, -8); ctx.lineTo(24, -5); ctx.lineTo(8, -5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.restore(); // torso frame
  // near leg over the torso bottom
  drawLeg(kneeA, fa, false);
  // front arm last
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(al); ctx.translate(sh.x, sh.y);
  const af = arm(1, true); limb(ctx, af.slice(0, 2), 12.5, sleeve); limb(ctx, af.slice(1), 10.5, skin); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(af[2].x, af[2].y, 6.5, 0, TAU); ctx.fill();
  ctx.restore();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(clamp(k >= 0 ? c + (255 - c) * k : c * (1 + k), 0, 255));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// One birler in the world: standing on the log, slipping, or falling into the water. Scene units.
export function drawBirler(ctx, w, i, t) {
  const look = lookFor(i, w), x0 = SPOT[i], y0 = LOG.top + 2, face = i === 0 ? 1 : -1;
  const lean = w.l[i] * face;                             // + = toward the way it faces
  const falling = w.fell === i && (w.phase === 'fall' || w.phase === 'over');
  const win = w.fell === 1 - i && (w.phase === 'fall' || w.phase === 'over');
  ctx.save();
  if (!falling) {
    const bob = win ? Math.abs(Math.sin(t * 7)) * -7 : 0;
    ctx.translate(x0, y0 + bob); ctx.scale(face, 1);
    // shadow on the log
    ctx.fillStyle = 'rgba(30,16,6,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 5, 0, 0, TAU); ctx.fill();
    figure(ctx, look, { lean: win ? 0 : lean, ph: w.ph[i], speed: win ? 0 : w.f[i] * face, t, cheer: win, flail: 0 });
  } else {
    const ft = w.fallT, d = Math.sign(w.l[i]) || 1;
    const x = x0 + d * (55 * ft + 40 * Math.min(ft, HIT_T)), y = y0 + (-260 * ft + 450 * ft * ft);
    if (y < WL + 40) {
      ctx.translate(x, y); ctx.rotate(d * (1.0 + 3.4 * ft)); ctx.scale(face, 1);
      figure(ctx, look, { lean: d * face * 1.2, ph: ft * 9, speed: 0.7, t, cheer: false, flail: 1 });
    }
  }
  ctx.restore();
  if (falling) {
    const ft = w.fallT, d = Math.sign(w.l[i]) || 1, hx = x0 + d * (55 * HIT_T + 40 * HIT_T);
    if (ft > HIT_T) {
      const s = ft - HIT_T;
      // splash: a column of droplets plus expanding rings, all a function of time
      ctx.save();
      for (let k = 0; k < 22; k++) {
        const a = -Math.PI * (0.12 + 0.76 * hash(k + 7 * i)), sp = 120 + hash(k + 40) * 260, px = hx + Math.cos(a) * sp * s * 0.5, py = WL + 6 + Math.sin(a) * sp * s - 0 + 620 * s * s;
        if (py > WL + 14 || s > 1.1) continue;
        ctx.globalAlpha = clamp(1 - s / 1.0, 0, 1); ctx.fillStyle = '#eaf8ff'; ctx.beginPath(); ctx.arc(px, py, 3 + hash(k + 70) * 3.5, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let r = 0; r < 3; r++) { const u = clamp(s * 0.9 - r * 0.18, 0, 1.2); if (u <= 0) continue; ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - u / 1.2)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(hx, WL + 8, 16 + u * 110, 5 + u * 22, 0, 0, TAU); ctx.stroke(); }
      // a head comes up and bobs
      if (s > 0.55) {
        const up = clamp((s - 0.55) * 2.5, 0, 1), bobY = Math.sin(t * 3 + i) * 2;
        ctx.save(); ctx.translate(hx, WL + 14 + (1 - up) * 26 + bobY);
        ctx.fillStyle = look.skin; ctx.strokeStyle = 'rgba(20,10,6,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -12, 13, 15, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(-1, -17, 13.5, 10, 0, Math.PI, TAU); ctx.fill();
        if (look.hat !== 'none') { ctx.fillStyle = look.hatCol; ctx.beginPath(); ctx.ellipse(0, -21, 14, 8, 0, Math.PI, TAU); ctx.fill(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -13, 2.8, 0, TAU); ctx.arc(5, -13, 2.8, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(-4, -13, 1.3, 0, TAU); ctx.arc(5, -13, 1.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = look.skin; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-17, 2 - Math.sin(t * 5) * 5); ctx.lineTo(-24, -14 - Math.sin(t * 5) * 6); ctx.moveTo(17, 2 + Math.sin(t * 5) * 5); ctx.lineTo(24, -14 + Math.sin(t * 5) * 6); ctx.stroke();
        ctx.fillStyle = 'rgba(180,230,250,0.7)'; ctx.beginPath(); ctx.ellipse(0, 6, 24, 6, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }
}

// ---- small pieces used by the HUD and the pages -------------------------------------------------------------------------------
export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// A little portrait of a birler for the rival list: head and shoulders.
export function drawPortrait(ctx, i, cx, cy, size) {
  const look = i < 0 ? LOOKS[0] : LOOKS[1 + clamp(i, 0, 3)], k = size / 100;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.fillStyle = look.shirt[0]; ctx.beginPath(); ctx.ellipse(0, 52, 36, 26, 0, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = look.shirt[1]; ctx.globalAlpha = 0.5; for (let q = -3; q < 4; q++) ctx.fillRect(q * 10 - 3, 28, 5, 30); ctx.globalAlpha = 1;
  ctx.fillStyle = look.skin; ctx.fillRect(-6, 14, 12, 14);
  ctx.beginPath(); ctx.ellipse(0, -2, 20, 24, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(0, -10, 21, 17, 0, Math.PI, TAU); ctx.fill();
  if (look.long) { ctx.fillRect(-22, -10, 8, 40); ctx.fillRect(14, -10, 8, 40); }
  if (look.beard) { ctx.beginPath(); ctx.moveTo(-18, 6); ctx.quadraticCurveTo(0, 42, 18, 6); ctx.quadraticCurveTo(0, 16, -18, 6); ctx.fill(); }
  if (look.hat === 'toque') { ctx.fillStyle = look.hatCol; ctx.beginPath(); ctx.ellipse(0, -14, 22, 16, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(0, -32, 6, 0, TAU); ctx.fill(); }
  if (look.hat === 'cap') { ctx.fillStyle = look.hatCol; ctx.beginPath(); ctx.ellipse(0, -14, 22, 15, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(-4, -14, 30, 5); }
  ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(-7, -2, 2.4, 0, TAU); ctx.arc(7, -2, 2.4, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 11); ctx.quadraticCurveTo(0, 15, 6, 11); ctx.stroke();
  ctx.restore();
}
// A thumbnail of a venue for pickers and the rules page.
export function drawVenueThumb(ctx, i, x, y, w, h, t = 0) {
  const th = THEMES[i];
  ctx.save(); roundRectPath(ctx, x, y, w, h, 14); ctx.clip();
  const sr = { x: x - (500 * (w / 1000) - w / 2), y: y + h * 0.06, w: 1000 * (w / 1000), h: 560 * (w / 1000), s: w / 1000 * 1.0 };
  const stage = { x, y, w, h };
  drawBackdrop(ctx, stage, { ...sr, x, y: y + h * 0.1, s: Math.min(w / 700, h / 330) }, th, t);
  ctx.restore();
}
