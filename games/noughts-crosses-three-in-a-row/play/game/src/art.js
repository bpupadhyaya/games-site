// Drawing helpers: themes, lit marks (X bars and O rings), carved boards, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.
import { SPECS } from './rules.js';

export const W = 720, H = 1560;
export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Times New Roman", serif';

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function mix(h, o, t) {
  const a = hexRgb(h), b = hexRgb(o);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export const light = (h, t) => mix(h, '#ffffff', t);
export const dark = (h, t) => mix(h, '#000000', t);
export const alpha = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = (t) => 1 - (1 - t) ** 3;
export const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// ---------------------------------------------------------------------------------------------------- themes
// bg: three background stops; slab: board face (top, bottom) and edge; X / O: piece colours (base, highlight, shadow).
export const THEMES = [
  {
    id: 'marble', name: 'Marble & Bronze', kind: 'marble',
    bg: ['#100d0b', '#261c15', '#150f0c'], glow: 'rgba(255,170,90,0.26)', fleck: '240,200,130',
    slab: ['#f1ece3', '#cbc2b3'], edge: '#8a8071', side: '#5e564b', vein: 'rgba(118,108,96,0.30)',
    groove: '#51473b', grooveHi: 'rgba(255,255,255,0.75)', node: '#4a4034',
    x: { base: '#d9993d', hi: '#ffe5a8', lo: '#7d4a14', glow: '255,205,120' },
    o: { base: '#38b3a0', hi: '#c6fff2', lo: '#145c52', glow: '120,255,225' },
    accent: '#e8c46a', ink: '#f6ecd6', win: '#ffd877',
    panel: ['rgba(46,34,26,0.96)', 'rgba(28,20,15,0.98)'], stroke: 'rgba(232,196,106,0.55)',
    btn: ['#52402f', '#3a2c20'], btnOn: ['#3a9c86', '#25705f'], primary: ['#f0cc72', '#d9a443'], primaryInk: '#3a2410',
  },
  {
    id: 'boxwood', name: 'Boxwood & Lacquer', kind: 'wood',
    bg: ['#0b1914', '#17332a', '#0d1d17'], glow: 'rgba(255,214,140,0.20)', fleck: '250,230,170',
    slab: ['#ecc983', '#c9994f'], edge: '#8a5f26', side: '#5a3a14', vein: 'rgba(120,76,24,0.26)',
    groove: '#5b3a14', grooveHi: 'rgba(255,240,200,0.7)', node: '#59380f',
    x: { base: '#d24a3c', hi: '#ff9d8c', lo: '#6c1710', glow: '255,130,110' },
    o: { base: '#3b3b46', hi: '#a9b0c4', lo: '#101015', glow: '170,185,230' },
    accent: '#f0cf84', ink: '#f6efdc', win: '#ffe08a',
    panel: ['rgba(18,44,36,0.96)', 'rgba(10,28,22,0.98)'], stroke: 'rgba(240,207,132,0.5)',
    btn: ['#27503f', '#1b3a2d'], btnOn: ['#b8433a', '#862b25'], primary: ['#f0cf84', '#d6a548'], primaryInk: '#33220c',
  },
  {
    id: 'night', name: 'Night Glass', kind: 'glass',
    bg: ['#070716', '#140e32', '#0a0a1f'], glow: 'rgba(130,90,255,0.28)', fleck: '170,160,255',
    slab: ['#2b3158', '#151a38'], edge: '#5560b0', side: '#0a0d22', vein: 'rgba(130,150,255,0.14)',
    groove: '#0b0e24', grooveHi: 'rgba(120,140,255,0.55)', node: '#0b0e24',
    x: { base: '#ff5d93', hi: '#ffc0d6', lo: '#a3174f', glow: '255,90,150' },
    o: { base: '#3fd9ff', hi: '#d2f7ff', lo: '#0f6f93', glow: '90,225,255' },
    accent: '#9fb0ff', ink: '#eef0ff', win: '#fff2a0',
    panel: ['rgba(26,24,62,0.96)', 'rgba(14,12,38,0.98)'], stroke: 'rgba(150,165,255,0.5)',
    btn: ['#2d3270', '#1f2352'], btnOn: ['#2aa5c7', '#1a6f8b'], primary: ['#9fb0ff', '#6f82e6'], primaryInk: '#0c1033',
  },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export function text(ctx, str, x, y, size, color = '#fff', o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 6; ctx.shadowOffsetY = o.dy ?? 2; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (o.shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

// ---------------------------------------------------------------------------------------------------- background
const FLECKS = Array.from({ length: 30 }, (_, i) => [((i * 97) % 211) / 211 * W, ((i * 53) % 173) / 173 * H, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

export function background(ctx, th, t, glowY = 700) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const hg = ctx.createRadialGradient(W / 2, glowY, 40, W / 2, glowY, 640);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  for (const [x, y, s, ph] of FLECKS) {
    const yy = (y + t * (3 + s * 3)) % H;
    const a = 0.06 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(x, yy, 2.2 * s, 2.2 * s);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, 560, W / 2, H / 2, 1020);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------------------------------- panels and buttons
export function panel(ctx, th, x, y, w, h, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.blur ?? 26; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, th.panel[0]); g.addColorStop(1, th.panel[1]);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, o.r ?? 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 2; rr(ctx, x, y, w, h, o.r ?? 26); ctx.stroke();
}

// Flat buttons: one solid fill, a hairline border, a darker underside strip when at rest. No gloss shape.
// kind: primary | normal | on | danger | ghost
export function button(ctx, th, r, lines, kind = 'normal', o = {}) {
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.38;
  const press = o.pressed ? 2 : 0;
  const y = r.y + press;
  const rad = o.radius ?? 18;
  const col = kind === 'primary' ? th.primary : kind === 'on' ? th.btnOn : kind === 'danger' ? ['#c9503f', '#8e2b27'] : kind === 'ghost' ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)'] : th.btn;
  if (!press) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rr(ctx, r.x, r.y + 4, r.w, r.h, rad); ctx.fill(); }
  ctx.fillStyle = press ? col[1] : col[0];
  rr(ctx, r.x, y, r.w, r.h, rad); ctx.fill();
  ctx.strokeStyle = kind === 'primary' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.5;
  rr(ctx, r.x, y, r.w, r.h, rad); ctx.stroke();
  const color = kind === 'primary' ? th.primaryInk : th.ink;
  const size = o.size ?? 28, line = o.line ?? size * 1.22, subs = o.sub ?? [];
  const total = lines.length * line + (subs.length ? subs.length * size * 0.78 + 4 : 0);
  let ty = y + (r.h - total) / 2 + size * 0.9;
  for (const ln of lines) { text(ctx, ln, r.x + r.w / 2, ty, size, color, { weight: 700 }); ty += line; }
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, size * 0.62, kind === 'primary' ? alpha(th.primaryInk, 0.78) : 'rgba(246,236,214,0.72)', { weight: 500 }); ty += size * 0.78; }
  ctx.restore();
}

export function star(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.46 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

// ---------------------------------------------------------------------------------------------------- icons (centred at x,y, size s)
export function icon(ctx, name, x, y, s, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  if (name === 'undo') {
    ctx.beginPath(); ctx.arc(r * 0.05, r * 0.1, r * 0.62, Math.PI * 1.15, Math.PI * 2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.48, -r * 0.62); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.16, -r * 0.1); ctx.stroke();
  } else if (name === 'hint') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.28, r * 0.52); ctx.lineTo(r * 0.28, r * 0.52); ctx.moveTo(-r * 0.2, r * 0.8); ctx.lineTo(r * 0.2, r * 0.8); ctx.stroke();
  } else if (name === 'reset') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, Math.PI * 0.3, Math.PI * 2.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.78, -r * 0.55); ctx.lineTo(r * 0.78, -r * 0.05); ctx.lineTo(r * 0.28, -r * 0.1); ctx.stroke();
  } else if (name === 'pause') {
    ctx.fillRect(-r * 0.5, -r * 0.62, r * 0.36, r * 1.24); ctx.fillRect(r * 0.14, -r * 0.62, r * 0.36, r * 1.24);
  } else if (name === 'play') {
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.65); ctx.lineTo(r * 0.7, 0); ctx.lineTo(-r * 0.4, r * 0.65); ctx.closePath(); ctx.fill();
  } else if (name === 'back') {
    ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.7); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(r * 0.45, r * 0.7); ctx.stroke();
  } else if (name === 'minus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
  } else if (name === 'plus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
  } else if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.38, Math.PI, 0); ctx.stroke();
    rr(ctx, -r * 0.6, -r * 0.2, r * 1.2, r * 0.95, 5); ctx.fill();
  } else if (name === 'check') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(-r * 0.15, r * 0.45); ctx.lineTo(r * 0.65, -r * 0.5); ctx.stroke();
  }
  ctx.restore();
}

