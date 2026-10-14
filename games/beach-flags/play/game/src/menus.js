// Every screen that is not the play screen: title, cups, settings, outfits, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { makeCam, drawRound, drawMini, drawMiniBaton, poses } from './art.js';
import { TIERS, IDEAL_LO, IDEAL_HI, FLAG_Z } from './sim.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { OUTFITS } from './outfits.js';

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
export const outfitOwned = (rec, i) => !!(rec.owned && rec.owned[i]);
const stars = (n) => '★'.repeat(Math.min(3, n)) + '☆'.repeat(Math.max(0, 3 - n));

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    let fs = 140; ctx.font = `italic 800 ${fs}px ${DISPLAY}`;
    while (ctx.measureText('Beach Flags').width > w - 40 && fs > 60) { fs -= 4; ctx.font = `italic 800 ${fs}px ${DISPLAY}`; }
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(4,30,56,0.94)'; ctx.strokeText('Beach Flags', cx, 168);
    const g = ctx.createLinearGradient(0, 56, 0, 190); g.addColorStop(0, '#fffbd0'); g.addColorStop(0.45, '#ffc83d'); g.addColorStop(1, '#ee4f1c'); ctx.fillStyle = g; ctx.fillText('Beach Flags', cx, 168);
    ctx.font = `700 28px ${FONT}`; textShadow(ctx, 'Sprint, dive, grab the last flag', cx, 222, '#fff3c9', 6);
    ctx.font = `600 22px ${FONT}`; textShadow(ctx, 'From the surf lifesaving carnivals of Australia', cx, 254, '#c8f0ff', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [], ch = land() ? { h: 60 } : {};
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, tier = TIERS[clamp(rec.sel | 0, 0, TIERS.length - 1)];
  wd.push({ t: 'btn', id: 'cup', label: 'Play Cup', sub: `${tier.name}  ${stars(rec.cups[rec.sel | 0] > 0 ? 3 : (rec.bestRounds && rec.bestRounds[rec.sel | 0] ? 1 : 0))}`, primary: true, h: land() ? 76 : 92 });
  wd.push({ t: 'btn', id: 'sudden', label: 'Sudden Death', sub: rec.suddenBest ? `Best streak ${rec.suddenBest}` : 'One flag, two racers', row: 1, ...ch });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Beach', sub: state.record.dailyDay === state.day && rec.dailyBest ? `Today ${rec.dailyBest}` : 'A new field today', row: 1, ...ch });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2, ...ch });
  wd.push({ t: 'btn', id: 'cups', label: 'Choose cup', row: 2, ...ch });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3, ...ch });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3, ...ch });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3, ...ch });
  wd.push({ t: 'btn', id: 'outfits', label: 'Outfits', row: 4, ...ch });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4, ...ch });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4, ...ch });
  return wd;
}

export function cupsWidgets(state) {
  const rec = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Choose a cup', size: 48 }];
  TIERS.forEach((t, i) => {
    const open = i <= rec.tier;
    wd.push({ t: 'btn', id: `tier-${i}`, label: t.name, sub: open ? `${t.blurb}  ·  won ${rec.cups[i] | 0}×` : 'Win the previous cup to open this one', active: open && rec.sel === i, disabled: !open, h: 104 });
  });
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx], ch = land() ? { h: 58 } : {};
  return [
    { t: 'gap', h: land() ? 0 : 10 }, { t: 'h', label: 'Settings', size: land() ? 40 : 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', ...ch },
    { t: 'btn', id: 'set-guide', label: st.guide ? 'Tap hints: On' : 'Tap hints: Off', sub: 'Short reminders during the first rounds', active: st.guide, ...(land() ? { h: 66 } : {}) },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#fff3c9', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0, ...ch },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1, ...ch },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#fff3c9', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0, ...ch },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1, ...ch },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', bold: true, size: 26, color: '#fff3c9' }] : [{ t: 'btn', id: 'restore', label: 'Restore purchase', dark: true, ...ch }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#fff3c9' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: land() ? 62 : 84 },
    { t: 'gap', h: 30 },
  ];
}

