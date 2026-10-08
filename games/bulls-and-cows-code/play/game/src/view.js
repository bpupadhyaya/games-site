// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, pageLayout, centerCard, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, paraHeight, wrap, setFont, F, mix, rgba, icons, UI } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { GRADES, scoreA, classify, fbB, fbC } from './engine.js';
import { DOCS } from './content.js';
import { peg, hole, pip, lid, clue, PEG } from './art.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'hand', label: 'Panel side (wide screens)', opts: ['Right', 'Left'] },
  { id: 'coach', label: 'Coach', opts: ['Off', 'Warn', 'Full'] },
  { id: 'autoScore', label: 'Score for me (Set)', opts: ['Off', 'On'] },
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
    case 'coach': return ['off', 'warn', 'full'].indexOf(p.coach);
    case 'autoScore': return p.autoScore ? 1 : 0;
    case 'timer': return p.timer ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
export const newCards = (role) => (role === 'set' ? [1, 2, 3, 4, 5] : ['daily', 1, 2, 3, 4, 5]);
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const backOut = (t) => { const c = 1.70158; t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
const DISPLAY = 'Cinzel, Fredoka, Georgia, serif';
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

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
// One rail of holes with pegs. `pegs`: digits (-1 empty). `anim`: function(k) -> {scale, ghost}.
function drawRail(ctx, B, cy, pegs, { pop = null, hot = -1, ring = null, dim = 0, lids = false, lidOpen = 0, d = B.d, lift = null, bump = 0 } = {}) {
  for (let k = 0; k < B.len; k++) {
    const cx = B.slot(k);
    hole(ctx, cx, cy, d * 1.06, { hot: k === hot });
    const dg = pegs ? pegs[k] : -1;
    if (dg >= 0) {
      const pv = pop ? pop(k) : 1;
      if (pv > 0) peg(ctx, cx, cy, d, dg, { scale: pop ? backOut(pv) * (1 + bump) : 1 + bump, dim, ring: ring ? ring(k) : null, lift: lift ? lift(k) : 0 });
    }
    if (lids) lid(ctx, cx, cy, d * 1.02, clamp(lidOpen * 1.5 - k * 0.12, 0, 1));
  }
}

function hintSets(s) {
  const h = s.hint ?? (s.auto.on && s.auto.phase ? s.auto.fact : null);
  return h ? { rows: new Set(h.rows ?? []), digits: new Set(h.digits ?? []), pos: h.pos ?? -1 } : null;
}

function drawBoard(ctx, s, L) {
  const T = theme(), P = s.P, B = L.board, g = GRADES[P.gid], len = g.len, tries = B.tries, hs = hintSets(s), calm = s.prefs.calm;
  const cur = Math.min(tries - 1, P.role === 'set' ? (P.phase === 'score' ? P.rows.length - 1 : P.rows.length) : P.rows.length);
  // tray
  const top = B.secretY - 10, bot = B.rowY(B.first + B.count - 1) + B.rowH + 10, tx = B.x0 - 14, tw = B.rowW + 28;
  rr(ctx, tx - 6, top - 6, tw + 12, bot - top + 12, 30); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  const tg = ctx.createLinearGradient(0, top, 0, bot); tg.addColorStop(0, mix(T.tray, '#ffffff', T.dark ? 0.06 : 0.05)); tg.addColorStop(1, mix(T.tray, '#000000', 0.25));
  rr(ctx, tx, top, tw, bot - top, 26); ctx.fillStyle = tg; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = mix(T.rim, '#000000', 0.45); ctx.stroke();
  ctx.lineWidth = 2.4; ctx.strokeStyle = T.rim; rr(ctx, tx + 1, top + 1, tw - 2, bot - top - 2, 25); ctx.stroke();
  ctx.save(); rr(ctx, tx, top, tw, bot - top, 26); ctx.clip();
  // secret row
  const sy = B.secretMid, secretPlate = R(B.x0 - 2, B.secretY, B.rowW + 4, B.secretH);
  rr(ctx, secretPlate.x, secretPlate.y, secretPlate.w, secretPlate.h, 18); const sg = ctx.createLinearGradient(0, secretPlate.y, 0, secretPlate.y + secretPlate.h); sg.addColorStop(0, rgba(T.plate, 0.34)); sg.addColorStop(1, rgba(T.plate, 0.14)); ctx.fillStyle = sg; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(T.plate, 0.7); ctx.stroke();
  const yourCode = P.role === 'set';
  txt(ctx, yourCode ? 'YOUR' : 'CODE', B.x0 + B.idxW / 2 + 2, sy - (yourCode ? 9 : 0), { size: F(Math.min(19, B.rowH * 0.3)), weight: 700, color: T.accent, align: 'center', maxW: B.idxW + 10, min: 11 });
  if (yourCode) txt(ctx, 'CODE', B.x0 + B.idxW / 2 + 2, sy + 11, { size: F(Math.min(19, B.rowH * 0.3)), weight: 700, color: T.accent, align: 'center', maxW: B.idxW + 10, min: 11 });
  const entry = P.role === 'set' && P.phase === 'secret';
  const secretPegs = entry ? P.cur : P.secret;
  const revealed = P.role === 'set' || P.done || (s.auto.on && s.auto.done);
  const sx = entry && s.fx.shake < 90 ? Math.sin(s.fx.shake * 60) * 8 * (1 - s.fx.shake / 0.5) : 0;
  ctx.save(); ctx.translate(sx, 0);
  drawRail(ctx, B, sy, secretPegs, { hot: entry ? s.sel : -1, lids: !revealed || (P.done && s.fx.lid < 1 && P.role !== 'set'), lidOpen: revealed ? s.fx.lid : 0, pop: (k) => (entry ? popOf(s, k) : 1), calm });
  ctx.restore();
  if (!revealed) { /* closed lids hide the pegs */ }
  // legend in the secret row's clue zone
  const lg = B.secretFb, ls = Math.min(17, lg.h * 0.2), lx = lg.x + 18;
  if (lg.w >= 110) {
    pip(ctx, lx + 2, lg.y + lg.h * 0.32, ls * 1.15, 'bull'); txt(ctx, 'right place', lx + ls * 1.2 + 6, lg.y + lg.h * 0.32, { size: F(Math.min(19, lg.h * 0.24)), weight: 500, color: T.dim, maxW: lg.w - ls * 1.4 - 22, min: 11 });
    pip(ctx, lx + 2, lg.y + lg.h * 0.68, ls * 1.15, 'cow'); txt(ctx, 'wrong place', lx + ls * 1.2 + 6, lg.y + lg.h * 0.68, { size: F(Math.min(19, lg.h * 0.24)), weight: 500, color: T.dim, maxW: lg.w - ls * 1.4 - 22, min: 11 });
  }
  // rows
  const first = B.first, last = first + B.count - 1;
  for (let i = first; i <= last; i++) {
    const rect = B.rowRect(i), cy = rect.y + rect.h / 2, row = P.rows[i], isCur = i === cur && !P.done && !(P.role === 'set' && (P.phase === 'secret'));
    const hot = hs && hs.rows.has(i);
    if (isCur) {
      rr(ctx, rect.x - 2, rect.y + 2, rect.w + 4, rect.h - 4, 16); ctx.fillStyle = rgba(T.accent, 0.1 + (calm ? 0 : 0.04 * Math.sin(s.t * 3))); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(T.accent, 0.55); ctx.stroke();
    } else if (hot) { rr(ctx, rect.x - 2, rect.y + 2, rect.w + 4, rect.h - 4, 16); ctx.fillStyle = rgba(T.cow, 0.12); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(T.cow, 0.9); ctx.stroke(); }
    txt(ctx, String(i + 1), B.x0 + B.idxW / 2, cy, { size: F(Math.min(26, rect.h * 0.38)), weight: 700, color: isCur ? T.accent : T.dim, align: 'center' });
    if (row) {
      const bump = row.t < 0.3 ? 0.1 * Math.sin((row.t / 0.3) * Math.PI) : 0;
      const ring = hot && hs.digits.size ? (k) => (hs.digits.has(row.g[k]) ? T.cow : null) : null;
      const markUp = P.role === 'set' && row.fb < 0 && P.show ? classify(P.secret, row.g) : null;
      drawRail(ctx, B, cy, row.g, { bump: calm ? 0 : bump, ring: markUp ? (k) => (markUp[k] === 'bull' ? T.bull : markUp[k] === 'cow' ? T.cow : null) : ring, pop: row.fb < 0 && row.t < 90 ? (k) => popOf(s, k) : null });
      if (row.fb >= 0) clue(ctx, B.fb(i), row.fb, len, row.t);
      else {
        const f = B.fb(i), dots = 1 + Math.floor((s.t * 2.5) % 3);
        txt(ctx, P.phase === 'score' ? 'Score it' : '', f.x + f.w / 2, cy, { size: F(Math.min(24, rect.h * 0.34)), weight: 600, color: T.accent, align: 'center', maxW: f.w - 10, min: 11 });
        void dots;
      }
    } else if (isCur && P.role !== 'set') {
      const sx2 = s.fx.shake < 90 ? Math.sin(s.fx.shake * 60) * 8 * (1 - s.fx.shake / 0.5) : 0;
      ctx.save(); ctx.translate(sx2, 0);
      drawRail(ctx, B, cy, P.cur, { hot: s.sel, pop: (k) => popOf(s, k), ring: hs && hs.pos >= 0 ? (k) => (k === hs.pos ? T.cow : null) : null });
      ctx.restore();
      if (s.warn >= 0 && s.prefs.coach !== 'off') { txt(ctx, '!', B.fb(i).x + B.fb(i).w / 2, cy, { size: F(34), weight: 800, color: T.err, align: 'center' }); }
    } else {
      drawRail(ctx, B, cy, null, { hot: -1 });
      if (isCur && P.role === 'set' && P.phase === 'think') {
        const dots = '.'.repeat(1 + Math.floor((s.t * 3) % 3));
        txt(ctx, `thinking${dots}`, B.x0 + B.rowW / 2, cy, { size: F(Math.min(30, rect.h * 0.42)), weight: 600, color: T.accent, align: 'center' });
      }
    }
    // hand-drawn "hot" slot in a pending row
    if (row && row.fb < 0 && P.show) { /* rings drawn through markUp */ }
  }
  // reveal flourish on a win: gold sweep along the secret row
  if (P.done && P.won && s.winT > 0) {
    const a = clamp(s.winT / 3.2, 0, 1);
    rr(ctx, secretPlate.x, secretPlate.y, secretPlate.w, secretPlate.h, 18); ctx.fillStyle = rgba(T.bull, 0.18 * a); ctx.fill();
  }
  ctx.restore();
  // sparks
  for (const sp of s.sparks) { ctx.globalAlpha = clamp(1 - sp.t / sp.life, 0, 1); ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, 7); ctx.fillStyle = sp.c; ctx.fill(); }
  ctx.globalAlpha = 1;
}
function popOf(s, k) { const v = s.fx.pop[k]; if (v === undefined || v >= 90) return 1; if (s.prefs.calm) return v < 0 ? 0 : 1; return v < 0 ? 0 : clamp(v / 0.3, 0.001, 1.2); }

