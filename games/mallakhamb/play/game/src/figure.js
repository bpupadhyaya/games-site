// The performer: a small rig (pelvis, torso, head, two-bone arms and legs with inverse kinematics) drawn as lit, tapered limbs.
// A pose is a set of target points relative to the pole axis (x = 0) and to the pelvis height of a standing performer (y = 0, y down),
// in "units" where the torso is ~96 long. Poses interpolate smoothly because every limb is solved from its end point, so limb lengths
// never change. Pure canvas 2D; the caller passes the screen anchor, scale and spin angle.
const TAU = Math.PI * 2;
export const RIG = { torso: 96, head: 21, neck: 29, uarm: 54, farm: 48, thigh: 74, shin: 72, shw: 25, hipw: 13 };
const STAND_FOOT = RIG.thigh + RIG.shin;      // pelvis-to-ground distance of a standing performer

const P = (o) => ({ p: [0, 0], tor: 0, hd: 0, hl: [-6, -178], hr: [6, -178], fl: [-12, 146], fr: [12, 146], el: 1, er: -1, kl: 1, kr: -1, ...o });

// Screen-left / screen-right limbs of an upright performer. el/er and kl/kr choose which way the elbow or knee points (+1 = to the
// screen-left side of the limb direction).
export const POSES = {
  salute: P({ p: [58, 0], hl: [52, -62], hr: [64, -62], fl: [44, 146], fr: [72, 146], el: 1, er: -1 }),
  grip: P({ p: [0, 12], hl: [-5, -192], hr: [7, -150], fl: [-13, 160], fr: [13, 157], tor: 1, el: -1, er: 1 }),
  tuck: P({ p: [0, 12], hl: [-5, -192], hr: [7, -150], fl: [-26, 78], fr: [26, 78], kl: 1, kr: -1, tor: 0, el: -1, er: 1 }),
  wrap: P({ p: [0, 8], hl: [-5, -188], hr: [7, -146], fl: [10, 112], fr: [-10, 138], kl: 1, kr: -1, tor: -3, el: -1, er: 1 }),
  slide: P({ p: [0, 26], hl: [-5, -170], hr: [7, -126], fl: [-8, 172], fr: [8, 172], tor: -2, el: -1, er: 1 }),
  flag: P({ p: [120, -34], tor: -90, hd: 8, hl: [3, 84], hr: [3, -146], fl: [262, -40], fr: [262, -10], el: 1, er: -1, kl: 1, kr: -1 }),
  split: P({ p: [0, 4], hl: [-5, -192], hr: [7, -150], fl: [-138, 40], fr: [138, 40], kl: 1, kr: -1, el: -1, er: 1 }),
  ulta: P({ p: [0, -46], tor: 180, hd: 0, hl: [-86, 96], hr: [86, 96], fl: [-58, -176], fr: [58, -176], el: -1, er: 1, kl: -1, kr: 1 }),
  vsplit: P({ p: [0, 12], tor: -5, hl: [-5, -192], hr: [7, -150], fl: [-10, 160], fr: [52, -122], kl: 1, kr: -1, el: -1, er: 1 }),
};

const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
export function blend(a, b, k) {
  return {
    p: lerp2(a.p, b.p, k), tor: lerp(a.tor, b.tor, k), hd: lerp(a.hd, b.hd, k),
    hl: lerp2(a.hl, b.hl, k), hr: lerp2(a.hr, b.hr, k), fl: lerp2(a.fl, b.fl, k), fr: lerp2(a.fr, b.fr, k),
    el: k < 0.5 ? a.el : b.el, er: k < 0.5 ? a.er : b.er, kl: k < 0.5 ? a.kl : b.kl, kr: k < 0.5 ? a.kr : b.kr,
  };
}
// Add a small sway (balance error to either side) and a breath. sway is -1..1.
export function sway(pose, sw, breath = 0) {
  if (!sw && !breath) return pose;
  const o = { ...pose, p: [pose.p[0], pose.p[1] + breath], tor: pose.tor + sw * 5 };
  if (sw) { const dx = sw * 7; o.fl = [pose.fl[0] + dx * 1.6, pose.fl[1]]; o.fr = [pose.fr[0] + dx * 1.6, pose.fr[1]]; o.hd = pose.hd + sw * 10; }
  return o;
}

