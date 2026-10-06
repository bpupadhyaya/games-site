// Every screen that is not the play screen. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, scr, host, readerGeom, setupPins } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, TEMPOS, TARGETS, TEXT_SCALES, THINK_STEPS } from './consts.js';
import { LESSONS } from './content.js';

let LAID = { key: '', lay: null, top: 0, bottom: 1280 };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const flowOpts = (key) => (key === 'pause' ? { x: 60, w: W - 120 } : { x: 40, w: W - 80 });
const topOf = () => host.t;
// vertical extent of a flow screen: [top, bottom] in screen units (setup keeps the Start / Back bar below it)
const extentOf = (key) => {
  // in portrait the host's floating back button sits top-left: screens other than the title start below it
  const t = topOf() + (host.back && !scr.land && key !== 'title' ? Math.max(host.back, 56) + 8 : 0);
  if (key === 'setup') return [t, setupPins().y - 28];
  if (key === 'pause') return [topOf() + 70, H - Math.max(70, host.b + 20)];
  if (key === 'title') return [t, H - Math.max(0, host.b - 8) - Math.round((scr.land ? 280 : 310) * 327 / 1200) - 34];
  return [t, H - Math.max(0, host.b - 8)];
};
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = { title: titleWidgets, setup: setupWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, learn: learnWidgets, lesson: lessonWidgets, lessonresult: lessonResultWidgets, pause: pauseWidgets };
  const d = defs[key];
  if (!d) return;
  const [top, bottom] = extentOf(key);
  const lay = flowLayout(estCtx, d(state), TEXT_SCALES[state.settings.textIdx], flowOpts(key));
  LAID = { key, lay, top, bottom, h: lay.contentH };
}
export function invalidate() { LAID = { key: '', lay: null, top: 0, bottom: 1280 }; }
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = (compact) => ({
  t: 'art', h: compact ? 190 : 290,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2, k = compact ? 0.78 : 1, o = compact ? -6 : 0;
    ctx.font = `700 ${Math.round(26 * (compact ? 0.88 : 1))}px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.shadowColor = 'rgba(40,16,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('THE GHANAIAN JUMP-AND-CLAP GAME', cx, 50 * k + o + 4);
    ctx.font = `700 ${Math.round(132 * k)}px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Ampe', cx, 186 * k + o + (compact ? 4 : 0));
    ctx.font = `400 ${Math.round(28 * (compact ? 0.9 : 1))}px ${FONT}`; ctx.shadowBlur = 6; ctx.fillStyle = '#fff1d2';
    ctx.fillText('Clap. Jump. Throw a foot.', cx, 236 * k + o + (compact ? 12 : 0));
    ctx.restore();
  },
});

