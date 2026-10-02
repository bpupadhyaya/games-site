// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the paginated About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS } from './consts.js';
import { LESSONS, QUIZ } from './content.js';

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

const heroArt = () => ({
  t: 'art', h: 400,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 40px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('KICK VOLLEYBALL', cx, 118);
    ctx.font = `700 118px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Sepak', cx, 236); ctx.fillText('Takraw', cx, 346);
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sv = state.saved;
  return [
    heroArt(),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.oppName} · Set ${sv.setNo} · ${sv.pts[0]}-${sv.pts[1]}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: 88 },
    { t: 'btn', id: 'quick', label: 'Quick match', sub: 'One short set', row: 1 },
    { t: 'btn', id: 'pass', label: 'Pass and play', sub: 'Two players', row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Six short lessons' },
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
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.pass ? 'Pass and play' : s.watch ? 'Watch & Learn' : 'New match', size: 48 }];
  if (!s.pass) {
    wd.push({ t: 'p', label: s.watch ? 'Choose the two teams' : 'Choose your rival', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1 && !s.watch;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 84 });
    });
  }
  if (s.watch) { wd.push({ t: 'p', label: 'Team on the left side of the screen', bold: true, color: '#ffe9a0', size: 24 }); LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 })); }
  if (!s.watch) {
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'len-full', label: 'Best of 3 sets to 21', row: 9, active: s.mode === 'full' });
    wd.push({ t: 'btn', id: 'len-quick', label: 'Quick: one set to 11', row: 9, active: s.mode === 'quick' });
  }
  wd.push({ t: 'p', label: 'Event', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'ev-m', label: 'Men, net 1.52 m', row: 10, active: !state.settings.women });
  wd.push({ t: 'btn', id: 'ev-f', label: 'Women, net 1.42 m', row: 10, active: state.settings.women });
  wd.push({ t: 'p', label: 'Venue', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'ven-hall', label: 'Indoor hall', row: 11, active: state.settings.venue === 'hall' });
  wd.push({ t: 'btn', id: 'ven-beach', label: 'Beach court', row: 11, active: state.settings.venue === 'beach' });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const dm = { slow: 'Slow motion', wait: 'Wait for me', fast: 'Fast' };
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `When you choose: ${dm[st.decision]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'dm-slow', label: 'Slow motion', row: 12, active: st.decision === 'slow' },
    { t: 'btn', id: 'dm-wait', label: 'Wait for me', row: 12, active: st.decision === 'wait' },
    { t: 'btn', id: 'dm-fast', label: 'Fast', row: 12, active: st.decision === 'fast' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Event and venue are chosen when a match starts.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.sim.match, st = state.sim.teams;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const win = m.winner;
  const mode = state.setup.lastMode;
  const youWin = win === 0 && st[0].human;
  const title = mode === 'watch' ? `${st[win].name} win` : st[1].human ? `${win === 0 ? 'Player 1' : 'Player 2'} wins` : youWin ? 'You win the match!' : `${st[win].name} win`;
  const wd = [{ t: 'gap', h: big ? 24 : 150 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${m.sets[0]} – ${m.sets[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  const ss = m.history.length;
  const l1 = `Rallies: ${ss}. Your aces ${m.stats[0].aces}, spike points ${m.stats[0].kills}, blocks ${m.stats[0].blocks}, errors ${m.stats[0].errors}.`;
  wd.push({ t: 'p', label: l1, size: 26, cap: big ? 2 : 3 });
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
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, the full match length, Learn lessons and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Six short lessons. Each one is a practice you play on the real court.', size: 26 },
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
}

// ---- reference pages --------------------------------------------------------------------------
let PAGE_COUNT = 1;
export const pageCount = () => PAGE_COUNT;
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.y + 120, limit = PANEL.y + PANEL.h - 70;
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art && scale < 2 ? 210 : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    const minNeed = titleH + artH + 26 + lh * 3;
    if (!cur || (used + full > limit - top && used + minNeed > limit - top)) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 && artH > 0 ? sec.art : null, artH: part === 0 ? artH : 0, lines: [], part };
      let h = titleH + blk.artH + 26;
      while (i < lines.length) {
        const add = lineH(lines[i], blk.lines.length);
        if (used + h + add > limit - top && (blk.lines.length > 0 || used > 0)) break;
        blk.lines.push({ ...lines[i] }); h += add; i++;
      }
      cur.blocks.push(blk); used += h;
      part++;
      if (i >= lines.length) break;
      newPage();
    }
  });
  return pages;
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += pg.lh * 0.45; ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85); y += pg.lh; });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(19,40,58,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}
export function pageCountFor(list, header, scale, ctx) { return buildPages(ctx, list, scale).length; }

