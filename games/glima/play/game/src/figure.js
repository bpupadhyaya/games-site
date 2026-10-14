// The 2D picture of the two athletes (used when there is no WebGL, and in the small illustrations): the same scene the 3D layer shows, drawn
// with canvas shapes from a camera behind the near athlete, a little to one side and above. A small analytic skeleton (pelvis, spine,
// two-bone arms and legs) is posed from the sim's numbers, projected, depth sorted and drawn as shaded limbs, a head with hair and face,
// hands that grip, shoes, the leather belt with its buckle and the thigh loops. Pure drawing: no clock, no random.
//
// World units are metres, +X to the right of the picture, +Y up, +Z toward the camera; the near athlete (side 0) stands at z = +0.35 facing -Z.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const ROOT_Z = [0.32, -0.32];
export const FOOT_X = 0.2;
const FOOT_Z = 0.06;
const FWD = [-1, 1];   // the Z direction each athlete faces

const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, k) => V(a.x * k, a.y * k, a.z * k);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };
const mix = (a, b, t) => V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
// shade() returns rgb(): keep a hex-capable variant for gradients that need a hex input
function hexOf(c) { return c; }
void hexOf;

// Two-bone IK: joint position for a limb from A to target T with segment lengths l1, l2 and a pole direction.
function ik2(A, T, l1, l2, pole) {
  const d0 = sub(T, A); let d = len(d0);
  const dc = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.003);
  const u = norm(d0);
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let p = sub(pole, mul(u, dot(pole, u)));
  p = len(p) < 1e-4 ? V(0, 1, 0) : norm(p);
  const J = add(add(A, mul(u, a)), mul(p, h));
  return { j: J, e: add(A, mul(u, dc)) };
}

export function camera(rect, B, focusY = 0.5, opts = {}) {
  const aspect = rect.w / rect.h;
  const el = (opts.el ?? (aspect < 0.8 ? 40 : aspect < 1.25 ? 34 : 28)) * Math.PI / 180;
  const az = (opts.az ?? (27 + 8 * Math.sin((B && B.ang || 0) * 0.5))) * Math.PI / 180;
  const fit = Math.min(rect.h / 2.45, rect.w / 2.05) * (opts.zoom || 1);
  const sin = Math.sin, cos = Math.cos;
  const r = V(cos(az), 0, -sin(az)), u = V(-sin(az) * sin(el), cos(el), -cos(az) * sin(el)), d = V(sin(az) * cos(el), sin(el), cos(az) * cos(el));
  const tgt = V(0, 0.9, 0);
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h * focusY;
  return {
    el, az, s: fit, r, u, d, rect,
    p(P) { const q = sub(P, tgt); return { x: cx + dot(q, r) * fit, y: cy - dot(q, u) * fit, z: dot(q, d) }; },
    // the ground (X, Z) -> screen, for the backdrop
    cx, cy,
  };
}

