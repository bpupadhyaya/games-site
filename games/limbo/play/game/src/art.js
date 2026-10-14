// Limbo: all the painting that is not interface. A beach at dusk: sky, sun, sea, palms, string lights, a crowd, the bar and the dancer.
// Pure canvas 2D, no DOM. Everything is a function of its arguments (and the clock the caller passes), so it is deterministic.

export const PAL = {
  ink: '#120a24', night: '#1d1038', dusk: '#4a1d5e', rose: '#c93a6e', coral: '#ff6a4d', amber: '#ffb347', gold: '#ffd873', goldHi: '#fff2c2',
  teal: '#18b7a6', tealDeep: '#0b6f73', sea: '#14486f', sand: '#e9b97a', sandDeep: '#b97a45', text: '#fff6e6', dim: 'rgba(255,246,230,0.64)',
  good: '#7fe3b0', bad: '#ff6b6b', bamboo: '#e9c46a', bambooDark: '#8a5a1c',
};
export const DISPLAY = '"Dela Gothic One", "Arial Black", Impact, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (x) => 1 - (1 - x) * (1 - x);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const mix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return `rgb(${c(16)},${c(8)},${c(0)})`; };

// The dancers' looks (party mode gives each player their own).
export const LOOKS = [
  { name: 'Coral', skin: '#8a5a3c', skinHi: '#a9744d', top: '#ff6a4d', topHi: '#ff9a7a', bottom: '#18b7a6', hair: '#1b1210', band: '#ffd873', wrap: '#e8357f' },
  { name: 'Sun', skin: '#c68a5a', skinHi: '#dfa574', top: '#ffd240', topHi: '#ffe58a', bottom: '#c93a6e', hair: '#3a2214', band: '#18b7a6', wrap: '#1fc8b4' },
  { name: 'Lagoon', skin: '#5e3b28', skinHi: '#7a5038', top: '#18b7a6', topHi: '#5fe0d0', bottom: '#fff2c2', hair: '#120c0a', band: '#ff6a4d', wrap: '#ff7a3d' },
  { name: 'Orchid', skin: '#e0b08a', skinHi: '#f2c9a6', top: '#9b6bff', topHi: '#c3a3ff', bottom: '#ffb347', hair: '#5a3418', band: '#fff2c2', wrap: '#2fb5a5' },
];

// ---- static background cache ----------------------------------------------------------------------------------------------
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

function palm(g, x, base, h, lean, s) {
  // trunk
  g.save();
  g.lineCap = 'round';
  const tx = x + lean * h, ty = base - h;
  g.strokeStyle = '#1a0b1e'; g.lineWidth = Math.max(5, h * 0.045);
  g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * h * 0.15, base - h * 0.55, tx, ty); g.stroke();
  // fronds
  g.fillStyle = '#12081c';
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.95 + (i / (n - 1)) * Math.PI * 0.9 + s * 0.2;
    const len = h * (0.36 + 0.1 * ((i * 7 + 3) % 4) / 3);
    const dx = Math.cos(a), dy = Math.sin(a);
    const ex = tx + dx * len, ey = ty + dy * len * 0.7 + len * 0.28;
    const nx = -dy, ny = dx, wdt = h * 0.045;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + dx * len * 0.55 + nx * wdt, ty + dy * len * 0.55 + ny * wdt - len * 0.12, ex, ey);
    g.quadraticCurveTo(tx + dx * len * 0.5 - nx * wdt * 0.6, ty + dy * len * 0.5 - ny * wdt * 0.6 - len * 0.04, tx, ty);
    g.fill();
  }
  g.restore();
}

function paintBackdrop(g, w, h, hor) {
  // sky
  const sky = g.createLinearGradient(0, 0, 0, hor);
  sky.addColorStop(0, '#120a2e'); sky.addColorStop(0.35, '#3a1658'); sky.addColorStop(0.62, '#b0346b'); sky.addColorStop(0.85, '#ff7a4a'); sky.addColorStop(1, '#ffc15e');
  g.fillStyle = sky; g.fillRect(0, 0, w, hor + 2);
  // faint stars in the upper sky
  g.fillStyle = 'rgba(255,240,220,0.55)';
  for (let i = 0; i < 38; i++) { const x = ((i * 977) % 1000) / 1000 * w, y = (((i * 613) % 1000) / 1000) * hor * 0.42; g.fillRect(x, y, 1.6, 1.6); }
  // far island
  g.fillStyle = '#35144a';
  g.beginPath(); g.moveTo(w * 0.05, hor + 1); g.quadraticCurveTo(w * 0.14, hor - h * 0.045, w * 0.27, hor - h * 0.012); g.quadraticCurveTo(w * 0.33, hor - h * 0.03, w * 0.42, hor + 1); g.closePath(); g.fill();
  // sea
  const sea = g.createLinearGradient(0, hor, 0, hor + (h - hor) * 0.45);
  sea.addColorStop(0, '#ff9a5a'); sea.addColorStop(0.12, '#c4467a'); sea.addColorStop(0.5, '#3b2a73'); sea.addColorStop(1, '#14315f');
  g.fillStyle = sea; g.fillRect(0, hor, w, h - hor);
}