export function outfitsWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 3, gap = 18, cell = Math.min(190, Math.floor((w - gap * (cols - 1)) / cols)), bh = 2 * (cell + gap) - gap;
  const grid = {
    t: 'art', h: bh,
    draw(ctx, ww, hh, at) {
      COLL.rects = [];
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      OUTFITS.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (cell + gap), has = outfitOwned(rec, i);
        roundPath(ctx, x, y, cell, cell, 20); ctx.fillStyle = sel === i ? 'rgba(255,214,120,0.35)' : 'rgba(6,40,70,0.66)'; ctx.fill();
        ctx.lineWidth = rec.outfit === i ? 4 : 2; ctx.strokeStyle = rec.outfit === i ? '#7fe8f0' : 'rgba(255,255,255,0.3)'; ctx.stroke();
        ctx.save(); ctx.globalAlpha = has ? 1 : 0.35;
        drawMini(ctx, x + cell / 2, y + cell * 0.8, cell * 0.28, { ...d.look }, { ph: 0.8, lean: 0.25, eff: 0.5, you: true, number: 1, st: { phase: 'run', v: 5 }, t: state.t });
        ctx.restore();
        if (!has) { ctx.fillStyle = '#fff8e6'; ctx.font = `700 ${Math.round(cell * 0.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + cell * 0.42); }
        ctx.fillStyle = '#fff8e6'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.115))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + cell - 14);
        COLL.rects.push({ kind: 'b', i, x: at.x + x, y: at.y + y, w: cell, h: cell });
      });
    },
  };
  let info = '';
  if (sel != null) { const d = OUTFITS[sel]; info = outfitOwned(rec, sel) ? (rec.outfit === sel ? `${d.name} is in use.` : `${d.name}. Tap again to use it.`) : `${d.name}: ${d.how}.`; }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Outfits', size: 48 },
    grid,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 60 }];
  const title = r.mode === 'watch' ? 'Rounds complete' : r.mode === 'sudden' ? `Streak ${r.streak}` : r.champion ? 'Cup won!' : `Out in round ${r.roundOut}`;
  wd.push({ t: 'h', label: title, size: wide ? 52 : 60, cap: big ? 1.2 : 1.5, color: r.champion ? '#ffd35a' : '#fff6e0' });
  if (r.mode !== 'watch') wd.push({ t: 'h', label: `${r.score} pts`, size: wide ? 70 : 84, cap: big ? 1.1 : 1.3, color: '#ffd35a' });
  const bits = [];
  if (r.mode !== 'watch') bits.push(`${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} survived`);
  if (r.bestReact != null) bits.push(`best reaction ${Math.round(r.bestReact * 1000)} ms`);
  if (r.dives) bits.push(`${r.dives} ${r.dives === 1 ? 'dive grab' : 'dive grabs'}`);
  if (bits.length) wd.push({ t: 'p', label: bits.join(' · '), size: 26, cap: big ? 2 : 3 });
  if (r.newBest) wd.push({ t: 'p', label: 'New personal best', size: 26, color: '#b8f0a8', bold: true, cap: big ? 2 : 3 });
  if (r.msg) wd.push({ t: 'p', label: r.msg, size: 26, color: '#b8f0a8', bold: true, cap: big ? 2 : 3 });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice cup and is not saved as a best.', size: 22, color: '#ffe0a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#b8f0a8', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'outfits', label: 'Open Outfits', active: true });
  wd.push({ t: 'gap', h: wide ? 8 : 20 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : r.champion && r.nextTier ? 'Next cup' : 'Play again', primary: true, h: 92 });
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
    { t: 'btn', id: 'p-guide', label: st.guide ? 'Tap hints: On' : 'Tap hints: Off', row: 8, active: st.guide },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free cups of the web demo. The full game on iPhone and Android has every cup, Sudden Death, the Daily Beach, all outfits and unlimited racing.', size: 28 },
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
    const cw = clamp(Math.round(W * 0.4), 440, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'cups') return { cols: [{ widgets: cupsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'outfits') return { cols: [{ widgets: outfitsWidgets(state, w), x, w, top: host.t, bottom: H - host.b }] };
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
  g.addColorStop(0, `rgba(4,26,46,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,26,46,${a})`); g.addColorStop(1, `rgba(4,26,46,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,26,46,0)'); g.addColorStop(1, 'rgba(4,26,46,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,220,0.92)'; ctx.fill();
    ctx.fillStyle = '#0c2638'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,220,0.92)'; ctx.fill();
    ctx.fillStyle = '#0c2638'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

// The living background of the menus: AI racers fight for flags on the beach.
function attract(ctx, state, rect, dim = 0.2, drop = 0) {
  const round = state.att;
  const cam = makeCam(rect, state.attX || 0, state.attZ == null ? -6 : state.attZ);
  cam.yh += drop;                                    // the title lettering sits over the sky: lower the scene so the flags show under it
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  drawRound(ctx, cam, round, { t: state.t, fx: state.attFx, marker: false });
  ctx.restore();
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(6,38,66,0.74)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(520, fr.cols[0].top + 70) }, 0.06, 120);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(4,26,46,0.62)'); g.addColorStop(1, 'rgba(4,26,46,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(4,26,46,0)'); g2.addColorStop(1, 'rgba(4,26,46,0.88)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.6)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H }, 0.1, 90);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(4,26,46,0.58)'); g.addColorStop(1, 'rgba(4,26,46,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.6)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'settings'); }
export function renderCups(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'cups'); }
export function renderOutfits(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'outfits'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.74 : 0.7); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(8,46,78,0.96)', stroke: 'rgba(255,230,150,0.55)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,248,232,0.97)', stroke: 'rgba(10,53,80,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(10,53,80,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(10,53,80,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(10,53,80,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(10,53,80,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff1e2'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own runners and batons) --------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff8e6', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(6,38,66,0.88)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd35a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6cc2f2'); g.addColorStop(0.28, '#cfeeff'); g.addColorStop(0.3, '#1fa4cf'); g.addColorStop(0.42, '#4fd2dd'); g.addColorStop(0.44, '#f1dcab'); g.addColorStop(1, '#e2c68a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(10,53,80,0.55)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function gaugeBar(ctx, x, y, w, h, since) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(6,38,66,0.88)'; ctx.fill();
  const span = 0.6, u = (v) => x + 10 + (Math.min(span, v) / span) * (w - 20);
  ctx.fillStyle = 'rgba(255,110,80,0.6)'; ctx.fillRect(x + 10, y + h * 0.3, u(0.17) - x - 10, h * 0.4);
  ctx.fillStyle = '#ffd35a'; ctx.fillRect(u(IDEAL_LO), y + h * 0.22, u(IDEAL_HI) - u(IDEAL_LO), h * 0.56);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(u(since), y + 3); ctx.lineTo(u(since) - 7, y - 6); ctx.lineTo(u(since) + 7, y - 6); ctx.closePath(); ctx.fill(); ctx.fillRect(u(since) - 2, y + 3, 4, h - 6);
}
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h);
  const look = OUTFITS[state.record.outfit || 0].look, t = state.t, others = (i) => ({ ...look, top: ['#e8503a', '#2f8fd6', '#2fb67a', '#8a5cf0', '#ff8a2f'][i % 5], cap: ['#e8503a', '#2f8fd6', '#2fb67a', '#8a5cf0', '#ff8a2f'][i % 5], skin: ['#f0c19a', '#8a5a3a', '#e0a878', '#5e3b27', '#d99a6c'][i % 5] });
  const s = Math.min(w / 11, h / 3.2);
  const A = {
    start() {
      const yb = h * 0.9;
      for (let i = 0; i < 5; i++) drawMini(ctx, w * (0.2 + 0.15 * i), yb - h * 0.12, s * 0.85, i === 2 ? look : others(i), { pose: poses.prone(Math.sin(t * 2.5 + i), 0), yaw: Math.PI, you: i === 2, long: true, st: { phase: 'prone' }, t });
      for (let i = 0; i < 4; i++) drawMiniBaton(ctx, w * (0.275 + 0.15 * i), h * 0.55, s * 0.9, { t, ring: false });
      tag(ctx, 'face down, backs to the flags', w * 0.5, h * 0.12, '#fff8e6', 18);
    },
    flags() {
      for (let i = 0; i < 5; i++) drawMini(ctx, w * (0.2 + 0.15 * i), h * 0.9 - (i % 2) * h * 0.08, s * 0.9, i === 2 ? look : others(i), { ph: 0.5 + i, lean: 0.35, eff: 0.8, you: i === 2, st: { phase: 'run', v: 6 }, t });
      for (let i = 0; i < 4; i++) drawMiniBaton(ctx, w * (0.275 + 0.15 * i), h * 0.56, s * 0.85, { t });
      tag(ctx, '5 racers, 4 flags: one is out', w * 0.5, h * 0.12, '#fff8e6', 18);
    },
    rhythm() {
      gaugeBar(ctx, w * 0.08, h * 0.5, w * 0.84, 34, (t * 0.35) % 0.6);
      label(ctx, 'too quick', w * 0.18, h * 0.82, 17, '#7a1c10'); label(ctx, 'gold: best rhythm', w * 0.5, h * 0.82, 17, '#7a5400'); label(ctx, 'slow', w * 0.88, h * 0.82, 17, '#0a3550');
      drawMini(ctx, w * 0.5, h * 0.38, s * 0.55, look, { ph: t * 9, lean: 0.4, eff: 0.9, you: true, st: { phase: 'run', v: 7 }, t });
    },
    steer() {
      drawMini(ctx, w * 0.35, h * 0.92, s * 1.05, look, { ph: 1.2, lean: 0.4, eff: 0.8, you: true, st: { phase: 'run', v: 6 }, t });
      drawMiniBaton(ctx, w * 0.72, h * 0.62, s * 1.0, { t, ring: true });
      arrow(ctx, w * 0.4, h * 0.3, w * 0.62, h * 0.3, '#e23a62', 6);
      tag(ctx, 'tap to the side to drift that way', w * 0.5, h * 0.12, '#fff8e6', 17);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w * 0.66, h * 0.8, 20, 0, TAU); ctx.stroke(); ctx.restore();
    },
    dive() {
      drawMini(ctx, w * 0.3, h * 0.88, s * 1.0, look, { pose: poses.dive(0.35, true), yaw: 0, you: true, long: true, baton: false, st: { phase: 'dive', pt: 0.2, target: [0.6, 1.6] }, t });
      drawMiniBaton(ctx, w * 0.74, h * 0.72, s * 1.0, { t, ring: true });
      arrow(ctx, w * 0.4, h * 0.38, w * 0.7, h * 0.38, '#ffd35a', 5);
      tag(ctx, 'a dive stretches further than a run', w * 0.5, h * 0.12, '#fff8e6', 17);
    },
  };
  (A[key] ?? A.start)();
  ctx.restore();
}
export { FLAG_Z };
