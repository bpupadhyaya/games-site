// Flag Tossing: all the painting that is not UI. A daytime piazza (tower, wall, bunting, flagstones), bearers seen from behind,
// original heraldic flags, confetti. Pure canvas 2D; no DOM. Everything is a function of its arguments (and the clock the caller passes).

export const PAL = {
  ink: '#0d1830', navy: '#16284f', navy2: '#213a6b', cream: '#fbf1dc', text: '#fbf1dc', dim: 'rgba(251,241,220,0.62)',
  gold: '#f2c14e', goldHi: '#fff0b0', goldDeep: '#a9771c', terracotta: '#c8603a', terraDeep: '#8f3b22', stone: '#d9c7a0', stoneDeep: '#a99874',
  azure: '#2557a7', gules: '#c0262f', vert: '#2f8a5b', purple: '#5b2a86', argent: '#f8f1e0',
  perfect: '#fff0b0', good: '#8fd3ff', off: '#ffb27a', bad: '#ff6b6b',
};
export const DISPLAY = '"Cormorant Garamond", "Times New Roman", Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const mix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return `rgb(${c(16)},${c(8)},${c(0)})`; };
const lerp = (a, b, t) => a + (b - a) * t;

// ---- a cache for the heavy static background ---------------------------------------------------------------------------------------------
const caches = new Map();
function stat(ctx, key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') { paint(ctx, w, h); return; }
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 4) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); const g = c.getContext('2d'); g.scale(scale, scale); paint(g, w, h); } catch { c = null; }
    caches.set(key, c);
  }
  if (c) ctx.drawImage(c, 0, 0, w, h); else paint(ctx, w, h);
}

