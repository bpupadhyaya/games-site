// Indian Club Swinging: all painting that is not interface. A courtyard at first light, a raked-sand pit, lit turned-wood clubs, a glowing
// marker. Pure canvas 2D, no DOM; every function depends only on its arguments (and the clock the caller passes).
export const PAL = {
  ink: '#07161a', night: '#0c2a30', teal: '#14423f', tealHi: '#2bb6a0', clay: '#7a3b22', clayDark: '#2b160f', sand: '#d9a86a', sandDark: '#8f5a32',
  turmeric: '#ffc83d', turmericHi: '#fff0a8', cream: '#fff3da', chalk: '#f6ead0', wood: '#b0642c', woodDark: '#4f2410', woodLight: '#f0b070',
  brass: '#e8c25a', brassDark: '#8a6a1e', rose: '#ff7a68', text: '#fdf2dc', dim: 'rgba(253,242,220,0.64)', gold: '#ffd77a',
};
export const DISPLAY = '"Dela Gothic One", Impact, "Arial Black", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (x) => x * x * (3 - 2 * x);

// ---- a cache for the heavy static background ------------------------------------------------------------------------------------------------
const caches = new Map();
function cached(key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 6) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); const g = c.getContext('2d'); g.scale(scale, scale); paint(g, w, h); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

function paintBackdrop(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#071a22'); gr.addColorStop(0.28, '#0e3a3c'); gr.addColorStop(0.5, '#2b5a4a'); gr.addColorStop(0.62, '#7a4a2a'); gr.addColorStop(1, '#2b160f');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // first light from one side
  const sun = g.createRadialGradient(w * 0.82, h * 0.38, 10, w * 0.82, h * 0.38, Math.max(w, h) * 0.7);
  sun.addColorStop(0, 'rgba(255,196,110,0.5)'); sun.addColorStop(0.4, 'rgba(255,150,70,0.16)'); sun.addColorStop(1, 'rgba(255,150,70,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  // the colonnade: a row of arches along the horizon
  const base = h * 0.46, aw = Math.max(110, Math.min(w, h) * 0.2), ah = aw * 1.5;
  for (let x = -aw * 0.3; x < w + aw; x += aw) {
    g.fillStyle = '#06161b';
    g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - ah * 0.62); g.arc(x + aw * 0.42, base - ah * 0.62, aw * 0.42, Math.PI, 0); g.lineTo(x + aw * 0.84, base); g.closePath(); g.fill();
    const wg = g.createLinearGradient(0, base - ah, 0, base);
    wg.addColorStop(0, 'rgba(255,190,110,0.5)'); wg.addColorStop(1, 'rgba(255,130,60,0.15)');
    g.fillStyle = wg;
    g.beginPath(); g.moveTo(x + aw * 0.1, base); g.lineTo(x + aw * 0.1, base - ah * 0.62); g.arc(x + aw * 0.42, base - ah * 0.62, aw * 0.32, Math.PI, 0); g.lineTo(x + aw * 0.74, base); g.closePath(); g.fill();
    g.fillStyle = '#0a1d22'; g.fillRect(x + aw * 0.84, base - ah * 0.9, aw * 0.16, ah * 0.9);       // the pillar between arches
  }
  g.fillStyle = '#0a1d22'; g.fillRect(0, base - 6, w, 10);
  // the courtyard floor
  const fl = g.createLinearGradient(0, base, 0, h);
  fl.addColorStop(0, 'rgba(120,70,40,0.0)'); fl.addColorStop(0.1, 'rgba(110,60,34,0.8)'); fl.addColorStop(1, 'rgba(32,16,10,1)');
  g.fillStyle = fl; g.fillRect(0, base, w, h - base);
  g.strokeStyle = 'rgba(255,214,160,0.05)'; g.lineWidth = 2;
  for (let k = 1; k < 9; k++) { const y = base + (h - base) * Math.pow(k / 9, 1.6); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const v = g.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(2,8,10,0.62)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}

export function drawBackdrop(ctx, w, h, t, opt = {}) {
  const c = cached(`bg${Math.round(w)}x${Math.round(h)}`, w, h, 1, paintBackdrop);
  if (c) ctx.drawImage(c, 0, 0, w, h); else paintBackdrop(ctx, w, h);
  if (!opt.noMotes) drawMotes(ctx, w, h, t, opt.motes ?? 18);
}

export function drawMotes(ctx, w, h, t, n = 18) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const sp = 6 + (i % 5) * 3, y = h - ((t * sp + i * 131.7) % (h + 40)), x = ((i * 89.3) % w) + Math.sin(t * 0.5 + i * 1.9) * 22;
    const a = 0.22 + 0.18 * Math.sin(t * 1.7 + i), r = 1.4 + (i % 3) * 0.9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, `rgba(255,220,150,${a})`); g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// The raked-sand pit with its chalk ring. `pulse` 0..1 brightens the ring on the beat.
