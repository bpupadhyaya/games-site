// Every screen that is not the lane: title, set-up, learn, settings, result, pause, demo limit and the scrolling About / How to Play / Rules reader
// with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { live, host, TEXT_SCALES, THINK_STEPS, colFor, setupPins, refLayout, MIN_FONT, fz } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { TIPS, LEVELS, LESSONS, CALLS, CALL_BY_ID, SQUARES_PER_TIP, MARATHON_LIVES, PACES, DEMO_LEVELS, COUPLES } from './consts.js';
import { slotPos } from './sim.js';
import { drawLockup, drawMoreLine, LOCKUP_RATIO } from './brand.js';

const TAU = Math.PI * 2;
export const GUIDES = ['Guide on', 'Guide off'];
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
let measureCtx = estCtx;
export const setMeasureCtx = (c) => { if (c) measureCtx = c; };
let LAID = { key: '', lay: null, top: 0, bottom: 0 };
export const flowMeta = () => LAID;
const kindOf = (key) => (key === 'title' ? 'title' : key === 'setup' || key === 'learn' ? 'wide' : 'one');
const isWide = () => colFor('wide').w0 >= 760;
function place(key, lay) {
  const c = colFor(kindOf(key));
  const top = c.top, bottom = key === 'setup' ? setupPins().bar.y : c.bottom;
  const oy = lay ? Math.max(0, Math.floor((bottom - top - lay.contentH) / 2)) : 0;
  return { c, top, bottom, oy };
}
const WIDGETS = { title: (s) => titleWidgets(s), setup: (s) => setupWidgets(s), settings: (s) => settingsWidgets(s), result: (s) => resultWidgets(s), demolimit: () => demoLimitWidgets(), learn: (s) => learnWidgets(s), lesson: (s) => lessonWidgets(s), lessonresult: (s) => lessonResultWidgets(s) };
function build(state, key) {
  const c = colFor(kindOf(key));
  const lay = flowLayout(measureCtx, WIDGETS[key](state), TEXT_SCALES[state.settings.textIdx], { x: c.x0, w: c.w0 });
  const p = place(key, lay);
  LAID = { key, lay, top: p.top + p.oy, bottom: p.bottom, h: lay.contentH, band: p };
  return LAID;
}
export function ensureLayout(state, key) {
  if (key === 'pause') { pauseGeom(state); return; }
  if (WIDGETS[key]) build(state, key);
}
export function invalidateLayout() { LAID = { key: '', lay: null, top: 0, bottom: 0 }; }
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => { const hk = live.h < 1000 ? 0.66 : live.h < 1200 ? 0.78 : 1; return { t: 'art', h: Math.round(330 * hk), draw(ctx, w) { ctx.save(); ctx.scale(hk, hk); drawHero(ctx, w / hk / 2, 0); ctx.restore(); } }; };
function drawHero(ctx, cx, y) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#ffd98a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('ALLEMANDE LEFT AND AWAY WE GO', cx, y + 46);
  const fit = (text, px, maxW) => { ctx.font = `900 ${px}px ${DISPLAY}`; const m = ctx.measureText(text).width; return m > maxW ? Math.floor(px * maxW / m) : px; };
  ctx.fillStyle = '#fff3dc'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  const f1 = fit('Square Dance', 104, 520), f2 = fit('Caller', 104, 520);
  ctx.font = `900 ${f1}px ${DISPLAY}`; ctx.fillText('Square Dance', cx, y + 150);
  ctx.font = `900 ${Math.max(f1, Math.min(f2, 120))}px ${DISPLAY}`; ctx.fillText('Caller', cx, y + 250);
  ctx.font = `italic 400 32px ${DISPLAY}`; ctx.fillStyle = '#ffd98a'; ctx.shadowBlur = 8;
  ctx.fillText('United States', cx, y + 300);
  ctx.restore();
}
let titleLockTap = null, lockDownNow = false;
export const getLockTap = () => titleLockTap;
export const setLockDown = (v) => { lockDownNow = v; };
const LOCK_CAP = 300;
const lockupArt = (cap = LOCK_CAP) => ({ t: 'art', brand: true, h: Math.round(cap * LOCKUP_RATIO) + 20, draw(ctx, w) {
  const lw = Math.min(w - 30, cap);
  ctx.save(); if (lockDownNow) ctx.globalAlpha = 0.7; drawLockup(ctx, w / 2, 10, lw, 1); ctx.restore();
} });

