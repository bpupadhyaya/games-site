// Every screen's drawing. Reads state and the pure layouts; never changes game state (except the scroll metrics).
import { titleLayout, headerLayout, docLayout, settingsLayout, journeyRects, playLayout, pauseLayout, overLayout, demoLayout, TEXT_SCALES, THINK_STEPS, tap, host } from './layout.js';
import { UI, NUM, theme, F, setFont, txt, para, paraHeight, wrap, rr, panel, plaque, button, background, icons, rgba } from './ui.js';
import { drawCredit, drawMoreLine } from './brand.js';
import { drawScene, sceneGeom, skyAt } from './scene.js';
import { mode3d } from './mode3d.js';
import { drawPorter, drawGood, LOADS } from './porter.js';
import { DOCS } from './content.js';
import { K, TRAILS, CHAPTERS, TRAILS_PER_CHAPTER, groundY, segAt } from './engine.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const metrics = { rect: null, max: 0 };
export const SETTINGS = [
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'assist', label: 'Mode', opts: ['Normal', 'Gentle'] },
  { id: 'hand', label: 'Control circle (landscape)', opts: ['Right', 'Left'] },
  { id: 'rest', label: 'Show where to rest', opts: ['On', 'Off'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore purchase'] },
];
// Rows shown in Settings: the web demo has no store, so no Restore row; the label follows ownership / the running check.
export const settingRows = (S) => SETTINGS.filter((r) => r.id !== 'restore' || !S.demo).map((r) => (r.id === 'restore'
  ? { ...r, opts: [S.owned ? 'Full game unlocked' : S.restoreBusy ? 'Checking with the store...' : 'Restore purchase'] } : r));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const scaleOf = (S) => TEXT_SCALES[S.prefs.textIdx] ?? 1;

// ---- shared pieces -------------------------------------------------------------------------------------------------------
function header(ctx, H, title, S, flash) {
  const T = theme();
  button(ctx, H.back, '', { icon: 'back', flash: flash('back') });
  txt(ctx, title, H.title.x, H.title.y + H.title.h / 2, { size: F(46), weight: 800, fam: NUM, maxW: H.title.w, min: 24 });
  if (H.textDec) {
    const dis = (d) => (d < 0 ? S.prefs.textIdx <= 0 : S.prefs.textIdx >= TEXT_SCALES.length - 1);
    button(ctx, H.textDec, 'A-', { size: 26, disabled: dis(-1), flash: flash('tdec') });
    button(ctx, H.textInc, 'A+', { size: 30, disabled: dis(1), flash: flash('tinc') });
  }
}
function stars(ctx, cx, cy, n, size, total = 3) {
  const T = theme();
  for (let i = 0; i < total; i++) icons.star(ctx, cx + (i - (total - 1) / 2) * size * 1.15, cy, size, i < n ? T.sel : 'rgba(255,255,255,0.18)');
}
function scrollBody(ctx, rect, contentH, S, draw) {
  metrics.rect = rect; metrics.max = Math.max(0, contentH - rect.h);
  S.scrollY = clamp(S.scrollY, 0, metrics.max);
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.translate(0, -S.scrollY); draw();
  ctx.restore();
  if (metrics.max > 0) { const T = theme(), th = Math.max(40, rect.h * rect.h / contentH), ty = rect.y + (rect.h - th) * (S.scrollY / metrics.max); ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, rect.x + rect.w - 8, ty, 5, th, 3); ctx.fill(); }
}

