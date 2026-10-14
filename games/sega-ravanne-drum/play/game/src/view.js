// Drawing for every scene. Reads the game state, never changes it (apart from the document scroll bookkeeping in docview).
import { PAL, UI, DISPLAY, KIND_COL, drawBackground, drawDrum, drawBeam, drawStroke, drawTriangle, drawMaravanne, drawFire, drawDancer, drawParticles, slotAngle, rgba } from './art.js';
import { txt, button, panel, rrect, star, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { drawCredit, drawLockup, drawMoreLine } from './brand.js';
import { PIECES, KIND_BY_ID, APPROACH, HOLD_TAIL, GROOVE, TENSION, comboMult, describePhrase, parsePiece } from './music.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TRACK, CUE_OUT } from './layout.js';

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
const ACTION_LABEL = { resume: 'Resume', restart: 'Restart', listen: 'Listen again', next: 'Next piece', quit: 'Leave piece' };
const PAD_OF = { boom: 'drum', slap: 'drum', ting: 'tri', shake: 'shk', warm: 'fire' };
const SHORT = { boom: 'BOOM', slap: 'SLAP', ting: 'TING', shake: 'SHAKE', warm: 'WARM' };
const labelOf = (s) => (s || '').toUpperCase();

let settingsBlocks = null, settingsDemo = null;
function settingsDoc(st) {
  if (!settingsBlocks || settingsDemo !== st.demo) {
    settingsDemo = st.demo;
    settingsBlocks = [
      { row: 'sound', label: 'Sound', kind: 'toggle', val: (s) => s.prefs.sound },
      { row: 'timing', label: 'Timing', hint: 'How exact a stroke has to be', kind: 'cycle', val: (s) => ['Relaxed', 'Standard', 'Tight'][s.prefs.timingIdx] },
      { row: 'think', label: 'Think time', hint: 'Watch and Learn, before each phrase', kind: 'stepper', val: (s) => `${s.prefs.thinkSec} s` },
      { row: 'cal', label: 'Latency', hint: 'Shift the beat for your device', kind: 'stepper', val: (s) => `${s.prefs.cal} ms` },
      { row: 'labels', label: 'Stroke names', hint: 'Name of the next stroke on the rim', kind: 'toggle', val: (s) => s.prefs.labels },
      { row: 'calm', label: 'Calm effects', hint: 'Fewer particles, no shake', kind: 'toggle', val: (s) => s.prefs.calm },
      { row: 'haptics', label: 'Vibration', hint: 'On each stroke, where supported', kind: 'toggle', val: (s) => s.prefs.haptics },
      { row: 'rules', label: 'Rules', hint: 'Every rule of the game', kind: 'button', btn: 'Open' },
      ...(st.demo ? [] : [{ row: 'restore', label: 'Restore purchase', hint: (s) => s.restore.owned ? 'Full game unlocked' : (s.restore.msg || 'Get a past purchase back'), kind: 'button', btn: (s) => s.restore.busy ? 'Checking' : s.restore.owned ? 'Unlocked' : 'Restore' }]),
    ];
  }
  return { key: 'settings', title: 'Settings', blocks: settingsBlocks };
}

function titleText(ctx, s, x, y, size, color, o = {}) {
  txt(ctx, s, x, y, size, color, { align: 'center', font: DISPLAY, weight: 700, stroke: size * 0.14, strokeColor: 'rgba(24,6,40,0.92)', ...o });
}
const drawScene = (ctx, L, t, groove = 0.3) => drawBackground(ctx, L.w, L.h, t, { groove });

// The sega dancer: the real 3D person when main.js has installed one (globalThis.__sega3d), else the painted 2D dancer.
function dancer(ctx, x, y, s, beats, o) {
  const f3 = globalThis.__sega3d;
  if (f3 && f3.draw) {
    try { if (f3.draw(ctx, x, y, s, { t: beats, energy: o.energy ?? 0.3, beat: o.beat ?? 0, bounce: o.bounce ?? 0 })) return; }
    catch (err) { console.warn('3D dancer failed, using the 2D picture', err); globalThis.__sega3d = null; }
  }
  drawDancer(ctx, x, y, s, beats, o);
}

// A drum, a beam and some dots that loop, used by menus. A dancer sways behind it.
function drawDrumScene(ctx, d, t, o = {}) {
  const r = d.R;
  const beats = t * 1.7;
  const dy = d.cy - r * 0.95, ds = Math.min(1.5, (dy - (o.minY ?? 0)) / 205);
  if (!o.noDancer && ds >= 0.42) dancer(ctx, d.cx, dy, ds, beats, { energy: 0.7, beat: beats % 1, rate: 1 });
  drawDrum(ctx, d.cx, d.cy, r, { tension: 0.9, pulse: Math.max(0, Math.sin(t * 5.4)) * 0.6, hit: Math.max(0, Math.sin(t * 5.4)) * 0.3 });
  const ph = (t * 0.32) % 1, kinds = ['boom', 'ting', 'slap', 'shake', 'boom', 'slap'], slots = [0, 2, 4, 6, 8, 10];
  slots.forEach((sl, i) => { const a = slotAngle(sl); drawStroke(ctx, d.cx + Math.cos(a) * r * TRACK, d.cy + Math.sin(a) * r * TRACK, r * 0.1, kinds[i], { alpha: 0.9 }); });
  drawBeam(ctx, d.cx, d.cy, r, ph);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const k = clamp01(Math.min(st.toast.t / 0.15, (st.toast.hold - st.toast.t) / 0.3));
  const w = Math.min(L.W, 520), r = { x: L.w / 2 - w / 2, y: L.bot - 150, w, h: 62 };
  ctx.save(); ctx.globalAlpha = k; panel(ctx, r, { fill: 'rgba(20,8,44,0.94)', stroke: rgba(PAL.teal, 0.7), rad: 18 });
  txt(ctx, st.toast.text, L.w / 2, r.y + r.h / 2, 27, PAL.text, { align: 'center', weight: 700, maxW: w - 30 }); ctx.restore();
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function drawTitle(ctx, st, L) {
  const T = L.title, t = st.t;
  drawScene(ctx, L, t, 0.6);
  drawDrumScene(ctx, T.drum, t, { minY: T.tag.y + 34 });
  titleText(ctx, 'SEGA', T.name.x, T.name.y, Math.min(104, L.W * 0.22), '#ffd36a', { maxW: L.W - 20 });
  titleText(ctx, 'RAVANNE DRUM', T.tag.x, T.tag.y, Math.min(52, L.W * 0.1), PAL.cream, { maxW: L.W - 20 });
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
  drawScene(ctx, L, st.t, 0.4);
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  titleText(ctx, 'CHOOSE A PIECE', G.title.x, G.title.y, 52, PAL.amber, { maxW: L.W - 340 });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: locked ? 'rgba(20,8,44,0.55)' : 'rgba(26,10,56,0.9)', stroke: rgba(PAL.teal, locked ? 0.2 : 0.55), rad: 22 });
    ctx.fillStyle = rgba(PAL.amber, locked ? 0.3 : 1); ctx.beginPath(); ctx.arc(r.x + 46, r.y + r.h / 2, 28, 0, TAU); ctx.fill();
    txt(ctx, String(i + 1), r.x + 46, r.y + r.h / 2 + 1, 38, '#2a1606', { align: 'center', font: DISPLAY, weight: 700 });
    const tx = r.x + 94, tw = r.w - 94 - 150;
    txt(ctx, p.name, tx, r.y + r.h * 0.3, Math.min(42, r.h * 0.26), locked ? PAL.dim : PAL.text, { font: DISPLAY, weight: 700, maxW: tw });
    txt(ctx, p.sub, tx, r.y + r.h * 0.56, 24, PAL.dim, { weight: 500, maxW: tw });
    txt(ctx, `${p.bpm} bpm  ·  ${p.bars.length} bars`, tx, r.y + r.h * 0.8, 22, PAL.teal, { weight: 700, maxW: tw });
    for (let k = 0; k < 3; k++) star(ctx, r.x + r.w - 110 + k * 36, r.y + r.h * 0.34, 15, (best.stars ?? 0) > k);
    if (locked) txt(ctx, 'Full game', r.x + r.w - 20, r.y + r.h * 0.78, 22, PAL.amber, { align: 'right', weight: 800 });
    else if (best.score) txt(ctx, String(best.score), r.x + r.w - 20, r.y + r.h * 0.78, 28, PAL.text, { align: 'right', font: DISPLAY, weight: 700 });
    else txt(ctx, 'not played', r.x + r.w - 20, r.y + r.h * 0.78, 21, PAL.dim, { align: 'right', weight: 500 });
  });
}