// Two-bone IK: shoulder (sx,sy) to target (tx,ty); returns elbow and the (possibly clamped) end point.
function ik(sx, sy, tx, ty, a, b, side) {
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 0.001;
  const max = a + b - 0.6, min = Math.abs(a - b) + 1;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < min) { dx *= min / d; dy *= min / d; d = min; }
  const base = Math.atan2(dy, dx), c = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), A = Math.acos(c);
  const ang = base + side * A;
  return { ex: sx + Math.cos(ang) * a, ey: sy + Math.sin(ang) * a, hx: sx + dx, hy: sy + dy };
}

// Compute every joint in pole space. Returns points with x already multiplied by the spin factor cx.
export function solve(pose, phi = 0) {
  const R = RIG, cx = Math.cos(phi), tr = pose.tor * Math.PI / 180;
  const ux = Math.sin(tr), uy = -Math.cos(tr);                 // pelvis -> neck
  const sxv = Math.cos(tr), syv = Math.sin(tr);                // across the shoulders (to the performer's screen-right when upright)
  const [px, py] = pose.p;
  const wid = Math.max(0.28, Math.abs(cx));                    // shoulders narrow when the body turns edge-on
  const neck = [px + ux * R.torso, py + uy * R.torso];
  const sl = [neck[0] - sxv * R.shw * wid, neck[1] - syv * R.shw * wid], sr = [neck[0] + sxv * R.shw * wid, neck[1] + syv * R.shw * wid];
  const hl = [px - sxv * R.hipw * wid, py - syv * R.hipw * wid], hr = [px + sxv * R.hipw * wid, py + syv * R.hipw * wid];
  const aL = ik(sl[0], sl[1], pose.hl[0], pose.hl[1], R.uarm, R.farm, pose.el), aR = ik(sr[0], sr[1], pose.hr[0], pose.hr[1], R.uarm, R.farm, pose.er);
  const lL = ik(hl[0], hl[1], pose.fl[0], pose.fl[1], R.thigh, R.shin, pose.kl), lR = ik(hr[0], hr[1], pose.fr[0], pose.fr[1], R.thigh, R.shin, pose.kr);
  const hd = [neck[0] + Math.sin(tr + pose.hd * Math.PI / 180) * R.neck, neck[1] - Math.cos(tr + pose.hd * Math.PI / 180) * R.neck];
  const X = (x) => x * cx;
  const J = {
    pelvis: [X(px), py], neck: [X(neck[0]), neck[1]], head: [X(hd[0]), hd[1]], sl: [X(sl[0]), sl[1]], sr: [X(sr[0]), sr[1]], hl: [X(hl[0]), hl[1]], hr: [X(hr[0]), hr[1]],
    elL: [X(aL.ex), aL.ey], handL: [X(aL.hx), aL.hy], elR: [X(aR.ex), aR.ey], handR: [X(aR.hx), aR.hy],
    knL: [X(lL.ex), lL.ey], footL: [X(lL.hx), lL.hy], knR: [X(lR.ex), lR.ey], footR: [X(lR.hx), lR.hy], cx, tr,
  };
  return J;
}

export const STANDING_PELVIS = STAND_FOOT;       // distance from a standing pelvis to the ground, in units

// ---- drawing --------------------------------------------------------------------------------------------------------------------
const C = {
  skin: '#c98a5b', skinHi: '#eab07f', skinLo: '#8e5632', cloth: '#f4e8cf', shorts: '#e8791c', shortsHi: '#ffb25c', shortsLo: '#a8480c',
  sash: '#a81f33', hair: '#24160f', band: '#c0392b', rim: 'rgba(28,12,6,0.55)',
};

