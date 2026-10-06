// Everything that is drawn each frame. Reads `state` (see game.js) and the live layout `L` (layout.js); changes nothing.
// The table fills the whole screen; the board is drawn in BOARD space through the layout's transform (B.apply), so it can be scaled
// and turned to suit the screen; header, dice tray, buttons and text are drawn in screen units and always upright.
import { MIN_FONT, TEXT_SCALES, AP_THINK_STEPS, PIECE_R, YT, YB, cellRect, cellCenter, squareAt, restSlots, HOME_RECT } from './layout.js';
import { drawTable, drawBoardLayer, rosette, wedgeBand, PAL } from './art.js';
import { drawPiece, drawDie } from './pieces.js';
import { cellOf, legalMoves, HOME, PIECES } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { HERITAGE } from './heritage.js';
import { RULES } from './content.js';
import { drawLockup, drawMoreLine } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f3d98b', IVORY = '#f8efd8';
const ease = (f) => f * f * (3 - 2 * f);
const lerp = (a, b, f) => a + (b - a) * f;

// Scroll limits of the reference page body, published for game.js (drag / wheel scrolling).
export const docMetrics = { max: 0, view: 0 };
const docCache = { key: '', items: [], total: 0, starts: [] };
// Every button drawn in the last frame ({ r, label }), for the layout checks in the tests and in the browser matrix.
export const frameButtons = [];

