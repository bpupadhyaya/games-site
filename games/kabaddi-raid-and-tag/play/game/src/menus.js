// Every screen that is not the play screen: title, setup, settings, learn, result, pause, the Think card, lesson cards, and the scrolling
// About / How to Play / Rules reader with its illustrations (drawn with the game's own court and players). Pure drawing; game.js owns state.
// Fluid: every rectangle comes from layout.js (FLOW / CARD / READER), which follows the live screen size. In landscape the title and the
// result screen use two panes (art / stats on the left, buttons on the right); the other menu screens are one centred scrolling column.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, THINK_STEPS, SETUP_PINS, FLOW, CARD, READER, host, isWide, minFont } from './layout.js';
import { courtMap, drawMat, drawDot, drawBackdrop, drawActors, drawFormationPreview, TEAM_COL, TAU } from './art.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS } from './ai.js';
import { COURT, formationSlots, FORMATIONS, FORMATION_NAME, MATCH_LENGTH } from './rules.js';
import { RESP_WINDOWS } from './sim.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { drawLockup, lockupSize, drawMoreLine } from './brand.js';

let LAID = { key: '', lay: null, top: 0, bottom: H, left: null };
export const flowMeta = () => LAID;
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: H, left: null }; readerCache.clear(); };
export const resetPages = () => readerCache.clear();
const estCtx = { font: '', measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
const LOCK_H = 72;                                   // the title lockup height (virtual units)

// Where each menu screen lives: the main column, and (landscape title / result) a left pane.
function specFor(key, state) {
  const wide = isWide();
  if (key === 'pause' || key === 'hint' || key === 'lesson') return { x: CARD.x, w: CARD.w, top: CARD.top, bottom: CARD.bottom, card: true };
  if (key === 'setup') return { x: FLOW.x, w: FLOW.w, top: FLOW.top, bottom: SETUP_PINS.start.y - 12 };
  if (wide && (key === 'title' || key === 'result') && FLOW.twoPane) {
    const tp = FLOW.twoPane, l = tp.left;
    return { x: tp.x, w: tp.w, top: tp.top, bottom: key === 'title' ? tp.bottom - (state.demo ? 30 : 0) - LOCK_H - 22 : tp.bottom, left: { x: l.x, w: l.w, top: l.y + 8, bottom: l.y + l.h - 8 } };
  }
  if (key === 'title') return { x: FLOW.x, w: FLOW.w, top: FLOW.top, bottom: FLOW.bottom - (state.demo ? 30 : 0) - LOCK_H - 22 };
  return { x: FLOW.x, w: FLOW.w, top: FLOW.top, bottom: FLOW.bottom };
}
// The widgets of a screen: { main, left } (left only in a two-pane layout)
function widgetsFor(key, state, spec) {
  switch (key) {
    case 'title': return { main: titleWidgets(state, spec) };
    case 'setup': return { main: setupWidgets(state) };
    case 'settings': return { main: settingsWidgets(state) };
    case 'learn': return { main: learnWidgets(state) };
    case 'result': return spec.left ? resultPanes(state) : { main: resultWidgets(state) };
    case 'demolimit': return { main: demoLimitWidgets() };
    case 'pause': return { main: pauseWidgets(state) };
    case 'hint': return { main: hintWidgets(state) };
    case 'lesson': return { main: lessonWidgets(state) };
    default: return { main: [] };
  }
}
const cardGeom = (lay) => { const ch = Math.min(lay.contentH + 20, CARD.bottom - CARD.top), y0 = Math.max(CARD.top, (H - ch) / 2); return { y0, ch }; };
// Build (and remember) the layout of one screen. Called from update (hit-testing) and render with the same inputs, so they always agree.
export function ensureLayout(state, key) {
  const spec = specFor(key, state), wd = widgetsFor(key, state, spec);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(estCtx, wd.main, sc, { x: spec.x, w: spec.w });
  let top = spec.top, bottom = spec.bottom;
  if (spec.card) { const g = cardGeom(lay); top = g.y0; bottom = g.y0 + g.ch; }
  let left = null;
  if (spec.left) { const l = spec.left; left = { lay: wd.left ? flowLayout(estCtx, wd.left, sc, { x: l.x, w: l.w }) : null, x: l.x, w: l.w, top: l.top, bottom: l.bottom }; }
  LAID = { key, lay, top, bottom, h: lay.contentH, spec, left };
  return LAID;
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// The hero: the logo above a live court where two computer sides keep raiding. Designed 600 tall; `k` scales it down to fit.
function drawHero(ctx, state, w, k = 1) {
  const cx = w / 2;
  ctx.save();
  ctx.scale(k, k); const ww = w / k; const hx = ww / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.max(24, Math.round(minFont(22) / k))}px ${FONT}`; ctx.fillStyle = 'rgba(242,180,65,0.95)';
  spaced(ctx, 'THE SOUTH ASIAN TEAM SPORT', hx, 64, 6);
  ctx.font = `800 128px ${NUM}`;
  textShadow(ctx, 'KABADDI', hx, 178, '#fff4d6', 16);
  ctx.strokeStyle = 'rgba(242,180,65,0.85)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hx - 255, 212); ctx.lineTo(hx - 118, 212); ctx.moveTo(hx + 118, 212); ctx.lineTo(hx + 255, 212); ctx.stroke();
  ctx.font = `800 36px ${NUM}`; ctx.fillStyle = '#f2b441';
  spaced(ctx, 'RAID AND TAG', hx, 224, 8);
  // the live court
  const sc = state.att;
  const r = { x: hx - 190, y: 262, w: 380, h: 318 };
  const mp = courtMap(r, -1.0, COURT.HALF + 0.15);
  drawMat(ctx, mp, { r: 18 });
  if (sc) {
    if (sc.raid) drawActors(ctx, mp, sc, { r: 8.6 });
    else if (sc.pre) drawFormationPreview(ctx, mp, sc.pre.formation, sc.match.teams[sc.pre.def].onMat.length, sc.pre.def, { r: 8.6 });
  }
  ctx.restore();
  void cx;
}
const BTN_ROWS_H = 92 + 80 + 4 * 76 + 6 * 14 + 30;     // the title buttons without the hero (with Continue)
function heroArt(state, h) {
  const k = Math.min(1, h / 600);
  return { t: 'art', h: Math.round(600 * k), draw(ctx, w) { drawHero(ctx, state, w, k); } };
}

export function titleWidgets(state, spec) {
  const sound = state.settings.sound;
  const wide = !!(spec && spec.left);
  const wd = [];
  if (!wide) {
    const avail = (spec ? spec.bottom - spec.top : H) - BTN_ROWS_H - 20;
    wd.push(heroArt(state, Math.max(300, Math.min(600, avail))));
  } else wd.push({ t: 'gap', h: 4 });
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

// The result: the headline + stats (text) and the buttons. One column in portrait, two panes in landscape.
function resultParts(state) {
  const o = state.over;
  if (!o) return { text: [], btns: [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }] };
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const mode = o.mode, w = o.winner;
  const title = w < 0 ? 'A draw' : mode === 'two' ? `${w === 0 ? 'Blue' : 'Red'} wins` : mode === 'watch' ? `${w === 0 ? 'Blue' : 'Red'} wins` : w === 0 ? 'You win!' : 'You lose';
  const text = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${o.score[0]} – ${o.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
    { t: 'p', label: 'Blue  vs  Red', bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const [a, b] = o.stats;
  const rows = [['Raids', a.raids, b.raids], ['Successful raids', a.success, b.success], ['Touch points', a.touches, b.touches], ['Bonus points', a.bonus, b.bonus], ['Tackles', a.tackles, b.tackles], ['Super tackles', a.superTackles, b.superTackles], ['Super raids', a.superRaids, b.superRaids], ['All outs', a.allOuts, b.allOuts]];
  rows.forEach(([k, x, y]) => text.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') text.push({ t: 'p', label: `Matches won against ${LEVELS[o.level].name}: ${state.record.wins[o.level] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  const btns = [];
  btns.push({ t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 });
  btns.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  btns.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  btns.push({ t: 'art', h: 40, draw(ctx, w2, h2) { drawMoreLine(ctx, w2 / 2, h2 / 2, minFont(20)); } });
  return { text, btns };
}
export function resultWidgets(state) { const p = resultParts(state); return [...p.text, { t: 'gap', h: 16 }, ...p.btns, { t: 'gap', h: 30 }]; }
function resultPanes(state) { const p = resultParts(state); return { main: [{ t: 'gap', h: 30 }, ...p.btns, { t: 'gap', h: 20 }], left: p.text }; }

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
    { t: 'gap', h: isWide() ? 40 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
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

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2, fs = minFont(22);
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(1, 'rgba(6,10,14,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 50, bottom - 40, 100, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#14202a'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 50, top + 8, 100, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#14202a'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
const barX = (x, w) => Math.min(W - 8, x + w + 12);

// Draw one flow pane (a column of widgets) with its scroll bar and hints.
function paneDraw(ctx, lay, x, w, top, bottom, scroll) {
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const sc = Math.min(scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, sc);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (sc / maxScroll) * (bottom - top - th);
    roundPath(ctx, barX(x, w) - 5, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, sc, maxScroll, x, w);
  }
  return { scroll: sc, maxScroll };
}

function drawFlowScreen(ctx, state, key) {
  const L = ensureLayout(state, key);
  const r = paneDraw(ctx, L.lay, L.spec.x, L.spec.w, L.top, L.bottom, state.ui.scroll);
  if (L.left && L.left.lay) paneDraw(ctx, L.left.lay, L.left.x, L.left.w, L.left.top, L.left.bottom, state.ui.scrollL || 0);
  return { ...r, L };
}

export function renderTitle(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.18);
  const L = drawFlowScreen(ctx, state, 'title').L;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (L.left) {
    // landscape: the hero fills the left pane
    const l = L.left, k = Math.min(1, l.w / 560, (l.bottom - l.top - 10) / 600);
    ctx.save(); ctx.translate(l.x, l.top + Math.max(0, (l.bottom - l.top - 600 * k) / 2));
    drawHero(ctx, state, l.w, k); ctx.restore();
  }
  // themed lockup: bottom centre, directly under the last row of menu buttons (pinned to the bottom when the menu scrolls)
  const btns = L.lay.items.filter((i) => i.w.t === 'btn');
  const sp = L.spec, lcx = sp.x + sp.w / 2;
  const limit = (sp.left ? sp.bottom + 22 + (state.demo ? 30 : 0) : FLOW.bottom) - LOCK_H - 6;
  const under = L.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20;
  const ly = Math.min(limit, under), lw = lockupSize(LOCK_H).w || Math.round(LOCK_H * 3.67), m = 44 / Math.max(0.2, host.px);
  const tw = Math.max(lw + 24, m), th = Math.max(LOCK_H + 12, m);
  titleLockTap = { x: lcx - tw / 2, y: ly + LOCK_H + 6 - th, w: tw, h: th };
  ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(6,12,18,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, LOCK_H + 12, (LOCK_H + 12) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, lcx, ly, LOCK_H, 1);
  if (state.demo) { ctx.font = `400 ${minFont(18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', lcx, ly + LOCK_H + 28); }
}
export function renderSetup(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.6);
  drawFlowScreen(ctx, state, 'setup');
  const y0 = SETUP_PINS.start.y - 36;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(0.2, 'rgba(6,10,14,0.88)'); g.addColorStop(1, 'rgba(6,10,14,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, SETUP_PINS.start.y - 8); }
}
export function renderSettings(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'settings'); }
export function renderLearn(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'learn'); }
export function renderResult(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.7); drawFlowScreen(ctx, state, 'demolimit'); }

function cardOverlay(ctx, state, key) {
  scrim(ctx, 0.55);
  const L = ensureLayout(state, key);
  const ch = L.bottom - L.top;
  panel(ctx, CARD.panelX, L.top - 20, CARD.panelW, ch + 40, { r: 30, fill: 'rgba(14,26,32,0.96)', stroke: 'rgba(242,180,65,0.6)' });
  const maxScroll = Math.max(0, L.lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, L.lay, L.top, L.bottom, sc0);
  scrollHint(ctx, L.top, L.bottom, sc0, maxScroll, CARD.panelX, CARD.panelW);
}
export function renderPause(ctx, state) { cardOverlay(ctx, state, 'pause'); }
export function renderHint(ctx, state) { cardOverlay(ctx, state, 'hint'); }
export function renderLesson(ctx, state) { cardOverlay(ctx, state, 'lesson'); }

// ---- reference pages: one scrolling reader (drag, wheel, keys, scroll bar) --------------------------------------------------------------------
const readerCache = new Map();
const LISTS = { howto: [HOWTO, 'How to Play'], about: [ABOUT, 'About'], rules: [RULES, 'Rules'] };
const listOf = (state) => { const [l, h] = LISTS[state.scene] ?? [ABOUT, 'About']; return [state.scene === 'about' ? (state.creditsList ?? l) : l, h]; };
const ART_H = 290;
// All sections laid out top to bottom in one long column (built from the same text estimates in update and in render).
function buildReader(list, scale, bodyW, mctx = estCtx) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, secFs = Math.round(34 * Math.min(scale, 1.3));
  const blocks = [];
  let y = 0;
  list.forEach((sec, si) => {
    mctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(mctx, sec.title, bodyW);
    const titleH = tl.length * secFs * 1.2 + 14;
    mctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(mctx, para, bodyW).forEach((l, k) => lines.push({ text: l, gap: k === 0 && pi > 0 })); });
    const b = { y, tl, titleH, art: sec.art || null, artH: sec.art ? ART_H : 0, lines, sep: si > 0 };
    let h = titleH + b.artH + (sec.art ? 8 : 0);
    lines.forEach((l) => { h += lh + (l.gap ? lh * 0.45 : 0); });
    b.h = h; blocks.push(b); y += h + 34;
  });
  return { blocks, total: y, fs, lh, secFs };
}
// `mctx`: a real canvas context measures the text exactly (render); without one (update before the first frame, tests) the rough estimate is used.
export function readerInfo(state, mctx) {
  const [list, header] = listOf(state), sc = TEXT_SCALES[state.settings.textIdx], bw = READER.body.w;
  const key = `${state.scene}:${sc}:${list.length}:${bw}`;
  let R = readerCache.get(key);
  if (!R || (mctx && !R.real)) { R = buildReader(list, sc, bw, mctx || estCtx); R.real = !!mctx; readerCache.set(key, R); if (readerCache.size > 24) readerCache.delete(readerCache.keys().next().value); }
  return { R, list, header, max: Math.max(0, R.total - READER.body.h), view: READER.body.h };
}

export function renderPages(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const { R, header, max } = readerInfo(state, ctx);
  const scroll = Math.max(0, Math.min(state.rscroll || 0, max));
  const P = READER.panel, B = READER.body;
  panel(ctx, P.x, P.y, P.w, P.h, { r: 26, fill: 'rgba(244,240,228,0.97)', stroke: 'rgba(181,128,31,0.8)' });
  // text size row on top
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cxm = (TEXT_DEC.x + TEXT_DEC.w + TEXT_INC.x) / 2;
  ctx.font = `800 ${minFont(30)}px ${FONT}`; ctx.fillText(header, cxm, TEXT_DEC.y + TEXT_DEC.h / 2 - 11);
  ctx.font = `600 ${minFont(21)}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.85)'; ctx.fillText(`Text ${Math.round(sc * 100)}%`, cxm, TEXT_DEC.y + TEXT_DEC.h / 2 + 18);
  // body
  ctx.save();
  ctx.beginPath(); ctx.rect(P.x + 6, B.y - 6, P.w - 12, B.h + 12); ctx.clip();
  R.blocks.forEach((blk, bi) => {
    let y = B.y + blk.y - scroll;
    if (y > B.y + B.h + 20 || y + blk.h < B.y - 20) return;
    if (blk.sep) { ctx.strokeStyle = 'rgba(20,32,42,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(B.x + 40, y - 18); ctx.lineTo(B.x + B.w - 40, y - 18); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.red; ctx.font = `800 ${R.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, B.x + B.w / 2, y + R.secFs * (0.9 + k * 1.2)));
    y += blk.titleH;
    if (blk.art) { const aw = Math.min(B.w, 572); ctx.save(); ctx.beginPath(); ctx.rect(B.x + (B.w - aw) / 2, y, aw, blk.artH); ctx.clip(); drawArt(blk.art, ctx, B.x + (B.w - aw) / 2, y, aw, blk.artH - 12); ctx.restore(); y += blk.artH + 8; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${R.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l) => { if (l.gap) y += R.lh * 0.45; ctx.fillText(l.text, B.x, y + R.fs * 0.85); y += R.lh; });
    void bi;
  });
  ctx.restore();
  // scroll bar
  if (max > 0) {
    const Bar = READER.bar, th = Math.max(48, Bar.h * (B.h / R.total)), ty = Bar.y + (scroll / max) * (Bar.h - th);
    roundPath(ctx, Bar.x + 4, Bar.y, 6, Bar.h, 3); ctx.fillStyle = 'rgba(20,32,42,0.12)'; ctx.fill();
    roundPath(ctx, Bar.x + 3, ty, 8, th, 4); ctx.fillStyle = 'rgba(140,35,28,0.55)'; ctx.fill();
  }
  drawButton(ctx, READER.close, 'Close', { primary: true, size: 32 });
}

// ---- illustrations: drawn with the game's own court and players --------------------------------------------------------------------------
// Width of the illustration being drawn (set by drawArt): a caption never leaves the picture - it shrinks a little, then wraps onto more lines.
let ART_W = Infinity;
function label(ctx, t, x, y, size = 20, col = '#14202a', align = 'center') {
  let px = Math.max(size, minFont(15));
  ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const edge = 8, left = align === 'left' ? x : align === 'right' ? edge : edge;
  const room = align === 'left' ? ART_W - edge - x : align === 'right' ? x - edge : ART_W - 2 * edge;
  ctx.font = `700 ${px}px ${FONT}`;
  let tw = ctx.measureText(t).width;
  if (tw > room) { px = Math.max(minFont(15), Math.floor(px * room / tw)); ctx.font = `700 ${px}px ${FONT}`; tw = ctx.measureText(t).width; }
  if (tw > room && t.includes(' ')) {
    const lines = []; let cur = '';
    for (const wd of t.split(' ')) { const nx = cur ? `${cur} ${wd}` : wd; if (cur && ctx.measureText(nx).width > room) { lines.push(cur); cur = wd; } else cur = nx; }
    lines.push(cur);
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * px * 1.15));
    return { n: lines.length, lh: px * 1.15 };
  }
  void left;
  if (ART_W < Infinity && align === 'center') x = Math.max(edge + tw / 2, Math.min(ART_W - edge - tw / 2, x));
  ctx.fillText(t, x, y);
  return { n: 1, lh: px * 1.15 };
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
  ctx.save(); ctx.translate(x, y); ART_W = w;
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
        let yy = 44;
        for (const t of ['1  walk to the midline', '2  cross the baulk line', '3  tag: only banked', '4  retreat across the midline']) { const r = label(ctx, t, 300, yy, 20, '#fff2cf', 'left'); yy += (r.n - 1) * r.lh + 38; }
        label(ctx, 'clock 30 s · cant 7 s', 300, yy + 8, 20, '#ffd36a', 'left');
      });
    },
    tackles() {
      ill(ctx, w, h, () => {
        const items = [['Ankle hold', 'low, vs toe touch'], ['Thigh hold', 'vs hand touch'], ['Chain', '2-3 defenders'], ['Block', 'cut the exit'], ['Dash', 'fast, risky'], ['Hold ground', 'step back']];
        const ch = (h - 30) / 2 - 10, cwid = (w - 40) / 3 - 10;
        items.forEach(([a, b], i) => {
          const cx = 20 + (i % 3) * ((w - 40) / 3), cy = 20 + Math.floor(i / 3) * ((h - 30) / 2);
          roundPath(ctx, cx, cy, cwid, ch, 12); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
          const mx = cx + cwid / 2;
          // the figures live above the two caption lines and are scaled to fit that zone (the tallest group reaches 72 up and 12 down)
          const zone = ch - 50, k = Math.min(1, (zone - 6) / 84), my = cy + 6 + 72 * k;
          ctx.save(); ctx.translate(mx, my); ctx.scale(k, k);
          drawDot(ctx, 0, 0, 12, 0, { yaw: 0 });
          const dd = [[0, -26], [0, -22], [0, -22], [0, -34], [0, -40], [0, -48]][i];
          drawDot(ctx, dd[0], dd[1] - 12, 12, 1, { yaw: Math.PI });
          if (i === 2) { drawDot(ctx, -30, -8, 11, 1, { yaw: Math.PI }); drawDot(ctx, 30, -8, 11, 1, { yaw: Math.PI }); }
          if (i === 3) { drawDot(ctx, -30, -34, 11, 1, { yaw: Math.PI }); drawDot(ctx, 30, -34, 11, 1, { yaw: Math.PI }); }
          ctx.restore();
          label(ctx, a, mx, cy + ch - 28, 17, '#fff2cf'); label(ctx, b, mx, cy + ch - 9, 15, '#c8dce3');
        });
      });
    },
    bonus() {
      ill(ctx, w, h, () => {
        const mp = courtIn(ctx, 12, 10, 270, h - 20, -0.8, COURT.HALF + 0.2);
        formationSlots('deep', 7).forEach((s) => drawDot(ctx, mp.sx(s.x), mp.sy(s.u), 9, 1, { yaw: Math.PI }));
        drawDot(ctx, mp.sx(5), mp.sy(4.9), 10, 0, { yaw: 0, ring: '#ffd36a' });
        arrow(ctx, mp.sx(5), mp.sy(0.4), mp.sx(5), mp.sy(4.5), '#ffd36a', 4);
        let yy = 54;
        for (const [t, col, sz] of [['Live with 6 or 7 defenders', '#ffd36a', 21], ['One foot over the gold line,', '#fff2cf', 20], ['then home: 1 point, before', '#fff2cf', 20]]) { const r = label(ctx, t, 300, yy, sz, col, 'left'); yy += (r.n - 1) * r.lh + 34; }
        label(ctx, 'any touch. No revival.', 300, yy, 20, '#fff2cf', 'left');
      });
    },
  };
  (A[key] ?? A.court)();
  ART_W = Infinity;
  ctx.restore();
}
