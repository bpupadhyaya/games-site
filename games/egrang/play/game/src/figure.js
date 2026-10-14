// The stilt walker: a side-view person on two bamboo stilts, solved with two-bone IK and drawn as lit, tapered limbs.
// walkerJoints() turns a racer (from sim.js) into joints in road metres; drawWalker() paints them through a mapper.
// Pure canvas 2D; the caller passes the mapper { X(m), Y(m), k } (metres to screen) and the lighting.
import { PHYS, trail, swingDur } from './sim.js';
import { groundH } from './courses.js';

const TAU = Math.PI * 2;
export const BODY = { thigh: 0.44, shin: 0.42, torso: 0.56, neck: 0.1, head: 0.14, uarm: 0.3, farm: 0.28, footH: 0.9, pole: 2.1, grip: 1.55 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };

// Two-bone IK in the (x, y-up) plane: root (sx,sy) to target (tx,ty); `bend` = +1/-1 picks the knee/elbow side.
function ik(sx, sy, tx, ty, a, b, bend) {
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1e-6;
  const max = a + b - 0.005, min = Math.abs(a - b) + 0.01;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < min) { dx *= min / d; dy *= min / d; d = min; }
  const base = Math.atan2(dy, dx), c = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), A = Math.acos(c) * bend;
  return { ex: sx + Math.cos(base + A) * a, ey: sy + Math.sin(base + A) * a, hx: sx + dx, hy: sy + dy };
}

// Joints of one racer in metres (y up, ground at the road height under each tip). `C` is the course (for the road profile).
export function walkerJoints(r, C) {
  const B = BODY, R = PHYS.R;
  const nearPlanted = r.foot % 2 === 0;
  const f = r.f, gf = groundH(C, f), gx = groundH(C, r.x);
  const swinging = r.phase === 'swing';
  // planted stilt: its base at the tip, leaning so it passes the hand point just ahead of the body
  const hpX = r.x + 0.12, hpY = gx + B.grip - 0.05;
  const pAng = Math.atan2(hpX - f, hpY - gf);
  const pDir = [Math.sin(pAng), Math.cos(pAng)];
  const pBase = [f, gf];
  const pFoot = [f + pDir[0] * B.footH, gf + pDir[1] * B.footH];
  // free stilt: trailing behind after a landing, a swing forward after a tap
  let fBase, fAng;
  if (swinging) {
    const s = clamp(r.swingT / swingDur(r), 0, 1), e = sm(s);
    const tx = r.x + R, ty = groundH(C, tx);
    fBase = [r.sw0.x + (tx - r.sw0.x) * e, ty * e + (groundH(C, r.sw0.x) + r.sw0.lift) * (1 - e) + 0.34 * Math.sin(Math.PI * s)];
    fAng = Math.atan2((r.x + 0.12) - fBase[0], B.grip - 0.05 + 0.0) * (1 - e) + Math.atan2((r.x + 0.12) - tx, B.grip - 0.05) * e;
    fAng = clamp(fAng, -0.7, 0.7);
  } else {
    const t = trail(r.prevF, r.x);
    fBase = [t.x, groundH(C, t.x) + t.lift];
    fAng = clamp(Math.atan2(r.x + 0.12 - fBase[0], B.grip - 0.05), -0.75, 0.75);
  }
  const fDir = [Math.sin(fAng), Math.cos(fAng)];
  const fFoot = [fBase[0] + fDir[0] * B.footH, fBase[1] + fDir[1] * B.footH];
  // hip: straight above the planted foot so the planted leg is nearly straight (bobs naturally over the stilt)
  const legMax = (B.thigh + B.shin) * 0.975;
  const dx = r.x - pFoot[0];
  const hipY = pFoot[1] + Math.sqrt(Math.max(0.04, legMax * legMax - dx * dx));
  const hip = [r.x, hipY];
  const u = r.x - r.f;
  const tor = clamp(u * 0.5 + (r.phase === 'down' ? 0 : 0), -0.4, 0.5);       // forward lean of the torso (radians)
  const roll = clamp(r.w, -1.2, 1.2);
  const sh = [hip[0] + Math.sin(tor) * B.torso, hip[1] + Math.cos(tor) * B.torso];
  const head = [sh[0] + Math.sin(tor * 0.7 + 0.1) * (B.neck + B.head * 0.9), sh[1] + Math.cos(tor * 0.7 + 0.1) * (B.neck + B.head * 0.9)];
  // grips on the poles (hands hold the stilt near chest height, on the side of the pole facing the body)
  const gripAt = (base, dir, h) => [base[0] + dir[0] * h, base[1] + dir[1] * h];
  const gN = nearPlanted ? gripAt(pBase, pDir, B.grip) : gripAt(fBase, fDir, B.grip);
  const gF = nearPlanted ? gripAt(fBase, fDir, B.grip) : gripAt(pBase, pDir, B.grip);
  const footN = nearPlanted ? pFoot : fFoot, footF = nearPlanted ? fFoot : pFoot;
  const legN = ik(hip[0], hip[1], footN[0], footN[1], B.thigh, B.shin, 1), legF = ik(hip[0], hip[1], footF[0], footF[1], B.thigh, B.shin, 1);
  // sideways wobble makes the arms fly out
  const flail = Math.abs(roll) * 0.28;
  const armN = ik(sh[0], sh[1], gN[0] + 0.02 + flail * 0.5, gN[1] + flail * 0.7, B.uarm, B.farm, -1);
  const armF = ik(sh[0], sh[1], gF[0] + 0.02 - flail * 0.35, gF[1] + flail * 0.9, B.uarm, B.farm, -1);
  return {
    hip, sh, head, tor, roll, nearPlanted, pBase, pDir, fBase, fDir, pFoot, fFoot, legN, legF, armN, armF, footN, footF, gN, gF,
    nearBase: nearPlanted ? pBase : fBase, nearDir: nearPlanted ? pDir : fDir, farBase: nearPlanted ? fBase : pBase, farDir: nearPlanted ? fDir : pDir,
  };
}

