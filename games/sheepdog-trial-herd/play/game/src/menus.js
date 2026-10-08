// Every screen that is not the play screen: title, setup, training list, settings, result, pause and the scrolling About / How to Play / Rules reader with its diagrams.
// Pure drawing; game.js owns state. All text follows the 100-300% size.
import { W, H, SW, OX, LAND, MENU, PANEL, host, minU, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_CLOSE, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { COURSES, COURSE_ORDER } from './courses.js';
import { WEATHER, TOD, PHASE_PTS } from './sim.js';
import { LESSONS } from './training.js';
import { drawCmdIcon, CMD_LABEL, CMD_ORDER } from './icons.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: 1280 };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  const sk = `${key}|${W}x${H}|${state.settings.textIdx}`;
  if (LAID.sk === sk && LAID.lay) return;
  const T = MENU.top, B = MENU.bottom, PB = MENU.pinBottom;
  const defs = { title: [titleWidgets, T, B], setup: [setupWidgets, T, PB], train: [trainWidgets, T, B], settings: [settingsWidgets, T, B], result: [resultWidgets, T, B], demolimit: [demoLimitWidgets, T, B] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, sk, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

function drawHero(ctx, w, flat) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cx = w / 2, k = Math.min(1, (w - 20) / 640);
  ctx.fillStyle = flat ? 'rgba(7,13,12,0.42)' : 'rgba(7,13,12,0.5)'; roundPath(ctx, 2, 40, w - 4, 288, 30); ctx.fill();
  let px = Math.round(32 * k);
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText('HILL-PASTURE HERDING').width > w - 16 && px > 12) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillStyle = '#f2c35b'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('HILL-PASTURE HERDING', cx, 94);
  let hp = Math.round(112 * Math.min(1, k * 1.1));
  ctx.font = `700 ${hp}px ${DISPLAY}`;
  while (ctx.measureText('Sheepdog').width > w - 28 && hp > 24) { hp -= 2; ctx.font = `700 ${hp}px ${DISPLAY}`; }
  ctx.fillStyle = '#f6f0e2'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Sheepdog', cx, 208);
  ctx.font = `700 ${Math.round(84 * Math.min(1, k * 1.1))}px ${DISPLAY}`; ctx.fillStyle = '#9fdcc8'; ctx.fillText('Trials', cx, 290);
  ctx.restore();
}

const heroArt = () => { const k = H < 1200 ? 0.75 : 1; return { t: 'art', h: Math.round(380 * k), draw(ctx, w) { ctx.save(); ctx.scale(k, k); drawHero(ctx, w / k); ctx.restore(); } }; };
const LOCK_W = 300;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
const brandArt = () => ({ t: 'art', h: 120, brand: true, draw(ctx, w) {
  const lw = Math.min(w - 40, LOCK_W), lh = Math.round(lw * 327 / 1200);
  ctx.save(); ctx.fillStyle = lockDownFlag ? 'rgba(240,196,85,0.5)' : 'rgba(7,13,12,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 60 - lh / 2 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockupImage(ctx, w / 2, 60, lw, 1);
} });
let lockDownFlag = false;
export const setLockDown = (v) => { lockDownFlag = v; };

