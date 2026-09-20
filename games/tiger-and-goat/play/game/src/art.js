// The table and the board. One light, from the upper left. The pieces live in pieces.js.
import { W, H, project, UNIT } from './layout.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// The table and the board (static: drawn once into a cached layer)
// ---------------------------------------------------------------------------------------------
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

const rect = (U, V0, V1) => [project(-U, V0), project(U, V0), project(U, V1), project(-U, V1)];

// Which points are joined. Diagonals only through points where (i + j) is even.
export function boardSegments() {
  const seg = [];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    if (i < 4) seg.push([i, j, i + 1, j]);
    if (j < 4) seg.push([i, j, i, j + 1]);
    if ((i + j) % 2 === 0) {
      if (i < 4 && j < 4) seg.push([i, j, i + 1, j + 1]);
      if (i > 0 && j < 4) seg.push([i, j, i - 1, j + 1]);
    }
  }
  return seg;
}

// Board woods. teak is the approved original; walnut and ash are cosmetic alternatives (unlocked by wins).
export const WOODS = {
  teak:   { frame: ['#8a5630', '#6a3d1d', '#4a2811'], face: ['#ba8a4a', '#dba55e', '#bf8440'], top: '#f0c079', grain: [96, 52, 18], edge: ['#4a2a12', '#25130a'] },
  walnut: { frame: ['#5a3320', '#41230f', '#2b1508'], face: ['#a8703c', '#8a5a2c', '#6d4520'], top: '#b98552', grain: [58, 30, 12], edge: ['#2f1a0d', '#170b05'] },
  ash:    { frame: ['#a98a62', '#8a6a44', '#6b4f30'], face: ['#f6e4bd', '#e6cc98', '#d2b47a'], top: '#fbeecf', grain: [140, 104, 60], edge: ['#6b4f30', '#3b2a17'] },
};
export const WOOD_NAMES = { teak: 'Teak', walnut: 'Walnut', ash: 'Ash' };

