// Drawing for Shut the Box: the tavern table, the oak box, hinged bone tiles, ivory dice, particles. Pure canvas, no clock:
// every animation is driven by values stored in the game state.
export const DISPLAY = '"Cinzel", "Trajan Pro", Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const BOX_KEYS = ['oak', 'walnut', 'ebony'];
export const TILE_KEYS = ['bone', 'jade', 'amber'];
export const BOXES = {
  oak: { name: 'Oak', hi: '#c98f4f', mid: '#a56a32', lo: '#6d4119', cav: '#2b170a', cav2: '#1a0d05', grain: 'rgba(60,28,8,0.22)' },
  walnut: { name: 'Walnut', hi: '#8a5a3c', mid: '#5f3a24', lo: '#3a2012', cav: '#1d0f08', cav2: '#120804', grain: 'rgba(20,8,3,0.3)' },
  ebony: { name: 'Ebony', hi: '#4a4540', mid: '#2e2a27', lo: '#171513', cav: '#0d0b0a', cav2: '#070605', grain: 'rgba(255,255,255,0.05)' },
};
export const TILES = {
  bone: { name: 'Bone', a: '#fbf3dc', b: '#e6d6a8', c: '#bda770', ink: '#2a180c' },
  jade: { name: 'Jade', a: '#d9f0dc', b: '#9fcaa8', c: '#5e9272', ink: '#0f2a1b' },
  amber: { name: 'Amber', a: '#ffe9b3', b: '#f0b85a', c: '#b97d22', ink: '#3a1d05' },
};
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const hash = (a, b = 0) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
export const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
export const mix = (a, b, t) => a + (b - a) * t;

// The room: a dark wine-and-oak tavern table lit from the top, with a soft vignette. `calm` skips the slow candle drift.
export function drawTable(ctx, w, h, t, calm) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2b0f12'); g.addColorStop(0.5, '#1d0b0e'); g.addColorStop(1, '#0f0507');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i++) {
    const y = (i + 0.5) * (h / 26) + hash(i, 3) * 14, a = 0.035 + hash(i, 9) * 0.05;
    ctx.strokeStyle = `rgba(255,190,120,${a})`; ctx.lineWidth = 1 + hash(i, 5) * 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + 10 * hash(i, 1), w * 0.7, y - 10 * hash(i, 2), w, y + 6 * hash(i, 4)); ctx.stroke();
  }
  ctx.restore();
  const sway = calm ? 0 : Math.sin(t * 0.6) * 0.02;
  const rg = ctx.createRadialGradient(w * (0.5 + sway), h * 0.32, 10, w * 0.5, h * 0.4, Math.max(w, h) * 0.75);
  rg.addColorStop(0, 'rgba(255,170,90,0.20)'); rg.addColorStop(0.5, 'rgba(120,40,20,0.06)'); rg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
}

// The oak box seen from above: a carved frame around a dark cavity. Returns the cavity rect; tiles are drawn by the caller on top.
export function drawBoxFrame(ctx, r, key) {
  const p = BOXES[key] || BOXES.oak, pad = Math.max(10, Math.min(r.w, r.h) * 0.045);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 14;
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.3, r.y + r.h);
  g.addColorStop(0, p.hi); g.addColorStop(0.45, p.mid); g.addColorStop(1, p.lo);
  rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
  for (let i = 0; i < 34; i++) {   // wood grain
    const y = r.y + (i + 0.5) * (r.h / 34) + (hash(i, 7) - 0.5) * 10;
    ctx.strokeStyle = p.grain; ctx.lineWidth = 0.8 + hash(i, 2) * 2;
    ctx.beginPath(); ctx.moveTo(r.x, y); ctx.bezierCurveTo(r.x + r.w * 0.3, y + (hash(i, 4) - 0.5) * 14, r.x + r.w * 0.7, y + (hash(i, 6) - 0.5) * 14, r.x + r.w, y + (hash(i, 8) - 0.5) * 8); ctx.stroke();
  }
  ctx.restore();
  rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 25); ctx.strokeStyle = 'rgba(255,230,190,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  const c = { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 };   // cavity
  const cg = ctx.createLinearGradient(0, c.y, 0, c.y + c.h); cg.addColorStop(0, p.cav2); cg.addColorStop(1, p.cav);
  rr(ctx, c.x, c.y, c.w, c.h, 16); ctx.fillStyle = cg; ctx.fill();
  const ig = ctx.createLinearGradient(0, c.y, 0, c.y + 26); ig.addColorStop(0, 'rgba(0,0,0,0.65)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); rr(ctx, c.x, c.y, c.w, c.h, 16); ctx.clip(); ctx.fillStyle = ig; ctx.fillRect(c.x, c.y, c.w, 26); ctx.restore();
  rr(ctx, c.x, c.y, c.w, c.h, 16); ctx.strokeStyle = 'rgba(255,220,170,0.28)'; ctx.lineWidth = 2; ctx.stroke();
  for (const [bx, by] of [[r.x + pad * 0.5, r.y + pad * 0.5], [r.x + r.w - pad * 0.5, r.y + pad * 0.5], [r.x + pad * 0.5, r.y + r.h - pad * 0.5], [r.x + r.w - pad * 0.5, r.y + r.h - pad * 0.5]]) brassScrew(ctx, bx, by, pad * 0.3);
  return c;
}
export function brassScrew(ctx, x, y, rad) {
  const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 1, x, y, rad);
  g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#d1a23c'); g.addColorStop(1, '#7a5617');
  ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(60,35,5,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - rad * 0.6, y - rad * 0.2); ctx.lineTo(x + rad * 0.6, y + rad * 0.2); ctx.stroke();
}

