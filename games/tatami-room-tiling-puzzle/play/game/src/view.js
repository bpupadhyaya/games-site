// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, centerCard, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, paraHeight, wrap, F, mix, rgba, icons, scrim, topVeil, vignette, emboss, lacquer } from './ui.js';
import { v3, gridPt, cellPx } from './v3.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { ambient, drawRoom, drawMat, drawMini } from './art.js';
import { drawFigure } from './figures.js';
import { fmtTime, PAR_SECONDS } from './play.js';
import { supplyLeft, uncovered, TECH_NAME, parsePuzzle, newBoard, solve, badVertices } from './tatami.js';
import { DOCS, GRADE_INFO } from './content.js';
import { LIBRARY } from './library.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Season', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'corner', label: 'Corner warning', opts: ['Show', 'Block', 'Off'] },
  { id: 'names', label: 'Square names', opts: ['On', 'Off'] },
  { id: 'timer', label: 'Show timer', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const settingRows = (s) => (s.demo ? SETTINGS.filter((r) => r.id !== 'restore') : SETTINGS);   // no purchases in the web demo
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'corner': return ['show', 'block', 'off'].indexOf(p.corner);
    case 'names': return p.names ? 0 : 1;
    case 'timer': return p.timer ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  background(ctx, w, h, s.t);
  if (!v3.on) ambient(ctx, w, h, s.t, s.prefs.calm);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (v3.on && sc !== 'play' && sc !== 'title' && sc !== 'over') {   // text screens: the finished room drifts behind a readable veil
    const ab = titleBoard();
    v3.ambientBoard = ab;
    if (v3.fit) v3.fit(null, 'ambient', { calm: s.prefs.calm, board: ab, rect: { x: w * 0.04, y: h * 0.02, w: w * 0.92, h: h * 0.5 } });
    v3.frame = { B: ab, win: 0, bad: [], marks: null, ghost: null, hide: false };
    scrim(ctx, w, h, 1);
  }
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'new') drawNew(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ play screen ============================================================
export function hintMarks(s) {
  const h = s.hint;
  if (!h || !h.step) return null;
  const st = h.step, m = { cells: [], points: [] };
  if (h.stage === 'mistake') { m.wrong = { a: st.tile.a, b: st.tile.b }; return m; }
  m.cells = [st.cell];
  if (h.stage === 'explain') {
    m.answer = { a: st.a, b: st.b };
    for (const o of st.options) if (!o.answer && o.reason === 'corner' && o.vertex) m.points.push(o.vertex);
  }
  return m;
}

function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P, coach = !!(s.hint || s.auto.on);
  const L = playLayout(w, h, { coach, cols: P.B.w, rows: P.B.h });
  const marks = hintMarks(s) ?? (s.blockPts ? { points: s.blockPts.pts } : null);
  const bad = s.prefs.corner === 'off' && !P.done && !s.flagWrong ? [] : undefined;
  if (v3.on && v3.fit) {
    v3.fit(L.board, 'play', { calm: s.prefs.calm, board: P.B });
    const bl = s.paused ? [] : (bad ?? badVertices(P.B));
    v3.frame = { B: P.B, win: s.winT > 0 || P.done ? 1 : 0, bad: bl, marks: s.paused ? null : marks, ghost: s.paused ? null : s.ghost, hide: s.paused };
    vignette(ctx, w, h, 1);
    topVeil(ctx, w, L.hud.title.y + 120, 1);
    if (s.prefs.names && !s.paused) drawNames3d(ctx, L.board, P.B);
  } else drawRoom(ctx, L.board, P.B, { t: s.t, fxDrop: s.fx.drop, ghost: s.ghost, marks, hide: s.paused, showNames: s.prefs.names, win: s.winT, bad: s.paused ? [] : bad });
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  drawInfo(ctx, s, L);
  if (s.paused) { ctx.save(); ctx.globalAlpha = 0.3; drawTray(ctx, s, L); ctx.restore(); drawPaused(ctx, s, L); }
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else drawTray(ctx, s, L);
  drawMsg(ctx, s, L);
}

function drawNames3d(ctx, geo, B) {
  const s = cellPx(geo);
  if (s < 34) return;
  for (let i = 0; i < B.n; i++) {
    if (!B.room[i] || B.cov[i] >= 0) continue;
    const p = gridPt(geo, (i % B.w) + 0.5, Math.floor(i / B.w) + 0.5, 0.06), nm = String.fromCharCode(65 + Math.floor(i / B.w)) + ((i % B.w) + 1);
    txt(ctx, nm, p.x, p.y, { size: Math.max(F(17), s * 0.22), weight: 500, color: 'rgba(255,240,210,0.36)', align: 'center' });
  }
}

