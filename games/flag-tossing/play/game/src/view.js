// Drawing for every screen. render() is the single entry point; the show lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawBackdrop, drawVeil, drawBearer, drawBearerGround, drawFlag, drawStars, clamp, clamp01 } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TUNE, ENS, SPEEDS, figName, PRACTICE_FIGS } from './engine.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

const TAU = Math.PI * 2;

// Display lettering: a dark outline, a gilt extrusion below, a gold-leaf face with a lit upper edge and a soft glow (embossed metal, not a plain font).
function titleText(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let s = size; ctx.font = `700 ${s}px ${DISPLAY}`;
  const m = ctx.measureText(label).width; if (maxW && m > maxW) { s = size * maxW / m; ctx.font = `700 ${s}px ${DISPLAY}`; }
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.28, '#ffe08a'); g.addColorStop(0.55, '#f2c14e'); g.addColorStop(0.8, '#c78a22'); g.addColorStop(1, '#8a5a12');
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.2; ctx.strokeStyle = '#0c1634'; ctx.strokeText(label, cx, y + s * 0.04);
  ctx.fillStyle = '#5a3606'; ctx.fillText(label, cx, y + s * 0.045);                      // extrusion
  ctx.lineWidth = s * 0.07; ctx.strokeStyle = '#8c5c14'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,200,80,0.55)'; ctx.shadowBlur = s * 0.2; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.42; ctx.fillStyle = '#ffffff'; ctx.fillText(label, cx - s * 0.008, y - s * 0.018);   // lit edge
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillText(label, cx + s * 0.004, y + s * 0.006);
  ctx.restore();
}

