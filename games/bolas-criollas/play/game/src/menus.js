// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit, and the scrolling About / How to
// Play / Rules reader with its illustrations (drawn with the game's own balls and sand). Pure drawing; game.js owns state.
// Every position comes from the live layout L (layout.js).
import { COURT, COURT_IDS, COURTS, STYLES, theMingo } from './sim.js';
import { makeView, drawGround, drawBoards, drawBall, ballIcon, TEAM, MINGO } from './art.js';
import { drawCourtView } from './view.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, embossText, flowLayout, drawFlow, flowHit } from './ui.js';
import { v3 } from './v3.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawLockup, drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;
const COURT_LABEL = { clay: 'Packed Earth', soft: 'Soft Sand', coast: 'Coast Court', daily: 'Daily Court' };
const COURT_NOTE = { clay: COURTS.clay.note, soft: COURTS.soft.note, coast: COURTS.coast.note, daily: 'A new mix of patches every day.' };

// ---- flow screens ------------------------------------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const heroArt = (h = 400) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640, h / 380); ctx.scale(s, s);
    const cx = w / s / 2;
    embossText(ctx, 'Bolas', cx, 140, 128, { top: '#ffffff', bottom: '#ffe3a6', bottom2: '#e8b65a', side: '#8a4a1c', edge: '#3a1606' });
    embossText(ctx, 'Criollas', cx, 238, 92, { top: '#fff0c0', bottom: '#ffc857', bottom2: '#e08a1c', side: '#7a3a10', edge: '#3a1606' });
    ctx.font = `700 26px ${FONT}`; textShadow(ctx, 'THE SAND-COURT GAME OF VENEZUELA', cx, 286, '#ffe9c8', 8);
    if (!v3.on) { ballIcon(ctx, cx - 90, 346, 30, 0); ballIcon(ctx, cx, 346, 30, 1); ballIcon(ctx, cx + 80, 350, 13, -1); }
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false) {
  const hero = heroArt(compact === 2 ? 270 : compact ? 330 : 400);
  return [
    hero,
    { t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 },
    { t: 'btn', id: 'two', label: 'Two Players', h: 84 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'two rivals play; see why', h: 84 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: 76 }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: 76 },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: 76 }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: 76 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', dark: true, h: 70 },
  ];
}

export function setupParts(state, wide) {
  const s = state.setup, two = s.mode === 'two';
  const head = [{ t: 'h', label: two ? 'Two Players' : 'Play vs Computer', size: 40 }];
  const rivals = [{ t: 'h', label: 'Your rival', size: 30 }, ...PROFILES.map((p, i) => ({ t: 'btn', id: `opp${i}`, label: p.name, sub: `${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}  ${p.tag}`, active: s.opp === i, disabled: state.demo && i > 1, hitDisabled: true, h: 84 }))];
  const courts = [{ t: 'h', label: 'The cancha', size: 30 }, ...COURT_IDS.map((c) => ({ t: 'btn', id: `crt${c}`, label: COURT_LABEL[c], sub: COURT_NOTE[c], active: s.court === c, disabled: state.demo && c !== 'clay', hitDisabled: true, h: 84 }))];
  const length = [{ t: 'h', label: 'Match length', size: 30 },
    { t: 'btn', id: 'len12', label: 'First to 12', active: s.target === 12, h: 80, row: 7 }, { t: 'btn', id: 'len6', label: 'Quick: 6', active: s.target === 6, h: 80, row: 7 }];
  if (state.setupMsg) length.push({ t: 'p', label: state.setupMsg, size: 24, color: '#ffd27a', bold: true });
  if (state.demo) length.push({ t: 'p', label: 'The web demo plays three ends against the first two rivals on Packed Earth.', size: 22 });
  return { head, rivals: two ? [] : rivals, courts, length };
}
export function setupWidgets(state) { const p = setupParts(state, false); return [...p.head, ...p.rivals, ...p.courts, ...p.length]; }

