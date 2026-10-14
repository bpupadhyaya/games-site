// Drawing of the playing screen (routine, practice, Watch and Learn): pad, ghost path, marker, clubs, HUD, pause menu.
import { PAL, UI, DISPLAY, drawBackdrop, drawPit, drawClub, drawTarget, drawParticles, drawFigure2D, drawGrip, drawPadGlass } from './art.js';
import { hooks } from './hooks.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { menuRects } from './layout.js';
import { MOVES, pathPoints, leadPoint, pairOf, TAU, THINK_TIMES, TIMING, JUDGE } from './moves.js';
import { mini } from './docview.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MODE_NAME = { play: 'Routine', practice: 'Practice', auto: 'Watch and Learn' };
const PAUSE_LABEL = { resume: 'Resume', restart: 'Restart', quit: 'Quit to menu', again: 'Watch again', next: 'Next routine', exit: 'Menu', think: 'Think time: change' };
const GRADE_COL = { smooth: '#ffe07a', good: '#8ef0dc', off: '#ff9a8a' };
const GRADE_TEXT = { smooth: 'SMOOTH', good: 'GOOD', off: 'OFF' };

function ghostPath(ctx, m, cx, cy, R, o = {}) {
  const pts = pathPoints(m, 96).map((p) => (o.pair ? pairOf(o.pair, p) : p));
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (o.glow) {
    ctx.strokeStyle = `rgba(255,214,120,${0.22 * o.glow})`; ctx.lineWidth = R * 0.1;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(cx + p.x * R, cy + p.y * R) : ctx.moveTo(cx + p.x * R, cy + p.y * R))); ctx.stroke();
  }
  ctx.strokeStyle = o.color ?? 'rgba(255,248,230,0.82)'; ctx.lineWidth = Math.max(3, R * (o.w ?? 0.026));
  ctx.setLineDash([R * 0.07, R * 0.06]);
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(cx + p.x * R, cy + p.y * R) : ctx.moveTo(cx + p.x * R, cy + p.y * R))); ctx.stroke();
  ctx.setLineDash([]);
  if (!o.noArrows) {
    ctx.fillStyle = o.color ?? PAL.turmericHi;
    for (const u of [0.125, 0.375, 0.625, 0.875]) {
      const a = leadPoint(m, u - 0.01), b = leadPoint(m, u + 0.01), ang = Math.atan2(b.y - a.y, b.x - a.x), p = leadPoint(m, u);
      ctx.save(); ctx.translate(cx + p.x * R, cy + p.y * R); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(R * 0.075, 0); ctx.lineTo(-R * 0.045, R * 0.055); ctx.lineTo(-R * 0.045, -R * 0.055); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
}

function trailLine(ctx, pts, cx, cy, R, rgb) {
  if (pts.length < 3) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const a = i / pts.length;
    ctx.strokeStyle = `rgba(${rgb},${0.55 * a * a})`; ctx.lineWidth = R * 0.06 * a + 1;
    ctx.beginPath(); ctx.moveTo(cx + pts[i - 1].x * R, cy + pts[i - 1].y * R); ctx.lineTo(cx + pts[i].x * R, cy + pts[i].y * R); ctx.stroke();
  }
  ctx.restore();
}

const num = (n) => Math.round(n).toLocaleString('en-US');

