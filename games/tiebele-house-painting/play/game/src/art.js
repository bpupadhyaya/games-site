// Everything that is drawn with shapes and no text layout: the mud-wall backdrop, the plaster panel and its painted cells, the pigment pots,
// symmetry marks, particles, the title hero and the little diagrams of the Rules pages. All of it is a pure function of its arguments.
import { PIGMENTS, buildWall, partnerOf } from './sim.js';
import { roundPath, FONT, NUM } from './ui.js';
import { v3 } from './v3.js';

export const TAU = Math.PI * 2;
export const hash2 = (a, b, c = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const MUD = { base: '#c98d5a', light: '#e2b07c', dark: '#8f5530', deep: '#5e3318' };
export const PLASTER = { base: '#dca872', light: '#f0c898', dark: '#b27744' };
const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
};

// ---- backdrop: a sun-baked clay wall with plaster grain; `mood` 0 dry, 1 rain, 2 clearing sun --------------------------------------
export function drawBackdrop(ctx, w, h, t, mood = 0, rainT = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7a3f24'); g.addColorStop(0.55, '#6a361e'); g.addColorStop(1, '#4d2614');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // trowel marks and grain: a fixed set of speckles that depend only on the index
  const n = Math.min(320, Math.round((w * h) / 2600));
  for (let i = 0; i < n; i++) {
    const x = hash2(i, 1) * w, y = hash2(i, 2) * h, s = 1.5 + hash2(i, 3) * 4, a = 0.05 + hash2(i, 4) * 0.12;
    ctx.fillStyle = hash2(i, 5) > 0.5 ? `rgba(255,214,160,${a})` : `rgba(20,8,2,${a * 1.4})`;
    ctx.fillRect(x, y, s * (1 + hash2(i, 6) * 3), s);
  }
  // soft bands of lighter plaster across the wall
  for (let k = 0; k < 4; k++) { const y = (0.12 + k * 0.27) * h + Math.sin(k * 2.1) * 12; ctx.fillStyle = 'rgba(255,200,140,0.035)'; ctx.fillRect(0, y, w, 38 + k * 9); }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,3,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  if (mood === 1) {
    ctx.fillStyle = 'rgba(30,38,58,0.38)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(190,210,235,0.35)'; ctx.lineWidth = 2;
    const m = Math.min(70, Math.round(w / 12));
    ctx.beginPath();
    for (let i = 0; i < m; i++) {
      const x = hash2(i, 9) * (w + 80) - 40, sp = 700 + hash2(i, 10) * 500, y = ((rainT * sp + hash2(i, 11) * h) % (h + 120)) - 60;
      ctx.moveTo(x, y); ctx.lineTo(x - 9, y + 34);
    }
    ctx.stroke();
  } else if (mood === 2) {
    const sg = ctx.createRadialGradient(w * 0.82, h * 0.06, 8, w * 0.82, h * 0.06, Math.max(w, h) * 0.7);
    sg.addColorStop(0, 'rgba(255,236,170,0.45)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  }
}

// ---- the plaster panel -----------------------------------------------------------------------------------------------------------------
export function drawPanel(ctx, fr, o = {}) {
  if (o.three && v3.on) return;
  const { x, y, w, h } = fr;
  ctx.save();
  roundPath(ctx, x - 6, y + 8, w + 12, h + 12, 20); ctx.fillStyle = 'rgba(15,5,0,0.45)'; ctx.fill();
  roundPath(ctx, x - 10, y - 10, w + 20, h + 20, 20); ctx.fillStyle = MUD.dark; ctx.fill();            // thick raised edge
  roundPath(ctx, x - 10, y - 10, w + 20, h + 20, 20); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,160,0.35)'; ctx.stroke();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, o.wet ? '#c58f60' : PLASTER.light); g.addColorStop(1, o.wet ? '#a0693f' : PLASTER.base);
  roundPath(ctx, x, y, w, h, 12); ctx.fillStyle = g; ctx.fill();
  // plaster grain, fixed by the panel size
  ctx.save(); roundPath(ctx, x, y, w, h, 12); ctx.clip();
  const n = Math.min(200, Math.round((w * h) / 1500));
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = hash2(i, 21) > 0.5 ? 'rgba(255,240,210,0.16)' : 'rgba(110,60,20,0.14)';
    ctx.fillRect(x + hash2(i, 22) * w, y + hash2(i, 23) * h, 1.5 + hash2(i, 24) * 4, 1.5 + hash2(i, 25) * 1.5);
  }
  ctx.restore();
  roundPath(ctx, x, y, w, h, 12); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(80,38,12,0.55)'; ctx.stroke();
  ctx.restore();
}

