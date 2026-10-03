// The view: one fixed pinhole camera behind the throwing line looking at the far board across a backyard lawn (true perspective: a bag in
// the air gets smaller smoothly as it flies away, no depth warp). Everything is vector drawing every frame (no pre-baked images), so the first
// frame is instant. World units are metres: x across, y up, z away from the thrower (z = 0 is the throwing line).
import { BOARD_W, BOARD_L, BOARD_Z0, H_FRONT, H_BACK, SIN_A, COS_A, HOLE_R, HOLE_V, BAG_HALF, BAG_T, boardToWorld, surfaceH } from './phys.js';

export const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// THE camera. It never moves, zooms, tilts or shakes: the lawn, fence and board keep the same screen position in every frame.
// Tuning: F = focal length in pixels, Hc = eye height (m), D0 = distance behind the throwing line (m), YH = screen y of the horizon.
export const CAM = { F: 3400, Hc: 2.8, D0: 6.0, YH: 60, x: 0 };
export const fixedCam = () => ({ ...CAM });
export const scaleAt = (cam, z) => cam.F / Math.max(0.35, z + cam.D0);
export function proj(cam, x, y, z) {
  const d = Math.max(0.3, z + cam.D0), s = cam.F / d;
  return { x: 360 + (x - cam.x) * s, y: cam.YH + (cam.Hc - y) * s, s, d };
}
// The inverse for the ground and the board: which world point is under a screen point (used by the tests and the aim helpers).
export function groundAt(cam, sx, sy) { const s = (sy - cam.YH) / cam.Hc; const d = cam.F / s; return { x: ((sx - 360) * d) / cam.F + cam.x, z: d - cam.D0 }; }

