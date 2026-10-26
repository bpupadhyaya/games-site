// Drawing for every scene. Reads the game state, never changes it (apart from the document scroll bookkeeping in docview).
import { PAL, UI, DISPLAY, KIND_COL, drawBackground, drawPit, drawDrummer, drawAthlete, drawGlyph, poseFor, pitSpot, drawParticles, rgba, CUE_K, ATH_K, CUE_H } from './art.js';
import { txt, button, panel, rrect, star, wrap, embossText } from './ui.js';
import { renderDoc } from './docview.js';
import { drawCredit, drawLockup, drawMoreLine } from './brand.js';
import { PIECES, KIND_BY_ID, APPROACH, UNISON, SCORE, comboMult, describePhrase, parsePiece } from './music.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { inRect, gl } from './layout.js';

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
const HOW = { tap: 'TAP', l: 'SWIPE LEFT', r: 'SWIPE RIGHT', u: 'SWIPE UP', d: 'SWIPE DOWN', hold: 'HOLD, THEN LET GO', whirl: 'DRAW CIRCLES' };
const ACTION_LABEL = { resume: 'Resume', restart: 'Restart', listen: 'Listen again', next: 'Next piece', quit: 'Leave piece' };
const labelOf = (s) => (s || '').toUpperCase();

let settingsBlocks = null;
function settingsDoc(st) {
  if (!settingsBlocks) {
    const p = st.prefs;
    settingsBlocks = [
      { row: 'sound', label: 'Sound', kind: 'toggle', val: () => p.sound },
      { row: 'timing', label: 'Timing', hint: 'How exact a move has to be', kind: 'cycle', val: () => ['Relaxed', 'Standard', 'Tight'][p.timingIdx] },
      { row: 'think', label: 'Think time', hint: 'Before each phrase', kind: 'stepper', val: () => `${p.thinkSec} s` },
      { row: 'cal', label: 'Latency', hint: 'Shift the beat', kind: 'stepper', val: () => `${p.cal} ms` },
      { row: 'labels', label: 'Move names', hint: 'Names under the glyphs', kind: 'toggle', val: () => p.labels },
      { row: 'calm', label: 'Calm effects', hint: 'Fewer particles, no shake', kind: 'toggle', val: () => p.calm },
      { row: 'haptics', label: 'Vibration', hint: 'On each move, where supported', kind: 'toggle', val: () => p.haptics },
      ...(st.demo ? [] : [{ row: 'restore', label: () => (st.owned ? 'Full game unlocked' : 'Restore purchase'), hint: () => st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Already bought it? Get it back'), kind: 'button', btn: () => (st.restoreBusy ? 'Checking...' : 'Restore'), disabled: () => st.owned || st.restoreBusy }]),
      { row: 'rules', label: 'Rules', hint: 'Every rule of the game', kind: 'button', btn: 'Open' },
    ];
  }
  return { key: 'settings', title: 'Settings', blocks: settingsBlocks };
}

function titleText(ctx, s, x, y, size, color, o = {}) {
  if (color === '#ffd36a') { embossText(ctx, s, x, y, size, o); return; }
  txt(ctx, s, x, y, size, color, { align: 'center', font: DISPLAY, weight: 800, stroke: size * 0.12, strokeColor: 'rgba(6,14,18,0.9)', ...o });
}

function drawScene(ctx, L, t) { drawBackground(ctx, L.w, L.h, t); }
// Scenes with the pit: the 3D room is behind this transparent canvas while it is on; otherwise the painted fallback is drawn.
function drawPitBackdrop(ctx, L, t) {
  if (!gl.on) { drawBackground(ctx, L.w, L.h, t); return; }
  ctx.clearRect(0, 0, L.w, L.h);
  const v = ctx.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.3, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, L.w, L.h);
}
const cueAt = (pit, owner) => pitSpot(pit, owner, pit.cam ? 0.5 : CUE_K, pit.cam ? CUE_H : 0);

// A pit with the eight athletes idling and the drummer, used by menus.
function drawPitScene(ctx, pit, t, o = {}) {
  if (gl.on) return;                       // the 3D pit and athletes are drawn behind this canvas
  drawPit(ctx, pit, { pulse: (Math.sin(t * 3.4) * 0.5 + 0.5) * 0.35 });
  drawDrummer(ctx, pit, { hitL: Math.max(0, Math.sin(t * 6.8)), hitR: Math.max(0, Math.sin(t * 6.8 + Math.PI)) });
  for (let i = 0; i < 8; i++) {
    const p = pitSpot(pit, i, ATH_K), act = o.act ? { kind: ['tap', 'l', 'hold', 'r', 'whirl', 'u', 'tap', 'd'][(Math.floor(t / 1.1) + i) % 8], age: (t % 1.1), dur: 0.9, cw: i % 2 ? 1 : -1 } : null;
    const face = Math.atan2(pit.cy - p.y, pit.cx - p.x);
    drawAthlete(ctx, p.x, p.y, pit.R * 0.125, face, i, poseFor(act, face + Math.PI / 2, t, i));
  }
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const k = clamp01(Math.min(st.toast.t / 0.15, (st.toast.hold - st.toast.t) / 0.3));
  const w = Math.min(L.W, 520), r = { x: L.w / 2 - w / 2, y: L.bot - 150, w, h: 62 };
  ctx.save(); ctx.globalAlpha = k; panel(ctx, r, { fill: 'rgba(8,18,24,0.92)', stroke: rgba(PAL.turq, 0.7), rad: 18 });
  txt(ctx, st.toast.text, L.w / 2, r.y + r.h / 2, 27, PAL.text, { align: 'center', weight: 700, maxW: w - 30 }); ctx.restore();
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function drawTitle(ctx, st, L) {
  const T = L.title, t = st.t;
  drawPitBackdrop(ctx, L, t);
  drawPitScene(ctx, T.pit, t, { act: true });
  titleText(ctx, 'ZURKHANEH', T.name.x, T.name.y, Math.min(96, L.W * 0.2), '#ffd36a', { maxW: L.W - 20 });
  titleText(ctx, 'STRENGTH RHYTHM', T.tag.x, T.tag.y, Math.min(46, L.W * 0.092), PAL.cream, { maxW: L.W - 20 });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, sub: 'Learn, perform or watch', rad: 28 });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'turq', size: 30 });
  button(ctx, T.how, 'How to Play', { kind: 'quiet', size: 27 });
  button(ctx, T.rules, 'Rules', { kind: 'quiet', size: 27 });
  button(ctx, T.about, 'About', { kind: 'quiet', size: 27 });
  button(ctx, T.settings, 'Settings', { kind: 'quiet', size: 27 });
  const lw = Math.min(300, L.W * 0.5);
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lw * 0.2725 - 4, w: lw, h: lw * 0.2725 }, 0.95)) drawCredit(ctx, T.credit.x, T.credit.y - 10, 22);
}

