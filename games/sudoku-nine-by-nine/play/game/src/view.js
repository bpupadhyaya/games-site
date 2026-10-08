// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, pageLayout, centerCard, frame, TEXT_SCALES, host, inRect, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, tile, rr, txt, para, paraHeight, wrap, setFont, F, mix, rgba, icons, UI } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, brandGradient, drawBadgeStack } from './brand.js';
import { conflict, wrong, remaining, filled, fmtTime, PAR_SECONDS } from './play.js';
import { PEERS, HOUSES, HOUSES_OF, bit, digitsOf, boxOf, rowOf, colOf, TECH_NAME } from './sudoku.js';
import { DOCS, GRADE_INFO } from './content.js';
import { drawFigure } from './figures.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'hand', label: 'Keypad side', opts: ['Right', 'Left'] },
  { id: 'check', label: 'Check my work', opts: ['Off', 'Conflicts', 'Check'] },
  { id: 'autoClear', label: 'Auto-clear notes', opts: ['On', 'Off'] },
  { id: 'hilite', label: 'Highlight lines', opts: ['On', 'Off'] },
  { id: 'timer', label: 'Show timer', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'hand': return p.hand === 'left' ? 1 : 0;
    case 'check': return ['off', 'conflicts', 'check'].indexOf(p.check);
    case 'autoClear': return p.autoClear ? 0 : 1;
    case 'hilite': return p.hilite ? 0 : 1;
    case 'timer': return p.timer ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  background(ctx, w, h, s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'new') drawNew(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  else if (sc === 'loading') drawLoading(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1.length === 7 ? T.bg1 : '#000000', 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ the board ===============================================================
function cellState(s, i) {
  const P = s.P, T = theme(), pr = s.prefs;
  const sv = s.sel >= 0 ? P.v[s.sel] : 0, dv = sv || s.focus;
  let face = T.tile, ink = P.givens[i] ? T.given : T.entry, lift = 0, ring = null;
  const inLines = pr.hilite && s.sel >= 0 && (i === s.sel || PEERS[s.sel].includes(i));
  if (inLines) face = mix(T.tile, T.peer, 0.85);
  if (dv && P.v[i] === dv) face = mix(T.tile, T.same, 0.9);
  const bad = P.v[i] && ((pr.check === 'conflicts' && conflict(P, i)) || (pr.check === 'check' && (wrong(P, i) || conflict(P, i))) || (s.flagWrong && wrong(P, i)));
  if (bad) { face = mix(T.tile, T.errTint, 0.9); ink = T.err; }
  if (i === s.sel) { face = mix(T.tile, T.sel, 0.32); lift = 1; ring = T.sel; }
  return { face, ink, lift, ring };
}
function hintMarks(s) {
  const h = s.hint;
  if (!h || !h.ex) return null;
  const m = { houses: new Set(), seen: new Set(), focus: new Set(), elim: new Map(), place: -1, stage: h.stage };
  const sh = h.ex.show;
  for (const hh of sh.houses) for (const c of HOUSES[hh]) m.houses.add(c);
  if (h.stage === 'explain') {
    for (const c of sh.seen) m.seen.add(c);
    for (const c of sh.focus) m.focus.add(c);
    for (const e of sh.elim) m.elim.set(e.cell, e.mask);
    if (sh.place) m.place = sh.place.cell;
  } else if (h.stage === 'look') { /* houses only */ }
  return m;
}

function drawBoard(ctx, s, L) {
  const T = theme(), b = L.board, P = s.P, B = b.size, hm = s.hint?.stage === 'mistake' ? s.hint : null, marks = hintMarks(s);
  rr(ctx, b.x - 2, b.y, B + 4, B + 6, B * 0.045); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill();
  rr(ctx, b.x, b.y, B, B, B * 0.04); ctx.fillStyle = T.tray; ctx.fill();
  ctx.lineWidth = Math.max(2, B * 0.006); ctx.strokeStyle = T.rim; ctx.stroke();
  b.plates.forEach((pl) => { rr(ctx, pl.x, pl.y, pl.w, pl.h, B * 0.018); ctx.fillStyle = T.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; ctx.fill(); });
  const cell = b.s, win = s.winT > 0;
  for (let i = 0; i < 81; i++) {
    const r = b.cells[i], st = cellState(s, i);
    let face = st.face;
    if (marks) {
      if (marks.houses.has(i)) face = mix(face, T.peer, 0.8);
      if (marks.seen.has(i)) face = mix(T.tile, '#6aa9ff', 0.45);
      if (marks.focus.has(i)) face = mix(T.tile, '#25c2a0', 0.55);
      if (marks.elim.has(i)) face = T.errTint;
      if (marks.place === i) face = mix(T.tile, T.good, 0.6);
    }
    if (hm && hm.cell === i) { face = mix(T.tile, T.err, 0.45); }
    const wv = s.fx.wave[i], wl = wv > 0 && wv < 0.55 ? Math.sin((Math.PI * wv) / 0.55) : 0;
    if (wl > 0) face = mix(face, win ? '#ffd45a' : T.same, 0.55 * wl);
    const lift = Math.max(st.lift * 0.8, wl);
    const sk = s.fx.shake[i], dx = sk < 0.4 ? Math.sin(sk * 70) * cell * 0.06 * (1 - sk / 0.4) : 0;
    const f = tile(ctx, r.x + dx, r.y, cell, face, T.side, lift, { flat: false });
    if (st.ring) { rr(ctx, f.x - 1.5, f.y - 1.5, f.w + 3, f.h + 3, cell * 0.19); ctx.lineWidth = Math.max(2.5, cell * 0.06); ctx.strokeStyle = st.ring; ctx.stroke(); }
    if (s.paused) continue;
    const v = P.v[i], pp = s.fx.pop[i], pop = pp < 0.26 ? 1 + 0.3 * Math.sin((Math.PI * pp) / 0.26) : 1;
    if (v) {
      ctx.save(); ctx.translate(f.x + f.w / 2 + dx * 0, f.y + f.h / 2 + cell * 0.02); ctx.scale(pop, pop);
      txt(ctx, v, 0, 0, { size: cell * 0.66, weight: P.givens[i] ? 700 : 600, color: st.ink, align: 'center' });
      ctx.restore();
    } else {
      let nm = P.notes[i], over = false;
      if (marks && s.hint.cand && (marks.focus.has(i) || marks.elim.has(i) || marks.place === i)) { nm = s.hint.cand[i]; over = true; }
      if (nm) {
        const dv = (s.sel >= 0 ? P.v[s.sel] : 0) || s.focus, pat = over ? (s.hint.pat | 0) : 0, el = over ? (marks.elim.get(i) | 0) : 0;
        for (const d of digitsOf(nm)) {
          const nx = f.x + f.w * (0.2 + 0.3 * ((d - 1) % 3)), ny = f.y + f.h * (0.2 + 0.3 * Math.floor((d - 1) / 3)) + 1;
          const gone = el & bit(d), hot = (!over && d === dv) || (pat & bit(d));
          txt(ctx, d, nx, ny, { size: cell * 0.285, weight: hot ? 700 : 600, color: gone ? T.err : hot ? (over ? '#0a7a64' : mix(T.sel, T.given, 0.25)) : T.note, align: 'center' });
          if (gone) { ctx.beginPath(); ctx.moveTo(nx - cell * 0.08, ny - cell * 0.08); ctx.lineTo(nx + cell * 0.08, ny + cell * 0.08); ctx.lineWidth = 2; ctx.strokeStyle = T.err; ctx.stroke(); }
        }
      }
    }
  }
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// ================================================================ play screen ============================================================
function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P, coach = !!(s.hint || s.auto.on);
  const L = playLayout(w, h, { coach, hand: s.prefs.hand });
  drawBoard(ctx, s, L);
  drawInfo(ctx, s, L);
  if (s.paused) { ctx.save(); ctx.globalAlpha = 0.3; drawControls(ctx, s, L); ctx.restore(); drawPaused(ctx, s, L); }
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else drawControls(ctx, s, L);
  drawMsg(ctx, s, L);
}

function drawInfo(ctx, s, L) {
  const T = theme(), P = s.P, pr = s.prefs, hud = L.hud, gi = GRADE_INFO[P.level];
  const title = s.auto.on ? 'Watch and Learn' : gi.name, sub = P.kind === 'daily' ? 'Daily Puzzle' : s.auto.on ? `${gi.name} puzzle` : `${filled(P)} of 81 filled`;
  const time = fmtTime(P.t);
  if (L.mode === 'portrait') {
    txt(ctx, title, hud.diff.x, hud.diff.y + 24, { size: F(36), weight: 700, color: T.text, maxW: L.U.w * 0.42, min: 18 });
    txt(ctx, sub, hud.diff.x, hud.diff.y + 56, { size: F(22), weight: 400, color: T.dim, maxW: L.U.w * 0.42, min: 12 });
    if (pr.timer) txt(ctx, time, hud.timer.x + 6, hud.timer.y, { size: F(40), weight: 600, color: T.text, align: 'center' });
    if (pr.check === 'check' && !s.auto.on) txt(ctx, `Mistakes ${P.errs}`, hud.mist.x, hud.mist.y + 2, { size: F(22), weight: 500, color: P.errs ? T.err : T.dim, align: 'right', maxW: 160, min: 12 });
    button(ctx, L.pause, '', { icon: s.paused ? 'play' : 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
    return;
  }
  const r = L.info;
  panel(ctx, r, { radius: 26 });
  edgeStroke(ctx, r, 26, 0.35);
  let y = L.infoTop;
  txt(ctx, title, r.x + 20, y + 24, { size: F(38), weight: 700, color: T.text, maxW: r.w - 120, min: 18 });
  txt(ctx, sub, r.x + 20, y + 62, { size: F(22), weight: 400, color: T.dim, maxW: r.w - 120, min: 12 });
  button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
  if (pr.timer) txt(ctx, time, L.hud.timer.x, L.hud.timer.y + 20, { size: F(L.mode === 'A' ? 68 : 56), weight: 600, color: T.text, align: 'center', maxW: r.w - 40 });
  else txt(ctx, 'Timer hidden', L.hud.timer.x, L.hud.timer.y + 20, { size: F(26), weight: 400, color: T.dim, align: 'center' });
  const ly = L.hud.timer.y + 62;
  if (pr.check === 'check' && !s.auto.on) txt(ctx, `Mistakes  ${P.errs}`, r.x + r.w / 2, ly, { size: F(24), weight: 500, color: P.errs ? T.err : T.dim, align: 'center' });
  if (L.tracker) drawTracker(ctx, s, L.tracker, true);
  if (r.h > 600 && L.mode === 'A') drawBadgeStack(ctx, r.x + r.w / 2, r.y + r.h - 12, Math.min(150, r.w - 60));
}

function drawTracker(ctx, s, r, vertical) {
  const T = theme(), P = s.P;
  const n = 9, cols = vertical ? 1 : 9;
  if (vertical) {
    const rowH = Math.min(46, r.h / 9);
    for (let d = 1; d <= 9; d++) {
      const y = r.y + (d - 1) * rowH + rowH / 2, done = remaining(P, d) === 0, k = (9 - remaining(P, d)) / 9;
      txt(ctx, d, r.x + 18, y, { size: F(26), weight: 700, color: done ? T.good : T.text, align: 'center' });
      rr(ctx, r.x + 44, y - 7, r.w - 56, 14, 7); ctx.fillStyle = 'rgba(128,128,128,0.25)'; ctx.fill();
      if (k > 0) { rr(ctx, r.x + 44, y - 7, Math.max(14, (r.w - 56) * k), 14, 7); ctx.fillStyle = done ? T.good : T.accent; ctx.fill(); }
    }
    return;
  }
  const cw = r.w / 9;
  for (let d = 1; d <= 9; d++) {
    const x = r.x + (d - 0.5) * cw, done = remaining(P, d) === 0, k = (9 - remaining(P, d)) / 9;
    txt(ctx, d, x, r.y + r.h * 0.3, { size: F(34), weight: 700, color: done ? T.good : T.text, align: 'center' });
    rr(ctx, x - cw * 0.3, r.y + r.h * 0.62, cw * 0.6, 12, 6); ctx.fillStyle = 'rgba(128,128,128,0.25)'; ctx.fill();
    if (k > 0) { rr(ctx, x - cw * 0.3, r.y + r.h * 0.62, Math.max(12, cw * 0.6 * k), 12, 6); ctx.fillStyle = done ? T.good : T.accent; ctx.fill(); }
  }
}

const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
function drawControls(ctx, s, L) {
  const T = theme(), P = s.P;
  if (L.tracker && L.mode === 'portrait') drawTracker(ctx, s, L.tracker, false);
  // keypad
  const lowDown = s.notesMode;
  L.keys.forEach((k, i) => {
    const d = i + 1, rem = remaining(P, d), done = rem === 0, on = s.focus === d || (s.sel >= 0 && P.v[s.sel] === d);
    const fl = flashOf(s, 'k' + d);
    ctx.save(); if (done) ctx.globalAlpha = 0.4;
    const f = tile(ctx, k.x, k.y + fl * 3, k.w, T.tile, T.side, 0, {}, k.h);
    if (on) { rr(ctx, f.x - 1, f.y - 1, f.w + 2, f.h + 2, Math.min(k.w, k.h) * 0.19); ctx.lineWidth = 3.5; ctx.strokeStyle = T.sel; ctx.stroke(); }
    const sz = Math.min(k.w * 0.62, k.h * 0.58);
    txt(ctx, d, f.x + f.w / 2, f.y + f.h / 2 + 2, { size: sz, weight: 700, color: lowDown ? T.note : T.entry, align: 'center' });
    if (!done && k.w > 56) txt(ctx, rem, f.x + f.w - 8, f.y + 14, { size: F(Math.min(20, sz * 0.4)), weight: 500, color: T.note, align: 'right' });
    ctx.restore();
  });
  // tools
  const tl = L.tools, hasUndo = P.undo.length > 0, hasRedo = P.redo.length > 0;
  const defs = [['undo', 'Undo', 'undo', !hasUndo], ['redo', 'Redo', 'redo', !hasRedo], ['erase', 'Erase', 'erase', false], ['notes', 'Pencil', 'pencil', false], ['fill', 'Fill', 'fill', false], ['hint', 'Hint', 'bulb', false]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id], on = id === 'notes' && s.notesMode, hint = id === 'hint';
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    rr(ctx, r.x, r.y, r.w, r.h, 18);
    ctx.fillStyle = hint ? T.accent : on ? rgba(T.accent, 0.25) : T.btn; ctx.fill();
    const fl = flashOf(s, id); if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
    ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? T.accent : hint ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
    const col = hint ? T.onAccent : T.text, rowLayout = L.toolStyle === 'row';
    if (r.h >= 56 && !(rowLayout && r.w < 80)) {
      const isz = Math.min(r.h * 0.42, r.w * 0.5, 44);
      icons[icon](ctx, r.x + r.w / 2, r.y + r.h * 0.4, isz, col);
      txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.8, { size: F(19), weight: 500, color: col, align: 'center', maxW: r.w - 8, min: 11 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 36), col);
    if (id === 'notes' && on) { ctx.beginPath(); ctx.arc(r.x + r.w - 12, r.y + 12, 5, 0, 7); ctx.fillStyle = T.accent; ctx.fill(); }
    ctx.restore();
  }
}

function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40;
  let title = hnt.ex?.name ?? 'Hint', chip = hnt.stage === 'look' ? 'Where to look' : hnt.stage === 'explain' ? 'Why it works' : 'Check this tile';
  if (hnt.stage === 'mistake') title = 'Something is off';
  const ts = F(C.h > 420 ? 36 : 30);
  txt(ctx, title, x, C.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18 });
  txt(ctx, chip, x, C.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim });
  const bodyTop = C.y + 14 + ts * 2.1, bodyH = B.close.y - 10 - bodyTop;
  const text = hnt.text;
  let size = F(C.w > 500 ? 34 : 30);
  while (size > 15 && paraHeight(ctx, text, w, size, 500, 1.3) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.3 });
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : hnt.stage === 'mistake' ? 'Fix it' : 'Apply', { kind: 'accent', size: 28, flash: flashOf(s, 'go') });
}

