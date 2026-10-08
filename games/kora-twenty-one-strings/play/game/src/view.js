// Drawing for every screen. render() is the single entry point; playing screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, rgba, drawBackdrop, drawKoraHero, drawMat, drawStars, drawNote, handColor } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderFree, renderCalib } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PIECES, SPEEDS, TIMING, barDur, handOf, stringName } from './music.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function titleText(ctx, cx, y, size, label, sub) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff6d6'); g.addColorStop(0.5, '#f8c15a'); g.addColorStop(1, '#e8743b');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#220f1c'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,140,60,0.55)'; ctx.shadowBlur = size * 0.25; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.78, size * 0.4, PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: wmax * 1.2 });
}

// A gentle arpeggio the hero kora plays by itself (no sound): which strings are ringing at time t.
const ARP = [4, 5, 7, 8, 9, 11, 12, 14, 12, 11, 9, 8];
function heroVib(t) {
  const out = new Array(21).fill(0), step = 0.34, k = Math.floor(t / step);
  for (let j = k; j > k - 8 && j >= 0; j--) { const i = ARP[j % ARP.length] + (Math.floor(j / ARP.length) % 2) * 0, a = Math.exp(-(t - j * step) * 2.4); out[i] = Math.max(out[i], a); }
  return out;
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
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(26,10,24,0.92)', stroke: 'rgba(255,230,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('speed', 'Note speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How long a bead takes to slide down'),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('labels', 'Note names', 'toggle', () => p.labels, 'Write the note name on the beads'),
    row('click', 'Click in Learn', 'toggle', () => p.click),
    row('haptics', 'Vibration', 'toggle', () => p.haptics, 'On phones that support it'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks'),
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
  drawMat(ctx, L.w, L.h, T.hero.y + T.hero.r * 0.9, T.hero.x, 0.2);
  drawKoraHero(ctx, T.hero.x, T.hero.y, T.hero.r, t, heroVib(t), { glow: 0.25 });
  const tcx = wide ? T.hero.x : S.x + S.w / 2, size = T.size;
  titleText(ctx, tcx, T.titleY, size * 1.25, 'KORA', null);
  txt(ctx, 'TWENTY-ONE STRINGS', tcx, T.titleY + size * 0.98, Math.max(22, size * 0.27), PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: (wide ? T.col.x - S.x : S.w) - 60 });
  txt(ctx, 'Pluck the strings. Play the pattern.', tcx, T.titleY + size * 1.5, Math.max(24, size * 0.2), PAL.text, { align: 'center', weight: 600, stroke: 5, maxW: (wide ? T.col.x - S.x : S.w) - 40 });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.free, 'Free Play', { kind: 'quiet', size: 32, icon: 'strings' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh }, 0.92)) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- songs -----------------------------------------------------------------------------------------------------------------------------------------------------
function laneDots(ctx, p, x, y, r, gap) {
  p.lanes.forEach((s, k) => { ctx.fillStyle = handColor(handOf(s)); ctx.beginPath(); ctx.arc(x - k * gap, y, r, 0, 6.3); ctx.fill(); ctx.strokeStyle = 'rgba(255,248,230,0.8)'; ctx.lineWidth = 1.6; ctx.stroke(); });
}
function renderSongs(ctx, st, L) {
  const G = L.songs, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a piece', S.x + S.w / 2, G.titleY, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(26,10,24,0.8)' }); edgeStroke(ctx, r, 24, 0.28);
    const pad = 22, small = r.h < 250;
    txt(ctx, p.name, r.x + pad, r.y + r.h * (small ? 0.28 : 0.2), small ? 36 : 44, PAL.text, { font: DISPLAY, weight: 700, maxW: r.w * 0.62 });
    laneDots(ctx, p, r.x + r.w - pad - 12, r.y + r.h * 0.3, 11, 28);
    const row2 = r.y + r.h * (small ? 0.58 : 0.5);
    chip(ctx, r.x + pad, row2, `${p.bpm} bpm`, 22, { fill: 'rgba(255,240,220,0.12)' });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < p.level ? PAL.ember : 'rgba(255,240,220,0.18)'; ctx.beginPath(); ctx.arc(r.x + pad + 130 + k * 22, row2, 7, 0, 6.3); ctx.fill(); }
    if (!small) { ctx.font = `500 22px ${UI}`; const lines = wrap(ctx, p.blurb, r.w - pad * 2).slice(0, r.h >= 235 ? 2 : 1); lines.forEach((ln, k) => txt(ctx, ln, r.x + pad, r.y + r.h * 0.62 + k * 28, 22, PAL.dim, { weight: 500, maxW: r.w - pad * 2 })); }
    drawStars(ctx, r.x + r.w - pad - 56, r.y + r.h - (small ? 26 : 32), small ? 26 : 30, best.stars || 0);
    if (best.score) txt(ctx, `Best ${best.score}`, r.x + pad, r.y + r.h - (small ? 26 : 32), 22, PAL.gold, { weight: 700 });
    if (locked) { ctx.fillStyle = 'rgba(12,5,14,0.62)'; rrect(ctx, r, 24); ctx.fill(); txt(ctx, 'In the full game', r.x + r.w / 2, r.y + r.h / 2, 30, PAL.text, { align: 'center', weight: 800 }); }
  });
}