function drawInfo(ctx, s, L) {
  const T = theme(), P = s.P, pr = s.prefs, hud = L.hud, gi = GRADE_INFO[P.level];
  const title = s.auto.on ? 'Watch and Learn' : gi.name;
  const left = uncovered(P.B);
  const sub = P.kind === 'daily' ? `Daily Puzzle  ·  ${left} squares left` : s.auto.on ? `${gi.name} room` : `${left} square${left === 1 ? '' : 's'} left`;
  const time = fmtTime(P.t);
  if (L.mode === 'portrait') {
    txt(ctx, title, hud.title.x, hud.title.y + 24, { size: F(36), weight: 700, color: T.text, maxW: L.U.w * 0.4, min: 18 });
    txt(ctx, sub, hud.title.x, hud.title.y + 58, { size: F(22), weight: 400, color: T.dim, maxW: L.U.w * 0.46, min: 12 });
    if (pr.timer) txt(ctx, time, hud.timer.x + 40, hud.timer.y - 8, { size: F(40), weight: 600, color: T.text, align: 'center' });
    button(ctx, L.pause, '', { icon: s.paused ? 'play' : 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
    return;
  }
  const r = L.info;
  panel(ctx, r, { radius: 26 });
  edgeStroke(ctx, r, 26, 0.35);
  txt(ctx, title, hud.title.x, hud.title.y + 26, { size: F(38), weight: 700, color: T.text, maxW: r.w - 120, min: 18 });
  txt(ctx, sub, hud.title.x, hud.title.y + 64, { size: F(22), weight: 400, color: T.dim, maxW: r.w - 120, min: 12 });
  button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
  if (pr.timer) txt(ctx, time, hud.timer.x, hud.timer.y, { size: F(64), weight: 600, color: T.text, align: 'center', maxW: r.w - 40 });
  else txt(ctx, 'Timer hidden', hud.timer.x, hud.timer.y, { size: F(26), weight: 400, color: T.dim, align: 'center' });
  if (pr.corner !== 'off' && !s.auto.on) txt(ctx, `Slips ${P.errs}`, hud.supply.x, hud.supply.y, { size: F(24), weight: 500, color: P.errs ? T.err : T.dim, align: 'center' });
  if (r.h > 700) drawBadgeStack(ctx, r.x + r.w / 2, r.y + r.h - 12, Math.min(150, r.w - 60));
}

function drawTray(ctx, s, L) {
  const T = theme(), P = s.P, left = supplyLeft(P.B), tl = L.tools;
  const tile = (r, active, dis, fl) => {
    ctx.save(); if (dis) ctx.globalAlpha = 0.42;
    if (v3.on) lacquer(ctx, r, { radius: 18, kind: 'solid', active, down: Math.min(1, fl * 1.6) });
    else {
      rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = active ? rgba(T.accent, 0.2) : T.btn; ctx.fill();
      if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
      ctx.lineWidth = active ? 3 : 1.5; ctx.strokeStyle = active ? T.accent : T.line; ctx.stroke();
    }
    ctx.restore();
  };
  // mat tiles: the mat itself above, the count below
  for (const kind of ['full', 'half']) {
    const r = tl[kind], n = left[kind], act = s.tool === kind, dis = n <= 0;
    tile(r, act, dis, flashOf(s, kind));
    const lab = F(Math.min(26, r.h * 0.24)), ah = r.h - lab * 1.5 - 12, aw = r.w - 20;
    const un = Math.max(10, Math.min(ah / (kind === 'full' && s.orient === 'standing' ? 2 : 1), aw / (kind === 'full' && s.orient === 'lying' ? 2 : 1), 80));
    const mw = kind === 'full' && s.orient === 'lying' ? 2 * un : un, mh = kind === 'full' && s.orient === 'standing' ? 2 * un : un;
    ctx.save(); if (dis) ctx.globalAlpha = 0.4;
    drawMat(ctx, r.x + (r.w - mw) / 2, r.y + 8 + (ah - mh) / 2, mw, mh, { seed: kind === 'full' ? 2 : 5, half: kind === 'half', stand: kind === 'half' ? false : false });
    ctx.restore();
    txt(ctx, `${kind === 'full' ? 'Full' : 'Half'}  ×${n}`, r.x + r.w / 2, r.y + r.h - lab * 0.85, { size: lab, weight: 700, color: dis ? T.dim : T.text, align: 'center', maxW: r.w - 10, min: 11 });
  }
  const defs = [['turn', 'Turn', 'turn', s.tool === 'half'], ['undo', 'Undo', 'undo', P.undo.length === 0], ['redo', 'Redo', 'redo', P.redo.length === 0], ['hint', 'Hint', 'bulb', false]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id], hint = id === 'hint';
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    const fl = flashOf(s, id);
    if (v3.on) lacquer(ctx, r, { radius: 18, kind: hint ? 'accent' : 'solid', down: Math.min(1, fl * 1.6) });
    else {
      rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = hint ? T.accent : T.btn; ctx.fill();
      if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
      ctx.lineWidth = 1.5; ctx.strokeStyle = hint ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
    }
    const col = hint ? T.onAccent : T.text;
    if (r.h >= 62 && r.w >= 70) {
      icons[icon](ctx, r.x + r.w / 2, r.y + r.h * 0.4, Math.min(r.h * 0.42, r.w * 0.5, 46), col);
      txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.8, { size: F(19), weight: 500, color: col, align: 'center', maxW: r.w - 8, min: 11 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 36), col);
    ctx.restore();
  }
}

function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba('#000000', 0.28) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40;
  const title = hnt.stage === 'mistake' ? 'Something is off' : TECH_NAME(hnt.step.technique), chip = hnt.stage === 'look' ? 'Where to look' : hnt.stage === 'explain' ? 'Why it works' : 'Check this mat';
  const ts = F(C.h > 380 ? 36 : 30);
  txt(ctx, title, x, C.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18 });
  txt(ctx, chip, x, C.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim });
  const bodyTop = C.y + 14 + ts * 2.1, bodyH = B.close.y - 10 - bodyTop;
  let size = F(C.w > 500 ? 32 : 28);
  while (size > 14 && paraHeight(ctx, hnt.text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, hnt.text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : hnt.stage === 'mistake' ? 'Fix it' : 'Apply', { kind: 'accent', size: 28, flash: flashOf(s, 'go') });
}

