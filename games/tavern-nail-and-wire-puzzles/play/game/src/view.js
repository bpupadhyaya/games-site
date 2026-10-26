// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, levelsLayout, overLayout, pauseLayout, centerCard, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, plaque, embossText, button, rr, txt, para, wrap, F, mix, rgba, icons } from './ui.js';
import { v3 } from './v3.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { drawScene, drawGizmo, AXIS_COL, AXIS_NAME, newCamera, makeView, smooth } from './scene.js';
import { DOCS } from './content.js';
import { LEVELS, TIER_NAMES, tierOf, replay, FIGURES } from './levels.js';
import { isClear } from './wire.js';

const veil = (ctx, w, h, a = 0.78) => { if (v3.on) { ctx.fillStyle = `rgba(12,6,2,${a})`; ctx.fillRect(0, 0, w, h); } };
export const metrics = { max: 0, view: 0, rect: null };
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'guides', label: 'Mat guides', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore purchase'] },
];
// The web demo has nothing to buy, so its Settings has no Restore row.
export const settingsRows = (s) => (s.demo ? SETTINGS.filter((r) => r.id !== 'restore') : SETTINGS);
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'guides': return p.guides ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return 0;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  v3.look = T.name.toLowerCase();
  background(ctx, w, h, s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (v3.on && (sc === 'levels' || sc === 'settings' || sc === 'demo-limit')) {
    // no scene of their own: the hero puzzle idles on the bar-top behind a dark veil
    drawScene(ctx, R(w * 0.1, h * 0.04, w * 0.8, w * 0.8), figureScene('hero', s.t, { yaw: 0.5 + (s.prefs.calm ? 0 : s.t * 0.1), pitch: 0.5, zoom: 1.0 }));
  }
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'levels') drawLevels(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ the scene description ============================================
const METALS = ['brass', 'copper', 'steel'];
export function sceneOf(s) {
  const P = s.P;
  const pieces = [{ def: P.lv.puzzle.frame, pose: { o: 0, x: 0, y: 0, z: 0 }, metal: 'iron', fixed: true }];
  P.lv.puzzle.loose.forEach((l, i) => {
    const sel = s.sel === i && !P.done, anim = P.anim && P.anim.piece === i ? { ...P.anim, e: smooth(P.anim.t / P.anim.dur) } : null;
    pieces.push({ def: l.shape, pose: P.poses[i], anim, metal: l.metal ?? METALS[i % 3], kind: l.kind, sel, shake: P.bump && P.bump.piece === i ? P.bump.t : 0 });
  });
  const hint = s.hint && !s.hint.stuck && s.hint.k ? { piece: s.hint.piece, k: s.hint.k, i: s.hint.i } : null;
  return { cam: P.cam, view: P.view, pieces, opts: { t: s.t, grid: s.prefs.guides, shadows: s.prefs.guides, hint, win: P.done ? smooth(clamp(1 - s.winT / 1.4, 0, 1)) : 0 } };
}

// ================================================================ play ===================================================================
function axisButton(ctx, s, r, kind, i) {
  const T = theme(), ax = i >> 1, minus = i & 1, col = AXIS_COL[ax];
  button(ctx, r, '', { size: 26, flash: flashOf(s, kind + i) });
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, sz = Math.min(r.h * 0.62, 40);
  const lx = cx - sz * 0.55, ix = cx + sz * 0.5;
  txt(ctx, `${minus ? '−' : '+'}${AXIS_NAME[ax]}`, lx - sz * 0.15, cy + 1, { size: F(Math.min(r.h * 0.4, 28)), weight: 800, color: col, align: 'center', maxW: r.w * 0.5, min: 12 });
  if (kind === 'sl') {
    ctx.save(); ctx.translate(ix, cy);
    const rot = ax === 0 ? 0 : ax === 1 ? -Math.PI / 2 : -Math.PI / 4;
    ctx.rotate(rot + (minus ? Math.PI : 0));
    icons.arrowR(ctx, 0, 0, sz, T.text);
    ctx.restore();
  } else icons[minus ? 'turnCCW' : 'turnCW'](ctx, ix, cy, sz * 1.05, T.text);
}
function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P;
  if (!P) return;
  const coach = !!(s.hint || s.auto.on), L = playLayout(w, h, coach);
  if (L.panel) { rr(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, 26); ctx.fillStyle = T.panel; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke(); }
  const hud = L.hud, cx = hud.x + hud.w;
  if (v3.on) {
    plaque(ctx, R(hud.x - 12, hud.y - 10, hud.w + 24, Math.min(hud.h + 14, 104)), { radius: 18, alpha: 0.9 });
    const C0 = L.ctl, rs = [...C0.slide, ...C0.turn, C0.undo, C0.reset, C0.think, C0.piece, C0.menu].filter(Boolean);
    if (rs.length) { const x0 = Math.min(...rs.map((q) => q.x)), y0 = Math.min(...rs.map((q) => q.y)), x1 = Math.max(...rs.map((q) => q.x + q.w)), y1 = Math.max(...rs.map((q) => q.y + q.h)); plaque(ctx, R(x0 - 10, y0 - 34, x1 - x0 + 20, y1 - y0 + 44), { radius: 20, alpha: 0.62, brass: false }); }
  }
  const n = P.lv.puzzle.loose.length, clear = P.poses.filter((p, i) => isClear(P.rules, P.lv.puzzle.loose[i].shape, p)).length;
  const done = clear === n, pillW = L.land ? 0 : Math.min(300, hud.w * 0.4);
  txt(ctx, P.title, hud.x + 4, hud.y + 28, { size: F(34), weight: 700, color: T.text, maxW: hud.w - pillW - 10, min: 16, display: true });
  txt(ctx, `Moves ${P.moves}  ·  Par ${P.lv.par}`, hud.x + 4, hud.y + 72, { size: F(24), weight: 600, color: T.dim, maxW: hud.w * 0.5, min: 12 });
  txt(ctx, n > 1 ? `${clear} of ${n} clear` : done ? 'Clear' : 'Caught', cx - 4, hud.y + 72, { size: F(30), weight: 700, color: done ? T.good : T.accent, align: 'right', maxW: hud.w * 0.45, min: 14 });
  // the scene
  const sc = sceneOf(s);
  drawScene(ctx, L.area, sc);
  drawGizmo(ctx, P.cam, L.area.x + 58, L.area.y + L.area.h - 58, 40);
  if (s.tip > 0 && !s.auto.on) {
    const a = Math.min(1, s.tip);
    ctx.save(); ctx.globalAlpha = a;
    const tw = Math.min(L.area.w - 20, 560), tt = 'Drag a piece to slide it. Drag the empty mat to look round. Carry every loose piece out of the dashed zone.', fs = F(19);
    const lines = wrap(ctx, tt, tw - 28, fs, 500), th = lines.length * fs * 1.2 + 24, tx = L.area.x + (L.area.w - tw) / 2;
    panel(ctx, R(tx, L.area.y + 8, tw, th), { radius: 16, fill: T.dark ? 'rgba(14,8,4,0.78)' : 'rgba(255,252,243,0.9)' });
    para(ctx, tt, tx + 14, L.area.y + 20, tw - 28, { size: fs, weight: 500, color: T.text, lh: 1.2 });
    ctx.restore();
  }
  // controls
  const C = L.ctl;
  if (s.auto.on) {
    const B = C;
    const bx0 = C.slide[1].x, bw0 = C.turn[0].x + C.turn[0].w - bx0;
    txt(ctx, 'WATCH AND LEARN', bx0, C.slide[1].y + 8, { size: F(18), weight: 700, color: T.dim, maxW: bw0, min: 11 });
    if (C.undo.y - C.slide[1].y > 150) para(ctx, 'The game thinks first, then shows its move, then makes it. Pause stops everything. Faster and Slower change how long it thinks.', bx0, C.slide[1].y + 36, bw0, { size: F(20), weight: 500, color: T.dim, lh: 1.3 });
    // simple row: Exit, Pause/Resume, Faster, Slower laid over the three-row block
    const bx = C.slide[1].x, bw = C.turn[0].x + C.turn[0].w - bx, bh = 66, gap = 10, w4 = (bw - gap * 3) / 4, y = C.undo.y;
    button(ctx, R(bx, y, w4, bh), 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
    button(ctx, R(bx + (w4 + gap), y, w4, bh), s.auto.paused ? 'Resume' : 'Pause', { icon: s.auto.paused ? 'play' : 'pause', size: 26, kind: s.auto.paused ? 'accent' : 'solid', flash: flashOf(s, 'apause') });
    button(ctx, R(bx + 2 * (w4 + gap), y, w4, bh), 'Faster', { icon: 'minus', size: 22, flash: flashOf(s, 'adec') });
    button(ctx, R(bx + 3 * (w4 + gap), y, w4, bh), 'Slower', { icon: 'plus', size: 22, flash: flashOf(s, 'ainc') });
    void B;
  } else {
    txt(ctx, 'SLIDE', C.capSlide.x + C.capSlide.w / 2, C.capSlide.y + C.capSlide.h / 2, { size: F(18), weight: 700, color: T.dim, align: 'center', min: 11 });
    txt(ctx, 'TURN', C.capTurn.x + C.capTurn.w / 2, C.capTurn.y + C.capTurn.h / 2, { size: F(18), weight: 700, color: T.dim, align: 'center', min: 11 });
    for (let i = 0; i < 6; i++) { axisButton(ctx, s, C.slide[i], 'sl', i); axisButton(ctx, s, C.turn[i], 'tu', i); }
    button(ctx, C.undo, 'Undo', { icon: 'undo', size: 22, disabled: !P.undo.length, flash: flashOf(s, 'undo') });
    button(ctx, C.reset, 'Reset', { icon: 'erase', size: 22, flash: flashOf(s, 'reset') });
    button(ctx, C.think, 'Think', { icon: 'bulb', size: 22, kind: 'accent', flash: flashOf(s, 'think') });
    button(ctx, C.piece, n > 1 ? `${s.sel + 1} of ${n}` : 'Piece', { icon: 'swap', size: 20, disabled: n < 2, flash: flashOf(s, 'piece') });
    button(ctx, C.menu, 'Menu', { icon: 'pause', size: 22, flash: flashOf(s, 'pause') });
  }
  if (coach) drawCoach(ctx, s, L);
  else if (L.coachR) drawGoal(ctx, s, L);
  if (s.paused) drawPaused(ctx, s, w, h);
  drawMsg(ctx, s, L);
}
function drawGoal(ctx, s, L) {
  const T = theme(), c = L.coachR;
  if (c.h < 70) return;
  if (v3.on) plaque(ctx, R(c.x - 4, c.y - 2, c.w + 8, c.h + 4), { radius: 16, alpha: 0.82, brass: false });
  const text = 'Carry every loose piece out of the dashed zone. The dark iron frame is held still; brass, copper and steel pieces move.';
  let size = F(21), lines = wrap(ctx, text, c.w - 28, size, 500);
  while (lines.length * size * 1.25 > c.h - 30 && size > F(14)) { size -= 1; lines = wrap(ctx, text, c.w - 28, size, 500); }
  txt(ctx, 'GOAL', c.x + 14, c.y + 14, { size: F(17), weight: 800, color: T.accent, min: 11 });
  para(ctx, text, c.x + 14, c.y + 32, c.w - 28, { size, weight: 500, color: T.dim, lh: 1.25 });
}
function drawCoach(ctx, s, L) {
  const T = theme(), c = L.coachR;
  if (!c) return;
  panel(ctx, c, { radius: 20, fill: T.dark ? 'rgba(20,12,6,0.92)' : 'rgba(255,252,243,0.96)' });
  const pad = 14, text = s.auto.on ? s.autoText : s.hint ? s.hint.text : '';
  let btnH = 0;
  if (!s.auto.on && s.hint) {
    btnH = 54;
    const bw = (c.w - pad * 2 - 10) / 2, y = c.y + c.h - pad - btnH;
    button(ctx, R(c.x + pad, y, bw, btnH), 'Close', { size: 24, flash: flashOf(s, 'close') });
    button(ctx, R(c.x + pad + bw + 10, y, bw, btnH), s.hint.stuck ? 'Undo' : 'Do it', { size: 24, kind: 'accent', flash: flashOf(s, 'go') });
  }
  if (s.auto.on) {
    const tag = s.auto.phase === 'think' ? 'Thinking...' : s.auto.phase === 'reveal' ? 'Next move' : s.auto.paused ? 'Paused' : s.auto.done ? 'Finished' : 'Watching';
    txt(ctx, tag, c.x + pad, c.y + 22, { size: F(22), weight: 700, color: T.accent, maxW: c.w * 0.5, min: 12 });
    txt(ctx, `Think time ${s.thinkSecs}s`, c.x + c.w - pad, c.y + 22, { size: F(20), weight: 500, color: T.dim, align: 'right', maxW: c.w * 0.45, min: 11 });
  }
  const top = c.y + (s.auto.on ? 40 : pad), avail = c.h - (top - c.y) - pad - btnH - (btnH ? 8 : 0);
  let size = F(23), lines = wrap(ctx, text, c.w - pad * 2, size, 500);
  while (lines.length * size * 1.25 > avail && size > F(14)) { size -= 1; lines = wrap(ctx, text, c.w - pad * 2, size, 500); }
  para(ctx, text, c.x + pad, top, c.w - pad * 2, { size, weight: 500, color: T.text, lh: 1.25 });
}
function drawPaused(ctx, s, w, h) {
  const T = theme(), pl = pauseLayout(w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h);
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(30,18,9,0.97)' : 'rgba(255,252,243,0.98)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 46, { size: F(40), weight: 700, color: T.text, align: 'center', display: true });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart level', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), fb = L.area;
  const w = Math.min(fb.w - 20, 540), cx = fb.x + fb.w / 2, size = F(24), lines = wrap(ctx, m.text, w - 36, size, 600), hh = lines.length * size * 1.22 + 22;
  const y = fb.y + fb.h - hh - 70;
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(20,12,6,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ figures (about / how to / rules) ==========================================
const figCache = new Map();
export function figureScene(kind, t, cam) {
  const spec = FIGURES[kind] ?? FIGURES.ring, lv = LEVELS[spec.level];
  const rp = replay(lv);
  let v = figCache.get(spec.level);
  if (!v) { v = { ...makeView(rp.rules), fit: false }; figCache.set(spec.level, v); }
  const st = rp.at(t * (spec.speed ?? 1.0), spec.pause ?? 1.2);
  const pieces = [{ def: lv.puzzle.frame, pose: { o: 0, x: 0, y: 0, z: 0 }, metal: 'iron', fixed: true }];
  lv.puzzle.loose.forEach((l, i) => pieces.push({ def: l.shape, pose: st.poses[i], anim: st.anim && st.anim.piece === i ? st.anim : null, metal: l.metal ?? METALS[i % 3], kind: l.kind, sel: st.sel === i }));
  const c = cam ?? { yaw: 0.5 + 0.18 * Math.sin(t * 0.25), pitch: 0.55, zoom: spec.zoom ?? 1 };
  return { cam: c, view: v, pieces, opts: { t, grid: true, shadows: true, hideGrip: true } };
}
export function drawFigure(ctx, r, kind, t) {
  const T = theme();
  if (v3.on) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(217,164,58,0.85)'; ctx.stroke();
    rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 25); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke();
  } else panel(ctx, r, { radius: 22, fill: T.dark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.35)' });
  drawScene(ctx, R(r.x + 4, r.y + 4, r.w - 8, r.h - 8), figureScene(kind, t));
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(170, Math.max(70, H * 0.32)), side = Math.max(120, Math.min(hero.w, H - tb - 10, 640));
  const fr = R(hero.x + (hero.w - side) / 2, hero.y + Math.max(0, (H - side - tb) / 2), side, side);
  const cam = { yaw: 0.5 + (s.prefs.calm ? 0 : s.t * 0.12), pitch: v3.on ? 0.62 : 0.5, zoom: v3.on ? 0.84 : 1.05 };
  drawScene(ctx, fr, figureScene('hero', s.t, cam));
  const ty = fr.y + fr.h + tb * 0.42;
  if (v3.on) {
    embossText(ctx, 'TAVERN', hero.x + hero.w / 2, ty - tb * 0.06, { size: tb * 0.46, maxW: hero.w * 0.94 });
    embossText(ctx, 'NAIL AND WIRE PUZZLES', hero.x + hero.w / 2, ty + tb * 0.34, { size: tb * 0.19, maxW: hero.w * 0.94, tone: 'steel' });
  } else {
    txt(ctx, 'TAVERN', hero.x + hero.w / 2, ty - tb * 0.1, { size: tb * 0.34, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.94, min: 20, display: true });
    txt(ctx, 'NAIL AND WIRE PUZZLES', hero.x + hero.w / 2, ty + tb * 0.26, { size: tb * 0.19, weight: 700, color: T.accent, align: 'center', maxW: hero.w * 0.94, min: 12, display: true });
  }
  const B = L.buttons, lab = {
    play: [s.hasSave ? 'Continue' : 'Play', s.playInfo], levels: ['Levels', `${s.doneCount} of ${LEVELS.length} freed`], daily: ['Round of the Day', s.dailyInfo],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear' };
  for (const id of Object.keys(B)) {
    const prim = id === 'play' || id === 'levels' || id === 'daily' || id === 'learn', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'play' ? 'accent' : 'solid', size: prim ? 32 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: iconOf[id] ?? '' });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pages =================================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(42), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20, display: true });
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