export function settingsParts(state) {
  const st = state.settings;
  const a = [
    { t: 'h', label: 'Settings', size: 42 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: on' : 'Sound: off', active: st.sound, h: 80 },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Guide path: shown' : 'Guide path: hidden', sub: 'show the flight line of your throw', active: st.calm, h: 92 },
    { t: 'btn', id: 'set-slow', label: st.slow ? 'Swing meter: slow' : 'Swing meter: normal', sub: 'a slower needle is easier to time', active: st.slow, h: 92 },
    { t: 'p', label: `Text size ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, size: 26, bold: true },
    { t: 'btn', id: 'txt-dec', label: 'Smaller text', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'txt-inc', label: 'Larger text', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time ${THINK_STEPS[st.thinkIdx]} s`, size: 26, bold: true },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 2, disabled: st.thinkIdx === 0, h: 76 }, { t: 'btn', id: 'think-inc', label: 'Longer', row: 2, disabled: st.thinkIdx === THINK_STEPS.length - 1, h: 76 },
    { t: 'gap', h: 10 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked. Thank you!', size: 24, bold: true }] : [
      { t: 'btn', id: 'restore', label: 'Restore purchase', h: 80 },
      ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 22 }] : []),
    ]),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 88 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

const trophyArt = (win, h) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.translate(w / 2, h / 2);
    const g = ctx.createRadialGradient(0, -10, 6, 0, 0, 90);
    g.addColorStop(0, win ? '#fff0a8' : '#d8d0f0'); g.addColorStop(1, win ? '#e09a1c' : '#6a5a98');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,80,0.55)'; ctx.font = `700 78px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(win ? '★' : '·', 0, 4);
    ctx.restore();
  },
});
export function resultParts(state, wide) {
  const m = state.m, c = m.cfg, win = m.over && m.over.win === 0;
  const two = c.mode === 'two', watch = c.mode === 'watch';
  const winner = m.over ? state.labels[m.over.win].name : '';
  const title = two || watch ? `${winner} wins` : win ? 'You win!' : `${winner} wins`;
  const words = [
    trophyArt(win || two || watch, 150),
    { t: 'h', label: title, size: 54, cap: 1.4 },
    { t: 'p', label: `${m.scores[0]} – ${m.scores[1]}  after ${m.history.length} ${m.history.length === 1 ? 'end' : 'ends'}`, size: 34, bold: true },
  ];
  if (m.over && m.over.shutout && win && !two && !watch) words.push({ t: 'p', label: 'A clean sweep: they never scored.', size: 26 });
  if (c.mode === 'ai') words.push({ t: 'p', label: `Wins against ${PROFILES[c.opp].name}: ${state.record.wins[c.opp]}  ·  streak ${state.record.streak}`, size: 24 });
  const btns = [
    { t: 'btn', id: 'again', label: 'Play again', primary: true, h: 92 },
    { t: 'btn', id: 'new', label: 'New setup', h: 80 },
    { t: 'btn', id: 'menu', label: 'Main menu', h: 80 },
  ];
  return { words, btns };
}
export function resultWidgets(state) { const p = resultParts(state, false); return [...p.words, ...p.btns]; }

export function pauseWidgets(state) {
  return [
    { t: 'h', label: 'Paused', size: 46 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 92 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 1, h: 76 }, { t: 'btn', id: 'p-howto', label: 'How to Play', row: 1, h: 76 },
    { t: 'btn', id: 'p-sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', row: 2, h: 76 },
    { t: 'btn', id: 'p-calm', label: state.settings.calm ? 'Guide path: on' : 'Guide path: off', row: 2, h: 76 },
    { t: 'btn', id: 'quit', label: 'Leave match', dark: true, h: 80 },
  ];
}
export function demoLimitWidgets(wide) {
  return [
    { t: 'h', label: 'That was the free preview', size: 40 },
    { t: 'p', label: 'The web demo plays three ends. The full game for iPhone and Android has every rival, every cancha and the Daily Court, with no limits.', size: 26 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true, h: 90 },
  ];
}

