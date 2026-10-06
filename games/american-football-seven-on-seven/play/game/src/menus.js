// Every screen that is not the live play: title, setup, settings, learn, result, pause, Think card, play-call screens, lesson cards and the paginated
// About / How to Play / Rules reader. Pure drawing; game.js owns the state. Text follows the 100-300% size setting on every screen.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, LY, READ, host } from './layout.js';
import { drawLockup, drawCredit, drawMoreLine } from './brand.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawDiagram, drawField, fieldMap, drawDot, TEAM_COL } from './art.js';
import { LEVELS, ROLES, QUARTER_NAME, FIELD } from './consts.js';
import { OFF_PLAYS, DEF_CALLS } from './plays.js';
import { ABOUT, HOWTO, RULES, LESSONS, ROLE_TEXT } from './content.js';
import { callName, matrixNote } from './coach.js';

let LAID = { key: '', lay: null, top: 0, bottom: H, left: null };
export const flowMeta = () => LAID;
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: H, left: null }; pageCache.clear(); };
export const resetPages = () => pageCache.clear();
const estCtx = { font: '', measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
const PAIR_NAME = { QB: 'Quarterback / Safety', RB: 'Running back / Linebacker', WR: 'Wide receiver / Cornerback', TE: 'Tight end / Defensive lineman' };
const PAIR_SUB = { QB: 'Throw the ball. On defence guard the deep middle.', RB: 'Run the ball. On defence stop the run and cover.', WR: 'Run routes and catch. On defence cover a receiver.', TE: 'Block and catch. On defence rush the quarterback.' };
export const PAIRS = ['QB', 'RB', 'WR', 'TE'];
const CARDS = ['pause', 'hint', 'lesson', 'roleintro'];

// One plan per screen: which flow panes (widgets + box) it has. ensureLayout (update) and drawFlowScreen (render) both use it, so hit-testing and drawing agree.
function plan(state, key) {
  const U = LY.U, land = LY.land, col = LY.col, top0 = LY.flowTop;
  const full = { x: col.x, w: col.w, top: top0, bottom: LY.flowBottom };
  switch (key) {
    case 'title': {
      if (land) return { panes: [{ wd: titleWidgets(state, true), box: { x: LY.title.col.x, w: LY.title.col.w, top: U.y0 + 10, bottom: U.y1 - 40 }, vcenter: true }] };
      return { panes: [{ wd: titleWidgets(state, false), box: { ...full, x: LY.title.col.x, w: LY.title.col.w, bottom: LY.flowBottom - 36 } }] };
    }
    case 'setup': return { panes: [{ wd: setupWidgets(state), box: { ...full, bottom: LY.setupBottom } }], pins: 'col' };
    case 'settings': return { panes: [{ wd: settingsWidgets(state), box: full }] };
    case 'learn': return { panes: [{ wd: learnWidgets(state), box: full }] };
    case 'result': return { panes: [{ wd: resultWidgets(state), box: full }] };
    case 'demolimit': return { panes: [{ wd: demoLimitWidgets(), box: full, vcenter: land }] };
    case 'fourth': return { panes: [{ wd: fourthWidgets(state), box: full, vcenter: land }] };
    case 'try': return { panes: [{ wd: tryWidgets(), box: full, vcenter: land }] };
    case 'watchcall': return { panes: [{ wd: watchWidgets(state), box: { ...full, bottom: LY.watchPause.y - 8 } }] };
    case 'call': {
      if (!land) return { panes: [{ wd: callWidgets(state, false), box: { ...full, bottom: LY.setupBottom } }], pins: 'col' };
      const cp = LY.callPane;
      const bot = U.y1 - 12 - Math.max(LY.tap, 72) - 22;
      return { panes: [
        { wd: callWidgets(state, 'left'), box: { x: cp.left.x, w: cp.left.w, top: U.y0 + 10, bottom: U.y1 - 10 }, scrollKey: 'scrollL', left: true },
        { wd: callWidgets(state, 'right'), box: { x: cp.right.x, w: cp.right.w, top: U.y0 + 10, bottom: bot } },
      ], pins: { x: cp.right.x - 10, w: cp.right.w + 20 } };
    }
    default: if (CARDS.includes(key)) {
      const wd = { pause: pauseWidgets, hint: hintWidgets, lesson: lessonWidgets, roleintro: roleIntroWidgets }[key](state);
      return { panes: [{ wd, box: { x: LY.card.x, w: LY.card.w, top: LY.card.top, bottom: LY.card.bottom }, card: true }] };
    }
  }
  return null;
}
function applyPins(pl) {
  const S = SETUP_PINS;
  if (!pl || !pl.pins) return;
  const h = S.start.h, y = S.start.y;
  const x = pl.pins === 'col' ? LY.col.x - 10 : pl.pins.x, w = pl.pins === 'col' ? LY.col.w + 20 : pl.pins.w, sw = Math.round(w * 0.64);
  S.start.x = x; S.start.w = sw; S.back.x = x + sw + 16; S.back.w = w - sw - 16; S.start.y = S.back.y = y; S.start.h = S.back.h = h;
}
function layPane(pane, scale, key) {
  const o = pane.card ? { x: pane.box.x, w: pane.box.w } : { x: pane.box.x, w: pane.box.w };
  const lay = flowLayout(estCtx, pane.wd, scale, o);
  let top = pane.box.top, bottom = pane.box.bottom;
  if (pane.card) { const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (top + bottom - ch) / 2); top = y0; bottom = y0 + ch; }
  else if (pane.vcenter && lay.contentH < bottom - top) { const off = Math.round((bottom - top - lay.contentH) / 2); top += off; bottom = top + lay.contentH; }
  return { lay, top, bottom, box: pane.box, scrollKey: pane.scrollKey || 'scroll', left: !!pane.left, card: !!pane.card };
}
function setLaid(state, key, pl) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const ps = pl.panes.map((p) => layPane(p, sc, key));
  const main = ps.find((p) => !p.left) || ps[0], left = ps.find((p) => p.left) || null;
  if (LAID.key !== key) state.ui.scrollL = 0;
  LAID = { key, lay: main.lay, top: main.top, bottom: main.bottom, h: main.lay.contentH, left, main };
  applyPins(pl);
  return ps;
}
export function ensureLayout(state, key) {
  const pl = plan(state, key);
  if (!pl) return;
  setLaid(state, key, pl);
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

// The title hero (lockup, "SEVEN ON SEVEN", AMERICAN FOOTBALL, the play diagram) is designed on a 560 x 610 sheet and scaled to the box it gets.
const HERO_W = 560, HERO_H = 610;
export function drawHero(ctx, state, w, h) {
  const k = Math.max(0.3, Math.min(w / HERO_W, h / HERO_H, 1.3)), cx = w / 2;
  ctx.save(); ctx.translate(cx, Math.max(0, (h - HERO_H * k) / 2)); ctx.scale(k, k);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(255,200,120,0.95)'; spaced(ctx, 'SEVEN ON SEVEN', 0, 110, 6);
  ctx.font = `800 104px ${NUM}`; textShadow(ctx, 'AMERICAN', 0, 210, '#fff4d6', 14);
  ctx.font = `800 104px ${NUM}`; textShadow(ctx, 'FOOTBALL', 0, 302, '#ffb26a', 14);
  drawDiagram(ctx, { x: -230, y: 332, w: 460, h: 270 }, { offId: state.heroPlay || 'quick', defId: state.heroDef || 'zone', team: 0 });
  ctx.restore();
}
let titleLockTap = null, lockDownNow = false;
export const getLockTap = () => titleLockTap;
export const setLockDown = (v) => { lockDownNow = v; };
const LOCK_CAP = 300;
// the themed lockup: bottom centre, directly under the last menu row (a flow item; a backing pill keeps it readable)
const lockupArt = () => ({ t: 'art', brand: true, h: Math.round(LOCK_CAP * 327 / 1200) + 40, draw(ctx, w) {
  const lw = Math.min(w - 30, LOCK_CAP), lh = Math.round(lw * 327 / 1200);
  ctx.save(); ctx.fillStyle = lockDownNow ? 'rgba(255,226,122,0.5)' : 'rgba(6,10,14,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 20 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, w / 2, 20, lw, 1);
} });
function heroArt(state) { return { t: 'art', h: LY.title.heroH || 560, draw(ctx, w, h) { ctx.save(); drawHero(ctx, state, w, h); ctx.restore(); } }; }
export function titleWidgets(state, land = false) {
  const wd = land ? [] : [heroArt(state)];
  if (state.resume) wd.push({ t: 'btn', id: 'continue', label: 'Continue game', sub: `${state.resume.score[0]} to ${state.resume.score[1]}, quarter ${state.resume.q}`, primary: true, h: 92 }, { t: 'btn', id: 'play', label: 'New game vs Computer', h: 80 });
  else wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'learn', label: 'Learn', row: 1 }, { t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 }, { t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 }, { t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push(lockupArt());
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
export function callWidgets(state, mode = false) {
  const E = state.E, need = E.need;
  const off = need.kind === 'offcall';
  const list = off ? OFF_PLAYS : DEF_CALLS;
  const sel = state.sel && list.some((p) => p.id === state.sel) ? state.sel : list[0].id;
  const cur = list.find((p) => p.id === sel);
  const M = E.m;
  const head = [{ t: 'gap', h: 4 }, { t: 'h', label: off ? 'Call your play' : 'Call your defence', size: 40 }, { t: 'p', label: `${sitLine(E)}  ·  ${M.score[0]}–${M.score[1]}  ·  Q${M.q}  ${Math.floor(M.clock / 60)}:${String(Math.floor(M.clock % 60)).padStart(2, '0')}`, size: 22, color: '#ffe9bf', cap: 2 }];
  const info = [diagramArt(sel, off, mode === 'left' ? 260 : LY.h < 1150 ? 210 : 300),
    { t: 'p', label: cur.name + ': ' + cur.short, bold: true, size: 26, color: '#fff3d6' },
    { t: 'p', label: cur.desc, size: 22, color: 'rgba(255,243,214,0.9)', cap: 3 },
    { t: 'p', label: matrixNote(off ? 'off' : 'def', cur.id), size: 22, color: '#9fe8ff', cap: 3 }];
  const btns = list.map((p, i) => ({ t: 'btn', id: `pick-${p.id}`, label: p.name, row: 20 + Math.floor(i / 2), active: p.id === sel, h: 70 }));
  if (mode === 'left') return [...head, ...info, { t: 'gap', h: 20 }];
  if (mode === 'right') return [{ t: 'gap', h: 4 }, { t: 'p', label: off ? 'Choose a play' : 'Choose a defence', bold: true, size: 26, color: '#ffe9bf' }, ...btns, { t: 'gap', h: 10 }];
  return [...head, ...info, ...btns, { t: 'gap', h: 120 }];
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
// Draw every pane of a screen's plan (the plan also sets the hit-test layout, so what is drawn is what is tapped).
function drawFlowScreen(ctx, state, key) {
  const pl = plan(state, key);
  const ps = setLaid(state, key, pl);
  let res = null;
  for (const P of ps) {
    const { lay, top, bottom, box } = P;
    const maxScroll = Math.max(0, lay.contentH - (bottom - top));
    const scroll = Math.min(P.left ? (state.ui.scrollL || 0) : state.ui.scroll, maxScroll);
    drawFlow(ctx, lay, top, bottom, scroll, P.card ? { x: box.x - 20, w: box.w + 40 } : { x: Math.max(0, box.x - 20), w: box.w + 40 });
    if (maxScroll > 0) {
      const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th), bx = Math.min(W - 10, box.x + box.w + 18);
      roundPath(ctx, bx, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, scroll, maxScroll, box.x - 10, box.w + 20);
    }
    if (!P.left) res = { scroll, maxScroll, lay };
  }
  return res;
}
const pinsFade = (ctx) => {
  const y = SETUP_PINS.start.y - 56, g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, 'rgba(6,10,14,0)'); g.addColorStop(0.2, 'rgba(6,10,14,0.88)'); g.addColorStop(1, 'rgba(6,10,14,0.96)');
  ctx.fillStyle = g; ctx.fillRect(LY.land && LY.callPane && LAID.key === 'call' ? SETUP_PINS.start.x - 20 : 0, y, LY.land && LAID.key === 'call' ? SETUP_PINS.start.w + SETUP_PINS.back.w + 56 : W, H - y);
};
export function renderTitle(ctx, state) {
  backdrop(ctx); scrim(ctx, 0.18);
  if (LY.land && LY.title.hero) { const h = LY.title.hero; ctx.save(); ctx.translate(h.x, h.y); ctx.beginPath(); ctx.rect(0, 0, h.w, h.h); ctx.clip(); drawHero(ctx, state, h.w, h.h); ctx.restore(); }
  const fr = drawFlowScreen(ctx, state, 'title');
  titleLockTap = null;
  if (fr) {
    const it = fr.lay.items.find((i) => i.w && i.w.brand);
    if (it) {
      const lw = Math.min(it.wd - 30, LOCK_CAP), lh = Math.round(lw * 327 / 1200), cx = it.x + it.wd / 2, cy = LAID.top + it.y - fr.scroll + 20 + lh / 2;
      const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
      if (cy - th / 2 >= LAID.top - 4 && cy + th / 2 <= LAID.bottom + 4) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (state.demo) { ctx.font = `400 ${LY.minText}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', (LY.U.x0 + LY.U.x1) / 2, LY.U.y1 - 14); }
}
export function renderSetup(ctx, state) {
  backdrop(ctx); scrim(ctx, 0.6);
  drawFlowScreen(ctx, state, 'setup'); pinsFade(ctx);
  const pz = Math.round(30 * Math.min(TEXT_SCALES[state.settings.textIdx], LY.land ? 1.5 : 2.2)); drawButton(ctx, SETUP_PINS.start, 'Kick off', { primary: true, size: pz }); drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: Math.round(pz * 0.9) });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, LY.minText)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, SETUP_PINS.start.x + (SETUP_PINS.start.w + SETUP_PINS.back.w + 16) / 2, SETUP_PINS.start.y - 10); }
}
export function renderSettings(ctx, state) { backdrop(ctx); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'settings'); }
export function renderLearn(ctx, state) { backdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'learn'); }
export function renderResult(ctx, state) {
  backdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result');
  // a quiet line for the Arcforge catalogue, only when there is room below the buttons
  const r = LAID.lay && LAID.lay.contentH <= LAID.bottom - LAID.top - 40;
  if (r) drawMoreLine(ctx, LY.col.x + LY.col.w / 2, LY.U.y1 - 16, Math.max(16, LY.minText * 0.85));
}
export function renderDemoLimit(ctx, state) { backdrop(ctx); scrim(ctx, 0.7); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderCall(ctx, state) {
  backdrop(ctx); scrim(ctx, 0.5);
  const need = state.E.need;
  if (need.kind === 'fourth') drawFlowScreen(ctx, state, 'fourth');
  else if (need.kind === 'try') drawFlowScreen(ctx, state, 'try');
  else {
    drawFlowScreen(ctx, state, 'call'); pinsFade(ctx);
    const pz = Math.round(30 * Math.min(TEXT_SCALES[state.settings.textIdx], LY.land ? 1.5 : 2.2)); drawButton(ctx, SETUP_PINS.start, 'Run play', { primary: true, size: pz }); drawButton(ctx, SETUP_PINS.back, 'Think', { dark: true, size: Math.round(pz * 0.9) });
  }
}
export function renderWatchCall(ctx, state) { backdrop(ctx); scrim(ctx, 0.55); drawFlowScreen(ctx, state, 'watchcall'); drawButton(ctx, LY.watchPause, state.paused ? 'Resume' : 'Pause', { dark: true, size: Math.round(26 * Math.min(TEXT_SCALES[state.settings.textIdx], 1.4)) }); }

function cardOverlay(ctx, state, key) {
  scrim(ctx, 0.55);
  const pl = plan(state, key), ps = setLaid(state, key, pl), P = ps[0];
  const ch = P.bottom - P.top;
  panel(ctx, LY.card.panelX, P.top - 20, LY.card.panelW, ch + 40, { r: 30, fill: 'rgba(14,26,32,0.96)', stroke: 'rgba(242,180,65,0.6)' });
  const maxScroll = Math.max(0, P.lay.contentH - ch), sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, P.lay, P.top, P.bottom, sc0, { x: LY.card.panelX, w: LY.card.panelW }); scrollHint(ctx, P.top, P.bottom, sc0, maxScroll, LY.card.panelX, LY.card.panelW);
}
export const renderPause = (ctx, s) => cardOverlay(ctx, s, 'pause');
export const renderHint = (ctx, s) => cardOverlay(ctx, s, 'hint');
export const renderLesson = (ctx, s) => cardOverlay(ctx, s, 'lesson');
export const renderRoleIntro = (ctx, s) => cardOverlay(ctx, s, 'roleintro');

// ---- reference pages --------------------------------------------------------------------------------------------------------------------------------------------
const pageCache = new Map();
// The reader is one continuous scrolling page (drag, wheel, arrow keys, the More button, the scroll bar); state.page is the scroll offset in px.
const READER = { max: 0, view: 900 };
export const readerMeta = () => READER;
function readerLayout(state, list, header) {
  const scale = TEXT_SCALES[state.settings.textIdx];
  const PANEL = READ.panel;
  const key = `${header}:${scale}:${list.length}:${Math.round(PANEL.w)}`;
  let L = pageCache.get(key);
  if (L) return L;
  const ctx = estCtx, fs = Math.round(28 * scale), lh = fs * 1.26, tw = PANEL.w - 70, secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = []; let y = 10;
  list.forEach((sec, si) => {
    if (si > 0) y += 18;
    ctx.font = `800 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs }); y += tl.length * secFs * 1.2 + 14;
    if (sec.art) { items.push({ k: 'art', y, art: sec.art }); y += 250; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => { if (pi > 0) y += lh * 0.45; wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; }); });
    y += 12; items.push({ k: 'rule', y }); y += 10;
  });
  L = { items, h: y + 30, fs, secFs };
  pageCache.set(key, L);
  return L;
}
export function renderPages(ctx, state, list, header) {
  backdrop(ctx); scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx], PANEL = READ.panel, VIEW = READ.view, pcx = PANEL.x + PANEL.w / 2;
  const L = readerLayout(state, list, header);
  READER.max = Math.max(0, Math.ceil(L.h - VIEW.h)); READER.view = VIEW.h;
  const sy = Math.max(0, Math.min(state.page || 0, READER.max)); state.page = sy;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(244,240,228,0.97)', stroke: 'rgba(181,128,31,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#8c3a14'; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(20,32,42,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 50, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 50, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW.y, PANEL.w - 12, VIEW.h); ctx.clip();
  const x0 = PANEL.x + 35;
  for (const it of L.items) {
    const y = VIEW.y + it.y - sy;
    const hh = it.k === 'art' ? 250 : it.k === 'title' ? it.lines.length * L.secFs * 1.2 : L.fs * 1.3;
    if (y > VIEW.y + VIEW.h || y + hh < VIEW.y) continue;
    if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = '#d8452a'; ctx.font = `800 ${L.secFs}px ${FONT}`; it.lines.forEach((l, k) => ctx.fillText(l, pcx, y + L.secFs * (0.9 + k * 1.2))); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 238); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 238); ctx.restore(); }
    else if (it.k === 'line') { ctx.fillStyle = C.ink; ctx.font = `400 ${L.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, x0, y + L.fs * 0.85); }
    else { ctx.strokeStyle = 'rgba(20,32,42,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 70, y); ctx.lineTo(PANEL.x + PANEL.w - 70, y); ctx.stroke(); }
  }
  ctx.restore();
  if (READER.max > 0) {
    const B = READ.bar, th = Math.max(60, VIEW.h * (VIEW.h / L.h)), ty = VIEW.y + (sy / READER.max) * (VIEW.h - th);
    roundPath(ctx, B.x + 12, VIEW.y, 4, VIEW.h, 2); ctx.fillStyle = 'rgba(140,58,20,0.15)'; ctx.fill();
    roundPath(ctx, B.x + 9, ty, 10, th, 5); ctx.fillStyle = 'rgba(140,58,20,0.7)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, LY.minText)}px ${FONT}`; ctx.textBaseline = 'middle';
    if (sy < READER.max - 4) { roundPath(ctx, pcx - 54, VIEW.y + VIEW.h - 42, 108, 32, 16); ctx.fillStyle = 'rgba(20,32,42,0.88)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText('▼ more', pcx, VIEW.y + VIEW.h - 26); }
    else if (sy > 4) { roundPath(ctx, pcx - 54, VIEW.y + 6, 108, 32, 16); ctx.fillStyle = 'rgba(20,32,42,0.88)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText('▲ top', pcx, VIEW.y + 22); }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 }); drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${Math.max(24, LY.minText)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, READ.label.x, READ.label.y); ctx.textBaseline = 'alphabetic';
  const atEnd = READER.max <= 0 || sy >= READER.max - 4;
  drawButton(ctx, REF_BACK, 'Close', { size: 32 }); drawButton(ctx, REF_NEXT, atEnd ? 'Done' : 'More ▼', { primary: true, size: 32 });
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  if (key === 'field') {
    const mp = fieldMap({ x: 0, y: 0, w: 230, h }, 0, FIELD.TOTAL, 0); drawField(ctx, mp, { labels: false });
    drawDot(ctx, mp.sx(0), mp.sy(20), 9, 0, {}); drawDot(ctx, mp.sx(2), mp.sy(23), 9, 1, {});
    ctx.fillStyle = '#14202a'; ctx.font = `700 21px ${FONT}`; ctx.textAlign = 'left';
    ['Blue end zone (6 yd)', 'Goal line', 'Goal to goal: 40 yd', 'Goal line', 'Red end zone (6 yd)'].forEach((t, i) => ctx.fillText(t, 250, mp.sy([3, 6, 26, 46, 49][i]) + 6 + [2, -8, 0, 8, -2][i]));
  } else if (key.startsWith('off:')) drawDiagram(ctx, { x: 0, y: 0, w, h }, { offId: key.slice(4), showDef: false, team: 0 });
  else if (key.startsWith('def:')) drawDiagram(ctx, { x: 0, y: 0, w, h }, { offId: 'quick', defId: key.slice(4), showOff: false, team: 0 });
  ctx.restore();
}
void TEAM_COL;
