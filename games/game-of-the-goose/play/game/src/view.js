// Drawing for every screen. render() is the single entry point; the board lives in boardview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, PLAYER_COLORS, clamp, ease, drawDesk, drawSheet, drawPawn, drawDie, drawFeather, drawGoose, hash } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { ABOUT, HOWTO, rulesPages } from './content.js';
import { drawBoard, frameOf, spotXY, tileSize } from './boardview.js';
import { actionRects, menuRects, TEXT_SCALES } from './layout.js';
import { drawCredit, drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { VARIANT_KEYS, VARIANT_INFO, FINAL, MAX_FEATHERS, TALLY } from './engine.js';
import { THINK_CHOICES, SPEEDS, DEMO_GAMES, ROSTER } from './rulesdata.js';
import { SPOT } from './board.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;

// ---- small pieces ----------------------------------------------------------------------------------------------------------------------
function titleText(ctx, cx, y, size, label, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(label).width;
  if (w0 > maxW) { size *= maxW / w0; ctx.font = `700 ${size}px ${DISPLAY}`; }
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.55, '#f1c25a'); g.addColorStop(1, '#b97a1c');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#2a1809'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,190,90,0.45)'; ctx.shadowBlur = size * 0.2; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
}

function featherRow(ctx, x, y, size, n, align = 'left') {
  const gap = size * 1.15, total = gap * MAX_FEATHERS;
  const x0 = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < MAX_FEATHERS; i++) {
    const cx = x0 + gap * (i + 0.5);
    ctx.save(); ctx.globalAlpha = i < n ? 1 : 0.28;
    drawFeather(ctx, cx, y, size * 0.5, -0.7, i < n ? '#fff8e6' : '#9a8a6a');
    ctx.restore();
  }
}

// tokens' screen position (with a hop arc while moving)
function pawnXY(f, ts, p, st, g, sameIdx, sameN) {
  if (p.vis) {
    const a = spotXY(f, p.vis.from), b = spotXY(f, p.vis.to), u = ease(p.vis.u);
    let lift = 0;
    if (p.vis.k === 'hop') lift = Math.sin(Math.PI * p.vis.u) * ts * 0.45;
    else if (p.vis.k === 'leap') lift = Math.sin(Math.PI * p.vis.u) * ts * 1.5;
    else if (p.vis.k === 'slide') lift = Math.sin(Math.PI * p.vis.u) * ts * 0.25;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, lift };
  }
  const c = spotXY(f, p.pos);
  let ox = 0, oy = 0;
  if (sameN > 1) { const a = (sameIdx / sameN) * TAU + 0.6; ox = Math.cos(a) * ts * 0.24; oy = Math.sin(a) * ts * 0.14; }
  if (p.pos === 0) { ox = (sameIdx - (sameN - 1) / 2) * ts * 0.34; oy = ts * 0.1; }
  return { x: c.x + ox, y: c.y + oy, lift: 0 };
}

function playersStrip(ctx, st, L, g) {
  const r = L.play.players, n = g.players.length;
  const row = r.w >= r.h * 2.2;
  const cols = row ? n : 2, rows = Math.ceil(n / cols), gap = 8;
  const cw = (r.w - gap * (cols - 1)) / cols, ch = (r.h - gap * (rows - 1)) / rows;
  g.players.forEach((p, i) => {
    const cx = r.x + (i % cols) * (cw + gap), cy = r.y + Math.floor(i / cols) * (ch + gap);
    const isCur = i === g.cur && !g.over;
    const rect = { x: cx, y: cy, w: cw, h: ch };
    if (v3.on) v3.panels.push({ r: rect, rad: 14, kind: isCur ? 'cur' : 'slate' });
    else {
      ctx.fillStyle = isCur ? 'rgba(239,223,184,0.95)' : 'rgba(30,18,8,0.7)'; rrect(ctx, rect, 14); ctx.fill();
      ctx.lineWidth = isCur ? 3 : 1.5; ctx.strokeStyle = isCur ? '#f1c25a' : 'rgba(227,174,63,0.3)'; rrect(ctx, rect, 14); ctx.stroke();
    }
    const ps = Math.min(ch * 0.62, cw * 0.3, 52);
    drawPawn(ctx, cx + ps * 0.62, cy + ch * 0.72, ps, p.seat, { num: p.seat + 1, ring: isCur ? '#f1c25a' : null });
    const tx = cx + ps * 1.25 + 4, tw = cw - (tx - cx) - 6;
    const dark = isCur ? PAL.ink : PAL.text;
    const role = p.kind === 'human' && !g.auto ? '' : '';
    txt(ctx, p.name + role, tx, cy + ch * 0.3, Math.min(24, ch * 0.3), dark, { maxW: tw });
    let status = `${p.pos}`;
    if (p.stuck) status = `${p.pos} ${p.stuck}`;
    else if (p.skip > 0) status = `${p.pos} resting`;
    txt(ctx, status, tx, cy + ch * 0.62, Math.min(22, ch * 0.28), isCur ? PAL.oxblood : PAL.dim, { maxW: tw });
    if (g.variants.feathers) featherRow(ctx, tx + 2, cy + ch * 0.86, Math.min(15, ch * 0.18), p.feathers, 'left');
  });
}

