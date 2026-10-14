// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawStars, clamp, TAU } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderStage } from './playview.js';
import { ABOUT, HOWTO, rulesPages, THINK_CHOICES } from './content.js';
import { SETS, LEVEL_COUNT, DAILY, levelFor, levelStats, DEMO_RUNS, DEMO_LEVELS, createWorld, PHASES, TOTAL } from './sim.js';
import { drawDoll } from './doll.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockupImg } from './brand.js';
import { menuRects } from './layout.js';
import { v3 } from './v3.js';

function titleText(ctx, cx, y, size, l1, l2, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 ${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(l1).width;
  if (w0 > maxW) size *= maxW / w0;
  const s2 = size * 0.72;
  for (const [label, yy, sz] of [[l1, y, size], [l2, y + size * 1.02, s2]]) {
    ctx.font = `400 ${sz}px ${DISPLAY}`;
    ctx.lineJoin = 'round';
    // soft ground shadow, then a stack of darker copies = the carved depth of the letters
    ctx.fillStyle = 'rgba(20,6,6,0.35)'; ctx.fillText(label, cx + sz * 0.1, yy + sz * 0.2);
    const dep = Math.max(4, Math.round(sz * 0.12));
    for (let i = dep; i >= 1; i--) {
      const k = i / dep;
      ctx.lineWidth = sz * 0.2; ctx.strokeStyle = `rgb(${Math.round(70 - 30 * k)},${Math.round(22 - 8 * k)},${Math.round(24 - 8 * k)})`;
      ctx.strokeText(label, cx + i * 0.35, yy + i * 0.95); ctx.fillStyle = ctx.strokeStyle; ctx.fillText(label, cx + i * 0.35, yy + i * 0.95);
    }
    ctx.lineWidth = sz * 0.2; ctx.strokeStyle = '#3a1620'; ctx.strokeText(label, cx, yy);
    ctx.lineWidth = sz * 0.07; ctx.strokeStyle = '#fff1c0'; ctx.strokeText(label, cx, yy);
    const g = ctx.createLinearGradient(0, yy - sz * 0.5, 0, yy + sz * 0.5);
    g.addColorStop(0, '#fff2a8'); g.addColorStop(0.3, '#ffc84a'); g.addColorStop(0.62, '#f08a2a'); g.addColorStop(1, '#c8321e');
    ctx.fillStyle = g; ctx.fillText(label, cx, yy);
    // specular sheen along the upper third of the letters
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const sh = ctx.createLinearGradient(0, yy - sz * 0.5, 0, yy - sz * 0.05);
    sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillText(label, cx, yy); ctx.restore();
  }
  ctx.restore();
}

// The live menu backdrop: two dolls swaying behind the menus on the toy-maker's shelf.
function backdrop(ctx, st, L, w, h) {
  const m = st.menu;
  let stage = { x: 0, y: 0, w, h }, plate = null;
  if (st.scene === 'title') {
    const T = L.title;
    if (L.mode === 'wide') { stage = { x: 0, y: 0, w: T.play.x - 24, h }; plate = { x: stage.w, y: 0, w: w - stage.w, h }; }
    else { const bot = T.hero.y + T.hero.h + 14; stage = { x: 0, y: 0, w, h: bot }; plate = { x: 0, y: bot, w, h: h - bot }; }
  }
  if (plate) {
    const pg = ctx.createLinearGradient(0, plate.y, 0, plate.y + plate.h);
    if (v3.on) { pg.addColorStop(0, 'rgba(60,22,12,0.0)'); pg.addColorStop(0.22, 'rgba(58,20,18,0.62)'); pg.addColorStop(1, 'rgba(26,8,12,0.9)'); }
    else { pg.addColorStop(0, '#5a1e2c'); pg.addColorStop(1, '#2c0e16'); }
    ctx.fillStyle = pg; ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  }
  const save = m.V.shake; m.V.shake = 0;
  renderStage(ctx, stage, m.W, m.V, { t: st.t, rails: false, tags: false, ghost: 'none', paint: [3, 3, 3], topPad: st.scene === 'title' ? L.title.hero.y - 4 : 64, lean: v3.on ? 2.3 : 1.5 });
  m.V.shake = save;
  if (st.scene !== 'title') { ctx.fillStyle = 'rgba(255,247,228,0.62)'; ctx.fillRect(0, 0, w, h); }
}

export function render(ctx, st, L, view, meta, pauseItems) {
  v3.frame(); v3.scene = st.scene; v3.calm = !!st.prefs?.calm;
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  if (sc === 'play') {
    const P = L.play;
    // portrait: top of the stage under the HUD; landscape: in the side column just above the start button, clear of the dolls' tags
    meta.previewBadge = P.note ? { x: P.start.x + P.start.w / 2, y: P.start.y - 46, align: 'center' } : { x: P.stage.x + P.stage.w / 2, y: P.stage.y + 6, align: 'center' };
    renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu);
    drawToast(ctx, st, L); return;
  }
  backdrop(ctx, st, L, w, h);
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'levels') renderLevels(ctx, st, L);
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
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn pauses before each part'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No screen shake, fewer sparkles'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '', () => st.restoreMsg || (st.owned ? 'Full game unlocked. Thank you.' : 'Already bought it? Get it back.'), { btn: () => (st.owned ? 'Unlocked' : st.restoreBusy ? 'Checking' : 'Restore'), off: () => st.owned || st.restoreBusy })]),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  const cx = L.mode === 'wide' ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  const maxW = L.mode === 'wide' ? T.play.x - S.x - 40 : S.w - 72;
  titleText(ctx, cx, T.titleY, T.size, 'THANJAVUR', 'DANCING DOLL', maxW);
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  if (!drawLockupImg(ctx, T.lock)) drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.95 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_RUNS - st.demoRuns)} left`, 20, { align: 'right' });
  void h; void w;
}

// ---- levels + detail -------------------------------------------------------------------------------------------------------------------
const stars3 = (ctx, cx, cy, size, n) => drawStars(ctx, cx, cy, size, n, 3, 1.2);
const paintOf = (stars) => clamp(stars ?? 0, 0, 3);

function renderLevels(ctx, st, L) {
  const G = L.levels, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a level', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), G.titleY, 34, PAL.vermilion, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: S.w - 520 });
  const dstars = st.best.daily?.stars ?? 0;
  button(ctx, G.daily, 'Daily Set', { kind: 'quiet', size: 24, icon: 'sun', sub: dstars ? `best ${dstars} stars` : 'new every day' });
  G.labels.forEach((r, i) => {
    const tot = [0, 1, 2, 3].reduce((a, k) => a + (st.best[i * 4 + k]?.stars ?? 0), 0);
    if (G.wide) {
      txt(ctx, `${i + 1}. ${SETS[i].name}`, r.x + 4, r.y + r.h * 0.3, 17, PAL.text, { weight: 400, font: DISPLAY, maxW: r.w - 8 });
      txt(ctx, `${tot}/12 stars`, r.x + 4, r.y + r.h * 0.75, 15, PAL.dim, { weight: 800 });
    } else {
      txt(ctx, `${i + 1}. ${SETS[i].name}`, r.x + 6, r.y + r.h * 0.5, Math.min(26, r.h * 0.6), PAL.text, { weight: 400, font: DISPLAY, maxW: r.w * 0.72 });
      txt(ctx, `${tot}/12`, r.x + r.w - 6, r.y + r.h * 0.5, 20, PAL.dim, { align: 'right', weight: 800 });
    }
  });
  G.cells.forEach((r, i) => {
    const best = st.best[i] ?? {}, locked = st.demo && i >= DEMO_LEVELS, lv = levelFor(i), s = levelStats(lv);
    panel(ctx, r, { rad: 18, fill: locked ? 'rgba(255,247,228,0.6)' : 'rgba(255,247,228,0.95)' });
    txt(ctx, String(i % 4 + 1), r.x + 14, r.y + (G.wide ? r.h * 0.3 : 24), G.wide ? 22 : 26, locked ? PAL.dim : PAL.vermilion, { font: DISPLAY, weight: 400 });
    // the level's first doll, painted according to the stars earned
    const wideCell = G.wide;
    const R = wideCell ? (r.h - 14) / 5.7 : Math.min(r.w * 0.34, (r.h - 26) / 4.4);   // big doll filling the card; stars tuck in at its side
    ctx.save(); rrect(ctx, r, 18); ctx.clip();
    ctx.globalAlpha = locked ? 0.45 : 1;
    const d = lv.dolls[0], sw = Math.sin(st.t * 1.3 + i) * 0.08;
    drawDoll(ctx, r.x + r.w * (wideCell ? 0.3 : 0.36), r.y + r.h - (wideCell ? 6 : 12), R, { th: sw, lag: -sw * 0.4, ch: d.ch, variant: d.variant, paint: paintOf(best.stars) });
    ctx.globalAlpha = 1;
    ctx.restore();
    if (wideCell) stars3(ctx, r.x + r.w * 0.72, r.y + r.h * 0.6, Math.min(9, r.w * 0.06), best.stars ?? 0);
    else stars3(ctx, r.x + r.w * 0.74, r.y + r.h - 14, Math.min(7, r.w * 0.075), best.stars ?? 0);
    if (!wideCell) txt(ctx, `${s.dolls} doll${s.dolls > 1 ? 's' : ''}`, r.x + r.w - 12, r.y + 24, 18, PAL.dim, { align: 'right', weight: 700 });
    if (locked) txt(ctx, 'Full game', r.x + r.w / 2, r.y + r.h * 0.5, 18, PAL.text, { align: 'center', weight: 800 });
  });
}

function renderDetail(ctx, st, L) {
  const D = L.detail, S = L.S, lv = levelFor(st.sel, st.day), s = levelStats(lv), best = st.best[st.sel === DAILY ? 'daily' : st.sel] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  const title = lv.daily ? 'Daily Set' : `Level ${lv.name}`;
  txt(ctx, title, S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), L.levels.titleY, 38, PAL.vermilion, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: S.w - 380 });
  const I = D.info;
  panel(ctx, I, { rad: 26 });
  const pad = 22;
  txt(ctx, lv.daily ? 'Three dolls chosen for today.' : SETS[lv.set].name, I.x + pad, I.y + 38, 28, PAL.text, { weight: 800, font: DISPLAY, maxW: I.w - pad * 2 });
  ctx.font = `600 22px ${UI}`;
  const lines = wrap(ctx, lv.daily ? 'The same set for everyone today. Stars are kept for your best.' : SETS[lv.set].blurb, I.w - pad * 2).slice(0, 2);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + pad, I.y + 76 + i * 28, 22, PAL.dim, { weight: 600 }));
  const y = I.y + 76 + lines.length * 28 + 16;
  const rows = [
    ['Dolls', String(s.dolls)], ['Swing', s.minT === s.maxT ? `${s.minT.toFixed(1)} s` : `${s.minT.toFixed(1)} to ${s.maxT.toFixed(1)} s`],
    ['Lean', `up to ${Math.round(s.maxA)}°`], ['Window', `±${s.tol.toFixed(1)}°`], ['Breeze', s.breeze > 0 ? (s.breeze > 0.55 ? 'strong' : 'gentle') : 'none'],
  ];
  const cols = I.w > 640 ? 2 : 1, cw = (I.w - pad * 2) / cols, lh = 32;
  rows.forEach((r, i) => {
    const cx = I.x + pad + (i % cols) * cw, cy = y + Math.floor(i / cols) * lh;
    txt(ctx, r[0], cx, cy, 20, PAL.dim, { weight: 700, maxW: cw * 0.4 });
    txt(ctx, r[1], cx + cw * 0.42, cy, 21, PAL.text, { weight: 800, maxW: cw * 0.56 });
  });
  const rowsH = Math.ceil(rows.length / cols) * lh;
  const py0 = y + rowsH + 6, py1 = I.y + I.h - 66;
  if (py1 - py0 > 120) {
    const poster = { x: I.x + pad, y: py0, w: I.w - pad * 2, h: py1 - py0 };
    ctx.save(); rrect(ctx, poster, 18); ctx.clip();
    const pw = st.poster ?? (st.poster = { key: -2, W: null, V: null });
    const key = st.sel + ':' + st.day;
    if (pw.key !== key) { pw.key = key; pw.W = createWorld(lv); pw.V = { t: 0, lag: [0, 0, 0], hist: [], parts: [], pops: [], glow: [0, 0, 0], tapFx: [0, 0, 0], guide: [], shake: 0, lamp: 0 }; }
    pw.V.t = st.t;
    renderStage(ctx, poster, pw.W, pw.V, { t: st.t, rails: false, tags: false, topPad: 30, lean: 1.7, ghost: 'preview', ghostAlpha: 0.55, v3: false, paint: [paintOf(best.stars), paintOf(best.stars), paintOf(best.stars)] });
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(168,111,12,0.6)'; rrect(ctx, poster, 18); ctx.stroke();
  }
  const by = I.y + I.h - 30;
  stars3(ctx, I.x + pad + 50, by, 17, best.stars ?? 0);
  txt(ctx, best.score ? `Best ${best.score}` : 'Not played yet', I.x + I.w - pad, by, 24, PAL.text, { align: 'right', weight: 800, maxW: I.w * 0.58 });
  button(ctx, D.learn, 'Practice', { kind: 'quiet', size: 32, sub: 'Wider window, arrows and hints', icon: 'bulb' });
  button(ctx, D.race, 'Play', { kind: 'primary', size: 36, sub: 'Scored, for stars', icon: 'play' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The game plays it for you', icon: 'eye' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const Rr = L.result, r = st.result, p = Rr.panel, lv = levelFor(r.level, st.day);
  panel(ctx, p, { fill: 'rgba(255,247,228,0.97)', rad: 30 });
  edgeStroke(ctx, p, 30, 0.45);
  const cx = p.x + p.w / 2, wide = L.mode === 'wide';
  const head = r.mode === 'auto' ? 'WATCH COMPLETE' : r.mode === 'practice' ? 'PRACTICE DONE' : r.stars >= 3 ? 'PERFECT SWAY' : r.stars >= 1 ? 'WELL SWAYED' : 'TRY AGAIN';
  txt(ctx, head, cx, p.y + 52, 34, r.stars >= 1 && r.mode === 'play' ? PAL.vermilion : PAL.text, { align: 'center', font: DISPLAY, weight: 400, maxW: p.w - 40 });
  txt(ctx, lv.daily ? 'Daily Set' : `Level ${lv.name}  ·  ${SETS[lv.set].name}`, cx, p.y + 94, 24, PAL.dim, { align: 'center', weight: 700, maxW: p.w - 40 });
  stars3(ctx, cx, p.y + 158, 34, r.mode === 'play' ? r.stars : 0);
  txt(ctx, String(r.score), cx, p.y + 244, 84, PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 10, maxW: p.w - 60 });
  if (r.newBest) txt(ctx, 'NEW BEST', cx, p.y + 304, 22, PAL.good, { align: 'center', weight: 800 });
  const top = p.y + (r.newBest ? 346 : 322), ch = wide ? 32 : 38;
  const rows = [['In time', `${Math.round(r.sync * 100)}%`, PAL.text], ['Settled', `${Math.round(r.settle * 100)}%`, PAL.text], ['Longest run in time', `${r.streak.toFixed(1)} s`, PAL.text]];
  lv.dolls.forEach((d, i) => rows.push([`Doll ${i + 1}`, `${Math.round((r.per[i] ?? 0) * 100)}% in time`, PAL.dim]));
  const gx = p.x + 60, gw = p.w - 120;
  rows.slice(0, wide ? 4 : 6).forEach(([n, v, col], i) => {
    txt(ctx, n, gx, top + i * ch, 23, col, { weight: 700 });
    txt(ctx, v, gx + gw, top + i * ch, 25, PAL.text, { align: 'right', weight: 800 });
  });
  const shown = rows.slice(0, wide ? 4 : 6).length, free = Rr.again.y - (top + shown * ch) - 10;
  if (free > 120 && !wide) {
    const R = Math.min((free - 12) / 5.7, p.w / (lv.dolls.length * 3.2)), n = lv.dolls.length, gy = top + shown * ch + free - 4;
    lv.dolls.forEach((d, i) => {
      const sw = Math.sin(st.t * 1.4 + i) * 0.1 * (r.stars > 0 ? 1 : 0.2);
      drawDoll(ctx, p.x + (p.w * (i + 0.5)) / n, gy, R, { th: sw, lag: -sw * 0.4, ch: d.ch, variant: d.variant, paint: r.mode === 'play' ? Math.max(1, r.stars) : 3 });
    });
  }
  button(ctx, Rr.again, 'Again', { kind: 'primary', size: 28, icon: 'restart' });
  const hasNext = r.level < LEVEL_COUNT - 1;
  button(ctx, Rr.next, 'Next', { kind: hasNext && r.level !== DAILY ? 'quiet' : 'disabled', size: 28, icon: 'next' });
  button(ctx, Rr.levels, 'Levels', { kind: 'quiet', size: 28 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 28 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15, { light: true });
}

// ---- pause menu + demo limit ------------------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Levels' };
function drawPauseMenu(ctx, st, L, items) {
  ctx.fillStyle = 'rgba(58,22,32,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(255,247,228,0.98)', rad: 28 });
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 38, PAL.vermilion, { align: 'center', font: DISPLAY, weight: 400 });
  const fi = st.pl?.pauseIdx ?? 0;
  items.forEach((it, i) => {
    button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' ? 'primary' : 'quiet', size: 30 });
    if (i === fi) { ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = PAL.cobalt; ctx.beginPath(); ctx.roundRect(M.btns[i].x - 5, M.btns[i].y - 5, M.btns[i].w + 10, M.btns[i].h + 10, 26); ctx.stroke(); ctx.restore(); }
  });
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  panel(ctx, p, { fill: 'rgba(255,247,228,0.98)', rad: 30 });
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 36, PAL.vermilion, { align: 'center', font: DISPLAY, weight: 400, maxW: p.w - 40 });
  txt(ctx, `The full game has ${LEVEL_COUNT} levels in six sets,`, p.x + p.w / 2, p.y + 160, 26, PAL.text, { align: 'center', weight: 700, maxW: p.w - 40 });
  txt(ctx, 'a daily set, and a painted doll collection.', p.x + p.w / 2, p.y + 200, 26, PAL.text, { align: 'center', weight: 700, maxW: p.w - 40 });
  txt(ctx, 'Get Thanjavur Dancing Doll for iPhone and Android.', p.x + p.w / 2, p.y + 270, 24, PAL.cobalt, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.dim, { align: 'center', weight: 700 });
  void TAU; void PHASES; void TOTAL;
}
