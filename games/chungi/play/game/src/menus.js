// Every screen that is not the play screen: title, settings, band colours, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { BANDS, makeCam, drawBackdrop, drawChungi, drawKid, drawHoop, drawFx } from './art.js';
import { TRICKS, KINDS, HALF0 } from './sim.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;
let PAGE_COUNT = 1;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
const COLL = { rects: [] };
export function resetMenus() { LAID = blankLaid(); PAGE_COUNT = 1; COLL.rects = []; }
export const collectionHit = (x, y) => { for (const r of COLL.rects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r; return null; };
const land = () => W > H;
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.rev}`;
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);
export const bandOwned = (rec, i) => !!(rec.owned && rec.owned[i]);

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300, t = 0) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `italic 800 156px ${DISPLAY}`;
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(18,6,36,0.94)'; ctx.strokeText('Chungi', cx, 168);
    const g = ctx.createLinearGradient(0, 56, 0, 190); g.addColorStop(0, '#fff6d4'); g.addColorStop(0.5, '#ffc83d'); g.addColorStop(1, '#ff4f7b'); ctx.fillStyle = g; ctx.fillText('Chungi', cx, 168);
    ctx.font = `700 28px ${FONT}`; textShadow(ctx, 'The rubber-band footbag game', cx, 222, '#ffe6c7', 6);
    ctx.font = `600 22px ${FONT}`; textShadow(ctx, 'from the streets of Nepal', cx, 254, '#ffd1e0', 6);
    void t;
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state);
  wd.push({ t: 'btn', id: 'street', label: 'Street Run', sub: rec.best ? `Best ${rec.best} kicks` : 'Keep it up as the alley narrows', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'hoop', label: 'Hoop Rally', sub: rec.bestHoops ? `Best ${rec.bestHoops} hoops` : 'Thread the hoops', row: 1 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Alley', sub: dk >= 0 ? `Today ${dk}` : 'New breeze today', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'bands', label: 'Band colours', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-guide', label: st.guide ? 'Reach box: On' : 'Reach box: Off', sub: 'The dashed box beside the kid where a kick is possible', active: st.guide },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe6c7', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe6c7', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.fullOwned ? [{ t: 'p', label: 'Full game unlocked', bold: true, color: '#9be8b0', size: 26 }]
      : [{ t: 'btn', id: 'restore', label: state.restoreBusy ? 'Please wait…' : 'Restore purchase', dark: true, disabled: !!state.restoreBusy }]),
    ...(state.restoreMsg && !state.demo && !state.fullOwned ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe6c7' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function bandsWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 3, gap = 18, cell = Math.min(190, Math.floor((w - gap * (cols - 1)) / cols)), bh = 2 * (cell + gap) - gap;
  const grid = {
    t: 'art', h: bh,
    draw(ctx, ww, hh, at) {
      COLL.rects = [];
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      BANDS.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (cell + gap), has = bandOwned(rec, i);
        roundPath(ctx, x, y, cell, cell, 20); ctx.fillStyle = sel === i ? 'rgba(255,214,120,0.35)' : 'rgba(24,10,48,0.6)'; ctx.fill();
        ctx.lineWidth = rec.bandSel === i ? 4 : 2; ctx.strokeStyle = rec.bandSel === i ? '#7fe8d0' : 'rgba(255,255,255,0.3)'; ctx.stroke();
        const mini = { s: cell * 0.5, X: () => x + cell / 2, Y: () => y + cell * 0.42 };
        ctx.save(); ctx.globalAlpha = has ? 1 : 0.3;
        drawChungi(ctx, { ...mini, s: cell * 0.62 }, { x: 0, y: 0, vx: 0, vy: 0, ang: i * 0.8 + 0.5, sq: 0, sqA: 0 }, [{ x: -0.5, y: 0.1 }, { x: -0.8, y: 0.0 }, { x: -1.0, y: -0.1 }], i, 0.4 + i);
        ctx.restore();
        if (!has) { ctx.fillStyle = '#fff1e2'; ctx.font = `700 ${Math.round(cell * 0.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + cell * 0.42); }
        ctx.fillStyle = '#fff1e2'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.115))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + cell - 16);
        COLL.rects.push({ kind: 'b', i, x: at.x + x, y: at.y + y, w: cell, h: cell });
      });
    },
  };
  let info = '';
  if (sel != null) { const d = BANDS[sel]; info = bandOwned(rec, sel) ? (rec.bandSel === sel ? `${d.name} is in use.` : `${d.name}. Tap again to use it.`) : `${d.name}: ${d.how}.`; }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Band colours', size: 48 },
    grid,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const hoopy = r.mode === 'hoop' || r.mode === 'daily';
  const label = r.mode === 'watch' ? 'Session complete' : r.newBest ? 'New best!' : 'Dropped';
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 80 }, { t: 'h', label, size: wide ? 52 : 60, cap: big ? 1.2 : 1.5 }];
  wd.push({ t: 'h', label: `${hoopy ? r.hoops : r.streak}`, size: wide ? 84 : 100, cap: big ? 1.1 : 1.3, color: '#ffd35a' });
  wd.push({ t: 'p', label: `${hoopy ? 'hoops threaded' : 'kicks in a row'} · ${r.points.toLocaleString('en-US')} points${hoopy ? ` · ${r.streak} kicks` : ''} · ${r.perfects} perfect`, size: 26, cap: big ? 2 : 3 });
  if (r.tricks.length) wd.push({ t: 'p', label: `Tricks: ${r.tricks.join(', ')}`, size: 24, color: '#9be8b0', bold: true, cap: big ? 2 : 3 });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice run and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'bands', label: 'Open Band colours', active: true });
  wd.push({ t: 'gap', h: wide ? 8 : 20 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode !== 'watch') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-guide', label: st.guide ? 'Reach box: On' : 'Reach box: Off', row: 8, active: st.guide },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free runs of the web demo. The full game on iPhone and Android has every mode, the Daily alley, all band colours and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- frames --------------------------------------------------------------------------------------------------------------
export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx], L = land();
  if (key === 'title') {
    if (!L) {
      const bottom = H - host.b - lockSize(600).strip, btnH = flowLayout(estCtx, titleWidgets(state), sc, { x: 40, w: 640 }).contentH;
      const colTop = Math.max(bottom - btnH, host.t + 380), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 700) / 4));
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'bands') return { cols: [{ widgets: bandsWidgets(state, w), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'result') return { cols: [{ widgets: resultWidgets(state, L), x, w, top: Math.max(host.t, oy), bottom: H - host.b, center: L }] };
  if (key === 'demolimit') return { cols: [{ widgets: demoLimitWidgets(state, L), x, w, top: Math.max(host.t, oy), bottom: H - host.b, center: L }] };
  return null;
}
function layColumns(ctx, state, key, fr) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cols = fr.cols.map((c) => {
    const lay = flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w });
    const avail = c.bottom - c.top;
    const top = c.center && lay.contentH < avail ? c.top + (avail - lay.contentH) / 2 : c.top;
    return { lay, top, bottom: c.bottom, x: c.x, w: c.w };
  });
  LAID = { key, sig: sigOf(state), lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, h: cols[0].lay.contentH, cols };
  if (key === 'title') {
    const c = cols[cols.length - 1], ls = lockSize(c.w), used = c.top + c.lay.contentH, cx = c.x + c.w / 2;
    const pinned = H - host.b - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    LAID.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return cols;
}
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay && LAID.sig === sigOf(state)) return;
  const fr = frameFor(state, key);
  if (!fr) return;
  layColumns(estCtx, state, key, fr);
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function hitScreen(x, y, scroll) {
  { const t = LAID.key === 'title' && LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  for (let i = 0; i < LAID.cols.length; i++) {
    const c = LAID.cols[i], id = flowHit(c.lay, c.top, i === 0 ? scroll : 0, x, y);
    if (id) return id;
  }
  return null;
}

// ---- drawing ---------------------------------------------------------------------------------------------------------------
function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(18,8,40,${a * 0.7})`); g.addColorStop(0.5, `rgba(18,8,40,${a})`); g.addColorStop(1, `rgba(18,8,40,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(18,8,40,0)'); g.addColorStop(1, 'rgba(18,8,40,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,220,0.92)'; ctx.fill();
    ctx.fillStyle = '#241838'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,220,0.92)'; ctx.fill();
    ctx.fillStyle = '#241838'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key) {
  const fr = frameFor(state, key);
  const cols = layColumns(ctx, state, key, fr);
  const c0 = cols[0], maxScroll = Math.max(0, c0.lay.contentH - (c0.bottom - c0.top));
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  const scroll = state.ui.scroll;
  cols.forEach((c, i) => {
    const mx = Math.max(0, c.lay.contentH - (c.bottom - c.top)), sc = i === 0 ? scroll : 0;
    drawFlow(ctx, c.lay, c.top, c.bottom, sc, { clipX: c.x - 40, clipW: c.w + 80 });
    if (mx > 0) {
      const top = c.top, bottom = c.bottom, th = Math.max(60, (bottom - top) * ((bottom - top) / c.lay.contentH)), ty = top + (sc / mx) * (bottom - top - th);
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,220,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The living background of the menus: the alley with the kid keeping the ball up on his own.
function attract(ctx, state, rect, dim = 0.2) {
  const run = state.att;
  const cam = makeCam(rect, run.cam);
  drawBackdrop(ctx, W, H, cam, run.half, state.t, run.wx);
  if (run.hoop) drawHoop(ctx, cam, run.hoop, state.t, 'back');
  drawKid(ctx, cam, run.kid, run.ball, state.t);
  drawChungi(ctx, cam, run.ball, run.tuft, state.record.bandSel, state.t);
  if (run.hoop) drawHoop(ctx, cam, run.hoop, state.t, 'front');
  drawFx(ctx, cam, state.attFx);
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(20,8,44,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: top + 120, w: W, h: Math.max(300, fr.cols[0].top - top - 120) }, 0.1);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(18,6,40,0.66)'); g.addColorStop(1, 'rgba(18,6,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(18,8,40,0)'); g2.addColorStop(1, 'rgba(18,8,40,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.6)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: H * 0.18, w: hw, h: H * 0.8 }, 0.12);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(18,6,40,0.62)'); g.addColorStop(1, 'rgba(18,6,40,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.6)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.68); drawFlowScreen(ctx, state, 'settings'); }
export function renderBands(ctx, state) { backdrop(ctx, state, 0.72); drawFlowScreen(ctx, state, 'bands'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.62 : 0.54); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(36,20,70,0.96)', stroke: 'rgba(255,214,150,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }] };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, state.ui.scroll, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, state.ui.scroll, maxScroll, px, pw);
}

