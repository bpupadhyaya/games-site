// Drawing primitives for Kingyo Sukui: goldfish, the paper poi, the tank water, the stall background and the bowl.
// Everything is drawn with canvas paths and gradients; tank art is drawn in tank units (TW x TH) after a translate and a scale.
import { TW, TH, POI_R } from './sim.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// one palette per tank time of day
export const THEMES = [
  { name: 'morning', cloth: ['#f6e3c2', '#e9c995'], wood: '#c58a4e', woodDark: '#8e5b2c', water: ['#8fe0ea', '#38a8c6'], floor: '#bfe7e6', rim: '#fff5df', rimEdge: '#34506f', glow: 'rgba(255,236,180,0.22)', lantern: ['#ffb347', '#ff7a3c'], dim: 0 },
  { name: 'afternoon', cloth: ['#f0c9a0', '#d99a6a'], wood: '#b87a42', woodDark: '#7b4a22', water: ['#6fd0e2', '#2092b8'], floor: '#9fd8da', rim: '#fff0d2', rimEdge: '#2f4968', glow: 'rgba(255,214,150,0.2)', lantern: ['#ff8f4a', '#e5472b'], dim: 0.06 },
  { name: 'evening', cloth: ['#4a3a7a', '#2c2358'], wood: '#7d4e2a', woodDark: '#4c2c14', water: ['#3a9fc4', '#14507e'], floor: '#4f9ab8', rim: '#f3dfbf', rimEdge: '#1f2b52', glow: 'rgba(255,170,90,0.28)', lantern: ['#ff9a3c', '#e8452c'], dim: 0.18 },
  { name: 'night', cloth: ['#241d52', '#120f30'], wood: '#5d3a1f', woodDark: '#33200f', water: ['#2677a2', '#0b2c55'], floor: '#2f6f93', rim: '#e6d2b0', rimEdge: '#161f45', glow: 'rgba(255,140,70,0.3)', lantern: ['#ff7f3a', '#d6322c'], dim: 0.3 },
];

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- goldfish ------------------------------------------------------------------------------------------------------------
// wr: body width ratio, tl: tail length ratio, tw: tail spread; patches are { u, v, rw, rh, col } in body fractions.
const LOOKS = [
  { base: '#fff3e8', hi: '#ffffff', lo: '#f0d2c0', fin: 'rgba(255,200,180,0.8)', fin2: 'rgba(255,255,255,0.65)', wr: 0.36, tl: 0.62, tw: 0.9, patches: [{ u: 0.22, v: 0, rw: 0.2, rh: 0.5, col: '#ff4a2a' }, { u: 0.62, v: 0.1, rw: 0.22, rh: 0.46, col: '#ff4a2a' }], eye: 'round' },
  { base: '#fff0de', hi: '#ffffff', lo: '#e8c8b0', fin: 'rgba(255,190,160,0.8)', fin2: 'rgba(255,255,255,0.6)', wr: 0.38, tl: 0.62, tw: 1.0, patches: [{ u: 0.18, v: -0.1, rw: 0.18, rh: 0.5, col: '#ff5a36' }, { u: 0.45, v: 0.2, rw: 0.2, rh: 0.45, col: '#25252f' }, { u: 0.72, v: -0.05, rw: 0.2, rh: 0.5, col: '#ff5a36' }], eye: 'round' },
  { base: '#ec4a2e', hi: '#ff9a72', lo: '#a82a16', fin: 'rgba(255,120,80,0.8)', fin2: 'rgba(255,190,150,0.6)', wr: 0.42, tl: 0.7, tw: 1.1, patches: [], eye: 'telescope' },
  { base: '#17171f', hi: '#4c4c6a', lo: '#08080c', fin: 'rgba(40,40,70,0.85)', fin2: 'rgba(90,90,130,0.55)', wr: 0.46, tl: 0.78, tw: 1.3, patches: [], eye: 'telescope' },
  { base: '#ff7a2a', hi: '#ffc070', lo: '#c4480c', fin: 'rgba(255,170,90,0.8)', fin2: 'rgba(255,230,190,0.6)', wr: 0.62, tl: 0.5, tw: 1.0, patches: [{ u: 0.12, v: 0, rw: 0.2, rh: 0.62, col: '#fff0d8' }], eye: 'round' },
  { base: '#e8392a', hi: '#ff8a6a', lo: '#9c1c12', fin: 'rgba(255,160,140,0.8)', fin2: 'rgba(255,225,210,0.65)', wr: 0.32, tl: 1.0, tw: 1.5, patches: [], eye: 'round' },
  { base: '#fff4e4', hi: '#ffffff', lo: '#d8c3ae', fin: 'rgba(255,235,220,0.8)', fin2: 'rgba(255,255,255,0.65)', wr: 0.74, tl: 0.5, tw: 1.0, patches: [{ u: 0.3, v: 0, rw: 0.3, rh: 0.5, col: 'rgba(255,214,200,0.7)' }], eye: 'round' },
  { base: '#ffc82e', hi: '#fff6a8', lo: '#c98a0a', fin: 'rgba(255,215,90,0.85)', fin2: 'rgba(255,245,170,0.7)', wr: 0.38, tl: 0.8, tw: 1.1, patches: [{ u: 0.3, v: -0.2, rw: 0.35, rh: 0.15, col: 'rgba(255,255,230,0.65)' }], eye: 'round' },
];

