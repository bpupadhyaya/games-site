// Drawing for every screen. render() is the single entry point; the show lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawStage, drawLights, drawLantern, drawPlate, drawPole, drawStand, drawStars, clamp, clamp01 } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TUNE, SPEEDS } from './engine.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';
import { v3 } from './v3.js';

const TYPES5 = ['porcelain', 'lacquer', 'jade', 'gold', 'porcelain'];

function titleText(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let s = size; ctx.font = `700 ${s}px ${DISPLAY}`;
  const m = ctx.measureText(label).width; if (maxW && m > maxW) { s = size * maxW / m; ctx.font = `700 ${s}px ${DISPLAY}`; }
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fff6cf'); g.addColorStop(0.5, '#f4cf6a'); g.addColorStop(1, '#c07a1c');
  ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.14; ctx.strokeStyle = '#2a0610'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,170,60,0.55)'; ctx.shadowBlur = s * 0.22; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
}

// The title scene's own little show: five plates that tire and are whipped again, forever.
function heroBase(H) { return H.y + H.h - 36; }
function hero(ctx, st, H, calm) {
  const n = 5, span = Math.min(H.w - 40, 640), sp = span / n, rx = Math.min(sp * 0.4, H.h * 0.16, 66);
  const base = heroBase(H), poleH = Math.max(60, Math.min(H.h - rx * 1.6, H.h * 0.92));
  for (let i = 0; i < n; i++) {
    const cx = H.x - span / 2 + sp * (i + 0.5), back = i % 2 === 1;
    const period = 5.2 + (i % 3) * 0.7, u = ((st.t + i * 1.37) % period) / period;
    const e = 1 - u * 0.78;
    const pl = { type: TYPES5[i], e, ph: st.t * (2 + (1 - e) * 7) + i, spinA: st.t * (4 + e * 26) + i, jolt: 0, flash: u < 0.04 ? 1 - u / 0.04 : 0, charge: 0 };
    const by = base - (back ? rx * 0.7 : 0), top = by - poleH * (back ? 0.8 : 1);
    drawStand(ctx, cx, by, rx, 0.6);
    const aw = pl.e > 0.55 ? 0 : (0.55 - pl.e) / 0.55;
    const ox = aw * rx * 0.3 * Math.sin(pl.ph + 0.6) * (calm ? 0.5 : 1);
    drawPole(ctx, cx, by - rx * 0.18, cx + ox * 0.9, top + rx * 0.1, Math.max(4, rx * 0.13));
    drawPlate(ctx, cx, top, rx, pl, { calm });
  }
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const { w, h } = L, sc = st.scene;
  meta.previewBadge = null;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); return; }
  const floorY = sc === 'title' ? Math.round(heroBase(L.title.hero) - 64) : Math.round(h * 0.8);
  v3.scrim = 0; v3.heroRect = null; v3.scene = sc;
  if (v3.on) {
    ctx.clearRect(0, 0, w, h);                                             // the lit 3D courtyard shows through
    if (sc === 'title') {
      v3.heroRect = L.title.hero;
      const tg = ctx.createLinearGradient(0, 0, 0, h * 0.34); tg.addColorStop(0, 'rgba(8,2,8,0.7)'); tg.addColorStop(1, 'rgba(8,2,8,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, w, h * 0.34);
      const bg = ctx.createLinearGradient(0, h * 0.62, 0, h); bg.addColorStop(0, 'rgba(8,2,8,0)'); bg.addColorStop(1, 'rgba(8,2,8,0.72)'); ctx.fillStyle = bg; ctx.fillRect(0, h * 0.62, w, h * 0.38);
    } else if (sc === 'result') v3.scrim = 0.45;
    else v3.scrim = 0.72;
  } else {
  drawStage(ctx, w + 20, h + 20, floorY);
  drawLights(ctx, w, h, floorY, st.t, st.prefs.calm);
  if (sc === 'title') {
    if (L.mode !== 'wide') {
      const ly = L.S.y + 70 + Math.min(h, 1400) * 0.16;
      drawLantern(ctx, L.S.x + Math.max(36, w * 0.075), ly, Math.min(32, w * 0.045), st.t, 0.7);
      drawLantern(ctx, L.S.x + L.S.w - Math.max(36, w * 0.075), ly + 20, Math.min(32, w * 0.045), st.t + 1.7, 0.7);
    }
  } else if (sc !== 'result') { ctx.fillStyle = 'rgba(8,0,8,0.5)'; ctx.fillRect(0, 0, w, h); }
  }
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'setup') renderSetup(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about' + st.credits.length, title: 'About', blocks: st.credits.length ? [...ABOUT, { h: 'Credits and licences' }, ...st.credits.map((p) => ({ p }))] : ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  if (st.toast) {
    const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(14,4,14,0.9)', stroke: 'rgba(244,207,106,0.5)' });
    ctx.restore();
  }
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('gauges', 'Timing gauges', 'toggle', () => p.gauges, 'The small bar under each pole'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Less wobble, shake and sparks'),
    row('think', 'Think time (s)', 'stepper', () => p.thinkSec, 'Lesson think pause'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', () => (st.owned ? 'Full game unlocked' : 'Restore purchase'), 'button', () => '',
      () => st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Bought it before?'),
      { btn: () => (st.restoreBusy ? 'Checking' : st.owned ? 'Owned' : 'Restore'), disabled: () => st.owned || st.restoreBusy })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = L.mode === 'wide';
  const tcx = wide ? T.hero.x : S.x + S.w / 2, size = T.size, maxW = (wide ? T.col.x - S.x : S.w) - 40;
  if (!v3.on) hero(ctx, st, { x: T.hero.x, y: T.hero.y, w: T.hero.w, h: T.hero.h }, st.prefs.calm);
  titleText(ctx, tcx, T.titleY, size, 'PLATE', maxW);
  titleText(ctx, tcx, T.titleY + size * 0.98, size * 0.82, 'SPINNING', maxW);
  txt(ctx, 'CHINESE ACROBATIC STICKS', tcx, T.titleY + size * 1.75, Math.max(20, size * 0.2), PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 5, maxW });
  button(ctx, T.play, 'Perform', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.prac, 'Practice', { kind: 'quiet', size: 32, icon: 'restart' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26, icon: 'help' });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26, icon: 'scroll' });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26, icon: 'info' });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26, icon: 'gear' });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- practice setup ----------------------------------------------------------------------------------------------------------------------------------
