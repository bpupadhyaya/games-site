// Every screen that is not the play screen: title, settings, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { THEMES, drawPlace, drawSpot, drawKid, badge } from './art.js';
import { drawAttract } from './view.js';
import { PLACES, LEVELS, rankFor, placeOwned, stars } from './sim.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;
let PAGE_COUNT = 1;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
export function resetMenus() { LAID = blankLaid(); PAGE_COUNT = 1; }
const land = () => W > H;
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.rev}`;
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);
export const bestOf = (rec) => Math.max(...rec.bestSeek.map((v) => v | 0), ...rec.bestHide.map((v) => v | 0), rec.bestDaily | 0);
export const dailyPlace = (day) => ((day % PLACES.length) + PLACES.length) % PLACES.length;

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t, s0) => { let s = s0; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 20 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = fit('Hide and', 118);
    ctx.lineWidth = 24; ctx.strokeStyle = 'rgba(6,24,30,0.92)';
    ctx.strokeText('Hide and', cx, 124); ctx.strokeText('Seek', cx, 124 + s1 * 0.86);
    // embossed lettering: a dark outline, a stack of offset copies for the thickness, the lit face, a bevel highlight
    const ys = [124, 124 + s1 * 0.86];
    ['Hide and', 'Seek'].forEach((t, i) => {
      const y = ys[i];
      for (let d = 14; d >= 1; d--) { ctx.fillStyle = d > 9 ? '#06241e' : d > 4 ? '#0c4a3a' : '#17705a'; ctx.fillText(t, cx + d * 0.18, y + d); }
      const g = ctx.createLinearGradient(0, y - s1 * 0.8, 0, y + 6); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#9af0c0'); g.addColorStop(1, '#27b088');
      ctx.fillStyle = g; ctx.fillText(t, cx, y);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.strokeText(t, cx - 1, y - 1);
      ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.restore();
    });
    ctx.font = `700 24px ${FONT}`; textShadow(ctx, 'Nascondino · Petak Umpet · Kakurenbo', cx, 124 + s1 * 0.86 + 48, '#ffeed0', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), pl = PLACES[rec.placeSel], lv = LEVELS[rec.level];
  const nextLocked = PLACES.findIndex((p, i) => !placeOwned(rec, i));
  const best = rec.bestSeek[rec.placeSel] | 0;
  wd.push({ t: 'btn', id: 'seek', label: 'Seek', sub: best ? `${pl.name} · best ${best}` : `${pl.name} · find the hiders`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'hide', label: 'Hide', sub: rec.bestHide[rec.placeSel] ? `best ${rec.bestHide[rec.placeSel]}` : 'Outwit the seeker', row: 8, active: true });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Hunt', sub: dk >= 0 ? `Today ${dk}` : 'Same hiders for all', row: 8 });
  wd.push({ t: 'btn', id: 'place', label: pl.name, sub: nextLocked >= 0 ? `Next place opens after ${PLACES[nextLocked].need} found` : 'Tap to change place', row: 9 });
  wd.push({ t: 'btn', id: 'level', label: lv.name, sub: `${lv.hiders} hiders · ${lv.looks} looks`, row: 9 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
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
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe3b8', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#ffe3b8', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [state.owned ? { t: 'btn', id: 'owned', label: 'Full game unlocked', dark: true, disabled: true } : { t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe3b8' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const pl = PLACES[r.place];
  const label = r.newBest ? 'New best!' : r.win ? (r.role === 'hide' ? 'Not found!' : 'Everyone found!') : r.role === 'hide' ? 'Found you!' : rankFor(r.total);
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  wd.push({ t: 'h', label: `${r.total}`, size: wide ? 80 : 104, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  if (r.role === 'seek') wd.push({ t: 'p', label: `${r.found} of ${r.hiders} hiders in ${r.looks} look${r.looks === 1 ? '' : 's'} · ${pl.name}`, size: 26, cap: big ? 2 : 3 });
  else wd.push({ t: 'p', label: `${r.survived} seeker look${r.survived === 1 ? '' : 's'} survived · ${r.sneaks} safe sneak${r.sneaks === 1 ? '' : 's'} · ${pl.name}`, size: 26, cap: big ? 2 : 3 });
  if (!big) wd.push({ t: 'art', h: wide ? 110 : 150, draw: (ctx, w, h) => drawResultArt(ctx, w, h, r, state.t) });
  if (r.memo) wd.push({ t: 'p', label: r.memo, size: 24, color: '#cfe9ff', cap: big ? 2 : 3 });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice run and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `New place open: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode !== 'watch') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
