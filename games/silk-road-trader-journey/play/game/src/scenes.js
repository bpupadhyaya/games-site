// Composes the painted scenes: landscape + skyline + props + caravan + weather. Also the route map. Pure canvas, no rng.
import { landscape, finish, hash, vn, fbm, hex, mix, rgb, shade, clamp, lerp, SKY, ridge } from './paint.js';
import { skyline } from './skyline.js';
import { camel, horse, walker, caravan } from './figures.js';
import { drawGood, cached } from './icons.js';
import { CITIES, GOODS, LEGS } from './data.js';

const TAU = Math.PI * 2;
const ell = (ctx, x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); };
const WALK = [
  { robe: '#2f5f8a', hat: 'turban', skin: '#c48d62' }, { robe: '#8a3a3a', hat: 'sogdian', skin: '#d4a47c' }, { robe: '#3f7a5a', hat: 'cap', skin: '#b57c52' },
  { robe: '#c7a15a', hat: 'fur', skin: '#c9946c' }, { robe: '#6a4b8a', hat: 'turban', skin: '#d9ad88' }, { robe: '#a05a3a', hat: 'veil', skin: '#d2a07a' },
  { robe: '#35527a', hat: 'scholar', skin: '#e0b894' }, { robe: '#5a6b52', hat: 'straw', skin: '#d6a47c' },
];

