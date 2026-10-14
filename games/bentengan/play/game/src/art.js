// Bentengan art: a sunny village field seen from above. The field, forts and jails are painted ONCE into cached layers; the players
// are drawn live as lit top-down figures. One soft light from the upper left. Everything is in canonical court units (720 x 960).
import { COURT, POLE, JAIL, FORT_R, JAIL_R } from './engine.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export const TEAM = {
  H: { main: '#ff5d93', dark: '#c21f5c', light: '#ffb0cc', trim: '#fff1f6', name: 'Pink' },
  C: { main: '#36b6ff', dark: '#0f6fc2', light: '#a6dcff', trim: '#effaff', name: 'Blue' },
};
const SKIN = ['#e0a574', '#c98a5a', '#b5764a', '#e8b98a'];
const HAIR = ['#24160e', '#1a1a1a', '#3a2214', '#2b1b1b'];

const mk = (w, h, scale, fn) => {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), g = c.getContext('2d'); g.scale(scale, scale); fn(g); return c;
  } catch { return null; }
};
const cache = new Map();
function layer(key, w, h, scale, paint) {
  let e = cache.get(key);
  if (!e) { e = { c: mk(w, h, scale, paint), w, h, paint }; cache.set(key, e); }
  return (ctx, x, y, s = 1, alpha = 1) => {
    if (alpha !== 1) { ctx.save(); ctx.globalAlpha *= alpha; }
    if (e.c) ctx.drawImage(e.c, x, y, e.w * s, e.h * s);
    else { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); e.paint(ctx); ctx.restore(); }
    if (alpha !== 1) ctx.restore();
  };
}