function drawPiece(ctx, st, L) {
  const D = L.piece, p = PIECES[st.sel], best = st.best[p.id] ?? {}, t = st.t;
  drawScene(ctx, L, t, 0.4);
  drawDrumScene(ctx, D.drum, t, { noDancer: !L.wide });
  button(ctx, D.back, 'Pieces', { icon: 'back', kind: 'ghost', size: 28 });
  const info = D.info;
  panel(ctx, info, { fill: 'rgba(26,10,56,0.92)', stroke: rgba(PAL.teal, 0.5) });
  txt(ctx, p.name, info.x + 22, info.y + 40, 46, PAL.amber, { font: DISPLAY, weight: 700, maxW: info.w - 44 });
  txt(ctx, `${p.bpm} bpm  ·  ${p.bars.length} bars  ·  ${parsePiece(p).length} strokes`, info.x + 22, info.y + 86, 25, PAL.teal, { weight: 700, maxW: info.w - 44 });
  ctx.font = `500 25px ${UI}`;
  wrap(ctx, p.blurb, info.w - 44).slice(0, 4).forEach((ln, i) => txt(ctx, ln, info.x + 22, info.y + 132 + i * 34, 25, PAL.text, { weight: 500 }));
  for (let k = 0; k < 3; k++) star(ctx, info.x + 40 + k * 46, info.y + info.h - 46, 19, (best.stars ?? 0) > k);
  txt(ctx, best.score ? `Best ${best.score}` : 'No score yet', info.x + info.w - 22, info.y + info.h - 46, 28, PAL.text, { align: 'right', font: DISPLAY, weight: 700 });
  button(ctx, D.learn, 'Learn', { kind: 'turq', size: 36, sub: 'The lead drummer calls, you echo' });
  button(ctx, D.perform, 'Perform', { kind: 'primary', size: 36, sub: 'Play it for score and stars' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'quiet', size: 32, sub: 'The band plays it for you' });
}