function tapered(ctx, ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  ctx.beginPath();
  ctx.moveTo(ax + nx * ra, ay + ny * ra); ctx.lineTo(bx + nx * rb, by + ny * rb);
  ctx.arc(bx, by, rb, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(ax - nx * ra, ay - ny * ra);
  ctx.arc(ax, ay, ra, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// opts: { x, y (screen position of the standing-pelvis anchor on the pole axis), k (scale), phi (spin), sil: colour string for a flat
// silhouette, alpha, chalk (0..1 white hands) }
export function drawFigure(ctx, pose, o) {
  const J = solve(pose, o.phi ?? 0), K = o.k, ox = o.x, oy = o.y;
  const sil = o.sil ?? null, flat = !!sil;
  const sx = (q) => q[0] * K + ox, sy = (q) => q[1] * K + oy;
  const rims = [], fills = [];
  const seg = (a, b, ra, rb, base, hi, lo, rim = true) => {
    const ax = sx(a), ay = sy(a), bx = sx(b), by = sy(b), A = ra * K, B = rb * K;
    if (rim && !flat) rims.push(() => { tapered(ctx, ax, ay, bx, by, A + 1.7 * K, B + 1.7 * K); ctx.fillStyle = C.rim; ctx.fill(); });
    fills.push(() => {
      tapered(ctx, ax, ay, bx, by, A, B); ctx.fillStyle = base; ctx.fill();
      if (flat) return;
      const d = Math.hypot(bx - ax, by - ay) || 1;
      let nx = -(by - ay) / d, ny = (bx - ax) / d;
      if (nx + ny > 0) { nx = -nx; ny = -ny; }                    // normal towards the lit (upper-left) side
      const rm = (A + B) / 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = hi; ctx.globalAlpha = 0.5; ctx.lineWidth = rm * 0.62;
      ctx.beginPath(); ctx.moveTo(ax + nx * rm * 0.4, ay + ny * rm * 0.4); ctx.lineTo(bx + nx * rm * 0.4, by + ny * rm * 0.4); ctx.stroke();
      ctx.strokeStyle = lo; ctx.globalAlpha = 0.45; ctx.lineWidth = rm * 0.5;
      ctx.beginPath(); ctx.moveTo(ax - nx * rm * 0.62, ay - ny * rm * 0.62); ctx.lineTo(bx - nx * rm * 0.62, by - ny * rm * 0.62); ctx.stroke();
      ctx.globalAlpha = 1;
    });
  };
  const dot = (q, r, col, rim = true) => {
    if (rim && !flat) rims.push(() => { ctx.beginPath(); ctx.arc(sx(q), sy(q), (r + 1.7) * K, 0, TAU); ctx.fillStyle = C.rim; ctx.fill(); });
    fills.push(() => { ctx.beginPath(); ctx.arc(sx(q), sy(q), r * K, 0, TAU); ctx.fillStyle = col; ctx.fill(); });
  };
  const polyOp = (pts, fill, rim) => {
    const path = () => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(sx(q), sy(q)) : ctx.moveTo(sx(q), sy(q)))); ctx.closePath(); };
    if (rim && !flat) rims.push(() => { path(); ctx.lineJoin = 'round'; ctx.lineWidth = 3.4 * K; ctx.strokeStyle = C.rim; ctx.stroke(); ctx.fillStyle = C.rim; ctx.fill(); });
    fills.push(() => { path(); ctx.fillStyle = typeof fill === 'function' ? fill() : fill; ctx.fill(); });
  };
  const skin = sil ?? C.skin, cloth = sil ?? C.cloth, shorts = sil ?? C.shorts;
  const flip = J.cx < 0;
  const legs = [[J.hl, J.knL, J.footL], [J.hr, J.knR, J.footR]], arms = [[J.sl, J.elL, J.handL], [J.sr, J.elR, J.handR]];
  if (flip) { legs.reverse(); arms.reverse(); }
  const chalk = o.chalk ?? 0;
  const handCol = chalk > 0 && !flat ? `rgb(${Math.round(201 + 54 * chalk)},${Math.round(138 + 100 * chalk)},${Math.round(91 + 130 * chalk)})` : skin;

  for (const [h, kn, f] of legs) {
    seg(h, kn, 12.5, 9.8, skin, C.skinHi, C.skinLo); seg(kn, f, 9.8, 6.6, skin, C.skinHi, C.skinLo);
    dot(kn, 9.6, skin, false);
    const dx = f[0] - kn[0], dy = f[1] - kn[1], d = Math.hypot(dx, dy) || 1;
    seg(f, [f[0] + dx / d * 10, f[1] + dy / d * 10], 6.6, 5, skin, C.skinHi, C.skinLo);
    seg(h, mix(h, kn, 0.74), 14.2, 12.4, shorts, C.shortsHi, C.shortsLo, false);
  }
  const hl = J.hl, hr = J.hr, sl = J.sl, sr = J.sr, sm = mix(sl, sr, 0.5);
  const waistL = mix(hl, sl, 0.12), waistR = mix(hr, sr, 0.12), vestL = mix(hl, sl, 0.22), vestR = mix(hr, sr, 0.22);
  polyOp([hl, hr, sr, sl], skin, true);
  polyOp([hl, hr, waistR, waistL], shorts, false);
  polyOp([waistL, waistR, vestR, vestL], sil ?? C.sash, false);
  polyOp([vestL, vestR, sr, sl], () => {
    if (flat) return skin;
    const g = ctx.createLinearGradient(sx(sl), sy(sl), sx(sr), sy(sr));
    g.addColorStop(0, C.skinHi); g.addColorStop(0.45, C.skin); g.addColorStop(1, C.skinLo);
    return g;
  }, false);
  if (!flat) {
    // chest and stomach shading: two pectorals, a centre line and a few stomach creases, so the trunk reads as a body
    const mid = mix(vestL, vestR, 0.5), top = mix(sl, sr, 0.5);
    const tw = Math.hypot(sx(sr) - sx(sl), sy(sr) - sy(sl));
    const ang = Math.atan2(sy(sr) - sy(sl), sx(sr) - sx(sl));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.skinLo; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(1, tw * 0.035);
    ctx.beginPath(); ctx.moveTo(sx(top), sy(top) + 0.02 * tw); ctx.lineTo(sx(mid), sy(mid)); ctx.stroke();
    for (const sgn of [-1, 1]) {
      const cx = sx(mix(top, mid, 0.42)) + Math.cos(ang) * sgn * tw * 0.22, cy = sy(mix(top, mid, 0.42)) + Math.sin(ang) * sgn * tw * 0.22;
      ctx.globalAlpha = 0.28; ctx.fillStyle = C.skinLo;
      ctx.beginPath(); ctx.ellipse(cx, cy + tw * 0.07, tw * 0.2, tw * 0.1, ang, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.34; ctx.fillStyle = C.skinHi;
      ctx.beginPath(); ctx.ellipse(cx, cy - tw * 0.02, tw * 0.17, tw * 0.07, ang, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 0.28; ctx.strokeStyle = C.skinLo; ctx.lineWidth = Math.max(1, tw * 0.025);
    for (let q = 0; q < 2; q++) {
      const t0 = mix(top, mid, 0.62 + q * 0.17);
      ctx.beginPath(); ctx.moveTo(sx(t0) - Math.cos(ang) * tw * 0.16, sy(t0) - Math.sin(ang) * tw * 0.16); ctx.lineTo(sx(t0) + Math.cos(ang) * tw * 0.16, sy(t0) + Math.sin(ang) * tw * 0.16); ctx.stroke();
    }
    ctx.restore();
  }
  seg(sm, J.head, 7.6, 7.2, skin, C.skinHi, C.skinLo);
  dot(sl, 10.5, skin, true); dot(sr, 10.5, skin, true);
  for (const [s0, el, h] of arms) {
    seg(s0, el, 9.6, 7.8, skin, C.skinHi, C.skinLo); seg(el, h, 7.8, 5.8, skin, C.skinHi, C.skinLo);
    dot(el, 7.6, skin, false);
    dot(h, 6.6, handCol, true);
    {
      const dx = h[0] - el[0], dy = h[1] - el[1], d = Math.hypot(dx, dy) || 1;
      seg(h, [h[0] + dx / d * 8, h[1] + dy / d * 8], 5.6, 4.2, handCol, C.skinHi, C.skinLo, false);   // fingers
      dot([h[0] + dx / d * 9.5, h[1] + dy / d * 9.5], 3.8, handCol, false);
    }
  }
  // head
  const hx = sx(J.head), hy = sy(J.head), hr2 = RIG.head * K;
  rims.push(() => { ctx.beginPath(); ctx.arc(hx, hy, hr2 + 1.7 * K, 0, TAU); ctx.fillStyle = C.rim; ctx.fill(); });
  fills.push(() => {
    ctx.beginPath(); ctx.arc(hx, hy, hr2, 0, TAU);
    if (flat) ctx.fillStyle = skin;
    else { const g = ctx.createRadialGradient(hx - hr2 * 0.35, hy - hr2 * 0.4, hr2 * 0.1, hx, hy, hr2 * 1.05); g.addColorStop(0, C.skinHi); g.addColorStop(0.6, C.skin); g.addColorStop(1, C.skinLo); ctx.fillStyle = g; }
    ctx.fill();
    if (flat) return;
    const up = J.tr + pose.hd * Math.PI / 180, ca = Math.cos(up), sa = Math.sin(up);
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, hr2, 0, TAU); ctx.clip();
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.ellipse(hx + sa * hr2 * 0.52, hy - ca * hr2 * 0.52, hr2 * 1.15, hr2 * 0.78, up, 0, TAU); ctx.fill();
    ctx.fillStyle = C.band; ctx.beginPath(); ctx.ellipse(hx + sa * hr2 * 0.1, hy - ca * hr2 * 0.1, hr2 * 1.1, hr2 * 0.18, up, 0, TAU); ctx.fill();
    ctx.restore();
    // face (only when it faces the viewer): eyes, brows, nose, mouth, ears
    if (Math.abs(J.cx) > 0.55) {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(up);
      const e = hr2 * 0.36, ey = hr2 * 0.06;
      ctx.fillStyle = '#fff4e6'; for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * e, ey, hr2 * 0.17, hr2 * 0.1, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#1c0f08'; for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(sgn * e, ey, hr2 * 0.075, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#1c0f08'; ctx.lineWidth = Math.max(1, hr2 * 0.09); ctx.lineCap = 'round';
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sgn * e - hr2 * 0.17, ey - hr2 * 0.17); ctx.lineTo(sgn * e + hr2 * 0.17, ey - hr2 * 0.2); ctx.stroke(); }
      ctx.strokeStyle = C.skinLo; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1, hr2 * 0.08);
      ctx.beginPath(); ctx.moveTo(0, ey + hr2 * 0.08); ctx.lineTo(-hr2 * 0.05, ey + hr2 * 0.34); ctx.lineTo(hr2 * 0.1, ey + hr2 * 0.36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-hr2 * 0.2, ey + hr2 * 0.58); ctx.quadraticCurveTo(0, ey + hr2 * 0.66, hr2 * 0.2, ey + hr2 * 0.58); ctx.stroke();
      ctx.restore();
    }
  });

  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const r of rims) r();
  for (const f of fills) f();
  ctx.restore();
  return J;
}