function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P;
  const mode = P.role === 'auto' ? 'auto' : s.hint ? 'coach' : P.role === 'set' ? (P.phase === 'secret' ? 'secret' : P.phase === 'score' ? 'score' : 'wait') : 'break';
  const tries = P.role === 'set' ? GRADES[P.gid].ctries : GRADES[P.gid].tries;
  const cur = Math.max(0, Math.min(tries - 1, P.role === 'set' ? (P.phase === 'score' ? P.rows.length - 1 : P.rows.length) : P.rows.length));
  const L = playLayout(w, h, { tries, len: GRADES[P.gid].len, cur, mode, hand: s.prefs.hand, scale: scaleOf(s) });
  setBrandTone(T.dark);
  if (L.wide) drawSide(ctx, s, L);
  drawBoard(ctx, s, L);
  drawHud(ctx, s, L, mode);
  const dimmed = s.paused;
  if (dimmed) ctx.save();
  if (dimmed) ctx.globalAlpha = 0.3;
  if (P.role === 'auto') drawAutoCard(ctx, s, L);
  else if (mode === 'coach') drawCoach(ctx, s, L);
  else if (mode === 'score') drawScore(ctx, s, L);
  else if (mode === 'wait') drawWait(ctx, s, L);
  else drawControls(ctx, s, L, mode);
  if (dimmed) ctx.restore();
  if (s.paused) drawPaused(ctx, s, L);
  drawMsg(ctx, s, L);
}