// ---- one painted cell ------------------------------------------------------------------------------------------------------------------
export function paintedCell(ctx, x, y, s, color, i, o = {}) {
  const pg = PIGMENTS[color];
  if (!pg) return;
  const m = s * 0.055, j = (hash2(i, 7) - 0.5) * s * 0.035, r = s * 0.1;
  const px = x + m + j, py = y + m, pw = s - m * 2 - j * 0.5, ph = s - m * 2;
  ctx.save();
  // a soft drop shadow gives the paint a raised, plastered look
  roundPath(ctx, px + 1.5, py + 2.2, pw, ph, r); ctx.fillStyle = 'rgba(40,16,4,0.35)'; ctx.fill();
  roundPath(ctx, px, py, pw, ph, r); ctx.fillStyle = pg.hex; ctx.fill();
  // lit top-left and shaded bottom-right edges
  ctx.lineWidth = Math.max(1.2, s * 0.03); ctx.lineCap = 'round';
  ctx.strokeStyle = color === 1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,235,205,0.22)';
  ctx.beginPath(); ctx.moveTo(px + r, py + 1); ctx.lineTo(px + pw - r, py + 1); ctx.moveTo(px + 1, py + r); ctx.lineTo(px + 1, py + ph - r); ctx.stroke();
  ctx.strokeStyle = pg.edge; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(px + r, py + ph - 1); ctx.lineTo(px + pw - r, py + ph - 1); ctx.moveTo(px + pw - 1, py + r); ctx.lineTo(px + pw - 1, py + ph - r); ctx.stroke();
  ctx.globalAlpha = 1;
  if (o.glaze) { roundPath(ctx, px, py, pw, ph, r); ctx.fillStyle = 'rgba(255,240,170,0.22)'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,226,120,0.95)'; ctx.stroke(); }
  if (o.wet) { roundPath(ctx, px, py, pw, ph, r); ctx.fillStyle = 'rgba(150,185,230,0.20)'; ctx.fill(); }
  ctx.restore();
}