export function drawPit(ctx, cx, cy, R, t, pulse = 0) {
  ctx.save();
  const sh = ctx.createRadialGradient(cx, cy + R * 0.12, R * 0.9, cx, cy + R * 0.12, R * 1.55);
  sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy + R * 0.12, R * 1.55, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R * 1.28);
  g.addColorStop(0, '#f0c386'); g.addColorStop(0.55, PAL.sand); g.addColorStop(1, PAL.sandDark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, R * 0.008);
  for (let i = 1; i <= 8; i++) {
    ctx.strokeStyle = `rgba(90,48,18,${0.1 + (i % 2) * 0.06})`;
    ctx.beginPath(); ctx.arc(cx, cy, R * (0.14 * i + 0.1), 0, TAU); ctx.stroke();
  }
  // the pad itself is a little lighter, so the player knows where the finger travels
  const pg = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.05);
  pg.addColorStop(0, 'rgba(255,240,200,0.16)'); pg.addColorStop(1, 'rgba(255,240,200,0.04)');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, TAU); ctx.fill();
  // chalk ring in short strokes (hand-laid)
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, R * 0.022); ctx.strokeStyle = `rgba(255,244,222,${0.55 + 0.35 * pulse})`;
  const n = 48;
  for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU + 0.03, a1 = ((i + 0.78) / n) * TAU; ctx.beginPath(); ctx.arc(cx, cy, R * 1.17, a0, a1); ctx.stroke(); }
  // a small centre mark
  ctx.strokeStyle = 'rgba(255,244,222,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - R * 0.05, cy); ctx.lineTo(cx + R * 0.05, cy); ctx.moveTo(cx, cy - R * 0.05); ctx.lineTo(cx, cy + R * 0.05); ctx.stroke();
  ctx.restore();
}

// The touch pad over the 3D scene: a faint glass disc with a chalk ring, so the player sees where the finger travels.
export function drawPadGlass(ctx, cx, cy, R, t, pulse = 0) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.12);
  g.addColorStop(0, 'rgba(255,240,205,0.07)'); g.addColorStop(0.8, 'rgba(255,240,205,0.04)'); g.addColorStop(1, 'rgba(255,240,205,0.0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2.5, R * 0.016); ctx.strokeStyle = `rgba(255,244,222,${0.32 + 0.4 * pulse})`;
  const n = 56;
  for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU + t * 0.03, a1 = a0 + (TAU / n) * 0.6; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, a0, a1); ctx.stroke(); }
  ctx.restore();
}

// ---- the club -------------------------------------------------------------------------------------------------------------------------------
// Half-width profile along the club (s = 0 knob ... 1 end), as a fraction of its length.
const PROFILE = [[0, 0.0], [0.012, 0.03], [0.035, 0.045], [0.07, 0.03], [0.14, 0.024], [0.3, 0.032], [0.46, 0.05], [0.6, 0.088], [0.72, 0.122], [0.82, 0.136], [0.91, 0.122], [0.97, 0.085], [1, 0.0]];
const halfWidth = (s) => {
  for (let i = 1; i < PROFILE.length; i++) {
    if (s <= PROFILE[i][0]) { const [s0, w0] = PROFILE[i - 1], [s1, w1] = PROFILE[i]; return w0 + (w1 - w0) * smooth((s - s0) / (s1 - s0 || 1)); }
  }
  return 0;
};
const WOODS = [
  { hi: '#ffd8a0', mid: '#c27a38', lo: '#4a2210', ring: '#f0cc66', ringLo: '#8a6a1e' },
  { hi: '#e8b88c', mid: '#8c4a2c', lo: '#35160c', ring: '#46d6c0', ringLo: '#1c7a6c' },
];

