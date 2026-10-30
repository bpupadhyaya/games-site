// Tractor Pull: all drawing of the world (sky, hills, barn, grandstand, crowd, track, tractor, sled, particles). Pure canvas.
// World units are metres; the camera keeps the tractor at a fixed screen position and scrolls the world past it.
import { TRACK_M, FT, STRIP_FT, STRIPS, RIGS, ft } from './sim.js';

const TAU = Math.PI * 2;
export const FONT = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Roboto, Arial, sans-serif";
export const DISPLAY = "'Avenir Next Condensed', 'Arial Narrow', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// One palette per ground.
export const PALS = [
  { // County Fair, afternoon
    sky: ['#5aa6e0', '#a9d4f0', '#fbe9c0'], sun: { x: 0.2, y: 0.2, c: '255,240,190', r: 70 }, far: '#7fa3b9', near: '#5d8a58', tree: '#3f6c3a',
    dirt: ['#b98a58', '#a2733f', '#7d5328'], moist: '48,26,12', dry: '240,215,160', dust: '222,196,150', night: false, rain: false, crowdA: 0.9, grass: '#6f9a45', lamp: false,
  },
  { // Harvest Dusk
    sky: ['#4a3a78', '#d9706a', '#ffc472'], sun: { x: 0.78, y: 0.42, c: '255,214,140', r: 110 }, far: '#6b5a86', near: '#53455f', tree: '#2f2a3d',
    dirt: ['#a5784f', '#8c6038', '#613f1e'], moist: '40,20,12', dry: '236,196,150', dust: '236,190,140', night: false, rain: false, crowdA: 0.7, grass: '#6c7a3a', lamp: true,
  },
  { // Grandstand Night
    sky: ['#070b22', '#142349', '#2d4577'], sun: { x: 0.8, y: 0.16, c: '236,240,255', r: 40 }, far: '#1b2c4d', near: '#14223d', tree: '#0d1830',
    dirt: ['#7b5a3e', '#61442b', '#3c2918'], moist: '20,12,6', dry: '196,170,130', dust: '170,160,150', night: true, rain: false, crowdA: 0.9, grass: '#2e4a2a', lamp: true,
  },
  { // Rain Delay
    sky: ['#5c6876', '#8895a3', '#c3cbd1'], sun: { x: 0.5, y: 0.3, c: '230,235,240', r: 60 }, far: '#74808b', near: '#5b6b60', tree: '#3a4a3e',
    dirt: ['#7a5c42', '#5e442e', '#3b2a1c'], moist: '22,14,8', dry: '178,150,116', dust: '160,150,140', night: false, rain: true, crowdA: 0.55, grass: '#4f6a46', lamp: false,
  },
];

// Rig looks (generic and unbranded).
const LOOKS = [
  { body: '#e6a826', dark: '#9c6a0c', trim: '#fff2c0', rim: '#d8d8d0', s: 0.66, cab: false, stacks: 1, dual: false, rr: 0.82, fr: 0.42, hood: 1.9, slick: false },
  { body: '#c43a22', dark: '#7b1d0e', trim: '#f4e6c8', rim: '#e6e2d6', s: 1.0, cab: true, stacks: 1, dual: false, rr: 0.98, fr: 0.55, hood: 2.2, slick: false },
  { body: '#2f7a46', dark: '#164a28', trim: '#f2e9a8', rim: '#f0e8c0', s: 1.1, cab: true, stacks: 2, dual: true, rr: 1.05, fr: 0.58, hood: 2.4, slick: false },
  { body: '#1c1f26', dark: '#08090c', trim: '#ff7a1a', rim: '#c9ced6', s: 1.0, cab: false, stacks: 3, dual: false, rr: 1.0, fr: 0.45, hood: 2.5, slick: true },
];
export const LOOK_COUNT = LOOKS.length;

const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
const hash = (n) => { let h = (Math.imul(n | 0, 2654435761) ^ 0x9e3779b9) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; return ((h >>> 0) % 10000) / 10000; };
const mix = (a, b, t) => a + (b - a) * t;
export function resetArt() { /* caches are rebuilt lazily */ }

// ---- particles (world metres). Kinds: dust, clod, smoke, spark ----------------------------------------------------------------
export function addPart(parts, rng, kind, x, y, vx, vy, life, size) {
  if (parts.length > 320) parts.shift();
  parts.push({ k: kind, x, y, vx, vy, t: 0, life, size, r: rng.next() });
}
export function stepFx(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.k === 'clod') { p.vy -= 12 * dt; if (p.y < 0) { p.y = 0; p.vy *= -0.25; p.vx *= 0.5; } }
    else if (p.k === 'smoke') { p.vy += 0.4 * dt; p.vx *= 1 - dt * 0.4; }
    else if (p.k === 'dust') { p.vy += 0.12 * dt; p.vx *= 1 - dt * 0.9; }
    else if (p.k === 'conf') { p.vy -= 5 * dt; p.vx *= 1 - dt * 0.5; if (p.vy < -2.4) p.vy = -2.4; }
  }
}

// ---- the camera ----------------------------------------------------------------------------------------------------------
export function makeCam(rect, p) {
  const s = Math.max(26, Math.min(100, Math.min(rect.w / 10.2, rect.h / 5.0)));
  const gy = rect.y + Math.max(rect.h * 0.58, Math.min(rect.h * 0.74, rect.h - 3.0 * s)), ax = rect.x + rect.w * 0.58;
  return { s, gy, ax, camX: p.x, rect, X: (wx) => ax + (wx - p.x) * s, Y: (wy) => gy - wy * s };
}

