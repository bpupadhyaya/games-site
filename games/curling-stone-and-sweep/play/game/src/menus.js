// Every screen that is not the play screen: title, setup, Learn, quiz, settings, result, pause, shot options, the
// reason reader, and the paginated About / How to play / Rules reader with its illustrations (drawn with the game's own
// ice, house and stone art). Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { R, HOUSE_R, EIGHT_R, FOUR_R, BUTTON_R, HOG_FAR, BACK, HALF_W } from './sim.js';
import { drawHouse, drawStone, drawBrushes, TEAM, lcg } from './art.js';
import { drawAttract } from './view.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { FORMATS, FORMAT_IDS, WEIGHTS } from './match.js';
import { LESSONS, quizWorld, lessonIndex } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------------
let PAGE_COUNT = 1;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
export function resetMenus() { LAID = { key: '', lay: null, top: 0, bottom: H }; PAGE_COUNT = 1; }
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.55 }; } };
const DEFS = () => ({
  title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], learn: [learnWidgets, 0, H],
  quiz: [quizWidgets, 0, H], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H],
  pause: [pauseWidgets, 60, H - 60, true], shot: [shotWidgets, 60, H - 60, true], reason: [reasonWidgets, 60, H - 60, true], lessonres: [lessonWidgets, 60, H - 60, true],
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
  t: 'art', h: 330,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    // two stones flanking the title
    drawStone(ctx, cx - 250, 118, 40, 0, 0.5, { speck: 3 });
    drawStone(ctx, cx + 250, 118, 40, 1, 2.2, { speck: 9 });
    ctx.font = `800 98px ${FONT}`; textShadow(ctx, 'Stone', cx, 130, '#f2f9ff', 14);
    ctx.font = `italic 700 72px ${SERIF}`; textShadow(ctx, 'and Sweep', cx, 214, '#ffd447', 12);
    ctx.font = `500 27px ${FONT}`; textShadow(ctx, 'A game of ice, curl and strategy', cx, 266, '#cfe7f8', 6);
    ctx.strokeStyle = 'rgba(190,225,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 200, 292); ctx.lineTo(cx + 200, 292); ctx.stroke();
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(), { t: 'gap', h: state.saved ? 60 : 130 }];
  if (state.saved) {
    const sn = state.saved, who = sn.cfg.mode === 'two' ? 'Two players' : `vs ${PROFILES[sn.cfg.opp].name}`;
    wd.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: `${who} · end ${sn.end} · ${sn.scores[0]}–${sn.scores[1]}`, primary: true, h: 92 });
  }
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: !state.saved, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'learn', label: 'Learn', row: 1, sub: `${Object.keys(state.learn.done).length} of ${LESSONS.length} done` });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#cfe7f8', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Format', bold: true, color: '#cfe7f8', size: 26 });
  FORMAT_IDS.forEach((id) => wd.push({ t: 'btn', id: `fmt-${id}`, label: FORMATS[id].name, sub: FORMATS[id].blurb, active: s.format === id, h: 88 }));
  wd.push({ t: 'p', label: 'Number of ends', bold: true, color: '#cfe7f8', size: 26 });
  wd.push({ t: 'btn', id: 'ends2', label: '2 ends', row: 9, active: s.ends === 2 });
  wd.push({ t: 'btn', id: 'ends4', label: '4 ends', row: 9, active: s.ends === 4 });
  wd.push({ t: 'btn', id: 'ends6', label: '6 ends', row: 9, active: s.ends === 6 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const guide = ['Path to the first touch', 'Full result', 'Off'][st.guide];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#cfe7f8', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'set-guide', label: `Aim guide: ${guide}`, sub: 'What the dotted line shows before you throw' },
    { t: 'btn', id: 'set-easy', label: st.easy ? 'Sweeping: hold to sweep' : 'Sweeping: rub the ice', sub: st.easy ? 'Keep a finger down for steady sweeping' : 'Rub quickly side to side: the faster, the harder', active: st.easy },
    { t: 'btn', id: 'set-left', label: st.left ? 'Throwing hand: left' : 'Throwing hand: right', sub: 'Swaps which way in-turn and out-turn curl' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#cfe7f8', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#cfe7f8' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function learnWidgets(state) {
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 },
    { t: 'p', label: 'Short, hands-on lessons on a real sheet of ice: draws, guards, curl, sweeping, takeouts and the scoring rules.', size: 24, color: '#cfe7f8' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `les-${l.id}`, label: `${i + 1}. ${l.title}`, sub: state.learn.done[l.id] ? 'Done ✓  ' + l.blurb : l.blurb, active: !!state.learn.done[l.id], dark: !state.learn.done[l.id], h: 92 }));
  wd.push({ t: 'gap', h: 10 }); wd.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }); wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function quizWidgets(state) {
  const q = state.quiz, def = q.def;
  const wd = [{ t: 'gap', h: 6 }, { t: 'h', label: def.title, size: 44 }];
  if (def.stones) wd.push({ t: 'art', h: 330, draw: (ctx, w, h) => drawQuizBoard(ctx, w, h, def, q.chosen !== null) });
  wd.push({ t: 'p', label: def.q, size: 27, bold: true, color: '#ffffff' });
  def.options.forEach((o, i) => wd.push({ t: 'btn', id: `q${i}`, label: o, disabled: q.chosen !== null && q.chosen !== i && q.correct !== i, active: q.chosen !== null && q.correct === i, primary: q.chosen !== null && q.chosen === i && q.correct !== i, h: 80 }));
  if (q.chosen !== null) {
    wd.push({ t: 'p', label: q.chosen === q.correct ? 'Correct.' : `Not quite. The answer is: ${def.options[q.correct]}.`, bold: true, size: 28, color: q.chosen === q.correct ? '#8bf0c0' : '#ffc9a0' });
    wd.push({ t: 'p', label: def.explain, size: 24 });
    const last = state.quiz.idx >= LESSONS.length - 1;
    wd.push({ t: 'btn', id: 'quiz-next', label: last ? 'Done' : 'Next lesson', primary: true, h: 84 });
  }
  wd.push({ t: 'btn', id: 'back', label: 'Learn list', dark: true, h: 72 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function resultWidgets(state) {
  const m = state.m, o = m.over;
  const names = state.names;
  const title = m.cfg.mode === 'two' ? `${names[o.win]} wins` : m.cfg.mode === 'watch' ? 'End finished' : o.win === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 70 }, { t: 'h', label: title, size: 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  const rows = m.log.map((r) => `End ${r.end}: ${r.team === null ? 'blank' : `${names[r.team]} ${r.pts}`}${r.steal ? ' (steal)' : ''}`).join('   ·   ');
  wd.push({ t: 'p', label: rows, size: 24, cap: big ? 2 : 3 });
  if (o.extra) wd.push({ t: 'p', label: 'Settled in an extra end.', bold: true, color: '#cfe7f8', size: 26, cap: big ? 2 : 3 });
  const rec = m.cfg.mode === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  if (rec) wd.push({ t: 'p', label: rec, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings, lesson = state.m && state.m.cfg.mode === 'lesson';
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-guide', label: `Guide: ${['Path', 'Full', 'Off'][st.guide]}`, row: 8 },
    { t: 'btn', id: 'p-txtdec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txtinc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: lesson ? 'Back to Learn' : 'Quit to menu', dark: true },
  ];
}

export function shotWidgets(state) {
  const a = state.aim, hand = state.settings.left ? -1 : 1;
  const wd = [{ t: 'h', label: 'Shot', size: 48 }, { t: 'p', label: 'Weight', bold: true, color: '#cfe7f8', size: 26 }];
  WEIGHTS.forEach((wt, i) => wd.push({ t: 'btn', id: `w${i}`, label: wt.name, sub: wt.note, active: a.w === i, dark: a.w !== i, disabled: !state.weightsOk[i], h: 88 }));
  wd.push({ t: 'p', label: 'Turn', bold: true, color: '#cfe7f8', size: 26 });
  wd.push({ t: 'btn', id: 'turn1', label: 'In-turn', sub: hand > 0 ? 'curls right' : 'curls left', active: a.turn === 1, dark: a.turn !== 1, h: 88 });
  wd.push({ t: 'btn', id: 'turn-1', label: 'Out-turn', sub: hand > 0 ? 'curls left' : 'curls right', active: a.turn === -1, dark: a.turn !== -1, h: 88 });
  wd.push({ t: 'btn', id: 'shot-done', label: 'Done', primary: true, h: 84 });
  return wd;
}

export function reasonWidgets(state) {
  const k = state.card ?? { title: '', text: '' };
  return [{ t: 'h', label: k.title, size: 40, color: '#ffd447' }, { t: 'p', label: k.text, size: 26, align: 'left', pad: 4 }, { t: 'btn', id: 'reason-close', label: 'Close', primary: true, h: 84 }];
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
    wd.push({ t: 'btn', id: 'les-show', label: 'Show me', dark: true, sub: 'Sets up the shot for you' });
  }
  wd.push({ t: 'btn', id: 'les-list', label: 'Learn list', dark: true });
  return wd;
}

export function demoLimitWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: big ? 30 : 160 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free ends of the web demo. The full game on iPhone and Android has every rival, full matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(4,12,24,${a * 0.75})`); g.addColorStop(0.5, `rgba(4,12,24,${a})`); g.addColorStop(1, `rgba(4,12,24,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,12,24,0)'); g.addColorStop(1, 'rgba(4,12,24,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(214,236,252,0.92)'; ctx.fill();
    ctx.fillStyle = '#10243a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(214,236,252,0.92)'; ctx.fill();
    ctx.fillStyle = '#10243a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(214,236,252,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

const attract = (ctx, state, ppm = 104, yTop = 2.2, top = 60) => drawAttract(ctx, state, ppm, yTop, top);

export function renderTitle(ctx, state) {
  attract(ctx, state, 108, 2.4, 420);
  scrim(ctx, 0.28);
  const g = ctx.createRadialGradient(W / 2, 200, 40, W / 2, 200, 420);
  g.addColorStop(0, 'rgba(4,12,24,0.7)'); g.addColorStop(1, 'rgba(4,12,24,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(214,236,252,0.6)';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 30);
}
export function renderSetup(ctx, state) {
  attract(ctx, state); scrim(ctx, 0.7);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(4,12,24,0)'); g.addColorStop(0.2, 'rgba(4,12,24,0.88)'); g.addColorStop(1, 'rgba(4,12,24,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { attract(ctx, state); scrim(ctx, 0.72); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { attract(ctx, state); scrim(ctx, 0.72); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderQuiz(ctx, state) { attract(ctx, state); scrim(ctx, 0.78); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state), 0, H); }
export function renderResult(ctx, state) { attract(ctx, state, 100, 2.2, 600); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { attract(ctx, state); scrim(ctx, 0.74); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state), 0, H); }

function modal(ctx, state, key, widgets) {
  scrim(ctx, 0.62);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, { x: 60, w: 600 });
  const top = 60, bottom = H - 60;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(10,26,46,0.95)', stroke: 'rgba(140,200,245,0.5)' });
  LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export const renderPause = (ctx, state) => modal(ctx, state, 'pause', pauseWidgets(state));
export const renderShotOptions = (ctx, state) => modal(ctx, state, 'shot', shotWidgets(state));
export const renderReason = (ctx, state) => modal(ctx, state, 'reason', reasonWidgets(state));
export const renderLessonResult = (ctx, state) => modal(ctx, state, 'lessonres', lessonWidgets(state));

// ---- reference pages --------------------------------------------------------------------------------
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
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art ? 210 : 0;
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

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  attract(ctx, state); scrim(ctx, 0.74);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(240,247,252,0.98)', stroke: 'rgba(40,90,140,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,90,140,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(40,90,140,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.sky; ctx.font = `800 ${pg.secFs}px ${FONT}`;
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
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(30,60,90,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f2f9ff'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function tag(ctx, t, x, y, col = '#f4faff', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(8,22,40,0.82)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

// A small framed patch of ice with the house. Returns mapping helpers in metres (y up).
function mini(ctx, w, h, o = {}) {
  roundPath(ctx, 0, 0, w, h, 16);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e9f4fb'); g.addColorStop(1, '#cfe3f2');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(40,90,140,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const ppm = o.ppm ?? (h - 12) / 4.1;
  const cx = w * (o.fx ?? 0.5), cy = h * (o.fy ?? 0.5);
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const X = (x) => cx + (x - dx) * ppm, Y = (y) => cy - (y - dy) * ppm;
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  const lg = (y, col, wm) => { ctx.fillStyle = col; ctx.fillRect(0, Y(y) - wm * ppm / 2, w, Math.max(1.5, wm * ppm)); };
  ctx.fillStyle = 'rgba(40,88,150,0.4)'; ctx.fillRect(X(0) - 1, 0, 2, h);
  if (!o.noHouse) drawHouse(ctx, X(0), Y(0), ppm);
  lg(0, 'rgba(40,88,150,0.5)', 0.03);
  if (o.hog !== undefined) lg(o.hog, 'rgba(204,52,48,0.85)', 0.1);
  if (o.back) lg(BACK, 'rgba(40,88,150,0.5)', 0.03);
  ctx.restore();
  return { ppm, X, Y, w, h, stone: (t, x, y, ghost, a) => drawStone(ctx, X(x), Y(y), R * ppm, t, 0.5 + x, { ghost, a, speck: t + 2 + Math.abs(Math.round(x * 10)) }) };
}

// A quiz position at the size of the page
function drawQuizBoard(ctx, w, h, def, reveal) {
  const m = mini(ctx, w, h, { ppm: (h - 10) / 3.4, dy: 0.1 });
  const world = quizWorld(def);
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  const items = world.stones.map((s) => ({ s, d: Math.hypot(s.x, s.y) })).sort((a, b) => a.d - b.d);
  if (reveal) {
    items.forEach((it, i) => { ctx.strokeStyle = 'rgba(30,60,100,0.6)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.X(0), m.Y(0)); ctx.lineTo(m.X(it.s.x), m.Y(it.s.y)); ctx.stroke(); ctx.setLineDash([]); void i; });
  }
  world.stones.forEach((s) => m.stone(s.team, s.x, s.y));
  if (reveal) items.forEach((it, i) => tag(ctx, `${i + 1}`, m.X(it.s.x) + 24, m.Y(it.s.y) - 20, '#ffffff', 18));
  ctx.restore();
}

export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    sheet() {
      // the whole sheet, side on: thrower on the left, house on the right
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e3f0f9'; ctx.fill(); ctx.strokeStyle = 'rgba(40,90,140,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
      const sx = (m) => 20 + ((m + 28.35) / (28.35 + 2.0)) * (w - 40);
      ctx.fillStyle = 'rgba(255,255,255,0.0)';
      // free guard zone band
      ctx.fillStyle = 'rgba(240,194,74,0.35)'; ctx.fillRect(sx(HOG_FAR), 40, sx(0) - sx(HOG_FAR), h - 80);
      drawHouse(ctx, sx(0), h / 2, (sx(1) - sx(0)) * 1.0 * 0.95 * 0.0 + 21);
      ctx.fillStyle = 'rgba(204,52,48,0.9)'; ctx.fillRect(sx(HOG_FAR) - 3, 40, 6, h - 80); ctx.fillRect(sx(-28.35) - 3, 40, 6, h - 80);
      ctx.fillStyle = 'rgba(40,88,150,0.6)'; ctx.fillRect(sx(0) - 1, 40, 2, h - 80); ctx.fillRect(sx(BACK) - 1, 40, 2, h - 80);
      ctx.strokeStyle = 'rgba(40,88,150,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(18, h / 2); ctx.lineTo(w - 18, h / 2); ctx.stroke();
      arrow(ctx, sx(-27.5), h / 2 + 6, sx(-7.5), h / 2 + 6, '#2f78b8', 4);
      drawStone(ctx, sx(-27.5), h / 2 + 6, 9, 0, 0.5, { speck: 4 });
      ctx.restore();
      tag(ctx, 'release', sx(-28), 22, '#cfe7f8', 16); tag(ctx, 'hog line', sx(-28.35) + 50, h - 18, '#ff9a8a', 16);
      tag(ctx, 'far hog line', sx(HOG_FAR) - 30, 22, '#ff9a8a', 16); tag(ctx, 'guard zone', (sx(HOG_FAR) + sx(0)) / 2 - 6, h - 18, '#ffe08a', 16); tag(ctx, 'tee line', sx(0) + 6, 22, '#cfe7f8', 16);
    },
    house() {
      const m = mini(ctx, w, h, { fx: 0.3 });
      const L = (t, wx, wy, ty) => {
        const px = m.X(wx), py = m.Y(wy), lx = w * 0.58, ly = ty;
        ctx.strokeStyle = '#1b2b3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx - 8, ly); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = '#1b2b3d'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
        label(ctx, t, lx, ly + 6, 20, C.ink, 'left');
      };
      L('The button', 0, 0, 30); L('4-foot (red)', 0, FOUR_R * 0.82, 68); L('8-foot (white)', 0, -EIGHT_R * 0.8, 106); L('12-foot (blue)', 0, -HOUSE_R * 0.86, 144);
    },
    stones() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e3f0f9'; ctx.fill(); ctx.strokeStyle = 'rgba(40,90,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      drawStone(ctx, w * 0.3, h * 0.46, 54, 0, 0.5, { speck: 3 }); drawStone(ctx, w * 0.7, h * 0.46, 54, 1, 2.4, { speck: 8 });
      label(ctx, 'Red handle', w * 0.3, h - 20, 22); label(ctx, 'Yellow handle', w * 0.7, h - 20, 22);
    },
    curl() {
      const m = mini(ctx, w, h, { fx: 0.5, ppm: (h - 12) / 4.5, dy: -1.2, noHouse: false });
      // two paths from the bottom to the button: in-turn curls right, out-turn curls left
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      const path = (sgn, col) => {
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(m.X(-sgn * 0.9), m.Y(-3.4));
        ctx.bezierCurveTo(m.X(-sgn * 0.85), m.Y(-2.2), m.X(-sgn * 0.5), m.Y(-1.2), m.X(0), m.Y(0)); ctx.stroke();
      };
      path(1, '#d9362d'); path(-1, '#c99a10');
      tag(ctx, 'in-turn curls right', w * 0.2, 28, '#ff9a8a', 17); tag(ctx, 'out-turn curls left', w * 0.8, 28, '#ffd447', 17);
      m.stone(0, 0, 0, true, 0.6);
    },
    sweep() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e3f0f9'; ctx.fill(); ctx.strokeStyle = 'rgba(40,90,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(w * 0.44, 0, w * 0.12, h);
      drawStone(ctx, w * 0.5, h * 0.7, 30, 0, 0.7, { speck: 5 });
      drawBrushes(ctx, w * 0.5, h * 0.7, 0, -1, 90, 0.9, 1.2, 0);
      arrow(ctx, w * 0.5, h * 0.56, w * 0.5, 22, '#2f78b8', 5);
      ctx.restore();
      tag(ctx, 'brush heads warm the ice', w * 0.74, h * 0.4, '#cfe7f8', 17);
    },
    guard() {
      const m = mini(ctx, w, h, { ppm: (h - 10) / 7.2, dy: -2.0, hog: HOG_FAR, fy: 0.5 });
      ctx.fillStyle = 'rgba(240,194,74,0.32)'; ctx.fillRect(0, m.Y(0), w, m.Y(HOG_FAR) - m.Y(0));
      drawHouse(ctx, m.X(0), m.Y(0), m.ppm);
      m.stone(0, 0.2, -3.6); m.stone(1, 0, 0.1);
      tag(ctx, 'free guard zone', w * 0.76, m.Y(-3.4), '#7a5200', 17);
    },
    count() {
      const m = mini(ctx, w, h, { ppm: (h - 10) / 3.4, dy: 0.1 });
      [[0, 0.12, 0.05], [0, -0.35, -0.2], [1, 0.45, -0.1], [1, -0.9, 0.3]].forEach(([t, sx, sy]) => m.stone(t, sx, sy));
      tag(ctx, 'two red stones are closer than yellow', w * 0.5, 22, '#ffffff', 16);
    },
    hammer() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e3f0f9'; ctx.fill(); ctx.strokeStyle = 'rgba(40,90,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 8; i++) drawStone(ctx, 54 + i * 62, h * 0.4, 22, i % 2 === 0 ? 1 : 0, 0.5 + i, { speck: i + 2 });
      arrow(ctx, 54 + 7 * 62, h * 0.4 + 36, 54 + 7 * 62, h * 0.4 + 60, '#c8322c', 4);
      label(ctx, 'throw order, 8 stones: the last one belongs to the side with the last stone', w * 0.5, h - 14, 17);
      void lcg;
    },
    takeout() {
      const m = mini(ctx, w, h, { ppm: (h - 10) / 3.6, dy: 0.0 });
      m.stone(1, 0, 0);
      m.stone(0, 0, -1.9, true, 0.7);
      arrow(ctx, m.X(0), m.Y(-1.6), m.X(0), m.Y(-0.35), '#2f78b8', 5);
      arrow(ctx, m.X(0.05), m.Y(0.3), m.X(0.5), m.Y(1.6), '#c8322c', 4);
      tag(ctx, 'the hit stone leaves', w * 0.78, 30, '#ffb4a0', 17);
    },
    freeze() {
      const m = mini(ctx, w, h, { ppm: (h - 10) / 3.4 });
      m.stone(1, 0.05, 0.05); m.stone(0, 0.05, 0.05 - 2 * R);
      tag(ctx, 'touching: hard to remove', w * 0.74, 34, '#ffffff', 17);
    },
    hog() {
      const m = mini(ctx, w, h, { ppm: (h - 10) / 4.4, dy: -5.2, hog: HOG_FAR, noHouse: true });
      m.stone(0, -0.3, HOG_FAR + R + 0.05); m.stone(0, 0.6, HOG_FAR - R + 0.02, true, 0.5);
      tag(ctx, 'clear: stays', w * 0.3, m.Y(HOG_FAR + 0.6), '#7ee8a8', 17); tag(ctx, 'short: removed', w * 0.72, m.Y(HOG_FAR - 0.7), '#ffb48a', 17);
    },
    out() {
      const m = mini(ctx, w, h, { ppm: (h - 10) / 4.2, dy: 0.2, back: true });
      m.stone(0, 0, BACK + R + 0.4, true, 0.5); m.stone(1, 0.7, 0.9);
      tag(ctx, 'past the back line: out', w * 0.7, m.Y(BACK + 0.3), '#ffb48a', 17);
      void HALF_W; void BUTTON_R;
    },
  };
  (A[key] ?? A.house)();
  ctx.restore();
}