// The title scene's own little display: three bearers throwing flags to different heights, forever, in the piazza.
function heroBase(H) { return H.y + H.h - 14; }
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
function hero(ctx, st, H, calm, L) {
  // Each bearer loops: the flag is waved in figure-of-eight sweeps over the head (the flag always in sight), then a wind-up crouch, a toss that
  // stays below the title lettering, the eyes follow it, a reach to catch, a knee absorb, and the waving starts again. The free hand rests on the hip.
  const foot = heroBase(H), items = [];
  const top = L.title ? L.title.titleY + L.title.size * 2.0 + 10 : H.y;
  // tall enough to read, short enough that a flag held high (about 1.95 body heights) stays under the title lettering
  const n = 3, span = Math.min(H.w - 30, 600), bh = clamp(Math.min(H.h * 0.56, (foot - top) / 1.95), 110, 290);
  for (let i = 0; i < n; i++) {
    const cx = H.x - span / 2 + span * (i + 0.5) / n, period = 5.6 + i * 0.75, u = ((st.t + i * 1.9) % period) / period;
    const W0 = 0.46, WIND = 0.56, AIR = 0.86;                                      // wave | wind-up | flight | catch + settle
    const air = AIR;
    const flying = u >= WIND && u < AIR, up = flying ? (u - WIND) / (AIR - WIND) : 0;
    const apex = clamp(foot - bh * 1.22 - (top + bh * 0.42), bh * 0.2, bh * (1.15 + i * 0.25));
    const wind = u >= W0 && u < WIND ? sstep(W0, WIND, u) : 0, follow = flying && up < 0.2 ? 1 - sstep(0.02, 0.2, up) : 0;
    const settle = u >= AIR ? 1 - sstep(AIR, 1, u) : 0;
    let hr, hl = { x: -15, y: -54 };
    const body = { crouch: 0.85 * wind + 0.35 * settle, twist: 0.3 * wind - 0.2 * follow, bend: 0.1 * wind, flex: -0.05 * wind + 0.1 * follow, rise: follow };
    let ang = 0;
    if (u < W0) {                                                                 // the wave: sweeps side to side over the head
      const k = u / W0, sw = Math.sin(k * TAU * 2), env = sstep(0, 0.12, k) * (1 - sstep(0.85, 1, k));
      ang = 0.95 * sw * env * (i % 2 ? -1 : 1);
      hr = { x: 14 + 14 * sw * env * (i % 2 ? -1 : 1), y: -112 - 8 * Math.abs(sw) * env };
      body.twist = -0.16 * sw * env; body.bend = 0.05 * sw * env;
    } else if (wind > 0 && !flying) { hr = { x: 22 + 10 * wind, y: -104 + 38 * wind }; ang = -0.25 * wind; }
    else if (flying) {
      hr = follow > 0 ? { x: 12, y: -126 - 14 * follow } : { x: 20, y: -86 - 30 * sstep(0.7, 1, up) };     // throw, then the hand rises to meet the flag
      hl = follow > 0 ? { x: -24 - 14 * follow, y: -64 } : hl;
    } else { hr = { x: 18, y: -108 + 4 * settle }; }
    const fy = foot - bh * 1.22 - apex * 4 * up * (1 - up), fx = cx + 22 * bh / 100 + Math.sin(up * Math.PI) * (i - 1) * 14;
    items.push({ i, cx, u, air, up, apex, fx, fy, hr, hl, body, ang, flying, grip: [flying && follow === 0 && up < 0.7 ? 'relaxed' : 'fist', 'relaxed'] });
  }
  const f3 = globalThis.__show3d;
  const flights = items.filter((it) => it.flying).map((it) => ({ id: it.i, x: it.fx, y: it.fy, ang: TAU * 2 * it.up * (it.i % 2 ? -1 : 1), design: (it.i * 3 + 1) % 8, side: it.i % 2 ? 1 : -1 }));
  const bearers = items.map((it) => ({ id: it.i, cx: it.cx, you: it.i === 1, costume: it.i === 1 ? 0 : (it.i % 2) + 1, hands: [it.hr, it.hl], grip: it.grip, lean: 0, yaw: Math.PI + (it.i - 1) * 0.42, gaze: it.flying ? { x: it.fx, y: it.fy } : { x: it.cx + 30 * bh / 100 * Math.sin(it.ang), y: foot - bh * 1.9 }, body: it.body,
    held: it.flying ? [] : [{ design: (it.i * 3 + 1) % 8, ang: it.ang + 0.05 * Math.sin(st.t * 1.4 + it.i), hand: 0, side: 1 }] }));
  if (f3 && f3.render) {
    const r = f3.render(ctx, { mode: 'title', w: L.w, h: L.h, t: st.t, foot, H: bh, calm, beat: st.t * 1.2, bpm: 72, beatFlash: 0, bearers, flights, camX: calm ? 0 : 0.18 * Math.sin(st.t * 0.21) });
    if (r) return true;
  }
  hero2D(ctx, st, H, calm, items, bh, foot);
  return false;
}
// The 2D bearers for the title when the 3D show cannot be used (and nothing while it is still loading).
function hero2D(ctx, st, H, calm, items, bh, foot) {
  const f3 = globalThis.__show3d;
  if (f3 && f3.pending) return;
  for (const it of items) {
    const { i, cx } = it;
    drawBearerGround(ctx, cx, foot, bh, { you: i === 1 });
    const hands = drawBearer(ctx, cx, foot, bh, { costume: i === 1 ? 0 : (i % 2) + 1, you: i === 1, hands: [it.hr, it.hl] });
    const Lf = bh * 0.95;
    if (it.flying) drawFlag(ctx, it.fx, it.fy, Lf, TAU * 2 * it.up * (i % 2 ? -1 : 1), (i * 3 + 1) % 8, { ph: st.t * 8 + i, side: i % 2 ? 1 : -1, calm });
    else drawFlag(ctx, hands[0].x + Math.sin(it.ang) * Lf * 0.3, hands[0].y - Math.cos(it.ang) * Lf * 0.3, Lf, it.ang, (i * 3 + 1) % 8, { ph: st.t * 3 + i, side: 1, calm, held: true });
  }
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const { w, h } = L, sc = st.scene;
  meta.previewBadge = null;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); return; }
  const H = L.title.hero;
  const floorY = sc === 'title' ? Math.round(heroBase(H) - Math.min(H.h * 0.42, 230) * 0.5) : Math.round(h * 0.72);
  const f3 = globalThis.__show3d;
  let live = false;
  if (sc === 'title' && f3 && f3.render) live = hero(ctx, st, { x: L.title.hero.x, y: L.title.hero.y, w: L.title.hero.w, h: L.title.hero.h }, st.prefs.calm, L);
  else if (f3 && f3.backdrop) live = f3.backdrop(ctx, w, h);
  if (!live) drawBackdrop(ctx, w + 20, h + 20, floorY);
  if (sc !== 'title' && sc !== 'result') drawVeil(ctx, w, h, live ? 0.5 : 0.62);
  else if (sc === 'result') drawVeil(ctx, w, h, 0.45);
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'setup') renderSetup(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  if (st.toast) {
    const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(13,24,48,0.92)', stroke: 'rgba(242,193,78,0.6)' });
    ctx.restore();
  }
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('guides', 'Ghost guides', 'toggle', () => p.guides, 'Height ruler and the drag preview'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Less shake, sway and confetti'),
    row('think', 'Think time (s)', 'stepper', () => p.thinkSec, 'How long Watch and Learn thinks'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', st.owned ? 'Full game unlocked' : 'Restore purchase', 'button', () => '', st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Already bought it? Get it back'), { btn: st.restoreBusy ? 'Checking' : st.owned ? 'Owned' : 'Restore', disabled: st.owned || st.restoreBusy })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = L.mode === 'wide';
  const tcx = wide ? T.hero.x : S.x + S.w / 2, size = T.size, maxW = (wide ? T.col.x - S.x : S.w) - 40;
  // a navy band behind the controls so the buttons read on the flagstones
  panel(ctx, { x: T.col.x - 14, y: T.col.y - 14, w: T.col.w + 28, h: T.col.h + 28 }, { rad: 26 });
  titleText(ctx, tcx, T.titleY, size, 'FLAG', maxW);
  titleText(ctx, tcx, T.titleY + size * 0.98, size * 0.9, 'TOSSING', maxW);
  txt(ctx, 'ITALIAN FLAG THROWING', tcx, T.titleY + size * 1.78, Math.max(24, size * 0.26), PAL.goldHi, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, strokeColor: 'rgba(13,24,48,0.9)', maxW });
  button(ctx, T.play, 'Perform', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.prac, 'Practice', { kind: 'quiet', size: wide || T.prac.w > T.play.w * 0.8 ? 32 : 30, icon: 'restart' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  panel(ctx, { x: T.credit.x - lw / 2 - 12, y: T.credit.y - lh - 2, w: lw + 24, h: lh + 18 }, { rad: 14, studs: false });
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- practice setup ----------------------------------------------------------------------------------------------------------------------------------
function renderSetup(ctx, st, L) {
  const U = L.setup, S = L.S, s = st.setup;
  button(ctx, U.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Practice', S.x + S.w / 2, U.back.y + U.back.h / 2, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, strokeColor: 'rgba(13,24,48,0.9)', maxW: S.w - 2 * (U.back.w + 30) });
  panel(ctx, U.panel, { fill: 'rgba(13,24,48,0.9)' }); edgeStroke(ctx, U.panel, 24, 0.3);
  const p = U.panel;
  ctx.font = `500 26px ${UI}`;
  wrap(ctx, 'No flag is ever dropped in practice. Pick a figure, who stands with you and how fast the drum beats.', p.w - 56).slice(0, 3).forEach((ln, i) => txt(ctx, ln, p.x + 28, p.y + 34 + i * 34, 26, PAL.text, { weight: 500 }));
  const row = (r, label, val, dec, inc, canDec, canInc) => {
    ctx.fillStyle = 'rgba(251,241,220,0.08)'; rrect(ctx, r, 18); ctx.fill();
    txt(ctx, label, r.x + 20, r.y + r.h / 2, 28, PAL.text, { weight: 700, maxW: r.w * 0.28 });
    button(ctx, dec, '-', { kind: canDec ? 'quiet' : 'disabled', size: 38, noShadow: true });
    button(ctx, inc, '+', { kind: canInc ? 'quiet' : 'disabled', size: 38, noShadow: true });
    txt(ctx, val, (dec.x + dec.w + inc.x) / 2, r.y + r.h / 2, 28, PAL.gold, { align: 'center', weight: 800, maxW: inc.x - dec.x - dec.w - 8 });
  };
  const fi = PRACTICE_FIGS.indexOf(s.fig);
  row(U.row_fig, 'Figure', figName(s.fig), U.figDec, U.figInc, fi > 0, fi < PRACTICE_FIGS.length - 1);
  row(U.row_ens, 'Partners', ENS[s.ens].name, U.ensDec, U.ensInc, s.ens > 1, s.ens < 3);
  row(U.row_speed, 'Tempo', `${SPEEDS[s.speedIdx].name}  ${SPEEDS[s.speedIdx].bpm}`, U.speedDec, U.speedInc, s.speedIdx > 0, s.speedIdx < SPEEDS.length - 1);
  button(ctx, U.start, 'Start', { kind: 'primary', size: 38, icon: 'play' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, wide = L.mode === 'wide' || p.h < 900;
  panel(ctx, p, { fill: 'rgba(13,24,48,0.93)' }); edgeStroke(ctx, p, 28, 0.55);
  const head = r.mode === 'auto' ? 'LESSON COMPLETE' : r.mode === 'practice' ? 'PRACTICE' : 'THE DISPLAY IS OVER';
  txt(ctx, head, p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  const stars = r.act >= 5 ? 3 : r.act >= 3 ? 2 : r.act >= 2 ? 1 : 0;
  const lx = wide ? p.x + p.w * 0.25 : p.x + p.w / 2, rx0 = wide ? p.x + p.w * 0.48 : p.x + 32, rw = wide ? p.w * 0.5 - 28 : p.w - 64;
  let y = p.y + (wide ? 120 : 130);
  txt(ctx, 'SCORE', lx, y, 22, PAL.gold, { align: 'center', weight: 800 });
  txt(ctx, String(Math.round(r.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), lx, y + 66, wide ? 76 : 96, PAL.text, { align: 'center', weight: 800, stroke: 8, strokeColor: 'rgba(13,24,48,0.9)', maxW: wide ? p.w * 0.4 : p.w - 60 });
  y += wide ? 150 : 170;
  if (r.mode === 'perform') drawStars(ctx, lx, y + 10, wide ? 38 : 46, stars, 3, 1);
  if (r.newBest) chip(ctx, lx, y + (wide ? 76 : 96), 'NEW BEST', 24, { align: 'center', fill: '#c8402f', color: '#fff' });
  else if (r.mode === 'perform') txt(ctx, `Best ${st.best.score}`, lx, y + (wide ? 76 : 96), 26, PAL.dim, { align: 'center', weight: 700 });
  let ry = wide ? p.y + 120 : y + (wide ? 100 : 150);
  const tile = (x, yy, ww, label, val) => { ctx.fillStyle = 'rgba(251,241,220,0.08)'; rrect(ctx, { x, y: yy, w: ww, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + ww / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: ww - 8 }); txt(ctx, val, x + ww / 2, yy + 74, 38, PAL.text, { align: 'center', weight: 800, maxW: ww - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'ACT', String(r.act)); tile(rx0 + tw + g, ry, tw, 'BEST FLOW', String(r.maxFlow)); tile(rx0 + (tw + g) * 2, ry, tw, 'FIGURES', String(r.figures));
  ry += 126;
  const keys = [['perfect', 'PERFECT'], ['good', 'GOOD'], ['off', 'OFF'], ['miss', 'DROPS'], ['pcatch', 'PARTNER']], cw = (rw - g * 4) / 5;
  keys.forEach(([k, label], i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(251,241,220,0.06)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[k] ?? 0), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, label, x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += 104;
  if (r.mode === 'perform') txt(ctx, `${r.cleanActs} clean ${r.cleanActs === 1 ? 'act' : 'acts'}  ·  ${r.throws} throws  ·  ${r.catches} catches`, rx0 + rw / 2, ry + 10, 22, PAL.dim, { align: 'center', weight: 600, maxW: rw });
  button(ctx, Rr.again, r.mode === 'auto' ? 'Watch again' : r.mode === 'practice' ? 'Practice again' : 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(13,24,48,0.95)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, strokeColor: 'rgba(13,24,48,0.9)', maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Flag Tossing on iPhone and Android: endless acts, solo, pair and team figures, ten routines and Watch and Learn.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
