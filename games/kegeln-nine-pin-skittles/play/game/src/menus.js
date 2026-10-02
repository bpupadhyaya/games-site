// Every screen that is not the play screen: title, setup, settings, learn list, result, pause, the set-up sheet, and the
// paginated About / How to Play / Rules reader with its illustrations (drawn with the game's own pin layout). Pure drawing.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawRoom, drawLane, drawActors, drawParts, interpSim, TAU } from './scene.js';
import { PROFILES, ASSIST } from './ai.js';
import { LENGTHS, totals, countOf } from './engine.js';
import { PIN_POS, PIN_NAMES, KING, POWERS, pathPoints, LANE_HALF, PIN_Z0 } from './phys.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { HOOK_NAMES, sideName } from './view.js';

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], learn: [learnWidgets, 0, H],
    result: [(st) => (st.m.cfg.mode === 'learn' ? lessonResultWidgets(st) : resultWidgets(st)), 0, H], demolimit: [demoLimitWidgets, 0, H], sheet: [sheetWidgets, 90, H - 20], why: [whyWidgets, 90, H - 20],
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

// ---- the live lane behind the title and menus --------------------------------------------------------------------------
export function drawAttract(ctx, state) {
  const a = state.att, cam = a.cam;
  drawRoom(ctx, cam, state.t); drawLane(ctx, cam, state.t);
  const iv = interpSim(a.sim, a.alpha);
  drawActors(ctx, cam, iv.pins, iv.ball.on ? iv.ball : null, {});
  drawParts(ctx, cam, a.parts);
}

function heroArt(state) {
  return {
    t: 'art', h: 400,
    draw(ctx, w) {
      const cx = w / 2;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(233,193,95,0.95)';
      spaced(ctx, 'NINE-PIN SKITTLES', cx, 88, 8);
      ctx.font = `800 142px ${NUM}`;
      textShadow(ctx, 'KEGELN', cx, 214, '#fff4d6', 18);
      ctx.strokeStyle = 'rgba(233,193,95,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 250, 246); ctx.lineTo(cx - 40, 246); ctx.moveTo(cx + 40, 246); ctx.lineTo(cx + 250, 246); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 246, 9, 0, TAU); ctx.fillStyle = '#e9c15f'; ctx.fill();
      ctx.restore();
    },
  };
}

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(state), { t: 'gap', h: 150 }];
  if (state.resume) {
    const r = state.resume, who = r.cfg.mode === 'two' ? 'Two players' : PROFILES[r.cfg.opp]?.name ?? 'Opponent';
    const a = totals(r, 0).total, b = totals(r, 1).total;
    wd.push({ t: 'btn', id: 'continue', label: 'Continue match', sub: `${who}, ${a} to ${b}`, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'play', label: 'New match vs Computer', h: 80 });
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
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  LENGTHS.forEach((l) => {
    const locked = demo && l.id > 0;
    wd.push({ t: 'btn', id: `len${l.id}`, label: l.name, sub: locked ? 'In the full game' : l.note, row: undefined, active: s.len === l.id && !locked, disabled: locked, hitDisabled: true, h: 84 });
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
    { t: 'btn', id: 'set-replay', label: st.replay ? 'Crash replays: On' : 'Crash replays: Off', sub: 'A small replay of the pin deck after big throws', active: st.replay },
    { t: 'p', label: `Aim steadiness: ${ASSIST[st.assist].name}`, bold: true, color: '#ffe9bf', size: 26 },
    ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: a.name, row: 12, active: st.assist === i })),
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Language: Play in English. The German words stay and are explained in About and Rules.', size: 22, color: 'rgba(255,233,191,0.8)' },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function learnWidgets(state) {
  const done = state.record.learn ?? 0;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Four short lessons with a goal each. They are free, always.', size: 24, color: '#ffe9bf' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: i < done ? 'Done' : i === done ? 'Next up' : 'Open', active: i < done, primary: i === done, h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

