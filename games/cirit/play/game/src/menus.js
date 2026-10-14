// Every screen that is not the play screen: title, set-up, learn, settings, result, pause and the scrolling About / How to Play / Rules reader
// with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { live, host, TEXT_SCALES, THINK_STEPS, colFor, setupPins, refLayout, MIN_FONT, fz } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, HORSES, COSTUMES, BOUTS, CUP } from './consts.js';
import { drawLockup, drawMoreLine, LOCKUP_RATIO } from './brand.js';
import { LESSONS } from './content.js';

const TAU = Math.PI * 2;
export const GUIDES = ['Guided', 'Arc only', 'Off'];
// Layout is measured with ONE context in both update (hit-testing) and render (drawing), so a tap always lands on what is drawn.
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
  const free = lay ? Math.max(0, bottom - top - lay.contentH) : 0;
  const oy = key === 'title' && !live.land ? Math.floor(free * 0.86) : Math.floor(free / 2);   // the title sits low so the 3D hero rider has the top of the phone
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

const compactTitle = () => !live.land && live.h < 1100;   // 4:3 tablets in portrait: the whole title (with Continue) fits without scrolling
const heroArt = () => { const hk = compactTitle() ? 0.52 : live.h < 1200 ? 0.78 : 1; return { t: 'art', h: Math.round(330 * hk), draw(ctx, w) { ctx.save(); ctx.scale(hk, hk); drawHero(ctx, w / hk / 2, 0); ctx.restore(); } }; };
function drawHero(ctx, cx, y) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // kicker on a small dark plate
  ctx.font = `800 27px ${FONT}`;
  const kw = ctx.measureText('THE HORSEBACK JAVELIN GAME').width + 48;
  roundPath(ctx, cx - kw / 2, y + 36, kw, 46, 23); ctx.fillStyle = 'rgba(24,10,4,0.62)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(226,184,102,0.85)'; ctx.stroke();
  ctx.fillStyle = '#ffe3a0'; ctx.fillText('THE HORSEBACK JAVELIN GAME', cx, y + 68);
  // the title: embossed gold lettering (dark extrusion, gold gradient face, a bright rim light)
  const T = 'Cirit', fy = y + 214;
  ctx.font = `800 164px ${DISPLAY}`;
  for (let i = 9; i >= 1; i--) { ctx.fillStyle = `rgb(${70 - i * 3},${34 - i * 2},${10})`; ctx.fillText(T, cx + i * 0.6, fy + i * 1.1); }
  ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#2a1204'; ctx.strokeText(T, cx, fy);
  const g = ctx.createLinearGradient(0, fy - 130, 0, fy + 6); g.addColorStop(0, '#fff3c0'); g.addColorStop(0.45, '#f0c24e'); g.addColorStop(0.55, '#d79a22'); g.addColorStop(1, '#9a5f12');
  ctx.fillStyle = g; ctx.fillText(T, cx, fy);
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,248,214,0.8)'; ctx.strokeText(T, cx - 1, fy - 1.5);
  // an ornament line with a small diamond, then the second line
  ctx.strokeStyle = 'rgba(226,184,102,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 190, y + 244); ctx.lineTo(cx - 24, y + 244); ctx.moveTo(cx + 24, y + 244); ctx.lineTo(cx + 190, y + 244); ctx.stroke();
  ctx.fillStyle = '#f0c24e'; ctx.beginPath(); ctx.moveTo(cx, y + 232); ctx.lineTo(cx + 12, y + 244); ctx.lineTo(cx, y + 256); ctx.lineTo(cx - 12, y + 244); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.font = `italic 400 34px ${DISPLAY}`; ctx.fillStyle = '#ffe3a0';
  ctx.fillText('jereed  ·  Turkey', cx, y + 296);
  ctx.restore();
}
let titleLockTap = null, lockDownNow = false;
export const getLockTap = () => titleLockTap;
export const setLockDown = (v) => { lockDownNow = v; };
const LOCK_CAP = 300;
const lockupArt = (cap = LOCK_CAP) => ({ t: 'art', brand: true, h: Math.round(cap * LOCKUP_RATIO) + 40, draw(ctx, w) {
  const lw = Math.min(w - 30, cap), lh = Math.round(lw * LOCKUP_RATIO);
  ctx.save(); ctx.fillStyle = lockDownNow ? 'rgba(255,226,122,0.5)' : 'rgba(30,14,6,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 20 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, w / 2, 20, lw, 1);
} });