export function render(ctx, state, L) {
  const scene = state.scene, g = state.game, big = state.big, a = state.anim;
  frameButtons.length = 0;
  let minSize = MIN_FONT;                                                   // inside a scaled group the floor is MIN_FONT / scale
  const isDoc = scene === 'about' || scene === 'rules';
  const kind = scene === 'autoplay' || scene === 'autoplay-over' ? 'auto' : scene === 'lesson' || scene === 'puzzle' ? 'text' : 'play';
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making') || scene === 'autoplay' || scene === 'autoplay-over';
  drawTable(ctx, L.w, L.h, L.U.y0 + 14, L.h - 8);

  const text = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${Math.max(size, minSize)}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color, font, weight, align) => { text(str, x + 1.5, y + 3, size, 'rgba(0,0,0,0.6)', font, weight, align); text(str, x, y, size, color, font, weight, align); };
  const widthOf = (str, size, font = UI, weight = 700) => { ctx.font = `${weight} ${size}px ${font}`; return ctx.measureText(str).width; };
  // the largest size (down to the floor) at which a one-line string fits maxW
  const fitSize = (str, base, maxW, font = UI, weight = 700, floor = minSize) => { let size = base; while (size > floor && widthOf(str, size, font, weight) > maxW) size -= 1; return size; };
  const wrap = (str, maxW, size, weight = 600, font = UI) => {
    ctx.font = `${weight} ${size}px ${font}`; const out = []; let cur = '';
    for (const w of String(str).split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  // wraps into a box: the first size (largest first) whose lines fit, else the smallest; draws top-aligned inside rect
  const paraBox = (str, rect, sizes, color, align = 'center', lh = 1.28, weight = 600) => {
    let size = sizes[sizes.length - 1], out = null;
    for (const sz of sizes) { const s2 = Math.max(sz, minSize), l2 = wrap(str, rect.w, s2, weight); if (l2.length * s2 * lh <= rect.h + 1 || sz === sizes[sizes.length - 1]) { size = s2; out = l2; break; } }
    const x = align === 'center' ? rect.x + rect.w / 2 : rect.x;
    out.forEach((ln, i) => text(ln, x, rect.y + size + i * size * lh - size * 0.2, size, color, UI, weight, align));
    return out.length * size * lh;
  };
  const button = (r, label, o = {}) => {
    frameButtons.push({ r, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f6d47a'); gr.addColorStop(1, '#b8842a'); } else { gr.addColorStop(0, '#2f57b0'); gr.addColorStop(1, '#152e72'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,245,200,0.8)' : 'rgba(243,217,139,0.85)'; ctx.lineWidth = 2.5; ctx.stroke();
    const base = Math.min(o.size ?? 30, r.h * 0.46);
    let str = label, size = fitSize(str, base, r.w - 16, UI, 700);
    if (o.alt && widthOf(str, size) > r.w - 16) { str = o.alt; size = fitSize(str, base, r.w - 16, UI, 700); }
    text(str, r.x + r.w / 2, r.y + r.h / 2 + size * 0.35, size, o.primary ? '#2a1606' : IVORY, UI, 700);
    ctx.restore();
  };
  const panel = (x, y, w, h) => {
    ctx.fillStyle = 'rgba(12,8,4,0.9)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(226,178,74,0.85)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(226,178,74,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 13); ctx.stroke();
  };
  const group = (ox, oy, s, fn) => { ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s); const was = minSize; minSize = MIN_FONT / s; fn(); minSize = was; ctx.restore(); };

  // ---- lamp: a clay oil lamp top right, its flame flickering, warming the table -----------------------------------
  const fl = state.calm ? 0.8 : 0.78 + 0.14 * Math.sin(state.t * 9.1) + 0.08 * Math.sin(state.t * 15.7 + 1);
  if (L.lamp && !isDoc) {
    const lp = L.lamp, lamp = ctx.createRadialGradient(lp.x, lp.y, 4, lp.x, lp.y, 300); lamp.addColorStop(0, `rgba(255,190,100,${0.34 * fl})`); lamp.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, L.w, lp.y + 460);
    drawLamp(ctx, lp.x, lp.y, fl, state.t, state.calm);
  }

  // ---- the board scenes ------------------------------------------------------------------------------------------
  if (boardScene) drawBoardScene();
  function drawBoardScene() {
    const B = L.board(kind), upright = (x, y, fn) => { if (!B.rot) { fn(x, y); return; } ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2); fn(0, 0); ctx.restore(); };
    const piece = (x, y, r, side, o) => upright(x, y, (px, py) => drawPiece(ctx, px, py, r, side, o));
    const human = (scene !== 'over' && scene !== 'autoplay' && scene !== 'autoplay-over' && (state.two || g.turn === 0)) || (scene === 'autoplay' && state.ap && state.ap.phase === 'reveal');
    const movesNow = human && g.roll > 0 && !a && state.dice.phase !== 'rolling' ? legalMoves(g) : [];
    const hd = B.hdr;

    // header: status text and the two side chips
    const turn = g.turn, paused = scene === 'autoplay' && state.apPaused, resultCard = scene === 'over' || scene === 'autoplay-over';
    if (B.panel && !resultCard) panelBack(ctx, B.panel);
    if (resultCard) { /* the result card says it all: only the dimmed board shows behind it */ }
    else if (kind === 'text') {
      if (scene === 'lesson') {
        const l = LESSONS[state.lesson.i];
        text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, hd.label.x, hd.label.y, 24, 'rgba(243,217,139,0.8)', UI, 600);
        shadowText(l.title, hd.title.x, hd.title.y, fitSize(l.title, 44, hd.maxW, FONT, 700), GOLD);
        paraBox(state.msg ? state.msg.text : state.lesson.done ? l.done : l.text, B.para, big ? [30, 28, 26, 24, 22] : [27, 26, 24, 22], state.msg ? '#ffe2a0' : state.lesson.done ? '#d6f5c8' : '#fff6de');
      } else {
        const P = state.pz;
        text('Daily puzzle', hd.label.x, hd.label.y, 24, 'rgba(243,217,139,0.8)', UI, 600);
        shadowText('Find the best move', hd.title.x, hd.title.y, fitSize('Find the best move', 44, hd.maxW, FONT, 700), GOLD);
        paraBox(state.msg ? state.msg.text : P.status === 'solved' ? `Solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' at the first try'}. ${P.puzzle.why} A new puzzle comes tomorrow.` : `You rolled ${P.puzzle.roll}. Which move is strongest? Tap a piece, then its square. Streak: ${state.daily.streak}.`, B.para, big ? [30, 28, 26, 24, 22] : [27, 26, 24, 22], state.msg ? '#ffe2a0' : '#fff6de');
      }
    } else {
      let title, sub, names;
      if (kind === 'auto') {
        title = scene === 'autoplay-over' ? 'Auto Play complete' : 'Auto Play · Watch & Learn';
        const AP = state.ap;
        sub = scene === 'autoplay-over' ? 'Game over' : paused ? 'Paused' : !AP ? '' : AP.phase === 'think' ? 'Thinking...' : AP.phase === 'reveal' ? 'Here is the move' : 'Watching...';
        names = ['Shell', 'Jet'];
      } else {
        const two = state.two;
        title = scene === 'over' ? 'Game over' : two ? `Player ${turn + 1} to move` : turn === 0 ? 'Your move' : `The computer${state.thinking || g.roll >= 0 || state.dice.phase === 'rolling' ? ' is playing' : ' is about to roll'}`;
        sub = two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name}`;
        names = [two ? 'Player 1' : 'You', two ? 'Player 2' : 'Computer'];
      }
      shadowText(title, hd.title.x, hd.title.y, fitSize(title, 44, hd.maxW, FONT, 700), GOLD);
      text(sub, hd.sub.x, hd.sub.y, 22, 'rgba(243,217,139,0.78)', UI, 500);
      for (const s of [0, 1]) {
        const x = s === 0 ? hd.chips.lx : hd.chips.rx, y = hd.chips.y, on = scene !== 'over' && scene !== 'autoplay-over' && turn === s && !paused;
        if (on) { ctx.fillStyle = `rgba(255,214,110,${0.25 + 0.12 * Math.sin(state.t * 4)})`; ctx.beginPath(); ctx.arc(x, y, hd.chips.r + 8, 0, TAU); ctx.fill(); }
        drawPiece(ctx, x, y - 2, hd.chips.r - 2, s);
        text(names[s], x + (s === 0 ? hd.chips.r + 12 : -hd.chips.r - 12), y + 8, 22, on ? GOLD : 'rgba(243,217,139,0.65)', UI, 600, s === 0 ? 'left' : 'right');
      }
    }

    // ---- the board itself (board space) ----
    ctx.save(); B.apply(ctx);
    drawBoardLayer(ctx);
    // destination glows (selected piece, or the hint): the path it will take, the square, a ghost piece and a tag
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    const goals = [], tags = [], homeTags = [];
    if (state.sel >= 0 && !a && movesNow.length) { const m = movesNow.find((x) => x.i === state.sel); if (m) goals.push({ m, col: '255,230,140' }); }
    if (state.hint && !a) { const m = legalMoves(g).find((x) => x.i === state.hint.i); if (m) goals.push({ m, col: '130,255,170', hint: true }); }
    for (const { m, col } of goals) {
      const s = g.turn;
      for (let p = m.from + 1; p < Math.min(m.to, 15); p++) { const q = squareAt(s, p); if (q) { ctx.fillStyle = `rgba(${col},0.7)`; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, TAU); ctx.fill(); } }
      if (m.to <= 14) {
        const dc = cellOf(s, m.to), R = cellRect(dc.lane, dc.c);
        ctx.fillStyle = `rgba(${col},${0.22 + pulse * 0.18})`; ctx.beginPath(); ctx.roundRect(R.x + 6, R.y + 6, R.w - 12, R.h - 12, 10); ctx.fill();
        ctx.strokeStyle = `rgba(${col},${0.7 + pulse * 0.3})`; ctx.lineWidth = 4; ctx.stroke();
        const c = cellCenter(dc.lane, dc.c); piece(c.x, c.y, PIECE_R, s, { dim: true });
        tags.push({ c, m });
      } else {
        const H2 = HOME_RECT(s); ctx.strokeStyle = `rgba(${col},${0.6 + pulse * 0.4})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(H2.x, H2.y, H2.w, H2.h, 14); ctx.stroke();
        homeTags.push({ x: H2.x + H2.w / 2, y: H2.y + H2.h / 2, col });
      }
    }
    // pieces
    const at = (s, i) => {
      const p = g.pos[s][i];
      if (p >= 1 && p <= 14) return squareAt(s, p);
      return state.rv[s][i] ?? restSlots(g.pos[s], s)[i];
    };
    const glowSet = new Set(movesNow.map((m) => m.i));
    for (const s of [0, 1]) for (let i = 0; i < PIECES; i++) {
      if (a && a.side === s && a.i === i) continue;
      if (a && a.type === 'move' && a.hit >= 0 && a.hitSide === s && i === a.hit) continue;
      const q = at(s, i); if (!q) continue;
      const mine = s === g.turn && glowSet.has(i), selected = s === g.turn && state.sel === i;
      const isTop = mine && g.pos[s][i] === 0;                              // only the top of the waiting stack glows
      const r = g.pos[s][i] === 0 ? 30 : g.pos[s][i] === HOME ? 24 : PIECE_R;
      piece(q.x, q.y, r, s, { glow: mine && (g.pos[s][i] !== 0 || isTop) ? state.t : 0, lift: selected ? 0.55 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0 });
    }
    // the captured piece: waits where it stood until it is hit, then flies back to its stack
    if (a && a.type === 'move' && a.hit >= 0) {
      const f2 = (a.t - a.dur) / 0.5, from = squareAt(a.hitSide, a.hitFrom);
      if (f2 < 0) piece(from.x, from.y, PIECE_R, a.hitSide);
      else if (f2 < 1) { const to = a.hitTo, e = ease(f2); piece(lerp(from.x, to.x, e), lerp(from.y, to.y, e), lerp(PIECE_R, 30, e), a.hitSide, { lift: Math.sin(Math.PI * f2) * 1.6 }); }
    }
    if (a) {
      const pos = animAt(a, state);
      piece(pos.x, pos.y, a.type === 'move' && a.off ? lerp(PIECE_R, 24, Math.min(1, a.t / a.dur)) : PIECE_R, a.side, { lift: pos.lift, glow: a.type === 'refuse' ? state.t : 0 });
      if (a.type === 'move' && a.t > a.dur && a.t < a.dur + 0.45 && !state.calm) {              // a ring of light where a piece lands or captures
        const f = (a.t - a.dur) / 0.45, e = a.pts[a.pts.length - 1];
        ctx.strokeStyle = `rgba(${a.hit >= 0 ? '255,120,80' : '255,236,160'},${0.8 * (1 - f)})`; ctx.lineWidth = 6 * (1 - f) + 1; ctx.beginPath(); ctx.arc(e.x, e.y, 30 + 60 * f, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();

    // ---- labels and tags in screen space (always upright) ----
    if (!resultCard) for (const s of [0, 1]) {
      const waiting = g.pos[s].filter((p) => p === 0).length, home = g.pos[s].filter((p) => p === HOME).length, bx = s === 0 ? 64 : 720 - 64;
      const w = B.toScreen(bx, YB - 526), hm = B.toScreen(bx, YT + 264);
      text('Waiting', w.x, w.y, 22, 'rgba(243,217,139,0.75)', UI, 600); text(String(waiting), w.x, w.y + 25, 22, 'rgba(243,217,139,0.75)', UI, 700);
      text('Home', hm.x, hm.y, 22, 'rgba(243,217,139,0.75)', UI, 600); text(`${home}/${PIECES}`, hm.x, hm.y + 25, 22, 'rgba(243,217,139,0.75)', UI, 700);
    }
    for (const t of homeTags) { const p = B.toScreen(t.x, t.y); text('Home', p.x, p.y + 8, 22, `rgb(${t.col})`, UI, 700); }
    for (const { c, m } of tags) {                                    // small labels on top of everything: what the move will do
      const tag = m.hit >= 0 ? 'Capture' : m.rosette ? 'Roll again' : ''; if (!tag) continue;
      const p = B.toScreen(c.x, c.y), cellH = (B.rot ? 156 : 122) * B.s, ty = p.y - cellH / 2 + 3;
      const tw = widthOf(tag, 22, UI, 700) + 22; ctx.fillStyle = m.hit >= 0 ? 'rgba(150,30,20,0.96)' : 'rgba(20,70,45,0.96)';
      ctx.beginPath(); ctx.roundRect(p.x - tw / 2, ty, tw, 30, 14); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,170,0.8)'; ctx.lineWidth = 1.5; ctx.stroke(); text(tag, p.x, ty + 22, 22, '#fff6de', UI, 700);
    }
    // dice tray
    if (resultCard) return;
    drawTray(ctx, state, text, widthOf, g, human, B, L);

    // buttons
    const bt = B.btn;
    if (scene === 'play') { button(bt.menu, 'Menu', { size: 26 }); button(bt.undo, 'Take back', { size: 26, alt: 'Undo' }); button(bt.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(bt.menu, 'Menu', { size: 26 }); if (state.lesson.done) button(bt.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(bt.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(bt.next, 'Share result', { primary: true, size: 28 }); }
    else if (scene === 'autoplay') {
      button(bt.apExit, 'Exit', { size: 26 });
      button(bt.apPause, state.apPaused ? 'Resume' : 'Pause', { size: 26, primary: !!state.apPaused });
      button(bt.apDec, 'Think −', { size: 24, dim: state.apThinkIdx === 0 });
      button(bt.apInc, 'Think +', { size: 24, dim: state.apThinkIdx === AP_THINK_STEPS.length - 1 });
      text(`Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, B.apLabel.x, B.apLabel.y, 22, 'rgba(243,217,139,0.85)', UI, 600);
    }

    // message banner, just above the board (stack) or in the panel (side)
    if (state.msg && (scene === 'play' || scene === 'autoplay')) {
      const m = B.msg, al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      const maxW = m.w - 50, room = m.top !== undefined ? m.bottom - m.top - 24 : 140;
      const sizes = big ? [30, 26, 22] : [25, 22], lhm = 1.25;
      let size = 22, out = null;
      for (const sz of sizes) { const s2 = Math.max(sz, MIN_FONT), l2 = wrap(state.msg.text, maxW, s2); if (l2.length <= 3 && l2.length * s2 * lhm <= room) { size = s2; out = l2; break; } }
      if (!out) { size = 22; out = wrap(state.msg.text, maxW, 22).slice(0, Math.max(1, Math.floor(room / (22 * lhm)))); }
      const lh = size * lhm, h = 24 + out.length * lh;
      let y0 = m.mid !== undefined ? m.mid - h / 2 : m.bottom - h;
      if (m.floor !== undefined && m.floor > y0 && m.floor + h <= m.bottom + 16) y0 = m.floor;      // below the header when the board leaves room, else over its lower part
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      ctx.fillStyle = 'rgba(14,9,4,0.93)'; ctx.beginPath(); ctx.roundRect(m.x, y0, m.w, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(243,217,139,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      out.forEach((ln, i) => text(ln, m.x + m.w / 2, y0 + 12 + size + i * lh - 4, size, '#fff3d6', UI, 600));
      ctx.restore();
    }
  }

  // ---- title, notices, about, rules, game over --------------------------------------------------------------------
  const titleArt = (T) => {
    if (T.compact) {
      const name = 'The Royal Game of Ur', tag = 'A race from the cradle of civilisation', bb = L.backBox;
      let A = T.art; const cx = A.x + A.w / 2;
      let ts = fitSize(name, Math.min(66, A.h * 0.28), A.w - 30, FONT, 700, 30);
      if (bb.w && cx - widthOf(name, ts, FONT, 700) / 2 < bb.x + bb.w + 6 && A.y < bb.y + bb.h) { const d = bb.y + bb.h + 4 - A.y; A = { x: A.x, y: A.y + d, w: A.w, h: A.h - d }; ts = fitSize(name, Math.min(66, A.h * 0.28), A.w - 30, FONT, 700, 30); }     // clear of the host back button
      const tg = fitSize(tag, 26, A.w - 30, FONT, 600, 22);
      shadowText(name, cx, A.y + ts * 0.95, ts, GOLD);
      const ty = A.y + ts * 0.95 + tg * 1.5; text(tag, cx, ty, tg, 'rgba(243,217,139,0.85)', FONT, 600);
      const r = Math.min(150, (A.y + A.h - ty - 28) / 2.3);
      if (r >= 36) drawEmblem(ctx, cx, ty + 18 + r * 1.1, r, state);
    } else group(T.artX, T.artY, T.a, () => {
      shadowText('The Royal Game', 360, 200, 74, GOLD); shadowText('of Ur', 360, 270, 74, GOLD);
      text('A race from the cradle of civilisation', 360, 318, 28, 'rgba(243,217,139,0.85)', FONT, 600);
      drawEmblem(ctx, 360, 520, 150, state);
      if (T.showDice) {
        for (let k = 0; k < 4; k++) drawDie(ctx, 210 + k * 100, 726, 42, k % 2 === 0, state.calm ? 0.3 * k : state.t * (0.6 + k * 0.15) + k, state.calm ? 1 : 0.8 + 0.2 * Math.cos(state.t * 1.3 + k), 0);
        ctx.save(); ctx.globalAlpha = 0.9; wedgeBand(ctx, 60, 778, 660, 14, 77, 'rgba(226,178,74,0.6)'); ctx.restore();
      }
    });
    drawLockup(ctx, T.lockup.cx, T.lockup.y, T.lockup.w, 0.9, (state.afFlash || 0) > 0);
  };
  if (scene === 'title') {
    const T = L.title(!!state.saved), R = T.btn, solvedToday = state.daily.solvedDay === state.daily.day;
    titleArt(T);
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 30 });
    button(R.two, 'Two players, one phone', { size: 28 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(R.about, 'About', { size: 26 }); button(R.rules, 'Rules', { size: 26 }); button(R.autoplay, 'Auto Play', { size: 24 });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 });
    button(R.big, state.big ? 'Large text: on' : 'Large text: off', { size: 22 }); button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 22 });
    const I = T.info;
    text(LEVELS[state.level].blurb, I.x, I.blurb, fitSize(LEVELS[state.level].blurb, 22, T.col.w + 40, UI, 500), 'rgba(243,217,139,0.7)', UI, 500);
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, I.x, I.stats, 22, 'rgba(243,217,139,0.6)', UI, 500);
    let sx = I.x - 2 * 44 + 22; for (let l = 0; l < LEVELS.length; l++) { text('★', sx + l * 44, I.stars, 30, state.stats.badges[l] ? '#ffd24a' : 'rgba(255,255,255,0.2)', UI, 700); }
    if (state.msg) { ctx.save(); ctx.fillStyle = 'rgba(14,9,4,0.92)'; const m = { x: T.col.x, y: T.col.y - 66, w: T.col.w, h: 58 }; ctx.beginPath(); ctx.roundRect(m.x, m.y, m.w, m.h, 14); ctx.fill(); ctx.restore(); paraBox(state.msg.text, { x: m.x + 14, y: m.y + 6, w: m.w - 28, h: m.h - 8 }, [22], '#ffe9b0', 'center', 1.2); }
  } else if (scene === 'demo-limit' || (scene === 'puzzle' && state.pz.status === 'making')) {
    const N = L.notice();
    titleArt(N.art);
    if (scene === 'demo-limit') {
      text('That was the free taste.', N.x, N.y + 20, fitSize('That was the free taste.', 44, N.art.col.w + 40, FONT, 700), GOLD);
      paraBox('Get The Royal Game of Ur on iPhone and Android for unlimited games.', { x: N.art.col.x, y: N.y + 50, w: N.art.col.w, h: 110 }, [26, 24, 22], '#fff3d6');
      button(N.btn, 'Back', { size: 30 });
    } else {
      text('Preparing today\'s puzzle...', N.x, N.y + 40, fitSize('Preparing today\'s puzzle...', 34, N.art.col.w + 40, UI, 600), '#fff3d6', UI, 600);
      button(N.btn, 'Menu', { size: 26 });
    }
  } else if (isDoc) {
    const D = L.doc, P = D.panel, about = scene === 'about';
    const docItems = about ? HERITAGE : RULES;
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const head = about ? 'About the game' : 'Game rules';
    shadowText(head, D.titleCx, D.titleY, fitSize(head, Math.round(40 * Math.min(scale, 1.15)), D.titleMaxW, FONT, 700, 26), GOLD);
    panel(P.x, P.y, P.w, P.h);
    // ONE scrolling document: every authored entry in order, a heading wherever the title changes, the real piece / dice / rosette
    // art inline where an entry carries it, the decorative emblem above (About: it follows the entry at the top of the view).
    const size = Math.round(29 * scale), lh = size * 1.4, bodyW = D.body.w - 22, cx = D.body.x + bodyW / 2, hs = Math.round(40 * Math.min(scale, 1.4));
    const key = `${scene}|${size}|${Math.round(bodyW)}`;
    if (docCache.key !== key) {
      const items = []; let y = 0, prev = null; const starts = [];
      docItems.forEach((it, pi) => {
        starts.push(y);
        if (it.title !== prev) { prev = it.title; if (items.length) y += Math.round(size * 0.7); items.push({ k: 'h', s: it.title, y: y + hs * 0.85, sz: fitSize(it.title, hs, bodyW, FONT, 700, 22) }); y += Math.round(hs * 1.35); }
        if (!about && ['pieces', 'dice', 'rosette', 'capture'].includes(it.art)) { items.push({ k: 'art', a: it.art, y: y + 62 }); y += 130; }
        for (const ln of wrap(it.body, bodyW, size, 600)) { items.push({ k: 'l', s: ln, y: y + size }); y += lh; }
        y += Math.round(size * 0.35);
      });
      docCache.key = key; docCache.items = items; docCache.total = y; docCache.starts = starts;
    }
    docMetrics.max = Math.max(0, Math.ceil(docCache.total - D.body.h + size * 0.2)); docMetrics.view = D.body.h;
    const sc = Math.min(state.docScroll || 0, docMetrics.max);
    state.docEnd = docMetrics.max <= 1 || sc >= docMetrics.max - 1;
    let topIdx = 0; docCache.starts.forEach((s0, i) => { if (s0 <= sc + 24) topIdx = i; });
    if (about) state.about = topIdx; else state.rules = topIdx;
    if (D.art) {
      const ar = D.art; drawEmblem(ctx, ar.x, ar.y, ar.r, state, about ? state.about : 0);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(D.body.x, D.body.y, D.body.w, D.body.h); ctx.clip();
    for (const it of docCache.items) {
      const y = D.body.y + it.y - sc; if (y < D.body.y - 160 || y > D.body.y + D.body.h + 160) continue;
      if (it.k === 'h') shadowText(it.s, cx, y, it.sz, GOLD, FONT);
      else if (it.k === 'l') text(it.s, cx, y, size, '#fff3d6', UI, 600);
      else { const k = 0.75; if (it.a === 'pieces') { drawPiece(ctx, cx - 64 * k, y, 62 * k, 0); drawPiece(ctx, cx + 64 * k, y, 62 * k, 1); } else if (it.a === 'dice') { for (let q = 0; q < 4; q++) drawDie(ctx, cx + (q - 1.5) * 96 * k, y, 42 * k, q % 2 === 0, q * 0.55, 1, 0); } else if (it.a === 'rosette') rosette(ctx, cx, y, 92 * k, true, 0); else { drawPiece(ctx, cx - 60 * k, y + 6 * k, 58 * k, 1, { dim: true }); drawPiece(ctx, cx + 64 * k, y - 6 * k, 64 * k, 0); } }
    }
    ctx.restore();
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(36, sb.h * sb.h / (sb.h + docMetrics.max)), ty = sb.y + (sb.h - th) * (sc / docMetrics.max);
      ctx.fillStyle = 'rgba(243,217,139,0.18)'; ctx.beginPath(); ctx.roundRect(sb.x + 4, sb.y, 6, sb.h, 3); ctx.fill();
      ctx.fillStyle = 'rgba(243,217,139,0.8)'; ctx.beginPath(); ctx.roundRect(sb.x + 3, ty, 8, th, 4); ctx.fill();
      text(`${Math.round(100 * sc / docMetrics.max)}%`, D.count.x, D.count.y, 22, 'rgba(243,217,139,0.75)', UI, 600);
    }
    button(D.menu, 'Menu', { size: 26 }); button(D.prev, 'Back', { size: 26, dim: sc <= 0 }); button(D.next, state.docEnd ? 'Done' : 'Next', { size: 26, primary: !state.docEnd });
    button(D.zoomDec, 'A−', { dim: state.textScaleIdx === 0, size: 30 });
    button(D.zoomInc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 30 });
  } else if (scene === 'over' || scene === 'autoplay-over') {
    const Rz = L.result, ov = scene === 'over';
    ctx.fillStyle = 'rgba(6,4,2,0.74)'; ctx.fillRect(0, 0, L.w, L.h);
    const won = ov ? (state.two ? `Player ${g.winner + 1} wins` : g.winner === 0 ? 'You win!' : 'The computer wins') : g.winner === 0 ? 'Shell wins' : 'Jet wins';
    const e = Rz.emblem; drawEmblem(ctx, e.x, e.y, e.r, state);
    const k = Rz.a, fs = (n) => Math.max(MIN_FONT, n * k);
    if (!ov) shadowText('Auto Play complete', Rz.over.x, Rz.over.y, fs(40), GOLD);
    shadowText(won, Rz.won.x, Rz.won.y, fitSize(won, fs(68), Rz.won.maxW, FONT, 700), GOLD);
    text(`Seven pieces home in ${g.moves} moves`, Rz.l1.x, Rz.l1.y, fs(26), '#fff3d6', UI, 500);
    const cap = ov ? `Captures: ${state.caps[0]} by ${state.two ? 'Player 1' : 'you'} · ${state.caps[1]} by ${state.two ? 'Player 2' : 'the computer'}` : `Captures: ${state.caps[0]} by Shell · ${state.caps[1]} by Jet`;
    text(cap, Rz.l2.x, Rz.l2.y, fitSize(cap, fs(22), Rz.won.maxW + 20, UI, 500), 'rgba(243,217,139,0.75)', UI, 500);
    if (ov && !state.two && g.winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, Rz.l3.x, Rz.l3.y, fs(24), '#ffd24a', UI, 600);
      if (!state.calm) for (let q = 0; q < 16; q++) { const ph = (state.t * 0.35 + q * 0.137) % 1, x = e.x + Math.sin(q * 2.4) * (140 + 90 * ph) * k, y = e.y + 130 * k - ph * 400 * k; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, (4 + (q % 3) * 2) * k, 0, TAU); ctx.fill(); }
    }
    button(Rz.again, ov ? 'Play again' : 'Watch again', { primary: true, size: 34 }); button(Rz.back, ov ? 'Menu' : 'Exit to menu', { size: 30 });
    if (ov) drawMoreLine(ctx, Rz.more.x, Rz.more.y, 22);
  }
}

// a faint card behind the controls of the side panel, so the panel reads as one piece
function panelBack(ctx, P) {
  ctx.save(); ctx.fillStyle = 'rgba(10,7,4,0.55)'; ctx.beginPath(); ctx.roundRect(P.x, P.y, P.w, P.h, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(226,178,74,0.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}

// where the moving piece is right now: a hop from square to square, or a try-and-return
function animAt(a, state) {
  const f = Math.min(1, a.t / a.dur), n = a.pts.length - 1;
  if (a.type === 'refuse') {
    const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = ease(out) * 0.85, [p, q] = a.pts;
    const shake = state.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 : 0;
    return { x: lerp(p.x, q.x, e) + shake, y: lerp(p.y, q.y, e), lift: 0.5 * Math.sin(Math.PI * Math.min(1, f * 1.1)) };
  }
  const u = Math.min(n - 1e-6, f * n), k = Math.floor(u), loc = u - k, p = a.pts[k], q = a.pts[k + 1];
  const last = f >= 1 ? a.pts[n] : null;
  if (last) return { x: last.x, y: last.y, lift: 0 };
  return { x: lerp(p.x, q.x, ease(loc)), y: lerp(p.y, q.y, ease(loc)), lift: Math.sin(Math.PI * loc) * 0.9 };
}

function drawTray(ctx, state, text, widthOf, g, human, B, L) {
  const T = B.tray, d = state.dice, rolling = d.phase === 'rolling', ready = state.scene !== 'over' && state.scene !== 'autoplay-over' && g.roll < 0 && !rolling && !state.anim && (state.scene === 'lesson' ? LESSONS[state.lesson.i].want === 'roll' && !state.lesson.done : human && state.wait <= 0);
  const pulse = 0.5 + 0.5 * Math.sin(state.t * 5), UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const D = L.dice(T, B.trayTall);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(T.x + 3, T.y + 7, T.w, T.h, 20); ctx.fill();
  const bg = ctx.createLinearGradient(0, T.y, 0, T.y + T.h); bg.addColorStop(0, '#1b120a'); bg.addColorStop(1, '#0a0603');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(T.x, T.y, T.w, T.h, 20); ctx.fill();
  ctx.strokeStyle = ready ? `rgba(255,222,120,${0.6 + pulse * 0.4})` : 'rgba(226,178,74,0.7)'; ctx.lineWidth = ready ? 4 : 2.5; ctx.stroke();
  ctx.restore();
  // dice: tumbling while rolling, resting on their result afterwards
  for (let k = 0; k < 4; k++) {
    const c = D.c[k];
    if (rolling) {
      const f = d.t / d.dur, tt = state.calm ? 0 : d.t, settle = f > 0.75 ? (f - 0.75) / 0.25 : 0;
      const flick = Math.floor(d.t * 12 + k * 3), up = f > 0.8 ? d.vals[k] === 1 : ((flick * 7 + k) % 3) === 0;
      const bounce = Math.abs(Math.sin(f * Math.PI * 3 + k)) * (1 - f);
      drawDie(ctx, c.x + Math.sin(tt * 9 + k) * 8 * (1 - f), c.y - 4, D.size, up, lerp(tt * (10 + k * 2) + k, k * 0.55, ease(settle)), lerp(0.55 + 0.45 * Math.abs(Math.cos(tt * 8 + k * 2)), 1, ease(settle)), state.calm ? 0 : bounce * 1.1);
    } else if (d.phase === 'none') drawDie(ctx, c.x, c.y - 4, D.size, false, k * 0.55, 1, 0);
    else drawDie(ctx, c.x, c.y - 4, D.size, d.vals[k] === 1, k * 0.55, 1, 0);
  }
  const tx = D.text.x, fit = (str, base, weight, maxW) => { let s = base; while (s > 22 && widthOf(str, s, UI, weight) > maxW) s -= 1; return s; };
  if (!D.text.big) {                                                       // tall tray: one line under the dice
    const y = T.y + T.h - 22, mw = T.w - 24;
    if (rolling) text('Rolling...', tx, y, 26, '#fff3d6', UI, 600);
    else if (ready) { const s = 'Tap to roll the four dice'; text(s, tx, y, fit(s, 26, 700, mw), `rgba(255,236,170,${0.75 + pulse * 0.25})`, UI, 700); }
    else if (d.phase !== 'none') text(`${d.total} ${d.total === 1 ? 'step' : 'steps'}`, tx, y, 30, GOLD, UI, 700);
    else text('Four dice', tx, y, 26, 'rgba(243,217,139,0.6)', UI, 600);
    return;
  }
  const tw = 2 * (T.x + T.w - tx) - 8;
  if (rolling) text('Rolling...', tx, T.y + 62, fit('Rolling...', 30, 600, tw), '#fff3d6', UI, 600);
  else if (ready) { text('Tap to roll', tx, T.y + 56, fit('Tap to roll', 30, 700, tw), `rgba(255,236,170,${0.75 + pulse * 0.25})`, UI, 700); text('the four dice', tx, T.y + 84, 22, 'rgba(243,217,139,0.7)', UI, 500); }
  else if (d.phase !== 'none') { text(String(d.total), tx - 36, T.y + 76, 70, GOLD, UI, 700); text(d.total === 1 ? 'step' : 'steps', tx + 38, T.y + 74, 24, 'rgba(243,217,139,0.85)', UI, 600); }
  else text('Four dice', tx, T.y + 62, 26, 'rgba(243,217,139,0.6)', UI, 600);
}

// A small clay oil lamp with a flickering flame.
function drawLamp(ctx, x, y, fl, t, calm) {
  ctx.save();
  const g = ctx.createLinearGradient(x - 40, y, x + 40, y + 24); g.addColorStop(0, '#c98a52'); g.addColorStop(1, '#6d4020');
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 30, 40, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 34, y + 6); ctx.quadraticCurveTo(x - 20, y + 30, x + 10, y + 28); ctx.quadraticCurveTo(x + 32, y + 24, x + 38, y + 4); ctx.quadraticCurveTo(x + 14, y + 12, x - 34, y + 6); ctx.fill();
  ctx.fillStyle = '#3a2210'; ctx.beginPath(); ctx.ellipse(x - 2, y + 7, 26, 5, 0, 0, TAU); ctx.fill();
  const sway = calm ? 0 : Math.sin(t * 7) * 2.2;
  const f = ctx.createRadialGradient(x - 34 + sway, y - 8, 1, x - 34, y - 8, 22 * fl); f.addColorStop(0, 'rgba(255,250,220,1)'); f.addColorStop(0.4, 'rgba(255,200,90,0.95)'); f.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(x - 40 + sway * 0.5, y + 4); ctx.quadraticCurveTo(x - 46 + sway, y - 12, x - 34 + sway * 1.6, y - 30 * fl); ctx.quadraticCurveTo(x - 24 + sway, y - 12, x - 28, y + 4); ctx.fill();
  ctx.restore();
}

// The emblem: a lapis disc with a rosette, ringed in gold and wedges. Turns slowly.
function drawEmblem(ctx, x, y, r, state, variant = 0) {
  ctx.save();
  const spin = state.calm ? 0 : state.t * 0.12;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 14, r * 1.12, r * 1.02, 0, 0, TAU); ctx.fill();
  const ring = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r * 1.1); ring.addColorStop(0, '#fff0b8'); ring.addColorStop(0.5, '#e2b24a'); ring.addColorStop(1, '#7a5010');
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.fill();
  const lap = ctx.createLinearGradient(x - r, y - r, x + r, y + r); lap.addColorStop(0, PAL.lapis[0]); lap.addColorStop(0.6, PAL.lapis[1]); lap.addColorStop(1, PAL.lapis[2]);
  ctx.fillStyle = lap; ctx.beginPath(); ctx.arc(x, y, r * 1.0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,224,140,0.6)'; for (let k = 0; k < 30; k++) { const a = k * 2.399, rr = r * 0.95 * Math.sqrt((k + 1) / 30); ctx.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2, 2); }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + spin; ctx.fillStyle = k % 2 ? PAL.shell[1] : PAL.red[0]; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, r * 0.045, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(226,178,74,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.76, 0, TAU); ctx.stroke();
  rosette(ctx, x, y, r * 0.66, true, spin * 1.5);
  if (variant === 3) for (let k = 0; k < 3; k++) drawDie(ctx, x - 1.3 * r + k * 1.3 * r, y + r * 1.3, 34 * r / 118, k !== 1, k, 1, 0);
  ctx.restore();
}
