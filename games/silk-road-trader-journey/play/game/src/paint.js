// Painterly landscapes: sky, light, layered ridges, dunes, flora, haze and grain. Pure canvas, deterministic (hash noise, no rng).
// Every function draws inside a rectangle r = {x, y, w, h}; `scroll` is the travelled distance in px used for parallax.

export const hash = (n) => { n = Math.imul(n ^ (n >>> 15), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
export const vn = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); const a = hash(i * 7919 + seed * 104729), b = hash((i + 1) * 7919 + seed * 104729); return a + (b - a) * u; };
export const fbm = (x, seed = 0) => vn(x, seed) * 0.56 + vn(x * 2.13, seed + 3) * 0.29 + vn(x * 4.7, seed + 7) * 0.15;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// colour helpers: '#rrggbb' <-> [r,g,b]
export const hex = (h) => { if (h[0] === 'r') { const m = h.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; } const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, t) => { const A = typeof a === 'string' ? hex(a) : a, B = typeof b === 'string' ? hex(b) : b; return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; };
export const rgb = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export const shade = (h, k) => { const c = typeof h === 'string' ? hex(h) : h; return k >= 0 ? rgb(mix(c, [255, 244, 220], k)) : rgb(mix(c, [18, 10, 30], -k)); };

// ---- sky ------------------------------------------------------------------------------------------------------------------------------------
export const SKY = {
  dawn:  { top: '#4d5f9e', mid: '#e58f8c', hor: '#ffd9a2', sun: [0.74, 0.5], sunCol: '#fff0c0', haze: '#ffcfa0', tint: [255, 190, 150, 0.14], dark: 0.0 },
  day:   { top: '#2f78c0', mid: '#8dc0e6', hor: '#f5e8c8', sun: [0.28, 0.2], sunCol: '#fffbe6', haze: '#f4e3bd', tint: [255, 255, 255, 0], dark: 0.0 },
  dusk:  { top: '#33376f', mid: '#b4527f', hor: '#ffae62', sun: [0.7, 0.54], sunCol: '#ffd89a', haze: '#ffb070', tint: [255, 110, 70, 0.2], dark: 0.1 },
  night: { top: '#050a22', mid: '#14224f', hor: '#3a4c80', sun: [0.76, 0.2], sunCol: '#dfe8ff', haze: '#33447a', tint: [10, 22, 80, 0.55], dark: 0.6 },
};

export function sky(ctx, r, time = 'day', horizonY, t = 0) {
  const K = SKY[time] ?? SKY.day;
  const g = ctx.createLinearGradient(0, r.y, 0, horizonY);
  g.addColorStop(0, K.top); g.addColorStop(0.55, K.mid); g.addColorStop(1, K.hor);
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, horizonY - r.y + 2);
  // sun / moon glow
  const sx = r.x + r.w * K.sun[0], sy = horizonY - (horizonY - r.y) * (time === 'night' ? 0.75 : time === 'day' ? 0.8 : 0.12 + 0.05 * Math.sin(t * 0.05));
  const rad = Math.max(r.w, r.h) * (time === 'night' ? 0.16 : 0.5);
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
  sg.addColorStop(0, K.sunCol); sg.addColorStop(0.08, K.sunCol); sg.addColorStop(0.09, time === 'night' ? 'rgba(200,220,255,0.35)' : 'rgba(255,230,170,0.5)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.save(); ctx.globalAlpha = time === 'day' ? 0.55 : 0.85; ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, horizonY - r.y + 2); ctx.restore();
  if (time === 'night') stars(ctx, r, horizonY, t);
  else clouds(ctx, r, horizonY, time, t);
  return K;
}
function stars(ctx, r, horizonY, t) {
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = r.x + hash(i * 3 + 1) * r.w, y = r.y + hash(i * 3 + 2) * (horizonY - r.y) * 0.92, a = 0.35 + 0.65 * hash(i * 3 + 3), tw = 0.75 + 0.25 * Math.sin(t * 1.4 + i * 1.7);
    ctx.fillStyle = `rgba(235,240,255,${a * tw})`;
    const s = hash(i + 99) > 0.93 ? 2.3 : 1.2;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}
