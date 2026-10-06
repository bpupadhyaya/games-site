// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// All positions come from the live layout `L` (layout.js: layoutFor(w, h)), so the same code serves every phone and tablet in portrait and
// landscape. The board scene (slab, pieces, glows) is drawn in canonical phone coordinates through the layout's one transform `L.board`;
// header, cards and buttons are drawn in screen units. Static art (snowfield, board) and the two pieces are cached sprites (art.js, pieces.js).
import { PIECE_R, SIZE, UNIT, TEXT_SCALES, THINK_STEPS, host, pointAt } from './layout.js';
import { drawField, drawBoardLayer, BOARD_NAMES } from './art.js';
import { drawFox, drawGoose, SET_NAMES } from './pieces.js';
import { unlocked, starNeed } from './unlocks.js';
import { legalMoves, threatened, PTS, FOX_WINS_AT, geeseLeft } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PUZZLE_TEXT } from './puzzles.js';
import { RULES } from './content.js';
import { drawCredit, drawTitleLockup, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SIDE = { G: 'Geese', F: 'Fox' };
const TAU = Math.PI * 2;
const INK = '#eef7ff', SOFT = 'rgba(196,222,246,0.82)';
// Geese face the middle of the board, so a flock looks like it is watching the fox. (A goose in the middle column faces by row.)
export const flipOf = (i) => { const x = i % 7; return x < 3 || (x === 3 && Math.floor(i / 7) % 2 === 0); };

// Snowflakes drift down slowly (a fixed handful, positions computed from the clock, nothing stored).
const FLAKES = Array.from({ length: 84 }, (_, i) => ({ x: ((i * 97.13) % 720) / 720, y: ((i * 211.7) % 1560) / 1560, v: 14 + (i % 7) * 4.5, r: 1 + (i % 3) * 0.7, ph: i * 1.7 }));

// Rules-page scroll limits, measured while drawing and read by game.js to clamp scrolling. `ui.buttons` lists every button drawn in the
// last frame (used by the layout checks in the dev scripts).
export const rulesMetrics = { max: 0, view: 0 };
export const ui = { buttons: [] };

// Text-fit cache: wrapped lines and shrink-to-fit sizes are computed once per (font, size, width, text) and reused every frame (the Rules reader
// used to re-wrap its whole document each frame). Dropped when a web font finishes loading. readerStats.fits counts cache misses (tests read it).
const fitMemo = new Map(); let fitFontsKey = '';
export const readerStats = { fits: 0, rects: [] };   // rects: this frame's Rules blocks {k, top, bot} in document order (the overlap test reads them)

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.buttons.length = 0;
  const { w, h } = L;
  drawField(ctx, w, h);
  const set = state.look.set, big = state.look.big;
  const g = state.game, a = state.anim, scene = state.scene, hud = L.hud, B = L.board;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'autoplay' || (scene === 'puzzle' && state.pz.status !== 'making');
  const hudScene = boardScene && !(scene === 'over' && !L.over.drawBoard);          // wide result: art + buttons only, no board furniture
  const minU = Math.max(12, 11 / (host.px || 0.6));                                  // smallest type (units) that is still ~11 css px

  const text = (str, x, y, size, color = INK, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  // single line that shrinks until it fits maxW
  const fitText = (str, x, y, size, maxW, color, font = FONT, weight = 700, align = 'center', min = minU) => {
    let s = size;
    if (maxW) s = memo(`f|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
    text(str, x, y, s, color, font, weight, align);
  };
  const spec = (t, str, color = INK, font = UI, weight = 700) => fitText(str, t.x, t.y, t.size, t.maxW, color, font, weight, t.align);
  const lines = (str, size, maxW, weight = 600) => memo(`l|${weight}|${size}|${maxW}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const wd of words) { const t2 = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = wd; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => {
    const ls = lines(str, size, maxW); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return ls.length;
  };
  // wrap text into a box, shrinking the type until it fits the box's height (and width, and optional line count)
  const wrapBox = (str, r, size, lhRatio, color, align = 'center', min = minU, maxLines = 99) => {
    const s = memo(`b|${str}|${size}|${r.w}|${r.h}|${lhRatio}|${min}|${maxLines}`, () => { let q = size, l2 = lines(str, q, r.w); while (q > min && (l2.length > maxLines || l2.length * q * lhRatio > r.h || l2.some((l) => ctx.measureText(l).width > r.w + 0.5))) { q -= 1; l2 = lines(str, q, r.w); } return q; });
    const ls = lines(str, s, r.w);
    const lh = s * lhRatio, x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    ls.forEach((ln, i) => text(ln, x, r.y + s + i * lh, s, color, UI, 600, align));
    return { n: ls.length, s, lh };
  };
  const panelRect = (r, rad = 18, fill = 'rgba(4,10,20,0.52)', stroke = 'rgba(160,206,244,0.22)') => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  };
  const brandPanel = (r, rad = 18, fill) => { panelRect(r, rad, fill); edgeStroke(ctx, r, rad, 0.42); };
  // k: 'F' | 'G'. The head is drawn a little above the point, so it stands ON it.
  const piece = (k, pos, opts = {}) => { const r = PIECE_R * pos.s * SIZE[k] * (opts.scale ?? 1); (k === 'F' ? drawFox : drawGoose)(ctx, pos.x, pos.y - r * (k === 'F' ? 0.6 : 0.72), r, { set, ...opts }); };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#ffd684' : '#3f5c78'); gr.addColorStop(1, o.primary ? '#e79a3c' : '#223649');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,200,0.7)' : 'rgba(190,222,250,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    // the label: one line if it fits, else a smaller line, else two lines (whichever stays largest)
    const size = Math.min(o.size ?? 30, r.h * 0.5), maxW = r.w - 20, col = o.primary ? '#2a1606' : INK, cy = r.y + r.h / 2, floor = Math.max(13, minU - 1);
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${UI}`; return ctx.measureText(str).width; };
    let s1 = size; while (s1 > floor && w1(label, s1) > maxW) s1 -= 1;
    let best = { s: s1, ls: [label] };
    if (s1 < size && label.includes(' ')) {
      const ws = label.split(' ');
      for (let cut = 1; cut < ws.length; cut++) {
        const ls = [ws.slice(0, cut).join(' '), ws.slice(cut).join(' ')]; let s2 = size;
        while (s2 > floor && (Math.max(w1(ls[0], s2), w1(ls[1], s2)) > maxW || s2 * 2.25 > r.h)) s2 -= 1;
        const mw = Math.max(w1(ls[0], s2), w1(ls[1], s2)); if (s2 > best.s || (s2 === best.s && best.ls.length === 2 && mw < best.mw)) best = { s: s2, ls, mw };
      }
    }
    if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };
  const glow = (i, rgb, pulse) => { const p = pointAt(i); ctx.fillStyle = `rgba(${rgb},${0.45 + pulse * 0.3})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 25 * UNIT * p.s, 21 * UNIT * p.s, 0, 0, TAU); ctx.fill(); };
  const onBoard = (fn) => { ctx.save(); ctx.translate(B.tx, B.ty); ctx.scale(B.s, B.s); fn(); ctx.restore(); };

  // snow drifting down over the scene (not in reduced-motion mode)
  if (!state.calm) {
    ctx.fillStyle = 'rgba(232,244,255,0.55)';
    const n = Math.max(40, Math.min(84, Math.round((44 * w * h) / (720 * 1560))));
    for (let i = 0; i < n; i++) { const f = FLAKES[i], y = (f.y * h + state.t * f.v) % (h + 20) - 10, x = f.x * w + Math.sin(state.t * 0.5 + f.ph) * 22; ctx.beginPath(); ctx.arc(x, y, f.r, 0, TAU); ctx.fill(); }
  }

  // where the moving piece is right now (canonical board coordinates)
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), ease = f * f * (3 - 2 * f), to = pointAt(a.to), from = pointAt(a.from);
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
  const hero = (Hh, heading, sub, credit) => {
    ctx.save(); ctx.translate(Hh.hx, Hh.hy); ctx.scale(Hh.sc, Hh.sc);
    text(heading, 360 + Hh.dx, 150, credit ? 56 : 46);
    if (sub) text(sub, 360, credit ? 200 : 205, 26, SOFT, FONT, 400);
    const bob = state.calm ? 0 : Math.sin(state.t * 1.1) * 3;                       // the two heads breathe a little (never the board)
    drawFox(ctx, 205, 505 + bob, 128, { set }); drawGoose(ctx, 520, 505 - bob, 112, { set, flip: true });
    ctx.restore();
  };
  const sceneHeading = (T) => {                                                      // the dark ground that carries a title-like screen's buttons
    if (T.drawBoard) {
      onBoard(() => { drawBoardLayer(ctx, state.look.board); for (const i of PTS) { const k = state.game.board[i]; if (k) piece(k, pointAt(i), { flip: k === 'G' && flipOf(i) }); } });
      const y0 = T.dim.y - 200, dark = ctx.createLinearGradient(0, y0, 0, T.dim.y); dark.addColorStop(0, 'rgba(4,10,20,0)'); dark.addColorStop(0.5, 'rgba(4,10,20,0.9)'); dark.addColorStop(1, 'rgba(4,10,20,0.94)');
      ctx.fillStyle = dark; ctx.fillRect(0, y0, w, 200); ctx.fillStyle = 'rgba(4,10,20,0.94)'; ctx.fillRect(0, T.dim.y, w, h - T.dim.y);
    } else if (T.dim) {
      const y0 = T.dim.y - 70, dark = ctx.createLinearGradient(0, y0, 0, T.dim.y); dark.addColorStop(0, 'rgba(4,10,20,0)'); dark.addColorStop(1, 'rgba(4,10,20,0.9)');
      ctx.fillStyle = dark; ctx.fillRect(0, y0, w, 70); ctx.fillStyle = 'rgba(4,10,20,0.9)'; ctx.fillRect(0, T.dim.y, w, h - T.dim.y);
      const gl = ctx.createLinearGradient(0, 0, w, 0); gl.addColorStop(0, 'rgba(150,96,250,0)'); gl.addColorStop(0.5, 'rgba(70,132,252,0.55)'); gl.addColorStop(1, 'rgba(24,198,252,0)');
      ctx.fillStyle = gl; ctx.fillRect(0, T.dim.y - 1, w, 2);
    } else if (T.card) brandPanel(T.card, 22, 'rgba(4,10,20,0.78)');
  };

  // ---- the board scene ------------------------------------------------------------------------------------
  if (boardScene && (scene !== 'over' || L.over.drawBoard)) onBoard(() => {
    drawBoardLayer(ctx, state.look.board);
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    if (state.sel >= 0 && !a) for (const m of legalMoves(g)) if (m.from === state.sel) glow(m.to, m.type === 'jump' ? '255,140,90' : '255,244,170', pulse);
    if (g.chain >= 0 && !a && scene !== 'over' && (state.two || g.turn === state.human)) for (const m of legalMoves(g)) if (m.type === 'jump') glow(m.to, '255,140,90', pulse);
    if (state.hint && !a) { glow(state.hint.to, '120,255,170', pulse); if (state.hint.from >= 0) glow(state.hint.from, '120,255,170', pulse); }
    // Auto Play REVEAL: every legal option glows softly, the one about to be taken glows distinctly brighter
    // (gold at its destination, green at its origin) so the viewer can compare their own guess.
    if (scene === 'autoplay' && state.ap.phase === 'reveal' && !a) {
      const chosen = state.ap.chosen;
      for (const m of state.ap.options) { if (chosen && m.type === chosen.type && m.to === chosen.to && (m.from ?? -1) === (chosen.from ?? -1)) continue; glow(m.to, '150,190,255', 0.4); }
      if (chosen) { glow(chosen.to, '255,208,90', pulse); if (chosen.type !== 'stop') glow(chosen.from, '120,255,170', pulse); }
    }
    const danger = state.marks && scene !== 'over' ? threatened(g) : new Set();
    for (const i of PTS) {                               // far rows first; the moving piece is drawn where it is, not where it will be
      if (a && a.type === 'jump' && i === a.over) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (a.t / a.dur) * 1.6); piece('G', pointAt(i), { flip: flipOf(i) }); ctx.restore(); }
      if (a && ((a.type !== 'refuse' && i === a.to) || (a.type === 'refuse' && i === a.from))) continue;
      const k = g.board[i]; if (!k) continue;
      const sel = state.sel === i || (k === 'F' && g.chain === i && !a);
      piece(k, pointAt(i), { selected: sel, lift: sel ? 0.5 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0, threat: k === 'G' && danger.has(i), flip: k === 'G' && flipOf(i) });
    }
    if (a) { const pos = animPos(); piece(a.kind, pos, { lift: pos.lift, selected: a.type === 'refuse', flip: a.kind === 'G' && flipOf(a.from) }); }
    // a capture lands with a ring of snow dust that spreads and fades (skipped in reduced-motion mode)
    if (a && a.type === 'jump' && !state.calm && a.t / a.dur > 0.55) {
      const f = (a.t / a.dur - 0.55) / 0.45, p = pointAt(a.to);
      ctx.strokeStyle = `rgba(235,246,255,${0.75 * (1 - f)})`; ctx.lineWidth = 6 * (1 - f) + 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, (20 + 60 * f) * UNIT * p.s, (16 + 44 * f) * UNIT * p.s, 0, 0, TAU); ctx.stroke();
    }
    if (state.kb && scene !== 'over') { const c = pointAt(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 34 * UNIT * c.s, 28 * UNIT * c.s, 0, 0, TAU); ctx.stroke(); }
  });

  if (hudScene && L.wide) {                                                           // landscape: a status card left and a button card right
    brandPanel(L.leftCard, 18); brandPanel(L.rightCard, 18);
    if (L.badgeFits) drawBadgeStack(ctx, L.rightCard.x + L.rightCard.w / 2, L.rightCard.y + L.rightCard.h - 16, L.rightCard.w - 24);
  }

  // ---- header, message and buttons ------------------------------------------------------------------------
  if (hudScene) {
    const body = (str, b, color) => wrapBox(str, b, big ? b.bigSize : b.size, b.lh / b.size, color, b.align, minU);
    const left = geeseLeft(g), humanChain = g.chain >= 0 && (state.two || g.turn === state.human) && !g.winner;
    const tray = (fn) => { for (let k = 0; k < g.flock; k++) piece('G', fn(k, g.flock), { scale: hud.trayK, dim: k >= left, flip: true }); };
    const icon = (side, I) => piece(side, { x: I.x, y: I.y, s: 1 }, { scale: (side === 'F' ? 1.2 : 1.3) * I.k });
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i], H = hud.lesson;
      spec(H.label, `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, SOFT, UI, 600);
      spec(H.title, l.title, INK, FONT, 700);
      body(state.lesson.done ? l.done : l.text, H.body, state.lesson.done ? '#c9f7c0' : '#ffffff');
    } else if (scene === 'puzzle') {
      const t = PUZZLE_TEXT[state.pz.puzzle.type], H = hud.puzzle;
      spec(H.label, 'Daily puzzle', SOFT, UI, 600);
      icon(t.side, H.icon);
      spec(H.title, t.title, '#ffffff', UI, 700);
      body(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : t.goal(state.pz.puzzle.n), H.body, '#eef7ff');
      spec(H.streak, `Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'} · geese captured so far: ${g.captured}`, INK, UI, 600);
    } else if (scene === 'autoplay') {
      const A = state.ap, left0 = THINK_STEPS[state.apThinkIdx] - A.t, H = hud.ap;
      const phaseText = A.paused ? 'Paused' : A.phase === 'think' ? `Think: what would you play? (${Math.max(0, left0).toFixed(0)}s)` : A.phase === 'reveal' ? 'Here is the move about to be played…' : 'Playing the move…';
      spec(H.label, 'Auto Play — watch and learn', SOFT, UI, 600);
      icon(g.turn, H.icon);
      spec(H.turn, `${SIDE[g.turn]} to move${g.chain >= 0 ? ' (chain)' : ''}`, '#ffffff', UI, 700);
      wrapBox(phaseText, H.phase, H.phase.size, H.phase.lh / H.phase.size, '#ffe9b0', H.phase.align, minU);
      spec(H.left, `Geese left: ${left} of ${g.flock}`, INK, UI, 600);
      spec(H.level, `Computer: ${LEVELS[state.level].name}`, SOFT, UI, 500);
      tray(hud.apTray);
      // Sits below the kit's own top-centre "Preview m:ss" badge (kit/preview.js), never under it.
      spec(H.think, `Think time: ${THINK_STEPS[state.apThinkIdx]}s`, INK, UI, 700);
    } else {
      if (hud.title) spec(hud.title, 'Fox and Geese', INK, FONT, 700);
      const chain = g.chain >= 0;
      const turnText = g.winner ? '' : state.two ? `${SIDE[g.turn]} to move` : g.turn === state.human ? (chain ? 'Jump again, or stop' : `Your move (${g.turn === 'F' ? 'fox' : 'geese'})`) : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
      icon(g.turn, hud.icon);
      spec(hud.turn, turnText, '#ffffff', UI, 700);
      spec(hud.mode, state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name} · flock of ${g.flock}`, SOFT, UI, 500);
      spec(hud.left, `Geese left: ${left} of ${g.flock}`, INK, UI, 600);
      spec(hud.foxwins, `Fox wins when ${FOX_WINS_AT} are left`, SOFT, UI, 500);
      tray(hud.tray);
    }

    // the message: a banner (phone) or a framed box (other shapes), fading in and out
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5), M = hud.msg;
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      if (M.auto) {
        const ms = big ? 32 : 25, lh = big ? 40 : 32; ctx.font = `600 ${ms}px ${UI}`;
        const ls = lines(state.msg.text, ms, M.maxW), bh = 30 + ls.length * lh, y0 = scene === 'play' ? M.y : M.lowY;
        ctx.fillStyle = 'rgba(6,14,26,0.92)'; ctx.beginPath(); ctx.roundRect(M.x, y0, M.w, bh, 16); ctx.fill();
        ctx.strokeStyle = 'rgba(160,206,244,0.8)'; ctx.lineWidth = 2; ctx.stroke();
        ls.forEach((ln, i) => text(ln, M.x + M.w / 2, y0 + 38 + i * lh, ms, '#f2f9ff', UI, 600));
      } else {
        const r = scene === 'play' || !M.lowRect ? M.rect : M.lowRect;
        panelRect(r, 14, 'rgba(6,14,26,0.94)', 'rgba(160,206,244,0.8)');
        wrapBox(state.msg.text, { x: r.x + 12, y: r.y + 8, w: r.w - 24, h: r.h - 16 }, big ? M.size + 4 : M.size, M.lh / M.size, '#f2f9ff', 'center', M.min ?? minU, M.maxLines ?? 99);
      }
      ctx.restore();
    }
    const BT = L.BTN;
    if (scene === 'play') { button(BT.menu, 'Menu', { size: 26 }); button(BT.undo, 'Take back', { size: 26 }); if (humanChain) button(BT.stop, 'Stop here', { size: 26, primary: true }); else button(BT.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BT.menu, 'Menu', { size: 26 }); if (state.lesson.done) button(BT.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); else if (humanChain) button(BT.stop, 'Stop here', { size: 26, primary: true }); }
    else if (scene === 'puzzle') { button(BT.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(BT.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'autoplay') {
      const AB = BT.auto;
      button(AB.exit, 'Exit', { size: 26 }); button(AB.pause, state.ap.paused ? 'Resume' : 'Pause', { size: 26, primary: state.ap.paused }); button(AB.skip, 'Skip', { size: 26 });
      button(AB.dec, '−', { size: 30, dim: state.apThinkIdx === 0 }); button(AB.inc, '+', { size: 30, dim: state.apThinkIdx === THINK_STEPS.length - 1 });
    }
  }

  // ---- title-like screens: the title, the look page, the preview limit, the puzzle being made -------------------------------
  const making = scene === 'puzzle' && state.pz.status === 'making';
  if (scene === 'title' || scene === 'demo-limit' || scene === 'look' || making) {
    const T = scene === 'look' ? L.look : L.title(!!state.saved);
    sceneHeading(T);
    if (scene === 'look') hero(T.hero, 'Board and pieces', 'Earned by winning. Never for sale.', false); else hero(T.hero, 'Fox and Geese', 'One fox. A flock of geese. A cross of frost.', true);
    if ((scene === 'title' || scene === 'demo-limit') && T.lock) drawTitleLockup(ctx, T.lock, state.lockPress > 0);
    if (making) {
      const z = T.zone ?? { x: 40, y: h * 0.6, w: w - 80, h: 200 };
      fitText("Preparing today's puzzle…", z.x + z.w / 2, z.y + z.h * 0.35, 34, z.w, '#eef7ff', UI, 600);
      button(T.makingMenu ?? L.BTN.menu, 'Menu', { size: 26 });
    }
    if (scene === 'demo-limit') {
      const z = T.zone, cx = z.x + z.w / 2, cy = z.y + z.h * 0.3;
      fitText('That was the free taste.', cx, cy, 44, z.w, INK, FONT, 700);
      fitText('Get Fox and Geese on iPhone and Android', cx, cy + 66, 28, z.w, '#eef7ff', UI, 600); fitText('for unlimited games.', cx, cy + 106, 28, z.w, '#eef7ff', UI, 600);
    }
    if (scene === 'look') {
      for (const lb of T.labels) text(lb.t, lb.x, lb.y, 24, SOFT, UI, 600, 'left');
      ['frost', 'slate', 'moss'].forEach((k, i) => { const ok = unlocked(state, 'board', k); button(T.boards[i], ok ? BOARD_NAMES[k] : `${BOARD_NAMES[k]} (locked)`, { size: 23, primary: state.look.board === k, dim: !ok }); });
      ['classic', 'dusk'].forEach((k, i) => { const ok = unlocked(state, 'set', k); button(T.sets[i], ok ? SET_NAMES[k] : `${SET_NAMES[k]} (locked)`, { size: 26, primary: state.look.set === k, dim: !ok }); });
      button(T.text[0], 'Normal', { size: 26, primary: !big }); button(T.text[1], 'Large', { size: 30, primary: big });
      button(T.back, 'Back', { size: 30 });
      if (state.msg) wrapBox(state.msg.text, { x: T.msg.x - T.msg.w / 2, y: T.msg.y - 24, w: T.msg.w, h: 70 }, big ? 30 : 24, 1.3, '#ffe9b0', 'center', minU, T.msg.maxLines);
      text(`Wins so far: ${state.stats.wins}`, T.wins.x, T.wins.y, 22, SOFT, UI, 500);
    }
    if (scene === 'title') {
      const R = T.rows, solvedToday = state.daily.solvedDay === state.daily.day;
      if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
      button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
      button(R.fox, 'Play as the Fox', { size: 30 }); button(R.geese, 'Play as the Geese', { primary: state.learned && !R.resume, size: 30 });
      button(R.two, 'Two players, one phone', { size: 28 });
      button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
      button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.flock, `Flock: ${state.flock} geese${state.flock === 13 ? ' (classic)' : ''}`, { size: 22 });
      button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 }); button(R.marks, state.marks ? 'Warnings on' : 'Warnings off', { size: 22 });
      button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20 }); button(R.look, 'Board and pieces', { size: 22 });
      button(R.rules, 'Rules', { size: 22 }); button(R.auto, 'Auto Play', { size: 22 });
      // badges: one star per level beaten with each side
      const S = T.stars;
      if (S.show) {
        const gw = 90 + LEVELS.length * 36, tot = 2 * gw + 30, k = Math.min(1, (T.zone ? T.zone.w : 560) / tot), x00 = S.x - (tot * k) / 2;
        ctx.save(); ctx.translate(x00, S.y); ctx.scale(k, k);
        [['G', 0, 'Geese'], ['F', gw + 30, 'Fox']].forEach(([side, x0, label]) => {
          text(label, x0, 0, 22, SOFT, UI, 600, 'left');
          for (let l = 0; l < LEVELS.length; l++) text('★', x0 + 84 + l * 36, 2, 30, state.stats.badges[side + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
        });
        text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, tot / 2, 44, 22, 'rgba(196,222,246,0.65)', UI, 500);
        ctx.restore();
      }
      if (state.msg) fitText(state.msg.text, T.msgX ?? w / 2, T.msgY, 24, Math.min(620, w - 48), '#ffe9b0', UI, 600);
      if (state.dev) button(T.dev, `Dev: lesson ${(state.devLesson ?? 0) + 1}`, { size: 22 });
    }
  } else if (scene === 'over') {
    const O = L.over;
    ctx.fillStyle = 'rgba(4,10,20,0.74)'; ctx.fillRect(0, 0, w, h);
    if (O.card) brandPanel(O.card, 22, 'rgba(4,10,20,0.78)');
    // A win/star belongs to the player's own real progress; an Auto Play session never touches it
    // (state.starEarned stays false and stats/save are never written for it - see startAutoplay()).
    const realWin = !state.two && !state.overFromAutoplay && g.winner === state.human;
    const won = g.winner === 'draw' ? 'A draw' : (state.two || state.overFromAutoplay) ? `${SIDE[g.winner]} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
    ctx.save(); ctx.translate(O.tx, O.ty); ctx.scale(O.sc, O.sc);
    if (g.winner !== 'draw') (g.winner === 'F' ? drawFox : drawGoose)(ctx, 360, 520, g.winner === 'F' ? 170 : 130, { set, flip: true });
    if (state.overFromAutoplay) text('Auto Play', 360, 460, 24, SOFT, UI, 600);
    fitText(won, 360, 720, 64, 640, INK, FONT, 700); fitText(g.reason, 360, 780, 28, 640, '#eef7ff', UI, 500);
    text(`${g.moves} moves · ${g.captured} ${g.captured === 1 ? 'goose' : 'geese'} captured`, 360, 826, 24, SOFT, UI, 500);
    if (realWin && state.starEarned) {
      fitText(`★ ${LEVELS[state.level].name} beaten as the ${state.human === 'F' ? 'fox' : 'geese'}`, 360, 868, 24, 640, '#ffd24a', UI, 600);
    } else if (realWin) {
      fitText(`A win, but no star: as the ${state.human === 'F' ? 'fox' : 'geese'} a star needs ${starNeed(state.human, state.level)}`, 360, 868, 21, 640, SOFT, UI, 500);
    }
    if (realWin && !state.calm) for (let k = 0; k < 14; k++) {        // pale sparks drifting up around the winner
      const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380;
      ctx.fillStyle = `rgba(210,232,255,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    button(O.again, 'Play again', { primary: true, size: 34 }); button(O.back, state.overFromAutoplay ? 'Exit to menu' : 'Menu', { size: 30 });
    drawMoreLine(ctx, O.more.x, O.more.y, 24);
  } else if (scene === 'rules') {
    const RL = L.rules, panel = RL.panel, vp = RL.viewport, sc0 = rulesScrollNow(state);
    ctx.fillStyle = 'rgba(4,10,20,0.74)'; ctx.fillRect(0, 0, w, h);
    // Falls back to 1 for any out-of-range saved index (e.g. a save from a build with more steps).
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;

    // The reader card: one framed panel holding the header and the scrolling body (piece portrait, page title, text).
    ctx.beginPath(); ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 26);
    const pg = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
    pg.addColorStop(0, 'rgba(22,38,56,0.74)'); pg.addColorStop(1, 'rgba(6,14,26,0.86)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(160,206,244,0.42)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(panel.x + 6, panel.y + 6, panel.w - 12, panel.h - 12, 20);
    ctx.strokeStyle = 'rgba(160,206,244,0.15)'; ctx.lineWidth = 1; ctx.stroke();

    text('Rules', RL.cx, panel.y + 52, Math.round(38 * Math.min(scale, 1.15)));
    ctx.strokeStyle = 'rgba(160,206,244,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(panel.x + 60, panel.y + 82); ctx.lineTo(panel.x + panel.w - 60, panel.y + 82); ctx.stroke();

    // The body scrolls inside the viewport (drag, wheel, keys, scroll bar). Pages that fit never move.
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = Math.min(panel.w - 90, 820), cxp = vp.x + vp.w / 2;
    const size = Math.round(29 * scale), lh = Math.round(size * 1.42), gap = Math.round(14 * scale);
    let y = vp.y + 8 - sc0;
    const blocks = readerStats.rects; blocks.length = 0;
    // ONE continuous document: every page's title, optional piece portrait and text, in order.
    for (const page of RULES) {
      const t0 = Math.round(31 * Math.min(scale, 2));
      const tSize = memo(`t|${page.title}|${t0}|${bodyW}`, () => { let q = t0; ctx.font = `700 ${q}px ${UI}`; while (ctx.measureText(page.title).width > bodyW && q > 22) { q -= 1; ctx.font = `700 ${q}px ${UI}`; } return q; });
      y += Math.max(30, tSize * 0.86) + 10;
      blocks.push({ k: 'title', top: y - tSize * 0.55, bot: y + tSize * 0.55 });
      if (y > vp.y - 80 && y < vp.y + vp.h + 80) text(page.title, cxp, y, tSize, '#ffd684', UI, 700);
      y += 26 + Math.round(size * 0.66);
      if (page.piece) {
        // The fox/goose head stands well above its own anchor point (long ears, a raised neck), so the block reserves headroom.
        const pr = Math.round(58 * Math.min(scale, 1.2)), footY = y + pr * 1.9;
        (page.piece === 'F' ? drawFox : drawGoose)(ctx, cxp, footY, pr, { set, flip: true });
        blocks.push({ k: 'art', top: footY - pr * 1.5, bot: footY + pr * 1.35 });
        y += pr * 3.25 + 14 + Math.round(size * 0.55);   // the block holds the whole sprite plus the half line that sits above the first text baseline
      }
      for (const line of page.lines) {
        const ls = lines(line, size, bodyW);
        blocks.push({ k: 'text', top: y - size * 0.5, bot: y + (ls.length - 1) * lh + size * 0.5 });
        if (y + ls.length * lh > vp.y - 80 && y - size < vp.y + vp.h + 80) ls.forEach((ln, i) => text(ln, cxp, y + i * lh, size, INK, UI, 600, 'center'));
        y += ls.length * lh + gap;
      }
      y += 22;
    }
    ctx.restore();
    const contentH = y - (vp.y - sc0) - gap + 24;
    if (contentH - vp.h > 8) {                                              // soft fades so a half line at the edge never looks cut
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(8,16,28,${a0})`); gr.addColorStop(1, `rgba(8,16,28,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 36, vp.y + vp.h, 0, 0.97);
      if (sc0 > 2) fade(vp.y + 24, vp.y, 0, 0.97);
    }
    rulesMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h);   // a few units of overshoot is not worth a scroll bar
    rulesMetrics.view = vp.h;
    if (rulesMetrics.max > 0) {                                           // scroll bar
      const sb = RL.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / rulesMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(160,206,244,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(160,206,244,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    if (rulesMetrics.max > 0) text(`${Math.round(100 * sc0 / rulesMetrics.max)}% read`, RL.cx, RL.counterY, 22, SOFT, UI, 500);
    button(RL.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(RL.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    button(RL.nav.back, 'Back', { size: 28 });
    button(RL.nav.next, rulesMetrics.max <= 0 || sc0 >= rulesMetrics.max - 2 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// The scroll offset used for drawing: the saved one, never beyond what the last frame measured.
function rulesScrollNow(state) { return Math.max(0, Math.min(state.rulesScroll || 0, rulesMetrics.max)); }