// ---- layout of columns --------------------------------------------------------------------------------------------------------
const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = (w * 327) / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const wd = titleWidgets(state, L.wide ? 0 : L.sb < 1000 ? 2 : L.sb < 1100 ? 1 : 0), strip = lockSize(L).strip;
    if (!L.wide) return one(wd, 640, I.t, L.sb - strip).map((c) => ({ ...c, center: true, shift: L.sb < 1000 ? 14 : -Math.round(L.sb * 0.025) }));
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state), 640, I.t + 18).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), two = state.setup.mode === 'two', cols = L.setup.cols;
    if (two) return [{ widgets: [...p.head, ...p.courts], ...cols[0] }, { widgets: p.length, ...cols[1] }, { widgets: [], ...cols[2] }];
    return [{ widgets: p.rivals, ...cols[0] }, { widgets: [...p.head, ...p.courts], ...cols[1] }, { widgets: p.length, ...cols[2] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state), 640, I.t + 18);
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
  if (key === 'demolimit') return one(demoLimitWidgets(L.wide)).map((c) => ({ ...c, center: true }));
  if (key === 'result') {
    if (!L.wide) return one(resultWidgets(state), 640, I.t + 12).map((c) => ({ ...c, center: true }));
    const p = resultParts(state, true), cw = Math.min(480, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 40;
    return [{ widgets: p.words, x: w / 4 - cw / 2, w: cw, top, bottom: bot, center: true }, { widgets: p.btns, x: (3 * w) / 4 - Math.min(440, cw) / 2, w: Math.min(440, cw), top, bottom: bot, center: true }];
  }
  return [];
}
function layColumns(ctx, state, key, L) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cols = screenCols(state, key, L).map((c) => ({ ...c, lay: flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w }) }));
  let max = 0;
  for (const c of cols) { c.off = c.center ? Math.max(0, (c.bottom - c.top - c.lay.contentH) / 2) + (c.shift ?? 0) : 0; max = Math.max(max, c.lay.contentH - (c.bottom - c.top)); }
  const out = { key, size: L.key, cols, max: Math.max(0, max) };
  if (key === 'title') {
    const ls = lockSize(L), bc = cols[cols.length - 1], used = bc.top + bc.off + bc.lay.contentH, cx = L.wide ? (3 * L.w) / 4 : L.w / 2;
    const pinned = L.sb - ls.h - 12, y = L.wide ? Math.min(used + 12, pinned) : pinned, mm = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, mm), th = Math.max(ls.h + 12, mm);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
export function ensureLayout(state, key, L) {
  if (LAID.key === key && LAID.size === L.key && LAID.cols.length) return;
  if (!['title', 'setup', 'settings', 'result', 'demolimit'].includes(key)) return;
  LAID = { ...layColumns(estCtx, state, key, L), est: true };
}
export function hitScreen(x, y, scroll) {
  { const t = LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  for (const c of LAID.cols) {
    const id = flowHit(c.lay, c.top + c.off, Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top))), x, y);
    if (id && y >= c.top && y <= c.bottom) return id;
  }
  return null;
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function flowRects(scroll) {
  const out = [];
  for (const c of LAID.cols) {
    const sc = Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top)));
    for (const it of c.lay.items) if (it.w.t === 'btn') out.push({ id: it.w.id, x: it.x, y: c.top + c.off + it.y - sc, w: it.wd, h: it.h, clip: { top: c.top, bottom: c.bottom } });
  }
  return out;
}

// ---- backdrop: the dusk court with the attract game rolling ---------------------------------------------------------------------
function backdrop(ctx, L, state) {
  if (v3.on) {   // the lit 3D scene is behind this canvas: leave it clear (reader pages get a plain night backdrop)
    if (state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules') {
      const g = ctx.createLinearGradient(0, 0, 0, L.h); g.addColorStop(0, '#2a1d5a'); g.addColorStop(1, '#150e36');
      ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
    } else ctx.clearRect(0, 0, L.w, L.h);
    return;
  }
  const w = state.att.w, k = theMingo(w), rect = { x: 0, y: 0, w: L.w, h: L.h };
  const kx = Math.min(L.w / 5.2, (L.h * (L.wide ? 0.4 : 0.3)) / 3 / 0.85), ky = kx * 0.85;
  const yFar = L.h * (L.wide ? 0.42 : 0.46);
  const V = makeView(rect, { uc: k ? k.x : 10, cx: L.w / 2, kx, ky, kz: ky * 0.95, yFar, taper: 0.06, minR: 3 });
  const fake = { t: state.t, parts: state.att.parts };
  ctx.save(); ctx.fillStyle = '#150e36'; ctx.fillRect(0, 0, L.w, L.h);
  drawCourtView(ctx, V, fake, w, { noClip: true, detail: true, radius: 0 });
  ctx.restore();
  // foreground apron of trodden sand under the near board, fading into night
  const y0 = yFar + ky * 3 + 0.5 * ky * 0.95 * 0.92 - 2;
  const g = ctx.createLinearGradient(0, y0, 0, L.h);
  g.addColorStop(0, '#6a3a20'); g.addColorStop(0.35, '#3a2230'); g.addColorStop(1, '#150e36');
  ctx.fillStyle = g; ctx.fillRect(0, y0, L.w, L.h - y0);
}
function scrim(ctx, L, a = 0.5) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(12,6,34,${a * 0.5})`); g.addColorStop(0.5, `rgba(12,6,34,${a})`); g.addColorStop(1, `rgba(12,6,34,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(12,6,34,0)'); g.addColorStop(1, 'rgba(12,6,34,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,243,220,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,243,220,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, L) {
  LAID = layColumns(ctx, state, key, L);
  const scroll = Math.min(state.ui.scroll, LAID.max);
  for (const c of LAID.cols) {
    const range = Math.max(0, c.lay.contentH - (c.bottom - c.top)), sc = Math.min(scroll, range), top = c.top + c.off;
    drawFlow(ctx, c.lay, top, c.bottom, sc, { clipX: c.x - 24, clipW: c.w + 48 });
    if (range > 0) {
      const th = Math.max(60, (c.bottom - c.top) * ((c.bottom - c.top) / c.lay.contentH)), ty = c.top + (sc / range) * (c.bottom - c.top - th);
      roundPath(ctx, c.x + c.w + 6, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,248,224,0.5)'; ctx.fill();
      scrollHint(ctx, c.top, c.bottom, sc, range, c.x, c.w);
    }
  }
}

export function renderTitle(ctx, state, L) {
  backdrop(ctx, L, state);
  scrim(ctx, L, v3.on ? 0.26 : 0.42);
  drawFlowScreen(ctx, state, 'title', L);
  const lk = LAID.lock;
  if (lk) drawLockup(ctx, lk.cx, lk.y, lk.w, 0.92);
}
export function renderSetup(ctx, state, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'setup', L);
  drawButton(ctx, L.pins.start, 'Start', { primary: true, size: 36 });
  drawButton(ctx, L.pins.back, 'Back', { size: 32 });
}
export function renderSettings(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.66); drawFlowScreen(ctx, state, 'settings', L); }
export function renderResult(ctx, state, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'result', L);
  drawMoreLine(ctx, L.w / 2, L.sb - 14, 20);
}
export function renderDemoLimit(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.66); drawFlowScreen(ctx, state, 'demolimit', L); }
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.6);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(30,20,70,0.95)', stroke: 'rgba(255,214,150,0.5)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}