function clouds(ctx, r, horizonY, time, t) {
  const K = SKY[time] ?? SKY.day;
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const w = r.w * (0.22 + 0.2 * hash(i + 50)), x = r.x + ((hash(i + 40) * (r.w + w) + t * (3 + i) * 0.4) % (r.w + w * 2)) - w, y = r.y + (horizonY - r.y) * (0.12 + 0.48 * hash(i + 60));
    const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.6);
    const hi = time === 'day' ? 'rgba(255,255,255,0.55)' : time === 'dawn' ? 'rgba(255,205,185,0.55)' : 'rgba(255,170,130,0.5)';
    g.addColorStop(0, hi); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22 + 0.1 * hash(i + 70)); ctx.translate(-x, -y); ctx.beginPath(); ctx.arc(x, y, w * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

// ---- biomes -------------------------------------------------------------------------------------------------------------------------------
export const BIOME = {
  loess:   { far: '#9a86a0', mid: '#c9a468', midShade: '#8f6a3c', ground: '#c8a56a', groundShade: '#8b6a3e', accent: '#7f9b4a', flora: 'poplar', relief: 0.5, snowFar: false },
  gobi:    { far: '#8a8aa6', mid: '#a99172', midShade: '#6c5844', ground: '#a68c6c', groundShade: '#6a5642', accent: '#8a7a56', flora: 'scrub', relief: 0.35, snowFar: true },
  dunes:   { far: '#d6b48a', mid: '#edc88c', midShade: '#b87f52', ground: '#ebc98f', groundShade: '#b98053', accent: '#9a8a52', flora: 'scrub', relief: 0.2, dunes: true },
  snow:    { far: '#c9d6ea', mid: '#e9f0fa', midShade: '#8da6c8', ground: '#eef3fa', groundShade: '#a8bbd8', accent: '#2c4a3a', flora: 'pine', relief: 1.0, snowFar: true, peaks: true },
  valley:  { far: '#8ea0b8', mid: '#7e9d58', midShade: '#4f6e3a', ground: '#86a05a', groundShade: '#587540', accent: '#3f6a3a', flora: 'poplar', relief: 0.55, snowFar: true },
  karakum: { far: '#b49c86', mid: '#bda268', midShade: '#8a7142', ground: '#b9a068', groundShade: '#87703f', accent: '#7a8450', flora: 'scrub', relief: 0.18, dunes: true },
  plain:   { far: '#a9998a', mid: '#c4b068', midShade: '#8c7a40', ground: '#bfae6a', groundShade: '#8a783f', accent: '#5f8a3e', flora: 'palm', relief: 0.22 },
  tigris:  { far: '#b4a48e', mid: '#c9b27a', midShade: '#947e48', ground: '#c1ad72', groundShade: '#8c7844', accent: '#4f8a46', flora: 'palm', relief: 0.1, river: true },
};

// A ridge line filled with a vertical gradient; `off` is the parallax scroll. step in px.
export function ridge(ctx, r, y0, amp, freq, off, seed, top, bottom, step = 6) {
  ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h);
  for (let x = r.x; x <= r.x + r.w + step; x += step) ctx.lineTo(x, y0 - fbm((x - r.x + off) * freq, seed) * amp);
  ctx.lineTo(r.x + r.w, r.y + r.h); ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - amp, 0, y0 + amp * 0.3 + 30);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fill();
}
// Faceted mountains: ridged noise gives sharp peaks. Base is lit from the top; each peak gets a shaded wedge on the side away from the sun
// and a diagonal arete; snow sits above a wobbling line.
export function peaks(ctx, r, y0, amp, off, seed, colLit, colShade, snow, sunDir = 1, step = 4, snowLine = 0.6) {
  const pts = [];
  for (let x = r.x - step; x <= r.x + r.w + step; x += step) { const u = (x - r.x + off) / 120; const n = vn(u * 0.5, seed) * 0.6 + vn(u * 1.3, seed + 5) * 0.3 + vn(u * 3.1, seed + 9) * 0.1; const rid = 1 - Math.abs(2 * n - 1); pts.push([x, y0 - Math.pow(rid, 1.6) * amp]); }
  const base = y0 + 40, last = pts.length - 1;
  const ridgePath = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], base); pts.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[last][0], base); ctx.closePath(); };
  ridgePath();
  const lit = ctx.createLinearGradient(0, y0 - amp, 0, y0 + 10); lit.addColorStop(0, colLit); lit.addColorStop(1, rgb(mix(colLit, colShade, 0.7)));
  ctx.fillStyle = lit; ctx.fill();
  ctx.save(); ridgePath(); ctx.clip();
  const W = 7, shadeG = ctx.createLinearGradient(0, y0 - amp, 0, y0 + 10); shadeG.addColorStop(0, colShade); shadeG.addColorStop(1, rgb(mix(colShade, colLit, 0.15)));
  const crests = [];
  for (let i = W; i < last - W; i++) { let ok = true; for (let k = -W; k <= W; k++) if (pts[i + k][1] < pts[i][1] - 0.01) { ok = false; break; } if (ok && y0 - pts[i][1] > amp * 0.18) crests.push(i); }
  ctx.fillStyle = shadeG;
  for (const i of crests) {
    const dirS = -sunDir;                                                   // the shade side lies away from the sun
    let j = i; while (j > 1 && j < last - 1 && pts[j + dirS][1] >= pts[j][1] - 0.2 && Math.abs(j - i) < 80) j += dirS;
    const apex = pts[i], foot = pts[j], skew = (base - apex[1]) * 0.32 * sunDir;
    ctx.beginPath(); ctx.moveTo(apex[0], apex[1]);
    for (let k = i; k !== j + dirS; k += dirS) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.lineTo(foot[0], base); ctx.lineTo(apex[0] + skew, base); ctx.closePath(); ctx.fill();
  }
  if (snow) {
    const sl = (x) => y0 - amp * (snowLine + 0.16 * (vn(x * 0.05 + off * 0.01, seed + 2) - 0.5) + 0.06 * (vn(x * 0.23, seed + 4) - 0.5));
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k <= last; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    for (let k = last; k >= 0; k--) ctx.lineTo(pts[k][0], Math.max(pts[k][1], sl(pts[k][0])));
    ctx.closePath(); ctx.fillStyle = snow; ctx.fill();
    // shaded snow on the shade wedges
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(150,170,205,0.55)';
    for (const i of crests) { const dirS = -sunDir; let j = i; while (j > 1 && j < last - 1 && pts[j + dirS][1] >= pts[j][1] - 0.2 && Math.abs(j - i) < 80) j += dirS; const apex = pts[i], foot = pts[j], skew = (base - apex[1]) * 0.32 * sunDir;
      ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); for (let k = i; k !== j + dirS; k += dirS) ctx.lineTo(pts[k][0], pts[k][1]); ctx.lineTo(foot[0], base); ctx.lineTo(apex[0] + skew, base); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

// Dunes: a continuous sawtooth silhouette (long windward slope, short lee face); the lee faces are shaded, crests catch light.
export function dunes(ctx, r, y0, amp, off, seed, lit, shadeCol, wavelength = 380) {
  const step = 3, lee = [];
  const prof = (x) => {
    const q = (x + off) / wavelength, k = Math.floor(q), p = q - k;
    const a = amp * (0.45 + 0.55 * hash(k * 17 + seed)), shift = 0.72 + 0.1 * (hash(k * 5 + seed) - 0.5);
    return p < shift ? a * Math.pow(Math.sin((p / shift) * Math.PI / 2), 1.25) : a * Math.pow(1 - (p - shift) / (1 - shift), 1.6);
  };
  ctx.beginPath(); ctx.moveTo(r.x, y0 + amp * 2);
  let prevLee = false, cur = null;
  for (let x = r.x; x <= r.x + r.w + step; x += step) {
    const q = (x + off) / wavelength, k = Math.floor(q), p = q - k, shift = 0.72 + 0.1 * (hash(k * 5 + seed) - 0.5), h = prof(x);
    ctx.lineTo(x, y0 - h);
    const isLee = p >= shift;
    if (isLee) { if (!cur) cur = []; cur.push([x, y0 - h]); } else if (cur) { lee.push(cur); cur = null; }
  }
  if (cur) lee.push(cur);
  ctx.lineTo(r.x + r.w + step, y0 + amp * 2); ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - amp, 0, y0 + amp * 0.6); g.addColorStop(0, lit); g.addColorStop(1, shadeCol);
  ctx.fillStyle = g; ctx.fill();
  const lg = ctx.createLinearGradient(0, y0 - amp, 0, y0 + amp * 0.1); lg.addColorStop(0, rgb(mix(shadeCol, [60, 30, 20], 0.25))); lg.addColorStop(1, shadeCol);
  ctx.fillStyle = lg;
  for (const seg of lee) { if (seg.length < 2) continue; ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); seg.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.lineTo(seg[seg.length - 1][0], y0 + amp * 0.1); ctx.lineTo(seg[0][0], y0 + amp * 0.1); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,244,214,0.4)'; ctx.lineWidth = 1.4; ctx.beginPath(); let started = false;
  for (let x = r.x; x <= r.x + r.w + step; x += step) { const q = (x + off) / wavelength, p = q - Math.floor(q); if (p > 0.1 && p < 0.7) { const h = prof(x); if (!started) { ctx.moveTo(x, y0 - h - 1); started = true; } else ctx.lineTo(x, y0 - h - 1); } else started = false; }
  ctx.stroke();
}