export function renderPlay(ctx, st, L, view, meta, helpers) {
  const pl = st.pl, P = L.play, pad = P.pad, { cx, cy, R, pr, lx, sx } = pad, w = L.w, h = L.h, S = L.S, t = st.t;
  const segs = pl.tl.segs, seg = segs[Math.min(pl.seg, segs.length - 1)], m = seg.move, next = segs[pl.seg + 1];
  const swing = pl.mk.k === 'swing', inPre = !!pl.pre;
  meta.previewBadge = { x: (L.mode === 'wide' ? P.caption.x + P.caption.w : S.x + S.w) - 14, y: P.caption.y + 4, align: 'right' };

  // the scene: the 3D presenter draws courtyard, pit, athlete (real hands on the club necks), clubs and trails when it can; otherwise the 2D art does.
  const Lc0 = pr * 1.15, grip = (hh, ang, ox) => {
    const hx0 = ox + hh.x * pr, hy0 = cy + hh.y * pr, ca = Math.cos(ang), sa = Math.sin(ang);
    return { x: hx0 - ca * Lc0 * 0.75, y: hy0 - sa * Lc0 * 0.75, dx: ca, dy: sa, hx: hx0, hy: hy0 };
  };
  const fig = {
    w: w + 20, h: h + 20, cx, cy, R, t, paused: !!(pl.paused || pl.over), speed: pl.speed, holding: !!pl.holding, pulse: pl.pulse, glow: pl.glow,
    lead: grip(pl.h, pl.ang, lx), second: grip(pl.h2, pl.ang2, sx), hLead: pl.h, hSecond: pl.h2,
    showTrail: !!st.prefs.trail && !st.clean,
    trail: pl.trail.map((p) => ({ x: lx + p.x * pr, y: cy + p.y * pr })), trail2: pl.trail2.map((p) => ({ x: sx + p.x * pr, y: cy + p.y * pr })),
  };
  const is3d = !!(hooks.scene && hooks.scene(ctx, fig));
  if (is3d) drawPadGlass(ctx, cx, cy, R, t, pl.pulse);
  else {
    drawBackdrop(ctx, w + 20, h + 20, t);
    drawPit(ctx, cx, cy, R, t, pl.pulse);
    drawFigure2D(ctx, fig);
  }

  const clean = st.clean === true;
  // ghost paths: the move now (or about to start), and the one after it near the end of a move
  const hint = pl.hintT > 0 ? Math.min(1, pl.hintT * 2) : 0;
  const nearEnd = swing && next && pl.b > seg.end - 2;
  if (!clean && nearEnd) ghostPath(ctx, next.move, lx, cy, pr, { color: 'rgba(120,230,215,0.5)', noArrows: true, w: 0.018 });
  if (!clean) ghostPath(ctx, m, lx, cy, pr, { glow: inPre || hint ? 1 : 0.5, color: swing ? 'rgba(255,248,230,0.72)' : 'rgba(255,248,230,0.92)' });
  // the second club's path, quieter (where the pair rule sends it)
  if (!clean) ghostPath(ctx, { ...m, shape: m.shape, dir: m.dir, pair: 'together', _p: m.pair }, sx, cy, pr, { color: 'rgba(110,226,208,0.4)', noArrows: true, w: 0.016, pair: m });

  // the start point: pulses while the player should get there
  if (!clean && (!swing || hint)) {
    const sp = leadPoint(m, 0), k = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.save(); ctx.strokeStyle = `rgba(255,224,120,${0.55 + 0.4 * k})`; ctx.lineWidth = Math.max(3, R * 0.03);
    ctx.beginPath(); ctx.arc(lx + sp.x * pr, cy + sp.y * pr, pr * (0.14 + 0.03 * k), 0, TAU); ctx.stroke(); ctx.restore();
  }

  // trails, clubs
  if (!is3d) {
    if (!clean && st.prefs.trail) { trailLine(ctx, pl.trail2, sx, cy, pr, '70,214,192'); trailLine(ctx, pl.trail, lx, cy, pr, '255,200,60'); }
    const Lc = pr * 1.15, glow = pl.glow;
    const hx2 = sx + pl.h2.x * pr, hy2 = cy + pl.h2.y * pr, hx = lx + pl.h.x * pr, hy = cy + pl.h.y * pr;
    drawClub(ctx, hx2, hy2, pl.ang2, Lc, { tone: 1, glow: glow * 0.6 });
    drawClub(ctx, hx, hy, pl.ang, Lc, { tone: 0, glow });
    drawGrip(ctx, hx - Math.cos(pl.ang) * Lc * 0.75, hy - Math.sin(pl.ang) * Lc * 0.75, pl.ang, R);
    drawGrip(ctx, hx2 - Math.cos(pl.ang2) * Lc * 0.75, hy2 - Math.sin(pl.ang2) * Lc * 0.75, pl.ang2, R);
  }

  // the target ring on top: the club head inside it is a smooth beat
  const mk = pl.mk, k = TIMING[st.prefs.timingIdx].k;
  const tr = Math.max(10, pr * JUDGE.smooth * k);
  if (!clean) drawTarget(ctx, lx + mk.x * pr, cy + mk.y * pr, tr, pl.pulse, swing);
  // finger ring
  if (pl.holding && pl.mode !== 'auto' && !pl.cheat) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx + pl.fx * pr, cy + pl.fy * pr, pr * 0.08, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // particles (in path units about the lead hand)
  ctx.save(); ctx.translate(lx, cy); ctx.scale(pr, pr); drawParticles(ctx, pl.parts); ctx.restore();

  if (clean) return;
  // count-in numerals in the middle of the pad
  if (!swing && !inPre && !pl.paused) {
    const frac = 1 - (pl.b % 1), n = Math.max(1, Math.ceil(seg.start - pl.b - 1e-9));
    ctx.save(); ctx.globalAlpha = 0.16 + 0.34 * frac;
    txt(ctx, String(n), cx, cy + R * 0.02, R * 0.5 * (0.9 + 0.2 * frac), PAL.cream, { align: 'center', font: DISPLAY, weight: 400 });
    ctx.restore();
  }
  // the last beat's judgement, near the club head
  if (pl.last && pl.last.t < 0.7) {
    const a = 1 - pl.last.t / 0.7;
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, GRADE_TEXT[pl.last.g], clamp(lx + pl.last.x * pr, S.x + 80, S.x + S.w - 80), cy + pl.last.y * pr - pr * 0.22 - pl.last.t * 40, Math.max(26, R * 0.09), GRADE_COL[pl.last.g], { align: 'center', font: DISPLAY, weight: 400, stroke: 6 });
    ctx.restore();
  }
  if (pl.banner) {
    const a = clamp(Math.min(pl.banner.t / 0.15, (1.5 - pl.banner.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, pl.banner.text, cx, L.mode === 'wide' ? cy + R * 0.7 : Math.min(cy + R * 1.46, P.next.y - 28), Math.max(30, R * 0.11), PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 7, maxW: S.w - 40 });
    ctx.restore();
  }
  if (hint) {
    ctx.save(); ctx.globalAlpha = hint;
    chip(ctx, cx, cy - R * 1.36, `Start at the marker and go ${m.dir > 0 ? 'clockwise' : 'anticlockwise'}`, 22, { align: 'center', fill: 'rgba(6,24,28,0.9)', stroke: 'rgba(255,224,120,0.6)' });
    ctx.restore();
  }

  drawHud(ctx, st, L, pl, seg, next, helpers);

  if (pl.paused || pl.over) drawPause(ctx, st, L, pl, helpers);
}

