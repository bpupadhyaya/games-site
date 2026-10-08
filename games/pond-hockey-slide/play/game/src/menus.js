// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit, and the About / How to play /
// Rules reader with its illustrations (drawn with the game's own pond and people). Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, setupPins } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { HW, HH, GOAL_HW, CORNER } from './sim.js';
import { drawSkater, drawPuck, drawSnow, LOOKS } from './art.js';
import { drawPond, miniPond, sideName } from './view.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { LENGTHS } from './match.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- flow screens ------------------------------------------------------------------------------
// Every menu screen is a list of widgets laid out by flowLayout in one or two columns. A column that does not fit scrolls.
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
export function resetMenus() { LAID = blankLaid(); }
const sigOf = (state) => `${W}x${H}|${Math.round(host.t)},${Math.round(host.b)}|${host.px.toFixed(2)}|${state.demo ? 1 : 0}|${JSON.stringify([state.settings, state.setup, state.restoreMsg, state.record.wins, state.m ? [state.m.scores, state.m.shots, !!state.m.over, state.m.cfg.mode] : 0])}`;
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

// The title: the name in a chunky italic with an icy gradient, a tagline and a puck.
const heroArt = (hs = 1) => ({
  t: 'art', h: 470 * hs,
  draw(ctx, w) {
    ctx.save(); ctx.scale(hs, hs); w /= hs; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    const word = (text, y, size, c0, c1) => {
      ctx.font = `italic 900 ${size}px ${DISPLAY}`; ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.17; ctx.strokeStyle = 'rgba(6,24,44,0.95)'; ctx.strokeText(text, cx, y);
      const g = ctx.createLinearGradient(0, y - size * 0.85, 0, y + size * 0.1); g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g; ctx.fillText(text, cx, y);
    };
    ctx.save();
    word('POND', 150, 118, '#ffffff', '#a8d4f5');
    word('HOCKEY', 262, 118, '#ffffff', '#8fc3ee');
    ctx.restore();
    ctx.font = `italic 900 70px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(6,24,44,0.95)'; ctx.strokeText('SLIDE', cx, 340);
    const g2 = ctx.createLinearGradient(0, 290, 0, 345); g2.addColorStop(0, '#ffb09a'); g2.addColorStop(1, '#e0453a'); ctx.fillStyle = g2; ctx.fillText('SLIDE', cx, 340);
    ctx.font = `600 27px ${FONT}`; ctx.fillStyle = 'rgba(225,244,255,0.95)'; ctx.fillStyle = 'rgba(4,18,36,0.55)'; ctx.fillText('Shinny on a frozen pond', cx + 1, 394); ctx.fillStyle = 'rgba(225,244,255,0.97)'; ctx.fillText('Shinny on a frozen pond', cx, 392);
    drawPuck(ctx, { x: cx - 168, y: 330, vx: 0, vy: 0 }, 0);
    drawPuck(ctx, { x: cx + 168, y: 330, vx: 0, vy: 0 }, 0);
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
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#bfe6ff', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: part === 'left' ? 84 : 92 });
    });
  }
  if (part !== 'left') {
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#bfe6ff', size: 26 });
    if (part === 'right') {
      wd.push({ t: 'btn', id: 'len3', label: `Quick: first to ${LENGTHS[0]}`, active: s.goalsTo === LENGTHS[0], h: 80 });
      wd.push({ t: 'btn', id: 'len5', label: `Full: first to ${LENGTHS[1]}`, active: s.goalsTo === LENGTHS[1], h: 80 });
    } else {
      wd.push({ t: 'btn', id: 'len3', label: `Quick: first to ${LENGTHS[0]}`, row: 9, active: s.goalsTo === LENGTHS[0] });
      wd.push({ t: 'btn', id: 'len5', label: `Full: first to ${LENGTHS[1]}`, row: 9, active: s.goalsTo === LENGTHS[1] });
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
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'Shows the whole predicted glide path', active: st.calm },
  ];
  const right = [
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#bfe6ff', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#bfe6ff', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#bfe6ff' }] : []),
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
  wd.push({ t: 'p', label: `${m.shots} ${m.shots === 1 ? 'shot' : 'shots'} in the match${o.sudden ? ', settled in sudden death' : o.byCap ? ', decided on the shot limit' : ''}.`, size: 26, cap: big ? 2 : 3 });
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
    { t: 'p', label: 'You have played the free match of the web demo. The full game on iPhone and Android has every rival, full matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(4,18,36,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,18,36,${a})`); g.addColorStop(1, `rgba(4,18,36,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,18,36,0)'); g.addColorStop(1, 'rgba(4,18,36,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(220,240,255,0.92)'; ctx.fill();
    ctx.fillStyle = '#16293b'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(220,240,255,0.92)'; ctx.fill();
    ctx.fillStyle = '#16293b'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(220,240,255,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The attract pond behind the menus: a pond layout object { cx, cy, s, rot } and the little game state.att.
const attractPond = (ctx, state, L0) => drawPond(ctx, L0, state.att.w, state.att.parts, { t: state.t, trails: state.att.trails });
const pondPortrait = (state, s, cy) => ({ cx: W / 2, cy, s, rot: 0 });

function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(4,18,36,0.66)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const oy = fr.oy, hs = heroScaleFor(state);
    attractPond(ctx, state, pondPortrait(state, Math.min(1.15, (W - 16) / 610), H * 0.47));
    scrim(ctx, 0.2);
    const g = ctx.createRadialGradient(W / 2, 220 + oy, 40, W / 2, 220 + oy, 400);
    g.addColorStop(0, 'rgba(4,18,36,0.6)'); g.addColorStop(1, 'rgba(4,18,36,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700 + oy);
    void hs;
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(220,240,255,0.7)';
    if (state.demo) ctx.fillText('Web demo', W / 2, H - 4 - host.b);
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0, k = Math.min(1, hw / 640);
  attractPond(ctx, state, { cx: W / 2, cy: H / 2, s: Math.min(1.0, (H - 20) / 692, (W - 20) / 992), rot: Math.PI / 2 });
  scrim(ctx, 0.35);
  const g = ctx.createRadialGradient(hx, 200, 40, hx, 200, 360);
  g.addColorStop(0, 'rgba(4,18,36,0.6)'); g.addColorStop(1, 'rgba(4,18,36,0)');
  ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 600);
  ctx.save(); ctx.translate(hx, Math.max(host.t, 0) - 20 * k + 40); ctx.scale(k, k);
  heroArt().draw(ctx, 0); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(220,240,255,0.7)';
  if (state.demo) ctx.fillText('Web demo', hx, H - 8 - host.b);
}

const backdrop = (ctx, state, a) => {
  attractPond(ctx, state, land() ? { cx: W / 2, cy: H / 2, s: Math.min(1.0, (H - 20) / 692, (W - 20) / 992), rot: Math.PI / 2 } : pondPortrait(state, Math.max(0.55, 0.92 * Math.min(1, (H - 40) / 1100)), H / 2));
  scrim(ctx, a);
};
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.72);
  const fr = drawFlowScreen(ctx, state, 'setup');
  const pins = fr.pins;
  if (!land()) {
    const g = ctx.createLinearGradient(0, H - 180, 0, H);
    g.addColorStop(0, 'rgba(4,18,36,0)'); g.addColorStop(0.2, 'rgba(4,18,36,0.88)'); g.addColorStop(1, 'rgba(4,18,36,0.96)');
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
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(12,36,60,0.94)', stroke: 'rgba(190,225,250,0.55)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(244,249,252,0.975)', stroke: 'rgba(40,80,110,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,80,110,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 300 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(40,80,110,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 250); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 238, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(40,80,110,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(40,80,110,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f2faff'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y);
  ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function tag(ctx, t, x, y, col = '#ffffff', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 18;
  roundPath(ctx, x - tw / 2, y - size * 0.82, tw, size * 1.6, size * 0.75); ctx.fillStyle = 'rgba(8,28,50,0.82)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col, wd) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), hl = wd * 3.4;
  ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * wd, y1 + Math.sin(a) * wd); ctx.lineTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5)); ctx.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
}
const person = (side, idx, x, y, face = 0, extra = {}) => ({ kind: 'skater', side, idx, x, y, face, vx: 0, vy: 0, glide: 0, swing: 0, hit: 0, id: `a${side}${idx}`, ...extra });
const people = (ctx, list, t = 0) => { for (const b of list.slice().sort((a, c) => a.y - c.y)) drawSkater(ctx, b, t, b.o ?? {}); };
const pk = (x, y) => ({ x, y, vx: 0, vy: 0 });
const DRIFT = { x: 0, y: -150, r: 74, seed: 12 };

export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  const rot = Math.PI / 2, whole = { rot, s: Math.min(w / 1010, h / 614) };
  const kick = [[-118, 150], [118, 150], [0, 330]];
  const lineup = () => [...kick.map(([px, py], i) => person(0, i, px, py, -Math.PI / 2)), ...kick.map(([px, py], i) => person(1, i, -px, -py, Math.PI / 2))];
  const A = {
    hero() {
      miniPond(ctx, 0, 0, w, h, () => { people(ctx, lineup()); drawPuck(ctx, pk(0, 0), 0); }, { ...whole });
    },
    pull() {
      const sk = person(0, 0, -100, 200, -1.15, { o: { ring: '#ffffff', ringA: 0.9 } });
      const m = miniPond(ctx, 0, 0, w, h, () => {
        people(ctx, [sk, person(0, 1, 130, 230, -1.5), person(1, 0, 90, -170, 1.5), person(1, 1, -120, -230, 1.5)]);
        drawPuck(ctx, pk(-30, 40), 0);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-100, 200); ctx.lineTo(-62, 320); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(-62, 320, 20, 0, TAU); ctx.fill();
        ctx.setLineDash([3, 16]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-100, 200); ctx.lineTo(-34, 56); ctx.stroke();
        ctx.setLineDash([14, 14]); ctx.strokeStyle = '#ffc43c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-30, 40); ctx.lineTo(10, -300); ctx.stroke(); ctx.setLineDash([]);
      }, { rot, s: Math.min(w / 640, h / 520) * 0.98, focus: [-30, -20] });
      const a = m.P(-62, 330), b = m.P(-80, 110), c = m.P(10, -300);
      tag(ctx, 'pull back', a.x + 56, a.y - 6, '#ffffff', 17);
      tag(ctx, 'skater glides', b.x, b.y - 52, '#bfe6ff', 17);
      tag(ctx, 'puck goes here', c.x - 20, c.y + 52, '#ffc43c', 17);
    },
    goal() {
      const m = miniPond(ctx, 0, 0, w, h, () => {
        people(ctx, [person(0, 0, -60, -250, -1.3), person(1, 2, 100, -300, 2.4)]);
        drawPuck(ctx, pk(18, -420), 0);
        ctx.setLineDash([12, 12]); ctx.strokeStyle = '#ffc43c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-40, -290); ctx.lineTo(16, -436); ctx.stroke(); ctx.setLineDash([]);
      }, { rot, s: Math.min(w / 420, h / 360) * 0.95, focus: [0, -340] });
      const a = m.P(-GOAL_HW, -HH), b = m.P(GOAL_HW, -HH);
      tag(ctx, 'whole puck over the line', (a.x + b.x) / 2 - 150, (a.y + b.y) / 2 - 62, '#ffffff', 17);
      tag(ctx, 'between the posts', (a.x + b.x) / 2 - 150, (a.y + b.y) / 2 + 62, '#ffe08a', 17);
    },
    turns() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#d3e4ef'; ctx.fill(); ctx.strokeStyle = 'rgba(40,80,110,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      const cells = [['You shoot', 0], ['Everything slides', 2], ['Rival shoots', 1]];
      const cw = (w - 40) / 3;
      cells.forEach(([t, kind], i) => {
        const cx = 20 + cw * i + cw / 2;
        if (kind === 2) { ctx.strokeStyle = '#2f78b5'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx - 40 + k * 8, h / 2 - 28 + k * 22); ctx.lineTo(cx + 36 + k * 8, h / 2 - 28 + k * 22); ctx.stroke(); } drawPuck(ctx, pk(cx + 44, h / 2 - 2), 0); }
        else drawSkater(ctx, person(kind, 0, cx, h / 2 - 10, kind === 0 ? -0.6 : 0.6), 0, {});
        ctx.fillStyle = '#16293b'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, cx, h - 44);
        if (i < 2) arrow(ctx, 20 + cw * (i + 1) - 18, h / 2 - 10, 20 + cw * (i + 1) + 18, h / 2 - 10, '#c8372d', 5);
      });
      ctx.fillStyle = '#4a6076'; ctx.font = `400 19px ${FONT}`; ctx.fillText('then the other side shoots', w / 2, h - 16);
    },
    snow() {
      const m = miniPond(ctx, 0, 0, w, h, () => {
        people(ctx, [person(0, 0, -100, 230, -1.3)]);
        drawSnow(ctx, DRIFT, 0);
        ctx.setLineDash([3, 16]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-100, 230); ctx.lineTo(-10, -90); ctx.stroke(); ctx.setLineDash([]);
        drawPuck(ctx, pk(110, -150), 0);
      }, { rot, s: Math.min(w / 700, h / 500), focus: [0, -20] });
      const p = m.P(DRIFT.x, DRIFT.y), q = m.P(-100, 230);
      tag(ctx, 'loose snow slows you', p.x, p.y - 108, '#ffffff', 17);
      tag(ctx, 'bare ice: fast', q.x + 30, q.y + 60, '#bfe6ff', 17);
    },
    pond() {
      const m = miniPond(ctx, 0, 0, w, h, () => { people(ctx, lineup()); drawPuck(ctx, pk(0, 0), 0); }, { ...whole, snow: [{ x: 120, y: -230, r: 60, seed: 4 }] });
      const yg = m.P(0, 520), rg = m.P(0, -520), sb = m.P(-HW, 20), sn = m.P(120, -230);
      tag(ctx, 'your goal', yg.x + 6, yg.y - 52, '#ff9a8a', 16);
      tag(ctx, 'rival goal', rg.x - 6, rg.y - 52, '#8ecbff', 16);
      tag(ctx, 'snowbank', sb.x - 150, sb.y + 20, '#ffffff', 16);
      tag(ctx, 'snow drift', sn.x - 10, sn.y + 40, '#ffffff', 16);
    },
    bank() {
      const m = miniPond(ctx, 0, 0, w, h, () => {
        people(ctx, [person(0, 0, -80, 220, -0.7), person(1, 1, 90, -270, 2.4)]);
        drawPuck(ctx, pk(-10, 60), 0);
        ctx.setLineDash([14, 14]); ctx.strokeStyle = '#ffc43c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-10, 60); ctx.lineTo(HW - 14, -110); ctx.lineTo(10, -440); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(HW - 14, -110, 22, 0, TAU); ctx.stroke();
      }, { rot, s: Math.min(w / 640, h / 540), focus: [60, -150] });
      const b = m.P(HW - 14, -110);
      tag(ctx, 'bounces off the bank', b.x - 130, b.y - 20, '#ffffff', 17);
    },
    strike() {
      miniPond(ctx, 0, 0, w, h, () => {
        people(ctx, [person(0, 0, -60, 70, -1.25, { swing: 0.7 })]);
        drawPuck(ctx, pk(-14, -10), 0);
        arrow(ctx, -60, 70, -22, 0, '#ffffff', 5);
        arrow(ctx, -14, -10, 18, -110, '#ffc43c', 6);
      }, { rot, s: Math.min(w / 330, h / 300), focus: [-30, 10] });
      tag(ctx, 'aim just behind the puck', w / 2, h - 24, '#ffffff', 17);
    },
  };
  (A[key] ?? A.hero)();
  ctx.restore();
}
void HW; void CORNER; void LOOKS; void state_unused;
function state_unused() {}
