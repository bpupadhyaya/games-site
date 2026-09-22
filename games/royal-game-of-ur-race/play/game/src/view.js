// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// The table and board are one cached layer (art.js); pieces and dice are drawn live so they can move, lift and glow.
import { W, H, BTN, DICE, PIECE_R, YT, YB, cellRect, cellCenter, titleRows, dieCenter, squareAt, restSlots, HOME_RECT, RESERVE_RECT } from './layout.js';
import { drawTableAndBoard, rosette, wedgeBand, PAL } from './art.js';
import { drawPiece, drawDie } from './pieces.js';
import { cellOf, legalMoves, HOME, PIECES } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { HERITAGE } from './heritage.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f3d98b', IVORY = '#f8efd8';
const ease = (f) => f * f * (3 - 2 * f);
const lerp = (a, b, f) => a + (b - a) * f;

export function render(ctx, state) {
  const scene = state.scene, g = state.game, big = state.big, a = state.anim;
  drawTableAndBoard(ctx, !(scene === 'title' || scene === 'about' || scene === 'demo-limit' || (scene === 'puzzle' && state.pz.status === 'making')));
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');

  const text = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color, font, weight, align) => { text(str, x + 1.5, y + 3, size, 'rgba(0,0,0,0.6)', font, weight, align); text(str, x, y, size, color, font, weight, align); };
  // wrap into lines; try each size until it fits `maxLines`
  const lines = (str, maxW, sizes, maxLines, weight = 600, font = UI) => {
    let out = [], size = 0;
    for (const spec of sizes) {
      const sz = Array.isArray(spec) ? spec[0] : spec, cap = Array.isArray(spec) ? spec[1] : maxLines;
      size = sz; maxLines = cap; ctx.font = `${weight} ${sz}px ${font}`; out = []; let cur = '';
      for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
      out.push(cur); if (out.length <= maxLines) break;
    }
    return { out, size };
  };
  const para = (str, x, y, maxW, sizes, maxLines, color, align = 'center', lh = 1.28) => {
    const { out, size } = lines(str, maxW, sizes, maxLines);
    out.forEach((ln, i) => text(ln, x, y + i * size * lh, size, color, UI, 600, align)); return out.length * size * lh;
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f6d47a'); gr.addColorStop(1, '#b8842a'); } else { gr.addColorStop(0, '#2f57b0'); gr.addColorStop(1, '#152e72'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,245,200,0.8)' : 'rgba(243,217,139,0.85)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 13); ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.35, o.size ?? 30, o.primary ? '#2a1606' : IVORY, UI, 700);
    ctx.restore();
  };
  const panel = (x, y, w, h) => {
    ctx.fillStyle = 'rgba(12,8,4,0.9)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(226,178,74,0.85)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(226,178,74,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 13); ctx.stroke();
  };

  // ---- lamp: a clay oil lamp top right, its flame flickering, warming the table -----------------------------
  const fl = state.calm ? 0.8 : 0.78 + 0.14 * Math.sin(state.t * 9.1) + 0.08 * Math.sin(state.t * 15.7 + 1);
  const lamp = ctx.createRadialGradient(640, 66, 4, 640, 66, 300); lamp.addColorStop(0, `rgba(255,190,100,${0.34 * fl})`); lamp.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, 520);
  drawLamp(ctx, 646, 64, fl, state.t, state.calm);

  // ---- the board scenes ---------------------------------------------------------------------------------------
  if (boardScene) {
    const human = scene !== 'over' && (state.two || g.turn === 0), movesNow = human && g.roll > 0 && !a && state.dice.phase !== 'rolling' ? legalMoves(g) : [];
    // header
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 360, 142, 24, 'rgba(243,217,139,0.8)', UI, 600);
      shadowText(l.title, 360, 186, 44, GOLD);
      para(state.msg ? state.msg.text : state.lesson.done ? l.done : l.text, 360, 226, 620, big ? [[28, 3], [24, 4], [21, 4]] : [[26, 3], [24, 3], [22, 4]], 4, state.msg ? '#ffe2a0' : state.lesson.done ? '#d6f5c8' : '#fff6de');
    } else if (scene === 'puzzle') {
      const P = state.pz;
      text('Daily puzzle', 360, 142, 24, 'rgba(243,217,139,0.8)', UI, 600);
      shadowText('Find the best move', 360, 186, 44, GOLD);
      para(state.msg ? state.msg.text : P.status === 'solved' ? `Solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' at the first try'}. ${P.puzzle.why} A new puzzle comes tomorrow.` : `You rolled ${P.puzzle.roll}. Which move is strongest? Tap a piece, then its square. Streak: ${state.daily.streak}.`, 360, 226, 620, big ? [[28, 3], [24, 4], [21, 4]] : [[26, 3], [24, 3], [22, 4]], 4, state.msg ? '#ffe2a0' : '#fff6de');
    } else {
      const two = state.two, turn = g.turn;
      const who = scene === 'over' ? 'Game over' : two ? `Player ${turn + 1} to move` : turn === 0 ? 'Your move' : `The computer${state.thinking || g.roll >= 0 || state.dice.phase === 'rolling' ? ' is playing' : ' is about to roll'}`;
      shadowText(who, 360, 170, 44, GOLD);
      text(two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name}`, 360, 204, 22, 'rgba(243,217,139,0.75)', UI, 500);
      for (const s of [0, 1]) {
        const x = s === 0 ? 74 : W - 74, on = scene !== 'over' && turn === s;
        if (on) { ctx.fillStyle = `rgba(255,214,110,${0.25 + 0.12 * Math.sin(state.t * 4)})`; ctx.beginPath(); ctx.arc(x, 158, 42, 0, TAU); ctx.fill(); }
        drawPiece(ctx, x, 156, 27, s);
        text(s === 0 ? (two ? 'Player 1' : 'You') : two ? 'Player 2' : 'Computer', x, 208, 19, on ? GOLD : 'rgba(243,217,139,0.6)', UI, 600);
      }
    }

    // tray labels in the gutters
    for (const s of [0, 1]) {
      const x = s === 0 ? 64 : W - 64, waiting = g.pos[s].filter((p) => p === 0).length, home = g.pos[s].filter((p) => p === HOME).length;
      text(`Waiting ${waiting}`, x, YB - 496 + 6, 19, 'rgba(243,217,139,0.7)', UI, 600);
      text(`Home ${home}/${PIECES}`, x, YT + 264, 19, 'rgba(243,217,139,0.7)', UI, 600);
    }

    // destination glows (selected piece, or the hint): the path it will take, the square, a ghost piece and a tag
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    const goals = [], tags = [];
    if (state.sel >= 0 && !a && movesNow.length) { const m = movesNow.find((x) => x.i === state.sel); if (m) goals.push({ m, col: '255,230,140' }); }
    if (state.hint && !a) { const m = legalMoves(g).find((x) => x.i === state.hint.i); if (m) goals.push({ m, col: '130,255,170', hint: true }); }
    for (const { m, col, hint } of goals) {
      const s = g.turn;
      for (let p = m.from + 1; p < Math.min(m.to, 15); p++) { const q = squareAt(s, p); if (q) { ctx.fillStyle = `rgba(${col},0.7)`; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, TAU); ctx.fill(); } }
      if (m.to <= 14) {
        const dc = cellOf(s, m.to), R = cellRect(dc.lane, dc.c);
        ctx.fillStyle = `rgba(${col},${0.22 + pulse * 0.18})`; ctx.beginPath(); ctx.roundRect(R.x + 6, R.y + 6, R.w - 12, R.h - 12, 10); ctx.fill();
        ctx.strokeStyle = `rgba(${col},${0.7 + pulse * 0.3})`; ctx.lineWidth = 4; ctx.stroke();
        const c = cellCenter(dc.lane, dc.c); drawPiece(ctx, c.x, c.y, PIECE_R, s, { dim: true });
        tags.push({ c, R, m });
      } else {
        const H2 = HOME_RECT(s); ctx.strokeStyle = `rgba(${col},${0.6 + pulse * 0.4})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(H2.x, H2.y, H2.w, H2.h, 14); ctx.stroke();
        text('Home', H2.x + H2.w / 2, H2.y + H2.h - 14, 20, `rgb(${col})`, UI, 700);
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
      if (a && a.type !== 'refuse' && a.side === s && a.i === i) continue;
      if (a && a.type === 'refuse' && a.side === s && a.i === i) continue;
      if (a && a.type === 'move' && a.hit >= 0 && a.hitSide === s && i === a.hit) continue;
      const q = at(s, i); if (!q) continue;
      const mine = s === g.turn && glowSet.has(i), selected = s === g.turn && state.sel === i;
      const isTop = mine && g.pos[s][i] === 0;                              // only the top of the waiting stack glows
      const r = g.pos[s][i] === 0 ? 30 : g.pos[s][i] === HOME ? 24 : PIECE_R;
      drawPiece(ctx, q.x, q.y, r, s, { glow: mine && (g.pos[s][i] !== 0 || isTop) ? state.t : 0, lift: selected ? 0.55 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0 });
    }
    // the captured piece: waits where it stood until it is hit, then flies back to its stack
    if (a && a.type === 'move' && a.hit >= 0) {
      const f2 = (a.t - a.dur) / 0.5, from = squareAt(a.hitSide, a.hitFrom);
      if (f2 < 0) drawPiece(ctx, from.x, from.y, PIECE_R, a.hitSide);
      else if (f2 < 1) { const to = a.hitTo, e = ease(f2); drawPiece(ctx, lerp(from.x, to.x, e), lerp(from.y, to.y, e), lerp(PIECE_R, 30, e), a.hitSide, { lift: Math.sin(Math.PI * f2) * 1.6 }); }
    }
    if (a) {
      const pos = animAt(a, state);
      drawPiece(ctx, pos.x, pos.y, a.type === 'move' && a.off ? lerp(PIECE_R, 24, Math.min(1, a.t / a.dur)) : PIECE_R, a.side, { lift: pos.lift, glow: a.type === 'refuse' ? state.t : 0 });
      if (a.type === 'move' && a.t > a.dur && a.t < a.dur + 0.45 && !state.calm) {              // a ring of light where a piece lands or captures
        const f = (a.t - a.dur) / 0.45, e = a.pts[a.pts.length - 1];
        ctx.strokeStyle = `rgba(${a.hit >= 0 ? '255,120,80' : '255,236,160'},${0.8 * (1 - f)})`; ctx.lineWidth = 6 * (1 - f) + 1; ctx.beginPath(); ctx.arc(e.x, e.y, 30 + 60 * f, 0, TAU); ctx.stroke();
      }
    }

    for (const { c, R, m } of tags) {                                   // small labels on top of everything: what the move will do
      const tag = m.hit >= 0 ? 'Capture' : m.rosette ? 'Roll again' : ''; if (!tag) continue;
      ctx.font = `700 19px ${UI}`; const tw = ctx.measureText(tag).width + 22; ctx.fillStyle = m.hit >= 0 ? 'rgba(150,30,20,0.96)' : 'rgba(20,70,45,0.96)';
      ctx.beginPath(); ctx.roundRect(c.x - tw / 2, R.y + 3, tw, 27, 13); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,170,0.8)'; ctx.lineWidth = 1.5; ctx.stroke(); text(tag, c.x, R.y + 22, 19, '#fff6de', UI, 700);
    }
    // dice tray
    drawTray(ctx, state, text, g, human);

    // buttons
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 26 }); button(BTN.undo, 'Take back', { size: 26 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 26 }); if (state.lesson.done) button({ x: 265, y: BTN.next.y, w: 395, h: BTN.next.h }, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button({ x: 265, y: BTN.next.y, w: 395, h: BTN.next.h }, 'Share result', { primary: true, size: 28 }); }

    // message banner, bottom-anchored just above the board
    if (state.msg && scene === 'play') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      const { out, size } = lines(state.msg.text, 590, big ? [[30, 3], [26, 3]] : [[25, 2], [22, 2]], 3), lh = size * 1.25, h = 24 + out.length * lh, y0 = 314 - h;
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      ctx.fillStyle = 'rgba(14,9,4,0.93)'; ctx.beginPath(); ctx.roundRect(40, y0, 640, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(243,217,139,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      out.forEach((ln, i) => text(ln, 360, y0 + 12 + size + i * lh - 4, size, '#fff3d6', UI, 600));
      ctx.restore();
    }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text('Preparing today\'s puzzle...', 360, 800, 34, '#fff3d6', UI, 600); button(BTN.menu, 'Menu', { size: 26 }); }

  // ---- title, about, limits, game over ------------------------------------------------------------------
  if (scene === 'title' || scene === 'demo-limit' || (scene === 'puzzle' && state.pz.status === 'making')) {
    shadowText('The Royal Game', 360, 200, 74, GOLD); shadowText('of Ur', 360, 270, 74, GOLD);
    text('A race from the cradle of civilisation', 360, 318, 28, 'rgba(243,217,139,0.85)', FONT, 600);
    drawEmblem(ctx, 360, 520, 150, state);
    for (let k = 0; k < 4; k++) drawDie(ctx, 210 + k * 100, 726, 42, k % 2 === 0, state.calm ? 0.3 * k : state.t * (0.6 + k * 0.15) + k, state.calm ? 1 : 0.8 + 0.2 * Math.cos(state.t * 1.3 + k), 0);
    ctx.save(); ctx.globalAlpha = 0.9; wedgeBand(ctx, 60, 778, 660, 14, 77, 'rgba(226,178,74,0.6)'); ctx.restore();
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 30 });
    button(R.two, 'Two players, one phone', { size: 28 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(R.about, 'About the game', { size: 28 });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 });
    button(R.big, state.big ? 'Large text: on' : 'Large text: off', { size: 22 }); button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20 });
    text(LEVELS[state.level].blurb, 360, R.big.y + 110, 20, 'rgba(243,217,139,0.7)', UI, 500);
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, R.big.y + 142, 20, 'rgba(243,217,139,0.6)', UI, 500);
    let sx = 360 - 2 * 44 + 22; for (let l = 0; l < LEVELS.length; l++) { text('★', sx + l * 44, R.big.y + 176, 30, state.stats.badges[l] ? '#ffd24a' : 'rgba(255,255,255,0.2)', UI, 700); }
    if (state.msg) para(state.msg.text, 360, 800, 600, [22], 2, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    text('That was the free taste.', 360, 960, 44);
    text('Get The Royal Game of Ur on iPhone and Android', 360, 1030, 26, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1070, 26, '#fff3d6', UI, 600);
    button(BTN.back, 'Back', { size: 30 });
  } else if (scene === 'about') {
    const h = HERITAGE[state.about];
    shadowText('About the game', 360, 160, 40, GOLD);
    drawEmblem(ctx, 360, 350, 118, state, state.about);
    panel(50, 500, 620, 800);
    shadowText(h.title, 360, 580, 44, GOLD);
    ctx.strokeStyle = 'rgba(226,178,74,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(250, 606); ctx.lineTo(470, 606); ctx.stroke();
    para(h.body, 360, 664, 540, big ? [[34, 11], [30, 12]] : [[30, 11], [27, 12], [25, 13]], 13, '#fff3d6', 'center', 1.36);
    text(`${state.about + 1} of ${HERITAGE.length}`, 360, 1268, 22, 'rgba(243,217,139,0.7)', UI, 600);
    button(BTN.menu, 'Menu', { size: 26 }); button(BTN.undo, 'Back', { size: 26, dim: state.about === 0 }); button(BTN.hint, 'Next', { size: 26, primary: state.about < HERITAGE.length - 1, dim: state.about === HERITAGE.length - 1 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(6,4,2,0.74)'; ctx.fillRect(0, 0, W, H);
    const won = state.two ? `Player ${g.winner + 1} wins` : g.winner === 0 ? 'You win!' : 'The computer wins';
    drawEmblem(ctx, 360, 470, 130, state);
    shadowText(won, 360, 720, 68, GOLD);
    text(`Seven pieces home in ${g.moves} moves`, 360, 776, 26, '#fff3d6', UI, 500);
    text(`Captures: ${state.caps[0]} by ${state.two ? 'Player 1' : 'you'} · ${state.caps[1]} by ${state.two ? 'Player 2' : 'the computer'}`, 360, 816, 22, 'rgba(243,217,139,0.75)', UI, 500);
    if (!state.two && g.winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, 360, 858, 24, '#ffd24a', UI, 600);
      if (!state.calm) for (let k = 0; k < 16; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 600 - ph * 400; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 34 }); button(BTN.back, 'Menu', { size: 30 });
  }
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

function drawTray(ctx, state, text, g, human) {
  const T = DICE, d = state.dice, rolling = d.phase === 'rolling', ready = state.scene !== 'over' && g.roll < 0 && !rolling && !state.anim && (state.scene === 'lesson' ? LESSONS[state.lesson.i].want === 'roll' && !state.lesson.done : human && state.wait <= 0);
  const pulse = 0.5 + 0.5 * Math.sin(state.t * 5);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(T.x + 3, T.y + 7, T.w, T.h, 20); ctx.fill();
  const bg = ctx.createLinearGradient(0, T.y, 0, T.y + T.h); bg.addColorStop(0, '#1b120a'); bg.addColorStop(1, '#0a0603');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(T.x, T.y, T.w, T.h, 20); ctx.fill();
  ctx.strokeStyle = ready ? `rgba(255,222,120,${0.6 + pulse * 0.4})` : 'rgba(226,178,74,0.7)'; ctx.lineWidth = ready ? 4 : 2.5; ctx.stroke();
  ctx.restore();
  // dice: tumbling while rolling, resting on their result afterwards
  for (let k = 0; k < 4; k++) {
    const c = dieCenter(k);
    if (rolling) {
      const f = d.t / d.dur, tt = state.calm ? 0 : d.t, settle = f > 0.75 ? (f - 0.75) / 0.25 : 0;
      const flick = Math.floor(d.t * 12 + k * 3), up = f > 0.8 ? d.vals[k] === 1 : ((flick * 7 + k) % 3) === 0;
      const bounce = Math.abs(Math.sin(f * Math.PI * 3 + k)) * (1 - f);
      drawDie(ctx, c.x + Math.sin(tt * 9 + k) * 8 * (1 - f), c.y - 4, 50, up, lerp(tt * (10 + k * 2) + k, k * 0.55, ease(settle)), lerp(0.55 + 0.45 * Math.abs(Math.cos(tt * 8 + k * 2)), 1, ease(settle)), state.calm ? 0 : bounce * 1.1);
    } else if (d.phase === 'none') drawDie(ctx, c.x, c.y - 4, 50, false, k * 0.55, 1, 0);
    else drawDie(ctx, c.x, c.y - 4, 50, d.vals[k] === 1, k * 0.55, 1, 0);
  }
  const rx = 540;
  if (rolling) text('Rolling...', rx, T.y + 62, 30, '#fff3d6', UI, 600);
  else if (ready) { text('Tap to roll', rx, T.y + 56, 30, `rgba(255,236,170,${0.75 + pulse * 0.25})`, UI, 700); text('the four dice', rx, T.y + 84, 20, 'rgba(243,217,139,0.7)', UI, 500); }
  else if (d.phase !== 'none') { text(String(d.total), rx - 40, T.y + 76, 70, GOLD, UI, 700); text(d.total === 1 ? 'step' : 'steps', rx + 40, T.y + 74, 24, 'rgba(243,217,139,0.85)', UI, 600); }
  else text('Four dice', rx, T.y + 62, 26, 'rgba(243,217,139,0.6)', UI, 600);
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
  if (variant === 3) for (let k = 0; k < 3; k++) drawDie(ctx, x - 1.3 * r + k * 1.3 * r, y + r * 1.3, 34, k !== 1, k, 1, 0);
  ctx.restore();
}