function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
const P3 = (cam, a) => proj(cam, a[0], a[1], a[2]);
const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(clamp(c[0] * k, 0, 255))},${Math.round(clamp(c[1] * k, 0, 255))},${Math.round(clamp(c[2] * k, 0, 255))},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------------------------------------------
// The backyard: sky and trees, a wooden fence with string lights, a mown lawn with stripes, flower beds, long evening light.
const FENCE_Z = 15.4, FENCE_H = 1.8, TREE_Z = 22;
export function drawBackdrop(ctx, cam, t) {
  // sky: warm evening
  let g = ctx.createLinearGradient(0, 0, 0, cam.YH + 160);
  g.addColorStop(0, '#5f8fc4'); g.addColorStop(0.55, '#f0c88c'); g.addColorStop(1, '#f6dcae');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 720, 1280);
  // soft clouds
  ctx.save(); ctx.globalAlpha = 0.5;
  for (let i = 0; i < 4; i++) { const cx = 90 + i * 190 + hash(i) * 40, cy = 62 + hash(i + 9) * 34; const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 90); cg.addColorStop(0, 'rgba(255,248,232,0.9)'); cg.addColorStop(1, 'rgba(255,248,232,0)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx, cy, 120, 26, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  // rows of trees behind the fence (layered blobs, deterministic)
  const hz = proj(cam, 0, 0, TREE_Z), top = proj(cam, 0, 7, TREE_Z);
  for (let layer = 0; layer < 2; layer++) {
    const base = hz.y - layer * 6, col = layer === 0 ? [44, 92, 54] : [70, 120, 70];
    for (let i = -1; i < 12; i++) {
      const cx = i * 70 + hash(i + layer * 20) * 40, r = 70 + hash(i * 3 + layer) * 60, cy = base - r * (0.55 + hash(i + 40) * 0.3) - layer * 24;
      const gg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      gg.addColorStop(0, rgb(mixc(col, [150, 190, 90], 0.45))); gg.addColorStop(1, rgb(col, 0.8));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = rgb(col, 0.8); ctx.fillRect(0, base - 8, 720, hz.y - base + 12);
  }
  void top;
  // fence: a wall of upright boards seen in perspective, a top rail, posts
  const fb = proj(cam, 0, 0, FENCE_Z).y, ft = proj(cam, 0, FENCE_H, FENCE_Z).y, fs = proj(cam, 0, 0, FENCE_Z).s;
  g = ctx.createLinearGradient(0, ft, 0, fb); g.addColorStop(0, '#9a6e44'); g.addColorStop(1, '#6e4a2a');
  ctx.fillStyle = g; ctx.fillRect(0, ft, 720, fb - ft);
  const bw = 0.14 * fs;
  for (let x = 0; x < 720 + bw; x += bw) {
    const k = hash(Math.floor(x / bw) + 3);
    ctx.fillStyle = `rgba(${k > 0.5 ? '255,226,170' : '40,22,8'},${0.05 + k * 0.1})`; ctx.fillRect(x, ft, bw - 1.5, fb - ft);
    ctx.fillStyle = 'rgba(30,16,6,0.55)'; ctx.fillRect(x + bw - 1.5, ft, 1.5, fb - ft);
  }
  ctx.fillStyle = 'rgba(255,230,170,0.12)'; ctx.fillRect(0, ft, 720, 6);
  // rails
  for (const yy of [0.35, 1.35]) { const y0 = proj(cam, 0, yy + 0.09, FENCE_Z).y, y1 = proj(cam, 0, yy, FENCE_Z).y; ctx.fillStyle = '#5a3a20'; ctx.fillRect(0, y0, 720, y1 - y0); ctx.fillStyle = 'rgba(255,220,160,0.18)'; ctx.fillRect(0, y0, 720, 2); }
  // posts with caps
  for (const px of [-1.9, 0.0, 1.9, 3.8, -3.8]) {
    const a = proj(cam, px - 0.07, FENCE_H + 0.14, FENCE_Z - 0.2), b = proj(cam, px + 0.07, 0, FENCE_Z - 0.2);
    ctx.fillStyle = '#7a5230'; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.fillStyle = 'rgba(255,230,170,0.22)'; ctx.fillRect(a.x, a.y, (b.x - a.x) * 0.3, b.y - a.y);
    ctx.fillStyle = '#4a2e18'; ctx.fillRect(a.x - 3, a.y - 5, b.x - a.x + 6, 7);
  }
  // string lights: warm bulbs hanging between the posts
  const posts = [-3.8, -1.9, 0.0, 1.9, 3.8];
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = proj(cam, posts[i], FENCE_H + 0.1, FENCE_Z - 0.4), b = proj(cam, posts[i + 1], FENCE_H + 0.1, FENCE_Z - 0.4);
    const sag = 0.28 * a.s;
    ctx.strokeStyle = 'rgba(30,20,10,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag * 2, b.x, b.y); ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const u = k / 6, x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u) + sag * 2 * 2 * u * (1 - u);
      const gl = ctx.createRadialGradient(x, y + 8, 1, x, y + 8, 26); gl.addColorStop(0, 'rgba(255,226,150,0.85)'); gl.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 28, y - 18, 56, 56);
      ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(x, y + 8, 3.6, 0, TAU); ctx.fill();
    }
  }
}

