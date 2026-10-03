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
  t: 'art', h: 330,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.shadowColor = 'rgba(40,16,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('THE GHANAIAN JUMP-AND-CLAP GAME', cx, 70);
    ctx.font = `700 150px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Ampe', cx, 230);
    ctx.font = `400 26px ${FONT}`; ctx.shadowBlur = 6; ctx.fillStyle = '#fff1d2';
    ctx.fillText('Clap. Jump. Throw a foot.', cx, 290);
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sv = state.saved;
  return [
    heroArt(),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.name} · ${sv.score[0]}-${sv.score[1]} · first to ${sv.target}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play vs computer', primary: !sv, h: 88 },
    { t: 'btn', id: 'learn', label: 'Learn', sub: 'Six short lessons', row: 1 },
    { t: 'btn', id: 'practice', label: 'Practice', sub: 'Slow, no score', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two computers play and explain' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
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
const bg = (ctx, a) => { ctx.clearRect(0, 0, W, H); scrim(ctx, a * 0.7); };

export function renderTitle(ctx, state) {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(30,14,4,0.0)'); g.addColorStop(0.4, 'rgba(30,14,4,0.15)'); g.addColorStop(1, 'rgba(30,14,4,0.45)');
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
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(56,30,12,0.95)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}

// ---- reference pages (Rules, About, How to Play) ----------------------------------------------------------------
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
    let full = titleH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    const minNeed = titleH + 26 + lh * 3;
    if (!cur || (used + full > limit - top && used + minNeed > limit - top)) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, lines: [], part };
      let h = titleH + 26;
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
  const pkey = `${header}:${sc}:${list.length}:${list.map((x) => x.p.length).join('')}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(60,32,14,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,32,14,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(60,32,14,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += pg.lh * 0.45; ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85); y += pg.lh; });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(60,32,14,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}