function paintSand(g, w, h, shore, gy) {
  // wet sand line and dry sand
  const wet = g.createLinearGradient(0, shore, 0, gy);
  wet.addColorStop(0, '#6b3d5e'); wet.addColorStop(1, '#a8655a');
  g.fillStyle = wet; g.fillRect(0, shore, w, gy - shore);
  const dry = g.createLinearGradient(0, gy - 6, 0, h);
  dry.addColorStop(0, '#f3c78a'); dry.addColorStop(0.3, '#e0a468'); dry.addColorStop(1, '#a8683a');
  g.fillStyle = dry;
  g.beginPath(); g.moveTo(0, gy);
  for (let x = 0; x <= w + 20; x += 20) g.lineTo(x, gy - 10 + 5 * Math.sin(x * 0.011) + 3 * Math.sin(x * 0.037 + 1));
  g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
  // sand grain speckle
  g.fillStyle = 'rgba(90,40,20,0.18)';
  for (let i = 0; i < 160; i++) { const x = ((i * 733) % 1000) / 1000 * w, y = gy + 6 + (((i * 419) % 1000) / 1000) * (h - gy - 6); g.fillRect(x, y, 2, 1.4); }
}

// The whole scene. L = { w, h, hor (horizon y), gy (ground y of the dancer plane), U (body height in units), bx (bar x) }.
export function drawScene(ctx, L, t, o = {}) {
  const { w, h } = L, hor = Math.round(L.hor), gy = Math.round(L.gy), shore = Math.round(lerp(hor, gy, 0.52));
  stat(ctx, `bg|${Math.round(w)}x${Math.round(h)}|${hor}|${gy}`, w, h, 1, (g) => {
    paintBackdrop(g, w, h, hor);
    paintSand(g, w, h, shore, gy);
  });
  // sun and its glint on the water (animated)
  const sx = L.sunX ?? w * 0.74, sr = Math.min(w, h) * 0.085;
  const sg = ctx.createRadialGradient(sx, hor - sr * 0.1, sr * 0.2, sx, hor - sr * 0.1, sr * 3.4);
  sg.addColorStop(0, 'rgba(255,230,160,0.95)'); sg.addColorStop(0.18, 'rgba(255,170,90,0.55)'); sg.addColorStop(1, 'rgba(255,120,80,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, hor + 4);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hor); ctx.clip();
  const disc = ctx.createLinearGradient(0, hor - sr * 1.2, 0, hor + sr * 0.2);
  disc.addColorStop(0, '#fff3b8'); disc.addColorStop(1, '#ff9a4a');
  ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(sx, hor - sr * 0.1, sr, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(0, hor, w, shore - hor); ctx.clip();
  for (let i = 0; i < 12; i++) {
    const yy = hor + 4 + i * (shore - hor) / 12.5, ww = sr * (1.5 - i * 0.06) * (0.8 + 0.25 * Math.sin(t * 1.3 + i * 1.7));
    ctx.fillStyle = `rgba(255,214,140,${0.42 - i * 0.025})`; ctx.fillRect(sx - ww, yy, ww * 2, Math.max(1.5, (shore - hor) / 40));
  }
  // slow wave lines
  ctx.strokeStyle = 'rgba(255,230,200,0.14)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const yy = hor + 10 + i * (shore - hor) / 7.4; ctx.beginPath();
    for (let x = 0; x <= w; x += 24) { const y = yy + Math.sin(x * 0.02 + t * 0.8 + i) * 1.8; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  // foam at the shoreline: a soft white band that breathes
  const sw = 0.5 + 0.5 * Math.sin(t * 0.9);
  ctx.fillStyle = `rgba(255,240,230,${0.16 + 0.12 * sw})`;
  ctx.beginPath(); ctx.moveTo(0, shore);
  for (let x = 0; x <= w + 16; x += 16) ctx.lineTo(x, shore + 4 + 4 * sw + 3 * Math.sin(x * 0.03 + t));
  ctx.lineTo(w, shore - 2); ctx.lineTo(0, shore - 2); ctx.closePath(); ctx.fill();
  drawClouds(ctx, w, hor, t, o.calm);
  drawSkyLife(ctx, w, hor, t, o.calm);
  // palms at the edges (static silhouettes, a tiny sway)
  const sway = Math.sin(t * 0.7) * 0.01;
  const ph = Math.min(h * 0.42, w * 0.7);
  palm(ctx, w * 0.05, gy + 4, ph * 0.9, 0.22 + sway, 0);
  palm(ctx, w * 0.95, gy + 10, ph * 1.02, -0.2 - sway, 1);
  if ((L.floor ?? h) - gy > L.U * 0.62) drawSteelPan(ctx, w * 0.2, gy + L.U * 0.33, Math.min(L.U * 0.26, w * 0.14), t);
  if (w > h * 1.1) { palm(ctx, w * 0.2, gy - 2, ph * 0.55, 0.12 - sway, 2); palm(ctx, w * 0.88, gy - 2, ph * 0.6, -0.1 + sway, 3); }
}

// Extra life for tall screens: a thin crescent moon high in the dusk and a few seabirds drifting home (sky only).
export function drawSkyLife(ctx, w, hor, t, calm) {
  if (hor < 330) return;
  ctx.save();
  const mx = w * 0.6, my = hor * 0.3, mr = Math.min(w, hor) * 0.05;
  const g = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 3.2);
  g.addColorStop(0, 'rgba(255,240,200,0.28)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hor); ctx.arc(mx + mr * 0.45, my - mr * 0.14, mr * 0.9, 0, TAU, true); ctx.clip('evenodd');
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fillStyle = '#fff1c8'; ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(30,10,40,0.78)'; ctx.lineWidth = Math.max(2, w * 0.0035); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const sp = calm ? 0 : 14 + i * 3, x = ((i * 0.31 * w + t * sp + 40) % (w + 160)) - 80, y = hor * (0.34 + 0.09 * i) + 10 * Math.sin(t * 0.5 + i);
    const s = Math.min(w, hor) * (0.028 + 0.004 * (i % 2)), fl = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5.5 + i * 2.1);
    ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.2 * (1 + fl)); ctx.quadraticCurveTo(x - s * 0.4, y - s * (0.45 + 0.4 * fl), x, y); ctx.quadraticCurveTo(x + s * 0.4, y - s * (0.45 + 0.4 * fl), x + s, y - s * 0.2 * (1 + fl)); ctx.stroke();
  }
  ctx.restore();
}

