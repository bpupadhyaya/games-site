// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawCourtyard, drawSpot, drawPole, drawStars, clamp, ease } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap, minUnits } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, draw3d, drawScene3d, scene3dPending } from './playview.js';
import { ABOUT, HOWTO, rulesPages } from './content.js';
import { ROUTINES, TIMING, THINK_CHOICES, gradeName, DEMO_RUNS, MOVES } from './routine.js';
import { POSES, blend, drawFigure, fitFigure, STANDING_PELVIS } from './figure.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';
import { menuRects } from './layout.js';
import { fitPose, resetThumbBudget } from './thumbs.js';

const TAU = Math.PI * 2;
const HERO_POSES = ['grip', 'flag', 'tuck', 'split', 'wrap', 'ulta', 'vsplit', 'grip'];

function titleText(ctx, cx, y, size, label, sub, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(label).width;
  if (w0 > maxW) { size *= maxW / w0; ctx.font = `${size}px ${DISPLAY}`; }
  const wmax = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff3c8'); g.addColorStop(0.55, '#ffb43c'); g.addColorStop(1, '#e8791c');
  // embossed letters: dark outline, an extruded brass-orange body (depth), a lit face, a bright top edge and a glow
  const dep = Math.max(3, size * 0.1);
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#1a0d2a';
  ctx.strokeText(label, cx, y + dep * 0.5); ctx.strokeText(label, cx, y + dep);
  for (let i = dep; i >= 1; i -= 1) { const u = i / dep; ctx.fillStyle = `rgb(${Math.round(150 - 60 * u)},${Math.round(70 - 30 * u)},${Math.round(14)})`; ctx.fillText(label, cx, y + i); }
  ctx.shadowColor = 'rgba(255,150,50,0.55)'; ctx.shadowBlur = size * 0.25; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.2, size * 0.02); ctx.strokeStyle = 'rgba(255,248,215,0.75)'; ctx.strokeText(label, cx, y - 0.5);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.78, size * 0.3, PAL.text, { align: 'center', weight: 700, stroke: 6, maxW: wmax * 1.1 });
}

// The set behind the menu screens: the 3D courtyard (a still frame on text screens, live behind the title) or the painted 2D one.
function backdrop(ctx, w, h, t, st, k = 0.9, hero3 = null) {
  const sc = st.scene;
  const k3 = hero3 ? hero3.k : Math.min(w, h) / 560;
  const p = hero3 || { x: w * 0.5, y: h * 0.66 - STANDING_PELVIS * k3, k: k3, pose: POSES.salute, phi: 0, turn: t * 0.4, climb: 0, show: false, excite: 0.15, pulse: 0, t };
  p.t = t; p.still = !hero3;
  if (drawScene3d(ctx, w, h, p)) return true;
  const ground = h * 0.66;
  drawCourtyard(ctx, w, h, t, { horizon: h * 0.42, ground, poleX: w * 0.5, k }, 0, 0.15);
  return false;
}

// The performer cycling through poses on a pole, used on the title screen: the whole 3D set with the performer in it, or the 2D picture.
function hero(ctx, st, r, t, w, h) {
  const seq = HERO_POSES, per = 2.6, tt = t / per, i = Math.floor(tt) % seq.length, f = ease((tt % 1) * 2.4);
  const a = POSES[seq[i]], b = POSES[seq[(i + 1) % seq.length]];
  const pose = blend(a, b, f);
  const k = Math.min(r.h / 400, r.w / 520), cx = r.x + r.w * 0.38, groundY = r.y + r.h - 6;
  const climb = 86;
  const ok3 = backdrop(ctx, w, h, t, st, k, { x: cx, y: groundY - (STANDING_PELVIS + climb) * k, k: k * 1.15, pose, phi: 0, turn: t * 0.4, climb, show: true, excite: 0.35 + 0.25 * Math.sin(t * 1.3), pulse: 0 });
  if (ok3 || scene3dPending()) return;
  const ay = groundY - (STANDING_PELVIS + 8) * k - 14 * k;
  drawSpot(ctx, cx, r.y - 40, groundY, r.w, 0.9);
  drawPole(ctx, cx, r.y - 60, groundY, 24 * k, t * 0.4);
  ctx.fillStyle = 'rgba(20,6,6,0.35)'; ctx.beginPath(); ctx.ellipse(cx, groundY + 4, 70 * k, 12 * k, 0, 0, TAU); ctx.fill();
  const fo = { x: cx, y: ay - 60 * k, k, phi: 0 };
  if (!draw3d(ctx, pose, fo, t)) drawFigure(ctx, pose, fo);
}

