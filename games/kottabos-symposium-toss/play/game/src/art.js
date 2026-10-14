// All the drawing for Kottabos: a black-figure vase-painting room, the reclining player's arm and two-handled cup, bronze disc
// stands with their dish, a basin of floating cups, water drops and splashes, and the diagrams for the reader pages.
// Pure canvas 2D, no DOM. World units are centimetres; a camera cam = { ox, cx, cy, my, s } maps them:
//   X = ox + (x - cx) * s,   Y = my - (y - cy) * s
import { HAND, BASIN, DISC_T, MANES_DROP, MANES_T, POLE_R, bowlX, standGeom, discPose, NDROP, G, guidePath, AIM, POINTS } from './sim.js';
import { roundPath } from './ui.js';

export const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', 'Iowan Old Style', 'Hoefler Text', Georgia, 'Times New Roman', serif";
export const PAL = {
  glaze: '#15100d', glaze2: '#2a1b14', clay: '#cf6a30', clay2: '#e58c4e', clay3: '#a24a1f', cream: '#f6e6c4', plum: '#7b2b3b',
  bronze: '#d8a845', bronzeD: '#6b4812', bronzeL: '#ffe39a', water: '#3bb6da', waterL: '#b4f0fa', waterD: '#15708f', olive: '#8fb339', oliveD: '#4a5a14',
};
export const TEAM = [
  { name: 'Madder', main: '#d9553a', dark: '#6e1f12', light: '#ff9d7e' },
  { name: 'Olive', main: '#8fb339', dark: '#41540f', light: '#d4ee8c' },
];
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rgrad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

// ---- camera -------------------------------------------------------------------------------------------------------------------------
// scene = { x, w, floorY, top }.  z = 0 wide view of the whole room, 1 close on the target (fx, fy = the point to look at).
export function cameraFor(scene, sc, z, focus) {
  const hAvail = Math.max(160, scene.floorY - scene.top), my = (scene.top + scene.floorY) / 2;
  const xl = -135, xr = sc.maxX + 16;
  const sWide = Math.min(scene.w / (xr - xl), hAvail / (sc.maxY + 44));
  const sFocus = Math.min((scene.w * 0.94) / 120, hAvail / 130);
  const e = smooth(z), s = Math.exp(lerp(Math.log(sWide), Math.log(Math.max(sWide, sFocus)), e));
  const cxW = (xl + xr) / 2, cyW = (scene.floorY - my) / sWide;
  const f = focus || { x: sc.D, y: 40 };
  // never let the floor line drop below the scene's floor (the panel under it would hide the stand's base)
  return { ox: scene.x + scene.w / 2, cx: lerp(cxW, f.x, e), cy: Math.min(lerp(cyW, f.y + 8, e), (scene.floorY - my) / s), my, s };
}
export const sx = (cam, x) => cam.ox + (x - cam.cx) * cam.s;
export const sy = (cam, y) => cam.my - (y - cam.cy) * cam.s;

// ---- the room -------------------------------------------------------------------------------------------------------------------------
function meander(ctx, x0, x1, y, h, col, step) {
  // a Greek key band: a square spiral repeated along x
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, h * 0.14); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  ctx.beginPath();
  const u = h / 6;
  for (let x = x0; x < x1; x += step) {
    ctx.moveTo(x, y + h); ctx.lineTo(x, y); ctx.lineTo(x + 5 * u, y); ctx.lineTo(x + 5 * u, y + 4 * u); ctx.lineTo(x + 2 * u, y + 4 * u); ctx.lineTo(x + 2 * u, y + 2 * u); ctx.lineTo(x + 3.5 * u, y + 2 * u);
    ctx.moveTo(x + 5 * u, y + h); ctx.lineTo(x + step, y + h);
  }
  ctx.stroke(); ctx.restore();
}
function rosettes(ctx, x0, x1, y, r, step, t) {
  for (let x = x0 + step / 2, i = 0; x < x1; x += step, i++) {
    ctx.fillStyle = PAL.cream; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.glaze;
    for (let k = 0; k < 6; k++) { const a = k * 1.047 + (i % 2) * 0.5; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.26, 0, 7); ctx.fill(); }
  }
}

