// Everything that is painted: palette, the village square, the linen sash and its cross-stitches, the three pads, the dancers of the horo.
// Pure canvas drawing (no DOM). All positions are in virtual units.

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Cinzel", "Iowan Old Style", Georgia, serif';
export const PAL = {
  night: '#1a0a14', wall: '#2d1410', earth: '#2a140e', dusk: '#4a1a2c', ember: '#b4452e', glow: '#ffb060',
  linen: '#f6e8c9', linenLo: '#e2cb9c', linenDk: '#b79a63', weave: '#8a6a3a',
  red: '#c3202c', redHi: '#ee4a3e', redLo: '#6e0c18', black: '#17110f', ink: '#241410',
  gold: '#f2b632', goldHi: '#ffe08a', goldLo: '#9a6a10', green: '#2f9e55', greenHi: '#68dc8e', greenLo: '#14502a',
  text: '#fff4e0', dim: '#d6c0a4', cream: '#ffeccb',
  // names used by the shared interface helpers
  teal: '#68dc8e', amber: '#f2b632', miss: '#ff7d8f', lav: '#caa8ff',
};
export const KIND_COL = { drum: '#e4413a', clap: '#f2b632', step: '#3fbf70' };
export const KIND_HI = { drum: '#ff8a72', clap: '#ffe08a', step: '#9af0b4' };
export const KIND_LO = { drum: '#7a0f1c', clap: '#9a6a10', step: '#14502a' };
export const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const TAU = Math.PI * 2;
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const ease = (x) => 1 - (1 - clamp01(x)) ** 3;
export const lerp = (a, b, k) => a + (b - a) * k;
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// ---- the village square at dusk -----------------------------------------------------------------------------------------------------
const STARS = Array.from({ length: 40 }, (_, i) => { const a = Math.sin(i * 91.7) * 43758.5, b = Math.sin(i * 12.9) * 24634.6; return { x: a - Math.floor(a), y: b - Math.floor(b), p: i * 0.7, s: 0.6 + ((i * 37) % 10) / 10 }; });
const HOUSES = Array.from({ length: 12 }, (_, i) => { const a = Math.sin(i * 7.31) * 9301.7; const f = a - Math.floor(a); return { x: i / 11, w: 0.08 + f * 0.05, h: 0.5 + ((i * 53) % 10) / 20, roof: i % 3, win: (i * 5) % 4 }; });