function flowBar(ctx, r, flow, mult) {
  const n = 5, gap = 5, sw = (r.w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const f = clamp(flow * n - i, 0, 1), sx = r.x + i * (sw + gap);
    ctx.fillStyle = 'rgba(255,243,218,0.14)'; rrect(ctx, { x: sx, y: r.y, w: sw, h: r.h }, r.h / 2); ctx.fill();
    if (f > 0) { ctx.fillStyle = i >= 3 ? '#ffe27a' : PAL.turmeric; rrect(ctx, { x: sx, y: r.y, w: Math.max(r.h, sw * f), h: r.h }, r.h / 2); ctx.fill(); }
  }
}

function drawHud(ctx, st, L, pl, seg, next, helpers) {
  const P = L.play, S = L.S, segs = pl.tl.segs, mode = L.mode;
  const mIdx = Math.min(pl.seg, segs.length - 1) + 1, accNow = pl.qT ? pl.qSum / pl.qT : 0;
  const caption = pl.pre ? (pl.pre.kind === 'think' ? `THINK  ${Math.max(0, Math.ceil(pl.pre.dur - pl.pre.t))}s` : 'REVEAL') : pl.mk.k === 'swing' ? 'SWING' : 'GET READY';
  const sub = pl.mode === 'practice' ? `${pl.routine.bpm} beats per minute` : `Move ${mIdx} of ${segs.length}  -  ${pl.routine.bpm} bpm`;
  const subTop = pl.mode === 'practice' ? `Practice  -  ${pl.routine.bpm} bpm` : pl.mode === 'auto' ? `Watch and Learn  -  Move ${mIdx} of ${segs.length}` : `Move ${mIdx} of ${segs.length}  -  ${pl.routine.bpm} bpm`;
  if (mode === 'wide') {
    panel(ctx, P.left, { fill: 'rgba(6,24,28,0.7)' }); panel(ctx, P.right, { fill: 'rgba(6,24,28,0.7)' });
    txt(ctx, MODE_NAME[pl.mode].toUpperCase(), P.title.x, P.title.y + 10, 18, PAL.dim, { weight: 700 });
    txt(ctx, pl.routine.name, P.title.x, P.title.y + 46, 30, PAL.text, { font: DISPLAY, weight: 400, maxW: P.title.w });
    txt(ctx, sub, P.title.x, P.title.y + 88, 20, PAL.dim, { weight: 500, maxW: P.title.w });
    txt(ctx, 'SCORE', P.score.x, P.score.y + 10, 18, PAL.dim, { weight: 700 });
    txt(ctx, num(pl.score), P.score.x, P.score.y + 52, 46, PAL.gold, { font: DISPLAY, weight: 400, maxW: P.score.w - 80 });
    chip(ctx, P.score.x + P.score.w, P.score.y + 52, `x${pl.mult}`, 28, { align: 'right', fill: 'rgba(255,200,60,0.2)', stroke: 'rgba(255,200,60,0.6)', color: PAL.gold });
    flowBar(ctx, { x: P.flow.x, y: P.flow.y + 14, w: P.flow.w, h: 22 }, pl.flow, pl.mult);
    txt(ctx, 'FLOW', P.flow.x, P.flow.y - 4, 16, PAL.dim, { weight: 700 });
    const y0 = P.stats.y;
    txt(ctx, `Accuracy ${Math.round(accNow * 100)}%`, P.stats.x, y0 + 14, 24, PAL.text, { weight: 600, maxW: P.stats.w });
    txt(ctx, `Smooth run ${pl.run}  (best ${pl.bestRun})`, P.stats.x, y0 + 52, 22, PAL.dim, { weight: 500, maxW: P.stats.w });
    txt(ctx, `${pl.counts.smooth} smooth, ${pl.counts.good} good, ${pl.counts.off} off`, P.stats.x, y0 + 86, 20, PAL.dim, { weight: 500, maxW: P.stats.w });
    const prog = clamp(pl.b / pl.tl.total, 0, 1);
    ctx.fillStyle = 'rgba(255,243,218,0.14)'; rrect(ctx, { x: P.stats.x, y: y0 + 116, w: P.stats.w, h: 10 }, 5); ctx.fill();
    ctx.fillStyle = PAL.tealHi; rrect(ctx, { x: P.stats.x, y: y0 + 116, w: Math.max(10, P.stats.w * prog), h: 10 }, 5); ctx.fill();
  } else {
    panel(ctx, P.hud, { fill: 'rgba(6,24,28,0.62)', rad: 22 });
    txt(ctx, pl.routine.name, P.title.x, P.title.y + P.title.h * 0.32, Math.min(34, P.title.h * 0.46), PAL.text, { font: DISPLAY, weight: 400, maxW: P.title.w });
    txt(ctx, subTop, P.title.x, P.title.y + P.title.h * 0.86, 21, PAL.dim, { weight: 500, maxW: P.title.w });
    txt(ctx, num(pl.score), P.score.x, P.score.y + P.score.h * 0.5, 44, PAL.gold, { font: DISPLAY, weight: 400, maxW: P.score.w - 100 });
    chip(ctx, P.score.x + P.score.w, P.score.y + P.score.h * 0.5, `x${pl.mult}`, 26, { align: 'right', fill: 'rgba(255,200,60,0.2)', stroke: 'rgba(255,200,60,0.6)', color: PAL.gold });
    flowBar(ctx, { x: P.flow.x + 70, y: P.flow.y + 12, w: P.flow.w - 70, h: 22 }, pl.flow, pl.mult);
    txt(ctx, 'FLOW', P.flow.x, P.flow.y + 23, 18, PAL.dim, { weight: 700 });
    const prog = clamp(pl.b / pl.tl.total, 0, 1);
    ctx.fillStyle = 'rgba(255,243,218,0.12)'; rrect(ctx, { x: P.hud.x + 14, y: P.hud.y + P.hud.h - 14, w: P.hud.w - 28, h: 6 }, 3); ctx.fill();
    ctx.fillStyle = PAL.tealHi; rrect(ctx, { x: P.hud.x + 14, y: P.hud.y + P.hud.h - 14, w: Math.max(6, (P.hud.w - 28) * prog), h: 6 }, 3); ctx.fill();
  }
  // buttons
  button(ctx, P.hint, mode === 'wide' ? 'Hint' : '', { icon: 'hint', kind: pl.hintT > 0 ? 'gold' : 'quiet', size: 26 });
  button(ctx, P.pause, mode === 'wide' ? 'Pause' : '', { icon: 'pause', kind: 'quiet', size: 26 });

  // caption above the pad: what phase and which move
  const cap = P.caption;
  if (mode !== 'wide' || true) {
    const cc = pl.pre ? PAL.gold : pl.mk.k === 'swing' ? PAL.tealHi : PAL.turmericHi;
    txt(ctx, `${caption}`, cap.x + cap.w / 2 - (mode === 'wide' ? 0 : 0), cap.y + 14, 20, cc, { align: 'center', weight: 800 });
    txt(ctx, seg.move.name, cap.x + cap.w / 2, cap.y + 44, Math.min(38, cap.h * 0.7), PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: cap.w - 230 });
  }

  // the "next move" / think card
  const nc = P.next;
  panel(ctx, nc, { fill: 'rgba(6,24,28,0.72)', rad: 22 });
  const showSeg = pl.mk.k === 'swing' && next ? next : seg;
  const label = pl.pre ? (pl.pre.kind === 'think' ? 'THINK ABOUT THIS MOVE' : 'WATCH THE START') : pl.mk.k === 'swing' ? (next ? 'NEXT MOVE' : 'LAST MOVE') : 'UP NOW';
  const mm = showSeg.move, wideCard = L.mode === 'wide';
  const r = wideCard ? Math.min(nc.w * 0.3, nc.h * 0.22) : Math.min(nc.h * 0.34, nc.w * 0.16);
  const mx = wideCard ? nc.x + nc.w / 2 : nc.x + 28 + r, my = wideCard ? nc.y + 24 + r : nc.y + nc.h / 2;
  mini(ctx, mm, mx, my, r, { turns: pl.pre ? 0 : (st.t * 0.2) % 1 });
  const tx = wideCard ? nc.x + 16 : mx + r + 24, tw = wideCard ? nc.w - 32 : nc.x + nc.w - 18 - tx, ty = wideCard ? my + r + 26 : nc.y + 28;
  txt(ctx, label, tx, ty, 17, PAL.dim, { weight: 800, maxW: tw });
  txt(ctx, mm.name, tx, ty + 34, 28, PAL.text, { font: DISPLAY, weight: 400, maxW: tw });
  ctx.font = `500 ${22}px ${UI}`;
  const lines = wrap(ctx, pl.pre ? mm.how : `${mm.pair === 'together' ? 'Both clubs together' : mm.pair === 'mirror' ? 'Second club mirrors' : 'Second club alternates'}, ${mm.speed >= 1 ? 'one turn a beat' : 'one turn every two beats'}`, tw);
  const room = Math.max(1, Math.floor((nc.y + nc.h - 30 - (ty + 70)) / 26) + 1);
  lines.slice(0, room).forEach((ln, i) => txt(ctx, ln, tx, ty + 70 + i * 26, 21, PAL.dim, { weight: 500, maxW: tw }));
  if (pl.pre) {
    const k = clamp(pl.pre.t / pl.pre.dur, 0, 1);
    ctx.fillStyle = 'rgba(255,243,218,0.14)'; rrect(ctx, { x: nc.x + 20, y: nc.y + nc.h - 18, w: nc.w - 40, h: 8 }, 4); ctx.fill();
    ctx.fillStyle = pl.pre.kind === 'think' ? PAL.gold : PAL.tealHi; rrect(ctx, { x: nc.x + 20, y: nc.y + nc.h - 18, w: Math.max(8, (nc.w - 40) * k), h: 8 }, 4); ctx.fill();
  }
}

function drawPause(ctx, st, L, pl, helpers) {
  const items = helpers.pauseItems(pl), M = menuRects(L, items.length, 130), S = L.S;
  ctx.fillStyle = 'rgba(3,12,14,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, { fill: 'rgba(8,30,34,0.96)', rad: 28 });
  txt(ctx, pl.over ? 'Lesson complete' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: M.panel.w - 40 });
  txt(ctx, pl.routine.name, M.panel.x + M.panel.w / 2, M.panel.y + 100, 24, PAL.dim, { align: 'center', weight: 600, maxW: M.panel.w - 40 });
  items.forEach((it, i) => {
    const label = it === 'think' ? `Think time: ${THINK_TIMES[st.prefs.thinkIdx]} s (tap to change)` : PAUSE_LABEL[it];
    button(ctx, M.btns[i], label, { kind: i === 0 ? 'primary' : 'quiet', size: 30 });
  });
}
