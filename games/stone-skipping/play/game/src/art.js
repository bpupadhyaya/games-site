// Drawing of the pond world: sky and shore (cached per size), perspective water with glints, swell bands and a sun or moon
// reflection, expanding ripple rings, splash drops and the stone itself. The camera trails behind the thrower, a little above
// the water, and follows the stone; everything is projected with one pinhole formula (see makeCam). Pure drawing, no state.
import { STONES } from './sim.js';

const TAU = Math.PI * 2;
export const YEX = 2.3;        // heights are drawn this much taller than they are, so a 20 cm hop reads on a phone
export const CAM_H = 1.15;     // eye height above the water, m
export const CAM_BACK = 4.6;   // how far behind the stone the camera trails, m
export const STONE_SCALE = 5.5; // a stone is drawn this much larger than life

const hs = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const fr = (v) => v - Math.floor(v);

// Per-pond look. sky = [top, mid, horizon]; water = [far, mid, near]; glint = glint colour; sun = {x (0..1), y (0..1 of sky), r, c}
export const PALS = [
  { sky: ['#5f86c4', '#eba1a2', '#ffdcae'], water: ['#f4c3a6', '#7ea0c0', '#244f78'], glint: '255,236,200', shore: ['#7a7f9c', '#4b5878'], sun: { x: 0.62, y: 0.93, r: 46, c: '255,238,190' }, night: false, haze: '255,220,180', ink: '#10243c' },
  { sky: ['#3a82d4', '#8cc4f0', '#dcf0ff'], water: ['#a8dcee', '#4fa4cc', '#175f90'], glint: '255,255,255', shore: ['#7da488', '#4e7a5c'], sun: { x: 0.28, y: 0.35, r: 36, c: '255,252,230' }, night: false, haze: '225,242,255', ink: '#0f2c46' },
  { sky: ['#2f2c68', '#d9547c', '#ffb25c'], water: ['#ff9a6c', '#a85a86', '#222f66'], glint: '255,214,150', shore: ['#4a3868', '#2c2450'], sun: { x: 0.42, y: 0.92, r: 62, c: '255,214,140' }, night: false, haze: '255,170,110', ink: '#1a1840' },
  { sky: ['#05081c', '#142046', '#3a4e82'], water: ['#3b4f84', '#18284e', '#070d24'], glint: '200,220,255', shore: ['#10183a', '#080c22'], sun: { x: 0.72, y: 0.28, r: 30, c: '236,244,255' }, night: true, haze: '90,110,170', ink: '#050a1c' },
];

export function makeCam(rect, camZ) {
  const land = rect.w > rect.h;
  const f = Math.min(rect.w * 1.25, rect.h * 1.6);
  const hor = rect.y + rect.h * (land ? 0.38 : 0.34);
  const cx = rect.x + rect.w / 2;
  return { rect, f, hor, cx, camZ, d: (z) => z - camZ, X: (x, d) => cx + (f * x) / d, Y: (y, d) => hor + (f * (CAM_H - y * YEX)) / d, S: (m, d) => (f * m) / d };
}

