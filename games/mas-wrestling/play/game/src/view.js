// Drawing the bout: a side-on picture of two seated athletes, the board between their feet and the stick between their hands.
// Everything is drawn in a 1000 x 560 "world" (y down) that is scaled to the stage rectangle; the backdrop is painted beyond the
// world edges so a wide or tall stage is always filled. Pure drawing: game.js owns the state; the pose springs live in state.pose.
import { leverage } from './sim.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const WORLD = { w: 1000, h: 560, cx: 500, cy: 335, floorY: 410 };
export const HALLS = [
  { id: 'meadow', name: 'Festival Meadow', blurb: 'Open air, birches and bunting.' },
  { id: 'winter', name: 'Winter Hall', blurb: 'Timber walls, lamps and snowy windows.' },
  { id: 'arena', name: 'Grand Arena', blurb: 'Spotlit, banners, a roaring crowd.' },
];
export const HALL_BY_ID = Object.fromEntries(HALLS.map((h) => [h.id, h]));

// The bridge to the optional 3D presenter (web/view3d, which only READS this): when `on`, drawStage punches a hole in the 2D canvas where the
// bout picture goes and records what the 3D scene must show; the 2D layer keeps drawing the overlays (particles, pops, coach arrow).
// Nothing in the simulation depends on it.
export const STAGE3D = { on: false, frame: 0, rect: null, sc: 1, ox: 0, oy: 0, hall: 'winter', t: 0, B: null, pose: null, looks: null, over: null, cheer: 0 };

// ---- looks: skin, hair and kit for the athletes -----------------------------------------------------------------------
export const LOOKS = [
  { skin: '#e0a47c', skinDk: '#b9774f', hair: '#2b1d14', kit: '#d8582a', kitDk: '#9c3a15', trim: '#f6e7c1', pants: '#3b4d6b', style: 0 },   // you
  { skin: '#f0c4a0', skinDk: '#c98f68', hair: '#7a4a24', kit: '#3d8f86', kitDk: '#26615b', trim: '#f4efe0', pants: '#3f5a52', style: 1 },   // Aisen
  { skin: '#c68a62', skinDk: '#9a6140', hair: '#1c1410', kit: '#5876b8', kitDk: '#39507f', trim: '#f2ead2', pants: '#5a4a66', style: 2 },   // Tuyaara
  { skin: '#a8714b', skinDk: '#80502f', hair: '#0f0b09', kit: '#a8466a', kitDk: '#762c47', trim: '#f4e9d6', pants: '#6a5238', style: 3 },   // Eder
  { skin: '#d9a07e', skinDk: '#ad7650', hair: '#3a2a1c', kit: '#7a9a3a', kitDk: '#546e22', trim: '#f4efd6', pants: '#3f5f4a', style: 4 },   // Sardaana
  { skin: '#8a5a3a', skinDk: '#63391f', hair: '#120d0a', kit: '#caa23a', kitDk: '#8e6f1c', trim: '#2b2118', pants: '#4a4a58', style: 5 },   // Aytal
];

// ---- small drawing helpers -----------------------------------------------------------------------------------------------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function capsule(ctx, ax, ay, bx, by, w0, w1, col, dk, lt) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const poly = (o, k0, k1) => {
    ctx.beginPath();
    ctx.moveTo(ax + nx * w0 * k0 / 2 + o, ay + ny * w0 * k0 / 2 + o); ctx.lineTo(bx + nx * w1 * k1 / 2 + o, by + ny * w1 * k1 / 2 + o);
    ctx.lineTo(bx - nx * w1 * k1 / 2 + o, by - ny * w1 * k1 / 2 + o); ctx.lineTo(ax - nx * w0 * k0 / 2 + o, ay - ny * w0 * k0 / 2 + o); ctx.closePath();
  };
  ctx.fillStyle = dk;
  poly(w0 * 0.07, 1, 1); ctx.fill();
  ctx.beginPath(); ctx.arc(ax + w0 * 0.07, ay + w0 * 0.07, w0 / 2, 0, TAU); ctx.arc(bx + w1 * 0.07, by + w1 * 0.07, w1 / 2, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  poly(0, 1, 1); ctx.fill();
  ctx.beginPath(); ctx.arc(ax, ay, w0 / 2, 0, TAU); ctx.arc(bx, by, w1 / 2, 0, TAU); ctx.fill();
  ctx.fillStyle = lt;
  poly(-w0 * 0.12, 0.45, 0.45); ctx.fill();
}
function bone2(p0, t, l1, l2, sgn) {
  const dx = t.x - p0.x, dy = t.y - p0.y;
  let d = Math.hypot(dx, dy) || 1;
  const dc = clamp(d, Math.abs(l1 - l2) + 1, l1 + l2 - 0.5);
  const ux = dx / d, uy = dy / d;
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const j = { x: p0.x + ux * a - uy * hh * sgn, y: p0.y + uy * a + ux * hh * sgn };
  const e = { x: p0.x + ux * dc, y: p0.y + uy * dc };
  return { j, e, stretched: d > l1 + l2 };
}
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

