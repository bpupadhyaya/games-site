// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// Static art (forest floor, map) and the two pieces are cached sprites (art.js, pieces.js), so a frame is cheap.
// Every position comes from the layout `L` of the live screen size (layout.js); nothing here assumes 720 x 1560.
import { PIECE_R, SIZE, UNIT, TEXT_SCALES, THINK_STEPS, overButtons, host } from './layout.js';
import { drawGround, drawBoard, drawLeaf, BOARD_NAMES } from './art.js';
import { drawHare, drawHound, SET_NAMES } from './pieces.js';
import { unlocked } from './unlocks.js';
import { legalMoves, hareReach } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PUZZLE_TEXT } from './puzzles.js';
import { CAMPAIGN } from './campaign.js';
import { RULES } from './content.js';
import { drawCredit, drawTitleLockup, drawMoreLine, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SIDE = { H: 'Hare', D: 'Hounds' };
const TAU = Math.PI * 2;
export const NAME = 'Hare and Hounds';
export const rulesMetrics = { max: 0, view: 0 };
const rulesScrollNow = (state) => Math.max(0, Math.min(state.rulesScroll || 0, rulesMetrics.max));

// Text-fit cache: wrapped lines, shrink-to-fit sizes and font metrics are computed once per (font, size, width, text) and reused every frame
// (the Rules reader used to re-wrap its whole document each frame). Dropped when a web font finishes loading. readerStats.fits counts misses.
const fitMemo = new Map(); let fitFontsKey = '';
export const readerStats = { fits: 0 };

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  const set = state.look.set, big = state.look.big;
  const g = state.game, a = state.anim, scene = state.scene, B = L.board;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'autoplay' || (scene === 'puzzle' && state.pz.status !== 'making');
  drawGround(ctx, state.look.board, L.w, L.h);
  const minPx = Math.max(10, 11 / (host.px || 0.6) * 0.95);        // text never below ~11 css px

  const text = (str, x, y, size, color = '#f6e3b4', font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const lines = (str, size, maxW, weight = 600, font = UI) => memo(`l|${weight}|${size}|${maxW}|${font}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center', weight = 600) => { const ls = lines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const piece = (k, pos, opts = {}) => { const r = PIECE_R * pos.s * SIZE[k] * (opts.scale ?? 1); (k === 'H' ? drawHare : drawHound)(ctx, pos.x, pos.y - r * 0.56, r, { set, ...opts }); };
  const fit = (label, maxW, start, weight = 700) => memo(`f|${label}|${maxW}|${start}|${weight}`, () => { let sz = start; ctx.font = `${weight} ${sz}px ${UI}`; while (ctx.measureText(label).width > maxW && sz > 11) { sz -= 1; ctx.font = `${weight} ${sz}px ${UI}`; } return sz; });
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h * 0.28);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#f1cd78' : '#6b5a34'); gr.addColorStop(1, o.primary ? '#c28e2c' : '#3a2f18');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = 'rgba(255,232,170,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const size = Math.min(o.size ?? 30, Math.max(14, r.h * 0.5)), sz = fit(label, r.w - 20, size);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.35, sz, o.primary ? '#2a1a06' : '#f6e3b4', UI, 700);
    ctx.restore();
  };
  const panel = (r, rad = 22, fill = 'rgba(14,10,4,0.62)') => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); edgeStroke(ctx, r, rad, 0.4); };
  const glow = (i, rgb, pulse) => { const p = B.at(i); ctx.fillStyle = `rgba(${rgb},${0.45 + pulse * 0.3})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 34 * UNIT * p.s, 28 * UNIT * p.s, 0, 0, TAU); ctx.fill(); };
  // the art block of the title and board-look screens, in canonical phone coordinates, placed by `hero`
  const hero = (H, title, sub, pieces, credit) => {
    ctx.save(); ctx.translate(H.hx, H.hy); ctx.scale(H.sc, H.sc);
    text(title, 360 + H.dx, 150, title === NAME ? 54 : 46); text(sub, 360, 205, 26, 'rgba(246,227,180,0.85)', FONT, 400);
    if (pieces) { drawHare(ctx, 215, 500, 150, { set }); drawHound(ctx, 520, 490, 130, { set }); }
    ctx.restore();
  };

  // drifting leaves: a few cached sprites, still in reduced-motion mode
  if (!state.calm) {
    const n = Math.max(5, Math.min(13, Math.round((7 * L.w * L.h) / (720 * 1560))));
    for (let k = 0; k < n; k++) {
      const t = state.t, x = ((k * 173 + t * (10 + k * 3)) % (L.w + 80)) - 40 + Math.sin(t * 0.6 + k) * 22, y = ((k * 331 + t * (16 + k * 4)) % (L.h + 140)) - 70;
      ctx.globalAlpha = 0.7; drawLeaf(ctx, x, y, 9 + (k % 3) * 4, t * 0.7 + k, k); ctx.globalAlpha = 1;
    }
  }

  // where the moving piece is right now
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), ease = f * f * (3 - 2 * f), to = B.at(a.to), from = B.at(a.from);
    if (a.type === 'refuse') {
      const reach = a.to === a.from ? 0 : g.board[a.to] ? 0.55 : 0.92;
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = state.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 * UNIT * B.s : a.to === a.from ? Math.sin(f * 40) * 6 * (1 - f) * B.s : 0;
      return { x: from.x + (to.x - from.x) * e + shake, y: from.y + (to.y - from.y) * e, s: from.s + (to.s - from.s) * e, lift: 0.4 * Math.sin(Math.PI * Math.min(1, f * 1.1)) };
    }
    return { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, s: from.s + (to.s - from.s) * ease, lift: Math.sin(Math.PI * f) * (a.kind === 'H' ? 0.95 : 0.4) };   // the hare bounds, hounds trot
  };

  // ---- the info block (header on a portrait screen, the left card on a landscape one) ---------------------------------------
  // `blocks` are built from the scene; they stack from the top and shrink together until they fit the rect.
  const stack = (rect, blocks) => {
    const run = (list, y) => { for (const b of list) { b.draw(y); y += b.h; } };
    let last = null;
    for (const k of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) {
      const m = blocks.map((b) => b(k, rect.w)).filter(Boolean), sum = (l) => l.reduce((s, b) => s + b.h, 0), core = m.filter((b) => !b.opt);
      if (sum(m) <= rect.h) return run(m, rect.y);
      if (k <= 0.84 && sum(core) <= rect.h) return run(core, rect.y);        // the title is the first thing to go
      last = core;
    }
    run(last, rect.y);
  };
  const tb = (str, size, color, o = {}) => (k, w) => {
    if (!str) return null;
    const sz = Math.max(minPx, size * k), maxW = o.maxW ? Math.min(o.maxW, w) : w, ls = lines(str, sz, maxW, o.weight ?? 600, o.font ?? UI), lh = sz * (o.lh ?? 1.25);
    return { h: ls.length * lh + (o.gap ?? 6) * k, opt: o.opt, draw: (y) => ls.forEach((ln, i) => text(ln, o.x ?? 0, y + sz * 0.95 + i * lh, sz, color, o.font ?? UI, o.weight ?? 600, o.align ?? 'center')) };
  };
  const centered = (rect, f) => (k, w) => { const b = f(k, w); if (!b) return b; const d = b.draw; b.draw = (y) => { ctx.save(); ctx.translate(rect.x + rect.w / 2, 0); d(y); ctx.restore(); }; return b; };
  const headBlock = (rect, side, str, sub, subColor = 'rgba(246,227,180,0.85)') => (k, w) => {
    const stacked = w < 400, ic = stacked ? 0 : 98 * k, tw = w - ic - 4, sz = Math.max(minPx, (stacked ? 28 : 32) * k), ssz = Math.max(minPx, 22 * k);
    const tl = lines(str || '', sz, tw, 700), sl = sub ? lines(sub, ssz, tw, 500) : [];
    const th = tl.length * sz * 1.2 + sl.length * ssz * 1.25, ih = stacked ? 150 * k : 0, h = stacked ? ih + th + 8 * k : Math.max(78 * k, th + 10 * k);
    return { h: h + 6 * k, draw: (y) => {
      const al = stacked ? 'center' : 'left', tx = stacked ? rect.x + rect.w / 2 : rect.x + ic;
      piece(side, stacked ? { x: rect.x + rect.w / 2, y: y + 118 * k, s: 1 } : { x: rect.x + 46 * k, y: y + h * 0.58, s: 1 }, { scale: (stacked ? 0.5 : 0.62) * k });
      let yy = stacked ? y + ih + sz * 0.8 : y + (h - th) / 2 + sz * 0.9;
      tl.forEach((ln) => { text(ln, tx, yy, sz, '#ffffff', UI, 700, al); yy += sz * 1.2; });
      yy += ssz * 0.1; sl.forEach((ln) => { text(ln, tx, yy, ssz, subColor, UI, 500, al); yy += ssz * 1.25; });
    } };
  };
  const clockBlock = (rect) => (k, w) => {
    if (!(g.limit <= 60 && (scene === 'play' || scene === 'over' || scene === 'autoplay' || (scene === 'lesson' && LESSONS[state.lesson.i].limit)))) return null;
    const n = g.limit, cap = Math.max(6, Math.min(n, Math.floor(w / 24))), rows = Math.ceil(n / cap), step = Math.min(30, w / cap), rh = 22 * k;
    return { h: rows * rh + 10 * k, draw: (y) => {
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cap), inRow = Math.min(cap, n - row * cap), cx = rect.x + rect.w / 2 - ((inRow - 1) * step) / 2 + (i % cap) * step, cy = y + 12 * k + row * rh, used = i < g.hm;
        ctx.fillStyle = used ? 'rgba(0,0,0,0.5)' : g.limit - g.hm <= 3 ? '#e9663a' : '#e8b84a'; ctx.beginPath(); ctx.arc(cx, cy, (used ? 5 : 8) * Math.max(0.8, k), 0, TAU); ctx.fill();
        if (!used) { ctx.strokeStyle = 'rgba(255,240,190,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    } };
  };
  const clockText = (rect) => { const left = Math.max(0, g.limit - g.hm); return centered(rect, tb(g.limit > 60 ? '' : `Hunt clock: the hounds have ${left} move${left === 1 ? '' : 's'} left`, 22, left <= 3 ? '#ff9a80' : '#f6e3b4', { x: 0, maxW: rect.w })); };

  if (boardScene) {
    drawBoard(ctx, state.look.board, B);
    if (scene !== 'over') {
      if (L.wide) panel(L.leftCard, 20); else if (L.infoPanel) panel(L.infoPanel, 18);
      const I = L.info, ctr = (f) => centered(I, f), msgTopOverlay = scene === 'play' && L.tall && state.msg;
      const nameB = ctr(tb(NAME, 40, '#f6e3b4', { font: FONT, weight: 700, x: 0, opt: true, gap: 10 }));
      const blocks = [];
      if (scene === 'lesson') {
        const l = LESSONS[state.lesson.i];
        blocks.push(ctr(tb(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 24, 'rgba(246,227,180,0.85)', { x: 0 })), ctr(tb(l.title, 42, '#f6e3b4', { font: FONT, weight: 700, x: 0, lh: 1.1, gap: 8 })),
          ctr(tb(state.lesson.done ? l.done : l.text, big ? 30 : 26, state.lesson.done ? '#c9f7c0' : '#ffffff', { x: 0, lh: big ? 1.28 : 1.26 })), clockText(I), clockBlock(I));
      } else if (scene === 'puzzle') {
        const t = PUZZLE_TEXT[state.pz.puzzle.type];
        blocks.push(ctr(tb('Daily puzzle', 24, 'rgba(246,227,180,0.85)', { x: 0 })), headBlock(I, t.side, t.title, ''),
          ctr(tb(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : t.goal(state.pz.puzzle.n), big ? 27 : 24, '#fff3d6', { x: 0 })),
          ctr(tb(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 22, '#f6e3b4', { x: 0 })));
      } else if (scene === 'autoplay') {
        const A = state.ap, left0 = THINK_STEPS[state.apThinkIdx] - A.t;
        const phaseText = A.paused ? 'Paused' : A.phase === 'think' ? `Think: what would ${SIDE[g.turn].toLowerCase()} play? (${Math.max(0, left0).toFixed(0)}s)` : 'Here is the move about to be played…';
        blocks.push(ctr(tb('Auto Play: watch and learn', 24, 'rgba(246,227,180,0.85)', { x: 0 })), headBlock(I, g.turn, `${SIDE[g.turn]} to move`, phaseText, '#ffe9b0'),
          ctr(tb(`Think time: ${THINK_STEPS[state.apThinkIdx]}s  (use − and +)`, 20, '#f6e3b4', { x: 0 })), clockText(I), clockBlock(I));
      } else {
        const camp = state.camp >= 0 ? CAMPAIGN[state.camp] : null;
        blocks.push(nameB);
        if (!msgTopOverlay) {
          const turnText = g.winner ? '' : state.two ? `${SIDE[g.turn]} to move` : g.turn === state.human ? `Your move (${SIDE[g.turn].toLowerCase()})` : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
          blocks.push(headBlock(I, g.turn, turnText, camp ? `Level ${state.camp + 1}: ${camp.name}` : state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`), clockText(I));
        }
        blocks.push(clockBlock(I));
      }
      stack(I, blocks);
    }

    // ---- the board ------------------------------------------------------------------------------------
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    // Auto Play never shows the "where the hare could go next" warning: THINK must show nothing highlighted yet (that is what
    // REVEAL is for), and Auto Play's own REVEAL/ACT glows below are the directed teaching highlight for this mode.
    if (state.marks && scene !== 'over' && scene !== 'autoplay' && g.turn === 'D' && (state.two || state.human === 'D') && !a) for (const i of hareReach(g)) glow(i, '255,120,90', 0.1);
    if (state.sel >= 0 && !a) for (const m of legalMoves(g)) if (m.from === state.sel) glow(m.to, '255,236,150', pulse);
    if (state.hint && !a) { glow(state.hint.to, '120,255,170', pulse); glow(state.hint.from, '120,255,170', pulse); }
    // Auto Play REVEAL: every legal option glows softly, the one about to be taken glows distinctly brighter (gold at its
    // destination, green at its origin) so the viewer can compare their own guess.
    if (scene === 'autoplay' && state.ap.phase === 'reveal' && !a) {
      const chosen = state.ap.chosen;
      for (const m of legalMoves(g)) { if (chosen && m.to === chosen.to && m.from === chosen.from) continue; glow(m.to, '150,190,255', 0.4); }
      if (chosen) {
        glow(chosen.to, '255,208,90', pulse); glow(chosen.from, '120,255,170', pulse);
        // A dark ring around the chosen destination so gold still reads clearly against this board's own light cream tone.
        const cp = B.at(chosen.to); ctx.strokeStyle = 'rgba(40,24,4,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cp.x, cp.y, 34 * UNIT * cp.s, 28 * UNIT * cp.s, 0, 0, TAU); ctx.stroke();
      }
    }
    const order = [...Array(11).keys()].sort((p, q) => B.at(p).y - B.at(q).y);
    for (const i of order) {                                          // far points first; the moving piece is drawn where it is, not where it will be
      if (a && ((a.type !== 'refuse' && i === a.to) || (a.type === 'refuse' && i === a.from))) continue;
      const k = g.board[i]; if (!k) continue;
      const sel = state.sel === i;
      piece(k, B.at(i), { selected: sel, lift: sel ? 0.5 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0 });
    }
    if (a) { const pos = animPos(); piece(a.kind, pos, { lift: pos.lift, selected: a.type === 'refuse' }); }
    if (a && a.type === 'move' && !state.calm && a.t / a.dur > 0.6) {          // a puff of leaves where a piece lands
      const f = (a.t / a.dur - 0.6) / 0.4, p = B.at(a.to);
      ctx.strokeStyle = `rgba(255,236,190,${0.55 * (1 - f)})`; ctx.lineWidth = 4 * (1 - f) + 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, (24 + 40 * f) * UNIT * p.s, (18 + 30 * f) * UNIT * p.s, 0, 0, TAU); ctx.stroke();
    }
    if (state.kb && scene !== 'over') { const c = B.at(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 40 * UNIT * c.s, 33 * UNIT * c.s, 0, 0, TAU); ctx.stroke(); }

    // ---- message and buttons --------------------------------------------------------------------------
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      const ms = Math.max(minPx, big ? 30 : 25), lh = ms * 1.27, top = scene === 'play' && L.tall, an = top ? L.msgTop : L.msgBottom;
      const mw = Math.min(an.w, 640), ls = lines(state.msg.text, ms, mw - 50, 600);
      const bh = 30 + ls.length * lh, bx = L.wide ? an.x : an.x + (an.w - mw) / 2, y0 = top ? an.y : an.yb - bh;
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      ctx.fillStyle = 'rgba(16,12,4,0.92)'; ctx.beginPath(); ctx.roundRect(bx, y0, L.wide ? an.w : mw, bh, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(241,205,120,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      ls.forEach((ln, i) => text(ln, bx + (L.wide ? an.w : mw) / 2, y0 + 12 + ms * 0.95 + i * lh, ms, '#fff3d6', UI, 600));
      ctx.restore();
    }
    if (L.wide && scene !== 'over') panel(L.rightCard, 20);
    const BT = L.BTN;
    if (scene === 'play') { button(BT.menu, 'Menu', { size: 26 }); button(BT.undo, 'Take back', { size: 26 }); button(BT.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BT.menu, 'Menu', { size: 26 }); if (state.lesson.done) button(BT.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(BT.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(BT.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'autoplay') {
      const A = BT.auto;
      button(A.exit, 'Exit', { size: 26 }); button(A.pause, state.ap.paused ? 'Resume' : 'Pause', { size: 26, primary: state.ap.paused }); button(A.skip, 'Skip', { size: 26 });
      button(A.dec, '−', { size: 30, dim: state.apThinkIdx === 0 }); button(A.inc, '+', { size: 30, dim: state.apThinkIdx === THINK_STEPS.length - 1 });
    }
    if (L.wide && scene === 'autoplay') text(`Think time: ${THINK_STEPS[state.apThinkIdx]}s`, L.rightCard.x + L.rightCard.w / 2, L.BTN.auto.dec.y + L.BTN.auto.dec.h + 26, 21, '#f6e3b4', UI, 700);
    if (L.wide && scene !== 'over') { /* the brand lives on the title and result screens only; never over play */ }
  }

  const heads = scene === 'title' || scene === 'demo-limit' || scene === 'look' || scene === 'campaign' || (scene === 'puzzle' && state.pz.status === 'making');
  if (heads) {
    const T = L.title(!!state.saved), LK = L.look;
    if (scene === 'title' || scene === 'demo-limit') { if (T.board) drawBoard(ctx, state.look.board, { ...T.board, layer: null }); }
    else if (scene === 'look' && LK.board) drawBoard(ctx, state.look.board, { ...LK.board });
    const dim = scene === 'campaign' ? null : scene === 'look' ? LK.dim : T.dim;
    ctx.fillStyle = 'rgba(8,12,6,0.62)';
    if (scene === 'campaign') { ctx.fillStyle = 'rgba(8,12,6,0.72)'; ctx.fillRect(0, 0, L.w, L.h); }
    else if (dim) ctx.fillRect(dim.x, dim.y, dim.w, dim.h);
    else if (scene !== 'puzzle') { ctx.fillStyle = 'rgba(8,12,6,0.34)'; ctx.fillRect(0, 0, L.w, L.h); }
    if (scene === 'title' || scene === 'demo-limit') { if (T.hero) hero(T.hero, NAME, 'One hare. Three hounds. One narrow board.', true, false); }
    if ((scene === 'title' || scene === 'demo-limit') && T.lock) drawTitleLockup(ctx, T.lock, state.lockPress > 0);
    else if (scene === 'look' && LK.hero) hero(LK.hero, 'Board and pieces', 'Earned by winning. Never for sale.', LK.hero.pieces, false);
    if (scene === 'title' && T.card) panel(T.card, 24);
    if (scene === 'look' && LK.card) panel(LK.card, 24);
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text("Preparing today's puzzle…", L.w / 2, L.h / 2, 34, '#fff3d6', UI, 600); button(L.BTN.menu, 'Menu', { size: 26 }); }
  if (scene === 'campaign') {
    const C = L.camp, H = C.hdr;
    text('Campaign', H.title.x, H.title.y, H.title.size); text('Twelve hunts. Win each with as few moves as you can.', H.sub.x, H.sub.y, H.sub.size, 'rgba(246,227,180,0.85)', FONT, 400);
    let total = 0; for (let i = 0; i < CAMPAIGN.length; i++) total += state.stats.camp[i] || 0;
    text(`★ ${total} of ${CAMPAIGN.length * 3}`, H.total.x, H.total.y, H.total.size, '#ffd24a', UI, 700);
    CAMPAIGN.forEach((c, i) => {
      const r = C.tile(i), k = C.k, open = i === 0 || (state.stats.camp[i - 1] || 0) > 0 || state.dev, stars = state.stats.camp[i] || 0;
      ctx.save(); ctx.translate(r.x, r.y); ctx.scale(k, k); if (!open) ctx.globalAlpha = 0.45;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(3, 5, 200, 208, 18); ctx.fill();
      const gr = ctx.createLinearGradient(0, 0, 0, 208); gr.addColorStop(0, stars ? '#7d6a38' : '#5a4c2c'); gr.addColorStop(1, '#2e2514'); ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(0, 0, 200, 208, 18); ctx.fill();
      ctx.strokeStyle = stars === 3 ? '#ffd24a' : 'rgba(255,232,170,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      text(String(i + 1), 34, 46, 40, '#f6e3b4', FONT);
      piece(c.side, { x: 148, y: 84, s: 1 }, { scale: 0.4 });
      wrap(open ? c.name : 'Locked', 100, 128, Math.max(22, minPx / k), 176, '#fff3d6', 26);
      for (let s = 0; s < 3; s++) text('★', 64 + s * 36, 186, 34, s < stars ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700);
      ctx.restore();
    });
    button(C.menu, 'Menu', { size: 26 });
    if (state.msg) wrap(state.msg.text, C.msg.x, C.msg.y, 24, C.msg.w, '#ffe9b0');
  }
  if (scene === 'look') {
    const LK = L.look;
    for (const l of LK.labels) text(l.t, l.x, l.y, 24, 'rgba(246,227,180,0.9)', UI, 600, l.align);
    ['autumn', 'winter', 'night'].forEach((k, i) => { const ok = unlocked(state, 'board', k); button(LK.woods[i], ok ? BOARD_NAMES[k] : `${BOARD_NAMES[k]} (locked)`, { size: 22, primary: state.look.board === k, dim: !ok }); });
    ['wild', 'snow'].forEach((k, i) => { const ok = unlocked(state, 'set', k); button(LK.sets[i], ok ? SET_NAMES[k] : `${SET_NAMES[k]} (locked)`, { size: 26, primary: state.look.set === k, dim: !ok }); });
    button(LK.text[0], 'Normal', { size: 26, primary: !big }); button(LK.text[1], 'Large', { size: 30, primary: big });
    button(LK.back, 'Back', { size: 30 });
    if (state.msg) wrap(state.msg.text, LK.msg.x, LK.msg.y, big ? 30 : 24, LK.msg.w, '#ffe9b0');
    text(`Wins so far: ${state.stats.wins}`, LK.wins.x, LK.wins.y, 22, 'rgba(246,227,180,0.7)', UI, 500);
  }
  if (scene === 'title') {
    const T = L.title(!!state.saved), R = T.rows, solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    button(R.campaign, 'Campaign', { size: 30 });
    button(R.hare, 'Play the Hare', { size: 26 }); button(R.hound, 'Play the Hounds', { primary: state.learned && !R.resume, size: 26 });
    button(R.two, 'Two players, one phone', { size: 28 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 }); button(R.marks, state.marks ? "Hare's reach: on" : "Hare's reach: off", { size: 21 }); button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20 });
    button(R.look, 'Board and pieces', { size: 24 }); button(R.rules, 'Rules', { size: 24 }); button(R.auto, 'Auto Play', { size: 24 });
    if (T.badges) {                                             // badges: one star per level beaten with each side
      for (const b of T.badges.rows) {
        text(b.label, b.x, b.y, 22, 'rgba(246,227,180,0.85)', UI, 600, 'left');
        for (let l = 0; l < LEVELS.length; l++) text('★', b.x + 96 + l * 36, b.y + 2, 30, state.stats.badges[b.side + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
      }
      text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, T.badges.games.x, T.badges.games.y, 22, 'rgba(246,227,180,0.7)', UI, 500);
    }
    if (state.msg) wrap(state.msg.text, T.msgX, T.msgY, 24, Math.min(620, L.w - 40), '#ffe9b0');
  } else if (scene === 'demo-limit') {
    const cy = L.h / 2 - 60;
    text('That was the free taste.', L.w / 2, cy, 44); text('Get Hare and Hounds on iPhone and Android', L.w / 2, cy + 70, 28, '#fff3d6', UI, 600); text('for unlimited games.', L.w / 2, cy + 110, 28, '#fff3d6', UI, 600);
  } else if (scene === 'over') {
    const O = L.over;
    ctx.fillStyle = 'rgba(6,10,6,0.74)'; ctx.fillRect(0, 0, L.w, L.h);
    if (O.card) panel(O.card, 24, 'rgba(14,10,4,0.5)');
    const won = state.two ? `${SIDE[g.winner]} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
    ctx.save(); ctx.translate(O.tx, O.ty); ctx.scale(O.sc, O.sc);
    (g.winner === 'H' ? drawHare : drawHound)(ctx, 360, 430, g.winner === 'H' ? 130 : 118, { set });
    text(won, 360, 700, 62); text(g.reason, 360, 752, 28, '#fff3d6', UI, 500);
    text(`${g.hm} hound move${g.hm === 1 ? '' : 's'} of ${g.limit}`, 360, 796, 24, 'rgba(246,227,180,0.8)', UI, 500);
    if (state.result) {
      const r = state.result;
      if (r.stars) for (let s = 0; s < 3; s++) text('★', 360 - 44 + s * 44, 850, 46, s < r.stars ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700);
      else if (r.note) text(r.note, 360, 850, 24, '#ffd24a', UI, 600);
      if (r.stars && r.note) text(r.note, 360, 880, 22, 'rgba(246,227,180,0.85)', UI, 500);
    }
    if (!state.two && g.winner === state.human && !state.calm) for (let k = 0; k < 14; k++) {                        // gold sparks drifting up around the winner
      const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380;
      ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    const hasNext = state.camp >= 0 && state.camp + 1 < CAMPAIGN.length, bs = overButtons(state.camp, !state.two && g.winner === state.human, hasNext), rs = O.rects(bs.length);
    bs.forEach((b, i) => button(rs[i], b.label, { primary: b.primary, size: b.primary ? 34 : 30 }));
    const mp = O.more(bs.length); drawMoreLine(ctx, mp.x, mp.y, 24);                   // a quiet line, text only
  } else if (scene === 'rules') {
    const RL = L.rules, P2 = RL.panel, vp = RL.viewport, sc0 = rulesScrollNow(state);
    ctx.fillStyle = 'rgba(6,10,6,0.74)'; ctx.fillRect(0, 0, L.w, L.h);
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;      // falls back to 1 for any out-of-range index

    // The reader card: one framed panel holding the page title, the piece portrait (if any) and the body text.
    ctx.save();
    ctx.beginPath(); ctx.roundRect(P2.x, P2.y, P2.w, P2.h, 28);
    const pg = ctx.createLinearGradient(0, P2.y, 0, P2.y + P2.h);
    pg.addColorStop(0, 'rgba(34,26,12,0.6)'); pg.addColorStop(1, 'rgba(12,9,4,0.72)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(246,227,180,0.3)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(P2.x + 6, P2.y + 6, P2.w - 12, P2.h - 12, 22);
    ctx.strokeStyle = 'rgba(246,227,180,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // Header row: the screen title (capped a touch below the body's own growth), flanked by the text-size stepper (A-/A+).
    text('Rules', RL.cx - 40, RL.titleY, Math.round(44 * Math.min(scale, 1.15)));
    ctx.strokeStyle = 'rgba(246,227,180,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P2.x + 40, vp.y - 8); ctx.lineTo(P2.x + P2.w - 40, vp.y - 8); ctx.stroke();

    // The body scrolls inside the viewport (drag, wheel, keys, scroll bar). A page that fits never moves.
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const cxp = vp.x + vp.w / 2, maxW = Math.min(vp.w - 30, 820), titleSize = Math.round(32 * scale), titleLH = Math.round(titleSize * 1.15);
    const fontPx = Math.round(29 * scale), lh = Math.round(fontPx * 1.42), gap = Math.round(12 * scale);
    const bodyAsc = memo(`a|${fontPx}`, () => { ctx.font = `600 ${fontPx}px ${UI}`; return ctx.measureText('Ag').fontBoundingBoxAscent || fontPx * 0.8; });
    const visTop = vp.y - 120, visBot = vp.y + vp.h + 120;   // only the visible slice is drawn
    let yy = vp.y + 8 - sc0, endY = yy;
    // ONE continuous document: every page's title, optional piece portrait and text, in order.
    for (const page of RULES) {
      const ty0 = yy + 6 + titleSize * 0.9;
      const tls = lines(page.title, titleSize, maxW, 700), titleLineCount = tls.length;
      if (ty0 + tls.length * titleLH > visTop && ty0 - titleSize < visBot) tls.forEach((ln, i) => text(ln, cxp, ty0 + i * titleLH, titleSize, '#ffd684', UI, 700, 'center'));
      const titleDesc = memo(`d|${page.title}|${titleSize}`, () => { ctx.font = `700 ${titleSize}px ${UI}`; return ctx.measureText(page.title).fontBoundingBoxDescent || titleSize * 0.25; }), titleBottom = ty0 + (titleLineCount - 1) * titleLH + titleDesc;
      let y;
      if (page.piece) {
        const iconY = titleBottom + 110;
        if (iconY > visTop - 120 && iconY < visBot + 120) (page.piece === 'H' ? drawHare : drawHound)(ctx, cxp, iconY, 62, { set });
        y = iconY + 90 + Math.round(20 * scale) + bodyAsc;
      } else y = titleBottom + Math.round(14 * scale) + bodyAsc;
      for (const line of page.lines) {
        const ls = lines(line, fontPx, maxW);
        if (y + ls.length * lh > visTop && y - fontPx < visBot) ls.forEach((ln, i) => text(ln, cxp, y + i * lh, fontPx, '#f6e3b4', UI, 600, 'center'));
        y += ls.length * lh + gap;
      }
      endY = y - gap - fontPx * 0.4;
      yy = endY + 34;
    }
    const contentH = Math.max(0, endY + sc0 - vp.y + 24);
    ctx.restore();
    rulesMetrics.view = vp.h;
    rulesMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h);   // a few units of overshoot is not worth a scroll bar
    if (rulesMetrics.max > 0) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(20,15,8,${a0})`); gr.addColorStop(1, `rgba(20,15,8,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < rulesMetrics.max - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 24, vp.y, 0, 0.95);
      const sb = RL.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), tyy = sb.y + (sc0 / rulesMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(246,227,180,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(246,227,180,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, tyy, 12, th, 6); ctx.fill();
    }
    if (rulesMetrics.max > 0) text(`${Math.round(100 * sc0 / rulesMetrics.max)}% read`, RL.cx, RL.counterY, 20, 'rgba(246,227,180,0.65)', UI, 500);
    button(RL.header.textDec, 'A−', { size: 30, dim: state.textScaleIdx === 0 });
    button(RL.header.textInc, 'A+', { size: 30, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    button(RL.nav.back, 'Back', { size: 28 }); button(RL.nav.next, rulesMetrics.max <= 0 || sc0 >= rulesMetrics.max - 2 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}
