// Every screen that is not the play screen: title, setup, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own boule, jack
// and slingshot art). Pure drawing; game.js owns state. Every position comes from the live layout L (layout.js).
import { LANE, JACK_ZONE, LOFTS } from './sim.js';
import { drawBoule, drawJack, palOf, PAL, TEAM } from './art.js';
import { worldBackdrop, drawLoading } from './view.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PRESET_IDS, presetName } from './sim.js';
import { drawLockup, drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;
const NZ = [0.35, 0.25, 0.9];

// ---- flow screens ------------------------------------------------------------------------------
// A screen is one or more columns of widgets (flowLayout). `cols` are described by screenCols(); LAID keeps the laid-out
// result for hit-testing and scrolling (one shared scroll offset; each column clamps it to its own range).
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const heroArt = (h = 520) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    ctx.font = `700 96px ${FONT}`; const w1 = ctx.measureText('Jack ').width, w3 = ctx.measureText(' Boule').width;
    ctx.font = `italic 400 70px ${FONT}`; const w2 = ctx.measureText('&').width;
    const tot = w1 + w2 + w3, x0 = cx - tot / 2;
    ctx.font = `700 96px ${FONT}`; textShadow(ctx, 'Jack ', x0, 150, '#fff3d6', 14);
    ctx.font = `italic 400 70px ${FONT}`; textShadow(ctx, '&', x0 + w1, 146, '#ffcf7a', 10);
    ctx.font = `700 96px ${FONT}`; textShadow(ctx, ' Boule', x0 + w1 + w2, 150, '#fff3d6', 14);
    ctx.textAlign = 'center';
    ctx.font = `400 28px ${FONT}`; textShadow(ctx, 'Pétanque de Provence', cx, 206, '#ffe9bf', 6);
    ctx.strokeStyle = 'rgba(255,233,191,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 170, 232); ctx.lineTo(cx - 24, 232); ctx.moveTo(cx + 24, 232); ctx.lineTo(cx + 170, 232); ctx.stroke();
    drawJack(ctx, cx, 232, 8);
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false) {
  const sound = state.settings.sound;
  const wd = [heroArt(compact ? 290 : 520)];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: compact ? 80 : 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 });
  return wd;
}

// setup widget groups: head, rivals, pitches, length
export function setupParts(state, wide) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  const rivals = [];
  if (s.mode !== 'two') {
    rivals.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      rivals.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: wide ? 80 : 92 });
    });
  }
  const pitches = [{ t: 'p', label: 'Choose the pitch', bold: true, color: '#ffe9bf', size: 26 }];
  PRESET_IDS.forEach((id, i) => {
    const locked = demo && id !== 'village';
    const sub = { village: 'Flat, packed gravel under plane trees', port: 'Loose sand and a cross slope', oliviers: 'Rolling bumps and stones', colline: 'Fast clay, slopes and stones', daily: 'A new pitch every day' }[id];
    pitches.push({ t: 'btn', id: `pit${id}`, label: presetName(id), sub: locked ? 'In the full game' : sub, active: s.pitch === id && !locked, disabled: locked, hitDisabled: true, ...(wide ? { h: 76 } : {}) });
  });
  const length = [{ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'len13', label: 'To 13 points', row: 9, active: s.target === 13 },
    { t: 'btn', id: 'len7', label: 'Quick: to 7', row: 9, active: s.target === 7 }];
  return { head, rivals, pitches, length };
}
export function setupWidgets(state) {
  const p = setupParts(state, false);
  return [...p.head, ...p.rivals, ...p.pitches, ...p.length, { t: 'gap', h: 24 }];
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'Bigger jack ring and a full path preview', active: st.calm },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