// --- grass tile for the whole screen behind the field --------------------------------------------------------------
function paintGrass(g) {
  const r = lcg(9);
  g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) { const light = r() > 0.5; g.fillStyle = light ? `rgba(170,230,110,${0.05 + r() * 0.1})` : `rgba(10,60,20,${0.06 + r() * 0.1})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 0.8 + r() * 2.4, 0.5 + r() * 5, r() * 3, 0, TAU); g.fill(); }
}
const grass = layer('grass', 256, 256, 1, paintGrass);
let pat = null, patCtx = null;
export function drawBackdrop(ctx, W, H, tint = 0) {
  if (patCtx !== ctx) { pat = null; patCtx = ctx; grass(ctx, -9999, -9999); const e = cache.get('grass'); if (e && e.c && ctx.createPattern) pat = ctx.createPattern(e.c, 'repeat'); }
  ctx.fillStyle = pat ?? '#3f8f3a'; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(255,255,170,0.08)'); vg.addColorStop(1, `rgba(6,30,24,${0.55 + tint})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// --- the field -----------------------------------------------------------------------------------------------------
function tree(g, x, y, r, seed) {
  const rr = lcg(seed);
  g.fillStyle = 'rgba(8,36,16,0.35)'; g.beginPath(); g.ellipse(x + r * 0.35, y + r * 0.4, r, r * 0.85, 0, 0, TAU); g.fill();
  for (let i = 0; i < 7; i++) {
    const a = rr() * TAU, d = r * 0.45 * rr(), rad = r * (0.5 + rr() * 0.3);
    const gr = g.createRadialGradient(x + Math.cos(a) * d - rad * 0.3, y + Math.sin(a) * d - rad * 0.3, 2, x + Math.cos(a) * d, y + Math.sin(a) * d, rad);
    gr.addColorStop(0, '#79c75a'); gr.addColorStop(0.7, '#2f7d33'); gr.addColorStop(1, '#1b5a28'); g.fillStyle = gr; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rad, 0, TAU); g.fill();
  }
}
function paintField(g) {
  const r = lcg(31), W = COURT.w, H = COURT.h;
  // mown lawn with soft stripes
  const lawn = g.createLinearGradient(0, 0, 0, H); lawn.addColorStop(0, '#6cc04a'); lawn.addColorStop(0.5, '#7bcf55'); lawn.addColorStop(1, '#65b843');
  g.save(); g.shadowColor = 'rgba(0,30,10,0.55)'; g.shadowBlur = 22; g.fillStyle = lawn; g.beginPath(); g.roundRect(18, 74, W - 36, H - 112, 30); g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect(18, 74, W - 36, H - 112, 30); g.clip();
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,170,0.07)' : 'rgba(10,70,20,0.07)'; g.fillRect(0, 74 + i * 78, W, 78); }
  for (let i = 0; i < 1100; i++) { const light = r() > 0.45; g.fillStyle = light ? `rgba(220,255,150,${0.05 + r() * 0.1})` : `rgba(10,80,20,${0.05 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * W, 70 + r() * H, 0.8 + r() * 2, 0.6 + r() * 4, r() * 3, 0, TAU); g.fill(); }
  // worn earth in the middle (trampled path)
  for (let i = 0; i < 500; i++) { const x = 130 + r() * 460, y = 330 + r() * 300; g.fillStyle = `rgba(160,120,70,${0.025 + r() * 0.05})`; g.beginPath(); g.ellipse(x, y, 4 + r() * 18, 2 + r() * 8, r() * 3, 0, TAU); g.fill(); }
  g.restore();
  // chalk boundary and half-way line
  g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,245,0.88)'; g.lineWidth = 5; g.beginPath(); g.roundRect(38, 94, W - 76, H - 152, 20); g.stroke();
  g.setLineDash([22, 18]); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,245,0.55)'; g.beginPath(); g.moveTo(52, H / 2); g.lineTo(W - 52, H / 2); g.stroke(); g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,245,0.5)'; g.lineWidth = 4; g.beginPath(); g.arc(W / 2, H / 2, 54, 0, TAU); g.stroke();
  // bamboo fence along the outside
  const fenceY = [58, H - 36];
  for (const fy of fenceY) {
    g.fillStyle = 'rgba(30,20,6,0.35)'; g.fillRect(14, fy + 4, W - 28, 6);
    for (let x = 22; x < W - 14; x += 22) { const gr = g.createLinearGradient(x - 5, 0, x + 5, 0); gr.addColorStop(0, '#d9c46a'); gr.addColorStop(0.5, '#f4e69a'); gr.addColorStop(1, '#a8913a'); g.fillStyle = gr; g.beginPath(); g.roundRect(x - 5, fy - 12, 10, 26, 4); g.fill(); g.fillStyle = 'rgba(90,70,10,0.4)'; g.fillRect(x - 5, fy + 1, 10, 2); }
    g.fillStyle = '#b79a3c'; g.fillRect(14, fy - 2, W - 28, 5);
  }
  for (const fx of [8, W - 8]) { g.fillStyle = 'rgba(30,20,6,0.35)'; g.fillRect(fx - 4, 60, 10, H - 98); for (let y = 66; y < H - 40; y += 24) { const gr = g.createLinearGradient(0, y, 0, y + 20); gr.addColorStop(0, '#f4e69a'); gr.addColorStop(1, '#a8913a'); g.fillStyle = gr; g.beginPath(); g.roundRect(fx - 7, y, 14, 20, 5); g.fill(); } }
  // trees beyond the fence
  // (kept fully inside the layer so no crown is cut flat at the edge of the field)
  tree(g, 36, 33, 24, 1); tree(g, 150, 30, 20, 2); tree(g, W - 38, 33, 24, 3); tree(g, W - 160, 30, 19, 4);
  tree(g, 36, H - 33, 24, 5); tree(g, 190, H - 30, 20, 6); tree(g, W - 38, H - 33, 24, 7); tree(g, W - 200, H - 30, 19, 8);
  // fort rings: a beaten-earth disc with a rope circle and stakes
  for (const team of ['H', 'C']) {
    const p = POLE[team], T = TEAM[team];
    const gr = g.createRadialGradient(p.x - 20, p.y - 20, 8, p.x, p.y, FORT_R); gr.addColorStop(0, '#e6c48a'); gr.addColorStop(0.8, '#d1a768'); gr.addColorStop(1, '#bf9456');
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, FORT_R, 0, TAU); g.fill();
    for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()) * FORT_R; g.fillStyle = `rgba(110,70,30,${0.05 + r() * 0.1})`; g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1 + r() * 2.5, 0, TAU); g.fill(); }
    g.strokeStyle = T.main; g.lineWidth = 7; g.beginPath(); g.arc(p.x, p.y, FORT_R, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; g.setLineDash([3, 9]); g.beginPath(); g.arc(p.x, p.y, FORT_R, 0, TAU); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.fillStyle = T.dark; g.beginPath(); g.arc(p.x + Math.cos(a) * FORT_R, p.y + Math.sin(a) * FORT_R, 6, 0, TAU); g.fill(); g.fillStyle = T.light; g.beginPath(); g.arc(p.x + Math.cos(a) * FORT_R - 1.5, p.y + Math.sin(a) * FORT_R - 1.5, 3, 0, TAU); g.fill(); }
  }
  // jails: a bamboo pen with a straw floor; the colour is the team whose players are held there
  for (const team of ['H', 'C']) {
    const j = JAIL[team], T = TEAM[team], s = JAIL_R * 0.95;
    g.fillStyle = 'rgba(20,50,20,0.28)'; g.beginPath(); g.roundRect(j.x - s + 6, j.y - s + 8, s * 2, s * 2, 12); g.fill();
    const fl = g.createLinearGradient(j.x - s, j.y - s, j.x + s, j.y + s); fl.addColorStop(0, '#e9d38d'); fl.addColorStop(1, '#c9ac5e');
    g.fillStyle = fl; g.beginPath(); g.roundRect(j.x - s, j.y - s, s * 2, s * 2, 10); g.fill();
    g.strokeStyle = 'rgba(120,90,20,0.35)'; g.lineWidth = 1.5; for (let i = -s + 10; i < s; i += 10) { g.beginPath(); g.moveTo(j.x - s + 4, j.y + i); g.lineTo(j.x + s - 4, j.y + i + 3); g.stroke(); }
    g.strokeStyle = T.main; g.lineWidth = 5; g.beginPath(); g.roundRect(j.x - s, j.y - s, s * 2, s * 2, 10); g.stroke();
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = j.x + cx * s, py = j.y + cy * s; g.fillStyle = '#7a5a1c'; g.beginPath(); g.arc(px + 2, py + 3, 8, 0, TAU); g.fill(); g.fillStyle = '#d8bb5a'; g.beginPath(); g.arc(px, py, 8, 0, TAU); g.fill(); g.fillStyle = T.main; g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fill(); }
  }
}
const field = layer('field', COURT.w, COURT.h, 1.5, paintField);
export const drawField = (ctx) => field(ctx, 0, 0);

// --- the poles (live: the pennant waves) ----------------------------------------------------------------------------
export function drawPole(ctx, team, t, flash = 0) {
  const p = POLE[team], T = TEAM[team];
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(10,40,10,0.35)'; ctx.beginPath(); ctx.ellipse(10, 10, 15, 11, 0, 0, TAU); ctx.fill();
  // pennant on a long pole seen from above: a wave of cloth streaming sideways
  const wave = (k) => Math.sin(t * 3 + k * 0.9) * 6;
  ctx.fillStyle = T.main; ctx.beginPath(); ctx.moveTo(0, 0);
  for (let i = 0; i <= 6; i++) ctx.lineTo(i * 12, -4 - i * 3 + wave(i));       // streams to the right
  for (let i = 6; i >= 0; i--) ctx.lineTo(i * 12, 8 - i * 1.4 + wave(i));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = T.dark; ctx.lineWidth = 2; ctx.stroke();
  const base = ctx.createRadialGradient(-4, -4, 1, 0, 0, 14); base.addColorStop(0, '#fff7d0'); base.addColorStop(0.5, '#e2c06a'); base.addColorStop(1, '#8b6a1e');
  ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
  ctx.strokeStyle = T.main; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
  if (flash > 0) { ctx.strokeStyle = `rgba(255,255,255,${flash})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 22 + (1 - flash) * 30, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// --- a player, from above ---------------------------------------------------------------------------------------------
// o: { team, k, ang, phase, moving, alpha, scale, num (freshness number or 0), sel, caught }
export function drawPlayer(ctx, x, y, o) {
  const T = TEAM[o.team], s = (o.scale ?? 1) * 1.5, sw = Math.sin(o.phase ?? 0) * (o.moving ? 1 : 0), skin = SKIN[o.k & 3], hair = HAIR[o.k & 3];
  const shorts = o.team === 'H' ? '#f4f1ea' : '#22304f', lift = o.moving ? Math.abs(sw) : 0;
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(8,40,10,0.36)'; ctx.beginPath(); ctx.ellipse(2 + lift * 1.5, 5 + lift, 17, 12, 0, 0, TAU); ctx.fill();
  ctx.rotate((o.ang ?? 0) + Math.PI / 2);          // 0 = facing up the screen
  // legs: thigh in shorts, calf, shoe; the stride alternates
  for (const side of [-1, 1]) {
    const ph = side * sw, ly = 5 + ph * 8, lx = side * 5.4;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.roundRect(lx - 2.6, ly + 1, 5.2, 10, 2.6); ctx.fill();
    ctx.fillStyle = shorts; ctx.beginPath(); ctx.roundRect(lx - 4.4, ly - 6, 8.8, 9.5, 3.6); ctx.fill();
    ctx.fillStyle = '#f8f6f0'; ctx.beginPath(); ctx.ellipse(lx, ly + 11.5, 3.6, 5.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  // arms swing opposite the legs: sleeve, forearm, hand
  for (const side of [-1, 1]) {
    const ph = -side * sw, ax = side * 13.5, ay = -1 + ph * 6;
    ctx.strokeStyle = skin; ctx.lineWidth = 4.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(side * 12, -3); ctx.lineTo(ax + side * 1.5, ay + 6); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(ax + side * 1.5, ay + 7.5, 2.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = T.main; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(side * 11.5, -3.5); ctx.lineTo(side * 13, ay + 0.5); ctx.stroke();
  }
  // torso: a vest in the team colour with a lit shoulder line
  const sh = ctx.createLinearGradient(-14, -10, 14, 12); sh.addColorStop(0, T.light); sh.addColorStop(0.35, T.main); sh.addColorStop(1, T.dark);
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, 0, 13, 9.6, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, 11.6, 8.2, 0, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
  ctx.fillStyle = T.trim; ctx.fillRect(-2.6, -1, 5.2, 7);
  // head seen from above: skin, ears, hair on the crown
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-7.4, -5.6, 1.9, 2.8, 0, 0, TAU); ctx.ellipse(7.4, -5.6, 1.9, 2.8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -5.6, 7.8, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -3.6, 7.6, 6.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-2.4, -5.2, 2.8, 1.8, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}
