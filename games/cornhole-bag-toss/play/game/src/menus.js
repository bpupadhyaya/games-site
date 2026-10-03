// Every screen that is not the play screen: title, setup, settings, learn list, result, pause, the set-up sheet, the quiz lesson, and the
// paginated About / How to Play / Rules reader with its illustrations (drawn with the game's own board and bags). Pure drawing.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawStill, drawBags, drawParts, interpBags, TAU } from './scene.js';
import { PROFILES, ASSIST } from './ai.js';
import { LENGTHS, pointsOf, BAGS_EACH } from './engine.js';
import { STYLES, BOARD_W, BOARD_L, HOLE_V, HOLE_R, BAG_HALF, G, RELEASE, arcPoints, BOARD_Z0, COS_A, holeWorld } from './phys.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ } from './content.js';
import { SPIN_NAMES, sideName, bagMark } from './view.js';

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], learn: [learnWidgets, 0, H],
    result: [(st) => (st.m.cfg.mode === 'learn' ? lessonResultWidgets(st) : resultWidgets(st)), 0, H], demolimit: [demoLimitWidgets, 0, H], sheet: [sheetWidgets, 90, H - 20], why: [whyWidgets, 90, H - 20],
    quiz: [quizWidgets, 0, H],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx], key === 'sheet' || key === 'why' ? { x: 50, w: 620 } : undefined);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// ---- the live backyard behind the title and the menus --------------------------------------------------------------------------
export function drawAttract(ctx, state) {
  const a = state.att, cam = a.cam;
  drawStill(ctx, cam, state.t);
  drawBags(ctx, cam, interpBags(a.sim, a.alpha));
  drawParts(ctx, cam, a.parts);
}

function heroArt() {
  return {
    t: 'art', h: 400,
    draw(ctx, w) {
      const cx = w / 2;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(255,230,160,0.95)';
      spaced(ctx, 'BACKYARD BAG TOSS', cx, 88, 8);
      ctx.font = `800 138px ${NUM}`;
      textShadow(ctx, 'CORNHOLE', cx, 214, '#fff8e4', 18);
      bagMark(ctx, cx - 96, 262, 22, 0); bagMark(ctx, cx + 96, 262, 22, 1);
      ctx.strokeStyle = 'rgba(255,230,160,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 250, 262); ctx.lineTo(cx - 140, 262); ctx.moveTo(cx + 140, 262); ctx.lineTo(cx + 250, 262); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 262, 10, 0, TAU); ctx.fillStyle = '#ffe08a'; ctx.fill();
      ctx.restore();
    },
  };
}

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(), { t: 'gap', h: 292 }];
  if (state.resume) {
    const r = state.resume, who = r.cfg.mode === 'two' ? 'Two players' : PROFILES[r.cfg.opp]?.name ?? 'Opponent';
    wd.push({ t: 'btn', id: 'continue', label: 'Continue game', sub: `${who}, ${r.score[0]} to ${r.score[1]}`, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'play', label: 'New game vs Computer', h: 80 });
  } else wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'learn', label: 'Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Game', size: 48 }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Game length', bold: true, color: '#ffe9bf', size: 26 });
  LENGTHS.forEach((l) => {
    const locked = demo && l.id !== 0;
    wd.push({ t: 'btn', id: `len${l.id}`, label: l.name, sub: locked ? 'In the full game' : l.note, active: s.len === l.id && !locked, disabled: locked, hitDisabled: true, h: 84 });
  });
  wd.push({ t: 'p', label: 'Aim steadiness', bold: true, color: '#ffe9bf', size: 26 });
  ASSIST.forEach((a, i) => wd.push({ t: 'btn', id: `as${i}`, label: a.name, row: 11, active: state.settings.assist === i }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-ghost', label: st.ghost ? 'Landing guide: ring and ghost' : 'Landing guide: ring only', sub: 'The ghost bag shows where a perfect throw would stop', active: st.ghost },
    { t: 'p', label: `Aim steadiness: ${ASSIST[st.assist].name}`, bold: true, color: '#ffe9bf', size: 26 },
    ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: a.name, row: 12, active: st.assist === i })),
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Language: Play in English.', size: 22, color: 'rgba(255,233,191,0.8)' },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function learnWidgets(state) {
  const done = state.record.learn ?? 0;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: `${LESSONS.length} short lessons with a goal each. They are free, always.`, size: 24, color: '#ffe9bf' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: i < done ? 'Done' : i === done ? 'Next up' : 'Open', active: i < done, primary: i === done, h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