// ---- reference pages (one continuous scrolling reader) ----------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => 1;
function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80, secFs = Math.round(34 * Math.min(scale, 1.3));
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
export function renderPages(ctx, state, list, header, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.72);
  const PANEL = L.ref.panel, sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(70,50,100,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.coralDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(90,60,120,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(90,60,120,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.coralDark; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, (viewH * viewH) / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(90,60,120,0.15)'; roundPath(ctx, PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(90,60,120,0.55)'; roundPath(ctx, PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,90,0.75)';
  ctx.fillText(`text ${Math.round(sc * 100)}%`, pcx, PANEL.y + PANEL.h - 28);
  drawButton(ctx, L.ref.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, L.ref.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, L.ref.back, 'Back', { size: 32 });
  drawButton(ctx, L.ref.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations -----------------------------------------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function sandStrip(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#c58a5a'); g.addColorStop(1, '#efc98f');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#8a4a26'; ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.coralDark, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    balls() {
      sandStrip(ctx, 0, 0, w, h);
      ballIcon(ctx, w * 0.2, h * 0.46, 40, 0); ballIcon(ctx, w * 0.5, h * 0.46, 40, 1); ballIcon(ctx, w * 0.8, h * 0.5, 16, -1);
      label(ctx, TEAM[0].name, w * 0.2, h - 22, 22); label(ctx, TEAM[1].name, w * 0.5, h - 22, 22); label(ctx, 'Mingo', w * 0.8, h - 22, 22);
    },
    court() {
      sandStrip(ctx, 0, 0, w, h);
      const x0 = 24, x1 = w - 24, k = (x1 - x0) / COURT.len, cy = h * 0.5;
      ctx.fillStyle = 'rgba(20,179,167,0.25)'; ctx.fillRect(x0 + COURT.zoneA * k, 18, (COURT.zoneB - COURT.zoneA) * k, h - 36);
      ctx.fillStyle = '#fffbe9'; ctx.fillRect(x0 - 3, 18, 6, h - 36);
      ctx.fillStyle = '#a02828'; ctx.fillRect(x1 - 3, 18, 8, h - 36);
      ballIcon(ctx, x0 + 11 * k, cy - 6, 8, -1);
      label(ctx, 'throw line', x0 + 4, h - 26, 17, C.ink, 'left'); label(ctx, 'mingo zone 8 to 13 m', x0 + 10.5 * k, 40, 17); label(ctx, 'dead line', x1 - 4, h - 26, 17, '#7a1c1c', 'right');
      label(ctx, 'side boards in play', w / 2, 12 + 12, 16, '#5c2a14');
    },
    styles() {
      sandStrip(ctx, 0, 0, w, h);
      const x0 = 36, x1 = w - 36, gy = h * 0.74;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, gy - 24); ctx.lineTo(x1 - 40, gy - 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, gy - 30); ctx.quadraticCurveTo((x0 + x1) / 2, 4, x1 - 120, gy - 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, gy - 34); ctx.quadraticCurveTo((x0 + x1) / 2, gy - 60, x1 - 10, gy - 22); ctx.stroke();
      ctx.setLineDash([]);
      ballIcon(ctx, x1, gy - 12, 12, -1);
      label(ctx, 'Roll', x0 + 70, gy + 4, 20, '#3a1c0a'); label(ctx, 'Lob', (x0 + x1) / 2 - 20, 38, 20, '#3a1c0a'); label(ctx, 'Shot', (x0 + x1) / 2 + 40, gy - 70, 20, '#3a1c0a');
    },
    swing() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#241a55'; ctx.fill();
      const bx = 30, bw = w - 60, by = h * 0.4, bh = 34;
      roundPath(ctx, bx, by, bw, bh, 17); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
      roundPath(ctx, bx + bw * 0.46, by - 3, bw * 0.16, bh + 6, 20); ctx.fillStyle = '#35e089'; ctx.fill();
      const nx = bx + bw * 0.3;
      ctx.fillStyle = '#fff'; ctx.fillRect(nx - 3, by - 8, 6, bh + 16);
      arrow(ctx, nx, by - 24, nx + bw * 0.1, by - 24, '#ffd27a', 4);
      label(ctx, 'early: lands short', bx + bw * 0.16, by + bh + 34, 20, '#ffd9c8'); label(ctx, 'in the green: lands on the ring', bx + bw * 0.54, by - 36, 20, '#9affc4'); label(ctx, 'late: carries long', bx + bw * 0.86, by + bh + 34, 20, '#ffd9c8');
    },
    score() {
      sandStrip(ctx, 0, 0, w, h);
      const cx = w * 0.46, cy = h * 0.5;
      ctx.strokeStyle = 'rgba(60,24,10,0.35)'; ctx.lineWidth = 2;
      for (const r of [40, 80, 120]) { ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.3, r * 0.8, 0, 0, TAU); ctx.stroke(); }
      ballIcon(ctx, cx, cy, 11, -1); ballIcon(ctx, cx - 58, cy - 12, 24, 0); ballIcon(ctx, cx + 76, cy + 22, 24, 1); ballIcon(ctx, cx - 120, cy + 28, 24, 0); ballIcon(ctx, cx + 138, cy - 30, 24, 1);
      label(ctx, 'closest: 1 point', cx - 62, cy - 42, 18, '#1b5a2a'); label(ctx, 'rival best', cx + 90, cy + 62, 18, '#7a1c1c');
    },
    patches() {
      const V = makeView({ x: 0, y: 0, w, h }, { uc: 5, cx: w / 2, kx: w / 9, ky: h / 4.2, kz: h / 4.8, yFar: h * 0.1, taper: 0.04 });
      ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
      ctx.fillStyle = '#6b3c22'; ctx.fillRect(0, 0, w, h);
      drawGround(ctx, V, { mu: 0.2, patches: [{ kind: 'loose', u: 3, v: 0, ru: 1.5, rv: 1.2 }, { kind: 'hard', u: 7, v: 0, ru: 1.5, rv: 1.2 }] }, { detail: true });
      ctx.restore();
      label(ctx, 'loose sand: heavy, buries a ball', w * 0.27, h - 12, 18, '#fff3dc'); label(ctx, 'hard-packed: slick, lively', w * 0.74, h - 12, 18, '#fff3dc');
    },
    aim() {
      sandStrip(ctx, 0, 0, w, h);
      const cx = w * 0.62, cy = h * 0.5;
      ballIcon(ctx, cx, cy, 10, -1);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx - 40, cy + 6, 34, 18, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ff7a4d'; ctx.beginPath(); ctx.ellipse(cx - 40, cy + 6, 18, 9, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([3, 8]); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(30, h * 0.7); ctx.quadraticCurveTo(cx - 140, h * 0.1, cx - 40, cy + 6); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'aim ring', cx - 40, cy + 50, 20, '#3a1c0a');
    },
  };
  (A[key] ?? A.balls)();
  ctx.restore();
}
export { drawBall, drawBoards, STYLES, MINGO };
