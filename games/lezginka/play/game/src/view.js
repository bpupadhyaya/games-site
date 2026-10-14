// Drawing for every screen. render() is the single entry point; playing screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, PADCOL, drawBackdrop, drawRug, drawStars, drawDancer, drawShadow, poseAt, LOOKS, glyph } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { drawPeople } from './figure.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderCalib } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PIECES, SPEEDS, TIMING, bpmAt, stepCount, PAD_ID } from './music.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function titleText(ctx, cx, y, size, label, sub) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff3c8'); g.addColorStop(0.55, '#f6b04a'); g.addColorStop(1, '#ff5a3c');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#1a0d2a'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,120,50,0.6)'; ctx.shadowBlur = size * 0.25; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.78, size * 0.4, PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: wmax * 1.2 });
}

// A looping little choreography for the title and menus: stomps, an arm lift, a spin.
const SEQ = ['L', 'R', 'L', 'R', 'A', 'L', 'R', 'S'];
function loopMoves(t, step = 0.42) {
  const n1 = Math.floor(t / step), out = [];
  for (let n = n1 - 5; n <= n1 + 1; n++) { if (n < 0) continue; out.push({ pad: SEQ[n % SEQ.length], ti: n * step }); }
  return out;
}
function hero(ctx, t, cx, footY, h, withPartner = true) {
  const x = withPartner ? cx - h * 0.14 : cx;
  const beatPh = (t / 0.42) % 1;
  const g = ctx.createRadialGradient(x, footY - h * 0.45, h * 0.1, x, footY - h * 0.4, h * 0.95);
  g.addColorStop(0, 'rgba(255,190,110,0.35)'); g.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = g; ctx.fillRect(x - h, footY - h * 1.4, h * 2, h * 1.8);
  drawRug(ctx, { x: cx, y: footY + h * 0.02, rx: h * 0.62, ry: h * 0.62 * 0.28 }, t, Math.max(0, 1 - beatPh * 2), 0.4);
  const people = [];
  if (withPartner) {
    const mv = loopMoves(t - 0.08).map((m) => ({ pad: m.pad === 'L' ? 'R' : m.pad === 'R' ? 'L' : m.pad, ti: m.ti }));
    people.push({ x: x + h * 0.36, footY: footY - h * 0.02, H: h * 0.8, k: 0.8, look: 'woman', P: poseAt(mv, t, beatPh + 0.2), ph: 2, sh: 0.15, sa: 0.3 });
  }
  people.push({ x, footY, H: h, k: 1, look: 'man', P: poseAt(loopMoves(t), t, beatPh), ph: 0, sh: 0.2, sa: 0.35 });
  drawPeople(ctx, people, t, false);
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); drawToast(ctx, st, L); return; }
  if (sc === 'calib') { meta.previewBadge = null; renderCalib(ctx, st, L); return; }
  meta.previewBadge = null;
  drawBackdrop(ctx, w + 20, h + 20, st.t, sc === 'title' ? 0.35 : 0, sc === 'title' || sc === 'result');
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'songs') renderSongs(ctx, st, L);
  else if (sc === 'piece') renderPiece(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: p.title, sub: `Page ${st.rulesPage + 1} of ${RULES.length}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  else if (sc === 'poses') renderPoses(ctx, st, L);
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
    row('speed', 'Note speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How long a ring takes to close'),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('click', 'Metronome in Learn', 'toggle', () => p.click),
    row('haptics', 'Vibration', 'toggle', () => p.haptics, 'On phones that support it'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and shakes'),
    row('cal', 'Latency (ms)', 'stepper', () => p.cal, 'Sound delay of your device'),
    row('calibrate', 'Calibrate', 'button', () => '', 'Tap along with a pulse', { btn: 'Start' }),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '', st.restoreMsg || (st.owned ? 'Full game unlocked' : 'Get an earlier purchase back'), { btn: st.owned ? 'Owned' : st.restoreBusy ? 'Checking' : 'Restore', off: st.owned || st.restoreBusy })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, t = st.t, wide = L.mode === 'wide';
  hero(ctx, t, T.hero.x - (wide ? 0 : 0), T.hero.y, T.hero.h);
  const tcx = wide ? T.hero.x : S.x + S.w / 2, size = T.size;
  titleText(ctx, tcx, T.titleY, size, 'LEZGINKA', null);
  txt(ctx, 'Stamp. Lift. Spin. The tempo climbs.', tcx, T.titleY + size * 0.78, Math.max(24, size * 0.2), PAL.text, { align: 'center', weight: 600, stroke: 5, maxW: (wide ? T.hero.x * 1.9 : S.w) - 40 });
  button(ctx, T.play, 'Dance', { kind: 'primary', size: 44, icon: 'play' });
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
  txt(ctx, 'Choose a dance', S.x + S.w / 2, G.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(16,10,40,0.78)' }); edgeStroke(ctx, r, 24, 0.28);
    const pad = 22, small = r.h < 250;
    txt(ctx, p.name, r.x + pad, r.y + r.h * (small ? 0.28 : 0.2), small ? 34 : 42, PAL.text, { font: DISPLAY, weight: 700, maxW: r.w * 0.6 });
    p.pads.forEach((d, k) => glyph(ctx, d, r.x + r.w - pad - 20 - k * 46, r.y + r.h * 0.3, 16, PADCOL[d], 3));
    if (p.pads.length < 4) glyph(ctx, 3, r.x + r.w - pad - 20 - p.pads.length * 46, r.y + r.h * 0.3, 16, 'rgba(255,255,255,0.18)', 3);
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
function figureStrip(ctx, fig, x, y, w, h) {
  ctx.fillStyle = 'rgba(255,240,220,0.06)'; rrect(ctx, { x, y, w, h }, 12); ctx.fill();
  const toks = fig.pat.split(' '), cw = w / 4;
  toks.forEach((tk, b) => {
    if (b) { ctx.fillStyle = 'rgba(255,240,220,0.14)'; ctx.fillRect(x + cw * b - 1, y + 6, 2, h - 12); }
    const n = tk.length;
    for (let i = 0; i < n; i++) { const id = PAD_ID[tk[i]]; if (id !== undefined) glyph(ctx, id, x + cw * b + cw * (i + 0.5) / n, y + h / 2, Math.min(h * 0.28, cw / n * 0.34), PADCOL[id], 3); }
  });
}

function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], best = st.best[p.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.name, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (D.back.w + 30) });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(16,10,40,0.72)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  const pad = 24, cx = I.x + I.w / 2;
  let y = I.y + 34;
  txt(ctx, 'THE STEPS', I.x + pad, y, 22, PAL.gold, { weight: 800 });
  p.pads.forEach((d, k) => { glyph(ctx, d, I.x + I.w - pad - 24 - k * 56, y, 20, PADCOL[d], 3.5); });
  y += 30;
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, I.w - pad * 2);
  lines.forEach((ln, i) => txt(ctx, ln, cx, y + 16 + i * 34, 26, PAL.text, { align: 'center', weight: 500 }));
  y += lines.length * 34 + 26;
  chip(ctx, cx - 150, y, `${p.bpm} bpm`, 24, { align: 'center' }); chip(ctx, cx, y, `${p.bars} bars`, 24, { align: 'center' }); chip(ctx, cx + 160, y, `to ${Math.round(bpmAt(p, p.bars - 1))} bpm`, 24, { align: 'center' });
  y += 44;
  // figures
  const figs = Object.values(p.figures);
  const rowH = 56;
  figs.slice(0, 6).forEach((f, i) => {
    const yy = y + i * (rowH + 8);
    if (yy + rowH > I.y + I.h - 50) return;
    txt(ctx, f.name, I.x + pad, yy + rowH / 2, 24, PAL.text, { weight: 700, maxW: I.w * 0.32 });
    figureStrip(ctx, f, I.x + pad + I.w * 0.34, yy, I.w - pad * 2 - I.w * 0.34, rowH);
  });
  const by = I.y + I.h - 40;
  const used = y + Math.min(figs.length, 6) * (rowH + 8), free = by - 30 - used;
  if (free > 150) { const hh = Math.min(free * 0.9, I.w * 0.7); ctx.save(); hero(ctx, st.t, cx, used + free * 0.5 + hh * 0.5, hh * 0.9); ctx.restore(); }
  if (best.score) { txt(ctx, `Best ${best.score}`, cx - 120, by, 28, PAL.gold, { align: 'center', weight: 800 }); drawStars(ctx, cx + 110, by, 32, best.stars || 0); }
  else txt(ctx, `${stepCount(p)} steps in the dance. No score yet.`, cx, by, 24, PAL.dim, { align: 'center', weight: 600, maxW: I.w - 40 });
  ctx.restore();
  button(ctx, D.learn, 'Learn the steps', { kind: 'primary', size: 32, sub: 'Watch a phrase, then echo it' });
  button(ctx, D.perform, 'Dance', { kind: 'quiet', size: 32, sub: 'The whole piece with the band' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The dancers perform it for you' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, pc = PIECES[r.piece];
  const split = L.mode === 'wide' || p.h < 1000;                          // short panels put the stars and grade beside the numbers
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
  ['perfect', 'great', 'good', 'off', 'miss'].forEach((kk, i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, kk.toUpperCase(), x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += 108;
  if (r.learn && r.learn.acc.length) {
    txt(ctx, 'Phrases', rx0 + 4, ry + 16, 22, PAL.gold, { weight: 800 });
    r.learn.acc.forEach((a, i) => chip(ctx, rx0 + 130 + i * 80, ry + 16, `${Math.round(a * 100)}%`, 22, { fill: a >= 0.75 ? 'rgba(47,182,163,0.45)' : 'rgba(255,240,220,0.14)' }));
  }
  button(ctx, Rr.again, r.mode === 'learn' ? 'Learn again' : 'Dance again', { kind: 'primary', size: 30 });
  button(ctx, Rr.songs, 'Dances', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(16,10,40,0.9)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Lezginka on iPhone and Android: five dances, all four steps and the whole band.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}

// Tester sheet (?dev=1&scene=poses): the dancers in every move, large.
function renderPoses(ctx, st, L) {
  const looks = ['man', 'woman', 'man2', 'woman2'], moves = [null, 'L', 'A', 'S'];
  const cw = L.w / 4, rh = (L.h - 40) / 4;
  looks.forEach((lk, r) => moves.forEach((mv, c) => {
    const t = 1;
    const P = poseAt(mv ? [{ pad: mv, ti: t + (mv === 'S' ? 0.2 : 0) }] : [], t + (mv === 'A' ? 0.08 : 0.0), 0.25);
    drawDancer(ctx, cw * (c + 0.5), 40 + rh * (r + 1) - 16, rh * 0.82, P, LOOKS[lk], { ph: c });
  }));
}