// result widget groups: the words, the buttons
export function resultParts(state, wide) {
  const m = state.m, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${PROFILES[winner === 0 ? (m.cfg.watchA ?? 3) : m.cfg.opp].name} wins` : winner === 0 ? 'You win!' : 'You lose';
  // At big text sizes the result is kept to one screen: tighter top gap, capped heading/paragraph growth, one merged summary line.
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const words = [{ t: 'gap', h: wide ? 6 : big ? 24 : 70 }, { t: 'h', label: title, size: 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  if (o.fanny) words.push({ t: 'p', label: winner === 0 || mode !== 'ai' ? 'Fanny! A 13 to 0 win.' : 'Fanny: a 13 to 0 loss.', bold: true, color: '#ffe9bf', size: 28, cap: big ? 2 : 3 });
  const ends = `${m.log.length} ends played on ${presetName(m.cfg.pitch)}.`;
  const rec = mode === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  words.push({ t: 'p', label: big ? `${ends} ${rec}`.trim() : ends, size: 26, cap: big ? 2 : 3 });
  if (rec && !big) words.push({ t: 'p', label: rec, size: 26 });
  const btns = [{ t: 'gap', h: wide ? 0 : 24 },
    { t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 },
    { t: 'btn', id: 'new', label: 'New match', row: 6 },
    { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true }];
  return { words, btns };
}
export function resultWidgets(state) {
  const p = resultParts(state, false);
  return [...p.words, ...p.btns, { t: 'gap', h: 30 }];
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

export function demoLimitWidgets(wide) {
  return [
    { t: 'gap', h: wide ? 40 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free ends of the web demo. The full game on iPhone and Android has every pitch, every rival and unlimited matches.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// The columns of a flow screen for layout L: [{ widgets, x, w, top, bottom, center }]
// The Arcforge lockup under the title menu: >= ~125 css px wide (aspect 1200:327), its width never beyond the button column.
const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const wd = titleWidgets(state, !L.wide && L.sb < 1100);
    const strip = lockSize(L).strip;     // room kept under the buttons for the Arcforge lockup
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.35); return one(wd, 640, Math.max(off, I.t), L.sb - strip); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), two = state.setup.mode === 'two';
    const left = two ? p.pitches : [...p.rivals, ...p.length], right = two ? p.length : p.pitches;
    return [{ widgets: left, ...L.setup.cols[0] }, { widgets: right, ...L.setup.cols[1] }];
  }
  if (key === 'settings') return one(settingsWidgets(state));
  if (key === 'demolimit') return one(demoLimitWidgets(L.wide));
  if (key === 'result') {
    if (!L.wide) return one(resultWidgets(state));
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
  if (key === 'title') {      // the lockup: right under the last button row, pinned at the bottom when the menu scrolls
    const ls = lockSize(L), bc = cols[cols.length - 1], used = bc.top + bc.off + bc.lay.contentH, cx = L.wide ? (3 * L.w) / 4 : L.w / 2;
    const pinned = L.sb - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
// A layout for the scene being updated right now, before anything has been drawn (first frame after a scene change, a
// rotation, or headless runs): same widgets, text widths estimated instead of measured.
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
// Button rectangles of the current flow screen, scroll applied (for the layout check scripts).
export function flowRects(scroll) {
  const out = [];
  for (const c of LAID.cols) {
    const sc = Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top)));
    for (const it of c.lay.items) if (it.w.t === 'btn') out.push({ id: it.w.id, x: it.x, y: c.top + c.off + it.y - sc, w: it.wd, h: it.h, clip: { top: c.top, bottom: c.bottom } });
  }
  return out;
}

function scrim(ctx, L, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(20,10,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,10,4,${a})`); g.addColorStop(1, `rgba(20,10,4,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(1, 'rgba(20,10,4,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
      roundPath(ctx, c.x + c.w + 6, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, c.top, c.bottom, sc, range, c.x, c.w);
    }
  }
  return { scroll, max: LAID.max };
}

export function renderTitle(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
  scrim(ctx, L, 0.28);
  // soft vignette behind the logo
  const vx = L.wide ? L.w / 4 : L.w / 2, vy = L.wide ? L.h / 2 : 260 + Math.round(Math.max(0, L.sb - 1280) * 0.35);
  const g = ctx.createRadialGradient(vx, vy, 40, vx, vy, 420);
  g.addColorStop(0, 'rgba(20,10,4,0.5)'); g.addColorStop(1, 'rgba(20,10,4,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  if (L.wide) {   // calm panel behind the buttons so they read over the lane
    const c = screenCols(state, 'title', L)[1], gx = ctx.createLinearGradient(c.x - 60, 0, c.x + c.w + 60, 0);
    gx.addColorStop(0, 'rgba(20,10,4,0)'); gx.addColorStop(0.25, 'rgba(20,10,4,0.4)'); gx.addColorStop(1, 'rgba(20,10,4,0.45)');
    ctx.fillStyle = gx; ctx.fillRect(c.x - 60, 0, L.w - c.x + 60, L.h);
  }
  drawFlowScreen(ctx, state, 'title', L);
  // the Arcforge lockup under the last button row; a tap opens the Arcforge home
  if (LAID.lock) {
    const k = LAID.lock, dn = !!(state.ui.drag && state.ui.drag.x0 >= k.tap.x && state.ui.drag.x0 <= k.tap.x + k.tap.w && state.ui.drag.y0 >= k.tap.y && state.ui.drag.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(20,10,4,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)';
  if (state.demo) ctx.fillText('Web demo', L.wide ? (3 * L.w) / 4 : L.w / 2, L.sb - 4);
}

export function renderSetup(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
  scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'setup', L);
  if (!L.wide) {
    const y0 = L.pins.start.y - 56, g = ctx.createLinearGradient(0, y0, 0, L.h);
    g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(0.2, 'rgba(20,10,4,0.85)'); g.addColorStop(1, 'rgba(20,10,4,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, L.w, L.h - y0);
  }
  drawButton(ctx, L.pins.start, 'Start the match', { primary: true, size: L.wide ? 28 : 32 });
  drawButton(ctx, L.pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) {
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0';
    const mx = L.wide ? L.pins.start.x + (L.pins.back.x + L.pins.back.w - L.pins.start.x) / 2 : L.w / 2;
    ctx.fillText(state.setupMsg, mx, L.pins.start.y - (L.wide ? 20 : 16));
  }
}
export function renderSettings(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
  scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'settings', L);
}
export function renderResult(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.w, [], {});
  if (!ok) return;
  scrim(ctx, L, 0.6);
  drawFlowScreen(ctx, state, 'result', L);
  const cols = LAID.cols, bcol = cols[cols.length - 1];
  // one quiet line, never over the buttons
  const maxScroll = Math.max(0, bcol.lay.contentH - (bcol.bottom - bcol.top));
  const y = L.wide ? Math.min(L.sb - 12, bcol.top + bcol.off + bcol.lay.contentH + 44) : L.sb - 22;
  if (maxScroll === 0 || L.wide) drawMoreLine(ctx, L.wide ? bcol.x + bcol.w / 2 : L.w / 2, y, 18);
}
export function renderDemoLimit(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
  scrim(ctx, L, 0.7);
  drawFlowScreen(ctx, state, 'demolimit', L);
}
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(40,26,14,0.9)', stroke: 'rgba(255,214,140,0.5)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}

// ---- reference pages (one continuous scrolling reader) -----------------------------------------
export const REF = { max: 0, view: 400 };   // published each frame: how far the body can scroll, and its height
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
export function renderPages(ctx, state, list, header, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, [], { noRing: true });
  if (!ok) return;
  scrim(ctx, L, 0.66);
  const PANEL = L.ref.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,238,214,0.96)', stroke: 'rgba(110,76,40,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(110,76,40,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(110,76,40,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.7)';
  ctx.fillText(`text ${Math.round(sc * 100)}%`, pcx, PANEL.y + PANEL.h - 28);
  drawButton(ctx, L.ref.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, L.ref.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, L.ref.back, 'Back', { size: 32 });
  drawButton(ctx, L.ref.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function groundStrip(ctx, x, y, w, h, pal = 'village') {
  const P = PAL[pal];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgb(${P.base.map((v) => Math.min(255, v + 20)).join(',')})`); g.addColorStop(1, `rgb(${P.base.map((v) => v - 18).join(',')})`);
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  let s = 7;
  for (let i = 0; i < 260; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const px = x + (s % 10000) / 10000 * w; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const py = y + (s % 10000) / 10000 * h; ctx.fillStyle = i % 3 ? 'rgba(255,244,222,0.5)' : 'rgba(70,50,32,0.4)'; ctx.beginPath(); ctx.arc(px, py, 1 + (i % 3) * 0.7, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(110,76,40,0.5)'; ctx.lineWidth = 2; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    equipment() {
      groundStrip(ctx, 0, 0, w, h);
      drawBoule(ctx, 0, w * 0.2, h * 0.5, 40, NZ); drawBoule(ctx, 1, w * 0.5, h * 0.5, 40, [0.5, 0.2, 0.8]); drawJack(ctx, w * 0.8, h * 0.5, 15);
      label(ctx, 'Your boules', w * 0.2, h - 22, 20); label(ctx, 'Rival boules', w * 0.5, h - 22, 20); label(ctx, 'Jack', w * 0.8, h - 22, 20);
    },
    sling() {
      groundStrip(ctx, 0, 0, w, h);
      const cx = w * 0.4, by = h * 0.62;
      ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 70, h * 0.78); ctx.lineTo(cx - 70, h * 0.22); ctx.moveTo(cx + 70, h * 0.78); ctx.lineTo(cx + 70, h * 0.22); ctx.stroke();
      ctx.strokeStyle = '#b8431c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 70, h * 0.22); ctx.lineTo(cx, by); ctx.lineTo(cx + 70, h * 0.22); ctx.stroke();
      drawBoule(ctx, 0, cx, by, 34, NZ);
      arrow(ctx, cx + 70, h * 0.42, cx + 150, h * 0.14, C.olive, 5); label(ctx, 'throws', cx + 180, h * 0.14 + 30, 18, C.olive);
      arrow(ctx, cx + 70, h * 0.58, cx + 22, by + 8, C.terra, 5); label(ctx, 'pull back', cx + 112, h * 0.62 + 24, 18, C.terra);
    },
    lofts() {
      groundStrip(ctx, 0, 0, w, h);
      const gy = h * 0.82, x0 = 20;
      ctx.strokeStyle = 'rgba(70,50,30,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, gy); ctx.lineTo(w - 10, gy); ctx.stroke();
      const rows = [['Roll', 0, 0], ['Half-lob', 62, 1], ['Lob', 118, 2], ['Shoot', 14, 3]];
      const cols = ['#6b7a3a', '#3f78ad', '#7c5aa0', '#c4552a'];
      rows.forEach(([nm, hgt, i]) => {
        const x1 = w * (0.26 + i * 0.22);
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 4; ctx.setLineDash([2, 8]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, gy - 8); ctx.quadraticCurveTo((x0 + x1) / 2, gy - 8 - hgt * 2, x1, gy - 8); ctx.stroke(); ctx.setLineDash([]);
        drawBoule(ctx, 0, x1, gy - 13, 13, NZ);
        label(ctx, nm, x1, gy + 30 - 4, 17, cols[i]);
      });
    },
    spins() {
      groundStrip(ctx, 0, 0, w, h);
      const cy = h * 0.5;
      [['Neutral', 0.18, 90, '#3f78ad'], ['Retro', 0.5, 36, '#7c5aa0'], ['Forward', 0.82, 130, '#6b7a3a']].forEach(([nm, fx, len, col]) => {
        const cx = w * fx - 20;
        drawBoule(ctx, 0, cx, cy - 6, 28, [0.2 + fx * 0.3, 0.3, 0.9]);
        arrow(ctx, cx + 34, cy - 6, cx + 34 + Math.min(len, w * 0.17), cy - 6, col, 5);
        label(ctx, nm, cx + 20, cy + 52, 20, col);
      });
    },
    surfaces() {
      const sw = (w - 40) / 3;
      [['Gravel', 'village', 1], ['Loose sand', 'port', 2], ['Packed clay', 'colline', 3]].forEach(([nm, pal, k], i) => {
        const sx = i * (sw + 20);
        groundStrip(ctx, sx, 0, sw, h - 44, pal);
        if (k === 2) { ctx.fillStyle = 'rgba(244,232,200,0.55)'; roundPath(ctx, sx, 0, sw, h - 44, 16); ctx.fill(); }
        if (k === 3) { ctx.fillStyle = 'rgba(120,80,50,0.4)'; roundPath(ctx, sx, 0, sw, h - 44, 16); ctx.fill(); }
        drawBoule(ctx, 0, sx + sw / 2, (h - 44) / 2, 24, NZ);
        label(ctx, nm, sx + sw / 2, h - 14, 20);
      });
    },
    score() {
      groundStrip(ctx, 0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.5;
      ctx.strokeStyle = 'rgba(255,246,226,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      [[-120, -10, 0], [90, 14, 0], [-30, 50, 1]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke(); });
      ctx.setLineDash([]);
      drawBoule(ctx, 0, cx - 120, cy - 10, 26, NZ); drawBoule(ctx, 0, cx + 90, cy + 14, 26, [0.4, 0.4, 0.8]); drawBoule(ctx, 1, cx - 30, cy + 50, 26, [0.2, 0.5, 0.8]);
      drawJack(ctx, cx, cy, 13);
      label(ctx, '1', cx - 120, cy - 44, 22, '#fff6e2'); label(ctx, '3', cx + 90, cy - 20, 22, '#fff6e2'); label(ctx, '2', cx - 30, cy + 98, 22, '#fff6e2');
    },
    zone() {
      groundStrip(ctx, 0, 0, w, h);
      const cx = w / 2;
      ctx.strokeStyle = 'rgba(250,244,226,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, h - 26, 36, 12, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([8, 7]);
      [[0.6, '5 m'], [0.2, '8 m']].forEach(([f, t]) => { ctx.beginPath(); ctx.moveTo(30, h * f + 6); ctx.quadraticCurveTo(cx, h * f - 20, w - 30, h * f + 6); ctx.stroke(); label(ctx, t, 54, h * f + 30, 19, '#fff6e2'); });
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,232,130,0.28)'; ctx.beginPath(); ctx.moveTo(30, h * 0.6 + 6); ctx.quadraticCurveTo(cx, h * 0.6 - 20, w - 30, h * 0.6 + 6); ctx.lineTo(w - 30, h * 0.2 + 6); ctx.quadraticCurveTo(cx, h * 0.2 - 20, 30, h * 0.2 + 6); ctx.closePath(); ctx.fill();
      drawJack(ctx, cx + 30, h * 0.4, 11);
      label(ctx, 'circle', cx, h - 50, 18, '#fff6e2');
    },
    border() {
      groundStrip(ctx, 0, 0, w, h);
      ctx.fillStyle = '#7a5a3e'; ctx.fillRect(0, h * 0.5 - 8, w, 16);
      ctx.fillStyle = 'rgba(90,110,50,0.5)'; ctx.fillRect(0, h * 0.5 + 8, w, h * 0.5 - 8);
      drawBoule(ctx, 0, w * 0.3, h * 0.28, 24, NZ); drawBoule(ctx, 1, w * 0.62, h * 0.74, 24, [0.5, 0.3, 0.8]);
      label(ctx, 'in play', w * 0.3, h * 0.28 + 46, 19, '#fff6e2'); label(ctx, 'dead: out', w * 0.62, h * 0.74 + 46, 19, '#ffd0b8');
    },
  };
  (A[key] ?? A.equipment)();
  ctx.restore();
}