export function titleWidgets(state) {
  return [
    ...(LAND ? [{ t: 'gap', h: 24 }] : [heroArt()]),
    { t: 'btn', id: 'play', label: 'Play a trial', sub: 'Five courses, valley to highland', primary: true, h: !LAND && H < 1200 ? 80 : 92 },
    { t: 'btn', id: 'train', label: 'Training', sub: 'Teach a young dog', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The handler plays', row: 1 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
    brandArt(),
  ];
}

export const unlocked = (state, id) => {
  const i = COURSE_ORDER.indexOf(id);
  return i <= 0 || state.setup.watch || !!state.dev || (state.record.best[COURSE_ORDER[i - 1]] || 0) >= 50;
};
export function setupWidgets(state) {
  const s = state.setup, rec = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.watch ? 'Watch & Learn' : 'Play a trial', size: 48 }];
  wd.push({ t: 'p', label: s.watch ? 'Choose the course the handler will work.' : 'Choose a course. A course unlocks when you score 50 on the one before.', size: 24 });
  for (const id of COURSE_ORDER) {
    const c = COURSES[id], ok = unlocked(state, id), best = rec.best[id] || 0;
    wd.push({ t: 'btn', id: `c-${id}`, label: c.name, sub: ok ? `${c.n} sheep \u00b7 ${best ? 'best ' + best : 'not played'}` : 'Locked: score 50 on the course before', active: s.course === id, disabled: !ok, h: 92 });
  }
  wd.push({ t: 'p', label: 'Time of day', bold: true, color: '#f0d890', size: 26 });
  for (const id of ['dawn', 'day', 'dusk']) wd.push({ t: 'btn', id: `t-${id}`, label: TOD[id].name, row: 20, active: s.tod === id });
  wd.push({ t: 'p', label: TOD[s.tod].blurb, size: 22 });
  wd.push({ t: 'p', label: 'Weather', bold: true, color: '#f0d890', size: 26 });
  for (const id of ['clear', 'breeze']) wd.push({ t: 'btn', id: `w-${id}`, label: WEATHER[id].name, row: 21, active: s.weather === id });
  for (const id of ['mist', 'rain']) wd.push({ t: 'btn', id: `w-${id}`, label: WEATHER[id].name, row: 22, active: s.weather === id });
  wd.push({ t: 'p', label: WEATHER[s.weather].blurb, size: 22 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function trainWidgets(state) {
  const done = state.record.lessons || [];
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Training', size: 48 },
    { t: 'p', label: 'A young dog learns one command at a time on a small meadow with three sheep. No clock, no score.', size: 24 }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `l-${i}`, label: `${i + 1}. ${l.title}`, sub: done[i] ? 'Done. Practise again' : l.goal, active: !done[i] && (i === 0 || done[i - 1]), h: 100 }));
  wd.push({ t: 'gap', h: 10 });
  wd.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#f0d890', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A\u2212  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#f0d890', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Course, time of day and weather are chosen when you start.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#f0d890' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

