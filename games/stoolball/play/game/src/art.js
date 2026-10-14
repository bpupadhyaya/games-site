// Stoolball art: the village green, the posts and boards, the people, the paddle and the ball. Drawing only; every function
// takes a camera from layout.js and screen-space sizes. No randomness: variety comes from the player's id.
import { proj } from './layout.js';
import { PITCH, FIELD_C, FIELD_R, TAU } from './sim.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));

export const PAL = {
  grassA: '#4f9a3c', grassB: '#46912f', grassFar: '#2f6a2a', strip: '#a9b866', stripEdge: '#8a9a52', rope: '#fbf6e8',
  post: '#f6f1e2', postShade: '#c9bfa4', board: '#e9c27a', boardEdge: '#7a3b1c', hedge: '#245226', hedge2: '#1b4220',
  sky: '#cfe8f2', thatch: '#b9954f', thatchDark: '#8a6c32', wall: '#f3ead2', wallShade: '#d4c6a0',
  ball: '#fbf7ea', ballSeam: '#c9533a', paddle: '#e7bf6b', paddleEdge: '#6b3f16',
  teamBat: ['#f7f1dc', '#a8331f'], teamField: ['#2b5d9a', '#e8b43c'],
};
const SKIN = ['#f2c9a0', '#e0a878', '#b9794a', '#8a5330', '#f6d8b8'];
const HAIR = ['#2a1a10', '#5a3a1c', '#c9a14a', '#8a8a8a', '#a8331f', '#151515'];

// ---- ground ------------------------------------------------------------------------------------------------------
function pathCircle(ctx, cam, r, n = 72, cx = FIELD_C.x, cy = FIELD_C.y) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, [sx, sy] = proj(cam, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}
function quad(ctx, cam, x0, y0, x1, y1) {
  const a = proj(cam, x0, y0), b = proj(cam, x1, y0), c = proj(cam, x1, y1), d = proj(cam, x0, y1);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
}

