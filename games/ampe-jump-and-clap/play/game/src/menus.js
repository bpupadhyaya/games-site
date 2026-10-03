// Every screen that is not the play screen. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, TEMPOS, TARGETS, TEXT_SCALES, THINK_STEPS } from './consts.js';
import { LESSONS } from './content.js';

let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = { title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H], learn: [learnWidgets, 0, H], lesson: [lessonWidgets, 0, H], lessonresult: [lessonResultWidgets, 0, H], pause: [pauseWidgets, 70, H - 70] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx], key === 'pause' ? { x: 60, w: 600 } : undefined);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function invalidate() { LAID = { key: '', lay: null, top: 0, bottom: H }; }
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 290,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.shadowColor = 'rgba(40,16,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('THE GHANAIAN JUMP-AND-CLAP GAME', cx, 50);
    ctx.font = `700 132px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Ampe', cx, 186);
    ctx.font = `400 28px ${FONT}`; ctx.shadowBlur = 6; ctx.fillStyle = '#fff1d2';
    ctx.fillText('Clap. Jump. Throw a foot.', cx, 236);
    ctx.restore();
  },
});

// The two players stay visible in the middle of the title screen (the 3D camera is set for it); the buttons sit below them.
export function titleWidgets(state) {
  const sv = state.saved, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    heroArt(),
    { t: 'gap', h: big ? 10 : 372 },
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.name} · ${sv.score[0]}-${sv.score[1]} · first to ${sv.target}`, primary: true, h: 84 }] : []),
    { t: 'btn', id: 'play', label: 'Play vs computer', primary: !sv, h: 84 },
    { t: 'btn', id: 'learn', label: 'Learn', row: 1, h: 72 },
    { t: 'btn', id: 'practice', label: 'Practice', row: 1, h: 72 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1, h: 72 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2, h: 72 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2, h: 72 },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: 72 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3, h: 72 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3, h: 72 },
  ];
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, watch = s.watch;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: watch ? 'Watch & Learn' : 'New game', size: 48 }];
  wd.push({ t: 'p', label: watch ? 'Choose the two computers' : 'Choose your opponent', bold: true, color: '#ffe9a0', size: 26 });
  if (watch) {
    wd.push({ t: 'p', label: 'Gold player (right side of the screen)', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: `${l.id}`, active: s.watchA === i + 1, row: 20, h: 70 }));
    wd.push({ t: 'p', label: 'Teal player (left side of the screen)', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `opp${i + 1}`, label: `${l.id}`, active: s.level === i + 1, row: 21, h: 70 }));
  } else {
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: `${l.id}. ${l.name}`, sub: locked ? 'In the full game' : l.blurb, stars: l.stars, active: s.level === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 96 });
    });
  }
  wd.push({ t: 'p', label: 'Tempo', bold: true, color: '#ffe9a0', size: 26 });
  const tempos = TEMPOS.filter((t) => t.id !== 'practice');
  tempos.forEach((t, i) => wd.push({ t: 'btn', id: `tp-${t.id}`, label: t.id === 'rising' ? 'Rising' : `${t.name} ${t.bpm}`, active: s.tempo === t.id, row: 30 + Math.floor(i / 3), h: 70 }));
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
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 12 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 12 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
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

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(30,14,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(30,14,4,${a})`); g.addColorStop(1, `rgba(30,14,4,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
  const lay = flowLayout(ctx, widgets, sc);
  // when the content is longer than the screen, the last 46 px are kept free for the "more" chip so it never covers a label
  const over = lay.contentH > bottom - top, vb = over ? bottom - 46 : bottom;
  LAID = { key, lay, top, bottom: vb, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (vb - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, vb, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (vb - top) * ((vb - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (vb - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(0, 0, W, H); scrim(ctx, a * 0.7); };

export function renderTitle(ctx, state) {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(30,14,4,0.25)'); g.addColorStop(0.3, 'rgba(30,14,4,0.0)'); g.addColorStop(0.55, 'rgba(30,14,4,0.1)'); g.addColorStop(1, 'rgba(30,14,4,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(30,14,4,0)'); g.addColorStop(0.2, 'rgba(30,14,4,0.88)'); g.addColorStop(1, 'rgba(30,14,4,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, state.setup.watch ? 'Watch' : 'Start', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); };
export const renderResult = (ctx, state) => { ctx.clearRect(0, 0, W, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lesson', lessonWidgets(state), 0, H); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult', lessonResultWidgets(state), 0, H); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const strip = lay.contentH + 20 > bottom - top ? 46 : 0, vh = ch - strip;
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(56,30,12,0.95)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + vh, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - vh);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + vh, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}

// ---- reference pages (Rules, About, How to Play): one scrolling document in a panel ---------------------------------------------
// The text is laid out once per text size as a single tall column. Drag, mouse wheel, arrow / page keys or the Next / Back buttons
// move it; a scroll bar on the right shows where you are, so any text size from 100% to 300% can be read to its last line.
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
const VIEW = { top: PANEL.y + 96, bottom: PANEL.y + PANEL.h - 58 };
let DOC = { total: 0, view: VIEW.bottom - VIEW.top };
export const docInfo = () => ({ max: Math.max(0, DOC.total - DOC.view), view: DOC.view, total: DOC.total });
export const pageCount = () => Math.max(1, Math.ceil(DOC.total / DOC.view - 0.001));

function buildDoc(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 96;
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
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}:${list.map((x) => x.p.length).join('')}`;
  let doc = docCache.get(pkey);
  if (!doc) { doc = buildDoc(ctx, list, sc); docCache.set(pkey, doc); }
  DOC = { total: doc.total, view: VIEW.bottom - VIEW.top };
  const maxS = Math.max(0, doc.total - DOC.view);
  const scroll = Math.max(0, Math.min(state.ui.scroll, maxS));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(60,32,14,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
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
    blk.tl.forEach((l, k) => ctx.fillText(l, W / 2, y + doc.secFs * (0.9 + k * 1.2)));
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
  const pg = scroll >= maxS - 2 ? pageCount() : Math.min(pageCount(), Math.floor(scroll / DOC.view + 0.5) + 1);
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(60,32,14,0.7)'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(maxS > 0 ? `Page ${pg} of ${pageCount()}${scroll < maxS - 2 ? '  ·  drag or scroll for more' : '  ·  end'}` : 'Page 1 of 1', W / 2, PANEL.y + PANEL.h - 22);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, scroll < 2 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, scroll >= maxS - 2 ? 'Done' : 'Next', { primary: true, size: 32 });
}
