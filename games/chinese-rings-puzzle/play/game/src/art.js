// Static art: the room, the base, the bar, and the rings. The rings are REAL 3D tori shaded per pixel (a metal environment model with a lantern
// softbox, a cool window and a warm floor bounce), splatted into a z-buffer and baked ONCE to sprites (OffscreenCanvas) in two halves: the half of
// the ring that is behind the bar and the half in front of it, so the bar really runs through the middle of every ring that is on it.
// Where OffscreenCanvas does not exist (headless tests) the rings fall back to plain stroked ellipses.
import { host } from './layout.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, f) => a + (b - a) * f;
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ------------------------------------------------------------------------------------------------ finishes
export const FINISHES = {
  steel: { name: 'Steel', f0: [0.80, 0.83, 0.88], rough: 0.0, tint: '#cfd8e6', glow: '216,228,246' },
  brass: { name: 'Brass', f0: [0.95, 0.74, 0.36], rough: 0.05, tint: '#e6b657', glow: '246,200,110' },
  iron: { name: 'Black iron', f0: [0.34, 0.35, 0.40], rough: 0.35, tint: '#6d727e', glow: '170,180,200' },
};
export const FINISH_KEYS = ['steel', 'brass', 'iron'];

// ------------------------------------------------------------------------------------------------ the 3D torus
const YAW = 26 * Math.PI / 180, CT = Math.cos(YAW), ST = Math.sin(YAW), TUBE = 0.14;
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const KEY = norm3([-0.50, 0.72, 0.48]), WIN = norm3([0.86, 0.26, 0.42]), FILL = norm3([0.05, -0.45, 0.9]);
const smooth = (a, b, x) => { const f = clamp((x - a) / (b - a), 0, 1); return f * f * (3 - 2 * f); };

// Environment seen in the reflection direction r (view space: x right, y up, z toward the viewer). Returns linear RGB.
function envColor(rx, ry, rz) {
  const up = clamp(ry * 0.5 + 0.5, 0, 1);                                   // 0 floor .. 1 ceiling
  let r = lerp(0.16, 0.36, up), g = lerp(0.07, 0.31, up), b = lerp(0.055, 0.30, up);
  const horizon = Math.exp(-((ry - 0.08) * (ry - 0.08)) / 0.004) * 0.7;    // the bright line where the lacquered walls meet the lantern glow
  r += horizon * 0.9; g += horizon * 0.62; b += horizon * 0.34;
  if (ry < -0.05) { const f = clamp(-ry, 0, 1) * 0.85; r += f * 0.42; g += f * 0.1; b += f * 0.06; }   // the vermilion base bounces warm light up
  const dk = rx * KEY[0] + ry * KEY[1] + rz * KEY[2], kk = smooth(0.90, 0.985, dk) * 3.0 + Math.pow(Math.max(dk, 0), 10) * 0.55;
  r += kk * 1.0; g += kk * 0.82; b += kk * 0.55;
  const dw = rx * WIN[0] + ry * WIN[1] + rz * WIN[2], ww = smooth(0.86, 0.975, dw) * 1.5 + Math.pow(Math.max(dw, 0), 12) * 0.2;
  r += ww * 0.55; g += ww * 0.78; b += ww * 1.0;
  const df = rx * FILL[0] + ry * FILL[1] + rz * FILL[2], ff = smooth(0.82, 0.98, df) * 0.38;
  r += ff * 0.9; g += ff * 0.55; b += ff * 0.35;
  return [r, g, b];
}