export function drawLawn(ctx, cam, t) {
  const zf = FENCE_Z - 0.0, yTop = proj(cam, 0, 0, zf).y, yBot = 1280;
  let g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, '#4f8a3a'); g.addColorStop(0.45, '#5fa044'); g.addColorStop(1, '#79b653');
  ctx.fillStyle = g; ctx.fillRect(0, yTop, 720, yBot - yTop);
  // mown stripes across the lawn, every 1.2 m (true perspective: they narrow with distance)
  for (let z = -4, i = 0; z < zf; z += 1.2, i++) {
    if (i % 2) continue;
    const y0 = proj(cam, 0, 0, z).y, y1 = proj(cam, 0, 0, Math.min(z + 1.2, zf)).y;
    if (y0 < yTop - 2 || y1 > 1280) continue;
    ctx.fillStyle = 'rgba(255,255,200,0.07)'; ctx.fillRect(0, Math.min(y0, y1), 720, Math.abs(y0 - y1) + 0.5);
  }
  // grass texture: short blades scattered deterministically, sized by depth
  ctx.strokeStyle = 'rgba(30,70,20,0.18)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 160; i++) {
    const z = 1 + hash(i) * 14, x = (hash(i + 77) - 0.5) * 9;
    const p = proj(cam, x, 0, z); if (p.y > 1000 || p.x < -5 || p.x > 725) continue;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2, p.y - 0.05 * p.s * 0.4); ctx.stroke();
  }
  // flower bed along the fence
  for (let i = 0; i < 46; i++) {
    const x = -4.6 + hash(i + 5) * 9.2, z = FENCE_Z - 0.5 - hash(i + 11) * 0.5;
    const p = proj(cam, x, 0.1, z), r = 0.1 * p.s * (0.7 + hash(i) * 0.8);
    const col = [[226, 92, 112], [250, 214, 90], [240, 240, 240], [150, 110, 220]][i % 4];
    ctx.fillStyle = 'rgba(40,96,40,0.95)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.4, r * 1.3, r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(col); ctx.beginPath(); ctx.arc(p.x, p.y - r * 0.2, r * 0.55, 0, TAU); ctx.fill();
  }
  // evening light: a warm pool around the board and a soft dark rim at the screen edges
  const bc = proj(cam, 0, 0.1, BOARD_Z0 + 0.6);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const rg = ctx.createRadialGradient(bc.x, bc.y, 10, bc.x, bc.y, 340); rg.addColorStop(0, 'rgba(255,220,150,0.28)'); rg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, bc.y - 340, 720, 680); ctx.restore();
}


// A box seen in true perspective: lit top, front and the side that faces the camera. (x, z) is the centre of the base.
function drawBox(ctx, cam, x, z, w, h, d, col, o = {}) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y0 = o.y0 ?? 0, y1 = y0 + h;
  const P = (a, b, c) => proj(cam, a, b, c);
  const face = (pts, k) => { poly(ctx, pts); ctx.fillStyle = rgb(col, k); ctx.fill(); };
  // lawn shadow, thrown back and to the right
  poly(ctx, [P(x0, 0, z0), P(x1, 0, z0), P(x1 + h * 0.9, 0, z1 + h * 0.5), P(x0 + h * 0.9, 0, z1 + h * 0.5)]); ctx.fillStyle = 'rgba(20,40,10,0.28)'; ctx.fill();
  const side = x > 0 ? [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)] : [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)];
  face(side, x > 0 ? 0.62 : 0.5);
  face([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], 0.82);
  face([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], 1.08);
  ctx.strokeStyle = 'rgba(20,10,0,0.45)'; ctx.lineWidth = 1.5; poly(ctx, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)]); ctx.stroke();
}
export function drawProps(ctx, cam) {
  // a cooler with a white lid and a folding stool beside the board, both well out of the way of every throw
  const cz = 9.4;
  drawBox(ctx, cam, -1.1, cz, 0.55, 0.3, 0.34, [48, 120, 190]);
  drawBox(ctx, cam, -1.1, cz, 0.59, 0.05, 0.38, [240, 240, 232], { y0: 0.3 });
  const l = proj(cam, -1.1, 0.42, cz - 0.1), gl = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, 0.45 * l.s);
  gl.addColorStop(0, 'rgba(255,220,140,0.5)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = gl; ctx.fillRect(l.x - 0.45 * l.s, l.y - 0.45 * l.s, 0.9 * l.s, 0.9 * l.s);
  // a small folding stool
  const stool = [150, 110, 70];
  drawBox(ctx, cam, 1.12, 9.3, 0.36, 0.04, 0.3, stool, { y0: 0.34 });
  for (const dx of [-0.15, 0.15]) drawBox(ctx, cam, 1.12 + dx, 9.3, 0.035, 0.34, 0.035, [60, 52, 46]);
}

