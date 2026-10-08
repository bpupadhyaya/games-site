// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, playLayoutZ, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, pageLayout, popLayout, listGeo, centerCard, TEXT_SCALES, host, R, clamp, grid, boardGeo, THINK_STEPS } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, keycap, rr, txt, para, paraHeight, wrap, setFont, F, mix, rgba, icons } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { fmtTime, GRADES, filled } from './play.js';
import { DIR_NAME, slotOf, slotName, pattern, makePuzzle } from './grid.js';
import { LIBRARY } from './library.js';
import { drawGrid } from './board.js';
import { DOCS } from './content.js';
import { drawFigure } from './figures.js';

export const metrics = { max: 0, view: 0, rect: null, list: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'check', label: 'Check as I type', opts: ['Off', 'On'] },
  { id: 'skip', label: 'Skip filled squares', opts: ['On', 'Off'] },
  { id: 'next', label: 'Next clue when done', opts: ['On', 'Off'] },
  { id: 'hilite', label: 'Highlight answer', opts: ['On', 'Off'] },
  { id: 'timer', label: 'Show timer', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'check': return p.check === 'type' ? 1 : 0;
    case 'skip': return p.skip ? 0 : 1;
    case 'next': return p.next ? 0 : 1;
    case 'hilite': return p.hilite ? 0 : 1;
    case 'timer': return p.timer ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
export const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
export const CHECK_ITEMS = ['Letter', 'Word', 'Puzzle'];
export const listFs = () => F(21);

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  background(ctx, w, h, s.prefs.calm ? 0 : s.t);
  metrics.max = 0; metrics.rect = null; metrics.list = null;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'new') drawNew(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'clues') drawCluesScene(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ the grid on the play screen ============================================
function gridOptions(s) {
  const P = s.P, pz = P.pz, slot = s.sel >= 0 ? slotOf(pz, s.sel, s.dir) : -1;
  const cells = s.prefs.hilite && slot >= 0 && !s.paused ? new Set(pz.slots[slot].cells) : null;
  const flash = new Map();
  for (const f of s.cellFlash) for (const c of f.cells) flash.set(c, Math.max(flash.get(c) ?? 0, Math.max(0, 1 - f.t / 0.9)));
  let focus = null;
  if (s.hint?.slot) focus = new Set(s.hint.slot.cells); else if (s.auto.on && s.auto.slot) focus = new Set(s.auto.slot.cells);
  if (s.hint?.stage === 'mistake') focus = new Set([s.hint.cell]);
  return { v: P.v, pencil: P.pencil, rev: P.rev, mark: P.mark, sel: s.sel, cells, focus, flash, pop: s.fx.pop, wave: s.fx.wave, shake: s.fx.shake, autoCheck: s.prefs.check === 'type', win: s.winT > 0, hideLetters: s.paused };
}
function drawBoard(ctx, s, L) {
  drawGrid(ctx, L.board, s.P.pz, gridOptions(s));
  if (L.chip && !s.paused) { const c = L.chip; ctx.save(); rr(ctx, c.x, c.y, c.w, c.h, 20); ctx.fillStyle = theme().frame; ctx.fill(); button(ctx, c, '', { icon: 'zoom', size: 26, radius: 20, active: L.zoomOn, flash: flashOf(s, 'zoom') }); ctx.restore(); }
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// ================================================================ play screen ============================================================
function drawPlay(ctx, s, w, h) {
  const P = s.P, coach = !!(s.hint || s.auto.on);
  const L = playLayoutZ(w, h, { coach, n: P.pz.n }, s);
  if (L.panel) { panel(ctx, L.panel, { radius: 26 }); edgeStroke(ctx, L.panel, 26, 0.3); }
  drawBoard(ctx, s, L);
  drawHud(ctx, s, L);
  if (L.list) drawListPanel(ctx, s, L);
  if (s.paused) { ctx.save(); ctx.globalAlpha = 0.3; if (L.clue) drawControls(ctx, s, L); ctx.restore(); drawPaused(ctx, s, L); }
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else { drawControls(ctx, s, L); if (s.menu) drawPop(ctx, s, L); }
  drawMsg(ctx, s, L);
}

function drawHud(ctx, s, L) {
  const T = theme(), P = s.P, pr = s.prefs, g = GRADES[P.level], h = L.hud;
  const title = s.auto.on ? 'Watch and Learn' : P.kind === 'daily' ? 'Daily Crossword' : g.name;
  const sub = P.kind === 'daily' ? `${g.name} · ${g.tag}` : `${filled(P)} of ${P.pz.white} squares`;
  const port = L.mode === 'portrait', maxT = port ? L.U.w * 0.4 : L.panel.w - 200;
  txt(ctx, title, h.title.x, h.title.y, { size: F(34), weight: 800, color: T.text, maxW: maxT, min: 16 });
  txt(ctx, sub, h.sub.x, h.sub.y, { size: F(21), weight: 600, color: T.dim, maxW: maxT, min: 12 });
  if (port) {
    if (pr.timer && !s.auto.on) txt(ctx, fmtTime(P.t), h.timer.x, h.timer.y, { size: F(38), weight: 700, color: T.text, align: 'center' });
    if (pr.check === 'type' && !s.auto.on) txt(ctx, `Mistakes ${P.errs}`, h.mist.x, h.mist.y, { size: F(21), weight: 600, color: P.errs ? T.err : T.dim, align: 'right', maxW: 160, min: 12 });
  } else {
    if (pr.timer && !s.auto.on) txt(ctx, fmtTime(P.t), h.timer.x, h.timer.y, { size: F(36), weight: 700, color: T.text, align: 'right', maxW: 150, min: 16 });
    if (pr.check === 'type' && !s.auto.on) txt(ctx, `Mistakes ${P.errs}`, h.mist.x, h.mist.y, { size: F(19), weight: 600, color: P.errs ? T.err : T.dim, align: 'right', maxW: 170, min: 12 });
  }
  button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
}

// ---- clue list (embedded panel) -------------------------------------------------------------------------------------------------
export function listArea(L) {
  if (!L.list) return null;
  if (L.mode === 'portrait' || L.listIn) return R(L.list.x, L.list.y, L.list.w, L.list.h);
  return R(L.list.x + 6, L.listTop + 36, L.list.w - 12, L.list.y + L.list.h - (L.listTop + 36) - 10);
}
function drawListPanel(ctx, s, L) {
  const T = theme(), pz = s.P.pz;
  panel(ctx, L.list, { radius: 24 }); edgeStroke(ctx, L.list, 24, 0.3);
  if (L.mode !== 'portrait' && !L.listIn) txt(ctx, 'Clues', L.list.x + (L.back.w && L.list.x <= L.U.x0 + 60 ? L.back.w + 4 - (L.list.x - L.U.x0) : 18), L.listTop + 8, { size: F(30), weight: 800, color: T.text, maxW: L.list.w - 80, min: 16 });
  const area = listArea(L);
  drawCluesColumn(ctx, s, area, pz, 0, 'list');
}
// Draws the scrolling list inside `area`; reports scroll metrics in metrics.list (used by game.js for taps and dragging).
export function drawCluesColumn(ctx, s, area, pz, pad, key) {
  const T = theme(), fs = listFs(), geo = listGeo(area, pz, fs), cur = s.sel >= 0 ? slotOf(pz, s.sel, s.dir) : -1;
  const cross = s.sel >= 0 ? (s.dir === 0 ? pz.dwn[s.sel] : pz.acc[s.sel]) : -1, scroll = key === 'list' ? s.listY : s.scrollY;
  const max = Math.max(0, geo.total - area.h + 6);
  metrics.list = { area, geo, max, key };
  ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.w, area.h); ctx.clip();
  for (const row of geo.rows) {
    const y = area.y + row.y - scroll;
    if (y + row.h < area.y - 4 || y > area.y + area.h + 4) continue;
    if (row.k === 'head') {
      txt(ctx, row.label.toUpperCase(), area.x + 16 + pad, y + row.h * 0.62, { size: F(19), weight: 800, color: T.accent, maxW: area.w - 32 });
      continue;
    }
    const slot = pz.slots[row.id], done = s.P.sdone[row.id], isCur = row.id === cur;
    const rx = area.x + 6 + pad, rw = area.w - 12 - 2 * pad;
    if (isCur) { rr(ctx, rx, y + 2, rw, row.h - 4, 12); ctx.fillStyle = rgba(T.accent, 0.22); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke(); }
    else if (row.id === cross) { rr(ctx, rx, y + 2, rw, row.h - 4, 12); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(T.accent, 0.5); ctx.stroke(); }
    const nw = fs * 2.3, tw = rw - nw - 14, lines = Math.min(2, wrap(ctx, slot.clue, tw, fs, 600).length), th = lines * fs * 1.17;
    txt(ctx, slot.num, rx + nw / 2 + 4, y + row.h / 2, { size: fs * 1.05, weight: 800, color: done ? T.good : T.accent, align: 'center' });
    para(ctx, slot.clue, rx + nw + 6, y + (row.h - th) / 2, tw, { size: fs, weight: 600, color: done ? T.dim : T.text, lh: 1.17, maxLines: 2 });
    if (done) icons.check(ctx, rx + rw - 16, y + 16, fs * 0.8, T.good);
  }
  ctx.restore();
  if (max > 0) { const th = Math.max(36, area.h * area.h / geo.total), ty = area.y + (area.h - th) * clamp(scroll / max, 0, 1); rr(ctx, area.x + area.w - 5, ty, 4, th, 2); ctx.fillStyle = rgba(T.accent, 0.7); ctx.fill(); }
}

// ---- controls under / beside the grid -----------------------------------------------------------------------------------------------
function drawControls(ctx, s, L) {
  const T = theme(), P = s.P, pz = P.pz;
  // current clue card
  const c = L.clue, slot = s.sel >= 0 ? pz.slots[slotOf(pz, s.sel, s.dir)] : null;
  rr(ctx, c.x, c.y, c.w, c.h, 20); ctx.fillStyle = T.panel; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke();
  button(ctx, L.clueNav.prev, '', { icon: 'back', size: 30, radius: 16, flash: flashOf(s, 'cprev') });
  button(ctx, L.clueNav.next, '', { icon: 'next', size: 30, radius: 16, flash: flashOf(s, 'cnext') });
  const tr = L.clueMain;
  const drawClue = (sl, r, big, dim) => {
    txt(ctx, `${dim ? 'CROSSING  ·  ' : ''}${sl.num} ${DIR_NAME[sl.dir].toUpperCase()} · ${sl.len}`, r.x, r.y + F(20) * 0.7, { size: F(19), weight: 800, color: dim ? T.dim : T.accent, maxW: r.w });
    const body = R(r.x, r.y + F(20) * 1.6, r.w, r.h - F(20) * 1.7);
    let size = F(big);
    while (size > F(15) && paraHeight(ctx, sl.clue, body.w, size, 600, 1.16) > body.h) size -= 1;
    para(ctx, sl.clue, body.x, body.y, body.w, { size, weight: 600, color: dim ? T.dim : T.text, lh: 1.16, maxLines: Math.max(1, Math.floor(body.h / (size * 1.16))) });
  };
  if (slot) {
    drawClue(slot, tr, L.mode === 'portrait' ? 31 : 32, false);
    if (L.clueCross) {
      const cid = slot.dir === 0 ? pz.dwn[s.sel] : pz.acc[s.sel];
      const cr = L.clueCross;
      ctx.beginPath(); ctx.moveTo(cr.x, cr.y - 3); ctx.lineTo(cr.x + cr.w, cr.y - 3); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke();
      if (cid >= 0) drawClue(pz.slots[cid], cr, 26, true);
    }
  } else txt(ctx, 'Tap a white square to begin', tr.x + tr.w / 2, tr.y + tr.h / 2, { size: F(28), weight: 600, color: T.dim, align: 'center', maxW: tr.w });
  // keyboard
  const used = new Set(); // letters are never "used up" in a crossword; keep it simple
  for (const ch of Object.keys(L.keys)) {
    const k = L.keys[ch], fl = flashOf(s, 'k' + ch);
    if (ch === 'DEL') keycap(ctx, k, '', { icon: 'del', pressed: fl });
    else keycap(ctx, k, ch, { pressed: fl, size: Math.min(k.w * 0.56, (k.h - 5) * 0.5) });
  }
  // tools
  const tl = L.tools, hasUndo = P.undo.length > 0, hasRedo = P.redo.length > 0;
  const defs = { undo: ['Undo', 'undo', !hasUndo], redo: ['Redo', 'redo', !hasRedo], pencil: ['Pencil', 'pencil', false], check: ['Check', 'mark', false], reveal: ['Reveal', 'eye', false], hint: ['Hint', 'bulb', false], list: ['Clues', 'list', false] };
  for (const id of tl.ids) {
    const [label, icon, dis] = defs[id], r = tl[id], on = (id === 'pencil' && s.pencilMode) || (s.menu === id), hint = id === 'hint';
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    rr(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = hint ? T.accent : on ? rgba(T.accent, 0.25) : T.btn; ctx.fill();
    const fl = flashOf(s, id); if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
    ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? T.accent : hint ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
    const col = hint ? T.onAccent : T.text;
    if (r.h >= 52) {
      const isz = Math.min(r.h * 0.4, r.w * 0.46, 40);
      icons[icon](ctx, r.x + r.w / 2, r.y + r.h * 0.38, isz, col);
      txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.8, { size: F(Math.min(17, r.w * 0.25)), weight: 700, color: col, align: 'center', maxW: r.w - 6, min: 11 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 34), col);
    if (id === 'pencil' && s.pencilMode) { ctx.beginPath(); ctx.arc(r.x + r.w - 10, r.y + 10, 5, 0, 7); ctx.fillStyle = T.accent; ctx.fill(); }
    ctx.restore();
  }
}
function drawPop(ctx, s, L) {
  const T = theme(), anchor = L.tools[s.menu], pl = popLayout(L, anchor, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, pl.card, { radius: 22, fill: T.dark ? 'rgba(14,24,34,0.97)' : 'rgba(255,253,246,0.98)' }); edgeStroke(ctx, pl.card, 22, 0.5);
  CHECK_ITEMS.forEach((lab, i) => button(ctx, pl.items[i], `${s.menu === 'check' ? 'Check' : 'Reveal'} ${lab.toLowerCase()}`, { size: 26, kind: i === 0 ? 'solid' : 'solid', flash: flashOf(s, 'pop' + i) }));
}

// ---- hint card and Watch and Learn --------------------------------------------------------------------------------------------------------
function patternBoxes(ctx, x, y, w, pat, size) {
  const T = theme(), n = pat.length, gap = 6, bw = Math.min(size * 1.15, (w - gap * (n - 1)) / n);
  const x0 = x + Math.max(0, (w - (n * bw + (n - 1) * gap)) / 2);
  [...pat].forEach((ch, i) => {
    const bx = x0 + i * (bw + gap);
    rr(ctx, bx, y, bw, bw * 1.1, 8); ctx.fillStyle = T.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ch === '_' ? T.rim : T.good; ctx.stroke();
    if (ch !== '_') txt(ctx, ch, bx + bw / 2, y + bw * 0.58, { size: bw * 0.72, color: T.letter, align: 'center', serif: true });
  });
  return bw * 1.1;
}
function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, big = C.h > 560;
  const title = hnt.stage === 'mistake' ? 'Something is off' : hnt.ex.name, chip = hnt.stage === 'look' ? 'Where to look' : hnt.stage === 'explain' ? 'How to think about it' : 'Check this square';
  const ts = F(big ? 44 : C.h > 360 ? 34 : 28);
  txt(ctx, title, x, C.y + 14 + ts * 0.6, { size: ts, weight: 800, color: T.accent, maxW: w * 0.6, min: 16 });
  txt(ctx, chip, C.x + C.w - 20, C.y + 14 + ts * 0.6, { size: F(big ? 22 : 19), weight: 600, color: T.dim, align: 'right', maxW: w * 0.4, min: 11 });
  let y = C.y + 14 + ts * 1.4;
  if (hnt.stage !== 'mistake') { const bh = patternBoxes(ctx, x, y, w, hnt.ex.pattern, Math.min(big ? 66 : 46, C.h * 0.11)); y += bh + 12; }
  const bodyH = B.close.y - 10 - y;
  const text = hnt.stage === 'look' ? hnt.ex.lookBody : hnt.stage === 'explain' ? `${hnt.slot.clue}\n${hnt.text}` : hnt.text;
  let size = F(big ? 36 : C.w > 500 ? 28 : 25);
  while (size > 14 && paraHeight(ctx, text, w, size, 600, 1.25) > bodyH) size -= 1;
  para(ctx, text, x, y, w, { size, weight: 600, color: T.text, lh: 1.25 });
  button(ctx, B.close, 'Close', { size: 27, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Why?' : hnt.stage === 'mistake' ? 'Clear it' : 'Write it in', { kind: 'accent', size: 27, flash: flashOf(s, 'go') });
}
function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, slot = a.slot, T0 = L.coachText, big = C.h > 560;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, ts = F(big ? 44 : C.h > 360 ? 34 : 28), name = slot && !a.done ? slotName(s.P.pz, slot.id) : a.done ? 'Solved' : 'Thinking';
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 800, color: T.accent, maxW: w * 0.5, min: 16 });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it fits' : a.phase === 'write' ? 'Writing it in' : a.done ? 'The puzzle is complete' : 'Finding the next answer';
  txt(ctx, `Step ${a.n}  ·  ${phase}`, C.x + C.w - 20, T0.y + 14 + ts * 0.6, { size: F(big ? 22 : 19), weight: 600, color: T.dim, align: 'right', maxW: w * 0.5, min: 11 });
  let y = T0.y + 14 + ts * 1.4;
  if (slot && !a.done) { const bh = patternBoxes(ctx, x, y, w, pattern(s.P.v, s.P.pz, slot), Math.min(big ? 62 : 42, C.h * 0.1)); y += bh + 10; }
  const bodyH = T0.y + T0.h - y;
  let text;
  if (a.done) text = 'Every square is filled. Tap Exit to go back to the menu.';
  else if (!slot) text = 'Looking for the answer a careful solver would try next.';
  else if (a.phase === 'think') text = a.ex.lookBody;
  else if (a.phase === 'reveal') text = `${slot.clue}\n${a.ex.why} ${a.ex.reveal}`;
  else text = `${slot.clue}\n${a.ex.reveal}`;
  let size = F(big ? 34 : C.w > 500 ? 26 : 24);
  while (size > 13 && paraHeight(ctx, text, w, size, 600, 1.22) > bodyH) size -= 1;
  para(ctx, text, x, y, w, { size, weight: 600, color: T.text, lh: 1.22 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 25, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 25, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 25, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 25, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, rl.dec.x + (rl.inc.x + rl.inc.w - rl.dec.x) / 2, rl.dec.y - 12, { size: F(18), weight: 600, color: T.dim, align: 'center' });
}
function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.board);
  ctx.fillStyle = rgba(T.frame, 0.9); rr(ctx, L.board.x, L.board.y, L.board.size, L.board.size, L.board.size * 0.03); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(14,24,34,0.97)' : 'rgba(255,253,246,0.98)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 800, color: T.text, align: 'center' });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 29, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart puzzle', { size: 27, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 27, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 27, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), portrait = L.mode === 'portrait';
  const bx = L.board, w = portrait ? Math.min(bx.size - 30, 560) : L.panel.w - 24, cx2 = portrait ? bx.x + bx.size / 2 : L.panel.x + L.panel.w / 2;
  let size = F(portrait ? 24 : 26), lines = wrap(ctx, m.text, w - 36, size, 700);
  while (portrait && lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 700); }
  const hh = lines.length * size * 1.22 + 22;
  const y = portrait ? L.hud.title.y - 26 + Math.max(0, (80 - hh) / 2) : L.panel.y + 96;
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(10,20,28,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 700, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ title ==================================================================
const TITLE_PUZZLE = makePuzzle(LIBRARY[1][1] ?? LIBRARY[1][0], 5);
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(190, Math.max(76, H * 0.32));
  const gs = Math.max(90, Math.min(hero.w * 0.66, (H - tb - 18) / 1.04, 520)), x0 = hero.x + (hero.w - gs) / 2, y0 = hero.y + Math.max(0, (H - gs - tb) / 2);
  const pz = TITLE_PUZZLE, N = pz.white, cyc = N + 10, k = Math.floor(((s.t * 2.6) % cyc)), shown = Math.min(N, k);
  const order = []; for (const sl of pz.slots.filter((x) => x.dir === 0)) order.push(...sl.cells); for (const sl of pz.slots.filter((x) => x.dir === 1)) order.push(...sl.cells);
  const seen = new Set(order.slice(0, shown)), v = pz.sol.map((ch, i) => (seen.has(i) ? ch : ''));
  const cur = order[Math.min(shown, order.length - 1)];
  const wv = pz.sol.map((c, i) => (seen.has(i) ? -1 : 99));
  drawGrid(ctx, boardGeo(x0, y0, gs, 5), pz, { v, sel: shown < N ? cur : -1, numbers: true, cells: shown < N ? new Set(pz.slots[pz.acc[cur] >= 0 ? pz.acc[cur] : pz.dwn[cur]].cells) : null, wave: wv });
  const ty = y0 + gs + tb * 0.52;
  txt(ctx, 'CROSSWORD', hero.x + hero.w / 2, ty, { size: tb * 0.6, color: T.text, align: 'center', maxW: hero.w * 0.96, min: 24, serif: true });
  txt(ctx, 'GRID  &  CLUES', hero.x + hero.w / 2, ty + tb * 0.42, { size: tb * 0.2, weight: 800, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13 });
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${GRADES[s.saved.level].name}${s.saved.kind === 'daily' ? ' · Daily' : ''}  ·  ${fmtTime(s.saved.t)}` : ''],
    new: ['New Game', 'Five sizes, hundreds of clues'], daily: ['Daily Crossword', s.dailyInfo],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(B)) {
    const prim = id === 'continue' || id === 'new' || id === 'daily', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'new' || id === 'continue' ? 'accent' : 'solid', size: prim ? 33 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, clamp(0.036 * Math.min(w, h) * 0.9, 17, 22), { dim: 0.95 });
}

// ================================================================ header + scrolling body helpers ==========================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(44), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20, serif: true });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 600, color: T.dim, align: 'right' });
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

// ================================================================ new game ===============================================================
export const NEW_CARDS = ['daily', 1, 2, 3, 4, 5];
function drawNew(ctx, s, w, h) {
  const T = theme(), NL = newLayout(w, h, NEW_CARDS.length);
  header(ctx, s, NL, 'New Game');
  scrollBody(ctx, s, NL.body, () => {
    NEW_CARDS.forEach((id, i) => {
      const r = NL.cards[i], isDaily = id === 'daily', lvl = isDaily ? s.dailyLevel : id, gi = GRADES[lvl], st = s.stats;
      const sel = !isDaily && id === s.prefs.grade;
      panel(ctx, r, { radius: 22, fill: isDaily ? rgba(T.accent, 0.14) : T.panel, line: sel ? T.accent : T.line });
      if (sel) { rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      // little grid glyph: a real puzzle pattern of that size
      const gz = Math.min(r.h - 36, 74), gx = r.x + 22, gy = r.y + (r.h - gz) / 2, cn = gi.n, cell = gz / cn, pat = LIBRARY[lvl][0];
      rr(ctx, gx, gy, gz, gz, 8); ctx.fillStyle = T.paper; ctx.fill();
      for (let a = 0; a < cn; a++) for (let b = 0; b < cn; b++) if (pat[a * cn + b] === '#') { ctx.fillStyle = T.block; ctx.fillRect(gx + b * cell, gy + a * cell, cell + 0.5, cell + 0.5); }
      ctx.lineWidth = 2; ctx.strokeStyle = T.rim; rr(ctx, gx, gy, gz, gz, 8); ctx.stroke();
      const tx = gx + gz + 22;
      txt(ctx, isDaily ? 'Daily Crossword' : gi.name, tx, r.y + 34, { size: F(36), weight: 800, color: T.text, maxW: r.w * 0.5, min: 20 });
      txt(ctx, isDaily ? `${gi.name} today · streak ${s.streak}` : gi.tag, tx, r.y + 66, { size: F(21), weight: 700, color: T.accent, maxW: r.w * 0.55, min: 12 });
      para(ctx, isDaily ? 'The same puzzle for everyone, new every day.' : gi.text, tx, r.y + 80, r.w - (tx - r.x) - 24 - (r.w > 560 ? 150 : 0), { size: F(r.h < 135 ? 18 : 21), weight: 500, color: T.dim, lh: 1.15, maxLines: 3 });
      if (isDaily && s.dailyDone) icons.check(ctx, r.x + r.w - 44, r.y + 40, 34, T.good);
      else if (!isDaily) {
        const best = st.best[id], rx = r.x + r.w - 24;
        txt(ctx, best ? fmtTime(best) : '–', rx, r.y + 38, { size: F(30), weight: 700, color: T.text, align: 'right' });
        txt(ctx, `best  ·  ${st.solved[id]} solved`, rx, r.y + 70, { size: F(19), weight: 500, color: T.dim, align: 'right', maxW: 200, min: 11 });
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
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 700, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(40) * sc, weight: 700, color: T.accent, maxW: width, min: 16, serif: true }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) { y += para(ctx, b.p, x, y, width, { size: F(27) * sc, weight: 500, color: T.text, lh: 1.34 }) + 14 * sc; }
      else if (b.h) { y += para(ctx, b.h, x, y, width, { size: F(31) * sc, weight: 800, color: T.text }) + 8 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = F(26) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 500, color: T.text, lh: 1.3 }) + 10 * sc;
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
        const side = Math.min(textR.w - 20, Math.max(240, textR.h * (sc > 1.6 ? 0.34 : 0.44)), 440), fr = R(textR.x + (textR.w - (side + 20)) / 2, y, side + 20, side + 84 + 12);
        drawFigure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings ===============================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = settingsLayout(w, h, sc, SETTINGS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    SETTINGS.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(27) * Math.min(sc, 1.5), weight: 700, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 23, active: k === cur, radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
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
    const cols = lw > 760 ? 4 : 2, tiles = [['Puzzles solved', total], ['Daily streak', s.streak], ['Best streak', st.bestStreak], ['Dailies solved', st.days.length]];
    const th = 110 * Math.min(sc, 1.8), g = 12, tw = (lw - g * (cols - 1)) / cols;
    tiles.forEach(([l, v], i) => {
      const tr = R(x + (i % cols) * (tw + g), y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(46) * Math.min(sc, 1.6), weight: 800, color: T.text });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(22) * Math.min(sc, 1.6), weight: 500, color: T.dim, maxW: tw - 30, min: 11 });
    });
    y += Math.ceil(tiles.length / cols) * (th + g) + 10;
    txt(ctx, 'By size', x, y + 20 * sc, { size: F(32) * sc, weight: 800, color: T.accent }); y += 50 * sc;
    for (let l = 1; l <= 5; l++) {
      const rh = 76 * Math.min(sc, 1.8), rr2 = R(x, y, lw, rh);
      panel(ctx, rr2, { radius: 16 });
      txt(ctx, GRADES[l].name, x + 20, y + rh / 2, { size: F(28) * Math.min(sc, 1.6), weight: 700, color: T.text, maxW: lw * 0.3, min: 13 });
      txt(ctx, `${st.solved[l]} solved`, x + lw * 0.42, y + rh / 2, { size: F(23) * Math.min(sc, 1.6), weight: 500, color: T.dim, maxW: lw * 0.25, min: 12 });
      txt(ctx, st.best[l] ? `best ${fmtTime(st.best[l])}` : 'no time yet', x + lw - 20, y + rh / 2, { size: F(23) * Math.min(sc, 1.6), weight: 600, color: T.text, align: 'right', maxW: lw * 0.36, min: 12 });
      y += rh + 8;
    }
    const leftEnd = y;
    let cx = x, cw = lw, cy;
    if (wide) { cx = x + lw + gapC; cw = r.w - lw - gapC; cy = r.y; } else { y += 14; cy = y; }
    txt(ctx, 'Last five weeks', cx, cy + 20 * sc, { size: F(32) * sc, weight: 800, color: T.accent }); cy += 50 * sc;
    const cs = Math.min(wide ? 110 : 86, (cw - 6 * 8) / 7), done = new Set(st.days);
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => txt(ctx, d, cx + i * (cs + 8) + cs / 2, cy + 12, { size: F(20), weight: 600, color: T.dim, align: 'center' }));
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

// ================================================================ clue list as its own screen ===============================================
export function cluesArea(w, h) {
  const P = pageLayout(w, h, { footer: 1 });
  return R(P.body.x + Math.max(0, (P.body.w - 920) / 2), P.body.y, Math.min(P.body.w, 920), P.body.h);
}
function drawCluesScene(ctx, s, w, h) {
  const P = pageLayout(w, h, { footer: 1 }), f = P.footer, T = theme();
  header(ctx, s, P, 'Clues');
  const area = cluesArea(w, h);
  panel(ctx, area, { radius: 22 });
  s.scrollY = clamp(s.scrollY, 0, 1e6);
  drawCluesColumn(ctx, s, area, s.P.pz, 6, 'scene');
  button(ctx, R(f.x + f.w / 2 - 160, f.y, 320, f.h), 'Back to the grid', { icon: 'back', size: 28, flash: flashOf(s, 'back') });
}

// ================================================================ result =================================================================
function drawOver(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), sc = scaleOf(s), R0 = s.result;
  if (!R0 || !s.P) return;
  const O = overLayout(w, h, sc, s.P.pz.n);
  drawGrid(ctx, O.board, s.P.pz, { v: s.P.v, numbers: O.board.s > 38, wave: s.fx.wave, win: true });
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 40 : 54;
    txt(ctx, R0.daily ? 'Daily Crossword solved' : 'Solved', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * Math.min(sc, 1.5), color: T.text, align: 'center', maxW: body.w, min: 22, serif: true }); y += (tsz + 12) * Math.min(sc, 1.5);
    const sz = compact ? 36 : 52;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = [['Time', fmtTime(R0.time)], ['Par', fmtTime(R0.par)], ['Mistakes', R0.errs], ['Help used', R0.help]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 82) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * Math.min(sc, 1.6), weight: 800, color: T.text, align: 'center', maxW: fw - 8, min: 14 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * Math.min(sc, 1.6), weight: 500, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.newBest) { txt(ctx, 'New best time for this size', body.x + body.w / 2, y + 16, { size: F(26) * sc, weight: 700, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) { y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 700, color: T.accent, align: 'center' }) + 8; }
    y += para(ctx, 'Longest answers in this puzzle', body.x, y, body.w, { size: F(26) * sc, weight: 800, color: T.accent }) + 12 * sc;
    for (const t of R0.longest) {
      txt(ctx, t.word, body.x + 8, y + 14 * sc, { size: F(28) * sc, color: T.text, serif: true, maxW: body.w * 0.4 });
      y += para(ctx, t.clue, body.x + 8, y + 30 * sc, body.w - 16, { size: F(22) * sc, weight: 500, color: T.dim, lh: 1.2 }) + 38 * sc;
    }
    return y - body.y + 10;
  });
  button(ctx, O.btns.next, R0.daily ? 'Back to menu' : 'Next puzzle', { kind: 'accent', size: 31, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 27, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.daily ? 'New game' : 'Menu', { size: 27, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, Math.max(20, 11 / (host.px || 0.55)));
}
function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 800, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has all five sizes, the Daily Crossword, hints that teach and Watch and Learn. Get Crossword Grid Clues on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(27), weight: 500, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