function paintStatic(ctx, wood) {
  const WD = WOODS[wood] ?? WOODS.teak;
  // the table: dark cloth under a warm lamp
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12322f'); bg.addColorStop(0.55, '#0c2426'); bg.addColorStop(1, '#06141a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.022)'; ctx.lineWidth = 1;
  for (let x = -H; x < W; x += 9) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
  const lamp = ctx.createRadialGradient(300, 980, 60, 360, 1040, 820);
  lamp.addColorStop(0, 'rgba(255,205,130,0.20)'); lamp.addColorStop(1, 'rgba(255,205,130,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);

  const outer = rect(2.47, -0.47, 4.47), inner = rect(2.31, -0.31, 4.31);
  // soft shadow of the board on the cloth, thrown down and to the right
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.075)';
    poly(ctx, outer.map((p) => ({ x: p.x + 10 + i * 2.5 + (p.x > 360 ? i * 2 : -i), y: p.y + 30 + i * 4 })));
    ctx.fill();
  }
  // the front edge: the board has thickness
  const TH = 34;
  const front = ctx.createLinearGradient(0, outer[3].y, 0, outer[3].y + TH);
  front.addColorStop(0, WD.edge[0]); front.addColorStop(1, WD.edge[1]);
  ctx.fillStyle = front;
  poly(ctx, [outer[3], outer[2], { x: outer[2].x - 3, y: outer[2].y + TH }, { x: outer[3].x + 3, y: outer[3].y + TH }]);
  ctx.fill();
  // frame: dark walnut
  const fr = ctx.createLinearGradient(outer[0].x, outer[0].y, outer[2].x, outer[2].y);
  fr.addColorStop(0, WD.frame[0]); fr.addColorStop(0.5, WD.frame[1]); fr.addColorStop(1, WD.frame[2]);
  ctx.fillStyle = fr; ctx.lineJoin = 'round';
  poly(ctx, outer); ctx.fill();
  ctx.strokeStyle = fr; ctx.lineWidth = 10; ctx.stroke();
  // bevel on the frame: light catches the top and left edges
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,214,160,0.55)'; ctx.beginPath(); ctx.moveTo(outer[3].x - 4, outer[3].y); ctx.lineTo(outer[0].x - 4, outer[0].y - 4); ctx.lineTo(outer[1].x + 4, outer[1].y - 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,8,0,0.55)'; ctx.beginPath(); ctx.moveTo(outer[1].x + 5, outer[1].y); ctx.lineTo(outer[2].x + 5, outer[2].y + 3); ctx.stroke();

  // the playing surface: honey teak, lit from the upper left
  ctx.save();
  poly(ctx, inner); ctx.clip();
  const su = ctx.createLinearGradient(inner[0].x, inner[0].y, inner[2].x, inner[2].y);
  su.addColorStop(0, WD.top); su.addColorStop(0.5, WD.face[1]); su.addColorStop(1, WD.face[2]);
  ctx.fillStyle = su; ctx.fillRect(0, inner[0].y - 10, W, inner[2].y - inner[0].y + 20);
  // wood grain running away from the player, in perspective
  const rnd = lcg(20260920);
  for (let n = 0; n < 120; n++) {
    const u0 = -2.4 + rnd() * 4.8, f = 0.6 + rnd() * 1.6, ph = rnd() * TAU, amp = 0.012 + rnd() * 0.03, drift = (rnd() - 0.5) * 0.12;
    ctx.strokeStyle = `rgba(${WD.grain[0] + Math.floor(rnd() * 40)},${WD.grain[1]},${WD.grain[2]},${0.05 + rnd() * 0.13})`; ctx.lineWidth = 0.8 + rnd() * 1.8;
    ctx.beginPath();
    for (let k = 0; k <= 26; k++) {
      const v = -0.4 + (k / 26) * 4.8, p = project(u0 + amp * Math.sin(v * f + ph) + drift * (v / 5), v);
      if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (const [ku, kv, kr] of [[-1.5, 3.4, 0.2], [1.45, 0.6, 0.15]]) {       // two knots
    for (let r = 1; r <= 5; r++) {
      ctx.strokeStyle = `rgba(90,46,14,${0.22 - r * 0.03})`; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let a = 0; a <= 24; a++) { const p = project(ku + Math.cos((a / 24) * TAU) * kr * r * 0.28, kv + Math.sin((a / 24) * TAU) * kr * r * 0.5); if (a) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
      ctx.stroke();
    }
  }
  const sheen = ctx.createRadialGradient(200, inner[0].y + 40, 20, 260, inner[0].y + 120, 520);
  sheen.addColorStop(0, 'rgba(255,240,205,0.30)'); sheen.addColorStop(1, 'rgba(255,240,205,0)');
  ctx.fillStyle = sheen; ctx.fillRect(0, inner[0].y - 10, W, 600);
  ctx.restore();
  // inner lip where the surface meets the frame
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,12,2,0.6)'; poly(ctx, inner); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,224,170,0.4)';
  ctx.beginPath(); ctx.moveTo(inner[1].x - 2, inner[1].y + 3); ctx.lineTo(inner[2].x - 3, inner[2].y - 2); ctx.lineTo(inner[3].x + 2, inner[3].y - 2); ctx.stroke();

  // carved lines: a dark groove with a lit lower-right wall
  ctx.lineCap = 'round';
  for (const [i0, j0, i1, j1] of boardSegments()) {
    const a = project(i0 - 2, j0), b = project(i1 - 2, j1), w = 5.2 * UNIT * (a.s + b.s) / 2;
    ctx.strokeStyle = 'rgba(255,232,180,0.55)'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x + 1.4, a.y + 1.6); ctx.lineTo(b.x + 1.4, b.y + 1.6); ctx.stroke();
    ctx.strokeStyle = '#43240e'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(15,5,0,0.55)'; ctx.lineWidth = w * 0.4; ctx.beginPath(); ctx.moveTo(a.x - 0.8, a.y - 0.9); ctx.lineTo(b.x - 0.8, b.y - 0.9); ctx.stroke();
  }
  // brass inlays at the 25 points
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const p = project(i - 2, j), rx = 15 * UNIT * p.s, ry = rx * 0.86;
    ctx.fillStyle = 'rgba(25,10,0,0.6)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx + 2.5, ry + 2.2, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(p.x - rx * 0.4, p.y - ry * 0.5, 1, p.x, p.y, rx);
    g.addColorStop(0, '#fff0b8'); g.addColorStop(0.45, '#d9a842'); g.addColorStop(1, '#8a5e16');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,55,10,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * 0.55, ry * 0.55, 0, 0, TAU); ctx.stroke();
  }
  // brass studs on the frame corners
  for (const [u, v] of [[-2.39, -0.39], [2.39, -0.39], [2.39, 4.39], [-2.39, 4.39]]) {
    const p = project(u, v), r = 6 * UNIT * p.s;
    const g = ctx.createRadialGradient(p.x - r * 0.4, p.y - r * 0.4, 0.5, p.x, p.y, r);
    g.addColorStop(0, '#fff2c0'); g.addColorStop(1, '#8a5e16');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }
}

const layers = {};     // one cached layer per wood, painted the first time it is needed
export function drawTableAndBoard(ctx, wood = 'teak') {
  if (!(wood in layers)) {
    layers[wood] = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(W * 2, H * 2), lctx = c.getContext('2d');
        lctx.scale(2, 2); paintStatic(lctx, wood); layers[wood] = c;
      }
    } catch { layers[wood] = null; }
  }
  if (layers[wood]) ctx.drawImage(layers[wood], 0, 0, W, H); else paintStatic(ctx, wood);
}