export function drawBackground(ctx, w, h, t, o = {}) {
  const flow = o.flow ?? 0.3, hz = o.hz ?? h * 0.5;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#1a0a1c'); sky.addColorStop(0.5, PAL.dusk); sky.addColorStop(0.85, '#8a3a34'); sky.addColorStop(1, PAL.ember);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz + 1);
  for (const s of STARS) {
    const y = s.y * hz * 0.55, a = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p))) * (1 - y / (hz * 0.7));
    ctx.fillStyle = `rgba(255,240,220,${Math.max(0, a)})`; ctx.fillRect(s.x * w, y, s.s * 2, s.s * 2);
  }
  // the moon: a plain round disc with a soft halo
  const mx = w * 0.9, my = hz * 0.36, mr = Math.min(w, h) * 0.034;
  const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
  halo.addColorStop(0, 'rgba(255,236,190,0.45)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = halo; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
  ctx.fillStyle = '#fff1cf'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  // hills and the village
  ctx.fillStyle = '#2a1018'; ctx.beginPath(); ctx.moveTo(0, hz);
  for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, hz - 18 - 22 * Math.sin(x * 0.006 + 1.2) - 12 * Math.sin(x * 0.017));
  ctx.lineTo(w, hz + 2); ctx.lineTo(0, hz + 2); ctx.closePath(); ctx.fill();
  const unit = Math.min(w * 0.11, hz * 0.2, 118);
  HOUSES.forEach((hs, i) => {
    const bw = unit * (0.85 + hs.w * 4), bh = unit * (0.7 + hs.h * 0.6), x = hs.x * (w - bw * 0.6) - bw * 0.1, y = hz + 2 - bh;
    ctx.fillStyle = i % 2 ? '#e8d6b4' : '#d4bd96'; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = 'rgba(40,12,10,0.38)'; ctx.fillRect(x + bw * 0.78, y, bw * 0.22, bh);
    ctx.fillStyle = hs.roof === 0 ? '#9a3a22' : hs.roof === 1 ? '#7a2a1c' : '#b04a2a';
    ctx.beginPath(); ctx.moveTo(x - bw * 0.06, y + 1); ctx.lineTo(x + bw * 0.5, y - bh * 0.42); ctx.lineTo(x + bw * 1.06, y + 1); ctx.closePath(); ctx.fill();
    const lit = (i * 0.083 + 0.04) < 0.2 + flow * 0.95;
    for (let k = 0; k < 2; k++) {
      const wx = x + bw * (0.18 + k * 0.42), wy = y + bh * 0.3, ww = bw * 0.2, wh = bh * 0.28;
      ctx.fillStyle = lit && ((i + k) % 3 !== 0) ? `rgba(255,${190 + (i * 11) % 40},90,${0.85 + 0.1 * Math.sin(t * 2 + i)})` : '#3a2224';
      ctx.fillRect(wx, wy, ww, wh);
    }
  });
  // poplars
  ctx.fillStyle = '#160a0e';
  [0.03, 0.31, 0.64, 0.95].forEach((fx, i) => { const x = fx * w, th = unit * (1.7 + (i % 2) * 0.5); ctx.beginPath(); ctx.ellipse(x, hz - th * 0.42 + 4, unit * 0.11, th * 0.5, 0, 0, TAU); ctx.fill(); });
  // the square: dark earth, a warm lamp-lit pool and a few cobbles
  const g = ctx.createLinearGradient(0, hz, 0, h);
  g.addColorStop(0, '#3a1a12'); g.addColorStop(0.5, PAL.earth); g.addColorStop(1, '#170a08');
  ctx.fillStyle = g; ctx.fillRect(0, hz, w, h - hz);
  const pool = ctx.createRadialGradient(w / 2, hz + (h - hz) * 0.32, 10, w / 2, hz + (h - hz) * 0.32, w * 0.6);
  pool.addColorStop(0, `rgba(255,170,80,${0.24 + flow * 0.12})`); pool.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = pool; ctx.fillRect(0, hz, w, h - hz);
  ctx.fillStyle = 'rgba(255,225,170,0.07)';
  for (let i = 0; i < 38; i++) {
    const a = Math.sin(i * 12.7) * 4375.9, b = Math.sin(i * 3.3) * 9711.3, fx = a - Math.floor(a), fy = b - Math.floor(b);
    const y = hz + 8 + fy * (h - hz - 12), k = 0.4 + (y - hz) / (h - hz);
    ctx.beginPath(); ctx.ellipse(fx * w, y, 16 * k, 6 * k, 0, 0, TAU); ctx.fill();
  }
  // bunting: a swag of folk-coloured pennants along the top
  const cols = ['#c3202c', '#f2b632', '#f6e8c9', '#2f9e55'];
  ctx.save(); ctx.globalAlpha = 0.5;
  for (let k = 0; k < 1; k++) {
    const y0 = 4 + k * 18, sag = 18 + k * 12, n = 18;
    ctx.strokeStyle = 'rgba(30,12,10,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, y0); ctx.quadraticCurveTo(w / 2, y0 + sag * 2, w + 10, y0); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = -10 + (w + 20) * u, y = y0 + 2 * sag * u * (1 - u) * 2 * 0.5 * 2;
      const sw = Math.sin(t * 1.4 + i * 0.9 + k) * 2;
      ctx.fillStyle = cols[(i + k) % 4]; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.lineTo(x + sw, y + 15); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  const vg = ctx.createLinearGradient(0, h * 0.7, 0, h); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,2,2,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

// ---- embroidery ---------------------------------------------------------------------------------------------------------------------
// A row of small cross-stitch diamonds, the typical folk border.
export function stitchBorder(ctx, x, y, w, h, col = PAL.red, alt = PAL.black) {
  const n = Math.max(2, Math.floor(w / (h * 1.6))), step = w / n;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const cx = x + step * (i + 0.5), cy = y + h / 2, r = h * 0.46;
    ctx.fillStyle = i % 2 ? alt : col;
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// The sash cloth: linen with woven lines and a stitched red border top and bottom.
export function drawCloth(ctx, r, o = {}) {
  const rad = o.rad ?? 22, band = Math.max(10, Math.min(22, r.h * 0.07));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, r.x, r.y + 5, r.w, r.h, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#fbf0d6'); g.addColorStop(1, PAL.linenLo);
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip();
  ctx.strokeStyle = 'rgba(120,84,40,0.07)'; ctx.lineWidth = 1;
  for (let x = r.x + 7; x < r.x + r.w; x += 9) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
  for (let y = r.y + 7; y < r.y + r.h; y += 9) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
  ctx.fillStyle = PAL.red; ctx.fillRect(r.x, r.y, r.w, band); ctx.fillRect(r.x, r.y + r.h - band, r.w, band);
  ctx.fillStyle = PAL.black; ctx.fillRect(r.x, r.y + band, r.w, 3); ctx.fillRect(r.x, r.y + r.h - band - 3, r.w, 3);
  stitchBorder(ctx, r.x + 6, r.y + 1, r.w - 12, band - 2, '#f6e8c9', '#f2b632');
  stitchBorder(ctx, r.x + 6, r.y + r.h - band + 1, r.w - 12, band - 2, '#f6e8c9', '#f2b632');
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,20,10,0.55)'; ctx.lineWidth = 2; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.stroke();
  ctx.restore();
  return band;
}

// ---- symbols ------------------------------------------------------------------------------------------------------------------------
// The three kinds of cell: drum (red disc), clap (gold burst with two palms), step (green boot print).
export function drawSymbol(ctx, kind, cx, cy, r, o = {}) {
  const glow = o.glow ?? 0, a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha *= a;
  if (glow > 0.01) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * (1.9 + glow * 0.5));
    g.addColorStop(0, rgba(KIND_HI[kind], 0.55 * glow)); g.addColorStop(1, rgba(KIND_HI[kind], 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, TAU); ctx.fill();
  }
  const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.05);
  body.addColorStop(0, KIND_HI[kind]); body.addColorStop(0.55, KIND_COL[kind]); body.addColorStop(1, KIND_LO[kind]);
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(20,6,6,0.75)'; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'drum') {
    ctx.strokeStyle = 'rgba(255,236,200,0.9)'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,236,200,0.95)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.2, 0, TAU); ctx.fill();
  } else if (kind === 'clap') {
    ctx.fillStyle = '#3a1a06';
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(cx + s * r * 0.13, cy + r * 0.14); ctx.rotate(-s * 0.32); ctx.beginPath(); ctx.roundRect(-r * 0.15, -r * 0.42, r * 0.3, r * 0.84, r * 0.15); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = r * 0.09;
    for (const an of [-0.95, -0.5, 0, 0.5, 0.95]) { ctx.beginPath(); ctx.moveTo(cx + Math.sin(an) * r * 0.55, cy - r * 0.42 - Math.cos(an) * r * 0.1); ctx.lineTo(cx + Math.sin(an) * r * 0.78, cy - r * 0.42 - Math.cos(an) * r * 0.3); ctx.stroke(); }
  } else {
    // a footprint: ball, heel and five toes
    ctx.fillStyle = '#eafff0';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.02, cy - r * 0.06, r * 0.27, r * 0.33, -0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.03, cy + r * 0.4, r * 0.17, r * 0.17, 0, 0, TAU); ctx.fill();
    [[-0.3, -0.5, 0.08], [-0.16, -0.62, 0.075], [0, -0.66, 0.07], [0.15, -0.62, 0.065], [0.28, -0.52, 0.06]].forEach(([dx, dy, rr0]) => { ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, rr0 * r, 0, TAU); ctx.fill(); });
  }
  ctx.restore();
}

