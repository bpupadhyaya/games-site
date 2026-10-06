// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// All positions come from the live layout `L` (layout.js: layoutFor(w, h)), so the same code serves every phone and tablet in
// portrait and landscape. Static art (table, board) and the two pieces are cached sprites (art.js, pieces.js).
import { PUZZLE_TEXT } from './puzzles.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { drawTable, drawBoard, WOOD_NAMES } from './art.js';
import { drawTiger, drawGoat, SET_NAMES } from './pieces.js';
import { unlocked } from './unlocks.js';
import { legalMoves, threatened } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { flowRules } from './content.js';
import { drawCredit, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SIDE = { G: 'Goats', T: 'Tigers' };
const TAU = Math.PI * 2;
const SIZE = { T: 0.75, G: 0.5 };
// Rules-page scroll limits, measured while drawing and read by game.js to clamp scrolling. `ui.buttons` lists every button drawn in
// the last frame (used by the layout checks in the dev scripts).
export const rulesMetrics = { max: 0, view: 0 };
export const ui = { buttons: [] };

// Text-fit cache: wrapped lines and shrink-to-fit sizes are computed once per (font, size, width, text) and reused every frame (the Rules reader
// used to re-wrap its whole document each frame). Dropped when a web font finishes loading. readerStats.fits counts misses (tests read it).
const fitMemo = new Map(); let fitFontsKey = '';
export const readerStats = { fits: 0 };

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.buttons.length = 0;
  drawTable(ctx, L);
  if (!state.calm) {                                                       // a few warm motes drift over the table cloth (the board covers them; it never moves)
    for (let k = 0; k < 14; k++) {
      const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + state.t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(state.t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(state.t * 0.6 + k * 1.7);
      ctx.fillStyle = `rgba(255,214,150,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }
  const hud = L.hud, B = L.board, pointAt = L.pointAt, UNIT = B.UNIT;
  const set = state.look.set;
  // Falls back to 1 for any out-of-range index - a stale index must never produce a NaN font size.
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  const big = scale > 1;
  const g = state.game, a = state.anim, scene = state.scene;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');
  const T = L.title(!!state.saved);
  const hudScene = boardScene && !(scene === 'over' && !L.over.drawBoard);   // landscape result: art + buttons only, no board furniture

  const minU = Math.max(12, 11 / (host.px || 0.6));                          // smallest type (units) that is still ~11 css px
  const text = (str, x, y, size, color = '#f6dfae', font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  // single line that shrinks until it fits maxW
  const fitText = (str, x, y, size, maxW, color, font = FONT, weight = 700, align = 'center', min = minU) => {
    const s = memo(`f|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
    text(str, x, y, s, color, font, weight, align);
  };
  const lines = (str, size, maxW, weight = 600) => memo(`l|${weight}|${size}|${maxW}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => {
    const ls = lines(str, size, maxW); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return ls.length;
  };
  // wrap text into a box, shrinking the type until it fits the box's height (and width)
  const wrapBox = (str, r, size, lhRatio, color, align = 'center', min = minU) => {
    const s = memo(`b|${str}|${size}|${r.w}|${r.h}|${lhRatio}|${min}`, () => { let q = size, l2 = lines(str, q, r.w); while (q > min && (l2.length * q * lhRatio > r.h || l2.some((l) => ctx.measureText(l).width > r.w + 0.5))) { q -= 1; l2 = lines(str, q, r.w); } return q; });
    const ls = lines(str, s, r.w);
    const lh = s * lhRatio, x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    ls.forEach((ln, i) => text(ln, x, r.y + s * 0.85 + i * lh, s, color, UI, 600, align));
    return ls.length;
  };
  const panelRect = (r, rad = 18, fill = 'rgba(4,12,14,0.34)', stroke = 'rgba(246,223,174,0.2)') => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  };
  const piece = (k, pos, opts = {}) => { const r = B.pieceR * pos.s * SIZE[k] * (opts.scale ?? 1); (k === 'T' ? drawTiger : drawGoat)(ctx, pos.x, pos.y - r * 0.56, r, { set, ...opts }); };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#f3cf7a' : '#7a4a24'); gr.addColorStop(1, o.primary ? '#c8922e' : '#4a2811');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,170,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    // the label: one line if it fits, else a smaller line, else two lines (whichever stays largest)
    const size = o.size ?? 30, maxW = r.w - 22, col = o.primary ? '#2a1606' : '#f6dfae', cy = r.y + r.h / 2;
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${UI}`; return ctx.measureText(str).width; };
    let s1 = size; while (s1 > 13 && w1(label, s1) > maxW) s1 -= 1;
    let best = { s: s1, ls: [label] };
    if (s1 < size * 0.72) {
      const ws = label.split(' ');
      for (let cut = 1; cut < ws.length; cut++) {
        const ls = [ws.slice(0, cut).join(' '), ws.slice(cut).join(' ')]; let s2 = size;
        while (s2 > 13 && (Math.max(w1(ls[0], s2), w1(ls[1], s2)) > maxW || s2 * 2.25 > r.h)) s2 -= 1;
        const mw = Math.max(w1(ls[0], s2), w1(ls[1], s2)); if (s2 > best.s || (s2 === best.s && best.ls.length === 2 && mw < best.mw)) best = { s: s2, ls, mw };
      }
    }
    if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };
  const glow = (i, rgb, pulse) => { const p = pointAt(i); ctx.fillStyle = `rgba(${rgb},${0.45 + pulse * 0.3})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 24 * UNIT * p.s, 20 * UNIT * p.s, 0, 0, TAU); ctx.fill(); };

  // where the moving piece is right now
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), ease = f * f * (3 - 2 * f), to = pointAt(a.to);
    if (a.type === 'place') { const from = hud.hand(a.hand); return { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, s: from.s * 0.6 + (to.s - from.s * 0.6) * ease, lift: Math.sin(Math.PI * f) * 0.9 }; }
    const from = pointAt(a.from);
    if (a.type === 'refuse') {
      // out toward the point (not all the way if something stands there), a shudder, then home again
      const reach = a.to === a.from ? 0 : g.board[a.to] ? 0.55 : 0.92;
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = state.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 * UNIT : a.to === a.from ? Math.sin(f * 40) * 6 * (1 - f) : 0;
      return { x: from.x + (to.x - from.x) * e + shake, y: from.y + (to.y - from.y) * e, s: from.s + (to.s - from.s) * e, lift: 0.45 * Math.sin(Math.PI * Math.min(1, f * 1.1)) };
    }
    return { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, s: from.s + (to.s - from.s) * ease, lift: Math.sin(Math.PI * f) * (a.type === 'jump' ? 1.5 : 0.5) };
  };
  // the art block of the title-like screens: drawn in the phone's own coordinates, then placed and scaled by the layout
  const hero = (H, heading, sub) => {
    ctx.save(); ctx.translate(H.hx, H.hy); ctx.scale(H.sc, H.sc);
    text(heading, 360 + H.dx, 150, heading === 'Tiger and Goat' ? 54 : 46);
    if (sub) text(sub, 360, 205, 26, 'rgba(246,223,174,0.8)', FONT, 400);
    if (sub) drawCredit(ctx, 360, 266, 26);
    const bob = state.calm ? 0 : Math.sin(state.t * 1.1) * 3;                      // the two heads breathe a little (never the board)
    drawTiger(ctx, 215, 470 + bob, 150, { set }); drawGoat(ctx, 520, 470 - bob, 112, { set });
    ctx.restore();
  };
  const brandPanel = (r, rad, fill) => { panelRect(r, rad, fill); edgeStroke(ctx, r, rad, 0.42); };

  if (boardScene && (scene !== 'over' || L.over.drawBoard)) drawBoard(ctx, L, state.look.wood);
  if (hudScene && L.land) { brandPanel(L.leftCard, 18); brandPanel(L.rightCard, 18); if (L.badgeFits) drawBadgeStack(ctx, L.rightCard.x + L.rightCard.w / 2, L.rightCard.y + L.rightCard.h - 16, L.rightCard.w - 24); }

  if (hudScene) {
    // ---- header ---------------------------------------------------------------------------------------
    const ik = L.mode === 'tall' ? 1 : L.mode === 'compact' ? 0.72 : 0.8;
    const body = (str, b, color) => { const sz = big ? b.bigSize : b.size; wrapBox(str, b, sz, b.lh / b.size, color, b.align, minU); };
    const msgAlpha = state.msg && scene !== 'over' ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const fixedMsgInBody = hud.msg.fixed && (scene === 'lesson' || scene === 'puzzle');
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i], H = hud.lesson;
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, H.label.x, H.label.y, H.label.size, 'rgba(246,223,174,0.8)', UI, 600, H.label.align);
      fitText(l.title, H.title.x, H.title.y, H.title.size, H.title.maxW, '#f6dfae');
      ctx.save(); if (fixedMsgInBody) ctx.globalAlpha = 1 - Math.max(0, msgAlpha);
      body(state.lesson.done ? l.done : l.text, H.body, state.lesson.done ? '#c9f7c0' : '#ffffff'); ctx.restore();
    } else if (scene === 'puzzle') {
      const t = PUZZLE_TEXT[state.pz.puzzle.type], H = hud.puzzle;
      text('Daily puzzle', H.label.x, H.label.y, H.label.size, 'rgba(246,223,174,0.8)', UI, 600, H.label.align);
      piece(t.side, { x: H.icon.x, y: H.icon.y, s: 1 }, { scale: (t.side === 'T' ? 1.5 : 2) * ik });
      fitText(t.title, H.title.x, H.title.y, H.title.size, H.title.maxW, '#ffffff', UI, 700, H.title.center ? 'center' : 'left');
      ctx.save(); if (fixedMsgInBody) ctx.globalAlpha = 1 - Math.max(0, msgAlpha);
      body(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : t.goal(state.pz.puzzle.n), H.body, '#fff3d6'); ctx.restore();
      fitText(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, H.streak.x, H.streak.y, H.streak.size, H.streak.maxW ?? 600, '#f6dfae', UI, 600, H.streak.align, minU);
      fitText(`Goats captured so far: ${g.captured}`, H.cap.x, H.cap.y, H.cap.size, H.cap.maxW ?? 600, 'rgba(246,223,174,0.75)', UI, 500, H.cap.align, minU);
    } else {
      if (hud.title) text('Tiger and Goat', hud.title.x, hud.title.y, hud.title.size);
      const turnText = g.winner ? '' : state.autoMode ? (state.autoPaused ? 'Paused' : `${SIDE[g.turn]} ${state.autoPhase === 'reveal' ? '- this is the move' : 'thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`) : state.two ? `${SIDE[g.turn]} to move` : g.turn === state.human ? `Your move (${SIDE[g.turn].toLowerCase()})` : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
      piece(g.turn, { x: hud.icon.x, y: hud.icon.y, s: 1 }, { scale: (g.turn === 'T' ? 1.5 : 2) * ik });
      if (hud.turn.wrap) wrapBox(turnText, { x: hud.turn.x - hud.turn.maxW / 2, y: hud.turn.y - 26, w: hud.turn.maxW, h: 66 }, hud.turn.size, 1.15, '#ffffff', 'center', minU);
      else fitText(turnText, hud.turn.x, hud.turn.y, hud.turn.size, hud.turn.maxW, '#ffffff', UI, 700, hud.turn.align, 18);
      fitText(state.autoMode ? `Auto Play · think time ${THINK_STEPS[state.autoThinkIdx]}s` : state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`, hud.mode.x, hud.mode.y, hud.mode.size, hud.mode.maxW, 'rgba(246,223,174,0.8)', UI, 500, hud.mode.align, minU);
      fitText(hud.handLabel.maxW && hud.handLabel.maxW < 200 ? `To place: ${g.inHand}` : `Goats to place: ${g.inHand}`, hud.handLabel.x, hud.handLabel.y, hud.handLabel.size, hud.handLabel.maxW ?? 600, '#f6dfae', UI, 600, hud.handLabel.align, minU);
      if (L.mode !== 'tall') { ctx.strokeStyle = 'rgba(246,223,174,0.16)'; ctx.lineWidth = 1.5; for (let k = g.inHand; k < 20; k++) { const p = hud.hand(k), r = B.pieceR * SIZE.G * hud.handScale * 0.7; ctx.beginPath(); ctx.ellipse(p.x, p.y - r * 0.4, r, r * 0.8, 0, 0, TAU); ctx.stroke(); } }   // empty slots: shows where the 20 goats wait
      for (let k = 0; k < g.inHand; k++) piece('G', hud.hand(k), { scale: hud.handScale });
      fitText(hud.capLabel.maxW && hud.capLabel.maxW < 200 ? `Captured: ${g.captured}/20` : `Captured: ${g.captured} of 20`, hud.capLabel.x, hud.capLabel.y, hud.capLabel.size, hud.capLabel.maxW ?? 600, '#f6dfae', UI, 600, hud.capLabel.align, minU);
      if (L.mode !== 'tall') { ctx.strokeStyle = 'rgba(246,223,174,0.14)'; ctx.lineWidth = 1.5; for (let k = g.captured; k < 20; k++) { const p = hud.cap(k), r = B.pieceR * SIZE.G * hud.capScale * 0.75; ctx.beginPath(); ctx.ellipse(p.x, p.y - r * 0.4, r, r * 0.8, 0, 0, TAU); ctx.stroke(); } }
      for (let k = 0; k < g.captured; k++) piece('G', hud.cap(k), { scale: hud.capScale, dim: true });
    }

    // ---- the board ------------------------------------------------------------------------------------
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    if (state.sel >= 0 && !a) for (const m of legalMoves(g)) if (m.from === state.sel) glow(m.to, m.type === 'jump' ? '255,120,80' : '255,236,150', pulse);
    if (state.hint && !a) { glow(state.hint.to, '120,255,170', pulse); if (state.hint.from >= 0) glow(state.hint.from, '120,255,170', pulse); }
    const danger = state.marks && scene !== 'over' ? threatened(g) : new Set();
    if (scene !== 'over' || L.over.drawBoard) {
      for (let i = 0; i < 25; i++) {                       // far rows first; the moving piece is drawn where it is, not where it will be
        if (a && a.type === 'jump' && i === a.over) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (a.t / a.dur) * 1.6); piece('G', pointAt(i)); ctx.restore(); }
        if (a && ((a.type !== 'refuse' && i === a.to) || (a.type === 'refuse' && i === a.from))) continue;
        const k = g.board[i]; if (!k) continue;
        const sel = state.sel === i;
        piece(k, pointAt(i), { selected: sel, lift: sel ? 0.5 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0, threat: k === 'G' && danger.has(i) });
      }
      if (a) { const pos = animPos(); piece(a.kind, pos, { lift: pos.lift, selected: a.type === 'refuse' }); }
      // a capture lands with a ring of dust that spreads and fades (skipped in reduced-motion mode)
      if (a && a.type === 'jump' && !state.calm && a.t / a.dur > 0.55) {
        const f = (a.t / a.dur - 0.55) / 0.45, p = pointAt(a.to);
        ctx.strokeStyle = `rgba(255,236,190,${0.7 * (1 - f)})`; ctx.lineWidth = 6 * (1 - f) + 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, (20 + 60 * f) * UNIT * p.s, (16 + 44 * f) * UNIT * p.s, 0, 0, TAU); ctx.stroke();
      }
      if (state.kb && scene !== 'over') { const c = pointAt(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 34 * UNIT * c.s, 28 * UNIT * c.s, 0, 0, TAU); ctx.stroke(); }
    }

    // ---- message and buttons --------------------------------------------------------------------------
    if (state.msg && scene !== 'over') {
      const al = msgAlpha, M = hud.msg;
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      if (M.fixed) {
        const r = fixedMsgInBody ? (scene === 'lesson' ? hud.lesson.body : hud.puzzle.body) : M.rect;
        ctx.beginPath(); ctx.roundRect(r.x, r.y - 4, r.w, r.h + 8, 16); ctx.fillStyle = 'rgba(20,10,4,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(243,207,122,0.8)'; ctx.lineWidth = 2; ctx.stroke();
        const inner = { x: r.x + 14, y: r.y + 4, w: r.w - 28, h: r.h - 8 }, sz = big ? M.size + 6 : M.size;
        const ls = lines(state.msg.text, sz, inner.w), vh = Math.min(inner.h, ls.length * sz * 1.2);
        wrapBox(state.msg.text, { ...inner, y: inner.y + Math.max(0, (inner.h - vh) / 2) - 2 }, sz, M.lh / M.size, '#fff3d6', 'center', minU);
      } else {
        const ms = big ? 32 : 25, lh = big ? 40 : 32, ls = lines(state.msg.text, ms, M.maxW);
        // during play the message is a banner at the top (the tray below must stay visible); in lessons and puzzles it sits just above the board
        const h = 30 + ls.length * lh, y0 = scene === 'play' ? M.topY : M.aboveY - h;
        ctx.fillStyle = 'rgba(20,10,4,0.9)'; ctx.beginPath(); ctx.roundRect(M.x, y0, M.w, h, 16); ctx.fill();
        ctx.strokeStyle = 'rgba(243,207,122,0.8)'; ctx.lineWidth = 2; ctx.stroke();
        ls.forEach((ln, i) => text(ln, L.w / 2, y0 + 38 + i * lh, ms, '#fff3d6', UI, 600));
      }
      ctx.restore();
    }
    const BTN = L.BTN, bsz = L.land ? 24 : 26;
    if (scene === 'play') {
      if (state.autoMode) {
        // Auto Play's own rail: Exit, Pause/Resume (primary while paused so it's obvious the whole loop is frozen), and the think-time stepper.
        button(BTN.auto.exit, 'Exit', { size: 24 });
        button(BTN.auto.pause, state.autoPaused ? '▶ Resume' : '❙❙ Pause', { size: 24, primary: state.autoPaused });
        button(BTN.auto.dec, '− Think', { size: 22, dim: state.autoThinkIdx <= 0 });
        button(BTN.auto.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
      } else {
        button(BTN.menu, 'Menu', { size: bsz });
        button(BTN.undo, 'Take back', { size: bsz }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: bsz, dim: state.hintsLeft <= 0 });
      }
    }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: bsz }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: bsz }); if (state.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 28 }); }
  }

  const heroScene = scene === 'title' || scene === 'demo-limit' || scene === 'look' || (scene === 'puzzle' && state.pz.status === 'making');
  if (heroScene) {
    const Lk = L.look, drawB = scene === 'look' ? Lk.drawBoard : T.drawBoard;
    if (drawB) { drawBoard(ctx, L, state.look.wood); for (const c of [0, 4, 20, 24]) piece('T', pointAt(c)); }
    const dim = scene === 'look' ? Lk.dim : T.dim, card = scene === 'look' ? Lk.card : T.card;
    if (dim) { ctx.fillStyle = 'rgba(6,14,18,0.6)'; ctx.fillRect(dim.x, dim.y, dim.w, dim.h); }
    if (card) brandPanel(card, 24, 'rgba(6,14,18,0.5)');
    if (scene === 'look') hero(Lk.hero, 'Board and pieces', 'Earned by winning. Never for sale.');
    else hero(T.hero, 'Tiger and Goat', 'Four tigers. Twenty goats. One board.');
  }
  if (scene === 'puzzle' && state.pz.status === 'making') {
    const cxm = T.card ? T.card.x + T.card.w / 2 : L.w / 2, ym = L.tall ? 1000 + L.oy : T.card ? T.card.y + T.card.h / 2 : T.dim.y + 100;
    text("Preparing today's puzzle…", cxm, ym, 34, '#fff3d6', UI, 600); button(L.BTN.menu, 'Menu', { size: 26 });
  }
  if (scene === 'look') {
    const Lk = L.look;
    for (const lab of Lk.labels) text(lab.t, lab.x, lab.y, 24, 'rgba(246,223,174,0.85)', UI, 600, lab.align);
    ['teak', 'walnut', 'ash'].forEach((k, i) => { const ok = unlocked(state, 'wood', k); button(Lk.woods[i], ok ? WOOD_NAMES[k] : `${WOOD_NAMES[k]} (locked)`, { size: 23, primary: state.look.wood === k, dim: !ok }); });
    ['classic', 'snow'].forEach((k, i) => { const ok = unlocked(state, 'set', k); button(Lk.sets[i], ok ? SET_NAMES[k] : `${SET_NAMES[k]} (locked)`, { size: 26, primary: state.look.set === k, dim: !ok }); });
    button(Lk.back, 'Back', { size: 30 });
    if (state.msg) wrap(state.msg.text, Lk.msg.x, Lk.msg.y, big ? 30 : 24, Lk.msg.w, '#ffe9b0');
    text(`Wins so far: ${state.stats.wins}`, Lk.wins.x, Lk.wins.y, 22, 'rgba(246,223,174,0.7)', UI, 500);
  }
  if (scene === 'title') {
    const Rr = T.rows, solvedToday = state.daily.solvedDay === state.daily.day;
    if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
    button(Rr.learn, 'Learn to play', { primary: !state.learned && !Rr.resume, size: 30 });
    button(Rr.goats, 'Play as the Goats', { primary: state.learned && !Rr.resume, size: 30 }); button(Rr.tigers, 'Play as the Tigers', { size: 30 });
    button(Rr.two, 'Two players, one phone', { size: 28 });
    button(Rr.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(Rr.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(Rr.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 }); button(Rr.marks, state.marks ? 'Warnings on' : 'Warnings off', { size: 22 }); button(Rr.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 22 });
    button(Rr.look, 'Board and pieces', { size: 24 }); button(Rr.rules, 'Rules', { size: 24 });
    button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
    // badges: one star per level beaten with each side; skipped entirely when the shape leaves no safe room for them
    if (T.badges) {
      for (const row of T.badges.rows) {
        text(row.label, row.x, row.y, 22, 'rgba(246,223,174,0.8)', UI, 600, 'left');
        for (let l = 0; l < LEVELS.length; l++) text('★', row.x + 96 + l * 36, row.y + 2, 30, state.stats.badges[row.side + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
      }
      text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, T.badges.games.x, T.badges.games.y, 22, 'rgba(246,223,174,0.65)', UI, 500);
    }
    if (state.msg) { const mx = T.msgX ?? 360; wrap(state.msg.text, mx, T.msgY, 24, L.land ? Math.min(560, mx * 2 - 40) : 620, '#ffe9b0'); }
  } else if (scene === 'demo-limit') {
    const cxm = T.card ? T.card.x + T.card.w / 2 : L.w / 2, y0 = L.tall ? 960 + L.oy : T.card ? T.card.y + T.card.h / 2 - 60 : T.dim.y + 60;
    fitText('That was the free taste.', cxm, y0, 44, L.w - 60, '#f6dfae');
    fitText('Get Tiger and Goat on iPhone and Android', cxm, y0 + 70, 28, (T.card ? T.card.w : L.w) - 40, '#fff3d6', UI, 600); fitText('for unlimited games.', cxm, y0 + 110, 28, L.w - 60, '#fff3d6', UI, 600);
  } else if (scene === 'over') {
    const O = L.over;
    ctx.fillStyle = 'rgba(6,10,14,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    if (O.card) brandPanel(O.card, 24, 'rgba(6,14,18,0.5)');
    ctx.save(); ctx.translate(O.tx, O.ty); ctx.scale(O.sc, O.sc);
    const won = g.winner === 'draw' ? 'A draw' : state.two || state.autoMode ? `${SIDE[g.winner]} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
    if (g.winner !== 'draw') (g.winner === 'T' ? drawTiger : drawGoat)(ctx, 360, 520, g.winner === 'T' ? 170 : 130, { set });
    text(won, 360, 720, 64); text(g.reason, 360, 780, 28, '#fff3d6', UI, 500);
    text(`${g.moves} moves · ${g.captured} goat${g.captured === 1 ? '' : 's'} captured`, 360, 826, 24, 'rgba(246,223,174,0.75)', UI, 500);
    if (!state.two && !state.autoMode && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten as the ${SIDE[state.human].toLowerCase()}`, 360, 868, 24, '#ffd24a', UI, 600);
      if (!state.calm) for (let k = 0; k < 14; k++) {                        // gold sparks drifting up around the winner
        const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380;
        ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    button(L.BTN.again, 'Play again', { primary: true, size: 34 }); button(L.BTN.back, 'Menu', { size: 30 });
    drawMoreLine(ctx, L.BTN.back.x + L.BTN.back.w / 2, L.BTN.back.y + L.BTN.back.h + 56, 26);
  } else if (scene === 'rules') {
    const RL = L.rules, panel = RL.panel, vp = RL.viewport, sc0 = rulesScrollNow(state);
    ctx.fillStyle = 'rgba(6,10,14,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    const secs = flowRules();

    // The reader card: one framed panel holding the header, the piece portrait (if any) and the body text.
    ctx.beginPath(); ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 26);
    const pg = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
    pg.addColorStop(0, 'rgba(58,38,20,0.55)'); pg.addColorStop(1, 'rgba(16,10,5,0.72)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(246,223,174,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(panel.x + 6, panel.y + 6, panel.w - 12, panel.h - 12, 20);
    ctx.strokeStyle = 'rgba(246,223,174,0.12)'; ctx.lineWidth = 1; ctx.stroke();

    text('Rules', RL.cx, panel.y + 54, Math.round(44 * Math.min(scale, 1.15)));
    ctx.strokeStyle = 'rgba(246,223,174,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(panel.x + 60, panel.y + 82); ctx.lineTo(panel.x + panel.w - 60, panel.y + 82); ctx.stroke();

    // The body scrolls inside the viewport (drag, wheel, keys, scroll bar). Pages that fit never move.
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = Math.min(panel.w - 90, 820), cxp = vp.x + vp.w / 2;
    const size = Math.round(29 * scale), lh = Math.round(size * 1.42), gap = Math.round(11 * scale);
    let y = vp.y - sc0;
    secs.forEach((page, i) => {
      const t0 = Math.round(31 * Math.min(scale, 2));
      const tSize = memo(`t|${page.title}|${t0}|${bodyW}`, () => { let q = t0; ctx.font = `700 ${q}px ${UI}`; while (ctx.measureText(page.title).width > bodyW && q > 22) { q -= 1; ctx.font = `700 ${q}px ${UI}`; } return q; });
      if (i > 0) y += Math.round(34 * Math.min(scale, 2));
      const pageTitleY = y + 16 + Math.max(30, tSize * 0.86);
      if (pageTitleY > vp.y - 100 && pageTitleY < vp.y + vp.h + 100) text(page.title, cxp, pageTitleY, tSize, '#ffd24a', UI, 700);
      // The body text keeps growing to the top step while the title is capped, so the gap below the title grows past 2x.
      y = pageTitleY + 58 + Math.round(40 * Math.max(0, scale - 2));
      if (page.piece) { const footY = pageTitleY + 212; if (footY > vp.y - 260 && footY < vp.y + vp.h + 160) piece(page.piece, { x: cxp, y: footY, s: 1 }, { scale: (page.piece === 'T' ? 2.7 : 3.6) * (49.29 / B.pieceR) }); y = footY + 110; }
      for (const line of page.lines) {
        const ls = lines(line, size, bodyW);
        if (y + ls.length * lh > vp.y - 80 && y - size < vp.y + vp.h + 80) ls.forEach((ln, i) => text(ln, cxp, y + i * lh, size, '#ffffff', UI, 600, 'center'));
        y += ls.length * lh + gap;
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) - gap + 24;
    if (contentH - vp.h > 8) {                                              // soft fades so a half line at the edge never looks cut
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(22,14,8,${a0})`); gr.addColorStop(1, `rgba(22,14,8,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 36, vp.y + vp.h, 0, 0.97);
      if (sc0 > 2) fade(vp.y + 24, vp.y, 0, 0.97);
    }
    rulesMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h);   // a few units of overshoot is not worth a scroll bar
    rulesMetrics.view = vp.h;
    if (rulesMetrics.max > 0) {                                           // scroll bar
      const sb = RL.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / rulesMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(246,223,174,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(rulesMetrics.max > 0 ? (sc0 >= rulesMetrics.max - 1 ? 'End' : 'Scroll or tap Next for more') : '', RL.cx, RL.counterY, 22, 'rgba(246,223,174,0.65)', UI, 500);
    button(RL.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(RL.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    button(RL.nav.back, 'Back', { size: 28 });
    button(RL.nav.next, rulesMetrics.max <= 0 || sc0 >= rulesMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(6,16,18,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }
}

// The scroll offset used for drawing: the saved one, never beyond what the last frame measured.
function rulesScrollNow(state) { return Math.max(0, Math.min(state.rulesScroll || 0, rulesMetrics.max)); }
