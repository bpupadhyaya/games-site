// Static art: the table, the board and the stones. One light, from the upper left.
// The board is painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where OffscreenCanvas does not exist
// (headless tests) the same painter draws directly. Stones are cheap shaded discs drawn every frame.
import { host, outerCells } from './layout.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ papers (board looks)
export const PAPERS = {
  hanji:   { name: 'Hanji', paper: ['#f4e6c3', '#ead6a6', '#dcc189'], fibre: [130, 96, 52], ink: '#2a1c12', frame: ['#6a2f22', '#4a1f16', '#2f130d'], edge: ['#3a1810', '#1d0a06'], band: 0.2 },
  indigo:  { name: 'Indigo', paper: ['#35508a', '#2a4274', '#1f3360'], fibre: [190, 210, 255], ink: '#dfe8ff', frame: ['#2b2c3f', '#1c1d2e', '#11121e'], edge: ['#15162a', '#080913'], band: 0.28 },
  celadon: { name: 'Celadon', paper: ['#cfe3d2', '#b8d3bd', '#a1c1a8'], fibre: [60, 100, 70], ink: '#1d3326', frame: ['#7a5a34', '#5b3f20', '#3f2a12'], edge: ['#43301a', '#201407'], band: 0.2 },
};
// Sprites of the 3D stone models, rendered once by the 3D presenter (view3d/presenter.js). Null until then / when WebGL is unavailable.
export const sprites = { ready: false, stone: {} };
export const PAPER_KEYS = ['hanji', 'indigo', 'celadon'];

