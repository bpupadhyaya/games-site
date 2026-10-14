// Drawing for every screen. render() is the single entry point; the board lives in boardview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, SEAT, TAU, clamp, ease, hash, drawDesk, drawSheet, drawBead, drawBean, rr, fretBand } from './art.js';
import { txt, button, panel, plate, rrect, chip, wrap, minUnits } from './ui.js';
import { v3 } from './v3.js';
import { renderDoc } from './docview.js';
import { ABOUT, HOWTO, rulesPages } from './content.js';
import { drawBoard, frameOf, piecePos, loopXY, centreXY } from './boardview.js';
import { actionRects, menuRects, host } from './layout.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockupImage } from './brand.js';
import { RULE_KEYS, RULE_INFO, HOME, LOOP, QUARTER, STEPS, loopIdx } from './engine.js';
import { THINK_CHOICES, SPEEDS, DEMO_GAMES, ROSTER } from './rulesdata.js';

// ---- small pieces ----------------------------------------------------------------------------------------------------------------------
function titleText(ctx, cx, y, size, label, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 ${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(label).width;
  if (w0 > maxW) { size *= maxW / w0; ctx.font = `400 ${size}px ${DISPLAY}`; }
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff0b8'); g.addColorStop(0.5, '#f0b940'); g.addColorStop(1, '#a8651a');
  ctx.lineJoin = 'round';
  if (v3.on) {
    // carved-gold lettering: stacked extrusion down and right, a lit top face, a bright rim and a soft torch glow
    const n = Math.max(6, Math.round(size * 0.14)), dx = size * 0.012, dy = size * 0.014;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.1;
    ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#120a04'; ctx.strokeText(label, cx + dx * n, y + dy * n);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    for (let k = n; k >= 1; k--) {
      const t = k / n; ctx.fillStyle = `rgb(${Math.round(70 + 60 * (1 - t))},${Math.round(38 + 36 * (1 - t))},${Math.round(8 + 10 * (1 - t))})`;
      ctx.lineWidth = size * 0.2; ctx.strokeStyle = ctx.fillStyle; ctx.strokeText(label, cx + dx * k, y + dy * k); ctx.fillText(label, cx + dx * k, y + dy * k);
    }
    ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#2a1608'; ctx.strokeText(label, cx, y);
    ctx.shadowColor = 'rgba(255,190,70,0.55)'; ctx.shadowBlur = size * 0.3; ctx.fillStyle = g; ctx.fillText(label, cx, y);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.5, size * 0.022); ctx.strokeStyle = 'rgba(255,248,214,0.85)'; ctx.strokeText(label, cx, y - size * 0.006);
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const sh = ctx.createLinearGradient(cx - size * 3, y - size * 0.5, cx + size * 3, y + size * 0.1); sh.addColorStop(0.42, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.58, 'rgba(255,255,255,0)');
    ctx.restore();
    ctx.restore();
    return;
  }
  ctx.lineWidth = size * 0.18; ctx.strokeStyle = '#1a0f06'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,190,70,0.4)'; ctx.shadowBlur = size * 0.22; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
}

// A row of n small beads: home (gold ring), on the track (seat colour), in the pit (hollow).
function pieceDots(ctx, x, y, size, pieces, seat, align = 'left') {
  const gap = size * 1.25, total = gap * pieces.length;
  const x0 = align === 'center' ? x - total / 2 : x;
  pieces.forEach((p, i) => {
    const cx = x0 + gap * (i + 0.5), c = SEAT[seat % 4];
    ctx.beginPath(); ctx.arc(cx, y, size * 0.5, 0, TAU);
    if (p >= HOME) { ctx.fillStyle = PAL.gold; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#7a4d0a'; ctx.stroke(); }
    else if (p > 0) { ctx.fillStyle = c.base; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = c.lo; ctx.stroke(); }
    else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,236,216,0.45)'; ctx.stroke(); }
  });
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
    plate(ctx, rect, { on: isCur, ring: isCur ? SEAT[p.seat % 4].base : null, rad: 14 });
    const ps = Math.min(ch * 0.7, cw * 0.28, 54), mid = cy + ch / 2;
    drawBead(ctx, cx + ps * 0.62, mid + ps * 0.12, ps, p.seat, { ring: isCur ? PAL.goldHi : null });
    const tx = cx + ps * 1.25 + 6, tw = cw - (tx - cx) - 8;
    const dark = isCur ? PAL.ink : PAL.text;
    txt(ctx, p.name, tx, mid - Math.min(ch * 0.2, 18), Math.min(25, ch * 0.3), dark, { maxW: tw });
    const home = p.pieces.filter((q) => q >= HOME).length;
    pieceDots(ctx, tx, mid + Math.min(ch * 0.22, 20), Math.min(15, ch * 0.2, (tw / p.pieces.length) / 1.35), p.pieces, p.seat);
    void home;
  });
}