// ---- play ------------------------------------------------------------------------------------------------------------------------------
function cueState(pl, c, now) {
  // returns null when the dot is not on screen
  const dtB = (c.t - now) / c.bd;
  if (c.done) {
    const age = now - (c.at ?? c.t);
    if (age > 0.4 || age < 0) return null;
    return { dtB, age };
  }
  if (dtB > APPROACH) return null;
  return { dtB, age: -1 };
}

function drawCues(ctx, st, pl, d, now) {
  const r = d.r, dotR = r * 0.115, list = [];
  for (let i = Math.max(0, pl.np - 14); i < pl.cues.length; i++) {
    const c = pl.cues[i];
    if (c.t - now > APPROACH * c.bd) break;
    const s = cueState(pl, c, now);
    if (s) list.push({ c, s });
  }
  let focus = null;
  for (const e of list) if (!e.c.done && !e.c.demo) { focus = e.c; break; }
  // hold arcs first (under the dots)
  for (const { c, s } of list) {
    if (c.kind !== 'warm') continue;
    const a0 = slotAngle(c.slot), a1 = slotAngle(c.slot + c.len - HOLD_TAIL);
    const q = clamp01(s.dtB / APPROACH), fade = c.done ? 1 - clamp01(s.age / 0.4) : 0.35 + 0.5 * (1 - q);
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalAlpha = fade * (c.demo ? 0.6 : 1);
    ctx.strokeStyle = 'rgba(40,14,4,0.55)'; ctx.lineWidth = r * 0.17; ctx.beginPath(); ctx.arc(d.cx, d.cy, r * TRACK, a0, a1); ctx.stroke();
    ctx.strokeStyle = rgba(KIND_COL.warm, 0.95); ctx.lineWidth = r * 0.11; ctx.beginPath(); ctx.arc(d.cx, d.cy, r * TRACK, a0, a1); ctx.stroke();
    const k = clamp01((now - c.t) / Math.max(0.1, c.dur));
    if (now >= c.t - 0.02 && !c.done) { ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.arc(d.cx, d.cy, r * TRACK, a0, a0 + (a1 - a0) * k); ctx.stroke(); }
    ctx.restore();
  }
  for (const { c, s } of list) {
    const a = slotAngle(c.slot), q = clamp01(s.dtB / APPROACH);
    const rad = r * (TRACK + (CUE_OUT - TRACK) * q ** 1.35);
    const x = d.cx + Math.cos(a) * rad, y = d.cy + Math.sin(a) * rad;
    ctx.save();
    if (c.done) {
      const k = clamp01(s.age / 0.4);
      if (c.j === 'miss') { ctx.globalAlpha = 0.5 * (1 - k); ctx.filter = 'grayscale(1)'; drawStroke(ctx, x, y, dotR * 0.9, c.kind, {}); }
      else if (!c.demo) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = GRADE_COL[c.j] ?? '#fff'; ctx.lineWidth = Math.max(3, dotR * 0.2); ctx.beginPath(); ctx.arc(x, y, dotR * (1.1 + k * 1.2), 0, TAU); ctx.stroke(); drawStroke(ctx, x, y, dotR * (1 + k * 0.3), c.kind, { glow: 1 - k }); }
      else { ctx.globalAlpha = 0.8 * (1 - k); drawStroke(ctx, x, y, dotR * (1 + k * 0.3), c.kind, { glow: 0.6 * (1 - k) }); }
      ctx.restore(); continue;
    }
    const isF = c === focus, ap = 0.5 + 0.5 * (1 - q);
    ctx.globalAlpha = ap * (c.demo ? 0.62 : 1);
    if (c.demo) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, dotR * 1.35, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    drawStroke(ctx, x, y, dotR * (isF ? 1.12 : 0.95), c.kind, { glow: isF ? 0.7 + 0.3 * Math.sin(st.t * 8) : 0 });
    ctx.restore();
  }
  // names: next stroke always (when enabled), the next few on a hint
  const names = [];
  if (pl.hintT > 0) { for (let i = pl.np; i < pl.cues.length && names.length < 4; i++) { const c = pl.cues[i]; if (!c.done && !c.demo) names.push(c); } }
  else if (st.prefs.labels && focus) names.push(focus);
  names.forEach((c, i) => {
    const dtB = (c.t - now) / c.bd, q = clamp01(dtB / APPROACH), rad = r * (TRACK + (CUE_OUT - TRACK) * q ** 1.35), a = slotAngle(c.slot);
    const lr = rad + dotR * 2.1, size = Math.max(19, r * 0.08);
    const x = Math.max(d.minX ?? 0, Math.min(d.maxX ?? 1e9, d.cx + Math.cos(a) * lr)), y = d.cy + Math.sin(a) * lr;
    ctx.save(); ctx.globalAlpha = i === 0 ? 1 : 0.85;
    txt(ctx, pl.hintT > 0 ? `${i + 1} ${SHORT[c.kind]}` : SHORT[c.kind], x, y, size, PAL.text, { align: 'center', weight: 800, stroke: 5, strokeColor: 'rgba(30,10,4,0.9)', maxW: r * 0.5 });
    ctx.restore();
  });
}

