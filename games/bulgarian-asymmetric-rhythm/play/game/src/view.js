// Drawing for every scene. Reads the game state, never changes it (apart from the document scroll bookkeeping in docview).
import { PAL, UI, DISPLAY, KIND_COL, GRADE_COL, drawBackground, drawCloth, drawPad, drawHoro, drawParticles, stitchBorder, rgba, clamp01, ease } from './art.js';
import { drawRow, cellRects } from './rows.js';
import { txt, button, panel, rrect, star, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { drawCredit, drawLockup, drawMoreLine } from './brand.js';
import { PIECES, PADS, PAD_NAME, FLOW, DANCERS, LAYER_NAMES, comboMult, describePhrase, parseBar, barOf, cueCount } from './music.js';
import { ABOUT, HOWTO, RULES, PHRASES } from './content.js';

const TAU = Math.PI * 2;
const ACTION_LABEL = { resume: 'Resume', restart: 'Restart', listen: 'Listen again', next: 'Next piece', quit: 'Leave piece' };
const labelOf = (s) => (s || '').toUpperCase();

const settingsCache = new WeakMap();
function settingsDoc(st) {
  let settingsBlocks = settingsCache.get(st);
  if (!settingsBlocks) {
    const p = st.prefs;
    settingsBlocks = [
      { row: 'sound', label: 'Sound', kind: 'toggle', val: () => p.sound },
      { row: 'timing', label: 'Timing', hint: 'How exact a tap has to be', kind: 'cycle', val: () => ['Relaxed', 'Standard', 'Tight'][p.timingIdx] },
      { row: 'think', label: 'Think time', hint: 'Before each phrase', kind: 'stepper', val: () => `${p.thinkSec} s` },
      { row: 'cal', label: 'Latency', hint: 'Shift the beat', kind: 'stepper', val: () => `${p.cal} ms` },
      { row: 'labels', label: 'Count numbers', hint: '1 2 | 1 2 3 under the cells', kind: 'toggle', val: () => p.labels },
      { row: 'calm', label: 'Calm effects', hint: 'Fewer particles, no shake', kind: 'toggle', val: () => p.calm },
      { row: 'haptics', label: 'Vibration', hint: 'On each tap, where supported', kind: 'toggle', val: () => p.haptics },
      { row: 'calib', label: 'Latency check', hint: 'Tap along with ten ticks', kind: 'button', btn: 'Start' },
      { row: 'rules', label: 'Rules', hint: 'Every rule of the game', kind: 'button', btn: 'Open' },
    ];
    if (!st.demo) {   // a purchase exists only in the store builds
      settingsBlocks.push({ row: 'restore', label: 'Purchases', kind: 'button',
        hint: () => st.restore.msg || (st.restore.owned ? 'Full game unlocked' : 'Bring back an earlier purchase'),
        btn: () => (st.restore.busy ? 'Checking...' : st.restore.owned ? 'Unlocked' : 'Restore purchase') });
    }
    settingsCache.set(st, settingsBlocks);
  }
  return { key: 'settings', title: 'Settings', blocks: settingsBlocks };
}

function titleText(ctx, s, x, y, size, color, o = {}) {
  txt(ctx, s, x, y, size, color, { align: 'center', font: DISPLAY, weight: 700, stroke: size * 0.14, strokeColor: 'rgba(30,6,8,0.92)', ...o });
}
const drawScene = (ctx, L, t, flow = 0.3, hz) => drawBackground(ctx, L.w, L.h, t, { flow, hz });

// What the dancers are doing at song time: an accent envelope from the last group start, the foot that steps, a gentle sway.
function dance(pl, t, flow) {
  const sway = Math.sin(t * 2.1) * (0.5 + flow * 0.5);
  if (!pl) return { bounce: 0, lift: 0, foot: 1, sway };
  const b = pl.bars[viewBar(pl)];
  if (!b || pl.gap) return { bounce: pl.stamp * 0.9, lift: 0, foot: 1, sway };
  const p = (pl.t - b.t0) / b.pd, bar = parseBar(b.spec);
  const i = Math.max(0, Math.min(bar.n - 1, Math.floor(p)));
  let gs = i; while (gs > 0 && !bar.cells[gs].gs) gs -= 1;
  const age = Math.max(0, p - gs), acc = Math.exp(-age * 1.7);
  return { bounce: Math.min(1, acc * 0.8 + pl.stamp * 0.9), lift: acc * (0.5 + 0.5 * flow), foot: ((bar.cells[gs].gi + (b.bar | 0)) % 2) ? 1 : -1, sway };
}
// The row the needle is on: the latest bar that started (a little early, so the rows slide before the first cue).
function viewBar(pl) {
  const bars = pl.bars; let i = Math.max(0, Math.min(pl.bi, bars.length - 1));
  while (i + 1 < bars.length && pl.t >= bars[i + 1].t0 - bars[i + 1].pd * 0.65) i += 1;
  return i;
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
const TITLE_BAR = parseBar('2+2+3 D.DcD.S');
function drawTitleArt(ctx, A, t) {
  // a cloth with a looping bar, and a line of dancers under it, centred in the free space
  const ch = Math.min(A.h * 0.4, 210), dh = Math.min(A.h - ch - 14, 360), block = ch + 14 + dh, y0 = A.y + Math.max(0, (A.h - block) * 0.45);
  const cloth = { x: A.x, y: y0, w: A.w, h: ch };
  drawCloth(ctx, cloth);
  const ph = (t * 0.5) % 1, p = ph * TITLE_BAR.n * 1.08 - 0.3;
  const cues = TITLE_BAR.cells.filter((c) => c.kind).map((c) => ({ i: c.i, kind: c.kind, done: p > c.i + 0.4, j: 'perfect' }));
  drawRow(ctx, TITLE_BAR, { x: cloth.x + 14, y: cloth.y + 24, w: cloth.w - 28, h: cloth.h - 44 }, { cues, p, t, now: p >= 0 && p < TITLE_BAR.n ? Math.round(p) : -1 });
  const hr = { x: A.x, y: cloth.y + cloth.h + 14, w: A.w, h: dh };
  const beat = (t * 5.2) % 7, acc = Math.exp(-((beat % 2.2)) * 1.7);
  if (hr.h > 80) drawHoro(ctx, hr, { count: 7, bounce: acc * 0.8, lift: acc, foot: Math.floor(t * 1.3) % 2 ? 1 : -1, sway: Math.sin(t * 2.1) * 0.8, wave: 0.5 });
  return hr;
}
function drawTitle(ctx, st, L) {
  const T = L.title, t = st.t;
  const ch0 = Math.min(T.art.h * 0.4, 210), dh0 = Math.min(T.art.h - ch0 - 14, 360), blk = ch0 + 14 + dh0, ay = T.art.y + Math.max(0, (T.art.h - blk) * 0.45);
  drawScene(ctx, L, t, 0.6, ay + ch0 + 14 + dh0 * 0.5);
  drawTitleArt(ctx, T.art, t);
  titleText(ctx, 'BULGARIAN', T.name.x, T.name.y, Math.min(92, T.nameW * 0.17), '#ffd36a', { maxW: T.nameW });
  titleText(ctx, 'ASYMMETRIC RHYTHM', T.tag.x, T.tag.y, Math.min(54, T.nameW * 0.092), PAL.cream, { maxW: T.nameW });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, sub: 'Learn, perform or watch', rad: 28 });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'turq', size: 30 });
  button(ctx, T.how, 'How to Play', { kind: 'quiet', size: 27 });
  button(ctx, T.rules, 'Rules', { kind: 'quiet', size: 27 });
  button(ctx, T.about, 'About', { kind: 'quiet', size: 27 });
  button(ctx, T.settings, 'Settings', { kind: 'quiet', size: 27 });
  const lw = Math.min(300, L.W * 0.5);
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lw * 0.2725 - 4, w: lw, h: lw * 0.2725 }, 0.95)) drawCredit(ctx, T.credit.x, T.credit.y - 10, 22);
}

