// Thanjavur Dancing Doll: palette, small helpers, particles, and the toy-maker's room (wall, window light, bunting, lamp, teak shelf).
// Everything is a function of its arguments and the clock handed in; scenery uses a position hash, never random.
import { v3 } from './v3.js';
export const PAL = {
  ink: '#3a1620', maroon: '#5a1e2c', wall0: '#fdf0d2', wall1: '#f3d9a4', dado: '#e0a24a', teak0: '#b8703a', teak1: '#7c431f',
  vermilion: '#d9402a', emerald: '#1f8a5b', cobalt: '#2757a8', gold: '#eaa91c', goldHi: '#ffd868', goldDeep: '#a86f0c', teal: '#14958c',
  cream: '#fff7e4', text: '#3a1620', dim: 'rgba(58,22,32,0.66)', soft: 'rgba(58,22,32,0.08)', line: 'rgba(58,22,32,0.22)', good: '#1f9a62', warn: '#c8321e',
  clay0: '#d98c5f', clay1: '#9c5232',
};
export const DISPLAY = '"Dela Gothic One", "Arial Black", "Trebuchet MS", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const mixHex = (a, b, t) => {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};
// Rotate a hex colour's hue (degrees) and optionally scale lightness.
export function hueShift(hex, deg, light = 1) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return `hsl(${Math.round((h + deg + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(clamp(l * light, 0, 1) * 100)}%)`;
}

// ---- particles (screen pixels) ---------------------------------------------------------------------------------------------------
export function burst(list, rng, x, y, n, cols, power = 1, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), s = rng.range(0.4, 1.3) * power * 220;
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.lift ?? 120), life: rng.range(0.6, 1.2), age: 0, col: cols[i % cols.length], size: rng.range(5, 10) * (o.size ?? 1), kind: o.kind ?? 'conf', rot: rng.range(0, TAU), vr: rng.range(-8, 8), g: o.g ?? 520 });
  }
  if (list.length > 160) list.splice(0, list.length - 160);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].age >= list[i].life) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  for (const p of list) {
    const a = clamp(1 - p.age / p.life, 0, 1);
    ctx.globalAlpha = Math.min(1, a * 1.8); ctx.fillStyle = p.col; ctx.strokeStyle = p.col;
    if (p.kind === 'ring') { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + p.age * 7), 0, TAU); ctx.stroke(); }
    else if (p.kind === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.5, 0, TAU); ctx.fill(); }
    else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size * 0.6, -p.size * 0.3, p.size * 1.2, p.size * 0.6); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}

export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  const w = size * 2 * gap, x0 = cx - (w * (total - 1)) / 2;
  for (let i = 0; i < total; i++) {
    const x = x0 + i * w, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.46 : size, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = on ? PAL.gold : 'rgba(58,22,32,0.12)'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, size * 0.12); ctx.lineJoin = 'round'; ctx.strokeStyle = on ? PAL.goldDeep : 'rgba(58,22,32,0.28)'; ctx.stroke();
    ctx.restore();
  }
}