function drawSide(ctx, s, L) {
  const T = theme(), r = L.side;
  panel(ctx, r, { radius: 28, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.2 : 0.35) });
  edgeStroke(ctx, r, 28, 0.4);
}

function drawHud(ctx, s, L, mode) {
  const T = theme(), P = s.P, g = GRADES[P.gid], tries = P.role === 'set' ? g.ctries : g.tries, n = P.role === 'set' ? (P.phase === 'score' ? P.rows.length : P.rows.length + (P.phase === 'think' ? 1 : 0)) : Math.min(tries, P.rows.length + 1);
  const role = P.role === 'set' ? 'Set the Code' : P.role === 'auto' ? 'Watch and Learn' : P.kind === 'daily' ? 'Daily Code' : 'Break the Code';
  const guessNo = P.role === 'set' && P.phase === 'secret' ? 'Choose your secret' : P.done ? (P.won ? 'Cracked' : 'Finished') : `Guess ${Math.min(n, tries)} of ${tries}`;
  const tm = s.prefs.timer && P.role !== 'auto' ? `  ·  ${fmtTime(P.t)}` : '';
  const hud = L.hud, wide = L.wide;
  const tx = hud.title.x, avail = (wide ? L.side.x + L.side.w - 18 - 70 : hud.pause.x - 12) - tx;
  txt(ctx, `${g.name}  ·  ${role}`, tx, hud.title.y, { size: F(wide ? 30 : 32), weight: 700, color: T.text, maxW: avail, min: 14 });
  txt(ctx, `${guessNo}${tm}`, tx, hud.title.y + (wide ? 34 : 32), { size: F(23), weight: 500, color: T.dim, maxW: avail, min: 12 });
  if (P.role !== 'auto') button(ctx, hud.pause, '', { icon: s.paused ? 'play' : 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause'), disabled: P.done });
  if (wide) {
    let y = L.infoTop + 28;
    const x = L.side.x + 22, w = L.side.w - 44;
    if (P.role === 'break' && s.prefs.coach === 'full' && P.left >= 0) {
      panel(ctx, R(x, y, w, 74), { radius: 16 });
      txt(ctx, P.left.toLocaleString('en-US'), x + 20, y + 30, { size: F(36), weight: 700, color: T.accent, maxW: w * 0.5, min: 16 });
      txt(ctx, P.left === 1 ? 'code still fits your clues' : 'codes still fit your clues', x + 20, y + 58, { size: F(19), weight: 400, color: T.dim, maxW: w - 30, min: 11 });
      y += 88;
    }
    const tip = P.role === 'set' ? (P.phase === 'secret' ? 'Pick a code the computer cannot easily crack. Tap Random for a surprise.' : P.phase === 'score' ? 'Count how many digits of its guess are bulls and cows against your code.' : 'The computer works out its next guess.') : P.role === 'auto' ? '' : 'Gold: right digit, right place. Teal: right digit, wrong place.';
    if (tip && !P.done) para(ctx, tip, x, y, w, { size: F(21), weight: 400, color: T.dim, lh: 1.25 });
    void mode;
  } else if (P.role === 'break' && s.prefs.coach === 'full' && P.left >= 0 && !P.done) {
    txt(ctx, `${P.left.toLocaleString('en-US')} ${P.left === 1 ? 'code fits' : 'codes fit'}`, hud.tries.x, hud.tries.y + 34, { size: F(21), weight: 600, color: T.accent, align: 'right', maxW: 200, min: 11 });
  }
}

function drawControls(ctx, s, L, mode) {
  const T = theme(), P = s.P, C = L.ctl, secret = mode === 'secret';
  panel(ctx, R(C.x - 6, C.y - 8, C.w + 12, C.h + 12), { radius: 26, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.22 : 0.3) });
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0], rep = GRADES[P.gid].rep, full = P.cur.every((d) => d >= 0);
  order.forEach((dg, i) => {
    const r = L.keys[i], d = Math.min(r.w, r.h) * 0.94, used = !rep && P.cur.includes(dg) && P.cur[s.sel] !== dg;
    const fl = flashOf(s, 'k' + dg), out = s.prefs.coach === 'full' && !secret && P.out.includes(dg);
    const mark = secret ? 0 : out && !P.marks[dg] ? 2 : P.marks[dg];
    peg(ctx, r.x + r.w / 2, r.y + r.h / 2, d, dg, { lift: fl * 0.8, dim: used ? 0.68 : out ? 0.5 : 0, mark, ring: s.hint === null ? null : null });
    if (s.marksOn && !secret) { ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, d / 2 + 4, 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(T.accent, 0.85); ctx.stroke(); }
  });
  const t = L.tools, tp = t.guess.h;
  button(ctx, t.del, '', { icon: 'backspace', size: 28, radius: 18, flash: flashOf(s, 'del') });
  if (secret) button(ctx, t.marks, 'Random', { icon: 'dice', size: 22, radius: 18, flash: flashOf(s, 'marks') });
  else button(ctx, t.marks, 'Marks', { icon: 'pencil', size: 22, radius: 18, active: s.marksOn, flash: flashOf(s, 'marks') });
  if (secret) button(ctx, t.hint, '', { icon: 'lock', size: 26, radius: 18, disabled: true });
  else button(ctx, t.hint, 'Hint', { icon: 'bulb', size: 22, radius: 18, flash: flashOf(s, 'hint') });
  const warn = s.warn >= 0 && !secret;
  button(ctx, t.guess, secret ? 'Lock in code' : 'Guess', { kind: 'accent', size: 30, radius: 18, disabled: !full, flash: flashOf(s, 'guess'), sub: warn ? `Not the code · see guess ${s.warn + 1}` : '' });
  void tp;
}

