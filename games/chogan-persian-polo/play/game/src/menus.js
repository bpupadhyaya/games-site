// Every screen that is not the play screen: title, setup (role select), learn, settings, result, pause and the paginated About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, PERIOD_SECS, HW, HL, GOAL_HW, REACH, FIG, SPOTS } from './consts.js';
import { SHOW_CAM, projectWith } from './camera.js';
const spotFor = (team, role) => (team === 0 ? { x: SPOTS[role].x, z: SPOTS[role].z } : { x: -SPOTS[role].x, z: -SPOTS[role].z });
import { LESSONS, QUIZ, ROLE_INFO } from './content.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  const defs = { title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H], learn: [learnWidgets, 0, H], lesson: [lessonWidgets, 0, H], quiz: [quizWidgets, 0, H], lessonresult: [lessonResultWidgets, 0, H], pause: [pauseWidgets, 0, H] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function invalidateLayout() { LAID = { key: '', lay: null, top: 0, bottom: H }; }
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 380,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('THE ANCIENT GAME OF POLO', cx, 90);
    ctx.font = `700 124px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Chogan', cx, 224);
    ctx.font = `400 64px ${DISPLAY}`; ctx.fillStyle = '#ffd97a'; ctx.shadowBlur = 8;
    ctx.fillText('چوگان', cx, 312);
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sv = state.saved;
  return [
    heroArt(),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${ROLE_INFO[sv.role].name} · Period ${sv.period} · ${sv.score[0]}-${sv.score[1]}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: 88 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Six short lessons' },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Computer teams play while you learn why' },
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
  if (!s.watch) {
    wd.push({ t: 'p', label: 'Your role (fixed for the match)', bold: true, color: '#ffe9a0', size: 26 });
    ROLE_INFO.forEach((r) => wd.push({ t: 'btn', id: `role${r.id}`, label: `${r.num}  ${r.name}`, sub: r.blurb, active: s.role === r.id, h: 92 }));
    wd.push({ t: 'btn', id: 'roletut', label: `How to play the ${ROLE_INFO[s.role].name}`, dark: true });
    wd.push({ t: 'p', label: 'Rival team', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 84 });
    });
    wd.push({ t: 'p', label: 'Length of each of the 4 periods', bold: true, color: '#ffe9a0', size: 26 });
    PERIOD_SECS.forEach((p, i) => wd.push({ t: 'btn', id: `len${i}`, label: `${p} s`, row: 9, active: s.lenIdx === i }));
  } else {
    wd.push({ t: 'p', label: 'Team on the red side (near the camera at the start)', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push({ t: 'p', label: 'Team on the blue side', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, active: s.opp === i + 1, row: 30 + (i < 3 ? 0 : 1), h: 70 }));
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
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Controls: stick on the left, SWING and HOOK on the right. Keyboard: arrows or WASD, Space to swing, Shift to sprint, H to hook.', size: 22 },
    { t: 'p', label: 'Language: English', size: 22 },
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
  const title = watch ? (s.winner < 0 ? 'A draw' : `${s.winner === 0 ? 'Red' : 'Blue'} win`) : s.winner < 0 ? 'A draw' : youWin ? 'You win the match!' : 'The other team win';
  const st = s.stats[0], ot = s.stats[1];
  const wd = [{ t: 'gap', h: big ? 24 : 130 }, { t: 'h', label: title, size: 54, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${s.score[0]} – ${s.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: `Red: ${st.goals} goals, ${st.hits} hits, ${st.hooks} hooks, ${st.fouls} fouls.  Blue: ${ot.goals} goals, ${ot.hits} hits, ${ot.hooks} hooks, ${ot.fouls} fouls.`, size: 24, cap: big ? 2 : 3 });
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
    { t: 'btn', id: 'quit', label: state.mode === 'match' ? 'Save and quit to menu' : 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, the full match length, Learn lessons and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Six short lessons. Each one is a practice you ride on the real field.', size: 26 },
    ...LESSONS.map((l, i) => ({ t: 'btn', id: `lesson${i}`, label: l.title, sub: done[l.id] ? `Done · ${l.goal}` : l.goal, active: !!done[l.id], h: 96 })),
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
  const q = QUIZ[state.learn.qi], order = state.learn.order;
  return [
    { t: 'gap', h: 20 }, { t: 'p', label: `Question ${state.learn.qi + 1} of ${QUIZ.length}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'h', label: q.q, size: 38, cap: 1.3 },
    ...order.map((i) => ({ t: 'btn', id: `ans${i}`, label: q.a[i], h: 92 })),
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
  g.addColorStop(0, `rgba(6,22,16,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,22,16,${a})`); g.addColorStop(1, `rgba(6,22,16,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,22,16,0)'); g.addColorStop(1, 'rgba(6,22,16,0.7)');
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
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(0, 0, W, H); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(6,22,16,0.15)'); g.addColorStop(0.35, 'rgba(6,22,16,0.45)'); g.addColorStop(1, 'rgba(6,22,16,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(6,22,16,0)'); g.addColorStop(0.2, 'rgba(6,22,16,0.88)'); g.addColorStop(1, 'rgba(6,22,16,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, state.setup.watch ? 'Watch the match' : 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); };
export const renderResult = (ctx, state) => { ctx.clearRect(0, 0, W, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lesson', lessonWidgets(state), 0, H); };
export const renderQuiz = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state), 0, H); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult', lessonResultWidgets(state), 0, H); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(12,38,30,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}

// ---- reference pages (Rules, How to Play, About, role guide): ONE scrolling column inside the panel ---------------------------------
// The text is laid out once per text size; the reader scrolls by finger drag, mouse wheel, arrow keys or the Back/Next page buttons, with a
// scroll bar and "more" / "up" hints, so nothing can be cut off at 300%.
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
export const REF_VIEW = { top: PANEL.y + 96, bottom: PANEL.y + PANEL.h - 56 };
let REF = { max: 0, vh: REF_VIEW.bottom - REF_VIEW.top, total: 0 };
export const refMeta = () => REF;

function buildFlow(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const blocks = []; let y = 8;
  list.forEach((sec, si) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const artH = sec.art ? (ART_TALL.has(sec.art) ? 500 : 210) : 0;
    const blk = { y, tl, titleH, art: sec.art || null, artH, lines, rule: si > 0 };
    let h = (blk.rule ? 16 : 0) + titleH + artH;
    lines.forEach((l, k) => { h += lh + (l.gapBefore && k > 0 ? lh * 0.45 : 0); });
    h += 30; blk.h = h; blocks.push(blk); y += h;
  });
  return { blocks, total: y, fs, lh, secFs };
}
const flowCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  state.artRect = null;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}:${list[list.length - 1].p.length}`;
  let F = flowCache.get(pkey);
  if (!F) { F = buildFlow(ctx, list, sc); flowCache.set(pkey, F); }
  const { top, bottom } = REF_VIEW, vh = bottom - top, max = Math.max(0, F.total - vh);
  REF = { max, vh, total: F.total };
  const scroll = Math.min(Math.max(0, state.ui.scroll), max); state.ui.scroll = scroll;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, vh); ctx.clip();
  for (const blk of F.blocks) {
    let y = top + blk.y - scroll;
    if (y > bottom || y + blk.h < top) continue;
    if (blk.rule) { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y + 4); ctx.lineTo(PANEL.x + PANEL.w - 80, y + 4); ctx.stroke(); y += 16; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${F.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, W / 2, y + F.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) {
      // a live 3D window is only used while it is fully inside the reader; partly scrolled out it is a still card
      const inside = y + blk.artH - 12 > top + 4 && y < bottom - 4;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, Math.max(y, top), PANEL.w - 40, blk.artH); ctx.clip();
      drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, inside ? state : null); ctx.restore(); y += blk.artH;
    }
    ctx.fillStyle = C.ink; ctx.font = `400 ${F.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += F.lh * 0.45; ctx.fillText(l.text, PANEL.x + 40, y + F.fs * 0.85); y += F.lh; });
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, vh * vh / F.total), ty = top + (scroll / max) * (vh - th);
    roundPath(ctx, PANEL.x + PANEL.w - 18, ty, 7, th, 3.5); ctx.fillStyle = 'rgba(19,40,58,0.45)'; ctx.fill();
    const cx = W / 2;
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, bottom - 70, 0, bottom); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)'); ctx.fillStyle = g; ctx.fillRect(PANEL.x + 10, bottom - 70, PANEL.w - 20, 70);
      roundPath(ctx, cx - 60, bottom - 38, 120, 32, 16); ctx.fillStyle = C.indigo; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u25bc scroll', cx, bottom - 21);
    }
    if (scroll > 4) {
      roundPath(ctx, cx - 40, top + 6, 80, 30, 15); ctx.fillStyle = C.indigo; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u25b2 up', cx, top + 21);
    }
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(19,40,58,0.7)';
  const pages = Math.max(1, Math.ceil(F.total / vh)), cur = max <= 0 ? 1 : Math.min(pages, 1 + Math.round(scroll / max * (pages - 1)));
  ctx.fillText(max > 0 ? `Screen ${cur} of ${pages}` : '', W / 2, PANEL.y + PANEL.h - 22);
  drawButton(ctx, TEXT_DEC, 'A\u2212', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, scroll <= 4 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, scroll >= max - 4 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- diagrams: a top-down field drawn with the game's own geometry --------------------------------------------------------
function fieldBox(x, y, w, h) {
  const fh = Math.min(h, w * (2 * HL) / (2 * HW)), fw = fh * HW / HL;
  const cx = x + w / 2, cy = y + h / 2, s = fh / (2 * HL);
  return { x0: cx - fw / 2, y0: cy - fh / 2, w: fw, h: fh, s, px: (px) => cx - px * s, pz: (pz) => cy - pz * s };
}
function drawField(ctx, B) {
  roundPath(ctx, B.x0, B.y0, B.w, B.h, 4); ctx.fillStyle = '#3f8a3d'; ctx.fill(); ctx.strokeStyle = '#f6f7fb'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(B.x0, B.pz(0)); ctx.lineTo(B.x0 + B.w, B.pz(0)); ctx.stroke();
  ctx.beginPath(); ctx.arc(B.px(0), B.pz(0), 2.6 * B.s, 0, TAU); ctx.stroke();
  for (const sg of [-1, 1]) { ctx.fillStyle = '#f4efe4'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(B.px(sx * GOAL_HW), B.pz(sg * HL), 4, 0, TAU); ctx.fill(); } }
}
const dot = (ctx, x, y, col, r = 9) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke(); };
function arrow(ctx, x0, y0, x1, y1, col = '#ffc94d', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function label(ctx, t, x, y, size = 18, col = '#fff6e4', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
export const ART_3D = new Set(['riding', 'stroke', 'reach', 'field', 'roles']);
const ART_TALL = new Set(['field', 'roles']);
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save();
  if (ART_3D.has(key) && state) {
    // a window onto the real 3D horse and rider: the 2D panel is cut away here and the presenter draws the showcase behind it
    state.artRect = { key, x, y, w, h, c0: Math.max(y, REF_VIEW.top), c1: Math.min(y + h, REF_VIEW.bottom) };
    roundPath(ctx, x, y, w, h, 16); ctx.clip(); ctx.clearRect(x, y, w, h);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(19,40,58,0.55)'; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
    if (key === 'field' || key === 'roles') {
      const pr = (px, py, pz) => projectWith(SHOW_CAM, SHOW_CAM.fov, w, h, px, py, pz), at = (q) => q && { x: x + q.x, y: y + q.y };
      if (key === 'roles') {
        for (let role = 0; role < 3; role++) for (const team of [0, 1]) {
          const sp = spotFor(team, role), q = at(pr(sp.x, 2.9 * FIG, sp.z)); if (!q) continue;
          ctx.beginPath(); ctx.arc(q.x, q.y, 17, 0, TAU); ctx.fillStyle = team === 0 ? '#d0342c' : '#1f6fc4'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff6e4'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(role + 1), q.x, q.y + 1);
        }
        label(ctx, 'Red: your side. You choose one rider.', x + w / 2, y + h - 40, 20); label(ctx, 'Blue: the computer', x + w / 2, y + h - 14, 18, '#bcd8ff');
        ctx.textBaseline = 'alphabetic';
      } else {
        const L = (a, b, txt, dy = 0) => { const p0 = at(pr(a[0], 0.05, a[1])), p1 = at(pr(b[0], 0.05, b[1])); if (!p0 || !p1) return; arrow(ctx, p0.x, p0.y, p1.x, p1.y, '#ffc94d', 3); arrow(ctx, p1.x, p1.y, p0.x, p0.y, '#ffc94d', 3); label(ctx, txt, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + dy, 20, '#ffe9a0'); };
        L([-HW - 0.9, -HL], [-HW - 0.9, HL], `${HL * 2} m`, -10);
        L([-HW, -HL - 1.4], [HW, -HL - 1.4], `${HW * 2} m`, 22);
        L([-GOAL_HW, HL + 1.8], [GOAL_HW, HL + 1.8], `goal ${GOAL_HW * 2} m`, -8);
        const q = at(pr(0, 0.05, 0)); if (q) label(ctx, 'centre', q.x + 70, q.y + 6, 16, '#fff6e4');
      }
    }
    if (key === 'reach') {
      // the envelopes of the three strokes over a top-down view of the horse (the showcase camera looks straight down; ahead is up)
      const sc = h / (2 * 9 * Math.tan(13 * Math.PI / 180)), cx = x + w / 2, cy = y + h / 2;
      const zone = (E, side, col) => { ctx.fillStyle = col; ctx.fillRect(cx + (side > 0 ? E.latMin : -E.latMax) * sc, cy - E.fMax * sc, (E.latMax - E.latMin) * sc, (E.fMax - E.fMin) * sc); };
      zone(REACH.R, 1, 'rgba(127,232,214,0.45)'); zone(REACH.B, 1, 'rgba(255,138,106,0.35)'); zone(REACH.L, -1, 'rgba(255,213,74,0.45)');
      label(ctx, 'forehand', cx + 1.0 * sc, cy - 1.2 * sc, 15, '#7fe8d6', 'left'); label(ctx, 'back-hand', cx + 1.0 * sc, cy + 0.9 * sc, 15, '#ff8a6a', 'left'); label(ctx, 'near side', cx - 1.0 * sc, cy - 1.3 * sc, 15, '#ffd54a', 'right');
    }
    ctx.restore();
    return;
  }
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(19,40,58,0.92)'; ctx.fill();
  const B = fieldBox(x + w * 0.52, y + 4, w * 0.46, h - 8);
  const A = {
    field() { drawField(ctx, B); label(ctx, `${HW * 2} m`, B.x0 + B.w / 2, B.y0 - 2, 14); label(ctx, `${HL * 2} m long`, x + 14, y + h / 2, 18, '#fff6e4', 'left'); label(ctx, `goal ${GOAL_HW * 2} m`, x + 14, y + h / 2 + 26, 16, '#ffe9a0', 'left'); },
    roles() { drawField(ctx, B); for (const [px, pz, c] of [[2.2, -2.4, '#e44'], [-2.4, -6.4, '#e44'], [0.4, -11.2, '#e44'], [-2.2, 2.4, '#37c'], [2.4, 6.4, '#37c'], [-0.4, 11.2, '#37c']]) dot(ctx, B.px(px), B.pz(pz), c, 7); label(ctx, '1', B.px(2.2), B.pz(-2.4) + 5, 12); label(ctx, '2', B.px(-2.4), B.pz(-6.4) + 5, 12); label(ctx, '3', B.px(0.4), B.pz(-11.2) + 5, 12); label(ctx, 'You pick one', x + 14, y + h / 2, 18, '#fff6e4', 'left'); },
    riding() { drawField(ctx, B); dot(ctx, B.px(2), B.pz(-6), '#e44'); arrow(ctx, B.px(2), B.pz(-6), B.px(-2), B.pz(2), '#fff', 3); label(ctx, 'wide turns at speed', x + 14, y + h / 2, 18, '#fff6e4', 'left'); },
    stroke() { drawField(ctx, B); dot(ctx, B.px(0), B.pz(-4), '#e44'); dot(ctx, B.px(-1), B.pz(-3.4), '#fff', 5); arrow(ctx, B.px(-1), B.pz(-3.4), B.px(1), B.pz(6), '#ffc94d', 5); label(ctx, 'hold, release, steer', x + 14, y + h / 2, 18, '#fff6e4', 'left'); },
    reach() {
      const cx = x + w * 0.27, cy = y + h / 2, s = 70;
      ctx.fillStyle = '#6b3a21'; roundPath(ctx, cx - 0.35 * s * 0.6, cy - 0.9 * s * 0.7, 0.7 * s * 0.6, 1.8 * s * 0.7, 8); ctx.fill();
      for (const [k, col, side] of [['R', 'rgba(127,232,214,0.45)', 1], ['L', 'rgba(255,201,77,0.45)', -1]]) { const E = REACH[k]; ctx.fillStyle = col; ctx.fillRect(cx + (side > 0 ? E.latMin : -E.latMax) * s * 0.6 * 1.0 - 0, cy - E.fMax * s * 0.7, (E.latMax - E.latMin) * s * 0.6, (E.fMax - E.fMin) * s * 0.7); }
      label(ctx, 'right: forehand', x + w * 0.52, y + 40, 16, '#7fe8d6', 'left'); label(ctx, 'left: near side', x + w * 0.52, y + 68, 16, '#ffd54a', 'left'); label(ctx, 'ahead is up', x + w * 0.52, y + 96, 16, '#fff6e4', 'left');
    },
  };
  (A[key] ?? A.field)();
  ctx.restore();
}