// ---- the pose springs -------------------------------------------------------------------------------------------------------
export function newPose() { return [{ lean: 0, rise: 0, dig: 0, mouth: 0, sweat: 0, shake: 0, joy: 0 }, { lean: 0, rise: 0, dig: 0, mouth: 0, sweat: 0, shake: 0, joy: 0 }]; }
export function stepPose(pose, B, dt, over) {
  for (let i = 0; i < 2; i++) {
    const s = B.side[i], p = pose[i];
    const hMe = i === 0 ? B.h : -B.h;                     // + when I am lifting
    const lifted = Math.max(0, -hMe), lifting = Math.max(0, hMe);
    const k = 1 - Math.exp(-dt * 9);
    const tl = -0.42 * s.vec.b - 0.18 * Math.max(0, s.vec.u) + 0.45 * lifted - 0.1 * lifting + 0.1 * Math.max(0, -s.vec.u);
    p.lean += (tl - p.lean) * k;
    p.rise += (lifted - p.rise) * (1 - Math.exp(-dt * 7));
    p.dig += (Math.max(0, -s.vec.u) - p.dig) * k;
    p.mouth += (clamp(s.m * 1.3 + (1 - s.st) * 0.4, 0, 1) - p.mouth) * k;
    p.sweat += ((s.st < 0.3 ? 1 : 0) - p.sweat) * (1 - Math.exp(-dt * 3));
    p.shake = clamp(p.shake - dt * 3, 0, 1); if (s.snap > 0.5) p.shake = Math.min(1, p.shake + 0.35);
    p.joy += ((over ? (over.win === i ? 1 : 0) : 0) - p.joy) * (1 - Math.exp(-dt * 5));
  }
}

