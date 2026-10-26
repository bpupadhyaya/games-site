// Every screen that is not the play screen: title, setup, settings, result, pause, collection, and the scrolling
// About / How to play / Rules reader with its illustrations (drawn with the game's own disc and floor art).
// Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, setupPins } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { R, RUG, FLOOR, DESIGNS, COVER, scatterRadius } from './sim.js';
import { drawDisc, drawDots, drawFloor, TEAM } from './art.js';
import { drawTable, drawBackdrop } from './view.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { v3 } from './v3.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;
const GOLD = '#ffe9a0';

// ---- flow screens ------------------------------------------------------------------------------
// Every menu screen is a list of widgets laid out by flowLayout in one or two columns. Portrait: one column, 640 wide.
// Landscape: the title puts the artwork on the left and the buttons on the right; setup splits rivals / match length;
// everything else is one centred column. A column that does not fit scrolls (text size up to 300%).
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
export function resetMenus() { LAID = blankLaid(); }
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.setup.mode}|${state.demo ? 1 : 0}`;
const land = () => W > H;
const oyOf = () => Math.max(0, (H - 1280) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const L = land();
  if (key === 'title') {
    if (!L) return { cols: [{ widgets: titleWidgets(state, false, heroScaleFor(state)), x: 40, w: 640, top: Math.max(host.t, oyOf()), bottom: H - host.b - lockSize(600).strip }], oy: oyOf() };
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state, true), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  if (key === 'setup') {
    if (!L) {
      const pins = setupPins();
      return { cols: [{ widgets: setupWidgets(state, 'all'), x: 40, w: 640, top: host.t, bottom: pins.start.y - 26 }], pins };
    }
    const g = 24, ph = 84;
    if (sc <= 1.01 && state.setup.mode !== 'two') {
      const cw = Math.min(520, Math.floor((W - 80 - g) / 2)), x0 = Math.round((W - (2 * cw + g)) / 2), by = H - host.b - 16;
      const pins = { start: { x: x0 + cw + g, y: by - 2 * ph - 12, w: cw, h: ph }, back: { x: x0 + cw + g, y: by - ph, w: cw, h: ph } };
      return { cols: [
        { widgets: setupWidgets(state, 'left'), x: x0, w: cw, top: host.t + 6, bottom: H - host.b - 6 },
        { widgets: setupWidgets(state, 'right'), x: x0 + cw + g, w: cw, top: host.t + 6, bottom: pins.start.y - 16 },
      ], pins };
    }
    const cw = Math.min(640, W - 80), x0 = Math.round((W - cw) / 2), by = H - host.b - 16;
    const pins = { start: { x: x0, y: by - ph, w: Math.round(cw * 0.66), h: ph }, back: { x: x0 + Math.round(cw * 0.66) + 12, y: by - ph, w: cw - Math.round(cw * 0.66) - 12, h: ph } };
    return { cols: [{ widgets: setupWidgets(state, 'all'), x: x0, w: cw, top: host.t + 6, bottom: pins.start.y - 16 }], pins };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  if (key === 'settings') {
    if (L && sc <= 1.01) {
      const cw = Math.min(520, Math.floor((W - 80 - 24) / 2)), x0 = Math.round((W - (2 * cw + 24)) / 2);
      return { cols: [
        { widgets: settingsWidgets(state, 'left'), x: x0, w: cw, top: host.t, bottom: H - host.b },
        { widgets: settingsWidgets(state, 'right'), x: x0 + cw + 24, w: cw, top: host.t, bottom: H - host.b },
      ] };
    }
    return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  }
  if (key === 'result') return { cols: [{ widgets: resultWidgets(state, L), x, w, top: Math.max(host.t, L ? 0 : oyOf()), bottom: H - host.b, center: L }], oy: L ? 0 : oyOf() };
  if (key === 'demolimit') return { cols: [{ widgets: demoLimitWidgets(state, L), x, w, top: Math.max(host.t, L ? 0 : oyOf()), bottom: H - host.b, center: L }], oy: L ? 0 : oyOf() };
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
  LAID = { key, sig: sigOf(state), lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, h: Math.max(0, cols[0].lay.contentH - (cols[0].bottom - cols[0].top)), cols, pins: fr.pins ?? null };
  if (key === 'title') {
    const c = cols[cols.length - 1], ls = lockSize(c.w), used = c.top + c.lay.contentH, cx = c.x + c.w / 2;
    const pinned = H - host.b - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    LAID.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return cols;
}
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
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
export const setupPinRects = (state) => (LAID.key === 'setup' && LAID.pins) || frameFor(state, 'setup').pins;

const heroArt = (hs = 1) => ({
  t: 'art', h: 330 * hs,
  draw(ctx, w) {
    ctx.save(); ctx.scale(hs, hs); w /= hs; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    drawDisc(ctx, cx - 288, 84, 10, 0, { r: 36, spin: -0.4, noPips: true });
    drawDisc(ctx, cx + 288, 84, 12, 1, { r: 36, spin: 0.5, noPips: true });
    ctx.font = `italic 900 132px ${FONT}`; textShadow(ctx, 'MENKO', cx, 150, '#fff8e6', 18);
    ctx.font = `700 34px ${FONT}`; textShadow(ctx, 'SLAM  ·  FLIP  ·  WIN', cx, 206, '#ffcf6a', 8);
    ctx.font = `400 26px ${FONT}`; textShadow(ctx, 'A children\'s floor game from Japan', cx, 252, '#e8ecff', 6);
    ctx.strokeStyle = 'rgba(255,233,191,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 190, 282); ctx.lineTo(cx - 20, 282); ctx.moveTo(cx + 20, 282); ctx.lineTo(cx + 190, 282); ctx.stroke();
    ctx.restore();
  },
});
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function heroScaleFor(state) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const btnH = flowLayout(estCtx, titleWidgets(state, true), sc, { x: 40, w: 640 }).contentH;
  const top = Math.max(host.t, oyOf()), avail = H - host.b - top - lockSize(600).strip - btnH - 30;
  return Math.max(0.5, Math.min(1, avail / (330 + 40)));
}
export function titleWidgets(state, wide = false, hs = 1) {
  const sound = state.settings.sound;
  const wd = wide ? [] : [heroArt(hs), { t: 'gap', h: 40 * hs }];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'collection', label: 'Collection', sub: `${(state.record.seen || []).filter(Boolean).length} of 24 discs`, h: 84 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 });
  return wd;
}

export function setupWidgets(state, part = 'all') {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [];
  if (part !== 'right') wd.push({ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 });
  else wd.push({ t: 'gap', h: 18 });
  if (s.mode !== 'two' && part !== 'right') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: GOLD, size: 26 });
    PROFILES.slice(0, 4).forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: part === 'left' ? 80 : 92 });
    });
  }
  if (part !== 'left') {
    wd.push({ t: 'p', label: 'Hand size', bold: true, color: GOLD, size: 26 });
    if (part === 'right') {
      wd.push({ t: 'btn', id: 'len5', label: 'Quick: 5 discs each', active: s.hand === 5, h: 80 });
      wd.push({ t: 'btn', id: 'len8', label: 'Full: 8 discs each', active: s.hand === 8, h: 80 });
    } else {
      wd.push({ t: 'btn', id: 'len5', label: 'Quick: 5 discs', row: 9, active: s.hand === 5 });
      wd.push({ t: 'btn', id: 'len8', label: 'Full: 8 discs', row: 9, active: s.hand === 8 });
    }
    wd.push({ t: 'gap', h: part === 'right' ? 8 : 24 });
  }
  return wd;
}

export function settingsWidgets(state, part = 'all') {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const left = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
  ];
  const right = [
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: GOLD, size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: GOLD, size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', bold: true, color: GOLD, size: 26 }] : [{ t: 'btn', id: 'restore', label: state.restoreBusy ? 'Checking…' : 'Restore purchase', dark: true, disabled: !!state.restoreBusy }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: GOLD }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return part === 'left' ? left : part === 'right' ? [{ t: 'gap', h: 70 }, ...right] : [...left, ...right];
}

export function resultWidgets(state, wide = false) {
  const m = state.m, o = m.over ?? { win: -1 }, mode = m.cfg.mode;
  const winner = o.win;
  const nm = (s) => (mode === 'two' ? `Player ${s + 1}` : mode === 'watch' ? PROFILES[s === 0 ? m.cfg.watchA : m.cfg.opp].name : s === 0 ? 'You' : PROFILES[m.cfg.opp].name);
  const title = winner < 0 ? 'A draw' : mode === 'ai' ? (winner === 0 ? 'You win!' : 'You lose') : `${nm(winner)} wins`;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 120 }, { t: 'h', label: title, size: wide ? 56 : 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.score[0]} – ${m.score[1]}`, size: wide ? 72 : 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  wd.push({ t: 'p', label: `Stars won: ${nm(0)} ${m.score[0]}, ${nm(1)} ${m.score[1]}`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'p', label: `${m.piles[0].length} disc${m.piles[0].length === 1 ? '' : 's'} flipped by ${nm(0)}, ${m.piles[1].length} by ${nm(1)}`, size: 26, cap: big ? 2 : 3 });
  if (m.covers[0] + m.covers[1] > 0) wd.push({ t: 'p', label: `Covered slams: ${m.covers[0]} and ${m.covers[1]}`, size: 24, cap: big ? 2 : 3 });
  if (mode === 'ai') wd.push({ t: 'p', label: `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: wide ? 8 : 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
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
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 160 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, both match lengths and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  if (v3.on) { v3.scrim = Math.min(0.88, a * 0.9); return; }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(8,10,30,${a * 0.7})`); g.addColorStop(0.5, `rgba(8,10,30,${a})`); g.addColorStop(1, `rgba(8,10,30,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(1, 'rgba(8,10,30,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,200,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,200,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// the floor behind the menus: `size` units across, centred on cx / cy (default the screen middle)
const attract = (ctx, state, size, cy, cx) => {
  if (v3.on) return;
  drawBackdrop(ctx);
  drawTable(ctx, state, state.att.floor, state.att.parts, { size, x: (cx ?? W / 2) - size / 2, y: (cy ?? H / 2) - size / 2 });
};
// full-bleed: the floor fills the screen (covering it), used behind every menu
const bleed = (ctx, state) => {
  if (v3.on) { ctx.clearRect(0, 0, W, H); return; }
  const size = Math.max(W, H) * 1.02;
  drawTable(ctx, state, state.att.floor, state.att.parts, { size, x: (W - size) / 2, y: (H - size) / 2, frame: false });
};

function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(12,14,40,0.66)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const oy = fr.oy, hs = heroScaleFor(state);
    bleed(ctx, state);
    scrim(ctx, 0.5);
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.6)';
    if (state.demo) ctx.fillText('Web demo', W / 2, H - 4 - host.b);
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0, k = Math.min(1, hw / 640);
  bleed(ctx, state);
  scrim(ctx, 0.45);
  ctx.save(); ctx.translate(hx, Math.max(host.t, 0) + 6); ctx.scale(k, k);
  heroArt().draw(ctx, 0); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.6)';
  if (state.demo) ctx.fillText('Web demo', hx, H - 8 - host.b);
}

export function renderSetup(ctx, state) {
  bleed(ctx, state);
  scrim(ctx, 0.7);
  const fr = drawFlowScreen(ctx, state, 'setup');
  const pins = fr.pins;
  if (!land()) {
    if (!v3.on) {
      const g = ctx.createLinearGradient(0, H - 180, 0, H);
      g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(0.2, 'rgba(8,10,30,0.85)'); g.addColorStop(1, 'rgba(8,10,30,0.95)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 180, W, 180);
    }
    drawButton(ctx, pins.start, 'Start the match', { primary: true, size: 32 });
    drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
    if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pins.start.y - 16); }
    return;
  }
  drawButton(ctx, pins.start, 'Start the match', { primary: true, size: 30 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, pins.start.x + pins.start.w / 2, pins.start.y - 10); }
}
export function renderSettings(ctx, state) {
  bleed(ctx, state);
  scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'settings');
}
export function renderResult(ctx, state) {
  if (v3.on) ctx.clearRect(0, 0, W, H);
  else {
    drawBackdrop(ctx);
    const size = Math.min(W, H) * 0.86;
    drawTable(ctx, state, state.m.floor, [], { size, x: (W - size) / 2, y: land() ? (H - size) / 2 : H * 0.62 - size / 2 });
  }
  scrim(ctx, land() ? 0.66 : 0.58);
  drawFlowScreen(ctx, state, 'result');
}
export function renderDemoLimit(ctx, state) {
  bleed(ctx, state);
  scrim(ctx, 0.76);
  drawFlowScreen(ctx, state, 'demolimit');
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.6);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(24,30,66,0.95)', stroke: 'rgba(255,214,140,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: Math.max(0, lay.contentH - ch), cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }], pins: null };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  const sc0 = state.ui.scroll;
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px, pw);
}

// ---- collection -------------------------------------------------------------------------------
const COL = { max: 0 };
export const collectionMeta = () => COL;
export function renderCollection(ctx, state) {
  bleed(ctx, state);
  scrim(ctx, 0.74);
  const RL = refLayout(), P = RL.panel;
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(248,242,226,0.97)', stroke: 'rgba(60,56,90,0.7)' });
  const seen = state.record.seen || [], n = seen.filter(Boolean).length;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.terraDark; ctx.font = `700 40px ${FONT}`;
  ctx.fillText('Collection', P.x + P.w / 2, P.y + 56);
  ctx.font = `400 24px ${FONT}`; ctx.fillStyle = C.ink; ctx.fillText(`${n} of 24 discs found: hold them in a hand or flip them`, P.x + P.w / 2, P.y + 90);
  const top = P.y + 108, viewH = P.h - 108 - 14;
  const cols = Math.max(2, Math.floor((P.w - 40) / 150)), cw = (P.w - 40) / cols, ch = 190;
  const rows = Math.ceil(24 / cols), total = rows * ch + 10;
  COL.max = Math.max(0, Math.ceil(total - viewH));
  state.colScroll = clamp(state.colScroll, 0, COL.max);
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 6, top, P.w - 12, viewH); ctx.clip();
  for (let i = 0; i < 24; i++) {
    const col = i % cols, row = Math.floor(i / cols), x = P.x + 20 + col * cw + cw / 2, y = top + row * ch + 62 - state.colScroll;
    if (y < top - 100 || y > top + viewH + 100) continue;
    const d = DESIGNS[i], has = !!seen[i];
    if (has) drawDisc(ctx, x, y, i, 0, { r: 46 });
    else {
      ctx.fillStyle = 'rgba(31,37,64,0.2)'; ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(31,37,64,0.5)'; ctx.font = `700 40px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText('?', x, y + 2); ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = C.ink; ctx.font = `700 ${has ? 20 : 18}px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(has ? d.name : 'Not found yet', x, y + 82);
    if (has) { ctx.fillStyle = '#c28a10'; ctx.font = `700 20px ${FONT}`; ctx.fillText('★'.repeat(d.stars), x, y + 106); drawDots(ctx, x, y + 124, d.w, 4, '#1f2540'); }
  }
  ctx.restore();
  if (COL.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + COL.max)), ty = top + (viewH - th) * (state.colScroll / COL.max);
    ctx.fillStyle = 'rgba(60,56,90,0.55)'; ctx.beginPath(); ctx.roundRect(P.x + P.w - 18, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- reference pages --------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => 1;

function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ t: 'rule', y }); y += 20; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ t: 'title', tl, y });
    y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 250; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ t: 'line', text: l, y }); y += lh; });
    });
    y += 26;
  });
  return { items, fs, lh, secFs, total: y + 10 };
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  bleed(ctx, state);
  scrim(ctx, 0.74);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,242,226,0.97)', stroke: 'rgba(60,56,90,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,56,90,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 300 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(60,56,90,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 242); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 238, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(60,56,90,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(60,56,90,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff8e6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y);
  ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(12,14,40,0.82)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// A window onto the floor: world point (cx, cy) in the middle of a w x h frame, `span` world units across its height.
function windowOn(ctx, w, h, cx, cy, span, body) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const k = h / span;
  ctx.translate(w / 2 - cx * k, h / 2 - cy * k); ctx.scale(k, k);
  drawFloor(ctx, 0, 0, FLOOR);
  const X = (x) => w / 2 + (x - cx) * k, Y = (y) => h / 2 + (y - cy) * k;
  body(ctx, k);
  ctx.restore();
  roundPath(ctx, 0, 0, w, h, 16); ctx.strokeStyle = 'rgba(60,56,90,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  return { k, X, Y };
}
function ring(ctx, x, y, r, col, dash = [10, 8], lw = 3) {
  ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    floor() {
      const m = windowOn(ctx, w, h, 320, 320, 640, (c) => {
        drawDisc(c, 150, 180, 0, 0, {}); drawDisc(c, 450, 150, 3, 1, {}); drawDisc(c, 300, 330, 10, 0, {}); drawDisc(c, 380, 470, 7, 1, {});
      });
      tag(ctx, 'the rug: harder to flip', m.X(320), m.Y(330) + 62, '#ffe08a', 17);
      tag(ctx, 'your discs: solid rim', m.X(150), m.Y(100), '#ffb7a8', 16);
      tag(ctx, 'rival discs: dotted rim', m.X(450), m.Y(215), '#a8c8ff', 16);
    },
    discs() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e8dcb8'; ctx.fill(); ctx.strokeStyle = 'rgba(60,56,90,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      const set = [[2, 4], [3, 10], [4, 1]];
      set.forEach(([wt, d], i) => {
        const cx = w * (0.2 + i * 0.3);
        drawDisc(ctx, cx, h * 0.34, d, 0, { r: 48 });
        drawDots(ctx, cx, h * 0.34 + 68, wt, 5.5, C.ink);
        ctx.fillStyle = C.ink; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`${wt} dots: ${['light', 'medium', 'heavy'][wt - 2]}`, cx, h * 0.34 + 100);
      });
      ctx.fillStyle = C.ink; ctx.font = `400 20px ${FONT}`; ctx.fillText('Gold pips on the rim: 1 to 3 stars', w / 2, h - 14);
    },
    slam() {
      const m = windowOn(ctx, w, h, 300, 310, 330, (c) => {
        drawDisc(c, 320, 320, 10, 1, {});
        ring(c, 200, 290, scatterRadius(0.6, 3), 'rgba(255,255,255,0.9)');
        drawDisc(c, 200, 290, 3, 0, { ghost: true, noPips: true });
      });
      tag(ctx, 'dashed circle: where it may land', m.X(200), m.Y(290) + 70, '#fff', 16);
      tag(ctx, 'rival disc', m.X(330), m.Y(320) - 62, '#a8c8ff', 16);
    },
    gust() {
      const m = windowOn(ctx, w, h, 300, 320, 330, (c) => {
        drawDisc(c, 320, 320, 10, 1, {});
        drawDisc(c, 205, 320, 3, 0, {});
        c.save(); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 5; c.setLineDash([5, 8]);
        for (const r of [60, 95]) { c.beginPath(); c.arc(205, 320, r, -0.9, 0.9); c.stroke(); }
        c.restore();
      });
      tag(ctx, 'closer lands, stronger gust', m.X(260), m.Y(320) + 92, '#ffd35a', 16);
      tag(ctx, '72% flip', m.X(320), m.Y(320) - 62, '#58d68d', 18);
    },
    cover() {
      const m = windowOn(ctx, w, h, 320, 320, 300, (c) => {
        drawDisc(c, 320, 320, 10, 1, {});
        ring(c, 320, 320, COVER * R, 'rgba(255,100,80,0.95)', [7, 7], 3);
        drawDisc(c, 345, 305, 3, 0, { ghost: true, noPips: true });
      });
      tag(ctx, 'inside the red circle: cover, disc lost', m.X(320), m.Y(320) + 82, '#ff8a6a', 16);
    },
    score() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e8dcb8'; ctx.fill(); ctx.strokeStyle = 'rgba(60,56,90,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      const rows = [['Flipped Folding Fan', 1], ['Flipped Gold Carp', 1], ['Flipped White Crane', 3]];
      rows.forEach(([t, s], i) => {
        const yy = 52 + i * 58;
        ctx.fillStyle = C.ink; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(t, 40, yy);
        ctx.fillStyle = '#c28a10'; ctx.textAlign = 'right'; ctx.fillText('★'.repeat(s), w - 40, yy);
      });
      ctx.strokeStyle = 'rgba(60,56,90,0.4)'; ctx.beginPath(); ctx.moveTo(30, 190); ctx.lineTo(w - 30, 190); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.font = `700 28px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('Total', 40, 224); ctx.textAlign = 'right'; ctx.fillStyle = '#c93a2c'; ctx.fillText('5 stars', w - 40, 224);
    },
    strength() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e8dcb8'; ctx.fill(); ctx.strokeStyle = 'rgba(60,56,90,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      const rows = [[0.3, 'Gentle: small circle, weak gust'], [0.6, 'Good: the usual choice'], [1, 'Full: strong gust, wide circle']];
      rows.forEach(([p, t], i) => {
        const cy = 50 + i * 64, r = scatterRadius(p, 3) * 0.48;
        ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#c93a2c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(70, cy, r, 0, TAU); ctx.stroke(); ctx.restore();
        ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(t, 150, cy + 7);
      });
    },
  };
  (A[key] ?? A.floor)();
  ctx.restore();
}
void TEAM; void RUG;
