// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the paginated About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, THINK_STEPS, colGeom, readerLayout, setupPins, host, isWide, minFont } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, MATCH_POINTS, PACE_IDS, HW, L, SHORT, TOP, TIN, SERVE_LINE } from './consts.js';
import { LESSONS, QUIZ } from './content.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const LOCKUP_H = 70, LOCK_STRIP = LOCKUP_H + 30;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
// Where each flow screen sits: the centred column (x, w), its vertical range and the button height factor (landscape is short).
function geomFor(key) {
  const c = colGeom(), wide = c.wide, hk = wide ? 0.82 : 1;
  if (key === 'title') {
    if (!wide) return { x: c.x, w: c.w, top: host.t, bottom: H - host.b - LOCK_STRIP, hk: H < 1100 ? 0.86 : 1, wide };
    const cw = Math.min(560, Math.round(W * 0.4)), x = W - host.r - 40 - cw;
    return { x, w: cw, top: host.t + 12, bottom: H - host.b - 12 - LOCK_STRIP + 12, hk, wide, heroCx: Math.round((x - 20) / 2) };
  }
  if (key === 'setup') return { x: c.x, w: c.w, top: host.t, bottom: setupPins().start.y - 26, hk, wide };
  return { x: c.x, w: c.w, top: host.t, bottom: H - host.b, hk, wide };
}
const WIDGETS = { title: titleWidgets, setup: setupWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, learn: learnWidgets, lesson: lessonWidgets, quiz: quizWidgets, lessonresult: lessonResultWidgets };
export function ensureLayout(state, key) {
  const wf = WIDGETS[key];
  if (!wf) return;
  const g = geomFor(key);
  const lay = flowLayout(estCtx, wf(state, g.wide), TEXT_SCALES[state.settings.textIdx], { x: g.x, w: g.w, hk: g.hk });
  LAID = { key, lay, top: g.top, bottom: g.bottom, h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = (k = 1) => ({
  t: 'art', h: Math.round(400 * k),
  draw(ctx, w) {
    ctx.save(); ctx.scale(k, k); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / k / 2;
    ctx.font = `700 40px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('WALL BALL', cx, 118);
    ctx.font = `700 116px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Pelota', cx, 236); ctx.fillText('Vasca', cx, 346);
    ctx.restore();
  },
});

export function titleWidgets(state, wide = false) {
  const sv = state.saved;
  return [
    ...(wide ? [] : [heroArt(H < 1100 ? 0.78 : 1)]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.oppName} · ${sv.pts[0]}-${sv.pts[1]}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: 88 },
    { t: 'btn', id: 'quick', label: 'Quick match', sub: `To ${MATCH_POINTS.quick}`, row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Six lessons', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two sides play while you learn why' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.watch ? 'Watch & Learn' : 'New match', size: 48 }];
  wd.push({ t: 'p', label: 'Players', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'mode-1', label: 'One on one', row: 9, active: s.mode === '1v1' });
  wd.push({ t: 'btn', id: 'mode-2', label: 'Two on two', row: 9, active: s.mode === '2v2' });
  if (s.mode === '2v2' && !s.watch) {
    wd.push({ t: 'p', label: 'Your role (fixed for the match)', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'role-front', label: 'Front', sub: 'Short balls and drops', row: 13, active: s.role === 'front' });
    wd.push({ t: 'btn', id: 'role-back', label: 'Back', sub: 'Deep balls and rebotes', row: 13, active: s.role === 'back' });
    wd.push({ t: 'btn', id: 'role-guide', label: 'Role guide', dark: true, h: 70 });
    wd.push({ t: 'p', label: s.role === 'front' ? 'The front player waits near the front wall, takes balls that drop short and plays drops and quick volleys. Your partner covers the back.' : 'The back player waits near the back wall, takes deep balls and rebotes off the back wall and plays long drives and lobs. Your partner covers the front.', size: 22 });
  }
  wd.push({ t: 'p', label: 'Equipment', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'eq-hand', label: 'Hand ball', row: 10, active: s.equip === 'hand' });
  wd.push({ t: 'btn', id: 'eq-paddle', label: 'Paddle', row: 10, active: s.equip === 'paddle', disabled: demo, sub: demo ? 'In the full game' : '', hitDisabled: true });
  if (!s.watch) {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 84 });
    });
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'len-full', label: `To ${MATCH_POINTS.full}`, row: 11, active: s.len === 'full', disabled: demo, hitDisabled: true });
    wd.push({ t: 'btn', id: 'len-quick', label: `To ${MATCH_POINTS.quick}`, row: 11, active: s.len === 'quick' || demo });
  } else {
    wd.push({ t: 'p', label: 'Side on the left of the screen', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push({ t: 'p', label: 'Side on the right of the screen', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wb${i + 1}`, label: l.name, active: s.opp === i + 1, row: 30 + (i < 3 ? 0 : 1), h: 70 }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const pn = { relaxed: 'Relaxed', normal: 'Normal', fast: 'Fast' };
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Pace: ${pn[st.pace]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'pace-relaxed', label: 'Relaxed', row: 12, active: st.pace === 'relaxed' },
    { t: 'btn', id: 'pace-normal', label: 'Normal', row: 12, active: st.pace === 'normal' },
    { t: 'btn', id: 'pace-fast', label: 'Fast', row: 12, active: st.pace === 'fast' },
    { t: 'btn', id: 'set-auto', label: st.auto ? 'Auto-run: On' : 'Auto-run: Off' },
    { t: 'btn', id: 'set-autoaim', label: st.autoAim ? 'Auto aim: On' : 'Auto aim: Off' },
    { t: 'btn', id: 'set-guide', label: st.guide ? 'Aim guide: On' : 'Aim guide: Off' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.sim.s.match, st = m.stats;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const win = m.winner;
  const mode = state.setup.lastMode;
  const youWin = win === 0 && mode !== 'watch';
  const title = mode === 'watch' ? `${win === 0 ? 'Red' : 'Blue'} win` : youWin ? 'You win!' : 'You lose this one';
  const wd = [{ t: 'gap', h: big ? 24 : 150 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${m.pts[0]} – ${m.pts[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: `Rallies: ${m.rallies}. Longest rally: ${m.longest} strikes. Your winners ${st[0].winners}, errors ${st[0].errors}, serve faults ${st[0].faults}.`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
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
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Save and quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, the paddle, full length matches, all Learn lessons and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Six short lessons. Each one is a practice you play on the real court against a ball machine.', size: 26 },
    ...LESSONS.map((l, i) => ({ t: 'btn', id: `lesson${i}`, label: l.title, sub: done[l.id] ? `Done · ${l.goal}` : l.goal, active: !!done[l.id], h: 96 })),
    { t: 'btn', id: 'role-tut', label: 'Role guide: front and back', dark: true, h: 84 },
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
    { t: 'btn', id: 'lesson-go', label: l.quiz ? 'Start the quiz' : 'Start the practice', primary: true, h: 92 },
    { t: 'btn', id: 'lesson-back', label: 'Back to lessons', dark: true },
    { t: 'gap', h: 30 },
  ];
}
export function quizWidgets(state) {
  const q = QUIZ[state.learn.qi];
  return [
    { t: 'gap', h: 20 }, { t: 'p', label: `Question ${state.learn.qi + 1} of ${QUIZ.length}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'h', label: q.q, size: 38, cap: 1.3 },
    ...q.a.map((a, i) => ({ t: 'btn', id: `ans${i}`, label: a, h: 92 })),
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

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,14,26,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,14,26,${a})`); g.addColorStop(1, `rgba(6,14,26,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(1, 'rgba(6,14,26,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, g = geomFor(key)) {
  const { top, bottom } = g, sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, { x: g.x, w: g.w, hk: g.hk });
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, Math.min(W - 10, g.x + g.w + 14), ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, g.x - 20, g.w + 40);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(0, 0, W, H); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  ctx.clearRect(0, 0, W, H);
  const g = geomFor('title');
  if (!g.wide) {
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(6,14,26,0.15)'); gr.addColorStop(0.35, 'rgba(6,14,26,0.45)'); gr.addColorStop(1, 'rgba(6,14,26,0.9)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  } else {
    const gr = ctx.createLinearGradient(g.x - 90, 0, g.x + 40, 0); gr.addColorStop(0, 'rgba(6,14,26,0)'); gr.addColorStop(1, 'rgba(6,14,26,0.82)');
    ctx.fillStyle = gr; ctx.fillRect(g.x - 90, 0, W - g.x + 90, H);
    ctx.fillStyle = 'rgba(6,14,26,0.82)'; ctx.fillRect(g.x + 40, 0, W, H);
    const gl = ctx.createLinearGradient(0, 0, g.x * 0.8, 0); gl.addColorStop(0, 'rgba(6,14,26,0.45)'); gl.addColorStop(1, 'rgba(6,14,26,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, g.x, H);
  }
  drawFlowScreen(ctx, state, 'title', titleWidgets(state, g.wide), g);
  if (g.wide) {
    const hw = g.heroCx * 2;
    ctx.save(); ctx.translate(g.heroCx - hw / 2, Math.round((H - 400) / 2) - 34); heroArt().draw(ctx, hw); ctx.restore();
  }
  {   // themed lockup: bottom centre, directly under the last row of menu buttons (pinned to the bottom when the menu scrolls)
    const btns = LAID.lay.items.filter((i) => i.w.t === 'btn');
    const x0 = Math.min(...btns.map((i) => i.x)), x1 = Math.max(...btns.map((i) => i.x + i.wd)), lcx = (x0 + x1) / 2;
    const ly = Math.min(H - host.b - LOCKUP_H - 8, LAID.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20);
    const lw = Math.round(LOCKUP_H * 1200 / 327), m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(LOCKUP_H + 12, m);
    titleLockTap = { x: lcx - tw / 2, y: ly + LOCKUP_H + 6 - th, w: tw, h: th };
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(6,14,26,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, LOCKUP_H + 12, (LOCKUP_H + 12) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, lcx, ly, LOCKUP_H, 1);
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${minFont(18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', g.wide ? g.heroCx : W / 2, H - 8 - host.b); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  const pins = setupPins(), g = geomFor('setup');
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), g);
  const y0 = pins.start.y - 56;
  const gr = ctx.createLinearGradient(0, y0, 0, H);
  gr.addColorStop(0, 'rgba(6,14,26,0)'); gr.addColorStop(0.2, 'rgba(6,14,26,0.88)'); gr.addColorStop(1, 'rgba(6,14,26,0.95)');
  ctx.fillStyle = gr; ctx.fillRect(0, y0, W, H - y0);
  const pz = Math.min(TEXT_SCALES[state.settings.textIdx], 1.4);
  drawButton(ctx, pins.start, state.setup.watch ? 'Watch the match' : 'Start the match', { primary: true, size: Math.round(32 * pz) });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: Math.round(28 * pz) });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pins.start.y - 16); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); };