// ---- piece list and page -------------------------------------------------------------------------------------------------------------
function drawSongs(ctx, st, L) {
  const G = L.songs;
  drawScene(ctx, L, st.t, 0.4);
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  titleText(ctx, 'CHOOSE A PIECE', G.title.x, G.title.y, 52, PAL.amber, { maxW: L.W - 340 });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: locked ? 'rgba(30,10,12,0.55)' : 'rgba(36,14,14,0.92)', stroke: rgba(PAL.amber, locked ? 0.2 : 0.55), rad: 22 });
    // the meter, as in a score: 7/8
    const mw = Math.min(110, r.w * 0.2), mr = { x: r.x + 12, y: r.y + 12, w: mw, h: r.h - 24 };
    ctx.fillStyle = locked ? 'rgba(195,32,44,0.35)' : PAL.red; rrect(ctx, mr, 16); ctx.fill();
    stitchBorder(ctx, mr.x + 6, mr.y + 5, mr.w - 12, 9, '#f6e8c9', '#f2b632');
    stitchBorder(ctx, mr.x + 6, mr.y + mr.h - 14, mr.w - 12, 9, '#f6e8c9', '#f2b632');
    txt(ctx, p.meter, mr.x + mr.w / 2, mr.y + mr.h / 2 + 1, Math.min(52, mr.h * 0.46), '#fff4e0', { align: 'center', font: DISPLAY, weight: 700, maxW: mr.w - 12 });
    const tx = r.x + mw + 32, tw = r.w - mw - 32 - 150;
    txt(ctx, p.name, tx, r.y + r.h * 0.3, Math.min(40, r.h * 0.25), locked ? PAL.dim : PAL.text, { font: DISPLAY, weight: 700, maxW: tw });
    txt(ctx, p.sub, tx, r.y + r.h * 0.56, 23, PAL.dim, { weight: 500, maxW: tw });
    txt(ctx, `${p.eps.toFixed(1)} pulses/s  ·  ${p.bars.length} bars`, tx, r.y + r.h * 0.8, 21, PAL.teal, { weight: 700, maxW: tw });
    for (let k = 0; k < 3; k++) star(ctx, r.x + r.w - 110 + k * 36, r.y + r.h * 0.34, 15, (best.stars ?? 0) > k);
    if (locked) txt(ctx, 'Full game', r.x + r.w - 20, r.y + r.h * 0.78, 22, PAL.amber, { align: 'right', weight: 800 });
    else if (best.score) txt(ctx, String(best.score), r.x + r.w - 20, r.y + r.h * 0.78, 26, PAL.text, { align: 'right', weight: 800 });
    else txt(ctx, 'not played', r.x + r.w - 20, r.y + r.h * 0.78, 21, PAL.dim, { align: 'right', weight: 500 });
  });
}