function drawWait(ctx, s, L) {
  const T = theme(), C = L.ctl, P = s.P;
  panel(ctx, R(C.x - 6, C.y - 8, C.w + 12, C.h + 12), { radius: 26, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.22 : 0.3) });
  edgeStroke(ctx, R(C.x - 6, C.y - 8, C.w + 12, C.h + 12), 26, 0.35);
  txt(ctx, P.done ? 'Round over' : 'The computer is thinking', C.x + C.w / 2, C.y + C.h / 2 - 16, { size: F(34), weight: 700, color: T.text, align: 'center', maxW: C.w - 30, min: 16 });
  txt(ctx, 'Your code is safe behind the glow.', C.x + C.w / 2, C.y + C.h / 2 + 28, { size: F(22), weight: 400, color: T.dim, align: 'center', maxW: C.w - 30, min: 11 });
}

function stepper(ctx, s, r, label, sub, kind, val, idDec, idInc) {
  const T = theme();
  panel(ctx, R(r.label.x, r.label.y, r.dec.x - 6 - r.label.x, r.label.h), { radius: 18 });
  pip(ctx, r.label.x + 32, r.label.y + r.label.h / 2, 30, kind);
  txt(ctx, label, r.label.x + 60, r.label.y + r.label.h / 2 - (sub ? 11 : 0), { size: F(30), weight: 700, color: T.text, maxW: r.label.w - 66, min: 14 });
  if (sub) txt(ctx, sub, r.label.x + 60, r.label.y + r.label.h / 2 + 18, { size: F(18), weight: 400, color: T.dim, maxW: r.label.w - 66, min: 11 });
  button(ctx, r.dec, '', { icon: 'minus', size: 28, radius: 16, flash: flashOf(s, idDec), disabled: val <= 0 });
  txt(ctx, val, r.val.x + r.val.w / 2, r.val.y + r.val.h / 2, { size: F(44), weight: 700, color: kind === 'bull' ? T.bull : T.cow, align: 'center' });
  button(ctx, r.inc, '', { icon: 'plus', size: 28, radius: 16, flash: flashOf(s, idInc) });
}
function drawScore(ctx, s, L) {
  const T = theme(), C = L.ctl, sc = L.score, P = s.P;
  panel(ctx, R(C.x - 6, C.y - 8, C.w + 12, C.h + 12), { radius: 26, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.22 : 0.3) });
  stepper(ctx, s, sc.bulls, 'Bulls', C.w > 520 ? 'right digit, right place' : '', 'bull', P.score.b, 'bdec', 'binc');
  stepper(ctx, s, sc.cows, 'Cows', C.w > 520 ? 'right digit, wrong place' : '', 'cow', P.score.c, 'cdec', 'cinc');
  button(ctx, sc.show, 'Show me', { size: 22, radius: 18, flash: flashOf(s, 'show') });
  button(ctx, sc.go, S_AUTO(P, s) ? 'Scoring…' : 'Score', { kind: 'accent', size: 32, radius: 18, flash: flashOf(s, 'go') });
}
const S_AUTO = (P, s) => s.prefs.autoScore && P.autoT > 0;

