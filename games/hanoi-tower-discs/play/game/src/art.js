import { host } from './layout.js';

// Drawing helpers: lacquer background, discs, pegs, platform, panels, buttons, icons.
// Everything is plain canvas 2D; nothing here changes game state.

export const W = 720, H = 1560;
// The live canvas size in virtual units (kit fluid viewport); view.js copies meta.width/height here every frame.
export const view = { w: 720, h: 1560, local: 1 };   // local: an extra scale the current drawing is under (the title art)
export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Times New Roman", serif';

// Disc colours, smallest (index 0) to largest: lacquer pigments.
export const DISC_COLORS = ['#f2c14e', '#ee8a3a', '#d9473d', '#c23f7c', '#8b59c9', '#4a6fe0', '#2a9fcb', '#2fb58a', '#8cc641', '#e9ddb0'];
export const GOLD = '#e8c46a';
export const PAPER = '#f6ecd6';

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function mix(h, o, t) {
  const a = hexRgb(h), b = hexRgb(o);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export const light = (h, t) => mix(h, '#ffffff', t);
export const dark = (h, t) => mix(h, '#000000', t);
export const alpha = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function text(ctx, str, x, y, size, color = PAPER, o = {}) {
  size = Math.max(size, 11 / (host.px * view.local));      // never below ~11 css px on any screen
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 6; ctx.shadowOffsetY = o.dy ?? 2; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (o.shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

export function polyPath(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.blur ?? 28; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, o.top ?? 'rgba(52,22,30,0.95)');
  g.addColorStop(1, o.bottom ?? 'rgba(30,12,18,0.97)');
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, o.r ?? 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = o.stroke ?? 'rgba(232,196,106,0.55)';
  ctx.lineWidth = o.lw ?? 2;
  rr(ctx, x, y, w, h, o.r ?? 26); ctx.stroke();
  if (o.inner === true) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    rr(ctx, x + 6, y + 6, w - 12, h - 12, (o.r ?? 26) - 5); ctx.stroke();
  }
}

// kind: primary | normal | on | danger | ghost
export function button(ctx, r, lines, kind = 'normal', o = {}) {
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.38;
  const press = o.pressed ? 1 : 0;
  const y = r.y + press * 3;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = press ? 4 : 14; ctx.shadowOffsetY = press ? 1 : 5;
  const FACE = { primary: '#e6b957', on: '#2e9780', danger: '#b9433a', ghost: 'rgba(255,255,255,0.04)', normal: '#4d2129' };   // flat faces
  ctx.fillStyle = FACE[kind] ?? FACE.normal;
  rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = kind === 'primary' ? 'rgba(255,236,170,0.85)' : 'rgba(232,196,106,0.45)';
  ctx.lineWidth = 1.5;
  rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.stroke();
  if (press) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.fill(); }
  const color = kind === 'primary' ? '#3a2410' : PAPER;
  const size = o.size ?? 28;
  const line = o.line ?? size * 1.22;
  const subs = o.sub ?? [];
  const total = lines.length * line + (subs.length ? subs.length * size * 0.78 + 4 : 0);
  let ty = y + (r.h - total) / 2 + size * 0.9;
  for (const ln of lines) { text(ctx, ln, r.x + r.w / 2, ty, size, color, { weight: 700 }); ty += line; }
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, size * 0.62, kind === 'primary' ? '#5a3c1a' : 'rgba(244,234,211,0.7)', { weight: 500 }); ty += size * 0.78; }
  ctx.restore();
}

