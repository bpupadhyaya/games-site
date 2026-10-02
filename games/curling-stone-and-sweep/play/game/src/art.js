// Drawing primitives: the ice tile (baked once), the house, granite stones with coloured handles, sweeping brush heads.
// Pure drawing, no state. Everything is original and abstract: there are no people anywhere in the art.
import { BUTTON_R, FOUR_R, EIGHT_R, HOUSE_R, R } from './sim.js';
export { FONT } from './ui.js';

const TAU = Math.PI * 2;
export const TEAM = [
  { name: 'Red', main: '#d9362d', hi: '#ff8a74', dark: '#7d1510', glow: 'rgba(255,100,80,0.9)', tint: '#ff6a58' },
  { name: 'Yellow', main: '#f3c331', hi: '#fff3a0', dark: '#9b6a06', glow: 'rgba(255,214,70,0.9)', tint: '#ffd447' },
];

// ---- host (off-screen surfaces) -------------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}
export const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- the ice tile: pebble, frost, hairline marks. It covers TILE_M metres and repeats seamlessly ----------------
export const TILE_M = 3.2;
const TS = 512;
export function startIceBake() {
  const cv = makeCanvas(TS, TS);
  if (!cv) return { failed: true, step: () => false };
  const cx = cv.getContext('2d');
  let stage = 0;
  const wrap = (fn, x, y, r) => {
    for (const dx of [0, -TS, TS]) for (const dy of [0, -TS, TS]) {
      const xx = x + dx, yy = y + dy;
      if (xx > -r && xx < TS + r && yy > -r && yy < TS + r) fn(xx, yy);
    }
  };
  const stages = [
    () => {
      cx.clearRect(0, 0, TS, TS);
      const r = lcg(77);
      // soft frost blotches
      for (let i = 0; i < 46; i++) {
        const x = r() * TS, y = r() * TS, rad = 18 + r() * 46;
        wrap((xx, yy) => {
          const g = cx.createRadialGradient(xx, yy, 0, xx, yy, rad);
          g.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.05})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          cx.fillStyle = g; cx.beginPath(); cx.arc(xx, yy, rad, 0, TAU); cx.fill();
        }, x, y, rad);
      }
    },
    () => {
      const r = lcg(1234);
      // pebble: tiny bright droplets with a darker lee side
      for (let i = 0; i < 2600; i++) {
        const x = r() * TS, y = r() * TS, rad = 0.7 + r() * 1.5;
        wrap((xx, yy) => {
          cx.fillStyle = `rgba(80,120,165,${0.1 + r() * 0.12})`; cx.beginPath(); cx.arc(xx + 0.7, yy + 0.9, rad, 0, TAU); cx.fill();
          cx.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.4})`; cx.beginPath(); cx.arc(xx, yy, rad * 0.8, 0, TAU); cx.fill();
        }, x, y, rad + 2);
      }
    },
    () => {
      const r = lcg(909);
      // fine scratches
      cx.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x = r() * TS, y = r() * TS, len = 40 + r() * 140, a = Math.PI / 2 + (r() - 0.5) * 0.5;
        wrap((xx, yy) => {
          cx.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.16})`; cx.lineWidth = 0.7 + r() * 0.8;
          cx.beginPath(); cx.moveTo(xx, yy); cx.lineTo(xx + Math.cos(a) * len, yy + Math.sin(a) * len); cx.stroke();
        }, x, y, 160);
      }
    },
  ];
  return {
    failed: false,
    step(all) {
      do { stages[stage](); stage++; } while (all && stage < stages.length);
      return stage >= stages.length ? cv : null;
    },
  };
}

// ---- the house -----------------------------------------------------------------------------------------------------
// Rings painted on the ice: 12-foot blue, 8-foot white, 4-foot red, button white. (cx, cy) in px, ppm = pixels per metre.
export function drawHouse(ctx, cx, cy, ppm, o = {}) {
  const a = o.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  const ring = (r, fill, edge) => {
    ctx.beginPath(); ctx.arc(cx, cy, r * ppm, 0, TAU); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = Math.max(1, ppm * 0.012); ctx.strokeStyle = edge; ctx.stroke();
  };
  ring(HOUSE_R, 'rgba(38,104,186,0.80)', 'rgba(14,52,110,0.65)');
  ring(EIGHT_R, 'rgba(246,251,255,0.93)', 'rgba(120,160,200,0.7)');
  ring(FOUR_R, 'rgba(204,48,46,0.86)', 'rgba(110,20,20,0.6)');
  ring(BUTTON_R, 'rgba(250,253,255,0.98)', 'rgba(120,160,200,0.7)');
  ctx.restore();
}