export function drawRoom(ctx, w, h, t, cam, o = {}) {
  const fy = clamp(sy(cam, 0), h * 0.25, h - 4), s = cam.s;
  // wall
  ctx.fillStyle = grad(ctx, 0, 0, 0, fy, [[0, '#a8461f'], [0.35, '#c85f28'], [0.75, '#e0803c'], [1, '#ec9a55']]); ctx.fillRect(0, 0, w, fy + 1);
  // a soft light pool from the lamp
  const lx = w * 0.78, ly = fy * 0.32 + Math.sin(t * 2.3) * 1.5, fl = 0.9 + 0.1 * Math.sin(t * 7.1) * Math.sin(t * 3.3);
  ctx.fillStyle = rgrad(ctx, lx, ly, 0, Math.max(w, fy) * 0.62, [[0, `rgba(255,226,150,${0.5 * fl})`], [0.4, 'rgba(255,190,110,0.18)'], [1, 'rgba(255,170,90,0)']]); ctx.fillRect(0, 0, w, fy);
  // painted panel behind the action: a darker clay field with a palmette chain
  const px = w * 0.035, pw = w * 0.93, py = Math.max(34, fy * 0.1), ph = fy - py - Math.max(14, fy * 0.04);
  ctx.fillStyle = 'rgba(120,40,12,0.18)'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(21,16,13,0.55)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
  // palmette chain (lotus + palmette), faint
  ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = PAL.glaze;
  const pn = Math.max(5, Math.round(pw / 120)), pstep = pw / pn, base = py + ph * 0.62;
  for (let i = 0; i < pn; i++) {
    const cx = px + pstep * (i + 0.5), up = i % 2 === 0, sgn = up ? -1 : 1, rr = Math.min(pstep * 0.34, 44);
    for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * 0.32 * sgn * -1; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr * 0.55, base + Math.sin(a) * rr * 0.55 * sgn * -1 * -1, rr * 0.2, rr * 0.55, a + Math.PI / 2, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx, base, rr * 0.22, 0, 7); ctx.fill();
  }
  ctx.restore();
  // tondi: red-figure style medallions (a rosette, a dolphin, a lotus), faint, in a row above the chain
  { const n = clamp(Math.round(w / 200), 3, 6), r = Math.min(58, (w - 2 * px) / (n * 2.5), ph * 0.2), cy = py + ph * 0.34;
    for (let i = 0; i < n; i++) {
      const cx = px + (pw / n) * (i + 0.5);
      ctx.save(); ctx.globalAlpha = 0.82;
      ctx.fillStyle = PAL.glaze; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, 0, 7); ctx.stroke();
      ctx.strokeStyle = PAL.clay2; ctx.fillStyle = PAL.clay2; ctx.lineWidth = Math.max(1.5, r * 0.07);
      const k = i % 3;
      if (k === 0) { for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42, r * 0.26, r * 0.1, a, 0, 7); ctx.fill(); } ctx.beginPath(); ctx.arc(cx, cy, r * 0.17, 0, 7); ctx.fill(); }
      else if (k === 1) { ctx.beginPath(); ctx.moveTo(cx - r * 0.62, cy + r * 0.1); ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.52, cx + r * 0.38, cy - r * 0.12); ctx.quadraticCurveTo(cx + r * 0.62, cy + r * 0.1, cx + r * 0.7, cy + r * 0.38); ctx.quadraticCurveTo(cx + r * 0.38, cy + r * 0.2, cx + r * 0.2, cy + r * 0.26); ctx.quadraticCurveTo(cx - r * 0.2, cy + r * 0.44, cx - r * 0.62, cy + r * 0.1); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + r * 0.7, cy + r * 0.38); ctx.lineTo(cx + r * 0.84, cy + r * 0.2); ctx.lineTo(cx + r * 0.86, cy + r * 0.52); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - r * 0.06, cy - r * 0.34); ctx.lineTo(cx + r * 0.1, cy - r * 0.62); ctx.lineTo(cx + r * 0.2, cy - r * 0.26); ctx.fill(); }
      else { for (let q = -3; q <= 3; q++) { const a = -Math.PI / 2 + q * 0.34; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.36, cy + r * 0.2 + Math.sin(a) * r * 0.5, r * 0.11, r * 0.34, a + Math.PI / 2, 0, 7); ctx.fill(); } ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.2); ctx.lineTo(cx, cy + r * 0.72); ctx.stroke(); }
      ctx.restore();
    } }
  // top frieze: black band, meander in terracotta, rosettes underneath
  const bh = clamp(h * 0.034, 24, 44);
  ctx.fillStyle = PAL.glaze; ctx.fillRect(0, 0, w, bh);
  meander(ctx, 4, w, 5, bh - 10, PAL.clay2, Math.max(26, bh * 1.0));
  ctx.fillStyle = PAL.glaze; ctx.fillRect(0, bh, w, 6);
  ctx.fillStyle = PAL.bronze; ctx.fillRect(0, bh + 6, w, 2);
  // fluted columns at both edges
  const cw = clamp(w * 0.05, 22, 54);
  for (const x0 of [0, w - cw]) {
    ctx.fillStyle = grad(ctx, x0, 0, x0 + cw, 0, [[0, '#4a2412'], [0.3, '#8b3d1c'], [0.5, '#b8592a'], [1, '#3e1d0e']]); ctx.fillRect(x0, bh + 8, cw, fy - bh - 8);
    ctx.strokeStyle = 'rgba(15,8,4,0.5)'; ctx.lineWidth = 1.5;
    for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x0 + (cw * k) / 5, bh + 14); ctx.lineTo(x0 + (cw * k) / 5, fy); ctx.stroke(); }
    ctx.fillStyle = PAL.glaze; ctx.fillRect(x0 - 3, bh + 8, cw + 6, 10); ctx.fillRect(x0 - 3, fy - 14, cw + 6, 14);
  }
  // floor: dark glaze with a gold line and a mosaic band, lit toward the player
  const gy = fy;
  ctx.fillStyle = grad(ctx, 0, gy, 0, h, [[0, '#33190f'], [0.25, '#20100a'], [1, '#0e0705']]); ctx.fillRect(0, gy, w, h - gy);
  ctx.fillStyle = PAL.bronze; ctx.fillRect(0, gy - 2, w, 4);
  const mb = Math.min(h - gy, Math.max(18, s * 5));
  ctx.fillStyle = PAL.cream; ctx.fillRect(0, gy + 4, w, 2);
  meander(ctx, 0, w, gy + 10, Math.max(12, mb * 0.5), PAL.clay, Math.max(20, mb * 0.8));
  ctx.fillStyle = grad(ctx, 0, gy, 0, gy + 22, [[0, 'rgba(255,200,130,0.45)'], [1, 'rgba(255,200,130,0)']]); ctx.fillRect(0, gy, w, 22);
}