function textFit(ctx, text, w, hmax, size0, weight = 500, lh = 1.3) { let size = size0; while (size > 14 && paraHeight(ctx, text, w, size, weight, lh) > hmax) size -= 1; return size; }
function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.ctl, B = L.coachBtns, box = R(C.x - 6, C.y - 8, C.w + 12, C.h + 12);
  panel(ctx, box, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.3 : 0.55) }); edgeStroke(ctx, box, 24, 0.5);
  const x = C.x + 18, w = C.w - 36, ts = F(C.h > 300 ? 32 : 28);
  txt(ctx, hnt.stage === 'look' ? 'Where to look' : 'Why it works', x, C.y + 12 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 16 });
  const text = hnt.stage === 'look' ? hnt.look : hnt.why, top = C.y + 14 + ts * 1.25, bodyH = B.close.y - 8 - top, size = textFit(ctx, text, w, bodyH, F(C.w > 520 ? 30 : 26));
  para(ctx, text, x, top, w, { size, weight: 500, color: T.text, lh: 1.3 });
  if (hnt.stage === 'explain' && hnt.suggest) { /* the suggested guess is placed by the button */ }
  button(ctx, B.close, 'Close', { size: 26, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Why?' : hnt.suggest ? 'Use guess' : 'Got it', { kind: 'accent', size: 26, flash: flashOf(s, 'go') });
}

const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoCard(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.ctl, rl = L.rail, T0 = L.coachText, box = R(C.x - 6, C.y - 8, C.w + 12, C.h + 12);
  panel(ctx, box, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.3 : 0.55) }); edgeStroke(ctx, box, 24, 0.5);
  const x = C.x + 18, w = C.w - 36, ts = F(C.h > 300 ? 30 : 26);
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Thinking' : a.phase === 'reveal' ? 'Why this guess' : a.done ? 'Complete' : 'Next step';
  txt(ctx, `Guess ${Math.max(1, a.n)}  ·  ${phase}`, x, T0.y + 10 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w * 0.68, min: 15 });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 18, T0.y + 10 + ts * 0.6, { size: F(20), weight: 500, color: T.dim, align: 'right', maxW: w * 0.3, min: 11 });
  const top = T0.y + 14 + ts * 1.25, bodyH = T0.y + T0.h - top;
  const text = a.text || 'The computer studies the clues.', size = textFit(ctx, text, w, bodyH, F(C.w > 520 ? 27 : 24));
  para(ctx, text, x, top, w, { size, weight: 500, color: T.text, lh: 1.3 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 24, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 24, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 24, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 24, flash: flashOf(s, 'ainc') });
}

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.F.w, L.F.h, L.board);
  const b = L.board.rect;
  ctx.fillStyle = rgba(T.tray, 0.74); rr(ctx, b.x, b.y, b.w, b.h, 26); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(10,30,26,0.97)' : 'rgba(255,253,247,0.97)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 700, color: T.text, align: 'center' });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'New round', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}