// ---- title -------------------------------------------------------------------------------------------------------------------
export function drawTitle(ctx, w, h, S, flash) {
  const T = theme(), L = titleLayout(w, h);
  // the moving trail behind everything
  const m = S.menu;
  if (!mode3d.on) drawScene(ctx, w, h, { trail: m.trail, x: m.x, t: S.t, f: m.f, theme: 0, pose: m.pose, bridgeSway: 0, falls: [], px: L.f.land ? Math.round(L.art.w * 0.74) : 0 });
  // scrim under the buttons for legibility
  const g = ctx.createLinearGradient(0, L.top - 90, 0, h);
  g.addColorStop(0, 'rgba(6,10,24,0)'); g.addColorStop(0.25, 'rgba(6,10,24,0.55)'); g.addColorStop(1, 'rgba(6,10,24,0.78)');
  if (!L.f.land) { ctx.fillStyle = g; ctx.fillRect(0, L.top - 90, w, h - L.top + 90); }
  else { const gl = ctx.createLinearGradient(L.colX - 120, 0, w, 0); gl.addColorStop(0, 'rgba(6,10,24,0)'); gl.addColorStop(0.35, 'rgba(6,10,24,0.6)'); gl.addColorStop(1, 'rgba(6,10,24,0.8)'); ctx.fillStyle = gl; ctx.fillRect(L.colX - 120, 0, w - L.colX + 120, h); }
  // wordmark
  const land = L.f.land, big = land ? Math.min(128, L.art.h * 0.2) : Math.min(220, L.art.w * 0.36), cx = land ? L.art.x + 36 + big * 1.05 : w / 2, ty = land ? L.f.U.y0 + 36 + big * 0.95 : L.titleY;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  // embossed lettering: ivory-to-gold gradient, a dark carved outline, a bright top edge
  setFont(ctx, big, 800, NUM); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = big * 0.075; ctx.strokeStyle = '#3a1f06'; ctx.strokeText('DOKO', cx, ty);
  const lg = ctx.createLinearGradient(0, ty - big * 0.45, 0, ty + big * 0.45);
  lg.addColorStop(0, '#fffaf0'); lg.addColorStop(0.45, '#ffe6a8'); lg.addColorStop(1, '#e0a23a');
  ctx.fillStyle = lg; ctx.fillText('DOKO', cx, ty);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText('DOKO', cx, ty - 1);
  ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(6,10,24,0.7)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
  txt(ctx, 'PORTER TRAIL', cx, ty + big * 0.58, { size: big * 0.34, weight: 800, fam: NUM, color: T.accent, align: 'center', maxW: land ? big * 2.1 : L.art.w - 40 });
  ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(6,10,24,0.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 1;
  txt(ctx, 'A hill-trail trade story from Nepal', land ? Math.max(18, cx - big * 1.05) : cx, ty + big * 0.58 + big * 0.28 + (land ? 6 : 0), { size: F(land ? 26 : 28), weight: 600, color: '#fff7e6', align: land ? 'left' : 'center', maxW: land ? Math.max(300, L.art.w - 60) : L.art.w - 40 });
  ctx.restore();
  // buttons
  const B = L.buttons, bsize = 34;
  button(ctx, B.journey, 'Walk the Trail', { kind: 'accent', size: 42, icon: 'play', flash: flash('journey') });
  button(ctx, B.long, 'Long Road', { size: bsize, flash: flash('long'), sub: S.stats.bestLong ? `Best ${S.stats.bestLong} m` : '' });
  button(ctx, B.daily, 'Daily Trail', { size: bsize, flash: flash('daily'), icon: S.dailyDone ? 'check' : '', sub: S.streak ? `Streak ${S.streak}` : '' });
  button(ctx, B.learn, 'Watch and Learn', { size: bsize, icon: 'eye', flash: flash('learn') });
  button(ctx, B.howto, 'How to Play', { size: 30, flash: flash('howto') });
  button(ctx, B.rules, 'Rules', { size: 30, flash: flash('rules') });
  button(ctx, B.about, 'About', { size: 30, flash: flash('about') });
  button(ctx, B.settings, 'Settings', { size: 30, icon: 'gear', flash: flash('settings') });
  drawCredit(ctx, L.f.land ? L.art.x + L.art.w / 2 : w / 2, L.f.land ? h - 28 - (host.b || 0) : L.top - 26, 15, { dim: 0.95 });
  S.titleBrand = { x: L.f.land ? L.art.x + L.art.w / 2 : w / 2, y: L.f.land ? h - 28 - (host.b || 0) : L.top - 26 };
  if (S.msg) toast(ctx, w, h, S.msg.text, h - 90);
}

function toast(ctx, w, h, text, y) {
  const T = theme(); setFont(ctx, F(28), 600);
  const tw = Math.min(w - 40, ctx.measureText(text).width + 50), x = (w - tw) / 2;
  plaque(ctx, { x, y: y - 34, w: tw, h: 66 }, { radius: 18, tint: 'rgba(10,14,30,0.92)' });
  txt(ctx, text, w / 2, y, { size: F(28), weight: 600, align: 'center', maxW: tw - 30 });
}

// ---- journey list --------------------------------------------------------------------------------------------------------------
export function drawJourney(ctx, w, h, S, flash) {
  const T = theme(), H = headerLayout(w, h), sc = scaleOf(S);
  background(ctx, w, h);
  header(ctx, H, 'Walk the Trail', S, flash);
  const counts = CHAPTERS.map(() => TRAILS_PER_CHAPTER), J = journeyRects(H.body, counts, sc);
  S.layoutJ = J;
  scrollBody(ctx, H.body, J.h, S, () => {
    J.items.forEach((it) => {
      txt(ctx, CHAPTERS[it.ci].name, it.head.x + 6, it.head.y + it.head.h * 0.55, { size: F(36 * Math.max(1, sc * 0.85)), weight: 800, fam: NUM, color: T.accent, maxW: it.head.w - 12 });
      it.cards.forEach((r, i) => {
        const idx = it.ci * TRAILS_PER_CHAPTER + i, tr = TRAILS[idx], done = S.progress[idx], open = S.isOpen(idx);
        panel(ctx, r, { radius: 20, fill: done ? 'rgba(246,183,60,0.12)' : T.panel, line: done ? T.accent : T.line });
        ctx.save(); if (!open) ctx.globalAlpha = 0.45;
        txt(ctx, String(idx + 1), r.x + 18, r.y + 36, { size: F(40), weight: 800, fam: NUM, color: T.accent });
        const nameSize = F(26 * Math.max(1, sc * 0.8));
        const lines = wrap(ctx, tr.name, r.w - 32, nameSize, 600).slice(0, 2);
        lines.forEach((l, k) => txt(ctx, l, r.x + 18, r.y + 52 + nameSize + k * nameSize * 1.1, { size: nameSize, weight: 600, maxW: r.w - 32 }));
        txt(ctx, `${tr.kg} kg  ·  ${tr.items} goods`, r.x + 18, r.y + r.h - 56 * Math.max(1, sc * 0.5), { size: F(22 * Math.max(1, sc * 0.7)), weight: 400, color: T.dim, maxW: r.w - 32 });
        if (open) stars(ctx, r.x + r.w - 56, r.y + r.h - 24, done?.stars ?? 0, 24);
        else icons.exit(ctx, r.x + r.w - 30, r.y + 30, 20, T.dim);
        ctx.restore();
      });
    });
  });
}

// ---- documents -------------------------------------------------------------------------------------------------------------------
function blocksHeight(ctx, blocks, w, sc) {
  let y = 0;
  for (const b of blocks) {
    if (b.p) y += paraHeight(ctx, b.p, w, F(28 * sc), 400, 1.38) + 18 * sc;
    else if (b.li) for (const t of b.li) y += paraHeight(ctx, t, w - 36 * sc, F(27 * sc), 400, 1.36) + 12 * sc;
    else if (b.art) y += 250 + 14;
  }
  return y;
}
function drawBlocks(ctx, blocks, x, y, w, sc, S) {
  const T = theme();
  for (const b of blocks) {
    if (b.p) y += para(ctx, b.p, x, y, w, { size: F(28 * sc), weight: 400, lh: 1.38 }) + 18 * sc;
    else if (b.li) for (const t of b.li) {
      const hh = paraHeight(ctx, t, w - 36 * sc, F(27 * sc), 400, 1.36);
      ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(x + 10 * sc, y + F(27 * sc) * 0.7, 5 * sc, 0, TAU); ctx.fill();
      para(ctx, t, x + 36 * sc, y, w - 36 * sc, { size: F(27 * sc), weight: 400, lh: 1.36 });
      y += hh + 12 * sc;
    } else if (b.art) { drawArt(ctx, b.art, { x, y, w, h: 250 }, S); y += 250 + 14; }
  }
}
export function drawDoc(ctx, w, h, S, flash) {
  const T = theme(), L = docLayout(w, h), sc = scaleOf(S), doc = DOCS[S.doc.kind], page = doc.pages[S.doc.page];
  background(ctx, w, h);
  header(ctx, L, doc.title, S, flash);
  const inner = L.body.w - 36;
  const heading = F(40 * sc);
  const hh = paraHeight(ctx, page.title, inner, heading, 800, 1.1) + 14;
  const total = hh + blocksHeight(ctx, page.blocks, inner, sc) + 30;
  panel(ctx, L.body, { radius: 24, fill: 'rgba(255,255,255,0.045)', line: T.line });
  const rect = { x: L.body.x + 8, y: L.body.y + 8, w: L.body.w - 16, h: L.body.h - 16 };
  scrollBody(ctx, rect, total + 16, S, () => {
    setFont(ctx, heading, 800, NUM); ctx.fillStyle = T.accent;
    para(ctx, page.title, L.body.x + 18, rect.y + 6, inner, { size: heading, weight: 800, color: T.accent, lh: 1.1 });
    drawBlocks(ctx, page.blocks, L.body.x + 18, rect.y + 6 + hh, inner, sc, S);
  });
  const n = doc.pages.length;
  button(ctx, L.prev, 'Back', { size: 26, icon: 'back', disabled: S.doc.page === 0, flash: flash('prev') });
  button(ctx, L.next, 'Next', { size: 26, disabled: S.doc.page >= n - 1, flash: flash('next') });
  txt(ctx, `${S.doc.page + 1} / ${n}`, L.label.x + L.label.w / 2, L.label.y + L.label.h / 2, { size: F(26), weight: 600, align: 'center', color: T.dim });
}

// Illustrations: the game's own porter and gauges.
function drawArt(ctx, kind, r, S) {
  const T = theme(), cx = r.x + r.w / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(20,34,66,0.7)'; ctx.fill();
  const lab = (s, x, y, align = 'left') => txt(ctx, s, x, y, { size: 22, weight: 600, color: T.text, align, maxW: r.w * 0.4 });
  if (kind === 'load') {
    ctx.fillStyle = '#2f6a45'; ctx.fillRect(r.x, r.y + r.h - 34, r.w, 34);
    drawPorter(ctx, { x: r.x + r.w * 0.34, y: r.y + r.h - 34, phase: 0.1, walking: 0, rest: 0, load: 0.04, lean: 0.12, items: 5, loadKind: 'sacks', breathLevel: 1, t: 0, scale: 1.0 });
    lab('doko (basket)', r.x + r.w * 0.04, r.y + 36); lab('namlo (headstrap)', r.x + r.w * 0.58, r.y + 80); lab('tokma (T-stick)', r.x + r.w * 0.58, r.y + 160);
    ctx.strokeStyle = T.accent; ctx.lineWidth = 2;
    [[r.x + r.w * 0.18, r.y + 46, r.x + r.w * 0.29, r.y + 90], [r.x + r.w * 0.57, r.y + 82, r.x + r.w * 0.4, r.y + 102], [r.x + r.w * 0.57, r.y + 158, r.x + r.w * 0.41, r.y + 188]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
  } else if (kind === 'pad') {
    const pr = 70, py = r.y + r.h / 2;
    ctx.strokeStyle = 'rgba(255,240,210,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, py, pr, 0, TAU); ctx.stroke();
    ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(cx, py, 22, 0, TAU); ctx.fill();
    icons.back(ctx, cx - pr - 44, py, 46, T.text); icons.next(ctx, cx + pr + 44, py, 46, T.text);
    ctx.save(); ctx.translate(cx, py - pr - 34); ctx.rotate(Math.PI / 2); icons.back(ctx, 0, 0, 40, T.text); ctx.restore();
    ctx.save(); ctx.translate(cx, py + pr + 30); ctx.rotate(Math.PI / 2); icons.next(ctx, 0, 0, 40, T.text); ctx.restore();
    lab('lean back', cx - pr - 140, py + 6, 'right'); lab('lean forward', cx + pr + 140, py + 6, 'left');
    txt(ctx, 'quicker', cx + 40, py - pr - 34, { size: 22, color: T.text, weight: 600, align: 'left' }); txt(ctx, 'slower', cx + 40, py + pr + 30, { size: 22, color: T.text, weight: 600, align: 'left' });
  } else if (kind === 'segments') {
    const items = [['Climb', 'climb'], ['Steps', 'steps'], ['Bridge', 'bridge'], ['Gust', 'gust'], ['Chautara', 'rest']];
    const cw = r.w / items.length;
    items.forEach(([name, k], i) => { const x = r.x + cw * i + cw / 2, y = r.y + r.h * 0.45; segGlyph(ctx, k, x, y, Math.min(cw * 0.7, 96)); txt(ctx, name, x, r.y + r.h - 40, { size: 24, weight: 600, align: 'center', maxW: cw - 8 }); });
  } else if (kind === 'sway') {
    const px = r.x + r.w * 0.36, base = r.y + r.h - 30;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, r.y + 14); ctx.stroke(); ctx.setLineDash([]);
    for (const a of [-K.SPILL_ANGLE, K.SPILL_ANGLE]) { ctx.strokeStyle = 'rgba(255,122,92,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px + Math.sin(a) * 200, base - Math.cos(a) * 200); ctx.stroke(); }
    ctx.save(); ctx.translate(px, base); ctx.rotate(0.27);
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(54, -120); ctx.lineTo(-54, -120); ctx.closePath();
    const bg = ctx.createLinearGradient(-50, 0, 50, 0); bg.addColorStop(0, '#9a6a2c'); bg.addColorStop(0.5, '#e3b468'); bg.addColorStop(1, '#a8742e'); ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = '#6a4414'; ctx.lineWidth = 3; ctx.stroke();
    [[-26, -128], [18, -132], [-4, -146]].forEach(([x, y]) => drawGood(ctx, 'oranges', x, y, 17));
    ctx.restore();
    ctx.strokeStyle = T.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, base, 70, -Math.PI / 2, -Math.PI / 2 + 0.27); ctx.stroke();
    lab('load angle', px + 80, base - 82); lab('slips here (29 degrees)', px + 120, r.y + 40);
  } else if (kind === 'stars') {
    stars(ctx, cx, r.y + 70, 3, 52);
    lab('Any goods: 1', r.x + r.w * 0.06, r.y + 160); lab('Most goods, before dusk: 2', r.x + r.w * 0.06, r.y + 192); lab('Every item, before dusk, no gasping halt: 3', r.x + r.w * 0.06, r.y + 224);
  }
  ctx.restore();
}
function segGlyph(ctx, kind, x, y, s) {
  const T = theme(); ctx.save(); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = T.text; ctx.fillStyle = T.accent;
  ctx.beginPath();
  if (kind === 'climb') { ctx.moveTo(x - s / 2, y + s * 0.25); ctx.lineTo(x + s / 2, y - s * 0.25); ctx.stroke(); }
  else if (kind === 'steps') { for (let i = 0; i < 4; i++) { ctx.lineTo(x - s / 2 + i * s / 4, y + s * 0.3 - i * s * 0.18); ctx.lineTo(x - s / 2 + (i + 1) * s / 4, y + s * 0.3 - i * s * 0.18); } ctx.stroke(); }
  else if (kind === 'bridge') { ctx.moveTo(x - s / 2, y); ctx.quadraticCurveTo(x, y + s * 0.35, x + s / 2, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s / 2, y - s * 0.3); ctx.lineTo(x - s / 2, y + s * 0.15); ctx.moveTo(x + s / 2, y - s * 0.3); ctx.lineTo(x + s / 2, y + s * 0.15); ctx.stroke(); }
  else if (kind === 'gust') { for (let i = 0; i < 3; i++) { ctx.moveTo(x - s / 2, y - s * 0.2 + i * s * 0.2); ctx.lineTo(x + s * (0.3 - i * 0.1), y - s * 0.2 + i * s * 0.2); } ctx.stroke(); }
  else { ctx.rect(x - s * 0.45, y + s * 0.05, s * 0.9, s * 0.18); ctx.stroke(); ctx.beginPath(); ctx.arc(x + s * 0.2, y - s * 0.15, s * 0.22, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- settings ------------------------------------------------------------------------------------------------------------------
export function drawSettings(ctx, w, h, S, flash) {
  const T = theme(), sc = scaleOf(S), ROWS = settingRows(S), L = settingsLayout(w, h, sc, ROWS.length);
  background(ctx, w, h);
  header(ctx, L, 'Settings', S, flash);
  const vals = { sound: S.prefs.sound ? 0 : 1, assist: S.prefs.assist ? 1 : 0, hand: S.prefs.hand === 'left' ? 1 : 0, rest: S.prefs.restCue ? 0 : 1, restore: -1 };
  scrollBody(ctx, L.body, L.contentH + 70 * sc, S, () => {
    ROWS.forEach((row, i) => {
      const g = L.rows[i], yy = L.body.y + g.y;
      const rr0 = { x: g.label.x, y: L.body.y + g.label.y, w: g.label.w, h: g.label.h };
      txt(ctx, row.label, rr0.x, rr0.y + rr0.h / 2, { size: F(30 * sc), weight: 600, maxW: rr0.w });
      const c = { x: g.ctrl.x, y: L.body.y + g.ctrl.y, w: g.ctrl.w, h: g.ctrl.h }, n = row.opts.length, cw = (c.w - 8 * (n - 1)) / n;
      for (let k = 0; k < n; k++) button(ctx, { x: c.x + k * (cw + 8), y: c.y, w: cw, h: c.h }, row.opts[k], { size: 28, active: vals[row.id] === k || (row.id === 'restore' && S.owned), flash: flash(`set${i}.${k}`) });
    });
    const y = L.body.y + L.contentH;
    txt(ctx, `Walk the doko with a calm hand. Trail ${S.stats.trailsDone ?? 0} of ${TRAILS.length} walked.`, L.body.x + 18, y + 24, { size: F(24 * sc), color: T.dim, maxW: L.body.w - 36 });
  });
  // think seconds for Watch and Learn
  if (S.msg) toast(ctx, w, h, S.msg.text, h - 80);
}

// ---- play HUD -------------------------------------------------------------------------------------------------------------------
export function drawHud(ctx, w, h, S, flash, model) {
  const T = theme(), run = S.run, R = run.R, trail = run.trail, P = playLayout(w, h, { hand: S.prefs.hand, coach: !!run.hint, auto: run.kind === 'auto' });
  const auto = run.kind === 'auto';
  // top row: goods and load, pause, hint
  const it = P.items; let gx = it.x + 18;
  const n = R.items0, sz = Math.min(26, (it.w - 130) / Math.max(n, 1) / 1.15);
  for (let i = 0; i < n; i++) { ctx.save(); if (i >= R.items) ctx.globalAlpha = 0.22; drawGood(ctx, run.loadKind, gx + i * sz * 1.2, it.y + it.h / 2, sz * 0.62); ctx.restore(); }
  txt(ctx, `${trail.kg} kg`, gx + n * sz * 1.2 + 14, it.y + it.h / 2, { size: F(26), weight: 700, fam: NUM, color: T.text });
    button(ctx, P.pause, '', { icon: run.paused ? 'play' : 'pause', flash: flash('pause') });
  if (!auto) button(ctx, P.hint, '', { icon: 'bulb', flash: flash('hint'), active: !!run.hint });
  else txt(ctx, 'WATCH AND LEARN', P.hint.x + P.hint.w, it.y + it.h / 2, { size: F(24), weight: 800, fam: NUM, color: T.accent, align: 'right' });

  // progress strip
  const st = P.strip; plaque(ctx, st, { radius: 12 });
  if (trail.endless) {
    txt(ctx, `Long Road  ·  ${Math.floor(R.distance)} m`, st.x + 14, st.y + st.h / 2, { size: F(26), weight: 700, fam: NUM });
    txt(ctx, `${R.visited.length} rest stops   best ${S.stats.bestLong} m`, st.x + st.w - 14, st.y + st.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
  } else {
    const len = trail.len;
    ctx.save(); ctx.beginPath(); ctx.rect(st.x + 6, st.y, st.w - 12, st.h); ctx.clip();
    for (const s of trail.segs) {
      const a = st.x + 10 + (s.x0 / len) * (st.w - 20), b = st.x + 10 + (s.x1 / len) * (st.w - 20);
      const col = s.t === 'climb' ? '#e08a3a' : s.t === 'down' ? '#5aa2d6' : s.t === 'steps' ? '#b9b3a6' : s.t === 'bridge' ? '#d95f5f' : s.t === 'rest' ? '#7be0a8' : 'rgba(255,255,255,0.28)';
      ctx.fillStyle = col; ctx.fillRect(a, st.y + st.h - 14, Math.max(2, b - a), 8);
    }
    ctx.restore();
    const px = st.x + 10 + clamp(R.x / len, 0, 1) * (st.w - 20);
    ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(px, st.y + st.h - 10, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1706'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, trail.name, st.x + 14, st.y + 14, { size: F(21), weight: 600, color: T.text, maxW: st.w - 160 });
    txt(ctx, `${Math.max(0, Math.ceil(len - R.x))} m to go`, st.x + st.w - 14, st.y + 14, { size: F(21), weight: 600, color: T.dim, align: 'right' });
  }
  // breath and daylight bars
  const bar = (r, frac, fill, label, pulse) => {
    plaque(ctx, r, { radius: 12 });
    if (frac > 0.002) { rr(ctx, r.x + 3, r.y + 3, Math.max(8, (r.w - 6) * clamp(frac, 0, 1)), r.h - 6, 9); ctx.fillStyle = fill; if (pulse) ctx.globalAlpha = 0.65 + 0.35 * Math.sin(S.t * 10); ctx.fill(); ctx.globalAlpha = 1; }
    txt(ctx, label, r.x + 10, r.y + r.h / 2, { size: F(17), weight: 800, fam: NUM, color: '#fff', maxW: r.w - 20 });
  };
  const bcol = R.breath > 0.5 ? '#46c98a' : R.breath > K.LOW_BREATH ? '#e8b84a' : '#ef6a4f';
  bar(P.breath, R.breath, bcol, R.halt > 0 ? 'OUT OF BREATH' : 'BREATH', R.breath < K.LOW_BREATH);
  const df = model.f;
  bar(P.day, clamp(1 - df, 0, 1), df < 0.75 ? '#7bb8ff' : df < 1 ? '#ffb15a' : '#7a5aa8', trail.endless ? 'DAYLIGHT' : df >= 1 ? 'DUSK' : 'DAYLIGHT', false);

  // load level gauge between the bars: the marker shows the basket's angle, the red ends are where it slips
  { const r = P.gauge, cx = r.x + r.w / 2, half = r.w / 2 - 8;
    plaque(ctx, r, { radius: 12 });
    ctx.fillStyle = 'rgba(123,224,168,0.6)'; ctx.fillRect(cx - half * 0.3, r.y + 5, half * 0.6, r.h - 10);
    ctx.fillStyle = 'rgba(255,122,92,0.8)'; ctx.fillRect(r.x + 6, r.y + 5, half * 0.16, r.h - 10); ctx.fillRect(r.x + r.w - 6 - half * 0.16, r.y + 5, half * 0.16, r.h - 10);
    const mk = cx + clamp(R.a / K.SPILL_ANGLE, -1.1, 1.1) * half;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mk, r.y + 3); ctx.lineTo(mk - 7, r.y - 5); ctx.lineTo(mk + 7, r.y - 5); ctx.closePath(); ctx.fill();
    ctx.fillRect(mk - 2, r.y + 3, 4, r.h - 6);
    txt(ctx, 'LOAD', cx, r.y + r.h + 12, { size: F(15), weight: 800, fam: NUM, color: 'rgba(255,255,255,0.8)', align: 'center' }); }

  // a nudge near the load: which way to drag when it is tipping
  if (!auto && Math.abs(R.a) > 0.2 && !R.ended) {
    const dir = Math.sign(R.a), a = 0.5 + 0.5 * Math.sin(S.t * 14), sg = sceneGeom(w, h);
    ctx.save(); ctx.globalAlpha = 0.45 + 0.5 * a * clamp((Math.abs(R.a) - 0.2) / 0.2, 0, 1);
    for (let i = 0; i < 2; i++) (dir > 0 ? icons.next : icons.back)(ctx, sg.px + dir * (96 + i * 26), sg.gy - 250, 46, '#ffd36b');
    ctx.restore();
  }
  // control circle
  const pad = run.anchor ?? P.pad, ctrl = run.ctrl;
  const pr = P.pad.r;
  ctx.save();
  ctx.globalAlpha = run.anchor ? 0.95 : auto ? 0.8 : 0.55;
  ctx.strokeStyle = 'rgba(255,240,210,0.65)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pad.x, pad.y, pr, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(8,12,28,0.35)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad.x - pr, pad.y); ctx.lineTo(pad.x + pr, pad.y); ctx.moveTo(pad.x, pad.y - pr); ctx.lineTo(pad.x, pad.y + pr); ctx.stroke();
  // coach target ghost
  if (run.hint?.card && run.hint.card.lean !== undefined) {
    const tg = run.hint.card; const gxp = pad.x + clamp(tg.lean, -1, 1) * pr * 0.9, gyp = pad.y - ((tg.pace - 1) / 0.4) * pr * 0.9;
    ctx.strokeStyle = T.sel; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(gxp, gyp, 22, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  const kx = pad.x + clamp(ctrl.lean, -1, 1) * pr * 0.9, ky = pad.y - ((clamp(ctrl.pace, K.PACE_MIN, K.PACE_MAX) - 1) / 0.4) * pr * 0.9;
  ctx.fillStyle = ctrl.hold ? T.accent : 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(kx, ky, 22, 0, TAU); ctx.fill();
  ctx.restore();
  if (!run.anchor && !auto && !run.hint) {
    const walked = R.x < 3;
    txt(ctx, walked ? 'HOLD ANYWHERE TO WALK' : R.v > 0.05 ? '' : 'RESTING', pad.x, pad.y + pr + 28, { size: F(22), weight: 800, fam: NUM, color: 'rgba(255,244,220,0.85)', align: 'center' });
  }
  // pace and lean readout
  if (run.anchor || auto) txt(ctx, `pace ${ctrl.pace.toFixed(1)}x`, pad.x, pad.y - pr - 18, { size: F(20), weight: 600, color: T.dim, align: 'center' });

  // cards
  if (run.hint && !auto) drawCard(ctx, P.coach, run.hint.card, S, flash, P.coachBtns.close, null, run.hint.ttl - run.hint.t);
  if (auto) drawRail(ctx, P, S, flash);
  // gust warning
  const next = trail.gusts[R.gustIdx];
  const toastY = P.sceneTop + 64;
  if (next && next.x - R.x < 6 && next.x > R.x) {
    const a = 0.6 + 0.4 * Math.sin(S.t * 12);
    ctx.globalAlpha = a; toast(ctx, w, h, `Gust ${next.dir > 0 ? 'from behind: lean forward' : 'from ahead: lean back'}`, toastY); ctx.globalAlpha = 1;
  } else if (run.msg) toast(ctx, w, h, run.msg.text, toastY);
}

function drawCard(ctx, r, card, S, flash, closeRect, extra, timer) {
  const T = theme();
  plaque(ctx, r, { radius: 20, tint: 'rgba(12,18,36,0.94)', edge: T.accent });
  txt(ctx, card.title, r.x + 20, r.y + 36, { size: F(32), weight: 800, fam: NUM, color: T.accent, maxW: r.w - 100 });
  const size = F(24);
  para(ctx, card.text, r.x + 20, r.y + 66, r.w - 40, { size, weight: 400, lh: 1.32 });
  if (closeRect) button(ctx, closeRect, '', { icon: 'exit', flash: flash('close'), size: 26 });
}
function drawRail(ctx, P, S, flash) {
  const T = theme(), run = S.run, a = run.auto, r = P.rail, B = P.railBtns;
  const card = a.card ?? { title: 'Watch and Learn', text: 'The game walks a whole trail and explains each hazard before it gets there.' };
  plaque(ctx, r, { radius: 20, tint: 'rgba(12,18,36,0.94)', edge: T.accent });
  txt(ctx, card.title, r.x + 20, r.y + 34, { size: F(30), weight: 800, fam: NUM, color: T.accent, maxW: r.w - 220 });
  const phase = a.phase === 'think' ? `THINK ${Math.ceil(a.timer)}` : a.phase === 'reveal' ? 'REVEAL' : a.done ? 'DONE' : 'ACT';
  txt(ctx, a.paused ? 'PAUSED' : phase, r.x + r.w - 20, r.y + 34, { size: F(24), weight: 800, fam: NUM, color: T.dim, align: 'right' });
  para(ctx, card.text, r.x + 20, r.y + 60, r.w - 40, { size: F(23), weight: 400, lh: 1.3 });
  button(ctx, B.pause, a.paused ? 'Resume' : 'Pause', { size: 26, icon: a.paused ? 'play' : 'pause', flash: flash('apause') });
  button(ctx, B.dec, 'Think -', { size: 22, flash: flash('adec'), disabled: S.prefs.thinkIdx <= 0 });
  button(ctx, B.inc, 'Think +', { size: 22, flash: flash('ainc'), disabled: S.prefs.thinkIdx >= THINK_STEPS.length - 1 });
  button(ctx, B.exit, 'Exit', { size: 26, icon: 'exit', flash: flash('aexit') });
  txt(ctx, `Think ${THINK_STEPS[S.prefs.thinkIdx]} s`, B.dec.x + (B.inc.x + B.inc.w - B.dec.x) / 2, B.dec.y - 14, { size: F(19), color: T.dim, align: 'center', weight: 600 });
}

// ---- pause, result, demo cap -----------------------------------------------------------------------------------------------------
export function drawPause(ctx, w, h, S, flash) {
  const T = theme(), L = pauseLayout(w, h);
  ctx.fillStyle = 'rgba(6,10,24,0.72)'; ctx.fillRect(0, 0, w, h);
  panel(ctx, L.panel, { radius: 26, fill: 'rgba(16,24,48,0.97)', line: T.accent });
  txt(ctx, 'PAUSED', L.panel.x + L.panel.w / 2, L.panel.y + 62, { size: F(54), weight: 800, fam: NUM, align: 'center', color: T.accent });
  button(ctx, L.resume, 'Resume', { kind: 'accent', size: 34, icon: 'play', flash: flash('resume') });
  button(ctx, L.restart, 'Restart trail', { size: 30, flash: flash('restart') });
  button(ctx, L.settings, 'Settings', { size: 30, icon: 'gear', flash: flash('psettings') });
  button(ctx, L.menu, 'Leave to menu', { size: 30, flash: flash('pmenu') });
}

export function drawOver(ctx, w, h, S, flash) {
  const T = theme(), res = S.result, sc = Math.min(1.3, scaleOf(S)), L = overLayout(w, h, sc);
  const run = S.run;
  ctx.fillStyle = 'rgba(6,10,24,0.76)'; ctx.fillRect(0, 0, w, h);
  panel(ctx, L.panel, { radius: 28, fill: 'rgba(16,24,48,0.97)', line: res.arrived ? T.accent : T.line });
  const p = L.panel, cx = p.x + p.w / 2, big = F(50 * sc);
  let y = p.y + 24 + big * 0.7;
  const title = res.kind === 'long' ? 'Long Road' : res.arrived ? 'Arrived!' : 'The load is lost';
  txt(ctx, title, cx, y, { size: big, weight: 800, fam: NUM, align: 'center', color: res.arrived || res.kind === 'long' ? T.accent : T.err, maxW: p.w - 40 });
  y += big * 0.7 + 8;
  txt(ctx, res.name, cx, y, { size: F(28 * sc), weight: 600, align: 'center', color: T.text, maxW: p.w - 40 });
  y += 40 * sc;
  if (res.kind !== 'long') { stars(ctx, cx, y + 20, res.stars, 52 * Math.min(1.2, sc)); y += 64 * Math.min(1.2, sc); }
  const rows = res.kind === 'long'
    ? [['Distance', `${res.distance} m`], ['Rest stops', String(res.rests)], ['Best', `${res.best} m`], ['Goods kept', `${res.items} of ${res.items0}`]]
    : [['Goods kept', `${res.items} of ${res.items0}`], ['Time', `${fmtTime(res.time)}  (dusk at ${fmtTime(res.dayLen)})`], ['Forced halts', String(res.halts)], ['Hints used', String(res.hints)]];
  const size = F(28 * sc);
  rows.forEach(([a, b], i) => {
    const ry = y + 14 + i * size * 1.5;
    txt(ctx, a, p.x + 36, ry, { size, weight: 500, color: T.dim });
    txt(ctx, b, p.x + p.w - 36, ry, { size, weight: 700, color: T.text, align: 'right', maxW: p.w * 0.6 });
  });
  y += 14 + rows.length * size * 1.5;
  if (res.note) y += para(ctx, res.note, p.x + 36, y + 6, p.w - 72, { size: F(24 * sc), weight: 600, color: T.text, lh: 1.3 }) + 14;
  if (res.story && y < L.bodyBottom - 60) para(ctx, res.story, p.x + 36, y + 6, p.w - 72, { size: F(23 * sc), weight: 400, color: T.dim, lh: 1.3 });
  drawMoreLine(ctx, cx, L.btns.next.y - 24, 18);
  const nextLabel = res.kind === 'long' ? 'Walk again' : res.arrived ? (res.nextIdx !== null ? 'Next trail' : 'Back to the trails') : 'Try again';
  button(ctx, L.btns.next, nextLabel, { kind: 'accent', size: 36, flash: flash('next') });
  button(ctx, L.btns.menu, res.kind === 'journey' ? 'All trails' : 'Menu', { size: 30, flash: flash('menu') });
  button(ctx, L.btns.share, 'Share', { size: 30, flash: flash('share') });
}

export function drawDemo(ctx, w, h, S, flash) {
  const T = theme(), L = demoLayout(w, h);
  background(ctx, w, h);
  panel(ctx, L.panel, { radius: 28, fill: 'rgba(16,24,48,0.97)', line: T.accent });
  txt(ctx, 'That was the demo end', L.panel.x + L.panel.w / 2, L.panel.y + 70, { size: F(44), weight: 800, fam: NUM, align: 'center', color: T.accent, maxW: L.panel.w - 40 });
  para(ctx, 'The web demo walks three trails. Get the free app on iPhone and Android: twelve trails, the Long Road, a Daily Trail and Watch and Learn.', L.panel.x + 36, L.panel.y + 120, L.panel.w - 72, { size: F(28), weight: 400, lh: 1.36 });
  button(ctx, L.ok, 'Back to the menu', { kind: 'accent', size: 34, flash: flash('ok') });
}

export { skyAt };