// ---- scene layers ---------------------------------------------------------------------------------------------------------------
function drawSky(ctx, rect, pal, gy, t) {
  const g = ctx.createLinearGradient(0, rect.y, 0, gy);
  g.addColorStop(0, pal.sky[0]); g.addColorStop(0.55, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, gy - rect.y + 2);
  const sx = rect.x + rect.w * pal.sun.x, sy = rect.y + (gy - rect.y) * pal.sun.y;
  const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, pal.sun.r * 2.4);
  sg.addColorStop(0, `rgba(${pal.sun.c},0.95)`); sg.addColorStop(0.25, `rgba(${pal.sun.c},0.5)`); sg.addColorStop(1, `rgba(${pal.sun.c},0)`);
  ctx.fillStyle = sg; ctx.fillRect(rect.x, rect.y, rect.w, gy - rect.y);
  if (pal.night) {
    for (let i = 0; i < 46; i++) {
      const x = rect.x + hash(i * 3 + 1) * rect.w, y = rect.y + hash(i * 3 + 2) * (gy - rect.y) * 0.62, a = 0.35 + 0.5 * hash(i * 7 + 3);
      ctx.fillStyle = `rgba(255,255,255,${a * (0.75 + 0.25 * Math.sin(t * 1.5 + i))})`; ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 20, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(240,244,255,0.97)'; ctx.fillRect(sx - 22, sy - 22, 44, 44);
    ctx.fillStyle = pal.sky[1]; ctx.beginPath(); ctx.arc(sx + 9, sy - 4, 17, 0, TAU); ctx.fill(); ctx.restore();
  } else if (!pal.rain) {
    ctx.fillStyle = `rgba(${pal.sun.c},0.95)`; ctx.beginPath(); ctx.arc(sx, sy, pal.sun.r * 0.28, 0, TAU); ctx.fill();
  }
}
function drawClouds(ctx, rect, pal, gy, camX, s, t) {
  const n = pal.rain ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const per = rect.w * 1.7, base = hash(i * 11 + 4) * per;
    const x = rect.x + ((base - camX * s * 0.05 - t * (6 + i * 1.5)) % per + per) % per - rect.w * 0.35;
    const y = rect.y + (gy - rect.y) * (0.1 + 0.32 * hash(i * 5 + 9)), w = rect.w * (0.18 + 0.12 * hash(i + 31)), h = w * 0.26;
    const col = pal.night ? '40,60,100' : pal.rain ? '120,130,142' : '255,255,255', a = pal.night ? 0.35 : pal.rain ? 0.7 : 0.55;
    ctx.fillStyle = `rgba(${col},${a})`;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + w * (0.2 + k * 0.2), y + (k % 2) * h * 0.2, w * 0.2, h * (0.7 - (k % 2) * 0.2), 0, 0, TAU); ctx.fill(); }
  }
}
function drawHills(ctx, rect, pal, gy, camX, s) {
  const layers = [{ k: 0.1, col: pal.far, amp: 0.16, f: 1.7, base: 0.5 }, { k: 0.2, col: pal.near, amp: 0.1, f: 3.1, base: 0.34 }];
  for (const L of layers) {
    const off = camX * s * L.k, top = gy - (gy - rect.y) * L.base;
    ctx.fillStyle = L.col; ctx.beginPath(); ctx.moveTo(rect.x, gy);
    for (let x = 0; x <= rect.w; x += 16) {
      const wx = (x + off) / rect.w * 6.28 * L.f;
      ctx.lineTo(rect.x + x, top - (Math.sin(wx) * 0.5 + Math.sin(wx * 2.3 + 1.1) * 0.3 + 0.8) * (gy - rect.y) * L.amp * 0.5);
    }
    ctx.lineTo(rect.x + rect.w, gy); ctx.closePath(); ctx.fill();
  }
}
// Tiled midground (barn, silo, tree clumps, hay, windmill-free) with a 70 m period, parallax 0.35.
function drawFarm(ctx, rect, pal, gy, camX, s) {
  const k = 0.35, period = 70 * s * k, off = camX * s * k;
  const first = Math.floor((off - rect.w) / period) - 1, last = Math.floor((off + rect.w * 2) / period) + 1;
  const bs = s * k * 1.25;
  for (let tile = first; tile <= last; tile++) {
    const bx = rect.x + tile * period - off + rect.w * 0.35;
    if (bx < rect.x - period * 0.6 || bx > rect.x + rect.w + period * 0.3) continue;
    const dark = pal.night ? 0.45 : pal.rain ? 0.8 : 1;
    const bw = 13 * bs, bh = 8.2 * bs, x0 = bx + 2 * bs, yb = gy - 0.2 * bs;
    // barn
    const fillBarn = pal.night ? '#5a1c18' : pal.rain ? '#8a3a2c' : '#b8352a';
    ctx.fillStyle = fillBarn; ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x0, yb - bh * 0.62); ctx.lineTo(x0 + bw * 0.12, yb - bh * 0.88); ctx.lineTo(x0 + bw * 0.5, yb - bh); ctx.lineTo(x0 + bw * 0.88, yb - bh * 0.88); ctx.lineTo(x0 + bw, yb - bh * 0.62); ctx.lineTo(x0 + bw, yb); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.night ? '#26262e' : '#4a4f58'; ctx.beginPath(); ctx.moveTo(x0 - bw * 0.04, yb - bh * 0.6); ctx.lineTo(x0 + bw * 0.12, yb - bh * 0.92); ctx.lineTo(x0 + bw * 0.5, yb - bh * 1.04); ctx.lineTo(x0 + bw * 0.88, yb - bh * 0.92); ctx.lineTo(x0 + bw * 1.04, yb - bh * 0.6); ctx.lineTo(x0 + bw * 0.88, yb - bh * 0.66); ctx.lineTo(x0 + bw * 0.5, yb - bh * 0.96); ctx.lineTo(x0 + bw * 0.12, yb - bh * 0.66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.night ? '#c8c2b0' : '#f4efe2'; rr(ctx, x0 + bw * 0.34, yb - bh * 0.5, bw * 0.32, bh * 0.5, 2); ctx.fill();
    ctx.strokeStyle = fillBarn; ctx.lineWidth = Math.max(2, bs * 0.18);
    ctx.beginPath(); ctx.moveTo(x0 + bw * 0.34, yb - bh * 0.5); ctx.lineTo(x0 + bw * 0.66, yb); ctx.moveTo(x0 + bw * 0.66, yb - bh * 0.5); ctx.lineTo(x0 + bw * 0.34, yb); ctx.stroke();
    ctx.fillStyle = pal.night ? '#ffd47a' : '#f4efe2'; ctx.fillRect(x0 + bw * 0.44, yb - bh * 0.86, bw * 0.12, bh * 0.1);
    // silo
    const sx = x0 + bw + 0.8 * bs, sw = 3.6 * bs, sh = 12 * bs;
    const sg = ctx.createLinearGradient(sx, 0, sx + sw, 0); sg.addColorStop(0, pal.night ? '#5b6270' : '#dde2e6'); sg.addColorStop(0.5, pal.night ? '#7d8696' : '#f6f8fa'); sg.addColorStop(1, pal.night ? '#3e4552' : '#a9b2ba');
    ctx.fillStyle = sg; ctx.fillRect(sx, yb - sh, sw, sh);
    ctx.fillStyle = pal.night ? '#3a414f' : '#8e99a4'; ctx.beginPath(); ctx.ellipse(sx + sw / 2, yb - sh, sw / 2, sw * 0.42, 0, Math.PI, 0); ctx.fill();
    // tree clumps
    for (let i = 0; i < 3; i++) {
      const tx = bx - 14 * bs - i * 3.4 * bs, tr = (2.2 + hash(tile * 5 + i) * 1.2) * bs;
      ctx.fillStyle = pal.tree; ctx.beginPath(); ctx.arc(tx, yb - tr * 0.9, tr, 0, TAU); ctx.arc(tx + tr * 0.8, yb - tr * 0.6, tr * 0.8, 0, TAU); ctx.fill();
    }
    // hay bales
    ctx.fillStyle = pal.night ? '#6a5a2c' : '#d9b94a';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x0 + bw + 6.5 * bs + i * 2.1 * bs, yb - 0.8 * bs, 0.9 * bs, 0, TAU); ctx.fill(); }
    void dark;
  }
}
// Grandstand with floodlights; parallax 0.6, 90 m period.
function drawStand(ctx, rect, pal, gy, camX, s) {
  const k = 0.62, period = 90 * s * k, off = camX * s * k;
  const first = Math.floor((off - rect.w) / period) - 1, last = Math.floor((off + rect.w * 2) / period) + 1;
  const u = s * k * 1.3;
  for (let tile = first; tile <= last; tile++) {
    const x0 = rect.x + tile * period - off + rect.w * 0.2, y0 = gy - 0.6 * u;
    if (x0 > rect.x + rect.w + 40 || x0 + period < rect.x - 40) continue;
    const w = 26 * u, h = 5.4 * u;
    // roof and posts
    ctx.fillStyle = pal.night ? '#2a3047' : '#8f9aa6'; ctx.fillRect(x0, y0 - h - 1.4 * u, w, 0.5 * u);
    ctx.fillStyle = pal.night ? '#1d2236' : '#707c88';
    for (let i = 0; i <= 5; i++) ctx.fillRect(x0 + (w * i) / 5 - 0.12 * u, y0 - h - 1 * u, 0.24 * u, h + 0.9 * u);
    // tiers
    for (let r = 0; r < 4; r++) {
      const yy = y0 - r * h / 4;
      ctx.fillStyle = r % 2 ? (pal.night ? '#3a4260' : '#c9d0d8') : (pal.night ? '#2f3652' : '#b7c0ca'); ctx.fillRect(x0, yy - h / 4, w, h / 4 + 0.6);
      // seated crowd (dots with bodies)
      const n = 36;
      for (let i = 0; i < n; i++) {
        const hx = x0 + (i + 0.5) * w / n + (hash(tile * 97 + r * 41 + i) - 0.5) * 0.18 * u, hy = yy - h / 4 * 0.62;
        const c = hash(tile * 31 + r * 17 + i * 3), cols = ['#d94a3a', '#f2c14a', '#3a79c4', '#e9e4d6', '#52a35c', '#9a5cc0', '#ef8a3c'];
        ctx.fillStyle = cols[Math.floor(c * cols.length)]; ctx.globalAlpha = pal.night ? 0.8 : 1;
        ctx.fillRect(hx - 0.28 * u, hy, 0.56 * u, h / 4 * 0.5);
        ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(hx, hy - 0.22 * u, 0.24 * u, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    // floodlight pole
    if (pal.lamp) {
      const px = x0 + w + 2.4 * u, ph = 13 * u;
      ctx.fillStyle = pal.night ? '#10141f' : '#6a737d'; ctx.fillRect(px - 0.18 * u, y0 - ph, 0.36 * u, ph);
      ctx.fillStyle = pal.night ? '#2a2f3c' : '#59616b'; rr(ctx, px - 1.5 * u, y0 - ph - 1.2 * u, 3 * u, 1.2 * u, 0.2 * u); ctx.fill();
      ctx.fillStyle = pal.night ? '#fffdf0' : '#fff0b0'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(px - 1.05 * u + k * 0.7 * u, y0 - ph - 0.6 * u, 0.24 * u, 0, TAU); ctx.fill(); }
      if (pal.night) { const lg = ctx.createRadialGradient(px, y0 - ph - 0.5 * u, 2, px, y0 - ph - 0.5 * u, 18 * u); lg.addColorStop(0, 'rgba(255,244,196,0.5)'); lg.addColorStop(1, 'rgba(255,244,196,0)'); ctx.fillStyle = lg; ctx.fillRect(px - 18 * u, y0 - ph - 18 * u, 36 * u, 36 * u); }
    }
  }
}

// ---- near layer: fence, standing crowd, bunting and markers (parallax 1 with the track) ---------------------------------------------
function drawFenceCrowd(ctx, cam, pal, p, t, cheer) {
  const { s, gy, rect } = cam;
  const fy = gy - 0.1 * s, fh = 1.05 * s;
  const x0m = cam.camX - (cam.ax - rect.x) / s - 2, x1m = cam.camX + (rect.x + rect.w - cam.ax) / s + 2;
  // standing crowd behind the rail
  const step = 0.85;
  for (let i = Math.floor(x0m / step); i <= Math.ceil(x1m / step); i++) {
    const x = cam.X(i * step), h = hash(i * 13 + 7), c = hash(i * 7 + 2);
    if (h < 0.18) continue;
    const bob = Math.sin(t * (2 + h * 3) + i) * 0.04 * s * (cheer ? 3 : 1), arms = cheer ? Math.abs(Math.sin(t * 6 + i)) : 0;
    const cols = ['#d94a3a', '#f2c14a', '#3a79c4', '#efe9d8', '#52a35c', '#9a5cc0', '#ef8a3c', '#2c3a52'];
    const bodyH = (0.95 + h * 0.3) * s, w = 0.55 * s, base = fy - 0.05 * s + 0.25 * s;
    ctx.globalAlpha = pal.night ? 0.8 : pal.crowdA + 0.1;
    ctx.fillStyle = cols[Math.floor(c * cols.length)]; rr(ctx, x - w / 2, base - bodyH + bob, w, bodyH, w * 0.4); ctx.fill();
    ctx.fillStyle = ['#e8c4a0', '#c99a72', '#8d6240', '#f1d3b4'][Math.floor(h * 4) % 4]; ctx.beginPath(); ctx.arc(x, base - bodyH - 0.2 * s + bob, 0.26 * s, 0, TAU); ctx.fill();
    if (arms > 0.02 || h > 0.8) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(2, 0.12 * s); ctx.beginPath(); ctx.moveTo(x - w * 0.4, base - bodyH * 0.8 + bob); ctx.lineTo(x - w * 0.8, base - bodyH * (0.9 + arms * 0.55) + bob); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // rail
  ctx.fillStyle = pal.night ? '#8d97a8' : '#f2ece0';
  ctx.fillRect(rect.x, fy - fh * 0.15, rect.w, 0.14 * s);
  ctx.fillRect(rect.x, fy + fh * 0.18, rect.w, 0.12 * s);
  for (let i = Math.floor(x0m / 3); i <= Math.ceil(x1m / 3); i++) { const x = cam.X(i * 3); ctx.fillStyle = pal.night ? '#6a7385' : '#d8d0bf'; ctx.fillRect(x - 0.07 * s, fy - fh * 0.2, 0.14 * s, fh * 0.75); }
  // bunting
  for (let i = Math.floor(x0m / 6); i <= Math.ceil(x1m / 6); i++) {
    const xa = cam.X(i * 6), xb = cam.X(i * 6 + 6), ya = fy - 2.0 * s;
    ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.quadraticCurveTo((xa + xb) / 2, ya + 0.7 * s, xb, ya); ctx.stroke();
    const cols = ['#d94a3a', '#f2c14a', '#3a79c4', '#efe9d8'];
    for (let k = 1; k < 6; k++) {
      const u = k / 6, x = mix(xa, xb, u), y = ya + 4 * (u - u * u) * 0.7 * s;
      ctx.fillStyle = cols[(i * 6 + k) & 3]; ctx.globalAlpha = pal.night ? 0.8 : 1; ctx.beginPath(); ctx.moveTo(x - 0.22 * s, y); ctx.lineTo(x + 0.22 * s, y); ctx.lineTo(x, y + 0.5 * s); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}
function drawMarkers(ctx, cam, pal, p) {
  const { s, gy } = cam;
  const rectR = cam.rect.x + cam.rect.w;
  for (let f = 0; f <= 300; f += 50) {
    const xm = f / FT, x = cam.X(xm);
    if (x < cam.rect.x - 60 || x > rectR + 60) continue;
    if (f === 0 || f === 300) continue;
    const w = 1.5 * s, h = 1.0 * s, y = gy + 0.5 * s - 1.7 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - w / 2 + 3, y + 3, w, h);
    ctx.fillStyle = '#f8f4ea'; ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = '#c43a22'; ctx.fillRect(x - w / 2, y, w, h * 0.16);
    ctx.fillStyle = '#2b1d14'; ctx.font = `800 ${Math.round(h * 0.42)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(f), x, y + h * 0.58);
    ctx.font = `700 ${Math.round(h * 0.2)}px ${FONT}`; ctx.fillText('FEET', x, y + h * 0.86);
  }
}
// The start line and the finish arch.
function drawLines(ctx, cam, pal) {
  const { s, gy } = cam;
  const xs = cam.X(0), xf = cam.X(TRACK_M);
  // start line on the dirt
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(xs - 0.1 * s, gy - 0.02 * s, 0.2 * s, 0.7 * s);
  // finish arch
  if (xf > cam.rect.x - 100 && xf < cam.rect.x + cam.rect.w + 100) {
    const ph = 4.4 * s;
    ctx.fillStyle = pal.night ? '#cfd6e2' : '#f2f2ee'; ctx.fillRect(xf - 0.2 * s, gy - ph, 0.4 * s, ph + 0.7 * s);
    ctx.fillRect(xf + 3.2 * s, gy - ph, 0.4 * s, ph + 0.7 * s);
    const bx = xf - 0.2 * s, bw = 4 * s, by = gy - ph - 0.2 * s;
    ctx.fillStyle = '#f8f4ea'; ctx.fillRect(bx, by, bw, 1.15 * s);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) { ctx.fillStyle = '#1c1c1c'; ctx.fillRect(bx + i * bw / 16, by + j * 1.15 * s / 3, bw / 16, 1.15 * s / 3); }
    ctx.fillStyle = '#c43a22'; ctx.fillRect(bx, by + 1.15 * s, bw, 0.8 * s);
    ctx.fillStyle = '#fff6e2'; ctx.font = `800 ${Math.round(0.55 * s)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FULL PULL 300 FT', bx + bw / 2, by + 1.55 * s);
  }
}

// ---- the track surface ----------------------------------------------------------------------------------------------------------------
function drawTrack(ctx, cam, pal, track, p, wet) {
  const { s, gy, rect } = cam;
  const bottom = rect.y + rect.h, top = gy - 0.05 * s;
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, pal.dirt[0]); g.addColorStop(0.35, pal.dirt[1]); g.addColorStop(1, pal.dirt[2]);
  ctx.fillStyle = g; ctx.fillRect(rect.x, top, rect.w, bottom - top);
  // grip strips as wide bands over the lane; the strip you are on is highlighted at its edge
  const laneTop = gy + 0.55 * s, laneH = Math.max(18, bottom - laneTop - 4);
  for (let i = 0; i < STRIPS; i++) {
    const x0 = cam.X(i * STRIP_FT / FT), x1 = cam.X((i + 1) * STRIP_FT / FT);
    if (x1 < rect.x || x0 > rect.x + rect.w) continue;
    const gv = track.strips[i], d = gv - 1;
    const a = Math.min(0.62, Math.abs(d) * 3.4);
    ctx.fillStyle = d >= 0 ? `rgba(${pal.moist},${a})` : `rgba(${pal.dry},${a * 0.95})`;
    ctx.fillRect(x0, top, x1 - x0, bottom - top);
    if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x0, top, 1.5, bottom - top); }
  }
  if (wet) { ctx.fillStyle = 'rgba(190,210,230,0.1)'; ctx.fillRect(rect.x, top, rect.w, (bottom - top) * 0.5); }
  // surface lighting: a dark far edge and light near the camera
  const sh = ctx.createLinearGradient(0, top, 0, top + 0.9 * s); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(rect.x, top, rect.w, 0.9 * s);
  // a few clods and stones for texture (stable by world position)
  for (let i = Math.floor((cam.camX - 12) * 1.4); i < Math.ceil((cam.camX + 14) * 1.4); i++) {
    const h1 = hash(i * 9 + 5), h2 = hash(i * 17 + 3);
    const x = cam.X(i / 1.4 + h1 * 0.4), y = top + (0.2 + h2 * 1.6) * s + 0.2 * s;
    if (y > bottom) continue;
    ctx.fillStyle = h1 > 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,240,210,0.14)'; ctx.beginPath(); ctx.ellipse(x, y, (0.12 + h1 * 0.16) * s, (0.05 + h2 * 0.06) * s, 0, 0, TAU); ctx.fill();
  }
  // a quicker foreground layer of specks gives the feeling of speed
  for (let i = 0; i < 16; i++) {
    const per = rect.w + 160, h1 = hash(i * 29 + 7), h2 = hash(i * 31 + 11);
    const x = rect.x + (((h1 * per * 3 - cam.camX * s * 1.6) % per) + per) % per - 80, y = gy + (1.5 + h2 * 2.2) * s;
    if (y > bottom - 6) continue;
    ctx.fillStyle = h1 > 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,240,210,0.13)';
    ctx.beginPath(); ctx.ellipse(x, y, (0.35 + h1 * 0.4) * s, (0.07 + h2 * 0.06) * s, 0, 0, TAU); ctx.fill();
  }
  // ruts left by the tractor and the sled, and the hole when the tyres dug
  if (p) {
    const xa = cam.X(0), xb = cam.X(Math.min(p.x, TRACK_M));
    if (xb > xa) {
      const x0 = Math.max(xa, rect.x - 20), x1 = Math.min(xb, rect.x + rect.w + 20);
      if (x1 > x0) {
        ctx.fillStyle = 'rgba(30,16,8,0.32)'; ctx.fillRect(x0, gy + 0.18 * s, x1 - x0, 0.2 * s);
        ctx.fillStyle = 'rgba(30,16,8,0.2)'; ctx.fillRect(x0, gy + 0.62 * s, x1 - x0, 0.14 * s);
      }
    }
  }
  void laneTop; void laneH;
}