// Reveal / think: the phrase's strokes lit on the rim in order, second bar on an inner ring.
function drawGhosts(ctx, st, pl, d) {
  const A = pl.auto, b0 = A.phrase * 2, b1 = Math.min(b0 + 2, pl.piece.bars.length), ph = describePhrase(pl.piece, b0, b1);
  const r = d.r, dotR = r * 0.105, lit = A.phase === 'reveal' ? Math.floor((A.reveal / 2) * (ph.n + 1)) : -1;
  ph.cues.forEach((c, i) => {
    const a = slotAngle(c.slot), rad = r * (c.bar === b0 ? TRACK : TRACK - 0.2), x = d.cx + Math.cos(a) * rad, y = d.cy + Math.sin(a) * rad;
    ctx.save(); ctx.globalAlpha = A.phase === 'think' ? 0.5 : (i < lit ? 1 : 0.35);
    drawStroke(ctx, x, y, dotR * (i === lit - 1 ? 1.15 : 0.95) * (c.bar === b0 ? 1 : 0.85), c.kind, { glow: i === lit - 1 ? 1 : 0 });
    ctx.restore();
    ctx.fillStyle = '#1a0a2e'; ctx.beginPath(); ctx.arc(x + dotR * 0.85, y - dotR * 0.85, dotR * 0.38, 0, TAU); ctx.fill();
    txt(ctx, String(i + 1), x + dotR * 0.85, y - dotR * 0.85 + 1, dotR * 0.5, PAL.text, { align: 'center', weight: 800 });
  });
}

