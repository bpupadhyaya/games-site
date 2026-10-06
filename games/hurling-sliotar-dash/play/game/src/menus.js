// Every screen that is not the play screen: title, setup (role + rivals), role tutorial, learn, settings, result, pause and the
// paginated About / How to Play / Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% size.
import { W, H, SW, OX, LAND, MENU, PANEL, host, minU, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_CLOSE, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, ROLES, CHOICES, HW, HL, GOAL_HW, HOME, SWEET } from './consts.js';
import { LESSONS, QUIZ } from './content.js';
import { fmtScore, totalPts, TEAM_NAME, TEAM_COL } from './hud.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: 1280 };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  const sk = `${key}|${W}x${H}|${state.settings.textIdx}`;
  if (LAID.sk === sk && LAID.lay) return;
  const T = MENU.top, B = MENU.bottom, PB = MENU.pinBottom;
  const defs = { title: [titleWidgets, T, B], setup: [setupWidgets, T, PB], role: [roleWidgets, T, PB], settings: [settingsWidgets, T, B], result: [resultWidgets, T, B], demolimit: [demoLimitWidgets, T, B], learn: [learnWidgets, T, B], lesson: [lessonWidgets, T, B], quiz: [quizWidgets, T, B], lessonresult: [lessonResultWidgets, T, B] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, sk, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

function drawHero(ctx, w) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cx = w / 2, k = Math.min(1, (w - 20) / 640);
  // dark backing panel: the heading never sits directly over the live players and pitch lines
  ctx.fillStyle = 'rgba(4,16,10,0.72)'; roundPath(ctx, 2, 40, w - 4, 288, 30); ctx.fill();
  ctx.font = `700 ${Math.round(38 * k)}px ${FONT}`;
  while (ctx.measureText('THE FAST FIELD GAME OF IRELAND').width > w - 16 && k > 0.3) ctx.font = `700 ${parseInt(ctx.font.match(/(\d+)px/)[1], 10) - 1}px ${FONT}`;
  ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('THE FAST FIELD GAME OF IRELAND', cx, 96);
  ctx.font = `700 124px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Hurling', cx, 224);
  ctx.font = `italic 700 62px ${DISPLAY}`; ctx.fillStyle = '#9be5b6'; ctx.fillText('Sliotar Dash', cx, 298);
  ctx.restore();
}
const heroArt = () => { const k = H < 1200 ? 0.75 : 1; return { t: 'art', h: Math.round(380 * k), draw(ctx, w) { ctx.save(); ctx.scale(k, k); drawHero(ctx, w / k); ctx.restore(); } }; };
const LOCK_W = 300;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
// the themed lockup, bottom centre directly under the last menu row (a flow item, so it follows the buttons; backing pill for contrast)
const brandArt = () => ({ t: 'art', h: 120, brand: true, draw(ctx, w) {
  const lw = Math.min(w - 40, LOCK_W), lh = Math.round(lw * 327 / 1200);
  ctx.save(); ctx.fillStyle = G_lockDown() ? 'rgba(255,226,122,0.5)' : 'rgba(4,16,10,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 60 - lh / 2 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockupImage(ctx, w / 2, 60, lw, 1);
} });
let lockDownFlag = false;
const G_lockDown = () => lockDownFlag;
export const setLockDown = (v) => { lockDownFlag = v; };

export function titleWidgets(state) {
  const sv = state.saved;
  return [
    ...(LAND ? [{ t: 'gap', h: 24 }] : [heroArt()]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.roleName} · ${sv.half === 2 ? 'Second half' : 'First half'} · ${sv.you} to ${sv.them}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a match', primary: !sv, h: !LAND && H < 1200 ? 72 : 88 },
    { t: 'btn', id: 'quick', label: 'Quick match', sub: 'One half', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Computer plays both', row: 1 },
    { t: 'btn', id: 'learn', label: 'Learn to play', sub: 'Seven drills and a quiz' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
    brandArt(),
  ];
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.watch ? 'Watch & Learn' : s.mode === 'quick' ? 'Quick match' : 'New match', size: 48 }];
  if (!s.watch) {
    wd.push({ t: 'p', label: 'Choose your role', bold: true, color: '#ffe9a0', size: 26 });
    CHOICES.forEach((ri) => {
      const r = ROLES[ri];
      wd.push({ t: 'btn', id: `role${ri}`, label: ri === 1 ? 'Back' : r.name, sub: r.blurb, active: s.role === ri, h: 96 });
    });
    wd.push({ t: 'p', label: 'Choose your rivals', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 80 });
    });
    wd.push({ t: 'p', label: 'Your teammates play at', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `mate${i + 1}`, label: l.name, active: s.mate === i + 1, row: 30 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'btn', id: 'len-full', label: 'Two halves of 3:00', row: 9, active: s.mode === 'full', disabled: demo, hitDisabled: true });
    wd.push({ t: 'btn', id: 'len-quick', label: 'Quick: one half', row: 9, active: s.mode === 'quick' });
  } else {
    wd.push({ t: 'p', label: 'Choose the two teams', bold: true, color: '#ffe9a0', size: 26 });
    wd.push({ t: 'p', label: 'Blues (left of the scoreboard)', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push({ t: 'p', label: 'Ambers', size: 22 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wb${i + 1}`, label: l.name, active: s.watchB === i + 1, row: 25 + (i < 3 ? 0 : 1), h: 70 }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function roleWidgets(state) {
  const ri = state.setup.role, r = ROLES[ri];
  const tips = ROLE_TIPS[ri];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: ri === 1 ? 'Back' : r.name, size: 52 },
    { t: 'p', label: r.blurb || ROLES[1].blurb, size: 28, bold: true, color: '#ffe9a0' },
    { t: 'art', h: 280, draw: (ctx, w) => drawRoleArt(ctx, w, 280, ri) },
    ...tips.map((p) => ({ t: 'p', label: p, size: 26, align: 'left', pad: 10 })),
    { t: 'gap', h: 20 },
  ];
}
const ROLE_TIPS = {
  5: ['You start near the far goal. Get to open space near the posts and call for the ball by standing still.', 'Score: a quick STRIKE release is a goal try (3 points), a later release is a point over the bar (1).', 'Rises and hand-passes from teammates come to you: press STRIKE when the ball is at your hurley.'],
  3: ['You start in the middle and play the whole pitch: win loose balls with RISE, hook carriers, and feed the forwards with PASS.', 'A solo run with the ball bouncing on the hurley takes you past rivals; BURST dodges a hook.', 'From 12 metres or more a point is the safer score.'],
  1: ['You start near your own goal, marking the rival forwards. Stand between them and the goal.', 'HOOK when their ball bounces up, or block their strike as they wind up. Clear dangerous balls with a long STRIKE.', 'A swing at a player whose ball is not exposed can be a foul: wait for the bounce.'],
  0: ['You stay near your goal. The stick moves you along the line and out a little.', 'SAVE blocks with the hurley; a ball far to one side makes you dive. Watch the striker: they swing about half a second before the ball goes.', 'After a score or a wide you take the puck-out: hold STRIKE and release in the POINT zone for a long one.'],
};
function drawRoleArt(ctx, w, h, ri) {
  ctx.save();
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = 'rgba(16,44,30,0.92)'; ctx.fill();
  const ph = h - 24, pw = ph * (HW * 2) / (HL * 2), x0 = (w - pw) / 2, y0 = 12;
  roundPath(ctx, x0, y0, pw, ph, 6); ctx.fillStyle = '#2f8a4a'; ctx.fill(); ctx.strokeStyle = '#f6f7fb'; ctx.lineWidth = 2; ctx.stroke();
  const px = (x) => x0 + pw / 2 + x * (pw / (HW * 2)), pz = (z) => y0 + ph / 2 - z * (ph / (HL * 2));
  ctx.beginPath(); ctx.moveTo(x0, pz(0)); ctx.lineTo(x0 + pw, pz(0)); ctx.stroke();
  for (const g of [-1, 1]) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px(-GOAL_HW), pz(g * HL)); ctx.lineTo(px(GOAL_HW), pz(g * HL)); ctx.stroke(); }
  HOME.forEach((hm, i) => {
    ctx.beginPath(); ctx.arc(px(hm[0]), pz(hm[1]), i === ri ? 11 : 7, 0, TAU); ctx.fillStyle = i === ri ? '#fff6e4' : TEAM_COL[0]; ctx.fill(); ctx.strokeStyle = i === ri ? '#ffd97a' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = i === ri ? 4 : 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(px(-hm[0]), pz(-hm[1]), 7, 0, TAU); ctx.fillStyle = TEAM_COL[1]; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.max(18, minU())}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('your goal', x0 + pw + 12, pz(-HL) - 4); ctx.fillText('their goal', x0 + pw + 12, pz(HL) + 18);
  ctx.restore();
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Aim assist: ${st.assist === 'strong' ? 'Strong' : st.assist === 'off' ? 'Off' : 'Normal'}`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'as-off', label: 'Off', row: 12, active: st.assist === 'off' },
    { t: 'btn', id: 'as-normal', label: 'Normal', row: 12, active: st.assist === 'normal' },
    { t: 'btn', id: 'as-strong', label: 'Strong', row: 12, active: st.assist === 'strong' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Role, rivals and match length are chosen when a match starts.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const s = state.sim, st = s.stats[0], big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const mode = state.setup.lastMode;
  const win = s.winner;
  const title = win < 0 ? 'A draw' : mode === 'watch' ? `${TEAM_NAME[win]} win` : win === 0 ? 'You win!' : `${TEAM_NAME[1]} win`;
  const wd = [{ t: 'gap', h: big || LAND ? 24 : 120 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${fmtScore(s.score[0])}  –  ${fmtScore(s.score[1])}`, size: 64, cap: big ? 1.0 : 1.2, color: '#ffd97a' });
  wd.push({ t: 'p', label: `${totalPts(s.score[0])} points to ${totalPts(s.score[1])}`, size: 28, cap: big ? 2 : 3 });
  wd.push({ t: 'p', label: `Blues: ${st.shots} shots, ${st.goals} goals, ${st.points} points, ${st.wides} wides, ${st.passes} hand-passes, ${st.hooks} hooks and shoulders, ${st.saves} saves.`, size: 24, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'art', h: 56, draw: (ctx, w) => drawMoreLine(ctx, w / 2, 24, 19) });
  wd.push({ t: 'gap', h: 20 });
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
    { t: 'btn', id: 'quit', label: state.mode === 'drill' ? 'Quit the drill' : 'Save and quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, the full match length, all the Learn drills and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function learnWidgets(state) {
  const done = state.learn.done;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Learn to play', size: 48 },
    { t: 'p', label: 'Seven short drills on the real pitch, then a quiz. Each drill sets your role for you.', size: 26 },
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
    { t: 'btn', id: 'lesson-go', label: l.quiz ? 'Start the quiz' : 'Start the drill', primary: true, h: 92 },
    { t: 'btn', id: 'lesson-back', label: 'Back to drills', dark: true },
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
    { t: 'gap', h: 120 }, { t: 'h', label: r.pass ? 'Drill complete' : 'Not quite yet', size: 52 },
    { t: 'h', label: `${r.score} of ${r.n}`, size: 90, color: '#ffd97a', cap: 1.2 },
    { t: 'p', label: r.pass ? `You reached the goal: ${l.goal}.` : `The goal was: ${l.goal}. Try again.`, size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'lr-again', label: 'Try again', primary: !r.pass },
    ...(r.pass && state.learn.cur < LESSONS.length - 1 ? [{ t: 'btn', id: 'lr-next', label: 'Next drill', primary: true }] : []),
    { t: 'btn', id: 'lr-list', label: 'All drills', dark: true },
    { t: 'gap', h: 30 },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(4,16,10,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,16,10,${a})`); g.addColorStop(1, `rgba(4,16,10,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,16,10,0)'); g.addColorStop(1, 'rgba(4,16,10,0.7)');
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
  LAID = { key, sk: `${key}|${W}x${H}|${state.settings.textIdx}`, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 14, top, 8, bottom - top, 4); ctx.fillStyle = 'rgba(255,246,228,0.14)'; ctx.fill();
    roundPath(ctx, W - 14, ty, 8, th, 4); ctx.fillStyle = 'rgba(255,246,228,0.72)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  ctx.clearRect(-OX, 0, SW, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(4,16,10,0.15)'); g.addColorStop(0.35, 'rgba(4,16,10,0.45)'); g.addColorStop(1, 'rgba(4,16,10,0.9)');
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
  if (LAND) {
    // landscape: the heading on the left, the menu in a column on the right
    const lw = OX - host.l - 24, hx = (host.l - OX) / 2 + 0, y0 = Math.max(host.t, (H - 380) / 2 - 40);
    ctx.save(); ctx.translate(hx - lw / 2, y0); drawHero(ctx, lw); ctx.restore();
  }
  const fr = drawFlowScreen(ctx, state, 'title', titleWidgets(state), MENU.top, MENU.bottom);
  titleLockTap = null;
  {
    const it = LAID.lay.items.find((i) => i.w.brand);
    if (it) {
      const lw = Math.min(it.wd - 40, LOCK_W), lh = Math.round(lw * 327 / 1200), cy = LAID.top + it.y - fr.scroll + 60, cx = it.x + it.wd / 2;
      const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
      if (cy - th / 2 >= MENU.top && cy + th / 2 <= MENU.bottom) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
    }
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', LAND ? (host.l - OX) / 2 : W / 2, H - 14 - host.b); }
}
function pinned(ctx, state, key, widgets, label, back) {
  bg(ctx, 0.78);
  const pb = MENU.pinBottom;
  drawFlowScreen(ctx, state, key, widgets, MENU.top, pb);
  const g = ctx.createLinearGradient(0, pb - 30, 0, H);
  g.addColorStop(0, 'rgba(4,16,10,0)'); g.addColorStop(0.2, 'rgba(4,16,10,0.88)'); g.addColorStop(1, 'rgba(4,16,10,0.95)');
  ctx.fillStyle = g; ctx.fillRect(-OX, pb - 30, SW, H - pb + 30);
  drawButton(ctx, SETUP_PINS.start, label, { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, back, { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pb + 14); }
}
export const renderSetup = (ctx, state) => pinned(ctx, state, 'setup', setupWidgets(state), state.setup.watch ? 'Watch the match' : 'Next: your role', 'Back');
export const renderRole = (ctx, state) => pinned(ctx, state, 'role', roleWidgets(state), 'Start the match', 'Back');
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), MENU.top, MENU.bottom); };
export const renderResult = (ctx, state) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), MENU.top, MENU.bottom); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), MENU.top, MENU.bottom); };
export const renderLearn = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), MENU.top, MENU.bottom); };
export const renderLesson = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lesson', lessonWidgets(state), MENU.top, MENU.bottom); };
export const renderQuiz = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state), MENU.top, MENU.bottom); };
export const renderLessonResult = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'lessonresult', lessonResultWidgets(state), MENU.top, MENU.bottom); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 40), px0 = (W - pw) / 2;
  const lay = flowLayout(ctx, wd, sc, { x: px0 + 30, w: pw - 60 });
  const top = LAND ? MENU.top + 34 : 70 + MENU.top, bottom = LAND ? MENU.bottom - 34 : H - 70 - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px0, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(12,36,24,0.96)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  if (maxScroll > 0) {
    const th = Math.max(50, ch * (ch / lay.contentH)), ty = y0 + (sc0 / maxScroll) * (ch - th);
    roundPath(ctx, px0 + pw - 20, y0, 8, ch, 4); ctx.fillStyle = 'rgba(255,246,228,0.14)'; ctx.fill();
    roundPath(ctx, px0 + pw - 20, ty, 8, th, 4); ctx.fillStyle = 'rgba(255,246,228,0.72)'; ctx.fill();
  }
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px0, pw);
}