function drawPiece(ctx, st, L) {
  const D = L.piece, p = PIECES[st.sel], best = st.best[p.id] ?? {}, t = st.t;
  drawScene(ctx, L, t, 0.4);
  button(ctx, D.back, 'Pieces', { icon: 'back', kind: 'ghost', size: 28 });
  // the first bar of the piece on a cloth, the needle looping over it
  const bar = barOf(p, 0), dg = D.diagram;
  drawCloth(ctx, dg);
  const ph = (t * 0.35) % 1, np = ph * (bar.n + 1) - 0.4;
  drawRow(ctx, bar, { x: dg.x + 14, y: dg.y + 24, w: dg.w - 28, h: dg.h - 44 }, { cues: bar.cells.filter((c) => c.kind).map((c) => ({ i: c.i, kind: c.kind, done: np > c.i + 0.4, j: 'perfect' })), p: np, t, now: np >= 0 && np < bar.n ? Math.round(np) : -1 });
  if (D.horo.h > 90) drawHoro(ctx, D.horo, { count: 6, bounce: 0.2, lift: 0.2, sway: Math.sin(t * 2) * 0.7, wave: 0.5 });
  const info = D.info;
  panel(ctx, info, { fill: 'rgba(36,14,14,0.93)', stroke: rgba(PAL.amber, 0.5) });
  txt(ctx, p.name, info.x + 22, info.y + 40, 46, PAL.amber, { font: DISPLAY, weight: 700, maxW: info.w - 44 });
  const first = [...new Set(p.bars.map((b) => b.split(' ')[0]))].slice(0, 3).join(', ');
  txt(ctx, `${p.meter}  ·  ${p.eps.toFixed(1)} pulses/s  ·  ${p.bars.length} bars  ·  ${cueCount(p)} cues`, info.x + 22, info.y + 82, 22, PAL.teal, { weight: 700, maxW: info.w - 44 });
  txt(ctx, `Groupings: ${first}`, info.x + 22, info.y + 112, 22, PAL.cream, { weight: 600, maxW: info.w - 44 });
  ctx.font = `500 23px ${UI}`;
  wrap(ctx, p.blurb, info.w - 44).slice(0, 4).forEach((ln, i) => txt(ctx, ln, info.x + 22, info.y + 148 + i * 31, 23, PAL.text, { weight: 500 }));
  for (let k = 0; k < 3; k++) star(ctx, info.x + 40 + k * 46, info.y + info.h - 38, 18, (best.stars ?? 0) > k);
  txt(ctx, best.score ? `Best ${best.score}` : 'No score yet', info.x + info.w - 22, info.y + info.h - 38, 26, PAL.text, { align: 'right', weight: 800 });
  button(ctx, D.learn, 'Learn', { kind: 'turq', size: 34, sub: 'The lead drummer plays, you echo' });
  button(ctx, D.perform, 'Perform', { kind: 'primary', size: 34, sub: 'Play it for score and stars' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'quiet', size: 30, sub: 'The band plays it for you' });
}

