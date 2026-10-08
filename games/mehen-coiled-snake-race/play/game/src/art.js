// Drawing helpers: themes, text and flat buttons, icons, the carved lions, glass marbles, throwing sticks, the board.
// Plain canvas 2D. Nothing here changes game state. The big relief texture of the board is baked in bake.js.
import { TRACK, isSafe } from './rules.js';
import { trackGeo, pathBetween, SPIRAL } from './geo.js';

export let W = 720, H = 1560;
export function setSize(w, h) { W = w; H = h; }
export const UI = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Palatino Linotype", Palatino, "Iowan Old Style", "Book Antiqua", Georgia, "Times New Roman", serif';

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
export const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------------------------------------------- themes
// stone: which baked board (bake.js). Everything else colours the menus and panels around it.
export const THEMES = [
  {
    id: 'sandstone', name: 'Sandstone', stone: 'sandstone',
    bg: ['#1a120b', '#33231a', '#150e09'], glow: 'rgba(255,196,110,0.26)', fleck: '255,222,160',
    accent: '#f1c45a', ink: '#f7ecd6', win: '#ffd877', shadow: '#2a1a0e', edge: '#6e4f30', side: '#4f361f',
    panel: ['rgba(58,40,26,0.97)', 'rgba(30,20,13,0.98)'], stroke: 'rgba(241,196,90,0.55)',
    btn: ['#5a4129', '#42301e'], btnOn: ['#3e8f76', '#2a6a56'], primary: ['#f4cd6b', '#d7a23b'], primaryInk: '#2e1f08',
  },
  {
    id: 'basalt', name: 'Basalt and Gold', stone: 'basalt',
    bg: ['#08090c', '#16171d', '#0a0b0f'], glow: 'rgba(255,196,110,0.2)', fleck: '255,224,170',
    accent: '#efc15f', ink: '#f4ede0', win: '#ffd877', shadow: '#050507', edge: '#2a2b33', side: '#121318',
    panel: ['rgba(34,34,42,0.97)', 'rgba(16,16,21,0.98)'], stroke: 'rgba(239,193,95,0.5)',
    btn: ['#3a3a46', '#292933'], btnOn: ['#3f8f78', '#296a58'], primary: ['#f0c46a', '#cf9a3a'], primaryInk: '#2a1c08',
  },
  {
    id: 'lapis', name: 'Lapis Night', stone: 'lapis',
    bg: ['#070b1c', '#12204a', '#060a18'], glow: 'rgba(150,190,255,0.22)', fleck: '200,222,255',
    accent: '#f3cc72', ink: '#eef2ff', win: '#ffe08a', shadow: '#03060f', edge: '#1d3170', side: '#0f1c46',
    panel: ['rgba(26,40,86,0.97)', 'rgba(12,20,48,0.98)'], stroke: 'rgba(243,204,114,0.5)',
    btn: ['#2e4482', '#213366'], btnOn: ['#3f8f78', '#296a58'], primary: ['#f3cc72', '#d4a844'], primaryInk: '#241a06',
  },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

// the six lion colours (pigments of the period): lapis, carnelian, turquoise, ochre, alabaster, amethyst
export const PALETTE = [
  { id: 'lapis', base: '#2f5fc9', hi: '#9fc0ff', lo: '#10285e', mane: '#1a3f93', glow: '130,175,255', ink: '#ffffff' },
  { id: 'carnelian', base: '#cc4a2e', hi: '#ffab8a', lo: '#5e1608', mane: '#912a15', glow: '255,150,110', ink: '#ffffff' },
  { id: 'turquoise', base: '#1fae9d', hi: '#9ff3e4', lo: '#07463f', mane: '#117c70', glow: '120,240,220', ink: '#04201c' },
  { id: 'ochre', base: '#e3ac33', hi: '#fff0a8', lo: '#6d4708', mane: '#b07c14', glow: '255,225,120', ink: '#2a1a02' },
  { id: 'alabaster', base: '#ebe4cf', hi: '#ffffff', lo: '#8a8064', mane: '#c4b998', glow: '255,250,225', ink: '#2a2418' },
  { id: 'amethyst', base: '#7d55b0', hi: '#d5b6ff', lo: '#2c1649', mane: '#55337f', glow: '200,160',  ink: '#ffffff' },
];
PALETTE[5].glow = '210,170,255';

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
const FLECKS = Array.from({ length: 34 }, (_, i) => [((i * 97) % 211) / 211, ((i * 53) % 173) / 173, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

// Deep stone colour, a warm torch glow behind the board, courses of masonry (very faint), drifting dust, a vignette.
export function background(ctx, th, t, glowY = 700, courses = false, glowX = W / 2) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (courses) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,180,0.05)'; ctx.lineWidth = 2;
    const ch = 118;
    for (let r = 0, y = 0; y < H + ch; r++, y += ch) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      const off = r % 2 ? 150 : 0;
      for (let x = -off; x < W + 300; x += 300) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + ch); ctx.stroke(); }
    }
    ctx.restore();
  }
  const hg = ctx.createRadialGradient(glowX, glowY, 40, glowX, glowY, Math.max(W, H) * 0.62);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  for (const [fx, fy, s, ph] of FLECKS) {
    const xx = (fx * W + t * (4 + s * 3)) % W, yy = (fy * H - t * (2 + s * 2) + H * 4) % H;
    const a = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph * 9));
    ctx.fillStyle = `rgba(${th.fleck},${a})`;
    ctx.fillRect(xx, yy, 2 * s, 2 * s);
  }
  const vr = Math.max(W, H) * 0.65, vg = ctx.createRadialGradient(W / 2, H / 2, vr * 0.55, W / 2, H / 2, vr);
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
  // a brand-gradient hairline on the top edge (indigo to blue to teal): discreet, never recolours the panel
  const hg = ctx.createLinearGradient(x + 20, 0, x + w - 20, 0);
  hg.addColorStop(0, 'rgba(99,102,241,0)'); hg.addColorStop(0.25, 'rgba(99,102,241,0.7)'); hg.addColorStop(0.6, 'rgba(59,130,246,0.7)'); hg.addColorStop(0.85, 'rgba(45,212,191,0.7)'); hg.addColorStop(1, 'rgba(45,212,191,0)');
  ctx.fillStyle = hg; ctx.fillRect(x + 20, y + 1.5, w - 40, 2);
}

