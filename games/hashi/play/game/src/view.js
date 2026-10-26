// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, pageLayout, centerCard, frame, boardGeo, TEXT_SCALES, host, inRect, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, paraHeight, wrap, setFont, F, mix, rgba, icons, UI, scrim, topVeil, lacquer, plaque, emboss } from './ui.js';
import { v3 } from './v3.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, brandGradient, drawBadgeStack } from './brand.js';
import { puzzleOf, fmtTime, islandsDone, bridgesPlaced, bridgesTotal, PAR_SECONDS } from './play.js';
import { maxAddAt, edgeBetween, TECH_NAME, build, newState } from './hashi.js';
import { drawArchipelago, drawSea, drawBridge, drawIsland } from './art.js';
import { DOCS, GRADE_INFO } from './content.js';
import { drawFigure } from './figures.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
const SETTINGS_ALL = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'hand', label: 'Tool side', opts: ['Right', 'Left'] },
  { id: 'check', label: 'Check work', opts: ['Off', 'Conflicts', 'Check'] },
  { id: 'numbers', label: 'Island numbers', opts: ['Target', 'Remaining'] },
  { id: 'timer', label: 'Show timer', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
// The Purchases row is hidden in the public web demo (nothing can be bought there).
export const settingsRows = (s) => (s.demo ? SETTINGS_ALL.filter((r) => r.id !== 'restore') : SETTINGS_ALL);
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'hand': return p.hand === 'left' ? 1 : 0;
    case 'check': return ['off', 'conflicts', 'check'].indexOf(p.check);
    case 'numbers': return p.numbers === 'remaining' ? 1 : 0;
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
  if (v3.on && sc !== 'play' && sc !== 'title' && sc !== 'over') {
    // text screens: the 3D garden keeps drifting behind a dark veil; the camera frames the pond in the upper part
    if (v3.fit) v3.fit(null, 'ambient', { calm: s.prefs.calm, rect: { x: w * 0.05, y: h * 0.02, w: w * 0.9, h: h * 0.5 } });
    scrim(ctx, w, h);
  }
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
// Everything the hint card wants highlighted, as the maps the archipelago renderer takes.
function hintMarks(s) {
  const h = s.hint;
  if (!h) return null;
  const P = puzzleOf(s.P), m = { focus: new Set(), lanes: new Map(), ghost: new Map() };
  if (h.stage === 'mistake') { m.lanes.set(h.edge, 'look'); m.focus.add(P.ea[h.edge]); m.focus.add(P.eb[h.edge]); return m; }
  if (!h.ex) return null;
  const sh = h.ex.show;
  for (const i of sh.focus) m.focus.add(i);
  if (h.stage === 'look') { for (const l of sh.lanes) m.lanes.set(l.e, 'look'); return m; }
  for (const l of sh.lanes) {
    if (l.kind === 'place') m.ghost.set(l.e, h.step.place.find((p) => p.e === l.e)?.to ?? 1);
    else m.lanes.set(l.e, l.kind);
  }
  return m;
}

function drawBoard(ctx, s, L) {
  const T = theme(), P = puzzleOf(s.P), g = L.board, marks = hintMarks(s);
  const pr = s.prefs, w3 = v3.on;
  if (w3 && v3.fit) {
    const below = L.mode === 'portrait' ? Math.min(L.prog ? L.prog.y : 1e9, L.tools.undo.y, L.coachR ? L.coachR.y : 1e9) - 14 : 0;
    const rect = L.mode === 'portrait' ? { x: g.x, y: g.y, w: g.size, h: Math.max(g.size, Math.min(g.size * 1.3, below - g.y)) } : g.rect;
    v3.fit(g, 'play', { calm: pr.calm, rect });
  }
  if (s.paused) {
    if (w3) { v3.frame = null; ctx.fillStyle = rgba(T.tray, 0.55); rr(ctx, g.x, g.y, g.size, g.size, g.size * 0.04); ctx.fill(); return; }
    drawSea(ctx, g.rect, s.t, pr.calm, g.size * 0.04);
    ctx.fillStyle = rgba(T.tray, 0.55); rr(ctx, g.x, g.y, g.size, g.size, g.size * 0.04); ctx.fill();
    return;
  }
  const targets = new Set();
  if (s.sel >= 0 && !s.auto.on) for (const e of P.inc[s.sel]) if (maxAddAt(P, s.P, e) > 0 || s.P.br[e] > 0) targets.add(e);
  const ghost = marks ? marks.ghost : null;
  const focus = marks ? marks.focus : null;
  const o = {
    t: s.t, calm: pr.calm, numbers: pr.numbers, check: pr.check, sol: s.P.sol, sel: s.sel, targets: targets.size ? targets : null,
    focus, lanes: marks ? marks.lanes : null, ghost: ghost && ghost.size ? ghost : null, fx: s.fx, world: w3,
  };
  if (w3) v3.frame = { P, st: s.P, o };
  drawArchipelago(ctx, g, P, s.P, o);
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// ================================================================ play screen ============================================================
function drawPlay(ctx, s, w, h) {
  const P = puzzleOf(s.P), coach = !!(s.hint || s.auto.on);
  const L = playLayout(w, h, { coach, hand: s.prefs.hand, pw: P.w, ph: P.h });
  drawBoard(ctx, s, L);
  if (L.mode === 'portrait') topVeil(ctx, w, L.board.y + 4);
  drawInfo(ctx, s, L);
  if (s.paused) { ctx.save(); ctx.globalAlpha = 0.3; drawControls(ctx, s, L); ctx.restore(); drawPaused(ctx, s, L); }
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else drawControls(ctx, s, L);
  drawMsg(ctx, s, L);
}

function drawInfo(ctx, s, L) {
  const T = theme(), S = s.P, pr = s.prefs, hud = L.hud, gi = GRADE_INFO[S.level], P = puzzleOf(S);
  const title = s.auto.on ? 'Watch and Learn' : gi.name, sub = S.kind === 'daily' ? 'Daily Puzzle' : s.auto.on ? `${gi.name} puzzle` : `${islandsDone(S)} of ${P.n} islands done`;
  const time = fmtTime(S.t);
  if (L.mode === 'portrait') {
    // the left block ends before the timer plaque (it never runs under the timer); the subtitle shortens to fit
    const tL = hud.timer.x + 6 - 62, availW = Math.max(60, tL - 8 - hud.diff.x - 6);
    const fit = (cands, size) => { ctx.save(); setFont(ctx, size, 400); const ok = cands.find((c) => ctx.measureText(c).width <= availW) || cands[cands.length - 1]; ctx.restore(); return ok; };
    const sub2 = S.kind === 'daily' || s.auto.on ? sub : fit([sub, `${islandsDone(S)} of ${P.n} islands`, `${islandsDone(S)} / ${P.n}`], F(22));
    if (v3.on) {
      plaque(ctx, R(hud.diff.x - 10, hud.diff.y - 2, availW + 16, 76), { radius: 18 });
      if (pr.timer) plaque(ctx, R(tL, hud.timer.y - 36, 124, 70), { radius: 20 });
    }
    txt(ctx, title, hud.diff.x, hud.diff.y + 24, { size: F(36), weight: 700, color: T.text, maxW: availW, min: 18 });
    txt(ctx, sub2, hud.diff.x, hud.diff.y + 56, { size: F(22), weight: 400, color: T.dim, maxW: availW, min: 12 });
    if (pr.timer) txt(ctx, time, hud.timer.x + 6, hud.timer.y, { size: F(40), weight: 600, color: T.text, align: 'center' });
    if (pr.check === 'check' && !s.auto.on) txt(ctx, `Mistakes ${S.errs}`, hud.mist.x, hud.mist.y + 2, { size: F(22), weight: 500, color: S.errs ? T.err : T.dim, align: 'right', maxW: 160, min: 12 });
    button(ctx, L.pause, '', { icon: s.paused ? 'play' : 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
    return;
  }
  const r = L.info;
  panel(ctx, r, { radius: 26 });
  edgeStroke(ctx, r, 26, 0.35);
  txt(ctx, title, r.x + 20, L.infoTop + 24, { size: F(38), weight: 700, color: T.text, maxW: r.w - 120, min: 18 });
  txt(ctx, sub, r.x + 20, L.infoTop + 62, { size: F(22), weight: 400, color: T.dim, maxW: r.w - 120, min: 12 });
  button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
  if (pr.timer) txt(ctx, time, hud.timer.x, hud.timer.y, { size: F(60), weight: 600, color: T.text, align: 'center', maxW: r.w - 40 });
  else txt(ctx, 'Timer hidden', hud.timer.x, hud.timer.y, { size: F(26), weight: 400, color: T.dim, align: 'center' });
  if (pr.check === 'check' && !s.auto.on) txt(ctx, `Mistakes  ${S.errs}`, r.x + r.w / 2, hud.timer.y + 44, { size: F(24), weight: 500, color: S.errs ? T.err : T.dim, align: 'center' });
}

// A progress card: islands complete and bridges built.
function drawProgress(ctx, s, r) {
  const T = theme(), S = s.P, P = puzzleOf(S), done = islandsDone(S), tot = P.n, k = tot ? done / tot : 0;
  panel(ctx, r, { radius: 22 });
  const pad = 20, sm = r.h < 96;
  const y1 = r.y + (sm ? r.h * 0.36 : 34);
  txt(ctx, 'Islands', r.x + pad, y1, { size: F(sm ? 22 : 26), weight: 600, color: T.text });
  txt(ctx, `${done} / ${tot}`, r.x + r.w - pad, y1, { size: F(sm ? 26 : 32), weight: 700, color: done === tot ? T.good : T.text, align: 'right' });
  const by = r.y + r.h - (sm ? 18 : 26) - 8;
  rr(ctx, r.x + pad, by, r.w - 2 * pad, 14, 7); ctx.fillStyle = 'rgba(128,128,128,0.25)'; ctx.fill();
  if (k > 0) { rr(ctx, r.x + pad, by, Math.max(14, (r.w - 2 * pad) * k), 14, 7); ctx.fillStyle = k === 1 ? T.good : T.accent; ctx.fill(); }
  if (!sm && r.h > 110) txt(ctx, `Bridges built ${bridgesPlaced(S)} of ${bridgesTotal(S)}`, r.x + pad, r.y + 66, { size: F(22), weight: 400, color: T.dim, maxW: r.w - 2 * pad, min: 12 });
}

const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
function drawControls(ctx, s, L) {
  const T = theme(), S = s.P;
  if (L.prog) drawProgress(ctx, s, L.prog);
  const tl = L.tools, hasUndo = S.undo.length > 0, hasRedo = S.redo.length > 0, hasSel = s.sel >= 0;
  const defs = [['undo', 'Undo', 'undo', !hasUndo], ['redo', 'Redo', 'redo', !hasRedo], ['clear', 'Clear', 'erase', false], ['hint', 'Hint', 'bulb', false]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id], hint = id === 'hint';
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    const fl = flashOf(s, id);
    if (v3.on) lacquer(ctx, r, { radius: 18, kind: hint ? 'accent' : 'solid', down: Math.min(1, fl * 1.6) });
    else {
      rr(ctx, r.x, r.y, r.w, r.h, 18);
      ctx.fillStyle = hint ? T.accent : T.btn; ctx.fill();
      if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
      ctx.lineWidth = 1.5; ctx.strokeStyle = hint ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
    }
    const col = hint ? T.onAccent : T.text;
    if (r.h >= 56) {
      const isz = Math.min(r.h * 0.42, r.w * 0.5, 44);
      icons[icon](ctx, r.x + r.w / 2, r.y + r.h * 0.4, isz, col);
      txt(ctx, id === 'clear' && hasSel ? 'Clear island' : label, r.x + r.w / 2, r.y + r.h * 0.8, { size: F(19), weight: 500, color: col, align: 'center', maxW: r.w - 8, min: 11 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 36), col);
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
const TITLE_PUZ = '5x5:3...3/...../3.3.3/...../....1';
const TITLE_ORDER = [[0, 0, 4, 0, 2], [0, 0, 0, 2, 1], [4, 0, 4, 2, 1], [0, 2, 2, 2, 2], [2, 2, 4, 2, 1], [4, 2, 4, 4, 1]];
let titleP = null, titleSt = null;
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const P = titleP ?? (titleP = build(TITLE_PUZ)), st = titleSt ?? (titleSt = newState(P));
  const cycleT = (s.t * 0.9) % (TITLE_ORDER.length + 3);
  st.br.fill(0);
  TITLE_ORDER.forEach(([ax, ay, bx, by, n], k) => {
    const e = edgeBetween(P, P.at[ay * P.w + ax], P.at[by * P.w + bx]);
    if (e >= 0 && cycleT > k) st.br[e] = cycleT > k + 0.5 ? n : 1;
  });
  if (v3.on && v3.fit) {
    // 3D hero: embossed lettering over the garden, the pond below it builds itself
    const lt = Math.min(250, Math.max(110, hero.h * 0.3)), ph = hero.h - lt - 6, gs = Math.max(120, Math.min(hero.w * 0.94, ph));
    const g = boardGeo(hero.x + (hero.w - gs) / 2, hero.y + lt + Math.max(0, (ph - gs) / 2), gs, P.w, P.h);
    v3.fit(g, 'title', { calm: s.prefs.calm, rect: { x: hero.x, y: hero.y + lt * 0.55, w: hero.w, h: hero.h - lt * 0.55 } });
    const o = { t: s.t, calm: s.prefs.calm, check: 'off', numbers: 'target', fx: { wave: s.fx.wave }, world: true };
    v3.frame = { P, st, o };
    drawArchipelago(ctx, g, P, st, o);
    const cx = hero.x + hero.w / 2, ty = hero.y + lt * 0.4;
    emboss(ctx, 'HASHI', cx, ty, lt * 0.62, { t: s.t, maxW: hero.w * 0.92 });
    // ribbon: BRIDGES on a lacquered strip with brass ends
    const rw = Math.min(hero.w * 0.62, lt * 2.0), rh = lt * 0.2, ry = ty + lt * 0.42;
    const rp = { x: cx - rw / 2, y: ry - rh / 2, w: rw, h: rh };
    lacquer(ctx, rp, { radius: rh * 0.5, kind: 'accent' });
    txt(ctx, 'B R I D G E S', cx, ry + 2, { size: rh * 0.56, weight: 700, color: T.onAccent, align: 'center', maxW: rw - 20, min: 12 });
  } else {
    // hero: a tiny archipelago that builds itself, then the wordmark
    const H = hero.h, tb = Math.min(170, Math.max(70, H * 0.3));
    const gs = Math.max(100, Math.min(hero.w * 0.7, (H - tb - 10) , 560)), x0 = hero.x + (hero.w - gs) / 2, y0 = hero.y + Math.max(0, (H - gs - tb) / 2);
    const g = boardGeo(x0, y0, gs, P.w, P.h);
    drawArchipelago(ctx, g, P, st, { t: s.t, calm: s.prefs.calm, check: 'off', numbers: 'target' });
    const ty = y0 + gs + tb * 0.5;
    txt(ctx, 'HASHI', hero.x + hero.w / 2, ty, { size: tb * 0.6, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.94, min: 24 });
    txt(ctx, 'BRIDGES', hero.x + hero.w / 2, ty + tb * 0.42, { size: tb * 0.22, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13 });
  }
  // buttons
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${GRADE_INFO[s.saved.level].name}${s.saved.kind === 'daily' ? ' · Daily' : ''}  ·  ${fmtTime(s.saved.t)}` : ''],
    new: ['New Game', 'Five grades, every puzzle checked'], daily: ['Daily Puzzle', s.dailyInfo],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules and Techniques', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star', howto: 'bulb', rules: 'pencil', about: 'fill' };
  for (const id of Object.keys(B)) {
    const prim = id === 'continue' || id === 'new' || id === 'daily', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'new' || (id === 'continue') ? 'accent' : 'solid', size: prim ? 34 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) { icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good); }
  }
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
  const rows = settingsRows(s), T = theme(), sc = scaleOf(s), SL = settingsLayout(w, h, sc, rows.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    rows.forEach((row, i) => {
      const g = SL.rows[i], isRestore = row.id === 'restore', owned = isRestore && !!s.owned;
      panel(ctx, g.rect, { radius: 20 });
      const lx = g.rect.x + 22, lw = g.rect.w - g.ctrl.w - 50;
      if (isRestore) {
        const status = owned ? 'Full game unlocked' : (s.restore.msg || 'Already bought it?');
        txt(ctx, row.label, lx, g.rect.y + g.rect.h * 0.34, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: lw, min: 14 });
        txt(ctx, status, lx, g.rect.y + g.rect.h * 0.68, { size: F(20) * Math.min(sc, 1.4), weight: 400, color: owned ? T.good : T.dim, maxW: lw, min: 11 });
      } else txt(ctx, row.label, lx, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: lw, min: 14 });
      const opts = isRestore ? [owned ? 'Unlocked' : s.restore.busy ? 'Checking...' : 'Restore purchase'] : row.opts;
      const n = opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: isRestore && !owned ? 'accent' : 'solid', disabled: isRestore && (owned || s.restore.busy), flash: flashOf(s, 'set' + i + '.' + k) }));
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
  const T = theme(), sc = scaleOf(s), R0 = s.result;
  if (!R0) return;
  const P = puzzleOf(s.P), O = overLayout(w, h, sc, P.w, P.h);
  const oo = { t: s.t, calm: s.prefs.calm, check: 'off', numbers: 'target', fx: { wave: s.fx.wave }, world: v3.on };
  if (v3.on && v3.fit) { v3.fit(O.board, 'over', { calm: s.prefs.calm }); v3.frame = { P, st: s.P, o: oo }; }
  drawArchipelago(ctx, O.board, P, s.P, oo);
  const body = O.body;
  if (v3.on) plaque(ctx, R(body.x - 10, body.y - 8, body.w + 20, body.h + 16), { radius: 24 });
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
  txt(ctx, 'That was the demo end', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has all five grades, the Daily Puzzle, hints that teach and Watch and Learn. Get Hashi Bridges on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
function drawLoading(ctx, s, w, h) {
  const T = theme();
  txt(ctx, 'Charting the islands…', w / 2, h / 2, { size: F(34), weight: 600, color: T.text, align: 'center' });
}
export { smooth };
