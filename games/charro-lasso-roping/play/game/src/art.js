// Static and sprite art for the lienzo charro: sky, sierra, adobe wall, stands, sand ring, the painted wooden target on its cart, the
// charro himself, rope loops, knots and panels. Everything is canvas drawing with soft lighting; the heavy backdrop is painted once
// into an OffscreenCanvas layer (when the host has one), keyed by size, and blitted per frame. No text is baked in here.

export const PAL = {
  terra: '#c8542c', terraDark: '#8f3318', marigold: '#f4b324', marigoldLight: '#ffd96a', teal: '#139e8e', tealDark: '#0b5f58', magenta: '#d63a79',
  indigo: '#1c1b3a', indigoSoft: '#2d2a5a', cream: '#fff3d6', sand: '#e6bf86', sandDark: '#c99a5b', wood: '#8a5a32', woodDark: '#5a3920', silver: '#dfe6ee', red: '#d6402b',
};
export const INK = '#3a1f12', ACC = '#b3361f', CREAM = '#fff3d6', GOLD = '#f4b324';
const TAU = Math.PI * 2;

export function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function mix(a, b, f) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const hex = (a, b, f) => { const m = mix(a, b, f).match(/\d+/g).map(Number); return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join(''); };
export const shade = hex;

// ---- cached layers ------------------------------------------------------------------------------------------------------
export const artStats = { layerPaints: 0 };
const layers = new Map();
function layer(key, w, h, paint, scale = 1) {
  let L = layers.get(key);
  if (L === undefined) {
    L = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const k = Math.min(scale, Math.sqrt(5.5e6 / (w * h))), c = new OffscreenCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k))), lc = c.getContext('2d');
        lc.scale(k, k); paint(lc, k); L = c; artStats.layerPaints++;
      }
    } catch { L = null; }
    layers.set(key, L);
    if (layers.size > 10) layers.delete(layers.keys().next().value);
  }
  return L;
}

