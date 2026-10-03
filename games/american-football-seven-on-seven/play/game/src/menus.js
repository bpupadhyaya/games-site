// Every screen that is not the live play: title, setup, settings, learn, result, pause, Think card, play-call screens, lesson cards and the paginated
// About / How to Play / Rules reader. Pure drawing; game.js owns the state. Text follows the 100-300% size setting on every screen.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawDiagram, drawField, fieldMap, drawDot, TEAM_COL } from './art.js';
import { LEVELS, ROLES, QUARTER_NAME, FIELD } from './consts.js';
import { OFF_PLAYS, DEF_CALLS } from './plays.js';
import { ABOUT, HOWTO, RULES, LESSONS, ROLE_TEXT } from './content.js';
import { callName, matrixNote } from './coach.js';

let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; pageCache.clear(); };
export const resetPages = () => pageCache.clear();
const estCtx = { font: '', measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
const PAIR_NAME = { QB: 'Quarterback / Safety', RB: 'Running back / Linebacker', WR: 'Wide receiver / Cornerback', TE: 'Tight end / Defensive lineman' };
const PAIR_SUB = { QB: 'Throw the ball. On defence guard the deep middle.', RB: 'Run the ball. On defence stop the run and cover.', WR: 'Run routes and catch. On defence cover a receiver.', TE: 'Block and catch. On defence rush the quarterback.' };
export const PAIRS = ['QB', 'RB', 'WR', 'TE'];

export function ensureLayout(state, key) {
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], learn: [learnWidgets, 0, H], result: [resultWidgets, 0, H],
    demolimit: [demoLimitWidgets, 0, H], pause: [pauseWidgets, 70, H - 70], hint: [hintWidgets, 70, H - 70], lesson: [lessonWidgets, 70, H - 70], roleintro: [roleIntroWidgets, 70, H - 70],
    call: [callWidgets, 0, 1130], fourth: [fourthWidgets, 0, H], try: [tryWidgets, 0, H], watchcall: [watchWidgets, 0, H],
  };
  const d = defs[key];
  if (!d) return;
  const opts = ['pause', 'hint', 'lesson', 'roleintro'].includes(key) ? { x: 60, w: 600 } : {};
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx], opts);
  if (['pause', 'hint', 'lesson', 'roleintro'].includes(key)) {      // cards are centred: the same rectangle the renderer draws
    const top = 70, bottom = H - 70, ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
    LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  } else LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

