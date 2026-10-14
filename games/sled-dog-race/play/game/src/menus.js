// Every screen that is not the lane: title, set-up, learn, settings, result, pause, demo limit and the scrolling About / How to Play / Rules reader
// with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { live, host, TEXT_SCALES, THINK_STEPS, colFor, setupPins, refLayout, MIN_FONT, fz } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { RACES, LESSONS, TRAIL_LIVES, STAR_CARE, DOGS, RIVALS } from './consts.js';
import { LOOKS } from './scene.js';
import { drawDog } from './art.js';
import { drawLockup, drawMoreLine, LOCKUP_RATIO } from './brand.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const GUIDES = ['Full cues', 'Signs only', 'No cues'];
export const fmt = (v) => `${(Math.round(v * 10) / 10).toFixed(1)} s`;
export const clock = (v) => { v = Math.max(0, v); const mm = Math.floor(v / 60), s = v - mm * 60; return `${mm}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
const ordn = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || `${n}th`;
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

// With the 3D scene on, a clear band is left under the title lettering where the team charges toward the viewer (see view3d/presenter.js).
const heroGap = () => (v3.on ? Math.round(Math.max(0, Math.min(250, (live.h - 1100) * 0.5))) : 0);
const heroArt = () => {
  const hk = live.h < 1000 ? 0.66 : live.h < 1200 ? 0.78 : 1, gap = heroGap();
  return { t: 'art', hero: true, gap, hk, h: Math.round(330 * hk) + gap, draw(ctx, w) { ctx.save(); ctx.scale(hk, hk); drawHero(ctx, w / hk / 2, 0); ctx.restore(); } };
};
// Embossed ice lettering: a deep shadow, a dark bevel, a frosty gradient face and a thin bright rim light.
function drawHero(ctx, cx, y) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 28px ${FONT}`; ctx.fillStyle = '#bfe3ff'; ctx.shadowColor = 'rgba(0,10,40,0.8)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('THE TRAIL RACE', cx, y + 52);
  const word = (t, yy) => {
    ctx.font = `900 112px ${DISPLAY}`;
    ctx.shadowColor = 'rgba(0,6,30,0.75)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; ctx.fillStyle = '#0a1a40'; ctx.fillText(t, cx, yy + 6);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = '#13306e'; ctx.strokeText(t, cx, yy);
    const g = ctx.createLinearGradient(0, yy - 96, 0, yy + 6); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#d6ecff'); g.addColorStop(1, '#8fbff0');
    ctx.fillStyle = g; ctx.fillText(t, cx, yy);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.strokeText(t, cx, yy - 1);
  };
  word('Sled Dog', y + 156); word('Race', y + 256);
  ctx.font = `italic 600 32px ${FONT}`; ctx.fillStyle = '#cfe8ff'; ctx.shadowColor = 'rgba(0,10,40,0.8)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('United States and Canada', cx, y + 304);
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

const stars = (n, of = 3) => '\u2605'.repeat(n) + '\u2606'.repeat(of - n);
export function titleWidgets(state) {
  const split = !!colFor('title').hero, tight = !live.land && live.h < 1200;
  const bh = tight ? 70 : 80;
  const c = state.progress, nextRace = Math.min(RACES.length - 1, c.stars.findIndex((s) => s === 0) < 0 ? RACES.length - 1 : c.stars.findIndex((s) => s === 0));
  return [
    ...(split ? [] : [heroArt()]),
    { t: 'btn', id: 'cup', label: 'Trail Cup', sub: `Next: ${RACES[nextRace].name}`, primary: true, h: tight ? 78 : 90 },
    { t: 'btn', id: 'trail', label: 'Trail Run', sub: c.best > 0 ? `Best ${c.best}` : 'An endless trail, three strikes', h: bh },
    { t: 'btn', id: 'practice', label: 'Practice', h: bh, row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn', h: bh, row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The computer drives and explains', h: bh },
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
  const title = mode === 'cup' ? 'Trail Cup' : mode === 'trail' ? 'Trail Run' : mode === 'practice' ? 'Practice' : 'Watch & Learn';
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 46 }];
  const prog = state.progress;
  if (mode === 'cup' || mode === 'watch' || mode === 'practice') {
    wd.push({ t: 'p', label: mode === 'cup' ? 'Choose a race. Finish in the top two to open the next.' : mode === 'watch' ? 'Choose the race the computer drives.' : 'Choose a trail to practise on.', bold: true, color: '#ffe9a0', size: 26 });
    RACES.forEach((r, i) => {
      const open = i === 0 || prog.stars[i - 1] > 0 || mode !== 'cup' || state.dev;
      const locked = !open || (demo && i > 1);
      wd.push({ t: 'btn', id: `rd${i}`, label: `${i + 1}. ${r.name}`, sub: locked ? (demo && i > 1 && open ? 'In the full game' : 'Place in the top two in the race before') : `${mode === 'cup' ? `${stars(prog.stars[i])}  \u00b7  ` : ''}${r.legs.length} legs  \u00b7  ${r.place}`, active: s.race === i && !locked, disabled: locked, hitDisabled: true, h: 90 });
    });
  }
  if (mode === 'trail') {
    wd.push({ t: 'p', label: `An endless trail: leg after leg with a checkpoint after each. Every leg has a target time. A leg well over its target, or one that ends with a dog in the sled bag, is a strike. ${TRAIL_LIVES} strikes end the run.`, size: 26 });
    wd.push({ t: 'p', label: prog.best > 0 ? `Your best: ${prog.best}` : 'No score yet', bold: true, color: '#ffe9a0', size: 28 });
    if (demo) wd.push({ t: 'p', label: 'The web demo gives a few legs.', size: 24 });
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
    { t: 'p', label: `Cues: ${GUIDES[st.guide]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'guide-dec', label: 'More cues', row: 8, disabled: st.guide === 0 },
    { t: 'btn', id: 'guide-inc', label: 'Fewer cues', row: 8, disabled: st.guide === 2 },
    { t: 'p', label: 'Full cues shows reminders for junctions, steep hills and tired dogs. Signs only shows just the call marker. No cues shows nothing.', size: 22 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Controls: slide a thumb along the pace lever; Haw, Brake and Gee buttons; tap the trail to praise. Keyboard: Up and Down pace, Left and Right Haw and Gee, Space brake, T hint, P pause.', size: 22 },
    { t: 'p', label: 'Language: English', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5, mode = state.mode, R = state.round, rs = state.resultInfo || {};
  const wd = [{ t: 'gap', h: big ? 20 : live.land ? 8 : 36 }];
  if (mode === 'cup' || mode === 'watch' || mode === 'practice') {
    const place = rs.place || 4;
    wd.push({ t: 'h', label: place === 1 ? (mode === 'watch' ? 'The team wins the race' : 'You win the race!') : place === 2 ? 'Second place' : `${ordn(place)} place`, size: live.land ? 40 : 52, cap: big ? 1.15 : 1.4 });
    wd.push({ t: 'h', label: clock(rs.time || 0), size: live.land ? 50 : 66, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    if (mode === 'cup') wd.push({ t: 'h', label: stars(rs.stars || 0), size: live.land ? 40 : 56, cap: 1.2, color: '#ffd97a' });
    wd.push({ t: 'p', label: `Care score ${Math.round((rs.care || 0) * 100)}%${rs.careAward ? ': the Care Award is yours' : `. The Care Award needs ${Math.round(STAR_CARE * 100)}%`}. ${rs.carried ? `${rs.carried} ${rs.carried === 1 ? 'dog was' : 'dogs were'} carried. ` : ''}${rs.detours ? `${rs.detours} ${rs.detours === 1 ? 'detour' : 'detours'}.` : ''}`, bold: true, color: rs.careAward ? '#7ff0b0' : '#ffe9a0', size: 26, cap: big ? 2 : 3 });
    if (live.land) wd.push({ t: 'p', label: (rs.times || []).map((t) => `${t.me ? '\u25b6 ' : ''}${t.name} ${clock(t.time)}`).join('  \u00b7  '), size: 22, cap: 1.6 });
    else (rs.times || []).forEach((t) => wd.push({ t: 'p', label: `${t.name}  ${clock(t.time)}`, size: 24, color: t.me ? '#ffd97a' : undefined, bold: !!t.me }));
    if (mode === 'cup') wd.push({ t: 'p', label: rs.newStar ? 'A new best for this race.' : rs.canNext ? 'The next race is open.' : place > 2 ? 'Finish in the top two to open the next race.' : '', bold: true, color: '#ffe9a0', size: 26 });
  } else if (mode === 'trail') {
    wd.push({ t: 'h', label: 'Trail Run over', size: 52 });
    wd.push({ t: 'h', label: String(R.score), size: 96, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${R.legsDone} ${R.legsDone === 1 ? 'leg' : 'legs'} run.${rs.newBest ? ' A new best!' : ` Best ${state.progress.best}.`}`, size: 26, bold: true, color: '#ffe9a0' });
  } else {
    wd.push({ t: 'h', label: 'Run finished', size: 52 });
  }
  wd.push({ t: 'gap', h: 20 });
  if (mode === 'cup' && rs.canNext) wd.push({ t: 'btn', id: 'next', label: `Next: ${RACES[state.round.idx + 1].name}`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'trail' ? 'Run again' : 'Race again', primary: !(mode === 'cup' && rs.canNext), h: 84 });
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
    { t: 'p', label: 'You have driven the free legs of the web demo. The full game on iPhone and Android has all five races of the Trail Cup, the endless Trail Run, Learn drills and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.progress.drills;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 },
    { t: 'p', label: 'Three short drills on the real trail.', size: 26 },
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
    { t: 'btn', id: 'lesson-go', label: 'To the start', primary: true, h: 92 },
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
  else { ctx.fillStyle = '#0c1a3a'; ctx.fillRect(0, 0, live.w, live.h); }
  const g = ctx.createLinearGradient(0, 0, 0, live.h);
  g.addColorStop(0, `rgba(6,14,40,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,14,40,${a})`); g.addColorStop(1, `rgba(6,14,40,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, live.w, live.h);
}
function colBand(ctx, c, top, bottom) {
  if (!live.land) return;
  roundPath(ctx, c.x0 - 26, top - 4, c.w0 + 52, bottom - top + 8, 30); ctx.fillStyle = 'rgba(6,14,40,0.5)'; ctx.fill();
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = live.w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,14,40,0)'); g.addColorStop(1, 'rgba(6,14,40,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 54, bottom - 46, 108, 38, 19); ctx.fillStyle = 'rgba(244,248,255,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 26);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 54, top + 8, 108, 38, 19); ctx.fillStyle = 'rgba(244,248,255,0.92)'; ctx.fill();
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
    roundPath(ctx, p.c.x0 + p.c.w0 + 12, ty, 6, th, 3); ctx.fillStyle = 'rgba(244,248,255,0.5)'; ctx.fill();
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
    roundPath(ctx, c.x0 - 22, c.top - 2, c.w0 + 44, c.bottom - c.top + 4, 30); ctx.fillStyle = 'rgba(6,14,40,0.55)'; ctx.fill();
  } else {
    const g = ctx.createLinearGradient(0, h * 0.28, 0, h); g.addColorStop(0, 'rgba(6,14,40,0)'); g.addColorStop(1, 'rgba(6,14,40,0.82)');
    ctx.fillStyle = g; ctx.fillRect(0, h * 0.28, w, h * 0.72);
  }
  const fr = drawFlowScreen(ctx, state, 'title', false);
  { // where the 3D hero (the team charging toward the viewer) goes
    const ha = fr.lay.items.find((i) => i.w.hero);
    if (c.hero) {
      const blockH = 306 + 28, sc = Math.min(1, (c.hero.w - 30) / 560, (c.bottom - c.top) / blockH), t0 = c.top + Math.max(0, (c.bottom - c.top - blockH * sc) / 2) + blockH * sc;
      v3.hero = { cx: c.hero.x + c.hero.w / 2, cy: (t0 + c.bottom) / 2, w: c.hero.w, h: c.bottom - t0 };
    } else if (ha) v3.hero = { cx: live.w / 2, cy: fr.top + ha.y - fr.scroll + 330 * ha.w.hk + ha.w.gap / 2, w: live.w, h: ha.w.gap };
    else v3.hero = null;
  }
  titleLockTap = null;
  const it = fr.lay.items.find((i) => i.w && i.w.brand);
  if (it) {
    const lw = Math.min(it.wd - 30, LOCK_CAP), lh = Math.round(lw * LOCKUP_RATIO), cx = it.x + it.wd / 2, cy = fr.top + it.y - fr.scroll + 10 + lh / 2;
    const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw, m), th = Math.max(lh, m);
    if (cy - th / 2 >= fr.top - 4 && cy + th / 2 <= fr.bottom + 4) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(244,248,255,0.6)'; ctx.fillText('Web demo', w / 2, h - 14 - host.b); }
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.78);
  const pins = setupPins(), w = live.w, h = live.h;
  drawFlowScreen(ctx, state, 'setup');
  const g = ctx.createLinearGradient(0, pins.bar.y, 0, h);
  g.addColorStop(0, 'rgba(6,14,40,0)'); g.addColorStop(0.2, 'rgba(6,14,40,0.88)'); g.addColorStop(1, 'rgba(6,14,40,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, pins.bar.y, w, pins.bar.h);
  const m = state.setup.mode;
  drawButton(ctx, pins.start, m === 'watch' ? 'Watch the race' : m === 'practice' ? 'Start practice' : 'To the start', { primary: true, size: 32 });
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
  ctx.fillStyle = 'rgba(6,14,40,0.6)'; ctx.fillRect(0, 0, live.w, live.h);
  const L = pauseGeom(state), { lay, top: y0, bottom } = L, ch = bottom - y0;
  panel(ctx, L.panel.x, y0 - 20, L.panel.w, ch + 40, { r: 30, fill: 'rgba(14,26,58,0.96)', stroke: 'rgba(190,220,255,0.45)' });
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, L.panel.x, L.panel.w);
}

// ---- reference pages (Rules, How to Play, About): ONE scrolling column inside the panel ------------------------------------------------
export const REF_VIEW = { top: 0, bottom: 0 };
let REF = { max: 0, vh: 1, total: 0 };
export const refMeta = () => REF;
const ART_H = { trail: 300, team: 280 };
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
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(244,248,255,0.97)', stroke: 'rgba(14,26,58,0.6)' });
  const cx = P.x + P.w / 2, hy = P.y + R.headH - 40;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1d3f78'; ctx.font = `700 ${Math.round(44 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, cx, hy);
  ctx.strokeStyle = 'rgba(14,26,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, hy + 20); ctx.lineTo(P.x + P.w - 60, hy + 20); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 8, top, P.w - 16, vh); ctx.clip();
  for (const blk of F.blocks) {
    let y = top + blk.y - scroll;
    if (y > bottom || y + blk.h < top) continue;
    if (blk.rule) { ctx.strokeStyle = 'rgba(14,26,58,0.2)'; ctx.beginPath(); ctx.moveTo(P.x + 80, y + 4); ctx.lineTo(P.x + P.w - 80, y + 4); ctx.stroke(); y += 16; }
    ctx.textAlign = 'center'; ctx.fillStyle = '#b0481a'; ctx.font = `700 ${F.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, cx, y + F.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { drawArt(blk.art, ctx, P.x + 40, y, P.w - 80, blk.artH - 12); y += blk.artH; }
    ctx.fillStyle = '#16233a'; ctx.font = `400 ${F.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += F.lh * 0.45; ctx.fillText(l.text, P.x + 40, y + F.fs * 0.85); y += F.lh; });
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, vh * vh / F.total), ty = top + (scroll / max) * (vh - th);
    roundPath(ctx, P.x + P.w - 18, ty, 7, th, 3.5); ctx.fillStyle = 'rgba(14,26,58,0.45)'; ctx.fill();
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, bottom - 70, 0, bottom); g.addColorStop(0, 'rgba(244,248,255,0)'); g.addColorStop(1, 'rgba(244,248,255,0.97)'); ctx.fillStyle = g; ctx.fillRect(P.x + 10, bottom - 70, P.w - 20, 70);
      roundPath(ctx, cx - 64, bottom - 42, 128, 36, 18); ctx.fillStyle = '#1d3f78'; ctx.fill();
      ctx.fillStyle = '#f4f8ff'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ scroll', cx, bottom - 23);
    }
    if (scroll > 4) {
      roundPath(ctx, cx - 46, top + 6, 92, 34, 17); ctx.fillStyle = '#1d3f78'; ctx.fill();
      ctx.fillStyle = '#f4f8ff'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 23);
    }
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(14,26,58,0.75)';
  const pages = Math.max(1, Math.ceil(F.total / vh)), cur = max <= 0 ? 1 : Math.min(pages, 1 + Math.round(scroll / max * (pages - 1)));
  ctx.fillText(`${max > 0 ? `Screen ${cur} of ${pages}   ` : ''}Text ${Math.round(sc * 100)}%`, cx, P.y + P.h - (R.foot > 40 ? 22 : 8));
  drawButton(ctx, R.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 32 });
  drawButton(ctx, R.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 32 });
  drawButton(ctx, R.back, scroll <= 4 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, R.next, scroll >= max - 4 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- diagrams ----------------------------------------------------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#16233a', align = 'center') {
  size = Math.max(MIN_FONT, size);
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#b0481a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#bcd9f2'); g.addColorStop(1, '#eef6ff');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (key === 'trail') {
    // a leg in profile: hills, a steep descent with its warning, rough ice, a junction sign, the checkpoint
    const base = y + h - 46, amp = 70, X = (u) => x + 24 + u * (w - 48);
    const prof = (u) => base - 30 - amp * (0.5 + 0.38 * Math.sin(u * 8 + 0.5) + 0.12 * Math.sin(u * 19));
    ctx.beginPath(); ctx.moveTo(X(0), y + h);
    for (let u = 0; u <= 1.001; u += 0.01) ctx.lineTo(X(u), prof(u));
    ctx.lineTo(X(1), y + h); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#7da0c4'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(120,190,245,0.6)'; ctx.fillRect(X(0.55), prof(0.6) - 8, X(0.72) - X(0.55), 14);
    label(ctx, 'rough ice', (X(0.55) + X(0.72)) / 2, prof(0.6) + 36, 22, '#1d3f78');
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(X(0.2), prof(0.2) - 70); ctx.lineTo(X(0.2) + 24, prof(0.2) - 46); ctx.lineTo(X(0.2), prof(0.2) - 22); ctx.lineTo(X(0.2) - 24, prof(0.2) - 46); ctx.closePath(); ctx.fill();
    label(ctx, 'steep: Brake', X(0.2), prof(0.2) - 80, 22, '#16233a');
    ctx.fillStyle = '#f2a63a'; ctx.beginPath(); ctx.roundRect(X(0.42) - 38, prof(0.42) - 78, 76, 32, 6); ctx.fill();
    label(ctx, 'GEE', X(0.42), prof(0.42) - 54, 22, '#3a1a06');
    label(ctx, 'sign: call Gee', X(0.42), prof(0.42) - 90, 22, '#16233a');
    ctx.fillStyle = '#2a9d8f'; ctx.fillRect(X(0.95) - 2, prof(0.95) - 90, 4, 80); ctx.fillRect(X(0.95), prof(0.95) - 90, 40, 24);
    label(ctx, 'checkpoint', X(0.93), prof(0.95) - 100, 22, '#16233a', 'center');
  } else if (key === 'team') {
    // the team in a line: leaders, swing, wheel, sled
    const gy = y + h - 36;
    const pos = [[0.84, 0], [0.7, 1], [0.56, 2], [0.42, 3], [0.28, 4], [0.14, 5]];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, gy, w, h - (gy - y));
    pos.forEach(([u, i]) => drawDog(ctx, x + w * u - 10, gy, 30, 0.1 + i * 0.13, { coat: DOGS[i].coat, gait: 2, pose: 'stand', dim: i & 1 ? 0.3 : 0 }));
    label(ctx, 'leaders', x + w * 0.78, y + 34, 24, '#16233a'); label(ctx, 'swing dogs', x + w * 0.49, y + 34, 24, '#16233a'); label(ctx, 'wheel dogs', x + w * 0.21, y + 34, 24, '#16233a');
  }
  ctx.restore();
}