function bodyPoint(L, u, ph, amp) { return { x: L * (0.5 - u), y: Math.sin(ph - u * 3.2) * amp * Math.pow(u, 1.15) }; }
const prof = (u) => { const a = u < 0.36 ? (u - 0.36) / 0.36 : (u - 0.36) / 0.64; return Math.max(0.1, Math.pow(Math.max(0, 1 - a * a), 0.7)); };

// Draw one fish at the origin, head to +x. L = body length, ph = swim phase, boost 0..1 = how hard it is swimming.
export function drawFishShape(ctx, k, L, ph, boost = 0, alpha = 1) {
  const spr = v3.sprites && v3.sprites[k];
  if (spr && v3.spriteInfo) {
    // the portrait baked from the 3D model (head to +x, body length = L); a gentle sway keeps it alive
    const sp = v3.spriteInfo, sc = L / (sp.bodyM * sp.pxPerM);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.rotate(Math.sin(ph * 0.9) * 0.07 * (0.5 + boost));
    ctx.drawImage(spr, -sp.cx * sc, -sp.cy * sc, sp.w * sc, sp.h * sc); ctx.restore();
    return;
  }
  const lk = LOOKS[k], amp = L * (0.06 + 0.05 * boost), Wm = (L * lk.wr) / 2, N = 24;
  ctx.save(); ctx.globalAlpha *= alpha;
  const top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = bodyPoint(L, u, ph, amp), wh = Wm * prof(u);
    top.push({ x: p.x, y: p.y - wh }); bot.push({ x: p.x, y: p.y + wh });
  }
  const tail = bodyPoint(L, 1, ph, amp), ta = Math.sin(ph - 3.9) * (0.5 + 0.35 * boost);
  // tail: a flowing veil of rays, each ray lags the one before it so the fan ripples like silk
  const Tl = L * lk.tl * 0.72, spread = 0.46 + 0.1 * lk.tw;
  const t95 = bodyPoint(L, 0.93, ph, amp), tang = Math.atan2(tail.y - t95.y, tail.x - t95.x);
  ctx.save(); ctx.translate(tail.x, tail.y); ctx.rotate(tang + ta * 0.3);
  const RAYS = 9, fork = 0.18 + 0.1 * lk.tw;
  for (let layer = 0; layer < 2; layer++) {
    const sc = layer ? 1 : 1.12, lag = layer ? 0 : 0.7, tips = [];
    for (let j = 0; j < RAYS; j++) {
      const c = (j / (RAYS - 1)) * 2 - 1, a = c * spread * sc, len = Tl * sc * (1 - fork * (1 - Math.abs(c)) * 0.9) * (0.92 + 0.08 * Math.cos(c * 3));
      const wv = Math.sin(ph * 1.2 - 4.4 - lag - Math.abs(c) * 1.3) * (0.1 + 0.12 * boost) * len * Math.abs(c) * 0.9 * Math.sign(c || 1);
      tips.push({ x: Math.cos(a) * len, y: Math.sin(a) * len + wv * 0.9, a });
    }
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(tips[0].x * 0.3, tips[0].y * 0.3);
    ctx.quadraticCurveTo(tips[0].x * 0.8, tips[0].y * 0.8, tips[0].x, tips[0].y);
    for (let j = 1; j < RAYS; j++) { const pr = tips[j - 1], cu = tips[j]; ctx.quadraticCurveTo((pr.x + cu.x) / 2 + Tl * 0.07, (pr.y + cu.y) / 2, cu.x, cu.y); }
    ctx.quadraticCurveTo(tips[RAYS - 1].x * 0.8, tips[RAYS - 1].y * 0.8, tips[RAYS - 1].x * 0.3, tips[RAYS - 1].y * 0.3);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, 0, Tl * sc, 0);
    tg.addColorStop(0, layer ? lk.lo : lk.fin2); tg.addColorStop(0.35, layer ? lk.fin : lk.fin2); tg.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.globalAlpha *= layer ? 0.9 : 0.55; ctx.fillStyle = tg; ctx.fill(); ctx.globalAlpha /= layer ? 0.9 : 0.55;
    if (layer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.34)'; ctx.lineWidth = Math.max(0.7, L * 0.007);
      for (let j = 0; j < RAYS; j++) { const t0 = tips[j]; ctx.beginPath(); ctx.moveTo(Tl * 0.05, 0); ctx.quadraticCurveTo(t0.x * 0.55, t0.y * 0.5, t0.x, t0.y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(40,10,10,0.18)'; ctx.lineWidth = Math.max(1, L * 0.01); ctx.stroke();
    }
  }
  ctx.restore();
  // pectoral fins
  const pf = bodyPoint(L, 0.27, ph, amp);
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.translate(pf.x, pf.y + sg * Wm * 0.75); ctx.rotate(sg * (0.75 + Math.sin(ph * 1.5 + sg) * 0.25) + Math.PI);
    ctx.beginPath(); ctx.ellipse(L * 0.11, 0, L * 0.14, L * 0.055, 0, 0, TAU); ctx.fillStyle = lk.fin2; ctx.fill(); ctx.restore();
  }
  // body
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -Wm, 0, Wm);
  g.addColorStop(0, lk.lo); g.addColorStop(0.28, lk.hi); g.addColorStop(0.55, lk.base); g.addColorStop(1, lk.lo);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (const pa of lk.patches) {
    const p = bodyPoint(L, pa.u, ph, amp);
    ctx.beginPath(); ctx.ellipse(p.x, p.y + pa.v * Wm, pa.rw * L, pa.rh * Wm * 1.6, 0, 0, TAU); ctx.fillStyle = pa.col; ctx.fill();
  }
  if (k === 7) { const sh = ctx.createLinearGradient(-L / 2, -Wm, L / 2, Wm); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5 + Math.sin(ph * 0.6) * 0.3, 'rgba(255,255,255,0.45)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(-L, -Wm * 2, L * 2, Wm * 4); }
  if (k === 6) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 9; i++) { const p = bodyPoint(L, 0.12 + (i % 5) * 0.16, ph, amp); ctx.beginPath(); ctx.arc(p.x, p.y + (i < 5 ? -1 : 1) * Wm * 0.35, L * 0.035, 0, TAU); ctx.fill(); } }
  // scales (two soft rows of arcs), gill cover and a translucent dorsal fin along the back
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(0.8, L * 0.009);
  for (let r = -1; r <= 1; r++) for (let i = 0; i < 9; i++) {
    const p = bodyPoint(L, 0.3 + i * 0.07, ph, amp), sx = L * 0.045;
    ctx.beginPath(); ctx.arc(p.x + (r & 1 ? 0 : sx * 0.5), p.y + r * Wm * 0.5, sx, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  }
  { const g0 = bodyPoint(L, 0.27, ph, amp); ctx.strokeStyle = 'rgba(70,20,10,0.28)'; ctx.lineWidth = Math.max(1, L * 0.014); ctx.beginPath(); ctx.ellipse(g0.x, g0.y, Wm * 0.9, Wm * 0.92, 0, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke(); }
  { const d0 = bodyPoint(L, 0.42, ph, amp), d1 = bodyPoint(L, 0.82, ph, amp), dm = bodyPoint(L, 0.62, ph, amp);
    ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.quadraticCurveTo(dm.x, dm.y - Wm * 0.7, d1.x, d1.y); ctx.quadraticCurveTo(dm.x, dm.y + Wm * 0.7, d0.x, d0.y);
    ctx.fillStyle = lk.fin2; ctx.globalAlpha *= 0.55; ctx.fill(); ctx.globalAlpha /= 0.55; }
  // soft dorsal ridge
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = Math.max(1.2, L * 0.025); ctx.beginPath();
  for (let i = 1; i < N; i++) { const p = bodyPoint(L, i / N, ph, amp); if (i === 1) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = Math.max(1, L * 0.012); ctx.strokeStyle = 'rgba(40,10,10,0.22)'; ctx.stroke();
  // eyes
  const ep = bodyPoint(L, 0.1, ph, amp), er = lk.eye === 'telescope' ? L * 0.062 : L * 0.04;
  for (const sg of [-1, 1]) {
    const ey = ep.y + sg * Wm * (lk.eye === 'telescope' ? 0.95 : 0.55);
    ctx.beginPath(); ctx.arc(ep.x, ey, er, 0, TAU); ctx.fillStyle = k === 3 ? '#2a2a38' : '#1b1218'; ctx.fill();
    ctx.beginPath(); ctx.arc(ep.x - er * 0.3, ey - er * 0.3, er * 0.35, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  }
  ctx.restore();
}

// ---- the paper poi --------------------------------------------------------------------------------------------------------------
// paper 1 fresh .. 0 torn, wet 0..1. Drawn in tank units at (x,y). A deterministic crack pattern grows as the paper wears.
const CRACKS = [[0.2, 0.7], [1.1, 0.6], [2.2, 0.8], [3.0, 0.55], [4.1, 0.75], [5.2, 0.65], [0.7, 0.4], [3.6, 0.45]];
export function drawPoi(ctx, x, y, o = {}) {
  const { paper = 1, wet = 0, scale = 1, alpha = 1, shadow = true, torn = 0, lift = 0, ha = Math.PI * 0.36 } = o;
  const R = POI_R * scale;
  ctx.save(); ctx.globalAlpha *= alpha;
  // handle (goes out toward the player, bottom right)
  if (shadow) {
    ctx.save(); ctx.translate(lift * 16 + 6, lift * 22 + 8); ctx.globalAlpha *= 0.22;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fillStyle = '#04162a'; ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ha);
  const hg = ctx.createLinearGradient(0, -9, 0, 9); hg.addColorStop(0, '#e9c58a'); hg.addColorStop(0.5, '#c9915a'); hg.addColorStop(1, '#8a5a30');
  ctx.fillStyle = hg; roundRectPath(ctx, R * 0.9, -8, 330, 16, 8); ctx.fill();
  ctx.restore();
  // paper
  const wetA = 0.5 + 0.35 * (1 - wet);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R - 3, 0, TAU); ctx.clip();
  const pg = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
  pg.addColorStop(0, `rgba(255,252,240,${wetA})`); pg.addColorStop(1, `rgba(${Math.round(lerp(238, 190, wet))},${Math.round(lerp(228, 215, wet))},${Math.round(lerp(204, 225, wet))},${wetA * 0.9})`);
  ctx.fillStyle = pg; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  // paper fibres
  ctx.strokeStyle = `rgba(150,130,100,${0.16 + 0.12 * (1 - wet)})`; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const a = i * 0.7; ctx.beginPath(); ctx.moveTo(x - R + (i * 37) % (R * 1.6), y + Math.sin(a) * R * 0.7); ctx.quadraticCurveTo(x + Math.cos(a) * R * 0.3, y + Math.sin(a * 1.7) * R * 0.5, x + R - (i * 29) % (R * 1.5), y - Math.cos(a) * R * 0.6); ctx.stroke(); }
  // wear: cracks and a thinning centre
  const wear = Math.max(0, Math.min(1, 1 - paper)), nCr = Math.floor(wear * CRACKS.length * 1.15);
  ctx.strokeStyle = 'rgba(60,40,30,0.55)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < Math.min(CRACKS.length, nCr); i++) {
    const [a, l] = CRACKS[i], len = R * (0.25 + l * 0.6) * Math.min(1, wear * 1.3 + 0.2);
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95);
    ctx.lineTo(x + Math.cos(a + 0.1) * (R * 0.95 - len * 0.5), y + Math.sin(a + 0.1) * (R * 0.95 - len * 0.5));
    ctx.lineTo(x + Math.cos(a - 0.08) * (R * 0.95 - len), y + Math.sin(a - 0.08) * (R * 0.95 - len)); ctx.stroke();
  }
  if (torn > 0) { ctx.fillStyle = 'rgba(30,60,90,0.5)'; ctx.beginPath(); ctx.arc(x + R * 0.1, y, R * 0.5 * torn, 0, TAU); ctx.fill(); }
  ctx.restore();
  // ring
  const rg = ctx.createLinearGradient(x - R, y - R, x + R, y + R); rg.addColorStop(0, '#ff7a55'); rg.addColorStop(0.5, '#d83a22'); rg.addColorStop(1, '#8e1c0e');
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.lineWidth = 9; ctx.strokeStyle = rg; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, R - 3.5, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,210,0.55)'; ctx.stroke();
  ctx.restore();
}