export function render(ctx, st, L, view, meta, pauseItems) {
  resetThumbBudget();
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  if (sc === 'play') { meta.previewBadge = { x: L.play.stage.x + L.play.stage.w / 2, y: L.play.stage.y + 6, align: 'center' }; renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu); drawToast(ctx, st, L); return; }
  if (sc !== 'title') backdrop(ctx, w, h, st.t, st);
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'routines') renderRoutines(ctx, st, L);
  else if (sc === 'detail') renderDetail(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L, w, h);
  else if (sc === 'rules') renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: 'Rules  ' + (st.rulesPage + 1) + '/' + rulesPages().length, blocks: rulesPages()[st.rulesPage].blocks, nav: true, page: st.rulesPage, pages: rulesPages().length, sub: rulesPages()[st.rulesPage].title });
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: ABOUT.title, blocks: ABOUT.blocks });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: HOWTO.title, blocks: HOWTO.blocks });
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
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn pause before each phrase'),
    row('labels', 'Move names', 'toggle', () => p.labels, 'Write the move name under each node'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No screen shake'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '',
      () => (st.restoreMsg || (st.owns() ? 'Full game unlocked. Thank you!' : 'Already bought it? Get it back')),
      { btn: () => (st.owns() ? 'Unlocked' : st.restoreBusy ? 'Checking' : 'Restore') })]),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

// ---- title ----------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  hero(ctx, st, T.hero, st.t, w, h);
  const cx = L.mode === 'wide' ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  titleText(ctx, cx, T.titleY, T.size, 'MALLAKHAMB', 'Pole gymnastics, in rhythm', (L.mode === 'wide' ? T.play.x - S.x - 40 : S.w - 40));
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  { const lh = 60; if (!drawLockup(ctx, T.credit.x, T.credit.y - lh + 2, lh, 0.92)) drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.9 }); }
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_RUNS - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(14,10,36,0.8)' });
}

// ---- routines + detail ---------------------------------------------------------------------------------------------------------
function stars(ctx, cx, cy, size, n) { drawStars(ctx, cx, cy, size, n, 3, 1.25); }

function renderRoutines(ctx, st, L) {
  const G = L.routines, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  { const lx = G.back.x + G.back.w + 14; txt(ctx, 'Choose a routine', lx + (S.x + S.w - 12 - lx) / 2, G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.x + S.w - 12 - lx }); }
  G.cards.forEach((r, i) => {
    const cfg = ROUTINES[i], best = st.best[cfg.id] ?? {};
    const locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(16,10,36,0.78)', rad: 24, stroke: locked ? 'rgba(255,255,255,0.1)' : 'rgba(255,214,150,0.35)' });
    const pad = 16, ts = 1;
    txt(ctx, `${i + 1}`, r.x + pad + 18, r.y + pad + 20, 34, PAL.gold, { font: DISPLAY, weight: 400 });
    txt(ctx, cfg.name, r.x + pad + 52, r.y + pad + 20, 28, locked ? PAL.dim : PAL.text, { weight: 800, maxW: r.w - pad * 2 - 52 });
    ctx.font = `500 ${Math.max(20, minUnits())}px ${UI}`;
    wrap(ctx, cfg.blurb, r.w - pad * 2).slice(0, 4).forEach((ln, li) => txt(ctx, ln, r.x + pad, r.y + 82 + li * Math.max(26, minUnits() * 1.3), 20, PAL.dim, { weight: 500, maxW: r.w - pad * 2 }));
    txt(ctx, `${cfg.bpm} bpm  ·  ${cfg.count} moves`, r.x + pad, r.y + r.h - 70, 21, PAL.text, { weight: 700, maxW: r.w - pad * 2 });
    stars(ctx, r.x + pad + 50, r.y + r.h - 32, 15, best.stars ?? 0);
    if (best.score) txt(ctx, String(best.score), r.x + r.w - pad, r.y + r.h - 32, 24, PAL.cream, { align: 'right', weight: 800, maxW: r.w * 0.45 });
    if (locked) txt(ctx, 'Full game', r.x + r.w - pad, r.y + pad + 20, 18, PAL.dim, { align: 'right', weight: 700 });
  });
}