function backdrop(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e2a1a'); g.addColorStop(0.5, '#123824'); g.addColorStop(1, '#0a1c12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 3;
  for (let y = 80; y < H; y += 110) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,10,14,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,10,14,${a})`); g.addColorStop(1, `rgba(6,10,14,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function heroArt(state) {
  return {
    t: 'art', h: 560,
    draw(ctx, w) {
      const cx = w / 2;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(255,200,120,0.95)'; spaced(ctx, 'SEVEN ON SEVEN', cx, 60, 6);
      ctx.font = `800 104px ${NUM}`; textShadow(ctx, 'AMERICAN', cx, 160, '#fff4d6', 14);
      ctx.font = `800 104px ${NUM}`; textShadow(ctx, 'FOOTBALL', cx, 252, '#ffb26a', 14);
      ctx.restore();
      drawDiagram(ctx, { x: cx - 230, y: 282, w: 460, h: 270 }, { offId: state.heroPlay || 'quick', defId: state.heroDef || 'zone', team: 0 });
    },
  };
}
export function titleWidgets(state) {
  const wd = [heroArt(state)];
  if (state.resume) wd.push({ t: 'btn', id: 'continue', label: 'Continue game', sub: `${state.resume.score[0]} to ${state.resume.score[1]}, quarter ${state.resume.q}`, primary: true, h: 92 }, { t: 'btn', id: 'play', label: 'New game vs Computer', h: 80 });
  else wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'learn', label: 'Learn', row: 1 }, { t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 }, { t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 }, { t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  return wd;
}
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New Game', size: 48 }, { t: 'p', label: 'Your position (you keep it for the whole game)', bold: true, color: '#ffe9bf', size: 26 }];
  for (const id of PAIRS) wd.push({ t: 'btn', id: `role-${id}`, label: PAIR_NAME[id], sub: PAIR_SUB[id], active: s.role === id || ROLES.find((r) => r.id === s.role)?.pair === id, h: 92 });
  wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9bf', size: 26 });
  LEVELS.forEach((pf, i) => {
    const won = rec.wins[i] ?? 0, locked = demo && i > 1;
    wd.push({ t: 'btn', id: `lv${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.level === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
  });
  wd.push({ t: 'p', label: 'Quarter length', bold: true, color: '#ffe9bf', size: 26 });
  QUARTER_NAME.forEach((n, i) => wd.push({ t: 'btn', id: `q${i}`, label: n, row: 9, active: s.quarter === i, disabled: demo && i !== 0, hitDisabled: true }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-women', label: st.women ? 'Players: Women' : 'Players: Men', sub: 'The look of the players on the 3D field', active: st.women },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 }, { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 }, { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 },
  ];
}
export function learnWidgets(state) {
  const done = state.record.lessons || [];
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Short lessons: downs, calling a play, your position and defence. Each sets up a real play and asks for one thing.', size: 24, color: 'rgba(255,243,214,0.9)' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: done.includes(l.id) ? 'Done' : l.goal, active: done.includes(l.id), h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function resultWidgets(state) {
  const o = state.over;
  if (!o) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const w = o.winner, mode = o.mode;
  const title = w < 0 ? 'A draw' : mode === 'watch' ? `${w === 0 ? 'Blue' : 'Red'} wins` : w === 0 ? 'You win!' : 'You lose';
  const wd = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${o.score[0]} – ${o.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }, { t: 'p', label: 'Blue  vs  Red', bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const [a, b] = o.stats;
  const rows = [['Plays', a.plays, b.plays], ['First downs', a.firstDowns, b.firstDowns], ['Rushing yards', a.rushYds, b.rushYds], ['Passes', `${a.passComp}/${a.pass}`, `${b.passComp}/${b.pass}`], ['Passing yards', a.passYds, b.passYds], ['Touchdowns', a.tds, b.tds], ['Field goals', a.fgs, b.fgs], ['Sacks', a.sacks, b.sacks], ['Interceptions', a.ints, b.ints], ['Turnovers', a.turnovers, b.turnovers]];
  rows.forEach(([k, x, y]) => wd.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: `Games won against ${LEVELS[o.level].name}: ${state.record.wins[o.level] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  wd.push({ t: 'gap', h: 16 }, { t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 }, { t: 'btn', id: 'new', label: 'New game', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true }, { t: 'gap', h: 30 });
  return wd;
}
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 }, { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 }, { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 }, { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.mode === 'lesson' ? '' : 'Your game is kept', dark: true, row: 8 },
  ];
}
export function hintWidgets(state) {
  const h = state.hint;
  const wd = [{ t: 'h', label: 'Think', size: 48 }];
  (h ? h.lines : []).forEach((l) => wd.push({ t: 'p', label: l, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' }));
  wd.push({ t: 'gap', h: 10 });
  if (h && h.apply) wd.push({ t: 'btn', id: 'hint-do', label: h.applyLabel || 'Do it', primary: true, h: 84 });
  wd.push({ t: 'btn', id: 'hint-close', label: 'Close', dark: true, h: 76 });
  return wd;
}
export function roleIntroWidgets(state) {
  const r = ROLES.find((x) => x.id === state.setup.role) || ROLES[0];
  const key = r.unit === 'off' ? r.id : r.pair;
  const T = ROLE_TEXT[key] || ROLE_TEXT.QB;
  return [{ t: 'h', label: 'Your position', size: 44, color: '#f2b441' }, { t: 'h', label: PAIR_NAME[key], size: 40 }, { t: 'p', label: T.off, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' }, { t: 'p', label: T.def, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' }, { t: 'btn', id: 'role-go', label: 'Got it', primary: true, h: 84 }];
}
export function lessonWidgets(state) {
  const L = state.lesson;
  if (!L) return [];
  const d = L.def;
  if (L.phase === 'intro') { const wd = [{ t: 'h', label: `Lesson ${L.idx + 1}`, size: 40, color: '#f2b441' }, { t: 'h', label: d.title, size: 52 }]; d.intro.forEach((l) => wd.push({ t: 'p', label: l, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' })); wd.push({ t: 'p', label: `Goal: ${d.goal}`, size: 24, cap: 3, bold: true, color: '#ffe9bf' }, { t: 'btn', id: 'ls-start', label: 'Start', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Back', dark: true, h: 76 }); return wd; }
  if (L.phase === 'done') { const last = L.idx === LESSONS.length - 1; return [{ t: 'h', label: 'Well done', size: 52, color: '#9fe8b4' }, { t: 'p', label: d.done, size: 26, cap: 3, color: 'rgba(255,243,214,0.96)' }, { t: 'btn', id: 'ls-next', label: last ? 'Finish' : 'Next lesson', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Lessons', dark: true, h: 76 }]; }
  return [{ t: 'h', label: 'Not quite', size: 52, color: '#ffb4a0' }, { t: 'p', label: `The goal was: ${d.goal}. Try again.`, size: 26, cap: 3, color: 'rgba(255,243,214,0.96)' }, { t: 'btn', id: 'ls-retry', label: 'Try again', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Lessons', dark: true, h: 76 }];
}
export function demoLimitWidgets() {
  return [{ t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 }, { t: 'p', label: 'You have played the short game of the web demo. The full game on iPhone and Android has all five opponents, longer quarters and your saved records.', size: 28 }, { t: 'gap', h: 20 }, { t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
}

// ---- the play-call screens ------------------------------------------------------------------------------------------------------------------------------------
const sitLine = (E) => { const M = E.m; const own = M.yl <= 20 ? `own ${M.yl}` : `opponent ${FIELD.LEN - M.yl}`; return `${['1st', '2nd', '3rd', '4th'][M.down - 1]} & ${M.toGo}, ball on the ${own}`; };
function diagramArt(sel, off, h = 330) {
  return { t: 'art', h, draw(ctx, w, hh) { drawDiagram(ctx, { x: 0, y: 0, w, h: hh }, off ? { offId: sel, defId: null, showDef: false, team: 0 } : { offId: 'quick', defId: sel, showOff: false, team: 0 }); } };
}
export function callWidgets(state) {
  const E = state.E, need = E.need;
  const off = need.kind === 'offcall';
  const list = off ? OFF_PLAYS : DEF_CALLS;
  const sel = state.sel && list.some((p) => p.id === state.sel) ? state.sel : list[0].id;
  const cur = list.find((p) => p.id === sel);
  const M = E.m;
  const wd = [{ t: 'gap', h: 4 }, { t: 'h', label: off ? 'Call your play' : 'Call your defence', size: 40 }, { t: 'p', label: `${sitLine(E)}  ·  ${M.score[0]}–${M.score[1]}  ·  Q${M.q}  ${Math.floor(M.clock / 60)}:${String(Math.floor(M.clock % 60)).padStart(2, '0')}`, size: 22, color: '#ffe9bf', cap: 2 }];
  wd.push(diagramArt(sel, off, 300));
  wd.push({ t: 'p', label: cur.name + ': ' + cur.short, bold: true, size: 26, color: '#fff3d6' });
  wd.push({ t: 'p', label: cur.desc, size: 22, color: 'rgba(255,243,214,0.9)', cap: 3 });
  wd.push({ t: 'p', label: matrixNote(off ? 'off' : 'def', cur.id), size: 20, color: '#9fe8ff', cap: 3 });
  list.forEach((p, i) => wd.push({ t: 'btn', id: `pick-${p.id}`, label: p.name, row: 20 + Math.floor(i / 2), active: p.id === sel, h: 70 }));
  wd.push({ t: 'gap', h: 120 });
  return wd;
}
export function fourthWidgets(state) {
  const E = state.E, o = E.need.options;
  const wd = [{ t: 'gap', h: 60 }, { t: 'h', label: 'Fourth down', size: 48 }, { t: 'p', label: sitLine(E), size: 26, color: '#ffe9bf' }];
  wd.push({ t: 'btn', id: 'go', label: 'Go for it', sub: `Call a play, ${E.m.toGo} yard${E.m.toGo === 1 ? '' : 's'} to go`, h: 92 });
  wd.push({ t: 'btn', id: 'punt', label: 'Punt', sub: o.punt ? 'Kick it away, about 24 yards' : 'Too close to the goal line', disabled: !o.punt, hitDisabled: true, h: 92 });
  wd.push({ t: 'btn', id: 'fg', label: 'Field goal', sub: o.fg ? `${o.fgDist} yard kick, ${Math.round(o.fgChance * 100)}% to be good` : 'Too far', disabled: !o.fg, hitDisabled: true, h: 92 });
  wd.push({ t: 'gap', h: 20 }, { t: 'btn', id: 'think4', label: 'Think', dark: true, h: 76 });
  return wd;
}
export function tryWidgets() {
  return [{ t: 'gap', h: 80 }, { t: 'h', label: 'Touchdown! Now the try', size: 48 }, { t: 'btn', id: 'kick', label: 'Kick the extra point', sub: '1 point, usually good', primary: true, h: 92 }, { t: 'btn', id: 'two', label: 'Go for two', sub: 'Run one play from the 3 yard line, 2 points', h: 92 }];
}
export function watchWidgets(state) {
  const w = state.watch, E = state.E, need = E.need;
  const kind = need.kind === 'offcall' ? 'Offence' : need.kind === 'defcall' ? 'Defence' : need.kind === 'fourth' ? 'Fourth down' : 'Try';
  const team = need.team === 0 ? 'Blue' : 'Red';
  const wd = [{ t: 'gap', h: 60 }, { t: 'h', label: `${team}: ${kind}`, size: 44 }, { t: 'p', label: sitLine(E), size: 24, color: '#ffe9bf' }];
  if (need.kind === 'offcall' || need.kind === 'defcall') wd.push(diagramArt(w && w.phase === 'reveal' ? need.pick.value : (need.kind === 'offcall' ? 'quick' : 'zone'), need.kind === 'offcall', 280));
  if (w && w.phase === 'think') wd.push({ t: 'p', label: `Thinking...  ${Math.max(0, Math.ceil(w.dur - w.t))} s`, size: 28, bold: true, color: '#9fe8ff' });
  else if (w) { wd.push({ t: 'p', label: `Call: ${need.kind === 'fourth' ? ({ go: 'Go for it', punt: 'Punt', fg: 'Field goal' })[need.pick.value] : need.kind === 'try' ? (need.pick.value === 'two' ? 'Go for two' : 'Kick') : callName(need.pick.value)}`, size: 30, bold: true, color: '#ffd97a' }); need.pick.why.forEach((l) => wd.push({ t: 'p', label: l, size: 22, cap: 3, color: 'rgba(255,243,214,0.95)' })); }
  return wd;
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(1, 'rgba(6,10,14,0.75)'); ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#14202a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#14202a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(estCtx, widgets, sc);
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) { const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th); roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill(); scrollHint(ctx, top, bottom, scroll, maxScroll); }
  return { scroll, maxScroll, lay };
}
export function renderTitle(ctx, state) { backdrop(ctx); scrim(ctx, 0.18); drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H); if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); } }
export function renderSetup(ctx, state) {
  backdrop(ctx); scrim(ctx, 0.6);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H); g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(0.2, 'rgba(6,10,14,0.88)'); g.addColorStop(1, 'rgba(6,10,14,0.96)'); ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  const pz = Math.round(30 * Math.min(TEXT_SCALES[state.settings.textIdx], 2.2)); drawButton(ctx, SETUP_PINS.start, 'Kick off', { primary: true, size: pz }); drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: Math.round(pz * 0.9) });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) { backdrop(ctx); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H); }
export function renderLearn(ctx, state) { backdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, H); }
export function renderResult(ctx, state) { backdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H); }
export function renderDemoLimit(ctx, state) { backdrop(ctx); scrim(ctx, 0.7); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H); }
export function renderCall(ctx, state) {
  backdrop(ctx); scrim(ctx, 0.5);
  const need = state.E.need;
  if (need.kind === 'fourth') drawFlowScreen(ctx, state, 'fourth', fourthWidgets(state), 0, H);
  else if (need.kind === 'try') drawFlowScreen(ctx, state, 'try', tryWidgets(), 0, H);
  else {
    drawFlowScreen(ctx, state, 'call', callWidgets(state), 0, 1130);
    const g = ctx.createLinearGradient(0, 1100, 0, H); g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(0.2, 'rgba(6,10,14,0.88)'); g.addColorStop(1, 'rgba(6,10,14,0.96)'); ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
    const pz = Math.round(30 * Math.min(TEXT_SCALES[state.settings.textIdx], 2.2)); drawButton(ctx, SETUP_PINS.start, 'Run play', { primary: true, size: pz }); drawButton(ctx, SETUP_PINS.back, 'Think', { dark: true, size: Math.round(pz * 0.9) });
  }
}
export function renderWatchCall(ctx, state) { backdrop(ctx); scrim(ctx, 0.55); drawFlowScreen(ctx, state, 'watchcall', watchWidgets(state), 0, H); drawButton(ctx, { x: 480, y: 1196, w: 220, h: 64 }, state.paused ? 'Resume' : 'Pause', { dark: true, size: Math.round(26 * Math.min(TEXT_SCALES[state.settings.textIdx], 1.4)) }); }

function cardOverlay(ctx, state, key, widgets) {
  scrim(ctx, 0.55);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(estCtx, widgets, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70, ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(14,26,32,0.96)', stroke: 'rgba(242,180,65,0.6)' });
  LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch), sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0); scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}
export const renderPause = (ctx, s) => cardOverlay(ctx, s, 'pause', pauseWidgets(s));
export const renderHint = (ctx, s) => cardOverlay(ctx, s, 'hint', hintWidgets(s));
export const renderLesson = (ctx, s) => cardOverlay(ctx, s, 'lesson', lessonWidgets(s));
export const renderRoleIntro = (ctx, s) => cardOverlay(ctx, s, 'roleintro', roleIntroWidgets(s));

// ---- reference pages --------------------------------------------------------------------------------------------------------------------------------------------
const pageCache = new Map();
function pagesFor(state, list, header) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(estCtx, list, sc); pageCache.set(pkey, pages); }
  return pages;
}
const LISTS = { howto: [HOWTO, 'How to Play'], about: [ABOUT, 'About'], rules: [RULES, 'Rules'] };
export const pageCount = (state) => { const [l, h] = LISTS[state.scene] ?? [ABOUT, 'About']; return pagesFor(state, state.scene === 'about' ? (state.creditsList ?? l) : l, h).length; };
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80, secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.y + 120, limit = PANEL.y + PANEL.h - 70;
  const pages = []; let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = []; sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art ? 250 : 0;
    let full = titleH + artH + 26; lines.forEach((l, k) => { full += lineH(l, k); });
    if (!cur || used + full > limit - top) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 ? sec.art : null, artH: part === 0 ? artH : 0, lines: [], part };
      let h = titleH + blk.artH + 26;
      while (i < lines.length) { const add = lineH(lines[i], blk.lines.length); if (used + h + add > limit - top && (blk.lines.length > 0 || used > 0)) break; blk.lines.push({ ...lines[i] }); h += add; i++; }
      cur.blocks.push(blk); used += h; part++;
      if (i >= lines.length) break;
      newPage();
    }
  });
  return pages;
}
export function renderPages(ctx, state, list, header) {
  backdrop(ctx); scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pages = pagesFor(state, list, header);
  const idx = Math.min(state.page, pages.length - 1), pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(244,240,228,0.97)', stroke: 'rgba(181,128,31,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#8c3a14'; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(20,32,42,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(20,32,42,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = '#d8452a'; ctx.font = `800 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += pg.lh * 0.45; ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85); y += pg.lh; });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(20,32,42,0.7)'; ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 }); drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 }); drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  if (key === 'field') {
    const mp = fieldMap({ x: 0, y: 0, w: 230, h }, 0, FIELD.TOTAL, 0); drawField(ctx, mp, { labels: false });
    drawDot(ctx, mp.sx(0), mp.sy(20), 9, 0, {}); drawDot(ctx, mp.sx(2), mp.sy(23), 9, 1, {});
    ctx.fillStyle = '#14202a'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'left';
    ['Blue end zone (6 yd)', 'Goal line', 'Goal to goal: 40 yd', 'Goal line', 'Red end zone (6 yd)'].forEach((t, i) => ctx.fillText(t, 250, mp.sy([3, 6, 26, 46, 49][i]) + 6));
  } else if (key.startsWith('off:')) drawDiagram(ctx, { x: 0, y: 0, w, h }, { offId: key.slice(4), showDef: false, team: 0 });
  else if (key.startsWith('def:')) drawDiagram(ctx, { x: 0, y: 0, w, h }, { offId: 'quick', defId: key.slice(4), showOff: false, team: 0 });
  ctx.restore();
}
void TEAM_COL;