// What the throws of a match add up to, for the result screen.
export function matchStats(m, side) {
  const t = m.throws[side];
  const best = t.reduce((a, x) => Math.max(a, x.pins), 0);
  return { ...totals(m, side), alle: t.filter((x) => x.alle).length, kranz: t.filter((x) => x.kranz).length, pudel: t.filter((x) => x.pudel).length, best, throws: t.length };
}
export function resultWidgets(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = (s) => sideName(state, s);
  const title = winner < 0 ? 'A draw' : mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${nm(winner)} wins` : winner === 0 ? 'You win!' : 'You lose';
  const a = matchStats(m, 0), b = matchStats(m, 1);
  const wd = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${a.total} – ${b.total}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
    { t: 'p', label: `${nm(0)}  vs  ${nm(1)}`, bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const rows = [['Volle', a.volle, b.volle], ['Abräumen', a.abr, b.abr], ['Best throw', a.best, b.best], ['Alle Neune', a.alle, b.alle], ['Kranz', a.kranz, b.kranz], ['Pudel', a.pudel, b.pudel]];
  rows.forEach(([k, x, y]) => wd.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: `Matches won against ${PROFILES[m.cfg.opp].name}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  wd.push({ t: 'gap', h: 16 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}
export function lessonResultWidgets(state) {
  const L = state.m.lesson, won = L.passed, last = L.idx >= LESSONS.length - 1;
  const wd = [{ t: 'gap', h: 60 }, { t: 'h', label: won ? 'Lesson passed' : 'Not this time', size: 56 },
    { t: 'p', label: won ? `${L.title}: goal reached in ${L.used} ${L.used === 1 ? 'throw' : 'throws'}.` : `${L.title}: the goal was not reached in ${L.tries} throws. Try the Think button.`, size: 26 }, { t: 'gap', h: 16 }];
  if (won && !last) wd.push({ t: 'btn', id: 'lnext', label: 'Next lesson', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'lagain', label: won ? 'Play it again' : 'Try again', primary: !(won && !last), h: 84 });
  wd.push({ t: 'btn', id: 'lmenu', label: 'Lessons', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
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
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Back to the lessons' : 'Your match is kept', dark: true },
  ];
}

// The set-up sheet used at the larger text sizes instead of the inline controls.
export function sheetWidgets(state) {
  const p = state.plan, a = Math.round(p.aimX * 100), s0 = Math.round(p.x0 * 100);
  const side = (v) => (v === 0 ? 'centre' : v < 0 ? `${-v} cm left` : `${v} cm right`);
  return [
    { t: 'h', label: 'Set up your throw', size: 40 },
    { t: 'p', label: `Hook: ${HOOK_NAMES[p.hook + 3]}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'hook-', label: '◄ Hook left', row: 1, disabled: p.hook <= -3 },
    { t: 'btn', id: 'hook+', label: 'Hook right ►', row: 1, disabled: p.hook >= 3 },
    { t: 'p', label: `Weight: ${POWERS[p.power].name}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'pow-', label: 'Softer', row: 2, disabled: p.power <= 0 },
    { t: 'btn', id: 'pow+', label: 'Firmer', row: 2, disabled: p.power >= 2 },
    { t: 'p', label: `Aim ring: ${side(a)}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'aim-', label: '◄ Aim left', row: 3 },
    { t: 'btn', id: 'aim+', label: 'Aim right ►', row: 3 },
    { t: 'p', label: `Start from: ${side(s0)}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'st-', label: '◄ Start left', row: 4 },
    { t: 'btn', id: 'st+', label: 'Start right ►', row: 4 },
    { t: 'btn', id: 'think', label: state.hint && state.hint.busy ? 'Thinking...' : 'Think', dark: true },
    ...(state.hint && !state.hint.busy ? [{ t: 'p', label: state.hint.text, size: 22, color: '#bff3ff' }, { t: 'btn', id: 'use', label: 'Use this line', primary: true }] : []),
    { t: 'btn', id: 'close', label: 'Done', primary: true, h: 88 },
    { t: 'btn', id: 'smenu', label: 'Menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Pause, rules, quit to the lessons' : 'Pause, rules, quit (your match is kept)', dark: true, h: 84 },
    { t: 'gap', h: 20 },
  ];
}

// The full-screen reader for a status text that was too long for its box at the current text size (Watch & Learn reasons, the Think line).
export function whyWidgets(state) {
  return [
    { t: 'h', label: state.why.title, size: 40 },
    { t: 'p', label: state.why.text, size: 26, color: '#e8fbff', align: 'left' },
    { t: 'btn', id: 'wclose', label: state.why.wasPaused === false && state.m.cfg.mode === 'watch' ? 'Close' : 'Close', primary: true, h: 88 },
    { t: 'gap', h: 20 },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the two short matches of the web demo. The full game on iPhone and Android has all five opponents, three match lengths, Two Players and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,10,8,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,10,8,${a})`); g.addColorStop(1, `rgba(6,10,8,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(1, 'rgba(6,10,8,0.75)');
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

// A calm backdrop for menus: the room and lane, dimmed.
function backdrop(ctx, state, a) {
  ctx.save();
  drawAttract(ctx, state);
  ctx.restore();
  scrim(ctx, a);
}
export function renderTitle(ctx, state) {
  drawAttract(ctx, state);
  const g = ctx.createLinearGradient(0, 560, 0, H); g.addColorStop(0, 'rgba(8,5,3,0)'); g.addColorStop(0.35, 'rgba(8,5,3,0.82)'); g.addColorStop(1, 'rgba(8,5,3,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 560, W, H - 560);
  const t = ctx.createLinearGradient(0, 0, 0, 330); t.addColorStop(0, 'rgba(8,5,3,0.85)'); t.addColorStop(1, 'rgba(8,5,3,0)'); ctx.fillStyle = t; ctx.fillRect(0, 0, W, 330);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.7);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(0.2, 'rgba(6,10,8,0.88)'); g.addColorStop(1, 'rgba(6,10,8,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.84); drawFlowScreen(ctx, state, 'result', state.m.cfg.mode === 'learn' ? lessonResultWidgets(state) : resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(24,18,12,0.94)', stroke: 'rgba(233,193,95,0.55)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export function renderWhy(ctx, state) {
  scrim(ctx, 0.78);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(24,18,12,0.97)', stroke: 'rgba(125,232,255,0.55)' });
  drawFlowScreen(ctx, state, 'why', whyWidgets(state), top, bottom, { x: 50, w: 620 });
}
export function renderSheet(ctx, state) {
  scrim(ctx, 0.7);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(24,18,12,0.96)', stroke: 'rgba(233,193,95,0.55)' });
  drawFlowScreen(ctx, state, 'sheet', sheetWidgets(state), top, bottom, { x: 50, w: 620 });
}

// ---- reference pages --------------------------------------------------------------------------
let PAGE_COUNT = 1;
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
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(247,238,214,0.97)', stroke: 'rgba(154,116,36,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.red; ctx.font = `700 ${pg.secFs}px ${FONT}`;
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
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations: top-down diagrams drawn with the game's own pin layout -----------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2a1a0f'); g.addColorStop(1, '#4a2f1a');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(154,116,36,0.7)'; ctx.lineWidth = 2; ctx.stroke();
};
// A pin seen from above: a disc with a lit edge. `m` is the scale in pixels per metre.
function topPin(ctx, cx, cy, r, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  if (o.ghost) { ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,235,200,0.5)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); return; }
  ctx.fillStyle = o.king ? '#e0b24a' : o.fallen ? '#8d7658' : '#f1e6c8'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.hot ? '#7dffa0' : 'rgba(70,40,15,0.8)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.fillStyle = o.king ? '#b98a22' : o.fallen ? '#6f5b42' : '#c0392b'; ctx.fill();
  ctx.restore();
}
function diamond(ctx, ox, top, m, standing, o = {}) {
  // top is the y of the back pin; the front pin is at the bottom, the ball comes from below
  const depth = PIN_POS[8].z - PIN_Z0;
  PIN_POS.forEach((p, i) => {
    const x = ox + p.x * m, y = top + (depth - (p.z - PIN_Z0)) * m;
    const st = !standing || standing[i];
    topPin(ctx, x, y, 0.06 * m * (o.rk ?? 1), { king: i === KING, ghost: !st, hot: o.hot && o.hot.includes(i) });
  });
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    layout() {
      stage(ctx, 0, 0, w, h);
      const m = 170, ox = w * 0.24;
      diamond(ctx, ox, 24, m, null, { hot: [4] });
      ctx.strokeStyle = 'rgba(255,235,200,0.4)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, 10); ctx.lineTo(ox, h - 6); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'Nine pins in a diamond.', w * 0.5, h * 0.3, 19, '#fff2cf', 'left');
      label(ctx, 'The gold pin in the middle', w * 0.5, h * 0.3 + 32, 18, '#ffe08a', 'left');
      label(ctx, 'is the King (der König).', w * 0.5, h * 0.3 + 56, 18, '#ffe08a', 'left');
      label(ctx, 'The ball comes from below.', w * 0.5, h * 0.3 + 96, 18, '#fff2cf', 'left');
    },
    plan() {
      stage(ctx, 0, 0, w, h);
      const m = 150, ox = w * 0.35, base = h - 18;
      // lane strip
      ctx.fillStyle = 'rgba(230,170,90,0.18)'; ctx.fillRect(ox - LANE_HALF * m, 8, 2 * LANE_HALF * m, h - 16);
      diamond(ctx, ox, 30, m * 0.8, null, { rk: 1 });
      const fy = 30 + 1.004 * m * 0.8;
      const pts = pathPoints(0.2, -0.1, 1, 1);
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.setLineDash([8, 7]); ctx.beginPath();
      pts.forEach((p, i) => { const px = ox + p.x * m, py = base - (p.z / PIN_Z0) * (base - 52); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ox - 0.1 * m, fy, 14, 0, TAU); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(ox + 0.2 * m, base, 12, 0, TAU); ctx.fillStyle = '#4c1c18'; ctx.fill(); ctx.strokeStyle = '#e6c27a'; ctx.stroke();
      label(ctx, 'aim ring', ox - 0.1 * m - 20, fy + 34, 19, '#ffe08a', 'right');
      label(ctx, 'ball start', ox + 0.2 * m + 22, base - 10, 19, '#fff2cf', 'left');
      label(ctx, 'dashed path', w * 0.68, h * 0.55, 19, '#fff2cf', 'left');
      label(ctx, 'includes the hook', w * 0.68, h * 0.55 + 24, 19, '#fff2cf', 'left');
    },
    hooks() {
      stage(ctx, 0, 0, w, h);
      const m = 120, ox = w * 0.32, base = h - 18;
      ctx.fillStyle = 'rgba(230,170,90,0.18)'; ctx.fillRect(ox - LANE_HALF * m, 8, 2 * LANE_HALF * m, h - 16);
      const cols = ['#ff9a7a', '#ffc27a', '#ffe08a', '#ffffff', '#bfe8ff', '#8fd0ff', '#6ab4ff'];
      for (let hk = -3; hk <= 3; hk++) {
        const pts = pathPoints(0, 0, 1, hk, 24);
        ctx.strokeStyle = cols[hk + 3]; ctx.lineWidth = hk === 0 ? 4 : 3; ctx.beginPath();
        pts.forEach((p, i) => { const px = ox + p.x * m, py = base - (p.z / PIN_Z0) * (base - 40); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke();
      }
      label(ctx, 'Seven hooks, all aimed', w * 0.5, h * 0.28, 18, '#fff2cf', 'left');
      label(ctx, 'at the same ring (Medium).', w * 0.5, h * 0.28 + 24, 18, '#fff2cf', 'left');
      label(ctx, 'Big hooks start wide and', w * 0.5, h * 0.28 + 62, 18, '#fff2cf', 'left');
      label(ctx, 'curve in near the end.', w * 0.5, h * 0.28 + 86, 18, '#fff2cf', 'left');
    },
    abr() {
      stage(ctx, 0, 0, w, h);
      const m = 150, left = [false, true, false, true, false, false, true, false, false];
      const t = [false, false, false, false, false, false, false, false, false];
      diamond(ctx, w * 0.2, 30, m * 0.9, left);
      arrow(ctx, w * 0.38, h * 0.45, w * 0.5, h * 0.45);
      diamond(ctx, w * 0.67, 30, m * 0.9, t);
      label(ctx, 'your leftovers', w * 0.2, h - 14, 18, '#fff2cf');
      label(ctx, 'all down: a fresh set', w * 0.74, h - 14, 18, '#ffe08a');
    },
    calls() {
      stage(ctx, 0, 0, w, h);
      const m = 140, d = (cx, standing, text, col) => { diamond(ctx, cx, 24, m, standing); label(ctx, text, cx, h - 14, 18, col); };
      d(w * 0.16, new Array(9).fill(false), 'Alle Neune', '#9fe8b4');
      d(w * 0.5, [false, false, false, false, true, false, false, false, false], 'Kranz', '#ffe08a');
      ctx.strokeStyle = '#ffb4a0'; ctx.lineWidth = 5; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(w * 0.84, h - 40); ctx.quadraticCurveTo(w * 0.86, 120, w * 0.95, 50); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,235,200,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.8, 10); ctx.lineTo(w * 0.8, h - 10); ctx.stroke();
      label(ctx, 'Pudel', w * 0.88, h - 14, 18, '#ffb4a0');
    },
  };
  (A[key] ?? A.layout)();
  ctx.restore();
}
export { countOf, PIN_NAMES };