// Soft clouds that drift across the sunset (sky only, above the horizon).
export function drawClouds(ctx, w, hor, t, calm) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, hor); ctx.clip();
  for (let i = 0; i < 5; i++) {
    const sp = calm ? 0 : 6 + i * 2.2, x = ((i * 0.37 * w + t * sp) % (w + 400)) - 200, y = hor * (0.18 + 0.13 * i % 0.62) + 20;
    const ww = 150 + (i * 53) % 120, hh = 16 + (i * 7) % 12;
    const g = ctx.createLinearGradient(0, y - hh, 0, y + hh);
    g.addColorStop(0, 'rgba(255,190,150,0.0)'); g.addColorStop(0.5, 'rgba(255,170,130,0.30)'); g.addColorStop(1, 'rgba(120,40,100,0.0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, ww, hh, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + ww * 0.45, y - hh * 0.35, ww * 0.55, hh * 0.7, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// A steel pan on its stand, a hint of the island's music in the foreground sand.
export function drawSteelPan(ctx, cx, cy, r, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(40,12,20,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.78, r * 1.05, r * 0.2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1a22'; ctx.lineWidth = Math.max(4, r * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.62, cy + r * 0.1); ctx.lineTo(cx - r * 0.9, cy + r * 0.78); ctx.moveTo(cx + r * 0.62, cy + r * 0.1); ctx.lineTo(cx + r * 0.9, cy + r * 0.78); ctx.moveTo(cx, cy + r * 0.25); ctx.lineTo(cx, cy + r * 0.8); ctx.stroke();
  // barrel side
  const sg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  sg.addColorStop(0, '#4a2c3a'); sg.addColorStop(0.45, '#c9b4a8'); sg.addColorStop(1, '#3a2230');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r, r * 0.4, 0, 0, Math.PI); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.4, 0, 0, TAU); ctx.fillStyle = '#d8c9bb'; ctx.fill();
  const fg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.1, r * 0.1, cx, cy, r);
  fg.addColorStop(0, '#fff2d8'); fg.addColorStop(0.6, '#e5a96b'); fg.addColorStop(1, '#8a4a38');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.02, r * 0.88, r * 0.33, 0, 0, TAU); ctx.fill();
  // the note pans
  ctx.strokeStyle = 'rgba(70,30,30,0.55)'; ctx.lineWidth = Math.max(1.5, r * 0.025);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3, px = cx + Math.cos(a) * r * 0.55, py = cy + Math.sin(a) * r * 0.2 + r * 0.02;
    ctx.beginPath(); ctx.ellipse(px, py, r * 0.17, r * 0.075, 0, 0, TAU); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.02, r * 0.2, r * 0.08, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

