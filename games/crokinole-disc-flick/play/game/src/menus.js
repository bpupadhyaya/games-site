// Every screen that is not the play screen: title, setup, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own disc, peg and board art).
// Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, setupPins } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { R_BOARD, R_BASE, R_DISC, RINGS, R_POCKET, PEGS, R_PEG_RING, startPoint, MAX_U, U_ANGLE } from './sim.js';
import { drawDisc, leafPath, drawPeg } from './art.js';
import { drawTable, drawBoardMini } from './view.js';
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
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.saved ? 1 : 0}|${state.setup.mode}`;
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
    ctx.fillStyle = 'rgba(255,205,150,0.9)'; ctx.font = `400 26px ${FONT}`;
    ctx.fillStyle = '#e4504a'; leafPath(ctx, cx - 188, 88, 20, 0); ctx.fill();
    leafPath(ctx, cx + 188, 88, 20, 0); ctx.fill();
    ctx.font = `700 112px ${FONT}`; textShadow(ctx, 'Disc Flick', cx, 160, '#fff3d6', 16);
    ctx.font = `italic 700 74px ${FONT}`; textShadow(ctx, 'Table', cx, 238, '#ffcf7a', 12);
    ctx.font = `400 28px ${FONT}`; textShadow(ctx, 'A Canadian tabletop classic', cx, 292, '#ffe9bf', 6);
    ctx.strokeStyle = 'rgba(255,233,191,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 190, 318); ctx.lineTo(cx - 30, 318); ctx.moveTo(cx + 30, 318); ctx.lineTo(cx + 190, 318); ctx.stroke();
    drawDisc(ctx, cx - 14, 318, 0, 0.4, { scale: 0.55 }); drawDisc(ctx, cx + 14, 318, 1, 0.4, { scale: 0.55 });
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
  return Math.max(0.5, Math.min(1, avail / (470 + (state.saved ? 144 : 250))));
}
export function titleWidgets(state, wide = false, hs = 1) {
  const sound = state.settings.sound;
  const wd = wide ? [] : [heroArt(hs), { t: 'gap', h: (state.saved ? 144 : 250) * hs }];
  if (state.saved) {
    const sn = state.saved, who = sn.cfg.mode === 'two' ? 'Two players' : `vs ${PROFILES[sn.cfg.opp].name}`;
    wd.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: `${who} · round ${sn.round} · ${sn.scores[0]}–${sn.scores[1]}`, primary: true, h: 92 });
  }
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: !state.saved, h: 92 });
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
      wd.push({ t: 'btn', id: 'len2', label: 'Quick: 2 rounds', active: s.rounds === 2, h: 80 });
      wd.push({ t: 'btn', id: 'len4', label: 'Full: 4 rounds', active: s.rounds === 4, h: 80 });
    } else {
      wd.push({ t: 'btn', id: 'len2', label: 'Quick: 2 rounds', row: 9, active: s.rounds === 2 });
      wd.push({ t: 'btn', id: 'len4', label: 'Full: 4 rounds', row: 9, active: s.rounds === 4 });
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
    { t: 'btn', id: 'set-rotate', label: st.rotate ? 'Rotate board to face the shooter: On' : 'Rotate board to face the shooter: Off', sub: 'Two players only. For players sitting opposite each other', active: st.rotate },
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
    { t: 'p', label: 'You have played the free rounds of the web demo. The full game on iPhone and Android has every rival, the full matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(20,8,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,8,6,${a})`); g.addColorStop(1, `rgba(20,8,6,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,8,6,0)'); g.addColorStop(1, 'rgba(20,8,6,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

const attractTable = (ctx, state, scale = 0.95, cy, cx) => drawTable(ctx, state, state.att.w, state.att.parts, { rot: 0, scale, cy, cx });

function drawTitleLockup(ctx, state) {      // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(30,8,6,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
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
    g.addColorStop(0, 'rgba(20,8,6,0.55)'); g.addColorStop(1, 'rgba(20,8,6,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700 + oy);
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)';
    if (state.demo) ctx.fillText('Web demo', W / 2, H - 4 - host.b);
    return;
  }
  // landscape: the title and the attract table on the left, the buttons on the right
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0, k = Math.min(1, hw / 640);
  const bs = Math.min(0.5, (H - 360 - host.b) / 700 * 1.0 + 0.0), top0 = Math.max(host.t, 0);
  attractTable(ctx, state, Math.max(0.3, bs), H - host.b - 16 - 350 * Math.max(0.3, bs), hx);
  scrim(ctx, 0.2);
  const g = ctx.createRadialGradient(hx, 200, 40, hx, 200, 360);
  g.addColorStop(0, 'rgba(20,8,6,0.55)'); g.addColorStop(1, 'rgba(20,8,6,0)');
  ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 600);
  ctx.save(); ctx.translate(hx, top0 - 20 * k); ctx.scale(k, k);
  heroArt().draw(ctx, 0); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)';
  if (state.demo) ctx.fillText('Web demo', hx, H - 8 - host.b);
}

export function renderSetup(ctx, state) {
  attractTable(ctx, state, 0.9, undefined);
  scrim(ctx, 0.66);
  const fr = drawFlowScreen(ctx, state, 'setup');
  const pins = fr.pins;
  if (!land()) {
    const g = ctx.createLinearGradient(0, H - 180, 0, H);
    g.addColorStop(0, 'rgba(20,8,6,0)'); g.addColorStop(0.2, 'rgba(20,8,6,0.85)'); g.addColorStop(1, 'rgba(20,8,6,0.95)');
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
  drawTable(ctx, state, state.w, [], { rot: 0, scale: land() ? 0.8 : 0.8, cy: land() ? undefined : TEXT_SCALES[state.settings.textIdx] > 1.5 ? undefined : 930 + (fr.oy ?? 0) });
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
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(40,18,12,0.92)', stroke: 'rgba(255,214,140,0.5)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,240,218,0.97)', stroke: 'rgba(110,60,40,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,60,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(110,60,40,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(110,60,40,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(110,60,40,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle';
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
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(40,18,12,0.78)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

// A little board in a frame; returns helpers to draw in board coordinates.
function mini(ctx, w, h, state, o = {}) {
  roundPath(ctx, 0, 0, w, h, 16);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a1a1e'); g.addColorStop(1, '#2a0d11');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(110,60,40,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const s = (h - 10) / ((R_BOARD + 24) * 2) * (o.zoom ?? 1), cx = w * (o.fx ?? 0.5) + (o.dx ?? 0) * s, cy = h / 2 + (o.dy ?? 0) * s;
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  drawBoardMini(ctx, state, cx, cy, s);
  ctx.restore();
  return { s, cx, cy, X: (x) => cx + x * s, Y: (y) => cy + y * s };
}

export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    board() {
      const m = mini(ctx, w, h, state, { fx: 0.3 });
      const L = (t, wx, wy, ty) => {
        const px = m.X(wx), py = m.Y(wy), lx = w * 0.62, ly = ty;
        ctx.strokeStyle = '#fff6e2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx - 8, ly); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = '#fff6e2'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
        label(ctx, t, lx, ly + 6, 20, '#ffe9bf', 'left');
      };
      L('20: the pocket', 0, 0, 30); L('15 ring', 0, 64, 68); L('10 ring', 0, 140, 106); L('5 ring', 0, 216, 144); L('8 pegs', PEGS[7].x, PEGS[7].y, 180);
    },
    discs() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e8d4a0'; ctx.fill(); ctx.strokeStyle = 'rgba(110,60,40,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      drawDisc(ctx, w * 0.3, h * 0.46, 0, 0.3, { scale: 2.1 }); drawDisc(ctx, w * 0.7, h * 0.46, 1, 0.3, { scale: 2.1 });
      label(ctx, 'Red: maple leaf', w * 0.3, h - 24, 22); label(ctx, 'Blue: star', w * 0.7, h - 24, 22);
    },
    flick() {
      const m = mini(ctx, w, h, state, { zoom: 1.0 });
      const p = startPoint(0, 0.25), px = m.X(p.x), py = m.Y(p.y);
      drawDisc(ctx, px, py, 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, px, py + 8, px + 2, py + 30, '#ffd35a', 5); tag(ctx, 'pull back', w * 0.2, h - 22, '#ffd35a', 17);
      ctx.save(); ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px, py - 16); ctx.lineTo(m.X(-20), m.Y(-120)); ctx.stroke(); ctx.restore();
      drawDisc(ctx, m.X(-20), m.Y(-120), 0, 0, { scale: m.s * 2.2, a: 0.45, ghost: true });
      tag(ctx, 'flick goes this way', w * 0.8, 36, '#fffbe8', 17);
    },
    spot() {
      const m = mini(ctx, w, h, state);
      const c = Math.PI / 2, half = MAX_U * U_ANGLE;
      ctx.strokeStyle = 'rgba(255,211,90,0.9)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(m.cx, m.cy, R_BASE * m.s, c - half, c + half); ctx.stroke();
      [-0.6, 0, 0.6].forEach((u, i) => { const p = startPoint(0, u); drawDisc(ctx, m.X(p.x), m.Y(p.y), 0, 0, { scale: m.s * 2.2, a: i === 1 ? 1 : 0.5, ghost: i !== 1 }); });
      tag(ctx, 'your line: slide the disc along it', w * 0.5, 24, '#ffe9bf', 17);
    },
    musthit() {
      const m = mini(ctx, w, h, state, { zoom: 1.1, dy: -30 });
      const t = startPoint(0, -0.2);
      drawDisc(ctx, m.X(-70), m.Y(-90), 1, 0.5, { scale: m.s * 2.2 });
      drawDisc(ctx, m.X(t.x), m.Y(t.y), 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, m.X(t.x), m.Y(t.y) - 14, m.X(-66), m.Y(-70), '#7ee8a8', 5); tag(ctx, 'touches a rival: stays', w * 0.24, h - 20, '#7ee8a8', 17);
      const t2 = startPoint(0, 0.4);
      drawDisc(ctx, m.X(t2.x), m.Y(t2.y), 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, m.X(t2.x), m.Y(t2.y) - 14, m.X(t2.x + 20), m.Y(110), '#ffb48a', 5); tag(ctx, 'misses: removed', w * 0.8, h - 20, '#ffb48a', 17);
    },
    rings() {
      const m = mini(ctx, w, h, state);
      [['20', 0], ['15', 64], ['10', 140], ['5', 216]].forEach(([t, r], i) => {
        const px = m.X(0) - 0, py = m.Y(-r);
        const lx = i % 2 ? w * 0.84 : w * 0.16, ly = 28 + i * 40;
        ctx.strokeStyle = '#fff6e2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = '#fff6e2'; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill();
        tag(ctx, `${t} points`, lx, ly, '#ffe08a', 18);
      });
    },
    pegs() {
      const m = mini(ctx, w, h, state, { zoom: 2.2 });
      drawDisc(ctx, m.X(0), m.Y(70), 0, 0, { scale: m.s * 2.2, a: 0.6, ghost: true });
      arrow(ctx, m.X(0), m.Y(52), m.X(0), m.Y(6), '#7ee8a8', 5);
      tag(ctx, 'through a gap', m.X(0) + 150, m.Y(40), '#7ee8a8', 17);
      tag(ctx, 'peg', m.X(PEGS[1].x) - 10, m.Y(PEGS[1].y) + 36, '#ffe08a', 17);
      void R_PEG_RING; void drawPeg;
    },
    hit() {
      const m = mini(ctx, w, h, state, { zoom: 1.3, dy: 20 });
      drawDisc(ctx, m.X(-10), m.Y(-20), 1, 0.2, { scale: m.s * 2.2 });
      drawDisc(ctx, m.X(30), m.Y(180), 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, m.X(26), m.Y(150), m.X(-2), m.Y(0), '#ffd35a', 5);
      arrow(ctx, m.X(-18), m.Y(-42), m.X(-50), m.Y(-130), '#ffffff', 4);
      tag(ctx, 'rival bounces away', w * 0.78, 30, '#fffbe8', 17);
    },
    removed() {
      const m = mini(ctx, w, h, state);
      ctx.strokeStyle = '#ffb48a'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(m.cx, m.cy, 306 * m.s, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.cx, m.cy, (RINGS[2].r + R_DISC) * m.s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      drawDisc(ctx, m.X(150), m.Y(250), 0, 0, { scale: m.s * 2.2, a: 0.5, ghost: true });
      drawDisc(ctx, m.X(-60), m.Y(-80), 1, 0, { scale: m.s * 2.2 });
      tag(ctx, 'short of the 5 ring: removed', w * 0.74, h - 20, '#ffb48a', 16);
      tag(ctx, 'past the edge: gutter', w * 0.26, 22, '#ffb48a', 16);
    },
    pocket() {
      const m = mini(ctx, w, h, state, { zoom: 3.6 });
      drawDisc(ctx, m.X(30), m.Y(34), 0, 0, { scale: m.s * 2.2, a: 0.6, ghost: true });
      arrow(ctx, m.X(30), m.Y(34), m.X(4), m.Y(4), '#ffd35a', 5);
      tag(ctx, '20 points', w * 0.17, h * 0.5, '#ffe08a', 20);
      void R_POCKET;
    },
    rounds() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e8d4a0'; ctx.fill(); ctx.strokeStyle = 'rgba(110,60,40,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      const rows = [['Round 1', 54, 61], ['Round 2', 72, 49], ['Total', 126, 110]];
      rows.forEach(([t, a, b], i) => {
        const yy = 48 + i * 56;
        label(ctx, t, 40, yy, 24, C.ink, 'left'); label(ctx, String(a), w * 0.62, yy, 28, '#b32a2a'); label(ctx, String(b), w * 0.82, yy, 28, '#1d5a8c');
      });
      ctx.strokeStyle = 'rgba(110,60,40,0.4)'; ctx.beginPath(); ctx.moveTo(30, 134); ctx.lineTo(w - 30, 134); ctx.stroke();
    },
  };
  (A[key] ?? A.board)();
  ctx.restore();
}
