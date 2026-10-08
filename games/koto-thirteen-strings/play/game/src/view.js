// Drawing for every screen. render() is the single entry point; playing screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, MINCHO, drawRoom, drawStars, drawMiniKoto } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderFree, renderCalib } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PIECES, SPEEDS, TIMING, THINK, NSTR, bridgeU, baseSemi, scaleById, stringsUsed, pieceSeconds, parsePiece } from './music.js';
import { drawCredit, drawMoreLine, edgeStroke } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const bridgesOf = (scale) => Array.from({ length: NSTR }, (_, s) => bridgeU(baseSemi(scale, s)));

function titleText(ctx, cx, y, size, label, sub) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(0.55, '#f2cf86'); g.addColorStop(1, '#d9873f');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.1; ctx.strokeStyle = '#1a0f22'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,190,110,0.5)'; ctx.shadowBlur = size * 0.22; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.62, size * 0.2, PAL.text, { align: 'center', weight: 700, maxW: size * 6 });
}

export function render(ctx, st, L, view, meta, pauseItems, X) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems, X); drawToast(ctx, st, L); return; }
  if (sc === 'free') { renderFree(ctx, st, L, meta, X); drawToast(ctx, st, L); return; }
  if (sc === 'calib') { renderCalib(ctx, st, L); return; }
  meta.previewBadge = null;
  drawRoom(ctx, w + 4, h + 4);
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'songs') renderSongs(ctx, st, L);
  else if (sc === 'piece') renderPiece(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(14,10,36,0.9)', stroke: 'rgba(255,230,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('speed', 'Note speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How long a note takes to reach the ring'),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('labels', 'String numbers', 'toggle', () => p.labels, 'Write 1 to 13 under the string names'),
    row('click', 'Metronome in Learn', 'toggle', () => p.click),
    row('haptics', 'Vibration', 'toggle', () => p.haptics, 'On phones that support it'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and petals'),
    row('think', 'Think time (s)', 'stepper', () => p.think, `Watch and Learn waits this long (${THINK.min} to ${THINK.max})`),
    row('cal', 'Latency (ms)', 'stepper', () => p.cal, 'Sound delay of your device'),
    row('calibrate', 'Calibrate', 'button', () => '', 'Tap along with a pulse', { btn: 'Start' }),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- the little koto of the title and piece screens -------------------------------------------------------------------------------------------------------
function heroKoto(ctx, st, r, scale, focus, vert = false) {
  const ss = Array.from({ length: NSTR }, () => ({ vib: 0, ph: 0, glow: 0, press: 0 }));
  const tt = st.t * 2.2, idx = Math.floor(tt), frac = tt - idx, melody = [5, 6, 5, 3, 4, 3, 1, 0, 2, 4, 6, 4];
  const s0 = melody[idx % melody.length], s1 = melody[(idx + 11) % melody.length];
  ss[s0].vib = Math.exp(-frac * 2.2); ss[s0].glow = Math.exp(-frac * 3); ss[s0].ph = st.t * 60;
  ss[s1].vib = 0.5 * Math.exp(-(frac + 1) * 2.2); ss[s1].ph = st.t * 55;
  const lg = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, r.h * 0.2, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.72);
  lg.addColorStop(0, 'rgba(255,196,120,0.3)'); lg.addColorStop(1, 'rgba(255,196,120,0)');
  ctx.fillStyle = lg; ctx.fillRect(r.x - r.w * 0.3, r.y - r.h, r.w * 1.6, r.h * 3);
  return drawMiniKoto(ctx, r, bridgesOf(scaleById(scale)), { ss, focus, vert });
}

// A piano-roll picture of a piece: one row per string used (high strings on top), one column per beat.
function rollStrip(ctx, p, r) {
  const P = parsePiece(p), total = P.bars * 4, used = P.items.filter((i) => i.s !== undefined).map((i) => i.s), lo = Math.min(...used), hi = Math.max(...used), rows = Math.max(5, hi - lo + 1);
  const pad = 8, W = r.w - pad * 2, H = r.h - pad * 2, rh = H / rows, bw = W / total, rad = Math.max(2.5, Math.min(rh * 0.4, bw * 0.45));
  ctx.fillStyle = 'rgba(255,240,220,0.06)'; rrect(ctx, r, 12); ctx.fill();
  for (let b = 0; b <= P.bars; b++) { ctx.fillStyle = b % 2 ? 'rgba(255,240,220,0.08)' : 'rgba(255,240,220,0.2)'; ctx.fillRect(r.x + pad + b * 4 * bw - 0.75, r.y + pad * 0.5, 1.5, r.h - pad); }
  for (let k = 0; k < rows; k++) { ctx.fillStyle = 'rgba(255,240,220,0.05)'; ctx.fillRect(r.x + pad, r.y + pad + (k + 0.5) * rh - 0.5, W, 1); }
  const yOf = (s) => r.y + pad + (hi - s + 0.5 + (rows - (hi - lo + 1)) / 2) * rh, xOf = (beat) => r.x + pad + beat * bw;
  for (const it of P.items) {
    if (it.kind === 'rest') { if (it.dur >= 2) { ctx.fillStyle = 'rgba(190,225,255,0.14)'; ctx.fillRect(xOf(it.beat) + 1, r.y + pad, it.dur * bw - 2, H); } continue; }
    const x = xOf(it.beat) + rad, y = yOf(it.s);
    if (it.kind === 'sweep') { ctx.fillStyle = '#2fb6a3'; ctx.beginPath(); ctx.arc(x, y, rad * 0.85, 0, TAU); ctx.fill(); continue; }
    ctx.fillStyle = '#d9382b'; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    if (it.p) { ctx.strokeStyle = '#f6d98a'; ctx.lineWidth = Math.max(1.5, rad * 0.35); ctx.beginPath(); ctx.arc(x, y, rad * 1.25, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = 'rgba(217,56,43,0.35)'; ctx.fillRect(x, y - rad * 0.3, Math.max(0, it.dur * bw - rad * 2 - 2), rad * 0.6);
  }
}

// ---- title -----------------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = !L.vert, size = T.size;
  const tcx = wide ? T.hero.x + T.hero.w / 2 : S.x + S.w / 2;
  titleText(ctx, tcx, T.titleY, size, 'KOTO');
  txt(ctx, '琴', tcx + size * 1.85, T.titleY - size * 0.1, size * 0.46, 'rgba(240,214,150,0.5)', { align: 'center', font: MINCHO, weight: 700 });
  txt(ctx, 'THIRTEEN STRINGS', tcx, T.titleY + size * 0.62, Math.max(20, size * 0.16) * Math.min(T.k, 1.5), PAL.gold, { align: 'center', weight: 800, maxW: S.w - 40 });
  txt(ctx, 'Pluck, sweep and press silk strings.', tcx, T.titleY + size * 0.9, Math.max(22, size * 0.14) * Math.min(T.k, 1.5), PAL.text, { align: 'center', weight: 600, maxW: (wide ? T.hero.w : S.w) - 40 });
  heroKoto(ctx, st, T.hero, 'hirajoshi', null, !!T.heroVert);
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44 * T.k, icon: 'play' });
  button(ctx, T.free, 'Free Play', { kind: 'quiet', size: 32 * T.k, icon: 'koto' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30 * T.k, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 * T.k });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 * T.k });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 * T.k });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 * T.k });
  drawCredit(ctx, T.credit.x, T.credit.y, 13);
}