// ---- stones --------------------------------------------------------------------------------------------------------
// One granite stone seen from above: shadow, polished running band, coloured handle that turns with the stone.
// rpx = radius in px. o: { a (alpha), ghost, glow (0..1), lift, spin (handle angle), speck (seed) }
export function drawStone(ctx, x, y, rpx, team, ang = 0, o = {}) {
  const T = TEAM[team];
  const a = o.a ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  if (!o.ghost) {
    // soft shadow and a faint reflection of the handle colour on the ice
    const sx = x + rpx * 0.16, sy = y + rpx * 0.3;
    let g = ctx.createRadialGradient(sx, sy, rpx * 0.5, sx, sy, rpx * 1.55);
    g.addColorStop(0, 'rgba(8,24,44,0.42)'); g.addColorStop(1, 'rgba(8,24,44,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rpx * 1.55, 0, TAU); ctx.fill();
    g = ctx.createRadialGradient(x, y + rpx * 0.95, 0, x, y + rpx * 0.95, rpx * 0.95);
    g.addColorStop(0, T.glow.replace('0.9', '0.2')); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + rpx * 0.95, rpx * 0.95, 0, TAU); ctx.fill();
  }
  if ((o.glow ?? 0) > 0) {
    const g = ctx.createRadialGradient(x, y, rpx, x, y, rpx * 2.4);
    g.addColorStop(0, T.glow.replace('0.9', String(0.6 * o.glow))); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rpx * 2.4, 0, TAU); ctx.fill();
  }
  // granite body
  let g = ctx.createRadialGradient(x - rpx * 0.4, y - rpx * 0.45, rpx * 0.1, x, y, rpx * 1.02);
  g.addColorStop(0, '#c4c9cf'); g.addColorStop(0.55, '#8b9097'); g.addColorStop(1, '#3a3e45');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rpx, 0, TAU); ctx.fill();
  // the darker striking band and the lighter running surface
  ctx.lineWidth = Math.max(1, rpx * 0.16); ctx.strokeStyle = 'rgba(40,44,52,0.55)';
  ctx.beginPath(); ctx.arc(x, y, rpx * 0.86, 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(0.8, rpx * 0.05); ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath(); ctx.arc(x, y, rpx * 0.98, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
  // granite speckle (fixed pattern per stone)
  const r = lcg(((o.speck ?? 1) * 7919) >>> 0);
  for (let i = 0; i < 16; i++) {
    const t = r() * TAU, d = Math.sqrt(r()) * rpx * 0.9;
    ctx.fillStyle = r() < 0.5 ? 'rgba(30,34,40,0.35)' : 'rgba(235,238,242,0.4)';
    ctx.beginPath(); ctx.arc(x + Math.cos(t) * d, y + Math.sin(t) * d, Math.max(0.5, rpx * 0.045), 0, TAU); ctx.fill();
  }
  // the handle: a coloured disc with a grip bar that turns as the stone rotates
  const hr = rpx * 0.62;
  g = ctx.createRadialGradient(x - hr * 0.35, y - hr * 0.4, hr * 0.1, x, y, hr);
  g.addColorStop(0, T.hi); g.addColorStop(0.5, T.main); g.addColorStop(1, T.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(0.8, rpx * 0.05); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const bw = hr * 1.5, bh = hr * 0.34;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-bw / 2 + 0.6, -bh / 2 + 1.2, bw, bh, bh / 2) : ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.fill();
  g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
  g.addColorStop(0, T.hi); g.addColorStop(1, T.main);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2) : ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.fill();
  ctx.restore();
  // specular
  g = ctx.createRadialGradient(x - rpx * 0.5, y - rpx * 0.55, 0, x - rpx * 0.5, y - rpx * 0.55, rpx * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rpx, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- brush heads -------------------------------------------------------------------------------------------------------
// Two abstract brush heads (no people) that sweep across the path in front of a moving stone. effort 0..1.
// (px, py) stone in px; (hx, hy) unit heading in px space (screen), ppm pixels per metre; phase in radians.
export function drawBrushes(ctx, px, py, hx, hy, ppm, effort, phase, team) {
  const T = TEAM[team];
  const nx = -hy, ny = hx;   // across the path
  const heads = [{ ahead: 0.62, ph: phase }, { ahead: 1.1, ph: phase + Math.PI }];
  const amp = (0.2 + 0.2 * effort) * ppm;
  const idle = effort < 0.04;
  for (const hd of heads) {
    for (let k = 3; k >= 0; k--) {          // motion trail: older positions fade out
      const ph = hd.ph - k * 0.55 * (0.4 + effort);
      if (k > 0 && effort < 0.12) continue;
      const off = Math.sin(ph) * (idle ? amp * 0.5 : amp);
      const cx = px + hx * hd.ahead * ppm + nx * off, cy = py + hy * hd.ahead * ppm + ny * off;
      const a = (k === 0 ? 0.96 : 0.2 - k * 0.04) * (idle ? 0.55 : 1);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(cx, cy); ctx.rotate(Math.atan2(ny, nx));
      const w = 0.62 * ppm, h = 0.16 * ppm;
      if (k === 0) {
        ctx.fillStyle = 'rgba(8,24,44,0.28)'; ctx.beginPath(); ctx.ellipse(0.12 * h, 0.7 * h, w * 0.55, h * 0.75, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#1d2c3c'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.4) : ctx.rect(-w / 2, -h / 2, w, h); ctx.fill();
      ctx.fillStyle = T.main; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.42, h * 0.2) : ctx.rect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.42); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      for (let b = -4; b <= 4; b++) { ctx.beginPath(); ctx.moveTo(b * w / 9, h * 0.05); ctx.lineTo(b * w / 9, h * 0.46); ctx.stroke(); }
      ctx.restore();
    }
  }
  void R;
}

// A little flat stone for lists and pages (no shadow).
export function drawMiniStone(ctx, x, y, rpx, team, ang = 0.4) { drawStone(ctx, x, y, rpx, team, ang, { speck: team + 3 }); }
export function ringPath(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); }