// ---- piece list and page ---------------------------------------------------------------------------------------------------------------
function drawSongs(ctx, st, L) {
  const G = L.songs;
  drawScene(ctx, L, st.t);
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  titleText(ctx, 'CHOOSE A PIECE', G.title.x, G.title.y, 52, PAL.saffron, { maxW: L.W - 340 });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: locked ? 'rgba(8,18,24,0.5)' : 'rgba(10,26,32,0.88)', stroke: rgba(PAL.turq, locked ? 0.2 : 0.55), rad: 22 });
    ctx.fillStyle = rgba(PAL.saffron, locked ? 0.3 : 1); ctx.beginPath(); ctx.arc(r.x + 46, r.y + r.h / 2, 28, 0, TAU); ctx.fill();
    txt(ctx, String(i + 1), r.x + 46, r.y + r.h / 2 + 1, 38, '#2a1606', { align: 'center', font: DISPLAY, weight: 800 });
    const tx = r.x + 94, tw = r.w - 94 - 150;
    txt(ctx, p.name, tx, r.y + r.h * 0.3, Math.min(44, r.h * 0.26), locked ? PAL.dim : PAL.text, { font: DISPLAY, weight: 800, maxW: tw });
    txt(ctx, p.sub, tx, r.y + r.h * 0.56, 24, PAL.dim, { weight: 500, maxW: tw });
    txt(ctx, `${p.bpm} bpm  ·  ${p.bars.length} bars`, tx, r.y + r.h * 0.8, 22, PAL.turq, { weight: 700, maxW: tw });
    for (let k = 0; k < 3; k++) star(ctx, r.x + r.w - 110 + k * 36, r.y + r.h * 0.34, 15, (best.stars ?? 0) > k);
    if (locked) txt(ctx, 'Full game', r.x + r.w - 20, r.y + r.h * 0.78, 22, PAL.saffron, { align: 'right', weight: 800 });
    else if (best.score) txt(ctx, String(best.score), r.x + r.w - 20, r.y + r.h * 0.78, 28, PAL.text, { align: 'right', font: DISPLAY, weight: 800 });
    else txt(ctx, 'not played', r.x + r.w - 20, r.y + r.h * 0.78, 21, PAL.dim, { align: 'right', weight: 500 });
  });
}

