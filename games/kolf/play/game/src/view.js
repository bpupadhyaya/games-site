// Kolf drawing: the 3D court seen from behind the ball (a perspective projection of the flat simulation), painted in the warm,
// hazy light of a winter canal scene. Pure drawing from state: nothing here changes the game. Everything that looks random is
// seeded from the court id, so the same court always looks the same.
//
// Camera: a pinhole behind and above the ball, looking along `yaw` (0 = towards +y, positive = towards +x). Ground point (x, y)
// at height z projects to  sx = cx + f * X / Z,  sy = horizon + f * (camH - z) / Z  with (X, Z) the point in camera space.
import { BR, POST_R, moverPos, onSnow } from './sim.js';
import { FONT, SERIF, C, roundPath, panel, plaque, wrapLines, textShadow, drawButton, FLOOR } from './ui.js';

const TAU = Math.PI * 2;
const NEAR = 0.35;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function lcg(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hashStr = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
export const normAng = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// Ball colours for up to four players: ivory, indigo, ochre, sage.
export const BALL_COLORS = [
  { name: 'Ivory', base: '#f6efdc', mid: '#d9ccab', dark: '#8d7d58', coat: '#7d2a1c', coat2: '#a8452f' },
  { name: 'Indigo', base: '#7f9fd0', mid: '#3f66a6', dark: '#1d3763', coat: '#1d3763', coat2: '#2f5b94' },
  { name: 'Ochre', base: '#f0c870', mid: '#cc9a30', dark: '#7a5612', coat: '#8a5c14', coat2: '#b9822a' },
  { name: 'Sage', base: '#bcd0a0', mid: '#7f9a5e', dark: '#43572d', coat: '#43572d', coat2: '#617f40' },
];

// ---- camera ----------------------------------------------------------------------------------------------------------
// v = { x, y, yaw, dist } : the ball the camera follows, where it looks, and the distance to the target (sets height and pull-back).
export function makeCam(rect, v) {
  const wide = rect.w > rect.h * 1.1;
  const back = clamp(6.5 + v.dist * 0.05, 6.5, 13) * (wide ? 1.2 : 1);
  const fx = Math.sin(v.yaw), fy = Math.cos(v.yaw), rx = Math.cos(v.yaw), ry = -Math.sin(v.yaw);
  const f = Math.max(rect.h * 0.78, rect.w * 0.86);
  // the ball sits about 72 % of the way down the view whatever the shape of the screen: pick the camera height for that
  const h = clamp((0.72 - 0.34) * rect.h * back / f, 2.4, 14);
  const cam = { x: v.x - fx * back, y: v.y - fy * back, h, yaw: v.yaw, fx, fy, rx, ry, f, cx: rect.x + rect.w / 2, hy: rect.y + rect.h * 0.34, rect };
  // world (x, y, z) -> [sx, sy, depth, px per metre] or null behind the near plane
  cam.p = (wx, wy, wz = 0) => {
    const dx = wx - cam.x, dy = wy - cam.y, Z = dx * fx + dy * fy;
    if (Z < NEAR) return null;
    const X = dx * rx + dy * ry, k = f / Z;
    return [cam.cx + X * k, cam.hy + (h - wz) * k, Z, k];
  };
  cam.cs = (wx, wy, wz = 0) => { const dx = wx - cam.x, dy = wy - cam.y; return { X: dx * rx + dy * ry, Z: dx * fx + dy * fy, Y: h - wz }; };
  return cam;
}
// A polygon of world points [[x, y, z], ...] clipped at the near plane and projected; null when nothing is in front.
function projPoly(cam, pts) {
  const cs = pts.map((p) => cam.cs(p[0], p[1], p[2] || 0));
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length];
    const ain = a.Z >= NEAR, bin = b.Z >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (NEAR - a.Z) / (b.Z - a.Z); out.push({ X: lerp(a.X, b.X, t), Y: lerp(a.Y, b.Y, t), Z: NEAR }); }
  }
  if (out.length < 3) return null;
  return out.map((q) => [cam.cx + (q.X * cam.f) / q.Z, cam.hy + (q.Y * cam.f) / q.Z]);
}
function fillPoly(ctx, cam, pts, fill, stroke, lw = 1) {
  const q = projPoly(cam, pts); if (!q) return null;
  ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  return q;
}
function lineWorld(ctx, cam, a, b) {   // a, b: [x, y, z]; clipped at the near plane
  let p = cam.cs(a[0], a[1], a[2] || 0), q = cam.cs(b[0], b[1], b[2] || 0);
  if (p.Z < NEAR && q.Z < NEAR) return false;
  if (p.Z < NEAR) { const t = (NEAR - p.Z) / (q.Z - p.Z); p = { X: lerp(p.X, q.X, t), Y: lerp(p.Y, q.Y, t), Z: NEAR }; }
  if (q.Z < NEAR) { const t = (NEAR - q.Z) / (p.Z - q.Z); q = { X: lerp(q.X, p.X, t), Y: lerp(q.Y, p.Y, t), Z: NEAR }; }
  ctx.moveTo(cam.cx + (p.X * cam.f) / p.Z, cam.hy + (p.Y * cam.f) / p.Z); ctx.lineTo(cam.cx + (q.X * cam.f) / q.Z, cam.hy + (q.Y * cam.f) / q.Z);
  return true;
}

