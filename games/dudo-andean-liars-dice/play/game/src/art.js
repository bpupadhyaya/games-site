// Drawing helpers: Andean woven themes, carved dice, the leather cup, panels, flat buttons, icons.
// Plain canvas 2D, no images. Nothing here changes game state.
import { scr } from './layout.js';
export const W = 720, H = 1560;   // the phone design canvas; live screen size is `scr` (layout.js)
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
// tex: four textile colours; die: face gradient, pip, ace pip; accent / ink / panel / btn tokens for the flat UI.
export const THEMES = [
  {
    id: 'aguayo', name: 'Aguayo Red', es: 'Aguayo rojo',
    bg: ['#1d0a0d', '#3b1219', '#240a0f'], glow: 'rgba(255,128,70,0.26)', fleck: '255,200,150',
    tex: ['#c8372d', '#f2b84b', '#1f7f86', '#ecdcc0'], mat: ['#4a1a1f', '#2e0e12'],
    die: { a: '#f7eed8', b: '#cdbc95', edge: '#8c7650', pip: '#3a2313', pipHi: 'rgba(255,240,210,0.55)', ace: '#b8321f', ring: '#d8a43c' },
    accent: '#f2b84b', ink: '#f7ecd9', win: '#ffd877',
    panel: ['rgba(60,22,27,0.96)', 'rgba(34,12,16,0.98)'], stroke: 'rgba(242,184,75,0.55)',
    btn: ['#5e2b2e', '#431c1f'], btnOn: ['#1f8189', '#17606a'], primary: ['#f2b84b', '#d4952c'], primaryInk: '#3a1a08',
  },
  {
    id: 'altiplano', name: 'Altiplano Earth', es: 'Altiplano',
    bg: ['#15110b', '#2d2317', '#19130c'], glow: 'rgba(255,190,100,0.22)', fleck: '240,215,160',
    tex: ['#d9822b', '#2a9d8f', '#e9c46a', '#8c3b2a'], mat: ['#43331f', '#2a1f12'],
    die: { a: '#f5ecd5', b: '#cab995', edge: '#85704a', pip: '#33200f', pipHi: 'rgba(255,240,205,0.55)', ace: '#a8341d', ring: '#2a9d8f' },
    accent: '#e9c46a', ink: '#f6ecd6', win: '#ffd877',
    panel: ['rgba(48,36,24,0.96)', 'rgba(28,20,13,0.98)'], stroke: 'rgba(233,196,106,0.55)',
    btn: ['#54402b', '#3b2b1b'], btnOn: ['#2b9488', '#1d6c63'], primary: ['#eccb78', '#d3a447'], primaryInk: '#352208',
  },
  {
    id: 'titicaca', name: 'Lake Blue', es: 'Lago azul',
    bg: ['#06141c', '#0f2f3d', '#07161e'], glow: 'rgba(110,210,240,0.22)', fleck: '170,230,250',
    tex: ['#2a9db8', '#e8d8a0', '#c8503a', '#1b4d5c'], mat: ['#133847', '#0b2330'],
    die: { a: '#5a4030', b: '#2b1a10', edge: '#150b05', pip: '#f4e4c0', pipHi: 'rgba(255,255,255,0.35)', ace: '#ff8d5a', ring: '#9ad9e8' },
    accent: '#9ad9e8', ink: '#eaf6f8', win: '#fff2a0',
    panel: ['rgba(16,46,60,0.96)', 'rgba(8,28,38,0.98)'], stroke: 'rgba(154,217,232,0.5)',
    btn: ['#1f5266', '#163b4b'], btnOn: ['#c8503a', '#93382a'], primary: ['#9ad9e8', '#62b3c9'], primaryInk: '#082330',
  },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// Flat, crisp text. A shadow is only used on large display titles, never on text over lit pieces.
export function text(ctx, str, x, y, size, color = '#fff', o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 6; ctx.shadowOffsetY = o.dy ?? 2; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (o.shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

// ---------------------------------------------------------------------------------------------------- textile
// A band of stepped diamonds, the classic woven motif. Pure geometry from the theme's four colours.
export function weaveBand(ctx, th, x, y, w, h, o = {}) {
  const c = th.tex, cell = h, n = Math.ceil(w / cell) + 1;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = o.base ?? dark(c[3], 0.75); ctx.fillRect(x, y, w, h);
  for (let i = 0; i < n; i++) {
    const cx = x + i * cell + cell / 2 - (o.shift ?? 0) % cell, cy = y + h / 2;
    const col = c[i % 2 ? 0 : 2];
    for (let s = 0; s < 3; s++) {
      const r = (h / 2 - 1) * (1 - s * 0.3);
      ctx.fillStyle = s === 0 ? col : s === 1 ? c[1] : c[3];
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = dark(c[0], 0.5); ctx.fillRect(cx - 2, cy - 2, 4, 4);
  }
  ctx.restore();
}
function stripe(ctx, th, x, y, w, h) {
  ctx.fillStyle = th.tex[1]; ctx.fillRect(x, y, w, h * 0.28);
  ctx.fillStyle = th.tex[0]; ctx.fillRect(x, y + h * 0.28, w, h * 0.44);
  ctx.fillStyle = th.tex[1]; ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
}

// ---------------------------------------------------------------------------------------------------- background
const FLECKS = Array.from({ length: 26 }, (_, i) => [((i * 97) % 211) / 211, ((i * 53) % 173) / 173, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);
export function background(ctx, th, t, glowY = 700, glowX = scr.w / 2) {
  const w = scr.w, h = scr.h;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // woven cloth: faint horizontal threads
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
  const hg = ctx.createRadialGradient(glowX, glowY, 40, glowX, glowY, 660);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
  for (const [fx, fy, s, ph] of FLECKS) {
    const yy = (fy * h + t * (3 + s * 3)) % h;
    const a = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(fx * w, yy, 2.2 * s, 2.2 * s);
  }
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.78, w / 2, h / 2, Math.hypot(w, h) * 0.5 + 120);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.9;
  weaveBand(ctx, th, 0, 0, w, 16, {});
  weaveBand(ctx, th, 0, h - 16, w, 16, {});
  ctx.globalAlpha = 1;
}

// A woven mat with a dark centre so text stays readable: used behind the table.
export function mat(ctx, th, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, th.mat[0]); g.addColorStop(1, th.mat[1]);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 24); ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, x, y, w, h, 24); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < h; i += 6) ctx.fillRect(x, y + i, w, 2);
  weaveBand(ctx, th, x, y, w, 14, {});
  weaveBand(ctx, th, x, y + h - 14, w, 14, { shift: 14 });
  ctx.restore();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 24); ctx.stroke();
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

