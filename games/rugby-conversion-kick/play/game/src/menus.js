// Every screen that is not the play screen: title, ladder, shootout and practice set-up, learn, settings, result, pause and the paginated About /
// How to Play / Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, THINK_STEPS, colGeom, readerLayout, setupPins, host, isWide, minFont } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { GOAL_HW, BAR_H, TILTS, VMAX, RUN_Q, BEATS, LEVELS, GROUNDS, RIVALS, SHOOTOUT_KICKS } from './consts.js';
import { LESSONS, QUIZ } from './content.js';
import { flightSim, windAt } from './sim.js';
import { windowDeg } from './ai.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const LOCKUP_H = 70, LOCK_STRIP = LOCKUP_H + 30;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
function geomFor(key) {
  const c = colGeom(), wide = c.wide, hk = wide ? 0.82 : 1;
  if (key === 'title') {
    if (!wide) return { x: c.x, w: c.w, top: host.t, bottom: H - host.b - LOCK_STRIP, hk: H < 1100 ? 0.86 : 1, wide };
    const cw = Math.min(560, Math.round(W * 0.4)), x = W - host.r - 40 - cw;
    return { x, w: cw, top: host.t + 12, bottom: H - host.b - LOCK_STRIP, hk, wide, heroCx: Math.round((x - 20) / 2) };
  }
  if (key === 'practice') return { x: c.x, w: c.w, top: host.t, bottom: setupPins().start.y - 26, hk, wide };
  return { x: c.x, w: c.w, top: host.t, bottom: H - host.b, hk, wide };
}
const WIDGETS = { title: titleWidgets, ladder: ladderWidgets, shootout: shootoutWidgets, practice: practiceWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, learn: learnWidgets, lesson: lessonWidgets, quiz: quizWidgets, lessonresult: lessonResultWidgets };
export function ensureLayout(state, key) {
  const wf = WIDGETS[key];
  if (!wf) return;
  const sig = `${W}x${H}|${state.settings.textIdx}|${host.t},${host.b},${host.l},${host.r}|${state.sig || ''}`;
  if (LAID.key === key && LAID.lay && LAID.sig === sig) return;
  const g = geomFor(key);
  const lay = flowLayout(estCtx, wf(state, g.wide), TEXT_SCALES[state.settings.textIdx], { x: g.x, w: g.w, hk: g.hk });
  LAID = { key, lay, top: g.top, bottom: g.bottom, h: lay.contentH, sig };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = (k = 1) => {
  const d = host.back ? Math.max(0, Math.round((host.back + 14 / Math.max(0.05, host.px) + 6) / k - 52)) : 0;
  return {
    t: 'art', h: Math.round((380 + d) * k),
    draw(ctx, w) {
      ctx.save(); ctx.scale(k, k); ctx.translate(0, d); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const cx = w / k / 2;
      ctx.font = `800 36px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      ctx.fillText('THE GOAL-KICKER\'S CRAFT', cx, 90);
      ctx.font = `italic 800 112px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      ctx.fillText('RUGBY', cx, 206);
      ctx.font = `italic 800 74px ${DISPLAY}`; ctx.fillStyle = '#ffd34d';
      ctx.fillText('CONVERSION', cx, 290);
      ctx.restore();
    },
  };
};

export function titleWidgets(state, wide = false) {
  const lad = state.ladder, next = lad.next;
  return [
    ...(wide ? [] : [heroArt(H < 1100 ? 0.78 : 1)]),
    { t: 'btn', id: 'ladder', label: 'Challenge Ladder', sub: lad.done >= LEVELS.length ? 'All 24 levels cleared' : `Level ${next + 1} next · ${lad.stars} stars`, primary: true, h: 88 },
    { t: 'btn', id: 'shootout', label: "Rivals' Shootout", sub: `${state.record.rivalsBeaten | 0} of 5 rivals beaten`, h: 80 },
    { t: 'btn', id: 'practice', label: 'Free Practice', row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn to play', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'A computer kicker explains every kick' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

export function ladderWidgets(state) {
  const lad = state.ladder, wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Challenge Ladder', size: 46 }, { t: 'p', label: 'Make 2 of 3 kicks to open the next level. Three goals earn three stars.', size: 24 }];
  GROUNDS.forEach((g, gi) => {
    wd.push({ t: 'p', label: g.name, bold: true, color: '#ffe9a0', size: 28 });
    LEVELS.filter((l) => l.tier === gi).forEach((l, k) => {
      const st = lad.starsOf[l.n - 1] | 0, locked = l.n - 1 > lad.done || (state.demo && l.n > 3);
      wd.push({ t: 'btn', id: `lvl${l.n}`, label: `Level ${l.n}`, sub: locked ? (state.demo && l.n > 3 ? 'In the full game' : 'Locked') : `${l.d} m · ${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : 'not yet'}`, row: 40 + gi * 2 + (k >> 1), active: st > 0, disabled: locked, hitDisabled: true, h: 80 });
    });
  });
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function shootoutWidgets(state) {
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: "Rivals' Shootout", size: 46 }, { t: 'p', label: `${SHOOTOUT_KICKS} kicks each in the same wind. Level scores go to sudden death.`, size: 24 }];
  RIVALS.forEach((r) => {
    const beaten = (state.record.beaten || {})[r.id], locked = state.demo && r.id > 1;
    wd.push({ t: 'btn', id: `riv${r.id}`, label: r.name, sub: locked ? 'In the full game' : `${r.blurb}${beaten ? '  ·  Beaten' : ''}`, stars: r.stars, active: !!beaten, disabled: locked, hitDisabled: true, h: 96 });
  });
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export const COMPASS = ['Tail-wind', 'Tail + right', 'From the left', 'Head + right', 'Head-wind', 'Head + left', 'From the right', 'Tail + left'];
export function practiceWidgets(state) {
  const p = state.prac;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Free Practice', size: 46 },
    { t: 'p', label: `Distance: ${p.d} m`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'd-', label: '−  Closer', row: 50, disabled: p.d <= 10 }, { t: 'btn', id: 'd+', label: '+  Farther', row: 50, disabled: p.d >= 48 },
    { t: 'p', label: `Side: ${p.sx === 0 ? 'on the middle line' : `${Math.abs(p.sx)} m ${p.sx < 0 ? 'left' : 'right'}`}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 's-', label: '◄  Left', row: 51, disabled: p.sx <= -30 }, { t: 'btn', id: 's+', label: 'Right  ►', row: 51, disabled: p.sx >= 30 },
    { t: 'p', label: `Wind speed: ${p.ws} m/s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'w-', label: '−  Calmer', row: 52, disabled: p.ws <= 0 }, { t: 'btn', id: 'w+', label: '+  Stronger', row: 52, disabled: p.ws >= 14 },
    { t: 'p', label: `Wind: ${COMPASS[p.dir]}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'a-', label: '↺  Turn', row: 53 }, { t: 'btn', id: 'a+', label: 'Turn  ↻', row: 53 },
    { t: 'btn', id: 'gust', label: p.gust ? 'Gusts: On' : 'Gusts: Off', active: p.gust, dark: !p.gust },
    { t: 'gap', h: 24 },
  ];
}
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Kicker: ${st.women ? 'Woman' : 'Man'}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'set-men', label: 'Man', row: 12, active: !st.women },
    { t: 'btn', id: 'set-women', label: 'Woman', row: 12, active: st.women },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}
export function resultWidgets(state) {
  const r = state.result || {}, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big || isWide() ? 24 : 110 }, { t: 'h', label: r.title || 'Done', size: 54, cap: big ? 1.15 : 1.4 }];
  if (r.stars != null) wd.push({ t: 'h', label: '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  if (r.big) wd.push({ t: 'h', label: r.big, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  for (const l of r.lines || []) wd.push({ t: 'p', label: l, size: 26, cap: big ? 2 : 3, bold: true });
  wd.push({ t: 'gap', h: 22 });
  for (const b of r.buttons || []) wd.push({ t: 'btn', id: b.id, label: b.label, primary: !!b.primary, dark: !!b.dark, row: b.row, h: b.primary ? 92 : undefined });
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
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function demoLimitWidgets() {
  return [
    { t: 'gap', h: isWide() ? 20 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have used the kicks of the web demo. The full game on iPhone and Android has all 24 ladder levels, every rival, lessons and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}
export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Short lessons on the real pitch. The coach\'s ghost arc is shown where it helps.', size: 26 },
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
    { t: 'gap', h: isWide() ? 20 : 120 }, { t: 'h', label: r.pass ? 'Lesson complete' : 'Not quite yet', size: 52 },
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
  g.addColorStop(0, `rgba(4,14,28,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,14,28,${a})`); g.addColorStop(1, `rgba(4,14,28,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(1, 'rgba(6,14,26,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, g = geomFor(key)) {
  const { top, bottom } = g, sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, { x: g.x, w: g.w, hk: g.hk });
  LAID = { key, lay, top, bottom, h: lay.contentH, sig: `${W}x${H}|${state.settings.textIdx}|${host.t},${host.b},${host.l},${host.r}|${state.sig || ''}` };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    const bx = Math.min(W - host.r - 12, g.x + g.w + 10);
    roundPath(ctx, bx, top + 4, 8, bottom - top - 8, 4); ctx.fillStyle = 'rgba(255,246,228,0.15)'; ctx.fill(); roundPath(ctx, bx, ty, 8, th, 4); ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, g.x - 20, g.w + 40);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(0, 0, W, H); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  ctx.clearRect(0, 0, W, H);
  const g = geomFor('title');
  if (!g.wide) {
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(4,14,28,0.15)'); gr.addColorStop(0.35, 'rgba(4,14,28,0.5)'); gr.addColorStop(1, 'rgba(4,14,28,0.9)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  } else {
    const gr = ctx.createLinearGradient(g.x - 90, 0, g.x + 40, 0); gr.addColorStop(0, 'rgba(4,14,28,0)'); gr.addColorStop(1, 'rgba(4,14,28,0.82)');
    ctx.fillStyle = gr; ctx.fillRect(g.x - 90, 0, W - g.x + 90, H);
    ctx.fillStyle = 'rgba(4,14,28,0.82)'; ctx.fillRect(g.x + 40, 0, W, H);
    const gl = ctx.createLinearGradient(0, 0, g.x * 0.8, 0); gl.addColorStop(0, 'rgba(4,14,28,0.45)'); gl.addColorStop(1, 'rgba(4,14,28,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, g.x, H);
  }
  drawFlowScreen(ctx, state, 'title', titleWidgets(state, g.wide), g);
  if (g.wide) {
    const hw = g.heroCx * 2;
    ctx.save(); ctx.translate(g.heroCx - hw / 2, Math.round((H - 380) / 2) - 34); heroArt().draw(ctx, hw); ctx.restore();
  }
  {
    const btns = LAID.lay.items.filter((i) => i.w.t === 'btn');
    const x0 = Math.min(...btns.map((i) => i.x)), x1 = Math.max(...btns.map((i) => i.x + i.wd)), lcx = (x0 + x1) / 2;
    const ly = Math.min(H - host.b - LOCKUP_H - 8, LAID.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20);
    const lw = Math.round(LOCKUP_H * 1200 / 327), m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(LOCKUP_H + 12, m);
    titleLockTap = { x: lcx - tw / 2, y: ly + LOCKUP_H + 6 - th, w: tw, h: th };
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(4,14,28,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, LOCKUP_H + 12, (LOCKUP_H + 12) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, lcx, ly, LOCKUP_H, 1);
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${minFont(18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', g.wide ? g.heroCx : W / 2, H - 8 - host.b); }
}
export const renderLadder = (ctx, state) => { bg(ctx, 0.82); drawFlowScreen(ctx, state, 'ladder', ladderWidgets(state)); };
export const renderShootout = (ctx, state) => { bg(ctx, 0.82); drawFlowScreen(ctx, state, 'shootout', shootoutWidgets(state)); };
export function renderPractice(ctx, state) {
  bg(ctx, 0.82);
  const pins = setupPins(), g = geomFor('practice');
  drawFlowScreen(ctx, state, 'practice', practiceWidgets(state), g);
  const y0 = pins.start.y - 56;
  const gr = ctx.createLinearGradient(0, y0, 0, H);
  gr.addColorStop(0, 'rgba(6,14,26,0)'); gr.addColorStop(0.2, 'rgba(6,14,26,0.88)'); gr.addColorStop(1, 'rgba(6,14,26,0.95)');
  ctx.fillStyle = gr; ctx.fillRect(0, y0, W, H - y0);
  const pz = Math.min(TEXT_SCALES[state.settings.textIdx], 1.4);
  drawButton(ctx, pins.start, 'Start kicking', { primary: true, size: Math.round(32 * pz) });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: Math.round(28 * pz) });
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.84); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); };
export function renderResult(ctx, state) {
  ctx.clearRect(0, 0, W, H); scrim(ctx, 0.66);
  const g = geomFor('result'), r = drawFlowScreen(ctx, state, 'result', resultWidgets(state), g);
  const endY = g.top + r.lay.contentH - r.scroll, y = r.maxScroll > 0 ? Math.min(g.bottom - 4, endY + 20) : Math.min(H - host.b - 30, endY + 26);
  if (y > g.top + 40 && y < H) drawMoreLine(ctx, W / 2, y, minFont(22));
}
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.84); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets()); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.84); drawFlowScreen(ctx, state, 'learn', learnWidgets(state)); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.84); drawFlowScreen(ctx, state, 'lesson', lessonWidgets(state)); };
export const renderQuiz = (ctx, state) => { bg(ctx, 0.84); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state)); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.84); drawFlowScreen(ctx, state, 'lessonresult', lessonResultWidgets(state)); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.6);
  const wd = pauseWidgets(state), wide = isWide();
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60 - 2 * Math.max(host.l, host.r));
  const lay = flowLayout(ctx, wd, sc, { x: Math.round((W - pw) / 2) + 30, w: pw - 60, hk: wide ? 0.82 : 1 });
  const top = (wide ? 24 : 70) + host.t, bottom = H - (wide ? 24 : 70) - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, Math.round((W - pw) / 2), y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(10,26,46,0.95)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, Math.round((W - pw) / 2), pw);
}

