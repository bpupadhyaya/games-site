// Everything drawn each frame. Reads `state` (see game.js) and changes nothing. Static art is cached (art.js).
import { W, H, GRID, SLAB, cellCenter, cellSize, stoneRadius, BTN, SETUP, HELP, TEXTSTEP, TEXT_SCALES, titleRows } from './layout.js';
import { drawWorld, drawSlab, drawStone, drawPetals, drawSquareRing, stoneVariant } from './art.js';
import { jumpsFrom, legalMoves, stones, countMoves, NAMES, overSquares } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HELP_PAGES, RULES } from './content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const SIDE = { 1: 'Black', 2: 'White' };
const PAGE_TEXT = '#fff3d6', GOLD = '#ffd98a';

export function makeText(ctx) {
  const text = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const lines = (str, size, maxW, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const out = []; let cur = '';
    for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = PAGE_TEXT, lh = size * 1.32, align = 'center', weight = 600) => { const ls = lines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const shadowText = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { text(str, x + 2, y + 3, size, 'rgba(0,0,0,0.55)', font, weight, align); text(str, x, y, size, color, font, weight, align); };
  return { text, lines, wrap, shadowText };
}

// A crafted button: a slab of dark basalt with a lit top edge and a cream tapa line, or a sunrise-gold primary.
export function button(ctx, tx, r, label, o = {}) {
  ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, 20); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (o.primary) { g.addColorStop(0, '#ffd486'); g.addColorStop(0.55, '#f2905a'); g.addColorStop(1, '#d4553a'); } else if (o.on) { g.addColorStop(0, '#7a5a4c'); g.addColorStop(1, '#3d2a26'); } else { g.addColorStop(0, '#5a4c4e'); g.addColorStop(1, '#2a2022'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = o.primary ? 'rgba(255,240,200,0.9)' : o.on ? 'rgba(255,217,138,0.95)' : 'rgba(255,214,170,0.45)'; ctx.lineWidth = o.on ? 3 : 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 15); ctx.stroke();
  tx.text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.35, o.size ?? 30, o.primary ? '#2a1208' : PAGE_TEXT, UI, 700);
  ctx.restore();
}
function panel(ctx, x, y, w, h, a = 0.7) {
  ctx.fillStyle = `rgba(16,9,14,${a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,170,0.45)'; ctx.lineWidth = 2; ctx.stroke();
}
// The reader card behind a text-heavy reference page (How to play, About, Rules): the same dark
// basalt panel plus a fainter inset line, so a page of body text reads as a designed reference
// sheet rather than loose text floating on the backdrop.
function readerCard(ctx, x, y, w, h) {
  panel(ctx, x, y, w, h, 0.76);
  ctx.strokeStyle = 'rgba(255,214,170,0.16)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 18); ctx.stroke();
}

// Where the moving stone is: a hop is an arc from square to square; the stone pauses a beat at each landing.
export function animPos(n, a, calm) {
  const per = a.dur / (a.path.length - 1), k = Math.min(a.path.length - 2, Math.floor(a.t / per)), f = Math.min(1, (a.t - k * per) / per), e = f * f * (3 - 2 * f);
  const p = cellCenter(n, a.path[k]), q = cellCenter(n, a.path[k + 1]);
  return { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e, lift: Math.sin(Math.PI * f) * (calm ? 0.5 : 1.3), hop: k + f };
}

// The stones of game `g` (and the animation `a`) on the slab in slab coordinates. Used by the play screen and the title demo.
export function drawStones(ctx, g, a, o = {}) {
  const n = g.n, R = stoneRadius(n);
  for (let i = 0; i < g.b.length; i++) {
    const k = g.b[i]; if (!k) continue;
    if (a && a.type === 'jump' && i === a.path[a.path.length - 1]) continue;            // the moving stone is drawn on its path
    const p = cellCenter(n, i);
    drawStone(ctx, k, p.x, p.y, R, { v: stoneVariant(i), lift: o.sel === i ? 0.75 + (o.calm ? 0 : Math.sin(o.t * 4) * 0.08) : 0, glow: o.sel === i ? '255,226,140' : null, alpha: a && a.type === 'refuse' && a.from === i ? 0 : 1 });
  }
  if (!a) return;
  if (a.type === 'jump') {
    const pos = animPos(n, a, o.calm);
    a.caps.forEach((c, j) => {                                                       // a captured stone waits until the mover passes, then is tossed away
      const p = cellCenter(n, c.at), f = Math.max(0, pos.hop - (j + 0.5)) / 0.55;
      if (f >= 1) return;
      drawStone(ctx, c.kind, p.x + f * (c.side * 14), p.y - f * 40 * (o.calm ? 0.3 : 1), R * (1 - f * 0.25), { v: stoneVariant(c.at), alpha: 1 - f, lift: f * 0.8 });
    });
    if (!o.calm && pos.hop > 0.5) for (let j = 0; j < a.caps.length; j++) {              // a ring of dust at each hop's landing
      const f = pos.hop - (j + 1); if (f < 0 || f > 0.6) continue; const p = cellCenter(n, a.path[j + 1]);
      ctx.strokeStyle = `rgba(255,236,200,${0.6 * (1 - f / 0.6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y + R * 0.3, R * (0.8 + f * 1.2), R * (0.5 + f * 0.7), 0, 0, TAU); ctx.stroke();
    }
    drawStone(ctx, a.kind, pos.x, pos.y, R, { v: stoneVariant(a.path[0]), lift: pos.lift });
  } else if (a.type === 'remove') {
    const f = Math.min(1, a.t / a.dur), p = cellCenter(n, a.at);
    drawStone(ctx, a.kind, p.x, p.y - f * 50 * (o.calm ? 0.3 : 1), R * (1 - 0.2 * f), { v: stoneVariant(a.at), alpha: 1 - f, lift: f });
  } else if (a.type === 'refuse') {
    const f = Math.min(1, a.t / a.dur), p = cellCenter(n, a.from), q = cellCenter(n, a.to);
    const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * 0.55;
    const shake = o.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 4 : 0;
    drawStone(ctx, a.kind, p.x + (q.x - p.x) * e + shake, p.y + (q.y - p.y) * e, R, { v: stoneVariant(a.from), lift: 0.5 });
  }
}

