// Everything that draws a frame. Reads `state`, never changes it (state changes live in game.js).
import {
  BOARD_X, BOARD_Y, BOARD_SIZE, squareXY, posXY, startXY, chipRect, boardCentre, tableAt, dieK,
  TEXT_SCALES, THINK_STEPS, host,
} from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import {
  FONT, drawBackdrop, drawBoard, drawPawn, drawDie, drawButton, drawLadder, drawSnake, snakePath, SNAKE_PAL, panel, ring, roundPath, wrapLines, setArtRes, shade, setPress,
} from './art.js';
import { COLORS, COLOR_NAMES, classicBoard } from './rules.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { layoutList, drawList } from './ui.js';

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

const TAU = Math.PI * 2;
export const scaleOf = (state) => TEXT_SCALES[state.textIdx] ?? 1;

function fitFont(ctx, text, px, maxW, weight = 700, minPx = 12) {
  let p = px; ctx.font = `${weight} ${p}px ${FONT}`;
  while (p > minPx && ctx.measureText(text).width > maxW) { p -= 1; ctx.font = `${weight} ${p}px ${FONT}`; }
  return p;
}

// ---- pawn positions (during an animation the moving pawn is drawn by the animation) -----------------------------
export function animPawn(state) {
  const a = state.anim; if (!a) return null;
  const s = a.segs[a.i]; if (!s) return null;
  const u = Math.max(0, Math.min(1, a.t / s.dur));
  if (s.type === 'hop') {
    const e = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
    const sq = u > 0.86 ? 1 - 0.16 * Math.sin((u - 0.86) / 0.14 * Math.PI) : u < 0.14 ? 1 + 0.12 * Math.sin(u / 0.14 * Math.PI) : 1;
    return { x: s.a.x + (s.b.x - s.a.x) * e, y: s.a.y + (s.b.y - s.a.y) * e, lift: Math.sin(u * Math.PI) * (s.back ? 14 : 30), squash: sq };
  }
  if (s.type === 'climb') {
    const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    return { x: s.a.x + (s.b.x - s.a.x) * e, y: s.a.y + (s.b.y - s.a.y) * e, lift: 10 + Math.sin(u * 20) * 3, squash: 1, glow: 'rgba(255,230,140,0.7)' };
  }
  if (s.type === 'slide') {
    const e = u * u * (3 - 2 * u), n = s.pts.length - 1, f = e * n, i = Math.min(n - 1, Math.floor(f)), r = f - i;
    return { x: s.pts[i].x + (s.pts[i + 1].x - s.pts[i].x) * r, y: s.pts[i].y + (s.pts[i + 1].y - s.pts[i].y) * r, lift: 4, squash: 1 + Math.sin(u * 16) * 0.05 };
  }
  if (s.type === 'shudder') return { x: s.a.x + Math.sin(u * 34) * 5 * (1 - u), y: s.a.y, lift: 0, squash: 1 };
  return null;
}

// ---- board scene ------------------------------------------------------------------------------------------------------
function drawHighlights(ctx, state) {
  const t = state.t, pulse = 0.55 + 0.45 * Math.sin(t * 6);
  const mark = (n, col, r = 26, w = 4) => { const p = squareXY(n); if (p) ring(ctx, p.x, p.y, r + 2 * pulse, col, w); };
  const g = state.g;
  const cur = g.players[g.turn];
  if (state.reveal && state.reveal.faint) for (const n of state.reveal.faint) { const p = squareXY(n); if (p) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, TAU); ctx.fill(); } }
  if (state.options && state.options.length && (state.phase === 'pick' || state.reveal)) {
    state.options.forEach((o, i) => {
      const chosen = state.reveal && state.reveal.chosen === i, best = state.hintDie === i && state.phase === 'pick';
      const col = chosen ? 'rgba(255,214,90,0.98)' : best ? 'rgba(120,255,170,0.95)' : 'rgba(255,255,255,0.8)';
      if (o.res.over) return;
      mark(o.res.land, col, chosen ? 29 : 25, chosen ? 5 : 3.5);
      if (o.res.jump) { mark(o.res.to, col, 17, 2.5); const a = squareXY(o.res.land), b = squareXY(o.res.to); ctx.save(); ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); }
    });
  }
  if (state.thinkRing && cur) { const p = state.shown ? posXY(state.shown[g.turn], g.turn) : null; if (p) ring(ctx, p.x, p.y - 4, 34 + 6 * pulse, 'rgba(120,200,255,0.9)', 4); }
}

