// The view of the sapo table: one fixed camera in TRUE perspective (a pinhole camera, no depth warp), the courtyard, the wooden table,
// the brass frog, the discs and the sparks. All vector drawing every frame (no baked images, so the first frame is instant).
// World units are metres: x across the table, y up from the table top, z from the front edge away from the thrower.
import { HW, TD, A, DISC_H, FROG, HOLES, MOUTH, BOARD_H, HAND } from './phys.js';

export const TAU = Math.PI * 2;
// THE camera. It stands behind the thrower, high enough to see into the table, and never moves, zooms, tilts or shakes: the table, the
// wall and the floor keep the same screen position in every frame. zc = camera position along z, H = eye height above the table top,
// f = focal length in pixels, yh = screen y of the horizon (the principal point row).
export const CAM = { zc: -4.4, H: 2.8, f: 2715, yh: -908, cx: 360 };
export const scaleAt = (z) => CAM.f / (z - CAM.zc);
export function proj(x, y, z) {
  const s = CAM.f / (z - CAM.zc);
  return { x: CAM.cx + x * s, y: CAM.yh + (CAM.H - y) * s, s };
}
// Where a screen point lands on the table plane (y = 0).
export function onTablePlane(sx, sy) { const s = (sy - CAM.yh) / CAM.H, u = CAM.f / s; return { x: (sx - CAM.cx) / s, z: u + CAM.zc }; }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
const quad = (ctx, a, b, c, d) => poly(ctx, [proj(...a), proj(...b), proj(...c), proj(...d)]);
// A circle lying flat at height y, as a projected polygon (a true perspective ellipse).
function flatCircle(cx, y, cz, r, n = 22) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; out.push(proj(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)); }
  return out;
}
const FLOOR_Y = -0.75;