// ---- the athlete -------------------------------------------------------------------------------------------------------------
// Drawn as the LEFT athlete (facing right); the right athlete is the same drawing mirrored by the caller. This is the 2D picture used when the
// 3D scene is not available (and in the small About / How to Play pictures): proportioned like a person (arm and leg lengths from a real
// seated body), shaded limbs with a taper, shorts and socks and trainers, a sleeveless top, hands that wrap the stick, and a face with
// eyes, brow, nose, lips, ear, jaw and hair.
function limb(ctx, ax, ay, bx, by, r0, r1, base, dark, light) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(ax + nx * r0, ay + ny * r0);
  ctx.lineTo(bx + nx * r1, by + ny * r1);
  ctx.arc(bx, by, r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  ctx.lineTo(ax - nx * r0, ay - ny * r0);
  ctx.arc(ax, ay, r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  ctx.closePath();
  const mx = (ax + bx) / 2, my = (ay + by) / 2, r = (r0 + r1) / 2;
  const g = ctx.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r);
  g.addColorStop(0, light); g.addColorStop(0.3, base); g.addColorStop(0.75, base); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fill();
}
function shoe(ctx, a, dark, sole) {
  // trainer seen from the side, toes up against the board: a rounded upper, a laced panel, a thin sole
  ctx.save(); ctx.translate(a.x + 4, a.y - 4); ctx.scale(0.62, 0.62);
  ctx.fillStyle = '#f1eee7';
  ctx.beginPath(); ctx.moveTo(-24, -4); ctx.quadraticCurveTo(-26, 16, -14, 22); ctx.lineTo(22, 22); ctx.quadraticCurveTo(32, 4, 26, -30); ctx.quadraticCurveTo(8, -34, -6, -20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-8, -14); ctx.quadraticCurveTo(8, -26, 22, -16); ctx.lineTo(22, 4); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = sole; ctx.fillRect(-18, 19, 46, 6);
  ctx.strokeStyle = 'rgba(30,26,20,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-24, -4); ctx.quadraticCurveTo(-26, 16, -14, 22); ctx.lineTo(26, 22); ctx.stroke();
  ctx.restore();
}
function hand(ctx, h, ang, look, dark) {
  // a fist around the stick: palm, four curled fingers, thumb over
  ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
  ctx.fillStyle = dark ? shade(look.skin, -0.22) : look.skin;
  ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, TAU); ctx.fill();
  const sk = dark ? shade(look.skinDk, -0.2) : look.skinDk;
  ctx.strokeStyle = sk; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-6 + k * 4.5, 1); ctx.lineTo(-6 + k * 4.5, 10); ctx.stroke(); }
  ctx.fillStyle = dark ? shade(look.skin, -0.12) : shade(look.skin, 0.08);
  ctx.beginPath(); ctx.ellipse(-11, -3, 6, 4, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawAthlete(ctx, L, o) {
  const { look, p, hand0, hand1, t } = o;
  const col = look.kit, kdk = look.kitDk;
  const skin = look.skin, sdk = look.skinDk, slt = shade(look.skin, 0.22);
  const hipX = 285 + 12 * p.dig - 14 * p.rise, hipY = WORLD.floorY - 20 - 64 * p.rise + 5 * p.dig;
  const hip = { x: hipX, y: hipY };
  const TORSO = 150, UPPER = 94, FORE = 90, THIGH = 124, SHIN = 118;
  // torso angle (0 = upright, + = leaning forward toward the stick): the hands decide how far we have to lean to reach
  let lean = 0.2 + p.lean;
  const reach = UPPER + FORE - 6;
  for (let k = 0; k < 16; k++) {
    const sx = hip.x + Math.sin(lean) * TORSO, sy = hip.y - Math.cos(lean) * TORSO;
    if (Math.hypot(hand1.x - sx, hand1.y - sy) <= reach || lean > 0.8) break;
    lean += 0.05;
  }
  const sh = { x: hip.x + Math.sin(lean) * TORSO + (p.shake ? Math.sin(t * 70) * 1.6 * p.shake : 0), y: hip.y - Math.cos(lean) * TORSO + 9 * p.dig };
  const ankle = { x: 478 - 6 * p.rise, y: WORLD.floorY - 25 - 36 * Math.max(0, p.rise - 0.7) / 0.3 };
  const leg = bone2(hip, ankle, THIGH, SHIN, -1);
  const farHip = { x: hip.x - 8, y: hip.y - 6 };
  const farAnkle = { x: ankle.x - 3, y: ankle.y - 4 };
  const farLeg = bone2(farHip, farAnkle, THIGH, SHIN, -1);
  const stretch = (a, h) => clamp(Math.hypot(h.x - a.x, h.y - a.y) / (UPPER + FORE - 3), 1, 1.12);
  const s0 = { x: sh.x - 2, y: sh.y + 4 }, s1 = { x: sh.x + 4, y: sh.y + 2 };
  const arm0 = bone2(s0, hand0, UPPER * stretch(s0, hand0), FORE * stretch(s0, hand0), 1);
  const arm1 = bone2(s1, hand1, UPPER * stretch(s1, hand1), FORE * stretch(s1, hand1), 1);
  const stickAng = Math.atan2(hand1.y - hand0.y, hand1.x - hand0.x);
  // ground shadow
  ctx.save();
  const sg = ctx.createRadialGradient(hip.x + 90, WORLD.floorY + 6, 10, hip.x + 90, WORLD.floorY + 6, 190);
  sg.addColorStop(0, 'rgba(10,8,6,0.38)'); sg.addColorStop(1, 'rgba(10,8,6,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(hip.x + 90, WORLD.floorY + 6, 190, 20, 0, 0, TAU); ctx.fill();
  ctx.restore();
  const dk = (c) => shade(c, -0.2);
  const short = (a, b, r0, r1, d) => limb(ctx, a.x, a.y, b.x, b.y, r0, r1, d ? dk(look.pants) : look.pants, shade(look.pants, d ? -0.5 : -0.38), shade(look.pants, d ? 0.05 : 0.22));
  const bare = (a, b, r0, r1, d) => limb(ctx, a.x, a.y, b.x, b.y, r0, r1, d ? dk(skin) : skin, d ? dk(sdk) : sdk, d ? skin : slt);
  const lerpP = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
  // far leg (a little darker)
  { const k = lerpP(farHip, farLeg.j, 0.82);
    short(farHip, k, 22, 19, true); bare(farLeg.j, farLeg.e, 15.5, 11, true); bare(k, farLeg.j, 19, 15.5, true);
    limb(ctx, lerpP(farLeg.j, farLeg.e, 0.72).x, lerpP(farLeg.j, farLeg.e, 0.72).y, farLeg.e.x, farLeg.e.y, 10.5, 10.5, dk(look.trim), dk(look.trim), look.trim);
    shoe(ctx, farLeg.e, dk('#ba3a2a'), '#9b9488'); }
  // far arm
  limb(ctx, arm1.j.x, arm1.j.y, arm1.e.x, arm1.e.y, 12, 9.5, dk(skin), dk(sdk), skin);
  limb(ctx, sh.x + 4, sh.y + 2, arm1.j.x, arm1.j.y, 15, 12, dk(skin), dk(sdk), skin);
  // near leg: shorts to just above the knee, bare shin, sock and trainer
  { const k = lerpP(hip, leg.j, 0.8);
    short(hip, k, 24, 21, false);
    bare(k, leg.j, 21, 17, false);
    bare(leg.j, leg.e, 17, 11.5, false);
    // knee cap and calf shading
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.ellipse(leg.j.x - 3, leg.j.y - 4, 11, 7, 0.2, 0, TAU); ctx.fill();
    limb(ctx, lerpP(leg.j, leg.e, 0.72).x, lerpP(leg.j, leg.e, 0.72).y, leg.e.x, leg.e.y, 11.5, 11.5, look.trim, shade(look.trim, -0.3), '#ffffff');
    shoe(ctx, leg.e, '#ba3a2a', '#9b9488'); }
  // torso: shoulders broader than the waist, chest slightly forward, a sleeveless top and a waistband
  const ux = (sh.x - hip.x) / TORSO, uy = (sh.y - hip.y) / TORSO, nx = uy, ny = -ux;           // n points to the front (toward the stick)
  const hw = 27, sw = 35;
  const at = (u, f) => ({ x: hip.x + ux * TORSO * u + nx * f, y: hip.y + uy * TORSO * u + ny * f });
  ctx.beginPath();
  let q = at(0, -hw); ctx.moveTo(q.x, q.y);
  q = at(0.45, -hw - 4); const q2 = at(1.0, -sw); ctx.quadraticCurveTo(q.x, q.y, q2.x, q2.y);
  const q3 = at(1.04, -4); ctx.lineTo(q3.x, q3.y);
  const q4 = at(1.03, sw - 4); ctx.lineTo(q4.x, q4.y);
  q = at(0.62, sw + 7); const q5 = at(0.3, hw + 6); ctx.quadraticCurveTo(q.x, q.y, q5.x, q5.y);
  const q6 = at(0, hw + 2); ctx.lineTo(q6.x, q6.y);
  ctx.closePath();
  const g = ctx.createLinearGradient(hip.x - nx * 34, hip.y - ny * 34, hip.x + nx * 42, hip.y + ny * 42);
  g.addColorStop(0, kdk); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 0.32));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = shade(kdk, -0.35); ctx.stroke();
  // top folds, a trim band at the neck and hem, the waistband
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 2;
  for (const [u, f0, f1] of [[0.35, -20, 10], [0.55, -24, 6], [0.2, -18, 8]]) { const a = at(u, f0), b = at(u + 0.05, f1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.strokeStyle = look.trim; ctx.lineWidth = 6;
  { const a = at(0.02, -hw + 1), b = at(0.02, hw + 5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.lineWidth = 4;
  { const a = at(0.97, -sw + 3), b = at(0.97, sw + 1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.restore();
  // shorts over the hip (waistband and the front panel)
  { const a = at(0, -hw - 2), b = at(0.2, sw - 14); limb(ctx, a.x * 0 + hip.x, hip.y, hip.x + ux * 14, hip.y + uy * 14, 30, 29, look.pants, shade(look.pants, -0.35), shade(look.pants, 0.2)); void a; void b; }
  // neck and trapezius
  const hx = sh.x + ux * 38 + 11 + 5 * p.joy, hy = sh.y + uy * 38 - 2 - 4 * p.joy;
  limb(ctx, sh.x + 2, sh.y + 2, hx - 3, hy + 16, 15, 13, skin, sdk, slt);
  // near arm: bare shoulder, upper arm and forearm
  limb(ctx, sh.x - 2, sh.y + 4, arm0.j.x, arm0.j.y, 17, 13, skin, sdk, slt);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(sh.x - 6, sh.y + 8, 11, 9, 0.4, 0, TAU); ctx.fill();
  limb(ctx, arm0.j.x, arm0.j.y, arm0.e.x, arm0.e.y, 13, 10, skin, sdk, slt);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(arm0.j.x, arm0.j.y, 11, 0, TAU); ctx.fill();
  limb(ctx, arm0.j.x, arm0.j.y, arm0.e.x, arm0.e.y, 12.5, 10, skin, sdk, slt);
  head(ctx, hx, hy, look, p, t, sh);
  // the hands are painted after the stick so they wrap it
  return () => { hand(ctx, hand1, stickAng, look, true); hand(ctx, hand0, stickAng, look, false); };
}
function head(ctx, x, y, look, p, t) {
  const r = 29;
  const g = ctx.createRadialGradient(x - 8, y - 10, 4, x + 2, y + 2, r + 8);
  g.addColorStop(0, shade(look.skin, 0.25)); g.addColorStop(0.7, look.skin); g.addColorStop(1, look.skinDk);
  ctx.fillStyle = g;
  // skull and a defined jaw
  ctx.beginPath();
  ctx.moveTo(x - r + 2, y - 4);
  ctx.bezierCurveTo(x - r, y - r - 4, x + r - 2, y - r - 6, x + r - 2, y - 6);
  ctx.lineTo(x + r - 1, y + 4);
  ctx.bezierCurveTo(x + r - 2, y + 18, x + 8, y + r + 6, x - 6, y + r + 2);
  ctx.bezierCurveTo(x - r + 6, y + r - 4, x - r - 1, y + 12, x - r + 2, y - 4);
  ctx.closePath(); ctx.fill();
  // nose
  ctx.beginPath(); ctx.moveTo(x + r - 4, y - 4); ctx.quadraticCurveTo(x + r + 6, y + 3, x + r, y + 10); ctx.lineTo(x + r - 6, y + 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.beginPath(); ctx.moveTo(x + r - 6, y + 10); ctx.lineTo(x + r + 1, y + 11); ctx.lineTo(x + r - 3, y + 7); ctx.closePath(); ctx.fill();
  // cheek light and a jaw shadow
  ctx.fillStyle = 'rgba(255,230,210,0.14)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 8, 9, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(40,20,10,0.12)'; ctx.beginPath(); ctx.ellipse(x - 4, y + r - 2, 18, 6, 0.1, 0, TAU); ctx.fill();
  // hair: a cap with a hairline, longer behind; a ponytail for styles 1 and 3
  ctx.fillStyle = look.hair;
  ctx.beginPath(); ctx.moveTo(x - r - 3, y + 6); ctx.bezierCurveTo(x - r - 8, y - r - 10, x + r, y - r - 14, x + r - 3, y - 12);
  ctx.bezierCurveTo(x + 12, y - 20, x - 4, y - 14, x - r + 5, y + 2); ctx.closePath(); ctx.fill();
  if (look.style % 2 === 1) {
    ctx.beginPath(); ctx.moveTo(x - r, y - 6); ctx.bezierCurveTo(x - r - 22, y + 4, x - r - 20, y + 30, x - r - 10, y + 44); ctx.bezierCurveTo(x - r + 2, y + 30, x - r + 6, y + 10, x - r + 6, y + 2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(x - 2, y - r + 4, 14, 4, -0.1, 0, TAU); ctx.fill();
  // ear
  ctx.fillStyle = look.skinDk; ctx.beginPath(); ctx.ellipse(x - 5, y + 4, 5, 8.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(look.skinDk, -0.25); ctx.beginPath(); ctx.ellipse(x - 5, y + 4, 2.4, 4.6, 0, 0, TAU); ctx.fill();
  // brow, eye (white, iris, lid), mouth
  const strain = p.mouth;
  ctx.strokeStyle = look.hair; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 6, y - 9 - 3 * strain); ctx.lineTo(x + 21, y - 6 + 2 * strain); ctx.stroke();
  ctx.fillStyle = '#f6f1ea'; ctx.beginPath(); ctx.ellipse(x + 14, y - 1, 5.4, p.mouth > 0.8 ? 3.2 : 4.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.arc(x + 15.5, y - 1, 2.8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0c0806'; ctx.beginPath(); ctx.arc(x + 16, y - 1, 1.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = shade(look.skinDk, -0.35); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x + 14, y - 1.5, 5.8, 4.6, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  const my = y + 17, open = p.mouth * 6 + (p.joy > 0.5 ? 2 : 0);
  if (open > 2.2) {
    ctx.fillStyle = '#3a0f0c'; ctx.beginPath(); ctx.ellipse(x + 14, my + 1 + open / 2, 6, open / 1.7 + 1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2ece4'; ctx.fillRect(x + 9, my + 0.5, 10, 2.2);
  }
  ctx.strokeStyle = '#8a4a3c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x + 8, my); ctx.quadraticCurveTo(x + 14, my + 2 + open * 0.3, x + 22, my - (p.joy > 0.5 ? 3 : 0)); ctx.stroke();
  if (p.sweat > 0.2) {
    ctx.fillStyle = `rgba(190,226,255,${0.85 * p.sweat})`;
    for (let k = 0; k < 2; k++) { const ph = (t * 1.4 + k * 0.5) % 1; ctx.beginPath(); ctx.ellipse(x - 20 + k * 14, y - 28 + ph * 18, 3, 5, 0, 0, TAU); ctx.fill(); }
  }
}

// ---- the backdrops -----------------------------------------------------------------------------------------------------------
function crowd(ctx, vx0, vx1, y, rows, t, seed, tone, bob) {
  for (let r = 0; r < rows; r++) {
    const yy = y - r * 26, step = 46 - r * 3;
    for (let x = vx0 - 40 + (r % 2) * 20; x < vx1 + 40; x += step) {
      const k = hash(Math.round(x / 7) * 31 + r * 977 + seed);
      const hb = Math.sin(t * (2 + k * 2) + k * 9) * bob * (k > 0.5 ? 1 : 0.5);
      const c = `hsl(${Math.round(k * 360)} ${25 + k * 25}% ${tone - r * 4}%)`;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, yy + 20 - hb, 17, 22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `hsl(${20 + Math.round(k * 20)} 40% ${tone + 10 - r * 3}%)`;
      ctx.beginPath(); ctx.arc(x, yy - 6 - hb, 9, 0, TAU); ctx.fill();
    }
  }
}
function planks(ctx, vx0, vx1, y0, y1, base, line) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(base, -0.25)); g.addColorStop(0.35, base); g.addColorStop(1, shade(base, -0.12));
  ctx.fillStyle = g; ctx.fillRect(vx0, y0, vx1 - vx0, y1 - y0);
  ctx.strokeStyle = line; ctx.lineWidth = 2;
  const cx = WORLD.cx;
  for (let k = -16; k <= 16; k++) {
    ctx.beginPath(); ctx.moveTo(cx + k * 38, y0); ctx.lineTo(cx + k * 110, y1); ctx.stroke();
  }
  ctx.lineWidth = 1.5;
  for (let k = 1; k < 6; k++) { const yy = y0 + (y1 - y0) * Math.pow(k / 6, 1.7); ctx.beginPath(); ctx.moveTo(vx0, yy); ctx.lineTo(vx1, yy); ctx.stroke(); }
}
export function drawBackdrop(ctx, hall, vx0, vx1, vy0, vy1, t, S, noMat = false) {
  const fl = 322;
  if (hall === 'meadow') {
    const sky = ctx.createLinearGradient(0, vy0, 0, fl);
    sky.addColorStop(0, '#7fb8dc'); sky.addColorStop(0.7, '#cfe7ef'); sky.addColorStop(1, '#f1ead2');
    ctx.fillStyle = sky; ctx.fillRect(vx0, vy0, vx1 - vx0, fl - vy0 + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < 5; k++) { const cx = ((k * 340 + t * 5) % (vx1 - vx0 + 300)) + vx0 - 150, cy = 90 + (k % 3) * 38; ctx.beginPath(); ctx.ellipse(cx, cy, 70, 18, 0, 0, TAU); ctx.ellipse(cx + 40, cy - 10, 44, 16, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#9db8a0'; ctx.beginPath(); ctx.moveTo(vx0, fl); for (let x = vx0; x <= vx1; x += 40) ctx.lineTo(x, 235 + Math.sin(x * 0.01) * 22 + Math.sin(x * 0.027) * 10); ctx.lineTo(vx1, fl); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7da072'; ctx.beginPath(); ctx.moveTo(vx0, fl); for (let x = vx0; x <= vx1; x += 40) ctx.lineTo(x, 270 + Math.sin(x * 0.014 + 2) * 16); ctx.lineTo(vx1, fl); ctx.closePath(); ctx.fill();
    // birches
    for (let x = Math.floor(vx0 / 130) * 130; x < vx1 + 130; x += 130) {
      const k = hash(x * 3 + 5), bx = x + k * 50, h = 150 + k * 60;
      ctx.fillStyle = '#efeadb'; ctx.fillRect(bx - 5, fl - h, 10, h);
      ctx.fillStyle = '#3b3a35'; for (let m = 0; m < 5; m++) ctx.fillRect(bx - 5, fl - h + 24 + m * 28 + k * 8, 5 + (m % 2) * 3, 4);
      ctx.fillStyle = `rgba(${96 + Math.round(k * 40)},${150 + Math.round(k * 30)},${80},0.9)`;
      ctx.beginPath(); ctx.ellipse(bx, fl - h - 6, 40 + k * 10, 52, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(bx - 12, fl - h - 18, 20, 26, 0, 0, TAU); ctx.fill();
    }
    crowd(ctx, vx0, vx1, fl + 4, 2, t, 11, 46, S.cheer * 3 + 1);
    // bunting
    ctx.strokeStyle = '#3d3226'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(vx0, 70); ctx.quadraticCurveTo((vx0 + vx1) / 2, 130, vx1, 70); ctx.stroke();
    const cols = ['#d8582a', '#f2c14e', '#3d8f86', '#f4efe0', '#5876b8'];
    for (let k = 0; k <= 24; k++) { const u = k / 24, x = lerp(vx0, vx1, u), y = 70 + 60 * (1 - Math.pow(2 * u - 1, 2)) * 0.98 - 0; ctx.fillStyle = cols[k % 5]; ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.lineTo(x, y + 24); ctx.closePath(); ctx.fill(); }
    planks(ctx, vx0, vx1, fl, vy1, '#b9885a', 'rgba(60,34,14,0.35)');
  } else if (hall === 'winter') {
    const wall = ctx.createLinearGradient(0, vy0, 0, fl);
    wall.addColorStop(0, '#4a311d'); wall.addColorStop(1, '#8b5d36');
    ctx.fillStyle = wall; ctx.fillRect(vx0, vy0, vx1 - vx0, fl - vy0 + 2);
    ctx.strokeStyle = 'rgba(30,16,6,0.45)'; ctx.lineWidth = 3;
    for (let y = vy0 + 30; y < fl; y += 46) { ctx.beginPath(); ctx.moveTo(vx0, y); ctx.lineTo(vx1, y); ctx.stroke(); }
    // windows with snow and pines
    for (let x = Math.floor(vx0 / 300) * 300 + 80; x < vx1; x += 300) {
      ctx.fillStyle = '#2b1a0e'; ctx.fillRect(x - 6, 54, 172, 164);
      const sk = ctx.createLinearGradient(0, 60, 0, 212); sk.addColorStop(0, '#b4d2e6'); sk.addColorStop(1, '#eef4f6');
      ctx.fillStyle = sk; ctx.fillRect(x, 60, 160, 152);
      ctx.fillStyle = '#2d5b49';
      for (let k = 0; k < 4; k++) { const px = x + 20 + k * 40, py = 214 - (k % 2) * 8; ctx.beginPath(); ctx.moveTo(px, py - 70); ctx.lineTo(px - 20, py); ctx.lineTo(px + 20, py); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; for (let k = 0; k < 14; k++) { const sx = x + ((k * 53 + t * 18) % 160), sy = 60 + ((k * 37 + t * 40) % 150); ctx.fillRect(sx, sy, 3, 3); }
      ctx.fillStyle = '#2b1a0e'; ctx.fillRect(x + 76, 60, 8, 152); ctx.fillRect(x, 130, 160, 8);
    }
    // lamps
    for (let x = Math.floor(vx0 / 300) * 300 + 230; x < vx1; x += 300) {
      ctx.strokeStyle = '#1c1008'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, vy0); ctx.lineTo(x, 70); ctx.stroke();
      const lg = ctx.createRadialGradient(x, 90, 4, x, 90, 130); lg.addColorStop(0, 'rgba(255,214,130,0.85)'); lg.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = lg; ctx.fillRect(x - 130, -40, 260, 260);
      ctx.fillStyle = '#ffe3a0'; ctx.beginPath(); ctx.ellipse(x, 86, 15, 17, 0, 0, TAU); ctx.fill();
    }
    crowd(ctx, vx0, vx1, fl - 2, 3, t, 29, 38, S.cheer * 3 + 1);
    planks(ctx, vx0, vx1, fl, vy1, '#c9a063', 'rgba(70,40,14,0.35)');
  } else {
    const bg = ctx.createLinearGradient(0, vy0, 0, fl);
    bg.addColorStop(0, '#0d1428'); bg.addColorStop(1, '#233658');
    ctx.fillStyle = bg; ctx.fillRect(vx0, vy0, vx1 - vx0, fl - vy0 + 2);
    // spotlight cones
    for (let k = 0; k < 4; k++) {
      const sx = WORLD.cx + (k - 1.5) * 260, sway = Math.sin(t * 0.6 + k) * 30;
      const cg = ctx.createLinearGradient(0, 0, 0, fl + 90); cg.addColorStop(0, 'rgba(190,220,255,0.26)'); cg.addColorStop(1, 'rgba(190,220,255,0.02)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(sx - 12, vy0); ctx.lineTo(sx + 12, vy0); ctx.lineTo(sx + 130 + sway, fl + 90); ctx.lineTo(sx - 130 + sway, fl + 90); ctx.closePath(); ctx.fill();
    }
    // banners
    for (let x = Math.floor(vx0 / 220) * 220 + 60; x < vx1; x += 220) {
      const c = ['#b33a3a', '#2f6aa8', '#d4a437'][Math.abs(Math.round(x / 220)) % 3];
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, vy0); ctx.lineTo(x + 70, vy0); ctx.lineTo(x + 70, 150); ctx.lineTo(x + 35, 176); ctx.lineTo(x, 150); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x + 35, 90, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 35, 90, 9, 0, TAU); ctx.fill();
    }
    crowd(ctx, vx0, vx1, fl + 6, 4, t, 53, 30, S.cheer * 4 + 1.5);
    const fg = ctx.createLinearGradient(0, fl, 0, vy1); fg.addColorStop(0, '#4a3a2c'); fg.addColorStop(1, '#8a6a47');
    ctx.fillStyle = fg; ctx.fillRect(vx0, fl, vx1 - vx0, vy1 - fl);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let k = -16; k <= 16; k++) { ctx.beginPath(); ctx.moveTo(WORLD.cx + k * 40, fl); ctx.lineTo(WORLD.cx + k * 120, vy1); ctx.stroke(); }
    const sh = ctx.createLinearGradient(0, fl, 0, fl + 70); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(vx0, fl, vx1 - vx0, 70);
  }
  if (noMat) return;
  // the mat the athletes sit on
  ctx.save();
  const mg = ctx.createLinearGradient(0, WORLD.floorY - 14, 0, WORLD.floorY + 50);
  mg.addColorStop(0, '#e9dec0'); mg.addColorStop(1, '#bcae86');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.moveTo(110, WORLD.floorY - 10); ctx.lineTo(890, WORLD.floorY - 10); ctx.lineTo(950, WORLD.floorY + 48); ctx.lineTo(50, WORLD.floorY + 48); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a63b22'; ctx.lineWidth = 6; ctx.stroke();
  ctx.strokeStyle = 'rgba(166,59,34,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(130, WORLD.floorY + 2); ctx.lineTo(870, WORLD.floorY + 2); ctx.stroke();
  ctx.restore();
}

// ---- the stick and the board -------------------------------------------------------------------------------------------------
export function stickGeom(B, pose) {
  const dig = (pose[0].dig + pose[1].dig) * 0.5;
  const c = { x: WORLD.cx - B.x * 52 + (pose[0].shake - pose[1].shake) * Math.sin(B.clock * 60) * 1.5, y: 314 - 20 * Math.abs(B.h) + 12 * dig };
  const a = B.h * 0.2;       // clockwise: + lifts the left end
  return { c, a, len: 98 };
}
function drawBoard(ctx) {
  const x = WORLD.cx, y = WORLD.floorY;
  const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0); g.addColorStop(0, '#d8b27a'); g.addColorStop(0.5, '#a97b45'); g.addColorStop(1, '#6e4a26');
  ctx.fillStyle = 'rgba(10,6,2,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 40, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - 14, y - 66, 28, 72, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(40,22,8,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(60,36,12,0.35)'; ctx.beginPath(); for (let k = 0; k < 5; k++) { ctx.moveTo(x - 10 + k * 5, y - 60); ctx.lineTo(x - 9 + k * 5, y); } ctx.stroke();
}
function drawStick(ctx, g, bow, fx) {
  const ca = Math.cos(g.a), sa = Math.sin(g.a), L = g.len;
  ctx.save(); ctx.translate(g.c.x, g.c.y); ctx.rotate(g.a);
  ctx.strokeStyle = 'rgba(10,6,2,0.28)'; ctx.lineWidth = 17; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-L, 18); ctx.quadraticCurveTo(0, 18 + bow, L, 18); ctx.stroke();
  const p = (w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, bow, L, 0); ctx.stroke(); };
  p(17, '#6b4521'); p(13, '#b88a4f'); p(5, '#e8c78e');
  ctx.strokeStyle = 'rgba(60,34,12,0.4)'; ctx.lineWidth = 1.5;
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 24, -5); ctx.lineTo(k * 24 + 9, 5); ctx.stroke(); }
  ctx.restore();
  void ca; void sa; void fx;
}

// ---- the whole stage ---------------------------------------------------------------------------------------------------------
// S: { hall, t, B, pose, looks: [i, j], parts, pops, hint: null | {side, b, u}, cheer, over }
export function drawStage(ctx, rect, S) {
  const sc = Math.min(rect.w / 720, rect.h / 470) * (S.scaleMul || 1);
  const fy = S.focusY ?? 0.5;
  const ox = rect.x + rect.w / 2 - WORLD.cx * sc, oy = rect.y + rect.h * fy - WORLD.cy * sc;
  const vx0 = WORLD.cx - rect.w / 2 / sc, vx1 = WORLD.cx + rect.w / 2 / sc, vy0 = WORLD.cy - rect.h * fy / sc, vy1 = vy0 + rect.h / sc;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.translate(ox, oy); ctx.scale(sc, sc);
  const B = S.B, t = S.t;
  const live3d = STAGE3D.on && !S.flat;
  if (live3d) {
    // the 3D scene shows through a hole punched here; the presenter reads the bridge after the 2D frame is drawn
    ctx.clearRect(vx0 - 2, vy0 - 2, vx1 - vx0 + 4, vy1 - vy0 + 4);
    Object.assign(STAGE3D, { frame: STAGE3D.frame + 1, rect, sc, ox, oy, hall: S.hall, t, B, pose: S.pose, looks: S.looks, over: S.over || null, cheer: S.cheer || 0 });
  } else {
    drawBackdrop(ctx, S.hall, vx0, vx1, vy0, vy1, t, S);
    const g = stickGeom(B, S.pose);
    const ca = Math.cos(g.a), sa = Math.sin(g.a);
    const handAt = (side, d) => ({ x: g.c.x + (side === 0 ? -1 : 1) * ca * d, y: g.c.y + (side === 0 ? -1 : 1) * sa * d + 4 });
    const hands = [];
    for (let i = 0; i < 2; i++) {
      const h0 = handAt(i, 26), h1 = handAt(i, 64);
      ctx.save();
      if (i === 1) { ctx.translate(WORLD.w, 0); ctx.scale(-1, 1); }
      const m = (p) => (i === 1 ? { x: WORLD.w - p.x, y: p.y } : p);
      hands.push(drawAthlete(ctx, null, { look: LOOKS[S.looks[i]], p: S.pose[i], hand0: m(h0), hand1: m(h1), t }));
      ctx.restore();
      if (i === 0) { drawBoard(ctx); }
    }
    const effort = (B.side[0].m + B.side[1].m) / 2;
    drawStick(ctx, g, 4 + effort * 9, 0);
    for (let i = 0; i < 2; i++) {
      ctx.save();
      if (i === 1) { ctx.translate(WORLD.w, 0); ctx.scale(-1, 1); }
      hands[i]();
      ctx.restore();
    }
  }
  // the hint arrow (Think / coach): a ghost vector over the athlete's side
  if (S.hint) drawHintArrow(ctx, S.hint, t);
  // particles and pops
  for (const q of S.parts) {
    const u = q.t / q.max, a = clamp(1 - u, 0, 1);
    if (q.kind === 0) { ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + u), 0, TAU); ctx.fill(); }
    else if (q.kind === 3) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * q.spin); ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.globalAlpha = a; ctx.lineWidth = 4 * (1 - u) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, 14 + u * q.size, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  for (const p of S.pops) {
    const u = p.t / p.max, a = u < 0.15 ? u / 0.15 : clamp(1 - (u - 0.6) / 0.4, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = `800 ${p.size}px 'Avenir Next', 'Trebuchet MS', system-ui, sans-serif`;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,20,24,0.8)'; ctx.strokeText(p.text, p.x, p.y - u * 54);
    ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y - u * 54); ctx.restore();
  }
  ctx.restore();
  // a soft vignette for depth
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const v = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.45, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = v; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.restore();
  return { sc, ox, oy };
}
// world -> screen for the HUD
export function worldToScreen(cam, x, y) { return { x: cam.ox + x * cam.sc, y: cam.oy + y * cam.sc }; }

function drawHintArrow(ctx, h, t) {
  const side = h.side, ax = side === 0 ? (STAGE3D.on ? 392 : 330) : (STAGE3D.on ? 608 : 670), ay = STAGE3D.on ? 222 : 250;
  const dirx = (side === 0 ? -1 : 1) * h.b, diry = -h.u;
  const m = Math.hypot(dirx, diry);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 6);
  if (m < 0.15) {
    ctx.fillStyle = '#9fe7c8'; ctx.beginPath(); ctx.arc(ax, ay, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0b2b24'; ctx.font = '800 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('rest', ax, ay + 8);
  } else {
    const L = 110 * Math.min(1, m + 0.2), ang = Math.atan2(diry, dirx);
    ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = '#ffe25a'; ctx.strokeStyle = 'rgba(20,16,0,0.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(L - 34, -12); ctx.lineTo(L - 34, -30); ctx.lineTo(L, 0); ctx.lineTo(L - 34, 30); ctx.lineTo(L - 34, 12); ctx.lineTo(0, 12); ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  ctx.restore();
}

// The compass drawn for the pull pad and the Rules page: back, lift and sink for a side.
export function drawCompass(ctx, cx, cy, r, side, vec, o = {}) {
  const sgn = side === 0 ? -1 : 1;     // back points toward the screen edge on the athlete's own side
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(8,24,28,0.45)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(190,230,235,0.55)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(190,230,235,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  const lab = o.labels !== false;
  if (lab) {
    ctx.fillStyle = 'rgba(235,245,240,0.9)'; ctx.font = `700 ${Math.max(11, Math.round(r * 0.19))}px 'Avenir Next', 'Trebuchet MS', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BACK', sgn * r * 0.62, 0); ctx.fillText('LIFT', 0, -r * 0.7); ctx.fillText('SINK', 0, r * 0.7);
  }
  if (vec) {
    const x = sgn * vec.b * r * 0.9, y = -vec.u * r * 0.9;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(4, r * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x, y, Math.max(7, r * 0.13), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export { leverage };
