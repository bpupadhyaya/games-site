// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// Static art (snowfield, board) and the two pieces are cached sprites (art.js, pieces.js), so a frame is cheap.
import { W, H, pointAt, PIECE_R, SIZE, UNIT, BTN, LOOK, RULES_NAV, titleRows, trayPos, DEV_BTN } from './layout.js';
import { drawTableAndBoard, BOARD_NAMES } from './art.js';
import { drawFox, drawGoose, SET_NAMES } from './pieces.js';
import { unlocked, starNeed } from './unlocks.js';
import { legalMoves, threatened, PTS, FOX_WINS_AT, geeseLeft } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PUZZLE_TEXT } from './puzzles.js';
import { RULES } from './content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SIDE = { G: 'Geese', F: 'Fox' };
const TAU = Math.PI * 2;
const INK = '#eef7ff', SOFT = 'rgba(196,222,246,0.82)';
// Geese face the middle of the board, so a flock looks like it is watching the fox. (A goose in the middle column faces by row.)
export const flipOf = (i) => { const x = i % 7; return x < 3 || (x === 3 && Math.floor(i / 7) % 2 === 0); };

// Snowflakes drift down slowly (a fixed handful, positions computed from the clock, nothing stored).
const FLAKES = Array.from({ length: 44 }, (_, i) => ({ x: (i * 97.13) % W, y: (i * 211.7) % H, v: 14 + (i % 7) * 4.5, r: 1 + (i % 3) * 0.7, ph: i * 1.7 }));