function drawPiece(ctx, st, L) {
  const D = L.piece, p = PIECES[st.sel], best = st.best[p.id] ?? {}, t = st.t;
  drawPitBackdrop(ctx, L, t);
  drawPitScene(ctx, D.pit, t, { act: true });
  button(ctx, D.back, 'Pieces', { icon: 'back', kind: 'ghost', size: 28 });
  const info = D.info;
  panel(ctx, info, { fill: 'rgba(8,20,26,0.9)', stroke: rgba(PAL.turq, 0.5) });
  txt(ctx, p.name, info.x + 22, info.y + 40, 48, PAL.saffron, { font: DISPLAY, weight: 800, maxW: info.w - 44 });
  txt(ctx, `${p.bpm} bpm  ·  ${p.bars.length} bars  ·  ${parsePiece(p).length} moves`, info.x + 22, info.y + 86, 25, PAL.turq, { weight: 700, maxW: info.w - 44 });
  ctx.font = `500 25px ${UI}`;
  const lines = wrap(ctx, p.blurb, info.w - 44);
  lines.slice(0, 4).forEach((ln, i) => txt(ctx, ln, info.x + 22, info.y + 132 + i * 34, 25, PAL.text, { weight: 500 }));
  for (let k = 0; k < 3; k++) star(ctx, info.x + 40 + k * 46, info.y + info.h - 46, 19, (best.stars ?? 0) > k);
  txt(ctx, best.score ? `Best ${best.score}` : 'No score yet', info.x + info.w - 22, info.y + info.h - 46, 28, PAL.text, { align: 'right', font: DISPLAY, weight: 800 });
  button(ctx, D.learn, 'Learn', { kind: 'turq', size: 36, sub: 'The drummer calls, you echo' });
  button(ctx, D.perform, 'Perform', { kind: 'primary', size: 36, sub: 'Play it for score and stars' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'quiet', size: 32, sub: 'The circle plays it for you' });
}

// ---- play ------------------------------------------------------------------------------------------------------------------------------
function cueLabel(c) { return HOW[c.kind] ?? ''; }