export function titleWidgets(state) {
  const sv = state.saved, split = !!colFor('title').hero, tight = !live.land && live.h < 1200;
  const cmp = compactTitle(), bh = cmp ? 58 : tight ? 70 : 82, sh = cmp ? 56 : 70;
  return [
    ...(split ? [] : [heroArt()]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue', sub: sv.label, primary: true, h: cmp ? 66 : 88 }] : []),
    { t: 'btn', id: 'cup', label: 'Festival Cup', sub: state.cup && state.cup.stage > 0 && !state.cup.over ? `${CUP[Math.min(2, state.cup.stage)].name} next` : 'Three matches to the final', primary: !sv, h: cmp ? 66 : tight ? 78 : 90 },
    { t: 'btn', id: 'friendly', label: 'Friendly match', h: bh, row: 1 },
    { t: 'btn', id: 'practice', label: 'Practice', h: bh, row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Four short drills', h: bh },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The computer plays and explains', h: bh },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2, h: sh },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2, h: sh },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: sh },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3, h: sh },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3, h: sh },
    ...(split ? [] : [lockupArt(cmp ? 200 : LOCK_CAP)]),
  ];
}

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, mode = s.mode;
  const title = mode === 'cup' ? `Festival Cup: ${CUP[Math.min(2, state.cup.stage)].name}` : mode === 'friendly' ? 'Friendly match' : mode === 'practice' ? 'Practice' : 'Watch & Learn';
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 46 }];
  const wide = isWide();
  if (mode === 'cup') {
    const L = LEVELS[CUP[Math.min(2, state.cup.stage)].lvl - 1];
    wd.push({ t: 'p', label: `Your rivals: ${L.name} ${stars(L.stars)}`, bold: true, color: '#ffe9a0', size: 26 });
  }
  if (mode === 'friendly') {
    wd.push({ t: 'p', label: 'Rival team', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : stars(l.stars), active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 80, row: wide ? 12 + (i < 3 ? 0 : 1) : undefined });
    });
    wd.push({ t: 'p', label: 'Bouts', bold: true, color: '#ffe9a0', size: 26 });
    BOUTS.forEach((b, i) => wd.push({ t: 'btn', id: `len${i}`, label: `${b} bouts`, row: 9, active: s.boutsIdx === i, disabled: demo && i > 0, hitDisabled: true }));
  }
  if (mode === 'practice') {
    wd.push({ t: 'p', label: 'What to practise', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'pr-attack', label: 'Chase and throw', row: 15, active: s.practice === 'attack' });
    wd.push({ t: 'btn', id: 'pr-defend', label: 'Flee and dodge', row: 15, active: s.practice === 'defend' });
    wd.push({ t: 'p', label: 'The other rider', bold: true, color: '#ffe9a0', size: 26 });
    [1, 2, 3].forEach((l, i) => wd.push({ t: 'btn', id: `opp${l}`, label: LEVELS[l - 1].name, row: 16, active: s.opp === l, h: 70, disabled: demo && i > 1, hitDisabled: true }));
  }
  if (mode === 'watch') {
    wd.push({ t: 'p', label: 'Team on the left (your colours)', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push({ t: 'p', label: 'Team on the right', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, active: s.opp === i + 1, row: 30 + (i < 3 ? 0 : 1), h: 70 }));
  }
  if (mode !== 'watch' && mode !== 'practice') {
    wd.push({ t: 'p', label: 'Your colours', bold: true, color: '#ffe9a0', size: 26 });
    COSTUMES.forEach((c, i) => wd.push({ t: 'btn', id: `cos${i}`, label: c.name, active: s.costume === i, h: 70, row: wide ? 40 + (i >> 1) : undefined }));
    wd.push({ t: 'p', label: 'Your riders go out in this order. Tap one to send it out earlier.', bold: true, color: '#ffe9a0', size: 24 });
    s.order.forEach((hi, k) => {
      const H = HORSES[hi];
      wd.push({ t: 'btn', id: `ord${k}`, label: `Bout ${k + 1}: ${H.name} (${H.title})`, sub: `${H.blurb}`, h: 96, active: k === 0 });
    });
  }
  if (mode === 'practice') {
    wd.push({ t: 'p', label: 'Your horse', bold: true, color: '#ffe9a0', size: 26 });
    HORSES.forEach((H, i) => wd.push({ t: 'btn', id: `hor${i}`, label: `${H.name} (${H.title})`, sub: H.blurb, active: s.order[0] === i, h: 90 }));
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
    { t: 'p', label: `Aim guide: ${GUIDES[st.guide]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'guide-dec', label: 'More help', row: 8, disabled: st.guide === 0 },
    { t: 'btn', id: 'guide-inc', label: 'Less help', row: 8, disabled: st.guide === 2 },
    { t: 'p', label: 'Guided puts the ring where a steady runner will be and shows the flight arc. Arc only shows the arc. Off shows just the ring.', size: 22 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Controls: pace bar on the left, drag the ring on the right to aim, release to throw. Keyboard: W/S pace, arrows ring or lane, Space throw or lean, T hint, P pause.', size: 22 },
    { t: 'p', label: 'Language: English', size: 22 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', bold: true, color: '#ffe9a0', size: 26 }]
      : [{ t: 'btn', id: 'restore', label: 'Restore purchase', dark: true, disabled: state.restoreBusy }]),
    ...(!state.demo && !state.owned && state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5, mode = state.mode;
  const watch = mode === 'watch';
  const title = watch ? (s.winner < 0 ? 'A draw' : `${s.winner === 0 ? 'Left' : 'Right'} team wins`) : s.winner < 0 ? 'A draw' : s.winner === 0 ? 'You win the match!' : 'The rivals win';
  const a = s.stats[0], b = s.stats[1];
  const wd = [{ t: 'gap', h: big ? 20 : 36 }, { t: 'h', label: title, size: 54, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${s.score[0]} – ${s.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: `${watch ? 'Left' : 'You'}: ${a.hits} hits (${a.bulls} bullseyes), ${a.dodges} dodges (${a.leanDodges} leans), best throw ${a.best}.   ${watch ? 'Right' : 'Rivals'}: ${b.hits} hits, ${b.dodges} dodges.`, size: 24, cap: big ? 2 : 3 });
  if (mode === 'cup') {
    const c = state.cup;
    if (c.over) wd.push({ t: 'p', label: c.champion ? 'Festival champion! All three matches won.' : 'Knocked out of the cup. Try again from the quarter-final.', bold: true, color: '#ffe9a0', size: 28 });
    else wd.push({ t: 'p', label: `Through to the ${CUP[c.stage].name}.`, bold: true, color: '#ffe9a0', size: 28 });
  }
  wd.push({ t: 'gap', h: 20 });
  if (mode === 'cup' && state.cup && !state.cup.over) wd.push({ t: 'btn', id: 'next', label: `Next: ${CUP[state.cup.stage].name}`, primary: true, h: 92 });
  else wd.push({ t: 'btn', id: 'again', label: mode === 'cup' ? 'New cup' : 'Rematch', primary: true, h: 92 });
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
    { t: 'btn', id: 'quit', label: state.mode === 'cup' || state.mode === 'friendly' ? 'Save and quit to menu' : 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, longer matches, the Festival Cup, Learn drills and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Four short drills. Each one is a practice you ride on the real field.', size: 26 },
    ...LESSONS.map((l, i) => ({ t: 'btn', id: `lesson${i}`, label: l.title, sub: done[l.id] ? `Done · ${l.goal}` : l.goal, active: !!done[l.id], h: 96, row: isWide() ? 40 + (i >> 1) : undefined })),
    { t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 },
  ];
}
export function lessonWidgets(state) {
  const l = LESSONS[state.learn.cur];
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
  const l = LESSONS[state.learn.cur], r = state.learn.result;
  return [
    { t: 'gap', h: 120 }, { t: 'h', label: r.pass ? 'Drill complete' : 'Not quite yet', size: 52 },
    { t: 'h', label: `${r.score} of ${r.n}`, size: 90, color: '#ffd97a', cap: 1.2 },
    { t: 'p', label: r.pass ? `You reached the goal: ${l.goal}.` : `The goal was: ${l.goal}. Try again.`, size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'lr-again', label: 'Try again', primary: !r.pass },
    ...(r.pass && state.learn.cur < LESSONS.length - 1 ? [{ t: 'btn', id: 'lr-next', label: 'Next drill', primary: true }] : []),
    { t: 'btn', id: 'lr-list', label: 'All drills', dark: true },
    { t: 'gap', h: 30 },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, live.h);
  g.addColorStop(0, `rgba(30,14,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(30,14,6,${a})`); g.addColorStop(1, `rgba(30,14,6,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, live.w, live.h);
}
function colBand(ctx, c, top, bottom) {
  if (!live.land) return;
  roundPath(ctx, c.x0 - 26, top - 4, c.w0 + 52, bottom - top + 8, 30); ctx.fillStyle = 'rgba(30,14,6,0.5)'; ctx.fill();
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = live.w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(30,14,6,0)'); g.addColorStop(1, 'rgba(30,14,6,0.7)');
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
const bg = (ctx, a) => { ctx.clearRect(0, 0, live.w, live.h); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  const w = live.w, h = live.h;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(30,14,6,0.12)'); g.addColorStop(0.35, 'rgba(30,14,6,0.42)'); g.addColorStop(1, 'rgba(30,14,6,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const c = colFor('title');
  let heroLock = null;
  if (c.hero) {
    // landscape: hero text and the Arcforge lockup stand together on the left; the buttons own the right column
    const lw = Math.min(LOCK_CAP, c.hero.w - 60), lh = Math.round(lw * LOCKUP_RATIO), lockY = 330 + 28 + 26, blockH = lockY + lh + 14;
    const sc = Math.min(1, (c.hero.w - 30) / 560, (c.bottom - c.top) * 0.72 / blockH), top = c.top + 4;
    ctx.save(); ctx.translate(c.hero.x + c.hero.w / 2, top); ctx.scale(sc, sc); drawHero(ctx, 0, 0);
    ctx.fillStyle = lockDownNow ? 'rgba(255,226,122,0.5)' : 'rgba(30,14,6,0.55)'; roundPath(ctx, -lw / 2 - 12, lockY - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill();
    drawLockup(ctx, 0, lockY, lw, 1); ctx.restore();
    const m = 44 / Math.max(0.2, host.px), tw = Math.max((lw + 24) * sc, m), th = Math.max((lh + 12) * sc, m), ccx = c.hero.x + c.hero.w / 2, ccy = top + (lockY + lh / 2) * sc;
    heroLock = { x: ccx - tw / 2, y: ccy - th / 2, w: tw, h: th };
    roundPath(ctx, c.x0 - 22, c.top - 2, c.w0 + 44, c.bottom - c.top + 4, 30); ctx.fillStyle = 'rgba(30,14,6,0.5)'; ctx.fill();
  }
  const fr = drawFlowScreen(ctx, state, 'title', false);
  titleLockTap = heroLock;
  if (!heroLock) {
    const it = fr.lay.items.find((i) => i.w && i.w.brand);
    if (it) {
      const lw = Math.min(it.wd - 30, LOCK_CAP), lh = Math.round(lw * LOCKUP_RATIO), cx = it.x + it.wd / 2, cy = fr.top + it.y - fr.scroll + 20 + lh / 2;
      const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
      if (cy - th / 2 >= fr.top - 4 && cy + th / 2 <= fr.bottom + 4) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
    }
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', w / 2, h - 14 - host.b); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  const pins = setupPins(), w = live.w, h = live.h;
  drawFlowScreen(ctx, state, 'setup');
  const g = ctx.createLinearGradient(0, pins.bar.y, 0, h);
  g.addColorStop(0, 'rgba(30,14,6,0)'); g.addColorStop(0.2, 'rgba(30,14,6,0.88)'); g.addColorStop(1, 'rgba(30,14,6,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, pins.bar.y, w, pins.bar.h);
  const m = state.setup.mode;
  drawButton(ctx, pins.start, m === 'watch' ? 'Watch the match' : m === 'practice' ? 'Start practice' : 'To the field', { primary: true, size: 32 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${fz(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, w / 2, pins.bar.y + 20); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings'); };
export const renderResult = (ctx, state) => { ctx.clearRect(0, 0, live.w, live.h); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result'); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit'); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'learn'); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lesson'); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult'); };

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
  scrim(ctx, 0.55);
  const L = pauseGeom(state), { lay, top: y0, bottom } = L, ch = bottom - y0;
  panel(ctx, L.panel.x, y0 - 20, L.panel.w, ch + 40, { r: 30, fill: 'rgba(44,24,12,0.95)', stroke: 'rgba(255,246,228,0.45)' });
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, L.panel.x, L.panel.w);
}

// ---- reference pages (Rules, How to Play, About): ONE scrolling column inside the panel ------------------------------------------------
export const REF_VIEW = { top: 0, bottom: 0 };
let REF = { max: 0, vh: 1, total: 0 };
export const refMeta = () => REF;
const ART_H = { field: 250, lead: 250, dodge: 250 };
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
  bg(ctx, 0.8);
  const { R, P, F, sc, top, bottom, vh, max } = refPrepare(state, list, header);
  const scroll = Math.min(Math.max(0, state.ui.scroll), max); state.ui.scroll = scroll;
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(60,34,16,0.6)' });
  const cx = P.x + P.w / 2, hy = P.y + R.headH - 40;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, cx, hy);
  ctx.strokeStyle = 'rgba(60,34,16,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, hy + 20); ctx.lineTo(P.x + P.w - 60, hy + 20); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 8, top, P.w - 16, vh); ctx.clip();
  for (const blk of F.blocks) {
    let y = top + blk.y - scroll;
    if (y > bottom || y + blk.h < top) continue;
    if (blk.rule) { ctx.strokeStyle = 'rgba(60,34,16,0.2)'; ctx.beginPath(); ctx.moveTo(P.x + 80, y + 4); ctx.lineTo(P.x + P.w - 80, y + 4); ctx.stroke(); y += 16; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${F.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, cx, y + F.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { drawArt(blk.art, ctx, P.x + 40, y, P.w - 80, blk.artH - 12); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${F.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += F.lh * 0.45; ctx.fillText(l.text, P.x + 40, y + F.fs * 0.85); y += F.lh; });
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, vh * vh / F.total), ty = top + (scroll / max) * (vh - th);
    roundPath(ctx, P.x + P.w - 18, ty, 7, th, 3.5); ctx.fillStyle = 'rgba(60,34,16,0.45)'; ctx.fill();
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, bottom - 70, 0, bottom); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)'); ctx.fillStyle = g; ctx.fillRect(P.x + 10, bottom - 70, P.w - 20, 70);
      roundPath(ctx, cx - 64, bottom - 42, 128, 36, 18); ctx.fillStyle = C.indigo; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ scroll', cx, bottom - 23);
    }
    if (scroll > 4) {
      roundPath(ctx, cx - 46, top + 6, 92, 34, 17); ctx.fillStyle = C.indigo; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 23);
    }
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(60,34,16,0.75)';
  const pages = Math.max(1, Math.ceil(F.total / vh)), cur = max <= 0 ? 1 : Math.min(pages, 1 + Math.round(scroll / max * (pages - 1)));
  ctx.fillText(`${max > 0 ? `Screen ${cur} of ${pages}   ` : ''}Text ${Math.round(sc * 100)}%`, cx, P.y + P.h - (R.foot > 40 ? 22 : 8));
  drawButton(ctx, R.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 32 });
  drawButton(ctx, R.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 32 });
  drawButton(ctx, R.back, scroll <= 4 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, R.next, scroll >= max - 4 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- diagrams drawn with the game's own geometry --------------------------------------------------------------------------------------
function arrow(ctx, x0, y0, x1, y1, col = '#d4501e', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function label(ctx, t, x, y, size = 20, col = '#2a1a12', align = 'center') {
  size = Math.max(MIN_FONT, size);
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); ctx.restore();
}
function rider(ctx, x, y, col, dir = 1, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = '#7a4a2a'; roundPath(ctx, -26, -14, 50, 22, 11); ctx.fill();
  ctx.beginPath(); ctx.moveTo(18, -10); ctx.lineTo(34, -26); ctx.lineTo(40, -20); ctx.lineTo(24, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a2c17'; ctx.fillRect(-20, 6, 4, 18); ctx.fillRect(-4, 6, 4, 18); ctx.fillRect(10, 6, 4, 18); ctx.fillRect(18, 6, 4, 18);
  ctx.fillStyle = col; roundPath(ctx, -8, -38, 16, 28, 6); ctx.fill();
  ctx.fillStyle = '#d9a37a'; ctx.beginPath(); ctx.arc(0, -46, 8, 0, TAU); ctx.fill();
  ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9cc4e8'); g.addColorStop(0.5, '#d3e1ea'); g.addColorStop(0.51, '#c9ae7c'); g.addColorStop(1, '#b89a68');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const laneY = (i) => y + h * (0.64 + 0.15 * i);
  const lanes = () => { for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(110,84,50,0.35)'; ctx.fillRect(x + 20, laneY(i) - 9, w - 40, 18); } };
  const A = {
    field() {
      lanes();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w - 60, y + h * 0.5); ctx.lineTo(x + w - 60, y + h - 6); ctx.stroke();
      label(ctx, 'end line', x + w - 60, y + h * 0.5 - 6, 18, '#2a1a12');
      rider(ctx, x + 120, laneY(1) - 4, '#b3262e', 1); rider(ctx, x + 250, laneY(1) - 4, '#23407f', 1);
      arrow(ctx, x + 300, y + h * 0.36, x + w - 100, y + h * 0.36, '#d4501e', 4);
      label(ctx, 'chaser', x + 120, y + h * 0.28, 20, '#b3262e'); label(ctx, 'runner', x + 250, y + h * 0.28, 20, '#23407f');
      label(ctx, 'three lanes', x + w / 2, y + h - 8, 18, '#fff6e4');
    },
    lead() {
      lanes();
      rider(ctx, x + 90, laneY(1) - 4, '#b3262e', 1); rider(ctx, x + w * 0.5, laneY(1) - 4, '#23407f', 1);
      const rx = x + w * 0.5 + 130;
      ctx.setLineDash([8, 8]); ctx.strokeStyle = '#8f2f0f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 120, y + h * 0.4); ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.1, rx, y + h * 0.5); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#d4501e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(rx, laneY(1) + 6, 34, 11, 0, 0, TAU); ctx.stroke();
      arrow(ctx, x + w * 0.5 + 50, y + h * 0.3, rx - 30, y + h * 0.3, '#1d7f86', 4);
      label(ctx, 'lead', (x + w * 0.5 + rx) / 2, y + h * 0.26, 20, '#135a60'); label(ctx, 'aim ring', rx, laneY(1) + 46, 18, '#8f2f0f');
    },
    dodge() {
      lanes();
      rider(ctx, x + w * 0.55, laneY(2) - 4, '#23407f', 1);
      ctx.strokeStyle = '#d4501e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x + w * 0.55 + 20, laneY(2) + 6, 34, 11, 0, 0, TAU); ctx.stroke();
      arrow(ctx, x + w * 0.55 + 90, laneY(2) - 14, x + w * 0.55 + 90, laneY(0) - 6, '#1d7f86', 4);
      label(ctx, 'change lane', x + w * 0.55 + 110, laneY(1) + 4, 20, '#135a60', 'left');
      label(ctx, 'ring = where the javelin goes', x + 20, y + 34, 20, '#8f2f0f', 'left');
      label(ctx, 'or change pace, or LEAN', x + 20, y + 62, 20, '#135a60', 'left');
    },
  };
  (A[key] ?? A.field)();
  ctx.restore();
}