function renderSetup(ctx, st, L) {
  const U = L.setup, S = L.S, s = st.setup;
  button(ctx, U.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Practice', S.x + S.w / 2, U.back.y + U.back.h / 2, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (U.back.w + 30) });
  panel(ctx, U.panel, { fill: 'rgba(18,4,14,0.85)' }); if (!v3.on) edgeStroke(ctx, U.panel, 24, 0.3);
  const p = U.panel;
  ctx.font = `500 26px ${UI}`;
  wrap(ctx, 'Plates never break in practice. Pick how many poles and how fast, then learn the rhythm of the whips.', p.w - 56).forEach((ln, i) => txt(ctx, ln, p.x + 28, p.y + 34 + i * 34, 26, PAL.text, { weight: 500 }));
  const row = (r, label, val, dec, inc, canDec, canInc) => {
    ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, r, 18); ctx.fill();
    txt(ctx, label, r.x + 20, r.y + r.h / 2, 30, PAL.text, { weight: 700, maxW: r.w * 0.34 });
    button(ctx, dec, '-', { kind: canDec ? 'quiet' : 'disabled', size: 38, noShadow: true });
    button(ctx, inc, '+', { kind: canInc ? 'quiet' : 'disabled', size: 38, noShadow: true });
    txt(ctx, val, (dec.x + dec.w + inc.x) / 2, r.y + r.h / 2, 32, PAL.gold, { align: 'center', weight: 800, maxW: inc.x - dec.x - dec.w - 8 });
  };
  row(U.row1, 'Poles', String(s.poles), U.polesDec, U.polesInc, s.poles > 1, s.poles < TUNE.maxPoles);
  row(U.row2, 'Speed', SPEEDS[s.speedIdx].name, U.speedDec, U.speedInc, s.speedIdx > 0, s.speedIdx < SPEEDS.length - 1);
  button(ctx, U.start, 'Start', { kind: 'primary', size: 38, icon: 'play' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, wide = L.mode === 'wide' || p.h < 900;
  panel(ctx, p, { fill: 'rgba(18,4,14,0.9)' }); if (!v3.on) edgeStroke(ctx, p, 28, 0.55);
  const head = r.mode === 'auto' ? 'LESSON COMPLETE' : r.mode === 'practice' ? 'PRACTICE' : 'THE SHOW IS OVER';
  txt(ctx, head, p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  const stars = r.act >= 8 ? 3 : r.act >= 5 ? 2 : r.act >= 3 ? 1 : 0;
  const lx = wide ? p.x + p.w * 0.25 : p.x + p.w / 2, rx0 = wide ? p.x + p.w * 0.48 : p.x + 32, rw = wide ? p.w * 0.5 - 28 : p.w - 64;
  let y = p.y + (wide ? 120 : 130);
  txt(ctx, 'SCORE', lx, y, 22, PAL.gold, { align: 'center', weight: 800 });
  txt(ctx, String(Math.round(r.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), lx, y + 66, wide ? 76 : 96, PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: wide ? p.w * 0.4 : p.w - 60 });
  y += wide ? 150 : 170;
  if (r.mode === 'perform') drawStars(ctx, lx, y + 10, wide ? 38 : 46, stars, 3, 1.3);
  if (r.newBest) chip(ctx, lx, y + (wide ? 76 : 96), 'NEW BEST', 24, { align: 'center', fill: '#d82f3f', color: '#fff' });
  else if (r.mode === 'perform') txt(ctx, `Best ${st.best.score}`, lx, y + (wide ? 76 : 96), 26, PAL.dim, { align: 'center', weight: 700 });
  let ry = wide ? p.y + 120 : y + (wide ? 100 : 150);
  const tile = (x, yy, ww, label, val) => { ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy, w: ww, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + ww / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: ww - 8 }); txt(ctx, val, x + ww / 2, yy + 74, 38, PAL.text, { align: 'center', font: DISPLAY, weight: 700, maxW: ww - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'ACT', String(r.act)); tile(rx0 + tw + g, ry, tw, 'BEST COMBO', String(r.maxCombo)); tile(rx0 + (tw + g) * 2, ry, tw, 'TIME', `${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, '0')}`);
  ry += 126;
  const keys = [['perfect', 'PERFECT'], ['good', 'GOOD'], ['early', 'EARLY'], ['save', 'SAVE'], ['jolt', 'JOLT']], cw = (rw - g * 4) / 5;
  keys.forEach(([k, label], i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[k]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, label, x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += 104;
  if (r.mode === 'perform') txt(ctx, `${r.cleanActs} clean ${r.cleanActs === 1 ? 'act' : 'acts'}  ·  ${r.whips} whips`, rx0 + rw / 2, ry + 10, 24, PAL.dim, { align: 'center', weight: 600, maxW: rw });
  button(ctx, Rr.again, r.mode === 'auto' ? 'Watch again' : r.mode === 'practice' ? 'Practice again' : 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(18,4,14,0.92)' }); if (!v3.on) edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Plate Spinning on iPhone and Android: endless acts, eight poles, four kinds of plate and Watch and Learn.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