// ---------------------------------------------------------------------------------------------------------------
// The board
const BOARD_PAINT = { wood: [236, 214, 170], woodDark: [196, 160, 108], edge: [120, 78, 40], trimA: [182, 46, 42], trimB: [38, 92, 170] };
const bw = (u, v) => { const w = boardToWorld(u, v); return [w.x, w.y, w.z]; };
const holePts = (r, n = 28, v0 = HOLE_V) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return bw(Math.cos(a) * r, v0 + Math.sin(a) * r); });
const L_DIR = (() => { const l = [-0.45, 0.8, -0.4], m = Math.hypot(...l); return l.map((v) => v / m); })();
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function boardPoly(ctx, cam, pts, fill, stroke, lw) { poly(ctx, pts.map((p) => P3(cam, p))); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw ?? 1; ctx.stroke(); } }

export function drawBoard(ctx, cam) {
  const hw = BOARD_W / 2, th = 0.032;
  // shadow on the lawn, cast back and to the right by the low evening sun
  const sh = (u, v) => { const w = boardToWorld(u, v); return [w.x + w.y * 0.9 + 0.02, 0, w.z + w.y * 0.5]; };
  boardPoly(ctx, cam, [sh(-hw, 0), sh(hw, 0), sh(hw, BOARD_L), sh(-hw, BOARD_L)], 'rgba(20,40,10,0.30)');
  // legs: short front legs, tall back legs (hidden under the top), and the front face
  for (const sd of [-1, 1]) boardPoly(ctx, cam, [[sd * (hw - 0.05), H_FRONT - th, BOARD_Z0 + 0.1], [sd * (hw - 0.02), H_FRONT - th, BOARD_Z0 + 0.1], [sd * (hw - 0.02), 0, BOARD_Z0 + 0.14], [sd * (hw - 0.05), 0, BOARD_Z0 + 0.14]], rgb(BOARD_PAINT.edge, 0.7));
  // side and front rims
  const lowF = (u, v) => { const w = boardToWorld(u, v); return [w.x, w.y - th, w.z]; };
  boardPoly(ctx, cam, [bw(-hw, 0), bw(hw, 0), lowF(hw, 0), lowF(-hw, 0)], rgb(BOARD_PAINT.edge, 0.78), 'rgba(40,20,6,0.8)', 1.5);
  for (const sd of [-1, 1]) boardPoly(ctx, cam, [bw(sd * hw, 0), bw(sd * hw, BOARD_L), lowF(sd * hw, BOARD_L), lowF(sd * hw, 0)], rgb(BOARD_PAINT.edge, sd < 0 ? 0.95 : 0.6), 'rgba(40,20,6,0.8)', 1.5);
  // top: pale painted wood with grain, a red and a blue band, a ring round the hole
  boardPoly(ctx, cam, [bw(-hw, 0), bw(hw, 0), bw(hw, BOARD_L), bw(-hw, BOARD_L)], rgb(BOARD_PAINT.wood), 'rgba(60,34,12,0.9)', 2);
  const topLit = (u0, u1, v0, v1, col) => boardPoly(ctx, cam, [bw(u0, v0), bw(u1, v0), bw(u1, v1), bw(u0, v1)], col);
  topLit(-hw + 0.03, hw - 0.03, 0.03, 0.12, rgb(BOARD_PAINT.trimA));
  topLit(-hw + 0.03, hw - 0.03, BOARD_L - 0.1, BOARD_L - 0.03, rgb(BOARD_PAINT.trimB));
  ctx.save(); poly(ctx, [bw(-hw, 0), bw(hw, 0), bw(hw, BOARD_L), bw(-hw, BOARD_L)].map((p) => P3(cam, p))); ctx.clip();
  for (let i = 1; i < 14; i++) { const u = -hw + (i / 14) * BOARD_W; const a = P3(cam, bw(u, 0)), b = P3(cam, bw(u + (hash(i) - 0.5) * 0.02, BOARD_L)); ctx.strokeStyle = `rgba(150,110,60,${0.10 + hash(i + 4) * 0.12})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.restore();
  boardPoly(ctx, cam, holePts(HOLE_R + 0.028, 36), rgb(BOARD_PAINT.trimB, 0.95));
  boardPoly(ctx, cam, holePts(HOLE_R + 0.014, 36), rgb(BOARD_PAINT.wood));
  // the hole: dark, with a lit far rim (a glimpse of its wall) and a dark near rim
  boardPoly(ctx, cam, holePts(HOLE_R, 36), '#0c0805');
  const inner = holePts(HOLE_R * 0.94, 36).map((p) => [p[0], p[1] - 0.045, p[2]]);
  boardPoly(ctx, cam, inner, '#1a100a');
  const c0 = P3(cam, bw(0, HOLE_V));
  ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = 2; ctx.beginPath();
  holePts(HOLE_R, 36).forEach((p, i) => { const q = P3(cam, p); if (q.y < c0.y) (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); }); ctx.stroke();
  // a soft sheen across the top
  const a = P3(cam, bw(-hw, BOARD_L)), b = P3(cam, bw(hw, 0));
  const sg = ctx.createLinearGradient(a.x, a.y, b.x, b.y); sg.addColorStop(0, 'rgba(255,255,240,0.16)'); sg.addColorStop(0.5, 'rgba(255,255,240,0)'); sg.addColorStop(1, 'rgba(30,10,0,0.10)');
  boardPoly(ctx, cam, [bw(-hw, 0), bw(hw, 0), bw(hw, BOARD_L), bw(-hw, BOARD_L)], sg);
}

// ---------------------------------------------------------------------------------------------------------------
// Bags: soft fabric pillows, 6 x 6 in, a lit top, a tapering side, stitched seam and a small mark (diamond or ring) so the sides read at a glance.
export const BAG_COL = [[208, 56, 46], [48, 108, 214]];
const OUT = (() => {   // rounded-square outline in the bag's own plane
  const h = BAG_HALF, r = 0.026, pts = [];
  for (let c = 0; c < 4; c++) { const sx = c === 0 || c === 3 ? 1 : -1, sy = c < 2 ? 1 : -1; const a0 = [0, 0.5, 1, 1.5][c] * Math.PI; for (let k = 0; k <= 4; k++) { const a = a0 + (k / 4) * (Math.PI / 2); pts.push([sx * (h - r) + Math.cos(a) * r, sy * (h - r) + Math.sin(a) * r]); } void sx; void sy; }
  return pts;
})();
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };
// frames: {e1,e2,n} unit vectors
function frameFree(yaw, pitch) {
  const n = [Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)], e1 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  return { e1, n, e2: cross(n, e1) };
}
function frameBoard(yaw) {
  const n = [0, COS_A, -SIN_A], u = [1, 0, 0], v = [0, SIN_A, COS_A];
  const e1 = [u[0] * Math.cos(yaw) + v[0] * Math.sin(yaw), u[1] * Math.cos(yaw) + v[1] * Math.sin(yaw), u[2] * Math.cos(yaw) + v[2] * Math.sin(yaw)];
  return { e1, n, e2: cross(n, e1) };
}
function frameFlat(yaw) { const n = [0, 1, 0], e1 = [Math.cos(yaw), 0, -Math.sin(yaw)]; return { e1, n, e2: cross(n, e1) }; }
function blendFrame(a, b, k) {
  let n = norm(a.n.map((v, i) => lerp(v, b.n[i], k)));
  if (dot(a.n, b.n) < 0) n = b.n;
  let e1 = a.e1.map((v, i) => lerp(v, b.e1[i], k)); const d = dot(e1, n); e1 = norm(e1.map((v, i) => v - n[i] * d));
  return { e1, n, e2: cross(n, e1) };
}

// Where a bag is and how it lies, from the simulation state (b) and the interpolation fraction already applied.
export function bagPose(b) {
  if (b.st === 'board') return { c: bw(b.u, b.v), fr: frameBoard(b.yaw || 0), lift: BAG_T * 0.5 + (b.hop || 0), onBoard: true };
  if (b.st === 'hole') return { c: bw(b.u, b.v), fr: frameBoard(b.yaw || 0), lift: BAG_T * 0.5, onBoard: true };
  if (b.st === 'ground') return { c: [b.x, b.y, b.z], fr: frameFlat(b.yaw || 0), lift: 0 };
  return { c: [b.x, b.y, b.z], fr: frameFree(b.yaw || 0, b.pitch || 0), lift: 0, free: true };
}

export function drawBag(ctx, cam, b, opts = {}) {
  let pose = bagPose(b);
  if (b.lf && b.sq > 0 && b.st !== 'free') pose = { ...pose, fr: blendFrame(pose.fr, frameFree(b.lf.yaw, b.lf.pitch), clamp(b.sq, 0, 1) ** 2) };
  const { fr } = pose;
  let c = pose.c.slice();
  const sq = clamp(b.sq || 0, 0, 1);
  let k = (opts.k ?? 1) * (1 + 0.1 * sq);
  let thick = 0.034 * (1 - 0.55 * sq);
  let n = fr.n;
  if (b.st === 'board' || b.st === 'hole' || b.st === 'ground') { c = [c[0] + fr.n[0] * pose.lift, c[1] + fr.n[1] * pose.lift, c[2] + fr.n[2] * pose.lift]; }
  let clipHole = false;
  if (b.st === 'hole') {
    const f = clamp(b.fall || 0, 0, 1);
    if (f >= 1) return null;
    const drop = clamp((f - 0.15) / 0.85, 0, 1);
    k *= 1 - 0.45 * drop; c = [c[0], c[1] - 0.16 * drop * drop - 0.02 * f, c[2]]; clipHole = f > 0.3;
    const pin = 0.35 * f; thick *= 1 + pin;
  }
  const cp = P3(cam, c), camPos = [cam.x, cam.Hc, -cam.D0];
  const toCam = [camPos[0] - c[0], camPos[1] - c[1], camPos[2] - c[2]];
  let flip = dot(n, toCam) < 0;
  const col = BAG_COL[b.side] ?? BAG_COL[0];
  const nn = flip ? n.map((v) => -v) : n;
  const shade = (nv) => 0.5 + 0.55 * Math.max(0, dot(nv, L_DIR)) + 0.1 * (nv[1] > 0.5 ? 1 : 0);
  const loc = (a, ofs) => { const x = a[0] * k, y = a[1] * k; return [c[0] + fr.e1[0] * x + fr.e2[0] * y + nn[0] * ofs, c[1] + fr.e1[1] * x + fr.e2[1] * y + nn[1] * ofs, c[2] + fr.e1[2] * x + fr.e2[2] * y + nn[2] * ofs]; };
  const topPts = OUT.map((a) => P3(cam, loc(a, thick * 0.55))), botPts = OUT.map((a) => P3(cam, loc([a[0] * 0.97, a[1] * 0.97], -thick * 0.45)));
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (clipHole) { const hp = holePts(HOLE_R * 1.05, 24).map((p) => P3(cam, p)); const top = hp.reduce((m, p) => Math.min(m, p.y), 1e9); ctx.beginPath(); ctx.rect(0, 0, 720, top - 40 * 0 + 600); ctx.clip(); poly(ctx, hp.map((p) => ({ x: p.x, y: p.y }))); ctx.clip(); }
  // soft contact shadow underneath
  if (opts.shadow !== false && pose.onBoard) {
    ctx.fillStyle = 'rgba(30,12,0,0.30)';
    poly(ctx, OUT.map((a) => P3(cam, [loc(a, -thick * 0.45)[0] + 0.012, loc(a, -thick * 0.45)[1] - 0.003, loc(a, -thick * 0.45)[2] + 0.004]))); ctx.fill();
  }
  // sides
  const area = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p.x * q.y - q.x * p.y; } return s; };
  const topArea = area(topPts);
  for (let i = 0; i < OUT.length; i++) {
    const j = (i + 1) % OUT.length;
    const q = [botPts[i], botPts[j], topPts[j], topPts[i]];
    const sa = area(q); if (sa * topArea > 0) continue;   // facing away
    const mid = [(OUT[i][0] + OUT[j][0]) / 2, (OUT[i][1] + OUT[j][1]) / 2];
    const sn = norm([fr.e1[0] * mid[0] + fr.e2[0] * mid[1], fr.e1[1] * mid[0] + fr.e2[1] * mid[1], fr.e1[2] * mid[0] + fr.e2[2] * mid[1]]);
    ctx.fillStyle = rgb(col, 0.55 * shade(sn) + 0.18); poly(ctx, q); ctx.fill();
  }
  // top face
  const sTop = shade(nn), baseCol = rgb(col, sTop);
  poly(ctx, topPts); ctx.fillStyle = baseCol; ctx.fill();
  ctx.lineWidth = Math.max(1, cp.s * 0.012); ctx.strokeStyle = rgb(col, 0.42); ctx.stroke();
  const rpx = BAG_HALF * k * cp.s;
  if (rpx > 9) {
    // pillow: a lit dome in the middle, darker toward the rim
    const hi = P3(cam, loc([-0.018, 0.02], thick * 0.9));
    const g = ctx.createRadialGradient(hi.x, hi.y, rpx * 0.05, cp.x, cp.y, rpx * 1.25);
    g.addColorStop(0, 'rgba(255,255,255,0.40)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.30)');
    poly(ctx, topPts); ctx.fillStyle = g; ctx.fill();
    // stitched seam just inside the edge
    ctx.save(); ctx.setLineDash([Math.max(2, rpx * 0.12), Math.max(2, rpx * 0.1)]); ctx.strokeStyle = rgb(mixc(col, [255, 245, 220], 0.7), 1, 0.85); ctx.lineWidth = Math.max(1, rpx * 0.035);
    poly(ctx, OUT.map((a) => P3(cam, loc([a[0] * 0.84, a[1] * 0.84], thick * 0.5)))); ctx.stroke(); ctx.restore();
    // the mark: a diamond on red, a ring on blue
    ctx.strokeStyle = 'rgba(255,248,230,0.92)'; ctx.fillStyle = 'rgba(255,248,230,0.92)'; ctx.lineWidth = Math.max(1.4, rpx * 0.07);
    if (b.side === 0) { poly(ctx, [[0, 0.03], [0.03, 0], [0, -0.03], [-0.03, 0]].map((a) => P3(cam, loc(a, thick * 0.55)))); ctx.fill(); }
    else { poly(ctx, Array.from({ length: 14 }, (_, i) => P3(cam, loc([Math.cos((i / 14) * TAU) * 0.032, Math.sin((i / 14) * TAU) * 0.032], thick * 0.55)))); ctx.stroke(); }
    // two soft creases make it look like fabric over loose filling
    if (rpx > 20) { ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = Math.max(1, rpx * 0.04); for (const s of [-1, 1]) { const a = P3(cam, loc([s * 0.045, -0.05], thick * 0.5)), m = P3(cam, loc([s * 0.03, 0], thick * 0.6)), z = P3(cam, loc([s * 0.045, 0.05], thick * 0.5)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, z.x, z.y); ctx.stroke(); } }
  }
  ctx.restore();
  return { x: cp.x, y: cp.y, r: rpx };
}

// A soft shadow straight under a bag that is in the air (on the board if it is over it, else on the lawn). Bigger and fainter the higher it is.
export function drawFlightShadow(ctx, cam, b) {
  const over = Math.abs(b.x) < BOARD_W / 2 && b.z > BOARD_Z0 && b.z < BOARD_Z0 + BOARD_L * COS_A;
  const gy = over ? surfaceH(b.z) : 0;
  const h = Math.max(0, b.y - gy);
  const p = proj(cam, b.x, gy, b.z), r = BAG_HALF * p.s * (1 + h * 0.18), a = clamp(0.38 - h * 0.07, 0.08, 0.38);
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, over ? 0.42 : 0.3);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2); g.addColorStop(0, `rgba(10,24,4,${a})`); g.addColorStop(1, 'rgba(10,24,4,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, TAU); ctx.fill(); ctx.restore();
}

// All bags (resting, sliding, in the air) from far to near. `bags` are already interpolated.
export function drawBags(ctx, cam, bags, opts = {}) {
  const list = bags.filter((b) => b.st !== 'rack').map((b) => { const p = bagPose(b); return { b, z: p.c[2] + (p.free ? 0.12 : 0), free: !!p.free }; });
  list.sort((a, c) => c.z - a.z);
  for (const e of list) if (e.free || e.b.st === 'ground') drawFlightShadow(ctx, cam, e.b.st === 'ground' ? { ...e.b, y: 0 } : e.b);
  for (const e of list) drawBag(ctx, cam, e.b, opts);
}

// ---------------------------------------------------------------------------------------------------------------
// Overlays painted on the lawn and the board: the flight arc, the landing ring, the hint
export function drawArc(ctx, cam, pts, col, t, width = 4, alpha = 1) {
  const sp = pts.map((p) => proj(cam, p.x, p.y, p.z));
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = width + 3; ctx.beginPath(); sp.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + 1) : ctx.moveTo(p.x, p.y + 1))); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -t * 40;
  ctx.beginPath(); sp.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.restore();
}
export function drawLanding(ctx, cam, x, z, col, t, label) {
  const y = z >= BOARD_Z0 && z <= BOARD_Z0 + BOARD_L * COS_A && Math.abs(x) < BOARD_W / 2 + 0.05 ? surfaceH(z) + 0.004 : 0.004;
  const on = y > 0.01;
  const ring = (r) => Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * TAU; return on ? (() => { const w = worldRing(x, z, r, a); return P3(cam, w); })() : P3(cam, [x + Math.cos(a) * r, 0.004, z + Math.sin(a) * r]); });
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3.2;
  poly(ctx, ring(0.1 * (1 + 0.05 * Math.sin(t * 5)))); ctx.stroke();
  poly(ctx, ring(0.045)); ctx.stroke();
  if (label) { const c = P3(cam, [x, y, z]); ctx.font = '700 18px Georgia, serif'; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(label, c.x, c.y - 26); }
  ctx.restore();
}
function worldRing(x, z, r, a) { const v = (z - BOARD_Z0) / COS_A; const w = boardToWorld(x + Math.cos(a) * r, v + Math.sin(a) * r); return [w.x, w.y + 0.004, w.z]; }

// Localised dust puffs and cloth flecks. They live in world space and are drawn with the same camera: nothing else moves.
export function drawParts(ctx, cam, parts) {
  for (const p of parts) {
    const c = proj(cam, p.x, p.y, p.z), k = 1 - p.t / p.max;
    ctx.globalAlpha = Math.max(0, p.k === 'dust' ? k * 0.5 : k);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(0.8, p.size * c.s * (p.k === 'dust' ? 1.5 - k * 0.7 : 1)), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------------------------
// Sub-step interpolation: the physics runs in fixed steps (1/240 s); drawing blends the previous step into the current one by the fraction of a
// step left over, so motion is smooth at any display rate. snapSim() (phys.js) is called just before each physics step.
export function interpBags(sim, a) {
  const pv = sim.pv;
  if (!pv || sim.done || !(a > 0)) return sim.bags;
  const A = Math.min(1, a);
  return sim.bags.map((b, i) => {
    const q = pv[i];
    if (!q || q.id !== b.id || q.st !== b.st) return b;
    return { ...b, x: lerp(q.x, b.x, A), y: lerp(q.y, b.y, A), z: lerp(q.z, b.z, A), u: lerp(q.u, b.u, A), v: lerp(q.v, b.v, A), yaw: lerp(q.yaw, b.yaw, A), pitch: lerp(q.pitch, b.pitch, A) };
  });
}
export { clamp, lerp, frameFree, frameBoard, frameFlat };
