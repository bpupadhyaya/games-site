// Every screen that is not the play screen: title, setup, Learn, quiz, settings, result, pause, round summary, lesson result and the
// paginated About / How to play / Rules reader with its illustrations (drawn with the game's own can, slippers and tokens through
// the same true-perspective camera). Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_CLOSE, THINK_STEPS, SETUP_PINS, clamp } from './layout.js';
import { FIELD, CAN, LINE_Z, TAG_R, STYLES, throwSolve, G, HAND_Y, createWorld, taya, throwers, slipOf, runTimes } from './sim.js';
import { drawCan, drawSlipper, drawPawn, drawShadow, groundRing, pawnLook } from './art.js';
import { drawAttract, makeCam } from './view.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { THROWER_PROFILES, TAYA_PROFILES } from './ai.js';
import { LESSONS, quizWorld, lessonIndex } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
export function resetMenus() { LAID = { key: '', lay: null, top: 0, bottom: H }; colCache.clear(); }
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.55 }; } };
const DEFS = () => ({
  title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], learn: [learnWidgets, 0, H],
  quiz: [quizWidgets, 0, H], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H],
  pause: [pauseWidgets, 60, H - 60, true], sheet: [sheetWidgets, 60, H - 60, true], reason: [reasonWidgets, 60, H - 60, true], roundover: [roundWidgets, 60, H - 60, true], lessonres: [lessonWidgets, 60, H - 60, true],
});
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const d = DEFS()[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx], d[3] ? { x: 60, w: 600 } : {});
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 300,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `900 96px ${FONT}`; textShadow(ctx, 'Tumbang', cx, 120, '#fff6e6', 14);
    ctx.font = `900 96px ${FONT}`; textShadow(ctx, 'Preso', cx, 208, '#fff6e6', 14);
    ctx.font = `italic 700 54px ${SERIF}`; textShadow(ctx, 'Can Toss', cx, 268, '#ffd447', 12);
    ctx.restore();
  },
});