// Head (belly centre) at (hx, hy); the club points from knob to end along `ang` (radians). L is the whole length in px.
// opt: tone 0 lead / 1 second; alpha; glow 0..1 (lit by a smooth beat).
export function drawClub(ctx, hx, hy, ang, L, opt = {}) {
  const wd = WOODS[opt.tone ?? 0], ca = Math.cos(ang), sa = Math.sin(ang), kx = hx - ca * L * 0.82, ky = hy - sa * L * 0.82;
  ctx.save();
  ctx.globalAlpha = opt.alpha ?? 1;
  // shadow on the sand
  ctx.save(); ctx.translate(kx + L * 0.05, ky + L * 0.09); ctx.rotate(ang); ctx.fillStyle = 'rgba(30,14,4,0.3)';
  ctx.beginPath(); for (let i = 0; i <= 24; i++) { const s = i / 24; i ? ctx.lineTo(s * L, -halfWidth(s) * L * 0.85) : ctx.moveTo(0, 0); }
  for (let i = 24; i >= 0; i--) { const s = i / 24; ctx.lineTo(s * L, halfWidth(s) * L * 0.85); }
  ctx.fill(); ctx.restore();
  ctx.translate(kx, ky); ctx.rotate(ang);
  const wmax = L * 0.14;
  const body = ctx.createLinearGradient(0, -wmax, 0, wmax);
  body.addColorStop(0, wd.lo); body.addColorStop(0.22, wd.mid); body.addColorStop(0.4, wd.hi); body.addColorStop(0.62, wd.mid); body.addColorStop(1, wd.lo);
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const s = i / 40; const x = s * L, y = -halfWidth(s) * L; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  for (let i = 40; i >= 0; i--) { const s = i / 40; ctx.lineTo(s * L, halfWidth(s) * L); }
  ctx.closePath(); ctx.fillStyle = body; ctx.fill();
  ctx.save(); ctx.clip();
  // turned grooves and rings
  const ring = (s0, s1, w) => {
    const rg = ctx.createLinearGradient(0, -wmax, 0, wmax);
    rg.addColorStop(0, wd.ringLo); rg.addColorStop(0.35, wd.ring); rg.addColorStop(0.6, wd.ringLo); rg.addColorStop(1, '#2a1a06');
    ctx.fillStyle = rg; ctx.fillRect(s0 * L, -wmax, (s1 - s0) * L, wmax * 2);
  };
  ring(0.085, 0.105, 1); ring(0.53, 0.56, 1); ring(0.93, 0.945, 1);
  ctx.strokeStyle = 'rgba(30,12,4,0.35)'; ctx.lineWidth = Math.max(1, L * 0.006);
  for (const s of [0.19, 0.25, 0.4, 0.66, 0.78]) { ctx.beginPath(); ctx.moveTo(s * L, -wmax); ctx.lineTo(s * L, wmax); ctx.stroke(); }
  // a long specular streak and soft end shading
  const sp = ctx.createLinearGradient(0, -wmax * 0.9, 0, -wmax * 0.2);
  sp.addColorStop(0, 'rgba(255,248,225,0)'); sp.addColorStop(0.6, 'rgba(255,248,225,0.5)'); sp.addColorStop(1, 'rgba(255,248,225,0)');
  ctx.fillStyle = sp; ctx.fillRect(0.4 * L, -wmax * 0.9, 0.5 * L, wmax * 0.7);
  const eg = ctx.createLinearGradient(0.9 * L, 0, L, 0); eg.addColorStop(0, 'rgba(20,8,2,0)'); eg.addColorStop(1, 'rgba(20,8,2,0.5)');
  ctx.fillStyle = eg; ctx.fillRect(0.9 * L, -wmax, 0.1 * L, wmax * 2);
  const bt = ctx.createLinearGradient(0, wmax * 0.2, 0, wmax); bt.addColorStop(0, 'rgba(0,0,0,0)'); bt.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = bt; ctx.fillRect(0, wmax * 0.2, L, wmax * 0.8);
  ctx.restore();
  if (opt.glow > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(0.82 * L, 0, 2, 0.82 * L, 0, L * 0.34);
    gg.addColorStop(0, `rgba(255,224,130,${0.55 * opt.glow})`); gg.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0.82 * L, 0, L * 0.34, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// The marker: a warm bead with a halo. r in px.
export function drawBead(ctx, x, y, r, glow = 1, hot = false) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const h = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
  h.addColorStop(0, `rgba(255,208,90,${0.62 * glow})`); h.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const c = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  c.addColorStop(0, '#fffbe6'); c.addColorStop(0.5, hot ? '#ffe27a' : '#ffc83d'); c.addColorStop(1, '#e08a10');
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(70,32,4,0.7)'; ctx.stroke();
  ctx.restore();
}

// The target: a ring the size of the "smooth" zone with a bright centre. r in px.
export function drawTarget(ctx, x, y, r, pulse = 0, hot = false) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const h = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.9);
  h.addColorStop(0, `rgba(255,208,90,${0.2 + 0.15 * pulse})`); h.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = Math.max(3, r * 0.1); ctx.strokeStyle = hot ? '#ffe27a' : '#ffc83d';
  ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.06 * pulse), 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.strokeStyle = 'rgba(70,32,4,0.7)';
  ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.06 * pulse) + r * 0.11, 0, TAU); ctx.stroke();
  const c = ctx.createRadialGradient(x - r * 0.05, y - r * 0.05, 1, x, y, r * 0.22);
  c.addColorStop(0, '#fffbe6'); c.addColorStop(1, '#ffc83d');
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(3, r * 0.2), 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- sparks (positions and sizes are in whatever space the caller has set up: the play view draws them in pad units) -----------------------
export function burst(parts, rng, x, y, n, col = '#ffd45a', speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = rng.range(0.25, 0.9) * speed;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.15, life: rng.range(0.4, 0.9), age: 0, r: rng.range(0.008, 0.02), col });
  }
  if (parts.length > 100) parts.splice(0, parts.length - 100);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.8 * dt; p.vx *= 1 - 1.5 * dt; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    const a = clamp01(1 - p.age / p.life);
    ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.6), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the athlete, 2D fallback (used when WebGL is missing, lost, or the 3D layer failed to load) -----------------------------------------------
