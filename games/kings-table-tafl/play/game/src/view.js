// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js).
import { W, H, BTN, BX, BY, BS, cell, centerOf, titleRows } from './layout.js';
import { drawScene, drawPiece, braid, pieceRadius } from './art.js';
import { destinations, openCorners, isCorner, throne, side, SIZES, NAME, ATT, DEF, KING } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PAGES } from './pages.js';

const FONT = '"Cinzel", "Cormorant Garamond", Georgia, serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f0cf86', CREAM = '#fff1d2';
const letter = (v) => (v === ATT ? 'A' : v === KING ? 'K' : 'D');

export function render(ctx, state) {
  const g = state.game, a = state.anim, scene = state.scene, n = g.n, cs = cell(n), big = state.big, calm = state.calm;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');
  drawScene(ctx, boardScene ? n : 0, state.t, calm);

  const text = (str, x, y, size, color = GOLD, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color = GOLD, font = FONT, weight = 800) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; text(str, x, y, size, color, font, weight); ctx.restore(); };
  const wrapLines = (str, size, maxW, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const lines = []; let cur = '';
    for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); return lines;
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => { const ls = wrapLines(str, size, maxW); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return ls.length; };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 16); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f2d189'); gr.addColorStop(0.5, '#cf9d45'); gr.addColorStop(1, '#8f6320'); } else { gr.addColorStop(0, '#5d3d22'); gr.addColorStop(0.55, '#3b2412'); gr.addColorStop(1, '#251409'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(224,180,100,0.75)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 12); ctx.stroke();
    ctx.fillStyle = o.primary ? '#3a2208' : GOLD; ctx.textAlign = 'center';
    const sz = o.size ?? 28; ctx.font = `700 ${sz}px ${o.ui ? UI : FONT}`;
    ctx.shadowColor = o.primary ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.34);
    ctx.restore();
  };
  const panel = (x, y, w, h) => { ctx.fillStyle = 'rgba(14,7,3,0.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.fill(); ctx.strokeStyle = 'rgba(224,180,100,0.7)'; ctx.lineWidth = 2; ctx.stroke(); };
  const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);

  // ---- the board and what stands on it --------------------------------------------------------------------
  const ctr = (i) => centerOf(n, i);
  const glowSq = (i, rgb, al) => { const c = ctr(i); ctx.fillStyle = `rgba(${rgb},${al})`; ctx.fillRect(c.x - cs / 2 + 2, c.y - cs / 2 + 2, cs - 4, cs - 4); };
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), from = ctr(a.from), to = ctr(a.to);
    if (a.type === 'refuse') {
      const reach = a.to === a.from ? 0 : g.b[a.to] ? 0.5 : 0.9;
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 4 : 0;
      return { x: from.x + (to.x - from.x) * e + shake, y: from.y + (to.y - from.y) * e, lift: 0.5 * Math.sin(Math.PI * Math.min(1, f * 1.1)) };
    }
    const e = f * f * (3 - 2 * f);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, lift: Math.sin(Math.PI * f) * 0.6 };
  };
  const drawBoard = () => {
    // last move
    if (g.last && scene !== 'lesson' && scene !== 'puzzle') { glowSq(g.last.from, '255,200,110', 0.16); glowSq(g.last.to, '255,200,110', 0.22); }
    // lesson targets
    if (scene === 'lesson' && !state.lesson.done) for (const [x, y] of LESSONS[state.lesson.i].at ?? []) {
      const c = ctr(x + n * y); ctx.strokeStyle = `rgba(255,220,120,${0.55 + pulse * 0.4})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, cs * (0.34 + pulse * 0.05), 0, TAU); ctx.stroke();
    }
    // open lines from the king to corners
    if (state.marks && g.king >= 0 && scene !== 'over') {
      const k = g.king;
      for (const d of [1, -1, n, -n]) {
        let i = k, path = [];
        for (;;) {
          const x = i % n, y = (i / n) | 0;
          if ((d === 1 && x === n - 1) || (d === -1 && x === 0) || (d === n && y === n - 1) || (d === -n && y === 0)) break;
          i += d; if (g.b[i] !== 0) { path = []; break; } path.push(i);
        }
        if (path.length && isCorner(n, path[path.length - 1])) for (const s of path) glowSq(s, '255,150,50', 0.16 + pulse * 0.16);
      }
    }
    // selection, legal squares, hint
    if (state.sel >= 0 && !a) {
      glowSq(state.sel, '255,236,150', 0.25 + pulse * 0.15);
      for (const to of destinations(g, state.sel)) { const c = ctr(to); ctx.fillStyle = `rgba(255,232,150,${0.5 + pulse * 0.3})`; ctx.beginPath(); ctx.arc(c.x, c.y, cs * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,35,10,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    if (state.hint && !a) { glowSq(state.hint.from, '120,255,170', 0.28 + pulse * 0.2); glowSq(state.hint.to, '120,255,170', 0.28 + pulse * 0.2); }
    // pieces, far rows first
    const dragFrom = state.drag && state.drag.moved ? state.drag.from : -1;
    for (let i = 0; i < n * n; i++) {
      const v = g.b[i]; if (!v) continue;
      if (a && ((a.type !== 'refuse' && i === a.to) || (a.type === 'refuse' && i === a.from))) continue;
      if (i === dragFrom) continue;
      const c = ctr(i), sel = state.sel === i;
      drawPiece(ctx, n, letter(v), c.x, c.y, { lift: sel ? 0.6 + (calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0 });
    }
    // captured pieces fade away where they stood
    if (a && a.type === 'move' && a.caps.length) for (const cp of a.caps) { const c = ctr(cp.at), f = Math.min(1, a.t / a.dur); drawPiece(ctx, n, letter(cp.v), c.x, c.y, { alpha: Math.max(0, 1 - f * 1.5), scale: 1 - f * 0.25 }); }
    if (a) { const p = animPos(); drawPiece(ctx, n, letter(a.v), p.x, p.y, { lift: p.lift }); }
    if (dragFrom >= 0) drawPiece(ctx, n, letter(g.b[dragFrom]), state.drag.x, state.drag.y - 10, { lift: 1 });
    if (a && a.type === 'move' && a.caps.length && !calm && a.t / a.dur > 0.4) for (const cp of a.caps) {
      const f = (a.t / a.dur - 0.4) / 0.6, c = ctr(cp.at);
      ctx.strokeStyle = `rgba(255,230,180,${0.8 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.arc(c.x, c.y, cs * (0.3 + 0.5 * f), 0, TAU); ctx.stroke();
    }
    if (state.kb && scene !== 'over') { const c = ctr(Math.min(state.cursor, n * n - 1)); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(c.x - cs / 2 + 3, c.y - cs / 2 + 3, cs - 6, cs - 6); }
  };
  const tray = (kind, y, label, count, taken) => {
    text(`${label}: ${count}`, 64, y, 24, CREAM, UI, 700, 'left');
    if (taken) text(`taken ${taken}`, 300, y, 20, 'rgba(240,207,134,0.7)', UI, 500, 'left');
    const sz = SIZES[n]; const tot = kind === 'A' ? sz.att : sz.def + 1;
    for (let k = 0; k < count && k < tot; k++) drawPiece(ctx, 7, kind === 'A' ? 'A' : 'D', 420 + (k % 12) * 24 - (kind === 'D' ? 0 : 0), y - 8 + Math.floor(k / 12) * 20, { scale: 0.4 });
  };
  const banner = () => {
    if (!state.msg || scene === 'over') return;
    const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5), ms = big ? 31 : 25, lh = big ? 39 : 32;
    ctx.save(); ctx.globalAlpha = Math.max(0, al);
    const lines = wrapLines(state.msg.text, ms, 590), h = 34 + lines.length * lh, y0 = 1176;
    ctx.fillStyle = 'rgba(16,8,3,0.92)'; ctx.beginPath(); ctx.roundRect(40, y0, 640, h, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(240,207,134,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    lines.forEach((ln, i) => text(ln, 360, y0 + 40 + i * lh, ms, CREAM, UI, 600));
    ctx.restore();
  };

  if (boardScene) {
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 360, 172, 24, 'rgba(240,207,134,0.8)', UI, 600);
      shadowText(l.title, 360, 232, 46);
      wrap(state.lesson.done ? l.done : l.text, 360, 296, big ? 32 : 27, 620, state.lesson.done ? '#c9f7c0' : CREAM, big ? 40 : 35);
    } else if (scene === 'puzzle') {
      text('Daily puzzle', 360, 172, 24, 'rgba(240,207,134,0.8)', UI, 600);
      shadowText('Defenders: win in two', 360, 232, 40);
      wrap(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : 'Find the one move that lets the king reach a corner two moves from now, however the attackers answer.', 360, 296, big ? 30 : 26, 620, CREAM, big ? 38 : 34);
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 440, 24, GOLD, UI, 600);
    } else {
      const sz = SIZES[n];
      shadowText('Tafl', 360, 175, 46);
      text(`${sz.name} ${n}x${n}`, 360, 205, 22, 'rgba(240,207,134,0.8)', UI, 600);
      const who = g.winner ? '' : state.two ? `${NAME[g.turn][0].toUpperCase() + NAME[g.turn].slice(1)} to move` : g.turn === state.human ? `Your move (${NAME[g.turn]})` : `The computer thinks${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
      drawPiece(ctx, 7, g.turn === ATT ? 'A' : 'K', 100, 275, { scale: 1.1 });
      text(who, 150, 288, 34, CREAM, UI, 700, 'left');
      text(state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`, 150, 322, 22, 'rgba(240,207,134,0.8)', UI, 500, 'left');
      const attN = g.b.filter((v) => v === ATT).length, defN = g.b.filter((v) => v === DEF || v === KING).length;
      tray('A', 378, 'Attackers', attN, sz.att - attN);
      tray('D', 424, 'Defenders', defN, sz.def + 1 - defN);
    }
    drawBoard();
    banner();
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 24 }); button(BTN.undo, 'Take back', { size: 22 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 22, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 24 }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 26 }); else button(BTN.skip, 'Restart', { size: 22 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 24 }); if (state.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 28 }); }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { shadowText('Daily puzzle', 360, 400, 50); text("Setting up today's puzzle…", 360, 700, 32, CREAM, UI, 600); button(BTN.menu, 'Menu', { size: 24 }); }

  // ---- title and other menus ------------------------------------------------------------------------------
  if (scene === 'title' || scene === 'demo-limit') {
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(0, 130, W, 560); ctx.fillStyle = 'rgba(8,4,2,0.55)'; ctx.fillRect(0, 690, W, H - 690);
    const bob = calm ? 0 : Math.sin(state.t * 1.4) * 4;
    // hero: the king between his guard and the attackers, in the hearth light
    const gl = ctx.createRadialGradient(360, 470, 20, 360, 470, 300); gl.addColorStop(0, `rgba(255,170,70,${0.32 + (calm ? 0 : 0.05 * Math.sin(state.t * 5))})`); gl.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 170, W, 560);
    drawPiece(ctx, 7, 'A', 130, 500 + bob * 0.5, { scale: 1.5 }); drawPiece(ctx, 7, 'A', 590, 500 - bob * 0.5, { scale: 1.5 });
    drawPiece(ctx, 7, 'D', 235, 510 - bob, { scale: 1.6 }); drawPiece(ctx, 7, 'D', 485, 510 + bob, { scale: 1.6 });
    drawPiece(ctx, 7, 'K', 360, 490 + bob, { scale: 2.5, lift: 0.3 });
    shadowText('TAFL', 360, 275, 112, GOLD, FONT, 800);
    text('The king\'s table of the North', 360, 330, 28, CREAM, FONT, 600);
    ctx.save(); ctx.beginPath(); ctx.rect(70, 150, 580, 30); ctx.clip(); braid(ctx, 70, 165, 580, 7, 7, ['#120903', '#a07a3c', '#e8c77e'], 34); ctx.restore();
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 26 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 26 });
    button(R.big, 'Play Copenhagen 11x11', { primary: state.learned && !R.resume, size: 26 });
    button(R.small, 'Play Brandubh 7x7 (starter)', { size: 24 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 24 });
    button(R.two, 'Two players, one phone', { size: 24 });
    button(R.side, `You play: ${state.human === DEF ? 'Defenders' : 'Attackers'}`, { size: 19, ui: true });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 19, ui: true });
    button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 19, ui: true });
    button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 18, ui: true });
    button(R.text, state.big ? 'Text: large' : 'Text: normal', { size: 19, ui: true });
    button(R.about, 'About Tafl', { size: 19, ui: true });
    button(R.help, 'Controls and rules', { size: 21, ui: true });
    const by = R.help.y + 100;
    for (const [sd, x0, label] of [[DEF, 90, 'Defenders'], [ATT, 390, 'Attackers']]) {
      text(label, x0, by, 20, 'rgba(240,207,134,0.85)', UI, 600, 'left');
      for (let l = 0; l < LEVELS.length; l++) text('★', x0 + 112 + l * 30, by + 2, 26, state.stats.badges[`${sd}_11_${l}`] || state.stats.badges[`${sd}_7_${l}`] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
    }
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, by + 40, 20, 'rgba(240,207,134,0.65)', UI, 500);
    if (state.msg) { ctx.save(); ctx.globalAlpha = Math.min(1, (state.msg.hold - state.msg.t) / 0.5); wrap(state.msg.text, 360, 388, 22, 600, '#ffe9b0'); ctx.restore(); }
  } else if (scene === 'demo-limit') {
    shadowText('That was the free taste.', 360, 800, 40);
    text('Get Tafl on iPhone and Android', 360, 870, 28, CREAM, UI, 600); text('for unlimited games.', 360, 910, 28, CREAM, UI, 600);
    button(BTN.back, 'Menu', { size: 26 });
  } else if (scene === 'about' || scene === 'help') {
    const pages = PAGES[scene], pg = pages[Math.min(state.page, pages.length - 1)];
    panel(36, 140, 648, 1270);
    shadowText(pg.title, 360, 230, 40);
    ctx.save(); ctx.beginPath(); ctx.rect(70, 262, 580, 30); ctx.clip(); braid(ctx, 70, 277, 580, 7, 7, ['#120903', '#a07a3c', '#e8c77e'], 34); ctx.restore();
    let y = 350; const sz = big ? 29 : 25, lh = big ? 38 : 33;
    for (const para of pg.body) { const nl = wrap(para, 76, y, sz, 568, CREAM, lh, 'left'); y += nl * lh + 22; }
    text(`${state.page + 1} of ${pages.length}`, 360, 1440, 20, 'rgba(240,207,134,0.7)', UI, 500);
    button(BTN.menu, 'Menu', { size: 24 }); if (state.page > 0) button(BTN.undo, 'Back', { size: 24 });
    button(BTN.next, state.page + 1 < pages.length ? 'Next page' : 'Done', { primary: true, size: 26 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(8,4,2,0.74)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : state.two ? `${NAME[g.winner][0].toUpperCase() + NAME[g.winner].slice(1)} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
    const gl = ctx.createRadialGradient(360, 560, 20, 360, 560, 300); gl.addColorStop(0, 'rgba(255,170,70,0.35)'); gl.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 260, W, 600);
    if (g.winner !== 'draw') drawPiece(ctx, 7, g.winner === DEF ? 'K' : 'A', 360, 590, { scale: 3.2 });
    shadowText(won, 360, 800, 60); text(g.reason, 360, 852, 24, CREAM, UI, 500);
    text(`${g.ply} moves`, 360, 894, 22, 'rgba(240,207,134,0.75)', UI, 500);
    if (!state.two && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten as the ${NAME[state.human]}`, 360, 926, 22, '#ffd24a', UI, 600);
      if (!calm) for (let k = 0; k < 14; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 700 - ph * 400; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 3 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 30 }); button(BTN.back, 'Menu', { size: 26 });
  }
  void BX; void BY; void BS; void throne; void side; void openCorners; void pieceRadius;
}