const stars = (n, of = 3) => '★'.repeat(n) + '☆'.repeat(of - n);
const levelOpen = (state, i) => i === 0 || state.progress.stars[i - 1] > 0 || state.dev;
const nextLevel = (state) => { const i = state.progress.stars.findIndex((s) => s === 0); return i < 0 ? LEVELS.length - 1 : i; };
export function titleWidgets(state) {
  const split = !!colFor('title').hero, tight = !live.land && live.h < 1200;
  const bh = tight ? 70 : 80, p = state.progress, nl = nextLevel(state);
  return [
    ...(split ? [] : [heroArt()]),
    { t: 'btn', id: 'tips', label: 'Tips', sub: `Next: ${TIPS[LEVELS[nl].tip].name}, square ${LEVELS[nl].k + 1}`, primary: true, h: tight ? 78 : 90 },
    { t: 'btn', id: 'marathon', label: 'Endless Evening', sub: p.best > 0 ? `Best ${p.best}` : 'Squares keep coming', h: bh },
    { t: 'btn', id: 'practice', label: 'Practice', h: bh, row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn', h: bh, row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The computer calls and explains', h: bh },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2, h: 70 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2, h: 70 },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: 70 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3, h: 70 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3, h: 70 },
    lockupArt(),
  ];
}