// ---- the player: a reclining symposiast on a couch, in black-figure style, with the cup hooked on one finger ----------------------------
// The figure is drawn in world centimetres (y up) so it scales with the camera. snap: 0..1 the wrist snapping through; charge: 0..1 the
// wrist cocked back while a slide is in progress; aimA: degrees (the cup tips toward it); side picks the drapery colour.
const ELBOW = { x: -25, y: 41 };
export function handPose(charge = 0, snap = 0) {
  const L = Math.hypot(HAND.x - ELBOW.x, HAND.y - ELBOW.y), a0 = Math.atan2(HAND.y - ELBOW.y, HAND.x - ELBOW.x);
  const a = a0 - 0.42 * charge + 0.34 * snap;
  return { x: ELBOW.x + Math.cos(a) * L, y: ELBOW.y + Math.sin(a) * L, a };
}
function path(ctx, pts, P, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => { const [X, Y] = P(p[0], p[1]); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
  if (close) ctx.closePath();
}
function curve(ctx, pts, P) {
  // a smooth closed curve through the points (Catmull-Rom to quadratic midpoints)
  const n = pts.length, M = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  const s0 = M(pts[n - 1], pts[0]), [x0, y0] = P(s0[0], s0[1]); ctx.moveTo(x0, y0);
  for (let i = 0; i < n; i++) { const c = pts[i], e = M(pts[i], pts[(i + 1) % n]), [cx, cy] = P(c[0], c[1]), [ex, ey] = P(e[0], e[1]); ctx.quadraticCurveTo(cx, cy, ex, ey); }
  ctx.closePath();
}

export function drawPlayer(ctx, cam, o = {}) {
  const { snap = 0, aimA = 45, side = 0, charge = 0, t = 0, loaded = true } = o;
  // the couch and legs are drawn foreshortened (x < -60 compressed) so the whole reclining figure fits in the left margin of the scene
  const fx = (x) => (x < -60 ? -60 + (x + 60) * 0.45 : x);
  const z = cam.s, P = (x, y) => [sx(cam, fx(x)), sy(cam, y)], tm = TEAM[side];
  const ink = PAL.glaze, line = 'rgba(246,230,196,0.62)';
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // couch: turned legs, a thick mattress with a woven band, a bolster at the head end
  const seatY = 21;
  ctx.fillStyle = ink;
  for (const lx of [-128, -66, -20]) { path(ctx, [[lx - 2, 0], [lx + 2, 0], [lx + 1.4, 8], [lx + 3.2, 11], [lx + 1, 14], [lx + 1.8, seatY - 5], [lx - 1.8, seatY - 5], [lx - 1, 14], [lx - 3.2, 11], [lx - 1.4, 8]], P); ctx.fill(); }
  path(ctx, [[-136, seatY - 5], [-10, seatY - 5], [-8, seatY - 2], [-136, seatY - 2]], P); ctx.fill();
  const [mx0, my0] = P(-138, seatY + 7), [mx1, my1] = P(-8, seatY - 2);
  ctx.fillStyle = PAL.cream; roundPath(ctx, mx0, my0, mx1 - mx0, my1 - my0, 4 * z); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(mx0, my0, mx1 - mx0, my1 - my0); ctx.clip();
  ctx.fillStyle = tm.main; for (let x = -136; x < -8; x += 9) { const [a0, b0] = P(x, seatY + 7), [a1] = P(x + 4.5, seatY + 7); ctx.fillRect(a0, b0, a1 - a0, my1 - my0); }
  ctx.restore();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.5, 1.1 * z); roundPath(ctx, mx0, my0, mx1 - mx0, my1 - my0, 4 * z); ctx.stroke();
  // bolster under the propped elbow
  curve(ctx, [[-64, seatY + 6], [-52, seatY + 14], [-38, seatY + 13], [-34, seatY + 6], [-46, seatY + 2]], P);
  ctx.fillStyle = tm.dark; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke();
  // legs and lower body under a drape of the side's colour
  curve(ctx, [[-136, seatY + 7], [-120, seatY + 15], [-96, seatY + 18], [-78, seatY + 22], [-60, seatY + 20], [-60, seatY + 8]], P);
  ctx.fillStyle = tm.main; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.2, z); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, z * 0.7);
  for (const [x0, y0, x1, y1] of [[-120, seatY + 9, -110, seatY + 16], [-100, seatY + 9, -92, seatY + 18], [-84, seatY + 10, -76, seatY + 20]]) { const a = P(x0, y0), b = P(x1, y1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2 - 2, b[0], b[1]); ctx.stroke(); }
  // torso (black), turned to the right, propped on the left elbow
  curve(ctx, [[-82, seatY + 12], [-70, seatY + 26], [-56, seatY + 36], [-46, seatY + 44], [-36, seatY + 42], [-34, seatY + 32], [-44, seatY + 22], [-56, seatY + 14]], P);
  ctx.fillStyle = ink; ctx.fill();
  // drape across the hips, over the shoulder
  curve(ctx, [[-84, seatY + 10], [-72, seatY + 22], [-60, seatY + 26], [-50, seatY + 30], [-52, seatY + 22], [-62, seatY + 12]], P);
  ctx.fillStyle = tm.main; ctx.fill(); ctx.strokeStyle = ink; ctx.stroke();
  // chest and ribs incised
  ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, z * 0.55);
  for (const [x0, y0, x1, y1] of [[-50, seatY + 37, -42, seatY + 33], [-52, seatY + 33, -43, seatY + 28], [-55, seatY + 29, -46, seatY + 24]]) { const a = P(x0, y0), b = P(x1, y1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2, b[0], b[1]); ctx.stroke(); }
  // propped left arm along the bolster
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(3, 6.2 * z);
  { const a = P(-44, seatY + 36), b = P(-56, seatY + 16), c = P(-40, seatY + 12); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke(); }
  // head: profile facing right, hair, beard, wreath
  const hx = -33, hy = seatY + 50, R = 8.2;
  const hp = (x, y) => P(hx + x * R / 8.2, hy + y * R / 8.2);
  // neck
  ctx.fillStyle = ink; path(ctx, [[hx - 4, hy - 6], [hx + 3, hy - 6], [hx + 1, seatY + 40], [hx - 8, seatY + 40]], P); ctx.fill();
  curve(ctx, [[-8, 2], [-7, 7], [-2, 9.6], [3.6, 8.2], [5.4, 5.2], [6.6, 3.4], [6.2, 1.6], [8.9, -0.6], [6.6, -1.8], [7, -3], [6.4, -4], [6.8, -5.6], [4.6, -7.4], [0, -8.2], [-5, -6.8], [-8.4, -2]], hp);
  ctx.fillStyle = ink; ctx.fill();
  // beard
  curve(ctx, [[6.4, -3.6], [6.0, -9.2], [2.6, -11.2], [-1.5, -8.4], [2, -6.6], [5, -5.4]], hp);
  ctx.fill();
  // eye, brow and hair curls in incised cream
  ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, z * 0.6);
  { const e = hp(3.4, 2.4); ctx.beginPath(); ctx.ellipse(e[0], e[1], R * 0.18 * z, R * 0.1 * z, 0, 0, 7); ctx.stroke(); const b1 = hp(2, 4.2), b2 = hp(5.8, 4.4); ctx.beginPath(); ctx.moveTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke(); }
  ctx.fillStyle = PAL.cream;
  for (let k = 0; k < 6; k++) { const q = hp(-7 + k * 2.1, 6.2 - Math.abs(k - 2.5) * 0.4); ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1, R * 0.12 * z), 0, 7); ctx.fill(); }
  // ivy wreath
  ctx.fillStyle = PAL.olive;
  for (let k = 0; k < 7; k++) { const a = Math.PI * (0.95 - k * 0.19), q = hp(Math.cos(a) * 7.6 - 0.8, Math.sin(a) * 8.6 + 0.6); ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(-a + 0.4); ctx.beginPath(); ctx.ellipse(0, 0, R * 0.24 * z, R * 0.11 * z, 0, 0, 7); ctx.fill(); ctx.restore(); }
  // the cup arm: shoulder -> elbow -> wrist, the forearm rocking about the elbow with the wrist
  const hand = handPose(charge, snap);
  const shoulder = [-40, seatY + 36];
  ctx.strokeStyle = ink; ctx.lineCap = 'round';
  { const a = P(shoulder[0], shoulder[1]), e = P(ELBOW.x, ELBOW.y), w = P(hand.x - 4, hand.y + 0.5);
    ctx.lineWidth = Math.max(3, 6.6 * z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    ctx.lineWidth = Math.max(2.5, 5.2 * z); ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(w[0], w[1]); ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(e[0], e[1], Math.max(2, 3.3 * z), 0, 7); ctx.fill();
    // forearm bracelet and incised line
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = Math.max(1.5, z * 1.2); const bw = P(hand.x - 8, hand.y + 0.6); ctx.beginPath(); ctx.arc(bw[0], bw[1], Math.max(2, 2.6 * z), 0, 7); ctx.stroke(); }
  // the cup (kylix) in the hand: tips toward the aim, snaps forward through the flick
  const [cx, cy] = P(hand.x + (HAND.x - hand.x) * 0, hand.y);
  const tilt = (-(aimA - 20) * 0.45 - snap * 34 + charge * 8) * (Math.PI / 180);
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(tilt);
  const R2 = 8.6 * z;
  ctx.fillStyle = ink;
  ctx.fillRect(-1.1 * z, 2 * z, 2.2 * z, 8 * z);
  roundPath(ctx, -4.6 * z, 9.6 * z, 9.2 * z, 2.2 * z, 1.1 * z); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-R2, -1.5 * z); ctx.quadraticCurveTo(-R2 * 0.9, 6.5 * z, 0, 7 * z); ctx.quadraticCurveTo(R2 * 0.9, 6.5 * z, R2, -1.5 * z); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tm.main; ctx.beginPath(); ctx.moveTo(-R2 * 0.82, 1.4 * z); ctx.quadraticCurveTo(0, 3 * z, R2 * 0.82, 1.4 * z); ctx.lineTo(R2 * 0.76, 2.5 * z); ctx.quadraticCurveTo(0, 4.3 * z, -R2 * 0.76, 2.5 * z); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.4, 1.4 * z);
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sg * (R2 + 2.6 * z), 0.2 * z, 3.2 * z, 2.6 * z, 0, 0, 7); ctx.stroke(); }
  if (loaded) {
    ctx.fillStyle = PAL.water; ctx.beginPath(); ctx.ellipse(0, -1.2 * z, R2 * 0.85, 1.4 * z, 0, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.waterL; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6); ctx.beginPath(); ctx.ellipse(-R2 * 0.3, -1.7 * z, 1.8 * z, 0.5 * z, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(246,230,196,0.75)'; ctx.lineWidth = Math.max(1, z * 0.7);
  ctx.beginPath(); ctx.moveTo(-R2, -1.5 * z); ctx.lineTo(R2, -1.5 * z); ctx.stroke();
  // the hand: fist behind the near handle, one finger through it
  ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(-R2 - 6.4 * z, 1.5 * z, 5.2 * z, 4.4 * z, 0.2, 0, 7); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, 2.6 * z);
  ctx.beginPath(); ctx.moveTo(-R2 - 5 * z, 3 * z); ctx.quadraticCurveTo(-R2 - 2 * z, -2.8 * z, -R2 + 0.6 * z, 0.2 * z); ctx.stroke();
  ctx.lineWidth = Math.max(1.6, 2.2 * z); ctx.beginPath(); ctx.moveTo(-R2 - 7 * z, -1.2 * z); ctx.quadraticCurveTo(-R2 * 0.55, -5.2 * z, -R2 * 0.15, -1.6 * z); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ---- stands ----------------------------------------------------------------------------------------------------------------------------
function bronzeGrad(ctx, x0, y0, x1, y1) { return grad(ctx, x0, y0, x1, y1, [[0, PAL.bronzeD], [0.28, PAL.bronze], [0.5, PAL.bronzeL], [0.75, PAL.bronze], [1, PAL.bronzeD]]); }

export function drawStand(ctx, cam, s, pose, t, o = {}) {
  const g = standGeom(s), z = cam.s, X = (x) => sx(cam, x), Y = (y) => sy(cam, y);
  const { dishRing = 0, glow = 0, discGone = false, dishFlash = 0 } = o;
  // base and pole
  const px = X(s.x), floorY = Y(0), topY = Y(g.ysup);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, floorY + 2, 16 * z, 3 * z, 0, 0, 7); ctx.fill();
  ctx.fillStyle = grad(ctx, px - 11 * z, 0, px + 11 * z, 0, [[0, '#0a0604'], [0.4, '#33241b'], [1, '#0a0604']]);
  roundPath(ctx, px - 11 * z, floorY - 4 * z, 22 * z, 4 * z, 2 * z); ctx.fill();
  roundPath(ctx, px - 7 * z, floorY - 9 * z, 14 * z, 6 * z, 2 * z); ctx.fill();
  // pole with rings
  ctx.fillStyle = grad(ctx, px - POLE_R * z, 0, px + POLE_R * z, 0, [[0, PAL.bronzeD], [0.4, PAL.bronzeL], [1, PAL.bronzeD]]);
  ctx.fillRect(px - POLE_R * z, topY, POLE_R * 2 * z, floorY - topY - 8 * z);
  ctx.fillStyle = PAL.bronzeD;
  for (let y = g.ysup - 8; y > 12; y -= 24) { ctx.fillRect(px - POLE_R * 1.9 * z, Y(y), POLE_R * 3.8 * z, 1.4 * z); }
  // the dish (manes) hung beneath
  const my = Y(g.manesY), rm = s.rm * z;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px, my + MANES_T * z * 0.8, rm * 0.95, Math.max(2, z * 1.4), 0, 0, 7); ctx.fill();
  ctx.fillStyle = bronzeGrad(ctx, px - rm, 0, px + rm, 0);
  ctx.beginPath(); ctx.moveTo(px - rm, my - MANES_T * z); ctx.quadraticCurveTo(px - rm * 0.8, my + MANES_T * z * 1.9, px, my + MANES_T * z * 2.2); ctx.quadraticCurveTo(px + rm * 0.8, my + MANES_T * z * 1.9, px + rm, my - MANES_T * z); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.bronzeL; ctx.beginPath(); ctx.ellipse(px, my - MANES_T * z, rm, Math.max(1.6, z * 1.1), 0, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.bronzeD; ctx.beginPath(); ctx.ellipse(px, my - MANES_T * z + 0.6, rm * 0.82, Math.max(1.1, z * 0.75), 0, 0, 7); ctx.fill();
  if (dishFlash > 0) {
    ctx.strokeStyle = `rgba(255,240,170,${dishFlash})`; ctx.lineWidth = 2.5;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(px, my, rm * (1.05 + k * 0.2 + (1 - dishFlash) * 0.5), Math.max(3, z * 2.6) * (1 + k * 0.4), 0, 0, 7); ctx.stroke(); }
  }
  // support cup at the top of the pole
  ctx.fillStyle = bronzeGrad(ctx, px - 5 * z, 0, px + 5 * z, 0);
  ctx.beginPath(); ctx.moveTo(px - 5 * z, topY); ctx.lineTo(px - 2 * z, topY + 5 * z); ctx.lineTo(px + 2 * z, topY + 5 * z); ctx.lineTo(px + 5 * z, topY); ctx.closePath(); ctx.fill();
  // the disc (plastinx), rocking on the support
  if (!discGone) drawDisc(ctx, cam, s, pose, glow, t);
  ctx.restore();
}