// ---- reference pages -----------------------------------------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => PAGE_COUNT;
function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80, secFs = Math.round(34 * Math.min(scale, 1.3)), items = [];
  let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ t: 'rule', y }); y += 20; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ t: 'title', tl, y }); y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 210; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => { if (pi > 0) y += lh * 0.45; wrapLines(ctx, para, tw).forEach((l) => { items.push({ t: 'line', text: l, y }); y += lh; }); });
    y += 26;
  });
  return { items, fs, lh, secFs, total: y + 10 };
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.72);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,232,0.97)', stroke: 'rgba(60,30,90,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,30,90,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(60,30,90,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(60,30,90,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(60,30,90,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff1e2'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own kid, ball and hoop) -----------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff1e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(28,14,56,0.84)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function miniCam(w, h, sc = 1) {
  const s = Math.min(w / 7.4, h / 6) * sc;
  const floorY = h * 0.9, gy = floorY - 0.3 * s, cx = w / 2;
  return { s, gy, floorY, cx, camY: 0, X: (x) => cx + x * s, Y: (y) => gy - y * s, stage: { x: 0, y: 0, w, h } };
}
function panelBg(ctx, w, h) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a1458'); g.addColorStop(0.6, '#b8416b'); g.addColorStop(0.7, '#9a5a45'); g.addColorStop(1, '#4b2c33'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(40,20,40,0.55)'; ctx.fillRect(0, 0, w * 0.1, h); ctx.fillRect(w * 0.9, 0, w * 0.1, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(60,30,90,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
const ballAt = (x, y, ang = 0.4) => ({ x, y, vx: 0, vy: 0, ang, sq: 0, sqA: 0 });
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h);
  const band = state.record.bandSel, t = state.t;
  const A = {
    ball() {
      const c = miniCam(w, h, 1.2);
      drawChungi(ctx, { ...c, X: () => w * 0.5, Y: () => h * 0.52, s: h * 0.5 }, ballAt(0, 0, t * 0.8), [{ x: -0.5, y: -0.1 }, { x: -0.8, y: -0.2 }, { x: -1.1, y: -0.35 }], band, t);
      tag(ctx, 'rubber-band loops', w * 0.72, h * 0.22, '#fff1e2', 18); arrow(ctx, w * 0.64, h * 0.28, w * 0.54, h * 0.4, '#ffd35a', 3);
      tag(ctx, 'loose tuft', w * 0.2, h * 0.8, '#fff1e2', 18); arrow(ctx, w * 0.27, h * 0.74, w * 0.33, h * 0.6, '#ffd35a', 3);
    },
    overview() {
      const c = miniCam(w, h, 0.95);
      drawKid(ctx, c, { x: -0.3, dir: 1, run: 0, anim: { t: 0.1, kind: 'inside', side: 1, perfect: true } }, { x: 0.2, y: 0.5 }, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.X(0.2), c.Y(0.5)); ctx.quadraticCurveTo(c.X(1.2), c.Y(5), c.X(2.0), c.Y(0.8)); ctx.stroke(); ctx.setLineDash([]);
      drawChungi(ctx, c, ballAt(1.1, 2.9), [{ x: 0.8, y: 2.7 }, { x: 0.6, y: 2.5 }, { x: 0.4, y: 2.2 }], band, t);
      tag(ctx, 'kick it up, keep it up', w * 0.3, h * 0.14, '#fff1e2', 19);
    },
    tap() {
      const c = miniCam(w, h, 0.9);
      drawKid(ctx, c, { x: 0, dir: 1, run: 0 }, { x: 0, y: 0.7 }, 0);
      drawChungi(ctx, c, ballAt(0, 1.6), [], band, t);
      for (const [dx, nm] of [[-2.1, 'left'], [2.1, 'right']]) {
        ctx.fillStyle = 'rgba(255,224,120,0.3)'; ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.X(dx), c.Y(2.2), c.s * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
        arrow(ctx, c.X(dx > 0 ? 0.5 : -0.5), c.Y(2.0), c.X(dx > 0 ? 1.6 : -1.6), c.Y(3.2), '#ffd35a', 4);
        label(ctx, `tap ${nm}`, c.X(dx), c.Y(2.2) - c.s * 0.5, 17, '#fff1e2');
      }
    },
    kinds() {
      const names = ['Toe poke', 'Inside foot', 'Knee pop'], ys = [0.25, 0.7, 1.1];
      ys.forEach((yy, i) => {
        ctx.save(); ctx.translate((i * w) / 3, 0);
        const c = miniCam(w / 3, h, 1.05); c.cx = w / 6; c.X = (xx) => w / 6 + xx * c.s;
        drawKid(ctx, c, { x: -0.1, dir: 1, run: 0, anim: { t: 0.1, kind: 'inside', side: 1 } }, { x: 0.35, y: yy }, 0);
        drawChungi(ctx, c, ballAt(0.35, yy + 0.15), [], band, t);
        label(ctx, names[i], w / 6, h * 0.97, 17, '#fff1e2');
        ctx.restore();
      });
      void KINDS;
    },
    hoop() {
      const c = miniCam(w, h, 0.9);
      drawHoop(ctx, c, { x: 0.8, y: 3.4, r: 0.85 }, t, 'back');
      drawChungi(ctx, c, ballAt(0.8, 4.2), [{ x: 0.7, y: 4.5 }, { x: 0.5, y: 4.8 }], band, t);
      drawHoop(ctx, c, { x: 0.8, y: 3.4, r: 0.85 }, t, 'front');
      arrow(ctx, c.X(0.8), c.Y(3.9), c.X(0.8), c.Y(2.7), '#ffd35a', 4);
      tag(ctx, 'down through the hoop', w * 0.28, h * 0.3, '#fff1e2', 18);
      void HALF0;
    },
  };
  (A[key] ?? A.ball)();
  ctx.restore();
}
export { TRICKS };
export { drawFx };