function drawHud(ctx, st, L, pl) {
  const H = L.play;
  txt(ctx, String(pl.score), H.score.x, H.score.y, L.wide ? 60 : 66, PAL.text, { font: DISPLAY, weight: 700, stroke: 7, maxW: L.wide ? H.groove.w : L.W - 190 });
  if (pl.mode !== 'auto') txt(ctx, `x${comboMult(pl.combo).toFixed(1)}  ·  combo ${pl.combo}`, H.combo.x + 2, H.combo.y, 22, PAL.amber, { weight: 800, maxW: L.wide ? H.groove.w : L.W - 190 });
  else txt(ctx, 'THE BAND PLAYS', H.combo.x + 2, H.combo.y, 22, PAL.teal, { weight: 800, maxW: L.wide ? H.groove.w : L.W - 190 });
  button(ctx, H.pause, '', { kind: 'quiet', size: 30, rad: 20 });
  ctx.fillStyle = PAL.text; rrect(ctx, { x: H.pause.x + 23, y: H.pause.y + 20, w: 10, h: 32 }, 3); ctx.fill(); rrect(ctx, { x: H.pause.x + 39, y: H.pause.y + 20, w: 10, h: 32 }, 3); ctx.fill();
  button(ctx, H.hint, '?', { kind: pl.hintT > 0 ? 'on' : 'quiet', size: 40, rad: 20 });
  const U = H.groove;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, U, U.h / 2); ctx.fill();
  const g = ctx.createLinearGradient(U.x, 0, U.x + U.w, 0); g.addColorStop(0, '#2fb6a3'); g.addColorStop(0.6, '#ffd37a'); g.addColorStop(1, '#ff8a5c');
  ctx.fillStyle = g; rrect(ctx, { x: U.x, y: U.y, w: Math.max(U.h, U.w * pl.groove), h: U.h }, U.h / 2); ctx.fill();
  GROOVE.layers.forEach((m, i) => { ctx.strokeStyle = pl.layer > i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(U.x + U.w * m, U.y - 3); ctx.lineTo(U.x + U.w * m, U.y + U.h + 3); ctx.stroke(); });
  txt(ctx, 'GROOVE', U.x + 14, U.y + U.h / 2 + 1, 16, 'rgba(255,255,255,0.9)', { weight: 800, stroke: 4, strokeColor: 'rgba(0,0,0,0.55)' });
  txt(ctx, `${['Shuffle', 'Knocks', 'Claps', 'Bell'][pl.layer]}`, U.x + U.w - 12, U.y + U.h / 2 + 1, 16, 'rgba(255,255,255,0.9)', { align: 'right', weight: 800, stroke: 4, strokeColor: 'rgba(0,0,0,0.55)' });
  // skin
  const S = { x: U.x, y: U.y + U.h + 7, w: U.w, h: 13 }, T = pl.tension, slack = T < TENSION.slack;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, S, S.h / 2); ctx.fill();
  ctx.fillStyle = slack ? '#9a8a9a' : '#ffb347'; rrect(ctx, { x: S.x, y: S.y, w: Math.max(S.h, S.w * T), h: S.h }, S.h / 2); ctx.fill();
  txt(ctx, slack ? 'SKIN SLACK: WARM IT' : 'SKIN', S.x + 10, S.y + S.h / 2 + 1, 12.5, 'rgba(255,255,255,0.95)', { weight: 800, stroke: 3, strokeColor: 'rgba(0,0,0,0.6)' });
}

function roleText(pl) {
  const b = pl.bars[pl.bi];
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') return { a: 'WATCH', b: `phrase ${Math.min(pl.auto.phrase + 1, pl.auto.n)} of ${pl.auto.n}` };
  if (!b || pl.gap) return { a: pl.mode === 'learn' && pl.learn.final ? 'FINAL TAKE' : 'GET READY', b: '' };
  const n = `bar ${Math.max(1, b.bar + 1)} of ${pl.piece.bars.length}`;
  if (b.count) return { a: String(Math.min(4, Math.floor(pl.phase * 4) + 1)), b: 'count-in', count: true };
  if (b.role === 'call' || b.role === 'watch') return { a: b.role === 'watch' ? 'WATCH' : 'LISTEN', b: `${b.role === 'watch' ? 'the lead drummer' : 'the band calls'}  ·  ${n}` };
  if (b.role === 'response' || b.role === 'echo') return { a: b.role === 'echo' ? 'ECHO' : 'YOUR TURN', b: `${b.role === 'echo' ? 'play it back' : 'answer the call'}  ·  ${n}`, you: true };
  return { a: pl.mode === 'auto' ? 'PLAY' : 'PLAY', b: n };
}

