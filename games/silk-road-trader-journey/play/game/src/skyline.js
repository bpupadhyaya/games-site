// City skylines, one per city, painted with the same lit/shaded flat-gradient style as the landscape. Pure canvas.
import { hex, mix, rgb, shade, hash, vn, lerp, clamp, ridge } from './paint.js';
import { poplar, palm } from './paint.js';

const TAU = Math.PI * 2;
// light context: how much warm window glow, and an overall dim factor by time of day
const LIGHT = { day: { glow: 0, dim: 0 }, dawn: { glow: 0.25, dim: 0.06 }, dusk: { glow: 0.7, dim: 0.12 }, night: { glow: 1, dim: 0.45 } };

function block(ctx, x, y, w, h, col, o = {}) {      // x,y = bottom-left; a lit front face with a darker right side and a cap
  const L = o.light ?? 0, front = ctx.createLinearGradient(x, y - h, x + w, y);
  front.addColorStop(0, shade(col, 0.18 - L)); front.addColorStop(1, shade(col, -0.18 - L));
  ctx.fillStyle = front; ctx.fillRect(x, y - h, w, h);
  if (o.side) { const sw = o.side; ctx.fillStyle = shade(col, -0.38 - L); ctx.beginPath(); ctx.moveTo(x + w, y - h); ctx.lineTo(x + w + sw, y - h + sw * 0.5); ctx.lineTo(x + w + sw, y + sw * 0.5); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill(); }
  if (o.cap) { ctx.fillStyle = shade(col, 0.32 - L); ctx.fillRect(x - 1, y - h - o.cap, w + 2 + (o.side ?? 0), o.cap); }
}
function windows(ctx, x, y, w, h, nx, ny, lights, seed, c = '#ffd27a') {
  const cw = w / (nx * 2), ch = h / (ny * 2);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const px = x + (i * 2 + 0.7) * cw, py = y + (j * 2 + 0.7) * ch, lit = lights > 0 && hash(seed + i * 7 + j * 13) < lights;
    ctx.fillStyle = lit ? c : 'rgba(25,15,10,0.55)'; ctx.fillRect(px, py, cw, ch);
    if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(px + cw / 2, py + ch / 2, 0, px + cw / 2, py + ch / 2, cw * 3); g.addColorStop(0, 'rgba(255,190,90,0.35)'); g.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = g; ctx.fillRect(px - cw * 3, py - cw * 3, cw * 7, cw * 7); ctx.restore(); }
  }
}
function crenels(ctx, x, y, w, n, h, col) { const cw = w / (n * 2 - 1); ctx.fillStyle = col; for (let i = 0; i < n; i++) ctx.fillRect(x + i * 2 * cw, y - h, cw, h); }
function arch(ctx, cx, y, w, h, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - w / 2, y - h + w / 2); ctx.arc(cx, y - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(cx + w / 2, y); ctx.closePath(); ctx.fill(); }
function eaveRoof(ctx, cx, y, w, h, col, lit) {    // Tang-style hipped roof with upturned corners; y = eave line
  const g = ctx.createLinearGradient(cx - w / 2, y - h, cx + w / 2, y); g.addColorStop(0, shade(col, 0.3)); g.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - w / 2 - h * 0.35, y - h * 0.2);
  ctx.quadraticCurveTo(cx - w / 2 + w * 0.05, y + h * 0.05, cx - w * 0.38, y - h * 0.1);
  ctx.lineTo(cx - w * 0.22, y - h); ctx.lineTo(cx + w * 0.22, y - h); ctx.lineTo(cx + w * 0.38, y - h * 0.1);
  ctx.quadraticCurveTo(cx + w / 2 - w * 0.05, y + h * 0.05, cx + w / 2 + h * 0.35, y - h * 0.2);
  ctx.quadraticCurveTo(cx + w / 2, y + h * 0.28, cx, y + h * 0.28); ctx.quadraticCurveTo(cx - w / 2, y + h * 0.28, cx - w / 2 - h * 0.35, y - h * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, -0.5); ctx.fillRect(cx - w * 0.5, y + h * 0.18, w, h * 0.1);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * w * 0.05, y - h); ctx.lineTo(cx + i * w * 0.13, y); ctx.stroke(); }
}

