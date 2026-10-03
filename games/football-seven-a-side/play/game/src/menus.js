// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the paginated About / How to Play / Rules /
// role-guide reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, HALF_OPTIONS, CHOICES, HW, HL, GOAL_HW, BOX_HW, BOX_D, SPOT, CIRCLE_R } from './consts.js';
import { LESSONS, QUIZ } from './content.js';
import { KIT } from './hud.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = { title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H], learn: [learnWidgets, 0, H], lesson: [lessonWidgets, 0, H], quiz: [quizWidgets, 0, H], lessonresult: [lessonResultWidgets, 0, H] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }
export const dropLayout = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; };

const heroArt = () => ({
  t: 'art', h: 330,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('SEVEN A SIDE', cx, 92);
    ctx.font = `800 128px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Football', cx, 220);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = '#e2503c'; roundPath(ctx, cx - 120, 246, 240, 8, 4); ctx.fill();
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sv = state.saved;
  return [
    heroArt(),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.roleName} · ${sv.score[0]}-${sv.score[1]} · ${sv.half === 1 ? '1st' : '2nd'} half`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: 88 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Short drills for every role' },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two computer teams play while you learn why' },
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
    wd.push({ t: 'p', label: 'Your role (kept for the whole match)', bold: true, color: '#ffe9a0', size: 26 });
    CHOICES.forEach((c) => wd.push({ t: 'btn', id: `role-${c.id}`, label: c.name, sub: c.blurb, active: s.role === c.id, h: 96 }));
    if (s.role === 'W' || s.role === 'D') {
      wd.push({ t: 'p', label: 'Which side?', bold: true, color: '#ffe9a0', size: 24 });
      wd.push({ t: 'btn', id: 'side-L', label: 'Left', row: 8, active: s.side === 'L' });
      wd.push({ t: 'btn', id: 'side-R', label: 'Right', row: 8, active: s.side === 'R' });
    }
    wd.push({ t: 'btn', id: 'roleguide', label: 'Role guide', sub: 'What this role does and its controls', dark: true });
  }
  wd.push({ t: 'p', label: s.watch ? 'Team at the bottom of the screen' : 'Opponent', bold: true, color: '#ffe9a0', size: 26 });
  LEVELS.forEach((l, i) => {
    const locked = demo && i > 1 && !s.watch;
    wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 84 });
  });
  if (s.watch) { wd.push({ t: 'p', label: 'Team at the top of the screen', bold: true, color: '#ffe9a0', size: 24 }); LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wb${i + 1}`, label: l.name, active: s.watchB === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 })); }
  wd.push({ t: 'p', label: 'Length of each half', bold: true, color: '#ffe9a0', size: 26 });
  HALF_OPTIONS.forEach((h) => wd.push({ t: 'btn', id: `half${h}`, label: `${h / 60} min`, row: 9, active: s.half === h && !(demo && h > 120), disabled: demo && h > 120, hitDisabled: true }));
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
    { t: 'btn', id: 'set-tags', label: st.tags !== false ? 'Role tags over players: On' : 'Role tags over players: Off' },
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

const pct = (a, b) => (a + b > 0 ? Math.round((100 * a) / (a + b)) : 50);
export function resultWidgets(state) {
  const s = state.sim, st = s.stats;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const mode = state.mode;
  const win = s.winner;
  const names = state.teamNames;
  const title = mode === 'watch' ? (win < 0 ? 'A draw' : `${names[win]} win`) : win === 0 ? 'You win!' : win < 0 ? 'A draw' : `${names[1]} win`;
  const wd = [{ t: 'gap', h: big ? 24 : 110 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${s.score[0]} – ${s.score[1]}`, size: 90, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  const l1 = `Shots ${st[0].shots}–${st[1].shots}. Possession ${pct(st[0].poss, st[1].poss)}%–${pct(st[1].poss, st[0].poss)}%. Passes completed ${st[0].passOk} of ${st[0].passes} and ${st[1].passOk} of ${st[1].passes}. Tackles won ${st[0].tackles}–${st[1].tackles}. Fouls ${st[0].fouls}–${st[1].fouls}. Saves ${st[0].saves}–${st[1].saves}.`;
  wd.push({ t: 'p', label: l1, size: 24, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 20 });
  if (mode === 'watch') { wd.push({ t: 'btn', id: 'again', label: 'Watch another match', primary: true, h: 92 }); }
  else wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
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
    { t: 'btn', id: 'p-role', label: 'Role guide', row: 7 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 13 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 13 },
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: state.mode === 'drill' ? 'Quit the drill' : 'Save and quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every role, every level, longer halves, all the Learn drills and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Six short practice drills on the real pitch, then a rules quiz.', size: 26 },
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
    { t: 'btn', id: 'lesson-go', label: l.quiz ? 'Start the quiz' : 'Start the drill', primary: true, h: 92 },
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
    roundPath(ctx, W - 20, top + 6, 10, bottom - top - 12, 5); ctx.fillStyle = 'rgba(255,246,228,0.14)'; ctx.fill(); roundPath(ctx, W - 20, ty, 10, th, 5); ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
