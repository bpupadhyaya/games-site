// Drawing for every screen. render() is the single entry point; playing screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, rgba, drawBackdrop, drawLantern, drawDrum, drawStick, drawStars, drawEmbers, drawFloor } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderFree, renderCalib } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PIECES, DRUMS, SPEEDS, TIMING, barDur, ENSEMBLE } from './music.js';
import { drawCredit, drawMoreLine, edgeStroke, brandGradient, drawLockup } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function titleText(ctx, cx, y, size, label, sub) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff3c8'); g.addColorStop(0.55, '#f6b04a'); g.addColorStop(1, '#ff5a3c');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#1a0d2a'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,120,50,0.6)'; ctx.shadowBlur = size * 0.25; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.78, size * 0.4, PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: wmax * 1.2 });
}

// The big drum with crossed sticks, used on the title and piece screens.
function hero(ctx, st, x, y, r, kind = 3) {
  const t = st.t, beat = Math.max(0, Math.sin(t * 2.4)) ** 6;
  const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.2, x, y, r * 2.2);
  g.addColorStop(0, `rgba(255,170,90,${0.35 + 0.15 * beat})`); g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 2.4, y - r * 2.2, r * 4.8, r * 4.4);
  drawDrum(ctx, x, y, r, kind, { flash: beat * 0.35, zone: 'D', lift: beat * 2 });
  const ry = r * 0.62;
  for (const s of [-1, 1]) drawStick(ctx, x + s * r * 0.95, y - ry * 2.3 - beat * 8, x - s * r * 0.06, y - ry * 0.45 + beat * 6, Math.max(5, r * 0.07));
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
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(14,10,36,0.9)', stroke: 'rgba(255,230,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('speed', 'Note speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How long a note takes to fall'),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('labels', 'Note labels', 'toggle', () => p.labels, 'Write don / ka on the notes'),
    row('click', 'Metronome in Learn', 'toggle', () => p.click),
    row('haptics', 'Vibration', 'toggle', () => p.haptics, 'On phones that support it'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and shakes'),
    row('cal', 'Latency (ms)', 'stepper', () => p.cal, 'Sound delay of your device', { }),
    row('calibrate', 'Calibrate', 'button', () => '', 'Tap along with a pulse', { btn: 'Start' }),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, t = st.t;
  const wide = L.mode === 'wide';
  drawFloor(ctx, L.w, L.h, T.hero.y + T.hero.r * 0.55, T.hero.x, 0.3);
  const lanternR = wide ? 38 : 34;
  drawLantern(ctx, S.x + (wide ? 70 : 48), T.hero.y - T.hero.r * 0.9, lanternR, t, 0.5);
  drawLantern(ctx, wide ? T.col.x - 60 : S.x + S.w - 48, T.hero.y - T.hero.r * 0.8, lanternR * 0.9, t + 1.7, 0.5);
  hero(ctx, st, T.hero.x, T.hero.y, T.hero.r);
  const tcx = wide ? T.hero.x : S.x + S.w / 2, size = T.size;
  titleText(ctx, tcx, T.titleY, size, 'TAIKO', null);
  titleText(ctx, tcx, T.titleY + size * 0.95, size * 0.52, 'DRUM CIRCLE', null);
  txt(ctx, 'Don in the middle. Ka on the rim.', tcx, T.titleY + size * 1.5, Math.max(24, size * 0.2), PAL.text, { align: 'center', weight: 600, stroke: 5, maxW: (wide ? T.col.x - S.x : S.w) - 40 });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.free, 'Free Play', { kind: 'quiet', size: 32, icon: 'drum' });
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
  txt(ctx, 'Choose a piece', S.x + S.w / 2, G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(16,10,40,0.78)' }); edgeStroke(ctx, r, 24, 0.28);
    const pad = 22, small = r.h < 250;
    txt(ctx, p.name, r.x + pad, r.y + r.h * (small ? 0.28 : 0.2), small ? 32 : 40, PAL.text, { font: DISPLAY, weight: 400, maxW: r.w * 0.6 });
    // drums played
    const lanes = p.player.slice().sort((a, b) => a - b);
    lanes.forEach((d, k) => drawDrum(ctx, r.x + r.w - pad - 22 - k * 46, r.y + r.h * 0.3, 15 * (d === 3 ? 1.15 : 1), d, {}));
    const row2 = r.y + r.h * (small ? 0.58 : 0.5);
    chip(ctx, r.x + pad, row2, `${p.bpm} bpm`, 22, { fill: 'rgba(255,240,220,0.12)' });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < p.level ? PAL.ember : 'rgba(255,240,220,0.18)'; ctx.beginPath(); ctx.arc(r.x + pad + 130 + k * 22, row2, 7, 0, 6.3); ctx.fill(); }
    if (!small) { ctx.font = `500 22px ${UI}`; const lines = wrap(ctx, p.blurb, r.w - pad * 2).slice(0, r.h >= 235 ? 2 : 1); lines.forEach((ln, k) => txt(ctx, ln, r.x + pad, r.y + r.h * 0.62 + k * 28, 22, PAL.dim, { weight: 500, maxW: r.w - pad * 2 })); }
    drawStars(ctx, r.x + r.w - pad - 56, r.y + r.h - (small ? 26 : 32), small ? 26 : 30, best.stars || 0);
    if (best.score) txt(ctx, `Best ${best.score}`, r.x + pad, r.y + r.h - (small ? 26 : 32), 22, PAL.gold, { weight: 700 });
    if (locked) { ctx.fillStyle = 'rgba(8,6,24,0.6)'; rrect(ctx, r, 24); ctx.fill(); txt(ctx, 'In the full game', r.x + r.w / 2, r.y + r.h / 2, 30, PAL.text, { align: 'center', weight: 800 }); }
  });
}