// ---- backdrop (sky, sun, clouds, far shores), cached per pond and size --------------------------------------------------
const bdCache = new Map();
export function resetArt() { bdCache.clear(); }
function ridge(ctx, w, base, amp, seed, col, f1, f2) {
  ctx.beginPath(); ctx.moveTo(0, base + 4);
  for (let x = 0; x <= w + 8; x += 8) {
    const y = base - amp * (0.5 + 0.28 * Math.sin(x * f1 + seed) + 0.22 * Math.sin(x * f2 + seed * 2.3));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, base + 4); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function paintBackdrop(ctx, w, hh, pi) {
  const p = PALS[pi];
  const g = ctx.createLinearGradient(0, 0, 0, hh);
  g.addColorStop(0, p.sky[0]); g.addColorStop(0.55, p.sky[1]); g.addColorStop(1, p.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
  if (p.night) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) { ctx.globalAlpha = 0.25 + 0.6 * hs(i * 3 + 1); ctx.fillRect(hs(i * 7) * w, hs(i * 11 + 5) * hh * 0.8, 1.6, 1.6); }
    ctx.globalAlpha = 1;
  }
  // clouds
  const nC = p.night ? 3 : 5;
  for (let i = 0; i < nC; i++) {
    const cx = hs(i * 5 + 2) * w, cy = hh * (0.12 + 0.5 * hs(i * 9 + 4)), rw = w * (0.16 + 0.14 * hs(i * 13 + 1)), rh = rw * 0.17;
    const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rw);
    rg.addColorStop(0, `rgba(${p.night ? '120,140,200' : '255,255,255'},${p.night ? 0.16 : 0.5})`); rg.addColorStop(1, `rgba(${p.night ? '120,140,200' : '255,255,255'},0)`);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, rh / rw); ctx.translate(-cx, -cy); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, rw, 0, TAU); ctx.fill(); ctx.restore();
  }
  // sun or moon with a glow
  const sx = p.sun.x * w, sy = p.sun.y * hh;
  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, p.sun.r * 4.2);
  glow.addColorStop(0, `rgba(${p.sun.c},0.85)`); glow.addColorStop(0.25, `rgba(${p.sun.c},0.28)`); glow.addColorStop(1, `rgba(${p.sun.c},0)`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, hh);
  ctx.beginPath(); ctx.arc(sx, sy, p.sun.r * 0.5, 0, TAU);
  const sg = ctx.createRadialGradient(sx - p.sun.r * 0.1, sy - p.sun.r * 0.1, 1, sx, sy, p.sun.r * 0.55);
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, `rgb(${p.sun.c})`); ctx.fillStyle = sg; ctx.fill();
  if (p.night) { ctx.beginPath(); ctx.arc(sx + p.sun.r * 0.18, sy - p.sun.r * 0.06, p.sun.r * 0.42, 0, TAU); ctx.fillStyle = p.sky[1]; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; }
  // far shores
  ridge(ctx, w, hh, hh * 0.13, 1.7 + pi, p.shore[0], 0.011, 0.031);
  ridge(ctx, w, hh + 1, hh * 0.075, 4.2 + pi * 2, p.shore[1], 0.019, 0.047);
  // little pines on the near ridge
  ctx.fillStyle = p.shore[1];
  for (let i = 0; i < 26; i++) {
    const x = hs(i * 17 + pi * 3) * w, ht = hh * (0.03 + 0.035 * hs(i * 5 + 9));
    ctx.beginPath(); ctx.moveTo(x, hh - ht * 1.6); ctx.lineTo(x - ht * 0.28, hh + 1); ctx.lineTo(x + ht * 0.28, hh + 1); ctx.closePath(); ctx.fill();
  }
  const hz = ctx.createLinearGradient(0, hh - hh * 0.18, 0, hh);
  hz.addColorStop(0, `rgba(${p.haze},0)`); hz.addColorStop(1, `rgba(${p.haze},0.55)`);
  ctx.fillStyle = hz; ctx.fillRect(0, hh - hh * 0.18, w, hh * 0.18);
}
function blitBackdrop(ctx, rect, hor, pi) {
  const w = Math.max(2, Math.round(rect.w)), hh = Math.max(2, Math.round(hor - rect.y));
  const key = `${pi}|${w}x${hh}`;
  let c = bdCache.get(key);
  if (!c && typeof OffscreenCanvas !== 'undefined') {
    try { c = new OffscreenCanvas(w, hh); paintBackdrop(c.getContext('2d'), w, hh, pi); bdCache.set(key, c); if (bdCache.size > 12) bdCache.delete(bdCache.keys().next().value); } catch { c = null; }
  }
  if (c) ctx.drawImage(c, rect.x, rect.y);
  else { ctx.save(); ctx.translate(rect.x, rect.y); paintBackdrop(ctx, w, hh, pi); ctx.restore(); }
}

