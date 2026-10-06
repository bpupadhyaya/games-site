// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the scrolling About / How to Play / Rules /
// role-guide reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size, and every rectangle comes
// from layout.js (the live screen size), so portrait, landscape and tablets all work and a rotation re-lays everything out.
import { W, H, TEXT_SCALES, THINK_STEPS, layoutFor, host } from './layout.js';
import { FONT, DISPLAY, C, UI, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, drawScrollBar } from './ui.js';
import { LEVELS, HALF_OPTIONS, CHOICES, HW, HL, GOAL_HW, BOX_HW, BOX_D, SPOT, CIRCLE_R } from './consts.js';
import { LESSONS, QUIZ } from './content.js';
import { KIT } from './hud.js';
import { drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
let lockup = null;
export const setLockup = (img) => { lockup = img; };
const curL = (state) => layoutFor(W, H, state.settings.textIdx);
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// A flow = scrolling widgets in one column, or in two columns side by side (landscape). `parts` are stacked top to bottom; a part with
// `cols` puts several columns next to each other. Returns the same shape flowLayout returns, so drawing and hit-testing are shared.
function stack(ctx, parts, sc) {
  const items = []; let y = 0;
  for (const part of parts) {
    let hmax = 0;
    for (const c of part.cols || [part]) {
      const lay = flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w });
      for (const it of lay.items) items.push({ ...it, y: it.y + y });
      hmax = Math.max(hmax, lay.contentH);
    }
    y += hmax;
  }
  return { items, contentH: y };
}
// Where each flow screen sits on this screen: the layout parts, the scroll window and whether the content is centred vertically.
// Extra room under a landscape screen heading so the first column starts below the host back button's box.
const backGap = (L) => (L.ins.back ? Math.max(0, L.backBox.y + L.backBox.h - 74) : 0);
function flowDef(ctx, key, state) {
  const L = curL(state), U = L.U, wide = L.land, sc = TEXT_SCALES[state.settings.textIdx];
  const one = (widgets, o = {}) => ({ parts: [{ widgets, x: L.flow.x, w: L.flow.w }], top: U.y0, bottom: U.y1, center: wide, ...o });
  switch (key) {
    case 'title': { const c = L.title.col; return { parts: [{ widgets: titleWidgets(state, c.w, L.title.wide), x: c.x, w: c.w }], top: c.top, bottom: c.bottom, center: true }; }
    case 'setup': {
      const bottom = L.setup.bottom;
      if (!wide) return { parts: [{ widgets: setupWidgets(state), x: L.flow.x, w: L.flow.w }], top: U.y0, bottom };
      if (L.cols3) {
        const [hd, r, o, ln] = setupWidgets(state, 3), [k0, k1, k2] = L.cols3;
        hd.push({ t: 'gap', h: backGap(L) });
        return { parts: [{ widgets: hd, x: L.flow.x, w: L.flow.w }, { cols: [{ widgets: r, x: k0.x, w: k0.w }, { widgets: o, x: k1.x, w: k1.w }, { widgets: ln, x: k2.x, w: k2.w }] }], top: U.y0, bottom, center: true };
      }
      const [hd, a, b] = setupWidgets(state, true), [c0, c1] = L.cols;
      hd.push({ t: 'gap', h: backGap(L) });
      return { parts: [{ widgets: hd, x: L.flow.x, w: L.flow.w }, { cols: [{ widgets: a, x: c0.x, w: c0.w }, { widgets: b, x: c1.x, w: c1.w }] }], top: U.y0, bottom, center: true };
    }
    case 'settings': {
      if (!wide) return one(settingsWidgets(state));
      const [hd, a, b] = settingsWidgets(state, true), [c0, c1] = L.cols;
      return { parts: [{ widgets: hd, x: L.flow.x, w: L.flow.w }, { cols: [{ widgets: a, x: c0.x, w: c0.w }, { widgets: b, x: c1.x, w: c1.w }] }], top: U.y0, bottom: U.y1, center: true };
    }
    case 'learn': {
      if (!wide) return one(learnWidgets(state));
      const [head, les, foot] = learnWidgets(state, true), [c0, c1] = L.cols, half = Math.ceil(les.length / 2);
      return { parts: [{ widgets: head, x: L.flow.x, w: L.flow.w }, { cols: [{ widgets: les.slice(0, half), x: c0.x, w: c0.w }, { widgets: les.slice(half), x: c1.x, w: c1.w }] }, { widgets: foot, x: L.flow.x, w: L.flow.w }], top: U.y0, bottom: U.y1, center: true };
    }
    case 'result': return one(resultWidgets(state, wide), { bottom: U.y1 - 56 });
    case 'demolimit': return one(demoLimitWidgets(wide));
    case 'lesson': return one(lessonWidgets(state));
    case 'quiz': return one(quizWidgets(state));
    case 'lessonresult': return one(lessonResultWidgets(state, wide));
    default: return null;
  }
}
function placeFlow(ctx, key, state) {
  const d = flowDef(ctx, key, state);
  if (!d) return null;
  UI.minf = curL(state).minf; UI.minb = curL(state).minb;
  const lay = stack(ctx, d.parts, TEXT_SCALES[state.settings.textIdx]);
  let top = d.top;
  const room = d.bottom - d.top;
  if (d.center && lay.contentH < room) top = d.top + (room - lay.contentH) / 2;
  return { key, lay, top, bottom: d.bottom, win: d.top, h: lay.contentH };
}
export function ensureLayout(state, key) {
  const L = curL(state);
  if (LAID.key === key && LAID.lay && LAID.lkey === L.key) return;
  const p = placeFlow(estCtx, key, state);
  if (!p) return;
  LAID = { ...p, lkey: L.key };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

// the title art: used as a flow widget on portrait screens, drawn on the left on landscape ones
function drawHero(ctx, cx, y0, w) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const k = Math.min(1, w / 640);
  ctx.font = `700 ${Math.round(34 * k)}px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('SEVEN A SIDE', cx, y0 + 92 * k);
  ctx.font = `800 ${Math.round(128 * k)}px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Football', cx, y0 + 220 * k);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = '#e2503c'; roundPath(ctx, cx - 120 * k, y0 + 246 * k, 240 * k, 8 * k, 4); ctx.fill();
  ctx.restore();
}
const heroArt = () => { const hk = H < 1200 ? 0.8 : 1; return { t: 'art', h: Math.round(330 * hk), draw(ctx, w) { ctx.save(); ctx.scale(hk, hk); drawHero(ctx, w / hk / 2, 0, w / hk); ctx.restore(); } }; };
export function titleWidgets(state, colW, wide = false) {
  const sv = state.saved;
  return [
    ...(wide ? [] : [heroArt()]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.roleName} · ${sv.score[0]}-${sv.score[1]} · ${sv.half === 1 ? '1st' : '2nd'} half`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: H < 1200 ? 72 : 88 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Short drills for every role' },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two computer teams play while you learn why' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

// split: false = one column; true = [head, left, right]; 3 = [head, role, opponent, length]
export function setupWidgets(state, split = false) {
  const s = state.setup, demo = state.demo, watch = s.watch;
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: watch ? 'Watch & Learn' : 'New match', size: 48 }];
  const left = split ? [] : head, right = [], third = [];
  if (!watch) {
    left.push({ t: 'p', label: 'Your role (kept for the whole match)', bold: true, color: '#ffe9a0', size: 26 });
    CHOICES.forEach((c) => left.push({ t: 'btn', id: `role-${c.id}`, label: c.name, sub: c.blurb, active: s.role === c.id, h: 96 }));
    if (s.role === 'W' || s.role === 'D') {
      left.push({ t: 'p', label: 'Which side?', bold: true, color: '#ffe9a0', size: 24 });
      left.push({ t: 'btn', id: 'side-L', label: 'Left', row: 8, active: s.side === 'L' });
      left.push({ t: 'btn', id: 'side-R', label: 'Right', row: 8, active: s.side === 'R' });
    }
    left.push({ t: 'btn', id: 'roleguide', label: 'Role guide', sub: 'What this role does and its controls', dark: true });
  }
  const oc = split && !watch ? right : left;
  oc.push({ t: 'p', label: watch ? 'Blue team (plays towards the far goal)' : 'Opponent', bold: true, color: '#ffe9a0', size: 26 });
  LEVELS.forEach((l, i) => {
    const locked = demo && i > 1 && !watch;
    oc.push({ t: 'btn', id: watch ? `wa${i + 1}` : `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: (watch ? s.watchA : s.opp) === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 84 });
  });
  const oc2 = split && watch ? right : oc;
  if (watch) { oc2.push({ t: 'p', label: 'Red team', bold: true, color: '#ffe9a0', size: 24 }); LEVELS.forEach((l, i) => oc2.push({ t: 'btn', id: `wb${i + 1}`, label: l.name, active: s.watchB === i + 1, h: 70 })); }
  const lc = split === 3 ? third : split && !watch ? right : split ? right : left;
  lc.push({ t: 'p', label: 'Length of each half', bold: true, color: '#ffe9a0', size: 26 });
  HALF_OPTIONS.forEach((h) => lc.push({ t: 'btn', id: `half${h}`, label: `${h / 60} min`, row: 9, active: s.half === h && !(demo && h > 120), disabled: demo && h > 120, hitDisabled: true }));
  left.push({ t: 'gap', h: 24 }); right.push({ t: 'gap', h: 24 }); third.push({ t: 'gap', h: 24 });
  if (split === 3) return [head, left, right, third];
  return split ? [head, left, right] : left;
}

