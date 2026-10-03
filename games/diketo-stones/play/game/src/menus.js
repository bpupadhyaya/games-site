// Every screen that is not the play screen: title, setup, lessons, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own pebbles, yard and routes).
// Pure drawing; game.js owns state.
import { W, H, R, HOME, PIT, YARD_R, MODES } from './sim.js';
import { drawStone, drawGho, drawRoute, drawBadge, drawRing, drawHand, STONE_PAL } from './art.js';
import { drawAttract } from './view.js';
import { TEXT_SCALES, TEXT_DEC, TEXT_INC, CLOSE_BTN, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, TAGS } from './ai.js';
import { LESSONS, DEMO_LESSONS } from './lessons.js';
import { tx, lessonText, LESSON_TEXT } from './content.js';

const TAU = Math.PI * 2;
const tr = () => (k, v) => tx(k, v);

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
// A layout for the scene being updated right now, before anything has been drawn (first frame after a
// scene change, or headless runs): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay && LAID.zoom === state.settings.textIdx && LAID.sig === sigOf(state, key)) return;
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], lessons: [lessonsWidgets, 0, H],
    lessonintro: [introWidgets, 0, 1130], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH, zoom: state.settings.textIdx, sig: sigOf(state, key) };
}
// what a flow screen's widget list depends on besides the text size (so a changed list is laid out again)
const sigOf = (state, key) => (key === 'title' ? (state.saved ? 1 : 0) : key === 'setup' ? `${state.setup.opp}` : '');
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 400,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    const g = ctx.createLinearGradient(0, 70, 0, 200); g.addColorStop(0, '#fffdf2'); g.addColorStop(1, '#ffd77a');
    ctx.save(); ctx.shadowColor = 'rgba(30,12,4,0.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.fillStyle = g; ctx.font = `italic 700 150px ${DISPLAY}`; ctx.fillText('Diketo', cx, 190);
    ctx.restore();
    ctx.font = `700 62px ${DISPLAY}`;
    ctx.save(); ctx.shadowColor = 'rgba(30,12,4,0.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = '#ff8a5a';
    ctx.fillText('STONES', cx, 272); ctx.restore();
    ctx.font = `500 26px ${FONT}`; textShadow(ctx, 'Toss one, take the rest, catch it before it falls', cx, 318, '#fff6e4', 8);
    for (let i = 0; i < 5; i++) drawStone(ctx, { id: [1, 4, 0, 5, 2][i], x: cx + (i - 2) * 58, y: 362 - Math.abs(i - 2) * 4, rot: i * 0.8 });
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const T = tr(), sv = state.saved;
  return [
    { t: 'gap', h: 50 },
    heroArt(),
    ...(sv ? [{ t: 'btn', id: 'continue', label: T('m_continue'), sub: T('m_continueSub', { a: sv.label, b: sv.progress }), primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: T('m_play'), primary: !sv, h: 88 },
    { t: 'btn', id: 'learn', label: T('m_learn'), sub: T('m_learnSub') },
    { t: 'btn', id: 'watch', label: T('m_watch'), sub: T('m_watchSub') },
    { t: 'btn', id: 'howto', label: T('m_howto'), row: 2 },
    { t: 'btn', id: 'rules', label: T('m_rules'), row: 2 },
    { t: 'btn', id: 'about', label: T('m_about'), row: 2 },
    { t: 'btn', id: 'settings', label: T('m_settings') },
  ];
}

export function setupWidgets(state) {
  const T = tr(), s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: T('s_title'), size: 48 }];
  wd.push({ t: 'p', label: T('s_opp'), bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'opp-cpu', label: T('s_cpu'), row: 11, active: s.opp === 'cpu' });
  wd.push({ t: 'btn', id: 'opp-pass', label: T('s_pass'), row: 11, active: s.opp === 'pass' });
  if (s.opp === 'cpu') {
    wd.push({ t: 'p', label: T('s_level'), bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((lv, i) => {
      const locked = demo && i > 1;
      const won = (rec.wins ?? [])[i] ?? 0;
      wd.push({ t: 'btn', id: `lvl${i}`, label: lv.name, sub: locked ? T('inFull') : `${'\u2605'.repeat(lv.stars)}${'\u2606'.repeat(5 - lv.stars)}  ${TAGS[i]}${won ? ` \u00b7 ${T('s_won', { n: won })}` : ''}`, active: s.lvl === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: T('s_length'), bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'len-quick', label: T('s_quick'), active: s.len === 'quick' });
  wd.push({ t: 'btn', id: 'len-full', label: T('s_full'), active: s.len === 'full' });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function lessonsWidgets(state) {
  const T = tr(), done = state.record.lessons, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: T('l_title'), size: 48 }, { t: 'p', label: T('l_intro'), size: 24 }];
  LESSONS.forEach((les, i) => {
    const lt = lessonText(les.id);
    const locked = demo && i >= DEMO_LESSONS;
    wd.push({ t: 'btn', id: `les${i}`, label: `${i + 1}. ${lt.title}`, sub: locked ? T('inFull') : done[i] ? T('l_done') : lt.short, active: !!done[i] && !locked, disabled: locked, hitDisabled: true, h: 92 });
  });
  wd.push({ t: 'gap', h: 10 });
  wd.push({ t: 'btn', id: 'back', label: T('back'), primary: true, h: 84 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function introWidgets(state) {
  const T = tr(), les = LESSONS[state.lessonSel], lt = lessonText(les.id);
  const wd = [{ t: 'gap', h: 10 }, { t: 'p', label: T('lessonLabel', { n: state.lessonSel + 1 }), bold: true, color: '#ffe9a0', size: 24 }, { t: 'h', label: lt.title, size: 46 }];
  lt.body.forEach((p) => wd.push({ t: 'p', label: p, size: 27 }));
  wd.push({ t: 'p', label: T('l_goal'), bold: true, color: '#ffe9a0', size: 24 });
  wd.push({ t: 'p', label: lt.goal, size: 27 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const T = tr(), st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: T('m_settings'), size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? T('soundOn') : T('soundOff') },
    { t: 'btn', id: 'set-calm', label: st.calm ? T('calmOn') : T('calmOff'), sub: T('calmSub'), active: st.calm },
    { t: 'p', label: T('textSize', { n: Math.round(sc * 100) }), bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: T('smaller'), row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: T('larger'), row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: T('thinkTime', { n: THINK_STEPS[st.thinkIdx] }), bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: T('shorter'), row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: T('longer'), row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: T('restore'), dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: T('back'), primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, hp) {
  const T = tr(), m = state.match, o = m.over, mode = m.cfg.mode, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = hp && hp.nameOf ? hp.nameOf : () => '';
  const wd = [{ t: 'gap', h: big ? 24 : 150 }];
  if (o.lesson) {
    const lt = lessonText(LESSONS[m.cfg.lesson].id);
    wd.push({ t: 'h', label: T('l_complete'), size: 56, cap: big ? 1.15 : 1.4 });
    wd.push({ t: 'p', label: lt.title, size: 30, color: '#ffd97a', bold: true });
    wd.push({ t: 'p', label: lt.done, size: 26 });
    wd.push({ t: 'gap', h: 24 });
    if (m.cfg.lesson < LESSONS.length - 1) wd.push({ t: 'btn', id: 'next', label: T('l_next'), primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'again', label: T('l_again'), row: 6 });
    wd.push({ t: 'btn', id: 'new', label: T('l_all'), row: 6, dark: true });
    wd.push({ t: 'btn', id: 'menu', label: T('r_menu'), dark: true });
    wd.push({ t: 'gap', h: 30 });
    return wd;
  }
  const winner = o.win;
  const title = mode === 'watch' || mode === 'pass' ? T('r_wins', { name: nm(winner) }) : winner === 0 ? T('r_youWin') : T('r_wins', { name: nm(1) });
  wd.push({ t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 });
  const l1 = T('r_stats', { turns: m.turns, tosses: m.stats.tosses[0] + m.stats.tosses[1], faults: m.stats.faults[0] + m.stats.faults[1] });
  const l2 = mode === 'cpu' ? T('r_vs', { name: nm(1), n: (state.record?.wins ?? [])[m.cfg.lvl] ?? 0 }) : '';
  wd.push({ t: 'p', label: big ? `${l1} ${l2}` : l1, size: 26, cap: big ? 2 : 3 });
  if (!big && l2) wd.push({ t: 'p', label: l2, size: 26 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: T('r_again'), primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: T('r_new'), row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: T('r_menu'), row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const T = tr(), st = state.settings;
  return [
    { t: 'h', label: T('paused'), size: 52 },
    { t: 'btn', id: 'resume', label: T('resume'), primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: T('m_rules'), row: 7 },
    { t: 'btn', id: 'p-howto', label: T('m_howto'), row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? T('soundOnShort') : T('soundOffShort'), row: 8 },
    { t: 'btn', id: 'p-calm', label: st.calm ? T('calmOnShort') : T('calmOffShort'), row: 8, active: st.calm },
    { t: 'p', label: T('textSize', { n: Math.round(TEXT_SCALES[st.textIdx] * 100) }), bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: T('smaller'), row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: T('larger'), row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: T('quit'), dark: true },
  ];
}

export function demoLimitWidgets(state) {
  const T = tr();
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: T('d_title'), size: 48 },
    { t: 'p', label: T('d_body'), size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: T('r_menu'), primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(30,14,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(30,14,6,${a})`); g.addColorStop(1, `rgba(30,14,6,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W, state) {
  if (maxScroll <= 0) return;
  const T = tr(), cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(30,14,6,0)'); g.addColorStop(1, 'rgba(30,14,6,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 54, bottom - 40, 108, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`▼ ${T('more')}`, cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 54, top + 8, 108, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`▲ ${T('up')}`, cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, lay, top, bottom, h: lay.contentH, zoom: state.settings.textIdx };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, 0, W, state);
  }
  return { scroll, maxScroll, lay };
}

const bg = (ctx, state) => drawAttract(ctx, state);

export function renderTitle(ctx, state) {
  bg(ctx, state);
  scrim(ctx, 0.5);
  const g = ctx.createRadialGradient(W / 2, 250, 40, W / 2, 250, 460);
  g.addColorStop(0, 'rgba(30,14,6,0.5)'); g.addColorStop(1, 'rgba(30,14,6,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 720);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  bg(ctx, state); scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  pinned(ctx, state, tr()('s_start'));
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
function pinned(ctx, state, startLabel) {
  const T = tr();
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(30,14,6,0)'); g.addColorStop(0.2, 'rgba(30,14,6,0.88)'); g.addColorStop(1, 'rgba(30,14,6,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, startLabel, { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, T('back'), { dark: true, size: 28 });
}
export function renderLessons(ctx, state) { bg(ctx, state); scrim(ctx, 0.8); drawFlowScreen(ctx, state, 'lessons', lessonsWidgets(state), 0, H); toastDraw(ctx, state); }
export function renderLessonIntro(ctx, state) { bg(ctx, state); scrim(ctx, 0.84); drawFlowScreen(ctx, state, 'lessonintro', introWidgets(state), 0, 1130); pinned(ctx, state, tr()('l_start')); }
export function renderSettings(ctx, state) { bg(ctx, state); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderResult(ctx, state, hp) {
  bg(ctx, state); scrim(ctx, 0.8);
  drawFlowScreen(ctx, state, 'result', resultWidgets(state, hp), 0, H);
}
export function renderDemoLimit(ctx, state) { bg(ctx, state); scrim(ctx, 0.7); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state), 0, H); }
function toastDraw(ctx, state) {
  if (state.toastT > 0 && state.toast) {
    ctx.save(); ctx.font = `700 24px ${FONT}`; const w = ctx.measureText(state.toast).width + 40;
    roundPath(ctx, W / 2 - w / 2, 1180, w, 54, 27); ctx.fillStyle = 'rgba(255,246,228,0.95)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.toast, W / 2, 1207); ctx.restore();
  }
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(48,28,16,0.95)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH, zoom: state.settings.textIdx };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660, state);
}

// ---- reference pages: one continuous page that scrolls (drag, keys) with a scroll bar ----------------------------------
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
const R_TOP = PANEL.y + 96, R_BOTTOM = PANEL.y + PANEL.h - 18;
let READER = { lay: null, max: 0, key: '' };
export const readerMax = () => READER.max;
export const readerPage = () => R_BOTTOM - R_TOP;

function readerWidgets(list, scale) {
  const wd = [];
  list.forEach((sec, i) => {
    if (i > 0) wd.push({ t: 'gap', h: 16 });
    wd.push({ t: 'h', label: sec.title, size: 34, cap: 1.3, color: C.indigo, flat: true });
    if (sec.art && scale < 2) wd.push({ t: 'art', h: 210, draw(ctx, w, h) { drawArt(sec.art, ctx, 0, 0, w, h - 12); } });
    sec.p.forEach((para) => wd.push({ t: 'p', label: para, size: 28, color: C.ink, align: 'left', flat: true, cap: 3 }));
  });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
const readerCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, state);
  scrim(ctx, 0.66);
  const T = tr();
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let lay = readerCache.get(pkey);
  if (!lay) { lay = flowLayout(ctx, readerWidgets(list, sc), sc, { x: 40, w: PANEL.w - 80 }); readerCache.set(pkey, lay); }
  const max = Math.max(0, lay.contentH - (R_BOTTOM - R_TOP));
  READER = { lay, max, key: pkey };
  const scroll = Math.min(Math.max(0, state.ui.scroll), max);
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(43,26,16,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(43,26,16,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.translate(PANEL.x, 0); drawFlow(ctx, lay, R_TOP, R_BOTTOM, scroll); ctx.restore();
  if (max > 0) {
    const th = Math.max(60, (R_BOTTOM - R_TOP) * ((R_BOTTOM - R_TOP) / lay.contentH)), ty = R_TOP + (scroll / max) * (R_BOTTOM - R_TOP - th);
    roundPath(ctx, PANEL.x + PANEL.w - 16, R_TOP, 8, R_BOTTOM - R_TOP, 4); ctx.fillStyle = 'rgba(43,26,16,0.12)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 16, ty, 8, th, 4); ctx.fillStyle = 'rgba(168,48,31,0.75)'; ctx.fill();
    if (scroll < max - 4) { roundPath(ctx, W / 2 - 60, R_BOTTOM - 38, 120, 32, 16); ctx.fillStyle = 'rgba(43,26,16,0.85)'; ctx.fill(); ctx.fillStyle = '#fff6e4'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`\u25bc ${T('more')}`, W / 2, R_BOTTOM - 22); }
    else { roundPath(ctx, W / 2 - 60, R_TOP + 4, 120, 32, 16); ctx.fillStyle = 'rgba(43,26,16,0.85)'; ctx.fill(); ctx.fillStyle = '#fff6e4'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`\u25b2 ${T('up')}`, W / 2, R_TOP + 20); }
  }
  drawButton(ctx, TEXT_DEC, 'A\u2212', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, CLOSE_BTN, T('close'), { primary: true, size: 32 });
}

// ---- illustrations: the game's own pebbles, yard and routes ---------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff6e4', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y); ctx.restore();
}
function miniYard(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c98e55'); g.addColorStop(1, '#a96e3b');
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  ctx.strokeStyle = 'rgba(252,246,230,0.65)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h * 0.46, h * 0.52, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(43,26,16,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function miniPit(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx + 6, cy + 8, 4, cx, cy, r); g.addColorStop(0, '#6a3d20'); g.addColorStop(1, '#3d200e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,228,184,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0.1, 1.5); ctx.stroke();
}
const stoneAt = (ctx, id, x, y, s = 0.7, o = {}) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawStone(ctx, { id, x: 0, y: 0, rot: id }, o); ctx.restore(); };
function drawHandMini(ctx, x, y) { drawHand(ctx, x, y, { r: 20 }); }

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    yard() {
      miniYard(ctx, w, h);
      const cx = w * 0.5, cy = h * 0.4;
      miniPit(ctx, cx, cy, 44);
      [[0, 0], [24, 8], [-22, 12], [6, -24], [-10, 28], [30, -14]].forEach(([dx, dy], i) => stoneAt(ctx, i, cx + dx, cy + dy, 0.5, { inPit: true }));
      stoneAt(ctx, 6, w * 0.16, h * 0.28, 0.5); stoneAt(ctx, 7, w * 0.84, h * 0.5, 0.5);
      drawHandMini(ctx, w * 0.5, h - 30);
      label(ctx, 'hole, stones and your hand', w / 2, 26, 19, '#fff6e4');
    },
    gauge() {
      miniYard(ctx, w, h);
      const gx = 40, gw = w - 80, gy = h * 0.52;
      roundPath(ctx, gx, gy, gw, 24, 12); ctx.fillStyle = 'rgba(20,10,4,0.6)'; ctx.fill();
      roundPath(ctx, gx, gy, gw * 0.62, 24, 12); ctx.fillStyle = '#ffd45e'; ctx.fill();
      ctx.fillStyle = '#ff8a70'; ctx.fillRect(gx + gw * 0.38 - 2, gy - 8, 4, 40); ctx.fillStyle = '#7fe8d6'; ctx.fillRect(gx + gw * 0.52 - 2, gy - 8, 4, 40);
      label(ctx, 'min', gx + gw * 0.38, gy - 16, 17, '#ffd0c4'); label(ctx, 'safe', gx + gw * 0.58, gy - 16, 17, '#bff7ec');
      label(ctx, 'Hold to set the toss height', w / 2, h - 18, 20);
    },
    take() {
      miniYard(ctx, w, h);
      const home = [w * 0.5, h - 34], a = [w * 0.28, h * 0.4], b = [w * 0.72, h * 0.34];
      ctx.save(); drawRoute(ctx, [{ x: home[0], y: home[1] }, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }, { x: home[0], y: home[1] }], { alpha: 0.3 }); ctx.restore();
      stoneAt(ctx, 1, a[0], a[1], 0.62); stoneAt(ctx, 3, b[0], b[1], 0.62); stoneAt(ctx, 4, w * 0.5, h * 0.62, 0.62);
      drawBadge(ctx, a[0] + 20, a[1] - 20, '1', { r: 13 }); drawBadge(ctx, b[0] + 20, b[1] - 20, '2', { r: 13 });
      drawHandMini(ctx, home[0], home[1]);
      label(ctx, 'Tap 1, then 2: the hand follows', w / 2, 26, 20);
    },
    ring() {
      miniYard(ctx, w, h);
      const cx = w * 0.5, cy = h * 0.6;
      ctx.strokeStyle = 'rgba(255,246,228,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 60, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,224,120,0.98)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 36, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(cx + 40, cy - 70); ctx.scale(0.8, 0.8); drawGho(ctx, 0, 0, 0, {}); ctx.restore();
      drawHandMini(ctx, cx, cy);
      label(ctx, 'Tap CATCH as the ring closes', w / 2, 26, 20);
    },
    fault() {
      miniYard(ctx, w, h);
      const cx = w * 0.5, cy = h * 0.55;
      ctx.strokeStyle = '#ff7a62'; ctx.lineWidth = 4; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(cx, cy, 40, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      drawGho(ctx, cx + 30, cy + 20, 0, {});
      drawHandMini(ctx, cx - 70, cy + 30);
      label(ctx, 'Hand too slow: the stone lands first', w / 2, 26, 20, '#ffd0c4');
    },
  };
  (A[key] ?? A.yard)();
  ctx.restore();
}
void R; void HOME; void PIT; void YARD_R; void MODES; void drawRing; void STONE_PAL; void LESSON_TEXT;
