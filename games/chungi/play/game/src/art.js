// Chungi art: the hill-town alley, the kid, the band ball with its tuft, hoops and effects. Pure canvas drawing, no assets.
// World units: x across the alley (0 = middle), y up from the ball-contact line; the floor is drawn R (0.05) below y = 0.
import { R, HALF0 } from './sim.js';
import { gl } from './glhook.js';

const TAU = Math.PI * 2;
export const FX = { soft: true };

export const BANDS = [
  { name: 'Festival', need: 0, how: 'the first set', cols: ['#ff3d7f', '#ffc83d', '#25d0c0', '#7a5cff', '#ff7a2f'] },
  { name: 'Lime Soda', need: 1, how: 'a streak of 10 kicks in Street Run', cols: ['#b6f23a', '#1fd0a0', '#fff36b', '#2f9bff', '#ff5fa2'] },
  { name: 'Monsoon', need: 2, how: 'thread 5 hoops in one run', cols: ['#2fa7ff', '#7ae8ff', '#5b6dff', '#e8f6ff', '#24d6b0'] },
  { name: 'Marigold', need: 3, how: 'land 5 different tricks', cols: ['#ffb300', '#ff6a00', '#ffe066', '#e63946', '#fff2c2'] },
  { name: 'Blossom', need: 4, how: 'thread 5 hoops in the Daily alley', cols: ['#ff8fb8', '#ffd1e6', '#c77dff', '#fff', '#ff4d94'] },
  { name: 'Night Glow', need: 5, how: '100 Perfect kicks in total', cols: ['#00f5d4', '#9b5de5', '#f15bb5', '#fee440', '#00bbf9'] },
];

// ---- camera ----------------------------------------------------------------------------------------------------------
export function makeCam(stage, camY = 0) {
  const s = Math.max(20, Math.min(stage.w / (2 * HALF0 + 0.8), stage.h / 7.6));
  const floorY = stage.y + stage.h - Math.max(0.55 * s, 36);
  const gy = floorY - R * s;
  const cx = stage.x + stage.w / 2;
  const cam = { s, gy, floorY, cx, camY, stage, X: (x) => cx + x * s, Y: (y) => gy - (y - camY) * s };
  return cam;
}