function drawThink(ctx, st, L, pl, card) {
  const A = pl.auto, b0 = A.phrase * 2, b1 = Math.min(b0 + 2, pl.piece.bars.length), ph = describePhrase(pl.piece, b0, b1);
  const c = card(L), u = Math.max(0.72, Math.min(1, c.w / 560));
  panel(ctx, c, { fill: 'rgba(20,8,44,0.95)', stroke: rgba(PAL.teal, 0.8), rad: 24 });
  const head = A.phase === 'think' ? 'THINKING' : 'REVEAL';
  const narrow = c.w < 330;
  txt(ctx, narrow ? head : `${head}  ·  phrase ${A.phrase + 1} of ${A.n}`, c.x + 20, c.y + 34, 30 * u, PAL.amber, { font: DISPLAY, weight: 700, maxW: c.w - 110 });
  const secs = A.phase === 'think' ? Math.max(0, Math.ceil(A.timer)) : Math.max(0, Math.ceil(2 - A.reveal));
  const rx = c.x + c.w - 40, ry = c.y + 40;
  ctx.strokeStyle = rgba(PAL.teal, 0.35); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(rx, ry, 24, 0, TAU); ctx.stroke();
  const k = A.phase === 'think' ? clamp01(A.timer / Math.max(1, st.prefs.thinkSec)) : clamp01(1 - A.reveal / 2);
  ctx.strokeStyle = PAL.teal; ctx.beginPath(); ctx.arc(rx, ry, 24, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
  txt(ctx, String(secs), rx, ry + 1, 26, PAL.text, { align: 'center', font: DISPLAY, weight: 700 });
  const what = ph.parts.length ? ph.parts.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'a rest';
  const role = ph.call ? ' The band calls, then you answer.' : '';
  const sentence = narrow ? `Phrase ${A.phrase + 1} of ${A.n}. Next: ${what}.` : `Next: ${what}.${role}`;
  const f1 = 26 * u, f2 = 22 * u;
  ctx.font = `600 ${f1}px ${UI}`;
  const l1 = wrap(ctx, sentence, c.w - 40).slice(0, 4);
  l1.forEach((ln, i) => txt(ctx, ln, c.x + 20, c.y + 84 + i * f1 * 1.3, f1, PAL.text, { weight: 600 }));
  const tip = A.phase === 'think' ? `The first stroke is a ${ph.first}. Tap to skip ahead.` : 'Watch the order the strokes light up.';
  ctx.font = `500 ${f2}px ${UI}`;
  const l2 = wrap(ctx, tip, c.w - 40).slice(0, 3), y2 = Math.max(c.y + 84 + l1.length * f1 * 1.3 + 12, c.y + c.h - 18 - l2.length * f2 * 1.3);
  l2.forEach((ln, i) => txt(ctx, ln, c.x + 20, y2 + i * f2 * 1.3, f2, PAL.dim, { weight: 500 }));
}

function nextPads(pl) {
  const set = {};
  for (let i = pl.np; i < pl.cues.length; i++) {
    const c = pl.cues[i]; if (c.done || c.demo) continue;
    if ((c.t - pl.t) / c.bd > 0.42) break;
    set[PAD_OF[c.kind]] = Math.max(set[PAD_OF[c.kind]] ?? 0, 1 - Math.max(0, (c.t - pl.t) / c.bd) / 0.42);
  }
  return set;
}

function drawPlay(ctx, st, L) {
  const pl = st.pl, H = L.play, d = { cx: H.drum.cx, cy: H.drum.cy, r: H.drum.r, minX: L.left + 44, maxX: L.right - 44 }, now = pl.t;
  const beats = pl.t * pl.piece.bpm / 60 * pl.speed;
  drawScene(ctx, L, st.t, pl.groove);
  ctx.save();
  if (pl.shake > 0 && !st.prefs.calm) ctx.translate(Math.sin(st.t * 90) * pl.shake * 5, Math.cos(st.t * 70) * pl.shake * 4);
  // dancer behind the drum
  const hudB = H.groove.y + H.groove.h + 28;
  dancer(ctx, H.dancer.x, H.dancer.y, H.dancer.s, beats, { energy: 0.25 + pl.groove * 0.9, beat: beats % 1, bounce: pl.bounce, rate: 1 });
  const near = nextPads(pl), hint = pl.hintT > 0;
  drawFire(ctx, H.fire, { t: st.t, heat: pl.hot, glow: (near.fire ?? 0) });
  drawTriangle(ctx, H.tri, { hit: pl.pad.tri, glow: hint ? 1 : (near.tri ?? 0) * 0.8, t: st.t });
  drawMaravanne(ctx, H.shk, { hit: pl.pad.shk, glow: hint ? 1 : (near.shk ?? 0) * 0.8, t: st.t });
  const lab = (p, text, below) => txt(ctx, text, p.cx, below ? p.cy + (p.r ?? p.h / 2) + 22 : p.cy - (p.r ?? p.h / 2) - 22, 17, PAL.text, { align: 'center', weight: 800, stroke: 4, strokeColor: 'rgba(20,6,36,0.85)' });
  lab(H.tri, 'TRIANGLE'); lab(H.shk, 'MARAVANNE'); lab(H.fire, 'FIRE');
  drawDrum(ctx, d.cx, d.cy, d.r, { tension: pl.tension, hit: pl.pad.drum * 0.8, pulse: pl.pulse * 0.6, hot: pl.hot });
  // the middle of the drum says whose turn it is
  const rt = pl.paused ? { a: '', b: '' } : roleText(pl);
  ctx.save(); ctx.globalAlpha = rt.count ? 0.9 : 0.78;
  titleText(ctx, rt.a, d.cx, d.cy - (rt.b ? d.r * 0.04 : 0), d.r * (rt.count ? 0.5 : rt.a.length > 5 ? 0.2 : 0.26), rt.you ? '#fff3b0' : '#ffffff', { strokeColor: 'rgba(60,24,6,0.85)', maxW: d.r * 1.0 });
  if (rt.b) txt(ctx, rt.b, d.cx, d.cy + d.r * 0.17, Math.max(17, d.r * 0.075), PAL.cream, { align: 'center', weight: 700, stroke: 4, strokeColor: 'rgba(60,24,6,0.8)', maxW: d.r * 1.1 });
  ctx.restore();
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') drawGhosts(ctx, st, pl, d);
  else { drawCues(ctx, st, pl, d, now); drawBeam(ctx, d.cx, d.cy, d.r, pl.phase, { alpha: pl.gap ? 0.35 : 1 }); }
  drawParticles(ctx, pl.parts);
  for (const q of pl.pops) { const k = q.age / 0.85; ctx.save(); ctx.globalAlpha = 1 - k * k; txt(ctx, q.text, q.x, q.y - k * 46, q.size, q.col, { align: 'center', font: DISPLAY, weight: 700, stroke: 7 }); ctx.restore(); }
  ctx.restore();
  if (pl.flash > 0 && !st.prefs.calm) { ctx.fillStyle = `rgba(255,60,90,${pl.flash * 0.16})`; ctx.fillRect(0, 0, L.w, L.h); }
  drawHud(ctx, st, L, pl);
  if (pl.banner) { const k = pl.banner.t / 1.6, y = Math.max(hudB + 30, d.cy - d.r * 1.15); ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); titleText(ctx, pl.banner.text, L.w / 2, y, 50 + k * 8, '#ffe07a', { maxW: L.W }); ctx.restore(); }
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') drawThink(ctx, st, L, pl, L.thinkCard);
  if (pl.paused) drawPauseMenu(ctx, st, L, L.pauseItems);
}