function narratorPanel(ctx, st, L, g) {
  const r = L.play.narrator;
  drawSheet(ctx, r, 14);
  const gs = Math.min(r.h * 0.22, 28);
  // the bean mark beside the words
  drawBean(ctx, r.x + 16 + gs * 0.9, r.y + r.h * 0.5, gs * 1.8, g.marks > 0 && g.thrown, { rot: -0.4 });
  const tx = r.x + 24 + gs * 2.1, tw = r.w - (tx - r.x) - 14;
  const text = g.hint ? g.hint.text : g.narr.text;
  const col = g.hint ? '#9a3b1f' : PAL.ink;
  let size = Math.min(30, r.h * (r.h < 90 ? 0.36 : 0.2));
  let lines;
  for (let tries = 0; tries < 8; tries++) {
    ctx.font = `600 ${Math.max(size, minUnits())}px ${UI}`;
    lines = wrap(ctx, text, tw);
    if (lines.length * size * 1.28 <= r.h - 26 || size <= 14) break;
    size -= 2;
  }
  const lh = size * 1.28, y0 = r.y + 12 + (r.h - 12) / 2 - ((lines.length - 1) * lh) / 2;
  const a = clamp(g.narr.t / 0.25, 0, 1);
  ctx.save(); ctx.globalAlpha = g.hint ? 1 : 0.35 + 0.65 * a;
  lines.slice(0, 6).forEach((ln, i) => txt(ctx, ln, tx, y0 + i * lh, size, col, { maxW: tw }));
  ctx.restore();
}

