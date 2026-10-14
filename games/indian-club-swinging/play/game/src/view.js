// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawBackdrop, drawPit, drawClub, drawTarget, drawFigure2D, drawGrip } from './art.js';
import { hooks } from './hooks.js';
import { txt, button, panel, rrect, chip, wrap, minUnits } from './ui.js';
import { renderDoc, mini } from './docview.js';
import { renderPlay } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { MOVES, MOVE_ORDER, ROUTINES, TIMING, WEIGHT, THINK_TIMES, leadPoint, pairOf, TAU } from './moves.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (n) => Math.round(n).toLocaleString('en-US');

// A display-font line shrunk to fit maxW: embossed gold lettering with real thickness (extruded dark-bronze body, ink outline, lit top face).
function titleLine(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width, s = wmax > maxW ? size * maxW / wmax : size;
  ctx.font = `${s}px ${DISPLAY}`;
  ctx.lineJoin = 'round';
  const depth = Math.max(3, Math.round(s * 0.07));
  // soft ground shadow
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = s * 0.2; ctx.shadowOffsetY = depth + 3;
  ctx.fillStyle = '#5a2306'; ctx.fillText(label, cx, y + depth);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // extrusion
  for (let i = depth; i >= 1; i--) { ctx.fillStyle = i > depth * 0.5 ? '#6d2c0a' : '#9a4a12'; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = s * 0.14; ctx.strokeText(label, cx, y + i); ctx.fillText(label, cx, y + i); }
  // ink outline
  ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#1a0a04'; ctx.strokeText(label, cx, y);
  // lit face
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffd24a'); g.addColorStop(0.62, '#f0a020'); g.addColorStop(1, '#c8641a');
  ctx.fillStyle = g; ctx.fillText(label, cx, y);
  // a thin bright edge catching the key light on the upper left of every letter
  ctx.save(); ctx.beginPath(); ctx.rect(cx - maxW, y - s * 0.6, maxW * 2, s * 0.62); ctx.clip();
  ctx.lineWidth = Math.max(1.2, s * 0.018); ctx.strokeStyle = 'rgba(255,255,240,0.65)'; ctx.strokeText(label, cx - s * 0.006, y - s * 0.006);
  ctx.restore();
  ctx.restore();
  return s;
}

// The attract animation: two clubs swinging a paired circle. Returns the figure geometry (the same shape the play screen hands to the 3D scene).
function heroFig(st, x, y, r, L) {
  const t = st.t, turns = t * 0.2, m = MOVES.mirror, rr = r * (L.mode === 'wide' ? 1.0 : L.mode === 'compact' ? 1.7 : 1.05), pr = rr * 0.8, lx = x + rr * 0.2, sx = x - rr * 0.2;
  y = y - rr * (L.mode === 'wide' ? 0.3 : 0.2);
  const p = leadPoint(m, turns), q = pairOf(m, p), Lc = pr * 1.15;
  const a1 = Math.atan2(p.y, p.x), a2 = Math.atan2(q.y, q.x);
  const grip = (hx, hy, a) => ({ x: hx - Math.cos(a) * Lc * 0.75, y: hy - Math.sin(a) * Lc * 0.75, dx: Math.cos(a), dy: Math.sin(a), hx, hy });
  const g1 = grip(lx + p.x * pr, y + p.y * pr, a1), g2 = grip(sx + q.x * pr, y + q.y * pr, a2);
  const trail = [], trail2 = [];
  for (let i = 18; i >= 0; i--) { const tp = leadPoint(m, turns - i * 0.004), tq = pairOf(m, tp); trail.push({ x: lx + tp.x * pr, y: y + tp.y * pr }); trail2.push({ x: sx + tq.x * pr, y: y + tq.y * pr }); }
  const spd = 0.2 * TAU * 1 * 0.5;
  return { w: L.w + 20, h: L.h + 20, cx: x, cy: y, R: rr, t, paused: false, speed: spd + 1.6, pulse: Math.max(0, Math.sin(t * 4.4)) ** 6, glow: 0.35 + 0.3 * Math.sin(t * 2.2),
    lead: g1, second: g2, hLead: p, hSecond: q, showTrail: true, trail, trail2, _lx: lx, _sx: sx, _pr: pr, _a1: a1, _a2: a2, _L: Lc };
}
function heroFallback(ctx, st, f) {
  const { cx: x, cy: y, R: rr, t, _lx: lx, _sx: sx, _pr: pr, _a1: a1, _a2: a2, _L: L } = f;
  drawPit(ctx, x, y, rr, t, Math.max(0, Math.sin(t * 4.4)) ** 6 * 0.6);
  ctx.save(); ctx.strokeStyle = 'rgba(255,248,230,0.55)'; ctx.setLineDash([pr * 0.07, pr * 0.06]); ctx.lineWidth = Math.max(3, pr * 0.025);
  for (const cx of [lx, sx]) { ctx.beginPath(); ctx.arc(cx, y, pr, 0, TAU); ctx.stroke(); }
  ctx.restore();
  drawFigure2D(ctx, f);
  drawClub(ctx, f.second.hx, f.second.hy, a2, L, { tone: 1 });
  drawClub(ctx, f.lead.hx, f.lead.hy, a1, L, { tone: 0 });
  drawGrip(ctx, f.second.x, f.second.y, a2, rr); drawGrip(ctx, f.lead.x, f.lead.y, a1, rr);
  drawTarget(ctx, f.lead.hx, f.lead.hy, Math.max(10, pr * 0.3), 0.3, true);
}