// One hinged tile in its slot r (x, y, w, h). flip: 0 = standing open (face shown), 1 = shut (lying flat, slot shows).
// lift: 0..1 selected; glow: 0..1 hint ring; dim: 0..1 unusable now; num: the number on the face.
export function drawTile(ctx, r, num, o = {}) {
  const { flip = 0, lift = 0, glow = 0, dim = 0, style = 'bone', box = 'oak', t = 0, label = true } = o;
  const T = TILES[style] || TILES.bone, B = BOXES[box] || BOXES.oak, s = Math.min(r.w, r.h);
  const fs = s * 0.5, pad = Math.max(3, r.w * 0.07);
  // the recessed slot
  const sl = { x: r.x + pad * 0.5, y: r.y + pad * 0.5, w: r.w - pad, h: r.h - pad };
  rr(ctx, sl.x, sl.y, sl.w, sl.h, s * 0.12);
  const sg = ctx.createLinearGradient(0, sl.y, 0, sl.y + sl.h); sg.addColorStop(0, 'rgba(0,0,0,0.78)'); sg.addColorStop(1, B.cav); ctx.fillStyle = sg; ctx.fill();
  if (flip > 0.55) {   // the number engraved faintly on the slot floor, so the player still sees which tiles are gone
    ctx.save(); ctx.globalAlpha = 0.16 * ease((flip - 0.55) / 0.45); ctx.font = `700 ${fs * 0.8}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3dcb0'; ctx.fillText(String(num), r.x + r.w / 2, r.y + r.h * 0.56); ctx.restore();
  }
  // the tile: hinged at its top edge, so a flip squashes the face upward and darkens it
  const k = Math.cos(ease(flip) * Math.PI / 2);
  if (k > 0.02) {
    const lw = r.w - pad * 1.6, lh = (r.h - pad * 1.6) * k, x = r.x + pad * 0.8, y = r.y + pad * 0.8 - lift * s * 0.09 - Math.sin(flip * Math.PI) * s * 0.06;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8 + lift * 14; ctx.shadowOffsetY = 4 + lift * 8;
    const fg = ctx.createLinearGradient(x, y, x, y + lh); fg.addColorStop(0, T.a); fg.addColorStop(0.55, T.b); fg.addColorStop(1, T.c);
    rr(ctx, x, y, lw, lh, s * 0.1); ctx.fillStyle = fg; ctx.fill();
    ctx.shadowColor = 'transparent';
    rr(ctx, x + 1.5, y + 1.5, lw - 3, lh - 3, s * 0.09); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
    rr(ctx, x, y, lw, lh, s * 0.1); ctx.strokeStyle = 'rgba(70,45,10,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    if (label && k > 0.35) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, lw, lh); ctx.clip();
      ctx.translate(x + lw / 2, y + lh * 0.55); ctx.scale(1, k); ctx.font = `800 ${fs * (num > 9 ? 0.86 : 1.05)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(String(num), 0, 1.6);
      ctx.fillStyle = T.ink; ctx.fillText(String(num), 0, 0);
      ctx.restore();
    }
    // brass pin at the hinge end
    brassScrew(ctx, x + lw / 2, y + Math.min(lh, s * 0.16) * 0.8 + 1, Math.max(2.4, s * 0.05));
    if (flip > 0) { ctx.fillStyle = `rgba(20,8,0,${0.5 * flip})`; rr(ctx, x, y, lw, lh, s * 0.1); ctx.fill(); }
    if (dim > 0) { ctx.fillStyle = `rgba(22,8,4,${0.72 * dim})`; rr(ctx, x, y, lw, lh, s * 0.1); ctx.fill(); }
    if (lift > 0) { rr(ctx, x - 2, y - 2, lw + 4, lh + 4, s * 0.12); ctx.strokeStyle = `rgba(255,196,64,${0.9 * lift})`; ctx.lineWidth = 3.4; ctx.shadowColor = 'rgba(255,190,60,0.9)'; ctx.shadowBlur = 16; ctx.stroke(); }
    if (glow > 0) { const pulse = 0.65 + 0.35 * Math.sin(t * 5); rr(ctx, x - 3, y - 3, lw + 6, lh + 6, s * 0.13); ctx.strokeStyle = `rgba(110,225,255,${glow * pulse})`; ctx.lineWidth = 3.4; ctx.shadowColor = 'rgba(80,210,255,0.9)'; ctx.shadowBlur = 14; ctx.stroke(); }
    ctx.restore();
  }
  // hinge barrel across the top of the slot
  const hg = ctx.createLinearGradient(0, sl.y, 0, sl.y + s * 0.1); hg.addColorStop(0, '#f6dc8c'); hg.addColorStop(0.5, '#c79a34'); hg.addColorStop(1, '#6b4a10');
  rr(ctx, sl.x + sl.w * 0.12, sl.y - 1, sl.w * 0.76, Math.max(4, s * 0.075), 3); ctx.fillStyle = hg; ctx.fill();
}