function shadePoint(nx, ny, nz, fin) {
  const ndv = clamp(nz, 0, 1);
  const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
  let [er, eg, eb] = envColor(rx, ry, rz);
  if (fin.rough) { const m = (er + eg + eb) / 3, k = fin.rough; er = lerp(er, m, k); eg = lerp(eg, m, k); eb = lerp(eb, m, k); er *= lerp(1, 0.7, k); eg *= lerp(1, 0.7, k); eb *= lerp(1, 0.7, k); }
  const fr = Math.pow(1 - ndv, 5), f0 = fin.f0;
  let r = er * (f0[0] + (1 - f0[0]) * fr), g = eg * (f0[1] + (1 - f0[1]) * fr), b = eb * (f0[2] + (1 - f0[2]) * fr);
  const dif = Math.max(0, nx * KEY[0] + ny * KEY[1] + nz * KEY[2]) * 0.10 + 0.025;   // a trace of body colour
  r += f0[0] * dif; g += f0[1] * dif; b += f0[2] * dif;
  const rim = Math.pow(1 - ndv, 2.2) * 0.34; r *= 1 - rim; g *= 1 - rim; b *= 1 - rim;            // tube edges fall off into shade
  const tm = (c) => Math.round(255 * Math.pow(clamp(c / (1 + c * 0.4), 0, 1), 0.95));
  return [tm(r), tm(g), tm(b)];
}

// Half-width / half-height of a ring sprite in ring units (major radius 1).
export const RING_HW = Math.sin(YAW) * (1 + TUBE) + TUBE * CT + 0.03, RING_HH = 1 + TUBE + 0.03;

function bakeRing(finKey, kpx) {
  const fin = FINISHES[finKey] || FINISHES.steel, SS = 2, Rss = kpx * SS;
  const Wb = Math.ceil(2 * RING_HW * Rss), Hb = Math.ceil(2 * RING_HH * Rss), cx = Wb / 2, cy = Hb / 2;
  const out = [mk(Wb / SS, Hb / SS), mk(Wb / SS, Hb / SS)]; if (!out[0] || !out[1]) return null;
  if (typeof out[0].x.createImageData !== 'function') return null;
  const layers = [0, 1].map(() => ({ z: new Float32Array(Wb * Hb).fill(-9), rgb: new Uint8ClampedArray(Wb * Hb * 3), set: new Uint8Array(Wb * Hb) }));
  const NU = Math.min(4200, Math.ceil(TAU * Rss * 1.1)), NV = Math.min(360, Math.ceil(TAU * TUBE * Rss * 1.3));
  const cu = new Float32Array(NU), su = new Float32Array(NU), cv = new Float32Array(NV), sv = new Float32Array(NV);
  for (let i = 0; i < NU; i++) { cu[i] = Math.cos(i * TAU / NU); su[i] = Math.sin(i * TAU / NU); }
  for (let i = 0; i < NV; i++) { cv[i] = Math.cos(i * TAU / NV); sv[i] = Math.sin(i * TAU / NV); }
  for (let iv = 0; iv < NV; iv++) {
    const nX = sv[iv], cvv = cv[iv], rr = 1 + TUBE * cvv, X = TUBE * nX;
    for (let iu = 0; iu < NU; iu++) {
      const nY = cvv * cu[iu], nZ = cvv * su[iu];
      const nz = -nX * ST + nZ * CT; if (nz < -0.06) continue;
      const Z = rr * su[iu], px = X * CT + Z * ST, pz = -X * ST + Z * CT, py = rr * cu[iu];
      const L = layers[pz >= 0 ? 1 : 0], sx = cx + px * Rss, sy = cy - py * Rss, ix = Math.floor(sx - 0.5), iy = Math.floor(sy - 0.5);
      let col = null;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const x = ix + dx, y = iy + dy; if (x < 0 || y < 0 || x >= Wb || y >= Hb) continue;
        const k = y * Wb + x; if (pz <= L.z[k]) continue;
        if (!col) col = shadePoint(nX * CT + nZ * ST, nY, nz, fin);
        L.z[k] = pz; L.set[k] = 1; L.rgb[k * 3] = col[0]; L.rgb[k * 3 + 1] = col[1]; L.rgb[k * 3 + 2] = col[2];
      }
    }
  }
  const w = Math.ceil(Wb / SS), h = Math.ceil(Hb / SS);
  for (let li = 0; li < 2; li++) {
    const L = layers[li], img = out[li].x.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const xx = x * SS + dx, yy = y * SS + dy; if (xx >= Wb || yy >= Hb) continue; const k = yy * Wb + xx; if (L.set[k]) { r += L.rgb[k * 3]; g += L.rgb[k * 3 + 1]; b += L.rgb[k * 3 + 2]; n++; } }
      const o = (y * w + x) * 4;
      if (n) { img.data[o] = r / n; img.data[o + 1] = g / n; img.data[o + 2] = b / n; img.data[o + 3] = Math.round(255 * n / (SS * SS)); }
    }
    out[li].x.putImageData(img, 0, 0);
  }
  return { back: out[0].c, front: out[1].c, w, h };
}

