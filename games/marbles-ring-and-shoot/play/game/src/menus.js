// Every screen that is not the play screen: title, setup, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own marble and arena art).
// Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, setupPins } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { RR, RA, RT, R_T, R_S, createWorld } from './sim.js';
import { drawMarble, drawArena, drawBackdrop, SIDE } from './art.js';
import { drawTable } from './view.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------
// Every menu screen is a list of widgets laid out by flowLayout in one or two columns. Portrait: one column, 640 wide.
// Landscape: the title puts the artwork on the left and the buttons on the right; setup splits rivals / match length;
// everything else is one centred column. A column that does not fit scrolls (text size up to 300%).
let PAGE_COUNT = 1;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
// A new game starts with no layout left over from a previous one.
export function resetMenus() { LAID = blankLaid(); PAGE_COUNT = 1; }
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.setup.mode}`;
const land = () => W > H;
const oyOf = () => Math.max(0, (H - 1280) / 2);     // tall portrait screens: centre the phone-shaped title / result block

// The columns of a screen: [{ widgets, x, w, top, bottom, center? }], plus the artwork / pins that go with them.
export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx], bb = Math.max(0, host.b - 10);
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Lay out the columns of a frame (text measured with `ctx`) and remember them for hit-testing.
function layColumns(ctx, state, key, fr) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cols = fr.cols.map((c) => {
    const lay = flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w });
    const avail = c.bottom - c.top;
    const top = c.center && lay.contentH < avail ? c.top + (avail - lay.contentH) / 2 : c.top;
    return { lay, top, bottom: c.bottom, x: c.x, w: c.w };
  });
  LAID = { key, sig: sigOf(state), lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, h: cols[0].lay.contentH, cols, pins: fr.pins ?? null };
  if (key === 'title') {      // the lockup: right under the last button row, pinned at the bottom when the menu scrolls
    const c = cols[cols.length - 1], ls = lockSize(c.w), used = c.top + c.lay.contentH, cx = c.x + c.w / 2;
    const pinned = H - host.b - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    LAID.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return cols;
}
// A layout for the scene being updated right now, before anything has been drawn (first frame after a
// scene change, headless runs, or a resize): same widgets, text widths estimated instead of measured.
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
// The current Start / Back pins of the setup screen (their rectangles depend on the screen shape).
export const setupPinRects = (state) => (LAID.key === 'setup' && LAID.pins) || frameFor(state, 'setup').pins;

const heroArt = (hs = 1) => ({
  t: 'art', h: 470 * hs,
  draw(ctx, w) {
    ctx.save(); ctx.scale(hs, hs); w /= hs; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    drawMarble(ctx, cx - 170, 70, 26, { kind: 'glass', variant: 0, side: 0 }, { rot: 0.6, ra: 0.3 });
    drawMarble(ctx, cx + 170, 70, 26, { kind: 'glass', variant: 3, side: 0 }, { rot: 1.4, ra: 0.9 });
    drawMarble(ctx, cx, 54, 32, { kind: 'king', variant: 0, side: 0 }, { rot: 0.9, ra: 0.5 });
    ctx.font = `800 128px ${FONT}`; textShadow(ctx, 'Marbles', cx, 196, '#fff8e0', 16);
    ctx.font = `italic 800 60px ${FONT}`; textShadow(ctx, 'Ring and Shoot', cx, 262, '#ffd978', 12);
    ctx.font = `600 27px ${FONT}`; textShadow(ctx, 'The playground game, kancha to kelereng', cx, 312, '#ffeec8', 6);
    ctx.strokeStyle = 'rgba(255,236,190,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 200, 342); ctx.lineTo(cx - 40, 342); ctx.moveTo(cx + 40, 342); ctx.lineTo(cx + 200, 342); ctx.stroke();
    drawMarble(ctx, cx - 15, 342, 11, { kind: 'shooter', variant: 0, side: 0 }, { rot: 0.5 }); drawMarble(ctx, cx + 15, 342, 11, { kind: 'shooter', variant: 0, side: 1 }, { rot: 1.2 });
    ctx.restore();
  },
});
// The Arcforge lockup under the title menu: >= ~125 css px wide (aspect 1200:327); `strip` is the room kept for it under the buttons.
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

// Portrait: on screens too short for hero + table + buttons (4:3 and tablet portrait) the hero block shrinks instead of the menu scrolling.
export function heroScaleFor(state) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const btnH = flowLayout(estCtx, titleWidgets(state, true), sc, { x: 40, w: 640 }).contentH;
  const top = Math.max(host.t, oyOf()), avail = H - host.b - top - lockSize(600).strip - btnH - 30;
  return Math.max(0.5, Math.min(1, avail / (470 + 250)));
}
export function titleWidgets(state, wide = false, hs = 1) {
  const sound = state.settings.sound;
  const wd = wide ? [] : [heroArt(hs), { t: 'gap', h: 250 * hs }];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
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
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: part === 'left' ? 80 : 92 });
    });
  }
  if (part !== 'left') {
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
    if (part === 'right') {
      wd.push({ t: 'btn', id: 'len1', label: 'Quick: 1 round', active: s.rounds === 1, h: 80 });
      wd.push({ t: 'btn', id: 'len3', label: 'Full: 3 rounds', active: s.rounds === 3, h: 80 });
    } else {
      wd.push({ t: 'btn', id: 'len1', label: 'Quick: 1 round', row: 9, active: s.rounds === 1 });
      wd.push({ t: 'btn', id: 'len3', label: 'Full: 3 rounds', row: 9, active: s.rounds === 3 });
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
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'Shows the whole predicted path, bounces and all', active: st.calm },
  ];
  const right = [
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return part === 'left' ? left : part === 'right' ? [{ t: 'gap', h: 70 }, ...right] : [...left, ...right];
}

export function resultWidgets(state, wide = false) {
  const m = state.m, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${PROFILES[winner === 0 ? m.cfg.watchA : m.cfg.opp].name} wins` : winner === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 120 }, { t: 'h', label: title, size: wide ? 56 : 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: wide ? 72 : 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  const per = m.roundLog.map((r) => `${r.pts[0]}–${r.pts[1]}`).join('   ');
  wd.push({ t: 'p', label: `${m.roundLog.length} round${m.roundLog.length === 1 ? '' : 's'}: ${per}`, size: 26, cap: big ? 2 : 3 });
  if (o.extra) wd.push({ t: 'p', label: 'Settled in an extra round.', bold: true, color: '#ffe9bf', size: 26, cap: big ? 2 : 3 });
  const rec = mode === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  if (rec) wd.push({ t: 'p', label: rec, size: 26, cap: big ? 2 : 3 });
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
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-calm', label: st.calm ? 'Calm: On' : 'Calm: Off', row: 8, active: st.calm },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 160 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free rounds of the web demo. The full game on iPhone and Android has every rival, full matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,22,16,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,22,16,${a})`); g.addColorStop(1, `rgba(6,22,16,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,22,16,0)'); g.addColorStop(1, 'rgba(6,22,16,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,244,214,0.92)'; ctx.fill();
    ctx.fillStyle = '#1f2b2a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,244,214,0.92)'; ctx.fill();
    ctx.fillStyle = '#1f2b2a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

const attractTable = (ctx, state, scale = 0.95, cy, cx) => drawTable(ctx, state, state.att.w, state.att.parts, { scale, cy, cx });

function drawTitleLockup(ctx, state) {      // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(8,30,22,0.66)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const oy = fr.oy;
    const hs = heroScaleFor(state);
    attractTable(ctx, state, 0.62 * hs, 560 * hs + oy);
    scrim(ctx, 0.2);
    const g = ctx.createRadialGradient(W / 2, 220 + oy, 40, W / 2, 220 + oy, 400);
    g.addColorStop(0, 'rgba(6,22,16,0.55)'); g.addColorStop(1, 'rgba(6,22,16,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700 + oy);
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,205,0.6)';
    if (state.demo) ctx.fillText('Web demo', W / 2, H - 4 - host.b);
    return;
  }
  // landscape: the title and the attract table on the left, the buttons on the right
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0, k = Math.min(1, hw / 640);
  const bs = Math.max(0.3, Math.min(0.5, (H - 360 - host.b) / 700)), top0 = Math.max(host.t, 0);
  attractTable(ctx, state, bs, H - host.b - 16 - 350 * bs, hx);
  scrim(ctx, 0.2);
  const g = ctx.createRadialGradient(hx, 200, 40, hx, 200, 360);
  g.addColorStop(0, 'rgba(6,22,16,0.55)'); g.addColorStop(1, 'rgba(6,22,16,0)');
  ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 600);
  ctx.save(); ctx.translate(hx, top0 - 20 * k); ctx.scale(k, k);
  heroArt().draw(ctx, 0); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,205,0.6)';
  if (state.demo) ctx.fillText('Web demo', hx, H - 8 - host.b);
}