function actionsPanel(ctx, st, L, g) {
  const A = L.play.actions, p = g.players[g.cur];
  panel(ctx, A, { fill: 'rgba(12,16,20,0.62)', rad: 16 });
  const human = !g.auto && p.kind === 'human';
  const n = human && g.phase === 'idle' ? 1 : human && g.dec ? 2 : 0;
  const AR = actionRects(L, Math.max(n, 1));
  // beans
  const throwing = g.phase === 'throwing';
  AR.beans.forEach((r, i) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (v3.on) { v3.beans.push({ r, i, marked: g.thrown ? g.beans[i] : false, thrown: g.thrown, throwing }); return; }
    if (throwing) {
      const t = g.throwT, flick = Math.floor(t * 13 + i * 3.1) % 2 === 0;
      drawBean(ctx, cx + Math.cos(t * 17 + i) * 4, cy, r.w * 0.92, flick, { rot: t * (i % 2 ? 9 : -8) + i, flip: t * (2.5 + i * 0.4), lift: Math.abs(Math.sin(t * 6 + i)) * r.h * 0.35 });
    } else drawBean(ctx, cx, cy, r.w * 0.92, g.thrown ? g.beans[i] : false, { rot: (i - 2) * 0.22 + (i % 2 ? 0.1 : -0.1) });
  });
  // the step table: what each throw is worth (the throw that was just made is lit)
  {
    const last = AR.btns[AR.btns.length - 1], baseY = (n > 0 && human ? last.y + last.h : AR.beans[AR.beans.length - 1].y + AR.beans[AR.beans.length - 1].h + (n > 0 ? 0 : 150)) + 14;
    const tw = A.w - 20, cols = tw / 6 >= 96 ? 6 : 3, rowsN = 6 / cols, th = 60, need = rowsN * (th + 6);
    const ty = Math.min(baseY, A.y + A.h - need - 8);
    if (human && n > 0 && ty >= baseY - 2 && ty + need <= A.y + A.h - 4 && !AR.wide) {
      const cw = tw / cols;
      for (let k = 0; k < 6; k++) {
        const r = { x: A.x + 10 + (k % cols) * cw + 2, y: ty + Math.floor(k / cols) * (th + 6), w: cw - 4, h: th };
        const lit = g.thrown && g.marks === k;
        ctx.fillStyle = lit ? 'rgba(232,182,69,0.28)' : 'rgba(244,236,216,0.07)'; rrect(ctx, r, 10); ctx.fill();
        if (lit) { ctx.lineWidth = 2; ctx.strokeStyle = PAL.goldHi; rrect(ctx, r, 10); ctx.stroke(); }
        txt(ctx, k === 0 ? 'none' : `${k} marked`, r.x + r.w / 2, r.y + th * 0.32, 19, PAL.dim, { align: 'center', maxW: r.w - 6 });
        txt(ctx, `${STEPS[k]} ${STEPS[k] === 1 ? 'step' : 'steps'}`, r.x + r.w / 2, r.y + th * 0.7, 23, lit ? PAL.goldHi : PAL.text, { align: 'center', maxW: r.w - 6 });
      }
    }
  }
  if (n > 0 && human) {
    if (g.phase === 'idle') {
      button(ctx, AR.btns[0], 'Throw the beans', { kind: 'primary', size: 32, icon: 'beans', sub: `${p.name}'s turn`, hot: true });
    } else {
      const dec = g.dec, sel = dec.moves[dec.sel], inf = dec.info[dec.sel];
      button(ctx, AR.btns[0], 'Move', { kind: 'primary', size: 30, icon: 'play', sub: `${inf.label}: ${inf.sub}`, hot: true });
      button(ctx, AR.btns[1], 'Next piece', { kind: 'quiet', size: 28, icon: 'next', sub: `Choice ${dec.sel + 1} of ${dec.moves.length}` });
      void sel;
    }
  } else {
    const r = AR.btns[0];
    const bx = { x: r.x, y: r.y, w: r.w, h: Math.max(r.h, 70) };
    let line = `${p.name} is ${g.phase === 'idle' || g.phase === 'wait' ? 'getting ready' : g.phase === 'throwing' ? 'throwing' : 'on the move'}`;
    let sub = '';
    if (g.phase === 'think') { line = `${p.name} is thinking`; sub = g.auto ? `Think ${Math.ceil(g.think.left)} s` : ''; }
    else if (g.phase === 'reveal') {
      const o = g.dec?.info[g.dec.pick];
      line = `${p.name} chooses`; sub = o ? `${o.label}: ${o.sub}` : '';
    } else if (g.phase === 'moving') line = `${p.name} moves`;
    panel(ctx, bx, { fill: 'rgba(244,236,216,0.08)', rad: 14 });
    txt(ctx, line, bx.x + bx.w / 2, bx.y + bx.h * (sub ? 0.32 : 0.5), 27, PAL.text, { align: 'center', maxW: bx.w - 16 });
    if (sub) txt(ctx, sub, bx.x + bx.w / 2, bx.y + bx.h * 0.68, 21, PAL.goldHi, { align: 'center', maxW: bx.w - 16 });
    if (g.auto && (g.phase === 'think' || g.phase === 'reveal')) {
      const tot = g.phase === 'think' ? g.think.total : g.revealTotal, left = clamp(g.timer, 0, tot), u = tot > 0 ? 1 - left / tot : 1;
      const br = { x: bx.x + 12, y: bx.y + bx.h + 8, w: bx.w - 24, h: 10 };
      ctx.fillStyle = 'rgba(244,236,216,0.15)'; rrect(ctx, br, 5); ctx.fill();
      ctx.fillStyle = g.phase === 'think' ? PAL.turquoise : PAL.goldHi; rrect(ctx, { x: br.x, y: br.y, w: br.w * u, h: br.h }, 5); ctx.fill();
      txt(ctx, g.phase === 'think' ? 'THINK' : 'REVEAL', br.x + br.w / 2, br.y + 30, 17, PAL.dim, { align: 'center', font: DISPLAY });
      const rowH = 34, y0 = br.y + 62, maxRows = Math.max(0, Math.floor((A.y + A.h - 10 - y0) / rowH));
      (g.dec?.info ?? []).slice(0, maxRows).forEach((o, i) => {
        const chosen = g.phase === 'reveal' && i === g.dec.pick;
        txt(ctx, `${chosen ? '★ ' : ''}${o.label}: ${o.sub}`, br.x + 6, y0 + i * rowH, 20, chosen ? PAL.goldHi : PAL.dim, { maxW: br.w - 12 });
      });
    }
  }
}