// stars over the children found (or you, cheering)
function drawResultArt(ctx, w, h, r, t) {
  roundPath(ctx, 0, 0, w, h, 18); ctx.save(); ctx.clip();
  const th = PLACES[r.place].theme, T = THEMES[th];
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.62); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = T.ground[0]; ctx.fillRect(0, h * 0.62, w, h);
  const kids = r.role === 'seek' ? r.kids : [5];
  const n = Math.max(1, kids.length);
  const wd = globalThis.__world3d && globalThis.__world3d.ready ? globalThis.__world3d : null;
  kids.forEach((k, i) => {
    const pc = wd && wd.portrait(k % 6, 160), sz = Math.min(h * 0.62, w / n * 0.8), cx = ((i + 0.5) / n) * w, cy = h * 0.62;
    if (pc) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, sz / 2, 0, TAU); ctx.clip(); ctx.drawImage(pc, cx - sz / 2, cy - sz / 2, sz, sz); ctx.restore(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd97a'; ctx.beginPath(); ctx.arc(cx, cy, sz / 2, 0, TAU); ctx.stroke(); }
    else drawKid(ctx, k, cx, h * 0.92, h * 0.55, r.win || r.role === 'seek' ? 'cheer' : 'stand', t + i);
  });
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; roundPath(ctx, 0, 0, w, h, 18); ctx.stroke();
  const n3 = r.stars | 0;
  ctx.font = `800 ${Math.round(Math.min(40, h * 0.3))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i < n3 ? '#ffd97a' : 'rgba(255,255,255,0.35)'; ctx.strokeStyle = 'rgba(20,10,0,0.55)'; ctx.lineWidth = 3; const x = w / 2 + (i - 1) * Math.min(48, h * 0.34), y = h * 0.2; ctx.strokeText('★', x, y); ctx.fillText('★', x, y); }
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', row: 8, dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free rounds of the web demo. The full game on iPhone and Android has every place, every level, the daily hunt and unlimited play.', size: 28 },
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
      const colTop = Math.max(bottom - btnH, host.t + 296), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 700) / 4));
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
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
  g.addColorStop(0, `rgba(8,22,30,${a * 0.7})`); g.addColorStop(0.5, `rgba(8,22,30,${a})`); g.addColorStop(1, `rgba(8,22,30,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,22,30,0)'); g.addColorStop(1, 'rgba(8,22,30,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,244,214,0.92)'; ctx.fill();
    ctx.fillStyle = '#22262e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,244,214,0.92)'; ctx.fill();
    ctx.fillStyle = '#22262e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,244,214,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The living background of the menus: a place where children peek out of the spots.