export function drawDisc(ctx, cam, s, pose, glow = 0, t = 0) {
  const z = cam.s, r = s.r * z, th = DISC_T * z;
  const x = sx(cam, pose.x), y = sy(cam, pose.y);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-pose.rot);
  // pivot at the middle of the underside: the disc rocks about (0, 0)
  ctx.shadowColor = glow > 0 ? 'rgba(255,230,140,0.9)' : 'rgba(0,0,0,0)'; ctx.shadowBlur = glow * 18;
  ctx.fillStyle = grad(ctx, -r, 0, r, 0, [[0, PAL.bronzeD], [0.2, PAL.bronze], [0.45, PAL.bronzeL], [0.7, PAL.bronze], [1, PAL.bronzeD]]);
  ctx.beginPath(); ctx.moveTo(-r, -th * 0.3); ctx.quadraticCurveTo(-r * 1.0, -th, -r * 0.7, -th); ctx.lineTo(r * 0.7, -th); ctx.quadraticCurveTo(r * 1.0, -th, r, -th * 0.3); ctx.quadraticCurveTo(r * 0.6, th * 0.1, 0, th * 0.1); ctx.quadraticCurveTo(-r * 0.6, th * 0.1, -r, -th * 0.3); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,248,210,0.75)'; ctx.beginPath(); ctx.ellipse(0, -th * 0.95, r * 0.7, Math.max(1, th * 0.12), 0, 0, 7); ctx.fill();
  ctx.strokeStyle = PAL.bronzeD; ctx.lineWidth = Math.max(1, z * 0.5);
  ctx.beginPath(); ctx.moveTo(-r * 0.8, -th * 0.55); ctx.lineTo(r * 0.8, -th * 0.55); ctx.stroke();
  // engraved dots
  ctx.fillStyle = PAL.bronzeD;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc((k * r) / 3, -th * 0.55, Math.max(0.8, z * 0.35), 0, 7); ctx.fill(); }
  ctx.restore();
}