// ---- the alley -----------------------------------------------------------------------------------------------------------
const sky = (ctx, W, H) => {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b0f45'); g.addColorStop(0.38, '#6a2a86'); g.addColorStop(0.62, '#d4466f'); g.addColorStop(0.82, '#ff9a55'); g.addColorStop(1, '#ffd08a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
};
function peaks(ctx, W, cam, camY) {
  const base = cam.Y(6.9) + camY * 0, sz = cam.s;
  const layer = (col, snow, off, amp, k, y0) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, base + y0);
    const n = Math.ceil(W / (sz * 1.3)) + 2;
    for (let i = 0; i <= n; i++) {
      const x = i * sz * 1.3 - off, h = amp * sz * (0.45 + 0.55 * Math.abs(Math.sin(i * k + 1.3)));
      ctx.lineTo(x, base + y0 - h);
      ctx.lineTo(x + sz * 0.65, base + y0 - h * 0.45);
    }
    ctx.lineTo(W + 80, base + y0); ctx.closePath(); ctx.fill();
    if (snow) {
      ctx.fillStyle = snow;
      for (let i = 0; i <= n; i++) {
        const x = i * sz * 1.3 - off, h = amp * sz * (0.45 + 0.55 * Math.abs(Math.sin(i * k + 1.3)));
        ctx.beginPath(); ctx.moveTo(x - sz * 0.22, base + y0 - h * 0.72); ctx.lineTo(x, base + y0 - h); ctx.lineTo(x + sz * 0.3, base + y0 - h * 0.7); ctx.lineTo(x + sz * 0.08, base + y0 - h * 0.78); ctx.closePath(); ctx.fill();
      }
    }
  };
  layer('#7a3a86', '#ffd9e6', sz * 0.4, 2.1, 1.9, 0);
  layer('#4d2a6e', null, sz * 1.1, 1.3, 2.7, sz * 0.25);
}
function kite(ctx, x, y, size, col, t, phase) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.35 + Math.sin(t * 1.3 + phase) * 0.12);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, 0); ctx.lineTo(0, size * 1.2); ctx.lineTo(-size * 0.7, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, size * 1.2); ctx.moveTo(-size * 0.7, 0); ctx.lineTo(size * 0.7, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, size * 1.2);
  for (let i = 1; i <= 5; i++) ctx.lineTo(Math.sin(t * 2 + i + phase) * size * 0.35, size * 1.2 + i * size * 0.4);
  ctx.stroke();
  ctx.restore();
}
function window3(ctx, x, y, w, h, lit, t) {
  ctx.fillStyle = '#3a1e14'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (lit) { g.addColorStop(0, '#ffe29a'); g.addColorStop(1, '#ff9f4a'); } else { g.addColorStop(0, '#46304f'); g.addColorStop(1, '#2a1c36'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // carved timber lattice
  ctx.strokeStyle = '#4d2a18'; ctx.lineWidth = Math.max(2, w * 0.045);
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { ctx.moveTo(x + (w * i) / 4, y); ctx.lineTo(x + (w * i) / 4, y + h); }
  for (let i = 1; i < 5; i++) { ctx.moveTo(x, y + (h * i) / 5); ctx.lineTo(x + w, y + (h * i) / 5); }
  ctx.stroke();
  ctx.fillStyle = '#6a3a22'; ctx.fillRect(x - 6, y - 10, w + 12, 8);
  void t;
}
export function drawBackdrop(ctx, W, H, cam, half, t, wx = 0) {
  const s = cam.s, stage = cam.stage;
  if (gl.active && gl.allow) {
    // the real 3D alley is drawn under this canvas (view3d/alley3d.js): record what it needs and leave this canvas clear
    gl.bgFrame = { cam: { cx: cam.cx, floorY: cam.floorY, s }, half, wx, t, W, H };
    if (gl.bgReady) { ctx.clearRect(0, 0, W, H); return; }
  }
  sky(ctx, W, H);
  // sun glow
  const sg = ctx.createRadialGradient(cam.cx - 1.2 * s, cam.Y(5.6), 10, cam.cx - 1.2 * s, cam.Y(5.6), s * 5);
  sg.addColorStop(0, 'rgba(255,230,160,0.55)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  peaks(ctx, W, cam, cam.camY);
  kite(ctx, cam.cx + 1.6 * s, cam.Y(7.9), s * 0.3, '#ffdd55', t, 0.4);
  kite(ctx, cam.cx - 2.2 * s, cam.Y(8.8), s * 0.24, '#5bf0d0', t, 2.1);
  // the back facade: warm plaster, timber windows, eaves
  const roofY = cam.Y(6.6);
  const fx0 = 0, fx1 = W;
  const fg = ctx.createLinearGradient(0, roofY, 0, cam.floorY);
  fg.addColorStop(0, '#e9906a'); fg.addColorStop(0.5, '#c8624f'); fg.addColorStop(1, '#8c3a3e');
  ctx.fillStyle = fg; ctx.fillRect(fx0, roofY, fx1 - fx0, H - roofY);
  // plaster patches
  ctx.fillStyle = 'rgba(255,225,190,0.08)';
  for (let i = -4; i < 6; i++) ctx.fillRect(cam.X(i * 1.7 + 0.2), roofY + s * 0.5, s * 0.9, s * 1.1);
  // windows on two floors
  const cols = Math.ceil(W / (s * 1.9)) + 2;
  for (let r = 0; r < 2; r++) for (let i = -cols; i < cols; i++) {
    const x = cam.X(i * 1.9 + 0.35), y = cam.Y(r === 0 ? 4.6 : 2.2);
    if (x < -s || x > W + s) continue;
    window3(ctx, x - s * 0.34, y, s * 0.68, s * 1.05, ((i * 7 + r * 3) & 3) !== 0, t);
  }
  // doorway
  { const x = cam.X(0.0) - s * 0.5; ctx.fillStyle = '#2a140f'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, cam.Y(1.5), s, cam.floorY - cam.Y(1.5), [s * 0.5, s * 0.5, 0, 0]) : ctx.rect(x, cam.Y(1.5), s, cam.floorY - cam.Y(1.5)); ctx.fill(); ctx.fillStyle = 'rgba(255,190,100,0.25)'; ctx.fillRect(x + s * 0.12, cam.Y(1.2), s * 0.76, cam.floorY - cam.Y(1.2)); }
  // eaves
  ctx.fillStyle = '#4a2418'; ctx.fillRect(0, roofY - s * 0.2, W, s * 0.34);
  ctx.fillStyle = '#7a3b22'; ctx.fillRect(0, roofY - s * 0.2, W, s * 0.09);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, roofY + s * 0.14, W, s * 0.22);
  // laundry line and bunting: they sway with the wind
  const sway = Math.max(-1, Math.min(1, wx / 1.6));
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  const ly = cam.Y(5.7);
  ctx.beginPath(); ctx.moveTo(0, ly); ctx.quadraticCurveTo(cam.cx, ly + s * 0.35, W, ly); ctx.stroke();
  const cl = ['#fff3c9', '#4ad3c6', '#ff6a8b', '#ffd35a', '#7aa8ff'];
  for (let i = 0; i < 7; i++) {
    const u = (i + 0.5) / 7, x = u * W, y = ly + Math.sin(u * Math.PI) * s * 0.35, sw = Math.sin(t * 2 + i) * 0.04 + sway * 0.25;
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, sw, 1, 0, 0);
    ctx.fillStyle = cl[i % cl.length]; ctx.fillRect(-s * 0.16, 0, s * 0.32, s * (0.45 + (i % 3) * 0.12)); ctx.restore();
  }
  // the walls: ricochet surfaces at +-half
  const lw = cam.X(-half), rw = cam.X(half);
  const wg = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#4a2a38'); g.addColorStop(1, '#2a1830'); return g; };
  const wall = (xa, xb, inner) => {
    const x0 = Math.min(xa, xb), w = Math.abs(xb - xa);
    if (w <= 0) return;
    const g = ctx.createLinearGradient(inner ? x0 : x0 + w, 0, inner ? x0 + w : x0, 0);
    g.addColorStop(0, '#6a3b3f'); g.addColorStop(1, '#2d1a2c');
    ctx.fillStyle = g; ctx.fillRect(x0, 0, w, H);
    ctx.strokeStyle = 'rgba(20,8,24,0.45)'; ctx.lineWidth = 2;
    const bh = s * 0.34;
    ctx.beginPath();
    for (let y = ((cam.floorY) % bh) - bh; y < H; y += bh) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
    ctx.stroke();
    ctx.beginPath();
    let row = 0;
    for (let y = ((cam.floorY) % bh) - bh; y < H; y += bh, row++) for (let x = x0 + ((row & 1) ? s * 0.28 : 0); x < x0 + w; x += s * 0.56) { ctx.moveTo(x, y); ctx.lineTo(x, y + bh); }
    ctx.stroke();
  };
  void wg;
  wall(-40, lw, false); wall(rw, W + 40, true);
  // a lit edge where the ball bounces
  for (const [x, d] of [[lw, 1], [rw, -1]]) {
    const g = ctx.createLinearGradient(x, 0, x + d * s * 0.22, 0); g.addColorStop(0, 'rgba(255,214,160,0.55)'); g.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(x, x + d * s * 0.22), 0, s * 0.22, H);
  }
  // cobbled floor
  const fy = cam.floorY;
  const cg = ctx.createLinearGradient(0, fy, 0, H);
  cg.addColorStop(0, '#b9805a'); cg.addColorStop(0.15, '#8a5642'); cg.addColorStop(1, '#4b2c33');
  ctx.fillStyle = cg; ctx.fillRect(0, fy, W, H - fy);
  ctx.strokeStyle = 'rgba(30,12,20,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let r = 0; r < 4; r++) {
    const y = fy + (r + 1) * s * 0.17;
    if (y > H) break;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.beginPath(); for (let x = (r & 1 ? s * 0.3 : 0); x < W; x += s * 0.6) { ctx.moveTo(x, y); ctx.lineTo(x, y + s * 0.17); } ctx.stroke();
  }
  void stage;
}