// ---- the piazza ------------------------------------------------------------------------------------------------------------------------------
function cloud(g, x, y, s, a) {
  g.fillStyle = `rgba(255,255,255,${a})`;
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.75], [0.35, -0.35, 0.8], [-0.4, -0.2, 0.7]]) { g.beginPath(); g.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.55, 0, 0, TAU); g.fill(); }
}
function battlements(g, x, y, w, n, h, col) {
  const bw = w / (n * 2 - 1);
  g.fillStyle = col;
  for (let i = 0; i < n; i++) g.fillRect(x + i * bw * 2, y - h, bw, h + 1);
}
function house(g, x, base, w, h, wall, roof, seed) {
  g.fillStyle = wall; g.fillRect(x, base - h, w, h);
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - w * 0.06, base - h); g.lineTo(x + w * 0.5, base - h - w * 0.28); g.lineTo(x + w * 1.06, base - h); g.closePath(); g.fill();
  g.fillStyle = 'rgba(40,30,20,0.55)';
  const cols = Math.max(1, Math.floor(w / 46)), rows = Math.max(1, Math.floor(h / 70));
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const wx = x + (c + 0.5) * w / cols - 7, wy = base - h + 18 + r * (h - 28) / rows;
    g.beginPath(); g.roundRect(wx, wy, 14, 24, [7, 7, 1, 1]); g.fill();
    if ((c + r + seed) % 3 === 0) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx - 3, wy + 24, 20, 3); g.fillStyle = 'rgba(40,30,20,0.55)'; }
  }
}
function tower(g, cx, base, w, h) {
  const x = cx - w / 2;
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, '#d8a56e'); gr.addColorStop(0.55, '#e7bf86'); gr.addColorStop(1, '#b98450');
  g.fillStyle = gr; g.fillRect(x, base - h, w, h);
  // brick courses
  g.strokeStyle = 'rgba(120,70,30,0.18)'; g.lineWidth = 1;
  for (let y = base - h + 14; y < base; y += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
  // the bell chamber is wider, with battlements on corbels
  const bw = w * 1.28, bx = cx - bw / 2, by = base - h - w * 0.5;
  g.fillStyle = '#c99660'; g.fillRect(bx, by, bw, w * 0.5);
  g.fillStyle = '#b07b46'; g.fillRect(bx - 4, by - 8, bw + 8, 12);
  battlements(g, bx - 4, by - 8, bw + 8, 7, w * 0.18, '#c99660');
  g.fillStyle = 'rgba(40,24,16,0.75)';
  g.beginPath(); g.roundRect(cx - w * 0.17, by + w * 0.08, w * 0.34, w * 0.36, [w * 0.17, w * 0.17, 0, 0]); g.fill();
  // clock face
  g.fillStyle = '#f6ecd2'; g.beginPath(); g.arc(cx, base - h * 0.62, w * 0.22, 0, TAU); g.fill();
  g.strokeStyle = '#4a3320'; g.lineWidth = 2.5; g.stroke();
  g.beginPath(); g.moveTo(cx, base - h * 0.62); g.lineTo(cx, base - h * 0.62 - w * 0.15); g.moveTo(cx, base - h * 0.62); g.lineTo(cx + w * 0.1, base - h * 0.62 + w * 0.04); g.stroke();
  // slit windows
  g.fillStyle = 'rgba(40,24,16,0.6)';
  for (let i = 0; i < 3; i++) g.fillRect(cx - 3, base - h * (0.2 + i * 0.07) - 18, 6, 18);
  // pointed cap and finial
  g.fillStyle = '#9c3d27'; g.beginPath(); g.moveTo(bx - 6, by - 8); g.lineTo(cx, by - w * 0.95); g.lineTo(bx + bw + 6, by - 8); g.closePath(); g.fill();
  g.strokeStyle = '#6a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, by - w * 0.95); g.lineTo(cx, by - w * 1.25); g.stroke();
}
function paintBackdrop(g, w, h, floorY) {
  const sky = g.createLinearGradient(0, 0, 0, floorY);
  sky.addColorStop(0, '#4f98da'); sky.addColorStop(0.55, '#97cbee'); sky.addColorStop(1, '#f1e6c8');
  g.fillStyle = sky; g.fillRect(0, 0, w, floorY + 2);
  const sun = g.createRadialGradient(w * 0.82, floorY * 0.22, 4, w * 0.82, floorY * 0.22, floorY * 0.4);
  sun.addColorStop(0, 'rgba(255,248,220,0.85)'); sun.addColorStop(1, 'rgba(255,248,220,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, floorY);
  cloud(g, w * 0.2, floorY * 0.24, 54, 0.8); cloud(g, w * 0.66, floorY * 0.12, 70, 0.7); cloud(g, w * 0.46, floorY * 0.43, 46, 0.55); cloud(g, w * 0.9, floorY * 0.5, 44, 0.5);
  // hills, a long way off
  const hill = (base, amp, col, seed) => {
    g.beginPath(); g.moveTo(0, floorY);
    for (let x = 0; x <= w + 10; x += 10) g.lineTo(x, base - amp * (0.5 + 0.3 * Math.sin(x / w * 5.2 + seed) + 0.2 * Math.sin(x / w * 13 + seed * 2)));
    g.lineTo(w + 10, floorY); g.closePath(); g.fillStyle = col; g.fill();
  };
  const sc = Math.min(w, 900) / 720;
  hill(floorY - 150 * sc, 70 * sc, '#9fb7a0', 1.1); hill(floorY - 118 * sc, 60 * sc, '#86a587', 3.7);
  // the town: a row of houses on both sides and the tower at one third
  const base = floorY - 52 * sc, tw = clamp(w * 0.11, 70, 120) * Math.min(1.3, Math.max(0.8, h / w / 1.4)), tcx = w * 0.3;
  const walls = ['#e9cf9b', '#dcb77f', '#efd9ae', '#d7a974', '#e4c28d'], roofs = ['#b4492d', '#a23d26', '#c25a36'];
  let x = -20, i = 0;
  while (x < w + 20) {
    const ww = (74 + ((i * 37) % 46)) * sc, hh = (110 + ((i * 53) % 90)) * sc;
    if (Math.abs(x + ww / 2 - tcx) > tw * 1.1) house(g, x, base, ww, hh, walls[i % 5], roofs[i % 3], i);
    x += ww + 3; i += 1;
  }
  tower(g, tcx, base, tw, (270 + h * 0.06) * sc);
  // the long wall with arches and a deep shadow
  const wall = g.createLinearGradient(0, base - 6 * sc, 0, floorY);
  wall.addColorStop(0, '#d9b278'); wall.addColorStop(1, '#a9794a');
  g.fillStyle = wall; g.fillRect(0, base - 6 * sc, w, floorY - base + 8 * sc);
  g.fillStyle = 'rgba(70,40,20,0.5)';
  const aw = 64 * sc;
  for (let ax = aw * 0.5; ax < w; ax += aw * 1.5) { g.beginPath(); g.roundRect(ax, base + 12 * sc, aw, floorY - base - 12 * sc, [aw / 2, aw / 2, 0, 0]); g.fill(); }
  // bunting strung across the top of the wall
  const colors = ['#c0262f', '#f2c14e', '#2557a7', '#f8f1e0', '#2f8a5b'];
  for (let line = 0; line < 2; line++) {
    const y0 = base - 40 * sc + line * 22 * sc, sag = 22 * sc;
    g.strokeStyle = 'rgba(60,40,20,0.6)'; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; k <= 40; k++) { const u = k / 40; const yy = y0 + Math.sin(u * Math.PI) * sag; if (k) g.lineTo(u * w, yy); else g.moveTo(0, yy); }
    g.stroke();
    const n = Math.max(10, Math.floor(w / (34 * sc)));
    for (let k = 1; k < n; k++) {
      const u = k / n, px = u * w, py = y0 + Math.sin(u * Math.PI) * sag;
      g.fillStyle = colors[(k + line * 2) % 5];
      g.beginPath(); g.moveTo(px - 8 * sc, py); g.lineTo(px + 8 * sc, py); g.lineTo(px, py + 20 * sc); g.closePath(); g.fill();
    }
  }
  // flagstones, in perspective, from the wall to the viewer
  const fl = g.createLinearGradient(0, floorY, 0, h);
  fl.addColorStop(0, '#d9c29a'); fl.addColorStop(1, '#a9906a');
  g.fillStyle = fl; g.fillRect(0, floorY, w, h - floorY + 2);
  g.strokeStyle = 'rgba(80,60,36,0.30)'; g.lineWidth = 1.5;
  const vx = w * 0.5, rows = 10;
  for (let r = 1; r <= rows; r++) { const t = (r / rows) ** 1.7, y = floorY + (h - floorY) * t; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let c = -12; c <= 12; c++) { g.beginPath(); g.moveTo(vx + c * w * 0.02, floorY); g.lineTo(vx + c * w * 0.14, h); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, floorY, w, 3);
  const edge = g.createLinearGradient(0, floorY, 0, floorY + 36 * sc);
  edge.addColorStop(0, 'rgba(60,36,16,0.35)'); edge.addColorStop(1, 'rgba(60,36,16,0)');
  g.fillStyle = edge; g.fillRect(0, floorY, w, 36 * sc);
}
export function drawBackdrop(ctx, w, h, floorY) {
  const key = `bd|${Math.round(w)}x${Math.round(h)}|${Math.round(floorY)}`;
  stat(ctx, key, w, h, 1, (g, ww, hh) => paintBackdrop(g, ww, hh, floorY));
}
// A soft darkening so panels and text read on the bright piazza.
export function drawVeil(ctx, w, h, a = 0.45) {
  ctx.fillStyle = `rgba(10,20,44,${a})`; ctx.fillRect(0, 0, w, h);
}

