// Everything drawn each frame. Reads `state` (see game.js) and changes nothing. Static art is cached (art.js).
import { SLAB, cellCenter, cellSize, stoneRadius, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawBackdrop, drawSlab, drawStone, drawPetals, drawSquareRing, stoneVariant } from './art.js';
import { jumpsFrom, legalMoves, stones, countMoves, overSquares } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HELP_PAGES, RULES } from './content.js';
import { drawCredit, drawTitleLockup, drawLockup, drawMoreLine } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const SIDE = { 1: 'Black', 2: 'White' };
const PAGE_TEXT = '#fff3d6', GOLD = '#ffd98a';

// The reference pages scroll; the view measures them while drawing and game.js reads these limits.
export const pageMetrics = { max: 0, view: 0 };
// Reader layout cache (wrapped lines + total height). readerStats.layouts counts how often it was rebuilt (tests read it).
const readerCache = { pages: null, key: '', items: [], endY: 0 };
export const readerStats = { layouts: 0, items: [] };   // items: the laid-out document (the layout test checks its blocks never overlap)
const DEMO_H = 96 + 20, STONES_H = 46 * 2 + 76;
// minF = the smallest font (virtual units) that is still ~11 css px on this screen; text never goes below it.
export function makeText(ctx, minF = 0) {
  const mf = (s) => Math.max(s, minF);
  const text = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${mf(size)}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const lines = (str, size, maxW, weight = 600, font = UI) => {
    ctx.font = `${weight} ${mf(size)}px ${font}`; const out = []; let cur = '';
    for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = PAGE_TEXT, lh = size * 1.32, align = 'center', weight = 600) => { const ls = lines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const shadowText = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { text(str, x + 2, y + 3, size, 'rgba(0,0,0,0.55)', font, weight, align); text(str, x, y, size, color, font, weight, align); };
  // text shrunk (never below the readable minimum) until it fits maxW
  const fit = (str, x, y, size, maxW, color, font = UI, weight = 700, align = 'center') => {
    let s = size; ctx.font = `${weight} ${mf(s)}px ${font}`; while (s > 12 && mf(s) > minF + 0.01 && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = `${weight} ${mf(s)}px ${font}`; }
    text(str, x, y, s, color, font, weight, align);
  };
  return { text, lines, wrap, shadowText, fit, mf };
}

// A crafted button: a slab of dark basalt with a lit top edge and a cream tapa line, or a sunrise-gold primary.
export function button(ctx, tx, r, label, o = {}) {
  ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
  const rad = Math.min(20, r.h * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (o.primary) { g.addColorStop(0, '#ffd486'); g.addColorStop(0.55, '#f2905a'); g.addColorStop(1, '#d4553a'); } else if (o.on) { g.addColorStop(0, '#7a5a4c'); g.addColorStop(1, '#3d2a26'); } else { g.addColorStop(0, '#5a4c4e'); g.addColorStop(1, '#2a2022'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
  ctx.strokeStyle = o.primary ? 'rgba(255,240,200,0.9)' : o.on ? 'rgba(255,217,138,0.95)' : 'rgba(255,214,170,0.45)'; ctx.lineWidth = o.on ? 3 : 2; ctx.stroke();
  const size = Math.min(o.size ?? 30, r.h * 0.5);
  tx.fit(label, r.x + r.w / 2, r.y + r.h / 2 + Math.max(size, tx.mf(0)) * 0.35, size, r.w - 22, o.primary ? '#2a1208' : PAGE_TEXT, UI, 700);
  ctx.restore();
}
function panel(ctx, x, y, w, h, a = 0.7) {
  ctx.fillStyle = `rgba(16,9,14,${a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,170,0.45)'; ctx.lineWidth = 2; ctx.stroke();
}
// The reader card behind a text-heavy reference page (How to play, About, Rules): the same dark
// basalt panel plus a fainter inset line, so a page of body text reads as a designed reference
// sheet rather than loose text floating on the backdrop.
function readerCard(ctx, x, y, w, h) {
  panel(ctx, x, y, w, h, 0.76);
  ctx.strokeStyle = 'rgba(255,214,170,0.16)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 18); ctx.stroke();
}

// Where the moving stone is: a hop is an arc from square to square; the stone pauses a beat at each landing.
export function animPos(n, a, calm) {
  const per = a.dur / (a.path.length - 1), k = Math.min(a.path.length - 2, Math.floor(a.t / per)), f = Math.min(1, (a.t - k * per) / per), e = f * f * (3 - 2 * f);
  const p = cellCenter(n, a.path[k]), q = cellCenter(n, a.path[k + 1]);
  return { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e, lift: Math.sin(Math.PI * f) * (calm ? 0.5 : 1.3), hop: k + f };
}

// The stones of game `g` (and the animation `a`) on the slab in slab coordinates. Used by the play screen and the title demo.
export function drawStones(ctx, g, a, o = {}) {
  const n = g.n, R = stoneRadius(n);
  for (let i = 0; i < g.b.length; i++) {
    const k = g.b[i]; if (!k) continue;
    if (a && a.type === 'jump' && i === a.path[a.path.length - 1]) continue;            // the moving stone is drawn on its path
    const p = cellCenter(n, i);
    drawStone(ctx, k, p.x, p.y, R, { v: stoneVariant(i), lift: o.sel === i ? 0.75 + (o.calm ? 0 : Math.sin(o.t * 4) * 0.08) : 0, glow: o.sel === i ? '255,226,140' : null, alpha: a && a.type === 'refuse' && a.from === i ? 0 : 1 });
  }
  if (!a) return;
  if (a.type === 'jump') {
    const pos = animPos(n, a, o.calm);
    a.caps.forEach((c, j) => {                                                       // a captured stone waits until the mover passes, then is tossed away
      const p = cellCenter(n, c.at), f = Math.max(0, pos.hop - (j + 0.5)) / 0.55;
      if (f >= 1) return;
      drawStone(ctx, c.kind, p.x + f * (c.side * 14), p.y - f * 40 * (o.calm ? 0.3 : 1), R * (1 - f * 0.25), { v: stoneVariant(c.at), alpha: 1 - f, lift: f * 0.8 });
    });
    if (!o.calm && pos.hop > 0.5) for (let j = 0; j < a.caps.length; j++) {              // a ring of dust at each hop's landing
      const f = pos.hop - (j + 1); if (f < 0 || f > 0.6) continue; const p = cellCenter(n, a.path[j + 1]);
      ctx.strokeStyle = `rgba(255,236,200,${0.6 * (1 - f / 0.6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y + R * 0.3, R * (0.8 + f * 1.2), R * (0.5 + f * 0.7), 0, 0, TAU); ctx.stroke();
    }
    drawStone(ctx, a.kind, pos.x, pos.y, R, { v: stoneVariant(a.path[0]), lift: pos.lift });
  } else if (a.type === 'remove') {
    const f = Math.min(1, a.t / a.dur), p = cellCenter(n, a.at);
    drawStone(ctx, a.kind, p.x, p.y - f * 50 * (o.calm ? 0.3 : 1), R * (1 - 0.2 * f), { v: stoneVariant(a.at), alpha: 1 - f, lift: f });
  } else if (a.type === 'refuse') {
    const f = Math.min(1, a.t / a.dur), p = cellCenter(n, a.from), q = cellCenter(n, a.to);
    const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * 0.55;
    const shake = o.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 4 : 0;
    drawStone(ctx, a.kind, p.x + (q.x - p.x) * e + shake, p.y + (q.y - p.y) * e, R, { v: stoneVariant(a.from), lift: 0.5 });
  }
}

// A tray of captured stones. The stones shrink (never overflow) to fit however many were taken.
function tray(ctx, tx, r, kind, label, got, per) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 26); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#2a2223'); g.addColorStop(1, '#4a3f3e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 26); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,170,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  const lh = Math.max(26, tx.mf(19) + 8), well = { x: r.x + 10, y: r.y + lh + 4, w: r.w - 20, h: r.h - lh - 14 };
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(well.x, well.y, well.w, well.h, 18); ctx.fill();
  tx.fit(`${label}: ${got}`, r.x + r.w / 2, r.y + lh - 2, 19, r.w - 24, 'rgba(255,224,178,0.9)', UI, 600);
  let rad = 13, cols = 1, rows = 1;
  for (; rad >= 5; rad -= 0.5) { cols = Math.max(1, Math.floor((well.w - 12) / (rad * 1.9))); rows = Math.ceil(per / cols); if (rows * rad * 2.1 <= well.h - 6) break; }
  const sx = (well.w - cols * rad * 1.9) / 2 + rad * 0.95, sy = (well.h - rows * rad * 2.1) / 2 + rad * 1.05;
  for (let q = 0; q < got; q++) drawStone(ctx, kind, well.x + sx + (q % cols) * rad * 1.9, well.y + sy + Math.floor(q / cols) * rad * 2.1 + (q % 2) * 2, rad, { v: q, shadow: false });
}

export function render(ctx, state, L) {
  const w = L.w, h = L.h, tx = makeText(ctx, L.minFont), { text, wrap, shadowText, lines } = tx, btn = (r, l, o) => button(ctx, tx, r, l, o);
  const scene = state.scene, autoOn = scene === 'auto' && state.auto, D0 = state.auto;
  const g = autoOn ? D0.game : state.game, big = state.textScaleIdx > 0, calm = state.calm, t = state.t;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'auto' || (scene === 'puzzle' && state.pz.status !== 'making');
  const B = L.board, BT = L.BTN;
  drawBackdrop(ctx, w, h, L.hz, t, calm);
  // Drifting petals right after the backdrop, before any board/panel/button is painted over them, so they only ever show in the open
  // sky/sea backdrop, never over anything readable.
  if (!calm) drawPetals(ctx, t, w, h);

  if (boardScene) {
    const n = g.n, a = autoOn ? D0.anim : state.anim, R = stoneRadius(n), pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 6);
    // ---- header ----
    drawHeader(ctx, tx, state, L, g, scene, autoOn ? D0 : null, big);
    // ---- board (canonical coordinates inside the board transform) ----
    ctx.save(); ctx.translate(B.x, B.y); ctx.scale(B.s, B.s); ctx.translate(-SLAB.x, -SLAB.y);
    drawSlab(ctx, n);
    if (g.ply < 2 && !a && !g.winner && (scene === 'play' || scene === 'lesson') && state.canAct) for (const m of legalMoves(g)) { const p = cellCenter(n, m.at); drawSquareRing(ctx, p.x, p.y, R * 1.05, '255,216,120', 0.6 + pulse * 0.4, 0.3); }
    if (state.sel >= 0 && !a) {
      for (const m of jumpsFrom(g, state.sel)) {
        const p = cellCenter(n, m.to), hops = overSquares(n, m.from, m.to).length;
        drawSquareRing(ctx, p.x, p.y, R * 0.96, hops > 1 ? '255,150,110' : '255,216,120', 0.55 + pulse * 0.4, 0.28);
        if (hops > 1) text(`x${hops}`, p.x, p.y + 9, Math.round(R * 0.72), '#fff', UI, 800);
      }
    } else if (scene !== 'auto' && state.marks && !a && state.canAct && !g.winner && g.ply >= 2 && state.sel < 0) {
      for (let i = 0; i < g.b.length; i++) if (g.b[i] === g.turn && jumpsFrom(g, i).length) { const p = cellCenter(n, i); ctx.strokeStyle = `rgba(255,222,140,${0.35 + pulse * 0.4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R * 1.08, 0, TAU); ctx.stroke(); }
    }
    if (state.hint && !a) for (const sq of [state.hint.from, state.hint.to]) if (sq >= 0) { const p = cellCenter(n, sq); drawSquareRing(ctx, p.x, p.y, R * 1.05, '120,255,170', 0.6 + pulse * 0.4, 0.3); }
    if (scene === 'lesson' && !state.lesson.done && !a) for (const sq of LESSONS[state.lesson.i].mark || []) { const p = cellCenter(n, sq); drawSquareRing(ctx, p.x, p.y, R * 1.15, '140,210,255', 0.5 + pulse * 0.4, 0.15); }
    // REVEAL phase of Auto Play: show every legal option (dim gold ring), then the ONE move about to be played highlighted much more
    // strongly (bright green ring, plus the source square for a jump), so a watcher can compare their own guess against it.
    if (autoOn && D0.phase === 'reveal' && D0.moves) {
      const chosenAt = (m) => m.type === 'remove' ? m.at === D0.chosen.at : m.to === D0.chosen.to && m.from === D0.chosen.from;
      for (const m of D0.moves) {
        const sq = m.type === 'remove' ? m.at : m.to, isChosen = D0.chosen && D0.chosen.type === m.type && chosenAt(m);
        const p = cellCenter(n, sq);
        drawSquareRing(ctx, p.x, p.y, R * (isChosen ? 1.14 : 0.95), isChosen ? '120,255,170' : '255,216,120', isChosen ? 0.75 + pulse * 0.25 : 0.32 + pulse * 0.18, isChosen ? 0.4 : 0.15);
      }
      if (D0.chosen && D0.chosen.type === 'jump') { const p = cellCenter(n, D0.chosen.from); drawSquareRing(ctx, p.x, p.y, R * 1.14, '120,255,170', 0.75 + pulse * 0.25, 0.4); }
    }
    drawStones(ctx, g, a, { sel: state.sel, calm, t });
    if (state.kb && scene !== 'over') { const c = cellCenter(n, state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(c.x - cellSize(n) / 2 + 3, c.y - cellSize(n) / 2 + 3, cellSize(n) - 6, cellSize(n) - 6, 10); ctx.stroke(); }
    ctx.restore();
    // ---- trays: stones taken from the slab are collected here ----
    if (L.trays && (scene === 'play' || scene === 'over')) {
      const per = (n * n) / 2;
      [[2, 'White stones taken', L.trays[0]], [1, 'Black stones taken', L.trays[1]]].forEach(([k, label, r]) => tray(ctx, tx, r, k, label, per - g.b.filter((v2) => v2 === k).length, per));
    }
    // ---- message + buttons ----
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5), ms = big ? 30 : 25, lh = big ? 38 : 32, r = L.msg;
      const ls = lines(state.msg.text, ms, r.w - 50), ph = 30 + ls.length * lh, my = L.msgBottom - ph;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(ctx, r.x, my, r.w, ph, 0.9); ls.forEach((ln, i) => text(ln, r.x + r.w / 2, my + 38 + i * lh, ms, PAGE_TEXT, UI, 600)); ctx.restore();
    }
    if (scene === 'play') { btn(BT.menu, 'Menu', { size: 26 }); btn(BT.undo, 'Take back', { size: 26 }); btn(BT.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { btn(BT.menu, 'Menu', { size: 26 }); if (state.lesson.done) btn(BT.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { btn(BT.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') btn(BT.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'auto' && D0.phase !== 'over') {
      const A = BT.auto;
      btn(A.exit, 'Exit', { size: 26 }); btn(A.skip, 'Skip wait', { size: 24, dim: D0.phase === 'act' || D0.paused });
      btn(A.pause, D0.paused ? 'Resume' : 'Pause', { size: 26, primary: D0.paused });
      btn(A.dec, '−', { size: 30, dim: state.autoThinkIdx === 0 }); btn(A.inc, '+', { size: 30, dim: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
    }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { shadowText("Preparing today's puzzle", w / 2, h / 2, 42); btn(BT.menu, 'Menu', { size: 26 }); }

  if (scene === 'title' || scene === 'demo-limit') {
    const T = L.title(!!state.saved), H0 = T.hero;
    if (H0.sc > 0) { ctx.save(); ctx.translate(H0.cx, H0.cy); ctx.scale(H0.sc, H0.sc); ctx.translate(-360, -760); drawSlab(ctx, 6); if (state.demo) drawStones(ctx, state.demo.g, state.demo.anim, { calm, t }); ctx.restore(); }
    shadowText('Konane', H0.titleX, H0.titleY, H0.titleSize); text('The jumping game of Hawaii', H0.tagX, H0.tagY, 30, 'rgba(255,232,196,0.95)', FONT, 600);
    if (T.lock) drawTitleLockup(ctx, T.lock, state.lockPress > 0, Math.max(16, L.minFont));
  }
  if (scene === 'title') {
    const T = L.title(!!state.saved), R = T.rows, S = T.sizes, solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) btn(R.resume, 'Continue your game', { primary: true, size: S.resume });
    btn(R.play, 'Play', { primary: state.learned && !R.resume, size: S.play });
    btn(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: S.learn });
    btn(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: S.daily });
    btn(R.how, 'How to play and controls', { size: S.how }); btn(R.about, 'About Konane', { size: S.about });
    btn(R.rules, 'Rules', { size: S.rules }); btn(R.auto, 'Auto Play', { size: S.auto });
    btn(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: S.sound, on: state.sound }); btn(R.calm, calm ? 'Calm: on' : 'Calm: off', { size: S.calm, on: calm }); btn(R.big, big ? 'Large text: on' : 'Large text', { size: S.big, on: big });
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, T.stats.x, T.stats.y, 22, 'rgba(255,232,196,0.8)', UI, 500);
    if (state.msg) wrap(state.msg.text, T.msg.x, T.msg.y, 24, T.msg.w, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    const py = h / 2 - 150;
    panel(ctx, w / 2 - 310, py, 620, 300); text('That was the free taste.', w / 2, py + 90, 44); wrap('Get Konane on iPhone and Android for unlimited games, all board sizes and every level.', w / 2, py + 150, 28, 540, PAGE_TEXT, 38);
    btn(BT.back, 'Menu', { size: 28 });
  } else if (scene === 'setup') {
    const C = state.cfg, S = L.setup, cx = w / 2;
    shadowText('New game', L.land ? cx : Math.max(420, cx + 60), S.titleY, 66); text('Choose your board, your side and the computer.', cx, S.subY, 26, 'rgba(255,232,196,0.9)', FONT, 600);
    panel(ctx, S.panel.x, S.panel.y, S.panel.w, S.panel.h, 0.62);
    const grp = (o) => text(o.t, o.x, o.y, 26, GOLD, UI, 700, 'left');
    grp(S.labelA);
    [6, 8, 10].forEach((v, i) => btn(S.sizes[i], `${v} x ${v}`, { size: 30, on: C.n === v }));
    wrap(C.n === 6 ? 'Quick game, a few minutes. The standard small board.' : C.n === 8 ? 'A fuller game with more room to plan.' : 'The long game: lots of room for double and triple jumps.', S.descA.x, S.descA.y, 22, S.descA.w, 'rgba(255,232,196,0.9)', 28);
    grp(S.labelB);
    btn(S.sides[0], 'Black', { size: 28, on: C.side === 1 }); btn(S.sides[1], 'White', { size: 28, on: C.side === 2 }); btn(S.sides[2], 'Two players', { size: 24, on: C.side === 0 });
    wrap(C.side === 1 ? 'Black opens and jumps first.' : C.side === 2 ? 'White answers the opening and jumps second.' : 'Pass the phone: Black and White take turns.', S.descB.x, S.descB.y, 22, S.descB.w, 'rgba(255,232,196,0.9)', 28);
    grp(S.labelC);
    LEVELS.forEach((Lv, i) => { btn(S.levels[i], `${Lv.name}${state.stats.badges[`${C.n}-${i}`] ? '  ★' : ''}`, { size: 28, on: C.level === i, dim: C.side === 0 }); });
    if (C.side !== 0) wrap(LEVELS[C.level].blurb, S.blurb.x, S.blurb.y, 22, S.blurb.w, 'rgba(255,232,196,0.9)', 28);
    btn(S.start, 'Start game', { primary: true, size: 36 }); btn(S.back, 'Back', { size: 26 });
  } else if (scene === 'help' || scene === 'about' || scene === 'rules') {
    drawPage(ctx, tx, state, L, scene, calm);
  } else if (scene === 'over' || (scene === 'auto' && D0.phase === 'over')) {
    const O = L.over, auto = scene === 'auto';
    ctx.fillStyle = 'rgba(8,4,10,0.72)'; ctx.fillRect(0, 0, w, h);
    const won = auto ? `${SIDE[g.winner]} wins` : state.two ? `${SIDE[g.winner]} wins` : g.winner === state.human ? 'You win!' : 'The computer wins';
    drawStone(ctx, g.winner, O.cx, O.stone.y, O.stone.r, { v: 1 });
    shadowText(won, O.cx, O.won.y, O.won.size); wrap(g.reason, O.cx, O.reason.y, 28, Math.min(w - 40, 640), PAGE_TEXT, 32, 'center', 500);
    text(`${g.moves} moves · Black ${stones(g, 1)} stones · White ${stones(g, 2)} stones`, O.cx, O.moves.y, 24, 'rgba(255,232,196,0.8)', UI, 500);
    if (auto) text('A full Auto Play demonstration just finished. Nothing here was saved.', O.cx, O.star.y, 22, GOLD, UI, 600);
    else if (!state.two && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten on the ${g.n}x${g.n} slab`, O.cx, O.star.y, 24, GOLD, UI, 600);
      if (!calm) for (let k = 0; k < 14; k++) { const ph = (t * 0.35 + k * 0.137) % 1, x = O.cx + Math.sin(k * 2.4) * (140 + 90 * ph), y = O.stone.y - 60 - ph * 400; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    btn(BT.again, auto ? 'Play again (auto)' : 'Play again', { primary: true, size: auto ? 30 : 34 }); btn(BT.back, auto ? 'Exit to menu' : 'Menu', { size: 30 });
    drawMoreLine(ctx, O.cx, O.moreY, Math.max(18, L.minFont));
  }
}

// ---- the header: whose move, mode, hint / lesson text. Portrait: the canonical phone panel. Landscape: a flowing info card. ----
function drawHeader(ctx, tx, state, L, g, scene, D, big) {
  const { text, wrap, shadowText, lines } = tx, n = g.n, t = state.t;
  // what to say (shared by both shapes)
  const C = { label: null, stone: null, title: null, titleSize: 44, center: false, sub: null, body: null, bodyColor: PAGE_TEXT, foot: null, footColor: 'rgba(255,224,178,0.85)' };
  if (scene === 'lesson') {
    const l = LESSONS[state.lesson.i];
    C.label = `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`; C.title = l.title; C.center = true; C.titleColor = '#ffe6b0';
    C.body = state.lesson.done ? l.done : l.text; C.bodyColor = state.lesson.done ? '#c9f7c0' : '#ffffff'; C.bodySize = big ? 30 : 26; C.bodyLh = big ? 38 : 33;
  } else if (scene === 'puzzle') {
    const P = state.pz;
    C.label = 'Daily puzzle'; C.stone = g.turn; C.title = `${SIDE[g.turn]} to move`; C.titleSize = 42;
    C.body = P.status === 'solved' ? `Solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow.` : 'Only ONE first jump wins by force. Find it.';
    C.bodySize = big ? 30 : 26; C.bodyLh = big ? 36 : 36; C.foot = `Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}   ·   ${n}x${n} board`; C.footColor = GOLD;
  } else if (scene === 'auto') {
    const thinkS = AUTO_THINK_STEPS[state.autoThinkIdx], phaseTxt = D.phase === 'think' ? 'thinking' : D.phase === 'reveal' ? 'about to play' : D.phase === 'act' ? 'playing' : 'game over';
    C.label = 'Auto Play · Watch & Learn'; C.stone = g.winner ? g.winner : g.turn; C.titleSize = 40;
    C.title = g.winner ? '' : D.paused ? 'Paused' : `${SIDE[g.turn]} is ${phaseTxt}${D.phase === 'think' ? '.'.repeat(1 + (Math.floor(t * 3) % 3)) : ''}`;
    C.sub = `${n}x${n} · silent demonstration`; C.subSize = 22;
    C.body = D.paused ? 'Frozen exactly where you paused it. Resume to keep watching.' : D.phase === 'think' ? 'THINK: work out your own answer before it is revealed.' : D.phase === 'reveal' ? 'REVEAL: the highlighted move is the one about to be played.' : 'ACT: watch it play out.'; C.bodySize = 22; C.bodyLh = 28;
    C.foot = `Think time: ${thinkS}s (max 10s)`; C.footColor = GOLD;
  } else {
    const mine = state.two || g.turn === state.human;
    C.stone = g.winner ? g.winner : g.turn;
    C.title = g.winner ? '' : state.two ? `${SIDE[g.turn]} to move` : mine ? `Your move (${SIDE[g.turn]})` : `Computer thinking${'.'.repeat(1 + (Math.floor(t * 3) % 3))}`;
    C.sub = state.two ? `Two players · ${n}x${n}` : `Computer: ${LEVELS[state.level].name} · ${n}x${n}`; C.subSize = 23;
    const hint = g.ply === 0 ? 'Black opens: tap a glowing black stone to remove it.' : g.ply === 1 ? 'White opens: tap a glowing white stone to remove it.' : '';
    if (hint && !g.winner) { C.body = hint; C.bodySize = 24; C.bodyLh = 30; }
    else if (!g.winner) { C.foot = `Black ${stones(g, 1)}  ·  White ${stones(g, 2)} stones   ·   jumps: ${countMoves(g, 1)} v ${countMoves(g, 2)}`; }
  }
  const r = L.hdr;
  if (!L.hdrWide) {
    // portrait: the canonical phone arrangement, shifted so the panel top sits at r.y
    const dy = r.y - 192;
    ctx.save(); ctx.translate(0, dy);
    ctx.fillStyle = 'rgba(14,8,16,0.58)'; ctx.beginPath(); ctx.roundRect(24, 192, 672, 214, 22); ctx.fill();
    if (L.titleY) shadowText('Konane', 420, 128, 62);
    if (C.label) text(C.label, 420, 176, 26, 'rgba(255,224,178,0.85)', UI, 600);
    if (scene === 'lesson') {
      shadowText(C.title, 360, 250, 44, C.titleColor); wrap(C.body, 360, 296, C.bodySize, 640, C.bodyColor, C.bodyLh);
    } else if (scene === 'puzzle') {
      drawStone(ctx, C.stone, 96, 262, 30, { v: 1 }); shadowText(C.title, 146, 272, 42, '#ffe6b0', FONT, 700, 'left');
      wrap(C.body, 64, 316, C.bodySize, 600, PAGE_TEXT, C.bodyLh, 'left'); text(C.foot, 64, 396, 24, GOLD, UI, 600, 'left');
    } else if (scene === 'auto') {
      drawStone(ctx, C.stone, 96, 236, 30, { v: 1 }); shadowText(C.title, 146, 248, 40, '#ffe6b0', FONT, 700, 'left');
      text(C.sub, 146, 288, 22, 'rgba(255,224,178,0.85)', UI, 500, 'left'); wrap(C.body, 64, 336, 22, 600, PAGE_TEXT, 28, 'left'); text(C.foot, 64, 396, 22, GOLD, UI, 600, 'left');
    } else {
      drawStone(ctx, C.stone, 96, 236, 30, { v: 1 }); shadowText(C.title, 146, 248, 44, '#ffe6b0', FONT, 700, 'left');
      text(C.sub, 146, 288, 23, 'rgba(255,224,178,0.85)', UI, 500, 'left');
      if (C.body) wrap(C.body, 64, 346, 24, 600, PAGE_TEXT, 30, 'left'); else if (C.foot) text(C.foot, 64, 372, 22, 'rgba(255,224,178,0.85)', UI, 600, 'left');
    }
    ctx.restore();
    return;
  }
  // landscape: a card; content flows from the top, scaled down a little if it does not fit
  ctx.fillStyle = 'rgba(14,8,16,0.62)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,170,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  const cx = r.x + r.w / 2, inner = r.w - 36, x0 = r.x + 18;
  const flow = (k, draw) => {
    let y = r.y + 16;
    if (C.label) { if (draw) text(C.label, cx, y + 22 * k + 2, 24 * k, 'rgba(255,224,178,0.85)', UI, 600); y += 38 * k; }
    if (C.title) {
      const ts = C.titleSize * 0.82 * k, ls = lines(C.title, ts, C.stone ? inner - 54 : inner, 700, FONT), lh = ts * 1.1, rowH = Math.max(lh * ls.length, 52);
      if (C.stone) {
        if (draw) { drawStone(ctx, C.stone, x0 + 24, y + rowH / 2, 25 * k + 4, { v: 1 }); ls.forEach((ln, i) => shadowText(ln, x0 + 60, y + (rowH - lh * ls.length) / 2 + ts * 0.8 + i * lh, ts, '#ffe6b0', FONT, 700, 'left')); }
        y += rowH + 6;
      } else { if (draw) ls.forEach((ln, i) => shadowText(ln, cx, y + ts * 0.8 + i * lh, ts, C.titleColor || '#ffe6b0', FONT, 700, 'center')); y += ls.length * lh + 10; }
    } else if (C.stone) { if (draw) drawStone(ctx, C.stone, x0 + 24, y + 26, 25 * k + 4, { v: 1 }); y += 56; }
    const al = C.center ? 'center' : 'left', ax = C.center ? cx : x0;
    if (C.sub) { const ss = (C.subSize || 23) * k, ls = lines(C.sub, ss, inner, 500); if (draw) ls.forEach((ln, i) => text(ln, ax, y + ss + i * ss * 1.25, ss, 'rgba(255,224,178,0.85)', UI, 500, al)); y += ls.length * ss * 1.25 + 14; }
    if (C.body) { const bs = (C.bodySize || 24) * k, lh = (C.bodyLh || bs * 1.3) * k, ls = lines(C.body, bs, inner, 600); if (draw) ls.forEach((ln, i) => text(ln, ax, y + bs + i * lh, bs, C.bodyColor, UI, 600, al)); y += ls.length * lh + 12; }
    if (C.foot) { const fs = 22 * k, ls = lines(C.foot, fs, inner, 600); if (draw) ls.forEach((ln, i) => text(ln, ax, y + fs + i * fs * 1.3, fs, C.footColor, UI, 600, al)); y += ls.length * fs * 1.3 + 8; }
    return y;
  };
  let k = 1; while (k > 0.7 && flow(k, false) > r.y + r.h - 6) k -= 0.06;
  flow(k, true);
}

// ---- reference pages: How to play, About, Rules (scrolling reader card, text zoom to 300%) ----
function drawPage(ctx, tx, state, L, scene, calm) {
  const { text, wrap, shadowText, lines } = tx, P = L.pages, btn = (r, l, o) => button(ctx, tx, r, l, o), t = state.t;
  const pages = scene === 'help' ? HELP_PAGES : scene === 'about' ? ABOUT : RULES;
  const scaleIdx = Math.min(Math.max(state.textScaleIdx, 0), TEXT_SCALES.length - 1), scale = TEXT_SCALES[scaleIdx] ?? 1;
  const ttl = scene === 'help' ? 'How to play' : scene === 'about' ? 'About Konane' : 'Rules';
  let ts = 52; ctx.font = `700 ${ts}px ${FONT}`; while (ts > 30 && ctx.measureText(ttl).width > P.title.maxW) { ts -= 2; ctx.font = `700 ${ts}px ${FONT}`; }
  shadowText(ttl, P.title.x, P.title.y, ts);
  btn(P.TS.dec, 'A−', { size: 28, dim: scaleIdx === 0 });
  btn(P.TS.inc, 'A+', { size: 28, dim: scaleIdx === TEXT_SCALES.length - 1 });
  const c = P.card, v = P.view;
  readerCard(ctx, c.x, c.y, c.w, c.h);
  const bw = Math.max(240, Math.min(v.w - 44, L.land ? 780 : 570)), bx = v.x + (v.w - bw) / 2, cx = v.x + v.w / 2;
  const fs = Math.round(28 * scale), lhh = Math.round(fs * 1.4), titleSize = Math.round(44 * Math.min(scale, 1.2)), titleLH = Math.round(titleSize * 1.12);
  const titleGap = Math.round(fs * 0.95) + 14;
  const scroll = Math.max(0, Math.min(state.scroll || 0, pageMetrics.max));
  // The wrapped document is laid out once per (scene, text size, width, font, minimum font) and reused; a frame only draws the visible slice.
  const fontsKey = (ctx.font = `800 40px ${FONT}`, ctx.measureText('Hamburgefonstiv').width)   // changes when the web font finishes loading;
  const key = [scene, fs, bw, titleSize, v.y, cx, bx, tx.minF, fontsKey].join('|');
  if (readerCache.pages !== pages || readerCache.key !== key) {
    readerStats.layouts++;
    const items = []; let yy = v.y + 36;
    for (const Pg of pages) {
      if (Pg.title) { const ls = lines(Pg.title, titleSize, bw - 10, 800); items.push({ ls, x: cx, y: yy + Math.round(titleSize * 0.78), size: titleSize, color: '#ffe6b0', lh: titleLH, align: 'center', weight: 800 }); yy += ls.length * titleLH + titleGap; }
      if (Pg.demo) { items.push({ demo: Pg.demo, y: yy + 6, top: yy, h: DEMO_H }); yy += 6 + DEMO_H + 20 + Math.round(fs * 0.55); }
      if (Pg.stones) { items.push({ stones: true, y: yy + 6, top: yy, h: STONES_H }); yy += 6 + STONES_H + 20 + Math.round(fs * 0.55); }   // + the half line the first text baseline sits below
      for (const para of Pg.body) { const ls = lines(para, fs, bw, 600); items.push({ ls, x: bx, y: yy, size: fs, color: PAGE_TEXT, lh: lhh, align: 'left', weight: 600 }); yy += ls.length * lhh + 18; }
      yy += 26;
    }
    readerCache.pages = pages; readerCache.key = key; readerCache.items = items; readerStats.items = items; readerCache.endY = yy;
  }
  ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip(); ctx.translate(0, -scroll);
  const top = v.y + scroll - 400, bot = v.y + scroll + v.h + 400;   // slack for illustration heights and glyph ascent
  for (const it of readerCache.items) {
    if (it.ls) {
      const h = it.ls.length * it.lh;
      if (it.y + h < top - it.size || it.y - it.size > bot) continue;
      it.ls.forEach((ln, i) => { const ly = it.y + i * it.lh; if (ly > top - it.size && ly - it.size < bot) text(ln, it.x, ly, it.size, it.color, UI, it.weight, it.align); });
    } else if (it.top + it.h >= top && it.top <= bot) {
      if (it.demo) drawHelpDemo(ctx, it.demo, it.y, t, calm, cx); else drawRulesStones(ctx, text, it.y, cx);
    }
  }
  const y = readerCache.endY;
  ctx.restore();
  const contentH = y - 22 - v.y;
  pageMetrics.max = contentH - v.h <= 8 ? 0 : Math.ceil(contentH - v.h); pageMetrics.view = v.h;
  if (pageMetrics.max > 0) {
    const sb = P.scrollbar, th = Math.max(40, sb.h * v.h / contentH), ty = sb.y + (scroll / pageMetrics.max) * (sb.h - th);
    ctx.fillStyle = 'rgba(255,214,170,0.16)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,170,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 3); ctx.fill();
  }
  if (pageMetrics.max > 0) text(`${Math.round(100 * scroll / pageMetrics.max)}% read`, L.w / 2, P.counterY, 22, 'rgba(255,232,196,0.7)', UI, 500);
  const atEnd = pageMetrics.max <= 0 || scroll >= pageMetrics.max - 2;
  btn(P.prev, 'Up', { size: 24, dim: scroll <= 2 }); btn(P.back, 'Menu', { size: 26 });
  btn(P.next, atEnd ? 'Done' : 'Next', { size: 24, primary: true });
}

// A small illustrated jump used on the help pages: stones in a row, animated on a loop. Returns the y below it.
function drawHelpDemo(ctx, demo, y, t, calm, mx = 360) {
  const cell = 96, x0 = mx - (demo.cells.length * cell) / 2, R = 36;
  ctx.fillStyle = 'rgba(40,30,32,0.9)'; ctx.beginPath(); ctx.roundRect(x0 - 16, y, demo.cells.length * cell + 32, cell + 20, 18); ctx.fill();
  const ph = calm ? 0.5 : (t % 4) / 4;   // 0..1 loop: rest, hop, rest
  const f = Math.max(0, Math.min(1, (ph - 0.25) / 0.4)), e = f * f * (3 - 2 * f);
  demo.cells.forEach((c, i) => {
    const cx = x0 + i * cell + cell / 2, cy = y + 10 + cell / 2;
    ctx.fillStyle = '#1b1616'; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.fill();
    const k = c === 'B' ? 1 : c === 'W' ? 2 : 0;
    if (!k) return;
    if (demo.hop && i === demo.hop[0]) return;
    const gone = demo.hop && demo.hop[1].includes(i);
    drawStone(ctx, k, cx, cy, R, { v: i, alpha: gone ? 1 - e : 1 });
  });
  if (demo.hop) { const [from, , to] = demo.hop, ax = x0 + from * cell + cell / 2, bx = x0 + to * cell + cell / 2; drawStone(ctx, 1, ax + (bx - ax) * e, y + 10 + cell / 2, R, { v: 0, lift: Math.sin(Math.PI * e) * 1.2 }); }
  return y + cell + 20;
}

// The Rules page for "The stone": the real Black and White stone sprites, drawn via the game's own drawStone, side by side.
function drawRulesStones(ctx, text, y, mx = 360) {
  const R = 46, gap = 170, top = y, cy = y + 10 + R + 4;
  ctx.fillStyle = 'rgba(40,30,32,0.9)'; ctx.beginPath(); ctx.roundRect(mx - gap - R - 30, top, (gap + R + 30) * 2, R * 2 + 66, 18); ctx.fill();
  drawStone(ctx, 1, mx - gap, cy, R, { v: 1 });
  drawStone(ctx, 2, mx + gap, cy, R, { v: 1 });
  text('Black', mx - gap, cy + R + 32, 22, PAGE_TEXT, UI, 700);
  text('White', mx + gap, cy + R + 32, 22, PAGE_TEXT, UI, 700);
  return top + R * 2 + 76;
}