// Where a joint is on screen (for chalk puffs and the like).
export function jointScreen(pose, phi, key, o) {
  const J = solve(pose, phi), q = J[key];
  return { x: q[0] * o.k + o.x, y: q[1] * o.k + o.y };
}

// Bounds of a pose in pole units (joints plus a margin for limb thickness and the head).
export function poseBounds(pose) {
  const J = solve(pose, 0);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const key of ['pelvis', 'neck', 'head', 'sl', 'sr', 'elL', 'elR', 'handL', 'handR', 'knL', 'knR', 'footL', 'footR']) {
    const q = J[key], m = key === 'head' ? RIG.head + 4 : 14;
    x0 = Math.min(x0, q[0] - m); x1 = Math.max(x1, q[0] + m); y0 = Math.min(y0, q[1] - m); y1 = Math.max(y1, q[1] + m);
  }
  return { x0, y0, x1, y1 };
}
// Draw a pose scaled to fit a rectangle (for the Rules book, the ribbon nodes and the title screen).
export function fitFigure(ctx, pose, r, o = {}) {
  const b = poseBounds(pose), k = Math.min(r.w / (b.x1 - b.x0), r.h / (b.y1 - b.y0));
  const cx = r.x + r.w / 2 - ((b.x0 + b.x1) / 2) * k, cy = r.y + r.h / 2 - ((b.y0 + b.y1) / 2) * k;
  return drawFigure(ctx, pose, { ...o, x: cx, y: cy, k });
}