// Flat buttons: one solid fill, a hairline border, a darker underside strip when at rest. No gloss shape.
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

// ---------------------------------------------------------------------------------------------------- icons (centred at x,y, size s)
export function icon(ctx, name, x, y, s, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  if (name === 'hint') {
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
  } else if (name === 'throw') {
    // two sticks crossing
    ctx.lineWidth = Math.max(3, s * 0.15);
    ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.55); ctx.lineTo(r * 0.55, -r * 0.7); ctx.moveTo(-r * 0.2, r * 0.75); ctx.lineTo(r * 0.75, -r * 0.1); ctx.stroke();
  } else if (name === 'skip') {
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.6); ctx.lineTo(r * 0.3, 0); ctx.lineTo(-r * 0.5, r * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillRect(r * 0.42, -r * 0.6, r * 0.2, r * 1.2);
  } else if (name === 'marble') {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 0.95);
    g.addColorStop(0, '#fff'); g.addColorStop(0.45, color); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
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
    } else if (q.shape === 'glint') {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot ?? 0);
      const s = q.size * (0.5 + 0.5 * a);
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.18, -s * 0.18); ctx.lineTo(s, 0); ctx.lineTo(s * 0.18, s * 0.18); ctx.lineTo(0, s); ctx.lineTo(-s * 0.18, s * 0.18); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.18, -s * 0.18); ctx.closePath(); ctx.fill();
      ctx.restore();
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

