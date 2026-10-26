// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit, and the About / How to play /
// Rules reader with its illustrations (drawn with the game's own table, paddles and puck). Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, setupPins } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { HW, HH, GOAL_HW, R_PAD, R_PUCK } from './sim.js';
import { drawPaddle, drawPuck, drawRoom, SIDE } from './art.js';
import { drawTable, miniTable, sideName } from './view.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { LENGTHS } from './match.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- flow screens ------------------------------------------------------------------------------
// Every menu screen is a list of widgets laid out by flowLayout in one or two columns. A column that does not fit scrolls.
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
export function resetMenus() { LAID = blankLaid(); }
const sigOf = (state) => `${W}x${H}|${Math.round(host.t)},${Math.round(host.b)}|${host.px.toFixed(2)}|${state.demo ? 1 : 0}|${JSON.stringify([state.settings, state.setup, state.restoreMsg, state.owned, state.record.wins, state.m ? [state.m.scores, state.m.shots, !!state.m.over, state.m.cfg.mode] : 0])}`;
const land = () => W > H;
const oyOf = () => Math.max(0, (H - 1280) / 2);

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
  if (key === 'result') return { cols: [{ widgets: resultWidgets(state, L), x, w, top: Math.max(host.t, L ? 0 : oyOf()), bottom: H - host.b, center: true }], oy: L ? 0 : oyOf() };
  if (key === 'demolimit') return { cols: [{ widgets: demoLimitWidgets(state, L), x, w, top: Math.max(host.t, L ? 0 : oyOf()), bottom: H - host.b, center: true }], oy: L ? 0 : oyOf() };
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
  LAID = { key, sig: sigOf(state), real: ctx !== estCtx, lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, h: cols[0].lay.contentH, cols, pins: fr.pins ?? null, fr };
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

// The title: the name in a chunky italic with a brass gradient, a tagline and a coin.
const heroArt = (hs = 1) => ({
  t: 'art', h: 470 * hs,
  draw(ctx, w) {
    ctx.save(); ctx.scale(hs, hs); w /= hs; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    const word = (text, y, size, c0, c1) => {
      ctx.font = `italic 900 ${size}px ${DISPLAY}`; ctx.lineJoin = 'round';
      // extruded brass lettering: a stack of dark offsets for depth, a dark outline, a gradient face and a gloss band
      for (let i = 9; i >= 1; i--) { ctx.lineWidth = size * 0.15; ctx.strokeStyle = `rgb(${70 - i * 5},${38 - i * 3},${8})`; ctx.strokeText(text, cx, y + i * size * 0.011); }
      ctx.lineWidth = size * 0.17; ctx.strokeStyle = 'rgba(30,8,2,0.97)'; ctx.strokeText(text, cx, y);
      const g = ctx.createLinearGradient(0, y - size * 0.85, 0, y + size * 0.1); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, '#a8661a');
      ctx.fillStyle = g; ctx.fillText(text, cx, y);
      const hl = ctx.createLinearGradient(0, y - size * 0.85, 0, y - size * 0.25); hl.addColorStop(0, 'rgba(255,255,255,0.65)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.fillText(text, cx, y);
    };
    let size = 112; ctx.font = `italic 900 ${size}px ${DISPLAY}`;
    while (ctx.measureText('CYMBERGAJ').width > w - 30 && size > 40) { size -= 2; ctx.font = `italic 900 ${size}px ${DISPLAY}`; }
    word('CYMBERGAJ', 170, size, '#fff7d0', '#e9a935');
    ctx.font = `italic 900 54px ${DISPLAY}`; ctx.lineWidth = 11; ctx.strokeStyle = 'rgba(40,12,2,0.96)'; ctx.lineJoin = 'round'; ctx.strokeText('PUCK TABLE', cx, 252);
    const g2 = ctx.createLinearGradient(0, 212, 0, 256); g2.addColorStop(0, '#ff9a7a'); g2.addColorStop(1, '#d63f28'); ctx.fillStyle = g2; ctx.fillText('PUCK TABLE', cx, 252);
    ctx.font = `600 27px ${FONT}`; ctx.fillStyle = 'rgba(40,12,2,0.6)'; ctx.fillText('The Polish game of air, brass and nerve', cx + 1, 308); ctx.fillStyle = 'rgba(255,240,208,0.97)'; ctx.fillText('The Polish game of air, brass and nerve', cx, 306);
    if (!v3.on) { drawPuck(ctx, { x: cx - 188, y: 78, ang: 0.4, scale: 1.25 }); drawPuck(ctx, { x: cx + 188, y: 78, ang: 1.1, scale: 1.25 }); }
    ctx.restore();
  },
});
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

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
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffd9a0', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: part === 'left' ? 84 : 92 });
    });
  }
  if (part !== 'left') {
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffd9a0', size: 26 });
    if (part === 'right') {
      wd.push({ t: 'btn', id: 'len5', label: `Quick: first to ${LENGTHS[0]}`, active: s.goalsTo === LENGTHS[0], h: 80 });
      wd.push({ t: 'btn', id: 'len7', label: `Full: first to ${LENGTHS[1]}`, active: s.goalsTo === LENGTHS[1], h: 80 });
    } else {
      wd.push({ t: 'btn', id: 'len5', label: `Quick: first to ${LENGTHS[0]}`, row: 9, active: s.goalsTo === LENGTHS[0] });
      wd.push({ t: 'btn', id: 'len7', label: `Full: first to ${LENGTHS[1]}`, row: 9, active: s.goalsTo === LENGTHS[1] });
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
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'A slower puck and a softer table', active: st.calm },
  ];
  const right = [
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffd9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffd9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: state.owned ? 'Full game unlocked' : 'Restore purchase', dark: true, disabled: !!state.owned }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffd9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return part === 'left' ? left : part === 'right' ? [{ t: 'gap', h: 70 }, ...right] : [...left, ...right];
}