const STAGES = [['outrun', 'Outrun'], ['lift', 'Lift'], ['fetch', 'Fetch'], ['drive', 'Drive'], ['pen', 'Pen'], ['time', 'Time'], ['control', 'Control']];
const scoreArt = (state) => {
  const s = state.sim, sc = Math.min(TEXT_SCALES[state.settings.textIdx], 2), rowH = Math.round(46 * sc);
  return { t: 'art', h: rowH * 8 + 10, draw(ctx, w) {
    const fs = Math.round(27 * sc);
    ctx.save(); ctx.textBaseline = 'middle';
    STAGES.forEach(([k, name], i) => {
      const y = rowH * (i + 0.5);
      ctx.fillStyle = i % 2 ? 'rgba(7,13,12,0.28)' : 'rgba(7,13,12,0.42)'; roundPath(ctx, 0, y - rowH / 2, w, rowH - 2, 10); ctx.fill();
      ctx.font = `600 ${fs}px ${FONT}`; ctx.fillStyle = '#f6f0e2'; ctx.textAlign = 'left'; ctx.fillText(name, 16, y);
      const v = s.pts[k], mx = PHASE_PTS[k];
      ctx.textAlign = 'right'; ctx.font = `700 ${fs}px ${FONT}`; ctx.fillStyle = v >= mx - 0.01 ? '#f2c35b' : v < mx * 0.5 ? '#ff9a86' : '#f6f0e2';
      ctx.fillText(`${Math.round(v * 10) / 10} / ${mx}`, w - 16, y);
    });
    const y = rowH * 7.5 + 6;
    ctx.font = `700 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillStyle = '#f2c35b'; ctx.textAlign = 'left'; ctx.fillText('Total', 16, y);
    ctx.textAlign = 'right'; ctx.fillText(`${s.total} / 100`, w - 16, y);
    ctx.restore();
  } };
};
export function resultWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const c = COURSES[s.course];
  const wd = [{ t: 'gap', h: big || LAND ? 24 : 50 }];
  const mode = state.setup.lastMode;
  if (s.training) {
    wd.push({ t: 'h', label: 'Lesson complete', size: 52, color: '#f2c35b', cap: 1.3 });
  } else {
    wd.push({ t: 'h', label: s.retired ? 'Time is up' : 'Penned and shut!', size: 52, color: s.retired ? '#ffb59a' : '#f2c35b', cap: 1.3 });
    wd.push({ t: 'p', label: `${c.name} \u00b7 ${WEATHER[s.weather].name} \u00b7 ${TOD[s.tod].name}${mode === 'watch' ? ' \u00b7 Watch & Learn' : ''}`, size: 24, cap: big ? 2 : 3 });
    wd.push(scoreArt(state));
    const best = state.record.best[s.course] || 0;
    wd.push({ t: 'p', label: mode === 'watch' ? 'The handler\u2019s score is not saved.' : s.total >= best && s.total > 0 ? 'A new best on this course.' : `Your best on this course: ${best}`, size: 24, cap: big ? 2 : 3, color: '#f0d890' });
    if (s.faults.length) {
      wd.push({ t: 'p', label: 'The judge\u2019s notes', bold: true, color: '#f0d890', size: 26 });
      s.faults.slice(0, 10).forEach((f) => wd.push({ t: 'p', label: `\u2212${f.pts}  ${f.why}`, align: 'left', size: 23, cap: big ? 2 : 2.6, pad: 8 }));
      if (s.faults.length > 10) wd.push({ t: 'p', label: `and ${s.faults.length - 10} more`, size: 22 });
    } else wd.push({ t: 'p', label: 'No faults. A perfect trial.', size: 24, color: '#9fd8b0' });
  }
  wd.push({ t: 'gap', h: 18 });
  wd.push({ t: 'btn', id: 'again', label: s.training ? (state.lessonIdx < LESSONS.length - 1 ? 'Next lesson' : 'Training list') : 'Play again', primary: true, h: 88 });
  wd.push({ t: 'btn', id: 'new', label: s.training ? 'Training list' : 'Change course', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'art', h: 56, draw: (ctx, w) => drawMoreLine(ctx, w / 2, 24, 19) });
  wd.push({ t: 'gap', h: 20 });
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
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#f0d890', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A\u2212  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have used the free trial runs of the web demo. The full game on iPhone and Android has all five courses, every time of day and weather, Training, and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(4,16,10,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,16,10,${a})`); g.addColorStop(1, `rgba(4,16,10,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,16,10,0)'); g.addColorStop(1, 'rgba(4,16,10,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, sk: `${key}|${W}x${H}|${state.settings.textIdx}`, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 14, top, 8, bottom - top, 4); ctx.fillStyle = 'rgba(255,246,228,0.14)'; ctx.fill();
    roundPath(ctx, W - 14, ty, 8, th, 4); ctx.fillStyle = 'rgba(255,246,228,0.72)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, a); };


export function renderTitle(ctx, state) {
  ctx.clearRect(-OX, 0, SW, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); if (LAND) { g.addColorStop(0, 'rgba(7,13,12,0.0)'); g.addColorStop(0.6, 'rgba(7,13,12,0.05)'); g.addColorStop(1, 'rgba(7,13,12,0.3)'); } else { g.addColorStop(0, 'rgba(7,13,12,0.0)'); g.addColorStop(0.45, 'rgba(7,13,12,0.18)'); g.addColorStop(1, 'rgba(7,13,12,0.5)'); }
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
  if (LAND) {
    // landscape: a compact heading at the top left, the athlete below it in the open grass, the menu on the right
    const lw = OX - host.l - 24, k = Math.min(0.62, Math.max(0.4, (H - host.t) / 640));
    ctx.save(); ctx.translate(host.l - OX + 14, host.t + 2); ctx.scale(k, k); drawHero(ctx, lw / k, true); ctx.restore();
  }
  const fr = drawFlowScreen(ctx, state, 'title', titleWidgets(state), MENU.top, MENU.bottom);
  titleLockTap = null;
  {
    const it = LAID.lay.items.find((i) => i.w.brand);
    if (it) {
      const lw = Math.min(it.wd - 40, LOCK_W), lh = Math.round(lw * 327 / 1200), cy = LAID.top + it.y - fr.scroll + 60, cx = it.x + it.wd / 2;
      const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
      if (cy - th / 2 >= MENU.top && cy + th / 2 <= MENU.bottom) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
    }
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(246,240,226,0.6)'; ctx.fillText('Web demo', LAND ? (host.l - OX) / 2 : W / 2, H - 14 - host.b); }
}
function pinned(ctx, state, key, widgets, label, back) {
  bg(ctx, 0.78);
  const pb = MENU.pinBottom;
  drawFlowScreen(ctx, state, key, widgets, MENU.top, pb);
  const g = ctx.createLinearGradient(0, pb - 30, 0, H);
  g.addColorStop(0, 'rgba(7,13,12,0)'); g.addColorStop(0.2, 'rgba(7,13,12,0.88)'); g.addColorStop(1, 'rgba(7,13,12,0.95)');
  ctx.fillStyle = g; ctx.fillRect(-OX, pb - 30, SW, H - pb + 30);
  drawButton(ctx, SETUP_PINS.start, label, { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, back, { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pb + 14); }
}
export const renderSetup = (ctx, state) => pinned(ctx, state, 'setup', setupWidgets(state), state.setup.watch ? 'Start Watch & Learn' : 'Start the trial', 'Back');
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), MENU.top, MENU.bottom); };
export const renderResult = (ctx, state) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), MENU.top, MENU.bottom); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), MENU.top, MENU.bottom); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 40), px0 = (W - pw) / 2;
  const lay = flowLayout(ctx, wd, sc, { x: px0 + 30, w: pw - 60 });
  const top = LAND ? MENU.top + 34 : 70 + MENU.top, bottom = LAND ? MENU.bottom - 34 : H - 70 - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px0, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(12,36,24,0.96)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  if (maxScroll > 0) {
    const th = Math.max(50, ch * (ch / lay.contentH)), ty = y0 + (sc0 / maxScroll) * (ch - th);
    roundPath(ctx, px0 + pw - 20, y0, 8, ch, 4); ctx.fillStyle = 'rgba(255,246,228,0.14)'; ctx.fill();
    roundPath(ctx, px0 + pw - 20, ty, 8, th, 4); ctx.fillStyle = 'rgba(255,246,228,0.72)'; ctx.fill();
  }
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px0, pw);
}

// ---- reference pages (Rules, How to Play, About): ONE continuous document that scrolls --------------------------------------
// Drag / swipe, mouse wheel, arrows, PageUp / PageDown, Space, Home / End all scroll it; a visible scroll bar shows where you are. The text size
// (100-300%) only changes how long the document is, never what is on screen being cut off.
export const READER = { h: 0, view: 0, max: 0 };
const hdrH = () => (LAND ? 64 : 84);
const viewT = () => PANEL.y + hdrH(), viewB = () => PANEL.y + PANEL.h - 14;
export const pageViewH = () => viewB() - viewT();

function buildDoc(ctx, list, scale) {
  const fs = Math.round(26 * scale), lh = fs * 1.2, tw = PANEL.w - 64;
  const secFs = Math.round(32 * Math.min(scale, 1.5));
  const items = []; let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 6 }); y += 22; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    tl.forEach((l) => { items.push({ k: 'title', y, text: l, fs: secFs }); y += secFs * 1.18; });
    y += 8;
    if (sec.art) { items.push({ k: 'art', y, art: sec.art, h: 210 }); y += 222; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l, fs }); y += lh; });
    });
    y += 10;
  });
  return { items, h: y + 12, fs };
}
const docCache = new Map();
export function docFor(ctx, list, header, scale) {
  const key = `${header}:${scale}:${list.length}:${PANEL.w}`;
  let d = docCache.get(key);
  if (!d) { d = buildDoc(ctx, list, scale); docCache.set(key, d); }
  return d;
}
export function readerMax(state, ctx, list, header) { return Math.max(0, docFor(ctx, list, header, TEXT_SCALES[state.settings.textIdx]).h - pageViewH()); }
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const VIEW_T = viewT(), VIEW_B = viewB(), HD = hdrH();
  const doc = docFor(ctx, list, header, sc);
  const viewH = pageViewH(), max = Math.max(0, doc.h - viewH);
  READER.h = doc.h; READER.view = viewH; READER.max = max;
  const scroll = Math.max(0, Math.min(state.ui.scroll, max));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(16,40,28,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `700 ${Math.round((LAND ? 36 : 42) * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, PANEL.x + PANEL.w / 2, PANEL.y + HD * 0.6);
  ctx.strokeStyle = 'rgba(16,40,28,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 40, PANEL.y + HD - 18); ctx.lineTo(PANEL.x + PANEL.w - 40, PANEL.y + HD - 18); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW_T, PANEL.w - 12, viewH); ctx.clip();
  const top = VIEW_T - scroll;
  for (const it of doc.items) {
    const y = top + it.y;
    if (y > VIEW_B + 40 || y + (it.h || it.fs * 1.4 || 20) < VIEW_T - 40) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(16,40,28,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + PANEL.w / 2 - 8, y + it.fs * 0.9); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 52, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 30, y, PANEL.w - 72, it.h - 12); ctx.restore(); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + 22, y + it.fs * 0.85); }
  }
  ctx.restore();
  if (max > 0) {
    // scroll bar: track + thumb on the panel's right edge, and "more" / "up" cues
    const tx = PANEL.x + PANEL.w - 16;
    roundPath(ctx, tx, VIEW_T, 8, viewH, 4); ctx.fillStyle = 'rgba(16,40,28,0.16)'; ctx.fill();
    const th = Math.max(56, viewH * (viewH / doc.h)), ty = VIEW_T + (scroll / max) * (viewH - th);
    roundPath(ctx, tx, ty, 8, th, 4); ctx.fillStyle = 'rgba(16,40,28,0.62)'; ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, VIEW_B - 70, 0, VIEW_B); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)');
      ctx.fillStyle = g; ctx.fillRect(PANEL.x + 6, VIEW_B - 70, PANEL.w - 40, 70);
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 52, VIEW_B - 42, 104, 32, 16); ctx.fillStyle = 'rgba(16,40,28,0.82)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▼ scroll', PANEL.x + PANEL.w / 2, VIEW_B - 25);
    } else if (scroll > 4) {
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 40, VIEW_T + 6, 80, 30, 15); ctx.fillStyle = 'rgba(16,40,28,0.82)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▲ up', PANEL.x + PANEL.w / 2, VIEW_T + 21);
    }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, (TEXT_DEC.x + TEXT_DEC.w + TEXT_INC.x) / 2, TEXT_DEC.y + TEXT_DEC.h / 2); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, REF_CLOSE, 'Close', { primary: true, size: 32 });
}