// ---- reference pages (About, How to Play, Rules) ---------------------------------------------------
let DOC = { key: '', max: 0, viewH: 0, h: 0 };
export const docMeta = () => DOC;
function buildDoc(ctx, list, scale, pw) {
  const fs = Math.max(minFont(1), Math.round(28 * scale)), lh = fs * 1.28, tw = pw - 100;
  const secFs = Math.max(minFont(1), Math.round(34 * Math.min(scale, 1.3)));
  const blocks = []; let y = 16;
  list.forEach((sec, si) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gap: k === 0 && pi > 0 })); });
    const artH = sec.art ? 210 : 0;
    const blk = { si, tl, titleH, art: sec.art || null, artH, y0: y, lines: [] };
    let h = titleH + artH + (artH ? 10 : 0);
    lines.forEach((l, k) => { if (l.gap && k > 0) h += lh * 0.45; blk.lines.push({ ...l, y: h }); h += lh; });
    h += 26; blk.h = h; y += h; blocks.push(blk);
  });
  return { blocks, h: y, fs, lh, secFs };
}
const docCache = new Map();
function getDoc(ctx, list, header, sc) {
  const pw = readerLayout().panel.w, key = `${header}:${sc}:${list.length}:${pw}:${host.px.toFixed(2)}`;
  let d = docCache.get(key);
  if (!d) { d = buildDoc(ctx, list, sc, pw); docCache.set(key, d); }
  return { d, key };
}
export function ensureDoc(state, list, header) {
  const { d, key } = getDoc(estCtx, list, 'est' + header, TEXT_SCALES[state.settings.textIdx]);
  const viewH = readerLayout().view.h;
  DOC = { key: 'est' + key, max: Math.max(0, d.h - viewH), viewH, h: d.h };
}
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.84);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = readerLayout(), PANEL = RL.panel, V = RL.view;
  const { d: doc, key } = getDoc(ctx, list, header, sc);
  const viewH = V.h, max = Math.max(0, doc.h - viewH);
  DOC = { key, max, viewH, h: doc.h };
  const scroll = Math.max(0, Math.min(state.ui.scroll, max)); state.ui.scroll = scroll;
  const mid = PANEL.x + PANEL.w / 2;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(15,34,54,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 800 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, mid, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(15,34,54,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
  const top = V.y - scroll;
  doc.blocks.forEach((blk, bi) => {
    const by = top + blk.y0;
    if (by > V.y + V.h || by + blk.h < V.y) return;
    if (bi > 0) { ctx.strokeStyle = 'rgba(15,34,54,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, by - 10); ctx.lineTo(PANEL.x + PANEL.w - 80, by - 10); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${doc.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, mid, by + doc.secFs * (0.9 + k * 1.2) - 8));
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, by + blk.titleH, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, by + blk.titleH, PANEL.w - 80, blk.artH - 12); ctx.restore(); }
    ctx.fillStyle = C.ink; ctx.font = `400 ${doc.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l) => { const yy = by + l.y; if (yy + doc.lh < V.y || yy > V.y + V.h) return; ctx.fillText(l.text, PANEL.x + 40, yy + doc.fs * 0.85); });
  });
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, viewH * (viewH / doc.h)), ty = V.y + (scroll / max) * (viewH - th);
    roundPath(ctx, PANEL.x + PANEL.w - 20, V.y, 8, viewH, 4); ctx.fillStyle = 'rgba(15,34,54,0.12)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 20, ty, 8, th, 4); ctx.fillStyle = 'rgba(15,34,54,0.55)'; ctx.fill();
    const k = Math.max(1, minFont(22) / 22), pillW = Math.round(124 * k), pillH = Math.round(36 * k);
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, V.y + viewH - 80, 0, V.y + viewH); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.95)');
      ctx.fillStyle = g; ctx.fillRect(V.x, V.y + viewH - 80, V.w, 80);
    }
    roundPath(ctx, mid - pillW / 2, V.y + viewH - pillH - 8, pillW, pillH, pillH / 2); ctx.fillStyle = 'rgba(15,34,54,0.9)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(scroll < max - 4 ? '▼ more' : 'The end', mid, V.y + viewH - pillH / 2 - 8); ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${minFont(24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x + RL.pct.w / 2, RL.pct.y + RL.pct.h / 2); ctx.textBaseline = 'alphabetic';
  const rz = Math.min(sc, 1.4);
  drawButton(ctx, RL.back, 'Close', { size: Math.round(32 * rz) });
  drawButton(ctx, RL.next, scroll >= max - 4 ? 'Done' : 'Page down', { primary: true, size: Math.round(32 * rz) });
}

// ---- diagrams: drawn with the game's own geometry and physics ---------------------------------------------------
let ARTBOX = null;
function label(ctx, t, x, y, size = 18, col = '#0f2236', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${minFont(size)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (ARTBOX) {
    const tw = ctx.measureText(t).width, l = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const cl = Math.max(ARTBOX.x0, Math.min(ARTBOX.x1 - tw, l));
    x += cl - l; y = Math.max(ARTBOX.y0 + size, Math.min(ARTBOX.y1 - 3, y));
  }
  ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#d68a00', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function grass(ctx, x, y, w, h) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3f9a55'); g.addColorStop(1, '#2a7a40'); ctx.fillStyle = g; roundPath(ctx, x, y, w, h, 14); ctx.fill(); }
function postsFront(ctx, cx, base, s) {
  ctx.strokeStyle = '#fff6e4'; ctx.fillStyle = '#fff6e4'; ctx.lineWidth = Math.max(3, 0.1 * s); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - GOAL_HW * s, base); ctx.lineTo(cx - GOAL_HW * s, base - 9 * s); ctx.moveTo(cx + GOAL_HW * s, base); ctx.lineTo(cx + GOAL_HW * s, base - 9 * s);
  ctx.moveTo(cx - GOAL_HW * s, base - BAR_H * s); ctx.lineTo(cx + GOAL_HW * s, base - BAR_H * s); ctx.stroke();
}
export function drawArt(kind, ctx, x, y, w, h) {
  ARTBOX = { x0: x, y0: y, x1: x + w, y1: y + h };
  ctx.save();
  if (kind === 'overview') {
    grass(ctx, x, y, w, h);
    const s = Math.min((h - 40) / 14, (w - 40) / 40), cx = x + w * 0.7, base = y + h - 24;
    postsFront(ctx, cx, base, s * 0.55);
    // side view of the kick: tee at left, ball arc to the posts
    const r = flightSim({ sx: 0, d: 30, yaw: 0, elev: TILTS[1].elev, speed: VMAX * 0.78, wind: { x: 0, z: 0 }, path: true });
    const x0 = x + 30, k = (cx - 40 - x0) / 30, ky = k * 1.0;
    ctx.setLineDash([2, 9]); ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
    r.path.forEach((p, i) => { const px = x0 + (p.z + 30) * k, py = base - p.y * ky; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff6e4'; ctx.beginPath(); ctx.ellipse(x0, base - 3, 9, 6, 0, 0, TAU); ctx.fill();
    label(ctx, 'tee', x0, base - 18, 17, '#fff6e4'); label(ctx, 'The posts', cx, y + 24, 17, '#fff6e4');
  } else if (kind === 'posts') {
    ctx.fillStyle = '#8fc4ee'; roundPath(ctx, x, y, w, h, 14); ctx.fill();
    ctx.fillStyle = '#3d8a50'; ctx.fillRect(x, y + h - 30, w, 30);
    const s = (h - 56) / 9.5, cx = x + w * 0.3, base = y + h - 30;
    postsFront(ctx, cx, base, s);
    const dot = (px, py, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + px * s, base - py * s, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#0f2236'; ctx.lineWidth = 2; ctx.stroke(); };
    const items = [[0.3, 6.2, '#17a34a', 'Goal'], [-4.4, 5, '#e0572f', 'Wide'], [1.2, 1.5, '#e0572f', 'Short'], [1.6, BAR_H - 0.1, '#e0572f', 'Off the bar']];
    items.forEach(([px, py, col]) => dot(px, py, col));
    items.forEach(([, , col, name], i) => { const ly = y + 34 + i * 34, lx = x + w * 0.62; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly - 6, 8, 0, TAU); ctx.fill(); label(ctx, name, lx + 18, ly, 18, '#0f2236', 'left'); });
    label(ctx, `${GOAL_HW * 2} m`, cx, base + 22, 15, '#fff6e4'); label(ctx, `bar ${BAR_H} m`, cx - GOAL_HW * s - 8, base - BAR_H * s + 5, 15, '#0f2236', 'right');
  } else if (kind === 'angle') {
    grass(ctx, x, y, w, h);
    const s = (h - 30) / 30, py = y + 18, cx = x + w / 2;
    ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 10, py); ctx.lineTo(x + w - 10, py); ctx.stroke();
    ctx.fillStyle = '#fff6e4'; for (const sx of [-GOAL_HW, GOAL_HW]) { ctx.beginPath(); ctx.arc(cx + sx * s, py, 4, 0, TAU); ctx.fill(); }
    const spots = [{ sx: 0, d: 18 }, { sx: -14, d: 26 }];
    spots.forEach((sp, i) => {
      const px = cx + sp.sx * s, pyy = py + sp.d * s;
      ctx.fillStyle = i ? 'rgba(255,160,100,0.45)' : 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(px, pyy); ctx.lineTo(cx - GOAL_HW * s, py); ctx.lineTo(cx + GOAL_HW * s, py); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.beginPath(); ctx.arc(px, pyy, 6, 0, TAU); ctx.fill();
      label(ctx, `${sp.d} m · ${windowDeg(sp).toFixed(1)}°`, px + (i ? -12 : 12), pyy + 4, 16, '#fff6e4', i ? 'right' : 'left');
    });
    label(ctx, 'try line', x + 14, py - 4, 15, '#fff6e4', 'left');
  } else if (kind === 'wind') {
    ctx.fillStyle = '#143a5c'; roundPath(ctx, x, y, w, h, 14); ctx.fill();
    const items = [{ a: 0, t: 'Tail-wind' }, { a: Math.PI / 2, t: 'Cross right' }, { a: Math.PI, t: 'Head-wind' }, { a: -Math.PI / 2, t: 'Cross left' }];
    const n = items.length, cw = w / n, r = Math.min(cw * 0.34, h * 0.3);
    items.forEach((it, i) => {
      const cx = x + cw * (i + 0.5), cy = y + h * 0.46;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,246,228,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      const dx = Math.sin(it.a), dy = -Math.cos(it.a);
      arrow(ctx, cx - dx * r * 0.7, cy - dy * r * 0.7, cx + dx * r * 0.8, cy + dy * r * 0.8, '#ffd34d', 5);
      label(ctx, it.t, cx, y + h - 12, 15, '#fff6e4');
    });
    label(ctx, 'up = toward the posts', x + w / 2, y + 22, 16, '#ffd34d');
  } else if (kind === 'tilt') {
    grass(ctx, x, y, w, h);
    const base = y + h - 20, x0 = x + 24, k = (w - 60) / 62, ky = (h - 40) / 16;
    const cols = ['#ffd34d', '#ffffff', '#7fd8ff'];
    TILTS.forEach((ti, i) => {
      const r = flightSim({ sx: 0, d: 0.001, yaw: 0, elev: ti.elev, speed: VMAX * 0.95, wind: { x: 0, z: 0 }, path: true });
      ctx.setLineDash([2, 8]); ctx.strokeStyle = cols[i]; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
      r.path.forEach((p, j) => { const px = x0 + p.z * k, py = base - p.y * ky; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]);
      const top = r.path.reduce((a, p) => (p.y > a.y ? p : a), r.path[0]);
      label(ctx, ti.name, x0 + top.z * k, base - top.y * ky - 8, 15, cols[i]);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + w, base); ctx.stroke();
    label(ctx, 'Same power: three flights', x + w / 2, y + h - 2, 15, '#fff6e4', 'center');
  } else if (kind === 'rhythm') {
    ctx.fillStyle = '#143a5c'; roundPath(ctx, x, y, w, h, 14); ctx.fill();
    const x0 = x + 40, x1 = x + w - 40, ty = y + h * 0.5, k = (x1 - x0) / (RUN_Q + 0.2);
    ctx.strokeStyle = 'rgba(255,246,228,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(x1, ty); ctx.stroke();
    BEATS.forEach((b, i) => { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x0 + b * k, ty, 12, 0, TAU); ctx.fill(); label(ctx, `beat ${i + 1}`, x0 + b * k, ty + 36, 15, '#fff6e4'); });
    ctx.fillStyle = '#7dffb3'; ctx.beginPath(); ctx.arc(x0 + RUN_Q * k, ty, 17, 0, TAU); ctx.fill(); label(ctx, 'ring closes', x0 + RUN_Q * k, ty - 28, 16, '#7dffb3');
    ctx.fillStyle = 'rgba(125,255,179,0.28)'; ctx.fillRect(x0 + (RUN_Q - 0.45) * k, ty - 20, 0.55 * k, 40); label(ctx, 'press counts here', x0 + (RUN_Q - 0.45) * k, y + 24, 15, '#fff6e4', 'left');
  }
  ctx.restore();
  ARTBOX = null;
}
export { windAt };