// ---- reference pages (Rules, How to Play, About): ONE continuous document that scrolls --------------------------------------
// Drag / swipe, mouse wheel, arrows, PageUp / PageDown, Space, Home / End all scroll it; a visible scroll bar shows where you are. The text size
// (100-300%) only changes how long the document is, never what is on screen being cut off.
export const READER = { h: 0, view: 0, max: 0 };
const hdrH = () => (LAND ? 64 : 84);
const viewT = () => PANEL.y + hdrH(), viewB = () => PANEL.y + PANEL.h - 14;
export const pageViewH = () => viewB() - viewT();

function buildDoc(ctx, list, scale) {
  const fs = Math.round(26 * scale), lh = fs * 1.2, tw = PANEL.w - 64;
  const secFs = Math.round(32 * Math.min(scale, 1.5));
  const items = []; let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 6 }); y += 22; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    tl.forEach((l) => { items.push({ k: 'title', y, text: l, fs: secFs }); y += secFs * 1.18; });
    y += 8;
    if (sec.art) { items.push({ k: 'art', y, art: sec.art, h: 210 }); y += 222; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l, fs }); y += lh; });
    });
    y += 10;
  });
  return { items, h: y + 12, fs };
}
const docCache = new Map();
export function docFor(ctx, list, header, scale) {
  const key = `${header}:${scale}:${list.length}:${PANEL.w}`;
  let d = docCache.get(key);
  if (!d) { d = buildDoc(ctx, list, scale); docCache.set(key, d); }
  return d;
}
export function readerMax(state, ctx, list, header) { return Math.max(0, docFor(ctx, list, header, TEXT_SCALES[state.settings.textIdx]).h - pageViewH()); }
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const VIEW_T = viewT(), VIEW_B = viewB(), HD = hdrH();
  const doc = docFor(ctx, list, header, sc);
  const viewH = pageViewH(), max = Math.max(0, doc.h - viewH);
  READER.h = doc.h; READER.view = viewH; READER.max = max;
  const scroll = Math.max(0, Math.min(state.ui.scroll, max));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(16,40,28,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round((LAND ? 36 : 42) * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, PANEL.x + PANEL.w / 2, PANEL.y + HD * 0.6);
  ctx.strokeStyle = 'rgba(16,40,28,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 40, PANEL.y + HD - 18); ctx.lineTo(PANEL.x + PANEL.w - 40, PANEL.y + HD - 18); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW_T, PANEL.w - 12, viewH); ctx.clip();
  const top = VIEW_T - scroll;
  for (const it of doc.items) {
    const y = top + it.y;
    if (y > VIEW_B + 40 || y + (it.h || it.fs * 1.4 || 20) < VIEW_T - 40) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(16,40,28,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + PANEL.w / 2 - 8, y + it.fs * 0.9); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 52, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 30, y, PANEL.w - 72, it.h - 12); ctx.restore(); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + 22, y + it.fs * 0.85); }
  }
  ctx.restore();
  if (max > 0) {
    // scroll bar: track + thumb on the panel's right edge, and "more" / "up" cues
    const tx = PANEL.x + PANEL.w - 16;
    roundPath(ctx, tx, VIEW_T, 8, viewH, 4); ctx.fillStyle = 'rgba(16,40,28,0.16)'; ctx.fill();
    const th = Math.max(56, viewH * (viewH / doc.h)), ty = VIEW_T + (scroll / max) * (viewH - th);
    roundPath(ctx, tx, ty, 8, th, 4); ctx.fillStyle = 'rgba(16,40,28,0.62)'; ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, VIEW_B - 70, 0, VIEW_B); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)');
      ctx.fillStyle = g; ctx.fillRect(PANEL.x + 6, VIEW_B - 70, PANEL.w - 40, 70);
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 52, VIEW_B - 42, 104, 32, 16); ctx.fillStyle = 'rgba(16,40,28,0.82)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▼ scroll', PANEL.x + PANEL.w / 2, VIEW_B - 25);
    } else if (scroll > 4) {
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 40, VIEW_T + 6, 80, 30, 15); ctx.fillStyle = 'rgba(16,40,28,0.82)'; ctx.fill();
      ctx.fillStyle = '#fff6e4'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▲ up', PANEL.x + PANEL.w / 2, VIEW_T + 21);
    }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, (TEXT_DEC.x + TEXT_DEC.w + TEXT_INC.x) / 2, TEXT_DEC.y + TEXT_DEC.h / 2); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, REF_CLOSE, 'Close', { primary: true, size: 32 });
}