function renderDetail(ctx, st, L) {
  const D = L.detail, S = L.S, cfg = ROUTINES[st.sel], best = st.best[cfg.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  { const lx = D.back.x + D.back.w + 14; txt(ctx, cfg.name, lx + (S.x + S.w - 12 - lx) / 2, L.routines.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.x + S.w - 12 - lx }); }
  const I = D.info;
  panel(ctx, I, { rad: 26 });
  const pad = 22;
  txt(ctx, cfg.blurb, I.x + pad, I.y + 36, 24, PAL.text, { weight: 600, maxW: I.w - pad * 2 });
  txt(ctx, `${cfg.bpm} beats per minute  ·  ${cfg.count} moves`, I.x + pad, I.y + 74, 21, PAL.dim, { weight: 600, maxW: I.w - pad * 2 });
  const ids = [...new Set(cfg.pool)];
  const gh = Math.max(110, I.h - 190), gw = I.w - pad * 2, cols = ids.length > 6 ? 5 : 4, rowsN = Math.ceil(ids.length / cols);
  const cellW = gw / cols, cellH = Math.min(gh / rowsN, 150);
  ids.forEach((id, j) => {
    const cx = I.x + pad + (j % cols) * cellW, cy = I.y + 100 + Math.floor(j / cols) * cellH;
    fitPose(ctx, MOVES[id].pose, { x: cx + 6, y: cy + 2, w: cellW - 12, h: cellH - 30 }, { sil: 'rgba(253,241,220,0.9)' });
    txt(ctx, MOVES[id].name, cx + cellW / 2, cy + cellH - 12, 16, PAL.text, { align: 'center', weight: 700, maxW: cellW - 14 });
  });
  const by = I.y + I.h - 56;
  stars(ctx, I.x + pad + 50, by, 18, best.stars ?? 0);
  txt(ctx, best.score ? `Best ${best.score}  ·  ${Math.round((best.acc ?? 0) * 100)}%` : 'Not performed yet', I.x + I.w - pad, by, 24, PAL.cream, { align: 'right', weight: 700, maxW: I.w * 0.55 });
  button(ctx, D.learn, 'Learn it', { kind: 'quiet', size: 32, sub: 'Slower, forgiving, with hints', icon: 'bulb' });
  button(ctx, D.perform, 'Perform', { kind: 'primary', size: 36, sub: 'Full tempo, scored', icon: 'play' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The game performs it for you', icon: 'eye' });
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, w, h) {
  const Rr = L.result, r = st.result, p = Rr.panel, cfg = ROUTINES[r.ri];
  panel(ctx, p, { fill: 'rgba(14,8,34,0.9)', rad: 30 });
  edgeStroke(ctx, p, 30, 0.5);
  const cx = p.x + p.w / 2, wide = L.mode === 'wide';
  txt(ctx, r.failed ? 'THE FLOW BROKE' : r.mode === 'auto' ? 'WATCH COMPLETE' : 'ROUTINE COMPLETE', cx, p.y + 54, 28, r.failed ? PAL.rose : PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: p.w - 40 });
  txt(ctx, cfg.name, cx, p.y + 98, 24, PAL.text, { align: 'center', weight: 700, maxW: p.w - 40 });
  const yo = wide ? 0 : 1;      // the wide (landscape) panel is shorter: tighter stack and the four grades in a 2 x 2 grid
  stars(ctx, cx, p.y + (wide ? 150 : 170), wide ? 34 : 38, r.stars);
  txt(ctx, String(Math.round(r.score)), cx, p.y + (wide ? 228 : 262), wide ? 74 : 88, PAL.cream, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: p.w - 60 });
  txt(ctx, `${gradeName(r.acc)}  ·  accuracy ${Math.round(r.acc * 100)}%`, cx, p.y + (wide ? 286 : 330), 26, PAL.gold, { align: 'center', weight: 800, maxW: p.w - 60 });
  if (r.newBest) txt(ctx, 'NEW BEST', cx, p.y + (wide ? 320 : 372), 24, PAL.tealHi, { align: 'center', weight: 800 });
  const rows = [['Perfect', r.counts.perfect, '#ffe07a'], ['Great', r.counts.great, '#8ef0dc'], ['Good', r.counts.good, '#9fc4ff'], ['Miss', r.counts.miss, '#ff7d8f']];
  const gx = p.x + 60, gw = p.w - 120, top = p.y + (wide ? (r.newBest ? 366 : 340) : (r.newBest ? 408 : 384)), ch = wide ? 36 : 40;
  rows.forEach(([n, c, col], i) => {
    const colw = wide ? gw / 2 - 20 : gw, x0 = wide ? gx + (i % 2) * (colw + 40) : gx, y = top + (wide ? Math.floor(i / 2) : i) * ch;
    txt(ctx, n, x0, y, 24, col, { weight: 700 });
    txt(ctx, String(c), x0 + colw, y, 26, PAL.text, { align: 'right', weight: 800 });
  });
  void yo;
  txt(ctx, `Longest chain ${r.maxChain}`, cx, top + (wide ? 2 : rows.length) * ch + 8, 22, PAL.dim, { align: 'center', weight: 600 });
  button(ctx, Rr.again, 'Again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.routines, 'Routines', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

// ---- pause / end menu + demo limit ---------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Routines', again: 'Again', next: 'Next routine', exit: 'Exit', listen: 'Hint', speed: 'Faster' };
function drawPauseMenu(ctx, st, L, items, pl) {
  const S = L.S;
  ctx.fillStyle = 'rgba(8,4,20,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(16,10,38,0.95)', rad: 28 });
  txt(ctx, pl.over ? 'Performance ended' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400 });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' || it === 'again' ? 'primary' : 'quiet', size: 30 }));
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  panel(ctx, p, { fill: 'rgba(14,8,34,0.92)', rad: 30 });
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: p.w - 40 });
  txt(ctx, 'The full game has every routine,', p.x + p.w / 2, p.y + 160, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'with more moves and faster tempos.', p.x + p.w / 2, p.y + 200, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'Get Mallakhamb for iPhone and Android.', p.x + p.w / 2, p.y + 270, 26, PAL.tealHi, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.dim, { align: 'center', weight: 600 });
}