export function star(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.46 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}
// ---- icons (centered at x,y, size s) -----------------------------------------------------------------------------
export function icon(ctx, name, x, y, s, color = PAPER) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  const arrowHead = (px, py, ang) => {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang + 2.5) * s * 0.28, py + Math.sin(ang + 2.5) * s * 0.28);
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang - 2.5) * s * 0.28, py + Math.sin(ang - 2.5) * s * 0.28);
    ctx.stroke();
  };
  const arcArrow = (R, a0, a1) => {
    ctx.beginPath(); ctx.arc(0, 0, R, a0, a1, a1 < a0); ctx.stroke();
    const dir = a1 > a0 ? 1 : -1;
    const tipx = Math.cos(a1) * R, tipy = Math.sin(a1) * R;
    const tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, nx = Math.cos(a1), ny = Math.sin(a1);
    const L = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(tipx + tx * L * 1.1, tipy + ty * L * 1.1);
    ctx.lineTo(tipx + nx * L * 0.85, tipy + ny * L * 0.85);
    ctx.lineTo(tipx - nx * L * 0.85, tipy - ny * L * 0.85);
    ctx.closePath(); ctx.fill();
  };
  if (name === 'rotR' || name === 'handle') {
    arcArrow(r * 0.62, -2.5, 0.75);
  } else if (name === 'rotL') {
    arcArrow(r * 0.62, -0.64, -3.89);
  } else if (name === 'flip') {
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(-r * 0.85, r * 0.6); ctx.lineTo(-r * 0.2, r * 0.6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.55); ctx.lineTo(r * 0.85, r * 0.6); ctx.lineTo(r * 0.2, r * 0.6); ctx.closePath(); ctx.stroke();
  } else if (name === 'undo') {
    ctx.beginPath(); ctx.arc(r * 0.05, r * 0.1, r * 0.62, Math.PI * 1.15, Math.PI * 2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.48, -r * 0.62); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.16, -r * 0.1); ctx.stroke();
  } else if (name === 'hint') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.28, r * 0.52); ctx.lineTo(r * 0.28, r * 0.52); ctx.moveTo(-r * 0.2, r * 0.8); ctx.lineTo(r * 0.2, r * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, -r * 0.05); ctx.stroke();
  } else if (name === 'reset') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, Math.PI * 0.3, Math.PI * 2.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.78, -r * 0.55); ctx.lineTo(r * 0.78, -r * 0.05); ctx.lineTo(r * 0.28, -r * 0.1); ctx.stroke();
  } else if (name === 'pause') {
    ctx.fillRect(-r * 0.5, -r * 0.62, r * 0.36, r * 1.24); ctx.fillRect(r * 0.14, -r * 0.62, r * 0.36, r * 1.24);
  } else if (name === 'play') {
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.65); ctx.lineTo(r * 0.7, 0); ctx.lineTo(-r * 0.4, r * 0.65); ctx.closePath(); ctx.fill();
  } else if (name === 'back') {
    ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.7); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(r * 0.45, r * 0.7); ctx.stroke();
  } else if (name === 'menu') {
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.65, i * r * 0.5); ctx.lineTo(r * 0.65, i * r * 0.5); ctx.stroke(); }
  } else if (name === 'minus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
  } else if (name === 'plus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
  } else if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.38, Math.PI, 0); ctx.stroke();
    rr(ctx, -r * 0.6, -r * 0.2, r * 1.2, r * 0.95, 5); ctx.fill();
  }
  ctx.restore();
}

