// Drawing of the world: the parlour table, the felt mat with its cup, the winks and the squidgers. All in world units
// (the mat is 600 x 900, a wink radius is 15); the caller sets the transform. Pure drawing, no state.
import { MAT_W, MAT_H, WR, POT, SQUIDGERS } from './sim.js';
import { v3, gfx } from './v3.js';

const TAU = Math.PI * 2;
// 3D-rendered sprites of the winks and squidgers (filled by view3d/presenter.js once WebGL is up). While `ready` is false every
// drawer below uses its flat canvas art, which is also the whole fallback when WebGL is unavailable or the context is lost.
export const sprites = { ready: false, wink: {}, sq: [], K: 192 / 150 };
// Two warm tones for one side, two cool tones for the other; a dot or a ring in the middle marks the side for everyone.
export const TONES = [
  [{ hi: '#ffe08a', mid: '#ffb11f', low: '#b86a00', edge: '#7a4300' }, { hi: '#ffb59a', mid: '#ff5a3c', low: '#a8250f', edge: '#681404' }],
  [{ hi: '#a9ccff', mid: '#2f7bff', low: '#123f9e', edge: '#0a2566' }, { hi: '#b5fff0', mid: '#27cdb8', low: '#0d7c70', edge: '#06504a' }],
];
export const SIDE_NAME = ['Amber', 'Cobalt'];