let NOGL = false;
export const setNoGL = (v) => { NOGL = !!v; };
const clear = (ctx) => { if (!NOGL) ctx.clearRect(0, 0, W, H); };
const bg = (ctx, a) => { clear(ctx); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  clear(ctx);
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
  drawButton(ctx, SETUP_PINS.start, state.setup.watch ? 'Watch the match' : 'Kick off', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); };
export const renderResult = (ctx, state) => { clear(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); };
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
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(14,34,52,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
  if (maxScroll > 0) {
    const th = Math.max(60, ch * (ch / lay.contentH)), ty = y0 + (sc0 / maxScroll) * (ch - th);
    roundPath(ctx, 668, y0, 10, ch, 5); ctx.fillStyle = 'rgba(255,246,228,0.14)'; ctx.fill(); roundPath(ctx, 668, ty, 10, th, 5); ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.fill();
  }
}

// ---- reference pages: one continuous document that scrolls (drag, wheel, keys) with a visible scroll bar ----------------------------------------
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
const DOC_TOP = PANEL.y + 96, DOC_BOT = PANEL.y + PANEL.h - 22;
const DOC = { max: 0, view: DOC_BOT - DOC_TOP, step: DOC_BOT - DOC_TOP - 70, h: 0, lastLine: 0 };
export const docMeta = () => ({ ...DOC, top: DOC_TOP, bottom: DOC_BOT });

function buildDoc(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80 - 22;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = []; let y = 8, lastLine = 0;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 6 }); y += 14; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs }); y += tl.length * secFs * 1.2 + 16;
    const artH = sec.art && scale < 2 ? 230 : 0;
    if (artH) { items.push({ k: 'art', y, h: artH, art: sec.art }); y += artH; }
    y += 10;
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l, fs }); lastLine = y; y += lh; });
    });
    y += 22;
  });
  return { items, h: y, fs, lh, lastLine };
}
const docCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}:${list[0] ? list[0].title : ''}`;
  let doc = docCache.get(pkey);
  if (!doc) { doc = buildDoc(ctx, list, sc); docCache.set(pkey, doc); }
  const view = DOC_BOT - DOC_TOP, max = Math.max(0, doc.h - view);
  DOC.max = max; DOC.view = view; DOC.step = view - 70; DOC.h = doc.h; DOC.lastLine = doc.lastLine;
  const scroll = Math.min(Math.max(0, state.ui.scroll), max);
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x + 8, DOC_TOP, PANEL.w - 16, view); ctx.clip();
  for (const it of doc.items) {
    const y = DOC_TOP + it.y - scroll;
    const hh = it.k === 'title' ? it.lines.length * it.fs * 1.2 : it.k === 'art' ? it.h : it.k === 'line' ? doc.lh : 4;
    if (y > DOC_BOT + 4 || y + hh < DOC_TOP - 4) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`; it.lines.forEach((l, k) => ctx.fillText(l, W / 2 - 11, y + it.fs * (0.9 + k * 1.2))); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 60, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 100, it.h - 12); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + it.fs * 0.85); }
  }
  ctx.restore();
  if (max > 0) {
    // a visible scroll bar: a track and a thumb whose size is the visible share of the document
    const tx = PANEL.x + PANEL.w - 26, tTop = DOC_TOP + 6, tH = view - 12, th = Math.max(56, tH * (view / doc.h)), ty = tTop + (scroll / max) * (tH - th);
    roundPath(ctx, tx, tTop, 12, tH, 6); ctx.fillStyle = 'rgba(19,40,58,0.16)'; ctx.fill();
    roundPath(ctx, tx, ty, 12, th, 6); ctx.fillStyle = 'rgba(19,40,58,0.62)'; ctx.fill();
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, DOC_BOT - 70, 0, DOC_BOT); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.96)');
      ctx.fillStyle = g; ctx.fillRect(PANEL.x + 8, DOC_BOT - 70, PANEL.w - 40, 70);
      roundPath(ctx, W / 2 - 60, DOC_BOT - 40, 120, 32, 16); ctx.fillStyle = 'rgba(19,40,58,0.85)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', W / 2, DOC_BOT - 23); ctx.textBaseline = 'alphabetic';
    }
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, scroll <= 2 ? 'Close' : 'Up', { size: 32 });
  drawButton(ctx, REF_NEXT, scroll >= max - 2 ? 'Done' : 'Down', { primary: true, size: 32 });
}