function attract(ctx, state, rect, dim = 0.2) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  drawAttract(ctx, rect, state.attPlace, state.t, host);
  ctx.restore();
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(8,24,34,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: 0, w: W, h: H }, 0.1);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(6,20,30,0.66)'); g.addColorStop(1, 'rgba(6,20,30,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(8,22,30,0)'); g2.addColorStop(1, 'rgba(8,22,30,0.88)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, fullRect(), 0.14);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(6,20,30,0.66)'); g.addColorStop(1, 'rgba(6,20,30,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'settings'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.64 : 0.58); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(16,36,50,0.95)', stroke: 'rgba(255,224,160,0.5)' });
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
  backdrop(ctx, state, 0.74);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,245,230,0.97)', stroke: 'rgba(20,50,50,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(20,50,50,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(20,50,50,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(20,50,50,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(20,50,50,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own spots and children) -------------------------------------------------------------------
function tag(ctx, t, x, y, col = '#fff6e6', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(8,24,34,0.84)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, th = 0) {
  const T = THEMES[th];
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  drawPlace(ctx, th, { x: 0, y: 0, w, h }, h * 0.38, 0, 0, Math.min(1, h / 460));
  ctx.restore(); ctx.strokeStyle = 'rgba(20,40,50,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
  void T;
}
const spotAtPx = (ctx, th, i, x, y, k, t = 0) => { const sp = PLACES[th].spots[i]; drawSpot(ctx, PLACES[th].theme, sp.kind, x, y, k, { v: sp.v, t }); };
const KINDS3 = (pl) => PLACES[pl].spots.map((q) => ({ kind: q.kind, v: q.v }));
// the 3D scene photographed for the page art; null until the world is loaded (the 2D pictures show meanwhile)
function art3d(ctx, key, w, h) {
  const wd = globalThis.__world3d;
  if (!wd || !wd.ready || globalThis.__world3dOff) return false;
  try {
    if (key === 'places') {
      const parts = [0, 1, 2].map((i) => wd.snapshot(`place${i}`, w / 3, h, KINDS3));
      if (parts.some((p) => !p)) return false;
      ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
      parts.forEach((p, i) => ctx.drawImage(p, (w / 3) * i, 0, w / 3, h));
      ctx.restore(); return true;
    }
    const img = wd.snapshot(key === 'scene' || key === 'clue' || key === 'listen' || key === 'hide' || key === 'sneak' ? key : 'scene', w, h, KINDS3);
    if (!img) return false;
    ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip(); ctx.drawImage(img, 0, 0, w, h); ctx.restore();
    return true;
  } catch (e) { return false; }
}
export function drawArt(key, ctx, x, y, w, h, state) {
  const t = state ? state.t : 0;
  ctx.save(); ctx.translate(x, y);
  if (art3d(ctx, key, w, h)) {
    const k3 = Math.min(h / 250, w / 520);
    const T = { scene: () => tag(ctx, 'eight hiding places in every scene', w * 0.5, h * 0.1, '#fff6e6', 18),
      places: () => PLACES.forEach((p, i) => { const cx = w * (0.17 + i * 0.33); tag(ctx, p.name, cx, h * 0.12 + (i % 2) * 22, '#fff6e6', Math.max(12, Math.round(16 * k3 * 1.1))); tag(ctx, p.local, cx, h * 0.92, '#ffe3b8', Math.max(11, Math.round(14 * k3 * 1.1))); }),
      clue: () => { tag(ctx, 'cold', w * 0.2, h * 0.1, '#bfe2ff', 17); tag(ctx, 'warm', w * 0.5, h * 0.1, '#ffe3a0', 17); tag(ctx, 'hot', w * 0.8, h * 0.1, '#ffb8a8', 17); tag(ctx, 'hiders in the places next to it', w * 0.5, h * 0.92, '#fff6e6', 15); },
      listen: () => tag(ctx, 'someone is giggling in one of these', w * 0.5, h * 0.08, '#fff6e6', 16),
      hide: () => { badge(ctx, 'you', w * 0.2, h * 0.52, 15, '#2f9c5a'); badge(ctx, 'looking here', w * 0.82, h * 0.4, 14, '#c8362a'); },
      sneak: () => tag(ctx, 'a rustle may be heard', w * 0.5, h * 0.1, '#fff6e6', 17) };
    (T[key] || T.scene)();
    ctx.strokeStyle = 'rgba(20,40,50,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
    ctx.restore(); return;
  }
  const place = key === 'places' ? 0 : key === 'hide' || key === 'sneak' ? 1 : key === 'listen' ? 2 : 0;
  panelBg(ctx, w, h, PLACES[place].theme);
  const k = Math.min(h / 250, w / 520), by = h * 0.86;
  const A = {
    scene() {
      [[0, 0.16, 0.6], [4, 0.38, 0.72], [5, 0.62, 0.7], [3, 0.84, 0.6]].forEach(([i, fx, fy], j) => spotAtPx(ctx, 0, i, w * fx, h * fy + h * 0.2, k * 0.9, t + j));
      drawKid(ctx, 1, w * 0.5 + 40 * k, h * 0.78 + 26 * k * (0.2 + 0.2 * Math.sin(t * 2)), 80 * k, 'peek', t);
      tag(ctx, 'eight hiding places in every scene', w * 0.5, h * 0.1, '#fff6e6', 18);
    },
    places() {
      PLACES.forEach((p, i) => {
        const cx = w * (0.17 + i * 0.33);
        spotAtPx(ctx, i, 4, cx, by - 18 * k, k * 0.85, t + i);
        tag(ctx, p.name, cx, h * 0.16 + (i % 2) * 22, '#fff6e6', Math.max(12, Math.round(16 * k * 1.1)));
        tag(ctx, p.local, cx, by + 10 * k, '#ffe3b8', Math.max(11, Math.round(14 * k * 1.1)));
      });
    },
    clue() {
      const xs = [0.2, 0.5, 0.8], cs = [0, 1, 2], cols = ['#4aa8e8', '#f2a92e', '#e8503a'];
      xs.forEach((fx, i) => {
        ctx.save(); ctx.translate(w * fx, by); ctx.scale(1, 0.26); ctx.beginPath(); ctx.arc(0, 0, 70 * k, 0, TAU); ctx.lineWidth = 8 * k; ctx.strokeStyle = cols[i]; ctx.stroke(); ctx.restore();
        spotAtPx(ctx, 0, [4, 3, 7][i], w * fx, by, k * 0.82, t);
        badge(ctx, String(cs[i]), w * fx, by + 26 * k, Math.max(13, Math.round(18 * k)), cols[i]);
      });
      tag(ctx, 'cold', w * 0.2, h * 0.12, '#bfe2ff', 17); tag(ctx, 'warm', w * 0.5, h * 0.12, '#ffe3a0', 17); tag(ctx, 'hot', w * 0.8, h * 0.12, '#ffb8a8', 17);
      tag(ctx, 'hiders in the places next to it', w * 0.5, h * 0.3, '#fff6e6', 15);
    },
    listen() {
      [[0, 0.2], [1, 0.5], [2, 0.8]].forEach(([i, fx], j) => {
        spotAtPx(ctx, 2, [0, 1, 4][j], w * fx, by, k * 0.82, t);
        const bob = Math.sin(t * 3 + j) * 4;
        ctx.fillStyle = 'rgba(255,248,214,0.95)'; ctx.strokeStyle = '#d9a52c'; ctx.lineWidth = 3; roundPath(ctx, w * fx - 22, h * 0.18 + bob, 44, 32, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8a5a14'; ctx.font = `800 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', w * fx, h * 0.18 + 17 + bob);
        void i;
      });
      tag(ctx, 'someone is giggling in one of these', w * 0.5, h * 0.08, '#fff6e6', 16);
    },
    hide() {
      spotAtPx(ctx, 1, 4, w * 0.3, by, k * 0.95, t);
      drawKid(ctx, 5, w * 0.3 + 4 * k, by - 4 * k, 105 * k, 'crouch', t, { alpha: 0.4 });
      badge(ctx, 'you', w * 0.3, by - 190 * k * 0.95, 15, '#2f9c5a');
      spotAtPx(ctx, 1, 1, w * 0.74, by, k * 0.95, t);
      drawKid(ctx, 4, w * 0.58, by + 4, 92 * k, 'walk', t);
      badge(ctx, 'looking here', w * 0.74, by - 200 * k * 0.95, 14, '#c8362a');
      arrow(ctx, w * 0.6, h * 0.45, w * 0.68, h * 0.45, '#ffd36a', 5);
    },
    sneak() {
      spotAtPx(ctx, 1, 4, w * 0.26, by, k * 0.9, t);
      spotAtPx(ctx, 1, 0, w * 0.74, by, k * 0.9, t);
      arrow(ctx, w * 0.34, by - 30 * k, w * 0.66, by - 30 * k, '#8af0b0', 6);
      drawKid(ctx, 5, w * 0.5, by + 6, 86 * k, 'walk', t);
      tag(ctx, 'a rustle may be heard', w * 0.5, h * 0.12, '#fff6e6', 17);
    },
  };
  (A[key] ?? A.scene)();
  ctx.restore();
}
void stars; void LEVELS;