// A die: ivory cube face with pips, drawn at centre (cx, cy), `size` wide, rotated by `ang`, lifted by `air` (shadow separates).
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export function drawDie(ctx, cx, cy, size, value, o = {}) {
  const { ang = 0, air = 0, tint = 'ivory', fade = 1 } = o;
  const pal = tint === 'red' ? ['#ff9a8a', '#d6392f', '#8a1612', '#fff1e0'] : ['#fffaf0', '#efe3c5', '#c8b385', '#2a160a'];
  ctx.save(); ctx.globalAlpha = fade;
  ctx.fillStyle = `rgba(0,0,0,${0.35 - air * 0.12})`; ctx.beginPath(); ctx.ellipse(cx + air * size * 0.35 + size * 0.06, cy + size * (0.5 + air * 0.25), size * (0.46 - air * 0.06), size * 0.16, 0, 0, 6.2832); ctx.fill();
  ctx.translate(cx, cy - air * size * 0.5); ctx.rotate(ang);
  const h = size / 2, r = size * 0.2;
  const g = ctx.createLinearGradient(-h, -h, h, h); g.addColorStop(0, pal[0]); g.addColorStop(0.6, pal[1]); g.addColorStop(1, pal[2]);
  rr(ctx, -h, -h, size, size, r); ctx.fillStyle = g; ctx.fill();
  rr(ctx, -h + 2, -h + 2, size - 4, size - 4, r - 1); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  rr(ctx, -h, -h, size, size, r); ctx.strokeStyle = 'rgba(60,35,10,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  const pr = size * 0.085, sp = size * 0.26;
  for (const [px, py] of PIPS[value] || []) {
    const pg = ctx.createRadialGradient(px * sp - pr * 0.3, py * sp - pr * 0.3, 0.5, px * sp, py * sp, pr * 1.1);
    pg.addColorStop(0, tint === 'red' ? '#fff8f0' : '#6a4a30'); pg.addColorStop(1, pal[3]);
    ctx.beginPath(); ctx.arc(px * sp, py * sp, pr, 0, 6.2832); ctx.fillStyle = tint === 'red' ? pal[3] : pg; ctx.fill();
  }
  ctx.restore();
}

// The velvet dice tray.
export function drawTray(ctx, r) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h); g.addColorStop(0, '#6a1424'); g.addColorStop(1, '#3d0a15');
  rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.clip();
  const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.45, 4, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.7); v.addColorStop(0, 'rgba(255,120,120,0.18)'); v.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = v; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 24); ctx.strokeStyle = 'rgba(214,168,72,0.7)'; ctx.lineWidth = 3; ctx.stroke();
  rr(ctx, r.x, r.y, r.w, r.h, 26); ctx.strokeStyle = 'rgba(20,6,6,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
}

export function drawParticles(ctx, list) {
  for (const p of list) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * a), 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