function drawPawns(ctx, state) {
  const g = state.g, list = [];
  const counts = {};
  g.players.forEach((p, i) => { const n = state.shown[i]; counts[n] = (counts[n] ?? 0) + 1; });
  const seen = {};
  g.players.forEach((p, i) => {
    const n = state.shown[i], isMover = state.anim && state.anim.pi === i;
    let x, y, lift = 0, squash = 1, glow = null, r = 17;
    if (isMover) { const ap = animPawn(state); if (ap) ({ x, y, lift, squash } = ap), glow = ap.glow; }
    if (x === undefined) {
      const base = posXY(n, i); x = base.x; y = base.y;
      const c = counts[n]; if (n > 0 && c > 1) { const k = seen[n] ?? 0; seen[n] = k + 1; const offs = [[-12, -7], [12, -7], [-12, 9], [12, 9]]; x += offs[k % 4][0]; y += offs[k % 4][1]; r = 14; }
      if (g.turn === i && !state.over && state.phase !== 'move' && state.mover < 0) lift = 3 + 3 * Math.sin(state.t * 4);
    }
    list.push({ x, y, lift, squash, glow, r, i, color: COLORS[p.color], z: y + (isMover ? 500 : 0) });
  });
  list.sort((a, b) => a.z - b.z);
  for (const q of list) drawPawn(ctx, q.x, q.y, q.color, q.r, { lift: q.lift, squash: q.squash, glow: q.glow });
}

function drawParticles(ctx, state, screen) {
  for (const q of state.parts) {
    if (!!q.scr !== !!screen) continue;
    const a = Math.max(0, 1 - q.t / q.max);
    ctx.save(); ctx.globalAlpha = a;
    if (q.kind === 'confetti') { ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.t * q.spin); ctx.fillStyle = q.c; ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size); }
    else { ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (q.kind === 'dust' ? 1 + q.t * 2 : 1), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (!screen) for (const r of state.rings) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - r.t / 0.5); ctx.strokeStyle = r.c ?? 'rgba(255,240,200,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(r.x, r.y, 10 + r.t * (r.big ? 120 : 70), (10 + r.t * (r.big ? 120 : 70)) * 0.45, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
}