export function renderSetup(ctx, state) {
  attractTable(ctx, state, 0.9, undefined);
  scrim(ctx, 0.66);
  const fr = drawFlowScreen(ctx, state, 'setup');
  const pins = fr.pins;
  if (!land()) {
    const g = ctx.createLinearGradient(0, H - 180, 0, H);
    g.addColorStop(0, 'rgba(6,22,16,0)'); g.addColorStop(0.2, 'rgba(6,22,16,0.85)'); g.addColorStop(1, 'rgba(6,22,16,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, H - 180, W, 180);
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
  attractTable(ctx, state, 0.9);
  scrim(ctx, 0.68);
  drawFlowScreen(ctx, state, 'settings');
}
export function renderResult(ctx, state) {
  const fr = frameFor(state, 'result');
  drawTable(ctx, state, state.w, [], { scale: 0.8, cy: land() ? undefined : TEXT_SCALES[state.settings.textIdx] > 1.5 ? undefined : 930 + (fr.oy ?? 0) });
  scrim(ctx, land() ? 0.62 : 0.5);
  drawFlowScreen(ctx, state, 'result');
}
export function renderDemoLimit(ctx, state) {
  const fr = frameFor(state, 'demolimit');
  attractTable(ctx, state, 0.8, land() ? undefined : TEXT_SCALES[state.settings.textIdx] > 1.5 ? undefined : 930 + (fr.oy ?? 0));
  scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'demolimit');
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(12,38,30,0.94)', stroke: 'rgba(255,224,150,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }], pins: null };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  const sc0 = state.ui.scroll;
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px, pw);
}