// ---- drawing --------------------------------------------------------------------------------------------------------------------
function tapered(ctx, ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  ctx.beginPath();
  ctx.moveTo(ax + nx * ra, ay + ny * ra); ctx.lineTo(bx + nx * rb, by + ny * rb);
  ctx.arc(bx, by, rb, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(ax - nx * ra, ay - ny * ra);
  ctx.arc(ax, ay, ra, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
}
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16), c = (v) => clamp(Math.round(v * f), 0, 255);
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

export function drawPole(ctx, T, base, dir, o = {}) {
  const k = T.k, x0 = T.X(base[0]), y0 = T.Y(base[1]), x1 = T.X(base[0] + dir[0] * BODY.pole), y1 = T.Y(base[1] + dir[1] * BODY.pole);
  const w = 0.075 * k, dark = o.dark ?? 1;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(30,20,6,${0.55 * (o.alpha ?? 1)})`; ctx.lineWidth = w + 2.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = shade('#a8b648', dark); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = shade('#d6e27a', dark); ctx.lineWidth = w * 0.34; ctx.globalAlpha = 0.8;
  const nx = (y1 - y0), ny = -(x1 - x0), nl = Math.hypot(nx, ny) || 1, ox = -nx / nl * w * 0.22, oy = -ny / nl * w * 0.22;
  ctx.beginPath(); ctx.moveTo(x0 + ox, y0 + oy); ctx.lineTo(x1 + ox, y1 + oy); ctx.stroke(); ctx.globalAlpha = 1;
  // bamboo joints
  ctx.strokeStyle = shade('#6d7a24', dark); ctx.lineWidth = Math.max(1.5, w * 0.2);
  for (let i = 1; i <= 5; i++) {
    const t = i / 5.6, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
    ctx.beginPath(); ctx.moveTo(px - nx / nl * w * 0.5, py - ny / nl * w * 0.5); ctx.lineTo(px + nx / nl * w * 0.5, py + ny / nl * w * 0.5); ctx.stroke();
  }
  // footrest: a short peg lashed with a dark cord
  const fx = x0 + (x1 - x0) * (BODY.footH / BODY.pole), fy = y0 + (y1 - y0) * (BODY.footH / BODY.pole);
  ctx.strokeStyle = shade('#7a4a1c', dark); ctx.lineWidth = w * 0.8;
  ctx.beginPath(); ctx.moveTo(fx - w * 0.2, fy + w * 0.1); ctx.lineTo(fx + w * 1.7, fy + w * 0.1); ctx.stroke();
  ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(1.5, w * 0.22);
  ctx.beginPath(); ctx.moveTo(fx - w * 0.5, fy - w * 0.2); ctx.lineTo(fx + w * 0.5, fy + w * 0.4); ctx.stroke();
  ctx.restore();
}

// look: { skin, shirt, shorts, hair, style, accent }; o: { alpha, sil (flat colour), flailT (seconds for hair/arm life) }
export function drawWalker(ctx, J, look, T, o = {}) {
  const k = T.k, X = (p) => T.X(p[0]), Y = (p) => T.Y(p[1]);
  const flat = o.sil ?? null;
  const skin = flat ?? look.skin, skinHi = flat ?? shade(look.skin, 1.22), skinLo = flat ?? shade(look.skin, 0.72);
  const rimC = 'rgba(28,12,6,0.5)';
  const rims = [], fills = [];
  let immediate = false;
  const limb = (a, b, ra, rb, col, hi, lo) => {
    const ax = X(a), ay = Y(a), bx = X(b), by = Y(b), A = ra * k, B = rb * k;
    const rimFn = () => { tapered(ctx, ax, ay, bx, by, A + 1.6, B + 1.6); ctx.fillStyle = rimC; ctx.fill(); };
    if (!flat) { if (immediate) rimFn(); else rims.push(rimFn); }
    const fillFn = () => {
      tapered(ctx, ax, ay, bx, by, A, B); ctx.fillStyle = col; ctx.fill();
      if (flat) return;
      const d = Math.hypot(bx - ax, by - ay) || 1;
      let nx = -(by - ay) / d, ny = (bx - ax) / d; if (nx + ny > 0) { nx = -nx; ny = -ny; }
      const rm = (A + B) / 2;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = hi; ctx.globalAlpha = 0.5; ctx.lineWidth = rm * 0.6;
      ctx.beginPath(); ctx.moveTo(ax + nx * rm * 0.38, ay + ny * rm * 0.38); ctx.lineTo(bx + nx * rm * 0.38, by + ny * rm * 0.38); ctx.stroke();
      ctx.strokeStyle = lo; ctx.globalAlpha = 0.42; ctx.lineWidth = rm * 0.5;
      ctx.beginPath(); ctx.moveTo(ax - nx * rm * 0.6, ay - ny * rm * 0.6); ctx.lineTo(bx - nx * rm * 0.6, by - ny * rm * 0.6); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineCap = 'round';
    };
    if (immediate) fillFn(); else fills.push(fillFn);
  };
  const disc = (p, r, col) => { const x = X(p), y = Y(p); fills.push(() => { ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.fillStyle = col; ctx.fill(); }); };
  const op = (fn) => fills.push(fn);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const shorts = flat ?? look.shorts, shirt = flat ?? look.shirt;
  const leg = (L, foot, base, dir, far) => {
    const dk = far ? 0.78 : 1;
    // thigh (shorts), shin, foot resting on the peg
    const knee = [L.ex, L.ey], hip = J.hip, ankle = [L.hx, L.hy];
    limb(ankle, knee, 0.058, 0.07, flat ?? shade(look.skin, dk), skinHi, skinLo);
    const toe = [ankle[0] + 0.15, ankle[1] - 0.025];
    limb(ankle, toe, 0.05, 0.036, flat ?? shade(look.skin, dk), skinHi, skinLo);
    limb(knee, [hip[0] + (knee[0] - hip[0]) * 0.16, hip[1] + (knee[1] - hip[1]) * 0.16], 0.098, 0.112, flat ?? shade(shorts, dk), flat ?? shade(shorts, 1.25 * dk), flat ?? shade(shorts, 0.7 * dk));
  };
  const arm = (A, far) => {
    const dk = far ? 0.8 : 1;
    const sk = flat ?? shade(look.skin, dk);
    limb(J.sh, [A.ex, A.ey], 0.06, 0.05, sk, sk, sk);
    limb([A.ex, A.ey], [A.hx, A.hy], 0.043, 0.036, sk, sk, sk);
    disc([A.hx, A.hy], 0.043, flat ?? shade(look.skin, dk * 1.04));
  };
  // far side first
  op(() => drawPole(ctx, T, J.farBase, J.farDir, { dark: 0.78 }));
  leg(J.legF, J.footF, J.farBase, J.farDir, true);
  arm(J.armF, true);
  // torso, shorts and head are one layer between the far and the near side
  op(() => { immediate = true;
  const hip = J.hip, sh = J.sh, tn = [sh[0] - hip[0], sh[1] - hip[1]], tl = Math.hypot(tn[0], tn[1]) || 1, nrm = [tn[1] / tl, -tn[0] / tl];
  const wHip = 0.15, wSh = 0.17;
  const pts = [
    [hip[0] - nrm[0] * wHip, hip[1] - nrm[1] * wHip], [hip[0] + nrm[0] * wHip, hip[1] + nrm[1] * wHip],
    [sh[0] + nrm[0] * wSh, sh[1] + nrm[1] * wSh], [sh[0] - nrm[0] * wSh, sh[1] - nrm[1] * wSh],
  ];
  const path = (ps) => {
    const mid = (a, b, o) => [(a[0] + b[0]) / 2 + nrm[0] * o, (a[1] + b[1]) / 2 + nrm[1] * o];
    const cR = mid(ps[1], ps[2], 0.025), cL = mid(ps[3], ps[0], -0.02), cT = [(ps[2][0] + ps[3][0]) / 2 + tn[0] / tl * 0.07, (ps[2][1] + ps[3][1]) / 2 + tn[1] / tl * 0.07];
    ctx.beginPath(); ctx.moveTo(X(ps[0]), Y(ps[0])); ctx.lineTo(X(ps[1]), Y(ps[1]));
    ctx.quadraticCurveTo(X(cR), Y(cR), X(ps[2]), Y(ps[2]));
    ctx.quadraticCurveTo(X(cT), Y(cT), X(ps[3]), Y(ps[3]));
    ctx.quadraticCurveTo(X(cL), Y(cL), X(ps[0]), Y(ps[0])); ctx.closePath();
  };
  if (!flat) { path(pts); ctx.lineWidth = 3.2; ctx.strokeStyle = rimC; ctx.stroke(); }
  // shirt
  path(pts);
  if (flat) ctx.fillStyle = flat;
  else { const g = ctx.createLinearGradient(X(pts[0]), Y(pts[0]), X(pts[1]), Y(pts[1])); g.addColorStop(0, shade(shirt, 1.18)); g.addColorStop(0.55, shirt); g.addColorStop(1, shade(shirt, 0.72)); ctx.fillStyle = g; }
  ctx.fill();
  // belt / shorts top
  const wl = [hip[0] + tn[0] * 0.16 / tl * 0.5, hip[1] + tn[1] * 0.16 / tl * 0.5];
  limb([hip[0] - nrm[0] * 0.02, hip[1]], [hip[0] + nrm[0] * 0.02, hip[1] + 0.01], 0.17, 0.17, flat ?? shorts, flat ?? shade(shorts, 1.2), flat ?? shade(shorts, 0.75));
  if (!flat) { ctx.strokeStyle = look.accent; ctx.lineWidth = 0.05 * k; const q0 = [wl[0] - nrm[0] * wHip, wl[1] - nrm[1] * wHip], q1 = [wl[0] + nrm[0] * wHip, wl[1] + nrm[1] * wHip]; ctx.beginPath(); ctx.moveTo(X(q0), Y(q0)); ctx.lineTo(X(q1), Y(q1)); ctx.stroke(); }
  // neck + head
  limb(sh, [J.head[0] - (J.head[0] - sh[0]) * 0.3, J.head[1] - (J.head[1] - sh[1]) * 0.3], 0.045, 0.04, skin, skinHi, skinLo);
  const hx = X(J.head), hy = Y(J.head), hr = BODY.head * k;
  if (!flat) { ctx.beginPath(); ctx.arc(hx, hy, hr + 1.6, 0, TAU); ctx.fillStyle = rimC; ctx.fill(); }
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU);
  if (flat) ctx.fillStyle = flat;
  else { const g = ctx.createRadialGradient(hx - hr * 0.35, hy - hr * 0.4, hr * 0.1, hx, hy, hr * 1.05); g.addColorStop(0, skinHi); g.addColorStop(0.6, skin); g.addColorStop(1, skinLo); ctx.fillStyle = g; }
  ctx.fill();
  if (!flat) {
    // nose, eye, hair, headband (the person faces right)
    ctx.fillStyle = skinHi; ctx.beginPath(); ctx.ellipse(hx + hr * 0.95, hy + hr * 0.08, hr * 0.2, hr * 0.17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0f0a'; ctx.beginPath(); ctx.arc(hx + hr * 0.5, hy - hr * 0.1, Math.max(1.2, hr * 0.1), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,24,16,0.8)'; ctx.lineWidth = Math.max(1, hr * 0.08); ctx.beginPath(); ctx.arc(hx + hr * 0.42, hy + hr * 0.3, hr * 0.28, 0.2, 1.7); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.clip();
    ctx.fillStyle = look.hair;
    if (look.style === 'long') { ctx.beginPath(); ctx.ellipse(hx - hr * 0.18, hy - hr * 0.1, hr * 1.02, hr * 1.0, 0, Math.PI * 0.62, Math.PI * 2.05); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(hx - hr * 0.12, hy - hr * 0.42, hr * 1.1, hr * 0.78, 0, 0, TAU); ctx.fill(); }
    if (look.style === 'cap') { ctx.fillStyle = look.accent; ctx.beginPath(); ctx.ellipse(hx - hr * 0.05, hy - hr * 0.5, hr * 1.1, hr * 0.62, 0, 0, TAU); ctx.fill(); ctx.fillStyle = shade(look.accent, 0.7); ctx.fillRect(hx + hr * 0.2, hy - hr * 0.35, hr * 1.1, hr * 0.14); }
    else if (look.style === 'scarf') { ctx.fillStyle = look.accent; ctx.beginPath(); ctx.ellipse(hx - hr * 0.08, hy - hr * 0.35, hr * 1.12, hr * 0.85, 0, Math.PI * 1.0, Math.PI * 2.0); ctx.fill(); }
    else { ctx.fillStyle = look.accent; ctx.fillRect(hx - hr, hy - hr * 0.72, hr * 2, hr * 0.2); }
    ctx.restore();
    if (look.style === 'scarf' || look.style === 'long') { // a tail of cloth or hair streaming behind
      ctx.strokeStyle = look.style === 'scarf' ? look.accent : look.hair; ctx.lineWidth = hr * 0.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx - hr * 0.8, hy - hr * 0.1); ctx.quadraticCurveTo(hx - hr * 1.7, hy + hr * 0.1 + Math.sin((o.flailT ?? 0) * 6) * hr * 0.3, hx - hr * 2.2, hy + hr * 0.7); ctx.stroke();
    }
  }
  immediate = false; });
  // near side last
  leg(J.legN, J.footN, J.nearBase, J.nearDir, false);
  op(() => drawPole(ctx, T, J.nearBase, J.nearDir, { dark: 1 }));
  arm(J.armN, false);
  for (const r of rims) r();
  for (const fn of fills) fn();
  ctx.restore();
}

// A pose frozen for menus and the Rules pictures: planted stilt ahead, mid-stride. Builds a fake racer.
export function demoRacer(u = 0.3, phase = 'stance', s = 0, foot = 0) {
  return { x: 0, v: 1.5, f: -u, prevF: -u - 0.95, foot, phase, swingT: s * (PHYS.SWING_T), w: 0, wv: 0, stuck: false, sw0: { x: -u - 0.95 + 0.4, lift: 0.2 }, downT: 0, downKind: '', standT: 0 };
}