// ---- songs -----------------------------------------------------------------------------------------------------------------------------------------------
function renderSongs(ctx, st, L) {
  const G = L.songs, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a piece', S.x + S.w / 2, G.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(16,10,40,0.78)' }); edgeStroke(ctx, r, 24, 0.28);
    const pad = 22, small = r.h < 250;
    txt(ctx, p.kanji, r.x + r.w - pad - 24, r.y + r.h * (small ? 0.3 : 0.28), small ? 46 : 58, 'rgba(240,214,150,0.55)', { align: 'center', font: MINCHO, weight: 700 });
    txt(ctx, p.name, r.x + pad, r.y + r.h * (small ? 0.28 : 0.2), small ? 34 : 42, PAL.text, { font: DISPLAY, weight: 700, maxW: r.w * 0.62 });
    const row2 = r.y + r.h * (small ? 0.58 : 0.5);
    chip(ctx, r.x + pad, row2, `${p.bpm} bpm`, 22, { fill: 'rgba(255,240,220,0.12)' });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < p.level ? PAL.ember : 'rgba(255,240,220,0.18)'; ctx.beginPath(); ctx.arc(r.x + pad + 130 + k * 22, row2, 7, 0, TAU); ctx.fill(); }
    { const sh = small ? r.h * 0.28 : r.h * 0.26; rollStrip(ctx, p, { x: r.x + pad, y: r.y + r.h - sh - (small ? 52 : 62), w: r.w - pad * 2, h: sh }); }
    drawStars(ctx, r.x + r.w - pad - 56, r.y + r.h - (small ? 26 : 32), small ? 26 : 30, best.stars || 0);
    if (best.score) txt(ctx, `Best ${best.score}`, r.x + pad, r.y + r.h - (small ? 26 : 32), 22, PAL.gold, { weight: 700 });
    if (locked) { ctx.fillStyle = 'rgba(8,6,24,0.6)'; rrect(ctx, r, 24); ctx.fill(); txt(ctx, 'In the full game', r.x + r.w / 2, r.y + r.h / 2, 30, PAL.text, { align: 'center', weight: 800 }); }
  });
}