// ---- piece ------------------------------------------------------------------------------------------------------------------------------------------------------
function patternStrip(ctx, p, x, y, w, rowH) {
  // the first four bars of the player's part, one row per drum
  const lanes = p.player.slice().sort((a, b) => a - b);
  const bars = 4, perBar = p.steps;
  lanes.forEach((d, li) => {
    const yy = y + li * rowH + rowH / 2;
    ctx.fillStyle = 'rgba(255,240,220,0.06)'; rrect(ctx, { x, y: yy - rowH * 0.4, w, h: rowH * 0.8 }, 10); ctx.fill();
    for (let b = 1; b < bars; b++) { ctx.fillStyle = 'rgba(255,240,220,0.14)'; ctx.fillRect(x + w * b / bars - 1, yy - rowH * 0.4, 2, rowH * 0.8); }
    const part = p.parts.player.find((q) => q.drum === d);
    for (let b = 0; b < bars; b++) {
      const ch = part.form[b]; if (!ch || ch === '.') continue;
      const pat = part.pat[ch].replace(/\s+/g, '');
      for (let k = 0; k < pat.length; k++) {
        const c = pat[k]; if (c === '.') continue;
        const cx = x + w * (b + (k + 0.5) / perBar) / bars, r = Math.min(rowH * 0.28, w / bars / perBar * 0.55) * (c === 'd' || c === 'k' ? 0.75 : 1);
        if (c === 'D' || c === 'd') { ctx.fillStyle = PAL.ember; ctx.beginPath(); ctx.arc(cx, yy, r, 0, 6.3); ctx.fill(); }
        else { ctx.strokeStyle = PAL.ice; ctx.lineWidth = Math.max(2, r * 0.45); ctx.beginPath(); ctx.arc(cx, yy, r * 0.8, 0, 6.3); ctx.stroke(); }
      }
    }
  });
}

