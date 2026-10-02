// Every screen that is not the play screen: title, setup, lessons, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own pebbles, mat and routes).
// Pure drawing; game.js owns state.
import { W, H, R, HOME, clusterAt } from './sim.js';
import { drawStone, drawRoute, drawBadge, drawRing, drawHand, STONE_PAL } from './art.js';
import { drawAttract } from './view.js';
import { TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, TAGS } from './ai.js';
import { LESSONS, DEMO_LESSONS } from './lessons.js';
import { tx, lessonText, stageName } from './content.js';

const TAU = Math.PI * 2;
const tr = (state) => (k, v) => tx(state.settings.lang, k, v);

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
// A layout for the scene being updated right now, before anything has been drawn (first frame after a
// scene change, or headless runs): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay && LAID.lang === state.settings.lang && LAID.zoom === state.settings.textIdx) return;
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], lessons: [lessonsWidgets, 0, H],
    lessonintro: [introWidgets, 0, 1130], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH, lang: state.settings.lang, zoom: state.settings.textIdx };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = (state) => ({
  t: 'art', h: 400,
  draw(ctx, w) {
    const ko = state.settings.lang === 'ko';
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    const g = ctx.createLinearGradient(0, 70, 0, 200); g.addColorStop(0, '#fffdf2'); g.addColorStop(1, '#ffd77a');
    ctx.save(); ctx.shadowColor = 'rgba(10,6,30,0.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.fillStyle = g;
    if (ko) { ctx.font = `700 150px ${FONT}`; ctx.fillText('공기놀이', cx, 190); } else { ctx.font = `italic 700 150px ${DISPLAY}`; ctx.fillText('Gonggi', cx, 190); }
    ctx.restore();
    ctx.font = `700 ${ko ? 54 : 62}px ${ko ? FONT : DISPLAY}`;
    ctx.save(); ctx.shadowColor = 'rgba(10,6,30,0.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = '#ff7a5a';
    ctx.fillText(ko ? '다섯 개의 돌' : 'FIVE STONES', cx, 272); ctx.restore();
    ctx.font = `500 26px ${FONT}`; textShadow(ctx, state.settings.lang === 'ko' ? '던지고, 줍고, 받아내는 우리의 놀이' : 'Toss one, take the rest, catch it before it falls', cx, 318, '#fff6e4', 8);
    for (let i = 0; i < 5; i++) drawStone(ctx, { id: i, x: cx + (i - 2) * 58, y: 362 - Math.abs(i - 2) * 4, rot: i * 0.8 });
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const T = tr(state), sv = state.saved, lang = state.settings.lang;
  return [
    { t: 'gap', h: 50 },
    heroArt(state),
    ...(sv ? [{ t: 'btn', id: 'continue', label: T('m_continue'), sub: T('m_continueSub', { a: sv.scores[0], b: sv.scores[1], stage: sv.stage }), primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: T('m_play'), primary: !sv, h: 88 },
    { t: 'btn', id: 'learn', label: T('m_learn'), sub: T('m_learnSub') },
    { t: 'btn', id: 'watch', label: T('m_watch'), sub: T('m_watchSub') },
    { t: 'btn', id: 'howto', label: T('m_howto'), row: 2 },
    { t: 'btn', id: 'rules', label: T('m_rules'), row: 2 },
    { t: 'btn', id: 'about', label: T('m_about'), row: 2 },
    { t: 'btn', id: 'settings', label: T('m_settings') },
    { t: 'btn', id: 'lang:en', label: 'Play in English', row: 3, active: lang === 'en' },
    { t: 'btn', id: 'lang:ko', label: '한국어로 플레이', row: 3, active: lang === 'ko' },
  ];
}

export function setupWidgets(state) {
  const T = tr(state), s = state.setup, demo = state.demo, rec = state.record ?? {}, lang = state.settings.lang;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: T('s_title'), size: 48 }];
  wd.push({ t: 'p', label: T('s_opp'), bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'opp-cpu', label: T('s_cpu'), row: 11, active: s.opp === 'cpu' });
  wd.push({ t: 'btn', id: 'opp-pass', label: T('s_pass'), row: 11, active: s.opp === 'pass' });
  if (s.opp === 'cpu') {
    wd.push({ t: 'p', label: T('s_level'), bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((lv, i) => {
      const locked = demo && i > 1;
      const won = (rec.wins ?? [])[i] ?? 0;
      wd.push({ t: 'btn', id: `lvl${i}`, label: lang === 'ko' ? lv.ko : lv.name, sub: locked ? T('inFull') : `${'★'.repeat(lv.stars)}${'☆'.repeat(5 - lv.stars)}  ${TAGS[lang][i]}${won ? ` · ${T('s_won', { n: won })}` : ''}`, active: s.lvl === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: T('s_target'), bold: true, color: '#ffe9a0', size: 26 });
  [5, 10, 15].forEach((n) => wd.push({ t: 'btn', id: `tgt${n}`, label: T('s_points', { n }), sub: n === 5 ? T('s_quick') : n === 10 ? T('s_standard') : T('s_long'), active: s.target === n }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function lessonsWidgets(state) {
  const T = tr(state), done = state.record.lessons, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: T('l_title'), size: 48 }, { t: 'p', label: T('l_intro'), size: 24 }];
  LESSONS.forEach((les, i) => {
    const lt = lessonText(state.settings.lang, les.id);
    const locked = demo && i >= DEMO_LESSONS;
    wd.push({ t: 'btn', id: `les${i}`, label: `${i + 1}. ${lt.title}`, sub: locked ? T('inFull') : done[i] ? T('l_done') : lt.short, active: !!done[i] && !locked, disabled: locked, hitDisabled: true, h: 92 });
  });
  wd.push({ t: 'gap', h: 10 });
  wd.push({ t: 'btn', id: 'back', label: T('back'), primary: true, h: 84 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function introWidgets(state) {
  const T = tr(state), les = LESSONS[state.lessonSel], lt = lessonText(state.settings.lang, les.id);
  const wd = [{ t: 'gap', h: 10 }, { t: 'p', label: T('lessonLabel', { n: state.lessonSel + 1 }), bold: true, color: '#ffe9a0', size: 24 }, { t: 'h', label: lt.title, size: 46 }];
  lt.body.forEach((p) => wd.push({ t: 'p', label: p, size: 27 }));
  wd.push({ t: 'p', label: T('l_goal'), bold: true, color: '#ffe9a0', size: 24 });
  wd.push({ t: 'p', label: lt.goal, size: 27 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const T = tr(state), st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: T('m_settings'), size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? T('soundOn') : T('soundOff') },
    { t: 'btn', id: 'set-calm', label: st.calm ? T('calmOn') : T('calmOff'), sub: T('calmSub'), active: st.calm },
    { t: 'p', label: T('set_lang'), bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'lang:en', label: 'Play in English', row: 12, active: st.lang === 'en' },
    { t: 'btn', id: 'lang:ko', label: '한국어로 플레이', row: 12, active: st.lang === 'ko' },
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
  const T = tr(state), m = state.match, o = m.over, mode = m.cfg.mode, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = hp && hp.nameOf ? hp.nameOf : () => '';
  const wd = [{ t: 'gap', h: big ? 24 : 150 }];
  if (o.lesson) {
    const lt = lessonText(state.settings.lang, LESSONS[m.cfg.lesson].id);
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
  const title = mode === 'watch' ? T('r_wins', { name: nm(winner) }) : mode === 'pass' ? T('r_wins', { name: nm(winner) }) : winner === 0 ? T('r_youWin') : T('r_wins', { name: nm(1) });
  wd.push({ t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 });
  wd.push({ t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  const l1 = T('r_stats', { turns: m.turns, kk: Math.max(m.stats.kk[0], m.stats.kk[1]) });
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
  const T = tr(state), st = state.settings;
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
  const T = tr(state);
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: T('d_title'), size: 48 },
    { t: 'p', label: T('d_body'), size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: T('r_menu'), primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(14,8,34,${a * 0.7})`); g.addColorStop(0.5, `rgba(14,8,34,${a})`); g.addColorStop(1, `rgba(14,8,34,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W, state) {
  if (maxScroll <= 0) return;
  const T = tr(state), cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(14,8,34,0)'); g.addColorStop(1, 'rgba(14,8,34,0.7)');
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
  LAID = { key, lay, top, bottom, h: lay.contentH, lang: state.settings.lang, zoom: state.settings.textIdx };
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
  g.addColorStop(0, 'rgba(14,8,34,0.5)'); g.addColorStop(1, 'rgba(14,8,34,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 720);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  bg(ctx, state); scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  pinned(ctx, state, tr(state)('s_start'));
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
function pinned(ctx, state, startLabel) {
  const T = tr(state);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(14,8,34,0)'); g.addColorStop(0.2, 'rgba(14,8,34,0.88)'); g.addColorStop(1, 'rgba(14,8,34,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, startLabel, { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, T('back'), { dark: true, size: 28 });
}
export function renderLessons(ctx, state) { bg(ctx, state); scrim(ctx, 0.8); drawFlowScreen(ctx, state, 'lessons', lessonsWidgets(state), 0, H); toastDraw(ctx, state); }
export function renderLessonIntro(ctx, state) { bg(ctx, state); scrim(ctx, 0.84); drawFlowScreen(ctx, state, 'lessonintro', introWidgets(state), 0, 1130); pinned(ctx, state, tr(state)('l_start')); }
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
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(30,22,64,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH, lang: state.settings.lang, zoom: state.settings.textIdx };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660, state);
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
    sec.p.forEach((para, pi) => {
      const wl = wrapLines(ctx, para, tw);
      wl.forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 }));
    });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art && scale < 2 ? 210 : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    const minNeed = titleH + artH + 26 + lh * 3;
    if (!cur || (used + full > limit - top && used + minNeed > limit - top)) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 ? sec.art : null, artH: part === 0 ? artH : 0, lines: [], part };
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
  bg(ctx, state);
  scrim(ctx, 0.66);
  const T = tr(state);
  ART_LANG = state.settings.lang;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${state.settings.lang}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(28,37,82,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${state.settings.lang === 'ko' ? FONT : DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(28,37,82,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(28,37,82,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ` (${T('cont')})` : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(28,37,82,0.7)';
  ctx.fillText(T('page', { a: idx + 1, b: pages.length }), W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? T('close') : T('back'), { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? T('done') : T('next'), { primary: true, size: 32 });
}

// ---- illustrations: the game's own pebbles, mat and routes ---------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff6e4', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y); ctx.restore();
}
function miniMat(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#34457f'); g.addColorStop(0.5, '#2d6f6c'); g.addColorStop(1, '#6e3f72');
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  ctx.strokeStyle = 'rgba(250,240,215,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(w * 0.34, 0); ctx.lineTo(w * 0.34, h); ctx.moveTo(w * 0.68, 0); ctx.lineTo(w * 0.68, h); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.strokeStyle = 'rgba(28,37,82,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
const stoneAt = (ctx, id, x, y, s = 0.7, o = {}) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawStone(ctx, { id, x: 0, y: 0, rot: id }, o); ctx.restore(); };
function arrow(ctx, x0, y0, x1, y1, col = '#ffc94d', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    stones() {
      miniMat(ctx, w, h);
      STONE_PAL.forEach((p, i) => { stoneAt(ctx, i, w * (0.12 + i * 0.19), h * 0.5, 0.95); label(ctx, p.name, w * (0.12 + i * 0.19), h - 14, 17); });
    },
    scatter() {
      miniMat(ctx, w, h);
      const cx = w * 0.5, cy = h * 0.44;
      ctx.setLineDash([8, 8]); ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      [[-40, -20], [30, -40], [50, 20], [-20, 40], [0, 0]].forEach(([dx, dy], i) => stoneAt(ctx, i, cx + dx, cy + dy, 0.55));
      arrow(ctx, cx, cy, cx + 70, cy, '#ffc94d', 3);
      label(ctx, '+ drag', cx + 100, cy + 6, 18, '#ffe9a0');
      drawHandMini(ctx, w * 0.5, h - 30);
    },
    route() {
      miniMat(ctx, w, h);
      const home = [w * 0.5, h - 34], a = [w * 0.28, h * 0.4], b = [w * 0.72, h * 0.34];
      ctx.save(); drawRoute(ctx, [{ x: home[0], y: home[1] }, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }, { x: home[0], y: home[1] }], { alpha: 0.3 }); ctx.restore();
      stoneAt(ctx, 1, a[0], a[1], 0.62); stoneAt(ctx, 3, b[0], b[1], 0.62); stoneAt(ctx, 4, w * 0.5, h * 0.62, 0.62);
      drawBadge(ctx, a[0] + 20, a[1] - 20, '1', { r: 13 }); drawBadge(ctx, b[0] + 20, b[1] - 20, '2', { r: 13 });
      drawHandMini(ctx, home[0], home[1]);
      label(ctx, T0('route'), w / 2, 26, 20);
    },
    clip() {
      miniMat(ctx, w, h);
      const home = [w * 0.5, h - 34], a = [w * 0.5, h * 0.24];
      ctx.save(); drawRoute(ctx, [{ x: home[0], y: home[1] }, { x: a[0], y: a[1] }], { alpha: 0.3, bad: true }); ctx.restore();
      stoneAt(ctx, 2, w * 0.5, h * 0.55, 0.62); stoneAt(ctx, 0, a[0], a[1], 0.62);
      ctx.strokeStyle = '#ff7a62'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(w * 0.5, h * 0.55, 30, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      drawHandMini(ctx, home[0], home[1]);
      label(ctx, T0('clip'), w / 2, 26, 20, '#ffb09a');
    },
    gauge() {
      miniMat(ctx, w, h);
      const gx = 40, gw = w - 80, gy = h * 0.52;
      roundPath(ctx, gx, gy, gw, 24, 12); ctx.fillStyle = 'rgba(10,6,30,0.6)'; ctx.fill();
      roundPath(ctx, gx, gy, gw * 0.62, 24, 12); ctx.fillStyle = '#ffd45e'; ctx.fill();
      ctx.fillStyle = '#ff8a70'; ctx.fillRect(gx + gw * 0.38 - 2, gy - 8, 4, 40); ctx.fillStyle = '#7fe8d6'; ctx.fillRect(gx + gw * 0.52 - 2, gy - 8, 4, 40);
      label(ctx, T0('low'), gx + gw * 0.38, gy - 16, 17, '#ff9a86'); label(ctx, T0('safe'), gx + gw * 0.58, gy - 16, 17, '#7fe8d6');
      label(ctx, T0('hold'), w / 2, h - 18, 20);
    },
    kk() {
      miniMat(ctx, w, h);
      const cx = w * 0.5, cy = h * 0.55;
      ctx.setLineDash([8, 8]); ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 64, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      [[-28, -24, 30], [26, -30, 50], [-8, 6, 20], [34, 18, 6], [-34, 22, 10]].forEach(([dx, dy, z], i) => stoneAt(ctx, i, cx + dx, cy + dy - z * 0.5, 0.52 + z / 200));
      drawHandMini(ctx, cx, cy + 40);
      label(ctx, T0('kk'), w / 2, 26, 20);
    },
    set() {
      miniMat(ctx, w, h);
      const cx = w * 0.5, cy = h * 0.4;
      const c = clusterAt(0, 0, [1, 2, 3, 4]);
      c.forEach((s) => stoneAt(ctx, s.id, cx + s.x * 0.62, cy + s.y * 0.62, 0.55));
      stoneAt(ctx, 0, w * 0.5, h * 0.18, 0.55, {});
      drawHandMini(ctx, w * 0.5, h - 30);
      label(ctx, T0('set'), w / 2, h - 66, 19);
    },
  };
  (A[key] ?? A.stones)();
  ctx.restore();
}
// short illustration captions follow the language of the page being drawn
let ART_LANG = 'en';
const ART = {
  en: { route: 'Route: 1, then 2, then home', clip: 'The route brushes a stone: a fault', low: 'min', safe: 'safe', hold: 'Hold to set the toss height', kk: 'Palm over the falling stones', set: 'Four stones set together' },
  ko: { route: '길: 1번, 2번, 그리고 제자리', clip: '길이 돌을 스치면 반칙', low: '최소', safe: '안전', hold: '눌러서 던지는 높이를 정해요', kk: '떨어지는 돌 위에 손바닥', set: '네 개를 한곳에 모아 놓기' },
};
const T0 = (k) => ART[ART_LANG][k];
export const setArtLang = (l) => { ART_LANG = l; };
function drawHandMini(ctx, x, y) { drawHand(ctx, x, y, { r: 20 }); }
void R; void HOME; void drawRing; void stageName;