// ---- the skeleton ---------------------------------------------------------------------------------------------------------------
export function skeleton(i, B, pose, other, o = {}) {
  const sd = B.side[i], p = pose[i], f = V(0, 0, FWD[i]), left = V(i === 0 ? -1 : 1, 0, 0);
  const fk = ease(clamp(p.fall, 0, 1));
  const fem = !!o.fem;
  const k = fem ? 0.95 : 1;
  const shk = p.shake ? Math.sin((o.t || 0) * 55 + i * 2) * 0.012 * p.shake : 0;
  const w = clamp(sd.w, -1, 1);
  const bob = Math.sin((o.t || 0) * 1.7 + i) * 0.004;
  // pelvis: weight over the loaded foot, knees soft, the whole body goes back and down in a fall
  const hookK = sd.hook ? ease(clamp(p.hp, 0, 1)) : ease(clamp(p.hp, 0, 1)) * 0.5;
  const pel = V(w * 0.07 + shk + p.dir * 0.3 * fk, lerp(0.88 * k - 0.025 * Math.abs(w) + bob, 0.15, fk), ROOT_Z[i] + FWD[i] * (0.04 * hookK) - FWD[i] * 0.3 * fk);
  // trunk: a little forward lean, the picture's weight lean sideways, reclined in a fall
  const leanF = (10 + 4 * hookK) * Math.PI / 180 - 0.5 * fk, leanS = -(p.lean || 0) * 0.5 + (i === 0 ? 0 : 0);
  const up = norm(V(left.x * Math.sin(leanS) * -1, Math.cos(leanF), f.z * Math.sin(leanF)));
  const chest = add(pel, mul(up, 0.28 * k)), neck = add(pel, mul(up, 0.52 * k));
  const shW = fem ? 0.17 : 0.2;
  const shL = add(add(neck, mul(left, shW)), V(0, -0.04, 0)), shR = add(add(neck, mul(left, -shW)), V(0, -0.04, 0));
  const head = add(add(add(neck, mul(up, 0.15)), mul(f, 0.035 * 0 + 0.02)), mul(left, 0.09 + 0.025 * sd.steer * (i === 0 ? 1 : -1)));
  const J = { pel, chest, neck, shL, shR, head, up, f, left, fk };
  // hands: right hand on the rival's left hip (belt), left hand on the rival's right thigh loop; both come up in a win
  const oP = other.pel, oL = other.left, oF = other.f;
  const grip = 1 - Math.max(fk, ease(clamp(pose[1 - i].fall, 0, 1)) * 0.9, clamp(p.joy * 1.6, 0, 1));
  const hgR = add(add(add(oP, mul(oL, 0.17)), mul(oF, -0.02)), V(0, 0.115, 0));
  const hgL = add(add(add(oP, mul(oL, -0.14)), mul(oF, 0.05)), V(0, -0.1, 0));
  const joyR = add(add(shR, mul(left, -0.26)), V(0, 0.52, 0)), joyL = add(add(shL, mul(left, 0.26)), V(0, 0.52, 0));
  const frR = add(add(shR, mul(left, -0.12)), add(mul(f, 0.24), V(0, -0.5, 0))), frL = add(add(shL, mul(left, 0.12)), add(mul(f, 0.24), V(0, -0.5, 0)));
  const handR = mix(mix(frR, hgR, grip), joyR, clamp(p.joy, 0, 1)), handL = mix(mix(frL, hgL, grip), joyL, clamp(p.joy, 0, 1));
  const ua = 0.3 * k, fa = 0.28 * k;
  const poleR = add(mul(left, -0.5), V(0, -0.3, -f.z * 0.15)), poleL = add(mul(left, 0.5), V(0, -0.3, -f.z * 0.15));
  const aR = ik2(shR, handR, ua, fa, poleR), aL = ik2(shL, handL, ua, fa, poleL);
  J.armR = { s: shR, e: aR.j, w: aR.e }; J.armL = { s: shL, e: aL.j, w: aL.e };
  // legs: hips at the pelvis, ankles planted at the feet anchors (the hooking foot swings to the rival's leg on that side)
  J.legs = [-1, 1].map((s) => {
    const hip = V(pel.x + s * 0.095 * (fem ? 1.05 : 1), pel.y - 0.05, pel.z);
    const lv = clamp(-sd.w * s + 0.1, 0, 1);
    let ank = V(s * FOOT_X, 0.09 + 0.02 * lv * (1 - fk), ROOT_Z[i] + FWD[i] * FOOT_Z);
    const hooking = p.hs === s && p.hp > 0.02;
    if (hooking) {
      const rz = ROOT_Z[1 - i] + FWD[1 - i] * FOOT_Z;
      const u2 = sd.hook ? ease(clamp(p.hp, 0, 1)) * 0.78 : clamp(p.hp, 0, 1) * 0.39;
      const a = Math.sin(Math.min(1, u2 / 0.78) * Math.PI);
      ank = V(lerp(ank.x, s * FOOT_X, u2) + s * a * 0.1, 0.11 + a * 0.15 + 0.16 * u2, lerp(ank.z, rz + FWD[i] * 0.16, u2));
    }
    const kn = ik2(hip, ank, 0.43 * k, 0.42 * k, add(mul(f, 1), V(s * 0.25, 0.1, 0)));
    return { s, hip, knee: kn.j, ankle: kn.e, lv, hooking };
  });
  return J;
}