function narratorPanel(ctx, st, L, g) {
  const r = L.play.narrator;
  if (v3.on) v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: 14, kind: 'parch' });
  else {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#efdfb8'; rrect(ctx, r, 14); ctx.fill();
    ctx.restore();
    ctx.save(); rrect(ctx, r, 14); ctx.clip();
    const gr = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    gr.addColorStop(0, 'rgba(255,248,224,0.6)'); gr.addColorStop(1, 'rgba(200,164,100,0.35)');
    ctx.fillStyle = gr; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; rrect(ctx, r, 14); ctx.stroke();
  }
  const gs = Math.min(r.h * 0.2, 26);
  drawGoose(ctx, r.x + 12 + gs * 1.1, r.y + r.h * 0.5, gs, { flap: g.flap });
  const tx = r.x + 16 + gs * 2.5, tw = r.w - (tx - r.x) - 14;
  const text = g.hint ? g.hint.text : g.narr.text;
  const col = g.hint ? PAL.oxblood : PAL.ink;
  let size = Math.min(30, r.h * 0.2);
  let lines;
  for (let tries = 0; tries < 8; tries++) {
    ctx.font = `700 ${Math.max(size, 12) * 1.1}px ${UI}`;
    lines = wrap(ctx, text, tw);
    if (lines.length * size * 1.28 <= r.h - 16 || size <= 14) break;
    size -= 2;
  }
  const lh = size * 1.28 * 1.1 * 0.92, y0 = r.y + r.h / 2 - ((lines.length - 1) * lh) / 2;
  const a = clamp(g.narr.t / 0.25, 0, 1);
  ctx.save(); ctx.globalAlpha = g.hint ? 1 : 0.35 + 0.65 * a;
  lines.slice(0, 6).forEach((ln, i) => txt(ctx, ln, tx, y0 + i * lh, size, col, { maxW: tw }));
  ctx.restore();
}

