// Drawing for every screen. render() is the single entry point; playing screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawBackdrop, drawLamp, drawFrame, drawBar, drawGong, drawMallet, drawStars, drawFloor, drawCycleRing } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderFree, renderCalib } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PIECES, TUNINGS, SPEEDS, TIMING, barDur, partHits, lanesOf, STEPS } from './music.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function titleText(ctx, cx, y, size, label, sub) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff3c8'); g.addColorStop(0.5, '#f2cf7c'); g.addColorStop(1, '#c0802c');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#1c0a06'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,170,70,0.55)'; ctx.shadowBlur = size * 0.22; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.78, size * 0.36, PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: wmax * 1.2 });
}

// The hero: a carved bar instrument with a gong behind it that rings by itself, lit by the lamps.
function hero(ctx, st, x, y, r) {
  const t = st.t, n = 5, w = r * 3.5, cell = w / n, bw = cell * 0.84, hmax = Math.min(r * 1.2, bw * 1.6);
  const gl = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.6);
  gl.addColorStop(0, 'rgba(255,170,80,0.3)'); gl.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = gl; ctx.fillRect(x - r * 2.8, y - r * 2.4, r * 5.6, r * 4.8);
  const gp = Math.max(0, Math.sin(t * 0.8)) ** 12;
  drawGong(ctx, { cx: x, cy: y - hmax * 0.95 - r * 0.62, r: r * 0.62 }, 'gong', { flash: gp * 0.4, ring: gp * 0.8, age: 0.5, swing: Math.sin(t * 1.3) * (0.3 + gp) });
  const fh = hmax + hmax * 0.24, fy = y - fh / 2;
  drawFrame(ctx, { x: x - w / 2 - cell * 0.22, y: fy, w: w + cell * 0.44, h: fh, skirt: hmax * 0.2 });
  const hot = Math.floor(t * 1.6) % n, ph = (t * 1.6) % 1;
  for (let i = 0; i < n; i++) {
    const on = i === hot ? Math.max(0, 1 - ph * 2.4) : 0, ring = i === hot ? Math.max(0, 1 - ph * 0.9) : (i === (hot + n - 1) % n ? Math.max(0, 0.8 - ph * 1.6) * 0.8 : 0);
    drawBar(ctx, { cx: x + (i - (n - 1) / 2) * cell, cy: y, w: bw, h: hmax * (1 - 0.26 * i / (n - 1)) }, { flash: on, ring, t, label: [1, 2, 3, 5, 6][i] });
  }
  const bx = x + (hot - (n - 1) / 2) * cell, lift = ph < 0.05 ? 0 : clamp((ph - 0.05) / 0.3, 0, 1) * 0.6;
  drawMallet(ctx, bx + bw * 0.15, y - hmax * 0.34 - bw * 0.12, Math.max(14, bw * 0.3), lift, 1, ph < 0.1 ? 1 - ph / 0.1 : 0);
  drawMallet(ctx, x + ((hot + 2) % n - (n - 1) / 2) * cell - bw * 0.15, y - hmax * 0.34 - bw * 0.12, Math.max(14, bw * 0.3), 0.55, -1, 0);
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); drawToast(ctx, st, L); return; }
  if (sc === 'free') { renderFree(ctx, st, L, meta); drawToast(ctx, st, L); return; }
  if (sc === 'calib') { renderCalib(ctx, st, L); return; }
  meta.previewBadge = null;
  drawBackdrop(ctx, w + 20, h + 20, st.t, 0);
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
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(26,10,8,0.92)', stroke: 'rgba(242,207,124,0.45)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('speed', 'Note speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How long a note takes to fall'),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('labels', 'Numbers on notes', 'toggle', () => p.labels, 'Write the scale number on the bars and notes'),
    row('click', 'Metronome in Learn', 'toggle', () => p.click),
    row('haptics', 'Vibration', 'toggle', () => p.haptics, 'On phones that support it'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and shakes'),
    row('cal', 'Latency (ms)', 'stepper', () => p.cal, 'Sound delay of your device'),
    row('calibrate', 'Calibrate', 'button', () => '', 'Tap along with a pulse', { btn: 'Start' }),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, t = st.t, wide = L.mode === 'wide';
  drawFloor(ctx, L.w, L.h, T.hero.y + T.hero.r * 0.7, T.hero.x, 0.3);
  const lampR = wide ? 34 : 30;
  drawLamp(ctx, S.x + (wide ? 70 : 52), T.hero.y - T.hero.r * 1.5, lampR, t, 0.5);
  drawLamp(ctx, wide ? T.col.x - 60 : S.x + S.w - 52, T.hero.y - T.hero.r * 1.4, lampR * 0.9, t + 1.7, 0.5);
  hero(ctx, st, T.hero.x, T.hero.y, T.hero.r);
  const tcx = wide ? T.hero.x : S.x + S.w / 2, size = T.size;
  titleText(ctx, tcx, T.titleY, size, 'GAMELAN', null);
  titleText(ctx, tcx, T.titleY + size * 0.9, size * 0.34, 'BRONZE BARS AND GONGS', null);
  txt(ctx, 'Strike the bronze bars. Keep the cycle.', tcx, T.titleY + size * 1.5, Math.max(24, size * 0.2), PAL.text, { align: 'center', weight: 600, stroke: 5, maxW: (wide ? T.col.x - S.x : S.w) - 40 });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.free, 'Free Play', { kind: 'quiet', size: 32, icon: 'bars' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- songs -----------------------------------------------------------------------------------------------------------------------------------------------------
function renderSongs(ctx, st, L) {
  const G = L.songs, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a piece', S.x + S.w / 2, G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(32,12,9,0.8)' }); edgeStroke(ctx, r, 24, 0.28);
    const pad = 22, small = r.h < 190;
    txt(ctx, p.name, r.x + pad, r.y + r.h * (small ? 0.28 : 0.2), small ? 30 : 38, PAL.text, { font: DISPLAY, weight: 800, maxW: r.w - pad * 2 - 40 });
    const row2 = r.y + r.h * (small ? 0.58 : 0.5);
    const c1 = chip(ctx, r.x + pad, row2, p.tun.name, 21, { fill: 'rgba(242,207,124,0.16)' });
    const c2 = chip(ctx, c1.x + c1.w + 10, row2, `${p.bpm} bpm`, 21, { fill: 'rgba(255,240,220,0.12)' });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < p.level ? PAL.amber : 'rgba(255,240,220,0.18)'; ctx.beginPath(); ctx.arc(c2.x + c2.w + 22 + k * 20, row2, 6.5, 0, 6.3); ctx.fill(); }
    if (!small) { ctx.font = `500 22px ${UI}`; const lines = wrap(ctx, p.blurb, r.w - pad * 2).slice(0, r.h >= 225 ? 2 : 1); lines.forEach((ln, k) => txt(ctx, ln, r.x + pad, r.y + r.h * 0.65 + k * 28, 22, PAL.dim, { weight: 500, maxW: r.w - pad * 2 })); }
    drawStars(ctx, r.x + r.w - pad - 56, r.y + r.h - (small ? 26 : 32), small ? 26 : 30, best.stars || 0);
    if (best.score) txt(ctx, `Best ${best.score}`, r.x + pad, r.y + r.h - (small ? 26 : 32), 22, PAL.gold, { weight: 700 });
    if (locked) { ctx.fillStyle = 'rgba(14,5,4,0.62)'; rrect(ctx, r, 24); ctx.fill(); txt(ctx, 'In the full game', r.x + r.w / 2, r.y + r.h / 2, 30, PAL.text, { align: 'center', weight: 800 }); }
  });
}

