// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the paginated About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, drawScrollBar } from './ui.js';
import { LEVELS, ROLES } from './consts.js';
import { LESSONS, QUIZ } from './content.js';
import { ARC_R, ARC_X, HW, Z_BASE, Z_HALF, FT_Z, KEY_HW } from './consts.js';

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
    ctx.font = `700 38px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('HALF-COURT', cx, 110);
    ctx.font = `700 112px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Basketball', cx, 226);
    ctx.font = `800 130px ${FONT}`; ctx.fillStyle = '#ff9a5a'; ctx.fillText('3x3', cx, 352);
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sv = state.saved;
  return [
    heroArt(),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue game', sub: `${sv.roleName} · ${sv.score[0]}-${sv.score[1]} · ${sv.clockText}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a game', primary: !sv, h: 88 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Five practices and a quiz' },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two computer teams play and explain why' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

export function setupWidgets(state) {
  const s = state.setup, watch = s.watch;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: watch ? 'Watch & Learn' : 'New game', size: 48 }];
  if (!watch) {
    wd.push({ t: 'p', label: 'Your role', bold: true, color: '#ffe9a0', size: 26 });
    ROLES.forEach((r) => wd.push({ t: 'btn', id: `role${r.id}`, label: r.name, sub: s.role === r.id ? r.blurb : '', active: s.role === r.id, h: 84 }));
    wd.push({ t: 'btn', id: 'roletut', label: `Role tutorial: ${ROLES[s.role].name}`, dark: true, h: 76 });
  }
  wd.push({ t: 'p', label: watch ? 'Computer team levels' : 'Opponent', bold: true, color: '#ffe9a0', size: 26 });
  LEVELS.slice(1).forEach((l, i) => {
    const locked = state.demo && i > 1 && !watch;
    wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 80 });
  });
  if (!watch) {
    wd.push({ t: 'p', label: 'Game length', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'len-full', label: 'First to 21 or 10:00', row: 9, active: s.len === 'full' });
    wd.push({ t: 'btn', id: 'len-quick', label: 'Quick: to 11 or 5:00', row: 9, active: s.len === 'quick' });
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
    { t: 'btn', id: 'kit-next', label: `Your jersey: ${['Blue', 'Green', 'Purple', 'Orange'][st.kitIdx | 0]} (tap to change)` },
    { t: 'btn', id: 'court-next', label: `Court: ${['Maple', 'Blue floor', 'Street'][st.courtIdx | 0]} (tap to change)` },
    { t: 'p', label: 'The role, the opponent difficulty and the game length are chosen when a game starts.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const win = s.winner, mode = state.setup.lastMode;
  const youWin = s.humanId >= 0 && win === s.players[s.humanId].team;
  const title = mode === 'watch' ? `${win === 0 ? 'Blue' : 'Red'} win` : youWin ? 'You win!' : 'The other team wins';
  const wd = [{ t: 'gap', h: big ? 24 : 120 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${s.score[0]} – ${s.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  const t = s.humanId >= 0 ? s.players[s.humanId].team : 0, st = s.stats[t];
  wd.push({ t: 'p', label: `${s.humanId >= 0 ? 'Your team' : 'Blue'}: shots ${st.fgm} of ${st.fga}, beyond the arc ${st.tpm} of ${st.tpa}, rebounds ${st.reb}, steals ${st.stl}, blocks ${st.blk}, turnovers ${st.tov}.`, size: 26, cap: big ? 2 : 3 });
  if (s.ot) wd.push({ t: 'p', label: 'Decided in overtime.', size: 24 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New game', row: 6 });
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
    { t: 'btn', id: 'quit', label: state.mode === 'ai' ? 'Save and quit to menu' : 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free games of the web demo. The full game on iPhone and Android has every opponent level, the full game length, the Learn practices and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Five short practices on the real court and a quiz.', size: 26 },
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

// ---- reference pages: one continuous column that scrolls (drag, wheel, keys) with a visible scroll bar -------------------------
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
const READER = { x: PANEL.x + 12, y: PANEL.y + 96, w: PANEL.w - 24, h: PANEL.h - 96 - 20 };
let RMETA = { max: 0, view: READER.h, key: '', rect: READER };
export const readerMeta = () => RMETA;

function buildReader(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = READER.w - 56;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 14;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 4 }); y += 26; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, secFs }); y += tl.length * secFs * 1.2 + 16;
    const artH = sec.art && scale < 2 ? 210 : 0;
    if (artH) { items.push({ k: 'art', y, h: artH - 12, art: sec.art }); y += artH; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; });
    });
    y += 12;
  });
  return { items, h: y + 10, fs, lh };
}
const readerCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}`;
  let rd = readerCache.get(pkey);
  if (!rd) { rd = buildReader(ctx, list, sc); readerCache.set(pkey, rd); }
  const max = Math.max(0, rd.h - READER.h);
  if (state.ui.keepFrac != null) { state.ui.scroll = state.ui.keepFrac * max; state.ui.keepFrac = null; }
  const scroll = clamp(state.ui.scroll, 0, max); state.ui.scroll = scroll;
  RMETA = { max, view: READER.h, key: pkey, rect: READER };
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(READER.x, READER.y, READER.w, READER.h); ctx.clip();
  const x0 = READER.x + 28;
  for (const it of rd.items) {
    const y = READER.y + it.y - scroll;
    const hh = it.k === 'title' ? it.lines.length * it.secFs * 1.2 + 16 : it.k === 'art' ? it.h : rd.lh;
    if (y + hh < READER.y - 4 || y > READER.y + READER.h + 4) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.secFs}px ${FONT}`; it.lines.forEach((l, k) => ctx.fillText(l, READER.x + (READER.w - 14) / 2, y + it.secFs * (0.9 + k * 1.2))); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, it.h + 4); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, it.h); ctx.restore(); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${rd.fs}px ${FONT}`; ctx.fillText(it.text, x0, y + rd.fs * 0.85); }
  }
  ctx.restore();
  drawScrollBar(ctx, READER, scroll, max);
  if (max > 0 && scroll < max - 4) {
    const g = ctx.createLinearGradient(0, READER.y + READER.h - 60, 0, READER.y + READER.h); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)');
    ctx.fillStyle = g; ctx.fillRect(READER.x, READER.y + READER.h - 60, READER.w - 14, 60);
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(19,40,58,0.7)';
  ctx.fillText(max <= 0 ? 'Everything fits on this page' : scroll >= max - 4 ? 'End. Drag, swipe or use the arrow keys to scroll up.' : `Drag, swipe or use the arrow keys to scroll (${Math.round((scroll / max) * 100)}%)`, W / 2, PANEL.y + PANEL.h - 8 - 14);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, 'Close', { size: 32 });
  drawButton(ctx, REF_NEXT, max <= 0 || scroll >= max - 4 ? 'Done' : 'Page down', { primary: true, size: 32 });
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- diagrams: a top-down half court drawn with the game's own geometry -----------------------------------------------
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
function courtBox(x, y, w, h) {
  const cw = 2 * HW, ch = Z_HALF - Z_BASE, s = Math.min(w / cw, h / ch) * 0.96;
  const cx = x + w / 2, cy = y + h / 2;
  return { s, px: (px) => cx + px * s, pz: (pz) => cy + (pz - (Z_HALF + Z_BASE) / 2) * -s * -1 };
}
function drawCourt(ctx, B) {
  const x0 = B.px(-HW), x1 = B.px(HW), y0 = B.pz(Z_BASE), y1 = B.pz(Z_HALF);
  ctx.fillStyle = '#c99a62'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = '#3b72b8'; ctx.fillRect(B.px(-KEY_HW), y0, B.px(KEY_HW) - B.px(-KEY_HW), B.pz(FT_Z) - y0);
  ctx.strokeStyle = '#f7f7f4'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.beginPath();
  const zi = Math.sqrt(ARC_R * ARC_R - ARC_X * ARC_X);
  ctx.moveTo(B.px(-ARC_X), y0); ctx.lineTo(B.px(-ARC_X), B.pz(zi));
  const th0 = Math.atan2(zi, -ARC_X), th1 = Math.atan2(zi, ARC_X);
  for (let i = 0; i <= 50; i++) { const a = th0 + (th1 - th0) * (i / 50); ctx.lineTo(B.px(ARC_R * Math.cos(a)), B.pz(ARC_R * Math.sin(a))); }
  ctx.lineTo(B.px(ARC_X), y0); ctx.stroke();
  ctx.strokeStyle = '#ff6a1f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(B.px(0), B.pz(0), 0.23 * B.s, 0, TAU); ctx.stroke();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(19,40,58,0.92)'; ctx.fill();
  const B = courtBox(x, y, w, h);
  const A = {
    court() { drawCourt(ctx, B); label(ctx, '15 m', B.px(0), B.pz(Z_HALF) + 16, 16); label(ctx, '2 points', B.px(0), B.pz(8.6), 16, '#ffe9a0'); label(ctx, '1 point', B.px(0), B.pz(3.2), 16, '#ffe9a0'); label(ctx, 'hoop', B.px(0), B.pz(-0.55), 14); },
    meter() {
      const bw = w - 80, bx = x + 40, by = y + h / 2 - 12;
      roundPath(ctx, bx, by, bw, 24, 12); ctx.fillStyle = 'rgba(8,18,30,0.9)'; ctx.fill();
      roundPath(ctx, bx + bw * 0.55, by + 3, bw * 0.2, 18, 9); ctx.fillStyle = 'rgba(127,232,214,0.9)'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * 0.65 - 1.5, by, 3, 24);
      roundPath(ctx, bx + bw * 0.3, by - 5, 10, 34, 5); ctx.fillStyle = '#ffd54a'; ctx.fill();
      label(ctx, 'too early', bx + bw * 0.3, by + 56, 16); label(ctx, 'release here', bx + bw * 0.65, by + 56, 16, '#7fe8d6'); label(ctx, 'too late', bx + bw * 0.92, by + 56, 16);
    },
    screen() { drawCourt(ctx, B); dot(ctx, B.px(0), B.pz(7.6), '#37c'); dot(ctx, B.px(0), B.pz(6.3), '#e44'); dot(ctx, B.px(0.9), B.pz(6.3), '#37c', 11); arrow(ctx, B.px(0), B.pz(7.4), B.px(-2.4), B.pz(3.6), '#ffc94d', 4); arrow(ctx, B.px(0), B.pz(6.1), B.px(0.1), B.pz(4.2), '#ff9a86', 3); label(ctx, 'screen', B.px(2.2), B.pz(6.3) + 6, 16, '#ffe9a0'); },
  };
  (A[key] ?? A.court)();
  ctx.restore();
}