function actionsPanel(ctx, st, L, g) {
  const A = L.play.actions, p = g.players[g.cur];
  panel(ctx, A, { fill: 'rgba(24,14,6,0.66)', rad: 16 });
  const human = !g.auto && p.kind === 'human';
  const n = human && g.phase === 'idle' ? 1 : human && g.dec ? g.dec.opts.length : 0;
  const AR = actionRects(L, Math.max(n, 1), true);
  // dice
  const rolling = g.phase === 'rolling';
  const faces = rolling ? g.faces : g.rolled ? g.dice : null;
  AR.dice.forEach((r, i) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (v3.on) { v3.dice.push({ r, i }); return; }       // tumbling 3D dice are drawn by the presenter
    if (!faces) { drawDie(ctx, cx, cy, r.w * 0.92, [3, 4][i], { used: false, rot: (i ? 0.15 : -0.12) }); return; }
    const wob = rolling ? Math.sin(g.rollT * 30 + i * 2) : 0;
    drawDie(ctx, cx + (rolling ? Math.cos(g.rollT * 23 + i) * 6 : 0), cy + (rolling ? wob * 4 : 0), r.w * 0.92, faces[i], { rot: rolling ? g.rollT * (i ? 9 : -8) : (i ? 0.1 : -0.08) });
  });
  // buttons / status
  if (n > 0 && human) {
    if (g.phase === 'idle') {
      const sub = p.stuck ? `In the ${p.stuck}: a double frees you` : `${p.name}'s turn`;
      button(ctx, AR.btns[0], 'Roll the dice', { kind: 'primary', size: 32, icon: 'dice', sub, hot: true });
    } else {
      g.dec.opts.forEach((o, i) => {
        const hot = g.hint && g.hint.id === o.id;
        button(ctx, AR.btns[i], o.label, { kind: o.kind === 'reroll' ? 'gold' : i === 0 ? 'primary' : 'quiet', size: 28, sub: o.sub, hot, subColor: PAL.dim });
      });
    }
  } else {
    // computer's turn or Watch and Learn: show what it is doing
    const r = AR.btns[0];
    const bx = { x: r.x, y: r.y, w: r.w, h: Math.max(r.h, 70) };
    let line = `${p.name} is ${g.phase === 'idle' || g.phase === 'wait' ? 'getting ready' : g.phase === 'rolling' ? 'rolling' : 'on the move'}`;
    let sub = '';
    if (g.phase === 'think') { line = `${p.name} is thinking`; sub = g.auto ? `Think ${Math.ceil(g.think.left)} s` : ''; }
    else if (g.phase === 'reveal') {
      const o = g.dec?.opts.find((q) => q.id === g.dec.pickId);
      line = `${p.name} chooses`; sub = o ? `${o.label}${o.sub ? ': ' + o.sub : ''}` : '';
    } else if (g.phase === 'moving') line = `${p.name} moves`;
    panel(ctx, bx, { fill: 'rgba(247,233,200,0.1)', rad: 14, kind: 'inset' });
    txt(ctx, line, bx.x + bx.w / 2, bx.y + bx.h * (sub ? 0.32 : 0.5), 27, PAL.text, { align: 'center', maxW: bx.w - 16 });
    if (sub) txt(ctx, sub, bx.x + bx.w / 2, bx.y + bx.h * 0.68, 22, PAL.goldHi, { align: 'center', maxW: bx.w - 16 });
    if (g.auto && (g.phase === 'think' || g.phase === 'reveal')) {
      const tot = g.phase === 'think' ? g.think.total : g.revealTotal, left = clamp(g.timer, 0, tot), u = tot > 0 ? 1 - left / tot : 1;
      const br = { x: bx.x + 12, y: bx.y + bx.h + 8, w: bx.w - 24, h: 10 };
      ctx.fillStyle = 'rgba(247,233,200,0.15)'; rrect(ctx, br, 5); ctx.fill();
      ctx.fillStyle = g.phase === 'think' ? PAL.verdHi : PAL.goldHi; rrect(ctx, { x: br.x, y: br.y, w: br.w * u, h: br.h }, 5); ctx.fill();
      txt(ctx, g.phase === 'think' ? 'THINK' : 'REVEAL', br.x + br.w / 2, br.y + 30, 18, PAL.dim, { align: 'center', font: DISPLAY });
      // the options being weighed; at Reveal the choice is starred
      const rowH = 34, y0 = br.y + 62, maxRows = Math.max(0, Math.floor((A.y + A.h - 10 - y0) / rowH));
      (g.dec?.opts ?? []).slice(0, maxRows).forEach((o, i) => {
        const chosen = g.phase === 'reveal' && o.id === g.dec.pickId;
        txt(ctx, `${chosen ? '\u2605 ' : ''}${o.label}${o.sub ? ': ' + o.sub : ''}`, br.x + 6, y0 + i * rowH, 21, chosen ? PAL.goldHi : PAL.dim, { maxW: br.w - 12 });
      });
    }
  }
  // feathers of the player to move
  if (g.variants.feathers) {
    const nr = AR.note, fs = Math.max(11, Math.min(17, nr.w / 3.9));
    txt(ctx, 'Feathers', nr.x + 2, nr.y + nr.h * 0.3, 20, PAL.dim, { maxW: nr.w });
    featherRow(ctx, nr.x + 2, nr.y + nr.h * 0.7, fs, p.feathers, 'left');
  }
}

