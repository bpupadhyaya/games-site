// Drawing for every screen. render() is the single entry point; playing screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, WRAPS, drawBackdrop, drawLyre, drawStars, drawTip } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderFree, renderCalib } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PIECES, QENETS, SPEEDS, TIMING, DUEL, STRING_COUNT, barDur, soundName } from './music.js';
import { drawCredit, drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { lyreXAt } from './layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function titleText(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px ${DISPLAY}`;
  if (maxW && ctx.measureText(label).width > maxW) { size *= maxW / ctx.measureText(label).width; ctx.font = `${size}px ${DISPLAY}`; }
  ctx.lineJoin = 'round';
  // extrusion: stacked darker copies make real thickness, then a soft ground shadow
  const depth = Math.max(4, size * 0.09);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.16; ctx.shadowOffsetY = depth + size * 0.05;
  ctx.fillStyle = '#5a2a06'; ctx.strokeStyle = '#2a1204'; ctx.lineWidth = size * 0.17;
  ctx.strokeText(label, cx, y + depth); ctx.fillText(label, cx, y + depth);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  for (let k = depth; k > 0; k -= 1) { ctx.fillStyle = k > depth * 0.5 ? '#6a3208' : '#9a5410'; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = size * 0.1; ctx.strokeText(label, cx, y + k); ctx.fillText(label, cx, y + k); }
  ctx.lineWidth = size * 0.1; ctx.strokeStyle = '#3a1a06'; ctx.strokeText(label, cx, y);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffd96a'); g.addColorStop(0.62, '#f0a030'); g.addColorStop(1, '#c8641a');
  ctx.shadowColor = 'rgba(255,170,60,0.45)'; ctx.shadowBlur = size * 0.2; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  // lit top edge
  ctx.save(); ctx.beginPath(); ctx.rect(cx - 2000, y - size, 4000, size * 0.62); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, size * 0.018); ctx.strokeText(label, cx, y - size * 0.012); ctx.restore();
  ctx.restore();
}

