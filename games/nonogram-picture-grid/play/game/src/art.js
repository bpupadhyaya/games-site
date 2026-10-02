// Drawing helpers: themes, flat buttons, icons, tiles, clue text. Plain canvas 2D, no images, nothing here changes game state.
export const W = 720, H = 1560;
export const UI = '-apple-system, "SF Pro Text", "Hiragino Sans", "Yu Gothic", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", "Hiragino Mincho ProN", "Yu Mincho", Georgia, "Times New Roman", serif';
// Clue numbers use the plain UI face with tabular figures so every digit is the same width.
export const NUM = '-apple-system, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif';

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
export const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// ---------------------------------------------------------------------------------------------------- themes
// bg: three background stops. card: the board paper (top, bottom). tile: an empty square. fill: an inked square (base, light, dark).
export const THEMES = [
  {
    id: 'paper', name: 'Paper and Ink', jaName: '和紙と墨',
    bg: ['#15110e', '#2a211a', '#171210'], glow: 'rgba(255,190,110,0.22)', fleck: '240,210,150',
    card: ['#f6eedb', '#e4d8bd'], cardEdge: '#8c7b58', cardSide: '#5d4f37', tile: '#fbf6e8', tileLo: '#ece1c8', tileEdge: 'rgba(110,90,55,0.30)',
    guide: 'rgba(80,60,30,0.62)', fill: ['#2f3350', '#59608f', '#1a1c33'], cross: '#b5503c', clue: '#2b2f4a', clueDone: 'rgba(43,47,74,0.30)', clueDoneBg: 'rgba(88,160,96,0.20)',
    row: 'rgba(255,170,40,0.22)', hint: '#f0a42a', bad: '#d8493a', good: '#4aa56a',
    accent: '#ecc977', ink: '#f6ecd6', panel: ['rgba(46,36,28,0.97)', 'rgba(28,21,16,0.98)'], stroke: 'rgba(236,201,119,0.5)',
    btn: ['#54412f', '#3c2e21'], btnOn: ['#3f8f77', '#2a6654'], primary: ['#f0cd78', '#d9a844'], primaryInk: '#3a2410',
  },
  {
    id: 'lacquer', name: 'Lacquer and Gold', jaName: '漆と金',
    bg: ['#120707', '#2a0f10', '#160808'], glow: 'rgba(255,120,70,0.20)', fleck: '255,180,120',
    card: ['#241a1b', '#171011'], cardEdge: '#6b4a28', cardSide: '#0c0708', tile: '#33282a', tileLo: '#2a2022', tileEdge: 'rgba(255,215,140,0.14)',
    guide: 'rgba(235,190,110,0.55)', fill: ['#e8bb55', '#fff0b8', '#a8741c'], cross: '#e86a55', clue: '#f3e4c4', clueDone: 'rgba(243,228,196,0.28)', clueDoneBg: 'rgba(96,190,120,0.18)',
    row: 'rgba(255,170,70,0.2)', hint: '#ffb84a', bad: '#ff6a58', good: '#5fd08a',
    accent: '#f0c76a', ink: '#f8ecd4', panel: ['rgba(48,22,22,0.97)', 'rgba(28,12,12,0.98)'], stroke: 'rgba(240,199,106,0.5)',
    btn: ['#5a2e2a', '#40201e'], btnOn: ['#2f8a72', '#1f6250'], primary: ['#f2cf7c', '#d8a640'], primaryInk: '#3a1e0c',
  },
  {
    id: 'slate', name: 'Slate and Mist', jaName: '石盤と霧',
    bg: ['#0b121c', '#18283a', '#0d1622'], glow: 'rgba(120,170,230,0.20)', fleck: '170,200,255',
    card: ['#e5ecf4', '#c9d5e3'], cardEdge: '#6f86a3', cardSide: '#3b4c63', tile: '#f1f5fa', tileLo: '#dde6f0', tileEdge: 'rgba(60,85,120,0.28)',
    guide: 'rgba(40,65,100,0.6)', fill: ['#26425f', '#4e769e', '#142538'], cross: '#c04f56', clue: '#1f3148', clueDone: 'rgba(31,49,72,0.30)', clueDoneBg: 'rgba(60,160,120,0.20)',
    row: 'rgba(60,140,240,0.2)', hint: '#e8932c', bad: '#d84a4a', good: '#3f9f72',
    accent: '#a8c8f0', ink: '#eaf1fa', panel: ['rgba(24,40,60,0.97)', 'rgba(14,24,38,0.98)'], stroke: 'rgba(168,200,240,0.5)',
    btn: ['#2e4a68', '#213750'], btnOn: ['#2f8f85', '#1f665f'], primary: ['#a9caf2', '#7ea6dc'], primaryInk: '#0f2036',
  },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }

