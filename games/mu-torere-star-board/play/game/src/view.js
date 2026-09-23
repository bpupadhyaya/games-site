// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js).
import { W, H, BX, BY, PR, STONE_R, pointPos, BTN, TEXT_STEPPER, TEXT_SCALES, titleRows, LADDER_ROW, LADDER_SIDE, BACK } from './layout.js';
import { drawBackground, drawBoard, drawStone, koru, band, FONT, UI } from './art.js';
import { SIDE_NAME, legalMoves, other } from './rules.js';
import { LADDER, sayVerdict } from './ai.js';
import { rate } from './solver.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { movesToWin } from './puzzles.js';

const TAU = Math.PI * 2;
const CREAM = '#f3e6c8', GOLD = '#e8c777', MINT = '#8fe0b8';

export function render(ctx, st) {
  const t = st.t, big = st.big ? 1.16 : 1;
  const text = (s, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(s, x, y); };
  // Measures only (never draws) - shared by wrap() and by page()'s dry-run height pass.
  const countLines = (s, maxW, size, font = UI, weight = 600) => {
    ctx.font = `${weight} ${size}px ${font}`; const words = String(s).split(' '), out = []; let cur = '';
    for (const w of words) { const n = cur ? cur + ' ' + w : w; if (ctx.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; }
    out.push(cur); return out;
  };
  const wrap = (s, x, y, size, maxW, color = CREAM, lh = size * 1.32, align = 'center', font = UI, weight = 600) => {
    const lns = countLines(s, maxW, size, font, weight);
    lns.forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align)); return lns.length;
  };
  const plaque = (r, o = {}) => {
    ctx.save(); ctx.fillStyle = 'rgba(0,10,12,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, 20); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, o.top || 'rgba(20,52,58,0.94)'); g.addColorStop(1, o.bot || 'rgba(9,28,33,0.94)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(143,224,184,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(232,199,119,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14, 14); ctx.stroke();
    ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,8,10,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { g.addColorStop(0, '#79cfa6'); g.addColorStop(1, '#2f7d5f'); } else { g.addColorStop(0, '#875530'); g.addColorStop(1, '#4a2812'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    // grain
    ctx.save(); ctx.clip(); ctx.strokeStyle = o.primary ? 'rgba(255,255,255,0.09)' : 'rgba(20,8,2,0.16)'; ctx.lineWidth = 1;
    for (let k = 5; k < r.h; k += 7) { ctx.beginPath(); ctx.moveTo(r.x, r.y + k); ctx.bezierCurveTo(r.x + r.w * 0.3, r.y + k - 3, r.x + r.w * 0.6, r.y + k + 3, r.x + r.w, r.y + k); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = o.primary ? 'rgba(220,255,236,0.7)' : 'rgba(143,224,184,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 13); ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.34, o.size ?? 30, o.primary ? '#0b2a1f' : CREAM, UI, 700);
    ctx.restore();
  };
  const ring = (p, r, color, w = 4, a = 1) => { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.restore(); };
  const glowDot = (p, r, rgb, a) => { const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); };
  const pulse = (k = 3) => (st.calm ? 0.7 : 0.5 + 0.5 * Math.sin(st.t * k));

  drawBackground(ctx, t, st.calm);
  const sc = st.scene;
  if (sc === 'title') return title();
  if (sc === 'about') return page('About Mū Tōrere', ABOUT);
  if (sc === 'howto') return page('How to play', HOWTO);
  if (sc === 'rules') return page('Rules', RULES);
  if (sc === 'ladder') return ladder();
  if (sc === 'demo-limit') return demoLimit();
  return boardScene();

  // ---------------------------------------------------------------- title
  function title() {
    const bob = st.calm ? 0 : Math.sin(t * 0.9) * 4;
    // faint sun glow behind the star
    glowDot({ x: 360, y: 470 }, 330, '255,220,160', 0.16 + 0.04 * Math.sin(t * 0.7));
    drawBoard(ctx, 360, 470 + bob, 0.66);
    const s = 0.66;
    const board = [1, 1, 1, 1, 2, 2, 2, 2, 0];
    for (let i = 0; i < 9; i++) if (board[i]) { const p = pointPos(i, 360, 470 + bob, s); const br = st.calm ? 0 : Math.sin(t * 1.3 + i * 0.8) * 1.2; drawStone(ctx, board[i], p.x, p.y + br, STONE_R * s * 0.98); }
    // a slow sweep of light over the carving
    if (!st.calm) { const x = ((t * 60) % 1000) - 200; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x, 200, x + 120, 700); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,0.06)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 200, W, 520); ctx.restore(); }
    text('Mū Tōrere', 360, 150, 104, '#f7e8c4', FONT, 700);
    text('The eight-pointed star game of Aotearoa', 360, 206, 34, GOLD, FONT, 700);
    band(ctx, 130, 590, 240, 15, 'rgba(143,224,184,0.6)', 2.6);
    const R = titleRows(!!st.saved);
    if (R.resume) button(R.resume, 'Resume your game', { primary: true });
    button(R.learn, 'Learn to play', { primary: !R.resume });
    button(R.ladder, `The Ladder  ·  rung ${st.ladder.top} of 12`);
    button(R.two, 'Two players, one phone');
    button(R.daily, st.daily.solvedDay === st.daily.day ? 'Daily puzzle  ·  solved' : 'Daily puzzle');
    button(R.about, 'About', { size: 24 });
    button(R.howto, 'How to play', { size: 24 });
    button(R.rules, 'Rules', { size: 24 });
    button(R.sound, st.sound ? 'Sound on' : 'Sound off', { size: 24 }); button(R.calm, st.calm ? 'Calm: on' : 'Calm: off', { size: 24 }); button(R.big, st.big ? 'Large text' : 'Normal text', { size: 24 });
    button(R.marks, st.marks ? 'Warnings on: losing moves are marked' : 'Warnings off', { size: 24 });
    text(`Played ${st.progress.played}  ·  won ${st.progress.wins}${st.daily.streak ? '  ·  streak ' + st.daily.streak : ''}`, 360, 1470, 26, 'rgba(243,230,200,0.75)', UI, 600);
    if (st.msg) { plaque({ x: 60, y: 1400, w: 600, h: 64 }); text(st.msg.text, 360, 1440, 24, CREAM); }
  }

  // ---------------------------------------------------------------- text pages (About, How to play)
  function page(name, items) {
    // Text scale for these reference pages only (independent of the gameplay "Large text" setting,
    // which also affects the Ladder screen and lesson banners, not this reading screen). Always
    // guarded: an out-of-range saved index (e.g. from a shorter TEXT_SCALES array) falls back to 1.
    const scale = TEXT_SCALES[st.textScaleIdx] ?? 1;
    text(name, 360, 170, Math.round(70 * Math.min(scale, 1.15)), '#f7e8c4', FONT, 700); band(ctx, 130, 590, 208, 11, 'rgba(143,224,184,0.6)', 2.6);
    const top = 240, bottom = 1440;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, bottom - top); ctx.clip();
    let y = top + 30 - st.scroll; const size = Math.round(28 * scale);
    // Measure the real content height first (a dry run using `lines()`, which only measures and never
    // draws) so the plaque behind the text always covers every item, at every text-size step - a fixed
    // guess here once let the panel run out before the text did, once the top step made items taller.
    let measured = 30;
    for (const [, body, art] of items) {
      measured += Math.round(52 * scale);
      const n = countLines(body, art === 'stones' ? 368 : 596, size).length;
      measured += art === 'stones' ? Math.max(n * size * 1.4, 128) + 26 : n * size * 1.4 + 26;
    }
    plaque({ x: 30, y: y - 30, w: 660, h: measured + 40 }, { top: 'rgba(14,42,48,0.86)', bot: 'rgba(9,28,33,0.86)' });
    for (const [h, body, art] of items) {
      text(h, 62, y + 26, Math.round(32 * scale), GOLD, FONT, 700, 'left'); y += Math.round(52 * scale);
      // The one Rules item that shows the real in-game stone art (both sides), using the same
      // drawStone() the board itself uses - never a separate simplified icon.
      if (art === 'stones') {
        drawStone(ctx, 1, 110, y + 44, 40); drawStone(ctx, 2, 210, y + 44, 40);
        text('Shell', 110, y + 98, 18, 'rgba(243,230,200,0.7)', UI, 600);
        text('Greenstone', 210, y + 98, 18, 'rgba(243,230,200,0.7)', UI, 600);
        const n = wrap(body, 290, y + 12, size, 368, CREAM, size * 1.4, 'left'); y += Math.max(n * size * 1.4, 128) + 26;
      } else {
        const n = wrap(body, 62, y + 12, size, 596, CREAM, size * 1.4, 'left'); y += n * size * 1.4 + 26;
      }
    }
    st.pageH = y + st.scroll - top;
    ctx.restore();
    button(BACK, 'Back');
    if (st.pageH > bottom - top) text('drag to scroll', 360, 1436, 22, 'rgba(243,230,200,0.6)', UI, 600);
    const atMin = st.textScaleIdx === 0, atMax = st.textScaleIdx === TEXT_SCALES.length - 1;
    button(TEXT_STEPPER.dec, 'A−', { dim: atMin, size: 30 });
    button(TEXT_STEPPER.inc, 'A+', { dim: atMax, size: 30 });
  }

  // ---------------------------------------------------------------- the Ladder
  function ladder() {
    text('The Ladder', 360, 170, 76, '#f7e8c4', FONT, 700);
    text('Win to climb. Twelve opponents, each a little stronger.', 360, 222, 27, GOLD, FONT, 700);
    wrap('On the last two, holding a draw is enough.', 360, 262, 23, 640, 'rgba(243,230,200,0.75)');
    LADDER.forEach((L, i) => {
      const r = LADDER_ROW(i), rung = i + 1, open = rung <= st.ladder.top, done = !!st.ladder.beaten[rung], now = rung === st.ladder.top;
      plaque(r, now ? { top: 'rgba(38,92,80,0.96)', bot: 'rgba(16,52,46,0.96)' } : open ? {} : { top: 'rgba(12,30,34,0.85)', bot: 'rgba(8,20,24,0.85)' });
      const c = { x: r.x + 46, y: r.y + r.h / 2 };
      drawStone(ctx, i % 2 ? 2 : 1, c.x, c.y, 26, { alpha: open ? 1 : 0.35 });
      text(String(rung), c.x, c.y + 8, 24, i % 2 ? CREAM : '#4a3a20', UI, 800);
      text(L.name, r.x + 92, r.y + 33, 30 * Math.min(big, 1.06), open ? '#f7e8c4' : 'rgba(243,230,200,0.4)', FONT, 700, 'left');
      text(open ? L.note : 'Locked: beat the one before.', r.x + 92, r.y + 60, 20 * Math.min(big, 1.05), open ? 'rgba(243,230,200,0.8)' : 'rgba(243,230,200,0.35)', UI, 600, 'left');
      if (done) { ring({ x: r.x + r.w - 40, y: c.y }, 17, MINT, 3); text('✓', r.x + r.w - 40, c.y + 8, 22, MINT, UI, 800); }
      else if (now) text('play', r.x + r.w - 40, c.y + 8, 22, GOLD, UI, 800);
    });
    const sd = st.side === 0 ? 'Side: alternate' : st.side === 1 ? 'You move first (Shell)' : 'You move second (Greenstone)';
    button(LADDER_SIDE, sd, { size: 24 });
    button(BACK, 'Back');
    if (st.msg) { plaque({ x: 60, y: 238, w: 600, h: 60 }); text(st.msg.text, 360, 276, 24, CREAM); }
  }

  function demoLimit() {
    plaque({ x: 60, y: 500, w: 600, h: 520 });
    text('That is the free preview', 360, 590, 46, '#f7e8c4', FONT, 700);
    wrap('Get the full Mū Tōrere on iPhone or Android for the whole Ladder, every lesson and a new puzzle each day.', 360, 660, 30, 500);
    button(BACK, 'Back');
  }

  // ---------------------------------------------------------------- board scenes: play, lesson, puzzle, over
  function boardScene() {
    const g = st.game, a = st.anim, over = sc === 'over';
    glowDot({ x: BX, y: BY }, 420, '255,226,176', 0.1 + 0.03 * Math.sin(t * 0.8));
    drawBoard(ctx, BX, BY, 1);
    const me = st.two || sc === 'lesson' || sc === 'puzzle' ? g.turn : st.human;
    const humanTurn = !g.winner && (st.two || g.turn === st.human || sc === 'lesson' || sc === 'puzzle');
    // highlights under the stones
    const hl = [];
    if (!over && humanTurn && !a && st.sel >= 0) {
      const moves = legalMoves(g.board, g.turn).filter((m) => m.from === st.sel);
      const rated = st.marks ? rate(g.board, g.turn) : null;
      for (const m of moves) { const bad = rated && rated.find((x) => x.m.from === m.from && x.m.to === m.to && x.v === -1); hl.push({ p: m.to, bad: !!bad }); }
    }
    for (const h of hl) { const p = pointPos(h.p); glowDot(p, 92, h.bad ? '255,120,100' : '120,255,190', 0.5 + 0.25 * pulse(3.2)); ring(p, 58 + 3 * pulse(3.2), h.bad ? '#ff9a86' : '#c6ffe0', 5, 1); if (h.bad) text('!', p.x, p.y + 12, 34, '#ffb4a4', UI, 800); }
    if (st.hint) for (const q of [st.hint.from, st.hint.to]) { const p = pointPos(q); glowDot(p, 80, '255,215,120', 0.35 + 0.25 * pulse(4)); ring(p, 58 + 4 * pulse(4), GOLD, 5, 0.95); }
    const L = sc === 'lesson' ? LESSONS[st.lesson.i].steps[st.lesson.step] : null;
    if (L && L.show && !st.lesson.done) for (const q of L.show) { const p = pointPos(q); ring(p, 62 + 4 * pulse(3), '#fff2c8', 3.5, 0.5 + 0.4 * pulse(3)); }
    if (st.kb && !over) ring(pointPos(st.cursor), 64, '#ffffff', 3, 0.9);
    if (g.last && !over && !a) ring(pointPos(g.last.from), 47, 'rgba(255,240,200,0.5)', 2.5, 0.8);
    // winner's glow
    if (over && g.winner && g.winner < 3) for (let i = 0; i < 9; i++) if (g.board[i] === g.winner) glowDot(pointPos(i), 76, '255,230,160', 0.22 + 0.16 * pulse(2.5));
    // stones
    const skip = a ? (a.refuse ? a.from : a.to) : -1, dragging = st.drag && st.drag.moved ? st.drag.from : -1;
    for (let i = 0; i < 9; i++) {
      const k = g.board[i]; if (!k || i === skip || i === dragging) continue;
      const p = pointPos(i), lifted = i === st.sel;
      const dim = over && g.winner && g.winner < 3 && k !== g.winner;
      drawStone(ctx, k, p.x, p.y, STONE_R, { lift: lifted ? 9 + 2 * pulse(4) : 0, alpha: dim ? 0.78 : 1 });
      if (lifted) ring({ x: p.x, y: p.y - 9 }, 54, GOLD, 4, 0.95);
    }
    if (a) {
      const f = pointPos(a.from), tp = pointPos(a.to), e = Math.min(1, a.t / a.dur);
      const s = e * e * (3 - 2 * e);
      let x, y, lift;
      if (a.refuse) { const k = Math.sin(Math.min(1, e) * Math.PI) * 0.42; x = f.x + (tp.x - f.x) * k; y = f.y + (tp.y - f.y) * k; lift = 8; if (e > 0.5 && !st.calm) x += Math.sin(e * 60) * 4 * (1 - e); }
      else { x = f.x + (tp.x - f.x) * s; y = f.y + (tp.y - f.y) * s; lift = Math.sin(s * Math.PI) * 26; }
      drawStone(ctx, a.side, x, y, STONE_R, { lift });
    }
    if (st.drag && st.drag.moved) drawStone(ctx, g.board[st.drag.from], st.drag.x, st.drag.y - 24, STONE_R * 1.08, { lift: 14 });

    // ---- top area
    text('Mū Tōrere', 360, 148, 50, '#f7e8c4', FONT, 700);
    if (over) { /* the result panel covers the top */ } else if (sc === 'lesson') lessonTop(); else if (sc === 'puzzle') puzzleTop(); else playTop();
    if (!over && g.seen) { const n = g.seen[g.board.join('') + g.turn] || 0; if (n >= 2) { plaque({ x: 150, y: 1246, w: 420, h: 46 }); text(`This position has come up ${n} times. Three is a draw.`, 360, 1277, 21, GOLD, UI, 700); } }
    if (over) overPanel();
    else { bottomButtons(); if (sc === 'play' || sc === 'puzzle') ruleNote(); }
  }
  function ruleNote() {
    plaque({ x: 60, y: 1330, w: 600, h: 96 });
    drawStone(ctx, 1, 108, 1378, 24); ctx.save(); ctx.strokeStyle = MINT; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(160, 1378, 22, 0, TAU); ctx.stroke(); ctx.restore();
    wrap('The putahi (centre) can be entered only from a point beside an enemy stone.', 410, 1372, 22, 400, CREAM, 28, 'center');
  }
  function turnBar(label, sub, side) {
    plaque({ x: 40, y: 184, w: 640, h: 84 });
    if (side) drawStone(ctx, side, 96, 226, 27);
    text(label, side ? 142 : 70, 224, 32 * Math.min(big, 1.06), '#f7e8c4', FONT, 700, 'left');
    if (sub) text(sub, side ? 142 : 70, 252, 21, 'rgba(243,230,200,0.75)', UI, 600, 'left');
  }
  function msgBox(defaultText) {
    const s = st.msg ? st.msg.text : defaultText; if (!s) return;
    plaque({ x: 40, y: 286, w: 640, h: 118 }, st.msg ? { top: 'rgba(38,26,12,0.95)', bot: 'rgba(24,14,6,0.95)' } : {});
    const size = 26 * big, n = Math.ceil(String(s).length * size * 0.5 / 590); wrap(s, 360, 286 + 59 - (Math.max(1, Math.min(3, n)) - 1) * size * 0.66 + size * 0.34, size, 590);
  }
  function playTop() {
    const g = st.game, mine = st.two ? null : st.human;
    if (g.winner) turnBar('Game over', st.two ? '' : `You are ${SIDE_NAME[st.human]}`, mine);
    else if (st.two) turnBar(`${SIDE_NAME[g.turn]} to move`, 'Pass the phone after each move', g.turn);
    else if (g.turn === st.human) turnBar('Your move', `You are ${SIDE_NAME[st.human]}  ·  vs ${LADDER[st.rung - 1].name}`, g.turn);
    else turnBar(st.think > 0 || !st.anim ? `${LADDER[st.rung - 1].name} is thinking${'.'.repeat(1 + (Math.floor(t * 2.5) % 3))}` : 'Moving…', `vs ${LADDER[st.rung - 1].name}, rung ${st.rung}`, g.turn);
    msgBox(st.two || g.turn === st.human ? 'TAP a stone, then TAP a glowing point. Or DRAG it.' : '');
  }
  function lessonTop() {
    const l = LESSONS[st.lesson.i], step = l.steps[st.lesson.step];
    const size = 27 * big, shown = st.lesson.done ? (st.lesson.doneText || 'Well done.') : step.text;
    ctx.font = `600 ${size}px ${UI}`; let n = 1, cur = '';
    for (const w of shown.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 600 && cur) { n++; cur = w; } else cur = t2; }
    const h = 84 + n * size * 1.32;
    plaque({ x: 30, y: 176, w: 660, h });
    text(`Lesson ${st.lesson.i + 1} of ${LESSONS.length}: ${l.title}`, 360, 222, 32, GOLD, FONT, 700);
    wrap(shown, 360, 268, size, 600, CREAM, size * 1.32);
    if (st.msg) { const y = 176 + h + 10; plaque({ x: 40, y, w: 640, h: 112 }, { top: 'rgba(38,26,12,0.95)', bot: 'rgba(24,14,6,0.95)' }); const s2 = 23 * big; wrap(st.msg.text, 360, y + 42, s2, 600, CREAM, s2 * 1.25); }
  }
  function puzzleTop() {
    const P = st.pz;
    if (!P || !P.p) { plaque({ x: 40, y: 184, w: 640, h: 84 }); text('Setting up today\'s puzzle…', 360, 236, 30, CREAM); return; }
    const g = st.game;
    turnBar(`Daily puzzle: win in ${movesToWin(P.p)}`, `You are ${SIDE_NAME[P.p.turn]}  ·  ${P.status === 'solved' ? 'solved' : 'find the move that traps them'}`, P.p.turn);
    msgBox(P.status === 'solved' ? 'Solved! Come back tomorrow for a new one.' : g.winner ? '' : 'TAP a stone, then TAP a glowing point.');
  }
  function bottomButtons() {
    button(BTN.menu, 'Menu', { size: 27 });
    if (sc === 'lesson') { if (st.lesson.done) button(BTN.cont, st.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true }); else button(BTN.undo, 'Restart', { size: 27 }); }
    else if (sc === 'puzzle') button(BTN.hint, st.hintsLeft > 0 ? `Hint (${st.hintsLeft})` : 'Hint', { size: 27, dim: st.hintsLeft <= 0 });
    else { button(BTN.undo, 'Take back', { size: 27, dim: !st.undo.length }); if (!st.two) button(BTN.hint, `Hint (${st.hintsLeft})`, { size: 27, dim: st.hintsLeft <= 0 }); }
    if (sc === 'puzzle' && st.pz && st.pz.status === 'solved') button(BTN.cont, 'Share result', { primary: true });
  }
  function overPanel() {
    const R = st.result; plaque({ x: 40, y: 176, w: 640, h: 300 }, { top: 'rgba(24,62,56,0.99)', bot: 'rgba(10,32,32,0.99)' });
    band(ctx, 170, 550, 214, 10, 'rgba(232,199,119,0.6)', 2.4);
    text(R.title, 360, 296, 66, '#f7e8c4', FONT, 700);
    wrap(R.why, 360, 350, 26 * big, 580, CREAM, 26 * big * 1.3);
    if (R.extra) wrap(R.extra, 360, 440, 24, 580, MINT, 30);
    R.btns.forEach((b, i) => button([BTN.over1, BTN.over2, BTN.over3][i], b.label, { primary: i === 0 }));
  }
}
