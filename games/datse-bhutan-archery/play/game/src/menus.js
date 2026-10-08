// Every screen that is not the live play: title, setup, settings, learn, result, pause, Think card, lesson cards and the paginated About / How to Play / Rules reader.
// Pure drawing; game.js owns the state. Text follows the 100-300% size setting on every screen.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, LY, READ, host } from './layout.js';
import { drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, VALLEYS, MATCH_NAMES, MATCH_TARGETS, HELP_NAMES, HELP_SUB, LESSONS, RANGE, BOARD, POINTS, NEAR } from './consts.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawFlatBackdrop } from './view.js';

let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; pageCache.clear(); };
export const resetPages = () => pageCache.clear();
const estCtx = { font: '', measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
const CARDS = ['pause', 'hint', 'lesson'];
const behind = (s) => !!(s.v3 || !s.has3d);   // a scene (3D or the flat painted one) shows behind the menus

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
    case 'practice': return { panes: [{ wd: practiceWidgets(state), box: { ...full, bottom: LY.setupBottom } }], pins: 'col' };
    case 'result': if (land && behind(state)) return { panes: [{ wd: resultWidgets(state), box: { x: LY.title.col.x, w: LY.title.col.w, top: U.y0 + 10, bottom: U.y1 - 40 } }] }; return { panes: [{ wd: resultWidgets(state), box: full }] };
    case 'demolimit': return { panes: [{ wd: demoLimitWidgets(), box: full, vcenter: land }] };
    default: if (CARDS.includes(key)) {
      const wd = { pause: pauseWidgets, hint: hintWidgets, lesson: lessonWidgets }[key](state);
      return { panes: [{ wd, box: { x: LY.card.x, w: LY.card.w, top: LY.card.top, bottom: LY.card.bottom }, card: true }] };
    }
  }
  return null;
}
function applyPins(pl) {
  const S = SETUP_PINS;
  if (!pl || !pl.pins) return;
  const h = S.start.h, y = S.start.y, x = LY.col.x - 10, w = LY.col.w + 20, sw = Math.round(w * 0.64);
  S.start.x = x; S.start.w = sw; S.back.x = x + sw + 16; S.back.w = w - sw - 16; S.start.y = S.back.y = y; S.start.h = S.back.h = h;
}
function layPane(pane, scale) {
  const lay = flowLayout(estCtx, pane.wd, scale, { x: pane.box.x, w: pane.box.w });
  let top = pane.box.top, bottom = pane.box.bottom;
  if (pane.card) { const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (top + bottom - ch) / 2); top = y0; bottom = y0 + ch; }
  else if (pane.vcenter && lay.contentH < bottom - top) { const off = Math.round((bottom - top - lay.contentH) / 2); top += off; bottom = top + lay.contentH; }
  return { lay, top, bottom, box: pane.box, card: !!pane.card };
}
function setLaid(state, key, pl) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const ps = pl.panes.map((p) => layPane(p, sc));
  const main = ps[0];
  LAID = { key, lay: main.lay, top: main.top, bottom: main.bottom, h: main.lay.contentH, main };
  applyPins(pl);
  return ps;
}
export function ensureLayout(state, key) { const pl = plan(state, key); if (pl) setLaid(state, key, pl); }
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};
function backdrop(ctx, state) {
  if (state.v3 && state.scene !== 'rules' && state.scene !== 'about' && state.scene !== 'howto') return;
  if (!state.has3d && !['rules', 'about', 'howto'].includes(state.scene)) { drawFlatBackdrop(ctx, state, state.E); return; }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d2a3a'); g.addColorStop(0.45, '#17402f'); g.addColorStop(1, '#0a1f16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // distant ridges, so the flat backdrop still feels like the valley
  ctx.fillStyle = 'rgba(160,190,200,0.10)'; ctx.beginPath(); ctx.moveTo(0, H * 0.4); for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H * 0.4 - 70 - 60 * Math.abs(Math.sin(x * 0.012 + 0.7)) - 25 * Math.sin(x * 0.04)); ctx.lineTo(W, H * 0.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(40,90,60,0.35)'; ctx.fillRect(0, H * 0.4, W, H * 0.6);
}
function scrim(ctx, state, a = 0.55) {
  const solid = !state.v3 || ['rules', 'about', 'howto'].includes(state.scene);
  const g = ctx.createLinearGradient(0, 0, 0, H), k = solid ? 1 : 1;
  g.addColorStop(0, `rgba(4,12,9,${a * 0.55 * k})`); g.addColorStop(0.5, `rgba(4,12,9,${a * k})`); g.addColorStop(1, `rgba(4,12,9,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---- title --------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function drawHero(ctx, state, w, h) {
  const k = Math.max(0.35, Math.min(w / 560, (LY.land ? h * 0.5 : h) / 300, 1.35)), cx = w / 2, top = LY.land ? 6 : Math.max(6, (h - 300 * k) / 2);
  ctx.save(); ctx.translate(cx, top); ctx.scale(k, k); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(255,214,140,0.98)'; spaced(ctx, 'BHUTAN’S NATIONAL SPORT', 0, 40, 6);
  ctx.font = `800 138px ${NUM}`; ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(30,14,0,0.8)'; ctx.strokeText('DATSE', 0, 168); textShadow(ctx, 'DATSE', 0, 168, '#fff1cf', 12);
  ctx.font = `800 50px ${NUM}`; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(30,14,0,0.8)'; ctx.strokeText('BHUTAN ARCHERY', 0, 232); textShadow(ctx, 'BHUTAN ARCHERY', 0, 232, '#f2c14e', 8);
  ctx.font = `600 24px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.96)'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8; ctx.fillText(`${RANGE} metres. One arrow. The whole valley watching.`, 0, 280);
  ctx.restore();
}
let titleLockTap = null, lockDownNow = false;
export const getLockTap = () => titleLockTap;
export const setLockDown = (v) => { lockDownNow = v; };
const LOCK_CAP = 300;
const lockupArt = () => ({ t: 'art', brand: true, h: Math.round(LOCK_CAP * 327 / 1200) + 40, draw(ctx, w) {
  const lw = Math.min(w - 30, LOCK_CAP), lh = Math.round(lw * 327 / 1200);
  // the game's own frame for the Arcforge credit: a wooden plate with a brass edge, like the sight lens (the credit inside stays exactly the brand lockup)
  ctx.save(); const px = w / 2 - lw / 2 - 14, py = 20 - 8, pw = lw + 28, ph = lh + 16, pg = ctx.createLinearGradient(px, py, px, py + ph);
  pg.addColorStop(0, lockDownNow ? '#6a4a22' : '#3d2816'); pg.addColorStop(1, lockDownNow ? '#4a3016' : '#22140a');
  roundPath(ctx, px, py, pw, ph, ph / 2); ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = lockDownNow ? 'rgba(255,226,122,0.95)' : 'rgba(242,193,78,0.7)'; ctx.stroke(); ctx.restore();
  drawLockup(ctx, w / 2, 20, lw, 1);
} });
const heroArt = (state) => ({ t: 'art', h: LY.title.heroH || 360, draw(ctx, w, h) { ctx.save(); drawHero(ctx, state, w, h); ctx.restore(); } });
export function titleWidgets(state, land = false) {
  const wd = land ? [] : [heroArt(state)];
  if (state.resume) wd.push({ t: 'btn', id: 'continue', label: 'Continue match', sub: `${state.resume.teams[0].name} ${state.resume.teams[0].pts} – ${state.resume.teams[1].pts} ${state.resume.teams[1].name}`, primary: true, h: 92 }, { t: 'btn', id: 'play', label: 'New match', h: 80 });
  else wd.push({ t: 'btn', id: 'play', label: 'Play a match', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'practice', label: 'Practice range', row: 1 }, { t: 'btn', id: 'learn', label: 'Learn', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 }, { t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 }, { t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', dark: true, h: 76 });
  wd.push(lockupArt());
  return wd;
}
// ---- setup -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New Match', size: 48 }, { t: 'p', label: 'Your team comes from', bold: true, color: '#ffe9bf', size: 26 }];
  for (let i = 0; i < VALLEYS.length; i += 2) { wd.push({ t: 'btn', id: `v${i}`, label: VALLEYS[i].name, row: 30 + i, active: s.valley === i, h: 72 }, { t: 'btn', id: `v${i + 1}`, label: VALLEYS[i + 1].name, row: 30 + i, active: s.valley === i + 1, h: 72 }); }
  wd.push({ t: 'p', label: 'Choose your opponents', bold: true, color: '#ffe9bf', size: 26 });
  LEVELS.forEach((pf, i) => { const won = rec.wins[i] ?? 0, locked = demo && i > 0; wd.push({ t: 'btn', id: `lv${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.level === i && !locked, disabled: locked, hitDisabled: true, h: 92 }); });
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  MATCH_NAMES.forEach((n, i) => wd.push({ t: 'btn', id: `m${i}`, label: `${n}: first to ${MATCH_TARGETS[i]}`, row: 40 + i % 1, active: s.target === i, disabled: demo && i !== 0, hitDisabled: true, h: 76 }));
  wd.push({ t: 'p', label: 'Aiming help', bold: true, color: '#ffe9bf', size: 26 });
  HELP_NAMES.forEach((n, i) => wd.push({ t: 'btn', id: `h${i}`, label: n, sub: HELP_SUB[i], active: s.help === i, h: 92 }));
  wd.push({ t: 'p', label: 'The archers', bold: true, color: '#ffe9bf', size: 26 });
  [['mixed', 'Mixed'], ['men', 'Men'], ['women', 'Women']].forEach(([id, n]) => wd.push({ t: 'btn', id: `g-${id}`, label: n, row: 50, active: s.gender === id, h: 76 }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
export function practiceWidgets(state) {
  const s = state.setup;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Practice Range', size: 48 }, { t: 'p', label: 'One archer, as many arrows as you like. Pick the wind.', size: 24, color: 'rgba(255,243,214,0.9)' }, { t: 'p', label: 'Wind', bold: true, color: '#ffe9bf', size: 26 }];
  [['-1', 'Changing'], ['0', 'Calm'], ['3', 'Light'], ['6', 'Strong']].forEach(([v, n]) => wd.push({ t: 'btn', id: `pw${v}`, label: n, sub: v === '-1' ? 'a new wind every few arrows' : `${v} m/s`, active: String(s.pwind) === v, h: 84 }));
  wd.push({ t: 'p', label: 'Aiming help', bold: true, color: '#ffe9bf', size: 26 });
  HELP_NAMES.forEach((n, i) => wd.push({ t: 'btn', id: `h${i}`, label: n, sub: HELP_SUB[i], active: s.help === i, h: 92 }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-tips', label: st.tips ? 'Hints on the screen: On' : 'Hints on the screen: Off', sub: 'Short tips while you learn the first shots' },
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
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Three short lessons on the practice range. Each gives you six arrows and one goal.', size: 24, color: 'rgba(255,243,214,0.9)' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: done.includes(l.id) ? 'Done' : l.goal, active: done.includes(l.id), h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function resultWidgets(state) {
  const o = state.over;
  if (!o) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const w = o.winner, mode = o.mode;
  const names = o.names, title = w < 0 ? 'A draw' : mode === 'watch' ? `${names[w]} win` : w === 0 ? 'You win!' : 'You lose';
  const wd = [{ t: 'gap', h: !LY.land && behind(state) ? Math.round(LY.h * 0.33) : big ? 20 : 40 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${o.score[0]} – ${o.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }, { t: 'p', label: `${names[0]}  vs  ${names[1]}`, bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const [a, b] = o.stats;
  const rows = [['Ends played', o.ends, o.ends], ['Arrows shot', a.arrows, b.arrows], ['Karay (bullseyes)', a.karay, b.karay], ['Hits on the board', a.hits, b.hits], ['Near misses', a.near, b.near], ['Best run of hits', a.best, b.best]];
  rows.forEach(([k, x, y]) => wd.push({ t: 'p', label: x === y && k === 'Ends played' ? `${k}:  ${x}` : `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: `Matches won against ${LEVELS[o.level].name}: ${state.record.wins[o.level] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  wd.push({ t: 'gap', h: 16 }, { t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 }, { t: 'btn', id: 'new', label: 'New match', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true }, { t: 'gap', h: 30 });
  return wd;
}
export function lessonResultWidgets() { return []; }
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 }, { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 }, { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 }, { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.mode === 'ai' ? 'Your match is kept' : '', dark: true, row: 8 },
  ];
}
export function hintWidgets(state) {
  const h = state.hint;
  const wd = [{ t: 'h', label: 'Think', size: 48 }];
  (h ? h.lines : []).forEach((l) => wd.push({ t: 'p', label: l, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' }));
  wd.push({ t: 'gap', h: 10 });
  if (h && h.value) wd.push({ t: 'btn', id: 'hint-do', label: h.applyLabel || 'Do it', primary: true, h: 84 });
  wd.push({ t: 'btn', id: 'hint-close', label: 'Close', dark: true, h: 76 });
  return wd;
}
export function lessonWidgets(state) {
  const L = state.lesson;
  if (!L) return [];
  const d = L.def;
  if (L.phase === 'intro') { const wd = [{ t: 'h', label: `Lesson ${L.idx + 1}`, size: 40, color: '#f2c14e' }, { t: 'h', label: d.title, size: 52 }]; d.text.forEach((l) => wd.push({ t: 'p', label: l, size: 24, cap: 3, color: 'rgba(255,243,214,0.96)' })); wd.push({ t: 'p', label: `Goal: ${d.goal}`, size: 24, cap: 3, bold: true, color: '#ffe9bf' }, { t: 'btn', id: 'ls-start', label: 'Start', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Back', dark: true, h: 76 }); return wd; }
  if (L.phase === 'done') { const last = L.idx === LESSONS.length - 1; return [{ t: 'h', label: 'Well done', size: 52, color: '#9fe8b4' }, { t: 'p', label: `${L.pts} points in ${L.shots} arrows.`, size: 26, cap: 3, color: 'rgba(255,243,214,0.96)' }, { t: 'btn', id: 'ls-next', label: last ? 'Finish' : 'Next lesson', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Lessons', dark: true, h: 76 }]; }
  return [{ t: 'h', label: 'Not quite', size: 52, color: '#ffb4a0' }, { t: 'p', label: `The goal was: ${d.goal} You scored ${L.pts}. Try again.`, size: 26, cap: 3, color: 'rgba(255,243,214,0.96)' }, { t: 'btn', id: 'ls-retry', label: 'Try again', primary: true, h: 84 }, { t: 'btn', id: 'ls-back', label: 'Lessons', dark: true, h: 76 }];
}
export function demoLimitWidgets() {
  return [{ t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 }, { t: 'p', label: 'You have played the short match of the web demo. The full game on iPhone and Android has all three opponents, longer matches, the practice range and your saved records.', size: 28 }, { t: 'gap', h: 20 }, { t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,14,10,0)'); g.addColorStop(1, 'rgba(6,14,10,0.75)'); ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#1b2420'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#1b2420'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key) {
  const pl = plan(state, key);
  const ps = setLaid(state, key, pl);
  let res = null;
  for (const P of ps) {
    const { lay, top, bottom, box } = P;
    const maxScroll = Math.max(0, lay.contentH - (bottom - top));
    const scroll = Math.min(state.ui.scroll, maxScroll);
    drawFlow(ctx, lay, top, bottom, scroll, P.card ? { x: box.x - 20, w: box.w + 40 } : { x: Math.max(0, box.x - 20), w: box.w + 40 });
    if (maxScroll > 0) {
      const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th), bx = Math.min(W - 10, box.x + box.w + 18);
      roundPath(ctx, bx, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, scroll, maxScroll, box.x - 10, box.w + 20);
    }
    res = { scroll, maxScroll, lay };
  }
  return res;
}
const pinsFade = (ctx) => {
  const y = SETUP_PINS.start.y - 56, g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, 'rgba(6,14,10,0)'); g.addColorStop(0.2, 'rgba(6,14,10,0.88)'); g.addColorStop(1, 'rgba(6,14,10,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, y, W, H - y);
};
export function renderTitle(ctx, state) {
  backdrop(ctx, state);
  if (behind(state)) { // a darker panel behind the buttons so they read over the 3D valley
    const col = LY.title.col;
    if (LY.land) { const g = ctx.createLinearGradient(col.x - 80, 0, col.x + 40, 0); g.addColorStop(0, 'rgba(4,12,9,0)'); g.addColorStop(1, 'rgba(4,12,9,0.78)'); ctx.fillStyle = g; ctx.fillRect(col.x - 80, 0, W - col.x + 80, H); const g2 = ctx.createLinearGradient(0, 0, 0, H * 0.4); g2.addColorStop(0, 'rgba(4,12,9,0.45)'); g2.addColorStop(1, 'rgba(4,12,9,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, col.x, H * 0.4); }
    else { const y0 = LY.flowTop + (LY.title.heroH || 0) - 30; const g = ctx.createLinearGradient(0, y0, 0, y0 + 160); g.addColorStop(0, 'rgba(4,12,9,0)'); g.addColorStop(1, 'rgba(4,12,9,0.84)'); ctx.fillStyle = g; ctx.fillRect(0, y0, W, 160); ctx.fillStyle = 'rgba(4,12,9,0.84)'; ctx.fillRect(0, y0 + 160, W, H - y0 - 160); const g2 = ctx.createLinearGradient(0, 0, 0, 220); g2.addColorStop(0, 'rgba(4,12,9,0.5)'); g2.addColorStop(1, 'rgba(4,12,9,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, 220); }
  } else scrim(ctx, state, 0.18);
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
function dimForV3(ctx, state, a) { if (behind(state)) { ctx.fillStyle = `rgba(4,12,9,${a})`; ctx.fillRect(0, 0, W, H); } }
export function renderSetup(ctx, state) {
  backdrop(ctx, state); dimForV3(ctx, state, 0.55); scrim(ctx, state, 0.5);
  drawFlowScreen(ctx, state, 'setup'); pinsFade(ctx);
  const pz = Math.round(30 * Math.min(TEXT_SCALES[state.settings.textIdx], LY.land ? 1.5 : 2.2)); drawButton(ctx, SETUP_PINS.start, 'Begin', { primary: true, size: pz }); drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: Math.round(pz * 0.9) });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, LY.minText)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, SETUP_PINS.start.x + (SETUP_PINS.start.w + SETUP_PINS.back.w + 16) / 2, SETUP_PINS.start.y - 10); }
}
export function renderPractice(ctx, state) {
  backdrop(ctx, state); dimForV3(ctx, state, 0.55); scrim(ctx, state, 0.5);
  drawFlowScreen(ctx, state, 'practice'); pinsFade(ctx);
  const pz = Math.round(30 * Math.min(TEXT_SCALES[state.settings.textIdx], LY.land ? 1.5 : 2.2)); drawButton(ctx, SETUP_PINS.start, 'To the range', { primary: true, size: pz }); drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: Math.round(pz * 0.9) });
}
export function renderSettings(ctx, state) { backdrop(ctx, state); dimForV3(ctx, state, 0.6); scrim(ctx, state, 0.5); drawFlowScreen(ctx, state, 'settings'); }
export function renderLearn(ctx, state) { backdrop(ctx, state); dimForV3(ctx, state, 0.6); scrim(ctx, state, 0.5); drawFlowScreen(ctx, state, 'learn'); }
function panelScrim(ctx, state, topY) {
  const col = LY.title.col;
  if (LY.land) { const g = ctx.createLinearGradient(col.x - 80, 0, col.x + 40, 0); g.addColorStop(0, 'rgba(4,12,9,0)'); g.addColorStop(1, 'rgba(4,12,9,0.8)'); ctx.fillStyle = g; ctx.fillRect(col.x - 80, 0, W - col.x + 80, H); }
  else { const g = ctx.createLinearGradient(0, topY, 0, topY + 140); g.addColorStop(0, 'rgba(4,12,9,0)'); g.addColorStop(1, 'rgba(4,12,9,0.84)'); ctx.fillStyle = g; ctx.fillRect(0, topY, W, 140); ctx.fillStyle = 'rgba(4,12,9,0.84)'; ctx.fillRect(0, topY + 140, W, H - topY - 140); }
}
export function renderResult(ctx, state) {
  backdrop(ctx, state); if (behind(state)) panelScrim(ctx, state, Math.round(LY.h * 0.28)); else scrim(ctx, state, 0.5); drawFlowScreen(ctx, state, 'result');
  const r = LAID.lay && LAID.lay.contentH <= LAID.bottom - LAID.top - 40;
  if (r) drawMoreLine(ctx, LY.col.x + LY.col.w / 2, LY.U.y1 - 16, Math.max(16, LY.minText * 0.85));
}
export function renderDemoLimit(ctx, state) { backdrop(ctx, state); dimForV3(ctx, state, 0.6); scrim(ctx, state, 0.6); drawFlowScreen(ctx, state, 'demolimit'); }
function cardOverlay(ctx, state, key) {
  ctx.fillStyle = 'rgba(4,12,9,0.5)'; ctx.fillRect(0, 0, W, H);
  const pl = plan(state, key), ps = setLaid(state, key, pl), P = ps[0];
  const ch = P.bottom - P.top;
  panel(ctx, LY.card.panelX, P.top - 20, LY.card.panelW, ch + 40, { r: 30, fill: 'rgba(12,30,22,0.96)', stroke: 'rgba(242,193,78,0.6)' });
  ctx.save(); ctx.beginPath(); roundPath(ctx, LY.card.panelX, P.top - 20, LY.card.panelW, ch + 40, 30); ctx.clip(); edgeStroke(ctx, { x: LY.card.panelX + 3, y: P.top - 17, w: LY.card.panelW - 6, h: ch + 34 }, 28, 0.35); ctx.restore();
  const maxScroll = Math.max(0, P.lay.contentH - ch), sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, P.lay, P.top, P.bottom, sc0, { x: LY.card.panelX, w: LY.card.panelW }); scrollHint(ctx, P.top, P.bottom, sc0, maxScroll, LY.card.panelX, LY.card.panelW);
}
export const renderPause = (ctx, s) => cardOverlay(ctx, s, 'pause');
export const renderHint = (ctx, s) => cardOverlay(ctx, s, 'hint');
export const renderLesson = (ctx, s) => cardOverlay(ctx, s, 'lesson');

// ---- reference pages (one continuous scrolling page) ----------------------------------------------------------------------------------------------------------------------------
const pageCache = new Map();
const READER = { max: 0, view: 900 };
export const readerMeta = () => READER;
const ART_H = 250;
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
    if (sec.art) { items.push({ k: 'art', y, art: sec.art }); y += ART_H + 12; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => { if (pi > 0) y += lh * 0.45; wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; }); });
    y += 12; items.push({ k: 'rule', y }); y += 10;
  });
  L = { items, h: y + 30, fs, secFs };
  pageCache.set(key, L);
  return L;
}
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state); scrim(ctx, state, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx], PANEL = READ.panel, VIEW = READ.view, pcx = PANEL.x + PANEL.w / 2;
  const L = readerLayout(state, list, header);
  READER.max = Math.max(0, Math.ceil(L.h - VIEW.h)); READER.view = VIEW.h;
  const sy = Math.max(0, Math.min(state.page || 0, READER.max)); state.page = sy;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(246,240,224,0.97)', stroke: 'rgba(181,128,31,0.8)' });
  ctx.save(); ctx.beginPath(); roundPath(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 30); ctx.clip(); edgeStroke(ctx, { x: PANEL.x + 4, y: PANEL.y + 4, w: PANEL.w - 8, h: PANEL.h - 8 }, 26, 0.3); ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#7d3a12'; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(27,36,32,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 50, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 50, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW.y, PANEL.w - 12, VIEW.h); ctx.clip();
  const x0 = PANEL.x + 35;
  for (const it of L.items) {
    const y = VIEW.y + it.y - sy;
    const hh = it.k === 'art' ? ART_H : it.k === 'title' ? it.lines.length * L.secFs * 1.2 : L.fs * 1.3;
    if (y > VIEW.y + VIEW.h || y + hh < VIEW.y) continue;
    if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = '#b3271f'; ctx.font = `800 ${L.secFs}px ${FONT}`; it.lines.forEach((l, k) => ctx.fillText(l, pcx, y + L.secFs * (0.9 + k * 1.2))); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, ART_H); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, ART_H); ctx.restore(); }
    else if (it.k === 'line') { ctx.fillStyle = C.ink; ctx.font = `400 ${L.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, x0, y + L.fs * 0.85); }
    else { ctx.strokeStyle = 'rgba(27,36,32,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 70, y); ctx.lineTo(PANEL.x + PANEL.w - 70, y); ctx.stroke(); }
  }
  ctx.restore();
  if (READER.max > 0) {
    const B = READ.bar, th = Math.max(60, VIEW.h * (VIEW.h / L.h)), ty = VIEW.y + (sy / READER.max) * (VIEW.h - th);
    roundPath(ctx, B.x + 12, VIEW.y, 4, VIEW.h, 2); ctx.fillStyle = 'rgba(125,58,18,0.15)'; ctx.fill();
    roundPath(ctx, B.x + 9, ty, 10, th, 5); ctx.fillStyle = 'rgba(125,58,18,0.7)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, LY.minText)}px ${FONT}`; ctx.textBaseline = 'middle';
    if (sy < READER.max - 4) { roundPath(ctx, pcx - 54, VIEW.y + VIEW.h - 42, 108, 32, 16); ctx.fillStyle = 'rgba(27,36,32,0.88)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText('▼ more', pcx, VIEW.y + VIEW.h - 26); }
    else if (sy > 4) { roundPath(ctx, pcx - 54, VIEW.y + 6, 108, 32, 16); ctx.fillStyle = 'rgba(27,36,32,0.88)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText('▲ top', pcx, VIEW.y + 22); }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 }); drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${Math.max(24, LY.minText)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, READ.label.x, READ.label.y); ctx.textBaseline = 'alphabetic';
  const atEnd = READER.max <= 0 || sy >= READER.max - 4;
  drawButton(ctx, REF_BACK, 'Close', { size: 32 }); drawButton(ctx, REF_NEXT, atEnd ? 'Done' : 'More ▼', { primary: true, size: 32 });
}

// ---- diagrams for the Rules page, drawn with the same colours as the 3D boards ------------------------------------------------------------------------------------------------------------
export function drawBoardShape(ctx, x, y, w, h) {
  ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#8a1e14'; ctx.lineWidth = Math.max(2, w * 0.06); ctx.strokeRect(x + w * 0.03, y + w * 0.03, w * 0.94, h - w * 0.06);
  ctx.strokeStyle = '#1f3d6e'; ctx.lineWidth = Math.max(1, w * 0.024); ctx.strokeRect(x + w * 0.1, y + w * 0.1, w * 0.8, h - w * 0.2);
  ctx.fillStyle = '#f0b830'; ctx.fillRect(x + w * 0.14, y + w * 0.14, w * 0.72, w * 0.13);
  const cy = y + h * (1 - BOARD.karayY / BOARD.h), px = w / BOARD.w;
  for (const [rr, col] of [[0.115, '#1f3d6e'], [0.095, '#f4efe0'], [BOARD.karayR, '#c42a1d'], [0.035, '#f0b830']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + w / 2, cy, rr * px, 0, 7); ctx.fill(); }
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = C.ink;
  if (key === 'board') {
    const bh = h - 20, bw = bh * BOARD.w / BOARD.h, bx = 24;
    drawBoardShape(ctx, bx, 10, bw, bh);
    const cy = 10 + bh * (1 - BOARD.karayY / BOARD.h), cx = bx + bw / 2;
    ctx.strokeStyle = '#7d3a12'; ctx.lineWidth = 2; ctx.textAlign = 'left';
    const lab = (t, ly, ex) => { ctx.beginPath(); ctx.moveTo(ex, ly); ctx.lineTo(bx + bw + 40, ly); ctx.stroke(); ctx.fillText(t, bx + bw + 52, ly + 7); };
    lab(`Karay: ${POINTS.karay}`, cy, cx + 14); lab(`Board: ${POINTS.hit}`, 10 + bh * 0.22, bx + bw * 0.85); lab(`On the ground within ${NEAR} m: ${POINTS.near}`, 10 + bh - 6, bx + bw);
    ctx.textAlign = 'right'; ctx.font = `600 20px ${FONT}`; ctx.fillStyle = '#5a4a30'; ctx.fillText(`${Math.round(BOARD.w * 100)} × ${Math.round(BOARD.h * 100)} cm`, w - 6, 24);
  } else if (key === 'range') {
    const gy = h * 0.68, L = 40, Rr = w - 40;
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfe3ef'); g.addColorStop(0.62, '#e4efe0'); g.addColorStop(0.62, '#8fb85e'); g.addColorStop(1, '#6a9a44'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6a8a78'; ctx.beginPath(); ctx.moveTo(0, gy); for (let i = 0; i <= w; i += 24) ctx.lineTo(i, gy - 36 - 30 * Math.abs(Math.sin(i * 0.02 + 1)) - 12 * Math.sin(i * 0.07)); ctx.lineTo(w, gy); ctx.closePath(); ctx.fill();
    const board = (bx) => { drawBoardShape(ctx, bx - 8, gy - 54, 16, 54); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(bx - 12, gy, 24, 4); };
    board(L); board(Rr);
    ctx.strokeStyle = '#7d3a12'; ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L + 10, gy - 40); ctx.quadraticCurveTo(w / 2, gy - 150, Rr - 10, gy - 40); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.font = `800 26px ${FONT}`; ctx.fillText(`${RANGE} m`, w / 2, gy - 112 + 0);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = '#4a3a20'; ctx.fillText('stand', L + 6, gy + 28); ctx.fillText('stand', Rr - 6, gy + 28);
    ctx.fillStyle = '#b3271f'; for (const bx of [L + 34, Rr - 34]) { ctx.beginPath(); ctx.arc(bx, gy - 20, 7, 0, 7); ctx.fill(); ctx.fillRect(bx - 6, gy - 14, 12, 18); }
  }
  ctx.restore();
}
