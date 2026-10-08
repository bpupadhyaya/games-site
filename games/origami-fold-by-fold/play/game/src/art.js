// UI drawing helpers: the washi desk, flat clean buttons (no inner gloss), panels, icons, stars, particles. Palette is light and warm:
// linen desk, cream cards, ink text, vermilion and indigo accents.
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Songti SC", Georgia, "Times New Roman", serif';
export const INK = '#2b2530';
export const INK2 = 'rgba(43,37,48,0.72)';
export const INK3 = 'rgba(43,37,48,0.5)';
export const CARD = '#fbf6ea';
export const CARD2 = '#f2e9d4';
export const EDGE = '#d6c6a3';
export const VERM = '#d9482b';
export const VERM_D = '#b5371f';
export const INDIGO = '#27406b';
export const GOLD = '#c79a2e';
export const SAKURA = '#e98fa0';
export const MOSS = '#3a7a58';

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = (t) => 1 - (1 - t) ** 3;
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

export function rr(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y); ctx.lineTo(x + w - k, y); ctx.arcTo(x + w, y, x + w, y + k, k);
  ctx.lineTo(x + w, y + h - k); ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
  ctx.lineTo(x + k, y + h); ctx.arcTo(x, y + h, x, y + h - k, k);
  ctx.lineTo(x, y + k); ctx.arcTo(x, y, x + k, y, k);
  ctx.closePath();
}

