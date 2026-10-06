// Every screen that is not the play screen: title, setup, learn, settings, result, pause and the paginated About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, THINK_STEPS, colGeom, readerLayout, setupPins, host, isWide, minFont } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, ROLES, HW, HL, ZG, GHW, BHW } from './consts.js';
import { LESSONS, QUIZ, ROLE_INFO } from './content.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const LOCKUP_H = 70, LOCK_STRIP = LOCKUP_H + 30;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
// Where each flow screen sits: the centred column (x, w), its vertical range and the button height factor (landscape is short).
function geomFor(key) {
  const c = colGeom(), wide = c.wide, hk = wide ? 0.82 : 1;
  if (key === 'title') {
    if (!wide) return { x: c.x, w: c.w, top: host.t, bottom: H - host.b - LOCK_STRIP, hk: H < 1100 ? 0.86 : 1, wide };
    const cw = Math.min(560, Math.round(W * 0.4)), x = W - host.r - 40 - cw;
    return { x, w: cw, top: host.t + 12, bottom: H - host.b - LOCK_STRIP, hk, wide, heroCx: Math.round((x - 20) / 2) };
  }
  if (key === 'setup') return { x: c.x, w: c.w, top: host.t, bottom: setupPins().start.y - 26, hk, wide };
  return { x: c.x, w: c.w, top: host.t, bottom: H - host.b, hk, wide };
}
const WIDGETS = { title: titleWidgets, setup: setupWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, learn: learnWidgets, lesson: lessonWidgets, quiz: quizWidgets, lessonresult: lessonResultWidgets, qbreak: qbreakWidgets };
export function ensureLayout(state, key) {
  const wf = WIDGETS[key];
  if (!wf) return;
  const sig = `${W}x${H}|${state.settings.textIdx}|${host.t},${host.b},${host.l},${host.r}`;
  if (LAID.key === key && LAID.lay && LAID.sig === sig) return;       // the render keeps LAID current every frame; this only covers the first update after a change
  const g = geomFor(key);
  const lay = flowLayout(estCtx, wf(state, g.wide), TEXT_SCALES[state.settings.textIdx], { x: g.x, w: g.w, hk: g.hk });
  LAID = { key, lay, top: g.top, bottom: g.bottom, h: lay.contentH, sig };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = (k = 1) => {
  // push the whole hero down until its tagline clears the host back button disc (56 css px + 8 css margin below the top inset)
  const d = host.back ? Math.max(0, Math.round((host.back + 14 / Math.max(0.05, host.px) + 6) / k - 52)) : 0;
  return {
  t: 'art', h: Math.round((400 + d) * k),
  draw(ctx, w) {
    ctx.save(); ctx.scale(k, k); ctx.translate(0, d); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / k / 2;
    ctx.font = `700 38px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('SIX-A-SIDE KICK AND CATCH', cx, 96);
    ctx.font = `700 124px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillText('Footy', cx, 226);
    ctx.font = `700 70px ${DISPLAY}`; ctx.fillText('Kick and Mark', cx, 312);
    ctx.restore();
  },
  };
};

export function titleWidgets(state, wide = false) {
  const sv = state.saved;
  return [
    ...(wide ? [] : [heroArt(H < 1100 ? 0.78 : 1)]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.roleName} · Q${sv.q + 1} · ${sv.pts[0]}-${sv.pts[1]}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: 88 },
    { t: 'btn', id: 'quick', label: 'Quick match', sub: 'Two quarters', row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Skills and roles', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two computer teams play while you learn why' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.watch ? 'Watch & Learn' : 'New match', size: 48 }];
  if (!s.watch) {
    wd.push({ t: 'p', label: 'Choose your player', bold: true, color: '#ffe9a0', size: 26 });
    ROLES.forEach((r) => wd.push({ t: 'btn', id: `role-${r}`, label: ROLE_INFO[r].name, sub: ROLE_INFO[r].blurb, active: s.role === r, h: 84 }));
    wd.push({ t: 'p', label: ROLE_INFO[s.role].text, size: 22, align: 'left', pad: 8 });
    wd.push({ t: 'btn', id: 'role-lesson', label: `Role tutorial: ${ROLE_INFO[s.role].name}`, dark: true, h: 72 });
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 76 });
    });
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'len-full', label: 'Full: 4 quarters', row: 9, active: s.length === 'full' && !demo, disabled: demo, hitDisabled: true });
    wd.push({ t: 'btn', id: 'len-quick', label: 'Quick: 2 quarters', row: 9, active: s.length === 'quick' || demo });
  } else {
    wd.push({ t: 'p', label: 'Choose the two teams', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'p', label: 'Red team', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push({ t: 'p', label: 'Blue team', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, active: s.opp === i + 1, row: 30 + (i < 3 ? 0 : 1), h: 70 }));
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
    { t: 'p', label: `Players: ${st.women ? 'Women' : 'Men'}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'set-men', label: 'Men', row: 12, active: !st.women },
    { t: 'btn', id: 'set-women', label: 'Women', row: 12, active: st.women },
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

const ptsOf = (sc) => sc.g * 6 + sc.b;
export function resultWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const a = ptsOf(s.score[0]), b = ptsOf(s.score[1]);
  const watch = state.setup.lastMode === 'watch';
  const title = s.winner < 0 ? 'A draw' : watch ? `${s.teams[s.winner].name} win` : s.winner === 0 ? 'You win the match!' : `${s.teams[1].name} win`;
  const wd = [{ t: 'gap', h: big || isWide() ? 24 : 120 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${a} – ${b}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: `Red ${s.score[0].g}.${s.score[0].b}  ·  Blue ${s.score[1].g}.${s.score[1].b}`, size: 28, cap: big ? 2 : 3, bold: true });
  const st = s.stats;
  wd.push({ t: 'p', label: `Marks ${st[0].marks} – ${st[1].marks}  ·  Tackles ${st[0].tackles} – ${st[1].tackles}  ·  Kicks ${st[0].kicks} – ${st[1].kicks}  ·  Handballs ${st[0].handballs} – ${st[1].handballs}`, size: 24, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function qbreakWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const q = s.q + 1, last = s.qscore[s.qscore.length - 1] || [s.score[0], s.score[1]];
  return [
    { t: 'gap', h: big || isWide() ? 10 : 200 }, { t: 'h', label: `End of quarter ${q}`, size: 52, cap: big ? 1.2 : 1.5 },
    { t: 'h', label: `${ptsOf(last[0])} – ${ptsOf(last[1])}`, size: 84, color: '#ffd97a', cap: big ? 1.1 : 1.3 },
    { t: 'p', label: `Red ${last[0].g}.${last[0].b}  ·  Blue ${last[1].g}.${last[1].b}`, size: 28, bold: true },
    { t: 'p', label: `Quarter ${q + 1} of ${s.quarters} starts with a bounce at the centre.`, size: 26 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'nextq', label: `Start quarter ${q + 1}`, primary: true, h: 92 },
    { t: 'btn', id: 'qsave', label: 'Save and quit to menu', dark: true },
    { t: 'gap', h: 30 },
  ];
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
    { t: 'gap', h: isWide() ? 20 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, the full match length, Learn lessons and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Short lessons for every skill and every role. Each one is a practice you play on the real pitch.', size: 26 },
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
  g.addColorStop(0, `rgba(4,22,14,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,22,14,${a})`); g.addColorStop(1, `rgba(4,22,14,${Math.min(0.92, a + 0.3)})`);
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
  LAID = { key, lay, top, bottom, h: lay.contentH, sig: `${W}x${H}|${state.settings.textIdx}|${host.t},${host.b},${host.l},${host.r}` };
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
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(4,22,14,0.15)'); gr.addColorStop(0.35, 'rgba(4,22,14,0.45)'); gr.addColorStop(1, 'rgba(4,22,14,0.9)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  } else {
    const gr = ctx.createLinearGradient(g.x - 90, 0, g.x + 40, 0); gr.addColorStop(0, 'rgba(4,22,14,0)'); gr.addColorStop(1, 'rgba(4,22,14,0.82)');
    ctx.fillStyle = gr; ctx.fillRect(g.x - 90, 0, W - g.x + 90, H);
    ctx.fillStyle = 'rgba(4,22,14,0.82)'; ctx.fillRect(g.x + 40, 0, W, H);
    const gl = ctx.createLinearGradient(0, 0, g.x * 0.8, 0); gl.addColorStop(0, 'rgba(4,22,14,0.45)'); gl.addColorStop(1, 'rgba(4,22,14,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, g.x, H);
  }
  drawFlowScreen(ctx, state, 'title', titleWidgets(state, g.wide), g);
  if (g.wide) {
    const hw = g.heroCx * 2;
    ctx.save(); ctx.translate(g.heroCx - hw / 2, Math.round((H - 400) / 2) - 34); heroArt().draw(ctx, hw); ctx.restore();
  }
  {   // themed lockup: bottom centre, directly under the last row of menu buttons (pinned to the bottom when the menu scrolls)
    const btns = LAID.lay.items.filter((i) => i.w.t === 'btn');
    const x0 = Math.min(...btns.map((i) => i.x)), x1 = Math.max(...btns.map((i) => i.x + i.wd)), lcx = (x0 + x1) / 2;
    const ly = Math.min(H - host.b - LOCKUP_H - 8, LAID.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20);
    const lw = Math.round(LOCKUP_H * 1200 / 327), m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(LOCKUP_H + 12, m);
    titleLockTap = { x: lcx - tw / 2, y: ly + LOCKUP_H + 6 - th, w: tw, h: th };
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(4,22,14,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, LOCKUP_H + 12, (LOCKUP_H + 12) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, lcx, ly, LOCKUP_H, 1);
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${minFont(18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', g.wide ? g.heroCx : W / 2, H - 8 - host.b); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  const pins = setupPins(), g = geomFor('setup');
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), g);
  const y0 = pins.start.y - 56;
  const gr = ctx.createLinearGradient(0, y0, 0, H);
  gr.addColorStop(0, 'rgba(6,14,26,0)'); gr.addColorStop(0.2, 'rgba(6,14,26,0.88)'); gr.addColorStop(1, 'rgba(6,14,26,0.95)');
  ctx.fillStyle = gr; ctx.fillRect(0, y0, W, H - y0);
  const pz = Math.min(TEXT_SCALES[state.settings.textIdx], 1.4);
  drawButton(ctx, pins.start, state.setup.watch ? 'Watch the match' : 'Start the match', { primary: true, size: Math.round(32 * pz) });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: Math.round(28 * pz) });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pins.start.y - 16); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); };
export function renderResult(ctx, state) {
  ctx.clearRect(0, 0, W, H); scrim(ctx, 0.62);
  const g = geomFor('result'), r = drawFlowScreen(ctx, state, 'result', resultWidgets(state), g);
  // a quiet pointer to the other games, below the buttons (or at the foot of the screen when the list scrolls)
  const endY = g.top + r.lay.contentH - r.scroll, y = r.maxScroll > 0 ? Math.min(g.bottom - 4, endY + 20) : Math.min(H - host.b - 30, endY + 26);
  if (y > g.top + 40 && y < H) drawMoreLine(ctx, W / 2, y, minFont(22));
}
export const renderQBreak = (ctx, state) => { ctx.clearRect(0, 0, W, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'qbreak', qbreakWidgets(state)); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets()); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'learn', learnWidgets(state)); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lesson', lessonWidgets(state)); };
export const renderQuiz = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state)); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult', lessonResultWidgets(state)); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), wide = isWide();
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60 - 2 * Math.max(host.l, host.r));
  const lay = flowLayout(ctx, wd, sc, { x: Math.round((W - pw) / 2) + 30, w: pw - 60, hk: wide ? 0.82 : 1 });
  const top = (wide ? 24 : 70) + host.t, bottom = H - (wide ? 24 : 70) - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, Math.round((W - pw) / 2), y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(14,34,52,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, Math.round((W - pw) / 2), pw);
}

// ---- reference pages (About, How to Play, Rules) ---------------------------------------------------
// A reference reader is ONE scrolling document (drag, wheel, keys, Next, visible scroll bar), so text at 100-300% is never cut off, in
// portrait or landscape. Its panel, zoom buttons and Close / Next come from layout.readerLayout.
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
/** Called from update (before the first render of a screen) so the scroll limit is known; the real render overwrites it. */
export function ensureDoc(state, list, header) {
  const { d, key } = getDoc(estCtx, list, 'est' + header, TEXT_SCALES[state.settings.textIdx]);
  const viewH = readerLayout().view.h;
  DOC = { key: 'est' + key, max: Math.max(0, d.h - viewH), viewH, h: d.h };
}
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = readerLayout(), PANEL = RL.panel, V = RL.view;
  const { d: doc, key } = getDoc(ctx, list, header, sc);
  const viewH = V.h, max = Math.max(0, doc.h - viewH);
  DOC = { key, max, viewH, h: doc.h };
  const scroll = Math.max(0, Math.min(state.ui.scroll, max)); state.ui.scroll = scroll;
  const mid = PANEL.x + PANEL.w / 2;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, mid, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(19,40,58,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
  const top = V.y - scroll;
  doc.blocks.forEach((blk, bi) => {
    const by = top + blk.y0;
    if (by > V.y + V.h || by + blk.h < V.y) return;
    if (bi > 0) { ctx.strokeStyle = 'rgba(19,40,58,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, by - 10); ctx.lineTo(PANEL.x + PANEL.w - 80, by - 10); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${doc.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, mid, by + doc.secFs * (0.9 + k * 1.2) - 8));
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, by + blk.titleH, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, by + blk.titleH, PANEL.w - 80, blk.artH - 12); ctx.restore(); }
    ctx.fillStyle = C.ink; ctx.font = `400 ${doc.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l) => { const yy = by + l.y; if (yy + doc.lh < V.y || yy > V.y + V.h) return; ctx.fillText(l.text, PANEL.x + 40, yy + doc.fs * 0.85); });
  });
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, viewH * (viewH / doc.h)), ty = V.y + (scroll / max) * (viewH - th);
    roundPath(ctx, PANEL.x + PANEL.w - 20, V.y, 8, viewH, 4); ctx.fillStyle = 'rgba(19,40,58,0.12)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 20, ty, 8, th, 4); ctx.fillStyle = 'rgba(19,40,58,0.55)'; ctx.fill();
    const k = Math.max(1, minFont(22) / 22), pillW = Math.round(124 * k), pillH = Math.round(36 * k);
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, V.y + viewH - 80, 0, V.y + viewH); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.95)');
      ctx.fillStyle = g; ctx.fillRect(V.x, V.y + viewH - 80, V.w, 80);
    }
    roundPath(ctx, mid - pillW / 2, V.y + viewH - pillH - 8, pillW, pillH, pillH / 2); ctx.fillStyle = 'rgba(19,40,58,0.9)'; ctx.fill();
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