// ---------------------------------------------------------------------------------------------------- icons
export function icon(ctx, name, x, y, s, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  if (name === 'hint') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.28, r * 0.52); ctx.lineTo(r * 0.28, r * 0.52); ctx.moveTo(-r * 0.2, r * 0.8); ctx.lineTo(r * 0.2, r * 0.8); ctx.stroke();
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

// ---------------------------------------------------------------------------------------------------- dice
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

// A carved die seen from above. size = edge length. o: { angle, scale, alpha, glow (0..1), dim, wildMark (ace shown as wild), lift }
export function drawDie(ctx, th, cx, cy, size, face, o = {}) {
  const d = th.die, s = size * (o.scale ?? 1), r = s * 0.2;
  ctx.save();
  ctx.translate(cx, cy - (o.lift ?? 0) * size * 0.25);
  if (o.angle) ctx.rotate(o.angle);
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) {
    const g = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.05);
    g.addColorStop(0, `rgba(255,214,130,${0.55 * o.glow})`); g.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = g; ctx.fillRect(-s * 1.1, -s * 1.1, s * 2.2, s * 2.2);
  }
  if (!o.noShadow) {
    ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - (o.lift ?? 0) * 0.5)})`;
    rr(ctx, -s / 2 + 2, -s / 2 + s * 0.08 + (o.lift ?? 0) * size * 0.25, s, s, r); ctx.fill();
  }
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, d.a); g.addColorStop(1, d.b);
  ctx.fillStyle = g; rr(ctx, -s / 2, -s / 2, s, s, r); ctx.fill();
  ctx.strokeStyle = d.edge; ctx.lineWidth = Math.max(1.2, s * 0.03); rr(ctx, -s / 2, -s / 2, s, s, r); ctx.stroke();
  // soft top-left light, flat (no extra shape inside the die)
  const lg = ctx.createLinearGradient(-s / 2, -s / 2, 0, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0.28)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; rr(ctx, -s / 2, -s / 2, s, s, r); ctx.fill();
  const pr = s * (face === 1 ? 0.2 : face >= 5 ? 0.09 : 0.105), sp = s * 0.27;
  for (const [px, py] of PIPS[face]) {
    const x = px * sp, y = py * sp;
    if (face === 1) {
      ctx.fillStyle = d.ring; ctx.beginPath(); ctx.arc(x, y, pr * 1.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = d.ace; ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = d.pip; ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = d.pipHi; ctx.lineWidth = Math.max(1, s * 0.016); ctx.beginPath(); ctx.arc(x, y, pr * 0.92, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    }
  }
  if (o.dim) { ctx.fillStyle = `rgba(10,6,6,${o.dim})`; rr(ctx, -s / 2, -s / 2, s, s, r); ctx.fill(); }
  ctx.restore();
}

// A covered die (seen from outside the cup): a small leather-brown block with a woven top.
export function drawBack(ctx, th, cx, cy, size, o = {}) {
  const s = size, r = s * 0.2;
  ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, -s / 2 + 1, -s / 2 + s * 0.08, s, s, r); ctx.fill();
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, '#7c5232'); g.addColorStop(1, '#4a2e18');
  ctx.fillStyle = g; rr(ctx, -s / 2, -s / 2, s, s, r); ctx.fill();
  ctx.save(); rr(ctx, -s / 2, -s / 2, s, s, r); ctx.clip();
  weaveBand(ctx, th, -s / 2, -s * 0.17, s, s * 0.34, {});
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,230,190,0.28)'; ctx.lineWidth = 1.2; rr(ctx, -s / 2, -s / 2, s, s, r); ctx.stroke();
  ctx.restore();
}

// The leather cup (cacho) standing mouth-down. o: { tilt (radians), alpha, lift, shadow }
export function drawCup(ctx, th, cx, cy, w, h, o = {}) {
  ctx.save();
  ctx.translate(cx, cy + (o.lift ? -o.lift : 0));
  if (o.tilt) ctx.rotate(o.tilt);
  ctx.globalAlpha = o.alpha ?? 1;
  const tw = w * 0.74, bw = w;
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(0, h / 2 + 4, bw * 0.55, h * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
  const body = () => { ctx.beginPath(); ctx.moveTo(-tw / 2, -h / 2); ctx.quadraticCurveTo(0, -h / 2 - h * 0.08, tw / 2, -h / 2); ctx.lineTo(bw / 2, h / 2); ctx.lineTo(-bw / 2, h / 2); ctx.closePath(); };
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, '#4e2f19'); g.addColorStop(0.35, '#a06a3d'); g.addColorStop(0.6, '#85532c'); g.addColorStop(1, '#3d2411');
  ctx.fillStyle = g; body(); ctx.fill();
  ctx.save(); body(); ctx.clip();
  const by = -h * 0.06, bh = h * 0.2;
  weaveBand(ctx, th, -bw / 2, by, bw, bh, {});
  ctx.strokeStyle = 'rgba(255,225,170,0.35)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(-bw * 0.46, h * 0.3); ctx.lineTo(bw * 0.46, h * 0.3); ctx.moveTo(-tw * 0.46, -h * 0.34); ctx.lineTo(tw * 0.46, -h * 0.34); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = '#2c1809'; ctx.beginPath(); ctx.ellipse(0, h / 2, bw / 2, h * 0.055, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,170,0.4)'; ctx.lineWidth = 1.5; body(); ctx.stroke();
  ctx.restore();
}

// Tumbling dice faces: a deterministic face for a die at tumble time t (no randomness drawn at render time).
export const tumbleFace = (seed, t) => 1 + ((Math.floor(t * 14) * 7 + seed * 5 + 3) % 6);
