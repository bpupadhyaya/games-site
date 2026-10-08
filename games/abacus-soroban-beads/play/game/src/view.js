// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, lessonCardH, levelCardH, statsLayout, overLayout, pageLayout, centerCard, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, background, panel, button, rr, txt, para, paraHeight, F, mix, rgba, icons, UI, setFont, wrap } from './ui.js';
import { setBrandTone, drawCredit, edgeStroke, drawMoreLine } from './brand.js';
import { drawAbacus, drawFigure, posOf } from './art.js';
import { abacusGeo } from './layout.js';
import { digitsOf, valueOf } from './soroban.js';
import { DOCS } from './content.js';
import { LESSONS, FLASH_LEVELS, SPRINT_LEVELS } from './lessons.js';
import { SETTINGS, settingIndex } from './prefs.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);

export function render(ctx, s, view, H) {
  const w = view.width, h = view.height, T = theme();
  background(ctx, w, h, s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  ctx.save();
  if (s.shake > 0 && sc === 'play') ctx.translate(Math.sin(s.shake * 70) * 7 * s.shake, 0);
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h, H);
  else if (sc === 'lessons') drawLessons(ctx, s, w, h);
  else if (sc === 'levels') drawLevels(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  ctx.restore();
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ title ===============================================================
const HERO = [12345, 60789, 24680, 98765, 31415];
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h), hero = L.hero; setBrandTone(T.dark);
  const H0 = hero.h, tb = Math.min(160, Math.max(70, H0 * 0.27));
  const ab = R(hero.x, hero.y, hero.w, Math.max(120, H0 - tb - 8));
  const g = abacusGeo(ab, 5, false), per = 2.8, k = Math.floor(s.t / per), f = (s.t / per) % 1;
  const a = digitsOf(HERO[k % HERO.length], 5), b = digitsOf(HERO[(k + 1) % HERO.length], 5);
  const A = { rods: 5, d: a, hp: [], ep: [], glow: [0, 0, 0, 0, 0], sel: -1 };
  for (let r = 0; r < 5; r++) {
    const pa = posOf(a[r]), pb = posOf(b[r]), e = smooth(clamp((f - 0.55 - (4 - r) * 0.035) / 0.22, 0, 1)), lerp = (x, y) => x + (y - x) * e;
    A.hp.push(lerp(pa.hp, pb.hp)); A.ep.push(pa.ep.map((v, i) => lerp(v, pb.ep[i])));
  }
  const appear = smooth(clamp(s.sceneT * 2.2, 0, 1));
  ctx.save(); ctx.globalAlpha = appear; ctx.translate(0, (1 - appear) * 20);
  drawAbacus(ctx, g, A, T, { t: s.t });
  ctx.restore();
  const ty = hero.y + H0 - tb * 0.46;
  txt(ctx, 'ABACUS', hero.x + hero.w / 2, ty - tb * 0.1, { size: tb * 0.6, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.94, min: 24 });
  txt(ctx, 'SOROBAN', hero.x + hero.w / 2, ty + tb * 0.34, { size: tb * 0.25, weight: 700, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13 });
  const B = L.buttons, done = LESSONS.filter((l) => (s.stats.lessons[l.id]?.stars ?? 0) > 0).length;
  const lab = {
    lessons: ['Lessons', `${done} of ${LESSONS.length} lessons started`], flash: ['Flash Mental', 'See the numbers in your mind'], sprint: ['Timed Challenge', '60 seconds of quick sums'],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Progress', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(B)) {
    const prim = id === 'lessons' || id === 'flash' || id === 'sprint';
    button(ctx, B[id], lab[id][0], { kind: id === 'lessons' ? 'accent' : 'solid', size: prim ? 34 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ play ===============================================================
function fitPara(ctx, text, r, { size = 28, min = 15, weight = 500, color, align = 'left', lh = 1.28, top = false } = {}) {
  let sz = size;
  while (sz > min && paraHeight(ctx, text, r.w, sz, weight, lh) > r.h) sz -= 1;
  const th = paraHeight(ctx, text, r.w, sz, weight, lh);
  para(ctx, text, r.x, top ? r.y : r.y + Math.max(0, (r.h - th) / 2), r.w, { size: sz, weight, color, align, lh });
}
const sign = (n) => (n < 0 ? '− ' : '+ ') + Math.abs(n);

function drawPlay(ctx, s, w, h, H) {
  const T = theme(), sc = scaleOf(s), r = s.run, a = s.auto;
  const ex = r && r.kind === 'lesson' ? H.curEx() : null;
  const L = playLayout(w, h, { rods: s.ab.rods, choices: ex && ex.read ? ex.read.options.length : 0 });
  setBrandTone(T.dark);
  // header
  button(ctx, L.menu, 'Menu', { icon: 'back', size: 24, flash: flashOf(s, 'menu'), radius: 16 });
  button(ctx, L.pause, '', { icon: (s.paused || a.paused) ? 'play' : 'pause', size: 30, flash: flashOf(s, 'pause'), radius: 16, active: s.paused || a.paused });
  const title = a.on ? 'Watch and Learn' : !r ? '' : r.kind === 'lesson' ? 'Lesson' : r.kind === 'flash' ? `Flash ${r.level + 1}` : `Challenge ${r.level + 1}`;
  txt(ctx, title, L.title.x + L.title.w / 2, L.title.y, { size: F(30), weight: 700, color: T.text, align: 'center', maxW: L.title.w, min: 14 });
  // task card
  const tc = L.task; panel(ctx, tc, { radius: 22, line: s.accept ? T.good : T.line });
  if (s.accept) { rr(ctx, tc.x, tc.y, tc.w, tc.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = T.good; ctx.stroke(); }
  drawTask(ctx, s, L, ex, H);
  // abacus
  const hl = s.ab.hl ?? (s.hint && s.hint.rod >= 0 ? { rod: s.hint.rod, part: 'rod' } : null);
  drawAbacus(ctx, L.geo, s.ab, T, { labels: s.prefs.digits, t: s.t, hl, locked: !!(a.on || s.paused) });
  // coach card
  drawCoach(ctx, s, L, ex, H, sc);
  drawButtons(ctx, s, L, ex);
  // sparks
  for (const sp of s.sparks) { const k = 1 - sp.t / sp.life; ctx.globalAlpha = Math.max(0, k); ctx.fillStyle = sp.c; ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r * (0.5 + k * 0.5), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (s.paused || (a.on && a.paused)) drawPaused(ctx, s, L, H);
  if (s.msg) {
    const mw = Math.min(L.geo.w, 560), mx = L.geo.x + (L.geo.w - mw) / 2, my = L.geo.y + 10;
    const hh = paraHeight(ctx, s.msg.text, mw - 40, F(24), 600) + 24;
    panel(ctx, R(mx, my, mw, hh), { radius: 16, fill: rgba(T.bg1, 0.92), line: T.accent }); para(ctx, s.msg.text, mx + 20, my + 12, mw - 40, { size: F(24), weight: 600, color: T.text, align: 'center' });
  }
}

function drawTask(ctx, s, L, ex, H) {
  const T = theme(), tc = L.task, r = s.run, a = s.auto, pad = 22;
  const cx = tc.x + tc.w / 2, big = clamp(tc.h * 0.42, 38, 72);
  if (a.on) {
    txt(ctx, `${a.flash ? 'Round' : 'Example'} ${Math.min(a.ei + 1, a.exs.length)} of ${a.exs.length}`, tc.x + pad, tc.y + 28, { size: F(22), weight: 600, color: T.accent, maxW: tc.w * 0.6, min: 12 });
    const fs = a.ex && a.ex.flashSeq, inShow = fs && a.phase === 'show', hide = fs && a.phase === 'think';
    const label = a.done ? (a.flash ? 'Round complete' : 'Tour complete') : inShow ? (a.fon ? sign(fs[a.show]) : '') : hide ? 'What is the total?' : a.op ? a.op.label : '';
    txt(ctx, label, cx, tc.y + tc.h * 0.58, { size: big, weight: 700, color: T.text, align: 'center', maxW: tc.w - 2 * pad, min: 20 });
    const ph = a.done ? '' : a.phase === 'show' ? 'WATCH' : a.phase === 'think' ? `THINK  ${Math.max(0, Math.ceil(a.timer))}s` : a.phase === 'reveal' ? 'REVEAL' : 'ACT';
    txt(ctx, ph, tc.x + tc.w - pad, tc.y + 28, { size: F(22), weight: 700, color: T.dim, align: 'right', maxW: tc.w * 0.35, min: 12 });
    return;
  }
  if (!r) return;
  if (r.kind === 'lesson') {
    txt(ctx, `${r.title}  ·  ${Math.min(r.idx + 1, r.exs.length)} of ${r.exs.length}`, tc.x + pad, tc.y + 28, { size: F(22), weight: 600, color: T.accent, maxW: tc.w - 2 * pad, min: 12 });
    const txtv = ex.read ? 'What number is this?' : ex.prompt && ex.ops.length > 1 ? ex.prompt : ex.ops[r.op].label;
    txt(ctx, txtv, cx, tc.y + tc.h * 0.56, { size: big, weight: 700, color: T.text, align: 'center', maxW: tc.w - 2 * pad, min: 20 });
    if (!ex.read && ex.ops.length > 1) txt(ctx, `Step ${r.op + 1} of ${ex.ops.length}:  ${ex.ops[r.op].label}`, cx, tc.y + tc.h - 24, { size: F(21), weight: 500, color: T.dim, align: 'center', maxW: tc.w - 2 * pad, min: 12 });
    else if (!ex.read && s.prefs.readout) txt(ctx, `Abacus shows ${valueOf(s.ab.d).toLocaleString('en-US')}`, cx, tc.y + tc.h - 24, { size: F(21), weight: 500, color: T.dim, align: 'center', maxW: tc.w - 2 * pad, min: 12 });
  } else if (r.kind === 'sprint') {
    const frac = clamp(r.time / 60, 0, 1), low = r.time < 10;
    txt(ctx, `Score ${r.score}`, tc.x + pad, tc.y + 28, { size: F(24), weight: 700, color: T.accent, maxW: tc.w * 0.4, min: 12 });
    txt(ctx, `${Math.ceil(r.time)}s`, tc.x + tc.w - pad, tc.y + 28, { size: F(26), weight: 700, color: low ? T.err : T.text, align: 'right', maxW: tc.w * 0.25, min: 12 });
    txt(ctx, r.task.label, cx, tc.y + tc.h * 0.46, { size: big, weight: 700, color: T.text, align: 'center', maxW: tc.w - 2 * pad, min: 20 });
    if (s.prefs.readout) txt(ctx, `Abacus shows ${valueOf(s.ab.d).toLocaleString('en-US')}`, cx, tc.y + tc.h - 40, { size: F(20), weight: 500, color: T.dim, align: 'center', maxW: tc.w - 2 * pad, min: 11 });
    const bar = R(tc.x + pad, tc.y + tc.h - 26, tc.w - 2 * pad, 10);
    rr(ctx, bar.x, bar.y, bar.w, bar.h, 5); ctx.fillStyle = 'rgba(128,128,128,0.25)'; ctx.fill();
    rr(ctx, bar.x, bar.y, Math.max(8, bar.w * frac), bar.h, 5); ctx.fillStyle = low ? T.err : T.accent; ctx.fill();
    if (r.streak > 1) txt(ctx, `Streak ${r.streak}`, cx, tc.y + 28, { size: F(21), weight: 600, color: T.good, align: 'center', maxW: tc.w * 0.3, min: 11 });
    if (r.last) { ctx.globalAlpha = 1 - r.last.t; txt(ctx, `+${r.last.pts}`, tc.x + tc.w - pad, tc.y + tc.h * 0.5 - r.last.t * 30, { size: big * 0.7, weight: 700, color: T.good, align: 'center', base: 'middle' }); ctx.globalAlpha = 1; }
  } else if (r.kind === 'flash') {
    txt(ctx, `Round ${Math.min(r.round + 1, 5)} of 5  ·  ${r.right} right`, tc.x + pad, tc.y + 28, { size: F(22), weight: 600, color: T.accent, maxW: tc.w - 2 * pad, min: 12 });
    let line = '', col = T.text, sz = big;
    if (r.phase === 'ready') { line = 'Get ready'; col = T.dim; sz = big * 0.8; }
    else if (r.phase === 'show') { if (r.on) { line = sign(r.seq[r.show]); sz = big * 1.5; } }
    else if (r.phase === 'answer') { line = 'Set the total'; sz = big * 0.9; }
    else if (r.phase === 'reveal') { line = r.lastOk ? `Right!  ${r.total}` : `It was ${r.total}`; col = r.lastOk ? T.good : T.err; }
    txt(ctx, line, cx, tc.y + tc.h * 0.56, { size: sz, weight: 700, color: col, align: 'center', maxW: tc.w - 2 * pad, min: 20 });
    if (r.phase === 'reveal') txt(ctx, r.seq.map((n, i) => (i === 0 ? String(n) : n < 0 ? `− ${-n}` : `+ ${n}`)).join('  '), cx, tc.y + tc.h - 24, { size: F(21), weight: 500, color: T.dim, align: 'center', maxW: tc.w - 2 * pad, min: 11 });
    else if (r.phase === 'show') { const n = r.seq.length; for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(cx + (i - (n - 1) / 2) * 22, tc.y + tc.h - 22, 6, 0, 7); ctx.fillStyle = i <= r.show ? T.accent : 'rgba(128,128,128,0.35)'; ctx.fill(); } }
  }
}

function drawCoach(ctx, s, L, ex, H, sc) {
  const T = theme(), c = L.coach, r = s.run, a = s.auto;
  if (ex && ex.read) {
    const opts = ex.read.options;
    opts.forEach((v, i) => {
      const q = L.choices[i], ok = r.readOk === i, bad = r.badPick === i && !s.accept;
      button(ctx, q, v.toLocaleString('en-US'), { size: 34, weight: 700, kind: ok ? 'accent' : 'solid', flash: flashOf(s, 'c' + i), radius: 16, active: bad });
      if (ok) icons.check(ctx, q.x + q.w - 30, q.y + q.h / 2, 28, T.onAccent);
    });
    return;
  }
  panel(ctx, c, { radius: 20 });
  let text = '', col = T.text;
  const pad = 18, area = R(c.x + pad, c.y + 10, c.w - 2 * pad - (s.hint ? 30 : 0), c.h - 20), sz = Math.min(F(30) * Math.min(sc, 1.6), 46);
  if (a.on) text = a.caption;
  else if (s.hint) { text = s.hint.text; col = T.text; }
  else if (r && r.kind === 'lesson') text = LESSONS.find((l) => l.id === r.id).blurb;
  else if (r && r.kind === 'flash') text = r.phase === 'answer' ? 'Set the total on the abacus, then tap Check.' : r.phase === 'reveal' ? (r.lastOk ? 'Nicely seen.' : `You set ${r.results[r.results.length - 1]?.said ?? 0}.`) : 'Keep the running total in your head. The beads stay still.';
  else if (r && r.kind === 'sprint') text = `Level ${r.level + 1}  ·  best ${s.stats.sprintBest[r.level]}.  Tasks work on the running total: just keep going.`;
  fitPara(ctx, text, area, { size: sz, min: 18, weight: 500, color: col });
  if (s.hint) icons.bulb(ctx, c.x + c.w - 24, c.y + 22, 24, T.accent);
}

function drawButtons(ctx, s, L, ex) {
  const T = theme(), r = s.run, a = s.auto, b = L.b;
  if (a.on) {
    button(ctx, b[0], a.done ? 'Again' : a.paused ? 'Resume' : 'Pause', { icon: a.done ? 'play' : a.paused ? 'play' : 'pause', size: 26, kind: 'accent', flash: flashOf(s, 'b0'), radius: 16 });
    button(ctx, b[1], 'Next', { icon: 'skip', size: 26, flash: flashOf(s, 'b1'), radius: 16, disabled: a.done });
    button(ctx, b[2], 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'b2'), radius: 16 });
    return;
  }
  if (!r) return;
  if (r.kind === 'flash') {
    button(ctx, b[0], 'Clear', { icon: 'reset', size: 26, flash: flashOf(s, 'b0'), radius: 16, disabled: r.phase !== 'answer' });
    const wide = R(b[1].x, b[1].y, b[2].x + b[2].w - b[1].x, b[1].h);
    button(ctx, wide, 'Check', { icon: 'check', size: 30, kind: 'accent', flash: flashOf(s, 'b1') + flashOf(s, 'b2'), radius: 16, disabled: r.phase !== 'answer' });
    return;
  }
  const readMode = ex && ex.read;
  button(ctx, b[0], r.kind === 'sprint' ? 'Hint -3s' : 'Hint', { icon: 'hint', size: 26, flash: flashOf(s, 'b0'), radius: 16, disabled: readMode });
  button(ctx, b[1], 'Reset', { icon: 'reset', size: 26, flash: flashOf(s, 'b1'), radius: 16, disabled: readMode });
  button(ctx, b[2], r.kind === 'sprint' ? 'Skip -3s' : 'Skip', { icon: 'skip', size: 26, flash: flashOf(s, 'b2'), radius: 16 });
}

function drawPaused(ctx, s, L, H) {
  const T = theme(), g = L.geo;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, g.x, g.y, g.w, g.h, g.slot * 0.5); ctx.fill();
  if (s.auto.on) { txt(ctx, 'Paused', g.x + g.w / 2, g.y + g.h / 2, { size: F(54), weight: 700, color: '#fff', align: 'center' }); return; }
  const p = H.pauseCard(L);
  panel(ctx, p.card, { radius: 24, fill: rgba(T.bg1, 0.96), line: T.line });
  txt(ctx, 'Paused', p.card.x + p.card.w / 2, p.card.y + 48, { size: F(38), weight: 700, color: T.text, align: 'center' });
  button(ctx, p.resume, 'Resume', { icon: 'play', size: 28, kind: 'accent', flash: flashOf(s, 'resume'), radius: 16 });
  button(ctx, p.menu, 'Leave', { icon: 'exit', size: 26, radius: 16 });
}

// ================================================================ lists ===================================================================
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
function starRow(ctx, x, y, size, n, lit) {
  const T = theme();
  for (let i = 0; i < n; i++) icons.star(ctx, x + i * size * 1.05, y, size, i < lit ? T.accent : 'rgba(128,128,128,0.4)');
}
function drawLessons(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), LL = listLayout(w, h, LESSONS.length, lessonCardH(sc));
  header(ctx, s, LL, 'Lessons');
  scrollBody(ctx, s, LL.body, () => {
    LESSONS.forEach((les, i) => {
      const r = LL.cards[i], st = s.stats.lessons[les.id]?.stars ?? 0;
      panel(ctx, r, { radius: 22, line: st >= 3 ? T.accent : T.line });
      rr(ctx, r.x + 16, r.y + 16, 46, 46, 14); ctx.fillStyle = rgba(T.accent, 0.18); ctx.fill();
      txt(ctx, String(i + 1), r.x + 39, r.y + 40, { size: F(26), weight: 700, color: T.accent, align: 'center' });
      txt(ctx, les.title, r.x + 78, r.y + 30, { size: F(30) * Math.min(sc, 1.5), weight: 700, color: T.text, maxW: r.w - 78 - 130, min: 16 });
      txt(ctx, les.tag, r.x + 78, r.y + 30 + 30 * Math.min(sc, 1.5), { size: F(21) * Math.min(sc, 1.5), weight: 600, color: T.accent, maxW: r.w - 78 - 20, min: 12 });
      const by = r.y + 30 + 48 * Math.min(sc, 1.5);
      fitPara(ctx, les.blurb, R(r.x + 78, by, r.w - 78 - 20, r.y + r.h - 10 - by), { size: F(19) * Math.min(sc, 1.5), min: 11.5, weight: 400, color: T.dim, lh: 1.15, top: true });
      starRow(ctx, r.x + r.w - 110, r.y + 32, 30, 3, st);
    });
    return LL.contentH;
  });
  button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function drawLevels(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), flashMode = s.levelsFor === 'flash', LV = flashMode ? FLASH_LEVELS : SPRINT_LEVELS, LL = listLayout(w, h, 5, levelCardH(sc));
  header(ctx, s, LL, flashMode ? 'Flash Mental' : 'Timed Challenge');
  scrollBody(ctx, s, LL.body, () => {
    LV.forEach((lv, i) => {
      const r = LL.cards[i], best = flashMode ? s.stats.flashBest[i] : s.stats.sprintBest[i], sel = (flashMode ? s.prefs.flashLevel : s.prefs.sprintLevel) === i;
      panel(ctx, r, { radius: 22, line: sel ? T.accent : T.line });
      txt(ctx, lv.name, r.x + 24, r.y + 36, { size: F(34) * Math.min(sc, 1.5), weight: 700, color: T.text, maxW: r.w * 0.5, min: 16 });
      para(ctx, lv.tag, r.x + 24, r.y + 36 + 26 * Math.min(sc, 1.5), r.w - 48 - 160, { size: F(22) * Math.min(sc, 1.5), weight: 500, color: T.dim, lh: 1.15 });
      txt(ctx, flashMode ? (best ? `${best} / 5` : '–') : (best ? String(best) : '–'), r.x + r.w - 24, r.y + 40, { size: F(32), weight: 700, color: T.accent, align: 'right' });
      txt(ctx, flashMode ? 'best session' : 'best score', r.x + r.w - 24, r.y + 72, { size: F(19), weight: 400, color: T.dim, align: 'right', maxW: 150, min: 11 });
    });
    return LL.contentH;
  });
  if (flashMode) { button(ctx, LL.back2, 'Back', { icon: 'back', size: 28, flash: flashOf(s, 'back') }); button(ctx, LL.watch, 'Watch', { icon: 'eye', size: 28, flash: flashOf(s, 'watch') }); }
  else button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
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
    if (page.fig) drawFigure(ctx, R(figR.x, figR.y, figR.w, Math.min(figR.h, figR.w * 1.1)), page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w * 0.95, Math.max(260, textR.h * (sc > 1.6 ? 0.4 : 0.55)), 560), fr = R(textR.x + (textR.w - Math.min(textR.w, fh)) / 2, y, Math.min(textR.w, fh), fh);
        drawFigure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings / stats ===========================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = settingsLayout(w, h, sc, SETTINGS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    SETTINGS.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s.prefs, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  if (s.msg) { para(ctx, s.msg.text, SL.body.x, SL.footer.y - 34, SL.body.w, { size: F(22), weight: 600, color: T.accent, align: 'center' }); }
}
function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = statsLayout(w, h), st = s.stats;
  header(ctx, s, SL, 'Progress');
  const stars = LESSONS.reduce((a, l) => a + (st.lessons[l.id]?.stars ?? 0), 0);
  scrollBody(ctx, s, SL.body, () => {
    let y = SL.body.y;
    const row = (label, value) => {
      const r = R(SL.body.x, y, SL.body.w, 72 * Math.min(sc, 1.6)); panel(ctx, r, { radius: 18 });
      txt(ctx, label, r.x + 22, r.y + r.h / 2, { size: F(26) * Math.min(sc, 1.6), weight: 500, color: T.text, maxW: r.w * 0.62, min: 13 });
      txt(ctx, value, r.x + r.w - 22, r.y + r.h / 2, { size: F(28) * Math.min(sc, 1.6), weight: 700, color: T.accent, align: 'right', maxW: r.w * 0.35, min: 13 });
      y += r.h + 10;
    };
    row('Lesson stars', `${stars} of ${LESSONS.length * 3}`);
    row('Sessions played', String(st.sessions));
    row('Beads moved', String(st.beads));
    FLASH_LEVELS.forEach((l, i) => row(`Flash Mental ${l.name} best`, st.flashBest[i] ? `${st.flashBest[i]} / 5` : '–'));
    SPRINT_LEVELS.forEach((l, i) => row(`Challenge ${l.name} best`, st.sprintBest[i] ? String(st.sprintBest[i]) : '–'));
    return y - SL.body.y;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ result ==================================================================
function drawOver(ctx, s, w, h) {
  const T = theme(), O = overLayout(w, h), R0 = s.result; setBrandTone(T.dark);
  const need = (R0.kind === 'lesson' ? 290 : 440) + R0.lines.length * 52 * (1 + (scaleOf(s) - 1) * 0.5), ch = Math.min(O.card.h, need), c = { ...O.card, h: ch, y: O.card.y + (O.card.h - ch) / 2 };
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.45);
  const cx = c.x + c.w / 2, k = smooth(clamp(s.sceneT * 2, 0, 1));
  txt(ctx, R0.title, cx, c.y + 54, { size: F(32), weight: 700, color: T.accent, align: 'center', maxW: c.w - 40, min: 16 });
  const ss = Math.min(78, c.w * 0.14);
  for (let i = 0; i < 3; i++) { const lit = i < R0.stars, sz = ss * (lit ? 0.7 + 0.3 * smooth(clamp(s.sceneT * 2.2 - i * 0.3, 0, 1)) : 0.85); icons.star(ctx, cx + (i - 1) * ss * 1.15, c.y + 54 + ss * 0.95, sz, lit ? T.accent : 'rgba(128,128,128,0.4)'); }
  let y = c.y + 54 + ss * 1.9;
  if (R0.kind !== 'lesson') {
    txt(ctx, R0.kind === 'sprint' ? String(Math.round(R0.score * k)) : `${R0.score} / ${R0.outOf}`, cx, y + 40, { size: Math.min(110, c.h * 0.2), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 30 });
    y += 100;
    if (R0.newBest) txt(ctx, 'New best!', cx, y, { size: F(34), weight: 700, color: T.good, align: 'center' }), y += 44;
    else if (R0.kind === 'sprint') txt(ctx, `Best ${R0.best}`, cx, y, { size: F(26), weight: 500, color: T.dim, align: 'center' }), y += 44;
  } else y += 10;
  for (const ln of R0.lines) y += para(ctx, ln, c.x + 30, y, c.w - 60, { size: F(26), weight: 500, color: T.text, align: 'center' }) + 10;
  const nxt = R0.kind === 'lesson' ? (R0.stars > 0 ? 'Next lesson' : 'Try again') : 'Play again';
  button(ctx, O.btns.next, nxt, { kind: 'accent', size: 32, icon: 'play', flash: flashOf(s, 'next'), radius: 18 });
  button(ctx, O.btns.share, 'Share', { size: 26, flash: flashOf(s, 'share'), radius: 18 });
  button(ctx, O.btns.menu, 'Back', { size: 26, icon: 'back', flash: flashOf(s, 'menu'), radius: 18 });
  drawMoreLine(ctx, O.more.x, O.more.y, 14);
}
function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has all 13 lessons, Flash Mental, the Timed Challenge and Watch and Learn. Get Abacus Soroban on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