const roleName = (r) => (r === 'taya' ? 'Guard' : 'Thrower');
export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(), { t: 'gap', h: state.saved ? 40 : 110 }];
  if (state.saved) {
    const sn = state.saved, rival = sn.cfg.role === 'thrower' ? TAYA_PROFILES[sn.cfg.level].name : THROWER_PROFILES[sn.cfg.level].name;
    wd.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: `${roleName(sn.cfg.role)} vs ${rival} · round ${sn.round} of ${sn.cfg.rounds}`, primary: true, h: 92 });
  }
  wd.push({ t: 'btn', id: 'play', label: 'Play', primary: !state.saved, h: 92 });
  wd.push({ t: 'btn', id: 'learn', label: 'Learn', row: 1, sub: `${Object.keys(state.learn.done).length} of ${LESSONS.length} done` });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', dark: true });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New match', size: 48 }];
  wd.push({ t: 'p', label: 'Choose your role. You keep it for the whole match.', bold: true, color: '#e6cfa6', size: 26 });
  wd.push({ t: 'btn', id: 'role-thrower', label: 'Thrower', sub: 'Throw slippers at the can, then dash to fetch them without being tagged', active: s.role === 'thrower', dark: s.role !== 'thrower', h: 100 });
  wd.push({ t: 'btn', id: 'role-taya', label: 'Guard (taya)', sub: 'Stand the can up again and tag the runners', active: s.role === 'taya', dark: s.role !== 'taya', h: 100 });
  const profs = s.role === 'taya' ? THROWER_PROFILES : TAYA_PROFILES;
  wd.push({ t: 'p', label: s.role === 'taya' ? 'Choose the throwers' : 'Choose the guard you play against', bold: true, color: '#e6cfa6', size: 26 });
  profs.forEach((pf, i) => {
    const won = ((rec.wins ?? {})[s.role] ?? [])[i] ?? 0;
    const locked = demo && i > 1;
    wd.push({ t: 'btn', id: `lvl${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.level === i && !locked, disabled: locked, hitDisabled: true, h: 88 });
  });
  wd.push({ t: 'p', label: 'Rounds', bold: true, color: '#e6cfa6', size: 26 });
  wd.push({ t: 'btn', id: 'rounds3', label: '3 rounds', row: 9, active: s.rounds === 3 });
  wd.push({ t: 'btn', id: 'rounds5', label: '5 rounds', row: 9, active: s.rounds === 5 });
  wd.push({ t: 'btn', id: 'lesson', label: s.role === 'taya' ? 'Role lesson: stand the can up' : 'Role lesson: throw at the can', dark: true, sub: 'A short, hands-on practice for this role' });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const guide = ['Path and ring', 'Ring only', 'Off'][st.guide];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-haptics', label: st.haptics ? 'Vibration: On' : 'Vibration: Off', sub: 'A short buzz when a throw lands, a can falls or you are tagged (on phones that allow it)' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#e6cfa6', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'set-guide', label: `Aim guide: ${guide}`, sub: 'What the dotted line and ring show before you throw' },
    { t: 'btn', id: 'set-assist', label: st.assist ? 'Guard assist: stand the can up for me' : 'Guard assist: off', sub: st.assist ? 'When the can is down and you are not steering, your guard fetches it' : 'You steer the guard all the time', active: st.assist },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#e6cfa6', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#e6cfa6' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function learnWidgets(state) {
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 },
    { t: 'p', label: 'Short, hands-on lessons in the real yard, and three quick questions: throwing, running, guarding and the rules of tagging.', size: 24, color: '#e6cfa6' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `les-${l.id}`, label: `${i + 1}. ${l.title}`, sub: state.learn.done[l.id] ? `Done ✓  ${l.blurb}` : l.blurb, active: !!state.learn.done[l.id], dark: !state.learn.done[l.id], h: 92 }));
  wd.push({ t: 'gap', h: 10 }); wd.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }); wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function quizWidgets(state) {
  const q = state.quiz, def = q.def;
  const wd = [{ t: 'gap', h: 6 }, { t: 'h', label: def.title, size: 44 }];
  wd.push({ t: 'art', h: 330, draw: (ctx, w, h) => drawQuizBoard(ctx, w, h, def, q.chosen !== null) });
  wd.push({ t: 'p', label: def.q, size: 27, bold: true, color: '#ffffff' });
  def.options.forEach((o, i) => wd.push({ t: 'btn', id: `q${i}`, label: o, disabled: q.chosen !== null && q.chosen !== i && q.correct !== i, active: q.chosen !== null && q.correct === i, primary: q.chosen !== null && q.chosen === i && q.correct !== i, h: 80 }));
  if (q.chosen !== null) {
    wd.push({ t: 'p', label: q.chosen === q.correct ? 'Correct.' : `Not quite. The answer is: ${def.options[q.correct]}.`, bold: true, size: 28, color: q.chosen === q.correct ? '#8bf0c0' : '#ffc9a0' });
    wd.push({ t: 'p', label: def.explain(q.world), size: 24 });
    const last = state.quiz.idx >= LESSONS.length - 1;
    wd.push({ t: 'btn', id: 'quiz-next', label: last ? 'Done' : 'Next lesson', primary: true, h: 84 });
  }
  wd.push({ t: 'btn', id: 'back', label: 'Learn list', dark: true, h: 72 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function resultWidgets(state) {
  const m = state.m, o = m.over, rec = state.record;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 60 }, { t: 'h', label: o.win ? 'You win!' : 'Good match', size: 64, cap: big ? 1.2 : 1.5 }];
  if (m.cfg.role === 'thrower') {
    wd.push({ t: 'h', label: `${m.strikes} tagged`, size: 76, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `You were tagged in ${m.strikes} of ${m.cfg.rounds} rounds. ${o.win ? `That is within the ${m.need} allowed: you stayed free.` : `You needed to be tagged in at most ${m.need}.`}`, bold: true, size: 26, cap: big ? 2 : 3 });
    wd.push({ t: 'p', label: `Points: ${m.pts.you}. Two for each hit, one for each safe return, minus two for a tag.`, size: 24, cap: big ? 2 : 3 });
  } else {
    wd.push({ t: 'h', label: `${m.tags} of ${m.cfg.rounds}`, size: 76, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `You tagged a thrower in ${m.tags} round${m.tags === 1 ? '' : 's'}; ${m.need} were needed. ${o.win ? 'Well guarded!' : 'The throwers got away too often.'}`, size: 26, cap: big ? 2 : 3 });
  }
  const rows = m.log.map((r) => `Round ${r.round}: ${r.text}`).join('\n');
  wd.push({ t: 'p', label: rows.replace(/\n/g, '   ·   '), size: 22, cap: big ? 2 : 3 });
  const won = ((rec.wins ?? {})[m.cfg.role] ?? [])[m.cfg.level] ?? 0;
  wd.push({ t: 'p', label: `Matches won against ${(m.cfg.role === 'thrower' ? TAYA_PROFILES : THROWER_PROFILES)[m.cfg.level].name}: ${won}.`, size: 24, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function roundWidgets(state) {
  const m = state.m, r = state.roundRes ?? { title: '', text: '' };
  const last = m.round >= m.cfg.rounds, watch = m.cfg.mode === 'watch';
  return [
    { t: 'h', label: r.title, size: 48, color: r.good ? '#8bf0c0' : '#ffd9a0' },
    { t: 'p', label: r.text, size: 26 },
    { t: 'p', label: r.score, size: 26, bold: true, color: '#ffd97a' },
    { t: 'btn', id: 'round-next', label: watch ? 'Back to the menu' : last ? 'See the result' : `Round ${m.round + 1}`, primary: true, h: 88 },
  ];
}

export function pauseWidgets(state) {
  const st = state.settings, lesson = state.m && state.m.cfg.mode === 'lesson';
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-guide', label: `Guide: ${['Path', 'Ring', 'Off'][st.guide]}`, row: 8 },
    { t: 'btn', id: 'p-txtdec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txtinc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: lesson ? 'Back to Learn' : 'Quit to menu', dark: true },
  ];
}

// The set-up sheet used at 200% text and above instead of the Lob / Skim / Think buttons (the yard keeps its size).
export function sheetWidgets(state) {
  const st = state.aim.style;
  return [
    { t: 'h', label: 'Set up your throw', size: 40 },
    { t: 'p', label: st === 'skim' ? 'Skim: low and fast, sends the can far.' : 'Lob: high arc, easier to place.', size: 24, color: '#e6cfa6' },
    { t: 'btn', id: 'sty-lob', label: 'Lob', row: 11, active: st === 'lob', dark: st !== 'lob' },
    { t: 'btn', id: 'sty-skim', label: 'Skim', row: 11, active: st === 'skim', dark: st !== 'skim' },
    { t: 'btn', id: 'sh-done', label: 'Done', primary: true, h: 88 },
    { t: 'btn', id: 'sh-think', label: 'Think', sub: 'Show a hint', dark: true },
    { t: 'btn', id: 'sh-menu', label: 'Pause menu', dark: true },
  ];
}

export function reasonWidgets(state) {
  const k = state.cardFull ?? { title: '', text: '' };
  return [{ t: 'h', label: k.title, size: 40, color: '#ffd447' }, { t: 'p', label: k.text || 'The reason appears when the choice is revealed.', size: 26, align: 'left', pad: 4 }, { t: 'btn', id: 'reason-close', label: 'Close', primary: true, h: 84 }];
}

export function lessonWidgets(state) {
  const r = state.lessonRes ?? { ok: false, msg: '' };
  const d = state.lesson ? state.lesson.def : { title: '', goal: '' };
  const wd = [{ t: 'h', label: r.ok ? 'Well done' : 'Not yet', size: 52, color: r.ok ? '#8bf0c0' : '#ffd9a0' }, { t: 'p', label: r.msg, size: 26 }];
  if (r.ok) {
    const last = lessonIndex(d.id) >= LESSONS.length - 1;
    wd.push({ t: 'btn', id: 'les-next', label: last ? 'Finish' : 'Next lesson', primary: true, h: 88 });
    wd.push({ t: 'btn', id: 'les-again', label: 'Try again', dark: true });
  } else {
    wd.push({ t: 'btn', id: 'les-again', label: 'Try again', primary: true, h: 88 });
  }
  wd.push({ t: 'btn', id: 'les-list', label: 'Learn list', dark: true });
  return wd;
}

export function demoLimitWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: big ? 30 : 160 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free rounds of the web demo. The full game on iPhone and Android has every rival, full matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(20,10,6,${a * 0.75})`); g.addColorStop(0.5, `rgba(20,10,6,${a})`); g.addColorStop(1, `rgba(20,10,6,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,10,6,0)'); g.addColorStop(1, 'rgba(20,10,6,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(250,236,210,0.92)'; ctx.fill();
    ctx.fillStyle = '#2b1c14'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(250,236,210,0.92)'; ctx.fill();
    ctx.fillStyle = '#2b1c14'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(250,236,210,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

const attract = (ctx, state, top = 300, bottom = 1180) => drawAttract(ctx, state, top, bottom);

export function renderTitle(ctx, state) {
  attract(ctx, state, 360, 1200);
  scrim(ctx, 0.3);
  const g = ctx.createRadialGradient(W / 2, 190, 40, W / 2, 190, 420);
  g.addColorStop(0, 'rgba(20,10,6,0.72)'); g.addColorStop(1, 'rgba(20,10,6,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(250,236,210,0.6)';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 30);
}
export function renderSetup(ctx, state) {
  attract(ctx, state); scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(20,10,6,0)'); g.addColorStop(0.2, 'rgba(20,10,6,0.88)'); g.addColorStop(1, 'rgba(20,10,6,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { attract(ctx, state); scrim(ctx, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { attract(ctx, state); scrim(ctx, 0.74); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderQuiz(ctx, state) { attract(ctx, state); scrim(ctx, 0.8); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state), 0, H); }
export function renderResult(ctx, state) { attract(ctx, state, 600, 1200); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { attract(ctx, state); scrim(ctx, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state), 0, H); }

function modal(ctx, state, key, widgets) {
  scrim(ctx, 0.62);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, { x: 60, w: 600 });
  const top = 60, bottom = H - 60;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(40,24,16,0.95)', stroke: 'rgba(240,194,74,0.55)' });
  LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export const renderSheet = (ctx, state) => modal(ctx, state, 'sheet', sheetWidgets(state));
export const renderPause = (ctx, state) => modal(ctx, state, 'pause', pauseWidgets(state));
export const renderReason = (ctx, state) => modal(ctx, state, 'reason', reasonWidgets(state));
export const renderRoundOver = (ctx, state) => modal(ctx, state, 'roundover', roundWidgets(state));
export const renderLessonResult = (ctx, state) => modal(ctx, state, 'lessonres', lessonWidgets(state));

// ---- reference pages --------------------------------------------------------------------------------
// About / How to Play / Rules are ONE scrolling column inside a panel: drag, swipe, mouse wheel, arrow / page keys and the scroll bar
// all move it, at every text size. READ holds the measured column so game.js knows how far it can scroll.
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
export const READER = { x: PANEL.x + 14, y: PANEL.y + 92, w: PANEL.w - 28, h: PANEL.h - 92 - 16 };
let READ = { key: '', contentH: 0 };
export const readerMax = () => Math.max(0, READ.contentH - READER.h);
export const readerKey = () => READ.key;

function buildColumn(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 96;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 10;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 6 }); y += 14; }
    ctx.font = `800 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs });
    y += tl.length * secFs * 1.2 + 14;
    if (sec.art) { items.push({ k: 'art', y, h: 300, art: sec.art }); y += 310; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; });
    });
    y += 22;
  });
  return { items, contentH: y + 8, fs, lh };
}