// ---- table and mat ------------------------------------------------------------------------------------------------
const GRAIN = Array.from({ length: 260 }, (_, i) => {
  const a = (i * 2654435761) % 4294967296;
  return { x: (a % 6000) / 10, y: ((a >>> 8) % 9000) / 10, l: (a >>> 4) % 3 };
});
// The baize with its chalk lines, painted once at P pixels per world unit (the 3D tray and the 2D fallback both use it).
let feltCache = null;
export function paintFeltCanvas(P = 1.2) {
  if (feltCache && feltCache.P === P) return feltCache.c;
  if (!gfx.mk) return null;
  const c = gfx.mk(Math.round(MAT_W * P), Math.round(MAT_H * P));
  const x = c.getContext('2d'); x.scale(P, P);
  const g = x.createRadialGradient(MAT_W / 2, MAT_H * 0.46, 40, MAT_W / 2, MAT_H / 2, MAT_H * 0.7);
  g.addColorStop(0, '#1d8559'); g.addColorStop(0.6, '#136e49'); g.addColorStop(1, '#0b4a32');
  x.fillStyle = g; x.fillRect(0, 0, MAT_W, MAT_H);
  let s = 12345; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 90; k++) { const bx = rnd() * MAT_W, by = rnd() * MAT_H, br = 30 + rnd() * 90, bg = x.createRadialGradient(bx, by, 0, bx, by, br); const light = rnd() < 0.5; bg.addColorStop(0, light ? 'rgba(120,230,170,0.05)' : 'rgba(0,30,20,0.07)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = bg; x.fillRect(bx - br, by - br, br * 2, br * 2); }
  for (let k = 0; k < 9000; k++) {
    const fx = rnd() * MAT_W, fy = rnd() * MAT_H, a = rnd() * TAU, l = 2 + rnd() * 5, light = rnd() < 0.5;
    x.strokeStyle = light ? `rgba(170,255,210,${0.04 + rnd() * 0.08})` : `rgba(0,25,15,${0.06 + rnd() * 0.1})`; x.lineWidth = 0.8 + rnd();
    x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l); x.stroke();
  }
  x.strokeStyle = 'rgba(247,241,225,0.5)'; x.lineWidth = 2.6; x.setLineDash([16, 12]); x.lineCap = 'round';
  for (const y of [MAT_H - 66, 66, MAT_H / 2]) { x.beginPath(); x.moveTo(24, y); x.lineTo(MAT_W - 24, y); x.stroke(); }
  x.setLineDash([]); x.strokeStyle = 'rgba(247,241,225,0.34)'; x.lineWidth = 3;
  x.beginPath(); x.arc(POT.x, POT.y, 118, 0, TAU); x.stroke();
  x.beginPath(); x.arc(POT.x, POT.y, 190, 0, TAU); x.strokeStyle = 'rgba(247,241,225,0.16)'; x.stroke();
  feltCache = { P, c };
  return c;
}
export function drawMat(ctx, o = {}) {
  const pad = 46;
  // walnut surround with a bevel
  ctx.save();
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  rr(-pad, -pad, MAT_W + 2 * pad, MAT_H + 2 * pad, 46);
  const wg = ctx.createLinearGradient(0, -pad, 0, MAT_H + pad);
  wg.addColorStop(0, '#5a3820'); wg.addColorStop(0.5, '#43271a'); wg.addColorStop(1, '#2e1a10');
  ctx.fillStyle = wg; ctx.fill();
  ctx.restore();
  ctx.save();
  rr(-pad, -pad, MAT_W + 2 * pad, MAT_H + 2 * pad, 46);
  ctx.clip();
  ctx.strokeStyle = 'rgba(20,8,2,0.35)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 26; i++) {
    const y = -pad + 6 + i * 38 + (i % 3) * 5;
    ctx.beginPath(); ctx.moveTo(-pad, y); ctx.bezierCurveTo(MAT_W * 0.3, y + 6, MAT_W * 0.7, y - 7, MAT_W + pad, y + 2); ctx.stroke();
  }
  ctx.restore();
  rr(-pad + 3, -pad + 3, MAT_W + 2 * pad - 6, MAT_H + 2 * pad - 6, 43);
  ctx.strokeStyle = 'rgba(255,214,150,0.28)'; ctx.lineWidth = 3; ctx.stroke();
  // brass edge strip
  rr(-10, -10, MAT_W + 20, MAT_H + 20, 28);
  const bg = ctx.createLinearGradient(0, 0, MAT_W, MAT_H);
  bg.addColorStop(0, '#f0cf7a'); bg.addColorStop(0.5, '#a97d28'); bg.addColorStop(1, '#e3bb60');
  ctx.fillStyle = bg; ctx.fill();
  // felt
  rr(0, 0, MAT_W, MAT_H, 20);
  if (gfx.mk && sprites.ready) { ctx.save(); ctx.clip(); ctx.drawImage(paintFeltCanvas(0.9), 0, 0, MAT_W, MAT_H); ctx.restore(); rr(0, 0, MAT_W, MAT_H, 20); }
  else {
  const fg = ctx.createRadialGradient(MAT_W / 2, MAT_H * 0.46, 40, MAT_W / 2, MAT_H / 2, MAT_H * 0.66);
  fg.addColorStop(0, '#15897f'); fg.addColorStop(0.55, '#0e6a67'); fg.addColorStop(1, '#073f47');
  ctx.fillStyle = fg; ctx.fill();
  ctx.save();
  ctx.clip();
  for (const g of GRAIN) {
    ctx.fillStyle = g.l === 0 ? 'rgba(255,255,255,0.05)' : g.l === 1 ? 'rgba(0,30,30,0.12)' : 'rgba(180,255,240,0.05)';
    ctx.fillRect(g.x, g.y, 2, 2);
  }
  // baselines and the centre line
  ctx.strokeStyle = 'rgba(247,241,225,0.32)'; ctx.lineWidth = 2; ctx.setLineDash([14, 12]);
  for (const y of [MAT_H - 66, 66, MAT_H / 2]) { ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(MAT_W - 20, y); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(247,241,225,0.2)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(POT.x, POT.y, 118, 0, TAU); ctx.stroke();
  // soft lamp light from above and a darker edge
  const lamp = ctx.createRadialGradient(MAT_W * 0.5, MAT_H * 0.42, 20, MAT_W * 0.5, MAT_H * 0.5, MAT_H * 0.7);
  lamp.addColorStop(0, 'rgba(255,245,200,0.14)'); lamp.addColorStop(1, 'rgba(0,12,16,0.4)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, MAT_W, MAT_H);
  ctx.restore();
  }
  rr(0, 0, MAT_W, MAT_H, 20);
  ctx.strokeStyle = 'rgba(0,20,24,0.7)'; ctx.lineWidth = 3; ctx.stroke();
  drawCup(ctx, o.cupGlow ?? 0);
}

export function drawCup(ctx, glow = 0) {
  const { x, y, r } = POT;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(x + 3, y + 6, r + 7, 0, TAU); ctx.fill();
  const br = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  br.addColorStop(0, '#fff0b0'); br.addColorStop(0.45, '#c8922c'); br.addColorStop(1, '#6e4a10');
  ctx.fillStyle = br; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, TAU); ctx.fill();
  const inner = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, r);
  inner.addColorStop(0, '#12090a'); inner.addColorStop(0.7, '#050303'); inner.addColorStop(1, '#2a1a10');
  ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,214,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 5, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  if (glow > 0) { ctx.strokeStyle = `rgba(255,236,150,${0.8 * glow})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r + 10 + 18 * (1 - glow), 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// ---- winks --------------------------------------------------------------------------------------------------------
// o: { side, tone, z (pile level), lift (0..1 in the air), a (alpha), sel (0..1 glow), spin, sq (squash 0..1), r (radius) }
export function drawWink(ctx, x, y, o = {}) {
  const { side = 0, tone = 0, z = 0, lift = 0, a = 1, sel = 0, spin = 0, sq = 0, r = WR } = o;
  const T = TONES[side][tone % 2];
  const R = r * (1 + lift * 0.35);
  const lz = Math.min(z, 3) * 4;
  ctx.save();
  ctx.globalAlpha = a;
  // cast shadow stays on the felt while the wink rises
  ctx.fillStyle = `rgba(0,18,20,${0.42 - lift * 0.18})`;
  ctx.beginPath(); ctx.ellipse(x + 3 + lift * 16 - lz * 0.2, y + 5 + lift * 22, r * (1 - lift * 0.15) + 1, r * 0.82 * (1 - lift * 0.15), 0, 0, TAU); ctx.fill();
  const cy = y - lift * 26 - lz;
  if (sel > 0) {
    ctx.strokeStyle = `rgba(255,248,200,${0.5 + 0.4 * sel})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, cy, R + 7 + 2 * sel, 0, TAU); ctx.stroke();
  }
  ctx.translate(x, cy);
  if (sq) ctx.scale(1 + 0.12 * sq, 1 - 0.1 * sq);
  const sp = sprites.ready && sprites.wink[`${side}${tone % 2}`];
  if (sp) { const d = R * 2 * sprites.K; ctx.rotate(spin * 0.4); ctx.drawImage(sp, -d / 2, -d / 2, d, d); ctx.restore(); return; }
  // thick edge
  ctx.fillStyle = T.edge; ctx.beginPath(); ctx.arc(0, 3, R, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-R * 0.4, -R * 0.45, R * 0.1, 0, 0, R * 1.05);
  g.addColorStop(0, T.hi); g.addColorStop(0.45, T.mid); g.addColorStop(1, T.low);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  // dished face
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = R * 0.12;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.66, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = R * 0.08;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.52, Math.PI * 1.05 + spin, Math.PI * 1.8 + spin); ctx.stroke();
  // side mark: a dot for amber, a ring for cobalt
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  if (side === 0) { ctx.beginPath(); ctx.arc(0, 0, R * 0.17, 0, TAU); ctx.fill(); }
  else { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = R * 0.1; ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, TAU); ctx.stroke(); }
  // highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1.4, R * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, R * 0.86, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}