// ---- the grid with everything on it --------------------------------------------------------------------------------------------------------
// o: { cells, glaze:Set|array, guide:boolean, wrong:Set (verdict), hintIdx:[], hintColor, wash:[{i,t}] }
export function drawWall(ctx, wall, g, cells, o = {}) {
  const { cs, ox, oy } = g, { W, H } = wall;
  if (o.three && v3.on) {
    // the 3D presenter paints this wall (view3d/wall.js): report what it needs, draw nothing flat
    v3.wallRect = { x: ox, y: oy, cs, W, H };
    v3.wallView = { wall, cells, glaze: o.glaze, guide: o.guide, hintIdx: o.hintIdx, hintColor: o.hintColor, wrong: o.wrong, cursor: o.cursor || null };
    return;
  }
  // recessed grid hint on bare plaster
  ctx.save();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(110,60,20,0.16)';
  ctx.beginPath();
  for (let x = 1; x < W; x++) { ctx.moveTo(ox + x * cs, oy + 3); ctx.lineTo(ox + x * cs, oy + H * cs - 3); }
  for (let y = 1; y < H; y++) { ctx.moveTo(ox + 3, oy + y * cs); ctx.lineTo(ox + W * cs - 3, oy + y * cs); }
  ctx.stroke();
  // the elder's cells sit on a slightly lighter, smoother patch
  ctx.fillStyle = 'rgba(255,248,225,0.2)';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (wall.elder[y * W + x]) ctx.fillRect(ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2);
  ctx.restore();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = cells[i];
    if (c) paintedCell(ctx, ox + x * cs, oy + y * cs, cs, c, i, { glaze: o.glaze && o.glaze[i], wet: o.wet });
    else if (o.guide && !wall.elder[i] && wall.target[i] > 0) {
      const pg = PIGMENTS[wall.target[i]];
      ctx.beginPath(); ctx.arc(ox + (x + 0.5) * cs, oy + (y + 0.5) * cs, cs * 0.13, 0, TAU);
      ctx.fillStyle = pg.hex; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1.4; ctx.strokeStyle = pg.edge; ctx.stroke();
    }
  }
  if (o.hintIdx && o.hintIdx.length) {
    const pulse = 0.6 + 0.4 * Math.sin((o.t || 0) * 6);
    ctx.save();
    for (const i of o.hintIdx) {
      const x = i % W, y = Math.floor(i / W);
      roundPath(ctx, ox + x * cs + 2, oy + y * cs + 2, cs - 4, cs - 4, cs * 0.12);
      ctx.fillStyle = o.hintColor ? PIGMENTS[o.hintColor].hex : 'rgba(255,255,255,0.4)'; ctx.globalAlpha = 0.45 + 0.25 * pulse; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,236,150,${0.6 + 0.4 * pulse})`; ctx.stroke();
    }
    ctx.restore();
  }
  if (o.wrong) {
    ctx.save();
    for (const i of o.wrong) {
      const x = i % W, y = Math.floor(i / W), cx = ox + (x + 0.5) * cs, cy = oy + (y + 0.5) * cs, d = cs * 0.3;
      ctx.lineWidth = Math.max(3, cs * 0.08); ctx.lineCap = 'round'; ctx.strokeStyle = '#ff5a3c';
      ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
      if (wall.target[i] > 0) { ctx.beginPath(); ctx.arc(cx, cy, cs * 0.42, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = PIGMENTS[wall.target[i]].hex; ctx.stroke(); }
    }
    ctx.restore();
  }
  if (o.marks !== false) drawSymmetryMarks(ctx, wall, g);
}

// The mark of the wall's symmetry on the panel: dashed middle lines, a turn symbol, band borders or the diagonal.
export function drawSymmetryMarks(ctx, wall, g) {
  const { cs, ox, oy } = g, { W, H, kind, p } = wall, gw = W * cs, gh = H * cs;
  ctx.save();
  ctx.setLineDash([cs * 0.28, cs * 0.18]); ctx.lineWidth = Math.max(2, cs * 0.045); ctx.strokeStyle = 'rgba(70,24,6,0.7)'; ctx.lineCap = 'round';
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  if (kind === 'mirrorV' || kind === 'quad') line(ox + gw / 2, oy - 6, ox + gw / 2, oy + gh + 6);
  if (kind === 'mirrorH' || kind === 'quad') line(ox - 6, oy + gh / 2, ox + gw + 6, oy + gh / 2);
  if (kind === 'diag') line(ox, oy, ox + gw, oy + gh);
  if (kind === 'repeat' || kind === 'glide') for (let x = p; x < W; x += p) line(ox + x * cs, oy - 6, ox + x * cs, oy + gh + 6);
  ctx.setLineDash([]);
  if (kind === 'rot2' || kind === 'rot4') {
    const cx = ox + gw / 2, cy = oy + gh / 2, r = cs * 0.42;
    ctx.fillStyle = 'rgba(70,24,6,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f6e6c4'; ctx.lineWidth = Math.max(2, cs * 0.05);
    const arcs = kind === 'rot2' ? 2 : 4;
    for (let k = 0; k < arcs; k++) {
      const a0 = (k / arcs) * TAU + 0.25, a1 = a0 + TAU / arcs - 0.65;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, a0, a1); ctx.stroke();
      const ex = cx + Math.cos(a1) * r * 0.58, ey = cy + Math.sin(a1) * r * 0.58, tx = -Math.sin(a1), ty = Math.cos(a1), s = r * 0.26;
      ctx.beginPath(); ctx.moveTo(ex + tx * s, ey + ty * s); ctx.lineTo(ex - ty * s * 0.7 - tx * s * 0.1, ey + tx * s * 0.7 - ty * s * 0.1); ctx.lineTo(ex + ty * s * 0.7 - tx * s * 0.1, ey - tx * s * 0.7 - ty * s * 0.1); ctx.closePath(); ctx.fillStyle = '#f6e6c4'; ctx.fill();
    }
  }
  if (kind === 'glide') {
    ctx.fillStyle = 'rgba(70,24,6,0.85)';
    for (let x = p; x < W; x += p) { const cx = ox + x * cs, cy = oy + gh + 0; ctx.beginPath(); ctx.arc(cx, cy, cs * 0.17, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ---- pots, cloth, undo -------------------------------------------------------------------------------------------------------------------
export function drawJar(ctx, cx, cy, s, pg, fill, o = {}) {
  // a squat clay pot seen from the front: body, neck and rim, with the paint showing at the rim and a level on the body
  ctx.save();
  ctx.translate(cx, cy);
  const bw = s * 0.46, bh = s * 0.4;
  ctx.globalAlpha = o.dim ? 0.45 : 1;
  ctx.fillStyle = 'rgba(15,5,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, bh * 0.92, bw * 1.0, s * 0.06, 0, 0, TAU); ctx.fill();
  const body = ctx.createLinearGradient(-bw, 0, bw, 0);
  body.addColorStop(0, '#6f3419'); body.addColorStop(0.35, '#b8683a'); body.addColorStop(0.6, '#a25a30'); body.addColorStop(1, '#5a2912');
  ctx.beginPath(); ctx.moveTo(-bw * 0.42, -bh * 0.55);
  ctx.bezierCurveTo(-bw * 1.2, -bh * 0.35, -bw * 1.15, bh * 0.85, -bw * 0.55, bh * 0.92);
  ctx.lineTo(bw * 0.55, bh * 0.92); ctx.bezierCurveTo(bw * 1.15, bh * 0.85, bw * 1.2, -bh * 0.35, bw * 0.42, -bh * 0.55); ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  // geometric band on the pot
  ctx.fillStyle = 'rgba(245,232,205,0.8)';
  const by = bh * 0.1, tw = bw * 0.26;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * tw - tw * 0.5, by + tw * 0.5); ctx.lineTo(k * tw, by - tw * 0.5); ctx.lineTo(k * tw + tw * 0.5, by + tw * 0.5); ctx.closePath(); ctx.fill(); }
  // rim and the paint surface
  ctx.fillStyle = '#7a3a1b'; ctx.beginPath(); ctx.ellipse(0, -bh * 0.55, bw * 0.5, bh * 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = pg.hex; ctx.beginPath(); ctx.ellipse(0, -bh * 0.55, bw * 0.4, bh * 0.13, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = pg.edge; ctx.stroke();
  // level gauge beside the pot
  const gx = bw * 1.28, gh = bh * 1.5;
  roundPath(ctx, gx, -bh * 0.6, 8, gh, 4); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const f = Math.max(0, Math.min(1, fill));
  if (f > 0) { roundPath(ctx, gx, -bh * 0.6 + gh * (1 - f), 8, gh * f, 4); ctx.fillStyle = pg.hex; ctx.fill(); }
  ctx.restore();
}
export function drawClothIcon(ctx, cx, cy, s, active) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = active ? '#fff2cc' : '#e7d9b7';
  ctx.beginPath(); ctx.moveTo(-s * 0.34, -s * 0.2); ctx.quadraticCurveTo(0, -s * 0.34, s * 0.34, -s * 0.2); ctx.lineTo(s * 0.3, s * 0.22); ctx.quadraticCurveTo(0, s * 0.34, -s * 0.3, s * 0.22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(110,70,30,0.55)'; ctx.lineWidth = 2;
  for (const k of [-0.1, 0.05, 0.2]) { ctx.beginPath(); ctx.moveTo(-s * 0.26, s * k); ctx.quadraticCurveTo(0, s * (k - 0.07), s * 0.26, s * k); ctx.stroke(); }
  ctx.restore();
}
export function drawUndoIcon(ctx, cx, cy, s, disabled) {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = disabled ? 'rgba(255,255,255,0.35)' : '#fbefd2'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.24, -2.9, 1.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s * 0.36, -s * 0.12); ctx.lineTo(-s * 0.1, -s * 0.28); ctx.lineTo(-s * 0.08, 0.0); ctx.closePath(); ctx.fill();
  ctx.restore();
}
export function drawBrushTip(ctx, x, y, color, s) {
  const pg = PIGMENTS[color];
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, s, 0, TAU);
  ctx.fillStyle = pg ? pg.hex : '#f2e3bd'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  ctx.restore();
}

// ---- particles -------------------------------------------------------------------------------------------------------------------------
// kinds: dust (paint dust), splash (rain on the wall), spark (glaze), flake (washed paint), mist
export function emit(fx, kind, x, y, n, rnd, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = (o.speed ?? 80) * (0.3 + rnd() * 0.9);
    fx.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0) * rnd(), t: 0, life: (o.life ?? 0.8) * (0.6 + rnd() * 0.6), size: (o.size ?? 5) * (0.6 + rnd() * 0.8), col: o.cols ? o.cols[Math.floor(rnd() * o.cols.length)] : '#fff', g: o.g ?? 260 });
  }
  if (fx.length > 260) fx.splice(0, fx.length - 260);
}
export function stepFx(fx, dt) {
  for (const p of fx) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - Math.min(1, dt * 1.4); }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t >= fx[i].life) fx.splice(i, 1);
}
export function drawFx(ctx, fx) {
  for (const p of fx) {
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
    ctx.fillStyle = p.col;
    if (p.kind === 'spark') { ctx.beginPath(); ctx.moveTo(p.x, p.y - p.size); ctx.lineTo(p.x + p.size * 0.35, p.y); ctx.lineTo(p.x, p.y + p.size); ctx.lineTo(p.x - p.size * 0.35, p.y); ctx.closePath(); ctx.fill(); }
    else if (p.kind === 'splash') { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.6, p.size, 0, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// ---- wordmark and the title hero ---------------------------------------------------------------------------------------------------------
export function wordmark(ctx, text, x, y, size, maxW) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  let s = size;
  ctx.font = `900 ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > 18) { s -= 2; ctx.font = `900 ${s}px ${FONT}`; }
  ctx.lineWidth = s * 0.2; ctx.strokeStyle = '#1c0e06'; ctx.strokeText(text, x, y + s * 0.05);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4; ctx.fillStyle = '#1c0e06'; ctx.fillText(text, x, y + s * 0.05); ctx.restore();
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fff8e4'); g.addColorStop(0.55, '#f2e3bd'); g.addColorStop(1, '#d9b982');
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.restore();
  return s;
}