// ---- props ---------------------------------------------------------------------------------------------------------------------------------------------
function glow(ctx, x, y, r, col = '255,170,70', a = 0.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); }
function fire(ctx, x, y, s, t) {
  ctx.fillStyle = 'rgba(30,18,8,0.4)'; ell(ctx, x, y + s * 0.05, s * 0.55, s * 0.12); ctx.fill();
  ctx.strokeStyle = '#4a3020'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x + s * 0.3, y - s * 0.12); ctx.moveTo(x + s * 0.4, y); ctx.lineTo(x - s * 0.3, y - s * 0.12); ctx.stroke();
  glow(ctx, x, y - s * 0.3, s * 3.2, '255,150,60', 0.55);
  for (let i = 0; i < 4; i++) {
    const k = i / 4, f = 0.85 + 0.15 * Math.sin(t * 9 + i * 2.1), h = s * (0.75 - k * 0.14) * f, w = s * (0.3 - k * 0.05);
    ctx.fillStyle = ['#e8501a', '#f58a25', '#ffc23c', '#fff0a0'][i]; ctx.beginPath(); ctx.moveTo(x - w, y - s * 0.08); ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.6, x + Math.sin(t * 7 + i) * w * 0.35, y - h); ctx.quadraticCurveTo(x + w * 0.7, y - h * 0.5, x + w, y - s * 0.08); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 6; i++) { const k = (t * 0.7 + i / 6) % 1; ctx.fillStyle = `rgba(255,${180 + i * 10},80,${1 - k})`; ctx.fillRect(x + Math.sin(i * 3 + t) * s * 0.4 * k, y - s * 0.7 - k * s * 1.6, 2, 2); }
}
function tent(ctx, x, y, s, col = '#e8dcc0') {
  ctx.fillStyle = 'rgba(30,18,8,0.28)'; ell(ctx, x + s * 0.2, y + s * 0.03, s * 0.9, s * 0.12); ctx.fill();
  const g = ctx.createLinearGradient(x - s, 0, x + s, 0); g.addColorStop(0, shade(col, 0.2)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.4));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - s * 0.85, y); ctx.lineTo(x - s * 0.85, y - s * 0.55); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.9, x, y - s * 1.05); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.9, x + s * 0.85, y - s * 0.55); ctx.lineTo(x + s * 0.85, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, -0.45); ctx.beginPath(); ctx.moveTo(x - s * 0.18, y); ctx.lineTo(x - s * 0.18, y - s * 0.42); ctx.quadraticCurveTo(x, y - s * 0.55, x + s * 0.18, y - s * 0.42); ctx.lineTo(x + s * 0.18, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a8382c'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(x - s * 0.85, y - s * 0.52); ctx.quadraticCurveTo(x, y - s * 0.7, x + s * 0.85, y - s * 0.52); ctx.stroke();
  ctx.strokeStyle = '#2f66b8'; ctx.beginPath(); ctx.moveTo(x - s * 0.85, y - s * 0.46); ctx.quadraticCurveTo(x, y - s * 0.64, x + s * 0.85, y - s * 0.46); ctx.stroke();
}
function well(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(30,18,8,0.3)'; ell(ctx, x + s * 0.2, y + s * 0.02, s * 0.8, s * 0.11); ctx.fill();
  const g = ctx.createLinearGradient(x - s * 0.5, 0, x + s * 0.5, 0); g.addColorStop(0, '#c9b48c'); g.addColorStop(1, '#7a6648');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - s * 0.28, s * 0.5, s * 0.14, 0, 0, TAU); ctx.fill(); ctx.fillRect(x - s * 0.5, y - s * 0.28, s, s * 0.28); ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.14, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#16100a'; ell(ctx, x, y - s * 0.28, s * 0.38, s * 0.1); ctx.fill();
  ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.28); ctx.lineTo(x - s * 0.5, y - s * 1.0); ctx.moveTo(x + s * 0.5, y - s * 0.28); ctx.lineTo(x + s * 0.5, y - s * 1.0); ctx.moveTo(x - s * 0.55, y - s * 1.0); ctx.lineTo(x + s * 0.55, y - s * 1.0); ctx.stroke();
  ctx.lineWidth = s * 0.02; ctx.strokeStyle = '#d8c8a0'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.0); ctx.lineTo(x, y - s * 0.5); ctx.stroke(); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - s * 0.08, y - s * 0.52, s * 0.16, s * 0.12);
  // trough
  ctx.fillStyle = '#7a5a36'; ctx.fillRect(x + s * 0.7, y - s * 0.14, s * 0.9, s * 0.14); ctx.fillStyle = '#4a98b8'; ctx.fillRect(x + s * 0.72, y - s * 0.14, s * 0.86, s * 0.04);
}
function cairns(ctx, x, y, s) {
  for (let k = 0; k < 3; k++) {
    const cx = x + k * s * 1.8, fallen = k === 2;
    ctx.fillStyle = 'rgba(30,18,8,0.25)'; ell(ctx, cx + s * 0.1, y + s * 0.02, s * 0.5, s * 0.08); ctx.fill();
    for (let i = 0; i < (fallen ? 3 : 5); i++) { const w = s * (0.5 - i * 0.07), yy = y - i * s * 0.15; const g = ctx.createLinearGradient(cx - w, yy, cx + w, yy); g.addColorStop(0, '#a89880'); g.addColorStop(1, '#5a4e3c'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx + (fallen ? i * s * 0.45 : (i % 2) * s * 0.04), yy - s * 0.07, w, s * 0.09, 0, 0, TAU); ctx.fill(); }
  }
}
function crowd(ctx, x, y, s, n, t, dir = 1) {
  for (let i = 0; i < n; i++) { const f = WALK[(i * 3 + 1) % WALK.length], px = x + (i - n / 2) * s * 0.34 + hash(i) * s * 0.1, py = y + (hash(i + 5) - 0.5) * s * 0.1; walker(ctx, px, py, s * (0.52 + hash(i + 9) * 0.1), 0, { ...f, dir: hash(i + 3) > 0.5 ? 1 : -1, still: true }); }
}
function stall(ctx, x, y, s, colA, colB, t) {
  ctx.fillStyle = 'rgba(30,18,8,0.28)'; ell(ctx, x, y + s * 0.02, s * 0.7, s * 0.09); ctx.fill();
  ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(x - s * 0.55, y); ctx.lineTo(x - s * 0.55, y - s * 0.8); ctx.moveTo(x + s * 0.55, y); ctx.lineTo(x + s * 0.55, y - s * 0.8); ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? colA : colB; ctx.beginPath(); ctx.moveTo(x - s * 0.62 + i * s * 0.208, y - s * 0.82); ctx.lineTo(x - s * 0.62 + (i + 1) * s * 0.208, y - s * 0.82); ctx.lineTo(x - s * 0.62 + (i + 1) * s * 0.208 + Math.sin(t * 2 + i) * 2, y - s * 0.6); ctx.lineTo(x - s * 0.62 + i * s * 0.208, y - s * 0.6); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#7a5a36'; ctx.fillRect(x - s * 0.5, y - s * 0.3, s, s * 0.3);
  for (let i = 0; i < 4; i++) { drawGood(ctx, GOODS[(i + Math.floor(x)) % 6].id, x - s * 0.36 + i * s * 0.24, y - s * 0.4, s * 0.22); }
}
function riders(ctx, rect, lay, t, s) {
  const ry = lay.horizon + rect.h * 0.04;
  for (let i = 0; i < 5; i++) { const x = rect.x + rect.w * (0.08 + i * 0.1 + (i % 2) * 0.03), y = ry + (i % 3) * rect.h * 0.012; const hs = s * (0.2 + (i % 2) * 0.02); ctx.save(); ctx.globalAlpha = 0.9; horse(ctx, x, y, hs, 0, { dir: 1, coat: i % 2 ? '#2a1c14' : '#3a2a1e', cloth: '#5a2a2a', still: true, rider: { robe: '#3a2a2a', hat: 'turban', skin: '#8a5a3a' } }); ctx.restore(); }
  ctx.fillStyle = '#7a1a1a'; ctx.beginPath(); ctx.moveTo(rect.x + rect.w * 0.08, ry - s * 0.55); ctx.lineTo(rect.x + rect.w * 0.08, ry - s * 0.22); ctx.lineWidth = 2; ctx.strokeStyle = '#3a2a1a'; ctx.stroke(); ctx.fillStyle = '#a82a22'; ctx.beginPath(); ctx.moveTo(rect.x + rect.w * 0.08, ry - s * 0.55); ctx.lineTo(rect.x + rect.w * 0.08 + s * 0.2, ry - s * 0.5 + Math.sin(t * 3) * 3); ctx.lineTo(rect.x + rect.w * 0.08, ry - s * 0.42); ctx.fill();
}
function river(ctx, rect, lay, t, wide) {
  const y0 = lay.horizon + rect.h * 0.1, h = rect.h * (wide ? 0.13 : 0.08);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#7a6a48'); g.addColorStop(1, '#4a3c24');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(rect.x, y0); for (let x = 0; x <= rect.w; x += 12) ctx.lineTo(rect.x + x, y0 + Math.sin(x * 0.02 + 1) * 3); ctx.lineTo(rect.x + rect.w, y0 + h); ctx.lineTo(rect.x, y0 + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,170,0.28)'; for (let i = 0; i < 40; i++) { const x = rect.x + ((hash(i) * rect.w * 1.4 + t * (12 + hash(i + 3) * 18)) % (rect.w * 1.2)); ctx.fillRect(x, y0 + 3 + hash(i + 5) * (h - 6), 10 + hash(i + 2) * 40, 1.6); }
}
function rafts(ctx, rect, lay, t, s) {
  const y0 = lay.horizon + rect.h * 0.1;
  for (let i = 0; i < 3; i++) { const x = rect.x + rect.w * (0.25 + i * 0.25) + Math.sin(t * 0.7 + i) * 6, y = y0 + rect.h * 0.045 + i * 3; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, x, y + 3, s * 0.5, s * 0.07); ctx.fill(); for (let k = -2; k <= 2; k++) { const g = ctx.createRadialGradient(x + k * s * 0.2 - 3, y - 6, 1, x + k * s * 0.2, y - 2, s * 0.16); g.addColorStop(0, '#e8cf9a'); g.addColorStop(1, '#a8884e'); ctx.fillStyle = g; ell(ctx, x + k * s * 0.2, y - 2, s * 0.13, s * 0.09); ctx.fill(); } ctx.fillStyle = '#7a5a36'; ctx.fillRect(x - s * 0.5, y - s * 0.14, s, s * 0.05); walker(ctx, x, y - s * 0.12, s * 0.5, 0, { ...WALK[i], still: true }); }
}
function sickCamel(ctx, x, y, s, t) {
  camel(ctx, x, y, s, 0, { dir: -1, still: true, load: [] });
  walker(ctx, x + s * 0.62, y + s * 0.02, s * 0.55, 0, { ...WALK[2], dir: -1, still: true });
  ctx.fillStyle = 'rgba(255,120,120,' + (0.4 + 0.3 * Math.sin(t * 3)) + ')'; ctx.beginPath(); ctx.arc(x - s * 0.22, y - s * 0.38, s * 0.05, 0, TAU); ctx.fill();
}
function storm(ctx, rect, lay, t) {
  const a = 0.55 + 0.12 * Math.sin(t * 1.3);
  const g = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0); g.addColorStop(0, `rgba(190,140,86,${a * 1.2})`); g.addColorStop(0.5, `rgba(205,160,104,${a * 0.75})`); g.addColorStop(1, `rgba(214,174,120,${a * 0.2})`);
  ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.beginPath(); ctx.moveTo(rect.x, rect.y + rect.h); for (let x = 0; x <= rect.w; x += 14) ctx.lineTo(rect.x + x, lay.horizon - rect.h * (0.16 + 0.18 * fbm(x * 0.012 + t * 0.5, 4))); ctx.lineTo(rect.x + rect.w, rect.y + rect.h); ctx.closePath(); ctx.fillStyle = `rgba(176,126,76,${a * 0.9})`; ctx.fill();
  for (let i = 0; i < 70; i++) { const x = rect.x + ((hash(i) * rect.w * 1.6 + t * (360 + i * 9)) % (rect.w * 1.6)) - rect.w * 0.3, y = rect.y + hash(i + 70) * rect.h; ctx.fillStyle = `rgba(232,196,142,${0.22 + 0.2 * hash(i + 3)})`; ctx.fillRect(x, y, 26 + hash(i + 9) * 70, 1.4 + hash(i + 4) * 2.2); }
}
function snowfall(ctx, rect, t) {
  ctx.fillStyle = 'rgba(235,242,252,0.22)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  for (let i = 0; i < 120; i++) { const x = rect.x + ((hash(i) * rect.w + Math.sin(t * 0.8 + i) * 30 + t * 40) % rect.w + rect.w) % rect.w, y = rect.y + ((hash(i + 90) * rect.h + t * (60 + 80 * hash(i + 4))) % rect.h), r = 1 + hash(i + 3) * 2.4; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
}
function mirage(ctx, rect, lay, t) {
  const y0 = lay.horizon + rect.h * 0.075, w = rect.w;
  const g = ctx.createLinearGradient(0, y0 - 6, 0, y0 + rect.h * 0.04); g.addColorStop(0, 'rgba(150,210,236,0.0)'); g.addColorStop(0.3, 'rgba(160,215,236,0.75)'); g.addColorStop(1, 'rgba(110,180,214,0.25)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(rect.x + w * 0.15, y0); for (let x = 0; x <= w * 0.7; x += 8) ctx.lineTo(rect.x + w * 0.15 + x, y0 + Math.sin(x * 0.05 + t * 2) * 2); ctx.lineTo(rect.x + w * 0.85, y0 + rect.h * 0.035); ctx.lineTo(rect.x + w * 0.15, y0 + rect.h * 0.035); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 5; i++) { const x = rect.x + w * (0.25 + i * 0.12); ctx.fillStyle = 'rgba(60,110,70,0.5)'; ctx.fillRect(x, y0 - rect.h * 0.03, 3, rect.h * 0.03); ell(ctx, x + 1.5, y0 - rect.h * 0.035, rect.h * 0.018, rect.h * 0.022); ctx.fill(); ctx.fillStyle = 'rgba(60,110,70,0.25)'; ell(ctx, x + 1.5, y0 + rect.h * 0.02, rect.h * 0.018, rect.h * 0.022); ctx.fill(); }
}
function wolves(ctx, rect, lay, t) {
  for (let i = 0; i < 3; i++) { const x = rect.x + rect.w * (0.18 + i * 0.28), y = lay.horizon + rect.h * (0.1 + 0.02 * i); ctx.fillStyle = '#0c0a10'; ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 14, y - 14); ctx.lineTo(x - 6, y - 16); ctx.lineTo(x + 2, y - 22); ctx.lineTo(x + 6, y - 14); ctx.lineTo(x + 20, y - 14); ctx.lineTo(x + 22, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,220,90,0.9)'; ctx.fillRect(x + 2, y - 18, 2.4, 2); ctx.fillRect(x + 7, y - 18, 2.4, 2); }
}
function stars(ctx, rect, lay, t) {
  ctx.save(); ctx.translate(rect.x + rect.w * 0.5, lay.horizon * 0.62); ctx.rotate(-0.5);
  for (let i = 0; i < 260; i++) { const x = (hash(i) - 0.5) * rect.w * 1.5, y = (hash(i + 7) - 0.5) * rect.h * 0.16 * (1 - Math.abs(x) / (rect.w * 0.9)); ctx.fillStyle = `rgba(210,220,255,${0.18 + 0.4 * hash(i + 3)})`; ctx.fillRect(x, y, 1.6, 1.6); }
  ctx.restore();
  const k = (t * 0.2) % 1; if (k < 0.15) { ctx.strokeStyle = `rgba(255,255,255,${1 - k / 0.15})`; ctx.lineWidth = 2; ctx.beginPath(); const sx = rect.x + rect.w * (0.2 + k * 3), sy = rect.y + rect.h * (0.1 + k * 2); ctx.moveTo(sx, sy); ctx.lineTo(sx - 40, sy - 16); ctx.stroke(); }
}
function workshop(ctx, rect, lay, s, t, time) {
  const x = rect.x + rect.w * 0.2, y = lay.road - s * 0.12;
  const g = ctx.createLinearGradient(x, y - s * 1.0, x + s * 1.6, y); g.addColorStop(0, '#d8c09a'); g.addColorStop(1, '#8a6c46');
  ctx.fillStyle = g; ctx.fillRect(x, y - s * 0.85, s * 1.7, s * 0.85); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - s * 0.1, y - s * 0.92, s * 1.9, s * 0.1);
  ctx.fillStyle = '#16100a'; ctx.beginPath(); ctx.roundRect(x + s * 0.15, y - s * 0.55, s * 0.4, s * 0.55, [s * 0.2, s * 0.2, 0, 0]); ctx.fill();
  if (time === 'dusk' || time === 'night') glow(ctx, x + s * 0.35, y - s * 0.28, s * 1.1, '255,150,60', 0.7);
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + s * 0.8, y - s * 0.9); ctx.lineTo(x + s * 2.4, y - s * 0.9); ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f0e6c8' : '#e8dcb4'; ctx.beginPath(); ctx.moveTo(x + s * (0.9 + i * 0.25), y - s * 0.9); ctx.lineTo(x + s * (1.1 + i * 0.25), y - s * 0.9); ctx.lineTo(x + s * (1.1 + i * 0.25) + Math.sin(t * 1.5 + i) * 2, y - s * 0.42); ctx.lineTo(x + s * (0.9 + i * 0.25), y - s * 0.42); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#7a5a36'; ell(ctx, x + s * 1.0, y + s * 0.02, s * 0.3, s * 0.1); ctx.fill(); ctx.fillStyle = '#c8b890'; ell(ctx, x + s * 1.0, y - s * 0.02, s * 0.26, s * 0.07); ctx.fill();
}
function gate(ctx, rect, lay, s, time) {
  const x = rect.x + rect.w * 0.78, y = lay.road - s * 0.1;
  const g = ctx.createLinearGradient(x - s * 0.8, 0, x + s * 0.8, 0); g.addColorStop(0, '#d4b888'); g.addColorStop(1, '#8a6c44'); ctx.fillStyle = g;
  ctx.fillRect(x - s * 0.9, y - s * 1.3, s * 0.45, s * 1.3); ctx.fillRect(x + s * 0.45, y - s * 1.3, s * 0.45, s * 1.3); ctx.fillRect(x - s * 0.9, y - s * 1.3, s * 1.8, s * 0.35);
  ctx.fillStyle = '#17100a'; ctx.beginPath(); ctx.moveTo(x - s * 0.45, y); ctx.lineTo(x - s * 0.45, y - s * 0.9); ctx.lineTo(x + s * 0.45, y - s * 0.9); ctx.lineTo(x + s * 0.45, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a8382c'; ctx.fillRect(x - s * 0.95, y - s * 1.35, s * 1.9, s * 0.08);
  if (time !== 'day') glow(ctx, x, y - s * 0.4, s * 0.8, '255,150,60', 0.5);
}

const PROP_ORDER = ['river', 'rafts', 'riders', 'gate', 'tent', 'workshop', 'market', 'well', 'cairn', 'horses', 'crowd', 'mirage', 'wolves', 'stars'];
const PROP_FRONT = ['fire', 'sick', 'caravan2'];
const PROP_WEATHER = ['storm', 'snow'];

// spec: { biome, time, scroll, horizon, seed, city, cityScale, caravan: {n,dir,still,x,loads,kind}, props: [] }
export function paintScene(ctx, rect, spec, t = 0) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const time = spec.time ?? 'day', props = spec.props ?? [];
  const lay = landscape(ctx, rect, spec.biome ?? 'dunes', time, spec.scroll ?? 0, t, { horizon: spec.horizon ?? 0.5, seed: spec.seed ?? 3, road: spec.road });
  const cs = Math.min(rect.h * 0.3, rect.w * 0.34) * (spec.zoom ?? 1);
  if (spec.city) skyline(ctx, rect, spec.city, lay.horizon + rect.h * (spec.cityDrop ?? 0.13), time, t, rect.h / 100 * (spec.cityScale ?? 1));
  for (const p of PROP_ORDER) if (props.includes(p)) {
    if (p === 'river') river(ctx, rect, lay, t, true);
    else if (p === 'rafts') rafts(ctx, rect, lay, t, cs * 0.5);
    else if (p === 'riders') riders(ctx, rect, lay, t, cs);
    else if (p === 'gate') gate(ctx, rect, lay, cs * 0.5, time);
    else if (p === 'tent') tent(ctx, rect.x + rect.w * 0.2, lay.road - cs * 0.04, cs * 0.5);
    else if (p === 'workshop') workshop(ctx, rect, lay, cs * 0.55, t, time);
    else if (p === 'market') { stall(ctx, rect.x + rect.w * 0.18, lay.road - cs * 0.05, cs * 0.55, '#c8365e', '#e8b84a', t); stall(ctx, rect.x + rect.w * 0.82, lay.road - cs * 0.05, cs * 0.55, '#2f66b8', '#e8dcc0', t); }
    else if (p === 'well') well(ctx, rect.x + rect.w * 0.2, lay.road - cs * 0.04, cs * 0.5);
    else if (p === 'cairn') cairns(ctx, rect.x + rect.w * 0.16, lay.road - cs * 0.02, cs * 0.34);
    else if (p === 'horses') for (let i = 0; i < 4; i++) horse(ctx, rect.x + rect.w * (0.2 + i * 0.2), lay.road - cs * 0.0 - (i % 2) * 6, cs * 0.55, 0, { dir: i % 2 ? 1 : -1, coat: ['#7a4b2a', '#2a1c14', '#b08a5a', '#8a8078'][i], still: true });
    else if (p === 'crowd') crowd(ctx, rect.x + rect.w * 0.5, lay.road - cs * 0.02, cs * 0.9, 8, t);
    else if (p === 'mirage') mirage(ctx, rect, lay, t);
    else if (p === 'wolves') wolves(ctx, rect, lay, t);
    else if (p === 'stars') stars(ctx, rect, lay, t);
  }
  const C = spec.caravan;
  if (C) caravan(ctx, rect.x + rect.w * (C.x ?? 0.5), lay.road + cs * 0.1, cs, t, { n: clamp(Math.floor(rect.w / (cs * 0.95)) - 1, 2, C.n ?? 4), dir: C.dir ?? -1, kind: C.kind ?? 'bactrian', loads: C.loads, still: C.still });
  for (const p of PROP_FRONT) if (props.includes(p)) {
    if (p === 'fire') fire(ctx, rect.x + rect.w * (C ? 0.82 : 0.5), lay.road + cs * 0.22, cs * 0.28, t);
    else if (p === 'sick') sickCamel(ctx, rect.x + rect.w * 0.5, lay.road + cs * 0.15, cs, t);
    else if (p === 'caravan2') caravan(ctx, rect.x + rect.w * 0.82, lay.horizon + rect.h * 0.16, cs * 0.5, t, { n: 3, dir: -1, kind: spec.kind ?? 'bactrian', still: true, loads: [['silk'], ['glass'], ['spice']] });
  }
  for (const p of PROP_WEATHER) if (props.includes(p)) { if (p === 'storm') storm(ctx, rect, lay, t); else snowfall(ctx, rect, t); }
  finish(ctx, rect, time, { dust: props.includes('storm') ? 0.1 : 0, t });
  ctx.restore();
  return lay;
}