// ---- the courtyard: wall, floor, lamps ---------------------------------------------------------------------------------------
const WALL_Z = 1.45;
export function drawRoom(ctx, t) {
  ctx.fillStyle = '#16100b'; ctx.fillRect(0, 0, 720, 1280);
  const wBot = proj(0, FLOOR_Y, WALL_Z).y;
  // the back wall: warm plaster, a painted lower band, shuttered window frames and a shelf
  let g = ctx.createLinearGradient(0, 0, 0, wBot);
  g.addColorStop(0, '#3a2216'); g.addColorStop(0.5, '#7a4a2c'); g.addColorStop(1, '#9a6a40');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 720, wBot);
  // plaster mottling
  ctx.fillStyle = 'rgba(255,225,170,0.05)';
  for (let i = 0; i < 26; i++) { const x = (i * 97) % 720, y = 80 + ((i * 53) % 420); ctx.beginPath(); ctx.ellipse(x, y, 60 + (i % 5) * 14, 22 + (i % 3) * 8, 0, 0, TAU); ctx.fill(); }
  const bandTop = proj(0, -0.28, WALL_Z).y;
  ctx.fillStyle = '#2f5a52'; ctx.fillRect(0, bandTop, 720, wBot - bandTop);
  ctx.fillStyle = 'rgba(255,230,180,0.2)'; ctx.fillRect(0, bandTop, 720, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, bandTop + 4, 720, 6);
  // a shelf with bottles and a garland of pennants, so the wall is not empty
  const sh = proj(0, 0.06, WALL_Z), sw = sh.s;
  ctx.fillStyle = '#5a3418'; ctx.fillRect(sh.x - sw * 1.7, sh.y, sw * 3.4, 10); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sh.x - sw * 1.7, sh.y + 10, sw * 3.4, 8);
  const cols = ['#2f8f55', '#c5322c', '#d9ae52', '#2f86c9', '#8a3c7a'];
  for (let i = 0; i < 11; i++) { const bx = sh.x - sw * 1.55 + i * sw * 0.31, bh = 38 + (i * 7) % 20, c = cols[i % 5]; ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(bx - 10, sh.y - bh, 20, bh, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(bx - 6, sh.y - bh + 4, 3, bh - 10); ctx.fillStyle = '#e8d9b0'; ctx.fillRect(bx - 4, sh.y - bh - 9, 8, 10); }
  ctx.strokeStyle = 'rgba(20,10,5,0.7)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 12; i++) { const x = i * 60, y = 214 + Math.sin((i / 12) * Math.PI) * 38; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  for (let i = 0; i < 12; i++) { const x = i * 60 + 30, y = 214 + Math.sin(((i + 0.5) / 12) * Math.PI) * 38; ctx.fillStyle = cols[i % 5]; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 30); ctx.closePath(); ctx.fill(); }
  // the floor: dark glazed tiles in perspective
  const fz0 = CAM.zc + 0.05, fz1 = WALL_Z;
  quad(ctx, [-8, FLOOR_Y, fz0], [8, FLOOR_Y, fz0], [8, FLOOR_Y, fz1], [-8, FLOOR_Y, fz1]);
  g = ctx.createLinearGradient(0, wBot, 0, 1280); g.addColorStop(0, '#2a1b13'); g.addColorStop(1, '#4e3324'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
  for (let z = fz1; z > fz0; z -= 0.4) { const p0 = proj(-8, FLOOR_Y, z), p1 = proj(8, FLOOR_Y, z); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  for (let x = -4; x <= 4.01; x += 0.5) { const p0 = proj(x, FLOOR_Y, fz1), p1 = proj(x, FLOOR_Y, fz0 + 0.6); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  // lamp glow over the table (a soft warm pool; a very slight breathing of the light, never a move of anything)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const lp = proj(0, 0.5, 0.45), lr = 380 + Math.sin(t * 1.3) * 6;
  const rg = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, lr); rg.addColorStop(0, 'rgba(255,205,120,0.22)'); rg.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, 720, 1280); ctx.restore();
}

// ---- the table -------------------------------------------------------------------------------------------------------------------
const WOOD = ['#8a5a2e', '#9a6734', '#7e4f27', '#a3733c', '#8d5c2f', '#96652f'];
export function drawTable(ctx, t) {
  const TH = 0.7;   // height of the cabinet
  // contact shadow on the floor
  quad(ctx, [-HW - 0.2, FLOOR_Y, -0.1], [HW + 0.2, FLOOR_Y, -0.1], [HW + 0.3, FLOOR_Y, TD + 0.15], [-HW - 0.3, FLOOR_Y, TD + 0.15]); ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fill();
  // the cabinet front (a painted panel with brass trim and nails) and the two sides
  quad(ctx, [-HW - 0.04, 0, 0], [HW + 0.04, 0, 0], [HW + 0.04, -TH, 0], [-HW - 0.04, -TH, 0]);
  let g = ctx.createLinearGradient(0, proj(0, 0, 0).y, 0, proj(0, -TH, 0).y); g.addColorStop(0, '#2f5a52'); g.addColorStop(1, '#173a34'); ctx.fillStyle = g; ctx.fill();
  const fa = proj(-HW + 0.06, -0.06, 0), fb = proj(HW - 0.06, -0.3, 0);
  ctx.strokeStyle = '#d9ae52'; ctx.lineWidth = 4; ctx.strokeRect(fa.x, fa.y, fb.x - fa.x, fb.y - fa.y);
  ctx.fillStyle = '#d9ae52';
  for (let i = 0; i <= 12; i++) { const p = proj(-HW + 0.06 + (i / 12) * (2 * HW - 0.12), -0.06, 0); ctx.beginPath(); ctx.arc(p.x, p.y + 11, 4, 0, TAU); ctx.fill(); }
  const mid = proj(0, -0.18, 0);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(mid.s * 0.1)}px 'Avenir Next Condensed','Arial Narrow',Arial,sans-serif`; ctx.fillStyle = '#f0cf7a';
  ctx.fillText('S A P O', mid.x, mid.y); ctx.restore();
  // the table top border (a brass-trimmed wooden frame) and the playing surface
  quad(ctx, [-HW - 0.045, 0.012, -0.045], [HW + 0.045, 0.012, -0.045], [HW + 0.045, 0.012, TD + 0.02], [-HW - 0.045, 0.012, TD + 0.02]); ctx.fillStyle = '#5a3418'; ctx.fill();
  const sx = (HW * 2) / 6;
  for (let i = 0; i < 6; i++) {
    quad(ctx, [-HW + i * sx, 0, 0], [-HW + (i + 1) * sx, 0, 0], [-HW + (i + 1) * sx, 0, TD], [-HW + i * sx, 0, TD]);
    ctx.fillStyle = WOOD[i]; ctx.fill();
  }
  // light across the top from the lamps (a soft pool) and the grain
  const c0 = proj(0, 0, TD * 0.55), cr = c0.s * 0.62;
  g = ctx.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, cr * 1.2); g.addColorStop(0, 'rgba(255,225,160,0.34)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.save(); quad(ctx, [-HW, 0, 0], [HW, 0, 0], [HW, 0, TD], [-HW, 0, TD]); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(c0.x - cr * 1.3, c0.y - cr * 1.3, cr * 2.6, cr * 2.6); ctx.restore();
  ctx.strokeStyle = 'rgba(40,20,8,0.45)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 6; i++) { const a = proj(-HW + i * sx, 0, 0), b = proj(-HW + i * sx, 0, TD); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,230,170,0.10)';
  for (let i = 0; i < 18; i++) { const x = -HW + 0.04 + (i * 0.173 % 1) * (2 * HW - 0.08), z0 = (i * 0.37 % 0.7), a = proj(x, 0, z0), b = proj(x + 0.01, 0, z0 + 0.12 + (i % 3) * 0.06); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // brass edge strip on the front lip
  quad(ctx, [-HW - 0.045, 0.012, -0.045], [HW + 0.045, 0.012, -0.045], [HW + 0.045, -0.012, -0.045], [-HW - 0.045, -0.012, -0.045]); ctx.fillStyle = '#d9ae52'; ctx.fill();
  // the back board: a painted panel (the "old woman" board of a classic table is left out; this one carries a garland of stars)
  quad(ctx, [-HW - 0.045, 0, TD], [HW + 0.045, 0, TD], [HW + 0.045, BOARD_H, TD], [-HW - 0.045, BOARD_H, TD]);
  g = ctx.createLinearGradient(0, proj(0, BOARD_H, TD).y, 0, proj(0, 0, TD).y); g.addColorStop(0, '#2f5a52'); g.addColorStop(1, '#1d3f39'); ctx.fillStyle = g; ctx.fill();
  quad(ctx, [-HW - 0.045, BOARD_H, TD], [HW + 0.045, BOARD_H, TD], [HW + 0.045, BOARD_H - 0.022, TD], [-HW - 0.045, BOARD_H - 0.022, TD]); ctx.fillStyle = '#d9ae52'; ctx.fill();
  for (let i = 0; i < 9; i++) { const p = proj(-HW + 0.06 + i * ((2 * HW - 0.12) / 8), 0.19, TD); star(ctx, p.x, p.y, p.s * 0.03, i % 2 ? '#e8c565' : '#f4e2a8'); }
  // side rails of the board
  for (const sd of [-1, 1]) { quad(ctx, [sd * (HW + 0.045), 0, TD], [sd * (HW + 0.045), BOARD_H, TD], [sd * (HW + 0.045), BOARD_H, TD - 0.03], [sd * (HW + 0.045), 0, TD - 0.03]); ctx.fillStyle = '#b88d3c'; ctx.fill(); }
}
function star(ctx, x, y, r, col) {
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

// Holes: dark openings with a brass rim, and the painted score beside each one.
const HOLE_TAG = { mouth: false, mill: true, bridgeL: true, bridgeR: true, sideL: true, sideR: true, cornerL: true, cornerR: true };
export function drawHoles(ctx, S, t = 0) {
  drawMill(ctx, t);
  const flash = S && S.holeFlash ? S.holeFlash : {};
  for (const h of HOLES) {
    const rimOut = flatCircle(h.x, 0.001, h.z, h.R + 0.016), mouth = flatCircle(h.x, 0.001, h.z, h.R);
    poly(ctx, rimOut); ctx.fillStyle = '#d9ae52'; ctx.fill();
    poly(ctx, mouth); const c = proj(h.x, 0, h.z), g = ctx.createRadialGradient(c.x, c.y - c.s * 0.01, 0, c.x, c.y, h.R * c.s * 1.1); g.addColorStop(0, '#000'); g.addColorStop(1, '#2a1608'); ctx.fillStyle = g; ctx.fill();
    // the wall of the hole: a darker crescent on the far side (depth)
    const lo = flatCircle(h.x, -0.05, h.z + 0.012, h.R * 0.8, 18); ctx.save(); poly(ctx, mouth); ctx.clip(); poly(ctx, lo); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    const f = flash[h.id];
    if (f && f > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; poly(ctx, flatCircle(h.x, 0.002, h.z, h.R + 0.02 + (1 - f) * 0.07)); ctx.strokeStyle = `rgba(255,230,140,${f})`; ctx.lineWidth = 5 * f + 1; ctx.stroke(); ctx.restore(); }
  }
  // painted value tags on the table, flattened by the perspective
  for (const h of HOLES) {
    if (!HOLE_TAG[h.id]) continue;
    const p = proj(h.x, 0, h.z - h.R - 0.052), q = proj(h.x, 0, h.z - h.R - 0.012), vs = Math.abs(q.y - p.y) / 0.04 / p.s * 1.0;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, clamp(vs, 0.35, 0.7)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(p.s * 0.058)}px 'Avenir Next Condensed','Arial Narrow',Arial,sans-serif`; ctx.fillStyle = 'rgba(255,238,190,0.92)'; ctx.fillText(String(h.v), 0, 0); ctx.restore();
  }
  // the 500 painted in front of the frog's mouth
  const p = proj(0, 0, MOUTH.z - MOUTH.R - 0.06);
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.52); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(p.s * 0.075)}px 'Avenir Next Condensed','Arial Narrow',Arial,sans-serif`; ctx.fillStyle = '#ffd36a'; ctx.fillText('500', 0, 0); ctx.restore();
}

// ---- the frog, the mill and the bridges (drawn in depth order with the discs) -------------------------------------------------
function sphere(ctx, x, y, z, r, c0, c1, c2) {
  const p = proj(x, y, z), rr = r * p.s;
  const g = ctx.createRadialGradient(p.x - rr * 0.35, p.y - rr * 0.4, rr * 0.08, p.x, p.y, rr);
  g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
  ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fillStyle = g; ctx.fill();
  return p;
}
export function drawFrog(ctx, t, S) {
  const gl = S && S.holeFlash && S.holeFlash.mouth ? S.holeFlash.mouth : 0;
  // feet and front legs
  for (const sd of [-1, 1]) {
    const p = proj(sd * 0.1, 0.012, FROG.z - 0.09), q = proj(sd * 0.085, 0.012, FROG.z - 0.125);
    ctx.beginPath(); ctx.ellipse(q.x, q.y - 2, p.s * 0.055, p.s * 0.02, 0, 0, TAU); ctx.fillStyle = '#9a6f1d'; ctx.fill();
    sphere(ctx, sd * 0.1, 0.05, FROG.z - 0.06, 0.05, '#f6e19a', '#d1a136', '#7c5513');
  }
  // body, belly highlight, back legs
  sphere(ctx, -0.095, 0.05, FROG.z + 0.02, 0.07, '#f2d78c', '#c0922d', '#6e4a10');
  sphere(ctx, 0.095, 0.05, FROG.z + 0.02, 0.07, '#f2d78c', '#c0922d', '#6e4a10');
  const b = sphere(ctx, 0, 0.1, FROG.z, FROG.r * 1.05, '#fff0bd', '#d9ae52', '#6b470f');
  // the mouth: a wide dark slit across the front of the head, the tongue and the rim over the hole
  const m0 = proj(-0.085, 0.07, FROG.z - 0.105), m1 = proj(0.085, 0.07, FROG.z - 0.105), mm = proj(0, 0.035, FROG.z - 0.12);
  ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.quadraticCurveTo(mm.x, mm.y + b.s * 0.05, m1.x, m1.y); ctx.lineWidth = Math.max(3, b.s * 0.016); ctx.strokeStyle = '#3b2509'; ctx.stroke();
  const tg = proj(0, 0.012, MOUTH.z + 0.07);
  ctx.beginPath(); ctx.ellipse(tg.x, tg.y, b.s * 0.032, b.s * 0.012, 0, 0, TAU); ctx.fillStyle = '#c5322c'; ctx.fill();
  // eyes on top
  for (const sd of [-1, 1]) {
    const e = sphere(ctx, sd * 0.062, 0.21, FROG.z - 0.03, 0.04, '#fff7de', '#e7cf86', '#8e6a1c');
    ctx.beginPath(); ctx.arc(e.x + sd * e.s * 0.006, e.y + e.s * 0.006, e.s * 0.017, 0, TAU); ctx.fillStyle = '#1b1109'; ctx.fill();
    ctx.beginPath(); ctx.arc(e.x - e.s * 0.008, e.y - e.s * 0.006, e.s * 0.006, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  }
  if (gl > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.s * 0.3); rg.addColorStop(0, `rgba(255,230,140,${0.28 * gl})`); rg.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(b.x, b.y, b.s * 0.3, 0, TAU); ctx.fill(); ctx.restore(); }
}
export function drawMill(ctx, t) {
  // the "molino": a flat pinwheel painted around the mill hole, slowly turning (the disc rolls over it; it never blocks one)
  const h = HOLES[1], tt = t * 0.9;
  for (let i = 0; i < 4; i++) {
    const a = tt + (i * Math.PI) / 2, pts = [];
    for (const [r, da] of [[h.R + 0.012, 0], [h.R + 0.07, 0.18], [h.R + 0.07, 0.62], [h.R + 0.012, 0.55]]) pts.push(proj(h.x + Math.cos(a + da) * r, 0.002, h.z + Math.sin(a + da) * r));
    poly(ctx, pts); ctx.fillStyle = i % 2 ? '#d9ae52' : '#c5322c'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(30,15,5,0.6)'; ctx.stroke();
  }
}
export function drawBridge(ctx, h) {
  // a low brass arch over the front of the hole
  const hz = h.z - h.R - 0.03, hh = 0.075;
  const a0 = proj(h.x - h.R, 0, hz), b0 = proj(h.x - h.R, hh, hz), a1 = proj(h.x + h.R, 0, hz), b1 = proj(h.x + h.R, hh, hz), top = proj(h.x, hh + 0.04, hz);
  ctx.strokeStyle = '#d9ae52'; ctx.lineWidth = Math.max(4, a0.s * 0.012); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y); ctx.quadraticCurveTo(top.x, top.y - a0.s * 0.006, b1.x, b1.y); ctx.lineTo(a1.x, a1.y); ctx.stroke(); ctx.lineCap = 'butt';
}

// ---- discs -----------------------------------------------------------------------------------------------------------------------
export const DISC_COL = [
  { top0: '#fff0b8', top1: '#e2b14a', top2: '#8f6414', side: '#7a5410', ring: '#2f8f55', edge: '#5b3d0a' },
  { top0: '#ffffff', top1: '#c8d0d6', top2: '#7d8892', side: '#69727b', ring: '#c5322c', edge: '#454d55' },
];
export function drawDisc(ctx, d, x, y, z, o = {}) {
  const col = DISC_COL[d.owner === 1 ? 1 : 0];
  const R = A * (o.scale ?? 1);
  const top = flatCircle(x, y + DISC_H, z, R, 20), bot = flatCircle(x, y, z, R, 20);
  const c = proj(x, y + DISC_H, z);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  // side band: the lower ellipse, then the top face
  poly(ctx, bot); ctx.fillStyle = col.side; ctx.fill();
  const s0 = proj(x, y + DISC_H, z).y - proj(x, y, z).y;
  // join between the rims (the visible part of the edge)
  ctx.beginPath(); top.forEach((p, i) => { const q = bot[i]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y); ctx.closePath(); ctx.fillStyle = col.side; ctx.fill();
  void s0;
  poly(ctx, top);
  const rx = A * c.s;
  const g = ctx.createRadialGradient(c.x - rx * 0.35, c.y - rx * 0.25, rx * 0.08, c.x, c.y, rx * 1.05); g.addColorStop(0, col.top0); g.addColorStop(0.5, col.top1); g.addColorStop(1, col.top2);
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = col.edge; ctx.stroke();
  // the stamped ring and the notches, turning with the disc
  poly(ctx, flatCircle(x, y + DISC_H + 0.0005, z, R * 0.66, 18)); ctx.lineWidth = Math.max(2, rx * 0.12); ctx.strokeStyle = col.ring; ctx.globalAlpha = (o.alpha ?? 1) * 0.9; ctx.stroke(); ctx.globalAlpha = o.alpha ?? 1;
  ctx.strokeStyle = 'rgba(60,35,5,0.55)'; ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) { const a = (d.ang ?? 0) + (k * TAU) / 3, p0 = proj(x + Math.cos(a) * R * 0.18, y + DISC_H + 0.001, z + Math.sin(a) * R * 0.18), p1 = proj(x + Math.cos(a) * R * 0.52, y + DISC_H + 0.001, z + Math.sin(a) * R * 0.52); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  // the glint
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1.5, rx * 0.08); ctx.beginPath();
  for (let i = 0; i <= 5; i++) { const a = Math.PI * (1.12 + i * 0.1), p = proj(x + Math.cos(a) * R * 0.86, y + DISC_H, z + Math.sin(a) * R * 0.86); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
  ctx.restore();
}
export function drawShadow(ctx, x, y, z, a = 1) {
  const sh = flatCircle(x, 0.0008, z, A * (1 + Math.min(0.5, y)), 16);
  poly(ctx, sh); ctx.fillStyle = `rgba(10,4,0,${0.38 * a})`; ctx.fill();
}

// The interpolated pose of a disc between its previous and its current physics step.
export function pose(d, a) {
  if (d.st === 'rest' || d.st === 'out' && d.y <= -0.74) return { x: d.x, y: d.y, z: d.z, ang: d.ang };
  return { x: d.px + (d.x - d.px) * a, y: d.py + (d.y - d.py) * a, z: d.pz + (d.z - d.pz) * a, ang: (d.pang ?? d.ang) + (d.ang - (d.pang ?? d.ang)) * a };
}

// Everything that stands on the table, far to near: the frog, the mill, the bridges and every disc.
export function drawActors(ctx, t, discs, alpha, S, o = {}) {
  const items = [];
  items.push({ z: FROG.z, f: () => drawFrog(ctx, t, S) });
  
  items.push({ z: HOLES[2].z - 0.08, f: () => drawBridge(ctx, HOLES[2]) }); items.push({ z: HOLES[3].z - 0.08, f: () => drawBridge(ctx, HOLES[3]) });
  for (const d of discs) {
    if (d.st === 'out' && d.y <= -0.74) continue;
    const p = pose(d, d.st === 'fly' || d.st === 'slide' ? alpha : 1);
    if (d.st === 'in') {
      const k = clamp((S && S.simT !== undefined ? S.simT - d.tin : 0.5) / 0.28, 0, 1);
      if (k >= 1) continue;
      items.push({ z: p.z, f: () => { const h = HOLES.find((q) => q.id === d.hole); ctx.save(); poly(ctx, flatCircle(h.x, 0, h.z, h.R)); ctx.clip(); drawDisc(ctx, d, h.x, -0.11 * k, h.z, { alpha: 1 - k * 0.7 }); ctx.restore(); } });
      continue;
    }
    items.push({ z: p.z + (p.y > 0.04 ? 0.0 : 0), f: () => {
      if (d.st !== 'out') drawShadow(ctx, p.x, p.y, p.z, clamp(1 - p.y / 0.9, 0.15, 1));
      const hl = o.hl && o.hl.has(d.id);
      if (hl) { poly(ctx, flatCircle(p.x, 0.003, p.z, A * 1.55, 20)); ctx.strokeStyle = o.hlCol ?? '#7dffa0'; ctx.lineWidth = 4; ctx.stroke(); }
      drawDisc(ctx, { ...d, ang: p.ang }, p.x, Math.max(p.y, d.st === 'out' ? -0.74 : 0), p.z);
    } });
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.f();
}

// ---- aim overlay ---------------------------------------------------------------------------------------------------------------
export function drawRing(ctx, x, z, col, t, label) {
  ctx.save();
  const pts = flatCircle(x, 0.004, z, A * 1.5, 26);
  poly(ctx, pts); ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 14; ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]);
  const c = proj(x, 0.004, z); ctx.beginPath(); ctx.arc(c.x, c.y, 3.5, 0, TAU); ctx.fillStyle = col; ctx.fill();
  if (label) { ctx.font = `700 20px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(label, c.x, c.y - c.s * 0.12 - 8); }
  ctx.restore();
}
export function drawArc(ctx, pts, col, t, wd = 4) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash([2, 10]); ctx.lineCap = 'round'; ctx.lineDashOffset = -t * 30;
  ctx.beginPath(); let started = false;
  for (const q of pts) { const p = proj(q.x, Math.max(q.y, 0), q.z); if (p.y > 1240) continue; if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); }
  ctx.stroke(); ctx.restore();
}
export function drawRestMark(ctx, x, z, col) {
  const c = proj(x, 0.004, z), r = Math.max(6, A * c.s * 0.35);
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x - r, c.y); ctx.lineTo(c.x + r, c.y); ctx.moveTo(c.x, c.y - r * 0.6); ctx.lineTo(c.x, c.y + r * 0.6); ctx.stroke(); ctx.restore();
}

