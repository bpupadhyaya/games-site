// Drawing primitives: the schoolyard backdrop, the dirt arena (baked once), and the marbles (lit, shaded glass and clay).
// Pure drawing, no game state. Everything is original and drawn in code.
import { RR, RA, RT, R_T, R_S } from './sim.js';

export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
const TAU = Math.PI * 2;
export const SIDE = [
  { name: 'cobalt', c0: '#69c4ff', c1: '#1766c8', c2: '#0a2c66', rib: '#f4fbff', glow: 'rgba(90,180,255,0.95)', hud: '#58b8ff' },
  { name: 'ember', c0: '#ffb067', c1: '#e2501c', c2: '#7a1c0a', rib: '#fff2d8', glow: 'rgba(255,140,80,0.95)', hud: '#ff8a4c' },
];
const CLAY = [['#e0925a', '#8a4422'], ['#d4b268', '#7a5a22'], ['#b86a48', '#5a2a18'], ['#9fa862', '#4a5826'], ['#d27c78', '#7a2c32']];
const GLASS = [
  { core: '#37b4ea', a: '#f2fbff', b: '#1458b4' }, { core: '#46d08a', a: '#f2ffd8', b: '#14804e' }, { core: '#b268ea', a: '#ffe6ff', b: '#54269a' },
  { core: '#ffb040', a: '#fff3c8', b: '#c2501a' }, { core: '#ff6c98', a: '#ffe8f0', b: '#9c1c48' },
];

// ---- host (off-screen surfaces) ----------------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };   // decoration only

// ---- backdrop: grass seen from above, lit from the upper left --------------------------------------------------
let grassTile; // undefined = not tried, null = cannot bake, canvas = ready
function bakeGrass(ctx) {
  setHost(ctx);
  const c = makeCanvas(512, 512);
  if (!c) return null;
  const g = c.getContext('2d'), r = lcg(77);
  g.fillStyle = '#2e5230'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const x = r() * 512, y = r() * 512, rad = 40 + r() * 90, a = r() < 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, a ? 'rgba(96,142,70,0.30)' : 'rgba(14,40,24,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) { if (Math.abs(x + dx - 256) < 256 + rad && Math.abs(y + dy - 256) < 256 + rad) { g.save(); g.translate(dx, dy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); } }
  }
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = r() * 512, y = r() * 512, len = 5 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 1.1, light = r();
    g.strokeStyle = light < 0.5 ? `rgba(150,205,110,${0.12 + r() * 0.2})` : `rgba(8,34,18,${0.14 + r() * 0.2})`;
    g.lineWidth = 1 + r() * 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  return c;
}
export function drawBackdrop(ctx, W, H, cx = W / 2, cy = H / 2) {
  if (grassTile === undefined) grassTile = bakeGrass(ctx);
  ctx.fillStyle = '#2c4e2e'; ctx.fillRect(0, 0, W, H);
  if (grassTile) { for (let y = 0; y < H; y += 512) for (let x = 0; x < W; x += 512) ctx.drawImage(grassTile, x, y, 513, 513); }
  const big = Math.max(W, H), g = ctx.createRadialGradient(cx, cy, 120, cx, cy, big * 0.78);
  g.addColorStop(0, 'rgba(255,236,170,0.20)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(2,14,10,0.74)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---- the arena (origin = ring centre), baked once ------------------------------------------------------------------
export const ARENA_PX = 2 * (RA + 44);
let arena;
function paintArena(g) {
  const r = lcg(2026), S = ARENA_PX / 2;
  g.translate(S, S);
  let gr = g.createRadialGradient(10, 18, RA - 10, 10, 18, RA + 40);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(10, 18, RA + 40, 0, TAU); g.fill();
  // raised earth lip
  gr = g.createLinearGradient(-RA, -RA, RA, RA); gr.addColorStop(0, '#b98d55'); gr.addColorStop(0.5, '#8a6236'); gr.addColorStop(1, '#5a3b1c');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, RA + 20, 0, TAU); g.fill();
  // tamped sand
  gr = g.createRadialGradient(-70, -90, 40, 0, 0, RA + 6);
  gr.addColorStop(0, '#f1dca4'); gr.addColorStop(0.55, '#e0c286'); gr.addColorStop(1, '#c49f62');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, RA + 2, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, RA, 0, TAU); g.clip();
  for (let i = 0; i < 2400; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * RA, x = Math.cos(a) * d, y = Math.sin(a) * d, k = r();
    g.fillStyle = k < 0.45 ? `rgba(120,84,40,${0.10 + r() * 0.18})` : k < 0.8 ? `rgba(255,248,222,${0.10 + r() * 0.2})` : `rgba(90,60,30,${0.2 + r() * 0.2})`;
    g.beginPath(); g.arc(x, y, 0.8 + r() * 1.9, 0, TAU); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {   // scuffs where earlier games were played
    const a = r() * TAU, d = r() * (RA - 30), x = Math.cos(a) * d, y = Math.sin(a) * d, l = 14 + r() * 40, b = r() * TAU;
    g.strokeStyle = `rgba(110,76,36,${0.08 + r() * 0.1})`; g.lineWidth = 1 + r() * 2.2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(b) * l * 0.5, y + Math.sin(b) * l * 0.5 + 6, x + Math.cos(b) * l, y + Math.sin(b) * l); g.stroke();
  }
  // shooting line: a faint dotted band
  g.setLineDash([2, 13]); g.strokeStyle = 'rgba(96,64,28,0.45)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, RT, 0, TAU); g.stroke(); g.setLineDash([]);
  // the ring, scratched into the dirt: dark groove, light lip
  g.strokeStyle = 'rgba(70,44,18,0.55)'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, RR, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,248,224,0.55)'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, RR + 4.5, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(60,36,14,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, RR - 3, 0, TAU); g.stroke();
  // small crosshair where the king marble starts
  g.strokeStyle = 'rgba(90,60,26,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.moveTo(0, -9); g.lineTo(0, 9); g.stroke();
  g.restore();
  // pebbles around the lip
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU + (r() - 0.5) * 0.05, d = RA + 8 + r() * 12, x = Math.cos(a) * d, y = Math.sin(a) * d, rad = 3 + r() * 5;
    const pg = g.createRadialGradient(x - rad * 0.3, y - rad * 0.4, 0.5, x, y, rad);
    const tone = 150 + Math.floor(r() * 70);
    pg.addColorStop(0, `rgb(${tone + 30},${tone + 14},${tone - 10})`); pg.addColorStop(1, `rgb(${tone - 70},${tone - 80},${tone - 100})`);
    g.fillStyle = 'rgba(30,18,6,0.4)'; g.beginPath(); g.ellipse(x + 2, y + 3, rad, rad * 0.9, 0, 0, TAU); g.fill();
    g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, rad, rad * 0.88, a, 0, TAU); g.fill();
  }
}
export function ensureArena(ctx) {
  if (arena !== undefined) return arena;
  setHost(ctx);
  const c = makeCanvas(ARENA_PX, ARENA_PX);
  if (!c) { arena = null; return null; }
  paintArena(c.getContext('2d'));
  arena = c;
  return arena;
}
export function drawArena(ctx) {   // origin = ring centre
  const a = ensureArena(ctx);
  if (a) { ctx.drawImage(a, -ARENA_PX / 2, -ARENA_PX / 2); return; }
  const gr = ctx.createRadialGradient(-70, -90, 40, 0, 0, RA + 6);   // hosts that cannot bake (headless): flat but lit
  gr.addColorStop(0, '#f1dca4'); gr.addColorStop(1, '#c49f62');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, RA + 2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(70,44,18,0.55)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, RR, 0, TAU); ctx.stroke();
}