function drawCues(ctx, pl, pit, now, st) {
  const r = pit.R * 0.15, list = [];
  for (let i = pl.np; i < pl.cues.length; i++) {
    const c = pl.cues[i];
    if (c.t - now > APPROACH) break;
    if (c.done && !(c.j === 'perfect' && now - c.t < 0.18)) continue;
    list.push(c);
  }
  let focus = null;
  for (const c of list) if (!c.done && !c.demo) { focus = c; break; }
  if (!focus) for (const c of list) if (!c.done) { focus = c; break; }
  list.sort((a, b) => b.t - a.t);
  for (const c of list) {
    const p = cueAt(pit, c.owner), q = clamp01((c.t - now) / APPROACH), isF = c === focus;
    const dim = c.demo ? 0.8 : 1;
    const a = (0.45 + 0.55 * (1 - q)) * dim;
    const col = KIND_COL[c.kind];
    const late = Math.max(0, now - c.t);
    ctx.save();
    if (c.done) { ctx.globalAlpha = 1 - late / 0.18; drawGlyph(ctx, p.x, p.y, r * (1 + late * 3), c.kind, { glow: 1, cw: c.cw }); ctx.restore(); continue; }
    // approach ring
    const rr = r * (1 + 2.3 * q);
    ctx.globalAlpha = a * (c.demo ? 0.7 : 1);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(4, r * (isF ? 0.14 : 0.09)); ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke();
    // hold / whirl: progress and end ring
    if (c.long && now >= c.t - 0.02) {
      const k = clamp01((now - c.t) / Math.max(0.1, c.dur));
      ctx.globalAlpha = 1; ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = r * 0.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.28, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
      const er = r * (1 + 1.6 * (1 - k));
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(p.x, p.y, er, 0, TAU); ctx.stroke();
    } else if (c.long) {
      ctx.globalAlpha = a * 0.5; ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = r * 0.1; ctx.setLineDash([r * 0.2, r * 0.2]); ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.28, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = a;
    drawGlyph(ctx, p.x, p.y, r * (isF ? 1.08 : 0.92), c.kind, { glow: isF && !c.demo ? 0.6 + 0.4 * Math.sin(st.t * 8) : 0, cw: c.cw, spin: st.t * 2.5 * c.cw });
    if (isF && st.prefs.labels && !c.demo) txt(ctx, cueLabel(c), p.x, p.y + r * 1.75, Math.max(20, r * 0.46), PAL.text, { align: 'center', weight: 800, stroke: 5, maxW: r * 5 });
    ctx.restore();
  }
}

function drawStrip(ctx, st, L, pl) {
  const S = L.play.strip, labels = pl.hintT > 0;
  panel(ctx, S, { fill: 'rgba(6,16,20,0.62)', rad: 20 });
  txt(ctx, 'COMING UP', S.vertical ? S.x + S.w / 2 : S.x + 16, S.y + 20, 18, PAL.dim, { weight: 800, align: S.vertical ? 'center' : 'left' });
  const next = [];
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') {
    const b0 = pl.auto.phrase * 2;
    for (const c of describePhrase(pl.piece, b0, Math.min(b0 + 2, pl.piece.bars.length)).cues.slice(0, 8)) next.push({ kind: c.kind, cw: c.n % 2 ? 1 : -1 });
  } else for (let i = pl.np; i < pl.cues.length && next.length < 8; i++) { const c = pl.cues[i]; if (!c.done) next.push(c); }
  if (S.vertical) {
    const r = Math.min(30, S.w * 0.2), step = r * 2 + (labels ? 34 : 18), n = Math.min(next.length, Math.floor((S.h - 50) / step));
    for (let i = 0; i < n; i++) {
      const c = next[i], x = S.x + S.w / 2, y = S.y + 52 + r + i * step;
      ctx.save(); ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 0.85 - i * 0.08);
      drawGlyph(ctx, x, y, r * (i === 0 ? 1.1 : 0.9), c.kind, { glow: i === 0 ? 0.5 : 0, cw: c.cw });
      ctx.restore();
      if (labels) txt(ctx, KIND_BY_ID[c.kind].short, x, y + r + 16, 16, PAL.text, { align: 'center', weight: 800, maxW: S.w - 12 });
    }
    if (!n) txt(ctx, 'Last moves', S.x + S.w / 2, S.y + S.h / 2, 22, PAL.dim, { align: 'center', weight: 600, maxW: S.w - 12 });
    return;
  }
  const r = Math.min(30, (S.h - 52) / 2), gap = labels ? 34 : 16, n = Math.min(next.length, Math.floor((S.w - 30) / (r * 2 + gap)));
  const tw = n * (r * 2 + gap) - gap, x0 = S.x + S.w / 2 - tw / 2 + r;
  for (let i = 0; i < n; i++) {
    const c = next[i], x = x0 + i * (r * 2 + gap), y = S.y + 36 + r + (labels ? 0 : 8);
    ctx.save(); ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 0.85 - i * 0.07);
    drawGlyph(ctx, x, y, r * (i === 0 ? 1.1 : 0.9), c.kind, { glow: i === 0 ? 0.5 : 0, cw: c.cw });
    ctx.restore();
    if (labels) txt(ctx, KIND_BY_ID[c.kind].short, x, y + r + 17, 15, PAL.text, { align: 'center', weight: 800, maxW: r * 2 + gap - 4 });
  }
  if (!n) txt(ctx, 'Last moves', S.x + S.w / 2, S.y + S.h / 2 + 8, 26, PAL.dim, { align: 'center', weight: 600 });
}