// ---- the basin ------------------------------------------------------------------------------------------------------------------------
export function drawBasin(ctx, cam, sc, board, clock, o = {}) {
  const z = cam.s, X = (x) => sx(cam, x), Y = (y) => sy(cam, y);
  const bx = sc.basin.x, hw = BASIN.halfW, W = BASIN.water, wy = Y(W), cxs = X(bx), rx = hw * z, ry = Math.max(4, 4.6 * z);
  const { ripples = [], sinking = {}, flash = {} } = o;
  ctx.save();
  // floor shadow and the foot
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cxs, Y(0) + 2, rx * 0.8, Math.max(3, 3.4 * z), 0, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.glaze;
  ctx.beginPath(); ctx.moveTo(X(bx - hw * 0.42), Y(0)); ctx.lineTo(X(bx + hw * 0.42), Y(0)); ctx.lineTo(X(bx + hw * 0.3), Y(5)); ctx.lineTo(X(bx - hw * 0.3), Y(5)); ctx.closePath(); ctx.fill();
  // the bowl: terracotta body with a black glaze band under the lip
  const body = () => { ctx.beginPath(); ctx.moveTo(X(bx - hw), wy); ctx.quadraticCurveTo(X(bx - hw * 0.98), Y(4), X(bx - hw * 0.34), Y(4)); ctx.lineTo(X(bx + hw * 0.34), Y(4)); ctx.quadraticCurveTo(X(bx + hw * 0.98), Y(4), X(bx + hw), wy); ctx.ellipse(cxs, wy, rx, ry, 0, 0, Math.PI, false); ctx.closePath(); };
  body(); ctx.fillStyle = grad(ctx, X(bx - hw), 0, X(bx + hw), 0, [[0, '#6e2a0f'], [0.3, '#c8602a'], [0.55, '#e08a4c'], [1, '#5c230c']]); ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = PAL.glaze; ctx.fillRect(X(bx - hw) - 2, wy - 1, rx * 2 + 4, 4.6 * z);
  ctx.fillStyle = PAL.cream;
  for (let k = 0; k < 15; k++) { ctx.beginPath(); ctx.arc(X(bx - hw * 0.92 + (k / 14) * hw * 1.84), wy + 2.2 * z, Math.max(1, z * 0.45), 0, 7); ctx.fill(); }
  ctx.strokeStyle = 'rgba(21,16,13,0.5)'; ctx.lineWidth = Math.max(1, z * 0.5);
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cxs, wy, rx * (1 - k * 0.1), ry * (1 + k * 0.5), 0, 0.15, Math.PI - 0.15); ctx.stroke(); }
  ctx.restore();
  // water surface inside the rim
  ctx.fillStyle = grad(ctx, 0, wy - ry, 0, wy + ry, [[0, PAL.waterD], [0.5, PAL.water], [1, PAL.waterL]]);
  ctx.beginPath(); ctx.ellipse(cxs, wy, rx * 0.97, ry * 0.9, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, z * 0.45);
  for (let k = 0; k < 6; k++) {
    const gx = cxs + (-0.7 + (k / 5) * 1.4) * rx + Math.sin(clock * 1.1 + k) * 3, gy = wy + Math.sin(k * 2.1) * ry * 0.35;
    ctx.beginPath(); ctx.moveTo(gx - 7 * z * 0.4, gy); ctx.lineTo(gx + 7 * z * 0.4, gy); ctx.stroke();
  }
  for (const r of ripples) {
    const k = r.t / r.life; if (k >= 1) continue;
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(X(r.x), wy, (3 + k * 14) * z * 0.6, Math.max(1.2, (1 + k * 3.2) * z * 0.45), 0, 0, 7); ctx.stroke();
  }
  // cups
  sc.basin.bowls.forEach((b, i) => {
    const x = bowlX(sc, b, clock), bob = Math.sin(clock * 1.7 + i * 1.9) * 0.35;
    const sk = sinking[i] || 0;
    drawCup(ctx, cam, x, W + bob - sk * 7, b, board.vol[i] || 0, sk, board.sunk[i] && sk === 0, clock, flash[i] || 0, i);
  });
  // front lip of the rim over the water edge
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = Math.max(2, z * 0.9);
  ctx.beginPath(); ctx.ellipse(cxs, wy, rx, ry, 0, 0, Math.PI, false); ctx.stroke();
  ctx.strokeStyle = PAL.bronzeL; ctx.lineWidth = Math.max(1, z * 0.35);
  ctx.beginPath(); ctx.ellipse(cxs, wy - 0.5, rx, ry, 0, 0.2, Math.PI - 0.2, false); ctx.stroke();
  ctx.strokeStyle = PAL.bronzeD; ctx.lineWidth = Math.max(2, z * 0.9);
  ctx.beginPath(); ctx.ellipse(cxs, wy, rx, ry, 0, Math.PI, Math.PI * 2, false); ctx.stroke();
  ctx.restore();
}