// ---- play ------------------------------------------------------------------------------------------------------------------------------
function drawHud(ctx, st, L, pl) {
  const H = L.play, c = H.compact, wideCol = H.wide ? H.flow.w : L.W - (c ? 330 : 190);
  txt(ctx, String(pl.score), H.score.x, H.score.y, H.score.size * 0.9, PAL.text, { weight: 800, stroke: 7, maxW: c ? 230 : wideCol });
  if (pl.mode !== 'auto') txt(ctx, `x${comboMult(pl.combo).toFixed(1)}  ·  combo ${pl.combo}`, H.combo.x, H.combo.y, c ? 19 : 22, PAL.amber, { weight: 800, maxW: c ? 240 : wideCol });
  else txt(ctx, 'THE BAND PLAYS', H.combo.x, H.combo.y, c ? 19 : 22, PAL.teal, { weight: 800, maxW: c ? 240 : wideCol });
  button(ctx, H.pause, '', { kind: 'quiet', size: 30, rad: 20 });
  ctx.fillStyle = PAL.text; rrect(ctx, { x: H.pause.x + 23, y: H.pause.y + 20, w: 10, h: 32 }, 3); ctx.fill(); rrect(ctx, { x: H.pause.x + 39, y: H.pause.y + 20, w: 10, h: 32 }, 3); ctx.fill();
  button(ctx, H.hint, '?', { kind: pl.hintT > 0 ? 'on' : 'quiet', size: 40, rad: 20 });
  const U = H.flow;
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, U, U.h / 2); ctx.fill();
  const g = ctx.createLinearGradient(U.x, 0, U.x + U.w, 0); g.addColorStop(0, '#2fb66a'); g.addColorStop(0.6, '#f2b632'); g.addColorStop(1, '#ee4a3e');
  ctx.fillStyle = g; rrect(ctx, { x: U.x, y: U.y, w: Math.max(U.h, U.w * pl.flow), h: U.h }, U.h / 2); ctx.fill();
  FLOW.layers.forEach((m, i) => { ctx.strokeStyle = pl.layer > i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(U.x + U.w * m, U.y - 3); ctx.lineTo(U.x + U.w * m, U.y + U.h + 3); ctx.stroke(); });
  txt(ctx, 'FLOW', U.x + 14, U.y + U.h / 2 + 1, 16, 'rgba(255,255,255,0.92)', { weight: 800, stroke: 4, strokeColor: 'rgba(0,0,0,0.55)' });
  txt(ctx, LAYER_NAMES[pl.layer], U.x + U.w - 12, U.y + U.h / 2 + 1, 16, 'rgba(255,255,255,0.92)', { align: 'right', weight: 800, stroke: 4, strokeColor: 'rgba(0,0,0,0.55)' });
}

function roleText(pl) {
  const b = pl.bars[viewBar(pl)];
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') return { a: 'WATCH', b: `phrase ${Math.min(pl.auto.phrase + 1, pl.auto.n)} of ${pl.auto.n}` };
  if (!b) return { a: 'GET READY', b: '' };
  const total = pl.piece.bars.length;
  if (b.count) return { a: 'COUNT-IN', b: 'listen for the groups' };
  const n = `bar ${b.bar + 1} of ${total}`;
  if (b.role === 'watch') return { a: 'WATCH', b: `the lead drummer  ·  ${n}` };
  if (b.role === 'echo') return { a: 'YOUR TURN', b: `play it back  ·  ${n}`, you: true };
  if (pl.mode === 'auto') return { a: 'THE BAND', b: n };
  return { a: pl.mode === 'learn' && pl.learn.final ? 'FINAL TAKE' : 'PLAY', b: n };
}

// the numbers (1..4) that a hint puts on the next cues, keyed by bar entry then cell
function hintNums(pl) {
  const out = new Map(); let n = 0;
  for (let i = pl.np; i < pl.cues.length && n < 4; i++) {
    const c = pl.cues[i]; if (c.done || c.demo) continue;
    n += 1; if (!out.has(c.bk)) out.set(c.bk, {}); out.get(c.bk)[c.i] = n;
  }
  return out;
}
function padGlow(pl) {
  const g = { drum: 0, clap: 0, step: 0 };
  if (pl.mode === 'auto') return g;
  const hint = pl.hintT > 0;
  for (let i = pl.np; i < pl.cues.length; i++) {
    const c = pl.cues[i]; if (c.done || c.demo) continue;
    const dt = c.t - pl.t;
    if (dt > 0.5 && !hint) break;
    g[c.pad] = Math.max(g[c.pad], hint ? 1 : 1 - Math.max(0, dt) / 0.5);
    if (hint && i > pl.np + 6) break;
  }
  return g;
}

