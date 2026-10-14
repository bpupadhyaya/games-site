// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawStars, clamp, TAU } from './art.js';
import { txt, button, panel, rrect, chip, wrap, wrapFit } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderStage, ordinal, fmtTime } from './playview.js';
import { ABOUT, HOWTO, rulesPages, THINK_CHOICES } from './content.js';
import { ACTS, POT_MAX } from './courses.js';
import { DEMO_RUNS, actStats } from './sim.js';
import { drawPotLocal, drawDancer, drawTower } from './figure.js';
import { drawCourtyard, makeCam } from './art.js';
import { drawCredit, drawLockupImg, drawMoreLine, edgeStroke } from './brand.js';
import { menuRects, gl } from './layout.js';

function titleText(ctx, cx, y, size, label, sub, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(label).width;
  if (w0 > maxW) { size *= maxW / w0; ctx.font = `700 ${size}px ${DISPLAY}`; }
  const wmax = ctx.measureText(label).width;
  ctx.lineJoin = 'round';
  // drop shadow, deep indigo outline, brass rim, then gilded metal with a bright band and a dark band (cast-metal lettering)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(label, cx + size * 0.03, y + size * 0.075);
  ctx.lineWidth = size * 0.24; ctx.strokeStyle = '#0a1230'; ctx.strokeText(label, cx, y);
  ctx.lineWidth = size * 0.13; ctx.strokeStyle = '#8a5a14'; ctx.strokeText(label, cx, y);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff8d0'); g.addColorStop(0.28, '#ffd24a'); g.addColorStop(0.5, '#ffb52e'); g.addColorStop(0.62, '#c8780f'); g.addColorStop(0.8, '#ffc94d'); g.addColorStop(1, '#ff9a1f');
  ctx.shadowColor = 'rgba(255,170,50,0.55)'; ctx.shadowBlur = size * 0.22; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1, size * 0.025); ctx.strokeStyle = 'rgba(255,255,230,0.65)'; ctx.strokeText(label, cx, y - size * 0.012);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.72, size * 0.34, '#bff7ee', { align: 'center', weight: 800, stroke: 8, strokeColor: 'rgba(6,16,44,0.95)', maxW: wmax * 1.15 });
}