// ---- the room ------------------------------------------------------------------------------------------------------------------
// S: the stage rect, gy: y of the shelf's top edge (where the dolls stand), t: clock, lamp: 0..1 extra glow (a synced doll warms the room).
export function drawRoom(ctx, S, gy, t, lamp = 0) {
  if (v3.on && v3.capture) { v3.stage = { S, gy, fh: 0, t, lamp, shake: 0 }; return; }
  const top = S.y, bot = S.y + S.h, W = S.w, u = Math.max(18, Math.min(W / 9, (gy - top) / 11));
  // wall
  const g = ctx.createLinearGradient(0, top, 0, gy);
  g.addColorStop(0, PAL.wall0); g.addColorStop(1, PAL.wall1);
  ctx.fillStyle = g; ctx.fillRect(S.x, top, W, bot - top);
  // painted dado band and a row of zigzags above the shelf
  const dh = u * 1.3, dy = gy - dh * 1.6;
  ctx.fillStyle = PAL.dado; ctx.fillRect(S.x, dy, W, dh * 0.5);
  ctx.fillStyle = '#fff7e4';
  for (let x = S.x - u; x < S.x + W + u; x += u * 0.9) { ctx.beginPath(); ctx.moveTo(x, dy); ctx.lineTo(x + u * 0.45, dy + dh * 0.5); ctx.lineTo(x + u * 0.9, dy); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = 'rgba(122,60,20,0.14)'; ctx.fillRect(S.x, dy + dh * 0.5, W, gy - dy - dh * 0.5);
  // tall arched window with a drifting shaft of light
  const wx = S.x + W * 0.82, ww = Math.min(W * 0.2, u * 3.2), wh = Math.min((gy - top) * 0.52, u * 5.6), wy = top + (gy - top) * 0.14;
  ctx.fillStyle = '#fff7e4'; archPath(ctx, wx - ww * 0.58, wy - 8, ww * 1.16, wh + 16); ctx.fill();
  const wg = ctx.createLinearGradient(0, wy, 0, wy + wh); wg.addColorStop(0, '#bfe6f2'); wg.addColorStop(1, '#fdf2c8');
  ctx.fillStyle = wg; archPath(ctx, wx - ww / 2, wy, ww, wh); ctx.fill();
  ctx.strokeStyle = '#fff7e4'; ctx.lineWidth = Math.max(3, u * 0.14);
  ctx.beginPath(); ctx.moveTo(wx, wy - ww * 0.3); ctx.lineTo(wx, wy + wh); ctx.moveTo(wx - ww / 2, wy + wh * 0.55); ctx.lineTo(wx + ww / 2, wy + wh * 0.55); ctx.stroke();
  const sh = 0.5 + 0.5 * Math.sin(t * 0.25);
  ctx.save(); ctx.beginPath(); ctx.rect(S.x, top, W, gy - top); ctx.clip();
  const lg = ctx.createLinearGradient(wx, wy + wh, wx - W * 0.5, gy);
  lg.addColorStop(0, `rgba(255,236,170,${0.34 + 0.08 * sh})`); lg.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(wx - ww / 2, wy + wh); ctx.lineTo(wx + ww / 2, wy + wh); ctx.lineTo(wx - W * 0.35, gy); ctx.lineTo(wx - W * 0.95, gy); ctx.closePath(); ctx.fill();
  ctx.restore();
  // paper bunting across the top
  const cols = ['#d9402a', '#eaa91c', '#1f8a5b', '#2757a8', '#e0568a', '#14958c'];
  const sag = u * 0.9, by = top + u * 0.55;
  ctx.strokeStyle = 'rgba(58,22,32,0.45)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 8) { const y = by + Math.sin((x / W) * Math.PI) * sag; if (x === 0) ctx.moveTo(S.x, y); else ctx.lineTo(S.x + x, y); }
  ctx.stroke();
  const nf = Math.max(6, Math.round(W / (u * 1.1)));
  for (let i = 0; i < nf; i++) {
    const f = (i + 0.5) / nf, x = S.x + f * W, y = by + Math.sin(f * Math.PI) * sag, sw = Math.sin(t * 1.4 + i * 0.9) * 0.06;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
    ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(-u * 0.32, 0); ctx.lineTo(u * 0.32, 0); ctx.lineTo(0, u * 0.7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // a hanging brass lamp whose glow follows the synced dolls
  const lx = S.x + W * 0.16, ly = top + (gy - top) * 0.2;
  ctx.strokeStyle = 'rgba(58,22,32,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, by + sag * 0.3); ctx.lineTo(lx, ly - u * 0.5); ctx.stroke();
  const gr = ctx.createRadialGradient(lx, ly, 2, lx, ly, u * (3.4 + lamp * 1.6));
  gr.addColorStop(0, `rgba(255,214,120,${0.55 + lamp * 0.3})`); gr.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = gr; ctx.fillRect(lx - u * 5.5, ly - u * 5.5, u * 11, u * 11);
  ctx.fillStyle = PAL.goldDeep; ctx.beginPath(); ctx.moveTo(lx - u * 0.45, ly - u * 0.45); ctx.lineTo(lx + u * 0.45, ly - u * 0.45); ctx.lineTo(lx + u * 0.65, ly + u * 0.1); ctx.lineTo(lx - u * 0.65, ly + u * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.goldHi; ctx.beginPath(); ctx.arc(lx, ly + u * 0.15, u * 0.26, 0, TAU); ctx.fill();
}

function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
}

// The teak shelf: top edge at gy, a front face of height fh (the rails sit on it), and a soft shadow beneath.
export function drawShelf(ctx, S, gy, fh) {
  if (v3.on && v3.capture) { if (v3.stage) v3.stage.fh = fh; return; }
  const topH = Math.max(10, fh * 0.28);
  const g = ctx.createLinearGradient(0, gy, 0, gy + topH);
  g.addColorStop(0, '#d89a5a'); g.addColorStop(1, PAL.teak0);
  ctx.fillStyle = g; ctx.fillRect(S.x, gy, S.w, topH);
  const f = ctx.createLinearGradient(0, gy + topH, 0, gy + fh);
  f.addColorStop(0, PAL.teak0); f.addColorStop(1, PAL.teak1);
  ctx.fillStyle = f; ctx.fillRect(S.x, gy + topH, S.w, fh - topH);
  ctx.strokeStyle = 'rgba(40,16,6,0.16)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) { const y = gy + topH + ((fh - topH) * (i + 0.5)) / 7; ctx.beginPath(); ctx.moveTo(S.x, y); for (let x = 0; x <= S.w; x += 30) ctx.lineTo(S.x + x, y + Math.sin(x * 0.02 + i * 2) * 1.6); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,240,200,0.45)'; ctx.fillRect(S.x, gy, S.w, 2);
  const sd = ctx.createLinearGradient(0, gy + fh, 0, gy + fh + 26);
  sd.addColorStop(0, 'rgba(40,16,6,0.32)'); sd.addColorStop(1, 'rgba(40,16,6,0)');
  ctx.fillStyle = sd; ctx.fillRect(S.x, gy + fh, S.w, 26);
}