// ---- diagrams -------------------------------------------------------------------------------------
const dot = (ctx, x, y, col, r = 9) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke(); };
function arrow(ctx, x0, y0, x1, y1, col = '#ffc94d', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function label(ctx, t, x, y, size = 18, col = '#fff6e4', align = 'center') {
  size = Math.max(size, minU());
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(16,44,30,0.94)'; ctx.fill();
  const A = {
    pitch() { ctx.save(); ctx.translate(x, y); drawRoleArt(ctx, w, h, 3); ctx.restore(); },
    goal() {
      const cx = x + w / 2, gy = y + h - 30, gw = Math.min(w * 0.5, 280), gh = (gw / (GOAL_HW * 2)) * 2.5, ph = (gw / (GOAL_HW * 2)) * 7;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - gw / 2, gy); ctx.lineTo(cx - gw / 2, gy - ph * 0.62); ctx.moveTo(cx + gw / 2, gy); ctx.lineTo(cx + gw / 2, gy - ph * 0.62); ctx.moveTo(cx - gw / 2, gy - gh); ctx.lineTo(cx + gw / 2, gy - gh); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - gw / 2, gy - gh, gw, gh);
      label(ctx, 'GOAL = 3', cx, gy - gh / 2 + 6, 22, '#ffe9a0'); label(ctx, 'POINT = 1', cx, gy - gh - 22, 22, '#7fe8d6');
      arrow(ctx, cx + gw / 2 + 60, gy - gh - 40, cx + gw / 2 - 16, gy - gh - 32, '#7fe8d6', 4);
    },
    solo() {
      const cx = x + w / 2, gy = y + h - 36;
      ctx.strokeStyle = '#9be5b6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 30, gy); ctx.lineTo(x + w - 30, gy); ctx.stroke();
      for (let k = 0; k < 3; k++) { const x0 = x + 70 + k * ((w - 140) / 3), x1 = x0 + (w - 140) / 3; ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20, px = x0 + (x1 - x0) * u, py = gy - 20 - 4 * 70 * u * (1 - u); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); dot(ctx, x0, gy - 20, '#fff6e4', 7); }
      label(ctx, 'hook window', cx, y + 36, 20, '#ffe9a0'); label(ctx, 'the ball bounces on the hurley', cx, y + h - 8, 18);
    },
    bar() {
      const bw = w - 120, bx = x + 60, by = y + h / 2 - 10;
      roundPath(ctx, bx, by, bw, 34, 12); ctx.fillStyle = 'rgba(4,16,10,0.85)'; ctx.fill();
      for (const [k, col, lb] of [['drive', '#ff9a6a', 'GOAL'], ['loft', '#7fe8d6', 'POINT']]) { const cx = bx + bw * SWEET[k], zw = bw * 0.2; roundPath(ctx, cx - zw / 2, by, zw, 34, 8); ctx.fillStyle = col; ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1; label(ctx, lb, cx, by - 10, 22); }
      roundPath(ctx, bx, by, bw * 0.28, 34, 12); ctx.fillStyle = '#fff6e4'; ctx.fill();
      label(ctx, 'hold STRIKE: release in a zone', x + w / 2, by + 70, 20, '#ffe9a0');
    },
    hook() {
      const cx = x + w / 2, cy = y + h / 2;
      dot(ctx, cx - 70, cy + 18, TEAM_COL[1], 14); dot(ctx, cx + 60, cy + 18, TEAM_COL[0], 14);
      ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx - 70, cy - 40, 12, 0, TAU); ctx.stroke();
      arrow(ctx, cx + 40, cy - 20, cx - 52, cy - 36, '#ffc94d', 5);
      label(ctx, 'swing when the ball is up', cx, y + 30, 20, '#ffe9a0');
    },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffe9a0'], ['REVEAL', '#7fe8d6'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const cx = x + 10 + i * (cw + 10); roundPath(ctx, cx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, cx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.pitch)();
  ctx.restore();
}
