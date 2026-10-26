// Every screen that is not the play screen: title, settings, result, pause, the demo limit card and the About / How to
// play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { THEMES, drawPortrait, drawVenueThumb, glState } from './art.js';
import { drawScene } from './view.js';
import { makeWorld, VENUES, RIVALS, TUNE, BOUTS, rankFor, venueOwned } from './sim.js';
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

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 270) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t, s0) => { let s = s0; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 20 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = fit('LOG', 150), s2 = Math.round(s1 * 0.62);
    ctx.lineWidth = 24; ctx.strokeStyle = 'rgba(6,18,34,0.94)';
    ctx.font = `italic 800 ${s1}px ${DISPLAY}`; ctx.strokeText('LOG', cx, 124);
    ctx.font = `italic 800 ${s2}px ${DISPLAY}`; ctx.strokeText('ROLLING', cx, 124 + s2 * 0.95);
    const g = ctx.createLinearGradient(0, 30, 0, 250); g.addColorStop(0, '#fff6d0'); g.addColorStop(0.5, '#ffc83a'); g.addColorStop(1, '#d9701a');
    ctx.fillStyle = g;
    ctx.font = `italic 800 ${s1}px ${DISPLAY}`; ctx.fillText('LOG', cx, 124);
    const g2 = ctx.createLinearGradient(0, 100, 0, 220); g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#8fd2ff'); ctx.fillStyle = g2;
    ctx.font = `italic 800 ${s2}px ${DISPLAY}`; ctx.fillText('ROLLING', cx, 124 + s2 * 0.95);
    ctx.font = `700 25px ${FONT}`; textShadow(ctx, 'Keep your feet. Tip your rival.', cx, 124 + s2 * 0.95 + 42, '#dff2ff', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, vn = VENUES[rec.venueSel].name, rn = RIVALS[VENUES[rec.venueSel].rival].name;
  wd.push({ t: 'btn', id: 'match', label: 'Play a Match', sub: `${vn} vs ${rn} · best of ${BOUTS}${rec.wins ? ` · ${rec.wins} won` : ''}`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'venue', label: vn, sub: 'Tap to change pond', row: 9 });
  wd.push({ t: 'btn', id: 'bout', label: 'Quick Bout', sub: 'One bout', row: 9 });
  wd.push({ t: 'btn', id: 'practice', label: 'Practice', sub: 'No score', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx], rec = state.record;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#bfe4ff', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#bfe4ff', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: `${rec.wins} match${rec.wins === 1 ? '' : 'es'} won · ${rankFor(rec.wins)}`, size: 24, color: '#bfe4ff' },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: state.owned ? 'Full game unlocked' : 'Restore purchase', sub: state.owned ? 'Thank you for playing' : 'Already bought it? Get it back', dark: true, disabled: !!state.owned || !!state.restoreBusy }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#bfe4ff' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const practice = r.mode === 'practice';
  const label = r.mode === 'watch' ? (r.won ? 'The plan won the bout' : 'The rival won the bout') : practice ? 'Good practice' : r.draw ? 'A draw' : r.won ? (r.mode === 'bout' ? 'You win the bout!' : 'You win the match!') : (r.mode === 'bout' ? 'Rival wins the bout' : 'Rival wins the match');
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 40 }, { t: 'h', label, size: wide ? 44 : 52, cap: big ? 1.2 : 1.5 }];
  if (!practice) {
    wd.push({ t: 'h', label: `${r.score[0]} : ${r.score[1]}`, size: wide ? 76 : 100, cap: big ? 1.1 : 1.3, color: '#ffd24a' });
    wd.push({ t: 'p', label: `against ${r.rivalName} at ${r.venueName}`, size: 26, cap: big ? 2 : 3 });
  } else {
    wd.push({ t: 'h', label: `${r.best.toFixed(1)} s`, size: wide ? 70 : 90, cap: big ? 1.1 : 1.3, color: '#ffd24a' });
    wd.push({ t: 'p', label: `longest stand on the log · ${r.falls} fall${r.falls === 1 ? '' : 's'}`, size: 26, cap: big ? 2 : 3 });
  }
  if (!big && r.bouts && r.bouts.length && !practice) wd.push({ t: 'art', h: Math.min(260, 54 + r.bouts.length * 46), draw: (ctx, w, h) => drawBouts(ctx, w, h, r) });
  wd.push({ t: 'p', label: `${r.kicks} kick${r.kicks === 1 ? '' : 's'} · ${r.tips} rival${r.tips === 1 ? '' : 's'} tipped in by a kick`, size: 24, cap: big ? 2 : 3 });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this match was practice and does not count toward unlocking.', size: 22, color: '#ffe0a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode === 'match' || r.mode === 'bout') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
// Bout by bout: who fell, how long it lasted.
function drawBouts(ctx, w, h, r) {
  roundPath(ctx, 0, 0, w, h, 18); ctx.fillStyle = 'rgba(8,22,38,0.72)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(160,210,255,0.3)'; ctx.stroke();
  const fs = Math.max(14, Math.min(22, h / (r.bouts.length + 1.4) * 0.45));
  r.bouts.forEach((b, i) => {
    const y = 20 + (i + 0.5) * ((h - 40) / r.bouts.length);
    ctx.fillStyle = b.winner === 0 ? '#ffd24a' : '#5fe0d0'; ctx.beginPath(); ctx.arc(30, y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const who = b.winner === 0 ? 'You' : r.rivalName;
    ctx.fillText(`Bout ${i + 1}: ${who} won after ${b.secs.toFixed(0)} s${b.tipped ? ' with a kick' : b.how === 'time' ? ' on balance' : ''}`, 52, y);
  });
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
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every pond, every rival, practice and unlimited play.', size: 28 },
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
      const colTop = Math.max(bottom - btnH, host.t + 360), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 660) / 4));
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
  g.addColorStop(0, `rgba(6,16,32,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,16,32,${a})`); g.addColorStop(1, `rgba(6,16,32,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,16,32,0)'); g.addColorStop(1, 'rgba(6,16,32,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(230,244,255,0.92)'; ctx.fill();
    ctx.fillStyle = '#10243a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(230,244,255,0.92)'; ctx.fill();
    ctx.fillStyle = '#10243a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(230,244,255,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The living background of the menus: a bout that plays itself.
function attract(ctx, state, rect, dim = 0.2) {
  drawScene(ctx, rect, state.att, state.t, {});
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(6,16,32,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top + 40), clear: top + 285 }, 0.08);
    const g = ctx.createRadialGradient(W / 2, top + 140, 40, W / 2, top + 140, 420); g.addColorStop(0, 'rgba(6,16,32,0.6)'); g.addColorStop(1, 'rgba(6,16,32,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(6,16,32,0)'); g2.addColorStop(1, 'rgba(6,16,32,0.88)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(230,244,255,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H, clear: Math.max(host.t, 0) + 6 + 285 * Math.min(1, hw / 640) }, 0.12);
  const g = ctx.createRadialGradient(hx, 150, 30, hx, 150, 360); g.addColorStop(0, 'rgba(6,16,32,0.6)'); g.addColorStop(1, 'rgba(6,16,32,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(230,244,255,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
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
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(14,34,56,0.95)', stroke: 'rgba(160,210,255,0.5)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(244,249,255,0.97)', stroke: 'rgba(20,50,80,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(20,50,80,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(20,50,80,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(20,50,80,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(20,50,80,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#ffffff'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own scene and people) -----------------------------------------------------------------
function tag(ctx, t, x, y, col = '#ffffff', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(6,16,32,0.86)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd24a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
const snap = (key) => (glState.gl && glState.gl.snaps && glState.gl.snaps[key]) || null;
function coverSnap(ctx, img, w, h) {
  // the snapshot is the whole 3D canvas: show its middle, scaled to fill the box
  const iw = img.width, ih = img.height, ar = w / h;
  let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; }
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) * 0.52, sw, sh, 0, 0, w, h);
}
const mini = (venue, lean0, lean1, v = 0, th = 0) => { const w = makeWorld({ venue }); w.phase = 'go'; w.l = [lean0, lean1]; w.v = v; w.th = th; w.ph = [0.6, 2.2]; w.f = [v, v]; return w; };
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  const t = state ? state.t : 0;
  const scene = (venue, a, b, v = 0.5, th = 0) => (snap(key) ? coverSnap(ctx, snap(key), w, h) : drawScene(ctx, { x: 0, y: 0, w, h, zoom: 1.75, wl: 0.8 }, mini(venue, a, b, v, th), t, { mini: true }));
  const A = {
    log() { scene(0, 0.15, -0.1, 0.4, 0.7); tag(ctx, 'you', w * 0.3, h * 0.12, '#ffd24a', 16); tag(ctx, 'rival', w * 0.7, h * 0.12, '#5fe0d0', 16); },
    lean() {
      scene(1, 0.7, 0, 0.2, 0.3);
      const bx = w * 0.06, bw = w * 0.36, by = h * 0.16;
      roundPath(ctx, bx, by, bw, 18, 9); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      ctx.fillStyle = '#4fd07a'; ctx.fillRect(bx + bw * 0.2, by, bw * 0.6, 18); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(bx + bw * 0.5 + bw * 0.35, by + 9, 11, 0, TAU); ctx.fill();
      tag(ctx, 'lean grows', w * 0.24, h * 0.34, '#ffe9a0', 16); arrow(ctx, w * 0.62, h * 0.82, w * 0.44, h * 0.82, '#ffd24a', 5); tag(ctx, 'drag the other way', w * 0.5, h * 0.93, '#ffd24a', 16);
    },
    kick() {
      const hw = w / 2;
      for (let k = 0; k < 2; k++) {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3c8cd2'); g.addColorStop(1, '#1d4f96'); ctx.fillStyle = g; ctx.fillRect(k * hw + 3, 3, hw - 6, h - 6);
        const tip = k === 0 ? -1 : 1, ax = k * hw + hw / 2, ay = h * 0.4, sz = h * 0.15;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ax + tip * sz, ay); ctx.lineTo(ax - tip * sz * 0.2, ay - sz * 0.9); ctx.lineTo(ax - tip * sz * 0.2, ay + sz * 0.9); ctx.closePath(); ctx.fill();
        tag(ctx, tip < 0 ? 'Tap: tip left' : 'Tap: tip right', ax, h * 0.74, '#ffffff', 18);
      }
      tag(ctx, 'rival slips, your feet go with the log', w * 0.5, h * 0.12, '#ffe9a0', 15);
    },
    momentum() {
      const bx = w * 0.08, bw = w * 0.84, by = h * 0.42, bh = 36;
      ctx.fillStyle = '#0e2238'; ctx.fillRect(0, 0, w, h);
      roundPath(ctx, bx, by, bw, bh, 18); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      ctx.save(); roundPath(ctx, bx, by, bw, bh, 18); ctx.clip();
      const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#c8ffd8'); g.addColorStop(1, '#2fae5e'); ctx.fillStyle = g; ctx.fillRect(bx, by, bw * 0.72, bh); ctx.restore();
      ctx.fillStyle = '#fff'; for (let k = 1; k * TUNE.cost < 1; k++) ctx.fillRect(bx + bw * k * TUNE.cost - 1, by - 3, 2, bh + 6);
      tag(ctx, `one kick = ${Math.round(TUNE.cost * 100)}%`, w * 0.5, h * 0.18, '#ffe9a0', 18); tag(ctx, 'fills while you stand steady', w * 0.5, h * 0.82, '#9be8b0', 18);
    },
    venues() { VENUES.forEach((v, i) => { drawVenueThumb(ctx, i, w * (0.03 + i * 0.245), h * 0.1, w * 0.22, h * 0.8, t); }); },
    rivals() { RIVALS.forEach((r, i) => { ctx.fillStyle = 'rgba(14,34,56,0.9)'; ctx.fillRect(w * (0.03 + i * 0.245), h * 0.06, w * 0.22, h * 0.88); drawPortrait(ctx, i, w * (0.14 + i * 0.245), h * 0.46, h * 0.5); ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(h * 0.1)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(r.name, w * (0.14 + i * 0.245), h * 0.88); }); },
  };
  (A[key] ?? A.log)();
  ctx.restore();
}
void THEMES;