// ---- flora ----------------------------------------------------------------------------------------------------------------------------------
export function poplar(ctx, x, y, h, col = '#4a6a34', light = 0.2) {
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,10,0.25)'; ctx.beginPath(); ctx.ellipse(x + h * 0.25, y, h * 0.22, h * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a3624'; ctx.fillRect(x - h * 0.012, y - h * 0.18, h * 0.024, h * 0.18);
  const g = ctx.createLinearGradient(x - h * 0.1, 0, x + h * 0.1, 0); g.addColorStop(0, shade(col, light)); g.addColorStop(1, shade(col, -0.25));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + h * 0.14, y - h * 0.8, x + h * 0.12, y - h * 0.25, x + h * 0.02, y - h * 0.15);
  ctx.lineTo(x - h * 0.02, y - h * 0.15); ctx.bezierCurveTo(x - h * 0.12, y - h * 0.25, x - h * 0.14, y - h * 0.8, x, y - h); ctx.fill();
  ctx.restore();
}
export function palm(ctx, x, y, h, lean = 0.1, col = '#3f7a3a') {
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,10,0.22)'; ctx.beginPath(); ctx.ellipse(x + h * 0.2, y, h * 0.25, h * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = Math.max(2, h * 0.04); ctx.lineCap = 'round';
  const tx = x + h * lean, ty = y - h;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + h * lean * 0.2, y - h * 0.6, tx, ty); ctx.stroke();
  ctx.lineWidth = Math.max(1.2, h * 0.018);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI + (i === 4 ? 0 : 0), len = h * (0.34 + 0.06 * hash(i + Math.floor(x)));
    const ex = tx + Math.cos(a) * len, ey = ty - Math.sin(-a) * len * 0.1 + Math.abs(Math.sin(a)) * len * 0.35 - len * 0.18;
    ctx.strokeStyle = i % 2 ? shade(col, 0.1) : shade(col, -0.15);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty - len * 0.3, ex, ey + len * 0.15); ctx.stroke();
  }
  ctx.restore();
}
export function pine(ctx, x, y, h, col = '#27443a') {
  ctx.save();
  ctx.fillStyle = 'rgba(20,20,30,0.2)'; ctx.beginPath(); ctx.ellipse(x + h * 0.2, y, h * 0.22, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) {
    const yy = y - h * (0.18 + i * 0.2), w = h * (0.34 - i * 0.06);
    ctx.fillStyle = i % 2 ? shade(col, 0.05) : shade(col, -0.1);
    ctx.beginPath(); ctx.moveTo(x, yy - h * 0.3); ctx.lineTo(x + w, yy + h * 0.06); ctx.lineTo(x - w, yy + h * 0.06); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(x, yy - h * 0.3); ctx.lineTo(x + w * 0.4, yy - h * 0.1); ctx.lineTo(x - w * 0.3, yy - h * 0.1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
export function scrub(ctx, x, y, s, col = '#7a7a46') {
  ctx.save();
  ctx.fillStyle = 'rgba(40,25,10,0.18)'; ctx.beginPath(); ctx.ellipse(x + s * 0.2, y, s * 0.7, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.5, x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.9); ctx.stroke(); }
  ctx.restore();
}
export function rock(ctx, x, y, s, col = '#8a7a66') {
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,10,0.22)'; ctx.beginPath(); ctx.ellipse(x + s * 0.3, y, s * 0.9, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(x - s, y - s, x + s, y); g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - s * 0.8, y); ctx.lineTo(x - s * 0.5, y - s * 0.55); ctx.lineTo(x + s * 0.1, y - s * 0.75); ctx.lineTo(x + s * 0.7, y - s * 0.35); ctx.lineTo(x + s * 0.85, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---- the whole backdrop ------------------------------------------------------------------------------------------------------------------
// A stepped (terraced) ridge, for loess cliffs.
function terraces(ctx, r, y0, amp, off, seed, top, bottom) {
  ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h);
  for (let x = r.x; x <= r.x + r.w + 6; x += 6) { const n = fbm((x - r.x + off) * 0.008, seed); const q = Math.round(n * 7) / 7; ctx.lineTo(x, y0 - q * amp); }
  ctx.lineTo(r.x + r.w, r.y + r.h); ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - amp, 0, y0 + 20); g.addColorStop(0, top); g.addColorStop(1, bottom); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,15,0.18)'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); for (let x = r.x; x <= r.x + r.w; x += 6) { const n = fbm((x - r.x + off) * 0.008, seed), q = Math.round(n * 7) / 7; const y = y0 - q * amp + i * amp * 0.07; if (y < y0 + 8) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
}
function fields(ctx, r, y0, h, off, hz, cols) {
  for (let i = 0; i < 9; i++) {
    const y = y0 + (i / 9) * h, hh = h / 9 + 1, k = hash(i + 3);
    for (let x = -1; x < 8; x++) { const bw = r.w * (0.18 + 0.12 * hash(i * 9 + x + 3)); const px = r.x + ((x * r.w / 6.5) - off * (0.2 + i * 0.12)) % (r.w * 1.4); if (px > r.x + r.w || px < r.x - bw) continue; ctx.fillStyle = rgb(mix(cols[(i + x + 99) % cols.length], hz, 0.25 * (1 - i / 9))); ctx.fillRect(px, y, bw, hh); }
  }
}