// A soft dark veil over the still courtyard behind panels and text (keeps the cards legible and the scene calm).
function veil(ctx, w, h, a = 0.5) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(3,12,14,${a + 0.12})`); g.addColorStop(0.5, `rgba(3,12,14,${a})`); g.addColorStop(1, `rgba(3,12,14,${a + 0.18})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

export function render(ctx, st, L, view, meta, helpers) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, helpers); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  // the title is a live 3D scene (the athlete swinging a pair); other screens sit on a still picture of the same courtyard
  let scene3d = false, heroF = null;
  if (sc === 'title') { heroF = heroFig(st, L.title.hero.x, L.title.hero.y, L.title.hero.r, L); scene3d = !!(hooks.scene && hooks.scene(ctx, heroF)); }
  if (!scene3d) {
    if (hooks.backdrop && hooks.backdrop(ctx, w + 20, h + 20)) veil(ctx, w + 20, h + 20, sc === 'title' ? 0.2 : 0.5);
    else drawBackdrop(ctx, w + 20, h + 20, st.t);
    if (sc === 'title' && heroF) heroFallback(ctx, st, heroF);
  } else {
    // light veils behind the lettering and the buttons
    const g = ctx.createLinearGradient(0, 0, 0, L.title.titleY + L.title.size * 2);
    g.addColorStop(0, 'rgba(3,12,14,0.62)'); g.addColorStop(1, 'rgba(3,12,14,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w + 20, L.title.titleY + L.title.size * 2);
  }
  if (sc === 'title') renderTitle(ctx, st, L, scene3d);
  else if (sc === 'routines') renderRoutines(ctx, st, L, helpers);
  else if (sc === 'moves') renderMoves(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(6,24,28,0.92)', stroke: 'rgba(255,230,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('weight', 'Club weight', 'cycle', () => WEIGHT[p.weightIdx].name, 'How much the clubs lag behind your finger'),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How close you must stay to the marker'),
    row('trail', 'Club trail', 'toggle', () => p.trail, 'A glowing line behind each club'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks'),
    row('think', 'Think time', 'cycle', () => `${THINK_TIMES[p.thinkIdx]} s`, 'In Watch and Learn, before each move'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [st.owned
      ? row('restore', 'Full game unlocked', 'cycle', () => 'Owned', 'Thank you for playing')
      : row('restore', 'Restore purchase', 'button', () => '', st.restoreMsg || 'Already bought it? Get it back', { btn: st.restoreBusy ? 'Wait...' : 'Restore' })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, scene3d) {
  const T = L.title, S = L.S, wide = L.mode === 'wide';
  const tcx = wide ? T.hero.x : S.x + S.w / 2, maxW = (wide ? T.col.x - S.x : S.w) - 50;
  void scene3d;
  const s1 = titleLine(ctx, tcx, T.titleY, T.size, 'INDIAN CLUB', maxW);
  titleLine(ctx, tcx, T.titleY + s1 * 0.95, Math.min(s1, T.size) * 0.74, 'SWINGING', maxW);
  txt(ctx, 'Trace the path. Keep the flow.', tcx, T.titleY + s1 * 1.62, Math.max(24, T.size * 0.2), PAL.text, { align: 'center', weight: 600, stroke: 5, maxW });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.practice, 'Practice a move', { kind: 'quiet', size: 32, icon: 'club' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// Keep at most n wrapped lines; when text is cut, the last line ends in an ellipsis that still fits maxW.
function ellipsize(lines, n, ctx, maxW) {
  if (lines.length <= n) return lines;
  const out = lines.slice(0, n); let last = out[n - 1].replace(/[ ,.;:]+$/, '');
  while (last.length > 1 && ctx.measureText(last + '...').width > maxW) last = last.slice(0, -1).replace(/[ ,.;:]+$/, '');
  out[n - 1] = last + '...';
  return out;
}

function header(ctx, G, S, text) {
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, text, S.x + S.w / 2, G.titleY, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
}

// ---- routines --------------------------------------------------------------------------------------------------------------------------------------
function renderRoutines(ctx, st, L, helpers) {
  const G = L.routines, S = L.S;
  header(ctx, G, S, 'Choose a routine');
  const n = helpers.routineCount();
  for (let i = 0; i < n; i++) {
    const r = G.cards[i], rt = helpers.routineAt(i), best = st.best[rt.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(8,30,34,0.8)' }); edgeStroke(ctx, r, 24, 0.25);
    const pad = 20, small = r.h < 200, tw = r.w * 0.56;
    txt(ctx, rt.name, r.x + pad, r.y + r.h * (small ? 0.17 : 0.15), small ? 30 : 36, locked ? PAL.dim : PAL.text, { font: DISPLAY, weight: 400, maxW: tw });
    const row2 = r.y + r.h * (small ? 0.4 : 0.38);
    chip(ctx, r.x + pad, row2, `${rt.bpm} bpm`, 20, { fill: 'rgba(255,243,218,0.12)' });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < rt.level ? PAL.turmeric : 'rgba(255,243,218,0.18)'; ctx.beginPath(); ctx.arc(r.x + pad + 118 + k * 22, row2, 7, 0, 6.3); ctx.fill(); }
    ctx.font = `500 ${small ? 20 : 22}px ${UI}`;
    const lines = ellipsize(wrap(ctx, locked ? 'Full game: get it on iPhone and Android.' : rt.blurb, tw), r.h < 170 ? 1 : 2, ctx, tw);
    lines.forEach((ln, k) => txt(ctx, ln, r.x + pad, r.y + r.h * (small ? 0.6 : 0.58) + k * 24, small ? 19 : 21, PAL.dim, { weight: 500, maxW: tw }));
    const st3 = best.stars || 0;
    for (let k = 0; k < 3; k++) starShape(ctx, r.x + pad + 12 + k * 30, r.y + r.h * 0.9, 12, k < st3);
    if (best.score) txt(ctx, `Best ${num(best.score)}`, r.x + pad + 110, r.y + r.h * 0.9, 20, PAL.dim, { weight: 600, maxW: tw - 110 });
    // the first moves, as little paths
    const mv = rt.moves.slice(0, small ? 3 : 4), mr = Math.min(r.h * 0.17, (r.w * 0.4) / (mv.length * 2.4));
    mv.forEach(([id], k) => mini(ctx, MOVES[id], r.x + r.w - pad - mr - k * mr * 2.4 - 6, r.y + r.h / 2, mr, { dim: true, dash: false }));
  }
}

// ---- moves (practice) ---------------------------------------------------------------------------------------------------------------------------------
function renderMoves(ctx, st, L) {
  const G = L.moves, S = L.S;
  header(ctx, G, S, 'Practice a move');
  MOVE_ORDER.forEach((id, i) => {
    const r = G.cards[i], m = MOVES[id];
    panel(ctx, r, { fill: 'rgba(8,30,34,0.8)' }); edgeStroke(ctx, r, 22, 0.2);
    const two = r.h >= 130, labH = two ? 62 : 34;
    const rad = Math.max(10, Math.min(r.w * 0.26, (r.h - labH - 18) / 2));
    mini(ctx, m, r.x + r.w / 2, r.y + 10 + rad, rad, { turns: (st.t * 0.15 + i * 0.13) % 1 });
    txt(ctx, m.name, r.x + r.w / 2, r.y + r.h - (two ? 40 : 17), 24, PAL.text, { align: 'center', weight: 700, maxW: r.w - 16 });
    if (two) txt(ctx, `${m.pair === 'together' ? 'together' : m.pair}  -  ${m.speed >= 1 ? '1 turn/beat' : '1 turn/2 beats'}`, r.x + r.w / 2, r.y + r.h - 16, 17, PAL.dim, { align: 'center', weight: 500, maxW: r.w - 16 });
  });
  button(ctx, G.tempoDec, '-', { kind: 'quiet', size: 40 });
  button(ctx, G.tempoInc, '+', { kind: 'quiet', size: 40 });
  txt(ctx, `Tempo  ${st.prefs.practiceBpm} beats per minute`, G.tempo.x + G.tempo.w / 2, G.tempo.y + G.tempo.h / 2, 30, PAL.gold, { align: 'center', weight: 800, maxW: G.tempo.w - 2 * G.tempoDec.w - 20 });
}

// ---- result --------------------------------------------------------------------------------------------------------------------------------------------
function starShape(ctx, x, y, r, on) {
  ctx.save(); ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = on ? PAL.turmeric : 'rgba(255,243,218,0.14)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = on ? '#9a5a08' : 'rgba(255,243,218,0.3)'; ctx.stroke(); ctx.restore();
}
function renderResult(ctx, st, L) {
  const Rr = L.result, p = Rr.panel, res = st.result, wide = L.mode === 'wide';
  if (!res) return;
  ctx.fillStyle = 'rgba(3,12,14,0.5)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, p, { fill: 'rgba(8,30,34,0.94)', rad: 30 }); edgeStroke(ctx, p, 30, 0.35);
  const lx = wide ? p.x + p.w * 0.27 : p.x + p.w / 2;
  txt(ctx, res.name, p.x + p.w / 2, p.y + 52, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: p.w - 60 });
  txt(ctx, res.mode === 'practice' ? 'Practice complete' : 'Routine complete', p.x + p.w / 2, p.y + 96, 24, PAL.dim, { align: 'center', weight: 600 });
  const sr = wide ? 38 : 48, sy = p.y + 160;
  for (let i = 0; i < 3; i++) starShape(ctx, lx + (i - 1) * sr * 2.4, sy, sr, i < res.stars);
  txt(ctx, res.grade, lx, sy + sr + 40, 36, PAL.text, { align: 'center', font: DISPLAY, weight: 400, maxW: wide ? p.w * 0.45 : p.w - 60 });
  let y = sy + sr + 100;
  const line = (a, b) => { txt(ctx, a, lx - (wide ? p.w * 0.2 : p.w * 0.34), y, 26, PAL.dim, { weight: 600 }); txt(ctx, b, lx + (wide ? p.w * 0.2 : p.w * 0.34), y, 28, PAL.text, { align: 'right', weight: 800 }); y += 46; };
  line('Score', num(res.score) + (res.newBest ? '  NEW BEST' : ''));
  line('Accuracy', `${Math.round(res.acc * 100)}%`);
  line('Longest smooth run', String(res.bestRun));
  line('Smooth / good / off', `${res.counts.smooth} / ${res.counts.good} / ${res.counts.off}`);
  if (res.hints) line('Hints used', String(res.hints));
  // per-move accuracy bars
  const list = res.segs;
  const bx = wide ? p.x + p.w * 0.54 : p.x + 36, bw = wide ? p.w * 0.42 : p.w - 72;
  const top = wide ? p.y + 140 : y + 10, bot = (wide ? Rr.again.y : Rr.again.y) - 26 - (wide ? 0 : 0);
  const minRow = Math.max(26, minUnits() * 1.2), cap = Math.floor((bot - top) / minRow);
  if (list.length <= cap) {
    const rh = clamp((bot - top) / Math.max(1, list.length), minRow, 44);
    for (let i = 0; i < list.length; i++) {
      const yy = top + i * rh + rh / 2, s = list[i];
      txt(ctx, s.name, bx, yy, Math.min(22, rh * 0.52), PAL.text, { weight: 500, maxW: bw * 0.46 });
      const x0 = bx + bw * 0.5, ww = bw * 0.38;
      ctx.fillStyle = 'rgba(255,243,218,0.14)'; rrect(ctx, { x: x0, y: yy - 6, w: ww, h: 12 }, 6); ctx.fill();
      ctx.fillStyle = s.acc >= 0.9 ? '#ffe27a' : s.acc >= 0.7 ? PAL.tealHi : '#ff9a8a'; rrect(ctx, { x: x0, y: yy - 6, w: Math.max(12, ww * s.acc), h: 12 }, 6); ctx.fill();
      txt(ctx, `${Math.round(s.acc * 100)}%`, bx + bw, yy, Math.min(20, rh * 0.5), PAL.dim, { align: 'right', weight: 600 });
    }
  } else if (list.length) {
    // too many moves for one line each: one bar per move, plus the weakest move named underneath
    const lab = Math.max(22, minUnits()), H = Math.max(40, bot - top - lab * 2 - 28), n = list.length, gap = 6, cw = (bw - gap * (n - 1)) / n;
    let worst = 0;
    list.forEach((sg, i) => {
      if (sg.acc < list[worst].acc) worst = i;
      const x = bx + i * (cw + gap), hh = Math.max(6, H * sg.acc);
      ctx.fillStyle = 'rgba(255,243,218,0.12)'; rrect(ctx, { x, y: top, w: cw, h: H }, Math.min(6, cw / 2)); ctx.fill();
      ctx.fillStyle = sg.acc >= 0.9 ? '#ffe27a' : sg.acc >= 0.7 ? PAL.tealHi : '#ff9a8a'; rrect(ctx, { x, y: top + H - hh, w: cw, h: hh }, Math.min(6, cw / 2)); ctx.fill();
      txt(ctx, String(i + 1), x + cw / 2, top + H + lab * 0.7, Math.min(20, cw * 0.9), PAL.dim, { align: 'center', weight: 600 });
    });
    txt(ctx, `Accuracy by move. Weakest: ${list[worst].name} ${Math.round(list[worst].acc * 100)}%`, bx, top + H + lab * 1.9 + 4, 20, PAL.dim, { weight: 500, maxW: bw });
  }
  button(ctx, Rr.again, res.mode === 'practice' ? 'Again' : 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.routines, res.mode === 'practice' ? 'Moves' : 'Routines', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, cx = S.x + S.w / 2, cy = S.y + S.h / 2;
  panel(ctx, { x: cx - Math.min(S.w - 40, 560) / 2, y: cy - 190, w: Math.min(S.w - 40, 560), h: 380 }, { fill: 'rgba(8,30,34,0.94)', rad: 28 });
  txt(ctx, 'That is the free web demo', cx, cy - 110, 36, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: Math.min(S.w - 80, 520) });
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, 'Get the full game on iPhone and Android for every routine, Practice and your saved bests.', Math.min(S.w - 100, 480));
  lines.forEach((ln, i) => txt(ctx, ln, cx, cy - 30 + i * 36, 26, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back to the menu', cx, cy + 150, 24, PAL.dim, { align: 'center', weight: 600 });
}