// ---- piece ------------------------------------------------------------------------------------------------------------------------------------------------------
// The first four bars of the player's part: one row per instrument, a dot per strike.
function patternStrip(ctx, p, x, y, w, rowH) {
  const lanes = lanesOf(p), bars = 4;
  lanes.forEach((inst, li) => {
    const yy = y + li * rowH + rowH / 2;
    ctx.fillStyle = 'rgba(255,240,220,0.06)'; rrect(ctx, { x, y: yy - rowH * 0.4, w, h: rowH * 0.8 }, 10); ctx.fill();
    for (let b = 1; b < bars; b++) { ctx.fillStyle = 'rgba(255,240,220,0.14)'; ctx.fillRect(x + 56 + (w - 56) * b / bars - 1, yy - rowH * 0.4, 2, rowH * 0.8); }
    for (const part of p.player) for (const h of partHits(p, part, 0, bars)) {
      if (h.inst !== inst) continue;
      const cx = x + 56 + (w - 56) * (h.bar + (h.step + 0.5) / STEPS) / bars, r = Math.min(rowH * 0.28, (w - 56) / bars / STEPS * 0.55) * (h.soft ? 0.75 : 1);
      ctx.fillStyle = inst < 7 ? PAL.gold : PAL.jade; ctx.beginPath(); ctx.arc(cx, yy, r, 0, 6.3); ctx.fill();
    }
    txt(ctx, inst < 7 ? String(p.tun.numerals[inst]) : ['Kenong', 'Kempul', 'Gong'][inst - 7], x + 8, yy, Math.min(20, rowH * 0.5), PAL.dim, { weight: 800, maxW: 46 });
  });
}