export function resultWidgets(state, wide = false) {
  const m = state.m, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${sideName(state, winner)} wins` : winner === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 120 }, { t: 'h', label: title, size: wide ? 56 : 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: wide ? 72 : 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  wd.push({ t: 'p', label: `${m.rallies} ${m.rallies === 1 ? 'goal' : 'goals'} in the match.`, size: 26, cap: big ? 2 : 3 });
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
    { t: 'gap', h: wide ? 6 : big ? 30 : 160 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free match of the web demo. The full game on iPhone and Android has every rival, full matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  if (v3.on) { v3.scrim = Math.max(v3.scrim, Math.min(0.9, a)); return; }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(24,8,2,${a * 0.7})`); g.addColorStop(0.5, `rgba(24,8,2,${a})`); g.addColorStop(1, `rgba(24,8,2,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(24,8,2,0)'); g.addColorStop(1, 'rgba(24,8,2,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,238,205,0.94)'; ctx.fill();
    ctx.fillStyle = '#2b180e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,238,205,0.94)'; ctx.fill();
    ctx.fillStyle = '#2b180e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key) {
  let fr, cols;
  if (LAID.key === key && LAID.real && LAID.sig === sigOf(state)) { fr = LAID.fr; cols = LAID.cols; }
  else { fr = frameFor(state, key); cols = layColumns(ctx, state, key, fr); }
  const c0 = cols[0], maxScroll = Math.max(0, c0.lay.contentH - (c0.bottom - c0.top));
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  const scroll = state.ui.scroll;
  cols.forEach((c, i) => {
    const mx = Math.max(0, c.lay.contentH - (c.bottom - c.top)), sc = i === 0 ? scroll : 0;
    drawFlow(ctx, c.lay, c.top, c.bottom, sc, { clipX: c.x - 40, clipW: c.w + 80 });
    if (mx > 0) {
      const top = c.top, bottom = c.bottom, th = Math.max(60, (bottom - top) * ((bottom - top) / c.lay.contentH)), ty = top + (sc / mx) * (bottom - top - th);
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,230,190,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The attract table behind the menus: a table layout object { cx, cy, s, rot } and the little game state.att.
const attractTable = (ctx, state, L0) => {
  if (v3.on) { v3.attract = { L0 }; return; }
  drawRoom(ctx, W, H, L0.cx, L0.cy, Math.max(W, H) * 0.75);
  drawTable(ctx, L0, state.att.w, { t: state.t, parts: state.att.parts, trail: state.att.trail, showPuck: true });
};
const tablePortrait = (state, s, cy) => ({ cx: W / 2, cy, s, rot: 0 });

function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(24,8,2,0.66)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const oy = fr.oy, hs = heroScaleFor(state);
    attractTable(ctx, state, tablePortrait(state, Math.min(1.1, (W - 16) / 540, (H * 0.9) / 960), H * 0.47));
    scrim(ctx, 0.2);
    const g = ctx.createRadialGradient(W / 2, 220 + oy, 40, W / 2, 220 + oy, 400);
    g.addColorStop(0, 'rgba(24,8,2,0.6)'); g.addColorStop(1, 'rgba(24,8,2,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700 + oy);
    void hs;
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,238,205,0.75)';
    if (state.demo) ctx.fillText('Web demo', W / 2, H - 4 - host.b);
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0, k = Math.min(1, hw / 640);
  attractTable(ctx, state, { cx: W / 2, cy: H / 2, s: Math.min(1.1, (H - 20) / 540, (W - 20) / 960), rot: Math.PI / 2 });
  scrim(ctx, 0.35);
  const g = ctx.createRadialGradient(hx, 200, 40, hx, 200, 360);
  g.addColorStop(0, 'rgba(24,8,2,0.6)'); g.addColorStop(1, 'rgba(24,8,2,0)');
  ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 600);
  ctx.save(); ctx.translate(hx, Math.max(host.t, 0) - 20 * k + 40); ctx.scale(k, k);
  heroArt().draw(ctx, 0); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,238,205,0.75)';
  if (state.demo) ctx.fillText('Web demo', hx, H - 8 - host.b);
}

const backdrop = (ctx, state, a) => {
  attractTable(ctx, state, land() ? { cx: W / 2, cy: H / 2, s: Math.min(1.1, (H - 20) / 540, (W - 20) / 960), rot: Math.PI / 2 } : tablePortrait(state, Math.min(1.0, (W - 16) / 540, (H - 40) / 960), H / 2));
  scrim(ctx, a);
};
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.72);
  const fr = drawFlowScreen(ctx, state, 'setup');
  const pins = fr.pins;
  if (!land()) {
    const g = ctx.createLinearGradient(0, H - 180, 0, H);
    g.addColorStop(0, 'rgba(24,8,2,0)'); g.addColorStop(0.2, 'rgba(24,8,2,0.88)'); g.addColorStop(1, 'rgba(24,8,2,0.96)');
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
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'settings'); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.66); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(58,28,14,0.96)', stroke: 'rgba(233,183,74,0.7)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }], pins: null };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  const sc0 = state.ui.scroll;
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px, pw);
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
  backdrop(ctx, state, 0.78);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(253,246,230,0.98)', stroke: 'rgba(110,60,20,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,60,20,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 300 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(110,60,20,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 250); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 238, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(110,60,20,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(110,60,20,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
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
function tag(ctx, t, x, y, col = '#ffffff', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 18;
  roundPath(ctx, x - tw / 2, y - size * 0.82, tw, size * 1.6, size * 0.75); ctx.fillStyle = 'rgba(40,16,6,0.88)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col, wd) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), hl = wd * 3.4;
  ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * wd, y1 + Math.sin(a) * wd); ctx.lineTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5)); ctx.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
}
const pad = (side, x, y) => ({ x, y, hit: 0, ang: 0, side });
const pk = (x, y, ang = 0.5) => ({ x, y, vx: 0, vy: 0, ang, scale: 1 });
const dash = (ctx, pts, col, lw) => {
  ctx.setLineDash([14, 12]); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.setLineDash([]);
};

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const rot = Math.PI / 2, whole = { rot, s: Math.min(w / ((HH + 78) * 2), h / ((HW + 62) * 2)) };
  const A = {
    hero() {
      miniTable(ctx, 0, 0, w, h, () => { drawPaddle(ctx, pad(0, -40, 250), 0); drawPaddle(ctx, pad(1, 60, -250), 1); drawPuck(ctx, pk(10, 40)); }, { ...whole });
    },
    move() {
      const m = miniTable(ctx, 0, 0, w, h, () => {
        drawPaddle(ctx, pad(0, -70, 150), 0);
        drawPuck(ctx, pk(-110, 40)); drawPaddle(ctx, pad(1, 40, -230), 1);
        dash(ctx, [[-70, 150], [-100, 90], [-120, 70]], '#ffd24a', 7);
      }, { rot, s: Math.min(w / 560, h / 520), focus: [-30, 0] });
      const a = m.P(-70, 150), b = m.P(-120, 70);
      tag(ctx, 'slide to move', a.x + 60, a.y + 40, '#ffffff', 17);
      tag(ctx, 'your half', m.P(150, 100).x, m.P(150, 100).y - 40, '#ffb09a', 17);
      void b;
    },
    goal() {
      const m = miniTable(ctx, 0, 0, w, h, () => {
        drawPaddle(ctx, pad(1, 60, -300), 1); drawPuck(ctx, pk(-10, -380));
        dash(ctx, [[-30, -300], [-10, -380], [-6, -420]], '#ffd24a', 6);
      }, { rot, s: Math.min(w / 420, h / 330), focus: [0, -350] });
      const a = m.P(-GOAL_HW, -HH), b = m.P(GOAL_HW, -HH), c = m.P(0, -HH);
      tag(ctx, 'goal line', c.x - 150, c.y, '#ffffff', 17);
      tag(ctx, 'between the posts', (a.x + b.x) / 2 + 40, (a.y + b.y) / 2 + 70, '#ffe08a', 17);
    },
    bank() {
      const m = miniTable(ctx, 0, 0, w, h, () => {
        drawPaddle(ctx, pad(0, -60, 230), 0); drawPuck(ctx, pk(-40, 130));
        drawPaddle(ctx, pad(1, 20, -240), 1);
        dash(ctx, [[-40, 130], [HW - R_PUCK, -80], [10, -400]], '#ffd24a', 7);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(HW - R_PUCK, -80, 20, 0, TAU); ctx.stroke();
      }, { rot, s: Math.min(w / 640, h / 520), focus: [50, -120] });
      const b = m.P(HW - R_PUCK, -80);
      tag(ctx, 'bounces off the side', b.x - 110, b.y + 40, '#ffffff', 17);
    },
    halves() {
      const m = miniTable(ctx, 0, 0, w, h, () => {
        ctx.fillStyle = 'rgba(255,90,60,0.16)'; ctx.fillRect(-HW, 0, HW * 2, HH);
        ctx.fillStyle = 'rgba(40,180,170,0.16)'; ctx.fillRect(-HW, -HH, HW * 2, HH);
        drawPaddle(ctx, pad(0, 40, 240), 0); drawPaddle(ctx, pad(1, -40, -240), 1); drawPuck(ctx, pk(0, 0));
      }, { ...whole });
      tag(ctx, 'your half', m.P(0, 220).x, m.P(0, 220).y + 70, '#ffb09a', 17);
      tag(ctx, 'rival half', m.P(0, -220).x, m.P(0, -220).y + 70, '#8ff0e0', 17);
      tag(ctx, 'centre line: paddles stay on their side', m.P(0, 0).x, m.P(0, 0).y - 100, '#ffffff', 16);
    },
    serve() {
      const m = miniTable(ctx, 0, 0, w, h, () => {
        drawPaddle(ctx, pad(0, -60, 270), 0); drawPaddle(ctx, pad(1, 40, -250), 1); drawPuck(ctx, pk(0, 170));
        ctx.strokeStyle = 'rgba(255,240,170,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 170, R_PUCK + 9, 0, TAU); ctx.stroke();
      }, { rot, s: Math.min(w / 700, h / 560), focus: [0, 40] });
      tag(ctx, 'the side that conceded serves', m.P(0, 170).x - 70, m.P(0, 170).y - 62, '#ffffff', 16);
    },
    coach() {
      const m = miniTable(ctx, 0, 0, w, h, () => {
        drawPaddle(ctx, pad(0, 60, 280), 0); drawPaddle(ctx, pad(1, 20, -240), 1); drawPuck(ctx, pk(-50, 120));
        dash(ctx, [[-50, 120], [-HW + R_PUCK, -60], [-20, -400]], '#ffd24a', 7);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(-30, 215, R_PAD + 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }, { rot, s: Math.min(w / 640, h / 540), focus: [0, -10] });
      const r = m.P(-30, 215);
      tag(ctx, 'stand here', r.x - 30, r.y + 56, '#ffffff', 17);
    },
  };
  (A[key] ?? A.hero)();
  ctx.restore();
}
void HW; void HH; void R_PAD; void R_PUCK; void SIDE; void C; void THINK_STEPS; void LENGTHS; void ABOUT; void HOWTO; void RULES;