// ---- heraldic flags -----------------------------------------------------------------------------------------------------------------------------
export const DESIGNS = [
  { a: '#2557a7', b: '#f2c14e', c: 'fess', name: 'Azure fess' },
  { a: '#c0262f', b: '#f8f1e0', c: 'half', name: 'Gules per bend' },
  { a: '#2f8a5b', b: '#f2c14e', c: 'bend', name: 'Vert bend' },
  { a: '#5b2a86', b: '#e9e2f4', c: 'chevron', name: 'Purple chevron' },
  { a: '#f8f1e0', b: '#2557a7', c: 'checky', name: 'Checky' },
  { a: '#f2c14e', b: '#c0262f', c: 'tower', name: 'Gold tower' },
  { a: '#2557a7', b: '#f2c14e', c: 'sun', name: 'Azure sun' },
  { a: '#c0262f', b: '#f2c14e', c: 'stars', name: 'Gules stars' },
];
function star(g, cx, cy, r, pts = 5) {
  g.beginPath();
  for (let i = 0; i < pts * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / pts, rr = i % 2 ? r * 0.42 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
export function paintDesign(g, d, w, h) {
  g.fillStyle = d.a; g.fillRect(-2, -2, w + 4, h + 4);
  g.fillStyle = d.b;
  if (d.c === 'fess') g.fillRect(0, h * 0.34, w, h * 0.32);
  else if (d.c === 'half') {
    g.beginPath(); g.moveTo(0, h); g.lineTo(w, 0); g.lineTo(w, h); g.closePath(); g.fill();
    g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(w * 0.5, h * 0.22); g.lineTo(w * 0.62, h * 0.5); g.lineTo(w * 0.5, h * 0.78); g.lineTo(w * 0.38, h * 0.5); g.closePath(); g.fill();
  }
  else if (d.c === 'bend') { g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.26, 0); g.lineTo(w, h * 0.82); g.lineTo(w, h); g.lineTo(w * 0.74, h); g.lineTo(0, h * 0.18); g.closePath(); g.fill(); }
  else if (d.c === 'chevron') { g.beginPath(); g.moveTo(0, h * 0.95); g.lineTo(w * 0.5, h * 0.2); g.lineTo(w, h * 0.95); g.lineTo(w, h * 0.68); g.lineTo(w * 0.5, 0); g.lineTo(0, h * 0.68); g.closePath(); g.fill(); }
  else if (d.c === 'checky') { const n = 4, cw = w / (n + 1), ch = h / 3; for (let r = 0; r < 3; r++) for (let c = 0; c < n + 1; c++) if ((r + c) % 2 === 0) { g.fillStyle = d.b; g.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5); } }
  else if (d.c === 'sun') {
    g.translate(w * 0.5, h * 0.5);
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(h * 0.2, -h * 0.04); g.lineTo(h * 0.46, 0); g.lineTo(h * 0.2, h * 0.04); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(0, 0, h * 0.17, 0, TAU); g.fill();
  } else if (d.c === 'tower') {
    const bw = w * 0.3, bx = w * 0.5 - bw / 2, by = h * 0.28, bh = h * 0.52;
    g.fillRect(bx, by, bw, bh);
    for (let i = 0; i < 3; i++) g.fillRect(bx + i * bw * 0.4, by - h * 0.1, bw * 0.2, h * 0.11);
    g.fillStyle = d.a; g.beginPath(); g.roundRect(w * 0.5 - bw * 0.14, by + bh * 0.5, bw * 0.28, bh * 0.5, [bw * 0.14, bw * 0.14, 0, 0]); g.fill();
  } else if (d.c === 'stars') {
    star(g, w * 0.3, h * 0.3, h * 0.17); star(g, w * 0.7, h * 0.3, h * 0.17); star(g, w * 0.5, h * 0.7, h * 0.17);
  }
}