// ---- tractor ----------------------------------------------------------------------------------------------------------------------
function lugWheel(ctx, cx, cy, R, ang, look, big) {
  ctx.save(); ctx.translate(cx, cy);
  const lugs = big ? 20 : 15;
  // tread blocks: tapered lugs that spin with the wheel, a lit and a shaded face each
  for (let i = 0; i < lugs; i++) {
    const a = ang + (i * TAU) / lugs;
    ctx.save(); ctx.rotate(a);
    const lh = R * (look.slick && big ? 0.07 : 0.17), w0 = R * 0.26, w1 = R * 0.2;
    ctx.fillStyle = '#17120e';
    ctx.beginPath(); ctx.moveTo(R * 0.86, -w0 / 2); ctx.lineTo(R * 0.86 + lh, -w1 / 2); ctx.lineTo(R * 0.86 + lh, w1 / 2); ctx.lineTo(R * 0.86, w0 / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(R * 0.86, -w0 / 2, lh, w0 * 0.22);
    ctx.restore();
  }
  // carcass: dark rubber with a lit shoulder and a pale sidewall ring
  const tg = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.15, 0, 0, R);
  tg.addColorStop(0, '#4a423a'); tg.addColorStop(0.7, '#241e18'); tg.addColorStop(1, '#100c09');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, R * 0.96, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.lineWidth = R * 0.035; ctx.beginPath(); ctx.arc(0, 0, R * 0.88, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  // rim: dished steel disc, bolt circle and a hub cap
  const rg = ctx.createRadialGradient(-R * 0.15, -R * 0.18, R * 0.02, 0, 0, R * 0.56);
  rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.55, look.rim); rg.addColorStop(1, '#8c8a82');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, R * 0.56, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = R * 0.035; ctx.stroke();
  ctx.strokeStyle = look.dark; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = ang + (i * TAU) / 8; ctx.fillStyle = '#3b3a36'; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36, R * 0.04, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.36 - R * 0.012, Math.sin(a) * R * 0.36 - R * 0.012, R * 0.013, 0, TAU); ctx.fill(); }
  const hg = ctx.createRadialGradient(-R * 0.04, -R * 0.04, 1, 0, 0, R * 0.17);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.35, look.body); hg.addColorStop(1, look.dark);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, R * 0.17, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawTractor(ctx, cam, p, look, t, parts) {
  const { s } = cam;
  const x = cam.X(p.x), y = cam.gy;
  const sc = s * look.s, lift = Math.max(0, p.lift) * 0.2;     // nose lift in radians (about 11 degrees at 1.0)
  const bounce = p.phase === 'run' ? Math.sin(t * (14 + p.v * 3)) * 0.012 * Math.min(1, p.v) : Math.sin(t * 30) * 0.004;
  ctx.save();
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 1.2 * sc, y + 0.1 * sc, 2.7 * sc, 0.2 * sc, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y + bounce * s); ctx.rotate(-lift); ctx.scale(sc, sc);
  const Rr = look.rr, Rf = look.fr, wb = look.hood + 0.35;
  const sb = 1 / sc;               // 1 screen px in local units
  const lw = (px) => px * sb;
  // exhaust stacks (behind the hood)
  const stacks = look.stacks;
  for (let i = 0; i < stacks; i++) {
    const sx = wb - 0.5 - i * 0.28, sh = 1.65 + (look.slick ? 0.35 : 0.6) + i * 0.05;
    const sg = ctx.createLinearGradient(sx - 0.07, 0, sx + 0.07, 0); sg.addColorStop(0, '#7b828b'); sg.addColorStop(0.5, '#d9dee3'); sg.addColorStop(1, '#4e555d');
    ctx.fillStyle = sg; ctx.fillRect(sx - 0.07, -sh - Rr * 0.45, 0.14, sh + 0.2);
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(sx, -sh - Rr * 0.45, 0.1, 0.045, 0, 0, TAU); ctx.fill();
  }
  // rear wheel(s) (dual wheels are drawn as a second, slightly offset and lighter tyre)
  if (look.dual) lugWheel(ctx, -0.18, -Rr - 0.02, Rr, p.wheel, look, true);
  // chassis / hood
  const hoodTop = Rr * 0.9 + 0.35, hoodBot = Rf * 0.75 + 0.15;
  // engine block and axle beam under the hood tie the two wheels together
  const eg = ctx.createLinearGradient(0, -hoodBot, 0, -0.1); eg.addColorStop(0, '#59616b'); eg.addColorStop(1, '#1d2127');
  ctx.fillStyle = eg; ctx.fillRect(0.1, -hoodBot + 0.02, wb + 0.2, hoodBot - 0.2);
  ctx.fillStyle = '#2b3037'; ctx.fillRect(0, -Rf * 1.05, wb + 0.25, 0.14);
  // front weights
  if (look.s > 0.8) { ctx.fillStyle = '#4a515a'; rr(ctx, wb + 0.38, -hoodBot - 0.2, 0.3, 0.55, 0.05); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(wb + 0.4, -hoodBot - 0.18, 0.05, 0.5); }
  const bg = ctx.createLinearGradient(0, -hoodTop - 0.4, 0, -hoodBot + 0.1);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.18, look.body); bg.addColorStop(1, look.dark);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(0.3, -hoodBot + 0.05); ctx.lineTo(0.3, -hoodTop - 0.35); ctx.lineTo(wb - 0.35, -hoodTop - 0.28); ctx.quadraticCurveTo(wb + 0.35, -hoodTop - 0.2, wb + 0.4, -hoodTop + 0.35); ctx.lineTo(wb + 0.42, -hoodBot + 0.05); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = lw(1.5); ctx.stroke();
  // trim stripe, louvres, highlight and grille
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0.5, -hoodTop - 0.31, wb - 1.0, 0.045);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; for (let i = 0; i < 5; i++) ctx.fillRect(0.7 + i * 0.12, -hoodTop - 0.12, 0.06, 0.26);
  ctx.fillStyle = look.trim; ctx.fillRect(0.3, -hoodTop + 0.05, wb + 0.1, 0.1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; i++) ctx.fillRect(wb + 0.2, -hoodBot - 0.12 - i * 0.12, 0.2, 0.06);
  // headlamp
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(wb + 0.36, -hoodTop + 0.1, 0.1, 0, TAU); ctx.fill();
  // front axle strut and steering wheel-side: the front tyre stands in front of the hood
  ctx.fillStyle = '#2d333a'; ctx.fillRect(wb - 0.1, -hoodBot - 0.02, 0.28, hoodBot - Rf + 0.04);
  lugWheel(ctx, wb + 0.2, -Rf, Rf, p.wheel * 0.9, look, false);
  if (look.cab) {
    // cab
    const cg = ctx.createLinearGradient(0, -3.0, 0, -hoodTop); cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.2, look.body); cg.addColorStop(1, look.dark);
    ctx.fillStyle = cg; rr(ctx, -0.65, -hoodTop - 1.45, 1.35, 1.5, 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(140,200,225,0.88)'; rr(ctx, -0.5, -hoodTop - 1.32, 1.05, 1.0, 0.1); ctx.fill();
    ctx.fillStyle = look.dark; rr(ctx, -0.78, -hoodTop - 1.55, 1.6, 0.16, 0.05); ctx.fill();
    ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(-0.55, -hoodTop - 1.62, 0.07, 0, TAU); ctx.arc(0.55, -hoodTop - 1.62, 0.07, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = lw(1.2); ctx.beginPath(); ctx.moveTo(0.1, -hoodTop - 0.28); ctx.lineTo(0.1, -hoodTop + 0.02); ctx.stroke();
  } else {
    ctx.fillStyle = look.dark; rr(ctx, -0.6, -hoodTop - 0.15, 0.95, 0.12, 0.05); ctx.fill();
    ctx.fillStyle = '#2d241c'; rr(ctx, -0.5, -hoodTop - 0.5, 0.65, 0.4, 0.1); ctx.fill();
  }
  // rear fender and rear wheel
  lugWheel(ctx, 0, -Rr, Rr, p.wheel, look, true);
  const fg = ctx.createLinearGradient(0, -Rr * 2.1, 0, -Rr * 1.2); fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.3, look.body); fg.addColorStop(1, look.dark);
  ctx.strokeStyle = fg; ctx.lineWidth = 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -Rr, Rr * 1.12, Math.PI * 1.03, Math.PI * 1.98); ctx.stroke();
  // driver: seat, torso, arm to the steering wheel, helmet with a visor (small motion with the engine)
  {
    const hx = look.cab ? 0.0 : 0.12, sway = Math.sin(t * 22) * 0.012 * (0.5 + p.rpm) + (p.lift > 0.05 ? 0.03 * p.lift : 0);
    const seatY = look.cab ? -hoodTop - 0.34 : -2 * Rr + 0.16;
    const hy = seatY - 0.62 + sway;
    if (!look.cab) { ctx.fillStyle = '#2a2420'; rr(ctx, hx - 0.38, seatY - 0.12, 0.5, 0.14, 0.05); ctx.fill(); ctx.fillRect(hx - 0.4, seatY - 0.45, 0.08, 0.36); }
    // steering column and wheel
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(hx + 0.62, seatY + 0.5); ctx.lineTo(hx + 0.46, hy + 0.5); ctx.stroke();
    ctx.lineWidth = 0.06; ctx.beginPath(); ctx.ellipse(hx + 0.44, hy + 0.5, 0.06, 0.2, 0.5, 0, TAU); ctx.stroke();
    // legs and torso
    ctx.strokeStyle = '#2c3a52'; ctx.lineWidth = 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 0.2, seatY - 0.12); ctx.lineTo(hx + 0.32, seatY - 0.1); ctx.lineTo(hx + 0.36, seatY + 0.18); ctx.stroke();
    const tg = ctx.createLinearGradient(hx - 0.25, 0, hx + 0.2, 0); tg.addColorStop(0, '#9c2a1c'); tg.addColorStop(1, '#d9503a');
    ctx.strokeStyle = tg; ctx.lineWidth = 0.34;
    ctx.beginPath(); ctx.moveTo(hx - 0.16, seatY - 0.18); ctx.lineTo(hx - 0.02 + sway, hy + 0.3); ctx.stroke();
    // arm
    ctx.strokeStyle = '#c2402b'; ctx.lineWidth = 0.13;
    ctx.beginPath(); ctx.moveTo(hx + 0.02, hy + 0.3); ctx.lineTo(hx + 0.26, hy + 0.58); ctx.lineTo(hx + 0.44, hy + 0.5); ctx.stroke();
    ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(hx + 0.45, hy + 0.5, 0.055, 0, TAU); ctx.fill();
    // helmet: shell, visor band, chin guard and a face shadow
    ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(hx + 0.04, hy, 0.15, 0, TAU); ctx.fill();
    const hg = ctx.createLinearGradient(hx - 0.2, hy - 0.2, hx + 0.2, hy + 0.15); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.3, look.body); hg.addColorStop(1, look.dark);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy - 0.02, 0.22, Math.PI * 0.62, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = 'rgba(12,16,24,0.88)'; rr(ctx, hx + 0.02, hy - 0.08, 0.2, 0.11, 0.04); ctx.fill();
    ctx.fillStyle = 'rgba(160,210,255,0.5)'; ctx.fillRect(hx + 0.07, hy - 0.06, 0.1, 0.03);
    ctx.fillStyle = look.dark; ctx.beginPath(); ctx.moveTo(hx + 0.12, hy + 0.05); ctx.lineTo(hx + 0.2, hy + 0.1); ctx.lineTo(hx + 0.12, hy + 0.15); ctx.closePath(); ctx.fill();
  }
  // drawbar and hitch
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-1.45, -0.55, 1.5, 0.14);
  ctx.fillStyle = '#cfa04a'; ctx.beginPath(); ctx.arc(-1.4, -0.48, 0.1, 0, TAU); ctx.fill();
  if (look.slick) { ctx.fillStyle = '#d9dde3'; ctx.fillRect(-1.7, -0.25, 0.9, 0.08); ctx.beginPath(); ctx.arc(-1.7, -0.21, 0.13, 0, TAU); ctx.fillStyle = '#222'; ctx.fill(); }
  ctx.restore();
  void parts;
}

