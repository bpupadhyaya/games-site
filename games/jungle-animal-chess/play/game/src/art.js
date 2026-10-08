// Static art: the jungle table, the board, and the eight painted animal tokens. One light, from the upper left.
// The board and the token sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
import { host, BOARD_W, BOARD_H } from './layout.js';
import { TERR, WATER, TRAP1, TRAP2, DEN1, DEN2, ANIMALS } from './rules.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);
export const TEAM = { 1: { name: 'Red', a: '#e2584a', b: '#b8281f', c: '#6e100b', glow: '255,120,100' }, 2: { name: 'Blue', a: '#4f8ee8', b: '#2a5fc0', c: '#133577', glow: '110,170,255' } };

// ------------------------------------------------------------------------------------------------ board themes
export const THEMES = {
  meadow: { name: 'Meadow', grass: ['#79c457', '#5da644', '#468f37'], blade: [30, 90, 30], frame: ['#a5763d', '#7d5428', '#55361a'], edge: ['#4d3115', '#2a1809'], node: 'rgba(60,35,12,0.55)', water: ['#8fe0f5', '#36a5dc', '#1a6fb3'], shore: ['#e9dfc2', '#c5b88f'], line: 'rgba(24,70,24,0.28)', bg: ['#17341f', '#0e2417', '#07140f'] },
  dusk: { name: 'Dusk', grass: ['#58a77a', '#3f8a69', '#2e7157'], blade: [14, 62, 52], frame: ['#6c5a8a', '#4b3d68', '#31264a'], edge: ['#2d2347', '#150f26'], node: 'rgba(20,12,40,0.55)', water: ['#9ad0ff', '#4a86e6', '#2a4fb5'], shore: ['#d9d3ea', '#a79fc6'], line: 'rgba(10,50,45,0.3)', bg: ['#1b2142', '#121733', '#090c1e'] },
  bamboo: { name: 'Bamboo', grass: ['#b8cf6a', '#9bb852', '#7f9e3f'], blade: [70, 100, 20], frame: ['#c9b062', '#a28d42', '#76662a'], edge: ['#6a5a22', '#3b3112'], node: 'rgba(70,55,10,0.55)', water: ['#a6ecea', '#46bcc4', '#1f869c'], shore: ['#f1e6c0', '#cfc08a'], line: 'rgba(60,80,10,0.3)', bg: ['#2c3a1c', '#1d2813', '#0d150a'] },
};
export const THEME_KEYS = ['meadow', 'dusk', 'bamboo'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0, theme = 'meadow') {
  const { w, h } = L, th = THEMES[theme] || THEMES.meadow;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, th.bg[0]); bg.addColorStop(0.5, th.bg[1]); bg.addColorStop(1, th.bg[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.HH / 2 : h / 2, rad = Math.max(w, h) * 0.66;
  const lamp = ctx.createRadialGradient(cx - rad * 0.1, cy - rad * 0.25, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,240,170,0.20)'); lamp.addColorStop(0.45, 'rgba(180,255,170,0.06)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // big soft leaves in the corners (drawn from a fixed seed, so they never flicker)
  leaves(ctx, w, h, th);
  // slow light shafts
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const x0 = w * (0.12 + k * 0.34) + Math.sin(t * 0.12 + k * 2) * 40, wid = Math.max(w, h) * 0.07;
    const g = ctx.createLinearGradient(x0, 0, x0 + h * 0.25, h);
    g.addColorStop(0, 'rgba(255,245,170,0.055)'); g.addColorStop(1, 'rgba(255,245,170,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + wid, 0); ctx.lineTo(x0 + wid + h * 0.28, h); ctx.lineTo(x0 + h * 0.28 - wid * 0.3, h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}
let leafKey = '', leafLayer = null;
function leaves(ctx, w, h, th) {
  const key = `${Math.round(w)}x${Math.round(h)}|${th.bg[0]}`;
  if (key !== leafKey) {
    leafKey = key; leafLayer = null;
    const m = mk(w, h);
    if (m) { paintLeaves(m.x, w, h); leafLayer = m.c; }
  }
  if (leafLayer) ctx.drawImage(leafLayer, 0, 0, w, h); else paintLeaves(ctx, w, h);
}
function paintLeaves(ctx, w, h) {
  const rnd = lcg(5), S = Math.min(w, h);
  const leaf = (x, y, len, ang, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, `rgba(10,40,18,${a})`); g.addColorStop(1, `rgba(40,110,50,${a * 0.6})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.26, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.26, 0, 0); ctx.fill();
    ctx.strokeStyle = `rgba(150,230,140,${a * 0.28})`; ctx.lineWidth = Math.max(1, len * 0.012); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.96, 0); ctx.stroke();
    ctx.restore();
  };
  for (const [cx, cy, base] of [[0, 0, 0.7], [w, 0, 2.4], [0, h, -0.7], [w, h, 3.9]]) {
    for (let k = 0; k < 7; k++) leaf(cx, cy, S * (0.34 + rnd() * 0.26), base + (rnd() - 0.5) * 1.5, 0.5 + rnd() * 0.35);
  }
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100*BOARD_W, height 100*BOARD_H, plus the slab.
const SLAB = 22, F = 50;
const CW = BOARD_W * 100, CH = BOARD_H * 100;
function paintBoard(ctx, themeKey) {
  const th = THEMES[themeKey] || THEMES.meadow, W = CW, H = CH, rnd = lcg(11 + themeKey.length * 17);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  ctx.save();
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 26 + 4 * k); ctx.fill(); }
  ctx.restore();
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB); sg.addColorStop(0, th.edge[0]); sg.addColorStop(1, th.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,190,0.18)'; ctx.fillRect(14, H + 1, W - 28, 2.5);
  const tg = ctx.createLinearGradient(0, 0, W, H); tg.addColorStop(0, th.frame[0]); tg.addColorStop(0.5, th.frame[1]); tg.addColorStop(1, th.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,190,0.38)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 14); ctx.stroke();
  // frame grain and bamboo-style growth rings (nodes) along each side
  ctx.save(); rr(0, 0, W, H, 18); ctx.clip();
  for (let k = 0; k < 70; k++) { const y = rnd() * H, a = 0.03 + rnd() * 0.07; ctx.strokeStyle = rnd() < 0.55 ? `rgba(30,18,6,${a})` : `rgba(255,236,190,${a * 0.7})`; ctx.lineWidth = 0.8 + rnd() * 1.8; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 14, W * 0.7, y + (rnd() - 0.5) * 14, W, y + (rnd() - 0.5) * 8); ctx.stroke(); }
  ctx.fillStyle = th.node;
  for (let x = 120; x < W - 60; x += 170) { ctx.fillRect(x, 6, 5, F - 12); ctx.fillRect(x, H - F + 6, 5, F - 12); ctx.fillStyle = 'rgba(255,240,190,0.18)'; ctx.fillRect(x + 5, 6, 2, F - 12); ctx.fillRect(x + 5, H - F + 6, 2, F - 12); ctx.fillStyle = th.node; }
  for (let y = 120; y < H - 60; y += 170) { ctx.fillRect(6, y, F - 12, 5); ctx.fillRect(W - F + 6, y, F - 12, 5); ctx.fillStyle = 'rgba(255,240,190,0.18)'; ctx.fillRect(6, y + 5, F - 12, 2); ctx.fillRect(W - F + 6, y + 5, F - 12, 2); ctx.fillStyle = th.node; }
  ctx.restore();
  // the playing field: grass
  const gx = F, gy = F, GW = 700, GH = 900;
  ctx.save(); rr(gx - 8, gy - 8, GW + 16, GH + 16, 8); ctx.clip();
  const gg = ctx.createLinearGradient(gx, gy, gx + GW, gy + GH); gg.addColorStop(0, th.grass[0]); gg.addColorStop(0.55, th.grass[1]); gg.addColorStop(1, th.grass[2]);
  ctx.fillStyle = gg; ctx.fillRect(gx - 8, gy - 8, GW + 16, GH + 16);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) { const k = (r + c) & 1; ctx.fillStyle = k ? 'rgba(255,255,210,0.07)' : 'rgba(0,30,0,0.07)'; ctx.fillRect(gx + c * 100, gy + r * 100, 100, 100); }
  for (let k = 0; k < 900; k++) {                                              // grass blades
    const x = gx + rnd() * GW, y = gy + rnd() * GH, l = 5 + rnd() * 9, lean = (rnd() - 0.5) * 6, lit = rnd() < 0.45;
    ctx.strokeStyle = lit ? `rgba(230,255,150,${0.08 + rnd() * 0.16})` : `rgba(${th.blade[0]},${th.blade[1]},${th.blade[2]},${0.1 + rnd() * 0.2})`; ctx.lineWidth = 1 + rnd() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.4, y - l * 0.6, x + lean, y - l); ctx.stroke();
  }
  for (let k = 0; k < 26; k++) {                                               // tiny flowers
    const x = gx + rnd() * GW, y = gy + rnd() * GH, col = ['#fff3a8', '#ffffff', '#ffc2d4'][k % 3];
    ctx.fillStyle = col; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // sunk into the frame: shadow top/left, light bottom/right
  const is = ctx.createLinearGradient(0, gy - 8, 0, gy + 40); is.addColorStop(0, 'rgba(0,0,0,0.38)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(gx - 8, gy - 8, GW + 16, 48);
  const il = ctx.createLinearGradient(gx - 8, 0, gx + 40, 0); il.addColorStop(0, 'rgba(0,0,0,0.3)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(gx - 8, gy - 8, 48, GH + 16);
  const ib = ctx.createLinearGradient(0, gy + GH + 8, 0, gy + GH - 30); ib.addColorStop(0, 'rgba(255,255,220,0.26)'); ib.addColorStop(1, 'rgba(255,255,220,0)'); ctx.fillStyle = ib; ctx.fillRect(gx - 8, gy + GH - 30, GW + 16, 38);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; rr(gx - 8, gy - 8, GW + 16, GH + 16, 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,220,0.35)'; ctx.lineWidth = 1.5; rr(gx - 6.5, gy - 6.5, GW + 13, GH + 13, 7); ctx.stroke();
  // square lines
  ctx.strokeStyle = th.line; ctx.lineWidth = 2.4; ctx.beginPath();
  for (let i = 0; i <= 9; i++) { ctx.moveTo(gx, gy + i * 100); ctx.lineTo(gx + GW, gy + i * 100); }
  for (let j = 0; j <= 7; j++) { ctx.moveTo(gx + j * 100, gy); ctx.lineTo(gx + j * 100, gy + GH); }
  ctx.stroke();
  // lakes
  for (const c0 of [1, 4]) paintLake(ctx, gx + c0 * 100, gy + 300, 200, 300, th, lcg(c0 * 13));
  // traps and dens
  for (let i = 0; i < 63; i++) {
    const t = TERR[i], cx = gx + (i % 7) * 100 + 50, cy = gy + Math.floor(i / 7) * 100 + 50;
    if (t === TRAP1 || t === TRAP2) paintTrap(ctx, cx, cy, t === TRAP1 ? 1 : 2);
    else if (t === DEN1 || t === DEN2) paintDen(ctx, cx, cy, t === DEN1 ? 1 : 2);
  }
  const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,250,215,0.14)'); lg.addColorStop(0.5, 'rgba(255,250,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 18); ctx.fill();
}
function paintLake(ctx, x, y, w, h, th, rnd) {
  const rr = (a, b, c, d, r) => { ctx.beginPath(); ctx.roundRect(a, b, c, d, r); };
  // stone shore
  const sg = ctx.createLinearGradient(x, y, x + w, y + h); sg.addColorStop(0, th.shore[0]); sg.addColorStop(1, th.shore[1]);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(x - 8, y - 3, w + 16, h + 16, 34); ctx.fill();
  ctx.fillStyle = sg; rr(x - 10, y - 10, w + 20, h + 20, 32); ctx.fill();
  for (let k = 0; k < 26; k++) {                                                // pebbles on the shore
    const a = rnd() * TAU, onX = Math.cos(a) * (w / 2 + 2), onY = Math.sin(a) * (h / 2 + 2);
    const px0 = x + w / 2 + clamp(onX * 1.15, -w / 2 - 4, w / 2 + 4), py0 = y + h / 2 + clamp(onY * 1.15, -h / 2 - 4, h / 2 + 4);
    ctx.fillStyle = `rgba(110,95,60,${0.25 + rnd() * 0.2})`; ctx.beginPath(); ctx.ellipse(px0, py0, 3 + rnd() * 3, 2 + rnd() * 2, rnd() * 3, 0, TAU); ctx.fill();
  }
  // water
  ctx.save(); rr(x, y, w, h, 24); ctx.clip();
  const wg = ctx.createLinearGradient(x, y, x + w * 0.4, y + h); wg.addColorStop(0, th.water[0]); wg.addColorStop(0.45, th.water[1]); wg.addColorStop(1, th.water[2]);
  ctx.fillStyle = wg; ctx.fillRect(x, y, w, h);
  const dg = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, h * 0.62); dg.addColorStop(0, 'rgba(0,40,110,0.28)'); dg.addColorStop(1, 'rgba(0,40,110,0)'); ctx.fillStyle = dg; ctx.fillRect(x, y, w, h);
  const sh = ctx.createLinearGradient(0, y, 0, y + 60); sh.addColorStop(0, 'rgba(0,30,80,0.35)'); sh.addColorStop(1, 'rgba(0,30,80,0)'); ctx.fillStyle = sh; ctx.fillRect(x, y, w, 60);
  const sl = ctx.createLinearGradient(x, 0, x + 50, 0); sl.addColorStop(0, 'rgba(0,30,80,0.3)'); sl.addColorStop(1, 'rgba(0,30,80,0)'); ctx.fillStyle = sl; ctx.fillRect(x, y, 50, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.beginPath();           // faint square lines under the water
  for (let i = 1; i < 3; i++) { ctx.moveTo(x, y + i * 100); ctx.lineTo(x + w, y + i * 100); }
  ctx.moveTo(x + 100, y); ctx.lineTo(x + 100, y + h); ctx.stroke();
  for (let k = 0; k < 14; k++) {                                                          // lily pads
    if (k > 3) break;
    const lx = x + 20 + rnd() * (w - 40), ly = y + 20 + rnd() * (h - 40), s = 9 + rnd() * 7;
    ctx.fillStyle = 'rgba(60,160,80,0.75)'; ctx.beginPath(); ctx.arc(lx, ly, s, 0.4, TAU - 0.2); ctx.lineTo(lx, ly); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,200,0.9)'; if (k === 1) { ctx.beginPath(); ctx.arc(lx + s * 0.1, ly - s * 0.1, s * 0.34, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,40,90,0.5)'; ctx.lineWidth = 2.5; rr(x, y, w, h, 24); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; rr(x + 2, y + 2, w - 4, h - 4, 22); ctx.stroke();
}
// A pit trap: dark hollow ringed by teeth in the colour of the side whose den it guards.
function paintTrap(ctx, cx, cy, side) {
  const tm = TEAM[side];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(cx, cy + 3, 40, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, 38); g.addColorStop(0, '#4b3320'); g.addColorStop(0.7, '#241508'); g.addColorStop(1, '#120a03');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 36, 0, TAU); ctx.fill();
  ctx.fillStyle = tm.b;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ctx.save(); ctx.translate(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(0, -9); ctx.lineTo(7, 4); ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.strokeStyle = tm.a; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 31, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, TAU); ctx.stroke();
  ctx.restore();
}
// A den: a little thatched gate with a banner, in the side's colour.
function paintDen(ctx, cx, cy, side) {
  const tm = TEAM[side];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 30, 44, 12, 0, 0, TAU); ctx.fill();
  const sg = ctx.createLinearGradient(cx - 40, cy, cx + 40, cy); sg.addColorStop(0, '#9a8f78'); sg.addColorStop(0.5, '#d8cfb4'); sg.addColorStop(1, '#8a7f68');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(cx - 40, cy - 6, 80, 40, 8); ctx.fill(); ctx.strokeStyle = 'rgba(40,30,10,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  const dg = ctx.createLinearGradient(0, cy - 4, 0, cy + 34); dg.addColorStop(0, '#0a0604'); dg.addColorStop(1, '#2a1a0a');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.moveTo(cx - 20, cy + 34); ctx.lineTo(cx - 20, cy + 8); ctx.quadraticCurveTo(cx, cy - 12, cx + 20, cy + 8); ctx.lineTo(cx + 20, cy + 34); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = tm.a; ctx.lineWidth = 3; ctx.stroke();
  const rg = ctx.createLinearGradient(0, cy - 40, 0, cy - 4); rg.addColorStop(0, tm.a); rg.addColorStop(1, tm.c);       // pointed roof
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(cx - 50, cy - 4); ctx.quadraticCurveTo(cx - 20, cy - 12, cx, cy - 42); ctx.quadraticCurveTo(cx + 20, cy - 12, cx + 50, cy - 4); ctx.quadraticCurveTo(cx, cy - 14, cx - 50, cy - 4); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.moveTo(cx - 30, cy - 8); ctx.quadraticCurveTo(cx - 12, cy - 14, cx - 2, cy - 36); ctx.quadraticCurveTo(cx - 12, cy - 18, cx - 30, cy - 8); ctx.fill();
  ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.arc(cx, cy - 44, 5, 0, TAU); ctx.fill();   // roof knob
  ctx.restore();
}

const boardCache = new Map();
export function drawBoard(ctx, b, theme = 'meadow') {
  const k = b.S / CW, P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64), key = theme + '|' + wpx;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / CW, m = mk(wpx + 8, (CH + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, theme); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, theme);
  ctx.restore();
}
// Moving highlights on the two lakes (cheap: a few sine ripples clipped to the water), drawn over the board and under the tokens.
export function drawWater(ctx, b, t, calm) {
  const cell = b.cell;
  ctx.save();
  for (const c0 of [1, 4]) {
    const x = b.gx + c0 * cell, y = b.gy + 3 * cell, w = 2 * cell, h = 3 * cell;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, cell * 0.24); ctx.clip();
    if (calm) { ctx.restore(); ctx.save(); continue; }
    ctx.lineWidth = Math.max(1, cell * 0.022);
    for (let k = 0; k < 9; k++) {
      const yy = y + ((k + 0.5) / 9) * h, ph = t * 0.9 + k * 1.7 + c0, a = 0.10 + 0.07 * Math.sin(ph * 1.3);
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath();
      for (let s = 0; s <= 20; s++) { const xx = x + (s / 20) * w, yv = yy + Math.sin(s * 0.7 + ph) * cell * 0.03; if (s) ctx.lineTo(xx, yv); else ctx.moveTo(xx, yv); }
      ctx.stroke();
    }
    const gl = ctx.createLinearGradient(x, y, x + w, y + h); const sh = 0.5 + 0.5 * Math.sin(t * 0.5 + c0);
    gl.addColorStop(0, `rgba(255,255,255,${0.06 + 0.06 * sh})`); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, `rgba(255,255,255,${0.04})`);
    ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
    ctx.restore(); ctx.save();
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ the animal tokens
// Local units: a token has radius 46 (cell = 100), the painted face disc radius 35. Origin = the token's centre; `ty` lifts the top face over its thickness.
const DEPTH = 13;
const E = (ctx, x, y, rx, ry, fill, rot = 0) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
const O = (ctx, x, y, rx, ry, stroke, w = 1.4, rot = 0) => { ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.stroke(); };
const POLY = (ctx, pts, fill, stroke) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } };
const INK = '#2b1a10';
function eyes(ctx, y, dx, s = 1, col = INK, angry = 0) {
  for (const sgn of [-1, 1]) {
    const x = sgn * dx;
    E(ctx, x, y, 5.4 * s, 6.2 * s, '#fffdf4'); O(ctx, x, y, 5.4 * s, 6.2 * s, 'rgba(0,0,0,0.45)', 1);
    E(ctx, x + sgn * -0.4 * s, y + 0.6 * s, 3.5 * s, 4.2 * s, col); E(ctx, x - 1.2 * s, y - 1.4 * s, 1.3 * s, 1.5 * s, '#fff');
    if (angry) { ctx.strokeStyle = INK; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - sgn * 7 * s, y - (6 - angry * 0) * s - 3); ctx.lineTo(x + sgn * 5 * s, y - 6 * s + angry * 2.5); ctx.stroke(); }
  }
}
function whiskers(ctx, y, x0, len, col = 'rgba(40,25,15,0.75)') {
  ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) for (const dy of [-3, 1.5, 6]) { ctx.beginPath(); ctx.moveTo(sgn * x0, y + dy * 0.4); ctx.quadraticCurveTo(sgn * (x0 + len * 0.6), y + dy, sgn * (x0 + len), y + dy * 1.7); ctx.stroke(); }
}
function nose(ctx, x, y, w, col = '#f08a9a') { POLY(ctx, [[x - w, y - w * 0.6], [x + w, y - w * 0.6], [x, y + w * 0.7]], col, 'rgba(60,20,20,0.7)'); }

const DRAW = {
  1() { /* rat */ return (ctx) => {
    for (const s of [-1, 1]) { E(ctx, s * 21, -17, 12.5, 12.5, '#8e939c'); E(ctx, s * 21, -17, 8.2, 8.2, '#f3a3b3'); }
    E(ctx, 0, 2, 25, 24, '#a7acb5'); E(ctx, 0, 9, 17, 14, '#c9cdd4');
    POLY(ctx, [[-9, 4], [9, 4], [0, 26]], '#b9bdc5'); // snout
    eyes(ctx, -5, 11, 0.95); nose(ctx, 0, 19, 4.4, '#f0788f');
    ctx.fillStyle = '#fffdf3'; ctx.fillRect(-3.4, 22, 3, 5.5); ctx.fillRect(0.4, 22, 3, 5.5); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.9; ctx.strokeRect(-3.4, 22, 3, 5.5); ctx.strokeRect(0.4, 22, 3, 5.5);
    whiskers(ctx, 14, 8, 20, 'rgba(60,60,70,0.85)');
  }; },
  2() { /* cat */ return (ctx) => {
    for (const s of [-1, 1]) { POLY(ctx, [[s * 28, -4], [s * 24, -34], [s * 6, -22]], '#e8913a', 'rgba(80,40,10,0.7)'); POLY(ctx, [[s * 24, -9], [s * 22, -27], [s * 11, -19]], '#f6aab5'); }
    E(ctx, 0, 2, 28, 24, '#f2a448'); E(ctx, 0, 11, 17, 12, '#fbe0b4');
    ctx.strokeStyle = '#a65a1a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(dx, -22); ctx.lineTo(dx * 0.8, -12); ctx.stroke(); }
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 28, -2); ctx.lineTo(s * 20, 1); ctx.moveTo(s * 28, 7); ctx.lineTo(s * 20, 7); ctx.stroke(); }
    eyes(ctx, -3, 11, 1, '#2d6b2b'); nose(ctx, 0, 8, 3.6);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 12); ctx.quadraticCurveTo(-4, 17, -8, 14); ctx.moveTo(0, 12); ctx.quadraticCurveTo(4, 17, 8, 14); ctx.stroke();
    whiskers(ctx, 11, 14, 17);
  }; },
  3() { /* dog */ return (ctx) => {
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 26, -10); ctx.rotate(s * 0.35); E(ctx, 0, 8, 11.5, 21, '#7b4a25'); E(ctx, s * -2, 6, 6, 14, 'rgba(255,255,255,0.12)'); ctx.restore(); }
    E(ctx, 0, 0, 25, 25, '#d7a066'); E(ctx, 0, 11, 17, 14.5, '#f5deb6');
    E(ctx, -12, -6, 9, 9, '#8b5a2c', -0.3);                                                     // eye patch
    eyes(ctx, -5, 11, 1);
    E(ctx, 0, 7, 8.6, 6.4, '#241912'); E(ctx, -2.2, 5.2, 2.6, 1.6, 'rgba(255,255,255,0.55)');
    ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, 17); ctx.moveTo(0, 17); ctx.quadraticCurveTo(-5, 22, -9, 18); ctx.moveTo(0, 17); ctx.quadraticCurveTo(5, 22, 9, 18); ctx.stroke();
    ctx.fillStyle = '#ef7186'; ctx.beginPath(); ctx.ellipse(0, 22, 4.4, 5.6, 0, 0, Math.PI); ctx.fill();
  }; },
  4() { /* wolf */ return (ctx) => {
    for (const s of [-1, 1]) { POLY(ctx, [[s * 29, -2], [s * 26, -38], [s * 9, -20]], '#6d7684', 'rgba(20,24,34,0.8)'); POLY(ctx, [[s * 25, -8], [s * 24, -30], [s * 13, -19]], '#c4a3b0'); }
    E(ctx, 0, 0, 30, 25, '#868fa0');
    POLY(ctx, [[-15, 2], [15, 2], [8, 28], [-8, 28]], '#d9dde4', null); E(ctx, 0, 27, 8, 4.5, '#d9dde4');
    for (const s of [-1, 1]) { POLY(ctx, [[s * 30, 5], [s * 22, 13], [s * 31, 15]], '#d9dde4'); POLY(ctx, [[s * 28, -8], [s * 18, -4], [s * 28, -2]], '#4d5565'); }
    POLY(ctx, [[0, -22], [-5, -9], [5, -9]], '#4d5565');
    eyes(ctx, -3, 12, 0.95, '#d99a1b', 1);
    E(ctx, 0, 24, 5.4, 4, '#1c1c24');
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, 30); ctx.stroke();
    ctx.fillStyle = '#fff'; POLY(ctx, [[-6, 30], [-3.4, 30], [-4.6, 34]], '#fff'); POLY(ctx, [[6, 30], [3.4, 30], [4.6, 34]], '#fff');
  }; },
  5() { /* leopard */ return (ctx) => {
    for (const s of [-1, 1]) { E(ctx, s * 24, -19, 10.5, 10.5, '#e2a937'); E(ctx, s * 24, -19, 6, 6, '#3a2418'); }
    E(ctx, 0, 1, 28, 25, '#efc152'); E(ctx, 0, 11, 17, 13, '#fbf0cb');
    ctx.fillStyle = '#4a2c14';
    const spots = [[-17, -16], [-7, -21], [7, -21], [17, -16], [-24, -3], [24, -3], [-21, 9], [21, 9], [0, -14]];
    for (const [x, y] of spots) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(74,44,20,0.55)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, 5.2, 0.6, 4.2); ctx.stroke(); }
    eyes(ctx, -4, 11, 1, '#3f8a2d'); nose(ctx, 0, 9, 3.9, '#3d2218');
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 13); ctx.quadraticCurveTo(-5, 18, -9, 15); ctx.moveTo(0, 13); ctx.quadraticCurveTo(5, 18, 9, 15); ctx.stroke();
    ctx.fillStyle = '#4a2c14'; for (const s of [-1, 1]) for (const dy of [14, 18]) { ctx.beginPath(); ctx.arc(s * (7 + (dy - 14)), dy, 0.9, 0, TAU); ctx.fill(); }
  }; },
  6() { /* tiger */ return (ctx) => {
    for (const s of [-1, 1]) { E(ctx, s * 24, -20, 11, 11, '#e9811c'); E(ctx, s * 24, -20, 6.5, 6.5, '#fff1d6'); }
    E(ctx, 0, 1, 29, 26, '#f4902a');
    ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { for (const [y0, l] of [[-6, 10], [3, 12], [12, 9]]) { ctx.beginPath(); ctx.moveTo(s * 29, y0); ctx.quadraticCurveTo(s * (29 - l * 0.6), y0 + 1, s * (29 - l), y0 + 3); ctx.stroke(); } }
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -25); ctx.lineTo(10, -25); ctx.moveTo(-7, -20); ctx.lineTo(7, -20); ctx.moveTo(-4, -25); ctx.lineTo(-4, -15); ctx.moveTo(4, -25); ctx.lineTo(4, -15); ctx.stroke();    // the wang mark
    E(ctx, -9, 10, 10.5, 9, '#fff6e2'); E(ctx, 9, 10, 10.5, 9, '#fff6e2'); E(ctx, 0, 17, 9, 7, '#fff6e2');
    for (const s of [-1, 1]) E(ctx, s * 12, -4, 8, 4.6, '#fff0d0', s * 0.3);
    eyes(ctx, -3, 11.5, 0.95, '#2a1608', 1);
    nose(ctx, 0, 8, 4.2, '#e8647c');
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 15); ctx.moveTo(0, 15); ctx.quadraticCurveTo(-5, 20, -9, 17); ctx.moveTo(0, 15); ctx.quadraticCurveTo(5, 20, 9, 17); ctx.stroke();
    whiskers(ctx, 15, 12, 13, 'rgba(40,25,15,0.5)');
  }; },
  7() { /* lion */ return (ctx) => {
    const mane = ['#9a4a14', '#c06a1c'];
    for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 16; k++) {
      const a = (k + ring * 0.5) / 16 * TAU, r = ring ? 25 : 31, len = ring ? 13 : 12;
      ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a);
      E(ctx, len * 0.3, 0, len, 7.5, mane[ring]); ctx.restore();
    }
    for (const s of [-1, 1]) { E(ctx, s * 21, -21, 8.5, 8.5, '#e6a936'); E(ctx, s * 21, -21, 4.8, 4.8, '#8a4a1a'); }
    E(ctx, 0, 2, 24, 22, '#f5c660'); E(ctx, 0, 11, 15, 12, '#fdeab8');
    eyes(ctx, -4, 10, 0.95, '#4a2a10', 0); nose(ctx, 0, 6, 4.6, '#6b3a22');
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 14); ctx.moveTo(0, 14); ctx.quadraticCurveTo(-5, 19, -9, 15); ctx.moveTo(0, 14); ctx.quadraticCurveTo(5, 19, 9, 15); ctx.stroke();
    ctx.fillStyle = '#6b3a22'; for (const s of [-1, 1]) for (const dy of [12, 16]) { ctx.beginPath(); ctx.arc(s * (8 + (dy - 12) * 0.6), dy, 0.9, 0, TAU); ctx.fill(); }
  }; },
  8() { /* elephant */ return (ctx) => {
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 25, -3); ctx.rotate(s * 0.25); E(ctx, 0, 0, 14, 24, '#8590a3'); E(ctx, s * -1, 0, 8.4, 17, '#f0aab9'); ctx.restore(); }
    E(ctx, 0, -2, 24, 24, '#a5afc0');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -4, 20, 3.6, 5.5); ctx.stroke();
    eyes(ctx, -9, 12, 0.85, INK);
    for (const s of [-1, 1]) { ctx.fillStyle = '#fffdf1'; ctx.beginPath(); ctx.moveTo(s * 10, 12); ctx.quadraticCurveTo(s * 25, 15, s * 27, 3); ctx.quadraticCurveTo(s * 20, 16, s * 6, 17); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(80,60,30,0.7)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    const tg = ctx.createLinearGradient(-8, 0, 8, 0); tg.addColorStop(0, '#8e99ad'); tg.addColorStop(0.5, '#b4bdcc'); tg.addColorStop(1, '#8e99ad');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-8.5, -2); ctx.lineTo(8.5, -2); ctx.quadraticCurveTo(10, 18, 3, 28); ctx.quadraticCurveTo(-2, 34, -8, 28); ctx.quadraticCurveTo(-4, 26, -3.5, 18); ctx.quadraticCurveTo(-8.5, 8, -8.5, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,70,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,50,70,0.35)'; ctx.lineWidth = 1.1; for (const y of [4, 10, 16, 21]) { ctx.beginPath(); ctx.moveTo(-6.5 + (y > 14 ? 1 : 0), y); ctx.lineTo(6 - (y > 14 ? 1.5 : 0), y); ctx.stroke(); }
  }; },
};

function paintToken(ctx, side, rank, style) {
  const tm = TEAM[side], night = style === 'night';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // thickness: the disc swept down by DEPTH
  ctx.fillStyle = tm.c; for (let d = DEPTH; d >= 0; d -= 1) { ctx.beginPath(); ctx.arc(0, d - DEPTH / 2 + 2, 46, 0, TAU); ctx.fill(); }
  const sh = ctx.createLinearGradient(0, -20, 0, DEPTH + 46); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = sh; ctx.fillRect(-60, -60, 120, 140); ctx.restore();
  const ty = -DEPTH / 2 + 2;
  ctx.save(); ctx.translate(0, ty);
  // lacquer rim
  const rg = ctx.createLinearGradient(-40, -46, 40, 46); rg.addColorStop(0, tm.a); rg.addColorStop(0.55, tm.b); rg.addColorStop(1, tm.c);
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
  const bv = ctx.createLinearGradient(-40, -40, 40, 40); bv.addColorStop(0, 'rgba(255,255,255,0.7)'); bv.addColorStop(0.5, 'rgba(255,255,255,0)'); bv.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.strokeStyle = bv; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 43, 0, TAU); ctx.stroke();
  // gold hairline then the face disc
  ctx.strokeStyle = '#f3cf72'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, 38.5, 0, TAU); ctx.stroke();
  const fg = night ? ['#33466f', '#1c2a4a'] : ['#fff6dc', '#ecd9a6'];
  const fgr = ctx.createRadialGradient(-10, -14, 4, 0, 0, 38); fgr.addColorStop(0, fg[0]); fgr.addColorStop(1, fg[1]);
  ctx.fillStyle = fgr; ctx.beginPath(); ctx.arc(0, 0, 36.5, 0, TAU); ctx.fill();
  // the animal, clipped to the face disc
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.clip(); ctx.translate(0, 1); ctx.scale(0.98, 0.98); DRAW[rank]()(ctx); ctx.restore();
  // inner shade and gloss
  const is = ctx.createRadialGradient(0, 0, 24, 0, 0, 37); is.addColorStop(0, 'rgba(0,0,0,0)'); is.addColorStop(1, 'rgba(0,0,0,0.34)'); ctx.fillStyle = is; ctx.beginPath(); ctx.arc(0, 0, 36.5, 0, TAU); ctx.fill();
  const gl = ctx.createLinearGradient(-30, -36, 10, 4); gl.addColorStop(0, 'rgba(255,255,255,0.42)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(-10, -17, 24, 13, -0.6, 0, TAU); ctx.fill();
  const sp = ctx.createRadialGradient(-16, -26, 0, -16, -26, 14); sp.addColorStop(0, 'rgba(255,255,255,0.65)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sp; ctx.fillRect(-34, -44, 40, 40);
  // rank badge
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(30.5, 31.5, 13.5, 0, TAU); ctx.fill();
  const bgg = ctx.createLinearGradient(0, 17, 0, 44); bgg.addColorStop(0, '#fff8de'); bgg.addColorStop(1, '#e8cf8a');
  ctx.fillStyle = bgg; ctx.beginPath(); ctx.arc(30, 30, 12.5, 0, TAU); ctx.fill(); ctx.strokeStyle = tm.c; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.fillStyle = tm.c; ctx.font = '700 18px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(rank), 30, 31); ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
const spriteCache = new Map();
function sprite(side, rank, style, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${side}|${rank}|${style}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 140 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 76 * u); m.x.scale(u, u); paintToken(m.x, side, rank, style); m.x.restore(); s = m.c; }
    spriteCache.set(key, s); if (spriteCache.size > 80) spriteCache.delete(spriteCache.keys().next().value);
  }
  return s;
}
let blobC;
export function blob(ctx, x, y, rx, ry, a) {
  if (blobC === undefined) { blobC = null; const m = mk(128, 128); if (m) { const g = m.x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); m.x.fillStyle = g; m.x.fillRect(0, 0, 128, 128); blobC = m.c; } }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  if (blobC) ctx.drawImage(blobC, x - rx, y - ry, rx * 2, ry * 2);
  else { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}

// Draws a token standing on the cell centred (x, y). opts: { lift (0..1, in half-cells), alpha, scale, glow, tilt, flash, trapped, swim }
export function drawPiece(ctx, side, rank, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.06, cell * 0.98, cell * 0.8, opts.glow);
  if (!opts.swim) {
    blob(ctx, x + cell * 0.02, y + cell * 0.3, cell * 0.44, cell * 0.1, 0.75 * Math.max(0, 1 - lift * 0.8));
    blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.2 + lift * 0.1), cell * (0.66 + lift * 0.1), cell * (0.3 + lift * 0.04), Math.max(0.12, 0.5 - lift * 0.1));
  }
  ctx.translate(x, y - lift * cell * 0.3 + (opts.swim ? cell * 0.08 : 0));
  if (opts.tilt) ctx.rotate(opts.tilt);
  const s = sprite(side, rank, style, cell * px() * (opts.scale ?? 1));
  if (opts.swim) { ctx.beginPath(); ctx.rect(-cell, -cell, cell * 2, cell * 1.18); ctx.clip(); }      // the swimming rat is half under the water
  if (s) ctx.drawImage(s, -60 * k, -76 * k, 120 * k, 140 * k);
  else { ctx.scale(k, k); paintToken(ctx, side, rank, style); ctx.setTransform(1, 0, 0, 1, 0, 0); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.beginPath(); ctx.arc(0, -DEPTH * k / 2 + 2 * k, 46 * k, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (opts.trapped) {                                                       // a small badge: this animal is in a trap, its rank counts as zero
    ctx.save(); const bx = x + cell * 0.3, by = y - cell * 0.34 - lift * cell * 0.3;
    ctx.fillStyle = '#2b2b33'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, cell * 0.03); ctx.beginPath(); ctx.arc(bx, by, cell * 0.15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(cell * 0.2)}px Fredoka, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('0', bx, by + cell * 0.07); ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------- diagrams
// A small board for the Rules, How to Play and lessons. spec.rows: strings, two characters per square:
//   '..' grass  '~~' water  'TR' red trap  'TB' blue trap  'DR' red den  'DB' blue den
//   'R1'..'R8' red animal (rank), 'B1'..'B8' blue animal on land;  'r1' / 'b1' a rat swimming on water
// spec.on: [[r,c,'T'|'W'|'D'...]] not needed; the terrain under a piece is given by spec.under (same two-char codes) when it differs from grass.
// spec.marks [[r,c,'ring'|'cross'|'dot'|'target']], spec.hl [[r,c,color]], spec.arrows [[r0,c0,r1,c1]].
export function drawDiagram(ctx, spec, x, y, cellPx, themeKey = 'meadow', style = 'classic') {
  const th = THEMES[themeKey] || THEMES.meadow, R = spec.rows.length, C = spec.rows[0].length / 2, m = cellPx * 0.18;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 10); ctx.fill();
  const fg = ctx.createLinearGradient(x, y, x + w, y + h); fg.addColorStop(0, th.frame[0]); fg.addColorStop(1, th.frame[2]);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  const gx = x + m, gy = y + m;
  const tok = (r, c) => spec.rows[r].substr(c * 2, 2);
  const under = (r, c) => (spec.under && spec.under[r] ? spec.under[r].substr(c * 2, 2) : null);
  const terrain = (r, c) => { const t = tok(r, c), isPiece = 'RBrb'.includes(t[0]) && t[1] >= '1' && t[1] <= '8'; if (!isPiece) return t; return t[0] === 'r' || t[0] === 'b' ? '~~' : (under(r, c) || '..'); };
  ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, C * cellPx, R * cellPx); ctx.clip();
  const gg = ctx.createLinearGradient(gx, gy, gx + C * cellPx, gy + R * cellPx); gg.addColorStop(0, th.grass[0]); gg.addColorStop(1, th.grass[2]); ctx.fillStyle = gg; ctx.fillRect(gx, gy, C * cellPx, R * cellPx);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const t = terrain(r, c), cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx, k = cellPx / 100;
    if (t === '~~') { const wg = ctx.createLinearGradient(0, cy - cellPx / 2, 0, cy + cellPx / 2); wg.addColorStop(0, th.water[0]); wg.addColorStop(1, th.water[2]); ctx.fillStyle = wg; ctx.fillRect(cx - cellPx / 2, cy - cellPx / 2, cellPx, cellPx); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - cellPx * 0.3, cy); ctx.quadraticCurveTo(cx - cellPx * 0.15, cy - cellPx * 0.08, cx, cy); ctx.quadraticCurveTo(cx + cellPx * 0.15, cy + cellPx * 0.08, cx + cellPx * 0.3, cy); ctx.stroke(); }
    else if (t === 'TR' || t === 'TB') { ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); paintTrap(ctx, 0, 0, t === 'TR' ? 1 : 2); ctx.restore(); }
    else if (t === 'DR' || t === 'DB') { ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); paintDen(ctx, 0, 0, t === 'DR' ? 1 : 2); ctx.restore(); }
  }
  ctx.restore();
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,120,0.5)'; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); });
  ctx.strokeStyle = th.line; ctx.lineWidth = Math.max(1, cellPx * 0.025); ctx.beginPath();
  for (let i = 0; i <= R; i++) { ctx.moveTo(gx, gy + i * cellPx); ctx.lineTo(gx + C * cellPx, gy + i * cellPx); }
  for (let j = 0; j <= C; j++) { ctx.moveTo(gx + j * cellPx, gy); ctx.lineTo(gx + j * cellPx, gy + R * cellPx); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, C * cellPx, R * cellPx);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const t = tok(r, c), ch = t[0];
    if ('RBrb'.includes(ch) && t[1] >= '1' && t[1] <= '8') {
      const side = ch === 'R' || ch === 'r' ? 1 : 2, dim = spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c);
      drawPiece(ctx, side, +t[1], style, gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx, { alpha: dim ? 0.35 : 1, swim: ch === 'r' || ch === 'b' });
    }
  }
  for (const [r, c, kind] of spec.marks || []) {
    const cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx;
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#e02a1f'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.42, 0, TAU); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.14, 0, TAU); ctx.fill(); }
    else if (kind === 'target') { ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.44, 0, TAU); ctx.stroke(); }
  }
  for (const a of spec.arrows || []) {
    const [r0, c0, r1, c1] = a, x0 = gx + (c0 + 0.5) * cellPx, y0 = gy + (r0 + 0.5) * cellPx, x1 = gx + (c1 + 0.5) * cellPx, y1 = gy + (r1 + 0.5) * cellPx, ang = Math.atan2(y1 - y0, x1 - x0), hd = cellPx * 0.22;
    ctx.strokeStyle = 'rgba(255,240,120,0.95)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cellPx * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + Math.cos(ang) * cellPx * 0.4, y0 + Math.sin(ang) * cellPx * 0.4); ctx.lineTo(x1 - Math.cos(ang) * hd, y1 - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.45) * hd * 1.4, y1 - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(x1 - Math.cos(ang + 0.45) * hd * 1.4, y1 - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: (spec.rows[0].length / 2) * cellPx + cellPx * 0.36, h: spec.rows.length * cellPx + cellPx * 0.36 });
export { ANIMALS, WATER };