function drawCup(ctx, cam, x, y, b, vol, sink, gone, t, flash, idx) {
  if (gone) return;
  const z = cam.s, X = sx(cam, x), Y = sy(cam, y), hw = (b.w / 2) * z, hgt = BASIN.cupH * z;
  ctx.save();
  ctx.globalAlpha = 1 - sink * 0.55;
  ctx.translate(X, Y); ctx.rotate(sink * 0.5 * (idx % 2 ? 1 : -1));
  // body
  ctx.fillStyle = PAL.glaze;
  ctx.beginPath(); ctx.moveTo(-hw, -hgt); ctx.quadraticCurveTo(-hw * 0.92, hgt * 0.35, 0, hgt * 0.5); ctx.quadraticCurveTo(hw * 0.92, hgt * 0.35, hw, -hgt); ctx.closePath(); ctx.fill();
  // rim ellipse and the water inside rising with the volume
  const fill = clamp(vol / b.cap, 0, 1);
  ctx.fillStyle = PAL.cream; ctx.beginPath(); ctx.ellipse(0, -hgt, hw, Math.max(2, hw * 0.28), 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(0, -hgt, hw * 0.86, Math.max(1.5, hw * 0.22), 0, 0, 7); ctx.fill();
  if (fill > 0) { ctx.fillStyle = flash > 0 ? PAL.waterL : PAL.water; ctx.beginPath(); ctx.ellipse(0, -hgt + (1 - fill) * hgt * 0.35, hw * 0.82 * (0.5 + fill * 0.5), Math.max(1.2, hw * 0.2 * (0.5 + fill * 0.5)), 0, 0, 7); ctx.fill(); }
  // painted band
  ctx.fillStyle = PAL.clay; ctx.fillRect(-hw * 0.78, -hgt * 0.55, hw * 1.56, Math.max(1.5, hgt * 0.16));
  ctx.fillStyle = 'rgba(246,230,196,0.55)'; ctx.beginPath(); ctx.ellipse(-hw * 0.4, -hgt * 0.1, hw * 0.12, hgt * 0.1, 0.5, 0, 7); ctx.fill();
  // handles
  ctx.strokeStyle = PAL.glaze; ctx.lineWidth = Math.max(1, z * 0.6);
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(sg * hw * 1.0, -hgt * 0.75, hgt * 0.32, 0, 7); ctx.stroke(); }
  ctx.restore();
}