export function setupWidgets(state) {
  const s = state.setup, mode = s.mode, demo = state.demo;
  const title = mode === 'tips' ? 'Tips' : mode === 'marathon' ? 'Endless Evening' : mode === 'practice' ? 'Practice' : 'Watch & Learn';
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 46 }];
  const prog = state.progress;
  if (mode === 'tips' || mode === 'watch') {
    wd.push({ t: 'p', label: mode === 'tips' ? 'Choose a square. Resolve it to open the next.' : 'Choose the square the computer calls.', bold: true, color: '#ffe9a0', size: 26 });
    TIPS.forEach((t, ti) => {
      wd.push({ t: 'h', label: `${ti + 1}. ${t.name}`, size: 34, color: '#ffd98a' });
      wd.push({ t: 'p', label: t.cards.map((id) => CALL_BY_ID[id].short).join(' · '), size: 22 });
      for (let k = 0; k < SQUARES_PER_TIP; k++) {
        const i = ti * SQUARES_PER_TIP + k;
        const open = levelOpen(state, i) || mode === 'watch';
        const locked = !open || (demo && i >= DEMO_LEVELS);
        wd.push({ t: 'btn', id: `lv${i}`, label: String(k + 1), sub: locked ? (demo && i >= DEMO_LEVELS && open ? 'Full game' : 'Locked') : stars(prog.stars[i] | 0), active: s.level === i && !locked, disabled: locked, hitDisabled: true, row: 20 + ti, h: 84 });
      }
    });
  }
  if (mode === 'marathon') {
    wd.push({ t: 'p', label: `Squares come one after another. Resolve each in time: ${MARATHON_LIVES} squares not resolved end the evening. The cards grow, the way home gets longer and the tune gets faster.`, size: 26 });
    wd.push({ t: 'p', label: prog.best > 0 ? `Your best: ${prog.best}` : 'No score yet', bold: true, color: '#ffe9a0', size: 28 });
    if (demo) wd.push({ t: 'p', label: 'The web demo plays the first squares.', size: 24 });
  }
  if (mode === 'practice') {
    wd.push({ t: 'p', label: 'Calls on the card', bold: true, color: '#ffe9a0', size: 26 });
    ['Four', 'Six', 'Eight'].forEach((p, i) => wd.push({ t: 'btn', id: `card${i}`, label: p, row: 9, active: s.card === i }));
    wd.push({ t: 'p', label: 'Shortest way home', bold: true, color: '#ffe9a0', size: 26 });
    [2, 4, 6, 8].forEach((p, i) => wd.push({ t: 'btn', id: `depth${i}`, label: `${p} calls`, row: 10, active: s.depth === i }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Pace: ${PACES[st.pace]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'pace-dec', label: 'Slower', row: 8, disabled: st.pace === 0 },
    { t: 'btn', id: 'pace-inc', label: 'Livelier', row: 8, disabled: st.pace === PACES.length - 1 },
    { t: 'p', label: 'Relaxed: the music waits for your call. Easy: a normal dance tempo. Lively: faster.', size: 22 },
    { t: 'p', label: st.guide ? 'Guide: Off' : 'Guide: On', bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'guide-tog', label: st.guide ? 'Turn the guide on' : 'Turn the guide off' },
    { t: 'p', label: 'The guide shows how many dancers each call would bring home.', size: 22 },
    { t: 'p', label: st.oneTap ? 'Calling: one tap' : 'Calling: tap, then Call it', bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'onetap-tog', label: st.oneTap ? 'Preview first (tap twice)' : 'Call with one tap' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Controls: tap a call to preview it, tap again or press Call it to sing it (or switch to one-tap calling above). Keyboard: number keys select, Enter or Space calls, T hint, P pause.', size: 22 },
    { t: 'p', label: 'Language: English', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: state.owned ? 'Full game unlocked' : 'Restore purchase', dark: true, disabled: !!state.owned }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5, mode = state.mode, ri = state.resultInfo || {};
  const wd = [{ t: 'gap', h: big ? 20 : 36 }];
  if (mode === 'tips' || mode === 'watch') {
    wd.push({ t: 'h', label: ri.won ? (mode === 'watch' ? 'The square is home' : 'Square resolved!') : 'The tip ran out', size: 52, cap: big ? 1.15 : 1.4 });
    if (ri.won) wd.push({ t: 'h', label: mode === 'tips' ? stars(ri.stars || 0) : `${ri.used} calls`, size: 66, cap: 1.2, color: '#ffd97a' });
    wd.push({ t: 'p', label: ri.won ? `${ri.used} ${ri.used === 1 ? 'phrase' : 'phrases'}; the shortest way home was ${ri.opt}.${ri.fillers ? ` ${ri.fillers} swung partners while waiting.` : ''}` : `The square was not home in ${ri.cap} phrases. The shortest way was ${ri.opt}.`, size: 24, cap: big ? 2 : 3 });
    if (mode === 'tips') wd.push({ t: 'p', label: ri.newStar ? 'A new best for this square.' : ri.won ? (ri.canNext ? 'The next square is open.' : `Three stars needs ${ri.opt} phrases without a hint.`) : 'Try it again, or use Think.', bold: true, color: '#ffe9a0', size: 26 });
  } else if (mode === 'marathon') {
    wd.push({ t: 'h', label: 'Evening over', size: 52 });
    wd.push({ t: 'h', label: String(ri.score || 0), size: 96, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${ri.squares} ${ri.squares === 1 ? 'square' : 'squares'} resolved.${ri.newBest ? ' A new best!' : ` Best ${state.progress.best}.`}`, size: 26, bold: true, color: '#ffe9a0' });
  } else {
    wd.push({ t: 'h', label: 'Practice finished', size: 52 });
    wd.push({ t: 'p', label: `${ri.squares || 0} ${ri.squares === 1 ? 'square' : 'squares'} resolved.`, size: 26 });
  }
  wd.push({ t: 'gap', h: 20 });
  if (mode === 'tips' && ri.canNext) wd.push({ t: 'btn', id: 'next', label: `Next square`, sub: `${TIPS[LEVELS[ri.nextIdx].tip].name}, ${LEVELS[ri.nextIdx].k + 1}`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'marathon' ? 'Another evening' : mode === 'practice' ? 'Keep practising' : 'Try this square again', primary: !(mode === 'tips' && ri.canNext), h: 84 });
  wd.push({ t: 'btn', id: 'new', label: 'Set up', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 16 });
  wd.push({ t: 'art', h: 52, draw(ctx, w) { drawMoreLine(ctx, w / 2, 26, 22); } });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 10 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have called the free squares of the web demo. The full game on iPhone and Android has all six tips, the Endless Evening, Practice, Learn and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.progress.drills;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 },
    { t: 'p', label: 'Three short lessons, one figure each. Not timed.', size: 26 },
    ...LESSONS.map((l, i) => ({ t: 'btn', id: `lesson${i}`, label: l.title, sub: done[l.id] ? `Done · ${l.goal}` : l.goal, active: !!done[l.id], h: 96 })),
    { t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 },
  ];
}
export function lessonWidgets(state) {
  const l = LESSONS[state.learnCur];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: l.title, size: 46 },
    { t: 'p', label: `Goal: ${l.goal}`, bold: true, color: '#ffe9a0', size: 28 },
    ...l.intro.map((p) => ({ t: 'p', label: p, size: 28 })),
    { t: 'gap', h: 14 },
    { t: 'btn', id: 'lesson-go', label: 'To the floor', primary: true, h: 92 },
    { t: 'btn', id: 'lesson-back', label: 'Back to lessons', dark: true },
    { t: 'gap', h: 30 },
  ];
}
export function lessonResultWidgets(state) {
  const l = LESSONS[state.learnCur], r = state.drillResult || { pass: false };
  return [
    { t: 'gap', h: 120 }, { t: 'h', label: r.pass ? 'Lesson complete' : 'Not quite yet', size: 52 },
    { t: 'p', label: r.pass ? `You reached the goal: ${l.goal}.` : `The goal was: ${l.goal}. Try again.`, size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'lr-again', label: 'Try again', primary: !r.pass },
    ...(r.pass && state.learnCur < LESSONS.length - 1 ? [{ t: 'btn', id: 'lr-next', label: 'Next lesson', primary: true }] : []),
    { t: 'btn', id: 'lr-list', label: 'All lessons', dark: true },
    { t: 'gap', h: 30 },
  ];
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------------------
function backdrop(ctx, state, a) {
  // the real lane, idling, behind every menu (drawn by game.js through state.sceneBack)
  if (state.sceneBack) state.sceneBack(ctx);
  else { ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, live.w, live.h); }
  const g = ctx.createLinearGradient(0, 0, 0, live.h);
  g.addColorStop(0, `rgba(22,14,40,${a * 0.7})`); g.addColorStop(0.5, `rgba(22,14,40,${a})`); g.addColorStop(1, `rgba(22,14,40,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, live.w, live.h);
}
function colBand(ctx, c, top, bottom) {
  if (!live.land) return;
  roundPath(ctx, c.x0 - 26, top - 4, c.w0 + 52, bottom - top + 8, 30); ctx.fillStyle = 'rgba(22,14,40,0.5)'; ctx.fill();
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = live.w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(22,14,40,0)'); g.addColorStop(1, 'rgba(22,14,40,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 54, bottom - 46, 108, 38, 19); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 26);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 54, top + 8, 108, 38, 19); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 27);
  }
}
function drawFlowScreen(ctx, state, key, bandOn = true) {
  const L = build(state, key), p = L.band, lay = L.lay;
  const top = L.top, bottom = p.bottom, vh = bottom - p.top;
  const maxScroll = Math.max(0, lay.contentH - vh);
  const scroll = Math.min(state.ui.scroll, maxScroll);
  if (bandOn) colBand(ctx, p.c, p.top, bottom);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, vh * (vh / lay.contentH)), ty = top + (scroll / maxScroll) * (vh - th);
    roundPath(ctx, p.c.x0 + p.c.w0 + 12, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, p.c.x0 - 20, p.c.w0 + 40);
  }
  return { scroll, maxScroll, lay, top, bottom };
}

