// Drawing the play screen: the scene, the HUD, the aim and timing controls, the bottom bar and the overlays.
// Pure drawing; game.js owns state.
import { ARENA, K, derive, tiltOf, clamp, launchSpot } from './sim.js';
import { drawBackdrop, drawTableLayer, drawTop, drawTrails, drawParticles, toScreen, lookOf } from './art.js';
import { THINK_STEPS, TEXT_SCALES, VIEW, curLayout, minFs } from './layout.js';
import { FONT, DISPLAY, C, roundPath, paintButton, drawButton, panel, textShadow, wrapLines, fitPx } from './ui.js';
import { PROFILES } from './ai.js';
import { GAUGE } from './timing.js';

const TAU = Math.PI * 2;

export function nameOf(state, side) {
  const m = state.match;
  if (!m) return side === 0 ? 'You' : 'Rival';
  return m.cfg.names[side];
}

// a top standing on its cord before the launch
export function preTops(match) {
  return [0, 1].map((side) => {
    const b = match.cfg.builds[side];
    const d = derive(b), sp = launchSpot(side);
    return { side, build: b, x: sp.x, y: sp.y, vx: 0, vy: 0, w: 0.04 * d.w0, w0: d.w0, sg: b.hand === -1 ? -1 : 1, tx: 0, ty: 0, st: 0, stT: 0, ang: side ? 2.4 : 0.5, pre: true };
  });
}
export const aimAnchor = (side) => { const sp = launchSpot(side); return toScreen(sp.x, sp.y); };

// ---- the scene --------------------------------------------------------------------------------
export function drawScene(ctx, S, o = {}) {
  const arena = S.arena;
  drawBackdrop(ctx, arena);
  if (S.trails) drawTrails(ctx, S.trails);
  const tops = S.tops.map((t, i) => ({ t, i })).sort((a, b) => (a.t.st === 2 ? 99 : a.t.y) - (b.t.st === 2 ? 99 : b.t.y));
  for (const { t, i } of tops) drawTop(ctx, t, S.looks[i], S.clock, { age: S.age });
  if (S.parts) drawParticles(ctx, S.parts);
}

// the dish and everything on it through the design -> screen transform (the caller has drawn the table)
export function drawSceneAt(ctx, S, xf) {
  ctx.save(); ctx.translate(xf.tx, xf.ty); ctx.scale(xf.s, xf.s);
  drawScene(ctx, S);
  ctx.restore();
}

