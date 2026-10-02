// Every screen that is not the play screen: title, setup, settings, learn, result, pause, the Think card, lesson cards, and the paginated
// About / How to Play / Rules reader with its illustrations (drawn with the game's own court and players). Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { courtMap, drawMat, drawDot, drawBackdrop, drawActors, drawFormationPreview, TEAM_COL, TAU } from './art.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS } from './ai.js';
import { COURT, formationSlots, FORMATIONS, FORMATION_NAME, MATCH_LENGTH } from './rules.js';
import { RESP_WINDOWS } from './sim.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';

let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; pageCache.clear(); };
export const resetPages = () => pageCache.clear();
const estCtx = { font: '', measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
export function ensureLayout(state, key) {
  // rebuilt every update: the title gains a Continue button the moment the saved match has loaded
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], learn: [learnWidgets, 0, H],
    result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H], pause: [pauseWidgets, 70, H - 70], hint: [hintWidgets, 70, H - 70], lesson: [lessonWidgets, 70, H - 70],
  };
  const d = defs[key];
  if (!d) return;
  const opts = key === 'pause' || key === 'hint' || key === 'lesson' ? { x: 60, w: 600 } : {};
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx], opts);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// The hero: the logo above a live court where two computer sides keep raiding.
function heroArt(state) {
  return {
    t: 'art', h: 600,
    draw(ctx, w) {
      const cx = w / 2;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(242,180,65,0.95)';
      spaced(ctx, 'THE SOUTH ASIAN TEAM SPORT', cx, 64, 6);
      ctx.font = `800 128px ${NUM}`;
      textShadow(ctx, 'KABADDI', cx, 178, '#fff4d6', 16);
      ctx.strokeStyle = 'rgba(242,180,65,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 255, 212); ctx.lineTo(cx - 118, 212); ctx.moveTo(cx + 118, 212); ctx.lineTo(cx + 255, 212); ctx.stroke();
      ctx.font = `800 36px ${NUM}`; ctx.fillStyle = '#f2b441';
      spaced(ctx, 'RAID AND TAG', cx, 224, 8);
      ctx.restore();
      // the live court
      const sc = state.att;
      const r = { x: cx - 190, y: 262, w: 380, h: 318 };
      const mp = courtMap(r, -1.0, COURT.HALF + 0.15);
      drawMat(ctx, mp, { r: 18 });
      if (sc) {
        if (sc.raid) drawActors(ctx, mp, sc, { r: 8.6 });
        else if (sc.pre) drawFormationPreview(ctx, mp, sc.pre.formation, sc.match.teams[sc.pre.def].onMat.length, sc.pre.def, { r: 8.6 });
      }
      ctx.restore?.();
    },
  };
}

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(state)];
  if (state.resume) {
    const r = state.resume;
    const who = r.cfg.mode === 'two' ? 'Two players' : `vs ${LEVELS[r.cfg.level ?? 0].name}`;
    wd.push({ t: 'btn', id: 'continue', label: 'Continue match', sub: `${who}, ${r.m.score[0]} to ${r.m.score[1]}`, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'play', label: 'New match vs Computer', h: 80 });
  } else wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'learn', label: 'Learn', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9bf', size: 26 });
    LEVELS.forEach((pf, i) => {
      const won = rec.wins[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `lv${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.level === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  } else wd.push({ t: 'p', label: 'Pass the phone: each player makes their own moves.', size: 24, color: 'rgba(255,243,214,0.9)' });
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  wd.push({ t: 'btn', id: 'len-quick', label: 'Quick', sub: `${MATCH_LENGTH.quick} raids each per half`, row: 9, active: s.length === 'quick' });
  wd.push({ t: 'btn', id: 'len-full', label: 'Full', sub: `${MATCH_LENGTH.full} raids each per half`, row: 9, active: s.length === 'full', disabled: demo, hitDisabled: true });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const rw = ['Relaxed', 'Normal', 'Quick'][st.respWin];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-women', label: st.women ? 'Players: Women' : 'Players: Men', sub: 'The look of the players on the 3D court', active: st.women },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Reaction time when defending: ${rw} (${RESP_WINDOWS[st.respWin]} s)`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'resp-inc', label: 'Longer', row: 6, disabled: st.respWin === 0 },
    { t: 'btn', id: 'resp-dec', label: 'Shorter', row: 6, disabled: st.respWin === RESP_WINDOWS.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function learnWidgets(state) {
  const done = state.record.lessons || [];
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Six short lessons on the real rules. Each one sets up a situation and asks for one thing.', size: 24, color: 'rgba(255,243,214,0.9)' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: done.includes(l.id) ? 'Done' : l.goal, active: done.includes(l.id), h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

export function resultWidgets(state) {
  const o = state.over;
  if (!o) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const mode = o.mode, w = o.winner;
  const title = w < 0 ? 'A draw' : mode === 'two' ? `${w === 0 ? 'Blue' : 'Red'} wins` : mode === 'watch' ? `${w === 0 ? 'Blue' : 'Red'} wins` : w === 0 ? 'You win!' : 'You lose';
  const wd = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${o.score[0]} – ${o.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
    { t: 'p', label: 'Blue  vs  Red', bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const [a, b] = o.stats;
  const rows = [['Raids', a.raids, b.raids], ['Successful raids', a.success, b.success], ['Touch points', a.touches, b.touches], ['Bonus points', a.bonus, b.bonus], ['Tackles', a.tackles, b.tackles], ['Super tackles', a.superTackles, b.superTackles], ['Super raids', a.superRaids, b.superRaids], ['All outs', a.allOuts, b.allOuts]];
  rows.forEach(([k, x, y]) => wd.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: `Matches won against ${LEVELS[o.level].name}: ${state.record.wins[o.level] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  wd.push({ t: 'gap', h: 16 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 });
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
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.mode === 'lesson' ? '' : 'Your match is kept', dark: true, row: 8 },
  ];
}

export function hintWidgets(state) {
  const h = state.hint;
  const wd = [{ t: 'h', label: 'Think', size: 48 }];
  (h ? h.lines : []).forEach((l) => wd.push({ t: 'p', label: l, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' }));
  wd.push({ t: 'gap', h: 10 });
  wd.push({ t: 'btn', id: 'hint-do', label: 'Do it', primary: true, h: 84 });
  wd.push({ t: 'btn', id: 'hint-close', label: 'Close', dark: true, h: 76 });
  return wd;
}

export function lessonWidgets(state) {
  const L = state.lesson;
  if (!L) return [];
  const d = L.def;
  if (L.phase === 'intro') {
    const wd = [{ t: 'h', label: `Lesson ${L.idx + 1}`, size: 40, color: '#f2b441' }, { t: 'h', label: d.title, size: 52 }];
    d.intro.forEach((l) => wd.push({ t: 'p', label: l, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' }));
    wd.push({ t: 'p', label: `Goal: ${d.goal}`, size: 24, cap: 3, bold: true, color: '#ffe9bf' });
    wd.push({ t: 'btn', id: 'ls-start', label: 'Start', primary: true, h: 84 });
    wd.push({ t: 'btn', id: 'ls-back', label: 'Back', dark: true, h: 76 });
    return wd;
  }
  if (L.phase === 'done') {
    const last = L.idx === LESSONS.length - 1;
    return [{ t: 'h', label: 'Well done', size: 52, color: '#9fe8b4' }, { t: 'p', label: d.done, size: 26, cap: 3, color: 'rgba(255,243,214,0.96)' },
      { t: 'btn', id: 'ls-next', label: last ? 'Finish' : 'Next lesson', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Lessons', dark: true, h: 76 }];
  }
  return [{ t: 'h', label: 'Not quite', size: 52, color: '#ffb4a0' }, { t: 'p', label: `The goal was: ${d.goal} Try again.`, size: 26, cap: 3, color: 'rgba(255,243,214,0.96)' },
    { t: 'btn', id: 'ls-retry', label: 'Try again', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Lessons', dark: true, h: 76 }];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the quick match of the web demo. The full game on iPhone and Android has all five opponents, full-length matches, Two Players and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,10,14,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,10,14,${a})`); g.addColorStop(1, `rgba(6,10,14,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(1, 'rgba(6,10,14,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#14202a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#14202a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(estCtx, widgets, sc);   // the same estimates the hit-test uses; drawing shrinks any label that is too wide
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

export function renderTitle(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.18);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}
export function renderSetup(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.6);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(0.2, 'rgba(6,10,14,0.88)'); g.addColorStop(1, 'rgba(6,10,14,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderResult(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.7); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); }

function cardOverlay(ctx, state, key, widgets) {
  scrim(ctx, 0.55);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(estCtx, widgets, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(14,26,32,0.96)', stroke: 'rgba(242,180,65,0.6)' });
  LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export function renderPause(ctx, state) { cardOverlay(ctx, state, 'pause', pauseWidgets(state)); }
export function renderHint(ctx, state) { cardOverlay(ctx, state, 'hint', hintWidgets(state)); }
export function renderLesson(ctx, state) { cardOverlay(ctx, state, 'lesson', lessonWidgets(state)); }

// ---- reference pages --------------------------------------------------------------------------
const pageCache = new Map();
// Pages are built from the same text estimates in update and in render, so the page count never depends on having drawn a frame.
function pagesFor(state, list, header) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(estCtx, list, sc); pageCache.set(pkey, pages); }
  return pages;
}
const LISTS = { howto: [HOWTO, 'How to Play'], about: [ABOUT, 'About'], rules: [RULES, 'Rules'] };
export const pageCount = (state) => { const [l, h] = LISTS[state.scene] ?? [ABOUT, 'About']; return pagesFor(state, state.scene === 'about' ? (state.creditsList ?? l) : l, h).length; };
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
    const artH = sec.art ? 250 : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    if (!cur || used + full > limit - top) newPage();
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

export function renderPages(ctx, state, list, header) {
  drawBackdrop(ctx); scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pages = pagesFor(state, list, header);
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(244,240,228,0.97)', stroke: 'rgba(181,128,31,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(20,32,42,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(20,32,42,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.red; ctx.font = `800 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(20,32,42,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations: drawn with the game's own court and players --------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#14202a', align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function stageBox(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#16303a'); g.addColorStop(1, '#0d1d24');
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(181,128,31,0.7)'; ctx.lineWidth = 2; ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
const ill = (ctx, w, h, fn) => { stageBox(ctx, w, h); ctx.save(); ctx.translate(0, 0); fn(); ctx.restore(); };
const courtIn = (ctx, x, y, w, h, u0 = -1.2, u1 = COURT.HALF + 0.15) => { const mp = courtMap({ x, y, w, h }, u0, u1); drawMat(ctx, mp, { r: 10 }); return mp; };

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    court() {
      ill(ctx, w, h, () => {
        const mp = courtIn(ctx, 12, 10, 280, h - 20, -1.2, COURT.HALF + 0.2);
        label(ctx, 'midline', 330, mp.sy(0) + 6, 20, '#fff2cf', 'left');
        label(ctx, 'baulk line: 3.75 m', 330, mp.sy(COURT.BAULK) + 6, 20, '#fff2cf', 'left');
        label(ctx, 'bonus line: 4.75 m', 330, mp.sy(COURT.BONUS) + 6, 20, '#ffd36a', 'left');
        label(ctx, 'end line: 6.5 m', 330, mp.sy(COURT.HALF) + 6, 20, '#fff2cf', 'left');
        label(ctx, 'lobby: 1 m', 330, mp.sy(2.0), 20, '#fff2cf', 'left');
        label(ctx, 'width: 10 m', 330, h - 24, 20, '#fff2cf', 'left');
      });
    },
    flow() {
      ill(ctx, w, h, () => {
        const mp = courtIn(ctx, 12, 10, 270, h - 20, -1.4, COURT.HALF + 0.2);
        const T = [[5, 0.0], [5, 2.0], [4, 4.1], [3.2, 4.2], [4.5, 0.2]];
        ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.beginPath();
        T.forEach(([px, pu], i) => { const sx = mp.sx(px), sy = mp.sy(pu); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.stroke(); ctx.setLineDash([]);
        formationSlots('arc', 7).forEach((s) => drawDot(ctx, mp.sx(s.x), mp.sy(s.u), 9, 1, { yaw: Math.PI }));
        drawDot(ctx, mp.sx(4.5), mp.sy(0.2), 10, 0, { yaw: 0, ring: '#fff' });
        label(ctx, '1  walk to the midline', 300, 50, 20, '#fff2cf', 'left');
        label(ctx, '2  cross the baulk line', 300, 90, 20, '#fff2cf', 'left');
        label(ctx, '3  tag: only banked', 300, 130, 20, '#fff2cf', 'left');
        label(ctx, '4  retreat across the midline', 300, 170, 20, '#fff2cf', 'left');
        label(ctx, 'clock 30 s · cant 7 s', 300, 216, 20, '#ffd36a', 'left');
      });
    },
    tackles() {
      ill(ctx, w, h, () => {
        const items = [['Ankle hold', 'low, vs toe touch'], ['Thigh hold', 'vs hand touch'], ['Chain', '2-3 defenders'], ['Block', 'cut the exit'], ['Dash', 'fast, risky'], ['Hold ground', 'step back']];
        items.forEach(([a, b], i) => {
          const cx = 20 + (i % 3) * ((w - 40) / 3), cy = 20 + Math.floor(i / 3) * ((h - 30) / 2), cw = (w - 40) / 3 - 10;
          roundPath(ctx, cx, cy, cw, (h - 30) / 2 - 10, 12); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
          const mx = cx + cw / 2, my = cy + 52;
          drawDot(ctx, mx, my, 12, 0, { yaw: 0 });
          const dd = [[0, -26], [0, -22], [0, -22], [0, -34], [0, -40], [0, -48]][i];
          drawDot(ctx, mx + dd[0], my + dd[1] - 12, 12, 1, { yaw: Math.PI });
          if (i === 2) { drawDot(ctx, mx - 30, my - 8, 11, 1, { yaw: Math.PI }); drawDot(ctx, mx + 30, my - 8, 11, 1, { yaw: Math.PI }); }
          if (i === 3) { drawDot(ctx, mx - 30, my - 34, 11, 1, { yaw: Math.PI }); drawDot(ctx, mx + 30, my - 34, 11, 1, { yaw: Math.PI }); }
          label(ctx, a, mx, cy + 98, 17, '#fff2cf'); label(ctx, b, mx, cy + 118, 15, '#c8dce3');
        });
      });
    },
    bonus() {
      ill(ctx, w, h, () => {
        const mp = courtIn(ctx, 12, 10, 270, h - 20, -0.8, COURT.HALF + 0.2);
        formationSlots('deep', 7).forEach((s) => drawDot(ctx, mp.sx(s.x), mp.sy(s.u), 9, 1, { yaw: Math.PI }));
        drawDot(ctx, mp.sx(5), mp.sy(4.9), 10, 0, { yaw: 0, ring: '#ffd36a' });
        arrow(ctx, mp.sx(5), mp.sy(0.4), mp.sx(5), mp.sy(4.5), '#ffd36a', 4);
        label(ctx, 'Live with 6 or 7 defenders', 300, 70, 21, '#ffd36a', 'left');
        label(ctx, 'One foot over the gold line,', 300, 112, 20, '#fff2cf', 'left');
        label(ctx, 'then home: 1 point, before', 300, 140, 20, '#fff2cf', 'left');
        label(ctx, 'any touch. No revival.', 300, 168, 20, '#fff2cf', 'left');
      });
    },
  };
  (A[key] ?? A.court)();
  ctx.restore();
}