function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint, T0 = L.coachText;
  panel(ctx, C, { radius: 24, fill: rgba('#000000', 0.28) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, ts = F(C.h > 380 ? 36 : 30);
  const name = hnt?.step ? TECH_NAME(hnt.step.technique) : (a.done ? 'Solved' : 'Thinking');
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w * 0.6, min: 18 });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it works' : a.done ? 'The room is complete' : 'Finding the next mat';
  txt(ctx, `Step ${a.n}  ·  ${phase}`, x, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, maxW: w * 0.62, min: 12 });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 20, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, align: 'right' });
  const bodyTop = T0.y + 14 + ts * 2.1, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt?.text ?? (a.done ? 'Every square is covered and no point has four corners meeting. Tap Exit to go back to the menu.' : 'Looking for the most forced square.');
  let size = F(C.w > 500 ? 30 : 26);
  while (size > 14 && paraHeight(ctx, text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 26, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 26, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 26, flash: flashOf(s, 'ainc') });
}

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.board), b = L.board;
  if (!v3.on) { ctx.fillStyle = rgba(T.floor, 0.78); rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill(); }
  panel(ctx, pl.card, v3.on ? { radius: 26 } : { radius: 26, fill: 'rgba(20,18,32,0.96)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 700, color: T.text, align: 'center' });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart room', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}

function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), portrait = L.mode === 'portrait';
  const w = portrait ? Math.min(L.U.w - 40, 600) : L.info.w - 24, cx2 = portrait ? L.U.x0 + L.U.w / 2 : L.info.x + L.info.w / 2;
  let size = F(portrait ? 24 : 26), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (portrait && lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22;
  const y = portrait ? L.hud.title.y + Math.max(0, (80 - hh) / 2) + 80 : L.info.y + L.info.h - hh - 70;
  ctx.save(); ctx.globalAlpha = a;
  if (v3.on) panel(ctx, { x: cx2 - w / 2, y, w, h: hh }, { radius: 18, fill: 'rgba(24,14,8,0.94)' });
  else { rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = 'rgba(14,12,26,0.96)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke(); }
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ title ==================================================================
let titleRoom = null;
// A board-like snapshot of the title room with the first `k` mats laid (default: all of them), for the 3D presenter.
export function titleBoard(k = Infinity) {
  const sp = titleSpec(), n = Math.max(0, Math.min(sp.tiles.length, Math.floor(k)));
  const tiles = sp.tiles.slice(0, n).map((tl, i) => ({ a: tl.a, b: tl.b, id: i, given: false }));
  return { w: sp.cols, h: sp.rows, n: sp.cols * sp.rows, room: sp.room, tiles, cov: new Int16Array(sp.cols * sp.rows).fill(-1) };
}
function titleSpec() {
  if (titleRoom) return titleRoom;
  const p = parsePuzzle(LIBRARY[3][0]), B = newBoard(p), sol = solve(B, { limit: 1 }).solutions[0] ?? [];
  titleRoom = { cols: p.w, rows: p.h, room: p.room, tiles: sol.map(([a, b]) => ({ a, b })) };
  return titleRoom;
}
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(true);
  const sp = titleSpec(), H = hero.h, tb = Math.min(160, Math.max(66, H * 0.28));
  const roomBox = { x: hero.x, y: hero.y, w: hero.w, h: Math.max(60, H - tb - 6) };
  // the mats drop into the room one after another, then the loop restarts. In 3D the room starts nearly laid and the last mats are
  // set down by the hands one at a time, so the menu shows a finished, lit room most of the time.
  const N = sp.tiles.length;
  let shown, fxDrop = {};
  if (v3.on) {
    const lay = Math.min(4, N), step = 1.6, hold = 3.8, cyc = lay * step + hold, ph = s.t % cyc;
    shown = N - lay + clamp(Math.floor(ph / step), 0, lay);
  } else {
    const cycle = N * 0.14 + 3.2, ph = (s.t + cycle * 0.62) % cycle;
    shown = clamp(Math.floor(ph / 0.14), 0, N);
    fxDrop = shown > 0 && shown < N ? { [shown - 1]: (ph % 0.14) } : {};
  }
  const ty = hero.y + H - tb * 0.5;
  if (v3.on && v3.fit) {
    const tbd = titleBoard(shown);
    v3.fit(null, 'title', { calm: s.prefs.calm, board: tbd, rect: { x: hero.x, y: hero.y + H * 0.26, w: hero.w, h: roomBox.h - H * 0.2 } });
    v3.frame = { B: tbd, win: 0, bad: [], marks: null, ghost: null, hide: false };
    vignette(ctx, w, h, 0.9);
    { const y0 = hero.y + H * 0.5, y1 = hero.y + H + 70, g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(10,5,3,0)'); g.addColorStop(0.55, 'rgba(10,5,3,0.5)'); g.addColorStop(1, 'rgba(10,5,3,0)'); ctx.fillStyle = g; ctx.fillRect(0, y0, w, y1 - y0); }
    emboss(ctx, 'TATAMI', hero.x + hero.w / 2, ty - tb * 0.12, tb * 0.62, { weight: 800, t: s.t, maxW: hero.w * 0.94 });
    txt(ctx, 'ROOM TILING PUZZLE', hero.x + hero.w / 2, ty + tb * 0.34, { size: tb * 0.2, weight: 700, color: '#fff2c8', align: 'center', maxW: hero.w * 0.9, min: 13 });
  } else {
    drawMini(ctx, roomBox, { cols: sp.cols, rows: sp.rows, room: sp.room, tiles: sp.tiles.slice(0, shown) }, { t: s.t, fxDrop });
    txt(ctx, 'TATAMI', hero.x + hero.w / 2, ty - tb * 0.1, { size: tb * 0.56, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.94, min: 24 });
    txt(ctx, 'ROOM TILING PUZZLE', hero.x + hero.w / 2, ty + tb * 0.3, { size: tb * 0.2, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13 });
  }
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${GRADE_INFO[s.saved.level].name}${s.saved.kind === 'daily' ? ' · Daily' : ''}  ·  ${fmtTime(s.saved.t)}` : ''],
    new: ['New Game', 'Five grades, every room checked'], daily: ['Daily Puzzle', s.dailyInfo],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(B)) {
    const prim = id === 'continue' || id === 'new' || id === 'daily', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'new' || id === 'continue' ? 'accent' : 'solid', size: prim ? 34 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ shared page furniture ===============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(44), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20 });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  const ch = draw();
  ctx.restore();
  metrics.max = Math.max(0, ch - rect.h); metrics.view = rect.h; metrics.rect = rect;
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 4, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 6, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 6, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}

export const NEW_CARDS = ['daily', 1, 2, 3, 4, 5];
function drawNew(ctx, s, w, h) {
  const T = theme(), NL = newLayout(w, h, NEW_CARDS.length);
  header(ctx, s, NL, 'New Game');
  scrollBody(ctx, s, NL.body, () => {
    NEW_CARDS.forEach((id, i) => {
      const r = NL.cards[i], isDaily = id === 'daily', lvl = isDaily ? s.dailyLevel : id, gi = GRADE_INFO[lvl], st = s.stats;
      const sel = !isDaily && id === s.prefs.grade;
      panel(ctx, r, { radius: 22, fill: isDaily ? rgba(T.accent, 0.14) : T.panel, line: sel ? T.accent : T.line });
      if (sel) { rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      txt(ctx, isDaily ? 'Daily Puzzle' : gi.name, r.x + 24, r.y + 32, { size: F(38), weight: 700, color: T.text, maxW: r.w * 0.55, min: 20 });
      txt(ctx, isDaily ? `${gi.name} today · streak ${s.streak}` : gi.tag, r.x + 24, r.y + 64, { size: F(21), weight: 600, color: T.accent, maxW: r.w * 0.6, min: 12 });
      para(ctx, isDaily ? 'The same room for everyone, new every day.' : gi.text, r.x + 24, r.y + 80, r.w - 48 - (r.w > 520 ? 150 : 0), { size: F(r.h < 135 ? 19 : 22), weight: 400, color: T.dim, lh: 1.15 });
      if (isDaily && s.dailyDone) icons.check(ctx, r.x + r.w - 44, r.y + 40, 34, T.good);
      else if (!isDaily) {
        const best = st.best[id], tx = r.x + r.w - 24;
        txt(ctx, best ? fmtTime(best) : '–', tx, r.y + 38, { size: F(30), weight: 600, color: T.text, align: 'right' });
        txt(ctx, `best  ·  ${st.solved[id]} solved`, tx, r.y + 70, { size: F(20), weight: 400, color: T.dim, align: 'right', maxW: 200, min: 11 });
      }
    });
    return NL.contentH;
  });
  button(ctx, NL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ docs ===================================================================
function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s);
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(38) * sc, weight: 700, color: T.accent, maxW: width, min: 16 }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) { y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc; }
      else if (b.h) { y += para(ctx, b.h, x, y, width, { size: F(32) * sc, weight: 700, color: T.text }) + 8 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = F(27) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 400, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  if (DL.split) {
    if (page.fig) drawFigure(ctx, figR, page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w * 0.62, Math.max(240, textR.h * (sc > 1.6 ? 0.34 : 0.4)), 460), fr = R(textR.x + (textR.w - Math.min(textR.w, fh * 1.5)) / 2, y, Math.min(textR.w, fh * 1.5), fh);
        drawFigure(ctx, fr, page.fig, s.t); y += fr.h + 16;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings ===============================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), rows = settingRows(s), SL = settingsLayout(w, h, sc, rows.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    rows.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      if (row.id === 'restore') {
        const lab = s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase';
        button(ctx, g.ctrl, lab, { size: 24, radius: 14, kind: s.owned ? 'solid' : 'accent', disabled: s.owned || s.restoreBusy, flash: flashOf(s, 'set' + i + '.0'), sub: s.restoreMsg || '' });
        return;
      }
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ stats ==================================================================
function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = statsLayout(w, h), st = s.stats;
  header(ctx, s, SL, 'Stats');
  const total = st.solved.reduce((a, b) => a + b, 0), wide = SL.body.w >= 1000;
  scrollBody(ctx, s, SL.body, () => {
    const r = SL.body, gapC = 28, lw = wide ? (r.w - gapC) * 0.54 : r.w, x = r.x; let y = r.y;
    const cols = lw > 760 ? 4 : 2, tiles = [['Rooms solved', total], ['Daily streak', s.streak], ['Best streak', st.bestStreak], ['Dailies solved', st.days.length]];
    const th = 110 * Math.min(sc, 1.8), g = 12, tw = (lw - g * (cols - 1)) / cols;
    tiles.forEach(([l, v], i) => {
      const tr = R(x + (i % cols) * (tw + g), y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(46) * Math.min(sc, 1.6), weight: 700, color: T.text });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(22) * Math.min(sc, 1.6), weight: 400, color: T.dim, maxW: tw - 30, min: 11 });
    });
    y += Math.ceil(tiles.length / cols) * (th + g) + 10;
    txt(ctx, 'By grade', x, y + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent }); y += 50 * sc;
    for (let l = 1; l <= 5; l++) {
      const rh = 76 * Math.min(sc, 1.8), rr2 = R(x, y, lw, rh);
      panel(ctx, rr2, { radius: 16 });
      txt(ctx, GRADE_INFO[l].name, x + 20, y + rh / 2, { size: F(28) * Math.min(sc, 1.6), weight: 600, color: T.text, maxW: lw * 0.3, min: 13 });
      txt(ctx, `${st.solved[l]} solved`, x + lw * 0.42, y + rh / 2, { size: F(24) * Math.min(sc, 1.6), weight: 400, color: T.dim, maxW: lw * 0.25, min: 12 });
      txt(ctx, st.best[l] ? `best ${fmtTime(st.best[l])}` : 'no time yet', x + lw - 20, y + rh / 2, { size: F(24) * Math.min(sc, 1.6), weight: 500, color: T.text, align: 'right', maxW: lw * 0.36, min: 12 });
      y += rh + 8;
    }
    const leftEnd = y;
    let cx = x, cw = lw, cy;
    if (wide) { cx = x + lw + gapC; cw = r.w - lw - gapC; cy = r.y; } else { y += 14; cy = y; }
    txt(ctx, 'Last five weeks', cx, cy + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent }); cy += 50 * sc;
    const cs = Math.min(wide ? 110 : 86, (cw - 6 * 8) / 7), done = new Set(st.days);
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => txt(ctx, d, cx + i * (cs + 8) + cs / 2, cy + 12, { size: F(20), weight: 500, color: T.dim, align: 'center' }));
    cy += 28;
    const today = s.daily.day, wd = (today + 4) % 7, start = today - wd - 28;
    for (let k = 0; k < 35; k++) {
      const day = start + k, ex = cx + (k % 7) * (cs + 8), ey = cy + Math.floor(k / 7) * (cs + 8), isDone = done.has(day), future = day > today;
      rr(ctx, ex, ey, cs, cs, cs * 0.2); ctx.fillStyle = isDone ? T.good : future ? 'rgba(128,128,128,0.08)' : T.btn; ctx.fill();
      if (day === today) { ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      if (isDone) icons.check(ctx, ex + cs / 2, ey + cs / 2, cs * 0.5, '#06241a');
    }
    cy += 5 * (cs + 8) + 10;
    return Math.max(wide ? leftEnd : 0, cy) - r.y;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ result =================================================================
function drawOver(ctx, s, w, h) {
  setBrandTone(true);
  const T = theme(), sc = scaleOf(s), R0 = s.result;
  if (!R0 || !s.P) return;
  const P = s.P, O = overLayout(w, h, sc, P.B.w, P.B.h);
  if (v3.on && v3.fit) { v3.fit(O.room, 'over', { calm: s.prefs.calm, board: P.B }); v3.frame = { B: P.B, win: 1, bad: [], marks: null, ghost: null, hide: false }; }
  else drawRoom(ctx, O.room, P.B, { t: s.t, win: 1, showBad: false, fxDrop: {} });
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 40 : 54;
    txt(ctx, R0.daily ? 'Daily Puzzle solved' : 'Room finished', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * Math.min(sc, 1.5), weight: 700, color: T.text, align: 'center', maxW: body.w, min: 22 }); y += (tsz + 12) * Math.min(sc, 1.5);
    const sz = compact ? 36 : 52;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = [['Time', fmtTime(R0.time)], ['Par', fmtTime(R0.par)], ['Slips', R0.errs], ['Hints', R0.hints]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 82) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * Math.min(sc, 1.6), weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 14 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * Math.min(sc, 1.6), weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.newBest) { txt(ctx, 'New best time for this grade', body.x + body.w / 2, y + 16, { size: F(26) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) { y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8; }
    y += para(ctx, `${R0.mats} mats laid, ${R0.fullMats} full and ${R0.halfMats} half.`, body.x, y, body.w, { size: F(24) * sc, weight: 400, color: T.dim, align: 'center' }) + 6;
    return y - body.y + 10;
  });
  button(ctx, O.btns.next, R0.daily ? 'Back to menu' : 'Next room', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.daily ? 'New game' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(true);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, v3.on ? { radius: 28 } : { radius: 28, fill: 'rgba(20,18,32,0.94)' }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the demo end', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has all five grades, the Daily Puzzle, four seasons, hints that teach and Watch and Learn. Get Tatami Room Tiling Puzzle on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
