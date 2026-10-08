// The game screen: table, players, board, stones, coach marks, lens, and the buttons around it. Reads `state`, changes nothing
// (except the hit registry in ui.js). All positions come from layoutFor(w, h) so one code path serves every phone and tablet.
import { MODES, BLACK, WHITE, nameOf } from './rules.js';
import { drawTable, drawBoard, drawStone, boardGeom, glow, WOODS, pxScale } from './art.js';
import { TEXT_SCALES, host, clamp, R } from './layout.js';
import { LEVELS } from './engine.js';
import { ui, text, para, wrap, panel, button, roundRect, COL, DISPLAY, SANS, TAU, minUnits, addHit, fitPara } from './ui.js';

const ease = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
const RING = { gold: '232,197,107', red: '224,85,74', teal: '67,198,182', blue: '106,167,232' };

// ---- the board with everything on it -----------------------------------------------------------------------------------------------
export function geomOf(L, n) { const c = L.cell(n); return { x0: c.x0, y0: c.y0, cell: c.cell, r: c.cell * 0.465 }; }
export const cellXY = (G, n, idx) => ({ x: G.x0 + (idx % n) * G.cell, y: G.y0 + ((idx / n) | 0) * G.cell });
export function cellAt(L, n, px, py, slack = 0.5) {
  const G = geomOf(L, n), gx = Math.round((px - G.x0) / G.cell), gy = Math.round((py - G.y0) / G.cell);
  if (gx < 0 || gy < 0 || gx >= n || gy >= n) { const ex = (px - G.x0) / G.cell, ey = (py - G.y0) / G.cell; if (ex < -slack || ey < -slack || ex > n - 1 + slack || ey > n - 1 + slack) return -1; return clamp(gy, 0, n - 1) * n + clamp(gx, 0, n - 1); }
  return gy * n + gx;
}

function drawMarks(ctx, state, G, n, t, phase) {
  const calm = state.set.calm, pulse = calm ? 0.6 : 0.55 + 0.45 * Math.sin(t * 4);
  const ring = (idx, col, w = 1) => { const p = cellXY(G, n, idx); ctx.save(); ctx.lineWidth = Math.max(2.5, G.cell * 0.09); ctx.strokeStyle = `rgba(${RING[col]},${(0.55 + 0.4 * pulse) * w})`; ctx.beginPath(); ctx.arc(p.x, p.y, G.r * (1.0 + 0.08 * pulse), 0, TAU); ctx.stroke(); glow(ctx, p.x, p.y, G.r * 1.7, RING[col], 0.22 * pulse * w); ctx.restore(); };
  const dot = (idx, col) => { const p = cellXY(G, n, idx); ctx.save(); ctx.fillStyle = `rgba(${RING[col]},0.85)`; ctx.beginPath(); ctx.arc(p.x, p.y, G.r * 0.28, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke(); ctx.restore(); };
  if (phase === 'under') {
    for (const f of state.forbid) {                      // red crosses engraved on forbidden points
      const p = cellXY(G, n, f.idx), s = G.r * 0.62; ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,240,215,0.35)'; ctx.lineWidth = Math.max(3, G.cell * 0.12); ctx.beginPath(); ctx.moveTo(p.x - s + 1, p.y - s + 1); ctx.lineTo(p.x + s + 1, p.y + s + 1); ctx.moveTo(p.x + s + 1, p.y - s + 1); ctx.lineTo(p.x - s + 1, p.y + s + 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,36,30,0.97)'; ctx.lineWidth = Math.max(3, G.cell * 0.14); ctx.beginPath(); ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s); ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s); ctx.stroke(); ctx.restore();
    }
    return;
  }
  const th = state.threats;
  if (state.coachMode > 0 && th && !state.game.winner && !state.autoFree) {
    const me = state.game.turn, op = 3 - me;
    for (const i of th.five[op]) ring(i, 'red');
    for (const i of th.five[me]) ring(i, 'gold');
    if (state.coachMode > 1) { for (const i of th.win[op]) dot(i, 'red'); for (const i of th.win[me]) dot(i, 'teal'); }
  }
  if (state.hint) { const p = cellXY(G, n, state.hint.idx), q = 0.6 + 0.4 * Math.sin(state.hint.t * 5); glow(ctx, p.x, p.y, G.r * 2.2, RING.teal, 0.35 + 0.2 * q); ring(state.hint.idx, 'teal'); }
}