// A gentle phrase the hero lyre plays by itself (no sound): which strings are ringing at time t.
const ARP = [1, 3, 5, 4, 3, 5, 6, 5, 3, 4, 2, 3];
function heroVib(t) {
  const out = new Array(12).fill(0), step = 0.42, k = Math.floor(t / step);
  for (let j = k; j > k - 6 && j >= 0; j--) { const i = ARP[j % ARP.length], a = Math.exp(-(t - j * step) * 2.6); out[i] = Math.max(out[i], a); }
  return out;
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); drawToast(ctx, st, L); return; }
  if (sc === 'free') { renderFree(ctx, st, L, meta); drawToast(ctx, st, L); return; }
  if (sc === 'calib') { renderCalib(ctx, st, L); return; }
  meta.previewBadge = null;
  drawBackdrop(ctx, w + 20, h + 20, st.t, 0, sc === 'title' ? 0 : 0.28);
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'songs') renderSongs(ctx, st, L);
  else if (sc === 'piece') renderPiece(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: `settings|${st.owned ? 1 : 0}${st.restoreBusy ? 1 : 0}|${st.restoreMsg}`, title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(3,24,22,0.94)', stroke: 'rgba(255,240,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('speed', 'Ring speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How long a ring takes to close'),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('labels', 'Note names', 'toggle', () => p.labels, 'Write the note name on the strings'),
    row('click', 'Click in Learn', 'toggle', () => p.click),
    row('haptics', 'Vibration', 'toggle', () => p.haptics, 'On phones that support it'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks'),
    row('cal', 'Latency (ms)', 'stepper', () => p.cal, 'Sound delay of your device', { }),
    row('calibrate', 'Calibrate', 'button', () => '', 'Tap along with a pulse', { btn: 'Start' }),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [st.owned
      ? row('restore', 'Full game unlocked', 'button', () => '', 'Thank you for playing', { btn: 'Unlocked', disabled: true })
      : row('restore', 'Restore purchase', 'button', () => '', st.restoreMsg || 'Already bought it? Get it back', { btn: st.restoreBusy ? 'Checking...' : 'Restore', disabled: !!st.restoreBusy })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, t = st.t, wide = L.mode === 'wide';
  const sx = wide ? T.hero.cx : S.x + S.w / 2, size = T.size;
  drawLyre(ctx, T.hero, { t, vib: heroVib(t), glow: 0.1 + 0.1 * Math.sin(t * 2) });
  for (let k = 1; k <= STRING_COUNT; k++) { const a = heroVib(t)[k]; if (a > 0.25) drawTip(ctx, lyreXAt(T.hero, k - 1, T.hero.pluckY), T.hero.pluckY, T.hero.cueR * 0.9, a * 0.7); }
  titleText(ctx, sx, T.titleY, size * 1.3, 'KRAR LYRE', (wide ? T.col.x - S.x : S.w) - 50);
  txt(ctx, 'Close the ring. Answer the azmari.', sx, T.titleY + size * 1.2, Math.max(24, size * 0.26), PAL.text, { align: 'center', weight: 700, stroke: 6, maxW: (wide ? T.col.x - S.x : S.w) - 40 });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.duel, 'Echo Duel', { kind: 'quiet', size: 32, icon: 'ear', sub: 'Answer from memory' });
  button(ctx, T.free, 'Compose', { kind: 'quiet', size: 32, icon: 'grid' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'strings' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(250, (wide ? S.w - T.col.x : S.w) * 0.6), lh = lw * 354 / 1296;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - 4 - lh, w: lw, h: lh }, 0.92)) drawCredit(ctx, T.credit.x, T.credit.y, 13);
}

// ---- songs -----------------------------------------------------------------------------------------------------------------------------------------------------
function renderSongs(ctx, st, L) {
  const G = L.songs, S = L.S, duel = st.pick === 'duel';
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, duel ? 'Echo Duel: choose a scale' : 'Choose a piece', S.x + S.w / 2 + G.back.w / 2, G.titleY, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - G.back.w - 70 });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(3,26,24,0.82)' }); edgeStroke(ctx, r, 24, 0.28);
    const pad = 22, small = r.h < 230;
    txt(ctx, p.name, r.x + pad, r.y + r.h * (small ? 0.27 : 0.2), small ? 32 : 38, PAL.text, { font: DISPLAY, weight: 400, maxW: r.w - pad * 2 - 120 });
    // six wrap-coloured dots, the strings this piece uses lit
    const used = new Set(); for (const part of p.parts.player) for (const pat of Object.values(part.pat)) for (const c of pat) { if (c >= '1' && c <= '6') used.add(+c); else if (c >= 'a' && c <= 'f') used.add(c.charCodeAt(0) - 96); }
    for (let k = 1; k <= 6; k++) { ctx.fillStyle = used.has(k) ? WRAPS[k - 1] : 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(r.x + r.w - pad - 10 - (6 - k) * 24, r.y + r.h * (small ? 0.27 : 0.2), 9, 0, Math.PI * 2); ctx.fill(); }
    const row2 = r.y + r.h * (small ? 0.55 : 0.46);
    chip(ctx, r.x + pad, row2, QENETS[p.qenet].name, 22, { fill: 'rgba(255,201,74,0.2)' });
    chip(ctx, r.x + pad + 170, row2, `${p.bpm} bpm`, 22, { fill: 'rgba(255,247,230,0.13)' });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < p.level ? PAL.saffron : 'rgba(255,247,230,0.18)'; ctx.beginPath(); ctx.arc(r.x + r.w - pad - 10 - (4 - k) * 22, row2, 7, 0, Math.PI * 2); ctx.fill(); }
    if (!small) { ctx.font = `500 22px ${UI}`; const lines = wrap(ctx, p.blurb, r.w - pad * 2).slice(0, r.h >= 220 ? 2 : 1); lines.forEach((ln, k) => txt(ctx, ln, r.x + pad, r.y + r.h * 0.64 + k * 28, 22, PAL.dim, { weight: 500, maxW: r.w - pad * 2 })); }
    const stars = duel ? best.duelStars : best.stars;
    drawStars(ctx, r.x + r.w - pad - 56, r.y + r.h - (small ? 26 : 30), small ? 26 : 30, stars || 0);
    const bs = duel ? best.duelRounds && `Best: round ${best.duelRounds}` : best.score && `Best ${best.score}`;
    if (bs) txt(ctx, bs, r.x + pad, r.y + r.h - (small ? 26 : 30), 22, PAL.gold, { weight: 700 });
    if (locked) { ctx.fillStyle = 'rgba(2,14,12,0.66)'; rrect(ctx, r, 24); ctx.fill(); txt(ctx, 'In the full game', r.x + r.w / 2, r.y + r.h / 2, 30, PAL.text, { align: 'center', weight: 800 }); }
  });
}

