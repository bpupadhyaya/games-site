// Drawing primitives: the felt table, the wooden board (baked once per size), carved holes and the pegs. Pure canvas 2D, no assets.
// The board is lit from the top-left; every material has a base, a light side, a dark side and a specular or grain detail.
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Cormorant Garamond", "Palatino Linotype", Georgia, serif';

export const WOODS = {
  maple: { name: 'Maple', top: '#f0d49c', mid: '#dcae68', dark: '#a8742f', grain: [120, 78, 28], rim: ['#7a4c25', '#4a2a12', '#2c170a'], well: '#3a2410', lip: [255, 238, 196] },
  walnut: { name: 'Walnut', top: '#b88457', mid: '#8f5d38', dark: '#5a3320', grain: [44, 22, 12], rim: ['#4a2a18', '#2e170b', '#180b05'], well: '#1d0f07', lip: [240, 205, 160] },
  rosewood: { name: 'Rosewood', top: '#b4655c', mid: '#8a3d3a', dark: '#52201f', grain: [40, 10, 12], rim: ['#4a1a1a', '#2c0e0e', '#150606'], well: '#1b0707', lip: [245, 190, 180] },
};
export const PEGS = {
  sapphire: { name: 'Sapphire glass', glass: true, light: [190, 225, 255], mid: [52, 112, 232], dark: [10, 28, 112] },
  amber: { name: 'Amber glass', glass: true, light: [255, 238, 170], mid: [236, 150, 28], dark: [128, 56, 6] },
  emerald: { name: 'Emerald glass', glass: true, light: [190, 255, 220], mid: [28, 176, 112], dark: [4, 70, 48] },
  boxwood: { name: 'Boxwood', glass: false, light: [248, 224, 170], mid: [214, 164, 90], dark: [128, 82, 34] },
};
export const WOOD_KEYS = Object.keys(WOODS), PEG_KEYS = Object.keys(PEGS);

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const hasOff = typeof OffscreenCanvas !== 'undefined';

