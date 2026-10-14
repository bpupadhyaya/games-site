// Jukskei art: sky and veld, the sand lane, the stake, the wooden pins and the thrower. Everything is drawn through a projector
// (cam.js): world x along the lane, y across (foreshortened), z up. Pure drawing, no state of its own.
import { K } from './cam.js';
import { LANE_HALF, STAKE_H, NEAR, TOUCH, BONUS_NEAR, PIN_LEN } from './sim.js';

const TAU = Math.PI * 2;
const hash = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TEAM = [
  { name: 'Amber', main: '#f08a24', dark: '#a85a0c', light: '#ffc66e', css: '#f4a23a' },
  { name: 'Teal', main: '#1f9ac9', dark: '#0d5e82', light: '#7fd3f2', css: '#4cb8e0' },
];
export const SKIN = ['#f0c8a3', '#d7a070', '#a8744b', '#6c4529'];

// skies and ground per pitch (index = pitch.sky)
const PAL = [
  { top: '#79bde6', mid: '#cfe6ee', hor: '#fde7b0', sun: '#fff1b8', sunX: 0.8, h1: '#a2bb8c', h2: '#86a577', veld: '#b8b66c', veld2: '#a39f58', sand: '#e9cd92', sandD: '#d8b878', cloud: 'rgba(255,255,255,0.8)', tree: '#4e5a2e' },
  { top: '#3f98e0', mid: '#a9d6f2', hor: '#e3f1f4', sun: '#fffbe0', sunX: 0.3, h1: '#8fb08c', h2: '#729b70', veld: '#a9b663', veld2: '#929f50', sand: '#efd59c', sandD: '#dcbd82', cloud: 'rgba(255,255,255,0.9)', tree: '#42512a' },
  { top: '#566f9c', mid: '#c8a58a', hor: '#f6c88c', sun: '#ffe2a6', sunX: 0.7, h1: '#8c8f74', h2: '#6f7864', veld: '#a49a58', veld2: '#8e8548', sand: '#e4c28a', sandD: '#cfa96d', cloud: 'rgba(250,236,220,0.75)', tree: '#3d4527' },
  { top: '#33407c', mid: '#8a6a96', hor: '#f4a05e', sun: '#ffd18a', sunX: 0.25, h1: '#596b72', h2: '#465a5e', veld: '#7f9a5a', veld2: '#6c874a', sand: '#d8b886', sandD: '#c4a06b', cloud: 'rgba(255,214,200,0.6)', tree: '#2f3b2a' },
  { top: '#4c2f86', mid: '#c0678f', hor: '#ffb86e', sun: '#ffe0a0', sunX: 0.55, h1: '#6a5a7a', h2: '#544a64', veld: '#8f8f55', veld2: '#7a7a46', sand: '#e2bf8c', sandD: '#cda772', cloud: 'rgba(255,200,200,0.55)', tree: '#2c2a3a' },
];
export const palette = (i) => PAL[clamp(i | 0, 0, PAL.length - 1)];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- backdrop ------------------------------------------------------------------------------------------------------------------
function acacia(ctx, x, yb, h, col) {
  // a flat-topped thorn tree: slim trunk, layered canopy
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x - h * 0.035, yb); ctx.lineTo(x - h * 0.02, yb - h * 0.62); ctx.lineTo(x + h * 0.02, yb - h * 0.62); ctx.lineTo(x + h * 0.04, yb); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, yb - h * 0.5); ctx.lineTo(x - h * 0.28, yb - h * 0.78); ctx.lineTo(x - h * 0.24, yb - h * 0.8); ctx.lineTo(x, yb - h * 0.56); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, yb - h * 0.52); ctx.lineTo(x + h * 0.3, yb - h * 0.74); ctx.lineTo(x + h * 0.27, yb - h * 0.77); ctx.lineTo(x, yb - h * 0.58); ctx.fill();
  const blob = (dx, dy, rx, ry) => { ctx.beginPath(); ctx.ellipse(x + dx * h, yb - dy * h, rx * h, ry * h, 0, 0, TAU); ctx.fill(); };
  blob(0, 0.86, 0.46, 0.1); blob(-0.28, 0.8, 0.24, 0.075); blob(0.3, 0.82, 0.26, 0.08); blob(0.05, 0.93, 0.3, 0.07);
}

