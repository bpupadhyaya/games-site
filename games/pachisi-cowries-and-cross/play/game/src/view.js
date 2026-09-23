// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The heavy art is cached (art.js, pieces.js).
import { W, H, MAT, BOARD, cellSize, posXY, yardOffset, gridXY, hopPath } from './layout.js';
import { geo, homeCount, trackIndex, COLOUR_NAMES } from './rules.js';
import { drawStatic, drawFloorOnly, drawPanel, star, ARM_COLOURS, ARM_LIGHT, lcg } from './art.js';
import { drawPawn, drawCowry, drawDie } from './pieces.js';
import { screenButtons, PANEL, HOW_PAGES, ABOUT_PAGES, RULES_PAGES, TEXT_SCALES } from './ui.js';
import { LESSONS } from './lessons.js';
import { LEVEL_NAMES, LEVEL_BLURB } from './ai.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const INK = '#3a1c0e';

const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function render(ctx, state) {
  const sc = state.scene, T = state.t, big = state.prefs.big, g = state.g;
  // Falls back to 1 for any out-of-range index (e.g. a save from a build with more/fewer steps).
  const textScale = TEXT_SCALES[state.prefs.textScaleIdx ?? 0] ?? 1;
  const panelScene = ['setup', 'learn', 'settings', 'how', 'about', 'rules', 'demo-limit'].includes(sc);
  const boardScene = !panelScene;
  const mode = boardScene && sc !== 'title' ? g.mode : 'pachisi';

  const text = (str, x, y, size, color = '#f6dfae', font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color, font = FONT, align = 'center') => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; text(str, x, y, size, color, font, 700, align); ctx.restore(); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center', font = UI, weight = 600, maxLines = 99) => {
    ctx.font = `${weight} ${size}px ${font}`;
    const lines = []; let curL = '';
    for (const w of str.split(' ')) { const t2 = curL ? curL + ' ' + w : w; if (ctx.measureText(t2).width > maxW && curL) { lines.push(curL); curL = w; } else curL = t2; }
    lines.push(curL);
    lines.slice(0, maxLines).forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align));
    return lines.length;
  };
  const fitWrap = (str, x, y, maxW, maxH, sMax, sMin, color, align = 'center', lhk = 1.28) => {
    for (let s = sMax; s >= sMin; s -= 1) {
      ctx.font = `600 ${s}px ${UI}`; let n = 1, curL = '';
      for (const w of str.split(' ')) { const t2 = curL ? curL + ' ' + w : w; if (ctx.measureText(t2).width > maxW && curL) { n++; curL = w; } else curL = t2; }
      if (n * s * lhk <= maxH || s === sMin) { const lh = s * lhk, top = y + (maxH - n * lh) / 2 + s * 0.95; wrap(str, x, top, s, maxW, color, lh, align); return; }
    }
  };
  const button = (r) => {
    ctx.save(); if (r.dim) ctx.globalAlpha = 0.5;
    const sel = r.sel, prim = r.primary;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (prim || (sel && r.chip)) { gr.addColorStop(0, '#f6d987'); gr.addColorStop(1, '#c48a26'); } else if (sel) { gr.addColorStop(0, '#5d9a55'); gr.addColorStop(1, '#2f6b35'); } else { gr.addColorStop(0, '#7a4a24'); gr.addColorStop(1, '#43240f'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,170,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h * 0.45, 14); ctx.stroke();
    const size = (r.size ?? (r.chip ? 27 : 30)) * (big ? 1.12 : 1), dark = prim || (sel && r.chip), col = dark ? '#2a1606' : '#f6dfae';
    if (r.toggle) { text(r.label, r.x + 28, r.y + r.h / 2 + size * 0.35, size, col, UI, 700, 'left'); text(r.value, r.x + r.w - 28, r.y + r.h / 2 + size * 0.35, size, r.sel ? '#d9ffc8' : '#e8b7a4', UI, 700, 'right'); }
    else if (r.left) {
      text(r.label, r.x + 24, r.y + r.h / 2 + size * 0.35, size * 0.95, col, UI, 700, 'left');
      if (r.locked) text('full game', r.x + r.w - 22, r.y + r.h / 2 + 8, 22, '#e8b7a4', UI, 600, 'right');
      else if (r.done) { ctx.strokeStyle = '#a6f0a0'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r.x + r.w - 62, r.y + r.h / 2); ctx.lineTo(r.x + r.w - 46, r.y + r.h / 2 + 16); ctx.lineTo(r.x + r.w - 20, r.y + r.h / 2 - 16); ctx.stroke(); }
    } else text(r.label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.35, size, col, UI, 700);
    ctx.restore();
  };
  const plaque = (x, y, w, h) => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#3b2213'); gr.addColorStop(1, '#1e0f07');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#c9982f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,150,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 11); ctx.stroke();
  };
  const scrim = (a = 0.62) => { ctx.fillStyle = `rgba(12,5,2,${a})`; ctx.fillRect(0, 0, W, H); };
  const buttonsNow = () => { for (const b of screenButtons(state)) button(b); };

  // ---- ground --------------------------------------------------------------------------------------
  if (panelScene) drawFloorOnly(ctx); else drawStatic(ctx, mode);
  motes(ctx, T);

  if (boardScene) {
    drawYards(ctx, state, text, mode);
    drawPieces(ctx, state);
    drawCowries(ctx, state, text);
  }

  // ---- header + message ------------------------------------------------------------------------------
  const play = sc === 'play' || sc === 'lesson' || sc === 'daily' || sc === 'pass' || sc === 'over' || sc === 'autoplay' || sc === 'autoplay-over';
  if (play) {
    if (sc === 'lesson' && state.lesson) shadowText(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}: ${LESSONS[state.lesson.i].title}`, 360, 112, big ? 36 : 40, '#f6dfae');
    else if (sc === 'daily') shadowText(`Daily race  ·  score ${state.dl ? state.dl.score : 0}`, 360, 112, 46, '#f6dfae');
    else if (sc === 'autoplay' || sc === 'autoplay-over') shadowText('Auto Play · Watch & Learn', 360, 112, 36, '#f6dfae');
    else shadowText('Pachisi', 360, 120, 68, '#f6dfae');
    plaque(36, 150, 648, 128);
    fitWrap(state.msg || '', 360, 154, 592, 120, big ? 34 : 29, 20, '#fff2d0');
  }

  if (sc === 'title') drawTitle(ctx, state, text, shadowText);

  if (boardScene && play && sc !== 'over' && sc !== 'pass' && sc !== 'autoplay-over') {
    drawMedallion(ctx, state, text);
    if (!state.menuOpen && !(sc === 'lesson' && state.lesson?.complete) && !(sc === 'daily' && state.dl?.finished)) buttonsNow();
  }

  // ---- panels --------------------------------------------------------------------------------------
  if (panelScene) {
    drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    const readerPage = sc === 'how' || sc === 'about' || sc === 'rules';
    // The reference-page header is capped well below the body-text scale (same cap as the old top
    // step, 1.3x): once TEXT_SCALES grew to reach 2x for body copy, an uncapped 66px title at 2x
    // (132px) ran off the top of the panel for any short single-word title - the header stays
    // readable and inside the frame at every step without needing its own overflow handling.
    ctxTitle(ctx, text, sc === 'setup' ? 'Set up a game' : sc === 'learn' ? 'Learn to play' : sc === 'settings' ? 'Settings' : sc === 'how' ? HOW_PAGES[state.howPage][0] : sc === 'about' ? ABOUT_PAGES[state.aboutPage][0] : sc === 'rules' ? RULES_PAGES[state.rulesPage][0] : 'Thank you for playing', 190, Math.round(66 * (readerPage ? Math.min(textScale, 1.3) : 1)));
    if (sc === 'setup') {
      const t = state.setup;
      const lab = (s, y) => text(s, 60, y, 26 * (big ? 1.1 : 1), INK, UI, 700, 'left');
      lab('Game', 280); lab('Players', 418); lab('Who plays', 556); if (!t.friends) lab('Computer level', 694); lab('Pawns each', 914);
      const desc = t.mode === 'ludo' ? 'Ludo mode: one die, a smaller board, a 6 to enter and to throw again. No blocks. A friendly first step.' : 'Pachisi: six cowrie shells, grace throws, safe squares, blocks and the home lane. The full royal race.';
      wrap(desc, 360, 1030, 22 * (big ? 1.1 : 1), 580, INK, 30);
      if (!t.friends && t.opp !== 'mixed') wrap(`${LEVEL_NAMES[t.opp]}: ${LEVEL_BLURB[t.opp]}`, 360, 1130, 24 * (big ? 1.1 : 1), 560, '#7a1a20', 32);
      if (!t.friends && t.opp === 'mixed') wrap('Mixed: each computer player has a different personality.', 360, 1120, 24, 560, '#7a1a20', 32);
      if (t.friends) wrap('Friends: everyone takes turns on this phone. A pass-the-phone screen appears between turns.', 360, 1120, 24, 560, '#7a1a20', 32);
    } else if (sc === 'learn') {
      wrap('Nine short lessons. You make every move yourself; nothing is skipped until you do it.', 360, 196, 24, 560, INK, 30);
    } else if (sc === 'settings') {
      wrap('Every pawn colour also has its own shape: ball, spire, crown, cube.', 360, 1200, 24, 560, INK, 32);
      wrap('Progress is kept on this device.', 360, 1266, 22, 560, '#7a1a20', 30);
    } else if (sc === 'how' || sc === 'about') {
      const pages = sc === 'how' ? HOW_PAGES : ABOUT_PAGES, pg = pages[sc === 'how' ? state.howPage : state.aboutPage][1];
      // The header's cursive descenders (e.g. the 'g' in "Throwing") sit at a fixed height, but the
      // body text below it grows with textScale - at the 200%/300% steps a tall capital letter on the
      // first body line can visually collide with them, so nudge the body's start down a little as
      // textScale grows (harmless at 100%, where textScale=1 leaves this at the original 250).
      let y = 250 + Math.round((textScale - 1) * 14); const sz = Math.round(28 * textScale * (big ? 1.06 : 1)), lh = Math.round(sz * 1.4), gap = Math.round(22 * textScale);
      for (const para of pg) { const n = wrap(para, 76, y, sz, 568, INK, lh, 'left'); y += n * lh + gap; }
      text(`Page ${(sc === 'how' ? state.howPage : state.aboutPage) + 1} of ${pages.length}`, 360, 1290, 22, '#7a1a20', UI, 600);
    } else if (sc === 'rules') {
      const idx = state.rulesPage, page = RULES_PAGES[idx];
      const sz = Math.round(28 * textScale * (big ? 1.06 : 1)), lh = Math.round(sz * 1.4), gap = Math.round(18 * textScale);
      let y = 250 + Math.round((textScale - 1) * 14);
      // The art's own caption sits at a fixed size/position, but the body text below it grows with
      // textScale - at the 300% step the body's own ascent reached up far enough to crowd the
      // caption above it, so the gap after the art must also grow with the body font, not stay fixed.
      if (page[2]) { drawRulesArt(ctx, page[2], T); y = 250 + RULES_ART_H + Math.round(sz * 0.5); }
      for (const para of page[1]) { const n = wrap(para, 76, y, sz, 568, INK, lh, 'left'); y += n * lh + gap; }
      text(`Page ${idx + 1} of ${RULES_PAGES.length}`, 360, 1290, 22, '#7a1a20', UI, 600);
    } else if (sc === 'demo-limit') {
      wrap('That is the end of the free web preview. Get Pachisi on iPhone and Android for unlimited games, all nine lessons, the daily race and every setting.', 360, 400, 32, 540, INK, 44);
      pawnRow(ctx, 360, 900);
    }
    buttonsNow();
    if (sc === 'demo-limit') { /* buttons drawn above */ }
  }

  // ---- overlays --------------------------------------------------------------------------------------
  if (state.menuOpen && !panelScene) { scrim(0.6); drawPanel(ctx, 80, 470, 560, 470); ctxTitle(ctx, text, 'Paused', 545, 60); buttonsNow(); }
  if (sc === 'lesson' && state.lesson?.complete) { plate(ctx, 36, 1120, 648, 220); text('Lesson complete', 360, 1178, 42, '#f6dfae', FONT); buttonsNow(); }
  if (sc === 'daily' && state.dl?.finished) drawDailyDone(ctx, state, text, wrap, buttonsNow);
  if (sc === 'over' || sc === 'autoplay-over') drawOver(ctx, state, text, buttonsNow, scrim);
  if (sc === 'pass') {
    scrim(0.72); drawPanel(ctx, 60, 420, 600, 640);
    const p = state.pass ? g.players[state.pass.pl] : g.players[g.turn], arm = p.arm;
    ctxTitle(ctx, text, 'Pass the phone to', 500, 56);
    drawPawn(ctx, arm, 360, 700, 2.6, Math.sin(T * 3) * 6);
    text(p.name, 360, 800, 66, INK, FONT, 700);
    wrap(`${COLOUR_NAMES[arm]} pawns. Hand the phone over, then TAP the button.`, 360, 850, 24, 480, '#7a1a20', 32);
    buttonsNow();
  }
  if (sc === 'title' || sc === 'setup' || sc === 'learn') { /* buttons already drawn in place */ }
  if (sc === 'title') buttonsNow();

  // a soft lamp flicker over everything
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.05 + 0.02 * Math.sin(T * 7.3) + 0.015 * Math.sin(T * 11.9 + 1);
  const gr = ctx.createRadialGradient(90, 120, 10, 90, 120, 800); gr.addColorStop(0, 'rgba(255,170,70,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 900); ctx.restore();
}

function ctxTitle(ctx, text, str, y = 190, size = 66) {
  // Shrink-to-fit: a long page title (Rules/About/How to play headings) must never run off either
  // edge of the panel, however large the requested display size is.
  const maxW = PANEL.w - 96;
  let s = size;
  ctx.font = `700 ${s}px ${FONT}`;
  while (s > 30 && ctx.measureText(str).width > maxW) { s -= 2; ctx.font = `700 ${s}px ${FONT}`; }
  text(str, 360, y === 190 ? 196 : y, s, '#7a1a20', FONT, 700);
}
function plate(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.fillStyle = 'rgba(28,14,8,0.97)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#c9982f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.stroke();
}

// warm dust drifting in the lamp light
function motes(ctx, T) {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const s = i * 97.3, x = (s * 7.7 + Math.sin(T * 0.3 + i) * 30 + T * (4 + (i % 4))) % W, y = (H - ((s * 13.1 + T * (10 + (i % 5) * 3)) % H)), a = 0.10 + 0.08 * Math.sin(T * 1.7 + i * 2);
    ctx.globalAlpha = a; ctx.fillStyle = '#ffdca0'; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.8, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function pawnRow(ctx, cx, y) { for (let a = 0; a < 4; a++) drawPawn(ctx, a, cx - 150 + a * 100, y, 1.8, Math.abs(Math.sin(a + 0)) * 0); }

// ---- Rules page art: real in-game sprites, drawn in isolation on the reference panel -----------------
const RULES_ART_H = 190;
function swatch(ctx, x, y, s, fill) { ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, 8); ctx.fill(); ctx.strokeStyle = 'rgba(120,28,32,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
function drawRulesArt(ctx, kind, T) {
  const cx = 360, y = 340;
  if (kind === 'pawns') {
    const xs = [150, 290, 430, 570], names = ['Red', 'Green', 'Gold', 'Indigo'];
    xs.forEach((x, a) => { drawPawn(ctx, a, x, y, 1.7, Math.abs(Math.sin(T * 2 + a)) * 4); ctxSmall(ctx, names[a], x, y + 44); });
  } else if (kind === 'safe') {
    swatch(ctx, cx - 100, y - 20, 84, '#e6bd66'); star(ctx, cx - 100, y - 20, 22, '#8e1b22', 3.5);
    ctxSmall(ctx, 'Safe square', cx - 100, y + 46);
    swatch(ctx, cx + 100, y - 20, 84, ARM_COLOURS[0]); star(ctx, cx + 100, y - 20, 19, '#fbe7b0', 3.5);
    ctxSmall(ctx, 'Start square (also safe)', cx + 100, y + 46);
  } else if (kind === 'block') {
    drawPawn(ctx, 1, cx - 7, y - 2, 1.6, 0); drawPawn(ctx, 1, cx + 7, y + 2, 1.6, 0);
    ctxSmall(ctx, 'Two Green pawns: a block', cx, y + 46);
  } else if (kind === 'cowries') {
    drawCowry(ctx, cx - 90, y - 10, 0.3, Math.PI, 0, 1.7);
    ctxSmall(ctx, 'Mouth up', cx - 90, y + 46);
    drawCowry(ctx, cx + 90, y - 10, -0.2, 0, 0, 1.7);
    ctxSmall(ctx, 'Mouth down', cx + 90, y + 46);
  } else if (kind === 'ludo') {
    drawDie(ctx, cx, y - 10, 0.15, 6, 0, 1.7);
    ctxSmall(ctx, 'A throw of 6', cx, y + 46);
  } else if (kind === 'capture') {
    drawPawn(ctx, 1, cx + 60, y - 30, 1.1, 46, 0.4);
    drawPawn(ctx, 0, cx - 20, y, 1.7, 0);
    ctxSmall(ctx, 'Red lands on Green: Green goes home', cx, y + 46);
  }
}
function ctxSmall(ctx, str, x, y) { ctx.textAlign = 'center'; ctx.font = `600 20px ${UI}`; ctx.fillStyle = '#7a1a20'; ctx.fillText(str, x, y); }

// ---- yards: labels and turn glow ---------------------------------------------------------------------------
function drawYards(ctx, state, text, mode) {
  const g = state.g, cs = cellSize(mode), rad = (geo(mode).R / 2 - 0.5) * cs, T = state.t;
  for (let a = 0; a < 4; a++) {
    const pl = g.players.findIndex((p) => p.arm === a), [ux, uy] = yardOffset(mode, a), p = gridXY(mode, ux, uy);
    if (pl < 0) { ctx.fillStyle = 'rgba(15,6,2,0.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.92, 0, TAU); ctx.fill(); continue; }
    const turn = state.scene !== 'title' && g.turn === pl && g.winner < 0;
    if (turn) {
      ctx.save(); ctx.strokeStyle = `rgba(255,224,130,${0.55 + 0.35 * Math.sin(T * 4)})`; ctx.lineWidth = 6; ctx.shadowColor = '#ffd066'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad * 1.02, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const pw = g.players[pl], label = `${pw.name}`, h = homeCount(g, pl);
    const ly = p.y > BOARD.cy ? p.y + rad + 34 : p.y - rad - 18;
    ctx.save(); ctx.fillStyle = 'rgba(20,8,4,0.78)'; ctx.beginPath(); ctx.roundRect(p.x - 84, ly - 28, 168, 46, 23); ctx.fill(); ctx.strokeStyle = ARM_LIGHT[a]; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
    text(label + ' · ' + h + '/' + g.n, p.x, ly + 2, 22, '#fff2d0', UI, 700);
  }
}

// ---- pawns -----------------------------------------------------------------------------------------------------
function drawPieces(ctx, state) {
  const g = state.g, G = geo(g.mode), T = state.t, list = [], PK = cellSize(g.mode) / 31;
  const flying = new Set(state.fly.map((f) => f.pl + ',' + f.i)), hop = state.hop;
  // REVEAL (Auto Play): the same destination-ring/selection-glow a human turn uses, shown once the
  // chosen move is picked (state.sel set in game.js's 'apthink' -> 'apreveal' transition), never
  // during 'apthink' itself so THINK still shows a bare board.
  const choose = (state.phase === 'choose' || state.phase === 'apreveal') && state.opts.length && (g.players[g.turn].human || state.scene !== 'play');
  const selMove = choose && state.sel >= 0 ? state.opts.find((o) => o.i === state.sel) : null;
  const froms = choose ? new Set(state.opts.map((o) => o.from)) : new Set();
  const groups = new Map();
  g.pos.forEach((ps, pl) => ps.forEach((p, i) => {
    if (flying.has(pl + ',' + i) || (hop && hop.pl === pl && hop.i === i)) return;
    const s = posXY(g, pl, i, p), onBoard = p >= 0 && p < G.END, key = onBoard ? `${Math.round(s.x)},${Math.round(s.y)}` : `s${pl}_${i}`;
    const it = { pl, i, p, x: s.x, y: s.y, k: PK, n: 1, idx: 0, movable: choose && pl === g.turn && froms.has(p) };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it); list.push(it);
  }));
  for (const gr of groups.values()) if (gr.length > 1) gr.forEach((it, j) => { const off = gr.length === 2 ? [-7, 7][j] : (j - (gr.length - 1) / 2) * 8; it.x += off; it.k = PK * 0.86; it.y += j % 2 ? 2 : -2; });
  // destination rings for everything that can move
  if (choose) {
    for (const m of state.opts) {
      const d = posXY(g, m.pl, m.i, m.to), sel = selMove && selMove.i === m.i, pulse = 0.5 + 0.5 * Math.sin(T * 5);
      ctx.save(); ctx.strokeStyle = m.caps.length ? `rgba(255,110,90,${0.7 + 0.3 * pulse})` : `rgba(255,224,130,${sel ? 1 : 0.45 + 0.25 * pulse})`; ctx.lineWidth = sel ? 5 : 3;
      if (!sel) ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 17 + pulse * 2, 12 + pulse, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  // pawns, back to front
  list.sort((a, b) => a.y - b.y || a.x - b.x);
  const drawOne = (it) => {
    let lift = 0, x = it.x, y = it.y + 6;
    if (it.movable) {
      const sel = selMove && selMove.from === it.p && (state.sel === it.i || (it.p < 0));
      ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(T * 5 + it.i); const g2 = ctx.createRadialGradient(x, y, 2, x, y, 26); g2.addColorStop(0, sel ? 'rgba(255,240,160,1)' : 'rgba(255,214,110,0.95)'); g2.addColorStop(1, 'rgba(255,190,60,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(x, y + 2, 26, 16, 0, 0, TAU); ctx.fill(); ctx.restore();
      lift = (sel ? 9 : 0) + (state.prefs.calm ? 0 : Math.abs(Math.sin(T * 4 + it.i)) * 3);
    }
    if (state.shake && state.shake.pl === it.pl && state.shake.i === it.i) x += Math.sin(state.shake.t * 60) * 5 * (1 - state.shake.t / 0.55);
    drawPawn(ctx, g.players[it.pl].arm, x, y, it.k, lift);
  };
  for (const it of list) drawOne(it);
  // ghost, path and tag for the selected move
  if (selMove) {
    const pts = hopPath(g, selMove.pl, selMove.i, selMove.from, selMove.to), d = pts[pts.length - 1];
    ctx.save(); ctx.strokeStyle = 'rgba(255,236,170,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([2, 8]); ctx.lineCap = 'round'; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
    drawPawn(ctx, g.players[selMove.pl].arm, d.x, d.y + 6, PK, 0, 0.55 + 0.2 * Math.sin(T * 6));
    const tag = selMove.caps.length ? 'Capture!' : selMove.enter ? 'Enter' : selMove.to === G.END ? 'Home!' : (() => { const t = trackIndex(g, selMove.pl, selMove.to); return t != null && G.safe.has(t) ? 'Safe' : ''; })();
    if (tag) { ctx.save(); ctx.font = `700 20px ${UI}`; const w = ctx.measureText(tag).width + 22, ty = d.y - 66; ctx.fillStyle = selMove.caps.length ? '#b3202a' : '#2d6a35'; ctx.beginPath(); ctx.roundRect(d.x - w / 2, ty, w, 28, 14); ctx.fill(); ctx.strokeStyle = '#fbe7b0'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(tag, d.x, ty + 21); ctx.restore(); }
  }
  // the hopping pawn
  if (hop) {
    const a = hop.pts[Math.min(hop.seg, hop.n)], b = hop.pts[Math.min(hop.seg + 1, hop.n)], f = hop.seg >= hop.n ? 1 : clamp(hop.t / hop.per, 0, 1), e = ease(f);
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    drawPawn(ctx, g.players[hop.pl].arm, x, y + 6, PK * (hop.m.enter ? 1.08 : 1.05), Math.sin(Math.PI * f) * (hop.m.enter ? 30 : 16));
  }
  // captured pawns flying home
  for (const f of state.fly) {
    const u = ease(clamp(f.t / f.dur, 0, 1));
    drawPawn(ctx, g.players[f.pl].arm, f.from.x + (f.to.x - f.from.x) * u, f.from.y + (f.to.y - f.from.y) * u + 6, PK, Math.sin(Math.PI * u) * 90 + 6, 1);
    if (f.t < 0.35) { ctx.save(); ctx.globalAlpha = 1 - f.t / 0.35; ctx.strokeStyle = '#ffdca0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.from.x, f.from.y, 14 + f.t * 90, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}

// ---- cowries / die -------------------------------------------------------------------------------------------
function drawCowries(ctx, state, text) {
  const R = state.roll, T = state.t, g = state.g, die = g.mode === 'ludo';
  const yours = state.phase === 'throw' && (g.players[g.turn].human || state.scene === 'lesson' || state.scene === 'daily') && state.scene !== 'pass';
  const spots = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) spots.push([190 + c * 170, 1148 + r * 96]);
  if (yours) { // a soft glow calls for the throw
    ctx.save(); const pulse = 0.5 + 0.5 * Math.sin(T * 4); const gr = ctx.createRadialGradient(360, 1195, 20, 360, 1195, 300); gr.addColorStop(0, `rgba(255,214,110,${0.25 + 0.2 * pulse})`); gr.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(360, 1195, 300, 120, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (!R || (state.phase === 'throw' && yours && (state.scene === 'lesson' || true) && !R)) {
    // resting shells, waiting to be thrown
    if (die) drawDie(ctx, 360, 1195, 0.3, 5, 0, 1.2);
    else spots.forEach(([x, y], k) => drawCowry(ctx, x + (k % 2) * 6 - 3, y + Math.sin(T * 2 + k) * 1.5, k * 1.1 + 0.3, k * 0.4, 0, 1.3));
  } else {
    const rolling = state.phase === 'roll';
    R.items.forEach((it, k) => {
      const D = R.dur - 0.28, u = rolling ? clamp((R.t - it.dl) / D, 0, 1) : 1;
      const e1 = ease(clamp(u / 0.72, 0, 1)), x = it.x0 + (it.tx - it.x0) * e1, y = it.y0 + (it.ty - it.y0) * e1;
      const bounce = (a, b, h) => (u > a && u < b ? h * 4 * ((u - a) / (b - a)) * (1 - (u - a) / (b - a)) : 0);
      let z = u < 0.72 ? 190 * 4 * (u / 0.72) * (1 - u / 0.72) : bounce(0.72, 0.88, 26) + bounce(0.88, 1, 8);
      if (state.prefs.calm) z = 0;
      const rot = it.r0 + (it.r1 - it.r0) * (1 - (1 - u) * (1 - u)), phiEnd = Math.PI * (2 * it.flips + (it.mouth ? 1 : 0)), phi = phiEnd * (1 - Math.pow(1 - clamp(u / 0.85, 0, 1), 2));
      if (die) { const face = u < 0.85 ? ((Math.floor(R.t * 16) + it.face0) % 6) + 1 : R.value; drawDie(ctx, x, y, rot, face, z, 1.15); }
      else drawCowry(ctx, x, y, rot, phi, z, 1.3);
    });
  }
  // swipe / tap hint
  if (yours) {
    const a = 0.5 + 0.5 * Math.sin(T * 5), y = 1316;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(28,14,8,0.92)'; ctx.beginPath(); ctx.roundRect(110, y - 34, 500, 62, 31); ctx.fill(); ctx.restore();
    ctx.strokeStyle = `rgba(255,224,130,${0.6 + 0.4 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(110, y - 34, 500, 62, 31); ctx.stroke();
    text(die ? 'TAP the die to throw' : 'TAP or SWIPE the cowries to throw', 360, y + 8, 25, '#fff2d0', UI, 700);
    ctx.strokeStyle = `rgba(255,236,170,${0.4 + 0.5 * a})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cy = 1122 - a * 8; ctx.beginPath(); ctx.moveTo(340, cy + 9); ctx.lineTo(360, cy - 3); ctx.lineTo(380, cy + 9); ctx.stroke(); ctx.restore();
  }
}
function drawMedallion(ctx, state, text) {
  const R = state.roll; if (!R || state.phase === 'roll' || state.phase === 'throw') return;
  const v = R.value, y = 1316;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(28,14,8,0.92)'; ctx.beginPath(); ctx.roundRect(150, y - 34, 420, 62, 31); ctx.fill(); ctx.restore();
  ctx.strokeStyle = R.grace ? '#ffe28a' : '#c9982f'; ctx.lineWidth = R.grace ? 4 : 3; ctx.beginPath(); ctx.roundRect(150, y - 34, 420, 62, 31); ctx.stroke();
  const g = ctx.createRadialGradient(196, y - 8, 4, 196, y - 4, 34); g.addColorStop(0, '#fff0b0'); g.addColorStop(1, '#c48a26');
  ctx.beginPath(); ctx.arc(196, y - 3, 28, 0, TAU); ctx.fillStyle = g; ctx.fill();
  text(String(v), 196, y + 9, v > 9 ? 30 : 36, '#3a1c0e', FONT, 700);
  text(R.die ? (R.grace ? 'Six: throw again' : `You get ${v}`) : (R.grace ? `${R.up} up: grace, throw again` : `${R.up} mouths up`), 390, y + 6, 24, '#f6dfae', UI, 700);
}

// ---- title ----------------------------------------------------------------------------------------------------------
function drawTitle(ctx, state, text, shadowText) {
  const T = state.t;
  ctx.save(); ctx.shadowColor = 'rgba(255,190,80,0.6)'; ctx.shadowBlur = 30 + 8 * Math.sin(T * 2);
  text('Pachisi', 360, 190, 148, '#f8e3a8', FONT, 700); ctx.restore();
  shadowText('The royal race of the cross', 360, 250, 38, '#f0c56a', FONT);
  ctx.save(); ctx.strokeStyle = '#c9982f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(150, 92); ctx.lineTo(570, 92); ctx.stroke();
  for (const x of [150, 360, 570]) { ctx.beginPath(); ctx.moveTo(x, 84); ctx.lineTo(x + 8, 92); ctx.lineTo(x, 100); ctx.lineTo(x - 8, 92); ctx.closePath(); ctx.fillStyle = '#e0b04a'; ctx.fill(); } ctx.restore();
  // the plate behind the buttons
  // +80 for the new Auto Play row (ui.js screenButtons title block).
  const has = !!state.saved, top = 1004, h = (has ? 456 : 392) + 80;
  plate(ctx, 36, top, 648, h + 12);
  const s = state.stats; text(s.played ? `${s.played} played · ${s.wins} won` : 'Free preview: 5 minutes of play', 360, top + h - 14, 22, '#c9a86a', UI, 600);
}

// ---- end screens ----------------------------------------------------------------------------------------------------
function drawOver(ctx, state, text, buttonsNow, scrim) {
  const o = state.over, g = state.g, T = state.t; if (!o) return;
  scrim(0.66);
  for (let i = 0; i < 46; i++) { // gold petals
    const r = lcg(i * 7919 + 3), x = r() * W, sp = 60 + r() * 120, y = ((T * sp + r() * H) % (H + 40)) - 20, rot = T * (1 + r() * 2) + i;
    ctx.save(); ctx.translate(x + Math.sin(T + i) * 20, y); ctx.rotate(rot); ctx.fillStyle = [ '#f3cc59', '#e0525a', '#f6e8c0', '#5fb072', '#6577c4'][i % 5]; ctx.globalAlpha = 0.85; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
  drawPanel(ctx, 60, 330, 600, 920);
  const w = g.players[o.winner];
  drawPawn(ctx, w.arm, 360, 570, 3.2, Math.abs(Math.sin(T * 3)) * 22);
  text(o.youWon ? 'You win!' : `${w.name} wins!`, 360, 680, 78, '#7a1a20', FONT, 700);
  let y = 760;
  o.rank.forEach((r, k) => { const p = g.players[r.pl]; drawPawn(ctx, p.arm, 150, y + 8, 0.9, 0); text(`${k + 1}.  ${p.name}`, 190, y - 4, 27, INK, UI, 700, 'left'); text(`${r.home} of ${g.n} home`, 620, y - 4, 24, '#7a1a20', UI, 600, 'right'); y += 58; });
  buttonsNow();
}
function drawDailyDone(ctx, state, text, wrap, buttonsNow) {
  const D = state.dl, s = state.stats; plate(ctx, 36, 560, 648, 790);
  text('Daily race complete', 360, 632, 50, '#f6dfae', FONT);
  text(`Your score ${D.score}`, 360, 720, 46, '#fff2d0', UI, 700);
  text(`Best possible today: ${D.best}`, 360, 768, 28, '#f0c56a', UI, 600);
  for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(230 + k * 130, 860); ctx.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 22 : 50, a = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = k < D.stars ? '#f6d045' : 'rgba(255,255,255,0.14)'; ctx.fill(); ctx.strokeStyle = '#c9982f'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
  wrap(`${D.caps} capture${D.caps === 1 ? '' : 's'}, ${D.homes} pawn${D.homes === 1 ? '' : 's'} home. Streak: ${s.streak} day${s.streak === 1 ? '' : 's'}. A new race tomorrow.`, 360, 980, 26, 560, '#f6dfae', 34);
  buttonsNow();
}