function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), C = L.ctl;
  const w = Math.min(C.w, 600), cx2 = C.x + C.w / 2;
  let size = F(24), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (lines.length > 3 && size > F(17)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22, y = Math.max(L.U.y0 + 6, C.y - hh - 16);
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(6,24,20,0.97)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, cx = hero.x + hero.w / 2;
  const tb = Math.min(150, Math.max(64, H * 0.26));
  // demo rails: a lidded code row and two guesses that fill in on a loop
  const rows = [[4, 1, 7, 2], [0, 1, 2, 3], [1, 4, 0, 2], [4, 1, 7, 2]], secret = rows[0];
  const railW = Math.min(hero.w * 0.94, 560), rowH = Math.max(46, Math.min(96, (H - tb - 40) / 4.2)), d = Math.min(rowH * 0.78, railW / 6.2);
  const bx = cx - railW / 2, by = hero.y + Math.max(4, (H - tb - rowH * 4.2) / 2);
  const B = { len: 4, d, slot: (k) => cx - ((4 - 1) * d * 1.42) / 2 + k * d * 1.42 - railW * 0.1 };
  rr(ctx, bx - 14, by - 10, railW + 28, rowH * 4.1 + 20, 26); ctx.fillStyle = T.tray; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = T.rim; ctx.stroke();
  const cyc = (s.t * 0.45) % 3.2, step = Math.floor(cyc), local = cyc - step;
  const revealT = clamp(s.sceneT, 0, 1);
  for (let r = 0; r < 4; r++) {
    const cy = by + rowH * (r + 0.5) + (r > 0 ? rowH * 0.1 : 0);
    const shown = r === 0 ? 4 : r <= step + 0 ? 4 : r === step + 1 ? Math.min(4, Math.floor(local * 6)) : 0;
    const pegs = r === 0 ? secret : rows[r].map((v, k) => (k < shown ? v : -1));
    for (let k = 0; k < 4; k++) {
      const x = B.slot(k);
      hole(ctx, x, cy, d * 1.06);
      if (r === 0) { peg(ctx, x, cy, d, secret[k], { scale: revealT }); lid(ctx, x, cy, d * 1.02, 0); }
      else if (pegs[k] >= 0) peg(ctx, x, cy, d, pegs[k], { scale: backOut(clamp(local * 6 - k, 0, 1) || 1) });
    }
    if (r > 0 && shown >= 4 && r <= step) clue(ctx, R(bx + railW * 0.62, cy - rowH / 2, railW * 0.36, rowH), scoreA(secret, rows[r]), 4, 99, { text: false });
  }
  const ty = by + rowH * 4.2 + tb * 0.72;
  ctx.save(); ctx.font = `700 ${tb * 0.4}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tg = ctx.createLinearGradient(0, ty - tb * 0.3, 0, ty + tb * 0.3); tg.addColorStop(0, mix(T.accent, '#ffffff', 0.5)); tg.addColorStop(1, T.accent);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText('BULLS & COWS', cx + 2, ty + 3, hero.w * 0.96); ctx.fillStyle = tg; ctx.fillText('BULLS & COWS', cx, ty, hero.w * 0.96); ctx.restore();
  txt(ctx, 'THE CODE-BREAKING GAME', cx, ty + tb * 0.36, { size: tb * 0.17, weight: 600, color: T.dim, align: 'center', maxW: hero.w * 0.9, min: 12 });
  const Bt = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${GRADES[s.saved.gid].name} · ${s.saved.role === 'set' ? 'Set the Code' : s.saved.kind === 'daily' ? 'Daily Code' : 'Break the Code'}  ·  ${s.saved.n} guesses` : ''],
    break: ['Break the Code', 'Crack the computer\'s secret'], set: ['Set the Code', 'Can the computer crack yours?'], daily: ['Daily Code', s.dailyInfo],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(Bt)) {
    const prim = ['continue', 'break', 'set', 'daily'].includes(id), r = Bt[id];
    button(ctx, r, lab[id][0], { kind: id === 'break' || id === 'continue' ? 'accent' : 'solid', size: prim ? 32 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pages ===================================================================
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

function drawNew(ctx, s, w, h) {
  const T = theme(), cards = newCards(s.newRole), NL = newLayout(w, h, cards.length);
  header(ctx, s, NL, s.newRole === 'set' ? 'Set the Code' : 'Break the Code');
  scrollBody(ctx, s, NL.body, () => {
    cards.forEach((id, i) => {
      const r = NL.cards[i], isDaily = id === 'daily', gid = isDaily ? s.dailyGrade : id, g = GRADES[gid], st = s.stats;
      const sel = !isDaily && id === s.prefs.grade;
      panel(ctx, r, { radius: 22, fill: isDaily ? rgba(T.accent, 0.14) : T.panel, line: sel ? T.accent : T.line });
      if (sel) { rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      txt(ctx, isDaily ? 'Daily Code' : g.name, r.x + 24, r.y + 32, { size: F(38), weight: 700, color: T.text, maxW: r.w * 0.5, min: 20 });
      txt(ctx, isDaily ? `${g.name} today · streak ${s.streak}` : g.tag, r.x + 24, r.y + 64, { size: F(21), weight: 600, color: T.accent, maxW: r.w * 0.58, min: 12 });
      para(ctx, isDaily ? 'The same code for everyone, new every day.' : `${g.text} ${s.newRole === 'set' ? `The computer gets ${g.ctries} guesses.` : `${g.tries} tries.`}`, r.x + 24, r.y + 80, r.w - 48 - (r.w > 520 ? 170 : 0), { size: F(r.h < 135 ? 18 : 21), weight: 400, color: T.dim, lh: 1.15 });
      if (isDaily && s.dailyDone) icons.check(ctx, r.x + r.w - 44, r.y + 40, 34, T.good);
      else if (!isDaily) {
        const tx = r.x + r.w - 24;
        const big = s.newRole === 'set' ? `${st.setWon[id]}/${st.setPlayed[id]}` : st.best[id] ? `${st.best[id]}` : '–';
        txt(ctx, big, tx, r.y + 38, { size: F(32), weight: 700, color: T.text, align: 'right' });
        txt(ctx, s.newRole === 'set' ? 'outlasted the computer' : `best guesses · ${st.won[id]} won`, tx, r.y + 70, { size: F(19), weight: 400, color: T.dim, align: 'right', maxW: 200, min: 11 });
      }
      const len = g.len, ps = Math.min(30, r.h * 0.22), px = r.x + 24;
      for (let k = 0; k < len; k++) peg(ctx, px + ps / 2 + k * (ps * 1.12), r.y + r.h - ps * 0.72, ps, [4, 1, 7, 2, 9, 5][k] ?? 0, { shadow: false });
    });
    return NL.contentH;
  });
  button(ctx, NL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ---- figures made from the game's own pegs and pips ----------------------------------------------------------------------------------------
function drawFigure(ctx, r, fig, t) {
  const T = theme();
  panel(ctx, r, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.2 : 0.35) });
  if (fig.k === 'pegs') {
    const cols = r.w > 420 ? 5 : 5, d = Math.min((r.w - 40) / cols * 0.84, (r.h - 40) / 2.3, 96);
    for (let i = 0; i < 10; i++) {
      const cx = r.x + r.w / 2 + ((i % cols) - (cols - 1) / 2) * (d * 1.2), cy = r.y + r.h / 2 + (Math.floor(i / cols) - 0.5) * (d * 1.2);
      peg(ctx, cx, cy, d, i);
    }
    return;
  }
  const secret = fig.secret, len = secret.length, rows = fig.guesses, n = rows.length + 1;
  const rowH = Math.min(86, (r.h - 24) / n), d = Math.min(rowH * 0.78, (r.w - 40) / (len * 1.3 + 3.2)), gx = d * 1.22, fbW = Math.min(r.w * 0.34, 150);
  const x0 = r.x + 24 + d / 2, cyTop = r.y + 12 + rowH / 2 + (r.h - 24 - rowH * n) / 2;
  const B = { len, d, slot: (k) => x0 + k * gx };
  for (let i = 0; i < n; i++) {
    const cy = cyTop + i * rowH, g = i === 0 ? secret : rows[i - 1];
    for (let k = 0; k < len; k++) {
      hole(ctx, B.slot(k), cy, d * 1.06);
      peg(ctx, B.slot(k), cy, d, g[k]);
      if (i === 0 && fig.hide) lid(ctx, B.slot(k), cy, d * 1.02, 0);
    }
    if (i === 0) txt(ctx, 'code', r.x + r.w - 20, cy, { size: F(20), weight: 600, color: T.accent, align: 'right', maxW: fbW, min: 11 });
    else clue(ctx, R(r.x + r.w - fbW - 12, cy - rowH / 2, fbW, rowH), scoreA(secret, g), len, 99, { text: fbW >= 130 });
  }
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
    txt(ctx, page.title, x, y + 26 * sc, { size: F(38) * sc, weight: 700, color: T.accent, maxW: width, min: 16 }); y += 26 * sc + 30 * sc;
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
    if (page.fig) drawFigure(ctx, R(figR.x, figR.y, figR.w, Math.min(figR.h, 520)), page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const rows = page.fig.guesses ? page.fig.guesses.length + 1 : 3, fh = clamp(rows * 80 + 30, 200, Math.max(220, textR.h * (sc > 1.6 ? 0.4 : 0.55)));
        drawFigure(ctx, R(textR.x, y, Math.min(textR.w, 680), fh), page.fig, s.t); y += fh + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

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

function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = statsLayout(w, h), st = s.stats;
  header(ctx, s, SL, 'Stats');
  const sum = (a) => a.reduce((x, y) => x + y, 0), wide = SL.body.w >= 1000;
  scrollBody(ctx, s, SL.body, () => {
    const r = SL.body, gapC = 28, lw = wide ? (r.w - gapC) * 0.54 : r.w, x = r.x; let y = r.y;
    const cols = lw > 760 ? 4 : 2, tiles = [['Codes cracked', sum(st.won)], ['Daily streak', s.streak], ['Best streak', st.bestStreak], ['Computer outlasted', sum(st.setWon)]];
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
      txt(ctx, GRADES[l].name, x + 20, y + rh / 2, { size: F(28) * Math.min(sc, 1.6), weight: 600, color: T.text, maxW: lw * 0.28, min: 13 });
      txt(ctx, `${st.won[l]} of ${st.played[l]} cracked`, x + lw * 0.34, y + rh / 2, { size: F(23) * Math.min(sc, 1.6), weight: 400, color: T.dim, maxW: lw * 0.34, min: 12 });
      txt(ctx, st.best[l] ? `best ${st.best[l]}` : 'no best yet', x + lw - 20, y + rh / 2, { size: F(24) * Math.min(sc, 1.6), weight: 500, color: T.text, align: 'right', maxW: lw * 0.3, min: 12 });
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
  const g = GRADES[R0.gid], len = g.len, cr = O.codeR;
  // the code, glowing
  panel(ctx, cr, { radius: 26, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.22 : 0.35) }); edgeStroke(ctx, cr, 26, 0.45);
  const d = Math.min((cr.w - 50) / (len * 1.22), (cr.h - 70) / 1.1, 120), gx = d * 1.22, x0 = cr.x + cr.w / 2 - ((len - 1) * gx) / 2, cy = cr.y + cr.h / 2 - (O.wide ? 24 : 6);
  txt(ctx, R0.role === 'set' ? 'YOUR CODE' : 'THE CODE', cr.x + cr.w / 2, cr.y + 26, { size: F(21), weight: 700, color: T.accent, align: 'center' });
  for (let k = 0; k < len; k++) {
    const ph = s.t * 1.8 - k * 0.3, wave = R0.won && ph > 0 && (ph % 6) < 1.2 ? Math.sin(((ph % 6) / 1.2) * Math.PI) : 0;
    hole(ctx, x0 + k * gx, cy, d * 1.06); peg(ctx, x0 + k * gx, cy, d, R0.secret[k], { lift: wave, scale: 1 });
  }
  if (O.wide) txt(ctx, `${R0.rows.length} guess${R0.rows.length === 1 ? '' : 'es'}`, cr.x + cr.w / 2, cy + d * 0.95, { size: F(24), weight: 500, color: T.dim, align: 'center' });
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 38 : 50, setR = R0.role === 'set';
    const title = setR ? (R0.won ? 'Your code held' : 'Code cracked') : R0.kind === 'daily' ? (R0.won ? 'Daily Code cracked' : 'Daily Code missed') : R0.won ? 'Code cracked' : 'Out of tries';
    txt(ctx, title, body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * Math.min(sc, 1.5), weight: 700, color: T.text, align: 'center', maxW: body.w, min: 20 }); y += (tsz + 12) * Math.min(sc, 1.5);
    if (R0.stars > 0 || R0.won) {
      const sz = compact ? 36 : 50;
      for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
      y += sz + (compact ? 8 : 14);
    }
    const facts = setR ? [['Computer guesses', R0.guesses], ['Its limit', R0.ctries], ['Miscounts', R0.errs], ['Time', fmtTime(R0.time)]] : [['Guesses', R0.guesses], ['Par', R0.par], ['Hints', R0.hints], ['Time', fmtTime(R0.time)]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 80) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * Math.min(sc, 1.6), weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 14 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * Math.min(sc, 1.6), weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.newBest) { txt(ctx, 'New best for this grade', body.x + body.w / 2, y + 16, { size: F(26) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.kind === 'daily' && R0.won) y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8;
    txt(ctx, 'How it went', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 40 * sc;
    const rh = 44 * Math.min(sc, 1.8), pd = rh * 0.76;
    R0.rows.forEach((row, i) => {
      const cy2 = y + rh / 2;
      txt(ctx, String(i + 1), body.x + 14 * sc, cy2, { size: F(22) * Math.min(sc, 1.6), weight: 700, color: T.dim, align: 'center' });
      row.g.forEach((dg, k) => peg(ctx, body.x + 44 * Math.min(sc, 1.6) + pd / 2 + k * pd * 1.12, cy2, pd, dg, { shadow: false }));
      const fx0 = body.x + 44 * Math.min(sc, 1.6) + len * pd * 1.12 + 10;
      if (row.fb >= 0) clue(ctx, R(fx0, y, Math.max(60, body.x + body.w - fx0), rh), row.fb, len, 99, { text: false });
      y += rh + 4;
    });
    return y - body.y + 10;
  });
  button(ctx, O.btns.next, R0.kind === 'daily' ? 'Back to menu' : 'Play again', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.kind === 'daily' ? 'New game' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has all five grades, Set the Code, the Daily Code, hints that teach and Watch and Learn. Get Bulls and Cows on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