function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, T0 = L.coachText;
  const ts = F(C.h > 420 ? 36 : 30), name = hnt?.ex?.name ?? (a.done ? 'Solved' : 'Thinking');
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18 });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it works' : a.done ? 'The puzzle is complete' : 'Finding the next step';
  txt(ctx, `Step ${a.n}  ·  ${phase}`, x, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, maxW: w * 0.6, min: 12 });
  const bodyTop = T0.y + 14 + ts * 2.1, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt?.text ?? (a.done ? 'Every tile is filled. Tap Exit to go back to the menu.' : 'The solver is looking for the simplest logical step.');
  let size = F(C.w > 500 ? 30 : 26);
  while (size > 15 && paraHeight(ctx, text, w, size, 500, 1.3) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.3 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 26, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 26, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 26, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 20, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, align: 'right' });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.board);
  ctx.fillStyle = rgba(T.tray, 0.72); rr(ctx, L.board.x, L.board.y, L.board.size, L.board.size, L.board.size * 0.04); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(20,28,56,0.96)' : 'rgba(255,253,247,0.97)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 700, color: T.text, align: 'center' });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart puzzle', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}

function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), portrait = L.mode === 'portrait';
  const bx = L.board, w = portrait ? Math.min(bx.size - 30, 560) : L.info.w - 24, cx2 = portrait ? bx.x + bx.size / 2 : L.info.x + L.info.w / 2;
  let size = F(portrait ? 24 : 26), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (portrait && lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22;
  const y = portrait ? L.hud.diff.y + Math.max(0, (80 - hh) / 2) : L.mode === 'A' ? L.info.y + L.info.h - hh - 130 : L.info.y + 64;
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(10,16,36,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  // hero: a box of tiles that lights up in a wave, and the wordmark; everything is sized to fit the hero rect
  const landscape = !!L.landscape, H = hero.h, tb = Math.min(170, Math.max(70, H * 0.3));
  const gs = Math.max(90, Math.min(hero.w * 0.62, (H - tb - 20) / 1.1, 520)), x0 = hero.x + (hero.w - gs) / 2, y0 = hero.y + Math.max(0, (H - gs * 1.1 - tb) / 2) + gs * 0.05;
  const vals = [5, 3, 4, 6, 7, 2, 1, 9, 8];
  rr(ctx, x0 - gs * 0.05, y0 - gs * 0.05, gs * 1.1, gs * 1.1, gs * 0.07); ctx.fillStyle = T.tray; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.rim; ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const cx = x0 + (i % 3) * (gs * 0.34), cy = y0 + Math.floor(i / 3) * (gs * 0.34);
    const ph = s.t * 1.4 - i * 0.28, wave = (ph % 6.28) > 0 && (ph % 6.28) < 1.57 ? Math.sin(((ph % 6.28) / 1.57) * Math.PI) : 0;
    const appear = clamp(s.sceneT * 3 - i * 0.12, 0, 1), sz = gs * 0.31 * smooth(appear);
    const f = tile(ctx, cx + (gs * 0.31 - sz) / 2, cy + (gs * 0.31 - sz) / 2, sz, mix(T.tile, T.same, 0.5 * wave), T.side, wave * 0.8);
    txt(ctx, vals[i], f.x + f.w / 2, f.y + f.h / 2 + 2, { size: sz * 0.66, weight: 700, color: T.given, align: 'center' });
  }
  const ty = y0 + gs * 1.1 + tb * 0.5;
  txt(ctx, 'SUDOKU', hero.x + hero.w / 2, ty, { size: tb * 0.56, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.94, min: 24 });
  txt(ctx, 'NINE BY NINE', hero.x + hero.w / 2, ty + tb * 0.4, { size: tb * 0.22, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13 });
  // buttons
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${GRADE_INFO[s.saved.level].name}${s.saved.kind === 'daily' ? ' · Daily' : ''}  ·  ${fmtTime(s.saved.t)}` : ''],
    new: ['New Game', 'Five grades, every puzzle checked'], daily: ['Daily Puzzle', s.dailyInfo],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules and Techniques', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(B)) {
    const prim = id === 'continue' || id === 'new' || id === 'daily', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'new' || (id === 'continue') ? 'accent' : 'solid', size: prim ? 34 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) { icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good); }
  }
  // brand credit, bottom centre under the menu
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ new game ===============================================================
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
      para(ctx, isDaily ? 'The same puzzle for everyone, new every day.' : gi.text, r.x + 24, r.y + 80, r.w - 48 - (r.w > 520 ? 150 : 0), { size: F(r.h < 135 ? 19 : 22), weight: 400, color: T.dim, lh: 1.15 });
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
        const fh = Math.min(textR.w, Math.max(300, textR.h * (sc > 1.6 ? 0.45 : 0.62)), 640) , fr = R(textR.x + (textR.w - Math.min(textR.w, fh + 20)) / 2, y, Math.min(textR.w, fh + 20), fh + 36);
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
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
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
  setBrandTone(theme().dark);
  const T = theme(), sc = scaleOf(s), O = overLayout(w, h, sc), R0 = s.result;
  if (!R0) return;
  // the finished board, glowing
  const b = O.board, cell = b.s;
  rr(ctx, b.x, b.y, b.size, b.size, b.size * 0.05); ctx.fillStyle = T.tray; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = T.rim; ctx.stroke();
  for (let i = 0; i < 81; i++) {
    const r = b.cells[i], ph = s.t * 1.6 - (rowOf(i) + colOf(i)) * 0.16, wave = ph > 0 && (ph % 7) < 1.2 ? Math.sin(((ph % 7) / 1.2) * Math.PI) : 0;
    const f = tile(ctx, r.x, r.y, cell, mix(T.tile, '#ffd45a', 0.25 + 0.5 * wave), T.side, wave * 0.7, { shadow: cell > 14 });
    if (cell > 20) txt(ctx, s.P.v[i], f.x + f.w / 2, f.y + f.h / 2 + 1, { size: cell * 0.62, weight: s.P.givens[i] ? 700 : 600, color: s.P.givens[i] ? T.given : T.entry, align: 'center' });
  }
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 40 : 54;
    txt(ctx, R0.daily ? 'Daily Puzzle solved' : 'Solved', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * Math.min(sc, 1.5), weight: 700, color: T.text, align: 'center', maxW: body.w, min: 22 }); y += (tsz + 12) * Math.min(sc, 1.5);
    const sz = compact ? 36 : 52;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = [['Time', fmtTime(R0.time)], ['Par', fmtTime(R0.par)], ['Mistakes', R0.errs], ['Hints', R0.hints]];
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
    txt(ctx, 'This puzzle needed', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 38 * sc;
    for (const t of R0.techs) y += para(ctx, `${t.name}  ×${t.n}`, body.x + 8, y, body.w - 16, { size: F(25) * sc, weight: 500, color: T.text }) + 4;
    return y - body.y + 10;
  });
  button(ctx, O.btns.next, R0.daily ? 'Back to menu' : 'Next puzzle', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.daily ? 'New game' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has all five grades, the Daily Puzzle, hints that teach and Watch and Learn. Get Sudoku Nine by Nine on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
function drawLoading(ctx, s, w, h) {
  const T = theme();
  txt(ctx, 'Setting out the tiles…', w / 2, h / 2, { size: F(34), weight: 600, color: T.text, align: 'center' });
}
export { smooth };