const FNS = {
  // ---- Chang'an: rammed-earth wall, great gate with two tiers of hipped roofs, a bell tower behind
  tang(ctx, r, by, u, L, t) {
    const wc = '#b49470', roof = '#34414c', pil = '#a8372b';
    // bell tower behind
    const tx = r.x + r.w * 0.76;
    block(ctx, tx - 7 * u, by - 6 * u, 14 * u, 16 * u, wc, { light: L.dim }); eaveRoof(ctx, tx, by - 22 * u, 24 * u, 6 * u, roof); eaveRoof(ctx, tx, by - 29 * u, 17 * u, 5.5 * u, roof);
    // wall
    block(ctx, r.x - 10, by, r.w + 20, 9 * u, wc, { light: L.dim, cap: 1.4 * u });
    crenels(ctx, r.x - 10, by - 9.1 * u, r.w + 20, Math.round(r.w / (6 * u)), 2 * u, shade(wc, 0.1 - L.dim));
    ctx.strokeStyle = 'rgba(70,45,25,0.25)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(r.x, by - i * 2.2 * u); ctx.lineTo(r.x + r.w, by - i * 2.2 * u); ctx.stroke(); }
    // great gate
    const cx = r.x + r.w * 0.38;
    block(ctx, cx - 17 * u, by, 34 * u, 10 * u, shade(wc, -0.08), { light: L.dim });
    arch(ctx, cx, by, 10 * u, 8.5 * u, '#241810');
    ctx.fillStyle = 'rgba(255,170,70,' + (0.55 * L.glow) + ')'; arch(ctx, cx, by, 6 * u, 6 * u, ctx.fillStyle);
    // pillars and upper hall
    ctx.fillStyle = pil; for (let i = -3; i <= 3; i++) ctx.fillRect(cx + i * 4.2 * u - 0.5 * u, by - 20 * u, 1.1 * u, 10 * u);
    ctx.fillStyle = shade(pil, -0.4); ctx.fillRect(cx - 14 * u, by - 20.2 * u, 28 * u, 1.2 * u);
    eaveRoof(ctx, cx, by - 20 * u, 36 * u, 6.5 * u, roof);
    block(ctx, cx - 10 * u, by - 26.5 * u, 20 * u, 7 * u, wc, { light: L.dim });
    ctx.fillStyle = pil; for (let i = -2; i <= 2; i++) ctx.fillRect(cx + i * 4.2 * u - 0.5 * u, by - 33.5 * u, 1 * u, 7 * u);
    eaveRoof(ctx, cx, by - 33 * u, 28 * u, 7 * u, roof);
    ctx.fillStyle = '#d9a82c'; ctx.fillRect(cx - 0.4 * u, by - 46 * u, 0.8 * u, 6 * u);
    // flags
    for (const fx of [0.12, 0.62]) { const x = r.x + r.w * fx; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, by - 9 * u); ctx.lineTo(x, by - 24 * u); ctx.stroke(); ctx.fillStyle = '#b8342c'; ctx.beginPath(); ctx.moveTo(x, by - 24 * u); ctx.lineTo(x + 8 * u, by - 22 * u + Math.sin(t * 2 + fx * 9) * u); ctx.lineTo(x, by - 19 * u); ctx.fill(); }
    // low houses and trees
    for (let i = 0; i < 9; i++) { const x = r.x + r.w * (0.5 + i * 0.06) + hash(i) * 6 * u; if (x > r.x + r.w - 6 * u) continue; block(ctx, x, by - 9 * u, 7 * u, 5 * u + hash(i + 3) * 3 * u, '#9a7a5a', { light: L.dim }); ctx.fillStyle = roof; ctx.fillRect(x - 1 * u, by - 14.5 * u - hash(i + 3) * 3 * u, 9 * u, 1.6 * u); }
    for (let i = 0; i < 4; i++) poplar(ctx, r.x + r.w * (0.02 + i * 0.045), by + 2 * u, 20 * u, '#58703a');
  },
  // ---- Lanzhou: a river with sheepskin rafts, hills with stepped houses, a stone bridge
  river(ctx, r, by, u, L, t) {
    // river
    const rg = ctx.createLinearGradient(0, by - 2 * u, 0, by + 14 * u); rg.addColorStop(0, '#caa86a'); rg.addColorStop(1, '#8a6a3a');
    ctx.fillStyle = rg; ctx.fillRect(r.x, by - 2 * u, r.w, 16 * u);
    ctx.fillStyle = 'rgba(255,235,190,0.3)'; for (let i = 0; i < 24; i++) ctx.fillRect(r.x + hash(i) * r.w, by + 1 * u + hash(i + 4) * 11 * u, 7 * u + hash(i + 7) * 20 * u, 0.4 * u);
    // hills with houses
    ridge(ctx, { x: r.x, y: r.y, w: r.w, h: r.h }, by - 5 * u, 24 * u, 0.012, 40, 5, '#b99c6a', '#8a6e44');
    for (let i = 0; i < 14; i++) { const x = r.x + r.w * (0.02 + i * 0.07) + hash(i) * 4 * u; const y = by - 4 * u - (vn(x * 0.012 + 40, 5) * 0.56) * 24 * u + 2 * u; block(ctx, x, y, 6 * u, 4 * u, '#d8c49a', { light: L.dim, side: 1.5 * u }); ctx.fillStyle = '#4a4e52'; ctx.beginPath(); ctx.moveTo(x - 1 * u, y - 4 * u); ctx.lineTo(x + 3 * u, y - 6.6 * u); ctx.lineTo(x + 7.6 * u, y - 4 * u); ctx.fill(); }
    // watchtower
    const wx = r.x + r.w * 0.2; block(ctx, wx, by - 14 * u, 7 * u, 22 * u, '#b49470', { light: L.dim, side: 2 * u, cap: 1.2 * u }); eaveRoof(ctx, wx + 3.5 * u, by - 36 * u, 14 * u, 5 * u, '#34414c');
    // bridge of boats and rafts
    for (let i = 0; i < 5; i++) { const x = r.x + r.w * (0.42 + i * 0.12), y = by + (3 + (i % 3) * 3.5) * u + Math.sin(t * 1.2 + i) * 0.4 * u; ctx.fillStyle = '#a98a56'; ctx.beginPath(); ctx.ellipse(x, y, 7 * u, 2 * u, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#c9aa72'; ctx.beginPath(); ctx.ellipse(x, y - 0.6 * u, 7 * u, 1.4 * u, 0, Math.PI, TAU); ctx.fill(); for (let k = -2; k <= 2; k++) { ctx.fillStyle = '#d9b982'; ctx.beginPath(); ctx.ellipse(x + k * 2.2 * u, y - 1.4 * u, 1.2 * u, 1 * u, 0, 0, TAU); ctx.fill(); } }
    poplar(ctx, r.x + r.w * 0.05, by + 1 * u, 22 * u, '#58703a'); poplar(ctx, r.x + r.w * 0.93, by + 1 * u, 18 * u, '#58703a');
  },
  // ---- Dunhuang: adobe fort, tall beacon tower, cliff face with cave openings
  fort(ctx, r, by, u, L, t) {
    // cliff with openings behind
    const cx0 = r.x + r.w * 0.58, cw = r.w * 0.42;
    const cg = ctx.createLinearGradient(cx0, by - 40 * u, cx0 + cw, by); cg.addColorStop(0, '#c4a074'); cg.addColorStop(1, '#8a6a46');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(cx0, by); ctx.lineTo(cx0 + 4 * u, by - 34 * u); ctx.lineTo(cx0 + cw * 0.5, by - 38 * u); ctx.lineTo(cx0 + cw, by - 28 * u); ctx.lineTo(cx0 + cw, by); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 18; i++) { const x = cx0 + 6 * u + hash(i) * (cw - 12 * u), y = by - 6 * u - hash(i + 5) * 26 * u; ctx.fillStyle = 'rgba(30,18,10,0.7)'; ctx.beginPath(); ctx.roundRect(x, y, 3 * u, 4 * u, [1.5 * u, 1.5 * u, 0, 0]); ctx.fill(); }
    // fort walls
    const wc = '#c7a574'; block(ctx, r.x + r.w * 0.06, by, r.w * 0.5, 12 * u, wc, { light: L.dim, side: 3 * u, cap: 1.3 * u });
    crenels(ctx, r.x + r.w * 0.06, by - 12.1 * u, r.w * 0.5, 11, 2.2 * u, shade(wc, 0.1 - L.dim));
    arch(ctx, r.x + r.w * 0.3, by, 9 * u, 9 * u, '#2a1a10');
    // beacon tower: tall, tapering, with a platform and smoke
    const bx = r.x + r.w * 0.5; ctx.fillStyle = shade(wc, -0.1 - L.dim); ctx.beginPath(); ctx.moveTo(bx - 6 * u, by); ctx.lineTo(bx - 4 * u, by - 32 * u); ctx.lineTo(bx + 4 * u, by - 32 * u); ctx.lineTo(bx + 6 * u, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(wc, -0.4 - L.dim); ctx.beginPath(); ctx.moveTo(bx + 4 * u, by - 32 * u); ctx.lineTo(bx + 6 * u, by); ctx.lineTo(bx + 9 * u, by + 1 * u); ctx.lineTo(bx + 6.5 * u, by - 31 * u); ctx.closePath(); ctx.fill();
    block(ctx, bx - 6 * u, by - 32 * u, 12 * u, 3 * u, wc, { light: L.dim, cap: 1 * u });
    ctx.fillStyle = 'rgba(255,150,50,' + (0.35 + 0.65 * L.glow) + ')'; ctx.beginPath(); ctx.arc(bx, by - 36 * u, 1.6 * u, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { const k = (t * 0.25 + i / 6) % 1; ctx.fillStyle = `rgba(130,120,110,${0.4 * (1 - k)})`; ctx.beginPath(); ctx.arc(bx + k * 6 * u + Math.sin(k * 6 + i) * 2 * u, by - 38 * u - k * 24 * u, (1.5 + k * 3.6) * u, 0, TAU); ctx.fill(); }
    scrubs(ctx, r, by, u);
  },
  // ---- Turpan: flat-roofed adobe, grape trellis, a drying house full of ventilation holes, karez mounds
  adobe(ctx, r, by, u, L, t) {
    for (let i = 0; i < 7; i++) { const x = r.x + r.w * (0.04 + i * 0.14) + hash(i) * 3 * u; ctx.fillStyle = shade('#a98a60', -L.dim); ctx.beginPath(); ctx.ellipse(x, by + 9 * u, 3.4 * u, 1.2 * u, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(40,25,10,0.5)'; ctx.beginPath(); ctx.ellipse(x, by + 8.7 * u, 1.3 * u, 0.5 * u, 0, 0, TAU); ctx.fill(); }
    const c1 = '#c9a374';
    for (let i = 0; i < 6; i++) { const x = r.x + r.w * (0.03 + i * 0.12) + hash(i + 2) * 2 * u, h = 8 * u + hash(i) * 5 * u; block(ctx, x, by, 10 * u, h, i % 2 ? c1 : '#b8946a', { light: L.dim, side: 3 * u, cap: 0.8 * u }); arch(ctx, x + 4 * u, by, 3 * u, 4.5 * u, '#2a1810'); windows(ctx, x + 1 * u, by - h + 1.4 * u, 8 * u, 3 * u, 3, 1, L.glow * 0.8, i * 11); }
    const dx = r.x + r.w * 0.58; block(ctx, dx, by, 16 * u, 18 * u, '#bf9a6c', { light: L.dim, side: 4 * u, cap: 1 * u });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) { ctx.fillStyle = 'rgba(30,18,10,0.8)'; ctx.fillRect(dx + (1.6 + j * 2) * u, by - (14.5 - i * 3.4) * u, 1.1 * u, 1.9 * u); }
    // trellis
    const tx = r.x + r.w * 0.78; ctx.fillStyle = '#6a8a40'; ctx.fillRect(tx, by - 6 * u, 30 * u, 1.6 * u);
    for (let i = 0; i <= 6; i++) { ctx.fillStyle = '#5a4026'; ctx.fillRect(tx + i * 5 * u, by - 6 * u, 0.7 * u, 6 * u); }
    for (let i = 0; i < 28; i++) { ctx.fillStyle = hash(i) > 0.5 ? '#86a850' : '#6a8e3c'; ctx.beginPath(); ctx.arc(tx + hash(i) * 30 * u, by - 6 * u + hash(i + 7) * 2 * u, 1.3 * u, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 3; i++) poplar(ctx, r.x + r.w * (0.4 + i * 0.07), by + 1 * u, 24 * u, '#5a7a3a');
  },
  // ---- Kashgar: stacked mud-brick houses climbing a hill, flat roofs, big snow range behind
  mountainTown(ctx, r, by, u, L, t) {
    const cols = ['#c9a074', '#b98c60', '#d4b184', '#a67c52'];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) {
      const w = 10 * u + hash(i + row * 9) * 5 * u, h = (5 + hash(i * 3 + row) * 6) * u, x = r.x + r.w * (0.02 + i * 0.105) + (row % 2) * 4 * u - hash(i + row) * 3 * u, y = by - row * 5.2 * u + (row ? -2 * u : 0);
      block(ctx, x, y, w, h, cols[(i + row) % 4], { light: L.dim + row * 0.03, side: 2.5 * u, cap: 0.9 * u });
      ctx.fillStyle = 'rgba(40,24,12,0.8)'; ctx.fillRect(x + w * 0.2, y - h * 0.55, w * 0.18, h * 0.3);
      windows(ctx, x + w * 0.5, y - h * 0.7, w * 0.4, h * 0.4, 2, 1, L.glow * 0.9, i * 5 + row * 17);
      if (hash(i + row * 4) > 0.7) { ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + w * 0.1, y - h - 2 * u, w * 0.8, 1.2 * u); }
    }
    for (let i = 0; i < 5; i++) poplar(ctx, r.x + r.w * (0.1 + i * 0.2) + hash(i) * 5 * u, by + 2 * u, 22 * u, '#58703a');
  },
  // ---- Samarkand: a hill citadel, a blue-tiled portal with a pointed arch, merchants' houses, plane trees
  sogdian(ctx, r, by, u, L, t) {
    const sx = r.x + r.w * 0.68;
    // citadel hill
    ctx.fillStyle = shade('#b49a6e', -L.dim); ctx.beginPath(); ctx.moveTo(sx - 30 * u, by); ctx.quadraticCurveTo(sx - 12 * u, by - 22 * u, sx + 4 * u, by - 22 * u); ctx.quadraticCurveTo(sx + 26 * u, by - 20 * u, sx + 38 * u, by); ctx.closePath(); ctx.fill();
    block(ctx, sx - 10 * u, by - 16 * u, 24 * u, 14 * u, '#c4a678', { light: L.dim, side: 3 * u, cap: 1 * u }); crenels(ctx, sx - 10 * u, by - 30.1 * u, 24 * u, 7, 2 * u, '#d2b888');
    block(ctx, sx - 1 * u, by - 30 * u, 8 * u, 8 * u, '#cdb080', { light: L.dim, cap: 0.8 * u });
    // blue portal
    const px = r.x + r.w * 0.36, blue = '#2b78b0', teal = '#2fb0b0';
    block(ctx, px - 20 * u, by, 40 * u, 28 * u, '#c9ad80', { light: L.dim, side: 4 * u, cap: 1 * u });
    const bg = ctx.createLinearGradient(px, by - 30 * u, px, by); bg.addColorStop(0, shade(blue, 0.2 - L.dim)); bg.addColorStop(1, shade(blue, -0.3 - L.dim));
    ctx.fillStyle = bg; ctx.fillRect(px - 15 * u, by - 34 * u, 30 * u, 34 * u);
    ctx.fillStyle = '#16100a'; ctx.beginPath(); ctx.moveTo(px - 7 * u, by); ctx.lineTo(px - 7 * u, by - 14 * u); ctx.quadraticCurveTo(px - 6 * u, by - 22 * u, px, by - 26 * u); ctx.quadraticCurveTo(px + 6 * u, by - 22 * u, px + 7 * u, by - 14 * u); ctx.lineTo(px + 7 * u, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,160,70,' + (0.6 * L.glow) + ')'; ctx.beginPath(); ctx.moveTo(px - 4.5 * u, by); ctx.lineTo(px - 4.5 * u, by - 14 * u); ctx.quadraticCurveTo(px, by - 21 * u, px + 4.5 * u, by - 14 * u); ctx.lineTo(px + 4.5 * u, by); ctx.fill();
    ctx.strokeStyle = teal; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(px - 9 * u, by); ctx.lineTo(px - 9 * u, by - 14 * u); ctx.quadraticCurveTo(px - 8 * u, by - 24 * u, px, by - 29 * u); ctx.quadraticCurveTo(px + 8 * u, by - 24 * u, px + 9 * u, by - 14 * u); ctx.lineTo(px + 9 * u, by); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) ctx.fillRect(px - 14 * u + i * 5 * u, by - 33 * u + j * 1.6 * u, 1.6 * u, 1.2 * u);
    ctx.fillStyle = '#d9b84a'; ctx.fillRect(px - 15 * u, by - 34 * u, 30 * u, 1 * u);
    // houses and trees
    for (let i = 0; i < 6; i++) { const x = r.x + r.w * (0.02 + i * 0.05) + hash(i) * 2 * u; block(ctx, x, by, 8 * u, 7 * u + hash(i) * 4 * u, '#d2b88c', { light: L.dim, side: 2 * u, cap: 0.8 * u }); }
    for (let i = 0; i < 4; i++) poplar(ctx, r.x + r.w * (0.55 + i * 0.045), by + 2 * u, 26 * u, '#4a6e34');
  },
  // ---- Merv: huge mud-brick walls with buttress towers, a gate, canals and palms
  merv(ctx, r, by, u, L, t) {
    const wc = '#b99468';
    block(ctx, r.x - 10, by, r.w + 20, 16 * u, wc, { light: L.dim, cap: 1.4 * u });
    for (let i = 0; i < 8; i++) { const x = r.x + r.w * (0.02 + i * 0.14); ctx.fillStyle = shade(wc, -0.1 - L.dim); ctx.beginPath(); ctx.roundRect(x, by - 21 * u, 9 * u, 21 * u, [4.5 * u, 4.5 * u, 0, 0]); ctx.fill(); ctx.fillStyle = shade(wc, -0.4 - L.dim); ctx.fillRect(x + 6.5 * u, by - 21 * u, 2.5 * u, 21 * u); crenels(ctx, x, by - 21 * u, 9 * u, 3, 1.6 * u, shade(wc, 0.1 - L.dim)); }
    crenels(ctx, r.x - 10, by - 16 * u, r.w + 20, Math.round(r.w / (5 * u)), 1.8 * u, shade(wc, 0.1 - L.dim));
    const gx = r.x + r.w * 0.5; block(ctx, gx - 12 * u, by, 24 * u, 22 * u, shade(wc, 0.05), { light: L.dim, side: 3 * u, cap: 1 * u }); arch(ctx, gx, by, 11 * u, 15 * u, '#1f130a');
    ctx.fillStyle = 'rgba(255,160,70,' + (0.55 * L.glow) + ')'; arch(ctx, gx, by, 7 * u, 11 * u, ctx.fillStyle);
    crenels(ctx, gx - 12 * u, by - 22.1 * u, 24 * u, 6, 2 * u, shade(wc, 0.1 - L.dim));
    // canal in front
    const g = ctx.createLinearGradient(0, by + 2 * u, 0, by + 8 * u); g.addColorStop(0, '#6fa8b8'); g.addColorStop(1, '#3a7088'); ctx.fillStyle = g; ctx.fillRect(r.x, by + 3 * u, r.w, 4 * u);
    for (let i = 0; i < 6; i++) palm(ctx, r.x + r.w * (0.05 + i * 0.18) + hash(i) * 4 * u, by + 2 * u, 30 * u, (hash(i + 4) - 0.5) * 0.4, '#3f7a3a');
  },
  // ---- Rayy: a hill city climbing in steps, a wall with towers, ochre-pink houses
  hill(ctx, r, by, u, L, t) {
    const hx = r.x + r.w * 0.55;
    ctx.fillStyle = shade('#b08a62', -L.dim); ctx.beginPath(); ctx.moveTo(r.x, by); ctx.quadraticCurveTo(hx - 25 * u, by - 12 * u, hx - 8 * u, by - 34 * u); ctx.quadraticCurveTo(hx + 14 * u, by - 40 * u, r.x + r.w, by); ctx.closePath(); ctx.fill();
    for (let row = 0; row < 5; row++) for (let i = 0; i < 12; i++) {
      const y = by - row * 6.4 * u - 2 * u, x = hx - 30 * u + (i * 5.5 + (row % 2) * 2.7) * u + (row - 2) * 2 * u; if (Math.abs(x - hx) > 40 * u - row * 4 * u) continue;
      const h = (4 + hash(i + row * 7) * 4) * u; block(ctx, x, y, 5 * u, h, ['#d9b48a', '#cfa07a', '#e0c098'][(i + row) % 3], { light: L.dim, side: 1.5 * u, cap: 0.6 * u }); windows(ctx, x + 0.8 * u, y - h + 1 * u, 3.4 * u, 2 * u, 2, 1, L.glow * 0.85, i + row * 31);
    }
    block(ctx, hx - 6 * u, by - 36 * u, 14 * u, 8 * u, '#cfae82', { light: L.dim, side: 2 * u, cap: 1 * u }); arch(ctx, hx + 1 * u, by - 28 * u, 5 * u, 6 * u, '#2a1810');
    block(ctx, r.x + r.w * 0.2, by, r.w * 0.3, 7 * u, '#bf9e72', { light: L.dim, cap: 1 * u }); crenels(ctx, r.x + r.w * 0.2, by - 7.1 * u, r.w * 0.3, 8, 1.6 * u, '#cdb184');
    for (let i = 0; i < 5; i++) poplar(ctx, r.x + r.w * (0.05 + i * 0.07), by + 2 * u, 22 * u, '#4a6e34');
  },
  // ---- Baghdad: the Round City: a ring wall with four gates and a central palace hall, boats on the Tigris
  round(ctx, r, by, u, L, t) {
    const cx = r.x + r.w * 0.5, rx = r.w * 0.44, ry = 11 * u;
    // far ring of wall (an ellipse seen from low)
    ctx.fillStyle = shade('#b99a6a', -L.dim); ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, Math.PI, TAU); ctx.lineTo(cx + rx, by + 4 * u); ctx.ellipse(cx, by + 4 * u, rx, ry, 0, 0, Math.PI, false); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade('#d4b684', -L.dim); ctx.beginPath(); ctx.ellipse(cx, by - 1 * u, rx, ry, 0, Math.PI, TAU); ctx.fill();
    for (let i = 0; i < 24; i++) { const a = Math.PI + (i / 23) * Math.PI, x = cx + Math.cos(a) * rx, y = by - 1 * u + Math.sin(a) * ry; ctx.fillStyle = shade('#c8aa78', -L.dim); ctx.fillRect(x - 0.7 * u, y - 2.2 * u, 1.4 * u, 2.2 * u); }
    // inner city roofs
    for (let i = 0; i < 40; i++) { const a = hash(i) * Math.PI + Math.PI, rad = 0.3 + hash(i + 1) * 0.65, x = cx + Math.cos(a) * rx * rad, y = by - 2 * u + Math.sin(a) * ry * rad * 0.9, h = (3 + hash(i + 2) * 5) * u; block(ctx, x - 2 * u, y, 4.4 * u, h, ['#dcc294', '#cfae82', '#e4cfa4'][i % 3], { light: L.dim }); windows(ctx, x - 1.4 * u, y - h + 1 * u, 3 * u, 1.8 * u, 2, 1, L.glow * 0.8, i * 3); }
    // central palace hall with a great arched portal and a tall tower
    block(ctx, cx - 14 * u, by - 4 * u, 28 * u, 16 * u, '#d9bc88', { light: L.dim, side: 3 * u, cap: 1.2 * u }); arch(ctx, cx, by - 4 * u, 12 * u, 12 * u, '#2a1a10');
    ctx.fillStyle = 'rgba(255,160,70,' + (0.5 * L.glow) + ')'; arch(ctx, cx, by - 4 * u, 8 * u, 9 * u, ctx.fillStyle);
    // the palace's green dome on a square hall
    block(ctx, cx - 7 * u, by - 14 * u, 14 * u, 12 * u, '#d4b684', { light: L.dim, side: 2 * u, cap: 1 * u });
    const tg = ctx.createRadialGradient(cx - 3 * u, by - 34 * u, 1 * u, cx, by - 28 * u, 12 * u); tg.addColorStop(0, shade('#8fd0b4', 0.15 - L.dim)); tg.addColorStop(1, shade('#2f7a66', -0.1 - L.dim));
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(cx - 9 * u, by - 26 * u); ctx.quadraticCurveTo(cx - 10 * u, by - 40 * u, cx, by - 41 * u); ctx.quadraticCurveTo(cx + 10 * u, by - 40 * u, cx + 9 * u, by - 26 * u); ctx.closePath(); ctx.fill();
    block(ctx, cx - 9 * u, by - 14 * u, 18 * u, 12 * u, '#d9bc88', { light: L.dim, cap: 1 * u });
    ctx.fillStyle = '#d9a82c'; ctx.fillRect(cx - 0.35 * u, by - 46 * u, 0.7 * u, 6 * u);
    block(ctx, cx - 6 * u, by - 8 * u, 12 * u, 12 * u, '#cfae82', { light: L.dim, cap: 1 * u });
    // river and boats
    const g = ctx.createLinearGradient(0, by + 6 * u, 0, by + 20 * u); g.addColorStop(0, '#6fa8c4'); g.addColorStop(1, '#2d6590'); ctx.fillStyle = g; ctx.fillRect(r.x, by + 6 * u, r.w, 14 * u);
    for (let i = 0; i < 4; i++) { const x = r.x + ((r.w * (0.1 + i * 0.27) + t * (6 + i)) % (r.w + 40 * u)) - 20 * u, y = by + (10 + (i % 2) * 5) * u; ctx.fillStyle = '#7a5a36'; ctx.beginPath(); ctx.moveTo(x - 7 * u, y); ctx.quadraticCurveTo(x, y + 3 * u, x + 8 * u, y - 0.5 * u); ctx.lineTo(x + 6 * u, y - 1 * u); ctx.lineTo(x - 5 * u, y - 1 * u); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#efe4c8'; ctx.beginPath(); ctx.moveTo(x - 0.6 * u, y - 1 * u); ctx.lineTo(x - 0.6 * u, y - 11 * u); ctx.lineTo(x + 6 * u, y - 1 * u); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - 7 * u, y + 2.2 * u, 14 * u, 0.5 * u); }
    for (let i = 0; i < 6; i++) palm(ctx, r.x + r.w * (0.03 + i * 0.19) + hash(i) * 6 * u, by + 8 * u, 26 * u, (hash(i + 4) - 0.5) * 0.4, '#3f7a3a');
  },
};
function scrubs(ctx, r, by, u) { ctx.fillStyle = 'rgba(80,70,40,0.5)'; for (let i = 0; i < 8; i++) { const x = r.x + r.w * hash(i * 3 + 1); ctx.beginPath(); ctx.ellipse(x, by + 2 * u, 2.4 * u, 0.9 * u, 0, 0, TAU); ctx.fill(); } }

// Draws the skyline `key` standing on baseline `by` inside r. u = pixels per "city unit" (r.h/100 by default).
export function skyline(ctx, r, key, by, time = 'day', t = 0, u = r.h / 100) {
  const L = LIGHT[time] ?? LIGHT.day, fn = FNS[key];
  if (!fn) return;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); fn(ctx, r, by, u, L, t); ctx.restore();
}
export const SKYLINE_KEYS = Object.keys(FNS);