// ---- piece ------------------------------------------------------------------------------------------------------------------------------------------------------
// The busiest four bars of the piece (so every lane shows something), one row per lane.
function bestWindow(p) {
  let best = 0, bestN = -1;
  for (let b0 = 0; b0 + 4 <= p.bars; b0++) {
    let n = 0; const lanesUsed = new Set();
    for (const part of p.parts.player) for (let b = b0; b < b0 + 4; b++) { const ch = part.form[b]; if (!ch || ch === '.') continue; for (const c of part.pat[ch].replace(/\s+/g, '')) if (c !== '.') { n++; lanesUsed.add(c.toLowerCase()); } }
    const score = lanesUsed.size * 1000 + n; if (score > bestN) { bestN = score; best = b0; }
  }
  return best;
}
function patternStrip(ctx, p, x, y, w, rowH, b0 = 0) {
  const bars = 4, perBar = p.steps;
  p.lanes.forEach((s, li) => {
    const yy = y + li * rowH + rowH / 2;
    ctx.fillStyle = 'rgba(255,240,220,0.06)'; rrect(ctx, { x, y: yy - rowH * 0.4, w, h: rowH * 0.8 }, 10); ctx.fill();
    for (let b = 1; b < bars; b++) { ctx.fillStyle = 'rgba(255,240,220,0.14)'; ctx.fillRect(x + w * b / bars - 1, yy - rowH * 0.4, 2, rowH * 0.8); }
    const col = handColor(handOf(s));
    for (const part of p.parts.player) {
      for (let b = 0; b < bars; b++) {
        const ch = part.form[b0 + b]; if (!ch || ch === '.') continue;
        const pat = part.pat[ch].replace(/\s+/g, '');
        for (let k = 0; k < pat.length; k++) {
          const c = pat[k]; if (c === '.') continue;
          const soft = c >= 'a', slot = soft ? c.charCodeAt(0) - 97 : c.charCodeAt(0) - 49;
          if (slot !== li) continue;
          const cx = x + w * (b + (k + 0.5) / perBar) / bars, r = Math.min(rowH * 0.28, w / bars / perBar * 0.55) * (soft ? 0.75 : 1);
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, yy, r, 0, 6.3); ctx.fill();
        }
      }
    }
  });
}

