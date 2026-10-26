// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit, and the scrolling About / How to
// Play / Rules reader with its illustrations (drawn with the game's own boats and sea). Pure drawing; game.js owns state.
// Every position comes from the live layout L (layout.js).
import { COURSES, COURSE_IDS } from './sim.js';
import { drawSea } from './view.js';
import { v3 } from './v3.js';
import { drawPirogue, drawBuoy, hullShape } from './art.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES, LEVELS } from './ai.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { PALETTES, fmtTime, ordinal } from './match.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// Embossed lettering: a deep contact shadow, a dark rim, a vertical metal gradient and a bright top edge.
function embossed(ctx, text, x, y, size, grad, rim) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(2,18,30,0.65)'; ctx.shadowBlur = size * 0.16; ctx.shadowOffsetY = size * 0.06;
  ctx.lineWidth = size * 0.1; ctx.strokeStyle = rim; ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, y - size * 0.75, 0, y + size * 0.08);
  g.addColorStop(0, grad[0]); g.addColorStop(0.45, grad[1]); g.addColorStop(1, grad[2]);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.lineWidth = Math.max(1, size * 0.018); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.save(); ctx.translate(0, -size * 0.012); ctx.strokeText(text, x, y); ctx.restore();
  ctx.restore();
}
const heroArt = (h = 400, boats0 = true) => ({
  t: 'art', h,
  draw(ctx, w) {
    let boats = boats0;
    if (v3.on) { const m = ctx.getTransform(); v3.hero = { x: m.e / m.a, y: m.f / m.a, w: w * m.a / m.a, h }; boats = false; }
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    ctx.font = `700 124px ${DISPLAY}`; embossed(ctx, 'Pirogue', cx, 128, 124, ['#ffffff', '#fff1cf', '#e9b95a'], '#5a2d0c');
    ctx.font = `700 60px ${DISPLAY}`; embossed(ctx, 'Coastal Canoe Race', cx, 206, 60, ['#ffe9a0', '#ffc64d', '#d98a1c'], '#4a2208');
    ctx.font = `600 24px ${FONT}`; textShadow(ctx, 'SURF OUT, ROUND THE BUOY, RIDE HOME', cx, 252, '#fff0d0', 6);
    if (boats) drawPirogue(ctx, { x: cx - 120, y: 330, ang: -0.55, ppm: 22, pal: PALETTES[0], roll: 0, v: 3, tSince: 0.2, lastSide: 1, swamp: 0, ride: null, id: 0, t: 0 });
    if (boats) drawPirogue(ctx, { x: cx + 120, y: 322, ang: 0.5, ppm: 22, pal: PALETTES[2], roll: 0.1, v: 3, tSince: 0.5, lastSide: -1, swamp: 0, ride: null, id: 1, t: 0 });
    ctx.restore();
  },
});

export function titleWidgets(state, size = 'full') {
  const hero = heroArt(size === 'tiny' ? 276 : size === 'compact' ? 330 : 420, size !== 'tiny');
  return [
    hero,
    { t: 'btn', id: 'play', label: 'Race', sub: 'three rival crews', primary: true, h: 92 },
    { t: 'btn', id: 'trial', label: 'Time Trial', row: 5, h: 84 }, { t: 'btn', id: 'two', label: 'Two Players', row: 5, h: 84 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'a coach crew races and explains', h: 84 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: 76 }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: 76 },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: 76 }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: 76 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', dark: true, h: 70 },
  ];
}