function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const g = st.g, w = L.w, h = L.h, P = L.play;
  drawDesk(ctx, w, h);
  // top bar
  button(ctx, P.menu, 'Menu', { icon: 'menu', kind: 'ghost', size: 26 });
  button(ctx, P.hint, '', { icon: 'bulb', kind: g.over ? 'disabled' : 'quiet' });
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet' });
  const cx = (P.menu.x + P.menu.w + P.hint.x) / 2;
  if (!L.land || P.bar.w > 700) {
    const label = g.auto ? 'Watch and Learn' : 'Game of the Goose';
    txt(ctx, label, cx, P.menu.y + P.menu.h / 2, 30, PAL.goldHi, { align: 'center', font: DISPLAY, maxW: P.hint.x - (P.menu.x + P.menu.w) - 24 });
  }
  playersStrip(ctx, st, L, g);
  // the board and everything on it
  const hi = g.hi.map((q) => {
    const chosen = g.phase === 'reveal' && g.dec && g.dec.pickId === q.id;
    const hint = g.hint && g.hint.id === q.id;
    return { n: q.n, color: chosen || hint ? '#ffe9a0' : '#f1c25a', strong: !!(chosen || hint) };
  });
  const showRoadFrom = g.dec && g.dec.kind === 'road' ? g.players[g.cur].pos : null;
  v3.hi = hi; v3.roads = { on: !!g.variants.roads, active: showRoadFrom };
  const f = drawBoard(ctx, P.board, { roads: g.variants.roads, hi: v3.on ? null : hi, t: st.t, flap: g.flap, activeRoad: showRoadFrom });
  const { tw, th } = tileSize(f), ts0 = Math.min(tw, th);
  const ts = ts0;
  // pawns, back to front
  const groups = new Map();
  g.players.forEach((p) => { if (!p.vis) { const a = groups.get(p.pos) ?? []; a.push(p.id); groups.set(p.pos, a); } });
  const order = g.players.map((p) => {
    const grp = groups.get(p.pos) ?? [p.id];
    const idx = grp.indexOf(p.id);
    const xy = pawnXY(f, ts, p, st, g, idx < 0 ? 0 : idx, grp.length);
    return { p, xy };
  }).sort((a, b) => a.xy.y - b.xy.y);
  const size = ts * 0.92;
  for (const { p, xy } of order) {
    if (v3.on) {
      if (p.stuck && !p.vis) { const q = v3.sq(p.pos, 0, 0.62); if (q) { ctx.save(); ctx.font = `700 ${q.k * 0.22}px ${UI}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = q.k * 0.06; ctx.strokeStyle = 'rgba(250,240,208,0.9)'; ctx.strokeText(p.stuck === 'well' ? 'in the well' : 'in prison', q.x, q.y); ctx.fillStyle = PAL.oxblood; ctx.fillText(p.stuck === 'well' ? 'in the well' : 'in prison', q.x, q.y); ctx.restore(); } }
      continue;
    }
    const isCur = p.id === g.cur && !g.over;
    const bob = isCur && !st.prefs.calm && !p.vis ? Math.sin(st.t * 4) * ts * 0.04 : 0;
    drawPawn(ctx, xy.x, xy.y + ts * 0.18, size, p.seat, { num: p.seat + 1, lift: xy.lift + bob + (isCur ? ts * 0.04 : 0), ring: isCur ? '#ffe9a0' : null });
    if (p.stuck && !p.vis) {
      ctx.save(); ctx.font = `700 ${ts * 0.3}px ${UI}`; ctx.textAlign = 'center'; ctx.fillStyle = PAL.oxblood; ctx.fillText(p.stuck === 'well' ? 'in the well' : 'in prison', xy.x, xy.y + ts * 0.62); ctx.restore();
    }
  }
  // pops (Goose!, Bridge!...) with a few drifting feathers
  for (const q of g.pops) {
    const q3 = v3.on ? v3.sq(q.n, 0, 0) : null;
    const c = q3 ?? (q.n === FINAL ? { x: f.cx, y: f.cy } : spotXY(f, q.n));
    const ts = q3 ? q3.k * 0.75 : ts0;
    const u = q.age / 1.4, y = c.y - ts * 0.6 - u * ts * 1.2;
    ctx.save(); ctx.globalAlpha = clamp(1.6 - u * 1.6, 0, 1);
    txt(ctx, q.text, c.x, y, Math.max(26, ts * 0.52), q.col, { align: 'center', font: DISPLAY, stroke: 6, strokeColor: 'rgba(30,14,2,0.9)', maxW: f.w * 0.5 });
    if (q.fx === 'feather' && !st.prefs.calm && !v3.on) {
      for (let i = 0; i < 7; i++) {
        const a = hash(i * 3 + q.n) * TAU, d = ts * (0.3 + u * (0.8 + hash(i + 5) * 0.8));
        drawFeather(ctx, c.x + Math.cos(a) * d, c.y - ts * 0.2 + Math.sin(a) * d * 0.7 + u * ts * 0.8, ts * 0.22, a + u * 3);
      }
    }
    ctx.restore();
  }
  narratorPanel(ctx, st, L, g);
  actionsPanel(ctx, st, L, g);
  if (g.paused) drawPauseMenu(ctx, st, L, pauseItems(g), g);
  meta.previewBadge = { x: P.board.x + P.board.w / 2, y: P.board.y + 8, align: 'center' };
}

const PAUSE_LABELS = { resume: 'Resume', restart: 'New game', quit: 'Main menu', exit: 'Exit' };
function drawPauseMenu(ctx, st, L, items) {
  if (v3.on) v3.scrim = 0.68; else { ctx.fillStyle = 'rgba(10,6,2,0.65)'; ctx.fillRect(0, 0, L.w, L.h); }
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(32,20,10,0.96)', rad: 24 });
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 50, 40, PAL.goldHi, { align: 'center', font: DISPLAY });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' ? 'primary' : 'quiet', size: 30 }));
}

// ---- title -------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  drawDesk(ctx, w, h);
  // the hero: the board, with a pawn walking its spiral
  const hr = T.hero, side = Math.min(hr.w, hr.h) * 0.98;
  const brect = { x: hr.x + (hr.w - side) / 2, y: hr.y + (hr.h - side) / 2, w: side, h: side };
  ctx.save();
  ctx.translate(brect.x + side / 2, brect.y + side / 2); ctx.rotate(Math.sin(st.t * 0.3) * 0.015); ctx.translate(-(brect.x + side / 2), -(brect.y + side / 2));
  if (v3.on) { v3.heroRect = brect; ctx.restore(); }
  else {
    const f = drawBoard(ctx, brect, { t: st.t, flap: 0 });
    const { tw, th } = tileSize(f), ts = Math.min(tw, th);
    const pos = (st.t * 2.2) % 63;
    const n0 = Math.floor(pos), u = pos - n0;
    const a = spotXY(f, n0 === 0 ? 1 : n0), b = spotXY(f, Math.min(63, n0 + 1));
    drawPawn(ctx, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + ts * 0.18, ts * 0.9, 0, { num: 1, lift: Math.sin(u * Math.PI) * ts * 0.4 });
    ctx.restore();
  }
  const cx = T.titleX;
  if (v3.on) {
    const tw0 = L.land ? T.play.x - S.x - 40 : S.w - 24;
    v3.panels.push({ r: { x: cx - tw0 / 2, y: T.titleY - T.size * 0.78, w: tw0, h: T.size * 1.95 }, rad: 18, kind: 'sign' });
  }
  titleText(ctx, cx, T.titleY, T.size, 'Game of the Goose', (L.land ? T.play.x - S.x - 90 : S.w - 70));
  txt(ctx, 'The spiral race of geese, bridges and wells', cx, T.titleY + T.size * 0.66, Math.min(26, T.size * 0.34), PAL.text, { align: 'center', maxW: (L.land ? T.play.x - S.x - 60 : S.w - 50), stroke: 5 });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = L.land ? 190 : 250;
  if (!drawLockup(ctx, T.credit.x, T.credit.y - lw * 0.1, lw)) drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.9 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_GAMES - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(30,18,8,0.8)' });
}

// ---- setup ------------------------------------------------------------------------------------------------------------------------
function renderSetup(ctx, st, L, w, h) {
  const U = L.setup, S = L.S, p = st.prefs;
  drawDesk(ctx, w, h);
  button(ctx, U.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'New game', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), U.titleY, 40, PAL.goldHi, { align: 'center', font: DISPLAY, stroke: 6, maxW: S.w - 380 });
  txt(ctx, 'Who is at the table? Tap a seat to change it.', U.seats.x, U.seats.y - 18, 24, PAL.text, { maxW: U.seats.w });
  U.seatCards.forEach((r, i) => {
    const s = p.seats[i];
    const on = !!s;
    if (v3.on) v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: 16, kind: on ? 'parch' : 'slate' });
    else {
      ctx.fillStyle = on ? 'rgba(239,223,184,0.95)' : 'rgba(30,18,8,0.6)'; rrect(ctx, r, 16); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = on ? PAL.ink : 'rgba(227,174,63,0.25)'; rrect(ctx, r, 16); ctx.stroke();
    }
    const ps = Math.min(r.h * 0.5, 46);
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.35; drawPawn(ctx, r.x + ps * 0.9, r.y + r.h * 0.74, ps, i, { num: i + 1 }); ctx.restore();
    const tx = r.x + ps * 1.7;
    txt(ctx, ROSTER[i].name, tx, r.y + r.h * 0.34, Math.min(26, r.h * 0.26), on ? PAL.ink : PAL.dim, { maxW: r.w - (tx - r.x) - 8 });
    txt(ctx, s === 'human' ? 'Human' : s === 'cpu' ? 'Computer' : 'Empty seat', tx, r.y + r.h * 0.68, Math.min(24, r.h * 0.24), s === 'human' ? PAL.verd : on ? PAL.oxblood : PAL.dim, { maxW: r.w - (tx - r.x) - 8 });
  });
  txt(ctx, 'Variant rules (optional)', U.varArea.x, U.varArea.y - 18, 24, PAL.text, { maxW: U.varArea.w });
  U.varRows.forEach((r, i) => {
    const key = VARIANT_KEYS[i], on = p.variants[key];
    if (v3.on) v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: 16, kind: 'parch' });
    else { ctx.fillStyle = 'rgba(239,223,184,0.95)'; rrect(ctx, r, 16); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; rrect(ctx, r, 16); ctx.stroke(); }
    const tw = 88, thh = 44, tr = { x: r.x + r.w - tw - 16, y: r.y + (r.h - thh) / 2, w: tw, h: thh };
    if (v3.on) v3.buttons.push({ r: tr, rad: thh / 2, kind: on ? 'on' : 'ghost', hot: false });
    else { ctx.fillStyle = on ? '#2f7a6e' : 'rgba(42,24,9,0.25)'; rrect(ctx, tr, thh / 2); ctx.fill(); }
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(on ? tr.x + tw - thh / 2 : tr.x + thh / 2, tr.y + thh / 2, thh / 2 - 5, 0, TAU); ctx.fill();
    txt(ctx, VARIANT_INFO[key].name, r.x + 16, r.y + r.h * 0.34, Math.min(28, r.h * 0.27), PAL.ink, { maxW: r.w - tw - 48 });
    const lines = (() => { ctx.font = `700 ${Math.min(22, r.h * 0.2) * 1.1}px ${UI}`; return wrap(ctx, VARIANT_INFO[key].short, r.w - tw - 48); })();
    lines.slice(0, 2).forEach((ln, k) => txt(ctx, ln, r.x + 16, r.y + r.h * 0.6 + k * Math.min(24, r.h * 0.22), Math.min(22, r.h * 0.2), PAL.sepia, { maxW: r.w - tw - 48 }));
  });
  const classic = VARIANT_KEYS.every((k) => !p.variants[k]);
  button(ctx, U.start, 'Start the game', { kind: 'primary', size: 36, icon: 'play', sub: classic ? 'The classic game, pure chance' : 'With the variants you switched on' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, w, h) {
  const Rr = L.result, r = st.result, p = Rr.panel;
  drawDesk(ctx, w, h);
  drawSheet(ctx, p, 5);
  edgeStroke(ctx, p, 14, 0.35);
  const cx = p.x + p.w / 2, wide = L.land;
  txt(ctx, r.auto ? 'The game is over' : r.humanWon ? 'You win the Garden!' : `${r.winnerName} wins!`, cx, p.y + 56, 38, PAL.oxblood, { align: 'center', font: DISPLAY, maxW: p.w - 60 });
  txt(ctx, `${r.winnerName} landed exactly on 63 in ${r.turns} ${r.turns === 1 ? 'turn' : 'turns'}`, cx, p.y + 104, 26, PAL.ink, { align: 'center', maxW: p.w - 60 });
  if (r.newBest) txt(ctx, 'Your fastest win so far', cx, p.y + 140, 24, PAL.verd, { align: 'center' });
  const top = p.y + (r.newBest ? 176 : 150), rowH = Math.min(wide ? 52 : 92, (Rr.again.y - 60 - top) / Math.max(1, r.rows.length));
  txt(ctx, 'Tally', cx, top - 2, 22, PAL.sepia, { align: 'center', font: DISPLAY });
  r.rows.forEach((row, i) => {
    const y = top + 26 + i * rowH + rowH / 2;
    const x0 = p.x + 36, x1 = p.x + p.w - 36;
    if (row.winner) { ctx.fillStyle = 'rgba(227,174,63,0.3)'; rrect(ctx, { x: x0 - 8, y: y - rowH / 2 + 3, w: x1 - x0 + 16, h: rowH - 6 }, 12); ctx.fill(); }
    txt(ctx, `${i + 1}`, x0 + 6, y, 26, PAL.sepia, { font: DISPLAY });
    drawPawn(ctx, x0 + 58, y + rowH * 0.28, Math.min(rowH * 0.8, 40), row.seat, { num: row.seat + 1 });
    txt(ctx, row.name, x0 + 100, y, 26, PAL.ink, { maxW: (x1 - x0) * 0.34 });
    txt(ctx, `space ${row.pos}`, x0 + (x1 - x0) * 0.58, y, 22, PAL.sepia, { align: 'center' });
    if (r.variants.feathers) featherRow(ctx, x0 + (x1 - x0) * 0.74, y, 16, row.feathers, 'center');
    txt(ctx, String(row.tally), x1, y, 30, PAL.oxblood, { align: 'right', font: DISPLAY });
  });
  button(ctx, Rr.again, r.auto ? 'Watch again' : 'Play again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.setup, r.auto ? 'Menu' : 'New setup', { kind: 'parch', size: 30 });
  button(ctx, Rr.menu, 'Main menu', { kind: 'parch', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  drawSheet(ctx, p, 8);
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 40, PAL.oxblood, { align: 'center', font: DISPLAY, maxW: p.w - 40 });
  txt(ctx, 'The full game has every seat, variant and', p.x + p.w / 2, p.y + 160, 26, PAL.ink, { align: 'center', maxW: p.w - 40 });
  txt(ctx, 'rule, with no limit on games.', p.x + p.w / 2, p.y + 200, 26, PAL.ink, { align: 'center', maxW: p.w - 40 });
  txt(ctx, 'Get Game of the Goose for iPhone and Android.', p.x + p.w / 2, p.y + 270, 26, PAL.verd, { align: 'center', maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.sepia, { align: 'center' });
}

function settingsBlocks(st) {
  const p = st.prefs, s = st.stats;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('speed', 'Game speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How fast pawns and computer turns move'),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn thinks this long before each decision'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No bobbing pawns or drifting feathers'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [st.owned()
      ? row('restore', 'Full game unlocked', 'info', () => 'Owned', 'Thank you for playing')
      : row('restore', 'Restore purchase', 'button', () => '', st.restoreMsg || 'Already bought it? Get it back', { btn: st.restoreBusy ? 'Wait...' : 'Restore' })]),
    { h: 'Your record' },
    row('s1', 'Games played', 'info', () => s.played),
    row('s2', 'Games won', 'info', () => s.won),
    row('s3', 'Fastest win', 'info', () => (s.bestTurns ? `${s.bestTurns} turns` : 'none yet')),
    row('s4', 'Feathers gathered', 'info', () => s.feathers),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  v3.scene = sc;
  v3.scrim = sc === 'play' || sc === 'title' ? 0 : sc === 'setup' ? 0.5 : 0.62;
  if (sc !== 'title') v3.heroRect = null;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); return; }
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'setup') renderSetup(ctx, st, L, w, h);
  else if (sc === 'result') renderResult(ctx, st, L, w, h);
  else if (sc === 'demo-limit') { drawDesk(ctx, w, h); renderDemoLimit(ctx, st, L); }
  else {
    drawDesk(ctx, w, h);
    if (sc === 'rules') { const pg = rulesPages(); renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `Rules  ${st.rulesPage + 1}/${pg.length}  ${pg[st.rulesPage].title}`, blocks: pg[st.rulesPage].blocks, nav: true, page: st.rulesPage, pages: pg.length }); }
    else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: ABOUT.title, blocks: ABOUT.blocks });
    else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: HOWTO.title, blocks: HOWTO.blocks });
    else if (sc === 'settings') renderDoc(ctx, st, L, { key: `settings|${st.demo}|${st.owned()}|${st.restoreBusy}|${st.restoreMsg}`, title: 'Settings', blocks: settingsBlocks(st) });
  }
}
void PLAYER_COLORS; void SPOT; void TEXT_SCALES; void TALLY; void icon; void frameOf;