const spriteCache = new Map();
function ringSprite(finKey, R) {                                           // R = on-screen major radius in CSS-ish units; bake at device resolution
  const kpx = clamp(Math.round(R * (host.px || 0.6) * (host.dpr || 2) / 8) * 8, 24, 220), key = finKey + kpx;
  let s = spriteCache.get(key);
  if (s === undefined) { s = bakeRing(finKey, kpx); spriteCache.set(key, s); }
  return s;
}

export function prewarmRing(finKey, R) { try { ringSprite(finKey, R); } catch { /* sprite is baked lazily on first draw instead */ } }

// ------------------------------------------------------------------------------------------------ scene geometry
// Scene units: ring major radius R = 72. Ring 1 (index 0) is at the right, next to the free end; the handle is at the left.
export function sceneGeom(n) {
  const p = n >= 8 ? 74 : n >= 6 ? 84 : n >= 4 ? 98 : 118;
  const R = Math.max(62, Math.min(96, Math.round(p * 0.86))), T = R * TUBE, B = R * 0.09;
  const HL = 118, TL = 74, W = HL + n * p + TL;
  const barY = R + T + 50, yOff = barY + R + T + B + 8;
  const baseTop = yOff + R + T + 36, baseH = 54;
  return { n, R, T, B, p, HL, TL, W, H: baseTop + baseH + 18, barY, yOff, baseTop, baseH, ringX: (i) => W - TL - p * (i + 0.5) };
}

// ------------------------------------------------------------------------------------------------ the room
export function drawRoom(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1b0d11'); bg.addColorStop(0.45, '#130a0d'); bg.addColorStop(1, '#0a0608');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const sc = L.scene, cx = sc ? sc.x + sc.w / 2 : w / 2, cy = sc ? sc.y + sc.h * 0.42 : h * 0.4, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.18, rad * 0.04, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,196,120,0.26)'); lamp.addColorStop(0.4, 'rgba(255,150,90,0.08)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // a faint lattice screen: the diagonal lines of a carved window, very quiet
  ctx.strokeStyle = 'rgba(255,170,120,0.028)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -h; x < w; x += 46) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); }
  for (let x = 0; x < w + h; x += 46) { ctx.moveTo(x, 0); ctx.lineTo(x - h, h); }
  ctx.stroke();
  if (sc && !L.land) {                                                         // the table the puzzle stands on
    const G = sc.G ? sc.G : L.G, yT = L.sc.oy + (G.baseTop + 22) * L.sc.k, tg = ctx.createLinearGradient(0, yT, 0, h);
    tg.addColorStop(0, '#3a140f'); tg.addColorStop(0.25, '#230b0a'); tg.addColorStop(1, '#0c0506');
    ctx.fillStyle = tg; ctx.fillRect(0, yT, w, h - yT);
    ctx.strokeStyle = 'rgba(255,190,130,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, yT); ctx.lineTo(w, yT); ctx.stroke();
    const rnd = lcg(11); ctx.strokeStyle = 'rgba(255,170,110,0.05)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) { const yy = yT + 6 + Math.pow(rnd(), 1.6) * (h - yT); ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(w * 0.3, yy + rnd() * 6 - 3, w * 0.6, yy + rnd() * 6 - 3, w, yy); ctx.stroke(); }
  }
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  void t;
}

