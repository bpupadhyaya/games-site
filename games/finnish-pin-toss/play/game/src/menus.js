// Every screen that is not the play screen: title, setup, settings, result, pause, scorecard, records, and the scrolling
// About / How to play / Rules reader with its illustrations (drawn with the game's own skittle and pin art).
// Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, setupPins } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { startSkittles } from './sim.js';
import { DISPLAY, drawSkittleIcon, drawPinIcon } from './art.js';
import { drawBackdrop } from './view.js';
import { GL } from './glbridge.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { LENGTHS } from './match.js';

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
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.setup.mode}|${state.setup.count}|${state.setup.length}|${state.setup.opp}|${state.demo ? 1 : 0}|${state.restoreMsg}|${state.owned?.() ? 1 : 0}`;
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
  if (key === 'records') return { cols: [{ widgets: recordsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
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

// Embossed lettering: a dark carved outline, a cream-to-gold face lit from above, a thin highlight and a soft drop shadow.
function carved(ctx, text, x, y, size, c0, c1) {
  ctx.save();
  ctx.font = `600 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(8,10,30,0.55)'; ctx.shadowBlur = size * 0.14; ctx.shadowOffsetY = size * 0.07;
  ctx.lineWidth = size * 0.17; ctx.strokeStyle = '#3a1d0a'; ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = size * 0.07; ctx.strokeStyle = '#8a5a1e'; ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.05);
  g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, '#c98a2a');
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.lineWidth = Math.max(1, size * 0.018); ctx.strokeStyle = 'rgba(255,255,240,0.65)'; ctx.strokeText(text, x, y - size * 0.012);
  ctx.restore();
}
const heroArt = (hs = 1) => ({
  t: 'art', h: (GL.on ? 215 : 330) * hs,
  draw(ctx, w) {
    ctx.save(); ctx.scale(hs, hs); w /= hs; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    let y0 = 0;
    if (!GL.on) {
      // the flat fallback: a little bundle of numbered skittles and the pin
      [[-1.5, 7], [-0.5, 12], [0.5, 4], [1.5, 9]].forEach(([k, n], i) => drawSkittleIcon(ctx, cx + k * 62, 74 + (i % 2) * 6, 40, n));
      drawPinIcon(ctx, cx - 258, 96, 110, -0.5);
      drawPinIcon(ctx, cx + 258, 96, 110, 0.5);
      y0 = 114;
    }
    carved(ctx, 'FINNISH', cx, y0 + 54, 52, '#fff3c8', '#ffd35a');
    ctx.font = `600 110px ${DISPLAY}`;
    const tw = ctx.measureText('PIN TOSS').width, ts = Math.max(44, Math.min(110, Math.floor(110 * (w - 60) / Math.max(1, tw))));
    carved(ctx, 'PIN TOSS', cx, y0 + 148, ts, '#ffffff', '#fff0c0');
    ctx.font = `700 28px ${FONT}`; textShadow(ctx, 'THROW  ·  TOPPLE  ·  EXACTLY 50', cx, y0 + 190, '#fff6dc', 8);
    ctx.restore();
  },
});
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function heroScaleFor(state) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const btnH = flowLayout(estCtx, titleWidgets(state, true), sc, { x: 40, w: 640 }).contentH;
  const top = Math.max(host.t, oyOf()), avail = H - host.b - top - lockSize(600).strip - btnH - 30;
  return Math.max(0.5, Math.min(1, avail / ((GL.on ? 215 + 210 : 330 + 40))));
}
export function titleWidgets(state, wide = false, hs = 1) {
  const sound = state.settings.sound;
  const wd = wide ? [] : [heroArt(hs), { t: 'gap', h: (GL.on ? 210 : 40) * hs }];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'solo', label: 'Solo Run', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', h: 84 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  wd.push({ t: 'btn', id: 'records', label: 'Records', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  if (!wide) wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 });
  return wd;
}