// ---- water, tank and stall ---------------------------------------------------------------------------------------------------------
const PEBBLES = Array.from({ length: 38 }, (_, i) => ({ x: (i * 197 + 61) % TW, y: (i * 331 + 113) % TH, r: 8 + ((i * 13) % 17), a: 0.08 + ((i * 7) % 10) * 0.012 }));

// Draws the tank in tank units: clip must already be the tank's water shape. t = seconds.
export function drawWater(ctx, th, t) {
  const g = ctx.createLinearGradient(0, 0, 0, TH);
  g.addColorStop(0, th.water[0]); g.addColorStop(1, th.water[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
  ctx.fillStyle = th.floor;
  for (const p of PEBBLES) { ctx.globalAlpha = p.a; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.3, p.r, 0.4, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // light bands (caustics)
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const y0 = 60 + i * 120, ph = t * (0.35 + i * 0.04) + i * 1.7;
    ctx.beginPath();
    for (let x = -20; x <= TW + 20; x += 40) { const y = y0 + Math.sin(x * 0.011 + ph) * 26 + Math.sin(x * 0.027 - ph * 1.3) * 12; if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(255,255,255,0.075)'; ctx.lineWidth = 22; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 5; ctx.stroke();
  }
  if (th.dim > 0) { ctx.fillStyle = `rgba(6,10,40,${th.dim})`; ctx.fillRect(0, 0, TW, TH); }
  // lantern glow on the water
  if (th.dim >= 0.15) {
    for (let i = 0; i < 4; i++) {
      const gx = 140 + i * 240 + Math.sin(t * 0.3 + i) * 30, gy = 140 + (i % 2) * 380 + Math.cos(t * 0.25 + i) * 24;
      const rg = ctx.createRadialGradient(gx, gy, 6, gx, gy, 170); rg.addColorStop(0, th.glow); rg.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = rg; ctx.fillRect(gx - 170, gy - 170, 340, 340);
    }
  }
}

export function drawRipple(ctx, rp, t) {
  const a = Math.max(0, 1 - rp.t / rp.max), r = rp.r0 + rp.t * rp.sp;
  ctx.beginPath(); ctx.arc(rp.x, rp.y, r, 0, TAU); ctx.lineWidth = 3 + 3 * a; ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`; ctx.stroke();
  if (r > 24) { ctx.beginPath(); ctx.arc(rp.x, rp.y, r * 0.72, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${0.3 * a})`; ctx.stroke(); }
  void t;
}

// The tank body and rim around the water rect (screen px).
export function drawTankFrame(ctx, r, th) {
  const rr = Math.min(r.w, r.h) * 0.09, b = Math.max(10, r.w * 0.026);
  ctx.save();
  roundRectPath(ctx, r.x - b + 2, r.y - b + 10, r.w + 2 * b, r.h + 2 * b, rr + b); ctx.fillStyle = 'rgba(8,6,24,0.38)'; ctx.fill();
  roundRectPath(ctx, r.x - b, r.y - b, r.w + 2 * b, r.h + 2 * b, rr + b);
  const g = ctx.createLinearGradient(0, r.y - b, 0, r.y + r.h + b); g.addColorStop(0, th.rim); g.addColorStop(1, '#d9c39a');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = th.rimEdge; ctx.stroke();
  roundRectPath(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, rr + 2); ctx.fillStyle = 'rgba(20,40,70,0.55)'; ctx.fill();
  ctx.restore();
  return rr;
}

// The stall: wooden counter planks with a dyed cloth runner, and paper lanterns hung along the top edge (never over the tank).
export function drawStall(ctx, x, y, w, h, th, t) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, th.cloth[0]); g.addColorStop(1, th.cloth[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // cloth pattern: soft diagonal weave
  ctx.strokeStyle = th.dim > 0.1 ? 'rgba(255,255,255,0.045)' : 'rgba(120,60,20,0.06)'; ctx.lineWidth = 2;
  for (let i = -h; i < w; i += 46) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke(); }
  // counter planks left and right of the cloth edge (kept to the margins so the water stays the focus)
  const pw = Math.max(26, w * 0.05);
  for (const side of [0, 1]) {
    const px = side ? x + w - pw : x;
    const wg = ctx.createLinearGradient(px, 0, px + pw, 0); wg.addColorStop(0, th.wood); wg.addColorStop(1, th.woodDark);
    ctx.fillStyle = wg; ctx.fillRect(px, y, pw, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(px, y + (k * h) / 8); ctx.lineTo(px + pw, y + (k * h) / 8); ctx.stroke(); }
  }
  // lantern bokeh strip along the top
  const n = Math.max(4, Math.round(w / 150));
  for (let i = 0; i < n; i++) {
    const lx = x + ((i + 0.5) / n) * w + Math.sin(t * 0.6 + i * 2) * 4, ly = y + 16 + (i % 2) * 14, r = 26 + (i % 3) * 5;
    const rg = ctx.createRadialGradient(lx, ly, 2, lx, ly, r * 2.4); rg.addColorStop(0, th.dim > 0.1 ? 'rgba(255,190,100,0.5)' : 'rgba(255,170,80,0.28)'); rg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = rg; ctx.fillRect(lx - r * 2.4, ly - r * 2.4, r * 4.8, r * 4.8);
    ctx.beginPath(); ctx.ellipse(lx, ly, r * 0.62, r * 0.78, 0, 0, TAU);
    const lg = ctx.createRadialGradient(lx - r * 0.2, ly - r * 0.2, 2, lx, ly, r); lg.addColorStop(0, '#ffd89a'); lg.addColorStop(0.5, th.lantern[0]); lg.addColorStop(1, th.lantern[1]);
    ctx.fillStyle = lg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(70,20,10,0.55)'; ctx.stroke();
  }
  ctx.restore();
}

// The bowl (okewan-style): a red lacquered bowl seen from above; small fish icons swim inside.
export function drawBowl(ctx, cx, cy, r, caught, t, full = 0) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx + 4, cy + 8, r * 1.02, r * 0.98, 0, 0, TAU); ctx.fillStyle = 'rgba(6,4,20,0.4)'; ctx.fill();
  const rg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  rg.addColorStop(0, '#ff7a55'); rg.addColorStop(0.7, '#cf3a22'); rg.addColorStop(1, '#7a160a');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#4a0e06'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, TAU); ctx.fillStyle = '#e8f6f8'; ctx.fill();
  const wg = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 0.78); wg.addColorStop(0, '#9fe3ee'); wg.addColorStop(1, '#3b9fbd');
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, TAU); ctx.fillStyle = wg; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, TAU); ctx.clip();
  const n = Math.min(7, caught.length);
  for (let i = 0; i < n; i++) {
    const k = caught[caught.length - 1 - i], a = t * (0.5 + i * 0.07) + i * 2.1, rr = r * (0.18 + (i % 3) * 0.14);
    ctx.save(); ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2);
    drawFishShape(ctx, k, r * 0.5, t * 4 + i, 0.2); ctx.restore();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
  void full;
  ctx.restore();
}

// A small fish portrait for collection cards: head to the right, slightly bobbing. Locked fish are dimmed.
export function drawFishIcon(ctx, k, cx, cy, size, t = 0, locked = false) {
  ctx.save(); ctx.translate(cx, cy);
  if (locked) ctx.globalAlpha = 0.18;
  drawFishShape(ctx, k, size, t * 5 + k, 0.1);
  ctx.restore();
}