export function renderTitle(ctx, state) {
  const w = live.w, h = live.h;
  backdrop(ctx, state, 0.2);
  const c = colFor('title');
  if (c.hero) {
    const blockH = 306 + 28;
    const sc = Math.min(1, (c.hero.w - 30) / 560, (c.bottom - c.top) / blockH), top = c.top + Math.max(0, (c.bottom - c.top - blockH * sc) / 2);
    ctx.save(); ctx.translate(c.hero.x + c.hero.w / 2, top); ctx.scale(sc, sc); drawHero(ctx, 0, 0); ctx.restore();
    roundPath(ctx, c.x0 - 22, c.top - 2, c.w0 + 44, c.bottom - c.top + 4, 30); ctx.fillStyle = 'rgba(22,14,40,0.55)'; ctx.fill();
  } else {
    const g = ctx.createLinearGradient(0, h * 0.28, 0, h); g.addColorStop(0, 'rgba(22,14,40,0)'); g.addColorStop(1, 'rgba(22,14,40,0.82)');
    ctx.fillStyle = g; ctx.fillRect(0, h * 0.28, w, h * 0.72);
  }
  const fr = drawFlowScreen(ctx, state, 'title', false);
  titleLockTap = null;
  const it = fr.lay.items.find((i) => i.w && i.w.brand);
  if (it) {
    const lw = Math.min(it.wd - 30, LOCK_CAP), lh = Math.round(lw * LOCKUP_RATIO), cx = it.x + it.wd / 2, cy = fr.top + it.y - fr.scroll + 10 + lh / 2;
    const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw, m), th = Math.max(lh, m);
    if (cy - th / 2 >= fr.top - 4 && cy + th / 2 <= fr.bottom + 4) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', w / 2, h - 14 - host.b); }
}
export function setupBar(mode) {
  const pins = setupPins();
  if (mode === 'tips' || mode === 'watch') return { start: null, back: { x: pins.start.x, y: pins.start.y, w: pins.start.w + pins.back.w + 14, h: pins.start.h }, bar: pins.bar };
  return { start: pins.start, back: pins.back, bar: pins.bar };
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.78);
  const m = state.setup.mode, pins = setupBar(m), w = live.w, h = live.h;
  drawFlowScreen(ctx, state, 'setup');
  const g = ctx.createLinearGradient(0, pins.bar.y, 0, h);
  g.addColorStop(0, 'rgba(22,14,40,0)'); g.addColorStop(0.2, 'rgba(22,14,40,0.88)'); g.addColorStop(1, 'rgba(22,14,40,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, pins.bar.y, w, pins.bar.h);
  if (pins.start) drawButton(ctx, pins.start, m === 'marathon' ? 'Begin the evening' : 'Start practice', { primary: true, size: 32 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${fz(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, w / 2, pins.bar.y + 20); }
}
const flowScreen = (key, a) => (ctx, state) => { backdrop(ctx, state, a); drawFlowScreen(ctx, state, key); };
export const renderSettings = flowScreen('settings', 0.8);
export const renderResult = flowScreen('result', 0.7);
export const renderDemoLimit = flowScreen('demolimit', 0.8);
export const renderLearn = flowScreen('learn', 0.8);
export const renderLesson = flowScreen('lesson', 0.8);
export const renderLessonResult = flowScreen('lessonresult', 0.8);

function pauseGeom(state) {
  const w = live.w, h = live.h, I = host;
  const pw = Math.min(660, w - I.l - I.r - 24), px = Math.round((w - pw) / 2);
  const lay = flowLayout(measureCtx, pauseWidgets(state), TEXT_SCALES[state.settings.textIdx], { x: px + 30, w: pw - 60 });
  const top = I.t + 16, bottom = h - I.b - 16;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, Math.round((top + bottom - ch) / 2));
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH, panel: { x: px, w: pw } };
  return LAID;
}
export function renderPause(ctx, state) {
  ctx.fillStyle = 'rgba(22,14,40,0.6)'; ctx.fillRect(0, 0, live.w, live.h);
  const L = pauseGeom(state), { lay, top: y0, bottom } = L, ch = bottom - y0;
  panel(ctx, L.panel.x, y0 - 20, L.panel.w, ch + 40, { r: 30, fill: 'rgba(34,22,58,0.96)', stroke: 'rgba(255,246,228,0.45)' });
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, L.panel.x, L.panel.w);
}

