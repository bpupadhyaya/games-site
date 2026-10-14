// The play screen: room, floor, header board, beat strip, the call card, Call it, Think and Pause, hint and Watch & Learn notes, banners.
// Pure drawing from the game state G; hit-testing uses the same rectangles (playLayout / watchRects).
import { live, MIN_FONT, playLayout, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, paintButton, wrapLines, panel, textShadow, fitPx } from './ui.js';
import { drawFloor, drawRoom } from './scene.js';
import { CALL_BY_ID, SWING, COUPLES, BEATS, PACES } from './consts.js';
import { apply, homeCount, dancerAt, slotPos } from './sim.js';

const TAU = Math.PI * 2;
const small = (ctx, px, wt = 400) => { ctx.font = `${wt} ${Math.max(MIN_FONT, Math.round(px))}px ${FONT}`; };
function pill(ctx, x, y, w, h, fill = 'rgba(24,14,44,0.82)', stroke = 'rgba(255,255,255,0.22)') {
  roundPath(ctx, x, y, w, h, Math.min(24, h / 2)); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
}
export function watchRects(L) {
  const r = L.callIt, g = 8, bw = Math.floor((r.w - 3 * g) / 4);
  return [0, 1, 2, 3].map((k) => ({ x: r.x + k * (bw + g), y: r.y, w: bw, h: r.h }));
}
export function noteArea(L) {
  const y = L.cards.length ? Math.min(...L.cards.map((c) => c.y)) : L.strip.y + L.strip.h + 8, x = L.cards.length ? Math.min(...L.cards.map((c) => c.x)) : L.callIt.x;
  const x1 = L.cards.length ? Math.max(...L.cards.map((c) => c.x + c.w)) : L.callIt.x + L.callIt.w;
  return { x, y, w: x1 - x, h: L.callIt.y - 10 - y };
}
export const baseOf = (sq) => (sq.cur ? sq.cur.to : sq.arr);

// everything drawFloor needs
export function buildInfo(G, L) {
  const sq = G.sq, t = G.t;
  const dancers = [], lit = new Array(8).fill(false);
  const beatFrac = sq.phase === 'dance' ? ((sq.clock / sq.beatLen) % 1) : ((t * 1.5) % 1);
  const bob = Math.abs(Math.sin(t * 3.2)) * 0.1;
  if (sq.cur) {
    const u = Math.min(1, sq.cur.t / sq.cur.dur), call = sq.cur.call;
    for (let a = 0; a < 8; a++) {
      const id = sq.cur.from[a], b = call.to[a], p = dancerAt(call, a, b, u);
      const reach = (call.kind === 'swing' || call.kind === 'rlt' || call.kind === 'chain') ? 0.5 : 0.2;
      dancers.push({ id, x: p.x, y: p.y, face: p.face, step: p.step, spin: p.spin + t, reach, lift: bob * 0.4 * p.step });
    }
    const done = u > 0.94 ? sq.cur.to : sq.cur.from;
    for (let s = 0; s < 8; s++) lit[s] = done[s] === s;
  } else {
    for (let s = 0; s < 8; s++) {
      const p = slotPos(s), id = sq.arr[s];
      let sc = 1, lift = bob * 0.2;
      if (sq.phase === 'fin') { const k = Math.max(0, sq.finT - 1.0); sc = 1 + 0.1 * Math.sin(Math.min(1, k / 0.8) * Math.PI); lift = bob * 0.8; }
      dancers.push({ id, x: p.x, y: p.y, face: Math.atan2(-p.y, -p.x), step: sq.phase === 'fin' ? 0.5 : 0.1, spin: t * 0.4, reach: sq.phase === 'fin' ? 0.9 : 0.1, scale: sc, lift });
      lit[s] = id === s;
    }
  }
  const base = baseOf(sq);
  const ghosts = sq.cur && sq.phase === 'dance' ? base.map((id, slot) => ({ slot, id })) : null;
  let arrows = null;
  if (sq.sel && sq.phase !== 'fin' && sq.phase !== 'fail') {
    const c = CALL_BY_ID[sq.sel];
    arrows = [];
    for (let s = 0; s < 8; s++) {
      const to = c.to[s];
      if (to === s) continue;
      const a = slotPos(s), b = slotPos(to), L2 = Math.hypot(b.x - a.x, b.y - a.y) || 1, sh = 0.17;
      const ux = (b.x - a.x) / L2, uy = (b.y - a.y) / L2;
      arrows.push({ from: { x: a.x + ux * sh, y: a.y + uy * sh }, to: { x: b.x - ux * sh * 1.2, y: b.y - uy * sh * 1.2 }, id: base[s], bend: c.kind === 'rot' || c.kind === 'star' || c.kind === 'grand' ? 0.28 : 0.1 });
    }
  }
  return { look: sq.look, time: t, beat: beatFrac, dancers, lit, ghosts, arrows, glow: sq.glow || 0, confetti: sq.confetti, tags: true, p3: G.has3d, call: sq.cur ? sq.cur.call.kind : null, to: sq.cur ? sq.cur.call.to : null, callId: sq.cur ? sq.cur.call.id : null, dur: sq.cur ? sq.cur.dur : 0, n: sq.cur ? (sq.cur.call.n || 0) : 0, u: sq.cur ? Math.min(1, sq.cur.t / sq.cur.dur) : 0, phase: sq.phase, mode: G.mode, paused: !!(G.paused || G.pauseMenu) };
}