// The two stone colours. Jade is pale and cool, Ember is deep and warm, so they differ in lightness as well as hue.
export const STONES = {
  1: { rim: '#2c6b58', light: '#e6fff4', mid: '#8fd7bb', dark: '#3f9279', side: '#1f5744', mark: 'rgba(24,84,66,0.55)', glow: [120, 255, 200] },
  2: { rim: '#6a1c0c', light: '#ffc79c', mid: '#e8663a', dark: '#a92f14', side: '#541308', mark: 'rgba(70,12,0,0.5)', glow: [255, 170, 100] },
};

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#12353a'); bg.addColorStop(0.5, '#0c2327'); bg.addColorStop(1, '#06141a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a soft pool of lamp light on the board
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.6;
  const lamp = ctx.createRadialGradient(cx - rad * 0.1, cy - rad * 0.18, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,230,170,0.17)'); lamp.addColorStop(0.5, 'rgba(255,214,140,0.05)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // rice-paper mat pattern: faint repeated small rings, like a woven mat
  ctx.strokeStyle = 'rgba(190,255,230,0.028)'; ctx.lineWidth = 1.5;
  const step = 46; ctx.beginPath();
  for (let y = 12; y < h; y += step) for (let x = ((y / step) % 2 ? 0 : step / 2) + 12; x < w; x += step) { ctx.moveTo(x + 9, y); ctx.arc(x, y, 9, 0, TAU); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100 * outer, height 100 * outer + SLAB.
const SLAB = 20, PAPER_M = 50;
function paintBoard(ctx, N, paperKey, flip) {
  const OUT = outerCells(N), W = OUT * 100, H = W, pal = PAPERS[paperKey] || PAPERS.hanji, rnd = lcg(11 + N * 17 + paperKey.length);
  const FR = (OUT - N) * 50, gx = FR, gy = FR, G = N * 100;
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // contact shadow on the table
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 14, 10 + SLAB - 2 + 2 * k, W + 8 * k - 28 + 8, H + 4 * k, 28 + 4 * k); ctx.fill(); }
  // front of the slab (thickness) and the top face of the frame
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.16)'; ctx.fillRect(14, H + 1, W - 28, 2.5);
  const tg = ctx.createLinearGradient(0, 0, W, H); tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,225,190,0.32)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 16); ctx.stroke();
  ctx.save(); rr(0, 0, W, H, 18); ctx.clip();                                    // lacquer: a few long soft streaks
  for (let k = 0; k < 26; k++) { const y = rnd() * H; ctx.strokeStyle = `rgba(255,220,180,${0.015 + rnd() * 0.035})`; ctx.lineWidth = 1 + rnd() * 3; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 30, W * 0.7, y + (rnd() - 0.5) * 30, W, y + (rnd() - 0.5) * 20); ctx.stroke(); }
  ctx.restore();
  // inlaid brass-coloured keyline round the paper
  const px0 = gx - PAPER_M, py0 = gy - PAPER_M, pw = G + 2 * PAPER_M;
  ctx.strokeStyle = 'rgba(236,196,120,0.7)'; ctx.lineWidth = 3; rr(px0 - 7, py0 - 7, pw + 14, pw + 14, 10); ctx.stroke();
  // the paper
  const pg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + pw); pg.addColorStop(0, pal.paper[0]); pg.addColorStop(0.55, pal.paper[1]); pg.addColorStop(1, pal.paper[2]);
  ctx.fillStyle = pg; rr(px0, py0, pw, pw, 6); ctx.fill();
  ctx.save(); rr(px0, py0, pw, pw, 6); ctx.clip();
  // paper fibres: many short faint strokes in random directions
  for (let k = 0; k < 520; k++) {
    const x = px0 + rnd() * pw, y = py0 + rnd() * pw, a = rnd() * TAU, l = 6 + rnd() * 26, dark = rnd() < 0.55;
    ctx.strokeStyle = dark ? `rgba(${pal.fibre[0]},${pal.fibre[1]},${pal.fibre[2]},${0.05 + rnd() * 0.09})` : `rgba(255,255,245,${0.08 + rnd() * 0.12})`; ctx.lineWidth = 0.7 + rnd() * 1.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // coloured home bands: the row each side starts on, washed into the paper like dye (the human's side is always at the bottom)
  for (const [side, top] of [[flip ? 1 : 2, true], [flip ? 2 : 1, false]]) {
    const c = STONES[side].mid, rgb = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const y0 = top ? py0 : py0 + pw, y1 = top ? py0 + 110 : py0 + pw - 110, bg = ctx.createLinearGradient(0, y0, 0, y1);
    bg.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${pal.band * 1.4})`); bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg; ctx.fillRect(px0, top ? py0 : py0 + pw - 110, pw, 110);
  }
  // inset shadow at the top and left of the paper (it sits in the frame), light on the bottom and right
  const is = ctx.createLinearGradient(0, py0, 0, py0 + 40); is.addColorStop(0, 'rgba(0,0,0,0.30)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(px0, py0, pw, 40);
  const il = ctx.createLinearGradient(px0, 0, px0 + 40, 0); il.addColorStop(0, 'rgba(0,0,0,0.24)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(px0, py0, 40, pw);
  ctx.restore();
  // brush-drawn lines: slightly heavier than a hairline, round ends, a touch of unevenness per stroke
  ctx.strokeStyle = pal.ink; ctx.lineCap = 'round';
  for (let i = 0; i <= N; i++) {
    for (const horiz of [true, false]) {
      const a = (rnd() - 0.5) * 2.2, w0 = i === 0 || i === N ? 6.5 : 4.4;
      ctx.lineWidth = w0; ctx.globalAlpha = i === 0 || i === N ? 0.95 : 0.86; ctx.beginPath();
      if (horiz) { ctx.moveTo(gx, gy + i * 100); ctx.quadraticCurveTo(gx + G / 2, gy + i * 100 + a, gx + G, gy + i * 100); }
      else { ctx.moveTo(gx + i * 100, gy); ctx.quadraticCurveTo(gx + i * 100 + a, gy + G / 2, gx + i * 100, gy + G); }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // a small ink dot on every crossing; the middle crossing of the big boards gets a larger seal-like mark
  ctx.fillStyle = pal.ink;
  for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) { ctx.beginPath(); ctx.arc(gx + c * 100, gy + r * 100, 8, 0, TAU); ctx.fill(); }
  // coordinates on the frame, a..g along the bottom and 1..n up the left side
  ctx.fillStyle = 'rgba(255,232,196,0.62)'; ctx.font = '600 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= N; i++) { ctx.fillText('abcdefg'[flip ? N - i : i], gx + i * 100, H - (FR - PAPER_M) / 2 - 2); ctx.fillText(String(flip ? i + 1 : N + 1 - i), (FR - PAPER_M) / 2 + 1, gy + i * 100); }
  ctx.textBaseline = 'alphabetic';
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,245,215,0.14)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 18); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, paper = 'hanji') {
  const N = b.N, OUT = outerCells(N), k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64);
  const flip = !!b.flip, key = paper + '|' + N + '|' + wpx + '|' + (flip ? 1 : 0);
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, N, paper, flip); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, N, paper, flip);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ stones
// A flat river stone: a rounded disc with a visible rim thickness. (x, y) is where it stands on the board; `cell` is the point spacing.
// o: lift (0..1.5 cells up, with a drifting shadow), glow (0..1), alpha, scale, flash (white), tilt (radians, only used for flying-off stones)
export function drawStone(ctx, side, x, y, cell, o = {}) {
  const st = STONES[side] || STONES[1], lift = o.lift || 0, sc = (o.scale || 1) * cell * 0.4, th = sc * 0.3;
  const lx = x, ly = y - lift * cell * 0.5;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  // shadow on the board (grows and softens as the stone rises)
  const sh = 1 + lift * 0.5;
  ctx.fillStyle = `rgba(20,8,0,${0.32 - lift * 0.1})`; ctx.beginPath(); ctx.ellipse(x + sc * 0.12 + lift * cell * 0.08, y + sc * 0.2 + th * 0.4, sc * 0.98 * sh, sc * 0.62 * sh, 0, 0, TAU); ctx.fill();
  if (o.glow) {
    const g = st.glow, rg = ctx.createRadialGradient(lx, ly, sc * 0.5, lx, ly, sc * 2.1);
    rg.addColorStop(0, `rgba(${g[0]},${g[1]},${g[2]},${(sprites.ready ? 0.3 : 0.55) * o.glow})`); rg.addColorStop(0.5, `rgba(${g[0]},${g[1]},${g[2]},${(sprites.ready ? 0.08 : 0.2) * o.glow})`); rg.addColorStop(1, `rgba(${g[0]},${g[1]},${g[2]},0)`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(lx, ly, sc * 2.1, 0, TAU); ctx.fill();
  }
  if (o.tilt) { ctx.translate(lx, ly); ctx.rotate(o.tilt); ctx.translate(-lx, -ly); }
  const spr = sprites.ready ? sprites.stone[side] : null;
  if (spr) {                                                       // the 3D model, rendered once (plates, trays, diagrams)
    const S = sc * 2.62;
    ctx.drawImage(spr, lx - S / 2, ly + th * 0.35 - S / 2, S, S);
    if (o.flash) { ctx.globalAlpha = (o.alpha ?? 1) * clamp(o.flash, 0, 1) * 0.8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(lx, ly, sc * 0.95, sc * 0.77, 0, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  // side wall: the disc seen a little from above is an ellipse; the wall is the same ellipse shifted down
  ctx.fillStyle = st.side; ctx.beginPath(); ctx.ellipse(lx, ly + th, sc, sc * 0.82, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = st.rim; ctx.beginPath(); ctx.ellipse(lx, ly + th * 0.5, sc, sc * 0.82, 0, 0, TAU); ctx.fill();
  // the top face: a radial gradient lit from the upper left
  const tg = ctx.createRadialGradient(lx - sc * 0.35, ly - sc * 0.4, sc * 0.08, lx, ly, sc * 1.05);
  tg.addColorStop(0, st.light); tg.addColorStop(0.45, st.mid); tg.addColorStop(1, st.dark);
  ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(lx, ly, sc * 0.95, sc * 0.77, 0, 0, TAU); ctx.fill();
  // engraved mark: a ring on jade, a diamond on ember (so the two read apart without colour)
  ctx.strokeStyle = st.mark; ctx.lineWidth = Math.max(1.2, sc * 0.1); ctx.lineJoin = 'round';
  if (side === 1) { ctx.beginPath(); ctx.ellipse(lx, ly, sc * 0.42, sc * 0.33, 0, 0, TAU); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(lx, ly - sc * 0.4); ctx.lineTo(lx + sc * 0.46, ly); ctx.lineTo(lx, ly + sc * 0.4); ctx.lineTo(lx - sc * 0.46, ly); ctx.closePath(); ctx.stroke(); }
  // specular
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(lx - sc * 0.38, ly - sc * 0.36, sc * 0.2, sc * 0.1, -0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(lx, ly, sc * 0.93, sc * 0.75, 0, Math.PI * 0.95, Math.PI * 1.6); ctx.stroke();
  if (o.flash) { ctx.globalAlpha = (o.alpha ?? 1) * clamp(o.flash, 0, 1); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(lx, ly, sc * 0.95, sc * 0.77, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ diagrams for the Rules and lessons
// spec: { rows: ['.E.', '.J.', ...], cell, arrows: [[r1, c1, r2, c2, 'step'|'jump'], ...], ring: [[r, c], ...], cross: [[r, c], ...] }
// 'J' = a Jade stone, 'E' = an Ember stone, 'j'/'e' = a stone drawn faint (where it was), '.' = an empty point.
export function diagramSize(spec, cp) {
  const R = spec.rows.length, C = spec.rows[0].length;
  return { w: (C - 1) * cp + cp * 1.5, h: (R - 1) * cp + cp * 1.5 };
}
export function drawDiagram(ctx, spec, x0, y0, cp, paper = 'hanji') {
  const pal = PAPERS[paper] || PAPERS.hanji, R = spec.rows.length, C = spec.rows[0].length, s = diagramSize(spec, cp), m = cp * 0.75;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x0 + 3, y0 + 6, s.w, s.h, cp * 0.2); ctx.fill();
  const pg = ctx.createLinearGradient(x0, y0, x0 + s.w, y0 + s.h); pg.addColorStop(0, pal.paper[0]); pg.addColorStop(1, pal.paper[2]);
  ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(x0, y0, s.w, s.h, cp * 0.2); ctx.fill();
  ctx.strokeStyle = 'rgba(236,196,120,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  const at = (r, c) => ({ x: x0 + m + c * cp, y: y0 + m + r * cp });
  ctx.strokeStyle = pal.ink; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(1.6, cp * 0.05); ctx.lineCap = 'round'; ctx.beginPath();
  for (let r = 0; r < R; r++) { const a = at(r, 0), b = at(r, C - 1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  for (let c = 0; c < C; c++) { const a = at(0, c), b = at(R - 1, c); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = pal.ink;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const p = at(r, c); ctx.beginPath(); ctx.arc(p.x, p.y, cp * 0.07, 0, TAU); ctx.fill(); }
  for (const [r, c] of spec.ring || []) { const p = at(r, c); ctx.strokeStyle = '#2f9e5a'; ctx.lineWidth = cp * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cp * 0.3, 0, TAU); ctx.stroke(); }
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c]; if (ch === '.') continue;
    const p = at(r, c), side = ch.toLowerCase() === 'j' ? 1 : 2;
    drawStone(ctx, side, p.x, p.y + cp * 0.05, cp, { alpha: ch === 'j' || ch === 'e' ? 0.35 : 1 });
  }
  for (const [r, c] of spec.cross || []) {
    const p = at(r, c), d = cp * 0.26; ctx.strokeStyle = '#d6301a'; ctx.lineWidth = cp * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x - d, p.y - d); ctx.lineTo(p.x + d, p.y + d); ctx.moveTo(p.x + d, p.y - d); ctx.lineTo(p.x - d, p.y + d); ctx.stroke();
  }
  for (const [r1, c1, r2, c2, kind] of spec.arrows || []) {
    const a = at(r1, c1), b = at(r2, c2), ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.hypot(b.x - a.x, b.y - a.y), pad = cp * 0.36;
    const sx = a.x + Math.cos(ang) * pad, sy = a.y + Math.sin(ang) * pad, ex = b.x - Math.cos(ang) * pad, ey = b.y - Math.sin(ang) * pad;
    ctx.strokeStyle = kind === 'jump' ? '#d6301a' : '#1f6fd0'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = cp * 0.08; ctx.lineCap = 'round';
    ctx.beginPath();
    if (kind === 'jump') { const mx = (sx + ex) / 2 - Math.sin(ang) * cp * 0.45, my = (sy + ey) / 2 + Math.cos(ang) * cp * 0.45; ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey); void len; }
    else { ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); }
    ctx.stroke();
    const ea = kind === 'jump' ? Math.atan2(ey - ((sy + ey) / 2 + Math.cos(ang) * cp * 0.45), ex - ((sx + ex) / 2 - Math.sin(ang) * cp * 0.45)) : ang;
    ctx.beginPath(); ctx.moveTo(ex + Math.cos(ea) * cp * 0.05, ey + Math.sin(ea) * cp * 0.05); ctx.lineTo(ex - Math.cos(ea - 0.5) * cp * 0.24, ey - Math.sin(ea - 0.5) * cp * 0.24); ctx.lineTo(ex - Math.cos(ea + 0.5) * cp * 0.24, ey - Math.sin(ea + 0.5) * cp * 0.24); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