// Dice: offsets from the table centre in design units (die edge 108), resolved against the live layout.
const dieOff = (n, i) => (n === 1 ? { x: 0, y: 0 } : { x: i === 0 ? -125 : 125, y: 0 });
export function dieRects(state, L) {
  const n = state.values.length || 1, k = dieK(L, n), out = [];
  for (let i = 0; i < n; i++) {
    const d = state.tossDice && state.tossDice[i], o = d ? { x: d.tx, y: d.ty } : dieOff(n, i), p = tableAt(L, n, o.x, o.y);
    out.push({ x: p.x - 62 * k, y: p.y - 62 * k, w: 124 * k, h: 124 * k });
  }
  return out;
}
function drawTable(ctx, state, L) {
  const T = L.table, g0 = state.g, n = g0.opts.dice === 'two' ? 2 : 1, k = dieK(L, n), ds = 108 * k;
  panel(ctx, T, { top: 'rgba(36,50,92,0.85)', bot: 'rgba(20,28,60,0.9)', line: 'rgba(200,170,110,0.55)' });
  ctx.save(); roundPath(ctx, T.x + 6, T.y + 6, T.w - 12, T.h - 12, 18); ctx.clip();
  // woven cloth look: soft diagonal weave
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
  for (let i = -T.h; i < T.w; i += 8) { ctx.beginPath(); ctx.moveTo(T.x + i, T.y); ctx.lineTo(T.x + i + T.h, T.y + T.h); ctx.stroke(); }
  const gl = ctx.createRadialGradient(L.dieHome.x, T.y + T.h / 2, 10, L.dieHome.x, T.y + T.h / 2, Math.max(120, T.w / 2)); gl.addColorStop(0, 'rgba(255,225,160,0.14)'); gl.addColorStop(1, 'rgba(255,225,160,0)');
  ctx.fillStyle = gl; ctx.fillRect(T.x, T.y, T.w, T.h);
  ctx.restore();
  const g = state.g, cur = g.players[state.mover >= 0 ? state.mover : g.turn];
  const col = COLORS[cur.color];
  const small = (px) => Math.max(12, Math.round(px * Math.min(scaleOf(state), 1.4) * Math.max(0.8, k)));
  if (state.phase === 'toss' && state.tossDice) {
    const Tt = state.toss, u = Math.min(1, Tt.t / Tt.dur);
    state.tossDice.forEach((d, i) => {
      const e = 1 - Math.pow(1 - u, 2.2);
      const a = tableAt(L, n, d.sx, d.sy), b = tableAt(L, n, d.tx, d.ty);
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      let lift = 0; const bs = [[0, 0.5, 150], [0.5, 0.77, 48], [0.77, 0.93, 16]];
      for (const [a0, b0, amp] of bs) if (u >= a0 && u < b0) lift = amp * Math.sin((u - a0) / (b0 - a0) * Math.PI);
      const face = u < 0.9 ? 1 + (Math.floor(state.t * 24 + i * 3) % 6) : d.value;
      drawDie(ctx, x, y, ds, face, { angle: d.a0 + d.spin * (1 - e), lift: lift * k, scale: 1 + lift / 300 });
    });
  } else if (state.values.length) {
    const rects = dieRects(state, L);
    state.values.forEach((v, i) => {
      const r = rects[i], cx = r.x + r.w / 2, cy = r.y + r.h / 2, d = state.tossDice && state.tossDice[i];
      const pickable = state.phase === 'pick';
      const best = pickable && state.hintDie === i;
      const chosen = state.reveal && state.reveal.chosen === i;
      const used = state.phase === 'move' || state.phase === 'hold' || state.phase === 'banner';
      const dim = used && state.options && state.options.length > 1 && state.chosenDie !== undefined && state.chosenDie !== i;
      ctx.save(); if (dim) ctx.globalAlpha = 0.4;
      drawDie(ctx, cx, cy - (pickable ? (4 + 4 * Math.sin(state.t * 5 + i)) * k : 0), ds, v, { angle: d ? d.aEnd : 0, glow: best ? 'rgba(120,255,170,0.9)' : chosen ? 'rgba(255,214,90,0.95)' : pickable ? 'rgba(255,255,255,0.6)' : null, ring: pickable ? col : null });
      ctx.restore();
      if (pickable) { ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.font = `400 ${small(18)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('tap to use', cx, Math.min(T.y + T.h - 8, cy + 82 * k)); }
    });
  } else {
    // dice at rest, waiting for a throw (hidden while Watch & Learn is still thinking)
    if (state.scene === 'demo') {
      for (let i = 0; i < n; i++) { const o = dieOff(n, i), p = tableAt(L, n, o.x, o.y), h = ds / 2; ctx.save(); ctx.setLineDash([10, 9]); ctx.strokeStyle = 'rgba(255,230,170,0.45)'; ctx.lineWidth = 3; roundPath(ctx, p.x - h, p.y - h, ds, ds, 22 * k); ctx.stroke(); ctx.fillStyle = 'rgba(255,230,170,0.5)'; ctx.font = `700 ${Math.round(52 * k)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('?', p.x, p.y + 18 * k); ctx.restore(); }
      return;
    }
    const myTurn = !cur.ai && !state.over && state.phase === 'idle' && state.scene === 'play';
    for (let i = 0; i < n; i++) {
      const o = dieOff(n, i), p = tableAt(L, n, o.x, o.y);
      drawDie(ctx, p.x, p.y + (myTurn ? Math.sin(state.t * 3 + i) * 3 : 0), ds, state.restFace[i] ?? 1 + i * 2, { angle: i ? 0.2 : -0.15, glow: myTurn ? 'rgba(255,214,120,0.6)' : null });
    }
    if (myTurn) { ctx.fillStyle = 'rgba(255,240,200,0.85)'; ctx.font = `italic 400 ${small(20)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('tap or flick the dice', T.x + T.w / 2, T.y + T.h - 14); }
  }
}

function drawChips(ctx, state, L) {
  const g = state.g, n = g.players.length;
  const sc = Math.min(scaleOf(state), 1.4);
  g.players.forEach((p, i) => {
    const r = chipRect(L, i, n), turn = (state.mover >= 0 ? state.mover : g.turn) === i && !state.over;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundPath(ctx, r.x + 1, r.y + 4, r.w, r.h, 16); ctx.fill();
    roundPath(ctx, r.x, r.y, r.w, r.h, 16); const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, turn ? 'rgba(90,64,24,0.95)' : 'rgba(40,26,16,0.85)'); gr.addColorStop(1, turn ? 'rgba(56,36,12,0.95)' : 'rgba(22,14,9,0.9)'); ctx.fillStyle = gr; ctx.fill();
    ctx.lineWidth = turn ? 3 : 1.5; ctx.strokeStyle = turn ? shade(COLORS[p.color], 0.3) : 'rgba(244,222,180,0.28)'; ctx.stroke();
    const pr = Math.min(13, r.h * 0.2), tx = r.x + (r.w < 150 ? 12 + pr * 2 : 48), px0 = r.w < 150 ? r.x + 12 + pr : r.x + 26;
    drawPawn(ctx, px0, r.y + r.h / 2 + 4, COLORS[p.color], pr, { lift: turn ? 2 + Math.sin(state.t * 5) * 2 : 0 });
    ctx.textAlign = 'left'; ctx.fillStyle = '#f7e9c8';
    const w = r.x + r.w - tx - 8, f1 = Math.round(r.h * 0.3 * sc), f2 = Math.round(r.h * 0.24 * sc);
    const nm = p.name; fitFont(ctx, nm, f1, w, 700, 12); ctx.fillText(nm, tx, r.y + r.h / 2 - 3);
    const sq = state.shown[i] ? `Square ${state.shown[i]}` : 'At the start';
    ctx.fillStyle = 'rgba(247,233,200,0.75)'; fitFont(ctx, sq, f2, w, 400, 11);
    ctx.fillText(sq, tx, r.y + r.h / 2 + r.h * 0.3);
    ctx.restore();
  });
}

// The caption never shrinks below a readable size: if a long message still does not fit, it is cut with
// "tap to read" and tapping the panel opens the full text (msgItems) at the chosen text size.
let captionCut = false;
export const isCaptionCut = () => captionCut;
function drawMessage(ctx, state, L) {
  const M = L.msg;
  panel(ctx, M);
  const m = state.msg; captionCut = false; if (!m) return;
  const sc = Math.min(scaleOf(state), 2), maxW = M.w - 40, maxH = M.h - 14, weight = m.kind === 'good' || m.kind === 'bad' ? 700 : 400;
  const startPx = Math.round(25 * sc), minPx = Math.min(L.msgMin, startPx);
  let px = startPx, lines;
  for (; ;) { ctx.font = `${weight} ${px}px ${FONT}`; lines = wrapLines(ctx, m.text, maxW); if (lines.length * px * 1.22 <= maxH || px <= minPx) break; px -= 1; }
  const maxLines = Math.max(1, Math.floor(maxH / (px * 1.22)));
  if (lines.length > maxLines) {
    captionCut = true; lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1].replace(/[\s,.;:]+$/, ''); const tag = ' … tap to read';
    while (last.length > 4 && ctx.measureText(last + tag).width > maxW) last = last.slice(0, last.lastIndexOf(' ') > 0 ? last.lastIndexOf(' ') : last.length - 1);
    lines[maxLines - 1] = last + tag;
  }
  const lh = px * 1.22, total = lines.length * lh;
  ctx.textAlign = 'center'; ctx.fillStyle = m.kind === 'good' ? '#ffe08a' : m.kind === 'bad' ? '#ffb4a8' : m.kind === 'hint' ? '#a8ffd0' : '#f7e9c8';
  let y = M.y + (M.h - total) / 2 + px * 0.95;
  for (const l of lines) { ctx.fillText(l, M.x + M.w / 2, y); y += lh; }
}
export function msgItems(state, L) {
  return [
    { t: 'btn', id: 'close', label: 'Close', primary: true },
    { t: 'head', text: state.scene === 'demo' ? 'Watch & Learn' : 'Message' },
    { t: 'text', text: state.msg ? state.msg.text : '', px: 24, align: 'left' },
  ];
}

function drawHeader(ctx, state, L, title) {
  const H = L.head.title; if (!H) return;
  const sc = Math.min(scaleOf(state), 1.5);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b8';
  fitFont(ctx, title, Math.round(32 * sc), H.maxW, 700, 14);
  ctx.fillText(title, H.x, H.y);
}

export function renderBoardScene(ctx, state, L, demo) {
  drawBackdrop(ctx, L.w, L.h);
  const g = state.g, cur = g.players[state.mover >= 0 ? state.mover : g.turn], B = L.board;
  ctx.save();
  ctx.translate(B.x, B.y); ctx.scale(B.s, B.s); ctx.translate(-BOARD_X, -BOARD_Y);
  drawBoard(ctx, g.board);
  drawHighlights(ctx, state);
  drawPawns(ctx, state);
  drawParticles(ctx, state, false);
  ctx.restore();
  drawParticles(ctx, state, true);
  drawChips(ctx, state, L);
  drawMessage(ctx, state, L);
  drawTable(ctx, state, L);
  if (demo) {
    const D = L.demo, dm = state.demo, steps = THINK_STEPS;
    drawHeader(ctx, state, L, 'Watch & Learn');
    drawButton(ctx, D.exit, 'Exit', { fontPx: 24 });
    drawButton(ctx, D.tdec, '−', { fontPx: 34, disabled: state.thinkIdx === 0 });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { fontPx: 28, primary: true });
    drawButton(ctx, D.tinc, '+', { fontPx: 34, disabled: state.thinkIdx === steps.length - 1 });
    drawButton(ctx, D.speed, `x${dm.speed}`, { fontPx: 26 });
    // think seconds + phase label inside the table
    const label = state.paused ? 'Paused' : state.phase === 'hold' && state.reveal ? 'REVEAL' : dm.phase === 'think' ? `THINK ${Math.max(0, Math.ceil(dm.timer))}s` : dm.phase === 'act' ? 'MOVE' : '';
    const text = `${L.head.title ? '' : 'Watch & Learn  ·  '}${label}   (think time ${steps[state.thinkIdx]}s)`;
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,230,170,0.95)';
    fitFont(ctx, text, Math.round(20 * Math.min(scaleOf(state), 1.5)), L.table.w - 24, 700, 13);
    ctx.fillText(text, L.table.x + L.table.w / 2, L.demoLabelY);
  } else {
    const hs = L.head;
    if (hs.menu) drawButton(ctx, hs.menu, 'Menu', { fontPx: 26 });
    drawHeader(ctx, state, L, state.over ? 'Game over' : cur.ai ? `${cur.name} is playing` : g.players.some((p) => p.ai) ? 'Your turn' : `${cur.name}'s turn`);
    const soundBtn = hs.sound ?? L.bar.sound;
    if (soundBtn) drawButton(ctx, soundBtn, state.sound ? 'Sound' : 'Muted', { fontPx: 24, active: state.sound });
    const my = !cur.ai && state.phase === 'idle' && !state.over;
    drawButton(ctx, L.bar.menu, 'Menu', { fontPx: 26 });
    drawButton(ctx, L.bar.roll, state.phase === 'pick' ? 'Choose a die' : 'ROLL', { fontPx: 38, primary: true, disabled: !my });
    drawButton(ctx, L.bar.hint, 'Hint', { fontPx: 28, disabled: state.over || cur.ai || (state.phase !== 'idle' && state.phase !== 'pick') });
  }
  if (state.banner) {
    const b = state.banner, u = Math.min(1, b.t / 0.35), a = b.t > 1.2 ? Math.max(0, 1 - (b.t - 1.2) / 0.4) : 1, c = boardCentre(L), bk = clampN(B.s, 0.6, 1.05);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(c.x, c.y - 40 * bk); const s = bk * (0.6 + 0.4 * (1 - Math.pow(1 - u, 3)) + (b.t < 0.35 ? 0.15 * Math.sin(u * Math.PI) : 0)); ctx.scale(s, s);
    ctx.font = `italic 700 78px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,16,4,0.9)'; ctx.strokeText(b.text, 0, 0);
    const gg = ctx.createLinearGradient(0, -50, 0, 10); gg.addColorStop(0, b.color ?? '#fff1b0'); gg.addColorStop(1, b.color2 ?? '#e8a73a'); ctx.fillStyle = gg; ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }
}

// ---- title / setup / settings ---------------------------------------------------------------------------------------------
// The title art: wordmark, subtitle, the real board with pawns hopping on it, and the small themed Arcforge lockup. Drawn in a w x h box.
function drawHero(ctx, state, w, h, dy = 0, tight = false) {
  ctx.textAlign = 'center'; const T0 = tight ? 112 : 150, TS = tight ? 62 : 74, TY = tight ? 66 : 78, GY = tight ? 100 : 122;
  ctx.save(); ctx.translate(0, dy); h -= dy;
  const px = fitFont(ctx, 'Snakes & Ladders', TS, w - 24, 700, 30); ctx.font = `italic 700 ${px}px ${FONT}`;
  ctx.save(); ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(30,12,2,0.95)';
  ctx.strokeText('Snakes & Ladders', w / 2, TY);
  const gg = ctx.createLinearGradient(0, 30, 0, 90); gg.addColorStop(0, '#fff1b8'); gg.addColorStop(1, '#e49b2e'); ctx.fillStyle = gg; ctx.fillText('Snakes & Ladders', w / 2, TY);
  ctx.restore();
  ctx.font = `italic 400 ${fitFont(ctx, 'Cloth Board  ·  a painted dice race', 30, w - 24, 400, 16)}px ${FONT}`; ctx.fillStyle = '#f2d89c'; ctx.fillText('Cloth Board  ·  a painted dice race', w / 2, GY);
  const k = Math.max(0.2, Math.min(0.8, (h - T0 - 14) / BOARD_SIZE, (w - 20) / BOARD_SIZE)), bx = w / 2 - BOARD_SIZE * k / 2, by = T0;
  ctx.save(); ctx.translate(bx, by); ctx.scale(k, k); ctx.translate(-BOARD_X, -BOARD_Y);
  drawBoard(ctx, state.titleBoard);
  const demoPawns = [[22, 0], [47, 1], [64, 2], [9, 3]];
  for (const [n, i] of demoPawns) { const p = squareXY(n); drawPawn(ctx, p.x, p.y, COLORS[i], 17, { lift: 4 + 4 * Math.sin(state.t * 3 + i) }); }
  ctx.restore();
  ctx.restore();
}
// the hero starts below the host back button (the list column can begin above its bottom edge)
const heroDy = (L) => (L.backBox && L.backBox.h ? Math.max(0, Math.round(L.backBox.y + L.backBox.h + 2 - L.list.top)) : 0);
function heroItem(state, h, dy = 0, tight = false) { return { t: 'hero', h, draw: (ctx, w) => drawHero(ctx, state, w, h, dy, tight) }; }

function bar(ctx, state, L, label) {
  const Z = L.zoom;
  drawButton(ctx, Z.dec, 'A−', { fontPx: 30, disabled: state.textIdx === 0 });
  drawButton(ctx, Z.inc, 'A+', { fontPx: 30, disabled: state.textIdx === TEXT_SCALES.length - 1 });
  const cx = (Z.dec.x + Z.dec.w + Z.inc.x) / 2;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b8'; fitFont(ctx, label, 34, Z.labelMax, 700, 14); ctx.fillText(label, cx, Z.dec.y + 42);
}

// The Arcforge lockup row (bottom-centre under the menu buttons): width ~35% of the short side (28% in landscape), never under ~120 css px.
function lockupItem(L) {
  const px = Math.max(host.px, 1e-6), w = Math.min(L.w - 120, Math.max((L.land ? 0.28 : 0.35) * 720, 120 / px)), zh = Math.max(w * 327 / 1200 + 16, 44 / px);
  return { t: 'lockup', w, zw: Math.max(w, 44 / px), zh, h: Math.round(zh + 20) };
}
export function titleItems(state, L) {
  const items = [];
  if (!L.titleSplit) { const tight = L.h < 1230; items.push(heroItem(state, clampN(L.list.bottom - L.list.top - (tight ? 410 : 460) - lockupItem(L).h, tight ? 260 : 280, 860), heroDy(L), tight)); }
  items.push(
    { t: 'btn', id: 'play', label: 'Play', primary: true },
    { t: 'btn', id: 'watch', label: 'Watch & Learn' },
    { t: 'row', buttons: [{ id: 'howto', label: 'How to Play' }, { id: 'rules', label: 'Rules' }] },
    { t: 'row', buttons: [{ id: 'about', label: 'About' }, { id: 'settings', label: 'Settings' }] },
    lockupItem(L),
    { t: 'text', text: `Text size ${Math.round(scaleOf(state) * 100)}%  ·  A− and A+ above`, px: 20, color: 'rgba(244,222,180,0.6)' },
  );
  return items;
}
const onoff = (v) => (v ? 'On' : 'Off');
export function setupItems(state) {
  const s = state.setup;
  const choice = (id, label, opts) => [{ t: 'head', text: label }, { t: 'row', buttons: opts.map(([v, l]) => ({ id: `${id}:${v}`, label: l, active: s[id] === v })) }];
  return [
    ...choice('dice', 'Dice', [['one', 'One die'], ['two', 'Pick of two']]),
    { t: 'text', text: s.dice === 'one' ? 'Classic: the die is your move.' : 'Roll two dice and choose which to use.', px: 22 },
    ...choice('players', 'Players', [[2, '2'], [3, '3'], [4, '4']]),
    ...choice('vs', 'Opponents', [['cpu', 'Computers'], ['friends', 'Friends']]),
    ...(s.vs === 'cpu' ? choice('level', 'Computer level', [[1, 'Easy'], [2, 'Steady'], [3, 'Sharp']]) : []),
    ...choice('board', 'Board', [['classic', 'Classic'], ['fresh', 'Fresh'], ['daily', 'Daily']]),
    { t: 'head', text: 'Extra rules' },
    { t: 'btn', id: 'toggle:exact', label: `Exact finish: ${onoff(s.exact)}`, active: s.exact },
    { t: 'btn', id: 'toggle:six', label: `Six rolls again: ${onoff(s.six)}`, active: s.six },
    { t: 'btn', id: 'toggle:bump', label: `Bump back: ${onoff(s.bump)}`, active: s.bump },
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'start', label: 'Start game', primary: true },
    { t: 'btn', id: 'back', label: 'Back' },
  ];
}
export function settingsItems(state) {
  const sc = Math.round(scaleOf(state) * 100);
  return [
    { t: 'head', text: 'Sound and touch' },
    { t: 'btn', id: 'sound', label: `Sound effects: ${onoff(state.sound)}`, active: state.sound },
    { t: 'btn', id: 'haptics', label: `Vibration: ${onoff(state.haptics)}`, active: state.haptics },
    { t: 'head', text: 'Text size' },
    { t: 'text', text: `Now ${sc}%. Applies to every screen.`, px: 22 },
    { t: 'row', buttons: [{ id: 'zdec', label: 'Smaller (A−)', disabled: state.textIdx === 0 }, { id: 'zinc', label: 'Larger (A+)', disabled: state.textIdx === TEXT_SCALES.length - 1 }] },
    { t: 'head', text: 'Watch & Learn' },
    { t: 'text', text: `Think time before each move: ${THINK_STEPS[state.thinkIdx]} seconds.`, px: 22 },
    { t: 'row', buttons: [{ id: 'tdec', label: 'Shorter', disabled: state.thinkIdx === 0 }, { id: 'tinc', label: 'Longer', disabled: state.thinkIdx === THINK_STEPS.length - 1 }] },
    { t: 'head', text: 'Purchases' },
    { t: 'btn', id: 'restore', label: state.restored ? 'Purchases restored' : 'Restore purchases' },
    { t: 'head', text: 'Your record' },
    { t: 'text', text: `Games played ${state.stats.played}  ·  Won ${state.stats.wins}`, px: 24 },
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true },
  ];
}
export function resultItems(state, L) {
  const g = state.g, items = [{ t: 'gap', h: (L.land ? 40 : 240) / scaleOf(state) }];
  const w = g.players[g.winner];
  items.push({ t: 'text', text: w.ai || g.players.some((p) => p.ai) ? (w.ai ? `${w.name} wins` : 'You win!') : `${w.name} wins!`, px: 54, bold: true, color: '#ffe08a' });
  items.push({ t: 'text', text: `${g.moves} moves played`, px: 22, color: 'rgba(244,222,180,0.75)' });
  const order = g.players.map((p, i) => ({ p, i })).sort((a, b) => (b.i === g.winner) - (a.i === g.winner) || b.p.pos - a.p.pos);
  order.forEach((o, k) => items.push({ t: 'text', text: `${k + 1}. ${o.p.name} (${COLOR_NAMES[o.p.color]}), ${o.i === g.winner ? 'home' : o.p.pos ? 'square ' + o.p.pos : 'at the start'}`, px: 26 }));
  items.push({ t: 'gap', h: 12 });
  items.push({ t: 'btn', id: 'again', label: 'Play again', primary: true });
  items.push({ t: 'btn', id: 'menu', label: 'Menu' });
  items.push({ t: 'hero', h: 44, draw: (ctx, w2) => drawMoreLine(ctx, w2 / 2, 26, 18) });
  return items;
}
function demoDoneItems(state, L) {
  return [
    { t: 'gap', h: (L.land ? 40 : 300) / scaleOf(state) },
    { t: 'text', text: 'That was a whole game.', px: 44, bold: true, color: '#ffe08a' },
    { t: 'text', text: `${state.g.players[state.g.winner].name} reached square 100 after ${state.g.moves} moves.`, px: 26 },
    { t: 'gap', h: 12 },
    { t: 'btn', id: 'watch', label: 'Watch another', primary: true },
    { t: 'btn', id: 'menu', label: 'Menu' },
  ];
}

export function listFor(ctx, state, L) {
  const sc = scaleOf(state);
  let items, G = L.list;
  if (state.msgOpen) items = msgItems(state, L);
  else if (state.scene === 'title') { items = titleItems(state, L); if (L.titleSplit) G = L.titleList; else if (L.h < 1230 && sc <= 1.5) G = { ...G, tight: true }; }
  else if (state.scene === 'setup') items = setupItems(state);
  else if (state.scene === 'settings') items = settingsItems(state);
  else if (state.scene === 'demo-limit') items = [{ t: 'gap', h: (L.land ? 40 : 240) / sc }, { t: 'text', text: 'You have played the free web games.', px: 34, bold: true, color: '#ffe08a' }, { t: 'text', text: 'Get the full game on iPhone and Android: unlimited games, every board and every rule.', px: 28 }, { t: 'btn', id: 'menu', label: 'Menu', primary: true }];
  else if (state.scene === 'demo' && state.demo.finished) items = demoDoneItems(state, L);
  else items = resultItems(state, L);
  return layoutList(ctx, items, sc, G);
}

// ---- reference pages (About / How to Play / Rules) --------------------------------------------------------------------------------
function drawFig(ctx, state, fig, cx, y) {
  const mid = y + 80;
  if (fig === 'board') { const k = 0.25; ctx.save(); ctx.translate(cx - BOARD_SIZE * k / 2, y - 6); ctx.scale(k, k); ctx.translate(-BOARD_X, -BOARD_Y); drawBoard(ctx, classicBoard()); ctx.restore(); }
  else if (fig === 'numbers') {
    const c = 31, x0 = cx - c * 5;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 10; k++) {
      const n = r === 0 ? 11 + (9 - k) : 1 + k, col = ['#f2dca6', '#e39a55', '#79b3aa', '#d98782'][(k + (r === 0 ? 1 : 0) * 2) % 4];
      ctx.fillStyle = col; ctx.fillRect(x0 + k * c, y + 30 + (r === 0 ? 0 : c + 2), c - 2, c - 2);
      ctx.fillStyle = '#3c1c0a'; ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(String(n), x0 + k * c + c / 2 - 1, y + 30 + (r === 0 ? 0 : c + 2) + 21);
    }
    ctx.fillStyle = '#ffd97a'; ctx.font = `700 22px ${FONT}`; ctx.fillText('→', x0 + 5 * c, y + 30 + 2 * c + 24); ctx.fillText('←', x0 + 5 * c, y + 18);
  }
  else if (fig === 'pawn') drawPawn(ctx, cx, mid + 14, COLORS[0], 44);
  else if (fig === 'pawns') COLORS.forEach((c, i) => drawPawn(ctx, cx + (i - 1.5) * 78, mid + 12, c, 32));
  else if (fig === 'die') drawDie(ctx, cx, mid, 110, 4, { angle: -0.15 });
  else if (fig === 'die6') drawDie(ctx, cx, mid, 110, 6, { angle: 0.12, glow: 'rgba(255,214,120,0.7)' });
  else if (fig === 'dice2') { drawDie(ctx, cx - 74, mid, 94, 5, { angle: -0.2 }); drawDie(ctx, cx + 74, mid, 94, 2, { angle: 0.18, ring: '#ffd75a' }); }
  else if (fig === 'ladder') drawLadder(ctx, { x: cx - 80, y: y + 150 }, { x: cx + 80, y: y + 10 }, 0, 1.15);
  else if (fig === 'snake') drawSnake(ctx, snakePath({ x: cx + 70, y: y + 14 }, { x: cx - 80, y: y + 148 }, 3), SNAKE_PAL[0], 1.2);
}
// One continuous scrolling reader: every section (title, illustration, text) in order; drag, wheel, keys and the scroll bar move it.
const flowCache = new Map();
function pageFlow(ctx, list, scale, textMaxW) {
  const key = `${list === ABOUT ? 'a' : list === HOWTO ? 'h' : 'r'}|${scale}|${Math.round(textMaxW)}`;
  let f = flowCache.get(key); if (f) return f;
  const fontPx = Math.round(Math.max(29, 34 - 5 * (scale - 1)) * scale), LH = Math.round(fontPx * 1.25), titlePx = Math.round(31 * Math.min(scale, 1.3)), TH = Math.round(titlePx * 1.2);
  const secs = []; let h = 12;
  for (const page of list) {
    ctx.font = `700 ${titlePx}px ${FONT}`; const tLines = wrapLines(ctx, page.title, textMaxW);
    ctx.font = `400 ${fontPx}px ${FONT}`; const lines = []; for (const l of page.lines) lines.push(...wrapLines(ctx, l, textMaxW));
    const figH = page.fig ? 168 : 0, sh = tLines.length * TH + 14 + figH + fontPx * 0.8 + lines.length * LH;
    secs.push({ page, tLines, lines, y: h, figH }); h += sh + 36;
  }
  f = { secs, total: h, fontPx, LH, titlePx, TH }; flowCache.set(key, f); if (flowCache.size > 40) flowCache.delete(flowCache.keys().next().value);
  return f;
}
export function renderPage(ctx, state, L, list, title) {
  drawBackdrop(ctx, L.w, L.h);
  const scale = scaleOf(state), P = L.refPanel, panelW = P.w, textMaxW = panelW - 70;
  const F = pageFlow(ctx, list, scale, textMaxW);
  const ph = P.maxH, pr = { x: P.x, y: P.y, w: panelW, h: ph }, cx = P.x + panelW / 2, viewH = ph - 92;
  panel(ctx, pr, { top: 'rgba(46,30,16,0.85)', bot: 'rgba(20,10,7,0.9)' });
  const pageMax = Math.max(0, F.total - viewH), scroll = Math.max(0, Math.min(state.ui.scroll, pageMax));
  ctx.textAlign = 'center'; ctx.fillStyle = '#f4ead6'; ctx.font = `700 ${Math.round(38 * Math.min(scale, 1.15))}px ${FONT}`; ctx.fillText(title, cx, pr.y + 54);
  ctx.strokeStyle = 'rgba(244,234,214,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pr.x + 60, pr.y + 78); ctx.lineTo(pr.x + pr.w - 60, pr.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(pr.x + 4, pr.y + 84, pr.w - 8, ph - 92); ctx.clip(); ctx.translate(0, -scroll);
  const top = pr.y + 90, vis0 = scroll - 200, vis1 = scroll + viewH + 200;
  for (const sec of F.secs) {
    if (sec.y + 600 < vis0 || sec.y > vis1 + 400) continue;
    let y = top + sec.y;
    ctx.font = `700 ${F.titlePx}px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.textAlign = 'center';
    for (const l of sec.tLines) { ctx.fillText(l, cx, y + F.titlePx * 0.8); y += F.TH; }
    y += 14;
    if (sec.page.fig) { drawFig(ctx, state, sec.page.fig, cx, y); y += sec.figH; }
    ctx.font = `400 ${F.fontPx}px ${FONT}`; ctx.fillStyle = '#f7eeda'; y += F.fontPx * 0.8;
    for (const l of sec.lines) { ctx.fillText(l, cx, y); y += F.LH; }
  }
  ctx.restore();
  if (pageMax > 0) { const th = Math.max(40, (viewH - 8) * viewH / F.total), ty = pr.y + 88 + (viewH - 8 - th) * (scroll / pageMax); ctx.fillStyle = 'rgba(244,222,180,0.45)'; ctx.fillRect(pr.x + pr.w - 12, ty, 5, th); }
  const cy = L.refCounterY;
  ctx.font = `italic 400 18px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(244,222,180,0.6)'; ctx.fillText(pageMax > 0 ? (scroll >= pageMax - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', L.w / 2, cy);
  drawButton(ctx, L.refWide, 'Back', { primary: true, fontPx: 30 });
  drawButton(ctx, L.zoom.dec, 'A−', { fontPx: 30, disabled: state.textIdx === 0 });
  drawButton(ctx, L.zoom.inc, 'A+', { fontPx: 30, disabled: state.textIdx === TEXT_SCALES.length - 1 });
  return pageMax;
}

// Draws the current scene. Returns the scrolling list layout when the scene has one (game.js hit-tests it).
export function render(ctx, state, L) {
  setArtRes(ctx); setPress(state.press ?? null);
  const sc = state.scene;
  let lay = null;
  const listScene = sc === 'title' || sc === 'setup' || sc === 'settings' || sc === 'demo-limit' || (sc === 'play' && state.over) || (sc === 'demo' && state.demo.finished) || state.msgOpen;
  if (listScene) lay = listFor(ctx, state, L);
  const dim = () => { ctx.fillStyle = state.msgOpen ? 'rgba(8,4,2,0.95)' : 'rgba(8,4,2,0.86)'; ctx.fillRect(0, 0, L.w, L.h); drawParticles(ctx, state, true); drawList(ctx, lay, state.ui.scroll); };
  if (sc === 'play') {
    renderBoardScene(ctx, state, L, false);
    if (state.over || state.msgOpen) dim();
  } else if (sc === 'demo') {
    renderBoardScene(ctx, state, L, true);
    if (state.demo.finished || state.msgOpen) dim();
  } else if (sc === 'howto' || sc === 'about' || sc === 'rules') {
    const pm = renderPage(ctx, state, L, sc === 'howto' ? HOWTO : sc === 'about' ? ABOUT : RULES, sc === 'howto' ? 'How to Play' : sc === 'about' ? 'About' : 'Rules');
    lay = { rows: [], total: pm + 100, G: { x: 0, w: L.w, top: 0, bottom: 100 }, side: 0 };   // lets the shared list drag-scroll move the page text
  }
  else {
    drawBackdrop(ctx, L.w, L.h);
    if (sc === 'title' && L.titleSplit) { const H = L.titleHero; ctx.save(); ctx.translate(H.x, H.y); drawHero(ctx, state, H.w, H.h, heroDy(L)); ctx.restore(); }
    drawList(ctx, lay, state.ui.scroll);
    if (sc === 'title') bar(ctx, state, L, 'Menu');
    else if (sc === 'setup') bar(ctx, state, L, 'New game');
    else if (sc === 'settings') bar(ctx, state, L, 'Settings');
  }
  return lay;
}