// ---- the painted sky and distant bank ---------------------------------------------------------------------------------
const STYLE = {
  canal: { sky: ['#7f98a8', '#c9c3a5', '#f3deb0'], bank: '#6f6049', haze: 'rgba(247,222,170,0.55)', kinds: ['house', 'house', 'house', 'spire', 'tree', 'tree'] },
  mill: { sky: ['#8a9fae', '#d2c7a4', '#f6dfae'], bank: '#675a42', haze: 'rgba(248,224,170,0.5)', kinds: ['mill', 'mill', 'tree', 'tree', 'house', 'tree'] },
  harbour: { sky: ['#6f8798', '#bfbfa6', '#f0d9ae'], bank: '#5d5240', haze: 'rgba(240,218,172,0.55)', kinds: ['mast', 'mast', 'house', 'house', 'spire', 'mast'] },
};
const itemCache = new Map();
function itemsFor(court) {
  const key = court.id;
  if (itemCache.has(key)) return itemCache.get(key);
  const rnd = lcg(hashStr(`kolf-${key}`)), st = STYLE[court.style] || STYLE.canal;
  const items = [];
  const n = 34;
  for (let i = 0; i < n; i++) {
    const kind = st.kinds[Math.floor(rnd() * st.kinds.length)];
    items.push({ kind, a: (i / n) * TAU + (rnd() - 0.5) * 0.14, d: 0.4 + rnd() * 0.6, s: 0.7 + rnd() * 0.7, v: rnd(), w: rnd() });
  }
  items.push({ kind: 'skaters', a: 0.25, d: 0.3, s: 1, v: 0.2, w: 0.5 }, { kind: 'skaters', a: -0.9, d: 0.35, s: 1, v: 0.7, w: 0.2 }, { kind: 'skaters', a: 2.2, d: 0.3, s: 1, v: 0.4, w: 0.6 });
  itemCache.set(key, items);
  if (itemCache.size > 12) itemCache.delete(itemCache.keys().next().value);
  return items;
}
const BRICK = ['#8b4a35', '#a2603f', '#7a3f2e', '#b5835a', '#c8a66f'];
function drawHouse(ctx, x, base, h, it) {
  const w = h * (0.9 + it.w * 0.5), col = BRICK[Math.floor(it.v * BRICK.length)];
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, base - h, w, h);
  // stepped gable
  ctx.beginPath(); ctx.moveTo(x - w / 2, base - h);
  const steps = 3;
  for (let k = 0; k < steps; k++) { const sx = x - w / 2 + (w / 2) * ((k + 1) / (steps + 1)); ctx.lineTo(sx, base - h - h * 0.14 * k); ctx.lineTo(sx, base - h - h * 0.14 * (k + 1)); }
  ctx.lineTo(x, base - h - h * 0.14 * steps);
  for (let k = steps - 1; k >= 0; k--) { const sx = x + (w / 2) * ((k + 1) / (steps + 1)); ctx.lineTo(sx, base - h - h * 0.14 * (k + 1)); ctx.lineTo(sx, base - h - h * 0.14 * k); }
  ctx.lineTo(x + w / 2, base - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(30,18,8,0.55)';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) ctx.fillRect(x - w * 0.28 + c * w * 0.34, base - h * 0.85 + r * h * 0.4, w * 0.18, h * 0.22);
  ctx.fillStyle = 'rgba(255,230,170,0.16)'; ctx.fillRect(x - w / 2, base - h, w * 0.22, h);
}
function drawSpire(ctx, x, base, h) {
  ctx.fillStyle = '#6b5a45'; ctx.fillRect(x - h * 0.08, base - h * 0.62, h * 0.16, h * 0.62);
  ctx.fillStyle = '#7d4b36'; ctx.beginPath(); ctx.moveTo(x - h * 0.1, base - h * 0.62); ctx.lineTo(x, base - h); ctx.lineTo(x + h * 0.1, base - h * 0.62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a6850'; ctx.fillRect(x - h * 0.34, base - h * 0.22, h * 0.68, h * 0.22);
  ctx.fillStyle = 'rgba(30,18,8,0.5)'; ctx.fillRect(x - h * 0.03, base - h * 0.5, h * 0.06, h * 0.12);
}
function drawMill(ctx, x, base, h, t, it) {
  ctx.fillStyle = '#5b4a38'; ctx.beginPath(); ctx.moveTo(x - h * 0.17, base); ctx.lineTo(x - h * 0.1, base - h * 0.62); ctx.lineTo(x + h * 0.1, base - h * 0.62); ctx.lineTo(x + h * 0.17, base); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,170,0.18)'; ctx.beginPath(); ctx.moveTo(x - h * 0.17, base); ctx.lineTo(x - h * 0.1, base - h * 0.62); ctx.lineTo(x - h * 0.02, base - h * 0.62); ctx.lineTo(x - h * 0.06, base); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3f3224'; ctx.beginPath(); ctx.moveTo(x - h * 0.12, base - h * 0.62); ctx.lineTo(x, base - h * 0.74); ctx.lineTo(x + h * 0.12, base - h * 0.62); ctx.closePath(); ctx.fill();
  const hx = x, hy = base - h * 0.62, a0 = t * (0.12 + it.w * 0.1) + it.v * 6;
  ctx.strokeStyle = '#3a2d20'; ctx.lineWidth = Math.max(1, h * 0.018);
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2, ex = hx + Math.cos(a) * h * 0.46, ey = hy + Math.sin(a) * h * 0.46;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    const nx = -Math.sin(a), ny = Math.cos(a);
    ctx.fillStyle = 'rgba(232,220,190,0.78)'; ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a) * h * 0.1, hy + Math.sin(a) * h * 0.1); ctx.lineTo(ex, ey); ctx.lineTo(ex + nx * h * 0.1, ey + ny * h * 0.1); ctx.lineTo(hx + Math.cos(a) * h * 0.1 + nx * h * 0.1, hy + Math.sin(a) * h * 0.1 + ny * h * 0.1); ctx.closePath(); ctx.fill();
  }
}
function drawTree(ctx, x, base, h, it) {
  ctx.strokeStyle = '#3c2f22'; ctx.lineCap = 'round';
  const rnd = lcg(Math.floor(it.v * 1e6) + 7);
  const branch = (bx, by, len, ang, depth) => {
    ctx.lineWidth = Math.max(1, h * 0.03 * depth * 0.5);
    const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    if (depth > 1) { branch(ex, ey, len * 0.7, ang - 0.5 - rnd() * 0.3, depth - 1); branch(ex, ey, len * 0.72, ang + 0.45 + rnd() * 0.3, depth - 1); }
  };
  branch(x, base, h * 0.36, 0, 4);
}
function drawMast(ctx, x, base, h, it) {
  ctx.fillStyle = '#3d2f22'; ctx.beginPath(); ctx.moveTo(x - h * 0.4, base - h * 0.08); ctx.lineTo(x + h * 0.4, base - h * 0.08); ctx.lineTo(x + h * 0.3, base); ctx.lineTo(x - h * 0.3, base); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3d2f22'; ctx.lineWidth = Math.max(1, h * 0.025);
  ctx.beginPath(); ctx.moveTo(x - h * 0.1, base - h * 0.08); ctx.lineTo(x - h * 0.1, base - h * (0.8 + it.w * 0.2)); ctx.moveTo(x + h * 0.12, base - h * 0.08); ctx.lineTo(x + h * 0.12, base - h * (0.7 + it.v * 0.2)); ctx.stroke();
  ctx.lineWidth = Math.max(1, h * 0.012); ctx.beginPath(); ctx.moveTo(x - h * 0.1, base - h * 0.7); ctx.lineTo(x - h * 0.38, base - h * 0.08); ctx.moveTo(x + h * 0.12, base - h * 0.6); ctx.lineTo(x + h * 0.38, base - h * 0.08); ctx.stroke();
}
function drawSkaters(ctx, x, base, h, t, it) {
  const n = 4;
  for (let i = 0; i < n; i++) {
    const px = x + ((i * 0.9 + t * 0.03 * (it.v > 0.5 ? 1 : -1)) % 3.6 - 1.8) * h * 0.4, hh = h * 0.18;
    ctx.fillStyle = i % 2 ? '#27364f' : '#6b2a1c';
    ctx.fillRect(px - hh * 0.12, base - hh, hh * 0.24, hh * 0.78);
    ctx.fillStyle = '#e9d7b0'; ctx.beginPath(); ctx.arc(px, base - hh * 1.08, hh * 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = Math.max(1, hh * 0.05); ctx.beginPath(); ctx.moveTo(px - hh * 0.2, base); ctx.lineTo(px + hh * 0.25, base); ctx.stroke();
  }
}
export function drawBackdrop(ctx, cam, court, t, rect) {
  const st = STYLE[court.style] || STYLE.canal;
  const top = rect.y, hy = cam.hy;
  const g = ctx.createLinearGradient(0, top, 0, hy);
  g.addColorStop(0, st.sky[0]); g.addColorStop(0.55, st.sky[1]); g.addColorStop(1, st.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(rect.x, top, rect.w, hy - top + 1);
  // painterly clouds: a few soft layered ellipses, drifting slowly and turning with the view
  const rnd = lcg(hashStr(`sky-${court.id}`));
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, y = lerp(top + (hy - top) * 0.1, top + (hy - top) * 0.7, rnd()), w = rect.w * (0.22 + rnd() * 0.3), h = w * (0.1 + rnd() * 0.08);
    const dx = normAng(a - cam.yaw + t * 0.004), x = cam.cx + Math.tan(clamp(dx, -1.4, 1.4)) * cam.f;
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = k % 2 ? '#fff4d6' : '#f2dcc0';
      ctx.beginPath(); ctx.ellipse(x + (k - 1.5) * w * 0.18, y + k * h * 0.12, w * (0.5 - k * 0.07), h * (1 - k * 0.12), 0, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // low sun glow near the horizon
  const sunA = 0.55, sx = cam.cx + Math.tan(clamp(normAng(sunA - cam.yaw), -1.45, 1.45)) * cam.f;
  const sg = ctx.createRadialGradient(sx, hy - 6, 4, sx, hy - 6, rect.w * 0.45);
  sg.addColorStop(0, 'rgba(255,236,170,0.75)'); sg.addColorStop(0.35, 'rgba(255,214,140,0.28)'); sg.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = sg; ctx.fillRect(rect.x, top, rect.w, hy - top + 2);
  // far bank: a long low band, then the scenery standing on it
  const bankH = Math.max(6, rect.h * 0.045);
  ctx.fillStyle = st.bank; ctx.fillRect(rect.x, hy - bankH * 0.55, rect.w, bankH * 0.6);
  const items = itemsFor(court);
  for (const it of items.slice().sort((a, b) => b.d - a.d)) {
    const dx = normAng(it.a - cam.yaw);
    if (Math.abs(dx) > 1.25) continue;
    const x = cam.cx + Math.tan(dx) * cam.f;
    const h = rect.h * (0.05 + 0.07 * it.s * (1.15 - it.d * 0.5));
    const base = hy + 1 - (1 - it.d) * 1.5;
    ctx.save(); ctx.globalAlpha = 0.62 + 0.38 * (1 - it.d);
    if (it.kind === 'house') drawHouse(ctx, x, base, h, it);
    else if (it.kind === 'spire') drawSpire(ctx, x, base, h * 1.5);
    else if (it.kind === 'mill') drawMill(ctx, x, base, h * 1.6, t, it);
    else if (it.kind === 'tree') drawTree(ctx, x, base, h * 1.2, it);
    else if (it.kind === 'mast') drawMast(ctx, x, base, h * 1.3, it);
    else if (it.kind === 'skaters') drawSkaters(ctx, x, base + 1, h * 1.2, t, it);
    ctx.restore();
  }
  // atmospheric haze at the horizon
  const hz = ctx.createLinearGradient(0, hy - rect.h * 0.1, 0, hy + 3);
  hz.addColorStop(0, 'rgba(247,226,176,0)'); hz.addColorStop(1, st.haze);
  ctx.fillStyle = hz; ctx.fillRect(rect.x, hy - rect.h * 0.1, rect.w, rect.h * 0.1 + 3);
}

// ---- the court -------------------------------------------------------------------------------------------------------
const PLANK = '#8a6a3c', PLANK_TOP = '#d0a868', PLANK_DARK = '#5b4426';
function crackLines(court) {
  const rnd = lcg(hashStr(`ice-${court.id}`)), lines = [];
  for (let i = 0; i < 46; i++) {
    let x = rnd() * court.W, y = rnd() * court.L, a = rnd() * TAU;
    const pts = [[x, y]];
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) { a += (rnd() - 0.5) * 1.2; const l = 1.5 + rnd() * 5; x = clamp(x + Math.cos(a) * l, 0.2, court.W - 0.2); y = clamp(y + Math.sin(a) * l, 0.2, court.L - 0.2); pts.push([x, y]); }
    lines.push(pts);
  }
  return lines;
}
const crackCache = new Map();
const cracksFor = (court) => { if (!crackCache.has(court.id)) { crackCache.set(court.id, crackLines(court)); if (crackCache.size > 12) crackCache.delete(crackCache.keys().next().value); } return crackCache.get(court.id); };

function drawFloor(ctx, cam, court, rect) {
  // snow and open ice outside the boards, below the horizon
  const og = ctx.createLinearGradient(0, cam.hy, 0, rect.y + rect.h);
  og.addColorStop(0, '#e9dcc0'); og.addColorStop(0.15, '#d9d9c9'); og.addColorStop(1, '#9fb6bc');
  ctx.fillStyle = og; ctx.fillRect(rect.x, cam.hy, rect.w, rect.y + rect.h - cam.hy);
  const W = court.W, L = court.L;
  const q = projPoly(cam, [[0, 0, 0], [W, 0, 0], [W, L, 0], [0, L, 0]]);
  if (!q) return;
  // ice: cool grey-green near, warm haze far
  const ig = ctx.createLinearGradient(0, cam.hy, 0, rect.y + rect.h);
  ig.addColorStop(0, '#e8e3c8'); ig.addColorStop(0.1, '#cfdcd2'); ig.addColorStop(0.45, '#aac6c8'); ig.addColorStop(1, '#86aab2');
  ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = ig; ctx.fill();
  ctx.save(); ctx.clip();
  // long soft bands: the skate scratches of the day, one every 6 m
  const step = 6;
  for (let y0 = 0; y0 < L; y0 += step * 2) fillPoly(ctx, cam, [[0, y0, 0], [W, y0, 0], [W, y0 + step, 0], [0, y0 + step, 0]], 'rgba(255,255,255,0.07)');
  // a warm sheen where the low sun lies on the ice
  const sheen = projPoly(cam, [[W * 0.2, 0, 0], [W * 0.8, 0, 0], [W * 0.62, L, 0], [W * 0.38, L, 0]]);
  if (sheen) { ctx.beginPath(); sheen.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = 'rgba(255,232,170,0.1)'; ctx.fill(); }
  // snow patches
  for (const r of court.snow) {
    const e = 0.5;
    fillPoly(ctx, cam, [[r.x0 - e, r.y0 - e, 0], [r.x1 + e, r.y0 - e, 0], [r.x1 + e, r.y1 + e, 0], [r.x0 - e, r.y1 + e, 0]], 'rgba(205,218,226,0.55)');
    fillPoly(ctx, cam, [[r.x0, r.y0, 0], [r.x1, r.y0, 0], [r.x1, r.y1, 0], [r.x0, r.y1, 0]], '#f7f4ea');
    const rnd = lcg(hashStr(`snow-${court.id}-${r.x0}-${r.y0}`));
    ctx.strokeStyle = 'rgba(160,178,190,0.7)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 14; i++) { const x = lerp(r.x0, r.x1, rnd()), y = lerp(r.y0, r.y1, rnd()); lineWorld(ctx, cam, [x, y, 0], [x + 0.7, y + 0.2, 0]); }
    ctx.stroke();
  }
  // thin ice: dark, glassy, cracked
  for (const r of court.thin) {
    fillPoly(ctx, cam, [[r.x0, r.y0, 0], [r.x1, r.y0, 0], [r.x1, r.y1, 0], [r.x0, r.y1, 0]], 'rgba(36,74,96,0.78)', 'rgba(220,240,250,0.65)', 1.5);
    const rnd = lcg(hashStr(`thin-${court.id}-${r.x0}-${r.y0}`));
    ctx.strokeStyle = 'rgba(225,244,252,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const x = lerp(r.x0, r.x1, rnd()), y = lerp(r.y0, r.y1, rnd()); lineWorld(ctx, cam, [x, y, 0], [x + (rnd() - 0.5) * 2.2, y + (rnd() - 0.5) * 2.6, 0]); }
    ctx.stroke();
  }
  // fine cracks
  ctx.strokeStyle = 'rgba(70,100,115,0.22)'; ctx.lineWidth = 1; ctx.beginPath();
  for (const pl of cracksFor(court)) for (let i = 1; i < pl.length; i++) lineWorld(ctx, cam, [pl[i - 1][0], pl[i - 1][1], 0], [pl[i][0], pl[i][1], 0]);
  ctx.stroke();
  // plank bridges over the thin ice
  for (const r of court.bridges) {
    fillPoly(ctx, cam, [[r.x0, r.y0, 0], [r.x1, r.y0, 0], [r.x1, r.y1, 0], [r.x0, r.y1, 0]], '#9a7440', '#4a3418', 1.5);
    ctx.strokeStyle = 'rgba(60,40,15,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let y = r.y0 + 0.6; y < r.y1; y += 0.6) lineWorld(ctx, cam, [r.x0, y, 0], [r.x1, y, 0]);
    ctx.stroke();
  }
  ctx.restore();
}

// Boards: the inner face of the side and end boards, with a lighter top rail and a post every 8 m.
function drawBoards(ctx, cam, court) {
  const W = court.W, L = court.L, hh = 0.85;
  const face = (x0, y0, x1, y1, shade) => {
    fillPoly(ctx, cam, [[x0, y0, 0], [x1, y1, 0], [x1, y1, hh], [x0, y0, hh]], shade, null);
    ctx.strokeStyle = 'rgba(40,26,10,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
    lineWorld(ctx, cam, [x0, y0, hh * 0.5], [x1, y1, hh * 0.5]);
    ctx.stroke();
    ctx.strokeStyle = PLANK_TOP; ctx.lineWidth = 3; ctx.beginPath(); lineWorld(ctx, cam, [x0, y0, hh], [x1, y1, hh]); ctx.stroke();
  };
  face(0, 0, 0, L, '#7d5f33'); face(W, 0, W, L, '#8a6a3c'); face(0, L, W, L, '#745a31'); face(0, 0, W, 0, '#745a31');
  ctx.strokeStyle = PLANK_DARK; ctx.lineWidth = 3; ctx.beginPath();
  for (let y = 0; y <= L; y += 8) { lineWorld(ctx, cam, [0, y, 0], [0, y, hh + 0.12]); lineWorld(ctx, cam, [W, y, 0], [W, y, hh + 0.12]); }
  ctx.stroke();
}

// Skaters gliding about on the open ice outside the boards.
const SKATE_COATS = [
  { coat: '#3b4a63', coat2: '#56688a' }, { coat: '#6b2a1c', coat2: '#8d4130' }, { coat: '#5a4a2c', coat2: '#7d6a3e' },
  { coat: '#2f3f33', coat2: '#4a6150' }, { coat: '#7a6a58', coat2: '#a08c74' },
];
const skaterCache = new Map();
function skatersFor(court) {
  if (skaterCache.has(court.id)) return skaterCache.get(court.id);
  const rnd = lcg(hashStr(`skaters-${court.id}`)), out = [];
  for (let i = 0; i < 10; i++) {
    const left = i % 2 === 0, off = 4 + rnd() * 14;
    out.push({ x: left ? -off : court.W + off, y0: rnd() * (court.L + 30), v: (left ? 1 : -1) * (0.8 + rnd() * 1.4) * (rnd() < 0.5 ? 1 : -1), c: SKATE_COATS[i % SKATE_COATS.length], s: 0.85 + rnd() * 0.3 });
  }
  skaterCache.set(court.id, out);
  if (skaterCache.size > 12) skaterCache.delete(skaterCache.keys().next().value);
  return out;
}
function drawSkater(ctx, cam, court, sk, t) {
  const span = court.L + 40;
  let y = (sk.y0 + sk.v * t) % span; if (y < 0) y += span;
  y -= 20;
  const p = cam.p(sk.x, y, 0); if (!p || p[2] > 150 || p[3] < 2.5) return;
  const u = p[3] * sk.s, glide = Math.sin(t * 1.1 + sk.y0);
  ctx.save();
  ctx.globalAlpha = 0.92;
  drawFigure(ctx, p[0], p[1], u, { coat: sk.c.coat, coat2: sk.c.coat2 }, 0, 0.8 * glide, { noClub: true, arm: 0.1 * glide });
  ctx.restore();
}

// ---- standing objects (sorted far to near) ---------------------------------------------------------------------------
function shadowEllipse(ctx, cam, x, y, r, a = 0.28) {
  const p = cam.p(x, y, 0); if (!p) return;
  ctx.fillStyle = `rgba(30,24,20,${a})`; ctx.beginPath(); ctx.ellipse(p[0] + p[3] * r * 0.25, p[1], p[3] * r * 1.15, Math.max(1, p[3] * r * 0.32), 0, 0, TAU); ctx.fill();
}
function drawBollard(ctx, cam, o) {
  const b = cam.p(o.x, o.y, 0), tp = cam.p(o.x, o.y, 1.15); if (!b || !tp) return;
  shadowEllipse(ctx, cam, o.x, o.y, o.r);
  const r = b[3] * o.r, rt = tp[3] * o.r;
  const g = ctx.createLinearGradient(b[0] - r, 0, b[0] + r, 0);
  g.addColorStop(0, '#4b3c2c'); g.addColorStop(0.45, '#7c6446'); g.addColorStop(1, '#2c2118');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b[0] - r, b[1]); ctx.lineTo(tp[0] - rt, tp[1]); ctx.ellipse(tp[0], tp[1], rt, rt * 0.34, 0, Math.PI, 0, true); ctx.lineTo(b[0] + r, b[1]); ctx.ellipse(b[0], b[1], r, r * 0.34, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9b8059'; ctx.beginPath(); ctx.ellipse(tp[0], tp[1], rt, rt * 0.34, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = Math.max(1, r * 0.22); ctx.beginPath(); ctx.ellipse((b[0] + tp[0]) / 2, lerp(b[1], tp[1], 0.4), (r + rt) / 2, (r + rt) * 0.17, 0, 0.1, Math.PI - 0.1); ctx.stroke();
}
function drawBlock(ctx, cam, o, t) {
  const boat = o.kind !== 'barge', hgt = boat ? 1.35 : 1.5;
  const pal = boat
    ? { y0: '#2b415a', x: '#3f5f80', y1: '#1e3042', top: '#d9c79c', band: '#8d3b2b', rail: '#e8dcc0' }
    : { y0: '#4a3a2a', x: '#6b5238', y1: '#35291e', top: '#7d6644', band: '#2b2016', rail: '#a8895a' };
  fillPoly(ctx, cam, [[o.x0 + 0.4, o.y0 - 0.1, 0], [o.x1 + 0.9, o.y0 - 0.1, 0], [o.x1 + 0.9, o.y1 + 0.2, 0], [o.x0 + 0.4, o.y1 + 0.2, 0]], 'rgba(30,40,50,0.22)');
  const quad = (f, z0, z1) => {
    switch (f) {
      case 'y0': return [[o.x0, o.y0, z0], [o.x1, o.y0, z0], [o.x1, o.y0, z1], [o.x0, o.y0, z1]];
      case 'y1': return [[o.x0, o.y1, z0], [o.x1, o.y1, z0], [o.x1, o.y1, z1], [o.x0, o.y1, z1]];
      case 'x0': return [[o.x0, o.y0, z0], [o.x0, o.y1, z0], [o.x0, o.y1, z1], [o.x0, o.y0, z1]];
      default: return [[o.x1, o.y0, z0], [o.x1, o.y1, z0], [o.x1, o.y1, z1], [o.x1, o.y0, z1]];
    }
  };
  const camx = cam.x, camy = cam.y;
  const vis = { y0: camy < o.y0, y1: camy > o.y1, x0: camx < o.x0, x1: camx > o.x1 };
  for (const f of ['y1', 'x0', 'x1', 'y0']) {
    if (!vis[f]) continue;
    const base = f === 'y0' ? pal.y0 : f === 'y1' ? pal.y1 : pal.x;
    fillPoly(ctx, cam, quad(f, 0, hgt), base, 'rgba(10,6,2,0.55)', 1);
    fillPoly(ctx, cam, quad(f, 0, 0.28), pal.band);                     // boot stripe
    fillPoly(ctx, cam, quad(f, hgt - 0.14, hgt), pal.rail);              // gunwale
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.beginPath();
    const q1 = quad(f, 0.62, 0.62), q2 = quad(f, 0.95, 0.95);
    lineWorld(ctx, cam, q1[0], q1[1]); lineWorld(ctx, cam, q2[0], q2[1]); ctx.stroke();
  }
  fillPoly(ctx, cam, [[o.x0, o.y0, hgt], [o.x1, o.y0, hgt], [o.x1, o.y1, hgt], [o.x0, o.y1, hgt]], pal.top, 'rgba(15,10,5,0.4)', 1);
  const mx = (o.x0 + o.x1) / 2, my = (o.y0 + o.y1) / 2, wx = o.x1 - o.x0, wy = o.y1 - o.y0;
  if (boat) {
    // a small cabin and a mast with a furled sail
    const cx0 = mx - wx * 0.18, cx1 = mx + wx * 0.18, cy0 = my - wy * 0.18, cy1 = my + wy * 0.22, ch = hgt + 0.9;
    const sides = [['y0', [[cx0, cy0, hgt], [cx1, cy0, hgt], [cx1, cy0, ch], [cx0, cy0, ch]], '#b9894f'], ['x1', [[cx1, cy0, hgt], [cx1, cy1, hgt], [cx1, cy1, ch], [cx1, cy0, ch]], '#8f6638'], ['x0', [[cx0, cy0, hgt], [cx0, cy1, hgt], [cx0, cy1, ch], [cx0, cy0, ch]], '#8f6638'], ['y1', [[cx0, cy1, hgt], [cx1, cy1, hgt], [cx1, cy1, ch], [cx0, cy1, ch]], '#6f4d2a']];
    for (const [f, pts, col] of sides) { const v = f === 'y0' ? camy < cy0 : f === 'y1' ? camy > cy1 : f === 'x0' ? camx < cx0 : camx > cx1; if (v) fillPoly(ctx, cam, pts, col, 'rgba(10,6,2,0.5)', 1); }
    fillPoly(ctx, cam, [[cx0 - 0.15, cy0 - 0.15, ch], [cx1 + 0.15, cy0 - 0.15, ch], [cx1 + 0.15, cy1 + 0.15, ch], [cx0 - 0.15, cy1 + 0.15, ch]], '#4a3a2a');
    ctx.strokeStyle = '#2b1f15'; ctx.lineWidth = 2; ctx.beginPath(); lineWorld(ctx, cam, [mx, o.y1 - wy * 0.2, hgt], [mx, o.y1 - wy * 0.2, hgt + 4.2]); ctx.stroke();
    const a = cam.p(mx, o.y1 - wy * 0.2, hgt + 4.2), bb = cam.p(mx, o.y1 - wy * 0.2, hgt + 1.0);
    if (a && bb) { ctx.fillStyle = 'rgba(232,220,190,0.92)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + a[3] * 0.7, bb[1] - 4); ctx.lineTo(a[0], bb[1]); ctx.closePath(); ctx.fill(); }
  } else {
    // stacked crates on a barge
    for (let i = 0; i < 3; i++) {
      const x0 = o.x0 + wx * (0.1 + i * 0.3), x1 = x0 + wx * 0.24, y0 = my - wy * 0.2, y1 = my + wy * 0.2;
      fillPoly(ctx, cam, [[x0, y0, hgt + 0.7], [x1, y0, hgt + 0.7], [x1, y1, hgt + 0.7], [x0, y1, hgt + 0.7]], '#b08a50', 'rgba(10,6,2,0.5)', 1);
      if (camy < y0) fillPoly(ctx, cam, [[x0, y0, hgt], [x1, y0, hgt], [x1, y0, hgt + 0.7], [x0, y0, hgt + 0.7]], '#8a6838', 'rgba(10,6,2,0.5)', 1);
    }
  }
  void t;
}
function drawSledge(ctx, cam, m, clock, t, colorIdx) {
  const p = moverPos(m, clock), bs = cam.p(p.x, p.y, 0.1); if (!bs) return;
  shadowEllipse(ctx, cam, p.x, p.y, m.r, 0.25);
  const k = bs[3], x = bs[0], y = bs[1];
  // runners and seat
  ctx.strokeStyle = '#2b1f15'; ctx.lineWidth = Math.max(1.5, k * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - k * 0.95, y); ctx.lineTo(x + k * 0.95, y); ctx.stroke();
  ctx.fillStyle = '#8a6a3c'; ctx.fillRect(x - k * 0.8, y - k * 0.42, k * 1.6, k * 0.38);
  ctx.fillStyle = '#5b4426'; ctx.fillRect(x - k * 0.8, y - k * 0.1, k * 1.6, k * 0.1);
  // a seated skater in a dark coat
  ctx.fillStyle = BALL_COLORS[(colorIdx + 1) % 4].coat; roundPath(ctx, x - k * 0.3, y - k * 1.15, k * 0.6, k * 0.8, k * 0.12); ctx.fill();
  ctx.fillStyle = '#e1c9a3'; ctx.beginPath(); ctx.arc(x, y - k * 1.3, k * 0.18, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1d12'; ctx.beginPath(); ctx.ellipse(x, y - k * 1.42, k * 0.3, k * 0.07, 0, 0, TAU); ctx.fill(); ctx.fillRect(x - k * 0.15, y - k * 1.6, k * 0.3, k * 0.2);
  void t;
}
// A painted post: bands of cream, ochre and Delft blue, a cap and a pennant that streams with the wind.
function drawPostObj(ctx, cam, post, o = {}) {
  const hgt = o.h ?? 3.4;
  const b = cam.p(post.x, post.y, 0), tp0 = cam.p(post.x, post.y, hgt); if (!b || !tp0) return;
  const ph = Math.max(b[1] - tp0[1], o.flag ? 40 : 0), tp = [tp0[0], b[1] - ph, tp0[2], tp0[3]];
  shadowEllipse(ctx, cam, post.x, post.y, 0.7);
  const w = Math.max(3, b[3] * POST_R * 0.9), wt = Math.max(2.5, tp[3] * POST_R * 0.9);
  const bands = ['#f1e6c8', '#2d5b8c', '#f1e6c8', '#dcab4a', '#f1e6c8', '#2d5b8c', '#f1e6c8'];
  const n = bands.length;
  for (let i = 0; i < n; i++) {
    const y0 = lerp(b[1], tp[1], i / n), y1 = lerp(b[1], tp[1], (i + 1) / n), w0 = lerp(w, wt, i / n), w1 = lerp(wt, wt, 0) + (w - wt) * (1 - (i + 1) / n);
    ctx.fillStyle = bands[i]; ctx.beginPath(); ctx.moveTo(b[0] - w0, y0); ctx.lineTo(b[0] + w0, y0); ctx.lineTo(b[0] + w1, y1); ctx.lineTo(b[0] - w1, y1); ctx.closePath(); ctx.fill();
  }
  const sh = ctx.createLinearGradient(b[0] - w, 0, b[0] + w, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.28)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(20,10,0,0.35)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(b[0] - w, b[1]); ctx.lineTo(b[0] + w, b[1]); ctx.lineTo(tp[0] + wt, tp[1]); ctx.lineTo(tp[0] - wt, tp[1]); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a1d12'; ctx.beginPath(); ctx.arc(tp[0], tp[1], wt * 1.25, 0, TAU); ctx.fill();
  if (o.flag) {
    const wave = Math.sin((o.t || 0) * 5) * 0.12, dir = o.windX >= 0 ? 1 : -1, len = Math.max(14, tp[3] * 1.5);
    const fy = tp[1] - wt * 1.2;
    ctx.fillStyle = '#b8412e'; ctx.beginPath(); ctx.moveTo(tp[0], fy);
    ctx.quadraticCurveTo(tp[0] + dir * len * 0.5, fy - len * (0.15 + wave), tp[0] + dir * len, fy + len * 0.1);
    ctx.quadraticCurveTo(tp[0] + dir * len * 0.5, fy + len * (0.28 - wave), tp[0], fy + len * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tp[0], fy + len * 0.35); ctx.lineTo(tp[0], fy - len * 0.05); ctx.stroke();
  }
}

export function drawBall(ctx, cam, bl, color, o = {}) {
  const vis = o.vis ?? BR * 2.1;
  let x = bl.x, y = bl.y, z = vis * 0.5;
  if (bl.mode === 'thin') { const k = clamp(bl.sink / 0.8, 0, 1); x = bl.sx; y = bl.sy; z = vis * 0.5 - k * 0.7; }
  const p = cam.p(x, y, z); if (!p) return;
  const r = Math.max(o.minPx ?? 5, p[3] * vis);
  const sh = cam.p(x, y, 0);
  if (sh) { ctx.fillStyle = 'rgba(20,24,30,0.34)'; ctx.beginPath(); ctx.ellipse(sh[0] + r * 0.2, sh[1], r * 1.05, r * 0.3, 0, 0, TAU); ctx.fill(); }
  ctx.save();
  if (bl.mode === 'thin') ctx.globalAlpha = clamp(1 - bl.sink / 0.9, 0, 1);
  const g = ctx.createRadialGradient(p[0] - r * 0.35, p[1] - r * 0.4, r * 0.1, p[0], p[1], r);
  g.addColorStop(0, '#fff'); g.addColorStop(0.35, color.base); g.addColorStop(1, color.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.beginPath(); ctx.arc(p[0] - r * 0.55, p[1], r * 0.8, -0.8, 0.8); ctx.stroke();
  ctx.beginPath(); ctx.arc(p[0] + r * 0.55, p[1], r * 0.8, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke();
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], r + 4, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// A presenter may install a 3D person (web/view3d/figure.js: pose(spec, coat) -> canvas, with ppm/feetX/feetY/W/H).
// When it is missing, lost or not yet loaded the painted figure below is used.
export const figure3d = { api: null };
// The 3D court (web/view3d/court3d.js): when present and healthy it renders the whole court scene; otherwise the painted court below is used.
export const court3d = { api: null };
function figureSpec(f) {
  const ph = f.ph || 'idle', u = f.u || 0;
  if (ph === 'back') return { a: 1.3 * clamp(u, 0, 1), b: 0, w: 0 };
  if (ph === 'down') return { a: 1.3 * clamp(f.from || 0, 0, 1), b: 1.8, w: clamp(u, 0, 1) };
  if (ph === 'follow') {
    if (u < 0.3) return { a: 1.8 + 0.4 * (u / 0.3), b: 0, w: 0 };
    const k = clamp((u - 0.5) / 0.7, 0, 1);
    return { a: 2.2, b: 0, w: k * k * (3 - 2 * k) };
  }
  return { a: 0, b: 0, w: 0 };
}
function drawFigure3D(ctx, x, y, u, fig) {
  const api = figure3d.api; if (!api || api.lost) return false;
  const cv = api.pose(figureSpec(fig), fig.color && fig.color.coat);
  if (!cv) return false;
  const s = u / api.ppm;
  ctx.fillStyle = 'rgba(25,20,16,0.3)'; ctx.beginPath(); ctx.ellipse(x + u * 0.15, y, u * 0.55, u * 0.12, 0, 0, TAU); ctx.fill();
  ctx.drawImage(cv, x - api.feetX * s, y - api.feetY * s, api.W * s, api.H * s);
  return true;
}

// ---- the player ------------------------------------------------------------------------------------------------------
// swing: the club angle in radians from straight down (0 = at the ball, negative = back and up on the left, positive = through).
function shadeHex(hex, f) {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
// A tapered limb (a polygon with a muscle belly and round joints) from (ax, ay) to (bx, by), widths in pixels.
function limbPath(ctx, ax, ay, bx, by, w0, w1, bulge = 0) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const wm = (w0 * 0.6 + w1 * 0.4) * (1 + bulge), mx = ax + dx * 0.38, my = ay + dy * 0.38;
  ctx.beginPath();
  ctx.moveTo(ax + nx * w0 / 2, ay + ny * w0 / 2); ctx.lineTo(mx + nx * wm / 2, my + ny * wm / 2); ctx.lineTo(bx + nx * w1 / 2, by + ny * w1 / 2);
  ctx.lineTo(bx - nx * w1 / 2, by - ny * w1 / 2); ctx.lineTo(mx - nx * wm / 2, my - ny * wm / 2); ctx.lineTo(ax - nx * w0 / 2, ay - ny * w0 / 2); ctx.closePath();
  // the round joints must wind the same way as the outline or the 'nonzero' fill leaves holes where they overlap
  const P = [[ax + nx * w0 / 2, ay + ny * w0 / 2], [mx + nx * wm / 2, my + ny * wm / 2], [bx + nx * w1 / 2, by + ny * w1 / 2], [bx - nx * w1 / 2, by - ny * w1 / 2], [mx - nx * wm / 2, my - ny * wm / 2], [ax - nx * w0 / 2, ay - ny * w0 / 2]];
  let area = 0; for (let i = 0; i < 6; i++) { const p = P[i], q = P[(i + 1) % 6]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area < 0;
  ctx.moveTo(ax + w0 / 2, ay); ctx.arc(ax, ay, w0 / 2, 0, TAU, ccw); ctx.moveTo(bx + w1 / 2, by); ctx.arc(bx, by, w1 / 2, 0, TAU, ccw);
}
// The painted player (seen from behind, as the camera does): skates, jointed legs, a belted coat, jointed arms to the club, scarf, head, hat.
// swing: the club angle in radians from straight down (0 = at the ball, negative = back and up on the left, positive = through).
function drawFigure(ctx, x, y, s, color, swing, lean = 0, o = {}) {
  const u = s;   // pixels per metre
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(25,20,16,0.3)'; ctx.beginPath(); ctx.ellipse(u * 0.1, 0, u * 0.5, u * 0.12, 0, 0, TAU); ctx.fill();
  const lx = lean * 0.06;                                  // the upper body leans, the feet stay put
  const fill = (c) => { ctx.fillStyle = c; ctx.fill('nonzero'); };
  const breeches = '#2a1f17', boot = '#17110c', skin = '#c9a07c';
  // skates: a boot and a blade with a curled tip, feet a little apart
  for (const sx of [-1, 1]) {
    const fx = sx * 0.13 * u, ky = -0.5 * u, hxp = sx * (0.1 + 0.02 * lx) * u + lx * 0.4 * u;
    ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = Math.max(1, u * 0.025); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx - 0.1 * u, 0.0); ctx.lineTo(fx + 0.17 * u, 0.0); ctx.quadraticCurveTo(fx + 0.24 * u, 0, fx + 0.23 * u, -0.07 * u); ctx.stroke();
    ctx.fillStyle = boot; ctx.beginPath(); ctx.ellipse(fx + 0.03 * u, -0.07 * u, 0.13 * u, 0.06 * u, 0, 0, TAU); ctx.fill();
    // leg: thigh (hip to knee) then shin (knee to ankle) with a slight knee flex
    const kx = sx * 0.15 * u + lx * 0.2 * u, ankx = fx;
    limbPath(ctx, hxp, -0.95 * u, kx, ky, 0.2 * u, 0.15 * u, 0.06); fill(breeches);
    limbPath(ctx, kx, ky, ankx, -0.1 * u, 0.15 * u, 0.1 * u, 0.12); fill(shadeHex(breeches, 1.15));
    ctx.fillStyle = boot; ctx.beginPath(); ctx.ellipse(ankx, -0.14 * u, 0.085 * u, 0.1 * u, 0, 0, TAU); ctx.fill();
  }
  // coat: yoke at the shoulders, a waist, then it flares at the hem
  const g = ctx.createLinearGradient(-0.35 * u, 0, 0.35 * u, 0);
  g.addColorStop(0, shadeHex(color.coat, 0.85)); g.addColorStop(0.5, color.coat2); g.addColorStop(1, shadeHex(color.coat, 0.8));
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(...[(-0.25 + lx) * u, -1.4 * u]);
  ctx.quadraticCurveTo((-0.29 + lx) * u, -1.25 * u, (-0.2 + lx * 0.6) * u, -1.02 * u);        // shoulder to waist (left)
  ctx.quadraticCurveTo(-0.26 * u, -0.8 * u, -0.33 * u, -0.6 * u);                              // waist to hem
  ctx.lineTo(0.33 * u, -0.6 * u);
  ctx.quadraticCurveTo(0.26 * u, -0.8 * u, (0.2 + lx * 0.6) * u, -1.02 * u);
  ctx.quadraticCurveTo((0.29 + lx) * u, -1.25 * u, (0.25 + lx) * u, -1.4 * u);
  ctx.quadraticCurveTo(lx * u, -1.46 * u, (-0.25 + lx) * u, -1.4 * u);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(15,8,4,0.5)'; ctx.lineWidth = Math.max(1, u * 0.018); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lx * u, -1.4 * u); ctx.quadraticCurveTo((lx * 0.5) * u, -1.0 * u, 0, -0.6 * u); ctx.stroke();   // back seam
  ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.moveTo((-0.2 + lx * 0.6) * u, -1.06 * u); ctx.lineTo((0.2 + lx * 0.6) * u, -1.06 * u); ctx.lineTo((0.205 + lx * 0.6) * u, -0.98 * u); ctx.lineTo((-0.205 + lx * 0.6) * u, -0.98 * u); ctx.closePath(); ctx.fill();   // belt
  // neck and scarf, head (the back of it: hair under the hat), hat
  ctx.fillStyle = '#e8dcc0'; limbPath(ctx, (lx - 0.02) * u, -1.42 * u, lx * u, -1.5 * u, 0.27 * u, 0.2 * u, 0.05); ctx.fill('nonzero');
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(lx * u, -1.6 * u, 0.1 * u, 0.12 * u, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2f2118'; ctx.beginPath(); ctx.ellipse(lx * u, -1.61 * u, 0.1 * u, 0.115 * u, 0, Math.PI * 0.95, TAU + Math.PI * 0.05); ctx.lineTo((lx + 0.1) * u, -1.55 * u); ctx.quadraticCurveTo(lx * u, -1.46 * u, (lx - 0.1) * u, -1.55 * u); ctx.closePath(); ctx.fill();   // hair
  ctx.fillStyle = skin; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse((lx + sx * 0.1) * u, -1.6 * u, 0.02 * u, 0.035 * u, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#1d140d'; ctx.beginPath(); ctx.ellipse(lx * u, -1.67 * u, 0.25 * u, 0.05 * u, 0, 0, TAU); ctx.fill();
  roundPath(ctx, (-0.12 + lx) * u, -1.8 * u, 0.24 * u, 0.15 * u, 0.05 * u); ctx.fill();
  // arms: shoulder -> elbow -> hand, sleeves in the coat colour with a cuff and a mitten
  const hx = (0.34 + lx) * u, hy = -0.9 * u;
  const ang = swing, len = 1.15 * u;
  const dx = Math.sin(ang) * len, dy = Math.cos(ang) * len * 0.82;
  const ex = hx + dx, ey = hy + dy;
  const arm = (sx, handX, handY, elbX, elbY) => {
    const sxp = (sx * 0.24 + lx) * u, syp = -1.36 * u;
    limbPath(ctx, sxp, syp, elbX, elbY, 0.12 * u, 0.1 * u, 0.06); fill(shadeHex(color.coat, sx > 0 ? 0.92 : 0.8));
    limbPath(ctx, elbX, elbY, handX, handY, 0.1 * u, 0.075 * u, 0.1); fill(shadeHex(color.coat, sx > 0 ? 0.98 : 0.86));
    ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.arc(handX, handY, u * 0.05, 0, TAU); ctx.fill();   // mitten
  };
  if (o.noClub) {
    const a2 = o.arm || 0;
    arm(1, (0.3 + lx + a2) * u, -0.9 * u, (0.33 + lx) * u, -1.12 * u);
    arm(-1, (-0.3 + lx - a2) * u, -0.9 * u, (-0.33 + lx) * u, -1.12 * u);
  } else {
    arm(-1, hx - 0.04 * u, hy + 0.03 * u, (-0.18 + lx) * u, -1.1 * u);
    // club shaft from the hands, then the heavy head turned to face the way the club travels
    ctx.strokeStyle = '#6b4a22'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, u * 0.045);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    const nx = Math.cos(ang), ny = -Math.sin(ang);
    ctx.fillStyle = '#2e2a28'; ctx.beginPath();
    ctx.moveTo(ex - nx * 0.05 * u, ey - ny * 0.05 * u); ctx.lineTo(ex + nx * 0.2 * u, ey + ny * 0.2 * u);
    ctx.lineTo(ex + nx * 0.2 * u + Math.sin(ang) * 0.1 * u, ey + ny * 0.2 * u + Math.cos(ang) * 0.08 * u);
    ctx.lineTo(ex - nx * 0.05 * u + Math.sin(ang) * 0.1 * u, ey - ny * 0.05 * u + Math.cos(ang) * 0.08 * u); ctx.closePath(); ctx.fill();
    arm(1, hx, hy, (0.33 + lx) * u, -1.1 * u);
  }
  ctx.restore();
}

// ---- guide, aim and effects ------------------------------------------------------------------------------------------
function drawGuide(ctx, cam, guide, t) {
  if (!guide || !guide.pts || guide.pts.length < 2) return;
  const pts = guide.pts;
  let drawn = 0;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < pts.length; i++) {
    const p = cam.p(pts[i][0], pts[i][1], 0.02); if (!p) continue;
    const k = i / pts.length, r = clamp(p[3] * 0.11, 1.8, 6);
    ctx.globalAlpha = 0.9 - k * 0.45;
    ctx.fillStyle = i % 2 ? '#fff3c4' : '#ffe08a';
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); drawn++;
  }
  const e = cam.p(guide.end.x, guide.end.y, 0.02);
  if (e) {
    const r = clamp(e[3] * 0.7, 7, 26), pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.globalAlpha = 0.85; ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(e[0], e[1], r * (1 + pulse * 0.12), r * 0.36 * (1 + pulse * 0.12), 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  void drawn;
}
export function drawParts(ctx, cam, parts) {
  for (const q of parts) {
    const p = cam.p(q.x, q.y, q.z || 0.15); if (!p) continue;
    const k = q.t / q.max, a = 1 - k;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    if (q.kind === 2) { const r = p[3] * q.size * (0.4 + k * 1.2); ctx.strokeStyle = q.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * 0.34, 0, 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) { const r = clamp(p[3] * 0.12, 2, 7); ctx.translate(p[0], p[1]); ctx.rotate(q.t * (q.spin || 8)); ctx.fillStyle = q.col; ctx.fillRect(-r, -r * 0.5, r * 2, r); }
    else { const r = clamp(p[3] * 0.08 * q.size, 1.5, 7); ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}

function drawPostArrow(ctx, cam, c, rect) {
  // when the post is out of sight to the side, an arrow at the edge points to it
  const q = cam.cs(c.post.x, c.post.y), bearing = Math.atan2(q.X, q.Z), inView = q.Z > 1 && Math.abs(q.X * cam.f / q.Z) < rect.w / 2 - 14;
  if (inView) return;
  const right = Math.sin(bearing) > 0, x = right ? rect.x + rect.w - 30 : rect.x + 30, y = cam.hy + 24;
  ctx.save(); ctx.fillStyle = 'rgba(184,65,46,0.92)'; ctx.strokeStyle = '#f1e6c8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + (right ? 14 : -14), y); ctx.lineTo(x - (right ? 8 : -8), y - 14); ctx.lineTo(x - (right ? 8 : -8), y + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f8edd0'; ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('POST', x, y + 32);
  ctx.restore();
}

// ---- the scene ------------------------------------------------------------------------------------------------------
// S: { court, v:{x,y,yaw,dist}, t, clock, balls:[{ball, color, done, trail, hide}], cur, guide, fig:{ x?, swing, color, show }, parts, wind, showPost }
export function drawScene(ctx, rect, S) {
  const cam = makeCam(rect, S.v);
  const c = S.court;
  const api3 = court3d.api;
  if (!api3 || api3.lost) globalThis.__kolfFigBusy = false;
  if (api3 && !api3.lost && S.balls && S.balls.length) {
    let r = null;
    try { r = api3.render(rect, S, cam, (ctx.getTransform ? ctx.getTransform().a : 1) || 1); } catch (e) { console.warn('kolf 3d failed; using the painted court', e); court3d.api = null; }
    if (r) {
      ctx.save();
      ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      ctx.drawImage(r.canvas, 0, 0, r.w, r.h, rect.x, rect.y, rect.w, rect.h);
      drawPostArrow(ctx, cam, c, rect);
      // a soft warm vignette keeps the eye on the ice
      const vg = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h * 0.5, Math.min(rect.w, rect.h) * 0.45, rect.x + rect.w / 2, rect.y + rect.h * 0.5, Math.max(rect.w, rect.h) * 0.82);
      vg.addColorStop(0, 'rgba(30,16,0,0)'); vg.addColorStop(1, 'rgba(30,16,0,0.3)');
      ctx.fillStyle = vg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
      return cam;
    }
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  drawBackdrop(ctx, cam, c, S.t, rect);
  drawFloor(ctx, cam, c, rect);
  // a bank of snow along both sides, outside the boards
  fillPoly(ctx, cam, [[-4.5, 0, 0], [-0.05, 0, 0], [-0.05, c.L, 0], [-4.5, c.L, 0]], 'rgba(250,247,236,0.7)');
  fillPoly(ctx, cam, [[c.W + 0.05, 0, 0], [c.W + 4.5, 0, 0], [c.W + 4.5, c.L, 0], [c.W + 0.05, c.L, 0]], 'rgba(250,247,236,0.7)');
  drawBoards(ctx, cam, c);
  // ball trails and the guide lie on the ice
  for (const b of S.balls) {
    if (!b.trail || b.trail.length < 2) continue;
    ctx.lineCap = 'round';
    for (let i = 1; i < b.trail.length; i++) {
      const p = cam.p(b.trail[i][0], b.trail[i][1], 0.02), q = cam.p(b.trail[i - 1][0], b.trail[i - 1][1], 0.02); if (!p || !q) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.globalAlpha = (i / b.trail.length) * 0.55; ctx.lineWidth = clamp(p[3] * 0.1, 1, 4);
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (S.guide) drawGuide(ctx, cam, S.guide, S.t);
  // standing things, far to near
  const objs = [];
  for (const o of c.circles) objs.push({ z: cam.cs(o.x, o.y).Z, f: () => drawBollard(ctx, cam, o) });
  for (const o of c.boxes) objs.push({ z: cam.cs((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2).Z, f: () => drawBlock(ctx, cam, o, S.t) });
  for (const m of c.movers) { const p = moverPos(m, S.clock); objs.push({ z: cam.cs(p.x, p.y).Z, f: () => drawSledge(ctx, cam, m, S.clock, S.t, S.cur || 0) }); }
  const wx = c.wind.ax;
  objs.push({ z: cam.cs(c.post.x, c.post.y).Z, f: () => drawPostObj(ctx, cam, c.post, { flag: true, t: S.t, windX: wx, h: 3.6 }) });
  if (cam.cs(c.startPost.x, c.startPost.y).Z > cam.cs(S.v.x, S.v.y).Z + 0.5) objs.push({ z: cam.cs(c.startPost.x, c.startPost.y).Z, f: () => drawPostObj(ctx, cam, c.startPost, { flag: false, h: 2.6 }) });
  S.balls.forEach((b, i) => { if (b.hide) return; objs.push({ z: cam.cs(b.ball.x, b.ball.y).Z - 0.01, f: () => drawBall(ctx, cam, b.ball, b.color, { ring: i === S.cur && S.ring ? 'rgba(255,240,190,0.9)' : null, minPx: i === S.cur ? 6 : 4.5 }) }); });
  if (S.fig && S.fig.show) {
    const fb = S.fig.at || S.balls[S.cur].ball, fx = fb.x + cam.rx * -1.15 - cam.fx * 0.1, fy = fb.y + cam.ry * -1.15 - cam.fy * 0.1;
    objs.push({ z: cam.cs(fx, fy).Z, f: () => { const p = cam.p(fx, fy, 0); if (p && !drawFigure3D(ctx, p[0], p[1], p[3], S.fig)) drawFigure(ctx, p[0], p[1], p[3], S.fig.color, S.fig.swing, S.fig.lean || 0); } });
  }
  for (const sk of skatersFor(c)) { const sy = (sk.y0 + sk.v * S.t) % (c.L + 40) - 20; objs.push({ z: cam.cs(sk.x, sy).Z, f: () => drawSkater(ctx, cam, c, sk, S.t) }); }
  objs.sort((a, b) => b.z - a.z);
  for (const o of objs) o.f();
  drawParts(ctx, cam, S.parts || []);
  drawPostArrow(ctx, cam, c, rect);
  // the warm, soft vignette of an old master
  const vg = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h * 0.45, Math.min(rect.w, rect.h) * 0.35, rect.x + rect.w / 2, rect.y + rect.h * 0.5, Math.max(rect.w, rect.h) * 0.78);
  vg.addColorStop(0, 'rgba(40,20,0,0)'); vg.addColorStop(1, 'rgba(40,20,0,0.34)');
  ctx.fillStyle = vg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(255,196,110,0.06)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  return cam;
}

// A frame like a gilt picture frame around the court view.
export function drawFrame(ctx, rect) {
  ctx.save();
  roundPath(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 14);
  ctx.strokeStyle = 'rgba(201,153,58,0.9)'; ctx.lineWidth = 4; ctx.stroke();
  roundPath(ctx, rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14, 10);
  ctx.strokeStyle = 'rgba(60,35,10,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

// ---- the court map strip -------------------------------------------------------------------------------------------------
export function drawMini(ctx, r, S) {
  const c = S.court;
  plaque(ctx, r.x, r.y, r.w, r.h, { r: 12, studs: false });
  const padX = 14, padY = 8;
  const iw = r.w - padX * 2, ih = r.h - padY * 2;
  const sc = Math.min(iw / c.L, ih / c.W);
  const cw = c.L * sc, ch = c.W * sc, ox = r.x + padX + (iw - cw) / 2, oy = r.y + padY + (ih - ch) / 2;
  const mx = (y) => ox + y * sc, my = (x) => oy + x * sc;
  ctx.save();
  ctx.fillStyle = '#9db9bc'; ctx.fillRect(ox, oy, cw, ch);
  ctx.fillStyle = '#f2eedf'; for (const z of c.snow) ctx.fillRect(mx(z.y0), my(z.x0), (z.y1 - z.y0) * sc, (z.x1 - z.x0) * sc);
  ctx.fillStyle = '#2c4e63'; for (const z of c.thin) ctx.fillRect(mx(z.y0), my(z.x0), (z.y1 - z.y0) * sc, (z.x1 - z.x0) * sc);
  ctx.fillStyle = '#a07a44'; for (const z of c.bridges) ctx.fillRect(mx(z.y0), my(z.x0), (z.y1 - z.y0) * sc, (z.x1 - z.x0) * sc);
  ctx.fillStyle = '#3e2f22'; for (const z of c.boxes) ctx.fillRect(mx(z.y0), my(z.x0), (z.y1 - z.y0) * sc, (z.x1 - z.x0) * sc);
  for (const o of c.circles) { ctx.beginPath(); ctx.arc(mx(o.y), my(o.x), Math.max(2, o.r * sc), 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#c47d12';
  for (const m of c.movers) { const p = moverPos(m, S.clock); ctx.beginPath(); ctx.arc(mx(p.y), my(p.x), Math.max(2.5, m.r * sc), 0, TAU); ctx.fill(); }
  ctx.strokeStyle = C.frame; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, cw, ch);
  // posts
  const post = (p, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx(p.y), my(p.x), 4.2, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 1.5; ctx.stroke(); };
  post(c.startPost, '#f1e6c8'); post(c.post, '#b8412e');
  // the aim line
  if (S.aim && S.aim.show && S.balls[S.cur]) {
    const b = S.balls[S.cur].ball;
    ctx.strokeStyle = 'rgba(255,240,170,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(mx(b.y), my(b.x));
    const len = 30; ctx.lineTo(mx(b.y + Math.cos(S.aim.ang) * len), my(b.x + Math.sin(S.aim.ang) * len)); ctx.stroke(); ctx.setLineDash([]);
  }
  S.balls.forEach((b, i) => { if (b.hide) return; ctx.fillStyle = b.color.base; ctx.beginPath(); ctx.arc(mx(b.ball.y), my(b.ball.x), i === S.cur ? 4.6 : 3.6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 1.5; ctx.stroke(); });
  ctx.restore();
}

// ---- small shared helpers for the screens -----------------------------------------------------------------------------------
export const fitText = (ctx, text, maxW, size, weight = 700, family = FONT) => {
  let px = size; ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > FLOOR) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
  return px;
};
export { SERIF, wrapLines, textShadow, drawButton, onSnow };
