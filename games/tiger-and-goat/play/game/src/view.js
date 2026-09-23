// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// Static art (table, board) and the two pieces are cached sprites (art.js, pieces.js), so a frame is cheap.
import { W, H, pointAt, PIECE_R, SIZE, UNIT, BTN, LOOK, RULES_NAV, titleRows, handPos, capturedPos } from './layout.js';
import { drawTableAndBoard, WOOD_NAMES } from './art.js';
import { drawTiger, drawGoat, SET_NAMES } from './pieces.js';
import { unlocked } from './unlocks.js';
import { legalMoves, threatened } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PUZZLE_TEXT } from './puzzles.js';
import { RULES } from './content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SIDE = { G: 'Goats', T: 'Tigers' };
const TAU = Math.PI * 2;

export function render(ctx, state) {
  drawTableAndBoard(ctx, state.look.wood);
  const set = state.look.set, big = state.look.big;
  const g = state.game, a = state.anim, scene = state.scene;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');

  const text = (str, x, y, size, color = '#f6dfae', font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => {
    ctx.font = `600 ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return lines.length;
  };
  const piece = (k, pos, opts = {}) => { const r = PIECE_R * pos.s * SIZE[k] * (opts.scale ?? 1); (k === 'T' ? drawTiger : drawGoat)(ctx, pos.x, pos.y - r * 0.56, r, { set, ...opts }); };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#f3cf7a' : '#7a4a24'); gr.addColorStop(1, o.primary ? '#c8922e' : '#4a2811');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,170,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.35, o.size ?? 30, o.primary ? '#2a1606' : '#f6dfae', UI, 700);
    ctx.restore();
  };
  const glow = (i, rgb, pulse) => { const p = pointAt(i); ctx.fillStyle = `rgba(${rgb},${0.45 + pulse * 0.3})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 24 * UNIT * p.s, 20 * UNIT * p.s, 0, 0, TAU); ctx.fill(); };

  // where the moving piece is right now
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), ease = f * f * (3 - 2 * f), to = pointAt(a.to);
    if (a.type === 'place') { const from = handPos(a.hand); return { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, s: from.s * 0.6 + (to.s - from.s * 0.6) * ease, lift: Math.sin(Math.PI * f) * 0.9 }; }
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

  if (boardScene) {
    // ---- header ---------------------------------------------------------------------------------------
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 410, 130, 26, 'rgba(246,223,174,0.8)', UI, 600);
      text(l.title, 360, 250, 46);
      wrap(state.lesson.done ? l.done : l.text, 360, 330, big ? 34 : 29, 620, state.lesson.done ? '#c9f7c0' : '#ffffff', 40);
    } else if (scene === 'puzzle') {
      const t = PUZZLE_TEXT[state.pz.puzzle.type];
      text('Daily puzzle', 410, 130, 26, 'rgba(246,223,174,0.8)', UI, 600);
      piece(t.side, { x: 110, y: 300, s: 1 }, { scale: t.side === 'T' ? 1.5 : 2 });
      text(t.title, 180, 270, 40, '#ffffff', UI, 700, 'left');
      wrap(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : t.goal(state.pz.puzzle.n), 64, 360, big ? 32 : 27, 600, '#fff3d6', 36, 'left');
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 64, 470, 26, '#f6dfae', UI, 600, 'left');
      text(`Goats captured so far: ${g.captured}`, 64, 520, 24, 'rgba(246,223,174,0.75)', UI, 500, 'left');
    } else {
      text('Tiger and Goat', 410, 140, 40);
      const turnText = g.winner ? '' : state.two ? `${SIDE[g.turn]} to move` : g.turn === state.human ? `Your move (${SIDE[g.turn].toLowerCase()})` : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
      piece(g.turn, { x: 110, y: 382, s: 1 }, { scale: g.turn === 'T' ? 1.5 : 2 });
      text(turnText, 180, 362, 36, '#ffffff', UI, 700, 'left');
      text(state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`, 180, 400, 23, 'rgba(246,223,174,0.8)', UI, 500, 'left');
      text(`Goats to place: ${g.inHand}`, 64, 448, 26, '#f6dfae', UI, 600, 'left');
      for (let k = 0; k < g.inHand; k++) piece('G', handPos(k), { scale: 0.95 });
      text(`Captured: ${g.captured} of 20`, 64, 654, 26, '#f6dfae', UI, 600, 'left');
      for (let k = 0; k < g.captured; k++) piece('G', capturedPos(k), { scale: 0.5, dim: true });
    }

    // ---- the board ------------------------------------------------------------------------------------
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    if (state.sel >= 0 && !a) for (const m of legalMoves(g)) if (m.from === state.sel) glow(m.to, m.type === 'jump' ? '255,120,80' : '255,236,150', pulse);
    if (state.hint && !a) { glow(state.hint.to, '120,255,170', pulse); if (state.hint.from >= 0) glow(state.hint.from, '120,255,170', pulse); }
    const danger = state.marks && scene !== 'over' ? threatened(g) : new Set();
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

    // ---- message and buttons --------------------------------------------------------------------------
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      const ms = big ? 32 : 25, lh = big ? 40 : 32;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.font = `600 ${ms}px ${UI}`;
      const words = state.msg.text.split(' '), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 590 && cur) { lines.push(cur); cur = w; } else cur = t2; }
      lines.push(cur);
      // during play the message is a banner at the top (the tray below must stay visible); in lessons and puzzles it sits just above the board
      const h = 30 + lines.length * lh, y0 = scene === 'play' ? 168 : 748 - h;
      ctx.fillStyle = 'rgba(20,10,4,0.9)'; ctx.beginPath(); ctx.roundRect(40, y0, 640, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(243,207,122,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      lines.forEach((ln, i) => text(ln, 360, y0 + 38 + i * lh, ms, '#fff3d6', UI, 600));
      ctx.restore();
    }
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 26 }); button(BTN.undo, 'Take back', { size: 26 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 26 }); if (state.lesson.done) button({ x: 265, y: BTN.next.y, w: 395, h: BTN.next.h }, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 30 }); }
  }

  if (scene === 'title' || scene === 'demo-limit' || scene === 'look' || (scene === 'puzzle' && state.pz.status === 'making')) {
    for (const c of [0, 4, 20, 24]) piece('T', pointAt(c));
    ctx.fillStyle = 'rgba(6,14,18,0.6)'; ctx.fillRect(0, 760, W, H - 760);
    if (scene !== 'look') { text('Tiger and Goat', 410, 150, 54); text('Four tigers. Twenty goats. One board.', 360, 205, 26, 'rgba(246,223,174,0.8)', FONT, 400); }
    drawTiger(ctx, 215, 470, 150, { set }); drawGoat(ctx, 520, 470, 112, { set });
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text("Preparing today's puzzle…", 360, 1000, 34, '#fff3d6', UI, 600); button(BTN.menu, 'Menu', { size: 26 }); }
  if (scene === 'look') {
    text('Board and pieces', 410, 150, 46); text('Earned by winning. Never for sale.', 360, 205, 26, 'rgba(246,223,174,0.8)', FONT, 400);
    const group = (label, y) => text(label, 90, y, 24, 'rgba(246,223,174,0.85)', UI, 600, 'left');
    group('Board', 786); group('Pieces', 946); group('Message text', 1106);
    ['teak', 'walnut', 'ash'].forEach((k, i) => { const ok = unlocked(state, 'wood', k); button(LOOK.woods[i], ok ? WOOD_NAMES[k] : `${WOOD_NAMES[k]} (locked)`, { size: 23, primary: state.look.wood === k, dim: !ok }); });
    ['classic', 'snow'].forEach((k, i) => { const ok = unlocked(state, 'set', k); button(LOOK.sets[i], ok ? SET_NAMES[k] : `${SET_NAMES[k]} (locked)`, { size: 26, primary: state.look.set === k, dim: !ok }); });
    button(LOOK.text[0], 'Normal', { size: 26, primary: !big }); button(LOOK.text[1], 'Large', { size: 30, primary: big });
    button(LOOK.back, 'Back', { size: 30 });
    if (state.msg) wrap(state.msg.text, 360, 1236, big ? 30 : 24, 620, '#ffe9b0');
    text(`Wins so far: ${state.stats.wins}`, 360, 1420, 22, 'rgba(246,223,174,0.7)', UI, 500);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    button(R.goats, 'Play as the Goats', { primary: state.learned && !R.resume, size: 30 }); button(R.tigers, 'Play as the Tigers', { size: 30 });
    button(R.two, 'Two players, one phone', { size: 28 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 }); button(R.marks, state.marks ? 'Warnings on' : 'Warnings off', { size: 22 }); button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20 });
    button(R.look, 'Board and pieces', { size: 24 }); button(R.rules, 'Rules', { size: 24 });
    // badges: one star per level beaten with each side
    const by = R.look.y + 104;
    for (const [side, x0, label] of [['G', 96, 'Goats'], ['T', 396, 'Tigers']]) {
      text(label, x0, by, 22, 'rgba(246,223,174,0.8)', UI, 600, 'left');
      for (let l = 0; l < LEVELS.length; l++) text('★', x0 + 96 + l * 36, by + 2, 30, state.stats.badges[side + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
    }
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, by + 44, 22, 'rgba(246,223,174,0.65)', UI, 500);
    if (state.msg) wrap(state.msg.text, 360, 748, 24, 620, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    text('That was the free taste.', 360, 960, 44);
    text('Get Tiger and Goat on iPhone and Android', 360, 1030, 28, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1070, 28, '#fff3d6', UI, 600);
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(6,10,14,0.72)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : state.two ? `${SIDE[g.winner]} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
    if (g.winner !== 'draw') (g.winner === 'T' ? drawTiger : drawGoat)(ctx, 360, 520, g.winner === 'T' ? 170 : 130, { set });
    text(won, 360, 720, 64); text(g.reason, 360, 780, 28, '#fff3d6', UI, 500);
    text(`${g.moves} moves · ${g.captured} goat${g.captured === 1 ? '' : 's'} captured`, 360, 826, 24, 'rgba(246,223,174,0.75)', UI, 500);
    if (!state.two && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten as the ${SIDE[state.human].toLowerCase()}`, 360, 868, 24, '#ffd24a', UI, 600);
      if (!state.calm) for (let k = 0; k < 14; k++) {                        // gold sparks drifting up around the winner
        const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380;
        ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill();
      }
    }
    button(BTN.again, 'Play again', { primary: true, size: 34 }); button(BTN.back, 'Menu', { size: 30 });
  } else if (scene === 'rules') {
    ctx.fillStyle = 'rgba(6,10,14,0.72)'; ctx.fillRect(0, 0, W, H);
    const page = RULES[state.rulesPage % RULES.length];
    text('Rules', 360, 130, 44);
    text(page.title, 360, 182, 28, '#ffd24a', UI, 700);
    let y = 240;
    if (page.piece) { piece(page.piece, { x: 360, y: 400, s: 1 }, { scale: page.piece === 'T' ? 2.7 : 3.6 }); y = 510; }
    const size = big ? 29 : 25, lh = size * 1.32;
    for (const line of page.lines) { const n = wrap(line, 360, y, size, 620, '#ffffff', lh); y += n * lh + 12; }
    text(`Page ${(state.rulesPage % RULES.length) + 1} of ${RULES.length}`, 360, 1420, 22, 'rgba(246,223,174,0.7)', UI, 500);
    button(RULES_NAV.back, 'Back', { size: 28 }); button(RULES_NAV.next, 'Next', { size: 28, primary: true });
  }
}
