// Every screen that is not the play screen: title, setup, Learn, quiz, settings, result, pause, spin modal, the reason reader, and the
// paginated About / How to play / Rules reader with its illustrations (drawn with the game's own ball and table art). Pure drawing;
// game.js owns state.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { TW, TL, R, MID_X, BAULK_Y, D_R, SPOT, COLOURS, VALUE, nameOf } from './sim.js';
import { drawBall, drawSpinFace } from './art.js';
import { drawAttract } from './view.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { FORMATS, FORMAT_IDS, MATCH_LENGTHS } from './rules.js';
import { LESSONS } from './lessons.js';
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
  pause: [pauseWidgets, 60, H - 60, true], spin: [spinWidgets, 60, H - 60, true], reason: [reasonWidgets, 60, H - 60, true], lessonres: [lessonWidgets, 60, H - 60, true],
});
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const d = DEFS()[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx], d[3] ? { x: 60, w: 600 } : {});
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }
// screen rectangle of an art widget (for touch handling inside a modal)
export function artRect(id, scroll) {
  if (!LAID.lay) return null;
  const it = LAID.lay.items.find((q) => q.w.t === 'art' && q.w.id === id);
  return it ? { x: it.x, y: LAID.top + it.y - scroll, w: it.wd, h: it.h } : null;
}