// ---- HUD --------------------------------------------------------------------------------------
function bar(ctx, x, y, bw, bh, frac, o = {}) {
  const f = clamp(frac, 0, 1);
  roundPath(ctx, x, y, bw, bh, bh / 2); ctx.fillStyle = 'rgba(18,8,2,0.6)'; ctx.fill();
  if (f > 0.004) {
    ctx.save(); roundPath(ctx, x, y, bw, bh, bh / 2); ctx.clip();
    ctx.fillStyle = o.col ?? (f > 0.5 ? '#f0b94a' : f > 0.25 ? '#ee8d3a' : '#e5513a');
    const fw = Math.max(bh, bw * f);
    if (o.right) ctx.fillRect(x + bw - fw, y, fw, bh); else ctx.fillRect(x, y, fw, bh);
    ctx.restore();
  }
  roundPath(ctx, x, y, bw, bh, bh / 2); ctx.strokeStyle = 'rgba(255,243,220,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawCards(ctx, L) {
  if (!L.cards) return;
  for (const c of L.cards) { roundPath(ctx, c.x, c.y, c.w, c.h, 22); ctx.fillStyle = 'rgba(24,10,4,0.5)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,243,220,0.28)'; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawHud(ctx, state, L) {
  const { match: m } = state, w = state.w, H = L.hud;
  const tops = w ? w.tops : state.pre;
  ctx.textBaseline = 'alphabetic';
  [0, 1].forEach((side) => {
    const t = tops[side], b = H.sides[side], x = b.x;
    const live = !t.pre;
    const spinF = live ? (t.st === 0 ? t.w / (t.w0 || 1) : 0) : 1;
    const steady = live ? (t.st === 0 ? 1 - tiltOf(t) / K.FALL : 0) : 1;
    const num = live ? `${Math.max(0, Math.ceil(spinF * 100))}` : '';
    let name = nameOf(state, side);
    const fitRow = (nm) => {
      ctx.font = `700 100px ${FONT}`; const wn = ctx.measureText(nm).width / 100;
      ctx.font = `700 92px ${FONT}`; const wm = ctx.measureText('100').width / 100;
      return Math.max(minFs(), Math.min(L.nameFs, Math.floor((b.w - 14) / (wn + wm * 0.92))));
    };
    let fs = fitRow(name);
    if (fs < L.nameFs * 0.62 && name.includes(' ')) { name = name.split(' ')[0]; fs = fitRow(name); }
    ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = side === 0 ? 'left' : 'right';
    textShadow(ctx, name, side === 0 ? x : x + b.w, b.base, '#fff3dc', 5);
    if (num) { ctx.font = `700 ${Math.round(fs * 0.92)}px ${FONT}`; ctx.textAlign = side === 0 ? 'right' : 'left'; textShadow(ctx, num, side === 0 ? x + b.w : x, b.base, spinF < 0.25 ? '#ffb0a0' : '#fff3dc', 5); }
    bar(ctx, x, b.barY, b.w, b.barH, spinF, { right: side === 1 });
    bar(ctx, x, b.tenY, b.w, b.tenH, steady, { right: side === 1, col: steady > 0.6 ? '#4fc3a8' : steady > 0.3 ? '#ee8d3a' : '#e5513a' });
  });
  // the clock and the round pips
  const secs = w ? w.t : 0, mm = Math.floor(secs / 60), ss = Math.floor(secs % 60);
  const ttxt = `${mm}:${String(ss).padStart(2, '0')}`, T = H.timer, PP = H.pips;
  const tfs = fitPx(ctx, ttxt, 700, L.timerFs, T.w, minFs());
  ctx.textAlign = 'center'; ctx.font = `700 ${tfs}px ${FONT}`;
  textShadow(ctx, ttxt, T.cx, T.base, '#fff3dc', 6);
  const cy = PP.cy;
  if (m.cfg.rounds === 3) {
    const pp = Math.min(L.m, (PP.w / 2 - 6) / 66);
    for (let i = 0; i < 2; i++) {
      for (const [side, dx] of [[0, -(34 + i * 24) * pp], [1, (34 + i * 24) * pp]]) {
        ctx.beginPath(); ctx.arc(PP.cx + dx, cy, 8 * pp, 0, TAU);
        ctx.fillStyle = m.wins[side] > i ? '#f4c95d' : 'rgba(18,8,2,0.5)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,243,220,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  } else {
    const lab = m.cfg.mode === 'watch' ? 'Watch & Learn' : m.cfg.lesson != null ? 'Lesson' : 'Quick Duel';
    const lfs = fitPx(ctx, lab, 600, 20 * L.m, PP.w - 4, minFs());
    ctx.font = `600 ${lfs}px ${FONT}`; textShadow(ctx, lab, PP.cx, cy + lfs * 0.35, 'rgba(255,243,220,0.85)', 4);
  }
  drawStatusPanel(ctx, state, L);
}

// what is happening, and what to do, in words that follow the text size
function statusLines(state) {
  const m = state.match, w = state.w;
  const aimName = m.cfg.mode === 'friend' ? (state.side === 0 ? m.cfg.names[0] : m.cfg.names[1]) : 'You';
  if (state.wl) {
    const p = state.wl.phase;
    return [p === 'think' ? 'Both players weigh their launch.' : p === 'reveal' ? 'Each plan is shown, with its reason.' : 'The tops are launched and the dish decides.'];
  }
  switch (state.ph) {
    case 'intro': return [`Round ${m.round}  ·  ${state.arenaName}`];
    case 'aim':
      if (state.aim.drag && state.aim.pow > 0.08) {
        const deg = Math.round(((state.aim.ang + Math.PI / 2 + Math.PI * 4) % TAU) * 180 / Math.PI), d = deg > 180 ? deg - 360 : deg;
        const rel = state.side === 1 ? -d : d;
        return [`Power ${Math.round(state.aim.pow * 100)}%   ·   ${Math.abs(rel) < 3 ? 'Straight ahead' : `${Math.abs(rel)}° ${rel > 0 ? 'right' : 'left'}`}`];
      }
      return [m.cfg.mode === 'friend' ? `${aimName}: drag back from your top, then let go` : 'Drag back from your top, then let go'];
    case 'timing': return ['Tap when the needle is in the gold'];
    case 'pass': return ['Pass the device'];
    case 'run': case 'over': {
      if (!w) return [''];
      const me = w.tops[0], rv = w.tops[1];
      if (w.over) return [w.over.why === 'out' ? 'Knocked out of the dish' : w.over.why === 'wobble' ? 'Tipped over' : w.over.why === 'time' ? 'Time is up' : 'Spun out'];
      if (w.big > 0 && state.bigT > 0) return ['A big hit!'];
      if (me.st === 0 && tiltOf(me) > 0.4 && m.cfg.mode === 'ai') return ['Your top is wobbling: its spin is running down'];
      if (rv.st === 0 && tiltOf(rv) > 0.4) return ['Their top is wobbling: its spin is running down'];
      return ['A slow top wobbles, then tips over'];
    }
    default: return [''];
  }
}

function drawStatusPanel(ctx, state, L) {
  const P = L.panel, m = L.m;
  roundPath(ctx, P.x, P.y, P.w, P.h, 18); ctx.fillStyle = 'rgba(24,10,4,0.5)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,243,220,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  const lines = statusLines(state);
  const text = lines.join('  ');
  let fs = Math.round(24 * m);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let wrapped;
  for (;;) {
    ctx.font = `700 ${fs}px ${FONT}`;
    wrapped = wrapLines(ctx, text, P.w - 36);
    if ((wrapped.length * fs * 1.2 <= P.h - 14) || fs <= minFs()) break;
    fs -= 1;
  }
  const total = wrapped.length * fs * 1.2;
  let y = P.y + (P.h - total) / 2 + fs * 0.92;
  ctx.fillStyle = '#fff3dc';
  for (const l of wrapped) { ctx.fillText(l, P.x + P.w / 2, y); y += fs * 1.2; }
}

// ---- aiming and timing ------------------------------------------------------------------------
const arrowHead = (ctx, x, y, a, s, col) => {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a - 0.5) * s, y - Math.sin(a - 0.5) * s); ctx.lineTo(x - Math.cos(a + 0.5) * s, y - Math.sin(a + 0.5) * s); ctx.closePath(); ctx.fill();
};

export function drawPath(ctx, pts, col, out, clock) {
  if (!pts || pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([2, 12]); ctx.lineDashOffset = -clock * 30;
  ctx.beginPath();
  pts.forEach((p, i) => { const s = toScreen(p.x, p.y); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
  ctx.stroke(); ctx.setLineDash([]);
  const e = pts[pts.length - 1], s = toScreen(e.x, e.y);
  if (out) {
    ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(s.x - 11, s.y - 11); ctx.lineTo(s.x + 11, s.y + 11); ctx.moveTo(s.x + 11, s.y - 11); ctx.lineTo(s.x - 11, s.y + 11); ctx.stroke();
  } else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function drawAim(ctx, state, L) {
  const a = state.aim, side = state.side, an = aimAnchor(side);
  const col = '#fff3dc';
  // power ring round the top
  const pr = 46;
  ctx.save();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(18,8,2,0.45)'; ctx.beginPath(); ctx.ellipse(an.x, an.y - 8, pr, pr * 0.8, 0, 0, TAU); ctx.stroke();
  if (a.pow > 0.02) { ctx.strokeStyle = a.pow > 0.9 ? '#ff7a55' : '#f4c95d'; ctx.beginPath(); ctx.ellipse(an.x, an.y - 8, pr, pr * 0.8, 0, -Math.PI / 2, -Math.PI / 2 + TAU * a.pow); ctx.stroke(); }
  ctx.restore();
  if (a.pow > 0.08) {
    // the cord stretched back to the finger
    if (a.drag && a.fx !== undefined) {
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(18,8,2,0.5)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(an.x, an.y - 6); ctx.lineTo(a.fx, a.fy); ctx.stroke();
      ctx.strokeStyle = '#d9b27a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(an.x, an.y - 6); ctx.lineTo(a.fx, a.fy); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,70,30,0.7)'; ctx.lineWidth = 5; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(an.x, an.y - 6); ctx.lineTo(a.fx, a.fy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,243,220,0.9)'; ctx.beginPath(); ctx.arc(a.fx, a.fy, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(46,26,15,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // the launch direction
    const dirx = Math.cos(a.ang), diry = Math.sin(a.ang) * ARENA.sy;
    const len = 40 + 110 * a.pow, ang = Math.atan2(diry, dirx);
    const nrm = Math.hypot(dirx, diry) || 1;
    const ex = an.x + (dirx / nrm) * len, ey = an.y - 8 + (diry / nrm) * len;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(18,8,2,0.5)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(an.x, an.y - 8); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(an.x, an.y - 8); ctx.lineTo(ex, ey); ctx.stroke();
    arrowHead(ctx, ex + (dirx / nrm) * 10, ey + (diry / nrm) * 10, ang, 22, col);
    ctx.restore();
    if (a.path) drawPath(ctx, a.path, a.path.out ? '#ff8a6a' : '#fff3dc', a.path.out, state.t);
  }
}

// the cord-whip timing gauge
const GAUGE_ZONES = GAUGE;
export function drawGauge(ctx, state, L) {
  const G = L.gauge, tm = state.timing;
  if (!tm) return;
  const bh = Math.min(46, G.h * 0.5), by = G.y + (G.h - bh) / 2;
  roundPath(ctx, G.x - 8, by - 10, G.w + 16, bh + 20, 22); ctx.fillStyle = 'rgba(24,10,4,0.72)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,243,220,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  roundPath(ctx, G.x, by, G.w, bh, bh / 2); ctx.fillStyle = '#5c3a22'; ctx.fill();
  ctx.save(); roundPath(ctx, G.x, by, G.w, bh, bh / 2); ctx.clip();
  const zx = (f) => G.x + G.w * f;
  ctx.fillStyle = '#a8703a'; ctx.fillRect(zx(0.5 - GAUGE_ZONES.good), by, G.w * GAUGE_ZONES.good * 2, bh);
  ctx.fillStyle = '#f4c95d'; ctx.fillRect(zx(0.5 - GAUGE_ZONES.perfect), by, G.w * GAUGE_ZONES.perfect * 2, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(G.x, by, G.w, bh * 0.35);
  ctx.restore();
  const nx = zx(tm.n);
  ctx.fillStyle = tm.locked ? '#fff3dc' : '#fff3dc';
  roundPath(ctx, nx - 5, by - 9, 10, bh + 18, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(46,26,15,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  if (tm.locked) {
    const lab = tm.q >= 0.999 ? 'Perfect!' : tm.q > 0.9 ? 'Good' : 'Loose';
    const fs = Math.round(Math.min(34, G.h * 0.4));
    ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; textShadow(ctx, lab, G.x + G.w / 2, by - 16, tm.q >= 0.999 ? '#ffe27a' : '#fff3dc', 6);
  }
}

// ---- the bottom bar ---------------------------------------------------------------------------
export function drawControls(ctx, state, L) {
  const m = L.m, ph = state.ph, fast = state.speed === 2;
  const t0 = ph === 'timing' ? 'Aim again' : 'Think';
  const dis0 = (ph !== 'aim' && ph !== 'timing') || state.hintBusy || (ph === 'aim' && state.aim.drag);
  drawButton(ctx, L.tools[0], state.hintBusy ? 'Thinking...' : t0, { dark: true, size: 26 * m, disabled: dis0 });
  const runPh = ph === 'run' || ph === 'over';
  drawButton(ctx, L.tools[1], fast ? 'Speed x2' : 'Speed x1', { dark: true, active: fast, size: 26 * m, disabled: !runPh, sub: runPh ? 'tap to change' : null });
  drawButton(ctx, L.pause, 'Pause', { dark: true, size: 26 * m });
  if (state.hint && state.hint.t < state.hint.dur && (ph === 'aim')) {
    ctx.strokeStyle = '#f4c95d'; ctx.lineWidth = 5; roundPath(ctx, L.tools[0].x - 3, L.tools[0].y - 3, L.tools[0].w + 6, L.tools[0].h + 6, 20); ctx.stroke();
  }
}

export function drawWatchBar(ctx, state, L) {
  const st = state.settings, m = L.m, W_ = L.watch, sub = `Think ${THINK_STEPS[st.thinkIdx]} s`;
  drawButton(ctx, W_.dec, 'Faster', { dark: true, size: 24 * m, sub, disabled: st.thinkIdx === 0 });
  drawButton(ctx, W_.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 30 * m });
  drawButton(ctx, W_.inc, 'Slower', { dark: true, size: 24 * m, sub, disabled: st.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, W_.exit, 'Leave', { dark: true, size: 26 * m });
}

export function caption(ctx, lines, y, o = {}) {
  const w = o.w ?? 640, px = o.x ?? (VIEW.w - w) / 2, cx = px + w / 2;
  let size = o.size ?? 26, wrapped, lh, h;
  for (;;) {
    ctx.font = `600 ${size}px ${FONT}`;
    wrapped = [];
    lines.forEach((l) => wrapLines(ctx, l.text, w - 28).forEach((t, i) => wrapped.push({ text: t, col: l.col, bold: l.bold, i })));
    lh = size * 1.32; h = wrapped.length * lh + 24;
    if (!o.maxH || h <= o.maxH || size <= minFs()) break;
    size -= 1;
  }
  roundPath(ctx, px, y, w, h, 20); ctx.fillStyle = o.fill ?? 'rgba(24,10,4,0.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,243,220,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  wrapped.forEach((l, i) => { ctx.font = `${l.bold ? 700 : 500} ${size}px ${FONT}`; ctx.fillStyle = l.col ?? '#fff3dc'; ctx.fillText(l.text, cx, y + 12 + (i + 0.85) * lh); });
  return h;
}

// the cover card between two players (the first player's aim stays hidden)
export function passButton(state) {
  const S = curLayout(), sc = TEXT_SCALES[state.settings.textIdx], bh = Math.round(100 + 30 * (sc - 1));
  const y = Math.min(S.h - Math.max(40, S.ins.b + 16) - bh, Math.round(S.h * 0.5625 + 160 * (sc - 1)));
  return { x: S.w / 2 - 250, y, w: 500, h: bh };
}
export function drawPassCard(ctx, state) {
  const S = curLayout(), m = state.match, nm = m.cfg.names[state.side], cx = S.w / 2;
  ctx.fillStyle = 'rgba(24,10,4,0.93)'; ctx.fillRect(0, 0, S.w, S.h);
  const r = passButton(state), top = Math.max(S.ins.t + 40, 60), room = r.y - 24 - top, tw = Math.min(S.w - 80, 760);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let sc = TEXT_SCALES[state.settings.textIdx], tfs, bfs, tl, lines, total;
  for (;;) {
    tfs = Math.round(52 * Math.min(sc, 1.5)); bfs = Math.round(28 * sc);
    ctx.font = `italic 700 ${tfs}px ${DISPLAY}`; tl = wrapLines(ctx, `${nm}, your turn`, tw);
    ctx.font = `500 ${bfs}px ${FONT}`; lines = wrapLines(ctx, `Pass the device. ${m.cfg.names[1 - state.side]}'s launch is locked in and hidden.`, tw - 20);
    total = tl.length * tfs * 1.15 + 20 + lines.length * bfs * 1.3;
    if (total <= room || sc <= 0.6) break;
    sc -= 0.1;
  }
  let y = top + Math.max(0, (room - total) / 2) + tfs * 0.9;
  ctx.font = `italic 700 ${tfs}px ${DISPLAY}`; ctx.fillStyle = '#ffe9a0';
  tl.forEach((l) => { ctx.fillText(l, cx, y); y += tfs * 1.15; });
  y += 20 - tfs * 0.1;
  ctx.font = `500 ${bfs}px ${FONT}`; ctx.fillStyle = '#fff3dc';
  lines.forEach((l) => { ctx.fillText(l, cx, y); y += bfs * 1.3; });
  drawButton(ctx, r, 'Ready', { primary: true, size: Math.round(34 * Math.min(TEXT_SCALES[state.settings.textIdx], 2)) });
}

// ---- the whole play screen -------------------------------------------------------------------
export function sceneOf(state) {
  const m = state.match;
  return { arena: m.cfg.arena, tops: state.w ? state.w.tops : state.pre, looks: m.cfg.looks.map(lookOf), trails: state.trails, parts: state.parts, clock: state.t, age: state.w ? state.w.t : undefined };
}

export function renderPlay(ctx, state) {
  const { match: m } = state, S = curLayout(), L = S.play(state.settings.textIdx), xf = L.xf;
  const cm = Math.min(L.m, 1.6);
  const watch = m.cfg.mode === 'watch';
  if (state.ph === 'pass') { drawTableLayer(ctx); drawPassCard(ctx, state); return; }
  drawTableLayer(ctx);
  ctx.save();
  ctx.translate(xf.tx, xf.ty); ctx.scale(xf.s, xf.s);
  drawScene(ctx, sceneOf(state));
  // the aim and the coach's suggestion
  if (!watch && (state.ph === 'aim' || state.ph === 'timing')) {
    if (state.hint && state.hint.t < state.hint.dur && state.ph === 'aim') {
      const an = aimAnchor(state.side), hv = state.hint;
      const dirx = Math.cos(hv.launch.ang), diry = Math.sin(hv.launch.ang) * ARENA.sy, nrm = Math.hypot(dirx, diry);
      const len = 40 + 110 * hv.launch.pow, ex = an.x + (dirx / nrm) * len, ey = an.y - 8 + (diry / nrm) * len;
      ctx.save(); ctx.strokeStyle = '#f4c95d'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -state.t * 30;
      ctx.beginPath(); ctx.moveTo(an.x, an.y - 8); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      arrowHead(ctx, ex + (dirx / nrm) * 10, ey + (diry / nrm) * 10, Math.atan2(diry, dirx), 22, '#f4c95d');
      if (hv.path) drawPath(ctx, hv.path, '#f4c95d', hv.path.out, state.t);
    }
    drawAim(ctx, state, L);
  }
  if (watch && state.wl) drawWatchGhosts(ctx, state);
  // the intro and the knock-out call are painted on the dish
  if (state.ph === 'intro') {
    const cs = Math.min(L.m, 1.3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `italic 700 ${Math.round(88 * cs)}px ${DISPLAY}`; textShadow(ctx, `Round ${m.round}`, ARENA.cx, ARENA.cy - 50, '#fff3dc', 18);
  }
  if (state.ph === 'over' && state.w && state.w.over) drawKO(ctx, state, L);
  ctx.restore();
  drawCards(ctx, L);
  drawHud(ctx, state, L);
  if (watch) drawWatchBar(ctx, state, L); else drawControls(ctx, state, L);
  if (state.ph === 'timing') drawGauge(ctx, state, L);
  if (watch) drawWatchOverlay(ctx, state, L);
  const C0 = L.cap, cw = L.wide ? Math.min(cm, 1.2) : cm;
  const capO = (size, extra = {}) => ({ x: C0.x, w: C0.w, size: size * cw * (L.wide ? 0.95 : 1), maxH: L.wide ? C0.h : undefined, ...extra });
  if (state.hint && state.hint.t < state.hint.dur && state.ph === 'aim' && !watch) {
    const deg = hintWords(state);
    caption(ctx, [{ text: `Think: ${state.hint.reason}`, bold: true, col: '#ffe9a0' }, { text: deg, col: '#fff3dc' }], C0.y, capO(22));
  } else if (state.hintBusy) caption(ctx, [{ text: 'Thinking...', bold: true, col: '#ffe9a0' }], C0.y, L.wide ? capO(24) : { size: 24 * cm, w: 300 * cm });
  else if (state.toastT > 0 && state.toast) caption(ctx, [{ text: state.toast, bold: true }], C0.y, capO(24));
  if (state.paused && watch) {
    ctx.fillStyle = 'rgba(24,10,4,0.35)'; ctx.fillRect(L.field.x, L.field.y, L.field.w, L.field.h);
    ctx.textAlign = 'center'; ctx.font = `italic 700 ${Math.round(80 * Math.min(L.m, 1.3) * Math.min(1, xf.s + 0.1))}px ${DISPLAY}`; textShadow(ctx, 'Paused', L.dishC.x, L.dishC.y - 40, '#fff3dc', 14);
  }
  if (state.flash > 0) { ctx.fillStyle = `rgba(255,248,230,${Math.min(0.5, state.flash)})`; ctx.fillRect(0, 0, S.w, S.h); }
}

function hintWords(state) {
  const l = state.hint.launch, d = ((l.ang + Math.PI / 2 + Math.PI * 4) % TAU) * 180 / Math.PI, dd = d > 180 ? d - 360 : d;
  const rel = Math.round(state.side === 1 ? -dd : dd);
  return `Power ${Math.round(l.pow * 100)}%, ${Math.abs(rel) < 3 ? 'straight ahead' : `${Math.abs(rel)}° ${rel > 0 ? 'right' : 'left'}`}`;
}

function drawKO(ctx, state, L) {
  const o = state.w.over, k = clamp(state.phT / 0.4, 0, 1);
  const why = o.why === 'out' ? 'RING OUT!' : o.why === 'wobble' ? 'TIPPED OVER!' : o.why === 'time' ? 'TIME!' : 'SPUN OUT!';
  const cs = Math.min(L.m, 1.35);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const s = 0.7 + 0.3 * (1 - Math.pow(1 - k, 3));
  ctx.translate(ARENA.cx, ARENA.cy - 20); ctx.scale(s, s);
  ctx.globalAlpha = k;
  let kfs = Math.round(84 * cs); ctx.font = `italic 700 ${kfs}px ${DISPLAY}`;
  const maxW = (VIEW.w - 40) / (L.xf.s * s);
  const mw = ctx.measureText(why).width; if (mw > maxW) { kfs = Math.floor(kfs * maxW / mw); ctx.font = `italic 700 ${kfs}px ${DISPLAY}`; }
  textShadow(ctx, why, 0, 0, '#ffe27a', 18);
  ctx.restore();
}

function drawWatchGhosts(ctx, state) {
  const wt = state.wl;
  if (wt.phase === 'reveal' && wt.plans) {
    [0, 1].forEach((side) => {
      const p = wt.plans[side]; if (!p) return;
      const an = aimAnchor(side), dirx = Math.cos(p.launch.ang), diry = Math.sin(p.launch.ang) * ARENA.sy, nrm = Math.hypot(dirx, diry);
      const len = 40 + 110 * p.launch.pow, ex = an.x + (dirx / nrm) * len, ey = an.y - 8 + (diry / nrm) * len;
      const col = side === 0 ? '#7fe8d6' : '#ff9a86';
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -state.t * 30;
      ctx.beginPath(); ctx.moveTo(an.x, an.y - 8); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      arrowHead(ctx, ex + (dirx / nrm) * 10, ey + (diry / nrm) * 10, Math.atan2(diry, dirx), 22, col);
      if (p.path) drawPath(ctx, p.path, col, p.path.out, state.t);
    });
  } else if (wt.phase === 'think') {
    // the launches each player is weighing appear as dots at the end of their reach
    const cands = wt.show ?? [];
    const k = Math.min(cands.length, Math.floor(cands.length * Math.min(1, wt.t / Math.max(0.5, wt.dur * 0.85))));
    for (let i = 0; i < k; i++) {
      const c = cands[i], an = aimAnchor(c.side), dirx = Math.cos(c.ang), diry = Math.sin(c.ang) * ARENA.sy, nrm = Math.hypot(dirx, diry), len = 40 + 110 * c.pow;
      ctx.fillStyle = `rgba(255,243,220,${0.25 + 0.3 * (1 - i / Math.max(1, cands.length))})`;
      ctx.beginPath(); ctx.arc(an.x + (dirx / nrm) * len, an.y - 8 + (diry / nrm) * len, 9, 0, TAU); ctx.fill();
    }
  }
}

// Watch & Learn overlay: the Think -> Reveal -> Act clock and what the players are weighing. Stack: a strip over the top of the
// dish. Wide: stacked in the left card (label and seconds on one row, the progress bar under them, then the captions).
function drawWatchOverlay(ctx, state, L) {
  const wt = state.wl;
  if (!wt) return;
  const cm = Math.min(L.m, 1.6);
  const label = wt.phase === 'think' ? 'THINK' : wt.phase === 'reveal' ? 'REVEAL' : 'ACT';
  const secs = Math.max(0, wt.dur - wt.t), lcol = wt.phase === 'think' ? '#ffe9a0' : wt.phase === 'reveal' ? '#7fe8d6' : '#ff9a86';
  const lines = [];
  if (wt.phase === 'reveal' && wt.plans) {
    [0, 1].forEach((side) => { const p = wt.plans[side]; if (p) lines.push({ text: `${nameOf(state, side)}: ${p.reason}`, col: side === 0 ? '#aaf3e6' : '#ffc0b2', bold: true }); });
  } else if (wt.phase === 'think') lines.push({ text: 'Both players try launches in their heads and weigh what would happen.', col: '#fff3dc' });
  else lines.push({ text: 'Launch! The tops carry out the plans.', col: '#fff3dc' });
  const prog = clamp(wt.t / wt.dur, 0, 1);
  const barOf = (bx, byy, bw, bh) => {
    roundPath(ctx, bx, byy, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,243,220,0.2)'; ctx.fill();
    ctx.save(); roundPath(ctx, bx, byy, bw, bh, bh / 2); ctx.clip(); ctx.fillStyle = '#f4c95d'; ctx.fillRect(bx, byy, bw * prog, bh); ctx.restore();
  };
  ctx.textBaseline = 'alphabetic';
  if (!L.wide) {
    const pw = 600, px = L.cap.x + 20, py = L.hudBottom + 16, ph = Math.round(62 * cm);
    roundPath(ctx, px, py, pw, ph, 20); ctx.fillStyle = 'rgba(24,10,4,0.82)'; ctx.fill();
    const lf = Math.round(28 * cm), sf = Math.round(26 * cm), by = py + ph / 2 + lf * 0.36;
    ctx.textAlign = 'left'; ctx.font = `700 ${lf}px ${FONT}`; ctx.fillStyle = lcol; ctx.fillText(label, px + 24, by);
    const lw = ctx.measureText('REVEAL').width;
    ctx.font = `700 ${sf}px ${FONT}`; const sw = ctx.measureText('10.0 s').width;
    const bx = px + 24 + lw + 18, bw = Math.max(40, pw - 24 - lw - 18 - sw - 40), bh = Math.round(14 * Math.min(cm, 1.3));
    barOf(bx, py + ph / 2 - bh / 2, bw, bh);
    ctx.textAlign = 'right'; ctx.font = `700 ${sf}px ${FONT}`; ctx.fillStyle = '#fff3dc'; ctx.fillText(`${secs.toFixed(1)} s`, px + pw - 22, by);
    caption(ctx, lines, py + ph + 12, { size: 23 * cm, w: pw, x: px });
    return;
  }
  const C0 = L.cap, lf = Math.round(26 * Math.min(cm, 1.25)), bh = 12;
  ctx.textAlign = 'left'; ctx.font = `700 ${lf}px ${FONT}`; ctx.fillStyle = lcol; ctx.fillText(label, C0.x + 4, C0.y + lf);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff3dc'; ctx.fillText(`${secs.toFixed(1)} s`, C0.x + C0.w - 4, C0.y + lf);
  barOf(C0.x + 4, C0.y + lf + 10, C0.w - 8, bh);
  const top = C0.y + lf + 10 + bh + 12;
  caption(ctx, lines, top, { size: 22 * Math.min(cm, 1.2), w: C0.w, x: C0.x, maxH: Math.max(70, C0.y + C0.h - top) });
}

// The round banner follows the text-size setting up to 300%; if the panel would no longer fit the screen the text
// steps down a notch until it does.
export function bannerGeom(ctx, b, s, maxH = 1190) {
  const pw = Math.min(s > 1 ? 650 : 580, VIEW.w - 40);
  for (let sc = s; ; sc = Math.max(1, sc - 0.25)) {
    const tFs = Math.round(54 * Math.min(sc, 1.7)), lFs = Math.round(28 * sc), sFs = Math.round(28 * Math.min(sc, 2));
    ctx.font = `italic 700 ${tFs}px ${DISPLAY}`; const tl = wrapLines(ctx, b.title, pw - 60);
    ctx.font = `500 ${lFs}px ${FONT}`; const ll = wrapLines(ctx, b.line, pw - 60);
    ctx.font = `700 ${sFs}px ${FONT}`; const sl = wrapLines(ctx, b.score, pw - 60);
    const bFs = Math.round(32 * Math.min(sc, 2.2)), bH = Math.max(92, Math.round(bFs * 1.15 + 44));
    const tH = tl.length * tFs * 1.14, lH = ll.length * lFs * 1.3, sH = sl.length * sFs * 1.2;
    const total = 34 + tH + 16 + lH + 14 + sH + 22 + (b.auto ? Math.round(24 * Math.min(sc, 2) * 1.5) : bH) + 30;
    if (total <= maxH || sc <= 1) return { pw, sc, tFs, lFs, sFs, bFs, bH, tl, ll, sl, tH, lH, sH, total };
  }
}

export function drawBanner(ctx, state) {
  const b = state.banner;
  if (!b) return;
  const S = curLayout(), cx = S.w / 2;
  const g = bannerGeom(ctx, b, TEXT_SCALES[state.settings.textIdx], Math.min(1190, S.h - Math.max(40, S.ins.t + S.ins.b + 20)));
  ctx.fillStyle = 'rgba(24,10,4,0.5)'; ctx.fillRect(0, 0, S.w, S.h);
  const px = cx - g.pw / 2, py = Math.max(S.ins.t + 20, Math.min(320, (S.h - g.total) / 2));
  panel(ctx, px, py, g.pw, g.total, { r: 30, fill: 'rgba(255,243,220,0.97)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let y = py + 34;
  ctx.fillStyle = b.win ? C.tealDark : C.vermDark; ctx.font = `italic 700 ${g.tFs}px ${DISPLAY}`;
  g.tl.forEach((l, i) => ctx.fillText(l, cx, y + g.tFs * (0.86 + i * 1.14))); y += g.tH + 16;
  ctx.fillStyle = C.ink; ctx.font = `500 ${g.lFs}px ${FONT}`;
  g.ll.forEach((l, i) => ctx.fillText(l, cx, y + g.lFs * (0.95 + i * 1.3))); y += g.lH + 14;
  ctx.font = `700 ${g.sFs}px ${FONT}`; ctx.fillStyle = C.vermDark;
  g.sl.forEach((l, i) => ctx.fillText(l, cx, y + g.sFs * (0.9 + i * 1.2))); y += g.sH + 22;
  if (!b.auto) drawButton(ctx, { x: px + 40, y, w: g.pw - 80, h: g.bH }, b.last ? (b.lessonNext ?? 'See result') : 'Next round', { primary: true, size: g.bFs });
  else { const f = Math.round(24 * Math.min(g.sc, 2)); ctx.font = `500 ${f}px ${FONT}`; ctx.fillStyle = 'rgba(46,26,15,0.7)'; ctx.fillText('Continuing...', cx, y + f); }
}

export { PROFILES, lookOf };