export function render(ctx, state) {
  const { text, wrap, shadowText, lines } = makeText(ctx), btn = (r, l, o) => button(ctx, { text }, r, l, o);
  const scene = state.scene, g = state.game, big = state.textScaleIdx > 0, calm = state.calm, t = state.t;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');
  drawWorld(ctx, t, boardScene ? g.n : 0, calm);

  if (boardScene) {
    const n = g.n, a = state.anim, R = stoneRadius(n), pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 6);
    // ---- header ----
    ctx.fillStyle = 'rgba(14,8,16,0.58)'; ctx.beginPath(); ctx.roundRect(24, 192, 672, 214, 22); ctx.fill();
    shadowText('Konane', 420, 128, 62);
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 420, 176, 26, 'rgba(255,224,178,0.85)', UI, 600);
      shadowText(l.title, 360, 250, 44, '#ffe6b0');
      wrap(state.lesson.done ? l.done : l.text, 360, 296, big ? 30 : 26, 640, state.lesson.done ? '#c9f7c0' : '#ffffff', big ? 38 : 33);
    } else if (scene === 'puzzle') {
      const P = state.pz;
      text('Daily puzzle', 420, 176, 26, 'rgba(255,224,178,0.85)', UI, 600);
      drawStone(ctx, g.turn, 96, 262, 30, { v: 1 });
      shadowText(`${SIDE[g.turn]} to move`, 146, 272, 42, '#ffe6b0', FONT, 700, 'left');
      wrap(P.status === 'solved' ? `Solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow.` : `Only ONE first jump wins by force. Find it.`, 64, 316, big ? 30 : 26, 600, PAGE_TEXT, 36, 'left');
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}   ·   ${g.n}x${g.n} board`, 64, 396, 24, GOLD, UI, 600, 'left');
    } else {
      const mine = state.two || g.turn === state.human;
      drawStone(ctx, g.winner ? g.winner : g.turn, 96, 236, 30, { v: 1 });
      const tt = g.winner ? '' : state.two ? `${SIDE[g.turn]} to move` : mine ? `Your move (${SIDE[g.turn]})` : `Computer thinking${'.'.repeat(1 + (Math.floor(t * 3) % 3))}`;
      shadowText(tt, 146, 248, 44, '#ffe6b0', FONT, 700, 'left');
      text(state.two ? `Two players · ${n}x${n}` : `Computer: ${LEVELS[state.level].name} · ${n}x${n}`, 146, 288, 23, 'rgba(255,224,178,0.85)', UI, 500, 'left');
      const hint = g.ply === 0 ? 'Black opens: tap a glowing black stone to remove it.' : g.ply === 1 ? 'White opens: tap a glowing white stone to remove it.' : '';
      if (hint && !g.winner) wrap(hint, 64, 346, 24, 600, PAGE_TEXT, 30, 'left');
      else if (!g.winner) text(`Black ${stones(g, 1)}  ·  White ${stones(g, 2)} stones   ·   jumps: ${countMoves(g, 1)} v ${countMoves(g, 2)}`, 64, 372, 22, 'rgba(255,224,178,0.85)', UI, 600, 'left');
    }
    // ---- board ----
    if (g.ply < 2 && !a && !g.winner && (scene === 'play' || scene === 'lesson') && state.canAct) for (const m of legalMoves(g)) { const p = cellCenter(n, m.at); drawSquareRing(ctx, p.x, p.y, R * 1.05, '255,216,120', 0.6 + pulse * 0.4, 0.3); }
    if (state.sel >= 0 && !a) {
      for (const m of jumpsFrom(g, state.sel)) {
        const p = cellCenter(n, m.to), hops = overSquares(n, m.from, m.to).length;
        drawSquareRing(ctx, p.x, p.y, R * 0.96, hops > 1 ? '255,150,110' : '255,216,120', 0.55 + pulse * 0.4, 0.28);
        if (hops > 1) text(`x${hops}`, p.x, p.y + 9, Math.round(R * 0.72), '#fff', UI, 800);
      }
    } else if (state.marks && !a && state.canAct && !g.winner && g.ply >= 2 && state.sel < 0) {
      for (let i = 0; i < g.b.length; i++) if (g.b[i] === g.turn && jumpsFrom(g, i).length) { const p = cellCenter(n, i); ctx.strokeStyle = `rgba(255,222,140,${0.35 + pulse * 0.4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R * 1.08, 0, TAU); ctx.stroke(); }
    }
    if (state.hint && !a) for (const sq of [state.hint.from, state.hint.to]) if (sq >= 0) { const p = cellCenter(n, sq); drawSquareRing(ctx, p.x, p.y, R * 1.05, '120,255,170', 0.6 + pulse * 0.4, 0.3); }
    if (scene === 'lesson' && !state.lesson.done && !a) for (const sq of LESSONS[state.lesson.i].mark || []) { const p = cellCenter(n, sq); drawSquareRing(ctx, p.x, p.y, R * 1.15, '140,210,255', 0.5 + pulse * 0.4, 0.15); }
    drawStones(ctx, g, a, { sel: state.sel, calm, t });
    if (state.kb && scene !== 'over') { const c = cellCenter(n, state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(c.x - cellSize(n) / 2 + 3, c.y - cellSize(n) / 2 + 3, cellSize(n) - 6, cellSize(n) - 6, 10); ctx.stroke(); }
    if (scene === 'play' || scene === 'over') {           // the trays: stones taken from the slab are collected here
      const per = (n * n) / 2;
      [[2, 'White stones taken', 40], [1, 'Black stones taken', 370]].forEach(([k, label, x0]) => {
        const got = per - g.b.filter((v2) => v2 === k).length;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(x0 + 3, 1136, 310, 150, 26); ctx.fill();
        ctx.fillStyle = ctx.createLinearGradient(0, 1130, 0, 1280); ctx.fillStyle.addColorStop(0, '#2a2223'); ctx.fillStyle.addColorStop(1, '#4a3f3e');
        ctx.beginPath(); ctx.roundRect(x0, 1130, 310, 150, 26); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,170,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(x0 + 10, 1160, 290, 110, 18); ctx.fill();
        text(`${label}: ${got}`, x0 + 155, 1150, 19, 'rgba(255,224,178,0.9)', UI, 600);
        for (let q = 0; q < got; q++) drawStone(ctx, k, x0 + 32 + (q % 11) * 24.5, 1190 + Math.floor(q / 11) * 30 + (q % 2) * 3, 13, { v: q, shadow: false });
      });
    }
    // ---- message + buttons ----
    if (state.msg && scene !== 'over') {
      const my = scene === 'play' ? 1310 : 1130, al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5), ms = big ? 30 : 25, lh = big ? 38 : 32, ls = lines(state.msg.text, ms, 590), h = 30 + ls.length * lh;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(ctx, 40, my, 640, h, 0.88); ls.forEach((ln, i) => text(ln, 360, my + 38 + i * lh, ms, PAGE_TEXT, UI, 600)); ctx.restore();
    }
    if (scene === 'play') { btn(BTN.menu, 'Menu', { size: 26 }); btn(BTN.undo, 'Take back', { size: 26 }); btn(BTN.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { btn(BTN.menu, 'Menu', { size: 26 }); if (state.lesson.done) btn({ x: 265, y: BTN.next.y, w: 395, h: BTN.next.h }, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { btn(BTN.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') btn(BTN.share, 'Share result', { primary: true, size: 30 }); }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { shadowText("Preparing today's puzzle", 360, 800, 42); btn(BTN.menu, 'Menu', { size: 26 }); }

  if (scene === 'title' || scene === 'demo-limit') {
    // a small slab with a live demonstration game on it
    ctx.save(); ctx.translate(360, 484); ctx.scale(0.57, 0.57); ctx.translate(-360, -760);
    drawSlab(ctx, 6); if (state.demo) drawStones(ctx, state.demo.g, state.demo.anim, { calm, t }); ctx.restore();
    shadowText('Konane', 420, 150, 96); text('The jumping game of Hawaii', 400, 208, 30, 'rgba(255,232,196,0.95)', FONT, 600);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) btn(R.resume, 'Continue your game', { primary: true, size: 30 });
    btn(R.play, 'Play', { primary: state.learned && !R.resume, size: 32 });
    btn(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    btn(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 28 });
    btn(R.how, 'How to play and controls', { size: 27 }); btn(R.about, 'About Konane', { size: 28 }); btn(R.rules, 'Rules', { size: 28 });
    btn(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22, on: state.sound }); btn(R.calm, calm ? 'Calm: on' : 'Calm: off', { size: 22, on: calm }); btn(R.big, big ? 'Large text: on' : 'Large text', { size: 21, on: big });
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, R.sound.y + 112, 22, 'rgba(255,232,196,0.8)', UI, 500);
    if (state.msg) wrap(state.msg.text, 360, R.sound.y + 160, 24, 620, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    panel(ctx, 50, 800, 620, 300); text('That was the free taste.', 360, 890, 44); wrap('Get Konane on iPhone and Android for unlimited games, all board sizes and every level.', 360, 950, 28, 540, PAGE_TEXT, 38);
  } else if (scene === 'setup') {
    const C = state.cfg;
    shadowText('New game', 420, 150, 66); text('Choose your board, your side and the computer.', 360, 205, 26, 'rgba(255,232,196,0.9)', FONT, 600);
    panel(ctx, 50, 620, 620, 880, 0.62);
    const grp = (label, y) => text(label, 90, y, 26, GOLD, UI, 700, 'left');
    grp('Board (slab) size', 664);
    [6, 8, 10].forEach((v, i) => btn(SETUP.sizes[i], `${v} x ${v}`, { size: 30, on: C.n === v }));
    text(C.n === 6 ? 'Quick game, a few minutes. The standard small board.' : C.n === 8 ? 'A fuller game with more room to plan.' : 'The long game: lots of room for double and triple jumps.', 360, 812, 22, 'rgba(255,232,196,0.9)', UI, 500);
    grp('You play', 854);
    btn(SETUP.sides[0], 'Black', { size: 28, on: C.side === 1 }); btn(SETUP.sides[1], 'White', { size: 28, on: C.side === 2 }); btn(SETUP.sides[2], 'Two players', { size: 24, on: C.side === 0 });
    text(C.side === 1 ? 'Black opens and jumps first.' : C.side === 2 ? 'White answers the opening and jumps second.' : 'Pass the phone: Black and White take turns.', 360, 1000, 22, 'rgba(255,232,196,0.9)', UI, 500);
    grp('Computer level', 1042);
    LEVELS.forEach((L, i) => { btn(SETUP.levels[i], `${L.name}${state.stats.badges[`${C.n}-${i}`] ? '  ★' : ''}`, { size: 28, on: C.level === i, dim: C.side === 0 }); });
    if (C.side !== 0) wrap(LEVELS[C.level].blurb, 360, 1270, 22, 560, 'rgba(255,232,196,0.9)', 28);
    btn(SETUP.start, 'Start game', { primary: true, size: 36 }); btn(SETUP.back, 'Back', { size: 26 });
  } else if (scene === 'help' || scene === 'about' || scene === 'rules') {
    const pages = scene === 'help' ? HELP_PAGES : scene === 'about' ? ABOUT : RULES, P = pages[state.page % pages.length];
    // Text-size stepper (A-/A+), an index into TEXT_SCALES, guarded so a stale/out-of-range saved
    // index can never produce NaN font sizes. Lives right here, in the header of the page being read.
    const scaleIdx = Math.min(Math.max(state.textScaleIdx, 0), TEXT_SCALES.length - 1), scale = TEXT_SCALES[scaleIdx] ?? 1;
    shadowText(scene === 'help' ? 'How to play' : scene === 'about' ? 'About Konane' : 'Rules', 420, 160, Math.round(58 * Math.min(scale, 1.15)));
    btn(TEXTSTEP.dec, 'A−', { size: 28, dim: scaleIdx === 0 });
    btn(TEXTSTEP.inc, 'A+', { size: 28, dim: scaleIdx === TEXT_SCALES.length - 1 });
    const PANEL_Y = 200, PANEL_BOTTOM = 1400, fs = Math.round(28 * scale), lhh = Math.round(fs * 1.4);
    let hh = 150 + (P.demo ? 160 : 0) + (P.stones ? 190 : 0); for (const para of P.body) hh += lines(para, fs, 570).length * lhh + 18;
    const panelH = Math.min(hh + 20, PANEL_BOTTOM - PANEL_Y);
    readerCard(ctx, 40, PANEL_Y, 640, panelH);
    text(P.title, 360, PANEL_Y + 82, Math.round(44 * scale), '#ffe6b0');
    let y = PANEL_Y + 142;
    if (P.demo) { y = drawHelpDemo(ctx, P.demo, y + 6, t, calm) + 20; }
    if (P.stones) { y = drawRulesStones(ctx, text, y + 6) + 20; }
    for (const para of P.body) { const k = wrap(para, 76, y, fs, 570, PAGE_TEXT, lhh, 'left'); y += k * lhh + 18; }
    // The small slab still-life sits at a fixed spot below the panel, and is only drawn when the
    // panel is short enough to leave it clear room — never crammed against a long page's last line.
    if (y + 90 < PANEL_Y + panelH && PANEL_Y + panelH < 1010) { ctx.save(); ctx.translate(360, 1200); ctx.scale(0.5, 0.5); ctx.translate(-360, -760); drawSlab(ctx, 6); if (state.demo) drawStones(ctx, state.demo.g, state.demo.anim, { calm, t }); ctx.restore(); }
    text(`Page ${state.page % pages.length + 1} of ${pages.length}`, 360, 1430, 22, 'rgba(255,232,196,0.7)', UI, 500);
    btn(HELP.prev, 'Back page', { size: 24 }); btn(HELP.back, 'Menu', { size: 26 }); btn(HELP.next, 'Next page', { size: 24, primary: true });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(8,4,10,0.72)'; ctx.fillRect(0, 0, W, H);
    const won = state.two ? `${SIDE[g.winner]} wins` : g.winner === state.human ? 'You win!' : 'The computer wins';
    drawStone(ctx, g.winner, 360, 640, 100, { v: 1 });
    shadowText(won, 360, 830, 72); text(g.reason, 360, 886, 28, PAGE_TEXT, UI, 500);
    text(`${g.moves} moves · Black ${stones(g, 1)} stones · White ${stones(g, 2)} stones`, 360, 932, 24, 'rgba(255,232,196,0.8)', UI, 500);
    if (!state.two && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten on the ${g.n}x${g.n} slab`, 360, 970, 24, GOLD, UI, 600);
      if (!calm) for (let k = 0; k < 14; k++) { const ph = (t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 700 - ph * 400; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    btn(BTN.again, 'Play again', { primary: true, size: 34 }); btn(BTN.back, 'Menu', { size: 30 });
  }
  if (!calm) drawPetals(ctx, t);
  void SLAB; void GRID; void NAMES;
}

// A small illustrated jump used on the help pages: stones in a row, animated on a loop. Returns the y below it.
function drawHelpDemo(ctx, demo, y, t, calm) {
  const cell = 96, x0 = 360 - (demo.cells.length * cell) / 2, R = 36;
  ctx.fillStyle = 'rgba(40,30,32,0.9)'; ctx.beginPath(); ctx.roundRect(x0 - 16, y, demo.cells.length * cell + 32, cell + 20, 18); ctx.fill();
  const ph = calm ? 0.5 : (t % 4) / 4;   // 0..1 loop: rest, hop, rest
  const f = Math.max(0, Math.min(1, (ph - 0.25) / 0.4)), e = f * f * (3 - 2 * f);
  demo.cells.forEach((c, i) => {
    const cx = x0 + i * cell + cell / 2, cy = y + 10 + cell / 2;
    ctx.fillStyle = '#1b1616'; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.fill();
    const k = c === 'B' ? 1 : c === 'W' ? 2 : 0;
    if (!k) return;
    if (demo.hop && i === demo.hop[0]) return;
    const gone = demo.hop && demo.hop[1].includes(i);
    drawStone(ctx, k, cx, cy, R, { v: i, alpha: gone ? 1 - e : 1 });
  });
  if (demo.hop) { const [from, , to] = demo.hop, ax = x0 + from * cell + cell / 2, bx = x0 + to * cell + cell / 2; drawStone(ctx, 1, ax + (bx - ax) * e, y + 10 + cell / 2, R, { v: 0, lift: Math.sin(Math.PI * e) * 1.2 }); }
  return y + cell + 20;
}

// The Rules page for "The stone": the real Black and White stone sprites, drawn via the game's own drawStone, side by side.
function drawRulesStones(ctx, text, y) {
  const R = 46, gap = 170, top = y, cy = y + 10 + R + 4;
  ctx.fillStyle = 'rgba(40,30,32,0.9)'; ctx.beginPath(); ctx.roundRect(360 - gap - R - 30, top, (gap + R + 30) * 2, R * 2 + 66, 18); ctx.fill();
  drawStone(ctx, 1, 360 - gap, cy, R, { v: 1 });
  drawStone(ctx, 2, 360 + gap, cy, R, { v: 1 });
  text('Black', 360 - gap, cy + R + 32, 22, PAGE_TEXT, UI, 700);
  text('White', 360 + gap, cy + R + 32, 22, PAGE_TEXT, UI, 700);
  return top + R * 2 + 76;
}
