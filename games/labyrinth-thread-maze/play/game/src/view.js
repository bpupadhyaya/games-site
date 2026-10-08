// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, centerCard, TEXT_SCALES, THINK_STEPS, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, wrap, F, rgba, icons, DISPLAY } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { threadOf, threadPoints, routeOf, fogged, torchOf, fmtTime, centerOf } from './play.js';
import { GRADES, lightFrom } from './maze.js';
import { DOCS } from './content.js';
import { drawFigure } from './figures.js';
import { makeView, drawMaze, fitCam } from './scene.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'hand', label: 'Panel side', opts: ['Right', 'Left'] },
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
    case 'timer': return p.timer ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);

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
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ the board ===============================================================
// Soft torchlight: brightness 1 at the lamp falling to 0 at the edge of the torch, along the corridors.
function lightMap(P) {
  const r = torchOf(P), out = new Map();
  if (!r) return null;
  const add = (cell, off) => { for (const [c, d] of lightFrom(P.maze, cell, r + 1)) { const b = 1 - (d + off) / (r + 0.4); if (b > (out.get(c) ?? -1)) out.set(c, b); } };
  const here = centerOf(P.maze, P.cell);
  add(P.cell, Math.hypot(P.x - here.x, P.y - here.y));
  if (P.q.length) { const n = centerOf(P.maze, P.q[0]); add(P.q[0], Math.hypot(P.x - n.x, P.y - n.y)); }
  return out;
}
function boardView(s, P) {
  const m = P.maze, fog = fogged(P), h = s.hint;
  const V = makeView(m, {
    cam: s.cam, lamp: { x: P.x, y: P.y }, thread: threadOf(P), off: P.th.o, visited: P.visited, seen: fog ? P.seen : null, torch: fog ? torchOf(P) : 0,
    light: fog ? lightMap(P) : null, hint: h && h.cells ? h.cells : null, hintA: h && h.stage === 'show' ? Math.min(1, (12 - s.hintT) / 2) : 1, look: h && h.stage === 'look' && h.fork >= 0 ? h.fork : -1,
    opts: h && h.opts ? h.opts : null, map: fog && s.map, route: P.done ? routeOf(m) : null, t: s.t, goalGlow: P.done ? 2.5 : 1, night: 0.45,
  });
  return V;
}
function drawSparks(ctx, s, rect, cam) {
  const cs = rect.w / cam.v;
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  for (const sp of s.sparks) {
    const a = 1 - sp.t / sp.life, x = rect.x + rect.w / 2 + (sp.x - cam.cx) * cs, y = rect.y + rect.h / 2 + (sp.y - cam.cy) * cs;
    ctx.fillStyle = `rgba(255,214,120,${(0.9 * a).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, sp.r * cs * (0.6 + a * 0.6), 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.board);
  ctx.fillStyle = rgba(T.tray, 0.74); rr(ctx, L.board.x, L.board.y, L.board.size, L.board.size, Math.min(26, L.board.size * 0.035)); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(28,18,14,0.96)' : 'rgba(255,250,240,0.97)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 700, color: T.text, align: 'center', font: DISPLAY });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart maze', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}

function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), b = L.board;
  const w = Math.min(b.size - 30, 560);
  let size = F(24), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22, y = b.y + 14;
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, b.x + b.size / 2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(20,12,8,0.94)' : 'rgba(255,252,244,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, b.x + b.size / 2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

function chip(ctx, r, label, value, small) {
  const T = theme();
  panel(ctx, r, { radius: 16 });
  txt(ctx, value, r.x + r.w / 2, r.y + r.h * 0.42, { size: F(small ? 28 : 34), weight: 700, color: T.text, align: 'center', maxW: r.w - 14, min: 14 });
  txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.8, { size: F(small ? 17 : 19), weight: 400, color: T.dim, align: 'center', maxW: r.w - 10, min: 11 });
}

function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P;
  if (!P) return;
  const L = playLayout(w, h, { coach: !!(s.hint || s.auto.on), hand: s.prefs.hand }), auto = s.auto.on;
  // header
  const g = GRADES[P.grade], title = auto ? 'Watch and Learn' : P.kind === 'daily' ? 'Daily Maze' : g.name;
  txt(ctx, title, L.hud.name.x, L.hud.name.y + 26, { size: F(40), weight: 700, color: T.text, maxW: L.hud.name.w, min: 18, font: DISPLAY });
  txt(ctx, auto ? `${g.name}  ·  ${g.n} by ${g.n}` : P.kind === 'daily' ? `${g.name}  ·  ${g.n} by ${g.n}` : `${g.n} by ${g.n}  ·  ${g.tag}`, L.hud.name.x, L.hud.name.y + 56, { size: F(21), weight: 500, color: T.accent, maxW: L.hud.name.w, min: 12 });
  if (!auto) button(ctx, L.hud.pause, '', { icon: 'pause', size: 30, flash: flashOf(s, 'pause'), radius: 18 });
  const sr = L.hud.stats, cw = (sr.w - 16) / 3, small = L.mode === 'portrait' && sr.h < 80;
  const cells = auto ? [['Forks', s.auto.n], ['Steps', P.steps], ['Shortest', P.maze.opt]] : [['Time', s.prefs.timer ? fmtTime(P.t) : '–'], ['Steps', P.walked], ['Hints', P.hints]];
  cells.forEach(([lb, v], i) => chip(ctx, R(sr.x + i * (cw + 8), sr.y, cw, sr.h), lb, v, small));
  // board
  const V = boardView(s, P);
  drawMaze(ctx, L.board.rect, V);
  drawSparks(ctx, s, L.board.rect, s.cam);
  if (fogged(P) && s.map) { txt(ctx, 'Map', L.board.x + 20, L.board.y + 28, { size: F(24), weight: 700, color: '#f6ead8', maxW: 160 }); }
  drawMsg(ctx, s, L);
  // controls
  if (auto) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else {
    const Tl = L.tools, third = fogged(P) ? [s.map ? 'Lamp' : 'Map', 'map'] : ['Rewind', 'reel'];
    button(ctx, Tl.fork, 'Last fork', { icon: 'fork', size: 27, flash: flashOf(s, 'fork') });
    button(ctx, Tl.hint, 'Hint', { icon: 'bulb', size: 27, kind: 'accent', flash: flashOf(s, 'hint') });
    button(ctx, Tl.third, third[0], { icon: third[1], size: 27, active: fogged(P) && s.map, flash: flashOf(s, 'third') });
  }
  if (s.paused) drawPaused(ctx, s, L);
}

function coachBox(ctx, s, L, text) {
  const T = theme(), C = L.coachR;
  panel(ctx, C, { radius: 22, fill: T.dark ? 'rgba(255,214,170,0.08)' : 'rgba(60,40,10,0.06)' });
  const tr = L.coachText, pad = 20;
  let size = F(30), lines = wrap(ctx, text, tr.w - 2 * pad, size, 500);
  while (lines.length * size * 1.28 > tr.h - 2 * 12 && size > F(18)) { size -= 1; lines = wrap(ctx, text, tr.w - 2 * pad, size, 500); }
  const th = lines.length * size * 1.28;
  para(ctx, text, tr.x + pad, tr.y + Math.max(14, (tr.h - th) / 2), tr.w - 2 * pad, { size, weight: 500, color: T.text, lh: 1.28 });
}
function drawCoach(ctx, s, L) {
  const h = s.hint, B = L.coachBtns;
  coachBox(ctx, s, L, h.text);
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, h.stage === 'look' ? 'Show the way' : 'Hide thread', { size: 28, kind: 'accent', flash: flashOf(s, 'go') });
}
function drawAutoControls(ctx, s, L) {
  const a = s.auto, T = theme(), r = L.rail;
  const h = s.hint;
  coachBox(ctx, s, L, a.done ? 'The lamp is at the heart. That was every fork on the shortest way.' : h ? h.text : 'Walking on…');
  button(ctx, r.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, r.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', size: 26, kind: 'accent', flash: flashOf(s, 'apause') });
  button(ctx, r.dec, '', { icon: 'minus', size: 26, disabled: s.prefs.thinkIdx === 0, flash: flashOf(s, 'adec') });
  button(ctx, r.inc, '', { icon: 'plus', size: 26, disabled: s.prefs.thinkIdx === THINK_STEPS.length - 1, flash: flashOf(s, 'ainc') });
  const ly = Math.min(r.exit.y, r.dec.y) - 16;
  txt(ctx, `Think ${THINK_STEPS[s.prefs.thinkIdx]} s`, L.coachR.x + L.coachR.w - 22, ly, { size: F(21), weight: 600, color: T.dim, align: 'right', maxW: L.coachR.w * 0.45, min: 11 });
  if (a.phase === 'think' || a.phase === 'reveal') txt(ctx, a.phase === 'think' ? 'THINK' : 'REVEAL', L.coachR.x + 22, ly, { size: F(21), weight: 700, color: T.accent, align: 'left' });
  else if (a.phase === 'walk') txt(ctx, 'WALK', L.coachR.x + 22, ly, { size: F(21), weight: 700, color: T.dim, align: 'left' });
}

// ================================================================ title ==================================================================
function heroView(s, t) {
  const m = s.hero, route = routeOf(m), n = route.length - 1, cyc = t % 17;
  let u = cyc < 10 ? cyc / 10 : cyc < 12.5 ? 1 : 1 - (cyc - 12.5) / 4.5;
  u = clamp(u, 0, 1); const f = smooth(u) * n, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
  const a = centerOf(m, route[i]), b = centerOf(m, route[Math.min(n, i + 1)]), lamp = { x: a.x + (b.x - a.x) * fr, y: a.y + (b.y - a.y) * fr };
  const visited = new Array(m.cols * m.rows).fill(0); for (let k = 0; k <= i; k++) visited[route[k]] = 1;
  const V = makeView(m, { lamp, thread: threadPoints(m, route.slice(0, i + 1), lamp), visited, t, route: u >= 1 ? route : null, goalGlow: u >= 1 ? 2 : 1, night: 0.4 });
  V.cam = fitCam(m);
  return V;
}
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(170, Math.max(74, H * 0.3));
  const gs = Math.max(90, Math.min(hero.w * 0.86, H - tb - 14, 600)), x0 = hero.x + (hero.w - gs) / 2, y0 = hero.y + Math.max(0, (H - gs - tb) / 2) + 4;
  drawMaze(ctx, R(x0, y0, gs, gs), heroView(s, s.t));
  const ty = y0 + gs + tb * 0.5;
  txt(ctx, 'LABYRINTH', hero.x + hero.w / 2, ty, { size: tb * 0.5, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.96, min: 24, font: DISPLAY });
  txt(ctx, 'THREAD MAZE', hero.x + hero.w / 2, ty + tb * 0.4, { size: tb * 0.21, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13, font: DISPLAY });
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${GRADES[s.saved.grade].name}${s.saved.kind === 'daily' ? ' · Daily' : ''}  ·  ${fmtTime(s.saved.t)}` : ''],
    new: ['New Game', 'Six grades, a new maze every time'], daily: ['Daily Maze', s.dailyInfo],
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

// ================================================================ new game ===============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(44), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20, font: DISPLAY });
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

export const NEW_CARDS = ['daily', 1, 2, 3, 4, 5, 6];
function drawNew(ctx, s, w, h) {
  const T = theme(), NL = newLayout(w, h, NEW_CARDS.length);
  header(ctx, s, NL, 'New Game');
  scrollBody(ctx, s, NL.body, () => {
    NEW_CARDS.forEach((id, i) => {
      const r = NL.cards[i], isDaily = id === 'daily', lvl = isDaily ? s.dailyLevel : id, gi = GRADES[lvl], st = s.stats;
      const sel = !isDaily && id === s.prefs.grade;
      panel(ctx, r, { radius: 22, fill: isDaily ? rgba(T.accent, 0.14) : T.panel, line: sel ? T.accent : T.line });
      if (sel) { rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      txt(ctx, isDaily ? 'Daily Maze' : gi.name, r.x + 24, r.y + 32, { size: F(36), weight: 700, color: T.text, maxW: r.w * 0.55, min: 20, font: DISPLAY });
      txt(ctx, isDaily ? `${gi.name} today · streak ${s.streak}` : `${gi.n} by ${gi.n}  ·  ${gi.tag}`, r.x + 24, r.y + 64, { size: F(21), weight: 600, color: T.accent, maxW: r.w * 0.6, min: 12 });
      para(ctx, isDaily ? 'The same maze for everyone, new every day.' : gi.text, r.x + 24, r.y + 80, r.w - 48 - (r.w > 520 ? 150 : 0), { size: F(r.h < 135 ? 19 : 22), weight: 400, color: T.dim, lh: 1.15 });
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
    txt(ctx, page.title, x, y + 26 * sc, { size: F(36) * sc, weight: 700, color: T.accent, maxW: width, min: 16, font: DISPLAY }); y += 26 * sc + 30 * sc;
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
        const fh = Math.min(textR.w, Math.max(300, textR.h * (sc > 1.6 ? 0.45 : 0.62)), 640), fr = R(textR.x + (textR.w - Math.min(textR.w, fh + 20)) / 2, y, Math.min(textR.w, fh + 20), fh + (page.fig === 'grades' ? 36 : 0));
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
    const cols = lw > 760 ? 4 : 2, tiles = [['Mazes solved', total], ['Daily streak', s.streak], ['Best streak', st.bestStreak], ['Dailies solved', st.days.length]];
    const th = 110 * Math.min(sc, 1.8), g = 12, tw = (lw - g * (cols - 1)) / cols;
    tiles.forEach(([l, v], i) => {
      const tr = R(x + (i % cols) * (tw + g), y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(46) * Math.min(sc, 1.6), weight: 700, color: T.text });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(22) * Math.min(sc, 1.6), weight: 400, color: T.dim, maxW: tw - 30, min: 11 });
    });
    y += Math.ceil(tiles.length / cols) * (th + g) + 10;
    txt(ctx, 'By grade', x, y + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent, font: DISPLAY }); y += 50 * sc;
    for (let l = 1; l <= 6; l++) {
      const rh = 76 * Math.min(sc, 1.8), rr2 = R(x, y, lw, rh);
      panel(ctx, rr2, { radius: 16 });
      txt(ctx, GRADES[l].name, x + 20, y + rh / 2, { size: F(28) * Math.min(sc, 1.6), weight: 600, color: T.text, maxW: lw * 0.3, min: 13 });
      txt(ctx, `${st.solved[l]} solved`, x + lw * 0.42, y + rh / 2, { size: F(24) * Math.min(sc, 1.6), weight: 400, color: T.dim, maxW: lw * 0.25, min: 12 });
      txt(ctx, st.best[l] ? `best ${fmtTime(st.best[l])}` : 'no time yet', x + lw - 20, y + rh / 2, { size: F(24) * Math.min(sc, 1.6), weight: 500, color: T.text, align: 'right', maxW: lw * 0.36, min: 12 });
      y += rh + 8;
    }
    const leftEnd = y;
    let cx = x, cw = lw, cy;
    if (wide) { cx = x + lw + gapC; cw = r.w - lw - gapC; cy = r.y; } else { y += 14; cy = y; }
    txt(ctx, 'Last five weeks', cx, cy + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent, font: DISPLAY }); cy += 50 * sc;
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
  if (!R0 || !s.P) return;
  const P = s.P, m = P.maze, route = routeOf(m);
  const V = makeView(m, { lamp: centerOf(m, m.goal), thread: threadPoints(m, P.stack, centerOf(m, m.goal)), visited: P.visited, route, t: s.t, goalGlow: 2.5, night: 0.3 });
  V.cam = fitCam(m);
  drawMaze(ctx, O.board.rect, V);
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 38 : 50;
    txt(ctx, R0.daily ? 'Daily Maze solved' : 'The heart', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * Math.min(sc, 1.2), weight: 700, color: T.text, align: 'center', maxW: body.w - 24, min: 22, font: DISPLAY }); y += (tsz + 12) * Math.min(sc, 1.2);
    const sz = compact ? 36 : 52;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = [['Time', fmtTime(R0.time)], ['Steps', R0.steps], ['Shortest', R0.opt], ['Hints', R0.hints]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 82) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * Math.min(sc, 1.6), weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 14 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * Math.min(sc, 1.6), weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    y += para(ctx, R0.wasted ? `${R0.wasted} steps went into dead ends and detours. The gold thread is the shortest way.` : 'No wasted steps. The gold thread is the shortest way, and you took it.', body.x, y, body.w, { size: F(24) * sc, weight: 500, color: T.dim, align: 'center' }) + 8;
    if (R0.newBest) { txt(ctx, 'New best time for this grade', body.x + body.w / 2, y + 16, { size: F(26) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) { y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8; }
    return y - body.y + 10;
  });
  button(ctx, O.btns.next, R0.daily ? 'Back to menu' : 'Next maze', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.daily ? 'New game' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(36), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18, font: DISPLAY });
  para(ctx, 'The full game has all six grades, the Daily Maze, hints and Watch and Learn. Get Labyrinth Thread Maze on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