// A small city thumbnail for the Journal.
export function miniCity(ctx, box, id, dim, t) {
  const C = CITIES[id];
  cached(ctx, 'city' + id + (dim ? 'd' : ''), box.x, box.y, box.w, box.h, (c, r) => { paintScene(c, r, { biome: C.biome, time: C.sky, city: C.skyline, cityScale: 0.9, cityDrop: 0.2, horizon: 0.55 }, 0); });
}

// ---- the route map ---------------------------------------------------------------------------------------------------------------------
const GEO = [[108.9, 34.3], [103.8, 36.1], [94.7, 40.1], [89.2, 42.9], [76.0, 39.5], [67.0, 39.65], [62.2, 37.6], [51.4, 35.6], [44.4, 33.3]];
// Projection of (lon, lat) into a rect: west to the left on a wide map; on a tall one the map is turned so the east (Chang'an) is at the top.
function makeProj(rect) {
  const vertical = rect.h > rect.w * 0.95, lon0 = 40, lon1 = 112, lat0 = 30, lat1 = 46, pad = 0.09;
  const W = rect.w * (1 - pad * 2), H = rect.h * (1 - pad * 2.2);
  const along = vertical ? H : W, across = vertical ? W : H, sAlong = along / (lon1 - lon0), ex = Math.min(across / ((lat1 - lat0) * sAlong), 2.8), used = (lat1 - lat0) * sAlong * ex;
  const ox = rect.x + rect.w / 2 - (vertical ? used : along) / 2, oy = rect.y + rect.h / 2 - (vertical ? along : used) / 2;
  const f = (lon, lat) => { const a = (1 - (lon - lon0) / (lon1 - lon0)) * along, b = (1 - (lat - lat0) / (lat1 - lat0)) * used; return vertical ? { x: ox + b, y: oy + (along - a) } : { x: ox + a, y: oy + b }; };
  f.vertical = vertical; f.sAlong = sAlong; return f;
}
export function mapPoints(rect) { const f = makeProj(rect); return GEO.map(([lo, la]) => f(lo, la)); }
export function drawMap(ctx, rect, S, t, hot = -1) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 20); ctx.clip();
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h); g.addColorStop(0, '#ecd9a8'); g.addColorStop(0.5, '#e4cc94'); g.addColorStop(1, '#d4b676');
  ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(110,70,30,${0.03 + 0.04 * hash(i + 3)})`; ell(ctx, rect.x + hash(i) * rect.w, rect.y + hash(i + 9) * rect.h, 3 + hash(i + 5) * 18, 2 + hash(i + 6) * 10); ctx.fill(); }
  const P = makeProj(rect), pts = GEO.map(([lo, la]) => P(lo, la)), unit = Math.min(rect.w, rect.h) / 360;
  const mountain = (lon, lat, n, sc) => { for (let i = 0; i < n; i++) { const p = P(lon + (hash(i * 3 + lon) - 0.5) * 8, lat + (hash(i * 5 + lat) - 0.5) * 2.4), s = 13 * unit * sc * (0.7 + hash(i + 2) * 0.6); ctx.fillStyle = 'rgba(120,84,48,0.55)'; ctx.beginPath(); ctx.moveTo(p.x - s, p.y + s * 0.5); ctx.lineTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y + s * 0.5); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(250,244,228,0.7)'; ctx.beginPath(); ctx.moveTo(p.x - s * 0.3, p.y - s * 0.4); ctx.lineTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.3, p.y - s * 0.4); ctx.closePath(); ctx.fill(); } };
  mountain(80, 42.5, 14, 1.0); mountain(72, 38, 12, 1.2); mountain(55, 36, 9, 0.9); mountain(98, 36.5, 8, 0.9);
  const dots = (lon, lat, w, h, n) => { ctx.fillStyle = 'rgba(150,100,50,0.4)'; for (let i = 0; i < n; i++) { const p = P(lon + (hash(i * 7 + lon) - 0.5) * w, lat + (hash(i * 11 + lat) - 0.5) * h); ctx.fillRect(p.x, p.y, 2.2, 2.2); } };
  dots(85, 39, 14, 3, 160); dots(64, 40.5, 10, 3, 80); dots(100, 41.5, 12, 3, 70);
  ctx.strokeStyle = 'rgba(70,130,170,0.65)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  const river = (pp) => { ctx.beginPath(); pp.forEach((p, i) => { const q = P(p[0], p[1]); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.stroke(); };
  river([[44, 36], [44.2, 33.5], [47.5, 31], [48.5, 30]]); river([[40.5, 37.5], [43, 36.5], [44.2, 33.5]]); river([[60, 41.5], [62, 38.5], [65.5, 37.6]]); river([[103, 36.2], [107, 36.3], [109, 36]]);
  ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(100,50,20,0.55)'; ctx.lineWidth = 4; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
  if (S) {
    const reached = [...S.j.cities].sort((a, b) => a - b); const lo = reached[0], hi = reached[reached.length - 1];
    ctx.strokeStyle = '#b03a2a'; ctx.lineWidth = 6; ctx.beginPath(); for (let i = lo; i <= hi; i++) (i === lo ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y)); ctx.stroke();
  }
  const fs = Math.max(16, Math.min(Math.min(rect.w, rect.h) * 0.045, 26));
  pts.forEach((p, i) => {
    const seen = S ? S.j.cities.includes(i) : false, here = S && !S.trip && S.city === i;
    ctx.fillStyle = 'rgba(40,24,10,0.35)'; ell(ctx, p.x + 2, p.y + 3, fs * 0.6, fs * 0.35); ctx.fill();
    ctx.fillStyle = seen ? '#e8b84a' : '#f6eed8'; ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, fs * 0.5, 0, TAU); ctx.fill(); ctx.stroke();
    if (here) { ctx.strokeStyle = `rgba(176,58,42,${0.5 + 0.5 * Math.sin(t * 4)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, fs * (0.9 + 0.2 * Math.sin(t * 4)), 0, TAU); ctx.stroke(); }
    ctx.font = `800 ${fs}px "Cinzel", Georgia, serif`; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let lx, ly, al;
    if (P.vertical) { const left = i % 2 === 0; al = left ? 'right' : 'left'; lx = p.x + (left ? -fs * 0.9 : fs * 0.9); ly = p.y; }
    else { al = 'center'; lx = p.x; ly = p.y + (i % 2 === 0 ? -fs * 1.25 : fs * 1.35); }
    ctx.textAlign = al; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(244,230,190,0.92)'; ctx.strokeText(CITIES[i].short, lx, ly); ctx.fillStyle = seen ? '#3a1d0c' : 'rgba(58,29,12,0.6)'; ctx.fillText(CITIES[i].short, lx, ly);
  });
  if (S) {
    let mx, my;
    if (S.trip) { const a = pts[S.trip.from], b = pts[S.trip.to], k = S.trip.day / S.trip.days; mx = lerp(a.x, b.x, k); my = lerp(a.y, b.y, k); } else { mx = pts[S.city].x; my = pts[S.city].y; }
    ctx.fillStyle = '#b03a2a'; ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, my - fs * 0.1, fs * 0.38, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(80,44,18,0.7)'; ctx.font = `800 ${fs * 0.85}px "Cinzel", Georgia, serif`;
  if (P.vertical) { ctx.textAlign = 'left'; ctx.fillText('EAST', rect.x + 18, rect.y + 24); ctx.fillText('WEST', rect.x + 18, rect.y + rect.h - 24); }
  else { ctx.textAlign = 'left'; ctx.fillText('WEST', rect.x + 16, rect.y + rect.h - 20); ctx.textAlign = 'right'; ctx.fillText('EAST', rect.x + rect.w - 16, rect.y + rect.h - 20); }
  ctx.strokeStyle = 'rgba(80,44,18,0.8)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6, 18); ctx.stroke();
  const v = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.3, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75); v.addColorStop(0, 'rgba(60,30,10,0)'); v.addColorStop(1, 'rgba(60,30,10,0.35)'); ctx.fillStyle = v; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  return pts;
}