// ---- reference pages (Rules, How to Play, About): ONE scrolling column inside the panel ------------------------------------------------
export const REF_VIEW = { top: 0, bottom: 0 };
let REF = { max: 0, vh: 1, total: 0 };
export const refMeta = () => REF;
const artH = (key) => (key === 'floor' ? 360 : 320);
function buildFlow(ctx, list, scale, R) {
  const PW = R.panel.w;
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PW - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const blocks = []; let y = 8;
  list.forEach((sec, si) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const artHt = sec.art ? artH(sec.art) : 0;
    const blk = { y, tl, titleH, art: sec.art || null, artH: artHt, lines, rule: si > 0 };
    let h = (blk.rule ? 16 : 0) + titleH + artHt;
    lines.forEach((l, k) => { h += lh + (l.gapBefore && k > 0 ? lh * 0.45 : 0); });
    h += 30; blk.h = h; blocks.push(blk); y += h;
  });
  return { blocks, total: y, fs, lh, secFs };
}
const flowCache = new Map();
export function refPrepare(state, list, header) {
  const R = refLayout(), P = R.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}:${list[list.length - 1].p.length}:${Math.round(P.w)}x${Math.round(R.view.bottom - R.view.top)}`;
  let F = flowCache.get(pkey);
  if (!F) { F = buildFlow(measureCtx, list, sc, R); flowCache.set(pkey, F); if (flowCache.size > 30) flowCache.delete(flowCache.keys().next().value); }
  const { top, bottom } = R.view, vh = bottom - top, max = Math.max(0, F.total - vh);
  REF = { max, vh, total: F.total }; REF_VIEW.top = top; REF_VIEW.bottom = bottom;
  return { R, P, F, sc, top, bottom, vh, max };
}
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.8);
  const { R, P, F, sc, top, bottom, vh, max } = refPrepare(state, list, header);
  const scroll = Math.min(Math.max(0, state.ui.scroll), max); state.ui.scroll = scroll;
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(250,246,236,0.97)', stroke: 'rgba(34,22,58,0.6)' });
  const cx = P.x + P.w / 2, hy = P.y + R.headH - 40;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#6a2a14'; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, cx, hy);
  ctx.strokeStyle = 'rgba(34,22,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, hy + 20); ctx.lineTo(P.x + P.w - 60, hy + 20); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 8, top, P.w - 16, vh); ctx.clip();
  for (const blk of F.blocks) {
    let y = top + blk.y - scroll;
    if (y > bottom || y + blk.h < top) continue;
    if (blk.rule) { ctx.strokeStyle = 'rgba(34,22,58,0.2)'; ctx.beginPath(); ctx.moveTo(P.x + 80, y + 4); ctx.lineTo(P.x + P.w - 80, y + 4); ctx.stroke(); y += 16; }
    ctx.textAlign = 'center'; ctx.fillStyle = '#a3401a'; ctx.font = `700 ${F.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, cx, y + F.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { drawArt(blk.art, ctx, P.x + 40, y, P.w - 80, blk.artH - 12); y += blk.artH; }
    ctx.fillStyle = '#1c2230'; ctx.font = `400 ${F.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += F.lh * 0.45; ctx.fillText(l.text, P.x + 40, y + F.fs * 0.85); y += F.lh; });
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, vh * vh / F.total), ty = top + (scroll / max) * (vh - th);
    roundPath(ctx, P.x + P.w - 18, ty, 7, th, 3.5); ctx.fillStyle = 'rgba(34,22,58,0.45)'; ctx.fill();
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, bottom - 70, 0, bottom); g.addColorStop(0, 'rgba(250,246,236,0)'); g.addColorStop(1, 'rgba(250,246,236,0.97)'); ctx.fillStyle = g; ctx.fillRect(P.x + 10, bottom - 70, P.w - 20, 70);
      roundPath(ctx, cx - 64, bottom - 42, 128, 36, 18); ctx.fillStyle = '#6a2a14'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ scroll', cx, bottom - 23);
    }
    if (scroll > 4) {
      roundPath(ctx, cx - 46, top + 6, 92, 34, 17); ctx.fillStyle = '#6a2a14'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 23);
    }
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(34,22,58,0.75)';
  const pages = Math.max(1, Math.ceil(F.total / vh)), cur = max <= 0 ? 1 : Math.min(pages, 1 + Math.round(scroll / max * (pages - 1)));
  ctx.fillText(`${max > 0 ? `Screen ${cur} of ${pages}   ` : ''}Text ${Math.round(sc * 100)}%`, cx, P.y + P.h - (R.foot > 40 ? 22 : 8));
  drawButton(ctx, R.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 32 });
  drawButton(ctx, R.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 32 });
  drawButton(ctx, R.back, scroll <= 4 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, R.next, scroll >= max - 4 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- diagrams ----------------------------------------------------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#1c2230', align = 'center') {
  size = Math.max(MIN_FONT, size);
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#a3401a', wd = 4, bend = 0.15) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const mx = (x0 + x1) / 2 + nx * bend * L, my = (y0 + y1) / 2 + ny * bend * L;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - my, x1 - mx);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 13 * Math.cos(a - 0.45), y1 - 13 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 13 * Math.cos(a + 0.45), y1 - 13 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#e6c590'); g.addColorStop(1, '#cfa66a');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const side = Math.min(h - 24, w * 0.7), cx = x + w / 2, cy = y + h / 2, k = side / 2.7;
  const P = (s) => { const p = slotPos(s); return [cx + p.x * k, cy - p.y * k]; };
  ctx.strokeStyle = 'rgba(70,30,10,0.55)'; ctx.lineWidth = 3; roundPath(ctx, cx - side / 2, cy - side / 2, side, side, 14); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  const callId = key.startsWith('call:') ? key.slice(5) : null, call = callId ? CALL_BY_ID[callId] : null;
  const rad = Math.max(18, k * 0.19);
  for (let s = 0; s < 8; s++) {
    const [px, py] = P(s), cp = COUPLES[s >> 1], moved = call && call.to[s] !== s, lady = (s & 1) === 1;
    ctx.fillStyle = moved || !call ? cp.col : 'rgba(120,90,70,0.35)'; ctx.strokeStyle = cp.dark; ctx.lineWidth = 2.5;
    if (lady) { ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill(); ctx.stroke(); } else { roundPath(ctx, px - rad, py - rad, rad * 2, rad * 2, rad * 0.3); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(MIN_FONT, Math.round(rad * 1.0))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(cp.n), px, py + 1);
  }
  if (call) {
    for (let s = 0; s < 8; s++) {
      const t = call.to[s];
      if (t === s) continue;
      const [x0, y0] = P(s), [x1, y1] = P(t), L = Math.hypot(x1 - x0, y1 - y0) || 1;
      const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      arrow(ctx, x0 + ux * rad * 1.1, y0 + uy * rad * 1.1, x1 - ux * rad * 1.3, y1 - uy * rad * 1.3, '#3a1458', 4, call.kind === 'rot' || call.kind === 'grand' || call.kind === 'star' ? 0.25 : 0.1);
    }
    label(ctx, call.short, x + 18, y + h - 16, 22, '#3a1458', 'left');
  } else {
    label(ctx, 'heads', cx, cy - side / 2 + 28, 22, '#5a2410');
    label(ctx, 'heads', cx, cy + side / 2 - 12, 22, '#5a2410');
    label(ctx, 'sides', cx - side / 2 + 4, cy + 8, 22, '#5a2410', 'left');
    label(ctx, 'sides', cx + side / 2 - 4, cy + 8, 22, '#5a2410', 'right');
    label(ctx, 'square = gent, round = lady, number = couple', cx, y + 28, 22, '#3a1458');
  }
  ctx.restore();
}
