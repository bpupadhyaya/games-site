// Drawing helpers: looks (stone, clay, moonlit), flat buttons, icons, the powder line. Plain canvas 2D, no images; nothing here changes game state.
export const W = 720, H = 1560;
export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Times New Roman", serif';

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function mix(h, o, t) {
  const a = hexRgb(h), b = hexRgb(o);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export const alpha = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// ---------------------------------------------------------------------------------------------------- looks
// bg: three floor stops; blot: soft patches; speck: grain colour (r,g,b). powder: the line colour; mark: the gap marks; dot: the dots.
export const THEMES = [
  {
    id: 'stone', name: 'Stone Floor',
    bg: ['#17181a', '#222427', '#151618'], blot: '120,128,140', speck: '210,214,222', glow: 'rgba(255,244,222,0.10)',
    powder: '#f7f2e8', powderCore: '#ffffff', halo: '255,238,205', dot: '#fff6df', ring: 'rgba(255,255,255,0.10)', mark: '#e8a468', markInk: '#2a1a0e', pad: 'rgba(0,0,0,0.30)', padEdge: 'rgba(255,255,255,0.07)',
    hint: '#ffc766', bad: '#ff7a63', good: '#8fe0a8',
    accent: '#f1d9a0', ink: '#f4efe4', panel: ['rgba(38,40,44,0.97)', 'rgba(24,25,28,0.98)'], stroke: 'rgba(241,217,160,0.45)',
    btn: ['#3d4046', '#2c2e33'], btnOn: ['#3f7d6c', '#2b5a4d'], primary: ['#f1d9a0', '#d8b968'], primaryInk: '#2d2410',
  },
  {
    id: 'clay', name: 'Clay Floor',
    bg: ['#1d120e', '#31201a', '#1a0f0b'], blot: '170,100,70', speck: '236,200,170', glow: 'rgba(255,190,130,0.12)',
    powder: '#fbf1df', powderCore: '#fffaf0', halo: '255,214,170', dot: '#fff0d4', ring: 'rgba(255,230,200,0.11)', mark: '#8fd3c4', markInk: '#0d2a24', pad: 'rgba(0,0,0,0.28)', padEdge: 'rgba(255,225,190,0.08)',
    hint: '#ffcf70', bad: '#ff7d66', good: '#9be3b0',
    accent: '#f3c98b', ink: '#f7eadb', panel: ['rgba(52,32,26,0.97)', 'rgba(32,19,15,0.98)'], stroke: 'rgba(243,201,139,0.5)',
    btn: ['#5a3b30', '#432a22'], btnOn: ['#397d6c', '#265a4d'], primary: ['#f3c98b', '#d9a35a'], primaryInk: '#35200e',
  },
  {
    id: 'moon', name: 'Moonlit Court',
    bg: ['#0c1119', '#162131', '#0a0f17'], blot: '90,120,170', speck: '190,210,240', glow: 'rgba(150,190,255,0.12)',
    powder: '#eef4ff', powderCore: '#ffffff', halo: '170,205,255', dot: '#f2f7ff', ring: 'rgba(200,220,255,0.11)', mark: '#ffb878', markInk: '#2c1a0a', pad: 'rgba(0,0,0,0.30)', padEdge: 'rgba(190,215,255,0.08)',
    hint: '#ffcb6b', bad: '#ff7e6e', good: '#90e2b4',
    accent: '#b7d2f6', ink: '#e8f0fb', panel: ['rgba(22,34,52,0.97)', 'rgba(12,20,32,0.98)'], stroke: 'rgba(183,210,246,0.5)',
    btn: ['#2e4560', '#213349'], btnOn: ['#2f8a82', '#206560'], primary: ['#b7d2f6', '#86aee0'], primaryInk: '#0f2036',
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

// ---------------------------------------------------------------------------------------------------- the floor
let seedv = 7;
const lcg = () => { seedv = (Math.imul(seedv, 1664525) + 1013904223) >>> 0; return seedv / 4294967296; };
const BLOTS = Array.from({ length: 16 }, () => [lcg() * W, lcg() * H, 90 + lcg() * 190, 0.025 + lcg() * 0.05]);
const SPECKS = Array.from({ length: 420 }, () => [lcg() * W, lcg() * H, 0.6 + lcg() * 1.5, 0.05 + lcg() * 0.16]);
const SCRATCH = Array.from({ length: 14 }, () => [lcg() * W, lcg() * H, (lcg() - 0.5) * 80, (lcg() - 0.5) * 40, 0.03 + lcg() * 0.04]);

// A worn stone / clay floor: mottled patches, grain and a few scratches. Fixed (it never moves); only a very slow warm light breathes.
export function floor(ctx, th, t, glowY = 760) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, a] of BLOTS) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${th.blot},${a})`); rg.addColorStop(1, `rgba(${th.blot},0)`);
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const [x, y, s, a] of SPECKS) { ctx.fillStyle = `rgba(${th.speck},${a})`; ctx.fillRect(x, y, s, s); }
  ctx.lineWidth = 1;
  for (const [x, y, dx, dy, a] of SCRATCH) { ctx.strokeStyle = `rgba(${th.speck},${a})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke(); }
  const breathe = 0.85 + 0.15 * Math.sin(t * 0.35);
  const hg = ctx.createRadialGradient(W / 2, glowY, 40, W / 2, glowY, 700);
  hg.addColorStop(0, th.glow.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * breathe})`)); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
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
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, size * 0.62, kind === 'primary' ? alpha(th.primaryInk, 0.78) : 'rgba(244,239,228,0.72)', { weight: 500 }); ty += size * 0.78; }
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
  } else if (name === 'clear') { // a sweep: a brush
    ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.65); ctx.lineTo(r * 0.7, r * 0.65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.25); ctx.lineTo(r * 0.5, r * 0.25); ctx.moveTo(-r * 0.3, -r * 0.15); ctx.lineTo(r * 0.3, -r * 0.15); ctx.moveTo(-r * 0.1, -r * 0.55); ctx.lineTo(r * 0.1, -r * 0.55); ctx.stroke();
  } else if (name === 'pause') {
    ctx.fillRect(-r * 0.5, -r * 0.62, r * 0.36, r * 1.24); ctx.fillRect(r * 0.14, -r * 0.62, r * 0.36, r * 1.24);
  } else if (name === 'play') {
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.65); ctx.lineTo(r * 0.7, 0); ctx.lineTo(-r * 0.4, r * 0.65); ctx.closePath(); ctx.fill();
  } else if (name === 'back') {
    ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.7); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(r * 0.45, r * 0.7); ctx.stroke();
  } else if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.38, Math.PI, 0); ctx.stroke();
    rr(ctx, -r * 0.6, -r * 0.2, r * 1.2, r * 0.95, 5); ctx.fill();
  } else if (name === 'shield') {
    ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(r * 0.7, -r * 0.5); ctx.lineTo(r * 0.6, r * 0.25); ctx.lineTo(0, r * 0.85); ctx.lineTo(-r * 0.6, r * 0.25); ctx.lineTo(-r * 0.7, -r * 0.5); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.lineTo(-r * 0.05, r * 0.28); ctx.lineTo(r * 0.35, -r * 0.2); ctx.stroke();
  } else if (name === 'draw') { // a wavy line
    ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.3); ctx.bezierCurveTo(-r * 0.4, -r * 0.9, 0, r * 0.9, r * 0.8, -r * 0.3); ctx.stroke();
  } else if (name === 'erase') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.2); ctx.lineTo(-r * 0.05, -r * 0.55); ctx.lineTo(r * 0.7, 0); ctx.lineTo(r * 0.15, r * 0.7); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.45); ctx.lineTo(r * 0.45, -r * 0.2); ctx.stroke();
  } else if (name === 'mirror') { // two halves around an axis
    ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.5); ctx.quadraticCurveTo(-r * 0.8, -r * 0.1, -r * 0.2, r * 0.5); ctx.moveTo(r * 0.2, -r * 0.5); ctx.quadraticCurveTo(r * 0.8, -r * 0.1, r * 0.2, r * 0.5); ctx.stroke();
  } else if (name === 'grid') {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(i * r * 0.55, j * r * 0.55, r * 0.14, 0, Math.PI * 2); ctx.fill(); }
  } else if (name === 'weave') { // a small knot
    ctx.beginPath(); ctx.moveTo(-r * 0.7, 0); ctx.bezierCurveTo(-r * 0.3, -r * 1.0, r * 0.3, r * 1.0, r * 0.7, 0); ctx.moveTo(-r * 0.7, 0); ctx.bezierCurveTo(-r * 0.3, r * 1.0, r * 0.3, -r * 1.0, r * 0.7, 0); ctx.stroke();
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
      ctx.strokeStyle = q.color; ctx.lineWidth = q.w ?? 3;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
