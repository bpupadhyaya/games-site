// Every screen that is not the play screen: title, setup, settings, learn list, result, pause, the set-up sheet, and the paginated About /
// How to Play / Rules reader with its illustrations (drawn with the game's own pitch layout). Pure drawing.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES, ASSIST } from './ai.js';
import { SIZES } from './engine.js';
import { LOFTS, SPINS, FIELD } from './phys.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { drawScene, sideName } from './view.js';
import { TEAM, TAU } from './scene.js';

// ---- flow screens ------------------------------------------------------------------------------------------------------------
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

function heroArt() {
  return {
    t: 'art', h: 330,
    draw(ctx, w) {
      const cx = w / 2;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,232,150,0.95)';
      spaced(ctx, 'THE NORDIC LAWN GAME', cx, 84, 6);
      ctx.font = `800 128px ${NUM}`;
      textShadow(ctx, 'KUBB', cx, 192, '#fff6dc', 18);
      ctx.strokeStyle = 'rgba(255,232,150,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 220, 216); ctx.lineTo(cx - 36, 216); ctx.moveTo(cx + 36, 216); ctx.lineTo(cx + 220, 216); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 216, 9, 0, TAU); ctx.fillStyle = '#ffe08a'; ctx.fill();
      ctx.restore();
    },
  };
}
export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(), { t: 'gap', h: 200 }];
  if (state.resume) {
    const r = state.resume, who = r.cfg.mode === 'two' ? 'Two players' : PROFILES[r.cfg.opp]?.name ?? 'Opponent';
    const a = r.blocks.filter((b) => b.team === 0 && b.role !== 'cleared').length, b = r.blocks.filter((x) => x.team === 1 && x.role !== 'cleared').length;
    wd.push({ t: 'btn', id: 'continue', label: 'Continue match', sub: `${who}, ${a} kubbs to ${b}`, primary: true, h: 92 });
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
    wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9a8', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Game size', bold: true, color: '#ffe9a8', size: 26 });
  SIZES.forEach((l) => {
    const locked = demo && l.id > 0;
    wd.push({ t: 'btn', id: `size${l.id}`, label: l.name, sub: locked ? 'In the full game' : l.note, active: s.size === l.id && !locked, disabled: locked, hitDisabled: true, h: 84 });
  });
  wd.push({ t: 'p', label: 'Opening turns', bold: true, color: '#ffe9a8', size: 26 });
  wd.push({ t: 'btn', id: 'open1', label: 'Official: 2 batons, then 4', sub: 'The usual way to start', row: 9, active: s.opening !== false });
  wd.push({ t: 'btn', id: 'open0', label: 'Six batons every turn', sub: 'A faster game', row: 9, active: s.opening === false });
  wd.push({ t: 'p', label: 'Aim steadiness', bold: true, color: '#ffe9a8', size: 26 });
  ASSIST.forEach((a, i) => wd.push({ t: 'btn', id: `as${i}`, label: a.name, row: 11, active: state.settings.assist === i }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Aim steadiness: ${ASSIST[st.assist].name}`, bold: true, color: '#ffe9a8', size: 26 },
    ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: a.name, row: 12, active: st.assist === i })),
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Language: Play in English. The Swedish word kubb (a block of wood) is explained in About and Rules.', size: 22, color: 'rgba(255,233,168,0.85)' },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a8' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}
export function learnWidgets(state) {
  const done = state.record.learn ?? 0;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Four short lessons with a goal each: throwing, field kubbs, the baseline and the king. They are free, always.', size: 24, color: '#ffe9a8' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: i < done ? 'Done' : i === done ? 'Next up' : 'Open', active: i < done, primary: i === done, h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function resultWidgets(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = (s) => sideName(state, s);
  const title = winner < 0 ? 'A draw' : mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${nm(winner)} wins` : winner === 0 ? 'You win!' : 'You lose';
  const left = (t) => m.blocks.filter((b) => b.team === t && b.role !== 'cleared').length;
  const wd = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 },
    { t: 'p', label: o.why, size: 26, cap: 2.2, color: '#ffe9a8' },
    { t: 'p', label: `${nm(0)} (${TEAM[0].name})  vs  ${nm(1)} (${TEAM[1].name})`, bold: true, color: '#ffe9a8', size: 24, cap: 2 }];
  [['Turns played', `${m.turnNo + 1}`], ['Baseline kubbs knocked down', `${m.knocked[0]}  –  ${m.knocked[1]}`], ['Field kubbs cleared', `${m.cleared[0]}  –  ${m.cleared[1]}`], ['Kubbs still on the lawn', `${left(0)}  –  ${left(1)}`]]
    .forEach(([k, v]) => wd.push({ t: 'p', label: `${k}:  ${v}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: `Matches won against ${PROFILES[m.cfg.opp].name}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`, size: 22, cap: 2, color: '#ffe9a8' });
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
    { t: 'p', label: won ? `${L.title}: goal reached with ${L.used} ${L.used === 1 ? 'baton' : 'batons'}.` : `${L.title}: ${L.failMsg ?? 'the goal was not reached'}. Try the Think button.`, size: 26 }, { t: 'gap', h: 16 }];
  if (won && !last) wd.push({ t: 'btn', id: 'lnext', label: 'Next lesson', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'lagain', label: won ? 'Play it again' : 'Try again', primary: !(won && !last), h: 84 });
  wd.push({ t: 'btn', id: 'lmenu', label: 'Lessons', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    ...(state.m && state.m.cfg.mode === 'learn' ? [{ t: 'p', label: state.m.lesson.text, size: 22, color: '#ffe9a8' }] : []),
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Back to the lessons' : 'Your match is kept', dark: true },
  ];
}
// The set-up sheet used at the larger text sizes instead of the inline controls.
export function sheetWidgets(state) {
  const p = state.plan, sx = Math.round(p.sx * 100);
  const side = (v) => (v === 0 ? 'centre' : v < 0 ? `${-v} cm left` : `${v} cm right`);
  return [
    { t: 'h', label: 'Set up your throw', size: 40 },
    { t: 'p', label: `Loft: ${LOFTS[p.loft].name}`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'loft-', label: 'Flatter', row: 1, disabled: p.loft <= 0 },
    { t: 'btn', id: 'loft+', label: 'Higher', row: 1, disabled: p.loft >= 2 },
    { t: 'p', label: `Spin: ${SPINS[p.spin].name}`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'spin-', label: 'Slower', row: 2, disabled: p.spin <= 0 },
    { t: 'btn', id: 'spin+', label: 'Faster', row: 2, disabled: p.spin >= 2 },
    { t: 'p', label: `Where you stand: ${side(sx)}`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'st-', label: '◄ Left', row: 3 },
    { t: 'btn', id: 'st+', label: 'Right ►', row: 3 },
    { t: 'p', label: 'To aim and throw, drag back on the pitch like a slingshot and let go.', size: 22, color: 'rgba(255,233,168,0.85)' },
    { t: 'btn', id: 'think', label: state.hint && state.hint.busy ? 'Testing...' : 'Think', dark: true },
    ...(state.hint && !state.hint.busy ? [{ t: 'p', label: state.hint.text, size: 22, color: '#bff3ff' }, { t: 'btn', id: 'use', label: 'Use this throw', primary: true }] : []),
    { t: 'btn', id: 'close', label: 'Done', primary: true, h: 88 },
    { t: 'btn', id: 'smenu', label: 'Menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Pause, rules, quit to the lessons' : 'Pause, rules, quit (your match is kept)', dark: true, h: 84 },
    { t: 'gap', h: 20 },
  ];
}
export function whyWidgets(state) {
  return [
    { t: 'h', label: state.why.title, size: 40 },
    { t: 'p', label: state.why.text, size: 26, color: '#e8fbff', align: 'left' },
    { t: 'btn', id: 'wclose', label: 'Close', primary: true, h: 88 },
    { t: 'gap', h: 20 },
  ];
}
export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the two short matches of the web demo. The full game on iPhone and Android has all five opponents, the full-size game, Two Players and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(4,12,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,12,6,${a})`); g.addColorStop(1, `rgba(4,12,6,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,12,6,0)'); g.addColorStop(1, 'rgba(4,12,6,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,190,0.92)'; ctx.fill();
    ctx.fillStyle = '#1b2417'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,190,0.92)'; ctx.fill();
    ctx.fillStyle = '#1b2417'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,244,210,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
// The live lawn behind the title and the menus: a baton knocks kubbs over now and then.
export function drawAttract(ctx, state) { drawScene(ctx, state.att.scene); }
function backdrop(ctx, state, a) { ctx.save(); drawAttract(ctx, state); ctx.restore(); scrim(ctx, a); }

export function renderTitle(ctx, state) {
  drawAttract(ctx, state);
  const g = ctx.createLinearGradient(0, 520, 0, H); g.addColorStop(0, 'rgba(4,12,6,0)'); g.addColorStop(0.35, 'rgba(4,12,6,0.82)'); g.addColorStop(1, 'rgba(4,12,6,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 520, W, H - 520);
  const t = ctx.createLinearGradient(0, 0, 0, 330); t.addColorStop(0, 'rgba(4,12,6,0.82)'); t.addColorStop(1, 'rgba(4,12,6,0)'); ctx.fillStyle = t; ctx.fillRect(0, 0, W, 330);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.74);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(4,12,6,0)'); g.addColorStop(0.2, 'rgba(4,12,6,0.88)'); g.addColorStop(1, 'rgba(4,12,6,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.78); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.84); drawFlowScreen(ctx, state, 'result', state.m.cfg.mode === 'learn' ? lessonResultWidgets(state) : resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.6);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(8,22,12,0.95)', stroke: 'rgba(255,232,150,0.55)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export function renderWhy(ctx, state) {
  scrim(ctx, 0.78);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(8,22,12,0.97)', stroke: 'rgba(125,232,255,0.55)' });
  drawFlowScreen(ctx, state, 'why', whyWidgets(state), top, bottom, { x: 50, w: 620 });
}
export function renderSheet(ctx, state) {
  scrim(ctx, 0.7);
  const top = 90, bottom = H - 20;
  panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(8,22,12,0.96)', stroke: 'rgba(255,232,150,0.55)' });
  drawFlowScreen(ctx, state, 'sheet', sheetWidgets(state), top, bottom, { x: 50, w: 620 });
}

// ---- reference pages ---------------------------------------------------------------------------------------------------------------------
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,243,224,0.97)', stroke: 'rgba(120,92,36,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#9a3a14'; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(90,70,30,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(90,70,30,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = '#b8431c'; ctx.font = `700 ${pg.secFs}px ${FONT}`;
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
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,56,30,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6dc'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations: top-down diagrams drawn with the game's own pitch numbers -----------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff2cf', align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2f7a3d'); g.addColorStop(1, '#3f9448');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,230,0.5)'; ctx.lineWidth = 2; ctx.stroke();
};
// A pitch from above: (ox, oy) top-left, k = pixels per metre. y runs from team 1's baseline (top) to team 0's baseline (bottom).
function pitch(ctx, ox, oy, k) {
  const w = FIELD.W * k, h = FIELD.L * k;
  ctx.strokeStyle = 'rgba(255,255,248,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, w, h);
  ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,248,0.45)'; ctx.beginPath(); ctx.moveTo(ox, oy + h / 2); ctx.lineTo(ox + w, oy + h / 2); ctx.stroke(); ctx.setLineDash([]);
}
const px = (ox, oy, k, x, y) => ({ x: ox + (x + FIELD.W / 2) * k, y: oy + (FIELD.L - y) * k });
function kubbDot(ctx, p, team, k, o = {}) {
  const s = Math.max(11, 0.158 * k * 2.1);
  ctx.save();
  if (o.ghost) { ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,230,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s); ctx.restore(); return; }
  ctx.translate(p.x, p.y); if (o.down) ctx.rotate(0.6);
  ctx.fillStyle = TEAM[team].main; ctx.fillRect(-s / 2, -s / 2, s, o.down ? s * 1.5 : s);
  ctx.lineWidth = o.hot ? 3 : 1.5; ctx.strokeStyle = o.hot ? '#fff3a0' : 'rgba(30,18,6,0.8)'; ctx.strokeRect(-s / 2, -s / 2, s, o.down ? s * 1.5 : s);
  ctx.restore();
}
function kingDot(ctx, p, k, o = {}) {
  const s = Math.max(14, 0.2 * k * 2.2);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = o.down ? '#b88a4a' : '#e0a84a'; ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.lineWidth = 2; ctx.strokeStyle = '#6a3f10'; ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = '#fff1b0'; ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.2); ctx.lineTo(-s * 0.3, -s * 0.25); ctx.lineTo(-s * 0.12, 0); ctx.lineTo(0, -s * 0.3); ctx.lineTo(s * 0.12, 0); ctx.lineTo(s * 0.3, -s * 0.25); ctx.lineTo(s * 0.3, s * 0.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const K = (h - 16) / FIELD.L * 0.99, OX = 12, OY = 6;
  const base = (team, n = 5) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 0.64).map((xx) => ({ x: xx, y: team === 0 ? 0 : FIELD.L }));
  const P = (xx, yy) => px(OX, OY, K, xx, yy);
  const A = {
    layout() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(0).forEach((b) => kubbDot(ctx, P(b.x, b.y), 0, K)); base(1).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K));
      kingDot(ctx, P(0, FIELD.MID), K);
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Five kubbs on each baseline,', tx, 60, 19, '#fff2cf', 'left'); label(ctx, 'the king in the middle.', tx, 84, 19, '#fff2cf', 'left');
      label(ctx, 'You throw from the bottom,', tx, 130, 19, '#fff2cf', 'left'); label(ctx, 'your opponent from the top.', tx, 154, 19, '#fff2cf', 'left');
      label(ctx, 'Blue', tx, 204, 20, TEAM[0].hi, 'left'); label(ctx, 'Orange', tx + 70, 204, 20, TEAM[1].hi, 'left');
    },
    batons() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K, { hot: true })); kingDot(ctx, P(0, FIELD.MID), K);
      const a = P(-0.3, 0), b = P(0.64, FIELD.L - 0.2);
      ctx.setLineDash([2, 8]); arrow(ctx, a.x, a.y, b.x, b.y, '#ffe08a', 5); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, TAU); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.stroke();
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Drag back, let go:', tx, 70, 19, '#fff2cf', 'left'); label(ctx, 'the baton flies to the ring', tx, 94, 19, '#fff2cf', 'left'); label(ctx, 'and spins end over end.', tx, 118, 19, '#fff2cf', 'left');
    },
    throwin() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K)); kingDot(ctx, P(0, FIELD.MID), K);
      [[-0.6, 2.1], [0.7, 1.7]].forEach(([xx, yy]) => { kubbDot(ctx, P(xx, yy), 0, K, { down: true }); });
      [[-0.7, 4.3], [0.6, 4.7]].forEach(([xx, yy]) => { const a = P(0, 0.35), b = P(xx, yy); arrow(ctx, a.x, a.y, b.x, b.y + 14, '#ffe08a', 3); kubbDot(ctx, b, 0, K, { hot: true }); });
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Knocked-down kubbs', tx, 70, 19, '#fff2cf', 'left'); label(ctx, 'are thrown back into', tx, 94, 19, '#fff2cf', 'left'); label(ctx, 'the other half. They', tx, 118, 19, '#fff2cf', 'left'); label(ctx, 'stand where they land.', tx, 142, 19, '#fff2cf', 'left');
    },
    field() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K, { ghost: false })); kingDot(ctx, P(0, FIELD.MID), K);
      [[-0.8, 4.3], [0.2, 4.7]].forEach(([xx, yy]) => kubbDot(ctx, P(xx, yy), 0, K, { hot: true }));
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Order: field kubbs', tx, 70, 19, '#fff2cf', 'left'); label(ctx, 'first (bright), then', tx, 94, 19, '#fff2cf', 'left'); label(ctx, 'the baseline, then', tx, 118, 19, '#fff2cf', 'left'); label(ctx, 'the king.', tx, 142, 19, '#fff2cf', 'left');
    },
    advantage() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K)); kingDot(ctx, P(0, FIELD.MID), K);
      const f = P(0.5, 1.5); kubbDot(ctx, f, 1, K, { hot: true });
      ctx.setLineDash([8, 6]); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(OX, f.y); ctx.lineTo(OX + FIELD.W * K, f.y); ctx.stroke(); ctx.setLineDash([]);
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'An orange kubb was left', tx, 60, 19, '#fff2cf', 'left'); label(ctx, 'standing in your half.', tx, 84, 19, '#fff2cf', 'left'); label(ctx, 'You may throw from', tx, 124, 19, '#ffe08a', 'left'); label(ctx, 'the gold line through it.', tx, 148, 19, '#ffe08a', 'left');
    },
    king() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      kingDot(ctx, P(0, FIELD.MID), K, {});
      const a = P(0, 0), b = P(0, FIELD.MID);
      arrow(ctx, a.x, a.y - 8, b.x, b.y + 20, '#ffe08a', 4);
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'All the kubbs down?', tx, 60, 19, '#fff2cf', 'left'); label(ctx, 'Topple the king: you win.', tx, 84, 19, '#9fe8b4', 'left');
      label(ctx, 'King down too early?', tx, 134, 19, '#fff2cf', 'left'); label(ctx, 'You lose at once.', tx, 158, 19, '#ffb4a0', 'left');
    },
    controls() {
      stage(ctx, 0, 0, w, h);
      const cx = w * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundPath(ctx, 14, 14, w * 0.55, h - 28, 14); ctx.fill();
      LOFTS.forEach((l, i) => { const bx = 24 + i * 112, by = 40; roundPath(ctx, bx, by, 104, 40, 10); ctx.fillStyle = i === 0 ? '#2f8f55' : '#1f2c1c'; ctx.fill(); label(ctx, `${l.name} loft`, bx + 52, by + 27, 16, '#fff7e6'); });
      SPINS.forEach((l, i) => { const bx = 24 + i * 112, by = 92; roundPath(ctx, bx, by, 104, 40, 10); ctx.fillStyle = i === 1 ? '#2f8f55' : '#1f2c1c'; ctx.fill(); label(ctx, `${l.name} spin`, bx + 52, by + 27, 16, '#fff7e6'); });
      label(ctx, 'Flat throws hit hard and', w * 0.62, 70, 18, '#fff2cf', 'left'); label(ctx, 'skid; lobs are steadier.', w * 0.62, 94, 18, '#fff2cf', 'left'); label(ctx, 'Spin decides how the', w * 0.62, 130, 18, '#fff2cf', 'left'); label(ctx, 'baton arrives.', w * 0.62, 154, 18, '#fff2cf', 'left');
      void cx;
    },
  };
  (A[key] ?? A.layout)();
  ctx.restore();
}