// The two players stay visible in the middle of the title screen in portrait (the 3D camera is framed on the title band); in landscape they stand
// on the left of the screen and the menu is a column on the right. The gap between the heading and the buttons is whatever the screen has to spare.
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
let titleGap = 372, titlePad = 0;
export const titleBand = () => ({ top: topOf() + titlePad + 290 + 14, gap: titleGap });
export function titleWidgets(state) {
  const sv = state.saved, big = TEXT_SCALES[state.settings.textIdx] > 1.5, land = scr.land, three = W >= 640;
  const tight = !land && H < 1200, bh = land ? 80 : tight ? 68 : 88, rh = land ? 78 : tight ? 62 : 78;
  const buttons = [
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.name} · ${sv.score[0]}-${sv.score[1]} · first to ${sv.target}`, primary: true, h: bh }] : []),
    { t: 'btn', id: 'play', label: 'Play vs computer', primary: !sv, h: bh },
    { t: 'btn', id: 'learn', label: 'Learn', row: 1, h: rh },
    { t: 'btn', id: 'practice', label: 'Practice', row: 1, h: rh },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', row: three ? 1 : 2, h: rh },
    { t: 'btn', id: 'howto', label: 'How to Play', row: three ? 2 : 2, h: rh },
    { t: 'btn', id: 'rules', label: 'Rules', row: three ? 2 : 3, h: rh },
    { t: 'btn', id: 'about', label: 'About', row: three ? 2 : 3, h: rh },
    { t: 'btn', id: 'settings', label: 'Settings', row: 4, h: rh },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 4, h: rh },
  ];
  if (land) { titleGap = 0; titlePad = 0; return [heroArt(true), { t: 'gap', h: 4 }, ...buttons]; }
  const sc = TEXT_SCALES[state.settings.textIdx];
  const h0 = flowLayout(estCtx, [heroArt(false), ...buttons], sc, flowOpts('title')).contentH;
  const spare = extentOf("title")[1] - topOf() - h0 - 54;                  // the foot of the screen keeps room for the brand lockup
  titleGap = big ? 10 : clamp(spare, 0, 440);
  titlePad = big ? 0 : Math.max(0, Math.round((spare - 440) * 0.45));
  return [{ t: 'gap', h: titlePad }, heroArt(false), { t: 'gap', h: titleGap }, ...buttons];
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, watch = s.watch;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: watch ? 'Watch & Learn' : 'New game', size: 48 }];
  wd.push({ t: 'p', label: watch ? 'Choose the two computers' : 'Choose your opponent', bold: true, color: '#ffe9a0', size: 26 });
  if (watch) {
    wd.push({ t: 'p', label: 'Gold player (right side of the screen)', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: `${l.id}`, active: s.watchA === i + 1, row: 20, h: 76 }));
    wd.push({ t: 'p', label: 'Teal player (left side of the screen)', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `opp${i + 1}`, label: `${l.id}`, active: s.level === i + 1, row: 21, h: 76 }));
  } else {
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: `${l.id}. ${l.name}`, sub: locked ? 'In the full game' : l.blurb, stars: l.stars, active: s.level === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 96 });
    });
  }
  wd.push({ t: 'p', label: 'Tempo', bold: true, color: '#ffe9a0', size: 26 });
  const tempos = TEMPOS.filter((t) => t.id !== 'practice');
  tempos.forEach((t, i) => wd.push({ t: 'btn', id: `tp-${t.id}`, label: t.id === 'rising' ? 'Rising' : `${t.name} ${t.bpm}`, active: s.tempo === t.id, row: 30 + Math.floor(i / 3), h: 76 }));
  if (!watch) {
    wd.push({ t: 'p', label: 'Game length', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'len-11', label: `First to ${TARGETS[0]}`, row: 9, active: s.target === TARGETS[0] });
    wd.push({ t: 'btn', id: 'len-21', label: `First to ${TARGETS[1]}`, row: 9, active: s.target === TARGETS[1], disabled: demo, hitDisabled: true });
    wd.push({ t: 'p', label: 'Your player', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'hero-m', label: 'Boy', row: 10, active: state.settings.hero === 'm' });
    wd.push({ t: 'btn', id: 'hero-f', label: 'Girl', row: 10, active: state.settings.hero === 'f' });
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Drum volume: ${['Off', 'Soft', 'Medium', 'Loud'][st.drum]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'drum-dec', label: 'Quieter', row: 4, disabled: st.drum === 0 },
    { t: 'btn', id: 'drum-inc', label: 'Louder', row: 4, disabled: st.drum === 3 },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 5, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 5, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Timing: ${st.timing === 'relaxed' ? 'Relaxed' : 'Standard'}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'tm-standard', label: 'Standard', row: 6, active: st.timing !== 'relaxed' },
    { t: 'btn', id: 'tm-relaxed', label: 'Relaxed', row: 6, active: st.timing === 'relaxed' },
    { t: 'p', label: `Sync adjustment: ${st.offset > 0 ? '+' : ''}${st.offset} ms (raise it if your taps are graded late)`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'off-dec', label: '−20 ms', row: 7, disabled: st.offset <= -100 },
    { t: 'btn', id: 'off-inc', label: '+20 ms', row: 7, disabled: st.offset >= 100 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 8, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 8, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const watch = state.mode === 'watch';
  const youWin = s.winner === 0;
  const title = watch ? `${s.winner === 0 ? 'Gold' : 'Teal'} wins` : youWin ? 'You win!' : 'The computer wins';
  const st = s.stats[0];
  const wd = [{ t: 'gap', h: big ? 24 : 140 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${s.score[0]} – ${s.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  if (!watch) wd.push({ t: 'p', label: `Rounds ${s.n + 1}. Perfect ${st.perfect}, good ${st.good}, ok ${st.ok}, missed ${st.miss}. Best streak ${st.best}.`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New game', row: 11 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 11, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  if (state.thinkOpen && state.thinkData) {
    const t = state.thinkData;
    return [
      { t: 'h', label: 'Think', size: 46 },
      { t: 'p', label: t.iLead ? 'You LEAD this round: match the computer\'s foot.' : 'You FOLLOW this round: differ from the computer\'s foot.', bold: true, color: '#ffe9a0', size: 24 },
      { t: 'p', label: t.them.text, size: 24, align: 'left', pad: 6 },
      { t: 'p', label: t.you.text, size: 24, align: 'left', pad: 6 },
      { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    ];
  }
  return [
    { t: 'h', label: 'Paused', size: scr.land ? 44 : 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: scr.land ? 80 : 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 12 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 12 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', ...(scr.land ? { row: 12 } : {}) },
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 13, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 13, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: state.mode === 'match' ? 'Save and quit to menu' : 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free games of the web demo. The full game on iPhone and Android has every opponent, the 21-point game, Learn lessons and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 },
    { t: 'p', label: 'Six short lessons, played on the real playground.', size: 26 },
    ...LESSONS.map((l, i) => ({ t: 'btn', id: `lesson${i}`, label: l.title, sub: done[l.id] ? `Done · ${l.goal}` : l.goal, active: !!done[l.id], h: 96, disabled: state.demo && i > 1, hitDisabled: true })),
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
    { t: 'btn', id: 'lesson-go', label: 'Start', primary: true, h: 92 },
    { t: 'btn', id: 'lesson-back', label: 'Back to lessons', dark: true },
    { t: 'gap', h: 30 },
  ];
}
export function lessonResultWidgets(state) {
  const l = LESSONS[state.learn.cur], r = state.learn.result;
  return [
    { t: 'gap', h: 120 }, { t: 'h', label: r.pass ? 'Lesson complete' : 'Not quite yet', size: 52 },
    { t: 'h', label: `${r.score} of ${r.n}`, size: 90, color: '#ffd97a', cap: 1.2 },
    { t: 'p', label: r.pass ? `You reached the goal: ${l.goal}.` : `The goal was: ${l.goal}. Try again.`, size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'lr-again', label: 'Try again', primary: !r.pass },
    ...(r.pass && state.learn.cur < LESSONS.length - 1 ? [{ t: 'btn', id: 'lr-next', label: 'Next lesson', primary: true }] : []),
    { t: 'btn', id: 'lr-list', label: 'All lessons', dark: true },
    { t: 'gap', h: 30 },
  ];
}

// Backdrops fill the WHOLE screen: the canvas is translated to the screen column, so the full width starts at -colX.
const full = (ctx) => ({ x: -scr.colX, w: scr.vw });
function scrim(ctx, a = 0.55) {
  const f = full(ctx), g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(30,14,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(30,14,4,${a})`); g.addColorStop(1, `rgba(30,14,4,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(f.x, 0, f.w, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, flowOpts(key));
  // when the content is longer than the screen, the last 46 px are kept free for the "more" chip so it never covers a label
  const over = lay.contentH > bottom - top, vb = over ? bottom - 46 : bottom;
  LAID = { key, lay, top, bottom: vb, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (vb - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, vb, scroll, { clipW: W });
  if (maxScroll > 0) {
    const th = Math.max(60, (vb - top) * ((vb - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (vb - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { scrim(ctx, a * 0.7); };

export function renderTitle(ctx, state) {
  const f = full(ctx), land = scr.land;
  if (land) {
    // the column on the right sits on a darker panel; the players stand on the left, in the light
    const g = ctx.createLinearGradient(f.x, 0, f.x + f.w, 0); g.addColorStop(0, 'rgba(30,14,4,0.0)'); g.addColorStop(0.5, 'rgba(30,14,4,0.08)'); g.addColorStop(1, 'rgba(30,14,4,0.55)');
    ctx.fillStyle = g; ctx.fillRect(f.x, 0, f.w, H);
    const gx = ctx.createLinearGradient(0, 0, 0, H); gx.addColorStop(0, 'rgba(30,14,4,0.22)'); gx.addColorStop(0.3, 'rgba(30,14,4,0)'); gx.addColorStop(1, 'rgba(30,14,4,0.35)');
    ctx.fillStyle = gx; ctx.fillRect(f.x, 0, f.w, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(30,14,4,0.25)'); g.addColorStop(0.3, 'rgba(30,14,4,0.0)'); g.addColorStop(0.55, 'rgba(30,14,4,0.1)'); g.addColorStop(1, 'rgba(30,14,4,0.6)');
    ctx.fillStyle = g; ctx.fillRect(f.x, 0, f.w, H);
  }
  // the quiet brand lockup: bottom of the column (below the buttons) when it fits, otherwise at the foot of the screen
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), extentOf('title')[0], extentOf('title')[1]);
  // themed lockup: bottom centre, directly under the last row of menu buttons (pinned to the bottom if the menu scrolls)
  const lay = LAID.lay, btns = lay.items.filter((i) => i.w.t === 'btn');
  const x0 = Math.min(...btns.map((i) => i.x)), x1 = Math.max(...btns.map((i) => i.x + i.wd)), lcx = (x0 + x1) / 2;
  const lw = Math.min(land ? 280 : 310, Math.max(220, x1 - x0)), lh = lw * (327 / 1200);
  const floor = H - Math.max(14, host.b) - lh - 8 - (state.demo ? 18 : 0);
  const ly = Math.min(floor, topOf() + lay.contentH + 18);
  const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
  titleLockTap = { x: lcx - tw / 2, y: ly + lh + 6 - th, w: tw, h: th };
  ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(30,14,4,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, lcx, ly + lh / 2, lw, 1);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  const pins = setupPins(), f = full(ctx);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), extentOf('setup')[0], pins.y - 28);
  const g0 = pins.y - 56, g = ctx.createLinearGradient(0, g0, 0, H);
  g.addColorStop(0, 'rgba(30,14,4,0)'); g.addColorStop(0.3, 'rgba(30,14,4,0.88)'); g.addColorStop(1, 'rgba(30,14,4,0.95)');
  ctx.fillStyle = g; ctx.fillRect(f.x, g0, f.w, H - g0);
  drawButton(ctx, pins.start, state.setup.watch ? 'Watch' : 'Start', { primary: true, size: 32 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pins.y - 8); }
}
const flowScreen = (key, widgets, a) => (ctx, state) => { bg(ctx, a); const [t, b] = extentOf(key); drawFlowScreen(ctx, state, key, widgets(state), t, b); };
export const renderSettings = flowScreen('settings', settingsWidgets, 0.8);
export const renderResult = (ctx, state) => {
  const f = full(ctx);
  if (scr.land && W <= 720 && scr.colX > 100) { scrim(ctx, 0.2); const g = ctx.createLinearGradient(f.x, 0, f.x + f.w, 0); g.addColorStop(0, 'rgba(30,14,4,0)'); g.addColorStop(0.45, 'rgba(30,14,4,0.1)'); g.addColorStop(1, 'rgba(30,14,4,0.7)'); ctx.fillStyle = g; ctx.fillRect(f.x, 0, f.w, H); } else scrim(ctx, 0.62);
  const [t, b] = extentOf('result'); drawFlowScreen(ctx, state, 'result', resultWidgets(state), t, b);
  const lay = LAID.lay, room = H - (topOf() + lay.contentH) - Math.max(0, host.b - 8);
  if (state.ui.scroll <= 0 && room >= 40) drawMoreLine(ctx, W / 2, H - Math.max(16, host.b + 4) - 6, 17);
};
export const renderDemoLimit = flowScreen('demolimit', demoLimitWidgets, 0.8);
export const renderLearn = flowScreen('learn', learnWidgets, 0.8);
export const renderLesson = flowScreen('lesson', lessonWidgets, 0.8);
export const renderLessonResult = flowScreen('lessonresult', lessonResultWidgets, 0.8);
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, flowOpts('pause'));
  const [top, bottom] = extentOf('pause');
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const strip = lay.contentH + 20 > bottom - top ? 46 : 0, vh = ch - strip;
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, W - 60, ch + 40, { r: 30, fill: 'rgba(56,30,12,0.95)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + vh, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - vh);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + vh, sc0, { clipW: W });
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, W - 60);
}

// ---- reference pages (Rules, About, How to Play): one scrolling document in a panel ---------------------------------------------
// The text is laid out once per (text size, panel width) as a single tall column. Drag, mouse wheel, arrow / page keys or the Next / Back buttons
// move it; a scroll bar on the right shows where you are, so any text size from 100% to 300% can be read to its last line.
const viewOf = (P) => ({ top: P.y + 96, bottom: P.y + P.h - 58 });
let DOC = { total: 0, view: 800 };
export const docInfo = () => ({ max: Math.max(0, DOC.total - DOC.view), view: DOC.view, total: DOC.total });
export const pageCount = () => Math.max(1, Math.ceil(DOC.total / DOC.view - 0.001));
// keep the document measurements current without drawing (the update step needs them before the first render after a resize)
export function readerMetrics() { const P = readerGeom().panel, V = viewOf(P); DOC.view = V.bottom - V.top; return DOC; }

function buildDoc(ctx, list, scale, panelW) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = panelW - 96;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const blocks = [];
  let y = 8;
  list.forEach((sec, si) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const blk = { y, tl, titleH, lines, first: si === 0 };
    y += (si > 0 ? 16 : 0) + titleH + 14;
    blk.y = y - titleH - 14;
    lines.forEach((l, k) => { y += lh + (l.gapBefore && k > 0 ? lh * 0.45 : 0); });
    y += 20;
    blocks.push(blk);
  });
  return { blocks, total: y, fs, lh, secFs };
}
const docCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const G = readerGeom(), PANEL = G.panel, VIEW = viewOf(PANEL), cx = PANEL.x + PANEL.w / 2;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}:${list.length}:${list.map((x) => x.p.length).join('')}`;
  let doc = docCache.get(pkey);
  if (!doc) { doc = buildDoc(ctx, list, sc, PANEL.w); docCache.set(pkey, doc); if (docCache.size > 40) docCache.delete(docCache.keys().next().value); }
  DOC = { total: doc.total, view: VIEW.bottom - VIEW.top };
  const maxS = Math.max(0, doc.total - DOC.view);
  const scroll = Math.max(0, Math.min(state.ui.scroll, maxS));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(60,32,14,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, cx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,32,14,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x + 8, VIEW.top - 6, PANEL.w - 16, DOC.view + 12); ctx.clip();
  const top = VIEW.top - scroll;
  doc.blocks.forEach((blk, bi) => {
    let y = top + blk.y;
    const h = blk.titleH + 14 + blk.lines.length * doc.lh * 1.1 + 20;
    if (y > VIEW.bottom + 20 || y + h < VIEW.top - 20) return;
    if (bi > 0) { ctx.strokeStyle = 'rgba(60,32,14,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${doc.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, cx, y + doc.secFs * (0.9 + k * 1.2)));
    y += blk.titleH + 14;
    ctx.fillStyle = C.ink; ctx.font = `400 ${doc.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += doc.lh * 0.45; if (y > VIEW.top - doc.lh && y < VIEW.bottom + doc.lh) ctx.fillText(l.text, PANEL.x + 44, y + doc.fs * 0.85); y += doc.lh; });
  });
  ctx.restore();
  // scroll bar + fades so it is obvious the page continues
  if (maxS > 0) {
    const th = Math.max(56, DOC.view * (DOC.view / doc.total)), ty = VIEW.top + (scroll / maxS) * (DOC.view - th);
    roundPath(ctx, PANEL.x + PANEL.w - 18, VIEW.top, 7, DOC.view, 3.5); ctx.fillStyle = 'rgba(60,32,14,0.14)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 18, ty, 7, th, 3.5); ctx.fillStyle = 'rgba(168,48,31,0.85)'; ctx.fill();
    if (scroll < maxS - 4) { const g = ctx.createLinearGradient(0, VIEW.bottom - 50, 0, VIEW.bottom); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)'); ctx.fillStyle = g; ctx.fillRect(PANEL.x + 8, VIEW.bottom - 50, PANEL.w - 36, 50); }
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(60,32,14,0.7)'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(maxS > 0 ? `${Math.round(100 * scroll / maxS)}% read${scroll < maxS - 2 ? '  ·  drag or scroll for more' : '  ·  end'}` : 'All on one screen', cx, PANEL.y + PANEL.h - 22);
  drawButton(ctx, G.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, G.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${Math.round(sc * 100)}%`, G.label.x, G.label.y);
  drawButton(ctx, G.back, scroll < 2 ? 'Close' : 'Back', { size: G.side ? 28 : 32 });
  drawButton(ctx, G.next, scroll >= maxS - 2 ? 'Done' : 'Next', { primary: true, size: G.side ? 28 : 32 });
}