// A flag centred on (x, y): pole of length L, rotated by `ang` (0 = upright). o: ph (wave phase), side (+1 / -1 cloth side), calm, held.
export function drawFlag(ctx, x, y, L, ang, design, o = {}) {
  const d = DESIGNS[((design % 8) + 8) % 8], side = o.side ?? 1, ph = o.ph ?? 0, calm = o.calm ? 0.35 : 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  // pole
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a2f14'; ctx.lineWidth = Math.max(3, L * 0.042); ctx.beginPath(); ctx.moveTo(0, L * 0.5); ctx.lineTo(0, -L * 0.5); ctx.stroke();
  ctx.strokeStyle = '#c99a52'; ctx.lineWidth = Math.max(1.5, L * 0.016); ctx.beginPath(); ctx.moveTo(-L * 0.008, L * 0.5); ctx.lineTo(-L * 0.008, -L * 0.5); ctx.stroke();
  // finial
  ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.moveTo(0, -L * 0.5 - L * 0.1); ctx.lineTo(L * 0.035, -L * 0.5 + L * 0.005); ctx.lineTo(-L * 0.035, -L * 0.5 + L * 0.005); ctx.closePath(); ctx.fill();
  // cloth
  const cw = L * 0.56 * side, ch = L * 0.4, top = -L * 0.5 + L * 0.03, N = 10;
  const wv = (u) => Math.sin(ph + u * 4.4) * L * 0.032 * u * calm + u * u * L * 0.035 * (o.held ? 1 : 0.6);
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const u = i / N; const px = cw * u, py = top + wv(u) - (i === 0 ? 0 : 0); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.lineTo(cw * 0.84, top + ch * 0.5 + wv(1) * 0.9);
    for (let i = N; i >= 0; i--) { const u = i / N; ctx.lineTo(cw * u, top + ch + wv(u)); }
    ctx.closePath();
  };
  path(); ctx.fillStyle = d.a; ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.translate(Math.min(0, cw), top - L * 0.04);
  const wAbs = Math.abs(cw);
  if (side < 0) { ctx.translate(wAbs, 0); ctx.scale(-1, 1); }
  paintDesign(ctx, d, wAbs, ch + L * 0.08);
  ctx.restore();
  // folds
  ctx.save(); path(); ctx.clip();
  for (let i = 0; i < 4; i++) {
    const u = (i + 0.5) / 4, fx = cw * u, a = 0.10 + 0.05 * Math.sin(ph + i * 1.7);
    const gr = ctx.createLinearGradient(fx - Math.abs(cw) * 0.12 * side, 0, fx + Math.abs(cw) * 0.12 * side, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(0,0,0,${a * 1.6})`); gr.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = gr; ctx.fillRect(Math.min(fx - wAbs * 0.12, fx + wAbs * 0.12), top - 4, wAbs * 0.24, ch + L * 0.12);
  }
  ctx.restore();
  path(); ctx.lineWidth = Math.max(1.5, L * 0.012); ctx.strokeStyle = 'rgba(20,10,0,0.55)'; ctx.stroke();
  ctx.restore();
}

// ---- bearers ----------------------------------------------------------------------------------------------------------------------------------------
export const COSTUMES = [
  { tab: '#2557a7', trim: '#f2c14e', hoseL: '#c0262f', hoseR: '#f8f1e0', sleeve: '#c0262f', hat: '#c0262f' },
  { tab: '#c0262f', trim: '#f8f1e0', hoseL: '#2557a7', hoseR: '#f2c14e', sleeve: '#2557a7', hat: '#2557a7' },
  { tab: '#2f8a5b', trim: '#f2c14e', hoseL: '#f2c14e', hoseR: '#5b2a86', sleeve: '#f2c14e', hat: '#5b2a86' },
];
// Draws a bearer from behind. (cx, foot) = between the feet; H = height of the figure. Returns the two hand positions in canvas space.
// o: costume, hands: [{x, y}, {x, y}] offsets from (cx, foot) in units of H/100, lean (radians).
// The soft shadow on the flagstones and (for the player's own bearer) the gold ring. Shared by the 2D figure and the 3D one.
export function drawBearerGround(ctx, cx, foot, H, o = {}) {
  const u = H / 100;
  const g = ctx.createRadialGradient(cx + 4 * u, foot + 1 * u, 2 * u, cx + 4 * u, foot + 1 * u, 34 * u);
  g.addColorStop(0, 'rgba(40,24,10,0.42)'); g.addColorStop(0.6, 'rgba(40,24,10,0.2)'); g.addColorStop(1, 'rgba(40,24,10,0)');
  ctx.save(); ctx.translate(0, foot + 1 * u); ctx.scale(1, 0.2); ctx.translate(0, -(foot + 1 * u)); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx + 4 * u, foot + 1 * u, 34 * u, 0, TAU); ctx.fill(); ctx.restore();
  if (o.you) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = PAL.gold; ctx.lineWidth = Math.max(2, u * 1.6);
    ctx.beginPath(); ctx.ellipse(cx, foot + 1 * u, 26 * u, 6.2 * u, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
}
export function drawBearer(ctx, cx, foot, H, o = {}) {
  const u = H / 100, c = COSTUMES[o.costume ?? 0];
  const hands = o.hands ?? [{ x: 22, y: -100 }, { x: -20, y: -58 }];
  const lean = o.lean ?? 0;
  if (!o.noGround) drawBearerGround(ctx, cx, foot, H, o);
  ctx.save(); ctx.translate(cx, foot); ctx.rotate(lean); ctx.translate(-cx, -foot);
  const skin = '#e0a27a', skinD = '#bf8260';
  // legs (parti-coloured hose) and boots
  const leg = (x0, col, dark) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + 12 * u, 0); g.addColorStop(0, col); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx + x0 * u, foot - 46 * u); ctx.lineTo(cx + (x0 + 11.5) * u, foot - 46 * u); ctx.lineTo(cx + (x0 + 10.5) * u, foot - 7 * u); ctx.lineTo(cx + (x0 + 0.5) * u, foot - 7 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2c1a10'; ctx.beginPath(); ctx.roundRect(cx + (x0 - 1) * u, foot - 9 * u, 13.5 * u, 9 * u, [3 * u, 3 * u, 1.5 * u, 1.5 * u]); ctx.fill();
  };
  leg(-14.5, c.hoseL, mix(c.hoseL, '#000000', 0.3)); leg(3, c.hoseR, mix(c.hoseR, '#000000', 0.3));
  // tabard with a dagged hem
  const tg = ctx.createLinearGradient(cx - 20 * u, 0, cx + 20 * u, 0);
  tg.addColorStop(0, mix(c.tab, '#ffffff', 0.14)); tg.addColorStop(0.55, c.tab); tg.addColorStop(1, mix(c.tab, '#000000', 0.32));
  ctx.fillStyle = tg; ctx.beginPath();
  ctx.moveTo(cx - 17 * u, foot - 80 * u); ctx.lineTo(cx + 17 * u, foot - 80 * u); ctx.lineTo(cx + 20 * u, foot - 40 * u);
  for (let i = 0; i < 5; i++) { const x0 = cx + 20 * u - i * 8 * u; ctx.lineTo(x0 - 4 * u, foot - 32 * u); ctx.lineTo(x0 - 8 * u, foot - 40 * u); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.trim; ctx.fillRect(cx - 18.5 * u, foot - 57 * u, 37 * u, 3.2 * u);             // belt
  ctx.fillStyle = c.trim; ctx.save(); ctx.translate(cx, foot - 69 * u); star(ctx, 0, 0, 6.5 * u); ctx.restore();
  // head, seen from behind: hair, a hint of ears and neck, then the cap and its feather
  ctx.fillStyle = skinD; ctx.fillRect(cx - 4 * u, foot - 86 * u, 8 * u, 7 * u);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(cx - 8 * u, foot - 90 * u, 2.2 * u, 0, TAU); ctx.arc(cx + 8 * u, foot - 90 * u, 2.2 * u, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(cx - 3 * u, foot - 94 * u, 1 * u, cx, foot - 91 * u, 9 * u);
  hg.addColorStop(0, '#6b4528'); hg.addColorStop(1, '#2e1a0e');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, foot - 91 * u, 8.6 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = c.hat; ctx.beginPath(); ctx.ellipse(cx + 1.5 * u, foot - 98 * u, 11.5 * u, 5.4 * u, -0.14, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(cx - 2 * u, foot - 99.5 * u, 6 * u, 1.8 * u, -0.14, 0, TAU); ctx.fill();
  ctx.strokeStyle = c.trim; ctx.lineWidth = Math.max(1.5, u * 1.4); ctx.beginPath(); ctx.moveTo(cx + 3 * u, foot - 100 * u); ctx.quadraticCurveTo(cx + 15 * u, foot - 112 * u, cx + 10 * u, foot - 122 * u); ctx.stroke();
  // arms: sleeves from the shoulders to the hands, then hands
  const arm = (sx, hand) => {
    const hx = cx + hand.x * u, hy = foot + hand.y * u, sy = foot - 79 * u;
    const ex = (sx + hx) / 2 + (sx < cx ? -5 : 5) * u, ey = Math.max(sy + 8 * u, (sy + hy) / 2 + 4 * u);
    ctx.strokeStyle = mix(c.sleeve, '#000000', 0.15); ctx.lineWidth = 9.5 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
    ctx.strokeStyle = c.sleeve; ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
    // cuff, then a closed fist round the pole: palm, four finger knuckles and a thumb
    const ax = Math.atan2(hy - ey, hx - ex);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ax + Math.PI / 2);
    ctx.fillStyle = c.trim; ctx.beginPath(); ctx.roundRect(-4.6 * u, 2.2 * u, 9.2 * u, 3 * u, 1.2 * u); ctx.fill();
    const fg = ctx.createLinearGradient(-4.5 * u, 0, 4.5 * u, 0); fg.addColorStop(0, '#f1c19c'); fg.addColorStop(1, skinD);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(-4.4 * u, -5 * u, 8.8 * u, 8.4 * u, 3.2 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(90,45,20,0.5)'; ctx.lineWidth = Math.max(1, 0.7 * u);
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-4.2 * u, k * 2.4 * u - 0.6 * u); ctx.lineTo(4.2 * u, k * 2.4 * u - 0.6 * u); ctx.stroke(); }
    ctx.fillStyle = '#e8b08a'; ctx.beginPath(); ctx.ellipse(sx < cx ? 4.2 * u : -4.2 * u, -1.5 * u, 1.8 * u, 3.4 * u, 0, 0, TAU); ctx.fill();
    ctx.restore();
    return { x: hx, y: hy };
  };
  const out = [arm(cx + 17 * u, hands[0]), arm(cx - 17 * u, hands[1])];
  ctx.restore();
  return out;
}

// ---- particles ----------------------------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, colors, power = 1, kind = 'confetti') {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), sp = rng.range(80, 360) * power;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120 * power, g: 520, life: rng.range(0.6, 1.2), age: 0, size: rng.range(5, 11), col: colors[i % colors.length], rot: rng.range(0, TAU), vr: rng.range(-9, 9), kind });
  }
  if (parts.length > 220) parts.splice(0, parts.length - 220);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx *= 0.992; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = clamp01(1 - p.age / p.life);
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
    if (p.kind === 'spark') { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.5 * a + 1, 0, TAU); ctx.fill(); }
    else ctx.fillRect(-p.size / 2, -p.size * 0.28, p.size, p.size * 0.56);
    ctx.restore();
  }
}

// ---- small marks ---------------------------------------------------------------------------------------------------------------------------------------
export function drawStars(ctx, cx, cy, r, n, total = 3, a = 1) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * r * 2.3;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = i < n ? PAL.gold : 'rgba(255,255,255,0.18)'; star(ctx, x, cy, r); ctx.restore();
  }
}
export function drawRing(ctx, x, y, r, col, w = 4, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}
// The drum: a small snare drum with a flash on the beat (t = 1 on the beat, falls to 0).
export function drawDrum(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y);
  const k = 1 + t * 0.1;
  ctx.scale(k, k);
  ctx.fillStyle = '#8c2b20'; ctx.beginPath(); ctx.roundRect(-r, -r * 0.1, r * 2, r * 0.9, r * 0.12); ctx.fill();
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(-r, -r * 0.1, r * 2, r * 0.12); ctx.fillRect(-r, r * 0.68, r * 2, r * 0.12);
  ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.3, r * 0.02); ctx.lineTo(i * r * 0.3 + r * 0.15, r * 0.68); ctx.stroke(); }
  ctx.fillStyle = '#fbf1dc'; ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r, r * 0.34, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#d0b98a'; ctx.lineWidth = 2; ctx.stroke();
  if (t > 0) { ctx.fillStyle = `rgba(255,220,120,${t * 0.7})`; ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.8, r * 0.26, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#f2e8d0'; ctx.lineWidth = Math.max(2, r * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.5 - t * r * 0.3); ctx.lineTo(-r * 0.7, -r * 1.05 - t * r * 0.3); ctx.moveTo(r * 0.2, -r * 0.5 - t * r * 0.15); ctx.lineTo(r * 0.7, -r * 1.05 - t * r * 0.15); ctx.stroke();
  ctx.restore();
}