// ---- the kid (seen from behind) ---------------------------------------------------------------------------------------------
const lerp = (a, b, k) => a + (b - a) * k;
function limb(ctx, a, b, w, col, edge) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = edge; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
// two-bone leg: hip -> knee -> foot, the knee bends toward `bend` (-1 left, +1 right)
function leg(ctx, hip, foot, L1, L2, bend, wThigh, wShin, skin, shorts, shoe, s) {
  let dx = foot.x - hip.x, dy = foot.y - hip.y, d = Math.hypot(dx, dy);
  const mx = (L1 + L2) * 0.999;
  if (d > mx) { foot = { x: hip.x + (dx / d) * mx, y: hip.y + (dy / d) * mx }; dx = foot.x - hip.x; dy = foot.y - hip.y; d = mx; }
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ux = dx / d, uy = dy / d;
  const kx = hip.x + ux * a + (-uy) * h * bend, ky = hip.y + uy * a + ux * h * bend;
  const knee = { x: kx, y: ky };
  limb(ctx, knee, foot, wShin, skin[0], skin[1]);
  // thigh in shorts colour reaching about half way
  limb(ctx, hip, knee, wThigh, skin[0], skin[1]);
  const mid = { x: lerp(hip.x, knee.x, 0.72), y: lerp(hip.y, knee.y, 0.72) };
  limb(ctx, hip, mid, wThigh + 2, shorts[0], shorts[1]);
  // sneaker
  ctx.save(); ctx.translate(foot.x, foot.y);
  ctx.fillStyle = shoe[1]; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.12, s * 0.075, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shoe[0]; ctx.beginPath(); ctx.ellipse(0, -s * 0.012, s * 0.1, s * 0.058, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shoe[2]; ctx.fillRect(-s * 0.1, s * 0.03, s * 0.2, s * 0.025);
  ctx.restore();
}
const KID_SMOOTH = new WeakMap();
export function drawKid(ctx, cam, kid, ball, t) {
  const s = cam.s, x = cam.X(kid.x), fy = cam.floorY;
  // Eased presentation of the slide: the simulation moves the kid at a flat speed (it starts and stops at once), so the stride
  // amount, stride phase and lean are smoothed here, per kid object, and never feed back into the game.
  let sm = KID_SMOOTH.get(kid);
  if (!sm) { sm = { r: 0, ph: 0, lean: 0, t }; KID_SMOOTH.set(kid, sm); }
  const dtS = Math.min(0.1, Math.max(0, t - sm.t)); sm.t = t;
  const ease = 1 - Math.exp(-dtS * 12);
  const dir = kid.dir || 1;
  sm.r += ((kid.run || 0) - sm.r) * ease;
  sm.ph += dtS * (5 + 9 * sm.r);
  sm.lean += (dir * (kid.run || 0) * 0.07 - sm.lean) * ease;
  const run = sm.r, ph = sm.ph;
  const anim = kid.anim, kt = anim ? Math.min(1, anim.t / 0.3) : 1;
  const kickAmt = anim ? Math.sin(Math.min(1, kt) * Math.PI) : 0;
  const lean = sm.lean + (anim ? anim.side * kickAmt * 0.06 : 0);
  const hipY = fy - 0.86 * s, hipW = 0.115 * s;
  const skin = ['#b07a52', '#6f4529'], shorts = ['#2a3d8f', '#18235e'], shoe = ['#fafafa', '#cdd2dc', '#e23a4a'];
  // shadow
  ctx.fillStyle = 'rgba(20,8,24,0.35)'; ctx.beginPath(); ctx.ellipse(x, fy + 0.03 * s, 0.42 * s, 0.1 * s, 0, 0, TAU); ctx.fill();
  if (gl.active && gl.allow) {
    // the 3D presenter draws the kid from this record (pixels of the 2D camera); the shadow above stays 2D
    const a = kid.anim;
    gl.frame = { t, cam: { cx: cam.cx, floorY: cam.floorY, s }, kid: { x: kid.x, dir: kid.dir || 1, run: kid.run || 0, anim: a ? { t: a.t, kind: a.kind, side: a.side, perfect: !!a.perfect } : null }, ball: { px: cam.X(ball.x), py: cam.Y(ball.y) } };
    return;
  }
  const sway = Math.sin(ph) * run;
  ctx.save();
  ctx.translate(x, hipY); ctx.rotate(lean); ctx.translate(-x, -hipY);
  const hipL = { x: x - hipW, y: hipY }, hipR = { x: x + hipW, y: hipY };
  const idle = Math.sin(t * 2.4) * 0.01 * s;
  let fl = { x: x - 0.17 * s - sway * 0.07 * s, y: fy - Math.max(0, Math.sin(ph)) * run * 0.14 * s };
  let fr = { x: x + 0.17 * s + sway * 0.07 * s, y: fy - Math.max(0, -Math.sin(ph)) * run * 0.14 * s };
  let kickLeg = null;
  if (anim) {
    const right = anim.side > 0;
    const bx = cam.X(ball.x), by = cam.Y(Math.max(0.1, ball.y));
    const tx = Math.max(x - 0.7 * s, Math.min(x + 0.7 * s, bx + (right ? -0.05 : 0.05) * s)), ty = Math.min(fy - 0.08 * s, by + 0.06 * s);
    const f = { x: lerp(right ? fr.x : fl.x, tx, kickAmt), y: lerp(right ? fr.y : fl.y, ty, kickAmt) };
    if (right) fr = f; else fl = f;
    kickLeg = right ? 'r' : 'l';
  }
  const L1 = 0.44 * s, L2 = 0.44 * s, wT = 0.17 * s, wS = 0.13 * s;
  leg(ctx, hipL, fl, L1, L2, kickLeg === 'l' ? -1 : -0.7, wT, wS, skin, shorts, shoe, s);
  leg(ctx, hipR, fr, L1, L2, kickLeg === 'r' ? 1 : 0.7, wT, wS, skin, shorts, shoe, s);
  // torso: T-shirt in the colourway accent
  const tg = ctx.createLinearGradient(x - 0.3 * s, 0, x + 0.3 * s, 0);
  tg.addColorStop(0, '#f8c443'); tg.addColorStop(0.5, '#ffe27a'); tg.addColorStop(1, '#d99b1e');
  const shY = hipY - 0.58 * s;
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.moveTo(x - 0.25 * s, shY); ctx.quadraticCurveTo(x, shY - 0.07 * s, x + 0.25 * s, shY); ctx.lineTo(x + 0.2 * s, hipY + 0.04 * s); ctx.lineTo(x - 0.2 * s, hipY + 0.04 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,0,0.45)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(120,60,0,0.25)'; ctx.fillRect(x - 0.02 * s, shY + 0.05 * s, 0.04 * s, hipY - shY - 0.05 * s);
  // arms balance: one lifts with the kick
  const armA = { x: x - 0.25 * s, y: shY + 0.05 * s }, armB = { x: x + 0.25 * s, y: shY + 0.05 * s };
  const swing = anim ? anim.side * kickAmt : 0;
  const handL = { x: armA.x - (0.12 + 0.16 * Math.max(0, swing)) * s - sway * 0.04 * s, y: armA.y + (0.42 - 0.3 * Math.max(0, swing)) * s };
  const handR = { x: armB.x + (0.12 + 0.16 * Math.max(0, -swing)) * s + sway * 0.04 * s, y: armB.y + (0.42 - 0.3 * Math.max(0, -swing)) * s };
  limb(ctx, armA, handL, 0.12 * s, skin[0], skin[1]); limb(ctx, armB, handR, 0.12 * s, skin[0], skin[1]);
  limb(ctx, armA, { x: lerp(armA.x, handL.x, 0.3), y: lerp(armA.y, handL.y, 0.3) }, 0.14 * s, '#f1b92f', 'rgba(80,40,0,0.4)');
  limb(ctx, armB, { x: lerp(armB.x, handR.x, 0.3), y: lerp(armB.y, handR.y, 0.3) }, 0.14 * s, '#f1b92f', 'rgba(80,40,0,0.4)');
  // neck, head (hair and a cap seen from behind)
  const hx = x + lean * 0.3 * s, hy = shY - 0.2 * s, hr = 0.15 * s;
  ctx.fillStyle = skin[0]; ctx.fillRect(x - 0.045 * s, shY - 0.08 * s, 0.09 * s, 0.1 * s);
  ctx.fillStyle = skin[0]; ctx.beginPath(); ctx.arc(hx - hr * 1.0, hy + hr * 0.1, hr * 0.28, 0, TAU); ctx.arc(hx + hr * 1.0, hy + hr * 0.1, hr * 0.28, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, hr * 0.2, hx, hy, hr * 1.1);
  hg.addColorStop(0, '#3a2a28'); hg.addColorStop(1, '#0f0a0c');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
  ctx.fillStyle = skin[0]; ctx.beginPath(); ctx.ellipse(hx, hy + hr * 0.86, hr * 0.62, hr * 0.28, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- the chungi ------------------------------------------------------------------------------------------------------------
export function drawChungi(ctx, cam, ball, tuft, band, t, noRing = false) {
  const s = cam.s, r = R * s * 1.3, cx = cam.X(ball.x), cy = cam.Y(ball.y);   // real size 10 cm, drawn at most 1.3x
  const cols = BANDS[band].cols;
  // a soft glow and a thin locator ring keep the small ball easy to follow (the ball itself is never inflated)
  { const gr = Math.max(0.42 * s, r * 5), pulse = 0.5 + 0.5 * Math.sin(t * 7), warm = band === 2 ? '120,220,255' : '255,232,160';
    const hg = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, gr);
    hg.addColorStop(0, `rgba(${warm},0.85)`); hg.addColorStop(0.35, `rgba(${warm},0.32)`); hg.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, gr, 0, TAU); ctx.fill();
    if (!noRing) { ctx.strokeStyle = `rgba(${warm},${0.45 + 0.3 * pulse})`; ctx.lineWidth = Math.max(1.5, s * 0.02);
      ctx.beginPath(); ctx.arc(cx, cy, gr * 0.5, 0, TAU); ctx.stroke(); } }
  // tuft: loose loops on a streaming chain behind the ball
  ctx.save();
  let prev = { x: cx, y: cy };
  for (let i = tuft.length - 1; i >= 0; i--) {
    const p = { x: cam.X(tuft[i].x), y: cam.Y(tuft[i].y) };
    const a = Math.atan2(p.y - prev.y, p.x - prev.x), k = 1 - i / (tuft.length + 1);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a + Math.sin(t * 9 + i * 1.7) * 0.4);
    ctx.strokeStyle = cols[(i + 1) % cols.length]; ctx.lineWidth = Math.max(1.5, r * 0.3 * k + 0.8);
    ctx.globalAlpha = 0.5 + 0.5 * k;
    ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * (0.42 + 0.12 * k), r * 0.17 * (0.7 + 0.5 * k), 0, 0, TAU); ctx.stroke();
    ctx.restore();
    prev = p;
  }
  ctx.restore();
  // the ball: loops on a sphere, squashed on contact and stretched with speed
  ctx.save();
  ctx.translate(cx, cy);
  const sp = Math.hypot(ball.vx, ball.vy);
  if (ball.sq > 0.03) { ctx.rotate(ball.sqA); ctx.scale(1 - 0.34 * ball.sq, 1 + 0.28 * ball.sq); ctx.rotate(-ball.sqA); }
  else if (sp > 1) { const a = Math.atan2(-ball.vy, ball.vx), st = Math.min(0.22, sp * 0.016); ctx.rotate(a); ctx.scale(1 + st, 1 - st * 0.7); ctx.rotate(-a); }
  const core = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  core.addColorStop(0, '#9a6aa8'); core.addColorStop(1, '#2a1238');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * 0.96, 0, TAU); ctx.fill();
  const N = 8;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI + ball.ang * 0.5, tilt = Math.abs(Math.cos(i * 0.9 + ball.ang * 0.8)) * 0.8 + 0.18;
    ctx.save(); ctx.rotate(th);
    ctx.lineWidth = r * 0.2 + 1; ctx.strokeStyle = 'rgba(16,4,28,0.8)';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.93, r * 0.93 * tilt, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = r * 0.17; ctx.strokeStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.93, r * 0.93 * tilt, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  const hl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 1, -r * 0.4, -r * 0.45, r * 0.42);
  hl.addColorStop(0, 'rgba(255,255,255,0.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  const sh = ctx.createRadialGradient(r * 0.35, r * 0.4, r * 0.2, r * 0.2, r * 0.2, r * 1.15);
  sh.addColorStop(0, 'rgba(10,0,20,0)'); sh.addColorStop(1, 'rgba(10,0,20,0.45)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.restore();
}
export function drawBallShadow(ctx, cam, ball) {
  const k = Math.max(0, 1 - ball.y / 7), r = R * cam.s * (0.9 + 0.5 * k);
  ctx.fillStyle = `rgba(20,8,24,${0.18 + 0.22 * k})`;
  ctx.beginPath(); ctx.ellipse(cam.X(ball.x), cam.floorY + 0.05 * cam.s, r * 1.3, r * 0.36, 0, 0, TAU); ctx.fill();
}
// A pulsing ring on the floor where the ball will come down.
export function drawLanding(ctx, cam, x, t, col = '255,90,120') {
  const r = cam.s * 0.4, px = cam.X(x), py = cam.floorY + 0.06 * cam.s, p = 0.5 + 0.5 * Math.sin(t * 8);
  ctx.save(); ctx.strokeStyle = `rgba(${col},0.95)`; ctx.fillStyle = `rgba(${col},${0.16 + 0.12 * p})`; ctx.lineWidth = Math.max(2.5, cam.s * 0.035);
  ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
}

// ---- hoops ----------------------------------------------------------------------------------------------------------------------
export function drawHoop(ctx, cam, h, t, part, glow = 0) {
  const s = cam.s, cx = cam.X(h.x), cy = cam.Y(h.y), rx = h.r * s, ry = Math.max(6, rx * 0.2);
  ctx.save();
  if (part === 'back') {
    // net / ribbon hanging below
    ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      const u = i / 3;
      ctx.beginPath(); ctx.moveTo(cx + u * rx, cy); ctx.quadraticCurveTo(cx + u * rx * 0.7, cy + s * 0.3, cx + u * rx * 0.45, cy + s * 0.55 + Math.sin(t * 3 + i) * 3); ctx.stroke();
    }
    ctx.strokeStyle = '#a8326a'; ctx.lineWidth = Math.max(4, s * 0.075);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(2, s * 0.035);
    ctx.beginPath(); ctx.ellipse(cx, cy - 1, rx, ry, 0, Math.PI, TAU); ctx.stroke();
  } else {
    const p = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.shadowColor = `rgba(255,220,120,${0.5 + 0.4 * p + glow})`; ctx.shadowBlur = 14 + glow * 20;
    ctx.strokeStyle = '#c23d7e'; ctx.lineWidth = Math.max(5, s * 0.09);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffe074'; ctx.lineWidth = Math.max(2.5, s * 0.04);
    ctx.beginPath(); ctx.ellipse(cx, cy - 1, rx, ry, 0, 0, Math.PI); ctx.stroke();
  }
  ctx.restore();
}