// ---- the arena backdrop -------------------------------------------------------------------------------------------------
// `hy` is the y of the horizon / base of the adobe wall inside a w x h canvas. Returns nothing: paints sky to ground.
function paintBackdrop(ctx, w, h, hy) {
  const r = lcg(4711);
  // dusk sky
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#2c5aa6'); sky.addColorStop(0.55, '#7fb2e0'); sky.addColorStop(1, '#ffe2a8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hy + 2);
  const sg = ctx.createRadialGradient(w * 0.78, hy * 0.62, 0, w * 0.78, hy * 0.62, hy * 0.9);
  sg.addColorStop(0, 'rgba(255,244,200,0.95)'); sg.addColorStop(0.12, 'rgba(255,220,140,0.55)'); sg.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, hy + 2);
  // soft clouds
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 5; i++) { const cx = r() * w, cy = hy * (0.12 + r() * 0.25), cw = 60 + r() * 90; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(cx + j * cw * 0.28, cy + (j % 2) * 4, cw * 0.32, cw * 0.1, 0, 0, TAU); ctx.fill(); } }
  // the sierra: two ranges of violet mountains
  const range = (base, amp, peaks, col, seed) => {
    const rr = lcg(seed), k = [];
    for (let i = 0; i < 4; i++) k.push({ f: (0.7 + rr() * 1.6 + i * 0.9) * peaks / w * TAU, p: rr() * TAU, a: amp * (0.5 + rr()) / (i + 1.3) });
    ctx.beginPath(); ctx.moveTo(0, hy + 4);
    for (let x = 0; x <= w + 6; x += 6) { let v = 0; for (const q of k) v += q.a * Math.abs(Math.sin(q.f * x + q.p)); ctx.lineTo(x, base - v); }
    ctx.lineTo(w, hy + 4); ctx.closePath();
    const g = ctx.createLinearGradient(0, base - amp, 0, hy); g.addColorStop(0, hex(col, '#ffffff', 0.25)); g.addColorStop(1, hex(col, '#ffd9a8', 0.5));
    ctx.fillStyle = g; ctx.fill();
  };
  range(hy * 0.74, hy * 0.36, Math.max(3, w / 170), '#6f5aa0', 31);
  range(hy * 0.86, hy * 0.22, Math.max(4, w / 120), '#8f5c8f', 77);
  // the adobe wall of the lienzo with a row of arches and a scalloped crown
  const wallTop = hy - hy * 0.46, wallH = hy * 0.46;
  const wg = ctx.createLinearGradient(0, wallTop, 0, hy); wg.addColorStop(0, '#f2c79a'); wg.addColorStop(1, '#d9946a');
  ctx.fillStyle = wg; ctx.fillRect(0, wallTop, w, wallH);
  ctx.fillStyle = 'rgba(120,60,30,0.14)'; for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.ellipse(r() * w, wallTop + r() * wallH, 14 + r() * 30, 3 + r() * 5, 0, 0, TAU); ctx.fill(); }
  const sc = Math.max(16, Math.min(38, w / 18));
  ctx.fillStyle = '#fff1d2'; for (let x = 0; x < w + sc; x += sc * 1.5) { ctx.beginPath(); ctx.arc(x, wallTop, sc * 0.45, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = PAL.terra; ctx.fillRect(0, wallTop + sc * 0.2, w, sc * 0.25);
  // stands: arches with the crowd behind them
  const aw = Math.max(46, Math.min(96, w / 8)), ah = wallH * 0.52, ay = hy - ah - wallH * 0.08;
  for (let x = aw * 0.25; x < w; x += aw * 1.25) {
    ctx.fillStyle = '#4b2a35'; ctx.beginPath(); ctx.moveTo(x, ay + ah); ctx.lineTo(x, ay + aw * 0.5); ctx.arc(x + aw / 2, ay + aw * 0.5, aw / 2, Math.PI, 0); ctx.lineTo(x + aw, ay + ah); ctx.closePath(); ctx.fill();
    const cols = ['#e8a823', '#3fa05a', '#d63a79', '#fff3d6', '#2c7fd1', '#d6402b', '#139e8e', '#f4b324'];
    for (let k = 0; k < 5; k++) {
      const px = x + aw * (0.16 + 0.17 * k), py = ay + ah - 4 - (k % 2) * 7 - r() * 6, c = cols[Math.floor(r() * cols.length)];
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(px - 6, py - 14, 12, 16, 4); ctx.fill();
      ctx.fillStyle = '#e8b48a'; ctx.beginPath(); ctx.arc(px, py - 19, 5, 0, TAU); ctx.fill();
      if (r() > 0.55) { ctx.fillStyle = '#2b2118'; ctx.fillRect(px - 9, py - 22, 18, 3); ctx.fillRect(px - 5, py - 29, 10, 8); }
    }
    ctx.strokeStyle = PAL.terraDark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, ay + ah); ctx.lineTo(x, ay + aw * 0.5); ctx.arc(x + aw / 2, ay + aw * 0.5, aw / 2, Math.PI, 0); ctx.lineTo(x + aw, ay + ah); ctx.stroke();
  }
  // painted ring-fence: red and white boards along the base of the wall
  const fh = Math.max(14, hy * 0.09);
  ctx.fillStyle = '#fff3d6'; ctx.fillRect(0, hy - fh, w, fh);
  for (let x = 0; x < w; x += fh * 2.4) { ctx.fillStyle = PAL.red; ctx.fillRect(x, hy - fh, fh * 1.2, fh); }
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, hy - 2, w, 4);
}

export function drawBackdrop(ctx, sc, hyFrac = 0.52) {
  const hy = Math.round(sc.h * hyFrac), key = `bd|${Math.round(sc.w)}x${Math.round(sc.h)}|${hy}`;
  const lyr = layer(key, sc.w, sc.h, (lc) => paintBackdrop(lc, sc.w, sc.h, hy));
  if (lyr) ctx.drawImage(lyr, sc.x, sc.y, sc.w, sc.h);
  else { ctx.save(); ctx.translate(sc.x, sc.y); ctx.beginPath(); ctx.rect(0, 0, sc.w, sc.h); ctx.clip(); paintBackdrop(ctx, sc.w, sc.h, hy); ctx.restore(); }
  return sc.y + hy;
}