// String lights across the upper stage; twinkle from the clock.
export function drawLights(ctx, w, y0, t, calm) {
  ctx.save();
  const n = Math.max(6, Math.round(w / 70)), cols = ['#ffd873', '#ff6a4d', '#18b7a6', '#ff8fc2', '#fff2c2'];
  ctx.strokeStyle = 'rgba(20,8,30,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-10, y0 - 6);
  for (let i = 0; i <= n; i++) { const x = i * w / n; ctx.quadraticCurveTo(x - w / n / 2, y0 + 30, x, y0 - 4 + (i % 2) * 2); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * w / n, y = y0 + 24 - 2;
    const tw = calm ? 0.85 : 0.65 + 0.35 * Math.sin(t * 2.2 + i * 1.9);
    const c = cols[i % cols.length];
    const g = ctx.createRadialGradient(x, y, 1, x, y, 20);
    g.addColorStop(0, rgba(c, 0.8 * tw)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - 20, y - 20, 40, 40);
    ctx.fillStyle = rgba(c, 0.5 + 0.5 * tw); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// A few spectators on the sand behind the dancer plane; they bob and clap to the beat.
export function drawCrowd(ctx, L, t, beat, calm) {
  const n = Math.max(6, Math.round(L.w / 150)), base = L.gy - 4;
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0;
    const u = ((i * 0.6180339) % 1);
    let x = side ? L.w * (0.04 + 0.4 * u * 0.9) : L.w * (0.56 + 0.4 * u * 0.9);
    // keep the lane around the bar clear
    if (Math.abs(x - L.bx) < L.U * 0.45) x += (x < L.bx ? -1 : 1) * L.U * 0.5;
    const s = L.U * (0.2 + 0.05 * ((i * 5) % 3));
    const bob = calm ? 0 : Math.abs(Math.sin((beat + i * 0.37) * Math.PI)) * s * 0.09;
    const by = base - s * 0.07 * (i % 3) - bob;
    const col = ['#2a0f3c', '#3a1648', '#24103a'][i % 3];
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.roundRect(x - s * 0.26, by - s * 0.62, s * 0.52, s * 0.62, s * 0.2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, by - s * 0.74, s * 0.17, 0, TAU); ctx.fill();
    // raised arms when clapping
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
    const up = calm ? 0.6 : 0.5 + 0.5 * Math.sin((beat + i * 0.37) * TAU);
    ctx.beginPath(); ctx.moveTo(x - s * 0.2, by - s * 0.52); ctx.lineTo(x - s * (0.34 - 0.12 * up), by - s * (0.62 + 0.28 * up)); ctx.moveTo(x + s * 0.2, by - s * 0.52); ctx.lineTo(x + s * (0.34 - 0.12 * up), by - s * (0.62 + 0.28 * up)); ctx.stroke();
    // warm rim from the sun side
    ctx.fillStyle = 'rgba(255,170,100,0.22)'; ctx.beginPath(); ctx.arc(x + s * 0.06, by - s * 0.76, s * 0.12, -1.2, 0.9); ctx.fill();
  }
}

// ---- the bar and its two poles (seen at an angle) ------------------------------------------------------------------------
// bar: { y (height in body units), tilt, fall (0..1 animation, bar knocked off), vx }. Back pole before the dancer, front after.
export function barGeom(L, h) {
  const d = L.U * 0.3, dz = L.U * 0.09;           // sideways and vertical offset of the front/back poles
  const cx = L.bx, cy = L.gy - h * L.U;
  return {
    cx, cy,
    front: { x: cx + d, base: L.gy + dz, top: cy + dz },
    back: { x: cx - d, base: L.gy - dz, top: cy - dz },
  };
}
function pole(ctx, x, base, top, w, L) {
  const top2 = top - L.U * 0.1;
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, '#7a4a14'); g.addColorStop(0.4, '#f2d489'); g.addColorStop(1, '#8a5a1c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - w / 2, top2, w, base - top2, w * 0.4); ctx.fill();
  ctx.fillStyle = 'rgba(80,40,10,0.6)';
  const nodes = Math.max(2, Math.round((base - top2) / (L.U * 0.28)));
  for (let i = 1; i < nodes; i++) ctx.fillRect(x - w / 2, top2 + (base - top2) * i / nodes, w, Math.max(2, w * 0.12));
  // finial
  const fg = ctx.createRadialGradient(x - w * 0.15, top2 - w * 0.4, 1, x, top2 - w * 0.25, w * 0.7);
  fg.addColorStop(0, '#fff2c2'); fg.addColorStop(1, '#c9871f');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, top2 - w * 0.25, w * 0.62, 0, TAU); ctx.fill();
  // foot
  ctx.fillStyle = 'rgba(40,16,10,0.55)'; ctx.beginPath(); ctx.ellipse(x, base + 2, w * 1.3, w * 0.34, 0, 0, TAU); ctx.fill();
}
export function drawPoleBack(ctx, L, h) { const G = barGeom(L, h); pole(ctx, G.back.x, G.back.base, G.back.top, Math.max(8, L.U * 0.038), L); }
export function drawPoleFront(ctx, L, h) { const G = barGeom(L, h); pole(ctx, G.front.x, G.front.base, G.front.top, Math.max(9, L.U * 0.045), L); }