// ---- diagrams: a top-down court drawn with the game's own geometry ---------------------------------
function courtBox(ctx, x, y, w, h) {
  const cw = Math.min(w * 0.46, h * 0.5), ch = cw * 13.4 / 6.1 > h ? h : cw * 13.4 / 6.1;
  const cwd = ch * 6.1 / 13.4;
  const cx = x + w / 2, cy = y + h / 2;
  return { x0: cx - cwd / 2, y0: cy - ch / 2, w: cwd, h: ch, s: ch / 13.4, px: (px) => cx + px * (ch / 13.4), pz: (pz) => cy + pz * (ch / 13.4) };
}
function drawCourt(ctx, B, opts = {}) {
  roundPath(ctx, B.x0, B.y0, B.w, B.h, 6); ctx.fillStyle = '#2f7a9e'; ctx.fill();
  ctx.strokeStyle = '#f6f7fb'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(B.x0 - 6, B.y0 + B.h / 2); ctx.lineTo(B.x0 + B.w + 6, B.y0 + B.h / 2); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(B.px(0), B.pz(sgn * 4.25), 0.3 * B.s * 2.2, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = '#f6f7fb'; ctx.stroke(); }
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
  const B = courtBox(ctx, x, y, w, h);
  const A = {
    court() { drawCourt(ctx, B); label(ctx, 'net', B.x0 + B.w + 26, B.pz(0) + 6, 16); label(ctx, '6.1 m', B.px(0), B.y0 - 4, 16); for (const [px, pz, c] of [[0, -4.25, '#e44'], [-2.3, -2.2, '#e44'], [2.3, -2.2, '#e44'], [0, 4.25, '#37c'], [-2.3, 2.2, '#37c'], [2.3, 2.2, '#37c']]) dot(ctx, B.px(px), B.pz(pz), c); },
    serve() { drawCourt(ctx, B); dot(ctx, B.px(0), B.pz(-4.25), '#e44'); dot(ctx, B.px(2.6), B.pz(-0.7), '#e44'); arrow(ctx, B.px(2.4), B.pz(-0.8), B.px(0.2), B.pz(-4.0), '#fff', 3); arrow(ctx, B.px(0), B.pz(-4.25), B.px(-1.8), B.pz(5.4), '#ffc94d', 5); dot(ctx, B.px(-1.8), B.pz(5.4), '#ffc94d', 6); },
    receive() { drawCourt(ctx, B); dot(ctx, B.px(0), B.pz(-4.5), '#e44'); dot(ctx, B.px(-1.6), B.pz(-2.0), '#e44'); dot(ctx, B.px(1.6), B.pz(-1.6), '#e44'); arrow(ctx, B.px(0.4), B.pz(-4.2), B.px(-1.3), B.pz(-2.2), '#fff', 3); arrow(ctx, B.px(-1.5), B.pz(-2.2), B.px(1.5), B.pz(-1.0), '#fff', 3); arrow(ctx, B.px(1.6), B.pz(-1.8), B.px(0.5), B.pz(3.6), '#ffc94d', 5); label(ctx, '1', B.px(0), B.pz(-4.9), 16); label(ctx, '2', B.px(-2.3), B.pz(-2.0), 16); label(ctx, '3', B.px(2.3), B.pz(-1.4), 16); },
    set() { drawCourt(ctx, B); dot(ctx, B.px(-1, ), B.pz(-2.3), '#e44'); for (const lat of [-2, 0, 2]) { dot(ctx, B.px(lat), B.pz(-0.95), 'rgba(255,201,77,0.9)', 7); } arrow(ctx, B.px(-1), B.pz(-2.3), B.px(1.9), B.pz(-1.1), '#fff', 3); label(ctx, 'left', B.px(2), B.pz(-0.2), 15); label(ctx, 'middle', B.px(0), B.pz(-0.2), 15); label(ctx, 'right', B.px(-2), B.pz(-0.2), 15); dot(ctx, B.px(-1.0), B.pz(1.0), '#37c'); dot(ctx, B.px(1.4), B.pz(1.0), '#37c'); },
    attack() { drawCourt(ctx, B); dot(ctx, B.px(1.8), B.pz(-1.1), '#e44'); dot(ctx, B.px(1.4), B.pz(0.8), '#37c'); dot(ctx, B.px(-1.0), B.pz(2.6), '#37c'); dot(ctx, B.px(0), B.pz(4.6), '#37c'); arrow(ctx, B.px(1.8), B.pz(-1.1), B.px(-2.0), B.pz(5.4), '#ffc94d', 5); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(B.px(-2.0), B.pz(5.4), 12, 0, TAU); ctx.stroke(); label(ctx, 'open corner', B.px(-2.0) + 20, B.pz(5.4) + 22, 15, '#ffe9a0', 'left'); },
    block() { drawCourt(ctx, B); dot(ctx, B.px(1.2), B.pz(0.7), '#37c'); dot(ctx, B.px(-0.4), B.pz(0.7), '#37c'); dot(ctx, B.px(0), B.pz(4.6), '#37c'); dot(ctx, B.px(0.4), B.pz(-1.0), '#e44'); arrow(ctx, B.px(0.4), B.pz(-1.1), B.px(0.7), B.pz(0.5), '#ffc94d', 4); label(ctx, 'double block', B.px(1.0), B.pz(1.6), 15, '#ffe9a0'); },
    spikes() {
      const cw = (w - 40) / 3;
      [['Roll', 0], ['Sunback', 1], ['Scissor', 2]].forEach(([nm, i]) => {
        const cx = x + 20 + i * cw + cw / 2, cy = y + h / 2 + 4;
        ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); // stick figure body angle per attack
        const a = [2.2, -1.1, 0.5][i];
        const bx = cx - Math.cos(a) * 40, by = cy + Math.sin(a) * 40;
        ctx.moveTo(bx, by); ctx.lineTo(cx + Math.cos(a) * 40, cy - Math.sin(a) * 40); ctx.stroke();
        dot(ctx, cx + Math.cos(a) * 52, cy - Math.sin(a) * 52, '#fff6e4', 9);
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 40, cy + Math.sin(a) * 40); ctx.lineTo(cx - Math.cos(a + 1.0) * 80, cy + Math.sin(a + 1.0) * 80); ctx.stroke();
        label(ctx, nm, cx, y + h - 12, 20);
      });
    },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffe9a0'], ['REVEAL', '#7fe8d6'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const cx = x + 10 + i * (cw + 10); roundPath(ctx, cx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, cx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.court)();
  ctx.restore();
}