// ---- sled with the sliding weight box -------------------------------------------------------------------------------------------
function drawSled(ctx, cam, p, pal, look) {
  const { s } = cam;
  const hitchM = p.x - 1.45 * look.s;              // the drawbar eye
  const tx = cam.X(hitchM), y = cam.gy;
  const u = Math.max(0, Math.min(1, p.x / TRACK_M));
  const bob = p.phase === 'run' ? Math.sin(p.x * 7) * 0.02 : 0;
  const len = 6.2, boxW = 1.5, boxH = 1.1;
  const chain = 1.5;
  const frontX = tx - chain * s;                    // front of the sled body
  ctx.save();
  // chain
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = Math.max(2, 0.07 * s);
  ctx.beginPath(); ctx.moveTo(tx, y - 0.45 * s); ctx.quadraticCurveTo((tx + frontX) / 2, y - 0.3 * s, frontX, y - 0.55 * s); ctx.stroke();
  ctx.setLineDash([0.12 * s, 0.1 * s]); ctx.strokeStyle = '#8a8a8a'; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(frontX - (len / 2) * s, y + 0.1 * s, (len / 2 + 0.3) * s, 0.16 * s, 0, 0, TAU); ctx.fill();
  ctx.translate(frontX, y + bob * s); ctx.scale(s, s);
  const lw = (px) => px / s;
  // main beam (steel)
  const steel = ctx.createLinearGradient(0, -1.0, 0, -0.35); steel.addColorStop(0, '#d9dee4'); steel.addColorStop(0.4, '#8f98a3'); steel.addColorStop(1, '#4b535c');
  ctx.fillStyle = steel; rr(ctx, -len, -0.95, len, 0.5, 0.06); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = lw(1.5); ctx.stroke();
  // rails on top for the weight box
  ctx.fillStyle = '#3a414a'; ctx.fillRect(-len + 0.25, -1.0, len - 0.6, 0.08);
  // front pan: a plate that skids on the ground, steeper and deeper as the load rises
  ctx.fillStyle = '#5c646e';
  ctx.beginPath(); ctx.moveTo(0, -0.95); ctx.lineTo(0.35, -0.5 + u * 0.12); ctx.lineTo(0.45, -0.05); ctx.lineTo(-1.8, -0.05); ctx.lineTo(-1.8, -0.45); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-1.7, -0.42, 1.9, 0.05);
  // rear wheels
  for (const wx of [-len + 0.9, -len + 1.8]) {
    ctx.fillStyle = '#17120e'; ctx.beginPath(); ctx.arc(wx, -0.38, 0.38, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9aa2ab'; ctx.beginPath(); ctx.arc(wx, -0.38, 0.17, 0, TAU); ctx.fill();
  }
  // weight box slides forward with the pull: rear (0) to front (1)
  const bx = -len + 0.35 + (len - 0.35 - boxW - 1.3) * u + (boxW * 0.0);
  const wb = ctx.createLinearGradient(0, -1 - boxH, 0, -1); wb.addColorStop(0, '#4b5360'); wb.addColorStop(0.5, '#2f353f'); wb.addColorStop(1, '#1a1e25');
  ctx.fillStyle = wb; rr(ctx, bx, -1.0 - boxH, boxW, boxH, 0.08); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
  // hazard stripes
  ctx.save(); rr(ctx, bx + 0.05, -1.0 - 0.28, boxW - 0.1, 0.22, 0.04); ctx.clip();
  for (let i = -2; i < 12; i++) { ctx.fillStyle = i % 2 ? '#f5c518' : '#1a1a1a'; ctx.beginPath(); ctx.moveTo(bx + i * 0.2, -0.78); ctx.lineTo(bx + i * 0.2 + 0.2, -0.78); ctx.lineTo(bx + i * 0.2 + 0.1, -1.0); ctx.lineTo(bx + i * 0.2 - 0.1, -1.0); ctx.fill(); }
  ctx.restore();
  // steel plates on the box
  for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(255,255,255,${0.1 + i * 0.03})`; ctx.fillRect(bx + 0.1, -1.0 - boxH + 0.1 + i * 0.22, boxW - 0.2, 0.06); }
  ctx.restore();
  void pal;
}

// ---- weather ----------------------------------------------------------------------------------------------------------------------
function drawRain(ctx, rect, t) {
  ctx.strokeStyle = 'rgba(220,232,245,0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = rect.x + ((hash(i * 3 + 1) * rect.w + t * 160 + i * 17) % (rect.w + 40)) - 20;
    const y = rect.y + ((hash(i * 5 + 2) * rect.h + t * 760) % rect.h);
    ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
  }
  ctx.stroke();
}

// ---- particles ----------------------------------------------------------------------------------------------------------------------
function drawParts(ctx, cam, pal, parts) {
  const { s } = cam;
  for (const q of parts) {
    const k = q.t / q.life, x = cam.X(q.x), y = cam.Y(q.y);
    if (q.k === 'smoke' || q.k === 'dust') {
      const rad = q.k === 'smoke' ? (0.08 + q.size * (0.3 + k * 0.9)) * s : (0.1 + q.size * (0.35 + k * 1.0)) * s;
      const col = q.k === 'smoke' ? (q.r > 0.5 ? '36,36,40' : '66,66,72') : pal.dust, a = (q.k === 'smoke' ? 0.55 : 0.5) * (1 - k);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.6, `rgba(${col},${a * 0.55})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    } else if (q.k === 'conf') {
      const cols = ['#ffd36a', '#e0552c', '#ffffff', '#58b24a', '#4a86b8'];
      ctx.save(); ctx.translate(x, y); ctx.rotate(q.t * (4 + q.r * 6)); ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = cols[Math.floor(q.r * 997) % cols.length]; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
    } else if (q.k === 'clod') {
      ctx.fillStyle = q.r > 0.5 ? '#4a2f1a' : '#6b4526';
      ctx.beginPath(); ctx.arc(x, y, (0.05 + q.size * 0.09) * s, 0, TAU); ctx.fill();
    } else if (q.k === 'spark') {
      ctx.fillStyle = `rgba(255,220,120,${1 - k})`; ctx.fillRect(x, y, 3, 3);
    }
  }
}

