// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js, pieces.js).
import { W, H, pointAt, COW_R, PEN, penSlot, MSG, BTN, TEXT_STEPPER, TEXT_SCALES, AUTO_THINK_STEPS, titleRows, inRect, infoFooterRects } from './layout.js';
import { drawBackdrop, drawBoard, drawLife, band, PIGMENT, poly, TAU } from './art.js';
import { drawCow } from './pieces.js';
import { RULES as R } from './morabaraba.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PAGES } from './info.js';
import { puzzleTitle, puzzleGoal } from './puzzles.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const NAME = { 1: 'Dark', 2: 'Light' };
export const boardOf = (state) => (state.take ? state.take.board : state.game.board);

export function render(ctx, state) {
  const scene = state.scene, auto = scene === 'auto', D = state.auto;
  const g = auto ? D.game : state.game, a = auto ? D.anim : state.anim, big = state.big;
  drawBackdrop(ctx); drawLife(ctx, state.t, state.calm);
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'auto' || (scene === 'puzzle' && state.pz.status !== 'making');

  const text = (str, x, y, size, color = '#fbe6b8', font = FONT, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(20,4,2,0.7)'; ctx.fillText(str, x + 1.5, y + 2); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => { const L = lines(str, maxW, size); L.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return L.length; };
  // Shrinks a one-line title only if it would otherwise run past the canvas edges at the top text
  // scale (a no-op for every short title, which already fits at the base size).
  const fitTitle = (str, base, maxW = 640, font = FONT, weight = 700) => {
    let size = base; ctx.font = `${weight} ${size}px ${font}`;
    while (ctx.measureText(str).width > maxW && size > 30) { size -= 2; ctx.font = `${weight} ${size}px ${font}`; }
    return size;
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(15,3,1,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 16); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#f6cd6a' : '#7d3a22'); gr.addColorStop(1, o.primary ? '#c98a2c' : '#48180e');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.8)' : 'rgba(240,180,90,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    // little painted triangles at both ends (decoration)
    const th = r.h * 0.36, cy = r.y + r.h / 2, cols = [PIGMENT.ochre, PIGMENT.teal, PIGMENT.clay];
    for (const [sx, dir] of (r.w > 250 ? [[r.x + 12, 1], [r.x + r.w - 12, -1]] : [])) for (let k = 0; k < 2; k++) { ctx.fillStyle = o.primary ? (k ? '#7a3a1c' : '#3a1a0a') : cols[k]; ctx.beginPath(); ctx.moveTo(sx + dir * k * 9, cy - th / 2); ctx.lineTo(sx + dir * (k * 9 + th * 0.7), cy); ctx.lineTo(sx + dir * k * 9, cy + th / 2); ctx.closePath(); ctx.fill(); }
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.34, o.size ?? 30, o.primary ? '#2a1204' : '#fbe6b8', UI, 700, 'center', !o.primary);
    ctx.restore();
  };
  const panel = (x, y, w, h, alpha = 0.72) => { ctx.fillStyle = `rgba(28,8,4,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill(); ctx.strokeStyle = 'rgba(240,180,90,0.5)'; ctx.lineWidth = 2; ctx.stroke(); };
  const glowAt = (i, rgb, pulse, r = 26) => { const p = pointAt(i); const gr = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * p.s * 1.5); gr.addColorStop(0, `rgba(${rgb},${0.75 + pulse * 0.2})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * p.s * 1.5, r * p.s * 1.25, 0, 0, TAU); ctx.fill(); };
  const cowAt = (i, side, o = {}) => { const p = pointAt(i); drawCow(ctx, p.x, p.y + 10 * p.s, COW_R * p.s * 1.28, side, o); };

  if (boardScene) {
    // ---- header on the sky ----
    text('Morabaraba', 360, 92, 52);
    band(ctx, 150, 112, 420, 14, 1);
    // Auto Play treats both sides like "two players" for layout/label purposes - nobody is really
    // "you" in that mode, so it gets the same plain Dark/Light labels a real two-player game shows.
    const twoLike = state.two || auto;
    const bottom = twoLike ? 1 : state.human, topSide = 3 - bottom;
    if (scene === 'auto') {
      const thinkS = AUTO_THINK_STEPS[state.autoThinkIdx];
      const phaseWord = D.phase === 'think' ? 'thinking' : D.phase === 'reveal' ? 'about to act' : 'playing';
      text('Auto Play · Watch & Learn', 360, 148, 23, 'rgba(255,230,180,0.9)', UI, 600);
      drawCow(ctx, 92, 250, 40, g.turn, { face: g.turn === 1 ? 1 : -1 });
      text(`${NAME[g.turn]} is ${phaseWord}`, 150, 206, 34, '#ffffff', UI, 700, 'left');
      const sub = D.phase === 'think' ? 'THINK: work out your own answer before it is revealed.' : D.phase === 'reveal' ? 'REVEAL: the highlighted move is the one about to be played.' : 'ACT: watch it play out.';
      const subLines = wrap(sub, 150, 244, 20, 560, 'rgba(255,230,180,0.95)', 26, 'left');
      text(`Think time: ${thinkS}s (max 10s)`, 150, 244 + subLines * 26 + 16, 21, 'rgba(255,230,180,0.75)', UI, 500, 'left');
      const atMin = state.autoThinkIdx === 0, atMax = state.autoThinkIdx === AUTO_THINK_STEPS.length - 1;
      button(TEXT_STEPPER.dec, '−', { dim: atMin, size: 30 }); button(TEXT_STEPPER.inc, '+', { dim: atMax, size: 30 });
    } else if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 360, 172, 26, 'rgba(255,230,180,0.9)', UI, 600);
      text(l.title, 360, 232, 48);
      const step = l.steps[Math.min(state.lesson.step, l.steps.length - 1)];
      const body = state.lesson.done ? l.done : step.text;
      ctx.save(); panel(30, 246, 660, 98, 0.82); ctx.restore();
      const L = lines(body, 620, big ? 27 : 23); const sz = big ? 27 : 23, lh = sz * 1.22, y0 = 246 + 49 - ((L.length - 1) * lh) / 2 + sz * 0.34;
      L.forEach((ln, i) => text(ln, 360, y0 + i * lh, sz, state.lesson.done ? '#d2f7c4' : '#fff3d6', UI, 600));
    } else if (scene === 'puzzle') {
      text('Daily puzzle', 360, 172, 28, 'rgba(255,230,180,0.9)', UI, 600);
      text(puzzleTitle(state.pz.puzzle), 360, 232, 46);
      const body = state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow.` : puzzleGoal(state.pz.n);
      text(body, 360, 290, big ? 27 : 24, '#fff3d6', UI, 600); text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 330, 22, 'rgba(255,230,180,0.85)', UI, 600);
    } else {
      const turnText = g.winner ? 'Game over' : state.take ? 'Shoot a cow: TAP a glowing one' : state.two ? `${NAME[g.turn]} to move` : g.turn === state.human ? `Your move (${NAME[g.turn].toLowerCase()})` : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
      drawCow(ctx, 92, 250, 40, g.turn, { face: g.turn === 1 ? 1 : -1 });
      text(turnText, 150, 196, 34, '#ffffff', UI, 700, 'left');
      const ph = g.winner ? '' : R.phase(g, g.turn);
      const sub = state.take ? 'A mill! Choose one cow to shoot' : ph === 'place' ? `Place a cow (${g.hand[g.turn]} left to place)` : ph === 'fly' ? 'Down to three: this side may FLY anywhere' : ph === 'move' ? 'Slide a cow one step along a line' : '';
      text(sub, 150, 236, 23, 'rgba(255,230,180,0.95)', UI, 600, 'left');
      text(state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`, 150, 274, 22, 'rgba(255,230,180,0.75)', UI, 500, 'left');
    }

    // ---- pens ----
    const pen = (which, side) => {
      const R0 = PEN[which]; panel(R0.x, R0.y, R0.w, R0.h, 0.66); band(ctx, R0.x + 10, R0.y + 7, R0.w - 20, 9, side + 1);
      const lost = g.shots[3 - side];
      for (let i = 0; i < 12; i++) {
        const s = penSlot(which, i);
        if (i < g.hand[side]) drawCow(ctx, s.x, s.y + 8, 21, side, { face: side === 1 ? 1 : -1 });
        else if (i >= 12 - lost) { drawCow(ctx, s.x, s.y + 8, 21, side, { face: side === 1 ? 1 : -1, alpha: 0.25 }); ctx.strokeStyle = 'rgba(255,120,90,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x - 11, s.y - 10); ctx.lineTo(s.x + 11, s.y + 10); ctx.moveTo(s.x + 11, s.y - 10); ctx.lineTo(s.x - 11, s.y + 10); ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(240,190,120,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, 15, 8, 0, 0, TAU); ctx.stroke(); }
      }
    };
    pen('top', topSide); pen('bottom', bottom);
    text(`${NAME[topSide]}${twoLike ? '' : ' · computer'}`, 646, PEN.top.y + 79, 15, 'rgba(255,230,180,0.75)', UI, 600, 'right', false);
    text(`${NAME[bottom]}${twoLike ? '' : ' · you'}`, 646, PEN.bottom.y + 79, 15, 'rgba(255,230,180,0.75)', UI, 600, 'right', false);

    // ---- the board ----
    drawBoard(ctx);
    // boardOf() reads state.take/state.game directly; Auto Play's board lives at `g` (already
    // resolved above to state.auto.game) instead, and never uses the take-a-cow sub-step.
    const board = auto ? g.board : boardOf(state), pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    // mills glow
    if (scene !== 'over') for (const s of [1, 2]) for (const k of R.heldMills(board, s)) {
      const m = R.mills[k], pts = m.map(pointAt);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,190,70,${0.28 + pulse * 0.1})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,236,170,0.75)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
    const humanTurn = !g.winner && (state.two || g.turn === state.human);
    // legal destinations of the selected or dragged cow
    if (state.sel >= 0 && !a && !state.take) for (const m of R.basicMoves(g)) if (m.from === state.sel) glowAt(m.to, '255,236,140', pulse);
    if (state.hint && !a) { glowAt(state.hint.to, '120,255,170', pulse, 30); if (state.hint.from >= 0) glowAt(state.hint.from, '120,255,170', pulse, 30); }
    if (state.lessonGlow && !a) for (const i of state.lessonGlow) glowAt(i, '255,236,140', pulse, 30);
    // warnings: points where the other side would close a mill on its next move
    if (!auto && state.marks && humanTurn && !state.take && scene !== 'over' && scene !== 'lesson') for (const i of state.threats || []) glowAt(i, '255,90,70', pulse, 22);
    if (state.take) for (const i of state.take.opts) { glowAt(i, '255,80,60', pulse, 36); const p = pointAt(i); ctx.strokeStyle = `rgba(255,90,70,${0.6 + pulse * 0.4})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, p.y + 10 * p.s, 34 * p.s, 15 * p.s, 0, 0, TAU); ctx.stroke(); }
    // Auto Play's REVEAL phase: every legal destination this turn (dim gold ring/glow), then the ONE
    // move actually about to be played highlighted far more strongly (bright green), so a watcher can
    // compare their own guess against it before it happens.
    if (scene === 'auto' && D.phase === 'reveal' && D.moves) {
      const isChosen = (m) => D.chosen && m.type === D.chosen.type && m.to === D.chosen.to && (m.from ?? -1) === (D.chosen.from ?? -1);
      for (const m of D.moves) { if (!isChosen(m)) glowAt(m.to, '255,224,140', pulse, 26); }
      const c = D.chosen;
      if (c) { glowAt(c.to, '120,255,170', pulse, 36); if (c.from >= 0) glowAt(c.from, '120,255,170', pulse, 32); }
    }
    // cows, far rows first
    const order = []; for (let i = 0; i < 24; i++) order.push(i); order.sort((x, y) => pointAt(x).y - pointAt(y).y);
    const moving = a && a.t < a.mdur && a.type !== 'shot';
    for (const i of order) {
      const k = board[i]; if (!k) { if (a && a.take === i && a.t < a.mdur + a.sdur) shotCow(i); continue; }
      if (moving && a.to === i) continue;
      if (state.drag && state.drag.moved && state.drag.from === i) continue;
      if (a && a.type === 'refuse' && a.from === i) continue;
      const lift = state.sel === i ? 0.32 + (state.calm ? 0 : Math.sin(state.t * 4) * 0.05) : 0;
      cowAt(i, k, { lift });
    }
    function shotCow(i) {
      const f = Math.max(0, (a.t - a.mdur) / a.sdur), p = pointAt(i);
      ctx.save(); ctx.globalAlpha = 1 - f; drawCow(ctx, p.x, p.y + 10 * p.s - f * 26, COW_R * p.s * 1.28 * (1 + f * 0.25), a.tside, {}); ctx.restore();
      if (!state.calm) { ctx.strokeStyle = `rgba(255,214,150,${0.8 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + 6, (20 + 70 * f) * p.s, (12 + 40 * f) * p.s, 0, 0, TAU); ctx.stroke(); }
    }
    // the cow in motion
    if (a && a.type !== 'shot' && a.t < a.mdur + 0.0001) {
      const f = Math.min(1, a.t / a.mdur), e = f * f * (3 - 2 * f), to = pointAt(a.to);
      let from;
      if (a.type === 'place') { const s = penSlot(a.pen, a.hand); from = { x: s.x, y: s.y + 8, s: 0.55 }; } else from = pointAt(a.from);
      if (a.type === 'refuse') {
        const reach = a.to === a.from ? 0 : board[a.to] ? 0.55 : 0.92, out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, ee = out * out * (3 - 2 * out) * reach;
        const shake = state.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 : a.to === a.from ? Math.sin(f * 40) * 6 * (1 - f) : 0;
        drawCow(ctx, from.x + (to.x - from.x) * ee + shake, from.y + 10 * from.s + (to.y - from.y) * ee, COW_R * from.s * 1.28, board[a.from] || a.kind, { lift: 0.3 * Math.sin(Math.PI * Math.min(1, f * 1.1)) });
      } else {
        const sc = from.s + (to.s - from.s) * e, arc = Math.sin(Math.PI * f) * (a.type === 'fly' ? 1.6 : a.type === 'place' ? 1.0 : 0.45);
        drawCow(ctx, from.x + (to.x - from.x) * e, from.y + (a.type === 'place' ? 0 : 10 * from.s) + (to.y + 10 * to.s - from.y - (a.type === 'place' ? 0 : 10 * from.s)) * e, COW_R * sc * (a.type === 'place' ? 1 - 0.55 * (1 - e) + 0.28 : 1.28), a.kind, { lift: arc });
      }
    }
    if (state.drag && state.drag.moved) { const p = state.drag; drawCow(ctx, p.x, p.y + 20, COW_R * 1.35, g.board[p.from], { lift: 0.4 }); }
    if (state.kb && scene !== 'over') { const c = pointAt(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 34 * c.s, 28 * c.s, 0, 0, TAU); ctx.stroke(); }

    // ---- message and buttons ----
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      const ms = big ? 31 : 26, lh = big ? 38 : 33, L = lines(state.msg.text, 590, ms), h = 34 + L.length * lh;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(MSG.x + 10, MSG.y + (MSG.h - h) / 2, MSG.w - 20, h, 0.9);
      L.forEach((ln, i) => text(ln, 360, MSG.y + (MSG.h - h) / 2 + 42 + i * lh, ms, '#fff3d6', UI, 600)); ctx.restore();
    }
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 26 }); button(BTN.undo, 'Take back', { size: 26 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 26 }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'auto' && D.phase !== 'over') { button(BTN.menu, 'Exit', { size: 26 }); button(BTN.undo, 'Skip wait', { size: 26, dim: D.phase === 'act' }); }
  }

  // ---- the title and other full screens ----
  const showTitleArt = scene === 'title' || scene === 'demo-limit' || scene === 'info' || (scene === 'puzzle' && state.pz.status === 'making');
  if (showTitleArt) {
    const bob = state.calm ? 0 : Math.sin(state.t * 1.6) * 4;
    { const sh = ctx.createLinearGradient(0, 600, 0, 700); sh.addColorStop(0, 'rgba(20,5,2,0)'); sh.addColorStop(1, 'rgba(20,5,2,0.3)'); ctx.fillStyle = sh; ctx.fillRect(0, 600, W, 100); ctx.fillStyle = 'rgba(20,5,2,0.3)'; ctx.fillRect(0, 700, W, H - 700); }
    if (scene !== 'info') {
      text('Morabaraba', 360, 150, 84); band(ctx, 130, 176, 460, 18, 2);
      text('The game of twelve cows', 360, 236, 32, '#fde9c0', FONT, 700);
      drawCow(ctx, 190, 545 + bob, 96, 1); drawCow(ctx, 530, 545 - bob, 96, 2);
      // a small board between them
      const bx = 360, by = 500, s = 11;
      ctx.lineCap = 'round';
      for (const [w, col, dy] of [[5, 'rgba(255,210,160,0.5)', 1.5], [4, '#2a0f08', 0]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (const [a1, a2] of RULES_SEG) { const [u1, v1] = UV[a1], [u2, v2] = UV[a2]; ctx.moveTo(bx + u1 * s * 1.9, by + dy + v1 * s * 1.5); ctx.lineTo(bx + u2 * s * 1.9, by + dy + v2 * s * 1.5); }
        ctx.stroke();
      }
    }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text('Preparing today\'s puzzle…', 360, 1000, 34, '#fff3d6', UI, 600); button(BTN.menu, 'Menu', { size: 26 }); }
  if (scene === 'title') {
    const RW = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (RW.resume) button(RW.resume, 'Continue your game', { primary: true, size: 30 });
    button(RW.learn, 'Learn to play', { primary: !state.learned && !RW.resume, size: 30 });
    button(RW.dark, 'Play as Dark', { primary: state.learned && !RW.resume, size: 26 }); button(RW.light, 'Play as Light', { size: 26 });
    button(RW.two, 'Two players, one phone', { size: 28 });
    button(RW.daily, solvedToday ? `Daily puzzle: solved · ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(RW.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(RW.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 });
    button(RW.marks, state.marks ? 'Warnings on' : 'Warnings off', { size: 22 }); button(RW.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 19 });
    button(RW.big, state.big ? 'Large text: on' : 'Large text: off', { size: 22 }); button(RW.howto, 'How to play', { size: 22 });
    button(RW.about, 'About Morabaraba', { size: 18 }); button(RW.rules, 'Rules', { size: 20 }); button(RW.auto, 'Auto Play', { size: 18 });
    let sy = RW.about.y + 100; for (const [side, x0, label] of [[1, 100, 'As Dark'], [2, 390, 'As Light']]) { text(label, x0, sy, 21, 'rgba(255,230,180,0.85)', UI, 600, 'left', false); for (let l = 0; l < LEVELS.length; l++) text('★', x0 + 92 + l * 34, sy + 2, 28, state.stats.badges['s' + side + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left', false); }
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, sy + 40, 21, 'rgba(255,230,180,0.7)', UI, 500, 'center', false);
    if (state.msg) { panel(60, 640, 600, 46, 0.7); text(state.msg.text, 360, 672, 21, '#fff3d6', UI, 600, 'center', false); }
  } else if (scene === 'demo-limit') {
    text('That was the free taste.', 360, 900, 46); text('Get Morabaraba on iPhone and Android', 360, 970, 28, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1010, 28, '#fff3d6', UI, 600);
  } else if (scene === 'info') {
    const pages = PAGES[state.info.which], p = pages[state.info.page];
    // Text scale for these reference pages only (independent of the gameplay "Large text" setting,
    // which affects other screens too). Always guarded: an out-of-range saved index (e.g. from a
    // build with a shorter TEXT_SCALES array) falls back to 1, never NaN.
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const heading = state.info.which === 'about' ? 'About' : state.info.which === 'rules' ? 'Rules' : 'How to play';
    text(heading, 360, 130, Math.round(60 * Math.min(scale, 1.15))); band(ctx, 160, 154, 400, 14, 3);
    // One fixed-size framed panel holds the page's own sub-title, optional cow art and body text on
    // EVERY page (never sized to content) - so the reference reads as one consistent designed
    // sheet, not a box that jumps around in size/position and leaves bare background beneath it on
    // a short page (which is what a content-driven panel did before).
    const PANEL_Y = 190, PANEL_BOTTOM = 1400;
    panel(30, PANEL_Y, 660, PANEL_BOTTOM - PANEL_Y, 0.78);
    // The page's own sub-title is a heading, not the body copy the stepper exists to grow, so it is
    // capped the same way the "Rules"/"About"/"How to play" header above it already is
    // (Math.min(scale, 1.15)) - a SHORT title (e.g. "The board", "The cow") has plenty of width
    // budget left at fitTitle's maxW even at 300% and, left uncapped, grew large enough to overlap
    // the header/divider band above it (confirmed by rendering "The board" at 300% and seeing its
    // own glyphs cross the panel's top edge). The title-to-body gap still grows with the actual
    // rendered title size, since the title font still grows some with scale.
    const titleSize = fitTitle(p.title, Math.round(46 * Math.min(scale, 1.15)));
    const bodySz = Math.round(30 * scale);
    let y = PANEL_Y + 66 + Math.round(8 * (scale - 1));
    text(p.title, 360, y, titleSize);
    // The gap from the title's own baseline down to the body/cow-art below it has to clear BOTH the
    // title's own descent (scales with titleSize) AND the body font's own ascent (a big scaled body
    // line's cap-height reaches well above its baseline) - using only one term left the two crowding
    // or overlapping at the top text-size steps (confirmed by rendering the exact "The board and
    // setup" page at 300% and seeing "Three squares" crowd right under it).
    y += Math.round(titleSize * 0.5) + Math.round(bodySz * 0.85) + 30;
    // A rules page about the cow shows the real in-game sprite, both sides, the same drawCow() the board itself uses.
    if (p.cows) {
      const ay = y + 60, dx = 108, r = 50;
      drawCow(ctx, 360 - dx, ay, r, 1); drawCow(ctx, 360 + dx, ay, r, 2);
      text('Dark', 360 - dx, ay + 46, 18, 'rgba(255,230,180,0.8)', UI, 600, 'center', false);
      text('Light', 360 + dx, ay + 46, 18, 'rgba(255,230,180,0.8)', UI, 600, 'center', false);
      // The gap from the "Dark"/"Light" caption down to the body text below has to grow with the
      // body font too (the cow art itself is fixed-size, never scaled) - a fixed gap here let a big
      // scaled first body line's own ascent climb up into the caption at the top text-size steps.
      y = ay + 46 + 30 + Math.round(bodySz * 0.9);
    }
    const lhh = Math.round(bodySz * 1.4);
    for (const para of p.lines) { const n = wrap(para, 70, y, bodySz, 580, '#fff3d6', lhh, 'left'); y += n * lhh + 30; }
    text(`${state.info.page + 1} of ${pages.length}`, 360, 1420, 22, 'rgba(255,230,180,0.75)', UI, 600, 'center', false);
    // The footer always fills the same x=46..674 strip: Menu is always present, Back only past page
    // 1, Next only before the last page - 3 equal pills, or 2 wider ones on the first/last page,
    // never a lopsided pair with a dead gap where Back would have been.
    const hasBack = state.info.page > 0, hasNext = state.info.page + 1 < pages.length;
    const F = infoFooterRects(hasBack, hasNext);
    button(F.menu, 'Menu', { size: 26 });
    if (hasBack) button(F.back, 'Back', { size: 26 });
    if (hasNext) button(F.next, 'Next', { size: 26, primary: true });
    const atMin = state.textScaleIdx === 0, atMax = state.textScaleIdx === TEXT_SCALES.length - 1;
    button(TEXT_STEPPER.dec, 'A−', { dim: atMin, size: 30 });
    button(TEXT_STEPPER.inc, 'A+', { dim: atMax, size: 30 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(14,4,2,0.72)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : state.two ? `${NAME[g.winner]} wins` : g.winner === state.human ? 'You win!' : 'The computer wins';
    if (g.winner !== 'draw') drawCow(ctx, 360, 600, 130, g.winner);
    text(won, 360, 720, 68); text(g.reason, 360, 780, 26, '#fff3d6', UI, 500);
    text(`${g.moves} moves · Dark shot ${g.shots[1]}, Light shot ${g.shots[2]}`, 360, 826, 22, 'rgba(255,230,180,0.75)', UI, 500);
    if (!state.two && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten as ${NAME[state.human]}`, 360, 868, 24, '#ffd24a', UI, 600);
      if (!state.calm) for (let k = 0; k < 14; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 34 }); button(BTN.back, 'Menu', { size: 30 });
  } else if (scene === 'auto' && D.phase === 'over') {
    // Auto Play's own end screen: the whole "game" (one full game to a real win/draw) just finished.
    // Same shape as the normal 'over' screen but its own two actions, and it never mentions "you".
    ctx.fillStyle = 'rgba(14,4,2,0.72)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : `${NAME[g.winner]} wins`;
    if (g.winner !== 'draw') drawCow(ctx, 360, 600, 130, g.winner);
    text(won, 360, 720, 68); text(g.reason, 360, 780, 26, '#fff3d6', UI, 500);
    text(`${g.moves} moves · Dark shot ${g.shots[1]}, Light shot ${g.shots[2]}`, 360, 826, 22, 'rgba(255,230,180,0.75)', UI, 500);
    text('A full Auto Play demonstration just finished. Nothing here was saved.', 360, 868, 22, '#ffd24a', UI, 600);
    button(BTN.again, 'Play again (auto)', { primary: true, size: 30 }); button(BTN.back, 'Exit to menu', { size: 28 });
  }
}
import { POINT_UV as UV } from './morabaraba.js';
import { BOARD_SEGMENTS as RULES_SEG } from './art.js';