export function landscape(ctx, r, biome, time = 'day', scroll = 0, t = 0, o = {}) {
  const B = BIOME[biome] ?? BIOME.dunes, horizon = r.y + r.h * (o.horizon ?? 0.5);
  const K = sky(ctx, r, time, horizon, t);
  const hz = hex(K.haze), seed = o.seed ?? 3, sunDir = K.sun[0] < 0.5 ? -1 : 1;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // far range
  const farL = rgb(mix('#fff6e6', hz, 0.5)), farS = rgb(mix(B.far, hz, 0.55));
  if (B.peaks) {
    peaks(ctx, r, horizon + 8, r.h * 0.38, scroll * 0.04, seed, farL, rgb(mix('#5f78a8', hz, 0.45)), 'rgba(250,252,255,0.96)', sunDir, 4, 0.7);
    peaks(ctx, r, horizon + r.h * 0.05, r.h * 0.2, scroll * 0.08, seed + 12, rgb(mix('#ffffff', hz, 0.25)), rgb(mix('#45608e', hz, 0.3)), 'rgba(245,250,255,0.98)', sunDir, 4, 0.6);
  } else {
    ridge(ctx, r, horizon + 4, r.h * (0.06 + 0.1 * B.relief), 0.006, scroll * 0.03, seed, farS, rgb(mix(B.far, hz, 0.8)));
    if (B.snowFar) peaks(ctx, r, horizon + 4, r.h * 0.2, scroll * 0.05, seed + 9, farL, rgb(mix('#6c7fa5', hz, 0.55)), 'rgba(250,252,255,0.9)', sunDir, 4, 0.55);
  }
  // haze at the horizon
  const hg = ctx.createLinearGradient(0, horizon - r.h * 0.14, 0, horizon + r.h * 0.05); hg.addColorStop(0, rgb(hz, 0)); hg.addColorStop(1, rgb(hz, 0.6));
  ctx.fillStyle = hg; ctx.fillRect(r.x, horizon - r.h * 0.14, r.w, r.h * 0.19);
  // mid hills / terraces / dunes
  const mT = rgb(mix(B.mid, hz, 0.3)), mB = rgb(mix(B.midShade, hz, 0.22));
  if (biome === 'loess') terraces(ctx, r, horizon + r.h * 0.1, r.h * 0.16, scroll * 0.1, seed + 1, mT, mB);
  else ridge(ctx, r, horizon + r.h * 0.08, r.h * (0.04 + 0.1 * B.relief), 0.011, scroll * 0.1, seed + 1, mT, mB);
  if (B.dunes) {
    dunes(ctx, r, horizon + r.h * 0.07, r.h * 0.05, scroll * 0.14, seed + 2, rgb(mix(B.mid, hz, 0.3)), rgb(mix(B.midShade, hz, 0.28)), r.w * 0.55);
    dunes(ctx, r, horizon + r.h * 0.12, r.h * 0.08, scroll * 0.25, seed + 3, rgb(mix(B.mid, hz, 0.12)), rgb(mix(B.midShade, hz, 0.1)), r.w * 0.8);
  }
  if (biome === 'valley') fields(ctx, r, horizon + r.h * 0.07, r.h * 0.12, scroll, hz, [hex('#86a65a'), hex('#a9b45e'), hex('#6f9650'), hex('#c4b667')]);
  if (B.river) {
    const ry = horizon + r.h * 0.1, rh = r.h * 0.08, g = ctx.createLinearGradient(0, ry, 0, ry + rh);
    g.addColorStop(0, rgb(mix('#79b0d0', hz, 0.3))); g.addColorStop(1, rgb(mix('#2f6a95', hz, 0.1)));
    ctx.fillStyle = g; ctx.fillRect(r.x, ry, r.w, rh);
    ctx.fillStyle = 'rgba(255,244,210,0.3)'; for (let i = 0; i < 30; i++) { const x = r.x + (((hash(i) * r.w * 2 - scroll * 0.3 + t * 6) % (r.w * 1.2)) + r.w * 1.2) % r.w; ctx.fillRect(x, ry + 2 + hash(i + 5) * (rh - 4), 8 + hash(i + 8) * 40, 1.5); }
  }
  // mid flora band
  const mid = horizon + r.h * 0.13;
  for (let i = -2; i < r.w / 34 + 2; i++) {
    const k = Math.floor((scroll * 0.2) / 34) + i, x = r.x + k * 34 - scroll * 0.2 + (hash(k * 3) - 0.5) * 20, y = mid + (hash(k * 5) - 0.5) * 8;
    const q = hash(k * 7 + seed); if (q > (B.flora === 'scrub' ? 0.4 : 0.55)) continue;
    const h = r.h * (0.055 + 0.04 * hash(k * 11));
    if (B.flora === 'poplar') poplar(ctx, x, y, h * 1.6, rgb(mix(B.accent, hz, 0.22)));
    else if (B.flora === 'palm') palm(ctx, x, y, h * 1.5, (hash(k) - 0.5) * 0.4, rgb(mix(B.accent, hz, 0.18)));
    else if (B.flora === 'pine') pine(ctx, x, y, h * 1.7, rgb(mix(B.accent, hz, 0.25)));
    else scrub(ctx, x, y, h * 0.8, rgb(mix(B.accent, hz, 0.3)));
  }
  // near ground
  const gy = horizon + r.h * 0.2;
  const g2 = ctx.createLinearGradient(0, gy - 40, 0, r.y + r.h);
  g2.addColorStop(0, rgb(mix(B.ground, hz, 0.18))); g2.addColorStop(0.5, B.ground); g2.addColorStop(1, B.groundShade);
  ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h);
  for (let x = r.x; x <= r.x + r.w + 8; x += 8) ctx.lineTo(x, gy - fbm((x - r.x + scroll * 0.5) * 0.004, seed + 4) * r.h * (0.02 + 0.05 * B.relief));
  ctx.lineTo(r.x + r.w, r.y + r.h); ctx.closePath(); ctx.fillStyle = g2; ctx.fill();
  if (B.dunes) dunes(ctx, r, gy + r.h * 0.05, r.h * 0.07, scroll * 0.5, seed + 6, rgb(mix(B.ground, [255, 240, 200], 0.1)), B.groundShade, r.w * 0.9);
  // the road: packed earth with ruts, a lighter band the caravan walks on
  const ry = r.y + r.h * (o.road ?? 0.82), rh = r.h * 0.12;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, ry - rh * 0.2, r.w, rh * 1.6); ctx.clip();
  const rg = ctx.createLinearGradient(0, ry, 0, ry + rh); rg.addColorStop(0, 'rgba(255,238,200,0)'); rg.addColorStop(0.3, 'rgba(255,238,200,0.2)'); rg.addColorStop(1, 'rgba(255,238,200,0)');
  ctx.fillStyle = rg; ctx.fillRect(r.x, ry - rh * 0.2, r.w, rh * 1.6);
  ctx.strokeStyle = 'rgba(70,45,20,0.22)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = r.x; x <= r.x + r.w; x += 10) ctx.lineTo(x, ry + rh * 0.32 + Math.sin((x + scroll) * 0.01) * 2); ctx.stroke();
  ctx.beginPath(); for (let x = r.x; x <= r.x + r.w; x += 10) ctx.lineTo(x, ry + rh * 0.62 + Math.sin((x + scroll) * 0.013 + 2) * 2); ctx.stroke();
  ctx.restore();
  // ground texture streaks (parallax gives the sense of speed)
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, gy, r.w, r.y + r.h - gy); ctx.clip();
  for (let i = 0; i < 90; i++) {
    const depth = hash(i * 31 + 5), y = gy + 6 + depth * (r.y + r.h - gy - 10), sp = 0.45 + depth * 1.3;
    const x = r.x + (((hash(i * 17 + 1) * r.w * 1.6) - scroll * sp) % (r.w * 1.6) + r.w * 1.6) % (r.w * 1.6) - r.w * 0.3;
    ctx.fillStyle = hash(i + 7) > 0.5 ? 'rgba(255,240,205,0.16)' : 'rgba(60,40,20,0.15)';
    ctx.fillRect(x, y, 8 + depth * 30, 1 + depth * 2.2);
  }
  ctx.restore();
  // foreground flora and rocks, in front of the road edge
  for (let i = -1; i < 9; i++) {
    const k = Math.floor((scroll * 1.0) / (r.w * 0.34)) + i, x = r.x + k * r.w * 0.34 - scroll * 1.0 + hash(k * 9 + seed) * r.w * 0.3, y = r.y + r.h * (0.95 + 0.04 * hash(k * 3 + 1));
    const q = hash(k * 13 + seed + 2); if (q > 0.7) continue;
    const s = r.h * (0.055 + 0.04 * hash(k * 5));
    if (q > 0.45) rock(ctx, x, y, s, B.groundShade);
    else if (B.flora === 'pine' && q < 0.2) pine(ctx, x, y, s * 3.2, '#1e3a30');
    else if (B.flora === 'poplar' && q < 0.2) poplar(ctx, x, y, s * 3.6, '#3d5c2c');
    else scrub(ctx, x, y, s * 1.3, rgb(mix(B.accent, B.groundShade, 0.4)));
  }
  ctx.restore();
  return { horizon, ground: gy, floor: r.y + r.h * 0.86, road: ry, K, B };
}