function drawPauseMenu(ctx, st, L, items) {
  ctx.fillStyle = 'rgba(8,2,20,0.74)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = L.menu(items.length);
  titleText(ctx, 'PAUSED', L.w / 2, M.y - 64, 76, PAL.amber);
  items.forEach((it, i) => button(ctx, M.btns[i], ACTION_LABEL[it], { kind: it === 'resume' ? 'primary' : it === 'quit' ? 'danger' : 'quiet', size: 32 }));
}

// ---- result -------------------------------------------------------------------------------------------------------------------------
function drawResult(ctx, st, L) {
  const R = st.result, Rr = L.result, p = PIECES[R.piece], t = st.sceneT;
  drawScene(ctx, L, st.t, 0.7);
  const cx = Rr.stars.x, cy = Rr.stars.y;
  titleText(ctx, labelOf(p.name), L.w / 2 - (L.wide ? L.w * 0.25 : 0), L.top + 52, 50, PAL.amber, { maxW: L.wide ? L.w * 0.46 : L.W });
  txt(ctx, R.mode === 'learn' ? 'Learn complete' : 'Performance complete', cx, L.top + (Rr.compact ? 96 : 94), 26, PAL.cream, { align: 'center', weight: 600 });
  for (let k = 0; k < 3; k++) {
    const on = R.stars > k, grow = clamp01((t - 0.25 - k * 0.3) / 0.25), ks = Rr.compact ? 0.8 : 1, s = (k === 1 ? 76 : 62) * ks * (on ? 0.5 + 0.5 * grow : 1);
    star(ctx, cx + (k - 1) * 150 * ks, cy - (k === 1 ? 30 * ks : 0), s, on, (k - 1) * 0.12);
  }
  titleText(ctx, R.grade, cx, cy + (Rr.compact ? 98 : 120), Rr.compact ? 104 : 130, R.stars >= 2 ? '#ffe07a' : PAL.cream);
  const lines = [
    ['Score', String(R.score)], ['Accuracy', `${Math.round(R.acc * 100)}%`], ['Longest combo', String(R.maxCombo)],
    ['Perfect / Great / Good', `${R.counts.perfect} / ${R.counts.great} / ${R.counts.good}`], ['Off / Missed', `${R.counts.off} / ${R.counts.miss}`],
  ];
  const sx = Rr.stats.x, sw = Rr.stats.w;
  const row = Rr.compact ? 44 : 54;
  let y = Rr.stats.y + (L.wide ? 0 : 20);
  panel(ctx, { x: sx - 10, y: y - 70, w: sw + 20, h: row * 5 + 96 }, { fill: 'rgba(20,8,44,0.72)', rad: 22 });
  if (R.newBest) { txt(ctx, 'NEW BEST', sx + sw / 2, y - 10, 30, '#ffe07a', { align: 'center', font: DISPLAY, weight: 700 }); y += 22; }
  lines.forEach(([a, b], i) => {
    const yy = y + i * row;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'; rrect(ctx, { x: sx, y: yy - 22, w: sw, h: row - 6 }, 12); ctx.fill();
    txt(ctx, a, sx + 18, yy, 24, PAL.dim, { weight: 600, maxW: sw * 0.5 });
    txt(ctx, b, sx + sw - 18, yy, 28, PAL.text, { align: 'right', font: DISPLAY, weight: 700 });
  });
  button(ctx, Rr.again, 'Play again', { kind: 'primary', size: 34 });
  button(ctx, Rr.songs, 'Pieces', { kind: 'quiet', size: 28 });
  button(ctx, Rr.menu, 'Main menu', { kind: 'quiet', size: 28 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 20);
}

function drawDemoLimit(ctx, st, L) {
  drawScene(ctx, L, st.t, 0.4);
  const w = Math.min(L.W, 560), r = { x: L.w / 2 - w / 2, y: L.h / 2 - 150, w, h: 300 };
  panel(ctx, r, { fill: 'rgba(26,10,56,0.95)', stroke: rgba(PAL.teal, 0.6) });
  titleText(ctx, 'ENJOYED THE DEMO?', L.w / 2, r.y + 62, 52, PAL.amber, { maxW: w - 30 });
  ctx.font = `500 27px ${UI}`;
  wrap(ctx, 'The web demo plays the first piece a few times. Get the full game on iPhone and Android for all six pieces, Learn mode and Watch and Learn.', w - 56).forEach((ln, i) => txt(ctx, ln, L.w / 2, r.y + 130 + i * 36, 27, PAL.text, { align: 'center', weight: 500 }));
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
    drawScene(ctx, L, st.t, 0.3);
    let doc;
    if (sc === 'about') doc = { key: 'about', title: 'About', blocks: ABOUT };
    else if (sc === 'howto') doc = { key: 'howto', title: 'How to Play', blocks: HOWTO };
    else if (sc === 'settings') doc = settingsDoc(st);
    else { const pg = RULES[Math.min(st.rulesPage, RULES.length - 1)]; doc = { key: `rules${st.rulesPage}`, title: `Rules ${st.rulesPage + 1}/${RULES.length}: ${pg.title}`, blocks: pg.blocks, nav: true, page: st.rulesPage, pages: RULES.length }; }
    renderDoc(ctx, st, L, doc, st.t);
  } else drawScene(ctx, L, st.t, 0.3);
  drawToast(ctx, st, L);
  ctx.restore();
}
void KIND_BY_ID;