export function text(ctx, str, x, y, size, color, o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'alphabetic';
  if (o.shadow) { ctx.save(); ctx.fillStyle = o.shadow; ctx.fillText(str, x, y + (o.sy ?? 2)); ctx.restore(); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

let tile = null, tileTried = false;
function linenTile() {
  if (tileTried) return tile;
  tileTried = true;
  if (typeof OffscreenCanvas === 'undefined') return null;
  const c = new OffscreenCanvas(96, 96), g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 96, 96);
  for (let i = 0; i < 96; i += 3) {
    g.fillStyle = (i / 3) % 2 ? 'rgba(120,90,50,0.045)' : 'rgba(255,250,235,0.05)';
    g.fillRect(i, 0, 1.5, 96); g.fillRect(0, i, 96, 1.5);
  }
  tile = c;
  return tile;
}

// The table: warm linen under window light. `lx, ly` = where the light falls.
export function desk(ctx, w, h, t = 0, lx = 0.3, ly = 0.15) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#efe5cf'); g.addColorStop(1, '#ddd0b3');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const tl = linenTile();
  if (tl) { const p = ctx.createPattern(tl, 'repeat'); if (p) { ctx.fillStyle = p; ctx.fillRect(0, 0, w, h); } }
  const r = Math.max(w, h);
  const lg = ctx.createRadialGradient(w * lx, h * ly, r * 0.05, w * lx, h * ly, r * 0.85);
  lg.addColorStop(0, 'rgba(255,252,240,0.55)'); lg.addColorStop(1, 'rgba(255,252,240,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r * 0.8);
  vg.addColorStop(0, 'rgba(90,60,30,0)'); vg.addColorStop(1, 'rgba(90,60,30,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(70,45,20,0.22)'; ctx.shadowBlur = o.blur ?? 22; ctx.shadowOffsetY = o.dy ?? 8;
  ctx.fillStyle = o.fill ?? CARD; rr(ctx, x, y, w, h, o.r ?? 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = o.edge ?? EDGE; ctx.lineWidth = 2; rr(ctx, x, y, w, h, o.r ?? 26); ctx.stroke();
}

const KINDS = {
  normal: { fill: CARD, edge: EDGE, ink: INK, shade: '#cdbb96' },
  primary: { fill: VERM, edge: VERM_D, ink: '#fff8ee', shade: VERM_D },
  on: { fill: INDIGO, edge: '#1b2d4d', ink: '#f6f1e4', shade: '#1b2d4d' },
  danger: { fill: '#f6e3dc', edge: '#c47a68', ink: '#8e2f1d', shade: '#c47a68' },
  quiet: { fill: 'rgba(251,246,234,0.55)', edge: 'rgba(214,198,163,0.7)', ink: INK, shade: 'rgba(160,140,100,0.5)' },
};

// A flat button: solid fill, 2px edge, a solid drop edge underneath (no gloss shape).
export function button(ctx, r, lines, kind = 'normal', o = {}) {
  const k = KINDS[kind] ?? KINDS.normal;
  const down = o.pressed ? 3 : 0, dis = o.disabled;
  ctx.save();
  if (dis) ctx.globalAlpha = 0.45;
  ctx.shadowColor = 'rgba(70,45,20,0.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4 - down;
  ctx.fillStyle = k.shade; rr(ctx, r.x, r.y + 4 - down, r.w, r.h, o.r ?? 20); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = k.fill; rr(ctx, r.x, r.y + down, r.w, r.h - 4 + (o.pressed ? 1 : 0), o.r ?? 20); ctx.fill();
  ctx.strokeStyle = k.edge; ctx.lineWidth = 2; ctx.stroke();
  const size = o.size ?? 28, line = o.line ?? size * 1.2;
  const L = lines ?? [];
  const sub = o.sub ?? [];
  const subSize = size * 0.62;
  const total = L.length * line + (sub.length ? sub.length * subSize * 1.25 + 4 : 0);
  let ty = r.y + down + (r.h - 4) / 2 - total / 2 + size * 0.86;
  for (const s of L) { text(ctx, s, r.x + r.w / 2, ty, size, k.ink, { weight: 700 }); ty += line; }
  if (sub.length) { ty += 2; for (const s of sub) { text(ctx, s, r.x + r.w / 2, ty - size * 0.1, subSize, kind === 'primary' ? 'rgba(255,248,238,0.85)' : INK2, { weight: 600 }); ty += subSize * 1.25; } }
  ctx.restore();
}

export function star(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.46 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, r * 0.1); ctx.lineJoin = 'round'; ctx.stroke(); }
}

// Line icons on a 100 unit grid scaled to `size`.
export function icon(ctx, name, cx, cy, size, color = INK, lw = 0) {
  const s = size / 100;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = (pts, close) => { ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); if (close) ctx.closePath(); };
  if (name === 'back') { P([[18, -36], [-20, 0], [18, 36]]); ctx.stroke(); }
  else if (name === 'pause') { ctx.fillRect(-26, -32, 18, 64); ctx.fillRect(8, -32, 18, 64); }
  else if (name === 'play') { P([[-20, -34], [30, 0], [-20, 34]], true); ctx.fill(); }
  else if (name === 'hint') {
    ctx.beginPath(); ctx.arc(0, -8, 28, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, 30); ctx.lineTo(14, 30); ctx.moveTo(-10, 42); ctx.lineTo(10, 42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, 22); ctx.lineTo(-8, 10); ctx.lineTo(0, 0); ctx.lineTo(8, 10); ctx.lineTo(8, 22); ctx.lineWidth = 6; ctx.stroke();
  } else if (name === 'undo') {
    ctx.beginPath(); ctx.arc(4, 4, 30, Math.PI * 1.05, Math.PI * 2.25); ctx.stroke();
    P([[-26, -18], [-26, 6], [-2, 0]], true); ctx.fill();
  } else if (name === 'restart') {
    ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI * 0.35, Math.PI * 1.45); ctx.stroke();
    P([[22, -44], [32, -14], [6, -20]], true); ctx.fill();
  } else if (name === 'turn') {
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 38); ctx.lineWidth = 6; ctx.setLineDash([8, 7]); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-34, -6); ctx.quadraticCurveTo(0, -42, 34, -6); ctx.stroke();
    P([[22, -14], [38, -2], [18, 4]], true); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, 12); ctx.quadraticCurveTo(0, 46, -34, 12); ctx.stroke();
    P([[-22, 20], [-38, 8], [-18, 2]], true); ctx.fill();
  } else if (name === 'lock') {
    rr(ctx, -26, -6, 52, 40, 8); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -8, 17, Math.PI, 0); ctx.stroke();
  } else if (name === 'check') { P([[-28, 2], [-8, 24], [30, -22]]); ctx.stroke(); }
  else if (name === 'layers') { P([[0, -30], [36, -10], [0, 10], [-36, -10]], true); ctx.stroke(); P([[-36, 8], [0, 28], [36, 8]]); ctx.stroke(); }
  else if (name === 'studio') { P([[-30, 30], [-30, -20], [20, -30], [30, 20]], true); ctx.stroke(); P([[-30, 30], [30, -20]]); ctx.stroke(); }
  ctx.restore();
}

// ---- particles (paper confetti and dust) ----------------------------------------------------------------------------------------------------
export function addBurst(list, rng, x, y, n, colors, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.dir != null ? o.dir + (rng.next() - 0.5) * (o.spread ?? 1.2) : rng.next() * Math.PI * 2, sp = (o.min ?? 60) + rng.next() * ((o.max ?? 300) - (o.min ?? 60));
    list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0), life: 0, max: (o.life ?? 1) * (0.6 + rng.next() * 0.6), c: colors[rng.int(colors.length)], r: (o.size0 ?? 4) + rng.next() * ((o.size1 ?? 8) - (o.size0 ?? 4)), rot: rng.next() * 6.28, vr: (rng.next() - 0.5) * 12, g: o.g ?? 520, shape: o.shape ?? 'tile' });
  }
}
export function stepParticles(list, dt) {
  for (const p of list) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 0.8); p.rot += p.vr * dt; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  for (const p of list) {
    const k = 1 - p.life / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6 * (0.5 + k * 0.5), 0, 6.2832); ctx.fill(); }
    else { ctx.fillRect(-p.r / 2, -p.r * 0.32, p.r, p.r * 0.64); }
    ctx.restore();
  }
}
