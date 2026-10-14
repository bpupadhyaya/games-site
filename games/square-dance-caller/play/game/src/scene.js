// The dance floor and the dancers, seen from above. Pure drawing: game.js hands over positions in floor units (x right, y up, the floor spans about
// -1.3..1.3) and everything else (home rings, ghosts, arrows, confetti) comes through `info`.
import { COUPLES } from './consts.js';
import { slotPos } from './sim.js';
import { fitCamera, floorPoint } from './geo3d.js';

const TAU = Math.PI * 2;
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SKIN = ['#f1c4a0', '#d9a07a', '#b57a52', '#7d4e32', '#e8b48f', '#9a6a45', '#f6d3b5', '#6a3f27'];
const HAIR = ['#3a2416', '#6b4120', '#c79d55', '#1c1818', '#8b8b92', '#5a2e1a', '#d8b36a', '#2a1f33'];
export const LOOKS = [
  { name: 'barn', sky0: '#2a1a3c', sky1: '#12091f', floorA: '#c98d4d', floorB: '#b57a3d', seam: 'rgba(60,30,10,0.45)', rail: '#7a4a22', glow: '255,200,110', deco: 'bales' },
  { name: 'grange', sky0: '#1f2c52', sky1: '#0e1430', floorA: '#d2a25f', floorB: '#c08e4c', seam: 'rgba(50,28,10,0.42)', rail: '#6d4a2c', glow: '255,226,160', deco: 'bunting' },
  { name: 'town', sky0: '#33203f', sky1: '#160d22', floorA: '#e0b878', floorB: '#cfa665', seam: 'rgba(70,40,15,0.36)', rail: '#8a5a2e', glow: '255,236,190', deco: 'chandelier' },
  { name: 'fair', sky0: '#14344a', sky1: '#0a1824', floorA: '#d8b583', floorB: '#c9a26e', seam: 'rgba(70,45,20,0.34)', rail: '#9a6b35', glow: '255,214,120', deco: 'lights' },
  { name: 'star', sky0: '#0d1a3e', sky1: '#06091c', floorA: '#9c6b3d', floorB: '#8a5a30', seam: 'rgba(20,10,4,0.5)', rail: '#5a3a1e', glow: '190,215,255', deco: 'stars' },
  { name: 'jam', sky0: '#3a1d44', sky1: '#1a0b24', floorA: '#e6bf84', floorB: '#d4ab6f', seam: 'rgba(80,45,15,0.34)', rail: '#a06a30', glow: '255,190,150', deco: 'banners' },
];
const hash = (n) => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- the room behind the floor (whole canvas) ---------------------------------------------------------------------------------------------------
export function drawRoom(ctx, W, H, look, time, beat) {
  const L = LOOKS[look % LOOKS.length];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.sky0); g.addColorStop(1, L.sky1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // warm pool of light
  const rg = ctx.createRadialGradient(W / 2, H * 0.48, 40, W / 2, H * 0.48, Math.max(W, H) * 0.7);
  rg.addColorStop(0, `rgba(${L.glow},0.22)`); rg.addColorStop(1, `rgba(${L.glow},0)`);
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const n = Math.max(7, Math.round(W / 90));
  const swing = Math.sin(time * 1.3) * 3;
  if (L.deco === 'stars') {
    for (let i = 0; i < 46; i++) {
      const x = hash(i * 7 + 1) * W, y = hash(i * 13 + 5) * H * 0.9, tw = 0.45 + 0.55 * Math.sin(time * (0.8 + hash(i) * 1.6) + i);
      ctx.fillStyle = `rgba(230,240,255,${0.25 + 0.5 * tw})`; ctx.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
    }
  }
  // string of lights (or pennants) across the top
  const y0 = 8, sag = 34;
  for (let row = 0; row < 2; row++) {
    const yy = y0 + row * Math.max(60, H * 0.04);
    ctx.strokeStyle = 'rgba(20,10,30,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = (W / n) * i, y = yy + Math.sin((i / n) * Math.PI * 4 + row) * 0 + (i % 2 ? sag : 0) * 0.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const x = (W / n) * (i + 0.5) + swing * (row ? -1 : 1), y = yy + sag * 0.5 + 2;
      const c = COUPLES[(i + row) % 4];
      const flick = 0.75 + 0.25 * Math.sin(time * 3 + i * 1.7 + (beat || 0));
      if (L.deco === 'bunting' || L.deco === 'banners') {
        ctx.fillStyle = c.col; ctx.beginPath(); ctx.moveTo(x - 16, y - 4); ctx.lineTo(x + 16, y - 4); ctx.lineTo(x, y + 34); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x - 16, y - 4); ctx.lineTo(x, y - 4); ctx.lineTo(x, y + 34); ctx.closePath(); ctx.fill();
      } else {
        const gl = ctx.createRadialGradient(x, y + 6, 1, x, y + 6, 26);
        gl.addColorStop(0, `rgba(${L.glow},${0.9 * flick})`); gl.addColorStop(1, `rgba(${L.glow},0)`);
        ctx.fillStyle = gl; ctx.fillRect(x - 28, y - 22, 56, 56);
        ctx.fillStyle = `rgba(255,248,220,${flick})`; ctx.beginPath(); ctx.arc(x, y + 6, 6, 0, TAU); ctx.fill();
      }
    }
  }
  // bales or railings at the lower edge
  if (L.deco === 'bales') {
    for (let i = 0; i < n + 1; i++) {
      const x = i * (W / n) - 20, y = H - 26 - (i % 2) * 8;
      ctx.fillStyle = '#c8a24a'; rr(ctx, x, y, W / n + 10, 40, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(90,60,10,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(90,60,10,0.45)'; ctx.beginPath(); ctx.moveTo(x + 8, y + 16); ctx.lineTo(x + W / n, y + 16); ctx.stroke();
    }
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,16,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---- floor ---------------------------------------------------------------------------------------------------------------------------------
const toScreen = (R, fx, fy) => { const k = R.w / 2.7; return { x: R.x + R.w / 2 + fx * k, y: R.y + R.h / 2 - fy * k, k }; };
export function floorScale(R) { return R.w / 2.7; }
// the last floor drawn this frame (the 3D presenter reads it right after render): rectangle, info and a counter
export const floorFrame = { R: null, info: null, seq: 0, drawn: false };
// the plank floor with its rail painted into a square canvas context (the 3D floor texture)
export function paintBoards(ctx, size, look) { drawBoards(ctx, { x: 0, y: 0, w: size, h: size }, LOOKS[look % LOOKS.length], 0, 0); }

function drawBoards(ctx, R, L, time, beat) {
  const k = R.w / 2.7, pad = R.w * 0.028;
  const x = R.x + pad, y = R.y + pad, w = R.w - pad * 2, h = R.h - pad * 2;
  // rail
  rr(ctx, R.x, R.y + 6, R.w, R.h, k * 0.2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  rr(ctx, R.x, R.y, R.w, R.h, k * 0.2); ctx.fillStyle = L.rail; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, k * 0.15); ctx.clip();
  const planks = 16, ph = h / planks;
  for (let i = 0; i < planks; i++) {
    const py = y + i * ph, base = i % 2 ? L.floorA : L.floorB;
    ctx.fillStyle = base; ctx.fillRect(x, py, w, ph + 1);
    const tone = hash(i + 3);
    ctx.fillStyle = `rgba(${tone > 0.5 ? '255,235,190' : '60,30,10'},${0.06 + tone * 0.06})`; ctx.fillRect(x, py, w, ph + 1);
    // butt joints
    ctx.strokeStyle = L.seam; ctx.lineWidth = 1.5;
    const joints = 2 + (i % 2);
    for (let j = 0; j < joints; j++) { const jx = x + w * (0.15 + hash(i * 9 + j) * 0.7); ctx.beginPath(); ctx.moveTo(jx, py); ctx.lineTo(jx, py + ph); ctx.stroke(); }
    // grain
    ctx.strokeStyle = 'rgba(70,35,10,0.10)'; ctx.lineWidth = 1;
    for (let gI = 0; gI < 2; gI++) { const gy = py + ph * (0.3 + gI * 0.4); ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy + (hash(i + gI) - 0.5) * 3); ctx.stroke(); }
  }
  ctx.strokeStyle = L.seam; ctx.lineWidth = 2;
  for (let i = 1; i < planks; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * ph); ctx.lineTo(x + w, y + i * ph); ctx.stroke(); }
  // inlay: a ring and a compass star in the middle
  const c = { x: x + w / 2, y: y + h / 2 };
  ctx.strokeStyle = 'rgba(60,28,8,0.45)'; ctx.lineWidth = Math.max(2, k * 0.02);
  ctx.beginPath(); ctx.arc(c.x, c.y, k * 1.0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(c.x, c.y, k * 0.2, 0, TAU); ctx.stroke();
  ctx.save(); ctx.translate(c.x, c.y);
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i % 2 ? 'rgba(60,28,8,0.22)' : 'rgba(255,230,170,0.16)';
    ctx.beginPath(); ctx.moveTo(0, -k * 0.2); ctx.lineTo(k * 0.07, -k * 0.5); ctx.lineTo(0, -k * 0.62); ctx.lineTo(-k * 0.07, -k * 0.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // lantern pulse on the beat
  const pulse = 0.5 + 0.5 * Math.cos((beat || 0) * TAU);
  const lg = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, w * 0.75);
  lg.addColorStop(0, `rgba(${L.glow},${0.1 + pulse * 0.05})`); lg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = lg; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---- one dancer ---------------------------------------------------------------------------------------------------------------------------
function drawDancer(ctx, sx, sy, s, d, time) {
  const cp = COUPLES[d.id >> 1], lady = (d.id & 1) === 1;
  const skin = SKIN[(d.id * 3 + 1) % SKIN.length], hair = HAIR[(d.id * 5 + 2) % HAIR.length];
  const ph = time * 7 + d.id * 1.3, sw = Math.sin(ph) * d.step, sc = d.scale || 1;
  ctx.save(); ctx.translate(sx, sy - (d.lift || 0) * s);
  // shadow
  ctx.fillStyle = 'rgba(10,4,20,0.32)'; ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.22, s * (lady ? 1.0 : 0.82), s * (lady ? 0.9 : 0.74), 0, 0, TAU); ctx.fill();
  ctx.scale(sc, sc);
  ctx.rotate(-d.face);               // local +x is where the dancer faces
  if (!lady) {
    // feet
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath(); ctx.ellipse(sw * s * 0.42, -s * 0.26, s * 0.3, s * 0.15, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-sw * s * 0.42, s * 0.26, s * 0.3, s * 0.15, 0, 0, TAU); ctx.fill();
    // arms (swing opposite the legs), sleeves in the couple colour
    const armR = sw * 0.3 * s, armL = -sw * 0.3 * s, reach = (d.reach || 0) * s;
    for (const side of [-1, 1]) {
      const ax = (side < 0 ? armL : armR) * -1 + reach * 0.5;
      ctx.fillStyle = cp.col; ctx.strokeStyle = cp.dark; ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath(); ctx.ellipse(ax + s * 0.18, side * s * 0.78, s * 0.42, s * 0.2, side * 0.12, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(ax + s * 0.55 + reach * 0.4, side * s * 0.84, s * 0.16, 0, TAU); ctx.fill();
    }
    // torso: shoulders seen from above, with a darker vest and yoke
    ctx.fillStyle = cp.col; ctx.strokeStyle = cp.dark; ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.78, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(30,18,40,0.55)'; ctx.beginPath(); ctx.ellipse(-s * 0.08, 0, s * 0.3, s * 0.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.5); ctx.lineTo(s * 0.2, -s * 0.2); ctx.stroke();
    // head, hair, hat
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(s * 0.06, 0, s * 0.34, 0, TAU); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(-s * 0.04, 0, s * 0.32, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
    ctx.fillStyle = '#ecd9a0'; ctx.strokeStyle = '#9a7a35'; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.ellipse(s * 0.04, 0, s * 0.64, s * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f6e9b8'; ctx.beginPath(); ctx.arc(s * 0.02, 0, s * 0.33, 0, TAU); ctx.fill();
    ctx.strokeStyle = cp.col; ctx.lineWidth = Math.max(2, s * 0.11); ctx.beginPath(); ctx.arc(s * 0.02, 0, s * 0.32, 0, TAU); ctx.stroke();
  } else {
    // skirt with petals; it flares with speed and with the spin
    const flare = 1 + 0.16 * (d.step || 0) + 0.1 * Math.abs(Math.sin((d.spin || 0) * 0.5));
    const R0 = s * 1.0 * flare, rot = (d.spin || 0) * 0.6;
    const g = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, R0);
    g.addColorStop(0, cp.light); g.addColorStop(0.55, cp.col); g.addColorStop(1, cp.dark);
    ctx.fillStyle = g; ctx.strokeStyle = cp.dark; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath();
    const P = 56;
    for (let i = 0; i <= P; i++) {
      const a = (i / P) * TAU, r = R0 * (1 + 0.07 * Math.sin(a * 8 + rot * 2) + 0.03 * Math.sin(a * 3 - time * 2));
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // petticoat rim and gores
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.beginPath(); ctx.arc(0, 0, R0 * 0.88, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(1, s * 0.04);
    for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3); ctx.lineTo(Math.cos(a) * R0 * 0.85, Math.sin(a) * R0 * 0.85); ctx.stroke(); }
    // arms, bodice and head
    const reach = (d.reach || 0) * s, armR = sw * 0.25 * s;
    for (const side of [-1, 1]) {
      const ax = armR * -side + reach * 0.5;
      ctx.fillStyle = '#fdf1dc'; ctx.strokeStyle = 'rgba(80,40,10,0.35)'; ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath(); ctx.ellipse(ax + s * 0.12, side * s * 0.52, s * 0.38, s * 0.15, side * 0.18, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(ax + s * 0.46 + reach * 0.4, side * s * 0.58, s * 0.14, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#fdf1dc'; ctx.strokeStyle = cp.dark; ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.52, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = cp.dark; ctx.beginPath(); ctx.ellipse(-s * 0.04, 0, s * 0.2, s * 0.34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(s * 0.05, 0, s * 0.28, 0, TAU); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(-s * 0.02, 0, s * 0.28, Math.PI * 0.4, Math.PI * 1.6); ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.26, 0, s * 0.17, 0, TAU); ctx.fill();
    ctx.fillStyle = cp.light; ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.2, s * 0.09, 0, TAU); ctx.arc(-s * 0.1, s * 0.2, s * 0.09, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function tag(ctx, x, y, s, d, abs = false) {
  const cp = COUPLES[d.id >> 1], lady = (d.id & 1) === 1, r = abs ? Math.max(18, s * 0.42) : s * 0.42;
  const px = abs ? x : x + s * 0.78, py = abs ? y : y - s * 0.86;
  ctx.save();
  ctx.fillStyle = 'rgba(12,6,26,0.82)'; ctx.strokeStyle = cp.light; ctx.lineWidth = Math.max(1.5, s * 0.07);
  if (lady) { ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); ctx.stroke(); } else { rr(ctx, px - r, py - r, r * 2, r * 2, r * 0.3); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(14, Math.round(r * 1.25))}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(cp.n), px, py + 1);
  ctx.restore();
}

function arrow(ctx, x0, y0, x1, y1, col, wd, bend = 0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 4) return;
  const nx = -dy / L, ny = dx / L, mx = (x0 + x1) / 2 + nx * bend * L, my = (y0 + y1) / 2 + ny * bend * L;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - my, x1 - mx), hs = wd * 3.2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hs * Math.cos(a - 0.5), y1 - hs * Math.sin(a - 0.5)); ctx.lineTo(x1 - hs * Math.cos(a + 0.5), y1 - hs * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
}

// info: { look, time, beat (0..1 inside the beat), dancers:[{id,x,y,face,step,spin,reach,scale,lift}], lit:bool[8], ghosts:[{slot,id}]|null,
//         arrows:[{from:{x,y},to:{x,y},id}]|null, glow (0..1 resolved flash), confetti:[{x,y,vx,vy,c,r,rot}]|null, tags:boolean }
export function drawFloor(ctx, R, info) {
  const L = LOOKS[info.look % LOOKS.length], k = R.w / 2.7, s = k * 0.18;
  floorFrame.R = R; floorFrame.info = info; floorFrame.seq += 1; floorFrame.drawn = true;
  const three = !!info.p3;                       // the 3D presenter draws the floor, home rings, ghosts and dancers; this draws what stays on top
  const cam = three ? fitCamera(R.w, R.h) : null;
  if (!three) drawBoards(ctx, R, L, info.time, info.beat);
  const P = three ? (fx, fy, hm = 0) => floorPoint(cam, R, fx, fy, hm) : (fx, fy) => toScreen(R, fx, fy);
  // home rings (chalk circles) with the owner's colour
  for (let slot = 0; slot < 8 && !three; slot++) {
    const sp = slotPos(slot), p = P(sp.x, sp.y), cp = COUPLES[slot >> 1], lit = info.lit && info.lit[slot];
    ctx.save();
    if (lit) { const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, s * 1.7); g.addColorStop(0, 'rgba(255,240,170,0.65)'); g.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s * 1.7, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = cp.col; ctx.lineWidth = Math.max(3, s * 0.16); ctx.globalAlpha = lit ? 1 : 0.85;
    ctx.beginPath(); ctx.arc(p.x, p.y, s * 1.12, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.setLineDash([s * 0.2, s * 0.22]);
    ctx.beginPath(); ctx.arc(p.x, p.y, s * 1.28, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // role mark in the ring: a hat brim for the gent's place, a skirt for the lady's place
    ctx.globalAlpha = 0.95; ctx.fillStyle = cp.light; ctx.strokeStyle = 'rgba(30,14,50,0.85)'; ctx.lineWidth = Math.max(3, s * 0.12); ctx.lineJoin = 'round';
    ctx.font = `800 ${Math.max(15, Math.round(s * 0.5))}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lab = `${cp.n}${(slot & 1) ? 'L' : 'G'}`, ly = p.y + s * 1.62;
    ctx.strokeText(lab, p.x, ly); ctx.fillText(lab, p.x, ly);
    ctx.restore();
  }
  // plan: ghosts and arrows
  if (info.ghosts && !three) {
    for (const g of info.ghosts) {
      const sp = slotPos(g.slot), p = P(sp.x, sp.y), cp = COUPLES[g.id >> 1];
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = cp.col; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.setLineDash([s * 0.2, s * 0.15]);
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.62, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  // dancers, far to near
  const list = info.dancers.map((d) => ({ d, p: P(d.x, d.y) })).sort((a, b) => a.p.y - b.p.y);
  if (!three) for (const e of list) drawDancer(ctx, e.p.x, e.p.y, s, e.d, info.time);
  if (info.arrows) {
    for (const a of info.arrows) {
      const p0 = P(a.from.x, a.from.y), p1 = P(a.to.x, a.to.y), cp = COUPLES[a.id >> 1];
      ctx.save(); ctx.globalAlpha = 0.92;
      arrow(ctx, p0.x, p0.y, p1.x, p1.y, 'rgba(10,4,24,0.55)', Math.max(6, s * 0.2), a.bend || 0.12);
      arrow(ctx, p0.x, p0.y, p1.x, p1.y, cp.light, Math.max(3, s * 0.12), a.bend || 0.12);
      ctx.restore();
    }
  }
  if (info.tags !== false) {
    for (const e of list) {
      if (!three) { tag(ctx, e.p.x, e.p.y, s, e.d); continue; }
      const h = P(e.d.x, e.d.y, 1.95), m = e.p.k;           // above the head, a little to the right
      tag(ctx, h.x - m * 0.2 + 0, h.y + m * 0.28, Math.max(34, m * 0.34), e.d, true);
    }
  }
  // resolved flash
  if (info.glow > 0) {
    const c = P(0, 0), g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, R.w * 0.8);
    g.addColorStop(0, `rgba(255,236,150,${0.55 * info.glow})`); g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g; ctx.fillRect(R.x - 20, R.y - 20, R.w + 40, R.h + 40);
  }
  if (info.confetti) {
    for (const c of info.confetti) {
      const p = P(c.x, c.y, three ? 0.5 : 0);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(c.rot); ctx.fillStyle = c.c; ctx.fillRect(-c.r, -c.r * 0.5, c.r * 2, c.r); ctx.restore();
    }
  }
}
export const dancerRadius = (R) => R.w / 2.7 * 0.18;