// A row of painted triangles in the tradition's black, white and red-earth.
export function triangleBand(ctx, x, y, w, h, n = 14) {
  const tw = w / n;
  ctx.save();
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = k % 3 === 0 ? PIGMENTS[3].hex : k % 3 === 1 ? PIGMENTS[1].hex : PIGMENTS[2].hex;
    ctx.beginPath(); ctx.moveTo(x + k * tw, y + h); ctx.lineTo(x + (k + 0.5) * tw, y); ctx.lineTo(x + (k + 1) * tw, y + h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// A painted band drawn from real shapes: triangle rows, nested diamonds and a zigzag, in black, white and red earth.
function bandArt(ctx, x, y, w, h) {
  const P = PIGMENTS, tri = (cx, by, tw, th, up, col) => { ctx.fillStyle = col; ctx.beginPath(); if (up) { ctx.moveTo(cx - tw / 2, by + th); ctx.lineTo(cx, by); ctx.lineTo(cx + tw / 2, by + th); } else { ctx.moveTo(cx - tw / 2, by); ctx.lineTo(cx + tw / 2, by); ctx.lineTo(cx, by + th); } ctx.closePath(); ctx.fill(); };
  const th = h * 0.2, n = Math.max(6, Math.round(w / (th * 1.15))), tw = w / n;
  ctx.save();
  roundPath(ctx, x, y, w, h, 10); ctx.fillStyle = PLASTER.base; ctx.fill(); ctx.clip();
  // top and bottom triangle rows (point-to-point so the white ones are the gaps of the black ones)
  for (let k = 0; k < n; k++) { tri(x + (k + 0.5) * tw, y + 4, tw, th, true, P[2].hex); tri(x + (k + 0.5) * tw, y + 4 + th * 0.0, tw, th, false, 'rgba(0,0,0,0)'); }
  for (let k = 0; k < n; k++) { tri(x + k * tw, y + 4, tw, th, false, P[1].hex); }
  for (let k = 0; k < n; k++) { tri(x + (k + 0.5) * tw, y + h - th - 4, tw, th, false, P[2].hex); tri(x + k * tw, y + h - th - 4, tw, th, true, P[1].hex); }
  ctx.fillStyle = P[3].hex; ctx.fillRect(x, y + th + 7, w, 5); ctx.fillRect(x, y + h - th - 12, w, 5);
  // the middle: nested diamonds with a zigzag between them
  const my = y + th + 12, mh = h - 2 * th - 24, d = Math.min(mh, w / 5), m = Math.max(2, Math.floor(w / (d * 1.1))), step = w / m;
  for (let k = 0; k < m; k++) {
    const cx = x + (k + 0.5) * step, cy = my + mh / 2, r = d / 2;
    const rh = (rr, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy - rr); ctx.lineTo(cx + rr, cy); ctx.lineTo(cx, cy + rr); ctx.lineTo(cx - rr, cy); ctx.closePath(); ctx.fill(); };
    rh(r, P[2].hex); rh(r * 0.74, P[1].hex); rh(r * 0.5, P[3].hex); rh(r * 0.24, P[2].hex);
    if (k < m - 1) { ctx.strokeStyle = P[2].hex; ctx.lineWidth = Math.max(3, d * 0.07); ctx.lineJoin = 'miter'; ctx.beginPath(); ctx.moveTo(cx + r + 3, cy - r * 0.4); ctx.lineTo(cx + step / 2, cy + r * 0.4); ctx.lineTo(cx + step - r - 3, cy - r * 0.4); ctx.stroke(); }
  }
  ctx.restore();
}

export function drawHero(ctx, w, h, t) {
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#f2b878'); sky.addColorStop(1, '#f7d9a0');
  roundPath(ctx, 0, 0, w, h, 26); ctx.fillStyle = sky; ctx.fill();
  ctx.clip();
  const sunR = Math.min(w, h) * 0.17, sx = w * 0.84, sy = h * 0.22 + Math.sin(t * 0.5) * 2;
  const sg = ctx.createRadialGradient(sx, sy, sunR * 0.2, sx, sy, sunR * 2.4);
  sg.addColorStop(0, 'rgba(255,248,210,1)'); sg.addColorStop(0.35, 'rgba(255,230,160,0.7)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(sx, sy, sunR * 0.55, 0, TAU); ctx.fill();
  // the house: a flat roof with small turrets and a thick wall carrying the painted band and a low door
  const hx = w * 0.05, hw = w * 0.9, hy = h * 0.38, hh = h * 0.66;
  const wallG = ctx.createLinearGradient(0, hy, 0, hy + hh);
  wallG.addColorStop(0, '#d6935c'); wallG.addColorStop(1, '#a8683a');
  for (let k = 0; k < 4; k++) {
    const tw = hw * 0.1, tx = hx + hw * (0.06 + k * 0.28), th = h * 0.1 + (k % 2) * h * 0.04;
    ctx.fillStyle = '#c4824d'; roundPath(ctx, tx, hy - th, tw, th + 6, 8); ctx.fill();
    ctx.fillStyle = '#8f5530'; ctx.fillRect(tx, hy - th + 4, tw * 0.22, th);
  }
  ctx.fillStyle = wallG; ctx.fillRect(hx, hy, hw, hh);
  ctx.fillStyle = '#e8bf8a'; ctx.fillRect(hx - 4, hy - 7, hw + 8, 14);
  const bw = hw * 0.8, bh = Math.min(hh * 0.5, bw * 0.3), bx = hx + (hw - bw) / 2, by = hy + hh * 0.1;
  roundPath(ctx, bx - 5, by - 5, bw + 10, bh + 10, 12); ctx.fillStyle = '#7a4524'; ctx.fill();
  bandArt(ctx, bx, by, bw, bh);
  ctx.fillStyle = '#9b5d33'; ctx.fillRect(0, h - 10, w, 12);
  ctx.restore();
}

// ---- diagrams for the reader ----------------------------------------------------------------------------------------------------------------
const DIAG = {
  mirrorV: { kind: 'mirrorV', W: 6, H: 3, colors: [2, 1], given: 0, slack: 0, seed: 11 },
  mirrorH: { kind: 'mirrorH', W: 4, H: 4, colors: [2, 1], given: 0, slack: 0, seed: 21 },
  quad: { kind: 'quad', W: 6, H: 4, colors: [2, 1], given: 0, slack: 0, seed: 31 },
  rot2: { kind: 'rot2', W: 6, H: 3, colors: [2, 1], given: 0, slack: 0, seed: 41 },
  rot4: { kind: 'rot4', W: 6, H: 6, colors: [2, 1], given: 0, slack: 0, seed: 51 },
  repeat: { kind: 'repeat', W: 9, H: 3, p: 3, colors: [2, 1], given: 0, slack: 0, seed: 61 },
  glide: { kind: 'glide', W: 8, H: 3, p: 4, colors: [2, 1], given: 0, slack: 0, seed: 71 },
  diag: { kind: 'diag', W: 5, H: 5, colors: [2, 1], given: 0, slack: 0, seed: 81 },
};
const DIAG_CACHE = {};
export function drawDiagram(name, ctx, w, h) {
  const cfg = DIAG[name];
  if (!cfg) { drawPotsDiagram(name, ctx, w, h); return; }
  const wall = DIAG_CACHE[name] || (DIAG_CACHE[name] = buildWall(cfg));
  const cs = Math.floor(Math.min((w - 24) / wall.W, (h - 24) / wall.H)), gw = cs * wall.W, gh = cs * wall.H, ox = (w - gw) / 2, oy = (h - gh) / 2;
  drawPanel(ctx, { x: ox, y: oy, w: gw, h: gh });
  const cells = wall.target;
  // the elder's cells are drawn bright; the copies are slightly lower in alpha to show what is copied
  ctx.save();
  drawWall(ctx, wall, { cs, ox, oy }, cells, {});
  ctx.restore();
}
function drawPotsDiagram(name, ctx, w, h) {
  const s = Math.min(w / 3.4, h);
  [1, 2, 3].forEach((c, k) => drawJar(ctx, w / 2 + (k - 1) * s * 1.1, h * 0.5, s * 0.9, PIGMENTS[c], 0.35 + k * 0.25));
}