// ---- marbles -------------------------------------------------------------------------------------------------------
function shadow(ctx, x, y, r, lift = 0) {
  const sx = x + r * (0.26 + lift * 0.02), sy = y + r * (0.42 + lift * 0.035), rad = r * 1.18;
  const g = ctx.createRadialGradient(sx, sy, r * 0.25, sx, sy, rad);
  g.addColorStop(0, `rgba(40,22,6,${0.5 - lift * 0.01})`); g.addColorStop(1, 'rgba(40,22,6,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.fill();
  const ao = ctx.createRadialGradient(x + r * 0.1, y + r * 0.22, r * 0.5, x + r * 0.1, y + r * 0.22, r * 1.12);   // tight contact shadow
  ao.addColorStop(0, `rgba(30,16,4,${0.55 - lift * 0.02})`); ao.addColorStop(1, 'rgba(30,16,4,0)');
  ctx.fillStyle = ao; ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.22, r * 1.12, 0, TAU); ctx.fill();
}
function bands(ctx, r, rot, ra, A, B, count = 5, width = 0.3) {
  ctx.save(); ctx.rotate(ra);
  for (let k = 0; k < count; k++) {
    const ph = rot * 0.95 + k * (TAU / count), c = Math.cos(ph);
    if (c <= 0.04) continue;
    const u = Math.sin(ph) * r * 0.9, rx = Math.max(0.6, r * width * c);
    ctx.fillStyle = k % 2 ? B : A; ctx.globalAlpha = 0.9 * Math.min(1, c * 1.8);
    ctx.beginPath(); ctx.ellipse(u, 0, rx, r * 1.02, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// A lit sphere. spec: { kind, variant, side }. o: { rot, ra, lift, heat, a, ghost }
export function drawMarble(ctx, x, y, r, spec, o = {}) {
  const { rot = 0, ra = 0, lift = 0, heat = 0, a = 1, ghost = false } = o;
  ctx.save();
  if (a < 1) ctx.globalAlpha = a;
  if (!ghost) shadow(ctx, x, y - lift, r, lift);
  const yy = y - lift;
  if (heat > 0.05) { const g = ctx.createRadialGradient(x, yy, r * 0.8, x, yy, r * 2.0); g.addColorStop(0, `rgba(255,248,200,${0.55 * heat})`); g.addColorStop(1, 'rgba(255,248,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, yy, r * 2.0, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, yy, r, 0, TAU); ctx.save(); ctx.clip();
  ctx.translate(x, yy);
  const sh = spec.kind === 'shooter', S = sh ? SIDE[spec.side] : null;
  const glass = sh || spec.kind === 'glass', k = spec.kind === 'king';
  let c0, c1, c2;
  if (sh) { c0 = S.c0; c1 = S.c1; c2 = S.c2; }
  else if (k) { c0 = '#fff0a0'; c1 = '#e0a020'; c2 = '#6a3c06'; }
  else if (glass) { const G = GLASS[spec.variant % 5]; c0 = G.a; c1 = G.core; c2 = G.b; }
  else { const C = CLAY[spec.variant % 5]; c0 = C[0]; c1 = C[0]; c2 = C[1]; }
  const base = ctx.createRadialGradient(-r * 0.32, -r * 0.4, r * 0.05, 0, 0, r * 1.05);
  base.addColorStop(0, c0); base.addColorStop(0.45, c1); base.addColorStop(1, c2);
  ctx.fillStyle = base; ctx.fillRect(-r, -r, r * 2, r * 2);
  if (sh) bands(ctx, r, rot, ra, S.rib, S.c2, 4, 0.2);
  else if (k) bands(ctx, r, rot + 1, ra, '#fff3b8', '#8a4a06', 6, 0.16);
  else if (glass) { const G = GLASS[spec.variant % 5]; bands(ctx, r, rot + spec.variant, ra, G.a, G.b, 5, 0.26); }
  else {   // clay: speckles that roll with the marble
    for (let i = 0; i < 7; i++) {
      const ph = rot * 0.95 + i * 2.1 + spec.variant, cc = Math.cos(ph);
      if (cc <= 0.1) continue;
      const lat = ((i * 53 + spec.variant * 17) % 100) / 100 - 0.5;
      ctx.save(); ctx.rotate(ra); ctx.fillStyle = i % 2 ? 'rgba(255,240,200,0.5)' : 'rgba(60,28,10,0.45)';
      ctx.beginPath(); ctx.arc(Math.sin(ph) * r * 0.85, lat * r * 1.5, r * 0.09 * cc + 0.4, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  // inner glow on the shadow side (light passing through glass)
  if (glass || k) { const cg = ctx.createRadialGradient(r * 0.42, r * 0.48, 0, r * 0.42, r * 0.48, r * 0.7); cg.addColorStop(0, 'rgba(255,255,255,0.38)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = cg; ctx.fillRect(-r, -r, r * 2, r * 2); }
  // light bounced up from the sand along the lower-right rim
  { const rg = ctx.createRadialGradient(r * 0.2, r * 0.25, r * 0.72, r * 0.2, r * 0.25, r * 1.05); rg.addColorStop(0, 'rgba(255,230,170,0)'); rg.addColorStop(1, glass ? 'rgba(255,225,160,0.38)' : 'rgba(255,225,160,0.2)'); ctx.fillStyle = rg; ctx.fillRect(-r, -r, r * 2, r * 2); }
  // limb darkening
  const ed = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.02);
  ed.addColorStop(0, 'rgba(8,8,24,0)'); ed.addColorStop(1, glass ? 'rgba(6,10,40,0.5)' : 'rgba(30,14,4,0.5)');
  ctx.fillStyle = ed; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  // specular highlight and a small second glint
  ctx.save(); ctx.translate(x, yy);
  ctx.rotate(-0.6);
  const hl = ctx.createRadialGradient(-r * 0.22, -r * 0.5, 0, -r * 0.22, -r * 0.5, r * 0.5);
  hl.addColorStop(0, `rgba(255,255,255,${glass || k ? 0.95 : 0.55})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.5, r * 0.46, r * 0.26, 0, 0, TAU); ctx.fill();
  ctx.rotate(0.6);
  if (glass || k) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(r * 0.46, r * 0.4, r * 0.09, 0, TAU); ctx.fill(); }
  ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(20,12,4,0.45)'; ctx.beginPath(); ctx.arc(0, 0, r - 0.4, 0, TAU); ctx.stroke();
  ctx.restore();
  if (ghost) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(x, yy, r + 3, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
export const specOf = (b) => ({ kind: b.kind, variant: b.variant ?? 0, side: b.side ?? 0 });
export const radiusOf = (kind) => (kind === 'shooter' ? R_S : R_T);
