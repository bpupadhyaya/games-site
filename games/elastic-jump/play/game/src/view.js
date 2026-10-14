// Drawing for every screen. render() is the single entry point; the play screen lives in playview.js, text screens in docview.js.
import { PAL, DISPLAY, drawKid, drawPoseIcon, drawStars, KIDS, clamp, TAU } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay } from './playview.js';
import { drawPlayground, demoVisual } from './stage.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { LEVELS, TIMING, THINK, TRIES, POSE_BY_KEY, stepsOf } from './moves.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

// Title lettering: a real extrusion (stacked offset copies fading to deep rose), a navy outline, a lit enamel face and a thin top highlight.
function titleText(ctx, cx, y, size, label) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`; ctx.lineJoin = 'round';
  const depth = Math.max(6, Math.round(size * 0.12));
  for (let i = depth; i >= 1; i--) {
    const t = i / depth;
    ctx.lineWidth = size * 0.2; ctx.strokeStyle = `rgb(${Math.round(120 + 70 * (1 - t))},${Math.round(14 + 20 * (1 - t))},${Math.round(60 + 30 * (1 - t))})`;
    ctx.strokeText(label, cx, y + i);
  }
  ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#ff2d73'; ctx.strokeText(label, cx, y);
  ctx.lineWidth = size * 0.1; ctx.strokeStyle = '#14204a'; ctx.strokeText(label, cx, y);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#ffeaf3'); g.addColorStop(0.55, '#ffc4da'); g.addColorStop(1, '#ff8fb8');
  ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.globalAlpha = 0.45; ctx.fillStyle = '#fff'; ctx.save(); ctx.beginPath(); ctx.rect(cx - size * 6, y - size * 0.55, size * 12, size * 0.2); ctx.clip(); ctx.fillText(label, cx, y - 1.5); ctx.restore();
  ctx.restore();
}

// Dimmed playground behind the menus.
function backdrop(ctx, st, L, dim = 0.55, gl = false) {
  if (!gl) {
    const vis = demoVisual(st.t, 0.34, 0.12);
    drawPlayground(ctx, L.w, L.h, { x: 0, y: L.h * 0.28, w: L.w, h: L.h * 0.72 }, vis, st.t, { vignette: 0.1 });
  }
  ctx.fillStyle = `rgba(12,20,52,${dim})`; ctx.fillRect(0, 0, L.w, L.h);
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const sc = st.scene, gl = !!(view && view.gl3d);          // gl: the 3D presenter draws the scene behind this transparent canvas
  ctx.clearRect(0, 0, L.w, L.h);
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  if (sc === 'title') renderTitle(ctx, st, L, gl);
  else {
    backdrop(ctx, st, L, sc === 'prep' ? 0.25 : sc === 'about' || sc === 'howto' || sc === 'rules' || sc === 'settings' ? 0.5 : 0.58, gl);
    if (sc === 'levels') renderLevels(ctx, st, L);
    else if (sc === 'prep') renderPrep(ctx, st, L);
    else if (sc === 'result') renderResult(ctx, st, L);
    else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: [...ABOUT, ...(st.credits || [])] });
    else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
    else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
    else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
    else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  }
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(14,22,58,0.94)', stroke: 'rgba(255,248,236,0.45)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('lat', 'Latency (ms)', 'stepper', () => p.lat, 'Raise if the beat feels late'),
    row('think', 'Think time (s)', 'stepper', () => p.thinkSec, `Watch and Learn, ${THINK.min} to ${THINK.max} s`),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and no shaking'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [st.owned ? row('restore', 'Full game unlocked', 'info', () => '', 'Thank you for playing')
      : row('restore', 'Restore purchase', 'button', () => '', st.restoreMsg || 'Bought it already?', { btn: st.restoreBusy ? 'Checking' : 'Restore' })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, gl = false) {
  const T = L.title, S = L.S, wide = L.mode === 'wide';
  const vis = demoVisual(st.t, 0.34, 0.14);
  if (!gl) drawPlayground(ctx, L.w, L.h, wide ? { x: T.hero.x, y: T.hero.y + T.hero.h * 0.22, w: T.hero.w, h: T.hero.h * 0.78 } : { x: 0, y: T.hero.y + T.hero.h * 0.2, w: L.w, h: T.hero.h * 0.8 }, vis, st.t, { vignette: 0.2 });
  if (!wide) { const g = ctx.createLinearGradient(0, T.col.y - 120, 0, L.h); g.addColorStop(0, 'rgba(12,20,52,0)'); g.addColorStop(0.35, 'rgba(12,20,52,0.82)'); g.addColorStop(1, 'rgba(12,20,52,0.96)'); ctx.fillStyle = g; ctx.fillRect(0, T.col.y - 120, L.w, L.h - T.col.y + 120); }
  else { ctx.fillStyle = 'rgba(12,20,52,0.9)'; ctx.fillRect(T.col.x - 28, 0, L.w - T.col.x + 28, L.h); }
  const tcx = wide ? T.hero.x + T.hero.w / 2 : S.x + S.w / 2, size = T.size;
  titleText(ctx, tcx, T.titleY, size, 'ELASTIC');
  titleText(ctx, tcx, T.titleY + size * 0.98, size, 'JUMP');
  chip(ctx, tcx, T.titleY + size * 1.82, 'Chinese jump rope', Math.max(22, size * 0.2), { align: 'center', fill: 'rgba(255,79,139,0.95)', color: '#fff' });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(300, (wide ? T.col.w : S.w) * 0.6), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- levels ------------------------------------------------------------------------------------------------------------------------
function heightFigure(ctx, x, y, w, h, hgt, style = KIDS.jumper) {
  const k = Math.min(h * 0.95, w * 1.1), gx = x + w / 2, gy = y + h - 6;
  drawKid(ctx, style, { k, x: gx, feet: [{ x: gx - k * 0.055, y: gy }, { x: gx + k * 0.055, y: gy }], armL: 0.2, armR: 0.2, hairSwing: 0.05 });
  const by = gy - hgt * k;
  ctx.strokeStyle = PAL.pink; ctx.lineWidth = Math.max(4, k * 0.035); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx - k * 0.32, by + k * 0.02); ctx.lineTo(gx + k * 0.32, by + k * 0.02); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gx - k * 0.3, by - k * 0.02); ctx.lineTo(gx + k * 0.3, by - k * 0.02); ctx.stroke();
}

function renderLevels(ctx, st, L) {
  const G = L.levels, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a height', S.x + S.w / 2, G.titleY, 42, PAL.gold, { align: 'center', weight: 700, stroke: 8, maxW: S.w - 2 * (G.back.w + 30) });
  LEVELS.forEach((lv, i) => {
    const r = G.cards[i], best = st.best[lv.id] ?? {};
    const locked = !(i === 0 || st.dev || st.best[LEVELS[i - 1].id]) || (st.demo && i >= 2);
    panel(ctx, r, { fill: 'rgba(14,22,58,0.84)' }); edgeStroke(ctx, r, 24, 0.22);
    const pad = 16, figW = Math.min(r.w * 0.42, 190);
    heightFigure(ctx, r.x + pad, r.y + 10, figW, r.h - 20, lv.hgt);
    const tx = r.x + pad * 1.5 + figW, tw = r.w - (tx - r.x) - pad;
    txt(ctx, `${i + 1}`, tx, r.y + r.h * 0.17, 24, PAL.pink, { weight: 800 });
    txt(ctx, lv.name, tx, r.y + r.h * 0.35, Math.min(36, r.h * 0.15), PAL.text, { weight: 700, maxW: tw });
    chip(ctx, tx, r.y + r.h * 0.54, `${lv.bpm} bpm`, 18, {});
    drawStars(ctx, tx + 36, r.y + r.h * 0.76, Math.min(30, r.h * 0.12), best.stars || 0);
    if (best.score) txt(ctx, `Best ${best.score}`, tx, r.y + r.h * 0.92, 18, PAL.gold, { weight: 700, maxW: tw });
    if (locked) {
      ctx.fillStyle = 'rgba(8,12,34,0.62)'; rrect(ctx, r, 24); ctx.fill();
      txt(ctx, st.demo && i >= 2 ? 'In the full game' : 'Locked', r.x + r.w / 2, r.y + r.h / 2, 26, PAL.text, { align: 'center', weight: 800, maxW: r.w - 20 });
    }
  });
}

// ---- prep ------------------------------------------------------------------------------------------------------------------------------
function routineStrip(ctx, steps, x, y, w, h) {
  const n = steps.length, cols = Math.min(n, w > 600 ? 12 : 8), rows = Math.ceil(n / cols);
  const cell = Math.min(w / cols, (h - 4) / rows, 84);
  const ox = x + (w - cell * cols) / 2;
  steps.forEach((m, i) => drawPoseIcon(ctx, m, ox + cell * (i % cols) + cell / 2, y + cell * Math.floor(i / cols) + cell / 2, cell * 0.84));
  return rows * cell;
}
function stripSize(n, w) {
  const cols = Math.min(n, w > 600 ? 12 : 8), rows = Math.ceil(n / cols), cell = Math.min(w / cols, 84);
  return { cols, rows, cell, h: rows * cell };
}
function renderPrep(ctx, st, L) {
  const D = L.prep, S = L.S, lv = LEVELS[st.sel], best = st.best[lv.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, `${st.sel + 1}. ${lv.name}`, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 44, PAL.gold, { align: 'center', weight: 700, stroke: 8, maxW: S.w - 2 * (D.back.w + 30) });
  const pad = 24, wide = L.mode === 'wide', steps = stepsOf(lv).map((c) => POSE_BY_KEY[c]);
  const figH = clamp(D.info.h * (wide ? 0.5 : 0.26), 130, 250), figW = wide ? Math.min(D.info.w * 0.28, 220) : Math.min(D.info.w * 0.3, 200);
  const sz = stripSize(steps.length, D.info.w - pad * 2);
  const need = 20 + Math.max(figH, 190) + 36 + 24 + sz.h + 20;
  const I = { x: D.info.x, y: D.info.y, w: D.info.w, h: Math.min(D.info.h, need) };
  panel(ctx, I, { fill: 'rgba(14,22,58,0.86)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  heightFigure(ctx, I.x + pad, I.y + 20, figW, figH, lv.hgt);
  const tx = I.x + pad * 1.5 + figW, tw = I.w - (tx - I.x) - pad;
  ctx.font = `500 26px ${DISPLAY}`;
  const lines = wrap(ctx, lv.blurb, tw);
  lines.slice(0, 3).forEach((ln, i) => txt(ctx, ln, tx, I.y + 52 + i * 34, 26, PAL.text, { weight: 500, maxW: tw }));
  let y = I.y + 52 + Math.min(3, lines.length) * 34 + 22;
  chip(ctx, tx, y, `${lv.bpm} bpm`, 22, {}); chip(ctx, tx + 150, y, `${steps.length} steps`, 22, {});
  y += 48;
  if (best.score) { txt(ctx, `Best ${best.score}`, tx, y, 26, PAL.gold, { weight: 800 }); drawStars(ctx, tx + tw - 60, y, 30, best.stars || 0); }
  else txt(ctx, 'No score yet', tx, y, 24, PAL.dim, { weight: 600 });
  y = Math.max(I.y + 20 + figH, y + 30) + 26;
  txt(ctx, 'The routine', I.x + pad, y, 22, PAL.gold, { weight: 800 }); y += 22;
  const avail = I.y + I.h - y - 14;
  if (avail > 40) routineStrip(ctx, steps, I.x + pad, y, I.w - pad * 2, avail);
  ctx.restore();
  button(ctx, D.play, 'Play', { kind: 'primary', size: 34, icon: 'play', sub: `${TRIES} trips and the band comes down` });
  button(ctx, D.practice, 'Practice', { kind: 'quiet', size: 32, sub: 'Slower beat, trips are forgiven' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'eye', sub: 'See the routine, then watch it jumped' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, lv = LEVELS[r.li];
  const split = L.mode === 'wide' || p.h < 900;
  panel(ctx, p, { fill: 'rgba(14,22,58,0.93)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, r.failed ? 'THE BAND CAME DOWN' : r.mode === 'play' ? 'ROUTINE COMPLETE' : r.mode === 'practice' ? 'PRACTICE DONE' : 'WATCHED', p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, lv.name, p.x + p.w / 2, p.y + 98, 52, PAL.gold, { align: 'center', weight: 700, stroke: 8, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1000, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  if (r.mode === 'play') drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.failed ? 'Try again' : r.grade, lx, y, split ? (r.failed ? 52 : 130) : (r.failed ? 64 : 150) * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', weight: 700, stroke: 10, maxW: split ? p.w * 0.36 : p.w - 80 });
  if (r.newBest) chip(ctx, lx, y + (split ? 92 : 100 * k), 'NEW BEST', 24, { align: 'center', fill: PAL.pink, color: '#fff' });
  let ry = split ? p.y + 160 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,255,255,0.09)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 34, PAL.text, { align: 'center', weight: 700, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', String(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`); tile(rx0 + (tw + g) * 2, ry, tw, 'BEST COMBO', String(r.maxCombo));
  ry += 126;
  const cw = (rw - g * 3) / 4;
  [['perfect', 'PERFECT'], ['good', 'GOOD'], ['ok', 'OKAY'], ['miss', 'TRIPS']].forEach(([kk, lab], i) => {
    const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,255,255,0.07)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill();
    txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 700, maxW: cw - 6 });
    txt(ctx, lab, x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 });
  });
  const canNext = !r.failed && r.mode === 'play' && r.li + 1 < LEVELS.length;
  button(ctx, Rr.again, r.failed ? 'Try again' : r.mode === 'play' ? 'Play again' : 'Again', { kind: 'primary', size: 30 });
  button(ctx, Rr.next, canNext ? `Next: ${LEVELS[r.li + 1].name}` : 'Heights', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(14,22,58,0.94)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 44, PAL.gold, { align: 'center', weight: 700, stroke: 8, maxW: r.w - 40 });
  ctx.font = `500 28px ${DISPLAY}`;
  wrap(ctx, 'Get the full Elastic Jump on iPhone and Android: all eight heights, from the ankles to the neck.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
void TAU; void THINK;