// The bar itself: a plain bamboo rod with painted bands. `fall` 0 = in place; >0 = it has been knocked off and drops.
export function drawBar(ctx, L, h, o = {}) {
  const G = barGeom(L, h), th = Math.max(6, L.U * 0.034);
  let f = G.front, b = G.back;
  ctx.save();
  if (o.fall > 0) {
    const t = o.fall, dropY = L.U * 0.55 * t * t * 3.2, dir = o.dir ?? 1, rot = dir * t * 1.5;
    const mx = (f.x + b.x) / 2 + dir * L.U * 0.2 * Math.min(1, t * 2), my = (f.top + b.top) / 2 + Math.min(dropY, L.gy - (f.top + b.top) / 2 - th);
    const hx = (b.x - f.x) / 2, hy = (b.top - f.top) / 2;
    const c = Math.cos(rot), s = Math.sin(rot);
    f = { x: mx - (hx * c - hy * s), top: my - (hx * s + hy * c) }; b = { x: mx + (hx * c - hy * s), top: my + (hx * s + hy * c) };
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(30,10,20,0.35)'; ctx.lineWidth = th + 3; ctx.beginPath(); ctx.moveTo(f.x, f.top + 3); ctx.lineTo(b.x, b.top + 3); ctx.stroke();
  const len = Math.hypot(b.x - f.x, b.top - f.top), dash = Math.max(10, len / 10);
  ctx.strokeStyle = '#f7e2a3'; ctx.lineWidth = th; ctx.beginPath(); ctx.moveTo(f.x, f.top); ctx.lineTo(b.x, b.top); ctx.stroke();
  ctx.setLineDash([dash * 0.5, dash * 1.5]); ctx.lineCap = 'butt';
  ctx.strokeStyle = '#18b7a6'; ctx.lineWidth = th; ctx.beginPath(); ctx.moveTo(f.x + dash * 0.25, f.top); ctx.lineTo(b.x, b.top); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1.5, th * 0.22);
  ctx.beginPath(); ctx.moveTo(f.x, f.top - th * 0.22); ctx.lineTo(b.x, b.top - th * 0.22); ctx.stroke();
  if (o.glow) {
    ctx.strokeStyle = rgba('#ffd873', 0.35 * o.glow); ctx.lineWidth = th * 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.x, f.top); ctx.lineTo(b.x, b.top); ctx.stroke();
  }
  ctx.restore();
}

