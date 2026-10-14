// All the pictures: the room, the lacquered table, the brass coin puck and the two paddles. Pure drawing in world units
// (origin at the table centre). The still part of the table is painted once into an off-screen canvas when the page hands
// over a canvas factory (main.js); tests and the first frame draw it directly.
import { HW, HH, GOAL_HW, R_PUCK, R_PAD, R_POST, CORNER, POCKET } from './sim.js';

const TAU = Math.PI * 2;
export const FRAME = 56, FRAME_END = 72;
export const OW = HW + FRAME, OH = HH + FRAME_END;

let factory = null;
export const setCanvasFactory = (f) => { factory = f; };
export const makeCanvas = (w, h) => (factory ? factory(w, h) : null);

// the two sides: lacquer poppy red and deep teal
export const SIDE = [
  { body: ['#ff7a5a', '#d63f28', '#7c1a10'], knob: ['#fff4dc', '#f0c98a', '#b07a3a'], ring: '#fff0d0', glow: '#ff9a7a', name: '#ff8a6a' },
  { body: ['#46c2b2', '#1f8479', '#0c4a45'], knob: ['#f4fff6', '#bfe8d6', '#5aa08e'], ring: '#d8fff2', glow: '#7ae0cc', name: '#5ed3c0' },
];

const hash = (n) => { let h = (n * 374761393 + 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- the room (floor and lamp light) ------------------------------------------------------------------------------
export function drawRoom(ctx, W, H, cx, cy, reach) {
  ctx.fillStyle = '#1a0d08'; ctx.fillRect(0, 0, W, H);
  const T = 74;
  for (let j = 0; j * T < H + T; j++) for (let i = 0; i * T < W + T; i++) {
    if ((i + j) & 1) { ctx.fillStyle = 'rgba(255,170,90,0.045)'; ctx.fillRect(i * T, j * T, T, T); }
  }
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, reach);
  g.addColorStop(0, 'rgba(255,196,120,0.38)'); g.addColorStop(0.55, 'rgba(255,150,70,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,0,0.62)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---- the still table ----------------------------------------------------------------------------------------------
function tulip(ctx, x, y, s, col, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.strokeStyle = '#2f7a55'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 22); ctx.quadraticCurveTo(2, 8, 0, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, 16); ctx.quadraticCurveTo(14, 12, 16, 2); ctx.quadraticCurveTo(8, 6, 1, 12); ctx.fillStyle = '#3c9a6c'; ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-11, -12); ctx.quadraticCurveTo(-12, 2, 0, 3); ctx.quadraticCurveTo(12, 2, 11, -12); ctx.quadraticCurveTo(6, -6, 0, -16); ctx.quadraticCurveTo(-6, -6, -11, -12); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-3, -6, 2.5, 6, 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

function rosette(ctx, r) {
  const petal = (len, wid, col, rot) => {
    ctx.save(); ctx.rotate(rot); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(wid, len * 0.45, 0, len); ctx.quadraticCurveTo(-wid, len * 0.45, 0, 0); ctx.fill(); ctx.restore();
  };
  for (let i = 0; i < 8; i++) petal(r * 0.9, r * 0.2, 'rgba(214,63,40,0.78)', (i / 8) * TAU);
  for (let i = 0; i < 8; i++) petal(r * 0.62, r * 0.12, 'rgba(31,122,120,0.85)', ((i + 0.5) / 8) * TAU);
  ctx.fillStyle = '#e9b74a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 2; ctx.stroke();
}

const SHADOW_M = 64;      // margin of the cached bitmap that holds the table's soft shadow on the floor
export function paintTable(ctx) {
  // soft shadow on the floor
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 38; ctx.shadowOffsetY = 18;
  rr(ctx, -OW + 6, -OH + 6, OW * 2 - 12, OH * 2 - 12, 100); ctx.fillStyle = '#2a140a'; ctx.fill(); ctx.restore();
  // wooden frame
  rr(ctx, -OW, -OH, OW * 2, OH * 2, 104);
  let g = ctx.createLinearGradient(-OW, 0, OW, 0);
  g.addColorStop(0, '#41200f'); g.addColorStop(0.2, '#74401f'); g.addColorStop(0.5, '#8d5226'); g.addColorStop(0.8, '#74401f'); g.addColorStop(1, '#3a1c0d');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, -OW, -OH, OW * 2, OH * 2, 104); ctx.clip();
  for (let i = 0; i < 90; i++) {
    const x = -OW + hash(i) * OW * 2, w = 0.8 + hash(i + 500) * 2.2;
    ctx.strokeStyle = hash(i + 900) > 0.5 ? 'rgba(30,10,2,0.20)' : 'rgba(255,200,130,0.10)'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, -OH);
    for (let k = 1; k <= 8; k++) ctx.lineTo(x + Math.sin(k * 0.9 + i) * 5, -OH + (k / 8) * OH * 2);
    ctx.stroke();
  }
  ctx.restore();
  rr(ctx, -OW + 3, -OH + 3, OW * 2 - 6, OH * 2 - 6, 102); ctx.lineWidth = 4;
  g = ctx.createLinearGradient(-OW, -OH, OW, OH); g.addColorStop(0, 'rgba(255,225,180,0.5)'); g.addColorStop(0.5, 'rgba(255,225,180,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.strokeStyle = g; ctx.stroke();
  // brass inlay
  rr(ctx, -(HW + 34), -(HH + 34), (HW + 34) * 2, (HH + 34) * 2, CORNER + 34);
  ctx.strokeStyle = '#d9a73a'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,5,0.5)'; ctx.lineWidth = 1; rr(ctx, -(HW + 37), -(HH + 37), (HW + 37) * 2, (HH + 37) * 2, CORNER + 37); ctx.stroke();
  // lacquered rail
  const RW = HW + 22, RH = HH + 22;
  rr(ctx, -RW, -RH, RW * 2, RH * 2, CORNER + 22);
  g = ctx.createLinearGradient(-RW, -RH, RW, RH); g.addColorStop(0, '#f0553a'); g.addColorStop(0.5, '#c32f1d'); g.addColorStop(1, '#7c160c');
  ctx.fillStyle = g; ctx.fill();
  rr(ctx, -RW + 2, -RH + 2, RW * 2 - 4, RH * 2 - 4, CORNER + 20); ctx.lineWidth = 3;
  g = ctx.createLinearGradient(-RW, -RH, RW, RH); g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.strokeStyle = g; ctx.stroke();
  // the playing surface
  rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER);
  g = ctx.createRadialGradient(-40, -60, 30, 0, 0, 520);
  g.addColorStop(0, '#fffdf3'); g.addColorStop(0.55, '#fbf0d2'); g.addColorStop(1, '#e8d3a0');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER); ctx.clip();
  for (const [lw, a] of [[34, 0.14], [18, 0.16], [8, 0.2]]) { ctx.lineWidth = lw; ctx.strokeStyle = `rgba(110,55,15,${a})`; rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER); ctx.stroke(); }
  // air holes
  ctx.fillStyle = 'rgba(120,80,40,0.24)';
  for (let y = -HH + 20; y < HH; y += 24) for (let x = -HW + 20; x < HW; x += 24) { ctx.beginPath(); ctx.arc(x, y, 1.7, 0, TAU); ctx.fill(); }
  // folk motifs
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { tulip(ctx, sx * 148, sy * 292, 1.15, sy < 0 ? '#1f8479' : '#d63f28', 0.55); tulip(ctx, sx * 60, sy * 330, 0.8, sy < 0 ? '#d63f28' : '#1f8479', 0.45); }
  // markings
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(200,45,30,0.85)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-HW + 8, 0); ctx.lineTo(-86, 0); ctx.moveTo(86, 0); ctx.lineTo(HW - 8, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(31,122,120,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 84, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(233,183,74,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 76, 0, TAU); ctx.stroke();
  rosette(ctx, 70);
  for (const e of [-1, 1]) {
    ctx.strokeStyle = 'rgba(31,122,120,0.85)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, e * HH, 128, e > 0 ? Math.PI : 0, e > 0 ? TAU : Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(214,63,40,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, e * 170, 30, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(214,63,40,0.55)'; ctx.beginPath(); ctx.arc(0, e * 170, 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // goal pockets
  for (const e of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-GOAL_HW, e * HH); ctx.lineTo(-GOAL_HW + 7, e * (HH + POCKET)); ctx.lineTo(GOAL_HW - 7, e * (HH + POCKET)); ctx.lineTo(GOAL_HW, e * HH); ctx.closePath();
    g = ctx.createLinearGradient(0, e * HH, 0, e * (HH + POCKET)); g.addColorStop(0, '#2a120a'); g.addColorStop(1, '#050201');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(233,183,74,0.20)'; ctx.lineWidth = 1.5;
    for (let k = -GOAL_HW - POCKET; k < GOAL_HW + POCKET; k += 14) { ctx.beginPath(); ctx.moveTo(k, e * HH); ctx.lineTo(k + POCKET, e * (HH + POCKET)); ctx.moveTo(k + POCKET, e * HH); ctx.lineTo(k, e * (HH + POCKET)); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#d9a73a'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-GOAL_HW, e * HH); ctx.lineTo(-GOAL_HW + 7, e * (HH + POCKET)); ctx.lineTo(GOAL_HW - 7, e * (HH + POCKET)); ctx.lineTo(GOAL_HW, e * HH); ctx.stroke();
    for (const px of [-GOAL_HW, GOAL_HW]) {
      const pg = ctx.createRadialGradient(px - 2.5, e * HH - 2.5, 1, px, e * HH, R_POST + 2);
      pg.addColorStop(0, '#fff3b8'); pg.addColorStop(0.5, '#e0aa38'); pg.addColorStop(1, '#7a4f0a');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, e * HH, R_POST + 1, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  // brass corner studs
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * (OW - 30), y = sy * (OH - 30);
    const sg = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 12);
    sg.addColorStop(0, '#fff3b8'); sg.addColorStop(0.5, '#e0aa38'); sg.addColorStop(1, '#6e460a');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,0,0.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.stroke();
  }
  // a small brass plate on each long side
  for (const sx of [-1, 1]) {
    const x = sx * (HW + 44);
    ctx.save(); ctx.translate(x, 0); ctx.rotate(sx * Math.PI / 2);
    rr(ctx, -62, -9, 124, 18, 9); const pg = ctx.createLinearGradient(0, -9, 0, 9); pg.addColorStop(0, '#f3cf70'); pg.addColorStop(1, '#a8761c'); ctx.fillStyle = pg; ctx.fill();
    ctx.fillStyle = '#4a2a06'; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CYMBERGAJ', 0, 1);
    ctx.restore();
  }
}

// The still table as a cached bitmap when the page provided a canvas factory.
const cache = [];
export function drawTableStill(ctx, pxScale) {
  const q = Math.max(0.5, Math.round(pxScale * 4) / 4);
  const pw = Math.ceil((OW + SHADOW_M) * 2 * q), ph = Math.ceil((OH + SHADOW_M) * 2 * q);
  if (factory && pxScale > 0 && pw * ph < 12e6) {
    let c = cache.find((e) => e.q === q);
    if (!c) {
      const canvas = factory(pw, ph);
      if (canvas) {
        const g = canvas.getContext('2d');
        g.setTransform(q, 0, 0, q, pw / 2, ph / 2);
        paintTable(g);
        c = { q, canvas }; cache.unshift(c); if (cache.length > 3) cache.pop();
      }
    }
    if (c) { ctx.drawImage(c.canvas, -OW - SHADOW_M, -OH - SHADOW_M, (OW + SHADOW_M) * 2, (OH + SHADOW_M) * 2); return; }
  }
  paintTable(ctx);
}

// ---- things that move ---------------------------------------------------------------------------------------------
// The air holes near the puck and the paddles glow while the air flows (the cushion the puck rides on).
export function drawAirDots(ctx, objs) {
  const GX = -HW + 20, GY = -HH + 20, S = 24;
  ctx.save();
  for (const o of objs) {
    const r = o.r;
    const i0 = Math.max(0, Math.ceil((o.x - r - GX) / S)), i1 = Math.floor((o.x + r - GX) / S);
    const j0 = Math.max(0, Math.ceil((o.y - r - GY) / S)), j1 = Math.floor((o.y + r - GY) / S);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = GX + i * S, y = GY + j * S;
      if (x > HW - 4 || y > HH - 4) continue;
      const d = Math.hypot(x - o.x, y - o.y);
      if (d > r) continue;
      const k = 1 - d / r;
      ctx.fillStyle = `rgba(60,200,215,${(0.12 + 0.62 * k * k) * (o.a ?? 1)})`;
      ctx.beginPath(); ctx.arc(x, y, 1.6 + 2.2 * k, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawShadow(ctx, x, y, r, k = 1) {
  const g = ctx.createRadialGradient(x + 5 * k, y + 8 * k, r * 0.35, x + 5 * k, y + 8 * k, r * 1.22);
  g.addColorStop(0, 'rgba(50,20,4,0.42)'); g.addColorStop(1, 'rgba(50,20,4,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 5 * k, y + 8 * k, r * 1.25, 0, TAU); ctx.fill();
}

export function drawPaddle(ctx, p, side, opt = {}) {
  const L = SIDE[side], r = R_PAD;
  ctx.save(); ctx.translate(p.x, p.y);
  const lift = opt.lift ?? 1;
  // body
  let g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, L.body[0]); g.addColorStop(0.55, L.body[1]); g.addColorStop(1, L.body[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(30,8,2,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  // rim light + groove
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, r - 3, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,6,0,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.74 + 2, 0, TAU); ctx.stroke();
  // pattern: stripes on the red paddle, dots on the teal one
  ctx.fillStyle = 'rgba(255,240,210,0.55)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + (p.ang ?? 0);
    if (side === 0) { ctx.save(); ctx.rotate(a); ctx.fillRect(r * 0.6 - 1.6, -2.2, r * 0.26, 4.4); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66, 3, 0, TAU); ctx.fill(); }
  }
  // the knob
  const kr = r * 0.46;
  ctx.fillStyle = 'rgba(20,6,0,0.35)'; ctx.beginPath(); ctx.arc(3, 5, kr, 0, TAU); ctx.fill();
  g = ctx.createRadialGradient(-kr * 0.4, -kr * 0.45, 1, 0, 0, kr * 1.1);
  g.addColorStop(0, L.knob[0]); g.addColorStop(0.55, L.knob[1]); g.addColorStop(1, L.knob[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, kr, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,14,0,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-kr * 0.33, -kr * 0.4, kr * 0.28, kr * 0.16, -0.6, 0, TAU); ctx.fill();
  if (p.hit > 0) { ctx.strokeStyle = `rgba(255,255,255,${p.hit * 0.9})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 6 + (1 - p.hit) * 18, 0, TAU); ctx.stroke(); }
  if (opt.ring) { ctx.strokeStyle = opt.ring; ctx.globalAlpha = opt.ringA ?? 1; ctx.lineWidth = 4; ctx.setLineDash([9, 7]); ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  void lift;
  ctx.restore();
}

export function drawPuck(ctx, u, o = {}) {
  const r = R_PUCK * (u.scale ?? 1);
  ctx.save(); ctx.translate(u.x, u.y);
  // coin thickness: a darker disc a little lower and to the right
  ctx.fillStyle = '#6b440a'; ctx.beginPath(); ctx.arc(1.5, 2.5, r, 0, TAU); ctx.fill();
  let g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r * 1.1);
  g.addColorStop(0, '#fff5b8'); g.addColorStop(0.45, '#f0bf4a'); g.addColorStop(1, '#a8741a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a520e'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,200,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.stroke();
  // embossed rosette that turns with the puck
  ctx.save(); ctx.rotate(u.ang ?? 0);
  ctx.fillStyle = 'rgba(122,82,14,0.55)';
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate((i / 6) * TAU);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.28, r * 0.25, 0, r * 0.62); ctx.quadraticCurveTo(-r * 0.28, r * 0.25, 0, 0); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,245,190,0.9)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.3, r * 0.14, -0.7, 0, TAU); ctx.fill();
  if (o.glow) { ctx.strokeStyle = `rgba(255,230,140,${o.glow})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

export const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
export { TAU, CORNER };

// The playing surface alone (cream lacquer, edge shading, air holes, folk motifs, markings), world units, origin at the centre.
// The 3D table maps this onto its lacquered top; the 2D table paints the same things inside paintTable.
export function paintSurface(ctx) {
  rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER);
  let g = ctx.createRadialGradient(-40, -60, 30, 0, 0, 520);
  g.addColorStop(0, '#fffdf3'); g.addColorStop(0.55, '#fbf0d2'); g.addColorStop(1, '#e8d3a0');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER); ctx.clip();
  for (const [lw, a] of [[34, 0.12], [18, 0.14], [8, 0.18]]) { ctx.lineWidth = lw; ctx.strokeStyle = `rgba(110,55,15,${a})`; rr(ctx, -HW, -HH, HW * 2, HH * 2, CORNER); ctx.stroke(); }
  ctx.fillStyle = 'rgba(120,80,40,0.26)';
  for (let y = -HH + 20; y < HH; y += 24) for (let x = -HW + 20; x < HW; x += 24) { ctx.beginPath(); ctx.arc(x, y, 1.9, 0, TAU); ctx.fill(); }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { tulip(ctx, sx * 148, sy * 292, 1.15, sy < 0 ? '#1f8479' : '#d63f28', 0.62); tulip(ctx, sx * 60, sy * 330, 0.8, sy < 0 ? '#d63f28' : '#1f8479', 0.5); }
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(200,45,30,0.9)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-HW + 8, 0); ctx.lineTo(-86, 0); ctx.moveTo(86, 0); ctx.lineTo(HW - 8, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(31,122,120,0.92)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 84, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(233,183,74,0.95)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 76, 0, TAU); ctx.stroke();
  rosette(ctx, 70);
  for (const e of [-1, 1]) {
    ctx.strokeStyle = 'rgba(31,122,120,0.88)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, e * HH, 128, e > 0 ? Math.PI : 0, e > 0 ? TAU : Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(214,63,40,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, e * 170, 30, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(214,63,40,0.6)'; ctx.beginPath(); ctx.arc(0, e * 170, 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