// ---- effects ------------------------------------------------------------------------------------------------------------------------
// kind 0 dust puff, 1 spark, 2 ring, 3 band bit, 4 confetti, 5 wall flash
export function stepFx(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.t += dt;
    if (q.t >= q.max) { list.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.kind === 1 || q.kind === 3 || q.kind === 4) q.vy -= 7 * dt;
    if (q.kind === 0) { q.vx *= 0.96; q.vy *= 0.96; }
    if (q.rot !== undefined) q.rot += q.spin * dt;
  }
}
export function drawFx(ctx, cam, list) {
  const s = cam.s;
  for (const q of list) {
    const k = q.t / q.max, x = cam.X(q.x), y = cam.Y(q.y), a = Math.max(0, 1 - k);
    ctx.save(); ctx.globalAlpha = a;
    if (q.kind === 0) { ctx.fillStyle = 'rgba(255,225,190,0.7)'; ctx.beginPath(); ctx.arc(x, y, s * q.size * (1 + k * 1.6), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, s * q.size * a), 0, TAU); ctx.fill(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(2, s * 0.05 * a); ctx.beginPath(); ctx.arc(x, y, s * q.size * (0.2 + k), 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) { ctx.translate(x, y); ctx.rotate(q.rot); ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(2, s * 0.045); ctx.beginPath(); ctx.ellipse(0, 0, s * q.size, s * q.size * 0.4, 0, 0, TAU); ctx.stroke(); }
    else if (q.kind === 4) { ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-s * q.size, -s * q.size * 0.5, s * q.size * 2, s * q.size); }
    else if (q.kind === 5) {
      ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(2, s * 0.045 * a); ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const an = (i / 7) * Math.PI - Math.PI / 2 + (q.dir > 0 ? Math.PI : 0), r0 = s * 0.2, r1 = s * (0.35 + 0.5 * k);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); ctx.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