// ------------------------------------------------------------------------------------------------ the scene (base, bar, handle, rings)
// ctx is translated to the scene origin and scaled so one scene unit = k css-ish units by the caller. `st`:
//   pos[i]   0 (off the bar) .. 1 (on the bar) per ring; squash[i] 0..1 how far the ring is turning while it moves
//   glow[i]  0..1 a soft halo (movable ring / hint); shake[i] a horizontal shiver in units; sel (ring index or -1)
//   finish, t (seconds for the tassel), base (draw base board), labels, marks ([{ring, color}])
export function drawScene(ctx, G, st) {
  const { n, R, T, B, p } = G, fin = FINISHES[st.finish] || FINISHES.steel;
  if (st.base !== false) drawBase(ctx, G, st);
  // stems and shadows first (they sit behind everything), far ring first = ring 1 first
  const ys = [], sprite = ringSprite(st.finish || 'steel', R * (st.k || 1));
  for (let i = 0; i < n; i++) { const f = st.pos[i], ease = f; ys.push(lerp(G.yOff, G.barY, ease)); }
  for (let i = 0; i < n; i++) {
    const x = G.ringX(i) + (st.shake?.[i] || 0);
    if (st.base !== false) {
      ctx.fillStyle = '#c9ccd4'; const sw = 3.6;
      const g = ctx.createLinearGradient(x - sw, 0, x + sw, 0); g.addColorStop(0, '#5a5f6b'); g.addColorStop(0.4, '#f1f3f8'); g.addColorStop(1, '#4b505b');
      ctx.fillStyle = g; ctx.fillRect(x - sw / 2 - 1, ys[i] + R * 0.9, sw + 2, G.baseTop - ys[i] - R * 0.9 + 2);
      const hh = 1 - st.pos[i];                                                                                   // soft shadow on the base
      ctx.fillStyle = `rgba(0,0,0,${0.32 - 0.12 * st.pos[i]})`; ctx.beginPath(); ctx.ellipse(x + 6, G.baseTop + 6, 22 + hh * 6, 6, 0, 0, TAU); ctx.fill();
    }
  }
  // each ring: halo, back half, its slice of the bar, front half (ring 1 first, so a nearer ring covers a farther one)
  const barX0 = 30, barX1 = G.W - 20;
  for (let i = 0; i < n; i++) {
    const x = G.ringX(i) + (st.shake?.[i] || 0), y = ys[i], sq = 1 - 0.58 * (st.squash?.[i] || 0);
    if (st.glow && st.glow[i] > 0.01) halo(ctx, x, y, R, st.glow[i], st.glowRgb?.[i] || fin.glow);
    if (st.marks) for (const m of st.marks) if (m.ring === i) { ctx.strokeStyle = m.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, R * 0.5 * sq + 14, R + 14, 0, 0, TAU); ctx.stroke(); }
    const lo = i === n - 1 ? barX0 : x - G.p / 2 - 0.6, hi = i === 0 ? barX1 : x + G.p / 2 + 0.6;
    if (sprite) ctx.drawImage(sprite.back, x - RING_HW * R * sq, y - RING_HH * R, 2 * RING_HW * R * sq, 2 * RING_HH * R);
    else fallbackRing(ctx, x, y, R, sq, fin, 0);
    if (i === 0) drawLoopEnd(ctx, G, fin, st);
    bar(ctx, lo, hi, G.barY, B, fin);
    if (i === n - 1) drawHandle(ctx, G, st);
    if (sprite) ctx.drawImage(sprite.front, x - RING_HW * R * sq, y - RING_HH * R, 2 * RING_HW * R * sq, 2 * RING_HH * R);
    else fallbackRing(ctx, x, y, R, sq, fin, 1);
    if (st.sel === i) { ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.ellipse(x, y, R * 0.5 + 12, R + 12, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
  if (st.labels !== false) for (let i = 0; i < n; i++) plaque(ctx, G.ringX(i) + (st.shake?.[i] || 0), G.baseTop + G.baseH * 0.56, i + 1, st, st.glow?.[i] > 0.4);
}

function fallbackRing(ctx, x, y, R, sq, fin, half) {
  ctx.save(); ctx.strokeStyle = fin.tint; ctx.lineWidth = R * 0.2; ctx.beginPath();
  ctx.ellipse(x, y, R * 0.44 * sq, R, 0, half ? -Math.PI / 2 : Math.PI / 2, half ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke(); ctx.restore();
}

function halo(ctx, x, y, R, a, rgb) {
  const g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 1.45);
  g.addColorStop(0, `rgba(${rgb},${0.0})`); g.addColorStop(0.55, `rgba(${rgb},${0.15 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - R * 1.5, y - R * 1.5, R * 3, R * 3);
}

function bar(ctx, x0, x1, y, B, fin) {
  const g = ctx.createLinearGradient(0, y - B, 0, y + B);
  g.addColorStop(0, '#6c7380'); g.addColorStop(0.2, '#f7f9ff'); g.addColorStop(0.45, '#aeb6c6'); g.addColorStop(0.8, '#4b515e'); g.addColorStop(1, '#8d6a52');
  ctx.fillStyle = g; ctx.fillRect(x0, y - B, x1 - x0, 2 * B);
  void fin;
}

function drawLoopEnd(ctx, G, fin, st) {
  void fin; void st;
  const x1 = G.W - 20, y = G.barY, B = G.B;
  // the closed end of the bar: a long flat loop the rings travel over
  ctx.save();
  const g = ctx.createLinearGradient(0, y - B * 2.2, 0, y + B * 2.2);
  g.addColorStop(0, '#59606d'); g.addColorStop(0.25, '#f5f7ff'); g.addColorStop(0.55, '#9aa3b4'); g.addColorStop(1, '#434956');
  ctx.strokeStyle = g; ctx.lineWidth = B * 1.15; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(x1 - 44, y - B * 2.1, 56, B * 4.2, B * 2.1); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(x1 - 38, y - B * 0.9, 44, B * 1.8, B * 0.9); ctx.fill();
  ctx.restore();
}

function drawHandle(ctx, G, st) {
  const y = G.barY, B = G.B, x0 = 18, hl = G.HL - 12, r = B * 2.5, t = st.t || 0;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, '#ff8a6a'); g.addColorStop(0.18, '#e2432c'); g.addColorStop(0.6, '#a3241a'); g.addColorStop(1, '#4a0b08');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, y - r, hl, 2 * r, r); ctx.fill();
  for (const bx of [x0 + hl * 0.22, x0 + hl * 0.78]) {                                      // brass bands
    const bg = ctx.createLinearGradient(0, y - r, 0, y + r); bg.addColorStop(0, '#fff0b0'); bg.addColorStop(0.35, '#e1ac3d'); bg.addColorStop(1, '#6d4608');
    ctx.fillStyle = bg; ctx.fillRect(bx - 3.5, y - r - 1, 7, 2 * r + 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.34)'; ctx.beginPath(); ctx.roundRect(x0 + 10, y - r * 0.62, hl - 20, r * 0.22, r * 0.11); ctx.fill();
  // tassel from the end of the handle
  const sway = Math.sin(t * 1.4) * 3, kx = x0 + 6, ky = y + r;
  ctx.fillStyle = '#e1ac3d'; ctx.beginPath(); ctx.arc(kx, ky + 7, 5.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c4271c'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let s = -3; s <= 3; s++) { ctx.beginPath(); ctx.moveTo(kx + s * 0.9, ky + 11); ctx.quadraticCurveTo(kx + s * 2.4 + sway * 0.6, ky + 26, kx + s * 3.2 + sway, ky + 44 + Math.abs(s)); ctx.stroke(); }
  ctx.restore();
}

function drawBase(ctx, G, st) {
  void st;
  const x0 = 8, x1 = G.W - 8, y0 = G.baseTop, h = G.baseH, rise = 14;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(x0 + 6, y0 + h * 0.5 + 12, x1 - x0, h * 0.7, 18); ctx.fill();
  // top face (lacquer, seen from a little above) and front face
  const tg = ctx.createLinearGradient(0, y0 - rise, 0, y0 + 8); tg.addColorStop(0, '#8e2217'); tg.addColorStop(1, '#c4372a');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(x0 + 22, y0 - rise); ctx.lineTo(x1 - 22, y0 - rise); ctx.lineTo(x1, y0 + 6); ctx.lineTo(x0, y0 + 6); ctx.closePath(); ctx.fill();
  const fg = ctx.createLinearGradient(0, y0 + 6, 0, y0 + h); fg.addColorStop(0, '#a52a1d'); fg.addColorStop(0.5, '#7c1b13'); fg.addColorStop(1, '#3a0a07');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(x0, y0 + 4, x1 - x0, h, [0, 0, 14, 14]); ctx.fill();
  const rnd = lcg(7);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(40,6,4,0.35)';                                     // lacquer grain
  for (let i = 0; i < 26; i++) { const yy = y0 + 8 + rnd() * (h - 10), xa = x0 + 10 + rnd() * (x1 - x0 - 60); ctx.beginPath(); ctx.moveTo(xa, yy); ctx.bezierCurveTo(xa + 30, yy - 2, xa + 60, yy + 2, xa + 30 + rnd() * 90, yy); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,200,120,0.55)'; ctx.lineWidth = 2;                                 // brass inlay line
  ctx.beginPath(); ctx.moveTo(x0 + 14, y0 + 12); ctx.lineTo(x1 - 14, y0 + 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,150,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + 22, y0 - rise + 1); ctx.lineTo(x1 - 22, y0 - rise + 1); ctx.stroke();
  ctx.restore();
}

function plaque(ctx, x, y, num, st, lit) {
  ctx.save();
  const r = 15, g = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, r);
  if (lit) { g.addColorStop(0, '#fff6c8'); g.addColorStop(1, '#d99a2b'); } else { g.addColorStop(0, '#f1d58b'); g.addColorStop(1, '#8c5f14'); }
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 2.5, r, 0, TAU); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,4,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#3a1d02'; ctx.font = `700 ${num > 9 ? 13 : 17}px ${st.font || '"Cinzel", Georgia, serif'}`; ctx.textAlign = 'center'; ctx.fillText(String(num), x, y + 6);
  ctx.restore();
}

// A small standalone ring (title, result, icons): same sprite, drawn upright.
export function drawRingIcon(ctx, x, y, R, finish = 'steel', k = 1) {
  const sp = ringSprite(finish, R * k);
  if (sp) { ctx.drawImage(sp.back, x - RING_HW * R, y - RING_HH * R, 2 * RING_HW * R, 2 * RING_HH * R); ctx.drawImage(sp.front, x - RING_HW * R, y - RING_HH * R, 2 * RING_HW * R, 2 * RING_HH * R); }
  else fallbackRing(ctx, x, y, R, 1, FINISHES[finish] || FINISHES.steel, 0);
}

// Diagram for the Rules / lessons: the real scene without the base. spec = { bits, marks:[{ring,color}], glow:[ring..], width }
export function diagramSize(spec, w) {
  const G = sceneGeom(spec.bits.length), s = w / G.W;
  return { w, h: (G.yOff + G.R + G.T + 38) * s, s, G };
}
export function drawDiagram(ctx, spec, x, y, w, finish, t = 0) {
  const d = diagramSize(spec, w), G = d.G, n = spec.bits.length;
  ctx.save(); ctx.translate(x, y); ctx.scale(d.s, d.s);
  ctx.beginPath(); ctx.rect(-4, -4, G.W + 8, d.h / d.s + 8); ctx.clip();
  const glow = Array(n).fill(0); for (const r of spec.glow || []) glow[r] = 1;
  drawScene(ctx, G, { pos: spec.bits.map((b) => (b ? 1 : 0)), glow, glowRgb: Array(n).fill('120,230,170'), marks: spec.marks, finish, t, base: false, labels: false, k: d.s * (spec.k || 1) });
  // ring numbers above the rings, so the diagram can be read without the base plaques
  ctx.font = '700 22px "Cinzel", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,236,190,0.92)';
  for (let i = 0; i < n; i++) ctx.fillText(String(i + 1), G.ringX(i), G.yOff + G.R + G.T + 26);
  ctx.restore();
}
