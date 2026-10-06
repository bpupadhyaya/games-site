// Drawing helpers: themes, lit bone and glass pieces, the marble board, panels, flat buttons, icons.
// Plain canvas 2D, no images, nothing here changes game state.
import { N, NN, SIDE, isDux, parse } from './rules.js';

// The live canvas size in virtual units (view.js calls setSize each frame; the kit's fluid viewport changes it on rotation).
export let W = 720, H = 1560;
export function setSize(w, h) { W = w; H = h; }
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
// bg: three background stops; slab: marble face (top, bottom); vein / vein2: vein colours; p / d: bone and glass pieces.
export const THEMES = [
  {
    id: 'carrara', name: 'Carrara Marble', kind: 'light',
    bg: ['#10151c', '#222c38', '#0e1217'], glow: 'rgba(255,214,150,0.22)', fleck: '255,236,200',
    slab: ['#f1eee6', '#cfcabd'], tintA: 'rgba(255,255,255,0.0)', tintB: 'rgba(90,86,76,0.10)', edge: '#8d8576', side: '#6d665a',
    vein: 'rgba(96,104,118,0.34)', vein2: 'rgba(150,140,120,0.22)', groove: 'rgba(70,64,54,0.55)', lip: 'rgba(255,255,255,0.8)', band: '#8b7a55',
    p: { base: '#efe4cb', hi: '#fffaf0', lo: '#8f8062', glow: '255,240,200', grain: 'rgba(120,98,60,0.20)' },
    d: { base: '#16232b', hi: '#8cc6d6', lo: '#04080b', glow: '120,200,230', rim: '#5fa6b8' },
    accent: '#e7c06c', ink: '#f6efe0', win: '#ffd877',
    panel: ['rgba(34,42,54,0.97)', 'rgba(18,23,31,0.98)'], stroke: 'rgba(231,192,108,0.55)',
    btn: ['#3b485a', '#2a3544'], btnOn: ['#3f8f78', '#296a58'], primary: ['#efcc7c', '#d4a444'], primaryInk: '#2a2110',
  },
  {
    id: 'nero', name: 'Nero and Gold', kind: 'dark',
    bg: ['#08090c', '#16171d', '#0a0b0f'], glow: 'rgba(255,196,110,0.18)', fleck: '255,220,160',
    slab: ['#3c3c45', '#23232a'], tintA: 'rgba(255,255,255,0.0)', tintB: 'rgba(255,255,255,0.045)', edge: '#0f0f13', side: '#08080b',
    vein: 'rgba(222,184,110,0.2)', vein2: 'rgba(235,235,245,0.08)', groove: 'rgba(0,0,0,0.6)', lip: 'rgba(255,225,160,0.28)', band: '#c9a45a',
    p: { base: '#f0e6cd', hi: '#fffaf0', lo: '#8b7c5d', glow: '255,240,200', grain: 'rgba(120,98,60,0.20)' },
    d: { base: '#2a3a46', hi: '#a8d8e8', lo: '#070d12', glow: '150,215,240', rim: '#86c4d6' },
    accent: '#f0c46a', ink: '#f4ede0', win: '#ffd877',
    panel: ['rgba(34,34,42,0.97)', 'rgba(16,16,21,0.98)'], stroke: 'rgba(240,196,106,0.5)',
    btn: ['#3a3a46', '#292933'], btnOn: ['#3f8f78', '#296a58'], primary: ['#f0c46a', '#cf9a3a'], primaryInk: '#2a1c08',
  },
  {
    id: 'porphyry', name: 'Imperial Porphyry', kind: 'warm',
    bg: ['#150a10', '#2c1420', '#12080d'], glow: 'rgba(255,170,150,0.20)', fleck: '255,200,190',
    slab: ['#7a3a4a', '#4e2230'], tintA: 'rgba(255,255,255,0.0)', tintB: 'rgba(0,0,0,0.10)', edge: '#2a1018', side: '#1c0a10',
    vein: 'rgba(255,214,200,0.20)', vein2: 'rgba(40,10,20,0.28)', groove: 'rgba(24,6,12,0.6)', lip: 'rgba(255,200,190,0.30)', band: '#d8b078',
    p: { base: '#f1e7cf', hi: '#fffaf0', lo: '#8f8062', glow: '255,240,200', grain: 'rgba(120,98,60,0.20)' },
    d: { base: '#14202a', hi: '#8cc6d6', lo: '#03070a', glow: '120,200,230', rim: '#5fa6b8' },
    accent: '#f0c48a', ink: '#f8ece4', win: '#ffd9a0',
    panel: ['rgba(70,28,42,0.97)', 'rgba(34,12,20,0.98)'], stroke: 'rgba(240,196,138,0.5)',
    btn: ['#6a3040', '#4a202c'], btnOn: ['#3f8f78', '#296a58'], primary: ['#f0c48a', '#d49a52'], primaryInk: '#2a1208',
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
const FLECKS = Array.from({ length: 30 }, (_, i) => [((i * 97) % 211) / 211, ((i * 53) % 173) / 173, 0.6 + ((i * 31) % 7) / 7, ((i * 13) % 11) / 11]);

// A soft backdrop: deep colour, a warm glow behind the board, slow dust motes and (on the menu) the faint outline of an arch.
export function background(ctx, th, t, glowY = 700, arches = false, glowX = W / 2) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const hg = ctx.createRadialGradient(glowX, glowY, 40, glowX, glowY, 680);
  hg.addColorStop(0, th.glow); hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  if (arches) {
    // a colonnade of arches, very faint, behind the board
    ctx.save();
    ctx.strokeStyle = 'rgba(255,236,200,0.07)'; ctx.lineWidth = 3;
    for (let k = 0; k < Math.ceil(W / 200) + 1; k++) {
      const x0 = -40 + k * 200, w = 160, top = H - 480;
      ctx.beginPath(); ctx.moveTo(x0, H); ctx.lineTo(x0, top + w / 2); ctx.arc(x0 + w / 2, top + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x0 + w, H); ctx.stroke();
    }
    ctx.restore();
  }
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

// ---------------------------------------------------------------------------------------------------- the pieces
// An Ivory piece is turned bone: warm, slightly translucent at the rim, with fine growth lines. A Jet piece is smoked glass:
// a dark body, a bright inner rim, a refracted glow low on one side and a hard highlight. Both are lit from the upper left.
// The dux is the same piece, a little larger, with a raised dome ringed by a laurel wreath and a small gold stud.
// o: { scale, alpha, glow (0..1), lift (0..1: raised off the board), ghost, noShadow, rot }
const LEAVES = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);

export function drawPiece(ctx, th, code, cx, cy, d, o = {}) {
  const who = SIDE[code], dux = isDux(code);
  const col = who === 1 ? th.p : th.d;
  const sc = (o.scale ?? 1) * (1 + 0.1 * (o.lift ?? 0)) * (dux ? 1.1 : 1);
  const a = o.alpha ?? 1;
  if (a <= 0.01 || sc <= 0.01) return;
  const R = d / 2;
  const depth = d * (dux ? 0.15 : 0.11) * sc;
  const lift = (o.lift ?? 0) * d * 0.16;
  const y = cy - lift;
  ctx.save();
  ctx.globalAlpha = a * (o.ghost ? 0.45 : 1);
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(cx + d * 0.05, cy + depth + d * 0.1 + lift * 0.4, R * 0.98 * sc * (1 - (o.lift ?? 0) * 0.15), R * 0.42 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.translate(cx, y); ctx.scale(sc, sc); if (o.rot) ctx.rotate(o.rot); ctx.translate(-cx, -y);
  const steps = Math.max(2, Math.round(depth / 1.5));
  const glow = o.glow ? `rgba(${col.glow},${clamp01(o.glow)})` : null;
  // the rim of the piece: stacked discs make its thickness
  for (let k = steps; k >= 1; k--) {
    ctx.fillStyle = k === steps ? dark(col.lo, 0.3) : col.lo;
    ctx.beginPath(); ctx.arc(cx, y + (depth * k) / steps, R, 0, Math.PI * 2); ctx.fill();
  }
  // the top face
  const g = ctx.createRadialGradient(cx - R * 0.38, y - R * 0.42, R * 0.08, cx, y, R * 1.08);
  if (who === 1) { g.addColorStop(0, col.hi); g.addColorStop(0.4, col.base); g.addColorStop(1, mix(col.base, col.lo, 0.7)); }
  else { g.addColorStop(0, mix(col.base, col.hi, 0.28)); g.addColorStop(0.5, col.base); g.addColorStop(1, col.lo); }
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 24; }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  if (who === 1) {
    // bone: faint growth rings and a soft lathe groove
    ctx.strokeStyle = col.grain; ctx.lineWidth = d * 0.012;
    for (const k of [0.82, 0.66]) { ctx.beginPath(); ctx.arc(cx + R * 0.03, y + R * 0.02, R * k, Math.PI * 0.15, Math.PI * 1.55); ctx.stroke(); }
    ctx.strokeStyle = alpha(col.lo, 0.55); ctx.lineWidth = d * 0.02; ctx.beginPath(); ctx.arc(cx, y, R - d * 0.012, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = d * 0.018; ctx.beginPath(); ctx.arc(cx, y, R * 0.8, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
  } else {
    // glass: bright inner rim, a refracted glow low right, a hard highlight
    ctx.strokeStyle = alpha(col.rim, 0.85); ctx.lineWidth = d * 0.028; ctx.beginPath(); ctx.arc(cx, y, R - d * 0.02, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = alpha(col.rim, 0.28); ctx.lineWidth = d * 0.05; ctx.beginPath(); ctx.arc(cx, y, R * 0.78, 0.15, Math.PI * 0.75); ctx.stroke();
    const cg = ctx.createRadialGradient(cx + R * 0.45, y + R * 0.5, 1, cx + R * 0.45, y + R * 0.5, R * 0.55);
    cg.addColorStop(0, alpha(col.rim, 0.55)); cg.addColorStop(1, alpha(col.rim, 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, y, R * 0.96, 0, Math.PI * 2); ctx.fill();
  }
  if (dux) {
    // the raised dome, the wreath and the stud
    const r2 = R * 0.62;
    const dg = ctx.createRadialGradient(cx - r2 * 0.35, y - r2 * 0.4, r2 * 0.1, cx, y, r2 * 1.1);
    if (who === 1) { dg.addColorStop(0, col.hi); dg.addColorStop(1, mix(col.base, col.lo, 0.45)); } else { dg.addColorStop(0, mix(col.base, col.hi, 0.35)); dg.addColorStop(1, col.lo); }
    ctx.fillStyle = who === 1 ? alpha(col.lo, 0.5) : 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(cx, y + d * 0.025, r2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, y, r2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = who === 1 ? alpha(col.lo, 0.5) : alpha(col.rim, 0.7); ctx.lineWidth = d * 0.014; ctx.beginPath(); ctx.arc(cx, y, r2, 0, Math.PI * 2); ctx.stroke();
    const gold = '#e2b457';
    ctx.fillStyle = gold;
    for (const ang of LEAVES) {
      ctx.save(); ctx.translate(cx + Math.cos(ang) * R * 0.82, y + Math.sin(ang) * R * 0.82); ctx.rotate(ang + Math.PI / 2 + 0.35);
      ctx.beginPath(); ctx.ellipse(0, 0, d * 0.045, d * 0.02, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const sg = ctx.createRadialGradient(cx - d * 0.03, y - d * 0.03, 1, cx, y, d * 0.1);
    sg.addColorStop(0, '#fff3c0'); sg.addColorStop(1, '#c48a2a');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, y, d * 0.085, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = d * 0.012; ctx.stroke();
  }
  // the highlight
  ctx.fillStyle = who === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - R * 0.4, y - R * 0.46, R * 0.26, R * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
  if (who === 2) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(cx - R * 0.55, y - R * 0.3, R * 0.05, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------- the board
// `flip` turns the board half a circle (Jet at the bottom). It is chosen once at the start of a game and never animated.
export function boardGeo(x, y, side, flip = false) {
  const m = side * 0.075;
  const cell = (side - 2 * m) / N;
  const centers = [];
  for (let i = 0; i < NN; i++) { const k = flip ? NN - 1 - i : i; centers.push([x + m + cell * ((k % N) + 0.5), y + m + cell * (Math.floor(k / N) + 0.5)]); }
  return { x, y, side, m, cell, n: N, centers, d: cell * 0.8, flip };
}

// Marble veins: long soft curves, deterministic.
const VEINS = Array.from({ length: 11 }, (_, i) => ({
  x0: ((i * 53) % 101) / 101, y0: ((i * 29) % 83) / 83, a: -0.5 + ((i * 17) % 13) / 13, w: 0.5 + ((i * 7) % 5) / 5, len: 0.45 + ((i * 11) % 7) / 14, bend: ((i * 19) % 9) / 9 - 0.5,
}));
const SPECK = Array.from({ length: 90 }, (_, i) => [((i * 61) % 97) / 97, ((i * 29) % 89) / 89, 0.5 + ((i * 17) % 5) / 6]);

export function drawSlab(ctx, th, x, y, side, o = {}) {
  const r = side * 0.04, thick = o.thick ?? side * 0.04;
  ctx.save();
  if (!o.flat) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = side * 0.06; ctx.shadowOffsetY = thick * 1.6; }
  ctx.fillStyle = th.side; rr(ctx, x, y + thick, side, side, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(x, y, x + side * 0.4, y + side);
  g.addColorStop(0, th.slab[0]); g.addColorStop(1, th.slab[1]);
  ctx.fillStyle = g; rr(ctx, x, y, side, side, r); ctx.fill();
  ctx.save();
  rr(ctx, x, y, side, side, r); ctx.clip();
  // veins: a bold stroke with a fine companion
  ctx.lineCap = 'round';
  for (const v of VEINS) {
    const sx = x + v.x0 * side, sy = y + v.y0 * side, L = side * v.len;
    const ex = sx + Math.cos(v.a) * L, ey = sy + Math.sin(v.a) * L;
    const mx = (sx + ex) / 2 - Math.sin(v.a) * L * v.bend, my = (sy + ey) / 2 + Math.cos(v.a) * L * v.bend;
    ctx.strokeStyle = th.vein; ctx.lineWidth = Math.max(0.8, side * 0.0035 * v.w * 2);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.strokeStyle = th.vein2; ctx.lineWidth = Math.max(0.6, side * 0.0015);
    ctx.beginPath(); ctx.moveTo(sx + 4, sy + 6); ctx.quadraticCurveTo(mx + 7, my - 5, ex + 3, ey + 8); ctx.stroke();
  }
  ctx.fillStyle = th.kind === 'light' ? 'rgba(120,110,95,0.18)' : 'rgba(255,255,255,0.07)';
  for (const [gx, gy, gs] of SPECK) ctx.fillRect(x + gx * side, y + gy * side, 1.5 * gs, 1.5 * gs);
  if (side >= 300 && o.border !== false) meanderBand(ctx, th, x, y, side, side * 0.075);
  const bg = ctx.createLinearGradient(0, y, 0, y + side);
  bg.addColorStop(0, 'rgba(255,255,255,0.28)'); bg.addColorStop(0.1, 'rgba(255,255,255,0)'); bg.addColorStop(0.9, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = bg; ctx.fillRect(x, y, side, side);
  ctx.restore();
  ctx.strokeStyle = th.edge; ctx.lineWidth = 2; rr(ctx, x, y, side, side, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; rr(ctx, x + 3, y + 3, side - 6, side - 6, r - 2); ctx.stroke();
  ctx.restore();
}

// A band of key-pattern ornament (a Greek-key meander) inlaid around the playing field.
function meanderBand(ctx, th, x, y, side, m) {
  const u = Math.max(2.5, m * 0.1), inset = m * 0.08;
  ctx.save();
  ctx.strokeStyle = th.band; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1.2, u * 0.34); ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  const edge = (x0, y0, dx, dy) => {
    const len = side - inset * 2;
    const period = u * 5, n = Math.floor(len / period), start = (len - n * period) / 2;
    const P = (s, t) => [x0 + dx * s - dy * t, y0 + dy * s + dx * t];
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s0 = start + i * period;
      const pts = [[0, 4], [0, 0], [4, 0], [4, 3], [1, 3], [1, 2], [3, 2]];
      pts.forEach(([a, b], k) => { const [px, py] = P(s0 + a * u, b * u); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      let [px, py] = P(s0 + 4 * u, 4 * u); ctx.moveTo(px, py); [px, py] = P(s0 + 5 * u, 4 * u); ctx.lineTo(px, py);
    }
    ctx.stroke();
  };
  edge(x + inset, y + inset, 1, 0);
  edge(x + side - inset, y + inset, 0, 1);
  edge(x + side - inset, y + side - inset, -1, 0);
  edge(x + inset, y + side - inset, 0, -1);
  ctx.restore();
}

// The playing field: 64 engraved squares in two tints, a fine groove between them, a raised inner frame.
export function drawField(ctx, th, geo) {
  const { cell, centers, m, x, y, side } = geo;
  const fx = x + m, fy = y + m, fs = cell * N;
  ctx.save();
  // inner frame
  ctx.fillStyle = th.lip; rr(ctx, fx - 3, fy - 1.5, fs + 6, fs + 6, 4); ctx.fill();
  ctx.fillStyle = th.groove; rr(ctx, fx - 3, fy - 3, fs + 6, fs + 6, 4); ctx.fill();
  const g = ctx.createLinearGradient(fx, fy, fx + fs * 0.4, fy + fs);
  g.addColorStop(0, th.slab[0]); g.addColorStop(1, th.slab[1]);
  ctx.fillStyle = g; ctx.fillRect(fx, fy, fs, fs);
  for (let i = 0; i < NN; i++) {
    const r = Math.floor(i / N), c = i % N, [cx, cy] = centers[i];
    ctx.fillStyle = (r + c) % 2 ? th.tintB : th.tintA;
    ctx.fillRect(cx - cell / 2, cy - cell / 2, cell, cell);
  }
  // veins continue faintly across the field
  ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fs, fs); ctx.clip(); ctx.lineCap = 'round';
  for (const v of VEINS) {
    const sx = x + v.x0 * side, sy = y + v.y0 * side, L = side * v.len;
    const ex = sx + Math.cos(v.a) * L, ey = sy + Math.sin(v.a) * L;
    ctx.strokeStyle = th.vein; ctx.lineWidth = Math.max(0.8, side * 0.003 * v.w);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2 - Math.sin(v.a) * L * v.bend, (sy + ey) / 2 + Math.cos(v.a) * L * v.bend, ex, ey); ctx.stroke();
  }
  ctx.restore();
  // engraved grid
  ctx.strokeStyle = th.groove; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let k = 0; k <= N; k++) { ctx.moveTo(fx + k * cell, fy); ctx.lineTo(fx + k * cell, fy + fs); ctx.moveTo(fx, fy + k * cell); ctx.lineTo(fx + fs, fy + k * cell); }
  ctx.stroke();
  ctx.strokeStyle = th.lip; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k < N; k++) { ctx.moveTo(fx + k * cell + 1.5, fy); ctx.lineTo(fx + k * cell + 1.5, fy + fs); ctx.moveTo(fx, fy + k * cell + 1.5); ctx.lineTo(fx + fs, fy + k * cell + 1.5); }
  ctx.stroke();
  if (side >= 300) {
    // file letters below the field, rank numbers to its left: the Think advice names squares this way
    const fsz = Math.max(11, Math.min(20, m * 0.32));
    ctx.fillStyle = th.band; ctx.globalAlpha = 0.9; ctx.font = `700 ${fsz}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < N; k++) {
      const file = geo.flip ? 'hgfedcba'[k] : 'abcdefgh'[k], rank = geo.flip ? k + 1 : N - k;
      ctx.fillText(file, fx + (k + 0.5) * cell, fy + fs + m * 0.3);
      ctx.fillText(String(rank), fx - m * 0.3, fy + (k + 0.5) * cell);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Whole board with pieces, for small illustrations. cells: string of ./X/x/O/o (64 chars) or an array.
// o: { hl: [i], dots: [i], arrows: [[from, to]], marks: [i] (red X on pieces about to be taken), ring: [i] }
export function drawMiniBoard(ctx, th, x, y, side, cells, o = {}) {
  const geo = boardGeo(x, y, side);
  drawSlab(ctx, th, x, y, side, { flat: true, thick: side * 0.03, border: side >= 260 });
  drawField(ctx, th, geo);
  const arr = typeof cells === 'string' ? parse(cells).cells : cells;
  for (const i of o.hl ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.3); ctx.fillRect(cx - geo.cell / 2, cy - geo.cell / 2, geo.cell, geo.cell);
    ctx.strokeStyle = th.accent; ctx.lineWidth = Math.max(1.5, side * 0.008); ctx.setLineDash([6, 4]); ctx.strokeRect(cx - geo.cell / 2 + 2, cy - geo.cell / 2 + 2, geo.cell - 4, geo.cell - 4); ctx.restore();
  }
  for (const i of o.dots ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.fillStyle = alpha(th.accent, 0.95); ctx.beginPath(); ctx.arc(cx, cy, geo.cell * 0.11, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  arr.forEach((v, i) => { if (v) { const [cx, cy] = geo.centers[i]; drawPiece(ctx, th, v, cx, cy, geo.d, { noShadow: side < 200 }); } });
  for (const i of o.ring ?? []) {
    const [cx, cy] = geo.centers[i];
    ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = Math.max(2, side * 0.008); ctx.beginPath(); ctx.arc(cx, cy, geo.d * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  for (const i of o.marks ?? []) { const [cx, cy] = geo.centers[i]; drawCross(ctx, cx, cy, geo.cell * 0.2); }
  for (const [a, b] of o.arrows ?? []) arrowBetween(ctx, th.accent, geo.centers[a], geo.centers[b], geo.cell * 0.34, Math.max(3, side * 0.014));
  return geo;
}

export function drawCross(ctx, cx, cy, r, color = '#ff6a54') {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, r * 0.34); ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
  ctx.restore();
}

function arrowBetween(ctx, color, p0, p1, pad, lw = 6) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  arrow(ctx, color, p0[0] + ux * pad, p0[1] + uy * pad, p1[0] - ux * pad, p1[1] - uy * pad, lw);
}
export function arrow(ctx, color, x0, y0, x1, y1, lw = 6) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), hs = Math.max(10, lw * 3.2);
  ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * lw, y1 + Math.sin(a) * lw);
  ctx.lineTo(x1 - Math.cos(a - 0.5) * hs, y1 - Math.sin(a - 0.5) * hs);
  ctx.lineTo(x1 - Math.cos(a + 0.5) * hs, y1 - Math.sin(a + 0.5) * hs);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