function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], best = st.best[p.id] ?? {}, wide = L.mode === 'wide';
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.name, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - 2 * (D.back.w + 30) });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(16,10,40,0.72)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  const lanes = p.player.slice().sort((a, b) => a - b), n = lanes.length;
  const pad = 24, gap = clamp(I.h * 0.035, 18, 50), rxOf = (d) => clamp(Math.min(((I.w - pad * 2) / n) * 0.42, 130) * (0.8 + 0.2 * DRUMS[d].size), 36, 150), drumH = Math.max(...lanes.map(rxOf)) * 2.1 + 20;
  txt(ctx, 'YOU PLAY', I.x + pad, I.y + 30, 22, PAL.gold, { weight: 800 });
  txt(ctx, lanes.map((d) => DRUMS[d].short).join(' + '), I.x + I.w - pad, I.y + 30, 26, PAL.text, { align: 'right', weight: 800, maxW: I.w * 0.6 });
  lanes.forEach((d, k) => {
    const cell = (I.w - pad * 2) / n, rx = rxOf(d);
    drawDrum(ctx, I.x + pad + cell * (k + 0.5), I.y + 60 + rx * 0.66, rx, d, {});
  });
  let y = I.y + 60 + drumH + gap * 0.6;
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, I.w - pad * 2);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + I.w / 2, y + i * 34, 26, PAL.text, { align: 'center', weight: 500 }));
  y += lines.length * 34 + gap;
  const cx = I.x + I.w / 2;
  chip(ctx, cx - 150, y, `${p.bpm} bpm`, 24, { align: 'center' }); chip(ctx, cx, y, `${p.bars} bars`, 24, { align: 'center' }); chip(ctx, cx + 150, y, `${Math.round(p.bars * barDur(p))} s`, 24, { align: 'center' });
  y += 36 + gap;
  const stripRows = Math.min(n, 4), rowH = clamp(I.h * 0.07, 30, 72);
  txt(ctx, 'First four bars', I.x + pad, y, 20, PAL.dim, { weight: 700 }); y += 22;
  patternStrip(ctx, p, I.x + pad, y, I.w - pad * 2, rowH); y += stripRows * rowH + gap + 14;
  if (y < I.y + I.h - 30) {
    if (best.score) { txt(ctx, `Best ${best.score}`, cx - 120, y, 28, PAL.gold, { align: 'center', weight: 800 }); drawStars(ctx, cx + 110, y, 32, best.stars || 0); }
    else txt(ctx, 'No score yet', cx, y, 26, PAL.dim, { align: 'center', weight: 600 });
  }
  ctx.restore();
  void wide;
  button(ctx, D.learn, 'Learn the pattern', { kind: 'primary', size: 32, sub: 'Listen, then echo it back' });
  button(ctx, D.perform, 'Perform', { kind: 'quiet', size: 32, sub: 'With the whole ensemble' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The circle plays it for you' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, pc = PIECES[r.piece];
  const split = L.mode === 'wide' || p.h < 1000;                          // short panels put the stars and grade beside the numbers
  panel(ctx, p, { fill: 'rgba(16,10,40,0.88)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, r.mode === 'learn' ? 'FINAL TAKE' : 'RESULT', p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  txt(ctx, pc.name, p.x + p.w / 2, p.y + 98, 50, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 7, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1060, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.grade, lx, y, split ? 140 : 160 * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 12 });
  if (r.newBest) chip(ctx, lx, y + (split ? 96 : 100 * k), 'NEW BEST', 24, { align: 'center', fill: PAL.ember, color: '#fff' });
  let ry = split ? p.y + 168 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 34, PAL.text, { align: 'center', font: DISPLAY, weight: 400, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', String(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`); tile(rx0 + (tw + g) * 2, ry, tw, 'BEST COMBO', String(r.maxCombo));
  ry += 126;
  const cw = (rw - g * 4) / 5;
  ['perfect', 'great', 'good', 'off', 'miss'].forEach((kk, i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, kk.toUpperCase(), x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
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
  panel(ctx, r, { fill: 'rgba(16,10,40,0.9)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Taiko Drum Circle on iPhone and Android: six pieces, all four drums and the whole ensemble.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
