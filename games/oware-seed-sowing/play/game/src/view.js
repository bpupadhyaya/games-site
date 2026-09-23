// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The table, board and seed sprites are cached (art.js).
import { W, H, PIT_R, PITCH, X0, ROW_Y, TRAY, MID_Y, BTN, SET, pitPos, trayPos, titleRows, TEXT_SCALES, AP_THINK_STEPS } from './layout.js';
import { drawTable, drawBoard, drawSeed, slot, WOODS, SEEDSETS } from './art.js';
import { legalMoves } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const CREAM = '#fbe8bf', GOLD = '#f3cf7a';

// ---- Rules page art: a small real board snapshot, drawn with the game's own drawBoard/drawSeed/slot -------------
// (never a separate invented icon set), the same technique the title screen uses for its mini board.
function ruleSnapshot(role) {
  const idle = () => ({ pits: new Array(12).fill(4), store: [0, 0] });
  if (role === 'setup') return { snap: idle(), hi: null, caption: null };
  if (role === 'mine') return { snap: idle(), hi: { pits: [0, 1, 2, 3, 4, 5] }, caption: 'Your pits: the bottom row' };
  if (role === 'theirs') return { snap: idle(), hi: { pits: [6, 7, 8, 9, 10, 11] }, caption: 'The opponent’s pits: the top row' };
  if (role === 'store') return { snap: { pits: [4, 4, 0, 4, 4, 4, 4, 0, 4, 4, 4, 4], store: [4, 4] }, hi: { trays: true }, caption: 'Each side’s store, holding captured seeds' };
  if (role === 'capture') return { snap: { pits: [4, 4, 4, 4, 4, 4, 4, 4, 3, 2, 4, 4], store: [0, 0] }, hi: { pits: [8, 9] }, caption: 'Two pits at 3 and 2: both captured' };
  return null;
}
function drawRuleBoard(ctx, state, snap, hi, topY = 60) {
  ctx.save(); ctx.translate(360, topY); ctx.scale(0.6, 0.6); ctx.translate(-360, 0);
  drawBoard(ctx, state.wood);
  for (let i = 0; i < 12; i++) {
    const p = pitPos(i), n = snap.pits[i];
    for (let k = 0; k < n; k++) { const s = slot(i, k); drawSeed(ctx, state.seeds, s.v, p.x + s.x, p.y + s.y, s.rot, 1.22); }
  }
  for (const pl of [0, 1]) {
    const T = pl === 0 ? TRAY.bottom : TRAY.top, n = snap.store[pl];
    for (let k = 0; k < n; k++) { const col = k % 17, row = Math.floor(k / 17); drawSeed(ctx, state.seeds, (k * 3 + pl) % 4, T.x + 172 + col * 22 + (row % 2) * 8, T.y + 20 + row * 25, ((k * 97) % 360) * Math.PI / 180, 1.05); }
  }
  if (hi && hi.pits) for (const i of hi.pits) {
    const p = pitPos(i), gr = ctx.createRadialGradient(p.x, p.y, PIT_R * 0.5, p.x, p.y, PIT_R + 22);
    gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(0.7, 'rgba(255,220,120,0.55)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 22, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,120,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 4, 0, TAU); ctx.stroke();
  }
  if (hi && hi.trays) for (const T of [TRAY.top, TRAY.bottom]) {
    ctx.strokeStyle = 'rgba(255,220,120,0.95)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(T.x - 6, T.y - 6, T.w + 12, T.h + 12, 40); ctx.stroke();
  }
  ctx.restore();
}

export function render(ctx, state) {
  const scene = state.scene, big = state.big, g = state.game, A = state.anim;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'puzzle' || scene === 'autoplay' || scene === 'autoplay-over';

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(30,8,0,0.55)'; ctx.fillText(str, x + 1.5, y + 2.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.3, align = 'center') => { const L = lines(str, maxW, size); L.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return L.length; };
  // A one-line heading/caption never wraps; instead it shrinks to fit, so a long string (or a
  // bigger text-size step) can never clip past the panel - used by the About/Rules page titles.
  const fitSz = (str, size, weight, font, maxW, min) => { let s = size; ctx.font = `${weight} ${s}px ${font}`; while (ctx.measureText(str).width > maxW && s > min) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; } return s; };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(30,8,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, 22); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#fbdc8c'); gr.addColorStop(0.55, '#e0a83e'); gr.addColorStop(1, '#b9791f'); } else { gr.addColorStop(0, '#6d4022'); gr.addColorStop(0.5, '#4a2812'); gr.addColorStop(1, '#2f1608'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.85)' : 'rgba(243,207,122,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 4, r.w - 10, r.h * 0.44, 17); ctx.stroke();
    const sz = o.size ?? 30;
    ctx.textAlign = 'center'; ctx.font = `700 ${sz}px ${UI}`;
    ctx.fillStyle = o.primary ? 'rgba(255,240,200,0.5)' : 'rgba(0,0,0,0.5)'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36 + 1.5);
    ctx.fillStyle = o.primary ? '#2a1606' : CREAM; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36);
    ctx.restore();
  };
  const panel = (x, y, w, h, alpha = 0.86) => {
    ctx.save(); ctx.fillStyle = `rgba(26,10,3,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(243,207,122,0.75)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  };

  // ---- the board and what is in it (used full size, and small on the title) --------------------------------------
  function contents(shownPits, shownStore, opts = {}) {
    const set = state.seeds, pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const legal = opts.legal || [];
    // glows under the pits
    const glow = (i, rgb, a) => { const p = pitPos(i), gr = ctx.createRadialGradient(p.x, p.y, PIT_R * 0.5, p.x, p.y, PIT_R + 20); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.7, `rgba(${rgb},${0.55 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 20, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},${0.9 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 3, 0, TAU); ctx.stroke(); };
    for (const i of legal) glow(i, '255,220,120', 0.5 + pulse * 0.5);
    if (state.hint && !A) glow(state.hint.pit, '130,255,170', 0.6 + pulse * 0.4);
    if (A && A.phase === 'capwait') for (const c of A.r.captured) glow(c, '255,190,80', 0.5 + Math.abs(Math.sin(A.timer * 14)) * 0.5);
    // seeds in pits
    for (let i = 0; i < 12; i++) {
      const p = pitPos(i); let n = shownPits[i]; if (n <= 0) continue;
      const flying = A && A.phase === 'cap' && A.r.captured[A.cap] === i;
      if (flying) continue;
      let dx = 0;
      if (state.ref && state.ref.pit === i && !state.calm) dx = Math.sin(state.ref.t * 60) * 5 * (1 - state.ref.t / 0.6);
      for (let k = 0; k < n; k++) {
        const s = slot(i, k); let oy = 0;
        if (A && A.lastDrop === i && k === n - 1 && A.dropT < 0.14 && !state.calm) oy = -9 * (1 - A.dropT / 0.14);
        drawSeed(ctx, set, s.v, p.x + s.x + dx, p.y + s.y + oy, s.rot, 1.22);
      }
    }
    if (state.ref && !A) { const p = pitPos(state.ref.pit); ctx.strokeStyle = `rgba(255,120,90,${0.9 * (1 - state.ref.t / 0.6)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 4, 0, TAU); ctx.stroke(); }
    // counts
    if (opts.counts !== false) for (let i = 0; i < 12; i++) {
      const n = shownPits[i]; if (n <= 0) continue; const p = pitPos(i), y = i < 6 ? p.y + PIT_R + (big ? 34 : 30) : p.y - PIT_R - (big ? 14 : 12);
      const sz = big ? 34 : 27; ctx.textAlign = 'center'; ctx.font = `800 ${sz}px ${UI}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,14,2,0.85)'; ctx.strokeText(String(n), p.x, y); ctx.fillStyle = '#ffecc0'; ctx.fillText(String(n), p.x, y);
    }
    // stores
    for (const pl of [0, 1]) {
      const T = pl === 0 ? TRAY.bottom : TRAY.top, n = shownStore[pl];
      for (let k = 0; k < n; k++) { const col = k % 17, row = Math.floor(k / 17); drawSeed(ctx, set, (k * 3 + pl) % 4, T.x + 172 + col * 22 + (row % 2) * 8, T.y + 20 + row * 25, ((k * 97) % 360) * Math.PI / 180, 1.05); }
      const label = opts.labels ? opts.labels[pl] : pl === 0 ? 'You' : 'Computer';
      if (opts.counts !== false) { text(label, T.x + 24, T.y + 40, big ? 28 : 24, CREAM, UI, 700, 'left'); text(String(n), T.x + T.w - 26, T.y + 58, big ? 50 : 44, GOLD, FONT, 700, 'right'); }
    }
  }

  // ---- table -----------------------------------------------------------------------------------------------------
  if (scene === 'title' || scene === 'demo-limit') drawTable(ctx, state.wood, false); else drawTable(ctx, state.wood, boardScene);

  if (boardScene) {
    drawBoard(ctx, state.wood);
    // header
    if (scene === 'lesson') {
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 360, 160, 26, 'rgba(251,232,191,0.85)', UI, 600);
      text(LESSONS[state.lesson.i].title, 360, 235, 62, CREAM, FONT);
    } else if (scene === 'puzzle') {
      text('Daily puzzle' + (state.pz.puzzle.hard ? ' (weekend)' : ''), 360, 160, 26, 'rgba(251,232,191,0.85)', UI, 600);
      text('Capture the most', 360, 235, 62, CREAM, FONT);
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 285, 24, GOLD, UI, 600);
    } else if (scene === 'autoplay' || scene === 'autoplay-over') {
      const AP = state.ap, dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
      const phaseLine = g.winner !== null ? 'Game over' : !AP ? '' : AP.phase === 'think' ? 'Think' + dots : AP.phase === 'reveal' ? 'Here is the move' : 'Playing it out' + dots;
      text('Auto Play', 360, 180, 58, CREAM, FONT);
      text('Watch & learn: both seats play themselves', 360, 226, 21, 'rgba(251,232,191,0.85)', UI, 500);
      text(phaseLine, 360, 268, 26, GOLD, UI, 700);
    } else {
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : null;
      const line = g.winner !== null ? 'Game over' : state.two ? (g.turn === 0 ? 'Player one: bottom row' : 'Player two: top row') : g.turn === 0 ? 'Your move' : (th || 'The computer moves');
      text(line, 360, 180, 58, CREAM, FONT);
      text(state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name} · ${LEVELS[state.level].blurb}`, 360, 226, 21, 'rgba(251,232,191,0.85)', UI, 500);
      text('First to capture 25 seeds wins', 360, 268, 22, GOLD, UI, 600);
    }
    // the player's row of legal pits glows on the human turn (or, in Auto Play, during REVEAL)
    let legal = [];
    if (!A && g.winner === null) {
      if (scene === 'play') { if (state.two || g.turn === 0) legal = legalMoves(g); }
      else if (scene === 'lesson') { if (!state.lesson.done) legal = LESSONS[state.lesson.i].want.filter((p) => legalMoves(g).includes(p)); }
      else if (scene === 'puzzle') { if (state.pz.status !== 'solved' && state.pz.wrong <= 0) legal = legalMoves(g); }
      else if (scene === 'autoplay') { if (state.ap && state.ap.phase === 'reveal') legal = state.ap.legal; }
    }
    // a moving chevron along the carved arrows: the direction of sowing
    if (!state.calm) { const f = (state.t * 0.5) % 1; for (const [y, d] of [[MID_Y - 26, -1], [MID_Y + 26, 1]]) { const x = d > 0 ? 190 + 340 * f : 530 - 340 * f; ctx.strokeStyle = `rgba(255,214,120,${0.9 * Math.sin(Math.PI * f)})`; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - d * 9, y - 9); ctx.lineTo(x + d * 9, y); ctx.lineTo(x - d * 9, y + 9); ctx.stroke(); } }
    contents(state.shown.pits, state.shown.store, { legal, labels: scene === 'autoplay' || scene === 'autoplay-over' ? ['Bottom seat', 'Top seat'] : scene === 'lesson' || scene === 'puzzle' ? ['You', 'Opponent'] : state.two ? ['Player one', 'Player two'] : ['You', 'Computer'] });
    // keyboard cursor
    if (state.kb && scene !== 'over') { const p = pitPos(g.turn === 0 ? state.cursor : 11 - state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 7, 0, TAU); ctx.stroke(); }
    // the carried seeds, and capture flourish
    if (A) {
      const r = A.r, o = pitPos(r.pit);
      if (A.phase === 'lift' || A.phase === 'sow') {
        let x, y, gy, hop = 0;
        if (A.phase === 'lift') { const f = Math.min(1, A.timer / Math.max(0.01, state.calm ? 0.11 : 0.22)); x = o.x; gy = o.y; hop = 0; y = o.y - 30 * f; }
        else {
          const from = A.idx === 0 ? o : pitPos(r.path[A.idx - 1]), to = pitPos(r.path[Math.min(A.idx, r.path.length - 1)]), f = Math.min(1, A.timer / A.sd), e = f * f * (3 - 2 * f);
          x = from.x + (to.x - from.x) * e; gy = from.y + (to.y - from.y) * e; hop = state.calm ? 0 : Math.sin(Math.PI * f) * 26; y = gy - 30 - hop;
        }
        // shadow on the board, then the bunch
        ctx.fillStyle = 'rgba(20,6,0,0.32)'; ctx.beginPath(); ctx.ellipse(x + 6, gy + 10, 26 - hop * 0.15, 11, 0, 0, TAU); ctx.fill();
        const n = Math.min(A.n, 9);
        for (let k = 0; k < n; k++) { const s = slot(99, k, 30); drawSeed(ctx, state.seeds, s.v, x + s.x * 0.75, y + s.y * 0.65, s.rot, 1.05); }
        if (A.n > 0) { ctx.fillStyle = 'rgba(30,10,2,0.9)'; ctx.beginPath(); ctx.arc(x + 26, y - 20, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); text(String(A.n), x + 26, y - 13, 20, '#ffe9b0', UI, 800, 'center', false); }
      }
      if (A.phase === 'cap') {
        const c = r.captured[A.cap], p = pitPos(c), T = trayPos(r.player), f = Math.min(1, A.timer / Math.max(0.01, state.calm ? 0.17 : 0.34)), e = f * f * (3 - 2 * f), n = A.r.before ? 0 : 0;
        void n;
        const cnt = state.shown.pits[c];
        for (let k = 0; k < cnt; k++) { const s = slot(c, k), x = p.x + s.x + (T.x - p.x - s.x) * e, y = p.y + s.y + (T.y - p.y - s.y) * e - Math.sin(Math.PI * e) * 70; drawSeed(ctx, state.seeds, s.v, x, y, s.rot + e * 6, 1 + 0.15 * Math.sin(Math.PI * e)); }
        if (!state.calm) { ctx.strokeStyle = `rgba(255,214,120,${0.85 * (1 - f)})`; ctx.lineWidth = 7 * (1 - f) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R * (0.8 + 0.9 * f), 0, TAU); ctx.stroke(); }
        text(`+${cnt}`, p.x, p.y - 40 - f * 30, 34, `rgba(255,224,130,${1 - f * 0.6})`, FONT, 700);
      }
      if (A.phase === 'end' && r.slam) text('Grand slam: nothing is taken', 360, MID_Y + 6, 34, '#ffd7a0', FONT, 700);
    }
    // message panel
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      let ms = big ? 34 : 28, L = lines(state.msg.text, 620, ms);
      while (L.length * ms * 1.28 > 104 && ms > 18) { ms -= 2; L = lines(state.msg.text, 620, ms); }
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(40, 1206, 640, 118, 0.9);
      const top = 1206 + 59 - (L.length * ms * 1.28) / 2 + ms * 0.95; L.forEach((ln, i) => text(ln, 360, top + i * ms * 1.28, ms, '#fff3d6', UI, 600, 'center', false));
      ctx.restore();
    } else if (scene === 'lesson' && !state.lesson.done && !state.anim) {
      // the lesson's instruction stays up until the player has done it
      const tx = LESSONS[state.lesson.i].text; let ms = big ? 34 : 28, L = lines(tx, 620, ms);
      while (L.length * ms * 1.28 > 104 && ms > 18) { ms -= 2; L = lines(tx, 620, ms); }
      panel(40, 1206, 640, 118, 0.9); const top = 1206 + 59 - (L.length * ms * 1.28) / 2 + ms * 0.95; L.forEach((ln, i) => text(ln, 360, top + i * ms * 1.28, ms, '#fff3d6', UI, 600, 'center', false));
    }
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 28 }); button(BTN.undo, 'Undo', { size: 28 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 28 }); if (state.lesson.done && !A) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !A) button(BTN.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'autoplay') {
      button(BTN.apExit, 'Exit', { size: 28 });
      button(BTN.apDec, 'Think −', { size: 25, dim: state.apThinkIdx === 0 });
      button(BTN.apInc, 'Think +', { size: 25, dim: state.apThinkIdx === AP_THINK_STEPS.length - 1 });
      text(`Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, 360, 1320, 22, GOLD, UI, 600);
    }
    if (scene === 'play' && state.dev) text('DEV', 40, 130, 20, '#7dff9a', UI, 700, 'left');
  }

  if (scene === 'title' || scene === 'demo-limit') {
    // the title: a smaller, real board under the name
    ctx.save(); ctx.translate(360, 300 - 400 * 0.6); ctx.scale(0.6, 0.6); ctx.translate(-360, 0);
    drawBoard(ctx, state.wood);
    const idle = { pits: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], store: [0, 0] };
    contents(idle, idle.store, { counts: false });
    ctx.restore();
    text('Oware', 360, 196, 122, CREAM, FONT);
    text('The seed-sowing game of West Africa', 360, 250, 26, 'rgba(251,232,191,0.9)', FONT, 500);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solved = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 32 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 32 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    button(R.two, 'Two players, one phone', { size: 30 });
    button(R.daily, solved ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 30 });
    button(R.autoplay, 'Auto Play · Watch & Learn', { size: 28 });
    button(R.about, 'About Oware', { size: 21 }); button(R.settings, 'Settings', { size: 21 }); button(R.rules, 'Rules', { size: 21 });
    const y = R.about.y + 130;
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, y, 22, 'rgba(251,232,191,0.85)', UI, 500);
    let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
    text(stars.trim(), 360, y + 40, 30, GOLD, UI, 700);
    if (state.msg) wrap(state.msg.text, 360, 1440, 24, 620, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    panel(60, 800, 600, 380, 0.88);
    text('That was the free taste.', 360, 920, 56, CREAM, FONT);
    text('Get Oware on iPhone and Android', 360, 1010, 30, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1052, 30, '#fff3d6', UI, 600);
  } else if (scene === 'settings') {
    panel(40, 130, 640, 1130, 0.5);
    text('Settings', 360, 230, 70, CREAM, FONT);
    const lv = LEVELS[state.level];
    button(SET.level, `Computer level: ${lv.name}`, { size: 30 });
    button(SET.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 30 });
    button(SET.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 30 });
    button(SET.big, state.big ? 'Large text: on' : 'Large text: off', { size: 30 });
    button(SET.seeds, `Seeds: ${SEEDSETS[state.seeds]}`, { size: 30 });
    button(SET.wood, `Board: ${WOODS[state.wood].name}`, { size: 30 });
    wrap(lv.blurb, 360, 980, 26, 600, '#ffe9b0');
    // a small preview of the chosen seeds
    for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, 210 + k * 38, 1090, k * 0.7, 1.5);
    button(SET.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about') {
    // Text-size stepper: a small index (never a raw float) into TEXT_SCALES, guarded and clamped
    // on load (game.js) so a stale saved index from a shorter/longer array can never produce NaN
    // fonts. One paginated concept per page, same reader-card pattern as Rules below, so the body
    // text can be this much bigger without any page overflowing the panel.
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const page = ABOUT.pages[state.page % ABOUT.pages.length];
    panel(36, 120, 648, 1240, 0.9);
    text(ABOUT.title, 360, 210, 64, CREAM, FONT);
    button(BTN.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(BTN.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    const titleSz = fitSz(page.title, Math.round(30 * scale), 700, FONT, 580, 20), bodySz = Math.round(29 * scale), lh = Math.round(bodySz * 1.4);
    // The page title's baseline is anchored below the fixed header/stepper row by the title's own
    // ascent, so a bigger text-size step can never push it up into "About Oware" above it.
    const titleY = 252 + Math.round(titleSz * 0.82);
    text(page.title, 70, titleY, titleSz, GOLD, FONT, 700, 'left');
    // Clears the title's own descent AND the body font's own ascent - a long title (fitSz-shrunk
    // much smaller than the scaled-up body font that follows it) left too little room when the gap
    // was sized off the title alone, same fix as the Rules page below.
    let y = titleY + Math.round(titleSz * 0.3 + bodySz * 0.85) + 10;
    for (const line of page.lines) { const n = wrap(line, 70, y, bodySz, 580, '#fff3d6', lh, 'left'); y += n * lh + Math.round(16 * scale); }
    text(`Page ${(state.page % ABOUT.pages.length) + 1} of ${ABOUT.pages.length}`, 360, 1345, 20, 'rgba(251,232,191,0.65)', UI, 500);
    // Back is the neutral/secondary action (always returns to the title); Next is the primary,
    // forward-reading action, and reads as a clear exit affordance ("Done") on the last page rather
    // than a dead-end "Next" that just wraps back to page one.
    const aboutLast = state.page % ABOUT.pages.length === ABOUT.pages.length - 1;
    button(BTN.aboutBack, 'Back', { size: 28 });
    button(BTN.aboutNext, aboutLast ? 'Done' : 'Next', { primary: true, size: 28 });
  } else if (scene === 'rules') {
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const page = RULES[state.page % RULES.length];
    panel(36, 120, 648, 1240, 0.9);
    text('Rules', 360, 210, 64, CREAM, FONT);
    button(BTN.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(BTN.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    const bodySz = Math.round(29 * scale), lh = Math.round(bodySz * 1.4);
    const titleSz = fitSz(page.title, Math.round(31 * scale), 700, FONT, 600, 20);
    // Same anchor-below-header fix as the About page: keeps the title clear of "Rules" above it
    // at every text-size step.
    const titleY = 252 + Math.round(titleSz * 0.82);
    text(page.title, 360, titleY, titleSz, GOLD, FONT, 700);
    // Everything below the title also has to move with it: at a big scale step a short page title
    // ("The board", "Capturing"...) can render far taller than the ~316 gap this layout was
    // originally tuned for, so the board snapshot / caption / body all anchor off the title's own
    // actual height instead of a fixed offset - the same principle as the About page's `y`. Body
    // text clears the title's own descent AND the body font's own ascent - a long title (fitSz-
    // shrunk much smaller than the scaled-up body font that follows it, e.g. "Relay sowing:
    // seeding a second lap") left too little room when the gap was sized off the title alone.
    let y = titleY + Math.round(titleSz * 0.3 + bodySz * 0.85) + 10;
    const info = ruleSnapshot(page.role);
    if (info) {
      const contentTop = titleY + Math.round(titleSz * 1.15); // an illustration has no text ascent to clear
      const boardTopY = contentTop - 235; // board's own top edge (FRAME.y * 0.6) lands at contentTop
      drawRuleBoard(ctx, state, info.snap, info.hi, boardTopY);
      const boardBottomY = boardTopY + 635; // FRAME bottom, scaled
      y = boardBottomY + 59;
      if (info.caption) {
        // capY is a baseline: clear the board's own bottom edge by the caption's ascent, not just
        // a flat margin, so a bigger text-size step can never sit the caption on top of the board.
        const capSz = fitSz(info.caption, Math.round(23 * scale), 600, UI, 600, 16), capY = boardBottomY + 20 + Math.round(capSz * 0.75);
        text(info.caption, 360, capY, capSz, 'rgba(251,232,191,0.85)', UI, 600);
        // Body text starts clear of both the caption's own descender AND the (much bigger, at a
        // high text-size step) body font's own ascender above its baseline - not a gap sized off
        // the caption alone, which used to leave the two touching once bodySz grew past capSz.
        y = capY + Math.round(capSz * 0.3 + bodySz * 0.85) + 10;
      }
    }
    for (const line of page.lines) { const n = wrap(line, 70, y, bodySz, 580, '#fff3d6', lh, 'left'); y += n * lh + Math.round(16 * scale); }
    text(`Page ${(state.page % RULES.length) + 1} of ${RULES.length}`, 360, 1345, 20, 'rgba(251,232,191,0.65)', UI, 500);
    // Same Back/Next convention as the About page: Back is neutral (always exits to the title),
    // Next is the primary forward action and becomes a "Done" exit affordance on the last page.
    const rulesLast = state.page % RULES.length === RULES.length - 1;
    button(BTN.rulesBack, 'Back', { size: 28 });
    button(BTN.rulesNext, rulesLast ? 'Done' : 'Next', { primary: true, size: 28 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(20,6,0,0.7)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : state.two ? (g.winner === 0 ? 'Player one wins' : 'Player two wins') : g.winner === 0 ? 'You win!' : 'The computer wins';
    text(won, 360, 500, 96, CREAM, FONT);
    wrap(g.reason, 360, 570, 26, 560, '#fff3d6');
    text(`${state.shown.store[0]} : ${state.shown.store[1]}`, 360, 740, 120, GOLD, FONT);
    text(state.two ? 'Player one : Player two' : 'You : Computer', 360, 785, 24, 'rgba(251,232,191,0.85)', UI, 600);
    text(`${g.moves} moves`, 360, 830, 24, 'rgba(251,232,191,0.7)', UI, 500);
    if (!state.two && g.winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, 360, 900, 32, GOLD, UI, 700);
      if (!state.calm) for (let k = 0; k < 16; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (170 + 90 * ph), y = 640 - ph * 420; drawSeed(ctx, state.seeds, k % 4, x, y, ph * 6, 0.9 - ph * 0.4); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 36 }); button(BTN.back, 'Menu', { size: 32 });
  } else if (scene === 'autoplay-over') {
    ctx.fillStyle = 'rgba(20,6,0,0.7)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : g.winner === 0 ? 'Bottom seat wins' : 'Top seat wins';
    text('Auto Play complete', 360, 470, 52, CREAM, FONT);
    text(won, 360, 560, 78, GOLD, FONT);
    wrap(g.reason, 360, 630, 26, 560, '#fff3d6');
    text(`${state.shown.store[0]} : ${state.shown.store[1]}`, 360, 780, 110, GOLD, FONT);
    text('Bottom seat : Top seat', 360, 825, 24, 'rgba(251,232,191,0.85)', UI, 600);
    text(`${g.moves} moves`, 360, 865, 24, 'rgba(251,232,191,0.7)', UI, 500);
    button(BTN.again, 'Play again', { primary: true, size: 34 }); button(BTN.back, 'Exit to menu', { size: 30 });
  }
  void H; void PITCH; void X0; void ROW_Y;
}