function drawLevels(ctx, s, w, h) {
  veil(ctx, w, h, 0.7);
  const T = theme(), sc = scaleOf(s), LL = levelsLayout(w, h, LEVELS.length);
  header(ctx, s, LL, 'Levels');
  scrollBody(ctx, s, LL.body, () => {
    LEVELS.forEach((lv, i) => {
      const r = LL.tiles[i], stars = s.stars[i] ?? 0, open = i <= s.unlocked || s.dev;
      if (v3.on) plaque(ctx, r, { radius: 18, alpha: open ? 0.97 : 0.55, brass: open });
      else {
        rr(ctx, r.x, r.y, r.w, r.h, 18);
        ctx.fillStyle = open ? mix(T.mat0, T.mat1, 0.35) : 'rgba(128,128,128,0.18)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = open ? T.matEdge : T.line; ctx.stroke();
      }
      txt(ctx, String(i + 1), r.x + r.w / 2, r.y + r.h * 0.34, { size: F(Math.min(48, r.w * 0.36)), weight: 700, color: open ? T.text : T.dim, align: 'center', maxW: r.w - 10, min: 14 });
      txt(ctx, TIER_NAMES[tierOf(i)].replace(/ Own$/, ''), r.x + r.w / 2, r.y + r.h * 0.6, { size: F(Math.min(20, r.w * 0.15)) * Math.min(sc, 1.3), weight: 600, color: open ? T.dim : T.dim, align: 'center', maxW: r.w - 10, min: 11 });
      for (let k = 0; k < 3; k++) icons.star(ctx, r.x + r.w / 2 + (k - 1) * Math.min(26, r.w * 0.22), r.y + r.h * 0.84, Math.min(26, r.w * 0.22), k < stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
      if (!open) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill(); }
    });
    return LL.contentH;
  });
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

function drawDoc(ctx, s, w, h) {
  veil(ctx, w, h, 0.78);
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
    txt(ctx, page.title, x, y + 26 * sc, { size: F(36) * sc, weight: 700, color: T.accent, maxW: width, min: 16, display: true }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc;
      else if (b.h) y += para(ctx, b.h, x, y, width, { size: F(32) * sc, weight: 700, color: T.text }) + 8 * sc;
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
        const fh = Math.min(textR.w - 20, Math.max(260, textR.h * (sc > 1.6 ? 0.35 : 0.5)), 480), fr = R(textR.x + (textR.w - fh) / 2, y, fh, fh);
        drawFigure(ctx, fr, page.fig, s.t); y += fh + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

function drawSettings(ctx, s, w, h) {
  veil(ctx, w, h, 0.72);
  const T = theme(), sc = scaleOf(s), rows = settingsRows(s), SL = settingsLayout(w, h, sc, rows.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    rows.forEach((row, i) => {
      const g = SL.rows[i], isRestore = row.id === 'restore', note = isRestore ? s.restoreMsg : '';
      panel(ctx, g.rect, { radius: 20 });
      const ly = g.rect.y + g.rect.h / 2 - (note ? 15 : 0), lsz = F(28) * Math.min(sc, 1.5);
      txt(ctx, row.label, g.rect.x + 22, ly, { size: lsz, weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      if (note) txt(ctx, note, g.rect.x + 22, g.rect.y + g.rect.h / 2 + 22, { size: Math.min(lsz * 0.72, 22), weight: 500, color: T.dim, maxW: g.rect.w - g.ctrl.w - 50, min: 11 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => {
        const label = isRestore ? (s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : o) : o;
        button(ctx, seg[k], label, { size: 24, active: k === cur && !isRestore, radius: 14, kind: isRestore ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) });
      });
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

function drawOver(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), sc = Math.min(scaleOf(s), 1.5), O = overLayout(w, h), R0 = s.result;
  if (!R0) return;
  const c = O.card;
  if (s.P) drawScene(ctx, O.field, { ...sceneOf(s), opts: { t: s.t, grid: s.prefs.guides, shadows: s.prefs.guides, win: 1, hideGrip: true } });
  panel(ctx, c, { radius: 28, fill: T.dark ? 'rgba(30,18,9,0.96)' : 'rgba(255,252,243,0.97)' }); edgeStroke(ctx, c, 28, 0.5);
  const small = c.h < 420, tsz = small ? 32 : 42, sz = small ? 36 : 56;
  let y = c.y + (small ? 14 : 26);
  txt(ctx, R0.daily ? 'Round of the Day freed' : R0.n > 1 ? 'All pieces free' : 'Piece free', c.x + c.w / 2, y + tsz * 0.6, { size: F(tsz) * sc, weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 20, display: true }); y += (tsz + 14) * Math.min(sc, 1.3);
  for (let k = 0; k < 3; k++) icons.star(ctx, c.x + c.w / 2 + (k - 1) * (sz + 12), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
  y += sz + (small ? 8 : 16);
  const lines = [`${R0.moves} move${R0.moves === 1 ? '' : 's'}  ·  par ${R0.par}`, R0.hints ? `Think used ${R0.hints} time${R0.hints === 1 ? '' : 's'}` : 'No Think used'];
  if (R0.daily) lines.push(`Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`);
  else if (R0.first) lines.push('Next level unlocked');
  const avail = O.next.y - 8 - y, step = Math.min(40 * sc, avail / lines.length), fs = Math.min(F(26) * sc, step * 0.78);
  for (const ln of lines) { txt(ctx, ln, c.x + c.w / 2, y + step / 2, { size: fs, weight: 500, color: T.dim, align: 'center', maxW: c.w - 40, min: 11 }); y += step; }
  button(ctx, O.next, R0.daily ? 'Back to menu' : R0.last ? 'Levels' : 'Next level', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.again, 'Share', { size: 26, flash: flashOf(s, 'share') });
  button(ctx, O.menu, R0.daily ? 'Levels' : 'Menu', { size: 26, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, c.x + c.w / 2, Math.min(c.y + c.h + 26, h - 8), 15);
}

function drawDemoLimit(ctx, s, w, h) {
  veil(ctx, w, h, 0.6);
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the demo end', c.x + c.w / 2, c.y + 70, { size: F(36), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18, display: true });
  para(ctx, 'The full game has every level, the Round of the Day, Think help and Watch and Learn. Get Tavern Nail and Wire Puzzles on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  txt(ctx, 'Tap anywhere to return to the menu', c.x + c.w / 2, c.y + c.h - 84, { size: F(22), weight: 600, color: T.dim, align: 'center', maxW: c.w - 40, min: 12 });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
void newCamera; void AXIS_NAME;