// ---- diagrams: a top-down pitch drawn with the game's own geometry ---------------------------------
function pitchBox(ctx, x, y, w, h) {
  const ph = Math.min(h - 52, (w - 20) * (HL / HW) * 0.98), pw = ph * (HW / HL);
  const cx = x + w / 2, cy = y + h / 2, s = ph / (2 * HL);
  return { cx, cy, s, px: (px) => cx - px * s, pz: (pz) => cy - pz * s, pw, ph };
}
function drawPitch(ctx, B) {
  ctx.beginPath(); ctx.ellipse(B.cx, B.cy, B.pw / 2, B.ph / 2, 0, 0, TAU); ctx.fillStyle = '#2f8a4a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f6f7fb'; ctx.stroke();
  for (const sg of [-1, 1]) for (const x of [-BHW, -GHW, GHW, BHW]) { ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = Math.abs(x) < 4 ? 4 : 2.5; ctx.beginPath(); ctx.moveTo(B.px(x), B.pz(sg * ZG)); ctx.lineTo(B.px(x), B.pz(sg * ZG) - sg * (Math.abs(x) < 4 ? -14 : -8) * 0 + 0); ctx.stroke(); ctx.beginPath(); ctx.arc(B.px(x), B.pz(sg * ZG), Math.abs(x) < 4 ? 4 : 3, 0, TAU); ctx.fillStyle = '#fff6e4'; ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(B.px(-HW), B.pz(0)); ctx.lineTo(B.px(HW), B.pz(0)); ctx.stroke();
  ctx.beginPath(); ctx.arc(B.px(0), B.pz(0), 3 * B.s, 0, TAU); ctx.stroke();
}
const dot = (ctx, x, y, col, r = 9) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke(); };
function arrow(ctx, x0, y0, x1, y1, col = '#ffc94d', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// Captions stay inside the illustration box (ARTBOX is set by drawArt): never clipped at an edge, never poking into the heading above.
let ARTBOX = null;
function label(ctx, t, x, y, size = 18, col = '#fff6e4', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${minFont(size)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
  if (ARTBOX) {
    const tw = ctx.measureText(t).width, l = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const cl = Math.max(ARTBOX.x0, Math.min(ARTBOX.x1 - tw, l));
    x = align === 'center' ? cl + tw / 2 : align === 'right' ? cl + tw : cl; y = Math.max(ARTBOX.y0, Math.min(ARTBOX.y1, y));
  }
  ctx.fillText(t, x, y); ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ARTBOX = { x0: x + 8, x1: x + w - 8, y0: y + minFont(15) + 4, y1: y + h - 8 };
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(16,40,31,0.94)'; ctx.fill();
  const B = pitchBox(ctx, x, y, w, h);
  const R = '#e0443a', U = '#2f7be0';
  const A = {
    pitch() { drawPitch(ctx, B); label(ctx, 'goal posts', B.px(0) + 70, B.pz(ZG) - 8, 15); label(ctx, 'you attack', B.cx - B.pw / 2 - 10, B.pz(0) - 4, 15, '#ffe9a0', 'right'); label(ctx, 'this end ↑', B.cx - B.pw / 2 - 10, B.pz(0) + 16, 15, '#ffe9a0', 'right'); for (const [px, pz, c] of [[0, -1.3, R], [-5, -6, R], [5, -6, R], [-6, 8, R], [6, 8, R], [0, -15, R], [0, 1.3, U], [5, 6, U], [-5, 6, U], [6, -8, U], [-6, -8, U], [0, 15, U]]) dot(ctx, B.px(px), B.pz(pz), c, 7); arrow(ctx, B.px(0), B.pz(-6), B.px(0), B.pz(20), '#ffc94d', 4); },
    roles() { drawPitch(ctx, B); for (const [px, pz, c, l] of [[0, -1.3, R, 'R'], [-5, -6, R, 'M'], [5, -6, R, 'M'], [-6, 8, R, 'F'], [6, 8, R, 'F'], [0, -15, R, 'D']]) { dot(ctx, B.px(px), B.pz(pz), c, 11); label(ctx, l, B.px(px), B.pz(pz) + 5, 13, '#fff'); } },
    sticks() { drawPitch(ctx, B); dot(ctx, B.px(0), B.pz(-6), R, 10); arrow(ctx, B.px(0), B.pz(-6), B.px(-7), B.pz(6), '#ffc94d', 5); ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(B.px(0), B.pz(-6), 16, 0, TAU); ctx.stroke(); label(ctx, 'you', B.px(0) + 30, B.pz(-6) + 6, 16, '#ffd54a', 'left'); },
    kick() { drawPitch(ctx, B); dot(ctx, B.px(0), B.pz(-6), R, 10); dot(ctx, B.px(-6), B.pz(14), R, 9); dot(ctx, B.px(-4), B.pz(16), U, 9); arrow(ctx, B.px(0), B.pz(-5), B.px(-5.6), B.pz(13), '#7fe8d6', 4); ctx.strokeStyle = '#7fe8d6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(B.px(-6), B.pz(14), 16, 0, TAU); ctx.stroke(); label(ctx, 'kick to the open player', B.px(0), B.pz(24), 16); },
    mark() { drawPitch(ctx, B); dot(ctx, B.px(0), B.pz(-8), R, 9); dot(ctx, B.px(-5), B.pz(12), R, 10); dot(ctx, B.px(-3.5), B.pz(13.5), U, 10); ctx.strokeStyle = '#ffe060'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(B.px(-5), B.pz(12), 16, 9, 0, 0, TAU); ctx.stroke(); arrow(ctx, B.px(0), B.pz(-7), B.px(-4.4), B.pz(11), '#ffc94d', 4); label(ctx, 'ring: where it lands', B.px(-5) + 22, B.pz(12) + 36, 15, '#ffe060', 'left'); },
    meter() { const mw = w - 80, mx = x + 40, my = y + h / 2 - 22; roundPath(ctx, mx, my, mw, 44, 18); ctx.fillStyle = 'rgba(255,246,228,0.18)'; ctx.fill(); ctx.fillStyle = 'rgba(31,157,106,0.6)'; ctx.fillRect(mx + mw * 0.36, my + 8, mw * 0.28, 28); ctx.fillStyle = '#fff6e4'; ctx.fillRect(mx + mw * 0.55, my - 4, 7, 52); label(ctx, 'press KICK in the green', x + w / 2, my + 82, 20); },
    tackle() { drawPitch(ctx, B); dot(ctx, B.px(0), B.pz(0), U, 10); dot(ctx, B.px(0), B.pz(-5), R, 10); arrow(ctx, B.px(0), B.pz(-4), B.px(0), B.pz(-0.8), '#ffc94d', 4); arrow(ctx, B.px(0), B.pz(0.5), B.px(0), B.pz(8), '#fff', 3); label(ctx, 'from behind is best', B.px(0) + 24, B.pz(-3), 15, '#ffe9a0', 'left'); },
    posts() { const cx = x + w / 2, by = y + h - 40; for (const [dx, hh, c] of [[-BHW, 70, '#c9ced8'], [-GHW, 130, '#fff6e4'], [GHW, 130, '#fff6e4'], [BHW, 70, '#c9ced8']]) { ctx.fillStyle = c; ctx.fillRect(cx + dx * 18 - 4, by - hh, 8, hh); } label(ctx, 'goal: 6', cx, by - 150, 22, '#ffe9a0'); label(ctx, 'behind: 1', cx - 150, by - 90, 20, '#fff6e4'); label(ctx, 'behind: 1', cx + 150, by - 90, 20, '#fff6e4'); },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffe9a0'], ['REVEAL', '#7fe8d6'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const cx = x + 10 + i * (cw + 10); roundPath(ctx, cx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, cx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.pitch)();
  ARTBOX = null; ctx.restore();
}