// ---- piece -----------------------------------------------------------------------------------------------------------------------------------------------
function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], best = st.best[p.id] ?? {}, sc = scaleById(p.scale);
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.name, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 48, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (D.back.w + 30) });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(16,10,40,0.72)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  const pad = 24, gap = clamp(I.h * 0.03, 14, 40);
  txt(ctx, 'TUNING', I.x + pad, I.y + 30, 20, PAL.gold, { weight: 800 });
  txt(ctx, sc.name, I.x + I.w - pad, I.y + 30, 28, PAL.text, { align: 'right', weight: 800, maxW: I.w * 0.6 });
  const kw = I.w - pad * 2, kh = Math.min(kw / 3.3, I.h * 0.3), kr = { x: I.x + pad, y: I.y + 56, w: kw, h: kh };
  heroKoto(ctx, st, { x: kr.x + (kw - kh * 3.3) / 2, y: kr.y, w: kh * 3.3, h: kh }, p.scale, new Set(stringsUsed(p, 0, 2)));
  let y = kr.y + kh + gap;
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, I.w - pad * 2);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + I.w / 2, y + i * 34, 26, PAL.text, { align: 'center', weight: 500 }));
  y += lines.length * 34 + gap;
  const cx = I.x + I.w / 2;
  chip(ctx, cx - 150, y, `${p.bpm} bpm`, 24, { align: 'center' }); chip(ctx, cx, y, '8 bars', 24, { align: 'center' }); chip(ctx, cx + 150, y, `${pieceSeconds(p)} s`, 24, { align: 'center' });
  y += 36 + gap;
  ctx.font = `500 22px ${UI}`;
  const sl = wrap(ctx, `Opening strings lit above. ${sc.blurb}`, I.w - pad * 2);
  sl.forEach((ln, i) => txt(ctx, ln, I.x + I.w / 2, y + i * 29, 22, PAL.dim, { align: 'center', weight: 500 }));
  y += sl.length * 29 + gap;
  const bottomRoom = I.y + I.h - 24 - y - 56;
  if (bottomRoom > 90) { const rh = Math.min(bottomRoom, 340); txt(ctx, 'THE PIECE', I.x + pad, y + 6, 18, PAL.gold, { weight: 800 }); rollStrip(ctx, p, { x: I.x + pad, y: y + 22, w: I.w - pad * 2, h: rh }); y += rh + 22 + gap + 6; }
  if (y < I.y + I.h - 30) {
    if (best.score) { txt(ctx, `Best ${best.score}`, cx - 120, y, 28, PAL.gold, { align: 'center', weight: 800 }); drawStars(ctx, cx + 110, y, 32, best.stars || 0); }
    else txt(ctx, 'No score yet', cx, y, 26, PAL.dim, { align: 'center', weight: 600 });
  }
  ctx.restore();
  button(ctx, D.learn, 'Learn', { kind: 'primary', size: 32, sub: 'Listen, then play it back' });
  button(ctx, D.perform, 'Play', { kind: 'quiet', size: 32, sub: 'The whole piece' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'Finger, string and why' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, pc = PIECES[r.piece];
  const split = L.mode === 'wide' || p.h < 1000;
  panel(ctx, p, { fill: 'rgba(16,10,40,0.88)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, r.mode === 'learn' ? 'FINAL TAKE' : 'RESULT', p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  txt(ctx, pc.name, p.x + p.w / 2, p.y + 98, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1060, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.grade, lx, y, split ? 140 : 160 * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 12 });
  if (r.newBest) chip(ctx, lx, y + (split ? 96 : 100 * k), 'NEW BEST', 24, { align: 'center', fill: PAL.ember, color: '#fff' });
  let ry = split ? p.y + 168 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 34, PAL.text, { align: 'center', weight: 800, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', String(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`); tile(rx0 + (tw + g) * 2, ry, tw, 'BEST COMBO', String(r.maxCombo));
  ry += 126;
  const cw = (rw - g * 4) / 5;
  ['perfect', 'great', 'good', 'off', 'miss'].forEach((kk, i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, (kk === 'off' ? 'near' : kk).toUpperCase(), x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += 108;
  const hw = (rw - g) / 2;
  [['BENDS', `${r.bends} of ${r.bends + r.bendMiss}`], ['SILENCES KEPT', `${r.still} of ${r.still + r.stillBroken}`]].forEach(([lab, val], i) => {
    const x = rx0 + (hw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: hw, h: 70 }, 14); ctx.fill();
    txt(ctx, lab, x + hw / 2, ry + 20, 14, PAL.dim, { align: 'center', weight: 700, maxW: hw - 8 }); txt(ctx, val, x + hw / 2, ry + 48, 26, PAL.text, { align: 'center', weight: 800, maxW: hw - 8 });
  });
  ry += 90;
  if (r.learn && r.learn.acc.length) {
    txt(ctx, 'Phrases', rx0 + 4, ry + 16, 22, PAL.gold, { weight: 800 });
    r.learn.acc.forEach((a, i) => chip(ctx, rx0 + 130 + i * 80, ry + 16, `${Math.round(a * 100)}%`, 22, { fill: a >= 0.75 ? 'rgba(47,182,163,0.45)' : 'rgba(255,240,220,0.14)' }));
  }
  button(ctx, Rr.again, r.mode === 'learn' ? 'Learn again' : 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.songs, 'Pieces', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(16,10,40,0.9)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Koto on iPhone and Android: six pieces, five tunings, sweeps, bends and Watch and Learn.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