// ---- authored motion -------------------------------------------------------------------------------------------------------------
// Every move is a short clip: the pose at the moment the clip starts, then key poses (anticipation, effort, overshoot) and the settled pose.
// Key times are fractions of the clip; the path through the keys is a Catmull-Rom spline per channel, so joints accelerate and settle
// instead of sliding linearly between two end poses. Pure functions of (start pose, move, u): deterministic, nothing is stored.
const CH = (q) => [q.p[0], q.p[1], q.tor, q.hd, q.hl[0], q.hl[1], q.hr[0], q.hr[1], q.fl[0], q.fl[1], q.fr[0], q.fr[1]];
const unCH = (v, ref) => ({ ...ref, p: [v[0], v[1]], tor: v[2], hd: v[3], hl: [v[4], v[5]], hr: [v[6], v[7]], fl: [v[8], v[9]], fr: [v[10], v[11]] });
const KEY = (o) => P(o);
// Partial key poses are given as overrides on the destination pose of the clip.
export const MOTION = {
  salute: { dur: 0.7, lead: 0.2, keys: [[0.3, { p: [30, 8], hl: [30, -40], hr: [44, -40] }], [0.65, { p: [60, 4], hl: [48, -120], hr: [66, -120] }]] },
  grip: { dur: 0.7, lead: 0.2, keys: [[0.28, { p: [0, 4], hl: [-5, -222], hr: [7, -170], fl: [-14, 140], fr: [14, 146] }], [0.62, { p: [0, 22], hl: [-5, -176], hr: [7, -126], fl: [-18, 124], fr: [16, 134] }]] },
  tuck: { dur: 0.75, lead: 0.2, keys: [[0.3, { p: [0, 22], hl: [-5, -178], hr: [7, -134], fl: [-18, 138], fr: [18, 138] }], [0.62, { p: [0, 4], hl: [-5, -200], hr: [7, -158], fl: [-30, 66], fr: [30, 66] }]] },
  wrap: { dur: 0.7, lead: 0.2, keys: [[0.3, { p: [-10, 14], tor: 7, fl: [22, 100], fr: [4, 150] }], [0.65, { p: [8, 4], tor: -6, fl: [14, 106], fr: [-14, 134] }]] },
  slide: { dur: 0.6, lead: 0.15, keys: [[0.3, { p: [0, 18], hl: [-5, -150], hr: [7, -104], fl: [-16, 150], fr: [14, 150] }], [0.7, { p: [0, 32], hl: [-5, -164], hr: [7, -120], fl: [-10, 176], fr: [10, 176] }]] },
  flag: { dur: 1.0, lead: 0.55, keys: [[0.22, { p: [6, 14], tor: 0, hl: [-5, -196], hr: [7, -150], fl: [-24, 92], fr: [24, 92] }], [0.5, { p: [60, -8], tor: -42, hd: 6, fl: [150, 70], fr: [160, 90] }], [0.8, { p: [128, -42], tor: -100, fl: [270, -46], fr: [270, -16] }]] },
  split: { dur: 0.95, lead: 0.5, keys: [[0.25, { p: [0, 16], fl: [-26, 120], fr: [26, 120] }], [0.55, { p: [0, 8], fl: [-70, 70], fr: [70, 70] }], [0.85, { p: [0, 2], fl: [-146, 46], fr: [146, 46] }]] },
  ulta: { dur: 1.15, lead: 0.6, keys: [[0.25, { p: [0, 18], tor: 10, hl: [-5, -200], hr: [7, -152], fl: [-24, 100], fr: [24, 100] }], [0.5, { p: [0, -4], tor: 70, hl: [-5, -190], hr: [7, -130], fl: [-30, 20], fr: [30, 20] }], [0.8, { p: [0, -40], tor: 168, hl: [-10, 96], hr: [10, 104], fl: [-70, 70], fr: [70, 70] }]] },
  vsplit: { dur: 0.95, lead: 0.5, keys: [[0.3, { p: [0, 16], fr: [26, 100], fl: [-12, 160] }], [0.6, { p: [0, 10], fr: [44, -10], fl: [-10, 160] }], [0.85, { p: [0, 8], fr: [54, -130] }]] },
};
const FLAT_POSES = (name) => POSES[name] ?? POSES.salute;
// Pose of the move `name` that starts from pose `from`, at clip time u (0..1; clamped).
export function animatePose(from, name, u) {
  const dest = FLAT_POSES(name), m = MOTION[name];
  const t = Math.max(0, Math.min(1, u));
  const A = CH(from), Z = CH(dest);
  const pts = [[0, A]];
  if (m) for (const [kt, o] of m.keys) { const base = A.map((a, j) => a + (Z[j] - a) * kt); pts.push([kt, CH({ ...dest, ...unCH(base, dest), ...o })]); }
  pts.push([1, Z]);
  let i = 0; while (i < pts.length - 2 && t > pts[i + 1][0]) i += 1;
  const [t0, v0] = pts[i], [t1, v1] = pts[i + 1];
  const vm = i > 0 ? pts[i - 1] : [t0 - (t1 - t0), v0.map((x, j) => 2 * x - v1[j])];
  const vp = i + 2 < pts.length ? pts[i + 2] : [t1 + (t1 - t0), v1.map((x, j) => 2 * x - v0[j])];
  const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
  const out = v0.map((a, j) => {
    const mA = (v1[j] - vm[1][j]) / (t1 - vm[0]) * h, mB = (vp[1][j] - v0[j]) / (vp[0] - t0) * h;   // Catmull-Rom tangents (non-uniform)
    return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * mA + (-2 * s3 + 3 * s2) * v1[j] + (s3 - s2) * mB;
  });
  const sw = t < 0.5 ? from : dest;
  return unCH(out, { ...dest, el: sw.el, er: sw.er, kl: sw.kl, kr: sw.kr });
}
void KEY;