export function drawBackdrop(ctx, R, pr, cam, pal, t) {
  const hz = R.y + R.h * ((R.gyF ?? 0.72) - 0.38);
  // sky
  const g = ctx.createLinearGradient(0, R.y, 0, hz);
  g.addColorStop(0, pal.top); g.addColorStop(0.65, pal.mid); g.addColorStop(1, pal.hor);
  ctx.fillStyle = g; ctx.fillRect(R.x, R.y, R.w, hz - R.y + 2);
  // sun and its glow
  const sx = R.x + R.w * pal.sunX, sy = hz - R.h * 0.15;
  const gl = ctx.createRadialGradient(sx, sy, 4, sx, sy, R.h * 0.34);
  gl.addColorStop(0, 'rgba(255,248,214,0.95)'); gl.addColorStop(0.18, 'rgba(255,240,190,0.5)'); gl.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = gl; ctx.fillRect(R.x, R.y, R.w, hz - R.y);
  ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(sx, sy, Math.max(10, R.h * 0.035), 0, TAU); ctx.fill();
  // clouds drifting slowly
  ctx.fillStyle = pal.cloud;
  for (let i = 0; i < 5; i++) {
    const cx = R.x + ((hash(i * 3 + 1) * 1.4 * R.w + t * (4 + i * 1.5) + i * 190) % (R.w + 360)) - 180, cy = R.y + R.h * (0.08 + 0.14 * hash(i + 11)), cw = 70 + hash(i + 5) * 90;
    ctx.beginPath(); ctx.ellipse(cx, cy, cw, cw * 0.17, 0, 0, TAU); ctx.ellipse(cx + cw * 0.35, cy - cw * 0.08, cw * 0.55, cw * 0.17, 0, 0, TAU); ctx.ellipse(cx - cw * 0.4, cy + 2, cw * 0.5, cw * 0.13, 0, 0, TAU); ctx.fill();
  }
  // two ranges of koppies (flat-topped hills), moving slowly with the camera
  const ridge = (par, hgt, col, seed, base) => {
    const off = -cam.cx * pr.s * par;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(R.x, hz + 2);
    for (let x = R.x; x <= R.x + R.w + 12; x += 12) {
      const u = (x - off) / 130;
      let v = Math.sin(u * 0.9 + seed) * 0.5 + Math.sin(u * 2.3 + seed * 3) * 0.25 + 0.4;
      v = Math.min(v, 0.62) + Math.max(0, v - 0.62) * 0.2;      // flat tops
      ctx.lineTo(x, hz - base - v * hgt);
    }
    ctx.lineTo(R.x + R.w, hz + 2); ctx.closePath(); ctx.fill();
  };
  ridge(0.12, R.h * 0.2, pal.h1, 1.3, 6);
  ridge(0.3, R.h * 0.13, pal.h2, 4.1, 0);
  // the veld: dry grass out to the horizon
  const vg = ctx.createLinearGradient(0, hz, 0, R.y + R.h);
  vg.addColorStop(0, pal.veld2); vg.addColorStop(0.45, pal.veld); vg.addColorStop(1, pal.veld2);
  ctx.fillStyle = vg; ctx.fillRect(R.x, hz, R.w, R.y + R.h - hz);
  // far thorn trees and a fence line, drawn before the lane so the lane sits in front
  const s = pr.s, ds = Math.min(s, 34), span = R.w / s + 20, x0 = cam.cx - span / 2;
  const i0 = Math.floor(x0 / 9);
  // far things keep a modest size when the camera zooms in (they are far away)
  const fp = (x, depth, z) => ({ x: pr.p(x, 0).x, y: pr.gy + depth * K * ds - z * ds });
  for (let i = i0 - 1; i <= i0 + Math.ceil(span / 9) + 1; i++) {
    const x = i * 9 + hash(i) * 6, depth = -7.5 - hash(i + 30) * 6, th = 3.8 + hash(i + 60) * 2.2;
    const p = fp(x, depth, 0);
    acacia(ctx, p.x, p.y, Math.max(34, th * ds), pal.tree);
  }
  // the fence: posts and two wires along the back of the lane
  const fy = -4.6;
  for (let k = 0; k < 2; k++) {
    const z = 0.45 + k * 0.45, a = fp(cam.cx - span / 2, fy, z), b = fp(cam.cx + span / 2, fy, z);
    ctx.strokeStyle = 'rgba(40,34,20,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const postGap = 2.2 * s / ds;
  for (let x = Math.floor((cam.cx - span / 2) / postGap) * postGap; x < cam.cx + span / 2; x += postGap) {
    const a = fp(x, fy, 0), b = fp(x, fy, 1.05);
    ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = Math.max(2, ds * 0.07); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

// ---- the lane --------------------------------------------------------------------------------------------------------------------
export function drawLane(ctx, R, pr, cam, pal, D, fric) {
  const s = pr.s;
  const yTop = pr.p(0, -LANE_HALF).y, yBot = pr.p(0, LANE_HALF).y;
  const xL = pr.p(-3.5, 0).x, xR = pr.p(D + 8, 0).x;
  const a = Math.max(R.x - 4, xL), b = Math.min(R.x + R.w + 4, xR);
  if (b > a) {
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, pal.sandD); g.addColorStop(0.5, pal.sand); g.addColorStop(1, pal.sandD);
    ctx.fillStyle = g; ctx.fillRect(a, yTop, b - a, yBot - yTop);
    // raked furrows along the lane and a scatter of grains
    ctx.strokeStyle = 'rgba(120,84,36,0.14)'; ctx.lineWidth = 1;
    for (let k = -4; k <= 4; k++) {
      const y = pr.p(0, k * 0.62).y;
      ctx.beginPath(); ctx.moveTo(a, y + 0.5); ctx.lineTo(b, y + 0.5); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(110,76,30,0.18)';
    const gx0 = Math.floor(pr.inv(a, 0).x * 3), gx1 = Math.ceil(pr.inv(b, 0).x * 3);
    for (let i = gx0; i < gx1 && i - gx0 < 400; i++) {
      const wx = i / 3 + hash(i) * 0.3, wy = (hash(i + 7) - 0.5) * 2 * LANE_HALF;
      const p = pr.p(wx, wy);
      ctx.fillRect(p.x, p.y, 1.6, 1.4);
    }
    // soft shade of the lane edge, then the white side lines
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath(); ctx.moveTo(a, yTop); ctx.lineTo(b, yTop); ctx.moveTo(a, yBot); ctx.lineTo(b, yBot); ctx.stroke();
    // distance ticks every 5 m (with the number under the near line)
    ctx.font = `600 ${Math.max(11, Math.min(18, Math.round(s * 0.5)))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let d = 5; d <= D; d += 5) {
      const p = pr.p(d, 0);
      if (p.x < R.x - 20 || p.x > R.x + R.w + 20) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, yTop); ctx.lineTo(p.x, yBot); ctx.stroke();
      ctx.fillStyle = 'rgba(70,46,18,0.8)'; ctx.fillText(`${d} m`, p.x, yBot + 3);
    }
  }
  // the throwing mat: a dark rubber slab with a white front line
  const m0 = pr.p(-1.3, -0.9), m1 = pr.p(0, 0.9);
  ctx.fillStyle = '#3a3a3e'; rr(ctx, m0.x, m0.y, m1.x - m0.x, m1.y - m0.y, 4); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2.5, s * 0.07); ctx.beginPath(); const l0 = pr.p(0, -LANE_HALF), l1 = pr.p(0, LANE_HALF); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();
  // chalk circles around the stake: touching, the scoring zone, and the nearest-pin bonus ring
  const sp = pr.p(D, 0);
  const ring = (r, fill, stroke, dash) => {
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r * s, r * s * K, 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.setLineDash(dash || []); ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.stroke(); ctx.setLineDash([]);
  };
  ring(BONUS_NEAR, null, 'rgba(255,255,255,0.35)', [4, 6]);
  ring(NEAR, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.8)', null);
  ring(TOUCH, 'rgba(255,214,90,0.28)', 'rgba(255,230,140,0.95)', null);
}

// ---- the stake -------------------------------------------------------------------------------------------------------------------
export function drawStake(ctx, pr, w, t, wind) {
  const st = w.stake, s = pr.s, base = pr.p(st.x, st.y, 0);
  const H = Math.max(STAKE_H * s, 30), wd = Math.max(5, s * 0.14);
  ctx.save();
  // soft shadow on the sand
  ctx.fillStyle = 'rgba(60,36,10,0.3)'; ctx.beginPath(); ctx.ellipse(base.x + 6, base.y + 2, Math.max(8, s * 0.3), Math.max(3, s * 0.1), 0, 0, TAU); ctx.fill();
  // a standing post tips over when knocked: angle 0 = upright, 1 = flat
  let fall = 0;
  if (st.fallen) fall = clamp(st.t / 0.32, 0, 1) ** 2;
  else if (st.rise > 0) fall = clamp(st.rise / 0.35, 0, 1);
  const dir = st.dirx >= 0 ? 1 : -1;
  ctx.translate(base.x, base.y);
  ctx.rotate(dir * fall * (Math.PI / 2 - 0.08));
  // painted post: red and white bands, a rounded top
  const grad = ctx.createLinearGradient(-wd / 2, 0, wd / 2, 0);
  grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#c9c2b0');
  ctx.fillStyle = grad; rr(ctx, -wd / 2, -H, wd, H, wd / 2); ctx.fill();
  ctx.save(); rr(ctx, -wd / 2, -H, wd, H, wd / 2); ctx.clip();
  ctx.fillStyle = '#d6372b';
  for (let k = 0; k < 4; k++) ctx.fillRect(-wd, -H + (k * 2 + 0.5) * H / 8, wd * 2, H / 8);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(wd * 0.12, -H, wd * 0.4, H);
  ctx.restore();
  // pennant
  if (fall < 0.4) {
    const flow = clamp((wind ? wind.ax : 0) / 1.2, -1, 1), len = Math.max(14, s * 0.42), wave = Math.sin(t * 7) * 0.12;
    const dirF = flow >= 0 ? 1 : -1, ext = len * (0.45 + 0.55 * Math.abs(flow));
    ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = 'rgba(80,50,0,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -H); ctx.lineTo(dirF * ext, -H - len * (0.12 + wave)); ctx.lineTo(dirF * ext * 0.95, -H - len * (0.42 + wave)); ctx.lineTo(0, -H - len * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ---- pins ------------------------------------------------------------------------------------------------------------------------
// One wooden pin centred at (x, y) with `len` pixels of length, rotated by `ang` (screen radians).
export function drawPinShape(ctx, x, y, len, ang, team, o = {}) {
  const th = len * 0.3, a = o.alpha ?? 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a;
  const wood = ctx.createLinearGradient(0, -th / 2, 0, th / 2);
  wood.addColorStop(0, '#e8bf86'); wood.addColorStop(0.5, '#c28a4a'); wood.addColorStop(1, '#8a5a28');
  // body: a flat board with a slightly fuller head (+x end)
  ctx.beginPath();
  ctx.moveTo(-len / 2 + th * 0.3, -th * 0.42); ctx.lineTo(len * 0.28, -th * 0.5);
  ctx.quadraticCurveTo(len / 2 + th * 0.1, -th * 0.5, len / 2 + th * 0.1, 0);
  ctx.quadraticCurveTo(len / 2 + th * 0.1, th * 0.5, len * 0.28, th * 0.5);
  ctx.lineTo(-len / 2 + th * 0.3, th * 0.42); ctx.quadraticCurveTo(-len / 2 - th * 0.05, th * 0.3, -len / 2 - th * 0.05, 0);
  ctx.quadraticCurveTo(-len / 2 - th * 0.05, -th * 0.3, -len / 2 + th * 0.3, -th * 0.42); ctx.closePath();
  ctx.fillStyle = wood; ctx.fill();
  ctx.lineWidth = Math.max(1, len * 0.05); ctx.strokeStyle = o.ghost ? 'rgba(255,255,255,0.85)' : 'rgba(50,28,8,0.75)'; ctx.stroke();
  // painted band and thin ring: the side's colour
  const col = TEAM[team] ?? TEAM[0];
  ctx.save(); ctx.clip();
  ctx.fillStyle = col.main; ctx.fillRect(-len * 0.36, -th, len * 0.17, th * 2);
  ctx.fillStyle = col.light; ctx.fillRect(-len * 0.12, -th, len * 0.045, th * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-len / 2, -th * 0.42, len, th * 0.16);
  ctx.restore();
  ctx.restore();
}
// screen angle and length of a pin from its pitch (th) and yaw: it tumbles in the vertical plane of the lane
export function pinScreen(p, s) {
  const len = Math.max(PIN_LEN * s * 1.25, 19);
  const ax = Math.cos(p.th) * Math.cos(p.yaw), ay = -Math.sin(p.th) + Math.sin(p.yaw) * K * 0.6;
  return { len, ang: Math.atan2(ay, ax) };
}
export function drawPin(ctx, pr, p, o = {}) {
  const pos = pr.p(p.x, p.y, p.z + (p.mode === 'rest' || p.mode === 'slide' ? 0.025 : 0));
  const { len, ang } = pinScreen(p, pr.s);
  const sh = pr.p(p.x, p.y, 0), h = Math.max(0, p.z);
  const alpha = (o.alpha ?? 1) * clamp(1 - p.fade, 0, 1);
  if (alpha <= 0.02) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgba(60,36,10,${clamp(0.32 - h * 0.05, 0.08, 0.32)})`;
  ctx.beginPath(); ctx.ellipse(sh.x + 2 + h * pr.s * 0.06, sh.y + 1, len * 0.5 * (1 - clamp(h * 0.04, 0, 0.4)), len * 0.12, 0, 0, TAU); ctx.fill();
  ctx.restore();
  drawPinShape(ctx, pos.x, pos.y - len * 0.1 * (p.mode === 'air' ? 0 : 1), len, ang, p.team, { alpha });
}

// the little pin used on the score cards
export function drawPinIcon(ctx, x, y, len, team, alpha = 1) { drawPinShape(ctx, x, y, len, -0.55, team, { alpha }); }

// ---- the thrower -----------------------------------------------------------------------------------------------------------------
// pose: arm = shoulder angle from hanging down, positive swings forward (+x) and up; elbow = forearm bend; bend = knee bend 0..1;
// lean = torso lean (+ forward); step = 0..1 how far the front foot has stepped and the back heel lifted (the delivery stride).
// Limbs are tapered shapes (thigh to shin, sleeve to forearm), not stick lines, so the figure reads as a person at phone size.
export function drawFigure(ctx, x, yg, H, pose, look) {
  const skin = SKIN[look.skin ?? 1], shirt = look.shirt ?? '#c8532f', shorts = look.shorts ?? '#2d3550', hat = look.hat ?? '#cdb77f';
  const arm = pose.arm ?? 0.15, elbow = pose.elbow ?? 0.25, lean = pose.lean ?? 0.05, bend = pose.bend ?? 0.1, step = pose.step ?? 0;
  const u = H / 100;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ground shadow
  ctx.fillStyle = 'rgba(50,30,8,0.3)'; ctx.beginPath(); ctx.ellipse(x + (4 + 6 * step) * u, yg + 1, (24 + 8 * step) * u, 4.5 * u, 0, 0, TAU); ctx.fill();
  const hipY = yg - (50 - 8 * bend) * u, hipX = x - 2 * u * bend + 3 * u * step;
  const sh = { x: hipX + Math.sin(lean) * 30 * u, y: hipY - Math.cos(lean) * 30 * u };
  const limb = (x0, y0, ang, len) => ({ x: x0 + Math.sin(ang) * len, y: y0 + Math.cos(ang) * len });
  // a tapered limb segment from a (radius ra) to b (radius rb)
  const taper = (a, ra, b, rb, col, shadeA = 0) => {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath();
    ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang + Math.PI * 1.5);
    ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    if (shadeA) { ctx.fillStyle = `rgba(20,10,0,${shadeA})`; ctx.fill(); }
  };
  const leg = (fwd, far) => {
    const hipP = { x: hipX + (far ? -1 : 1) * 0.6 * u, y: hipY };
    // front leg reaches forward as the delivery steps; the back leg trails with the heel up
    const kneeA = fwd ? 0.42 + 0.3 * bend + 0.35 * step : -0.26 - 0.1 * bend - 0.12 * step;
    const shinA = fwd ? 0.02 - 0.1 * step : -0.18 - 0.25 * bend + 0.35 * step;
    const kneeP = limb(hipP.x, hipP.y, kneeA, 25 * u);
    let foot = limb(kneeP.x, kneeP.y, shinA, 24 * u);
    const lift = !fwd ? 7 * u * step : 0;
    foot.y = Math.min(foot.y, yg - 2.5 * u - lift);
    const sA = far ? 0.32 : 0;
    taper(hipP, 6.4 * u, kneeP, 4.7 * u, shorts, sA);
    taper(kneeP, 4.3 * u, foot, 3.2 * u, skin, far ? 0.3 : 0);
    // shoe: toe forward, heel lifts on the trailing leg
    ctx.fillStyle = far ? '#1e1913' : '#2c2118';
    ctx.beginPath(); ctx.ellipse(foot.x + 3.6 * u, Math.min(yg - 1.8 * u, foot.y + 2.4 * u), 8 * u, 3.4 * u, !fwd && step > 0 ? -0.5 * step : 0, 0, TAU); ctx.fill();
  };
  const armPts = (a, far) => {
    const shP = { x: sh.x + (far ? -1.4 : 1.4) * u, y: sh.y + 3 * u };
    const el = limb(shP.x, shP.y, a, 17 * u), hand = limb(el.x, el.y, a + (far ? 0.2 : elbow), 16 * u);
    return { shP, el, hand };
  };
  const armDraw = (a, far) => {
    const { shP, el, hand } = armPts(a, far);
    taper(shP, 4.6 * u, el, 3.7 * u, far ? shade(shirt) : shirt, far ? 0.25 : 0);        // sleeve
    taper(el, 3.3 * u, hand, 2.6 * u, skin, far ? 0.3 : 0);                              // forearm
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hand.x, hand.y, 3.1 * u, 0, TAU); ctx.fill();
    if (far) { ctx.fillStyle = 'rgba(20,10,0,0.3)'; ctx.fill(); }
    return hand;
  };
  const shade = (c) => c;
  // far side first
  leg(false, true);
  armDraw(-0.25 - 0.2 * lean + 0.3 * step, true);
  // torso: a shaped back, chest and a slight waist, drawn in the shirt colour with shorts below
  const tw = 9 * u, bx = (Math.sin(lean) * 30 * u);
  ctx.beginPath();
  ctx.moveTo(hipX - tw * 0.95, hipY + 1 * u);
  ctx.quadraticCurveTo(hipX - tw * 1.1 + bx * 0.3, hipY - 14 * u, sh.x - tw * 1.0, sh.y + 1 * u);
  ctx.quadraticCurveTo(sh.x, sh.y - 5 * u, sh.x + tw * 0.95, sh.y + 1 * u);
  ctx.quadraticCurveTo(hipX + tw * 1.25 + bx * 0.5, hipY - 15 * u, hipX + tw * 0.95, hipY + 1 * u);
  ctx.closePath();
  ctx.fillStyle = shirt; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.stroke();
  // chest shading and a collar line give the torso volume
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(sh.x + 2.5 * u, sh.y + 8 * u, 4.4 * u, 8 * u, lean, 0, TAU); ctx.fill();
  ctx.fillStyle = shorts; ctx.beginPath(); ctx.moveTo(hipX - tw * 1.0, hipY - 2 * u); ctx.lineTo(hipX + tw * 1.0, hipY - 2 * u); ctx.lineTo(hipX + tw * 1.15, hipY + 8 * u); ctx.lineTo(hipX - tw * 1.15, hipY + 8 * u); ctx.closePath(); ctx.fill();
  leg(true, false);
  // neck and head (a little forward of the shoulders)
  const hd = { x: sh.x + Math.sin(lean * 0.6) * 12 * u + 1.8 * u, y: sh.y - 12.5 * u };
  taper(sh, 3.2 * u, { x: hd.x - 0.5 * u, y: hd.y + 4 * u }, 3 * u, skin);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hd.x, hd.y, 6.4 * u, 7.4 * u, 0.08, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hd.x + 6.2 * u, hd.y + 0.8 * u, 1.7 * u, 2.2 * u, 0, 0, TAU); ctx.fill();              // nose
  ctx.fillStyle = 'rgba(30,18,8,0.85)'; ctx.beginPath(); ctx.arc(hd.x + 3.4 * u, hd.y - 0.8 * u, 0.9 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(40,24,10,0.9)'; ctx.beginPath(); ctx.ellipse(hd.x - 4 * u, hd.y - 1.6 * u, 3 * u, 4.5 * u, 0, 0, TAU); ctx.fill();   // hair
  // a wide-brimmed hat
  ctx.fillStyle = hat; ctx.beginPath(); ctx.ellipse(hd.x + 0.5 * u, hd.y - 5 * u, 11.5 * u, 2.6 * u, -0.06, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hd.x + 0.5 * u, hd.y - 7.4 * u, 6.2 * u, 4.6 * u, 0, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = look.band ?? '#7a4a1e'; ctx.fillRect(hd.x - 5.6 * u, hd.y - 6.6 * u, 11.4 * u, 1.8 * u);
  // near arm on top
  const hand = armDraw(arm, false);
  ctx.restore();
  return hand;
}