// ---- piece ------------------------------------------------------------------------------------------------------------------------------------------------------
// A little strip of the piece's busiest four bars: rows are the six strings, columns steps.
function bestWindow(p) {
  let best = 0, bestN = -1;
  for (let b0 = 0; b0 + 4 <= p.bars; b0++) {
    let n = 0;
    for (const part of p.parts.player) for (let b = b0; b < b0 + 4; b++) { const ch = part.form[b]; if (!ch || ch === '.') continue; for (const c of part.pat[ch]) if (c !== '.') n++; }
    if (n > bestN) { bestN = n; best = b0; }
  }
  return best;
}
function patternStrip(ctx, p, x, y, w, rowH, b0) {
  const bars = 4, rows = 6;
  for (let r = 0; r < rows; r++) {
    const k = rows - r, yy = y + r * rowH + rowH / 2;
    ctx.fillStyle = 'rgba(255,247,230,0.06)'; rrect(ctx, { x, y: yy - rowH * 0.4, w, h: rowH * 0.8 }, 8); ctx.fill();
    for (let b = 1; b < bars; b++) { ctx.fillStyle = 'rgba(255,247,230,0.14)'; ctx.fillRect(x + w * b / bars - 1, yy - rowH * 0.4, 2, rowH * 0.8); }
    for (const part of p.parts.player) for (let b = 0; b < bars; b++) {
      const ch = part.form[b0 + b]; if (!ch || ch === '.') continue;
      const pat = part.pat[ch];
      for (let s = 0; s < pat.length; s++) {
        const c = pat[s]; if (c === '.') continue;
        const cx = x + w * (b + (s + 0.5) / p.steps) / bars;
        if ((c >= '1' && c <= '6' && +c === k) || (c >= 'a' && c <= 'f' && c.charCodeAt(0) - 96 === k)) { ctx.fillStyle = WRAPS[k - 1]; ctx.beginPath(); ctx.arc(cx, yy, Math.min(rowH * 0.3, w / bars / p.steps * 0.5), 0, Math.PI * 2); ctx.fill(); }
        else if (c === 'x' && r === rows - 1) { ctx.fillStyle = PAL.hide; rrect(ctx, { x: cx - 5, y: yy - rowH * 0.3, w: 10, h: rowH * 0.6 }, 3); ctx.fill(); }
        else if ('^v~=%$'.includes(c) && r === 0) { ctx.fillStyle = PAL.coral; rrect(ctx, { x: cx - 4, y: yy - rowH * 0.3, w: Math.min(26, w / bars / p.steps * 3), h: rowH * 0.6 }, 5); ctx.fill(); }
      }
    }
  }
}

function gestureCounts(p) {
  const c = { p: 0, s: 0, d: 0 };
  for (const part of p.parts.player) for (let b = 0; b < p.bars; b++) { const ch = part.form[b]; if (!ch || ch === '.') continue; for (const k of part.pat[ch]) { if (k === '.') continue; if (k === 'x') c.d += 1; else if ('^v~=%$'.includes(k)) c.s += 1; else c.p += 1; } }
  return c;
}