export function setupWidgets(state, part = 'all') {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [];
  const title = s.mode === 'two' ? 'Pass and Play' : s.mode === 'solo' ? 'Solo Practice' : 'New Match';
  if (part !== 'right') wd.push({ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 });
  else wd.push({ t: 'gap', h: 18 });
  if (s.mode === 'ai' && part !== 'right') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: GOLD, size: 26 });
    PROFILES.slice(0, 4).forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: part === 'left' ? 80 : 92 });
    });
  }
  if (part !== 'left') {
    if (s.mode === 'ai') {
      wd.push({ t: 'p', label: 'Rivals at the table', bold: true, color: GOLD, size: 26 });
      wd.push({ t: 'btn', id: 'cnt1', label: 'One', row: 8, active: s.count === 1 });
      wd.push({ t: 'btn', id: 'cnt2', label: 'Two', row: 8, active: s.count === 2 });
      wd.push({ t: 'btn', id: 'cnt3', label: 'Three', row: 8, active: s.count === 3 });
    } else if (s.mode === 'two') {
      wd.push({ t: 'p', label: 'Players sharing the phone', bold: true, color: GOLD, size: 26 });
      wd.push({ t: 'btn', id: 'cnt2', label: '2', row: 8, active: s.count <= 2 });
      wd.push({ t: 'btn', id: 'cnt3', label: '3', row: 8, active: s.count === 3 });
      wd.push({ t: 'btn', id: 'cnt4', label: '4', row: 8, active: s.count === 4 });
    }
    wd.push({ t: 'p', label: 'Match length', bold: true, color: GOLD, size: 26 });
    if (part === 'right') {
      wd.push({ t: 'btn', id: 'len-classic', label: 'Classic: exactly 50', active: s.length === 'classic', h: 80 });
      wd.push({ t: 'btn', id: 'len-short', label: 'Short: exactly 30', active: s.length === 'short', h: 80 });
    } else {
      wd.push({ t: 'btn', id: 'len-classic', label: 'Classic: 50', row: 9, active: s.length === 'classic' });
      wd.push({ t: 'btn', id: 'len-short', label: 'Short: 30', row: 9, active: s.length === 'short' });
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
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: state.owned?.() ? 'Full game unlocked' : 'Restore purchase', dark: true, disabled: !!state.owned?.() }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: GOLD }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return part === 'left' ? left : part === 'right' ? [{ t: 'gap', h: 70 }, ...right] : [...left, ...right];
}