// ---- diagrams: the pitch drawn with the game's own geometry --------------------------------------------------------------------
function pitchBox(x, y, w, h) {
  // the pitch is taller than wide; fit it in the box leaving room for the goals
  const s = Math.min((w - 20) / (HW * 2 + 2), (h - 16) / (HL * 2 + 5));
  const cx = x + w / 2, cy = y + h / 2;
  return { s, px: (px) => cx - px * s, pz: (pz) => cy - pz * s, x0: cx - HW * s, y0: cy - HL * s, w: HW * 2 * s, h: HL * 2 * s };
}
function drawPitch(ctx, B) {
  ctx.fillStyle = '#2b8a4b'; ctx.fillRect(B.x0, B.y0, B.w, B.h);
  for (let i = 0; i < 8; i += 2) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(B.x0, B.y0 + i * B.h / 8, B.w, B.h / 8); }
  ctx.strokeStyle = '#f6f7fb'; ctx.lineWidth = 2;
  ctx.strokeRect(B.x0, B.y0, B.w, B.h);
  ctx.beginPath(); ctx.moveTo(B.x0, B.pz(0)); ctx.lineTo(B.x0 + B.w, B.pz(0)); ctx.stroke();
  ctx.beginPath(); ctx.arc(B.px(0), B.pz(0), CIRCLE_R * B.s, 0, TAU); ctx.stroke();
  for (const sg of [-1, 1]) {
    ctx.strokeRect(B.px(BOX_HW), sg > 0 ? B.pz(HL) : B.pz(-HL + BOX_D), BOX_HW * 2 * B.s, BOX_D * B.s);
    ctx.fillStyle = '#f6f7fb'; ctx.fillRect(B.px(GOAL_HW), sg > 0 ? B.pz(HL) - 6 : B.pz(-HL), GOAL_HW * 2 * B.s, 6);
    ctx.beginPath(); ctx.arc(B.px(0), B.pz(sg * (HL - SPOT)), 2.5, 0, TAU); ctx.fill();
  }
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
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(19,40,58,0.92)'; ctx.fill();
  ctx.clip();
  const B = pitchBox(x, y, w, h);
  const me = KIT[0].top, opp = KIT[1].top;
  const A = {
    pitch() { drawPitch(ctx, B); label(ctx, `${HW * 2} m`, B.px(0), B.y0 - 4 + 3, 14); label(ctx, `${HL * 2} m`, B.x0 + B.w + 28, B.pz(0) + 5, 14); },
    roles() {
      drawPitch(ctx, B);
      const pts = [['GK', 0, -17.6], ['D', 4.6, -11], ['D', -4.6, -11], ['M', 0, -3], ['W', 8.2, 3], ['W', -8.2, 3], ['S', 0, 9]];
      pts.forEach(([t, px, pz]) => { dot(ctx, B.px(px), B.pz(pz), me, 11); label(ctx, t, B.px(px), B.pz(pz) + 5, 12, '#fff'); });
      arrow(ctx, B.px(-HW + 1), B.pz(-6), B.px(-HW + 1), B.pz(8), '#ffe9a0', 3); label(ctx, 'you attack this way', B.px(-HW + 1) + 70, B.pz(1), 13, '#ffe9a0', 'left');
    },
    controls() {
      const cx = x + 100, cy = y + h / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 58, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,246,228,0.5)'; ctx.lineWidth = 3; ctx.stroke(); dot(ctx, cx + 14, cy - 12, '#fff6e4', 24); label(ctx, 'MOVE', cx, cy + 86, 18);
      const bs = [['A', 0, 0, 40, '#e2503c'], ['B', -98, 40, 32, '#1f9d8f'], ['C', -40, 86, 28, '#1f9d8f'], ['D', 52, 76, 26, '#1f9d8f']];
      const bx = x + w - 130, by = y + h / 2 - 20;
      bs.forEach(([t, dx, dy, r, col]) => { dot(ctx, bx + dx, by + dy, col, r); label(ctx, t, bx + dx, by + dy + 6, 18, '#fff'); });
      label(ctx, 'with the ball: shoot, pass, lob, through', x + w / 2, y + 30, 16); label(ctx, 'without: tackle, slide, call', x + w / 2, y + h - 14, 16);
    },
    keeper() {
      drawPitch(ctx, B); const gz = -HL + 1;
      dot(ctx, B.px(0), B.pz(gz + 0.4), me, 11); label(ctx, 'GK', B.px(0), B.pz(gz + 0.4) + 5, 12, '#fff');
      dot(ctx, B.px(1), B.pz(-8), '#fff', 7); dot(ctx, B.px(0.6), B.pz(-6), opp, 11);
      arrow(ctx, B.px(1), B.pz(-8), B.px(2.2), B.pz(-HL + 0.4), '#fff', 3); arrow(ctx, B.px(0), B.pz(gz + 0.4), B.px(2.4), B.pz(gz + 0.6), '#ffc94d', 4);
      label(ctx, 'swipe to dive', B.px(-3), B.pz(-14), 15, '#ffe9a0');
    },
    setpieces() {
      drawPitch(ctx, B);
      dot(ctx, B.px(0), B.pz(0), '#fff', 6); dot(ctx, B.px(HW), B.pz(6), '#fff', 6); arrow(ctx, B.px(HW), B.pz(6), B.px(HW - 5), B.pz(8), '#ffc94d', 3); label(ctx, 'throw-in', B.px(HW) + 8, B.pz(6) - 10, 13, '#fff', 'right');
      dot(ctx, B.px(-HW), B.pz(HL), '#fff', 6); arrow(ctx, B.px(-HW), B.pz(HL), B.px(-2), B.pz(HL - 4), '#ffc94d', 3); label(ctx, 'corner', B.px(-HW) + 10, B.pz(HL) + 22, 13, '#fff', 'left');
      dot(ctx, B.px(2), B.pz(-HL + 1.2), '#fff', 6); arrow(ctx, B.px(2), B.pz(-HL + 1.2), B.px(3), B.pz(-3), '#ffc94d', 3); label(ctx, 'goal kick', B.px(2) + 30, B.pz(-HL + 1.2) - 8, 13, '#fff', 'left');
    },
    penalty() {
      drawPitch(ctx, B); dot(ctx, B.px(0), B.pz(HL - SPOT), '#fff', 6); dot(ctx, B.px(0.5), B.pz(HL - SPOT - 1.2), me, 11); dot(ctx, B.px(0), B.pz(HL - 0.3), opp, 11);
      arrow(ctx, B.px(0.5), B.pz(HL - SPOT - 1.2), B.px(-1.8), B.pz(HL - 0.6), '#ffc94d', 3); label(ctx, `${SPOT} m`, B.px(-2.6), B.pz(HL - SPOT) + 4, 13, '#fff');
    },
    tackle() {
      const cx = x + w / 2, cy = y + h / 2;
      dot(ctx, cx - 60, cy, opp, 20); dot(ctx, cx - 20, cy, '#fff', 8); dot(ctx, cx + 90, cy, me, 20);
      arrow(ctx, cx + 62, cy, cx - 8, cy, '#ffc94d', 4); label(ctx, 'ball first: clean', cx + 20, cy - 36, 18, '#7fe8d6'); label(ctx, 'player first: foul', cx + 20, cy + 54, 18, '#ff9a86');
    },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffe9a0'], ['REVEAL', '#7fe8d6'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const cx = x + 10 + i * (cw + 10); roundPath(ctx, cx, y + 40, cw, h - 80, 14); ctx.fillStyle = 'rgba(255,246,228,0.1)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); label(ctx, nm, cx + cw / 2, y + h / 2 + 6, 24, col); }); },
    levels() { LEVELS.forEach((l, i) => { const bx = x + 40, by = y + 28 + i * 34; label(ctx, l.name, bx, by + 6, 17, '#fff6e4', 'left'); ctx.fillStyle = '#ffd54a'; roundPath(ctx, x + 250, by - 8, 40 + l.stars * 56, 16, 8); ctx.fill(); }); },
  };
  (A[key] ?? A.pitch)();
  ctx.restore();
}