// ---- the play screen --------------------------------------------------------------------------------------------------------------------
function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const g = st.g, w = L.w, h = L.h, P = L.play;
  drawDesk(ctx, w, h);
  button(ctx, P.menu, 'Menu', { icon: 'menu', kind: 'ghost', size: 26 });
  button(ctx, P.hint, '', { icon: 'bulb', kind: g.over ? 'disabled' : 'quiet' });
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet' });
  const cx = (P.menu.x + P.menu.w + P.hint.x) / 2;
  // The free-preview pill sits in the title slot of the top bar (it would otherwise cover board squares); owners and demo see the title.
  const pillHere = !g.auto && !st.demo && !st.owned();
  const wide = !L.land || P.bar.w > 700;
  if (wide && !pillHere) {
    const label = g.auto ? 'Watch and Learn' : 'Patolli';
    txt(ctx, label, cx, P.menu.y + P.menu.h / 2, 30, PAL.goldHi, { align: 'center', font: DISPLAY, maxW: P.hint.x - (P.menu.x + P.menu.w) - 24 });
  }
  if (!(v3.on && g.paused)) playersStrip(ctx, st, L, g);
  // the board and everything on it
  const armSeat = [null, null, null, null];
  g.players.forEach((p) => { armSeat[p.arm] = p.seat; });
  const f = v3.on ? frameOf(P.board) : drawBoard(ctx, P.board, { armSeat });
  v3.heroSeats = armSeat;
  const c = f.cell;
  const cp = g.players[g.cur];

  // highlights: movable pieces, the selected one's path
  const dec = g.dec;
  const showSel = dec && (g.phase === 'decide' || g.phase === 'reveal' || g.phase === 'think');
  if (showSel) {
    const chosen = g.phase === 'decide' ? dec.sel : g.phase === 'reveal' ? dec.pick : -1;
    const pulse = st.prefs.calm ? 0.5 : 0.5 + 0.5 * Math.sin(st.t * 6);
    dec.moves.forEach((m, i) => {
      cp.pieces.forEach((q, j) => {
        if (q !== m.from) return;
        const pos = piecePos(f, cp.arm, j, q);
        const sel = i === chosen;
        if (v3.on) return;
        ctx.save();
        ctx.lineWidth = sel ? 5 : 3; ctx.strokeStyle = sel ? PAL.goldHi : `rgba(255,236,170,${0.45 + 0.4 * pulse})`;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, c * (sel ? 0.5 : 0.46 + 0.04 * pulse), 0, TAU); ctx.stroke();
        ctx.restore();
      });
    });
    if (chosen >= 0 && dec.moves[chosen]) {
      const m = dec.moves[chosen], j = m.j;
      const d = piecePos(f, cp.arm, j, m.to);
      if (!v3.on) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,224,130,0.9)'; ctx.lineWidth = Math.max(3, c * 0.09); ctx.setLineDash([c * 0.16, c * 0.16]); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let q = m.from; q <= m.to; q++) { const pp = piecePos(f, cp.arm, j, q); if (q === m.from) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y); }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 5; ctx.strokeStyle = m.cap ? '#ff9a7a' : PAL.goldHi;
        ctx.beginPath(); ctx.arc(d.x, d.y, c * (0.44 + (st.prefs.calm ? 0 : 0.05 * Math.sin(st.t * 7))), 0, TAU); ctx.stroke();
        ctx.restore();
      }
      // place numbers on the standing piece and on its landing square
      const tag = (pt, n, col) => chip(ctx, pt.x, pt.y - c * 0.62, String(n), Math.max(15, c * 0.27), { align: 'center', fill: col, color: '#1a0f06' });
      if (m.from > 0) tag(piecePos(f, cp.arm, j, m.from), m.from, 'rgba(255,236,170,0.95)');
      if (m.to < HOME) tag(d, m.to, m.cap ? 'rgba(255,170,140,0.95)' : 'rgba(255,236,170,0.95)');
    }
  }

  // pieces, back to front
  const items = [];
  const groups = new Map();
  g.players.forEach((pl) => pl.pieces.forEach((q, j) => {
    const vis = g.vis && g.vis.id === pl.id && g.vis.j === j ? g.vis : null;
    if (vis) return;
    if (q >= 1 && q < HOME) { const key = q <= LOOP ? `L${loopIdx(pl.arm, q)}` : `S${pl.arm}-${q}`; const a = groups.get(key) ?? []; a.push(`${pl.id}.${j}`); groups.set(key, a); }
  }));
  g.players.forEach((pl) => pl.pieces.forEach((q, j) => {
    let pos, lift = 0, size = c * 0.9;
    const vis = g.vis && g.vis.id === pl.id && g.vis.j === j ? g.vis : null;
    if (vis) {
      const a = piecePos(f, pl.arm, j, vis.from), b = piecePos(f, pl.arm, j, vis.to), u = ease(vis.u);
      pos = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      lift = Math.sin(Math.PI * vis.u) * c * (vis.k === 'fly' ? 1.2 : vis.k === 'slide' ? 0.2 : 0.4);
    } else {
      pos = piecePos(f, pl.arm, j, q);
      if (q >= HOME) size = c * 0.46;
      else if (q >= 1) {
        const key = q <= LOOP ? `L${loopIdx(pl.arm, q)}` : `S${pl.arm}-${q}`, grp = groups.get(key), idx = grp.indexOf(`${pl.id}.${j}`);
        if (grp.length > 1) { const ang = (idx / grp.length) * TAU + 0.8; pos = { x: pos.x + Math.cos(ang) * c * 0.2, y: pos.y + Math.sin(ang) * c * 0.14 }; size = c * 0.78; }
      }
    }
    items.push({ pl, j, pos, lift, size, q });
  }));
  items.sort((a, b) => a.pos.y - b.pos.y);
  const moving = g.vis;
  if (!v3.on) for (const it of items) {
    const isCurMover = moving && moving.id === it.pl.id && moving.j === it.j;
    const bob = !st.prefs.calm && it.pl.id === g.cur && !g.over && !moving && it.q > 0 && it.q < HOME && g.phase !== 'throwing' ? Math.sin(st.t * 4 + it.j) * c * 0.03 : 0;
    drawBead(ctx, it.pos.x, it.pos.y + c * 0.12, it.size, it.pl.seat, { lift: it.lift + bob + (isCurMover ? c * 0.05 : 0) });
  }
  // pops
  for (const q of g.pops) {
    const pl = g.players[q.id], pos = piecePos(f, pl.arm, q.j, q.p >= HOME ? HOME : q.p);
    const cc = q.p >= HOME ? centreXY(f) : pos;
    const u = q.age / 1.4, y = cc.y - c * 0.7 - u * c * 1.1;
    ctx.save(); ctx.globalAlpha = clamp(1.6 - u * 1.6, 0, 1);
    txt(ctx, q.text, cc.x, y, Math.max(26, c * 0.55), q.col, { align: 'center', font: DISPLAY, stroke: 7, strokeColor: 'rgba(10,6,2,0.92)', maxW: f.side * 0.6 });
    if (!st.prefs.calm && !v3.on) {
      for (let i = 0; i < 7; i++) {
        const a = hash(i * 3 + q.p) * TAU, d = c * (0.2 + u * (0.7 + hash(i + 5) * 0.8));
        ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(cc.x + Math.cos(a) * d, cc.y + Math.sin(a) * d * 0.8, c * 0.07 * (1 - u * 0.6), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  if (!(v3.on && g.paused)) { narratorPanel(ctx, st, L, g); actionsPanel(ctx, st, L, g); }
  if (g.paused) drawPauseMenu(ctx, st, L, pauseItems(g), g);
  const pph = Math.max(16, 11.5 / Math.max(0.2, host.px || 1)) * 1.7;
  meta.previewBadge = { x: (P.menu.x + P.menu.w + P.hint.x) / 2, y: P.menu.y + (P.menu.h - pph) / 2, align: 'center' };
}

const PAUSE_LABELS = { resume: 'Resume', restart: 'New game', quit: 'Main menu', exit: 'Exit' };
function drawPauseMenu(ctx, st, L, items) {
  if (v3.on) v3.scrim = 0.62; else { ctx.fillStyle = 'rgba(5,8,12,0.68)'; ctx.fillRect(0, 0, L.w, L.h); }
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(22,30,38,0.97)', rad: 24, kind: 'slate' });
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 50, 40, PAL.goldHi, { align: 'center', font: DISPLAY });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' ? 'primary' : 'quiet', size: 30 }));
}

// ---- title -------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  drawDesk(ctx, w, h);
  // the hero: the stone cross, with two beads walking its outline
  const hr = T.hero, side = Math.min(hr.w, hr.h) * 0.98;
  const brect = { x: hr.x + (hr.w - side) / 2, y: hr.y + (hr.h - side) / 2, w: side, h: side };
  v3.heroRect = brect; v3.heroSeats = [0, null, 1, null];
  const f = v3.on ? frameOf(brect) : drawBoard(ctx, brect, { armSeat: [0, null, 1, null] });
  const c = f.cell;
  const t = st.t * 2.4;
  if (!v3.on) [[0, 0], [1, 16]].forEach(([seat, off]) => {
    const pos = (t + off) % LOOP, n0 = Math.floor(pos), u = pos - n0;
    const a = loopXY(f, n0 % LOOP), b = loopXY(f, (n0 + 1) % LOOP);
    drawBead(ctx, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + c * 0.12, c * 0.9, seat, { lift: Math.sin(u * Math.PI) * c * 0.3 });
  });
  const cx = T.titleX;
  titleText(ctx, cx, T.titleY, T.size, 'PATOLLI', (L.land ? T.play.x - S.x - 60 : S.w - 30));
  txt(ctx, 'The ancient cross-and-beans race', cx, T.titleY + T.size * 0.7, Math.min(26, T.size * 0.34), PAL.text, { align: 'center', maxW: (L.land ? T.play.x - S.x - 60 : S.w - 50), stroke: 5 });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  if (!drawLockupImage(ctx, T.credit.x, T.credit.y + 6, Math.min(S.w - 40, 300))) drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.9 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_GAMES - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(12,16,20,0.8)' });
}

// ---- setup ------------------------------------------------------------------------------------------------------------------------
function renderSetup(ctx, st, L, w, h) {
  const U = L.setup, S = L.S, p = st.prefs;
  drawDesk(ctx, w, h);
  button(ctx, U.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'New game', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), U.titleY, 40, PAL.goldHi, { align: 'center', font: DISPLAY, stroke: 6, maxW: S.w - 380 });
  txt(ctx, 'Who is at the stone? Tap a seat to change it.', U.seats.x, U.seats.y - 18, 24, PAL.text, { maxW: U.seats.w });
  U.seatCards.forEach((r, i) => {
    const s = p.seats[i], on = !!s;
    plate(ctx, r, { on, ring: on ? SEAT[i].base : null, rad: 16, lw: 3 });
    const ps = Math.min(r.h * 0.62, 56);
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.35; drawBead(ctx, r.x + ps * 0.8, r.y + r.h * 0.62, ps, i); ctx.restore();
    const tx = r.x + ps * 1.55;
    txt(ctx, ROSTER[i].name, tx, r.y + r.h * 0.34, Math.min(28, r.h * 0.27), on ? PAL.ink : PAL.dim, { maxW: r.w - (tx - r.x) - 8 });
    txt(ctx, s === 'human' ? 'Human' : s === 'cpu' ? 'Computer' : 'Empty seat', tx, r.y + r.h * 0.7, Math.min(25, r.h * 0.24), s === 'human' ? PAL.good : on ? '#9a3b1f' : PAL.dim, { maxW: r.w - (tx - r.x) - 8 });
  });
  txt(ctx, 'The table', U.varArea.x, U.varArea.y - 18, 24, PAL.text, { maxW: U.varArea.w });
  U.varRows.forEach((r, i) => {
    plate(ctx, r, { on: true, rad: 16, lw: 2 });
    const tw = 104, thh = 44;
    let name, short;
    if (i === 0) {
      name = 'Pieces each'; short = p.pieces === 6 ? 'Six: the classic number, a long game.' : p.pieces === 4 ? 'Four: the standard game.' : 'Three: a quick game.';
      txt(ctx, `${p.pieces}`, r.x + r.w - 52, r.y + r.h / 2, 46, '#9a3b1f', { align: 'center', font: DISPLAY });
    } else {
      const key = RULE_KEYS[i - 1], on = p.rules[key];
      name = RULE_INFO[key].name; short = RULE_INFO[key].short;
      const tr = { x: r.x + r.w - tw - 16, y: r.y + (r.h - thh) / 2, w: tw, h: thh };
      ctx.fillStyle = on ? '#1f8a62' : 'rgba(43,26,13,0.28)'; rrect(ctx, tr, thh / 2); ctx.fill();
      ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(on ? tr.x + tw - thh / 2 : tr.x + thh / 2, tr.y + thh / 2, thh / 2 - 5, 0, TAU); ctx.fill();
    }
    txt(ctx, name, r.x + 16, r.y + r.h * 0.32, Math.min(28, r.h * 0.27), PAL.ink, { maxW: r.w - tw - 40 });
    ctx.font = `600 ${Math.max(Math.min(22, r.h * 0.2), minUnits())}px ${UI}`;
    const lines = wrap(ctx, short, r.w - tw - 40);
    lines.slice(0, 2).forEach((ln, k) => txt(ctx, ln, r.x + 16, r.y + r.h * 0.6 + k * Math.min(24, r.h * 0.22), Math.min(22, r.h * 0.2), PAL.sepia, { maxW: r.w - tw - 40 }));
  });
  const lastRow = U.varRows[U.varRows.length - 1], free = U.start.y - (lastRow.y + lastRow.h) - 40;
  if (free >= 200) {
    const side = Math.min(free, U.varArea.w * 0.8, 520), seatsOn = p.seats.map((s, i) => (s ? i : null)).filter((x) => x !== null);
    const arms = seatsOn.length === 2 ? [0, 2] : [0, 1, 2, 3], armSeat = [null, null, null, null];
    seatsOn.forEach((sn, k) => { armSeat[arms[k] ?? k] = sn; });
    const mr = { x: U.varArea.x + (U.varArea.w - side) / 2, y: lastRow.y + lastRow.h + 20 + (free - side) / 2, w: side, h: side };
    if (v3.on) { v3.heroRect = mr; v3.heroSeats = armSeat; } else drawBoard(ctx, mr, { armSeat, mini: true });
  }
  button(ctx, U.start, 'Start the game', { kind: 'primary', size: 36, icon: 'play', sub: `${p.pieces} pieces each` });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, w, h) {
  const Rr = L.result, r = st.result, p = Rr.panel;
  drawDesk(ctx, w, h);
  {
    // with the 3D scene on, a roomy portrait card is split in two plaques so the lit board shows in the window between them
    const top0 = p.y + (r.newBest ? 186 : 160), rowH0 = Math.min(L.land ? 52 : 92, (Rr.again.y - 60 - top0) / Math.max(1, r.rows.length));
    const rb = top0 + 26 + r.rows.length * rowH0, fh = Rr.again.y - 30 - rb - 20;
    if (v3.on && !L.land && fh >= 220) {
      const a = { x: p.x, y: p.y, w: p.w, h: rb - p.y + 8 }, b = { x: p.x, y: Rr.again.y - 92, w: p.w, h: p.y + p.h - Rr.again.y + 92 };
      drawSheet(ctx, a, 18); drawSheet(ctx, b, 18);
      const side = Math.min(b.y - (a.y + a.h) - 4, p.w);
      v3.heroRect = { x: p.x + (p.w - side) / 2, y: a.y + a.h + 2 + (b.y - (a.y + a.h) - 4 - side) / 2, w: side, h: side };
      v3.heroSeats = [0, null, 1, null];
    } else { drawSheet(ctx, p, 18); edgeStroke(ctx, p, 18, 0.3); }
  }
  const cx = p.x + p.w / 2, wide = L.land;
  txt(ctx, r.auto ? 'The game is over' : r.humanWon ? 'You bring them all home!' : `${r.winnerName} wins!`, cx, p.y + 66, 38, '#9a3b1f', { align: 'center', font: DISPLAY, maxW: p.w - 60 });
  txt(ctx, `${r.winnerName} brought all ${r.npieces} pieces home in ${r.turns} turns`, cx, p.y + 114, 26, PAL.ink, { align: 'center', maxW: p.w - 60 });
  if (r.newBest) txt(ctx, 'Your fastest win so far', cx, p.y + 150, 24, PAL.good, { align: 'center' });
  const top = p.y + (r.newBest ? 186 : 160), rowH = Math.min(wide ? 52 : 92, (Rr.again.y - 60 - top) / Math.max(1, r.rows.length));
  txt(ctx, 'Tally', cx, top - 2, 22, PAL.sepia, { align: 'center', font: DISPLAY });
  r.rows.forEach((row, i) => {
    const y = top + 26 + i * rowH + rowH / 2;
    const x0 = p.x + 36, x1 = p.x + p.w - 36;
    if (row.winner) { ctx.fillStyle = 'rgba(232,182,69,0.32)'; rrect(ctx, { x: x0 - 8, y: y - rowH / 2 + 3, w: x1 - x0 + 16, h: rowH - 6 }, 12); ctx.fill(); }
    txt(ctx, `${i + 1}`, x0 + 6, y, 26, PAL.sepia, { font: DISPLAY });
    drawBead(ctx, x0 + 58, y + rowH * 0.28, Math.min(rowH * 0.8, 44), row.seat);
    txt(ctx, row.name, x0 + 100, y, 26, PAL.ink, { maxW: (x1 - x0) * 0.3 });
    txt(ctx, `home ${row.home}/${row.n}`, x0 + (x1 - x0) * 0.52, y, 22, PAL.sepia, { align: 'center' });
    if (!wide || p.w > 800) txt(ctx, `captured ${row.captures}`, x0 + (x1 - x0) * 0.74, y, 22, PAL.sepia, { align: 'center', maxW: (x1 - x0) * 0.2 });
    txt(ctx, String(row.tally), x1, y, 30, '#9a3b1f', { align: 'right', font: DISPLAY });
  });
  const rowsBottom = top + 26 + r.rows.length * rowH, freeH = Rr.again.y - 30 - rowsBottom - 20;
  const note = 'Points only, no stakes: 10 for each piece home, a little for ground covered, 20 for the win.';
  if (!wide && freeH >= 250 && !v3.on) {
    const side = Math.min(freeH - 60, p.w - 120, 460);
    drawBoard(ctx, { x: cx - side / 2, y: rowsBottom + 14, w: side, h: side }, { armSeat: r.rows.map((row) => row.seat).concat([null, null, null, null]).slice(0, 4).map((sn, k, a) => (r.rows.length === 2 ? (k === 0 ? r.rows[0].seat : k === 2 ? r.rows[1].seat : null) : a[k])), mini: true });
  }
  ctx.font = `600 ${Math.max(22, minUnits())}px ${UI}`;
  const nl = wrap(ctx, note, p.w - 70);
  nl.slice(0, 3).forEach((ln, i) => txt(ctx, ln, cx, Rr.again.y - 22 - (nl.length - 1 - i) * 26, 22, PAL.sepia, { align: 'center', maxW: p.w - 60 }));
  button(ctx, Rr.again, r.auto ? 'Watch again' : 'Play again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.setup, r.auto ? 'Menu' : 'New setup', { kind: 'parch', size: 30 });
  button(ctx, Rr.menu, 'Main menu', { kind: 'parch', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  drawSheet(ctx, p, 18);
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 80, 40, '#9a3b1f', { align: 'center', font: DISPLAY, maxW: p.w - 40 });
  txt(ctx, 'The full game has every seat, option and', p.x + p.w / 2, p.y + 170, 26, PAL.ink, { align: 'center', maxW: p.w - 40 });
  txt(ctx, 'rule, with no limit on games.', p.x + p.w / 2, p.y + 210, 26, PAL.ink, { align: 'center', maxW: p.w - 40 });
  txt(ctx, 'Get Patolli for iPhone and Android.', p.x + p.w / 2, p.y + 280, 26, PAL.good, { align: 'center', maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 355, 22, PAL.sepia, { align: 'center' });
}

function settingsBlocks(st) {
  const p = st.prefs, s = st.stats;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('speed', 'Game speed', 'cycle', () => SPEEDS[p.speedIdx].name, 'How fast pieces move'),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn pause'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No bobbing or sparks'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [st.owned()
      ? row('restore', 'Full game', 'info', () => 'Unlocked', 'Thank you for playing Patolli')
      : row('restore', 'Restore purchase', 'button', () => '', () => st.restoreMsg || 'Get a purchase back', { btn: st.restoreBusy ? 'Checking' : 'Restore' })]),
    ...(st.demo ? [] : st.owned() && st.restoreMsg ? [{ p: st.restoreMsg }] : []),
    { h: 'Your record' },
    row('s1', 'Games played', 'info', () => s.played),
    row('s2', 'Games won', 'info', () => s.won),
    row('s3', 'Fewest turns in a win', 'info', () => (s.bestTurns ? `${s.bestTurns} turns` : 'none yet')),
    row('s4', 'Pieces captured', 'info', () => s.captures),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); return; }
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'setup') renderSetup(ctx, st, L, w, h);
  else if (sc === 'result') renderResult(ctx, st, L, w, h);
  else if (sc === 'demo-limit') { drawDesk(ctx, w, h); renderDemoLimit(ctx, st, L); }
  else {
    drawDesk(ctx, w, h);
    if (sc === 'rules') { const pg = rulesPages(); renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `Rules ${st.rulesPage + 1}/${pg.length}  ${pg[st.rulesPage].title}`, blocks: pg[st.rulesPage].blocks, nav: true, page: st.rulesPage, pages: pg.length }); }
    else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: ABOUT.title, blocks: ABOUT.blocks });
    else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: HOWTO.title, blocks: HOWTO.blocks });
    else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  }
}
void frameOf; void rr; void fretBand; void QUARTER;