// ---- sparks and floating scores (screen-localised, never a move of the table) ---------------------------------------------------
export function drawParts(ctx, parts) {
  for (const p of parts) {
    const k = 1 - p.t / p.max, c = proj(p.x, p.y, p.z);
    if (p.k === 'spark') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const c2 = proj(p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.z - p.vz * 0.03);
      ctx.strokeStyle = `rgba(255,${200 + Math.round(k * 40)},${100 + Math.round(k * 60)},${k})`; ctx.lineWidth = Math.max(1.5, p.size * c.s * 0.5); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c2.x, c2.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.restore();
    } else if (p.k === 'dust') {
      ctx.save(); ctx.globalAlpha = k * 0.5; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(c.x, c.y, p.size * c.s * (1.5 - k * 0.6), 0, TAU); ctx.fill(); ctx.restore();
    } else if (p.k === 'ring') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; poly(ctx, flatCircle(p.x, p.y, p.z, p.size * (1 + (1 - k) * 2.2), 22)); ctx.strokeStyle = `rgba(255,${p.g ?? 225},140,${k})`; ctx.lineWidth = 4 * k + 1; ctx.stroke(); ctx.restore();
    } else if (p.k === 'text') {
      const e = Math.min(1, p.t / 0.18), up = p.t * 0.16;
      const q = proj(p.x, p.y + up, p.z);
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 2.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sz = Math.round(p.size * (0.7 + 0.3 * Math.min(1, e * 1.4)));
      ctx.font = `800 ${sz}px 'Avenir Next Condensed','Arial Narrow',Arial,sans-serif`; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(30,12,2,0.9)'; ctx.strokeText(p.text, q.x, q.y);
      ctx.fillStyle = p.col ?? '#ffe08a'; ctx.fillText(p.text, q.x, q.y); ctx.restore();
    }
  }
}
export { flatCircle, poly, clamp, lerp };