export function resultWidgets(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = (s) => sideName(state, s);
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${nm(winner)} wins` : winner === 0 ? 'You win!' : 'You lose';
  const wd = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.score[0]} – ${m.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
    { t: 'p', label: `${nm(0)}  vs  ${nm(1)}`, bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const a = m.stats[0], b = m.stats[1];
  const rows = [['Rounds played', m.rounds.length, m.rounds.length], ['Bags in the hole', a.holes, b.holes], ['Bags on the board', a.boards, b.boards], ['Bags off the board', a.outs, b.outs]];
  rows.forEach(([k, x, y]) => wd.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: `Games won against ${PROFILES[m.cfg.opp].name}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  wd.push({ t: 'gap', h: 16 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New game', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}
export function lessonResultWidgets(state) {
  const L = state.m.lesson, won = L.passed, last = L.idx >= LESSONS.length - 1;
  const wd = [{ t: 'gap', h: 60 }, { t: 'h', label: won ? 'Lesson passed' : 'Not this time', size: 56 },
    { t: 'p', label: won ? `${L.title}: goal reached.` : `${L.title}: the goal was not reached. Try the Think button.`, size: 26 }, { t: 'gap', h: 16 }];
  if (won && !last) wd.push({ t: 'btn', id: 'lnext', label: 'Next lesson', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'lagain', label: won ? 'Play it again' : 'Try again', primary: !(won && !last), h: 84 });
  wd.push({ t: 'btn', id: 'lmenu', label: 'Lessons', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

// The scoring lesson: a round is shown on a board picture and the player picks who scores how much.
export function quizAnswers(q) {
  const pa = q.bags.reduce((n, [s, k]) => n + (s === 0 ? (k === 'hole' ? 3 : 1) : 0), 0), pb = q.bags.reduce((n, [s, k]) => n + (s === 1 ? (k === 'hole' ? 3 : 1) : 0), 0);
  const net = pa - pb, right = net === 0 ? 'Nobody scores' : `${net > 0 ? 'Red' : 'Blue'} scores ${Math.abs(net)}`;
  const opts = [right, `Red scores ${pa}`, `Blue scores ${pb}`, 'Nobody scores', `Red scores ${Math.abs(net) + 1}`, `Blue scores ${Math.abs(net) + 1}`];
  const uniq = [...new Set(opts)];
  const wrong = uniq.filter((o) => o !== right);
  const picks = [right, wrong[(pa + pb) % wrong.length], wrong[(pa * 3 + pb + 1) % wrong.length]];
  const final = [...new Set(picks)];
  while (final.length < 3) final.push(wrong.find((w) => !final.includes(w)));
  const order = [(pa + pb) % 3, (pa + 2 * pb + 1) % 3];
  const arr = final.slice(); [arr[0], arr[order[0]]] = [arr[order[0]], arr[0]];
  return { right, options: arr, pa, pb };
}
export function quizWidgets(state) {
  const L = state.m.lesson, qi = L.q, q = QUIZ[qi], A = quizAnswers(q);
  const wd = [{ t: 'gap', h: 24 }, { t: 'h', label: `Question ${qi + 1} of ${QUIZ.length}`, size: 44 },
    { t: 'p', label: `Red has ${A.pa} points on the board, blue has ${A.pb}. Who scores this round?`, size: 26, color: '#ffe9bf' },
    { t: 'art', h: 330, draw(ctx, w, h) { drawQuizBoard(ctx, w, h, q); } }];
  if (L.feedback) wd.push({ t: 'p', label: L.feedback, size: 26, bold: true, color: L.lastOk ? '#9fe8b4' : '#ffb4a0' });
  A.options.forEach((o, i) => wd.push({ t: 'btn', id: `ans${i}`, label: o, h: 84, disabled: !!L.feedback && L.lastOk && L.chosen !== o, active: L.chosen === o && L.lastOk }));
  if (L.feedback && L.lastOk) wd.push({ t: 'btn', id: 'qnext', label: qi + 1 >= QUIZ.length ? 'Finish' : 'Next question', primary: true, h: 88 });
  wd.push({ t: 'btn', id: 'qquit', label: 'Back to the lessons', dark: true, h: 76 }, { t: 'gap', h: 30 });
  return wd;
}
function drawQuizBoard(ctx, w, h, q) {
  const sx = (h - 40) / BOARD_L;
  const bags = layoutQuizBags(q);
  topBoard(ctx, w / 2 - (BOARD_W * sx) / 2, 20, sx, bags);
  const A = quizAnswers(q);
  ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ff9a8c'; ctx.fillText(`Red: ${A.pa}`, w / 2 - (BOARD_W * sx) / 2 - 24, 60);
  ctx.textAlign = 'left'; ctx.fillStyle = '#8ec0ff'; ctx.fillText(`Blue: ${A.pb}`, w / 2 + (BOARD_W * sx) / 2 + 24, 60);
}
export function layoutQuizBags(q) {
  const spots = [[-0.16, 0.2], [0.14, 0.34], [-0.1, 0.5], [0.12, 0.66], [-0.14, 0.82], [0.1, 0.18]];
  let k = 0;
  return q.bags.map(([side, kind], i) => (kind === 'hole' ? { id: i, side, st: 'hole', u: 0, v: HOLE_V, yaw: 0 } : { id: i, side, st: 'board', u: spots[k][0], v: spots[k++][1], yaw: (i * 0.7) % 1.2 - 0.6 }));
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    ...(state.m && state.m.cfg.mode === 'learn' ? [{ t: 'p', label: state.m.lesson.text, size: 22, color: '#ffe9bf' }] : []),
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Back to the lessons' : 'Your game is kept', dark: true },
  ];
}

// The set-up sheet used at the larger text sizes instead of the inline controls.
export function sheetWidgets(state) {
  const p = state.plan, lock = state.m && state.m.lesson && state.m.lesson.style != null;
  const aimX = Math.round(p.aimX * 100), depth = Math.round(((p.aimZ - BOARD_Z0) / COS_A) * 100);
  const sideTxt = (v) => (v === 0 ? 'centre line' : v < 0 ? `${-v} cm left` : `${v} cm right`);
  const dTxt = depth < 0 ? `${-depth} cm short of the board` : depth > 122 ? `${depth - 122} cm past the board` : `${depth} cm up the board`;
  return [
    { t: 'h', label: 'Set up your throw', size: 40 },
    ...(state.guide ? [{ t: 'p', label: state.guide, size: 24, color: '#e8fbff' }] : []),
    { t: 'p', label: `Style: ${STYLES[p.style].name}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'sty-', label: '◄ Lower', row: 1, disabled: p.style <= 0 || lock },
    { t: 'btn', id: 'sty+', label: 'Higher ►', row: 1, disabled: p.style >= 2 || lock },
    { t: 'p', label: `Spin: ${SPIN_NAMES[p.spin + 2]}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'spin-', label: '◄ Left', row: 2, disabled: p.spin <= -2 },
    { t: 'btn', id: 'spin+', label: 'Right ►', row: 2, disabled: p.spin >= 2 },
    { t: 'p', label: `Landing: ${sideTxt(aimX)}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'aim-', label: '◄ Left', row: 3 },
    { t: 'btn', id: 'aim+', label: 'Right ►', row: 3 },
    { t: 'p', label: `Distance: ${dTxt}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'dep-', label: '▼ Shorter', row: 4 },
    { t: 'btn', id: 'dep+', label: 'Longer ▲', row: 4 },
    { t: 'btn', id: 'think', label: state.hint && state.hint.busy ? 'Thinking...' : 'Think', dark: true },
    ...(state.hint && !state.hint.busy ? [{ t: 'p', label: state.hint.text, size: 22, color: '#bff3ff' }, { t: 'btn', id: 'use', label: 'Use this throw', primary: true }] : []),
    { t: 'btn', id: 'close', label: 'Done', primary: true, h: 88 },
    { t: 'btn', id: 'smenu', label: 'Menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Pause, rules, quit to the lessons' : 'Pause, rules, quit (your game is kept)', dark: true, h: 84 },
    { t: 'gap', h: 20 },
  ];
}
export function whyWidgets(state) {
  return [
    { t: 'h', label: state.why.title, size: 40 },
    { t: 'p', label: state.why.text, size: 26, color: '#e8fbff', align: 'left' },
    ...(state.m && state.m.cfg.mode === 'watch' ? [
      { t: 'p', label: `Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
      { t: 'btn', id: 'wdec', label: 'Shorter', row: 5, disabled: state.settings.thinkIdx === 0 },
      { t: 'btn', id: 'winc', label: 'Longer', row: 5, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 },
    ] : []),
    { t: 'btn', id: 'wclose', label: 'Close', primary: true, h: 88 },
    { t: 'gap', h: 20 },
  ];
}
export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the two short games of the web demo. The full game on iPhone and Android has all five opponents, the 21-point and exact-21 games, Two Players and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(8,16,8,${a * 0.7})`); g.addColorStop(0.5, `rgba(8,16,8,${a})`); g.addColorStop(1, `rgba(8,16,8,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,16,8,0)'); g.addColorStop(1, 'rgba(8,16,8,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom, opts) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, opts);
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
function backdrop(ctx, state, a) { ctx.save(); drawAttract(ctx, state); ctx.restore(); scrim(ctx, a); }
export function renderTitle(ctx, state) {
  drawAttract(ctx, state);
  const g = ctx.createLinearGradient(0, 560, 0, H); g.addColorStop(0, 'rgba(8,16,8,0)'); g.addColorStop(0.35, 'rgba(8,16,8,0.80)'); g.addColorStop(1, 'rgba(8,16,8,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 560, W, H - 560);
  const t = ctx.createLinearGradient(0, 0, 0, 330); t.addColorStop(0, 'rgba(8,16,8,0.82)'); t.addColorStop(1, 'rgba(8,16,8,0)'); ctx.fillStyle = t; ctx.fillRect(0, 0, W, 330);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.7);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(8,16,8,0)'); g.addColorStop(0.2, 'rgba(8,16,8,0.88)'); g.addColorStop(1, 'rgba(8,16,8,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  const zz = TEXT_SCALES[state.settings.textIdx];
  drawButton(ctx, SETUP_PINS.start, 'Start the game', { primary: true, size: Math.round(32 * Math.min(zz, 1.7)) });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: Math.round(28 * Math.min(zz, 2)) });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderQuiz(ctx, state) { backdrop(ctx, state, 0.82); drawFlowScreen(ctx, state, 'quiz', quizWidgets(state), 0, H); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.84); drawFlowScreen(ctx, state, 'result', state.m.cfg.mode === 'learn' ? lessonResultWidgets(state) : resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(18,28,14,0.95)', stroke: 'rgba(255,220,130,0.55)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export function renderWhy(ctx, state) {
  scrim(ctx, 0.78);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(18,28,14,0.97)', stroke: 'rgba(125,232,255,0.55)' });
  drawFlowScreen(ctx, state, 'why', whyWidgets(state), top, bottom, { x: 50, w: 620 });
}
export function renderSheet(ctx, state) {
  scrim(ctx, 0.7);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(18,28,14,0.96)', stroke: 'rgba(255,220,130,0.55)' });
  drawFlowScreen(ctx, state, 'sheet', sheetWidgets(state), top, bottom, { x: 50, w: 620 });
}

// ---- reference pages --------------------------------------------------------------------------
let PAGE_COUNT = 1;
export const pageCount = () => PAGE_COUNT;
// The reader is one continuous column: the pages are laid end to end, each one SLOT tall, and the window shows a part of it. The player can drag
// (or use the wheel, the arrow keys, Page Up / Down) to scroll to any line; Back / Next jump a whole page. The scroll bar on the right shows where
// the window is in the whole text.
export const READER = { slot: 1, view: 1, max: 0 };
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
    const tl = wrapLines(ctx, `${sec.title} (cont.)`, tw);
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
const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.72);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const top = PANEL.y + 100, bottom = PANEL.y + PANEL.h - 52, slot = PANEL.h - 190 + 24;
  READER.slot = slot; READER.view = bottom - top; READER.max = Math.max(0, pages.length * slot - READER.view);
  if (state.ui.rsKey !== pkey) { state.ui.rsKey = pkey; state.ui.rsPage = -1; }
  if (state.ui.rsPage !== state.page) { state.ui.rs = Math.min(READER.max, Math.max(0, Math.min(state.page, pages.length - 1) * slot)); state.ui.rsPage = state.page; }
  state.ui.rs = Math.min(READER.max, Math.max(0, state.ui.rs ?? 0));
  const rs = state.ui.rs;
  const idx = Math.min(pages.length - 1, Math.max(0, Math.round(rs / slot)));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,244,224,0.97)', stroke: 'rgba(120,86,40,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  // the window on the text
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 10, top, PANEL.w - 20, bottom - top); ctx.clip();
  pages.forEach((pg, pi) => {
    const y0 = PANEL.y + 120 + pi * slot - rs;
    if (y0 > bottom || y0 + slot < top) return;
    drawReaderPage(ctx, pg, state, y0);
  });
  ctx.restore();
  // fade at the top and the bottom edge of the window when there is more text beyond it
  if (rs > 2) { const g = ctx.createLinearGradient(0, top, 0, top + 26); g.addColorStop(0, 'rgba(250,244,224,0.95)'); g.addColorStop(1, 'rgba(250,244,224,0)'); ctx.fillStyle = g; ctx.fillRect(PANEL.x + 10, top, PANEL.w - 20, 26); }
  if (rs < READER.max - 2) { const g = ctx.createLinearGradient(0, bottom - 26, 0, bottom); g.addColorStop(0, 'rgba(250,244,224,0)'); g.addColorStop(1, 'rgba(250,244,224,0.95)'); ctx.fillStyle = g; ctx.fillRect(PANEL.x + 10, bottom - 26, PANEL.w - 20, 26); }
  // the scroll bar
  if (READER.max > 0) {
    const th = Math.max(54, (bottom - top) * ((bottom - top) / (pages.length * slot))), ty = top + (rs / READER.max) * (bottom - top - th);
    roundPath(ctx, PANEL.x + PANEL.w - 18, top, 8, bottom - top, 4); ctx.fillStyle = 'rgba(110,76,40,0.16)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 18, ty, 8, th, 4); ctx.fillStyle = 'rgba(140,31,27,0.7)'; ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}${READER.max > 0 ? '  ·  drag to scroll' : ''}`, W / 2, PANEL.y + PANEL.h - 22);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 && rs < 4 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, rs >= READER.max - 4 ? 'Done' : 'Next', { primary: true, size: 32 });
}
function drawReaderPage(ctx, pg, state, y0) {
  let y = y0;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.red; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(blk.part > 0 || k < blk.tl.length - 1 ? l : l.replace(/ ?\(cont\.\)$/, ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
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
}

// ---- illustrations: drawn with the game's own board and bags -----------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#355f2a'); g.addColorStop(1, '#5a9640');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(120,86,40,0.8)'; ctx.lineWidth = 2; ctx.stroke();
};
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// The board from above: the back edge at the top, the thrower at the bottom. (bx, by) is the top-left corner, sx pixels per metre.
export function topBoard(ctx, bx, by, sx, bags, o = {}) {
  const bh = BOARD_L * sx;
  ctx.save();
  roundPath(ctx, bx, by, BOARD_W * sx, bh, 5); ctx.fillStyle = '#ecd6aa'; ctx.fill(); ctx.strokeStyle = '#7a4e28'; ctx.lineWidth = 2; ctx.stroke();
  const P = (u, v) => ({ x: bx + (u + BOARD_W / 2) * sx, y: by + (BOARD_L - v) * sx });
  ctx.fillStyle = '#2d6ac4'; ctx.fillRect(bx + 3, by + 3, BOARD_W * sx - 6, 6); ctx.fillStyle = '#c0372e'; ctx.fillRect(bx + 3, by + bh - 9, BOARD_W * sx - 6, 6);
  const hp = P(0, HOLE_V);
  ctx.beginPath(); ctx.arc(hp.x, hp.y, HOLE_R * sx, 0, TAU); ctx.fillStyle = '#140c06'; ctx.fill();
  const bagPx = BAG_HALF * sx;
  let k = 0;
  for (const b of bags) {
    if (b.st === 'hole') { const a = k++ * 1.4; bagMark(ctx, hp.x + Math.cos(a) * 4, hp.y + Math.sin(a) * 4, HOLE_R * sx * 0.62, b.side, 0.95); continue; }
    if (b.st !== 'board') continue;
    const p = P(b.u, b.v);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-(b.yaw || 0));
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-bagPx + 1.5, -bagPx + 2, bagPx * 2, bagPx * 2);
    bagMark(ctx, 0, 0, bagPx, b.side); ctx.restore();
  }
  void o;
  ctx.restore();
  return P;
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    layout() {
      stage(ctx, 0, 0, w, h);
      const sx = (h - 40) / BOARD_L, bx = w * 0.12;
      topBoard(ctx, bx, 20, sx, [{ id: 1, side: 0, st: 'hole', u: 0, v: HOLE_V }, { id: 2, side: 0, st: 'board', u: -0.12, v: 0.4, yaw: 0.3 }, { id: 3, side: 1, st: 'board', u: 0.1, v: 0.62, yaw: -0.4 }]);
      label(ctx, 'Hole: 3 points', w * 0.5, h * 0.22, 21, '#fff2cf', 'left');
      label(ctx, 'On the board: 1 point', w * 0.5, h * 0.22 + 32, 21, '#fff2cf', 'left');
      label(ctx, 'Off the board: 0', w * 0.5, h * 0.22 + 64, 21, '#fff2cf', 'left');
      label(ctx, 'Four bags each.', w * 0.5, h * 0.22 + 112, 21, '#ffe08a', 'left');
      label(ctx, 'Only the difference scores.', w * 0.5, h * 0.22 + 144, 21, '#ffe08a', 'left');
    },
    board() {
      stage(ctx, 0, 0, w, h);
      const sx = (h - 60) / BOARD_L, bx = w * 0.12;
      topBoard(ctx, bx, 24, sx, []);
      const cm = (v) => `${Math.round(v * 100)} cm`;
      label(ctx, `${cm(BOARD_W)}`, bx + (BOARD_W * sx) / 2, 17, 17, '#fff2cf');
      label(ctx, `${cm(BOARD_L)} long`, bx + BOARD_W * sx + 12, 24 + (BOARD_L * sx) / 2, 17, '#fff2cf', 'left');
      label(ctx, `hole ${cm(HOLE_R * 2)}`, bx + BOARD_W * sx + 12, 24 + (BOARD_L - HOLE_V) * sx + 5, 17, '#ffe08a', 'left');
      label(ctx, 'back edge', w * 0.55, 46, 17, '#fff2cf', 'left');
      label(ctx, 'front edge (you)', w * 0.55, h - 22, 17, '#fff2cf', 'left');
      arrow(ctx, w * 0.78, h - 40, w * 0.78, 70, '#ffd36a', 3);
      label(ctx, 'slopes up', w * 0.8, h * 0.5, 17, '#ffe08a', 'left');
    },
    score() {
      stage(ctx, 0, 0, w, h);
      const sx = (h - 40) / BOARD_L, bx = w * 0.1;
      topBoard(ctx, bx, 20, sx, [{ id: 1, side: 0, st: 'hole', u: 0, v: HOLE_V }, { id: 2, side: 0, st: 'board', u: -0.14, v: 0.36, yaw: 0.25 }]);
      label(ctx, 'In the hole: 3', w * 0.5, h * 0.25, 22, '#fff2cf', 'left');
      label(ctx, 'On the board: 1', w * 0.5, h * 0.25 + 40, 22, '#fff2cf', 'left');
      label(ctx, 'Bag total: 4', w * 0.5, h * 0.25 + 90, 22, '#ffe08a', 'left');
    },
    dead() {
      stage(ctx, 0, 0, w, h);
      const sx = (h - 50) / BOARD_L, bx = w * 0.38;
      topBoard(ctx, bx, 20, sx, [{ id: 1, side: 0, st: 'board', u: 0.1, v: 0.5, yaw: 0.2 }]);
      bagMark(ctx, bx - 60, 20 + BOARD_L * sx * 0.5, BAG_HALF * sx, 1, 0.55);
      bagMark(ctx, bx + BOARD_W * sx + 50, 20 + BOARD_L * sx * 0.3, BAG_HALF * sx, 0, 0.55);
      bagMark(ctx, bx + BOARD_W * sx / 2, h - 22, BAG_HALF * sx, 1, 0.55);
      label(ctx, 'off the side', bx - 60, 20 + BOARD_L * sx * 0.5 + 44, 16, '#ffb4a0');
      label(ctx, 'off the side', bx + BOARD_W * sx + 50, 20 + BOARD_L * sx * 0.3 + 44, 16, '#ffb4a0');
      label(ctx, 'hit the ground first', w * 0.2, h - 12, 16, '#ffb4a0');
      label(ctx, 'Faded bags do not count.', w * 0.08, 56, 19, '#fff2cf', 'left');
    },
    cancel() {
      stage(ctx, 0, 0, w, h);
      const sx = (h - 40) / BOARD_L, bx = w * 0.06;
      topBoard(ctx, bx, 20, sx, [{ id: 1, side: 0, st: 'hole', u: 0, v: HOLE_V }, { id: 2, side: 0, st: 'board', u: -0.14, v: 0.36, yaw: 0.25 }, { id: 3, side: 1, st: 'board', u: 0.1, v: 0.55, yaw: -0.3 }, { id: 4, side: 1, st: 'board', u: -0.1, v: 0.7, yaw: 0.5 }]);
      label(ctx, 'Red: 3 + 1 = 4', w * 0.42, h * 0.25, 21, '#ff9a8c', 'left');
      label(ctx, 'Blue: 1 + 1 = 2', w * 0.42, h * 0.25 + 34, 21, '#8ec0ff', 'left');
      label(ctx, '4 minus 2 = 2', w * 0.42, h * 0.25 + 84, 22, '#fff2cf', 'left');
      label(ctx, 'Red scores 2.', w * 0.42, h * 0.25 + 118, 22, '#ffe08a', 'left');
      label(ctx, 'Blue scores 0.', w * 0.42, h * 0.25 + 150, 22, '#ffe08a', 'left');
    },
    pull() {
      stage(ctx, 0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 6; ctx.setLineDash([2, 12]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.25); ctx.lineTo(w * 0.38, h * 0.82); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(w * 0.3, h * 0.25, 9, 0, TAU); ctx.fillStyle = 'rgba(255,236,170,0.6)'; ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.38, h * 0.82, 20, 0, TAU); ctx.fillStyle = 'rgba(255,248,226,0.95)'; ctx.fill(); ctx.strokeStyle = '#d29632'; ctx.lineWidth = 3; ctx.stroke();
      arrow(ctx, w * 0.5, h * 0.3, w * 0.6, h * 0.3, '#ffe08a'); label(ctx, 'bag goes this way', w * 0.62, h * 0.3 + 6, 19, '#fff2cf', 'left');
      label(ctx, 'pull back and sideways', w * 0.5, h * 0.7, 19, '#fff2cf', 'left'); label(ctx, 'longer pull = longer throw', w * 0.5, h * 0.7 + 28, 19, '#fff2cf', 'left');
    },
    styles() {
      // a side view of the three flights from the hand to the hole, drawn from the real flight plans
      stage(ctx, 0, 0, w, h);
      const hz = holeWorld(), z1 = hz.z + 0.3, zs = (w - 60) / (z1 - RELEASE.z), gy = h - 26, ys = (h - 60) / 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, gy); ctx.lineTo(w - 10, gy); ctx.stroke();
      const cols = ['#ffb4a0', '#ffe08a', '#9fe8b4'];
      STYLES.forEach((st, i) => {
        const pts = arcPoints({ style: i, spin: 0, aimX: 0, aimZ: hz.z - 0.2 }, 30);
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 4; ctx.beginPath();
        pts.forEach((p, k) => { const px = 30 + (p.z - RELEASE.z) * zs, py = gy - p.y * ys; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
        label(ctx, st.name, 30 + (w - 60) * (0.22 + i * 0.0) , 30 + i * 26, 19, cols[i], 'left');
      });
      ctx.fillStyle = '#ecd6aa'; ctx.beginPath(); ctx.moveTo(30 + (BOARD_Z0 - RELEASE.z) * zs, gy - 0.09 * ys); ctx.lineTo(30 + (BOARD_Z0 + BOARD_L * COS_A - RELEASE.z) * zs, gy - 0.3 * ys); ctx.lineTo(30 + (BOARD_Z0 + BOARD_L * COS_A - RELEASE.z) * zs, gy); ctx.lineTo(30 + (BOARD_Z0 - RELEASE.z) * zs, gy); ctx.closePath(); ctx.fill();
      label(ctx, 'you', 30, gy + 20, 16, '#fff2cf', 'left'); label(ctx, 'board', 30 + (BOARD_Z0 - RELEASE.z) * zs, gy + 20, 16, '#fff2cf', 'left');
    },
  };
  (A[key] ?? A.layout)();
  ctx.restore();
}
export { G, pointsOf, BAGS_EACH };