const heroArt = () => ({
  t: 'art', h: 330,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    drawBall(ctx, cx - 300, 40, 26, 'red', {}); drawBall(ctx, cx + 300, 40, 26, 16, {});
    drawBall(ctx, cx - 258, 262, 22, 0, { mark: [0.3, 0.2, 0.93] }); drawBall(ctx, cx + 258, 262, 22, 19, {});
    ctx.font = `800 104px ${FONT}`; textShadow(ctx, 'Snooker', cx, 140, '#f6f0dc', 14);
    ctx.font = `italic 700 66px ${SERIF}`; textShadow(ctx, 'Cue and Frame', cx, 214, '#ffd447', 12);
    ctx.font = `500 27px ${FONT}`; textShadow(ctx, 'Pot, spin, build the break', cx, 266, '#d7ecde', 6);
    ctx.strokeStyle = 'rgba(214,170,80,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 200, 292); ctx.lineTo(cx + 200, 292); ctx.stroke();
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(), { t: 'gap', h: state.saved ? 40 : 100 }];
  if (state.saved) {
    const sn = state.saved, who = sn.cfg.mode === 'two' ? 'Two players' : `vs ${PROFILES[sn.cfg.opp].name}`;
    wd.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: `${who} · ${sn.f.scores[0]}–${sn.f.scores[1]}`, primary: true, h: 92 });
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
    wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#d7ecde', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Frame', bold: true, color: '#d7ecde', size: 26 });
  FORMAT_IDS.forEach((id) => wd.push({ t: 'btn', id: `fmt-${id}`, label: FORMATS[id].name, sub: FORMATS[id].blurb, active: s.format === id && !(demo && id === 'full'), disabled: demo && id === 'full', hitDisabled: true, h: 88 }));
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#d7ecde', size: 26 });
  MATCH_LENGTHS.forEach((n) => wd.push({ t: 'btn', id: `best${n}`, label: n === 1 ? 'One frame' : `Best of ${n}`, row: 9, active: s.best === n && !(demo && n > 1), disabled: demo && n > 1, hitDisabled: true }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const guide = ['Off', 'Aim line', 'Shot preview'][st.guide];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#d7ecde', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'set-guide', label: `Guide: ${guide}`, sub: 'Off, the aim line, or the shot simulated for a moment' },
    { t: 'btn', id: 'set-assist', label: st.assist ? 'Aim assist: On' : 'Aim assist: Off', sub: 'Snaps your aim to a clear potting line when you are very close', active: !!st.assist },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#d7ecde', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#d7ecde' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function learnWidgets(state) {
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 },
    { t: 'p', label: 'Short, hands-on lessons on the real table (aim, cut, power, back spin, position, safety) and quick questions on fouls and the free ball.', size: 24, color: '#d7ecde' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `les-${l.id}`, label: `${i + 1}. ${l.title}`, sub: state.learn.done[l.id] ? `Done ✓  ${l.blurb}` : l.blurb, active: !!state.learn.done[l.id], dark: !state.learn.done[l.id], h: 92 }));
  wd.push({ t: 'gap', h: 10 }); wd.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }); wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function quizWidgets(state) {
  const q = state.quiz, def = q.def;
  const wd = [{ t: 'gap', h: 6 }, { t: 'h', label: def.title, size: 44 }];
  if (def.stones) wd.push({ t: 'art', h: 300, draw: (ctx, w, h) => drawMini(ctx, w, h, def.stones, {}) });
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
  const m = state.m, o = m.over ?? { win: 0 };
  const names = state.names;
  const mm = m.cfg.mode;
  const title = mm === 'two' ? `${names[o.win]} wins` : mm === 'watch' ? 'Frame finished' : o.win === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 70 }, { t: 'h', label: title, size: 64, cap: big ? 1.2 : 1.5 }];
  if (m.cfg.best > 1) wd.push({ t: 'h', label: `${m.frames[0]} – ${m.frames[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  m.results.forEach((r, i) => wd.push({ t: 'p', label: `Frame ${i + 1}: ${r.scores[0]}–${r.scores[1]} (${names[r.win]})`, size: 24, cap: big ? 2 : 3 }));
  const hb = Math.max(0, ...m.results.map((r) => r.high[0]));
  if (mm !== 'watch') wd.push({ t: 'p', label: `Your best break this match: ${hb}. Highest ever: ${state.record?.high ?? 0}.`, size: 24, cap: big ? 2 : 3 });
  const rec = mm === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  if (rec) wd.push({ t: 'p', label: rec, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings, lesson = state.m && state.m.cfg.mode === 'lesson', watch = state.m && state.m.cfg.mode === 'watch';
  const wd = [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-guide', label: `Guide: ${['Off', 'Line', 'Preview'][st.guide]}`, row: 8 },
    { t: 'btn', id: 'p-assist', label: st.assist ? 'Aim assist: On' : 'Aim assist: Off', active: !!st.assist },
    { t: 'btn', id: 'p-txtdec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txtinc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
  ];
  if (!lesson && !watch) wd.push({ t: 'btn', id: 'p-concede', label: 'Concede the frame', dark: true });
  wd.push({ t: 'btn', id: 'quit', label: lesson ? 'Back to Learn' : 'Quit to menu', dark: true });
  return wd;
}

export function spinWidgets(state) {
  return [
    { t: 'h', label: 'Cue ball spin', size: 44 },
    { t: 'art', id: 'spinArt', h: 360, draw(ctx, w, h) { drawSpinFace(ctx, w / 2, h / 2, Math.min(w, h) / 2 - 8, state.aim.a, state.aim.b, { labels: true }); } },
    { t: 'p', label: 'Drag on the ball. Top: follow. Bottom: draw (back spin). Sides: side spin.', size: 24, color: '#d7ecde' },
    { t: 'btn', id: 'spin-centre', label: 'Centre', row: 11, dark: true },
    { t: 'btn', id: 'spin-done', label: 'Done', row: 11, primary: true },
  ];
}

export function reasonWidgets(state) {
  const k = state.card ?? { title: '', text: '' };
  return [{ t: 'h', label: k.title, size: 40, color: '#ffd447' }, { t: 'p', label: k.text, size: 26, align: 'left', pad: 4 }, { t: 'btn', id: 'reason-close', label: 'Close', primary: true, h: 84 }];
}

export function lessonWidgets(state) {
  const r = state.lessonRes ?? { ok: false, msg: '' };
  const d = state.lesson ? state.lesson.def : { id: '' };
  const wd = [{ t: 'h', label: r.ok ? 'Well done' : 'Not yet', size: 52, color: r.ok ? '#8bf0c0' : '#ffd9a0' }, { t: 'p', label: r.msg, size: 26 }];
  if (r.ok) {
    const last = LESSONS.findIndex((l) => l.id === d.id) >= LESSONS.length - 1;
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
    { t: 'p', label: 'You have played the free frames of the web demo. The full game on iPhone and Android has every opponent, full frames and longer matches.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(3,14,9,${a * 0.75})`); g.addColorStop(0.5, `rgba(3,14,9,${a})`); g.addColorStop(1, `rgba(3,14,9,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(3,14,9,0)'); g.addColorStop(1, 'rgba(3,14,9,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(241,233,208,0.92)'; ctx.fill();
    ctx.fillStyle = '#10241a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(241,233,208,0.92)'; ctx.fill();
    ctx.fillStyle = '#10241a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(241,233,208,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

const attract = (ctx, state) => drawAttract(ctx, state);

export function renderTitle(ctx, state) {
  attract(ctx, state);
  scrim(ctx, 0.3);
  const g = ctx.createRadialGradient(W / 2, 200, 40, W / 2, 200, 420);
  g.addColorStop(0, 'rgba(3,14,9,0.7)'); g.addColorStop(1, 'rgba(3,14,9,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(214,236,220,0.6)';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 30);
}
export function renderSetup(ctx, state) {
  attract(ctx, state); scrim(ctx, 0.86);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(3,14,9,0)'); g.addColorStop(0.2, 'rgba(3,14,9,0.9)'); g.addColorStop(1, 'rgba(3,14,9,0.97)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { attract(ctx, state); scrim(ctx, 0.86); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { attract(ctx, state); scrim(ctx, 0.86); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderQuiz(ctx, state) { attract(ctx, state); scrim(ctx, 0.82); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state), 0, H); }
export function renderResult(ctx, state) { attract(ctx, state); scrim(ctx, 0.88); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { attract(ctx, state); scrim(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state), 0, H); }

function modal(ctx, state, key, widgets) {
  scrim(ctx, 0.62);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, { x: 60, w: 600 });
  const top = 60, bottom = H - 60;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(8,30,20,0.96)', stroke: 'rgba(214,170,80,0.6)' });
  LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export const renderPause = (ctx, state) => modal(ctx, state, 'pause', pauseWidgets(state));
export const renderSpin = (ctx, state) => modal(ctx, state, 'spin', spinWidgets(state));
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
  attract(ctx, state); scrim(ctx, 0.78);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(246,240,220,0.98)', stroke: 'rgba(120,90,30,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(120,90,30,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(120,90,30,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.sky; ctx.font = `800 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
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
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(30,60,40,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f6f0dc'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------------
function tag(ctx, t, x, y, col = '#f4faff', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(8,30,20,0.85)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
// A small top-down table drawn sideways (long axis across the page). Returns map helpers in metres.
function miniTable(ctx, w, h, o = {}) {
  const pad = 14, sc = Math.min((w - 2 * pad) / TL, (h - 2 * pad) / TW);
  const tw = TL * sc, th = TW * sc, x0 = (w - tw) / 2, y0 = (h - th) / 2;
  roundPath(ctx, x0 - 10, y0 - 10, tw + 20, th + 20, 12); ctx.fillStyle = '#6b3a1a'; ctx.fill();
  ctx.fillStyle = '#0f7a43'; ctx.fillRect(x0, y0, tw, th);
  const X = (y) => x0 + y * sc, Y = (x) => y0 + x * sc;      // seen from the baulk end: the player's left is up the page
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(X(BAULK_Y), y0); ctx.lineTo(X(BAULK_Y), y0 + th); ctx.stroke();
  ctx.beginPath(); for (let i = 0; i <= 30; i++) { const a = Math.PI / 2 + (i / 30) * Math.PI; const px = X(BAULK_Y + Math.cos(a) * D_R * -1 * -1), py = Y(MID_X + Math.sin(a) * D_R); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
  ctx.fillStyle = '#050505';
  for (const [py, px] of [[0, 0], [TL, 0], [0, TW], [TL, TW], [TL / 2, 0], [TL / 2, TW]]) { ctx.beginPath(); ctx.arc(X(py), Y(px), Math.max(5, 0.07 * sc), 0, TAU); ctx.fill(); }
  const rr = Math.max(4, R * sc * (o.k ?? 1));
  return { X, Y, rr, sc, ball: (id, x, y, a) => drawBall(ctx, X(y), Y(x), rr, id, { alpha: a ?? 1 }), x0, y0, tw, th };
}
function drawMini(ctx, w, h, balls) {
  const m = miniTable(ctx, w, h, { k: 1.25 });
  for (const [id, x, y] of balls) m.ball(id, x, y);
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    table() {
      const m = miniTable(ctx, w, h, { k: 1.3 });
      for (const id of COLOURS) m.ball(id, SPOT[id].x, SPOT[id].y);
      const ax = MID_X, ay = SPOT[20].y + 2 * R + 0.001;
      for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) m.ball(1, ax + (c - r / 2) * (2 * R + 0.0004), ay + r * (Math.sqrt(3) * R + 0.0004));
      m.ball(0, MID_X + 0.1, 0.5);
      tag(ctx, 'baulk', m.X(BAULK_Y), m.y0 + m.th + 22, '#ffe9a8', 15); tag(ctx, 'top cushion', m.X(TL) - 30, m.y0 - 6, '#ffe9a8', 15);
    },
    setup() {
      const m = miniTable(ctx, w, h, { k: 1.3 });
      for (const id of COLOURS) m.ball(id, SPOT[id].x, SPOT[id].y);
      const ax = MID_X, ay = SPOT[20].y + 2 * R + 0.001;
      for (let r = 0; r < 3; r++) for (let c = 0; c <= r; c++) m.ball(1, ax + (c - r / 2) * (2 * R + 0.0004), ay + r * (Math.sqrt(3) * R + 0.0004));
      tag(ctx, '6-red frame', w / 2, 16, '#ffe9a8', 16);
    },
    values() {
      const items = [['white', 0], ['red 1', 1], ['yellow 2', 16], ['green 3', 17], ['brown 4', 18], ['blue 5', 19], ['pink 6', 20], ['black 7', 21]];
      const sp = w / items.length;
      items.forEach(([t, id], i) => { drawBall(ctx, sp * (i + 0.5), h * 0.4, Math.min(24, sp * 0.34), id, {}); ctx.fillStyle = C.ink; ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(t, sp * (i + 0.5), h * 0.4 + 46); void VALUE; void nameOf; });
    },
    aim() {
      const m = miniTable(ctx, w, h, { k: 1.4 });
      m.ball(1, 1.15, 2.15); m.ball(0, 0.55, 1.0, 1);
      m.ball(0, 1.0, 1.95, 0.5);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.X(1.0), m.Y(0.55)); ctx.lineTo(m.X(1.95), m.Y(1.0)); ctx.stroke();
      ctx.strokeStyle = '#ffd447'; ctx.beginPath(); ctx.moveTo(m.X(2.15), m.Y(1.15)); ctx.lineTo(m.X(TL), m.Y(TW)); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, 'ghost white', m.X(1.95), m.Y(0.45), '#fff', 15); tag(ctx, 'red goes this way', m.X(2.9), m.Y(1.45), '#ffd447', 15);
    },
    spin() { drawSpinFace(ctx, w / 2, h / 2, Math.min(w, h) / 2 - 14, 0.4, 0.3, { labels: true }); },
    power() {
      roundPath(ctx, 10, h / 2 - 34, w - 20, 68, 16); ctx.fillStyle = '#0c2a1d'; ctx.fill();
      const g = ctx.createLinearGradient(w * 0.2, 0, w - 20, 0); g.addColorStop(0, '#2fd37a'); g.addColorStop(0.6, '#e8d447'); g.addColorStop(1, '#f2503a');
      roundPath(ctx, w * 0.2, h / 2 - 12, w * 0.7, 24, 12); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#e0bc84'; ctx.fillRect(w * 0.12, h / 2 - 5, w * 0.6, 10); ctx.fillStyle = '#3a78d8'; ctx.fillRect(w * 0.72, h / 2 - 5, 8, 10);
      drawBall(ctx, w - 30, h / 2, 14, 0, {});
      tag(ctx, '◄ pull back', w * 0.45, h / 2 - 48, '#ffe9a8', 17);
    },
    d() {
      const m = miniTable(ctx, w, h, { k: 1.3 });
      ctx.fillStyle = 'rgba(255,224,120,0.25)'; ctx.beginPath(); for (let i = 0; i <= 30; i++) { const a = Math.PI / 2 + (i / 30) * Math.PI; const px = m.X(BAULK_Y + Math.cos(a) * D_R * -1 * -1), py = m.Y(MID_X + Math.sin(a) * D_R); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      m.ball(0, MID_X - 0.05, 0.45);
      tag(ctx, 'the D', m.X(0.4), m.Y(MID_X + 0.55), '#ffe9a8', 16);
    },
    fouls() {
      const m = miniTable(ctx, w, h, { k: 1.4 });
      m.ball(1, 1.0, 2.6); m.ball(19, 1.35, 1.75); m.ball(0, 0.5, 0.9);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.X(0.9), m.Y(0.5)); ctx.lineTo(m.X(1.65), m.Y(1.3)); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, 'red is on: blue first = foul, 5 points', w / 2, 16, '#ffb6a0', 16);
    },
    snooker() {
      const m = miniTable(ctx, w, h, { k: 1.4 });
      m.ball(21, 0.9, 1.7); m.ball(1, 0.9, 2.6); m.ball(0, 0.9, 0.9);
      tag(ctx, 'the black blocks the red: snookered', w / 2, 16, '#ffe9a8', 16);
    },
  };
  (A[key] ?? A.table)();
  ctx.restore();
}