// The live menu backdrop: the Watch and Learn performer dancing an act behind the menus.
function backdrop(ctx, st, L, w, h) {
  const m = st.menu;
  let stage = { x: 0, y: 0, w, h }, plate = null;
  if (st.scene === 'title') {
    const T = L.title;
    if (L.mode === 'wide') { stage = { x: 0, y: 0, w: T.play.x - 24, h }; plate = { x: stage.w, y: 0, w: w - stage.w, h }; }
    else { const bot = T.hero.y + T.hero.h + 14; stage = { x: 0, y: 0, w, h: bot }; plate = { x: 0, y: bot, w, h: h - bot }; }
  }
  if (gl.on) {
    // the 3D courtyard fills the screen; the controls sit on a soft shade rather than on a painted plate
    if (plate) {
      const pg = ctx.createLinearGradient(0, plate.y - 90, 0, plate.y + plate.h);
      pg.addColorStop(0, 'rgba(7,12,30,0)'); pg.addColorStop(0.28, 'rgba(7,12,30,0.62)'); pg.addColorStop(1, 'rgba(5,9,24,0.9)');
      ctx.fillStyle = pg; ctx.fillRect(plate.x, Math.max(0, plate.y - 90), plate.w, plate.h + 90);
    }
  } else if (plate) {
    const pg = ctx.createLinearGradient(0, plate.y, 0, plate.y + plate.h);
    pg.addColorStop(0, '#12345c'); pg.addColorStop(0.3, '#0c2340'); pg.addColorStop(1, '#07182c');
    ctx.fillStyle = pg; ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  } else { ctx.fillStyle = '#07182c'; ctx.fillRect(0, 0, w, h); }
  if (!gl.on) renderStage(ctx, m.V, m.W, stage, st.t, { noTargets: true, calm: true });
  const g = ctx.createLinearGradient(0, 0, 0, stage.h);
  if (st.scene === 'title') { g.addColorStop(0, 'rgba(7,24,44,0.55)'); g.addColorStop(0.3, 'rgba(7,24,44,0)'); g.addColorStop(1, 'rgba(7,24,44,0)'); }
  else { g.addColorStop(0, 'rgba(7,24,44,0.66)'); g.addColorStop(1, 'rgba(7,24,44,0.86)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, stage.w, stage.h);
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  if (sc === 'play') {
    meta.previewBadge = { x: L.play.stage.x + L.play.stage.w / 2, y: L.play.stage.y + 6, align: 'center' };
    renderPlay(ctx, st.pl, L, view, meta, pauseItems, drawPauseMenu, st); drawToast(ctx, st, L); return;
  }
  backdrop(ctx, st, L, w, h);
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'courses') renderActs(ctx, st, L);
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
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(7,24,44,0.92)', stroke: 'rgba(143,240,230,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Pause before each phrase in Watch and Learn'),
    row('guide', 'Balance guide', 'toggle', () => p.guide, 'Gold marker: where to steer'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No screen shake'),
    ...(st.demo ? [] : [row('restore', st.owned ? 'Full game unlocked' : 'Restore purchase', 'button', () => '', st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Already bought it?'), { btn: st.restoreBusy ? 'Checking...' : st.owned ? 'Owned' : 'Restore' })]),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  const cx = L.mode === 'wide' ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  const maxW = L.mode === 'wide' ? T.play.x - S.x - 40 : S.w - 40;
  titleText(ctx, cx, T.titleY, T.size, 'BHAVAI', 'POT BALANCE DANCE', maxW);
  button(ctx, T.play, 'Dance', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  if (!drawLockupImg(ctx, T.credit.x, T.credit.y + 8, 46)) drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.9 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_RUNS - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(7,24,44,0.85)' });
  void h; void w;
}

// ---- acts + detail -------------------------------------------------------------------------------------------------------------------
function stars(ctx, cx, cy, size, n) { drawStars(ctx, cx, cy, size, n, 3, 1.25); }

function potRow(ctx, x, y, n, target, size) {
  for (let i = 0; i < target; i++) {
    ctx.save(); ctx.translate(x + i * size * 0.78 + size * 0.4, y); ctx.globalAlpha = i < n ? 1 : 0.35;
    drawPotLocal(ctx, size * 1.8, i); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderActs(ctx, st, L) {
  const G = L.courses, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose an act', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: S.w - 380 });
  G.cards.forEach((r, i) => {
    const a = ACTS[i], best = st.best[a.id] ?? {}, s = actStats(a);
    const locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(7,22,44,0.84)', rad: 24, stroke: locked ? 'rgba(255,255,255,0.1)' : 'rgba(143,240,230,0.32)' });
    const pad = 16;
    txt(ctx, `${i + 1}`, r.x + pad + 14, r.y + pad + 20, 36, PAL.gold, { font: DISPLAY, weight: 700 });
    txt(ctx, a.name, r.x + pad + 48, r.y + pad + 20, 25, locked ? PAL.dim : PAL.text, { weight: 800, maxW: r.w - pad * 2 - 48 });
    const bf = wrapFit(ctx, a.blurb, r.w - pad * 2, 19, 500), lh = bf.size * 1.28;
    const maxLines = Math.max(1, Math.min(3, Math.floor((r.h - 84 - 76) / lh)));
    const lines = bf.lines.slice(0, maxLines);
    if (bf.lines.length > maxLines) lines[maxLines - 1] = lines[maxLines - 1].replace(/[ ,.;:]*\S*$/, '') + '...';
    lines.forEach((ln, li) => txt(ctx, ln, r.x + pad, r.y + 76 + li * lh, 19, PAL.dim, { weight: 500 }));
    potRow(ctx, r.x + pad, r.y + r.h - 84, a.pots0, s.pots, clamp((r.w - pad * 2) / 11, 12, 24));
    txt(ctx, `${a.bpm} bpm  ·  ${s.steps} steps`, r.x + pad, r.y + r.h - 28, 20, PAL.text, { weight: 700, maxW: r.w * 0.5 });
    stars(ctx, r.x + r.w - pad - 42, r.y + r.h - 28, 12, best.stars ?? 0);
    if (locked) txt(ctx, 'Full game', r.x + r.w - pad, r.y + pad + 20, 17, PAL.dim, { align: 'right', weight: 700 });
  });
}

// A small poster of an act's courtyard with the dancer and her starting tower.
function drawPoster(ctx, r, a, t) {
  ctx.save(); rrect(ctx, r, 18); ctx.clip();
  const ppm = Math.min(r.h / 3.7, r.w / 3.6), cam = makeCam(r, ppm);
  cam.oy = r.y + r.h * 0.9; cam.ox = r.x + r.w / 2;
  drawCourtyard(ctx, cam, a, t, 0);
  const sw = Math.sin(t * 1.3) * 0.05;
  drawDancer(ctx, cam, { x: 0, v: 0, th: sw, om: 0, t, bp: (t * 1.4) % 1, side: 1, spin: 0, n: a.pots0, fall: 0 }, 0);
  drawTower(ctx, cam, { x: 0, th: sw, om: 0, n: a.pots0, t, lift: 1 });
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(143,240,230,0.35)'; rrect(ctx, r, 18); ctx.stroke();
}

function renderDetail(ctx, st, L) {
  const D = L.detail, S = L.S, a = ACTS[st.sel], best = st.best[a.id] ?? {}, s = actStats(a);
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, a.name, S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), L.courses.titleY, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: S.w - 380 });
  const I = D.info;
  panel(ctx, I, { rad: 26, fill: 'rgba(7,22,44,0.86)' });
  const pad = 22;
  const bw = wrapFit(ctx, a.blurb, I.w - pad * 2, 24, 600);
  const lines = bw.lines.slice(0, 3), blh = Math.max(32, bw.size * 1.3);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + pad, I.y + 38 + i * blh, 24, PAL.text, { weight: 600 }));
  let y = I.y + 38 + lines.length * blh + 20;
  const rows = [
    ['Tempo', `${a.bpm} bpm`], ['Length', `${a.phrases} phrases`], ['Footprints', String(s.steps)],
    ['Spins', s.turns ? String(s.turns) : 'none'], ['Wind', a.wind > 0 ? (a.wind > 0.15 ? 'strong' : 'gentle') : 'calm'], ['Pots', `${a.pots0} up to ${Math.min(POT_MAX, s.pots)}`],
  ];
  const cols = I.w > 640 ? 2 : 1, cw = (I.w - pad * 2) / cols, lh = 34;
  rows.forEach((r, i) => {
    const cx = I.x + pad + (i % cols) * cw, cy = y + Math.floor(i / cols) * lh;
    if (cy > I.y + I.h - 110) return;
    txt(ctx, r[0], cx, cy, 20, PAL.dim, { weight: 700, maxW: cw * 0.4 });
    txt(ctx, r[1], cx + cw * 0.44, cy, 21, PAL.text, { weight: 700, maxW: cw * 0.54 });
  });
  const rowsH = Math.ceil(rows.length / cols) * lh;
  const py0 = y + rowsH + 6, py1 = I.y + I.h - 64;
  st.v3rect = null;
  if (py1 - py0 > 90) {
    const pr = { x: I.x + pad, y: py0, w: I.w - pad * 2, h: py1 - py0 };
    if (gl.on) {                      // a window onto the live 3D courtyard of this act
      ctx.save(); rrect(ctx, pr, 18); ctx.clip(); ctx.clearRect(pr.x, pr.y, pr.w, pr.h); ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,214,122,0.7)'; rrect(ctx, pr, 18); ctx.stroke();
      st.v3rect = pr;
    } else drawPoster(ctx, pr, a, st.t);
  }
  const by = I.y + I.h - 34, pz = clamp((I.w - pad * 2) / 22, 11, 18);
  stars(ctx, I.x + pad + 50, by, 17, best.stars ?? 0);
  const px0 = I.x + pad + 130, pw = Math.min(POT_MAX, s.pots) * pz * 0.78 + pz;
  potRow(ctx, px0, by, a.pots0, Math.min(POT_MAX, s.pots), pz);
  txt(ctx, best.score ? `Best ${best.score}  ·  ${best.pots} pots` : 'Not danced yet', I.x + I.w - pad, by, 22, PAL.cream, { align: 'right', weight: 700, maxW: Math.max(120, I.x + I.w - pad - (px0 + pw + 14)) });
  button(ctx, D.learn, 'Practice', { kind: 'quiet', size: 32, sub: 'Softer, with a guide and hint', icon: 'bulb' });
  button(ctx, D.race, 'Dance', { kind: 'primary', size: 36, sub: 'Scored, for stars', icon: 'play' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The game dances it for you', icon: 'eye' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const Rr = L.result, r = st.result, p = Rr.panel, a = ACTS[r.ai];
  panel(ctx, p, { fill: 'rgba(5,16,34,0.93)', rad: 30 });
  edgeStroke(ctx, p, 30, 0.5);
  const cx = p.x + p.w / 2, wide = L.mode === 'wide';
  const head = r.mode === 'auto' ? 'WATCH COMPLETE' : r.completed ? 'ACT DANCED' : 'ALL POTS FELL';
  txt(ctx, head, cx, p.y + 52, 32, r.completed && r.mode !== 'auto' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 700, maxW: p.w - 40 });
  txt(ctx, a.name, cx, p.y + 96, 24, PAL.dim, { align: 'center', weight: 700, maxW: p.w - 40 });
  stars(ctx, cx, p.y + 164, 36, r.mode === 'dance' ? r.stars : 0);
  txt(ctx, String(r.score), cx, p.y + 252, 84, PAL.cream, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: p.w - 60 });
  txt(ctx, `${r.pots} of ${r.target} pots  ·  ${Math.round(r.hitRate * 100)}% of footprints`, cx, p.y + 318, 24, PAL.gold, { align: 'center', weight: 800, maxW: p.w - 60 });
  if (r.newBest) txt(ctx, 'NEW BEST', cx, p.y + 356, 22, PAL.turqHi, { align: 'center', weight: 800 });
  const top = p.y + (r.newBest ? 396 : 372), ch = wide ? 32 : 38;
  const rows = [['Perfect footprints', r.perfect, '#ffe07a'], ['Good footprints', r.good, PAL.turqHi], ['Longest chain', r.maxCombo, PAL.text], ['Pots broken', r.falls, PAL.warn]];
  const gx = p.x + 60, gw = p.w - 120;
  rows.forEach(([n, v, col], i) => {
    txt(ctx, n, gx, top + i * ch, 23, col, { weight: 700 });
    txt(ctx, String(v), gx + gw, top + i * ch, 25, PAL.text, { align: 'right', weight: 800 });
  });
  button(ctx, Rr.again, 'Again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.courses, 'Acts', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

// ---- pause menu + demo limit ------------------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Acts' };
function drawPauseMenu(ctx, st, L, items) {
  ctx.fillStyle = 'rgba(4,10,24,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(7,22,44,0.96)', rad: 28 });
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700 });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' ? 'primary' : 'quiet', size: 30 }));
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  panel(ctx, p, { fill: 'rgba(5,16,34,0.94)', rad: 30 });
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: p.w - 40 });
  txt(ctx, 'The full game has eight acts,', p.x + p.w / 2, p.y + 160, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'with spins, wind and eleven pots.', p.x + p.w / 2, p.y + 200, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'Get Bhavai Pot Balance Dance for iPhone and Android.', p.x + p.w / 2, p.y + 270, 24, PAL.turqHi, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.dim, { align: 'center', weight: 600 });
  void ordinal; void fmtTime; void rrect; void TAU;
}