export const renderTrain = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'train', trainWidgets(state), MENU.top, MENU.bottom); };

// ---- diagrams -------------------------------------------------------------------------------------
function arrow(ctx, x0, y0, x1, y1, col = '#f2c35b', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function label(ctx, t, x, y, size = 18, col = '#f6f0e2', align = 'center') {
  size = Math.max(size, minU());
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
const sheepDot = (ctx, x, y, r = 9) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#f4f0e4'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.4, 0, TAU); ctx.fillStyle = '#3a3a3a'; ctx.fill(); };
const dogDot = (ctx, x, y, r = 10) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#1c1c20'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#f6f0e2'; ctx.stroke(); };
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(24,36,32,0.94)'; ctx.fill();
  const cx = x + w / 2, cy = y + h / 2;
  const A = {
    commands() {
      const cw = (w - 30) / 5;
      CMD_ORDER.forEach((c, i) => {
        const bx = x + 10 + i * (cw + 2.5), by = y + 14, bw = cw - 5;
        roundPath(ctx, bx, by, bw, h - 28, 12); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
        drawCmdIcon(ctx, c, bx + bw / 2, by + (h - 28) * 0.38, Math.min(bw * 0.3, 30), '#f2c35b');
        label(ctx, CMD_LABEL[c].replace(' ', ' '), bx + bw / 2, by + h - 28 - 12, Math.min(17, bw * 0.19), '#f6f0e2');
      });
    },
    balance() {
      const fx = x + w * 0.5, fy = cy - 4;
      for (const [dx, dy] of [[-14, -6], [4, -14], [14, 8], [-6, 12], [0, 0]]) sheepDot(ctx, fx + dx, fy + dy);
      ctx.beginPath(); ctx.arc(fx, fy + 38, 12, 0, TAU); ctx.strokeStyle = '#f2c35b'; ctx.lineWidth = 3; ctx.stroke();
      dogDot(ctx, fx, fy + 38, 8);
      arrow(ctx, fx, fy - 18, fx, y + 24, '#9fdcc8', 4);
      label(ctx, 'target', fx + 44, y + 34, 17, '#9fdcc8');
      label(ctx, 'dog at the balance point', fx, y + h - 10, 17, '#f2c35b');
    },
    zone() {
      const fx = x + w * 0.36, fy = cy;
      sheepDot(ctx, fx, fy, 11);
      ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(fx, fy, Math.min(h * 0.38, 70), 0, TAU); ctx.strokeStyle = '#f2c35b'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'flight zone', fx, y + 28, 17, '#f2c35b');
      dogDot(ctx, fx + Math.min(h * 0.3, 54), fy + 6, 8);
      arrow(ctx, fx - 14, fy, fx - Math.min(h * 0.34, 62), fy - 6, '#f6f0e2', 3);
      label(ctx, 'ewe moves away', fx, y + h - 10, 16, '#f6f0e2');
      const rx = x + w * 0.74;
      dogDot(ctx, rx - 30, cy + 8, 8); sheepDot(ctx, rx + 24, cy + 8, 9); sheepDot(ctx, rx + 40, cy - 6, 9);
      label(ctx, 'lead ewe wears a bell', rx, y + h - 10, 16, '#f6f0e2');
    },
    course() {
      const px = x + 16, py = y + 14, pw = w - 32, ph = h - 40;
      ctx.strokeStyle = 'rgba(246,240,226,0.55)'; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
      const P = (u, v) => [px + pw * u, py + ph * (1 - v)];
      const gate = (u, v, hz, col, t) => { const [gx, gy] = P(u, v); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); if (hz) { ctx.moveTo(gx - 16, gy); ctx.lineTo(gx + 16, gy); } else { ctx.moveTo(gx, gy - 16); ctx.lineTo(gx, gy + 16); } ctx.stroke(); label(ctx, t, gx, gy - 14 - (hz ? 4 : 0), 15, col); };
      gate(0.5, 0.42, true, '#9fdcc8', 'fetch');
      gate(0.22, 0.4, true, '#f2c35b', 'drive 1');
      gate(0.58, 0.6, false, '#f2c35b', 'drive 2');
      const [hx, hy] = P(0.5, 0.02); ctx.beginPath(); ctx.arc(hx, hy, 8, 0, TAU); ctx.fillStyle = '#d98a3a'; ctx.fill(); label(ctx, 'post', hx, hy - 12, 15);
      const [qx, qy] = P(0.8, 0.12); ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = 4; ctx.strokeRect(qx - 12, qy - 12, 24, 24); label(ctx, 'pen', qx, qy - 18, 15, '#c9a26a');
      const [fx, fy] = P(0.56, 0.86); for (const [dx, dy] of [[0, 0], [10, 6], [-8, 8], [4, -8]]) sheepDot(ctx, fx + dx, fy + dy, 6);
      label(ctx, 'flock', fx + 4, fy - 16, 15);
    },
    stamina() {
      const bw = w - 80;
      [['Stamina', 0.72, '#6fbf7d'], ['Eye', 0.55, '#f2c35b']].forEach(([nm, v, col], i) => {
        const by = y + 30 + i * (h - 50) / 2;
        label(ctx, nm, x + 40, by - 8, 18, '#f6f0e2', 'left');
        roundPath(ctx, x + 40, by, bw, 18, 9); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
        roundPath(ctx, x + 40, by, bw * v, 18, 9); ctx.fillStyle = col; ctx.fill();
      });
    },
    think() { const cw = (w - 40) / 3; [['THINK', '#f0d890'], ['REVEAL', '#9fdcc8'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const bx = x + 10 + i * (cw + 10); roundPath(ctx, bx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, bx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.balance)();
  ctx.restore();
}