function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], best = st.best[p.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.name, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 6, maxW: S.w - 2 * (D.back.w + 30) });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(32,12,9,0.78)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  const lanes = lanesOf(p), pad = 24, gap = clamp(I.h * 0.03, 14, 40);
  txt(ctx, 'YOU PLAY', I.x + pad, I.y + 30, 22, PAL.gold, { weight: 800 });
  txt(ctx, lanes.map((d) => (d < 7 ? p.tun.numerals[d] : ['Kenong', 'Kempul', 'Gong'][d - 7])).join(' · '), I.x + I.w - pad, I.y + 30, 26, PAL.text, { align: 'right', weight: 800, maxW: I.w * 0.62 });
  // the instrument, with the bars you play lit
  const iy = I.y + 56, ih = clamp(I.h * 0.24, 100, 300), bwTot = I.w - pad * 2;
  if (p.rack === 'bars') {
    const n = p.tun.n, cell = Math.min(bwTot / n, 130), bw = cell * 0.82, hh = Math.min(ih - 8, bw * 2.2), x0 = I.x + I.w / 2 - cell * n / 2;
    drawFrame(ctx, { x: x0 - cell * 0.2, y: iy - 6, w: cell * n + cell * 0.4, h: hh + 12, skirt: 8 });
    for (let i = 0; i < n; i++) drawBar(ctx, { cx: x0 + cell * (i + 0.5), cy: iy + hh / 2, w: bw, h: hh * (1 - 0.26 * i / (n - 1)) }, { label: p.tun.numerals[i], dim: lanes.includes(i) ? 0 : 0.55 });
  } else {
    const rs = [0.86, 0.96, 1.28], r0 = Math.min(bwTot / 8.6, ih / 2.5);
    [7, 8, 9].forEach((id, k) => { const cx = I.x + I.w / 2 + (k - 1) * r0 * 3.1; drawGong(ctx, { cx, cy: iy + ih * 0.5, r: r0 * rs[k] }, ['kenong', 'kempul', 'gong'][k], { dim: lanes.includes(id) ? 0 : 0.5 }); });
  }
  let y = iy + ih + 30;
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, I.w - pad * 2);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + I.w / 2, y + i * 34, 26, PAL.text, { align: 'center', weight: 500 }));
  y += lines.length * 34 + 22;
  const cx = I.x + I.w / 2;
  chip(ctx, cx - 160, y, p.tun.name, 23, { align: 'center', fill: 'rgba(242,207,124,0.16)' }); chip(ctx, cx, y, `${p.bpm} bpm`, 23, { align: 'center' }); chip(ctx, cx + 160, y, `${Math.round(p.bars * barDur(p))} s`, 23, { align: 'center' });
  y += 44;
  const rows = lanes.length, remaining = I.y + I.h - 20 - 54 - y, rowH = clamp((remaining - 34) / rows, 22, 58);
  if (remaining >= rows * 22 + 34) {
    txt(ctx, 'First four bars', I.x + pad, y, 20, PAL.dim, { weight: 700 }); y += 22;
    patternStrip(ctx, p, I.x + pad, y, I.w - pad * 2, rowH); y += rows * rowH + 16;
  }
  y = Math.max(y + 10, I.y + I.h - 40);
  if (best.score) { txt(ctx, `Best ${best.score}`, cx - 120, y, 28, PAL.gold, { align: 'center', weight: 800 }); drawStars(ctx, cx + 110, y, 32, best.stars || 0); }
  else txt(ctx, 'No score yet', cx, y, 26, PAL.dim, { align: 'center', weight: 600 });
  ctx.restore();
  button(ctx, D.learn, 'Learn the pattern', { kind: 'primary', size: 32, sub: 'Listen, then echo it back' });
  button(ctx, D.perform, 'Perform', { kind: 'quiet', size: 32, sub: 'With the whole ensemble' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'See and hear why each strike' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, pc = PIECES[r.piece];
  const split = L.mode === 'wide' || p.h < 1000;                          // short panels put the stars and grade beside the numbers
  panel(ctx, p, { fill: 'rgba(32,12,9,0.9)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, r.mode === 'learn' ? 'FINAL TAKE' : 'RESULT', p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  txt(ctx, pc.name, p.x + p.w / 2, p.y + 98, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 7, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1060, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.grade, lx, y, split ? 140 : 160 * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 800, stroke: 12 });
  if (r.newBest) chip(ctx, lx, y + (split ? 96 : 100 * k), 'NEW BEST', 24, { align: 'center', fill: '#c9701f', color: '#fff' });
  let ry = split ? p.y + 168 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 34, PAL.text, { align: 'center', font: DISPLAY, weight: 800, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', String(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`); tile(rx0 + (tw + g) * 2, ry, tw, 'BEST COMBO', String(r.maxCombo));
  ry += 126;
  const cw = (rw - g * 4) / 5;
  ['perfect', 'great', 'good', 'off', 'miss'].forEach((kk, i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, (kk === 'off' ? 'nearly' : kk).toUpperCase(), x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += 108;
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
  panel(ctx, r, { fill: 'rgba(32,12,9,0.92)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Gamelan on iPhone and Android: six pieces, both tunings and the whole ensemble.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