// ---- the world ---------------------------------------------------------------------------------------------------------------
// o: { pond, camZ, t, swell: {amp, lambda, c, phase} | null, ripples, parts, stone: { z, y, tilt, spin, idx, alpha, sunk } | null, trail: [{z,y}] }
export function drawWorld(ctx, rect, o) {
  const cam = makeCam(rect, o.camZ), p = PALS[o.pond], { f, hor, cx } = cam;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  blitBackdrop(ctx, rect, hor, o.pond);
  const bot = rect.y + rect.h;
  // water body
  const g = ctx.createLinearGradient(0, hor, 0, bot);
  g.addColorStop(0, p.water[0]); g.addColorStop(0.28, p.water[1]); g.addColorStop(1, p.water[2]);
  ctx.fillStyle = g; ctx.fillRect(rect.x, hor, rect.w, bot - hor + 1);
  // the sun or moon reflection column
  const sunX = rect.x + p.sun.x * rect.w;
  const rc = ctx.createLinearGradient(0, hor, 0, bot);
  rc.addColorStop(0, `rgba(${p.sun.c},0.55)`); rc.addColorStop(0.5, `rgba(${p.sun.c},0.16)`); rc.addColorStop(1, `rgba(${p.sun.c},0.04)`);
  ctx.fillStyle = rc;
  ctx.beginPath(); ctx.moveTo(sunX - p.sun.r * 0.45, hor); ctx.lineTo(sunX + p.sun.r * 0.45, hor); ctx.lineTo(sunX + rect.w * 0.2, bot); ctx.lineTo(sunX - rect.w * 0.2, bot); ctx.closePath(); ctx.fill();
  // swell bands: a lighter rising face and a darker back, moving with the wave
  const sw = o.swell;
  if (sw && sw.amp > 0) {
    const m0 = Math.floor((o.camZ + 1.8 - sw.c * o.t + sw.phase) / sw.lambda);
    for (let m = m0; m < m0 + 14; m++) {
      const zc = sw.c * o.t - sw.phase + m * sw.lambda, d = zc - o.camZ;
      if (d < 1.8 || d > 80) continue;
      const sy = hor + (f * CAM_H) / d, bh = Math.max(2, (f * CAM_H * sw.lambda * 0.22) / (d * d)), a = Math.min(0.5, sw.amp / 9) * (1 - d / 85);
      const bg = ctx.createLinearGradient(0, sy - bh, 0, sy + bh);
      bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(0.5, `rgba(${p.glint},${a})`); bg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bg; ctx.fillRect(rect.x, sy - bh, rect.w, bh * 2);
      const zt = zc + sw.lambda / 2, dt = zt - o.camZ;
      if (dt > 1.8 && dt < 80) {
        const sy2 = hor + (f * CAM_H) / dt, bh2 = Math.max(2, (f * CAM_H * sw.lambda * 0.2) / (dt * dt));
        const bg2 = ctx.createLinearGradient(0, sy2 - bh2, 0, sy2 + bh2);
        bg2.addColorStop(0, 'rgba(0,10,30,0)'); bg2.addColorStop(0.5, `rgba(0,10,30,${a * 0.9})`); bg2.addColorStop(1, 'rgba(0,10,30,0)');
        ctx.fillStyle = bg2; ctx.fillRect(rect.x, sy2 - bh2, rect.w, bh2 * 2);
      }
    }
  }
  // glints on the water, in three levels of detail so the far water stays calm
  const levels = [[1.9, 12, 0.55], [12, 32, 1.4], [32, 95, 4.2]];
  const chop = o.chop || 0;
  for (const [d0, d1, step] of levels) {
    const k0 = Math.ceil((o.camZ + d0) / step), k1 = Math.floor((o.camZ + d1) / step);
    for (let k = k0; k <= k1; k++) {
      const zc = k * step, d = zc - o.camZ;
      const sy = hor + (f * CAM_H) / d, fade = 1 - d / 105;
      const nG = 3;
      for (let j = 0; j < nG; j++) {
        const h = hs(k * 31 + j * 7 + o.pond * 101);
        const half = (rect.w * d) / f / 2 * 1.25;
        const xw = (hs(k * 13 + j * 19 + 3) - 0.5) * 2 * half + Math.sin(o.t * 0.7 + h * 6.28) * (0.1 + chop * 0.08);
        const wm = (0.25 + 0.9 * h) * (1 + chop * 0.15), sx = cx + (f * xw) / d, wpx = (f * wm) / d, th = Math.max(1, (f * 0.012) / d + 0.4);
        const nearSun = Math.abs(sx - sunX) < rect.w * 0.16 * (0.4 + (hor + 1) / (sy + 1));
        const a = (nearSun ? 0.62 : 0.22) * fade * (0.5 + 0.7 * hs(k * 5 + j));
        ctx.fillStyle = `rgba(${nearSun ? p.sun.c : p.glint},${a.toFixed(3)})`;
        ctx.fillRect(sx - wpx / 2, sy, Math.max(1.5, wpx), th);
      }
    }
  }
  // a darker band along the near edge, and a soft mist at the horizon
  const vg = ctx.createLinearGradient(0, bot - rect.h * 0.22, 0, bot);
  vg.addColorStop(0, 'rgba(0,10,30,0)'); vg.addColorStop(1, 'rgba(0,10,30,0.34)');
  ctx.fillStyle = vg; ctx.fillRect(rect.x, bot - rect.h * 0.22, rect.w, rect.h * 0.22);
  const mg = ctx.createLinearGradient(0, hor, 0, hor + rect.h * 0.1);
  mg.addColorStop(0, `rgba(${p.haze},0.6)`); mg.addColorStop(1, `rgba(${p.haze},0)`);
  ctx.fillStyle = mg; ctx.fillRect(rect.x, hor, rect.w, rect.h * 0.1);

  // ripples: three rings each, widening and fading, flattened by the low viewing angle
  for (const rp of o.ripples) {
    const age = o.t - rp.t0;
    if (age < 0 || age > 3.2) continue;
    const d = rp.z - o.camZ;
    if (d < 0.7) continue;
    const life = 1 - age / 3.2, big = rp.s;
    const R0 = big * 1.8 * (0.18 + age * 0.55);
    const sx = cam.X(rp.x || 0, d), sy = cam.Y(0, d);
    for (let k = 0; k < 3; k++) {
      const R = R0 * (1 - k * 0.27);
      if (R <= 0.02) continue;
      const rx = cam.S(R, d), ry = Math.max(rx * 0.1, Math.min(rx * 0.55, rx * (CAM_H / d) * 0.9));
      const a = life * life * (0.8 - k * 0.2);
      ctx.lineWidth = Math.max(1, rx * 0.04);
      ctx.strokeStyle = `rgba(0,14,34,${(a * 0.4).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(sx, sy + 1.6, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${(a * 0.8).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, TAU); ctx.stroke();
    }
  }
  // the stone: reflection, shadow, a short trail and the stone itself
  const st = o.stone;
  if (st) {
    const d = st.z - o.camZ;
    if (d > 0.5) {
      const sx = cam.X(0, d), sy = cam.Y(st.y, d), sy0 = cam.Y(0, d), rpx = Math.max(4, Math.min(62, cam.S(STONES[st.idx].r * STONE_SCALE, d)));
      const al = st.alpha === undefined ? 1 : st.alpha;
      const h01 = Math.min(1, st.y / 0.9);
      ctx.save(); ctx.globalAlpha = al;
      // shadow and reflection on the water
      ctx.fillStyle = `rgba(0,10,30,${(0.34 * (1 - h01 * 0.6)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(sx, sy0 + 1, rpx * 1.15, Math.max(1.5, rpx * 0.3), 0, 0, TAU); ctx.fill();
      if (st.y > 0.01) {
        ctx.globalAlpha = al * 0.28;
        drawFlightStone(ctx, sx, sy0 + (sy0 - sy) * 0.9, rpx, Math.max(2, rpx * 0.3), st.idx, st.spin, true);
        ctx.globalAlpha = al;
      }
      // trail
      if (o.trail && o.trail.length) {
        for (let i = 0; i < o.trail.length; i++) {
          const q = o.trail[i], dq = q.z - o.camZ;
          if (dq < 0.6) continue;
          const a = (i + 1) / (o.trail.length + 1);
          ctx.globalAlpha = al * 0.22 * a;
          drawFlightStone(ctx, cam.X(0, dq), cam.Y(q.y, dq), Math.max(3, cam.S(STONES[st.idx].r * STONE_SCALE, dq)), Math.max(2, cam.S(STONES[st.idx].r * STONE_SCALE, dq) * 0.3), st.idx, st.spin, false);
        }
        ctx.globalAlpha = al;
      }
      const ry = Math.max(2.5, rpx * Math.min(0.62, 0.26 + 0.011 * Math.max(0, st.tilt)));
      drawFlightStone(ctx, sx, sy, rpx, ry, st.idx, st.spin, false);
      ctx.restore();
    }
  }
  // splash drops
  for (const q of o.parts) {
    const d = q.z - o.camZ;
    if (d < 0.6) continue;
    const a = 1 - q.t / q.max;
    if (a <= 0) continue;
    const sx = cam.X(q.x, d), sy = cam.Y(Math.max(0, q.y), d), r = Math.max(1.2, cam.S(q.size, d));
    ctx.fillStyle = `rgba(${q.col || '236,248,255'},${(0.85 * a).toFixed(3)})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
  return cam;
}

// A stone seen from behind and above: a lit ellipse with a dark edge, a highlight and spin marks.
function drawFlightStone(ctx, x, y, rx, ry, idx, spin, mirror) {
  const c = STONES[idx].col;
  ctx.fillStyle = c[2]; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.34, rx, ry, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, mirror ? c[1] : c[0]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  if (mirror) return;
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.28, y - ry * 0.35, rx * 0.34, ry * 0.2, -0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = Math.max(1, rx * 0.06);
  for (let k = 0; k < 3; k++) {
    const a = spin + k * 2.094;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rx * 0.25, y + Math.sin(a) * ry * 0.25); ctx.lineTo(x + Math.cos(a) * rx * 0.82, y + Math.sin(a) * ry * 0.82); ctx.stroke();
  }
}

// The stone in profile (used in the cradle, the tray and the rules pictures): long axis `len`, tilted `tilt` degrees with the
// leading edge up (the throw goes to the right).
export function drawStoneProfile(ctx, cx, cy, len, tilt, idx, o = {}) {
  const st = STONES[idx], c = st.col, a = len / 2, b = Math.max(3, len * (0.075 + 0.05 * (1 - st.flat)));
  ctx.save();
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(cx, cy + len * 0.36, a * 0.9, b * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.translate(cx, cy); ctx.rotate((-tilt * Math.PI) / 180);
  const g = ctx.createLinearGradient(0, -b, 0, b);
  g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
  ctx.beginPath();
  ctx.moveTo(-a, 0); ctx.bezierCurveTo(-a * 0.95, -b * 1.25, a * 0.7, -b * 1.35, a, -b * 0.1);
  ctx.bezierCurveTo(a * 0.96, b * 0.9, -a * 0.6, b * 1.3, -a, 0); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.2, len * 0.012); ctx.strokeStyle = c[2]; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, len * 0.018); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-a * 0.55, -b * 0.78); ctx.quadraticCurveTo(0, -b * 1.05, a * 0.5, -b * 0.8); ctx.stroke();
  ctx.restore();
}

// Splash particles: world-space drops thrown up from a skip or the sinking plop.
export function stepFx(list, dt) {
  for (const q of list) {
    q.t += dt; q.vy -= 9.8 * dt * 0.8; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].max || list[i].y < -0.05) list.splice(i, 1);
}
export function splash(list, rng, z, n, power = 1) {
  for (let i = 0; i < n && list.length < 90; i++) {
    const a = rng.next() * TAU, v = (0.25 + rng.next() * 0.9) * power;
    list.push({ x: Math.cos(a) * v * 0.5, y: 0.02, z, vx: Math.cos(a) * v * 0.7, vy: 0.8 + rng.next() * 1.6 * power, vz: Math.sin(a) * v * 1.2 + 0.3, t: 0, max: 0.7 + rng.next() * 0.5, size: 0.02 + rng.next() * 0.02 });
  }
}