export function renderResult(ctx, state) {
  ctx.clearRect(0, 0, W, H); scrim(ctx, 0.62);
  const g = geomFor('result'), r = drawFlowScreen(ctx, state, 'result', resultWidgets(state), g);
  // a quiet pointer to the other games, below the buttons (or at the foot of the screen when the list scrolls)
  const endY = g.top + r.lay.contentH - r.scroll, y = r.maxScroll > 0 ? Math.min(g.bottom - 4, endY + 20) : Math.min(H - host.b - 30, endY + 26);
  if (y > g.top + 40 && y < H) drawMoreLine(ctx, W / 2, y, minFont(22));
}
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets()); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'learn', learnWidgets(state)); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lesson', lessonWidgets(state)); };
export const renderQuiz = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state)); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult', lessonResultWidgets(state)); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), wide = isWide();
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60 - 2 * Math.max(host.l, host.r));
  const lay = flowLayout(ctx, wd, sc, { x: Math.round((W - pw) / 2) + 30, w: pw - 60, hk: wide ? 0.82 : 1 });
  const top = (wide ? 24 : 70) + host.t, bottom = H - (wide ? 24 : 70) - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, Math.round((W - pw) / 2), y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(14,34,52,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, Math.round((W - pw) / 2), pw);
}

// ---- reference pages (About, How to Play, Rules, Role guide): one continuous reader that scrolls ---------------------
// Drag, mouse wheel, arrow / page keys all scroll; a scroll bar and a "more" pill show that there is text below. The text size
// (100-300%) re-flows the document; scrolling always reaches the last line.
let READER = { key: '', contentH: 0, viewH: 0 };
export const readerMeta = () => READER;