// ---- drawing primitives -----------------------------------------------------------------------------------------------------------
const LIGHT = { x: -0.55, y: -0.83 };
function tube(ctx, a, b, w0, w1, col, o = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const dk = o.dk || shade(col, -0.34), lt = o.lt || shade(col, 0.28);
  if (o.shadow) {
    ctx.fillStyle = 'rgba(6,10,20,0.22)'; ctx.beginPath(); ctx.arc(a.x + 4, a.y + 5, w0 / 2, 0, TAU); ctx.arc(b.x + 4, b.y + 5, w1 / 2, 0, TAU); ctx.fill();
  }
  const side = nx * LIGHT.x + ny * LIGHT.y >= 0 ? 1 : -1;
  const gx = (a.x + b.x) / 2, gy = (a.y + b.y) / 2, wm = (w0 + w1) / 2;
  const g = ctx.createLinearGradient(gx + nx * side * wm / 2, gy + ny * side * wm / 2, gx - nx * side * wm / 2, gy - ny * side * wm / 2);
  g.addColorStop(0, lt); g.addColorStop(0.3, col); g.addColorStop(0.75, dk); g.addColorStop(1, shade(dk, -0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * w0 / 2, a.y + ny * w0 / 2); ctx.lineTo(b.x + nx * w1 / 2, b.y + ny * w1 / 2); ctx.lineTo(b.x - nx * w1 / 2, b.y - ny * w1 / 2); ctx.lineTo(a.x - nx * w0 / 2, a.y - ny * w0 / 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(a.x, a.y, w0 / 2, 0, TAU); ctx.fillStyle = g; ctx.fill();
  const g2 = ctx.createRadialGradient(b.x - w1 * 0.16, b.y - w1 * 0.2, 0.5, b.x, b.y, w1 * 0.62); g2.addColorStop(0, lt); g2.addColorStop(0.55, col); g2.addColorStop(1, dk);
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(b.x, b.y, w1 / 2, 0, TAU); ctx.fill();
}
function ball(ctx, c, r, col, o = {}) {
  const g = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, r * 0.1, c.x, c.y, r * 1.05);
  g.addColorStop(0, o.lt || shade(col, 0.32)); g.addColorStop(0.55, col); g.addColorStop(1, o.dk || shade(col, -0.45));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
}

// ---- the figure ---------------------------------------------------------------------------------------------------------------------
// Returns a list of { z, draw } items for one athlete; the caller sorts every item of both athletes by depth.
function figureItems(cam, ctx, i, J, look, o) {
  const items = [];
  const s = cam.s, P = (v) => cam.p(v), push = (z, draw) => items.push({ z, draw });
  const fem = !!look.f;
  const thick = (m) => m * s;
  const pelP = P(J.pel), chestP = P(J.chest), neckP = P(J.neck), headP = P(J.head);
  const dZ = (v) => P(v).z;
  const skin = look.skin, skinDk = look.skinDk;
  const facing = dot(J.f, cam.d);        // > 0: the athlete faces the camera
  // legs
  for (const lg of J.legs) {
    const hip = P(lg.hip), kn = P(lg.knee), an = P(lg.ankle);
    const toe = P(add(lg.ankle, add(mul(J.f, 0.15), V(0, -0.06, 0))));
    const heel = P(add(lg.ankle, add(mul(J.f, -0.07), V(0, -0.07, 0))));
    const zk = (hip.z + kn.z + an.z) / 3;
    push(zk - 0.001, () => {
      const wl = thick(fem ? 0.2 : 0.21);
      tube(ctx, hip, kn, wl, wl * 0.74, look.pants, { shadow: true });
      // shin: bare below the shorts for men, trouser for women
      if (fem) tube(ctx, kn, an, wl * 0.7, wl * 0.5, look.pants);
      else tube(ctx, kn, an, wl * 0.62, wl * 0.45, skin, { dk: skinDk });
      // thigh loop: a leather band square to the thigh at a third of its length
      const tx = lerp(hip.x, kn.x, 0.36), ty = lerp(hip.y, kn.y, 0.36);
      const dx = kn.x - hip.x, dy = kn.y - hip.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, hw = wl * 0.5 + 1;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#4e3218'; ctx.lineWidth = Math.max(3, thick(0.075)); ctx.beginPath(); ctx.moveTo(tx - nx * hw, ty - ny * hw); ctx.lineTo(tx + nx * hw, ty + ny * hw); ctx.stroke();
      ctx.strokeStyle = '#9a6a38'; ctx.lineWidth = Math.max(2, thick(0.055)); ctx.beginPath(); ctx.moveTo(tx - nx * hw, ty - ny * hw); ctx.lineTo(tx + nx * hw, ty + ny * hw); ctx.stroke();
      // shoe: an upper and a pale sole, pointing the way the athlete faces
      const sw = thick(0.115);
      tube(ctx, heel, toe, sw, sw * 0.82, '#f0ece0', { dk: '#b9b4a6', lt: '#ffffff' });
      tube(ctx, P(add(lg.ankle, add(mul(J.f, -0.04), V(0, -0.01, 0)))), P(add(lg.ankle, add(mul(J.f, 0.12), V(0, -0.025, 0)))), sw * 0.8, sw * 0.62, look.shoe, { shadow: false });
    });
  }
  // trunk: the tank top over a tapered body, bare shoulders, the belt ring and its buckle
  push(P(J.chest).z, () => {
    const wTop = thick(fem ? 0.4 : 0.45), wLow = thick(fem ? 0.32 : 0.35);
    tube(ctx, pelP, neckP, wLow, wTop, look.kit, { dk: look.kitDk, lt: shade(look.kit, 0.22), shadow: true });
    // armholes and the trim along them: bare shoulder caps
    for (const sP of [P(J.shL), P(J.shR)]) ball(ctx, sP, thick(0.082), skin, { dk: skinDk });
    // neck
    const nk = headP;
    tube(ctx, neckP, nk, thick(0.1), thick(0.095), skin, { dk: skinDk, shadow: false });
    // trim stripe across the upper back / chest
    const a = P(add(J.neck, add(mul(J.left, 0.17), V(0, -0.1, 0)))), b = P(add(J.neck, add(mul(J.left, -0.17), V(0, -0.1, 0))));
    ctx.strokeStyle = look.trim; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(2, thick(0.022)); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + thick(0.03), b.x, b.y); ctx.stroke(); ctx.globalAlpha = 1;
  });
  // belt ring (only the half facing the camera is drawn over the body), brass buckle at the front
  push(P(J.pel).z + 0.002, () => {
    const c = add(J.pel, mul(J.up, 0.1)), rx = fem ? 0.155 : 0.165, rz = 0.115;
    const pts = [];
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * TAU, wp = add(c, add(mul(J.left, Math.cos(a) * rx), mul(J.f, Math.sin(a) * rz)));
      pts.push({ p: P(wp), front: dot(add(mul(J.left, Math.cos(a) * rx / rx), mul(J.f, Math.sin(a))), cam.d) });
    }
    const draw = (col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'butt'; ctx.beginPath();
      let on = false;
      for (const q of pts) { if (q.front > -0.15) { if (!on) { ctx.moveTo(q.p.x, q.p.y); on = true; } else ctx.lineTo(q.p.x, q.p.y); } else on = false; }
      ctx.stroke();
    };
    draw('#4e3218', Math.max(4, thick(0.085))); draw('#9a6a38', Math.max(3, thick(0.062)));
    const bk = P(add(c, mul(J.f, rz + 0.005)));
    if (facing > -0.2) { ctx.fillStyle = '#e2bd57'; ctx.strokeStyle = '#7a5a14'; ctx.lineWidth = 1.2; const bw = thick(0.07), bh = thick(0.055); ctx.beginPath(); ctx.roundRect(bk.x - bw / 2, bk.y - bh / 2, bw, bh, 2); ctx.fill(); ctx.stroke(); }
  });
  // arms
  for (const arm of [J.armR, J.armL]) {
    const sp = P(arm.s), ep = P(arm.e), wp = P(arm.w);
    push((sp.z + ep.z + wp.z) / 3 + 0.01, () => {
      const w0 = thick(0.105), w1 = thick(0.086), w2 = thick(0.068);
      tube(ctx, sp, ep, w0, w1, skin, { dk: skinDk, shadow: true, lt: shade(skin, 0.25) });
      tube(ctx, ep, wp, w1, w2, skin, { dk: skinDk });
      // hand: palm and four fingers laid along the belt
      const dx = wp.x - ep.x, dy = wp.y - ep.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hs = thick(0.045);
      ball(ctx, { x: wp.x + ux * hs * 0.5, y: wp.y + uy * hs * 0.5 }, hs * 1.05, skin, { dk: skinDk });
      ctx.strokeStyle = shade(skin, -0.1); ctx.lineWidth = Math.max(1.8, hs * 0.5); ctx.lineCap = 'round';
      for (let kf = -1.5; kf <= 1.5; kf++) { ctx.beginPath(); ctx.moveTo(wp.x + ux * hs * 1.1 + nx * kf * hs * 0.5, wp.y + uy * hs * 1.1 + ny * kf * hs * 0.5); ctx.lineTo(wp.x + ux * hs * 2.1 + nx * kf * hs * 0.55, wp.y + uy * hs * 2.1 + ny * kf * hs * 0.55); ctx.stroke(); }
    });
  }
  // head: skin sphere, ears, hair mass, and on a face turned toward the camera the brows, eyes, nose and mouth
  push(headP.z + 0.03, () => {
    const r = thick(0.108);
    const hpx = headP;
    // ears
    const lx = dot(J.left, cam.r), ly = -dot(J.left, cam.u);
    ball(ctx, { x: hpx.x + lx * r * 0.98, y: hpx.y + ly * r * 0.98 + r * 0.05 }, r * 0.24, skin, { dk: skinDk });
    ball(ctx, { x: hpx.x - lx * r * 0.98, y: hpx.y - ly * r * 0.98 + r * 0.05 }, r * 0.24, skin, { dk: skinDk });
    ball(ctx, hpx, r, skin, { dk: skinDk, lt: shade(skin, 0.18) });
    // hair: a cap that covers the back and top of the head; a face shows when the athlete looks toward the camera
    const fxs = dot(J.f, cam.r), fys = -dot(J.f, cam.u);   // where the face points on screen
    const back = clamp(1 - Math.max(0, facing) * 1.1, 0.0, 1.0);
    const hg = ctx.createRadialGradient(hpx.x - fxs * r * 0.2 - r * 0.25, hpx.y - r * 0.4, r * 0.1, hpx.x, hpx.y, r * 1.1);
    hg.addColorStop(0, shade(look.hair, 0.42)); hg.addColorStop(0.5, look.hair); hg.addColorStop(1, shade(look.hair, -0.4));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(hpx.x - fxs * r * 0.12, hpx.y - r * 0.12 - fys * r * 0.08, r * 1.04, r * (0.86 + 0.18 * back), 0, 0, TAU); ctx.fill();
    if (facing > 0.08) {
      // face: lower part of the sphere toward the face direction
      const fc = { x: hpx.x + fxs * r * 0.35, y: hpx.y + r * 0.22 + fys * r * 0.1 }, fw = r * 0.86 * clamp(facing + 0.25, 0.3, 1);
      const fg = ctx.createRadialGradient(fc.x - fw * 0.2, fc.y - fw * 0.3, fw * 0.1, fc.x, fc.y, fw * 1.1); fg.addColorStop(0, shade(skin, 0.15)); fg.addColorStop(1, skin);
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(fc.x, fc.y, fw, r * 0.78, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = look.hair; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.ellipse(fc.x, fc.y - r * 0.62, fw * 1.06, r * 0.34, 0, Math.PI, TAU); ctx.fill(); ctx.globalAlpha = 1;
      // eyes, brows, nose, mouth
      const ex = fw * 0.4, ey = fc.y - r * 0.12;
      ctx.fillStyle = '#f6f2ea'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fc.x + sx * ex, ey, r * 0.13, r * 0.075, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#2a1a10'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(fc.x + sx * ex, ey, r * 0.065, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = shade(look.hair, -0.2); ctx.lineWidth = Math.max(1.2, r * 0.07); ctx.lineCap = 'round';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(fc.x + sx * ex - r * 0.15, ey - r * 0.16); ctx.lineTo(fc.x + sx * ex + r * 0.15, ey - r * 0.19 + sx * 0); ctx.stroke(); }
      ctx.strokeStyle = shade(skin, -0.28); ctx.beginPath(); ctx.moveTo(fc.x, ey + r * 0.04); ctx.lineTo(fc.x - r * 0.05, ey + r * 0.3); ctx.lineTo(fc.x + r * 0.06, ey + r * 0.3); ctx.stroke();
      ctx.strokeStyle = '#8a3a30'; ctx.lineWidth = Math.max(1.2, r * 0.08); ctx.beginPath(); ctx.moveTo(fc.x - r * 0.2, ey + r * 0.52); ctx.quadraticCurveTo(fc.x, ey + r * 0.6 + r * 0.05 * (o.mouth || 0), fc.x + r * 0.2, ey + r * 0.52); ctx.stroke();
    } else if (fem) {
      // ponytail down the back
      ctx.fillStyle = shade(look.hair, -0.1); ctx.beginPath(); ctx.ellipse(hpx.x, hpx.y + r * 1.15, r * 0.34, r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = look.trim; ctx.lineWidth = Math.max(2, r * 0.18); ctx.beginPath(); ctx.moveTo(hpx.x - r * 0.3, hpx.y + r * 0.45); ctx.lineTo(hpx.x + r * 0.3, hpx.y + r * 0.45); ctx.stroke();
    }
  });
  return items;
}

// ---- the whole picture --------------------------------------------------------------------------------------------------------------
// Draws the two athletes (no backdrop). Returns the affine that carries the 800 x 800 overlay world onto the screen (see view.drawStage3D).
export function drawFigures(ctx, cam, S, looks) {
  const B = S.B, t = S.t;
  const sk = [null, null];
  const pre = [0, 1].map((i) => ({ i, left: V(i === 0 ? -1 : 1, 0, 0), f: V(0, 0, FWD[i]), pel: V(0, 0.87, ROOT_Z[i]) }));
  // two passes so each athlete's hands know where the rival's hips really are
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 2; i++) { const J = skeleton(i, B, S.pose, pass === 0 ? pre[1 - i] : { ...pre[1 - i], ...(sk[1 - i] || {}) }, { fem: !!looks[i].f, t }); sk[i] = J; }
  const items = [];
  for (let i = 0; i < 2; i++) items.push(...figureItems(cam, ctx, i, sk[i], looks[i], { mouth: S.pose[i].mouth }));
  // ground shadows first
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const J = sk[i]; const c = cam.p(V(J.pel.x + 0.04, 0, J.pel.z + 0.02));
    ctx.fillStyle = 'rgba(8,14,10,0.30)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, cam.s * 0.46, cam.s * 0.46 * Math.sin(cam.el), 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  items.sort((a, b) => a.z - b.z);
  for (const it of items) { ctx.save(); it.draw(); ctx.restore(); }
  // overlay affine: the three reference feet (see presenter overlayMap)
  const zf = ROOT_Z[0] + FWD[0] * FOOT_Z, zr = ROOT_Z[1] + FWD[1] * FOOT_Z;
  const s00 = cam.p(V(-FOOT_X, 0.04, zf)), s01 = cam.p(V(FOOT_X, 0.04, zf)), s10 = cam.p(V(-FOOT_X, 0.04, zr));
  const a = (s01.x - s00.x) / 160, b = (s01.y - s00.y) / 160, c = (s00.x - s10.x) / 44, d = (s00.y - s10.y) / 44;
  return { a, b, c, d, e: s00.x - a * 320 - c * 422, f: s00.y - b * 320 - d * 422, sk };
}

