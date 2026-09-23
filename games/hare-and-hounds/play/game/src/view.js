// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// Static art (forest floor, map) and the two pieces are cached sprites (art.js, pieces.js), so a frame is cheap.
import { W, H, pointAt, PIECE_R, SIZE, UNIT, BTN, LOOK, RULES_NAV, TILE, titleRows, clockPos, CLOCK_Y, overButtons } from './layout.js';
import { drawTableAndBoard, drawLeaf, BOARD_NAMES } from './art.js';
import { drawHare, drawHound, SET_NAMES } from './pieces.js';
import { unlocked } from './unlocks.js';
import { legalMoves, hareReach } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PUZZLE_TEXT } from './puzzles.js';
import { CAMPAIGN } from './campaign.js';
import { RULES } from './content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SIDE = { H: 'Hare', D: 'Hounds' };
const TAU = Math.PI * 2;
export const NAME = 'Hare and Hounds';

export function render(ctx, state) {
  drawTableAndBoard(ctx, state.look.board);
  const set = state.look.set, big = state.look.big;
  const g = state.game, a = state.anim, scene = state.scene;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');

  const text = (str, x, y, size, color = '#f6e3b4', font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => {
    ctx.font = `600 ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return lines.length;
  };
  const piece = (k, pos, opts = {}) => { const r = PIECE_R * pos.s * SIZE[k] * (opts.scale ?? 1); (k === 'H' ? drawHare : drawHound)(ctx, pos.x, pos.y - r * 0.56, r, { set, ...opts }); };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#f1cd78' : '#6b5a34'); gr.addColorStop(1, o.primary ? '#c28e2c' : '#3a2f18');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(255,232,170,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.35, o.size ?? 30, o.primary ? '#2a1a06' : '#f6e3b4', UI, 700);
    ctx.restore();
  };
  const glow = (i, rgb, pulse) => { const p = pointAt(i); ctx.fillStyle = `rgba(${rgb},${0.45 + pulse * 0.3})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 34 * UNIT * p.s, 28 * UNIT * p.s, 0, 0, TAU); ctx.fill(); };

  // drifting leaves: a few cached sprites, still in reduced-motion mode
  if (!state.calm) for (let k = 0; k < 7; k++) {
    const t = state.t, x = ((k * 173 + t * (10 + k * 3)) % 800) - 40 + Math.sin(t * 0.6 + k) * 22, y = ((k * 331 + t * (16 + k * 4)) % 1700) - 70;
    ctx.globalAlpha = 0.7; drawLeaf(ctx, x, y, 9 + (k % 3) * 4, t * 0.7 + k, k); ctx.globalAlpha = 1;
  }

  // where the moving piece is right now
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), ease = f * f * (3 - 2 * f), to = pointAt(a.to), from = pointAt(a.from);
    if (a.type === 'refuse') {
      const reach = a.to === a.from ? 0 : g.board[a.to] ? 0.55 : 0.92;
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = state.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 * UNIT : a.to === a.from ? Math.sin(f * 40) * 6 * (1 - f) : 0;
      return { x: from.x + (to.x - from.x) * e + shake, y: from.y + (to.y - from.y) * e, s: from.s + (to.s - from.s) * e, lift: 0.4 * Math.sin(Math.PI * Math.min(1, f * 1.1)) };
    }
    return { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, s: from.s + (to.s - from.s) * ease, lift: Math.sin(Math.PI * f) * (a.kind === 'H' ? 0.95 : 0.4) };   // the hare bounds, hounds trot
  };

  if (boardScene) {
    // ---- header ---------------------------------------------------------------------------------------
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 410, 130, 26, 'rgba(246,227,180,0.85)', UI, 600);
      text(l.title, 360, 214, 46);
      wrap(state.lesson.done ? l.done : l.text, 360, 258, big ? 30 : 25, 640, state.lesson.done ? '#c9f7c0' : '#ffffff', big ? 36 : 31);
    } else if (scene === 'puzzle') {
      const t = PUZZLE_TEXT[state.pz.puzzle.type];
      text('Daily puzzle', 410, 130, 26, 'rgba(246,227,180,0.85)', UI, 600);
      piece(t.side, { x: 96, y: 262, s: 1 }, { scale: 0.62 });
      text(t.title, 150, 226, 38, '#ffffff', UI, 700, 'left');
      wrap(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : t.goal(state.pz.puzzle.n), 150, 262, big ? 27 : 24, 540, '#fff3d6', 30, 'left');
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 64, 340, 24, '#f6e3b4', UI, 600, 'left');
    } else {
      text(NAME, 410, 130, 40);
      const camp = state.camp >= 0 ? CAMPAIGN[state.camp] : null;
      if (!state.msg) {
        const turnText = g.winner ? '' : state.two ? `${SIDE[g.turn]} to move` : g.turn === state.human ? `Your move (${SIDE[g.turn].toLowerCase()})` : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
        piece(g.turn, { x: 96, y: 232, s: 1 }, { scale: 0.62 });
        text(turnText, 150, 222, 34, '#ffffff', UI, 700, 'left');
        text(camp ? `Level ${state.camp + 1}: ${camp.name}` : state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`, 150, 258, 22, 'rgba(246,227,180,0.85)', UI, 500, 'left');
        const left = Math.max(0, g.limit - g.hm);
        text(g.limit > 60 ? '' : `Hunt clock: the hounds have ${left} move${left === 1 ? '' : 's'} left`, 360, 296, 22, left <= 3 ? '#ff9a80' : '#f6e3b4', UI, 600);
      }
    }
    if (g.limit <= 60 && (scene === 'play' || scene === 'over' || (scene === 'lesson' && LESSONS[state.lesson.i].limit))) for (let k = 0; k < g.limit; k++) {                  // the clock: a token per hound move
      const c = clockPos(k, g.limit), used = k < g.hm;
      ctx.fillStyle = used ? 'rgba(0,0,0,0.5)' : g.limit - g.hm <= 3 ? '#e9663a' : '#e8b84a'; ctx.beginPath(); ctx.arc(c.x, c.y, used ? 5 : 8, 0, TAU); ctx.fill();
      if (!used) { ctx.strokeStyle = 'rgba(255,240,190,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }

    // ---- the board ------------------------------------------------------------------------------------
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    if (state.marks && scene !== 'over' && g.turn === 'D' && (state.two || state.human === 'D') && !a) for (const i of hareReach(g)) glow(i, '255,120,90', 0.1);          // where the hare could go next
    if (state.sel >= 0 && !a) for (const m of legalMoves(g)) if (m.from === state.sel) glow(m.to, '255,236,150', pulse);
    if (state.hint && !a) { glow(state.hint.to, '120,255,170', pulse); glow(state.hint.from, '120,255,170', pulse); }
    const order = [...Array(11).keys()].sort((p, q) => pointAt(p).y - pointAt(q).y);
    for (const i of order) {                                          // far points first; the moving piece is drawn where it is, not where it will be
      if (a && ((a.type !== 'refuse' && i === a.to) || (a.type === 'refuse' && i === a.from))) continue;
      const k = g.board[i]; if (!k) continue;
      const sel = state.sel === i;
      piece(k, pointAt(i), { selected: sel, lift: sel ? 0.5 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0 });
    }
    if (a) { const pos = animPos(); piece(a.kind, pos, { lift: pos.lift, selected: a.type === 'refuse' }); }
    if (a && a.type === 'move' && !state.calm && a.t / a.dur > 0.6) {          // a puff of leaves where a piece lands
      const f = (a.t / a.dur - 0.6) / 0.4, p = pointAt(a.to);
      ctx.strokeStyle = `rgba(255,236,190,${0.55 * (1 - f)})`; ctx.lineWidth = 4 * (1 - f) + 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, (24 + 40 * f) * UNIT * p.s, (18 + 30 * f) * UNIT * p.s, 0, 0, TAU); ctx.stroke();
    }
    if (state.kb && scene !== 'over') { const c = pointAt(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 40 * UNIT * c.s, 33 * UNIT * c.s, 0, 0, TAU); ctx.stroke(); }

    // ---- message and buttons --------------------------------------------------------------------------
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      const ms = big ? 30 : 25, lh = big ? 38 : 32;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.font = `600 ${ms}px ${UI}`;
      const words = state.msg.text.split(' '), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 590 && cur) { lines.push(cur); cur = w; } else cur = t2; }
      lines.push(cur);
      // the message is a banner over the header (the clock stays visible below it); in lessons and puzzles it sits low on the board
      const h = 30 + lines.length * lh, y0 = scene === 'play' ? 156 : 1330 - h;
      ctx.fillStyle = 'rgba(16,12,4,0.92)'; ctx.beginPath(); ctx.roundRect(40, y0, 640, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(241,205,120,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      lines.forEach((ln, i) => text(ln, 360, y0 + 38 + i * lh, ms, '#fff3d6', UI, 600));
      ctx.restore();
    }
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 26 }); button(BTN.undo, 'Take back', { size: 26 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 26 }); if (state.lesson.done) button({ x: 265, y: BTN.next.y, w: 395, h: BTN.next.h }, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 30 }); }
  }

  const heads = scene === 'title' || scene === 'demo-limit' || scene === 'look' || scene === 'campaign' || (scene === 'puzzle' && state.pz.status === 'making');
  if (heads) {
    ctx.fillStyle = scene === 'campaign' ? 'rgba(8,12,6,0.72)' : 'rgba(8,12,6,0.62)'; ctx.fillRect(0, scene === 'campaign' ? 0 : 760, W, scene === 'campaign' ? H : H - 760);
    if (scene !== 'look' && scene !== 'campaign') { text(NAME, 410, 150, 54); text('One hare. Three hounds. One narrow board.', 360, 205, 26, 'rgba(246,227,180,0.85)', FONT, 400); drawHare(ctx, 215, 500, 150, { set }); drawHound(ctx, 520, 490, 130, { set }); }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text("Preparing today's puzzle…", 360, 1000, 34, '#fff3d6', UI, 600); button(BTN.menu, 'Menu', { size: 26 }); }
  if (scene === 'campaign') {
    text('Campaign', 410, 150, 46); text('Twelve hunts. Win each with as few moves as you can.', 360, 205, 24, 'rgba(246,227,180,0.85)', FONT, 400);
    let total = 0; for (let i = 0; i < CAMPAIGN.length; i++) total += state.stats.camp[i] || 0;
    text(`★ ${total} of ${CAMPAIGN.length * 3}`, 360, 262, 26, '#ffd24a', UI, 700);
    CAMPAIGN.forEach((c, i) => {
      const r = TILE(i), open = i === 0 || (state.stats.camp[i - 1] || 0) > 0 || state.dev, stars = state.stats.camp[i] || 0;
      ctx.save(); if (!open) ctx.globalAlpha = 0.45;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 5, r.w, r.h, 18); ctx.fill();
      const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, stars ? '#7d6a38' : '#5a4c2c'); gr.addColorStop(1, '#2e2514'); ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
      ctx.strokeStyle = stars === 3 ? '#ffd24a' : 'rgba(255,232,170,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      text(String(i + 1), r.x + 34, r.y + 46, 40, '#f6e3b4', FONT);
      piece(c.side, { x: r.x + r.w - 52, y: r.y + 84, s: 1 }, { scale: 0.4 });
      wrap(open ? c.name : 'Locked', r.x + r.w / 2, r.y + 128, 22, r.w - 24, '#fff3d6', 26);
      for (let s = 0; s < 3; s++) text('★', r.x + r.w / 2 - 36 + s * 36, r.y + 186, 34, s < stars ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700);
      ctx.restore();
    });
    button(BTN.menu, 'Menu', { size: 26 });
    if (state.msg) wrap(state.msg.text, 360, 1300, 24, 620, '#ffe9b0');
  }
  if (scene === 'look') {
    text('Board and pieces', 410, 150, 46); text('Earned by winning. Never for sale.', 360, 205, 26, 'rgba(246,227,180,0.85)', FONT, 400);
    const group = (label, y) => text(label, 90, y, 24, 'rgba(246,227,180,0.9)', UI, 600, 'left');
    group('Board', 786); group('Pieces', 946); group('Message text', 1106);
    ['autumn', 'winter', 'night'].forEach((k, i) => { const ok = unlocked(state, 'board', k); button(LOOK.boards[i], ok ? BOARD_NAMES[k] : `${BOARD_NAMES[k]} (locked)`, { size: 22, primary: state.look.board === k, dim: !ok }); });
    ['wild', 'snow'].forEach((k, i) => { const ok = unlocked(state, 'set', k); button(LOOK.sets[i], ok ? SET_NAMES[k] : `${SET_NAMES[k]} (locked)`, { size: 26, primary: state.look.set === k, dim: !ok }); });
    button(LOOK.text[0], 'Normal', { size: 26, primary: !big }); button(LOOK.text[1], 'Large', { size: 30, primary: big });
    button(LOOK.back, 'Back', { size: 30 });
    if (state.msg) wrap(state.msg.text, 360, 1236, big ? 30 : 24, 620, '#ffe9b0');
    text(`Wins so far: ${state.stats.wins}`, 360, 1420, 22, 'rgba(246,227,180,0.7)', UI, 500);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    button(R.campaign, 'Campaign', { size: 30 });
    button(R.hare, 'Play the Hare', { size: 26 }); button(R.hound, 'Play the Hounds', { primary: state.learned && !R.resume, size: 26 });
    button(R.two, 'Two players, one phone', { size: 28 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 }); button(R.marks, state.marks ? "Hare's reach: on" : "Hare's reach: off", { size: 21 }); button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20 });
    button(R.look, 'Board and pieces', { size: 24 }); button(R.rules, 'Rules', { size: 24 });
    // badges: one star per level beaten with each side
    const by = R.look.y + 104;
    for (const [side, x0, label] of [['H', 96, 'Hare'], ['D', 396, 'Hounds']]) {
      text(label, x0, by, 22, 'rgba(246,227,180,0.85)', UI, 600, 'left');
      for (let l = 0; l < LEVELS.length; l++) text('★', x0 + 96 + l * 36, by + 2, 30, state.stats.badges[side + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
    }
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, by + 44, 22, 'rgba(246,227,180,0.7)', UI, 500);
    if (state.msg) wrap(state.msg.text, 360, 748, 24, 620, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    text('That was the free taste.', 360, 960, 44);
    text('Get Hare and Hounds on iPhone and Android', 360, 1030, 28, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1070, 28, '#fff3d6', UI, 600);
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(6,10,6,0.74)'; ctx.fillRect(0, 0, W, H);
    const won = state.two ? `${SIDE[g.winner]} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
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
    const hasNext = state.camp >= 0 && state.camp + 1 < CAMPAIGN.length;
    for (const b of overButtons(state.camp, !state.two && g.winner === state.human, hasNext)) button(b.rect, b.label, { primary: b.primary, size: b.primary ? 34 : 30 });
  } else if (scene === 'rules') {
    ctx.fillStyle = 'rgba(6,10,6,0.74)'; ctx.fillRect(0, 0, W, H);
    const page = RULES[state.rulesPage % RULES.length];
    text('Rules', 360, 130, 44);
    text(page.title, 360, 182, 28, '#ffd684', UI, 700);
    const top = page.piece ? 490 : 220, bottom = 545; // keep clear of the board art drawn below
    if (page.piece) (page.piece === 'H' ? drawHare : drawHound)(ctx, 360, 365, 70, { set });
    // Count wrapped lines at a given font size without drawing, so a long page can shrink slightly
    // to stay clear of the board art instead of running into it.
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
    for (const line of page.lines) { const n = wrap(line, 360, y, size, maxW, '#f6e3b4', lh); y += n * lh + 12; }
    text(`Page ${(state.rulesPage % RULES.length) + 1} of ${RULES.length}`, 360, 1420, 22, 'rgba(246,227,180,0.7)', UI, 500);
    button(RULES_NAV.back, 'Back', { size: 28 }); button(RULES_NAV.next, 'Next', { size: 28, primary: true });
  }
}