// the sand ring: ground below the horizon `gy`, down to the bottom of the rect
export function drawGround(ctx, sc, gy, t) {
  const g = ctx.createLinearGradient(0, gy, 0, sc.y + sc.h); g.addColorStop(0, '#f0cf98'); g.addColorStop(1, '#cf9f5f');
  ctx.fillStyle = g; ctx.fillRect(sc.x, gy, sc.w, sc.y + sc.h - gy);
  // raked furrows running away to the fence
  ctx.strokeStyle = 'rgba(140,90,40,0.22)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 9; i++) { const f = i / 9, y = gy + (sc.y + sc.h - gy) * f * f; ctx.beginPath(); ctx.moveTo(sc.x, y); ctx.lineTo(sc.x + sc.w, y); ctx.stroke(); }
  // a painted arc: the ring's chalk line
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(sc.x + sc.w / 2, sc.y + sc.h * 1.18, sc.w * 0.78, sc.h * 0.52, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  void t;
}

// papel picado: a string of cut-paper flags with little cut-outs, swaying
export function drawBunting(ctx, x0, x1, y, t, calm, size = 1) {
  const n = Math.max(5, Math.round((x1 - x0) / (46 * size))), cols = [PAL.magenta, PAL.marigold, PAL.teal, PAL.red, '#7a4fd6', '#ff8a3c'];
  const pts = []; for (let i = 0; i <= n; i++) { const f = i / n; pts.push([x0 + (x1 - x0) * f, y + Math.sin(f * Math.PI) * 14 * size]); }
  ctx.strokeStyle = 'rgba(60,30,20,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); pts.forEach(([x, py], i) => (i ? ctx.lineTo(x, py) : ctx.moveTo(x, py))); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx] = pts[i + 1], w = (bx - ax) * 0.82, h = 30 * size, sw = calm ? 0 : Math.sin(t * 1.7 + i * 1.3) * 2.5 * size, cx = (ax + bx) / 2;
    ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(cx - w / 2, ay); ctx.lineTo(cx + w / 2, ay); ctx.lineTo(cx + w / 2 + sw, ay + h); for (let k = 3; k >= 0; k--) ctx.lineTo(cx - w / 2 + (w * k) / 3 + sw, ay + h - (k % 2 ? 6 * size : 0)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(cx + sw * 0.5, ay + h * 0.38, 4.2 * size, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + sw * 0.5 - 7 * size, ay + h * 0.62, 2.3 * size, 0, TAU); ctx.arc(cx + sw * 0.5 + 7 * size, ay + h * 0.62, 2.3 * size, 0, TAU); ctx.fill();
  }
}

// ---- the charro -------------------------------------------------------------------------------------------------------------
// (x, y) is between the feet on the ground, k = px per unit (the figure is ~150 units tall), facing right. Returns the rope hand.
export function drawCharro(ctx, x, y, k, o = {}) {
  const { arm = -1.2, lean = 0, step = 0, crouch = 0, t = 0 } = o;
  const lift = crouch * 16 * k, bx = x + step * k;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(60,30,10,0.28)'; ctx.beginPath(); ctx.ellipse(bx, y + 2 * k, 38 * k, 8 * k, 0, 0, TAU); ctx.fill();
  const hipY = y - 74 * k + lift * 0.6, shY = y - 126 * k + lift, sx = bx + lean * 8 * k;
  // legs: charro trousers with a row of silver buttons down the outside seam, boots with a heel
  for (const [dx, dark] of [[-9, 1], [9, 0]]) {
    const lx = bx + dx * k, g = ctx.createLinearGradient(lx - 9 * k, 0, lx + 9 * k, 0); g.addColorStop(0, dark ? '#16162c' : '#2a2850'); g.addColorStop(1, dark ? '#0e0e1c' : '#1c1b3a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(lx - 9 * k, hipY, 18 * k, y - hipY - 10 * k, 5 * k); ctx.fill();
    ctx.fillStyle = PAL.silver; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(lx + 5 * k, hipY + (8 + j * 10) * k, 1.9 * k, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#4a2814'; ctx.beginPath(); ctx.roundRect(lx - 9 * k, y - 16 * k, 20 * k, 16 * k, [4 * k, 8 * k, 3 * k, 3 * k]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(lx - 7 * k, y - 14 * k, 4 * k, 9 * k);
  }
  // sash and jacket (a short charro jacket in deep teal with gold braid)
  ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.roundRect(bx - 21 * k, hipY - 6 * k, 42 * k, 11 * k, 4 * k); ctx.fill();
  const jg = ctx.createLinearGradient(sx - 24 * k, 0, sx + 24 * k, 0); jg.addColorStop(0, '#0e7c72'); jg.addColorStop(0.55, '#139e8e'); jg.addColorStop(1, '#0b5f58');
  ctx.fillStyle = jg; ctx.beginPath(); ctx.moveTo(bx - 20 * k, hipY - 2 * k); ctx.lineTo(sx - 24 * k, shY); ctx.quadraticCurveTo(sx, shY - 9 * k, sx + 24 * k, shY); ctx.lineTo(bx + 20 * k, hipY - 2 * k); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.marigoldLight; ctx.lineWidth = 2.4 * k; ctx.beginPath(); ctx.moveTo(sx - 1 * k, shY + 2 * k); ctx.lineTo(bx - 1 * k, hipY - 4 * k); ctx.stroke();
  ctx.fillStyle = PAL.silver; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(bx - 1 * k + 5 * k, hipY - (8 + j * 11) * k, 2 * k, 0, TAU); ctx.fill(); }
  // far arm (holding the coil of rope at the hip)
  ctx.strokeStyle = '#0b5f58'; ctx.lineCap = 'round'; ctx.lineWidth = 11 * k;
  const fsx = sx - 14 * k, fsy = shY + 6 * k; ctx.beginPath(); ctx.moveTo(fsx, fsy); ctx.lineTo(fsx - 6 * k, fsy + 28 * k); ctx.lineTo(bx - 14 * k, hipY - 4 * k); ctx.stroke();
  ctx.strokeStyle = '#d9b36a'; ctx.lineWidth = 3 * k; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(bx - 18 * k, hipY - 2 * k, (10 - j * 2) * k, (8 - j * 1.5) * k, 0, 0, TAU); ctx.stroke(); }
  // head, moustache, bow tie and the big sombrero
  const hx = sx + 4 * k, hy = shY - 18 * k;
  ctx.fillStyle = '#e4a679'; ctx.beginPath(); ctx.arc(hx, hy, 13 * k, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(hx - 4 * k, hy - 4 * k, 6 * k, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b1a10'; ctx.beginPath(); ctx.ellipse(hx + 6 * k, hy + 5 * k, 8 * k, 2.6 * k, 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b1a10'; ctx.beginPath(); ctx.arc(hx + 7 * k, hy - 3 * k, 1.6 * k, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(sx + 2 * k, shY + 2 * k); ctx.lineTo(sx - 7 * k, shY - 2 * k); ctx.lineTo(sx - 7 * k, shY + 7 * k); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(sx + 2 * k, shY + 2 * k); ctx.lineTo(sx + 11 * k, shY - 2 * k); ctx.lineTo(sx + 11 * k, shY + 7 * k); ctx.closePath(); ctx.fill();
  const sbY = hy - 11 * k;
  const sg = ctx.createLinearGradient(0, sbY - 24 * k, 0, sbY); sg.addColorStop(0, '#f4e2b4'); sg.addColorStop(1, '#c9a35c');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(hx - 15 * k, sbY); ctx.quadraticCurveTo(hx - 13 * k, sbY - 30 * k, hx, sbY - 30 * k); ctx.quadraticCurveTo(hx + 13 * k, sbY - 30 * k, hx + 15 * k, sbY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.indigo; ctx.fillRect(hx - 15 * k, sbY - 8 * k, 30 * k, 7 * k);
  ctx.fillStyle = PAL.marigold; for (let j = 0; j < 5; j++) ctx.fillRect(hx - 13 * k + j * 6.2 * k, sbY - 6.5 * k, 3 * k, 4 * k);
  const bg = ctx.createLinearGradient(0, sbY - 4 * k, 0, sbY + 7 * k); bg.addColorStop(0, '#e6cf92'); bg.addColorStop(1, '#a98446');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(hx, sbY, 42 * k, 8.5 * k, -0.05, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.marigold; ctx.lineWidth = 2.2 * k; ctx.beginPath(); ctx.ellipse(hx, sbY + 0.5 * k, 40 * k, 7 * k, -0.05, 0.1, Math.PI - 0.1); ctx.stroke();
  // the near arm: shoulder -> elbow -> hand along `arm` (radians, 0 = pointing forward, negative = up)
  const asx = sx + 12 * k, asy = shY + 6 * k, L1 = 30 * k, L2 = 30 * k;
  const ex = asx + Math.cos(arm - 0.5) * L1, ey = asy + Math.sin(arm - 0.5) * L1, hxh = ex + Math.cos(arm + 0.45) * L2, hyh = ey + Math.sin(arm + 0.45) * L2;
  ctx.strokeStyle = '#0e8a7d'; ctx.lineWidth = 12 * k; ctx.beginPath(); ctx.moveTo(asx, asy); ctx.lineTo(ex, ey); ctx.lineTo(hxh, hyh); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(asx, asy - 3 * k); ctx.lineTo(ex, ey - 3 * k); ctx.lineTo(hxh, hyh - 3 * k); ctx.stroke();
  ctx.fillStyle = '#e4a679'; ctx.beginPath(); ctx.arc(hxh, hyh, 6.5 * k, 0, TAU); ctx.fill();
  ctx.restore();
  void t;
  return { hx: hxh, hy: hyh, headX: hx, headY: hy };
}

// ---- rope ---------------------------------------------------------------------------------------------------------------------
// A rope stroke along a path with a light core: pts = [[x,y],...]; width in px.
export function ropeStroke(ctx, pts, width, alpha = 1, closed = false) {
  if (pts.length < 2) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (closed) ctx.closePath(); };
  path(); ctx.strokeStyle = 'rgba(40,15,0,0.8)'; ctx.lineWidth = width + 3.2; ctx.stroke();
  path(); ctx.strokeStyle = '#d9962f'; ctx.lineWidth = width; ctx.stroke();
  path(); ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = Math.max(1, width * 0.4); ctx.stroke();
  ctx.restore();
}
// a loop as an ellipse in a plane tilted by `tilt` (0 = edge on from the side, 1 = flat circle), `ph` rotates the twist highlights
export function loopPoints(cx, cy, r, tilt, rot, n = 40, ph = 0) {
  const pts = [], ry = Math.max(r * 0.12, r * tilt), cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + ph, ux = Math.cos(a) * r, uy = Math.sin(a) * ry; pts.push([cx + ux * cr - uy * sr, cy + ux * sr + uy * cr]); }
  return pts;
}
// the golden flower: a four-petal rose curve, optionally drawn partially (`bloom` 0..1)
export function flowerPoints(cx, cy, r, rot, bloom = 1, n = 120) {
  const pts = [], cr = Math.cos(rot), sr = Math.sin(rot), rad = r * (0.35 + 0.65 * bloom);
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, p = rad * (0.25 + 0.75 * Math.abs(Math.cos(2 * a))), ux = Math.cos(a) * p, uy = Math.sin(a) * p; pts.push([cx + ux * cr - uy * sr, cy + ux * sr + uy * cr]); }
  return pts;
}
export function eightPoints(cx, cy, r, rot, ph = 0, n = 80) {
  const pts = [], cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + ph, ux = Math.sin(a) * r * 1.15, uy = Math.sin(2 * a) * r * 0.55; pts.push([cx + ux * cr - uy * sr, cy + ux * sr + uy * cr]); }
  return pts;
}

// ---- the painted wooden target on its cart ------------------------------------------------------------------------------------
// (x, y): the catch point (the top of the neck) and the rail level below it; dir = +1 faces right. k = px per unit.
export function drawTarget(ctx, x, railY, k, dir, o = {}) {
  // a bay horse in side view (the 2D fallback and the Rules diagram); k = px per art unit, ~1.5 m = 100 units
  const { roll = 0, t = 0, hit = 0 } = o, u = k * 1.0, ph = hit ? 0 : roll * 0.6;
  ctx.save(); ctx.translate(x, railY); ctx.scale(dir, 1);
  ctx.fillStyle = 'rgba(60,30,10,0.3)'; ctx.beginPath(); ctx.ellipse(-20 * u, 3 * u, 62 * u, 6 * u, 0, 0, TAU); ctx.fill();
  const leg = (hx, ang, far) => {
    const kx = hx + Math.sin(ang) * 26 * u, ky = -52 * u + Math.cos(ang) * 24 * u - 24 * u, fx = kx + Math.sin(ang * 0.4 - 0.2) * 24 * u, fy = -4 * u - Math.max(0, Math.sin(ang)) * 6 * u;
    ctx.strokeStyle = far ? '#3a1d0e' : '#4a2411'; ctx.lineCap = 'round'; ctx.lineWidth = 9 * u;
    ctx.beginPath(); ctx.moveTo(hx, -58 * u); ctx.lineTo(kx, ky); ctx.stroke(); ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = '#1e1511'; ctx.beginPath(); ctx.ellipse(fx + 2 * u, fy + 2 * u, 5 * u, 3 * u, 0, 0, TAU); ctx.fill();
  };
  const sw = (n) => Math.sin(ph + n) * 0.6;
  leg(-62 * u, sw(0), true); leg(18 * u, sw(Math.PI), true);
  const g = ctx.createLinearGradient(0, -100 * u, 0, -50 * u); g.addColorStop(0, '#6e3a1c'); g.addColorStop(1, '#8e5430');
  ctx.fillStyle = '#17110d'; ctx.beginPath(); ctx.moveTo(-80 * u, -78 * u); ctx.quadraticCurveTo(-112 * u, -62 * u, -104 * u, -26 * u); ctx.quadraticCurveTo(-92 * u, -56 * u, -76 * u, -68 * u); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-30 * u, -76 * u, 56 * u, 25 * u, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(8 * u, -92 * u); ctx.quadraticCurveTo(22 * u, -126 * u, 40 * u, -128 * u); ctx.lineTo(70 * u, -112 * u); ctx.quadraticCurveTo(76 * u, -104 * u, 68 * u, -100 * u); ctx.lineTo(44 * u, -104 * u); ctx.quadraticCurveTo(30 * u, -86 * u, 20 * u, -60 * u); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#17110d'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(8 * u, -92 * u); ctx.quadraticCurveTo(22 * u, -126 * u, 38 * u, -130 * u); ctx.stroke();
  ctx.fillStyle = '#f0e4c8'; ctx.beginPath(); ctx.moveTo(48 * u, -124 * u); ctx.lineTo(70 * u, -113 * u); ctx.lineTo(67 * u, -108 * u); ctx.lineTo(46 * u, -118 * u); ctx.fill();
  ctx.fillStyle = '#120a06'; ctx.beginPath(); ctx.arc(52 * u, -114 * u, 2.2 * u, 0, TAU); ctx.fill();
  // saddle blanket
  const cols = ['#b3261e', '#f4b324', '#139e8e', '#2b2a5a'];
  for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.roundRect((-46 + i * 8) * u, -98 * u, 8 * u, 40 * u, 2 * u); ctx.fill(); }
  ctx.fillStyle = '#5a3118'; ctx.beginPath(); ctx.ellipse(-30 * u, -102 * u, 22 * u, 6 * u, 0, 0, TAU); ctx.fill();
  leg(-54 * u, sw(Math.PI * 0.5), false); leg(26 * u, sw(Math.PI * 1.5), false);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(-30 * u, -88 * u, 40 * u, 6 * u, -0.03, 0, TAU); ctx.fill();
  ctx.restore();
  void t;
}

// ---- rope knots and the rhythm track ------------------------------------------------------------------------------------------
export function drawKnot(ctx, x, y, r, kind = 'tap', a = 1, glow = 0) {
  ctx.save(); ctx.globalAlpha = a;
  if (glow > 0) { ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 18 * glow; }
  const main = kind === 'hold' ? PAL.teal : PAL.marigold, rim = kind === 'hold' ? '#7ff0dd' : '#fff0a8';
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, rim); g.addColorStop(0.5, main); g.addColorStop(1, kind === 'hold' ? '#07514b' : '#a8590c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.beginPath(); ctx.arc(x, y, r * 0.98, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,25,5,0.55)'; ctx.lineWidth = Math.max(1.5, r * 0.12);
  for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(x, y, r * (0.28 + j * 0.2), 0.3 + j, 2.3 + j); ctx.stroke(); }
  ctx.restore();
}

// ---- panels -------------------------------------------------------------------------------------------------------------------------
export function drawPanel(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fff6e0'); g.addColorStop(1, '#f6e0b4');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill(); ctx.restore();
  ctx.strokeStyle = PAL.terra; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.stroke();
  ctx.strokeStyle = PAL.marigold; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 9, y + 9, w - 18, h - 18, 19); ctx.stroke();
  // a row of papel picado triangles along the top edge
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.clip();
  const cols = [PAL.magenta, PAL.marigold, PAL.teal, PAL.red], tw = 34;
  for (let i = 0, px = x + 14; px < x + w - 20; px += tw, i++) { ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + tw, y); ctx.lineTo(px + tw / 2, y + 18); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
