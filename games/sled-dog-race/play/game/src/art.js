// Figures for the side-on trail: dogs, the musher, the sled, trees, signs. Everything is drawn from shapes with a lit side and a shaded side. All
// functions take a position on the ground (x, y), a size in pixels per metre and a phase; none of them keep state.
const TAU = Math.PI * 2;
export const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const rgbOf = (c) => {
  if (c[0] === '#') { const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1); return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)); }
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
};
const mix = (a, b, t) => { const pa = rgbOf(a), pb = rgbOf(b); return `rgb(${pa.map((v, k) => Math.round(v + (pb[k] - v) * t)).join(',')})`; };
export const shade = (c, t) => (t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#0b1430', -t));

// ---- shared figure helpers ---------------------------------------------------------------------------------------------------------------
// Two-bone inverse kinematics: root (rx, ry) to target (tx, ty) with bone lengths l1, l2. s = +1 / -1 picks which side the middle joint bends to
// (screen coordinates, facing right: +1 bends the joint backward = elbow, -1 forward = stifle / knee).
function ik(rx, ry, tx, ty, l1, l2, s) {
  const dx = tx - rx, dy = ty - ry, d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(l1 + l2 - 1e-3, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx), A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  return [[rx + Math.cos(a + s * A) * l1, ry + Math.sin(a + s * A) * l1], [rx + Math.cos(a) * d, ry + Math.sin(a) * d]];
}
// A tapered, rounded bone from a to b (width w0 at a, w1 at b).
function bone(ctx, ax, ay, bx, by, w0, w1, fill) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(ax + nx * w0 / 2, ay + ny * w0 / 2); ctx.lineTo(bx + nx * w1 / 2, by + ny * w1 / 2); ctx.lineTo(bx - nx * w1 / 2, by - ny * w1 / 2); ctx.lineTo(ax - nx * w0 / 2, ay - ny * w0 / 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(ax, ay, w0 / 2, 0, TAU); ctx.arc(bx, by, w1 / 2, 0, TAU); ctx.fill();
}
const lum = (c) => { const [r, g, b] = rgbOf(c); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
const wrap = (p) => ((p % 1) + 1) % 1;
// Foot position on its stride cycle (dog frame, x forward, y up is negative): stance = foot planted, moving backward at ground speed; swing = lifted arc.
function footAt(p, xc, sl, lift, ds) {
  p = wrap(p);
  if (p < ds) { const t = p / ds; return [xc + sl * (1 - 2 * t), 0]; }
  const t = (p - ds) / (1 - ds), e = t * t * (3 - 2 * t);
  return [xc - sl + 2 * sl * e, -lift * Math.pow(Math.sin(Math.PI * t), 0.75)];
}
// gait tables: [stand, walk, trot, lope, gallop]. Leg order: near fore, far fore, near hind, far hind.
const GAIT_PH = [[0, 0.5, 0.25, 0.75], [0.25, 0.75, 0, 0.5], [0, 0.5, 0.5, 0], [0, 0.1, 0.5, 0.6], [0, 0.14, 0.5, 0.62]];
const GAIT_DS = [1, 0.68, 0.5, 0.42, 0.36];
const GAIT_SL = [0, 0.2, 0.34, 0.3, 0.3];
const GAIT_LIFT = [0, 0.07, 0.12, 0.17, 0.2];

// A husky in profile facing right. (x, y) = the ground under the middle of the body, u = pixels per metre, ph = gait phase in cycles (the sim's
// stride, so stance feet move back at ground speed and stay planted),
// o = { coat:[base, mark, light], gait: 0 stand | 1 walk | 2 trot | 3 lope | 4 gallop, pose: 'run' | 'stand' | 'lie' | 'sit', dim: 0..1 (far dog), tongue }
export function drawDog(ctx, x, y, u, ph, o) {
  const U = u * 1.4, [base, mark, light] = o.coat;
  const pose = o.pose || 'run', dim = o.dim || 0, gait = o.gait || 0;
  const col = (c) => (dim ? shade(c, -0.28 * dim) : c);
  const run = pose === 'run', lie = pose === 'lie', sit = pose === 'sit';
  const g = run ? gait : 0;
  const bob = run ? Math.abs(Math.sin((ph + 0.1) * TAU * (g >= 3 ? 1 : 2) / (g >= 3 ? 1 : 1))) * [0, 0.012, 0.022, 0.04, 0.06][g] * U : Math.sin(ph * TAU * 0.5) * 0.006 * U;
  const pitch = run && g >= 3 ? Math.sin((ph + 0.2) * TAU) * (g === 4 ? 0.07 : 0.04) : 0;
  const hipH = lie ? 0.3 : sit ? 0.5 : 0.7;
  const by = y - hipH * U - bob;                 // body centre height
  const eye = lum(base) > 0.45 ? '#7ab8ea' : '#3b2a1c';
  const darkFur = col(shade(base, -0.28)), midFur = col(base), liteFur = col(light), markFur = col(mark);
  ctx.save(); ctx.translate(x, 0);
  // ground shadow
  ctx.fillStyle = 'rgba(20,34,80,0.22)'; ctx.beginPath(); ctx.ellipse(0, y + 1, 0.8 * U, 0.1 * U, 0, 0, TAU); ctx.fill();

  // legs: [root x, root y, kind]
  const shoulder = [0.3 * U, by + 0.06 * U], hip = [-0.42 * U, by + 0.04 * U];
  const stride = (k) => {
    const p = ph + GAIT_PH[g][k];
    if (!run) { const off = [0.04, -0.06, -0.02, 0.07][k]; return [(k < 2 ? 0.26 : -0.36 + (k === 3 ? 0.02 : 0)) * U + off * U, y]; }
    const fore = k < 2, xc = (fore ? 0.24 : -0.34) * U, sl = GAIT_SL[g] * U, lf = GAIT_LIFT[g] * U * (fore ? 1 : 0.9);
    const f = footAt(p, xc, sl, lf, GAIT_DS[g]);
    return [f[0], y + f[1]];
  };
  const drawLeg = (k, fur) => {
    const fore = k < 2, F = stride(k), r = fore ? shoulder : hip, w = (fore ? 0.14 : 0.16) * U, wl = 0.085 * U;
    let jointA, tip;
    if (fore) {
      // pastern: the paw trails the wrist a little while the leg swings
      const wrist = [F[0] - 0.02 * U, F[1] - 0.12 * U];
      [jointA, tip] = ik(r[0], r[1], wrist[0], wrist[1], 0.31 * U, 0.31 * U, 1);
      bone(ctx, r[0], r[1], jointA[0], jointA[1], w, w * 0.78, fur);
      bone(ctx, jointA[0], jointA[1], tip[0], tip[1], w * 0.78, wl, fur);
      bone(ctx, tip[0], tip[1], F[0], F[1] - 0.025 * U, wl, wl * 1.05, fur);
    } else {
      const ang = run ? 0.25 + (F[1] < y - 0.01 * U ? 0.5 : 0) : 0.35;       // metatarsus leans back from the paw to the hock
      const hock = [F[0] - Math.sin(ang) * 0.18 * U, F[1] - Math.cos(ang) * 0.18 * U];
      [jointA, tip] = ik(r[0], r[1], hock[0], hock[1], 0.31 * U, 0.31 * U, -1);
      bone(ctx, r[0] + 0.03 * U, r[1] + 0.02 * U, jointA[0], jointA[1], w * 1.5, w * 0.95, fur);
      bone(ctx, jointA[0], jointA[1], tip[0], tip[1], w * 0.95, wl * 1.05, fur);
      bone(ctx, tip[0], tip[1], F[0], F[1] - 0.02 * U, wl * 1.05, wl * 1.1, fur);
    }
    // paw
    ctx.fillStyle = col(shade(light, -0.05)); ctx.beginPath(); ctx.ellipse(F[0] + 0.045 * U, F[1] - 0.025 * U, 0.1 * U, 0.05 * U, 0, 0, TAU); ctx.fill();
  };

  if (lie) {
    // lying with the head up: folded legs, brisket on the snow
    ctx.fillStyle = darkFur; ctx.beginPath(); ctx.ellipse(0.5 * U, y - 0.06 * U, 0.3 * U, 0.075 * U, 0, 0, TAU); ctx.fill();
  } else if (!sit) { drawLeg(1, darkFur); drawLeg(3, darkFur); }

  ctx.save();
  // the whole upper body pitches a little at lope / gallop
  const pivX = -0.1 * U; ctx.translate(pivX, by); ctx.rotate(pitch); ctx.translate(-pivX, -by);
  // tail: curled up over the back, bushy
  const wag = Math.sin(ph * TAU * (run ? 1 : 0.6)) * 0.04 * U;
  const tailG = ctx.createLinearGradient(-0.9 * U, by - 0.6 * U, -0.4 * U, by);
  tailG.addColorStop(0, col(shade(light, -0.02))); tailG.addColorStop(1, midFur);
  ctx.strokeStyle = tailG; ctx.lineWidth = 0.2 * U; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.55 * U, by - 0.14 * U); ctx.bezierCurveTo(-0.85 * U, by - 0.14 * U, -0.88 * U + wag, by - 0.58 * U, -0.58 * U + wag, by - 0.5 * U); ctx.stroke();
  ctx.strokeStyle = col(shade(light, 0.2)); ctx.lineWidth = 0.1 * U;
  ctx.beginPath(); ctx.moveTo(-0.84 * U + wag, by - 0.4 * U); ctx.quadraticCurveTo(-0.8 * U + wag, by - 0.56 * U, -0.6 * U + wag, by - 0.51 * U); ctx.stroke();

  // torso silhouette: deep chest, tucked waist, rounded croup
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(0.46 * U, by - 0.2 * U);                                   // base of neck (top)
    ctx.bezierCurveTo(0.36 * U, by - 0.34 * U, 0.12 * U, by - 0.3 * U, -0.1 * U, by - 0.27 * U);  // withers to back
    ctx.bezierCurveTo(-0.3 * U, by - 0.26 * U, -0.46 * U, by - 0.3 * U, -0.58 * U, by - 0.16 * U); // loin to croup
    ctx.bezierCurveTo(-0.7 * U, by - 0.02 * U, -0.66 * U, by + 0.2 * U, -0.5 * U, by + 0.22 * U);  // rump and thigh
    ctx.bezierCurveTo(-0.34 * U, by + 0.18 * U, -0.2 * U, by + 0.16 * U, -0.06 * U, by + 0.24 * U); // flank tuck to belly
    ctx.bezierCurveTo(0.1 * U, by + 0.34 * U, 0.34 * U, by + 0.38 * U, 0.46 * U, by + 0.26 * U);    // deep chest
    ctx.bezierCurveTo(0.56 * U, by + 0.16 * U, 0.58 * U, by - 0.04 * U, 0.46 * U, by - 0.2 * U);    // chest front
    ctx.closePath();
  };
  const bg = ctx.createLinearGradient(0, by - 0.34 * U, 0, by + 0.38 * U);
  bg.addColorStop(0, col(shade(base, 0.2))); bg.addColorStop(0.5, midFur); bg.addColorStop(1, col(shade(base, -0.24)));
  ctx.fillStyle = bg; body(); ctx.fill();
  ctx.save(); body(); ctx.clip();
  // dark saddle over the back, white belly and chest
  ctx.fillStyle = markFur; ctx.beginPath(); ctx.moveTo(0.5 * U, by - 0.3 * U); ctx.bezierCurveTo(0.2 * U, by - 0.02 * U, -0.3 * U, by - 0.02 * U, -0.72 * U, by - 0.28 * U); ctx.lineTo(-0.72 * U, by - 0.5 * U); ctx.lineTo(0.5 * U, by - 0.5 * U); ctx.closePath(); ctx.fill();
  ctx.fillStyle = liteFur; ctx.beginPath(); ctx.moveTo(-0.1 * U, by + 0.46 * U); ctx.bezierCurveTo(0.0 * U, by + 0.16 * U, 0.3 * U, by + 0.2 * U, 0.6 * U, by - 0.04 * U); ctx.lineTo(0.7 * U, by + 0.5 * U); ctx.closePath(); ctx.fill();
  // fur texture: short strokes along the coat
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(1, 0.012 * U);
  for (let i = 0; i < 16; i++) { const fx = (-0.6 + (i / 15) * 1.1) * U, fy = by + (hash(i + 3) - 0.6) * 0.45 * U; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 0.06 * U, fy + 0.03 * U); ctx.stroke(); }
  // under-shade near the belly
  const sh = ctx.createLinearGradient(0, by + 0.05 * U, 0, by + 0.4 * U); sh.addColorStop(0, 'rgba(10,20,50,0)'); sh.addColorStop(1, 'rgba(10,20,50,0.28)');
  ctx.fillStyle = sh; ctx.fillRect(-0.8 * U, by, 1.5 * U, 0.5 * U);
  ctx.restore();
  // rim light on the back
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.03 * U;
  ctx.beginPath(); ctx.moveTo(0.4 * U, by - 0.3 * U); ctx.bezierCurveTo(0.12 * U, by - 0.32 * U, -0.3 * U, by - 0.28 * U, -0.56 * U, by - 0.18 * U); ctx.stroke();
  // harness: chest band, back strap to the tow point, small pad
  const hc = o.harness || '#e0683a';
  ctx.strokeStyle = hc; ctx.lineCap = 'round'; ctx.lineWidth = 0.075 * U;
  ctx.beginPath(); ctx.moveTo(0.2 * U, by - 0.3 * U); ctx.quadraticCurveTo(0.36 * U, by + 0.02 * U, 0.34 * U, by + 0.27 * U); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.22 * U, by - 0.28 * U); ctx.lineTo(-0.5 * U, by - 0.19 * U); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.02 * U;
  ctx.beginPath(); ctx.moveTo(0.22 * U, by - 0.3 * U); ctx.lineTo(-0.5 * U, by - 0.21 * U); ctx.stroke();

  // neck and head
  const hdx = run && g >= 3 ? 0.84 : 0.76, hdy = run && g >= 3 ? by - 0.2 : lie ? by + 0.0 : by - 0.3;
  const nod = run ? Math.sin((ph * (g >= 3 ? 1 : 2) + 0.15) * TAU) * 0.025 * U : 0;
  const hx = hdx * U, hy = hdy + nod;
  ctx.fillStyle = midFur;
  ctx.beginPath(); ctx.moveTo(0.3 * U, by - 0.3 * U); ctx.quadraticCurveTo(0.55 * U, by - 0.34 * U, hx - 0.02 * U, hy - 0.18 * U);
  ctx.lineTo(hx + 0.08 * U, hy + 0.15 * U); ctx.quadraticCurveTo(0.56 * U, by + 0.12 * U, 0.46 * U, by + 0.26 * U); ctx.lineTo(0.3 * U, by + 0.1 * U); ctx.closePath(); ctx.fill();
  // fur ruff under the chin / chest
  ctx.fillStyle = liteFur;
  ctx.beginPath(); ctx.moveTo(hx - 0.06 * U, hy + 0.08 * U);
  for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(hx - 0.08 * U - i * 0.06 * U, hy + 0.2 * U + i * 0.05 * U, hx - 0.14 * U - i * 0.065 * U, hy + 0.14 * U + i * 0.06 * U);
  ctx.lineTo(0.46 * U, by + 0.22 * U); ctx.lineTo(hx + 0.08 * U, hy + 0.15 * U); ctx.closePath(); ctx.fill();
  // far ear then near ear
  const ear = (ox, oy, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(hx + ox - 0.1 * U, hy + oy - 0.06 * U); ctx.quadraticCurveTo(hx + ox - 0.1 * U, hy + oy - 0.3 * U, hx + ox - 0.03 * U, hy + oy - 0.4 * U); ctx.quadraticCurveTo(hx + ox + 0.1 * U, hy + oy - 0.24 * U, hx + ox + 0.1 * U, hy + oy - 0.06 * U); ctx.closePath(); ctx.fill(); };
  ear(0.07 * U, 0.02 * U, darkFur);
  // skull and muzzle
  const hg = ctx.createLinearGradient(0, hy - 0.2 * U, 0, hy + 0.2 * U);
  hg.addColorStop(0, col(shade(base, 0.2))); hg.addColorStop(1, col(shade(base, -0.12)));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, 0.2 * U, 0.18 * U, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = liteFur;
  ctx.beginPath(); ctx.moveTo(hx + 0.02 * U, hy - 0.1 * U); ctx.quadraticCurveTo(hx + 0.28 * U, hy - 0.1 * U, hx + 0.43 * U, hy + 0.01 * U);
  ctx.quadraticCurveTo(hx + 0.46 * U, hy + 0.06 * U, hx + 0.4 * U, hy + 0.1 * U); ctx.quadraticCurveTo(hx + 0.2 * U, hy + 0.19 * U, hx - 0.08 * U, hy + 0.16 * U); ctx.closePath(); ctx.fill();
  // dark mask over the eye and forehead
  ctx.fillStyle = markFur; ctx.beginPath(); ctx.moveTo(hx - 0.18 * U, hy - 0.06 * U); ctx.quadraticCurveTo(hx, hy - 0.2 * U, hx + 0.22 * U, hy - 0.08 * U); ctx.quadraticCurveTo(hx + 0.1 * U, hy - 0.02 * U, hx + 0.02 * U, hy + 0.0 * U); ctx.quadraticCurveTo(hx - 0.1 * U, hy + 0.05 * U, hx - 0.18 * U, hy - 0.06 * U); ctx.fill();
  // nose, mouth line, eye
  ctx.fillStyle = '#0d1522'; ctx.beginPath(); ctx.ellipse(hx + 0.43 * U, hy + 0.025 * U, 0.04 * U, 0.032 * U, 0.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(20,20,30,0.55)'; ctx.lineWidth = Math.max(1, 0.013 * U); ctx.beginPath(); ctx.moveTo(hx + 0.4 * U, hy + 0.08 * U); ctx.quadraticCurveTo(hx + 0.24 * U, hy + 0.11 * U, hx + 0.12 * U, hy + 0.08 * U); ctx.stroke();
  ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(hx + 0.15 * U, hy - 0.025 * U, 0.04 * U, 0.03 * U, -0.25, 0, TAU); ctx.fill();
  ctx.fillStyle = '#081018'; ctx.beginPath(); ctx.arc(hx + 0.16 * U, hy - 0.025 * U, 0.017 * U, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 0.165 * U, hy - 0.035 * U, 0.008 * U, 0, TAU); ctx.fill();
  if (o.tongue) {
    const t = 0.05 + Math.abs(Math.sin(ph * TAU * (g >= 3 ? 1 : 2))) * 0.035;
    ctx.fillStyle = '#e8708a'; ctx.beginPath(); ctx.moveTo(hx + 0.3 * U, hy + 0.12 * U); ctx.quadraticCurveTo(hx + 0.3 * U, hy + (0.2 + t) * U, hx + 0.24 * U, hy + (0.25 + t) * U); ctx.quadraticCurveTo(hx + 0.2 * U, hy + (0.2 + t) * U, hx + 0.2 * U, hy + 0.14 * U); ctx.closePath(); ctx.fill();
  }
  ear(-0.04 * U, 0, markFur);
  ctx.fillStyle = col(shade(base, -0.05)); ctx.beginPath(); ctx.moveTo(hx - 0.08 * U, hy - 0.08 * U); ctx.quadraticCurveTo(hx - 0.08 * U, hy - 0.22 * U, hx - 0.04 * U, hy - 0.3 * U); ctx.quadraticCurveTo(hx + 0.04 * U, hy - 0.2 * U, hx + 0.02 * U, hy - 0.08 * U); ctx.closePath(); ctx.fill();
  ctx.restore();

  if (lie) {
    ctx.fillStyle = midFur; ctx.beginPath(); ctx.ellipse(-0.3 * U, y - 0.08 * U, 0.3 * U, 0.1 * U, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = liteFur; ctx.beginPath(); ctx.ellipse(0.62 * U, y - 0.05 * U, 0.3 * U, 0.06 * U, 0, 0, TAU); ctx.fill();
  } else { drawLeg(0, midFur); drawLeg(2, midFur); }
  ctx.restore();
}

// The sled: wooden runners, a basket, a handlebar and a snow-hook brake. (x, y) = ground under the middle of the runners, facing right.
// o = { riders: number of dogs riding in the bag (their heads peek out), brake: bool, tilt }
export function drawSled(ctx, x, y, u, o = {}) {
  const U = u;
  ctx.save(); ctx.translate(x, 0);
  ctx.fillStyle = 'rgba(20,34,80,0.2)'; ctx.beginPath(); ctx.ellipse(-0.1 * U, y + 1, 2.2 * U, 0.12 * U, 0, 0, TAU); ctx.fill();
  // runners (long tails at the back for the musher)
  ctx.strokeStyle = '#4a2e1a'; ctx.lineWidth = 0.14 * U; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2.4 * U, y - 0.1 * U); ctx.lineTo(1.2 * U, y - 0.1 * U); ctx.quadraticCurveTo(1.7 * U, y - 0.1 * U, 1.85 * U, y - 0.5 * U); ctx.stroke();
  ctx.strokeStyle = '#d3dce8'; ctx.lineWidth = 0.05 * U;
  ctx.beginPath(); ctx.moveTo(-2.3 * U, y - 0.02 * U); ctx.lineTo(1.2 * U, y - 0.02 * U); ctx.stroke();
  // stanchions
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 0.1 * U;
  [-1.2, -0.2, 0.9].forEach((px) => { ctx.beginPath(); ctx.moveTo(px * U, y - 0.1 * U); ctx.lineTo(px * U, y - 0.42 * U); ctx.stroke(); });
  // basket
  const g = ctx.createLinearGradient(0, y - 1.0 * U, 0, y - 0.35 * U);
  g.addColorStop(0, '#e8844a'); g.addColorStop(1, '#a8431c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-1.45 * U, y - 0.45 * U); ctx.lineTo(1.6 * U, y - 0.45 * U); ctx.quadraticCurveTo(1.85 * U, y - 0.62 * U, 1.7 * U, y - 0.95 * U);
  ctx.lineTo(-1.35 * U, y - 0.9 * U); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.04 * U; ctx.beginPath(); ctx.moveTo(-1.3 * U, y - 0.86 * U); ctx.lineTo(1.6 * U, y - 0.9 * U); ctx.stroke();
  // a gear bag with a pack stripe
  ctx.fillStyle = '#26346b'; ctx.beginPath(); ctx.roundRect(-1.1 * U, y - 1.15 * U, 1.1 * U, 0.38 * U, 0.1 * U); ctx.fill();
  ctx.fillStyle = '#f5c14a'; ctx.fillRect(-1.1 * U, y - 1.0 * U, 1.1 * U, 0.06 * U);
  // dogs riding in the bag
  for (let k = 0; k < (o.riders || 0); k++) {
    const hx = 0.5 * U + k * 0.55 * U, hy = y - 1.0 * U;
    ctx.fillStyle = k % 2 ? '#c8a47a' : '#dfe5ec';
    ctx.beginPath(); ctx.ellipse(hx, hy, 0.2 * U, 0.18 * U, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - 0.14 * U, hy - 0.08 * U); ctx.lineTo(hx - 0.1 * U, hy - 0.34 * U); ctx.lineTo(hx + 0.04 * U, hy - 0.12 * U); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(hx + 0.12 * U, hy + 0.05 * U, 0.12 * U, 0.08 * U, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#10161f'; ctx.beginPath(); ctx.arc(hx + 0.07 * U, hy - 0.02 * U, 0.03 * U, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 0.2 * U, hy + 0.02 * U, 0.025 * U, 0, TAU); ctx.fill();
  }
  // handlebar (a bow behind the basket) and the snow-hook brake
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 0.09 * U;
  ctx.beginPath(); ctx.moveTo(-1.4 * U, y - 0.9 * U); ctx.lineTo(-1.78 * U, y - 1.62 * U); ctx.lineTo(-1.5 * U, y - 1.7 * U); ctx.stroke();
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 0.06 * U;
  ctx.beginPath(); ctx.moveTo(-1.5 * U, y - 0.6 * U); ctx.lineTo(-2.0 * U, y - 0.15 * U); ctx.stroke();
  ctx.strokeStyle = o.brake ? '#e9eef5' : '#8a97a8'; ctx.lineWidth = 0.07 * U;
  ctx.beginPath(); ctx.moveTo(-2.0 * U, y - 0.15 * U); ctx.lineTo(-2.0 * U, y + (o.brake ? 0.05 : -0.3) * U); ctx.stroke();
  ctx.restore();
}

// The musher standing on the runner tails at the back of the sled, holding the handlebar. (x, y) = ground under the feet, u = px per metre.
// lean: radians forward (+) / back (-); kick: 0..1 pushing off with one foot; ph: kick cycle; wave: raised arm at the finish.
export function drawMusher(ctx, x, y, u, o = {}) {
  const S = u * 1.45, lean = o.lean || 0, kick = o.kick || 0, ph = o.ph || 0;
  const parka = '#2a6fb5', parkaDark = '#17487c', parkaLite = '#58a6ec', fur = '#f4e6cc', trousers = '#27304a', boot = '#3a2c24', glove = '#e8c07a', skin = '#e3ae8c';
  ctx.save(); ctx.translate(x, y);
  const P = (px, py) => [px * S, py * S];
  // feet on the runner (front foot planted, rear foot pushing when kicking)
  const k = kick * Math.max(0, Math.sin(ph * TAU));
  const hipX = 0.0, hipY = -0.92;                                      // metres, y up negative, origin between the feet
  const bend = 0.1 + 0.04 * Math.sin(ph * TAU * 0.5) * kick;
  const hipPx = P(hipX + lean * 0.12, hipY + bend);
  const footA = P(0.2, 0), footB = [(-0.15 - 0.55 * k) * S, -0.02 * S - 0.18 * k * S * (k > 0.3 ? 1 : 0)];
  const legs = (foot, fillC, far) => {
    const [kn, ft] = ik(hipPx[0], hipPx[1], foot[0], foot[1] - 0.09 * S, 0.45 * S, 0.45 * S, -1);
    bone(ctx, hipPx[0], hipPx[1], kn[0], kn[1], 0.2 * S, 0.15 * S, fillC);
    bone(ctx, kn[0], kn[1], ft[0], ft[1], 0.15 * S, 0.12 * S, fillC);
    ctx.fillStyle = boot; ctx.beginPath(); ctx.roundRect(foot[0] - 0.1 * S, foot[1] - 0.14 * S, 0.34 * S, 0.14 * S, 0.06 * S); ctx.fill();
  };
  legs(footB, shade(trousers, -0.18)); legs(footA, trousers);
  // torso: a long parka, leaning from the hips
  ctx.save(); ctx.translate(hipPx[0], hipPx[1]); ctx.rotate(lean);
  const tg = ctx.createLinearGradient(-0.3 * S, 0, 0.3 * S, 0);
  tg.addColorStop(0, parkaDark); tg.addColorStop(0.55, parka); tg.addColorStop(1, parkaLite);
  ctx.fillStyle = tg; ctx.beginPath();
  ctx.moveTo(-0.24 * S, 0.22 * S); ctx.lineTo(-0.24 * S, -0.42 * S); ctx.quadraticCurveTo(-0.26 * S, -0.72 * S, 0.0 * S, -0.78 * S);
  ctx.quadraticCurveTo(0.26 * S, -0.72 * S, 0.26 * S, -0.4 * S); ctx.lineTo(0.3 * S, 0.22 * S); ctx.closePath(); ctx.fill();
  ctx.fillStyle = fur; ctx.fillRect(-0.25 * S, 0.16 * S, 0.55 * S, 0.07 * S);              // fur hem
  ctx.fillStyle = '#e0683a'; ctx.fillRect(-0.24 * S, -0.16 * S, 0.5 * S, 0.05 * S);          // belt / bib stripe
  // far arm first (behind the body line), then head and hood, then the near arm
  const shX = 0.02 * S, shY = -0.7 * S;
  const arm = (sx2, sy2, hx, hy, c) => {
    const [el, hand] = ik(sx2, sy2, hx, hy, 0.3 * S, 0.3 * S, 1);
    bone(ctx, sx2, sy2, el[0], el[1], 0.17 * S, 0.13 * S, c);
    bone(ctx, el[0], el[1], hand[0], hand[1], 0.13 * S, 0.11 * S, c);
    ctx.fillStyle = glove; ctx.beginPath(); ctx.arc(hand[0], hand[1], 0.075 * S, 0, TAU); ctx.fill();
  };
  // the grip is fixed on the handlebar (in the musher frame); convert it into the leaning torso frame so the hands stay on the bar
  const T = [0.43 * S, -1.2 * S], dxp = T[0] - hipPx[0], dyp = T[1] - hipPx[1];
  const gx = dxp * Math.cos(-lean) - dyp * Math.sin(-lean), gy = dxp * Math.sin(-lean) + dyp * Math.cos(-lean);
  arm(shX - 0.04 * S, shY, gx - 0.02 * S, gy - 0.03 * S, parkaDark);
  // head: hood with fur ruff, face, goggles
  const hdx = 0.1 * S, hdy = -0.9 * S;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hdx + 0.04 * S, hdy, 0.115 * S, 0.135 * S, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = parka; ctx.beginPath(); ctx.arc(hdx - 0.02 * S, hdy - 0.02 * S, 0.17 * S, Math.PI * 0.8, Math.PI * 2.15); ctx.fill();
  ctx.strokeStyle = fur; ctx.lineWidth = 0.09 * S; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(hdx + 0.02 * S, hdy, 0.17 * S, Math.PI * 0.55, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = '#1b2236'; ctx.beginPath(); ctx.roundRect(hdx + 0.06 * S, hdy - 0.06 * S, 0.14 * S, 0.08 * S, 0.035 * S); ctx.fill();
  ctx.fillStyle = 'rgba(140,200,255,0.65)'; ctx.fillRect(hdx + 0.09 * S, hdy - 0.045 * S, 0.08 * S, 0.035 * S);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(hdx + 0.16 * S, hdy + 0.04 * S, 0.012 * S, 0, TAU); ctx.fill();
  // near arm: on the bar, or waving at the finish
  if (o.wave) {
    const w2 = Math.sin(ph * TAU * 2) * 0.12 * S;
    const [el, hand] = ik(shX, shY, 0.32 * S + w2, -1.18 * S, 0.3 * S, 0.3 * S, 1);
    bone(ctx, shX, shY, el[0], el[1], 0.17 * S, 0.13 * S, parka); bone(ctx, el[0], el[1], hand[0], hand[1], 0.13 * S, 0.11 * S, parka);
    ctx.fillStyle = glove; ctx.beginPath(); ctx.arc(hand[0], hand[1], 0.085 * S, 0, TAU); ctx.fill();
  } else arm(shX, shY, gx, gy, parka);
  ctx.restore();
  ctx.restore();
}

export function drawPine(ctx, x, y, h, snow, col = '#1d4a45') {
  const w = h * 0.4;
  ctx.fillStyle = '#4a3322'; ctx.fillRect(x - h * 0.025, y - h * 0.12, h * 0.05, h * 0.12);
  for (let k = 0; k < 4; k++) {
    const ty = y - h * 0.1 - k * h * 0.2, ww = w * (1 - k * 0.2);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, ty - h * 0.3); ctx.lineTo(x + ww, ty); ctx.lineTo(x - ww, ty); ctx.closePath(); ctx.fill();
    ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(x, ty - h * 0.3); ctx.lineTo(x + ww * 0.72, ty - h * 0.08); ctx.quadraticCurveTo(x, ty - h * 0.02, x - ww * 0.72, ty - h * 0.08); ctx.closePath(); ctx.fill();
  }
}

// A trail sign: post and an arrow board. dir 'L' (Haw) or 'R' (Gee). lit: pulses while the call window is open.
export function drawSign(ctx, x, y, u, dir, lit, label, fontFam) {
  const U = u;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(-0.06 * U, -2.5 * U, 0.12 * U, 2.5 * U);
  const w = 1.9 * U, h = 0.9 * U, by = -2.6 * U;
  ctx.fillStyle = lit ? '#ffd54a' : '#f2a63a';
  ctx.beginPath();
  if (dir === 'R') { ctx.moveTo(-w / 2, by - h / 2); ctx.lineTo(w / 2 - h * 0.5, by - h / 2); ctx.lineTo(w / 2 + 0.1 * U, by); ctx.lineTo(w / 2 - h * 0.5, by + h / 2); ctx.lineTo(-w / 2, by + h / 2); }
  else { ctx.moveTo(w / 2, by - h / 2); ctx.lineTo(-w / 2 + h * 0.5, by - h / 2); ctx.lineTo(-w / 2 - 0.1 * U, by); ctx.lineTo(-w / 2 + h * 0.5, by + h / 2); ctx.lineTo(w / 2, by + h / 2); }
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 0.06 * U; ctx.strokeStyle = '#5a2a0a'; ctx.stroke();
  ctx.fillStyle = '#3a1a06'; ctx.font = `800 ${Math.round(0.42 * U)}px ${fontFam}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, dir === 'R' ? -0.1 * U : 0.1 * U, by + 0.02 * U);
  // reflective stripes
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-0.06 * U, -1.2 * U, 0.12 * U, 0.12 * U); ctx.fillRect(-0.06 * U, -0.7 * U, 0.12 * U, 0.12 * U);
  ctx.restore();
}
