// Art: the club green (seen from above), glossy bowls and the jack. All procedural. A small grain tile is baked once with
// OffscreenCanvas when the host has it; everything else is plain canvas drawing, so headless runs and old webviews still render.
import { RINK } from './sim.js';

const TAU = Math.PI * 2;
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
const newCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
};
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";

// ---- the two sets of bowls -----------------------------------------------------------------------------------
export const TEAM = [
  { name: 'Black', hi: '#8a9099', mid: '#2c2e36', low: '#08090c', rim: '#000000', decal: '#d8402f', decalHi: '#ff8a70', groove: 'rgba(255,255,255,0.16)', glow: '#ff7a68', text: '#ffffff' },
  { name: 'Ivory', hi: '#ffffff', mid: '#efe5c6', low: '#a89b72', rim: '#5d5438', decal: '#2a68c8', decalHi: '#8cb8ff', groove: 'rgba(70,58,24,0.28)', glow: '#7fb0ff', text: '#14243a' },
];

// A bowl seen from above at screen position (x, y), radius r (px). `bx, by` is the unit screen direction of its bias side (the small ring).
export function drawBowl(ctx, x, y, r, team, o = {}) {
  const P = TEAM[team] ?? TEAM[0], a = o.alpha ?? 1;
  ctx.save();
  if (a < 1) ctx.globalAlpha = a;
  if (o.shadow !== false) {
    const sx = x + r * 0.45, sy = y + r * 0.6;
    const g = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 1.35);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 1.35, 0, TAU); ctx.fill();
  }
  // body
  const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.36, r * 0.1, x, y, r * 1.02);
  g.addColorStop(0, P.hi); g.addColorStop(0.42, P.mid); g.addColorStop(1, P.low);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.09); ctx.strokeStyle = P.rim; ctx.stroke();
  if (r >= 4) {
    // the running surface ring and the decal disc
    ctx.strokeStyle = P.groove; ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.stroke();
    const dg = ctx.createRadialGradient(x - r * 0.08, y - r * 0.1, r * 0.02, x, y, r * 0.36);
    dg.addColorStop(0, P.decalHi); dg.addColorStop(1, P.decal);
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, TAU); ctx.fill();
    // the small ring: marks the bias side
    if (o.bx !== undefined && r >= 6) {
      const cx = x + o.bx * r * 0.8, cy = y + o.by * r * 0.8;
      ctx.strokeStyle = team === 0 ? 'rgba(255,255,255,0.8)' : 'rgba(40,30,10,0.65)'; ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, 0, TAU); ctx.stroke();
    }
    // window highlight
    const hl = ctx.createRadialGradient(x - r * 0.38, y - r * 0.44, 0, x - r * 0.38, y - r * 0.44, r * 0.42);
    hl.addColorStop(0, 'rgba(255,255,255,0.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.44, r * 0.42, 0, TAU); ctx.fill();
  }
  if (o.toucher) {
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.42, y - r * 0.38); ctx.lineTo(x + r * 0.42, y - r * 0.38); ctx.moveTo(x, y - r * 0.38); ctx.lineTo(x, y + r * 0.46); ctx.stroke();
  }
  ctx.restore();
}
export function drawJack(ctx, x, y, r, o = {}) {
  ctx.save();
  if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = o.alpha;
  if (o.shadow !== false) {
    const sx = x + r * 0.5, sy = y + r * 0.65, g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.5);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 1.5, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#f2f0e6'); g.addColorStop(1, '#a9a58e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(0.8, r * 0.14); ctx.strokeStyle = 'rgba(40,36,20,0.75)'; ctx.stroke();
  ctx.restore();
}
// icon versions for menus and cards (no bias mark)
export function drawBowlIcon(ctx, x, y, r, team, alpha = 1, o = {}) {
  if (team < 0) { drawJack(ctx, x, y, r, { alpha, shadow: o.shadow }); return; }
  drawBowl(ctx, x, y, r, team, { alpha, shadow: o.shadow, bx: o.bias === undefined ? undefined : o.bias, by: 0 });
}