// ---- the crowd and the lanterns, seen from the camera (drawn before the athletes: only the half behind the ring) --------------------
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
export function drawSurround(ctx, cam, kind, t, cheer) {
  const skins = ['#f0c19c', '#e3a77f', '#c88c66', '#9a6743', '#f3cdaa'];
  const IN = 4.5, OUT = 8.4, SH = 2.1, ROWS = [44, 52, 60, 68];
  const slope = (rad) => 0.35 + (rad - IN) * (SH / (OUT - IN));
  const band = (r0, y0, r1, y1, col, a0 = 0, a1 = TAU) => {
    ctx.fillStyle = col; ctx.beginPath();
    const n = 64;
    for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (a1 - a0), p = cam.p({ x: Math.sin(a) * r0, y: y0, z: Math.cos(a) * r0 }); if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    for (let k = n; k >= 0; k--) { const a = a0 + (k / n) * (a1 - a0), p = cam.p({ x: Math.sin(a) * r1, y: y1, z: Math.cos(a) * r1 }); ctx.lineTo(p.x, p.y); }
    ctx.closePath(); ctx.fill();
  };
  // the stands: a raked band behind the barrier
  band(IN, 0.35, OUT, 0.35 + SH, kind === 'snow' ? '#dfe8f2' : kind === 'hall' ? '#4a3322' : '#4b5560');
  const items = [];
  ROWS.forEach((n, r) => {
    const rad = 5.05 + r * 0.95, y0 = slope(rad);
    for (let k = 0; k < n; k++) {
      const a = (k + (r % 2) * 0.5) / n * TAU, h = hash(k * 31 + r * 977 + 5);
      const X = Math.sin(a) * rad, Z = Math.cos(a) * rad;
      if (Z > 1.0) continue;         // the near half is behind the camera
      const bob = Math.max(0, Math.sin(t * (2.2 + h * 2.4) + h * 12)) * (0.015 + cheer * 0.11);
      items.push({ c: cam.p({ x: X, y: y0 + 0.34 + bob, z: Z }), hc: cam.p({ x: X, y: y0 + 0.66 + bob, z: Z }), h, r, k });
    }
  });
  items.sort((a, b) => a.c.z - b.c.z);
  const s = cam.s;
  for (const it of items) {
    const hue = Math.round(hash(it.k * 5 + it.r * 131 + 1) * 360);
    const body = kind === 'snow' ? `hsl(${hue} 26% ${22 + it.h * 8}%)` : kind === 'hall' ? `hsl(${hue} 26% ${16 + it.h * 6}%)` : `hsl(${hue} 28% ${26 + it.h * 8}%)`;
    const sk = skins[Math.floor(hash(it.k * 3 + it.r * 7 + 9) * 5)];
    const sc = 0.74 + it.h * 0.14;
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(it.c.x, it.c.y, 0.24 * sc * s, 0.25 * sc * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.ellipse(it.c.x - 0.05 * s, it.c.y - 0.07 * s, 0.13 * s, 0.09 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(it.hc.x, it.hc.y, 0.105 * sc * s, 0, TAU); ctx.fill();
    if (kind === 'snow') { ctx.fillStyle = '#f2f6fa'; ctx.beginPath(); ctx.arc(it.hc.x, it.hc.y - 0.02 * s, 0.108 * sc * s, Math.PI, TAU); ctx.fill(); }
    else { ctx.fillStyle = `hsl(${Math.round(hash(it.k + 55) * 40 + 15)} 40% ${10 + it.h * 18}%)`; ctx.beginPath(); ctx.arc(it.hc.x, it.hc.y - 0.02 * s, 0.108 * sc * s, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); }
  }
  // the barrier in front of the first row (far half only), with its painted board and a pale rail
  const bcol = kind === 'hall' ? '#1f3a5e' : kind === 'snow' ? '#27466f' : '#1c3f6e';
  const a0 = Math.PI * 0.5 + 0.0, a1 = Math.PI * 1.5;    // angles with z <= 0
  band(4.3, 0, 4.3, 0.85, bcol, a0 - 0.12, a1 + 0.12);
  band(4.3, 0.42, 4.3, 0.5, kind === 'hall' ? '#d9b45a' : '#f4efe0', a0 - 0.12, a1 + 0.12);
  ctx.strokeStyle = '#f4efe0'; ctx.lineWidth = Math.max(2, cam.s * 0.04); ctx.beginPath();
  for (let k = 0; k <= 48; k++) { const a = a0 - 0.12 + (k / 48) * (a1 - a0 + 0.24), p = cam.p({ x: Math.sin(a) * 4.3, y: 0.87, z: Math.cos(a) * 4.3 }); if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.stroke();
  if (kind !== 'turf') {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + 0.1, p = cam.p({ x: Math.sin(a) * 6.6, y: 3.7, z: Math.cos(a) * 6.6 });
      if (Math.cos(a) * 6.6 > 1) continue;
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, cam.s * 0.7); g.addColorStop(0, 'rgba(255,214,130,0.85)'); g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - cam.s * 0.7, p.y - cam.s * 0.7, cam.s * 1.4, cam.s * 1.4);
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(p.x, p.y, cam.s * 0.07, 0, TAU); ctx.fill();
    }
  }
}
