// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the paginated About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, MODES, MODE_IDS, ROLES, HW, HL, ATK, TYPES, SLOT } from './consts.js';
import { LESSONS, QUIZ, ROLE_TUT } from './content.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = { title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H], learn: [learnWidgets, 0, H], lesson: [lessonWidgets, 0, H], quiz: [quizWidgets, 0, H], lessonresult: [lessonResultWidgets, 0, H], roleend: [roleEndWidgets, 0, H] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 400,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 40px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('SIX A SIDE · YOUR ROLE', cx, 150);
    ctx.font = `700 118px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Volleyball', cx, 290);
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sv = state.saved;
  return [
    heroArt(),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.roleName} · Set ${sv.setNo} · ${sv.pts[0]}-${sv.pts[1]}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: 88 },
    { t: 'btn', id: 'quick', label: 'Quick match', sub: 'One set to 15', row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Skills and roles', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two teams play while you learn why' },
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
    wd.push({ t: 'p', label: 'Choose your role', bold: true, color: '#ffe9a0', size: 26 });
    ROLES.forEach((r) => wd.push({ t: 'btn', id: `role-${r.id}`, label: r.name, sub: r.line, active: s.role === r.id, h: 88 }));
    wd.push({ t: 'btn', id: 'tutorial', label: `Tutorial: ${ROLES.find((r) => r.id === s.role).name}`, dark: true, h: 76 });
    wd.push({ t: 'p', label: 'Rival team', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 80 });
    });
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9a0', size: 26 });
    MODE_IDS.forEach((id) => wd.push({ t: 'btn', id: `len-${id}`, label: MODES[id].name, sub: MODES[id].blurb, active: s.mode === id, h: 80 }));
  } else {
    wd.push({ t: 'p', label: 'Choose the two teams', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'p', label: 'Blue (near side)', bold: true, size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, h: 70 }));
    wd.push({ t: 'p', label: 'Red (far side)', bold: true, size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, active: s.opp === i + 1, h: 70 }));
  }
  wd.push({ t: 'p', label: 'Event', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'ev-m', label: `Men, net ${2.43} m`, row: 10, active: !state.settings.women });
  wd.push({ t: 'btn', id: 'ev-f', label: `Women, net ${2.24} m`, row: 10, active: state.settings.women });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const mh = ['Off', 'Light', 'Full'];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Movement help: ${mh[st.assist]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'as-0', label: 'Off', row: 12, active: st.assist === 0 },
    { t: 'btn', id: 'as-1', label: 'Light', row: 12, active: st.assist === 1 },
    { t: 'btn', id: 'as-2', label: 'Full', row: 12, active: st.assist === 2 },
    { t: 'p', label: 'Full steps you to the ball when you let go of the stick. Light only helps with the last steps.', size: 22 },
    { t: 'btn', id: 'lib-toggle', label: st.liberoServes ? 'Libero serves: On' : 'Libero serves: Off (classic)', sub: 'Classic rule: the middle blocker serves; the libero sits out that rotation.' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Role, event and length are chosen when a match starts.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.sim.match;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const win = m.winner, mode = state.setup.lastMode;
  const youWin = win === 0;
  const title = mode === 'watch' ? `${win === 0 ? 'Blue' : 'Red'} win` : youWin ? 'You win the match!' : 'Red win the match';
  const wd = [{ t: 'gap', h: big ? 24 : 120 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${m.sets[0]} – ${m.sets[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: 'Sets: ' + m.setScores.map((x) => `${x[0]}-${x[1]}`).join('  '), size: 26, cap: big ? 2 : 3 });
  const st = m.stats[0];
  wd.push({ t: 'p', label: `Your team: ${st.aces} aces, ${st.kills} spike points, ${st.blocks} block points, ${st.digs} digs, ${st.errors} errors over ${m.history.length} rallies.`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function roleEndWidgets(state) {
  const r = ROLE_TUT[state.setup.role];
  return [
    { t: 'gap', h: 160 }, { t: 'h', label: r.title, size: 46 },
    { t: 'p', label: 'Ready to try it? A short practice puts you in this role with no score.', size: 28 },
    { t: 'btn', id: 'practice', label: 'Practice this role', primary: true, h: 92 },
    { t: 'btn', id: 'rt-back', label: 'Back to match setup', dark: true },
    { t: 'gap', h: 30 },
  ];
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
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, all match lengths, Learn lessons and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Short lessons for each skill, each a practice on the real court with the matching role.', size: 26 },
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
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(6,14,26,0.15)'); g.addColorStop(0.35, 'rgba(6,14,26,0.45)'); g.addColorStop(1, 'rgba(6,14,26,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(0.2, 'rgba(6,14,26,0.88)'); g.addColorStop(1, 'rgba(6,14,26,0.95)');
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
export const renderRoleEnd = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'roleend', roleEndWidgets(state), 0, H); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult', lessonResultWidgets(state), 0, H); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(14,34,52,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
  if (maxScroll > 0) { const th = Math.max(50, ch * (ch / lay.contentH)), ty = y0 + (sc0 / maxScroll) * (ch - th); roundPath(ctx, 30 + 660 - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.55)'; ctx.fill(); }
}

// ---- reference pages (Rules, How to Play, About, role guides): one continuous column that scrolls ----------------------------------
// Touch drag (with a little momentum), mouse wheel, arrow / Page / Space / Home / End keys; a scroll bar with a thumb, a "more" pill and the
// Back / Next buttons that move by one screenful. Text follows the 100-300% size setting; nothing is ever cut off.
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
export const READ_VIEW = { x: PANEL.x, y0: PANEL.y + 96, y1: PANEL.y + PANEL.h - 14, w: PANEL.w };
let READ = { max: 0, view: READ_VIEW.y1 - READ_VIEW.y0, content: 0 };
export const pagesMeta = () => READ;

function buildReader(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 14;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 6 }); y += 14; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl });
    y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale < 2) { items.push({ k: 'art', y, art: sec.art }); y += 250; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; });
    });
    y += 26;
  });
  return { items, fs, lh, secFs, contentH: y + 10 };
}
const readCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}`;
  let rd = readCache.get(pkey);
  if (!rd) { rd = buildReader(ctx, list, sc); readCache.set(pkey, rd); }
  const view = READ_VIEW.y1 - READ_VIEW.y0, max = Math.max(0, rd.contentH - view);
  const scroll = Math.max(0, Math.min(state.ui.scroll, max));
  READ = { max, view, content: rd.contentH };
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  const y0 = READ_VIEW.y0, y1 = READ_VIEW.y1;
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 6, y0, PANEL.w - 12, view); ctx.clip();
  for (const it of rd.items) {
    const y = y0 + it.y - scroll;
    if (y > y1 + 10) break;
    if (it.k === 'rule') { if (y > y0 - 4) { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); } continue; }
    if (it.k === 'title') {
      ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${rd.secFs}px ${FONT}`;
      it.lines.forEach((l, k) => { const ty = y + rd.secFs * (0.9 + k * 1.2) - 8; if (ty > y0 - 60 && ty < y1 + 40) ctx.fillText(l, W / 2, ty); });
    } else if (it.k === 'art') {
      if (y + 250 > y0 && y < y1) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 250); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 238); ctx.restore(); }
    } else if (y > y0 - rd.lh && y < y1 + 4) {
      ctx.fillStyle = C.ink; ctx.font = `400 ${rd.fs}px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(it.text, PANEL.x + 40, y + rd.fs * 0.85);
    }
  }
  ctx.restore();
  if (max > 0) {
    // scroll bar, edge fades and the "more" / "up" pill
    const th = Math.max(60, view * (view / rd.contentH)), ty = y0 + (scroll / max) * (view - th);
    roundPath(ctx, PANEL.x + PANEL.w - 16, y0, 8, view, 4); ctx.fillStyle = 'rgba(19,40,58,0.12)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 16, ty, 8, th, 4); ctx.fillStyle = 'rgba(19,40,58,0.55)'; ctx.fill();
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, y1 - 110, 0, y1); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(0.55, 'rgba(255,246,228,0.97)'); g.addColorStop(1, 'rgba(255,246,228,0.99)');
      ctx.fillStyle = g; ctx.fillRect(PANEL.x + 6, y1 - 110, PANEL.w - 30, 108);
      roundPath(ctx, W / 2 - 52, y1 - 46, 104, 36, 18); ctx.fillStyle = 'rgba(19,40,58,0.9)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', W / 2, y1 - 27); ctx.textBaseline = 'alphabetic';
    }
    if (scroll > 4) {
      roundPath(ctx, W / 2 - 40, y0 + 6, 80, 32, 16); ctx.fillStyle = 'rgba(19,40,58,0.9)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', W / 2, y0 + 22); ctx.textBaseline = 'alphabetic';
    }
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, scroll <= 4 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, scroll >= max - 4 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- diagrams: a top-down court drawn with the game's own geometry ---------------------------------
function courtBox(ctx, x, y, w, h) {
  const cw = Math.min(w * 0.46, h * 0.5), ch = cw * 2 > h ? h : cw * 2;
  const cwd = ch / 2;
  const cx = x + w / 2, cy = y + h / 2;
  return { x0: cx - cwd / 2, y0: cy - ch / 2, w: cwd, h: ch, s: ch / 18, px: (px) => cx - px * (ch / 18), pz: (pz) => cy - pz * (ch / 18) };
}
function drawCourt(ctx, B, opts = {}) {
  roundPath(ctx, B.x0, B.y0, B.w, B.h, 4); ctx.fillStyle = '#c98b4a'; ctx.fill();
  ctx.strokeStyle = '#f6f7fb'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(B.x0 - 8, B.y0 + B.h / 2); ctx.lineTo(B.x0 + B.w + 8, B.y0 + B.h / 2); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(B.x0, B.pz(sg * ATK)); ctx.lineTo(B.x0 + B.w, B.pz(sg * ATK)); ctx.stroke(); }
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
// team 0 (blue) on the near side (z < 0), shown from behind: team-left (+x) is on the left of the picture
const BLUE = '#2b6fd6', RED = '#d8423a', GOLD = '#ffd24a';
const fullTeam = (ctx, B, team, you) => {
  const sg = team === 0 ? -1 : 1;
  SLOT.forEach(([lat, d], i) => { const tp = [0, 1, 2, 3, 4, 5][i]; dot(ctx, B.px(lat * (team === 0 ? 1 : -1)), B.pz(sg * d), team === 0 ? BLUE : RED, 8); void tp; });
};
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(19,40,58,0.92)'; ctx.fill();
  const B = courtBox(ctx, x, y, w, h);
  const A = {
    court() { drawCourt(ctx, B); label(ctx, 'net', B.x0 + B.w + 30, B.pz(0) + 6, 16); label(ctx, '9 m', B.px(0), B.y0 - 4, 16); label(ctx, '3 m', B.x0 - 22, B.pz(-ATK) - 4, 14); fullTeam(ctx, B, 0); fullTeam(ctx, B, 1); },
    rotation() {
      drawCourt(ctx, B);
      SLOT.forEach(([lat, d], i) => { const px = B.px(lat), pz = B.pz(-d); dot(ctx, px, pz, i === 0 ? GOLD : BLUE, 11); label(ctx, `P${i + 1}`, px, pz + 5, 13, i === 0 ? '#13283a' : '#fff'); });
      arrow(ctx, B.px(-3), B.pz(-6.2), B.px(-3), B.pz(-2.4), '#fff', 3); arrow(ctx, B.px(-2.4), B.pz(-1.4), B.px(0.6), B.pz(-1.4), '#fff', 3); arrow(ctx, B.px(2.9), B.pz(-2.5), B.px(2.9), B.pz(-6), '#fff', 3);
      label(ctx, 'serve', B.px(-3), B.pz(-8.1), 14, GOLD);
    },
    serve() { drawCourt(ctx, B); dot(ctx, B.px(-2.4), B.pz(-9.7), BLUE); arrow(ctx, B.px(-2.4), B.pz(-9.5), B.px(1.5), B.pz(6.8), '#ffc94d', 5); dot(ctx, B.px(1.5), B.pz(6.8), '#ffc94d', 6); fullTeam(ctx, B, 1); },
    receive() { drawCourt(ctx, B); dot(ctx, B.px(0), B.pz(-6.4), BLUE); dot(ctx, B.px(-3), B.pz(-1.2), GOLD, 9); arrow(ctx, B.px(0.4), B.pz(-6.2), B.px(-2.7), B.pz(-1.6), '#fff', 4); label(ctx, 'pass', B.px(1.8), B.pz(-5), 15); label(ctx, 'setter', B.px(-4.2), B.pz(-0.4), 14); dot(ctx, B.px(1.4), B.pz(7), RED); dot(ctx, B.px(-1), B.pz(5.4), RED); },
    set() { drawCourt(ctx, B); dot(ctx, B.px(-1.4), B.pz(-1.3), GOLD); for (const [lat, nm] of [[3.6, 'outside'], [0.2, 'quick'], [-3.6, 'right']]) { dot(ctx, B.px(lat), B.pz(-0.8), BLUE, 8); arrow(ctx, B.px(-1.4), B.pz(-1.5), B.px(lat), B.pz(-1.0), '#fff', 2.5); label(ctx, nm, B.px(lat), B.pz(-2.4), 13); } dot(ctx, B.px(0.4), B.pz(-4.4), BLUE, 8); label(ctx, 'pipe', B.px(0.4), B.pz(-5.4), 13); dot(ctx, B.px(2.4), B.pz(1), RED); dot(ctx, B.px(-0.6), B.pz(1), RED); },
    attack() { drawCourt(ctx, B); dot(ctx, B.px(3.4), B.pz(-1), BLUE); dot(ctx, B.px(-0.2), B.pz(1), RED); dot(ctx, B.px(-2.2), B.pz(1), RED); dot(ctx, B.px(0), B.pz(6.4), RED); dot(ctx, B.px(3), B.pz(6.2), RED); arrow(ctx, B.px(3.4), B.pz(-1.2), B.px(-3.2), B.pz(5.8), '#ffc94d', 5); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(B.px(-3.2), B.pz(5.8), 12, 0, TAU); ctx.stroke(); label(ctx, 'open corner', B.px(-3.2) - 20, B.pz(5.8) + 24, 14, '#ffe9a0', 'right'); },
    block() { drawCourt(ctx, B); dot(ctx, B.px(-1.2), B.pz(0.8), RED); dot(ctx, B.px(0), B.pz(0.8), RED); dot(ctx, B.px(1.4), B.pz(-1.2), BLUE); arrow(ctx, B.px(1.4), B.pz(-1.4), B.px(-0.6), B.pz(0.4), '#ffc94d', 4); label(ctx, 'double block', B.px(-2.6), B.pz(2), 15, '#ffe9a0'); },
    ring() { const cx = x + w / 2, cy = y + h / 2; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy, 44, 18, 0, 0, TAU); ctx.stroke(); for (const [rx, ry, col] of [[110, 44, 'rgba(255,210,74,0.5)'], [78, 31, 'rgba(255,210,74,0.8)']]) { ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke(); } label(ctx, 'lift your finger as the ring closes', cx, y + h - 14, 16); },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffe9a0'], ['REVEAL', '#7fe8d6'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const cx = x + 10 + i * (cw + 10); roundPath(ctx, cx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, cx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.court)();
  ctx.restore();
}