// The whole ground for a camera: surround, mown stripes, the rope with bunting, the pitch strip, creases.
export function drawGround(ctx, cam, t = 0, opt = {}) {
  const st = cam.stage;
  ctx.save();
  ctx.beginPath(); ctx.rect(st.x, st.y, st.w, st.h); ctx.clip();
  // surround: far hedge and a darker lawn
  const g = ctx.createLinearGradient(0, st.y, 0, st.y + st.h);
  g.addColorStop(0, PAL.hedge2); g.addColorStop(1, PAL.grassFar);
  ctx.fillStyle = g; ctx.fillRect(st.x, st.y, st.w, st.h);
  // the field
  ctx.save();
  pathCircle(ctx, cam, FIELD_R + 0.6);
  ctx.fillStyle = PAL.grassFar; ctx.fill();
  pathCircle(ctx, cam, FIELD_R);
  ctx.clip();
  const gg = ctx.createLinearGradient(0, st.y, 0, st.y + st.h);
  gg.addColorStop(0, '#5aa844'); gg.addColorStop(1, '#4a9332');
  ctx.fillStyle = gg; ctx.fillRect(st.x, st.y, st.w, st.h);
  // mown stripes across the pitch direction, 2.4 m apart
  const y0 = FIELD_C.y - FIELD_R - 1, y1 = FIELD_C.y + FIELD_R + 1, bw = 2.4;
  ctx.fillStyle = 'rgba(14,60,16,0.16)';
  for (let k = 0, y = Math.floor(y0 / bw) * bw; y < y1; y += bw, k++) {
    if (k % 2) continue;
    quad(ctx, cam, -FIELD_R - 1, y, FIELD_R + 1, y + bw); ctx.fill();
  }
  // soft shade towards the rope
  const rg = ctx.createRadialGradient(...proj(cam, FIELD_C.x, FIELD_C.y), 0, ...proj(cam, FIELD_C.x, FIELD_C.y), FIELD_R * cam.s);
  rg.addColorStop(0.7, 'rgba(0,30,0,0)'); rg.addColorStop(1, 'rgba(0,30,0,0.22)');
  ctx.fillStyle = rg; ctx.fillRect(st.x, st.y, st.w, st.h);
  // the pitch strip
  quad(ctx, cam, -1.55, -1.4, 1.55, PITCH + 1.4);
  const sg = ctx.createLinearGradient(...proj(cam, -1.5, 0), ...proj(cam, 1.5, 0));
  sg.addColorStop(0, PAL.stripEdge); sg.addColorStop(0.15, PAL.strip); sg.addColorStop(0.85, PAL.strip); sg.addColorStop(1, PAL.stripEdge);
  ctx.fillStyle = sg; ctx.fill();
  // creases
  ctx.strokeStyle = 'rgba(255,255,240,0.85)'; ctx.lineWidth = Math.max(1.5, cam.s * 0.07); ctx.lineCap = 'round';
  for (const y of [0.9 + 0.55, PITCH - 0.9 - 0.55]) {
    const a = proj(cam, -1.1, y), b = proj(cam, 1.1, y);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.restore();
  // the rope and its bunting
  ctx.save();
  pathCircle(ctx, cam, FIELD_R);
  ctx.strokeStyle = PAL.rope; ctx.lineWidth = Math.max(2, cam.s * 0.16); ctx.stroke();
  if (opt.bunting !== false) {
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, sway = Math.sin(t * 1.6 + i * 0.9) * 0.18;
      const [sx, sy] = proj(cam, FIELD_C.x + Math.cos(a) * (FIELD_R + 0.15), FIELD_C.y + Math.sin(a) * (FIELD_R + 0.15));
      const sz = Math.max(3, cam.s * 0.42);
      ctx.fillStyle = ['#d4553a', '#f2c744', '#4aa2d9', '#f8f4e6'][i % 4];
      ctx.beginPath(); ctx.moveTo(sx - sz * 0.5, sy); ctx.lineTo(sx + sz * 0.5, sy); ctx.lineTo(sx + sway * sz, sy + sz * 0.9); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  // beyond the rope: hedge blobs and the pavilion when it is in view
  if (opt.scenery !== false) drawScenery(ctx, cam);
  ctx.restore();
}

function drawScenery(ctx, cam) {
  // hedge ring of blobs
  const n = 56;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = FIELD_R + 2.4 + ((i * 7) % 5) * 0.35;
    const [sx, sy] = proj(cam, FIELD_C.x + Math.cos(a) * rr, FIELD_C.y + Math.sin(a) * rr, 0);
    const r = Math.max(5, cam.s * (1.5 + ((i * 13) % 4) * 0.25));
    ctx.fillStyle = i % 3 ? PAL.hedge : '#2d6a2c';
    ctx.beginPath(); ctx.arc(sx, sy - r * 0.35, r, 0, TAU); ctx.fill();
  }
  // the pavilion beyond the far board
  const [px, py] = proj(cam, 0, FIELD_C.y + FIELD_R + 3.4, 0);
  const w = Math.max(40, cam.s * 9), h = Math.max(22, cam.s * 3.4);
  ctx.fillStyle = PAL.wallShade; ctx.fillRect(px - w / 2, py - h, w, h);
  ctx.fillStyle = PAL.wall; ctx.fillRect(px - w / 2 + 2, py - h + 2, w - 4, h - 4);
  ctx.fillStyle = PAL.thatchDark;
  ctx.beginPath(); ctx.moveTo(px - w * 0.58, py - h + 2); ctx.lineTo(px, py - h - h * 0.95); ctx.lineTo(px + w * 0.58, py - h + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.thatch;
  ctx.beginPath(); ctx.moveTo(px - w * 0.5, py - h + 2); ctx.lineTo(px, py - h - h * 0.82); ctx.lineTo(px + w * 0.5, py - h + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3a1c'; ctx.fillRect(px - w * 0.07, py - h * 0.72, w * 0.14, h * 0.72);
  ctx.fillStyle = '#7fb0c9';
  for (const k of [-0.3, 0.3]) ctx.fillRect(px + w * k - w * 0.06, py - h * 0.72, w * 0.12, h * 0.34);
}

// ---- posts and boards ----------------------------------------------------------------------------------------------------
// y = the board's y; fall = 0..1 how far the board has been knocked off (after a bowl-out)
export function drawBoard(ctx, cam, y, fall = 0, tint = null) {
  const [bx, by] = proj(cam, 0, y, 0);
  const s = cam.s, postH = 1.12 * s, bw = 0.34 * s, bh = 0.32 * s;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,30,0,0.28)'; ctx.beginPath(); ctx.ellipse(bx, by + 2, bw * 0.55, bw * 0.2, 0, 0, TAU); ctx.fill();
  // post
  const pw = Math.max(3, 0.1 * s);
  ctx.fillStyle = PAL.post; ctx.fillRect(bx - pw / 2, by - postH, pw, postH);
  ctx.fillStyle = PAL.postShade; ctx.fillRect(bx + pw * 0.1, by - postH, pw * 0.4, postH);
  // board (knocked away when fall > 0)
  const ox = fall * bw * 2.6, oy = -fall * bh * 0.6 + fall * fall * bh * 2.2, rot = fall * 1.6;
  ctx.translate(bx + ox, by - postH - bh * 0.5 + oy); ctx.rotate(rot);
  ctx.fillStyle = PAL.boardEdge; ctx.fillRect(-bw / 2 - 2, -bh / 2 - 2, bw + 4, bh + 4);
  const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
  g.addColorStop(0, tint || '#f2d79a'); g.addColorStop(1, PAL.board);
  ctx.fillStyle = g; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = 'rgba(122,59,28,0.55)'; ctx.fillRect(-bw / 2 + 3, -bh / 2 + 3, bw - 6, 2);
  ctx.restore();
}

// ---- people ----------------------------------------------------------------------------------------------------------
// (x, y) = the feet in screen px, h = height in px. o = { id, team: 'bat'|'field', ph (0..1 gait), run (0..1), pose, arm (0..1), face (-1..1), paddle, ball }
// The flat game's figures are renders of the same 3D cast (web/art/figures.png, baked by dev/sprites.mjs); the vector figure below
// is only the last resort while the atlas loads.
let FIG = null;
export function setFigures(img, meta) { FIG = img && meta ? { img, ...meta } : null; }
function drawSprite(ctx, x, y, h, o) {
  const F = FIG, id = o.id | 0, bat = o.team === 'bat';
  const who = (bat ? 'bat' : 'field') + (id % 2 ? 'B' : 'A');
  const a = clampv(o.arm ?? 0, 0, 1), run = clampv(o.run ?? 0, 0, 1);
  let key = 'ready';
  switch (o.pose) {
    case 'swing': key = bat ? 'swing' + (a < 0.34 ? 0 : a < 0.7 ? 1 : 2) : 'ready'; break;
    case 'bowl': key = 'toss' + (a < 0.34 ? 0 : a < 0.7 ? 1 : 2); break;
    case 'throw': key = 'throw' + (a < 0.34 ? 0 : a < 0.7 ? 1 : 2); break;
    case 'catch': key = 'catch'; break;
    case 'cheer': key = 'cheer'; break;
    case 'run': key = 'run' + (Math.floor((((o.ph ?? 0) % 1) + 1) % 1 * 6) % 6); break;
    default: key = run > 0.3 ? 'run' + (Math.floor((((o.ph ?? 0) % 1) + 1) % 1 * 6) % 6) : 'ready';
  }
  let c = F.cells[`${who}.${key}`] || F.cells[`${who}.ready`];
  if (!c) return false;
  if (bat && key === 'ready' && !o.paddle) c = F.cells[`${who}.cheer`] || c;
  const k = h / F.person, w = F.cw * k, hh = F.ch * k;
  ctx.save();
  ctx.fillStyle = 'rgba(0,30,0,0.28)';
  ctx.beginPath(); ctx.ellipse(x, y + h * 0.015, h * 0.2, h * 0.07, 0, 0, TAU); ctx.fill();
  if (o.face < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  ctx.drawImage(F.img, c[0] * F.cw, c[1] * F.ch, F.cw, F.ch, x - w / 2, y - F.foot * k, w, hh);
  ctx.restore();
  if (o.ball) { ctx.fillStyle = PAL.ball; ctx.beginPath(); ctx.arc(x + h * 0.14 * (o.face < 0 ? -1 : 1), y - h * 0.5, Math.max(2.5, h * 0.045), 0, TAU); ctx.fill(); }
  return true;
}

export function drawPerson(ctx, x, y, h, o = {}) {
  if (FIG && drawSprite(ctx, x, y, h, o)) return;
  const id = o.id | 0, team = o.team === 'bat' ? PAL.teamBat : PAL.teamField;
  const skin = SKIN[(id * 3 + 1) % SKIN.length], hair = HAIR[(id * 5 + 2) % HAIR.length];
  const shirt = team[0], trim = team[1], lower = o.team === 'bat' ? '#f1ecd8' : '#1d3a63';
  const run = clampv(o.run ?? 0, 0, 1), ph = (o.ph ?? 0) * TAU;
  const lw = h * 0.085, legL = h * 0.46;
  ctx.save();
  // ground shadow
  ctx.fillStyle = 'rgba(0,30,0,0.32)';
  ctx.beginPath(); ctx.ellipse(x, y + h * 0.015, h * 0.2, h * 0.07, 0, 0, TAU); ctx.fill();
  const bob = Math.abs(Math.sin(ph)) * h * 0.035 * run;
  const hipY = y - legL + h * 0.02 - bob;
  // legs
  const stride = h * 0.2 * run;
  for (const side of [-1, 1]) {
    const sw = Math.sin(ph + (side > 0 ? Math.PI : 0)) * stride;
    const lift = Math.max(0, Math.cos(ph + (side > 0 ? Math.PI : 0))) * h * 0.1 * run;
    ctx.strokeStyle = lower; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + side * h * 0.05, hipY); ctx.lineTo(x + side * h * 0.07 + sw * 0.3, y - lift - h * 0.04); ctx.stroke();
    ctx.strokeStyle = '#f3e9d2'; ctx.lineWidth = lw * 0.82;
    ctx.beginPath(); ctx.moveTo(x + side * h * 0.07 + sw * 0.3, y - lift - h * 0.16); ctx.lineTo(x + side * h * 0.07 + sw * 0.5, y - lift); ctx.stroke();
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(x + side * h * 0.075 + sw * 0.5, y - lift + h * 0.005, h * 0.06, h * 0.03, 0, 0, TAU); ctx.fill();
  }
  // torso
  const tw = h * 0.3, th = h * 0.36, ty = hipY - th;
  const lean = (o.pose === 'swing' ? 0.18 : o.pose === 'bowl' ? 0.1 : run * 0.1) * h * (o.face >= 0 ? 1 : -1);
  const tg = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
  tg.addColorStop(0, shirt); tg.addColorStop(1, shade(shirt, 0.82));
  ctx.fillStyle = tg;
  rr(ctx, x - tw / 2 + lean * 0.4, ty, tw, th, tw * 0.3); ctx.fill();
  ctx.fillStyle = trim; ctx.fillRect(x - tw / 2 + lean * 0.4 + 1, ty + th * 0.62, tw - 2, Math.max(2, h * 0.035));
  // head
  const hr = h * 0.085, hx = x + lean, hy = ty - hr * 0.7;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.2, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  if (id % 3 === 0) { ctx.beginPath(); ctx.arc(hx - hr * 0.7, hy + hr * 0.6, hr * 0.5, 0, TAU); ctx.fill(); }
  if (o.team !== 'bat' && id % 2 === 1) { ctx.fillStyle = trim; ctx.fillRect(hx - hr, hy - hr * 0.55, hr * 2, hr * 0.38); }
  // arms
  const armLen = h * 0.3, shY = ty + th * 0.15, sx0 = x + lean * 0.5;
  const arm = (side, ang, len) => {
    ctx.strokeStyle = shirt; ctx.lineWidth = lw * 0.9; ctx.lineCap = 'round';
    const ex = sx0 + side * tw * 0.42 + Math.sin(ang) * len, ey = shY + Math.cos(ang) * len;
    ctx.beginPath(); ctx.moveTo(sx0 + side * tw * 0.42, shY); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(ex, ey, lw * 0.5, 0, TAU); ctx.fill();
    return [ex, ey];
  };
  const a = clampv(o.arm ?? 0, 0, 1);
  let handR;
  if (o.pose === 'swing') {
    // the paddle swings across: arm angle sweeps from back to front
    const ang = lerp(-2.3, 1.4, a);
    handR = arm(1, ang, armLen); arm(-1, ang * 0.9, armLen);
  } else if (o.pose === 'bowl') {
    const ang = lerp(-0.5, 1.45, a);       // underarm: from behind the hip, low, up to the front
    handR = arm(1, ang, armLen); arm(-1, -0.45, armLen * 0.85);
  } else if (o.pose === 'throw') {
    const ang = lerp(-2.8, 1.2, a);
    handR = arm(1, ang, armLen); arm(-1, 0.5, armLen * 0.8);
  } else if (o.pose === 'cheer') {
    handR = arm(1, 2.9 + Math.sin(ph) * 0.2, armLen); arm(-1, -2.9 - Math.sin(ph) * 0.2, armLen);
  } else if (o.pose === 'catch') {
    handR = arm(1, 2.5, armLen); arm(-1, -2.5, armLen);
  } else if (o.pose === 'ready') {
    handR = arm(1, 0.42, armLen * 0.9); arm(-1, -0.42, armLen * 0.9);
  } else {
    const sw = Math.sin(ph) * 0.9 * run;
    handR = arm(1, 0.25 - sw, armLen); arm(-1, -0.25 + sw, armLen);
  }
  // what the right hand holds
  if (o.paddle) drawPaddle(ctx, handR[0], handR[1], h * 0.36, o.paddleAng ?? (o.pose === 'swing' ? lerp(-1.2, 1.3, a) : 0.15));
  if (o.ball) { ctx.fillStyle = PAL.ball; ctx.beginPath(); ctx.arc(handR[0], handR[1] - h * 0.02, Math.max(2.5, h * 0.045), 0, TAU); ctx.fill(); }
  ctx.restore();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}
// the willow paddle: a taped handle then a rounded-square blade; ang 0 = held up
export function drawPaddle(ctx, x, y, len, ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = '#24262c'; ctx.lineWidth = Math.max(2, len * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, len * 0.15); ctx.lineTo(0, -len * 0.4); ctx.stroke();
  const w = len * 0.5, h = len * 0.52, y0 = -len * 0.38 - h;
  rr(ctx, -w / 2 - 2, y0 - 2, w + 4, h + 4, w * 0.3); ctx.fillStyle = PAL.paddleEdge; ctx.fill();
  const g = ctx.createLinearGradient(-w / 2, y0, w / 2, y0 + h);
  g.addColorStop(0, '#f6d890'); g.addColorStop(1, PAL.paddle);
  rr(ctx, -w / 2, y0, w, h, w * 0.28); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}

// ---- ball ------------------------------------------------------------------------------------------------------------
// ground = [sx, sy] of the point below the ball, air = [sx, sy] of the ball; r in px
export function drawBall(ctx, ground, air, r, spin = 0, ring = true, ghost = false) {
  ctx.save();
  if (ghost) {
    // the ball itself is a real-size 3D sphere behind this canvas: here only the aid ring and the height line
    const lift0 = Math.max(0, ground[1] - air[1]);
    if (lift0 > 4) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ground[0], ground[1]); ctx.lineTo(air[0], air[1]); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(2, r * 0.2); ctx.beginPath(); ctx.arc(air[0], air[1], r * 1.5, 0, TAU); ctx.stroke();
    ctx.restore(); return;
  }
  ctx.fillStyle = 'rgba(0,30,0,0.35)';
  const lift = Math.max(0, ground[1] - air[1]);
  const sr = r * (1 - Math.min(0.5, lift / 400));
  ctx.beginPath(); ctx.ellipse(ground[0], ground[1], sr * 1.1, sr * 0.5, 0, 0, TAU); ctx.fill();
  if (ring && lift > 4) { ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ground[0], ground[1]); ctx.lineTo(air[0], air[1]); ctx.stroke(); }
  if (ring) { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.beginPath(); ctx.arc(air[0], air[1], r * 1.55, 0, TAU); ctx.stroke(); }
  const g = ctx.createRadialGradient(air[0] - r * 0.35, air[1] - r * 0.35, r * 0.1, air[0], air[1], r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9d1b8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(air[0], air[1], r, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.ballSeam; ctx.lineWidth = Math.max(1.2, r * 0.18);
  ctx.beginPath(); ctx.arc(air[0], air[1], r * 0.72, spin, spin + 2.2); ctx.stroke();
  ctx.restore();
}