// ---- drops and effects ----------------------------------------------------------------------------------------------------------------
export function drawDrop(ctx, cam, d, p, big = 1) {
  const z = cam.s, x = sx(cam, p.x), y = sy(cam, p.y);
  const sp = Math.hypot(p.vx, p.vy), len = clamp(sp * 0.016, 1, 9) * z;
  const ang = Math.atan2(-p.vy, p.vx);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const r = Math.max(3, d.size * 1.7 * z * big);
  ctx.fillStyle = 'rgba(150,226,250,0.30)'; ctx.beginPath(); ctx.ellipse(-len * 0.55, 0, len * 1.2 + r, r * 0.85, 0, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.water; ctx.beginPath(); ctx.ellipse(-len * 0.2, 0, r + len * 0.5, r, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(8,60,90,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = PAL.waterL; ctx.beginPath(); ctx.ellipse(r * 0.2, -r * 0.34, r * 0.5, r * 0.3, 0, 0, 7); ctx.fill();
  ctx.restore();
}

export function emit(fx, type, x, y, n, frand, o = {}) {
  const { speed = 120, size = 5, life = 0.6, up = 0, cols = null, dir = null, spread = Math.PI * 2 } = o;
  for (let i = 0; i < n; i++) {
    const a = dir === null ? frand() * Math.PI * 2 : dir + (frand() - 0.5) * spread, sp = speed * (0.35 + frand() * 0.75);
    fx.push({ type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up, t: 0, life: life * (0.6 + frand() * 0.7), size: size * (0.6 + frand() * 0.8), col: cols ? cols[Math.floor(frand() * cols.length) % cols.length] : null, rot: frand() * 6 });
  }
}
export function stepFx(fx, dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    if (f.t >= f.life) { fx.splice(i, 1); continue; }
    if (f.type === 'ring' || f.type === 'glint') continue;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.type === 'splash') f.vy += 900 * dt; else if (f.type === 'bubble') { f.vy -= 40 * dt; f.vx *= 0.97; } else f.vy += 260 * dt;
  }
}
export function drawFx(ctx, fx) {
  for (const f of fx) {
    const k = f.t / f.life, a = 1 - k;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    if (f.type === 'ring') { ctx.strokeStyle = f.col || '#fff4c0'; ctx.lineWidth = Math.max(1.5, f.size * 0.25 * (1 - k)); ctx.beginPath(); ctx.ellipse(f.x, f.y, f.size * (0.5 + k * 3), f.size * (0.5 + k * 3) * (f.flat ? 0.3 : 1), 0, 0, 7); ctx.stroke(); }
    else if (f.type === 'splash') { ctx.fillStyle = f.col || PAL.waterL; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (1 - k * 0.5), 0, 7); ctx.fill(); }
    else if (f.type === 'bubble') { ctx.strokeStyle = 'rgba(220,250,255,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (0.6 + k * 0.5), 0, 7); ctx.stroke(); }
    else if (f.type === 'spark') { ctx.translate(f.x, f.y); ctx.rotate(f.rot + f.t * 6); ctx.fillStyle = f.col || '#ffeaa0'; const s = f.size * (1 - k * 0.6); ctx.beginPath(); ctx.moveTo(0, -s * 1.4); ctx.lineTo(s * 0.35, 0); ctx.lineTo(0, s * 1.4); ctx.lineTo(-s * 0.35, 0); ctx.closePath(); ctx.fill(); ctx.rotate(1.57); ctx.beginPath(); ctx.moveTo(0, -s * 1.4); ctx.lineTo(s * 0.35, 0); ctx.lineTo(0, s * 1.4); ctx.lineTo(-s * 0.35, 0); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = f.col || '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (1 - k * 0.4), 0, 7); ctx.fill(); }
    ctx.restore();
  }
}

// ---- wordmark and the title picture ------------------------------------------------------------------------------------------------------
export function wordmark(ctx, text, x, y, size, maxW) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = size;
  ctx.font = `900 ${px}px ${SERIF}`;
  while (ctx.measureText(text).width > maxW && px > 14) { px -= 2; ctx.font = `900 ${px}px ${SERIF}`; }
  try { ctx.letterSpacing = `${Math.round(px * 0.07)}px`; } catch { /* older engines */ }
  ctx.lineJoin = 'round';
  // extruded depth: stacked dark copies going down-right, then a bronze face with a lit top edge and a specular streak
  const d = Math.max(3, px * 0.07);
  ctx.fillStyle = '#2a1a06';
  for (let i = d; i >= 1; i--) ctx.fillText(text, x + i * 0.5, y + i);
  ctx.lineWidth = px * 0.16; ctx.strokeStyle = '#120a04'; ctx.strokeText(text, x, y);
  ctx.fillStyle = grad(ctx, 0, y - px * 0.5, 0, y + px * 0.5, [[0, '#fff6d0'], [0.35, '#f0c458'], [0.55, '#c8902c'], [0.8, '#8a5a14'], [1, '#e0aa44']]);
  ctx.fillText(text, x, y);
  ctx.lineWidth = Math.max(1.2, px * 0.025); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText(text, x, y - 1);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.restore();
}

// A little scene for the title: the reclining player at the left, an arc of drops, a disc stand at the right.
export function drawHero(ctx, w, h, t) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#a8461f'], [1, '#e8914d']]); ctx.fillRect(0, 0, w, h);
  const z = Math.min(w / 350, (h * 0.5) / 104), floorY = h * 0.94, ox = w * 0.02 + 142 * z;
  const cam = { ox, cx: 0, cy: 0, my: floorY, s: z };
  ctx.fillStyle = PAL.glaze; ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = PAL.bronze; ctx.fillRect(0, floorY - 2, w, 3);
  const T = (t % 4.2), cyc = T / 4.2;
  const s = { x: 170, h: 78, r: 14, rm: 19 };
  const hit = cyc > 0.3 && cyc < 0.62, rock = hit ? Math.sin((cyc - 0.3) * 60) * 0.12 * Math.exp(-(cyc - 0.3) * 9) : 0;
  drawStand(ctx, cam, s, { x: s.x, y: s.h, rot: rock, th: 0 }, t, {});
  // the flick: drops leave at cyc 0.18, arrive at the disc ~0.3
  const v = 505, a = 47 * Math.PI / 180, vx = Math.cos(a) * v, vy = Math.sin(a) * v;
  const snap = cyc > 0.14 && cyc < 0.3 ? Math.min(1, (cyc - 0.14) / 0.04) * (1 - Math.max(0, (cyc - 0.2) / 0.1)) : 0;
  for (let k = 0; k < 9; k++) {
    const tt = (cyc - 0.18) * 4.2 - k * 0.02;
    if (tt <= 0) continue;
    const px = vx * tt, py = HAND.y + vy * tt - 0.5 * G * tt * tt;
    if (px < s.x - 4 && py > 0) drawDrop(ctx, cam, { size: 1 }, { x: px, y: py, vx, vy: vy - G * tt }, 1);
  }
  drawPlayer(ctx, cam, { snap, aimA: 47, side: 0, t, charge: cyc < 0.16 ? Math.min(1, cyc / 0.1) : 0 });
  ctx.restore();
}