function buildDoc(ctx, list, scale, pw) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = pw - 96;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = []; let y = 18;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 4 }); y += 14; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', tl, y });
    y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale < 2) { items.push({ k: 'art', key: sec.art, y, h: 198 }); y += 210; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', text: l, y }); y += lh; });
    });
    y += 22;
  });
  return { items, contentH: y + 10, fs, lh, secFs };
}
const docCache = new Map();
function getDoc(ctx, list, header, sc) {
  const pw = readerLayout().panel.w, key = `${header}:${sc}:${list.length}:${pw}`;
  let d = docCache.get(key);
  if (!d) { d = buildDoc(ctx, list, sc, pw); docCache.set(key, d); }
  return { d, key };
}
/** Called from update (before the first render of a screen) so the scroll limit is known; the real render overwrites it. */
export function ensureReader(state, list, header) {
  const { d, key } = getDoc(estCtx, list, 'est' + header, TEXT_SCALES[state.settings.textIdx]);
  if (READER.key !== key.replace('est', '')) READER = { key: key.replace('est', ''), contentH: d.contentH, viewH: readerLayout().view.h, est: true };
}
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = readerLayout(), PANEL = RL.panel, VIEW = RL.view;
  const { d, key } = getDoc(ctx, list, header, sc);
  READER = { key, contentH: d.contentH, viewH: VIEW.h };
  const maxScroll = Math.max(0, d.contentH - VIEW.h);
  const scroll = Math.min(Math.max(0, state.ui.scroll), maxScroll);
  const mid = PANEL.x + PANEL.w / 2;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, mid, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h); ctx.clip();
  const oy = VIEW.y - scroll;
  const vis = (y, h) => y + h >= scroll - 4 && y <= scroll + VIEW.h + 4;
  for (const it of d.items) {
    if (it.k === 'rule') { if (vis(it.y, 2)) { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, oy + it.y); ctx.lineTo(PANEL.x + PANEL.w - 80, oy + it.y); ctx.stroke(); } }
    else if (it.k === 'title') {
      if (!vis(it.y, it.tl.length * d.secFs * 1.2)) continue;
      ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${d.secFs}px ${FONT}`;
      it.tl.forEach((l, k) => ctx.fillText(l, mid, oy + it.y + d.secFs * (0.9 + k * 1.2) - 8));
    } else if (it.k === 'art') {
      if (!vis(it.y, it.h)) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, oy + it.y, PANEL.w - 40, it.h); ctx.clip(); drawArt(it.key, ctx, PANEL.x + 40, oy + it.y, PANEL.w - 80, it.h - 12); ctx.restore();
    } else {
      if (!vis(it.y, d.lh)) continue;
      ctx.fillStyle = C.ink; ctx.font = `400 ${d.fs}px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(it.text, PANEL.x + 40, oy + it.y + d.fs * 0.85);
    }
  }
  ctx.restore();
  if (maxScroll > 0) {
    const th = Math.max(60, VIEW.h * (VIEW.h / d.contentH)), ty = VIEW.y + (scroll / maxScroll) * (VIEW.h - th);
    roundPath(ctx, PANEL.x + PANEL.w - 18, VIEW.y, 8, VIEW.h, 4); ctx.fillStyle = 'rgba(19,40,58,0.12)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 18, ty, 8, th, 4); ctx.fillStyle = 'rgba(19,40,58,0.55)'; ctx.fill();
    const pillW = Math.round(124 * Math.max(1, minFont(22) / 22)), pillH = Math.round(36 * Math.max(1, minFont(22) / 22));
    const lab = scroll < maxScroll - 4 ? '▼ more' : 'The end';
    if (scroll < maxScroll - 4) {
      const g = ctx.createLinearGradient(0, VIEW.y + VIEW.h - 80, 0, VIEW.y + VIEW.h); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.95)');
      ctx.fillStyle = g; ctx.fillRect(VIEW.x, VIEW.y + VIEW.h - 80, VIEW.w, 80);
    }
    roundPath(ctx, mid - pillW / 2, VIEW.y + VIEW.h - pillH - 8, pillW, pillH, pillH / 2); ctx.fillStyle = 'rgba(19,40,58,0.9)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, mid, VIEW.y + VIEW.h - pillH / 2 - 8);
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${minFont(24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x + RL.pct.w / 2, RL.pct.y + RL.pct.h / 2); ctx.textBaseline = 'alphabetic';
  const rz = Math.min(sc, 1.4);
  drawButton(ctx, RL.back, 'Close', { size: Math.round(32 * rz) });
  drawButton(ctx, RL.next, scroll >= maxScroll - 4 ? (maxScroll > 0 ? 'Top ▲' : 'Done') : 'Next ▼', { primary: true, size: Math.round(32 * rz) });
}