export function setupParts(state, wide) {
  const s = state.setup, two = s.mode === 'two', trial = s.mode === 'trial';
  const head = [{ t: 'h', label: trial ? 'Time Trial' : two ? 'Two Players' : 'Race', size: 40 }];
  const levels = [{ t: 'h', label: 'Your rivals', size: 30 }, ...LEVELS.map((l) => ({
    t: 'btn', id: `lvl${l.id}`, label: l.name, sub: l.pick.map((i) => PROFILES[i].name).join(', '), active: s.level === l.id,
    disabled: state.demo && l.id === 'hard', hitDisabled: true, h: 84,
  }))];
  const courses = [{ t: 'h', label: 'The sea', size: 30 }, ...COURSE_IDS.map((c) => ({
    t: 'btn', id: `crs${c}`, label: COURSES[c].name, sub: `${c === 'daily' ? 'A new sea every day, the same for everyone.' : COURSES[c].note}${state.record.best[c] ? `  Best ${fmtTime(state.record.best[c])}` : ''}`, active: s.course === c,
    disabled: state.demo && c !== 'morning' && c !== 'surf', hitDisabled: true, h: 90,
  }))];
  const foot = [];
  if (state.setupMsg) foot.push({ t: 'p', label: state.setupMsg, size: 28, color: '#ffd27a', bold: true });
  if (state.demo) foot.push({ t: 'p', label: 'The web demo has two seas and the first two rival levels.', size: 26 });
  const best = state.record.best[s.course];
  foot.push({ t: 'p', label: best ? `Your best on ${COURSES[s.course].name}: ${fmtTime(best)}` : 'No time set on this sea yet.', size: 28, bold: true });
  return { head, levels: two || trial ? [] : levels, courses, foot };
}
export function setupWidgets(state) { const p = setupParts(state, false); return [...p.head, ...p.levels, ...p.courses, ...p.foot]; }

export function settingsParts(state) {
  const st = state.settings;
  const a = [
    { t: 'h', label: 'Settings', size: 42 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: on' : 'Sound: off', active: st.sound, h: 80 },
    { t: 'btn', id: 'set-steer', label: st.steer === 'turn' ? 'Tap = direction to turn' : 'Tap = side to paddle', sub: st.steer === 'turn' ? 'tap left to turn left' : 'tap left to paddle on the left (turns right)', active: true, h: 100 },
    { t: 'p', label: `Text size ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, size: 30, bold: true },
    { t: 'btn', id: 'txt-dec', label: 'Smaller text', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'txt-inc', label: 'Larger text', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time ${THINK_STEPS[st.thinkIdx]} s`, size: 30, bold: true },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 2, disabled: st.thinkIdx === 0, h: 76 }, { t: 'btn', id: 'think-inc', label: 'Longer', row: 2, disabled: st.thinkIdx === THINK_STEPS.length - 1, h: 76 },
    { t: 'gap', h: 10 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: state.owned ? 'Full game unlocked' : 'Restore purchase', sub: state.restoreMsg || (state.owned ? 'Thank you for playing' : 'Already bought it? Get it back'), disabled: !!state.owned, h: 96 }]),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 88 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