// ---- diagrams for the reader ----------------------------------------------------------------------------------------------------------
export function drawDiagram(kind, ctx, w, h) {
  ctx.save();
  roundPath(ctx, 0, 0, w, h, 18); ctx.clip();
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#b9532a'], [1, '#e9964f']]); ctx.fillRect(0, 0, w, h);
  const floorY = h * 0.88;
  ctx.fillStyle = PAL.glaze; ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = PAL.bronze; ctx.fillRect(0, floorY - 2, w, 3);
  const z = Math.min(w / 285, h / 150), ox = w * 0.2;
  const cam = { ox, cx: 0, cy: 0, my: floorY, s: z };
  const T = 0.65;
  const stand = (x, hh, r = 12, rm = 17, rot = 0, extra = {}) => drawStand(ctx, cam, { x, h: hh, r, rm }, { x, y: hh, rot, th: 0 }, 0, extra);
  const arc = (a, v, col = 'rgba(255,255,255,0.8)', xMax = 400) => {
    const g = guidePath(a, v, xMax, 1 / 30);
    ctx.save(); ctx.setLineDash([3, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.beginPath();
    g.forEach((p, i) => { const X = sx(cam, p[0]), Y = sy(cam, p[1]); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }); ctx.stroke(); ctx.restore();
  };
  const dropsAt = (a, v, n, t0 = 0.3, x1 = 150) => {
    const th = (a * Math.PI) / 180;
    for (let k = 0; k < n; k++) {
      const t = t0 + k * 0.035, x = Math.cos(th) * v * t, y = HAND.y + Math.sin(th) * v * t - 0.5 * G * t * t;
      if (x <= x1) drawDrop(ctx, cam, { size: 1 }, { x, y, vx: Math.cos(th) * v, vy: Math.sin(th) * v - G * t }, 1);
    }
  };
  const tidy = () => { ctx.restore(); };
  if (kind === 'swipe') {
    drawPlayer(ctx, cam, { aimA: 50, charge: 0.6 });
    arc(50, 560, '#ffffff');
    stand(150, 78, 14, 19);
    // the finger
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = PAL.glaze; ctx.lineWidth = 3;
    const fx = w * 0.55, fy = h * 0.7;
    ctx.beginPath(); ctx.moveTo(fx - 40, fy + 28); ctx.lineTo(fx + 36, fy - 26); ctx.stroke();
    ctx.beginPath(); ctx.arc(fx + 36, fy - 26, 9, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(fx + 20, fy - 30); ctx.lineTo(fx + 40, fy - 34); ctx.lineTo(fx + 34, fy - 12); ctx.stroke();
    return tidy();
  }
  if (kind === 'snap') {
    // tight vs sprayed stream
    drawPlayer(ctx, cam, { aimA: 50 });
    dropsAt(50, 560, 10, 0.34);
    for (let k = 0; k < 10; k++) { const a = 50 + Math.sin(k * 2.7) * 7, v = 560 * (1 + Math.cos(k * 3.1) * 0.06), th = (a * Math.PI) / 180, t = 0.62 + k * 0.01; const x = Math.cos(th) * v * t, y = HAND.y + Math.sin(th) * v * t - 0.5 * G * t * t; if (y > 0) drawDrop(ctx, cam, { size: 0.8 }, { x: x + 20, y: y + 6 * Math.sin(k), vx: 300, vy: -250 }, 1); }
    ctx.font = `800 ${Math.round(h * 0.12)}px ${SERIF}`; ctx.fillStyle = PAL.cream; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('quick snap = tight', w * 0.46, h * 0.08); ctx.fillText('lazy slide = spray', w * 0.46, h * 0.22);
    return tidy();
  }
  if (kind === 'disc') {
    stand(120, 70, 14, 20, 0.2);
    drawPlayer(ctx, cam, { aimA: 48 });
    arc(48, 520, 'rgba(255,255,255,0.8)', 120);
    ctx.font = `800 ${Math.round(h * 0.1)}px ${SERIF}`; ctx.fillStyle = PAL.cream; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`rock it off: clang ${POINTS.clang}`, w * 0.62, h * 0.12);
    return tidy();
  }
  if (kind === 'basin') {
    const sc = { basin: { x: 150, bowls: [{ off: -28, w: 15, cap: 3, amp: 0, per: 5, ph: 0 }, { off: 0, w: 15, cap: 3, amp: 0, per: 5, ph: 0 }, { off: 28, w: 15, cap: 3, amp: 0, per: 5, ph: 0 }] } };
    drawBasin(ctx, cam, sc, { vol: [1, 2, 0], sunk: [false, false, false] }, 0, {});
    drawPlayer(ctx, cam, { aimA: 38 });
    arc(38, 440, 'rgba(255,255,255,0.8)', 200);
    return tidy();
  }
  if (kind === 'score') {
    stand(70, 66, 13, 18);
    stand(180, 66, 13, 18, 0.3);
    ctx.font = `900 ${Math.round(h * 0.16)}px ${SERIF}`; ctx.fillStyle = PAL.cream; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${POINTS.clang}`, sx(cam, 70), h * 0.2); ctx.fillText(`${POINTS.off}`, sx(cam, 180), h * 0.2);
    return tidy();
  }
  // default: the hero
  drawHero(ctx, w, h, 0);
  tidy();
}