// ---- diagrams: the court drawn with the game's own geometry --------------------------------------------------------------
// Top-down: the front wall is at the top, the left wall on the left (as the player sees it from behind the back wall).
function courtBox(x, y, w, h) {
  const s = Math.min((w * 0.8) / (2 * HW), (h * 0.9) / L);
  const cw = 2 * HW * s, ch = L * s, cx = x + w / 2, cy = y + h / 2;
  return { x0: cx - cw / 2, y0: cy - ch / 2, w: cw, h: ch, s, px: (px) => cx - px * s, pz: (pz) => cy + ch / 2 - pz * s };
}
function drawCourt(ctx, B) {
  roundPath(ctx, B.x0, B.y0, B.w, B.h, 4); ctx.fillStyle = '#d6c9a8'; ctx.fill();
  ctx.fillStyle = '#d8cdb6'; ctx.fillRect(B.x0 - 7, B.y0 - 7, 7, B.h + 7); ctx.fillRect(B.x0 - 7, B.y0 - 10, B.w + 14, 10);   // left wall, front wall
  ctx.fillStyle = '#2b5d4b'; ctx.fillRect(B.x0 - 2, B.y0 - 4, B.w + 4, 4);
  ctx.strokeStyle = '#a8322a'; ctx.lineWidth = 2; ctx.strokeRect(B.x0, B.y0, B.w, B.h);
  ctx.beginPath(); ctx.moveTo(B.x0, B.pz(SHORT)); ctx.lineTo(B.x0 + B.w, B.pz(SHORT)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(B.x0, B.y0 + B.h); ctx.lineTo(B.x0 + B.w, B.y0 + B.h); ctx.stroke();
}
const dot = (ctx, x, y, col, r = 9) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke(); };
function arrow(ctx, x0, y0, x1, y1, col = '#ffc94d', wd = 4, dash = false) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); ctx.restore();
}
// Captions stay inside the illustration box (ARTBOX is set by drawArt): never clipped at an edge, never over the heading above.
let ARTBOX = null;
function label(ctx, t, x, y, size = 18, col = '#fff6e4', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${minFont(size)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
  if (ARTBOX) {
    const tw = ctx.measureText(t).width, l = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const cl = Math.max(ARTBOX.x0, Math.min(ARTBOX.x1 - tw, l));
    x = align === 'center' ? cl + tw / 2 : align === 'right' ? cl + tw : cl; y = Math.max(ARTBOX.y0, Math.min(ARTBOX.y1, y));
  }
  ctx.fillText(t, x, y); ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ARTBOX = { x0: x + 8, x1: x + w - 8, y0: y + 18, y1: y + h - 4 };
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(29,42,38,0.94)'; ctx.fill();
  const B = courtBox(x, y, w, h);
  const R = '#e44', Bl = '#37c', Y = '#ffc94d';
  const A = {
    court() { drawCourt(ctx, B); label(ctx, 'front wall', B.x0 + B.w / 2, B.y0 - 14, 16); label(ctx, 'left wall', B.x0 - 12, B.y0 + B.h / 2, 15, '#fff6e4', 'right'); label(ctx, 'open side', B.x0 + B.w + 8, B.y0 + B.h / 2, 15, '#fff6e4', 'left'); label(ctx, 'rebote', B.x0 + B.w / 2, B.y0 + B.h + 20, 15); dot(ctx, B.px(0.8), B.pz(5), R); dot(ctx, B.px(-0.8), B.pz(4.8), Bl); },
    wall() {
      const fw = Math.min(w - 230, 330), fh = h - 50, fx = x + 24, fy = y + 18;
      const sy = (m) => fy + fh - (m / 6.2) * fh;
      ctx.fillStyle = '#d8cdb6'; ctx.fillRect(fx, fy, fw, fh); ctx.fillStyle = '#2b5d4b'; ctx.fillRect(fx, sy(TIN), fw, fh - (sy(TIN) - fy));
      ctx.strokeStyle = '#a8322a'; ctx.lineWidth = 3;
      for (const m of [SERVE_LINE, TOP]) { ctx.beginPath(); ctx.moveTo(fx, sy(m)); ctx.lineTo(fx + fw, sy(m)); ctx.stroke(); }
      label(ctx, 'top line: above is out', fx + fw + 10, sy(TOP) + 5, 15, '#fff6e4', 'left'); label(ctx, 'serve line', fx + fw + 10, sy(SERVE_LINE) + 5, 15, '#fff6e4', 'left'); label(ctx, 'tin: a fault', fx + fw + 10, sy(TIN / 2) + 5, 15, '#fff6e4', 'left');
      ctx.fillStyle = 'rgba(127,232,214,0.22)'; ctx.fillRect(fx, sy(TOP), fw, sy(TIN) - sy(TOP));
      label(ctx, 'good', fx + 8, sy(3), 16, '#7fe8d6', 'left');
    },
    serve() { drawCourt(ctx, B); dot(ctx, B.px(1.3), B.pz(2.5), R); arrow(ctx, B.px(1.3), B.pz(2.8), B.px(0.2), B.pz(L - 0.4), Y, 4); arrow(ctx, B.px(0.2), B.pz(L - 0.4), B.px(-1.6), B.pz(3.2), '#fff', 3, true); label(ctx, 'must land past this line', B.x0 + B.w / 2, B.pz(SHORT) - 6, 14, '#ffe9a0'); },
    rebote() { drawCourt(ctx, B); dot(ctx, B.px(0.8), B.pz(5), R); arrow(ctx, B.px(0.6), B.pz(5.4), B.px(-0.2), B.pz(L - 0.5), Y, 4); arrow(ctx, B.px(-0.2), B.pz(L - 0.5), B.px(1.8), B.pz(1.0), '#fff', 3, true); arrow(ctx, B.px(1.8), B.pz(0.6), B.px(0.6), B.pz(2.8), '#7fe8d6', 3, true); label(ctx, 'rebote', B.px(1.8), B.pz(0.0) + 22, 14, '#ffe9a0'); },
    roles() { drawCourt(ctx, B); dot(ctx, B.px(1.2), B.pz(7.6), R, 11); label(ctx, 'Front', B.px(1.2), B.pz(7.6) - 18, 16); dot(ctx, B.px(0.9), B.pz(3.4), R, 11); label(ctx, 'Back', B.px(0.9), B.pz(3.4) + 28, 16); dot(ctx, B.px(-1.1), B.pz(7.4), Bl, 11); dot(ctx, B.px(-0.9), B.pz(3.2), Bl, 11); },
    swing() { const cx = x + w / 2, cy = y + h / 2; for (const [r, a] of [[78, 0.25], [52, 0.5], [30, 0.9]]) { ctx.strokeStyle = `rgba(255,213,74,${a})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); } ctx.fillStyle = '#c8402e'; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, TAU); ctx.fill(); label(ctx, 'press when it closes', cx, y + h - 14, 17); },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffe9a0'], ['REVEAL', '#7fe8d6'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const cx = x + 10 + i * (cw + 10); roundPath(ctx, cx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, cx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.court)();
  ARTBOX = null; ctx.restore();
}