function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], best = st.best[p.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.name, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 50, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (D.back.w + 30) });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(26,10,24,0.74)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  const n = p.lanes.length, pad = 24, gap = clamp(I.h * 0.035, 18, 50);
  txt(ctx, 'YOU PLAY', I.x + pad, I.y + 30, 22, PAL.gold, { weight: 800 });
  txt(ctx, `${n} strings`, I.x + I.w - pad, I.y + 30, 26, PAL.text, { align: 'right', weight: 800, maxW: I.w * 0.6 });
  // the strings as little beads with their note names
  const cell = (I.w - pad * 2) / n, br = clamp(Math.min(cell * 0.3, 44), 20, 44), by = I.y + 60 + br + 8;
  p.lanes.forEach((s, k) => {
    const cx = I.x + pad + cell * (k + 0.5);
    ctx.strokeStyle = 'rgba(255,248,226,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, by - br - 8); ctx.lineTo(cx, by + br * 1.7); ctx.stroke();
    drawNote(ctx, cx, by, br, handOf(s), false, stringName(s), 1);
    txt(ctx, handOf(s) === 'L' ? (cell > 120 ? 'left hand' : 'left') : (cell > 120 ? 'right hand' : 'right'), cx, by + br + 22, Math.min(18, cell * 0.2), handColor(handOf(s)), { align: 'center', weight: 700, maxW: cell - 4 });
  });
  let y = by + br + 28 + gap * 0.6;
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, I.w - pad * 2);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + I.w / 2, y + i * 34, 26, PAL.text, { align: 'center', weight: 500 }));
  y += lines.length * 34 + gap;
  const cx = I.x + I.w / 2;
  chip(ctx, cx - 150, y, `${p.bpm} bpm`, 24, { align: 'center' }); chip(ctx, cx, y, `${p.bars} bars`, 24, { align: 'center' }); chip(ctx, cx + 150, y, `${Math.round(p.bars * barDur(p))} s`, 24, { align: 'center' });
  y += 36 + gap;
  const stripRows = Math.min(n, 6), rowH = clamp((I.y + I.h - y - 120) / (stripRows + 0.3), 26, 76), w0 = bestWindow(p);
  txt(ctx, w0 === 0 ? 'First four bars' : `Four bars from bar ${w0 + 1}`, I.x + pad, y, 20, PAL.dim, { weight: 700 }); y += 22;
  patternStrip(ctx, p, I.x + pad, y, I.w - pad * 2, rowH, w0); y += stripRows * rowH + gap + 14;
  ctx.font = `500 24px ${UI}`;
  const rl = wrap(ctx, p.roles, I.w - pad * 2);
  if (y + rl.length * 32 + 70 < I.y + I.h) { txt(ctx, 'THE HANDS', I.x + pad, y, 20, PAL.gold, { weight: 800 }); rl.forEach((ln, i) => txt(ctx, ln, I.x + pad, y + 32 + i * 32, 24, PAL.text, { weight: 500 })); y += 32 + rl.length * 32 + 30; }
  if (y < I.y + I.h - 30) {
    if (best.score) { txt(ctx, `Best ${best.score}`, cx - 120, y, 28, PAL.gold, { align: 'center', weight: 800 }); drawStars(ctx, cx + 110, y, 32, best.stars || 0); }
    else txt(ctx, 'No score yet', cx, y, 26, PAL.dim, { align: 'center', weight: 600 });
  }
  ctx.restore();
  button(ctx, D.learn, 'Learn the pattern', { kind: 'primary', size: 32, sub: 'Listen, then echo it back' });
  button(ctx, D.perform, 'Perform', { kind: 'quiet', size: 32, sub: 'With the whole accompaniment' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'See the fingers, and why' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, pc = PIECES[r.piece];
  const split = L.mode === 'wide' || p.h < 1000;                          // short panels put the stars and grade beside the numbers
  panel(ctx, p, { fill: 'rgba(26,10,24,0.9)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, r.mode === 'learn' ? 'FINAL TAKE' : 'RESULT', p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  txt(ctx, pc.name, p.x + p.w / 2, p.y + 98, 56, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1060, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.grade, lx, y, split ? 150 : 170 * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 12 });
  if (r.newBest) chip(ctx, lx, y + (split ? 96 : 100 * k), 'NEW BEST', 24, { align: 'center', fill: PAL.ember, color: '#fff' });
  let ry = split ? p.y + 168 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 34, PAL.text, { align: 'center', weight: 800, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', String(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`); tile(rx0 + (tw + g) * 2, ry, tw, 'BEST COMBO', String(r.maxCombo));
  ry += 126;
  const keys = ['perfect', 'great', 'good', 'miss'], cw = (rw - g * (keys.length - 1)) / keys.length;
  keys.forEach((kk, i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, kk.toUpperCase(), x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += 108;
  if (r.learn && r.learn.acc.length) {
    txt(ctx, 'Phrases', rx0 + 4, ry + 16, 22, PAL.gold, { weight: 800 });
    r.learn.acc.forEach((a, i) => chip(ctx, rx0 + 130 + i * 80, ry + 16, `${Math.round(a * 100)}%`, 22, { fill: a >= 0.75 ? 'rgba(95,214,200,0.45)' : 'rgba(255,240,220,0.14)' }));
  }
  button(ctx, Rr.again, r.mode === 'learn' ? 'Learn again' : 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.songs, 'Pieces', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(26,10,24,0.92)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 50, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Kora on iPhone and Android: six pieces, up to six strings at once, and the whole accompaniment.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
void rgba;