function drawHud(ctx, st, L, pl) {
  const H = L.play;
  txt(ctx, String(pl.score), H.score.x, H.score.y, L.wide ? 64 : 68, PAL.text, { font: DISPLAY, weight: 800, stroke: 7, maxW: H.score.w });
  if (pl.mode !== 'auto') txt(ctx, `x${comboMult(pl.combo).toFixed(1)}  ·  combo ${pl.combo}`, H.combo.x + 2, H.combo.y, 22, PAL.saffron, { weight: 800, maxW: H.score.w });
  else txt(ctx, 'THE CIRCLE PLAYS', H.combo.x + 2, H.combo.y, 22, PAL.turq, { weight: 800, maxW: H.score.w });
  button(ctx, H.pause, '', { kind: 'quiet', size: 30, rad: 20 });
  ctx.fillStyle = PAL.text; rrect(ctx, { x: H.pause.x + 23, y: H.pause.y + 20, w: 10, h: 32 }, 3); ctx.fill(); rrect(ctx, { x: H.pause.x + 39, y: H.pause.y + 20, w: 10, h: 32 }, 3); ctx.fill();
  button(ctx, H.hint, '?', { kind: pl.hintT > 0 ? 'on' : 'quiet', size: 40, rad: 20 });
  const U = H.unison;
  // carved trough with a brass rim; the fill is a lit gold-to-turquoise inlay
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrect(ctx, { x: U.x - 3, y: U.y - 3 + 3, w: U.w + 6, h: U.h + 6 }, U.h / 2 + 3); ctx.fill();
  const tg = ctx.createLinearGradient(0, U.y, 0, U.y + U.h); tg.addColorStop(0, '#120c08'); tg.addColorStop(1, '#2c1d12');
  ctx.fillStyle = tg; rrect(ctx, U, U.h / 2); ctx.fill();
  const g = ctx.createLinearGradient(U.x, 0, U.x + U.w, 0); g.addColorStop(0, '#1f9a8a'); g.addColorStop(0.6, '#7fe8d4'); g.addColorStop(1, '#ffd86a');
  ctx.fillStyle = g; rrect(ctx, { x: U.x, y: U.y, w: Math.max(U.h, U.w * pl.unison), h: U.h }, U.h / 2); ctx.fill();
  const hl = ctx.createLinearGradient(0, U.y, 0, U.y + U.h); hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = hl; rrect(ctx, { x: U.x, y: U.y, w: Math.max(U.h, U.w * pl.unison), h: U.h }, U.h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(224,176,92,0.85)'; ctx.lineWidth = 2.5; rrect(ctx, U, U.h / 2); ctx.stroke();
  UNISON.layers.forEach((m, i) => { ctx.strokeStyle = pl.layer > i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(U.x + U.w * m, U.y - 3); ctx.lineTo(U.x + U.w * m, U.y + U.h + 3); ctx.stroke(); });
  txt(ctx, 'UNISON', U.x + 14, U.y + U.h / 2 + 1, 17, 'rgba(255,255,255,0.85)', { weight: 800, stroke: 4, strokeColor: 'rgba(0,0,0,0.55)' });
  txt(ctx, `${1 + Math.floor(pl.unison * 7 + 0.15)} of 8`, U.x + U.w - 12, U.y + U.h / 2 + 1, 17, 'rgba(255,255,255,0.9)', { align: 'right', weight: 800, stroke: 4, strokeColor: 'rgba(0,0,0,0.55)' });
}

function drawInfo(ctx, st, L, pl, now) {
  const I = L.play.info; let a = '', b = '';
  const bar = pl.bars.find((q) => now >= q.t0 && now < q.t1) ?? null;
  if (pl.mode === 'learn') {
    const lr = pl.learn;
    if (lr.final) { a = 'FINAL TAKE'; b = 'The whole piece, full tempo'; }
    else { a = bar && bar.seg === 'watch' ? 'WATCH THE DRUMMER' : bar && bar.seg === 'echo' ? 'YOUR TURN' : 'GET READY'; b = `Phrase ${lr.phrase + 1} of ${Math.ceil(pl.piece.bars.length / 2)}  ·  try ${lr.attempt} of 3`; }
  } else if (pl.mode === 'perform') {
    a = bar && bar.count ? 'GET READY' : 'PERFORM'; b = `${pl.piece.name}  ·  ${pl.piece.bpm} bpm`;
  } else { a = 'WATCH AND LEARN'; b = `${pl.piece.name}  ·  phrase ${Math.min(pl.auto.phrase + 1, pl.auto.n)} of ${pl.auto.n}`; }
  const al = I.align, x = I.x;
  txt(ctx, a, x, I.y - 8, 36, a === 'YOUR TURN' ? '#8ef0dc' : PAL.saffron, { align: al, font: DISPLAY, weight: 800, stroke: 6, maxW: I.w });
  txt(ctx, b, x, I.y + 24, 21, PAL.text, { align: al, weight: 600, maxW: I.w });
}

function drawThink(ctx, st, L, pl, card) {
  const A = pl.auto, b0 = A.phrase * 2, b1 = Math.min(b0 + 2, pl.piece.bars.length), ph = describePhrase(pl.piece, b0, b1);
  const c = card(L), u = Math.max(0.72, Math.min(1, c.w / 560));
  panel(ctx, c, { fill: 'rgba(6,18,24,0.94)', stroke: rgba(PAL.turq, 0.8), rad: 24 });
  const head = A.phase === 'think' ? 'THINKING' : 'REVEAL';
  const narrow = c.w < 330;
  txt(ctx, narrow ? head : `${head}  ·  phrase ${A.phrase + 1} of ${A.n}`, c.x + 20, c.y + 34, 30 * u, PAL.saffron, { font: DISPLAY, weight: 800, maxW: c.w - 110 });
  const secs = A.phase === 'think' ? Math.max(0, Math.ceil(A.timer)) : Math.max(0, Math.ceil(2 - A.reveal));
  const rx = c.x + c.w - 40, ry = c.y + 40;
  ctx.strokeStyle = rgba(PAL.turq, 0.35); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(rx, ry, 24, 0, TAU); ctx.stroke();
  const k = A.phase === 'think' ? clamp01(A.timer / Math.max(1, st.prefs.thinkSec)) : clamp01(1 - A.reveal / 2);
  ctx.strokeStyle = PAL.turq; ctx.beginPath(); ctx.arc(rx, ry, 24, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
  txt(ctx, String(secs), rx, ry + 1, 26, PAL.text, { align: 'center', font: DISPLAY, weight: 800 });
  const what = ph.parts.length ? ph.parts.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'a rest';
  const sentence = narrow ? `Phrase ${A.phrase + 1} of ${A.n}. Next: ${what}.` : `Next: ${what}.`;
  const f1 = 26 * u, f2 = 22 * u;
  ctx.font = `600 ${f1}px ${UI}`;
  const l1 = wrap(ctx, sentence, c.w - 40).slice(0, 3);
  l1.forEach((ln, i) => txt(ctx, ln, c.x + 20, c.y + 84 + i * f1 * 1.3, f1, PAL.text, { weight: 600 }));
  const tip = A.phase === 'think' ? `The first move is a ${ph.first}. Tap to skip ahead.` : 'Watch the order the glyphs light up.';
  ctx.font = `500 ${f2}px ${UI}`;
  const l2 = wrap(ctx, tip, c.w - 40).slice(0, 3), y2 = Math.max(c.y + 84 + l1.length * f1 * 1.3 + 12, c.y + c.h - 18 - l2.length * f2 * 1.3);
  l2.forEach((ln, i) => txt(ctx, ln, c.x + 20, y2 + i * f2 * 1.3, f2, PAL.dim, { weight: 500 }));
}

function drawGhosts(ctx, st, pl, pit) {
  const A = pl.auto, b0 = A.phrase * 2, b1 = Math.min(b0 + 2, pl.piece.bars.length), ph = describePhrase(pl.piece, b0, b1);
  const r = pit.R * 0.15, lit = A.phase === 'reveal' ? Math.floor((A.reveal / 2) * (ph.n + 1)) : -1;
  ph.cues.forEach((c, i) => {
    const p = cueAt(pit, (c.n * 3 + 1) % 8);
    ctx.save(); ctx.globalAlpha = A.phase === 'think' ? 0.5 : (i < lit ? 1 : 0.35);
    drawGlyph(ctx, p.x, p.y, r * (i === lit - 1 ? 1.15 : 0.95), c.kind, { glow: i === lit - 1 ? 1 : 0, cw: c.n % 2 ? 1 : -1, spin: st.t * 2 });
    ctx.restore();
    ctx.fillStyle = '#06161a'; ctx.beginPath(); ctx.arc(p.x + r * 0.8, p.y - r * 0.8, r * 0.34, 0, TAU); ctx.fill();
    txt(ctx, String(i + 1), p.x + r * 0.8, p.y - r * 0.8 + 1, r * 0.46, PAL.text, { align: 'center', weight: 800 });
  });
}

function drawPlay(ctx, st, L) {
  const pl = st.pl, H = L.play, pit = H.pit, now = pl.t;
  drawPitBackdrop(ctx, L, st.t);
  ctx.save();
  if (pl.shake > 0 && !st.prefs.calm && !gl.on) ctx.translate(Math.sin(st.t * 90) * pl.shake * 5, Math.cos(st.t * 70) * pl.shake * 4);
  if (!gl.on) drawPit(ctx, pit, { pulse: pl.pulse * 0.6, glow: pl.unison });
  // floor ripples from stomps (seen from the camera's tilt in 3D)
  const sq = pit.cam ? pit.cam.se : 1;
  for (const r of pl.rips) { ctx.strokeStyle = rgba('#fff3d0', (1 - r.age / 0.6) * 0.6); ctx.lineWidth = pit.R * 0.015; ctx.beginPath(); ctx.ellipse(r.x, r.y, pit.R * (0.05 + r.age * 0.3), pit.R * (0.05 + r.age * 0.3) * sq, 0, 0, TAU); ctx.stroke(); }
  if (!gl.on) drawDrummer(ctx, pit, { hitL: pl.drum.l, hitR: pl.drum.r, bell: pl.drum.bell });
  for (let i = 0; i < 8 && !gl.on; i++) {
    const p = pitSpot(pit, i, ATH_K), face = Math.atan2(pit.cy - p.y, pit.cx - p.x), a = pl.acts[i];
    const act = a && a.age >= 0 ? a : null;
    const pose = poseFor(act, face + Math.PI / 2, st.t, i);
    drawAthlete(ctx, p.x, p.y, pit.R * 0.125, face, i, pose, { glow: act && !a.follower ? 0.8 : 0, glowColor: act ? KIND_COL[act.kind] : undefined });
  }
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') drawGhosts(ctx, st, pl, pit);
  else drawCues(ctx, pl, pit, now, st);
  drawParticles(ctx, pl.parts);
  // count-in numbers
  const bar = pl.bars.find((q) => q.count && now >= q.t0 && now < q.t1);
  if (bar && pl.mode !== 'auto') {
    const beat = Math.min(4, Math.floor(((now - bar.t0) / (bar.t1 - bar.t0)) * 4) + 1), ph = ((now - bar.t0) / (bar.t1 - bar.t0) * 4) % 1;
    ctx.save(); ctx.globalAlpha = 1 - ph * 0.5; titleText(ctx, String(beat), pit.cx, pit.cy - pit.R * 0.02, pit.R * (0.5 - ph * 0.08), '#ffffff', {}); ctx.restore();
  }
  // grade pops
  for (const q of pl.pops) { const k = q.age / 0.85; ctx.save(); ctx.globalAlpha = 1 - k * k; txt(ctx, q.text, q.x, q.y - k * 46, q.size, q.col, { align: 'center', font: DISPLAY, weight: 800, stroke: 7 }); ctx.restore(); }
  ctx.restore();
  if (pl.flash > 0 && !st.prefs.calm) { ctx.fillStyle = `rgba(255,60,60,${pl.flash * 0.18})`; ctx.fillRect(0, 0, L.w, L.h); }
  drawHud(ctx, st, L, pl);
  if (!(pl.mode === 'auto' && pl.auto.phase !== 'act' && !L.wide)) drawStrip(ctx, st, L, pl);
  drawInfo(ctx, st, L, pl, now);
  if (pl.banner) { const k = pl.banner.t / 1.6, y = pit.cy - pit.R * 0.95 + (L.wide ? 20 : 0); ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); titleText(ctx, pl.banner.text, L.w / 2, Math.max(L.top + 150, y), 52 + k * 8, '#ffe07a', { maxW: L.W }); ctx.restore(); }
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') drawThink(ctx, st, L, pl, L.thinkCard);
  if (pl.paused) drawPauseMenu(ctx, st, L, L.pauseItems);
}

function drawPauseMenu(ctx, st, L, items) {
  ctx.fillStyle = 'rgba(2,8,10,0.8)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = L.menu(items.length), last = M.btns[M.btns.length - 1];
  panel(ctx, { x: M.x - 18, y: M.y - 112, w: M.w + 36, h: last.y + last.h - M.y + 112 + 24 }, { fill: 'rgba(10,22,28,0.94)', stroke: 'rgba(255,255,255,0.12)', rad: 28 });
  titleText(ctx, 'PAUSED', L.w / 2, M.y - 64, 76, PAL.saffron);
  items.forEach((it, i) => button(ctx, M.btns[i], ACTION_LABEL[it], { kind: it === 'resume' ? 'primary' : it === 'quit' ? 'danger' : 'quiet', size: 32 }));
}

// ---- result -------------------------------------------------------------------------------------------------------------------------
function drawResult(ctx, st, L) {
  const R = st.result, Rr = L.result, p = PIECES[R.piece], t = st.sceneT;
  drawScene(ctx, L, st.t);
  const cx = Rr.stars.x, cy = Rr.stars.y;
  titleText(ctx, labelOf(p.name), L.w / 2 - (L.wide ? L.w * 0.25 : 0), L.top + 56, 52, PAL.saffron, { maxW: L.wide ? L.w * 0.46 : L.W });
  txt(ctx, R.mode === 'learn' ? 'Learn complete' : 'Performance complete', cx, L.top + 108, 26, PAL.dim, { align: 'center', weight: 600 });
  for (let k = 0; k < 3; k++) {
    const on = R.stars > k, grow = clamp01((t - 0.25 - k * 0.3) / 0.25), s = (k === 1 ? 76 : 62) * (on ? 0.5 + 0.5 * grow : 1);
    star(ctx, cx + (k - 1) * 150, cy - (k === 1 ? 30 : 0), s, on, (k - 1) * 0.12);
  }
  titleText(ctx, R.grade, cx, cy + 120, 130, R.stars >= 2 ? '#ffe07a' : PAL.cream);
  const lines = [
    ['Score', String(R.score)], ['Accuracy', `${Math.round(R.acc * 100)}%`], ['Longest combo', String(R.maxCombo)],
    ['Perfect / Great / Good', `${R.counts.perfect} / ${R.counts.great} / ${R.counts.good}`], ['Off / Missed', `${R.counts.off} / ${R.counts.miss}`],
  ];
  const sx = Rr.stats.x, sw = Rr.stats.w;
  let y = Rr.stats.y + (L.wide ? 0 : 20);
  if (R.newBest) { txt(ctx, 'NEW BEST', sx + sw / 2, y - 10, 30, '#ffe07a', { align: 'center', font: DISPLAY, weight: 800 }); y += 42; }
  lines.forEach(([a, b], i) => {
    const yy = y + i * 54;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)'; rrect(ctx, { x: sx, y: yy - 24, w: sw, h: 48 }, 12); ctx.fill();
    txt(ctx, a, sx + 18, yy, 24, PAL.dim, { weight: 600, maxW: sw * 0.5 });
    txt(ctx, b, sx + sw - 18, yy, 28, PAL.text, { align: 'right', font: DISPLAY, weight: 800 });
  });
  button(ctx, Rr.again, 'Play again', { kind: 'primary', size: 34 });
  button(ctx, Rr.songs, 'Pieces', { kind: 'quiet', size: 28 });
  button(ctx, Rr.menu, 'Main menu', { kind: 'quiet', size: 28 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 20);
}

function drawDemoLimit(ctx, st, L) {
  drawScene(ctx, L, st.t);
  const w = Math.min(L.W, 560), r = { x: L.w / 2 - w / 2, y: L.h / 2 - 150, w, h: 300 };
  panel(ctx, r, { fill: 'rgba(8,20,26,0.94)', stroke: rgba(PAL.turq, 0.6) });
  titleText(ctx, 'ENJOYED THE DEMO?', L.w / 2, r.y + 62, 54, PAL.saffron, { maxW: w - 30 });
  ctx.font = `500 27px ${UI}`;
  wrap(ctx, 'The web demo plays the first piece a few times. Get the free app on iPhone and Android for all six pieces, Learn mode and Watch and Learn.', w - 56).forEach((ln, i) => txt(ctx, ln, L.w / 2, r.y + 130 + i * 36, 27, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', L.w / 2, r.y + r.h - 28, 22, PAL.dim, { align: 'center', weight: 600 });
}

// ---- entry ----------------------------------------------------------------------------------------------------------------------------
export function render(ctx, st, L, view, meta, pauseItems, thinkCard) {
  L.pauseItems = st.pl ? pauseItems(st.pl) : [];
  L.thinkCard = thinkCard;
  const sc = st.scene;
  ctx.save();
  if (sc === 'title') drawTitle(ctx, st, L);
  else if (sc === 'songs') drawSongs(ctx, st, L);
  else if (sc === 'piece') drawPiece(ctx, st, L);
  else if (sc === 'play' && st.pl) drawPlay(ctx, st, L);
  else if (sc === 'result' && st.result) drawResult(ctx, st, L);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, st, L);
  else if (sc === 'about' || sc === 'howto' || sc === 'rules' || sc === 'settings') {
    drawScene(ctx, L, st.t);
    let doc;
    if (sc === 'about') doc = { key: 'about', title: 'About', blocks: st.licenses ? [...ABOUT, { h: '3D people and motion: credits' }, ...st.licenses.split(/\n\s*\n/).map((t) => ({ p: t.replace(/^#+\s*/, '').replace(/\n/g, ' ') })).filter((b) => b.p.trim())] : ABOUT };
    else if (sc === 'howto') doc = { key: 'howto', title: 'How to Play', blocks: HOWTO };
    else if (sc === 'settings') doc = settingsDoc(st);
    else { const pg = RULES[Math.min(st.rulesPage, RULES.length - 1)]; doc = { key: `rules${st.rulesPage}`, title: `Rules ${st.rulesPage + 1}/${RULES.length}: ${pg.title}`, blocks: pg.blocks, nav: true, page: st.rulesPage, pages: RULES.length }; }
    renderDoc(ctx, st, L, doc, st.t);
  } else drawScene(ctx, L, st.t);
  drawToast(ctx, st, L);
  ctx.restore();
}