export function drawParticles(ctx, parts) {
  for (const q of parts) {
    const a = clamp01(q.life / (q.max * 0.6));
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    if (q.shape === 'ring') {
      ctx.strokeStyle = q.color; ctx.lineWidth = q.w ?? 4;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.stroke();
    } else if (q.shape === 'chip') {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------------- the marks
// A mark is a lit, extruded solid seen slightly from above. `d` is the diameter of the O ring (and the span of the X).
// o: { scale, alpha, glow (0..1), lift (0..1: raised off the board), tint, ghost }
const DEG = Math.PI / 180;

function ringPath(ctx, cx, cy, R, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
}
function barPath(ctx, cx, cy, ang, L, w) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.beginPath(); ctx.roundRect(-L / 2, -w / 2, L, w, w * 0.4);
  ctx.restore();
}

export function drawMark(ctx, th, who, cx, cy, d, o = {}) {
  const col = who === 1 ? th.x : th.o;
  const sc = (o.scale ?? 1) * (1 + 0.1 * (o.lift ?? 0));
  const a = o.alpha ?? 1;
  if (a <= 0.01 || sc <= 0.01) return;
  const glass = th.kind === 'glass';
  const depth = d * (glass ? 0.07 : 0.11) * sc;
  const lift = (o.lift ?? 0) * d * 0.16;
  const y = cy - lift;
  ctx.save();
  ctx.globalAlpha = a * (o.ghost ? 0.4 : 1);
  // contact shadow on the board
  if (!o.noShadow) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.filter = 'none';
    ctx.beginPath();
    ctx.ellipse(cx + d * 0.05, cy + depth + d * 0.1 + lift * 0.4, d * 0.48 * sc * (1 - (o.lift ?? 0) * 0.15), d * 0.2 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.translate(cx, y); ctx.scale(sc, sc); ctx.translate(-cx, -y);
  const Rr = d / 2, ri = d * 0.25;
  const steps = Math.max(2, Math.round(depth / 1.6));
  const sideCol = col.lo;
  if (who === 2) {
    for (let k = steps; k >= 1; k--) {
      ringPath(ctx, cx, y + (depth * k) / steps, Rr, ri);
      ctx.fillStyle = k === steps ? dark(sideCol, 0.25) : sideCol;
      ctx.fill('evenodd');
    }
    const g = ctx.createLinearGradient(cx - Rr, y - Rr, cx + Rr, y + Rr);
    g.addColorStop(0, col.hi); g.addColorStop(0.35, col.base); g.addColorStop(1, mix(col.base, col.lo, 0.65));
    if (o.glow || glass) { ctx.shadowColor = `rgba(${col.glow},${clamp01((o.glow ?? 0) + (glass ? 0.55 : 0))})`; ctx.shadowBlur = 26; }
    ringPath(ctx, cx, y, Rr, ri);
    ctx.fillStyle = g; ctx.fill('evenodd');
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    // inner wall: the far side of the hole shows its inside
    ctx.strokeStyle = alpha(col.lo.length === 7 ? col.lo : '#000000', 0.85); ctx.lineWidth = d * 0.05;
    ctx.beginPath(); ctx.arc(cx, y, ri + d * 0.015, 195 * DEG, 345 * DEG); ctx.stroke();
    ctx.strokeStyle = alpha(col.hi, 0.7); ctx.lineWidth = d * 0.025;
    ctx.beginPath(); ctx.arc(cx, y, ri + d * 0.008, 15 * DEG, 165 * DEG); ctx.stroke();
    // specular on the rim
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = d * 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, y, (Rr + ri) / 2 + d * 0.01, 205 * DEG, 255 * DEG); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = d * 0.02;
    ctx.beginPath(); ctx.arc(cx, y, Rr - d * 0.012, 200 * DEG, 340 * DEG); ctx.stroke();
  } else {
    const L = d * 1.0, w = d * 0.27;
    const angs = [Math.PI / 4, -Math.PI / 4];
    for (let k = steps; k >= 1; k--) {
      ctx.fillStyle = k === steps ? dark(sideCol, 0.25) : sideCol;
      for (const an of angs) { barPath(ctx, cx, y + (depth * k) / steps, an, L, w); ctx.fill(); }
    }
    angs.forEach((an, i) => {
      ctx.save();
      if (i === 1) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 2; }
      if (o.glow || glass) { ctx.shadowColor = `rgba(${col.glow},${clamp01((o.glow ?? 0) + (glass ? 0.55 : 0))})`; ctx.shadowBlur = 26; ctx.shadowOffsetY = 0; }
      const nx = -Math.sin(an) * w / 2, ny = Math.cos(an) * w / 2;
      const gg = ctx.createLinearGradient(cx + nx, y + ny, cx - nx, y - ny);
      gg.addColorStop(0, mix(col.base, col.lo, 0.7)); gg.addColorStop(0.7, col.base); gg.addColorStop(1, col.hi);
      barPath(ctx, cx, y, an, L, w);
      ctx.fillStyle = gg; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      const hx = Math.cos(an) * L * 0.36, hy = Math.sin(an) * L * 0.36;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = w * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - hx - nx * 0.45, y - hy - ny * 0.45); ctx.lineTo(cx + hx - nx * 0.45, y + hy - ny * 0.45); ctx.stroke();
      ctx.restore();
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- the board
// Geometry of a board drawn into a square: slab rect, cell size and cell centres.
export function boardGeo(mode, x, y, side) {
  const sp = SPECS[mode], n = sp.size;
  const m = side * (n === 3 ? 0.06 : 0.05);
  const cell = (side - 2 * m) / n;
  const centers = [];
  for (let i = 0; i < sp.n; i++) centers.push([x + m + cell * ((i % n) + 0.5), y + m + cell * (Math.floor(i / n) + 0.5)]);
  return { x, y, side, m, cell, n, centers, mode, d: cell * (mode === 'terni' ? 0.5 : 0.7) };
}

const VEINS = [
  [[0.05, 0.2], [0.3, 0.1], [0.55, 0.35], [0.95, 0.22]],
  [[0.0, 0.62], [0.35, 0.5], [0.6, 0.8], [1.0, 0.7]],
  [[0.3, 0.0], [0.4, 0.4], [0.7, 0.55], [0.8, 1.0]],
  [[0.1, 1.0], [0.25, 0.7], [0.5, 0.78], [0.9, 0.45]],
];

export function drawSlab(ctx, th, x, y, side, o = {}) {
  const r = side * 0.06, thick = o.thick ?? side * 0.045;
  ctx.save();
  if (!o.flat) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = side * 0.06; ctx.shadowOffsetY = thick * 1.6;
  }
  ctx.fillStyle = th.side; rr(ctx, x, y + thick, side, side, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(x, y, x + side * 0.3, y + side);
  g.addColorStop(0, th.slab[0]); g.addColorStop(1, th.slab[1]);
  ctx.fillStyle = g; rr(ctx, x, y, side, side, r); ctx.fill();
  ctx.save();
  rr(ctx, x, y, side, side, r); ctx.clip();
  if (th.kind === 'marble') {
    ctx.strokeStyle = th.vein; ctx.lineCap = 'round';
    VEINS.forEach((v, i) => {
      ctx.lineWidth = side * (0.004 + 0.003 * (i % 2));
      ctx.beginPath(); ctx.moveTo(x + v[0][0] * side, y + v[0][1] * side);
      ctx.bezierCurveTo(x + v[1][0] * side, y + v[1][1] * side, x + v[2][0] * side, y + v[2][1] * side, x + v[3][0] * side, y + v[3][1] * side);
      ctx.stroke();
    });
    ctx.lineWidth = side * 0.0018; ctx.globalAlpha = 0.7;
    VEINS.forEach((v, i) => {
      ctx.beginPath(); ctx.moveTo(x + v[0][0] * side + 6, y + v[0][1] * side + 10);
      ctx.bezierCurveTo(x + v[1][0] * side + 10, y + v[1][1] * side + 22, x + v[2][0] * side - 14, y + v[2][1] * side + 8, x + v[3][0] * side, y + v[3][1] * side + 12 * (i + 1));
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  } else if (th.kind === 'wood') {
    ctx.strokeStyle = th.vein;
    for (let i = 0; i < 26; i++) {
      const yy = y + (i + 0.5) * (side / 26);
      ctx.lineWidth = 1 + (i % 3 === 0 ? 1.5 : 0);
      ctx.beginPath(); ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + side * 0.3, yy + Math.sin(i) * 7, x + side * 0.65, yy - Math.cos(i * 1.7) * 8, x + side, yy + Math.sin(i * 0.6) * 6);
      ctx.stroke();
    }
  } else {
    const sg = ctx.createLinearGradient(x, y, x + side, y + side);
    sg.addColorStop(0, 'rgba(160,180,255,0.22)'); sg.addColorStop(0.45, 'rgba(160,180,255,0)'); sg.addColorStop(1, 'rgba(120,90,255,0.10)');
    ctx.fillStyle = sg; ctx.fillRect(x, y, side, side);
  }
  if (side >= 300 && o.border !== false) meanderBorder(ctx, th, x, y, side, side * (o.mm ?? 0.06));
  // bevel
  const bg = ctx.createLinearGradient(0, y, 0, y + side);
  bg.addColorStop(0, 'rgba(255,255,255,0.35)'); bg.addColorStop(0.1, 'rgba(255,255,255,0)'); bg.addColorStop(0.9, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = bg; ctx.fillRect(x, y, side, side);
  ctx.restore();
  ctx.strokeStyle = th.edge; ctx.lineWidth = 2; rr(ctx, x, y, side, side, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; rr(ctx, x + 3, y + 3, side - 6, side - 6, r - 2); ctx.stroke();
  ctx.restore();
}

// A Greek-key (meander) band inlaid along the slab edge: a small squared spiral repeated around the board.
function meanderBorder(ctx, th, x, y, side, m) {
  const u = Math.max(3.2, m * 0.1), unit = u * 4, band = u * 2;
  const inset = m * 0.18;
  const edge = (x0, y0, dx, dy) => {
    const len = side - inset * 2 - band * 2;
    const n = Math.max(2, Math.floor(len / unit));
    const start = (len - n * unit) / 2;
    // local axes: along (dx, dy), across (-dy, dx) pointing inwards
    const P = (s, t) => [x0 + dx * s - dy * t, y0 + dy * s + dx * t];
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s0 = band + start + i * unit;
      const pts = [[0, band], [0, 0], [3 * u, 0], [3 * u, band], [u, band], [u, u], [2 * u, u]];
      pts.forEach(([s, t], k) => { const [px, py] = P(s0 + s, t); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    }
    ctx.stroke();
  };
  ctx.save();
  ctx.strokeStyle = th.groove; ctx.globalAlpha = th.kind === 'glass' ? 0.9 : 0.55; ctx.lineWidth = Math.max(1.6, u * 0.55); ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  if (th.kind === 'glass') { ctx.strokeStyle = th.edge; ctx.shadowColor = th.edge; ctx.shadowBlur = 6; }
  edge(x + inset, y + inset, 1, 0);
  edge(x + side - inset, y + inset, 0, 1);
  edge(x + side - inset, y + side - inset, -1, 0);
  edge(x + inset, y + side - inset, 0, -1);
  ctx.restore();
}

// A carved line: a dark channel with a light lower lip, so it reads as cut into the slab.
function groove(ctx, th, x0, y0, x1, y1, w) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = th.grooveHi; ctx.lineWidth = w * 0.9;
  ctx.beginPath(); ctx.moveTo(x0, y0 + w * 0.55); ctx.lineTo(x1, y1 + w * 0.55); ctx.stroke();
  ctx.strokeStyle = th.groove; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = w * 0.4;
  ctx.beginPath(); ctx.moveTo(x0, y0 - w * 0.2); ctx.lineTo(x1, y1 - w * 0.2); ctx.stroke();
  if (th.kind === 'glass') {
    ctx.strokeStyle = 'rgba(110,130,255,0.45)'; ctx.lineWidth = w * 0.35; ctx.shadowColor = 'rgba(110,130,255,0.8)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
}

export function drawBoardLines(ctx, th, geo) {
  const { x, y, side, m, cell, n, centers, mode } = geo;
  const gw = Math.max(5, side * 0.016);
  if (mode === 'terni') {
    const c = (i) => centers[i];
    const segs = [[0, 2], [3, 5], [6, 8], [0, 6], [1, 7], [2, 8], [0, 8], [2, 6]];
    for (const [a, b] of segs) groove(ctx, th, c(a)[0], c(a)[1], c(b)[0], c(b)[1], gw);
    for (let i = 0; i < 9; i++) {
      const [px, py] = c(i);
      ctx.save();
      ctx.fillStyle = th.node; ctx.beginPath(); ctx.arc(px, py, gw * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th.grooveHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py + 1.5, gw * 2.4, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(px, py - 1, gw * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    return;
  }
  for (let k = 1; k < n; k++) {
    const p = m + cell * k;
    groove(ctx, th, x + p, y + m * 0.6, x + p, y + side - m * 0.6, gw);
    groove(ctx, th, x + m * 0.6, y + p, x + side - m * 0.6, y + p, gw);
  }
}

// Whole board with marks, for small illustrations. cells: string of ./X/O or array. opts: { hl: [i], arrows: [[from,to]], line, dots: [i] }
export function drawMiniBoard(ctx, th, mode, x, y, side, cells, o = {}) {
  const geo = boardGeo(mode, x, y, side);
  drawSlab(ctx, th, x, y, side, { flat: true, thick: side * 0.03 });
  drawBoardLines(ctx, th, geo);
  const arr = typeof cells === 'string' ? cells.replace(/[\s/]/g, '').split('').map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0)) : cells;
  for (const i of o.hl ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.28); ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.restore();
  }
  for (const i of o.dots ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.85); ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  arr.forEach((v, i) => { if (v) { const [cx, cy] = geo.centers[i]; drawMark(ctx, th, v, cx, cy, geo.d, { noShadow: side < 200 }); } });
  for (const [a, b] of o.arrows ?? []) arrowBetween(ctx, th.accent, geo.centers[a], geo.centers[b], geo.cell * 0.2);
  if (o.line) drawWinLine(ctx, th, geo, o.line, 1, o.who ?? 1, { misere: o.misere });
  return geo;
}

function arrowBetween(ctx, color, p0, p1, pad) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  arrow(ctx, color, p0[0] + ux * pad, p0[1] + uy * pad, p1[0] - ux * pad, p1[1] - uy * pad);
}
export function arrow(ctx, color, x0, y0, x1, y1, lw = 6) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * 6, y1 + Math.sin(a) * 6);
  ctx.lineTo(x1 - Math.cos(a - 0.5) * 20, y1 - Math.sin(a - 0.5) * 20);
  ctx.lineTo(x1 - Math.cos(a + 0.5) * 20, y1 - Math.sin(a + 0.5) * 20);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// The winning line: a glowing bar that grows from its first to its last cell (k 0..1).
export function drawWinLine(ctx, th, geo, line, k, who, o = {}) {
  if (!line || k <= 0) return;
  if (line.length === 4 && line[1] - line[0] === 1 && line[2] - line[0] === geo.n) {
    // a 2x2 square: a glowing frame around the four cells instead of a bar
    const [x0, y0] = geo.centers[line[0]], [x1, y1] = geo.centers[line[3]];
    const col = o.misere ? '255,110,90' : (who === 1 ? th.x : th.o).glow, pad = geo.cell * 0.4, e = ease(clamp01(k));
    ctx.save();
    ctx.globalAlpha = e;
    ctx.shadowColor = `rgba(${col},0.95)`; ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(${col},0.16)`; ctx.beginPath(); ctx.roundRect(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2, geo.cell * 0.22); ctx.fill();
    ctx.strokeStyle = `rgba(${col},0.7)`; ctx.lineWidth = geo.cell * 0.09; ctx.stroke();
    ctx.shadowBlur = 10; ctx.strokeStyle = o.misere ? '#ffd2c8' : th.win; ctx.lineWidth = geo.cell * 0.03; ctx.stroke();
    ctx.restore();
    return;
  }
  const a = geo.centers[line[0]], b = geo.centers[line[line.length - 1]];
  const e = ease(clamp01(k));
  const x1 = a[0] + (b[0] - a[0]) * e, y1 = a[1] + (b[1] - a[1]) * e;
  const col = o.misere ? '255,110,90' : (who === 1 ? th.x : th.o).glow;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const ex = (dx / len) * geo.cell * 0.3, ey = (dy / len) * geo.cell * 0.3;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = `rgba(${col},0.95)`; ctx.shadowBlur = 30;
  ctx.strokeStyle = `rgba(${col},0.55)`; ctx.lineWidth = geo.cell * 0.2;
  ctx.beginPath(); ctx.moveTo(a[0] - ex, a[1] - ey); ctx.lineTo(x1 + (e >= 1 ? ex : 0), y1 + (e >= 1 ? ey : 0)); ctx.stroke();
  ctx.shadowBlur = 10;
  ctx.strokeStyle = o.misere ? '#ffd2c8' : th.win; ctx.lineWidth = geo.cell * 0.06;
  ctx.beginPath(); ctx.moveTo(a[0] - ex, a[1] - ey); ctx.lineTo(x1 + (e >= 1 ? ex : 0), y1 + (e >= 1 ? ey : 0)); ctx.stroke();
  ctx.restore();
}