const colCache = new Map();
function ensureColumn(ctx, list, header, sc) {
  const key = `${header}:${sc}`;
  let col = colCache.get(key);
  if (!col) { col = buildColumn(ctx, list, sc); colCache.set(key, col); }
  READ = { key, contentH: col.contentH };
  return col;
}
// called by game.js before the first frame of a reader screen, so scrolling limits exist even before it was drawn
export function ensureReader(state, list, header) { const sc = TEXT_SCALES[state.settings.textIdx]; if (!colCache.has(`${header}:${sc}`)) READ = { key: `${header}:${sc}`, contentH: buildColumn(estCtx, list, sc).contentH }; else READ = { key: `${header}:${sc}`, contentH: colCache.get(`${header}:${sc}`).contentH }; }

export function renderPages(ctx, state, list, header) {
  attract(ctx, state); scrim(ctx, 0.76);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const col = ensureColumn(ctx, list, header, sc);
  const max = readerMax(), scroll = clamp(state.ui.scroll, 0, max);
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(252,245,230,0.98)', stroke: 'rgba(120,70,30,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(120,70,30,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(READER.x, READER.y, READER.w, READER.h); ctx.clip();
  const x0 = PANEL.x + 40, top = READER.y - scroll;
  for (const it of col.items) {
    const y = top + it.y;
    if (it.k === 'line') {
      if (y > READER.y + READER.h || y + col.lh < READER.y) continue;
      ctx.fillStyle = C.ink; ctx.font = `400 ${col.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, x0, y + col.fs * 0.85);
    } else if (it.k === 'title') {
      if (y > READER.y + READER.h || y + it.lines.length * it.fs * 1.2 < READER.y) continue;
      ctx.textAlign = 'center'; ctx.fillStyle = C.sky; ctx.font = `800 ${it.fs}px ${FONT}`;
      it.lines.forEach((l, k) => ctx.fillText(l, W / 2, y + it.fs * (0.9 + k * 1.2)));
    } else if (it.k === 'rule') {
      ctx.strokeStyle = 'rgba(120,70,30,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke();
    } else if (it.k === 'art') {
      if (y > READER.y + READER.h || y + it.h < READER.y) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, it.h - 12); ctx.restore();
    }
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, READER.h * (READER.h / col.contentH)), ty = READER.y + (scroll / max) * (READER.h - th);
    roundPath(ctx, PANEL.x + PANEL.w - 16, ty, 8, th, 4); ctx.fillStyle = 'rgba(120,70,30,0.55)'; ctx.fill();
    scrollHint(ctx, READER.y, READER.y + READER.h, scroll, max, PANEL.x + 14, PANEL.w - 28);
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_CLOSE, 'Close', { primary: true, size: 32 });
}

// ---- illustrations: the game's own can, slippers and tokens in the same perspective ---------------------------------
function tag(ctx, t, x, y, col = '#fff6e6', size = 18, bg = 'rgba(30,14,6,0.84)') {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
const camCacheD = new Map();
function dcam(w, h) { const k = `${w}x${h}`; if (!camCacheD.has(k)) camCacheD.set(k, makeCam({ x: 0, y: 0, w, h }, { pitch: 40, h: 8, z: -9, box: [3.3, -1.0, 6.4] })); return camCacheD.get(k); }
// A framed, flat-coloured patch of the yard seen through the real camera model
function frame(ctx, w, h) {
  const cam = dcam(w, h);
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3a2c2c'); bg.addColorStop(1, '#2a2020'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const q = [[FIELD.x0, FIELD.z1], [FIELD.x1, FIELD.z1], [FIELD.x1, -1.0], [FIELD.x0, -1.0]].map(([x, z]) => cam.P(x, 0, z));
  ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  const g = ctx.createLinearGradient(0, q[0][1], 0, q[3][1]); g.addColorStop(0, '#9a846b'); g.addColorStop(1, '#8c7861'); ctx.fillStyle = g; ctx.fill();
  // toe line and circle
  ctx.strokeStyle = 'rgba(250,246,236,0.85)'; ctx.lineWidth = 3;
  const a = cam.P(FIELD.x0, 0.01, 0), b = cam.P(FIELD.x1, 0.01, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  groundRing(ctx, cam, 0, CAN.z, CAN.circle, 'rgba(250,246,236,0.9)', 3);
  return cam;
}
function sceneItems(ctx, cam, w, opts = {}) {
  const items = [];
  const al = 1;
  void al;
  items.push({ z: w.can.z, draw: () => drawCan(ctx, cam, w.can, {}) });
  for (const s of w.slips) if (s.mode !== 'held') items.push({ z: s.z - 0.3, draw: () => drawSlipper(ctx, cam, s) });
  for (const a of w.agents) items.push({ z: a.z + 0.1, draw: () => drawPawn(ctx, cam, a, pawnLook(a, opts.you ?? -1), { pos: { x: a.x, z: a.z }, vx: a.vx, vz: a.vz, step: 0, idle: 0 }) });
  items.sort((p, q) => p.z - q.z).forEach((i) => i.draw());
}
function shadows(ctx, cam, w) {
  drawShadow(ctx, cam, w.can.x, w.can.z, CAN.r * 1.05, 0.46, 0);
  for (const s of w.slips) if (s.mode !== 'held') drawShadow(ctx, cam, s.x, s.z, 0.24, 0.4, Math.max(0, s.y - 0.03));
  for (const a of w.agents) drawShadow(ctx, cam, a.x, a.z, 0.34, 0.5, 0);
}
const P2 = (cam, x, z, y = 0) => cam.P(x, y, z);

function drawQuizBoard(ctx, w, h, def, reveal) {
  const world = quizWorld(def);
  const cam = frame(ctx, w, h);
  shadows(ctx, cam, world);
  sceneItems(ctx, cam, world, {});
  const foc = world.agents.find((a) => a.id === world.focus);
  const s = foc ? slipOf(world, foc.id) : null;
  if (foc && s && s.mode === 'rest') {
    const T = taya(world);
    const line = (x0, z0, x1, z1, col) => { const p = P2(cam, x0, z0), q = P2(cam, x1, z1); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]); };
    line(foc.x, foc.z, s.x, s.z, '#ffe08a'); line(T.x, T.z, s.x, s.z, '#ff8f7c');
    if (reveal) {
      const rt = runTimes(world, foc);
      const f = (v) => (Math.round(v * 10) / 10).toFixed(1);
      const m1 = P2(cam, (foc.x + s.x) / 2, (foc.z + s.z) / 2), m2 = P2(cam, (T.x + s.x) / 2, (T.z + s.z) / 2);
      tag(ctx, `${f(rt.tMe)} s`, m1[0] - 30, m1[1], '#ffe08a', 20); tag(ctx, `${f(rt.tTaya)} s`, m2[0] + 30, m2[1], '#ffb4a0', 20);
    }
  }
  ctx.restore();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const world = createWorld(); world.go = 0;
  const cam = frame(ctx, w, h);
  const T = taya(world);
  const tg = (t, wx, wz, col, wy = 0, size = 17) => { const p = P2(cam, wx, wz, wy); tag(ctx, t, p[0], p[1], col, size); };
  const A = {
    yard() {
      shadows(ctx, cam, world); sceneItems(ctx, cam, world, { you: 2 });
      tg('toe line', -2.4, 0.05, '#fff6e6'); tg('home: safe', 2.1, -0.7, '#9dffb8'); tg('chalk circle', 1.9, CAN.z + 0.3, '#fff6e6'); tg('can', 0, CAN.z, '#fff6e6', 0.95); tg('guard', T.x, T.z, '#ffb4a0', 1.6);
    },
    throw() {
      const a = world.agents[2];
      shadows(ctx, cam, world); sceneItems(ctx, cam, world, { you: 2 });
      for (const [style, col] of [['lob', '#ffe08a'], ['skim', '#8ff0e4']]) {
        const sv = throwSolve(a, 0, CAN.z, style);
        ctx.fillStyle = col;
        for (let i = 1; i < 18; i++) { const t = (i / 18) * sv.T, p = cam.P(a.x + sv.vx * t, Math.max(0.03, HAND_Y + sv.vy * t - 0.5 * G * t * t), a.z + sv.vz * t); ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, TAU); ctx.fill(); }
      }
      tg('lob: high arc', 1.5, 2.2, '#ffe08a', 1.9); tg('skim: low and fast', -1.4, 3.6, '#8ff0e4', 0.4);
    },
    can() {
      const c = world.can; Object.assign(c, { mode: 'rest', x: -1.5, z: 6.6, tilt: 1, dir: 0.6, y: 0 });
      T.x = 0.4; T.z = 4.3; T.vx = -1; T.vz = 2; T.face = 0.3;
      shadows(ctx, cam, world); sceneItems(ctx, cam, world, { you: 2 });
      const p = P2(cam, -1.5, 6.6), q = P2(cam, 0, CAN.z - 0.2);
      ctx.strokeStyle = '#9dffb8'; ctx.lineWidth = 4; ctx.setLineDash([9, 8]); ctx.beginPath(); ctx.moveTo(p[0], p[1] + 8); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
      tg('fallen can', -1.5, 6.6, '#fff6e6', 0.7); tg('carry it back, hold 0.4 s', 1.3, CAN.z - 0.9, '#9dffb8');
    },
    tag() {
      T.x = 0.7; T.z = 3.0; const r = world.agents[1]; r.x = -0.2; r.z = 2.4; r.vx = -1; r.vz = -1; r.step = 0.3;
      shadows(ctx, cam, world); sceneItems(ctx, cam, world, { you: 2 });
      groundRing(ctx, cam, T.x, T.z, TAG_R, 'rgba(255,80,60,0.8)', 3.5);
      tg('tag reach 0.62 m', 1.9, 3.0, '#ffb4a0'); tg('out in the yard: can be tagged', -1.5, 2.4, '#fff6e6', 1.5); tg('behind the line: safe', 1.9, -0.3, '#9dffb8', 1.6);
    },
  };
  (A[key] ?? A.yard)();
  ctx.restore(); ctx.restore();
}