// ---- the green -----------------------------------------------------------------------------------------------
const GREEN = { xL: -(RINK.half + 4.6 * 2), xR: RINK.half + 4.6 * 3, y0: -3.6, y1: RINK.bank + 0.6 };
let grain = null, grainTried = false;
function grainTile() {
  if (grainTried) return grain;
  grainTried = true;
  const c = newCanvas(192, 192);
  if (!c) return null;
  const x = c.getContext('2d'), r = lcg(97);
  for (let i = 0; i < 1500; i++) {
    const px = 2 + r() * 188, py = 2 + r() * 188, l = 2 + r() * 5, dark = r() < 0.5;
    x.strokeStyle = dark ? `rgba(10,50,10,${0.06 + r() * 0.1})` : `rgba(210,255,170,${0.05 + r() * 0.1})`;
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 2, py - l); x.stroke();
  }
  grain = c;
  return c;
}

// rectangle in world coordinates -> screen rectangle
const wrect = (pr, x0, y0, x1, y1) => {
  const a = pr.p(x0, y0), b = pr.p(x1, y1);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
};
const fillW = (ctx, pr, x0, y0, x1, y1, col) => { const r = wrect(pr, x0, y0, x1, y1); ctx.fillStyle = col; ctx.fillRect(r.x, r.y, r.w, r.h); };
const lineW = (ctx, pr, x0, y0, x1, y1) => { const a = pr.p(x0, y0), b = pr.p(x1, y1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

export function drawGreen(ctx, view, pr, o = {}) {
  setHost(ctx);
  const s = pr.s, wide = pr.wide, G = GREEN;
  ctx.save();
  ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
  // outside the green: a hedge, a gravel path, then the lawn
  ctx.fillStyle = '#1d4a2a'; ctx.fillRect(view.x, view.y, view.w, view.h);
  fillW(ctx, pr, G.xL - 3.4, G.y0 - 3.4, G.xR + 3.4, G.y1 + 3.4, '#244f2e');
  fillW(ctx, pr, G.xL - 2.2, G.y0 - 2.2, G.xR + 2.2, G.y1 + 2.2, '#cdbf9c');
  fillW(ctx, pr, G.xL - 2.2, G.y0 - 2.2, G.xR + 2.2, G.y0 - 2.0, '#b3a47f');
  // mown stripes along the rinks
  const sw = 1.15;
  const first = Math.floor(G.xL / sw);
  for (let i = first; i * sw < G.xR; i++) {
    const x0 = Math.max(G.xL, i * sw), x1 = Math.min(G.xR, (i + 1) * sw);
    if (x1 <= x0) continue;
    const inRink = x0 >= -RINK.half - 1e-6 && x1 <= RINK.half + 1e-6;
    const even = ((i % 2) + 2) % 2 === 0;
    const col = inRink ? (even ? '#6fbd57' : '#65b24f') : (even ? '#59a648' : '#52a043');
    fillW(ctx, pr, x0, G.y0, x1, G.y1 - 0.6, col);
  }
  // the active rink is lifted a touch: a light edge glow
  fillW(ctx, pr, -RINK.half, 0, RINK.half, RINK.ditch, 'rgba(255,255,220,0.04)');
  // ditch and bank
  fillW(ctx, pr, G.xL, RINK.ditch, G.xR, RINK.bank, '#bfa97a');
  fillW(ctx, pr, G.xL, RINK.ditch, G.xR, RINK.ditch + 0.08, 'rgba(60,40,10,0.35)');
  fillW(ctx, pr, G.xL, RINK.bank, G.xR, G.y1, '#efe9d6');
  fillW(ctx, pr, G.xL, RINK.bank, G.xR, RINK.bank + 0.07, 'rgba(0,0,0,0.3)');
  fillW(ctx, pr, G.xL, RINK.bank + 0.36, G.xR, RINK.bank + 0.42, '#2f7d3a');
  // strings and pegs
  ctx.lineCap = 'round';
  for (let k = -3; k <= 4; k++) {
    const x = -RINK.half + k * 4.6;
    if (x < G.xL - 0.01 || x > G.xR + 0.01) continue;
    const act = k === 0 || k === 1;
    ctx.strokeStyle = act ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = act ? Math.max(1.4, s * 0.045) : Math.max(1, s * 0.03);
    lineW(ctx, pr, x, 0, x, RINK.ditch);
    for (const py of [0, RINK.ditch - 0.05]) {
      const p = pr.p(x, py), pr2 = Math.max(1.6, s * 0.06);
      ctx.fillStyle = act ? '#fff' : 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(p.x, p.y, pr2, 0, TAU); ctx.fill();
    }
  }
  // distance ticks on the right string of the active rink
  if (s >= 10) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `600 ${Math.round(clampN(s * 0.4, 17, 24))}px ${FONT}`; ctx.textBaseline = 'middle';
    for (let d = 5; d <= 30; d += 5) {
      const p = pr.p(RINK.half, d), t = pr.p(RINK.half + 0.4, d);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; lineW(ctx, pr, RINK.half - 0.02, d, RINK.half - 0.3, d);
      ctx.textAlign = wide ? 'center' : 'right';
      const lab = `${d} m`;
      if (wide) ctx.fillText(lab, p.x, p.y - 16); else ctx.fillText(lab, p.x - 36, p.y);
    }
    // the minimum length for the jack
    if (o.minJack) {
      ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,236,150,0.9)'; ctx.lineWidth = 2;
      lineW(ctx, pr, -RINK.half, RINK.minJack, RINK.half, RINK.minJack); ctx.setLineDash([]);
    }
  }
  // the mat
  {
    const r = wrect(pr, -0.2, -0.64, 0.2, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(r.x + 2, r.y + 3, r.w, r.h);
    ctx.fillStyle = '#2c3034'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#8b9096'; ctx.lineWidth = Math.max(1, s * 0.02); ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
  // beyond the bank: flower beds
  if (s > 6) {
    const rnd = lcg(31), cols = ['#e8506a', '#f4c542', '#ffffff', '#b06be0', '#ff8a3c'];
    for (let i = 0; i < 90; i++) {
      const x = G.xL + rnd() * (G.xR - G.xL), y = RINK.bank + 0.6 + rnd() * 0.9, c = cols[Math.floor(rnd() * cols.length)];
      const p = pr.p(x, y);
      if (p.x < view.x - 10 || p.x > view.x + view.w + 10 || p.y < view.y - 10 || p.y > view.y + view.h + 10) continue;
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, s * 0.09), 0, TAU); ctx.fill();
    }
  }
  // grain
  const tile = grainTile();
  if (tile && typeof ctx.createPattern === 'function') {
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      const k = (s * 2.2) / 192, o0 = pr.p(0, 0);
      ctx.save(); ctx.translate(o0.x, o0.y); ctx.scale(k, k);
      ctx.fillStyle = pat; ctx.fillRect((view.x - o0.x) / k, (view.y - o0.y) / k, view.w / k, view.h / k);
      ctx.restore();
    }
  }
  // light from the top left, a soft edge fall-off
  {
    const g = ctx.createLinearGradient(view.x, view.y, view.x + view.w, view.y + view.h);
    g.addColorStop(0, 'rgba(255,255,215,0.10)'); g.addColorStop(0.5, 'rgba(255,255,215,0)'); g.addColorStop(1, 'rgba(0,25,0,0.16)');
    ctx.fillStyle = g; ctx.fillRect(view.x, view.y, view.w, view.h);
  }
  ctx.restore();
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
export { GREEN };