export function resultWidgets(state, wide = false) {
  const m = state.m, o = m.over ?? { win: -1, why: 'cap' }, mode = m.cfg.mode;
  const winner = o.win;
  const nm = (i) => m.players[i].name;
  const solo = m.n === 1;
  let title;
  if (solo) title = winner === 0 ? 'Exactly ' + m.target + '!' : 'Out of throws';
  else if (winner < 0) title = 'A draw';
  else if (mode === 'ai') title = winner === 0 ? 'You win!' : `${nm(winner)} wins`;
  else title = `${nm(winner)} wins`;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 110 }, { t: 'h', label: title, size: wide ? 56 : 64, cap: big ? 1.2 : 1.5 }];
  const why = o.why === 'exact' ? `Landed on exactly ${m.target}.` : o.why === 'last' ? 'The last player left in the game.' : o.why === 'cap' ? 'The marathon limit was reached: highest score wins.' : 'Three misses in a row.';
  wd.push({ t: 'p', label: why, size: 28, bold: true, color: '#ffd97a', cap: big ? 2 : 3 });
  m.players.forEach((p) => wd.push({ t: 'p', label: `${p.name}: ${p.out ? 'out' : p.score}, ${p.throws} throw${p.throws === 1 ? '' : 's'}, most skittles in one throw ${p.best}`, size: 25, cap: big ? 2 : 3 }));
  if (solo && winner === 0) wd.push({ t: 'p', label: `Your fewest throws: ${state.record.bestSolo | 0}`, size: 26, cap: big ? 2 : 3 });
  if (mode === 'ai') wd.push({ t: 'p', label: `Your wins against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0}.`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: wide ? 8 : 24 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'solo' ? 'Another run' : 'Rematch', primary: true, h: 92 });
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
    { t: 'gap', h: wide ? 6 : big ? 30 : 160 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, both match lengths and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
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

// the lawn behind the menus: full screen with slow attract throws
const bleed = (ctx, state) => { drawBackdrop(ctx, state); };

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
    scrim(ctx, GL.on ? 0.08 : 0.3);
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.6)';
    if (state.demo) ctx.fillText('Web demo', W / 2, H - 4 - host.b);
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0, k = Math.min(1, hw / 640);
  bleed(ctx, state);
  scrim(ctx, GL.on ? 0.06 : 0.25);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(Math.max(host.t, 0) + 6, (H - host.b - 330 * k) / 2 - 12)); ctx.scale(k, k);   // art is 640 wide, centred in the hero zone
  heroArt().draw(ctx, 640); ctx.restore();
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
    const g = ctx.createLinearGradient(0, H - 180, 0, H);
    g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(0.2, 'rgba(8,10,30,0.85)'); g.addColorStop(1, 'rgba(8,10,30,0.95)');
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
  bleed(ctx, state);
  scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'settings');
}
export function renderResult(ctx, state) {
  bleed(ctx, state);
  scrim(ctx, land() ? 0.66 : 0.6);
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

// ---- records ----------------------------------------------------------------------------------
export function recordsWidgets(state) {
  const r = state.record, wins = r.wins ?? [0, 0, 0, 0];
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Records', size: 48 }];
  wd.push({ t: 'p', label: `Fewest throws to reach the target alone: ${r.bestSolo ? r.bestSolo : 'not yet'}`, size: 28, bold: true, color: '#ffd97a' });
  wd.push({ t: 'p', label: `Most skittles in one throw: ${r.bestKnock | 0}`, size: 26 });
  wd.push({ t: 'p', label: `Matches played: ${r.played | 0}`, size: 26 });
  wd.push({ t: 'p', label: `Longest winning streak: ${r.best | 0}`, size: 26 });
  wd.push({ t: 'p', label: 'Wins against the rivals', size: 26, bold: true, color: GOLD });
  PROFILES.slice(0, 4).forEach((pf, i) => wd.push({ t: 'p', label: `${pf.name}: ${wins[i] | 0}`, size: 26 }));
  wd.push({ t: 'p', label: `Throws taken: ${r.throws | 0}  ·  exact finishes: ${r.exact | 0}`, size: 24 });
  wd.push({ t: 'gap', h: 14 });
  wd.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}
export function renderRecords(ctx, state) {
  bleed(ctx, state);
  scrim(ctx, 0.74);
  drawFlowScreen(ctx, state, 'records');
}
export const collectionMeta = () => ({ max: 0 });

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

// ---- the scorecard sheet (in play) ------------------------------------------------------------
function chipsWidget(state, p, m) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cw = Math.round(74 * Math.min(sc, 1.6)), ch = Math.round(46 * Math.min(sc, 1.6)), gap = 8;
  return {
    t: 'art', h: 0, pid: p.id, cw, ch, gap,
    draw(ctx, w, h) {
      const per = Math.max(1, Math.floor((w + gap) / (cw + gap)));
      p.history.forEach((e, i) => {
        const x = (i % per) * (cw + gap), y = Math.floor(i / per) * (ch + gap);
        let label, bg = '#e8dcc0', fg = C.ink;
        if (e.t === 'miss') { label = e.out ? 'OUT' : 'miss'; bg = '#d8d2c6'; fg = '#7a3a2a'; }
        else if (e.win) { label = `${m.target}!`; bg = '#ffd26a'; }
        else if (e.dropped) { label = `${e.before + e.pts}→${m.back}`; bg = '#f3b8a6'; fg = '#7a1d17'; }
        else if (e.t === 'single') { label = `${e.num}`; bg = '#fff3d0'; }
        else { label = `${e.count}×`; bg = '#cfe4f7'; }
        roundPath(ctx, x, y, cw, ch, 10); ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(40,60,90,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = fg; ctx.font = `700 ${Math.round(ch * 0.46)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x + cw / 2, y + ch * 0.42);
        if (e.t !== 'miss') { ctx.font = `400 ${Math.round(ch * 0.26)}px ${FONT}`; ctx.fillStyle = 'rgba(30,40,60,0.75)'; ctx.fillText(`${e.after}`, x + cw / 2, y + ch * 0.8); }
      });
      void h;
    },
  };
}
export function sheetWidgets(state, innerW) {
  const m = state.m;
  const wd = [{ t: 'h', label: 'Scorecard', size: 46 }];
  wd.push({ t: 'p', label: `Land on exactly ${m.target} to win. Go over and you drop back to ${m.back}. Three misses in a row and you are out.`, size: 24, color: '#ffe9a0' });
  wd.push({ t: 'p', label: 'One skittle scores its number, several score how many fell. Each box shows the throw and, below it, your new total.', size: 22 });
  m.players.forEach((p) => {
    const need = m.target - p.score;
    wd.push({ t: 'p', label: `${p.name}: ${p.out ? 'out of the game' : `${p.score} (needs ${need})`}${p.misses && !p.out ? `, ${p.misses} miss${p.misses === 1 ? '' : 'es'} in a row` : ''}`, size: 26, bold: true, color: '#fff8e6' });
    const cwid = chipsWidget(state, p, m);
    const per = Math.max(1, Math.floor((innerW + cwid.gap) / (cwid.cw + cwid.gap)));
    const rows = Math.max(1, Math.ceil(p.history.length / per));
    cwid.h = p.history.length ? rows * (cwid.ch + cwid.gap) : 4;
    wd.push(cwid);
  });
  wd.push({ t: 'btn', id: 'sheet-close', label: 'Back to the game', primary: true, h: 84 });
  return wd;
}
export function renderSheet(ctx, state) {
  scrim(ctx, 0.62);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(700, W - 40), px = Math.round((W - pw) / 2);
  const wd = sheetWidgets(state, pw - 60);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(40, host.t + 14), bottom = H - Math.max(40, host.b + 14);
  const ch = Math.min(lay.contentH + 20, bottom - top - 40);
  const y0 = Math.max(top + 20, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(20,40,70,0.96)', stroke: 'rgba(255,214,140,0.5)' });
  LAID = { key: 'sheet', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: Math.max(0, lay.contentH - ch), cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }], pins: null };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, state.ui.scroll, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, state.ui.scroll, maxScroll, px, pw);
}

// ---- illustrations ----------------------------------------------------------------------------
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(8,24,44,0.86)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
const lawnCard = (ctx, w, h) => {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9cc77a'); g.addColorStop(1, '#6aa84a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 9; i++) if (i % 2) ctx.fillRect(i * w / 9, 0, w / 9, h);
  ctx.restore();
  roundPath(ctx, 0, 0, w, h, 16); ctx.strokeStyle = 'rgba(30,60,30,0.6)'; ctx.lineWidth = 2; ctx.stroke();
};
const paperCard = (ctx, w, h) => { roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#f1e7cc'; ctx.fill(); ctx.strokeStyle = 'rgba(40,60,90,0.5)'; ctx.lineWidth = 2; ctx.stroke(); };
const ROWS_UI = [[1, 2], [3, 10, 4], [5, 11, 12, 6], [7, 9, 8]];

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    cluster() {
      lawnCard(ctx, w, h);
      const cx = w * 0.4, s = 34;
      for (let ri = ROWS_UI.length - 1; ri >= 0; ri--) ROWS_UI[ri].forEach((n, j) => drawSkittleIcon(ctx, cx + (j - (ROWS_UI[ri].length - 1) / 2) * (s + 6), h - 56 - ri * 44, s, n));
      arrow(ctx, w * 0.84, h - 40, w * 0.84, 40, '#fff6e2', 5);
      tag(ctx, 'throw from here', w * 0.84, h - 18, '#fff6e2', 15);
      tag(ctx, 'back row', w * 0.12, 54, '#ffe08a', 15);
      tag(ctx, 'front row', w * 0.12, h - 40, '#ffe08a', 15);
    },
    pull() {
      lawnCard(ctx, w, h);
      drawSkittleIcon(ctx, w * 0.68, 52, 22, 8); drawSkittleIcon(ctx, w * 0.74, 60, 22, 11); drawSkittleIcon(ctx, w * 0.62, 62, 22, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(w * 0.22, h * 0.52, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(w * 0.22 - 20, h * 0.52 + 70, 15, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([5, 7]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.22, h * 0.52); ctx.lineTo(w * 0.22 - 20, h * 0.52 + 70); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.28, h - 20); ctx.quadraticCurveTo(w * 0.4, 6, w * 0.67, 70); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(w * 0.67, 72, 26, 14, 0, 0, Math.PI * 2); ctx.stroke();
      tag(ctx, 'pull back: strength', w * 0.22 + 70, h * 0.52 + 76, '#fff', 15);
      tag(ctx, 'sideways: aim', w * 0.22, h * 0.52 - 30, '#fff', 15);
      tag(ctx, 'landing ring', w * 0.78, 108, '#ffd35a', 15);
    },
    styles() {
      lawnCard(ctx, w, h);
      ctx.setLineDash([5, 7]); ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(40, h - 40); ctx.quadraticCurveTo(w * 0.22, 0, w * 0.45, h - 40); ctx.stroke();
      ctx.strokeStyle = '#ffd35a'; ctx.beginPath(); ctx.moveTo(40, h - 20); ctx.quadraticCurveTo(w * 0.36, h * 0.4, w * 0.45, h - 20); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, 'Lob: gentle landing', w * 0.22, 28, '#fff', 15);
      tag(ctx, 'Skim: drives through', w * 0.3, h * 0.64, '#ffd35a', 15);
      drawPinIcon(ctx, w * 0.7, 56, 110, -1.2); tag(ctx, 'end over end: narrow', w * 0.7, 120, '#fff', 15);
      drawPinIcon(ctx, w * 0.7, 176, 110, 0.15); tag(ctx, 'flat spin: wide', w * 0.7, 212, '#fff', 15);
    },
    scoring() {
      paperCard(ctx, w, h);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`;
      drawSkittleIcon(ctx, 44, 54, 30, 7); ctx.fillText('One skittle falls: its number', 90, 54);
      [0, 1, 2, 3].forEach((i) => drawSkittleIcon(ctx, 44 + i * 26, 130, 22, ''));
      ctx.fillText('Four fall: 4 points', 160, 130);
      ctx.fillStyle = '#7a3a2a'; ctx.fillText('None fall: a miss (0)', 44, 204);
    },
    rule50() {
      paperCard(ctx, w, h);
      const bx = 40, bw = w - 80, by = 92;
      roundPath(ctx, bx, by, bw, 18, 9); ctx.fillStyle = '#cfd8e0'; ctx.fill();
      roundPath(ctx, bx, by, bw * 0.92, 18, 9); ctx.fillStyle = '#5ec2ff'; ctx.fill();
      ctx.fillStyle = C.ink; ctx.fillRect(bx + bw * 0.5 - 1.5, by - 10, 3, 38);
      ctx.fillStyle = '#c4572a'; ctx.fillRect(bx + bw - 3, by - 14, 5, 46);
      ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = C.ink;
      ctx.fillText('0', bx, by + 48); ctx.fillText('25', bx + bw / 2, by + 48); ctx.fillText('50', bx + bw, by + 48);
      ctx.font = `400 21px ${FONT}`;
      ctx.fillText('Exactly 50 wins. Over 50: back to 25.', w / 2, 36);
      ctx.fillText('Example: 46 + 7 = 53 is over, so you drop to 25.', w / 2, h - 44);
      ctx.fillText('46 + 4 = 50 wins.', w / 2, h - 16);
    },
    misses() {
      paperCard(ctx, w, h);
      [0, 1, 2].forEach((i) => { ctx.fillStyle = '#e0533a'; ctx.beginPath(); ctx.arc(w / 2 - 70 + i * 70, 84, 24, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = C.ink; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('Three misses in a row: out', w / 2, 160);
      ctx.font = `400 21px ${FONT}`; ctx.fillText('Any throw that knocks a skittle clears the count.', w / 2, 200);
    },
  };
  (A[key] ?? A.cluster)();
  ctx.restore();
}
void setupPins; void LENGTHS; void startSkittles;