// A stitch for a judged cell: a full cross for perfect and great, one diagonal for good, a dot for off, a faint gap for a miss.
export function drawStitch(ctx, cx, cy, s, grade, kind, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
  const col = KIND_COL[kind] ?? PAL.red, d = s * 0.34;
  if (grade === 'miss') {
    ctx.strokeStyle = 'rgba(90,60,30,0.38)'; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.setLineDash([s * 0.12, s * 0.12]);
    ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke(); ctx.setLineDash([]);
  } else if (grade === 'off') {
    ctx.fillStyle = 'rgba(170,110,230,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.14, 0, TAU); ctx.fill();
  } else {
    const w = s * (grade === 'good' ? 0.14 : 0.2);
    ctx.strokeStyle = 'rgba(30,8,6,0.6)'; ctx.lineWidth = w + 2.5;
    ctx.beginPath(); ctx.moveTo(cx - d, cy + d); ctx.lineTo(cx + d, cy - d); if (grade !== 'good') { ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); } ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(cx - d, cy + d); ctx.lineTo(cx + d, cy - d); if (grade !== 'good') { ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); } ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = w * 0.3;
    ctx.beginPath(); ctx.moveTo(cx - d * 0.8, cy + d * 0.7); ctx.lineTo(cx + d * 0.7, cy - d * 0.8); ctx.stroke();
    if (grade === 'perfect') { ctx.fillStyle = PAL.goldHi; ctx.beginPath(); ctx.arc(cx, cy, s * 0.07, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// The needle and its thread, drawn down through a row at x.
export function drawNeedle(ctx, x, y0, y1, o = {}) {
  const a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
  const g = ctx.createLinearGradient(x, y0, x, y1);
  g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(1, 'rgba(255,200,90,0.35)');
  ctx.strokeStyle = 'rgba(60,20,8,0.5)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  ctx.strokeStyle = g; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  // the needle itself: a slim silver lozenge with an eye, pointing down
  ctx.translate(x, y0 - 4); ctx.rotate(0.0);
  const nl = o.size ?? 26;
  const ng = ctx.createLinearGradient(-4, 0, 4, 0); ng.addColorStop(0, '#9aa3ad'); ng.addColorStop(0.5, '#fafcff'); ng.addColorStop(1, '#8c949c');
  ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(0, nl * 0.55); ctx.quadraticCurveTo(5.5, nl * 0.1, 3.5, -nl * 0.5); ctx.lineTo(-3.5, -nl * 0.5); ctx.quadraticCurveTo(-5.5, nl * 0.1, 0, nl * 0.55); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,20,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#3a1a10'; ctx.beginPath(); ctx.ellipse(0, -nl * 0.32, 1.7, 4.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- pads ---------------------------------------------------------------------------------------------------------------------------
// o: { hit (0..1), glow (0..1), t }
export function drawPad(ctx, r, kind, o = {}) {
  const hit = o.hit ?? 0, glow = o.glow ?? 0, t = o.t ?? 0, rad = Math.min(30, r.h * 0.2);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(ctx, r.x, r.y + 6, r.w, r.h, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, KIND_COL[kind]); g.addColorStop(1, KIND_LO[kind]);
  ctx.fillStyle = g; rr(ctx, r.x, r.y + hit * 4, r.w, r.h, rad); ctx.fill();
  if (hit > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * hit})`; rr(ctx, r.x, r.y + hit * 4, r.w, r.h, rad); ctx.fill(); }
  ctx.save(); rr(ctx, r.x, r.y + hit * 4, r.w, r.h, rad); ctx.clip();
  const sh = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, r.h * 0.5);
  stitchBorder(ctx, r.x + 8, r.y + r.h - 18, r.w - 16, 14, 'rgba(255,240,210,0.55)', 'rgba(20,6,6,0.5)');
  ctx.restore();
  ctx.lineWidth = 3 + glow * 4; ctx.strokeStyle = glow > 0.02 ? `rgba(255,244,200,${0.45 + 0.5 * glow})` : 'rgba(255,230,200,0.35)';
  rr(ctx, r.x, r.y + hit * 4, r.w, r.h, rad); ctx.stroke();
  const cx = r.x + r.w / 2, cy = r.y + r.h * 0.46 + hit * 4, ir = Math.min(r.h * 0.3, r.w * 0.3) * (1 + hit * 0.1);
  drawSymbol(ctx, kind, cx, cy, ir, { glow: glow * 0.8 + 0.12 * (0.5 + 0.5 * Math.sin(t * 3)) * (glow > 0 ? 1 : 0) });
  ctx.restore();
}

// ---- dancers ------------------------------------------------------------------------------------------------------------------------
export const COSTUMES = [
  { f: true, skirt: '#b3202c', apron: '#17110f', top: '#fff4de', scarf: '#c3202c', trim: '#f2b632', hair: '#3a1c10', skin: '#f2c9a0' },
  { f: false, trousers: '#1c1a1f', top: '#fff4de', sash: '#c3202c', vest: '#3a2418', hat: '#17110f', hair: '#2a1a10', skin: '#e8b88c' },
  { f: true, skirt: '#17110f', apron: '#c3202c', top: '#fff4de', scarf: '#f6e8c9', trim: '#c3202c', hair: '#6a3a1a', skin: '#f4d2ac' },
  { f: false, trousers: '#3a2a22', top: '#f6e8c9', sash: '#2f9e55', vest: '#7a1a20', hat: '#4a3020', hair: '#1c120c', skin: '#dfae82' },
  { f: true, skirt: '#2f6b3f', apron: '#f6e8c9', top: '#fff4de', scarf: '#f2b632', trim: '#c3202c', hair: '#201008', skin: '#efc29a' },
  { f: false, trousers: '#17110f', top: '#fff4de', sash: '#f2b632', vest: '#17110f', hat: '#241410', hair: '#3a2210', skin: '#ebbf94' },
];

// One dancer, feet at (x, y). o: { bounce 0..1, lift 0..1, foot -1/1, sway -1..1, armL: [dx,dy] hand reach left, armR, free: 'left'|'right'|null }
export function drawDancer(ctx, x, y, s, idx, o = {}) {
  const C = COSTUMES[idx % COSTUMES.length], bounce = o.bounce ?? 0, lift = o.lift ?? 0, foot = o.foot ?? 1, sway = o.sway ?? 0;
  const hop = bounce * 7 * s;
  ctx.save(); ctx.translate(x, y - hop); ctx.scale(s, s);
  const k = 1 / 1;
  // shadow stays on the ground
  ctx.save(); ctx.translate(0, hop / s); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(0, 1, 30 - hop * 0.2, 7, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs
  const leg = (sgn, up) => {
    const hx = sgn * 8, hy = -74, fx = sgn * (10 + up * 6) + sway * 2, fy = -4 - up * 22;
    const col = C.f ? '#efe2c6' : C.trousers;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + sgn * 3, (hy + fy) / 2 - up * 6, fx, fy); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 11.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + sgn * 3, (hy + fy) / 2 - up * 6, fx, fy); ctx.stroke();
    // leather shoe with a turned tip
    ctx.fillStyle = '#4a2814'; ctx.beginPath(); ctx.ellipse(fx + sgn * 3, fy + 3, 11, 5.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a3a1c'; ctx.beginPath(); ctx.ellipse(fx + sgn * 4, fy + 1.4, 8, 2.4, 0, 0, TAU); ctx.fill();
  };
  leg(-1, foot < 0 ? lift : lift * 0.15); leg(1, foot > 0 ? lift : lift * 0.15);
  // skirt / trousers hem
  const wy = -90;
  if (C.f) {
    ctx.fillStyle = C.skirt; ctx.beginPath(); ctx.moveTo(-17, wy); ctx.lineTo(17, wy); ctx.lineTo(30 + sway * 3, -36); ctx.quadraticCurveTo(0, -30, -30 + sway * 3, -36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.moveTo(6, wy); ctx.lineTo(17, wy); ctx.lineTo(30 + sway * 3, -36); ctx.lineTo(12, -34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.apron; ctx.beginPath(); ctx.moveTo(-10, wy); ctx.lineTo(10, wy); ctx.lineTo(15 + sway * 2, -42); ctx.lineTo(-15 + sway * 2, -42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.trim;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 5.6 + sway * 2, -48, 1.8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C.trim; ctx.fillRect(-30 + sway * 3, -40, 60, 3);
  } else {
    ctx.fillStyle = C.trousers; ctx.beginPath(); ctx.moveTo(-17, wy); ctx.lineTo(17, wy); ctx.lineTo(19, -50); ctx.lineTo(-19, -50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(-2, wy, 4, 40);
  }
  // torso
  ctx.fillStyle = C.top; ctx.beginPath(); ctx.moveTo(-15, -128); ctx.quadraticCurveTo(0, -134, 15, -128); ctx.lineTo(17, wy); ctx.lineTo(-17, wy); ctx.closePath(); ctx.fill();
  if (C.f) { ctx.fillStyle = C.trim; ctx.fillRect(-17, wy - 3, 34, 4); ctx.fillStyle = C.skirt; ctx.fillRect(-4, -126, 8, 30); }
  else {
    ctx.fillStyle = C.vest; ctx.beginPath(); ctx.moveTo(-15, -127); ctx.lineTo(-5, -127); ctx.lineTo(-4, wy + 2); ctx.lineTo(-17, wy + 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(15, -127); ctx.lineTo(5, -127); ctx.lineTo(4, wy + 2); ctx.lineTo(17, wy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.sash; ctx.fillRect(-18, wy - 3, 36, 8);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-15, -126, 5, 34);
  // arms: out to the neighbours' hands, held at the belt
  const arm = (sgn, reach, free) => {
    const sx = sgn * 15, sy = -123;
    ctx.strokeStyle = C.top; ctx.lineWidth = 8;
    if (free) {
      const ex = sgn * 30, ey = -138 - lift * 2, hx = sgn * 26, hy = -168 - Math.abs(sway) * 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
      ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, TAU); ctx.fill();
      // a handkerchief flutters from the raised hand
      ctx.fillStyle = '#f6e8c9'; ctx.beginPath(); ctx.moveTo(hx, hy - 2); ctx.quadraticCurveTo(hx + sgn * 16, hy - 8 + sway * 4, hx + sgn * 22, hy + 6 + sway * 3); ctx.quadraticCurveTo(hx + sgn * 10, hy + 6, hx, hy + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.red; ctx.fillRect(hx + sgn * 12 - (sgn < 0 ? 5 : 0), hy - 2 + sway * 2, 5, 3);
    } else {
      const hx = sgn * reach, hy = wy + 2, ex = sgn * (reach * 0.52 + 6), ey = -104;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
      ctx.fillStyle = C.trim; ctx.beginPath(); ctx.arc(sgn * (reach * 0.78), hy - 1, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, TAU); ctx.fill();
    }
  };
  arm(-1, o.reachL ?? 30, o.free === 'left'); arm(1, o.reachR ?? 30, o.free === 'right');
  // head
  const hy = -146 + sway * 0.6;
  ctx.fillStyle = C.skin; ctx.fillRect(-4, -136, 8, 9);
  ctx.beginPath(); ctx.ellipse(sway * 0.8, hy, 11.5, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(sway * 0.8 + 5, hy + 2, 5, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1408'; ctx.beginPath(); ctx.arc(sway * 0.8 - 4, hy - 1, 1.5, 0, TAU); ctx.arc(sway * 0.8 + 4, hy - 1, 1.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a3a2a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(sway * 0.8, hy + 4, 4.5, 0.2, Math.PI - 0.2); ctx.stroke();
  if (C.f) {
    ctx.fillStyle = C.scarf; ctx.beginPath(); ctx.moveTo(-13 + sway, hy + 2); ctx.quadraticCurveTo(-13, hy - 18, sway, hy - 17); ctx.quadraticCurveTo(13, hy - 18, 13 + sway, hy + 2); ctx.quadraticCurveTo(7, hy - 7, sway, hy - 8); ctx.quadraticCurveTo(-7, hy - 7, -13 + sway, hy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.trim; ctx.fillRect(-11 + sway, hy - 9, 22, 2.4);
    ctx.strokeStyle = C.hair; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-9 + sway, hy + 2); ctx.quadraticCurveTo(-15, hy + 22, -11, hy + 38); ctx.stroke();
    ctx.fillStyle = C.scarf; ctx.beginPath(); ctx.arc(-11, hy + 38, 3, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.ellipse(sway * 0.8, hy - 8, 11.5, 6, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = C.hat; ctx.beginPath(); ctx.ellipse(sway * 0.8, hy - 11, 13, 7.5, 0, Math.PI, TAU); ctx.fill();
    ctx.fillRect(-13 + sway * 0.8, hy - 11, 26, 4);
    ctx.fillStyle = PAL.red; ctx.fillRect(-13 + sway * 0.8, hy - 8, 26, 2);
  }
  void k;
  ctx.restore();
}

// The soft rug of light under the chain of dancers (shared by the painted and the 3D dancers).
export function drawHoroFloor(ctx, r) {
  const yb = r.y + r.h - 8;
  ctx.save();
  const g = ctx.createRadialGradient(r.x + r.w / 2, yb, 10, r.x + r.w / 2, yb, r.w * 0.55);
  g.addColorStop(0, 'rgba(255,190,100,0.22)'); g.addColorStop(1, 'rgba(255,190,100,0)');
  ctx.fillStyle = g; ctx.save(); ctx.translate(0, yb); ctx.scale(1, 0.18); ctx.translate(0, -yb); ctx.fillRect(r.x, yb - r.w * 0.55, r.w, r.w * 1.1); ctx.restore();
  ctx.restore();
}

// The horo: a chain of dancers across `r`. st: { count (float), t, bounce, lift, foot, sway, wave (phase offset per dancer) }.
// The real 3D dancers (globalThis.__bg3d, installed by main.js) draw instead whenever they are ready; this painted chain is the fallback.
export function drawHoro(ctx, r, st) {
  drawHoroFloor(ctx, r);
  const f3 = globalThis.__bg3d;
  if (f3 && f3.draw) {
    try { if (f3.draw(ctx, r, st)) return; } catch (err) { console.warn('3D dancers failed, using the painted ones', err); globalThis.__bg3d = null; }
  }
  const cnt = Math.max(1, st.count ?? 6), n = Math.ceil(cnt), sp = r.w / (cnt + 0.6);
  const s = Math.max(0.3, Math.min(r.h / 205, sp / 56, 1.5));
  const yb = r.y + r.h - 8;
  const x0 = r.x + r.w / 2 - sp * (cnt - 1) / 2;
  for (let i = 0; i < n; i++) {
    const a = clamp01(cnt - i);
    if (a <= 0.01) continue;
    // alternate dancers a hair apart in depth so the line has some life
    const ph = (st.wave ?? 0) * i, bn = Math.max(0, (st.bounce ?? 0) - 0.04 * i);
    ctx.save(); ctx.globalAlpha *= a;
    const reach = sp * 0.5 / s;
    drawDancer(ctx, x0 + sp * i, yb - (i % 2) * 3 * s, s, i, {
      bounce: bn, lift: st.lift ?? 0, foot: ((st.foot ?? 1) * (i % 2 ? -1 : 1)), sway: (st.sway ?? 0) * (1 + 0.15 * Math.sin(ph)),
      reachL: i === 0 ? 30 : reach, reachR: i === n - 1 ? 30 : reach, free: i === 0 ? 'left' : i === n - 1 ? 'right' : null,
    });
    ctx.restore();
  }
}

// ---- particles ----------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, col, speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = rng.range(40, 220) * speed;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rng.range(0.35, 0.8), age: 0, r: rng.range(2, 5.5), col });
  }
  if (parts.length > 200) parts.splice(0, parts.length - 200);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 1 - dt * 1.6; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) { const k = 1 - p.age / p.life; ctx.fillStyle = rgba(p.col, k); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.7), 0, TAU); ctx.fill(); }
}