// Confetti / sparks drawn from puzzle particles
export function drawParticles(ctx, parts) {
  for (const q of parts) {
    const a = Math.max(0, Math.min(1, q.life / (q.max * 0.6)));
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    if (q.shape === 'petal') {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, q.size * 1.3, q.size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (q.shape === 'tile') {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.fillRect(-q.size, -q.size * 0.6, q.size * 2, q.size * 1.2);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---- background: dark red lacquer with drifting gold-leaf flecks ----------------------------------------------
const FLECKS = Array.from({ length: 56 }, (_, i) => [((i * 97) % 211) / 211, ((i * 53) % 173) / 173, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

export function background(ctx, t, glowY = 760) {
  const vw = view.w, vh = view.h, m = Math.max(vw, vh);
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#12070b');
  g.addColorStop(0.5, '#2a0f16');
  g.addColorStop(1, '#190a0f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  const hg = ctx.createRadialGradient(vw / 2, glowY, 40, vw / 2, glowY, 620);
  hg.addColorStop(0, 'rgba(214,120,70,0.30)');
  hg.addColorStop(0.5, 'rgba(150,60,50,0.12)');
  hg.addColorStop(1, 'rgba(150,60,50,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, vw, vh);
  for (const [fx, fy, s, ph] of FLECKS) {
    const yy = (fy * vh + t * (3 + s * 3)) % vh;
    const a = 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(240,200,120,${a})`;
    ctx.fillRect(fx * vw, yy, 2.2 * s, 2.2 * s);
  }
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, m * 0.36, vw / 2, vh / 2, m * 0.66);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);
}

// ---- tower pieces -----------------------------------------------------------------------------------------------
// A disc is a lit cylinder seen slightly from above. (x, yb) is the centre of its bottom edge; sh is its side
// height, ry the vertical radius of its top ellipse. Stacked discs are sh apart.
export const ryOf = (sh) => sh * 0.3;

export function drawDisc(ctx, x, yb, w, sh, idx, o = {}) {
  const col = DISC_COLORS[idx % DISC_COLORS.length];
  const ry = ryOf(sh);
  const rx = w / 2;
  const sq = o.squash ?? 0;
  ctx.save();
  if (sq) { ctx.translate(x, yb); ctx.scale(1 + sq * 0.5, 1 - sq); ctx.translate(-x, -yb); }
  const top = yb - sh;
  const sg = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  sg.addColorStop(0, dark(col, 0.45));
  sg.addColorStop(0.18, dark(col, 0.12));
  sg.addColorStop(0.36, light(col, 0.32));
  sg.addColorStop(0.55, col);
  sg.addColorStop(1, dark(col, 0.5));
  ctx.beginPath();
  ctx.moveTo(x - rx, top);
  ctx.lineTo(x - rx, yb);
  ctx.ellipse(x, yb, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + rx, top);
  ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const gl = ctx.createLinearGradient(0, top, 0, yb + ry);
  gl.addColorStop(0, 'rgba(255,255,255,0.18)');
  gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  gl.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = gl;
  ctx.fillRect(x - rx, top - ry, w, sh + ry * 2 + 2);
  ctx.restore();
  const tg = ctx.createLinearGradient(x - rx, top - ry, x + rx, top + ry);
  tg.addColorStop(0, light(col, 0.6));
  tg.addColorStop(0.5, light(col, 0.28));
  tg.addColorStop(1, light(col, 0.05));
  ctx.beginPath();
  ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(255,244,214,0.55)';
  ctx.stroke();
  const hr = Math.min(o.hole ?? 11, rx * 0.4);
  ctx.beginPath();
  ctx.ellipse(x, top, hr, hr * 0.3 + 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(18,6,8,0.85)';
  ctx.fill();
  if (o.label !== false && sh >= 28) {
    text(ctx, String(idx + 1), x, yb - sh * 0.3, Math.min(sh * 0.5, 30), 'rgba(255,255,255,0.86)', { weight: 800, font: DISPLAY, shadow: 'rgba(0,0,0,0.45)', blur: 3, dy: 1 });
  }
  if (o.glow) {
    ctx.beginPath();
    ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI * 2);
    ctx.shadowColor = `rgba(255,232,150,${o.glow})`;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = `rgba(255,240,180,${Math.min(1, o.glow + 0.1)})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - rx, top); ctx.lineTo(x - rx, yb); ctx.ellipse(x, yb, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(x + rx, top);
    ctx.stroke();
  }
  ctx.restore();
}

// A carved peg: a lathe-turned post with carved bands and a gold finial. (x, yBase) is its foot, len its height.
export function drawRod(ctx, x, yBase, len, r, o = {}) {
  const top = yBase - len;
  ctx.save();
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, '#5a3119');
  g.addColorStop(0.3, '#d6a56a');
  g.addColorStop(0.5, '#eac58c');
  g.addColorStop(1, '#4e2914');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, top, r * 2, len);
  const bands = Math.max(3, Math.floor(len / 90));
  for (let i = 1; i <= bands; i++) {
    const by = yBase - (len * i) / (bands + 1) - 4;
    ctx.fillStyle = 'rgba(60,28,10,0.55)';
    ctx.fillRect(x - r, by, r * 2, 3);
    ctx.fillStyle = 'rgba(255,224,160,0.4)';
    ctx.fillRect(x - r, by + 3, r * 2, 1.5);
  }
  const fg = ctx.createRadialGradient(x - r * 0.4, top - r * 0.5, 1, x, top - r * 0.2, r * 1.7);
  fg.addColorStop(0, '#fff3c4');
  fg.addColorStop(0.5, '#e8c46a');
  fg.addColorStop(1, '#9a6c1e');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(x, top - r * 0.2, r * 1.45, 0, Math.PI * 2);
  ctx.fill();
  if (o.glow) {
    ctx.shadowColor = `rgba(255,224,130,${o.glow})`;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = `rgba(255,236,170,${o.glow})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, top - r * 0.2, r * 1.45, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// The lacquered base the pegs stand on. y is the top surface line.
export function drawSlab(ctx, x0, x1, y, o = {}) {
  const h = o.h ?? 96;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  const fg = ctx.createLinearGradient(0, y, 0, y + h);
  fg.addColorStop(0, '#4a1a1f');
  fg.addColorStop(1, '#1e0a0d');
  ctx.fillStyle = fg;
  rr(ctx, x0, y + 24, x1 - x0, h, 22);
  ctx.fill();
  ctx.restore();
  const tg = ctx.createLinearGradient(0, y - 8, 0, y + 40);
  tg.addColorStop(0, '#7a2c2a');
  tg.addColorStop(1, '#58201f');
  ctx.fillStyle = tg;
  rr(ctx, x0, y - 6, x1 - x0, 58, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,106,0.7)';
  ctx.lineWidth = 2;
  rr(ctx, x0 + 10, y + 2, x1 - x0 - 20, 40, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,196,106,0.5)';
  ctx.lineWidth = 1.5;
  rr(ctx, x0, y - 6, x1 - x0, 58, 24);
  ctx.stroke();
  const sh = ctx.createLinearGradient(x0, 0, x1, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.3, 'rgba(255,230,200,0.12)');
  sh.addColorStop(0.5, 'rgba(255,230,200,0)');
  ctx.fillStyle = sh;
  rr(ctx, x0, y - 6, x1 - x0, 58, 24);
  ctx.fill();
}

// A small tower scene from a peg assignment (pegOf[d] = peg of disc d), for Rules illustrations and level cells.
export function drawMiniTower(ctx, x, y, w, h, pegOf, P, o = {}) {
  const n = pegOf.length;
  const sp = w / P;
  const maxW = sp * 0.88;
  const minW = Math.min(maxW * 0.36, 24);
  const sh = Math.min((h - 36) / (n + 1.6), 30);
  const base = y + h - 14;
  const peglen = (n + 1.2) * sh;
  ctx.save();
  rr(ctx, x + 2, base + 4, w - 4, 8, 4);
  ctx.fillStyle = o.slab ?? '#6a2528';
  ctx.fill();
  const counts = Array(P).fill(0);
  for (let p = 0; p < P; p++) drawRod(ctx, x + sp * (p + 0.5), base + 2, peglen, Math.max(2.5, sp * 0.03), { glow: o.goal === p ? 0.8 : 0 });
  // stack bottom-up: the larger discs of a peg sit lower
  const order = [...Array(n).keys()].sort((a, b) => b - a);
  for (const d of order) {
    const p = pegOf[d];
    const px = x + sp * (p + 0.5);
    const dw = n === 1 ? maxW : minW + ((maxW - minW) * d) / (n - 1);
    drawDisc(ctx, px, base - counts[p] * sh, dw, sh, d, { label: false, hole: 2.5 });
    counts[p]++;
  }
  if (o.labels) for (let p = 0; p < P; p++) text(ctx, 'ABCD'[p], x + sp * (p + 0.5), base + 30, 17, 'rgba(246,236,214,0.7)', { weight: 700 });
  ctx.restore();
}