// ---- the dancer -----------------------------------------------------------------------------------------------------------
function capsule(ctx, a, b, r1, r2) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, an = Math.atan2(ny, nx);
  ctx.beginPath(); ctx.moveTo(a.x + nx * r1, a.y + ny * r1); ctx.lineTo(b.x + nx * r2, b.y + ny * r2);
  ctx.arc(b.x, b.y, r2, an, an - Math.PI, true); ctx.lineTo(a.x - nx * r1, a.y - ny * r1); ctx.arc(a.x, a.y, r1, an + Math.PI, an, true); ctx.closePath();
}
// A jointed limb (2 or 3 points, widths per point): one soft outline under the whole chain, then the fill, so joints read as one
// smooth shape instead of stacked capsules; a thin highlight runs along the lit side.
function chain(ctx, pts, ws, col, hi) {
  ctx.fillStyle = 'rgba(28,8,24,0.55)';
  for (let i = 0; i < pts.length - 1; i++) { capsule(ctx, pts[i], pts[i + 1], ws[i] / 2 + 2.2, ws[i + 1] / 2 + 2.2); ctx.fill(); }
  ctx.fillStyle = col;
  for (let i = 0; i < pts.length - 1; i++) { capsule(ctx, pts[i], pts[i + 1], ws[i] / 2, ws[i + 1] / 2); ctx.fill(); }
  if (false && hi) {
    ctx.strokeStyle = hi; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, Math.min(...ws) * 0.34);
    ctx.beginPath();
    pts.forEach((q, i) => { const j = Math.min(i, pts.length - 2), dx = pts[j + 1].x - pts[j].x, dy = pts[j + 1].y - pts[j].y, d = Math.hypot(dx, dy) || 1; const s = -ws[i] * 0.22; const x = q.x + (dy / d) * s, y = q.y - (dx / d) * s; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  }
}


// The same joints drawDancer paints, as points in body-height units (x forward, y up, origin between the feet) after the fall rotation, sit drop
// and cheer arms: the 3D dancer (view3d/dancer.js) is driven from these so both pictures show the identical pose.
export function dancerJoints(p, o = {}) {
  const ang = o.ang ?? 0, sit = o.sit ?? 0, cheer = o.cheer ?? 0, bob = p.bob || 0, dn = sit * 0.18;
  const P = (q) => ({ x: q.x, y: q.y + bob - dn }), F = (q) => ({ x: q.x, y: q.y - dn });
  const hip = P(p.hip), sh = P(p.sh), neck = P(p.neck), head = P(p.head);
  const J = { hip, sh, neck, head, hr: p.head.r, nK: P(p.near.knee), nA: F(p.near.ankle), fK: P(p.far.knee), fA: F(p.far.ankle),
    mid: p.mid ? P(p.mid) : { x: (hip.x + sh.x) / 2, y: (hip.y + sh.y) / 2 },
    fE: P(p.armF.elbow), fH: P(p.armF.hand), nE: P(p.armN.elbow), nH: P(p.armN.hand) };
  if (cheer > 0) {
    const l = (a, b) => ({ x: a.x + (b.x - a.x) * cheer, y: a.y + (b.y - a.y) * cheer });
    J.fE = l(J.fE, { x: sh.x + 0.1, y: sh.y + 0.14 }); J.fH = l(J.fH, { x: sh.x + 0.14, y: sh.y + 0.62 });
    J.nE = l(J.nE, { x: sh.x + 0.15, y: sh.y + 0.12 }); J.nH = l(J.nH, { x: sh.x + 0.26, y: sh.y + 0.6 });
  }
  if (ang) {                                              // rotate about the feet; + tips the body forward (clockwise, y up)
    const c = Math.cos(ang), s2 = Math.sin(ang);
    for (const k of Object.keys(J)) { const q = J[k]; if (q && typeof q === 'object') { const x = q.x * c + q.y * s2, y = -q.x * s2 + q.y * c; q.x = x; q.y = y; } }
  }
  J.ang = ang;
  return J;
}

// The soft contact shadow alone (the 3D dancer has none of its own on the 2D beach).
export function drawDancerShadow(ctx, p, fx, fy, U, ang = 0) {
  ctx.save(); ctx.fillStyle = 'rgba(30,8,24,0.38)';
  ctx.beginPath(); ctx.ellipse(fx + (p.hip.x * 0.4) * U, fy + U * 0.012, U * (0.2 + 0.1 * p.lean + Math.abs(ang) * 0.2), U * 0.04, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// pose from engine.pose(); (fx, fy) = screen position of the feet origin; U = units per body height.
// o: { look, ang (rotation about the feet, radians, + = tipping forward), sit (0..1 lowering when fallen), cheer (0..1 arms up) }
export function drawDancer(ctx, p, fx, fy, U, o = {}) {
  const look = o.look ?? LOOKS[0];
  const ang = o.ang ?? 0, sit = o.sit ?? 0, cheer = o.cheer ?? 0;
  ctx.save();
  ctx.fillStyle = 'rgba(30,8,24,0.38)';                      // soft contact shadow
  ctx.beginPath(); ctx.ellipse(fx + (p.hip.x * 0.4) * U, fy + U * 0.012, U * (0.2 + 0.1 * p.lean + Math.abs(ang) * 0.2), U * 0.04, 0, 0, TAU); ctx.fill();
  ctx.translate(fx, fy); ctx.rotate(ang);
  const P = (q) => ({ x: q.x * U, y: -(q.y + (p.bob || 0)) * U - sit * U * 0.18 });
  const F = (q) => ({ x: q.x * U, y: -q.y * U - sit * U * 0.18 });
  const hip = P(p.hip), sh = P(p.sh), neck = P(p.neck), hd = P(p.head), hr = p.head.r * U;
  const nK = P(p.near.knee), nA = F(p.near.ankle), fK = P(p.far.knee), fA = F(p.far.ankle), mid = p.mid ? P(p.mid) : { x: (hip.x + sh.x) / 2, y: (hip.y + sh.y) / 2 };
  const lw = U * 0.088, armW = U * 0.058, shade = mix(look.skin, '#000000', 0.2), topShade = mix(look.top, '#000000', 0.18);
  const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const foot = (a, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(a.x + U * 0.035, a.y + U * 0.006, U * 0.066, U * 0.024, 0, 0, TAU); ctx.fill(); };
  let fE = P(p.armF.elbow), fH = P(p.armF.hand), nE = P(p.armN.elbow), nH = P(p.armN.hand);
  if (cheer > 0) {
    const k = cheer;
    fE = lerpP(fE, { x: sh.x + U * 0.1, y: sh.y - U * 0.14 }, k); fH = lerpP(fH, { x: sh.x + U * 0.14, y: sh.y - U * 0.62 }, k);
    nE = lerpP(nE, { x: sh.x + U * 0.15, y: sh.y - U * 0.12 }, k); nH = lerpP(nH, { x: sh.x + U * 0.26, y: sh.y - U * 0.6 }, k);
  }
  // far side first (darker), then torso, then near side
  chain(ctx, [sh, fE, fH], [armW * 1.05, armW * 0.85, armW * 0.66], shade);
  chain(ctx, [hip, fK, fA], [lw * 1.12, lw * 0.82, lw * 0.56], shade);
  foot(fA, shade);
  chain(ctx, [hip, nK, nA], [lw * 1.12, lw * 0.82, lw * 0.56], look.skin);
  foot(nA, look.skin);
  // shorts over the tops of the thighs
  chain(ctx, [hip, lerpP(hip, nK, 0.5)], [lw * 1.45, lw * 1.28], look.bottom);
  chain(ctx, [hip, lerpP(hip, fK, 0.42)], [lw * 1.2, lw * 1.1], mix(look.bottom, '#000000', 0.15));
  // neck, then the torso as one smooth tapered shape
  chain(ctx, [sh, neck], [U * 0.055, U * 0.05], look.skin);
  chain(ctx, [hip, mid, sh], [U * 0.15, U * 0.14, U * 0.165], look.top);
  ctx.save();
  ctx.strokeStyle = look.topHi; ctx.globalAlpha = 0.55; ctx.lineCap = 'round'; ctx.lineWidth = U * 0.05;
  const tdx = sh.x - hip.x, tdy = sh.y - hip.y, tl = Math.hypot(tdx, tdy) || 1, nx = -tdy / tl, ny = tdx / tl, off = U * 0.035;
  ctx.beginPath(); ctx.moveTo(hip.x + nx * off * 1.4 + (sh.x - hip.x) * 0.14, hip.y + ny * off * 1.4 + (sh.y - hip.y) * 0.14); ctx.quadraticCurveTo(mid.x + nx * off * 1.4, mid.y + ny * off * 1.4, sh.x + nx * off - (sh.x - hip.x) * 0.1, sh.y + ny * off - (sh.y - hip.y) * 0.1); ctx.stroke();
  ctx.restore();
  // head: ponytail behind, face turned right
  const ha = Math.atan2(hd.y - neck.y, hd.x - neck.x);
  ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate((ha + Math.PI / 2) * 0.5); ctx.translate(-hd.x, -hd.y);   // the face keeps looking at the bar
  ctx.strokeStyle = look.hair; ctx.lineCap = 'round'; ctx.lineWidth = U * 0.045;
  ctx.beginPath(); ctx.moveTo(hd.x - Math.cos(ha) * hr * 0.2 - hr * 0.5, hd.y); ctx.quadraticCurveTo(hd.x - hr * 1.5, hd.y + hr * 0.2 - Math.sin(ha) * hr * 0.2, hd.x - hr * 1.7, hd.y + hr * 1.1); ctx.stroke();
  const hg = ctx.createRadialGradient(hd.x + hr * 0.2, hd.y - hr * 0.3, 1, hd.x, hd.y, hr * 1.1);
  hg.addColorStop(0, look.skinHi); hg.addColorStop(1, look.skin);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hd.x, hd.y, hr, 0, TAU); ctx.fill();
  ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(hd.x, hd.y, hr * 1.04, Math.PI * 0.62, Math.PI * 1.9); ctx.lineTo(hd.x, hd.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = look.band; ctx.lineWidth = hr * 0.26; ctx.beginPath(); ctx.arc(hd.x, hd.y, hr * 0.95, Math.PI * 1.15, Math.PI * 1.7); ctx.stroke();
  ctx.fillStyle = '#20100c'; ctx.beginPath(); ctx.arc(hd.x + hr * 0.42, hd.y - hr * 0.08, hr * 0.12, 0, TAU); ctx.fill();
  ctx.strokeStyle = shade; ctx.lineWidth = Math.max(1.5, hr * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(hd.x + hr * 0.9, hd.y + hr * 0.02); ctx.lineTo(hd.x + hr * 1.06, hd.y + hr * 0.2); ctx.lineTo(hd.x + hr * 0.88, hd.y + hr * 0.26); ctx.stroke();
  ctx.strokeStyle = '#7a2a22'; ctx.beginPath();
  if (cheer > 0.2 || (p.lean > 0.5 && !cheer)) ctx.arc(hd.x + hr * 0.45, hd.y + hr * 0.38, hr * 0.26, 0.1, Math.PI - 0.1); else { ctx.moveTo(hd.x + hr * 0.3, hd.y + hr * 0.52); ctx.lineTo(hd.x + hr * 0.62, hd.y + hr * 0.5); }
  ctx.stroke();
  ctx.restore();
  // near arm over the torso, with the sleeve on its upper half
  chain(ctx, [sh, nE, nH], [armW * 1.05, armW * 0.85, armW * 0.66], look.skin);
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(nH.x, nH.y, armW * 0.62, 0, TAU); ctx.fill();
  const sl = lerpP(sh, nE, 0.5);
  ctx.fillStyle = look.top; capsule(ctx, sh, sl, armW * 0.66, armW * 0.55); ctx.fill();
  ctx.restore();
}

// ---- particles and small effects --------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, kind, n, speed, col, size) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = speed * rng.range(0.4, 1) * 260;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'confetti' ? 220 : 90), life: rng.range(0.5, 1.1), age: 0, kind, col: Array.isArray(col) ? col[rng.int(col.length)] : col, size: size * rng.range(0.6, 1.1), rot: rng.range(0, TAU), vr: rng.range(-9, 9) });
  }
}
export function stepParticles(parts, dt) {
  for (const p of parts) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.kind === 'puff' ? 40 : 700) * dt; p.vx *= p.kind === 'confetti' ? 0.985 : 0.99; p.rot += p.vr * dt;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = 1 - p.age / p.life;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
    if (p.kind === 'puff') { ctx.beginPath(); ctx.arc(0, 0, p.size * (1.2 - a * 0.4), 0, TAU); ctx.fill(); }
    else if (p.kind === 'confetti') { ctx.fillRect(-p.size * 0.6, -p.size * 0.25, p.size * 1.2, p.size * 0.5); }
    else { ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.5, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.5, 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}

// A row of stars (0..n filled).
export function drawStars(ctx, cx, cy, size, n, total = 3, a = 1) {
  const gap = size * 1.25;
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * gap, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.globalAlpha = on ? a : 0.28;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.22 : size * 0.52, an = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
    ctx.closePath(); ctx.fillStyle = on ? '#ffd873' : '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = on ? '#b8761c' : 'rgba(255,255,255,0.3)'; ctx.stroke();
    ctx.restore();
  }
}