export function settingsWidgets(state, split = false) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const all = [
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
  if (!split) return all;
  const i = all.findIndex((w) => w.id === 'set-tags');
  return [all.slice(0, 2), all.slice(2, i), all.slice(i)];
}

const pct = (a, b) => (a + b > 0 ? Math.round((100 * a) / (a + b)) : 50);
export function resultWidgets(state, wide = false) {
  const s = state.sim, st = s.stats;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const mode = state.mode;
  const win = s.winner;
  const names = state.teamNames;
  const title = mode === 'watch' ? (win < 0 ? 'A draw' : `${names[win]} win`) : win === 0 ? 'You win!' : win < 0 ? 'A draw' : `${names[1]} win`;
  const wd = [{ t: 'gap', h: wide ? 10 : big ? 24 : 110 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
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

export function pauseWidgets(state, split = false) {
  const st = state.settings;
  const all = [
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
  if (!split) return all;
  const i = all.findIndex((w) => w.id === 'p-role'), q = all.length - 1;
  return [[all[0], all[1], all[q]], all.slice(i, q)];
}

export function demoLimitWidgets(wide = false) {
  return [
    { t: 'gap', h: wide ? 20 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every role, every level, longer halves, all the Learn drills and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state, split = false) {
  const done = state.learn.done;
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 }, { t: 'p', label: 'Six short practice drills on the real pitch, then a rules quiz.', size: 26 }];
  const les = LESSONS.map((l, i) => ({ t: 'btn', id: `lesson${i}`, label: l.title, sub: done[l.id] ? `Done · ${l.goal}` : l.goal, active: !!done[l.id], h: 96 }));
  const foot = [{ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 }];
  return split ? [head, les, foot] : [...head, ...les, ...foot];
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
export function lessonResultWidgets(state, wide = false) {
  const l = LESSONS[state.learn.cur], r = state.learn.result;
  return [
    { t: 'gap', h: wide ? 10 : 120 }, { t: 'h', label: r.pass ? 'Lesson complete' : 'Not quite yet', size: 52 },
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
  const cx = x0 + w / 2, fs = Math.max(UI.minf, 22), bw = Math.round(fs * 4), bh = Math.round(fs * 1.45);
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(1, 'rgba(6,14,26,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - bw / 2, bottom - bh - 8, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - bh / 2 - 8);
  } else if (scroll > 4) {
    roundPath(ctx, cx - bw / 2, top + 8, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 8 + bh / 2);
  }
}
function drawFlowScreen(ctx, state, key) {
  const L = curL(state), p = placeFlow(ctx, key, state);
  LAID = { ...p, lkey: L.key };
  const { lay, top, bottom } = p;
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, L.U.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
let NOGL = false;
export const setNoGL = (v) => { NOGL = !!v; };
const clear = (ctx) => { if (!NOGL) ctx.clearRect(0, 0, W, H); };
export const dropLayout = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; };
const bg = (ctx, a) => { clear(ctx); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  const L = curL(state);
  clear(ctx);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(6,14,26,0.15)'); g.addColorStop(0.35, 'rgba(6,14,26,0.45)'); g.addColorStop(1, 'rgba(6,14,26,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (L.title.wide) {
    // landscape: a dark panel behind the buttons keeps them readable over the court, the art stands on the left
    const c = L.title.col, hr = L.title.hero, k = Math.min(1, hr.w / 640);
    const gl = ctx.createLinearGradient(c.x - 70, 0, c.x - 10, 0); gl.addColorStop(0, 'rgba(6,14,26,0)'); gl.addColorStop(1, 'rgba(6,14,26,0.55)');
    ctx.fillStyle = gl; ctx.fillRect(c.x - 70, 0, 60, H); ctx.fillStyle = 'rgba(6,14,26,0.55)'; ctx.fillRect(c.x - 10, 0, W - c.x + 10, H);
    drawHero(ctx, hr.cx, hr.cy - 200 * k, hr.w);
  }
  drawFlowScreen(ctx, state, 'title');
  {   // themed lockup: bottom centre, directly under the last row of menu buttons (pinned to the bottom when the menu scrolls)
    const c = L.title.col, btns = LAID.lay.items.filter((i) => i.w && i.w.t === 'btn'), lcx = c.x + c.w / 2;
    const lw = Math.min(320, c.w - 40), lh = Math.round(lw * 327 / 1200);
    const ly = Math.min(L.U.y1 - lh - 14, LAID.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20);
    const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
    titleLockTap = { x: lcx - tw / 2, y: ly + lh + 6 - th, w: tw, h: th };
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(6,14,26,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
    if (lockup && lockup.width) ctx.drawImage(lockup, lcx - lw / 2, ly, lw, lh);
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(UI.minf, 18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', L.land ? L.title.hero.cx : W / 2, L.lockup.y - 10); }
}
export function renderSetup(ctx, state) {
  const L = curL(state), S = L.setup;
  bg(ctx, 0.78);
  drawFlowScreen(ctx, state, 'setup');
  const y0 = S.bottom - 30;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(0.2, 'rgba(6,14,26,0.88)'); g.addColorStop(1, 'rgba(6,14,26,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  drawButton(ctx, S.start, state.setup.watch ? 'Watch the match' : 'Kick off', { primary: true, size: 32 });
  drawButton(ctx, S.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(UI.minf, 22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, S.msgY); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings'); };
export const renderResult = (ctx, state) => {
  clear(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result');
  const L = curL(state); drawMoreLine(ctx, L.more.x, L.more.y, Math.max(UI.minf, 20));
};
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit'); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'learn'); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lesson'); };
export const renderQuiz = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'quiz'); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult'); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const L = curL(state), P = L.pause, sc = TEXT_SCALES[state.settings.textIdx];
  UI.minf = L.minf; UI.minb = L.minb;
  const inner = P.w - 60;
  let lay;
  if (P.cols) { const [a, b] = pauseWidgets(state, true), cw = (inner - 30) / 2; lay = stack(ctx, [{ cols: [{ widgets: a, x: P.x + 30, w: cw }, { widgets: b, x: P.x + 30 + cw + 30, w: cw }] }], sc); }
  else lay = stack(ctx, [{ widgets: pauseWidgets(state), x: P.x + 30, w: inner }], sc);
  const top = P.top + 40, bottom = P.bottom - 40;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, P.x, y0 - 20, P.w, ch + 40, { r: 30, fill: 'rgba(14,34,52,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH, lkey: L.key };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { x0: P.x, w: P.w });
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, P.x, P.w);
}

// ---- reference pages: one continuous column that scrolls (drag, wheel, keys) with a visible scroll bar -------------------------
const DOC = { max: 0, view: 800, step: 730, h: 0, lastLine: 0, top: 0, bottom: 800, rect: { x: 0, y: 0, w: 0, h: 0 } };
export const docMeta = () => ({ ...DOC });
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function buildDoc(ctx, list, scale, box) {
  const fs = Math.max(11, Math.round(28 * scale)), lh = fs * 1.28, tw = box.w - 56;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = []; let y = 14, lastLine = 0;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 6 }); y += 14; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs }); y += tl.length * secFs * 1.2 + 16;
    const artH = sec.art && scale < 2 ? 230 : 0;
    if (artH) { items.push({ k: 'art', y, h: artH - 12, art: sec.art }); y += artH; }
    y += 10;
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l, fs }); lastLine = y; y += lh; });
    });
    y += 22;
  });
  return { items, h: y + 10, fs, lh, lastLine };
}
const docCache = new Map();
export function renderPages(ctx, state, list, header) {
  const L = curL(state), rd = L.reader, P = rd.panel, BOX = rd.box;
  UI.minf = L.minf; UI.minb = L.minb;
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}:${list[0] ? list[0].title : ''}:${Math.round(BOX.w)}`;
  let doc = docCache.get(pkey);
  if (!doc) { doc = buildDoc(ctx, list, sc, BOX); docCache.set(pkey, doc); if (docCache.size > 40) docCache.delete(docCache.keys().next().value); }
  const view = BOX.h, max = Math.max(0, doc.h - view);
  if (state.ui.keepFrac != null) { state.ui.scroll = state.ui.keepFrac * max; state.ui.keepFrac = null; }
  const scroll = clamp(state.ui.scroll, 0, max); state.ui.scroll = scroll;
  Object.assign(DOC, { max, view, step: Math.max(100, view - 70), h: doc.h, lastLine: doc.lastLine, top: BOX.y, bottom: BOX.y + BOX.h, rect: BOX });
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  const pcx = P.x + P.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, pcx, P.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, P.y + 78); ctx.lineTo(P.x + P.w - 60, P.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(BOX.x, BOX.y, BOX.w, BOX.h); ctx.clip();
  const x0 = BOX.x + 28;
  for (const it of doc.items) {
    const y = BOX.y + it.y - scroll;
    const hh = it.k === 'title' ? it.lines.length * it.fs * 1.2 : it.k === 'art' ? it.h : it.k === 'line' ? doc.lh : 4;
    if (y > BOX.y + BOX.h + 4 || y + hh < BOX.y - 4) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 80, y); ctx.lineTo(P.x + P.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`; it.lines.forEach((l, k) => ctx.fillText(l, BOX.x + (BOX.w - 14) / 2, y + it.fs * (0.9 + k * 1.2))); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(P.x + 20, y, P.w - 40, it.h + 4); ctx.clip(); drawArt(it.art, ctx, P.x + 40, y, P.w - 80, it.h); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, x0, y + it.fs * 0.85); }
  }
  ctx.restore();
  drawScrollBar(ctx, BOX, scroll, max);
  if (max > 0 && scroll < max - 4) {
    const g = ctx.createLinearGradient(0, BOX.y + BOX.h - 60, 0, BOX.y + BOX.h); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)');
    ctx.fillStyle = g; ctx.fillRect(BOX.x, BOX.y + BOX.h - 60, BOX.w - 14, 60);
  }
  drawButton(ctx, rd.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, rd.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.max(L.minf, 24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, rd.pct.x, rd.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, rd.back, scroll <= 2 ? 'Close' : 'Up', { size: 32 });
  drawButton(ctx, rd.next, scroll >= max - 2 ? 'Done' : 'Down', { primary: true, size: 32 });
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
// Captions stay inside the illustration box (ARTBOX is set by drawArt): never clipped at an edge, never over the heading above.
let ARTBOX = null;
function label(ctx, t, x, y, size = 18, col = '#fff6e4', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
  if (ARTBOX) {
    const tw = ctx.measureText(t).width, l = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const cl = Math.max(ARTBOX.x0, Math.min(ARTBOX.x1 - tw, l));
    x = align === 'center' ? cl + tw / 2 : align === 'right' ? cl + tw : cl; y = Math.max(ARTBOX.y0, Math.min(ARTBOX.y1, y));
  }
  ctx.fillText(t, x, y); ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ARTBOX = { x0: x + 8, x1: x + w - 8, y0: y + 20, y1: y + h - 6 };
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
      const cx = x + 100, cy = y + h / 2 - 12;
      ctx.beginPath(); ctx.arc(cx, cy, 58, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,246,228,0.5)'; ctx.lineWidth = 3; ctx.stroke(); dot(ctx, cx + 14, cy - 12, '#fff6e4', 24); label(ctx, 'MOVE', cx, cy + 86, 18);
      const bs = [['A', 0, 0, 40, '#e2503c'], ['B', -98, 40, 32, '#1f9d8f'], ['C', -40, 86, 28, '#1f9d8f'], ['D', 52, 76, 26, '#1f9d8f']];
      const bx = x + w - 130, by = y + 78;
      bs.forEach(([t, dx, dy, r, col]) => { dot(ctx, bx + dx, by + dy, col, r); label(ctx, t, bx + dx, by + dy + 6, 18, '#fff'); });
      label(ctx, 'with the ball: shoot, pass, lob, through', x + w / 2, y + 30, 16); label(ctx, 'without: tackle, slide, call', x + w / 2, y + h - 8, 16);
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
  ARTBOX = null; ctx.restore();
}