const medalArt = (win, h) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.translate(w / 2, h / 2);
    const g = ctx.createRadialGradient(0, -10, 6, 0, 0, 90);
    g.addColorStop(0, win ? '#fff0a8' : '#d8e8f0'); g.addColorStop(1, win ? '#e09a1c' : '#5a8aa8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(10,40,70,0.55)'; ctx.font = `700 78px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(win ? '★' : '·', 0, 4);
    ctx.restore();
  },
});
export function resultParts(state, wide) {
  const R = state.result, c = state.race.cfg;
  const words = [];
  if (!R) return { words, btns: [] };
  words.push(medalArt(R.win, 150));
  words.push({ t: 'h', label: R.title, size: 54, cap: 1.4 });
  words.push({ t: 'p', label: R.line, size: 34, bold: true });
  R.rows.forEach((r) => words.push({ t: 'p', label: r.text, size: 30, bold: r.me, color: r.me ? '#ffe9a8' : undefined }));
  if (R.pb) words.push({ t: 'p', label: R.pb, size: 28, bold: true, color: '#ffd27a' });
  const btns = [];
  if (c.mode === 'two' && state.twoPending) btns.push({ t: 'btn', id: 'next', label: 'Player 2: your turn', primary: true, h: 92 });
  else btns.push({ t: 'btn', id: 'again', label: c.mode === 'two' ? 'Rematch' : 'Race again', primary: true, h: 92 });
  btns.push({ t: 'btn', id: 'new', label: 'New setup', h: 80 }, { t: 'btn', id: 'menu', label: 'Main menu', h: 80 });
  return { words, btns };
}
export function resultWidgets(state) { const p = resultParts(state, false); return [...p.words, ...p.btns]; }

export function pauseWidgets(state) {
  return [
    { t: 'h', label: 'Paused', size: 46 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 92 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 1, h: 76 }, { t: 'btn', id: 'p-howto', label: 'How to Play', row: 1, h: 76 },
    { t: 'btn', id: 'p-sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', row: 2, h: 76 },
    { t: 'btn', id: 'restart', label: 'Restart race', row: 2, h: 76 },
    { t: 'btn', id: 'quit', label: 'Leave race', dark: true, h: 80 },
  ];
}
export function demoLimitWidgets(wide) {
  return [
    { t: 'h', label: 'That was the demo end', size: 40 },
    { t: 'p', label: 'The web demo plays three races. The full game for iPhone and Android has every sea, all the rival crews and the Daily Sea, with no limits.', size: 26 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true, h: 90 },
  ];
}

// ---- backdrop: the attract race rolling behind the menus -----------------------------------------------------------------------
function backdrop(ctx, L, state) {
  const a = state.att;
  if (!(v3.on && v3.fade >= 1)) { ctx.save(); if (v3.on) ctx.globalAlpha = 1 - v3.fade; ctx.fillStyle = '#0a4a7c'; ctx.fillRect(0, 0, L.w, L.h); ctx.restore(); }
  if (a) drawSea(ctx, L, { race: a.race, cam: a.cam, t: a.t, t0: a.race.t, parts: a.parts, trails: a.trails, mineLane: a.race.boats[0].lane });
}
function scrim(ctx, L, a = 0.5) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(4,26,40,${a * 0.5})`); g.addColorStop(0.5, `rgba(4,26,40,${a})`); g.addColorStop(1, `rgba(4,26,40,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}
// ---- layout of columns --------------------------------------------------------------------------------------------------------
const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = (w * 327) / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t + 14, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const strip = lockSize(L).strip, avail = L.sb - strip - Math.max(Math.round(Math.max(0, L.sb - 1280) * 0.2), I.t);
    const wd = titleWidgets(state, L.wide ? 'full' : avail >= 1180 ? 'full' : avail >= 1090 ? 'compact' : 'tiny');
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.2); return one(wd, 640, Math.max(off, I.t), L.sb - strip).map((c) => ({ ...c, center: true })); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), noRival = state.setup.mode !== 'race', cols = L.setup.cols;
    if (noRival) return [{ widgets: [...p.head, ...p.courses], ...cols[0] }, { widgets: p.foot, ...cols[1] }, { widgets: [], ...cols[2] }];
    return [{ widgets: [...p.head, ...p.levels], ...cols[0] }, { widgets: p.courses, ...cols[1] }, { widgets: p.foot, ...cols[2] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state));
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
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
  if (key === 'title') {
    const ls = lockSize(L), bc = cols[cols.length - 1], used = bc.top + bc.off + bc.lay.contentH, cx = L.wide ? (3 * L.w) / 4 : L.w / 2;
    const pinned = L.sb - ls.h - 12, y = Math.min(used + 12, pinned), mm = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, mm), th = Math.max(ls.h + 12, mm);
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


function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,20,30,0)'); g.addColorStop(1, 'rgba(4,20,30,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
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
function label(ctx, t, x, y, size = 20, col = '#fff6e4', align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function seaBox(ctx, x, y, w, h, beach = false) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0f6a9c'); g.addColorStop(0.7, '#2ab0c0'); g.addColorStop(1, '#8fe6d4');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  if (beach) { ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip(); ctx.fillStyle = '#f1d9a4'; ctx.fillRect(x, y + h - 22, w, 22); ctx.restore(); }
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd27a', wd = 5) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 13 * Math.cos(a - 0.45), y1 - 13 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 13 * Math.cos(a + 0.45), y1 - 13 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function crest(ctx, x0, x1, y, h = 1, col = 'rgba(255,255,255,0.9)') {
  ctx.strokeStyle = col; ctx.lineWidth = 4 + 4 * h; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y - 8 * h, x1, y); ctx.stroke();
  ctx.strokeStyle = 'rgba(5,45,80,0.35)'; ctx.lineWidth = 7 + 6 * h;
  ctx.beginPath(); ctx.moveTo(x0, y + 12 + 4 * h); ctx.quadraticCurveTo((x0 + x1) / 2, y + 4 * h, x1, y + 12 + 4 * h); ctx.stroke();
}
const boat = (ctx, x, y, ang, ppm, o = {}) => drawPirogue(ctx, { x, y, ang, ppm, pal: PALETTES[o.pal ?? 0], roll: o.roll || 0, v: o.v ?? 2.5, tSince: o.tSince ?? 0.5, lastSide: o.side ?? 1, swamp: 0, ride: null, id: 0, t: 0 });

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    course() {
      seaBox(ctx, 0, 0, w, h, true);
      const lx = [w * 0.32, w * 0.46, w * 0.6, w * 0.74];
      lx.forEach((px, i) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px, h - 24); ctx.lineTo(px, 22); ctx.stroke(); ctx.setLineDash([]);
        drawBuoy(ctx, px, 24, i === 1, 0); ctx.restore(); ctx.save(); ctx.translate(x, y);
      });
      boat(ctx, lx[1] - 7, h * 0.58, 0, 6, { pal: 0 });
      arrow(ctx, lx[1] + 14, h - 40, lx[1] + 14, 46, '#ffd27a', 4);
      arrow(ctx, lx[2] - 14, 46, lx[2] - 14, h - 40, '#ffffff', 4);
      label(ctx, 'out', lx[1] - 22, h * 0.36, 20, '#ffd27a', 'right'); label(ctx, 'home', lx[2] + 6, h * 0.36, 20, '#ffffff', 'left');
      label(ctx, 'buoy', w * 0.88, 30, 20); label(ctx, 'beach', w * 0.12, h - 6, 20, '#3a2a10');
    },
    strokes() {
      seaBox(ctx, 0, 0, w, h);
      boat(ctx, w * 0.27, h * 0.52, 0.0, 9, { side: -1, tSince: 0.12 });
      label(ctx, 'tap LEFT: paddle left', w * 0.27, h - 8, 18);
      arrow(ctx, w * 0.27 - 30, h * 0.24, w * 0.27 + 30, h * 0.2, '#ffd27a', 4); label(ctx, 'bow turns right', w * 0.27, h * 0.1 + 6, 17, '#ffd27a');
      boat(ctx, w * 0.74, h * 0.52, 0.0, 9, { side: 1, tSince: 0.12 });
      label(ctx, 'tap RIGHT: paddle right', w * 0.74, h - 8, 18);
      arrow(ctx, w * 0.74 + 30, h * 0.24, w * 0.74 - 30, h * 0.2, '#ffd27a', 4); label(ctx, 'bow turns left', w * 0.74, h * 0.1 + 6, 17, '#ffd27a');
    },
    ring() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#0c3a54'; ctx.fill();
      const cx = w * 0.3, cy = h * 0.5, r = Math.min(h * 0.36, 52);
      ctx.lineWidth = 12;
      const arc = (a0, a1, col) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 + a0 * TAU, -Math.PI / 2 + a1 * TAU); ctx.stroke(); };
      arc(0, 1, 'rgba(255,255,255,0.18)'); arc(0.5, 0.78, 'rgba(120,230,160,0.6)'); arc(0.55, 0.74, '#7dffb0');
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + Math.cos(-Math.PI / 2 + 0.64 * TAU) * r, cy + Math.sin(-Math.PI / 2 + 0.64 * TAU) * r, 10, 0, TAU); ctx.fill();
      label(ctx, 'tap with the hand', w * 0.62, h * 0.32, 20, '#fff6e4');
      label(ctx, 'in the bright arc', w * 0.62, h * 0.5, 20, '#7dffb0');
      label(ctx, 'too soon = weak stroke', w * 0.62, h * 0.7, 18, '#ffb08a');
    },
    punch() {
      seaBox(ctx, 0, 0, w, h);
      crest(ctx, w * 0.06, w * 0.46, h * 0.28, 0.9); crest(ctx, w * 0.54, w * 0.94, h * 0.28, 0.9);
      boat(ctx, w * 0.26, h * 0.62, 0, 8, { v: 3 }); label(ctx, 'bow-on, stroke first: punch', w * 0.26, h - 8, 17, '#9dffbd');
      boat(ctx, w * 0.74, h * 0.62, 0.7, 8, { v: 1.5 }); label(ctx, 'angled or slow: slap', w * 0.74, h - 8, 17, '#ffb08a');
    },
    brace() {
      seaBox(ctx, 0, 0, w, h);
      boat(ctx, w * 0.25, h * 0.5, 0, 9, { roll: 0.8, side: 1, tSince: 0.15 });
      label(ctx, 'heeled to the right', w * 0.25, h - 8, 17);
      arrow(ctx, w * 0.25 + 16, h * 0.12, w * 0.25 + 52, h * 0.12, '#ffd27a', 4); label(ctx, 'stroke RIGHT', w * 0.25 + 56, h * 0.12 + 6, 17, '#ffd27a', 'left');
      roundPath(ctx, w * 0.56, h * 0.4, w * 0.36, 30, 15); ctx.fillStyle = 'rgba(6,32,44,0.8)'; ctx.fill(); ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffb454'; ctx.beginPath(); ctx.arc(w * 0.56 + w * 0.36 * 0.78, h * 0.4 + 15, 10, 0, TAU); ctx.fill();
      label(ctx, 'the heel gauge', w * 0.74, h * 0.4 - 10, 18);
    },
    surf() {
      seaBox(ctx, 0, 0, w, h, true);
      crest(ctx, w * 0.1, w * 0.9, h * 0.72, 1.1); crest(ctx, w * 0.1, w * 0.9, h * 0.9, 0.7);
      boat(ctx, w * 0.5, h * 0.44, 0.0, 8, { v: 4, tSince: 0.6 });
      arrow(ctx, w * 0.5, h * 0.68, w * 0.5, h * 0.2, '#ffd27a', 5);
      label(ctx, 'swell from behind', w * 0.22, h * 0.68, 18); label(ctx, 'beach', w * 0.5, h * 0.12, 18, '#3a2a10');
    },
    turn() {
      seaBox(ctx, 0, 0, w, h);
      drawBuoy(ctx, w * 0.5, h * 0.4, true, 0); ctx.restore(); ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(w * 0.5 + 22, h * 0.4, 34, Math.PI * 0.5, Math.PI * 1.5, true); ctx.stroke();
      boat(ctx, w * 0.5 - 14, h * 0.8, 0, 8);
    },
  };
  (A[key] ?? A.course)();
  ctx.restore();
}

// ---- screens -----------------------------------------------------------------------------------------------------------------------
export function renderTitle(ctx, state, L) {
  backdrop(ctx, L, state);
  scrim(ctx, L, 0.34);
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
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(8,36,56,0.95)', stroke: 'rgba(255,214,150,0.5)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}