export function render(ctx, state) {
  drawTableAndBoard(ctx, state.look.board);
  const set = state.look.set, big = state.look.big;
  const g = state.game, a = state.anim, scene = state.scene;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');

  const text = (str, x, y, size, color = INK, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => {
    ctx.font = `600 ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return lines.length;
  };
  // k: 'F' | 'G'. The head is drawn a little above the point, so it stands ON it.
  const piece = (k, pos, opts = {}) => { const r = PIECE_R * pos.s * SIZE[k] * (opts.scale ?? 1); (k === 'F' ? drawFox : drawGoose)(ctx, pos.x, pos.y - r * (k === 'F' ? 0.6 : 0.72), r, { set, ...opts }); };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#ffd684' : '#3f5c78'); gr.addColorStop(1, o.primary ? '#e79a3c' : '#223649');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,200,0.7)' : 'rgba(190,222,250,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.35, o.size ?? 30, o.primary ? '#2a1606' : INK, UI, 700);
    ctx.restore();
  };
  const glow = (i, rgb, pulse) => { const p = pointAt(i); ctx.fillStyle = `rgba(${rgb},${0.45 + pulse * 0.3})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 25 * UNIT * p.s, 21 * UNIT * p.s, 0, 0, TAU); ctx.fill(); };
  // Shrinks a button label to fit a narrower button (the Rules-button row needed three columns
  // where two used to fit) without changing its wording.
  const fitSize = (label, maxW, start) => { let s = start; ctx.font = `700 ${s}px ${UI}`; while (ctx.measureText(label).width > maxW && s > 11) { s -= 1; ctx.font = `700 ${s}px ${UI}`; } return s; };

  // snow drifting down over the scene (not in reduced-motion mode)
  if (!state.calm) {
    ctx.fillStyle = 'rgba(232,244,255,0.55)';
    for (const f of FLAKES) { const y = (f.y + state.t * f.v) % (H + 20) - 10, x = f.x + Math.sin(state.t * 0.5 + f.ph) * 22; ctx.beginPath(); ctx.arc(x, y, f.r, 0, TAU); ctx.fill(); }
  }

  // where the moving piece is right now
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

  if (boardScene) {
    // ---- header ---------------------------------------------------------------------------------------
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 410, 130, 26, SOFT, UI, 600);
      text(l.title, 360, 250, 46);
      wrap(state.lesson.done ? l.done : l.text, 360, 330, big ? 34 : 29, 620, state.lesson.done ? '#c9f7c0' : '#ffffff', 40);
    } else if (scene === 'puzzle') {
      const t = PUZZLE_TEXT[state.pz.puzzle.type];
      text('Daily puzzle', 410, 130, 26, SOFT, UI, 600);
      piece(t.side, { x: 110, y: 330, s: 1 }, { scale: t.side === 'F' ? 1.2 : 1.3 });
      text(t.title, 180, 270, 40, '#ffffff', UI, 700, 'left');
      wrap(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : t.goal(state.pz.puzzle.n), 64, 380, big ? 32 : 27, 600, '#eef7ff', 36, 'left');
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'} · geese captured so far: ${g.captured}`, 64, 462, 24, INK, UI, 600, 'left');
    } else {
      text('Fox and Geese', 410, 140, 40);
      const chain = g.chain >= 0;
      const turnText = g.winner ? '' : state.two ? `${SIDE[g.turn]} to move` : g.turn === state.human ? (chain ? 'Jump again, or stop' : `Your move (${g.turn === 'F' ? 'fox' : 'geese'})`) : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
      piece(g.turn, { x: 110, y: 372, s: 1 }, { scale: g.turn === 'F' ? 1.2 : 1.3 });
      text(turnText, 180, 350, 36, '#ffffff', UI, 700, 'left');
      text(state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name} · flock of ${g.flock}`, 180, 388, 23, SOFT, UI, 500, 'left');
      text(`Geese left: ${geeseLeft(g)} of ${g.flock}`, 64, 462, 26, INK, UI, 600, 'left');
      text(`Fox wins when ${FOX_WINS_AT} are left`, 656, 462, 22, SOFT, UI, 500, 'right');
      const left = geeseLeft(g);
      for (let k = 0; k < g.flock; k++) piece('G', trayPos(k), { scale: 0.5, dim: k >= left, flip: true });
    }

    // ---- the board ------------------------------------------------------------------------------------
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    if (state.sel >= 0 && !a) for (const m of legalMoves(g)) if (m.from === state.sel) glow(m.to, m.type === 'jump' ? '255,140,90' : '255,244,170', pulse);
    if (g.chain >= 0 && !a && scene !== 'over' && (state.two || g.turn === state.human)) for (const m of legalMoves(g)) if (m.type === 'jump') glow(m.to, '255,140,90', pulse);
    if (state.hint && !a) { glow(state.hint.to, '120,255,170', pulse); if (state.hint.from >= 0) glow(state.hint.from, '120,255,170', pulse); }
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

    // ---- message and buttons --------------------------------------------------------------------------
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      const ms = big ? 32 : 25, lh = big ? 40 : 32;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.font = `600 ${ms}px ${UI}`;
      const words = state.msg.text.split(' '), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 590 && cur) { lines.push(cur); cur = w; } else cur = t2; }
      lines.push(cur);
      // during play the message is a banner at the top; in lessons and puzzles it sits just above the board
      const h = 30 + lines.length * lh, y0 = scene === 'play' ? 168 : 500;
      ctx.fillStyle = 'rgba(6,14,26,0.92)'; ctx.beginPath(); ctx.roundRect(40, y0, 640, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(160,206,244,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      lines.forEach((ln, i) => text(ln, 360, y0 + 38 + i * lh, ms, '#f2f9ff', UI, 600));
      ctx.restore();
    }
    const humanChain = state.game.chain >= 0 && (state.two || g.turn === state.human) && !g.winner;
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 26 }); button(BTN.undo, 'Take back', { size: 26 }); if (humanChain) button(BTN.stop, 'Stop here', { size: 26, primary: true }); else button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 26 }); if (state.lesson.done) button({ x: 265, y: BTN.next.y, w: 395, h: BTN.next.h }, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); else if (humanChain) button(BTN.stop, 'Stop here', { size: 26, primary: true }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 30 }); }
  }

  if (scene === 'title' || scene === 'demo-limit' || scene === 'look' || (scene === 'puzzle' && state.pz.status === 'making')) {
    for (const i of PTS) { const k = state.game.board[i]; if (k) piece(k, pointAt(i), { flip: k === 'G' && flipOf(i) }); }
    const dark = ctx.createLinearGradient(0, 560, 0, 780); dark.addColorStop(0, 'rgba(4,10,20,0)'); dark.addColorStop(0.5, 'rgba(4,10,20,0.9)'); dark.addColorStop(1, 'rgba(4,10,20,0.94)');
    ctx.fillStyle = dark; ctx.fillRect(0, 560, W, 220); ctx.fillStyle = 'rgba(4,10,20,0.94)'; ctx.fillRect(0, 780, W, H - 780);
    if (scene !== 'look') { text('Fox and Geese', 410, 150, 56); text('One fox. A flock of geese. A cross of frost.', 360, 200, 26, SOFT, FONT, 400); }
    drawFox(ctx, 205, 505, 128, { set }); drawGoose(ctx, 520, 505, 112, { set, flip: true });
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text("Preparing today's puzzle…", 360, 1000, 34, '#eef7ff', UI, 600); button(BTN.menu, 'Menu', { size: 26 }); }
  if (scene === 'look') {
    text('Board and pieces', 410, 150, 46); text('Earned by winning. Never for sale.', 360, 205, 26, SOFT, FONT, 400);
    const group = (label, y) => text(label, 90, y, 24, SOFT, UI, 600, 'left');
    group('Board', 786); group('Pieces', 946); group('Message text', 1106);
    ['frost', 'slate', 'moss'].forEach((k, i) => { const ok = unlocked(state, 'board', k); button(LOOK.boards[i], ok ? BOARD_NAMES[k] : `${BOARD_NAMES[k]} (locked)`, { size: 23, primary: state.look.board === k, dim: !ok }); });
    ['classic', 'dusk'].forEach((k, i) => { const ok = unlocked(state, 'set', k); button(LOOK.sets[i], ok ? SET_NAMES[k] : `${SET_NAMES[k]} (locked)`, { size: 26, primary: state.look.set === k, dim: !ok }); });
    button(LOOK.text[0], 'Normal', { size: 26, primary: !big }); button(LOOK.text[1], 'Large', { size: 30, primary: big });
    button(LOOK.back, 'Back', { size: 30 });
    if (state.msg) wrap(state.msg.text, 360, 1236, big ? 30 : 24, 620, '#ffe9b0');
    text(`Wins so far: ${state.stats.wins}`, 360, 1420, 22, SOFT, UI, 500);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    button(R.fox, 'Play as the Fox', { size: 30 }); button(R.geese, 'Play as the Geese', { primary: state.learned && !R.resume, size: 30 });
    button(R.two, 'Two players, one phone', { size: 28 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.flock, `Flock: ${state.flock} geese${state.flock === 13 ? ' (classic)' : ''}`, { size: state.flock === 13 ? 19 : 22 });
    button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 }); button(R.marks, state.marks ? 'Warnings on' : 'Warnings off', { size: 22 });
    const calmLabel = state.calm ? 'Reduced motion: on' : 'Reduced motion: off', lookLabel = 'Board and pieces', pad = 20;
    button(R.calm, calmLabel, { size: fitSize(calmLabel, R.calm.w - pad, 20) }); button(R.look, lookLabel, { size: fitSize(lookLabel, R.look.w - pad, 22) }); button(R.rules, 'Rules', { size: 22 });
    // badges: one star per level beaten with each side
    const by = R.look.y + 104;
    for (const [side, x0, label] of [['G', 96, 'Geese'], ['F', 396, 'Fox']]) {
      text(label, x0, by, 22, SOFT, UI, 600, 'left');
      for (let l = 0; l < LEVELS.length; l++) text('★', x0 + 84 + l * 36, by + 2, 30, state.stats.badges[side + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
    }
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, by + 44, 22, 'rgba(196,222,246,0.65)', UI, 500);
    if (state.msg) wrap(state.msg.text, 360, 748, 24, 620, '#ffe9b0');
    if (state.dev) button(DEV_BTN, `Dev: lesson ${(state.devLesson ?? 0) + 1}`, { size: 22 });
  } else if (scene === 'demo-limit') {
    text('That was the free taste.', 360, 960, 44);
    text('Get Fox and Geese on iPhone and Android', 360, 1030, 28, '#eef7ff', UI, 600); text('for unlimited games.', 360, 1070, 28, '#eef7ff', UI, 600);
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(4,10,20,0.74)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : state.two ? `${SIDE[g.winner]} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
    if (g.winner !== 'draw') (g.winner === 'F' ? drawFox : drawGoose)(ctx, 360, 520, g.winner === 'F' ? 170 : 130, { set, flip: true });
    text(won, 360, 720, 64); text(g.reason, 360, 780, 28, '#eef7ff', UI, 500);
    text(`${g.moves} moves · ${g.captured} ${g.captured === 1 ? 'goose' : 'geese'} captured`, 360, 826, 24, SOFT, UI, 500);
    if (!state.two && g.winner === state.human && state.starEarned) {
      text(`★ ${LEVELS[state.level].name} beaten as the ${state.human === 'F' ? 'fox' : 'geese'}`, 360, 868, 24, '#ffd24a', UI, 600);
    } else if (!state.two && g.winner === state.human) {
      text(`A win, but no star: as the ${state.human === 'F' ? 'fox' : 'geese'} a star needs ${starNeed(state.human, state.level)}`, 360, 868, 21, SOFT, UI, 500);
    }
    if (!state.two && g.winner === state.human && !state.calm) for (let k = 0; k < 14; k++) {        // pale sparks drifting up around the winner
      const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380;
      ctx.fillStyle = `rgba(210,232,255,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill();
    }
    button(BTN.again, 'Play again', { primary: true, size: 34 }); button(BTN.back, 'Menu', { size: 30 });
  } else if (scene === 'rules') {
    ctx.fillStyle = 'rgba(4,10,20,0.74)'; ctx.fillRect(0, 0, W, H);
    const page = RULES[state.rulesPage % RULES.length];
    text('Rules', 360, 130, 44);
    text(page.title, 360, 182, 28, '#ffd684', UI, 700);
    const top = page.piece ? 490 : 220, bottom = 545; // keep clear of the board art drawn below
    if (page.piece) (page.piece === 'F' ? drawFox : drawGoose)(ctx, 360, 365, page.piece === 'F' ? 70 : 56, { set, flip: true });
    // Count wrapped lines at a given font size without drawing, so a long page can shrink slightly
    // to stay compact and comfortably clear of the Back/Next row.
    const countLines = (str, size, maxW) => {
      ctx.font = `600 ${size}px ${UI}`; const words = str.split(' '); let n = 1, cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { n += 1; cur = w; } else cur = t2; }
      return n;
    };
    const maxW = big ? 630 : 640;
    let size = big ? 29 : 25;
    for (; size > 15; size -= 1) {
      const lh = size * 1.3, gap = 12;
      const total = page.lines.reduce((h, ln) => h + countLines(ln, size, maxW) * lh + gap, 0) - gap;
      if (total <= bottom - top) break;
    }
    const lh = size * 1.3;
    let y = top;
    for (const line of page.lines) { const n = wrap(line, 360, y, size, maxW, INK, lh); y += n * lh + 12; }
    text(`Page ${(state.rulesPage % RULES.length) + 1} of ${RULES.length}`, 360, 1420, 22, SOFT, UI, 500);
    button(RULES_NAV.back, 'Back', { size: 28 }); button(RULES_NAV.next, 'Next', { size: 28, primary: true });
  }
}