// ---- the whole scene -------------------------------------------------------------------------------------------------------------------------
// sc = { rigIdx, ground, track, p (pull state), parts, t, cheer }
export function drawScene(ctx, rect, sc) {
  const pal = PALS[sc.ground], look = LOOKS[sc.rigIdx], p = sc.p;
  const cam = makeCam(rect, p);
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const gy = cam.gy;
  drawSky(ctx, rect, pal, gy, sc.t);
  drawClouds(ctx, rect, pal, gy, p.x, cam.s, sc.t);
  drawHills(ctx, rect, pal, gy, p.x, cam.s);
  drawFarm(ctx, rect, pal, gy, p.x, cam.s);
  drawStand(ctx, rect, pal, gy, p.x, cam.s);
  // grass strip between the stands and the track
  ctx.fillStyle = pal.grass; ctx.fillRect(rect.x, gy - 0.35 * cam.s, rect.w, 0.4 * cam.s);
  drawFenceCrowd(ctx, cam, pal, p, sc.t, sc.cheer);
  drawTrack(ctx, cam, pal, sc.track, p, pal.rain);
  drawMarkers(ctx, cam, pal, p);
  drawLines(ctx, cam, pal);
  drawSled(ctx, cam, p, pal, look);
  drawTractor(ctx, cam, p, look, sc.t, sc.parts);
  drawParts(ctx, cam, pal, sc.parts);
  if (pal.rain) drawRain(ctx, rect, sc.t);
  if (pal.night) { const v = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h); v.addColorStop(0, 'rgba(0,0,12,0.28)'); v.addColorStop(0.7, 'rgba(0,0,12,0)'); v.addColorStop(1, 'rgba(0,0,10,0.25)'); ctx.fillStyle = v; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
  ctx.restore();
  return cam;
}

// ---- small icon drawings used by menus and the rules illustrations ----------------------------------------------------------------------
export function drawRigProfile(ctx, cx, cy, w, rigIdx, t = 0, lift = 0) {
  // draw a tractor centred on (cx, cy) with total width w, no sled. The 3D still (view3d/track3d.js) when available.
  const T = globalThis.__track3d;
  if (T && T.rigThumb) {
    const img = T.rigThumb(rigIdx, Math.max(0, lift)), sc = w / 5.4, f = sc / 100;
    if (img) { ctx.drawImage(img, cx - 0.4 * sc - 150 * f, cy + 1.1 * sc - 330 * f, 640 * f, 400 * f); return; }
  }
  const look = LOOKS[rigIdx], s = w / 5.4 / look.s;
  const cam = { s, gy: cy + 1.1 * s * look.s, X: (wx) => cx + wx * s, Y: (wy) => cy - wy * s };
  const p = { x: 0, lift, wheel: t * 3, phase: 'ready', v: 0, rpm: 0.3 };
  cam.X = (wx) => cx + (wx - 0.6 * 0) * s - 0.4 * s * look.s;
  drawTractor(ctx, cam, p, look, t, []);
}
export function rigLook(i) { return LOOKS[i]; }
void RIGS; void ft;