function drawThink(ctx, st, L, pl) {
  const A = pl.auto, S = L.play.sash, b0 = A.phrase * PHRASES.AUTO_PHRASE, b1 = Math.min(b0 + PHRASES.AUTO_PHRASE, pl.piece.bars.length), ph = describePhrase(pl.piece, b0, b1);
  const band = drawCloth(ctx, S);
  const u = Math.max(0.72, Math.min(1, S.w / 560));
  const head = A.phase === 'think' ? 'THINKING' : 'REVEAL';
  const narrow = S.w < 420;
  txt(ctx, narrow ? head : `${head}  ·  phrase ${A.phrase + 1} of ${A.n}`, S.x + 22, S.y + band + 26, 28 * u, '#7a1a20', { font: DISPLAY, weight: 700, maxW: S.w - 120 });
  const secs = A.phase === 'think' ? Math.max(0, Math.ceil(A.timer)) : Math.max(0, Math.ceil(2 - A.reveal));
  const rx = S.x + S.w - 44, ry = S.y + band + 30;
  ctx.strokeStyle = 'rgba(122,26,32,0.3)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(rx, ry, 22, 0, TAU); ctx.stroke();
  const k = A.phase === 'think' ? clamp01(A.timer / Math.max(1, st.prefs.thinkSec)) : clamp01(1 - A.reveal / 2);
  ctx.strokeStyle = PAL.red; ctx.beginPath(); ctx.arc(rx, ry, 22, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
  txt(ctx, String(secs), rx, ry + 1, 24, '#4a1010', { align: 'center', font: DISPLAY, weight: 700 });
  // the phrase's bars as rows with their cues numbered in playing order
  const nb = b1 - b0, ty = S.y + band + 62, textH = Math.max(70, 100 * u), avail = S.h - (ty - S.y) - band - textH - 8;
  const rh = Math.max(36, Math.min(avail / nb, 120));
  let num = 0;
  const total = ph.n, lit = A.phase === 'reveal' ? Math.floor((A.reveal / 2) * (total + 1)) : -1;
  for (let b = b0; b < b1; b++) {
    const bar = barOf(pl.piece, b), nums = {};
    for (const c of bar.cells) if (c.kind) nums[c.i] = ++num;
    const r = { x: S.x + 16, y: ty + (b - b0) * rh, w: S.w - 32, h: rh - 4 };
    drawRow(ctx, bar, r, { mini: rh < 70, nums, lit: lit < 0 ? 0 : lit, cues: bar.cells.filter((c) => c.kind).map((c) => ({ i: c.i, kind: c.kind, done: false })), t: st.t });
  }
  const what = ph.parts.length ? ph.parts.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'a rest';
  const sentence = `Next: ${what}, grouped ${ph.labels.join(' then ')}.`;
  const f1 = 22 * u;
  ctx.font = `600 ${f1}px ${UI}`;
  const y0 = S.y + S.h - band - textH + 6;
  wrap(ctx, sentence, S.w - 44).slice(0, 2).forEach((ln, i) => txt(ctx, ln, S.x + 22, y0 + i * f1 * 1.3, f1, '#3a1410', { weight: 600 }));
  txt(ctx, A.phase === 'think' ? 'Tap the cloth to skip ahead.' : 'Watch the order the cells light up.', S.x + 22, y0 + f1 * 2.9, 19 * u, '#6a3a24', { weight: 500, maxW: S.w - 44 });
}

// where the 3D set may start: under the sash when it sits above the horo, else at the horo's own top
function horoTop(H) {
  const S = H.sash, h = H.horo;
  if (S && S.y + S.h <= h.y + 4 && S.x < h.x + h.w && S.x + S.w > h.x) return S.y + S.h + 2;
  return h.y;
}

function drawPlay(ctx, st, L) {
  const pl = st.pl, H = L.play, S = H.sash, flowV = pl.flow;
  drawScene(ctx, L, st.t, flowV, H.horo.y + H.horo.h * 0.46);
  ctx.save();
  if (pl.shake > 0 && !st.prefs.calm) ctx.translate(Math.sin(st.t * 90) * pl.shake * 5, Math.cos(st.t * 70) * pl.shake * 4);
  // the horo
  const dn = dance(pl, st.t, flowV);
  drawHoro(ctx, H.horo, { count: pl.horoN, ...dn, wave: 0.5, t: st.t, top: horoTop(H) });
  // pads
  const glow = padGlow(pl);
  for (const k of PADS) {
    const r = H[k];
    drawPad(ctx, r, k, { hit: pl.pad[k], glow: glow[k], t: st.t });
    txt(ctx, PAD_NAME[k], r.x + r.w / 2, r.y + r.h * 0.8, Math.min(30, r.h * 0.2), '#fff4e0', { align: 'center', weight: 800, stroke: 5, strokeColor: 'rgba(30,6,6,0.8)', maxW: r.w - 16 });
  }
  const rt = roleText(pl);
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') drawThink(ctx, st, L, pl);
  else drawSash(ctx, st, L, pl, rt);
  drawParticles(ctx, pl.parts);
  ctx.restore();
  if (pl.flash > 0 && !st.prefs.calm) { ctx.fillStyle = `rgba(255,60,60,${pl.flash * 0.14})`; ctx.fillRect(0, 0, L.w, L.h); }
  drawHud(ctx, st, L, pl);
  if (pl.banner) {
    const k = pl.banner.t / 1.6, y = H.horo.y + Math.min(46, H.horo.h * 0.24), fs = Math.min(54, L.W * 0.08), a = Math.min(1, (1 - k) * 2.2);
    ctx.font = `700 ${fs}px ${DISPLAY}`;
    const tw = Math.min(H.horo.w - 20, ctx.measureText(pl.banner.text).width + 56);
    ctx.save(); ctx.globalAlpha = a;
    panel(ctx, { x: H.horo.x + H.horo.w / 2 - tw / 2, y: y - fs * 0.7, w: tw, h: fs * 1.4 }, { fill: 'rgba(30,8,10,0.82)', stroke: rgba(PAL.amber, 0.8), rad: 18 });
    txt(ctx, pl.banner.text, H.horo.x + H.horo.w / 2, y + 1, fs, '#ffe07a', { align: 'center', font: DISPLAY, weight: 700, maxW: tw - 30 });
    ctx.restore();
  }
  if (pl.paused) drawPauseMenu(ctx, st, L, L.pauseItems);
}

// the sash with its three rows: the bar just played, the bar being played, the bar to come
function drawSash(ctx, st, L, pl, rt) {
  const H = L.play, S = H.sash, c = H.compact;
  const band = drawCloth(ctx, S);
  const headH = c ? 26 : 46;
  const hy = S.y + band + headH / 2 + 4;
  // header: the meter and grouping of the bar being played, what the player is doing, and a warning when the grouping is about to change
  const vb = Math.min(viewBar(pl), pl.bars.length - 1), cur = pl.bars[vb] ?? pl.bars[0];
  const nxt = pl.bars[vb + 1];
  if (cur) {
    const bar = parseBar(cur.spec);
    txt(ctx, `${bar.n}/8`, S.x + 22, hy, c ? 24 : 30, '#7a1a20', { font: DISPLAY, weight: 700 });
    txt(ctx, bar.label, S.x + 22 + (c ? 58 : 72), hy, c ? 20 : 24, '#3a1410', { weight: 800 });
    if (nxt && nxt.label !== cur.label && !nxt.count && st.t % 1 < 0.7) txt(ctx, `next ${nxt.label}`, S.x + 22 + (c ? 150 : 190), hy, c ? 17 : 20, PAL.red, { weight: 800, maxW: S.w * 0.25 });
  }
  txt(ctx, rt.a, S.x + S.w - 20, hy - (rt.b && !c ? 8 : 0), c ? 20 : 24, rt.you ? '#9a1a24' : '#5a2a14', { align: 'right', font: DISPLAY, weight: 700, maxW: S.w * 0.4 });
  if (rt.b && !c) txt(ctx, rt.b, S.x + S.w - 20, hy + 15, 16, '#6a3a24', { align: 'right', weight: 600, maxW: S.w * 0.4 });
  // rows
  const ix = S.x + 14, iw = S.w - 28, iy = S.y + band + headH + 6, ih = S.h - (iy - S.y) - band - 8;
  const sc = c ? { prev: 0.5, next: 0.74 } : { prev: 0.62, next: 0.84 }, gap = 6;
  const hc = Math.min(ih, (ih - gap * 2) / (1 + sc.prev + sc.next)), hp = hc * sc.prev, hn = hc * sc.next;
  const yC = iy + hp + gap + hc / 2, yP = yC - hc / 2 - gap - hp / 2, yN = yC + hc / 2 + gap + hn / 2;
  const states = [ // d = -2 .. 2: centre y, height, alpha
    { y: yP - hp * 0.7, h: hp * 0.8, a: 0 }, { y: yP, h: hp, a: 0.75 }, { y: yC, h: hc, a: 1 }, { y: yN, h: hn, a: 0.9 }, { y: yN + hn * 0.9, h: hn * 0.8, a: 0 },
  ];
  const at = (d) => {
    const x = Math.max(-2, Math.min(2, d)) + 2, i = Math.min(3, Math.floor(x)), f = x - i, A = states[i], B = states[i + 1];
    return { y: A.y + (B.y - A.y) * f, h: A.h + (B.h - A.h) * f, a: A.a + (B.a - A.a) * f };
  };
  // continuous bar position: slides in the short window around each bar change
  let barS = vb;
  if (cur && vb > 0) { const s = clamp01((pl.t - (cur.t0 - cur.pd * 0.65)) / (cur.pd * 0.75)); barS = vb - 1 + ease(s); }
  const hints = pl.hintT > 0 ? hintNums(pl) : null;
  const rows = [];
  ctx.save(); rrect(ctx, { x: S.x + 4, y: iy - 4, w: S.w - 8, h: ih + 8 }, 12); ctx.clip();
  for (let k = Math.max(0, Math.floor(barS) - 2); k <= Math.min(pl.bars.length - 1, Math.ceil(barS) + 2); k++) {
    const d = k - barS; if (d < -2 || d > 2) continue;
    const g = at(d), b = pl.bars[k]; if (g.a <= 0.01) continue;
    const rect = { x: ix, y: g.y - g.h / 2, w: iw, h: g.h };
    const isNow = k === vb, p = isNow ? (pl.t - b.t0) / b.pd : null;
    const bar = parseBar(b.spec);
    const geo = drawRow(ctx, bar, rect, {
      cues: b.cues, alpha: g.a, t: st.t, p: isNow && p > -1 && p < bar.n + 0.5 ? p : null, now: isNow && p >= -0.5 && p < bar.n - 0.5 ? Math.max(0, Math.round(p)) : -1,
      nums: hints?.get(k), hot: hints?.get(k) ? new Set(Object.keys(hints.get(k)).map(Number)) : null, mini: false,
      noCounts: !st.prefs.labels,
    });
    rows.push({ k, geo, a: g.a });
  }
  ctx.restore();
  // grade words rise from the cell that was played
  for (const q of pl.pops) {
    const r = rows.find((x) => x.k === q.bk); if (!r) continue;
    const cell = r.geo.cells[q.i]; if (!cell) continue;
    const k = q.age / 0.6;
    ctx.save(); ctx.globalAlpha = (1 - k * k) * r.a;
    ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(2, r.geo.cw * 0.07 * (1 - k)); ctx.beginPath(); ctx.arc(cell.cx, cell.cy, r.geo.cw * (0.5 + 0.55 * k), 0, TAU); ctx.stroke();
    if (q.text !== 'PERFECT') txt(ctx, q.text, cell.cx, cell.y + cell.h * 0.05 - k * 26, Math.min(28, Math.max(14, r.geo.cw * 0.3)), q.col, { align: 'center', font: DISPLAY, weight: 800, stroke: 6, strokeColor: 'rgba(30,6,8,0.9)', maxW: r.geo.cw * 1.9 });
    ctx.restore();
  }
}

function drawPauseMenu(ctx, st, L, items) {
  ctx.fillStyle = 'rgba(14,4,4,0.76)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = L.menu(items.length);
  titleText(ctx, 'PAUSED', L.w / 2, M.y - 64, 76, PAL.amber);
  items.forEach((it, i) => button(ctx, M.btns[i], ACTION_LABEL[it], { kind: it === 'resume' ? 'primary' : it === 'quit' ? 'danger' : 'quiet', size: 32 }));
}

// ---- result -------------------------------------------------------------------------------------------------------------------------
// The performance as embroidery: one row of cells per bar, stitched where it was played.
function drawSummaryCloth(ctx, r, rows) {
  drawCloth(ctx, r);
  const band = Math.max(10, Math.min(22, r.h * 0.07));
  const inner = { x: r.x + 14, y: r.y + band + 8, w: r.w - 28, h: r.h - band * 2 - 16 };
  const umax = Math.max(...rows.map((row) => { const b = parseBar(row.spec); return b.n + (b.n - b.g.length) * 0.1 + (b.g.length - 1) * 0.52; }));
  // choose how many columns of bars give the biggest cells
  let best = { cols: 1, cell: 0 };
  for (let cols = 1; cols <= 4; cols++) {
    const per = Math.ceil(rows.length / cols), cw = (inner.w - (cols - 1) * 18) / cols, cell = Math.min(inner.h / per / 1.16, cw / umax);
    if (cell > best.cell) best = { cols, cell };
  }
  const cols = best.cols, per = Math.ceil(rows.length / cols), rh = inner.h / per, cw = (inner.w - (cols - 1) * 18) / cols;
  rows.forEach((row, i) => {
    const col = Math.floor(i / per), ri = i % per, bar = parseBar(row.spec);
    const cues = row.cells.map((c, ci) => (c ? { i: ci, kind: c.kind, done: true, j: c.j } : null)).filter(Boolean);
    drawRow(ctx, bar, { x: inner.x + col * (cw + 18), y: inner.y + ri * rh, w: cw, h: rh * 0.86 }, { mini: true, cues });
  });
}
function drawResult(ctx, st, L) {
  const R = st.result, Rr = L.result, p = PIECES[R.piece], t = st.sceneT;
  drawScene(ctx, L, st.t, 0.7);
  const cx = Rr.stars.x, cy = Rr.stars.y;
  titleText(ctx, labelOf(p.name), L.w / 2 - (L.side ? L.w * 0.25 : 0), L.top + 52, 46, PAL.amber, { maxW: L.side ? L.w * 0.46 : L.W });
  txt(ctx, R.mode === 'learn' ? 'Learn complete' : 'Performance complete', cx, L.top + 100, 26, PAL.cream, { align: 'center', weight: 600 });
  for (let k = 0; k < 3; k++) {
    const on = R.stars > k, grow = clamp01((t - 0.25 - k * 0.3) / 0.25), s = (k === 1 ? 70 : 56) * (on ? 0.5 + 0.5 * grow : 1);
    star(ctx, cx + (k - 1) * 140, cy - (k === 1 ? 26 : 0), s, on, (k - 1) * 0.12);
  }
  titleText(ctx, R.grade, cx, cy + 106, 78, R.stars >= 2 ? '#ffe07a' : PAL.cream);
  const lines = [
    ['Score', String(R.score)], ['Accuracy', `${Math.round(R.acc * 100)}%`], ['Longest combo', String(R.maxCombo)],
    ['Perfect / Great / Good', `${R.counts.perfect} / ${R.counts.great} / ${R.counts.good}`], ['Off / Missed', `${R.counts.off} / ${R.counts.miss}`],
  ];
  const sx = Rr.stats.x, sw = Rr.stats.w;
  let y = Rr.stats.y + (L.wide ? 0 : 20);
  const rh = Rr.rowH ?? 54;
  panel(ctx, { x: sx - 10, y: y - 70, w: sw + 20, h: rh * 5 + 96 }, { fill: 'rgba(30,10,12,0.78)', rad: 22 });
  if (R.newBest) { txt(ctx, 'NEW BEST', sx + sw / 2, y - 14, 30, '#ffe07a', { align: 'center', font: DISPLAY, weight: 700 }); y += 30; }
  lines.forEach(([a, b], i) => {
    const yy = y + i * rh;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'; rrect(ctx, { x: sx, y: yy - rh * 0.44, w: sw, h: rh * 0.89 }, 12); ctx.fill();
    txt(ctx, a, sx + 18, yy, 24, PAL.dim, { weight: 600, maxW: sw * 0.5 });
    txt(ctx, b, sx + sw - 18, yy, 27, PAL.text, { align: 'right', weight: 800 });
  });
  if (R.rows && Rr.cloth.h > 70) drawSummaryCloth(ctx, Rr.cloth, R.rows);
  button(ctx, Rr.again, 'Play again', { kind: 'primary', size: 34 });
  button(ctx, Rr.songs, 'Pieces', { kind: 'quiet', size: 28 });
  button(ctx, Rr.menu, 'Main menu', { kind: 'quiet', size: 28 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 20);
}

function drawDemoLimit(ctx, st, L) {
  drawScene(ctx, L, st.t, 0.4);
  const w = Math.min(L.W, 560), r = { x: L.w / 2 - w / 2, y: L.h / 2 - 150, w, h: 300 };
  panel(ctx, r, { fill: 'rgba(36,14,14,0.95)', stroke: rgba(PAL.amber, 0.6) });
  titleText(ctx, 'ENJOYED THE DEMO?', L.w / 2, r.y + 62, 52, PAL.amber, { maxW: w - 30 });
  ctx.font = `500 27px ${UI}`;
  wrap(ctx, 'The web demo plays the first piece a few times. Get the free app on iPhone and Android for all six pieces, Learn mode and Watch and Learn.', w - 56).forEach((ln, i) => txt(ctx, ln, L.w / 2, r.y + 130 + i * 36, 27, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', L.w / 2, r.y + r.h - 28, 22, PAL.dim, { align: 'center', weight: 600 });
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const k = clamp01(Math.min(st.toast.t / 0.15, (st.toast.hold - st.toast.t) / 0.3));
  const w = Math.min(L.W, 560), r = { x: L.w / 2 - w / 2, y: L.bot - 150, w, h: 62 };
  ctx.save(); ctx.globalAlpha = k; panel(ctx, r, { fill: 'rgba(30,10,12,0.95)', stroke: rgba(PAL.amber, 0.7), rad: 18 });
  txt(ctx, st.toast.text, L.w / 2, r.y + r.h / 2, 26, PAL.text, { align: 'center', weight: 700, maxW: w - 30 }); ctx.restore();
}

function drawCalib(ctx, st, L) {
  drawScene(ctx, L, st.t, 0.3);
  const c = st.calib; if (!c) return;
  button(ctx, L.songs.back, 'Back', { kind: 'quiet', size: 28, icon: 'back' });
  titleText(ctx, 'LATENCY CHECK', L.w / 2, L.top + 52, 46, PAL.amber);
  const W = Math.min(L.W, 600), cx = L.w / 2, cy = L.h * 0.46, y0 = L.top + 112;
  ctx.font = `600 28px ${UI}`;
  const lines = wrap(ctx, c.done ? c.msg : (c.t < 1 ? 'Tap anywhere, in time with each tick. Use a quiet place.' : 'Keep tapping with the ticks.'), W);
  lines.forEach((ln, i) => txt(ctx, ln, cx, y0 + i * 38, 28, PAL.text, { align: 'center', weight: 600, maxW: W }));
  let near = 9; for (const b of c.beats) near = Math.min(near, Math.abs(c.t - b));
  const k = clamp01(1 - near / 0.25), r = 90 + 40 * k + (c.flash || 0) * 18;
  ctx.fillStyle = rgba(PAL.amber, 0.15 + 0.5 * k); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(PAL.amber, 0.9); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, TAU); ctx.stroke();
  const n = Math.min(c.beats.length, c.beats.filter((b) => b < c.t).length);
  txt(ctx, `${n} / ${c.beats.length}`, cx, cy + 180, 34, PAL.dim, { align: 'center', weight: 700 });
}

// ---- entry ----------------------------------------------------------------------------------------------------------------------------
export function render(ctx, st, L, view, meta, pauseItems) {
  L.pauseItems = st.pl ? pauseItems(st.pl) : [];
  // the kit's "Preview 1:29" pill: top centre normally, under the flow bar when the sash fills the left column
  meta.previewBadge = L.play.wide ? { x: L.play.flow.x, y: L.play.flow.y + L.play.flow.h + 8, align: 'left' } : null;
  const sc = st.scene;
  ctx.save();
  if (sc === 'title') drawTitle(ctx, st, L);
  else if (sc === 'songs') drawSongs(ctx, st, L);
  else if (sc === 'piece') drawPiece(ctx, st, L);
  else if (sc === 'play' && st.pl) drawPlay(ctx, st, L);
  else if (sc === 'result' && st.result) drawResult(ctx, st, L);
  else if (sc === 'calib') drawCalib(ctx, st, L);
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
void KIND_COL; void GRADE_COL; void DANCERS; void cellRects;