// ---------------------------------------------------------------------------------------------------- the lion
// A carved lion lying with its head up, seen from the side and slightly above. Lit from the upper left. s = body length in canvas
// units. o: { face (1 right, -1 left), lift (0..1 raised off the stone), glow (0..1), alpha, scale, shadow (false hides it), dim }
export function drawLion(ctx, x, y, s, pal, o = {}) {
  const sc = (o.scale ?? 1) * (1 + 0.1 * (o.lift ?? 0));
  const a = (o.alpha ?? 1) * (o.dim ? 0.55 : 1);
  if (a <= 0.01 || sc <= 0.01) return;
  const face = o.face ?? 1, lift = (o.lift ?? 0) * s * 0.28;
  ctx.save();
  ctx.globalAlpha = a;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath(); ctx.ellipse(x + s * 0.04, y + s * 0.2, s * 0.46 * sc * (1 - (o.lift ?? 0) * 0.15), s * 0.14 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.translate(x, y - lift - s * 0.04); ctx.scale(face * sc, sc);
  if (o.glow) {
    const gl = ctx.createRadialGradient(0, -s * 0.05, s * 0.05, 0, -s * 0.05, s * 0.75);
    gl.addColorStop(0, `rgba(${pal.glow},${0.55 * clamp01(o.glow)})`); gl.addColorStop(1, `rgba(${pal.glow},0)`);
    ctx.fillStyle = gl; ctx.fillRect(-s, -s, s * 2, s * 2);
  }
  const u = s; // unit
  const body = (cx, cy, rx, ry) => {
    const g = ctx.createRadialGradient(cx - rx * 0.35 * face, cy - ry * 0.55, ry * 0.1, cx, cy, Math.max(rx, ry) * 1.1);
    g.addColorStop(0, pal.hi); g.addColorStop(0.45, pal.base); g.addColorStop(1, pal.lo);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  // tail
  ctx.strokeStyle = pal.lo; ctx.lineWidth = u * 0.055; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-u * 0.36, u * 0.0); ctx.bezierCurveTo(-u * 0.56, -u * 0.02, -u * 0.55, -u * 0.26, -u * 0.4, -u * 0.27); ctx.stroke();
  ctx.fillStyle = pal.mane; ctx.beginPath(); ctx.ellipse(-u * 0.39, -u * 0.27, u * 0.05, u * 0.065, 0.4, 0, Math.PI * 2); ctx.fill();
  // back legs and haunch, body, front legs
  body(-u * 0.22, u * 0.06, u * 0.2, u * 0.17);
  body(-u * 0.04, u * 0.02, u * 0.34, u * 0.19);
  const leg = (lx, ly, w, h) => {
    const g = ctx.createLinearGradient(lx, 0, lx + w, 0);
    g.addColorStop(0, pal.base); g.addColorStop(1, pal.lo);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(lx, ly, w, h, w * 0.45); ctx.fill();
  };
  leg(u * 0.2, u * 0.02, u * 0.13, u * 0.2);
  leg(u * 0.17, u * 0.17, u * 0.3, u * 0.075);       // paws stretched forward
  ctx.fillStyle = pal.lo; for (const px of [0.33, 0.39, 0.44]) { ctx.beginPath(); ctx.arc(u * px, u * 0.205, u * 0.008, 0, Math.PI * 2); ctx.fill(); }
  leg(-u * 0.34, u * 0.14, u * 0.24, u * 0.085);
  // mane: a ring of curled locks behind the face
  const mx = u * 0.26, my = -u * 0.12;
  for (let i = 0; i < 14; i++) {
    const an = (i / 14) * Math.PI * 2, rr0 = u * 0.19;
    const px = mx + Math.cos(an) * rr0, py = my + Math.sin(an) * rr0 * 1.02;
    ctx.fillStyle = i % 2 ? pal.mane : pal.lo;
    ctx.beginPath(); ctx.ellipse(px, py, u * 0.07, u * 0.05, an, 0, Math.PI * 2); ctx.fill();
  }
  const mg = ctx.createRadialGradient(mx - u * 0.06, my - u * 0.07, u * 0.02, mx, my, u * 0.2);
  mg.addColorStop(0, pal.hi); mg.addColorStop(0.35, pal.mane); mg.addColorStop(1, pal.lo);
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, u * 0.16, 0, Math.PI * 2); ctx.fill();
  // face
  const hg = ctx.createRadialGradient(mx + u * 0.04 - u * 0.04, my - u * 0.07, u * 0.01, mx + u * 0.05, my, u * 0.13);
  hg.addColorStop(0, pal.hi); hg.addColorStop(0.5, pal.base); hg.addColorStop(1, pal.lo);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(mx + u * 0.05, my + u * 0.01, u * 0.115, u * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(mx + u * 0.15, my + u * 0.05, u * 0.065, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();   // muzzle
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.ellipse(mx + u * 0.205, my + u * 0.03, u * 0.018, u * 0.013, 0, 0, Math.PI * 2); ctx.fill();   // nose
  ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.ellipse(mx + u * 0.085, my - u * 0.02, u * 0.017, u * 0.012, 0, 0, Math.PI * 2); ctx.fill();   // eye
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(mx + u * 0.09, my - u * 0.025, u * 0.005, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = u * 0.008; ctx.beginPath(); ctx.moveTo(mx + u * 0.2, my + u * 0.05); ctx.quadraticCurveTo(mx + u * 0.15, my + u * 0.09, mx + u * 0.11, my + u * 0.075); ctx.stroke();
  ctx.fillStyle = pal.base; ctx.beginPath(); ctx.arc(mx - u * 0.01, my - u * 0.1, u * 0.032, 0, Math.PI * 2); ctx.fill();   // ear
  // a thin gold collar
  ctx.strokeStyle = 'rgba(255,214,120,0.85)'; ctx.lineWidth = u * 0.016;
  ctx.beginPath(); ctx.arc(mx - u * 0.02, my + u * 0.02, u * 0.115, Math.PI * 0.55, Math.PI * 0.95); ctx.stroke();
  // a specular glint on the back
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-u * 0.12, -u * 0.1, u * 0.1, u * 0.025, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- the marble
// A glass marble with a swirl inside that turns as it rolls (rot in radians). o: { alpha, shadow, lift, scale }
export function drawMarble(ctx, x, y, r, pal, o = {}) {
  const a = o.alpha ?? 1, sc = o.scale ?? 1;
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  const lift = (o.lift ?? 0) * r * 1.2;
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(x + r * 0.15, y + r * 0.78, r * 0.85 * sc, r * 0.33 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
  const cy = y - lift, R = r * sc;
  const g = ctx.createRadialGradient(x - R * 0.35, cy - R * 0.4, R * 0.08, x, cy, R * 1.05);
  g.addColorStop(0, pal.hi); g.addColorStop(0.5, pal.base); g.addColorStop(1, pal.lo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, cy, R * 0.97, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, cy); ctx.rotate(o.rot ?? 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = R * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-R * 0.15, R * 0.1, R * 0.55, Math.PI * 0.1, Math.PI * 0.95); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = R * 0.12;
  ctx.beginPath(); ctx.arc(R * 0.2, -R * 0.1, R * 0.45, Math.PI * 1.1, Math.PI * 1.95); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x - R * 0.36, cy - R * 0.4, R * 0.2, R * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(1, R * 0.06); ctx.beginPath(); ctx.arc(x, cy, R * 0.93, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
// a plain glass marble colour for the bank (white, as in the excavated sets)
export const GLASS = { base: '#e9eef2', hi: '#ffffff', lo: '#7d8c9c' };

// ---------------------------------------------------------------------------------------------------- throwing sticks
// face: true = the flat side shows. lift 0..1 = in the air, ang = rotation. Length len, width wid.
export function drawStick(ctx, x, y, len, wid, ang, flat, o = {}) {
  const lift = (o.lift ?? 0), a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.save(); ctx.translate(x + wid * 0.25, y + wid * 0.45 + lift * len * 0.3); ctx.rotate(ang);
  ctx.beginPath(); ctx.roundRect(-len / 2, -wid / 2, len, wid, wid / 2); ctx.fill(); ctx.restore();
  ctx.translate(x, y - lift * len * 0.35); ctx.rotate(ang);
  const sc = 1 + lift * 0.25; ctx.scale(sc, sc);
  const g = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2);
  if (flat) { g.addColorStop(0, '#fff1cf'); g.addColorStop(0.5, '#ecd29d'); g.addColorStop(1, '#b8945a'); }
  else { g.addColorStop(0, '#9a6a3c'); g.addColorStop(0.45, '#6b4423'); g.addColorStop(1, '#3a2210'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-len / 2, -wid / 2, len, wid, wid / 2); ctx.fill();
  ctx.strokeStyle = flat ? 'rgba(110,70,20,0.55)' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(1, wid * 0.08);
  if (flat) {
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * len * 0.16 - wid * 0.3, -wid * 0.28); ctx.lineTo(i * len * 0.16, 0); ctx.lineTo(i * len * 0.16 - wid * 0.3, wid * 0.28); ctx.stroke(); }
  } else {
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * len * 0.13, -wid * 0.4); ctx.lineTo(i * len * 0.13 + wid * 0.12, wid * 0.4); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,220,170,0.28)'; ctx.beginPath(); ctx.roundRect(-len * 0.42, -wid * 0.32, len * 0.84, wid * 0.14, wid * 0.07); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- the board
// Oriented rounded rectangle around cell c (grow < 1 for a smaller one).
export function cellPath(ctx, g, c, grow = 1) {
  const p = g.cells[c];
  if (c >= TRACK) { ctx.beginPath(); ctx.arc(p.x, p.y, g.head.r * 0.64 * grow, 0, Math.PI * 2); return; }
  if (c <= 0) { ctx.beginPath(); ctx.arc(p.x, p.y, g.cellW * 0.4 * grow, 0, Math.PI * 2); return; }
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
  const w = g.cellL * 0.8 * grow, h = g.cellW * 0.76 * grow;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.22);
  ctx.restore();
}
// strokes/fills with cellPath need the transform baked into the path; build it with explicit points instead:
export function fillCell(ctx, g, c, grow, fill, stroke, lw = 3) {
  const p = g.cells[c];
  ctx.save();
  ctx.translate(p.x, p.y);
  if (c >= TRACK) {
    ctx.beginPath(); ctx.arc(0, 0, g.head.r * 0.64 * grow, 0, Math.PI * 2);
  } else if (c <= 0) {
    ctx.beginPath(); ctx.arc(0, 0, g.cellW * 0.4 * grow, 0, Math.PI * 2);
  } else {
    ctx.rotate(p.ang);
    const w = g.cellL * 0.8 * grow, h = g.cellW * 0.76 * grow;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.22);
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

// The slab: thickness, the baked relief (or a vector fallback), a moving torch glow, and the eyes of the head.
export function drawBoard(ctx, th, g, baked, t) {
  const { x, y, side } = g;
  const rad = side * 0.052, depth = side * 0.035;
  // the slab's thickness and its shadow on the table
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.filter = 'none';
  ctx.beginPath(); ctx.roundRect(x - side * 0.01, y + depth * 0.7, side * 1.02, side * 1.0, rad + 6); ctx.fill();
  const sg = ctx.createLinearGradient(0, y + side * 0.7, 0, y + side + depth);
  sg.addColorStop(0, th.side); sg.addColorStop(1, th.shadow);
  ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(x, y + depth, side, side, rad); ctx.fill();
  ctx.strokeStyle = th.edge; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y + depth, side, side, rad); ctx.stroke();
  ctx.restore();
  if (baked) {
    ctx.drawImage(baked, x, y, side, side);
  } else {
    // fallback: a flat stone with the snake as a thick line and the cells outlined
    ctx.save();
    const st = ctx.createLinearGradient(x, y, x + side, y + side);
    st.addColorStop(0, th.edge); st.addColorStop(1, th.side);
    ctx.fillStyle = st; ctx.beginPath(); ctx.roundRect(x, y, side, side, rad); ctx.fill();
    const pts = pathBetween(g, 0, TRACK, 8);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,230,170,0.35)'; ctx.lineWidth = g.cellW * 1.02;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = g.cellW * 0.8;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    for (let c = 1; c < TRACK; c++) fillCell(ctx, g, c, 0.98, isSafe(c) ? 'rgba(255,214,120,0.18)' : 'rgba(255,255,255,0.05)', 'rgba(255,230,170,0.25)', 1.5);
    ctx.fillStyle = 'rgba(255,230,170,0.3)'; ctx.beginPath(); ctx.arc(g.head.x, g.head.y, g.head.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // the head's eyes: gold set in dark stone
  const hx = g.head.x, hy = g.head.y, hr = g.head.r;
  for (const sgn of [-1, 1]) {
    const ex = hx + sgn * hr * 0.66, ey = hy - hr * 0.42, er = hr * 0.13;
    ctx.fillStyle = 'rgba(10,6,2,0.8)'; ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.35, er * 1.0, sgn * 0.5, 0, Math.PI * 2); ctx.fill();
    const eg = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 1, ex, ey, er);
    eg.addColorStop(0, '#fff2b8'); eg.addColorStop(0.6, '#e8b53e'); eg.addColorStop(1, '#8a5b10');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 0.72, sgn * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#120a02'; ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.28, er * 0.62, sgn * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // a torch-like glow that drifts across the stone
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, side, side, rad); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const gx = x + side * (0.3 + 0.06 * Math.sin(t * 0.5)), gy = y + side * (0.26 + 0.05 * Math.cos(t * 0.37));
  const gl = ctx.createRadialGradient(gx, gy, side * 0.02, gx, gy, side * 0.72);
  const fl = 0.07 + 0.012 * Math.sin(t * 7.3) + 0.01 * Math.sin(t * 3.1);
  gl.addColorStop(0, `rgba(255,205,130,${fl * 2.0})`); gl.addColorStop(0.5, `rgba(255,170,90,${fl * 0.7})`); gl.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, y, side, side);
  ctx.restore();
}

export function arrow(ctx, color, x0, y0, x1, y1, lw = 6) {
  const a = Math.atan2(y1 - y0, x1 - x0), hl = lw * 2.6;
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * hl * 0.6, y1 - Math.sin(a) * hl * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.5) * hl, y1 - Math.sin(a - 0.5) * hl); ctx.lineTo(x1 - Math.cos(a + 0.5) * hl, y1 - Math.sin(a + 0.5) * hl); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// A small diagram of the whole track for the Rules pages: the spiral of cells with resting stones marked, optional lions and
// highlights. opts: { cells: {cell: paletteIndex}, hl: [cells], arrows: [[from, to]], numbers: bool, dots: [cells] }
export function drawMiniTrack(ctx, th, x, y, side, opts = {}) {
  const g = trackGeo(x, y, side);
  ctx.save();
  ctx.fillStyle = alpha(th.edge.length === 7 ? th.edge : '#6e4f30', 0.9); ctx.beginPath(); ctx.roundRect(x, y, side, side, side * 0.06); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; ctx.stroke();
  const pts = pathBetween(g, 0, TRACK, 8);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,230,170,0.22)'; ctx.lineWidth = g.cellW * 1.04;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  for (let c = 1; c <= TRACK; c++) {
    const safe = isSafe(c);
    fillCell(ctx, g, c, 0.96, safe ? 'rgba(244,196,82,0.35)' : 'rgba(0,0,0,0.28)', safe ? 'rgba(244,196,82,0.9)' : 'rgba(255,230,170,0.3)', safe ? 2 : 1.2);
  }
  ctx.fillStyle = 'rgba(244,196,82,0.5)'; ctx.beginPath(); ctx.arc(g.head.x, g.head.y, g.head.r * 0.5, 0, Math.PI * 2); ctx.fill();
  if (opts.numbers) {
    for (let c = 1; c <= TRACK; c++) if (c === 1 || c % 5 === 0) { const p = g.cells[c]; text(ctx, String(c), p.x, p.y + side * 0.012, side * 0.04, '#fff', { weight: 800, shadow: 'rgba(0,0,0,0.8)', blur: 3 }); }
  }
  for (const c of opts.hl ?? []) fillCell(ctx, g, c, 1.02, 'rgba(255,255,255,0.18)', th.accent, 3);
  for (const [a, b] of opts.arrows ?? []) {
    const pa = g.cells[a], pb = g.cells[b];
    const path = pathBetween(g, a, b, 6);
    ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = Math.max(3, side * 0.012); ctx.lineCap = 'round'; ctx.setLineDash([side * 0.02, side * 0.015]);
    ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
    const q = path[path.length - 2] ?? pa;
    arrow(ctx, th.accent, q.x, q.y, pb.x, pb.y, Math.max(3, side * 0.012));
  }
  for (const [c, pi, face] of opts.lions ?? []) {
    const p = g.cells[c];
    drawLion(ctx, p.x, p.y + g.lion * 0.05, g.lion * 1.05, PALETTE[pi], { face: face ?? 1 });
  }
  for (const c of opts.dots ?? []) { const p = g.cells[c]; ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(p.x, p.y, side * 0.014, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  return g;
}
export { SPIRAL };