// Atmosphere over the finished scene: time-of-day tint, vignette, film grain.
export function finish(ctx, r, time = 'day', o = {}) {
  const K = SKY[time] ?? SKY.day;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  if (K.tint[3] > 0) { ctx.globalCompositeOperation = time === 'night' ? 'multiply' : 'soft-light'; ctx.fillStyle = `rgba(${K.tint[0]},${K.tint[1]},${K.tint[2]},${K.tint[3] * (time === 'night' ? 1 : 2.4)})`; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalCompositeOperation = 'source-over'; }
  if (o.dust) {
    const a = clamp(o.dust, 0, 1);
    ctx.fillStyle = `rgba(214,170,110,${0.55 * a})`; ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < 40; i++) { const x = r.x + ((hash(i) * r.w * 1.4 + (o.t ?? 0) * (240 + i * 7)) % (r.w * 1.4)) - r.w * 0.2, y = r.y + hash(i + 70) * r.h; ctx.fillStyle = `rgba(240,205,150,${0.28 * a})`; ctx.fillRect(x, y, 30 + hash(i + 9) * 60, 1.5 + hash(i + 3) * 2); }
  }
  const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.55, Math.min(r.w, r.h) * 0.35, r.x + r.w / 2, r.y + r.h * 0.55, Math.max(r.w, r.h) * 0.8);
  v.addColorStop(0, 'rgba(10,5,20,0)'); v.addColorStop(1, `rgba(10,5,20,${0.42 + K.dark * 0.2})`);
  ctx.fillStyle = v; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}