// stones and board furniture; used by play, over and lessons
export function drawPosition(ctx, state, L, { interactive = true } = {}) {
  const g = state.game, n = g.n, P = L.play, S = P.board.w, G = geomOf(L, n), set = state.set;
  drawBoard(ctx, P.board.x, P.board.y, S, n, set.wood, set.coords);
  if (interactive) drawMarks(ctx, state, G, n, state.t, 'under');
  const stonesBlack = set.stones;
  for (let i = 0; i < g.cells.length; i++) {
    const c = g.cells[i]; if (!c) continue;
    const p = cellXY(G, n, i), a = state.anim && state.anim.idx === i ? state.anim : null;
    if (a) {
      const e = ease(a.t / a.dur);
      drawStone(ctx, c === BLACK, p.x, p.y, G.r, stonesBlack, { lift: set.calm ? 0 : (1 - e) * 1.0, alpha: clamp(a.t / (a.dur * 0.35), 0.05, 1) });
      if (!set.calm) { const rp = a.t / 0.55; if (rp < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,245,220,${0.5 * (1 - rp)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, G.r * (1 + rp * 1.2), 0, TAU); ctx.stroke(); ctx.restore(); } }
    } else drawStone(ctx, c === BLACK, p.x, p.y, G.r, stonesBlack);
  }
  // last move marker
  if (state.last >= 0 && g.cells[state.last]) { const p = cellXY(G, n, state.last), black = g.cells[state.last] === BLACK; ctx.save(); ctx.fillStyle = '#e0483c'; ctx.strokeStyle = black ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, G.r * 0.2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
  if (interactive) drawMarks(ctx, state, G, n, state.t, 'over');
  // win line
  if (g.winner && g.winner < 3 && g.line.length >= 2) {
    const a = cellXY(G, n, g.line[0]), b = cellXY(G, n, g.line[g.line.length - 1]), pulse = 0.5 + 0.5 * Math.sin(state.t * 5), k = clamp(state.winT / 0.5, 0, 1);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,214,120,${0.28 + 0.18 * pulse})`; ctx.lineWidth = G.r * 0.9; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,170,0.95)'; ctx.lineWidth = Math.max(3, G.r * 0.2); ctx.stroke();
    ctx.restore();
    for (const i of g.line) { const p = cellXY(G, n, i); ctx.save(); ctx.strokeStyle = `rgba(255,224,140,${0.6 + 0.3 * pulse})`; ctx.lineWidth = Math.max(2.5, G.r * 0.14); ctx.beginPath(); ctx.arc(p.x, p.y, G.r * 1.08, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  // aim ghost
  const aim = state.aim >= 0 ? state.aim : state.pending >= 0 ? state.pending : state.hover;
  if (interactive && aim >= 0 && !g.cells[aim] && state.canPlay) {
    const p = cellXY(G, n, aim), black = g.turn === BLACK;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(G.x0, p.y); ctx.lineTo(G.x0 + (n - 1) * G.cell, p.y); ctx.moveTo(p.x, G.y0); ctx.lineTo(p.x, G.y0 + (n - 1) * G.cell); ctx.stroke(); ctx.restore();
    drawStone(ctx, black, p.x, p.y, G.r, stonesBlack, { alpha: state.aim >= 0 || state.pending >= 0 ? 0.62 : 0.4, shadow: false });
    if (state.pending >= 0) { ctx.save(); ctx.strokeStyle = COL.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, G.r * 1.12, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}

// magnifier above the finger (touch only, small cells)
function drawLens(ctx, state, L, ptr) {
  const g = state.game, n = g.n, G = geomOf(L, n), idx = state.aim; if (idx < 0) return;
  const cssCell = G.cell * (host.px || 0.6); if (cssCell >= 30 || !state.touch) return;
  const Rl = 118, zoom = clamp(Rl / (2.7 * G.cell), 1.3, 2.6), p = cellXY(G, n, idx);
  let lx = clamp(ptr.x, L.U.x0 + Rl + 6, L.U.x1 - Rl - 6), ly = ptr.y - 200;
  if (ly - Rl < L.U.y0 + 6) ly = ptr.y + 200;
  ly = clamp(ly, L.U.y0 + Rl + 6, L.U.y1 - Rl - 6);
  ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, Rl, 0, TAU); ctx.clip();
  const W = WOODS[state.set.wood] ?? WOODS.kaya; ctx.fillStyle = W.mid; ctx.fillRect(lx - Rl, ly - Rl, Rl * 2, Rl * 2);
  ctx.translate(lx, ly); ctx.scale(zoom, zoom); ctx.translate(-p.x, -p.y);
  ctx.strokeStyle = W.line; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let k = -4; k <= 4; k++) { const gx = (idx % n) + k, gy = ((idx / n) | 0) + k; if (gx >= 0 && gx < n) { ctx.moveTo(G.x0 + gx * G.cell, Math.max(G.y0, p.y - 5 * G.cell)); ctx.lineTo(G.x0 + gx * G.cell, Math.min(G.y0 + (n - 1) * G.cell, p.y + 5 * G.cell)); } if (gy >= 0 && gy < n) { ctx.moveTo(Math.max(G.x0, p.x - 5 * G.cell), G.y0 + gy * G.cell); ctx.lineTo(Math.min(G.x0 + (n - 1) * G.cell, p.x + 5 * G.cell), G.y0 + gy * G.cell); } }
  ctx.stroke();
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const gx = (idx % n) + dx, gy = ((idx / n) | 0) + dy; if (gx < 0 || gy < 0 || gx >= n || gy >= n) continue;
    const i = gy * n + gx, c = g.cells[i]; if (c) drawStone(ctx, c === BLACK, G.x0 + gx * G.cell, G.y0 + gy * G.cell, G.r, state.set.stones, { shadow: false });
  }
  for (const f of state.forbid) { const q = cellXY(G, n, f.idx); if (Math.abs(q.x - p.x) < 5 * G.cell && Math.abs(q.y - p.y) < 5 * G.cell) { ctx.strokeStyle = 'rgba(190,38,32,0.95)'; ctx.lineWidth = 3; const s = G.r * 0.5; ctx.beginPath(); ctx.moveTo(q.x - s, q.y - s); ctx.lineTo(q.x + s, q.y + s); ctx.moveTo(q.x + s, q.y - s); ctx.lineTo(q.x - s, q.y + s); ctx.stroke(); } }
  if (!g.cells[idx]) drawStone(ctx, g.turn === BLACK, p.x, p.y, G.r, state.set.stones, { alpha: 0.7, shadow: false });
  ctx.restore();
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = COL.gold; ctx.beginPath(); ctx.arc(lx, ly, Rl, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(lx, ly, Rl + 3, 0, TAU); ctx.stroke(); ctx.restore();
}

// ---- cards around the board ------------------------------------------------------------------------------------------------------
function playerCard(ctx, state, r, color) {
  const g = state.game, active = !g.winner && g.turn === color, black = color === BLACK;
  const isHuman = state.two || state.human === color, name = black ? 'Black' : 'White';
  const sub = state.autoMode ? `Computer · ${LEVELS[state.level - 1].name}` : state.two ? `Player ${color}` : isHuman ? 'You' : `Computer · ${LEVELS[state.level - 1].name}`;
  panel(ctx, r, { radius: 18, fill: active ? 'rgba(34,48,60,0.95)' : COL.panel, edge: active ? COL.gold : COL.edge });
  if (active) glow(ctx, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.9, RING.gold, 0.18);
  const sr = Math.min(r.h * 0.34, 34), sx = r.x + sr + 16, sy = r.y + r.h / 2;
  drawStone(ctx, black, sx, sy, sr, state.set.stones);
  const tx = sx + sr + 14, tw = r.w - (tx - r.x) - 12, big = Math.min(34, Math.max(minUnits(), r.h * 0.3));
  const small = r.h < 84;
  text(ctx, name, tx, r.y + r.h * (small ? 0.44 : 0.42), small ? Math.min(big, 28) : big, COL.text, { weight: 700, align: 'left', maxW: tw, font: DISPLAY });
  const status = g.winner ? (g.winner === color ? 'Winner' : '') : active ? (state.thinking ? 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : isHuman && !state.autoMode ? 'Your move' : 'To move') : '';
  if (small) { text(ctx, status ? `${sub} · ${status}` : sub, tx, r.y + r.h * 0.82, minUnits(), active ? COL.gold : COL.dim, { align: 'left', maxW: tw, weight: active ? 700 : 500 }); return; }
  text(ctx, sub, tx, r.y + r.h * 0.68, Math.max(minUnits(), big * 0.55), COL.dim, { align: 'left', maxW: tw });
  if (status) text(ctx, status, tx, r.y + r.h * 0.9, Math.max(minUnits(), big * 0.5), active ? COL.gold : COL.teal, { align: 'left', maxW: tw, weight: 700 });
}

function coachCard(ctx, state, r, L) {
  panel(ctx, r, { radius: 18, brand: true });
  const g = state.game, ts = TEXT_SCALES[state.set.ts];
  const msg = state.msg ? state.msg.text : state.coachText || '';
  const small = L.mode === 'compact';
  const headSize = Math.max(minUnits(), 20), pad = 16;
  const rule = `${MODES[g.mode].name} · move ${g.moves.length}`;
  const narrow = r.w < 330;
  if (!small) { text(ctx, state.autoMode ? 'WATCH & LEARN' : 'COACH', r.x + pad, r.y + 14 + headSize * 0.7, headSize, COL.gold, { align: 'left', weight: 800 }); if (!narrow) text(ctx, rule, r.x + r.w - pad, r.y + 14 + headSize * 0.7, headSize, COL.dim, { align: 'right', maxW: r.w * 0.5 }); }
  const body = small ? R(r.x + pad, r.y + 8, r.w - pad * 2 - 150, r.h - 16) : R(r.x + pad, r.y + 18 + headSize * 1.1, r.w - pad * 2, r.h - 30 - headSize * 1.1);
  const size = 27 * ts;
  ctx.save(); ctx.beginPath(); ctx.rect(body.x, body.y - 2, body.w, body.h + 4); ctx.clip();
  const lines = wrap(ctx, msg, size, body.w, 500);
  if (lines.length * size * 1.3 > body.h) fitPara(ctx, msg, body, size, COL.text, { weight: 500, min: minUnits() }); else para(ctx, msg, body.x, small ? body.y + (body.h - lines.length * size * 1.3) / 2 : body.y, body.w, size, COL.text, { weight: 500, lh: 1.3 });
  ctx.restore();
  if (small) text(ctx, rule, r.x + r.w - pad, r.y + r.h / 2 + 8, Math.max(minUnits(), 20), COL.dim, { align: 'right', maxW: 140 });
  if (state.thinking) { const w = r.w - 2 * pad; ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, r.x + pad, r.y + r.h - 12, w, 5, 2.5); ctx.fill(); ctx.fillStyle = COL.teal; roundRect(ctx, r.x + pad, r.y + r.h - 12, Math.max(10, w * state.progress), 5, 2.5); ctx.fill(); }
}

function historyCard(ctx, state, r) {
  panel(ctx, r, { radius: 18 });
  const g = state.game, n = g.n, head = Math.max(minUnits(), 20);
  text(ctx, 'MOVES', r.x + 16, r.y + 14 + head * 0.7, head, COL.gold, { align: 'left', weight: 800 });
  const pad = 12, gap = 8, x0 = r.x + pad, y0 = r.y + 22 + head * 1.3, availW = r.w - pad * 2;
  const cols = availW >= 560 ? 4 : availW >= 300 ? 3 : 2, chipW = (availW - gap * (cols - 1)) / cols;
  const chipH = clamp(Math.min(chipW * 0.36, (r.y + r.h - 10 - y0) / 2 - gap), 34, 64), rows = Math.max(1, Math.floor((r.y + r.h - 10 - y0 + gap) / (chipH + gap))), cap = cols * rows;
  const mv = g.moves, start = Math.max(0, mv.length - cap), fs = Math.max(minUnits(), chipH * 0.44);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (let k = start; k < mv.length; k++) {
    const j = k - start, cx = x0 + (j % cols) * (chipW + gap), cy = y0 + Math.floor(j / cols) * (chipH + gap), col = g.cells[mv[k]] === BLACK;
    roundRect(ctx, cx, cy, chipW, chipH, 10); ctx.fillStyle = k === mv.length - 1 ? 'rgba(232,197,107,0.24)' : 'rgba(255,255,255,0.06)'; ctx.fill();
    drawStone(ctx, col, cx + chipH * 0.5, cy + chipH * 0.5, chipH * 0.3, state.set.stones, { shadow: false });
    text(ctx, `${k + 1}`, cx + chipH * 0.98, cy + chipH * 0.64, fs * 0.82, COL.dim, { align: 'left' });
    text(ctx, nameOf(n, mv[k]), cx + chipW - 12, cy + chipH * 0.66, fs, COL.text, { align: 'right', weight: 700 });
  }
  if (!mv.length) text(ctx, 'No moves yet', r.x + r.w / 2, r.y + r.h / 2 + 10, Math.max(minUnits(), 24), COL.dim);
  ctx.restore();
}

export function renderPlay(ctx, state, L, ptr, labels) {
  const P = L.play;
  drawTable(ctx, L.w, L.h, state.set.wood);
  const rects = P.buttons(labels.length);
  playerCard(ctx, state, P.players[0], BLACK); playerCard(ctx, state, P.players[1], WHITE);
  if (state.lesson && P.history) coachCard(ctx, state, { ...P.coach, h: P.history.y + P.history.h - P.coach.y }, L);
  else { coachCard(ctx, state, P.coach, L); if (P.history) historyCard(ctx, state, P.history); }
  drawPosition(ctx, state, L);
  labels.forEach((b, i) => button(ctx, rects[i], b.label, b.id, { kind: b.kind, disabled: b.disabled, active: b.active, sub: b.sub }));
  if (state.aim >= 0) drawLens(ctx, state, L, ptr);
  if (state.swapAsk) swapCard(ctx, state, L);
}

function swapCard(ctx, state, L) {
  const B = L.play.board, w = Math.min(B.w - 24, 560), h = Math.min(B.h - 24, 380), x = B.x + (B.w - w) / 2, y = B.y + (B.h - h) / 2;
  ctx.fillStyle = 'rgba(6,10,14,0.55)'; ctx.fillRect(B.x, B.y, B.w, B.h);
  panel(ctx, R(x, y, w, h), { radius: 24, fill: 'rgba(14,22,29,0.97)', edge: COL.gold, brand: true });
  text(ctx, 'Swap colours?', x + w / 2, y + 62, Math.min(54, w / 9), '#f3e6c4', { font: DISPLAY, weight: 700, maxW: w - 40 });
  const who = state.two ? 'The second player' : 'You';
  para(ctx, `${who} may now take Black instead of White. Black has three stones in play: two black, one white, and White is to move.`, x + 24, y + 86, w - 48, Math.min(28, h / 14), COL.text, { weight: 500 });
  const bw = (w - 24 * 2 - 14) / 2, by = y + h - 24 - Math.min(80, h * 0.2);
  button(ctx, R(x + 24, by, bw, Math.min(80, h * 0.2)), 'Keep White', 'swapkeep');
  button(ctx, R(x + 24 + bw + 14, by, bw, Math.min(80, h * 0.2)), 'Swap: play Black', 'swapyes', { kind: 'primary' });
}

// ---- mini boards for the Rules and Learn pages ---------------------------------------------------------------------------------------
export function diagramSize(d, maxW) { const pad0 = 0.62, cell = Math.min(54, maxW / (d.w - 1 + 2 * pad0)); return { cell, pad: cell * pad0, w: cell * (d.w - 1) + 2 * cell * pad0, h: cell * (d.h - 1) + 2 * cell * pad0 }; }
export function drawDiagram(ctx, d, x, y, maxW, set) {
  const { cell, pad, w, h } = diagramSize(d, maxW), W = WOODS[set.wood] ?? WOODS.kaya, ox = x + (maxW - w) / 2;
  ctx.save();
  roundRect(ctx, ox - 4, y - 2, w + 8, h + 8, 14); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  roundRect(ctx, ox, y, w, h, 12); const g = ctx.createLinearGradient(ox, y, ox + w, y + h); g.addColorStop(0, W.hi); g.addColorStop(1, W.lo); ctx.fillStyle = g; ctx.fill();
  const at = (px, py) => [ox + pad + px * cell, y + pad + py * cell];
  ctx.strokeStyle = W.line; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0; i < d.w; i++) { const [lx, ly] = at(i, 0), [, ly2] = at(i, d.h - 1); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly2); }
  for (let j = 0; j < d.h; j++) { const [lx, ly] = at(0, j), [lx2] = at(d.w - 1, j); ctx.moveTo(lx, ly); ctx.lineTo(lx2, ly); }
  ctx.stroke();
  for (const m of d.m) {
    const [cx, cy] = at(m.x, m.y), col = RING[m.c] ?? RING.gold;
    if (m.t === 'x') { const s = cell * 0.24; ctx.strokeStyle = 'rgba(190,38,32,0.95)'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke(); }
    else if (m.t === 'ring') { ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.4, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = `rgba(${col},0.95)`; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.15, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke(); }
  }
  for (const [px, py] of d.b) { const [cx, cy] = at(px, py); drawStone(ctx, true, cx, cy, cell * 0.44, set.stones); }
  for (const [px, py] of d.wh) { const [cx, cy] = at(px, py); drawStone(ctx, false, cx, cy, cell * 0.44, set.stones); }
  ctx.restore();
  return h + 8;
}