function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], best = st.best[p.id] ?? {}, q = QENETS[p.qenet];
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.name, S.x + S.w / 2 + D.back.w / 2, S.y + 12 + D.back.h / 2, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - D.back.w - 70 });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(3,26,24,0.76)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  const pad = 24, gap = clamp(I.h * 0.035, 16, 44);
  txt(ctx, q.name.toUpperCase(), I.x + pad, I.y + 30, 22, PAL.gold, { weight: 800 });
  txt(ctx, q.mood, I.x + I.w - pad, I.y + 30, 24, PAL.text, { align: 'right', weight: 700, maxW: I.w * 0.6 });
  // the six strings as wraps with their note names in this mode
  const cell = (I.w - pad * 2) / 6, br = clamp(Math.min(cell * 0.3, 34), 16, 34), by = I.y + 64 + br;
  for (let k = 1; k <= 6; k++) {
    const cx = I.x + pad + cell * (k - 0.5);
    ctx.strokeStyle = 'rgba(255,248,226,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, by - br - 8); ctx.lineTo(cx, by + br * 1.4); ctx.stroke();
    ctx.fillStyle = WRAPS[k - 1]; ctx.beginPath(); ctx.arc(cx, by, br, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
    txt(ctx, soundName(k, p.qenet), cx, by + 1, br * 0.9, '#14100a', { align: 'center', weight: 800 });
  }
  let y = by + br + 36;
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, I.w - pad * 2);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + I.w / 2, y + i * 34, 26, PAL.text, { align: 'center', weight: 500 }));
  y += lines.length * 34 + gap;
  const cx = I.x + I.w / 2;
  chip(ctx, cx - 150, y, `${p.bpm} bpm`, 24, { align: 'center' }); chip(ctx, cx, y, `${p.bars} bars`, 24, { align: 'center' }); chip(ctx, cx + 150, y, `${Math.round(p.bars * barDur(p))} s`, 24, { align: 'center' });
  y += 36 + gap;
  const cnt = gestureCounts(p);
  chip(ctx, cx - 190, y, `${cnt.p} plucks`, 22, { align: 'center' }); chip(ctx, cx, y, `${cnt.s} strums`, 22, { align: 'center' }); chip(ctx, cx + 190, y, `${cnt.d} damps`, 22, { align: 'center' });
  y += 36 + gap;
  const rowH = clamp((I.y + I.h - y - 110) / 6.3, 22, 44), w0 = bestWindow(p);
  if (rowH > 22) {
    txt(ctx, w0 === 0 ? 'First four bars' : `Four bars from bar ${w0 + 1}`, I.x + pad, y, 20, PAL.dim, { weight: 700 }); y += 22;
    patternStrip(ctx, p, I.x + pad, y, I.w - pad * 2, rowH, w0); y += 6 * rowH + gap;
  }
  if (y < I.y + I.h - 30) {
    if (best.score) { txt(ctx, `Best ${best.score}`, cx - 120, y, 28, PAL.gold, { align: 'center', weight: 800 }); drawStars(ctx, cx + 110, y, 32, best.stars || 0); }
    else txt(ctx, 'No score yet', cx, y, 26, PAL.dim, { align: 'center', weight: 600 });
  }
  ctx.restore();
  button(ctx, D.learn, 'Learn the phrases', { kind: 'primary', size: 30, sub: 'Listen, then answer' });
  button(ctx, D.perform, 'Perform', { kind: 'quiet', size: 30, sub: 'With the whole accompaniment' });
  button(ctx, D.duel, 'Echo Duel', { kind: 'quiet', size: 30, sub: 'Answer from memory' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'See the pattern, and why' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, pc = PIECES[r.piece], duel = r.mode === 'duel';
  const split = L.mode === 'wide' || p.h < 1000;
  panel(ctx, p, { fill: 'rgba(3,26,24,0.92)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, duel ? (r.won ? 'THE DUEL IS WON' : 'THE DUEL ENDS') : r.mode === 'learn' ? 'FINAL TAKE' : 'RESULT', p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  txt(ctx, pc.name, p.x + p.w / 2, p.y + 98, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 7, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1060, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.grade, lx, y, split ? 130 : 150 * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 12 });
  if (r.newBest) chip(ctx, lx, y + (split ? 96 : 100 * k), 'NEW BEST', 24, { align: 'center', fill: PAL.saffron, color: '#241404' });
  let ry = split ? p.y + 168 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,247,230,0.07)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 34, PAL.text, { align: 'center', weight: 800, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', String(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`);
  if (duel) tile(rx0 + (tw + g) * 2, ry, tw, 'ROUNDS', `${r.rounds} of ${DUEL.rounds}`); else tile(rx0 + (tw + g) * 2, ry, tw, 'BEST COMBO', String(r.maxCombo));
  ry += 126;
  const keys = ['perfect', 'great', 'good', 'miss'], cw = (rw - g * (keys.length - 1)) / keys.length;
  keys.forEach((kk, i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,247,230,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, kk.toUpperCase(), x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += 108;
  if (r.learn && r.learn.acc.length) {
    txt(ctx, 'Phrases', rx0 + 4, ry + 16, 22, PAL.gold, { weight: 800 });
    r.learn.acc.forEach((a, i) => chip(ctx, rx0 + 130 + i * 80, ry + 16, `${Math.round(a * 100)}%`, 22, { fill: a >= 0.75 ? 'rgba(70,178,122,0.5)' : 'rgba(255,247,230,0.14)' }));
  }
  button(ctx, Rr.again, duel ? 'Duel again' : r.mode === 'learn' ? 'Learn again' : 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.songs, 'Pieces', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(3,26,24,0.94)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Krar Lyre on iPhone and Android: six pieces, six qenet, the Echo Duel and the whole accompaniment.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
