// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, tierRects, lotsRects, overLayout, pauseLayout, centerCard, ladderGeo, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, emboss, rr, txt, para, paraHeight, wrap, F, mix, rgba, icons, UI, NUM, CJK } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { routes, route, finals, flatten, TIERS, LOT_SETS, ROUNDS, idx, emptyCells } from './engine.js';
import { DOCS, CHAPTERS, FACTS, TIER_TEXT } from './content.js';
import { ladder, lantern, bowl, slip, hangerBar, paperFold, waypoints, pathLength, samplePath, trail, figure } from './art.js';
import { LAMP } from './ui.js';
import { v3 } from './v3.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'numerals', label: 'Numbers', opts: ['Digits', 'Kanji'] },
  { id: 'guide', label: 'Paths', opts: ['Tap a lantern', 'Show all'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
// The Purchases row is hidden in the web demo (nothing to restore there).
export const settingsRows = (s) => (s.demo ? SETTINGS.filter((r) => r.id !== 'restore') : SETTINGS);
const restoreLabel = (s) => (s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase');
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'numerals': return p.numerals === 'kanji' ? 1 : 0;
    case 'guide': return p.guide ? 1 : 0;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    case 'restore': return s.owned ? 0 : -1;
    default: return -1;
  }
};
const KANJI = ['一', '二', '三', '四', '五', '六', '七', '八'];
// Kanji numerals need a CJK font on the device. main.js probes once and calls setKanjiOk(false) when the font is missing, so digits are
// shown instead of boxes. Default (and tests): allowed.
let kanjiOk = true;
export const setKanjiOk = (v) => { kanjiOk = !!v; };
const lbl = (s, i) => {
  if (s.prefs.numerals !== 'kanji') return String(i + 1);
  return kanjiOk ? KANJI[i] : String(i + 1);
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  v3.reset(); v3.w = w; v3.h = h; v3.t = s.t; v3.calm = !!s.prefs.calm; v3.scene = s.scene;
  background(ctx, w, h, s.prefs.calm ? 0 : s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (v3.on && sc !== 'play' && sc !== 'title' && sc !== 'follow' && sc !== 'lots' && sc !== 'over') { ctx.fillStyle = T.dark ? 'rgba(6,8,22,0.62)' : 'rgba(250,244,228,0.72)'; ctx.fillRect(0, 0, w, h); }
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'follow') drawFollow(ctx, s, w, h);
  else if (sc === 'lots') drawLots(ctx, s, w, h);
  else if (sc === 'journey') drawJourney(ctx, s, w, h);
  else if (sc === 'tiers') drawTiers(ctx, s, w, h);
  else if (sc === 'lotsetup') drawLotSetup(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play' && !v3.on) { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ the ladder scene ========================================================
// Where each lantern is drawn this frame: hanging, travelling (run), or sitting in a bowl.
function lanternPose(s, geo, i, landedBowl) {
  const run = s.run;
  if (run && run.who.includes(i)) {
    const k = run.who.indexOf(i), pts = waypoints(geo, run.routes[i]), len = pathLength(pts);
    const sP = clamp((run.t - k * run.stagger) / run.unit, 0, len), p = samplePath(pts, sP);
    return { x: p.x, y: p.y, moving: sP > 0 && sP < len, done: sP >= len, pts, s: sP, len };
  }
  if (landedBowl !== null && landedBowl !== undefined) return { x: geo.xs[landedBowl], y: geo.bowlY - geo.tr * 0.85, landed: true };
  return { x: geo.xs[i], y: geo.tokenY, hanging: true };
}

function drawSparks(ctx, s) {
  for (const sp of s.sparks) {
    ctx.globalAlpha = clamp(1 - sp.t / sp.life, 0, 1); ctx.fillStyle = sp.c;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// o: { cells, labelOf(i) for lantern, bowlTok(b) = the lantern that bowl b wants (or -1), lanternState(i, pose), landedOf(i) -> bowl|null,
//      trails: [{ tok, pts?, route, alpha }], slots, hl, cursor, shake, pop }
function drawLadderScene(ctx, s, geo, o) {
  const T = theme(), n = geo.n, calm = s.prefs.calm;
  hangerBar(ctx, geo);
  ladder(ctx, geo, o.cells, { slots: o.slots, hl: s.hl && o.slots ? s.hl : null, cursor: o.cursor, popped: s.fx.pop });
  // shake feedback for refused slots
  for (const k of Object.keys(s.fx.shake)) {
    const i = Number(k), g = i % (n - 1), r = Math.floor(i / (n - 1));
    if (r >= geo.rows) continue;
    const a = 1 - s.fx.shake[k] / 0.5, x = (geo.xs[g] + geo.xs[g + 1]) / 2, y = geo.ys[r];
    ctx.strokeStyle = rgba(T.err, clamp(a, 0, 1)); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, geo.sp * 0.38, Math.max(10, geo.rowGap * 0.4), 0, 0, 7); ctx.stroke();
  }
  // trails
  for (const tr of o.trails ?? []) {
    const pts = waypoints(geo, tr.route), len = pathLength(pts);
    trail(ctx, pts, tr.upTo ?? len, LAMP[tr.color % LAMP.length][1], Math.max(3, geo.tr * 0.18), tr.alpha ?? 0.8);
  }
  // bowls
  for (let b = 0; b < n; b++) {
    const tok = o.bowlTok(b);
    const st = o.bowlState ? o.bowlState(b) : 'idle';
    bowl(ctx, geo.xs[b], geo.bowlY, geo.tr * 0.95, tok >= 0 ? tok : 6, { label: o.bowlLabel ? o.bowlLabel(b) : '', state: st, pulse: o.bowlPulse ? o.bowlPulse(b) : 0 });
  }
  if (o.afterBowls) o.afterBowls(ctx, geo);
  // lanterns (travelling ones last, on top)
  const poses = [];
  for (let i = 0; i < n; i++) poses.push(lanternPose(s, geo, i, o.landedOf ? o.landedOf(i) : null));
  const order = [...Array(n).keys()].sort((a, b) => (poses[a].moving ? 1 : 0) - (poses[b].moving ? 1 : 0));
  for (const i of order) {
    const p = poses[i], st = o.lanternState(i, p);
    if (st === 'hidden') continue;
    const sway = calm || !p.hanging ? 0 : Math.sin(s.t * 1.5 + i * 1.3) * 0.045;
    lantern(ctx, p.x, p.y, geo.tr * (p.landed ? 0.78 : 1), o.colorOf ? o.colorOf(i) : i, { label: o.labelOf(i), state: st, glow: p.moving ? 1 : 0, sway });
  }
  drawSparks(ctx, s);
}

// ================================================================ build ===================================================================
function drawPlay(ctx, s, w, h) {
  const B = s.B, P = B.P;
  const L = playLayout(w, h, { coach: !!(s.hint || s.auto.on), buttons: s.auto.on ? [] : ['release', 'undo', 'hint', 'clear'] });
  const geo = ladderGeo(L.area, P.n, P.rows), T = theme();
  const cells = flatten(P, B.player);
  const landed = B.bad.length === P.n;
  const showAll = s.prefs.guide && !s.run && !B.done;
  const fin = finals(P.n, P.rows, landed && B.runCells ? B.runCells : cells);
  const rts = routes(P.n, P.rows, cells);
  const trails = [];
  if (s.run) s.run.who.forEach((tok, k) => { const pts = waypoints(geo, s.run.routes[tok]); trails.push({ route: s.run.routes[tok], color: tok, upTo: clamp((s.run.t - k * s.run.stagger) / s.run.unit, 0, pathLength(pts)), alpha: 0.7 }); });
  else if (landed) rts.forEach((rt, i) => trails.push({ route: routes(P.n, P.rows, B.runCells ?? cells)[i], color: i, alpha: 0.4 }));
  else for (let i = 0; i < P.n; i++) if (showAll || B.trace.includes(i)) trails.push({ route: rts[i], color: i, alpha: 0.85 });
  drawLadderScene(ctx, s, geo, {
    cells, slots: !s.run && !B.done && !s.paused, cursor: s.kbd && !s.auto.on && !s.run && !B.done ? s.cursor : null,
    labelOf: (i) => lbl(s, i),
    bowlTok: (b) => P.target.indexOf(b),
    bowlLabel: (b) => lbl(s, P.target.indexOf(b)),
    bowlState: (b) => (landed && !B.bad[P.target.indexOf(b)] ? 'home' : 'idle'),
    landedOf: (i) => (landed && !s.run ? fin[i] : null),
    lanternState: (i, p) => (landed && !s.run ? (B.bad[i] ? 'wrong' : 'home') : B.trace.includes(i) && !s.run ? 'lit' : 'idle'),
    trails,
  });
  drawHud(ctx, s, L, playTitle(s), playSub(s));
  if (s.paused) drawPaused(ctx, s, L);
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else drawBuildControls(ctx, s, L);
  drawMsg(ctx, s, L);
  void T;
}
const playTitle = (s) => {
  const B = s.B;
  if (s.auto.on) return 'Watch and Learn';
  if (B.kind === 'daily') return 'Daily Ladder';
  const [ci, i] = B.ref.split(':').map(Number);
  return `${CHAPTERS[ci]?.name ?? 'Ladder'}  ·  ${(i ?? 0) + 1}`;
};
const playSub = (s) => {
  const B = s.B, P = B.P;
  return `Rungs ${B.player.length} of ${P.budget}  ·  Home ${B.homeFlag === null ? '–' : B.homeFlag} of ${P.n}`;
};
function drawHud(ctx, s, L, title, sub) {
  const T = theme(), t = L.hud.title;
  if (v3.on) { ctx.save(); rr(ctx, t.x - 10, t.y + 2, Math.min(t.w + 28, 560), 84, 18); ctx.fillStyle = T.dark ? 'rgba(8,10,28,0.62)' : 'rgba(255,248,230,0.7)'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fill(); ctx.restore(); }
  txt(ctx, title, t.x, t.y + 28, { size: F(36), weight: 400, color: T.text, maxW: t.w, min: 18, fam: NUM });
  txt(ctx, sub, t.x, t.y + 64, { size: F(24), weight: 500, color: T.dim, maxW: t.w + 40, min: 12 });
  const pr = L.pause, hidden = s.auto.on;
  if (!hidden) button(ctx, pr, '', { icon: 'pause', size: 28, flash: flashOf(s, 'pause'), radius: 18 });
}
function drawBuildControls(ctx, s, L) {
  const T = theme(), B = s.B, tl = L.tools;
  if (!tl) return;
  const defs = [['release', 'Release', 'down', false], ['undo', 'Undo', 'undo', !B.undo.length], ['hint', 'Hint', 'bulb', false], ['clear', 'Clear', 'erase', !B.player.length]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id];
    if (!r) continue;
    const full = r.h >= 56 && r.w > 96;
    button(ctx, r, full ? label : '', { kind: id === 'release' ? 'accent' : 'solid', active: id === 'hint', disabled: dis, icon, size: 26, flash: flashOf(s, id), radius: 18 });
  }
}

function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40;
  const title = hnt.h.name, chip = hnt.stage === 'look' ? 'Where to look' : hnt.stage === 'explain' ? 'Why it works' : 'Check this rung';
  const ts = F(C.h > 300 ? 34 : 28);
  txt(ctx, title, x, C.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18 });
  txt(ctx, chip, x, C.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim });
  const bodyTop = C.y + 14 + ts * 2.1, bodyH = B.close.y - 10 - bodyTop;
  const text = hnt.stage === 'mistake' ? hnt.h.why : hnt.text;
  let size = F(C.w > 500 ? 28 : 26);
  while (size > 14 && paraHeight(ctx, text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : hnt.stage === 'mistake' ? 'Take it back' : 'Place it', { kind: 'accent', size: 28, flash: flashOf(s, 'go') });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, T0 = L.coachText;
  const ts = F(C.h > 300 ? 34 : 28), name = hnt?.h?.name ?? (a.done ? 'Solved' : a.phase === 'release' ? 'Release' : 'Thinking');
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18 });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it works' : a.done ? 'The ladder is complete' : a.phase === 'release' ? 'Sending the lanterns down' : 'Finding the next rung';
  txt(ctx, `Step ${a.n}  ·  ${phase}`, x, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, maxW: w * 0.6, min: 12 });
  const bodyTop = T0.y + 14 + ts * 2.1, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt?.text ?? (a.done ? 'Every lantern is home. Tap Exit to go back to the menu.' : 'Looking for the next rung.');
  let size = F(C.w > 500 ? 26 : 24);
  while (size > 14 && paraHeight(ctx, text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 26, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 26, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 26, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 20, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, align: 'right' });
}
function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.area);
  ctx.fillStyle = rgba(T.bg1, 0.86); rr(ctx, L.area.x, L.area.y, L.area.w, L.area.h, 30); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(14,16,40,0.97)' : 'rgba(255,250,236,0.98)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 40, { size: F(40), weight: 400, color: T.text, align: 'center', fam: NUM });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, s.scene === 'play' ? 'Restart ladder' : 'Start over', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, s.scene === 'play' ? 'Save and menu' : 'Menu', { size: 28, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m || s.paused) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), portrait = L.mode === 'portrait';
  const bx = L.area, w = portrait ? Math.min(bx.w - 30, 560) : L.info.w - 24, cx2 = portrait ? bx.x + bx.w / 2 : L.info.x + L.info.w / 2;
  let size = F(portrait ? 24 : 26), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (portrait && lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22;
  // landscape: sits in the panel just above the tool buttons (never over Release / Undo / Hint / Clear)
  let y;
  if (portrait) y = L.area.y + L.area.h * 0.58;
  else {
    const toolTop = L.tools ? Math.min(...Object.values(L.tools).map((r) => r.y)) : L.info.y + L.info.h - 10;
    y = Math.max(L.info.y + 4, toolTop - hh - 14);
  }
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(8,10,30,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}
function drawPrompt(ctx, s, L, text, sub = '') {
  const T = theme(), r = L.promptR;
  if (!r) return;
  panel(ctx, r, { radius: 20, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  const x = r.x + 18, w = r.w - 36;
  let size = F(r.h > 120 ? 30 : 26);
  const room = r.h - 20 - (sub ? 8 : 0);
  while (size > 13 && paraHeight(ctx, text, w, size, 600, 1.22) > room) size -= 1;
  const th = paraHeight(ctx, text, w, size, 600, 1.22), y0 = r.y + Math.max(8, (r.h - th) / 2);
  para(ctx, text, x, y0, w, { size, weight: 600, color: T.text, lh: 1.22 });
}

// ================================================================ follow the line ========================================================
function drawFollow(ctx, s, w, h) {
  const Fs = s.F, c = Fs.cur, T = theme();
  const L = playLayout(w, h, { coach: false, buttons: [], band: 84 });
  const geo = ladderGeo(L.area, c.n, c.rows);
  const trails = [];
  const askPhase = Fs.phase === 'ask';
  if (s.run) { const k = 0, pts = waypoints(geo, s.run.routes[c.start]); trails.push({ route: s.run.routes[c.start], color: c.start, upTo: clamp((s.run.t - k * s.run.stagger) / s.run.unit, 0, pathLength(pts)), alpha: 0.85 }); }
  else if (Fs.phase === 'result') trails.push({ route: route(c.n, c.rows, c.cells, c.start), color: c.start, alpha: 0.7 });
  drawLadderScene(ctx, s, geo, {
    cells: c.cells, slots: false,
    labelOf: (i) => (i === c.start ? lbl(s, i) : ''),
    colorOf: (i) => (i === c.start ? i : 6),
    bowlTok: () => -1,
    bowlLabel: (b) => lbl(s, b),
    bowlState: (b) => (Fs.phase === 'result' ? (b === c.end ? 'home' : b === Fs.ans ? 'wrong' : 'idle') : 'idle'),
    landedOf: (i) => (!s.run && Fs.phase === 'result' && i === c.start ? c.end : null),
    lanternState: (i, p) => (i === c.start ? (p.landed ? (Fs.ok ? 'home' : 'wrong') : 'lit') : 'dim'),
    trails,
  });
  void askPhase; void T;
  drawHud(ctx, s, L, `Follow the Line  ·  ${TIERS[Fs.tier].name}`, `Round ${Math.min(Fs.round + 1, ROUNDS)} of ${ROUNDS}  ·  Score ${Fs.score}`);
  const txtMain = Fs.phase === 'ask' ? 'Follow the lit lantern with your eyes, then tap the bowl where it will land.'
    : Fs.phase === 'run' ? 'Watching the real path...'
      : Fs.ok ? `Right! +${Fs.gain} points` : Fs.ans === -2 ? 'Time is up. Here is the path.' : 'Not this time. Here is the path.';
  drawPrompt(ctx, s, L, txtMain);
  // time bar
  const bar = L.mode === 'portrait' ? R(L.ctl.x, L.ctl.y + L.ctl.h - 40, L.ctl.w, 22) : R(L.info.x + 14, L.info.y + L.info.h - 44, L.info.w - 28, 22);
  rr(ctx, bar.x, bar.y, bar.w, bar.h, 11); ctx.fillStyle = T.btn; ctx.fill();
  const f = clamp(Fs.left / c.limit, 0, 1);
  if (f > 0) { rr(ctx, bar.x, bar.y, Math.max(bar.h, bar.w * f), bar.h, 11); ctx.fillStyle = f > 0.3 ? T.accent : T.err; ctx.fill(); }
  txt(ctx, `${Math.ceil(Fs.left)} s`, bar.x + bar.w / 2, bar.y + bar.h / 2, { size: F(18), weight: 600, color: f > 0.5 ? T.onAccent : T.text, align: 'center' });
  // round dots
  const dots = ROUNDS, dw = 20, gap = 8, total = dots * dw + (dots - 1) * gap, dx = bar.x + (bar.w - total) / 2, dy = bar.y - 26;
  for (let k = 0; k < dots; k++) {
    const res = Fs.results[k];
    ctx.beginPath(); ctx.arc(dx + k * (dw + gap) + dw / 2, dy, dw / 2 - 2, 0, 7);
    ctx.fillStyle = res === true ? T.good : res === false ? T.err : k === Fs.round ? T.accent : T.btn; ctx.fill();
  }
  if (s.paused) drawPaused(ctx, s, L);
  drawMsg(ctx, s, L);
}

// ================================================================ draw lots ===============================================================
function drawLots(ctx, s, w, h) {
  const LT = s.LT, lad = LT.lad, T = theme();
  const buttons = LT.phase === 'add' ? ['skip', 'undo'] : LT.phase === 'reveal' ? ['next', 'all'] : LT.phase === 'done' ? ['again', 'lotsmenu'] : [];
  const L = playLayout(w, h, { coach: false, buttons, band: 84 });
  const geo = ladderGeo(L.area, lad.n, lad.rows);
  const claimedBy = (line) => LT.claims[line];
  const rtAll = routes(lad.n, lad.rows, lad.cells);
  const trails = [];
  if (s.run) s.run.who.forEach((line, k) => { const pts = waypoints(geo, s.run.routes[line]); trails.push({ route: s.run.routes[line], color: claimedBy(line), upTo: clamp((s.run.t - k * s.run.stagger) / s.run.unit, 0, pathLength(pts)), alpha: 0.75 }); });
  const landedBowl = (line) => { const p = claimedBy(line); return p >= 0 && LT.revealed.includes(p) ? rtAll[line][lad.rows] : null; };
  drawLadderScene(ctx, s, geo, {
    cells: lad.cells, slots: LT.phase === 'add' && !s.run,
    labelOf: (i) => (claimedBy(i) >= 0 ? lbl(s, claimedBy(i)) : ''),
    colorOf: (i) => (claimedBy(i) >= 0 ? claimedBy(i) : 6),
    bowlTok: () => -1, bowlLabel: () => '', bowlState: () => 'idle',
    landedOf: (i) => (s.run && s.run.who.includes(i) ? null : landedBowl(i)),
    lanternState: (i, p) => (claimedBy(i) >= 0 ? (p.landed ? 'home' : 'idle') : (LT.phase === 'pick' ? 'lit' : 'dim')),
    trails,
    afterBowls: (cx, g) => {
      paperFold(ctx, g, { open: 0 });
      const sw = Math.min(g.sp * 0.92, 190), sh = g.tr * 1.9;
      for (let b = 0; b < lad.n; b++) {
        const who = LT.opened[b], open = who >= 0 && !(s.run && s.run.who.some((line) => rtAll[line][lad.rows] === b));
        slip(ctx, g.xs[b], g.bowlY, sw, sh, open ? lad.slips[b] : '', { hidden: !open, accent: LAMP[(who >= 0 ? who : 6) % 8][1], size: Math.max(12, Math.min(22, sw / 6.2)), wrap: (t, mw, sz) => wrap(ctx, t, mw, sz, 600) });
      }
    },
  });
  const sub = LT.phase === 'add' ? `${LT.players} players, adding rungs` : LT.phase === 'pick' ? `${LT.players} players, choosing lines` : LT.phase === 'reveal' ? `${LT.revealed.length} of ${LT.players} revealed` : 'All slips revealed';
  drawHud(ctx, s, L, 'Draw Lots', `${LOT_SETS.find((x) => x.id === lad.set)?.name ?? ''}  ·  ${sub}`);
  const who = (p) => `Player ${p + 1}`;
  const text = LT.phase === 'add' ? `${who(LT.turn)}: tap between two lines to add one rung, or press Skip.`
    : LT.phase === 'pick' ? `${who(LT.turn)}: tap a lantern to choose your line.`
      : LT.phase === 'reveal' ? 'The slips are folded away. Press Next to send the next player down.'
        : 'Every slip is open. Each player has one. Play again or go back to the menu.';
  drawPrompt(ctx, s, L, text);
  if (L.tools) {
    const names = { skip: 'Skip', undo: 'Undo', next: 'Next', all: 'Reveal all', again: 'Draw again', lotsmenu: 'Menu' };
    for (const id of buttons) { const r = L.tools[id]; if (r) button(ctx, r, names[id], { kind: id === 'next' || id === 'again' || id === 'skip' ? 'accent' : 'solid', size: 26, flash: flashOf(s, id) }); }
  }
  button(ctx, L.pause, '', { icon: 'pause', size: 28, flash: flashOf(s, 'pause'), radius: 18 });
  if (s.paused) drawPaused(ctx, s, L);
  drawMsg(ctx, s, L);
  void T;
}

// Ladder geometry that keeps the bowls (which hang below the last row) inside the box, however large the lanterns come out.
function fitGeo(r, n, rows, o) {
  let g = ladderGeo(r, n, rows, o), maxSp = o.maxSp ?? 190;
  for (let k = 0; k < 8 && g.bowlY + g.tr * 0.85 > r.y + r.h && g.sp > 26; k++) {
    maxSp = g.sp * 0.82;
    g = ladderGeo(r, n, rows, { ...o, maxSp });
  }
  return g;
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(160, Math.max(76, H * 0.3));
  // a small ladder with three lanterns that descend in turn
  const art = R(hero.x, hero.y, hero.w, H - tb);
  const n = 4, rows = 5, cells = emptyCells(n, rows);
  [[1, 0], [2, 2], [3, 1], [4, 0], [4, 2]].forEach(([r, g]) => { cells[r * (n - 1) + g] = 1; });
  const geo = fitGeo(R(art.x + art.w * 0.15, art.y, art.w * 0.7, art.h), n, rows, { maxSp: 120, maxRow: 70 });
  const rts = routes(n, rows, cells), cyc = 6.2, ph = (s.t % cyc);
  hangerBar(ctx, geo);
  ladder(ctx, geo, cells, {});
  const fin = rts.map((r) => r[rows]);
  for (let b = 0; b < n; b++) bowl(ctx, geo.xs[b], geo.bowlY, geo.tr * 0.9, fin.indexOf(b), { label: '' });
  for (let i = 0; i < n; i++) {
    const pts = waypoints(geo, rts[i]), len = pathLength(pts), start = i * 0.5, sP = clamp((ph - start) / 0.3, 0, len);
    const p = samplePath(pts, sP), moving = sP > 0 && sP < len;
    if (sP > 0) trail(ctx, pts, sP, LAMP[i][1], Math.max(3, geo.tr * 0.16), 0.6);
    lantern(ctx, p.x, sP >= len ? geo.bowlY - geo.tr * 0.85 : p.y, geo.tr * (sP >= len ? 0.78 : 1), i, { label: i + 1, state: sP >= len ? 'home' : 'idle', glow: moving ? 1 : 0, sway: sP === 0 && !s.prefs.calm ? Math.sin(s.t * 1.5 + i) * 0.045 : 0 });
  }
  const ty = hero.y + H - tb + tb * 0.42;
  if (v3.on) { ctx.save(); rr(ctx, hero.x + 4, ty - tb * 0.4, hero.w - 8, tb * 1.08, 24); ctx.fillStyle = T.dark ? 'rgba(8,10,28,0.66)' : 'rgba(255,248,230,0.78)'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.fill(); ctx.restore(); }
  emboss(ctx, 'AMIDAKUJI', hero.x + hero.w / 2, ty, { size: tb * 0.5, maxW: hero.w * 0.92 });
  txt(ctx, 'GHOST-LEG LADDER  ·  あみだくじ', hero.x + hero.w / 2, ty + tb * 0.42, { size: tb * 0.19, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 12, fam: `${UI}, ${CJK}` });
  const done = Object.keys(s.progress).length, Bt = L.buttons;
  const lab = {
    continue: ['Continue', s.saved ? `${s.saved.kind === 'daily' ? 'Daily Ladder' : 'Ladder'}  ·  ${s.saved.n} lines` : ''],
    journey: ['The Journey', `${done} of 30 ladders solved`], follow: ['Follow the Line', 'Trace a path before the clock runs out'],
    lots: ['Draw Lots', 'Two to eight players, one device'],
    daily: ['Daily Ladder', s.dailyDone ? 'done today' : s.streak ? `${s.streak} day streak` : 'new every day'],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(Bt)) {
    const prim = id === 'continue' || id === 'journey' || id === 'follow' || id === 'lots' || id === 'daily', r = Bt[id];
    button(ctx, r, lab[id][0], { kind: id === 'journey' || id === 'continue' ? 'accent' : 'solid', size: prim ? 30 : 24, sub: prim && L.subs ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pick screens ============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(40), weight: 400, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 18, fam: NUM });
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
const prevKey = (ci, i) => (i > 0 ? `${ci}:${i - 1}` : `${ci - 1}:${CHAPTERS[Math.max(0, ci - 1)].count - 1}`);

function drawJourney(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s);
  header(ctx, s, LL, 'The Journey');
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  scrollBody(ctx, s, LL.body, () => {
    const J = journeyRects(LL.body, CHAPTERS.map((c) => c.count), sc);
    J.items.forEach((it) => {
      const ch = CHAPTERS[it.ci], z = Math.min(sc, 1.6);
      txt(ctx, ch.name, it.head.x + 4, it.head.y + 26 * z, { size: F(32) * z, weight: 400, color: T.text, maxW: it.head.w - 8, min: 16, fam: NUM });
      txt(ctx, ch.blurb, it.head.x + 4, it.head.y + 58 * z, { size: F(21) * z, weight: 400, color: T.dim, maxW: it.head.w - 8, min: 12 });
      it.lv.forEach((r, i) => {
        const key = `${it.ci}:${i}`, done = s.progress[key], locked = !s.dev && !s.demo && !(it.ci === 0 && i === 0) && !s.progress[prevKey(it.ci, i)] && !done;
        ctx.save(); if (locked) ctx.globalAlpha = 0.45;
        rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = done ? rgba(T.accent, 0.2) : T.btn; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = done ? T.accent : T.line; ctx.stroke();
        txt(ctx, String(i + 1), r.x + r.w / 2, r.y + r.h * 0.42, { size: F(40) * Math.min(z, 1.3), weight: 400, color: T.text, align: 'center', maxW: r.w - 10, min: 14, fam: NUM });
        const stars = done?.stars ?? 0;
        for (let k = 0; k < 3; k++) icons.star(ctx, r.x + r.w / 2 + (k - 1) * r.w * 0.24, r.y + r.h * 0.8, r.w * 0.2, k < stars ? '#ffc93c' : 'rgba(128,128,128,0.4)');
        ctx.restore();
      });
    });
    return J.contentH + 10;
  });
}

function drawTiers(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s);
  header(ctx, s, LL, 'Follow the Line');
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  scrollBody(ctx, s, LL.body, () => {
    const Tr = tierRects(LL.body, TIERS.length, sc), z = Math.min(sc, 1.5);
    Tr.cards.forEach((r, i) => {
      panel(ctx, r, { radius: 22 });
      txt(ctx, TIERS[i].name, r.x + 24, r.y + 40 * z, { size: F(38) * z, weight: 400, color: T.text, maxW: r.w - 190 * z, min: 16, fam: NUM });
      txt(ctx, TIER_TEXT[i], r.x + 24, r.y + 82 * z, { size: F(22) * z, weight: 400, color: T.dim, maxW: r.w - 48, min: 12 });
      const best = s.stats.best[TIERS[i].id];
      txt(ctx, best ? `Best ${best}` : 'No score yet', r.x + 24, r.y + 118 * z, { size: F(26) * z, weight: 600, color: best ? T.accent : T.dim, maxW: r.w - 190 * z, min: 12 });
      const pr = R(r.x + r.w - 150 * z - 18, r.y + r.h - 70 * z - 16, 150 * z, 70 * z);
      button(ctx, pr, 'Play', { kind: 'accent', size: 28, radius: 16 });
    });
    return Tr.contentH + 10;
  });
}

function drawLotSetup(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s), z = Math.min(sc, 1.5);
  header(ctx, s, LL, 'Draw Lots');
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  scrollBody(ctx, s, LL.body, () => {
    const LR = lotsRects(LL.body, LOT_SETS.length, sc), cfg = s.lotsCfg;
    panel(ctx, LR.stepper, { radius: 22 });
    txt(ctx, 'Players', LR.stepper.x + 22, LR.stepper.y + 36 * z, { size: F(30) * z, weight: 600, color: T.text, maxW: LR.stepper.w - 40, min: 14 });
    txt(ctx, String(cfg.players), LR.stepper.x + 22, LR.stepper.y + LR.stepper.h - 46 * z, { size: F(64) * z, weight: 400, color: T.accent, fam: NUM });
    button(ctx, LR.minus, '', { icon: 'minus', size: 30, disabled: cfg.players <= 2, radius: 18 });
    button(ctx, LR.plus, '', { icon: 'plus', size: 30, disabled: cfg.players >= 8, radius: 18 });
    txt(ctx, 'What is drawn', LL.body.x + 6, LR.setsTop + 20, { size: F(26) * z, weight: 700, color: T.accent, maxW: LL.body.w, min: 14 });
    LR.cards.forEach((r, i) => {
      const set = LOT_SETS[i], on = cfg.set === set.id;
      rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = on ? rgba(T.accent, 0.2) : T.panel; ctx.fill();
      ctx.lineWidth = on ? 2.5 : 1.5; ctx.strokeStyle = on ? T.accent : T.line; ctx.stroke();
      txt(ctx, set.name, r.x + 20, r.y + r.h * 0.36, { size: F(30) * z, weight: 600, color: T.text, maxW: r.w - 40, min: 14 });
      txt(ctx, set.blurb, r.x + 20, r.y + r.h * 0.7, { size: F(21) * z, weight: 400, color: T.dim, maxW: r.w - 40, min: 12 });
      if (on) icons.check(ctx, r.x + r.w - 34, r.y + r.h / 2, 30, T.accent);
    });
    button(ctx, LR.start, 'Start drawing', { kind: 'accent', size: 32, radius: 22 });
    return LR.contentH;
  });
}

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
    txt(ctx, page.title, x, y + 26 * sc, { size: F(34) * sc, weight: 400, color: T.accent, maxW: width, min: 16, fam: NUM }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc;
      else if (b.li) for (const it of b.li) {
        const sz = F(27) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 400, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  if (DL.split) {
    if (page.fig) figure(ctx, figR, page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w, Math.max(240, textR.h * (sc > 1.6 ? 0.4 : 0.52)), 560), fr = R(textR.x + (textR.w - Math.min(textR.w, fh + 120)) / 2, y, Math.min(textR.w, fh + 120), fh);
        figure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), rows = settingsRows(s), SL = settingsLayout(w, h, sc, rows.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    rows.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      (row.id === 'restore' ? [restoreLabel(s)] : row.opts).forEach((o, k) => button(ctx, seg[k], o, { size: 24 * Math.min(sc, 1.6), active: k === cur, radius: 14, kind: row.id === 'restore' && !s.owned ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

function drawStats(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s), z = Math.min(sc, 1.6);
  header(ctx, s, LL, 'Stats');
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  scrollBody(ctx, s, LL.body, () => {
    const body = LL.body;
    const stars = Object.values(s.progress).reduce((a, p) => a + (p.stars ?? 0), 0);
    const rows = [
      ['Journey ladders solved', `${Object.keys(s.progress).length} of 30`],
      ['Journey stars', `${stars} of 90`],
      ['Ladders solved in all', s.stats.solved],
      ['Daily streak', `${s.streak} day${s.streak === 1 ? '' : 's'}`],
      ['Best daily streak', `${s.stats.bestStreak} day${s.stats.bestStreak === 1 ? '' : 's'}`],
      ...TIERS.map((t) => [`Follow the Line, ${t.name}: best`, s.stats.best[t.id] ?? '–']),
      ['Follow the Line runs', s.stats.runs],
      ['Draws with friends', s.stats.lots],
    ];
    let y = body.y;
    const rh = 70 * z;
    rows.forEach(([l, v]) => {
      const r = R(body.x, y, body.w, rh - 8);
      panel(ctx, r, { radius: 16 });
      txt(ctx, l, r.x + 18, r.y + r.h / 2, { size: F(26) * z, weight: 500, color: T.text, maxW: r.w * 0.66, min: 12 });
      txt(ctx, String(v), r.x + r.w - 18, r.y + r.h / 2, { size: F(30) * z, weight: 600, color: T.accent, align: 'right', maxW: r.w * 0.3, min: 12 });
      y += rh;
    });
    return y - body.y + 10;
  });
}

// ================================================================ result ===================================================================
function drawOver(ctx, s, w, h) {
  const T = theme(), R0 = s.result;
  if (!R0) return;
  setBrandTone(T.dark);
  const sc = scaleOf(s), O = overLayout(w, h), art = O.art;
  if (R0.type === 'build' && s.B) {
    const P = s.B.P, cells = flatten(P, s.B.player), geo = fitGeo(R(art.x, art.y, art.w, art.h), P.n, P.rows, { maxSp: 110, maxRow: 70 });
    hangerBar(ctx, geo);
    ladder(ctx, geo, cells, {});
    const rts = routes(P.n, P.rows, cells);
    rts.forEach((rt, i) => trail(ctx, waypoints(geo, rt), 99, LAMP[i % 8][1], Math.max(3, geo.tr * 0.16), 0.55));
    for (let b = 0; b < P.n; b++) bowl(ctx, geo.xs[b], geo.bowlY, geo.tr * 0.9, P.target.indexOf(b), { label: '', state: 'home' });
    for (let i = 0; i < P.n; i++) lantern(ctx, geo.xs[P.target[i]], geo.bowlY - geo.tr * 0.85, geo.tr * 0.78, i, { label: lbl(s, i), state: 'home' });
    drawSparks(ctx, s);
  } else if (R0.type === 'follow') {
    const dw = Math.min(54, (art.w - 40) / ROUNDS), tw = dw * ROUNDS, x0 = art.x + (art.w - tw) / 2, cy = art.y + art.h / 2;
    R0.results.forEach((ok, k) => {
      const cx = x0 + (k + 0.5) * dw;
      ctx.beginPath(); ctx.arc(cx, cy, dw * 0.36, 0, 7); ctx.fillStyle = ok ? T.good : T.err; ctx.fill();
      icons[ok ? 'check' : 'exit'](ctx, cx, cy, dw * 0.5, T.dark ? '#08101a' : '#ffffff');
    });
  }
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 36 : 46, z = Math.min(sc, 1.5);
    const title = R0.type === 'follow' ? 'Run complete' : R0.daily ? 'Daily Ladder solved' : 'Every lantern is home';
    txt(ctx, title, body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * z, weight: 400, color: T.text, align: 'center', maxW: body.w, min: 18, fam: NUM }); y += (tsz + 12) * z;
    const sz = compact ? 36 : 50;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = R0.type === 'follow'
      ? [['Score', R0.score], ['Right', `${R0.correct} of ${ROUNDS}`], ['Best', R0.best], ['Tier', TIERS[R0.tier].name]]
      : [['Rungs used', `${R0.used} of ${R0.budget}`], ['Fewest', R0.min], ['Hints', R0.hints], ['Time', fmtT(R0.time)]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 80) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 26 : 32) * z, weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 12 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * z, weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.newBest) { txt(ctx, 'New best score for this tier', body.x + body.w / 2, y + 16, { size: F(24) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.type === 'build' && R0.used <= R0.min) { txt(ctx, 'You found the fewest possible rungs', body.x + body.w / 2, y + 16, { size: F(24) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8;
    txt(ctx, 'Did you know', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 38 * sc;
    y += para(ctx, FACTS[R0.fact % FACTS.length], body.x + 8, y, body.w - 16, { size: F(24) * sc, weight: 400, color: T.dim, lh: 1.3 }) + 6;
    return y - body.y + 10;
  });
  const nextLabel = R0.type === 'follow' ? 'Play again' : R0.kind === 'journey' ? (R0.next ? 'Next ladder' : 'Back to the Journey') : 'Back to menu';
  button(ctx, O.btns.next, nextLabel, { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.type === 'follow' ? 'Tiers' : R0.kind === 'journey' ? 'Journey' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}
const fmtT = (t) => { const x = Math.max(0, Math.floor(t)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(34), weight: 400, color: T.text, align: 'center', maxW: c.w - 40, min: 18, fam: NUM });
  para(ctx, 'The full game has the whole Journey of 30 ladders, Follow the Line at three tiers, Draw Lots for up to eight players, the Daily Ladder, hints that teach and Watch and Learn. Get Amidakuji on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(26), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth, finals, idx };