// ---- the felt table --------------------------------------------------------------------------------------------------------
let feltTile = null, feltTried = false;
export function drawTable(ctx, w, h, focus) {
  const cx = focus ? focus.x : w / 2, cy = focus ? focus.y : h / 2, R = Math.hypot(w, h) * 0.62;
  const g = ctx.createRadialGradient(cx, cy, R * 0.04, cx, cy, R);
  g.addColorStop(0, '#2c6a52'); g.addColorStop(0.42, '#17462f'); g.addColorStop(1, '#06160f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (!feltTried) {
    feltTried = true;
    if (hasOff) { try { const c = new OffscreenCanvas(128, 128), t = c.getContext('2d'); for (let i = 0; i < 2600; i++) { const a = hash(i * 3 + 1), b = hash(i * 3 + 2), k = hash(i * 3 + 3); t.fillStyle = k < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'; t.fillRect(Math.floor(a * 128), Math.floor(b * 128), k < 0.1 ? 2 : 1.2, k < 0.1 ? 1 : 1.2); } feltTile = c; } catch { feltTile = null; } }
  }
  if (feltTile) { const p = ctx.createPattern(feltTile, 'repeat'); if (p) { ctx.fillStyle = p; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 0.7; ctx.fillStyle = p; ctx.save(); ctx.translate(37, 53); ctx.scale(1.6, 1.6); ctx.fillRect(-60, -60, w / 1.6 + 120, h / 1.6 + 120); ctx.restore(); ctx.globalAlpha = 1; } }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, R);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// ---- board outline ------------------------------------------------------------------------------------------------------------
// Square-lattice boards are round (the classic turned-wood look); the triangle board is a rounded triangle.
export function boardShape(b, P) {
  if (!b.tri) { let m = 0; for (const p of b.pos) m = Math.max(m, Math.hypot(p.x, p.y)); return { round: true, R: (m + 1.0) * P }; }
  const xs = b.pos.map((p) => p.x), ys = b.pos.map((p) => p.y);
  const top = Math.min(...ys), bot = Math.max(...ys), left = Math.min(...xs), right = Math.max(...xs), pad = 1.0;
  const cx = (left + right) / 2, k = pad * 2.0;                       // push the corners out so the edges stay `pad` from the outer holes
  const pts = [[cx, top - k * 0.9], [right + k * 0.95, bot + pad], [left - k * 0.95, bot + pad]].map(([x, y]) => ({ x: x * P, y: y * P }));
  return { round: false, pts, R: Math.max(...pts.map((p) => Math.abs(p.x)), ...pts.map((p) => Math.abs(p.y))) };
}
function pathShape(ctx, s, inset = 0) {
  ctx.beginPath();
  if (s.round) { ctx.arc(0, 0, s.R - inset, 0, Math.PI * 2); return; }
  const c = { x: s.pts.reduce((a, p) => a + p.x, 0) / 3, y: s.pts.reduce((a, p) => a + p.y, 0) / 3 };
  const q = s.pts.map((p) => { const d = Math.hypot(p.x - c.x, p.y - c.y); return { x: p.x - ((p.x - c.x) / d) * inset * 1.9, y: p.y - ((p.y - c.y) / d) * inset * 1.9 }; });
  const rad = s.R * 0.16;
  ctx.moveTo((q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2);
  for (let i = 1; i <= 3; i++) ctx.arcTo(q[i % 3].x, q[i % 3].y, (q[i % 3].x + q[(i + 1) % 3].x) / 2, (q[i % 3].y + q[(i + 1) % 3].y) / 2, rad);
  ctx.closePath();
}

// A single carved well.
export function drawHole(ctx, x, y, r, wood) {
  const W = WOODS[wood] ?? WOODS.maple;
  let g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.5, 'rgba(0,0,0,0.05)'); g.addColorStop(1, rgba(W.lip, 0.55));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill();
  g = ctx.createRadialGradient(x + r * 0.2, y + r * 0.28, r * 0.05, x, y, r);
  g.addColorStop(0, W.dark); g.addColorStop(0.55, W.well); g.addColorStop(1, '#0d0603');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(x, y, r * 0.96, Math.PI * 0.85, Math.PI * 1.85); ctx.stroke();
  ctx.strokeStyle = rgba(W.lip, 0.5); ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.beginPath(); ctx.arc(x, y, r * 1.03, Math.PI * -0.15, Math.PI * 0.85); ctx.stroke();
}

// The whole board with its holes, in the board's own pixel scale, centred on (0,0).
export function paintBoard(ctx, b, wood, P, detail = 1) {
  const W = WOODS[wood] ?? WOODS.maple, s = boardShape(b, P), R = s.R, seed = wood.length * 97 + b.n;
  // drop shadow
  for (let i = 5; i >= 0; i--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - i) * 0.02})`; ctx.save(); ctx.translate(R * 0.035, R * 0.07); pathShape(ctx, s, -R * 0.012 * i); ctx.fill(); ctx.restore(); }
  // turned rim
  let g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, W.rim[0]); g.addColorStop(0.55, W.rim[1]); g.addColorStop(1, W.rim[2]);
  ctx.fillStyle = g; pathShape(ctx, s); ctx.fill();
  g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, 'rgba(255,235,190,0.55)'); g.addColorStop(0.5, 'rgba(255,235,190,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.lineWidth = R * 0.03; ctx.strokeStyle = g; pathShape(ctx, s, R * 0.015); ctx.stroke();
  // playing surface
  const inset = R * 0.075;
  g = ctx.createLinearGradient(-R * 0.8, -R * 0.9, R * 0.8, R * 0.9);
  g.addColorStop(0, W.top); g.addColorStop(0.5, W.mid); g.addColorStop(1, W.dark);
  ctx.fillStyle = g; pathShape(ctx, s, inset); ctx.fill();
  // grain, clipped to the surface
  ctx.save(); pathShape(ctx, s, inset); ctx.clip();
  const lines = Math.round(90 * detail);
  for (let i = 0; i < lines; i++) {
    const y0 = (hash(seed + i * 7) * 2 - 1) * R * 1.05, amp = hash(seed + i * 11) * R * 0.05, ph = hash(seed + i * 13) * 6.28, a = 0.035 + hash(seed + i * 17) * 0.09;
    ctx.strokeStyle = rgba(W.grain, a); ctx.lineWidth = 0.4 + hash(seed + i * 19) * R * 0.006;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const x = -R * 1.05 + (k / 12) * R * 2.1, yy = y0 + Math.sin(ph + k * 0.7) * amp + (x / R) * R * 0.04; if (k === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
    ctx.stroke();
  }
  const sheen = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.05, -R * 0.1, -R * 0.1, R * 1.15);
  sheen.addColorStop(0, 'rgba(255,248,225,0.30)'); sheen.addColorStop(0.5, 'rgba(255,248,225,0.04)'); sheen.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = sheen; ctx.fillRect(-R * 1.1, -R * 1.1, R * 2.2, R * 2.2);
  ctx.restore();
  // inner bevel
  ctx.lineWidth = R * 0.018; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; pathShape(ctx, s, inset); ctx.stroke();
  ctx.lineWidth = R * 0.01; ctx.strokeStyle = rgba(W.lip, 0.45); pathShape(ctx, s, inset + R * 0.014); ctx.stroke();
  // an engraved ring, as on turned boards
  if (s.round) { ctx.lineWidth = R * 0.008; ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); ctx.stroke(); ctx.strokeStyle = rgba(W.lip, 0.3); ctx.beginPath(); ctx.arc(0, 0, R * 0.9 + R * 0.01, 0, 7); ctx.stroke(); }
  for (const p of b.pos) drawHole(ctx, p.x * P, p.y * P, P * 0.43, wood);
}

// The baked board layer: painted once per (board, wood, size) and drawn scaled. Falls back to direct painting where OffscreenCanvas does not exist.
const layers = new Map();
export function drawBoard(ctx, b, wood, cx, cy, P) {
  let sc = 1; try { sc = Math.min(3, Math.max(0.5, ctx.getTransform().a)); } catch { sc = 1; }
  const s = boardShape(b, P), size = Math.ceil((s.R * 2 + P * 0.8) * sc / 8) * 8, key = `${b.id}|${wood}|${size}`;
  let L = layers.get(key);
  if (L === undefined && hasOff) {
    try { const c = new OffscreenCanvas(size, size), t = c.getContext('2d'); t.translate(size / 2, size / 2); t.scale(sc, sc); paintBoard(t, b, wood, P, 1); L = c; } catch { L = null; }
    layers.set(key, L); if (layers.size > 14) layers.delete(layers.keys().next().value);
  }
  if (L) { ctx.drawImage(L, cx - size / 2 / sc, cy - size / 2 / sc, size / sc, size / sc); return; }
  ctx.save(); ctx.translate(cx, cy); paintBoard(ctx, b, wood, P, 0.45); ctx.restore();
}

// ---- pegs -------------------------------------------------------------------------------------------------------------------------
// o: lift 0..1 (raised and larger, shadow falls further), glow 0..1 (golden halo), alpha, sq (squash on landing), shadow (false: draw only the body)
const sprites = new Map();
export function drawPeg(ctx, x, y, r, set, o = {}) {
  const S = PEGS[set] ?? PEGS.sapphire, lift = o.lift ?? 0, a = o.alpha ?? 1, sq = o.sq ?? 0;
  if (a <= 0.01) return;
  // resting pegs (the common case, up to 45 per frame) come from a small sprite cache; lifted / glowing / fading ones are drawn live
  if (hasOff && !o.forceLive && lift === 0 && !o.glow && sq === 0 && a >= 0.99 && o.shadow !== false) {
    let sc = 1; try { sc = Math.min(3, Math.max(0.5, ctx.getTransform().a)); } catch { sc = 1; }
    const rp = Math.max(4, Math.round(r * sc)), key = `${set}|${rp}`;
    let sp = sprites.get(key);
    if (sp === undefined) {
      try { const sz = Math.ceil(rp * 3.2), c = new OffscreenCanvas(sz, sz), t = c.getContext('2d'); drawPeg(t, sz / 2, sz / 2, rp, set, { ...o, forceLive: true }); sp = { c, sz }; } catch { sp = null; }
      sprites.set(key, sp); if (sprites.size > 40) sprites.delete(sprites.keys().next().value);
    }
    if (sp) { const w = (sp.sz / rp) * r; ctx.drawImage(sp.c, x - w / 2, y - w / 2, w, w); return; }
  }
  ctx.save(); ctx.globalAlpha = a;
  if (o.shadow !== false) {
    const sx = x + r * (0.12 + lift * 0.35), sy = y + r * (0.2 + lift * 0.9), sr = r * (1.05 + lift * 0.1);
    let g = ctx.createRadialGradient(sx, sy, r * 0.1, sx, sy, sr);           // soft cast shadow, light from the top-left
    g.addColorStop(0, `rgba(0,0,0,${0.5 - lift * 0.18})`); g.addColorStop(0.65, `rgba(0,0,0,${0.22 - lift * 0.08})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.3); ctx.fill();
    if (lift < 0.2) {                                                        // contact darkening where the marble meets the well
      g = ctx.createRadialGradient(x + r * 0.05, y + r * 0.12, r * 0.55, x + r * 0.05, y + r * 0.12, r * 1.08);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + r * 0.05, y + r * 0.12, r * 1.08, 0, 6.3); ctx.fill();
    }
    if (S.glass) {                                                           // light focused through the glass: a tinted caustic inside the shadow
      const cx = x + r * (0.5 + lift * 0.3), cy = y + r * (0.62 + lift * 0.9);
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.62);
      g.addColorStop(0, rgba(S.light, 0.5 - lift * 0.15)); g.addColorStop(0.5, rgba(S.mid, 0.22)); g.addColorStop(1, rgba(S.mid, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 6.3); ctx.fill();
    }
  }
  const by = y - lift * r * 0.55, k = 1 + lift * 0.14;
  ctx.translate(x, by); ctx.scale(k * (1 + sq * 0.12), k * (1 - sq * 0.12));
  if (o.glow) { const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.7); g.addColorStop(0, `rgba(255,214,110,${0.75 * o.glow})`); g.addColorStop(1, 'rgba(255,214,110,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, 6.3); ctx.fill(); }
  if (S.glass) {
    let g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.04, 0, 0, r * 1.08);
    g.addColorStop(0, rgba(S.light, 1)); g.addColorStop(0.38, rgba(S.mid, 1)); g.addColorStop(1, rgba(S.dark, 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
    g = ctx.createRadialGradient(r * 0.38, r * 0.46, 0, r * 0.38, r * 0.46, r * 0.8);        // light that passes through the glass and pools low on the far side
    g.addColorStop(0, rgba(S.light, 0.55)); g.addColorStop(1, rgba(S.light, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
    ctx.lineWidth = r * 0.07; ctx.strokeStyle = rgba(S.dark, 0.7); ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, 6.3); ctx.stroke();
    ctx.save(); ctx.rotate(-0.62); g = ctx.createLinearGradient(0, -r * 0.62, 0, -r * 0.28);   // main window reflection
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 0.3, r * 0.15, 0, 0, 6.3); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(r * 0.42, r * 0.38, r * 0.07, 0, 6.3); ctx.fill();
    ctx.lineWidth = r * 0.09; ctx.strokeStyle = 'rgba(255,214,150,0.30)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, Math.PI * 0.18, Math.PI * 0.74); ctx.stroke();   // warm bounce light from the wood on the lower rim
  } else {
    let g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
    g.addColorStop(0, rgba(S.light, 1)); g.addColorStop(0.5, rgba(S.mid, 1)); g.addColorStop(1, rgba(S.dark, 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
    ctx.strokeStyle = rgba(S.dark, 0.32); ctx.lineWidth = r * 0.05;
    for (const f of [0.74, 0.5, 0.26]) { ctx.beginPath(); ctx.arc(0, 0, r * f, 0, 6.3); ctx.stroke(); }     // turned rings
    ctx.lineWidth = r * 0.08; ctx.strokeStyle = rgba(S.dark, 0.75); ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, 6.3); ctx.stroke();
    g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 0, -r * 0.35, -r * 0.4, r * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
  }
  ctx.restore();
}

// A target hole that a selected peg may jump into: a soft golden pulse in the well.
export function drawTarget(ctx, x, y, r, t, calm) {
  const pulse = calm ? 0.8 : 0.78 + 0.22 * Math.sin(t * 5);
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.5);
  g.addColorStop(0, `rgba(255,232,120,${0.85 * pulse})`); g.addColorStop(0.55, `rgba(255,205,70,${0.5 * pulse})`); g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, 6.3); ctx.fill();
  ctx.lineWidth = Math.max(2.5, r * 0.12); ctx.strokeStyle = `rgba(255,244,190,${0.7 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, 6.3); ctx.stroke();
}