function cells(ctx, x, y, w, sq) {
  const n = BEATS, gap = (w - 4) / n, ch = 26;
  const cur = sq.phase === 'dance' ? Math.floor(sq.clock / sq.beatLen) % n : -1;
  for (let i = 0; i < n; i++) {
    const cx = x + 2 + i * gap, on = i === cur;
    roundPath(ctx, cx + 2, y - ch / 2, gap - 4, ch, 8);
    ctx.fillStyle = on ? '#ffd45a' : sq.phase === 'dance' && i < cur ? 'rgba(255,214,90,0.35)' : 'rgba(255,255,255,0.12)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.3)'; ctx.stroke();
  }
}

function btnIcon(ctx, r, glyph) {
  paintButton(ctx, r, { dark: true });
  ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.fillStyle = '#fff6e4';
  const k = r.w / 76;
  if (glyph === 'pause') { ctx.fillRect(-14 * k, -16 * k, 10 * k, 32 * k); ctx.fillRect(4 * k, -16 * k, 10 * k, 32 * k); }
  else { ctx.font = `800 ${Math.round(40 * k)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 2); }
  ctx.restore();
}

// a quiet backdrop while the 3D hall loads (instead of a short flash of the 2D floor)
export function veil(ctx, W, H, cx, cy) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d1033'); g.addColorStop(1, '#2c1a45');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `700 ${MIN_FONT + 2}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Setting up the hall…', cx, cy); ctx.restore();
}

// the first candidate text that fits the width at the smallest allowed size (else the last, shortest one)
function pickFit(ctx, list, weight, maxW) {
  ctx.font = `${weight} ${MIN_FONT}px ${FONT}`;
  for (const t of list) if (ctx.measureText(t).width <= maxW) return t;
  return list[list.length - 1];
}

export function renderHud(ctx, G) {
  const W = live.w, H = live.h, sq = G.sq;
  const L = playLayout(G.settings.textIdx, sq.card.length);
  G.L = L;
  ctx.clearRect(0, 0, W, H);
  const info = buildInfo(G, L);
  const waiting = G.wait3d && !G.has3d;
  if (waiting) veil(ctx, W, H, L.floor.x + L.floor.w / 2, L.floor.y + L.floor.h / 2);
  else { if (!G.has3d) drawRoom(ctx, W, H, sq.look, G.t, info.beat); drawFloor(ctx, L.floor, info); }
  const mode = G.mode, base = baseOf(sq);

  // header board
  const B = L.board;
  pill(ctx, B.x, B.y, B.w, B.h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const home = homeCount(sq.phase === 'dance' ? base : sq.arr);
  const t1 = mode === 'marathon' ? `Endless · square ${G.round.n + 1}` : mode === 'tips' || mode === 'watch' || mode === 'shot' ? `${sq.title} · square ${sq.k + 1}` : mode === 'drill' ? sq.title : 'Practice';
  const bw = B.w - 20;
  const t2 = pickFit(ctx, [`Home ${home}/8  ·  phrase ${sq.used + sq.hint} of ${sq.cap}`, `Home ${home}/8 · phrase ${sq.used + sq.hint}/${sq.cap}`, `${home}/8 home · ${sq.used + sq.hint}/${sq.cap}`], 800, bw);
  const f1 = fitPx(ctx, t1, 700, 26, bw, MIN_FONT), f2 = fitPx(ctx, t2, 800, 32, bw, MIN_FONT);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `700 ${f1}px ${FONT}`; ctx.fillText(t1, B.x + B.w / 2, B.y + B.h * 0.4);
  ctx.fillStyle = '#fff'; ctx.font = `800 ${f2}px ${FONT}`; ctx.fillText(t2, B.x + B.w / 2, B.y + B.h * 0.4 + f2 * 1.05);
  btnIcon(ctx, L.pause, 'pause');
  if (mode !== 'watch' && sq.phase !== 'fin' && sq.phase !== 'fail' && !G.think) btnIcon(ctx, L.think, 'think');

  // beat strip
  const S = L.strip;
  pill(ctx, S.x, S.y, S.w, S.h, 'rgba(24,14,44,0.7)');
  const cw0 = Math.min(S.w * (S.w < 420 ? 0.4 : 0.46), 330);
  cells(ctx, S.x + 12, S.y + S.h / 2, cw0, sq);
  const tx = S.x + 12 + cw0 + 14, tw = S.x + S.w - 12 - tx;
  let msg = '';
  if (sq.phase === 'ready') msg = 'Tap a call to begin';
  else if (sq.phase === 'fin') msg = 'Resolved!';
  else if (sq.phase === 'fail') msg = 'The tip ran out';
  else if (sq.queued) msg = `Next: ${CALL_BY_ID[sq.queued].short}`;
  else if (sq.phase === 'wait' || mode === 'watch') msg = sq.cur ? `Now: ${sq.cur.call.short}` : 'Waiting for the call';
  else msg = sq.cur ? `Now: ${sq.cur.call.short}` : 'Choose a call';
  msg = pickFit(ctx, [msg, msg.replace(/^Tap a call to begin$/, 'Tap a call').replace(/^Now: /, '').replace(/^Next: /, '> ')], 700, tw);
  const mf = fitPx(ctx, msg, 700, 26, tw, MIN_FONT);
  ctx.font = `700 ${mf}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = sq.queued ? '#ffd45a' : '#fff';
  ctx.fillText(msg, tx, S.y + S.h / 2 + 1);

  // the call card
  const guide = !G.settings.guide, watching = mode === 'watch';
  const canPlay = sq.phase !== 'fin' && sq.phase !== 'fail';
  const noteOpen = !!G.think || (watching && (G.watch.phase === 'think' || G.watch.phase === 'reveal'));
  if (!noteOpen) {
    sq.card.forEach((id, i) => {
      const c = CALL_BY_ID[id], r = L.cards[i];
      const isQ = sq.queued === id, isS = sq.sel === id;
      const after = homeCount(apply(base, c));
      drawButton(ctx, r, c.short, { primary: isQ, active: isS && !isQ, dark: !isQ && !isS, size: 26, sub: guide ? `${after} home` : null, disabled: !canPlay });
      if (G.settings.sound && !watching && i < 9) {
        ctx.save(); ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(String(i + 1), r.x + 10, r.y + 6); ctx.restore();
      }
    });
  }
  if (!watching) {
    const sel = sq.sel ? CALL_BY_ID[sq.sel] : null;
    drawButton(ctx, L.callIt, 'Call it!', { primary: true, size: 34, sub: sel ? sel.label : 'Tap a call first', disabled: !sel || !canPlay });
  }

  // banners
  if (sq.phase === 'fin' || sq.phase === 'fail') {
    const f = Math.min(1, Math.max(0, sq.finT / 0.4)), e = 1 - Math.pow(1 - f, 3);
    const fl = L.floor, cx = fl.x + fl.w / 2, cy = fl.y + fl.h * 0.5;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.globalAlpha = Math.min(1, e * 1.4);
    const word = sq.phase === 'fin' ? 'EVERYONE HOME!' : 'TIP OVER';
    ctx.font = `900 100px ${DISPLAY}`;
    const fs = Math.max(MIN_FONT, Math.min(86, Math.floor(100 * (fl.w - 50) / (ctx.measureText(word).width + 24))));
    ctx.font = `900 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(14,6,30,0.88)';
    ctx.strokeText(word, 0, 0); ctx.fillStyle = sq.phase === 'fin' ? '#ffd45a' : '#ff9a8a'; ctx.fillText(word, 0, 0);
    if (sq.phase === 'fin' && sq.stars > 0 && mode !== 'watch') {
      small(ctx, 48, 800); ctx.lineWidth = 8; const st = '★'.repeat(sq.stars) + '☆'.repeat(3 - sq.stars);
      ctx.strokeText(st, 0, 62); ctx.fillStyle = '#ffd45a'; ctx.fillText(st, 0, 62);
    }
    ctx.restore();
  }
  if (G.think) renderThink(ctx, G, L);
  if (watching) renderWatch(ctx, G, L);
  if (G.hintMsg) { small(ctx, 24, 700); ctx.textAlign = 'center'; textShadow(ctx, G.hintMsg, L.floor.x + L.floor.w / 2, L.floor.y + 34, '#fff', 6); }
}

function noteBox(ctx, L, lines, title) {
  const A = noteArea(L), w = Math.min(A.w, 700), x = Math.round(A.x + (A.w - w) / 2);
  let fs = 26, wrapped;
  for (; fs >= MIN_FONT; fs -= 2) {
    ctx.font = `400 ${fs}px ${FONT}`;
    wrapped = lines.flatMap((l) => wrapLines(ctx, l, w - 40));
    if (28 + fs * 1.4 + wrapped.length * fs * 1.28 + 16 <= A.h) break;
  }
  if (fs < MIN_FONT) fs = MIN_FONT;
  const maxLines = Math.max(2, Math.floor((A.h - 44 - fs * 1.4) / (fs * 1.28)));
  if (wrapped.length > maxLines) wrapped = wrapped.slice(0, maxLines);
  const h = Math.min(A.h, 28 + fs * 1.4 + wrapped.length * fs * 1.28 + 16);
  panel(ctx, x, A.y, w, h, { r: 22, fill: 'rgba(22,12,40,0.93)', stroke: 'rgba(255,255,255,0.35)' });
  let yy = A.y + 24 + fs * 0.9;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillStyle = '#ffd45a'; ctx.fillText(title, x + 20, yy);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff';
  for (const l of wrapped) { yy += fs * 1.28; ctx.fillText(l, x + 20, yy - fs * 0.2); }
  return { x, y: A.y, w, h };
}

function renderThink(ctx, G, L) {
  const th = G.think;
  noteBox(ctx, L, th.lines, 'Think');
  const r = L.callIt;
  drawButton(ctx, r, 'Carry on', { primary: true, size: 32 });
  G.thinkRects = { close: r };
}

function renderWatch(ctx, G, L) {
  const wt = G.watch, rects = watchRects(L), st = G.settings, sq = G.sq;
  if (wt.lines && wt.lines.length && (wt.phase === 'think' || wt.phase === 'reveal') && sq.phase !== 'fin') {
    const n = wt.phase === 'reveal' ? wt.lines.length : Math.max(1, Math.min(wt.lines.length, Math.ceil(wt.lines.length * (1 - wt.timer / Math.max(0.1, THINK_STEPS[st.thinkIdx])) + 0.001)));
    noteBox(ctx, L, wt.lines.slice(0, n), wt.phase === 'think' ? `Thinking...  ${Math.ceil(wt.timer)}` : 'Reveal');
  }
  const labels = [wt.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Stop'];
  const subs = [wt.paused ? 'Paused' : '', `${THINK_STEPS[st.thinkIdx]} s`, `${THINK_STEPS[st.thinkIdx]} s`, ''];
  rects.forEach((r, i) => drawButton(ctx, r, labels[i], { primary: i === 0 && wt.paused, dark: !(i === 0 && wt.paused), size: 24, disabled: (i === 1 && st.thinkIdx === 0) || (i === 2 && st.thinkIdx === THINK_STEPS.length - 1), sub: i === 1 || i === 2 ? subs[i] : null }));
  if (wt.paused) { small(ctx, 30, 800); ctx.textAlign = 'center'; textShadow(ctx, 'PAUSED', L.floor.x + L.floor.w / 2, L.floor.y + 48, '#ffd45a', 8); }
}