// A front view of a person in a cotton vest and shorts standing in the pit, hands on the clubs' grips. 1 metre = R px. Two-bone arms reach the grips.
const SKIN = { hi: '#e0a878', mid: '#c68e63', lo: '#8a5a3a' };
function limb(ctx, ax, ay, bx, by, wa, wb, fill) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  ctx.fillStyle = fill; ctx.beginPath();
  ctx.moveTo(ax + nx * wa, ay + ny * wa); ctx.lineTo(bx + nx * wb, by + ny * wb);
  ctx.arc(bx, by, wb, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, false);
  ctx.lineTo(ax - nx * wa, ay - ny * wa);
  ctx.arc(ax, ay, wa, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, false);
  ctx.closePath(); ctx.fill();
}
function arm2(ctx, sx, sy, hx, hy, side, R) {
  const u = 0.3 * R, f = 0.3 * R, dx = hx - sx, dy = hy - sy;
  let d = Math.hypot(dx, dy); const reach = Math.min(d, u + f - 1);
  if (d < 1) d = 1;
  const a = (u * u - f * f + reach * reach) / (2 * reach), hgt = Math.sqrt(Math.max(0, u * u - a * a));
  const ux = dx / d, uy = dy / d, ex = sx + ux * a + (-uy) * hgt * side, ey = sy + uy * a + ux * hgt * side;
  const g = (c) => c;
  limb(ctx, sx, sy, ex, ey, R * 0.062, R * 0.05, g(SKIN.mid));
  limb(ctx, ex, ey, hx, hy, R * 0.05, R * 0.04, g(SKIN.mid));
  ctx.fillStyle = SKIN.hi; ctx.beginPath(); ctx.arc(hx, hy, R * 0.055, 0, TAU); ctx.fill();
}
export function drawFigure2D(ctx, f) {
  const { cx, cy, R } = f, m = (x, y) => [cx + x * R, cy + y * R];
  const sway = ((f.hLead.x + f.hSecond.x) * 0.5) * 0.05, dip = Math.max(0, f.hLead.y) * 0.03;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ground shadow
  const [gx, gy] = m(0, 1.12);
  ctx.fillStyle = 'rgba(20,8,2,0.38)'; ctx.beginPath(); ctx.ellipse(gx, gy, R * 0.48, R * 0.1, 0, 0, TAU); ctx.fill();
  // legs
  for (const s of [-1, 1]) {
    const [hx, hy] = m(s * 0.1 + sway * 0.5, 0.16 + dip), [kx, ky] = m(s * 0.15, 0.64), [fx, fy] = m(s * 0.17, 1.1);
    limb(ctx, hx, hy, kx, ky, R * 0.085, R * 0.062, SKIN.mid);
    limb(ctx, kx, ky, fx, fy, R * 0.058, R * 0.045, SKIN.lo);
    ctx.fillStyle = '#d8c6a2'; ctx.beginPath(); ctx.ellipse(fx + s * R * 0.02, fy + R * 0.015, R * 0.085, R * 0.04, 0, 0, TAU); ctx.fill();
  }
  // shorts
  { const [ax, ay] = m(-0.145 + sway, 0.0 + dip), [bx] = m(0.145 + sway, 0);
    const g = ctx.createLinearGradient(ax, 0, bx, 0); g.addColorStop(0, '#9bb8b2'); g.addColorStop(0.5, '#f4efe2'); g.addColorStop(1, '#a9a08a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(m(0.17 + sway, 0.36 + dip)[0], m(0, 0.36 + dip)[1]); ctx.lineTo(m(0.02, 0)[0], m(0, 0.2)[1]);
    ctx.lineTo(m(-0.02, 0)[0], m(0, 0.2)[1]); ctx.lineTo(m(-0.17 + sway, 0)[0], m(0, 0.36 + dip)[1]); ctx.closePath(); ctx.fill(); }
  // torso (vest)
  { const [lx0, ly0] = m(-0.205 + sway, -0.35 + dip * 0.6), [rx0] = m(0.205 + sway, 0), [lx1, ly1] = m(-0.135 + sway * 0.6, 0.04 + dip), [rx1] = m(0.135 + sway * 0.6, 0);
    const g = ctx.createLinearGradient(lx0, 0, rx0, 0); g.addColorStop(0, '#b9d0c8'); g.addColorStop(0.45, '#fbf4e2'); g.addColorStop(1, '#b8ad92');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.quadraticCurveTo(cx + sway * R, ly0 - R * 0.045, rx0, ly0); ctx.lineTo(rx1, ly1); ctx.lineTo(lx1, ly1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = SKIN.mid; ctx.beginPath(); ctx.moveTo(m(-0.07 + sway, -0.355)[0], ly0 - R * 0.02); ctx.quadraticCurveTo(cx + sway * R, ly0 + R * 0.2, m(0.07 + sway, 0)[0], ly0 - R * 0.02); ctx.closePath(); ctx.fill(); }
  // neck and head
  { const [nx, ny] = m(sway * 1.2, -0.43 + dip * 0.4), [hx, hy] = m(sway * 1.4, -0.56 + dip * 0.4);
    limb(ctx, nx, ny + R * 0.04, nx, ny - R * 0.06, R * 0.045, R * 0.045, SKIN.lo);
    const hg = ctx.createRadialGradient(hx - R * 0.03, hy - R * 0.04, R * 0.01, hx, hy, R * 0.13);
    hg.addColorStop(0, SKIN.hi); hg.addColorStop(1, SKIN.mid);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, R * 0.095, R * 0.115, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(hx, hy - R * 0.05, R * 0.1, R * 0.07, 0, Math.PI, TAU); ctx.fill(); }
  // arms to the grips (the screen-right club is the athlete's left hand)
  { const [ls, lsy] = m(0.2 + sway, -0.33 + dip * 0.6), [rs, rsy] = m(-0.2 + sway, -0.33 + dip * 0.6);
    arm2(ctx, ls, lsy, f.lead.x, f.lead.y, 1, R);
    arm2(ctx, rs, rsy, f.second.x, f.second.y, -1, R); }
  ctx.restore();
}

// A gripping hand over a club's handle (the 3D person's own fist is behind the club, so this puts fingers in front of the wood).
// (x, y) is the hand, `ang` the direction knob -> head, R the pad radius in px.
export function drawGrip(ctx, x, y, ang, R) {
  const r = R * 0.062;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#e6b58a'); g.addColorStop(0.55, '#c68e63'); g.addColorStop(1, '#8a5a3a');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(60,28,10,0.55)'; ctx.lineWidth = Math.max(1, R * 0.006);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.95, 0, 0, TAU); ctx.fill(); ctx.stroke();
  for (const dx of [-0.5, -0.1, 0.3]) { ctx.beginPath(); ctx.moveTo(dx * r, -r * 0.9); ctx.lineTo(dx * r + r * 0.12, r * 0.9); ctx.stroke(); }
  ctx.fillStyle = '#d9a374'; ctx.beginPath(); ctx.ellipse(r * 0.7, -r * 0.55, r * 0.5, r * 0.3, 0.5, 0, TAU); ctx.fill(); ctx.stroke();   // thumb wrapped over the handle
  ctx.restore();
}
