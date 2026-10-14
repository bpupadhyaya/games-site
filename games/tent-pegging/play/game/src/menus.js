// Every screen that is not the lane: title, set-up, learn, settings, result, pause, demo limit and the scrolling About / How to Play / Rules reader
// with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { live, host, TEXT_SCALES, THINK_STEPS, colFor, setupPins, refLayout, MIN_FONT, fz } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit, embossText } from './ui.js';
import { ROUNDS, PACES, SWAYS, LESSONS, STARS_AT, RUNS_PER_ROUND, MAX_ROUND, CHALLENGE_LIVES } from './consts.js';
import { drawLockup, drawMoreLine, LOCKUP_RATIO } from './brand.js';
import { drawScene, makeCam } from './scene.js';

const TAU = Math.PI * 2;
export const GUIDES = ['Guided', 'Ring only', 'Off'];
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

// Title lettering (compact, so the 3D rider and horse own the middle of the screen) and the window the 3D hero is framed in.
const TITLE_H = 214, TITLE_W = 720;
const titleH = () => (live.land ? TITLE_H : live.h < 1100 ? 156 : live.h < 1150 ? 176 : TITLE_H);
const titleArt = () => ({ t: 'art', h: titleH(), draw(ctx, w) { ctx.save(); drawHero(ctx, w / 2, 0); ctx.restore(); } });
const heroSpacer = (h) => ({ t: 'art', hero: true, h: Math.round(h), draw() {} });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function drawHero(ctx, cx, y) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 26px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('THE MOUNTED LANCE GAME', cx, y + 38);
  ctx.restore();
  ctx.save(); ctx.font = `900 100px ${DISPLAY}`; const per = ctx.measureText('Tent Pegging').width / 100; ctx.restore();
  const th = live.land ? TITLE_H : titleH();
  const size = Math.max(40, Math.min(112, Math.floor((Math.min(live.w, 760) - 90) / per), Math.floor((th - 82) / 1.02)));
  embossText(ctx, 'Tent Pegging', cx, y + 38 + size * 1.02, size);
  ctx.save(); ctx.textAlign = 'center';
  ctx.font = `italic 400 30px ${DISPLAY}`; ctx.fillStyle = '#ffe9a8'; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('neza bazi  ·  Pakistan and India', cx, y + 38 + size * 1.02 + 44);
  ctx.restore();
}
// where game.js frames the 3D hero (virtual units): the centre of the window and its height
let heroRect = null;
export function heroTarget() {
  if (!heroRect) return { heroX: live.w * 0.5, heroY: live.h * 0.36, heroH: live.h * 0.3 };
  return { heroX: heroRect.x + heroRect.w / 2, heroY: heroRect.y + heroRect.h * 0.46, heroH: heroRect.h };
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
export function titleWidgets(state) {
  const split = !!colFor('title').hero, tight = !live.land && live.h < 1200;
  const grid = !live.land && live.h < 1100;
  const bh = grid ? 62 : tight ? 70 : 80;
  const c = state.progress, nextRound = Math.min(ROUNDS.length - 1, c.stars.findIndex((s) => s === 0) < 0 ? ROUNDS.length - 1 : c.stars.findIndex((s) => s === 0));
  const rest = [
    { t: 'btn', id: 'cup', label: 'Tournament Cup', sub: `Next: ${ROUNDS[nextRound].name}`, primary: true, h: grid ? 70 : tight ? 78 : 90 },
    ...(grid ? [
      { t: 'btn', id: 'challenge', label: 'Gallop Challenge', sub: c.best > 0 ? `Best ${c.best}` : 'How far can you go?', h: bh, row: 1 },
      { t: 'btn', id: 'practice', label: 'Practice', h: bh, row: 1 },
      { t: 'btn', id: 'learn', label: 'Learn', h: bh, row: 5 },
      { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The computer rides', h: bh, row: 5 },
    ] : [
      { t: 'btn', id: 'challenge', label: 'Gallop Challenge', sub: c.best > 0 ? `Best ${c.best}` : 'How far can you go?', h: bh },
      { t: 'btn', id: 'practice', label: 'Practice', h: bh, row: 1 },
      { t: 'btn', id: 'learn', label: 'Learn', h: bh, row: 1 },
      { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The computer rides and explains', h: bh },
    ]),
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2, h: grid ? 60 : 70 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2, h: grid ? 60 : 70 },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: grid ? 60 : 70 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3, h: grid ? 60 : 70 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3, h: grid ? 60 : 70 },
    lockupArt(grid ? 200 : tight ? 230 : LOCK_CAP),
  ];
  if (split) return rest;
  // the hero window takes whatever height the buttons leave: measure them, then size it
  const c2 = colFor('title');
  const used = flowLayout(measureCtx, rest.map((w) => ({ ...w })), TEXT_SCALES[state.settings.textIdx], { x: c2.x0, w: c2.w0 }).contentH;
  const avail = live.h - host.t - host.b - (live.land ? 0 : 6);
  const space = clamp(avail - used - titleH() - 28, state.settings.textIdx > 0 ? 0 : live.land ? 110 : 70, live.h * 0.42);
  return [titleArt(), heroSpacer(space), ...rest];
}

export function setupWidgets(state) {
  const s = state.setup, mode = s.mode, demo = state.demo, wide = isWide();
  const title = mode === 'cup' ? 'Tournament Cup' : mode === 'challenge' ? 'Gallop Challenge' : mode === 'practice' ? 'Practice' : 'Watch & Learn';
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 46 }];
  const prog = state.progress;
  if (mode === 'cup' || mode === 'watch') {
    wd.push({ t: 'p', label: mode === 'cup' ? 'Choose a round. Beat the rival to open the next.' : 'Choose the round the computer rides.', bold: true, color: '#ffe9a0', size: 26 });
    ROUNDS.forEach((r, i) => {
      const open = i === 0 || prog.stars[i - 1] > 0 || mode === 'watch' || state.dev;
      const locked = !open || (demo && i > 1);
      wd.push({ t: 'btn', id: `rd${i}`, label: `${i + 1}. ${r.name}`, sub: locked ? (demo && i > 1 && open ? 'In the full game' : 'Win the round before') : `${stars(prog.stars[i])}  ·  ${r.minPace ? 'Gallop or faster' : 'Any pace'}`, active: s.round === i && !locked, disabled: locked, hitDisabled: true, h: 84 });
    });
  }
  if (mode === 'challenge') {
    wd.push({ t: 'p', label: `Ride until you have missed ${CHALLENGE_LIVES} times. The lane gets livelier every three runs.`, size: 26 });
    wd.push({ t: 'p', label: prog.best > 0 ? `Your best: ${prog.best}` : 'No score yet', bold: true, color: '#ffe9a0', size: 28 });
    if (demo) wd.push({ t: 'p', label: 'The web demo gives a few runs.', size: 24 });
  }
  if (mode === 'practice') {
    wd.push({ t: 'p', label: 'Pace', bold: true, color: '#ffe9a0', size: 26 });
    PACES.forEach((p, i) => wd.push({ t: 'btn', id: `pace${i}`, label: p.name, row: 9, active: s.pace === i }));
    wd.push({ t: 'p', label: 'Rocking of the horse', bold: true, color: '#ffe9a0', size: 26 });
    SWAYS.forEach((p, i) => wd.push({ t: 'btn', id: `sway${i}`, label: p.name, row: 10, active: s.sway === i }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-replay', label: st.replay === false ? 'Replay camera: Off' : 'Replay camera: On', sub: 'A third-person cut after the strike' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Aim guide: ${GUIDES[st.guide]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'guide-dec', label: 'More help', row: 8, disabled: st.guide === 0 },
    { t: 'btn', id: 'guide-inc', label: 'Less help', row: 8, disabled: st.guide === 2 },
    { t: 'p', label: 'Guided shows the ring and turns it green when a lift is on. Ring only shows a plain ring. Off shows no ring.', size: 22 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Controls: slide a thumb to aim, lift it to strike. Keyboard: arrows slide, Space strikes, 1 2 3 pace, T hint, P pause.', size: 22 },
    { t: 'p', label: 'Language: English', size: 22 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', bold: true, size: 26, color: '#9be8a0' }]
      : [{ t: 'btn', id: 'restore', label: state.restoreBusy ? 'Checking...' : 'Restore purchase', dark: true, disabled: !!state.restoreBusy }]),
    ...(state.restoreMsg && !state.owned ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5, mode = state.mode, R = state.round, rs = state.resultInfo || {};
  const wd = [{ t: 'gap', h: big ? 20 : 36 }];
  if (mode === 'cup' || mode === 'watch') {
    const win = R.total > R.rivalTotal, draw = R.total === R.rivalTotal;
    wd.push({ t: 'h', label: mode === 'watch' ? (win ? 'The rider wins the round' : draw ? 'A draw' : 'The rival wins the round') : win ? 'You win the round!' : draw ? 'A draw: so close' : 'The rival wins the round', size: 52, cap: big ? 1.15 : 1.4 });
    wd.push({ t: 'h', label: `${R.total} – ${R.rivalTotal}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    if (mode === 'cup') wd.push({ t: 'h', label: stars(rs.stars || 0), size: 56, cap: 1.2, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${R.lifts} lifts, ${R.strikes} touches, ${R.misses} misses${R.perfects ? `, ${R.perfects} perfect` : ''}. Best streak ${R.bestStreak}.`, size: 24, cap: big ? 2 : 3 });
    if (mode === 'cup') wd.push({ t: 'p', label: rs.newStar ? 'A new best for this round.' : win ? 'The next round is open.' : `One star needs more than the rival's ${R.rivalTotal}. Two stars: ${STARS_AT[1]}. Three: ${STARS_AT[2]}.`, bold: true, color: '#ffe9a0', size: 26 });
  } else if (mode === 'challenge') {
    wd.push({ t: 'h', label: 'Challenge over', size: 52 });
    wd.push({ t: 'h', label: String(R.total), size: 96, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${R.runIdx} runs, ${R.lifts} lifts, best streak ${R.bestStreak}.${rs.newBest ? ' A new best!' : ` Best ${state.progress.best}.`}`, size: 26, bold: true, color: '#ffe9a0' });
  } else {
    wd.push({ t: 'h', label: 'Practice finished', size: 52 });
    wd.push({ t: 'p', label: `${R.runIdx} runs, ${R.lifts} lifts, ${R.strikes} touches, ${R.misses} misses.`, size: 26 });
  }
  wd.push({ t: 'gap', h: 20 });
  if (mode === 'cup' && rs.canNext) wd.push({ t: 'btn', id: 'next', label: `Next: ${ROUNDS[state.round.idx + 1].name}`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'cup' || mode === 'watch' ? 'Ride the round again' : 'Ride again', primary: !(mode === 'cup' && rs.canNext), h: 84 });
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
    { t: 'p', label: 'You have ridden the free runs of the web demo. The full game on iPhone and Android has all five rounds of the Tournament Cup, the endless Gallop Challenge, Learn drills and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.progress.drills;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 },
    { t: 'p', label: 'Three short drills. Each is a few runs down the real lane with the guide on.', size: 26 },
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
    { t: 'btn', id: 'lesson-go', label: 'Start the drill', primary: true, h: 92 },
    { t: 'btn', id: 'lesson-back', label: 'Back to drills', dark: true },
    { t: 'gap', h: 30 },
  ];
}
export function lessonResultWidgets(state) {
  const l = LESSONS[state.learnCur], r = state.drillResult || { pass: false, got: 0 };
  return [
    { t: 'gap', h: 120 }, { t: 'h', label: r.pass ? 'Drill complete' : 'Not quite yet', size: 52 },
    { t: 'h', label: String(r.got), size: 90, color: '#ffd97a', cap: 1.2 },
    { t: 'p', label: r.pass ? `You reached the goal: ${l.goal}.` : `The goal was: ${l.goal}. Try again.`, size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'lr-again', label: 'Try again', primary: !r.pass },
    ...(r.pass && state.learnCur < LESSONS.length - 1 ? [{ t: 'btn', id: 'lr-next', label: 'Next drill', primary: true }] : []),
    { t: 'btn', id: 'lr-list', label: 'All drills', dark: true },
    { t: 'gap', h: 30 },
  ];
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------------------
function backdrop(ctx, state, a) {
  // the real lane, idling, behind every menu (drawn by game.js through state.sceneBack)
  if (state.sceneBack) state.sceneBack(ctx);
  else { ctx.fillStyle = '#17304a'; ctx.fillRect(0, 0, live.w, live.h); }
  const g = ctx.createLinearGradient(0, 0, 0, live.h);
  g.addColorStop(0, `rgba(10,18,36,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,18,36,${a})`); g.addColorStop(1, `rgba(10,18,36,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, live.w, live.h);
}
function colBand(ctx, c, top, bottom) {
  if (!live.land) return;
  roundPath(ctx, c.x0 - 26, top - 4, c.w0 + 52, bottom - top + 8, 30); ctx.fillStyle = 'rgba(10,18,36,0.5)'; ctx.fill();
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = live.w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(10,18,36,0)'); g.addColorStop(1, 'rgba(10,18,36,0.7)');
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
  const c = colFor('title');
  // frame the hero before the backdrop is drawn
  const LT = build(state, 'title');
  const sp = LT.lay.items.find((i) => i.w && i.w.hero);
  if (c.hero) {
    const blockH = TITLE_H + 40;
    const sc = Math.min(1, (c.hero.w - 30) / TITLE_W, (c.bottom - c.top) * 0.4 / blockH), top = c.top + 8;
    heroRect = { x: c.hero.x, y: top + blockH * sc, w: c.hero.w, h: Math.max(160, c.bottom - top - blockH * sc - 10) };
  } else if (sp) heroRect = { x: 0, y: LT.top + sp.y - Math.min(state.ui.scroll, 0), w, h: sp.h };
  backdrop(ctx, state, 0.0);
  if (c.hero) {
    const blockH = TITLE_H + 40;
    const sc = Math.min(1, (c.hero.w - 30) / TITLE_W, (c.bottom - c.top) * 0.4 / blockH), top = c.top + 8;
    ctx.save(); ctx.translate(c.hero.x + c.hero.w / 2, top); ctx.scale(sc, sc); drawHero(ctx, 0, 0); ctx.restore();
    roundPath(ctx, c.x0 - 22, c.top - 2, c.w0 + 44, c.bottom - c.top + 4, 30); ctx.fillStyle = 'rgba(10,18,36,0.6)'; ctx.fill();
  } else {
    // a soft dark ramp behind the buttons, and a light one under the lettering so it reads on any sky
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const y0 = heroRect ? (heroRect.y + heroRect.h) / h : 0.45;
    g.addColorStop(0, 'rgba(10,18,36,0.45)'); g.addColorStop(Math.min(0.5, 0.2), 'rgba(10,18,36,0)');
    g.addColorStop(Math.max(0.3, y0 - 0.04), 'rgba(10,18,36,0)'); g.addColorStop(Math.min(0.95, y0 + 0.12), 'rgba(10,18,36,0.78)'); g.addColorStop(1, 'rgba(10,18,36,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
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
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.6);
  const pins = setupPins(), w = live.w, h = live.h;
  drawFlowScreen(ctx, state, 'setup');
  const g = ctx.createLinearGradient(0, pins.bar.y, 0, h);
  g.addColorStop(0, 'rgba(10,18,36,0)'); g.addColorStop(0.2, 'rgba(10,18,36,0.88)'); g.addColorStop(1, 'rgba(10,18,36,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, pins.bar.y, w, pins.bar.h);
  const m = state.setup.mode;
  drawButton(ctx, pins.start, m === 'watch' ? 'Watch the round' : m === 'practice' ? 'Start practice' : 'To the lane', { primary: true, size: 32 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${fz(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, w / 2, pins.bar.y + 20); }
}
const flowScreen = (key, a) => (ctx, state) => { backdrop(ctx, state, a); drawFlowScreen(ctx, state, key); };
export const renderSettings = flowScreen('settings', 0.66);
export const renderResult = flowScreen('result', 0.55);
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
  ctx.fillStyle = 'rgba(10,18,36,0.6)'; ctx.fillRect(0, 0, live.w, live.h);
  const L = pauseGeom(state), { lay, top: y0, bottom } = L, ch = bottom - y0;
  panel(ctx, L.panel.x, y0 - 20, L.panel.w, ch + 40, { r: 30, fill: 'rgba(20,30,56,0.96)', stroke: 'rgba(255,246,228,0.45)' });
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, L.panel.x, L.panel.w);
}

// ---- reference pages (Rules, How to Play, About): ONE scrolling column inside the panel ------------------------------------------------
export const REF_VIEW = { top: 0, bottom: 0 };
let REF = { max: 0, vh: 1, total: 0 };
export const refMeta = () => REF;
const ART_H = { lane: 270, timing: 270 };
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
    const artH = sec.art ? ART_H[sec.art] : 0;
    const blk = { y, tl, titleH, art: sec.art || null, artH, lines, rule: si > 0 };
    let h = (blk.rule ? 16 : 0) + titleH + artH;
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
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(250,246,236,0.97)', stroke: 'rgba(20,30,56,0.6)' });
  const cx = P.x + P.w / 2, hy = P.y + R.headH - 40;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1d3a68'; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, cx, hy);
  ctx.strokeStyle = 'rgba(20,30,56,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, hy + 20); ctx.lineTo(P.x + P.w - 60, hy + 20); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 8, top, P.w - 16, vh); ctx.clip();
  for (const blk of F.blocks) {
    let y = top + blk.y - scroll;
    if (y > bottom || y + blk.h < top) continue;
    if (blk.rule) { ctx.strokeStyle = 'rgba(20,30,56,0.2)'; ctx.beginPath(); ctx.moveTo(P.x + 80, y + 4); ctx.lineTo(P.x + P.w - 80, y + 4); ctx.stroke(); y += 16; }
    ctx.textAlign = 'center'; ctx.fillStyle = '#b0381e'; ctx.font = `700 ${F.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, cx, y + F.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { drawArt(blk.art, ctx, P.x + 40, y, P.w - 80, blk.artH - 12); y += blk.artH; }
    ctx.fillStyle = '#1c2230'; ctx.font = `400 ${F.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += F.lh * 0.45; ctx.fillText(l.text, P.x + 40, y + F.fs * 0.85); y += F.lh; });
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, vh * vh / F.total), ty = top + (scroll / max) * (vh - th);
    roundPath(ctx, P.x + P.w - 18, ty, 7, th, 3.5); ctx.fillStyle = 'rgba(20,30,56,0.45)'; ctx.fill();
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, bottom - 70, 0, bottom); g.addColorStop(0, 'rgba(250,246,236,0)'); g.addColorStop(1, 'rgba(250,246,236,0.97)'); ctx.fillStyle = g; ctx.fillRect(P.x + 10, bottom - 70, P.w - 20, 70);
      roundPath(ctx, cx - 64, bottom - 42, 128, 36, 18); ctx.fillStyle = '#1d3a68'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ scroll', cx, bottom - 23);
    }
    if (scroll > 4) {
      roundPath(ctx, cx - 46, top + 6, 92, 34, 17); ctx.fillStyle = '#1d3a68'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 23);
    }
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(20,30,56,0.75)';
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
function arrow(ctx, x0, y0, x1, y1, col = '#b0381e', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9cc4e8'); g.addColorStop(0.4, '#d3e1ea'); g.addColorStop(0.41, '#6fa83f'); g.addColorStop(1, '#5a8f34');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (key === 'lane') {
    // looking down the lane from above: start line, the rider, the ring and the peg
    const lx0 = x + w * 0.2, lx1 = x + w * 0.8, ly0 = y + 14, ly1 = y + h - 14;
    ctx.fillStyle = '#d9bd8a'; ctx.fillRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
    ctx.fillStyle = '#fff'; ctx.fillRect(lx0, ly0, 4, ly1 - ly0); ctx.fillRect(lx1 - 4, ly0, 4, ly1 - ly0);
    ctx.fillRect(lx0, ly1 - 8, lx1 - lx0, 4);
    const cxl = (lx0 + lx1) / 2;
    ctx.save(); ctx.translate(cxl - 50, ly1 - 46);
    ctx.fillStyle = '#8a4a22'; roundPath(ctx, -14, -30, 28, 70, 12); ctx.fill();
    ctx.fillStyle = '#2d4a86'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#6a4120'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cxl - 40, ly1 - 40); ctx.lineTo(cxl + 8, ly1 - 120); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cxl + 10, ly1 - 130, 16, 8, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#c28a46'; ctx.fillRect(cxl + 6, ly0 + 38, 10, 10);
    ctx.strokeStyle = '#d6453d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cxl + 11, ly0 + 44, 26, 12, 0, 0, TAU); ctx.stroke();
    arrow(ctx, cxl - 60, ly1 - 90, cxl - 60, ly0 + 70, '#1d3a68', 4);
    label(ctx, 'ride', cxl - 92, ly1 - 140, 22, '#1d3a68');
    label(ctx, 'peg', cxl + 70, ly0 + 50, 22, '#7a2410', 'left');
    label(ctx, 'ring', cxl + 40, ly1 - 125, 22, '#1c2230', 'left');
    label(ctx, 'start', lx1 - 10, ly1 - 14, 20, '#1c2230', 'right');
  } else if (key === 'timing') {
    // the ring approaching the peg on a time line: windows either side of the perfect moment
    const mx = x + w / 2, by = y + h * 0.62;
    const win = (half, col, name, yy) => { ctx.fillStyle = col; roundPath(ctx, mx - half, yy, half * 2, 30, 8); ctx.fill(); label(ctx, name, mx, yy + 52, 20, '#1c2230'); };
    const k = w * 0.34;
    win(k, 'rgba(255,255,255,0.8)', 'touch window', y + 30);
    win(k * 0.55, 'rgba(255,212,90,0.95)', 'lift window', y + 94);
    win(k * 0.22, 'rgba(109,255,154,0.95)', 'perfect', y + 158);
    ctx.strokeStyle = '#7a2410'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, y + 18); ctx.lineTo(mx, y + h - 14); ctx.stroke();
    arrow(ctx, x + 24, by + 40, mx - k - 10, by + 40, '#1d3a68', 4);
    label(ctx, 'ring approaches the peg', x + 24, by + 74, 20, '#1d3a68', 'left');
  }
  ctx.restore();
}