// Flat, crisp text: one fill, no doubled shadow or highlight copies.
export function text(ctx, str, x, y, size, color = '#fff', o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// ---------------------------------------------------------------------------------------------------- background
const FLECKS = Array.from({ length: 26 }, (_, i) => [((i * 97) % 211) / 211 * W, ((i * 53) % 173) / 173 * H, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

export function background(ctx, th, t, glowY = 700) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const hg = ctx.createRadialGradient(W / 2, glowY, 40, W / 2, glowY, 640);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  for (const [x, y, s, ph] of FLECKS) {
    const yy = (y + t * (2 + s * 2)) % H;
    const a = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.6 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(x, yy, 2 * s, 2 * s);
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

// Flat buttons: one solid fill, a hairline border, a darker underside strip at rest. No gloss shape.
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
  if (name === 'undo' || name === 'redo') {
    if (name === 'redo') ctx.scale(-1, 1);
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
  } else if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.38, Math.PI, 0); ctx.stroke();
    rr(ctx, -r * 0.6, -r * 0.2, r * 1.2, r * 0.95, 5); ctx.fill();
  } else if (name === 'check') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(-r * 0.15, r * 0.45); ctx.lineTo(r * 0.65, -r * 0.5); ctx.stroke();
  } else if (name === 'fill') {
    rr(ctx, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24, r * 0.2); ctx.fill();
  } else if (name === 'cross') {
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(r * 0.55, r * 0.55); ctx.moveTo(r * 0.55, -r * 0.55); ctx.lineTo(-r * 0.55, r * 0.55); ctx.stroke();
  } else if (name === 'move') {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0);
    ctx.moveTo(-r * 0.25, -r * 0.55); ctx.lineTo(0, -r * 0.8); ctx.lineTo(r * 0.25, -r * 0.55);
    ctx.moveTo(-r * 0.25, r * 0.55); ctx.lineTo(0, r * 0.8); ctx.lineTo(r * 0.25, r * 0.55);
    ctx.moveTo(-r * 0.55, -r * 0.25); ctx.lineTo(-r * 0.8, 0); ctx.lineTo(-r * 0.55, r * 0.25);
    ctx.moveTo(r * 0.55, -r * 0.25); ctx.lineTo(r * 0.8, 0); ctx.lineTo(r * 0.55, r * 0.25);
    ctx.stroke();
  } else if (name === 'zoom') {
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.12, r * 0.52, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.26, r * 0.26); ctx.lineTo(r * 0.78, r * 0.78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.12); ctx.lineTo(r * 0.06, -r * 0.12); ctx.moveTo(-r * 0.12, -r * 0.3); ctx.lineTo(-r * 0.12, r * 0.06); ctx.stroke();
  } else if (name === 'shield') {
    ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(r * 0.7, -r * 0.5); ctx.lineTo(r * 0.6, r * 0.25); ctx.lineTo(0, r * 0.85); ctx.lineTo(-r * 0.6, r * 0.25); ctx.lineTo(-r * 0.7, -r * 0.5); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.lineTo(-r * 0.05, r * 0.28); ctx.lineTo(r * 0.35, -r * 0.2); ctx.stroke();
  } else if (name === 'sun') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); ctx.stroke(); }
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