// ---- reference pages --------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };   // published each frame: how far the reader body can scroll, and its height
export const pageCount = () => 1;

// Flows every section (title, optional illustration, paragraphs) into one tall column; y offsets are relative to the body top.
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
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 210; }
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
  attractTable(ctx, state, 0.9);
  scrim(ctx, 0.7);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,245,226,0.97)', stroke: 'rgba(60,90,60,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,90,60,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(60,90,60,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(60,90,60,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(60,90,60,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff8e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y);
  ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(10,34,26,0.82)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd35a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

// A little patch of the arena in a frame; returns helpers to draw in arena coordinates.
function mini(ctx, w, h, o = {}) {
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  const s = (h - 6) / (2 * (RT + 30)) * (o.zoom ?? 1), cx = w * (o.fx ?? 0.5) + (o.dx ?? 0) * s, cy = h / 2 + (o.dy ?? 0) * s;
  ctx.fillStyle = '#2c4e2e'; ctx.fillRect(0, 0, w, h);
  ctx.translate(cx, cy); ctx.scale(s, s); drawArena(ctx); ctx.restore();
  roundPath(ctx, 0, 0, w, h, 16); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,90,60,0.6)'; ctx.stroke();
  return { s, cx, cy, X: (x) => cx + x * s, Y: (y) => cy + y * s };
}
const W0 = createWorld();
const mb = (ctx, m, x, y, spec, mult = 1, o = {}) => drawMarble(ctx, m.X(x), m.Y(y), (spec.kind === 'shooter' ? R_S : R_T) * m.s * mult, spec, { rot: 0.7 + x * 0.03, ra: 0.4, ...o });

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const cluster = (m, mult = 1) => { for (const b of W0.balls) if (b.kind !== 'shooter') mb(ctx, m, b.x, b.y, { kind: b.kind, variant: b.variant, side: 0 }, mult); };
  const A = {
    ring() {
      const m = mini(ctx, w, h, { zoom: 1.5, fx: 0.32 });
      cluster(m, 1.6);
      const L = (t, wx, wy, ty) => { const px = m.X(wx), py = m.Y(wy), lx = w * 0.62; ctx.strokeStyle = '#fff6e2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx - 8, ty); ctx.lineTo(px, py); ctx.stroke(); ctx.fillStyle = '#fff6e2'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill(); label(ctx, t, lx, ty + 6, 20, '#ffe9bf', 'left'); };
      ctx.save(); ctx.fillStyle = 'rgba(10,34,26,0.55)'; ctx.fillRect(w * 0.6 - 6, 0, w * 0.4, h); ctx.restore();
      L('the king', 0, 0, 30); L('glass marble', W0.balls[2].x, W0.balls[2].y, 70); L('clay marble', W0.balls[1].x, W0.balls[1].y, 110); L('the ring', 0, -RR, 150);
    },
    shot() {
      const m = mini(ctx, w, h, { zoom: 1.0, fx: 0.5 });
      cluster(m, 1.2);
      const sx = -RT + 30, sy = 0;
      mb(ctx, m, sx, sy, { kind: 'shooter', side: 0, variant: 0 }, 1.2);
      arrow(ctx, m.X(sx) - 12, m.Y(sy), m.X(sx) - 64, m.Y(sy) + 4, '#ffd35a', 5); tag(ctx, 'pull back', m.X(sx) - 30, m.Y(sy) - 34, '#ffd35a', 16);
      ctx.save(); ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.X(sx) + 20, m.Y(sy)); ctx.lineTo(m.X(-48), m.Y(0)); ctx.stroke(); ctx.restore();
      tag(ctx, 'the shooter goes this way', w * 0.5, h - 18, '#fffbe8', 16);
    },
    place() {
      const m = mini(ctx, w, h, { zoom: 1 });
      ctx.save(); ctx.setLineDash([2, 12]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(m.cx, m.cy, RT * m.s, 0, TAU); ctx.stroke(); ctx.restore();
      cluster(m, 1.1);
      [[0, 1], [-1, 0.3], [0.6, -0.8]].forEach(([c, s2], i) => { const a = Math.atan2(s2, c) + (i === 0 ? 0 : 0); mb(ctx, m, Math.cos(a) * RT, Math.sin(a) * RT, { kind: 'shooter', side: 0, variant: 0 }, 1.25, { a: i === 0 ? 1 : 0.5, ghost: i !== 0 }); });
      tag(ctx, 'tap the line to place it', w * 0.5, 22, '#ffe9bf', 17);
    },
    values() {
      ctx.fillStyle = '#0f3a2e'; roundPath(ctx, 0, 0, w, h, 16); ctx.fill();
      const items = [['clay', 'Clay', '1'], ['glass', 'Glass', '2'], ['king', 'King', '3']];
      items.forEach(([kind, nm, v], i) => { const cx = w * (0.2 + i * 0.3); drawMarble(ctx, cx, h * 0.4, 30, { kind, variant: i, side: 0 }, { rot: 0.8, ra: 0.5 }); label(ctx, nm, cx, h - 50, 22, '#fff8e0'); label(ctx, `${v} point${v === '1' ? '' : 's'}`, cx, h - 22, 20, '#ffd978'); });
    },
    capture() {
      const m = mini(ctx, w, h, { zoom: 1.25, dy: 10 });
      mb(ctx, m, -20, 40, { kind: 'shooter', side: 1, variant: 0 }, 1.3);
      mb(ctx, m, 40, 175, { kind: 'shooter', side: 0, variant: 0 }, 1.3);
      arrow(ctx, m.X(36), m.Y(150), m.X(-12), m.Y(66), '#ffd35a', 5);
      arrow(ctx, m.X(-30), m.Y(14), m.X(-80), m.Y(-196), '#ffffff', 4);
      tag(ctx, 'rival shooter in the ring', w * 0.76, 24, '#ffb48a', 16); tag(ctx, 'knocked out: +2', w * 0.76, h - 20, '#7ee8a8', 17);
    },
    out() {
      const m = mini(ctx, w, h, { zoom: 2.0, dy: 150 });
      mb(ctx, m, 70, -RR - 50, { kind: 'clay', variant: 0, side: 0 }, 1.0);
      mb(ctx, m, -90, -RR + 40, { kind: 'clay', variant: 2, side: 0 }, 1.0);
      tag(ctx, 'centre beyond the line: out', w * 0.62, 24, '#7ee8a8', 16); tag(ctx, 'still inside: stays in', w * 0.3, h - 20, '#ffb48a', 16);
    },
    rounds() {
      ctx.fillStyle = '#0f3a2e'; roundPath(ctx, 0, 0, w, h, 16); ctx.fill();
      [['Round 1', 11, 8], ['Round 2', 6, 13], ['Total', 17, 21]].forEach(([t, a, b], i) => { const yy = 48 + i * 56; label(ctx, t, 40, yy, 24, '#fff8e0', 'left'); label(ctx, String(a), w * 0.62, yy, 28, SIDE[0].hud); label(ctx, String(b), w * 0.82, yy, 28, SIDE[1].hud); });
      ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.beginPath(); ctx.moveTo(30, 134); ctx.lineTo(w - 30, 134); ctx.stroke();
    },
  };
  (A[key] ?? A.ring)();
  ctx.restore();
}