// ---- squidgers ----------------------------------------------------------------------------------------------------
const SQ_TINT = [
  { a: '#eaffff', b: '#7fd6f5', c: '#2a7ea0' },
  { a: '#fff7dc', b: '#ffd27a', c: '#b87d10' },
  { a: '#ffe7e0', b: '#ff8f7c', c: '#a82b1e' },
];
// A big translucent acrylic disc. `press` 0..1 darkens it a little as it bears down.
export function drawSquidger(ctx, x, y, id, o = {}) {
  const { a = 1, press = 0, r = SQUIDGERS[id].r, ang = 0 } = o;
  const T = SQ_TINT[id];
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,18,20,0.35)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 7, r, r * 0.9, 0, 0, TAU); ctx.fill();
  const sp = sprites.ready && sprites.sq[id];
  if (sp) { const d = r * 2 * sprites.K; ctx.globalAlpha = a * (1 - 0.06 * press); ctx.drawImage(sp, x - d / 2, y - d / 2, d, d); ctx.restore(); return; }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, T.a); g.addColorStop(0.6, T.b); g.addColorStop(1, T.c);
  ctx.globalAlpha = a * (0.86 - 0.08 * press);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = a;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.stroke();
  // thumb dimple and a sparkle
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.26, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, Math.PI * 1.1 + ang * 0, Math.PI * 1.4); ctx.stroke();
  ctx.restore();
}

// Table surround seen behind menus (screen space, no world transform).
export function drawBackdrop(ctx, W, H) {
  if (v3.on) { ctx.clearRect(0, 0, W, H); return; }   // the 3D room shows through the transparent canvas
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#142522'); g.addColorStop(1, '#0a1211');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(255,240,190,0.07)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
