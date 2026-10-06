// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the paginated About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, G, host, PANEL, READER, clampN } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, FLOOR, fl } from './ui.js';
import { LEVELS } from './consts.js';
import { LESSONS, QUIZ } from './content.js';
import { drawLockupH, lockupSize, drawMoreLine } from './brand.js';
export { readerMeta } from './layout.js';

const TAU = Math.PI * 2;
const LOCK_H = 64;
const LOCK_STRIP = LOCK_H + 26;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
let LAID = { key: '', lay: null, top: 0, bottom: 0, sk: '', tk: -1 };
export const flowMeta = () => LAID;
export const resetLayout = () => { LAID = { key: '', lay: null, top: 0, bottom: 0, sk: '', tk: -1 }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// Where each flow screen sits: a centred column (portrait: 640 wide; landscape: narrower or wider by screen), the title in landscape keeps its buttons on the right.
function titleParams(state) {
  const F = G.flow, U = G.U;
  if (G.land) {
    const cut = Math.round(U.x0 + U.w * 0.44), w = clampN(U.x1 - cut - 56, 360, 540), x = (cut + U.x1) / 2 - w / 2;
    return { wide: true, cut, x, w, heroH: 0, topGap: 0 };
  }
  const B = flowLayout(estCtx, titleWidgets(state, { bare: true }), TEXT_SCALES[state.settings.textIdx], { x: F.x1, w: F.w1, bk: F.bk }).contentH;
  const avail = F.bottom - F.top - LOCK_STRIP;
  const heroH = clampN(avail - B - 24, 250, 400), extra = Math.max(0, avail - heroH - B - 24);
  return { wide: false, cut: 0, x: F.x1, w: F.w1, heroH, topGap: Math.min(extra * 0.5, 200) };
}
function geom(key, state) {
  const F = G.flow, o = { top: F.top, bottom: F.bottom, x: F.x1, w: F.w1, bk: F.bk };
  if (key === 'setup') { o.x = F.x2; o.w = F.w2; o.bottom = F.setupBottom; }
  else if (key === 'title') { const T = titleParams(state); o.x = T.x; o.w = T.w; o.bottom = F.bottom - LOCK_STRIP; }
  return o;
}
const DEFS = { title: titleWidgets, setup: setupWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, learn: learnWidgets, lesson: lessonWidgets, quiz: quizWidgets, lessonresult: lessonResultWidgets };
export function ensureLayout(state, key) {
  const tk = state.settings.textIdx;
  if (LAID.key === key && LAID.lay && LAID.sk === G.key && LAID.tk === tk) return;
  const d = DEFS[key];
  if (!d) return;
  const o = geom(key, state);
  const lay = flowLayout(estCtx, d(state), TEXT_SCALES[tk], { x: o.x, w: o.w, bk: o.bk });
  LAID = { key, lay, top: o.top, bottom: o.bottom, h: lay.contentH, sk: G.key, tk };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

// The title block (400 units high, drawn scaled by k and centred on cx): tagline, the two-line name and the small themed Arcforge lockup.
function drawHero(ctx, cx, y0, k) {
  ctx.save(); ctx.translate(cx, y0); ctx.scale(k, k);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.max(40, Math.ceil(FLOOR.v / k))}px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('KICK VOLLEYBALL', 0, 76);
  ctx.font = `700 118px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Sepak', 0, 190); ctx.fillText('Takraw', 0, 300);
  ctx.shadowColor = 'transparent';
  ctx.restore();
}
const heroArt = (h) => ({ t: 'art', h, draw(ctx, w) { drawHero(ctx, w / 2, 0, Math.min(1, h / 400)); } });
// Quiet brand line on a result screen: "More heritage games in Arcforge" (text only).
const moreLine = () => ({ t: 'art', h: 44, draw(ctx, w) { drawMoreLine(ctx, w / 2, 30, Math.max(20, Math.ceil(FLOOR.v))); } });

export function titleWidgets(state, o = {}) {
  const sv = state.saved;
  const P = o.bare ? null : titleParams(state);
  return [
    ...(o.bare || P.wide ? [] : [{ t: 'gap', h: P.topGap }, heroArt(P.heroH)]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.oppName} · Set ${sv.setNo} · ${sv.pts[0]}-${sv.pts[1]}`, primary: true, h: G.land ? 66 : 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: G.land ? 66 : 88 },
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
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5 || G.land;
  const win = m.winner;
  const mode = state.setup.lastMode;
  const youWin = win === 0 && st[0].human;
  const title = mode === 'watch' ? `${st[win].name} win` : st[1].human ? `${win === 0 ? 'Player 1' : 'Player 2'} wins` : youWin ? 'You win the match!' : `${st[win].name} win`;
  const wd = [{ t: 'gap', h: big ? 24 : 110 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${m.sets[0]} – ${m.sets[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  const ss = m.history.length;
  const l1 = `Rallies: ${ss}. Your aces ${m.stats[0].aces}, spike points ${m.stats[0].kills}, blocks ${m.stats[0].blocks}, errors ${m.stats[0].errors}.`;
  wd.push({ t: 'p', label: l1, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 10 }, moreLine());
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
    ctx.fillStyle = C.ink; ctx.font = `700 ${fl(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${fl(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom, o = {}) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const gm = geom(key, state);
  const x = o.x ?? gm.x, w = o.w ?? gm.w;
  const lay = flowLayout(ctx, widgets, sc, { x, w, bk: gm.bk });
  LAID = { key, lay, top, bottom, h: lay.contentH, sk: G.key, tk: state.settings.textIdx };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - Math.max(10, host.r + 6), ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, x, w);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(0, 0, W, H); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  ctx.clearRect(0, 0, W, H);
  const T = titleParams(state), F = G.flow;
  if (T.wide) {
    // landscape: the live court on the left under a light shade, the title block in the left half, the buttons in a panel on the right
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(6,14,26,0.55)'); g.addColorStop(0.45, 'rgba(6,14,26,0.25)'); g.addColorStop(0.55, 'rgba(6,14,26,0.6)'); g.addColorStop(1, 'rgba(6,14,26,0.88)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const k = Math.min(1, (T.cut - G.U.x0 - 24) / 440, (H - 60) / 400);
    drawHero(ctx, (G.U.x0 + T.cut) / 2, (H - 400 * k) / 2, k);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(6,14,26,0.15)'); g.addColorStop(0.35, 'rgba(6,14,26,0.45)'); g.addColorStop(1, 'rgba(6,14,26,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), F.top, F.bottom - LOCK_STRIP);
  {   // themed lockup: bottom centre, directly under the last row of menu buttons (pinned to the bottom when the menu scrolls)
    const btns = LAID.lay.items.filter((i) => i.w.t === 'btn'), lcx = T.x + T.w / 2;
    const ly = Math.min(F.bottom - LOCK_H - 6, LAID.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20);
    const lw = lockupSize(LOCK_H) || Math.round(LOCK_H * 3.67), m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(LOCK_H + 12, m);
    titleLockTap = { x: lcx - tw / 2, y: ly + LOCK_H + 6 - th, w: tw, h: th };
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(6,14,26,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, LOCK_H + 12, (LOCK_H + 12) / 2); ctx.fill(); ctx.restore();
    drawLockupH(ctx, lcx, ly, LOCK_H);
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${fl(18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - Math.max(14, host.b + 6)); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  const F = G.flow;
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), F.top, F.setupBottom);
  const y0 = F.setupBottom - 30;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(0.2, 'rgba(6,14,26,0.88)'); g.addColorStop(1, 'rgba(6,14,26,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  drawButton(ctx, SETUP_PINS.start, state.setup.watch ? 'Watch the match' : 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${fl(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, SETUP_PINS.start.y - 12); }
}
const flowScr = (key, widgets, a) => (ctx, state) => { if (a < 0) { ctx.clearRect(0, 0, W, H); scrim(ctx, 0.62); } else bg(ctx, a); drawFlowScreen(ctx, state, key, widgets(state), G.flow.top, G.flow.bottom); };
export const renderSettings = flowScr('settings', settingsWidgets, 0.8);
export const renderResult = flowScr('result', resultWidgets, -1);
export const renderDemoLimit = flowScr('demolimit', demoLimitWidgets, 0.8);
export const renderLearn = flowScr('learn', learnWidgets, 0.8);
export const renderLesson = flowScr('lesson', lessonWidgets, 0.8);
export const renderQuiz = flowScr('quiz', quizWidgets, 0.8);
export const renderLessonResult = flowScr('lessonresult', lessonResultWidgets, 0.8);
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(W - 60, G.land ? 720 : 660), px = (W - pw) / 2, bk = G.flow.bk;
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60, bk });
  const top = Math.max(G.land ? 14 : 70, host.t + 10), bottom = H - Math.max(G.land ? 14 : 70, host.b + 10);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, Math.min((H - ch) / 2, bottom - ch));
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(14,34,52,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH, sk: G.key, tk: state.settings.textIdx };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { x0: px, w: pw });
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px, pw);
}

// ---- reference pages: one continuous, scrollable document (About / How to Play / Rules) -------------------------------------------------------------
// The text is laid out once per text size as a tall column and drawn through a window (drag, wheel, keys, Next/Back scroll it), so any text size fits.
const ART_H = 230;
function buildDoc(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = Math.round(fs * 1.28), tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 14;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 6 }); y += 30; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), th = tl.length * secFs * 1.2 + 14;
    items.push({ k: 'title', y, lines: tl, h: th }); y += th;
    if (sec.art) { items.push({ k: 'art', y, key: sec.art }); y += ART_H; }
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gap: k === 0 && pi > 0 })); });
    lines.forEach((l, k) => { if (l.gap && k > 0) y += lh * 0.45; items.push({ k: 'line', y, text: l.text }); y += lh; });
    y += 14;
  });
  return { items, contentH: y + 8, fs, lh, secFs };
}
const docCache = new Map();
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}:${list.length}`;
  let doc = docCache.get(pkey);
  if (!doc) { doc = buildDoc(ctx, list, sc); docCache.set(pkey, doc); if (docCache.size > 24) docCache.delete(docCache.keys().next().value); }
  const R = READER;
  R.max = Math.max(0, doc.contentH - R.h);
  if (state.ui.keepFrac != null) { state.ui.scroll = state.ui.keepFrac * R.max; state.ui.keepFrac = null; }
  state.ui.scroll = Math.max(0, Math.min(R.max, state.ui.scroll));
  const scroll = state.ui.scroll;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const pcx = PANEL.x + PANEL.w / 2;
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  for (const it of doc.items) {
    const y = R.y + it.y - scroll;
    if (it.k === 'line') {
      if (y > R.y + R.h || y + doc.lh < R.y) continue;
      ctx.fillStyle = C.ink; ctx.font = `400 ${doc.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + doc.fs * 0.85);
    } else if (it.k === 'title') {
      if (y > R.y + R.h || y + it.h < R.y) continue;
      ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${doc.secFs}px ${FONT}`;
      it.lines.forEach((l, k) => ctx.fillText(l, pcx, y + doc.secFs * (0.9 + k * 1.2) - 4));
    } else if (it.k === 'rule') {
      ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke();
    } else if (it.k === 'art') {
      if (y > R.y + R.h || y + ART_H < R.y) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, ART_H - 6); ctx.clip(); drawArt(it.key, ctx, PANEL.x + 40, y, PANEL.w - 80, ART_H - 14); ctx.restore();
    }
  }
  ctx.restore();
  if (R.max > 0) {
    // scroll bar, a fade and a "more" / "up" pill so it is obvious that the text goes on
    const th = Math.max(60, R.h * (R.h / doc.contentH)), ty = R.y + (scroll / R.max) * (R.h - th);
    roundPath(ctx, PANEL.x + PANEL.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(19,40,58,0.5)'; ctx.fill();
    const cx = pcx;
    if (scroll < R.max - 4) {
      const g = ctx.createLinearGradient(0, R.y + R.h - 80, 0, R.y + R.h); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.96)');
      ctx.fillStyle = g; ctx.fillRect(R.x + 4, R.y + R.h - 80, R.w - 24, 78);
      roundPath(ctx, cx - 56, R.y + R.h - 44, 112, 34, 17); ctx.fillStyle = 'rgba(19,40,58,0.88)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${fl(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, R.y + R.h - 26);
    }
    if (scroll > 4) {
      const g2 = ctx.createLinearGradient(0, R.y, 0, R.y + 56); g2.addColorStop(0, 'rgba(255,246,228,0.97)'); g2.addColorStop(1, 'rgba(255,246,228,0)');
      ctx.fillStyle = g2; ctx.fillRect(R.x + 4, R.y, R.w - 24, 56);
      roundPath(ctx, cx - 44, R.y + 6, 88, 34, 17); ctx.fillStyle = 'rgba(19,40,58,0.88)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${fl(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, R.y + 23);
    }
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${fl(24)}px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, G.zoomLabel.x, G.zoomLabel.y);
  const atEnd = R.max <= 0 || scroll >= R.max - 4, bsz = G.land ? 28 : 32;
  drawButton(ctx, REF_BACK, 'Back', { size: bsz });
  drawButton(ctx, REF_NEXT, atEnd ? 'Done' : 'Next page', { primary: true, size: bsz });
}

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
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${Math.max(size, Math.ceil(FLOOR.v))}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(19,40,58,0.92)'; ctx.fill();
  const B = courtBox(ctx, x, y, w, h);
  const A = {
    court() { drawCourt(ctx, B); label(ctx, 'net', B.x0 + B.w + 26, B.pz(0) + 6, 16); label(ctx, '6.1 m', B.x0 - 8, B.y0 + 16, 16, '#fff6e4', 'right'); for (const [px, pz, c] of [[0, -4.25, '#e44'], [-2.3, -2.2, '#e44'], [2.3, -2.2, '#e44'], [0, 4.25, '#37c'], [-2.3, 2.2, '#37c'], [2.3, 2.2, '#37c']]) dot(ctx, B.px(px), B.pz(pz), c); },
    serve() { drawCourt(ctx, B); dot(ctx, B.px(0), B.pz(-4.25), '#e44'); dot(ctx, B.px(2.6), B.pz(-0.7), '#e44'); arrow(ctx, B.px(2.4), B.pz(-0.8), B.px(0.2), B.pz(-4.0), '#fff', 3); arrow(ctx, B.px(0), B.pz(-4.25), B.px(-1.8), B.pz(5.4), '#ffc94d', 5); dot(ctx, B.px(-1.8), B.pz(5.4), '#ffc94d', 6); },
    receive() { drawCourt(ctx, B); dot(ctx, B.px(0), B.pz(-4.5), '#e44'); dot(ctx, B.px(-1.6), B.pz(-2.0), '#e44'); dot(ctx, B.px(1.6), B.pz(-1.6), '#e44'); arrow(ctx, B.px(0.4), B.pz(-4.2), B.px(-1.3), B.pz(-2.2), '#fff', 3); arrow(ctx, B.px(-1.5), B.pz(-2.2), B.px(1.5), B.pz(-1.0), '#fff', 3); arrow(ctx, B.px(1.6), B.pz(-1.8), B.px(0.5), B.pz(3.6), '#ffc94d', 5); label(ctx, '1', B.px(0), B.pz(-4.9), 16); label(ctx, '2', B.px(-2.3), B.pz(-2.0), 16); label(ctx, '3', B.px(2.3), B.pz(-1.4), 16); },
    set() { drawCourt(ctx, B); dot(ctx, B.px(-1, ), B.pz(-2.3), '#e44'); for (const lat of [-2, 0, 2]) { dot(ctx, B.px(lat), B.pz(-0.95), 'rgba(255,201,77,0.9)', 7); } arrow(ctx, B.px(-1), B.pz(-2.3), B.px(1.9), B.pz(-1.1), '#fff', 3); label(ctx, 'L', B.px(2), B.pz(-0.2), 15); label(ctx, 'M', B.px(0), B.pz(-0.2), 15); label(ctx, 'R', B.px(-2), B.pz(-0.2), 15); dot(ctx, B.px(-1.0), B.pz(1.0), '#37c'); dot(ctx, B.px(1.4), B.pz(1.0), '#37c'); },
    attack() { drawCourt(ctx, B); dot(ctx, B.px(1.8), B.pz(-1.1), '#e44'); dot(ctx, B.px(1.4), B.pz(0.8), '#37c'); dot(ctx, B.px(-1.0), B.pz(2.6), '#37c'); dot(ctx, B.px(0), B.pz(4.6), '#37c'); arrow(ctx, B.px(1.8), B.pz(-1.1), B.px(-2.0), B.pz(5.4), '#ffc94d', 5); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(B.px(-2.0), B.pz(5.4), 12, 0, TAU); ctx.stroke(); label(ctx, 'open corner', B.px(-2.0) - 22, B.pz(5.4) + 5, 15, '#ffe9a0', 'right'); },
    block() { drawCourt(ctx, B); dot(ctx, B.px(1.2), B.pz(0.7), '#37c'); dot(ctx, B.px(-0.4), B.pz(0.7), '#37c'); dot(ctx, B.px(0), B.pz(4.6), '#37c'); dot(ctx, B.px(0.4), B.pz(-1.0), '#e44'); arrow(ctx, B.px(0.4), B.pz(-1.1), B.px(0.7), B.pz(0.5), '#ffc94d', 4); label(ctx, 'double block', B.x0 + B.w + 14, B.pz(0.9) + 5, 15, '#ffe9a0', 'left'); },
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
